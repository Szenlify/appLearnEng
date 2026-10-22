import { Hono } from 'hono';
import { cors } from 'hono/cors';
import {
  computeTranslationHash,
  TranslateRequestBodySchema,
  TranslationResponseSchema,
} from '@learneng/shared';
import { supabaseAdmin } from './lib/supabase';
import { YouTubeCaptionsService } from './services/captions.service';
import { YouTubeSearchService } from './services/search.service';
import { generateContextualTranslation } from './services/gemini.service';
import { R2StorageService } from './services/r2.service';
import { evaluateQuota } from './services/quota.service';
import { revenueCatRoutes } from './routes/revenuecat.routes';

export { supabaseAdmin };

export const app = new Hono();

app.use('/*', cors());

export const captionsService = new YouTubeCaptionsService();
export const searchService = new YouTubeSearchService();
export const r2Service = new R2StorageService();

app.get('/health', (c) => c.json({ status: 'ok' }, 200));

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
    const {
      data: { user },
    } = await supabaseAdmin.auth.getUser(token);
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
      return c.json(
        { code: 'QUOTA_EXCEEDED', message: 'Daily free AI translation limit reached.' },
        429
      );
    }

    // Aktualizuj licznik zużycia w bazie
    await supabaseAdmin
      .from('profiles')
      .update({
        daily_ai_requests_count: quotaResult.newCount,
        ...(quotaResult.shouldResetTimestamp
          ? { last_request_reset_at: new Date().toISOString() }
          : {}),
      })
      .eq('id', userId);
  }

  const { word, sentence, targetLang } = parsed.data;
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
  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);
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
