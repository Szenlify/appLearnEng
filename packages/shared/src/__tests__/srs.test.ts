import { describe, expect, it } from 'bun:test';
import {
  calculateNextReview,
  calculateNextReviewFromSwipe,
  SWIPE_TO_GRADE_MAP,
} from '../index';

describe('Stage 4: SM-2 Spaced Repetition Algorithm & 4-Way Tinder Swipe Mapping', () => {
  it('1. Grade 0 (Swipe Left / Again): resets repetitions to 0 and sets intervalDays to 1', () => {
    expect(SWIPE_TO_GRADE_MAP.left).toBe(0);

    const state = { repetitions: 4, intervalDays: 15, easeFactor: 2.5 };
    const result = calculateNextReviewFromSwipe(state, 'left');

    expect(result.repetitions).toBe(0);
    expect(result.intervalDays).toBe(1);
    expect(result.easeFactor).toBe(2.5);
    expect(typeof result.nextReviewAt).toBe('string');
  });

  it('2. Grade 1 (Swipe Down / Hard): decreases easeFactor (-0.14) and sets intervalDays to 1..2 days', () => {
    expect(SWIPE_TO_GRADE_MAP.down).toBe(1);

    const firstHard = calculateNextReviewFromSwipe(
      { repetitions: 0, intervalDays: 0, easeFactor: 2.5 },
      'down'
    );
    expect(firstHard.repetitions).toBe(1);
    expect(firstHard.intervalDays).toBe(1);
    expect(firstHard.easeFactor).toBe(2.36);

    const secondHard = calculateNextReviewFromSwipe(firstHard, 'down');
    expect(secondHard.repetitions).toBe(2);
    expect(secondHard.intervalDays).toBe(2);
    expect(secondHard.easeFactor).toBe(2.22);
  });

  it('3. Grade 2 (Swipe Right / Good): progresses interval 1 -> 3 -> 8 days at EF=2.50', () => {
    expect(SWIPE_TO_GRADE_MAP.right).toBe(2);

    const step1 = calculateNextReviewFromSwipe(
      { repetitions: 0, intervalDays: 0, easeFactor: 2.5 },
      'right'
    );
    expect(step1.repetitions).toBe(1);
    expect(step1.intervalDays).toBe(1);
    expect(step1.easeFactor).toBe(2.5);

    const step2 = calculateNextReviewFromSwipe(step1, 'right');
    expect(step2.repetitions).toBe(2);
    expect(step2.intervalDays).toBe(3);
    expect(step2.easeFactor).toBe(2.5);

    const step3 = calculateNextReviewFromSwipe(step2, 'right');
    expect(step3.repetitions).toBe(3);
    expect(step3.intervalDays).toBe(8);
    expect(step3.easeFactor).toBe(2.5);
  });

  it('4. Grade 3 (Swipe Up / Easy): accelerates interval (2 -> 6 -> 18+ days) and increases easeFactor (+0.10)', () => {
    expect(SWIPE_TO_GRADE_MAP.up).toBe(3);

    const step1 = calculateNextReviewFromSwipe(
      { repetitions: 0, intervalDays: 0, easeFactor: 2.5 },
      'up'
    );
    expect(step1.repetitions).toBe(1);
    expect(step1.intervalDays).toBe(2);
    expect(step1.easeFactor).toBe(2.6);

    const step2 = calculateNextReview(
      { repetitions: 1, intervalDays: 2, easeFactor: 2.5 },
      3
    );
    expect(step2.repetitions).toBe(2);
    expect(step2.intervalDays).toBe(6);
    expect(step2.easeFactor).toBe(2.6);

    const step3 = calculateNextReview(
      { repetitions: 2, intervalDays: 6, easeFactor: 2.5 },
      3
    );
    expect(step3.repetitions).toBe(3);
    expect(step3.intervalDays).toBe(18);
    expect(step3.easeFactor).toBe(2.6);
  });

  it('5. Enforces minimum easeFactor threshold >= 1.3', () => {
    let state = { repetitions: 1, intervalDays: 1, easeFactor: 1.35 };

    state = calculateNextReview(state, 1);
    expect(state.easeFactor).toBe(1.3);

    state = calculateNextReview(state, 1);
    expect(state.easeFactor).toBe(1.3);

    state = calculateNextReview({ repetitions: 2, intervalDays: 2, easeFactor: 1.1 }, 0);
    expect(state.easeFactor).toBe(1.3);
  });
});
