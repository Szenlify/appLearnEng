# 05. Plan Działań, Zakres MVP i Wdrożenie

## 1. Zakres MVP (Minimum Viable Product - Faza 1)

Celem MVP jest jak najszybsze zweryfikowanie hipotezy produktowej na obu platformach (**iOS i Android**) przy zachowaniu minimalnych kosztów infrastruktury:

### Funkcjonalności MVP:
1. **Ekran Odtwarzacza (Cross-Platform Player View):**
   - Osadzony odtwarzacz YouTube (YouTube IFrame API).
   - Interaktywny pasek napisów umieszczony bezpośrednio pod filmem.
2. **Optymalizacja Kosztów AI (Cloudflare R2 Public Link):**
   - Kliknięcie słowa/zdania pauzuje wideo.
   - Aplikacja oblicza hash i wykonuje bezpośredni `GET` do publicznego linku Cloudflare R2 (`/{hash}.json`).
   - W przypadku braku w cache (404) -> zapytanie do backendu, wywołanie **Gemini 2.5 Lite**, zapis do roota Cloudflare R2 i zwrot do aplikacji.
3. **Zapisywanie Słów oraz Całych Zdań do Fiszek:**
   - Przycisk *"Zapisz słowo"* oraz *"Zapisz całe zdanie"* na karcie tłumaczenia.
   - Dedykowany ekran *"Fiszki / Moje Powtórki"* z podziałem na słówka i pełne struktury zdaniowe z kontekstem wideo.
4. **Monetyzacja przez Stripe:**
   - 3 plany subskrypcji miesięcznej (**Starter**, **Pro**, **Master**).
   - Automatyczny **3-dniowy darmowy okres próbny (Trial)** przy starcie subskrypcji.

---

## 2. Etapy Wdrożenia (Roadmap Sprintów)

### Sprint 1: Setup Cross-Platform, Odtwarzacz i Napisy (Tydzień 1-2)
- [ ] Inicjalizacja projektu cross-platform (Flutter / React Native Expo) dla iOS i Androida.
- [ ] Zbudowanie komponentu odtwarzacza YouTube z dwukierunkową komunikacją (zdarzenia `timeupdate`, pauzowanie, wznawianie).
- [ ] Przygotowanie backendu parsującego transkrypcje YouTube do ustrukturyzowanego formatu JSON.
- [ ] Renderowanie paska napisów z podziałem na klikalne tokeny (słowa i zaznaczanie zdań).

### Sprint 2: Cloudflare R2 Cache i Gemini 2.5 Lite (Tydzień 3)
- [ ] Utworzenie bucketu w **Cloudflare R2** i podpięcie własnej domeny publicznej (np. `cache.applearneng.com`).
- [ ] Implementacja algorytmu haszowania `sha256(word + "_" + sentence)` w aplikacji mobilnej.
- [ ] Logika zapytania: `GET https://cache.applearneng.com/{hash}.json` -> przy 404 uderzenie do `/api/v1/translate`.
- [ ] Integracja backendu z Google Gemini 2.5 Lite API i automatyczny zapis odpowiedzi JSON do folderu głównego w R2.

### Sprint 3: Moduł Fiszek w Aplikacji (Tydzień 4)
- [ ] Baza danych PostgreSQL (Supabase) – tabele użytkowników i fiszek (`user_flashcards`).
- [ ] Widok zapisu: możliwość dodania słówka lub całego zdania do fiszek z poziomu Bottom Sheet.
- [ ] Ekran nauki fiszek w aplikacji mobilnej z trybem powtórek (karty odwracane / swipe).

### Sprint 4: Płatności Stripe i Wdrożenie (Tydzień 5-6)
- [ ] Konfiguracja konta Stripe i produktów (3 plany miesięczne z parametrem `trial_period_days: 3`).
- [ ] Wdrożenie checkoutu subskrypcji w aplikacji mobilnej (Stripe SDK / portal klienta).
- [ ] Webhooki Stripe w backendzie aktualizujące status uprawnień użytkownika w bazie.
- [ ] Przygotowanie buildów produkcyjnych na iOS (TestFlight / App Store) oraz Android (Google Play Console).
