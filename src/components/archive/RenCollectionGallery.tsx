import { useEffect, useMemo, useState } from "react";
import { fetchFallbackPoster, selectBestAnimeCandidate } from "../../lib/api/poster-fallback";

interface Entry {
  animeId: string;
  title: string;
  format?: "SERIES" | "MOVIE";
  state?: { favorite?: boolean; recommended?: boolean; personalScore?: number };
}

interface Media {
  title?: { romaji?: string | null; english?: string | null };
  startDate?: { year?: number | null; month?: number | null; day?: number | null } | null;
  format?: string | null;
  coverImage?: { extraLarge?: string | null; large?: string | null };
}

interface Props {
  entries: Entry[];
}

type Filter = "ALL" | "SERIES" | "MOVIES";
type Sort = "ADDED" | "TITLE" | "YEAR" | "SCORE";

const PAGE_SIZE = 15;
const CACHE_PREFIX = "renanime:collection:v7:";

async function fetchMedia(entries: Entry[]): Promise<Record<string, Media | null>> {
  const result: Record<string, Media | null> = {};
  const unresolved: Entry[] = [];

  for (const entry of entries) {
    const key = CACHE_PREFIX + entry.title.toLowerCase();
    try {
      const cached = sessionStorage.getItem(key);
      if (cached) {
        const media = JSON.parse(cached) as Media | null;
        if (media?.coverImage?.extraLarge || media?.coverImage?.large) {
          result[entry.animeId] = media;
          continue;
        }
        sessionStorage.removeItem(key);
      }
    } catch {}
    unresolved.push(entry);
  }

  for (let offset = 0; offset < unresolved.length; offset += 15) {
    const chunk = unresolved.slice(offset, offset + 15);
    const variables: Record<string, string> = {};
    const fields = chunk.map((entry, index) => {
      const key = "s" + index;
      const alias = "a" + index;
      variables[key] = entry.title;
      const formatFilter = entry.format === "MOVIE" ? ", format: MOVIE" : "";
      return `${alias}: Page(page: 1, perPage: 10) { media(search: $${key}, type: ANIME${formatFilter}, sort: SEARCH_MATCH) { title { romaji english native } synonyms startDate { year month day } format coverImage { extraLarge large } } }`;
    }).join("\n");
    const definitions = chunk.map((_, index) => `$s${index}: String!`).join(", ");

    try {
      const response = await fetch("https://graphql.anilist.co", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ query: `query HomeGallery(${definitions}) { ${fields} }`, variables }),
      });
      if (!response.ok) continue;
      const payload = await response.json();

      chunk.forEach((entry, index) => {
        const candidates = payload.data?.["a" + index]?.media ?? [];
        result[entry.animeId] = selectBestAnimeCandidate(candidates, entry.title, entry.format);
      });
      for (const entry of chunk) {
        const current = result[entry.animeId];
        if (!current?.coverImage?.extraLarge && !current?.coverImage?.large) {
          const poster = await fetchFallbackPoster(entry.title, entry.format);
          if (poster) result[entry.animeId] = { ...(current ?? {}), coverImage: { extraLarge: poster, large: poster } };
        }
        try {
          sessionStorage.setItem(CACHE_PREFIX + entry.title.toLowerCase(), JSON.stringify(result[entry.animeId] ?? null));
        } catch {}
      }
    } catch {}
  }

  return result;
}

function titleOf(entry: Entry, media?: Media | null) {
  return media?.title?.romaji || media?.title?.english || entry.title;
}

function isMovie(entry: Entry, media?: Media | null) {
  return (media?.format || entry.format) === "MOVIE";
}

