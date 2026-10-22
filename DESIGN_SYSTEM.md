# DESIGN_SYSTEM.md — UI/UX Design System & Tokens

This document specifies the exact visual language, color tokens, and micro-interactions for the LearnEng mobile app.

---

## 1. Theme Philosophy: Dark Mode First (Immersive Video Experience)

Since users spend long sessions watching YouTube videos, the default interface is dark-themed to minimize eye strain and maximize OLED battery efficiency.

### 1.1 Color Tokens

```json
{
  "colors": {
    "background": {
      "main": "#0B0F19",       // Deep Obsidian (Player & Main screen background)
      "surface": "#161F30",    // Elevated cards & bottom sheets
      "surfaceElevated": "#1E293B" // Dialogs & inputs
    },
    "text": {
      "primary": "#F8FAFC",     // White Slate
      "secondary": "#94A3B8",   // Muted Slate
      "dim": "#64748B"          // Subtitle inactive text
    },
    "subtitles": {
      "activeWord": "#38BDF8",  // Bright Cyan / Sky Blue (current spoken word)
      "activeSentence": "#FFFFFF",
      "inactive": "#64748B",
      "wordTapped": "#FACC15"   // Amber Gold (word selected by user)
    },
    "brand": {
      "primary": "#6366F1",     // Indigo 500 (Primary buttons)
      "primaryHover": "#4F46E5",
      "accent": "#38BDF8"       // Sky Blue
    },
    "tinderSwipe": {
      "left": "#EF4444",        // Red (Powtórz / Again)
      "right": "#10B981",       // Green (Dobre / Good)
      "up": "#38BDF8",          // Cyan / Sky Blue (Łatwe / Easy)
      "down": "#F59E0B"         // Amber / Orange (Trudne / Hard)
    },
    "badges": {
      "A1": "#10B981",          // Emerald Green
      "A2": "#3B82F6",          // Blue
      "B1": "#8B5CF6",          // Purple
      "B2": "#F59E0B",          // Amber
      "C1": "#EF4444",          // Rose
      "C2": "#EC4899"           // Pink
    },
    "icons": {
      "inactive": "#94A3B8",    // Default Grey for all icons (weight="regular")
      "inactiveDim": "#64748B", // TabBar & secondary unselected grey
      "activeFill": "#38BDF8"   // Default Fill Color on click / active state (weight="fill")
    }
  }
}
```

### 1.2 System Ikon (`phosphor-react-native` — Zero Tekstowych Emotek)
W całej aplikacji obowiązuje zakaz używania systemowych emotek tekstowych Unicode. Używamy wyłącznie nowoczesnych, lekkich ikon wektorowych **`phosphor-react-native`**:
- **Stan domyślny (Niekliknięty / Nieaktywny):** Zawsze w kolorze szarym (`color="#94A3B8"` lub `#64748B`) oraz w cienkim stylu obrysowym **`weight="regular"`**.
- **Stan po kliknięciu / Aktywny (`isPressed` / `isActive` / `isSelected`):** Ikona natychmiast przełącza się na pełne wypełnienie **`weight="fill"`** i przyjmuje kolor akcentu (`#38BDF8` Sky Blue, `#6366F1` Indigo, `#10B981` Emerald lub `#F59E0B` Amber).

---

## 2. Component Specifications

### 2.1 The Subtitle Strip (`SubtitleTrack.tsx`)
- Positioned directly below the 16:9 YouTube video player and playback toolbar.
- Playback Toolbar includes:
  - **Repeat Sentence button:** `ArrowCounterClockwise` icon (`weight="regular"` `#94A3B8` $\rightarrow$ `weight="fill"` `#38BDF8` on press).
  - **Smooth Speed Controller (`0.25x` – `2.00x` step `0.05`):** Precision stepper (`MinusCircle` `-0.05`, `Gauge` current speed `1.00x`, `PlusCircle` `+0.05`), clamped between `0.25` and `2.00`.
- Font size: `18px`, medium weight (`font-medium`), line height `1.6`.
- Each word is an independent touchable element (`TouchableOpacity` or `Pressable`) with hit slop (`{ top: 6, bottom: 6, left: 3, right: 3 }`).
- Auto-scroll keeps the currently spoken sentence in vertical center without jarring jumps (smooth animated scroll).

### 2.2 Bottom Sheet Modal (`TranslationSheet.tsx`)
- Triggered instantly when a word/phrase is tapped in subtitles.
- Snap points: `['50%', '85%']`.
- **Header:**
  - Selected word / phrase (`text-2xl font-bold text-white`).
  - Pronunciation Audio Button: `SpeakerHigh` icon from `phosphor-react-native` (default grey `#94A3B8` `weight="regular"`, switches to `weight="fill"` `#38BDF8` while speaking).
  - IPA transcription (`text-sm font-mono text-cyan-400`, np. `/ˌpʊt ʌp ˈwɪð/`).
  - CEFR Badge (`A1`–`C2`) & Part of Speech pill (np. `phrasal verb`).
