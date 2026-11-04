import type { APIRoute } from "astro";
import identityCatalogue from "../../../data/ren-anime-identities.json";

export const prerender = false;

interface IdentityEntry {
  animeId: string;
  coverImage?: { large?: string | null; extraLarge?: string | null } | null;
}

const entries = (identityCatalogue as { entries?: IdentityEntry[] }).entries ?? [];
const posters = new Map(entries.map((entry) => [entry.animeId, entry.coverImage?.large ?? entry.coverImage?.extraLarge ?? null]));

export const GET: APIRoute = async ({ params }) => {
  const animeId = params.animeId;
  if (!animeId || !/^personal-\d{3}$/.test(animeId)) {
    return new Response("Not found", { status: 404 });
  }

  const imageUrl = posters.get(animeId);
  if (!imageUrl) return new Response("Poster not found", { status: 404 });

  const parsedUrl = new URL(imageUrl);
  if (parsedUrl.protocol !== "https:" || parsedUrl.hostname !== "s4.anilist.co") {
    return new Response("Invalid image source", { status: 400 });
  }

  try {
    const upstream = await fetch(parsedUrl, {
      headers: { Accept: "image/avif,image/webp,image/*" },
      signal: AbortSignal.timeout(10000),
    });

    if (!upstream.ok || !upstream.body) {
      return new Response("Poster unavailable", {
        status: upstream.status === 404 ? 404 : 502,
        headers: { "Cache-Control": "public, max-age=60, s-maxage=60" },
      });
    }

    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": upstream.headers.get("content-type") ?? "image/jpeg",
        "Cache-Control": "public, max-age=86400, s-maxage=2592000, stale-while-revalidate=604800",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Poster temporarily unavailable", {
      status: 502,
      headers: { "Cache-Control": "public, max-age=60, s-maxage=60" },
    });
  }
};
