# PLANETARNA REZERWA / SIDEBOARD V1 — kontrakt danych

Planetarna Rezerwa uruchamia się po wszystkich końcowych modyfikatorach decków. Każdy gracz wybiera dokładnie 3 karty z osobnej puli 12 kandydatów. Pula kandydatów i powody rekomendacji są stanem chwilowym interfejsu i nie trafiają do eksportu.

```js
player.deck = [/* dokładnie 12 nazw kart Main Decku */];
player.sideboard = [/* dokładnie 3 nazwy Rezerwowych */];

draftConfigV2.sideboard = {
  enabled: true,
  size: 3,
  candidatePoolSize: 12,
  version: 1
};
```

## Granice statystyczne

- `getMainDeckCards(player)` — główna dwunastka; skład decku, pary kart, wyniki meczów i zestawienia „najlepszych 12”.
- `getSideboardCards(player)` — wyłącznie trzech Rezerwowych.
- `getAllDraftedCards(player)` — pełne 12+3; występ w drafcie, właściciel, tagi i archetypy.
- W indeksie występów karta Rezerwy ma strefę `SIDEBOARD`, a główna karta `MAIN_DECK`.
- Stare drafty bez pola `sideboard` zachowują dotychczasowe działanie i wygląd.

## Zakres V1

Sideboard jest strefą archiwalną i przygotowawczą. V1 nie dodaje wymian przed meczem ani ingerencji w Poker Draft. W panelach końcowych i Kronikach Rezerwowi są prezentowani osobno, zawsze pod główną dwunastką.
