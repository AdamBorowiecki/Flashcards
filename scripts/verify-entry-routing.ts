/**
 * verify-entry-routing: proves where every entry point sends a learner.
 *
 * roadmap.md S-03 / PRD FR-002: a signed-in learner who opens the app lands in the due queue. That
 * is three separate redirects -- sign-in, an already-signed-in visit to `/`, and the Topbar's
 * /dashboard link -- while an anonymous visitor must keep the marketing page and stay bounced off
 * the protected routes. None of it shows up in a type check or a build, and a redirect that
 * silently reverts looks identical to one that works until somebody opens a bookmark.
 *
 * Run it:
 *   BASE_URL=http://localhost:4325 VERIFY_EMAIL=you@example.com VERIFY_PASSWORD=... npm run verify:routing
 *
 * BASE_URL has no default worth trusting: this repo is worked in parallel git worktrees, so 4321
 * and the next few ports are routinely taken and `astro dev` walks up until it finds a free one.
 * Read the port off the dev server's banner and pass it.
 *
 * What this catches: a reverted redirect target, a protected route falling open, `/` being made
 * unreachable for anonymous visitors, and /dashboard being deleted out from under Topbar.astro:13.
 *
 * What this does NOT catch: anything rendered. Whether the session header shows the right count, or
 * the Topbar renders, are manual criteria in the plan's phase 1. This script only reads status
 * codes and Location headers.
 *
 * Mirrors verify-srs-ordering.ts: plain Node under --experimental-strip-types, importing nothing
 * that needs the `@/` alias or astro:env, so the check stays runnable. Exits non-zero on the first
 * failed assertion.
 */

const BASE_URL = (process.env.BASE_URL ?? "http://localhost:4322").replace(/\/$/, "");
const EMAIL = process.env.VERIFY_EMAIL;
const PASSWORD = process.env.VERIFY_PASSWORD;

/** One row of the routing matrix. `location` is asserted only when the expectation is a redirect. */
interface Check {
  path: string;
  session: boolean;
  status: number;
  location?: string;
}

const CHECKS: Check[] = [
  // Signed in: every entry point converges on the queue.
  { path: "/", session: true, status: 302, location: "/review" },
  { path: "/dashboard", session: true, status: 302, location: "/review" },
  { path: "/review", session: true, status: 200 },
  // Anonymous: marketing stays reachable, protected routes stay protected.
  { path: "/", session: false, status: 200 },
  { path: "/dashboard", session: false, status: 302, location: "/auth/signin" },
  { path: "/review", session: false, status: 302, location: "/auth/signin" },
];

function fail(label: string, expected: string, actual: string): never {
  process.stderr.write(`verify-entry-routing: ${label}\n  expected: ${expected}\n  actual:   ${actual}\n`);
  process.exit(1);
}

function describe(status: number, location: string | null): string {
  return location === null ? String(status) : `${status} -> ${location}`;
}

/**
 * Sign in and return the Cookie header the authenticated half of the matrix needs.
 *
 * Doubles as the first assertion: a successful POST must redirect to /review, which is the change
 * to src/pages/api/auth/signin.ts. `redirect: "manual"` throughout -- following redirects would
 * collapse exactly the distinction this script exists to check.
 */
async function signIn(email: string, password: string): Promise<string> {
  const response = await fetch(`${BASE_URL}/api/auth/signin`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      // Required, not decorative. Astro's CSRF origin check (security.checkOrigin, on by default)
      // rejects a form-encoded POST whose Origin does not match the host with a bare 403 and no
      // body -- measured here before this header was added. A browser sends Origin for free, so the
      // app is fine; a script is not, and the 403 reads like a broken endpoint rather than a
      // blocked request.
      Origin: BASE_URL,
    },
    body: new URLSearchParams({ email, password }).toString(),
    redirect: "manual",
  });

  const location = response.headers.get("location");
  const label = "POST /api/auth/signin (valid credentials)";

  // Rejected credentials also answer 302, back to /auth/signin?error=... -- so status alone does not
  // separate "wrong password" from "redirect target regressed". Reporting the first as the second
  // would send someone debugging a file that is fine.
  if (location?.startsWith("/auth/signin")) {
    const reason = new URL(location, BASE_URL).searchParams.get("error") ?? "no error message";
    fail(label, "a signed-in session", `sign-in rejected (${reason}) -- check VERIFY_EMAIL / VERIFY_PASSWORD`);
  }

  if (response.status !== 302 || location !== "/review") {
    fail(label, "302 -> /review", describe(response.status, location));
  }

  process.stdout.write(`  ${label}: 302 -> /review\n`);

  const cookies = response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .filter((pair) => pair.includes("="));

  if (cookies.length === 0) {
    fail(label, "at least one Set-Cookie", "no Set-Cookie header, so the session half cannot run");
  }

  return cookies.join("; ");
}

async function assertRoute(check: Check, cookie: string): Promise<void> {
  const label = `GET ${check.path} (${check.session ? "signed in" : "anonymous"})`;

  const response = await fetch(`${BASE_URL}${check.path}`, {
    headers: check.session ? { Cookie: cookie } : {},
    redirect: "manual",
  });

  const location = response.headers.get("location");
  const expected = check.location === undefined ? String(check.status) : `${check.status} -> ${check.location}`;

  if (response.status !== check.status || (check.location !== undefined && location !== check.location)) {
    fail(label, expected, describe(response.status, location));
  }

  process.stdout.write(`  ${label}: ${expected}\n`);
}

// Credentials are required, not optional. Running only the anonymous half and reporting success
// would hide the three rows carrying this slice's actual outcome -- a swallowed failure with nothing
// to notice it by, which context/foundation/lessons.md forbids.
if (!EMAIL || !PASSWORD) {
  process.stderr.write(
    "verify-entry-routing: VERIFY_EMAIL and VERIFY_PASSWORD must be set -- the signed-in half of the matrix needs a real session.\n",
  );
  process.exit(1);
}

process.stdout.write(`verify-entry-routing: ${BASE_URL}\n`);

const cookie = await signIn(EMAIL, PASSWORD);

for (const check of CHECKS) {
  await assertRoute(check, cookie);
}

process.stdout.write(`verify-entry-routing: all ${String(CHECKS.length + 1)} assertions passed\n`);
