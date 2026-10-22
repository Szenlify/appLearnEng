# MOBILE_SCREENS_SPEC.md — Complete Mobile Screens & View Logic Specification

Dokument zawiera kompletną, produkcyjną specyfikację widoków, komponentów, hooków i zachowań dla wszystkich ekranów aplikacji mobilnej **LearnEng** w architekturze **Expo Router (v3+)**.

---

## 1. 🔍 Ekran 1: Odkrywaj & Wyszukiwarka YouTube (`apps/mobile/app/(tabs)/index.tsx`)

Ekran startowy i wyszukiwarka wideo w stylu natywnej aplikacji YouTube. Użytkownik może wpisać dowolną frazę (np. *„MrBeast”*, *„BBC News”*, *„Cooking”*), aby przeszukać cały katalog YouTube w czasie rzeczywistym, lub przeglądać polecane materiały edukacyjne i historię oglądania.

### 1.1 Doświadczenie Wyszukiwania w Stylu YouTube (Live Search):
1. **Pasek Wyszukiwania:**
   - Pole tekstowe z ikoną `Search`, przyciskiem czyszczenia tekstu `X` oraz przyciskiem wklejania ze schowka.
   - Gdy użytkownik wpisuje frazę (lub zatwierdza Enterem):
     - Zapytanie `useQuery` wywołuje `GET /api/v1/search?q=${encodeURIComponent(query)}`.
     - Wyniki wyświetlane są jako pionowa lista kafelków 16:9 (dokładnie jak w aplikacji YouTube).
     - Każdy kafelek zawiera: miniaturkę wideo, czas trwania w prawym dolnym rogu (np. `14:20`), badge `[CC] EN`, tytuł filmu oraz nazwę kanału.
     - Kliknięcie kafelka: `router.push({ pathname: '/(tabs)/player', params: { videoId: item.id } })`.
2. **Gdy pole wyszukiwania jest puste (Domyślny Dashboard):**
   - **Sekcja "Oglądaj dalej":** Kafelki ostatnio oglądanych filmów z paskiem postępu i liczbą zapisanych słówek (z lokalnego SQLite / TanStack Query).
   - **Sekcja "Polecane wg poziomów CEFR":** Pogrupowane kafelki ze stałej `CURATED_VIDEOS` (A1–C2).
3. **Auto-Clipboard Detection:**
   - Jeśli użytkownik skopiował link YouTube poza aplikacją, po otwarciu ekranu pojawia się chmurka: *„Wykryto link YouTube w schowku. Kliknij, aby obejrzeć”*.

