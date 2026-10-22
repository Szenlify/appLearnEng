-- ==============================================================================
-- LearnEng Database Schema (PostgreSQL / Supabase)
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. PROFILES TABLE (Tied to Supabase Auth auth.users)
-- ------------------------------------------------------------------------------
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    avatar_url TEXT,
    native_language VARCHAR(10) NOT NULL DEFAULT 'en', -- default learning/translation target
    preferred_currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    
    -- Learning stats
    words_learned_count INT DEFAULT 0,
    current_streak_days INT DEFAULT 0,
    last_study_date DATE,
    total_study_minutes INT DEFAULT 0,
    cefr_level VARCHAR(5) DEFAULT 'B1',

    -- AI translation quotas
    daily_ai_requests_count INT DEFAULT 0,
    last_request_reset_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 2. SUBSCRIPTIONS TABLE (RevenueCat In-App Purchases Synchronization)
-- ------------------------------------------------------------------------------
CREATE TABLE public.user_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
    revenuecat_app_user_id VARCHAR(255) UNIQUE,
    original_app_user_id VARCHAR(255),
    plan_tier VARCHAR(30) NOT NULL DEFAULT 'free', -- 'free', 'pro', 'master'
    store VARCHAR(50), -- 'app_store', 'play_store', 'promotional'
    status VARCHAR(50) NOT NULL DEFAULT 'inactive', -- 'trialing', 'active', 'past_due', 'canceled'
    active_entitlement VARCHAR(100), -- e.g. 'pro_access', 'master_access'
    product_identifier VARCHAR(255),
    trial_start TIMESTAMP WITH TIME ZONE,
    trial_end TIMESTAMP WITH TIME ZONE,
    current_period_start TIMESTAMP WITH TIME ZONE,
    current_period_end TIMESTAMP WITH TIME ZONE,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 3. FLASHCARDS TABLE (Words & Sentences with SRS Data)
-- ------------------------------------------------------------------------------
CREATE TABLE public.user_flashcards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL DEFAULT 'word', -- 'word' OR 'sentence'
    target_text TEXT NOT NULL,                 -- English word/phrase OR full English sentence
    translation TEXT NOT NULL,                -- Definition or translation
    simple_definition TEXT,                   -- Simple definition
    context_sentence TEXT,                    -- Source sentence from video (for type='word')
    context_explanation TEXT,                 -- "Explain in context" details
    lemma VARCHAR(100),                       -- Base dictionary form
    part_of_speech VARCHAR(50),               -- e.g. "phrasal verb", "idiom"
    ipa VARCHAR(100),                         -- e.g. "/ˌpʊt ʌp ˈwɪð/"
    cefr_level VARCHAR(5),                    -- 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'
    r2_cache_hash VARCHAR(64),                -- SHA-256 hash in Cloudflare R2
    video_id VARCHAR(50),                     -- YouTube Video ID
    video_timestamp_sec NUMERIC(8, 2),        -- Video playback moment (float support)
    
    -- SM-2 Algorithm State
    repetitions INT NOT NULL DEFAULT 0,
    interval_days INT NOT NULL DEFAULT 1,
    ease_factor NUMERIC(4, 2) NOT NULL DEFAULT 2.50,
    next_review_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_flashcards_user_due ON public.user_flashcards(user_id, next_review_at);

-- ------------------------------------------------------------------------------
-- 4. VIDEO WATCH HISTORY
-- ------------------------------------------------------------------------------
CREATE TABLE public.user_watch_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    video_id VARCHAR(50) NOT NULL,
    video_title VARCHAR(255),
    thumbnail_url TEXT,
    last_position_sec NUMERIC(8, 2) DEFAULT 0,
    duration_sec INT DEFAULT 0,
    last_watched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, video_id)
);

-- ------------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_flashcards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_watch_history ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can read and update their own profile
CREATE POLICY "Users can read own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- Flashcards: Users have full CRUD over their own flashcards
CREATE POLICY "Users manage own flashcards" ON public.user_flashcards
    FOR ALL USING (auth.uid() = user_id);

-- Watch History: Users manage own watch history
CREATE POLICY "Users manage own watch history" ON public.user_watch_history
    FOR ALL USING (auth.uid() = user_id);

-- Subscriptions: Read-only for users; backend service role handles writes
CREATE POLICY "Users can read own subscription" ON public.user_subscriptions
    FOR SELECT USING (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- 6. AUTOMATIC PROFILE CREATION TRIGGER
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, avatar_url, native_language, preferred_currency)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'avatar_url',
        COALESCE(NEW.raw_user_meta_data->>'native_language', 'en'),
        COALESCE(NEW.raw_user_meta_data->>'preferred_currency', 'USD')
    );
    
    INSERT INTO public.user_subscriptions (user_id, plan_tier, status, revenuecat_app_user_id)
    VALUES (NEW.id, 'free', 'inactive', NEW.id::text);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
