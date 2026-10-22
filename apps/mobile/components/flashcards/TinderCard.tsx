import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { SpeakerHigh } from 'phosphor-react-native';
import type { Flashcard, SwipeDirection } from '@learneng/shared';
import { playPronunciation } from '@/lib/speech';

export interface TinderCardProps {
  card: Flashcard;
  isTopCard: boolean;
  stackIndex?: number;
  onSwipe: (direction: SwipeDirection) => void;
}

const SWIPE_THRESHOLD = 100;

export function TinderCard({ card, isTopCard, stackIndex = 0, onSwipe }: TinderCardProps) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const rotateY = useSharedValue(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [activeSwipePreview, setActiveSwipePreview] = useState<SwipeDirection | null>(null);

  const triggerSwipeSuccess = (direction: SwipeDirection) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setActiveSwipePreview(null);
    onSwipe(direction);
  };

  const triggerFlipHaptic = (nextFlipped: boolean) => {
    Haptics.selectionAsync().catch(() => {});
    setIsFlipped(nextFlipped);
  };

  const updatePreview = (dir: SwipeDirection | null) => {
    setActiveSwipePreview(dir);
  };

  const panGesture = Gesture.Pan()
    .enabled(isTopCard)
    .minDistance(12)
    .onUpdate((event) => {
      translateX.value = event.translationX;
      translateY.value = event.translationY;

      const absX = Math.abs(event.translationX);
      const absY = Math.abs(event.translationY);

      if (absX < 40 && absY < 40) {
        runOnJS(updatePreview)(null);
      } else if (absX > absY) {
        runOnJS(updatePreview)(event.translationX < 0 ? 'left' : 'right');
      } else {
        runOnJS(updatePreview)(event.translationY < 0 ? 'up' : 'down');
      }
    })
    .onEnd((event) => {
      const absX = Math.abs(event.translationX);
      const absY = Math.abs(event.translationY);

      if (absX > absY && absX > SWIPE_THRESHOLD) {
        const direction: SwipeDirection = event.translationX < 0 ? 'left' : 'right';
        translateX.value = withTiming(event.translationX < 0 ? -500 : 500, { duration: 220 }, () => {
          runOnJS(triggerSwipeSuccess)(direction);
        });
        return;
      }

      if (absY >= absX && absY > SWIPE_THRESHOLD) {
        const direction: SwipeDirection = event.translationY < 0 ? 'up' : 'down';
        translateY.value = withTiming(event.translationY < 0 ? -600 : 600, { duration: 220 }, () => {
          runOnJS(triggerSwipeSuccess)(direction);
        });
        return;
      }

      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
      runOnJS(updatePreview)(null);
    });

  const handleFlipCard = () => {
    if (!isTopCard) return;
    const next = rotateY.value < 90 ? 180 : 0;
    rotateY.value = withTiming(next, { duration: 300 });
    triggerFlipHaptic(next === 180);
  };

  const cardContainerStyle = useAnimatedStyle(() => {
    const stackScale = stackIndex === 0 ? 1 : stackIndex === 1 ? 0.95 : 0.9;
    const stackOffsetY = stackIndex === 0 ? 0 : stackIndex === 1 ? 14 : 28;
    const rotationDeg = translateX.value * 0.08;

    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value + stackOffsetY },
        { scale: stackScale },
        { rotate: `${rotationDeg}deg` },
      ],
    };
  });

  const frontAnimatedStyle = useAnimatedStyle(() => {
    const deg = interpolate(rotateY.value, [0, 180], [0, 180]);
    return {
      transform: [{ perspective: 1000 }, { rotateY: `${deg}deg` }],
      backfaceVisibility: 'hidden',
      opacity: rotateY.value < 90 ? 1 : 0,
      zIndex: rotateY.value < 90 ? 2 : 1,
    };
  });

  const backAnimatedStyle = useAnimatedStyle(() => {
    const deg = interpolate(rotateY.value, [0, 180], [180, 360]);
    return {
      transform: [{ perspective: 1000 }, { rotateY: `${deg}deg` }],
      backfaceVisibility: 'hidden',
      opacity: rotateY.value >= 90 ? 1 : 0,
      zIndex: rotateY.value >= 90 ? 2 : 1,
    };
  });

  let borderColor = '#334155';
  let badgeText = '';
  let badgeColor = '#94A3B8';
  let badgeBg = 'rgba(51, 65, 85, 0.3)';

  if (activeSwipePreview === 'left') {
    borderColor = '#EF4444';
    badgeText = 'AGAIN';
    badgeColor = '#F87171';
    badgeBg = 'rgba(239, 68, 68, 0.2)';
  } else if (activeSwipePreview === 'down') {
    borderColor = '#F59E0B';
    badgeText = 'HARD';
    badgeColor = '#FBBF24';
    badgeBg = 'rgba(245, 158, 11, 0.2)';
  } else if (activeSwipePreview === 'right') {
    borderColor = '#10B981';
    badgeText = 'GOOD';
    badgeColor = '#34D399';
    badgeBg = 'rgba(16, 185, 129, 0.2)';
  } else if (activeSwipePreview === 'up') {
    borderColor = '#38BDF8';
    badgeText = 'EASY';
    badgeColor = '#38BDF8';
    badgeBg = 'rgba(56, 189, 248, 0.2)';
  }

  const handlePronounce = () => {
    setIsSpeaking(true);
    playPronunciation(card.target_text);
    setTimeout(() => setIsSpeaking(false), 900);
  };

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View
        style={[styles.cardWrapper, cardContainerStyle, { zIndex: 10 - stackIndex }]}
      >
        {/* Front Face (English Word / Sentence) */}
        <Animated.View
          style={[
            styles.face,
            styles.frontFaceCard,
            { borderColor },
            frontAnimatedStyle,
          ]}
          pointerEvents={isFlipped ? 'none' : 'auto'}
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center space-x-2">
              {card.cefr_level && (
                <View className="bg-indigo-950/80 px-2.5 py-1 rounded-lg border border-indigo-500/40 mr-2">
                  <Text className="text-indigo-300 text-xs font-bold">{card.cefr_level}</Text>
                </View>
              )}
              {card.part_of_speech && (
                <View className="bg-sky-950/80 px-2.5 py-1 rounded-full border border-sky-700/50">
                  <Text className="text-sky-300 text-xs font-medium">{card.part_of_speech}</Text>
                </View>
              )}
            </View>

            {badgeText ? (
              <View
                style={{
                  backgroundColor: badgeBg,
                  borderColor,
                  borderWidth: 1,
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 4,
                }}
              >
                <Text style={{ color: badgeColor, fontWeight: '800', fontSize: 12 }}>
                  {badgeText}
                </Text>
              </View>
            ) : (
              <Pressable
                hitSlop={12}
                onPress={(e) => {
                  e.stopPropagation?.();
                  handlePronounce();
                }}
                className="w-10 h-10 rounded-full bg-slate-800 items-center justify-center border border-slate-700"
              >
                <SpeakerHigh
                  size={20}
                  color={isSpeaking ? '#38BDF8' : '#94A3B8'}
                  weight={isSpeaking ? 'fill' : 'regular'}
                />
              </Pressable>
            )}
          </View>

          <Pressable
            onPress={handleFlipCard}
            className="flex-1 items-center justify-center px-2"
          >
            <Text className="text-3xl font-extrabold text-white text-center leading-tight">
              {card.target_text}
            </Text>
            {card.ipa && (
              <Text className="text-sm font-mono text-cyan-400 mt-3">{card.ipa}</Text>
            )}
          </Pressable>

          <Pressable onPress={handleFlipCard} className="items-center py-1">
            {!isFlipped && (
              <Text className="text-slate-400 text-xs font-medium tracking-wide">
                Tap to flip • Swipe in 4 directions
              </Text>
            )}
          </Pressable>
        </Animated.View>

        {/* Back Face (Definition, Translation & Video Context) */}
        <Animated.View
          style={[
            styles.face,
            styles.backFaceCard,
            { borderColor },
            backAnimatedStyle,
          ]}
          pointerEvents={isFlipped ? 'auto' : 'none'}
        >
          <View className="flex-1">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-lg font-bold text-white flex-1 mr-2">{card.target_text}</Text>
              <Pressable
                hitSlop={12}
                onPress={(e) => {
                  e.stopPropagation?.();
                  handlePronounce();
                }}
                className="w-9 h-9 rounded-full bg-slate-800 items-center justify-center border border-slate-700"
              >
                <SpeakerHigh
                  size={18}
                  color={isSpeaking ? '#38BDF8' : '#94A3B8'}
                  weight={isSpeaking ? 'fill' : 'regular'}
                />
              </Pressable>
            </View>

            <Pressable onPress={handleFlipCard} className="flex-1">
              <Text className="text-2xl font-extrabold text-emerald-400 mb-3">
                {card.translation}
              </Text>

              {card.simple_definition && (
                <View className="bg-slate-800/90 p-3.5 rounded-xl border border-slate-700/60 mb-3">
                  <Text className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Simple Definition
                  </Text>
                  <Text className="text-slate-200 text-sm leading-relaxed">
                    {card.simple_definition}
                  </Text>
                </View>
              )}

              {card.context_sentence && (
                <View className="bg-slate-900/70 p-3.5 rounded-xl border border-slate-800 mb-3">
                  <Text className="text-xs font-semibold uppercase tracking-wider text-sky-400 mb-1">
                    Video Context
                  </Text>
                  <Text className="text-slate-200 text-sm italic">"{card.context_sentence}"</Text>
                </View>
              )}

              {card.context_explanation && (
                <Text className="text-slate-400 text-xs leading-relaxed">
                  {card.context_explanation}
                </Text>
              )}
            </Pressable>
          </View>

          <Pressable onPress={handleFlipCard} className="items-center pt-2 border-t border-slate-700/50">
            <Text className="text-slate-400 text-[11px]">
              Left: Again • Down: Hard • Right: Good • Up: Easy
            </Text>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  cardWrapper: {
    position: 'absolute',
    width: '100%',
    height: 420,
  },
  face: {
    width: '100%',
    height: '100%',
    backfaceVisibility: 'hidden',
    borderRadius: 24,
    padding: 24,
    borderWidth: 2,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 10,
  },
  frontFaceCard: {
    backgroundColor: '#161F30',
  },
  backFaceCard: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: '#1E293B',
  },
});
