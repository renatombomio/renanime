import { useEffect, useMemo, useState } from "react";
import type { LibraryEntry } from "../../types/personal";
import { buildGenreCatalog } from "../../lib/anime/genre-catalog";

interface Props {
  entries: LibraryEntry[];
}

interface GenreMedia {
  genres?: string[];
  coverImage?: { large?: string; extraLarge?: string };
  title?: { romaji?: string; english?: string };
  format?: string;
  seasonYear?: number;
}

const BATCH_SIZE = 25;

function getCacheKey(entry: LibraryEntry) {
  return "renanime:collection:" + entry.title.toLowerCase();
}

async function fetchMediaMetadata(entries: LibraryEntry[], includeImages = false): Promise<Record<string, GenreMedia>> {
  const result: Record<string, GenreMedia> = {};
  const unresolved: LibraryEntry[] = [];

  for (const entry of entries) {
    try {
      const cached = sessionStorage.getItem(getCacheKey(entry));
      if (cached) {
        const media = JSON.parse(cached) as GenreMedia;
        if (Array.isArray(media.genres) && (!includeImages || media.coverImage?.large || media.coverImage?.extraLarge)) {
          result[entry.animeId] = media;
          continue;
        }
      }
    } catch {}
    unresolved.push(entry);
  }

  for (let start = 0; start < unresolved.length; start += BATCH_SIZE) {
    const batch = unresolved.slice(start, start + BATCH_SIZE);
    const variables: Record<string, string> = {};

    const fields = batch.map((entry, index) => {
      const key = "s" + index;
      const alias = "a" + index;
      variables[key] = entry.title;
      return alias + ': Page(page: 1, perPage: 1) { media(search: $' + key + ', type: ANIME, sort: SEARCH_MATCH) { genres coverImage { large extraLarge } title { romaji english } format seasonYear } }';
    }).join("\n");

    const definitions = batch.map((_, index) => "$s" + index + ": String!").join(", ");

    try {
      const response = await fetch("https://graphql.anilist.co", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          query: "query GenreMediaBatch(" + definitions + ") { " + fields + " }",
          variables,
        }),
      });

      if (!response.ok) continue;
      const payload = await response.json();

      batch.forEach((entry, index) => {
        const media = payload.data?.["a" + index]?.media?.[0] as GenreMedia | undefined;
        result[entry.animeId] = media ?? { genres: [] };
        if (media) {
          try { sessionStorage.setItem(getCacheKey(entry), JSON.stringify(media)); } catch {}
        }
      });
    } catch {}
  }

  return result;
}

export default function GenresView({ entries }: Props) {
  const [metadata, setMetadata] = useState<Record<string, GenreMedia>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [resultsLoading, setResultsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const media = await fetchMediaMetadata(entries);
      if (!cancelled) {
        setMetadata(media);
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [entries]);

  const genresByAnimeId = useMemo(
    () => Object.fromEntries(Object.entries(metadata).map(([animeId, media]) => [animeId, media.genres ?? []])),
    [metadata],
  );

  const catalog = useMemo(() => buildGenreCatalog(entries, genresByAnimeId), [entries, genresByAnimeId]);
  const selectedGenre = catalog.find((genre) => genre.name === selected);

  const selectedEntryIds = selectedGenre?.entries.map((entry) => entry.animeId).join("|") ?? "";

  useEffect(() => {
    if (!selected || !selectedEntryIds) return;
    const genre = catalog.find((item) => item.name === selected);
    if (!genre) return;

    let cancelled = false;

    async function loadImages() {
      setResultsLoading(true);
      const media = await fetchMediaMetadata(genre.entries, true);
      if (!cancelled) {
        setMetadata((current) => ({ ...current, ...media }));
        setResultsLoading(false);
      }
    }

    loadImages();
    return () => { cancelled = true; };
  }, [selected, selectedEntryIds]);

  useEffect(() => {
    if (selected && !selectedGenre) setSelected(null);
  }, [selected, selectedGenre]);

  return (
    <div className="genres-view">
      {!selectedGenre ? (
        <>
          <div className="genres-meta">
            <span>{loading ? "Construyendo mapa…" : catalog.length + " géneros en tu colección"}</span>
            <span>{entries.length} títulos</span>
          </div>

          <div className="genres-grid">
            {catalog.map((genre) => (
              <button
                type="button"
                className="genre-card"
                key={genre.name}
                onClick={() => setSelected(genre.name)}
              >
                <span className="genre-name">{genre.name}</span>
                <span className="genre-count">{genre.entries.length} títulos</span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <section className="genre-results" aria-label={"Animes de género " + selectedGenre.name}>
          <div className="genre-results-head">
            <button type="button" className="genre-back" onClick={() => setSelected(null)}>
              ← Géneros
            </button>
            <div>
              <span className="genre-results-kicker">Mi colección</span>
              <span className="genre-results-title">{selectedGenre.name}</span>
            </div>
            <span>{selectedGenre.entries.length} títulos</span>
          </div>

          {resultsLoading ? (
            <div className="genre-results-loading">Cargando títulos…</div>
          ) : (
            <div className="genre-results-grid">
              {selectedGenre.entries.map((entry, index) => {
                const media = metadata[entry.animeId];
                const image = media?.coverImage?.extraLarge ?? media?.coverImage?.large;

                return (
                  <a className="genre-anime-card" href={"/anime/" + entry.animeId} key={entry.animeId}>
                    <div className="genre-anime-poster">
                      {image ? (
                        <img src={image} alt="" loading={index < 6 ? "eager" : "lazy"} />
                      ) : (
                        <div className="genre-anime-placeholder">
                          <strong>{entry.title}</strong>
                        </div>
                      )}
                    </div>
                    <div className="genre-anime-info">
                      <strong>{media?.title?.romaji || media?.title?.english || entry.title}</strong>
                      <span>{media?.seasonYear ?? "—"} · {entry.format ?? media?.format ?? "SERIES"}</span>
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </section>
      )}

      {!loading && catalog.length === 0 && (
        <p className="genres-empty">No hemos podido recuperar los géneros de tu colección.</p>
      )}
    </div>
  );
}
