import { useEffect, useMemo, useState } from "react";
import { useT, type Lang } from "../../i18n";

interface AnimeItem {
  id: number;
  title: { romaji?: string | null; english?: string | null };
  coverImage?: { large?: string | null; extraLarge?: string | null };
  format?: string | null;
  seasonYear?: number | null;
  averageScore?: number | null;
  popularity?: number | null;
  episodes?: number | null;
}

interface GenreRow {
  name: string;
  anime: AnimeItem[];
}

interface Props { lang?: Lang; }

const GENRES = [
  "Action", "Adventure", "Comedy", "Drama", "Fantasy", "Horror",
  "Mystery", "Romance", "Sci-Fi", "Slice of Life", "Sports",
  "Supernatural", "Thriller", "Psychological", "Mecha", "Music",
  "Mahou Shoujo", "Ecchi",
] as const;

const CACHE_KEY = "renanime:popular-genres:v1";
const QUERY_FIELDS = "id title { romaji english } coverImage { large extraLarge } format seasonYear averageScore popularity episodes";

function genreQuery() {
  const aliases = GENRES.map((genre, index) =>
    `g${index}: Page(page: 1, perPage: 12) { media(type: ANIME, genre: ${JSON.stringify(genre)}, sort: POPULARITY_DESC, isAdult: false) { ${QUERY_FIELDS} } }`
  ).join("\n");
  return "query PopularAnimeByGenre { " + aliases + " }";
}

function titleFor(anime: AnimeItem, lang: Lang) {
  return lang === "en"
    ? anime.title.english || anime.title.romaji || "Untitled"
    : anime.title.romaji || anime.title.english || "Sin título";
}

