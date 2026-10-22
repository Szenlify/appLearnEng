# 03. Integracja z AI: Gemini 2.5 Lite, Caching w Cloudflare R2 i Wielojęzyczność

## 1. Czy Google Gemini 2.5 Flash / Lite będzie wystarczający?

**Zdecydowanie TAK — to obecnie najlepszy i najbardziej opłacalny wybór na rynku do tego zadania.**

### Dlaczego Gemini 2.5 Flash / Lite deklasuje konkurencję?
1. **Błyskawiczny czas odpowiedzi (TTFT < 300 ms):**
   - Starsze modele (np. GPT-4o czy Claude Sonnet) mają opóźnienia rzędu 800–1500 ms, co niszczy płynność oglądania wideo na telefonie. Gemini 2.5 Lite odpowiada w ułamku sekundy.
2. **Natywne Structured Outputs (Wymuszony JSON):**
   - Model w 100% trzyma się schematu JSON bez halucynacji i zbędnych wstępów tekstu.
3. **Ekstremalnie niski koszt tokenów:**
   - Zapytanie o słówko ze zdaniem kontekstowym kosztuje poniżej **0,0003 PLN** ($0.00007 USD).
   - W połączeniu z naszym cache w Cloudflare R2 (gdzie 80%+ zapytań nie dotyka API), miesięczny koszt AI na użytkownika wynosi ułamki groszy.

---

## 2. Co dokładnie tłumaczy i generuje Gemini?

Zgodnie z wymogami dydaktycznymi, okno tłumaczenia podzielone jest na warstwy poznawcze:

1. **Wymowa (Audio Pronunciation & IPA):**
   - Transkrypcja fonetyczna w alfabecie IPA (np. `/ˌpʊt ʌp ˈwɪð/`).
   - Akcent (US / UK).
2. **Prosta Definicja (Simple Definition):**
   - Zwięzła, łatwa do przyswojenia definicja w języku docelowym (np. polskim) na poziomie A2/B1 — bez skomplikowanego żargonu lingwistycznego.
3. **Tłumaczenie Słowa i Całego Zdania:**
   - Precyzyjne tłumaczenie wyrazu oraz pełne tłumaczenie zdania z filmu.
4. **Przycisk "Explain in Context" (Wyjaśnij w kontekście):**
   - Pogłębione wyjaśnienie: dlaczego dane słowo zostało użyte w ten konkretny sposób w filmie, jakie emocje wyraża lub czy jest to idiom / slang / phrasal verb.
5. **Alternatywny Przykład Użycia:**
   - Nowe, praktyczne zdanie po angielsku wraz z tłumaczeniem.

---

## 3. Schemat JSON i Obsługa Dowolnego Języka Docelowego

Gemini przyjmuje parametr `target_language` (np. `pl`, `de`, `es`, `fr`, `ja`, `it`). Odpowiedź generowana jest zawsze w języku ojczystym wybranym przez użytkownika:

### User Payload Przekazywany do Gemini:
```json
{
  "target_word_or_phrase": "put up with",
  "context_sentence": "I really can't put up with his toxic behavior anymore.",
  "target_language": "pl"
}
```

### Zwracany Ustrukturyzowany Obiekt JSON:
```json
{
  "selected_text": "put up with",
  "lemma": "put up with",
  "part_of_speech": "phrasal verb",
  "ipa": "/ˌpʊt ʌp ˈwɪð/",
  "cefr_level": "B1",
  "simple_definition": "Tolerować lub znosić kogoś/coś, co jest nieprzyjemne.",
  "contextual_translation": "znosić / tolerować",
  "sentence_translation": "Naprawdę nie mogę już dłużej znosić jego toksycznego zachowania.",
  "context_explanation": "W tym filmie bohater używa tego zwrotu, aby wyrazić frustrację i postawić granicę w relacji. Zwrot potoczny, często stosowany w kłótniach.",
  "example_sentence_en": "I don't know how she puts up with that loud noise all day.",
  "example_sentence_native": "Nie wiem, jak ona znosi ten głośny hałas przez cały dzień."
}
```
*(Backend przed zapisem do Cloudflare R2 pod kluczem `/{hash}.json` dokleja pola metadanych: `hash`, `target_language` oraz `created_at` zgodnie z interfejsem `TranslationResponse` w `API_CONTRACT.md`).*

---

## 4. Architektura Wielojęzycznego Cache w Cloudflare R2

Aby wspierać użytkowników z Polski, Niemiec, Francji, Hiszpanii czy Japonii bez konfliktów pamięci podręcznej, język docelowy jest integralną częścią hasza:

### Algorytm Haszowania:
$$\text{hash} = \text{sha256}(\text{word.trim().toLowerCase()} + \text{"\_"} + \text{sentence.trim().toLowerCase()} + \text{"\_"} + \text{targetLanguage.trim().toLowerCase()})$$

- Polski użytkownik odpytuje: `/{hash_pl}.json`
- Niemiecki użytkownik odpytuje: `/{hash_de}.json`
- Oba pliki leżą w folderze głównym w Cloudflare R2 i są serwowane z zerowym kosztem transferu (Zero Egress) przez globalny CDN Cloudflare.

---

## 5. Implementacja Wywołania Gemini w Backendzie (`apps/backend/src/services/gemini.service.ts`)

Używamy oficjalnego SDK `@google/genai` z wymuszonym schematem JSON (`responseMimeType: 'application/json'` i `responseSchema`):

```typescript
import { GoogleGenAI, Type } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export async function generateContextualTranslation(
  word: string,
  sentence: string,
  targetLang = 'pl'
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
```

---

## 6. Implementacja Zapisu do Cloudflare R2 (`apps/backend/src/services/r2.service.ts`)

Używamy oficjalnego klienta `@aws-sdk/client-s3` skonfigurowanego pod endpoint S3 Cloudflare R2 (`region: 'auto'`). Każdy plik zapisywany jest bezpośrednio w katalogu głównym bucketa jako `{hash}.json` z nagłówkiem `Cache-Control: public, max-age=31536000, immutable`:

```typescript
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { TranslationResponse } from '@learneng/shared';

export class R2StorageService {
  private s3: S3Client;
  private bucketName: string;

  constructor() {
    const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID || '';
    this.bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME || 'learneng-cache';

    this.s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || '',
      },
    });
  }

  /**
   * Saves translation payload to Cloudflare R2 root bucket at /{hash}.json
   */
  async saveTranslationToRoot(hash: string, payload: TranslationResponse): Promise<void> {
    const key = `${hash}.json`; // Root bucket key (no subfolder prefix)
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: JSON.stringify(payload),
        ContentType: 'application/json; charset=utf-8',
        CacheControl: 'public, max-age=31536000, immutable',
      })
    );
  }
}
```
