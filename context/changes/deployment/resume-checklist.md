# Flashcards — checklista wznowienia prac

> Stan sprawdzony: **2026-08-31** (czwarta weryfikacja). Branch: `feature/doLesson4again`.
> Poprzedni deploy: 2026-06-21 (szczegóły w `deployment-plan.md`).
>
> **Postęp:** ✅ **LEKCJA 5 DOMKNIĘTA.** Projekt Supabase był tylko **zapauzowany** — po
> wznowieniu `.env` i sekrety Workera okazały się **poprawne** (ref się nie zmienił,
> niewiadoma z sekcji 0b rozstrzygnięta). URL Configuration ustawione (sekcja 2), ręczny
> przejazd w przeglądarce przeszedł do końca (sekcja 5) — **Risk R3 zamknięty**.
>
> Nic z deploymentu nie zostało. Następny krok to **domena fiszek (lekcja 6)** — patrz
> sekcja 6 i uwaga w sekcji 0, że pusta aplikacja była celem lekcji 5, nie zaległością.

---

## 0c. Weryfikacja — 2026-08-31 (po ~2 tygodniach przerwy)

### ⚠️ Pułapka: zapauzowany projekt Supabase **znika z DNS**

Przy pierwszym podejściu zdiagnozowałem to błędnie jako „projekt skasowany, nowy ref".
Objawy przed wznowieniem:

```
nslookup mxljsmyaqikcglfxpbji.supabase.co  → Non-existent domain
curl $SUPABASE_URL/auth/v1/health          → exit 6 (could not resolve host)
```

**Wniosek do zapamiętania:** pauza w Supabase nie daje 503 ani timeoutu — **kasuje wpis
DNS**, co wygląda identycznie jak skasowany projekt. `Non-existent domain` **nie jest**
dowodem, że projekt przepadł. Zanim uznasz ref za nieaktualny, sprawdź w panelu, czy
projekt nie jest po prostu uśpiony. Free tier usypia po ~7 dniach bezczynności — przy tym
rytmie pracy (powroty co 2 tygodnie) to będzie się powtarzać przy **każdym** wznowieniu.

### Drugi objaw tej samej przyczyny: `?error=%7B%7D`

Przy uśpionym projekcie `POST /api/auth/signin` z błędnymi danymi zwracał
`302 → ?error=%7B%7D`, czyli dosłownie `{}`. `signin.ts:16` przekazuje `error.message`
do query stringa, a przy nieudanym fetchu supabase-js nie ma sensownego `message`.

> Warto kiedyś dorzucić fallback komunikatu w `signin.ts` / `signup.ts` — dziś użytkownik
> widzi na ekranie logowania `{}`, gdy backend jest nieosiągalny. Poza zakresem lekcji 5.

### Po wznowieniu — wszystko zielone

| Sprawdzenie                          | Wynik                                      |
| ------------------------------------ | ------------------------------------------ |
| `/`, `/auth/signin`                  | `200`                                      |
| `/dashboard` bez sesji               | `302` → `/auth/signin`                     |
| Supabase `/auth/v1/health`           | `200`                                      |
| Supabase `/auth/v1/settings`         | `200` — **klucz z `.env` nadal ważny**     |
| `POST /api/auth/signin`, błędne dane | `302` → `?error=Invalid login credentials` |

Ostatni wiersz = Worker realnie rozmawia z Supabase Auth. **Nic nie trzeba podmieniać:**
ani `.env`, ani sekretów Workera, ani deployu.

### Bez zmian

- `wrangler whoami` przechodzi — autoryzacja Cloudflare nadal ważna.
- `core.autocrlf` = `true` → `npm run lint` lokalnie nadal tonie w `␍` (sekcja 0a, niezrobione).
- Node aktywny **24.16.0** vs `.nvmrc` **22.14.0** — nadal rozjazd.
- Zakres bez zmian: brak `supabase/migrations/`, `/rest/v1/cards` → `404 PGRST205`,
  w `src/` wyłącznie auth. Zero domeny fiszek.
- Drzewo: tylko ten plik zmodyfikowany.

### Co zostaje

