# DEPLOYMENT_AND_EAS.md — EAS Build, App Store & Google Play Deployment

Dokument definiuje konfigurację wdrożeniową dla aplikacji mobilnej LearnEng za pomocą **Expo Application Services (EAS Build & Submit)**.

---

## 1. Konfiguracja `app.json` (Expo Configuration)

Lokalizacja: `apps/mobile/app.json`

```json
{
  "expo": {
    "name": "LearnEng",
    "slug": "learneng",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "scheme": "learneng",
    "userInterfaceStyle": "dark",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#0B0F19"
    },
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.softileo.learneng",
      "usesAppleSignIn": true,
      "infoPlist": {
        "UIBackgroundModes": ["audio"]
      }
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#0B0F19"
      },
      "package": "com.softileo.learneng",
      "permissions": [
        "INTERNET",
        "ACCESS_NETWORK_STATE"
      ]
    },
    "plugins": [
      "expo-router",
      "expo-secure-store",
      "expo-apple-authentication"
    ],
    "experiments": {
      "typedRoutes": true
    }
  }
}
```

---

## 2. Konfiguracja EAS (`eas.json`)

Lokalizacja: `apps/mobile/eas.json`

```json
{
  "cli": {
    "version": ">= 9.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "ios": {
        "simulator": false
      },
      "android": {
        "buildType": "apk"
      },
      "env": {
        "EXPO_PUBLIC_API_URL": "https://api.applearneng.com",
        "EXPO_PUBLIC_R2_URL": "https://cache.applearneng.com",
        "EXPO_PUBLIC_SUPABASE_URL": "https://your-project.supabase.co",
        "EXPO_PUBLIC_SUPABASE_ANON_KEY": "eyJhbGciOi...",
        "EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY": "pk_test_..."
      }
    },
    "production": {
      "autoIncrement": true,
      "env": {
        "EXPO_PUBLIC_API_URL": "https://api.applearneng.com",
        "EXPO_PUBLIC_R2_URL": "https://cache.applearneng.com",
        "EXPO_PUBLIC_SUPABASE_URL": "https://your-project.supabase.co",
        "EXPO_PUBLIC_SUPABASE_ANON_KEY": "eyJhbGciOi...",
        "EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY": "pk_live_..."
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "apple-dev@softileo.com",
        "ascAppId": "your_app_store_connect_id",
        "appleTeamId": "your_team_id"
      },
      "android": {
        "serviceAccountKeyPath": "./google-services-key.json",
        "track": "internal"
      }
    }
  }
}
```

---

## 3. Komendy Wdrożenia (CLI)

1. **Logowanie do Expo:**
   ```bash
   eas login
   ```
2. **Budowanie testowej paczki Preview (TestFlight / APK na Androida):**
   ```bash
   eas build --platform all --profile preview
   ```
3. **Automatyczne wysłanie do App Store i Google Play:**
   ```bash
   eas build --platform all --profile production --auto-submit
   ```
