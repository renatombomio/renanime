import { useEffect, useRef, useState, type FormEvent } from "react";
import { getLibrary } from "../../data/library";
import { getPersonalLibrary, hydratePersonalLibrary, subscribeToPersonalLibrary } from "../../data/personal-library";
import type { PersonalAnimeEntry } from "../../types/personal";
import { jikanProvider } from "../../lib/api/jikan";
import { useT, type Lang, type TranslationKey } from "../../i18n";

interface Media {
  id: number;
  providerId?: string;
  title?: { romaji?: string | null; english?: string | null };
  startDate?: { year?: number | null; month?: number | null; day?: number | null } | null;
  coverImage?: { extraLarge?: string | null; large?: string | null };
  format?: string | null;
  popularity?: number | null;
  averageScore?: number | null;
  seasonYear?: number | null;
  status?: string | null;
  genres?: string[];
  tags?: { name: string; rank?: number | null }[];
}

type DiscoveryRowId = "discover" | "hidden" | "trending" | "season" | "topRated";
const PAGE_SIZE = 12;
const DISCOVERY_ROWS: { id: DiscoveryRowId; titleKey: TranslationKey; descriptionKey: TranslationKey }[] = [
  { id: "discover", titleKey: "search.rowDiscover", descriptionKey: "search.rowDiscoverDescription" },
  { id: "hidden", titleKey: "search.rowHidden", descriptionKey: "search.rowHiddenDescription" },
  { id: "trending", titleKey: "search.rowTrending", descriptionKey: "search.rowTrendingDescription" },
  { id: "season", titleKey: "search.rowSeason", descriptionKey: "search.rowSeasonDescription" },
  { id: "topRated", titleKey: "search.rowTopRated", descriptionKey: "search.rowTopRatedDescription" },
];

const OWNED_TITLES = new Set(
  getLibrary().map((entry) => normalizeTitle(entry.title)).filter(Boolean),
);

function normalizeTitle(value: string): string {
  return value.toLocaleLowerCase("en")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isOwned(media: Media): boolean {
  return [media.title?.romaji, media.title?.english]
    .filter((title): title is string => Boolean(title))
    .some((title) => OWNED_TITLES.has(normalizeTitle(title)));
}

function currentSeason(date = new Date()): { season: "WINTER" | "SPRING" | "SUMMER" | "FALL"; year: number } {
  const month = date.getMonth();
  const season = month < 3 ? "WINTER" : month < 6 ? "SPRING" : month < 9 ? "SUMMER" : "FALL";
  return { season, year: date.getFullYear() };
}

function formatShortDate(date: Media["startDate"], format: string | null | undefined, lang: Lang) {
  if (!date?.year || !date.month || !date.day) return date?.year ? String(date.year) : "";
  const currentYear = new Date().getFullYear();
  const dateLabel = new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "es-ES", { day: "numeric", month: "short" }).format(new Date(date.year, date.month - 1, date.day));
  return `${dateLabel}${date.year !== currentYear ? ` ${date.year}` : ""} · ${format === "MOVIE" ? (lang === "en" ? "Film" : "Película") : (lang === "en" ? "Series" : "Serie")}`;
}

function formatDate(date: Media["startDate"], lang: Lang) {
  if (!date?.year) return lang === "en" ? "Unknown date" : "Fecha desconocida";
  if (!date.month || !date.day) return String(date.year);
  return new Date(date.year, date.month - 1, date.day).toLocaleDateString(
    lang === "en" ? "en-GB" : "es-ES",
    { day: "numeric", month: "long", year: "numeric" },
  );
}

const MEDIA_FIELDS = "id title { romaji english } startDate { year month day } coverImage { extraLarge large } format popularity averageScore genres seasonYear status tags { name rank }";

async function fetchJikanSearch(query: string, page: number): Promise<Media[]> {
  const entries = await jikanProvider.search({ query, page, perPage: PAGE_SIZE });
  return entries.map((entry) => ({
    id: entry.external.mal ?? Number(entry.id.replace("mal-", "")),
    providerId: entry.id,
    title: { romaji: entry.metadata.title, english: entry.metadata.title },
    startDate: entry.metadata.year ? { year: entry.metadata.year } : null,
    coverImage: entry.metadata.images.cover
      ? { extraLarge: entry.metadata.images.cover, large: entry.metadata.images.cover }
      : undefined,
    format: entry.metadata.format,
  }));
}

