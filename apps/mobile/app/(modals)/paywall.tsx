import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CheckCircle, Crown, Sparkle, XCircle } from 'phosphor-react-native';
import type { PurchasesPackage } from 'react-native-purchases';
import { fetchOfferings, purchasePackage, restoreUserPurchases } from '@/lib/purchases';

export default function PaywallModal() {
  const router = useRouter();
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [selectedTier, setSelectedTier] = useState<'pro' | 'master'>('pro');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    fetchOfferings().then((available) => {
      setPackages(available);
    });
  }, []);

  const handleSubscribe = async () => {
    setIsLoading(true);
    try {
      const targetPkg = packages.find((p) =>
        selectedTier === 'master'
          ? p.identifier.toLowerCase().includes('master')
          : p.identifier.toLowerCase().includes('pro')
      );

      if (targetPkg) {
        const { success } = await purchasePackage(targetPkg);
        if (success) {
          router.back();
        }
      } else {
        Alert.alert(
          '3-Day Free Trial',
          `Selected ${selectedTier === 'pro' ? 'Pro ($8.99/mo)' : 'Master ($16.99/mo)'} plan.`
        );
      }
    } catch {
      Alert.alert(
        'Purchase Error',
        'Purchase could not be completed. Please check your payment method in App Store / Google Play.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async () => {
    setIsLoading(true);
    try {
      const restored = await restoreUserPurchases();
      if (restored) {
        Alert.alert('Success', 'Purchases successfully restored!');
        router.back();
      } else {
        Alert.alert('Restore Purchases', 'No active subscription found for this account.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-[#0B0F19] pt-12 px-6 pb-12">
      {/* Close button */}
      <View className="flex-row justify-end mb-2">
        <Pressable onPress={() => router.back()} className="p-1">
          {({ pressed }) => (
            <XCircle
              size={28}
              color={pressed ? '#38BDF8' : '#94A3B8'}
              weight={pressed ? 'fill' : 'regular'}
            />
          )}
        </Pressable>
      </View>

      {/* 1. Hero Header */}
      <View className="items-center mb-6">
        <View className="w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 items-center justify-center mb-4">
          <Crown size={36} color="#FACC15" weight="fill" />
        </View>
        <Text className="text-2xl font-extrabold text-white text-center mb-2">
          Learn English from YouTube with Zero Limits
        </Text>
        <View className="bg-sky-500/15 border border-sky-400/40 px-3.5 py-1 rounded-full">
          <Text className="text-sky-300 text-xs font-bold">
            3 DAYS FREE TRIAL — Cancel anytime in 1 tap
          </Text>
        </View>
      </View>

      {/* 2. Tier Selection Cards */}
      {/* Pro ($8.99 / mo) [RECOMMENDED] */}
      <Pressable
        onPress={() => setSelectedTier('pro')}
        className={`p-5 rounded-2xl border-2 mb-4 ${
          selectedTier === 'pro'
            ? 'bg-[#161F30] border-sky-400'
            : 'bg-[#161F30]/60 border-slate-800'
        }`}
      >
        <View className="flex-row items-center justify-between mb-2">
          <View className="flex-row items-center">
            <Sparkle
              size={20}
              color={selectedTier === 'pro' ? '#38BDF8' : '#94A3B8'}
              weight={selectedTier === 'pro' ? 'fill' : 'regular'}
            />
            <Text className="text-white font-extrabold text-lg ml-2">Pro</Text>
            <View className="bg-sky-500 px-2 py-0.5 rounded-md ml-2.5">
              <Text className="text-slate-950 text-[10px] font-extrabold">RECOMMENDED</Text>
            </View>
          </View>
          <Text className="text-white font-extrabold text-lg">$8.99 / mo</Text>
        </View>

        <View className="space-y-1.5 mt-2">
          <View className="flex-row items-center">
            <CheckCircle size={16} color="#10B981" weight="fill" />
            <Text className="text-slate-300 text-xs ml-2">
              Unlimited AI lookups & deep context explanations (idioms, slang)
            </Text>
          </View>
          <View className="flex-row items-center mt-1">
            <CheckCircle size={16} color="#10B981" weight="fill" />
            <Text className="text-slate-300 text-xs ml-2">
              Smooth audio speed controls (0.25x–2.00x) & full offline SRS deck
            </Text>
          </View>
        </View>
      </Pressable>

      {/* Master ($16.99 / mo) */}
      <Pressable
        onPress={() => setSelectedTier('master')}
        className={`p-5 rounded-2xl border-2 mb-6 ${
          selectedTier === 'master'
            ? 'bg-[#161F30] border-indigo-400'
            : 'bg-[#161F30]/60 border-slate-800'
        }`}
      >
        <View className="flex-row items-center justify-between mb-2">
          <View className="flex-row items-center">
            <Crown
              size={20}
              color={selectedTier === 'master' ? '#FACC15' : '#94A3B8'}
              weight={selectedTier === 'master' ? 'fill' : 'regular'}
            />
            <Text className="text-white font-extrabold text-lg ml-2">Master</Text>
          </View>
          <Text className="text-white font-extrabold text-lg">$16.99 / mo</Text>
        </View>

        <View className="space-y-1.5 mt-2">
          <View className="flex-row items-center">
            <CheckCircle size={16} color="#10B981" weight="fill" />
            <Text className="text-slate-300 text-xs ml-2">
              All Pro features + Anki (.apkg / CSV) deck export
            </Text>
          </View>
        </View>
      </Pressable>

      {/* 3. CTA Button */}
      <Pressable
        onPress={handleSubscribe}
        disabled={isLoading}
        className="w-full py-4 rounded-2xl bg-indigo-600 active:bg-indigo-700 items-center shadow-lg shadow-indigo-600/30 mb-4"
      >
        {isLoading ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Text className="text-white font-extrabold text-base">Start 3-Day Free Trial</Text>
        )}
      </Pressable>

      {/* 4. Footer */}
      <View className="items-center mt-2">
        <Pressable onPress={handleRestore} className="py-2">
          <Text className="text-sky-400 font-semibold text-xs">Restore Purchases</Text>
        </Pressable>
        <Text className="text-slate-500 text-[11px] text-center mt-2">
          Terms of Service • Privacy Policy
        </Text>
      </View>
    </ScrollView>
  );
}
