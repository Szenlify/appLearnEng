# PROMPT_CHAINS.md — Test-Driven Vibe Coding Pipeline (Step-by-Step)

Używaj poniższych promptów sekwencyjnie w **Cursorze (Composer / Agent mode)** lub **Claude Code**. 
Każdy prompt zawiera bramkę testową (*Stage Gate*). AI ma zakaz przechodzenia do kolejnego promptu, dopóki testy bieżącego etapu nie przejdą w 100%. **Pod żadnym pozorem nie wolno modyfikować zielonych testów!**

---

### 🟢 PROMPT 1: Monorepo, Typy & Testy Haszowania R2 (Etap 1)
```text
Przeczytaj uważnie AGENTS.md, .cursorrules, MOBILE_BOOTSTRAP_AND_CONFIG.md, STAGE_GATES_AND_TESTS.md (Etap 1) oraz API_CONTRACT.md.
Zadanie:
1. Zainicjalizuj monorepo Turborepo z Bun zgodnie z szablonami 1:1 w MOBILE_BOOTSTRAP_AND_CONFIG.md:
   - apps/mobile: React Native Expo (SDK 57+), Expo Router, TypeScript, NativeWind v4 (metro.config.js, tailwind.config.js, babel.config.js, global.css, tsconfig.json), Zustand, TanStack Query.
   - apps/backend: Hono na Bun z TypeScript i Zod.
   - packages/shared: interfejsy z API_CONTRACT.md (w tym TranslationResponse, SubtitleCue, CaptionsResponse, SearchVideoItem, Flashcard, CreateFlashcardRequestBody), schematy Zod oraz synchroniczne funkcje cleanWordToken i computeTranslationHash oparte o @noble/hashes/sha256. Domyślny język tłumaczenia to 'en'.
2. Napisz plik testowy packages/shared/src/__tests__/hash.test.ts weryfikujący:
   - determinizm hasha sha256 (cleanWordToken(word) + "_" + sentence + "_" + lang),
   - trim, lowercase oraz oczyszczanie znaków interpunkcyjnych przez cleanWordToken (np. "attitude." -> "attitude", normalizację apostrofu typograficznego "don’t" -> "don't", ignorowanie pustych znaków),
   - różnicę hashy dla _en, _pl, _de, _es,
   - walidację schematu Zod dla TranslationResponse.
3. Uruchom: bun test packages/shared.
BRAMKA: Popraw kod, aż wszystkie testy będą zielone (PASS). Pod żadnym pozorem nie zmieniaj asercji testów.
```

---

### 🟢 PROMPT 2: YouTube Subtitles Scraper & Wyszukiwarka Wideo (Etap 2)
```text
Przeczytaj YOUTUBE_SCRAPER.md, 01_ARCHITECTURE.md (Sekcja 3 - apps/backend/src/index.ts), EDGE_CASES_AND_ERRORS.md (Sekcja 1 i 2), API_CONTRACT.md oraz STAGE_GATES_AND_TESTS.md (Etap 2).
Zadanie:
1. W apps/backend zaimplementuj YouTubeCaptionsService wyciągający napisy z timedtext bez używania płatnego Google Cloud API (dokładnie wg YOUTUBE_SCRAPER.md z normalizacją apostrofów typograficznych ’ -> ' i odfiltrowywaniem pustych tokenów).
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
   - r2.service.ts (R2StorageService z @aws-sdk/client-s3 zapisujący /{hash}.json w roocie bucketa z walidacją Zod przed zapisem),
   - quota.service.ts (evaluateQuota z limitem 30 darmowych tłumaczeń/24h dla planu 'free' oraz unlimited dla planów płatnych 'pro' i 'master')
   oraz endpoint POST /api/v1/translate chroniony nagłówkiem Authorization Bearer JWT.
2. Po wygenerowaniu JSON doklej hash, target_language i created_at, zweryfikuj obiekt schematem Zod TranslationResponseSchema, zapisz obiekt pod kluczem ${hash}.json w głównym folderze Cloudflare R2 i zwróć TranslationResponse.
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
   - Left (<-) -> Grade 0 (Again / Powtórz: repetitions = 0, intervalDays = 1)
   - Down (v) -> Grade 1 (Hard / Trudne: spadek easeFactor, intervalDays = 1..2)
   - Right (->) -> Grade 2 (Good / Dobrze: standardowy progres interwału 1 -> 3 -> 8 dni)
   - Up (^) -> Grade 3 (Easy / Łatwe: wzrost interwału i easeFactor)
2. Napisz testy packages/shared/src/__tests__/srs.test.ts sprawdzające:
   - reset repetitions przy Grade 0,
   - spadek easeFactor i interwał 1-2 dni przy Grade 1,
   - progres interwału przy Grade 2 (1 -> 3 -> 8 dni) oraz Grade 3,
   - zachowanie dolnego limitu easeFactor >= 1.3.
3. Uruchom: bun test packages/shared/src/__tests__/srs.test.ts.
BRAMKA: Wszystkie testy muszą przejść na zielono. Nie modyfikuj istniejących testów.
```

