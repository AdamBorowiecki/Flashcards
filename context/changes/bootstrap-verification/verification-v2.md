---
bootstrapped_at: 2026-06-01T04:57:29Z
starter_id: 10x-astro-starter
starter_name: "10x Astro Starter (Astro + Supabase + Cloudflare)"
project_name: flashcards
language_family: js
package_manager: npm
cwd_strategy: git-clone
bootstrapper_confidence: first-class
phase_3_status: failed
audit_command: "npm audit --json"
---

## Hand-off

```yaml
starter_id: 10x-astro-starter
package_manager: npm
project_name: flashcards
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-pages
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: false
  has_background_jobs: false
```

### Why this stack

A solo language learner building a 3-week after-hours MVP with account-based login and SRS scheduling needs a starter that handles auth + database out of the box without extra wiring. The 10x Astro Starter (Astro + Supabase + Cloudflare) is the recommended default for web-app in JS and clears all four agent-friendly gates: TypeScript end-to-end, file-based routing conventions, strong training-data coverage, and well-maintained docs. Supabase ships auth (email/password + OAuth) and PostgreSQL on day one, matching the PRD's flat user model and access control requirements. Cloudflare Pages with GitHub Actions auto-deploy-on-merge is the starter's native deployment shape and the most recognizable CI/CD setup for a portfolio project. Bootstrapper confidence is first-class — expect a smooth scaffold with occasional manual steps.

## Pre-scaffold verification

| Signal      | Value    | Severity | Notes                                              |
| ----------- | -------- | -------- | -------------------------------------------------- |
| npm package | not run  | n/a      | cmd_template starts with `git clone` — skipped     |
| GitHub repo | not run  | n/a      | `gh` CLI not available on this machine             |

## Scaffold log

**Resolved invocation**: `git clone https://github.com/przeprogramowani/10x-astro-starter .bootstrap-scaffold && cd .bootstrap-scaffold && npm install`
**Strategy**: git-clone (clone starter repo, strip its history, apply conflict matrix)
**Exit code**: 1

**Stderr (last 20 lines)**:

