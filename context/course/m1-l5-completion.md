# Raport zgodności — M1 L5 „Od localhost po produkcję"

> Audyt wykonany: **2026-08-12** · Aktualizacja: **2026-08-18** · Branch: `feature/doLesson4again` · HEAD: `f93c81a`
> Źródło: `m1-l5-od-localhost-po-produkcje-deployment-z-agentem.md`
>
> **Werdykt: lekcja domknięta w ~90%.** Wszystkie trzy zadania praktyczne mają artefakt
> w repo, aplikacja jest **żywa na produkcji** (ponownie zweryfikowane 2026-08-18:
> `/` → 200, `/dashboard` → 302). Nie domknięte: ręczny przejazd auth w przeglądarce
> i allowlist URL w Supabase — oba wymagają człowieka przy przeglądarce.
>
> **Zmiana 2026-08-18:** `gh` zainstalowany i uwierzytelniony — „Przygotowania do wdrożenia"
> są kompletne (4/4).

---

## 1. Zadania praktyczne

### ✅ Zadanie 1 — Research platformy (`/10x-infra-research`)

| Wymóg lekcji                                       | Dowód w repo                                                                  | Status |
| -------------------------------------------------- | ----------------------------------------------------------------------------- | ------ |
| Uruchomić skill z `tech-stack.md` jako wsadem      | commit `cdf3403` „after /10x-infra-research context/foundation/tech-stack.md" | ✅     |
| Wywiad (region, długie procesy, budżet, portfolio) | `infrastructure.md:23` — odpowiedzi Q1–Q5 wprost przełożone na wagi           | ✅     |
| Scoring Pass/Partial/Fail po 5 kryteriach          | `infrastructure.md:25-32` — tabela 6 platform × 5 kryteriów                   | ✅     |
| Devil's advocate                                   | `infrastructure.md:59-66` — 5 ponumerowanych konkretów                        | ✅     |
| Pre-mortem                                         | `infrastructure.md:68-69` — narracja ~170 słów                                | ✅     |
| Unknown unknowns                                   | `infrastructure.md:71-77` — 5 pozycji                                         | ✅     |
| Decyzja po cross-checku                            | „proceed with leader" — Cloudflare Workers, ryzyka wchłonięte do rejestru     | ✅     |

**Ponad wymagania:** anti-bias realnie zadziałał, a nie był rytuałem — unknown unknowns
wyłapały, że `deployment_target: cloudflare-pages` jest **stale** (adapter v13 to Workers-only).
To zmieniło komendy deployu. Poprawka została wdrożona: `tech-stack.md:7` czyta dziś
`cloudflare-workers`, czyli krok 5 z sekcji „Getting Started" jest odhaczony.

### ✅ Zadanie 2 — Plan deploymentu (Plan Mode)