### 1.2 Kod Ekranu Wyszukiwarki i Odkrywania:
```typescript
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, FlatList, Pressable, Image, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { Search, X, Clipboard as ClipIcon, Play } from 'lucide-react-native';
import { extractYouTubeVideoId } from '@/lib/youtube';
import { SearchVideoItem } from '@learneng/shared';

export default function ExploreScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // Debouncing wpisywania frazy (400ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, 400);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Zapytanie wyszukiwania YouTube (TanStack Query)
  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ['youtube_search', debouncedQuery],
    queryFn: async () => {
      if (!debouncedQuery) return null;
      // Jeśli użytkownik wkleił bezpośredni link URL -> wyciągnij ID i otwórz
      const directId = extractYouTubeVideoId(debouncedQuery);
      if (directId) {
        return { items: [{ id: directId, title: 'Wklejone wideo', channelTitle: '', thumbnailUrl: `https://img.youtube.com/vi/${directId}/hqdefault.jpg` }] };
      }
      const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/v1/search?q=${encodeURIComponent(debouncedQuery)}`);
      if (!res.ok) throw new Error('SEARCH_FAILED');
      return res.json();
    },
    enabled: debouncedQuery.length > 1,
  });

  const handleOpenVideo = (videoId: string) => {
    router.push({ pathname: '/(tabs)/player', params: { videoId } });
  };

  return (
    <View className="flex-1 bg-[#0B0F19] pt-12 px-4">
      {/* 1. Górny pasek wyszukiwania a'la YouTube */}
      <View className="flex-row items-center bg-[#161F30] rounded-2xl px-3 py-2.5 mb-4 border border-slate-700/60 shadow-lg">
        <Search size={20} color="#94A3B8" className="mr-2" />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Szukaj filmów na YouTube (np. MrBeast, TED)..."
          placeholderTextColor="#64748B"
          className="flex-1 text-white text-base py-1 font-medium"
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => setSearchQuery('')} className="p-1">
            <X size={18} color="#94A3B8" />
          </Pressable>
        )}
      </View>

      {/* 2. Wyniki Wyszukiwania na Żywo */}
      {debouncedQuery.length > 1 ? (
        isSearching ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#38BDF8" />
            <Text className="text-slate-400 mt-3 text-sm">Wyszukiwanie w YouTube...</Text>
          </View>
        ) : (
          <FlatList
            data={searchResults?.items || []}
            keyExtractor={(item) => item.id}
            renderItem={({ item }: { item: SearchVideoItem }) => (
              <Pressable
                onPress={() => handleOpenVideo(item.id)}
                className="mb-4 bg-[#161F30]/80 rounded-2xl overflow-hidden border border-slate-800 active:opacity-80"
              >
                <View className="relative w-full aspect-video bg-slate-900">
                  <Image source={{ uri: item.thumbnailUrl }} className="w-full h-full" resizeMode="cover" />
                  {item.duration && (
                    <View className="absolute bottom-2 right-2 bg-black/80 px-2 py-0.5 rounded">
                      <Text className="text-white text-xs font-mono font-semibold">{item.duration}</Text>
                    </View>
                  )}
                  <View className="absolute top-2 left-2 bg-sky-600/90 px-2 py-0.5 rounded-md">
                    <Text className="text-white text-[10px] font-bold">CC EN</Text>
                  </View>
                </View>
                <View className="p-3">
                  <Text className="text-white font-bold text-base line-clamp-2">{item.title}</Text>
                  <Text className="text-slate-400 text-xs mt-1">{item.channelTitle}</Text>
                </View>
              </Pressable>
            )}
          />
        )
      ) : (
        /* 3. Domyślny Dashboard: Kategorie CEFR & Oglądaj Dalej */
        <FlatList
          data={CURATED_VIDEOS}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            <Text className="text-xl font-bold text-white mb-3">Polecane do Nauki (CEFR)</Text>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => handleOpenVideo(item.id)}
              className="flex-row items-center mb-3 p-3 bg-[#161F30]/60 rounded-2xl border border-slate-800"
            >
              <Image source={{ uri: item.thumbnailUrl }} className="w-24 h-16 rounded-xl mr-3" />
              <View className="flex-1">
                <Text className="text-white font-bold text-sm line-clamp-1">{item.title}</Text>
                <Text className="text-slate-400 text-xs mt-0.5">{item.channelTitle}</Text>
                <View className="flex-row items-center mt-1">
                  <Text className="text-sky-400 text-xs font-bold mr-2">{item.cefrLevel}</Text>
                  <Text className="text-slate-500 text-xs">{item.duration}</Text>
                </View>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}
```

### 1.3 Dane Startowe / Mocki Dydaktyczne (Seed Videos):
Aby aplikacja działała natychmiast w trybie deweloperskim bez pobierania zewnętrznych list z API, ekran korzysta ze stałej `CURATED_VIDEOS`:

```typescript
export interface CuratedVideo {
  id: string;                 // YouTube Video ID (11 znaków)
  title: string;
  channelTitle: string;
  cefrLevel: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  duration: string;           // np. "4:15"
  thumbnailUrl: string;
  category: 'dialogue' | 'ted_ed' | 'podcast' | 'interview' | 'speech';
}

export const CURATED_VIDEOS: CuratedVideo[] = [
  // A1-A2: Proste dialogi i bajki
  {
    id: 'kJQP7kiw5Fk',
    title: 'Describing People & Daily Routines',
    channelTitle: 'Easy English Stories',
    cefrLevel: 'A1',
    duration: '3:45',
    thumbnailUrl: 'https://img.youtube.com/vi/kJQP7kiw5Fk/hqdefault.jpg',
    category: 'dialogue',
  },
  {
    id: 'b14x_42lX4Y',
    title: 'Ordering Food in a Restaurant',
    channelTitle: 'Everyday Dialogues',
    cefrLevel: 'A2',
    duration: '5:10',
    thumbnailUrl: 'https://img.youtube.com/vi/b14x_42lX4Y/hqdefault.jpg',
    category: 'dialogue',
  },
  // B1-B2: TED-Ed i popularnonaukowe
  {
    id: 'Y2b0jHnE0a8',
    title: 'How Memories Are Formed in the Brain',
    channelTitle: 'TED-Ed English',
    cefrLevel: 'B1',
    duration: '5:02',
    thumbnailUrl: 'https://img.youtube.com/vi/Y2b0jHnE0a8/hqdefault.jpg',
    category: 'ted_ed',
  },
  {
    id: 'wJZjL0ZfOaM',
    title: 'The Surprising Science of Motivation',
    channelTitle: 'Big Think Science',
    cefrLevel: 'B2',
    duration: '6:30',
    thumbnailUrl: 'https://img.youtube.com/vi/wJZjL0ZfOaM/hqdefault.jpg',
    category: 'podcast',
  },
  // C1-C2: Wywiady i debaty
  {
    id: 'UF8uR6Z6KLc',
    title: 'Steve Jobs 2005 Stanford Commencement Speech',
    channelTitle: 'Stanford University',
    cefrLevel: 'C1',
    duration: '15:04',
    thumbnailUrl: 'https://img.youtube.com/vi/UF8uR6Z6KLc/hqdefault.jpg',
    category: 'speech',
  },
];
```

