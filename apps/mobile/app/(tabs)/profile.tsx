import React, { useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  BookOpen,
  Clock,
  Crown,
  Fire,
  SignOut,
  Trash,
  UserCircle,
} from 'phosphor-react-native';
import { deleteUserAccount } from '@/lib/account';
import { setDemoModeSession } from '@/lib/auth';
import { restoreUserPurchases } from '@/lib/purchases';
import { supabase } from '@/lib/supabase';
import { usePlayerStore } from '@/stores/usePlayerStore';

export default function ProfileScreen() {
  const router = useRouter();
  const { autoResumeOnSheetClose, setAutoResumeOnSheetClose, accent, setAccent } = usePlayerStore();

  const [email, setEmail] = useState<string>('learner@learneng.app');
  const [planTier, setPlanTier] = useState<'free' | 'pro' | 'master'>('free');
  const [remainingQuota, setRemainingQuota] = useState<number>(15);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      if (user.email) setEmail(user.email);

      const { data: sub } = await supabase
        .from('user_subscriptions')
        .select('plan_tier, status')
        .eq('user_id', user.id)
        .single();

      if (sub && (sub.status === 'active' || sub.status === 'trialing')) {
        setPlanTier((sub.plan_tier as 'pro' | 'master') || 'free');
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('daily_ai_requests_count')
        .eq('id', user.id)
        .single();

      if (profile && typeof profile.daily_ai_requests_count === 'number') {
        setRemainingQuota(Math.max(0, 30 - profile.daily_ai_requests_count));
      }
    });
  }, []);

  const handleRestorePurchases = async () => {
    const restored = await restoreUserPurchases();
    if (restored) {
      setPlanTier('pro');
      Alert.alert('Success', 'Purchases successfully restored!');
    } else {
      Alert.alert('Restore Purchases', 'No active subscription found for this account.');
    }
  };

  const handleManageSubscription = () => {
    const url =
      Platform.OS === 'ios'
        ? 'https://apps.apple.com/account/subscriptions'
        : 'https://play.google.com/store/account/subscriptions';
    Linking.openURL(url).catch(() => {});
  };

  const handleSignOut = async () => {
    setDemoModeSession(false);
    await supabase.auth.signOut().catch(() => {});
    router.replace('/(auth)/login');
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to permanently delete your account and all flashcards? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteUserAccount();
              router.replace('/(auth)/login');
            } catch {
              Alert.alert('Error', 'Could not delete account. Please try again.');
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView className="flex-1 bg-[#0B0F19] pt-14 px-5 pb-28">
      {/* 1. User Header */}
      <View className="flex-row items-center bg-[#161F30] p-4 rounded-2xl border border-slate-800 mb-5">
        <View className="w-14 h-14 rounded-full bg-indigo-600/20 border border-indigo-500/40 items-center justify-center mr-4">
          <UserCircle size={36} color="#38BDF8" weight="fill" />
        </View>
        <View className="flex-1">
          <Text className="text-white font-bold text-base">{email}</Text>
          <View className="self-start bg-indigo-950/80 px-2.5 py-0.5 rounded-md border border-indigo-500/40 mt-1.5">
            <Text className="text-indigo-300 text-xs font-bold">B1 Intermediate</Text>
          </View>
        </View>
      </View>

      {/* 2. Learning Statistics Cards (3 Columns) */}
      <View className="flex-row justify-between mb-5 space-x-2.5">
        <View className="flex-1 bg-[#161F30] p-3.5 rounded-2xl border border-slate-800 items-center mr-2">
          <BookOpen size={22} color="#38BDF8" weight="fill" />
          <Text className="text-white font-extrabold text-lg mt-1.5">142</Text>
          <Text className="text-slate-400 text-[11px]">Learned Words</Text>
        </View>

        <View className="flex-1 bg-[#161F30] p-3.5 rounded-2xl border border-slate-800 items-center mr-2">
          <Fire size={22} color="#F59E0B" weight="fill" />
          <Text className="text-white font-extrabold text-lg mt-1.5">7 Days</Text>
          <Text className="text-slate-400 text-[11px]">Current Streak</Text>
        </View>

        <View className="flex-1 bg-[#161F30] p-3.5 rounded-2xl border border-slate-800 items-center">
          <Clock size={22} color="#10B981" weight="fill" />
          <Text className="text-white font-extrabold text-lg mt-1.5">4.2 hrs</Text>
          <Text className="text-slate-400 text-[11px]">Study Time</Text>
        </View>
      </View>

      {/* 3. Subscription Status Card */}
      <View className="bg-[#161F30] p-4 rounded-2xl border border-slate-800 mb-5">
        <View className="flex-row items-center mb-2">
          <Crown size={20} color="#FACC15" weight="fill" />
          <Text className="text-white font-bold text-base ml-2">
            {planTier === 'free'
              ? `Plan: Free (${remainingQuota}/30 daily AI requests remaining)`
              : `Plan: ${planTier === 'master' ? 'Master' : 'Pro'} (Active)`}
          </Text>
        </View>

        {planTier === 'free' ? (
          <Pressable
            onPress={() => router.push('/(modals)/paywall')}
            className="w-full py-3.5 rounded-xl bg-indigo-600 active:bg-indigo-700 items-center mt-2"
          >
            <Text className="text-white font-bold text-sm">Upgrade to Pro (3 Days Free)</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={handleManageSubscription}
            className="w-full py-3.5 rounded-xl bg-slate-800 border border-slate-700 items-center mt-2"
          >
            <Text className="text-white font-semibold text-sm">Manage Subscription</Text>
          </Pressable>
        )}

        <Pressable onPress={handleRestorePurchases} className="items-center mt-3 py-1">
          <Text className="text-sky-400 text-xs font-semibold">Restore Purchases</Text>
        </Pressable>
      </View>

      {/* 4. Preferences & Danger Zone */}
      <View className="bg-[#161F30] p-4 rounded-2xl border border-slate-800 mb-10">
        <View className="flex-row items-center justify-between py-2 border-b border-slate-800">
          <Text className="text-slate-200 text-sm font-medium flex-1 mr-3">
            Auto-resume video after closing translation
          </Text>
          <Switch
            value={autoResumeOnSheetClose}
            onValueChange={setAutoResumeOnSheetClose}
            trackColor={{ false: '#334155', true: '#6366F1' }}
          />
        </View>

        <View className="flex-row items-center justify-between py-3 border-b border-slate-800">
          <Text className="text-slate-200 text-sm font-medium">Pronunciation Accent</Text>
          <View className="flex-row bg-slate-800 rounded-lg p-1">
            {(['en-US', 'en-GB'] as const).map((code) => (
              <Pressable
                key={code}
                onPress={() => setAccent(code)}
                className={`px-3 py-1 rounded-md ${
                  accent === code ? 'bg-indigo-600' : 'bg-transparent'
                }`}
              >
                <Text className="text-white text-xs font-semibold">{code}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Pressable
          onPress={handleSignOut}
          className="flex-row items-center justify-center py-3.5 rounded-xl bg-slate-800 border border-slate-700 mt-4"
        >
          <SignOut size={18} color="#94A3B8" weight="regular" />
          <Text className="text-slate-200 font-semibold text-sm ml-2">Sign Out</Text>
        </Pressable>

        <Pressable
          onPress={handleDeleteAccount}
          className="flex-row items-center justify-center py-3.5 rounded-xl bg-rose-950/50 border border-rose-500/40 mt-3"
        >
          <Trash size={18} color="#EF4444" weight="fill" />
          <Text className="text-rose-400 font-bold text-sm ml-2">Delete Account</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
