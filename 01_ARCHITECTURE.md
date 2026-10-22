# 01. Architektura Systemu i Stack Technologiczny

## 1. Wybór Stacku Technologicznego (Zablokowany — Jeden Jedyny Wybór)

Nie stosujemy żadnych alternatywnych technologii. Cały projekt jest zdefiniowany pod jeden konkretny zestaw narzędzi:

### 1.1 Aplikacja Mobilna (Cross-Platform iOS + Android)
- **Framework:** **React Native z Expo (SDK 51+) w TypeScript**
  - **Architektura routingu:** **Expo Router (v3+)** (oparty na strukturze plików).
  - **Styling:** **NativeWind v4** (Tailwind CSS).
  - **Stan aplikacji:** **Zustand** (stan odtwarzacza, aktywne napisy) oraz **TanStack Query v5** (zapytania sieciowe i cache).
  - **Lokalna baza offline:** **expo-sqlite** do przechowywania fiszek i historii na urządzeniu.
  - **Odtwarzacz Wideo:** **react-native-youtube-iframe** (oficjalne YouTube IFrame API).
  - **Gesty i Animacje:** **react-native-reanimated v3** oraz **react-native-gesture-handler** (dla talii fiszek w stylu Tindera).
  - **Wymowa Audio:** **expo-speech** (natywna synteza na urządzeniu).
  - **Autentykacja:** **Supabase Auth** (`@supabase/supabase-js` z `expo-secure-store` i `expo-apple-authentication`).

---

### 1.2 Backend API (Warstwa SaaS i Fallback AI)
- **Środowisko uruchomieniowe (Runtime):** **Bun**
- **Framework:** **Hono** z pełnym wsparciem TypeScript i walidacją **Zod**.
- **Zadania backendu:**
  - Fallback dla tłumaczeń: obsługa endpointu `POST /api/v1/translate` wywołującego **Google Gemini 2.5 Lite** (pakiet `@google/genai`).
  - Zapis wynikowych JSON-ów bezpośrednio do folderu głównego **Cloudflare R2** (`@aws-sdk/client-s3`).
  - Scraper napisów YouTube: wyciąganie napisów z `timedtext` bez płatnego API.
  - Obsługa płatności: integracja ze **Stripe Billing** i odbiór webhooków.

---

### 1.3 Przechowywanie Danych i Cache Krawędziowy
- **Cache Krawędziowy (Static CDN):** **Cloudflare R2**
  - Wszystkie tłumaczenia zapisywane są jako `/{hash}.json` w roocie bucketa.
  - Aplikacja mobilna odpytuje bezpośrednio publiczny link R2 (`GET https://cache.applearneng.com/{hash}.json`), omijając backend i bazę.
- **Relacyjna Baza Danych:** **PostgreSQL na Supabase**
  - Wyłącznie przez **Supabase Transaction Pooler (port 6543)**.
  - Tabele: profile, subskrypcje Stripe, fiszki SRS oraz historia wideo.
  - Zabezpieczenie przez Row Level Security (RLS).

---

## 2. Schemat Przepływu Danych

```
[ Aplikacja Mobilna (Expo / React Native) ]
         |
         | 1. Użytkownik klika słowo w napisach
         |    Odtwarzacz automatycznie pauzuje
         |    Aplikacja generuje lokalnie: hash = sha256(word + "_" + sentence + "_" + lang)
         v
[ Krok A: Bezpośredni GET do Cloudflare R2 ]
  GET https://cache.applearneng.com/{hash}.json
         |
         +---> [ CACHE HIT (HTTP 200) ]
         |     Zwrócenie JSON prosto z Cloudflare CDN (20-50ms)
         |     (0 obciążenia serwera, 0 zapytań do Gemini, $0 koszt transferu)
         |
         v
[ Jeśli CACHE MISS (HTTP 404) ]
         |
         | 2. Zapytanie do Backend API: POST /api/v1/translate
         v
[ Backend API (Hono na Bun) ]
         |
         | 3. Wywołanie Google Gemini 2.5 Lite (@google/genai)
         v
[ Google Gemini 2.5 Lite ]
         |
         | 4. Zwrócenie ustrukturyzowanego JSON
         v
[ Backend API ]
         | 5. Zapis JSON do folderu głównego Cloudflare R2: /{hash}.json
         | 6. Zwrócenie odpowiedzi do aplikacji mobilnej
         v
[ Aplikacja Mobilna ]
         | 7. Wyświetlenie Bottom Sheet z tłumaczeniem
         | 8. Zapis do fiszek: natychmiastowy zapis do lokalnego `expo-sqlite` + zbiorcza synchronizacja (Batch Upsert) do Supabase PostgreSQL (`public.user_flashcards`)
```
