# AGENTS.md — Global Context & Instructions for AI Agents (Cursor, Claude Code, Windsurf)

## 🛑 LAW #1: IMMUTABILITY OF PASSING TESTS (TEST-DRIVEN STAGE-GATED PROTOCOL)
1. **Never Modify Green Tests:** Once a unit or integration test has passed (GREEN), you are **STRICTLY FORBIDDEN from modifying, dumbing down, commenting out, or deleting that test**.
2. **Regression Rule:** If a new feature or stage causes an existing test to fail, you MUST fix your implementation code. You must NEVER rewrite the test to fit broken code.
3. **Stage Gates:** You must build and verify the application stage-by-stage as specified in `STAGE_GATES_AND_TESTS.md`. You CANNOT proceed to Stage $N+1$ until Stage $N$ tests are 100% passing (`bun test`).

---

## 📌 Project Overview
**LearnEng** is a cross-platform mobile application (iOS & Android) and SaaS platform for learning English through YouTube videos with interactive, real-time synchronized subtitles.
- Clicking any word or phrase pauses the video and opens a translation bottom-sheet.
- Translations are generated via **Google Gemini 2.5 Lite** with structured JSON output (pronunciation audio, IPA, simple definition, contextual translation, "Explain in context" toggle).
- **Cost Optimization Invariant:** Translations are cached as static JSON in the root directory of **Cloudflare R2** (`/{hash}.json`). The mobile app performs a direct `GET` to the public Cloudflare R2 CDN link *before* contacting the backend.
- Users can save single words or entire sentences directly into flashcards.
- **Tinder-Style 4-Way Swipe Flashcards:** Fiszki działają jak stos kart w Tinderze z gestami w 4 kierunkach (Lewo = Powtórz, Prawo = Dobrze, Góra = Łatwe, Dół = Trudne) oraz obrotem 3D na tapnięcie.
- **Multi-Currency Monetization:** **Stripe** with 3 monthly subscription tiers (Starter, Pro, Master), each with a **3-day free trial**. Localized payment methods: BLIK and PLN in Poland, SEPA/Giropay and EUR in DACH/EU, USD globally.

---

## 🏗️ Repository Architecture (Monorepo)
```
/
├── apps/
│   ├── mobile/         # Cross-platform Mobile App (React Native with Expo & TypeScript)
│   └── backend/        # SaaS API & Fallback Service (Bun/Node.js + Hono + TypeScript)
├── packages/
│   └── shared/         # Shared TypeScript interfaces, Zod schemas, hash helpers, SRS logic
├── docs/               # Architecture and technical specs (all *.md files)
└── .cursorrules / AGENTS.md
```

---

## 🛡️ Critical Technical Invariants (NEVER VIOLATE)

1. **R2 Public Edge Cache First:**
   - On word/sentence tap, mobile app calculates:
     `hash = sha256(word.trim().toLowerCase() + "_" + sentence.trim().toLowerCase() + "_" + targetLang.toLowerCase())`
   - Mobile app MUST first execute: `GET ${PUBLIC_R2_URL}/${hash}.json`.
   - ONLY on HTTP 404 does the mobile app call `POST /api/v1/translate` on the backend.
   - The backend translates with Gemini 2.5 Lite, uploads `/{hash}.json` to Cloudflare R2 root bucket, and returns it.

2. **No Secret Keys in Mobile App:**
   - `GEMINI_API_KEY`, `CLOUDFLARE_R2_SECRET_ACCESS_KEY`, and `STRIPE_SECRET_KEY` MUST NEVER be bundled in the mobile app. They reside strictly on `apps/backend`.

3. **Subtitles & Video UX Rules:**
   - Video MUST pause automatically when a user taps a word/phrase.
   - Subtitles are rendered natively under or overlaid on the player; never block native YouTube player controls (compliance with YouTube ToS).
   - Video resumes when the bottom-sheet is dismissed (configurable by user setting).

4. **Tinder-Style 4-Way Swipe Deck & Flashcards:**
   - Both individual words AND full sentences can be saved to flashcards.
   - Flashcards review deck uses a Tinder-style stack with 4 gesture directions mapped to SM-2: Left (Again), Down (Hard), Right (Good), Up (Easy). Tap flips the card in 3D.

5. **Stripe Subscriptions & Multi-Currency:**
   - 3 Tiers: Starter, Pro, Master.
   - Monthly billing only.
   - Always 3-day free trial (`trial_period_days: 3`).
   - Local currencies: PLN (BLIK), EUR (SEPA), USD.

---

## 💻 Code Style & Conventions

- **Language:** TypeScript 5.x throughout the entire stack.
- **Strictness:** `"strict": true`, `"noImplicitAny": true`. Never use `any` — use `unknown` with Zod validation or proper generics.
- **Frameworks:**
  - Mobile: Expo (React Native), `react-native-reanimated` (v3), `react-native-gesture-handler`, `react-native-youtube-iframe`, `zustand` for client state, `@tanstack/react-query` for server state, NativeWind / Tailwind CSS.
  - Backend: `Hono` on Bun or Node.js, `@google/genai` (official Google GenAI SDK), `@aws-sdk/client-s3` (for Cloudflare R2 S3-compatible API).
- **File Organization:** Feature-first organization (`features/player`, `features/flashcards`, `features/subscriptions`).
- **Imports:** Absolute path aliases (e.g. `@/components`, `@/features`, `@learneng/shared`).
