# 04. Model Biznesowy SaaS, Subskrypcje i Płatności Wielowalutowe (Stripe)

## 1. Wybór Rynków o Najwyższej Skłonności do Płacenia (High ARPU)

Aplikacja uczy języka angielskiego, ale interfejs i tłumaczenia dostosowane są do języka ojczystego użytkownika. Selekcja języków opiera się na **krajach o najwyższym współczynniku konwersji i skłonności do płacenia za edukację**:

1. 🇵🇱 **Polska (PLN):** Ogromne zapotrzebowanie na angielski w IT i korporacjach. Standard płatności: **BLIK** oraz karty.
2. 🇩🇪 **Niemcy, Austria, Szwajcaria (EUR / CHF):** Region DACH — najwyższe ARPU w Europie, kultura płacenia za dobre narzędzia edukacyjne. Płatności: **SEPA**, Giropay, Sofort.
3. 🇫🇷 **Francja, Belgia (EUR):** Silna potrzeba podnoszenia poziomu angielskiego, duży rynek konsumencki.
4. 🇪🇸 **Hiszpania & Ameryka Łacińska (EUR / USD):** Bardzo duża baza użytkowników, naturalna potrzeba immersji.
5. 🇮🇹 **Włochy (EUR):** Bardzo niski średni poziom biegłości angielskiego w Europie = wysoka motywacja do nauki.
6. 🇯🇵 **Japonia (JPY):** Gigantyczny rynek edukacyjny, kultura ciągłego samodoskonalenia, bardzo wysokie wydatki na subskrypcje językowe.
7. 🇰🇷 **Korea Południowa (KRW / USD):** Rekordowe globalnie wydatki per capita na naukę angielskiego.

---

## 2. Plany Subskrypcyjne i Lokalizacja Cen w Stripe

Subskrypcje są rozliczane **w cyklu miesięcznym z 3-dniowym bezpłatnym okresem próbnym (3-Day Free Trial)**. Ceny i waluty są automatycznie dopasowywane do kraju użytkownika:

| Plan | 🇵🇱 Polska (PLN) | 🇪🇺 Strefa Euro (EUR) | 🇺🇸 Global / USA (USD) | 🇯🇵 Japonia (JPY) |
| :--- | :--- | :--- | :--- | :--- |
| 🥉 **Starter** | **19,99 PLN** / msc | **4,99 €** / msc | **$4.99** / mo | **¥750** / mo |
| 🥈 **Pro** | **39,99 PLN** / msc | **8,99 €** / msc | **$8.99** / mo | **¥1 400** / mo |
| 🥇 **Master** | **69,99 PLN** / msc | **15,99 €** / msc | **$16.99** / mo | **¥2 500** / mo |
| **Okres próbny** | **3 dni za darmo** | **3 dni za darmo** | **3 dni za darmo** | **3 dni za darmo** |

---

## 3. Lokalne Metody Płatności w Stripe (W tym BLIK)

Dla maksymalizacji konwersji, Stripe PaymentSheet / Checkout automatycznie udostępnia lokalne metody płatności:

### 3.1 Polska (PLN)
* **BLIK:** Obowiązkowa metoda w Polsce odpowiadająca za ponad 70% transakcji online. Stripe wspiera BLIK natywnie (kod 6-cyfrowy wpisywany bezpośrednio w aplikacji lub przekierowanie do banku).
* **Przelewy24 (P24):** Szybkie przelewy bankowe ze wszystkich polskich banków.
* **Apple Pay / Google Pay / Karty płatnicze.**

### 3.2 Kraje Europejskie (EUR)
* **SEPA Direct Debit:** Bezpośrednie polecenie zapłaty (bardzo popularne w Niemczech).
* **iDEAL (Holandia), Bancontact (Belgia), Sofort / Giropay (Niemcy).**
* **Apple Pay / Google Pay / Karty.**

### 3.3 Konfiguracja w Stripe API:
```typescript
const session = await stripe.checkout.sessions.create({
  customer: stripeCustomerId,
  mode: 'subscription',
  payment_method_types: ['card', 'blik', 'p24', 'sepa_debit'], // dynamiczne metody
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
   - Pierwszy ekran po instalacji pyta użytkownika: *"Jaki jest Twój język ojczysty?"* (flagi: 🇵🇱 Polski, 🇩🇪 Niemiecki, 🇪🇸 Hiszpański, 🇫🇷 Francuski, 🇮🇹 Włoski, 🇯🇵 Japoński).
   - Wybór zapisuje się lokalnie oraz w profilu użytkownika (`profiles.native_language`).
2. **W Profilu / Ustawieniach:**
   - W zakładce *"Ustawienia / Profil"* użytkownik w każdej chwili może zmienić język tłumaczeń oraz walutę.
