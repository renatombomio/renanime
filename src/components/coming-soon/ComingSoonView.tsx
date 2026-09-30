import { useEffect, useState } from "react";
import type { LibraryEntry } from "../../types/personal";

interface DateParts {
  year?: number | null;
  month?: number | null;
  day?: number | null;
}

interface RelatedMedia {
  id: number;
  idMal?: number | null;
  title?: { romaji?: string | null; english?: string | null };
  startDate?: DateParts | null;
  coverImage?: { extraLarge?: string | null; large?: string | null };
  format?: string | null;
  status?: string | null;
}

interface CandidateMedia extends RelatedMedia {
  relations?: {
    edges?: Array<{
      relationType?: string | null;
      node?: RelatedMedia | null;
    }> | null;
  } | null;
}

interface ComingItem extends RelatedMedia {
  kind: "RELEASE";
  sourceTitle: string;
  relationType?: string | null;
}

interface Props {
  entries: LibraryEntry[];
}

const CACHE_PREFIX = "renanime:coming-soon:v6:";
const CACHE_TTL = 24 * 60 * 60 * 1000;
const SEARCH_BATCH_SIZE = 8;
const SEARCH_DELAY_MS = 900;

interface SearchMedia extends RelatedMedia {
  relations?: {
    edges?: Array<{
      relationType?: string | null;
      node?: RelatedMedia | null;
    }> | null;
  } | null;
}

interface SearchResult {
  source: SearchMedia | null;
  sourceTitle: string;
}

function titleVariants(media: RelatedMedia | undefined) {
  return [
    media?.title?.romaji,
    media?.title?.english,
  ].filter((value): value is string => Boolean(value));
}

function titleSimilarity(query: string, media: RelatedMedia) {
  const queryTokens = new Set(normalizeTitle(query).split(" ").filter(Boolean));
  const candidateTokens = new Set(
    titleVariants(media).flatMap((title) => normalizeTitle(title).split(" ").filter(Boolean)),
  );

  if (!queryTokens.size || !candidateTokens.size) return 0;

  let overlap = 0;
  queryTokens.forEach((token) => {
    if (candidateTokens.has(token)) overlap += 1;
  });

  return overlap / Math.max(queryTokens.size, candidateTokens.size);
}

function dateValue(date: DateParts | null | undefined) {
  if (!date?.year) return Number.POSITIVE_INFINITY;
  return date.year * 10000 + (date.month ?? 1) * 100 + (date.day ?? 1);
}

function dateLabel(date: DateParts | null | undefined) {
  if (!date?.year) return "Fecha por confirmar";
  if (!date.month) return String(date.year);
  return new Date(date.year, date.month - 1, date.day ?? 1).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function isUpcomingMedia(media: RelatedMedia) {
  if (media.status === "NOT_YET_RELEASED") return true;

  const today = Number(new Date().toISOString().slice(0, 10).replace(/-/g, ""));
  return dateValue(media.startDate) >= today;
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function readCache(key: string): SearchResult | undefined {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + normalizeTitle(key));
    if (!raw) return undefined;

    const parsed = JSON.parse(raw) as {
      savedAt: number;
      data: SearchResult;
    };

    if (!parsed || Date.now() - parsed.savedAt > CACHE_TTL) {
      localStorage.removeItem(CACHE_PREFIX + normalizeTitle(key));
      return undefined;
    }

    return parsed.data;
  } catch {
    return undefined;
  }
}

function writeCache(key: string, data: SearchResult) {
  try {
    localStorage.setItem(
      CACHE_PREFIX + normalizeTitle(key),
      JSON.stringify({ savedAt: Date.now(), data }),
    );
  } catch {}
}

async function searchWatchedBatch(
  entries: LibraryEntry[],
): Promise<{ results: SearchResult[]; limited: boolean }> {
  if (!entries.length) return { results: [], limited: false };

  const variables: Record<string, string> = {};
  const aliases = entries.map((entry, index) => {
    const variable = "s" + index;
    variables[variable] = entry.title;
    return { alias: "a" + index, variable, entry };
  });

  const mediaFields = `
    id
    idMal
    title {
      romaji
      english
    }
    startDate {
      year
      month
      day
    }
    coverImage {
      extraLarge
      large
    }
    format
    status
    relations(page: 1, perPage: 30) {
      edges {
        relationType
        node {
          id
          idMal
          title {
            romaji
            english
          }
          startDate {
            year
            month
            day
          }
          coverImage {
            extraLarge
            large
          }
          format
          status
        }
      }
    }
  `;

  const query = `
    query CollectionUpcoming(
      ${aliases.map(({ variable }) => "$" + variable + ": String!").join("\n      ")}
    ) {
      ${aliases
        .map(
          ({ alias, variable }) => `
      ${alias}: Page(page: 1, perPage: 5) {
        media(search: $${variable}, type: ANIME) {
          ${mediaFields}
        }
      }`,
        )
        .join("\n")}
    }
  `;

  try {
    const response = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ query, variables }),
    });

    const payload = await response.json().catch(() => null);

    if (response.status === 429) {
      console.warn("[Renanime] AniList rate limit reached while resolving collection.");
      return { results: [], limited: true };
    }

    if (!response.ok || payload?.errors) {
      console.warn("[Renanime] AniList collection query failed:", {
        status: response.status,
        errors: payload?.errors ?? null,
      });
      return { results: [], limited: false };
    }

    const results: SearchResult[] = [];

    aliases.forEach(({ alias, entry }) => {
      const media = (payload.data?.[alias]?.media ?? []) as SearchMedia[];

      const source =
        [...media]
          .sort(
            (a, b) =>
              titleSimilarity(entry.title, b) - titleSimilarity(entry.title, a),
          )[0] ?? null;

      results.push({
        source,
        sourceTitle: entry.title,
      });
    });

    return { results, limited: false };
  } catch (error) {
    console.warn("[Renanime] AniList collection request failed:", error);
    return { results: [], limited: false };
  }
}

