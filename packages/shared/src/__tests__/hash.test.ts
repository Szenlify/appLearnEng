import { describe, expect, it } from 'bun:test';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';
import {
  cleanWordToken,
  computeTranslationHash,
  TranslationResponseSchema,
  type TranslationResponse,
} from '../index';

describe('Stage 1: Shared Types, Token Cleaning & R2 SHA-256 Hashing', () => {
  describe('cleanWordToken', () => {
    it('strips leading and trailing punctuation (e.g. "attitude." -> "attitude")', () => {
      expect(cleanWordToken('attitude.')).toBe('attitude');
      expect(cleanWordToken('!hello?!')).toBe('hello');
      expect(cleanWordToken('"quoted"')).toBe('quoted');
      expect(cleanWordToken('(parentheses),')).toBe('parentheses');
    });

    it('normalizes typographic apostrophes ("don’t" -> "don\'t") and preserves internal apostrophes', () => {
      expect(cleanWordToken('don’t')).toBe("don't");
      expect(cleanWordToken('‘don’t!’')).toBe("don't");
      expect(cleanWordToken("can't.")).toBe("can't");
    });

    it('trims surrounding whitespace and ignores empty/whitespace-only characters', () => {
      expect(cleanWordToken('   attitude.   ')).toBe('attitude');
      expect(cleanWordToken('   put up with!  ')).toBe('put up with');
      expect(cleanWordToken('   ')).toBe('');
      expect(cleanWordToken('...')).toBe('');
    });
  });

  describe('computeTranslationHash', () => {
    it('returns a deterministic 64-character SHA-256 hex matching cleanWordToken(word) + "_" + sentence + "_" + lang', () => {
      const hash1 = computeTranslationHash('run out of', 'We ran out of milk.', 'pl');
      const hash2 = computeTranslationHash('run out of', 'We ran out of milk.', 'pl');

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/);

      const expectedRaw = 'run out of_we ran out of milk._pl';
      const expectedHex = bytesToHex(sha256(utf8ToBytes(expectedRaw)));
      expect(hash1).toBe(expectedHex);
    });

    it('is case-insensitive, trims whitespace, and strips edge punctuation on words', () => {
      const baseHash = computeTranslationHash('attitude', 'I love your attitude.', 'pl');
      const dirtyHash = computeTranslationHash('  Attitude! ', '  i LOVE your attitude.  ', ' PL ');
      expect(dirtyHash).toBe(baseHash);

      const apostropheHash1 = computeTranslationHash("don't", "I don't know.", 'pl');
      const apostropheHash2 = computeTranslationHash('  Don’t, ', "  I don't know. ", 'pl');
      expect(apostropheHash1).toBe(apostropheHash2);
    });

    it('defaults targetLang to "en" and produces distinct hashes for _en, _pl, _de, _es', () => {
      const word = 'resilient';
      const sentence = 'She is very resilient.';

      const hashDefault = computeTranslationHash(word, sentence);
      const hashEn = computeTranslationHash(word, sentence, 'en');
      const hashPl = computeTranslationHash(word, sentence, 'pl');
      const hashDe = computeTranslationHash(word, sentence, 'de');
      const hashEs = computeTranslationHash(word, sentence, 'es');

      expect(hashDefault).toBe(hashEn);

      const uniqueHashes = new Set([hashEn, hashPl, hashDe, hashEs]);
      expect(uniqueHashes.size).toBe(4);
    });
  });

  describe('TranslationResponseSchema (Zod validation)', () => {
    it('validates a well-formed TranslationResponse payload', () => {
      const validHash = computeTranslationHash('put up with', "I can't put up with this attitude.", 'pl');
      const payload: TranslationResponse = {
        hash: validHash,
        target_language: 'pl',
        selected_text: 'put up with',
        lemma: 'put up with',
        part_of_speech: 'phrasal verb',
        ipa: '/ˌpʊt ʌp ˈwɪð/',
        cefr_level: 'B2',
        simple_definition: 'Tolerować lub znosić coś nieprzyjemnego bez narzekania.',
        contextual_translation: 'znosić / tolerować',
        sentence_translation: 'Nie mogę już dłużej znosić takiego podejścia.',
        context_explanation: 'W tym zdaniu "put up with" wyraża frustrację mówiącego.',
        example_sentence_en: 'How do you put up with all that noise?',
        example_sentence_native: 'Jak wytrzymujesz ten cały hałas?',
        created_at: new Date().toISOString(),
      };

      const parsed = TranslationResponseSchema.safeParse(payload);
      expect(parsed.success).toBe(true);
    });

    it('rejects an invalid TranslationResponse payload (e.g. invalid hash length or CEFR level)', () => {
      const invalidPayload = {
        hash: 'too-short-hash',
        target_language: 'pl',
        selected_text: 'put up with',
        lemma: 'put up with',
        part_of_speech: 'phrasal verb',
        ipa: '/ˌpʊt ʌp ˈwɪð/',
        cefr_level: 'Z9',
        simple_definition: 'Definicja',
        contextual_translation: 'tłumaczenie',
        sentence_translation: 'Tłumaczenie zdania',
        context_explanation: 'Wyjaśnienie',
        example_sentence_en: 'Example',
        example_sentence_native: 'Przykład',
        created_at: new Date().toISOString(),
      };

      const parsed = TranslationResponseSchema.safeParse(invalidPayload);
      expect(parsed.success).toBe(false);
    });
  });
});
