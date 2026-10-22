import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';

/**
 * Strips leading/trailing punctuation from a tapped subtitle token
 * while preserving internal apostrophes ("don't") and phrase spaces ("put up with").
 */
export function cleanWordToken(rawToken: string): string {
  return rawToken
    .replace(/[‘’]/g, "'")
    .trim()
    .replace(/^[^\w]+|[^\w]+$/g, '');
}

export function computeTranslationHash(word: string, sentence: string, targetLang = 'en'): string {
  const normalizedWord = cleanWordToken(word).toLowerCase();
  const normalizedSentence = sentence.trim().toLowerCase();
  const normalizedLang = targetLang.trim().toLowerCase();
  const rawKey = `${normalizedWord}_${normalizedSentence}_${normalizedLang}`;
  return bytesToHex(sha256(utf8ToBytes(rawKey)));
}
