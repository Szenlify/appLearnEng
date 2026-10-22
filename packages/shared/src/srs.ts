export interface SRSCardState {
  repetitions: number;      // Number of successful consecutive reviews
  intervalDays: number;     // Days until next review
  easeFactor: number;       // Difficulty multiplier (default 2.5)
  nextReviewAt: string;     // ISO Date string
}

export type SwipeDirection = 'left' | 'down' | 'right' | 'up';
export type ReviewGrade = 0 | 1 | 2 | 3;

export const SWIPE_TO_GRADE_MAP: Record<SwipeDirection, ReviewGrade> = {
  left: 0,   // Powtórz (Again)
  down: 1,   // Trudne (Hard)
  right: 2,  // Dobrze (Good)
  up: 3,     // Łatwe (Easy)
};

export function calculateNextReviewFromSwipe(
  currentState: { repetitions: number; intervalDays: number; easeFactor: number },
  direction: SwipeDirection
): SRSCardState {
  const grade = SWIPE_TO_GRADE_MAP[direction];
  return calculateNextReview(currentState, grade);
}

export function calculateNextReview(
  currentState: { repetitions: number; intervalDays: number; easeFactor: number },
  grade: ReviewGrade
): SRSCardState {
  let { repetitions, intervalDays, easeFactor } = currentState;

  if (grade === 0) {
    // Forgot card (Swipe Left / Again)
    repetitions = 0;
    intervalDays = 1;
  } else {
    if (grade === 1) {
      // Hard recall (Swipe Down / Hard): short interval (1-2 days)
      intervalDays = repetitions === 0 ? 1 : 2;
    } else if (repetitions === 0) {
      intervalDays = grade === 3 ? 2 : 1;
    } else if (repetitions === 1) {
      intervalDays = grade === 3 ? 6 : 3;
    } else {
      const multiplier = grade === 3 ? easeFactor * 1.2 : easeFactor;
      intervalDays = Math.round(intervalDays * multiplier);
    }

    repetitions += 1;

    // Adjust ease factor using q in 1..3
    easeFactor = easeFactor + (0.1 - (3 - grade) * (0.08 + (3 - grade) * 0.02));
    if (easeFactor < 1.3) easeFactor = 1.3;
  }

  if (easeFactor < 1.3) easeFactor = 1.3;

  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + intervalDays);
  // Set to 04:00 AM local time for clean daily batches
  nextDate.setHours(4, 0, 0, 0);

  return {
    repetitions,
    intervalDays,
    easeFactor: Number(easeFactor.toFixed(2)),
    nextReviewAt: nextDate.toISOString(),
  };
}
