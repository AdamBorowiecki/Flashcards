# Raport zgodności — M2 L2 „From Roadmap to Code: Plan, Review, Implement"

> Audyt wykonany: **2026-09-06** · Branch: `feature/m2l2` · HEAD: `d868b57`
> Źródło: `m2-l2-from-roadmap-to-code-plan-review-implement.md`
>
> **Werdykt: lekcja domknięta.** Oba zadania praktyczne mają artefakty w repo, a checkpoint
> z sekcji „Checkpoint progress" jest spełniony z nadmiarem — nie jedna zaimplementowana faza,
> ale **cztery**, w dwóch osobnych zmianach, każda z commitem i SHA w `## Progress`.
>
> Niedomknięte świadomie: fazy wdrożeniowe (F-01 faza 3, S-01 fazy 3–4). Lekcja ich nie wymaga
> — wprost dopuszcza checkpoint zamiast pełnego slice'a i ostrzega przed robieniem z niej
> „full end-to-end product build". Blokuje je interaktywne `supabase login`, nie brak pracy.

---

## 1. Checkpoint lekcji

| Wymóg lekcji                            | Dowód w repo                                                                                    | Status |
| --------------------------------------- | ----------------------------------------------------------------------------------------------- | ------ |
| Wybrany stream z roadmapy               | F-01 → S-01, ścieżka Stream A; `roadmap.md:44-45`                                               | ✅     |
| Folder zmiany dla konkretnej zmiany     | `context/changes/card-store-with-owner-isolation/`, `context/changes/seed-deck-on-first-login/` | ✅     |
| `plan.md` i `plan-brief.md`             | oba pliki w obu folderach zmian                                                                 | ✅     |
| Plan po review                          | `reviews/plan-review.md` w obu folderach                                                        | ✅     |
| Co najmniej jedna zaimplementowana faza | cztery: `6815f1d`, `e96c447`, `c19a258`, `83531c5`                                              | ✅     |
| Zaktualizowany `## Progress`            | 12/12 pozycji F-01 fazy 1–2 i S-01 fazy 1–2, każda z SHA                                        | ✅     |

## 2. Zadania praktyczne

### ✅ Zadanie 1 — Zaplanuj jeden slice z roadmapy

| Wymóg lekcji                                   | Dowód w repo                                                                   | Status |
| ---------------------------------------------- | ------------------------------------------------------------------------------ | ------ |
| `/10x-plan <change-id>`                        | uruchomione dla `card-store-with-owner-isolation` i `seed-deck-on-first-login` | ✅     |
| Podział na fazy dające się osobno zweryfikować | F-01: 3 fazy; S-01: 4 fazy, każda z własnymi Success Criteria                  | ✅     |
| End state                                      | `## Desired End State` w obu planach, ze sposobem weryfikacji                  | ✅     |
| Intent + Contract per plik                     | `#### N. <plik>` z `**Intent**` i `**Contract**` w każdej fazie                | ✅     |
| Success Criteria                               | rozbite na `#### Automated Verification` / `#### Manual Verification`          | ✅     |
| Risks / Open Questions                         | `## Open Risks & Assumptions` w obu briefach; OQ5 utrzymane jako otwarte       | ✅     |
| `## Progress`                                  | jedna sekcja na dole planu, format zgodny z `references/progress-format.md`    | ✅     |
| `plan-brief.md` jako lekki hand-off            | oba, z tabelą „Key Decisions Made"                                             | ✅     |

**Ponad wymagania:** planowanie S-01 nie opierało się na założeniach. Mechanizm — trigger
`security definer` na `auth.users` — został **zaprototypowany na działającej lokalnej bazie
przed napisaniem planu**, razem ze ścieżką błędu: celowo zepsuty seed zostawił konto
utworzone, talię pustą i ostrzeżenie w logu. Dwa nośne twierdzenia planu są więc zmierzone,
a nie opisane z pamięci.

### ✅ Zadanie 2 — Zaimplementuj wybrany slice

| Wymóg lekcji                             | Dowód w repo                                                                                            | Status |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------ |
| `/10x-implement <change-id> phase N`     | S-01 fazy 1 i 2 przeprowadzone przez skill                                                              | ✅     |
| Agent trzyma się jednej fazy             | commity `c19a258` (p1) i `83531c5` (p2) rozdzielone, bez przecieku zakresu                              | ✅     |
| Raportuje zmodyfikowane pliki            | ciało każdego commita wymienia dotknięte pliki                                                          | ✅     |
| Uruchamia ustalone komendy weryfikacyjne | `npm run build`, `supabase db reset`, `migration list --local`, oba skrypty SQL                         | ✅     |
| Zatrzymuje się przy bramce manualnej     | bramka przed commitem w obu fazach; pozycje manualne odhaczone dopiero po potwierdzeniu przez człowieka | ✅     |
| Zapisuje SHA w `## Progress`             | każda pozycja niesie ` — <sha>`                                                                         | ✅     |

### ✅ Plan review przed kodem

| Wymóg lekcji                                     | Dowód w repo                                                   | Status |
| ------------------------------------------------ | -------------------------------------------------------------- | ------ |
| `/10x-plan-review <change-id>`                   | `reviews/plan-review.md` w obu folderach zmian                 | ✅     |
| Review realnie łapie problemy, nie jest rytuałem | S-01: werdykt REVISE, 4 findings, wszystkie naprawione → SOUND | ✅     |

