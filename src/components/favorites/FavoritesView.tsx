import { useEffect, useState } from "react";

interface FavoriteEntry {
  animeId: string;
  title: string;
  format?: "SERIES" | "MOVIE";
  state: {
    favorite: boolean;
    recommended: boolean;
  };
}

interface Media {
  title: { romaji?: string | null; english?: string | null };
  startDate?: { year?: number | null } | null;
  coverImage?: { extraLarge?: string | null; large?: string | null };
}

interface Props {
  entries: FavoriteEntry[];
}

export default function FavoritesView({ entries }: Props) {
  const [media, setMedia] = useState<Record<string, Media | null>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const variables: Record<string, string> = {};
      const fields = entries.map((entry, index) => {
        variables[`s${index}`] = entry.title;
        return `a${index}: Page(page: 1, perPage: 1) { media(search: $s${index}, type: ANIME, sort: SEARCH_MATCH) { title { romaji english } startDate { year } coverImage { extraLarge large } } }`;
      }).join("\n");
      const definitions = entries.map((_, index) => `$s${index}: String!`).join(", ");
      const query = `query Favorites(${definitions}) { ${fields} }`;

      try {
        const response = await fetch("https://graphql.anilist.co", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ query, variables }),
        });
        if (!response.ok) return;
        const payload = await response.json();
        const result: Record<string, Media | null> = {};
        entries.forEach((entry, index) => {
          result[entry.animeId] = payload.data?.[`a${index}`]?.media?.[0] ?? null;
        });
        if (!cancelled) setMedia(result);
      } catch {
        // The editorial card falls back to the personal title when metadata is unavailable.
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [entries]);

  return (
    <div className="favorites-view">
      <div className="favorites-intro">
        <span className="favorites-index">01 — 03</span>
        <span className="favorites-note">Una selección personal</span>
      </div>

      <div className="favorites-grid">
        {entries.map((entry, index) => {
          const item = media[entry.animeId];
          const title = item?.title.romaji || item?.title.english || entry.title;
          const year = item?.startDate?.year;

          return (
            <article className={`favorite-card favorite-card--${index + 1}`} key={entry.animeId}>
              <a href={`/anime/${entry.animeId}`} aria-label={`Ver ${title}`}>
                <div className="favorite-media">
                  {item?.coverImage?.extraLarge || item?.coverImage?.large ? (
                    <img
                      src={item.coverImage.extraLarge || item.coverImage.large || ""}
                      alt={title}
                      loading={index === 0 ? "eager" : "lazy"}
                    />
                  ) : (
                    <div className="favorite-placeholder">
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <strong>{entry.title}</strong>
                    </div>
                  )}
                  <div className="favorite-overlay">
                    <span className="favorite-mark">★</span>
                    <span className="favorite-year">{year ?? "—"}</span>
                  </div>
                </div>
                <div className="favorite-caption">
                  <span className="favorite-number">0{index + 1}</span>
                  <div>
                    <h3>{title}</h3>
                    <p>{entry.title === "Naruto" ? "Naruto / Shippuden" : entry.title}</p>
                  </div>
                </div>
              </a>
            </article>
          );
        })}
      </div>

      {loading && <span className="favorites-loading">Cargando archivo…</span>}
    </div>
  );
}