---

## 2. 🎬 Ekran 2: Odtwarzacz & Napisy (`apps/mobile/app/(tabs)/player.tsx`)

Sercowy ekran aplikacji łączący odtwarzacz YouTube (`react-native-youtube-iframe`), synchronizację czasu, przewijany pasek napisów (`SubtitleTrack`) i arkusz tłumaczenia (`TranslationSheet`).

### 2.1 Kluczowy Hook Synchronizacji Czasu (Eliminacja Pułapki YouTube):
`react-native-youtube-iframe` **nie posiada** propa `onTimeUpdate` ani `onProgress`. Synchronizację realizuje pętla interwałowa odpytująca `getCurrentTime()`:

```typescript
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import YoutubePlayer, { YoutubeIframeRef } from 'react-native-youtube-iframe';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { SubtitleTrack } from '@/components/player/SubtitleTrack';
import { TranslationSheet } from '@/components/sheets/TranslationSheet';
import { QUERY_KEYS } from '@/stores/usePlayerStore';

export default function PlayerScreen() {
  const { videoId: paramVideoId } = useLocalSearchParams<{ videoId?: string }>();
  const playerRef = useRef<YoutubeIframeRef>(null);
  
  const videoId = paramVideoId || 'UF8uR6Z6KLc'; // Fallback do Steve Jobs Stanford Speech
  
  const {
    isPlaying,
    currentTime,
    cues,
    selectedWord,
    selectedSentence,
    isSheetOpen,
    setIsPlaying,
    setCurrentTime,
    setCaptions,
    openTranslation,
    closeTranslation,
  } = usePlayerStore();

  const [playbackRate, setPlaybackRate] = useState<number>(1.0);

  // 1. Pętla synchronizacji czasu z YouTube IFrame
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isPlaying) {
      interval = setInterval(async () => {
        try {
          const time = await playerRef.current?.getCurrentTime();
          if (typeof time === 'number') {
            setCurrentTime(time);
          }
        } catch {
          // Iframe może być w trakcie buforowania
        }
      }, 150); // 150ms: idealna płynność bez obciążenia wątku JS
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, setCurrentTime]);

  // 2. Pobieranie transkrypcji (TanStack Query)
  const { data: captionsData, isLoading, error } = useQuery({
    queryKey: QUERY_KEYS.captions(videoId),
    queryFn: async () => {
      const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/v1/captions?videoId=${videoId}&lang=en`);
      if (!res.ok) {
        if (res.status === 422) throw new Error('NO_CAPTIONS_AVAILABLE');
        throw new Error('FAILED_TO_LOAD_CAPTIONS');
      }
      return res.json();
    },
  });

  useEffect(() => {
    if (captionsData?.cues) {
      setCaptions(captionsData.cues);
    }
  }, [captionsData, setCaptions]);

  // 3. Obsługa pauzowania i wznawiania
  const handleWordPress = useCallback((word: string, contextSentence: string) => {
    setIsPlaying(false);
    openTranslation(word, contextSentence);
  }, [setIsPlaying, openTranslation]);

  const handleCloseSheet = useCallback(() => {
    closeTranslation();
    setIsPlaying(true); // Auto-wznowienie odtwarzania
  }, [closeTranslation, setIsPlaying]);

  // 4. Skok do początku bieżącego zdania (Powtórz zdanie)
  const handleRepeatSentence = useCallback(async () => {
    const activeCue = cues.find(c => currentTime >= c.start && currentTime <= c.end);
    if (activeCue && playerRef.current) {
      await playerRef.current.seekTo(activeCue.start, true);
      setCurrentTime(activeCue.start);
    }
  }, [cues, currentTime, setCurrentTime]);

  // Obsługa zmiany prędkości
  const cyclePlaybackRate = useCallback(async () => {
    const rates = [0.75, 1.0, 1.25];
    const nextRate = rates[(rates.indexOf(playbackRate) + 1) % rates.length];
    setPlaybackRate(nextRate);
    await playerRef.current?.setPlaybackRate(nextRate);
  }, [playbackRate]);

  return (
    <View className="flex-1 bg-[#0B0F19]">
      {/* 1. Odtwarzacz YouTube w formacie 16:9 */}
      <View className="w-full aspect-video bg-black">
        <YoutubePlayer
          ref={playerRef}
          height="100%"
          videoId={videoId}
          play={isPlaying}
          playbackRate={playbackRate}
          onChangeState={(state) => {
            if (state === 'playing') setIsPlaying(true);
            if (state === 'paused' || state === 'ended') setIsPlaying(false);
          }}
          initialPlayerParams={{
            preventFullScreen: false,
            controls: true,
            modestbranding: true,
            rel: false,
          }}
        />
      </View>

      {/* 2. Pasek pomocniczy pod wideo: Prędkość & Powtórz zdanie */}
      <View className="flex-row items-center justify-between px-4 py-2 border-b border-slate-800 bg-[#161F30]/60">
        <Pressable
          onPress={handleRepeatSentence}
          className="flex-row items-center px-3 py-1.5 rounded-lg bg-slate-800 active:bg-slate-700"
        >
          <Text className="text-sky-400 font-semibold text-xs">⏪ Powtórz zdanie</Text>
        </Pressable>

        <Pressable
          onPress={cyclePlaybackRate}
          className="px-3 py-1.5 rounded-lg bg-slate-800 active:bg-slate-700"
        >
          <Text className="text-slate-200 font-bold text-xs">{playbackRate}x</Text>
        </Pressable>
      </View>

      {/* 3. Pasek napisów lub baner błędu */}
      <View className="flex-1">
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#38BDF8" />
            <Text className="text-slate-400 mt-2 text-sm">Ładowanie synchronizowanych napisów...</Text>
          </View>
        ) : error?.message === 'NO_CAPTIONS_AVAILABLE' ? (
          <View className="p-6 m-4 rounded-2xl bg-amber-950/40 border border-amber-600/30 items-center">
            <Text className="text-amber-400 font-bold text-base mb-1">Ten film nie posiada angielskich napisów</Text>
            <Text className="text-slate-400 text-xs text-center mb-4">
              Wybierz jeden z polecanych materiałów do nauki z poziomu zakładki Odkrywaj.
            </Text>
          </View>
        ) : (
          <SubtitleTrack
            cues={cues}
            activeCueIndex={cues.findIndex(c => currentTime >= c.start && currentTime <= c.end)}
            currentTime={currentTime}
            onWordPress={handleWordPress}
          />
        )}
      </View>

      {/* 4. Bottom Sheet z tłumaczeniem */}
      <TranslationSheet
        isOpen={isSheetOpen}
        word={selectedWord}
        sentence={selectedSentence}
        onClose={handleCloseSheet}
        onSaveWord={async (data) => {
          // Zapis słowa do lokalnego SQLite (0ms) + kolejka zbiorczego syncu do Supabase
          await LocalFlashcardsRepository.insertCard({
            id: `${data.video_id}_${Date.now()}`,
            user_id: currentUserId,
            ...data,
            type: 'word',
            repetitions: 0,
            interval_days: 1,
            ease_factor: 2.5,
            next_review_at: new Date().toISOString(),
          });
          FlashcardSyncEngine.scheduleSync(currentUserId);
        }}
        onSaveSentence={async (data) => {
          // Zapis całego zdania do lokalnego SQLite (0ms) + kolejka zbiorczego syncu do Supabase
          await LocalFlashcardsRepository.insertCard({
            id: `${data.video_id}_sent_${Date.now()}`,
            user_id: currentUserId,
            ...data,
            type: 'sentence',
            repetitions: 0,
            interval_days: 1,
            ease_factor: 2.5,
            next_review_at: new Date().toISOString(),
          });
          FlashcardSyncEngine.scheduleSync(currentUserId);
        }}
      />
    </View>
  );
}
```

---

## 3. 🃏 Ekran 3: Fiszki Tinder-Deck (`apps/mobile/app/(tabs)/flashcards.tsx`)

Ekran powtórek fiszek ze stosem kart w 4 kierunkach gestu, obrotem 3D oraz obsługą pustego stanu.

### 3.1 Pasek Stanu & Kontrolki Dokujące:
- **Góra ekranu:**
  - Płomień streaku: `🔥 7 dni z rzędu`.
  - Licznik postępu: `Karta 4 z 18`.
  - Pasek postępu (Progress Bar) z animowanym kolorem indygo.
- **Środek:**
  - Kontener stosu kart `TinderCard` (wyświetla Karta 0, Karta 1 pod spodem i Karta 2).
- **Dół ekranu (Manual Dock Buttons):**
  - Dla użytkowników, którzy wolą klikać zamiast swipować:
    - 🔴 `[ Powtórz ]` (Left)
    - 🟠 `[ Trudne ]` (Down)
    - 🟢 `[ Dobrze ]` (Right)
    - 🔵 `[ Łatwe ]` (Up)
    - ↩️ `[ Cofnij ]` (`undoLastSwipe()`)

### 3.2 Ekran Ukończenia Sesji (Completed / Empty State):
Gdy `currentIndex >= deck.length` lub gdy nie ma fiszek do powtórki:
```tsx
<View className="flex-1 items-center justify-center px-8 bg-[#0B0F19]">
  <View className="w-24 h-24 rounded-full bg-emerald-500/10 items-center justify-center mb-6 border border-emerald-500/30">
    <Text className="text-5xl">🎉</Text>
  </View>
  <Text className="text-2xl font-bold text-white text-center mb-2">
    Wszystkie powtórki ukończone!
  </Text>
  <Text className="text-slate-400 text-sm text-center mb-8 leading-relaxed">
    Świetna robota. Twoja pamięć długotrwała utrwaliła te słówka. Obejrzyj kolejny film, aby dodać nowe zwroty do talii.
  </Text>
  <Pressable
    onPress={() => router.push('/(tabs)')}
    className="w-full py-4 rounded-xl bg-indigo-600 active:bg-indigo-700 items-center shadow-lg shadow-indigo-600/30"
  >
    <Text className="text-white font-bold text-base">Odkrywaj Nowe Filmy</Text>
  </Pressable>
