import { useEffect, useMemo, useState } from "react";

interface Entry {
  animeId: string;
  title: string;
}

interface Props {
  entries: Entry[];
}

interface GenreGroup {
  name: string;
  entries: Entry[];
}

const BATCH_SIZE = 25;

export default function GenresView({ entries }: Props) {
  const [genres, setGenres] = useState<Record<string, string[]>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const result: Record<string, string[]> = {};

      for (let start = 0; start < entries.length; start += BATCH_SIZE) {
        const batch = entries.slice(start, start + BATCH_SIZE);
        const variables: Record<string, string> = {};

        const fields = batch.map((entry, index) => {
          variables[`s${index}`] = entry.title;
          return `a${index}: Page(page: 1, perPage: 1) { media(search: $s${index}, type: ANIME, sort: SEARCH_MATCH) { genres } }`;
        }).join("\n");

        const definitions = batch.map((_, index) => `$s${index}: String!`).join(", ");
        const query = `query GenreBatch(${definitions}) { ${fields} }`;

        try {
          const response = await fetch("https://graphql.anilist.co", {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ query, variables }),
          });

          if (!response.ok) continue;

          const payload = await response.json();

          batch.forEach((entry, index) => {
            result[entry.animeId] = payload.data?.[`a${index}`]?.media?.[0]?.genres ?? [];
          });
        } catch {
          // Continue with the remaining batches; genres are progressive metadata.
        }
      }

      if (!cancelled) {
        setGenres(result);
        setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [entries]);

  const groups = useMemo<GenreGroup[]>(() => {
    const grouped = new Map<string, Entry[]>();

    entries.forEach((entry) => {
      (genres[entry.animeId] ?? []).forEach((genre) => {
        const list = grouped.get(genre) ?? [];
        list.push(entry);
        grouped.set(genre, list);
      });
    });

    return [...grouped.entries()]
      .map(([name, genreEntries]) => ({ name, entries: genreEntries }))
      .sort((a, b) => b.entries.length - a.entries.length || a.name.localeCompare(b.name));
  }, [entries, genres]);

  const selectedGroup = groups.find((group) => group.name === selected);

  return (
    <div className="genres-view">
      <div className="genres-meta">
        <span>{loading ? "Construyendo mapa…" : `${groups.length} géneros en tu colección`}</span>
        <span>{entries.length} títulos analizados</span>
      </div>

      <div className="genres-grid">
        {groups.map((group, index) => (
          <button
            type="button"
            className={`genre-card ${selected === group.name ? "is-active" : ""}`}
            key={group.name}
            onClick={() => setSelected(selected === group.name ? null : group.name)}
          >
            <span className="genre-index">{String(index + 1).padStart(2, "0")}</span>
            <span className="genre-name">{group.name}</span>
            <span className="genre-count">{String(group.entries.length).padStart(2, "0")}</span>
          </button>
        ))}
      </div>

      {selectedGroup && (
        <section className="genre-results" aria-label={`Animes de género ${selectedGroup.name}`}>
          <div className="genre-results-head">
            <span className="genre-results-title">{selectedGroup.name}</span>
            <span>{selectedGroup.entries.length} títulos</span>
          </div>

          <div className="genre-results-list">
            {selectedGroup.entries.map((entry, index) => (
              <a href={`/anime/${entry.animeId}`} key={entry.animeId}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{entry.title}</strong>
                <span>↗</span>
              </a>
            ))}
          </div>
        </section>
      )}

      {!loading && groups.length === 0 && (
        <p className="genres-empty">No hemos podido recuperar los géneros todavía.</p>
      )}
    </div>
  );
}