1. Authentication → **URL Configuration** w panelu (sekcja 2 — wciąż niezrobiona).
2. Ręczny przejazd w przeglądarce (sekcja 5).
3. Potem właściwa aplikacja (sekcja 6).

---

## 0b. Weryfikacja — 2026-08-18 (przerwana, do dokończenia)

**Zrobione:**

- `gh` v2.97.0 zainstalowany (winget, user scope) + `gh auth login` → konto `AdamBorowiecki`,
  keyring, HTTPS, scopes `gist`/`read:org`/`repo`/`workflow`. Punkt „Przygotowania do
  wdrożenia" z lekcji 5 jest kompletny (4/4).
  - ⚠️ `winget install` na tej maszynie wymaga `--source winget` — źródło `msstore` pada na
    korporacyjnym proxy TLS (`0x8a15005e`) i przerywa całą komendę.

**Produkcja nadal zielona** (`https://flashcards.adamborowiecki1990.workers.dev`):

| Sprawdzenie                          | Wynik                                                     |
| ------------------------------------ | --------------------------------------------------------- |
| `/`                                  | `200`                                                     |
| `/auth/signin`                       | `200`                                                     |
| `/dashboard` bez sesji               | `302` → `/auth/signin`                                    |
| `POST /api/auth/signin`, błędne dane | `302` → `?error=Invalid%20login%20credentials` (Supabase) |

### ⚠️ Pułapka przy sondowaniu curl-em — CSRF Astro

`POST /api/auth/signin` **bez nagłówka `Origin`** zwraca `403 Forbidden` z treścią
`Cross-site POST form submissions are forbidden`. To **ochrona CSRF Astro**
(`security.checkOrigin`, domyślnie włączona dla output server), **nie** awaria aplikacji
ani problem z sekretami. Przeglądarka zawsze wysyła `Origin`, więc realny formularz działa.

Poprawna sonda:

```bash
curl -s --ssl-no-revoke -i -X POST \
  -H "Origin: https://flashcards.adamborowiecki1990.workers.dev" \
  -H "Referer: https://flashcards.adamborowiecki1990.workers.dev/auth/signin" \
  -d "email=probe@example.com&password=definitely-wrong-1234" \
  https://flashcards.adamborowiecki1990.workers.dev/api/auth/signin
```

Oczekiwane: `302` + `Location: /auth/signin?error=Invalid%20login%20credentials`.
Ten komunikat pochodzi **z Supabase**, a nie z gałęzi `if (!supabase)` — czyli sekrety
na produkcji mają poprawne wartości.

### 🔴 OTWARTE: który projekt Supabase jest aktualny?

Użytkownik zgłosił 2026-08-18, że **postawił Supabase na nowo**. Weryfikacja nie została
dokończona. Stan faktyczny na teraz:

- `.env` wskazuje na `https://mxljsmyaqikcglfxpbji.supabase.co`, **mtime `2026-08-11 18:35`**
  — czyli plik **nie był ruszany** po odtworzeniu projektu.
- Ten projekt **żyje** i lokalny klucz do niego pasuje: `/auth/v1/health` z nagłówkiem
  `apikey` → `200`, GoTrue v2.195.0. (Bez `apikey` zwraca `401 No API key found` —
  to normalne, nie oznacza martwego projektu.)
- Produkcja rozmawia z **jakimś** działającym Supabase (patrz sonda wyżej), ale sekrety
  Workera ustawiono w czerwcu i **z zewnątrz nie da się stwierdzić, na który projekt
  wskazują** — `wrangler secret list` pokazuje tylko nazwy, nie wartości.

**Do ustalenia na starcie następnej sesji:** czy nowy projekt ma **nowy ref** (wtedy
`.env` i sekrety Workera są nieaktualne), czy user odtworzył zawartość w tym samym
projekcie `mxljsmyaqikcglfxpbji` (wtedy nic nie trzeba zmieniać).

Jeśli ref jest nowy, do zrobienia **przed** przejazdem z sekcji 5:

1. zaktualizować `.env` (`SUPABASE_URL`, `SUPABASE_KEY` — klucz **publishable**, nie `secret`),
2. `NODE_OPTIONS="--use-system-ca" npx wrangler secret put SUPABASE_URL` i to samo dla
   `SUPABASE_KEY`, potem redeploy,
