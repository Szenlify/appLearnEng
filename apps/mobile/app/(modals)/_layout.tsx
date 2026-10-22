import React from 'react';
import { Stack } from 'expo-router';

export default function ModalsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        presentation: 'modal',
        contentStyle: { backgroundColor: '#0B0F19' },
      }}
    >
      <Stack.Screen name="paywall" />
    </Stack>
  );
}