- **Warstwa 1: Prosta Definicja (Simple Definition):**
  - Wyświetlana na samej górze w języku ojczystym użytkownika (`text-base text-slate-200 font-medium leading-relaxed`). Zwięzłe wyjaśnienie znaczenia bez skomplikowanego żargonu.
- **Warstwa 2: Tłumaczenie Kontekstowe:**
  - Dokładne tłumaczenie słowa w tym zdaniu (`text-emerald-400 font-semibold text-lg`).
  - Pełne tłumaczenie zdania z filmu.
- **Warstwa 3: Przycisk "Explain in context":**
  - Klikalny akordeon z ikoną `Lightbulb` (domyślnie szara `#94A3B8` `weight="regular"`, po kliknięciu/rozwinięciu `weight="fill"` `#FACC15`) rozwijający szczegółowe wyjaśnienie: dlaczego dane słowo zostało użyte w ten sposób w filmie, niuanse emocjonalne, czy to slang lub idiom.
- **Warstwa 4: Przykład użycia:**
  - Zdanie przykładowe po angielsku z tłumaczeniem.
- **Footer Action Buttons (Zapis do fiszek z ikonami Phosphor):**
  - Button 1: **"Zapisz słówko"** z ikoną `BookmarkSimple` (domyślnie szara `#94A3B8` `weight="regular"`, po kliknięciu `weight="fill"` `#38BDF8`).
  - Button 2: **"Zapisz całe zdanie"** z ikoną `NotePencil` (domyślnie szara `#94A3B8` `weight="regular"`, po kliknięciu `weight="fill"` `#10B981`).

---

## 3. Tinder-Style 4-Way Swipe Flashcards Deck (`FlashcardsDeck.tsx`)

Ekran powtórek fiszek działa na wzór interfejsu **Tindera z obsługą 4 kierunków gestu (Lewo, Prawo, Góra, Dół)**, zbudowany przy użyciu `react-native-reanimated` (v3) oraz `react-native-gesture-handler`.

### 3.1 Efekt Stosu Kart (Card Stack Architecture):
- Wyświetlane są jednocześnie **3 karty na stosie**:
  - **Karta 0 (Aktywna):** Pełny rozmiar (`scale: 1.0`), reaguje na gesty palca, rotuje i przesuwa się.
  - **Karta 1 (Następna):** Lekko pomniejszona (`scale: 0.95`, `translateY: 14`), wyłania się płynnie w miarę odsuwania karty wierzchniej.
  - **Karta 2 (Kolejna):** Jeszcze mniejsza (`scale: 0.90`, `translateY: 28`).

### 3.2 Przypisanie 4 Kierunków Swipe do Algorytmu SM-2:

| Kierunek Gestu | Etykieta & Glow | Ocena SRS | Kolor | Działanie |
| :--- | :--- | :--- | :--- | :--- |
| ⬅️ **SWIPE W LEWO** | **POWTÓRZ (Again)** | `Grade 0` | Czerwony (`#EF4444`) | Nie pamiętam; karta wraca do puli i pojawi się na koniec sesji. |
| ➡️ **SWIPE W PRAWO** | **DOBRZE (Good)** | `Grade 2` | Zielony (`#10B981`) | Normalne przypomnienie; standardowy interwał powtórki (np. za 3-4 dni). |
| ⬆️ **SWIPE W GÓRĘ** | **ŁATWE (Easy)** | `Grade 3` | Błękitny (`#38BDF8`) | Błyskawiczne i pewne; długi interwał (np. za 6-7 dni). |
| ⬇️ **SWIPE W DÓŁ** | **TRUDNE (Hard)** | `Grade 1` | Pomarańczowy (`#F59E0B`) | Pamiętam z trudem; krótki interwał powtórki (np. za 1-2 dni). |

### 3.3 Obrót 3D Karty (Flip na Tapnięcie):
- **Tap w kartę:** Płynna animacja flipu 3D (`rotateY: 0deg -> 180deg`) z efektem perspektywy (`perspective: 1000`).
  - **Awers (Przód):** Wyraz lub całe zdanie po angielsku + przycisk odsłuchania audio z ikoną `SpeakerHigh` (`weight="regular"` `#94A3B8` $\rightarrow$ po kliknięciu `weight="fill"` `#38BDF8`).
  - **Rewers (Tył):** Prosta definicja, polskie tłumaczenie, transkrypcja IPA, wyjaśnienie w kontekście oraz kadr i zdanie z filmu YouTube, z którego pochodzi fiszka.