3. dopiero wtedy URL Configuration (sekcja 2) — **w panelu nowego projektu**.

### Ustalenie o flow potwierdzania maila (analiza kodu, 2026-08-18)

W `src/pages/` **nie ma route'u `/auth/callback`**, a `signup.ts:13` woła `supabase.auth.signUp()`
**bez** `emailRedirectTo`. `@supabase/ssr` domyślnie używa PKCE. Skutek dla testu ręcznego:

klik w link z maila **potwierdzi konto**, ale **nie zaloguje** — lądujesz na Site URL jako
niezalogowany (prawdopodobnie z `?code=...`, którego nikt nie obsługuje). Poprawny przejazd:

rejestracja → mail → klik → ląduję na `/` **wylogowany (to normalne)** → logowanie
e-mail + hasło na `/auth/signin` → `/dashboard`.

Dopiero brak trwałej sesji w ostatnim kroku byłby realnym problemem (ryzyko R3).
Opcjonalnie do rozważenia później: dopisać `/auth/callback` z `exchangeCodeForSession`,
żeby link z maila logował od razu. To zmiana w kodzie, poza zakresem lekcji 5.

---

## 0a. Ponowna weryfikacja — 2026-08-12

Wszystko sprawdzone na żywo, bez zmian w kodzie. **Deployment nadal zielony:**

| Sprawdzenie                          | Wynik                                            |
| ------------------------------------ | ------------------------------------------------ |
| `/`                                  | `200`                                            |
| `/auth/signin`                       | `200`                                            |
| `/dashboard` bez sesji               | `302` → `/auth/signin` (middleware działa)       |
| Supabase `/auth/v1/health`           | `200`, GoTrue v2.195.0 — projekt **nie** uśpiony |
| `POST /api/auth/signin`, błędne dane | `302` → `?error=Invalid login credentials`       |

Ostatni wiersz jest kluczowy: komunikat pochodzi z Supabase, a nie z gałęzi
`if (!supabase)` w `src/pages/api/auth/signin.ts` — dowód, że Worker realnie dociera do
Supabase Auth i sekrety mają poprawne wartości.

**Nowa obserwacja — `npm run lint` pada lokalnie (1022 błędów `Delete ␍`).**
To wyłącznie problem working tree, nie repozytorium:

```
git ls-files --eol src/pages/index.astro
→ i/lf   w/crlf   attr/text eol=lf
```

Indeks jest LF i `.gitattributes` wymusza LF, ale **lokalny** `core.autocrlf=true`
(ustawiony w tym repo; globalnie pusty) przy checkoucie przepisuje pliki na CRLF.
`git status` zostaje czysty, bo to samo ustawienie normalizuje przy porównaniu — problem
jest niewidoczny do momentu uruchomienia linta. **CI przechodzi** (checkout na Linuksie =
LF). Naprawa: `git config core.autocrlf false`, potem odświeżenie drzewa
(`git rm --cached -r . && git reset --hard`). Samo `lint:fix` / `format` tylko zamiata
problem — kolejny checkout przywróci CRLF.

Stan zakresu bez zmian: `/rest/v1/cards` → `404 PGRST205` (tabela `public.cards` nie
istnieje), `supabase/` bez `migrations/`, w `src/` nadal wyłącznie auth. Branch jest
**10 commitów** przed `master`, drzewo czyste. Node aktywny 24.16.0 vs `.nvmrc` 22.14.0.

---

## 0. Gdzie stoi projekt

**Działa:**

- Build przechodzi czysto — `npm run build` (~60 s, adapter `@astrojs/cloudflare`).
- Worker żyje: <https://flashcards.adamborowiecki1990.workers.dev>
  - `/` → `200`
  - `/dashboard` → `302` → `/auth/signin` (middleware działa)
- Kod auth jest kompletny: `signin`, `signup`, `signout`, API endpointy, ochrona `/dashboard`.

**Czego NIE ma — i to jest ZGODNE Z PLANEM:**

- Brak jakiejkolwiek domeny produktu — w `src/pages/` nie istnieje nic o fiszkach:
  - brak CRUD kart,
  - brak sesji powtórek,
  - brak algorytmu SRS.

