# INFRA_SETUP_CHECKLIST.md — Infrastructure & External Services Setup Guide

Krok po kroku instrukcja konfiguracji zewnętrznych usług dla projektu **LearnEng**. Wszystkie usługi w konfiguracji początkowej mieszczą się w **darmowych tierach ($0.00)**.

---

## 1. Supabase (Baza Danych PostgreSQL & Auth)

1. **Utwórz Projekt:**
   - Przejdź do [database.new](https://database.new) i stwórz darmowy projekt `learneng`.
   - Zapisz wygenerowane hasło do bazy danych.
2. **Uruchom Migrację Bazy Danych:**
   - W panelu Supabase przejdź do **SQL Editor**.
   - Wklej i wykonaj zawartość pliku `DATABASE_SCHEMA.sql`.
   - Zweryfikuj utworzenie tabel: `profiles`, `user_subscriptions`, `user_flashcards`, `user_watch_history`.
3. **Skonfiguruj Autoryzację (Supabase Auth):**
   - Przejdź do **Authentication -> Providers**:
     - **Apple:** Włącz provider Apple, podaj `Services ID`, `Team ID`, `Key ID` oraz wygenerowany klucz `.p8`.
     - **Google:** Włącz provider Google, podaj `Client ID` (iOS, Android, Web) oraz `Client Secret`.
   - W **Authentication -> URL Configuration**:
     - Site URL: `https://learneng.app` (lub domena produkcyjna).
     - Redirect URLs: `learneng://*`, `learneng://auth/callback`.
4. **Pobierz Klucze API:**
   - W **Project Settings -> API** skopiuj:
     - `Project URL` -> `EXPO_PUBLIC_SUPABASE_URL`
     - `anon / public key` -> `EXPO_PUBLIC_SUPABASE_ANON_KEY`
     - `service_role key` -> `SUPABASE_SERVICE_ROLE_KEY` (tylko w backendzie!).

---

## 2. Cloudflare R2 (Globalny CDN Cache Tłumaczeń z Zero Egress)

1. **Utwórz Bucket R2:**
   - Zaloguj się do Cloudflare Dashboard -> **R2 Object Storage**.
   - Kliknij **Create bucket**, nazwij go `learneng-cache`.
   - Region: `Automatic`.
2. **Włącz Publiczny Dostęp (Custom Domain / R2.dev):**
   - Wejdź w bucket -> zakładka **Settings -> Public access**.
   - Podepnij własną domenę (np. `cache.applearneng.com`) lub włącz publiczny URL `pub-*.r2.dev`.
   - Ten URL wpisz do `EXPO_PUBLIC_R2_URL`.
3. **Wygeneruj Klucze API S3:**
   - W menu R2 kliknij **Manage R2 API Tokens**.
   - Kliknij **Create API Token**:
     - Uprawnienia: `Object Read & Write`.
     - Wybierz bucket: `learneng-cache`.
   - Zapisz:
     - `Access Key ID` -> `CLOUDFLARE_R2_ACCESS_KEY_ID`
     - `Secret Access Key` -> `CLOUDFLARE_R2_SECRET_ACCESS_KEY`
     - `Account ID` (z adresu URL panelu) -> `CLOUDFLARE_R2_ACCOUNT_ID`

---

## 3. RevenueCat (In-App Purchases na iOS i Android)

1. **Utwórz Projekt w RevenueCat:**
   - Zaloguj się na [app.revenuecat.com](https://app.revenuecat.com) i utwórz projekt `LearnEng`.
2. **Dodaj Aplikacje (Apps):**
   - **Apple App Store:** Dodaj aplikację iOS, podaj Bundle ID (`com.softileo.learneng`) oraz klucz p8 App Store Connect API.
   - **Google Play:** Dodaj aplikację Android, podaj Package Name (`com.softileo.learneng`) oraz konto serwisowe Google Cloud z uprawnieniem do subskrypcji.
3. **Skonfiguruj Entitlements & Offerings:**
   - **Entitlement Identifier:** `pro_access` (unlocked by Pro and Master).
   - **Entitlement Identifier:** `master_access` (unlocked only by Master).
   - **Products (Produkty w App Store Connect & Google Play Console):**
     - `learneng_pro_monthly` ($8.99/mo, 3-day free trial)
     - `learneng_master_monthly` ($16.99/mo, 3-day free trial)
   - **Offering:** `default` (zawierający 2 powyższe pakiety miesięczne).
4. **Pobierz Klucze Publiczne API:**
   - W **Project Settings -> API Keys**:
     - Skopiuj klucz iOS (`appl_*`) -> `EXPO_PUBLIC_RC_IOS_KEY`.
     - Skopiuj klucz Android (`goog_*`) -> `EXPO_PUBLIC_RC_ANDROID_KEY`.
5. **Skonfiguruj Webhook:**
   - W **Integrations -> Webhooks**:
     - Endpoint URL: `https://api.applearneng.com/api/v1/revenuecat/webhook`
     - Authorization Header: `Bearer <TWÓJ_WYGENEROWANY_SEKRET>` -> `REVENUECAT_WEBHOOK_AUTH_HEADER` w backendzie.

---

## 4. Google AI Studio (Gemini 2.5 Lite)

1. Wejdź na [aistudio.google.com](https://aistudio.google.com).
2. Wygeneruj klucz API z dostępem do modelu `gemini-2.5-flash-lite`.
3. Zapisz klucz do `GEMINI_API_KEY` w backendzie.

---

## 5. Hosting Backend Hono na Bun (Fly.io / Render / Railway)

### Opcja Rekomendowana: Fly.io (Darmowy Tier 3 maszyn)
1. Zainstaluj CLI: `brew install flyctl`.
2. Zaloguj się: `fly auth login`.
3. W katalogu `apps/backend` uruchom: `fly launch --no-deploy`.
4. Ustaw zmienne środowiskowe:
   ```bash
   fly secrets set \
     GEMINI_API_KEY="AIza..." \
     SUPABASE_URL="https://xyz.supabase.co" \
     SUPABASE_SERVICE_ROLE_KEY="ey..." \
     CLOUDFLARE_R2_ACCOUNT_ID="..." \
     CLOUDFLARE_R2_ACCESS_KEY_ID="..." \
     CLOUDFLARE_R2_SECRET_ACCESS_KEY="..." \
     CLOUDFLARE_R2_BUCKET_NAME="learneng-cache" \
     REVENUECAT_WEBHOOK_AUTH_HEADER="Bearer rc_webhook_secret_..."
   ```
5. Wdróż aplikację: `fly deploy`.
6. Pobierz URL wdrożenia (np. `https://learneng-api.fly.dev`) i ustaw w aplikacji mobilnej jako `EXPO_PUBLIC_API_URL`.

---

## 6. Expo Application Services (EAS Build)

1. Zainstaluj EAS CLI: `npm install -g eas-cli`.
2. Zaloguj się: `eas login`.
3. W katalogu `apps/mobile` zainicjalizuj projekt: `eas init`.
4. Ustaw zmienne środowiskowe w chmurze Expo:
   ```bash
   eas secret:create --name EXPO_PUBLIC_API_URL --value "https://learneng-api.fly.dev"
   eas secret:create --name EXPO_PUBLIC_R2_URL --value "https://cache.applearneng.com"
   eas secret:create --name EXPO_PUBLIC_SUPABASE_URL --value "https://xyz.supabase.co"
   eas secret:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "ey..."
   eas secret:create --name EXPO_PUBLIC_RC_IOS_KEY --value "appl_..."
   eas secret:create --name EXPO_PUBLIC_RC_ANDROID_KEY --value "goog_..."
   ```
5. Zbuduj wersję preview lub production:
   - iOS Simulator: `eas build --profile preview --platform ios`
   - Android APK: `eas build --profile preview --platform android`
