import { useEffect, useMemo, useState } from "react";

interface LibraryEntry {
  animeId: string;
  title: string;
}

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
  title?: { romaji?: string | null; english?: string | null };
  startDate?: DateParts | null;
  coverImage?: { extraLarge?: string | null; large?: string | null };
  format?: string | null;
  status?: string | null;
}

interface SourceMedia extends RelatedMedia {
  nextAiringEpisode?: AiringEpisode | null;
  relations?: {
    edges?: Array<{
      relationType?: string | null;
      node?: RelatedMedia | null;
    }> | null;
  } | null;
}

interface ComingItem extends RelatedMedia {
  kind: "RELEASE" | "EPISODE";
  sourceTitle: string;
  relationType?: string | null;
  episode?: number;
  airingAt?: number;
}

interface Props {
  entries: LibraryEntry[];
}

const CACHE_PREFIX = "renanime:coming-soon:v1:";
const CACHE_TTL = 6 * 60 * 60 * 1000;
const BATCH_SIZE = 6;
const ALLOWED_RELATIONS = new Set(["SEQUEL", "SIDE_STORY", "SPIN_OFF", "OTHER"]);

function titleOf(media: RelatedMedia | undefined, fallback = "Sin título") {
  return media?.title?.romaji || media?.title?.english || fallback;
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

function episodeDateLabel(timestamp?: number) {
  if (!timestamp) return "Fecha por confirmar";
  return new Date(timestamp * 1000).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function isFuture(date: DateParts | null | undefined) {
  if (!date?.year) return false;
  return dateValue(date) >= Number(new Date().toISOString().slice(0, 10).replace(/-/g, ""));
}

function readCache(title: string): SourceMedia | null | undefined {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + title.toLowerCase());
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as { savedAt: number; data: SourceMedia | null };
    if (!parsed || Date.now() - parsed.savedAt > CACHE_TTL) {
      localStorage.removeItem(CACHE_PREFIX + title.toLowerCase());
      return undefined;
    }
    return parsed.data;
  } catch {
    return undefined;
  }
}

function writeCache(title: string, data: SourceMedia | null) {
  try {
    localStorage.setItem(
      CACHE_PREFIX + title.toLowerCase(),
      JSON.stringify({ savedAt: Date.now(), data }),
    );
  } catch {}
}

async function fetchBatch(entries: LibraryEntry[]): Promise<Array<SourceMedia | null>> {
  const variables: Record<string, string> = {};
  const fields = entries.map((entry, index) => {
    const key = "s" + index;
    const alias = "a" + index;
    variables[key] = entry.title;
    return `
      ${alias}: Page(page: 1, perPage: 1) {
        media(search: $${key}, type: ANIME, sort: SEARCH_MATCH) {
          id
          title { romaji english }
          startDate { year month day }
          coverImage { extraLarge large }
          format
          status
          nextAiringEpisode { airingAt episode }
          relations(page: 1, perPage: 12) {
            edges {
              relationType
              node {
                id
                title { romaji english }
                startDate { year month day }
                coverImage { extraLarge large }
                format
                status
              }
            }
          }
        }
      }
    `;
  }).join("\n");

  const definitions = entries.map((_, index) => "$s" + index + ": String!").join(", ");
  const query = `query CollectionUpcoming(${definitions}) { ${fields} }`;

  try {
    const response = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) return [];
    const payload = await response.json();
    if (payload.errors) return [];

    return entries.map(
      (_, index) => (payload.data?.["a" + index]?.media?.[0] as SourceMedia | undefined) ?? null,
    );
  } catch {
    return [];
  }
}

export default function ComingSoonView({ entries }: Props) {
  const [sources, setSources] = useState<SourceMedia[]>([]);
  const [loading, setLoading] = useState(true);

  const uniqueEntries = useMemo(
    () => entries.filter((entry, index, all) => all.findIndex((item) => item.title.toLowerCase() === entry.title.toLowerCase()) === index),
    [entries],
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const cached: SourceMedia[] = [];
      const missing: LibraryEntry[] = [];

      uniqueEntries.forEach((entry) => {
        const value = readCache(entry.title);
        if (value === undefined) missing.push(entry);
        else if (value) cached.push(value);
      });

      if (cached.length && !cancelled) setSources(cached);

      for (let offset = 0; offset < missing.length; offset += BATCH_SIZE) {
        const batch = missing.slice(offset, offset + BATCH_SIZE);
        const result = await fetchBatch(batch);
        batch.forEach((entry, index) => writeCache(entry.title, result[index] ?? null));
        if (!cancelled) {
          setSources((current) => [
            ...current,
            ...result.filter((item): item is SourceMedia => Boolean(item)),
          ]);
        }
      }

      if (!cancelled) setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [uniqueEntries]);

  const items = useMemo<ComingItem[]>(() => {
    const ownedIds = new Set(sources.map((source) => source.id));
    const seen = new Set<number>();
    const result: ComingItem[] = [];

    sources.forEach((source) => {
      const sourceTitle = titleOf(source);

      if (source.nextAiringEpisode?.airingAt && source.nextAiringEpisode.airingAt * 1000 > Date.now()) {
        result.push({
          ...source,
          kind: "EPISODE",
          sourceTitle,
          episode: source.nextAiringEpisode.episode,
          airingAt: source.nextAiringEpisode.airingAt,
        });
      }

      source.relations?.edges?.forEach((edge) => {
        const node = edge.node;
        if (!node || !ALLOWED_RELATIONS.has(edge.relationType ?? "")) return;
        if (ownedIds.has(node.id) || seen.has(node.id)) return;
        if (!isFuture(node.startDate)) return;

        seen.add(node.id);
        result.push({
          ...node,
          kind: "RELEASE",
          sourceTitle,
          relationType: edge.relationType,
        });
      });
    });

    return result.sort((a, b) => {
      const aDate = a.kind === "EPISODE" ? (a.airingAt ?? Infinity) : dateValue(a.startDate) === Infinity ? Infinity : dateValue(a.startDate);
      const bDate = b.kind === "EPISODE" ? (b.airingAt ?? Infinity) : dateValue(b.startDate) === Infinity ? Infinity : dateValue(b.startDate);
      return aDate - bDate;
    });
  }, [sources]);

  if (loading && !items.length) {
    return <div className="coming-loading">Buscando lo próximo de mi colección…</div>;
  }

  return (
    <div className="coming-view">
      {items.length ? (
        <>
          <div className="coming-count">
            {items.length} {items.length === 1 ? "próximo lanzamiento" : "próximos lanzamientos"}
          </div>

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
          <strong>De momento, nada pendiente.</strong>
          <span>Cuando alguno de los animes de mi colección tenga algo nuevo en camino, aparecerá aquí.</span>
        </div>
      )}

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
          margin-bottom: 1.5rem;
          color: var(--color-muted-400);
          font-family: var(--font-meta);
          font-size: .6rem;
          letter-spacing: .09em;
          text-transform: uppercase;
        }
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
          .coming-badge { top: .5rem; left: .5rem; padding: .28rem .35rem; font-size: .42rem; }
        }
      `}</style>
    </div>
  );
}
