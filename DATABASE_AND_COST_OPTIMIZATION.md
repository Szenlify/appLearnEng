# DATABASE_AND_COST_OPTIMIZATION.md — TTS, Baza Danych i Strategia Minimalizacji Kosztów

Dokument definiuje wybór silnika TTS (Text-to-Speech), architekturę bazy danych oraz techniki optymalizacji zapytań i kosztów infrastruktury SaaS dla aplikacji **LearnEng**.

---

## 1. Silnik TTS (Text-to-Speech): Natywny `expo-speech`

Wymowa audio słów i zdań w aplikacji mobilnej realizowana jest bezpośrednio na urządzeniu za pomocą biblioteki **`expo-speech`**.

- **Technologia:** Wykorzystuje wbudowane silniki systemowe (`AVSpeechSynthesizer` na iOS oraz `android.speech.tts.TextToSpeech` na Androidzie).
- **Zalety:**
  - **Koszt:** 0 PLN / $0.00 – mowa syntezowana jest lokalnie na procesorze telefonu.
  - **Opóźnienie:** 0 ms (natychmiastowe odtwarzanie bez czekania na pobranie pliku).
  - **Działa offline:** Pełna dostępność wymowy podczas powtórek fiszek bez dostępu do Internetu.
  - **Głosy:** Naturalne głosy systemowe (Siri / Enhanced Voices na iOS oraz silnik Google na Androidzie) z akcentem `en-US` lub `en-GB`.

### Implementacja w Aplikacji Mobilnej (`apps/mobile/lib/speech.ts`):
```typescript
import * as Speech from 'expo-speech';

export function playPronunciation(text: string, accent: 'en-US' | 'en-GB' = 'en-US') {
  Speech.stop(); // zatrzymaj poprzednie audio, jeśli trwało
  Speech.speak(text, {
    language: accent,
    pitch: 1.0,
    rate: 0.9, // lekko zwolnione tempo dla lepszej przyswajalności
  });
}
```

---

## 2. Architektura Bazy Danych

### 2.1 Chmurowa Baza Danych: PostgreSQL na Supabase
- **Silnik:** **PostgreSQL 15+** z rozszerzeniem `uuid-ossp`.
- **Zabezpieczenie:** Natywne **Row Level Security (RLS)** — użytkownik ma dostęp wyłącznie do swoich rekordów.
- **Wbudowany Connection Pooler (Supabase Transaction Pooler / PgBouncer):** Chroni przed przekroczeniem limitu połączeń przy nagłych skokach ruchu z aplikacji mobilnej.
- **Wysoki darmowy tier:** Do 500 MB danych i 50 000 aktywnych użytkowników miesięcznie za 0 USD.

### 2.2 Baza Lokalna na Telefonie: expo-sqlite (Offline First)
- Fiszki pobierane są do lokalnej bazy telefonu (`expo-sqlite`).
- Użytkownik przegląda i swipuje fiszki lokalnie z natychmiastowym czasem reakcji (60/120 fps).

---

## 3. Techniki Oszczędzania Bazy Danych (90%+ Redukcji Zapytań)

Aby baza danych nie stała się wąskim gardłem kosztowym, wdrażamy 6 kluczowych technik:

### ⚡️ 1. Całkowite Odciążenie Bazy z Tłumaczeń (Cloudflare R2 Public Link)
- **Rozwiązanie w LearnEng:** Wszystkie słowa, proste definicje i wyjaśnienia leżą w publicznym bucketcie **Cloudflare R2** jako `/{hash}.json`. 
- **Efekt:** PostgreSQL obsługuje **0 zapytań o tłumaczenia**. Koszt odpytywania bazy danych o słówka wynosi równe **0 PLN**.

### 📦 2. Buforowanie i Zbiorcza Synchronizacja Fiszek (Batching / Debounce Sync)
- **Rozwiązanie:** 
  - Ocena fiszki (Lewo, Dół, Prawo, Góra) aktualizuje stan lokalny natychmiast.
  - Zmiany są kolejkowane w pamięci i wysyłane do bazy **zbiorczo w jednej paczce (Batch Mutation)**:
    - Po 5 sekundach bezruchu (debounce) LUB
    - Przy wyjściu z aplikacji do tła (`AppState === 'background'`) LUB
    - Przy zakończeniu sesji nauki.
- **Efekt:** Wiele zapytań do bazy redukujemy do **1 zapytania zbiorczego (`upsert`)**.

### 🎯 3. Precyzyjne Indeksy Złożone (B-Tree Composite Indexes)
- Pobieranie fiszek na dany dzień korzysta ze złożonego indeksu:
  ```sql
  CREATE INDEX idx_flashcards_user_due ON public.user_flashcards(user_id, next_review_at);
  ```
- **Efekt:** Baza wykonuje błyskawiczny `Index Scan` zamiast powolnego `Seq Scan` (przeszukiwania całej tabeli). Czas zapytania < 2 ms nawet przy dużej liczbie wierszy.

### 📄 4. Paginacja Kursorowa zamiast `OFFSET`
- Przy liście historii oglądania i liście słówek:
  ```sql
  SELECT * FROM user_watch_history 
  WHERE user_id = $1 AND last_watched_at < $cursor 
  ORDER BY last_watched_at DESC 
  LIMIT 20;
  ```
- **Efekt:** Baza danych nie musi przeliczać i odrzucać wcześniejszych wierszy; zużycie procesora i pamięci spada o 95%.

### ⏱️ 5. Wykorzystanie Supabase Transaction Pooler (PgBouncer)
- Aplikacja mobilna i backend łączą się przez port poolera (`6543`) w trybie `transaction`.
- Tysiące urządzeń mobilnych może być połączonych jednocześnie, współdzieląc zaledwie kilkanaście stałych połączeń z silnikiem PostgreSQL.

### 🛡️ 6. Liczniki Zapytań AI w Pamięci Podręcznej / Nagłówkach
- Resetowanie dziennego limitu darmowych zapytań (`daily_ai_requests_count`) nie wymaga zapytania do bazy przy każdym kliknięciu słowa, ponieważ baza odpytywana jest wyłącznie przy błędzie 404 z Cloudflare R2 (czyli tylko przy zupełnie nowych słowach).
