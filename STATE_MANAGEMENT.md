# STATE_MANAGEMENT.md — Application State Architecture (Zustand & TanStack Query)

Ten dokument definiuje **jedyną i zablokowaną architekturę zarządzania stanem** w aplikacji mobilnej LearnEng. AI nie może tworzyć alternatywnych store'ów ani mieszać logiki biznesowej z widokami.

---

## 1. Podział Odpowiedzialności Stanu

1. **Stan Klienta i Odtwarzacza (Client State):** **Zustand**
   - Aktualny czas filmu, stan odtwarzania, podświetlone słowo, widoczność Bottom Sheeta, lokalny bufor swipe'ów fiszek.
2. **Stan Serwera i Danych Sieciowych (Server State):** **TanStack Query (React Query v5)**
   - Pobieranie transkrypcji YouTube, sprawdzanie cache R2/Gemini, synchronizacja fiszek z PostgreSQL, profil użytkownika.
3. **Stan Trwały / Pamięć Lokalna (Offline Persistence):** **expo-sqlite**
   - Lokalna baza fiszek i historia oglądanych filmów dla działania offline.

---

## 2. Store Zustand #1: Odtwarzacz & Napisy (`usePlayerStore.ts`)

Lokalizacja: `apps/mobile/stores/usePlayerStore.ts`

```typescript
import { create } from 'zustand';
import { SubtitleCue } from '@learneng/shared';

interface PlayerState {
  // Video playback
  videoId: string | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  
  // Subtitle synchronization
  cues: SubtitleCue[];
  activeCueIndex: number;
  
  // Selection & Translation Sheet
  selectedWord: string | null;
  selectedSentence: string | null;
  isSheetOpen: boolean;
  
  // Actions
  setVideoId: (id: string) => void;
  setIsPlaying: (playing: boolean) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setCaptions: (cues: SubtitleCue[]) => void;
  openTranslation: (word: string, sentence: string) => void;
  closeTranslation: () => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  videoId: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  cues: [],
  activeCueIndex: -1,
  selectedWord: null,
  selectedSentence: null,
  isSheetOpen: false,

  setVideoId: (id) => set({ videoId: id, currentTime: 0, activeCueIndex: -1 }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  
  setCurrentTime: (time) => {
    const { cues, activeCueIndex } = get();
    // Fast check if time is still within current active cue
    const currentCue = cues[activeCueIndex];
    if (currentCue && time >= currentCue.start && time <= currentCue.end) {
      set({ currentTime: time });
      return;
    }
    // Binary search or find new active cue
    const newIndex = cues.findIndex(c => time >= c.start && time <= c.end);
    set({ currentTime: time, activeCueIndex: newIndex });
  },

  setDuration: (duration) => set({ duration }),
  setCaptions: (cues) => set({ cues, activeCueIndex: -1 }),

  openTranslation: (word, sentence) => {
    // Automatically pause playback when translation sheet opens
    set({
      selectedWord: word,
      selectedSentence: sentence,
      isSheetOpen: true,
      isPlaying: false,
    });
  },

  closeTranslation: () => {
    // Optionally resume playback on close
    set({
      isSheetOpen: false,
      selectedWord: null,
      selectedSentence: null,
      isPlaying: true,
    });
  },
}));

export const QUERY_KEYS = {
  captions: (videoId: string) => ['captions', videoId] as const,
  translation: (hash: string) => ['translation', hash] as const,
  flashcardsDue: (userId: string) => ['flashcards', 'due', userId] as const,
  userProfile: (userId: string) => ['profile', userId] as const,
  userSubscription: (userId: string) => ['subscription', userId] as const,
  watchHistory: (userId: string) => ['watch_history', userId] as const,
};
```

---

## 3. Store Zustand #2: Talia Fiszek & Bufor Swipe'ów (`useFlashcardsStore.ts`)

Lokalizacja: `apps/mobile/stores/useFlashcardsStore.ts`

```typescript
import { create } from 'zustand';
import { Flashcard, SwipeDirection } from '@learneng/shared';

interface SwipeRecord {
  cardId: string;
  direction: SwipeDirection;
  timestamp: number;
}

interface FlashcardsState {
  deck: Flashcard[];
  currentIndex: number;
  pendingSyncBuffer: SwipeRecord[];
  
  setDeck: (cards: Flashcard[]) => void;
  recordSwipe: (direction: SwipeDirection) => void;
  undoLastSwipe: () => void;
  clearSyncBuffer: () => void;
}

export const useFlashcardsStore = create<FlashcardsState>((set, get) => ({
  deck: [],
  currentIndex: 0,
  pendingSyncBuffer: [],

  setDeck: (cards) => set({ deck: cards, currentIndex: 0 }),

  recordSwipe: (direction) => {
    const { deck, currentIndex, pendingSyncBuffer } = get();
    const currentCard = deck[currentIndex];
    if (!currentCard) return;

    // If swipe Left (Again/Repeat) -> push copy of card to end of today's queue
    let newDeck = [...deck];
    if (direction === 'left') {
      newDeck.push(currentCard);
    }

    set({
      deck: newDeck,
      currentIndex: currentIndex + 1,
      pendingSyncBuffer: [
        ...pendingSyncBuffer,
        { cardId: currentCard.id, direction, timestamp: Date.now() },
      ],
    });
  },

  undoLastSwipe: () => {
    const { currentIndex, pendingSyncBuffer } = get();
    if (currentIndex <= 0) return;
    set({
      currentIndex: currentIndex - 1,
      pendingSyncBuffer: pendingSyncBuffer.slice(0, -1),
    });
  },

  clearSyncBuffer: () => set({ pendingSyncBuffer: [] }),
}));
```

---

## 4. Konwencja Kluczy Zapytań TanStack Query v5

Wszystkie zapytania sieciowe są ustandaryzowane pod kątem kluczy cache:

```typescript
export const QUERY_KEYS = {
  captions: (videoId: string) => ['captions', videoId] as const,
  translation: (hash: string) => ['translation', hash] as const,
  flashcardsDue: (userId: string) => ['flashcards', 'due', userId] as const,
  userProfile: (userId: string) => ['profile', userId] as const,
  userSubscription: (userId: string) => ['subscription', userId] as const,
  watchHistory: (userId: string) => ['watch_history', userId] as const,
};
```

### Konfiguracja Domyślna Klienta (`queryClient`):
- `staleTime: 1000 * 60 * 10` (10 minut – zapytania o napisy i profil nie zmieniają się co sekundę).
- `gcTime: 1000 * 60 * 60` (1 godzina przechowywania w pamięci).
- `retry: 2` (dwukrotne ponowienie przy błędach sieciowych).
