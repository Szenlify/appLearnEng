# 04. SaaS Business Model, In-App Purchases (RevenueCat) & Subscription Tiers

## 1. Native Mobile Monetization: RevenueCat (In-App Purchases)

LearnEng uses **RevenueCat (`react-native-purchases`)** for cross-platform In-App Purchases:
- **100% Apple & Google Play Guideline Compliant:** Uses native Apple StoreKit 2 and Google Play Billing. No external Stripe checkouts that could lead to App Store rejection (App Store Guideline 3.1.1).
- **Zero Cost for Startups:** RevenueCat is free up to $2,500/month in tracked revenue.
- **Unified Cross-Platform Entitlements:** A user subscribing on iOS can restore purchases on Android and vice-versa by binding the subscription to their Supabase user UUID (`appUserID: user.id`).
- **3-Day Free Trial:** Offered on all subscription tiers directly within the native App Store / Google Play purchase sheet.

---

## 2. Subscription Tiers (Harmonized & Non-Contradictory Matrix)

Every plan is billed monthly and includes a **3-Day Free Trial**:

| Tier | Price (Default USD) | AI Translation Quota | "Explain in Context" (Idioms/Slang) | Flashcards & Offline | Anki / CSV Export |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 🆓 **Free** | **$0.00** | **30 new AI lookups / 24h**<br>*(R2 cache hits always unlimited & free)* | Basic definition & translation only | Up to 50 cards, local SQLite only | ❌ |
| 🥈 **Pro**<br>*(Bestseller)* | **$8.99 / mo**<br>*(3-day free trial)* | **Unlimited new AI lookups**<br>*(no daily or monthly limit)* | Full cultural, idiom, phrasal verb & emotional breakdown | Unlimited cards, full offline SRS, audio speed stepping (0.25x–2.00x) | ❌ |
| 🥇 **Master** | **$16.99 / mo**<br>*(3-day free trial)* | **Unlimited new AI lookups** | Full breakdown + alternative examples | Unlimited cards, full offline SRS, audio speed stepping | ✅ Full export to Anki (.apkg/CSV) |

> [!NOTE]
> **Static Public R2 Cache Hit Rule:** Whenever a tapped word or sentence has already been translated by any user, its JSON is served from Cloudflare R2 CDN (`/{hash}.json`). **R2 cache hits DO NOT consume any user quotas on any plan.** Only when a translation misses cache and invokes Google Gemini 2.5 Flash-Lite does the quota apply.

---

## 3. RevenueCat Entitlements & Product IDs

In the RevenueCat dashboard, configure an **Offering** named `default` with packages:

- **Entitlement ID:** `pro_access` (unlocked by Pro and Master)
- **Entitlement ID:** `master_access` (unlocked only by Master)

### Product Identifiers:
- iOS:
  - `learneng_pro_monthly` ($8.99, 3-day trial)
  - `learneng_master_monthly` ($16.99, 3-day trial)
- Android:
  - `learneng_pro_monthly:monthly-pro-trial`
  - `learneng_master_monthly:monthly-master-trial`

---

## 4. Mobile Client Implementation (`apps/mobile/lib/purchases.ts`)

```typescript
import { Platform } from 'react-native';
import Purchases, { PurchasesPackage, CustomerInfo } from 'react-native-purchases';

const REVENUECAT_API_KEY_IOS = process.env.EXPO_PUBLIC_RC_IOS_KEY || '';
const REVENUECAT_API_KEY_ANDROID = process.env.EXPO_PUBLIC_RC_ANDROID_KEY || '';

export async function initPurchases(userId?: string): Promise<void> {
  const apiKey = Platform.OS === 'ios' ? REVENUECAT_API_KEY_IOS : REVENUECAT_API_KEY_ANDROID;
  if (!apiKey) {
    console.warn('RevenueCat API key missing');
    return;
  }

  Purchases.configure({
    apiKey,
    appUserID: userId || undefined,
  });
}

export async function fetchOfferings(): Promise<PurchasesPackage[]> {
  try {
    const offerings = await Purchases.getOfferings();
    if (offerings.current && offerings.current.availablePackages.length > 0) {
      return offerings.current.availablePackages;
    }
    return [];
  } catch (err) {
    console.error('Error fetching RevenueCat offerings:', err);
    return [];
  }
}

export async function purchasePackage(pkg: PurchasesPackage): Promise<{ customerInfo: CustomerInfo; success: boolean }> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    const hasPro = Boolean(customerInfo.entitlements.active['pro_access']);
    return { customerInfo, success: hasPro };
  } catch (err: any) {
    if (!err.userCancelled) {
      console.error('Purchase error:', err);
    }
    return { customerInfo: {} as CustomerInfo, success: false };
  }
}

export async function restoreUserPurchases(): Promise<boolean> {
  try {
    const customerInfo = await Purchases.restorePurchases();
    return Boolean(customerInfo.entitlements.active['pro_access']);
  } catch (err) {
    console.error('Restore error:', err);
    return false;
  }
}
```

---

## 5. Backend RevenueCat Webhook Handler (`apps/backend/src/routes/revenuecat.routes.ts`)

RevenueCat sends webhooks for subscription events (`INITIAL_PURCHASE`, `RENEWAL`, `CANCELLATION`, `EXPIRATION`). The backend listens to these events and synchronizes `public.user_subscriptions` in Supabase:

```typescript
import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';

export const revenueCatRoutes = new Hono();

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

revenueCatRoutes.post('/api/v1/revenuecat/webhook', async (c) => {
  const authHeader = c.req.header('Authorization');
  const expectedAuth = process.env.REVENUECAT_WEBHOOK_AUTH_HEADER;

  // Verify webhook authorization header configured in RevenueCat dashboard
  if (expectedAuth && authHeader !== expectedAuth) {
    return c.json({ error: 'Unauthorized webhook' }, 401);
  }

  const body = await c.req.json().catch(() => ({}));
  const event = body.event;
  if (!event) return c.json({ received: false }, 400);

  const userId = event.app_user_id;
  const eventType = event.type; // INITIAL_PURCHASE, RENEWAL, CANCELLATION, EXPIRATION
  const productId = event.product_id || '';

  // Determine plan tier from product ID
  let planTier: 'free' | 'pro' | 'master' = 'free';
  if (productId.includes('master')) planTier = 'master';
  else if (productId.includes('pro')) planTier = 'pro';

  let status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'inactive' = 'inactive';
  if (eventType === 'INITIAL_PURCHASE' || eventType === 'RENEWAL') {
    status = event.period_type === 'TRIAL' ? 'trialing' : 'active';
  } else if (eventType === 'CANCELLATION') {
    status = 'canceled';
  } else if (eventType === 'EXPIRATION') {
    status = 'inactive';
    planTier = 'free';
  }

  // Update Supabase user_subscriptions table
  if (userId && userId.length === 36) { // check valid UUID
    await supabaseAdmin
      .from('user_subscriptions')
      .upsert(
        {
          user_id: userId,
          revenuecat_app_user_id: userId,
          plan_tier: planTier,
          status,
          product_identifier: productId,
          current_period_start: event.purchased_at_ms ? new Date(event.purchased_at_ms).toISOString() : null,
          current_period_end: event.expiration_at_ms ? new Date(event.expiration_at_ms).toISOString() : null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );
  }

  return c.json({ received: true });
});
```
