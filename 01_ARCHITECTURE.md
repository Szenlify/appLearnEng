# 01. Architektura Systemu i Stack Technologiczny

## 1. Wybór Stacku Technologicznego

### 1.1 Aplikacja Mobilna (Cross-Platform iOS + Android)
- **Rekomendacja technologiczna:** **Flutter (Dart)** LUB **React Native (Expo)**
  - Zgodnie z założeniem biznesowym aplikacja od dnia 1 wspiera **iOS oraz Androida** z jednej bazy kodu.
  - **Kluczowe moduły aplikacji mobilnej:**
    - **Odtwarzacz Wideo:** Osadzony YouTube IFrame Player API z dwukierunkową komunikacją (pobieranie aktualnego czasu wideo i pauzowanie).
    - **Interaktywny Pasek Napisów:** Tokenizacja tekstu na klikalne słowa i frazy, synchronizacja czasu z wideo.
    - **Moduł Fiszek (Flashcards):** Zapisywanie słów oraz **całych zdań** do powtórek bezpośrednio z poziomu aplikacji, przeglądanie i algorytm interwałowy (SRS).
    - **Obsługa Płatności:** Integracja ze **Stripe** (Stripe Mobile SDK / Customer Portal) dla subskrypcji miesięcznych z 3-dniowym okresem próbnym (Trial).

---

### 1.2 Architektura Caching AI: Cloudflare R2 (Static Edge Cache)
- **Folder główny (Root Bucket) Cloudflare R2:**
  - Wszystkie przetłumaczone przez **Gemini 2.5 Lite** słowa i zdania są zapisywane w formacie JSON w głównym folderze bucketa R2 pod nazwą `/{hash}.json`.
  - Hash generowany jest deterministycznie z `hash(word + "_" + context_sentence)`.
  - **Bezpośredni Publiczny Link:** Aplikacja mobilna najpierw odpytuje publiczny link Cloudflare R2 (`GET https://cache.applearneng.com/{hash}.json`).
  - Jeśli plik istnieje (Cache Hit) -> odpowiedź zwracana jest w ~20–50 ms prosto z CDN krawędziowego.
  - Zero obciążenia własnego serwera backendu, zero zapytań do Gemini i **$0 opłat za transfer wychodzący (Zero Egress)**.

---

### 1.3 Backend API (Warstwa SaaS i Fallback AI)
- **Technologia:** **Node.js / Bun + TypeScript (Hono / Fastify)**
  - **Zadania backendu:**
    - **Fallback dla Cache Miss:** Gdy aplikacja otrzyma 404 z publicznego linku R2, uderza do endpointu `/api/v1/translate`. Backend wywołuje Gemini 2.5 Lite, zapisuje wynik pod `/{hash}.json` w głównym folderze Cloudflare R2 i zwraca odpowiedź aplikacji.
    - **Zarządzanie Użytkownikami i Fiszki:** Synchronizacja zapisanych przez użytkownika słówek i zdań w chmurze.
    - **Obsługa Płatności Stripe:** Integracja ze Stripe Billing (obsługa 3 planów miesięcznych, 3-dniowego trialu, webhooków i portalu klienta).
    - **Pobieranie Napisów z YouTube:** Pobieranie i parsowanie ścieżek `timedtext` do formatu JSON.

---

### 1.4 Baza Danych
- **Baza Danych:** **PostgreSQL (Supabase lub Neon)**
  - Profile użytkowników, powiązanie z ID klienta Stripe (`stripe_customer_id`, `stripe_subscription_id`), status subskrypcji.
  - Zapisane słówka i całe zdania do fiszek użytkowników, postępy nauki SRS.

---

## 2. Schemat Komunikacji i Przepływu Danych

```
[ Aplikacja Mobilna (iOS / Android) ]
         |
         | 1. Użytkownik klika słowo/frazę w napisach
         |    Wideo automatycznie pauzuje
         |    Aplikacja generuje lokalnie: hash(word + "_" + sentence)
         v
[ Krok A: Bezpośrednie zapytanie do Publicznego Linku Cloudflare R2 ]
  GET https://cache.applearneng.com/{hash}.json
         |
         +---> [ CACHE HIT (HTTP 200) ]
         |     Pobranie JSON bezpośrednio z Cloudflare CDN (20-50ms)
         |     (0 obciążenia serwera, 0 zapytań do Gemini, $0 koszt transferu)
         |
         v
[ Jeśli CACHE MISS (HTTP 404) ]
         |
         | 2. Zapytanie do Backend API: POST /api/v1/translate
         v
[ Backend API (Hono / Fastify) ]
         |
         | 3. Wywołanie Google Gemini 2.5 Lite API
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
         | 8. Opcjonalne kliknięcie: "Zapisz słowo" LUB "Zapisz całe zdanie" do Fiszek
```

---

## 3. Schemat Bazy Danych (Główne Tabele)

```sql
-- Użytkownicy i status subskrypcji Stripe
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    stripe_customer_id VARCHAR(255) UNIQUE,
    stripe_subscription_id VARCHAR(255),
    subscription_plan VARCHAR(30) DEFAULT 'free', -- 'starter', 'pro', 'master'
    subscription_status VARCHAR(50) DEFAULT 'trialing', -- 'trialing', 'active', 'canceled'
    trial_ends_at TIMESTAMP WITH TIME ZONE,
    daily_ai_requests_count INT DEFAULT 0
);

-- Zapisane Fiszki (Słowa oraz Całe Zdania)
CREATE TABLE user_flashcards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL DEFAULT 'word', -- 'word' LUB 'sentence'
    target_text VARCHAR(255) NOT NULL,        -- słowo lub całe zdanie
    translation TEXT NOT NULL,                -- przetłumaczone znaczenie
    context_sentence TEXT,                    -- zdanie z filmu (przy type='word')
    r2_cache_hash VARCHAR(64),                -- hash powiązany z plikiem w R2
    video_id VARCHAR(50),                     -- identyfikator filmu YouTube
    video_timestamp_sec INT,                  -- moment w filmie
    repetition_level INT DEFAULT 0,           -- stan algorytmu powtórek SRS
    next_review_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```