> ⚠️ **Nie traktuj tego jako braku do naprawienia.** Lekcja 5 celowo wypycha na produkcję
> pustą aplikację — to jej cel, nie niedoróbka. Cytat z
> `context/course/m1-l5-od-localhost-po-produkcje-deployment-z-agentem.md`: _„Zamiast
> rozdmuchiwać aplikację »wszerz«, zadbajmy o domknięcie pierwszego tygodnia end-to-end"_
> (l. 14), _„Widząc, że całość działa na produkcji, wrócimy do pracy nad ficzerami"_ (l. 22),
> _„To moment, w którym domykasz sprint zerowy. (…) W kolejnym tygodniu wchodzimy w
> funkcjonalność biznesową MVP"_ (l. 242–246). Chodzi o de-risking: sprawdzić, że droga na
> produkcję działa, **zanim** włoży się tygodnie w funkcje. Domena fiszek to materiał na
> **lekcję 6**, nie zaległość z lekcji 5.

**Niezacommitowane:** brak — `deployment-plan.md` zacommitowany 2026-08-11 (`bccd47f`).
Branch jest 8 commitów przed `master`, drzewo czyste.

---

## 1. Blokery — stan na 2026-08-11 wieczorem

| #   | Problem                          | Objaw                                 | Status                                             |
| --- | -------------------------------- | ------------------------------------- | -------------------------------------------------- |
| B1  | ~~Projekt Supabase wstrzymany~~  | ~~auth nie działa w ogóle~~           | ✅ **ZAMKNIĘTY** — wznowiony, API odpowiada        |
| B2  | ~~Worker nie widzi sekretów~~    | ~~czerwony baner na produkcji~~       | ✅ **ZAMKNIĘTY** — sekrety nadpisane + redeploy    |
| B3  | ~~Wrangler stracił autoryzację~~ | ~~`Failed to fetch auth token: 400`~~ | ✅ **ZAMKNIĘTY** — OAuth token, konto potwierdzone |

**Wszystkie blokery deploymentu zamknięte 2026-08-11.** Lokalnie i na produkcji auth jest
podłączony do Supabase. Pozostała praca to już nie naprawa infrastruktury, tylko ręczna
weryfikacja (sekcja 5) i budowa właściwej aplikacji (sekcja 6).

**Diagnostyczny drobiazg wart zapamiętania:** `wrangler secret list` pokazywał
`SUPABASE_URL` i `SUPABASE_KEY` jako istniejące, mimo że produkcja wyświetlała baner.
`secret list` zwraca wyłącznie **nazwy**, nigdy wartości — istnienie sekretu nie znaczy,
że wartość jest poprawna. Nadpisanie przez `secret put` + redeploy naprawiło problem.

---

## 2. Krok 1 — Supabase (ręcznie, w przeglądarce) ✅ ZROBIONE

- [x] Wejdź na <https://supabase.com/dashboard>
- [x] **Wznów projekt** (przycisk _Resume_) — zweryfikowane: `/auth/v1/health` → `200`
- [x] Settings → **API** → skopiuj:
  - [x] **Project URL** → to będzie `SUPABASE_URL`
  - [x] klucz **publishable** → to będzie `SUPABASE_KEY`
  - ℹ️ Supabase przemianował klucze: dawny `anon` / `public` = dziś **publishable**
    (`sb_publishable_…`), dawny `service_role` = **secret** (`sb_secret_…`).
  - ⚠️ **NIE** bierz `secret` / `service_role` — ten klucz nigdy nie trafia do klienta/edge
- [x] Authentication → **URL Configuration** ✅ **USTAWIONE 2026-08-31**:
  - [x] **Site URL** = `https://flashcards.adamborowiecki1990.workers.dev`
  - [x] **Redirect URLs** — oba:
    - `https://flashcards.adamborowiecki1990.workers.dev`
    - `http://localhost:4321`
  - Bezpośredni link (pomija klikanie po panelu):
    <https://supabase.com/dashboard/project/mxljsmyaqikcglfxpbji/auth/url-configuration>
  - Potwierdzone **pośrednio**: link z maila potwierdzającego odesłał na adres produkcyjny.
    Tego ustawienia nie da się odczytać przez API — `/auth/v1/settings` go nie zwraca,
    więc przejazd w przeglądarce jest jedynym dowodem.
  - Bez tego linki potwierdzające e-mail odbijają i logowanie na produkcji nie przejdzie.
  - Tego nie da się sprawdzić z zewnątrz przez API — zajrzyj do panelu i potwierdź ręcznie.
