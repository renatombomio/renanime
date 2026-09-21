import { useEffect, useMemo, useState } from "react";

type Status = "WATCHED" | "PENDING" | "NOT_IN_COLLECTION";
type Filter = "ALL" | "SERIES" | "MOVIES";
type Sort = "TITLE" | "YEAR_DESC" | "YEAR_ASC";

interface PersonalEntry {
  animeId: string;
  title: string;
  state: {
    status: Status;
    favorite: boolean;
    recommended: boolean;
    personalScore?: number;
    personalRanking?: number;
    review?: string;
  };
}

interface Media {
  id: number;
  title: { romaji?: string | null; english?: string | null };
  genres: string[];
  startDate?: { year?: number | null } | null;
  format?: string | null;
  coverImage?: { extraLarge?: string | null; large?: string | null };
}

interface Props {
  entries: PersonalEntry[];
}

const PAGE_SIZE = 24;

async function findMedia(title: string): Promise<Media | null> {
  const query = `
    query SearchAnime($search: String!) {
      Page(page: 1, perPage: 1) {
        media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
          id
          title { romaji english }
          genres
          startDate { year }
          format
          coverImage { extraLarge large }
        }
      }
    }
  `;

  const response = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, variables: { search: title } }),
  });

  if (!response.ok) return null;
  const payload = await response.json();
  return payload.data?.Page?.media?.[0] ?? null;
}

export default function CollectionView({ entries }: Props) {
  const [filter, setFilter] = useState<Filter>("ALL");
  const [sort, setSort] = useState<Sort>("TITLE");
  const [query, setQuery] = useState("");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [media, setMedia] = useState<Record<string, Media | null>>({});
  const [loading, setLoading] = useState(false);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return entries
      .filter((entry) => {
        if (filter === "ALL") return true;
        const format = media[entry.animeId]?.format;
        if (filter === "MOVIES") return format === "MOVIE";
        return format !== "MOVIE";
      })
      .filter((entry) => !normalized || entry.title.toLowerCase().includes(normalized))
      .sort((a, b) => {
        const aMedia = media[a.animeId];
        const bMedia = media[b.animeId];

        if (sort === "TITLE") return a.title.localeCompare(b.title);
        const ay = aMedia?.startDate?.year ?? 0;
        const by = bMedia?.startDate?.year ?? 0;
        return sort === "YEAR_DESC" ? by - ay : ay - by;
      });
  }, [entries, filter, media, query, sort]);

  const page = filtered.slice(0, visible);
  const remaining = filtered.length - page.length;

  const pageIds = page.map((entry) => entry.animeId).join("|");

  useEffect(() => {
    const missing = page
      .filter((entry) => !(entry.animeId in media))
      .slice(0, PAGE_SIZE);

    if (!missing.length) return;

    let cancelled = false;
    setLoading(true);

    Promise.all(
      missing.map(async (entry) => {
        try {
          return [entry.animeId, await findMedia(entry.title)] as const;
        } catch {
          return [entry.animeId, null] as const;
        }
      }),
    )
      .then((results) => {
        if (cancelled) return;
        setMedia((current) => ({ ...current, ...Object.fromEntries(results) }));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [pageIds]);

  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [filter, query, sort]);

  return (
    <div className="collection-view">
      <div className="collection-toolbar">
        <div className="collection-filters" aria-label="Filtrar colección">
          {(["ALL", "SERIES", "MOVIES"] as Filter[]).map((item) => (
            <button
              key={item}
              type="button"
              className={filter === item ? "is-active" : ""}
              onClick={() => setFilter(item)}
            >
              {item === "ALL" ? "All" : item === "SERIES" ? "Series" : "Movies"}
            </button>
          ))}
        </div>

        <div className="collection-tools">
          <label>
            <span className="sr-only">Buscar en colección</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar en mi colección"
              type="search"
            />
          </label>
          <select value={sort} onChange={(event) => setSort(event.target.value as Sort)} aria-label="Ordenar colección">
            <option value="TITLE">Título</option>
            <option value="YEAR_DESC">Más recientes</option>
            <option value="YEAR_ASC">Más antiguas</option>
          </select>
        </div>
      </div>

      <div className="collection-count">
        {filtered.length} {filtered.length === 1 ? "anime" : "animes"}
      </div>

      <div className="collection-grid">
        {page.map((entry) => {
          const item = media[entry.animeId];
          const type = item?.format === "MOVIE" ? "MOVIE" : "SERIES";
          return (
            <article className="collection-card" key={entry.animeId}>
              <a href={`/anime/${entry.animeId}`} aria-label={`Ver ${entry.title}`}>
                <div className="poster">
                  {item?.coverImage?.extraLarge || item?.coverImage?.large ? (
                    <img
                      src={item.coverImage.extraLarge || item.coverImage.large || ""}
                      alt={item.title.romaji || item.title.english || entry.title}
                      loading="lazy"
                    />
                  ) : (
                    <div className="poster-placeholder">{entry.title}</div>
                  )}
                  <div className="card-top">
                    <span className="format-badge">{type === "MOVIE" ? "FILM" : "SERIES"}</span>
                    {entry.state.personalScore !== undefined && (
                      <span className="score-badge">{entry.state.personalScore.toFixed(1)}</span>
                    )}
                  </div>
                  <div className="card-overlay">
                    <div className="card-overlay-title">{item?.title.romaji || item?.title.english || entry.title}</div>
                    <div className="card-overlay-meta">
                      {item?.startDate?.year || "—"}
                      {entry.state.favorite && <span>★</span>}
                      {entry.state.recommended && <span>+</span>}
                    </div>
                  </div>
                </div>
                <div className="card-info">
                  <h3>{item?.title.romaji || item?.title.english || entry.title}</h3>
                  <div className="meta">
                    <span>{item?.startDate?.year || "—"}</span>
                    <span>{type === "MOVIE" ? "Film" : "Series"}</span>
                  </div>
                </div>
              </a>
            </article>
          );
        })}
      </div>

      {loading && <p className="loading">Cargando historias…</p>}

      {remaining > 0 && (
        <button className="load-more" type="button" onClick={() => setVisible((current) => current + PAGE_SIZE)}>
          Cargar más · {remaining}
        </button>
      )}

      {!filtered.length && <p className="empty">No hay historias que coincidan con tu búsqueda.</p>}
    </div>
  );
}