---

### 🟢 PROMPT 5: Supabase Auth & Bezpieczny Storage (Etap 5)
```text
Przeczytaj DATABASE_SCHEMA.sql, AUTH_AND_SECURITY.md (Sekcje 1-5), MOBILE_BOOTSTRAP_AND_CONFIG.md (Sekcja 8) oraz STAGE_GATES_AND_TESTS.md (Etap 5).
Zadanie:
1. W apps/mobile zaimplementuj lib/supabase.ts z adapterem ExpoSecureStoreAdapter (expo-secure-store) oraz lib/auth.ts (createSecureStoreAdapter, resolveAuthRedirect, signInWithApple oraz deleteUserAccount wg AUTH_AND_SECURITY.md).
2. Zbuduj ekran logowania w app/(auth)/login.tsx w języku angielskim (Apple Sign In oraz Google Sign In z expo-web-browser wg MOBILE_SCREENS_SPEC.md Sekcja 6 – zero formularzy email/hasło) oraz trasę app/(auth)/callback.tsx do obsługi deep linków OAuth.
3. Zaimplementuj AuthGuard (wykorzystujący resolveAuthRedirect) w app/_layout.tsx oraz upewnij się, że tryb dźwięku iOS zezwala na odtwarzanie wymowy (Audio.setAudioModeAsync).
4. Napisz testy apps/mobile/__tests__/auth.test.ts sprawdzające createSecureStoreAdapter oraz resolveAuthRedirect.
5. Uruchom: bun test apps/mobile/__tests__/auth.test.ts.
BRAMKA: Wszystkie testy zielone. Zakaz modyfikacji wcześniejszych testów.
```

---

