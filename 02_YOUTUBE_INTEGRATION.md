# 02. Integracja z YouTube: Odtwarzacz, Napisy i Kwestie Prawne

## 1. Wybór Odtwarzacza (Jedyny Wybór: `react-native-youtube-iframe`)

Nie stosujemy żadnych innych komponentów odtwarzacza.
- **Komponent:** **`react-native-youtube-iframe`**
  - Opiera się bezpośrednio na oficjalnym YouTube IFrame Player API.
  - Jest w 100% zgodny z regulaminem YouTube ToS i wytycznymi Apple App Store Review (Guideline 5.2.3).
  - Nie maskuje kontrolek YouTube ani nie pobiera plików wideo na dysk.
  - Pasek interaktywnych napisów umieszczony jest bezpośrednio pod oknem odtwarzacza w natywnym widoku React Native.

---

## 2. Pobieranie Transkrypcji (Napisów) z YouTube

Transkrypcje pobiera wyłącznie backend za pośrednictwem serwisu `YouTubeCaptionsService` (szczegóły w `YOUTUBE_SCRAPER.md`):
1. **Priorytet ścieżek językowych:**
   - Pierwszeństwo mają oficjalne napisy manualne (`en`).
   - Przy ich braku backend pobiera automatyczne napisy YouTube (`a.en`).
2. **Format odpowiedzi:**
   - Zwracana jest posortowana chronologicznie tablica `SubtitleCue[]`.
   - Każdy element zawiera `start`, `duration`, `end`, pełny tekst oraz stokenizowane słowa `tokens: string[]`.

---

## 3. Synchronizacja Wideo z Napisami w Aplikacji Mobilnej

Komponent `SubtitleTrack` synchronizuje się z odtwarzaczem w czasie rzeczywistym:
1. **Pętla czasu:** Stan odtwarzacza aktualizowany jest w interwale 100 ms przez funkcję `playerRef.current?.getCurrentTime()`.
2. **Aktywne zdanie:** Aplikacja wyszukuje aktywne zdanie za pomocą wyszukiwania binarnego:
   `cues.find(c => currentTime >= c.start && currentTime <= c.end)`.
3. **Płynny Auto-Scroll:** Lista napisów przewija się za pomocą `FlatList` / `ScrollView` z metodą `scrollToIndex`, utrzymując aktualnie wymawiane zdanie na środku ekranu.
4. **Obsługa kliknięcia w słowo:**
   - Tapnięcie w dowolne słowo natychmiast wywołuje `setPlaying(false)`.
   - Otwiera się `TranslationBottomSheet`.
   - Po zamknięciu arkusza odtwarzanie jest automatycznie wznawiane.

---

## 4. Wyszukiwarka Wideo YouTube w Aplikacji (Zgodność z App Store & Google Play)

Aplikacja umożliwia swobodne wyszukiwanie dowolnych filmów YouTube bezpośrednio wewnątrz ekranu głównego (jak w aplikacji YouTube):
1. **Zasada działania:**
   - Użytkownik wpisuje dowolną frazę (np. *„MrBeast”*, *„Joe Rogan”*, *„BBC News”*).
   - Backend zwraca listę filmów z miniaturkami, tytułami i długością.
   - Tapnięcie filmu natychmiast odpala odtwarzacz z napisami — bez konieczności kopiowania/wklejania linków!
2. **Kwestie Prawne i Zgodność z Apple App Store & Google Play:**
   - **Brak rippera:** Aplikacja nie pobiera wideo na dysk (spełnienie wymogu Apple Guideline 5.2.3).
   - **Reklamy i statystyki:** Oficjalny IFrame nalicza wyświetlenia twórcom i zachowuje reklamy YouTube.
   - **Cache zapytań (24h):** Wyniki wyszukiwania są cache'owane w backendzie, co zapobiega wyczerpaniu limitów YouTube Data API.

