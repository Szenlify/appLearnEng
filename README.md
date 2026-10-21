# LearnEng - Aplikacja do nauki angielskiego z YouTube (iOS & Android)

Nowoczesna aplikacja mobilna cross-platform (iOS i Android) oraz ekosystem SaaS umożliwiający naukę języka angielskiego poprzez oglądanie wideo na YouTube z interaktywnymi napisami. Kliknięcie w dowolne słowo lub zdanie w locie generuje precyzyjne tłumaczenie kontekstowe za pomocą **Google Gemini 2.5 Lite** oraz publicznej pamięci podręcznej **Cloudflare R2**.

---

## 🎯 Główny cel projektu i Kluczowe Funkcjonalności

1. **Oglądanie autentycznych treści z YouTube:**
   - Synchronizacja wideo z interaktywnymi napisami.
2. **Natychmiastowe Tłumaczenie AI w Kontekście:**
   - Rozbijanie zdań na klikalne słowa i frazy.
   - Kliknięcie słowa automatycznie pauzuje odtwarzacz.
   - **Static Public Cache (Cloudflare R2):** Aplikacja najpierw sprawdza publiczny link Cloudflare R2 (`/{hash}.json`), co daje błyskawiczną odpowiedź (20-50 ms) przy zerowym obciążeniu serwera i braku kosztów transferu (Zero Egress).
   - Nowe słowa tłumaczy **Gemini 2.5 Lite** i zapisuje bezpośrednio do głównego folderu w R2.
3. **Zapisywanie Słów i Całych Zdań do Fiszek:**
   - Bezpośrednio z poziomu aplikacji użytkownik może zapisać zarówno pojedyncze słówko, jak i całe zdanie do bazy powtórek (Spaced Repetition System).
4. **Fiszki Tinder-Style z gestami w 4 osiach:**
   - Stos kart 3D: Lewo (Powtórz), Dół (Trudne), Prawo (Dobrze), Góra (Łatwe) + obrót 3D na tapnięcie.
5. **Autentykacja i Baza Danych:**
   - Supabase Auth (Sign in with Apple, Google, Email) + PostgreSQL z pełnym Row Level Security (RLS).
6. **Monetyzacja przez Stripe (3 Plany Subskrypcyjne + 3 Dni Trialu):**
   - Obsługa subskrypcji miesięcznych przez Stripe.
   - 3 plany: **Starter**, **Pro**, **Master**.
   - Każdy plan posiada **3-dniowy darmowy okres próbny (3-Day Free Trial)**.

---

## 🤖 Narzędzia i Dokumentacja do Vibe Codingu (Cursor / Claude Code)

Projekt jest w 100% przygotowany pod asystentów AI i szybkie programowanie:
* **[AGENTS.md](./AGENTS.md)** / **[.cursorrules](./.cursorrules)** – Zasady, architektura monorepo, standardy TypeScript i żelazne reguły (Invariants).
* **[API_CONTRACT.md](./API_CONTRACT.md)** – Niezmienne typy, schematy Zod, schemat pliku w R2 i kontrakty endpointów.
* **[DATABASE_SCHEMA.sql](./DATABASE_SCHEMA.sql)** – Kompletna struktura bazy danych PostgreSQL (Supabase) z RLS i triggerami.
* **[AUTH_AND_SECURITY.md](./AUTH_AND_SECURITY.md)** – Implementacja logowania Apple, Google, Email oraz bezpiecznego magazynu tokenów (SecureStore).
* **[NAVIGATION_MAP.md](./NAVIGATION_MAP.md)** – Struktura ekranów Expo Router, szklany pasek nawigacji (Frosted Glass TabBar) i modale.
* **[DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md)** – Tokeny kolorów (Dark OLED), typografia, zachowanie odtwarzacza i stosu fiszek a'la Tinder.
* **[SRS_ALGORITHM.md](./SRS_ALGORITHM.md)** – Algorytm powtórek interwałowych SM-2 powiązany z 4 kierunkami swipe'a.
* **[YOUTUBE_SCRAPER.md](./YOUTUBE_SCRAPER.md)** – Gotowa implementacja scrapowania napisów z YouTube bez płatnego API.
* **[PROMPT_CHAINS.md](./PROMPT_CHAINS.md)** – Gotowe prompty krok po kroku do wklejania do AI w celu generowania kodu (kroki 1-8).
* **[.env.example](./.env.example)** – Pełny szablon wymaganych zmiennych środowiskowych.

---

## 📚 Spis Podstawowej Dokumentacji Projektu

1. **[01_ARCHITECTURE.md](./01_ARCHITECTURE.md)** – Architektura systemu, stack cross-platform (Flutter / React Native), schemat publicznego linku Cloudflare R2 i baza PostgreSQL.
2. **[02_YOUTUBE_INTEGRATION.md](./02_YOUTUBE_INTEGRATION.md)** – Odtwarzacz YouTube (IFrame API), pobieranie transkrypcji, synchronizacja czasu z napisami i zgodność z regulaminem YouTube.
3. **[03_AI_AND_PROMPTS.md](./03_AI_AND_PROMPTS.md)** – Integracja z Gemini 2.5 Lite, algorytm haszowania słów i zdań oraz bezkosztowy cache w folderze głównym Cloudflare R2.
4. **[04_SAAS_BUSINESS_MODEL.md](./04_SAAS_BUSINESS_MODEL.md)** – Model biznesowy SaaS, 3 plany subskrypcyjne, 3 dni trialu, integracja Stripe i ekonomia jednostkowa (>90% marży).
5. **[05_ROADMAP_AND_MVP.md](./05_ROADMAP_AND_MVP.md)** – Zakres MVP krok po kroku, wdrożenie cross-platform i plan sprintów.
