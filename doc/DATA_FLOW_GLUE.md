# DATA_FLOW_GLUE.md — Runtime Data Flow & Component Wiring Specification

Ten dokument definiuje dokładne, krok po kroku połączenia w czasie działania aplikacji (Runtime Data Flow), eliminując domysły AI przy łączeniu modułów: od kliknięcia słowa w odtwarzaczu, przez pobranie tłumaczenia, zapis do bazy offline `expo-sqlite`, aż po synchronizację w tle z Supabase.

---

## 1. Przepływ Tłumaczenia: WordToken -> TranslationSheet -> R2 / Gemini

Gdy użytkownik ogląda wideo w `apps/mobile/app/(tabs)/player.tsx` i kliknie wyraz:

```
[Użytkownik klika WordToken]
         │
         ▼
[1. WordToken.onPress(token)]
         │  - Haptics.selectionAsync()
         │  - cleanWordToken(token) -> "attitude"
         ▼
[2. usePlayerStore.openTranslation(word, sentence)]
         │  - isPlaying: false (odtwarzacz wideo zostaje spauzowany)
         │  - isSheetOpen: true
         ▼
[3. TranslationSheet odbiera props word, sentence]
         │  - Pokazuje stan szkieletowy (Skeleton Loader)
         │  - Pobiera sesję Supabase: supabase.auth.getSession() -> authToken
         ▼
[4. Wywołanie fetchTranslationWithR2Cache({ word, sentence, targetLang: 'en', authToken })]
         │
         ├───► A. GET https://cache.applearneng.com/{hash}.json
         │        │
         │        ├── (HTTP 200) ──► Zwróć dane z CDN natychmiast (fromCache: true)
         │        │
         │        └── (HTTP 404) ──► B. POST /api/v1/translate (Bearer JWT)
         │                               │
         │                               ├── Backend: evaluateQuota() -> Sprawdzenie limitu
         │                               │       └── (Przekroczony) -> HTTP 429 -> Wyświetl baner limitu w arkuszu
         │                               ├── Backend: Gemini 2.5 Lite generuje JSON
         │                               ├── Backend: Zod parse (TranslationResponseSchema)
         │                               ├── Backend: S3 PutObject do roota R2 ({hash}.json)
         │                               └── Zwróć TranslationResponse (fromCache: false)
         ▼
[5. TranslationSheet renderuje dane tłumaczenia]
         - Nagłówek: IPA, audio wymowa playPronunciation(word)
         - Prosta definicja (simple_definition)
         - Tłumaczenie kontekstowe i zdanie
         - Akordeon "Explain in context"
         - Przyciski "Save Word" oraz "Save Sentence"
```

---

## 2. Mapowanie Danych: Zapis Fiszek z `TranslationSheet` do `LocalFlashcardsRepository`

W arkuszu tłumaczenia użytkownik ma do wyboru dwa przyciski zapisu. Oto dokładne mapowanie z `TranslationResponse` do `CreateFlashcardRequestBody` (zgodnie z `API_CONTRACT.md` i `OFFLINE_SQLITE_AND_SYNC.md`):

### 2.1 Zapis Słówka ("Save Word"):
```typescript
const wordFlashcardPayload: CreateFlashcardRequestBody = {
  type: 'word',
  target_text: data.lemma || data.selected_text,
  translation: data.contextual_translation,
  simple_definition: data.simple_definition,
  context_sentence: sentence,
  context_explanation: data.context_explanation,
  lemma: data.lemma,
  part_of_speech: data.part_of_speech,
  ipa: data.ipa,
  cefr_level: data.cefr_level,
  video_id: videoId,
  video_timestamp_sec: currentTime > 0 ? Number(currentTime.toFixed(2)) : 0,
  r2_cache_hash: data.hash,
};
```

### 2.2 Zapis Całego Zdania ("Save Sentence"):
```typescript
const sentenceFlashcardPayload: CreateFlashcardRequestBody = {
  type: 'sentence',
  target_text: sentence,
  translation: data.sentence_translation,
  simple_definition: data.simple_definition,
  context_sentence: sentence,
  context_explanation: data.context_explanation,
  lemma: data.lemma,
  part_of_speech: 'sentence',
  ipa: data.ipa,
  cefr_level: data.cefr_level,
  video_id: videoId,
  video_timestamp_sec: currentTime > 0 ? Number(currentTime.toFixed(2)) : 0,
  r2_cache_hash: data.hash,
};
```

