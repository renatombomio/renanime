import type { APIRoute } from "astro";

const ANILIST_URL = "https://graphql.anilist.co";

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.text();

    if (!body) {
      return new Response(JSON.stringify({ errors: [{ message: "Request body vacío." }] }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const response = await fetch(ANILIST_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body,
    });

    const text = await response.text();

    return new Response(text, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("Content-Type") || "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[Renanime] AniList proxy failed:", error);

    return new Response(
      JSON.stringify({
        errors: [{ message: "No se pudo conectar con AniList." }],
      }),
      {
        status: 502,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
};
