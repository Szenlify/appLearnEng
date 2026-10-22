# OFFLINE_SQLITE_AND_SYNC.md — Offline SQLite & Batch Sync Architecture

Dokument definiuje architekturę magazynu lokalnego na telefonie za pomocą **`expo-sqlite` (nowe asynchroniczne API z Expo SDK 51+)** oraz protokół bezstratnej synchronizacji zbiorczej (*Batch Sync*) z chmurowym PostgreSQL na Supabase.

---

## 1. Dlaczego `expo-sqlite` (Offline First)?
1. **0 ms opóźnienia interfejsu:** Animacje odrzucania kart (120 fps) nie czekają na zapytania sieciowe do bazy w chmurze.
2. **100% działania w trybie samolotowym / metrze:** Użytkownik może powtarzać słówka, obracać karty i odsłuchiwać wymowę `expo-speech` bez dostępu do Internetu.
3. **Drastyczna redukcja kosztów bazy:** Zamiast 100 pojedynczych zapytań `UPDATE` na sesję nauki, aplikacja wysyła jeden zbiorczy `upsert` na koniec.

---

## 2. Schemat Bazy SQLite na Urządzeniu

Lokalna baza danych nosi nazwę `learneng.db`.

```sql
CREATE TABLE IF NOT EXISTS local_flashcards (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'word',            -- 'word' LUB 'sentence'
    target_text TEXT NOT NULL,
    translation TEXT NOT NULL,
    simple_definition TEXT,
    context_sentence TEXT,
    context_explanation TEXT,
    lemma TEXT,
    part_of_speech TEXT,
    ipa TEXT,
    cefr_level TEXT,
    r2_cache_hash TEXT,
    video_id TEXT,
    video_timestamp_sec INTEGER,
    
    -- Parametry algorytmu SM-2
    repetitions INTEGER NOT NULL DEFAULT 0,
    interval_days INTEGER NOT NULL DEFAULT 1,
    ease_factor REAL NOT NULL DEFAULT 2.50,
    next_review_at TEXT NOT NULL,                -- ISO 8601 String
    
    -- Flaga synchronizacji
    sync_status TEXT NOT NULL DEFAULT 'synced',  -- 'synced' | 'pending_insert' | 'pending_update'
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_local_due 
ON local_flashcards(user_id, next_review_at);
```

---

## 3. Implementacja Repozytorium (`apps/mobile/lib/db/LocalFlashcardsRepository.ts`)

Używamy **nowego asynchronicznego API Expo SDK 51+** (`openDatabaseAsync`):

```typescript
import * as SQLite from 'expo-sqlite';
import { SRSCardState } from '@learneng/shared';

let dbInstance: SQLite.SQLiteDatabase | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbInstance) {
    dbInstance = await SQLite.openDatabaseAsync('learneng.db');
    await initDatabase(dbInstance);
  }
  return dbInstance;
}

async function initDatabase(db: SQLite.SQLiteDatabase) {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS local_flashcards (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'word',
      target_text TEXT NOT NULL,
      translation TEXT NOT NULL,
      simple_definition TEXT,
      context_sentence TEXT,
      context_explanation TEXT,
      lemma TEXT,
      part_of_speech TEXT,
      ipa TEXT,
      cefr_level TEXT,
      r2_cache_hash TEXT,
      video_id TEXT,
      video_timestamp_sec INTEGER,
      repetitions INTEGER NOT NULL DEFAULT 0,
      interval_days INTEGER NOT NULL DEFAULT 1,
      ease_factor REAL NOT NULL DEFAULT 2.50,
      next_review_at TEXT NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'synced',
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_local_due ON local_flashcards(user_id, next_review_at);
  `);
}

export interface LocalFlashcardRow {
  id: string;
  user_id: string;
  type: 'word' | 'sentence';
  target_text: string;
  translation: string;
  simple_definition?: string;
  context_sentence?: string;
  context_explanation?: string;
  lemma?: string;
  part_of_speech?: string;
  ipa?: string;
  cefr_level?: string;
  r2_cache_hash?: string;
  video_id?: string;
  video_timestamp_sec?: number;
  repetitions: number;
  interval_days: number;
  ease_factor: number;
  next_review_at: string;
  sync_status: 'synced' | 'pending_insert' | 'pending_update';
  updated_at: string;
}

