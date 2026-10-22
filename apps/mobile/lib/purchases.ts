import { Platform } from 'react-native';
import type { PurchasesPackage, CustomerInfo } from 'react-native-purchases';

const REVENUECAT_API_KEY_IOS = process.env.EXPO_PUBLIC_RC_IOS_KEY || '';
const REVENUECAT_API_KEY_ANDROID = process.env.EXPO_PUBLIC_RC_ANDROID_KEY || '';

async function getPurchasesModule() {
  if (Platform.OS === 'web') return null;
  try {
    const mod = await import('react-native-purchases');
    return mod.default;
  } catch {
    return null;
  }
}

export async function initPurchases(userId?: string): Promise<void> {
  if (Platform.OS === 'web') return;
  const apiKey = Platform.OS === 'ios' ? REVENUECAT_API_KEY_IOS : REVENUECAT_API_KEY_ANDROID;
  if (!apiKey || apiKey.startsWith('appl_...') || apiKey.startsWith('goog_...')) {
    return;
  }

  try {
    const Purchases = await getPurchasesModule();
    if (!Purchases) return;
    Purchases.configure({
      apiKey,
      appUserID: userId || undefined,
    });
  } catch (err) {
    console.warn('RevenueCat init skipped:', err);
  }
}

export async function fetchOfferings(): Promise<PurchasesPackage[]> {
  if (Platform.OS === 'web') return [];
  const apiKey = Platform.OS === 'ios' ? REVENUECAT_API_KEY_IOS : REVENUECAT_API_KEY_ANDROID;
  if (!apiKey || apiKey.startsWith('appl_...') || apiKey.startsWith('goog_...')) {
    return [];
  }

  try {
    const Purchases = await getPurchasesModule();
    if (!Purchases) return [];
    const offerings = await Purchases.getOfferings();
    if (offerings.current && offerings.current.availablePackages.length > 0) {
      return offerings.current.availablePackages;
    }
    return [];
  } catch {
    return [];
  }
}

export async function purchasePackage(
  pkg: PurchasesPackage
): Promise<{ customerInfo: CustomerInfo; success: boolean }> {
  try {
    const Purchases = await getPurchasesModule();
    if (!Purchases) return { customerInfo: {} as CustomerInfo, success: false };
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    const hasPro = Boolean(customerInfo.entitlements.active['pro_access']);
    return { customerInfo, success: hasPro };
  } catch (err: any) {
    if (!err?.userCancelled) {
      console.error('Purchase error:', err);
    }
    return { customerInfo: {} as CustomerInfo, success: false };
  }
}

export async function restoreUserPurchases(): Promise<boolean> {
  try {
    const Purchases = await getPurchasesModule();
    if (!Purchases) return false;
    const customerInfo = await Purchases.restorePurchases();
    return Boolean(customerInfo.entitlements.active['pro_access']);
  } catch {
    return false;
  }
}