- [x] Sprawdź, czy istnieje tabela `cards` (front / back / `user_id` / `next_review_at`) i polityki RLS.
      **Sprawdzone: NIE ISTNIEJE** — `/rest/v1/cards` → `404 PGRST205`
      („Could not find the table 'public.cards'"). Nie blokuje logowania; robota z sekcji 6.

**Ustalone przy okazji:** rejestracja e-mailem jest włączona, `mailer_autoconfirm: false`
— czyli maile potwierdzające **są wymagane** przy przejeździe z sekcji 5.

---

## 3. Krok 2 — środowisko lokalne ✅ ZROBIONE

- [x] Wypełnij `.env` prawdziwymi wartościami z kroku 1
      (`SUPABASE_URL` + `SUPABASE_KEY`; bez cudzysłowów, bez spacji wokół `=`)
- [ ] `nvm use` — `.nvmrc` pinuje **22.14.0**, a aktywny jest nadal Node **24.16.0**
      (dev server wstaje mimo to, ale CI używa 22 — lepiej się nie rozjeżdżać)
- [x] `npm run dev` → <http://localhost:4321>

**Kryterium sukcesu: SPEŁNIONE** — baner „Supabase nie jest skonfigurowany" zniknął.

Zweryfikowane 2026-08-11:

| Sprawdzenie                  | Wynik                           |
| ---------------------------- | ------------------------------- |
| start dev servera            | `Using secrets defined in .env` |
| `/` lokalnie                 | `200`                           |
| baner na `/auth/signin`      | 0 trafień ✅                    |
| `/dashboard`                 | `302` → `/auth/signin`          |
| Supabase `/auth/v1/health`   | `200 OK`                        |
| Supabase `/auth/v1/settings` | `200 OK` — klucz przyjęty       |

> Ostatnie dwa to twardy dowód, że klucz jest ważny. Sam zniknięty baner tego nie
> gwarantuje — `src/lib/config-status.ts` sprawdza wyłącznie, czy zmienne są niepuste.

---

## 4. Krok 3 — Cloudflare / wrangler ✅ ZROBIONE

> ⚠️ Ta maszyna jest za korporacyjnym proxy TLS. Bez tego każde wywołanie wrangler
> pada na `UNABLE_TO_VERIFY_LEAF_SIGNATURE`.

- [x] `setx NODE_OPTIONS "--use-system-ca"` — raz, potem **otwórz nowy terminal**
- [x] `npx wrangler login` — autoryzacja przyznana
- [x] `npx wrangler whoami` — potwierdzone: `adamborowiecki1990@gmail.com`,
      OAuth Token, Account ID `59fae5f1f063552a35940512d63790be`
- [x] `npx wrangler secret list` — oba sekrety obecne
      (⚠️ patrz uwaga w sekcji 1 — obecność ≠ poprawna wartość)
- [x] `npx wrangler secret put SUPABASE_URL` _(interaktywnie — klucz nie trafia do transkryptu)_
- [x] `npx wrangler secret put SUPABASE_KEY`
- [x] `npm run build` — czysty, 8.34 s
- [x] `npx wrangler deploy`

---

## 5. Krok 4 — weryfikacja produkcji ⬅ **TU JESTEŚ** (zostaje tylko przejazd ręczny)

Automatyczne sprawdzenia — **wszystkie zaliczone 2026-08-11 po redeployu**:

- [x] `/` → `200`
- [x] `/dashboard` → `302` → `/auth/signin` (middleware działa)
- [x] `/auth/signin` → `200`, formularz się renderuje
- [x] Strona **nie zawiera** frazy „nie jest skonfigurowany" (0 trafień)
- [x] **Test end-to-end połączenia z Supabase** — `POST /api/auth/signin` z fałszywymi
      danymi zwraca `302` → `/auth/signin?error=Invalid%20login%20credentials`.
      Ten komunikat pochodzi z **Supabase**, nie z lokalnej gałęzi
      `if (!supabase)` w `src/pages/api/auth/signin.ts:11` (ta zwróciłaby
      „Supabase is not configured"). To dowód, że Worker realnie rozmawia z Supabase Auth.

> Uwaga przy testowaniu curl-em: Astro ma włączoną ochronę CSRF (`checkOrigin`),
> więc POST bez nagłówka `Origin` dostaje `403`. Trzeba dodać
> `-H "Origin: https://flashcards.adamborowiecki1990.workers.dev"`.

Ostatni punkt — **wykonany przez usera 2026-08-31**:

- [x] **Ręczny przejazd w przeglądarce** — ostatni punkt z `deployment-plan.md`:
  - [x] rejestracja nowego konta
  - [x] e-mail potwierdzający dociera i link działa
  - [x] logowanie
  - [x] sesja dochodzi do `/dashboard`

✅ **Deploy zweryfikowany w całości.** Kryterium „Done = all true" spełnione, **Risk R3
zamknięty**. Wejście na `/dashboard` jest tu dowodem rozstrzygającym — trasa jest chroniona
przez middleware, więc bez ważnej sesji odbiłaby na `/auth/signin`.

Zgodne z przewidywaniem z sekcji 0b: po kliknięciu w link z maila user wylądował na `/`
**niezalogowany** (brak route'u `/auth/callback`, PKCE bez `exchangeCodeForSession`).
Konto zostało potwierdzone, logowanie mailem + hasłem przeszło normalnie. Fakt, że link
odesłał na adres produkcyjny, potwierdza przy okazji, że **URL Configuration (sekcja 2)
jest ustawione poprawnie** — z zewnątrz nie dało się tego sprawdzić inaczej.

> Drobiazg UX, nie usterka wdrożenia: po zalogowaniu `signin.ts:19` robi
> `context.redirect("/")`, więc user ląduje na stronie głównej i musi sam kliknąć
> „Dashboard". Zmiana na `/dashboard` to jedno słowo — do rozważenia przy pracy nad
> właściwą aplikacją.

> Uwaga: wbudowany SMTP Supabase jest rate-limitowany (kilka maili na godzinę).
> Na test wystarczy; przed realnym użyciem trzeba własny provider SMTP.

---

## 6. Co dalej (poza naprawą deploymentu)

- [x] Zacommitować `deployment-plan.md` — zrobione 2026-08-11 (`bccd47f`)
- [ ] Zdecydować, co z branchem `feature/doLesson4again` — merge do `master` czy dalej na nim?
- [ ] **Naprawić CRLF w working tree** — `git config core.autocrlf false` + odświeżenie
      drzewa, żeby `npm run lint` znów był użyteczny lokalnie (szczegóły w sekcji 0a)
- [ ] **Zbudować właściwą aplikację** — cała domena fiszek jest do napisania:
  - [ ] model danych + migracje (`cards`, RLS)
  - [ ] CRUD kart
  - [ ] sesja powtórek (karty z `next_review_at <= now`)
  - [ ] algorytm SRS z inwariantem: `missed_it` < `got_it` < `nailed_it` (czas następnej powtórki)
- [ ] Ewentualnie: deploy automatyczny w CI (świadomie pominięty przy pierwszym wdrożeniu)

---

## 7. Ściąga — obejścia dla tej maszyny

| Rzecz                      | Obejście                                 |
| -------------------------- | ---------------------------------------- |
| `wrangler` (każda komenda) | prefiks `NODE_OPTIONS="--use-system-ca"` |
| `curl` (weryfikacja)       | flaga `--ssl-no-revoke`                  |
| `npm`/`npx` w Bash tool    | używaj `npm.cmd` (inaczej exit 127)      |
| lint tonie w `␍`           | `git config core.autocrlf false`         |
| Node                       | `nvm use` → 22.14.0 (`.nvmrc`)           |
| Domyślny branch repo       | `master` (nie `main`)                    |

---

## Moje notatki

<!-- miejsce na Twoje uwagi -->
