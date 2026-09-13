// @ts-check
import { defineConfig, envField } from "astro/config";

import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import cloudflare from "@astrojs/cloudflare";

// https://astro.build/config
export default defineConfig({
  output: "server",
  // Already Astro's default, stated here because every non-GET route depends on it and nothing
  // else in this project provides a CSRF defence.
  //
  // Scope, measured 2026-09-13 rather than assumed: the check rejects a non-GET request whose
  // Content-Type is form-shaped -- urlencoded, multipart, or text/plain -- when Origin does not
  // match. Those three are exactly the ones a browser can send cross-origin WITHOUT a preflight,
  // so they are the whole CSRF surface. Measured: POST /api/auth/signin with no Origin answers
  // 403 and 302 with it; POST /api/cards carrying a JSON body as text/plain answers 403. A real
  // application/json POST is not checked here and does not need to be -- cross-origin it requires
  // a preflight, which no route answers.
  //
  // Turning this off means writing a CSRF defence into every non-GET endpoint by hand.
  security: { checkOrigin: true },
  integrations: [react(), sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
  adapter: cloudflare(),
  env: {
    schema: {
      SUPABASE_URL: envField.string({ context: "server", access: "secret", optional: true }),
      SUPABASE_KEY: envField.string({ context: "server", access: "secret", optional: true }),
    },
  },
});
