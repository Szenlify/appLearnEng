import { beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { Database } from 'bun:sqlite';
import { calculateNextReviewFromSwipe } from '@learneng/shared';
import {
  initDatabase,
  LocalFlashcardsRepository,
  setDbInstanceForTests,
  type LocalFlashcardRow,
  type SQLiteDatabaseLike,
} from '../lib/db/LocalFlashcardsRepository';
import { FlashcardSyncEngine } from '../lib/db/FlashcardSyncEngine';
import { supabase } from '../lib/supabase';
import { useFlashcardsStore } from '../stores/useFlashcardsStore';

function createInMemorySQLiteAdapter(): { adapter: SQLiteDatabaseLike; rawDb: Database } {
  const rawDb = new Database(':memory:');

  const adapter: SQLiteDatabaseLike = {
    execAsync: async (source: string) => {
      rawDb.exec(source);
    },
    runAsync: async (source: string, params: any[] = []) => {
      const stmt = rawDb.prepare(source);
      return stmt.run(...params);
    },
    getAllAsync: async <T>(source: string, params: any[] = []): Promise<T[]> => {
      const stmt = rawDb.prepare(source);
      return stmt.all(...params) as T[];
    },
    withTransactionAsync: async (task: () => Promise<void>) => {
      rawDb.exec('BEGIN TRANSACTION');
      try {
        await task();
        rawDb.exec('COMMIT');
      } catch (err) {
        rawDb.exec('ROLLBACK');
        throw err;
      }
    },
  };

  return { adapter, rawDb };
}

describe('Stage 8A: Offline SQLite Repository & Bi-Directional Batch Sync Engine', () => {
  let adapter: SQLiteDatabaseLike;

  beforeEach(async () => {
    const setup = createInMemorySQLiteAdapter();
    adapter = setup.adapter;
    setDbInstanceForTests(adapter);
    await initDatabase(adapter);
  });

  it('1. insertCard sets sync_status = "pending_insert", recordSwipeSRS sets "pending_update", and flush() marks cards as "synced"', async () => {
    const userId = 'user-sqlite-123';
    const pastIso = new Date(Date.now() - 60_000).toISOString();

    await LocalFlashcardsRepository.insertCard({
      id: 'card-1',
      user_id: userId,
      type: 'word',
      target_text: 'put up with',
      translation: 'znosić / tolerować',
      simple_definition: 'Tolerate something unpleasant.',
      context_sentence: "I can't put up with this attitude.",
      lemma: 'put up with',
      part_of_speech: 'phrasal verb',
      ipa: '/ˌpʊt ʌp ˈwɪð/',
      cefr_level: 'B2',
      video_id: 'UF8uR6Z6KLc',
      video_timestamp_sec: 14.25,
      repetitions: 0,
      interval_days: 1,
      ease_factor: 2.5,
      next_review_at: pastIso,
    });

    // Verify sync_status = 'pending_insert' right after insertCard
    const pendingAfterInsert = await LocalFlashcardsRepository.getPendingSyncCards(userId);
    expect(pendingAfterInsert).toHaveLength(1);
    expect(pendingAfterInsert[0].id).toBe('card-1');
    expect(pendingAfterInsert[0].sync_status).toBe('pending_insert');

    // Verify getDueCards returns due card
    const dueCards = await LocalFlashcardsRepository.getDueCards(userId);
    expect(dueCards).toHaveLength(1);
    expect(dueCards[0].target_text).toBe('put up with');

    // Simulate swipe right (Good -> Grade 2) and recordSwipeSRS
    const nextSrs = calculateNextReviewFromSwipe(
      { repetitions: 0, intervalDays: 1, easeFactor: 2.5 },
      'right'
    );
    await LocalFlashcardsRepository.recordSwipeSRS('card-1', nextSrs);

    const pendingAfterSwipe = await LocalFlashcardsRepository.getPendingSyncCards(userId);
    expect(pendingAfterSwipe).toHaveLength(1);
    expect(pendingAfterSwipe[0].sync_status).toBe('pending_update');
    expect(pendingAfterSwipe[0].repetitions).toBe(1);
    expect(pendingAfterSwipe[0].interval_days).toBe(1);

    // Mock Supabase batch upsert and call FlashcardSyncEngine.flush(userId)
    let upsertedRows: any[] = [];
    const fromSpy = spyOn(supabase, 'from').mockImplementation((() => ({
      upsert: async (payload: any[]) => {
        upsertedRows = payload;
        return { data: payload, error: null };
      },
    })) as any);

    await FlashcardSyncEngine.flush(userId);

    expect(upsertedRows).toHaveLength(1);
    expect(upsertedRows[0].id).toBe('card-1');
    expect(upsertedRows[0].repetitions).toBe(1);

    // Verify card is now marked as 'synced' in SQLite
    const pendingAfterFlush = await LocalFlashcardsRepository.getPendingSyncCards(userId);
    expect(pendingAfterFlush).toHaveLength(0);

    const rows = await adapter.getAllAsync<LocalFlashcardRow>(
      `SELECT * FROM local_flashcards WHERE id = ?`,
      ['card-1']
    );
    expect(rows[0].sync_status).toBe('synced');

    fromSpy.mockRestore();
  });

  it('2. pullFromServer() fetches cloud flashcards without overwriting local unsynced changes', async () => {
    const userId = 'user-sqlite-123';
    const nowIso = new Date().toISOString();

    // Insert local card with unsynced local swipe update (repetitions = 5, sync_status = 'pending_update')
    await LocalFlashcardsRepository.insertCard({
      id: 'card-local-dirty',
      user_id: userId,
      type: 'word',
      target_text: 'resilient',
      translation: 'odporny',
      repetitions: 5,
      interval_days: 15,
      ease_factor: 2.6,
      next_review_at: nowIso,
    });
    await LocalFlashcardsRepository.recordSwipeSRS('card-local-dirty', {
      repetitions: 5,
      intervalDays: 15,
      easeFactor: 2.6,
      nextReviewAt: nowIso,
    });

    // Server returns an older version of 'card-local-dirty' (repetitions = 1) plus a new cloud card 'card-cloud-new'
    const serverCards = [
      {
        id: 'card-local-dirty',
        user_id: userId,
        type: 'word',
        target_text: 'resilient',
        translation: 'odporny',
        repetitions: 1,
        interval_days: 1,
        ease_factor: 2.5,
        next_review_at: nowIso,
        updated_at: nowIso,
      },
      {
        id: 'card-cloud-new',
        user_id: userId,
        type: 'sentence',
        target_text: 'Stay hungry, stay foolish.',
        translation: 'Pozostańcie głodni, pozostańcie szaleni.',
        repetitions: 2,
        interval_days: 3,
        ease_factor: 2.5,
        next_review_at: nowIso,
        updated_at: nowIso,
      },
    ];

    const fromSpy = spyOn(supabase, 'from').mockImplementation((() => ({
      select: () => ({
        eq: async () => ({ data: serverCards, error: null }),
      }),
    })) as any);

    await FlashcardSyncEngine.pullFromServer(userId);

    const allCards = await adapter.getAllAsync<LocalFlashcardRow>(
      `SELECT * FROM local_flashcards WHERE user_id = ? ORDER BY id ASC`,
      [userId]
    );
    expect(allCards).toHaveLength(2);

    const cloudNew = allCards.find((c) => c.id === 'card-cloud-new')!;
    expect(cloudNew).toBeDefined();
    expect(cloudNew.sync_status).toBe('synced');
    expect(cloudNew.repetitions).toBe(2);

    // Local dirty card MUST NOT be overwritten by stale server data
    const localDirty = allCards.find((c) => c.id === 'card-local-dirty')!;
    expect(localDirty).toBeDefined();
    expect(localDirty.sync_status).toBe('pending_update');
    expect(localDirty.repetitions).toBe(5);
    expect(localDirty.interval_days).toBe(15);

    fromSpy.mockRestore();
  });

  it('3. useFlashcardsStore manages deck queue, re-queues card on left swipe (Again), and supports undoLastSwipe', () => {
    const store = useFlashcardsStore.getState();
    store.clearSyncBuffer();
    store.setDeck([
      {
        id: 'c1',
        user_id: 'u1',
        type: 'word',
        target_text: 'attitude',
        translation: 'podejście',
        repetitions: 0,
        interval_days: 1,
        ease_factor: 2.5,
        next_review_at: new Date().toISOString(),
      },
    ]);

    expect(useFlashcardsStore.getState().deck).toHaveLength(1);
    expect(useFlashcardsStore.getState().currentIndex).toBe(0);

    // Swipe Left (Again) re-appends card to end of deck
    useFlashcardsStore.getState().recordSwipe('left');
    expect(useFlashcardsStore.getState().currentIndex).toBe(1);
    expect(useFlashcardsStore.getState().deck).toHaveLength(2);
    expect(useFlashcardsStore.getState().pendingSyncBuffer).toHaveLength(1);

    // Undo last swipe
    useFlashcardsStore.getState().undoLastSwipe();
    expect(useFlashcardsStore.getState().currentIndex).toBe(0);
    expect(useFlashcardsStore.getState().pendingSyncBuffer).toHaveLength(0);
  });
});
