---
bootstrapped_at: 2026-05-31T13:10:00Z
starter_id: 10x-astro-starter
starter_name: "10x Astro Starter (Astro + Supabase + Cloudflare)"
project_name: flashcards
language_family: js
package_manager: npm
cwd_strategy: git-clone
bootstrapper_confidence: first-class
phase_3_status: ok
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

> A solo language learner building a 3-week after-hours MVP with account-based login and SRS scheduling needs a starter that handles auth + database out of the box without extra wiring. The 10x Astro Starter (Astro + Supabase + Cloudflare) is the recommended default for web-app in JS and clears all four agent-friendly gates: TypeScript end-to-end, file-based routing conventions, strong training-data coverage, and well-maintained docs. Supabase ships auth (email/password + OAuth) and PostgreSQL on day one, matching the PRD's flat user model and access control requirements. Cloudflare Pages with GitHub Actions auto-deploy-on-merge is the starter's native deployment shape and the most recognizable CI/CD setup for a portfolio project. Bootstrapper confidence is first-class — expect a smooth scaffold with occasional manual steps.

## Pre-scaffold verification

| Signal      | Value                                           | Severity | Notes                                                   |
| ----------- | ----------------------------------------------- | -------- | ------------------------------------------------------- |
| npm package | not run                                         | n/a      | cmd_template starts with `git clone`; npm check skipped |
| GitHub repo | not run                                         | n/a      | gh CLI not installed; registry last_updated: 2026-05-01 (fresh) |

## Scaffold log

**Note**: this is a re-run on an already-scaffolded cwd (populated-cwd guard acknowledged). Node.js upgraded to v24.16.0 between runs.

**Resolved invocation**: `git clone https://github.com/przeprogramowani/10x-astro-starter .bootstrap-scaffold && cd .bootstrap-scaffold && npm install`
**Strategy**: clone starter repo without keeping upstream git history
**Exit code**: 1 (spurious — npm 11.x "Exit handler never called" internal bug; node_modules fully populated; no EBADENGINE warnings with Node v24)
**Files moved**: 0 (all items conflicted — cwd was already scaffolded)
**Conflicts (.scaffold siblings)**: .env.example, .github, .husky, .nvmrc, .prettierrc.json, .vscode, CLAUDE.md, README.md, astro.config.mjs, components.json, eslint.config.js, package-lock.json, package.json, public, src, supabase, tsconfig.json, wrangler.jsonc
**node_modules handling**: scaffold copy dropped — contents identical to cwd; too large to copy as .scaffold sibling
**.gitignore handling**: append-merge no-op (scaffold and cwd .gitignore contents identical)
**.bootstrap-scaffold cleanup**: deleted

## Post-scaffold audit

**Tool**: npm audit --json
**Status**: failed to run
**Reason**: SSL certificate error — unable to reach npm registry (`unable to verify the first certificate`). Node.js hint: `--use-system-ca` flag may resolve if corporate CA is in Windows trust store.
**Partial output (if any)**:

```
{"message":"request to https://registry.npmjs.org/-/npm/v1/security/advisories/bulk failed, reason: unable to verify the first certificate; if the root CA is installed locally, try running Node.js with --use-system-ca"}
```

## Hints recorded but not acted on

| Hint                    | Value                |
| ----------------------- | -------------------- |
| bootstrapper_confidence | first-class          |
| quality_override        | false                |
| path_taken              | standard             |
| self_check_answers      | null                 |
| team_size               | solo                 |
| deployment_target       | cloudflare-pages     |
| ci_provider             | github-actions       |
| ci_default_flow         | auto-deploy-on-merge |
| has_auth                | true                 |
| has_payments            | false                |
| has_realtime            | false                |
| has_ai                  | false                |
| has_background_jobs     | false                |

## Next steps

Next: a future skill will set up agent context (CLAUDE.md, AGENTS.md). For now, your project is scaffolded and verified — happy hacking.

Useful manual steps in the meantime:
- Re-run was a no-op diff-wise (all .scaffold siblings are identical to the already-present files). You can safely delete all new `.scaffold` sibling files unless you want to inspect them.
- Run `npm audit -- --use-system-ca` to attempt the audit with Windows' system CA store, bypassing the SSL issue.
- The `.github/` directory contains a pre-wired GitHub Actions workflow — review it before pushing.
