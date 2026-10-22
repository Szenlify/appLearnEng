# NAVIGATION_MAP.md — Screen Hierarchy & Expo Router Structure

This document details the exact file-based navigation structure in `apps/mobile/app` using **Expo Router (v3+)**.

---

## 1. Directory Tree (`apps/mobile/app/`)

```
app/
├── _layout.tsx                 # Root layout (Fonts, Supabase Auth Provider, Dark Theme)
├── (auth)/                     # Unauthenticated Flow
│   ├── _layout.tsx
│   └── login.tsx               # Social Auth Only: Apple Sign In & Google Sign In
│
├── (tabs)/                     # Main Bottom Tab Navigation
│   ├── _layout.tsx             # Frosted Glass TabBar with BlurView
│   ├── index.tsx               # 🔍 Odkrywaj (Explore / Input linku YouTube / Polecane filmy)
│   ├── player.tsx              # 🎬 Odtwarzacz Wideo + Interaktywne Napisy
│   ├── flashcards.tsx          # 🃏 Tinder-Style 4-Way Swipe Fiszki Deck
│   └── profile.tsx             # 👤 Profil, Statystyki, Subskrypcja Stripe & Ustawienia
│
└── (modals)/                   # Floating / Fullscreen Modals
    ├── _layout.tsx             # presentation: 'modal'
    └── paywall.tsx             # 💎 Stripe Paywall (Starter / Pro / Master + 3 Dni Trial)
```

---

## 2. Tab Bar Design (Frosted Glass / Dark Blur)

The bottom navigation bar uses `expo-blur` with dark vibrancy:
- Background: `rgba(15, 23, 42, 0.75)` (Deep slate with 20px blur filter).
- Active Tab Color: `#38BDF8` (Sky Blue glow).
- Inactive Tab Color: `#64748B` (Slate 500).
- Icon set: `lucide-react-native` (`Compass`, `PlaySquare`, `Layers`, `User`).

---

## 3. Screen Descriptions & Primary UX Flows

### 3.1 🔍 Screen 1: Odkrywaj & Wyszukiwarka YouTube (`(tabs)/index.tsx`)
- **Górny pasek wyszukiwania (Live YouTube Search):**
  - Użytkownik wpisuje dowolną frazę (np. *„MrBeast”*, *„BBC News”*, *„Joe Rogan”*) lub wkleja link.
  - Wyszukiwarka zwraca listę filmów prosto z YouTube wewnątrz aplikacji z miniaturkami HD, tytułami i długością.
  - Automatyczne wykrywanie linku ze schowka systemowego (`Clipboard.getStringAsync()`).
- **Gdy brak zapytania (Domyślny widok główny):**
  - **Sekcja "Oglądaj dalej":** Kafelki ostatnio oglądanych filmów z paskiem postępu i liczbą zapisanych słówek.
  - **Sekcja "Kategorie & Poziomy CEFR":**
    - A1–A2: bajki, proste dialogi codzienne.
    - B1–B2: TED-Ed, podcasty naukowe, wywiady.
    - C1–C2: debaty, stand-up, przemówienia.
- **Kliknięcie kafelka:** Natychmiastowe przejście do `/(tabs)/player?videoId={id}` z synchronizacją napisów.

### 3.2 🎬 Screen 2: Odtwarzacz & Napisy (`(tabs)/player.tsx`)
- Wideo YouTube osadzone w formacie 16:9 (`react-native-youtube-iframe`).
- Poniżej wideo: przewijany pasek napisów z automatycznym wyśrodkowaniem na aktualnie wymawianym zdaniu.
- Kliknięcie słowa: automatyczna pauza wideo i wysunięcie `TranslationSheet` z tłumaczeniem.
- Dwa przyciski zapisu: *"💾 Zapisz słówko"* oraz *"📝 Zapisz całe zdanie"*.

### 3.3 🃏 Screen 3: Fiszki Tinder-Deck (`(tabs)/flashcards.tsx`)
- Stos 3 kart z animacją `react-native-reanimated`.
- Gesty w 4 osiach:
  - ⬅️ Lewo: Powtórz (Again)
  - ⬇️ Dół: Trudne (Hard)
  - ➡️ Prawo: Dobrze (Good)
  - ⬆️ Góra: Łatwe (Easy)
- Tapnięcie obraca kartę w 3D (angielski przód -> polski tył z kontekstem z filmu).

### 3.4 👤 Screen 4: Profil & Ustawienia (`(tabs)/profile.tsx`)
- Informacje o koncie i poziom CEFR.
- Statystyka: łączna liczba poznanych słówek, dni z rzędu (Streak), obejrzane minuty.
- Status subskrypcji Stripe (Aktywny plan: Starter / Pro / Master / Dni trialu).
- Przycisk *"Zarządzaj subskrypcją"* otwierający Stripe Customer Portal.
