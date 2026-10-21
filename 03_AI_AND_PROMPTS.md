# 03. Integracja z AI: Gemini 2.5 Lite, Caching w Cloudflare R2 i Wielojęzyczność

## 1. Czy Google Gemini 2.5 Flash / Lite będzie wystarczający?

**Zdecydowanie TAK — to obecnie najlepszy i najbardziej opłacalny wybór na rynku do tego zadania.**

### Dlaczego Gemini 2.5 Flash / Lite deklasuje konkurencję?
1. **Błyskawiczny czas odpowiedzi (TTFT < 300 ms):**
   - Starsze modele (np. GPT-4o czy Claude Sonnet) mają opóźnienia rzędu 800–1500 ms, co niszczy płynność oglądania wideo na telefonie. Gemini 2.5 Lite odpowiada w ułamku sekundy.
2. **Natywne Structured Outputs (Wymuszony JSON):**
   - Model w 100% trzyma się schematu JSON bez halucynacji i zbędnych wstępów tekstu.
3. **Ekstremalnie niski koszt tokenów:**
   - Zapytanie o słówko ze zdaniem kontekstowym kosztuje poniżej **0,0003 PLN** ($0.00007 USD).
   - W połączeniu z naszym cache w Cloudflare R2 (gdzie 80%+ zapytań nie dotyka API), miesięczny koszt AI na użytkownika wynosi ułamki groszy.

---

## 2. Co dokładnie tłumaczy i generuje Gemini?

Zgodnie z wymogami dydaktycznymi, okno tłumaczenia podzielone jest na warstwy poznawcze:

1. **Wymowa (Audio Pronunciation & IPA):**
   - Transkrypcja fonetyczna w alfabecie IPA (np. `/ˌpʊt ʌp ˈwɪð/`).
   - Akcent (US / UK).
2. **Prosta Definicja (Simple Definition):**
   - Zwięzła, łatwa do przyswojenia definicja w języku docelowym (np. polskim) na poziomie A2/B1 — bez skomplikowanego żargonu lingwistycznego.
3. **Tłumaczenie Słowa i Całego Zdania:**
   - Precyzyjne tłumaczenie wyrazu oraz pełne tłumaczenie zdania z filmu.
4. **Przycisk "Explain in Context" (Wyjaśnij w kontekście):**
   - Pogłębione wyjaśnienie: dlaczego dane słowo zostało użyte w ten konkretny sposób w filmie, jakie emocje wyraża lub czy jest to idiom / slang / phrasal verb.
5. **Alternatywny Przykład Użycia:**
   - Nowe, praktyczne zdanie po angielsku wraz z tłumaczeniem.

---

## 3. Schemat JSON i Obsługa Dowolnego Języka Docelowego

Gemini przyjmuje parametr `target_language` (np. `pl`, `de`, `es`, `fr`, `ja`, `it`). Odpowiedź generowana jest zawsze w języku ojczystym wybranym przez użytkownika:

### User Payload Przekazywany do Gemini:
```json
{
  "target_word_or_phrase": "put up with",
  "context_sentence": "I really can't put up with his toxic behavior anymore.",
  "target_language": "pl"
}
```

### Zwracany Ustrukturyzowany Obiekt JSON:
```json
{
  "selected_text": "put up with",
  "lemma": "put up with",
  "part_of_speech": "phrasal verb",
  "ipa": "/ˌpʊt ʌp ˈwɪð/",
  "cefr_level": "B1",
  "simple_definition": "Tolerować lub znosić kogoś/coś, co jest nieprzyjemne.",
  "contextual_translation": "znosić / tolerować",
  "sentence_translation": "Naprawdę nie mogę już dłużej znosić jego toksycznego zachowania.",
  "context_explanation": "W tym filmie bohater używa tego zwrotu, aby wyrazić frustrację i postawić granicę w relacji. Zwrot potoczny, często stosowany w kłótniach.",
  "example_sentence_en": "I don't know how she puts up with that loud noise all day.",
  "example_sentence_pl": "Nie wiem, jak ona znosi ten głośny hałas przez cały dzień."
}
```

---

## 4. Architektura Wielojęzycznego Cache w Cloudflare R2

Aby wspierać użytkowników z Polski, Niemiec, Francji, Hiszpanii czy Japonii bez konfliktów pamięci podręcznej, język docelowy jest integralną częścią hasza:

### Algorytm Haszowania:
$$\text{hash} = \text{sha256}(\text{word} + \text{"\_"} + \text{sentence} + \text{"\_"} + \text{targetLanguage})$$

- Polski użytkownik odpytuje: `/{hash_pl}.json`
- Niemiecki użytkownik odpytuje: `/{hash_de}.json`
- Oba pliki leżą w folderze głównym w Cloudflare R2 i są serwowane z zerowym kosztem transferu (Zero Egress) przez globalny CDN Cloudflare.
