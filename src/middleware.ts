import { defineMiddleware } from "astro:middleware";
import { getRenanimeUser } from "./lib/auth";
import { localizedPath } from "./i18n";

const PUBLIC_PATHS = new Set(["/login", "/login/", "/register", "/register/"]);

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname, search } = context.url;
  const isEnglish = /^\/en(?:\/|$)/.test(pathname);
  const basePath = isEnglish ? pathname.replace(/^\/en(?=\/|$)/, "") || "/" : pathname;
  const routePath = basePath.length > 1 ? basePath.replace(/\/$/, "") : basePath;

  context.locals.lang = isEnglish ? "en" : "es";
  context.locals.basePath = basePath;

  if (isEnglish) {
    context.cookies.set("lang", "en", {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
      httpOnly: true,
      secure: context.url.protocol === "https:",
    });
  } else if (!context.cookies.has("lang")) {
    context.cookies.set("lang", "es", {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
      httpOnly: true,
      secure: context.url.protocol === "https:",
    });
  }

  const isPublicAssetOrApi =
    routePath.startsWith("/api/") ||
    routePath.startsWith("/_astro/") ||
    routePath.startsWith("/audio/") ||
    routePath.startsWith("/videos/") ||
    routePath.startsWith("/images/") ||
    routePath === "/favicon.svg" ||
    routePath === "/favicon.ico";

  if (isPublicAssetOrApi || PUBLIC_PATHS.has(routePath)) {
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
