# COMPONENT_SPECS.md — Reusable UI Components & Props Specification

Ten dokument definiuje dokładne interfejsy TypeScript, style NativeWind (Tailwind) oraz zachowanie kluczowych komponentów interfejsu w aplikacji mobilnej LearnEng.

---

## 1. `WordToken.tsx` (Klikalne Słowo w Napisach)

Lokalizacja: `apps/mobile/components/player/WordToken.tsx`

### Props:
```typescript
interface WordTokenProps {
  token: string;
  isActiveWord: boolean;    // Czy to słowo jest aktualnie wymawiane przez lektora
  isSelected: boolean;      // Czy użytkownik kliknął to słowo (otwarty arkusz)
  onPress: (word: string) => void;
}
```

### Wygląd, Style i Haptyka (`expo-haptics`):
- **Domyślne:** `text-slate-300 text-lg font-medium px-1 py-0.5 rounded`
- **Gdy `isActiveWord === true`:** `text-sky-400 font-bold bg-sky-950/60 shadow-sm`
- **Gdy `isSelected === true`:** `text-amber-300 font-bold bg-amber-950/80 ring-1 ring-amber-400`
- **Obszar dotyku (Hit Slop):** `{ top: 6, bottom: 6, left: 3, right: 3 }`
- **Haptyka i Czyszczenie przy kliknięciu:** Kliknięcie wywołuje `Haptics.selectionAsync()` oraz przekazuje oczyszczone słowo `cleanWordToken(token)` (bez znaków interpunkcyjnych na końcu).

---

## 2. `SubtitleTrack.tsx` (Pasek z Napisami i Auto-Scrollem)

Lokalizacja: `apps/mobile/components/player/SubtitleTrack.tsx`

### Props:
```typescript
interface SubtitleTrackProps {
  cues: SubtitleCue[];
  activeCueIndex: number;
  currentTime: number;
  onWordPress: (word: string, contextSentence: string) => void;
}
```

### Logika Auto-Scrolla i Podświetlania Aktywnego Słowa (`isActiveWord`):
- Używa `FlatList` z referencją `flatListRef`.
- Dla aktywnego zdania (`index === activeCueIndex`) numer aktualnie wymawianego słowa wyliczany jest poprzez liniową interpolację czasu wewnątrz zdania:
  ```typescript
  const progress = Math.min(1, Math.max(0, (currentTime - cue.start) / Math.max(cue.duration, 0.1)));
  const activeWordIndex = Math.floor(progress * cue.tokens.length);
  ```
- Gdy `activeCueIndex` ulega zmianie:
  ```typescript
  useEffect(() => {
    if (activeCueIndex >= 0 && flatListRef.current) {
      flatListRef.current.scrollToIndex({
        index: activeCueIndex,
        animated: true,
        viewPosition: 0.5, // 0.5 = wyśrodkowanie aktywnego zdania na ekranie
      });
    }
  }, [activeCueIndex]);
  ```
- Obsługuje `onScrollToIndexFailed` w celu ochrony przed skokami przed załadowaniem listy.

---

## 3. `TranslationSheet.tsx` (Wysuwany Arkusz Tłumaczenia)

Lokalizacja: `apps/mobile/components/sheets/TranslationSheet.tsx`

### Props:
```typescript
interface TranslationSheetProps {
  isOpen: boolean;
  word: string | null;
  sentence: string | null;
  onClose: () => void;
  onSaveWord: (data: CreateFlashcardRequestBody) => Promise<void>;
  onSaveSentence: (data: CreateFlashcardRequestBody) => Promise<void>;
}
```

### Sekcje wewnątrz Arkusza (Od Góry do Dołu):
1. **Nagłówek:**
   - Wyraz (`text-2xl font-bold text-white`).
   - Przycisk wymowy `🔊` wywołujący `playPronunciation(word)`.
   - Zapis IPA (`text-sm font-mono text-cyan-400`).
   - Pigułka części mowy (np. `phrasal verb`).
2. **Sekcja 1: Prosta Definicja (`simple_definition`):**
   - Kontener `bg-slate-800/80 p-4 rounded-xl border border-slate-700/50`.
   - Krótka, jasna definicja w języku ojczystym.
3. **Sekcja 2: Tłumaczenie Kontekstowe:**
   - Znaczenie wyrazu w tym zdaniu (`text-emerald-400 font-semibold text-lg`).
   - Pełne tłumaczenie zdania z filmu.
4. **Sekcja 3: Akordeon "💡 Explain in context":**
   - Rozwijany blok (`Pressable` ze stanem `isExpanded`).
   - Szczegółowe omówienie kontekstu kulturowego / emocjonalnego / slangu.
5. **Stopka z Przyciskami (Zapis z Haptyką):**
   - Po zapisaniu słówka lub zdania wywoływane jest `Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)`.
   - Przycisk 1: `💾 Zapisz słówko` (`bg-indigo-600 active:bg-indigo-700 text-white py-3.5 rounded-xl font-semibold`).
   - Przycisk 2: `📝 Zapisz całe zdanie` (`bg-slate-700 active:bg-slate-600 text-slate-200 py-3.5 rounded-xl font-semibold`).

---

## 4. `TinderCard.tsx` (Karta Fiszek z Gestami w 4 Osiach)

Lokalizacja: `apps/mobile/components/flashcards/TinderCard.tsx`

### Props:
```typescript
interface TinderCardProps {
  card: Flashcard;
  isTopCard: boolean;
  onSwipe: (direction: SwipeDirection) => void;
}
```

### Obsługa Gestu i Animacji (Reanimated v3 & Gesture Handler v2):
- Używa nowego API `Gesture.Pan()` oraz `<GestureDetector gesture={Gesture.Exclusive(panGesture, tapGesture)}>` z `react-native-gesture-handler` (`~2.16.1`) i `useSharedValue` / `useAnimatedStyle` z `react-native-reanimated` (`~3.10.1`) — **nie używamy wycofanego `useAnimatedGestureHandler`**.
- **Interpolacja rotacji:** `rotate: ${translateX.value * 0.08}deg`.
- **Wykrywanie dominującej osi (w `onEnd`):**
  - Jeśli $|X| > |Y|$:
    - $X < -100$ -> Swipe Lewo (`'left'` / Powtórz — czerwona poświata)
    - $X > 100$ -> Swipe Prawo (`'right'` / Dobrze — zielona poświata)
  - Jeśli $|Y| > |X|$:
    - $Y < -100$ -> Swipe Góra (`'up'` / Łatwe — błękitna poświata)
    - $Y > 100$ -> Swipe Dół (`'down'` / Trudne — pomarańczowa poświata)
- **Obrót 3D (Flip) & Wibracje Haptyczne:**
  - `Gesture.Tap()` animuje współdzieloną wartość `rotateY` (`withTiming(isFlipped ? 0 : 180)`) z perspektywą `1000` oraz wywołuje `Haptics.selectionAsync()`.
  - Awers widoczny dla kąta `< 90deg` (`backfaceVisibility: 'hidden'`), rewers dla kąta `>= 90deg`.
  - Zatwierdzenie swipe'a w którymkolwiek z 4 kierunków wywołuje `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)`.
