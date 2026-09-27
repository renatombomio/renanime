import type { APIRoute } from "astro";

export const prerender = false;

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const IMAGE_BASE_URL = "https://image.tmdb.org/t/p/original";

interface SearchResult {
  id: number;
  name?: string;
  original_name?: string;
  title?: string;
  original_title?: string;
}

interface SearchResponse {
  results?: SearchResult[];
}

interface Logo {
  file_path: string;
  iso_639_1?: string | null;
  vote_average?: number;
  width?: number;
}

interface ImagesResponse {
  logos?: Logo[];
}

function normalizeTitle(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\\u0300-\\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function findMatch(results: SearchResult[], title: string) {
  const normalized = normalizeTitle(title);

  return [...results]
    .map((result) => {
      const candidates = [
        result.name,
        result.original_name,
        result.title,
        result.original_title,
      ]
        .filter(Boolean)
        .map((value) => normalizeTitle(value as string));

      const exact = candidates.includes(normalized) ? 100 : 0;
      const partial = candidates.some(
        (value) =>
          value.startsWith(normalized) || normalized.startsWith(value),
      )
        ? 25
        : 0;

      return { result, score: exact + partial };
    })
    .sort((a, b) => b.score - a.score)[0]?.result;
}

function pickLogo(logos: Logo[]) {
  return [...logos]
    .filter((logo) => logo.file_path)
    .sort((a, b) => {
      const languageScore = (value?: string | null) =>
        value === "en" ? 30 : value === null ? 20 : 0;

      return (
        languageScore(b.iso_639_1) - languageScore(a.iso_639_1) ||
        (b.vote_average ?? 0) - (a.vote_average ?? 0) ||
        (b.width ?? 0) - (a.width ?? 0)
      );
    })[0];
}

export const GET: APIRoute = async ({ request }) => {
  const token = import.meta.env.TMDB_READ_ACCESS_TOKEN;

  if (!token) {
    return new Response(
      JSON.stringify({ logo: null, error: "TMDB token is not configured." }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const url = new URL(request.url);
  const title = url.searchParams.get("title")?.trim();
  const type = url.searchParams.get("type") === "movie" ? "movie" : "tv";

  if (!title) {
    return new Response(JSON.stringify({ logo: null }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    accept: "application/json",
  };

  try {
    const searchUrl =
      `${TMDB_BASE_URL}/search/${type}?query=${encodeURIComponent(title)}&include_adult=false&language=en-US&page=1`;

    const searchResponse = await fetch(searchUrl, { headers });

    if (!searchResponse.ok) {
      return new Response(JSON.stringify({ logo: null }), {
        status: searchResponse.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    const searchData = (await searchResponse.json()) as SearchResponse;
    const match = findMatch(searchData.results ?? [], title);

    if (!match) {
      return new Response(JSON.stringify({ logo: null }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const imagesUrl =
      `${TMDB_BASE_URL}/${type}/${match.id}/images?language=en-US&include_image_language=en,null,ja`;

    const imagesResponse = await fetch(imagesUrl, { headers });

    if (!imagesResponse.ok) {
      return new Response(JSON.stringify({ logo: null }), {
        status: imagesResponse.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    const images = (await imagesResponse.json()) as ImagesResponse;
    const logo = pickLogo(images.logos ?? []);

    return new Response(
      JSON.stringify({
        logo: logo ? `${IMAGE_BASE_URL}${logo.file_path}` : null,
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=3600",
        },
      },
    );
  } catch {
    return new Response(JSON.stringify({ logo: null }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }
};
