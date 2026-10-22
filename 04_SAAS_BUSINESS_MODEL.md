# 04. Model Biznesowy SaaS, Subskrypcje i Płatności Globalne (Stripe)

## 1. Domyślna Waluta Globalna: Dolar Amerykański (USD)

LearnEng jest projektowany od pierwszego dnia jako **globalna aplikacja mobilna**. 
- **Domyślną walutą bazową (Default Base Currency) całego systemu jest USD ($)**.
- Wszystkie konta, raporty Stripe oraz standardowe cenniki operują na dolarach amerykańskich.
- Dla użytkowników z dedykowanych rynków lokalnych (np. Polska, kraje strefy Euro) Stripe dynamicznie prezentuje lokalną walutę i lokalne metody płatności.

---

## 2. Plany Subskrypcyjne (Miesięczne z 3 Dniowym Trialem)

Każdy plan rozliczany jest w cyklu miesięcznym i posiada **3-dniowy darmowy okres próbny (3-Day Free Trial)**:

| Plan | 🇺🇸 Domyślny Globalny (USD) | 🇪🇺 Strefa Euro (EUR) | 🇵🇱 Polska (PLN) | 🇯🇵 Japonia (JPY) |
| :--- | :--- | :--- | :--- | :--- |
| 🥉 **Starter** | **$4.99** / mo | **4,99 €** / msc | **19,99 PLN** / msc | **¥750** / mo |
| 🥈 **Pro** | **$8.99** / mo | **8,99 €** / msc | **39,99 PLN** / msc | **¥1 400** / mo |
| 🥇 **Master** | **$16.99** / mo | **15,99 €** / msc | **69,99 PLN** / msc | **¥2 500** / mo |
| **Okres próbny** | **3 dni za darmo** | **3 dni za darmo** | **3 dni za darmo** | **3 dni za darmo** |

*Wszyscy użytkownicy z krajów innych niż dedykowane rynki lokalne płacą w domyślnej walucie **USD**.*

---

## 3. Metody Płatności w Stripe (W tym BLIK dla Polski)

Stripe PaymentSheet / Checkout automatycznie dobiera metody płatności na podstawie kraju i waluty:

### 3.1 Global / USA (Domyślne — USD):
- Karty kredytowe i debetowe (Visa, Mastercard, Amex).
- Apple Pay oraz Google Pay (natywne płatności jednym tapnięciem).
- Stripe Link (błyskawiczny 1-click checkout).

### 3.2 Polska (Lokalizacja PLN):
- **BLIK:** Domyślna i preferowana metoda płatności dla polskich użytkowników (wpisanie 6-cyfrowego kodu w aplikacji lub przekierowanie do banku).
- **Przelewy24 (P24)** oraz karty i Apple/Google Pay.

### 3.3 Kraje Strefy Euro (Lokalizacja EUR):
- **SEPA Direct Debit** (popularne w Niemczech i Austrii).
- **iDEAL** (Holandia), **Bancontact** (Belgia), **Sofort / Giropay** (Niemcy).
- Karty oraz Apple/Google Pay.

### 3.4 Konfiguracja Sesji Checkout i Webhooków Stripe w Hono (`apps/backend/src/routes/stripe.routes.ts`):

> [!IMPORTANT]
> W środowisku **Bun** weryfikacja podpisu webhooka Stripe **musi** używać asynchronicznej metody `await stripe.webhooks.constructEventAsync(rawBody, sig, secret)` (synchroniczne `constructEvent` powoduje błąd SubtleCrypto w Bunie).

```typescript
import Stripe from 'stripe';
import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export type PlanTier = 'starter' | 'pro' | 'master';
export type SupportedCurrency = 'USD' | 'EUR' | 'PLN' | 'JPY';

export function getPaymentMethodsForCurrency(currency: SupportedCurrency): Stripe.Checkout.SessionCreateParams.PaymentMethodType[] {
  switch (currency.toUpperCase()) {
    case 'PLN':
      return ['card', 'blik', 'p24'];
    case 'EUR':
      return ['card', 'sepa_debit', 'ideal', 'bancontact'];
    case 'JPY':
      return ['card', 'konbini'];
    default:
      return ['card', 'link'];
  }
}

export async function createSubscriptionCheckout(params: {
  userId: string;
  email: string;
  tier: PlanTier;
  currency?: SupportedCurrency;
  priceId: string;
  appUrl: string;
}) {
  const currency = (params.currency || 'USD').toLowerCase();
  const paymentMethodTypes = getPaymentMethodsForCurrency((params.currency || 'USD') as SupportedCurrency);

  return stripe.checkout.sessions.create({
    customer_email: params.email,
    client_reference_id: params.userId,
    mode: 'subscription',
    currency,
    payment_method_types: paymentMethodTypes,
    subscription_data: {
      trial_period_days: 3, // 3-dniowy darmowy okres próbny dla każdego planu
      metadata: {
        userId: params.userId,
        planTier: params.tier,
      },
    },
     metadata: {
      userId: params.userId,
      planTier: params.tier,
      currency: currency.toUpperCase(),
    },
    line_items: [{ price: params.priceId, quantity: 1 }],
    success_url: `${params.appUrl}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${params.appUrl}/subscription/cancel`,
  });
}

export async function handleStripeWebhook(rawBody: string, signature: string) {
  const event = await stripe.webhooks.constructEventAsync(
    rawBody,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET!
  );

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.userId || session.client_reference_id;
    const planTier = session.metadata?.planTier || 'pro';
    const currency = session.metadata?.currency || 'USD';

    if (userId) {
      await supabaseAdmin
        .from('user_subscriptions')
        .upsert(
          {
            user_id: userId,
            stripe_customer_id: String(session.customer),
            stripe_subscription_id: String(session.subscription),
            plan_tier: planTier,
            currency,
            status: 'trialing',
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );
    }
  } else if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as Stripe.Subscription;
    await supabaseAdmin
      .from('user_subscriptions')
      .update({
        plan_tier: 'free',
        status: 'canceled',
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_subscription_id', sub.id);
  }

  return { received: true, type: event.type };
}
```

---

## 4. Wybór Języka Ojczystego w Aplikacji (User Experience)

1. **Na starcie (Onboarding Screen):**
   - Pierwszy ekran po instalacji pyta użytkownika: *"What is your native language?"* (języki: 🇪🇸 Spanish, 🇩🇪 German, 🇫🇷 French, 🇵🇱 Polish, 🇮🇹 Italian, 🇯🇵 Japanese, etc.).
   - Wybór zapisuje się w profilu (`profiles.native_language`).
2. **W Ustawieniach Profilu:**
   - Użytkownik w każdej chwili może zmienić język tłumaczeń oraz preferowaną walutę.