### 🟢 PROMPT 6: Odtwarzacz Wideo (Prędkość 0.25–2.0), Napisy, TTS & Wyszukiwarka z Lupką (Etap 6)
```text
Przeczytaj DESIGN_SYSTEM.md (ikony phosphor-react-native), NAVIGATION_MAP.md, STATE_MANAGEMENT.md, COMPONENT_SPECS.md, DATABASE_AND_COST_OPTIMIZATION.md, EDGE_CASES_AND_ERRORS.md, MOBILE_SCREENS_SPEC.md (Sekcja 1-2) oraz STAGE_GATES_AND_TESTS.md (Etap 6).
Zadanie:
1. W apps/mobile zaimplementuj stores/usePlayerStore.ts (wraz z funkcjami findActiveCueIndex, findActiveCue, findActiveWordIndex, clampPlaybackRate, stepPlaybackRate, autoResumeOnSheetClose oraz QUERY_KEYS) i lib/speech.ts (playPronunciation z expo-speech).
2. Stwórz pasek zakładek app/(tabs)/_layout.tsx (Frosted Glass TabBar z expo-blur i angielskimi etykietami: Explore, Player, Flashcards, Profile; ikony phosphor-react-native: regular -> fill przy aktywności), ekran wyszukiwarki app/(tabs)/index.tsx (wyszukiwarka z lupką MagnifyingGlass a'la YouTube, kafelki 16:9, CURATED_VIDEOS) oraz ekran odtwarzacza app/(tabs)/player.tsx (z płynną regulacją prędkości, WordToken.tsx, SubtitleTrack.tsx z 200ms debouncingiem i TranslationSheet.tsx opartym o @gorhom/bottom-sheet). Cały UI w 100% po angielsku.
3. Zaimplementuj synchronizację czasu (pętla 150ms playerRef.current.getCurrentTime()), podświetlanie aktywnego słowa i auto-scroll. Kliknięcie w słowo pauzuje wideo i otwiera TranslationSheet. Po zamknięciu arkusza wideo wznawia się jeśli autoResumeOnSheetClose === true.
4. Napisz testy apps/mobile/__tests__/subtitles.test.ts weryfikujące funkcje findActiveCue, findActiveWordIndex, stepPlaybackRate / clampPlaybackRate oraz pauzę w usePlayerStore.openTranslation.
5. Uruchom: bun test apps/mobile/__tests__/subtitles.test.ts.
BRAMKA: Potwierdź przejście testów. Brak zmian w zielonych testach.
```

---

### 🟢 PROMPT 7: Krawędziowy Cache R2 First w Aplikacji (Etap 7)
```text
Przeczytaj 03_AI_AND_PROMPTS.md (Sekcja 7 - fetchTranslationWithR2Cache), API_CONTRACT.md oraz STAGE_GATES_AND_TESTS.md (Etap 7).
Zadanie:
1. W apps/mobile zaimplementuj serwis pobierania tłumaczenia w lib/translation.ts (funkcja fetchTranslationWithR2Cache z wstrzykiwalnym fetchFn i autoryzacją JWT) i podepnij go do TranslationSheet.tsx:
   - Oblicz hash: computeTranslationHash(cleanWordToken(word), sentence, targetLang).
   - Wykonaj bezpośredni GET ${EXPO_PUBLIC_R2_URL}/${hash}.json.
   - Jeśli HTTP 200: zwróć dane z CDN natychmiast (fromCache: true, 0 obciążenia backendu!).
   - Jeśli HTTP 404: wywołaj backend POST /api/v1/translate z nagłówkiem Authorization Bearer JWT (fromCache: false).
2. Napisz testy apps/mobile/__tests__/r2-cache.test.ts sprawdzające scenariusz cache hit (brak zapytania do backendu) i cache miss (wywołanie fallbacku).
3. Uruchom: bun test apps/mobile/__tests__/r2-cache.test.ts.
BRAMKA: Wszystkie testy zdane w 100%.
```

---