export default function HomeGallery({ entries }: Props) {
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [media, setMedia] = useState<Record<string, Media | null>>({});
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [sort, setSort] = useState<Sort>("ADDED");
  const [query, setQuery] = useState("");

  useEffect(() => {
    const needsCompleteMetadata = sort === "YEAR" || sort === "TITLE" || sort === "SCORE" || filter !== "ALL" || Boolean(query.trim());
    const targetEntries = needsCompleteMetadata ? entries : entries.slice(0, visible);
    const missing = targetEntries.filter((entry) => !(entry.animeId in media));

    if (!missing.length) {
      if (needsCompleteMetadata) setMetadataReady(true);
      return;
    }

    let cancelled = false;
    setLoading(true);
    fetchMedia(missing).then((result) => {
      if (!cancelled) {
        setMedia((current) => ({ ...current, ...result }));
        if (needsCompleteMetadata) setMetadataReady(true);
      }
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [entries, visible, sort, filter, query]);

  const filteredEntries = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("es");

    return entries
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
        if (sort === "SCORE") return (b.state?.personalScore ?? -1) - (a.state?.personalScore ?? -1);
        return entries.indexOf(a) - entries.indexOf(b);
      });
  }, [entries, media, filter, sort, query]);

  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [filter, sort, query]);

  const page = filteredEntries.slice(0, visible);
  const hasMore = visible < filteredEntries.length;

  return (
    <div className="home-gallery">
      <div className="archive-toolbar">
        <div className="archive-filters" role="tablist" aria-label="Filtrar archivo">
          {(["ALL", "SERIES", "MOVIES"] as Filter[]).map((value) => (
            <button key={value} type="button" className={filter === value ? "is-active" : ""} aria-selected={filter === value} role="tab" onClick={() => setFilter(value)}>
              {value === "ALL" ? "Todos" : value === "SERIES" ? "Series" : "Películas"}
            </button>
          ))}
        </div>
        <div className="archive-tools">
          <label className="sr-only" htmlFor="archive-search">Buscar en este archivo</label>
          <input id="archive-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar…" type="search" />
          <label className="sr-only" htmlFor="archive-sort">Ordenar archivo</label>
          <select id="archive-sort" value={sort} onChange={(event) => setSort(event.target.value as Sort)}>
            <option value="ADDED">Añadidos</option>
            <option value="TITLE">Título A–Z</option>
            <option value="YEAR">Más recientes</option>
            <option value="SCORE">Mi puntuación</option>
          </select>
        </div>
      </div>

      <div className="home-gallery-grid">
        {page.map((entry, index) => {
          const item = media[entry.animeId];
          const image = item?.coverImage?.extraLarge ?? item?.coverImage?.large;
          return (
            <a
              className="home-gallery-card"
              href={`/anime/${entry.animeId}`}
              aria-label={`Ver ${titleOf(entry, item)}`}
              key={entry.animeId}
            >
              {image ? <img src={image} alt="" loading={index < 3 ? "eager" : "lazy"} /> : <div className="home-gallery-placeholder" aria-hidden="true" />}
              <div className="archive-card-badges" aria-hidden="true">
                {entry.state?.favorite && <span>Favorito</span>}
                {entry.state?.recommended && <span>Recomendado</span>}
              </div>
              <div className="archive-card-caption">
                <strong>{titleOf(entry, item)}</strong>
                {item?.startDate?.year && <span>{item.startDate.year}</span>}
              </div>
            </a>
          );
        })}
      </div>

      {!page.length && !loading && (
        <div className="archive-empty">
          <strong>No hay resultados en este filtro.</strong>
          <span>Prueba otra búsqueda o cambia el filtro.</span>
        </div>
      )}

      {loading && <div className="home-gallery-loading" aria-hidden="true" />}
      {hasMore && (
        <button type="button" className="home-gallery-load-more" onClick={() => setVisible((current) => Math.min(current + PAGE_SIZE, filteredEntries.length))} disabled={loading}>
          {loading ? "Cargando…" : `Cargar más · ${filteredEntries.length - visible} restantes`}
        </button>
      )}

      <style>{`
        .archive-toolbar{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:1.5rem;margin-bottom:1rem;padding-bottom:1.25rem;border-bottom:1px solid var(--color-border)}
        .archive-filters{display:flex;gap:1.15rem;overflow-x:auto;scrollbar-width:none}.archive-filters::-webkit-scrollbar{display:none}
        .archive-filters button{position:relative;flex:0 0 auto;padding:.65rem 0 .7rem;border:0;background:transparent;color:var(--color-muted-400);font:500 .65rem/1 var(--font-meta);letter-spacing:.1em;text-transform:uppercase;cursor:pointer}
        .archive-filters button::after{position:absolute;right:0;bottom:0;left:0;height:1px;background:var(--color-paper-50);content:"";transform:scaleX(0);transition:transform var(--duration-fast) var(--ease-out)}.archive-filters button:hover,.archive-filters button.is-active{color:var(--color-paper-50)}.archive-filters button.is-active::after{transform:scaleX(1)}
        .archive-tools{display:flex;justify-content:flex-end;gap:.5rem}.archive-tools input,.archive-tools select{min-height:2.5rem;border:1px solid var(--color-border);border-radius:var(--radius-sm);background:var(--color-ink-900);color:var(--color-paper-50);padding:.65rem .8rem;font:400 .8rem/1 var(--font-body);outline:none}.archive-tools input{width:min(16rem,100%)}.archive-tools input:focus,.archive-tools select:focus{border-color:var(--color-border-strong)}
        .archive-count{margin:1rem 0 2rem;color:var(--color-muted-400);font:500 .62rem/1 var(--font-meta);letter-spacing:.08em;text-transform:uppercase}
        .archive-card-caption{position:absolute;right:0;bottom:0;left:0;z-index:2;display:grid;gap:.2rem;padding:2.8rem .7rem .7rem;background:linear-gradient(180deg,transparent,rgba(0,0,0,.82));pointer-events:none}.archive-card-caption strong{color:#fff;font:500 .72rem/1.15 var(--font-body)}.archive-card-caption span{color:rgba(255,255,255,.65);font:500 .46rem/1 var(--font-meta);letter-spacing:.06em}
        .archive-card-badges{position:absolute;right:.55rem;top:.55rem;z-index:2;display:flex;flex-wrap:wrap;gap:.3rem;pointer-events:none}.archive-card-badges span{padding:.28rem .36rem;border:1px solid rgba(255,255,255,.2);background:rgba(0,0,0,.5);color:#fff;font:500 .43rem/1 var(--font-meta);letter-spacing:.05em;text-transform:uppercase}
        .archive-empty{display:grid;justify-items:center;gap:.5rem;padding:4rem 1rem;border:1px solid var(--color-border);text-align:center}.archive-empty strong{color:var(--color-paper-50)}.archive-empty span{color:var(--color-muted-400)}
        .sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
        @media(max-width:800px){.archive-toolbar{grid-template-columns:1fr;align-items:stretch}.archive-tools{justify-content:stretch}.archive-tools input{flex:1;width:auto}}
        @media(max-width:560px){.archive-tools{display:grid;grid-template-columns:minmax(0,1fr) auto}.archive-tools select{max-width:8rem}.archive-card-caption{padding:2.3rem .45rem .5rem}.archive-card-caption strong{font-size:.62rem}.archive-card-badges{right:.35rem;top:.35rem}.archive-card-badges span{padding:.23rem .28rem;font-size:.38rem}}
      `}</style>
    </div>
  );
}