export default function GenresView({ lang = "es" }: Props) {
  const t = useT(lang);
  const [rows, setRows] = useState<GenreRow[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const cached = sessionStorage.getItem(CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached) as { savedAt: number; rows: GenreRow[] };
          if (Date.now() - parsed.savedAt < 12 * 60 * 60 * 1000 && Array.isArray(parsed.rows)) {
            if (!cancelled) { setRows(parsed.rows); setLoading(false); }
            return;
          }
        }
      } catch {}

      try {
        const response = await fetch("https://graphql.anilist.co", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ query: genreQuery() }),
        });
        if (!response.ok) throw new Error("genre_query_failed");
        const payload = await response.json();
        const result = GENRES.map((name, index) => ({
          name,
          anime: (payload.data?.["g" + index]?.media ?? []) as AnimeItem[],
        })).filter(row => row.anime.length > 0);
        if (!cancelled) {
          setRows(result);
          setError(false);
          try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), rows: result })); } catch {}
        }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const sync = () => {
      const name = new URLSearchParams(window.location.search).get("genre");
      setSelected(name && rows.some(row => row.name.toLowerCase() === name.toLowerCase())
        ? rows.find(row => row.name.toLowerCase() === name.toLowerCase())!.name
        : null);
    };
    if (rows.length) sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, [rows]);

  const selectedRow = useMemo(() => rows.find(row => row.name === selected) ?? null, [rows, selected]);

  const openGenre = (name: string) => {
    setSelected(name);
    const url = new URL(window.location.href);
    url.searchParams.set("genre", name);
    window.history.pushState({ genre: name }, "", url.pathname + url.search);
  };

  const closeGenre = () => {
    setSelected(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("genre");
    window.history.pushState({}, "", url.pathname + url.search);
  };

  const description = (name: string) => {
    const es: Record<string, string> = {
      Action: "Combates, ritmo y desafíos al límite.",
      Adventure: "Viajes, descubrimientos y mundos por explorar.",
      Comedy: "Humor, situaciones inesperadas y personajes memorables.",
      Drama: "Historias emocionales y decisiones que dejan huella.",
      Fantasy: "Magia, mundos extraordinarios y nuevas reglas.",
      Horror: "Misterio, tensión y encuentros inquietantes.",
      Mystery: "Secretos, pistas y enigmas por resolver.",
      Romance: "Relaciones, vínculos y sentimientos.",
      "Sci-Fi": "Tecnología, futuros posibles y ciencia ficción.",
      "Slice of Life": "Historias cotidianas y momentos cercanos.",
      Sports: "Competición, entrenamiento y superación.",
      Supernatural: "Fenómenos inexplicables y fuerzas ocultas.",
      Thriller: "Suspense, tensión y giros inesperados.",
      Psychological: "Conflictos mentales y juegos psicológicos.",
      Mecha: "Robots, pilotos y conflictos de gran escala.",
      Music: "Música, escenarios y pasión artística.",
      "Mahou Shoujo": "Magia, transformaciones y heroínas.",
      Ecchi: "Comedia y contenido sugerente.",
    };
    const en: Record<string, string> = {
      Action: "Fights, fast pacing, and high-stakes challenges.",
      Adventure: "Journeys, discoveries, and worlds to explore.",
      Comedy: "Humour, unexpected situations, and memorable characters.",
      Drama: "Emotional stories and decisions that leave a mark.",
      Fantasy: "Magic, extraordinary worlds, and different rules.",
      Horror: "Mystery, tension, and unsettling encounters.",
      Mystery: "Secrets, clues, and puzzles to solve.",
      Romance: "Relationships, connections, and feelings.",
      "Sci-Fi": "Technology, possible futures, and science fiction.",
      "Slice of Life": "Everyday stories and intimate moments.",
      Sports: "Competition, training, and self-improvement.",
      Supernatural: "Unexplained phenomena and hidden forces.",
      Thriller: "Suspense, tension, and unexpected twists.",
      Psychological: "Mental conflict and psychological games.",
      Mecha: "Robots, pilots, and large-scale conflicts.",
      Music: "Music, stages, and artistic passion.",
      "Mahou Shoujo": "Magic, transformations, and heroines.",
      Ecchi: "Comedy and suggestive themes.",
    };
    return (lang === "en" ? en : es)[name] ?? "";
  };

  return (
    <div className="genres-view">
      {loading ? (
        <p className="genres-status">{t("genres.loadingMap")}</p>
      ) : error ? (
        <p className="genres-status" role="alert">{t("genres.error")}</p>
      ) : selectedRow ? (
        <section className="genre-detail">
          <button className="genre-back" type="button" onClick={closeGenre}>← {lang === "en" ? "All genres" : "Todos los géneros"}</button>
          <header className="genre-detail-heading">
            <p>{lang === "en" ? "MOST POPULAR" : "MÁS POPULARES"}</p>
            <h2>{selectedRow.name}</h2>
            <span>{description(selectedRow.name)}</span>
          </header>
          <div className="genre-grid">
            {selectedRow.anime.map((anime, index) => (
              <a className="genre-card" href={`${lang === "en" ? "/en" : ""}/anime/${anime.id}`} key={anime.id}>
                <div className="genre-card-poster">
                  {anime.coverImage?.extraLarge || anime.coverImage?.large
                    ? <img src={anime.coverImage.extraLarge || anime.coverImage.large || ""} alt="" loading={index < 6 ? "eager" : "lazy"} />
                    : <span>{titleFor(anime, lang)}</span>}
                </div>
                <div className="genre-card-info">
                  <strong>{titleFor(anime, lang)}</strong>
                  <span>{anime.seasonYear ?? "—"} · {anime.averageScore ? `${anime.averageScore}%` : (lang === "en" ? "Unrated" : "Sin nota")}</span>
                </div>
              </a>
            ))}
          </div>
        </section>
      ) : (
        <div className="genres-rows">
          {rows.map((row, rowIndex) => (
            <section className="genre-row" key={row.name}>
              <header className="genre-row-heading">
                <div>
                  <h2>{row.name}</h2>
                  <p>{description(row.name)}</p>
                </div>
                <button type="button" onClick={() => openGenre(row.name)}>{lang === "en" ? "View all" : "Ver todos"} <span>→</span></button>
              </header>
              <div className="genre-row-track">
                {row.anime.slice(0, 8).map((anime, index) => (
                  <a className="genre-poster" href={`${lang === "en" ? "/en" : ""}/anime/${anime.id}`} key={anime.id}>
                    <div className="genre-poster-art">
                      {anime.coverImage?.extraLarge || anime.coverImage?.large
                        ? <img src={anime.coverImage.extraLarge || anime.coverImage.large || ""} alt="" loading={rowIndex === 0 && index < 4 ? "eager" : "lazy"} />
                        : <span>{titleFor(anime, lang)}</span>}
                    </div>
                    <strong>{titleFor(anime, lang)}</strong>
                  </a>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <style>{`
        .genres-view{width:100%}
        .genres-status{color:var(--color-muted-300);font-size:.9rem;padding:2rem 0}
        .genres-rows{display:grid;gap:clamp(2.2rem,5vw,4rem)}
        .genre-row{min-width:0;padding-top:1.35rem;border-top:1px solid var(--color-border)}
        .genre-row-heading{display:flex;justify-content:space-between;align-items:center;gap:1rem;margin-bottom:1.15rem}
        .genre-row-heading h2{margin:0;color:var(--color-paper-50);font-family:var(--font-heading);font-size:clamp(1.8rem,3.5vw,2.5rem);font-weight:400;letter-spacing:-.045em;line-height:1}
        .genre-row-heading p{margin:.45rem 0 0;color:var(--color-muted-400);font-size:.82rem;line-height:1.4}
        .genre-row-heading button,.genre-back{border:0;background:transparent;color:var(--color-muted-300);font:500 .78rem var(--font-body);white-space:nowrap;cursor:pointer}
        .genre-row-heading button:hover,.genre-back:hover{color:var(--color-paper-50)}
        .genre-row-heading button span{color:#ec4899;margin-left:.25rem}
        .genre-row-track{display:flex;gap:.8rem;overflow-x:auto;overscroll-behavior-inline:contain;scroll-snap-type:x mandatory;scrollbar-width:thin;scrollbar-color:var(--color-border-strong) transparent;padding:.1rem .1rem .8rem}
        .genre-poster{display:grid;flex:0 0 clamp(112px,14vw,165px);gap:.55rem;align-content:start;color:var(--color-paper-50);text-decoration:none;scroll-snap-align:start}
        .genre-poster-art,.genre-card-poster{display:grid;place-items:center;aspect-ratio:2/3;overflow:hidden;background:#111;border-radius:7px}
        .genre-poster-art img,.genre-card-poster img{width:100%;height:100%;object-fit:cover;transition:transform .35s ease}
        .genre-poster:hover img{transform:scale(1.04)}
        .genre-poster>strong{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-size:.75rem;font-weight:500;line-height:1.35}
        .genre-poster-art span,.genre-card-poster span{padding:.6rem;color:#aaa;font-size:.75rem}
        .genre-detail{width:100%}
        .genre-back{margin-bottom:1.5rem;padding:0}
        .genre-detail-heading{margin-bottom:2rem}
        .genre-detail-heading>p{margin:0 0 .55rem;color:#ec4899;font-size:.65rem;letter-spacing:.16em}
        .genre-detail-heading h2{margin:0;font-family:var(--font-heading);font-size:clamp(2.5rem,6vw,4.5rem);font-weight:400;letter-spacing:-.05em}
        .genre-detail-heading span{display:block;margin-top:.5rem;color:var(--color-muted-400);font-size:.9rem}
        .genre-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1.4rem 1rem}
        .genre-card{min-width:0;color:var(--color-paper-50);text-decoration:none}
        .genre-card-poster{width:100%;border:1px solid rgba(245,242,236,.1)}
        .genre-card-info{display:grid;gap:.35rem;padding-top:.6rem}
        .genre-card-info strong{font-size:.82rem;font-weight:550;line-height:1.35}
        .genre-card-info span{color:var(--color-muted-400);font-size:.7rem}
        @media(max-width:760px){.genre-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:1.2rem .75rem}.genre-poster{flex-basis:118px}.genre-row-heading p{max-width:15rem;font-size:.75rem}}
      `}</style>
    </div>
  );
}
