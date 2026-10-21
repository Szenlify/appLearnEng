# LearnEng - Aplikacja do nauki angielskiego z YouTube (iOS & Android)

Nowoczesna aplikacja mobilna cross-platform (iOS i Android) oraz ekosystem SaaS umożliwiający naukę języka angielskiego poprzez oglądanie wideo na YouTube z interaktywnymi napisami. Kliknięcie w dowolne słowo lub zdanie w locie generuje precyzyjne tłumaczenie kontekstowe za pomocą **Google Gemini 2.5 Lite** oraz publicznej pamięci podręcznej **Cloudflare R2**.

---

## 🎯 Główny cel projektu i Kluczowe Funkcjonalności

1. **Oglądanie autentycznych treści z YouTube:**
   - Synchronizacja wideo z interaktywnymi napisami (`react-native-youtube-iframe`).
2. **Natychmiastowe Tłumaczenie AI w Kontekście:**
   - Rozbijanie zdań na klikalne słowa i frazy.
   - Kliknięcie słowa automatycznie pauzuje odtwarzacz.
   - **Static Public Cache (Cloudflare R2):** Aplikacja najpierw sprawdza publiczny link Cloudflare R2 (`/{hash}.json`), co daje błyskawiczną odpowiedź (20-50 ms) przy zerowym obciążeniu serwera i braku kosztów transferu (Zero Egress).
   - Nowe słowa tłumaczy **Gemini 2.5 Lite** i zapisuje bezpośrednio do głównego folderu w R2.
3. **Wymowa Audio (TTS):**
   - Wyłącznie natywna synteza mowy na urządzeniu przez `expo-speech` (0 ms opóźnienia, 100% offline, $0 kosztów).
4. **Zapisywanie Słów i Całych Zdań do Fiszek:**
   - Bezpośrednio z poziomu aplikacji użytkownik może zapisać zarówno pojedyncze słówko, jak i całe zdanie do bazy powtórek (Spaced Repetition System).
5. **Fiszki Tinder-Style z gestami w 4 osiach:**
   - Stos kart 3D: Lewo (Powtórz), Dół (Trudne), Prawo (Dobrze), Góra (Łatwe) + obrót 3D na tapnięcie.
6. **Autentykacja i Baza Danych:**
   - Supabase Auth (Sign in with Apple, Google, Email) + PostgreSQL na Supabase z pełnym Row Level Security (RLS).
7. **Monetyzacja przez Stripe (Domyślnie USD z lokalizacją walut):**
   - 3 plany miesięczne: **Starter ($4.99)**, **Pro ($8.99)**, **Master ($16.99)**.
   - Każdy plan posiada **3-dniowy darmowy okres próbny (3-Day Free Trial)**.
   - Dynamiczna lokalizacja: PLN z BLIK-iem w Polsce, EUR w Europie.

---

## 🤖 Narzędzia i Dokumentacja do Vibe Codingu (Cursor / Claude Code)

Projekt jest w 100% przygotowany pod asystentów AI i szybkie programowanie bez zgadywania:
* **[AGENTS.md](./AGENTS.md)** / **[.cursorrules](./.cursorrules)** – Główne zasady, żelazny zakaz ruszania zielonych testów, monorepo Bun + Expo.
* **[API_CONTRACT.md](./API_CONTRACT.md)** – Niezmienne typy, schematy Zod, schemat pliku w R2 i kontrakty endpointów.
* **[DATABASE_SCHEMA.sql](./DATABASE_SCHEMA.sql)** – Kompletna struktura bazy danych PostgreSQL (Supabase) z RLS i triggerami.
* **[DATABASE_AND_COST_OPTIMIZATION.md](./DATABASE_AND_COST_OPTIMIZATION.md)** – Architektura TTS, redukcja 90%+ zapytań do SQL, indeksy i batch sync.
* **[STATE_MANAGEMENT.md](./STATE_MANAGEMENT.md)** – Zustand (`usePlayerStore`, `useFlashcardsStore`) oraz TanStack Query v5.
* **[EDGE_CASES_AND_ERRORS.md](./EDGE_CASES_AND_ERRORS.md)** – Obsługa braku napisów, błędnych linków YT, debouncing klikania i tryb offline.
* **[COMPONENT_SPECS.md](./COMPONENT_SPECS.md)** – Dokładna specyfikacja propsów, styli i animacji komponentów UI.
* **[DEPLOYMENT_AND_EAS.md](./DEPLOYMENT_AND_EAS.md)** – Konfiguracja `app.json` oraz `eas.json` do publikacji w App Store i Google Play.
* **[AUTH_AND_SECURITY.md](./AUTH_AND_SECURITY.md)** – Implementacja logowania Apple, Google, Email oraz bezpiecznego magazynu tokenów (SecureStore).
* **[NAVIGATION_MAP.md](./NAVIGATION_MAP.md)** – Struktura ekranów Expo Router, szklany pasek nawigacji (Frosted Glass TabBar) i modale.
* **[DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md)** – Tokeny kolorów (Dark OLED), typografia, zachowanie odtwarzacza i stosu fiszek a'la Tinder.
* **[SRS_ALGORITHM.md](./SRS_ALGORITHM.md)** – Algorytm powtórek interwałowych SM-2 powiązany z 4 kierunkami swipe'a.
* **[YOUTUBE_SCRAPER.md](./YOUTUBE_SCRAPER.md)** – Gotowa implementacja scrapowania napisów z YouTube bez płatnego API.
* **[STAGE_GATES_AND_TESTS.md](./STAGE_GATES_AND_TESTS.md)** – 8 izolowanych etapów z bramkami testowymi.
* **[PROMPT_CHAINS.md](./PROMPT_CHAINS.md)** – Gotowe prompty krok po kroku do wklejania do AI w celu generowania kodu (kroki 1-8).
* **[.env.example](./.env.example)** – Pełny szablon wymaganych zmiennych środowiskowych.

---

## 📚 Spis Podstawowej Dokumentacji Projektu

1. **[01_ARCHITECTURE.md](./01_ARCHITECTURE.md)** – Zablokowana architektura systemu, stack React Native Expo + Bun Hono, Cloudflare R2 i Supabase.
2. **[02_YOUTUBE_INTEGRATION.md](./02_YOUTUBE_INTEGRATION.md)** – Odtwarzacz `react-native-youtube-iframe`, transkrypcje i synchronizacja czasu z napisami.
3. **[03_AI_AND_PROMPTS.md](./03_AI_AND_PROMPTS.md)** – Integracja z Gemini 2.5 Lite, algorytm haszowania słów i zdań oraz bezkosztowy cache w Cloudflare R2.
4. **[04_SAAS_BUSINESS_MODEL.md](./04_SAAS_BUSINESS_MODEL.md)** – Model biznesowy SaaS, 3 plany subskrypcyjne (USD / EUR / PLN), Stripe z BLIK i ekonomia jednostkowa (>90% marży).
5. **[05_ROADMAP_AND_MVP.md](./05_ROADMAP_AND_MVP.md)** – Zakres MVP krok po kroku i plan sprintów wdrożeniowych.