### 2.3 Zapis do Bazy Lokalnej SQLite i Inicjalizacja SRS:
Po kliknięciu przycisku zapisu w `player.tsx`:
1. Pobierany jest `currentUserId` z aktywnej sesji Supabase (`supabase.auth.getUser()`).
2. Generowany jest unikalny identyfikator UUID w standardzie RFC 4122:
   ```typescript
   const cardId = Crypto.randomUUID();
   ```
3. Fiszka jest zapisywana do SQLite z początkowymi parametrami algorytmu SM-2 (`sync_status = 'pending_insert'` ustawiany automatycznie wewnątrz `insertCard`):
   ```typescript
   await LocalFlashcardsRepository.insertCard({
     id: cardId,
     user_id: currentUserId,
     ...data,
     repetitions: 0,
     interval_days: 1,
     ease_factor: 2.50,
     next_review_at: new Date().toISOString(),
   });
   ```
4. Wyzwalana jest wibracja sukcesu `Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)`.
5. Kolejkowana jest asynchroniczna synchronizacja: `FlashcardSyncEngine.scheduleSync(currentUserId)`.

---

## 3. Cykl Życia Powtórki Fiszki (Swipe Lifecycle)

W ekranie `apps/mobile/app/(tabs)/flashcards.tsx`:

```
[1. Pobranie talii na dany dzień]
         │  - LocalFlashcardsRepository.getDueCards(userId)
         │  - useFlashcardsStore.setDeck(cards)
         ▼
[2. Użytkownik wykonuje Swipe na karcie TinderCard]
         │  - calculateNextReviewFromSwipe(currentState, direction)
         ├── 'left'  (Again) -> Grade 0 -> reps = 0, interval = 1, ease bez zmian (>= 1.3)
         │                      * Karta trafia na koniec dzisiejszej kolejki w pamięci
         ├── 'down'  (Hard)  -> Grade 1 -> reps = reps + 1, interval = 1..2, ease = max(1.3, ease - 0.14)
         ├── 'right' (Good)  -> Grade 2 -> reps = reps + 1, interval = 1 -> 3 -> round(prev * ease), ease + 0.00
         └── 'up'    (Easy)  -> Grade 3 -> reps = reps + 1, interval = 2 -> 6 -> round(prev * ease * 1.2), ease + 0.10
         ▼
[3. Natychmiastowa aktualizacja lokalna (0 ms opóźnienia)]
         │  - useFlashcardsStore.recordSwipe(direction)
         │  - LocalFlashcardsRepository.recordSwipeSRS(cardId, srsResult) -> sync_status = 'pending_update'
         │  - Haptics.impactAsync(Medium)
         ▼
[4. Kolejkowanie Synchronizacji Zbiorczej (Debounce Batching)]
         │  - FlashcardSyncEngine.scheduleSync(userId) // 5 sekund po ostatnim ruchu
         ▼
[5. Batch Flush do Supabase (FlashcardSyncEngine.flush(userId))]
         │  - LocalFlashcardsRepository.getPendingSyncCards(userId) (WHERE sync_status != 'synced')
         │  - supabase.from('user_flashcards').upsert(upsertPayload, { onConflict: 'id' })
         │  - LocalFlashcardsRepository.markAsSynced(syncedIds)
```

---

## 4. Inicjalizacja i Sprzątanie Silnika Synchronizacji (`FlashcardSyncEngine`)

Silnik synchronizacji jest inicjalizowany po zalogowaniu użytkownika w `apps/mobile/app/_layout.tsx`:

```typescript
useEffect(() => {
  if (!session?.user?.id) return;
  let cleanup: (() => void) | undefined;

  FlashcardSyncEngine.init(session.user.id).then((dispose) => {
    cleanup = dispose;
  });

  return () => {
    cleanup?.();
  };
}, [session?.user?.id]);
```

---

## 5. Zapis Historii Oglądania (`user_watch_history`)

Aby oszczędzać zasoby baterii i bazy danych:
1. Pozycja filmu (`currentTime`) **nie jest zapisywana przy każdym tiku pętli 150 ms**.
2. Aktualizacja rekordu w tabeli `user_watch_history` wywoływana jest wyłącznie:
   - Po spauzowaniu wideo przez użytkownika,
   - Przy wyjściu z ekranu odtwarzacza (`onBlur` / `unmount`),
   - Co minimum 30 sekund ciągłego odtwarzania (Throttled update).
