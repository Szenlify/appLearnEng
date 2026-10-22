# AGENTS.md — Global Context & Instructions for AI Agents (Cursor, Claude Code, Windsurf)

## 🛑 Test-Driven Stage-Gated Workflow
1. **Immutable Green Tests:** Once a test passes, do not modify or delete it. If changes cause failures, fix the implementation code, not the test assertions.
2. **Stage Gates:** Complete each stage in `STAGE_GATES_AND_TESTS.md` with 100% passing tests before moving to the next.

---

## 📌 Project Overview
**LearnEng** is a cross-platform mobile application (iOS & Android) and SaaS platform for learning English through YouTube videos with interactive, real-time synchronized subtitles.
- Clicking any word or phrase pauses the video and opens a translation bottom-sheet.
- Translations are generated via **Google Gemini 2.5 Lite** with structured JSON output (pronunciation IPA, simple definition, contextual translation, "Explain in context" toggle).
- **TTS:** Pronunciation audio is handled directly on-device using **`expo-speech`** (0ms latency, zero server cost, fully offline).
- **Cost Optimization Invariant:** Translations are cached as static JSON in the root directory of **Cloudflare R2** (`/{hash}.json`). The mobile app performs a direct `GET` to the public Cloudflare R2 CDN link *before* contacting the backend.
- Users can save single words or entire sentences directly into flashcards.
- **Tinder-Style 4-Way Swipe Flashcards:** Fiszki działają jak stos kart w Tinderze z gestami w 4 kierunkach (Lewo = Powtórz, Prawo = Dobrze, Góra = Łatwe, Dół = Trudne) oraz obrotem 3D na tapnięcie.
- **Multi-Currency Monetization (Default USD):** **Stripe** with 3 monthly subscription tiers (Starter $4.99, Pro $8.99, Master $16.99 in default USD), each with a **3-day free trial**. Dynamic localization: PLN (with BLIK) in Poland, EUR in the Eurozone, USD globally.

---

## 🗄️ Database & Cost Optimization
1. **PostgreSQL on Supabase:**
   - Host profiles, subscriptions, and flashcard SRS intervals.
   - Always connect via Transaction Pooler / PgBouncer (`port 6543`).
2. **Zero Database Load for Translations:**
   - Word definitions and translations are served directly from Cloudflare R2 CDN (`/{hash}.json`), saving >90% of database reads.
3. **Flashcard Swipe Batching (Debounce Sync):**
   - Swiping flashcards updates local state (`expo-sqlite`) immediately. Database sync is batched into a single `upsert`.
4. **Composite Indexes & Cursor Pagination:**
   - Query flashcards with `idx_flashcards_user_due` `(user_id, next_review_at)`.
   - Cursor-based pagination `WHERE last_watched_at < $cursor LIMIT 20`.

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
└── .cursorrules / AGENTS.md (Ref: MOBILE_SCREENS_SPEC.md, OFFLINE_SQLITE_AND_SYNC.md, MOBILE_BOOTSTRAP_AND_CONFIG.md, STATE_MANAGEMENT.md, EDGE_CASES_AND_ERRORS.md, COMPONENT_SPECS.md, DEPLOYMENT_AND_EAS.md)
```

---

## 🛡️ Key Technical Directives

1. **R2 Public Edge Cache First:**
   - On word/sentence tap, mobile app calculates:
     `hash = sha256(word.trim().toLowerCase() + "_" + sentence.trim().toLowerCase() + "_" + targetLang.toLowerCase())`
   - Mobile app executes: `GET ${PUBLIC_R2_URL}/${hash}.json`.
   - On HTTP 404, mobile app calls `POST /api/v1/translate` on the backend.
   - Backend translates with Gemini 2.5 Lite, uploads `/{hash}.json` to Cloudflare R2 root bucket, and returns it.

2. **No Secret Keys in Mobile App:**
   - `GEMINI_API_KEY`, `CLOUDFLARE_R2_SECRET_ACCESS_KEY`, and `STRIPE_SECRET_KEY` reside strictly on `apps/backend`.

3. **Subtitles & Video UX Rules:**
   - Video pauses automatically when a user taps a word/phrase.
   - Subtitles do not block native YouTube player controls (compliance with YouTube ToS).
   - Video resumes when the bottom-sheet is dismissed (configurable by user setting).

4. **Tinder-Style 4-Way Swipe Deck & Flashcards:**
   - Both individual words and full sentences can be saved to flashcards.
   - Review deck uses a 4-way gesture stack mapped to SM-2: Left (Again), Down (Hard), Right (Good), Up (Easy). Tap flips the card in 3D.

5. **Stripe Subscriptions & Multi-Currency:**
   - 3 Tiers: Starter, Pro, Master (monthly billing with 3-day trial).
   - Local currencies: PLN (BLIK), EUR (SEPA), USD.

---

## 💻 Code Style & Conventions

- **Language:** TypeScript 5.x throughout the entire stack.
- **Strictness:** `"strict": true`, `"noImplicitAny": true`.
- **Frameworks:**
  - Mobile: Expo (React Native), `react-native-reanimated` (v3), `react-native-gesture-handler`, `expo-speech`, `react-native-youtube-iframe`, `zustand` for client state, `@tanstack/react-query` for server state, NativeWind / Tailwind CSS.
  - Backend: `Hono` on Bun or Node.js, `@google/genai`, `@aws-sdk/client-s3`.
- **File Organization:** Feature-first organization (`features/player`, `features/flashcards`, `features/subscriptions`).
- **Imports:** Absolute path aliases (e.g. `@/components`, `@/features`, `@learneng/shared`).
