# PROMPT_CHAINS.md — Test-Driven Vibe Coding Pipeline (Step-by-Step)

Używaj poniższych promptów sekwencyjnie w **Cursorze (Composer / Agent mode)** lub **Claude Code**. 
Każdy prompt zawiera bramkę testową (*Stage Gate*). AI ma zakaz przechodzenia do kolejnego promptu, dopóki testy bieżącego etapu nie przejdą w 100%. **Pod żadnym pozorem nie wolno modyfikować zielonych testów!**

---

### 🟢 PROMPT 1: Monorepo, Typy & Testy Haszowania R2 (Etap 1)
```text
Przeczytaj uważnie AGENTS.md, .cursorrules, STAGE_GATES_AND_TESTS.md (Etap 1) oraz API_CONTRACT.md.
Zadanie:
1. Zainicjalizuj monorepo Turborepo z Bun:
   - apps/mobile: React Native Expo (SDK 51+), Expo Router (v3), TypeScript, NativeWind / Tailwind CSS, Zustand, TanStack Query.
   - apps/backend: Hono na Bun z TypeScript i Zod.
   - packages/shared: interfejsy z API_CONTRACT.md, schematy Zod oraz funkcja computeTranslationHash.
2. Napisz plik testowy packages/shared/src/__tests__/hash.test.ts weryfikujący:
   - determinizm hasha sha256 (word + "_" + sentence + "_" + lang),
   - trim i lowercase,
   - różnicę hashy dla _pl, _de, _es.
3. Uruchom: bun test packages/shared.
BRAMKA: Popraw kod, aż wszystkie testy będą zielone (PASS). Pod żadnym pozorem nie zmieniaj asercji testów.
```

---

### 🟢 PROMPT 2: YouTube Subtitles Scraper & Wyszukiwarka Wideo (Etap 2)
```text
Przeczytaj YOUTUBE_SCRAPER.md, API_CONTRACT.md oraz STAGE_GATES_AND_TESTS.md (Etap 2).
Zadanie:
1. W apps/backend zaimplementuj YouTubeCaptionsService wyciągający napisy z timedtext bez używania płatnego Google Cloud API.
2. Zaimplementuj endpoint GET /api/v1/captions?videoId=XYZ&lang=en zwracający SubtitleCue[] ze stokenizowanymi słowami.
3. Zaimplementuj YouTubeSearchService oraz endpoint GET /api/v1/search?q=XYZ wyszukujący filmy na YouTube z pamięcią podręczną 24h.
4. Napisz testy jednostkowe apps/backend/src/__tests__/captions.test.ts oraz search.test.ts sprawdzające:
   - parsowanie XML do SubtitleCue[],
   - poprawność tokenizacji słów ze znakami interpunkcyjnymi i apostrofami,
   - rzucanie błędu NO_CAPTIONS_AVAILABLE przy braku napisów,
   - zwracanie SearchVideoItem[] i działanie cache dla powtórzonego zapytania wyszukiwarki.
5. Uruchom: bun test apps/backend/src/__tests__/captions.test.ts apps/backend/src/__tests__/search.test.ts.
BRAMKA: Zapewnij 100% zielonych testów. NIE MODYFIKUJ testów z Etapu 1.
```

---

### 🟢 PROMPT 3: Fallback Gemini 2.5 Lite & Upload do R2 (Etap 3)
```text
Przeczytaj 03_AI_AND_PROMPTS.md, API_CONTRACT.md oraz STAGE_GATES_AND_TESTS.md (Etap 3).
Zadanie:
1. W apps/backend stwórz endpoint POST /api/v1/translate (użyj @google/genai i @aws-sdk/client-s3 dla Cloudflare R2).
2. Przygotuj structured output dla Gemini 2.5 Lite zwracający: selected_text, lemma, part_of_speech, ipa, cefr_level, simple_definition, contextual_translation, sentence_translation, context_explanation, example_sentence_en, example_sentence_native.
3. Po wygenerowaniu JSON zapisz go pod kluczem /{hash}.json w głównym folderze Cloudflare R2.
4. Napisz testy apps/backend/src/__tests__/translate.test.ts (mockując Gemini i S3 client) sprawdzające poprawność walidacji Zod, generowanie klucza R2 i strukturę odpowiedzi.
5. Uruchom: bun test apps/backend/src/__tests__/translate.test.ts.
BRAMKA: Upewnij się, że testy przechodzą. Żelazna zasada: nie ruszaj zielonych testów z poprzednich etapów!
```

---

### 🟢 PROMPT 4: Algorytm Powtórek SM-2 dla Fiszek (Etap 4)
```text
Przeczytaj SRS_ALGORITHM.md, DESIGN_SYSTEM.md (Sekcja 3) oraz STAGE_GATES_AND_TESTS.md (Etap 4).
Zadanie:
1. W packages/shared/src/srs.ts zaimplementuj funkcję calculateNextReview oraz calculateNextReviewFromSwipe mapującą gesty swipe'a:
   - Left (<-) -> Grade 0 (Powtórz)
   - Down (v) -> Grade 1 (Trudne)
   - Right (->) -> Grade 2 (Dobrze)
   - Up (^) -> Grade 3 (Łatwe)
2. Napisz testy packages/shared/src/__tests__/srs.test.ts sprawdzające:
   - reset repetitions przy Grade 0,
   - spadek easeFactor przy Grade 1,
   - wzrost interwału przy Grade 2 i Grade 3,
   - zachowanie dolnego limitu easeFactor >= 1.3.
3. Uruchom: bun test packages/shared/src/__tests__/srs.test.ts.
BRAMKA: Wszystkie testy muszą przejść na zielono. Nie modyfikuj istniejących testów.
```

