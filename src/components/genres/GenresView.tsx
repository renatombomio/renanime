import { useEffect, useMemo, useState } from "react";
import type { LibraryEntry } from "../../types/personal";
import { buildGenreCatalog } from "../../lib/anime/genre-catalog";

interface Props {
  entries: LibraryEntry[];
}

const BATCH_SIZE = 25;

async function fetchGenreMetadata(entries: LibraryEntry[]): Promise<Record<string, string[]>> {
  const result: Record<string, string[]> = {};
  const unresolved: LibraryEntry[] = [];

  for (const entry of entries) {
    const cacheKey = "renanime:collection:" + entry.title.toLowerCase();

    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        const media = JSON.parse(cached) as { genres?: string[] };
        if (Array.isArray(media.genres)) {
          result[entry.animeId] = media.genres;
          continue;
        }
      }
    } catch {}

    unresolved.push(entry);
  }

  for (let start = 0; start < unresolved.length; start += BATCH_SIZE) {
    const batch = unresolved.slice(start, start + BATCH_SIZE);
    const variables: Record<string, string> = {};

    const fields = batch
      .map((entry, index) => {
        const key = "s" + index;
        const alias = "a" + index;
        variables[key] = entry.title;

        return alias + ': Page(page: 1, perPage: 1) { media(search: $' + key + ', type: ANIME, sort: SEARCH_MATCH) { genres } }';
      })
      .join("\n");

    const definitions = batch
      .map((_, index) => "$s" + index + ": String!")
      .join(", ");

    try {
      const response = await fetch("https://graphql.anilist.co", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          query: "query GenreBatch(" + definitions + ") { " + fields + " }",
          variables,
        }),
      });

      if (!response.ok) continue;

      const payload = await response.json();

      batch.forEach((entry, index) => {
        result[entry.animeId] =
          payload.data?.["a" + index]?.media?.[0]?.genres ?? [];
      });
    } catch {
      // Keep the catalog progressive if one API batch fails.
    }
  }

  return result;
}

export default function GenresView({ entries }: Props) {
  const [genresByAnimeId, setGenresByAnimeId] = useState<Record<string, string[]>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const metadata = await fetchGenreMetadata(entries);

      if (!cancelled) {
        setGenresByAnimeId(metadata);
        setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [entries]);

  const catalog = useMemo(
    () => buildGenreCatalog(entries, genresByAnimeId),
    [entries, genresByAnimeId],
  );

  const selectedGenre = catalog.find((genre) => genre.name === selected);

  useEffect(() => {
    if (selected && !selectedGenre) {
      setSelected(null);
    }
  }, [selected, selectedGenre]);

  return (
    <div className="genres-view">
      <div className="genres-meta">
        <span>
          {loading
            ? "Construyendo mapa…"
            : catalog.length + " géneros en tu colección"}
        </span>
        <span>{entries.length} títulos de mi colección</span>
      </div>

      <div className="genres-grid">
        {catalog.map((genre, index) => (
          <button
            type="button"
            className={"genre-card " + (selected === genre.name ? "is-active" : "")}
            key={genre.name}
            onClick={() =>
              setSelected(selected === genre.name ? null : genre.name)
            }
          >
            <span className="genre-index">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="genre-name">{genre.name}</span>
            <span className="genre-count">
              {String(genre.entries.length).padStart(2, "0")}
            </span>
          </button>
        ))}
      </div>

      {selectedGenre && (
        <section
          className="genre-results"
          aria-label={"Animes de género " + selectedGenre.name}
        >
          <div className="genre-results-head">
            <span className="genre-results-title">
              {selectedGenre.name}
            </span>
            <span>{selectedGenre.entries.length} títulos</span>
          </div>

          <div className="genre-results-list">
            {selectedGenre.entries.map((entry, index) => (
              <a href={"/anime/" + entry.animeId} key={entry.animeId}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{entry.title}</strong>
                <span>↗</span>
              </a>
            ))}
          </div>
        </section>
      )}

      {!loading && catalog.length === 0 && (
        <p className="genres-empty">
          No hemos podido recuperar los géneros de tu colección.
        </p>
      )}
    </div>
  );
}
