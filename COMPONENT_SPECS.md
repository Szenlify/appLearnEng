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

## 3. `TranslationSheet.tsx` (Wysuwany Arkusz Tłumaczenia — `@gorhom/bottom-sheet`)

Lokalizacja: `apps/mobile/components/sheets/TranslationSheet.tsx`

### Komponent Bazowy i Konfiguracja:
Wykorzystuje `@gorhom/bottom-sheet` (`BottomSheetModal` lub `BottomSheet`):
- **Snap points:** `snapPoints={['50%', '85%']}`
- **Tło arkusza (BackgroundStyle):** `#1E293B` (slate-800) z zaokrąglonymi rogami `rounded-t-3xl border-t border-slate-700`
- **Uchwyt (HandleIndicatorStyle):** `bg-slate-500 w-12 h-1.5 rounded-full`
- **Backdrop:** `BottomSheetBackdrop` z `disappearsOnIndex={-1}` i `appearsOnIndex={0}` (`opacity: 0.5`)

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

### Sekcje wewnątrz Arkusza (Od Góry do Dołu) — Ikony `phosphor-react-native`:
Wszystkie ikony w arkuszu są domyślnie szare (`color="#94A3B8"`, `weight="regular"`), a po kliknięciu / aktywacji przechodzą w stan `weight="fill"` z kolorem akcentu. Wszystkie teksty interfejsu są w języku **angielskim**:
1. **Nagłówek (Header):**
   - Wyraz (`text-2xl font-bold text-white`).
   - Przycisk wymowy `SpeakerHigh` (domyślnie `color="#94A3B8" weight="regular"`, po kliknięciu `color="#38BDF8" weight="fill"`) wywołujący `playPronunciation(word)`.
   - Zapis IPA (`text-sm font-mono text-cyan-400`).
   - Pigułka części mowy (np. `phrasal verb` w `bg-sky-950/80 text-sky-300 text-xs px-2 py-0.5 rounded-full border border-sky-700/50`).
2. **Sekcja 1: Prosta Definicja (`simple_definition`):**
   - Kontener `bg-slate-800/80 p-4 rounded-xl border border-slate-700/50`.
   - Krótka, jasna definicja w języku docelowym (domyślnie English: plain A2/B1 level explanation).
3. **Sekcja 2: Tłumaczenie Kontekstowe (Context Meaning):**
   - Znaczenie wyrazu w tym zdaniu (`text-emerald-400 font-semibold text-lg`).
   - Pełne zdanie z filmu z zaznaczonym kontekstem.
4. **Sekcja 3: Akordeon "Explain in context":**
   - Rozwijany blok (`Pressable` ze stanem `isExpanded`) z nagłówkiem "Explain in context" i ikoną `Lightbulb` (gdy `isExpanded === false`: `color="#94A3B8" weight="regular"`; gdy `isExpanded === true`: `color="#FACC15" weight="fill"`).
   - Szczegółowe omówienie kontekstu kulturowego / emocjonalnego / slangu.
5. **Stopka z Przyciskami (Zapis z Haptyką i Fill Color):**
   - Po zapisaniu słówka lub zdania wywoływane jest `Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)`.
   - Przycisk 1: `Save Word` z ikoną `BookmarkSimple` (domyślnie `color="#94A3B8" weight="regular"`, po kliknięciu/zapisaniu `color="#38BDF8" weight="fill"`).
   - Przycisk 2: `Save Sentence` z ikoną `NotePencil` (domyślnie `color="#94A3B8" weight="regular"`, po kliknięciu/zapisaniu `color="#10B981" weight="fill"`).

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
- Używa API `Gesture.Pan()` oraz `<GestureDetector gesture={Gesture.Exclusive(panGesture, tapGesture)}>` z `react-native-gesture-handler` (`~2.20.2`) i `useSharedValue` / `useAnimatedStyle` z `react-native-reanimated` (`~3.16.1`) — **nie używamy wycofanego `useAnimatedGestureHandler`**.
- **Interpolacja rotacji:** `rotate: ${translateX.value * 0.08}deg`.
- **Wykrywanie dominującej osi (w `onEnd`):**
  - Jeśli $|X| > |Y|$:
    - $X < -100$ -> Swipe Left (`'left'` / **Again** — czerwona poświata `border-rose-500/80`)
    - $X > 100$ -> Swipe Right (`'right'` / **Good** — zielona poświata `border-emerald-500/80`)
  - Jeśli $|Y| > |X|$:
    - $Y < -100$ -> Swipe Up (`'up'` / **Easy** — błękitna poświata `border-sky-500/80`)
    - $Y > 100$ -> Swipe Down (`'down'` / **Hard** — bursztynowa poświata `border-amber-500/80`)
- **Obrót 3D (Flip) & Wibracje Haptyczne:**
  - `Gesture.Tap()` animuje współdzieloną wartość `rotateY` (`withTiming(isFlipped ? 0 : 180, { duration: 300 })`) z perspektywą `1000` oraz wywołuje `Haptics.selectionAsync()`.
  - Awers widoczny dla kąta `< 90deg` (`backfaceVisibility: 'hidden'`), rewers dla kąta `>= 90deg`.
  - Wskaźnik "Tap to flip" widoczny na dole karty przed obróceniem.
  - Zatwierdzenie swipe'a w którymkolwiek z 4 kierunków wywołuje `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)`.