### 🟢 PROMPT 8A: Baza Offline expo-sqlite & Dwukierunkowa Synchronizacja Fiszek
```text
Przeczytaj OFFLINE_SQLITE_AND_SYNC.md, DATA_FLOW_GLUE.md, STATE_MANAGEMENT.md (Sekcja 3), DATABASE_SCHEMA.sql oraz STAGE_GATES_AND_TESTS.md (Etap 8).
Zadanie:
1. W apps/mobile zaimplementuj:
   - lib/db/LocalFlashcardsRepository.ts: inicjalizacja tabeli SQLite local_flashcards (z funkcją setDbInstanceForTests(mockDb) do testów jednostkowych), metody getDueCards(userId, limit), insertCard(card) (ustawia sync_status = 'pending_insert'), recordSwipeSRS(cardId, srs) (ustawia sync_status = 'pending_update'), getPendingSyncCards(userId), markAsSynced(cardIds), upsertManyFromServer(cards).
   - lib/db/FlashcardSyncEngine.ts: silnik synchronizacji z metodami init(userId), pullFromServer(userId), scheduleSync(userId) (5s debounce) oraz flush(userId). Obsłuż automatyczny sync przy powrocie do sieci (NetInfo) i zmianie AppState na 'background' / 'inactive'.
   - stores/useFlashcardsStore.ts: zarządzanie stanem talii (deck, currentIndex, pendingSyncBuffer) i metodami setDeck, recordSwipe, undoLastSwipe, clearSyncBuffer.
2. Napisz testy jednostkowe apps/mobile/__tests__/sqlite-sync.test.ts sprawdzające:
   - lokalny zapis fiszki insertCard ustawiający sync_status = 'pending_insert',
   - aktualizację parametrów SRS po swipie recordSwipeSRS ustawiającą sync_status = 'pending_update',
   - poprawne oznaczanie 'synced' po pomyślnym flush() oraz nienadpisywanie zmian lokalnych przez pullFromServer().
3. Uruchom: bun test apps/mobile/__tests__/sqlite-sync.test.ts.
BRAMKA: Testy zielone. Nie modyfikuj istniejących testów.
```

---

### 🟢 PROMPT 8B: Tinder-Style 4-Way Swipe Deck & Reanimated 3D Flip (Fiszki)
```text
Przeczytaj COMPONENT_SPECS.md (Sekcja 4), SRS_ALGORITHM.md, DESIGN_SYSTEM.md (Sekcja 3), DATA_FLOW_GLUE.md oraz MOBILE_SCREENS_SPEC.md (Sekcja 3).
Zadanie:
1. W apps/mobile zaimplementuj:
   - components/flashcards/TinderCard.tsx: gesty w 4 kierunkach oparte o Gesture.Pan() i GestureDetector (react-native-gesture-handler) + płynny obrót 3D flip Gesture.Tap() (Reanimated v3 z perspektywą 1000 i backfaceVisibility: 'hidden') + haptyka expo-haptics (Left = Again/czerwona poświata, Down = Hard/bursztynowa poświata, Right = Good/zielona poświata, Up = Easy/błękitna poświata).
   - app/(tabs)/flashcards.tsx: ekran sesji powtórek fiszek w 100% po angielsku (licznik due cards, pasek postępu, stos kart TinderCard, przyciski manualne Again/Hard/Good/Easy/Undo, stan pusty "All reviews completed!").
2. Podepnij wywołanie zapisu słówek i całych zdań z TranslationSheet.tsx w odtwarzaczu (player.tsx) do LocalFlashcardsRepository.insertCard (generując unikalne ID przez Crypto.randomUUID() i pobierając userId z Supabase session) oraz FlashcardSyncEngine.scheduleSync(userId).
3. Zweryfikuj płynność animacji (60/120 fps) i brak glitchy wizualnych.
BRAMKA: Fiszki obracają się w 3D po kliknięciu i reagują na 4 kierunki swipe'a.
```

---

