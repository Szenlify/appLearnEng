import { create } from 'zustand';
import { SubtitleCue } from '@learneng/shared';

/**
 * Pure helper functions exported for SubtitleTrack and unit tests (subtitles.test.ts)
 */
export function findActiveCueIndex(time: number, cues: SubtitleCue[]): number {
  let matched = -1;
  for (let i = 0; i < cues.length; i++) {
    if (time >= cues[i].start && time <= cues[i].end) {
      matched = i;
    }
  }
  return matched;
}

export function findActiveCue(time: number, cues: SubtitleCue[]): SubtitleCue | null {
  const idx = findActiveCueIndex(time, cues);
  return idx >= 0 ? cues[idx] : null;
}

export function findActiveWordIndex(time: number, cue: SubtitleCue): number {
  if (!cue.tokens || cue.tokens.length === 0) return -1;
  if (time < cue.start || time > cue.end) return -1;
  const progress = Math.min(0.999, Math.max(0, (time - cue.start) / Math.max(cue.duration, 0.1)));
  return Math.floor(progress * cue.tokens.length);
}

/**
 * Clamps playback speed between 0.25x and 2.00x in exact increments of 0.05
 */
export function clampPlaybackRate(rate: number): number {
  const clamped = Math.min(2.0, Math.max(0.25, rate));
  const stepped = Math.round(clamped / 0.05) * 0.05;
  return Number(stepped.toFixed(2));
}

export function stepPlaybackRate(current: number, delta: number = 0.05): number {
  return clampPlaybackRate(current + delta);
}

export interface PlayerState {
  // Video playback
  videoId: string | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number; // 0.25 to 2.00 step 0.05 (default 1.0)
  autoResumeOnSheetClose: boolean; // default true, user configurable in profile
  accent: 'en-US' | 'en-GB'; // TTS pronunciation accent

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
  setPlaybackRate: (rate: number) => void;
  setAutoResumeOnSheetClose: (autoResume: boolean) => void;
  setAccent: (accent: 'en-US' | 'en-GB') => void;
  setCaptions: (cues: SubtitleCue[]) => void;
  openTranslation: (word: string, sentence: string) => void;
  closeTranslation: () => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  videoId: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  playbackRate: 1.0,
  autoResumeOnSheetClose: true,
  accent: 'en-US',
  cues: [],
  activeCueIndex: -1,
  selectedWord: null,
  selectedSentence: null,
  isSheetOpen: false,

  setVideoId: (id) => set({ videoId: id, currentTime: 0, activeCueIndex: -1 }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setPlaybackRate: (rate) => set({ playbackRate: clampPlaybackRate(rate) }),
  setAutoResumeOnSheetClose: (autoResume) => set({ autoResumeOnSheetClose: autoResume }),
  setAccent: (accent) => set({ accent }),

  setCurrentTime: (time) => {
    const { cues } = get();
    const newIndex = findActiveCueIndex(time, cues);
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
    const { autoResumeOnSheetClose } = get();
    set({
      isSheetOpen: false,
      selectedWord: null,
      selectedSentence: null,
      isPlaying: autoResumeOnSheetClose,
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
