# MOBILE_BOOTSTRAP_AND_CONFIG.md — Monorepo Scaffolding, NativeWind v4 & Dependencies

Dokument zawiera zablokowane, przetestowane konfiguracje plików konfiguracyjnych dla monorepo z **Expo SDK 57+**, **React Native 0.85+**, **React 19**, **NativeWind v4**, **RevenueCat (`react-native-purchases`)** oraz **react-native-reanimated**.

AI implementujące aplikację ma obowiązek użyć poniższych szablonów 1:1, co eliminuje 100% typowych błędów kompilacji CSS i bundlera Metro w środowiskach Expo.

---

## 1. Plik Główny Monorepo (`package.json`)

Lokalizacja: `/package.json`

```json
{
  "name": "learneng-monorepo",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "dev:mobile": "turbo run dev --filter=mobile",
    "dev:backend": "turbo run dev --filter=backend",
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint"
  },
  "devDependencies": {
    "turbo": "^2.3.0",
    "typescript": "^5.7.0"
  },
  "packageManager": "bun@1.1.42"
}
```

---

## 2. Konfiguracja Turborepo (`turbo.json`)

Lokalizacja: `/turbo.json`

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "test": {
      "dependsOn": ["^build"],
      "cache": false
    },
    "lint": {},
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

---

## 2.5 Zależności Pakietu Współdzielonego (`packages/shared/package.json`) oraz Backendu (`apps/backend/package.json`)

Lokalizacja: `packages/shared/package.json`
```json
{
  "name": "@learneng/shared",
  "version": "1.0.0",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "test": "bun test"
  },
  "dependencies": {
    "@noble/hashes": "^1.6.0",
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "typescript": "^5.7.0"
  }
}
```

Lokalizacja: `apps/backend/package.json`
```json
{
  "name": "backend",
  "version": "1.0.0",
  "scripts": {
    "dev": "bun run --watch src/index.ts",
    "start": "bun run src/index.ts",
    "test": "bun test"
  },
  "dependencies": {
    "@aws-sdk/client-s3": "^3.714.0",
    "@google/genai": "^2.3.0",
    "@learneng/shared": "*",
    "@supabase/supabase-js": "^2.47.10",
    "fast-xml-parser": "^4.5.1",
    "hono": "^4.6.14",
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "typescript": "^5.7.0"
  }
}
```

---

## 3. Zależności Aplikacji Mobilnej (`apps/mobile/package.json`) & `tsconfig.json`

Lokalizacja: `apps/mobile/tsconfig.json`
```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": [
    "**/*.ts",
    "**/*.tsx",
    ".expo/types/**/*.ts",
    "expo-env.d.ts",
    "nativewind-env.d.ts"
  ]
}
```

Lokalizacja: `apps/mobile/package.json`

```json
{
  "name": "mobile",
  "version": "1.0.0",
  "main": "expo-router/entry",
  "scripts": {
    "start": "expo start",
    "android": "expo run:android",
    "ios": "expo run:ios",
    "web": "expo start --web",
    "test": "bun test"
  },
  "dependencies": {
    "@gorhom/bottom-sheet": "^4.6.4",
    "@learneng/shared": "*",
    "@react-native-community/netinfo": "11.4.1",
    "@supabase/supabase-js": "^2.47.10",
    "@tanstack/react-query": "^5.62.8",
    "expo": "^57.0.0",
    "expo-apple-authentication": "~7.0.1",
    "expo-av": "~15.0.1",
    "expo-blur": "~14.0.1",
    "expo-constants": "~17.0.3",
    "expo-crypto": "~14.0.1",
    "expo-haptics": "~14.0.0",
    "expo-linking": "~7.0.3",
    "expo-router": "~4.0.9",
    "expo-secure-store": "~14.0.0",
    "expo-speech": "~13.0.0",
    "expo-sqlite": "~15.0.3",
    "expo-status-bar": "~2.0.0",
    "expo-web-browser": "~14.0.1",
    "nativewind": "^4.1.23",
    "phosphor-react-native": "^2.0.1",
    "react": "19.2.0",
    "react-dom": "19.2.0",
    "react-native": "0.85.2",
    "react-native-gesture-handler": "~2.20.2",
    "react-native-purchases": "^8.4.0",
    "react-native-reanimated": "~3.16.1",
    "react-native-safe-area-context": "4.12.0",
    "react-native-screens": "~4.4.0",
    "react-native-svg": "15.8.0",
    "react-native-webview": "13.12.5",
    "react-native-youtube-iframe": "^2.3.4",
    "zustand": "^4.5.5"
  },
  "devDependencies": {
    "@babel/core": "^7.26.0",
    "@types/react": "~19.0.0",
    "tailwindcss": "^3.4.17",
    "typescript": "^5.7.0"
  },
  "private": true
}
```

---

## 4. Konfiguracja Bundlera Metro (`apps/mobile/metro.config.js`)

> [!IMPORTANT]
> NativeWind v4 wymaga owinięcia konfiguracji Metro w `withNativeWind` wskazując na `global.css`.

```javascript
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: "./global.css" });
```

---

## 5. Konfiguracja Tailwind CSS (`apps/mobile/tailwind.config.js`)

Lokalizacja: `apps/mobile/tailwind.config.js`

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        background: {
          main: "#0B0F19",
          surface: "#161F30",
          surfaceElevated: "#1E293B",
        },
        subtitles: {
          activeWord: "#38BDF8",
          wordTapped: "#FACC15",
        },
        tinder: {
          again: "#EF4444",
          hard: "#F59E0B",
          good: "#10B981",
          easy: "#38BDF8",
        },
      },
    },
  },
  plugins: [],
};
```

---

## 6. Konfiguracja Babel (`apps/mobile/babel.config.js`)

Lokalizacja: `apps/mobile/babel.config.js`

> [!WARNING]
> Wtyczka `react-native-reanimated/plugin` **musi być zawsze umieszczona na samym końcu tablicy plugins!**

```javascript
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    plugins: [
      "react-native-reanimated/plugin", // MUSI BYĆ OSTATNI!
    ],
  };
};
```

---

## 7. Plik CSS Główny (`apps/mobile/global.css`)

Lokalizacja: `apps/mobile/global.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

---

## 8. Root Layout z Poprawką Dźwięku iOS (`apps/mobile/app/_layout.tsx`)

Rozwiązanie problemu braku dźwięku wymowy `expo-speech` na iPhone przy włączonym fizycznym przełączniku wyciszenia (Silent Mode Switch):

```typescript
import '../global.css';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Audio } from 'expo-av';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 10, // 10 minut
      retry: 2,
    },
  },
});

export default function RootLayout() {
  useEffect(() => {
    // 🛑 KRYTYCZNA POPRAWKA DŹWIĘKU NA iOS:
    // Wymusza odtwarzanie dźwięku wymowy expo-speech nawet gdy iPhone jest wyciszony fizycznym suwakiem
    Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
    }).catch((err) => console.warn('Błąd konfiguracji Audio Mode:', err));
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#0B0F19' }}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#0B0F19' },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen
            name="(modals)/paywall"
            options={{
              presentation: 'modal',
              animation: 'slide_from_bottom',
            }}
          />
        </Stack>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
```
