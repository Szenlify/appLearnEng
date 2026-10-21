# SRS_ALGORITHM.md — Spaced Repetition System (SM-2 Variant) & Tinder-Style 4-Way Swipe

This document describes the exact spaced repetition algorithm used for scheduling flashcards (both single words and full sentences) in LearnEng, mapped directly to Tinder-like gestures.

---

## 1. Algorithm Overview & Tinder Gestures Mapping

The algorithm computes when a card should next be reviewed based on the user's gesture swipe direction:

| Tinder Swipe Gesture | Visual Badge & Color | SM-2 Grade ($q$) | Description |
| :--- | :--- | :--- | :--- |
| ⬅️ **SWIPE W LEWO** | 🔴 **POWTÓRZ (Again)** | `Grade 0` | Zapomniane; powrót do kolejki dzisiejszej sesji, reset powtórzeń |
| ⬇️ **SWIPE W DÓŁ** | 🟠 **TRUDNE (Hard)** | `Grade 1` | Przypomniane z trudem; krótki interwał (1-2 dni), spadek współczynnika łatwości |
| ➡️ **SWIPE W PRAWO** | 🟢 **DOBRZE (Good)** | `Grade 2` | Przypomniane sprawnie; standardowy progres (3-4 dni) |
| ⬆️ **SWIPE W GÓRĘ** | 🔵 **ŁATWE (Easy)** | `Grade 3` | Natychmiastowe i bez wysiłku; długi interwał (6-7 dni), wzrost łatwości |

---

## 2. Mathematical Formulas

- **Default Ease Factor ($EF$):** $2.5$ (minimum threshold: $1.3$)
- **Interval ($I$):**
  - If $n = 0$: $I_1 = 1\text{ day}$
  - If $n = 1$: $I_2 = 3\text{ days}$ (or $6\text{ days}$ for Easy)
  - If $n > 1$: $I_{n} = I_{n-1} \times EF$
- **Ease Factor Update Formula:**
  $$EF' = EF + (0.1 - (3 - q) \times (0.08 + (3 - q) \times 0.02))$$
  where $q \in [0, 3]$ is the grade derived from swipe direction.

---

## 3. TypeScript Implementation (`srs.ts`)

```typescript
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
    // Forgot card (Again)
    repetitions = 0;
    intervalDays = 1;
  } else {
    // Successful recall
    if (repetitions === 0) {
      intervalDays = 1;
    } else if (repetitions === 1) {
      intervalDays = grade === 3 ? 6 : 3;
    } else {
      intervalDays = Math.round(intervalDays * easeFactor);
    }

    repetitions += 1;

    // Adjust ease factor
    // Map grade 0..3 to SM-2 scale 2..5
    const q = grade + 2;
    easeFactor = easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
    if (easeFactor < 1.3) easeFactor = 1.3;
  }

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
```
