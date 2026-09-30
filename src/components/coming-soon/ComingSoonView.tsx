import { useEffect, useMemo, useState } from "react";
import type { LibraryEntry } from "../../types/personal";

interface DateParts {
  year?: number | null;
  month?: number | null;
  day?: number | null;
}

interface AiringEpisode {
  airingAt: number;
  episode: number;
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

const CACHE_PREFIX = "renanime:coming-soon:v5:";
const CACHE_TTL = 6 * 60 * 60 * 1000;
const UPCOMING_PAGE_SIZE = 20;
const MAX_UPCOMING_PAGES = 10;

function titleOf(media: RelatedMedia | undefined, fallback = "Sin título") {
  return media?.title?.romaji || media?.title?.english || fallback;
}

function normalizeTitle(title: string) {
  return title
    .normalize("NFKD")
    .replace(/[\\u0300-\\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\\s+/g, " ");
}

function titleMatches(entryTitle: string, node: RelatedMedia) {
  const wanted = normalizeTitle(entryTitle);
  if (!wanted) return false;

  return [node.title?.romaji, node.title?.english]
    .filter((value): value is string => Boolean(value))
    .some((value) => normalizeTitle(value) === wanted);
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
  return dateValue(media.startDate) >= Number(new Date().toISOString().slice(0, 10).replace(/-/g, ""));
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function readCache(): CandidateMedia[] | undefined {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + "upcoming");
    if (!raw) return undefined;

    const parsed = JSON.parse(raw) as {
      savedAt: number;
      data: CandidateMedia[];
    };

    if (!parsed || Date.now() - parsed.savedAt > CACHE_TTL) {
      localStorage.removeItem(CACHE_PREFIX + "upcoming");
      return undefined;
    }

    return parsed.data;
  } catch {
    return undefined;
  }
}

function writeCache(data: CandidateMedia[]) {
  try {
    localStorage.setItem(
      CACHE_PREFIX + "upcoming",
      JSON.stringify({ savedAt: Date.now(), data }),
    );
  } catch {}
}

async function fetchUpcomingPage(page: number): Promise<{
  ok: boolean;
  data: CandidateMedia[];
  hasNextPage: boolean;
  limited?: boolean;
}> {
  const query = `
    query UpcomingCollection($page: Int!, $perPage: Int!) {
      Page(page: $page, perPage: $perPage) {
        pageInfo {
          hasNextPage
        }
        media(
          type: ANIME
          status: NOT_YET_RELEASED
          format_in: [TV, MOVIE]
          sort: START_DATE
        ) {
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
          relations(page: 1, perPage: 10) {
            edges {
              relationType
              node {
                id
                title {
                  romaji
                  english
                }
              }
            }
          }
        }
      }
    }
  `;

  try {
    const response = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        query,
        variables: {
          page,
          perPage: UPCOMING_PAGE_SIZE,
        },
      }),
    });

    const payload = await response.json().catch(() => null);

    if (response.status === 429) {
      console.warn("[Renanime] AniList rate limit reached.");
      return { ok: false, data: [], hasNextPage: false, limited: true };
    }

    if (!response.ok || payload?.errors) {
      console.warn("[Renanime] AniList upcoming query failed:", {
        status: response.status,
        errors: payload?.errors ?? null,
      });
      return { ok: false, data: [], hasNextPage: false };
    }

    return {
      ok: true,
      data: (payload.data?.Page?.media ?? []) as CandidateMedia[],
      hasNextPage: Boolean(payload.data?.Page?.pageInfo?.hasNextPage),
    };
  } catch (error) {
    console.warn("[Renanime] AniList upcoming request failed:", error);
    return { ok: false, data: [], hasNextPage: false };
  }
}

async function fetchUpcoming(entries: LibraryEntry[]) {
  const watchedEntries = entries.filter((entry) => entry.state.status === "WATCHED");
  const cached = readCache();
  const candidates: CandidateMedia[] = cached ? [...cached] : [];
  const seenCandidates = new Set(candidates.map((candidate) => candidate.id));

  if (!cached) {
    for (let page = 1; page <= MAX_UPCOMING_PAGES; page += 1) {
      const result = await fetchUpcomingPage(page);

      if (!result.ok) {
        return {
          candidates,
          limited: result.limited ?? false,
        };
      }

      result.data.forEach((candidate) => {
        if (!seenCandidates.has(candidate.id)) {
          seenCandidates.add(candidate.id);
          candidates.push(candidate);
        }
      });

      if (!result.hasNextPage) break;
      if (page < MAX_UPCOMING_PAGES) await wait(2200);
    }

    writeCache(candidates);
  }

  const ownedTitles = new Set(
    watchedEntries.map((entry) => normalizeTitle(entry.title)),
  );

  const result: ComingItem[] = [];
  const seen = new Set<number>();

  candidates.forEach((candidate) => {
    if (!isUpcomingMedia(candidate)) return;

    candidate.relations?.edges?.forEach((edge) => {
      const node = edge.node;
      if (!node) return;

      const relationType = edge.relationType ?? "";
      const matchedEntry = watchedEntries.find((entry) => {
        const normalized = normalizeTitle(entry.title);
        return normalized === normalizeTitle(node.title?.romaji ?? "")
          || normalized === normalizeTitle(node.title?.english ?? "");
      });

      if (!matchedEntry) return;

      // Desde el punto de vista de la nueva obra, PREQUEL significa
      // que la obra relacionada es anterior: por tanto, es una continuación.
      const isNewSeason = relationType === "PREQUEL";
      const isMovieContinuation = candidate.format === "MOVIE" && relationType === "PARENT";

      if (!isNewSeason && !isMovieContinuation) return;
      if (ownedTitles.has(normalizeTitle(titleOf(candidate)))) return;
      if (seen.has(candidate.id)) return;

      seen.add(candidate.id);
      result.push({
        ...candidate,
        kind: "RELEASE",
        sourceTitle: matchedEntry.title,
        relationType,
      });
    });
  });

  return { candidates: result, limited: false };
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
              const isEpisode = item.kind === "EPISODE";
              const label = isEpisode
                ? `Episodio ${item.episode ?? "nuevo"} · ${episodeDateLabel(item.airingAt)}`
                : `${dateLabel(item.startDate)} · ${item.format === "MOVIE" ? "Film" : "Series"}`;

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
                    <span className="coming-badge">{isEpisode ? "PRÓXIMO EP." : "PRÓXIMO"}</span>
                  </div>

                  <div className="coming-info">
                    <h3>{title}</h3>
                    <span>{label}</span>
                    <small>{isEpisode ? item.sourceTitle : `Relacionado con ${item.sourceTitle}`}</small>
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
