# 02. Integracja z YouTube: Odtwarzacz, Napisy i Kwestie Prawne

## 1. Kwestie Prawne i Warunki Korzystania (YouTube ToS & App Store Review)

To najważniejszy aspekt techniczny, który decyduje o tym, czy Apple przyjmie aplikację do App Store:

### ⚠️ Czego NIE WOLNO robić:
1. **Pobierać bezpośrednich strumieni wideo/audio (tzw. video ripping / scraping przez yt-dlp na urządzeniu):**
   - Narusza to punkt 5.B regulaminu YouTube Developer API.
   - Prowadzi do natychmiastowego odrzucenia aplikacji przez Apple App Review (Guideline 5.2.3 - Intellectual Property).
2. **Ukrywać reklam lub blokować elementów sterujących odtwarzacza YouTube:**
   - Odtwarzacz YouTube musi działać w sposób naturalny (odtwarzanie ewentualnych reklam YouTube, logo YouTube w rogu).

### ✅ Rozwiązanie w 100% zgodne i bezpieczne:
1. **Odtwarzacz:** Zastosowanie oficjalnego **YouTube IFrame Player API** osadzonego w `WKWebView` (lub gotowego wrappera Swift, np. `YouTubePlayerKit`).
2. **Napisy:** Odtwarzacz YouTube wycisza wbudowane napisy (`cc_load_policy=0`), a aplikacja wyświetla własny, natywny widok SwiftUI z interaktywnymi napisami **pod oknem wideo**.
3. Dzięki umieszczeniu napisów pod odtwarzaczem:
   - Nie zasłaniamy kontrolek YouTube.
   - Użytkownik ma pełną wygodę dotyku na telefonie.

---

## 2. Pobieranie Transkrypcji (Napisów) z YouTube

### Wyzwanie techniczne
Oficjalne API YouTube Data API v3 (`captions.download`) pozwala na pobieranie napisów **tylko** właścicielowi danego kanału (wymaga OAuth2 kanału). Nie pozwala na pobieranie napisów z cudzych filmów.

### Architektura pobierania napisów (Backend Proxy):
Aby pobrać napisy z dowolnego publicznego filmu z włączonymi napisami (manualnymi lub auto-generated):
1. **Backend pobiera metadane transkrypcji:**
   - Wyciągamy listę ścieżek językowych z publicznego endpointu `timedtext` YouTube (np. `en`, `en-US`, auto-generated `a.en`).
   - Zwracamy format JSON z dokładnymi znacznikami czasu:
     ```json
     [
       {
         "start": 14.25,
         "duration": 2.40,
         "end": 16.65,
         "text": "I can't put up with this attitude anymore."
       }
     ]
     ```
2. **Agresywny Caching w Bazie:**
   - Raz pobrana transkrypcja filmu jest zapisywana w naszej bazie danych PostgreSQL / S3. Kolejni użytkownicy oglądający ten sam film otrzymują napisy natychmiast z naszego serwera (0 zapytań do YouTube).
3. **Rotacja IP / Proxy:**
   - W przypadku serwera produkcyjnego, zapytania o napisy do YouTube mogą natrafić na rate-limit. Warto użyć lekkiej puli proxy (np. BrightData, Webshare) po stronie backendu.

---

## 3. Synchronizacja Wideo z Napisami w SwiftUI

### Komunikacja WKWebView <-> Swift
1. W kodzie HTML/JS odtwarzacza IFrame instalujemy subskrypcję zdarzeń:
   - `onStateChange`: informuje Swift o stanie (Odtwarzanie, Pauza, Buforowanie).
   - Pętla synchronizacji czasu: Odtwarzacz raportuje czas (`player.getCurrentTime()`) co 100-200 ms przez `window.webkit.messageHandlers.timeUpdate.postMessage(time)`.
2. **SwiftUI Subtitle Store:**
   - Aplikacja trzyma aktualny czas filmu (`@Published var currentTime: Double`).
   - Szybkie wyszukiwanie aktywnego segmentu napisów (Binary Search na posortowanej liście znaczników czasu `start` i `end`).
   - Automatyczne przewijanie listy napisów (Auto-scroll), aby aktualne zdanie zawsze znajdowało się na środku ekranu.

---

## 4. Tokenizacja Słów i Interakcja Użytkownika

Zwykły tekst napisów musi zostać rozbity na interaktywne elementy:
1. **Reguły tokenizacji:**
   - Rozbicie zdania na poszczególne słowa z zachowaniem znaków interpunkcyjnych:
     `"I can't put up with this attitude anymore."` ->
     Tokeny: `["I", "can't", "put", "up", "with", "this", "attitude", "anymore"]`
2. **Zaznaczanie fraz wielowyrazowych (Phrasal Verbs / Idiomy):**
   - Pojedyncze kliknięcie zaznacza jedno słowo (np. `attitude`).
   - Dłuższe przytrzymanie (Long Press) lub przeciągnięcie (Drag/Highlight) pozwala użytkownikowi zaznaczyć całą frazę (np. `put up with`).
3. **Obsługa kliknięcia:**
   - Kliknięcie w słowo natychmiast wysyła komendę `player.pauseVideo()` do `WKWebView`.
   - Otwiera się natywny arkusz `SwiftUI .sheet(isPresented:)` z tłumaczeniem.
   - Zamknięcie arkusza automatycznie wznawia odtwarzanie (opcjonalny przełącznik w ustawieniach: "Wznów po zamknięciu").
