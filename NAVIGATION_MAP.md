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

## 2. Tab Bar Design (Frosted Glass / Dark Blur — `apps/mobile/app/(tabs)/_layout.tsx`)

The bottom navigation bar uses `expo-blur` with dark vibrancy and **`phosphor-react-native`** icons:
- Background: `rgba(15, 23, 42, 0.85)` (Deep slate with blur filter).
- Inactive Tab Icon: `#64748B` (Slate 500) with `weight="regular"`.
- Active / Clicked Tab Icon: `#38BDF8` (Sky Blue) with `weight="fill"`.
- Icon set: `phosphor-react-native` (`Compass`, `PlayCircle`, `Cards`, `UserCircle`).

```tsx
import React from 'react';
import { Tabs } from 'expo-router';
import { BlurView } from 'expo-blur';
import { StyleSheet } from 'react-native';
import { Compass, PlayCircle, Cards, UserCircle } from 'phosphor-react-native';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#38BDF8',
        tabBarInactiveTintColor: '#64748B',
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: 'rgba(15, 23, 42, 0.85)',
          borderTopColor: 'rgba(51, 65, 85, 0.4)',
          height: 64,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarBackground: () => (
          <BlurView tint="dark" intensity={40} style={StyleSheet.absoluteFill} />
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Odkrywaj',
          tabBarIcon: ({ color, size, focused }) => (
            <Compass color={color} size={size} weight={focused ? 'fill' : 'regular'} />
          ),
        }}
      />
      <Tabs.Screen
        name="player"
        options={{
          title: 'Odtwarzacz',
          tabBarIcon: ({ color, size, focused }) => (
            <PlayCircle color={color} size={size} weight={focused ? 'fill' : 'regular'} />
          ),
        }}
      />
      <Tabs.Screen
        name="flashcards"
        options={{
          title: 'Fiszki',
          tabBarIcon: ({ color, size, focused }) => (
            <Cards color={color} size={size} weight={focused ? 'fill' : 'regular'} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, size, focused }) => (
            <UserCircle color={color} size={size} weight={focused ? 'fill' : 'regular'} />
          ),
        }}
      />
    </Tabs>
  );
}
```

---

## 3. Screen Descriptions & Primary UX Flows

### 3.1 Screen 1: Odkrywaj & Wyszukiwarka YouTube (`(tabs)/index.tsx`)
- **Górny pasek wyszukiwania z Lupką (Live YouTube Search):**
  - Pasek wyszukiwania z ikoną lupki `MagnifyingGlass` (`phosphor-react-native`: domyślnie szara `#94A3B8` `weight="regular"`, po kliknięciu/wpisaniu frazy `weight="fill"` `#38BDF8`).
  - Brak wklejania linków i detekcji schowka — użytkownik szuka filmów identycznie jak w natywnej aplikacji YouTube (wpisując np. *„MrBeast”*, *„BBC News”*, *„Joe Rogan”*).
  - Wyszukiwarka zwraca listę filmów prosto z YouTube wewnątrz aplikacji z miniaturkami HD, tytułami i długością.
- **Gdy brak zapytania (Domyślny widok główny):**
  - **Sekcja "Oglądaj dalej":** Kafelki ostatnio oglądanych filmów z paskiem postępu i liczbą zapisanych słówek.
  - **Sekcja "Kategorie & Poziomy CEFR":**
    - A1–A2: bajki, proste dialogi codzienne.
    - B1–B2: TED-Ed, podcasty naukowe, wywiady.
    - C1–C2: debaty, stand-up, przemówienia.
- **Kliknięcie kafelka:** Natychmiastowe przejście do `/(tabs)/player?videoId={id}` z synchronizacją napisów.

### 3.2 Screen 2: Odtwarzacz & Napisy (`(tabs)/player.tsx`)
- Wideo YouTube osadzone w formacie 16:9 (`react-native-youtube-iframe`).
- Pasek narzędzi pod wideo:
  - Przycisk "Powtórz zdanie" (`ArrowCounterClockwise`).
  - Płynny regulator prędkości wideo od **`0.25x` do `2.00x` stopniowo co `0.05`** (`MinusCircle`, `Gauge`, `PlusCircle`).
- Poniżej: przewijany pasek napisów z automatycznym wyśrodkowaniem na aktualnie wymawianym zdaniu.
- Kliknięcie słowa: automatyczna pauza wideo i wysunięcie `TranslationSheet` z tłumaczeniem.
- Dwa przyciski zapisu z ikonami `BookmarkSimple` oraz `NotePencil`: *"Zapisz słówko"* oraz *"Zapisz całe zdanie"*.

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
