import { describe, expect, it } from 'bun:test';
import { computeTranslationHash, type TranslationResponse } from '@learneng/shared';
import { fetchTranslationWithR2Cache } from '../lib/translation';

const SAMPLE_TRANSLATION: TranslationResponse = {
  hash: computeTranslationHash('attitude', "I can't put up with this attitude.", 'pl'),
  target_language: 'pl',
  selected_text: 'attitude',
  lemma: 'attitude',
  part_of_speech: 'noun',
  ipa: '/ˈæt.ɪ.tjuːd/',
  cefr_level: 'B1',
  simple_definition: 'Sposób myślenia lub odczuwania wobec kogoś lub czegoś.',
  contextual_translation: 'podejście / nastawienie',
  sentence_translation: 'Nie mogę już dłużej znosić takiego podejścia.',
  context_explanation: 'Słowo "attitude" w tym kontekście oznacza negatywne, aroganckie zachowanie.',
  example_sentence_en: 'She has a very positive attitude towards work.',
  example_sentence_native: 'Ona ma bardzo pozytywne nastawienie do pracy.',
  created_at: '2026-10-22T18:00:00.000Z',
};

describe('Stage 7: R2 Edge Cache First Translation Client (fetchTranslationWithR2Cache)', () => {
  it('1. Cache HIT (HTTP 200 from R2 CDN): returns data immediately with fromCache: true and does NOT call backend API', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];

    const mockFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      calls.push({ url: String(input), init });
      return new Response(JSON.stringify(SAMPLE_TRANSLATION), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const expectedHash = computeTranslationHash(
      'attitude',
      "I can't put up with this attitude.",
      'pl'
    );

    const result = await fetchTranslationWithR2Cache({
      word: 'attitude.',
      sentence: "I can't put up with this attitude.",
      targetLang: 'pl',
      r2BaseUrl: 'https://cache.applearneng.com',
      apiBaseUrl: 'https://api.applearneng.com',
      authToken: 'jwt-token-123',
      fetchFn: mockFetch,
    });

    expect(result.fromCache).toBe(true);
    expect(result.data).toEqual(SAMPLE_TRANSLATION);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(`https://cache.applearneng.com/${expectedHash}.json`);
    expect(calls[0].init?.method).toBe('GET');
  });

  it('2 & 3. Cache MISS (HTTP 404 from R2 CDN): immediately calls POST /api/v1/translate with Bearer JWT and returns fallback data', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];

    const mockFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = String(input);
      calls.push({ url, init });

      if (url.startsWith('https://cache.applearneng.com/')) {
        return new Response('Not Found', { status: 404 });
      }

      if (url === 'https://api.applearneng.com/api/v1/translate') {
        return new Response(JSON.stringify(SAMPLE_TRANSLATION), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response('Unexpected URL', { status: 500 });
    };

    const expectedHash = computeTranslationHash(
      'attitude',
      "I can't put up with this attitude.",
      'pl'
    );

    const result = await fetchTranslationWithR2Cache({
      word: 'attitude.',
      sentence: "I can't put up with this attitude.",
      targetLang: 'pl',
      videoId: 'UF8uR6Z6KLc',
      r2BaseUrl: 'https://cache.applearneng.com',
      apiBaseUrl: 'https://api.applearneng.com',
      authToken: 'jwt-token-xyz',
      fetchFn: mockFetch,
    });

    expect(result.fromCache).toBe(false);
    expect(result.data).toEqual(SAMPLE_TRANSLATION);
    expect(calls).toHaveLength(2);

    // Step A: Direct R2 CDN GET
    expect(calls[0].url).toBe(`https://cache.applearneng.com/${expectedHash}.json`);
    expect(calls[0].init?.method).toBe('GET');

    // Step B: Fallback Backend POST /api/v1/translate with cleaned word and Bearer token
    expect(calls[1].url).toBe('https://api.applearneng.com/api/v1/translate');
    expect(calls[1].init?.method).toBe('POST');
    expect((calls[1].init?.headers as Record<string, string>)['Authorization']).toBe(
      'Bearer jwt-token-xyz'
    );
    expect(JSON.parse(String(calls[1].init?.body))).toEqual({
      word: 'attitude',
      sentence: "I can't put up with this attitude.",
      targetLang: 'pl',
      videoId: 'UF8uR6Z6KLc',
    });
  });

  it('throws QUOTA_EXCEEDED when backend fallback returns HTTP 429', async () => {
    const mockFetch = async (input: RequestInfo | URL): Promise<Response> => {
      const url = String(input);
      if (url.includes('cache.applearneng.com')) {
        return new Response('Not Found', { status: 404 });
      }
      return new Response(JSON.stringify({ code: 'QUOTA_EXCEEDED' }), { status: 429 });
    };

    await expect(
      fetchTranslationWithR2Cache({
        word: 'attitude',
        sentence: "I can't put up with this attitude.",
        targetLang: 'pl',
        fetchFn: mockFetch,
      })
    ).rejects.toThrow('QUOTA_EXCEEDED');
  });
});
