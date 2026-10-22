# PROMPT_CHAINS.md — Test-Driven Vibe Coding Pipeline (Step-by-Step)

Używaj poniższych promptów sekwencyjnie w **Cursorze (Composer / Agent mode)** lub **Claude Code**. 
Każdy prompt zawiera bramkę testową (*Stage Gate*). AI ma zakaz przechodzenia do kolejnego promptu, dopóki testy bieżącego etapu nie przejdą w 100%. **Pod żadnym pozorem nie wolno modyfikować zielonych testów!**

---

### 🟢 PROMPT 1: Monorepo, Typy & Testy Haszowania R2 (Etap 1)
```text
Przeczytaj uważnie AGENTS.md, .cursorrules, MOBILE_BOOTSTRAP_AND_CONFIG.md, STAGE_GATES_AND_TESTS.md (Etap 1) oraz API_CONTRACT.md.
Zadanie:
1. Zainicjalizuj monorepo Turborepo z Bun zgodnie z szablonami 1:1 w MOBILE_BOOTSTRAP_AND_CONFIG.md:
   - apps/mobile: React Native Expo (SDK 51+), Expo Router (v3), TypeScript, NativeWind v4 (metro.config.js, tailwind.config.js, babel.config.js, global.css, tsconfig.json), Zustand, TanStack Query.
   - apps/backend: Hono na Bun z TypeScript i Zod.
   - packages/shared: interfejsy z API_CONTRACT.md (w tym TranslationResponse, SubtitleCue, CaptionsResponse, SearchVideoItem, Flashcard, CreateFlashcardRequestBody), schematy Zod oraz synchroniczne funkcje cleanWordToken i computeTranslationHash oparte o @noble/hashes/sha256.
2. Napisz plik testowy packages/shared/src/__tests__/hash.test.ts weryfikujący:
   - determinizm hasha sha256 (word + "_" + sentence + "_" + lang),
   - trim, lowercase oraz oczyszczanie znaków interpunkcyjnych przez cleanWordToken (np. "attitude." -> "attitude", zachowanie apostrofu w "don't"),
   - różnicę hashy dla _pl, _de, _es,
   - walidację schematu Zod dla TranslationResponse.
3. Uruchom: bun test packages/shared.
BRAMKA: Popraw kod, aż wszystkie testy będą zielone (PASS). Pod żadnym pozorem nie zmieniaj asercji testów.
```

---

### 🟢 PROMPT 2: YouTube Subtitles Scraper & Wyszukiwarka Wideo (Etap 2)
```text
Przeczytaj YOUTUBE_SCRAPER.md, 01_ARCHITECTURE.md (Sekcja 3 - apps/backend/src/index.ts), EDGE_CASES_AND_ERRORS.md (Sekcja 1 i 2), API_CONTRACT.md oraz STAGE_GATES_AND_TESTS.md (Etap 2).
Zadanie:
1. W apps/backend zaimplementuj YouTubeCaptionsService wyciągający napisy z timedtext bez używania płatnego Google Cloud API (dokładnie wg YOUTUBE_SCRAPER.md).
2. Zaimplementuj YouTubeSearchService (search.service.ts) oraz podepnij endpointy GET /api/v1/captions?videoId=XYZ&lang=en i GET /api/v1/search?q=XYZ w apps/backend/src/index.ts (eksportując instancję Hono `export const app = new Hono()`).
3. Napisz testy jednostkowe apps/backend/src/__tests__/captions.test.ts oraz apps/backend/src/__tests__/search.test.ts sprawdzające:
   - parsowanie XML do SubtitleCue[] (start, duration, end),
   - poprawność tokenizacji słów ze znakami interpunkcyjnymi i apostrofami,
   - rzucanie błędu NO_CAPTIONS_AVAILABLE (HTTP 422) przy braku angielskich napisów,
   - zwracanie SearchVideoItem[] i działanie cache (cached: true) dla powtórzonego zapytania wyszukiwarki.
4. Uruchom: bun test apps/backend/src/__tests__/captions.test.ts apps/backend/src/__tests__/search.test.ts.
BRAMKA: Zapewnij 100% zielonych testów. NIE MODYFIKUJ testów z Etapu 1.
```

---

### 🟢 PROMPT 3: Fallback Gemini 2.5 Lite, Quota Guard & Upload do R2 (Etap 3)
```text
Przeczytaj 03_AI_AND_PROMPTS.md (Sekcje 1-6), EDGE_CASES_AND_ERRORS.md (Sekcja 5 - Quota Guard), API_CONTRACT.md oraz STAGE_GATES_AND_TESTS.md (Etap 3).
Zadanie:
1. W apps/backend stwórz serwisy:
   - gemini.service.ts (generateContextualTranslation z @google/genai, responseSchema i regułą rozpoznawania phrasal verbs / idiomów w kontekście),
   - r2.service.ts (R2StorageService z @aws-sdk/client-s3 zapisujący /{hash}.json w roocie bucketa),
   - quota.service.ts (evaluateQuota z limitem 50 darmowych tłumaczeń/24h i automatycznym resetem po 24h)
   oraz endpoint POST /api/v1/translate.
2. Po wygenerowaniu JSON doklej hash, target_language i created_at, zapisz obiekt pod kluczem ${hash}.json w głównym folderze Cloudflare R2 i zwróć TranslationResponse.
3. Napisz testy apps/backend/src/__tests__/translate.test.ts (mockując Gemini i S3 client) sprawdzające poprawność walidacji Zod (HTTP 400), generowanie klucza R2, strukturę odpowiedzi oraz logikę evaluateQuota (HTTP 429 QUOTA_EXCEEDED).
4. Uruchom: bun test apps/backend/src/__tests__/translate.test.ts.
BRAMKA: Upewnij się, że testy przechodzą. Żelazna zasada: nie ruszaj zielonych testów z poprzednich etapów!
```

