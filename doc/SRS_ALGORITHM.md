# SRS_ALGORITHM.md — Spaced Repetition System (SM-2 Variant) & Tinder-Style 4-Way Swipe

This document describes the exact spaced repetition algorithm used for scheduling flashcards (both single words and full sentences) in LearnEng, mapped directly to Tinder-like gestures.

---

## 1. Algorithm Overview & Tinder Gestures Mapping

The algorithm computes when a card should next be reviewed based on the user's gesture swipe direction:

| Tinder Swipe Gesture | Visual Badge & Color | SM-2 Grade ($q$) | Description & Progression |
| :--- | :--- | :--- | :--- |
| ⬅️ **SWIPE LEFT** | 🔴 **AGAIN** | `Grade 0` | Forgotten; reset repetitions (`n = 0`), interval = 1 day, card returns to end of queue |
| ⬇️ **SWIPE DOWN** | 🟠 **HARD** | `Grade 1` | Recalled with hesitation; short interval (1–2 days), ease factor drops ($\Delta EF = -0.14$) |
| ➡️ **SWIPE RIGHT** | 🟢 **GOOD** | `Grade 2` | Recalled well; standard interval progression ($1 \rightarrow 3 \rightarrow 8\text{ days}$), ease factor maintained |
| ⬆️ **SWIPE UP** | 🔵 **EASY** | `Grade 3` | Instant & effortless recall; accelerated progression ($2 \rightarrow 6 \rightarrow 18\text{ days}$), ease factor rises ($\Delta EF = +0.10$) |

---

## 2. Mathematical Formulas

- **Default Ease Factor ($EF$):** $2.5$ (minimum threshold: $1.3$)
- **Interval ($I$):**
  - If $q = 0$ (Again): $repetitions = 0$, $I = 1\text{ day}$
  - If $q = 1$ (Hard): $I = 1\text{ day}$ (for $n = 0$) or $I = 2\text{ days}$ (for $n \ge 1$)
  - If $q \in \{2, 3\}$ (Good / Easy):
    - If $n = 0$: $I_1 = 1\text{ day}$ (or $2\text{ days}$ for Easy)
    - If $n = 1$: $I_2 = 3\text{ days}$ (or $6\text{ days}$ for Easy)
    - If $n > 1$: $I_{n} = \text{round}(I_{n-1} \times EF)$
- **Ease Factor Update Formula (for $q \in \{1, 2, 3\}$):**
  $$EF' = \max\Big(1.3,\; EF + \big(0.1 - (3 - q) \times (0.08 + (3 - q) \times 0.02)\big)\Big)$$
  where:
  - $q = 1$ (Hard) $\implies \Delta EF = -0.14$ (spadek łatwości)
  - $q = 2$ (Good) $\implies \Delta EF = 0.00$ (utrzymanie łatwości)
  - $q = 3$ (Easy) $\implies \Delta EF = +0.10$ (wzrost łatwości)

---

## 3. TypeScript Implementation (`packages/shared/src/srs.ts`)

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
```