**To nie było odklepanie.** Review S-01 znalazł błąd krytyczny **we własnym planie agenta**:
seedowanie deterministycznie psuło `supabase/tests/cards_rls.sql` (asercja „exactly 1 card"
dostawała 11), a plan wymagał, żeby ten test dalej przechodził — kryterium niewykonalne.
Zostało to zmierzone, nie wydedukowane, i naprawione przed napisaniem choćby linijki migracji.
Dokładnie ten moment, o który lekcji chodzi: _„This is the cheapest moment for a correction."_

## 3. Łańcuch skilli

`/10x-roadmap` → `/10x-new` → `/10x-plan` → `/10x-plan-review` → `/10x-implement` — przeszedł
w całości dla obu zmian. Statusy pilnowane po drodze: `change.md` idzie
`planned → plan_reviewed → implementing`, a `roadmap.md` S-01 `proposed → planning → in-progress`.

Zgodnie z granicami lekcji **nie** użyto `/10x-frame` ani `/10x-research` — obie zmiany były
na tyle zrozumiałe, że nie wymagały eskalacji. To jest zachowanie, o które lekcja prosi
(„Do not run `/10x-frame` + `/10x-research` as ceremony for every change"), a nie brak.

## 4. Odstępstwa

### ⚠️ F-01 faza 2 wykonana ręcznie, nie przez `/10x-implement`

Sesja została wznowiona po restarcie systemu (instalacja Dockera) i faza 2 F-01 poszła
bezpośrednio — weryfikacja, bramka manualna, commit i write-back SHA odtworzyły rytuał, ale
skill nie został wywołany. Zadanie praktyczne lekcji mówi dosłownie „Run `/10x-implement`".
Efekt zgodny, droga inna. **Naprawione przy S-01**, gdzie obie fazy przeszły przez skill.

### ⚠️ `/10x-impl-review` niedostępny

Po fazie 1 S-01 padła prośba o review implementacji. Skill nie jest zainstalowany — przychodzi
z lekcją 3, co `CLAUDE.md` §Lesson boundaries zapowiada. Przegląd wykonano ręcznie przeciw
kontraktowi z planu (8 pozycji, wszystkie zgodne) plus jedna obserwacja niekrytyczna:
`public.starter_deck()` ma domyślny `EXECUTE` dla `PUBLIC`. Zostawione świadomie — funkcja
zwraca statyczne słownictwo.

### ℹ️ Fazy wdrożeniowe odroczone

F-01 faza 3 (`supabase link` + `db push`) i S-01 fazy 3–4 (licznik na dashboardzie, push)
nie zostały wykonane. Blokada: `npx supabase login` jest interaktywne i wymaga człowieka przy
przeglądarce. Lekcja tego nie wymaga i wprost ostrzega przed rozdmuchiwaniem jej do pełnego
produktu. Chmura nie ma jeszcze tabeli `cards`, więc S-01 faza 4 jest za F-01 fazą 3.

## 5. Przeszkody środowiskowe (do zapamiętania)

Dwie rzeczy zablokowały lokalny stack Supabase na tej maszynie i żadna nie jest opisana
w `README.md`:

- **Porty zarezerwowane przez WinNAT.** Cały zakres Supabase (54320–54329) wpadał w pulę
  54291–54390 zaklepaną dynamicznie przez Hyper-V. Nic tam nie nasłuchiwało — to była
  rezerwacja. Rozwiązanie bez zmian w repo: `net stop winnat` / `net start winnat` z prawami
  administratora. Pule przydzielają się losowo przy starcie systemu, więc może wrócić.
- **`edge-runtime` nie wstaje.** Kontener pobiera `deno.land` i dostaje
  `invalid peer certificate: UnknownIssuer` (proxy podmieniające certyfikaty). Health check
  wywala cały start. Obejście bez zmian w repo: `npx supabase start -x edge-runtime`.
  Projekt nie używa Edge Functions, więc nic to nie kosztuje.

## 6. Co powstało poza dokumentami

| Plik                                                        | Rola                                                                     |
| ----------------------------------------------------------- | ------------------------------------------------------------------------ |
| `supabase/migrations/20260905163222_create_cards_table.sql` | Tabela `cards`, RLS, cztery polityki, indeks pod kolejkę due             |
| `supabase/migrations/20260906133232_seed_starter_deck.sql`  | Talia startowa, trigger na `auth.users`, backfill z guardem              |
| `supabase/tests/cards_rls.sql`                              | Wykonywalny dowód izolacji między uczącymi się                           |
| `supabase/tests/seed_deck.sql`                              | Wykonywalny dowód seedowania: raz, poprawnie, bez blokowania rejestracji |

Oba skrypty testowe niosą w nagłówku zapis **co dokładnie łapią, a czego nie** — ustalony przez
celowe psucie każdej polityki po kolei. Dwa niepokrycia zostały udokumentowane zamiast
przemilczane: w `cards_rls.sql` złamanie samej polityki UPDATE nie wywala nic (izolację niesie
`cards_select_own`, stosowane też do wiersza po zmianie), a w `seed_deck.sql` guard wewnątrz
funkcji triggera jest nieosiągalny w normalnym działaniu.

## 7. Co dalej

1. `npx supabase login` → F-01 faza 3 → S-01 fazy 3–4
2. Open Roadmap Question 5 (schemat SRS) — blokuje S-02, wymaga dedykowanego researchu z lekcji 4
3. `/10x-archive` dla obu zmian po domknięciu