---

### 🟢 PROMPT 4: Algorytm Powtórek SM-2 dla Fiszek (Etap 4)
```text
Przeczytaj SRS_ALGORITHM.md, DESIGN_SYSTEM.md (Sekcja 3) oraz STAGE_GATES_AND_TESTS.md (Etap 4).
Zadanie:
1. W packages/shared/src/srs.ts zaimplementuj funkcję calculateNextReview oraz calculateNextReviewFromSwipe (dokładnie wg SRS_ALGORITHM.md) mapującą gesty swipe'a:
   - Left (<-) -> Grade 0 (Powtórz: repetitions = 0, intervalDays = 1)
   - Down (v) -> Grade 1 (Trudne: spadek easeFactor, intervalDays = 1..2)
   - Right (->) -> Grade 2 (Dobrze: standardowy progres interwału)
   - Up (^) -> Grade 3 (Łatwe: wzrost interwału i easeFactor)
2. Napisz testy packages/shared/src/__tests__/srs.test.ts sprawdzające:
   - reset repetitions przy Grade 0,
   - spadek easeFactor i interwał 1-2 dni przy Grade 1,
   - wzrost interwału przy Grade 2 i Grade 3,
   - zachowanie dolnego limitu easeFactor >= 1.3.
3. Uruchom: bun test packages/shared/src/__tests__/srs.test.ts.
BRAMKA: Wszystkie testy muszą przejść na zielono. Nie modyfikuj istniejących testów.
```

---

### 🟢 PROMPT 5: Supabase Auth & Bezpieczny Storage (Etap 5)
```text
Przeczytaj DATABASE_SCHEMA.sql, AUTH_AND_SECURITY.md (Sekcje 1-4), MOBILE_BOOTSTRAP_AND_CONFIG.md (Sekcja 8) oraz STAGE_GATES_AND_TESTS.md (Etap 5).
Zadanie:
1. W apps/mobile zaimplementuj lib/supabase.ts z adapterem expo-secure-store oraz lib/auth.ts (createSecureStoreAdapter, resolveAuthRedirect oraz signInWithApple wg AUTH_AND_SECURITY.md Sekcja 3 i 4).
2. Zbuduj ekran logowania w app/(auth)/login.tsx (wyłącznie szybkie logowanie Apple Sign In oraz Google Sign In z expo-web-browser wg MOBILE_SCREENS_SPEC.md Sekcja 6 – zero formularzy email/hasło).
3. Zaimplementuj AuthGuard (wykorzystujący resolveAuthRedirect) oraz poprawkę dźwięku iOS (Audio.setAudioModeAsync playsInSilentModeIOS: true) w app/_layout.tsx.
4. Napisz testy apps/mobile/__tests__/auth.test.ts sprawdzające createSecureStoreAdapter oraz resolveAuthRedirect.
5. Uruchom: bun test apps/mobile/__tests__/auth.test.ts.
BRAMKA: Wszystkie testy zielone. Zakaz modyfikacji wcześniejszych testów.
```

---

### 🟢 PROMPT 6: Odtwarzacz Wideo (Prędkość 0.25–2.0 co 0.05), Napisy, TTS & Wyszukiwarka z Lupką (Etap 6)
```text
Przeczytaj DESIGN_SYSTEM.md (w tym Sekcja 1.2 - ikony phosphor-react-native), NAVIGATION_MAP.md, STATE_MANAGEMENT.md, COMPONENT_SPECS.md, DATABASE_AND_COST_OPTIMIZATION.md (Sekcja 1 - expo-speech), EDGE_CASES_AND_ERRORS.md (Sekcja 1-3), MOBILE_SCREENS_SPEC.md (Sekcja 1-2) oraz STAGE_GATES_AND_TESTS.md (Etap 6).
Zadanie:
1. W apps/mobile zaimplementuj stores/usePlayerStore.ts (wraz z funkcjami findActiveCueIndex, findActiveCue, findActiveWordIndex, clampPlaybackRate, stepPlaybackRate od 0.25 do 2.00 co 0.05 oraz QUERY_KEYS) i lib/speech.ts (playPronunciation z expo-speech).
2. Stwórz pasek zakładek app/(tabs)/_layout.tsx (Frosted Glass TabBar z expo-blur i ikonami phosphor-react-native: szare weight="regular" -> po kliknięciu/aktywacji weight="fill" z kolorem), ekran wyszukiwarki app/(tabs)/index.tsx (pasek wyszukiwania z lupką MagnifyingGlass a'la YouTube bez wklejania linków/schowka, kafelki 16:9, CURATED_VIDEOS) oraz ekran odtwarzacza app/(tabs)/player.tsx z płynną regulacją prędkości (0.25x - 2.00x co 0.05), WordToken.tsx, SubtitleTrack.tsx (z 200ms debouncingiem kliknięć) i TranslationSheet.tsx.
3. Zaimplementuj synchronizację czasu (pętla interwałowa 150ms odpytująca playerRef.current.getCurrentTime()), podświetlanie aktywnego słowa (isActiveWord) i auto-scroll. Kliknięcie w słowo pauzuje wideo i otwiera TranslationSheet.
4. Napisz testy apps/mobile/__tests__/subtitles.test.ts weryfikujące funkcje findActiveCue, findActiveWordIndex, stepPlaybackRate / clampPlaybackRate (zakres 0.25-2.00 krok 0.05) oraz wywoływanie pauzy odtwarzacza w usePlayerStore.openTranslation.
5. Uruchom: bun test apps/mobile/__tests__/subtitles.test.ts.
BRAMKA: Potwierdź przejście testów. Brak zmian w zielonych testach.
```

