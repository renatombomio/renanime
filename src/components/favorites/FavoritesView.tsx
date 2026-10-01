import { useEffect, useMemo, useState } from "react";

interface FavoriteEntry {
  animeId: string;
  title: string;
  format?: "SERIES" | "MOVIE";
  state: { favorite: boolean; recommended: boolean };
}

interface Media {
  title: { romaji?: string | null; english?: string | null };
  startDate?: { year?: number | null; month?: number | null; day?: number | null } | null;
  format?: string | null;
  coverImage?: { extraLarge?: string | null; large?: string | null };
}

interface Props {
  entries: FavoriteEntry[];
  recommendations: FavoriteEntry[];
}

type Filter = "ALL" | "SERIES" | "MOVIES";
type Sort = "ADDED" | "TITLE" | "YEAR";

const ANILIST_BATCH_SIZE = 20;

function titleOf(entry: FavoriteEntry, media?: Media | null) {
  return media?.title.romaji || media?.title.english || entry.title;
}

function isMovie(entry: FavoriteEntry, media?: Media | null) {
  return (media?.format || entry.format) === "MOVIE";
}

export default function FavoritesView({ entries, recommendations }: Props) {
  const [media, setMedia] = useState<Record<string, Media | null>>({});
  const [loading, setLoading] = useState(true);
  const [visibleFavorites, setVisibleFavorites] = useState(15);
  const [visibleRecommendations, setVisibleRecommendations] = useState(15);
  const [favoriteFilter, setFavoriteFilter] = useState<Filter>("ALL");
  const [favoriteSort, setFavoriteSort] = useState<Sort>("ADDED");
  const [favoriteQuery, setFavoriteQuery] = useState("");
  const [recommendationFilter, setRecommendationFilter] = useState<Filter>("ALL");
  const [recommendationSort, setRecommendationSort] = useState<Sort>("ADDED");
  const [recommendationQuery, setRecommendationQuery] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadBatch(batch: FavoriteEntry[]) {
      const variables: Record<string, string> = {};
      const fields = batch.map((entry, index) => {
        const key = "a" + index;
        const variable = "s" + index;
        variables[variable] = entry.title;

        return key + ": Page(page: 1, perPage: 1) { media(search: $" + variable + ", type: ANIME, sort: SEARCH_MATCH) { title { romaji english } startDate { year month day } format coverImage { extraLarge large } } }";
      }).join("\n");

      const definitions = batch.map((_, index) => "$s" + index + ": String!").join(", ");
      const query = "query Favorites(" + definitions + ") { " + fields + " }";

      const response = await fetch("https://graphql.anilist.co", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ query, variables }),
      });

      if (!response.ok) throw new Error("AniList request failed with " + response.status);

      const payload = await response.json();
      const result: Record<string, Media | null> = {};

      batch.forEach((entry, index) => {
        result[entry.animeId] = payload.data?.["a" + index]?.media?.[0] ?? null;
      });

      if (!cancelled) setMedia((current) => ({ ...current, ...result }));
    }

    async function load() {
      const allEntries = [...entries, ...recommendations];
      if (!allEntries.length) {
        setLoading(false);
        return;
      }

      try {
        for (let offset = 0; offset < allEntries.length; offset += ANILIST_BATCH_SIZE) {
          if (cancelled) break;
          await loadBatch(allEntries.slice(offset, offset + ANILIST_BATCH_SIZE));
        }
      } catch {
        // The editorial title remains visible if AniList metadata is unavailable.
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [entries, recommendations]);

  const filterEntries = (source: FavoriteEntry[], filter: Filter, sort: Sort, query: string) => {
    const normalized = query.trim().toLocaleLowerCase("es");

    return source
      .filter((entry) => {
        const item = media[entry.animeId];
        if (filter === "MOVIES" && !isMovie(entry, item)) return false;
        if (filter === "SERIES" && isMovie(entry, item)) return false;
        if (normalized && !titleOf(entry, item).toLocaleLowerCase("es").includes(normalized)) return false;
        return true;
      })
      .sort((a, b) => {
        const aMedia = media[a.animeId];
        const bMedia = media[b.animeId];
        if (sort === "TITLE") return titleOf(a, aMedia).localeCompare(titleOf(b, bMedia), "es");
        if (sort === "YEAR") return (bMedia?.startDate?.year ?? 0) - (aMedia?.startDate?.year ?? 0);
        return source.indexOf(a) - source.indexOf(b);
      });
  };

  const filteredFavorites = useMemo(
    () => filterEntries(entries, favoriteFilter, favoriteSort, favoriteQuery),
    [entries, media, favoriteFilter, favoriteSort, favoriteQuery],
  );

  const filteredRecommendations = useMemo(
    () => filterEntries(recommendations, recommendationFilter, recommendationSort, recommendationQuery),
    [recommendations, media, recommendationFilter, recommendationSort, recommendationQuery],
  );

  useEffect(() => { setVisibleFavorites(15); }, [favoriteFilter, favoriteSort, favoriteQuery]);
  useEffect(() => { setVisibleRecommendations(15); }, [recommendationFilter, recommendationSort, recommendationQuery]);

  const renderToolbar = (
    prefix: string,
    filter: Filter,
    setFilter: (value: Filter) => void,
    sort: Sort,
    setSort: (value: Sort) => void,
    query: string,
    setQuery: (value: string) => void,
    total: number,
    visibleTotal: number,
  ) => (
    <>
      <div className="archive-toolbar">
        <div className="archive-filters" role="tablist" aria-label="Filtrar archivo">
          {(["ALL", "SERIES", "MOVIES"] as Filter[]).map((value) => (
            <button key={value} type="button" className={filter === value ? "is-active" : ""} aria-selected={filter === value} role="tab" onClick={() => setFilter(value)}>
              {value === "ALL" ? "Todos" : value === "SERIES" ? "Series" : "Películas"}
            </button>
          ))}
        </div>
        <div className="archive-tools">
          <label className="sr-only" htmlFor={prefix + "-search"}>Buscar en este archivo</label>
          <input id={prefix + "-search"} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar…" type="search" />
          <label className="sr-only" htmlFor={prefix + "-sort"}>Ordenar archivo</label>
          <select id={prefix + "-sort"} value={sort} onChange={(event) => setSort(event.target.value as Sort)}>
            <option value="ADDED">Añadidos</option>
            <option value="TITLE">Título A–Z</option>
            <option value="YEAR">Más recientes</option>
          </select>
        </div>
      </div>
      <div className="archive-count" aria-live="polite">
        {visibleTotal} {visibleTotal === 1 ? "anime" : "animes"}
        {(query || filter !== "ALL") ? ` · ${total} en total` : ""}
      </div>
    </>
  );

  const renderCard = (entry: FavoriteEntry, index: number) => {
    const item = media[entry.animeId];
    const title = titleOf(entry, item);
    const year = item?.startDate?.year;

    return (
      <article className="favorite-card" key={entry.animeId}>
        <a href={"/anime/" + entry.animeId} aria-label={"Ver " + title}>
          <div className="favorite-media">
            {item?.coverImage?.extraLarge || item?.coverImage?.large ? (
              <img src={item.coverImage.extraLarge || item.coverImage.large || ""} alt={title} loading={index < 3 ? "eager" : "lazy"} />
            ) : (
              <div className="favorite-placeholder">
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{entry.title}</strong>
              </div>
            )}
            <div className="archive-card-badges" aria-hidden="true">
              {entry.state.favorite && <span>Favorito</span>}
              {entry.state.recommended && <span>Recomendado</span>}
            </div>
          </div>
          <div className="favorite-caption">
            <h3>{title}</h3>
            {year && <span>{year}</span>}
          </div>
        </a>
      </article>
    );
  };

  return (
    <div className="favorites-view">
      <section className="favorites-section" aria-labelledby="absolute-favorites-title">
        <div className="favorites-intro">
          <div>
            <span className="favorites-note">Favoritos absolutos</span>
            <h2 id="absolute-favorites-title">Los que siempre vuelven.</h2>
          </div>
        </div>

        {renderToolbar("favorites", favoriteFilter, setFavoriteFilter, favoriteSort, setFavoriteSort, favoriteQuery, setFavoriteQuery, entries.length, filteredFavorites.length)}

        <div className="favorites-track">
          {filteredFavorites.slice(0, visibleFavorites).map(renderCard)}
        </div>

        {!filteredFavorites.length && (
          <div className="archive-empty"><strong>No hay resultados en este filtro.</strong><span>Prueba otra búsqueda o cambia el filtro.</span></div>
        )}

        {visibleFavorites < filteredFavorites.length && (
          <button type="button" className="favorites-load-more" onClick={() => setVisibleFavorites((count) => count + 15)}>
            Cargar más <span>{Math.min(visibleFavorites + 15, filteredFavorites.length)} / {filteredFavorites.length}</span>
          </button>
        )}
      </section>

      <section className="favorites-section favorites-section--recommendations" aria-labelledby="recommended-title">
        <div className="favorites-intro">
          <div>
            <span className="favorites-note">Mi selección para ti</span>
            <h2 id="recommended-title">Recomendados.</h2>
          </div>
        </div>

        <p className="favorites-recommendation-copy">
          Historias que forman parte de mi recorrido y que quiero que descubras.
        </p>

        {renderToolbar("recommendations", recommendationFilter, setRecommendationFilter, recommendationSort, setRecommendationSort, recommendationQuery, recommendations.length, filteredRecommendations.length)}

        <div className="favorites-track favorites-track--recommendations">
          {filteredRecommendations.slice(0, visibleRecommendations).map(renderCard)}
        </div>

        {!filteredRecommendations.length && (
          <div className="archive-empty"><strong>No hay resultados en este filtro.</strong><span>Prueba otra búsqueda o cambia el filtro.</span></div>
        )}

        {visibleRecommendations < filteredRecommendations.length && (
          <button type="button" className="favorites-load-more" onClick={() => setVisibleRecommendations((count) => count + 15)}>
            Cargar más <span>{Math.min(visibleRecommendations + 15, filteredRecommendations.length)} / {filteredRecommendations.length}</span>
          </button>
        )}
      </section>

      {loading && <span className="favorites-loading">Cargando archivo…</span>}

      <style>{`
        .archive-toolbar{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:1.5rem;margin-top:1.5rem;padding-bottom:1.25rem;border-bottom:1px solid var(--line)}
        .archive-filters{display:flex;gap:1.15rem;overflow-x:auto;scrollbar-width:none}.archive-filters::-webkit-scrollbar{display:none}
        .archive-filters button{position:relative;flex:0 0 auto;padding:.65rem 0 .7rem;border:0;background:transparent;color:var(--muted);font:500 .65rem/1 var(--font-meta);letter-spacing:.1em;text-transform:uppercase;cursor:pointer}
        .archive-filters button::after{position:absolute;right:0;bottom:0;left:0;height:1px;background:currentColor;content:"";transform:scaleX(0);transition:transform 180ms ease}.archive-filters button:hover,.archive-filters button.is-active{color:inherit}.archive-filters button.is-active::after{transform:scaleX(1)}
        .archive-tools{display:flex;justify-content:flex-end;gap:.5rem}.archive-tools input,.archive-tools select{min-height:2.5rem;border:1px solid var(--line);border-radius:4px;background:transparent;color:inherit;padding:.65rem .8rem;font:400 .8rem/1 var(--font-body);outline:none}.archive-tools input{width:min(16rem,100%)}.archive-tools input:focus,.archive-tools select:focus{border-color:currentColor}
        .archive-count{margin:1rem 0 2rem;color:var(--muted);font:500 .62rem/1 var(--font-meta);letter-spacing:.08em;text-transform:uppercase}
        .archive-card-badges{position:absolute;right:.55rem;top:.55rem;z-index:2;display:flex;flex-wrap:wrap;gap:.3rem;pointer-events:none}.archive-card-badges span{padding:.28rem .36rem;border:1px solid rgba(255,255,255,.2);background:rgba(0,0,0,.5);color:#fff;font:500 .43rem/1 var(--font-meta);letter-spacing:.05em;text-transform:uppercase}
        .archive-empty{display:grid;justify-items:center;gap:.5rem;padding:4rem 1rem;border:1px solid var(--line);text-align:center}.archive-empty strong{color:inherit}.archive-empty span{color:var(--muted)}
        .sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
        @media(max-width:800px){.archive-toolbar{grid-template-columns:1fr;align-items:stretch}.archive-tools{justify-content:stretch}.archive-tools input{flex:1;width:auto}}
        @media(max-width:560px){.archive-tools{display:grid;grid-template-columns:minmax(0,1fr) auto}.archive-tools select{max-width:8rem}.archive-filters{gap:.8rem}}
      `}</style>
    </div>
  );
}
