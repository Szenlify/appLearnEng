# MOBILE_BOOTSTRAP_AND_CONFIG.md — Monorepo Scaffolding, NativeWind v4 & Dependencies

Dokument zawiera zablokowane, przetestowane konfiguracje plików konfiguracyjnych dla monorepo z **Expo SDK 51**, **React Native 0.74**, **NativeWind v4** oraz **react-native-reanimated v3**.

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
    "turbo": "^2.0.0",
    "typescript": "^5.4.5"
  },
  "packageManager": "bun@1.1.18"
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
    "@noble/hashes": "^1.4.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "typescript": "^5.4.5"
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
    "@aws-sdk/client-s3": "^3.600.0",
    "@google/genai": "^2.3.0",
    "@learneng/shared": "*",
    "@supabase/supabase-js": "^2.45.0",
    "fast-xml-parser": "^4.4.0",
    "hono": "^4.4.0",
    "stripe": "^16.2.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "typescript": "^5.4.5"
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
    "@learneng/shared": "*",
    "@react-native-community/netinfo": "11.3.1",
    "@supabase/supabase-js": "^2.45.0",
    "@tanstack/react-query": "^5.51.1",
    "expo": "~51.0.28",
    "expo-apple-authentication": "~6.4.2",
    "expo-av": "~14.0.7",
    "expo-blur": "~13.0.2",
    "expo-constants": "~16.0.2",
    "expo-haptics": "~13.0.1",
    "expo-linking": "~6.3.1",
    "expo-router": "~3.5.23",
    "expo-secure-store": "~13.0.2",
    "expo-speech": "~12.0.2",
    "expo-sqlite": "~14.0.6",
    "expo-status-bar": "~1.12.1",
    "expo-web-browser": "~13.0.3",
    "nativewind": "^4.0.1",
    "phosphor-react-native": "^2.0.1",
    "react": "18.2.0",
    "react-dom": "18.2.0",
    "react-native": "0.74.5",
    "react-native-gesture-handler": "~2.16.1",
    "react-native-reanimated": "~3.10.1",
    "react-native-safe-area-context": "4.10.5",
    "react-native-screens": "3.31.1",
    "react-native-svg": "15.2.0",
    "react-native-webview": "13.8.6",
    "react-native-youtube-iframe": "^2.3.4",
    "zustand": "^4.5.4"
  },
  "devDependencies": {
    "@babel/core": "^7.24.0",
    "@types/react": "~18.2.45",
    "tailwindcss": "^3.3.2",
    "typescript": "^5.4.5"
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
