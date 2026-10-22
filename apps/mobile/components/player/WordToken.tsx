import React from 'react';
import { Pressable, Text } from 'react-native';
import * as Haptics from 'expo-haptics';
import { cleanWordToken } from '@learneng/shared';

export interface WordTokenProps {
  token: string;
  isActiveWord: boolean;
  isSelected: boolean;
  onPress: (word: string) => void;
}

export function WordToken({ token, isActiveWord, isSelected, onPress }: WordTokenProps) {
  const handlePress = (e?: any) => {
    if (e && typeof e.stopPropagation === 'function') {
      e.stopPropagation();
    }
    Haptics.selectionAsync().catch(() => {});
    const cleaned = cleanWordToken(token);
    if (cleaned) {
      onPress(cleaned);
    }
  };

  let tokenClassName = 'text-slate-300 text-lg font-medium px-1 py-0.5 rounded';
  if (isSelected) {
    tokenClassName =
      'text-amber-300 text-lg font-bold px-1 py-0.5 rounded bg-amber-950/80 ring-1 ring-amber-400';
  } else if (isActiveWord) {
    tokenClassName =
      'text-sky-400 text-lg font-bold px-1 py-0.5 rounded bg-sky-950/60 shadow-sm';
  }

  return (
    <Pressable
      onPress={handlePress}
      hitSlop={{ top: 6, bottom: 6, left: 3, right: 3 }}
      className="mr-1 mb-1"
    >
      <Text className={tokenClassName}>{token}</Text>
    </Pressable>
  );
}
