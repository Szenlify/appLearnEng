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
- **Hosting Backendu (Najbardziej Opłacalny):** **Fly.io** lub **Railway** (Darmowy / Hobby tier ~$0-$5/msc). Kontener Bun z jednym plikiem Dockerfile.
- **Zadania backendu:**
  - Fallback dla tłumaczeń: obsługa endpointu `POST /api/v1/translate` chronionego tokenem JWT Supabase, z weryfikacją limitu `evaluateQuota`, wywołującego **Google Gemini 2.5 Flash-Lite** (pakiet `@google/genai`).
  - Walidacja Zod przed uploadem i zapis wynikowych JSON-ów bezpośrednio do folderu głównego **Cloudflare R2** (`@aws-sdk/client-s3`).
  - Scraper napisów YouTube: wyciąganie napisów z `timedtext` bez płatnego API.
  - Obsługa subskrypcji i zakupów In-App Purchases: odbiór webhooków z **RevenueCat** (`/api/v1/revenuecat/webhook`) i synchronizacja uprawnień z tabelą `user_subscriptions`.
  - Obsługa usuwania konta (`DELETE /api/v1/user/account` zgodnie z wymogiem Apple App Store 5.1.1v).

---

### 1.3 Przechowywanie Danych i Cache Krawędziowy
- **Cache Krawędziowy (Static CDN):** **Cloudflare R2**
  - Wszystkie tłumaczenia zapisywane są jako `/{hash}.json` w roocie bucketa.
  - Aplikacja mobilna odpytuje bezpośrednio publiczny link R2 (`GET https://cache.applearneng.com/{hash}.json`), omijając backend i bazę.
  - 100% darmowy transfer (Zero Egress fees) i 10 mln darmowych odczytów miesięcznie.
- **Relacyjna Baza Danych & Auth:** **PostgreSQL na Supabase**
  - Darmowy pakiet: do 50 000 aktywnych użytkowników (MAU) i 500 MB bazy.
  - Autentykacja bezhasłowa: Sign in with Apple oraz Sign in with Google.
  - Zabezpieczenie przez Row Level Security (RLS).

---

## 2. Schemat Przepływu Danych

```
[ Aplikacja Mobilna (Expo / React Native - 100% English UI) ]
         |
         | 1. Użytkownik klika słowo w napisach
         |    Odtwarzacz automatycznie pauzuje
         |    Aplikacja generuje lokalnie: hash = sha256(cleanWordToken(word) + "_" + sentence + "_" + lang)
         v
[ Krok A: Bezpośredni GET do Cloudflare R2 ]
  GET https://cache.applearneng.com/{hash}.json
         |
         +---> [ CACHE HIT (HTTP 200) ]
         |     Zwrócenie JSON prosto z Cloudflare CDN (20-50ms)
         |     (0 obciążenia serwera, 0 zapytań do Gemini, $0 koszt transferu, brak zużycia limitu)
         |
         v
[ Jeśli CACHE MISS (HTTP 404) ]
         |
         | 2. Zapytanie do Backend API: POST /api/v1/translate (z tokenem Bearer JWT)
         v
[ Backend API (Hono na Bun) ]
         |
         | Sprawdzenie Quota Guard: czy użytkownik ma aktywny plan lub wolny darmowy limit?
         | 3. Wywołanie Google Gemini 2.5 Flash-Lite (@google/genai)
         v
[ Google Gemini 2.5 Flash-Lite ]
         |
         | 4. Zwrócenie ustrukturyzowanego JSON (IPA, definicja, phrasal verbs, context explanation)
         v
[ Backend API ]
         | 5. Walidacja schematu Zod (TranslationResponseSchema.parse)
         | 6. Zapis JSON do folderu głównego Cloudflare R2: /{hash}.json (Cache-Control: 1 rok)
         | 7. Zwrócenie odpowiedzi do aplikacji mobilnej
         v
[ Aplikacja Mobilna ]
         | 8. Wyświetlenie Bottom Sheet z tłumaczeniem
         | 9. Zapis do fiszek: natychmiastowy zapis do lokalnego expo-sqlite (0ms) + debounced batch upsert do Supabase
```

