MSP SNAPDRAFT PATCH102 — DATA CONTRACT V2 ARCHIVE FREEZE

Patch jest kumulatywny względem przesłanego baseline'u i zastępuje niewgrany PATCH101M.

Najważniejsze zmiany:
- 3 rodziny player-facing: Tryb draftowania / Rozszerzenia / Ustawienia specjalne.
- Ukrycie technicznych nagłówków Przebieg / Reguły puli / Finalizacja / Twisty w Settings Modal.
- Bufor bazowy +1 staje się regułą stałą; nowe ustawienie to Dodatkowy Bufor Paczki OFF/+1/+2.
- Runtime mapuje dodatkowy bufor na efektywny +1/+2/+3 bez zmiany mechaniki wielkości paczki.
- Eksport archiwalny odchudzony do trwałych danych.
- draftConfigV2 jest jedynym źródłem konfiguracji.
- Bany i Preset przeniesione do draftConfigV2; usunięte top-level mode/bans/presetCard.
- D1–D28 zmigrowane do 2.4.0-archive-freeze; D26 Bany = Arishem + Loki; D28 status active.
- Kroniki i statystyki przepięte ze starego draft.mode / draft.bans na draftConfigV2.
- Dokumentacja Bufora zaktualizowana do nowego kanonu.
