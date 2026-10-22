import { cleanWordToken, computeTranslationHash, TranslationResponse } from '@learneng/shared';

export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface FetchTranslationParams {
  word: string;
  sentence: string;
  targetLang?: string;
  videoId?: string;
  authToken?: string;
  r2BaseUrl?: string;
  apiBaseUrl?: string;
  fetchFn?: FetchLike;
}

export async function fetchTranslationWithR2Cache({
  word,
  sentence,
  targetLang = 'en',
  videoId,
  authToken,
  r2BaseUrl = process.env.EXPO_PUBLIC_R2_URL || 'https://cache.applearneng.com',
  apiBaseUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000',
  fetchFn = fetch,
}: FetchTranslationParams): Promise<{ data: TranslationResponse; fromCache: boolean }> {
  const cleaned = cleanWordToken(word);
  const hash = computeTranslationHash(cleaned, sentence, targetLang);
  const r2Url = `${r2BaseUrl.replace(/\/$/, '')}/${hash}.json`;

  // 1. KROK A: Bezpośredni GET do publicznego bucketu Cloudflare R2
  const r2Response = await fetchFn(r2Url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (r2Response.ok) {
    const cachedData = (await r2Response.json()) as TranslationResponse;
    return { data: cachedData, fromCache: true };
  }

  // 2. KROK B (Fallback przy HTTP 404): Wywołanie backendu POST /api/v1/translate z JWT
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const fallbackResponse = await fetchFn(`${apiBaseUrl.replace(/\/$/, '')}/api/v1/translate`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ word: cleaned, sentence, targetLang, videoId }),
  });

  if (!fallbackResponse.ok) {
    if (fallbackResponse.status === 429) {
      throw new Error('QUOTA_EXCEEDED');
    }
    throw new Error(`TRANSLATION_FAILED_${fallbackResponse.status}`);
  }

  const freshData = (await fallbackResponse.json()) as TranslationResponse;
  return { data: freshData, fromCache: false };
}