---

## 3. Główny Plik Serwera Backendu Hono (`apps/backend/src/index.ts`)

Wszystkie endpointy backendu są spięte w jednej instancji `app = new Hono()`, która jest eksportowana zarówno dla serwera Bun, jak i dla testów integracyjnych (`app.request(...)` w `captions.test.ts`, `search.test.ts`, `translate.test.ts`, `revenuecat.test.ts`):

```typescript
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createClient } from '@supabase/supabase-js';
import {
  computeTranslationHash,
  TranslateRequestBodySchema,
  TranslationResponseSchema,
  TranslationResponse,
} from '@learneng/shared';
import { YouTubeCaptionsService } from './services/captions.service';
import { YouTubeSearchService } from './services/search.service';
import { generateContextualTranslation } from './services/gemini.service';
import { R2StorageService } from './services/r2.service';
import { evaluateQuota } from './services/quota.service';
import { revenueCatRoutes } from './routes/revenuecat.routes';

export const app = new Hono();

app.use('/*', cors());

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

// 3. Fallback Tłumaczenia AI (Gemini 2.5 Flash-Lite -> Walidacja Zod -> Upload do Cloudflare R2 Root)
app.post('/api/v1/translate', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = TranslateRequestBodySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid request body', details: parsed.error.flatten() }, 400);
  }

  // Weryfikacja tożsamości użytkownika z nagłówka Authorization
  const authHeader = c.req.header('Authorization');
  let userId = parsed.data.userId;

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    if (user) userId = user.id;
  }

  // Sprawdzenie limitu Quota Guard w Supabase
  if (userId) {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('daily_ai_requests_count, last_request_reset_at')
      .eq('id', userId)
      .single();

    const { data: sub } = await supabaseAdmin
      .from('user_subscriptions')
      .select('plan_tier, status')
      .eq('user_id', userId)
      .single();

    const quotaResult = evaluateQuota({
      planTier: sub?.plan_tier || 'free',
      status: sub?.status || 'inactive',
      dailyAiRequestsCount: profile?.daily_ai_requests_count || 0,
      lastRequestResetAt: profile?.last_request_reset_at || new Date().toISOString(),
    });

    if (!quotaResult.allowed) {
      return c.json({ code: 'QUOTA_EXCEEDED', message: 'Daily free AI translation limit reached.' }, 429);
    }

    // Aktualizuj licznik zużycia w bazie
    await supabaseAdmin
      .from('profiles')
      .update({
        daily_ai_requests_count: quotaResult.newCount,
        ...(quotaResult.shouldResetTimestamp ? { last_request_reset_at: new Date().toISOString() } : {}),
      })
      .eq('id', userId);
  }

  const { word, sentence, targetLang, videoId } = parsed.data;
  const hash = computeTranslationHash(word, sentence, targetLang);

  const aiResult = await generateContextualTranslation(word, sentence, targetLang);
  const rawPayload = {
    hash,
    target_language: targetLang,
    ...aiResult,
    created_at: new Date().toISOString(),
  };

  // Bezpieczna walidacja Zod przed zapisem na 1 rok do R2
  const validatedPayload = TranslationResponseSchema.parse(rawPayload);
  await r2Service.saveTranslationToRoot(hash, validatedPayload);

  return c.json(validatedPayload, 200);
});

// 4. Moduł RevenueCat Webhooks (In-App Purchases)
app.route('/', revenueCatRoutes);

// 5. Usuwanie konta użytkownika (Apple App Store Guideline 5.1.1v)
app.delete('/api/v1/user/account', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return c.json({ error: 'Invalid user token' }, 401);

  // Usunięcie z auth.users kaskadowo czyści profile, subscriptions, flashcards
  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
  if (deleteError) return c.json({ error: deleteError.message }, 500);

  return c.json({ success: true, message: 'Account deleted successfully' }, 200);
});

export default {
  port: Number(process.env.PORT || 3000),
  fetch: app.fetch,
};
```