</View>
```

---

## 4. 👤 Ekran 4: Profil i Ustawienia (`apps/mobile/app/(tabs)/profile.tsx`)

Zarządzanie kontem, poziomem CEFR, językiem ojczystym i subskrypcją Stripe.

### 4.1 Struktura Sekcji:
1. **Nagłówek Użytkownika:**
   - Awatar (inicjały lub zdjęcie Google/Apple).
   - Email użytkownika.
   - Pigułka poziomu: `B2 Intermediate`.
2. **Kafle Statystyk Nauki (3 Kolumny):**
   - 📖 **142** poznanych słówek.
   - 🔥 **7 dni** ciągłego streaku.
   - ⏱️ **4.2h** spędzonych na nauce.
3. **Karta Statusu Subskrypcji:**
   - Jeśli plan darmowy:
     - Wyświetla: *„Plan: Free (Zostało 15/50 darmowych zapytań)”*.
     - Przycisk CTA: *„Wypróbuj Pro przez 3 dni za darmo”* -> otwiera `/(modals)/paywall`.
   - Jeśli plan Starter / Pro / Master:
     - Wyświetla: *„Plan: Pro (Odnawia się 15.11.2026)”*.
     - Przycisk: *„Zarządzaj subskrypcją”* -> wywołuje Stripe Customer Portal.
4. **Preferencje i Ustawienia:**
   - Wybór języka ojczystego (Modal: Polski, Español, Deutsch, Français, Italiano, 日本語).
   - Domyślny akcent wymowy (`en-US` / `en-GB`).
   - Włącznik (Switch): *„Auto-wznawiaj wideo po zamknięciu tłumaczenia”*.
   - Przycisk *„Wyloguj się”* (`supabase.auth.signOut()`).

---

## 5. 💎 Ekran 5: Modal Paywalla (`apps/mobile/app/(modals)/paywall.tsx`)

Prezentowany jako modal wznoszący (`presentation: 'modal'`).

### 5.1 Elementy Widoku:
1. **Nagłówek Hero:**
   - Tytuł: *„Ucz się angielskiego z YouTube bez żadnych limitów”*.
   - Wyróżnik: *„3 DNI ZA DARMO — Anuluj w dowolnym momencie w 1 kliknięcie”*.
2. **Karty Wyboru 3 Planów:**
   - **Starter ($4.99 / 19.99 PLN):** Podstawowy dostęp, 200 zapytań AI/miesiąc.
   - **Pro ($8.99 / 39.99 PLN) [BESTSELLER]:** Nieograniczone zapytania AI, wyjaśnianie slangu i idiomów, pełny tryb offline fiszek.
   - **Master ($16.99 / 69.99 PLN):** Wszystko z Pro + nielimitowane eksporty do Anki, priorytetowe serwery Gemini.
3. **Wykrywanie Lokalizacji i Waluty:**
   - W Polsce: Wyświetla kwoty w PLN z widoczną ikoną **BLIK**.
   - W Strefie Euro: Kwoty w EUR z SEPA / Apple Pay.
   - Domyślnie na świecie: Kwoty w USD.
4. **Przycisk CTA:**
   - *„Rozpocznij 3-dniowy darmowy okres próbny”*.
   - Podpięty pod wywołanie Stripe PaymentSheet lub Stripe Checkout Session.

---

## 6. 🔐 Ekran 6: Logowanie Społecznościowe (`apps/mobile/app/(auth)/login.tsx`)

Aplikacja całkowicie eliminuje tradycyjne logowanie hasłem/e-mailem. Dostępne są wyłącznie natywne, bezpieczne przyciski **Sign in with Apple** i **Sign in with Google**.

### 6.1 Implementacja Ekranu Logowania:
```typescript
import React from 'react';
import { View, Text, Pressable, Image, Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import { signInWithApple } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const handleAppleLogin = async () => {
    try {
      await signInWithApple();
    } catch (err) {
      console.warn('Apple Sign In failed:', err);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const redirectTo = 'learneng://auth/callback';
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });
      if (error) throw error;
      if (data?.url) {
        const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
        if (res.type === 'success' && res.url) {
          const params = new URLSearchParams(res.url.split('#')[1] || res.url.split('?')[1]);
          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');
          if (accessToken && refreshToken) {
            await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          }
        }
      }
    } catch (err) {
      console.warn('Google Sign In failed:', err);
    }
  };

  return (
    <View className="flex-1 bg-[#0B0F19] justify-between py-16 px-6">
      {/* 1. Hero & Branding */}
      <View className="items-center mt-12">
        <View className="w-20 h-20 rounded-3xl bg-indigo-600/20 border border-indigo-500/40 items-center justify-center mb-6">
          <Text className="text-4xl">🎬</Text>
        </View>
        <Text className="text-3xl font-extrabold text-white text-center tracking-tight mb-2">
          LearnEng
        </Text>
        <Text className="text-slate-400 text-center text-sm px-6 leading-relaxed">
          Ucz się angielskiego z autentycznych filmów na YouTube z natychmiastowym tłumaczeniem AI i fiszkami SRS.
        </Text>
      </View>

      {/* 2. Dwa Przyciski Social Sign-In: Apple & Google */}
      <View className="w-full space-y-3">
        {Platform.OS === 'ios' && (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
            cornerRadius={16}
            style={{ width: '100%', height: 52 }}
            onPress={handleAppleLogin}
          />
        )}

        <Pressable
          onPress={handleGoogleLogin}
          className="w-full h-[52px] bg-white rounded-2xl flex-row items-center justify-center space-x-3 active:opacity-90 shadow-lg mt-3"
        >
          <Text className="text-slate-900 font-semibold text-base">Kontynuuj z Google</Text>
        </Pressable>

        <Text className="text-slate-500 text-[11px] text-center mt-4 px-4 leading-normal">
          Logowanie jednym kliknięciem. Zero haseł. Kontynuując, akceptujesz nasz Regulamin i Politykę Prywatności.
        </Text>
      </View>
    </View>
  );
}
```

