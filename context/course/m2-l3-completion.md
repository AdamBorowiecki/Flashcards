# Raport zgodności — M2 L3 „Solo Code Review: Verify AI Code Quickly and Effectively"

> Audyt wykonany: **2026-09-06** · Branch: `feature/m2l2` · HEAD: `a1989dd`
> Źródło: `m2-l3-solo-code-review-verify-ai-code-quickly-and-effectively.md`
>
> **Werdykt: lekcja domknięta.** Oba zadania praktyczne wykonane na realnym kodzie z poprzedniej
> lekcji. Review nie było ćwiczeniem — znalazło niezaplanowany endpoint dostępny bez
> uwierzytelnienia, a wszystkie trzy decyzje triage'u trafiły dokładnie tam, gdzie wskazuje
> macierz severity × impact z lekcji.

---

## 1. Zadania praktyczne

### ✅ Zadanie 1 — Uruchom implementation review

| Wymóg lekcji                                      | Dowód w repo                                                                       | Status |
| ------------------------------------------------- | ---------------------------------------------------------------------------------- | ------ |
| Pakiet `m2l3` zainstalowany                       | commit `b54a9da`; `.claude/skills/10x-impl-review/`                                | ✅     |
| `/10x-impl-review` na kodzie z poprzedniej lekcji | uruchomione na `seed-deck-on-first-login`, fazy 1–2 (commity `c19a258`, `83531c5`) | ✅     |
| Pełny scorecard sześciu wymiarów                  | `reviews/impl-review.md` — tabela Verdicts, 6/6 wymiarów ocenionych                | ✅     |
| Przeczytane findings i decyzja wg heurystyk       | 3 findings, każdy z decyzją zapisaną w raporcie                                    | ✅     |

Kryteria sukcesu z planu zostały **przebiegnięte ponownie** w trakcie review, nie przepisane
z pamięci: build, `db reset`, `migration list --local` oraz oba skrypty SQL — 6/6 przeszło.
Sprawdzono też, czy pozycje manualne nie są odklepane: każda ma obserwowalny ślad w diffie
albo w zapisanym wyniku przebiegu.

### ✅ Zadanie 2 — Triage finding po findingu

| Finding | Severity × Impact          | Co mówi macierz z lekcji             | Decyzja              | Zgodne |
| ------- | -------------------------- | ------------------------------------ | -------------------- | ------ |
| F1      | ⚠️ Warning × 🏃 Low        | „Fix or skip"                        | **Fix now**          | ✅     |
| F2      | 💡 Observation × 🔎 Medium | „Leave a note or rule (/10x-lesson)" | **Record as lesson** | ✅     |
| F3      | 💡 Observation × 🏃 Low    | „Usually skip"                       | **Skip**             | ✅     |

Lekcja wymaga wprost: _„Write down the justification for at least one skip or dismiss"_.
Uzasadnienie F3 jest zapisane w raporcie: guard zostaje jako zabezpieczenie na przyszłego
wołającego, a fakt że jest nieosiągalny w normalnym działaniu — i że mutation test tego dowiódł —
jest już udokumentowany w nagłówku `supabase/tests/seed_deck.sql`, więc nikt go w przyszłości
nie weźmie za przetestowany.

Reguła z F2 wylądowała w `context/foundation/lessons.md` jako **„A swallowed failure needs
a defined way to be noticed"**. Po zapisaniu reguły padło osobne pytanie, czy poprawić też kod —
świadoma odpowiedź brzmiała nie, reguła obowiązuje na przyszłość.

## 2. Co review realnie znalazło

**F1 — `starter_deck()` dostępna po HTTP bez uwierzytelnienia.** Funkcja powstała bez `revoke`,
a `public` jest schematem wystawianym przez PostgREST, więc trafiła do API jako
`POST /rest/v1/rpc/starter_deck`. Zmierzone samym kluczem anon: **HTTP 200 i cała talia**.
Kontrola na `GET /rest/v1/cards` zwracała `200 []`, co dowodzi, że RLS na tabeli trzymał —
to nie była dziura w politykach, tylko powierzchnia API, o której nikt nie zdecydował.

Danych użytkowników to nie wystawiało (dziesięć statycznych słówek), ale stało wprost przeciw
regule `AGENTS.md:8`. Naprawione w commicie `a1989dd`, przed fazą 4, która wypchnęłaby tę funkcję
do chmury.

**Warte odnotowania: pierwsza poprawka wyglądała na skuteczną i nie była.**
`revoke execute … from public` wykonał się bez błędu, a endpoint dalej zwracał 200 — bo Supabase
nadaje `EXECUTE` **jawnie rolom** `anon`, `authenticated` i `service_role` przez default
privileges, a revoke z PUBLIC ich nie rusza. Wyszło to dopiero po sprawdzeniu `proacl` i powtórzeniu
curla. Bez tej weryfikacji finding zostałby zamknięty jako naprawiony przy nadal otwartej dziurze.
To jest dokładnie ten rodzaj fałszywej pewności, przed którym ostrzegają materiały dodatkowe lekcji.

## 3. Odstępstwa

### ℹ️ Raport zapisany od razu, triage w tej samej sesji

Lekcja rekomenduje wariant „najpierw zapisz raport, przeczytaj na spokojnie, potem wróć przez
`/10x-impl-review @ścieżka`", szczególnie przy większych zmianach. Tu triage poszedł od razu.
Uzasadnienie: diff to trzy pliki kodu i trzy findings — skala, przy której czytanie na raty
kosztuje więcej, niż daje. Raport i tak jest zapisany na dysku z decyzjami wpisanymi w pola
`Decision`, więc ścieżka wznowieniowa pozostaje dostępna.

### ℹ️ Analiza bez sub-agentów

Skill przewiduje dwa równoległe sub-agenty. Przy trzech plikach kodu analiza poszła bezpośrednio —
zimny agent odtwarzałby kontekst już posiadany. Sam skill zresztą skaluje głębokość pracy nad
wzorcami do rozmiaru diffu („if the diff changed ≤3 files, spend minimal time on patterns").
Odnotowane w sekcji Scope raportu.

## 4. Artefakty

| Plik                                                              | Rola                                       |
| ----------------------------------------------------------------- | ------------------------------------------ |
| `context/changes/seed-deck-on-first-login/reviews/impl-review.md` | Scorecard, 3 findings, decyzje triage'u    |
| `context/foundation/lessons.md`                                   | Nowa reguła z F2                           |
| `supabase/migrations/20260906133232_seed_starter_deck.sql`        | Poprawka F1 — pełny `revoke` wraz z rolami |

`change.md` → `status: impl_reviewed`.

## 5. Co dalej

M2 L4 (`research-and-implementation-a-harder-stream-with-ai`) — Open Roadmap Question 5, schemat
SRS. To ta decyzja blokuje S-02, czyli north star całego milestone'u.
