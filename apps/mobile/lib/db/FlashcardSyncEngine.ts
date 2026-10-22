import { supabase } from '@/lib/supabase';
import { LocalFlashcardsRepository } from './LocalFlashcardsRepository';

let debounceTimeout: ReturnType<typeof setTimeout> | null = null;
let isSyncing = false;

async function checkIsConnected(): Promise<boolean> {
  try {
    const NetInfoModule = await import('@react-native-community/netinfo');
    const NetInfo = NetInfoModule.default || NetInfoModule;
    if (NetInfo && typeof NetInfo.fetch === 'function') {
      const state = await NetInfo.fetch();
      return Boolean(state.isConnected ?? true);
    }
  } catch {
    // Default to online in non-native test runner environments
  }
  return true;
}

export const FlashcardSyncEngine = {
  async init(
    userId: string,
    appState?: { addEventListener: (type: 'change', listener: (state: string) => void) => { remove: () => void } }
  ): Promise<() => void> {
    // 1. Najpierw wypchnij ewentualne zaległe zmiany offline, a potem pobierz stan z chmury
    await FlashcardSyncEngine.flush(userId);
    await FlashcardSyncEngine.pullFromServer(userId);

    let removeAppState: (() => void) | null = null;
    let unsubscribeNetInfo: (() => void) | null = null;

    try {
      if (appState && typeof appState.addEventListener === 'function') {
        const appStateSub = appState.addEventListener('change', (nextState) => {
          if (nextState === 'background' || nextState === 'inactive') {
            FlashcardSyncEngine.flush(userId);
          }
        });
        removeAppState = () => appStateSub.remove();
      }
    } catch {
      // Ignore in non-native environments
    }

    try {
      const NetInfoModule = await import('@react-native-community/netinfo');
      const NetInfo = NetInfoModule.default || NetInfoModule;
      if (NetInfo && typeof NetInfo.addEventListener === 'function') {
        unsubscribeNetInfo = NetInfo.addEventListener((state: any) => {
          if (state.isConnected) {
            FlashcardSyncEngine.flush(userId);
          }
        });
      }
    } catch {
      // Ignore in non-native environments
    }

    return () => {
      removeAppState?.();
      unsubscribeNetInfo?.();
    };
  },

  /**
   * Pobiera fiszki z Supabase do lokalnej bazy SQLite (np. przy logowaniu na nowym urządzeniu)
   */
  async pullFromServer(userId: string): Promise<void> {
    try {
      const connected = await checkIsConnected();
      if (!connected) return;

      const { data, error } = await supabase
        .from('user_flashcards')
        .select('*')
        .eq('user_id', userId);

      if (!error && data && data.length > 0) {
        await LocalFlashcardsRepository.upsertManyFromServer(data);
      }
    } catch (err) {
      console.warn('Pull from server failed:', err);
    }
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
      const connected = await checkIsConnected();
      if (!connected) {
        return;
      }

      const pendingCards = await LocalFlashcardsRepository.getPendingSyncCards(userId);
      if (pendingCards.length === 0) {
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
