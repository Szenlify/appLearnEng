import { describe, expect, it } from 'bun:test';
import type { SubtitleCue } from '@learneng/shared';
import {
  clampPlaybackRate,
  findActiveCue,
  findActiveCueIndex,
  findActiveWordIndex,
  stepPlaybackRate,
  usePlayerStore,
} from '../stores/usePlayerStore';

const SAMPLE_CUES: SubtitleCue[] = [
  {
    id: 'cue_0',
    start: 2.0,
    duration: 3.0,
    end: 5.0,
    text: 'Welcome to Stanford University.',
    tokens: ['Welcome', 'to', 'Stanford', 'University.'],
  },
  {
    id: 'cue_1',
    start: 5.5,
    duration: 4.0,
    end: 9.5,
    text: "I can't put up with this attitude.",
    tokens: ['I', "can't", 'put', 'up', 'with', 'this', 'attitude.'],
  },
];

describe('Stage 6: Player Synchronization, Active Subtitle Cue & Smooth Speed Stepper', () => {
  describe('1. Active Cue & Active Word Synchronization (findActiveCue, findActiveWordIndex)', () => {
    it('findActiveCue and findActiveCueIndex return the matching cue for a given timestamp', () => {
      expect(findActiveCueIndex(1.0, SAMPLE_CUES)).toBe(-1);
      expect(findActiveCue(1.0, SAMPLE_CUES)).toBeNull();

      expect(findActiveCueIndex(3.2, SAMPLE_CUES)).toBe(0);
      expect(findActiveCue(3.2, SAMPLE_CUES)?.id).toBe('cue_0');

      expect(findActiveCueIndex(5.2, SAMPLE_CUES)).toBe(-1);
      expect(findActiveCue(5.2, SAMPLE_CUES)).toBeNull();

      expect(findActiveCueIndex(7.5, SAMPLE_CUES)).toBe(1);
      expect(findActiveCue(7.5, SAMPLE_CUES)?.id).toBe('cue_1');
    });

    it('findActiveWordIndex interpolates the currently spoken word index inside a cue', () => {
      const cue = SAMPLE_CUES[0]; // 4 tokens, start=2.0, duration=3.0, end=5.0
      expect(findActiveWordIndex(1.5, cue)).toBe(-1);
      expect(findActiveWordIndex(2.1, cue)).toBe(0); // "Welcome"
      expect(findActiveWordIndex(3.0, cue)).toBe(1); // "to"
      expect(findActiveWordIndex(3.8, cue)).toBe(2); // "Stanford"
      expect(findActiveWordIndex(4.9, cue)).toBe(3); // "University."
      expect(findActiveWordIndex(5.5, cue)).toBe(-1);
    });
  });

  describe('2. Word Tap Pauses Video & Passes Token to Translation Sheet (usePlayerStore)', () => {
    it('openTranslation pauses playback and sets selectedWord, selectedSentence, and isSheetOpen', () => {
      const store = usePlayerStore.getState();
      store.setCaptions(SAMPLE_CUES);
      store.setIsPlaying(true);
      store.setCurrentTime(6.2);

      expect(usePlayerStore.getState().isPlaying).toBe(true);
      expect(usePlayerStore.getState().activeCueIndex).toBe(1);

      usePlayerStore
        .getState()
        .openTranslation('attitude', "I can't put up with this attitude.");

      const afterTap = usePlayerStore.getState();
      expect(afterTap.isPlaying).toBe(false);
      expect(afterTap.isSheetOpen).toBe(true);
      expect(afterTap.selectedWord).toBe('attitude');
      expect(afterTap.selectedSentence).toBe("I can't put up with this attitude.");
    });

    it('closeTranslation resumes video only when autoResumeOnSheetClose is true', () => {
      usePlayerStore.getState().setAutoResumeOnSheetClose(true);
      usePlayerStore.getState().openTranslation('attitude', "I can't put up with this attitude.");
      usePlayerStore.getState().closeTranslation();
      expect(usePlayerStore.getState().isSheetOpen).toBe(false);
      expect(usePlayerStore.getState().isPlaying).toBe(true);

      usePlayerStore.getState().setAutoResumeOnSheetClose(false);
      usePlayerStore.getState().openTranslation('attitude', "I can't put up with this attitude.");
      usePlayerStore.getState().closeTranslation();
      expect(usePlayerStore.getState().isSheetOpen).toBe(false);
      expect(usePlayerStore.getState().isPlaying).toBe(false);
    });
  });

  describe('3. Smooth Playback Speed Regulation (0.25x - 2.00x in 0.05 steps)', () => {
    it('steps playback rate by exact 0.05 increments without floating-point errors and clamps to [0.25, 2.00]', () => {
      expect(stepPlaybackRate(1.0, 0.05)).toBe(1.05);
      expect(stepPlaybackRate(1.05, 0.05)).toBe(1.1);
      expect(stepPlaybackRate(1.1, 0.05)).toBe(1.15);
      expect(stepPlaybackRate(0.85, -0.05)).toBe(0.8);

      // Lower bound clamping (0.25)
      expect(clampPlaybackRate(0.1)).toBe(0.25);
      expect(stepPlaybackRate(0.25, -0.05)).toBe(0.25);

      // Upper bound clamping (2.00)
      expect(clampPlaybackRate(2.5)).toBe(2.0);
      expect(stepPlaybackRate(2.0, 0.05)).toBe(2.0);

      // Sequential stepping across full range [0.25 -> 2.00]
      let rate = 0.25;
      for (let i = 0; i < 35; i++) {
        rate = stepPlaybackRate(rate, 0.05);
        expect(Number(rate.toFixed(2))).toBe(rate);
      }
      expect(rate).toBe(2.0);
    });
  });
});
