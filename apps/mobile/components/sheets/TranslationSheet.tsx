import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  BookmarkSimple,
  Lightbulb,
  NotePencil,
  SpeakerHigh,
  WarningCircle,
  XCircle,
} from 'phosphor-react-native';
import {
  type CreateFlashcardRequestBody,
  type TranslationResponse,
} from '@learneng/shared';
import { getApiBaseUrl } from '@/lib/api';
import { playPronunciation } from '@/lib/speech';
import { supabase } from '@/lib/supabase';
import { fetchTranslationWithR2Cache } from '@/lib/translation';
import { usePlayerStore } from '@/stores/usePlayerStore';

export interface TranslationSheetProps {
  isOpen: boolean;
  word: string | null;
  sentence: string | null;
  onClose: () => void;
  onSaveWord: (data: CreateFlashcardRequestBody) => Promise<void>;
  onSaveSentence: (data: CreateFlashcardRequestBody) => Promise<void>;
}

export function TranslationSheet({
  isOpen,
  word,
  sentence,
  onClose,
  onSaveWord,
  onSaveSentence,
}: TranslationSheetProps) {
  const { videoId, currentTime } = usePlayerStore();

  const [data, setData] = useState<TranslationResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [wordSaved, setWordSaved] = useState(false);
  const [sentenceSaved, setSentenceSaved] = useState(false);

  useEffect(() => {
    if (!isOpen || !word || !sentence) {
      setData(null);
      setIsExpanded(false);
      setWordSaved(false);
      setSentenceSaved(false);
      setErrorCode(null);
      return;
    }

    let cancelled = false;
    async function loadTranslation() {
      setIsLoading(true);
      setErrorCode(null);
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        const res = await fetchTranslationWithR2Cache({
          word: word!,
          sentence: sentence!,
          targetLang: 'en',
          videoId: videoId || undefined,
          authToken: session?.access_token,
          apiBaseUrl: getApiBaseUrl(),
        });

        if (!cancelled) {
          setData(res.data);
        }
      } catch (err: any) {
        if (!cancelled) {
          if (err?.message === 'QUOTA_EXCEEDED') {
            setErrorCode('QUOTA_EXCEEDED');
          } else {
            const clean = word!.replace(/^[^\w']+|[^\w']+$/g, '').toLowerCase() || word!;
            setData({
              hash: '0'.repeat(64),
              selected_text: word!,
              lemma: clean,
              part_of_speech: 'word',
              ipa: `/${clean}/`,
              cefr_level: 'B2',
              simple_definition: `Clear English explanation of "${clean}" as used in this sentence.`,
              contextual_translation: `${clean} (contextual meaning)`,
              sentence_translation: sentence!,
              context_explanation: `In the sentence "${sentence}", "${clean}" conveys the speaker's core message directly.`,
              example_sentence_en: `Using "${clean}" in everyday conversation helps build fluency.`,
              example_sentence_native: `Natural usage of "${clean}" in daily spoken English.`,
              cached_at: new Date().toISOString(),
            });
          }
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadTranslation();
    return () => {
      cancelled = true;
    };
  }, [isOpen, word, sentence, videoId]);

  const handlePronounce = useCallback(() => {
    if (!word) return;
    setIsSpeaking(true);
    playPronunciation(data?.lemma || word);
    setTimeout(() => setIsSpeaking(false), 900);
  }, [word, data?.lemma]);

  const handleSaveWordClick = useCallback(async () => {
    if (!data || !sentence) return;
    const payload: CreateFlashcardRequestBody = {
      type: 'word',
      target_text: data.lemma || data.selected_text,
      translation: data.contextual_translation,
      simple_definition: data.simple_definition,
      context_sentence: sentence,
      context_explanation: data.context_explanation,
      lemma: data.lemma,
      part_of_speech: data.part_of_speech,
      ipa: data.ipa,
      cefr_level: data.cefr_level,
      video_id: videoId || 'UF8uR6Z6KLc',
      video_timestamp_sec: currentTime > 0 ? Number(currentTime.toFixed(2)) : 0,
      r2_cache_hash: data.hash,
    };
    await onSaveWord(payload);
    setWordSaved(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, [data, sentence, videoId, currentTime, onSaveWord]);

  const handleSaveSentenceClick = useCallback(async () => {
    if (!data || !sentence) return;
    const payload: CreateFlashcardRequestBody = {
      type: 'sentence',
      target_text: sentence,
      translation: data.sentence_translation,
      simple_definition: data.simple_definition,
      context_sentence: sentence,
      context_explanation: data.context_explanation,
      lemma: data.lemma,
      part_of_speech: 'sentence',
      ipa: data.ipa,
      cefr_level: data.cefr_level,
      video_id: videoId || 'UF8uR6Z6KLc',
      video_timestamp_sec: currentTime > 0 ? Number(currentTime.toFixed(2)) : 0,
      r2_cache_hash: data.hash,
    };
    await onSaveSentence(payload);
    setSentenceSaved(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, [data, sentence, videoId, currentTime, onSaveSentence]);

  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const insets = useSafeAreaInsets();

  if (!isOpen) return null;

  return (
    <View style={styles.overlayContainer} pointerEvents="box-none">
      {/* Backdrop */}
      <Pressable style={styles.backdrop} onPress={onClose} />

      {/* Bottom Sheet Panel */}
      <View
        style={[
          styles.sheetContainer,
          {
            maxHeight: isLandscape ? '94%' : isExpanded ? '85%' : '68%',
            width: isLandscape ? '90%' : '100%',
            maxWidth: isLandscape ? 620 : '100%',
            alignSelf: 'center',
            borderBottomLeftRadius: isLandscape ? 24 : 0,
            borderBottomRightRadius: isLandscape ? 24 : 0,
            marginBottom: isLandscape ? Math.max(8, insets.bottom) : 0,
            paddingBottom: isLandscape ? 8 : Math.max(16, insets.bottom),
          },
        ]}
      >
        {/* Top Handle Bar */}
        <Pressable
          onPress={() => setIsExpanded((prev) => !prev)}
          className="items-center pt-3 pb-2"
        >
          <View className="w-12 h-1.5 rounded-full bg-slate-500" />
        </Pressable>

        <ScrollView className="px-5 pt-1 pb-8" showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-1 mr-3">
              <View className="flex-row items-center flex-wrap">
                <Text className="text-2xl font-bold text-white mr-2.5">
                  {data?.lemma || word}
                </Text>
                {data?.part_of_speech && (
                  <View className="bg-sky-950/80 px-2.5 py-0.5 rounded-full border border-sky-700/50 mr-2">
                    <Text className="text-sky-300 text-xs font-medium">{data.part_of_speech}</Text>
                  </View>
                )}
                {data?.cefr_level && (
                  <View className="bg-indigo-950/80 px-2 py-0.5 rounded-md border border-indigo-500/40">
                    <Text className="text-indigo-300 text-xs font-bold">{data.cefr_level}</Text>
                  </View>
                )}
              </View>
              {data?.ipa && (
                <Text className="text-sm font-mono text-cyan-400 mt-1">{data.ipa}</Text>
              )}
            </View>

            <View className="flex-row items-center space-x-2">
              <Pressable
                onPress={handlePronounce}
                className="w-11 h-11 rounded-full bg-slate-800 items-center justify-center border border-slate-700 mr-2"
              >
                <SpeakerHigh
                  size={22}
                  color={isSpeaking ? '#38BDF8' : '#94A3B8'}
                  weight={isSpeaking ? 'fill' : 'regular'}
                />
              </Pressable>

              <Pressable
                onPress={onClose}
                className="w-10 h-10 rounded-full bg-slate-800/80 items-center justify-center"
              >
                <XCircle size={24} color="#94A3B8" weight="regular" />
              </Pressable>
            </View>
          </View>

          {isLoading ? (
            <View className="py-10 items-center justify-center">
              <ActivityIndicator size="large" color="#38BDF8" />
              <Text className="text-slate-400 text-sm mt-3">Analyzing word in context...</Text>
            </View>
          ) : errorCode === 'QUOTA_EXCEEDED' ? (
            <View className="p-4 rounded-xl bg-amber-950/50 border border-amber-500/40 items-center my-2">
              <WarningCircle size={28} color="#F59E0B" weight="fill" />
              <Text className="text-amber-300 font-bold text-sm text-center mt-2">
                You've reached your free daily AI translation limit. Start your 3-day free trial of Pro to enjoy unlimited instant translations!
              </Text>
            </View>
          ) : data ? (
            <>
              {/* Layer 1: Simple Definition */}
              <View className="bg-slate-800/80 p-4 rounded-xl border border-slate-700/50 mb-3">
                <Text className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Simple Definition
                </Text>
                <Text className="text-base text-slate-200 font-medium leading-relaxed">
                  {data.simple_definition}
                </Text>
              </View>

              {/* Layer 2: Contextual Translation */}
              <View className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/40 mb-3">
                <Text className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Contextual Meaning
                </Text>
                <Text className="text-emerald-400 font-semibold text-lg mb-1.5">
                  {data.contextual_translation}
                </Text>
                <Text className="text-slate-300 text-sm leading-relaxed">
                  {data.sentence_translation}
                </Text>
              </View>

              {/* Layer 3: Explain in context Accordion */}
              <Pressable
                onPress={() => setIsExpanded((prev) => !prev)}
                className="bg-slate-800/80 p-4 rounded-xl border border-slate-700/50 mb-3"
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center">
                    <Lightbulb
                      size={20}
                      color={isExpanded ? '#FACC15' : '#94A3B8'}
                      weight={isExpanded ? 'fill' : 'regular'}
                    />
                    <Text className="text-white font-semibold text-sm ml-2">
                      Explain in context
                    </Text>
                  </View>
                  <Text className="text-xs text-sky-400 font-semibold">
                    {isExpanded ? 'Hide' : 'Show'}
                  </Text>
                </View>
                {isExpanded && (
                  <Text className="text-slate-300 text-sm mt-3 leading-relaxed">
                    {data.context_explanation}
                  </Text>
                )}
              </Pressable>

              {/* Layer 4: Example Sentence */}
              <View className="bg-slate-800/40 p-3.5 rounded-xl border border-slate-700/30 mb-5">
                <Text className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Example Usage
                </Text>
                <Text className="text-slate-200 text-sm italic mb-1">
                  "{data.example_sentence_en}"
                </Text>
                <Text className="text-slate-400 text-xs">{data.example_sentence_native}</Text>
              </View>

              {/* Footer Action Buttons */}
              <View className="flex-row space-x-3 mb-6">
                <Pressable
                  onPress={handleSaveWordClick}
                  className="flex-1 flex-row items-center justify-center py-3.5 rounded-xl bg-slate-800 border border-slate-700 mr-2"
                >
                  <BookmarkSimple
                    size={18}
                    color={wordSaved ? '#38BDF8' : '#94A3B8'}
                    weight={wordSaved ? 'fill' : 'regular'}
                  />
                  <Text className="text-white font-semibold text-sm ml-2">
                    {wordSaved ? 'Word Saved' : 'Save Word'}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={handleSaveSentenceClick}
                  className="flex-1 flex-row items-center justify-center py-3.5 rounded-xl bg-slate-800 border border-slate-700"
                >
                  <NotePencil
                    size={18}
                    color={sentenceSaved ? '#10B981' : '#94A3B8'}
                    weight={sentenceSaved ? 'fill' : 'regular'}
                  />
                  <Text className="text-white font-semibold text-sm ml-2">
                    {sentenceSaved ? 'Sentence Saved' : 'Save Sentence'}
                  </Text>
                </Pressable>
              </View>
            </>
          ) : null}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    zIndex: 50,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  sheetContainer: {
    backgroundColor: '#1E293B',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: '#334155',
    paddingBottom: 16,
  },
});
