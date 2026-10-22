import { SRSCardState } from '@learneng/shared';

export interface SQLiteDatabaseLike {
  execAsync: (source: string) => Promise<void>;
  runAsync: (source: string, params?: any[]) => Promise<any>;
  getAllAsync: <T>(source: string, params?: any[]) => Promise<T[]>;
  withTransactionAsync: (task: () => Promise<void>) => Promise<void>;
}

let dbInstance: SQLiteDatabaseLike | null = null;

/**
 * Allows injecting an in-memory/mock SQLite database in unit tests (sqlite-sync.test.ts)
 */
export function setDbInstanceForTests(mockDb: SQLiteDatabaseLike | null) {
  dbInstance = mockDb;
}

export async function initDatabase(db: SQLiteDatabaseLike) {
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
      video_timestamp_sec REAL,
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

function createFallbackMemoryDb(): SQLiteDatabaseLike {
  const nowIso = new Date().toISOString();
  const rows = new Map<string, LocalFlashcardRow>([
    [
      'demo-card-1',
      {
        id: 'demo-card-1',
        user_id: 'local-user',
        type: 'word',
        target_text: 'ubiquitous',
        translation: 'wszechobecny',
        simple_definition: 'Present, appearing, or found everywhere.',
        context_sentence: 'Smartphones have become ubiquitous in modern daily life.',
        context_explanation: 'Used here to emphasize how smartphones are seen everywhere.',
        lemma: 'ubiquitous',
        part_of_speech: 'adjective',
        ipa: '/juːˈbɪk.wɪ.təs/',
        cefr_level: 'C1',
        repetitions: 0,
        interval_days: 1,
        ease_factor: 2.5,
        next_review_at: nowIso,
        sync_status: 'synced',
        updated_at: nowIso,
      },
    ],
    [
      'demo-card-2',
      {
        id: 'demo-card-2',
        user_id: 'local-user',
        type: 'word',
        target_text: 'resilient',
        translation: 'odporny, elastyczny',
        simple_definition: 'Able to withstand or recover quickly from difficult conditions.',
        context_sentence: 'Children are often remarkably resilient in the face of change.',
        lemma: 'resilient',
        part_of_speech: 'adjective',
        ipa: '/rɪˈzɪl.jənt/',
        cefr_level: 'B2',
        repetitions: 1,
        interval_days: 3,
        ease_factor: 2.5,
        next_review_at: nowIso,
        sync_status: 'synced',
        updated_at: nowIso,
      },
    ],
  ]);

  return {
    execAsync: async () => {},
    runAsync: async (source: string, params: any[] = []) => {
      const sql = source.trim().toUpperCase();
      if (sql.startsWith('INSERT OR REPLACE INTO LOCAL_FLASHCARDS')) {
        const [
          id,
          user_id,
          type,
          target_text,
          translation,
          simple_definition,
          context_sentence,
          context_explanation,
          lemma,
          part_of_speech,
          ipa,
          cefr_level,
          r2_cache_hash,
          video_id,
          video_timestamp_sec,
          repetitions,
          interval_days,
          ease_factor,
          next_review_at,
          updated_at,
        ] = params;
        rows.set(id, {
          id,
          user_id,
          type,
          target_text,
          translation,
          simple_definition,
          context_sentence,
          context_explanation,
          lemma,
          part_of_speech,
          ipa,
          cefr_level,
          r2_cache_hash,
          video_id,
          video_timestamp_sec,
          repetitions,
          interval_days,
          ease_factor,
          next_review_at,
          sync_status: 'pending_insert',
          updated_at,
        });
      } else if (sql.startsWith('UPDATE LOCAL_FLASHCARDS') && sql.includes("SYNC_STATUS = 'PENDING_UPDATE'")) {
        const [repetitions, interval_days, ease_factor, next_review_at, updated_at, id] = params;
        const existing = rows.get(id);
        if (existing) {
          rows.set(id, {
            ...existing,
            repetitions,
            interval_days,
            ease_factor,
            next_review_at,
            sync_status: 'pending_update',
            updated_at,
          });
        }
      } else if (sql.startsWith("UPDATE LOCAL_FLASHCARDS SET SYNC_STATUS = 'SYNCED'")) {
        for (const id of params) {
          const existing = rows.get(id);
          if (existing) rows.set(id, { ...existing, sync_status: 'synced' });
        }
      }
    },
    getAllAsync: async <T>(source: string, params: any[] = []): Promise<T[]> => {
      const sql = source.trim().toUpperCase();
      const all = Array.from(rows.values());
      if (sql.includes("SYNC_STATUS != 'SYNCED'")) {
        return all.filter((r) => r.sync_status !== 'synced') as unknown as T[];
      }
      if (sql.includes('NEXT_REVIEW_AT <=')) {
        const [, nowParam, limit = 50] = params;
        return all
          .filter((r) => r.next_review_at <= nowParam)
          .slice(0, limit) as unknown as T[];
      }
      return all as unknown as T[];
    },
    withTransactionAsync: async (task: () => Promise<void>) => {
      await task();
    },
  };
}

export async function getDb(): Promise<SQLiteDatabaseLike> {
  if (!dbInstance) {
    try {
      const SQLite = await import('expo-sqlite');
      dbInstance = (await SQLite.openDatabaseAsync('learneng.db')) as unknown as SQLiteDatabaseLike;
      await initDatabase(dbInstance);
    } catch {
      dbInstance = createFallbackMemoryDb();
    }
  }
  return dbInstance;
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
        card.video_timestamp_sec ?? null,
        card.repetitions,
        card.interval_days,
        card.ease_factor,
        card.next_review_at,
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

  /**
   * Zapisuje fiszki pobrane z chmury Supabase (np. po zalogowaniu na nowym telefonie),
   * nie nadpisując kart, które mają lokalne, jeszcze niewysłane zmiany (sync_status != 'synced').
   */
  async upsertManyFromServer(
    cards: Array<Omit<LocalFlashcardRow, 'sync_status' | 'updated_at'> & { updated_at?: string }>
  ): Promise<void> {
    if (cards.length === 0) return;
    const db = await getDb();
    await db.withTransactionAsync(async () => {
      for (const c of cards) {
        await db.runAsync(
          `INSERT INTO local_flashcards 
           (id, user_id, type, target_text, translation, simple_definition, context_sentence, context_explanation, lemma, part_of_speech, ipa, cefr_level, r2_cache_hash, video_id, video_timestamp_sec, repetitions, interval_days, ease_factor, next_review_at, sync_status, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)
           ON CONFLICT(id) DO UPDATE SET
             repetitions = excluded.repetitions,
             interval_days = excluded.interval_days,
             ease_factor = excluded.ease_factor,
             next_review_at = excluded.next_review_at,
             updated_at = excluded.updated_at
           WHERE local_flashcards.sync_status = 'synced'`,
          [
            c.id,
            c.user_id,
            c.type,
            c.target_text,
            c.translation,
            c.simple_definition || null,
            c.context_sentence || null,
            c.context_explanation || null,
            c.lemma || null,
            c.part_of_speech || null,
            c.ipa || null,
            c.cefr_level || null,
            c.r2_cache_hash || null,
            c.video_id || null,
            c.video_timestamp_sec ?? null,
            c.repetitions,
            c.interval_days,
            c.ease_factor,
            c.next_review_at,
            c.updated_at || new Date().toISOString(),
          ]
        );
      }
    });
  },
};