---

### 🟢 PROMPT 7: Krawędziowy Cache R2 First w Aplikacji (Etap 7)
```text
Przeczytaj 03_AI_AND_PROMPTS.md (Sekcja 7 - fetchTranslationWithR2Cache), API_CONTRACT.md oraz STAGE_GATES_AND_TESTS.md (Etap 7).
Zadanie:
1. W apps/mobile zaimplementuj serwis pobierania tłumaczenia w lib/translation.ts (funkcja fetchTranslationWithR2Cache z wstrzykiwalnym fetchFn wg 03_AI_AND_PROMPTS.md Sekcja 7) i podepnij go do TranslationSheet.tsx:
   - Oblicz hash: computeTranslationHash(word, sentence, nativeLanguage).
   - Wykonaj bezpośredni GET ${EXPO_PUBLIC_R2_URL}/${hash}.json.
   - Jeśli HTTP 200: zwróć dane z CDN natychmiast (fromCache: true, 0 obciążenia backendu!).
   - Jeśli HTTP 404: wywołaj backend POST /api/v1/translate (fromCache: false).
2. Napisz testy apps/mobile/__tests__/r2-cache.test.ts sprawdzające scenariusz cache hit (brak zapytania do backendu) i cache miss (wywołanie fallbacku).
3. Uruchom: bun test apps/mobile/__tests__/r2-cache.test.ts.
BRAMKA: Wszystkie testy zdane w 100%.
```

---

### 🟢 PROMPT 8: Offline SQLite (Push & Pull), Fiszki Tinder 4-Way Swipe, Profil & Subskrypcje Stripe (Etap 8)
```text
Przeczytaj OFFLINE_SQLITE_AND_SYNC.md, STATE_MANAGEMENT.md (Sekcja 3), COMPONENT_SPECS.md (Sekcja 4), MOBILE_SCREENS_SPEC.md (Sekcja 3-5), 04_SAAS_BUSINESS_MODEL.md (w tym Sekcja 3.4), DEPLOYMENT_AND_EAS.md oraz STAGE_GATES_AND_TESTS.md (Etap 8).
Zadanie:
1. W apps/mobile zaimplementuj bazę offline expo-sqlite (lib/db/LocalFlashcardsRepository.ts z upsertManyFromServer), dwukierunkowy silnik synchronizacji zbiorczej (lib/db/FlashcardSyncEngine.ts: flush + pullFromServer) oraz stores/useFlashcardsStore.ts.
2. Zaimplementuj komponent TinderCard.tsx (Gesture.Pan() w 4 kierunkach + obrót 3D Gesture.Tap() w Reanimated v3 + wibracje expo-haptics) oraz ekrany: app/(tabs)/flashcards.tsx, app/(tabs)/profile.tsx i modal app/(modals)/paywall.tsx.
3. W apps/backend skonfiguruj routes/stripe.routes.ts (createSubscriptionCheckout i handleStripeWebhook z asynchronicznym stripe.webhooks.constructEventAsync dla Bun) obsługujący 3 plany miesięczne (Starter, Pro, Master), 3 dni darmowego trialu (trial_period_days: 3), waluty PLN (z BLIK i P24), EUR (SEPA) i USD.
4. Skonfiguruj pliki wdrożeniowe apps/mobile/app.json oraz apps/mobile/eas.json zgodnie z DEPLOYMENT_AND_EAS.md.
5. Napisz testy apps/mobile/__tests__/sqlite-sync.test.ts oraz apps/backend/src/__tests__/stripe.test.ts sprawdzające buforowanie SQLite, dwukierunkowy sync, parametry checkoutu i aktualizację planu w bazie po webhooku.
6. Uruchom: bun test.
BRAMKA: Wszystkie testy w całym monorepo (Etapy 1-8) muszą być ZIELONE.
```
