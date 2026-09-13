import { defineMiddleware } from "astro:middleware";
import { createClient } from "@/lib/supabase";

// "/cards" is a prefix, not a page: it covers /cards/new and any later card page without another
// edit to this file, which two parallel slices both have reason to touch. It deliberately does NOT
// cover /api/cards/* -- "/api/cards/rate".startsWith("/cards") is false -- so the card endpoints
// keep answering 401 JSON for themselves rather than being redirected out from under a fetch().
const PROTECTED_ROUTES = ["/dashboard", "/review", "/cards"];

export const onRequest = defineMiddleware(async (context, next) => {
  const supabase = createClient(context.request.headers, context.cookies);

  context.locals.supabase = supabase;

  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    context.locals.user = user ?? null;
  } else {
    context.locals.user = null;
  }

  if (PROTECTED_ROUTES.some((route) => context.url.pathname.startsWith(route))) {
    if (!context.locals.user) {
      return context.redirect("/auth/signin");
    }
  }

  return next();
});
