import { create } from 'zustand';
import { Flashcard, SwipeDirection } from '@learneng/shared';

export interface SwipeRecord {
  cardId: string;
  direction: SwipeDirection;
  timestamp: number;
}

export interface FlashcardsState {
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
    const newDeck = [...deck];
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