async function fetchUpcoming(entries: LibraryEntry[]) {
  const watchedEntries = entries.filter((entry) => entry.state.status === "WATCHED");
  const result: ComingItem[] = [];
  const seen = new Set<number>();
  let limited = false;

  for (let index = 0; index < watchedEntries.length; index += SEARCH_BATCH_SIZE) {
    const batch = watchedEntries.slice(index, index + SEARCH_BATCH_SIZE);
    const resolved: SearchResult[] = [];
    const missing: LibraryEntry[] = [];

    batch.forEach((entry) => {
      const cached = readCache(entry.title);
      if (cached) {
        resolved.push(cached);
      } else {
        missing.push(entry);
      }
    });

    if (missing.length) {
      const fetched = await searchWatchedBatch(missing);

      if (fetched.limited) {
        limited = true;
        break;
      }

      fetched.results.forEach((item, itemIndex) => {
        const entry = missing[itemIndex];
        if (entry) writeCache(entry.title, item);
        resolved.push(item);
      });

      if (index + SEARCH_BATCH_SIZE < watchedEntries.length) {
        await wait(SEARCH_DELAY_MS);
      }
    }

    resolved.forEach(({ source, sourceTitle }) => {
      if (!source) return;

      source.relations?.edges?.forEach((edge) => {
        const node = edge.node;
        if (!node || !isUpcomingMedia(node)) return;

        const relationType = edge.relationType ?? "";

        if (!["SEQUEL", "SIDE_STORY", "SPIN_OFF", "OTHER"].includes(relationType)) {
          return;
        }

        if (seen.has(node.id)) return;

        seen.add(node.id);
        result.push({
          ...node,
          kind: "RELEASE",
          sourceTitle,
          relationType,
        });
      });
    });
  }

  return { candidates: result, limited };
}

