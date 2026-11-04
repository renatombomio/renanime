import { defineMiddleware } from "astro:middleware";
import { getRenanimeUser } from "./lib/auth";
import { localizedPath } from "./i18n";

// Temporary switch for the Renanime 2.0 maintenance window.
// Set to false when the updated site is ready to reopen.
const MAINTENANCE_MODE = true;

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname, search } = context.url;
  const isEnglish = /^\/en(?:\/|$)/.test(pathname);
  const basePath = isEnglish ? pathname.replace(/^\/en(?=\/|$)/, "") || "/" : pathname;
  const routePath = basePath.length > 1 ? basePath.replace(/\/$/, "") : basePath;

  context.locals.lang = isEnglish ? "en" : "es";
  context.locals.basePath = basePath;

  if (MAINTENANCE_MODE) {
    // Keep the maintenance page and static assets available, but pause the app and API.
    if (routePath === "/maintenance") {
      return next();
    }

    const isStaticAsset =
      routePath.startsWith("/_astro/") ||
      routePath.startsWith("/audio/") ||
      routePath.startsWith("/videos/") ||
      routePath.startsWith("/images/") ||
      routePath === "/favicon.svg" ||
      routePath === "/favicon.ico";

    if (isStaticAsset) {
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
        }
      );
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

  if (isPublicAssetOrApi || ["/login", "/login/", "/register", "/register/"].includes(routePath)) {
    return isEnglish ? next(basePath + search) : next();
  }

  const token = context.cookies.get("renanime_session")?.value;
  const user = await getRenanimeUser(token);

  if (!user) {
    return context.redirect(localizedPath(context.locals.lang, "/login/"));
  }

  context.locals.renanimeUser = user;
  return isEnglish ? next(basePath + search) : next();
});
