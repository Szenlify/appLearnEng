export const DAILY_FREE_AI_LIMIT = 30;

export interface UserQuotaState {
  planTier: 'free' | 'pro' | 'master';
  status: 'inactive' | 'trialing' | 'active' | 'past_due' | 'canceled';
  dailyAiRequestsCount: number;
  lastRequestResetAt: string; // ISO 8601
}

export function evaluateQuota(
  state: UserQuotaState,
  now = new Date()
): {
  allowed: boolean;
  newCount: number;
  shouldResetTimestamp: boolean;
} {
  // Pro and Master have unlimited AI requests
  if (
    (state.planTier === 'pro' || state.planTier === 'master') &&
    (state.status === 'active' || state.status === 'trialing')
  ) {
    return {
      allowed: true,
      newCount: state.dailyAiRequestsCount + 1,
      shouldResetTimestamp: false,
    };
  }

  const lastReset = new Date(state.lastRequestResetAt).getTime();
  const hoursSinceReset = (now.getTime() - lastReset) / (1000 * 60 * 60);

  // Free tier (30 requests per 24 hours)
  if (hoursSinceReset >= 24) {
    return { allowed: true, newCount: 1, shouldResetTimestamp: true };
  }

  if (state.dailyAiRequestsCount >= DAILY_FREE_AI_LIMIT) {
    return {
      allowed: false,
      newCount: state.dailyAiRequestsCount,
      shouldResetTimestamp: false,
    };
  }

  return {
    allowed: true,
    newCount: state.dailyAiRequestsCount + 1,
    shouldResetTimestamp: false,
  };
}