```
http fetch GET https://registry.npmjs.org/yargs-parser/-/yargs-parser-22.0.0.tgz attempt 3 failed with UNABLE_TO_VERIFY_LEAF_SIGNATURE
http fetch GET https://registry.npmjs.org/y18n/-/y18n-5.0.8.tgz attempt 3 failed with UNABLE_TO_VERIFY_LEAF_SIGNATURE
http fetch GET https://registry.npmjs.org/zod-validation-error/-/zod-validation-error-4.0.2.tgz attempt 3 failed with UNABLE_TO_VERIFY_LEAF_SIGNATURE
http fetch GET https://registry.npmjs.org/yaml/-/yaml-2.8.4.tgz attempt 3 failed with UNABLE_TO_VERIFY_LEAF_SIGNATURE
http fetch GET https://registry.npmjs.org/wrangler/-/wrangler-4.90.0.tgz attempt 3 failed with UNABLE_TO_VERIFY_LEAF_SIGNATURE
http fetch GET https://registry.npmjs.org/ws/-/ws-8.18.0.tgz attempt 3 failed with UNABLE_TO_VERIFY_LEAF_SIGNATURE
http fetch GET https://registry.npmjs.org/youch-core/-/youch-core-0.3.3.tgz attempt 3 failed with UNABLE_TO_VERIFY_LEAF_SIGNATURE
http fetch GET https://registry.npmjs.org/yocto-queue/-/yocto-queue-1.2.2.tgz attempt 3 failed with UNABLE_TO_VERIFY_LEAF_SIGNATURE
http fetch GET https://registry.npmjs.org/yaml-language-server/-/yaml-language-server-1.20.0.tgz attempt 3 failed with UNABLE_TO_VERIFY_LEAF_SIGNATURE
http fetch GET https://registry.npmjs.org/yallist/-/yallist-3.1.1.tgz attempt 3 failed with UNABLE_TO_VERIFY_LEAF_SIGNATURE
http fetch GET https://registry.npmjs.org/y18n/-/y18n-5.0.8.tgz attempt 3 failed with UNABLE_TO_VERIFY_LEAF_SIGNATURE
http fetch GET https://registry.npmjs.org/zod-validation-error/-/zod-validation-error-4.0.2.tgz attempt 3 failed with UNABLE_TO_VERIFY_LEAF_SIGNATURE
http fetch GET https://registry.npmjs.org/zwitch/-/zwitch-2.0.4.tgz attempt 3 failed with UNABLE_TO_VERIFY_LEAF_SIGNATURE
http fetch GET https://registry.npmjs.org/zod/-/zod-4.4.3.tgz attempt 3 failed with UNABLE_TO_VERIFY_LEAF_SIGNATURE
http fetch GET https://registry.npmjs.org/yargs-parser/-/yargs-parser-22.0.0.tgz attempt 3 failed with UNABLE_TO_VERIFY_LEAF_SIGNATURE
http fetch GET https://registry.npmjs.org/youch/-/youch-4.1.0-beta.10.tgz attempt 3 failed with UNABLE_TO_VERIFY_LEAF_SIGNATURE
http fetch GET https://registry.npmjs.org/yargs/-/yargs-17.7.2.tgz attempt 3 failed with UNABLE_TO_VERIFY_LEAF_SIGNATURE
http fetch GET https://registry.npmjs.org/yaml/-/yaml-2.8.4.tgz attempt 3 failed with UNABLE_TO_VERIFY_LEAF_SIGNATURE
http fetch GET https://registry.npmjs.org/wrangler/-/wrangler-4.90.0.tgz attempt 3 failed with UNABLE_TO_VERIFY_LEAF_SIGNATURE
error Exit handler never called!
```

**.bootstrap-scaffold left in place at**: `.bootstrap-scaffold/`

**Root cause**: `UNABLE_TO_VERIFY_LEAF_SIGNATURE` on all npm registry fetches — SSL certificate verification failure, likely a corporate proxy or custom CA not trusted by Node 24. The git clone itself succeeded; only the `npm install` step failed. The existing `node_modules/` in cwd (from the prior successful bootstrap run) was installed under different SSL conditions.

## Post-scaffold audit

**Audit not run**: scaffold halted at the install step; no project to audit.

## Hints recorded but not acted on

| Hint                    | Value              |
| ----------------------- | ------------------ |
| bootstrapper_confidence | first-class        |
| quality_override        | false              |
| path_taken              | standard           |
| self_check_answers      | null               |
| team_size               | solo               |
| deployment_target       | cloudflare-pages   |
| ci_provider             | github-actions     |
| ci_default_flow         | auto-deploy-on-merge |
| has_auth                | true               |
| has_payments            | false              |
| has_realtime            | false              |
| has_ai                  | false              |
| has_background_jobs     | false              |

## Next steps

The scaffold halted because `npm install` could not reach the registry over SSL. **Before re-invoking `/10x-bootstrapper`**:

1. Fix the SSL issue — choose one approach:
   - `npm config set strict-ssl false` (quick, reduces security — OK for a local dev machine behind a corporate proxy)
   - Add the proxy's CA cert to your system trust store, then `npm config set cafile <path>`
   - If `NODE_TLS_REJECT_UNAUTHORIZED=0` worked before: set it for the install step only
2. Delete `.bootstrap-scaffold/` once the SSL issue is resolved (or leave it — bootstrapper will detect and warn on re-run).
3. Re-invoke `/10x-bootstrapper`.

Note: the existing `node_modules/` in cwd came from the **prior** successful bootstrap run. That run's scaffold files are the `.scaffold` siblings you see in the project root. The project structure is already in place — the current failure only affects whether you can re-scaffold cleanly into a fresh temp dir.
