# 05. Plan Działań, Zakres MVP i Wdrożenie

## 1. Zakres MVP (Minimum Viable Product)

Aplikacja powstaje w jednym, zablokowanym stacku technologicznym: **React Native (Expo SDK 57+) + Hono na Bun + Supabase PostgreSQL + Cloudflare R2 + RevenueCat (In-App Purchases)**. Interfejs użytkownika w wersji 1.0 jest w **100% w języku angielskim**.

### Funkcjonalności MVP:
1. **Ekran Odtwarzacza Wideo:**
   - Odtwarzacz `react-native-youtube-iframe` (zgodny z ToS YouTube).
   - Pasek z napisami pod wideo z automatycznym centrowaniem i podświetlaniem aktualnie wymawianego słowa (`isActiveWord`).
   - Płynna regulacja prędkości odtwarzania (0.25x – 2.00x).
2. **Krawędziowy Cache Tłumaczeń (Cloudflare R2 First):**
   - Kliknięcie słowa pauzuje wideo i otwiera `TranslationSheet` (`@gorhom/bottom-sheet`).
   - Aplikacja oblicza hash i wykonuje bezpośredni `GET` do Cloudflare R2 CDN (`/{hash}.json`).
   - Przy 404: backend (zabezpieczony autoryzacją JWT i licznikiem Quota Guard) odpytuje **Gemini 2.5 Lite**, waliduje wynik przez Zod, zapisuje do roota R2 i zwraca do aplikacji.
3. **Zapisywanie Słów i Całych Zdań do Fiszek:**
   - Dwa przyciski w arkuszu: "Save Word" oraz "Save Sentence" z haptyką `expo-haptics`.
   - Baza PostgreSQL przechowuje fiszki powiązane z użytkownikiem, z lokalną bazą `expo-sqlite` działającą offline.
4. **Talia Fiszek w Stylu Tindera:**
   - Ekran z gestami w 4 kierunkach: Left (Again), Down (Hard), Right (Good), Up (Easy).
   - Obrót 3D na tapnięcie (awers z wymową `expo-speech`, rewers z definicją i zdaniem kontekstowym).
5. **Subskrypcje RevenueCat (In-App Purchases):**
   - Natywny StoreKit 2 (iOS) i Google Play Billing (Android) przez `react-native-purchases`.
   - 2 plany miesięczne: Pro ($8.99/mo), Master ($16.99/mo) — każdy z 3-dniowym bezpłatnym okresem próbnym ("Start 3-Day Free Trial").
   - Zgodność z Apple Guideline 3.1.1 (brak ryzyka odrzucenia za zewnętrzne płatności) oraz Guideline 5.1.1v (przycisk "Delete Account" w profilu).

---

## 2. Harmonogram Wdrożenia

### Sprint 1: Monorepo, Odtwarzacz i Napisy (Tydzień 1-2)
- Inicjalizacja monorepo Turborepo z Bun: `apps/mobile` (Expo SDK 57), `apps/backend` (Hono), `packages/shared`.
- Zbudowanie odtwarzacza wideo z synchronizacją napisów.
- Scraper napisów YouTube w backendzie z normalizacją apostrofów typograficznych.

### Sprint 2: Cloudflare R2 Cache i Gemini 2.5 Lite (Tydzień 3)
- Utworzenie bucketu Cloudflare R2 i podpięcie domeny publicznej CDN.
- Implementacja logiki R2 First w aplikacji mobilnej.
- Endpoint `/api/v1/translate` chroniony JWT z integracją Gemini 2.5 Lite, walidacją Zod i uploadem do R2.

### Sprint 3: Fiszki Tinder-Deck, SQLite Offline i Supabase (Tydzień 4)
- PostgreSQL na Supabase: tabele `profiles`, `user_flashcards`, `user_watch_history`, `user_subscriptions`.
- Logowanie przez Supabase Auth (wyłącznie Apple Sign In oraz Google Sign In).
- Baza offline `expo-sqlite` i dwukierunkowy silnik synchronizacji `FlashcardSyncEngine`.
- Ekran powtórek fiszek a'la Tinder z bibliotekami `react-native-reanimated` (v3) i `react-native-gesture-handler`.

### Sprint 4: RevenueCat, Usunięcie Konta i EAS Build (Tydzień 5-6)
- Integracja RevenueCat (`react-native-purchases`) dla 2 płatnych planów miesięcznych (Pro, Master) z 3 dniami trialu + plan Free.
- Ekran Paywalla, obsługa przywracania zakupów ("Restore Purchases") i webhook backendu `/api/v1/revenuecat/webhook`.
- Bezpieczne usuwanie konta (`DELETE /api/v1/user/account`).
- Przygotowanie i certyfikacja buildów produkcyjnych przez EAS Build (Expo Application Services) na iOS App Store i Google Play.
