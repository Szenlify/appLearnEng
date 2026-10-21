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

### 3.4 Konfiguracja Sesji Checkout w Stripe:
```typescript
const session = await stripe.checkout.sessions.create({
  customer: stripeCustomerId,
  mode: 'subscription',
  currency: userCurrency || 'usd', // domyślnie zawsze USD
  payment_method_types: ['card', 'link', 'blik', 'sepa_debit'],
  subscription_data: {
    trial_period_days: 3,
  },
  line_items: [{ price: localizedPriceId, quantity: 1 }],
  success_url: `${APP_URL}/subscription/success`,
  cancel_url: `${APP_URL}/subscription/cancel`,
});
```

---

## 4. Wybór Języka Ojczystego w Aplikacji (User Experience)

1. **Na starcie (Onboarding Screen):**
   - Pierwszy ekran po instalacji pyta użytkownika: *"What is your native language?"* (języki: 🇪🇸 Spanish, 🇩🇪 German, 🇫🇷 French, 🇵🇱 Polish, 🇮🇹 Italian, 🇯🇵 Japanese, etc.).
   - Wybór zapisuje się w profilu (`profiles.native_language`).
2. **W Ustawieniach Profilu:**
   - Użytkownik w każdej chwili może zmienić język tłumaczeń oraz preferowaną walutę.
