# NAVIGATION_MAP.md — Screen Hierarchy & Expo Router Structure

This document details the exact file-based navigation structure in `apps/mobile/app` using **Expo Router (v4+)**. All screens and UI labels are in **English**.

---

## 1. Directory Tree (`apps/mobile/app/`)

```
app/
├── _layout.tsx                 # Root layout (Fonts, Supabase Auth Provider, Dark Theme, Audio fix)
├── (auth)/                     # Unauthenticated Flow
│   ├── _layout.tsx
│   ├── login.tsx               # Social Auth Only: Apple Sign In & Google Sign In
│   └── callback.tsx            # Deep link redirect handler for Google OAuth
│
├── (tabs)/                     # Main Bottom Tab Navigation
│   ├── _layout.tsx             # Frosted Glass TabBar with BlurView (English labels)
│   ├── index.tsx               # 🔍 Explore (Live YouTube Search + Curated CEFR Collections)
│   ├── player.tsx              # 🎬 Video Player + Synchronized Interactive Subtitles
│   ├── flashcards.tsx          # 🃏 Tinder-Style 4-Way Swipe Flashcards Deck
│   └── profile.tsx             # 👤 Profile, Learning Stats, RevenueCat Subscriptions & Account Deletion
│
└── (modals)/                   # Floating / Fullscreen Modals
    ├── _layout.tsx             # presentation: 'modal'
    └── paywall.tsx             # 💎 RevenueCat Native In-App Purchases (Pro / Master + 3-Day Trial)
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
          title: 'Explore',
          tabBarIcon: ({ color, size, focused }) => (
            <Compass color={color} size={size} weight={focused ? 'fill' : 'regular'} />
          ),
        }}
      />
      <Tabs.Screen
        name="player"
        options={{
          title: 'Player',
          tabBarIcon: ({ color, size, focused }) => (
            <PlayCircle color={color} size={size} weight={focused ? 'fill' : 'regular'} />
          ),
        }}
      />
      <Tabs.Screen
        name="flashcards"
        options={{
          title: 'Flashcards',
          tabBarIcon: ({ color, size, focused }) => (
            <Cards color={color} size={size} weight={focused ? 'fill' : 'regular'} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
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

### 3.1 Screen 1: Explore & Live YouTube Search (`(tabs)/index.tsx`)
- **Top Search Bar with Search Icon:**
  - Search input with `MagnifyingGlass` (`phosphor-react-native`: default `#94A3B8` `weight="regular"`, switches to `#38BDF8` `weight="fill"` when focused).
  - Placeholder: *"Search YouTube videos (e.g. MrBeast, TED, BBC)..."*.
  - Live query returns matching YouTube videos with 16:9 thumbnails, channel names, duration, and `[CC] EN` badges.
- **Default Dashboard (Empty Query):**
  - **"Continue Watching" Section:** Recent videos with progress indicators.
  - **"Recommended by CEFR Level" Section:** Curated videos categorized into A1–A2 (Daily Dialogues), B1–B2 (TED-Ed, Science), and C1–C2 (Interviews, Speeches).
- **Video Tap:** Navigates directly to `/(tabs)/player?videoId={id}`.

### 3.2 Screen 2: Video Player & Subtitles (`(tabs)/player.tsx`)
- YouTube video player embedded in 16:9 aspect ratio (`react-native-youtube-iframe`).
- Tooling strip under video:
  - "Repeat Sentence" button (`ArrowCounterClockwise`).
  - Smooth speed stepper: `0.25x` to `2.00x` in `0.05` steps (`MinusCircle`, `Gauge`, `PlusCircle`).
- Subtitle strip below: auto-scrolls to keep current spoken cue centered.
- Word tap: pauses playback immediately and slides up `TranslationSheet`.
- Action buttons: *"Save Word"* (`BookmarkSimple`) and *"Save Sentence"* (`NotePencil`).

### 3.3 Screen 3: Tinder-Style Flashcards Deck (`(tabs)/flashcards.tsx`)
- 3-card stack with `react-native-reanimated` (v3).
- 4-way gesture mapping:
  - ⬅️ Left: Again (Red)
  - ⬇️ Down: Hard (Orange)
  - ➡️ Right: Good (Green)
  - ⬆️ Up: Easy (Cyan)
- Tap flips the card in 3D (English front -> definition/translation & source context on back).
- Manual action buttons in bottom dock for users who prefer tapping over swiping.

### 3.4 Screen 4: Profile & Settings (`(tabs)/profile.tsx`)
- User avatar, email, and CEFR level pill.
- Learning statistics (3 columns): Words Learned, Day Streak (`Fire` icon), Study Time.
- Subscription status: Free tier quota display or active plan (Pro, Master).
- "Manage Subscription" (opens native App Store / Google Play subscription management).
- "Restore Purchases" button (calls `Purchases.restorePurchases()`).
- "Sign Out" and "Delete Account" buttons (with confirmation dialog).
