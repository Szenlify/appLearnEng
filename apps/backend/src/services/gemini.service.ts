import { GoogleGenAI, Type } from '@google/genai';

export const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || 'test-gemini-api-key',
});

export async function generateContextualTranslation(
  word: string,
  sentence: string,
  targetLang = 'en'
) {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-lite',
    contents: JSON.stringify({
      target_word_or_phrase: word,
      context_sentence: sentence,
      target_language: targetLang,
    }),
    config: {
      systemInstruction: `You are an expert English language teacher. Analyze the English word or phrase ("target_word_or_phrase") inside the given video subtitle sentence ("context_sentence") and return structured JSON explanations translated into "target_language".
CRITICAL PHRASAL VERB & IDIOM RULE:
If the user tapped a single word (e.g. "put" or "up") that is actually part of a phrasal verb, idiom, or fixed collocation in "context_sentence" (e.g. "put up with", "run out of", "kick the bucket"), you MUST:
1. Set "lemma" to the full phrasal verb or idiom (e.g. "put up with").
2. Set "part_of_speech" to "phrasal verb" or "idiom".
3. Explain and translate the full expression in "simple_definition", "contextual_translation", and "context_explanation".`,
      temperature: 0.1,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        required: [
          'selected_text',
          'lemma',
          'part_of_speech',
          'ipa',
          'cefr_level',
          'simple_definition',
          'contextual_translation',
          'sentence_translation',
          'context_explanation',
          'example_sentence_en',
          'example_sentence_native',
        ],
        properties: {
          selected_text: { type: Type.STRING },
          lemma: { type: Type.STRING },
          part_of_speech: { type: Type.STRING },
          ipa: { type: Type.STRING },
          cefr_level: { type: Type.STRING, enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] },
          simple_definition: { type: Type.STRING },
          contextual_translation: { type: Type.STRING },
          sentence_translation: { type: Type.STRING },
          context_explanation: { type: Type.STRING },
          example_sentence_en: { type: Type.STRING },
          example_sentence_native: { type: Type.STRING },
        },
      },
    },
  });

  return JSON.parse(response.text!);
}
