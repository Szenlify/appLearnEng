# EDGE_CASES_AND_ERRORS.md — Edge Cases, Error Handling & Recovery

Ten dokument opisuje wszystkie scenariusze brzegowe (edge cases), błędy sieciowe i nieoczekiwane stany w LearnEng wraz z precyzyjną instrukcją dla AI, jak aplikacja musi na nie reagować.

---

## 1. Wideo YouTube bez Angielskich Napisów (`NO_CAPTIONS_AVAILABLE`)

### Problem:
Użytkownik wybiera z wyszukiwarki film, który nie posiada żadnych ścieżek transkrypcji (ani manualnych, ani automatycznych `a.en`).

### Obsługa w UI:
1. Backend zwraca kod błędu: `{ code: 'NO_CAPTIONS_AVAILABLE', message: 'No English transcript found' }` z kodem HTTP 422.
2. Aplikacja mobilna **NIE wyświetla pustego ekranu ani błędu technicznego**.
3. Poniżej wideo pojawia się estetyczny, zaokrąglony baner:
   - Ikona: `WarningCircle` (`phosphor-react-native`, `weight="fill"`, kolor `#F59E0B`).
   - Tytuł: *"Ten film nie posiada angielskich napisów"*
   - Podtytuł: *"Wyszukaj inny materiał za pomocą lupki lub wybierz jeden z polecanych filmów do nauki poniżej:"*
   - Wyświetlane są 3 rekomendowane kafelki z gotowymi filmami z YouTube (np. TED-Ed, wywiad z BBC, podcast naukowy).

---

## 2. Wideo Zablokowane do Osadzania (Embed Restricted) lub Brak Wyników Wyszukiwania

### Problem:
Autor filmu na YouTube zablokował możliwość odtwarzania w zewnętrznych aplikacjach (błąd IFrame `101` lub `150`) lub wyszukiwana fraza nie zwróciła wyników.

### Obsługa:
1. Jeśli odtwarzacz YouTube IFrame zwróci zdarzenie `onError(101)` lub `onError(150)` (wideo zablokowane do osadzania przez autora) -> aplikacja wyświetla czytelny komunikat z ikoną `WarningCircle` (`phosphor-react-native`) oraz przycisk powrotu do wyszukiwarki: *"Autor tego filmu wyłączył odtwarzanie poza YouTube. Wybierz inny materiał z wyszukiwarki."*
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
   - Wymaga połączenia z siecią. Gdy brak Internetu (`NetInfo.isConnected === false`), pasek stanu na górze ekranu informuje: *"Brak połączenia z siecią. Fiszki są dostępne offline."*
2. **Fiszki (Flashcards):**
   - **Działają w 100% offline.** Baza `expo-sqlite` przechowuje pobrane wcześniej fiszki.
   - Wymowa działa offline dzięki natywnej syntezie `expo-speech`.
   - Zdarzenia swipe'ów odkładają się w lokalnym buforze `pendingSyncBuffer` i synchronizują się z Supabase automatycznie po odzyskaniu sieci.

---

## 5. Wykorzystanie Dziennego Limitu Tłumaczeń (Quota Guard dla Użytkowników Free)

### Problem:
Użytkownik bez aktywnej subskrypcji przekracza dzienny limit zapytań o nowe słowa do Gemini (50 nowych zapytań / 24h; słowa z cache R2 są zawsze darmowe i nielimitowane).

### Obsługa i Implementacja w Backendzie (`apps/backend/src/services/quota.service.ts`):
1. Backend przy próbie tłumaczenia nieznanego słowa (błąd 404 z R2) wywołuje `checkAndIncrementAiQuota(userId)`.
2. Jeśli minęło 24h od `last_request_reset_at`, licznik `daily_ai_requests_count` jest automatycznie zerowany.
3. Przy przekroczeniu limitu na planie `free` backend zwraca HTTP 429: `{ code: 'QUOTA_EXCEEDED', plan: 'free' }`.
4. Aplikacja mobilna po otrzymaniu HTTP 429 natychmiast otwiera modal **Paywalla (`app/(modals)/paywall.tsx`)** z komunikatem:
   - *"Wykorzystałeś dzisiejszy darmowy limit tłumaczeń AI. Aktywuj 3 dni za darmo planu Pro, aby uczyć się bez ograniczeń!"*

```typescript
export const DAILY_FREE_AI_LIMIT = 50;

export interface UserQuotaState {
  planTier: 'free' | 'starter' | 'pro' | 'master';
  status: 'inactive' | 'trialing' | 'active' | 'past_due' | 'canceled';
  dailyAiRequestsCount: number;
  lastRequestResetAt: string; // ISO 8601
}

export function evaluateQuota(state: UserQuotaState, now = new Date()): {
  allowed: boolean;
  newCount: number;
  shouldResetTimestamp: boolean;
} {
  // Aktywna subskrypcja lub 3-dniowy trial -> brak dziennego limitu
  if (state.planTier !== 'free' && (state.status === 'active' || state.status === 'trialing')) {
    return { allowed: true, newCount: state.dailyAiRequestsCount + 1, shouldResetTimestamp: false };
  }

  const lastReset = new Date(state.lastRequestResetAt).getTime();
  const hoursSinceReset = (now.getTime() - lastReset) / (1000 * 60 * 60);

  // Automatyczny reset po 24 godzinach
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

## 6. Przerwanie / Anulowanie Płatności Stripe

### Problem:
Użytkownik otwiera Stripe Checkout / PaymentSheet i zamyka okno bez dokonania płatności.

### Obsługa:
1. Zamknięcie PaymentSheet bez błędu nie wyświetla czerwonych alertów – użytkownik wraca płynnie do aplikacji na ekran Paywalla z zachowanym stanem.
2. W przypadku odrzucenia karty przez bank (`card_declined`) aplikacja wyświetla natywny komunikat: *"Karta została odrzucona przez bank. Wypróbuj inną kartę lub BLIK"*.
