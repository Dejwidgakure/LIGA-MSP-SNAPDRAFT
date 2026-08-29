# Planetarna Rezerwa V1 — raport testów

Data kontroli: 2026-08-27

## Nowe testy

- `planetary-reserve-regression.test.js` — PASS
  - dokładnie 12 unikalnych kandydatów,
  - dokładnie 3 Rezerwowych,
  - wykluczenie kart z głównego decku,
  - reguła TECH przy mniej niż 2 kartach TECH,
  - 250 próbek na prawdziwej bazie `cards.js` i `tags.js`.
- `planetary-reserve-integration-regression.test.js` — PASS
  - ustawienia,
  - kolejność finałowa,
  - eksport,
  - Kroniki,
  - komplet 4 assetów.
- `planetary-reserve-stats-regression.test.js` — PASS
  - MAIN_DECK i SIDEBOARD są osobnymi strefami,
  - Rezerwowi liczą się jako wybór w drafcie,
  - Rezerwowi nie zasilają wyników meczów ani statystyk najlepszej dwunastki.

## Regresja istniejących modułów

PASS:

- `finalization-static-regression.test.js`
- `superpowers-collector-regression.test.js`
- `final-superpower-sanity-regression.test.js`
- `superpowers-final-polish-regression.test.js`

## Kontrola składni

PASS dla wszystkich zmienionych plików JavaScript.

## Pełny zastany zestaw testów

W kopii roboczej: 24 PASS, 13 FAIL. Te same 13 testów FAIL występuje również w niezmienionym folderze kanonicznym, więc są to zastane błędy bazowe, a nie regresje Planetarnej Rezerwy.
