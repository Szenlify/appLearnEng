import React from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { Tabs } from 'expo-router';
import { BlurView } from 'expo-blur';
import { Compass, PlayCircle, Cards, UserCircle } from 'phosphor-react-native';

export default function TabsLayout() {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#38BDF8',
        tabBarInactiveTintColor: '#64748B',
        tabBarStyle: {
          display: isLandscape ? 'none' : 'flex',
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
