import { defineMiddleware } from "astro:middleware";
import type { User } from "@supabase/supabase-js";
import { createSupabaseSsrClient } from "./lib/supabase-ssr";
import { localizedPath } from "./i18n";

// Keep production and Preview in maintenance until the Supabase Auth cutover
// has been fully tested and explicitly approved.
const MAINTENANCE_MODE = true;

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname, search } = context.url;
  const isEnglish = /^\/en(?:\/|$)/.test(pathname);
  const basePath = isEnglish ? pathname.replace(/^\/en(?=\/|$)/, "") || "/" : pathname;
  const routePath = basePath.length > 1 ? basePath.replace(/\/$/, "") : basePath;

  context.locals.lang = isEnglish ? "en" : "es";
  context.locals.basePath = basePath;

  if (MAINTENANCE_MODE && import.meta.env.VERCEL_ENV !== "preview") {
    if (routePath === "/maintenance") return next();

    const isStaticAsset =
      routePath.startsWith("/_astro/") ||
      routePath.startsWith("/audio/") ||
      routePath.startsWith("/videos/") ||
      routePath.startsWith("/images/") ||
      routePath === "/favicon.svg" ||
      routePath === "/favicon.ico";

    if (isStaticAsset) return next();

    // Preview permits only auth endpoints for controlled migration testing.
    if (import.meta.env.VERCEL_ENV === "preview" && routePath.startsWith("/api/auth/")) {
      return next();
    }

    if (routePath.startsWith("/api/")) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "MAINTENANCE_MODE",
          message: "Renanime 2.0 is being updated. Please try again later.",
        }),
        {
          status: 503,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": "3600",
            "Cache-Control": "no-store",
          },
        },
      );
    }

    if (import.meta.env.VERCEL_ENV === "preview") {
      return isEnglish ? next(basePath + search) : next();
    }

    return context.redirect("/maintenance/", 307);
  }

  context.cookies.set("lang", context.locals.lang, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: true,
    secure: context.url.protocol === "https:",
  });

  const isPublicAssetOrApi =
    routePath.startsWith("/api/") ||
    routePath.startsWith("/_astro/") ||
    routePath.startsWith("/audio/") ||
    routePath.startsWith("/videos/") ||
    routePath.startsWith("/images/") ||
    routePath === "/favicon.svg" ||
    routePath === "/favicon.ico";

  const isPublicAuthPage = [
    "/login",
    "/login/",
    "/register",
    "/register/",
    "/auth/callback",
    "/auth/callback/",
  ].includes(routePath);

  if (isPublicAssetOrApi || isPublicAuthPage) {
    // Login and OAuth callback pages must render even when Supabase is
    // misconfigured or temporarily unavailable, so the user can see the UI
    // and auth endpoints can report their own actionable errors.
    return isEnglish ? next(basePath + search) : next();
  }

  let user: User | null = null;

  try {
    const supabase = createSupabaseSsrClient(context.request, context.cookies);
    const { data, error } = await supabase.auth.getUser();
    if (!error) user = data.user;
  } catch (error) {
    console.error("Supabase middleware authentication failed:", error);
    if (import.meta.env.VERCEL_ENV === "preview") {
      return context.redirect(localizedPath(context.locals.lang, "/login/"), 303);
    }
    return new Response("Authentication service unavailable.", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }

  if (isPublicAuthPage) {
    if (user && !context.url.searchParams.has("complete-profile") && !context.url.searchParams.has("recovery") && routePath !== "/register" && routePath !== "/register/") {
      return context.redirect(isEnglish ? "/en/" : "/", 303);
    }
    return isEnglish ? next(basePath + search) : next();
  }

  if (!user) {
    return context.redirect(localizedPath(context.locals.lang, "/login/"));
  }

  try {
    const supabase = createSupabaseSsrClient(context.request, context.cookies);
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id, name, aka, created_at")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Supabase profile lookup failed:", error.code);
      return new Response("Profile service unavailable.", {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      });
    }

    context.locals.renanimeUser = {
      id: user.id,
      name: profile?.name ?? user.user_metadata?.name ?? "Usuario",
      aka: profile?.aka ?? user.user_metadata?.aka ?? "",
      created_at: profile?.created_at ?? user.created_at,
      email: user.email ?? "",
    };
  } catch (error) {
    console.error("Supabase profile lookup failed:", error);
    return new Response("Profile service unavailable.", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }

  return isEnglish ? next(basePath + search) : next();
});
