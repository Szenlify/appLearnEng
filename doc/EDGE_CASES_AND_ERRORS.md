# EDGE_CASES_AND_ERRORS.md — Edge Cases, Error Handling & Recovery

Ten dokument opisuje wszystkie scenariusze brzegowe (edge cases), błędy sieciowe i nieoczekiwane stany w LearnEng wraz z precyzyjną instrukcją dla AI, jak aplikacja musi na nie reagować.

---

## 1. Wideo YouTube bez Angielskich Napisów (`NO_CAPTIONS_AVAILABLE`)

### Problem:
Użytkownik wybiera z wyszukiwarki film, który nie posiada żadnych ścieżek transkrypcji (ani manualnych, ani automatycznych `a.en`).

### Obsługa w UI (100% English UI):
1. Backend zwraca kod błędu: `{ code: 'NO_CAPTIONS_AVAILABLE', message: 'No English transcript found' }` z kodem HTTP 422.
2. Aplikacja mobilna **NIE wyświetla pustego ekranu ani błędu technicznego**.
3. Poniżej wideo pojawia się estetyczny, zaokrąglony baner:
   - Ikona: `WarningCircle` (`phosphor-react-native`, `weight="fill"`, kolor `#F59E0B`).
   - Tytuł: *"This video has no English subtitles"*
   - Podtytuł: *"Search for another video or choose one of our recommended videos in Explore."*
   - Wyświetlane są 3 rekomendowane kafelki z gotowymi filmami z YouTube (np. TED-Ed, wywiad z BBC, podcast naukowy).

---

## 2. Wideo Zablokowane do Osadzania (Embed Restricted) lub Brak Wyników Wyszukiwania

### Problem:
Autor filmu na YouTube zablokował możliwość odtwarzania w zewnętrznych aplikacjach (błąd IFrame `101` lub `150`) lub wyszukiwana fraza nie zwróciła wyników.

### Obsługa (100% English UI):
1. Jeśli odtwarzacz YouTube IFrame zwróci zdarzenie `onError(101)` lub `onError(150)` (wideo zablokowane do osadzania przez autora) -> aplikacja wyświetla czytelny komunikat z ikoną `WarningCircle` (`phosphor-react-native`) oraz przycisk powrotu do wyszukiwarki: *"The author of this video has disabled playback outside YouTube. Please choose another video from Explore."*
2. Jeśli zapytanie w wyszukiwarce zwróci pustą tablicę `items: []` -> wyświetlany jest stan pusty z szarą ikoną `MagnifyingGlass` (`color="#64748B"`, `weight="regular"`) i podpowiedzią popularnych fraz edukacyjnych (*"TED-Ed"*, *"BBC Learning English"*, *"Steve Jobs"*).

---

## 3. Zabezpieczenie przed Zbyt Szybkim Klikaniem (Rapid Tapping / Debouncing)

### Problem:
Użytkownik chaotycznie klika kilka słów w ułamku sekundy, wywołując kaskadę niepotrzebnych zapytań HTTP.

### Obsługa:
1. W komponencie `SubtitleTrack` wprowadzony jest próg **200 ms debouncingu**:
   ```typescript
   import { useRef } from 'react';

   export function useWordTapHandler(onSelect: (word: string, sentence: string) => void) {
     const lastTapTime = useRef<number>(0);

     return (word: string, sentence: string) => {
       const now = Date.now();
       if (now - lastTapTime.current < 200) {
         return; // Zignoruj zbyt szybkie kliknięcie
       }
       lastTapTime.current = now;
       onSelect(word, sentence);
     };
   }
   ```

---

## 4. Tryb Offline i Utrata Połączenia z Internetem

### Zachowanie Aplikacji:
1. **Odtwarzacz Wideo:**
   - Wymaga połączenia z siecią. Gdy brak Internetu (`NetInfo.isConnected === false`), pasek stanu na górze ekranu informuje: *"No internet connection. Your flashcards are available offline."*
2. **Fiszki (Flashcards):**
   - **Działają w 100% offline.** Baza `expo-sqlite` przechowuje pobrane wcześniej fiszki.
   - Wymowa działa offline dzięki natywnej syntezie `expo-speech`.
   - Zdarzenia swipe'ów odkładają się w lokalnym buforze `pendingSyncBuffer` i synchronizują się z Supabase automatycznie po odzyskaniu sieci.

---

## 5. Daily AI Translation Quota Guard (Free vs Pro/Master)

### Problem:
A user on the Free plan exceeds their daily quota for new translations from Gemini (Cloudflare R2 cache hits are always 100% free and unlimited for all users).

### Quota Rules:
- **Free Plan:** 30 new AI lookups / 24h (resets 24 hours after `last_request_reset_at`).
- **Pro & Master Plans:** **Unlimited AI lookups.**

### Backend Implementation (`apps/backend/src/services/quota.service.ts`):
1. When a word/sentence misses R2 cache (HTTP 404), backend calls `evaluateQuota(userState)`.
2. If quota is exceeded, backend returns HTTP 429: `{ code: 'QUOTA_EXCEEDED', plan: state.planTier }`.
3. The mobile app catches HTTP 429 and immediately displays the **Paywall Modal (`app/(modals)/paywall.tsx`)**:
   - *"You've reached your free daily AI translation limit. Start your 3-day free trial of Pro to enjoy unlimited instant translations!"*

```typescript
export const DAILY_FREE_AI_LIMIT = 30;

export interface UserQuotaState {
  planTier: 'free' | 'pro' | 'master';
  status: 'inactive' | 'trialing' | 'active' | 'past_due' | 'canceled';
  dailyAiRequestsCount: number;
  lastRequestResetAt: string; // ISO 8601
}

export function evaluateQuota(state: UserQuotaState, now = new Date()): {
  allowed: boolean;
  newCount: number;
  shouldResetTimestamp: boolean;
} {
  // Pro and Master have unlimited AI requests
  if ((state.planTier === 'pro' || state.planTier === 'master') &&
      (state.status === 'active' || state.status === 'trialing')) {
    return { allowed: true, newCount: state.dailyAiRequestsCount + 1, shouldResetTimestamp: false };
  }

  const lastReset = new Date(state.lastRequestResetAt).getTime();
  const hoursSinceReset = (now.getTime() - lastReset) / (1000 * 60 * 60);

  // Free tier (30 requests per 24 hours)
  if (hoursSinceReset >= 24) {
    return { allowed: true, newCount: 1, shouldResetTimestamp: true };
  }

  if (state.dailyAiRequestsCount >= DAILY_FREE_AI_LIMIT) {
    return { allowed: false, newCount: state.dailyAiRequestsCount, shouldResetTimestamp: false };
  }

  return { allowed: true, newCount: state.dailyAiRequestsCount + 1, shouldResetTimestamp: false };
}
```

---

## 6. In-App Purchase Flow & RevenueCat Error Handling

### Scenarios:
1. **User Dismisses Native Purchase Sheet (`userCancelled: true`):**
   - The app gracefully closes the loading spinner and leaves the user on the paywall screen without showing error alerts.
2. **Payment Declined or Billing Issue:**
   - Native App Store / Google Play modal informs the user. If an error is returned by RevenueCat, show a clean banner: *"Purchase could not be completed. Please check your payment method in App Store / Google Play."*
3. **Restore Purchases:**
   - Tap "Restore Purchases" in the Paywall or Profile screen calls `Purchases.restorePurchases()`.
   - If an active `pro_access` entitlement is found: update state, show toast *"Purchases successfully restored!"* and dismiss paywall.
   - If no active entitlement: show toast *"No active subscription found for this account."*
