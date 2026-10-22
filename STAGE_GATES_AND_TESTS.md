# STAGE_GATES_AND_TESTS.md — Test-Driven Stage-Gate Workflow

Ten dokument definiuje **nadrzędny protokół weryfikacji i jakości dla AI (Cursor, Windsurf, Claude Code)**. AI musi bezwzględnie stosować się do poniższych reguł przy budowie aplikacji mobilnej LearnEng.

---

## 🛑 ŻELAZNA ZASADA #1: Niezmienność Przechodzących Testów (Immutable Green Tests)

> **ZAKAZ:** Jeśli test jednostkowy lub integracyjny został napisany, uruchomiony i ZDAŁ (jest zielony), **AI pod żadnym pozorem nie ma prawa go modyfikować, upraszczać, komentować ani usuwać**.
>
> Jeśli w kolejnym etapie stary test przestanie przechodzić (czerwony) — oznacza to **REGRESJĘ** w nowo napisanym kodzie. 
> **AI musi poprawić swój kod implementacyjny, a NIE zmieniać asercje testu!**
> Jedynym powodem zmiany testu jest bezpośrednie, wyraźne polecenie użytkownika w czacie.

---

## 🚦 BRAMKI ETAPOWE (Stage Gates) — Przejście Krok po Kroku

Nie wolno zaczynać kolejnego etapu, dopóki etap bieżący nie zostanie przetestowany i zatwierdzony komendą `bun test` (lub `npm test`).

```
[ Etap N ] ---> [ Zbuduj kod ] ---> [ Napisz testy ] ---> [ Uruchom `bun test` ]
                                                                  |
      +-----------------------------------------------------------+
      |
      +---> [ TESTY NIE PRZECHODZĄ (FAIL) ] ---> Popraw kod implementacji (NIE TESTY!)
      |
      +---> [ TESTY PRZECHODZĄ (100% PASS) ] ---> Zablokuj testy (Read-Only)
                                                                  |
                                                                  v
                                                        [ Przejdź do Etapu N+1 ]
```

---

## 📋 Szczegółowy Plan Etapów i Wymaganych Testów

### 🟢 ETAP 1: Monorepo, Współdzielone Typy i Haszowanie R2
* **Zakres prac:** Inicjalizacja Turborepo (`apps/mobile`, `apps/backend`, `packages/shared`).
* **Pliki testowe:** `packages/shared/src/__tests__/hash.test.ts`
* **Wymagane testy:**
  1. Determinizm haszowania: `computeTranslationHash("run out of", "We ran out of milk.", "pl")` zawsze zwraca ten sam 64-znakowy hex SHA-256.
  2. Niewrażliwość na wielkość liter i spacje brzegowe (trim & lowercase).
  3. Obsługa różnych języków: hash dla `_pl` różni się od `_de` i `_es`.
  4. Walidacja schematu Zod dla `TranslationResponse`.
* **Komenda bramki:** `bun test packages/shared`
* **Kryterium przejścia:** 100% testów zielonych. Żaden kod etapu 2 nie może powstać przed sukcesem etapu 1.

---

### 🟢 ETAP 2: Scraper Napisów YouTube & Wyszukiwarka Wideo
* **Zakres prac:** `YouTubeCaptionsService` (endpoint `GET /api/v1/captions`) oraz `YouTubeSearchService` (endpoint `GET /api/v1/search`).
* **Pliki testowe:** `apps/backend/src/__tests__/captions.test.ts` oraz `apps/backend/src/__tests__/search.test.ts`
* **Wymagane testy:**
  1. Poprawne parsowanie XML formatu `timedtext` do obiektów `SubtitleCue[]`.
  2. Dokładność znaczników czasu: `start`, `duration`, `end`.
  3. Funkcja tokenizacji: zdanie `"I can't put up with this!"` dzieli się na prawidłowe tokeny wyrazowe z zachowaniem apostrofów.
  4. Obsługa błędów: zwrot błędu `NO_CAPTIONS_AVAILABLE` dla wideo bez angielskich napisów.
  5. Wyszukiwarka wideo: endpoint `GET /api/v1/search?q=mrbeast` zwraca tablicę `SearchVideoItem[]` z `id`, `title`, `thumbnailUrl`, a powtórne zapytanie zwraca flagę `cached: true`.
* **Komenda bramki:** `bun test apps/backend/src/__tests__/captions.test.ts apps/backend/src/__tests__/search.test.ts`

---

### 🟢 ETAP 3: Fallback Gemini 2.5 Lite & Zapis do Cloudflare R2
* **Zakres prac:** `POST /api/v1/translate` (wywołanie Gemini ze structured outputs + upload do R2 root).
* **Pliki testowe:** `apps/backend/src/__tests__/translate.test.ts`
* **Wymagane testy (z mockiem Gemini i S3 client):**
  1. Walidacja body żądania (brak `word` lub `sentence` rzuca HTTP 400).
  2. Sprawdzenie, czy funkcja generuje poprawny hash pliku.
  3. Weryfikacja, czy wywołano upload do S3/R2 pod poprawny klucz `/{hash}.json` w roocie bucketa.
  4. Zwracany obiekt ma wszystkie pola: `simple_definition`, `contextual_translation`, `context_explanation`, `ipa`, `cefr_level`.
