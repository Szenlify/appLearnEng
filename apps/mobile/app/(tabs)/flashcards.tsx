import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUUpLeft,
  ArrowUp,
  Fire,
  Trophy,
} from 'phosphor-react-native';
import {
  calculateNextReviewFromSwipe,
  type Flashcard,
  type SwipeDirection,
} from '@learneng/shared';
import { TinderCard } from '@/components/flashcards/TinderCard';
import { FlashcardSyncEngine } from '@/lib/db/FlashcardSyncEngine';
import { LocalFlashcardsRepository } from '@/lib/db/LocalFlashcardsRepository';
import { supabase } from '@/lib/supabase';
import { useFlashcardsStore } from '@/stores/useFlashcardsStore';

export default function FlashcardsScreen() {
  const router = useRouter();
  const { deck, currentIndex, setDeck, recordSwipe, undoLastSwipe } = useFlashcardsStore();
  const [userId, setUserId] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [streakDays] = useState<number>(7);

  useEffect(() => {
    let mounted = true;
    async function loadDueDeck() {
      setIsLoading(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        const uid = user?.id || 'local-user';
        if (mounted) setUserId(uid);

        const rows = await LocalFlashcardsRepository.getDueCards(uid, 50);
        if (mounted) {
          setDeck(rows as unknown as Flashcard[]);
        }
      } catch (err) {
        console.warn('Failed to load due flashcards:', err);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    loadDueDeck();
    return () => {
      mounted = false;
    };
  }, [setDeck]);

  const handleCardSwipe = useCallback(
    async (direction: SwipeDirection) => {
      const currentCard = deck[currentIndex];
      if (!currentCard) return;

      const srsResult = calculateNextReviewFromSwipe(
        {
          repetitions: currentCard.repetitions,
          intervalDays: currentCard.interval_days,
          easeFactor: currentCard.ease_factor,
        },
        direction
      );

      // 1. Immediate 0ms UI update in Zustand store
      recordSwipe(direction);

      // 2. Persist updated SRS state to local SQLite and schedule debounced 5s batch sync
      try {
        await LocalFlashcardsRepository.recordSwipeSRS(currentCard.id, srsResult);
        if (userId) {
          FlashcardSyncEngine.scheduleSync(userId);
        }
      } catch (err) {
        console.warn('Failed to persist SRS update locally:', err);
      }
    },
    [deck, currentIndex, recordSwipe, userId]
  );

  if (isLoading) {
    return (
      <View className="flex-1 bg-[#0B0F19] items-center justify-center">
        <ActivityIndicator size="large" color="#38BDF8" />
        <Text className="text-slate-400 text-sm mt-3">Loading your review deck...</Text>
      </View>
    );
  }

  // Completed / Empty State
  if (deck.length === 0 || currentIndex >= deck.length) {
    return (
      <View className="flex-1 items-center justify-center px-8 bg-[#0B0F19]">
        <View className="w-24 h-24 rounded-full bg-emerald-500/10 items-center justify-center mb-6 border border-emerald-500/30">
          <Trophy size={48} color="#10B981" weight="fill" />
        </View>
        <Text className="text-2xl font-bold text-white text-center mb-2">
          All reviews completed!
        </Text>
        <Text className="text-slate-400 text-sm text-center mb-8 leading-relaxed">
          Great job. Your long-term memory has retained these words. Watch another video to add new phrases to your deck.
        </Text>
        <Pressable
          onPress={() => router.push('/(tabs)')}
          className="w-full py-4 rounded-xl bg-indigo-600 active:bg-indigo-700 items-center shadow-lg shadow-indigo-600/30"
        >
          <Text className="text-white font-bold text-base">Explore New Videos</Text>
        </Pressable>
      </View>
    );
  }

  const visibleCards = deck.slice(currentIndex, currentIndex + 3);
  const progressPercent = Math.min(100, Math.round(((currentIndex + 1) / deck.length) * 100));

  return (
    <View className="flex-1 bg-[#0B0F19] pt-14 px-5 pb-24 justify-between">
      {/* 1. Top Status Bar & Progress */}
      <View>
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center bg-[#161F30] px-3 py-1.5 rounded-full border border-slate-800">
            <Fire size={18} color="#F59E0B" weight="fill" />
            <Text className="text-amber-400 font-bold text-xs ml-1.5">
              {streakDays} day streak
            </Text>
          </View>

          <Text className="text-slate-300 font-semibold text-xs">
            Card {currentIndex + 1} of {deck.length}
          </Text>
        </View>

        <View className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
          <View
            style={{ width: `${progressPercent}%` }}
            className="h-full bg-indigo-500 rounded-full"
          />
        </View>
      </View>

      {/* 2. 3-Card Tinder Stack */}
      <View className="flex-1 items-center justify-center my-4">
        <View className="w-full h-[420px] items-center justify-center">
          {visibleCards
            .map((card, idx) => (
              <TinderCard
                key={`${card.id}_${currentIndex + idx}`}
                card={card}
                isTopCard={idx === 0}
                stackIndex={idx}
                onSwipe={handleCardSwipe}
              />
            ))
            .reverse()}
        </View>
      </View>

      {/* 3. Manual Dock Buttons */}
      <View className="flex-row items-center justify-between space-x-2">
        <Pressable
          onPress={() => handleCardSwipe('left')}
          className="flex-1 py-3 rounded-2xl bg-[#161F30] border border-slate-800 items-center"
        >
          {({ pressed }) => (
            <>
              <ArrowLeft
                size={20}
                color={pressed ? '#EF4444' : '#94A3B8'}
                weight={pressed ? 'fill' : 'regular'}
              />
              <Text className="text-rose-400 text-[11px] font-bold mt-1">Again</Text>
            </>
          )}
        </Pressable>

        <Pressable
          onPress={() => handleCardSwipe('down')}
          className="flex-1 py-3 rounded-2xl bg-[#161F30] border border-slate-800 items-center"
        >
          {({ pressed }) => (
            <>
              <ArrowDown
                size={20}
                color={pressed ? '#F59E0B' : '#94A3B8'}
                weight={pressed ? 'fill' : 'regular'}
              />
              <Text className="text-amber-400 text-[11px] font-bold mt-1">Hard</Text>
            </>
          )}
        </Pressable>

        <Pressable
          onPress={() => handleCardSwipe('right')}
          className="flex-1 py-3 rounded-2xl bg-[#161F30] border border-slate-800 items-center"
        >
          {({ pressed }) => (
            <>
              <ArrowRight
                size={20}
                color={pressed ? '#10B981' : '#94A3B8'}
                weight={pressed ? 'fill' : 'regular'}
              />
              <Text className="text-emerald-400 text-[11px] font-bold mt-1">Good</Text>
            </>
          )}
        </Pressable>

        <Pressable
          onPress={() => handleCardSwipe('up')}
          className="flex-1 py-3 rounded-2xl bg-[#161F30] border border-slate-800 items-center"
        >
          {({ pressed }) => (
            <>
              <ArrowUp
                size={20}
                color={pressed ? '#38BDF8' : '#94A3B8'}
                weight={pressed ? 'fill' : 'regular'}
              />
              <Text className="text-sky-400 text-[11px] font-bold mt-1">Easy</Text>
            </>
          )}
        </Pressable>

        <Pressable
          onPress={undoLastSwipe}
          disabled={currentIndex <= 0}
          className="px-3.5 py-3 rounded-2xl bg-[#161F30] border border-slate-800 items-center opacity-90"
        >
          {({ pressed }) => (
            <>
              <ArrowUUpLeft
                size={20}
                color={pressed ? '#38BDF8' : '#94A3B8'}
                weight={pressed ? 'fill' : 'regular'}
              />
              <Text className="text-slate-400 text-[11px] font-semibold mt-1">Undo</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}
