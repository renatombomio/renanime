import { defineMiddleware } from "astro:middleware";
import { getRenanimeUser } from "./lib/auth";

const PUBLIC_PATHS = new Set(["/login/", "/register/"]);

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  if (
    PUBLIC_PATHS.has(pathname) ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/_astro/") ||
    pathname === "/favicon.svg"
  ) {
    return next();
  }

  const token = context.cookies.get("renanime_session")?.value;
  const user = await getRenanimeUser(token);

  if (!user) {
    return context.redirect("/login/");
  }

  context.locals.renanimeUser = user;
  return next();
});
