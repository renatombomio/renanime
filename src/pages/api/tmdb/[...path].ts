import type { APIRoute } from "astro";

export const prerender = false;

const TMDB_BASE_URL = "https://api.themoviedb.org/3";

export const GET: APIRoute = async ({ params, request }) => {
  const token = import.meta.env.TMDB_READ_ACCESS_TOKEN;

  if (!token) {
    return new Response(
      JSON.stringify({
        status_code: 500,
        status_message: "TMDB_READ_ACCESS_TOKEN is not configured.",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const path = params.path ?? "";
  const url = new URL(request.url);
  const target = `${TMDB_BASE_URL}/${path}${url.search}`;

  try {
    const response = await fetch(target, {
      headers: {
        Authorization: `Bearer ${token}`,
        accept: "application/json",
      },
    });

    const body = await response.arrayBuffer();

    return new Response(body, {
      status: response.status,
      headers: {
        "Content-Type":
          response.headers.get("content-type") ?? "application/json",
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch {
    return new Response(
      JSON.stringify({
        status_code: 502,
        status_message: "Unable to reach TMDB.",
      }),
      {
        status: 502,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
};