---

### 🟢 PROMPT 5: Supabase Auth & Bezpieczny Storage (Etap 5)
```text
Przeczytaj DATABASE_SCHEMA.sql, AUTH_AND_SECURITY.md oraz STAGE_GATES_AND_TESTS.md (Etap 5).
Zadanie:
1. W apps/mobile zaimplementuj lib/supabase.ts z adapterem expo-secure-store.
2. Zbuduj ekran logowania w app/(auth)/login.tsx (wyłącznie szybkie logowanie Apple Sign In oraz Google Sign In – zero formularzy email/hasło).
3. Zaimplementuj AuthGuard w app/_layout.tsx przekierowujący niezalogowanych użytkowników.
4. Napisz testy apps/mobile/__tests__/auth.test.ts sprawdzające logikę adaptera i guardów nawigacji.
5. Uruchom: bun test apps/mobile/__tests__/auth.test.ts.
BRAMKA: Wszystkie testy zielone. Zakaz modyfikacji wcześniejszych testów.
```

---

### 🟢 PROMPT 6: Odtwarzacz Wideo & Wyszukiwarka YouTube (Etap 6)
```text
Przeczytaj DESIGN_SYSTEM.md, NAVIGATION_MAP.md, MOBILE_SCREENS_SPEC.md oraz STAGE_GATES_AND_TESTS.md (Etap 6).
Zadanie:
1. W apps/mobile stwórz ekran wyszukiwarki w stylu YouTube app/(tabs)/index.tsx (wyszukiwanie na żywo, kafelki 16:9, auto-detect schowka, polecane CEFR) oraz ekran odtwarzacza app/(tabs)/player.tsx z react-native-youtube-iframe i SubtitleTrack.
2. Zaimplementuj synchronizację czasu (pętla interwałowa 150ms odpytująca playerRef.current.getCurrentTime()), podświetlanie aktywnego słowa i automatyczne wyśrodkowanie tekstu (auto-scroll).
3. Kliknięcie w słowo pauzuje wideo i otwiera TranslationSheet.
4. Napisz testy apps/mobile/__tests__/subtitles.test.ts weryfikujące funkcję findActiveCue oraz wywoływanie pauzy odtwarzacza.
5. Uruchom: bun test apps/mobile/__tests__/subtitles.test.ts.
BRAMKA: Potwierdź przejście testów. Brak zmian w zielonych testach.
```

---

### 🟢 PROMPT 7: Krawędziowy Cache R2 First w Aplikacji (Etap 7)
```text
Przeczytaj 03_AI_AND_PROMPTS.md oraz STAGE_GATES_AND_TESTS.md (Etap 7).
Zadanie:
1. W apps/mobile zaimplementuj pobieranie tłumaczenia:
   - Oblicz hash: computeTranslationHash(word, sentence, nativeLanguage).
   - Wykonaj bezpośredni GET ${EXPO_PUBLIC_R2_URL}/${hash}.json.
   - Jeśli HTTP 200: zwróć dane z CDN natychmiast (0 obciążenia backendu!).
   - Jeśli HTTP 404: wywołaj backend POST /api/v1/translate.
2. Napisz testy apps/mobile/__tests__/r2-cache.test.ts sprawdzające scenariusz cache hit (brak zapytania do backendu) i cache miss (wywołanie fallbacku).
3. Uruchom: bun test apps/mobile/__tests__/r2-cache.test.ts.
BRAMKA: Wszystkie testy zdane w 100%.
```

---

### 🟢 PROMPT 8: Fiszki Tinder 4-Way Swipe & Subskrypcje Stripe (Etap 8)
```text
Przeczytaj 04_SAAS_BUSINESS_MODEL.md, DESIGN_SYSTEM.md (Sekcja 3) oraz STAGE_GATES_AND_TESTS.md (Etap 8).
Zadanie:
1. W apps/mobile zaimplementuj stos kart powtórek a'la Tinder app/(tabs)/flashcards.tsx z gestami 4-way swipe (Lewo, Dół, Prawo, Góra) oraz obrotem 3D na tapnięcie.
2. W apps/backend skonfiguruj Stripe Checkout z obsługą 3 planów miesięcznych, 3 dni darmowego trialu (trial_period_days: 3), walut PLN (z BLIK) i EUR (SEPA), oraz obsługę webhooków.
3. Napisz testy apps/backend/src/__tests__/stripe.test.ts sprawdzające parametry checkoutu i aktualizację planu w bazie po webhooku.
4. Uruchom: bun test.
BRAMKA: Wszystkie testy w całym monorepo (Etapy 1-8) muszą być ZIELONE.
```