### 🟢 PROMPT 8C: Profil Użytkownika, Usunięcie Konta (Apple Guideline 5.1.1v) & RevenueCat Paywall
```text
Przeczytaj MOBILE_SCREENS_SPEC.md (Sekcja 4 i 5), 04_SAAS_BUSINESS_MODEL.md, AUTH_AND_SECURITY.md (Sekcja 5) oraz NAVIGATION_MAP.md.
Zadanie:
1. W apps/mobile zaimplementuj:
   - lib/purchases.ts: konfiguracja initPurchases(userId), fetchOfferings(), purchasePackage(pkg) oraz restoreUserPurchases().
   - app/(tabs)/profile.tsx: ekran profilu w 100% po angielsku (avatar, email, statystyki nauki, aktualna subskrypcja, przełącznik "Auto-resume video after closing translation", wybór akcentu en-US/en-GB, przycisk "Restore Purchases", przycisk "Sign Out" oraz czerwony przycisk "Delete Account" z potwierdzeniem Alert.alert).
   - app/(modals)/paywall.tsx: modal paywalla RevenueCat w języku angielskim z 2 planami miesięcznymi (Pro $8.99/mo, Master $16.99/mo) oraz 3-dniowym bezpłatnym okresem próbnym ("Start 3-Day Free Trial"), obsługą zakupu i przyciskiem "Restore Purchases".
2. Zaimplementuj w lib/account.ts (i wyeksportuj również w lib/auth.ts) funkcję deleteUserAccount() wywołującą DELETE /api/v1/user/account oraz wylogowującą użytkownika lokalnie.
BRAMKA: Paywall wyświetla oferty z RevenueCat, a profil umożliwia usunięcie konta zgodnie z wymogami App Store.
```

---

### 🟢 PROMPT 8D: RevenueCat Backend Webhooks & Usunięcie Konta (Backend)
```text
Przeczytaj 04_SAAS_BUSINESS_MODEL.md (Sekcja 5), 01_ARCHITECTURE.md (Sekcja 3), AUTH_AND_SECURITY.md (Sekcja 5), API_CONTRACT.md (Sekcja 5) oraz STAGE_GATES_AND_TESTS.md (Etap 8).
Zadanie:
1. W apps/backend zaimplementuj:
   - routes/revenuecat.routes.ts: endpoint POST /api/v1/revenuecat/webhook weryfikujący nagłówek Authorization względem zmiennej REVENUECAT_WEBHOOK_AUTH_HEADER, aktualizujący tabelę user_subscriptions (INITIAL_PURCHASE, RENEWAL, CANCELLATION, EXPIRATION).
   - w apps/backend/src/index.ts podepnij app.route('/', revenueCatRoutes) oraz endpoint DELETE /api/v1/user/account chroniony JWT, wywołujący supabaseAdmin.auth.admin.deleteUser(user.id) (kaskadowo usuwający profil, fiszki, historię i subskrypcję).
2. Napisz testy apps/backend/src/__tests__/revenuecat.test.ts sprawdzające:
   - odrzucenie webhooka przy błędnym nagłówku Authorization (HTTP 401),
   - aktualizację user_subscriptions do statusu 'trialing' (gdy period_type === 'TRIAL') lub 'active' (przy RENEWAL),
   - dezaktywację subskrypcji po EXPIRATION (plan_tier = 'free', status = 'inactive'),
   - usunięcie konta przez DELETE /api/v1/user/account.
3. Uruchom: bun test.
BRAMKA: Wszystkie testy w całym monorepo (Etapy 1-8) muszą być ZIELONE.
```

---

### 🟢 PROMPT 9: Konfiguracja EAS Build (Expo SDK 57) & Healthcheck Produkcyjny
```text
Przeczytaj DEPLOYMENT_AND_EAS.md, MOBILE_BOOTSTRAP_AND_CONFIG.md oraz DATABASE_AND_COST_OPTIMIZATION.md.
Zadanie:
1. Zweryfikuj i skonfiguruj apps/mobile/app.json oraz apps/mobile/eas.json:
   - expo.ios.bundleIdentifier: "com.softileo.learneng", usesAppleSignIn: true, brak niedozwolonego UIBackgroundModes: ["audio"].
   - expo.android.package: "com.softileo.learneng".
   - expo.plugins: skonfiguruj expo-router, expo-secure-store, expo-apple-authentication, react-native-purchases.
   - eas.json: profile development, preview oraz production dokładnie wg DEPLOYMENT_AND_EAS.md.
2. Zweryfikuj zmienne środowiskowe w .env.example i uruchom cały zestaw testów: `bun test`.
BRAMKA: 100% testów zielonych, kod kompiluje się bez błędów TypeScript.
```
