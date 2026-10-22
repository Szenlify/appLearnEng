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

---

## 3. Główny Plik Serwera Backendu Hono (`apps/backend/src/index.ts`)

Wszystkie endpointy backendu są spięte w jednej instancji `app = new Hono()`, która jest eksportowana zarówno dla serwera Bun, jak i dla testów integracyjnych (`app.request(...)` w `captions.test.ts`, `search.test.ts`, `translate.test.ts`, `stripe.test.ts`):

```typescript
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { computeTranslationHash, TranslateRequestBodySchema, TranslationResponse } from '@learneng/shared';
import { YouTubeCaptionsService } from './services/captions.service';
import { YouTubeSearchService } from './services/search.service';
import { generateContextualTranslation } from './services/gemini.service';
import { R2StorageService } from './services/r2.service';
import { createSubscriptionCheckout, handleStripeWebhook } from './routes/stripe.routes';

export const app = new Hono();

app.use('/*', cors());

const captionsService = new YouTubeCaptionsService();
const searchService = new YouTubeSearchService();
const r2Service = new R2StorageService();

// 1. Pobieranie napisów YouTube
app.get('/api/v1/captions', async (c) => {
  const videoId = c.req.query('videoId');
  if (!videoId) return c.json({ error: 'Missing videoId' }, 400);

  try {
    const result = await captionsService.getCaptions(videoId);
    return c.json(result, 200);
  } catch (err: any) {
    if (err.message?.includes('NO_CAPTIONS_AVAILABLE')) {
      return c.json({ code: 'NO_CAPTIONS_AVAILABLE', message: 'No English transcript found' }, 422);
    }
    return c.json({ code: 'CAPTIONS_ERROR', message: err.message }, 500);
  }
});

// 2. Wyszukiwarka wideo YouTube (z 24h cache)
app.get('/api/v1/search', async (c) => {
  const q = c.req.query('q') || '';
  if (!q.trim()) return c.json({ query: '', items: [], cached: false }, 200);

  const result = await searchService.search(q, process.env.YOUTUBE_API_KEY);
  return c.json(result, 200);
});

// 3. Fallback Tłumaczenia AI (Gemini 2.5 Lite -> Upload do Cloudflare R2 Root)
app.post('/api/v1/translate', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = TranslateRequestBodySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid request body', details: parsed.error.flatten() }, 400);
  }

  const { word, sentence, targetLang, videoId } = parsed.data;
  const hash = computeTranslationHash(word, sentence, targetLang);

  const aiResult = await generateContextualTranslation(word, sentence, targetLang);
  const fullPayload: TranslationResponse = {
    hash,
    target_language: targetLang,
    ...aiResult,
    created_at: new Date().toISOString(),
  };

  await r2Service.saveTranslationToRoot(hash, fullPayload);
  return c.json(fullPayload, 200);
});

// 4. Tworzenie sesji Stripe Checkout (3-Day Free Trial + Multi-Currency)
app.post('/api/v1/stripe/checkout', async (c) => {
  const body = await c.req.json();
  const session = await createSubscriptionCheckout(body);
  return c.json({ url: session.url, id: session.id }, 200);
});

// 5. Odbiór Webhooków Stripe (Bun constructEventAsync)
app.post('/api/v1/stripe/webhook', async (c) => {
  const sig = c.req.header('stripe-signature') || '';
  const rawBody = await c.req.text();
  const result = await handleStripeWebhook(rawBody, sig);
  return c.json(result, 200);
});

export default {
  port: Number(process.env.PORT || 3000),
  fetch: app.fetch,
};
```
