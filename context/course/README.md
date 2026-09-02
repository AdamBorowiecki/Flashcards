# Course Material

Materiały źródłowe kursu (10xDevs) — **wsad zewnętrzny**, nie kontrakt projektu.

## Czym to różni się od reszty `context/`

| Folder                | Co tam mieszka                                                      | Kto pisze                          |
| --------------------- | ------------------------------------------------------------------- | ---------------------------------- |
| `context/foundation/` | kontrakty projektu (`prd.md`, `tech-stack.md`, `infrastructure.md`) | skille                             |
| `context/changes/`    | dokumenty przypisane do jednej zmiany (plan, research, review)      | skille + człowiek                  |
| `context/course/`     | **treść lekcji + raporty zgodności**                                | człowiek (wklejka) + agent (audyt) |

Materiał kursu nie jest edytowany przez skille i nie jest źródłem prawdy o projekcie —
jest **punktem odniesienia**, po którym sprawdzamy, czy lekcja została domknięta.

## Konwencja nazw

```
m<moduł>-l<lekcja>-<slug>.md        # treść lekcji (wklejka, surowa)
m<moduł>-l<lekcja>-completion.md    # raport zgodności wygenerowany przez agenta
```

Przykład: `m1-l5-od-localhost-po-produkcje-deployment-z-agentem.md`
→ `m1-l5-completion.md`.

## Jak zrobić audyt lekcji

1. Wklej treść lekcji do pliku zgodnie z konwencją.
2. Poproś agenta: _„sprawdź zgodność z lekcją m1-l5"_.
3. Agent wyciąga z lekcji wymagane kroki i artefakty, konfrontuje je z faktycznym
   stanem repo (pliki, historia gita, stan wdrożenia, CLI) i zapisuje wynik
   w `m<moduł>-l<lekcja>-completion.md` jako tabelę
   `wymóg lekcji → dowód w repo → ✅ / ⚠️ / ❌`.

## Zasady

- **Nie edytuj plików z treścią lekcji.** To wklejka — ma zostać wierna źródłu,
  żeby kolejny audyt porównywał się z tym samym materiałem.
- **Raporty zgodności są datowane w treści** i nadpisywane przy ponownym audycie
  (edit-in-place, jak w `foundation/`).
- Materiał kursu **nie jest wsadem dla skilli** — żaden skill nie czyta tego folderu.
