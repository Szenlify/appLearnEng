import React, { useCallback, useEffect, useRef } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { PlayCircle } from 'phosphor-react-native';
import { cleanWordToken, type SubtitleCue } from '@learneng/shared';
import { findActiveWordIndex, usePlayerStore } from '@/stores/usePlayerStore';
import { WordToken } from './WordToken';

export interface SubtitleTrackProps {
  cues: SubtitleCue[];
  activeCueIndex: number;
  currentTime: number;
  onWordPress: (word: string, contextSentence: string) => void;
  onCuePress?: (cue: SubtitleCue, index: number) => void;
}

export function useWordTapHandler(onSelect: (word: string, sentence: string) => void) {
  const lastTapTime = useRef<number>(0);

  return (word: string, sentence: string) => {
    const now = Date.now();
    if (now - lastTapTime.current < 200) {
      return; // Ignore rapid duplicate tap within 200ms
    }
    lastTapTime.current = now;
    onSelect(word, sentence);
  };
}

function formatTime(sec: number): string {
  const totalSec = Math.max(0, Math.floor(sec));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export function SubtitleTrack({
  cues,
  activeCueIndex,
  currentTime,
  onWordPress,
  onCuePress,
}: SubtitleTrackProps) {
  const flatListRef = useRef<FlatList<SubtitleCue>>(null);
  const itemHeightsRef = useRef<Record<number, number>>({});
  const containerHeightRef = useRef<number>(360);
  const lastScrolledCueRef = useRef<number>(-1);

  const videoId = usePlayerStore((s) => s.videoId);
  const lastVideoIdRef = useRef<string | null>(null);

  const selectedWord = usePlayerStore((s) => s.selectedWord);
  const selectedSentence = usePlayerStore((s) => s.selectedSentence);
  const handleDebouncedTap = useWordTapHandler(onWordPress);

  // Helper to accurately calculate cumulative Y offset and scroll smoothly
  const scrollToCue = useCallback(
    (index: number, animated = true) => {
      if (index < 0 || index >= cues.length || !flatListRef.current) return;

      // Cumulative height: 16px top padding + sum of (item height + 12px margin)
      let y = 16;
      for (let i = 0; i < index; i++) {
        const h = itemHeightsRef.current[i] || 76;
        y += h + 12;
      }
      const viewportH = containerHeightRef.current || 360;
      // Position the active/tapped cue comfortably at ~25% from top
      const targetOffset = Math.max(0, y - viewportH * 0.25);

      lastScrolledCueRef.current = index;
      flatListRef.current.scrollToOffset({
        offset: targetOffset,
        animated,
      });
    },
    [cues.length]
  );

  // Reset scroll ONLY when switching to a completely new video (different videoId)
  useEffect(() => {
    if (videoId && videoId !== lastVideoIdRef.current) {
      lastVideoIdRef.current = videoId;
      itemHeightsRef.current = {};
      lastScrolledCueRef.current = -1;
      flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
    }
  }, [videoId]);

  // Smooth auto-scroll following the active spoken cue
  useEffect(() => {
    if (
      activeCueIndex >= 0 &&
      activeCueIndex < cues.length &&
      activeCueIndex !== lastScrolledCueRef.current
    ) {
      scrollToCue(activeCueIndex, true);
    }
  }, [activeCueIndex, cues.length, scrollToCue]);

  // Handle tapping a subtitle bubble / timestamp to rewind or seek immediately
  const handleCuePress = useCallback(
    (cue: SubtitleCue, index: number) => {
      Haptics.selectionAsync().catch(() => {});
      scrollToCue(index, true);
      onCuePress?.(cue, index);
    },
    [onCuePress, scrollToCue]
  );

  return (
    <FlatList
      ref={flatListRef}
      data={cues}
      keyExtractor={(item, idx) => item.id || `cue-${idx}`}
      initialNumToRender={50}
      maxToRenderPerBatch={50}
      windowSize={15}
      contentContainerStyle={{ paddingVertical: 16, paddingHorizontal: 16 }}
      onLayout={(e) => {
        const h = e.nativeEvent.layout.height;
        if (h > 0) containerHeightRef.current = h;
      }}
      renderItem={({ item: cue, index }) => {
        const isCurrentCue = index === activeCueIndex;
        const activeWordIdx = isCurrentCue ? findActiveWordIndex(currentTime, cue) : -1;

        return (
          <Pressable
            onPress={() => handleCuePress(cue, index)}
            onLayout={(e) => {
              const { height } = e.nativeEvent.layout;
              if (height > 0) {
                itemHeightsRef.current[index] = height;
              }
            }}
            style={({ pressed }) => ({
              backgroundColor: isCurrentCue
                ? '#1E293B'
                : pressed
                ? 'rgba(30, 41, 59, 0.7)'
                : 'rgba(22, 31, 48, 0.45)',
              borderColor: isCurrentCue ? '#38BDF8' : 'rgba(30, 41, 59, 0.8)',
              borderWidth: isCurrentCue ? 1.5 : 1,
              borderRadius: 16,
              padding: 14,
              marginBottom: 12,
            })}
          >
            {/* Header: Timestamp badge with Play icon & NOW PLAYING indicator */}
            <View className="flex-row items-center justify-between mb-2">
              <View className="flex-row items-center space-x-1.5">
                <PlayCircle
                  size={15}
                  color={isCurrentCue ? '#38BDF8' : '#94A3B8'}
                  weight={isCurrentCue ? 'fill' : 'regular'}
                />
                <Text
                  style={{
                    color: isCurrentCue ? '#38BDF8' : '#94A3B8',
                    fontSize: 12,
                    fontWeight: isCurrentCue ? '700' : '600',
                    marginLeft: 4,
                  }}
                >
                  {formatTime(cue.start)}
                </Text>
              </View>

              {isCurrentCue && (
                <View className="bg-sky-500/20 px-2 py-0.5 rounded-full border border-sky-400/40">
                  <Text style={{ color: '#38BDF8', fontSize: 10, fontWeight: '700' }}>
                    NOW PLAYING
                  </Text>
                </View>
              )}
            </View>

            {/* Sentence tokens: individual words are tappable for translation */}
            <View className="flex-row flex-wrap items-center">
              {(cue.tokens ?? (cue as any).words ?? cue.text.split(/\s+/)).map(
                (token: string, tokenIdx: number) => {
                  const cleaned = cleanWordToken(token).toLowerCase();
                  const isSelected =
                    selectedSentence === cue.text &&
                    Boolean(selectedWord) &&
                    cleaned === selectedWord?.toLowerCase();

                  return (
                    <WordToken
                      key={`${cue.id || index}_${tokenIdx}`}
                      token={token}
                      isActiveWord={isCurrentCue && tokenIdx === activeWordIdx}
                      isSelected={isSelected}
                      onPress={(word) => handleDebouncedTap(word, cue.text)}
                    />
                  );
                }
              )}
            </View>
          </Pressable>
        );
      }}
    />
  );
}