async function fetchDiscoveryRows(personalEntries: PersonalAnimeEntry[] = []): Promise<Record<DiscoveryRowId, Media[]>> {
  const { season, year } = currentSeason();
  const baseQuery = `
    query SearchDiscovery($season: MediaSeason!, $year: Int!) {
      discover: Page(page: 1, perPage: 50) {
        media(type: ANIME, averageScore_greater: 74, popularity_greater: 20000, popularity_lesser: 150000, sort: SCORE_DESC, isAdult: false) { ${MEDIA_FIELDS} }
      }
      hidden: Page(page: 1, perPage: 50) {
        media(type: ANIME, sort: SCORE_DESC, averageScore_greater: 74, popularity_greater: 500, popularity_lesser: 20000, isAdult: false) { ${MEDIA_FIELDS} }
      }
      trending: Page(page: 1, perPage: 50) {
        media(type: ANIME, sort: TRENDING_DESC, isAdult: false) { ${MEDIA_FIELDS} }
      }
      season: Page(page: 1, perPage: 50) {
        media(type: ANIME, season: $season, seasonYear: $year, sort: POPULARITY_DESC, isAdult: false) { ${MEDIA_FIELDS} }
      }
      topRated: Page(page: 1, perPage: 50) {
        media(type: ANIME, sort: SCORE_DESC, isAdult: false) { ${MEDIA_FIELDS} }
      }
    }
  `;
  const response = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query: baseQuery, variables: { season, year } }),
  });
  if (!response.ok) throw new Error("Discovery request failed");
  const payload = await response.json();
  if (payload.errors?.length) throw new Error("Discovery query failed");
  const pages = payload.data;
  if (!pages) throw new Error("Discovery data unavailable");

  const seedEntries = [...personalEntries]
    .sort((a, b) => Number(b.state.favorite) - Number(a.state.favorite) || Number(b.state.status === "WATCHED") - Number(a.state.status === "WATCHED"))
    .slice(0, 5);
  const numericEntries = seedEntries.filter((entry) => /^\d+$/.test(entry.animeId));
  const customEntries = seedEntries
    .filter((entry) => !/^\d+$/.test(entry.animeId))
    .map((entry) => ({ entry, title: getLibrary().find((item) => item.animeId === entry.animeId)?.title }))
    .filter((item): item is { entry: PersonalAnimeEntry; title: string } => Boolean(item.title));
  const personalIds = new Set(personalEntries.map((entry) => Number(entry.animeId)).filter(Number.isFinite));
  const eligible = (items: Media[]) => items.filter((media) =>
    !personalIds.has(media.id) &&
    !isOwned(media) &&
    Boolean(media.coverImage?.extraLarge || media.coverImage?.large) &&
    Boolean(media.title?.romaji || media.title?.english)
  );
  const uniqueById = (items: Media[]) => items.filter(
    (media, index, list) => list.findIndex((candidate) => candidate.id === media.id) === index,
  );
  const withoutPreviouslyShown = (items: Media[], used: Set<number>) =>
    uniqueById(eligible(items)).filter((media) => !used.has(media.id)).slice(0, 12);
  const claim = (items: Media[], used: Set<number>, limit = 12) => {
    const selected = withoutPreviouslyShown(items, used).slice(0, limit);
    selected.forEach((media) => used.add(media.id));
    return selected;
  };

  let personalized: Media[] = [];
  try {
    const seedIds = numericEntries.map((entry) => Number(entry.animeId));
    if (customEntries.length) {
      const titleVariables: Record<string, string> = {};
      const titleDefinitions = customEntries.map((item, index) => {
        titleVariables[`seedTitle${index}`] = item.title;
        return `$seedTitle${index}: String!`;
      });
      const titleSearches = customEntries.map((_, index) => `
        seedSearch${index}: Page(page: 1, perPage: 1) {
          media(search: $seedTitle${index}, type: ANIME, sort: SEARCH_MATCH, isAdult: false) { id }
        }
      `).join("\n");
      const titleQuery = `
        query ResolvePersonalSeeds(${titleDefinitions.join(", ")}) {
          ${titleSearches}
        }
      `;
      const titleResponse = await fetch("https://graphql.anilist.co", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ query: titleQuery, variables: titleVariables }),
      });
      if (titleResponse.ok) {
        const titlePayload = await titleResponse.json();
        if (!titlePayload.errors?.length && titlePayload.data) {
          customEntries.forEach((_, index) => {
            const resolvedId = titlePayload.data[`seedSearch${index}`]?.media?.[0]?.id;
            if (Number.isInteger(resolvedId)) seedIds.push(resolvedId);
          });
        }
      }
    }

    if (seedIds.length) {
      const variables: Record<string, number> = {};
      const definitions = seedIds.map((id, index) => {
        variables[`seedId${index}`] = id;
        return `$seedId${index}: Int!`;
      });
      const seeds = seedIds.map((_, index) => `
        seed${index}: Media(id: $seedId${index}, type: ANIME) {
          genres
          tags { name rank }
          recommendations(page: 1, perPage: 25, sort: RATING_DESC) {
            nodes { rating mediaRecommendation { ${MEDIA_FIELDS} } }
          }
        }
      `).join("\n");
      const recommendationQuery = `
        query PersonalRecommendations(${definitions.join(", ")}) {
          ${seeds}
        }
      `;
      const recommendationResponse = await fetch("https://graphql.anilist.co", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ query: recommendationQuery, variables }),
      });
      if (recommendationResponse.ok) {
        const recommendationPayload = await recommendationResponse.json();
        if (!recommendationPayload.errors?.length && recommendationPayload.data) {
          const seedMedia = seedIds.map((_, index) => recommendationPayload.data[`seed${index}`]).filter(Boolean);
          const genreCounts = new Map<string, number>();
          const tagCounts = new Map<string, number>();
          seedMedia.forEach((seed: { genres?: string[]; tags?: { name: string; rank?: number | null }[] }) => {
            (seed.genres ?? []).forEach((genre) => genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1));
            (seed.tags ?? []).filter((tag) => (tag.rank ?? 0) >= 60).forEach((tag) => tagCounts.set(tag.name, (tagCounts.get(tag.name) ?? 0) + 1));
          });
          const maxGenreCount = Math.max(1, ...genreCounts.values());
          const maxTagCount = Math.max(1, ...tagCounts.values());
          personalized = seedMedia.flatMap((seed: { recommendations?: { nodes?: { rating?: number | null; mediaRecommendation?: Media | null }[] } }) => seed.recommendations?.nodes ?? [])
            .filter((node: { mediaRecommendation?: Media | null }) => Boolean(node.mediaRecommendation))
            .map((node: { rating?: number | null; mediaRecommendation: Media }) => {
              const media = node.mediaRecommendation;
              const genreFit = (media.genres ?? []).reduce((sum, genre) => sum + (genreCounts.get(genre) ?? 0) / maxGenreCount, 0);
              const tagFit = (media.tags ?? []).filter((tag) => (tag.rank ?? 0) >= 60).reduce((sum, tag) => sum + (tagCounts.get(tag.name) ?? 0) / maxTagCount, 0);
              return { ...media, recommendationRating: (node.rating ?? 0) + genreFit * 8 + tagFit * 2 };
            })
            .sort((a: Media & { recommendationRating: number }, b: Media & { recommendationRating: number }) =>
              b.recommendationRating - a.recommendationRating || (b.averageScore ?? 0) - (a.averageScore ?? 0));
        }
      }
    }
  } catch {
    // Keep the general discovery row available if personalized recommendations fail.
  }
  const used = new Set<number>();
  const discoverSource = personalized.length ? personalized : pages.discover?.media ?? [];
  const discover = claim(discoverSource.filter((media: Media & { recommendationRating?: number }) =>
    (media.averageScore ?? 0) >= 75 &&
    (personalized.length || ((media.popularity ?? 0) > 20000 && (media.popularity ?? 0) < 150000))
  ), used);
  const hidden = claim(
    (pages.hidden?.media ?? []).filter((media: Media) =>
      (media.averageScore ?? 0) >= 75 &&
      (media.popularity ?? 0) > 500 &&
      (media.popularity ?? 0) < 20000
    ),
    used,
  );
  const trending = claim(pages.trending?.media ?? [], used);
  const seasonItems = claim(pages.season?.media ?? [], used);
  const topRated = claim(
    (pages.topRated?.media ?? []).filter((media: Media) => (media.averageScore ?? 0) >= 75),
    used,
  );

  return { discover, hidden, trending, season: seasonItems, topRated };
}