export const LocalFlashcardsRepository = {
  /**
   * Pobiera fiszki do powtórki na dziś (next_review_at <= NOW)
   */
  async getDueCards(userId: string, limit = 50): Promise<LocalFlashcardRow[]> {
    const db = await getDb();
    const nowIso = new Date().toISOString();
    return db.getAllAsync<LocalFlashcardRow>(
      `SELECT * FROM local_flashcards 
       WHERE user_id = ? AND next_review_at <= ? 
       ORDER BY next_review_at ASC 
       LIMIT ?`,
      [userId, nowIso, limit]
    );
  },

  /**
   * Natychmiastowa aktualizacja stanu po geście swipe (120fps)
   */
  async recordSwipeSRS(cardId: string, srs: SRSCardState): Promise<void> {
    const db = await getDb();
    const nowIso = new Date().toISOString();
    await db.runAsync(
      `UPDATE local_flashcards 
       SET repetitions = ?, interval_days = ?, ease_factor = ?, next_review_at = ?, sync_status = 'pending_update', updated_at = ?
       WHERE id = ?`,
      [srs.repetitions, srs.intervalDays, srs.easeFactor, srs.nextReviewAt, nowIso, cardId]
    );
  },

  /**
   * Zapis nowej fiszki z arkusza tłumaczenia w trybie offline
   */
  async insertCard(card: Omit<LocalFlashcardRow, 'sync_status' | 'updated_at'>): Promise<void> {
    const db = await getDb();
    const nowIso = new Date().toISOString();
    await db.runAsync(
      `INSERT OR REPLACE INTO local_flashcards 
       (id, user_id, type, target_text, translation, simple_definition, context_sentence, context_explanation, lemma, part_of_speech, ipa, cefr_level, r2_cache_hash, video_id, video_timestamp_sec, repetitions, interval_days, ease_factor, next_review_at, sync_status, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_insert', ?)`,
      [
        card.id,
        card.user_id,
        card.type,
        card.target_text,
        card.translation,
        card.simple_definition || null,
        card.context_sentence || null,
        card.context_explanation || null,
        card.lemma || null,
        card.part_of_speech || null,
        card.ipa || null,
        card.cefr_level || null,
        card.r2_cache_hash || null,
        card.video_id || null,
        card.video_timestamp_sec || null,
        card.repetitions,
        card.interval_days,
        card.ease_factor,
        card.nextReviewAt || card.next_review_at,
        nowIso,
      ]
    );
  },

  /**
   * Pobiera wszystkie niesynchronizowane rekordy do wysłania na serwer
   */
  async getPendingSyncCards(userId: string): Promise<LocalFlashcardRow[]> {
    const db = await getDb();
    return db.getAllAsync<LocalFlashcardRow>(
      `SELECT * FROM local_flashcards WHERE user_id = ? AND sync_status != 'synced'`,
      [userId]
    );
  },

  /**
   * Oznacza zsynchronizowane rekordy
   */
  async markAsSynced(cardIds: string[]): Promise<void> {
    if (cardIds.length === 0) return;
    const db = await getDb();
    const placeholders = cardIds.map(() => '?').join(',');
    await db.runAsync(
      `UPDATE local_flashcards SET sync_status = 'synced' WHERE id IN (${placeholders})`,
      cardIds
    );
  },
};
```

---

## 4. Silnik Synchronizacji Zbiorczej (`FlashcardSyncEngine.ts`)

Silnik dba o to, aby rekordy z lokalnego SQLite spłynęły do bazy PostgreSQL na Supabase przy spełnieniu jednego z 3 warunków:
1. **Debounce Timer:** 5 sekund bezruchu po ostatnim geście swipe.
2. **Utrata fokusu ekranu / AppState:** Przejście aplikacji do tła (`AppState === 'background'`).
3. **Powrót połączenia sieciowego:** Gdy urządzenie odzyska dostęp do sieci.

```typescript
import { AppState, AppStateStatus } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from '@/lib/supabase';
import { LocalFlashcardsRepository } from './LocalFlashcardsRepository';

let debounceTimeout: NodeJS.Timeout | null = null;
let isSyncing = false;

export const FlashcardSyncEngine = {
  init(userId: string) {
    // 1. Reakcja na przejście aplikacji w tło
    AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'background' || nextState === 'inactive') {
        FlashcardSyncEngine.flush(userId);
      }
    });

    // 2. Reakcja na powrót sieci
    NetInfo.addEventListener((state) => {
      if (state.isConnected) {
        FlashcardSyncEngine.flush(userId);
      }
    });
  },

  /**
   * Wywoływane po każdym swipe z 5-sekundowym opóźnieniem (debounce)
   */
  scheduleSync(userId: string) {
    if (debounceTimeout) clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
      FlashcardSyncEngine.flush(userId);
    }, 5000);
  },

  /**
   * Wysyła paczkę niesynchronizowanych fiszek do Supabase w jednym upsert
   */
  async flush(userId: string): Promise<void> {
    if (isSyncing) return;
    isSyncing = true;

    try {
      const netState = await NetInfo.fetch();
      if (!netState.isConnected) {
        isSyncing = false;
        return;
      }

      const pendingCards = await LocalFlashcardsRepository.getPendingSyncCards(userId);
      if (pendingCards.length === 0) {
        isSyncing = false;
        return;
      }

      // Formatowanie do struktury tabeli public.user_flashcards
      const upsertPayload = pendingCards.map((c) => ({
        id: c.id,
        user_id: c.user_id,
        type: c.type,
        target_text: c.target_text,
        translation: c.translation,
        simple_definition: c.simple_definition,
        context_sentence: c.context_sentence,
        context_explanation: c.context_explanation,
        lemma: c.lemma,
        part_of_speech: c.part_of_speech,
        ipa: c.ipa,
        cefr_level: c.cefr_level,
        r2_cache_hash: c.r2_cache_hash,
        video_id: c.video_id,
        video_timestamp_sec: c.video_timestamp_sec,
        repetitions: c.repetitions,
        interval_days: c.interval_days,
        ease_factor: c.ease_factor,
        next_review_at: c.next_review_at,
        updated_at: new Date().toISOString(),
      }));

      // Pojedynczy batch upsert w Supabase
      const { error } = await supabase
        .from('user_flashcards')
        .upsert(upsertPayload, { onConflict: 'id' });

      if (!error) {
        await LocalFlashcardsRepository.markAsSynced(pendingCards.map((c) => c.id));
      }
    } catch (err) {
      console.warn('Sync failed, will retry automatically:', err);
    } finally {
      isSyncing = false;
    }
  },
};
```