export default function ComingSoonView({ entries }: Props) {
  const [items, setItems] = useState<ComingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiLimited, setApiLimited] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const result = await fetchUpcoming(entries);

      if (!cancelled) {
        setItems(
          result.candidates.sort(
            (a, b) => dateValue(a.startDate) - dateValue(b.startDate),
          ),
        );
        setApiLimited(result.limited);
        setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [entries]);


  if (loading && !items.length) {
    return <div className="coming-loading">Buscando nuevas temporadas y películas de mi colección…</div>;
  }

  return (
    <div className="coming-view">
      {items.length ? (
        <>
          <div className="coming-count">
            {items.length} {items.length === 1 ? "próximo lanzamiento" : "próximos lanzamientos"}
          </div>

          {loading ? <div className="coming-progress">Comprobando próximas temporadas y películas…</div> : null}
          {apiLimited ? (
            <div className="coming-api-note">
              AniList está limitando temporalmente las consultas. Mostrando lo que ya se pudo cargar.
            </div>
          ) : null}

          <div className="coming-grid">
            {items.map((item, index) => {
              const title = titleOf(item);
              const label = `${dateLabel(item.startDate)} · ${item.format === "MOVIE" ? "Film" : "Series"}`;

              return (
                <a
                  className="coming-card"
                  href={"/anime/search?id=" + item.id + "&from=coming-soon"}
                  key={item.id + "-" + item.kind}
                >
                  <div className="coming-poster">
                    {item.coverImage?.extraLarge || item.coverImage?.large ? (
                      <img
                        src={item.coverImage.extraLarge || item.coverImage.large || ""}
                        alt={title}
                        loading={index < 6 ? "eager" : "lazy"}
                      />
                    ) : (
                      <div className="coming-poster-placeholder" aria-hidden="true">
                        <span>Renanime</span>
                      </div>
                    )}
                    <span className="coming-badge">PRÓXIMO</span>
                  </div>

                  <div className="coming-info">
                    <h3>{title}</h3>
                    <span>{label}</span>
                    <small>Continuación de {item.sourceTitle}</small>
                  </div>
                </a>
              );
            })}
          </div>
        </>
      ) : (
        <div className="coming-empty">
          <strong>{apiLimited ? "AniList está temporalmente limitado." : "De momento, nada pendiente."}</strong>
          <span>
            {apiLimited
              ? "No hemos podido terminar la consulta. Volveremos a intentarlo en una próxima carga."
              : "Cuando alguno de los animes que ya he visto tenga una nueva temporada o película en camino, aparecerá aquí."}
          </span>
        </div>
      )}

      <div className="coming-sources" aria-label="Fuentes externas">
        <span>Fuentes externas</span>
        <a href="https://anichart.net/Winter-2027" target="_blank" rel="noreferrer">AniChart · Winter 2027</a>
        <a href="https://myanimelist.net/news" target="_blank" rel="noreferrer">MyAnimeList · News</a>
      </div>

      <style>{`
        .coming-view { width: 100%; }
        .coming-loading, .coming-empty {
          padding: 4rem 1rem;
          border: 1px solid var(--color-border);
          color: var(--color-muted-400);
          text-align: center;
          font-family: var(--font-meta);
          font-size: .68rem;
          letter-spacing: .08em;
          text-transform: uppercase;
        }
        .coming-empty { display: grid; gap: .7rem; }
        .coming-empty strong {
          color: var(--color-paper-50);
          font-family: var(--font-body);
          font-size: 1.1rem;
          font-weight: 500;
          letter-spacing: 0;
          text-transform: none;
        }
        .coming-empty span { letter-spacing: .03em; text-transform: none; }
        .coming-count {
          margin-bottom: .55rem;
          color: var(--color-muted-400);
          font-family: var(--font-meta);
          font-size: .6rem;
          letter-spacing: .09em;
          text-transform: uppercase;
        }
        .coming-progress,
        .coming-api-note {
          margin-bottom: 1.25rem;
          color: var(--color-muted-500);
          font-family: var(--font-meta);
          font-size: .5rem;
          letter-spacing: .06em;
          text-transform: uppercase;
        }
        .coming-api-note { color: var(--color-muted-400); }
        .coming-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: clamp(2.5rem, 5vw, 5rem) clamp(.85rem, 1.8vw, 1.75rem);
        }
        .coming-card { display: block; min-width: 0; color: inherit; }
        .coming-poster {
          position: relative;
          aspect-ratio: 2 / 3;
          overflow: hidden;
          background: var(--color-ink-800);
        }
        .coming-poster img {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 650ms cubic-bezier(.2,.7,.2,1);
        }
        .coming-card:hover .coming-poster img { transform: scale(1.035); }
        .coming-badge {
          position: absolute;
          top: .65rem;
          left: .65rem;
          padding: .35rem .45rem;
          border: 1px solid rgba(245,242,236,.22);
          background: rgba(9,9,9,.58);
          color: var(--color-paper-50);
          font-family: var(--font-meta);
          font-size: .48rem;
          letter-spacing: .1em;
          backdrop-filter: blur(8px);
        }
        .coming-info { display: grid; gap: .35rem; padding-top: .7rem; }
        .coming-info h3 {
          margin: 0;
          color: var(--color-paper-50);
          font-family: var(--font-body);
          font-size: .82rem;
          font-weight: 500;
          line-height: 1.2;
        }
        .coming-info span {
          color: var(--color-paper-200);
          font-family: var(--font-meta);
          font-size: .52rem;
          letter-spacing: .04em;
          text-transform: uppercase;
        }
        .coming-info small {
          color: var(--color-muted-500);
          font-family: var(--font-meta);
          font-size: .48rem;
          line-height: 1.35;
        }
        .coming-sources {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: .75rem 1rem;
          margin-top: 3.5rem;
          padding-top: 1rem;
          border-top: 1px solid var(--color-border);
          color: var(--color-muted-500);
          font-family: var(--font-meta);
          font-size: .52rem;
          letter-spacing: .06em;
          text-transform: uppercase;
        }
        .coming-sources span { color: var(--color-muted-400); }
        .coming-sources a { color: var(--color-paper-200); }
        .coming-sources a:hover { color: var(--color-paper-50); }
        @media (max-width: 1100px) {
          .coming-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
        }
        @media (max-width: 800px) {
          .coming-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        }
        @media (max-width: 560px) {
          .coming-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 2.25rem .65rem; }
          .coming-info { padding-top: .55rem; }
          .coming-info h3 { font-size: .72rem; }
          .coming-info span { font-size: .46rem; }
          .coming-info small { font-size: .43rem; }
          .coming-badge { top: .5rem; left: .5rem; padding: .28rem .35rem; font-size: .42rem; }\n          .coming-sources { margin-top: 2.5rem; font-size: .46rem; }
        }
      `}</style>
    </div>
  );
}