* **Komenda bramki:** `bun test apps/backend/src/__tests__/translate.test.ts`

---

### 🟢 ETAP 4: Algorytm Powtórek SM-2 dla Fiszek
* **Zakres prac:** Implementacja funkcji `calculateNextReview` i mapowania gestów 4-way swipe.
* **Pliki testowe:** `packages/shared/src/__tests__/srs.test.ts`
* **Wymagane testy:**
  1. **Grade 0 (Swipe w Lewo / Powtórz):** zeruje powtórzenia (`repetitions = 0`), interwał = 1 dzień.
  2. **Grade 1 (Swipe w Dół / Trudne):** zmniejsza współczynnik łatwości (`easeFactor`), interwał = 1-2 dni.
  3. **Grade 2 (Swipe w Prawo / Dobrze):** standardowy progres interwału (np. 1 -> 3 -> 7 dni).
  4. **Grade 3 (Swipe w Górę / Łatwe):** zwiększa interwał i współczynnik łatwości.
  5. Minimalny próg współczynnika łatwości nigdy nie spada poniżej $1.3$.
* **Komenda bramki:** `bun test packages/shared/src/__tests__/srs.test.ts`

---

### 🟢 ETAP 5: Autentykacja i Logika Klienta Supabase
* **Zakres prac:** Magazyn `expo-secure-store`, adapter auth i autoryzowane zapytania.
* **Pliki testowe:** `apps/mobile/__tests__/auth.test.ts`
* **Wymagane testy:**
  1. Adapter `SecureStoreAdapter` bezpiecznie zapisuje i odczytuje token JWT.
  2. Auth Guard przekierowuje niezalogowanego użytkownika do `/(auth)/login`.
  3. Zalogowany użytkownik ma dostęp do ścieżki `/(tabs)`.
* **Komenda bramki:** `bun test apps/mobile/__tests__/auth.test.ts`

---

### 🟢 ETAP 6: Integracja Odtwarzacza i Synchronizacja Napisów
* **Zakres prac:** Komponent `SubtitleTrack` i podświetlanie aktywnego słowa w czasie rzeczywistym.
* **Pliki testowe:** `apps/mobile/__tests__/subtitles.test.ts`
* **Wymagane testy:**
  1. Funkcja wyszukiwania aktywnego cue (`findActiveCue(time, cues)`) zwraca poprawny segment dla danego czasu.
  2. Kliknięcie w słowo pauzuje odtwarzacz i przekazuje token do modala.
  3. Formatowanie czasu wideo i kalkulacja auto-scrolla.
* **Komenda bramki:** `bun test apps/mobile/__tests__/subtitles.test.ts`

---

### 🟢 ETAP 7: Logika Cache R2 First w Aplikacji Mobilnej
* **Zakres prac:** Sprawdzanie `GET ${PUBLIC_R2_URL}/{hash}.json` przed zapytaniem do backendu.
* **Pliki testowe:** `apps/mobile/__tests__/r2-cache.test.ts`
* **Wymagane testy (Mock fetch):**
  1. Jeśli `GET` do R2 zwraca HTTP 200 -> dane są parsowane i zwracane, **backend API nie jest w ogóle wywoływany**.
  2. Jeśli `GET` do R2 zwraca HTTP 404 -> aplikacja natychmiast wywołuje fallback endpoint `POST /api/v1/translate`.
  3. Jeśli backend zwróci dane -> zostają one wyświetlone w Bottom Sheet.
* **Komenda bramki:** `bun test apps/mobile/__tests__/r2-cache.test.ts`

---

### 🟢 ETAP 8: Płatności Stripe & Webhooki
* **Zakres prac:** Tworzenie sesji checkoutu, weryfikacja webhooków i aktualizacja uprawnień.
* **Pliki testowe:** `apps/backend/src/__tests__/stripe.test.ts`
* **Wymagane testy:**
  1. Tworzenie sesji checkoutu uwzględnia `trial_period_days: 3` dla wszystkich 3 planów (Starter, Pro, Master).
  2. Poprawne waluty dla rynków: PLN dla Polski (z BLIK), EUR dla Niemiec, USD globalnie.
  3. Webhook `checkout.session.completed` aktywuje subskrypcję w bazie.
  4. Webhook `customer.subscription.deleted` cofa uprawnienia do planu darmowego.
* **Komenda bramki:** `bun test apps/backend/src/__tests__/stripe.test.ts`

---

## 🔒 Podsumowanie Zasad dla Asystenta Vibe Codingu
1. **Zawsze uruchamiaj testy po skończeniu kodu danego etapu.**
2. **Nigdy nie ruszaj testów, które wcześniej zakończyły się sukcesem.**
3. **Nie przechodź do kolejnego etapu, jeśli choć jeden test w projekcie zgłasza błąd.**
