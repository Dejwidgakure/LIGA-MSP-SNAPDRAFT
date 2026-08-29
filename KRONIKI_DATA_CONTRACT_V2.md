# MSP SnapDraft — Data Contract V2 / Archive Freeze (PATCH102)

## Kanoniczne rodziny
Każdy draft ma dokładnie trzy rodziny konfiguracji widoczne dla gracza:
1. **Tryb draftowania**
2. **Rozszerzenia**
3. **Ustawienia specjalne**

`draftFlow`, `poolRules` i `deckFinalization` są wyłącznie technicznymi podgrupami wewnątrz `specialSettings`. Nie wolno renderować ich jako osobnych rodzin graczowych.

## Źródło prawdy
Nowe i zmigrowane rekordy używają `draftConfigV2` jako jedynego źródła konfiguracji. Nie używamy już top-level `mode`, `bans` ani `presetCard`.

### Historycznie istotne payloady
- `specialSettings.poolRules.bans.cards` — konkretna lista banów.
- `specialSettings.poolRules.luckyCards.cards` — konkretna lista Lucky Cards.
- `specialSettings.deckFinalization.presetCard.card` — konkretna Preset Card.
- `specialSettings.specialTwist.name/description` — nazwa i opis Twista.
- przyszłe filtry puli mogą zachowywać konkretne wartości, jeśli wpływają na legalną pulę.

Nie archiwizujemy telemetrycznych logów ani szczegółowej konfiguracji Custom Packów, Economy, Bounties, Questów czy Targu.

## Dodatkowy Bufor Paczki
Bazowy SnapDraft ma zawsze bufor **+1** i nie jest to Ustawienie specjalne.

`additionalPackBuffer` oznacza tylko odejście od baseline:
- `enabled: false` → faktyczny bufor +1,
- runtime extra `+1` → faktyczny bufor +2,
- runtime extra `+2` → faktyczny bufor +3.

Archiwum przechowuje wyłącznie fakt, czy Dodatkowy Bufor był aktywny. Dokładna wartość jest parametrem LIVE i nie jest wymagana w Kronikach.

## Renderer Kronik
Kroniki pokazują podstawowe informacje edycji (ID, podtytuł jeśli jest, termin, liczba graczy, zwycięzca/lider zgodnie ze stanem) oraz trzy rodziny:
- **TRYB DRAFTOWANIA** — nazwa trybu + wariant, jeśli dotyczy,
- **ROZSZERZENIA** — lista aktywnych,
- **USTAWIENIA SPECJALNE** — lista aktywnych bez drobnych parametrów runtime.

Niżej, jako detale (nie nowe rodziny), pokazujemy tylko dane historycznie istotne:
- Bany + lista kart,
- Lucky Cards + lista kart,
- Preset Card,
- Specjalny Twist + nazwa/opis,
- ewentualny Profil Puli / filtry, jeśli mają zapisany konkretny payload.

Kroniki nie muszą pokazywać sekund Timera ani dokładnej wartości Dodatkowego Bufora.

## Panel LIVE programu
Panel programu korzysta z tych samych trzech rodzin, ale może pokazywać parametry operacyjne potrzebne podczas trwającego draftu, np. `Timer 45s` oraz przy aktywnym dodatkowym buforze efektywny `Bufor Paczki +2/+3`.

Detale Banów, Lucky Cards, Preset Card i Twista są renderowane poniżej trzech rodzin.