| Wymóg lekcji                                          | Dowód w repo                                                                              | Status |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------ |
| Plan powstał w Plan Mode i został oceniony/poprawiony | commity `db7cc06` → `5a5616c` („after Please extend plan with prerequisite…") → `6b8cef7` | ✅     |
| Kroki automatyczne agenta                             | `deployment-plan.md:103-145` — sekcja „Execution steps"                                   | ✅     |
| Konta / serwisy do konfiguracji ręcznej               | `deployment-plan.md:21-88` — Wrangler, Supabase, toolchain                                | ✅     |
| Lista sekretów                                        | `deployment-plan.md:114-122` — `SUPABASE_URL`, `SUPABASE_KEY` przez `wrangler secret put` | ✅     |
| Właściwe komendy (Pages ≠ Workers!)                   | `deployment-plan.md:133` — `wrangler deploy`, **nie** `wrangler pages deploy`             | ✅     |
| Kryterium ukończenia                                  | `deployment-plan.md:165-169` — „Done = all true", 3 punkty                                | ✅     |

**⚠️ Odstępstwo od lekcji (świadome):** lekcja mówi `context/deployment/deploy-plan.md`,
u ciebie plan leży w **`context/changes/deployment/deployment-plan.md`**. To zgodne
z konwencją `context/README.md` (dokument przypisany do jednej zmiany), więc jest lepsze
niż literalne trzymanie się lekcji — ale warto o tym pamiętać, bo lekcja 6 będzie
karmić agenta ścieżką z lekcji. Wystarczy wtedy podać własną ścieżkę.

### ⚠️ Zadanie 3 — Pierwsze wdrożenie

**Przygotowania (4 punkty z lekcji):**

| Punkt                            | Stan                                                                                                                                                       | Status |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Konto Cloudflare                 | `adamborowiecki1990@gmail.com`, Account ID `59fae5f1…`                                                                                                     | ✅     |
| Wrangler + `wrangler login`      | OAuth token, `whoami` potwierdzone (`resume-checklist.md:112-114`)                                                                                         | ✅     |
| Konto Supabase + baza            | projekt żywy, `/auth/v1/health` → 200                                                                                                                      | ✅     |
| **GitHub CLI + `gh auth login`** | v2.97.0 (winget, user scope) — `gh auth status`: zalogowany jako `AdamBorowiecki`, keyring, HTTPS, scopes `gist`/`read:org`/`repo`/`workflow` (2026-08-18) | ✅     |

**Wdrożenie i weryfikacja:**

| Punkt                                                                          | Dowód                                                                             | Status |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- | ------ |
| `wrangler deploy` przeszedł                                                    | `deployment-plan.md:173-176` — 2026-06-21, version `66b6ef2b…`                    | ✅     |
| Publiczny URL                                                                  | <https://flashcards.adamborowiecki1990.workers.dev>                               | ✅     |
| **Aplikacja żyje dziś**                                                        | sprawdzone 2026-08-12: `/` → **200**, `/dashboard` → **302**                      | ✅     |
| Sekrety na produkcji działają                                                  | `POST /api/auth/signin` zwraca błąd **z Supabase**, nie z gałęzi `if (!supabase)` | ✅     |
| Supabase → URL Configuration (Site URL + Redirect URLs)                        | `resume-checklist.md:64-70` — **niezweryfikowane w panelu**                       | ❌     |
| **Ręczny przejazd w przeglądarce** (rejestracja → mail → login → `/dashboard`) | `resume-checklist.md:144-148` — pending                                           | ❌     |
| Pochwalenie się URL-em na 10xDevs Arena                                        | brak śladu w repo (nie da się sprawdzić)                                          | ❓     |

Formalnie kryterium „Done = all true" z twojego własnego planu **nie jest jeszcze spełnione** —
punkt 3 (realne logowanie w przeglądarce z trwałą sesją) zostaje otwarty. To dokładnie ten
punkt, który weryfikuje Ryzyko R3 z `infrastructure.md` (`@supabase/ssr` na `workerd`),
więc nie jest to formalność — to jedyny test, który sprawdza rzecz najbardziej podatną na awarię.

---

## 2. Elementy opcjonalne z lekcji

| Element                                 | Stan                                                                       | Uwaga                                              |
| --------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------- |
| `/10x-lesson` po drodze                 | ❌ `lessons.md` zawiera tylko domyślny wpis o feature flagach              | patrz niżej — masz gotowy materiał na 3 wpisy      |
| Deep Dive: `.mcp.json` z Cloudflare MCP | ❌ brak pliku                                                              | opcjonalne; lekcja sama rekomenduje „start od CLI" |
| Deep Dive: komendy `wrangler` / `gh`    | ✅ `wrangler` używany biegle, `gh` zainstalowany i zalogowany (2026-08-18) |                                                    |
| Deep Dive: granica dostępu agenta       | ✅ `infrastructure.md:84` — sekcja „Approval" wymienia akcje human-only    |                                                    |
| CI auto-deploy                          | ❌ świadomie poza zakresem (`deployment-plan.md:19`)                       | to jest OK — lekcja tego nie wymaga                |

---

## 3. Co domknąć (w kolejności)

1. **Ręczny przejazd w przeglądarce** — jedyny punkt, który blokuje „Done = all true".
   Wymaga wcześniej allowlisty URL w Supabase (Authentication → URL Configuration:
   Site URL + oba Redirect URLs). ~10 minut, obie rzeczy razem.
2. ~~**Zainstaluj `gh`**~~ — ✅ zrobione 2026-08-18 (winget, user scope, v2.97.0 + `gh auth login`).
   Uwaga na przyszłość: `winget install` wymaga `--source winget`, bo źródło `msstore`
   pada na korporacyjnym proxy TLS (`0x8a15005e`) i przerywa całą komendę.
3. **Dodaj 3 wpisy przez `/10x-lesson`** — masz w `deployment-plan.md` i `resume-checklist.md`
   trzy klasy błędów zapisane w prozie, które powinny być regułami dla agenta:
   - `NODE_OPTIONS="--use-system-ca"` przed każdą komendą wrangler (proxy TLS)
     - `--ssl-no-revoke` dla curl,
   - `wrangler secret list` pokazuje **nazwy, nie wartości** — obecność sekretu
     nie dowodzi poprawnej wartości,
   - pierwszy deploy na nowym koncie wymaga zarejestrowanej subdomeny `*.workers.dev`;
     w nie-TTY wrangler odpowiada „no" i przerywa.
4. _(opcjonalnie)_ `nvm use` → 22.14.0 — aktywny Node to 24.16.0, CI używa 22.

---

## 4. Ocena jakościowa

Lekcja nie została „odklikana" — została przerobiona. Trzy sygnały, że proces zadziałał
zgodnie z intencją autorów:

- **anti-bias zmienił decyzję operacyjną**, nie tylko dopisał akapit (Pages → Workers),
- **plan był poprawiany przed akceptacją** — widać to w historii commitów jako osobną iterację
  o prerequisites, czyli nie było „agent działa, ja patrzę",
- **deploy przetrwał 7 tygodni przerwy** i został przywrócony po diagnozie trzech blokerów
  (`resume-checklist.md`), co jest lepszym testem artefaktów niż sam pierwszy deploy —
  dokumentacja okazała się wystarczająca, żeby wrócić do projektu po długiej przerwie.

Otwarte punkty są wąskie i wszystkie wymagają człowieka przy przeglądarce.
