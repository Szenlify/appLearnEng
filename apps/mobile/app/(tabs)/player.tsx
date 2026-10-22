import React, { useRef, useEffect, useState, useCallback } from 'react';
import { View, Text, Pressable, ActivityIndicator, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import YoutubePlayer, { YoutubeIframeRef } from 'react-native-youtube-iframe';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import {
  ArrowCounterClockwise,
  MinusCircle,
  PlusCircle,
  Gauge,
  WarningCircle,
} from 'phosphor-react-native';
import {
  usePlayerStore,
  QUERY_KEYS,
  stepPlaybackRate,
  findActiveCueIndex,
} from '@/stores/usePlayerStore';
import { SubtitleTrack } from '@/components/player/SubtitleTrack';
import { TranslationSheet } from '@/components/sheets/TranslationSheet';
import { fetchYouTubeCaptionsDirect, getApiBaseUrl } from '@/lib/api';
import { LocalFlashcardsRepository } from '@/lib/db/LocalFlashcardsRepository';
import { FlashcardSyncEngine } from '@/lib/db/FlashcardSyncEngine';
import { supabase } from '@/lib/supabase';

export default function PlayerScreen() {
  const { videoId: paramVideoId } = useLocalSearchParams<{ videoId?: string }>();
  const playerRef = useRef<YoutubeIframeRef>(null);

  const {
    videoId: storeVideoId,
    isPlaying,
    currentTime,
    playbackRate,
    cues,
    selectedWord,
    selectedSentence,
    isSheetOpen,
    setVideoId,
    setIsPlaying,
    setCurrentTime,
    setPlaybackRate,
    setCaptions,
    openTranslation,
    closeTranslation,
  } = usePlayerStore();

  // Keep store videoId synchronized with route param whenever user selects a new video
  useEffect(() => {
    if (paramVideoId && paramVideoId !== storeVideoId) {
      setVideoId(paramVideoId);
    }
  }, [paramVideoId, storeVideoId, setVideoId]);

  const videoId = paramVideoId || storeVideoId || 'UF8uR6Z6KLc';
  const [currentUserId, setCurrentUserId] = useState<string>('local-user');

  useEffect(() => {
    supabase.auth
      .getUser()
      .then(({ data: { user } }) => {
        if (user?.id) setCurrentUserId(user.id);
      })
      .catch(() => {});
  }, []);

  // 1. Time synchronization loop with YouTube IFrame (150ms interval)
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    if (isPlaying) {
      interval = setInterval(async () => {
        try {
          const time = await playerRef.current?.getCurrentTime();
          if (typeof time === 'number') {
            setCurrentTime(time);
          }
        } catch {
          // Iframe may be buffering
        }
      }, 150);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, setCurrentTime]);

  // 2. Fetch transcript cues (TanStack Query)
  const { data: captionsData, isLoading, error } = useQuery({
    queryKey: QUERY_KEYS.captions(videoId),
    queryFn: async () => {
      try {
        const res = await fetch(
          `${getApiBaseUrl()}/api/v1/captions?videoId=${encodeURIComponent(videoId)}&lang=en`
        );
        if (!res.ok) {
          if (res.status === 422) throw new Error('NO_CAPTIONS_AVAILABLE');
          throw new Error('FAILED_TO_LOAD_CAPTIONS');
        }
        return res.json();
      } catch (err: any) {
        if (err?.message === 'NO_CAPTIONS_AVAILABLE') throw err;
        // Direct on-device InnerTube fallback if local backend is not reachable
        return await fetchYouTubeCaptionsDirect(videoId);
      }
    },
  });

  useEffect(() => {
    if (captionsData?.cues) {
      setCaptions(captionsData.cues);
    }
  }, [captionsData, setCaptions]);

  // 3. Pause & resume handling on word selection
  const handleWordPress = useCallback(
    (word: string, contextSentence: string) => {
      openTranslation(word, contextSentence);
    },
    [openTranslation]
  );

  const handleCloseSheet = useCallback(() => {
    closeTranslation();
  }, [closeTranslation]);

  // 4. Repeat current sentence from beginning
  const handleRepeatSentence = useCallback(async () => {
    const activeCue = cues.find((c) => currentTime >= c.start && currentTime <= c.end);
    if (activeCue && playerRef.current) {
      await playerRef.current.seekTo(activeCue.start, true);
      setCurrentTime(activeCue.start);
    }
  }, [cues, currentTime, setCurrentTime]);

  // 5. Click on subtitle bubble/timestamp: immediately seek video & resume playback
  const handleSeekToCue = useCallback(
    async (cue: { start: number }) => {
      try {
        await playerRef.current?.seekTo(cue.start, true);
        setCurrentTime(cue.start);
        if (!isPlaying) {
          setIsPlaying(true);
        }
      } catch {
        // ignore
      }
    },
    [setCurrentTime, isPlaying, setIsPlaying]
  );

  // 6. Smooth speed adjustment from 0.25x to 2.00x in 0.05 steps
  const handleAdjustSpeed = useCallback(
    (delta: number) => {
      const nextRate = stepPlaybackRate(playbackRate, delta);
      setPlaybackRate(nextRate);
    },
    [playbackRate, setPlaybackRate]
  );

  const handleResetSpeed = useCallback(() => {
    setPlaybackRate(1.0);
  }, [setPlaybackRate]);

  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#0B0F19',
        flexDirection: isLandscape ? 'row' : 'column',
      }}
    >
      {/* 1. Left/Top Column: YouTube Player + Tooling Controls */}
      <View
        style={{
          width: isLandscape ? '54%' : '100%',
          paddingLeft: isLandscape ? Math.max(8, insets.left) : 0,
          paddingTop: isLandscape ? Math.max(4, insets.top) : 0,
          borderRightWidth: isLandscape ? 1 : 0,
          borderRightColor: '#1E293B',
          backgroundColor: '#0B0F19',
        }}
      >
        {/* YouTube Player in 16:9 aspect ratio */}
        <View className="w-full aspect-video bg-black">
          <YoutubePlayer
            key={videoId}
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

        {/* Tooling bar below video: Repeat sentence & Playback Speed */}
        <View className="flex-row items-center justify-between px-4 py-2 border-b border-slate-800 bg-[#161F30]/60">
          <Pressable
            onPress={handleRepeatSentence}
            className="flex-row items-center px-3 py-1.5 rounded-lg bg-slate-800 active:bg-slate-700"
          >
            {({ pressed }) => (
              <>
                <ArrowCounterClockwise
                  size={16}
                  color={pressed ? '#38BDF8' : '#94A3B8'}
                  weight={pressed ? 'fill' : 'regular'}
                />
                <Text className="text-slate-200 font-semibold text-xs ml-1.5">Repeat Sentence</Text>
              </>
            )}
          </Pressable>

          {/* Speed stepper */}
          <View className="flex-row items-center bg-slate-800 rounded-lg px-2 py-1 space-x-2">
            <Pressable
              onPress={() => handleAdjustSpeed(-0.05)}
              disabled={playbackRate <= 0.25}
              className="p-1"
            >
              {({ pressed }) => (
                <MinusCircle
                  size={18}
                  color={pressed ? '#38BDF8' : '#94A3B8'}
                  weight={pressed ? 'fill' : 'regular'}
                />
              )}
            </Pressable>

            <Pressable onPress={handleResetSpeed} className="flex-row items-center px-1.5">
              <Gauge
                size={15}
                color={playbackRate !== 1.0 ? '#38BDF8' : '#94A3B8'}
                weight={playbackRate !== 1.0 ? 'fill' : 'regular'}
              />
              <Text className="text-slate-200 font-mono font-bold text-xs ml-1">
                {playbackRate.toFixed(2)}x
              </Text>
            </Pressable>

            <Pressable
              onPress={() => handleAdjustSpeed(0.05)}
              disabled={playbackRate >= 2.0}
              className="p-1"
            >
              {({ pressed }) => (
                <PlusCircle
                  size={18}
                  color={pressed ? '#38BDF8' : '#94A3B8'}
                  weight={pressed ? 'fill' : 'regular'}
                />
              )}
            </Pressable>
          </View>
        </View>
      </View>

      {/* 2. Right/Bottom Column: Subtitles track or error banner */}
      <View
        style={{
          flex: 1,
          paddingRight: isLandscape ? Math.max(8, insets.right) : 0,
          paddingBottom: isLandscape ? Math.max(4, insets.bottom) : 0,
        }}
      >
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#38BDF8" />
            <Text className="text-slate-400 mt-2 text-sm">Loading synchronized subtitles...</Text>
          </View>
        ) : error?.message === 'NO_CAPTIONS_AVAILABLE' ? (
          <View className="p-6 m-4 rounded-2xl bg-amber-950/40 border border-amber-600/30 items-center">
            <WarningCircle size={28} color="#F59E0B" weight="fill" />
            <Text className="text-amber-400 font-bold text-base mt-2 mb-1">
              This video has no English subtitles
            </Text>
            <Text className="text-slate-400 text-xs text-center mb-4">
              Search for another video or choose one of our recommended videos in Explore.
            </Text>
          </View>
        ) : (
          <SubtitleTrack
            cues={cues}
            activeCueIndex={findActiveCueIndex(currentTime, cues)}
            currentTime={currentTime}
            onWordPress={handleWordPress}
            onCuePress={handleSeekToCue}
          />
        )}
      </View>

      {/* 4. Translation Bottom Sheet */}
      <TranslationSheet
        isOpen={isSheetOpen}
        word={selectedWord}
        sentence={selectedSentence}
        onClose={handleCloseSheet}
        onSaveWord={async (data) => {
          if (!currentUserId) return;
          const cardId = Crypto.randomUUID();
          await LocalFlashcardsRepository.insertCard({
            id: cardId,
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
          if (!currentUserId) return;
          const cardId = Crypto.randomUUID();
          await LocalFlashcardsRepository.insertCard({
            id: cardId,
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