export default function SearchView({ lang = "es" }: { lang?: Lang }) {
  const t = useT(lang);
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [results, setResults] = useState<Media[]>([]);
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [personalEntries, setPersonalEntries] = useState<PersonalAnimeEntry[]>([]);
  const [personalLibraryReady, setPersonalLibraryReady] = useState(false);
  const [discovery, setDiscovery] = useState<Record<DiscoveryRowId, Media[]> | null>(null);
  const [discoveryLoading, setDiscoveryLoading] = useState(true);
  const [discoveryError, setDiscoveryError] = useState(false);
  const [activeFilter, setActiveFilter] = useState<"discover" | "genre" | "year" | "format" | "status">("discover");
  const [filters, setFilters] = useState({ genre: [] as string[], year: "", format: "", status: "" });
  const [filterResults, setFilterResults] = useState<Media[]>([]);
  const [filterTotal, setFilterTotal] = useState(0);
  const [filterLoading, setFilterLoading] = useState(false);
  const [filterError, setFilterError] = useState(false);
  const [lastAppliedFilter, setLastAppliedFilter] = useState<keyof typeof filters | null>(null);
  const [filtersReady, setFiltersReady] = useState(false);
  const lastSurpriseId = useRef<number | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setFilters({ genre: params.getAll("genre"), year: params.get("year") ?? "", format: params.get("format") ?? "", status: params.get("status") ?? "" });
    setFiltersReady(true);
  }, []);

  useEffect(() => {
    if (!filtersReady) return;
    const params = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(filters)) {
      params.delete(key);
      if (Array.isArray(value)) value.forEach((item) => params.append(key, item));
      else if (value) params.set(key, value);
    }
    const queryString = params.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${queryString ? `?${queryString}` : ""}`);
  }, [filters, filtersReady]);

  useEffect(() => {
    const value = query.trim();
    if (value.length < 2) {
      if (!value) setSubmitted("");
      return;
    }
    const timeout = window.setTimeout(() => {
      setPage(1);
      setResults([]);
      setHasNext(false);
      setSearchError(false);
      setSubmitted(value);
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    const syncPersonalLibrary = () => setPersonalEntries(getPersonalLibrary());
    const unsubscribe = subscribeToPersonalLibrary(syncPersonalLibrary);
    syncPersonalLibrary();
    void hydratePersonalLibrary().finally(() => {
      if (!cancelled) {
        syncPersonalLibrary();
        setPersonalLibraryReady(true);
      }
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!personalLibraryReady) return;
    let cancelled = false;
    setDiscoveryLoading(true);
    fetchDiscoveryRows(personalEntries)
      .then((rows) => {
        if (!cancelled) {
          setDiscovery(rows);
          setDiscoveryError(false);
        }
      })
      .catch(() => {
        if (!cancelled) setDiscoveryError(true);
      })
      .finally(() => {
        if (!cancelled) setDiscoveryLoading(false);
      });
    return () => { cancelled = true; };
  }, [personalLibraryReady, personalEntries]);

  useEffect(() => {
    if (!submitted.trim()) {
      setResults([]);
      setHasNext(false);
      setSearchError(false);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setSearchError(false);
    const search = async () => {
      try {
        const response = await fetch("https://graphql.anilist.co", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            query: "query Search($search:String!,$page:Int!,$perPage:Int!){Page(page:$page,perPage:$perPage){pageInfo{hasNextPage} media(search:$search,type:ANIME,sort:SEARCH_MATCH){id title{romaji english} startDate{year month day} coverImage{extraLarge large} format genres seasonYear status averageScore}}}",
            variables: { search: submitted, page, perPage: PAGE_SIZE },
          }),
        });
        if (!response.ok) throw new Error("AniList request failed");
        const payload = await response.json();
        if (payload.errors?.length) throw new Error("AniList GraphQL error");
        const primary = payload.data?.Page?.media ?? [];
        const media = primary.length ? primary : await fetchJikanSearch(submitted, page);
        if (cancelled) return;
        setResults((current) => page === 1 ? media : [...current, ...media]);
        setHasNext(Boolean(primary.length && payload.data?.Page?.pageInfo?.hasNextPage));
        setSearchError(false);
      } catch {
        try {
          const fallback = await fetchJikanSearch(submitted, page);
          if (cancelled) return;
          setResults((current) => page === 1 ? fallback : [...current, ...fallback]);
          setHasNext(false);
          setSearchError(false);
        } catch {
          if (!cancelled) setSearchError(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void search();
    return () => { cancelled = true; };
  }, [submitted, page, retry]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setPage(1);
    setRetry((current) => current + 1);
    setResults([]);
    setHasNext(false);
    setSearchError(false);
    setSubmitted(query.trim());
  };

  const showDiscovery = !query.trim() && !submitted.trim();
  const allDiscoveryItems = discovery ? Object.values(discovery).flat() : [];
  const genres = ["Action", "Adventure", "Comedy", "Drama", "Fantasy", "Horror", "Mahou Shoujo", "Mecha", "Music", "Mystery", "Psychological", "Romance", "Sci-Fi", "Slice of Life", "Sports", "Supernatural", "Thriller"];
  const formats = ["TV", "TV_SHORT", "MOVIE", "SPECIAL", "OVA", "ONA", "MUSIC"];
  const statuses = ["FINISHED", "RELEASING", "NOT_YET_RELEASED", "CANCELLED"];
  const currentYear = new Date().getFullYear();
  const years = [...Array.from({ length: 10 }, (_, index) => String(currentYear - index)), "before-2016"];
  const options = { genre: genres, year: years, format: formats, status: statuses };
  const hasFilters = filters.genre.length > 0 || Boolean(filters.year || filters.format || filters.status);
  const matchesFilters = (item: Media) =>
    (!filters.genre.length || filters.genre.some((genre) => item.genres?.includes(genre))) &&
    (!filters.year || (filters.year === "before-2016" ? (item.seasonYear ?? item.startDate?.year ?? 9999) < 2016 : String(item.seasonYear ?? item.startDate?.year ?? "") === filters.year)) &&
    (!filters.format || item.format === filters.format) &&
    (!filters.status || item.status === filters.status);
  const filterKey = JSON.stringify(filters);
  const surprisePool = [...new Map(allDiscoveryItems.filter(matchesFilters).map((item) => [item.id, item])).values()];
  const surprise = () => {
    if (!surprisePool.length) return;
    const candidates = surprisePool.filter((item) => item.id !== lastSurpriseId.current);
    const selected = (candidates.length ? candidates : surprisePool)[Math.floor(Math.random() * (candidates.length ? candidates.length : surprisePool.length))];
    lastSurpriseId.current = selected.id;
    window.location.href = `${lang === "en" ? "/en" : ""}/anime/${selected.id}`;
  };

  const renderCard = (item: Media, index: number, row?: DiscoveryRowId) => {
    const title = lang === "en"
      ? (item.title?.english || item.title?.romaji || t("detail.noTitle"))
      : (item.title?.romaji || item.title?.english || t("detail.noTitle"));
    const image = item.coverImage?.extraLarge || item.coverImage?.large;
    return (
      <article className={`search-result${row === "trending" ? " search-result-trending" : ""}`} key={item.id}>
        {row === "trending" && <span className="search-rank" aria-label={`${index + 1}`}>{index + 1}</span>}
        <a className="search-card" href={item.providerId?.startsWith("mal-") ? `${lang === "en" ? "/en" : ""}/anime/search?title=${encodeURIComponent(item.title?.romaji || item.title?.english || "")}` : `${lang === "en" ? "/en" : ""}/anime/${item.id}`} aria-label={title}>
          <div className="search-poster">
            {image ? <img src={image} alt="" loading={index < 4 ? "eager" : "lazy"} /> : <div className="search-poster-placeholder">{title}</div>}
          </div>
          <div className="search-info">
            <h3>{title}</h3>
            {row === "hidden" ? (item.averageScore != null && <span className="search-score"><strong>{(item.averageScore / 10).toFixed(1)}</strong><span> / 10</span></span>) : row === "season" ? <span>{formatShortDate(item.startDate, item.format, lang)}</span> : row === "trending" ? null : <span>{formatShortDate(item.startDate, item.format, lang)}</span>}
          </div>
        </a>
      </article>
    );
  };

  return (
    <div className="search-view">
      <style>{`
        .search-view { width: 100%; }
        .search-form { display: flex; align-items: center; gap: .7rem; min-height: 3rem; margin-bottom: 2.5rem; padding: 0 .95rem; border: 1px solid rgba(255,255,255,.09); border-radius: 999px; background: #131316; }
        .search-form input { flex: 1; min-width: 0; height: 2.9rem; padding: .7rem 0; border: 0; background: transparent; color: var(--color-paper-50); font: 400 .9rem/1.2 var(--font-body); outline: none; }
        .search-form:focus-within { outline: 2px solid #ec4899; outline-offset: 3px; }
        .search-more { min-height: 3rem; padding: .7rem 1rem; border: 1px solid var(--color-border-strong); background: transparent; color: var(--color-paper-50); font: 500 .72rem/1 var(--font-body); cursor: pointer; }
        .search-more:hover:not(:disabled) { background: var(--color-paper-50); color: var(--color-ink-950); }
        .search-discovery-count { display: flex; justify-content: space-between; align-items: center; margin: -.45rem 0 1.5rem; color: #77737d; font: 400 .72rem/1.3 var(--font-body); }
        .search-discovery-count button { padding: 0; border: 0; background: transparent; color: #f472b6; font: 600 .75rem/1.3 var(--font-body); cursor: pointer; }
        .search-filters { display: flex; gap: 1.2rem; overflow-x: auto; margin: -1.4rem 0 1.25rem; border-bottom: 1px solid rgba(255,255,255,.08); scrollbar-width: none; }
        .search-filter-tab { flex: 0 0 auto; padding: .65rem 0 .7rem; border: 0; border-bottom: 2px solid transparent; background: transparent; color: #8d8993; font: 400 .8rem/1.2 var(--font-body); cursor: pointer; }
        .search-filter-tab[aria-selected="true"] { border-bottom-color: #ec4899; color: #f2efe9; font-weight: 600; }
        .search-filter-options { display: flex; flex-wrap: wrap; gap: .55rem 1rem; margin: 0 0 1.5rem; }
        .search-filter-option { padding: .35rem 0; border: 0; border-bottom: 1px solid transparent; background: transparent; color: #8d8993; font: 400 .78rem/1.3 var(--font-body); cursor: pointer; }
        .search-filter-option[aria-pressed="true"] { border-bottom-color: #ec4899; color: #f2efe9; }
        .search-filter-tab:focus-visible, .search-filter-option:focus-visible { outline: 2px solid #ec4899; outline-offset: 3px; }
        .search-discovery { display: grid; gap: clamp(2.4rem, 5vw, 4rem); }
        .search-filters { display: flex; gap: 1.2rem; overflow-x: auto; margin: -1.4rem 0 1rem; border-bottom: 1px solid rgba(255,255,255,.08); scrollbar-width: none; }
        .search-filters::-webkit-scrollbar { display: none; }
        .search-filter-tab { flex: 0 0 auto; padding: .65rem 0 .7rem; border: 0; border-bottom: 2px solid transparent; background: transparent; color: #8d8993; font: 400 .8rem/1.2 var(--font-body); cursor: pointer; white-space: nowrap; }
        .search-filter-tab[aria-selected="true"] { border-bottom-color: #ec4899; color: #f2efe9; font-weight: 600; }
        .search-filter-options { display: flex; flex-wrap: wrap; gap: .5rem 1rem; margin: 0 0 1rem; }
        .search-filter-option { padding: .35rem 0; border: 0; border-bottom: 1px solid transparent; background: transparent; color: #8d8993; font: 400 .78rem/1.3 var(--font-body); cursor: pointer; }
        .search-filter-option[aria-pressed="true"] { border-bottom-color: #ec4899; color: #f2efe9; }
        .search-filter-tab:focus-visible, .search-filter-option:focus-visible, .search-discovery-count button:focus-visible { outline: 2px solid #ec4899; outline-offset: 3px; }
        .search-discovery-count { display: flex; justify-content: space-between; align-items: center; margin: 0 0 1.7rem; color: #77737d; font: 400 .75rem/1.3 var(--font-body); }
        .search-discovery-count button { padding: 0; border: 0; background: transparent; color: #f472b6; font: 600 .78rem/1.3 var(--font-body); cursor: pointer; }
        .search-discovery-row { min-width: 0; }
        .search-row-heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 1rem; margin-bottom: 1.15rem; }
        .search-row-copy { display: grid; gap: .45rem; min-width: 0; }
        .search-row-heading h2 { margin: 0; color: var(--color-paper-50); font: 400 clamp(1.8rem, 3.3vw, 2.65rem)/.98 var(--font-heading); letter-spacing: -.045em; }
        .search-row-heading p { max-width: 38rem; margin: 0; color: var(--color-muted-400); font: 400 .85rem/1.5 var(--font-body); }
        .search-row-track { display: flex; gap: .9rem; overflow-x: auto; padding: .1rem .05rem .8rem; margin: 0 -.05rem; scroll-snap-type: x mandatory; overscroll-behavior-inline: contain; scrollbar-width: none; }
        .search-row-track::-webkit-scrollbar { display: none; }
        .search-result { flex: 0 0 132px; min-width: 0; scroll-snap-align: start; }
        .search-result-trending { flex: 0 0 auto; display: flex; align-items: flex-start; gap: 12px; }
        .search-result-trending .search-card { width: 124px; flex: 0 0 124px; }
        .search-rank { flex: 0 0 56px; width: 56px; margin: 0; padding-top: 3px; color: #09090b; -webkit-text-stroke: 2px #f2efe9; font: 500 72px/.8 var(--font-body); letter-spacing: -.06em; text-align: right; }\n        .search-result-trending:nth-child(n + 11) .search-rank { flex-basis: 64px; width: 64px; }
        .search-score { color: #77737d !important; font-size: .72rem !important; }
        .search-score strong { color: #f2efe9; font-weight: 600; }
        .search-card { display: block; min-width: 0; color: inherit; text-decoration: none; }
        .search-poster { aspect-ratio: 2 / 3; overflow: hidden; background: var(--color-ink-900); }
        .search-poster img { display: block; width: 100%; height: 100%; object-fit: cover; transition: transform 500ms cubic-bezier(.2,.7,.2,1); }
        .search-poster-placeholder { display: grid; width: 100%; height: 100%; place-items: center; padding: .8rem; color: var(--color-muted-400); font-size: .75rem; text-align: center; }
        .search-card:hover .search-poster img { transform: scale(1.035); }
        .search-info { display: grid; gap: .35rem; padding: .65rem .05rem 0; }
        .search-info h3 { display: -webkit-box; height: 2.6em; overflow: hidden; margin: 0; color: var(--color-paper-50); font: 500 .78rem/1.3 var(--font-body); -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
        .search-info span { color: var(--color-muted-400); font: 400 .65rem/1.3 var(--font-body); }
        .search-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 2.5rem 1rem; }
        .search-grid .search-result { flex: initial; }
        .search-status { color: var(--color-muted-400); font: 400 .8rem/1.5 var(--font-body); }
        .search-more { display: block; margin: 2.5rem auto 0; }
        .search-discovery-status { color: var(--color-muted-400); font: 400 .8rem/1.5 var(--font-body); }
        @media (max-width: 1100px) { .search-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
        @media (max-width: 760px) {
          .search-form { margin-bottom: 2rem; }
          .search-discovery { gap: 2.5rem; }
          .search-row-heading { margin-bottom: .9rem; }
          .search-row-heading h2 { font-size: 1.85rem; }
          .search-row-heading p { font-size: .8rem; }
          .search-row-track { gap: .7rem; }
          .search-result { flex-basis: 132px; }
          .search-result-trending { flex-basis: 168px; }
          .search-result-trending .search-card { flex-basis: 132px; }
          .search-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1.8rem .7rem; }
          .search-info { padding-top: .55rem; }
        }
        @media (max-width: 520px) {
          .search-form { gap: .55rem; }
          .search-row-heading h2 { font-size: 1.65rem; }
          .search-row-heading p { font-size: .76rem; }
          .search-result:not(.search-result-trending) { flex-basis: 118px; }
        }
      `}</style>
      <form className="search-form" onSubmit={submit}>
        <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="10.8" cy="10.8" r="6.3" /><path d="m15.5 15.5 4 4" /></svg>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("search.placeholder")} aria-label={t("search.label")} />
      </form>

      <nav className="search-filters" aria-label={lang === "en" ? "Search filters" : "Filtros de búsqueda"}>
          {(["discover", "genre", "year", "format", "status"] as const).map((tab) => <button key={tab} type="button" className="search-filter-tab" aria-selected={activeFilter === tab} onClick={() => setActiveFilter(tab)}>{({ discover: t("search.filterDiscover"), genre: t("search.filterGenre"), year: t("search.filterYear"), format: t("search.filterFormat"), status: t("search.filterStatus") })[tab]}</button>)}
      </nav>
      {activeFilter !== "discover" && <div className="search-filter-options" role="group" aria-label={activeFilter}>
          {(options[activeFilter] ?? []).map((value) => <button key={value} type="button" className="search-filter-option" aria-pressed={filters[activeFilter] === String(value)} onClick={() => setFilters((current) => ({ ...current, [activeFilter]: current[activeFilter] === String(value) ? "" : String(value) }))}>{String(value).replaceAll("_", " ").toLocaleLowerCase(lang === "en" ? "en" : "es")}</button>)}
      </div>}
      {showDiscovery && <div className="search-discovery-count"><span>{t("search.titleCount").replace("{count}", String(surprisePool.length))}</span>{surprisePool.length > 0 && <button type="button" onClick={surprise}>{t("search.surprise")}</button>}</div>}
      {showDiscovery && activeFilter === "discover" && <div className="search-discovery">
          {discoveryLoading && <p className="search-discovery-status" role="status" aria-live="polite">{t("search.discoveryLoading")}</p>}
          {discoveryError && !discoveryLoading && <p className="search-discovery-status" role="status">{t("search.discoveryError")}</p>}
          {discovery && DISCOVERY_ROWS.map((row) => {
            const items = (discovery[row.id] ?? []).filter(matchesFilters);
            if (!items.length) return null;
            return (
              <section className="search-discovery-row" key={row.id} aria-labelledby={`search-row-${row.id}`}>
                <header className="search-row-heading">
                  <div className="search-row-copy">
                    <h2 id={`search-row-${row.id}`}>{t(row.titleKey)}</h2>
                    <p>{t(row.descriptionKey)}</p>
                  </div>
                </header>
                <div className="search-row-track" aria-label={t(row.titleKey)} tabIndex={0} role="region">
                  {items.map((item, index) => renderCard(item, index, row.id))}
                </div>
              </section>
            );
          })}
      </div>}

      {loading && <p className="search-status" role="status" aria-live="polite">{t("search.loading")}</p>}
      {!loading && searchError && <p className="search-status" role="alert">{t("search.error")}</p>}
      {!loading && !searchError && submitted && !results.length && <p className="search-status" role="status" aria-live="polite">{t("search.empty").split("{query}").join(submitted)}</p>}
      {results.length > 0 && (
        <>
          <div className="search-grid" aria-busy={loading}>{results.filter(matchesFilters).map(renderCard)}</div>
          {(hasNext || searchError) && (
            <button className="search-more" type="button" onClick={() => searchError ? setRetry((current) => current + 1) : setPage((current) => current + 1)} disabled={loading}>
              {loading ? t("search.loading") : searchError ? t("search.retry") : t("search.more")}
            </button>
          )}
        </>
      )}
      {searchError && results.length === 0 && (
        <button className="search-more" type="button" onClick={() => setRetry((current) => current + 1)} disabled={loading}>{t("search.retry")}</button>
      )}
    </div>
  );
}
