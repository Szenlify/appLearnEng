import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, FlatList, Pressable, Image, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { MagnifyingGlass, XCircle } from 'phosphor-react-native';
import { SearchVideoItem } from '@learneng/shared';
import { getApiBaseUrl } from '@/lib/api';
import { usePlayerStore } from '@/stores/usePlayerStore';

export interface CuratedVideo {
  id: string;
  title: string;
  channelTitle: string;
  cefrLevel: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  duration: string;
  thumbnailUrl: string;
  category: 'dialogue' | 'ted_ed' | 'podcast' | 'interview' | 'speech';
}

export const CURATED_VIDEOS: CuratedVideo[] = [
  {
    id: 'sewhbmh0ECg',
    title: 'What If We Could Look Inside Human Brains?',
    channelTitle: 'TED-Ed',
    cefrLevel: 'A2',
    duration: '3:56',
    thumbnailUrl: 'https://img.youtube.com/vi/sewhbmh0ECg/hqdefault.jpg',
    category: 'ted_ed',
  },
  {
    id: 'WuyPuH9ojCE',
    title: 'How Stress Affects Your Brain',
    channelTitle: 'TED-Ed',
    cefrLevel: 'B1',
    duration: '4:16',
    thumbnailUrl: 'https://img.youtube.com/vi/WuyPuH9ojCE/hqdefault.jpg',
    category: 'ted_ed',
  },
  {
    id: 'R0JKCYZ8hng',
    title: 'How Playing an Instrument Benefits Your Brain',
    channelTitle: 'TED-Ed',
    cefrLevel: 'B1',
    duration: '4:45',
    thumbnailUrl: 'https://img.youtube.com/vi/R0JKCYZ8hng/hqdefault.jpg',
    category: 'ted_ed',
  },
  {
    id: 'xyQY8a-ng6g',
    title: 'How the Food You Eat Affects Your Brain',
    channelTitle: 'TED-Ed',
    cefrLevel: 'B2',
    duration: '4:53',
    thumbnailUrl: 'https://img.youtube.com/vi/xyQY8a-ng6g/hqdefault.jpg',
    category: 'ted_ed',
  },
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

export default function ExploreScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Debounce search input (400ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, 400);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Live YouTube search query (TanStack Query)
  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ['youtube_search', debouncedQuery],
    queryFn: async () => {
      if (!debouncedQuery) return null;
      const res = await fetch(
        `${getApiBaseUrl()}/api/v1/search?q=${encodeURIComponent(debouncedQuery)}`
      );
      if (!res.ok) throw new Error('SEARCH_FAILED');
      return res.json();
    },
    enabled: debouncedQuery.length > 1,
  });

  const handleOpenVideo = (videoId: string) => {
    const store = usePlayerStore.getState();
    store.setVideoId(videoId);
    store.setCaptions([]);
    store.setIsPlaying(false);
    router.push({ pathname: '/(tabs)/player', params: { videoId } });
  };

  const isLupkaActive = isSearchFocused || searchQuery.length > 0;

  return (
    <View className="flex-1 bg-[#0B0F19] pt-12 px-4">
      {/* 1. Top YouTube-style search bar with MagnifyingGlass */}
      <View className="flex-row items-center bg-[#161F30] rounded-2xl px-3.5 py-2.5 mb-4 border border-slate-700/60 shadow-lg">
        <MagnifyingGlass
          size={20}
          color={isLupkaActive ? '#38BDF8' : '#94A3B8'}
          weight={isLupkaActive ? 'fill' : 'regular'}
        />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          onFocus={() => setIsSearchFocused(true)}
          onBlur={() => setIsSearchFocused(false)}
          placeholder="Search YouTube videos (e.g. MrBeast, TED)..."
          placeholderTextColor="#64748B"
          className="flex-1 text-white text-base py-1 ml-2.5 font-medium"
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => setSearchQuery('')} className="p-1">
            {({ pressed }) => (
              <XCircle
                size={20}
                color={pressed ? '#38BDF8' : '#94A3B8'}
                weight={pressed ? 'fill' : 'regular'}
              />
            )}
          </Pressable>
        )}
      </View>

      {/* 2. Live YouTube Search Results */}
      {debouncedQuery.length > 1 ? (
        isSearching ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#38BDF8" />
            <Text className="text-slate-400 mt-3 text-sm">Searching YouTube...</Text>
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
                  <Image
                    source={{ uri: item.thumbnailUrl }}
                    className="w-full h-full"
                    resizeMode="cover"
                  />
                  {item.duration && (
                    <View className="absolute bottom-2 right-2 bg-black/80 px-2 py-0.5 rounded">
                      <Text className="text-white text-xs font-mono font-semibold">
                        {item.duration}
                      </Text>
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
        /* 3. Default Dashboard: Curated CEFR Recommendations */
        <FlatList
          data={CURATED_VIDEOS}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            <Text className="text-xl font-bold text-white mb-3">Recommended by CEFR Level</Text>
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
