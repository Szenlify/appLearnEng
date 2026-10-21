# 05. Plan Działań, Zakres MVP i Wdrożenie

## 1. Zakres MVP (Minimum Viable Product)

Aplikacja powstaje w jednym, zablokowanym stacku technologicznym: **React Native (Expo SDK 51+) + Hono na Bun + Supabase PostgreSQL + Cloudflare R2 + Stripe**.

### Funkcjonalności MVP:
1. **Ekran Odtwarzacza Wideo:**
   - Odtwarzacz `react-native-youtube-iframe`.
   - Pasek z napisami pod wideo z automatycznym wyśrodkowaniem tekstu.
2. **Krawędziowy Cache Tłumaczeń (Cloudflare R2 First):**
   - Kliknięcie słowa/zdania pauzuje wideo.
   - Aplikacja oblicza hash i wykonuje `GET` do Cloudflare R2 (`/{hash}.json`).
   - Przy 404: backend odpytuje **Gemini 2.5 Lite**, zapisuje wynik do roota R2 i zwraca do aplikacji.
3. **Zapisywanie Słów i Całych Zdań do Fiszek:**
   - Dwa przyciski w modalu: "Zapisz słówko" oraz "Zapisz całe zdanie".
   - Baza PostgreSQL przechowuje fiszki powiązane z użytkownikiem.
4. **Talia Fiszek w Stylu Tindera:**
   - Ekran z gestami w 4 kierunkach: Lewo (Powtórz), Dół (Trudne), Prawo (Dobrze), Góra (Łatwe).
   - Obrót 3D na tapnięcie (angielski przód, polski tył z wymową `expo-speech`).
5. **Płatności Stripe:**
   - 3 plany miesięczne: Starter, Pro, Master (każdy z 3-dniowym darmowym trialem).
   - Obsługa BLIK i kart w Polsce, EUR w Europie.

---

## 2. Harmonogram Wdrożenia

### Sprint 1: Monorepo, Odtwarzacz i Napisy (Tydzień 1-2)
- Inicjalizacja monorepo Turborepo z Bun: `apps/mobile` (Expo), `apps/backend` (Hono), `packages/shared`.
- Zbudowanie odtwarzacza wideo z synchronizacją napisów.
- Scraper napisów YouTube w backendzie.

### Sprint 2: Cloudflare R2 Cache i Gemini 2.5 Lite (Tydzień 3)
- Utworzenie bucketu Cloudflare R2 i podpięcie domeny publicznej.
- Implementacja logiki R2 First w aplikacji mobilnej.
- Endpoint `/api/v1/translate` z integracją Gemini 2.5 Lite i uploadem do R2.

### Sprint 3: Fiszki Tinder-Deck i Supabase (Tydzień 4)
- PostgreSQL na Supabase: tabele `profiles`, `user_flashcards`, `user_subscriptions`.
- Logowanie przez Supabase Auth (Apple Sign In, Google, Email).
- Ekran powtórek fiszek a'la Tinder z bibliotekami `react-native-reanimated` i `react-native-gesture-handler`.

### Sprint 4: Płatności Stripe i Publikacja (Tydzień 5-6)
- Stripe Checkout dla 3 planów miesięcznych z 3 dniami trialu.
- Ekran Paywalla i obsługa webhooków.
- Przygotowanie buildów produkcyjnych przez EAS Build (Expo Application Services) na iOS i Android.
