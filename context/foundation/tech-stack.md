---
starter_id: 10x-astro-starter
package_manager: npm
project_name: flashcards
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-workers
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
---

## Why this stack

A solo language learner building a 3-week after-hours MVP with account-based login and SRS scheduling needs a starter that handles auth + database out of the box without extra wiring. The 10x Astro Starter (Astro + Supabase + Cloudflare) is the recommended default for web-app in JS and clears all four agent-friendly gates: TypeScript end-to-end, file-based routing conventions, strong training-data coverage, and well-maintained docs. Supabase ships auth (email/password + OAuth) and PostgreSQL on day one, matching the PRD's flat user model and access control requirements. Cloudflare Pages with GitHub Actions auto-deploy-on-merge is the starter's native deployment shape and the most recognizable CI/CD setup for a portfolio project. Bootstrapper confidence is first-class — expect a smooth scaffold with occasional manual steps.
