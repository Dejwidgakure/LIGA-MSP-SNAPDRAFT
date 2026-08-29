MSP SnapDraft — KRONIKI 03 / PATCH102 COMPAT

INSTALL ORDER:
1. Install PATCH102 Data Contract Archive Freeze.
2. Install this Kroniki patch over it.

This package preserves the full KRONIKI 03 cumulative visual/content update and updates its data consumers to PATCH102.

Compatibility fixes:
- draft.html reads draftConfigV2 only (no draftInfo / top-level mode/bans/presetCard fallbacks).
- Three player-facing families only: Tryb Draftowania / Rozszerzenia / Ustawienia Specjalne.
- Bans, Lucky Cards, Preset Card and Twist payloads render below those families as details.
- Kroniki show Timer without seconds and Dodatkowy Bufor Paczki without runtime value.
- additionalPackBuffer replaces the old packBuffer archive model.
- draft-stats-engine.js and hallOfFame.html read draft mode from draftConfigV2.
- Archive 10 banned-card ranking reads poolRules.bans.cards.
- Archive 10 preserves the Kroniki 03 presentation rule that Arishem/Loki are excluded from the public "most banned" ranking, while reading ban history from the PATCH102 contract.
- Encyclopedia/process text uses baseline +1 and optional Dodatkowy Bufor Paczki +1/+2.

This patch contains Kroniki/site files only. It does NOT contain database.js or PROGRAM-DRAFT files and does not replace PATCH102.
