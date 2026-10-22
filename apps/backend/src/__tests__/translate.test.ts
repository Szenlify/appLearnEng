import { afterEach, describe, expect, it, spyOn } from 'bun:test';
import { computeTranslationHash, TranslationResponseSchema } from '@learneng/shared';
import { app, r2Service, supabaseAdmin } from '../index';
import { ai } from '../services/gemini.service';
import { DAILY_FREE_AI_LIMIT, evaluateQuota } from '../services/quota.service';

describe('Stage 3: Gemini 2.5 Lite Fallback, Quota Guard & Cloudflare R2 Root Upload', () => {
  afterEach(() => {
    // Restore any spies after each test
  });

  describe('1. Request Body Zod Validation (HTTP 400)', () => {
    it('returns HTTP 400 when word or sentence is missing or empty', async () => {
      const resMissingWord = await app.request('/api/v1/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sentence: 'We ran out of milk.', targetLang: 'pl' }),
      });
      expect(resMissingWord.status).toBe(400);

      const resMissingSentence = await app.request('/api/v1/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: 'run out of', targetLang: 'pl' }),
      });
      expect(resMissingSentence.status).toBe(400);
    });
  });

  describe('2 & 3. R2 Root Key Upload (${hash}.json) & Complete TranslationResponse Payload', () => {
    it('generates deterministic hash, uploads ${hash}.json to Cloudflare R2 root bucket, and returns full TranslationResponse', async () => {
      const mockGeminiOutput = {
        selected_text: 'put up with',
        lemma: 'put up with',
        part_of_speech: 'phrasal verb',
        ipa: '/ˌpʊt ʌp ˈwɪð/',
        cefr_level: 'B2',
        simple_definition: 'Tolerować lub znosić kogoś lub coś nieprzyjemnego.',
        contextual_translation: 'znosić / tolerować',
        sentence_translation: 'Nie mogę już dłużej znosić takiego podejścia.',
        context_explanation: 'Zwrot "put up with" to phrasal verb wyrażający zniecierpliwienie.',
        example_sentence_en: 'She cannot put up with the noise anymore.',
        example_sentence_native: 'Ona nie może już dłużej znieść tego hałasu.',
      };

      const geminiSpy = spyOn(ai.models, 'generateContent').mockResolvedValue({
        text: JSON.stringify(mockGeminiOutput),
      } as any);

      let capturedCommandInput: any = null;
      const s3SendSpy = spyOn(r2Service.s3, 'send').mockImplementation((async (command: any) => {
        capturedCommandInput = command.input;
        return {};
      }) as any);

      const word = 'put up with';
      const sentence = "I can't put up with this attitude.";
      const targetLang = 'pl';
      const expectedHash = computeTranslationHash(word, sentence, targetLang);

      const res = await app.request('/api/v1/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word, sentence, targetLang }),
      });

      expect(res.status).toBe(200);
      const data: any = await res.json();

      // Verify all required fields
      expect(data.hash).toBe(expectedHash);
      expect(data.target_language).toBe('pl');
      expect(data.simple_definition).toBe(mockGeminiOutput.simple_definition);
      expect(data.contextual_translation).toBe(mockGeminiOutput.contextual_translation);
      expect(data.context_explanation).toBe(mockGeminiOutput.context_explanation);
      expect(data.ipa).toBe(mockGeminiOutput.ipa);
      expect(data.cefr_level).toBe('B2');
      expect(data.example_sentence_native).toBe(mockGeminiOutput.example_sentence_native);
      expect(typeof data.created_at).toBe('string');

      // Validate against Zod schema
      expect(TranslationResponseSchema.safeParse(data).success).toBe(true);

      // Verify S3 PutObjectCommand uploaded to root key `${hash}.json`
      expect(s3SendSpy).toHaveBeenCalledTimes(1);
      expect(capturedCommandInput).toBeDefined();
      expect(capturedCommandInput.Key).toBe(`${expectedHash}.json`);
      expect(capturedCommandInput.Key.includes('/')).toBe(false);
      expect(JSON.parse(capturedCommandInput.Body)).toEqual(data);

      geminiSpy.mockRestore();
      s3SendSpy.mockRestore();
    });
  });

  describe('4. Quota Guard (evaluateQuota & HTTP 429 QUOTA_EXCEEDED)', () => {
    it('blocks free tier after 30 requests within 24h (DAILY_FREE_AI_LIMIT = 30)', () => {
      expect(DAILY_FREE_AI_LIMIT).toBe(30);
      const now = new Date('2026-10-22T18:00:00.000Z');
      const twoHoursAgo = new Date('2026-10-22T16:00:00.000Z').toISOString();

      const allowedAt29 = evaluateQuota(
        {
          planTier: 'free',
          status: 'inactive',
          dailyAiRequestsCount: 29,
          lastRequestResetAt: twoHoursAgo,
        },
        now
      );
      expect(allowedAt29).toEqual({
        allowed: true,
        newCount: 30,
        shouldResetTimestamp: false,
      });

      const blockedAt30 = evaluateQuota(
        {
          planTier: 'free',
          status: 'inactive',
          dailyAiRequestsCount: 30,
          lastRequestResetAt: twoHoursAgo,
        },
        now
      );
      expect(blockedAt30).toEqual({
        allowed: false,
        newCount: 30,
        shouldResetTimestamp: false,
      });
    });

    it('automatically resets free tier counter after 24 hours', () => {
      const now = new Date('2026-10-23T18:00:00.000Z');
      const twentyFiveHoursAgo = new Date('2026-10-22T17:00:00.000Z').toISOString();

      const resetResult = evaluateQuota(
        {
          planTier: 'free',
          status: 'inactive',
          dailyAiRequestsCount: 30,
          lastRequestResetAt: twentyFiveHoursAgo,
        },
        now
      );
      expect(resetResult).toEqual({
        allowed: true,
        newCount: 1,
        shouldResetTimestamp: true,
      });
    });

    it('allows unlimited requests for pro and master plans in active or trialing status', () => {
      const now = new Date('2026-10-22T18:00:00.000Z');
      const oneHourAgo = new Date('2026-10-22T17:00:00.000Z').toISOString();

      const proTrialing = evaluateQuota(
        {
          planTier: 'pro',
          status: 'trialing',
          dailyAiRequestsCount: 150,
          lastRequestResetAt: oneHourAgo,
        },
        now
      );
      expect(proTrialing.allowed).toBe(true);
      expect(proTrialing.newCount).toBe(151);

      const masterActive = evaluateQuota(
        {
          planTier: 'master',
          status: 'active',
          dailyAiRequestsCount: 500,
          lastRequestResetAt: oneHourAgo,
        },
        now
      );
      expect(masterActive.allowed).toBe(true);
      expect(masterActive.newCount).toBe(501);
    });

    it('returns HTTP 429 QUOTA_EXCEEDED on POST /api/v1/translate when free user exceeds daily limit', async () => {
      const getUserSpy = spyOn(supabaseAdmin.auth, 'getUser').mockResolvedValue({
        data: { user: { id: 'user-free-limit-123' } },
        error: null,
      } as any);

      const fromSpy = spyOn(supabaseAdmin, 'from').mockImplementation(((table: string) => {
        if (table === 'profiles') {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({
                  data: {
                    daily_ai_requests_count: 30,
                    last_request_reset_at: new Date().toISOString(),
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: { plan_tier: 'free', status: 'inactive' },
                error: null,
              }),
            }),
          }),
        };
      }) as any);

      const res = await app.request('/api/v1/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer mock-jwt-token',
        },
        body: JSON.stringify({
          word: 'attitude',
          sentence: 'I can not stand this attitude.',
          targetLang: 'pl',
        }),
      });

      expect(res.status).toBe(429);
      const body: any = await res.json();
      expect(body.code).toBe('QUOTA_EXCEEDED');

      getUserSpy.mockRestore();
      fromSpy.mockRestore();
    });
  });
});
