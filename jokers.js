/* ============================================================
   MSP SNAP DRAFT — JOKER CATALOG
   Version 3.21 — TAG SCHEMA V2 MIGRATION

   KANON RARITY:
   CHOICE
   - wartość rośnie wraz z szerokością, elastycznością i jakością puli,
   - Legendary = ogromny wybór albo wyjątkowa pula specjalna,
   - Epic = sensowna / jakościowa / archetypowa pula,
   - Rare = bardzo wąski, dziwny lub mocno ograniczający wybór.

   SURPRISE
   - system pokazuje 3 losowe karty,
   - szeroka / chaotyczna pula obniża rarity,
   - mała, spójna, przewidywalna i jakościowa pula może być Epic,
   - Legendary pozostaje wyjątkiem dla wyjątkowych źródeł.

   v3.10:
   - audyt wszystkich Jokerów według osobnej logiki Choice / Surprise,
   - dodano Rare Choice dla dwóch celowo ograniczonych profili low-power,
     z odpowiadającymi im Epic Surprise,
   - wybrane bardzo wąskie Hybrid Choice -> Rare,
   - Cost Reduction Surprise i Heavy Brick Surprise -> Epic,
   - usunięto wszystkie duplikaty nazw UI,
   - Loki i Arishem nadal wykluczeni z banned-card Jokerów.
============================================================ */

const JOKER_CATALOG_VERSION = "3.21";

const jokers = [
  {
    "id": "choice_any_card",
    "type": "choice",
    "rarity": "legendary",
    "family": "special",
    "name": "Pełna Kontrola",
    "desc": "Dowolna karta",
    "sourceCategories": [
      "special"
    ]
  },
  {
    "id": "choice_cost_0_1",
    "type": "choice",
    "rarity": "legendary",
    "family": "statistics",
    "name": "Kieszonkowy As",
    "desc": "Dowolna karta · Koszt 0–1",
    "sourceCategories": [
      "statistics"
    ],
    "filter": {
      "cost": {
        "min": 0,
        "max": 1
      }
    }
  },
  {
    "id": "choice_cost_2",
    "type": "choice",
    "rarity": "legendary",
    "family": "statistics",
    "name": "Podwójna Stawka",
    "desc": "Dowolna karta · Koszt 2",
    "sourceCategories": [
      "statistics"
    ],
    "filter": {
      "cost": {
        "exact": 2
      }
    }
  },
  {
    "id": "choice_cost_3",
    "type": "choice",
    "rarity": "legendary",
    "family": "statistics",
    "name": "Trzeci Wymiar",
    "desc": "Dowolna karta · Koszt 3",
    "sourceCategories": [
      "statistics"
    ],
    "filter": {
      "cost": {
        "exact": 3
      }
    }
  },
  {
    "id": "choice_cost_4",
    "type": "choice",
    "rarity": "legendary",
    "family": "statistics",
    "name": "Czwarty Filar",
    "desc": "Dowolna karta · Koszt 4",
    "sourceCategories": [
      "statistics"
    ],
    "filter": {
      "cost": {
        "exact": 4
      }
    }
  },
  {
    "id": "choice_cost_5",
    "type": "choice",
    "rarity": "legendary",
    "family": "statistics",
    "name": "Piąty Element",
    "desc": "Dowolna karta · Koszt 5",
    "sourceCategories": [
      "statistics"
    ],
    "filter": {
      "cost": {
        "exact": 5
      }
    }
  },
  {
    "id": "choice_cost_6_plus",
    "type": "choice",
    "rarity": "legendary",
    "family": "statistics",
    "name": "Klasa Omega",
    "desc": "Dowolna karta · Koszt 6+",
    "sourceCategories": [
      "statistics"
    ],
    "filter": {
      "cost": {
        "min": 6
      }
    }
  },
  {
    "id": "choice_cost_0_3",
    "type": "choice",
    "rarity": "legendary",
    "family": "statistics",
    "name": "Niska Orbita",
    "desc": "Dowolna karta · Koszt 0–3",
    "sourceCategories": [
      "statistics"
    ],
    "filter": {
      "cost": {
        "min": 0,
        "max": 3
      }
    }
  },
  {
    "id": "choice_cost_4_plus",
    "type": "choice",
    "rarity": "legendary",
    "family": "statistics",
    "name": "Ciężki Kaliber",
    "desc": "Dowolna karta · Koszt 4+",
    "sourceCategories": [
      "statistics"
    ],
    "filter": {
      "cost": {
        "min": 4
      }
    }
  },
  {
    "id": "choice_power_0_or_less",
    "type": "choice",
    "rarity": "epic",
    "family": "statistics",
    "name": "Strefa Zera",
    "desc": "Dowolna karta · Siła 0 lub mniej",
    "sourceCategories": [
      "statistics"
    ],
    "filter": {
      "power": {
        "max": 0
      }
    }
  },
  {
    "id": "choice_power_1_3",
    "type": "choice",
    "rarity": "epic",
    "family": "statistics",
    "name": "Niska Sygnatura",
    "desc": "Dowolna karta · Siła 1–3",
    "sourceCategories": [
      "statistics"
    ],
    "filter": {
      "power": {
        "min": 1,
        "max": 3
      }
    }
  },
  {
    "id": "choice_power_4_6",
    "type": "choice",
    "rarity": "epic",
    "family": "statistics",
    "name": "Stabilny Rdzeń",
    "desc": "Dowolna karta · Siła 4–6",
    "sourceCategories": [
      "statistics"
    ],
    "filter": {
      "power": {
        "min": 4,
        "max": 6
      }
    }
  },
  {
    "id": "choice_power_7_9",
    "type": "choice",
    "rarity": "epic",
    "family": "statistics",
    "name": "Wysoka Orbita",
    "desc": "Dowolna karta · Siła 7–9",
    "sourceCategories": [
      "statistics"
    ],
    "filter": {
      "power": {
        "min": 7,
        "max": 9
      }
    }
  },
  {
    "id": "choice_power_10_plus",
    "type": "choice",
    "rarity": "epic",
    "family": "statistics",
    "name": "Rdzeń Tytana",
    "desc": "Dowolna karta · Siła 10+",
    "sourceCategories": [
      "statistics"
    ],
    "filter": {
      "power": {
        "min": 10
      }
    }
  },
  {
    "id": "choice_power_3_or_less",
    "type": "choice",
    "rarity": "epic",
    "family": "statistics",
    "name": "Dolne Pasmo",
    "desc": "Dowolna karta · Siła 3 lub mniej",
    "sourceCategories": [
      "statistics"
    ],
    "filter": {
      "power": {
        "max": 3
      }
    }
  },
  {
    "id": "choice_power_7_plus",
    "type": "choice",
    "rarity": "epic",
    "family": "statistics",
    "name": "Kosmiczna Przewaga",
    "desc": "Dowolna karta · Siła 7+",
    "sourceCategories": [
      "statistics"
    ],
    "filter": {
      "power": {
        "min": 7
      }
    }
  },
  {
    "id": "choice_move",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Protokół Ruchu",
    "desc": "Dowolna karta · Move",
    "sourceCategories": [
      "mechanicFamilies"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "move"
        ]
      }
    }
  },
  {
    "id": "choice_destroy",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Kontrolowana Destrukcja",
    "desc": "Dowolna karta · Destroy",
    "sourceCategories": [
      "mechanicFamilies"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "destroy"
        ]
      }
    }
  },
  {
    "id": "choice_discard",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Wymiar Odrzutu",
    "desc": "Dowolna karta · Discard",
    "sourceCategories": [
      "mechanicFamilies"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "discard"
        ]
      }
    }
  },
  {
    "id": "choice_bounce",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Powrót Kontrolowany",
    "desc": "Dowolna karta · Bounce",
    "sourceCategories": [
      "mechanicFamilies"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "bounce"
        ]
      }
    }
  },
  {
    "id": "choice_afflict",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Skażenie Celowane",
    "desc": "Dowolna karta · Afflict",
    "sourceCategories": [
      "mechanicFamilies"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "afflict"
        ]
      }
    }
  },
  {
    "id": "choice_on_reveal",
    "type": "choice",
    "rarity": "legendary",
    "family": "tag",
    "name": "Wielkie Odkrycie",
    "desc": "Dowolny On Reveal",
    "sourceCategories": [
      "abilityTypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "on-reveal"
        ]
      }
    }
  },
  {
    "id": "choice_trigger_card",
    "type": "choice",
    "rarity": "legendary",
    "family": "tag",
    "name": "Spust Przeznaczenia",
    "desc": "Dowolny Trigger Card",
    "sourceCategories": [
      "abilityTypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "trigger-card"
        ]
      }
    }
  },
  {
    "id": "choice_end_of_turn",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Ostatni Akord",
    "desc": "Dowolna karta End of Turn",
    "sourceCategories": [
      "abilityTypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "endofturn"
        ]
      }
    }
  },
  {
    "id": "choice_game_start",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Pierwszy Ruch",
    "desc": "Dowolna karta Game Start",
    "sourceCategories": [
      "abilityTypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "gamestart"
        ]
      }
    }
  },
  {
    "id": "choice_moveable",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Wolna Orbita",
    "desc": "Dowolna karta Moveable",
    "sourceCategories": [
      "abilityTypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "moveable"
        ]
      }
    }
  },
  {
    "id": "choice_no_ability",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Czysta Karta",
    "desc": "Dowolna karta bez zdolności",
    "sourceCategories": [
      "abilityTypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "no-ability"
        ]
      }
    }
  },
  {
    "id": "choice_objective",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Cel Misji",
    "desc": "Dowolna karta Objective",
    "sourceCategories": [
      "abilityTypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "objective"
        ]
      }
    }
  },
  {
    "id": "choice_start_of_turn",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Pierwszy Impuls",
    "desc": "Dowolna karta Start of Turn",
    "sourceCategories": [
      "abilityTypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "startofturn"
        ]
      }
    }
  },
  {
    "id": "choice_end_of_game",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Ostatnia Karta",
    "desc": "Dowolna karta End of Game",
    "sourceCategories": [
      "abilityTypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "endofgame"
        ]
      }
    }
  },
  {
    "id": "choice_ongoing",
    "type": "choice",
    "rarity": "legendary",
    "family": "tag",
    "name": "Pętla Nieskończoności",
    "desc": "Dowolny Ongoing",
    "sourceCategories": [
      "abilityTypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "ongoing"
        ]
      }
    }
  },
  {
    "id": "choice_activate",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Sekwencja Aktywacji",
    "desc": "Dowolny Activate",
    "sourceCategories": [
      "abilityTypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "activate"
        ]
      }
    }
  },
  {
    "id": "choice_tech",
    "type": "choice",
    "rarity": "legendary",
    "family": "tag",
    "name": "Kontrśrodek",
    "desc": "Dowolna karta · Tech",
    "sourceCategories": [
      "mechanicFamilies"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "tech"
        ]
      }
    }
  },
  {
    "id": "choice_location_control",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Kontrola Rzeczywistości",
    "desc": "Dowolna karta · Location",
    "sourceCategories": [
      "subtypes"
    ],
    "filter": {
      "tags": {
        "anyOf": [
          "location-control",
          "location-points"
        ]
      }
    }
  },
  {
    "id": "choice_spell",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Arkana",
    "desc": "Dowolna karta · Spells",
    "sourceCategories": [
      "mechanicFamilies"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "spells"
        ]
      }
    }
  },
  {
    "id": "choice_cost_reduction",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Tańsza Przyszłość",
    "desc": "Dowolna karta · Cost Reduction",
    "sourceCategories": [
      "subtypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "cost-reduction"
        ]
      }
    }
  },
  {
    "id": "choice_transform",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Wybrana Forma",
    "desc": "Dowolna karta · Transform",
    "sourceCategories": [
      "subtypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "transform"
        ]
      }
    }
  },
  {
    "id": "choice_text_copy",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Idealne Echo",
    "desc": "Dowolna karta · Text Copy",
    "sourceCategories": [
      "subtypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "text-copy"
        ]
      }
    }
  },
  {
    "id": "choice_revive",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Powrót z Zaświatów",
    "desc": "Dowolna karta · Revive",
    "sourceCategories": [
      "subtypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "revive"
        ]
      }
    }
  },
  {
    "id": "choice_symbiotes",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Więź Symbionta",
    "desc": "Dowolna karta · Symbiotes",
    "sourceCategories": [
      "teams"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "symbiotes"
        ]
      }
    }
  },
  {
    "id": "choice_magicians",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Krąg Magów",
    "desc": "Dowolna karta · Magicians",
    "sourceCategories": [
      "themes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "magicians"
        ]
      }
    }
  },
  {
    "id": "choice_animal",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Dziki Wybór",
    "desc": "Dowolna karta · Animals",
    "sourceCategories": [
      "themes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "animals"
        ]
      }
    }
  },
  {
    "id": "choice_animal_themed",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Zwierzęcy Motyw",
    "desc": "Dowolna karta · Animal Themed",
    "sourceCategories": [
      "themes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "animal-themed"
        ]
      }
    }
  },
  {
    "id": "choice_cardgen_card",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Kuźnia Kart",
    "desc": "Dowolna karta · Card Generation",
    "sourceCategories": [
      "mechanicFamilies"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "card-generation"
        ]
      }
    }
  },
  {
    "id": "choice_on_reveal_low_cost",
    "type": "choice",
    "rarity": "epic",
    "family": "hybrid",
    "name": "Szybkie Odkrycie",
    "desc": "Dowolny On Reveal · Koszt maks. 2",
    "hybridType": "tag-stat",
    "sourceCategories": [
      "statistics",
      "abilityTypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "on-reveal"
        ]
      },
      "cost": {
        "max": 2
      }
    }
  },
  {
    "id": "choice_destroy_high_power",
    "type": "choice",
    "rarity": "epic",
    "family": "hybrid",
    "name": "Ciężki Destroyer",
    "desc": "Dowolna karta · Destroy · Siła 7+",
    "hybridType": "tag-stat",
    "sourceCategories": [
      "hybrid"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "destroy"
        ]
      },
      "power": {
        "min": 7
      }
    }
  },
  {
    "id": "choice_discard_low_cost",
    "type": "choice",
    "rarity": "epic",
    "family": "hybrid",
    "name": "Tani Odrzut",
    "desc": "Dowolny Discard · Koszt maks. 2",
    "hybridType": "tag-stat",
    "sourceCategories": [
      "statistics",
      "mechanicFamilies"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "discard"
        ]
      },
      "cost": {
        "max": 2
      }
    }
  },
  {
    "id": "choice_ongoing_low_cost",
    "type": "choice",
    "rarity": "epic",
    "family": "hybrid",
    "name": "Mała Stała",
    "desc": "Dowolny Ongoing · Koszt maks. 2",
    "hybridType": "tag-stat",
    "sourceCategories": [
      "statistics",
      "abilityTypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "ongoing"
        ]
      },
      "cost": {
        "max": 2
      }
    }
  },
  {
    "id": "choice_move_on_reveal",
    "type": "choice",
    "rarity": "epic",
    "family": "hybrid",
    "name": "Teleport Odkrycia",
    "desc": "Dowolny Move + On Reveal",
    "hybridType": "multi-tag-all",
    "sourceCategories": [
      "abilityTypes",
      "mechanicFamilies"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "move",
          "on-reveal"
        ]
      }
    }
  },
  {
    "id": "choice_cheap_tech",
    "type": "choice",
    "rarity": "epic",
    "family": "hybrid",
    "name": "Tani Specjalista",
    "desc": "Dowolna karta · Tech · Koszt maks. 2",
    "hybridType": "tag-stat",
    "sourceCategories": [
      "hybrid"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "tech"
        ]
      },
      "cost": {
        "max": 2
      }
    }
  },
  {
    "id": "surprise_any_card",
    "type": "surprise",
    "rarity": "rare",
    "family": "special",
    "name": "Ślepe Rozdanie",
    "desc": "Losowa karta",
    "sourceCategories": [
      "special"
    ]
  },
  {
    "id": "surprise_cost_0_1",
    "type": "surprise",
    "rarity": "rare",
    "family": "statistics",
    "name": "Mała Niespodzianka",
    "desc": "Losowa karta · Koszt 0–1",
    "sourceCategories": [
      "statistics"
    ],
    "filter": {
      "cost": {
        "min": 0,
        "max": 1
      }
    }
  },
  {
    "id": "surprise_cost_2",
    "type": "surprise",
    "rarity": "rare",
    "family": "statistics",
    "name": "Podwójny Los",
    "desc": "Losowa karta · Koszt 2",
    "sourceCategories": [
      "statistics"
    ],
    "filter": {
      "cost": {
        "exact": 2
      }
    }
  },
  {
    "id": "surprise_cost_3",
    "type": "surprise",
    "rarity": "rare",
    "family": "statistics",
    "name": "Trzecie Rozdanie",
    "desc": "Losowa karta · Koszt 3",
    "sourceCategories": [
      "statistics"
    ],
    "filter": {
      "cost": {
        "exact": 3
      }
    }
  },
  {
    "id": "surprise_cost_4",
    "type": "surprise",
    "rarity": "rare",
    "family": "statistics",
    "name": "Czwarta Gwiazda",
    "desc": "Losowa karta · Koszt 4",
    "sourceCategories": [
      "statistics"
    ],
    "filter": {
      "cost": {
        "exact": 4
      }
    }
  },
  {
    "id": "surprise_cost_5",
    "type": "surprise",
    "rarity": "rare",
    "family": "statistics",
    "name": "Piąty Sygnał",
    "desc": "Losowa karta · Koszt 5",
    "sourceCategories": [
      "statistics"
    ],
    "filter": {
      "cost": {
        "exact": 5
      }
    }
  },
  {
    "id": "surprise_cost_6_plus",
    "type": "surprise",
    "rarity": "rare",
    "family": "statistics",
    "name": "Kosmiczny Ciężar",
    "desc": "Losowa karta · Koszt 6+",
    "sourceCategories": [
      "statistics"
    ],
    "filter": {
      "cost": {
        "min": 6
      }
    }
  },
  {
    "id": "surprise_cost_0_3",
    "type": "surprise",
    "rarity": "rare",
    "family": "statistics",
    "name": "Niespodzianka z Rękawa",
    "desc": "Losowa karta · Koszt 0–3",
    "sourceCategories": [
      "statistics"
    ],
    "filter": {
      "cost": {
        "min": 0,
        "max": 3
      }
    }
  },
  {
    "id": "surprise_cost_4_plus",
    "type": "surprise",
    "rarity": "rare",
    "family": "statistics",
    "name": "Gwiezdny Ładunek",
    "desc": "Losowa karta · Koszt 4+",
    "sourceCategories": [
      "statistics"
    ],
    "filter": {
      "cost": {
        "min": 4
      }
    }
  },
  {
    "id": "surprise_power_0_or_less",
    "type": "surprise",
    "rarity": "epic",
    "family": "statistics",
    "name": "Infekcja Pustki",
    "desc": "Losowa karta · Siła 0 lub mniej",
    "sourceCategories": [
      "statistics"
    ],
    "filter": {
      "power": {
        "max": 0
      }
    }
  },
  {
    "id": "surprise_power_1_3",
    "type": "surprise",
    "rarity": "rare",
    "family": "statistics",
    "name": "Niska Stawka",
    "desc": "Losowa karta · Siła 1–3",
    "sourceCategories": [
      "statistics"
    ],
    "filter": {
      "power": {
        "min": 1,
        "max": 3
      }
    }
  },
  {
    "id": "surprise_power_4_6",
    "type": "surprise",
    "rarity": "rare",
    "family": "statistics",
    "name": "Środkowe Rozdanie",
    "desc": "Losowa karta · Siła 4–6",
    "sourceCategories": [
      "statistics"
    ],
    "filter": {
      "power": {
        "min": 4,
        "max": 6
      }
    }
  },
  {
    "id": "surprise_power_7_9",
    "type": "surprise",
    "rarity": "epic",
    "family": "statistics",
    "name": "Mocna Ręka",
    "desc": "Losowa karta · Siła 7–9",
    "sourceCategories": [
      "statistics"
    ],
    "filter": {
      "power": {
        "min": 7,
        "max": 9
      }
    }
  },
  {
    "id": "surprise_power_10_plus",
    "type": "surprise",
    "rarity": "epic",
    "family": "statistics",
    "name": "Tytaniczna Niespodzianka",
    "desc": "Losowa karta · Siła 10+",
    "sourceCategories": [
      "statistics"
    ],
    "filter": {
      "power": {
        "min": 10
      }
    }
  },
  {
    "id": "surprise_power_3_or_less",
    "type": "surprise",
    "rarity": "rare",
    "family": "statistics",
    "name": "Niespodzianka z Dolnego Pasma",
    "desc": "Losowa karta · Siła 3 lub mniej",
    "sourceCategories": [
      "statistics"
    ],
    "filter": {
      "power": {
        "max": 3
      }
    }
  },
  {
    "id": "surprise_power_7_plus",
    "type": "surprise",
    "rarity": "epic",
    "family": "statistics",
    "name": "Wielka Stawka",
    "desc": "Losowa karta · Siła 7+",
    "sourceCategories": [
      "statistics"
    ],
    "filter": {
      "power": {
        "min": 7
      }
    }
  },
  {
    "id": "surprise_heavy_brick",
    "type": "surprise",
    "rarity": "epic",
    "family": "statistics",
    "name": "Ciężka Cegła",
    "desc": "Losowa karta · Koszt 5+ · Siła maks. 4",
    "sourceCategories": [
      "statistics"
    ],
    "filter": {
      "cost": {
        "min": 5
      },
      "power": {
        "max": 4
      }
    }
  },
  {
    "id": "surprise_cost_greater_than_power",
    "type": "surprise",
    "rarity": "rare",
    "family": "statistics",
    "name": "Zapadnięta Gwiazda",
    "desc": "Losowa karta · Koszt > Siła",
    "sourceCategories": [
      "statistics"
    ],
    "filter": {
      "relations": [
        {
          "left": "cost",
          "operator": ">",
          "right": "power"
        }
      ]
    }
  },
  {
    "id": "surprise_power_greater_than_cost",
    "type": "surprise",
    "rarity": "rare",
    "family": "statistics",
    "name": "Przeciążenie",
    "desc": "Losowa karta · Siła > Koszt",
    "sourceCategories": [
      "statistics"
    ],
    "filter": {
      "relations": [
        {
          "left": "power",
          "operator": ">",
          "right": "cost"
        }
      ]
    }
  },
  {
    "id": "surprise_equal_cost_power",
    "type": "surprise",
    "rarity": "rare",
    "family": "statistics",
    "name": "Idealna Równowaga",
    "desc": "Losowa karta · Koszt = Siła",
    "sourceCategories": [
      "statistics"
    ],
    "filter": {
      "relations": [
        {
          "left": "cost",
          "operator": "=",
          "right": "power"
        }
      ]
    }
  },
  {
    "id": "surprise_energy_collapse",
    "type": "surprise",
    "rarity": "epic",
    "family": "statistics",
    "name": "Załamanie Energii",
    "desc": "Losowa karta · Koszt 6 · Siła maks. 6",
    "sourceCategories": [
      "statistics"
    ],
    "filter": {
      "cost": {
        "exact": 6
      },
      "power": {
        "max": 6
      }
    }
  },
  {
    "id": "surprise_duelist",
    "type": "surprise",
    "rarity": "rare",
    "family": "statistics",
    "name": "Pojedynek Statystyk",
    "desc": "Losowa karta · Koszt 3 · Siła 3–6",
    "sourceCategories": [
      "statistics"
    ],
    "filter": {
      "cost": {
        "exact": 3
      },
      "power": {
        "min": 3,
        "max": 6
      }
    }
  },
  {
    "id": "surprise_cheap_trick",
    "type": "surprise",
    "rarity": "rare",
    "family": "statistics",
    "name": "Tania Sztuczka",
    "desc": "Losowa karta · Koszt 1 · Siła maks. 2",
    "sourceCategories": [
      "statistics"
    ],
    "filter": {
      "cost": {
        "exact": 1
      },
      "power": {
        "max": 2
      }
    }
  },
  {
    "id": "surprise_stat_monster",
    "type": "surprise",
    "rarity": "epic",
    "family": "statistics",
    "name": "Potwór Statystyk",
    "desc": "Losowa karta · Siła ≥ Koszt + 4",
    "sourceCategories": [
      "statistics"
    ],
    "filter": {
      "relations": [
        {
          "left": "power",
          "operator": ">=",
          "right": "cost",
          "offset": 4
        }
      ]
    }
  },
  {
    "id": "surprise_on_reveal",
    "type": "surprise",
    "rarity": "rare",
    "family": "tag",
    "name": "Niespodziewane Odkrycie",
    "desc": "Losowy On Reveal",
    "sourceCategories": [
      "abilityTypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "on-reveal"
        ]
      }
    }
  },
  {
    "id": "surprise_moveable",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Ruchoma Niespodzianka",
    "desc": "Losowa karta Moveable",
    "sourceCategories": [
      "abilityTypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "moveable"
        ]
      }
    }
  },
  {
    "id": "surprise_no_ability",
    "type": "surprise",
    "rarity": "rare",
    "family": "tag",
    "name": "Czysty Traf",
    "desc": "Losowa karta bez zdolności",
    "sourceCategories": [
      "abilityTypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "no-ability"
        ]
      }
    }
  },
  {
    "id": "surprise_objective",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Nieznana Misja",
    "desc": "Losowa karta Objective",
    "sourceCategories": [
      "abilityTypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "objective"
        ]
      }
    }
  },
  {
    "id": "surprise_start_of_turn",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Sygnał o Świcie",
    "desc": "Losowa karta Start of Turn",
    "sourceCategories": [
      "abilityTypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "startofturn"
        ]
      }
    }
  },
  {
    "id": "surprise_end_of_game",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Ostatnia Niespodzianka",
    "desc": "Losowa karta End of Game",
    "sourceCategories": [
      "abilityTypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "endofgame"
        ]
      }
    }
  },
  {
    "id": "surprise_ongoing",
    "type": "surprise",
    "rarity": "rare",
    "family": "tag",
    "name": "Wieczna Niespodzianka",
    "desc": "Losowy Ongoing",
    "sourceCategories": [
      "abilityTypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "ongoing"
        ]
      }
    }
  },
  {
    "id": "surprise_activate",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Nieznana Aktywacja",
    "desc": "Losowy Activate",
    "sourceCategories": [
      "abilityTypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "activate"
        ]
      }
    }
  },
  {
    "id": "surprise_trigger_card",
    "type": "surprise",
    "rarity": "rare",
    "family": "tag",
    "name": "Czuły Spust",
    "desc": "Losowy Trigger Card",
    "sourceCategories": [
      "abilityTypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "trigger-card"
        ]
      }
    }
  },
  {
    "id": "surprise_end_of_turn",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Ostatni Ruch",
    "desc": "Losowa karta End of Turn",
    "sourceCategories": [
      "abilityTypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "endofturn"
        ]
      }
    }
  },
  {
    "id": "surprise_game_start",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Efekt Motyla",
    "desc": "Losowa karta Game Start",
    "sourceCategories": [
      "abilityTypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "gamestart"
        ]
      }
    }
  },
  {
    "id": "surprise_move",
    "type": "surprise",
    "rarity": "rare",
    "family": "tag",
    "name": "Skok przez Orbitę",
    "desc": "Losowa karta · Move",
    "sourceCategories": [
      "mechanicFamilies"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "move"
        ]
      }
    }
  },
  {
    "id": "surprise_destroy",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Ostrze Losu",
    "desc": "Losowa karta · Destroy",
    "sourceCategories": [
      "mechanicFamilies"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "destroy"
        ]
      }
    }
  },
  {
    "id": "surprise_discard",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Odrzucona Szansa",
    "desc": "Losowa karta · Discard",
    "sourceCategories": [
      "mechanicFamilies"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "discard"
        ]
      }
    }
  },
  {
    "id": "surprise_bounce",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Powrót z Kapelusza",
    "desc": "Losowa karta · Bounce",
    "sourceCategories": [
      "mechanicFamilies"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "bounce"
        ]
      }
    }
  },
  {
    "id": "surprise_afflict",
    "type": "surprise",
    "rarity": "rare",
    "family": "tag",
    "name": "Toksyczna Przesyłka",
    "desc": "Losowa karta · Afflict",
    "sourceCategories": [
      "mechanicFamilies"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "afflict"
        ]
      }
    }
  },
  {
    "id": "surprise_tech",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Plan Awaryjny",
    "desc": "Losowa karta · Tech",
    "sourceCategories": [
      "mechanicFamilies"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "tech"
        ]
      }
    }
  },
  {
    "id": "surprise_clog",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Kosmiczny Zator",
    "desc": "Losowa karta · Clog",
    "sourceCategories": [
      "mechanicFamilies"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "clog"
        ]
      }
    }
  },
  {
    "id": "surprise_mill",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Wyciek Informacji",
    "desc": "Losowa karta · Mill",
    "sourceCategories": [
      "deckArchetypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "mill"
        ]
      }
    }
  },
  {
    "id": "surprise_spell",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Zaklęcie z Rękawa",
    "desc": "Losowa karta · Spells",
    "sourceCategories": [
      "mechanicFamilies"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "spells"
        ]
      }
    }
  },
  {
    "id": "surprise_cardgen_card",
    "type": "surprise",
    "rarity": "rare",
    "family": "tag",
    "name": "Nieznana Dostawa",
    "desc": "Losowa karta · Card Generation",
    "sourceCategories": [
      "mechanicFamilies"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "card-generation"
        ]
      }
    }
  },
  {
    "id": "surprise_location_control",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Pęknięcie Lokacji",
    "desc": "Losowa karta · Location",
    "sourceCategories": [
      "subtypes"
    ],
    "filter": {
      "tags": {
        "anyOf": [
          "location-control",
          "location-points"
        ]
      }
    }
  },
  {
    "id": "surprise_cost_reduction",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Kosmiczna Promocja",
    "desc": "Losowa karta · Cost Reduction",
    "sourceCategories": [
      "subtypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "cost-reduction"
        ]
      }
    }
  },
  {
    "id": "surprise_energy_ramp",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Zastrzyk Energii",
    "desc": "Losowa karta · Energy / Ramp",
    "sourceCategories": [
      "mechanicFamilies",
      "deckArchetypes"
    ],
    "filter": {
      "tags": {
        "anyOf": [
          "energy",
          "ramp"
        ]
      }
    }
  },
  {
    "id": "surprise_revive",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Echo Życia",
    "desc": "Losowa karta · Revive",
    "sourceCategories": [
      "subtypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "revive"
        ]
      }
    }
  },
  {
    "id": "surprise_transform",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Forma z Kapelusza",
    "desc": "Losowa karta · Transform",
    "sourceCategories": [
      "subtypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "transform"
        ]
      }
    }
  },
  {
    "id": "surprise_text_copy",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Echo Tekstu",
    "desc": "Losowa karta · Text Copy",
    "sourceCategories": [
      "subtypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "text-copy"
        ]
      }
    }
  },
  {
    "id": "surprise_disruption",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Sabotaż",
    "desc": "Losowa karta · Disruption",
    "sourceCategories": [
      "mechanicFamilies"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "disruption"
        ]
      }
    }
  },
  {
    "id": "surprise_monsters",
    "type": "surprise",
    "rarity": "rare",
    "family": "tag",
    "name": "Potwór z Cienia",
    "desc": "Losowa karta · Monsters",
    "sourceCategories": [
      "themes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "monsters"
        ]
      }
    }
  },
  {
    "id": "surprise_robots_cyborgs",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Maszyna z Rozdania",
    "desc": "Losowa karta · Robots Cyborgs",
    "sourceCategories": [
      "themes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "robots-cyborgs"
        ]
      }
    }
  },
  {
    "id": "surprise_magicians",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Zaklęty Los",
    "desc": "Losowa karta · Magicians",
    "sourceCategories": [
      "themes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "magicians"
        ]
      }
    }
  },
  {
    "id": "surprise_cosmic_entities",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Głos Kosmosu",
    "desc": "Losowa karta · Cosmic Entities",
    "sourceCategories": [
      "themes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "cosmic-entities"
        ]
      }
    }
  },
  {
    "id": "surprise_symbiotes",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Głos Symbionta",
    "desc": "Losowa karta · Symbiotes",
    "sourceCategories": [
      "teams"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "symbiotes"
        ]
      }
    }
  },
  {
    "id": "surprise_animal",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Dzika Niespodzianka",
    "desc": "Losowa karta · Animals",
    "sourceCategories": [
      "themes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "animals"
        ]
      }
    }
  },
  {
    "id": "surprise_animal_themed",
    "type": "surprise",
    "rarity": "rare",
    "family": "tag",
    "name": "Maska Bestii",
    "desc": "Losowa karta · Animal Themed",
    "sourceCategories": [
      "themes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "animal-themed"
        ]
      }
    }
  },
  {
    "id": "surprise_destroy_or_discard",
    "type": "surprise",
    "rarity": "rare",
    "family": "hybrid",
    "name": "Rozpad Materii",
    "desc": "Losowy Destroy lub Discard",
    "hybridType": "multi-tag-any",
    "sourceCategories": [
      "mechanicFamilies"
    ],
    "filter": {
      "tags": {
        "anyOf": [
          "destroy",
          "discard"
        ]
      }
    }
  },
  {
    "id": "surprise_move_or_bounce",
    "type": "surprise",
    "rarity": "rare",
    "family": "hybrid",
    "name": "Ruchome Sztuczki",
    "desc": "Losowy Move lub Bounce",
    "hybridType": "multi-tag-any",
    "sourceCategories": [
      "mechanicFamilies"
    ],
    "filter": {
      "tags": {
        "anyOf": [
          "move",
          "bounce"
        ]
      }
    }
  },
  {
    "id": "surprise_afflict_or_clog",
    "type": "surprise",
    "rarity": "rare",
    "family": "hybrid",
    "name": "Toksyczny Zator",
    "desc": "Losowy Afflict lub Clog",
    "hybridType": "multi-tag-any",
    "sourceCategories": [
      "mechanicFamilies"
    ],
    "filter": {
      "tags": {
        "anyOf": [
          "afflict",
          "clog"
        ]
      }
    }
  },
  {
    "id": "surprise_ramp_or_cost_reduction",
    "type": "surprise",
    "rarity": "rare",
    "family": "hybrid",
    "name": "Skrót Energetyczny",
    "desc": "Losowy Energy Ramp lub redukcja Kosztu",
    "hybridType": "multi-tag-any",
    "sourceCategories": [
      "mechanicFamilies",
      "subtypes",
      "deckArchetypes"
    ],
    "filter": {
      "tags": {
        "anyOf": [
          "energy",
          "ramp",
          "cost-reduction"
        ]
      }
    }
  },
  {
    "id": "surprise_revive_or_summon",
    "type": "surprise",
    "rarity": "rare",
    "family": "hybrid",
    "name": "Życie po Śmierci",
    "desc": "Losowy Revive lub Summon",
    "hybridType": "multi-tag-any",
    "sourceCategories": [
      "subtypes"
    ],
    "filter": {
      "tags": {
        "anyOf": [
          "revive",
          "summon"
        ]
      }
    }
  },
  {
    "id": "surprise_tech_or_disruption",
    "type": "surprise",
    "rarity": "rare",
    "family": "hybrid",
    "name": "Plan B",
    "desc": "Losowy Tech lub Disruption",
    "hybridType": "multi-tag-any",
    "sourceCategories": [
      "mechanicFamilies"
    ],
    "filter": {
      "tags": {
        "anyOf": [
          "tech",
          "disruption"
        ]
      }
    }
  },
  {
    "id": "surprise_on_reveal_low_cost",
    "type": "surprise",
    "rarity": "rare",
    "family": "hybrid",
    "name": "Szybka Odsłona",
    "desc": "Losowy On Reveal · Koszt maks. 2",
    "hybridType": "tag-stat",
    "sourceCategories": [
      "statistics",
      "abilityTypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "on-reveal"
        ]
      },
      "cost": {
        "max": 2
      }
    }
  },
  {
    "id": "surprise_destroy_high_power",
    "type": "surprise",
    "rarity": "epic",
    "family": "hybrid",
    "name": "Masakra z Orbity",
    "desc": "Losowa karta · Destroy · Siła 7+",
    "hybridType": "tag-stat",
    "sourceCategories": [
      "hybrid"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "destroy"
        ]
      },
      "power": {
        "min": 7
      }
    }
  },
  {
    "id": "surprise_discard_low_cost",
    "type": "surprise",
    "rarity": "epic",
    "family": "hybrid",
    "name": "Odrzut Kieszonkowy",
    "desc": "Losowy Discard · Koszt maks. 2",
    "hybridType": "tag-stat",
    "sourceCategories": [
      "statistics",
      "mechanicFamilies"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "discard"
        ]
      },
      "cost": {
        "max": 2
      }
    }
  },
  {
    "id": "surprise_ongoing_low_cost",
    "type": "surprise",
    "rarity": "epic",
    "family": "hybrid",
    "name": "Mała Nieskończoność",
    "desc": "Losowy Ongoing · Koszt maks. 2",
    "hybridType": "tag-stat",
    "sourceCategories": [
      "statistics",
      "abilityTypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "ongoing"
        ]
      },
      "cost": {
        "max": 2
      }
    }
  },
  {
    "id": "surprise_cheap_tech",
    "type": "surprise",
    "rarity": "epic",
    "family": "hybrid",
    "name": "Awaryjny Gadżet",
    "desc": "Losowa karta · Tech · Koszt maks. 2",
    "hybridType": "tag-stat",
    "sourceCategories": [
      "hybrid"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "tech"
        ]
      },
      "cost": {
        "max": 2
      }
    }
  },
  {
    "id": "surprise_card_generation_low_power",
    "type": "surprise",
    "rarity": "epic",
    "family": "hybrid",
    "name": "Generator z Cienia",
    "desc": "Losowy Card Generation · Siła maks. 2",
    "hybridType": "tag-stat",
    "sourceCategories": [
      "statistics",
      "mechanicFamilies"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "card-generation"
        ]
      },
      "power": {
        "max": 2
      }
    }
  },
  {
    "id": "surprise_trigger_low_cost",
    "type": "surprise",
    "rarity": "rare",
    "family": "hybrid",
    "name": "Szybki Spust",
    "desc": "Losowy Trigger Card · Koszt maks. 2",
    "hybridType": "tag-stat",
    "sourceCategories": [
      "statistics",
      "abilityTypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "trigger-card"
        ]
      },
      "cost": {
        "max": 2
      }
    }
  },
  {
    "id": "surprise_move_on_reveal",
    "type": "surprise",
    "rarity": "epic",
    "family": "hybrid",
    "name": "Niespodziewany Teleport",
    "desc": "Losowy Move + On Reveal",
    "hybridType": "multi-tag-all",
    "sourceCategories": [
      "abilityTypes",
      "mechanicFamilies"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "move",
          "on-reveal"
        ]
      }
    }
  },
  {
    "id": "surprise_destroy_trigger",
    "type": "surprise",
    "rarity": "epic",
    "family": "hybrid",
    "name": "Zapłon Łańcucha",
    "desc": "Losowa karta · Destroy + Trigger Card",
    "hybridType": "multi-tag-all",
    "sourceCategories": [
      "hybrid"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "destroy",
          "trigger-card"
        ]
      }
    }
  },
  {
    "id": "choice_spider_verse",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Sieć Przeznaczenia",
    "desc": "Dowolna karta · Spider Verse",
    "sourceCategories": [
      "teams"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "spider-verse"
        ]
      }
    }
  },
  {
    "id": "surprise_spider_verse",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Skok przez Multiwersum",
    "desc": "Losowa karta · Spider Verse",
    "sourceCategories": [
      "teams"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "spider-verse"
        ]
      }
    }
  },
  {
    "id": "surprise_symbiote_destroy",
    "type": "surprise",
    "rarity": "epic",
    "family": "hybrid",
    "name": "Czarna Biomasa",
    "desc": "Losowa karta · Symbiotes + Destroy",
    "hybridType": "multi-tag-all",
    "sourceCategories": [
      "hybrid"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "symbiotes",
          "destroy"
        ]
      }
    }
  },
  {
    "id": "choice_buff",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Kosmiczne Wzmocnienie",
    "desc": "Dowolna karta · Buff",
    "sourceCategories": [
      "mechanicFamilies"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "buff"
        ]
      }
    }
  },
  {
    "id": "surprise_buff",
    "type": "surprise",
    "rarity": "rare",
    "family": "tag",
    "name": "Zastrzyk Mocy",
    "desc": "Losowa karta · Buff",
    "sourceCategories": [
      "mechanicFamilies"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "buff"
        ]
      }
    }
  },
  {
    "id": "choice_clog",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Blokada Orbitalna",
    "desc": "Dowolna karta · Clog",
    "sourceCategories": [
      "mechanicFamilies"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "clog"
        ]
      }
    }
  },
  {
    "id": "choice_highevo",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Ewolucyjny Wybór",
    "desc": "Dowolna karta · High Evolutionary",
    "sourceCategories": [
      "deckArchetypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "highevo"
        ]
      }
    }
  },
  {
    "id": "surprise_highevo",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Mutacja Przeznaczenia",
    "desc": "Losowa karta · High Evolutionary",
    "sourceCategories": [
      "deckArchetypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "highevo"
        ]
      }
    }
  },
  {
    "id": "choice_merge",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Idealna Fuzja",
    "desc": "Dowolna karta · Merge",
    "sourceCategories": [
      "mechanicFamilies"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "merge"
        ]
      }
    }
  },
  {
    "id": "surprise_merge",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Niespodziewane Scalenie",
    "desc": "Losowa karta · Merge",
    "sourceCategories": [
      "mechanicFamilies"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "merge"
        ]
      }
    }
  },
  {
    "id": "choice_mill",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Kradzież Planu",
    "desc": "Dowolna karta · Mill",
    "sourceCategories": [
      "deckArchetypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "mill"
        ]
      }
    }
  },
  {
    "id": "choice_no_ability_buff",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Czysta Siła",
    "desc": "Dowolna karta · No-Ability Buff",
    "sourceCategories": [
      "deckArchetypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "no-ability-buff"
        ]
      }
    }
  },
  {
    "id": "surprise_no_ability_buff",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Bez Tekstu, Bez Ostrzeżenia",
    "desc": "Losowa karta · No-Ability Buff",
    "sourceCategories": [
      "deckArchetypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "no-ability-buff"
        ]
      }
    }
  },
  {
    "id": "choice_ongoing_combo",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Nieskończona Konstrukcja",
    "desc": "Dowolna karta · Ongoing Combo",
    "sourceCategories": [
      "deckArchetypes"
    ],
    "filter": {
      "tags": {
        "anyOf": [
          "spectrum-ongoing",
          "tribunal-ongoing"
        ]
      }
    }
  },
  {
    "id": "surprise_ongoing_combo",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Stałe Rozdanie",
    "desc": "Losowa karta · Ongoing Combo",
    "sourceCategories": [
      "deckArchetypes"
    ],
    "filter": {
      "tags": {
        "anyOf": [
          "spectrum-ongoing",
          "tribunal-ongoing"
        ]
      }
    }
  },
  {
    "id": "choice_wongreveal",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Mistrz Ceremonii",
    "desc": "Dowolna karta · Wong / On Reveal Combo",
    "sourceCategories": [
      "deckArchetypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "wongreveal"
        ]
      }
    }
  },
  {
    "id": "surprise_wongreveal",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Podwójne Odkrycie",
    "desc": "Losowa karta · Wong / On Reveal Combo",
    "sourceCategories": [
      "deckArchetypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "wongreveal"
        ]
      }
    }
  },
  {
    "id": "choice_zombie",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Dowódca Hordy",
    "desc": "Dowolna karta · Zombie / Horde",
    "sourceCategories": [
      "mechanicFamilies",
      "themes"
    ],
    "filter": {
      "tags": {
        "anyOf": [
          "zombie-horde",
          "zombies"
        ]
      }
    }
  },
  {
    "id": "surprise_zombie",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Horda z Mgły",
    "desc": "Losowa karta · Zombie / Horde",
    "sourceCategories": [
      "mechanicFamilies",
      "themes"
    ],
    "filter": {
      "tags": {
        "anyOf": [
          "zombie-horde",
          "zombies"
        ]
      }
    }
  },
  {
    "id": "choice_zoo",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Kosmiczna Menażeria",
    "desc": "Dowolna karta · Zoo",
    "sourceCategories": [
      "deckArchetypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "zoo"
        ]
      }
    }
  },
  {
    "id": "surprise_zoo",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Dzika Talia",
    "desc": "Losowa karta · Zoo",
    "sourceCategories": [
      "deckArchetypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "zoo"
        ]
      }
    }
  },
  {
    "id": "choice_end_of_turn_combo",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Plan na Zmierzch",
    "desc": "Dowolna karta · End of Turn Combo",
    "sourceCategories": [
      "deckArchetypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "end-of-turn-combo"
        ]
      }
    }
  },
  {
    "id": "surprise_end_of_turn_combo",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Zmierzchowe Rozdanie",
    "desc": "Losowa karta · End of Turn Combo",
    "sourceCategories": [
      "deckArchetypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "end-of-turn-combo"
        ]
      }
    }
  },
  {
    "id": "choice_negative",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Odwrócone Przeznaczenie",
    "desc": "Dowolna karta · Mister Negative",
    "sourceCategories": [
      "deckArchetypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "mister-negative"
        ]
      }
    }
  },
  {
    "id": "surprise_negative",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Negatywna Niespodzianka",
    "desc": "Losowa karta · Mister Negative",
    "sourceCategories": [
      "deckArchetypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "mister-negative"
        ]
      }
    }
  },
  {
    "id": "choice_lockdown",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Klucz do Lokacji",
    "desc": "Dowolna karta · Lockdown",
    "sourceCategories": [
      "deckArchetypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "lockdown"
        ]
      }
    }
  },
  {
    "id": "surprise_lockdown",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Nagła Blokada",
    "desc": "Losowa karta · Lockdown",
    "sourceCategories": [
      "deckArchetypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "lockdown"
        ]
      }
    }
  },
  {
    "id": "choice_scream",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Kontrolowany Wstrząs",
    "desc": "Dowolna karta · Scream / Opponent Move",
    "sourceCategories": [
      "deckArchetypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "scream"
        ]
      }
    }
  },
  {
    "id": "surprise_scream",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Krzyk z Ciemności",
    "desc": "Losowa karta · Scream / Opponent Move",
    "sourceCategories": [
      "deckArchetypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "scream"
        ]
      }
    }
  },
  {
    "id": "choice_mini_movers",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Mikroorbita",
    "desc": "Dowolna karta · Mini Movers",
    "sourceCategories": [
      "deckArchetypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "mini-movers"
        ]
      }
    }
  },
  {
    "id": "surprise_mini_movers",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Mały Skok",
    "desc": "Losowa karta · Mini Movers",
    "sourceCategories": [
      "deckArchetypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "mini-movers"
        ]
      }
    }
  },
  {
    "id": "choice_priority_control",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Pierwszeństwo",
    "desc": "Dowolna karta · Prio Control",
    "sourceCategories": [
      "deckArchetypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "prio-control"
        ]
      }
    }
  },
  {
    "id": "surprise_priority_control",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Przewaga z Rozdania",
    "desc": "Losowa karta · Prio Control",
    "sourceCategories": [
      "deckArchetypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "prio-control"
        ]
      }
    }
  },
  {
    "id": "choice_shou_lao",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Smoczy Wybór",
    "desc": "Dowolna karta · Small Buff",
    "sourceCategories": [
      "deckArchetypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "small-buff"
        ]
      }
    }
  },
  {
    "id": "surprise_shou_lao",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Łaska Shou-Lao",
    "desc": "Losowa karta · Small Buff",
    "sourceCategories": [
      "deckArchetypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "small-buff"
        ]
      }
    }
  },
  {
    "id": "choice_aurora",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Spektrum Aurory",
    "desc": "Dowolna karta · Aurora",
    "sourceCategories": [
      "deckArchetypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "aurora"
        ]
      }
    }
  },
  {
    "id": "surprise_aurora",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Zorza Niespodzianki",
    "desc": "Losowa karta · Aurora",
    "sourceCategories": [
      "deckArchetypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "aurora"
        ]
      }
    }
  },
  {
    "id": "choice_arishem_thanos",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Kosmiczny Arsenał",
    "desc": "Dowolna karta · Arishem / Thanos",
    "sourceCategories": [
      "deckArchetypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "arishem-thanos"
        ]
      }
    }
  },
  {
    "id": "surprise_arishem_thanos",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Kaprys Kosmosu",
    "desc": "Losowa karta · Arishem / Thanos",
    "sourceCategories": [
      "deckArchetypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "arishem-thanos"
        ]
      }
    }
  },
  {
    "id": "choice_hammer_bros",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Kuźnia Młotów",
    "desc": "Dowolna karta · Hammer Bros",
    "sourceCategories": [
      "deckArchetypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "hammer-bros"
        ]
      }
    }
  },
  {
    "id": "surprise_hammer_bros",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Młot z Nieba",
    "desc": "Losowa karta · Hammer Bros",
    "sourceCategories": [
      "deckArchetypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "hammer-bros"
        ]
      }
    }
  },
  {
    "id": "choice_fantomex",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Plan Fantomexa",
    "desc": "Dowolna karta · Fantomex",
    "sourceCategories": [
      "deckArchetypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "fantomex"
        ]
      }
    }
  },
  {
    "id": "surprise_fantomex",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Widmowe Rozdanie",
    "desc": "Losowa karta · Fantomex",
    "sourceCategories": [
      "deckArchetypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "fantomex"
        ]
      }
    }
  },
  {
    "id": "choice_nimrod_phoenix",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Odrodzenie Feniksa",
    "desc": "Dowolna karta · Destroy Combo",
    "sourceCategories": [
      "deckArchetypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "destroy-combo"
        ]
      }
    }
  },
  {
    "id": "surprise_nimrod_phoenix",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Popiół i Stal",
    "desc": "Losowa karta · Destroy Combo",
    "sourceCategories": [
      "deckArchetypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "destroy-combo"
        ]
      }
    }
  },
  {
    "id": "choice_skaar",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Prawo Gigantów",
    "desc": "Dowolna karta · Skaar",
    "sourceCategories": [
      "deckArchetypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "skaar"
        ]
      }
    }
  },
  {
    "id": "surprise_skaar",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Ciężka Ręka",
    "desc": "Losowa karta · Skaar",
    "sourceCategories": [
      "deckArchetypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "skaar"
        ]
      }
    }
  },
  {
    "id": "choice_zombie_galacti",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Galaktyczna Zaraza",
    "desc": "Dowolna karta · Zombie Galacti",
    "sourceCategories": [
      "deckArchetypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "zombie-galacti"
        ]
      }
    }
  },
  {
    "id": "surprise_zombie_galacti",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Zarażony Sygnał",
    "desc": "Losowa karta · Zombie Galacti",
    "sourceCategories": [
      "deckArchetypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "zombie-galacti"
        ]
      }
    }
  },
  {
    "id": "choice_wiccan",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Idealna Krzywa",
    "desc": "Dowolna karta · Ramp",
    "sourceCategories": [
      "deckArchetypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "ramp"
        ]
      }
    }
  },
  {
    "id": "surprise_wiccan",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Magiczny Rozkład",
    "desc": "Losowa karta · Ramp",
    "sourceCategories": [
      "deckArchetypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "ramp"
        ]
      }
    }
  },
  {
    "id": "choice_werewolf_sentry",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Nocny Układ",
    "desc": "Dowolna karta · Werewolf / Sentry",
    "sourceCategories": [
      "deckArchetypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "werewolf-sentry"
        ]
      }
    }
  },
  {
    "id": "surprise_werewolf_sentry",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Pełnia Chaosu",
    "desc": "Losowa karta · Werewolf / Sentry",
    "sourceCategories": [
      "deckArchetypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "werewolf-sentry"
        ]
      }
    }
  },
  {
    "id": "choice_surfer",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Srebrna Fala",
    "desc": "Dowolna karta · Silver Surfer",
    "sourceCategories": [
      "deckArchetypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "surfer-buff"
        ]
      }
    }
  },
  {
    "id": "surprise_surfer",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Kosmiczna Fala",
    "desc": "Losowa karta · Silver Surfer",
    "sourceCategories": [
      "deckArchetypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "surfer-buff"
        ]
      }
    }
  },
  {
    "id": "choice_quickdraw",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Pewna Ręka",
    "desc": "Dowolna karta · Quick Draw",
    "sourceCategories": [
      "abilityTypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "quickdraw"
        ]
      }
    }
  },
  {
    "id": "surprise_quickdraw",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Szybki Strzał",
    "desc": "Losowa karta · Quick Draw",
    "sourceCategories": [
      "abilityTypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "quickdraw"
        ]
      }
    }
  },
  {
    "id": "choice_board_generator",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Kosmiczna Fabryka",
    "desc": "Dowolna karta · Board Generator",
    "sourceCategories": [
      "subtypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "board-generator"
        ]
      }
    }
  },
  {
    "id": "surprise_board_generator",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Nowe Ciała",
    "desc": "Losowa karta · Board Generator",
    "sourceCategories": [
      "subtypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "board-generator"
        ]
      }
    }
  },
  {
    "id": "choice_card_copy",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Lustrzana Kopia",
    "desc": "Dowolna karta · Card Copy",
    "sourceCategories": [
      "subtypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "card-copy"
        ]
      }
    }
  },
  {
    "id": "surprise_card_copy",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Kopia z Rękawa",
    "desc": "Losowa karta · Card Copy",
    "sourceCategories": [
      "subtypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "card-copy"
        ]
      }
    }
  },
  {
    "id": "choice_deck_generator",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Projekt Talii",
    "desc": "Dowolna karta · Deck Generator",
    "sourceCategories": [
      "subtypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "deck-generator"
        ]
      }
    }
  },
  {
    "id": "surprise_deck_generator",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Przesyłka do Talii",
    "desc": "Losowa karta · Deck Generator",
    "sourceCategories": [
      "subtypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "deck-generator"
        ]
      }
    }
  },
  {
    "id": "choice_disruption",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Plan Sabotażu",
    "desc": "Dowolna karta · Disruption",
    "sourceCategories": [
      "mechanicFamilies"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "disruption"
        ]
      }
    }
  },
  {
    "id": "choice_double_power",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Podwójna Moc",
    "desc": "Dowolna karta · Double Power",
    "sourceCategories": [
      "subtypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "double-power"
        ]
      }
    }
  },
  {
    "id": "surprise_double_power",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Podwojenie Stawki",
    "desc": "Losowa karta · Double Power",
    "sourceCategories": [
      "subtypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "double-power"
        ]
      }
    }
  },
  {
    "id": "choice_draw",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Pewny Dobór",
    "desc": "Dowolna karta · Draw",
    "sourceCategories": [
      "subtypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "draw"
        ]
      }
    }
  },
  {
    "id": "surprise_draw",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Karta z Wierzchu",
    "desc": "Losowa karta · Draw",
    "sourceCategories": [
      "subtypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "draw"
        ]
      }
    }
  },
  {
    "id": "choice_delayed_reveal",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Kurtyna Czasu",
    "desc": "Dowolna karta · Delayed Reveal",
    "sourceCategories": [
      "subtypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "delayed-reveal"
        ]
      }
    }
  },
  {
    "id": "surprise_delayed_reveal",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Odsłona po Czasie",
    "desc": "Losowa karta · Delayed Reveal",
    "sourceCategories": [
      "subtypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "delayed-reveal"
        ]
      }
    }
  },
  {
    "id": "choice_effect_multiplier",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Wzmacniacz Efektu",
    "desc": "Dowolna karta · Effect Multiplier",
    "sourceCategories": [
      "subtypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "effect-multiplier"
        ]
      }
    }
  },
  {
    "id": "surprise_effect_multiplier",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Echo Efektu",
    "desc": "Losowa karta · Effect Multiplier",
    "sourceCategories": [
      "subtypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "effect-multiplier"
        ]
      }
    }
  },
  {
    "id": "choice_energy_ramp",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Skok Energetyczny",
    "desc": "Dowolna karta · Energy / Ramp",
    "sourceCategories": [
      "mechanicFamilies",
      "deckArchetypes"
    ],
    "filter": {
      "tags": {
        "anyOf": [
          "energy",
          "ramp"
        ]
      }
    }
  },
  {
    "id": "choice_give_power",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Rozdawca Mocy",
    "desc": "Dowolna karta · Give Power",
    "sourceCategories": [
      "subtypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "give-power"
        ]
      }
    }
  },
  {
    "id": "surprise_give_power",
    "type": "surprise",
    "rarity": "rare",
    "family": "tag",
    "name": "Kosmiczny Zastrzyk",
    "desc": "Losowa karta · Give Power",
    "sourceCategories": [
      "subtypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "give-power"
        ]
      }
    }
  },
  {
    "id": "choice_hand_gen",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Pełna Ręka",
    "desc": "Dowolna karta · Hand Generation",
    "sourceCategories": [
      "subtypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "hand-gen"
        ]
      }
    }
  },
  {
    "id": "surprise_hand_gen",
    "type": "surprise",
    "rarity": "rare",
    "family": "tag",
    "name": "Dostawa do Ręki",
    "desc": "Losowa karta · Hand Generation",
    "sourceCategories": [
      "subtypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "hand-gen"
        ]
      }
    }
  },
  {
    "id": "choice_multi_location_power",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Moc Wielu Światów",
    "desc": "Dowolna karta · Multi-Location Power",
    "sourceCategories": [
      "subtypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "multi-location-power"
        ]
      }
    }
  },
  {
    "id": "surprise_multi_location_power",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Szeroki Rozbłysk",
    "desc": "Losowa karta · Multi-Location Power",
    "sourceCategories": [
      "subtypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "multi-location-power"
        ]
      }
    }
  },
  {
    "id": "choice_scaler",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Rosnąca Potęga",
    "desc": "Dowolna karta · Power Scaler",
    "sourceCategories": [
      "subtypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "scaler"
        ]
      }
    }
  },
  {
    "id": "surprise_scaler",
    "type": "surprise",
    "rarity": "rare",
    "family": "tag",
    "name": "Nieznany Potencjał",
    "desc": "Losowa karta · Power Scaler",
    "sourceCategories": [
      "subtypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "scaler"
        ]
      }
    }
  },
  {
    "id": "choice_self_buff",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Własna Potęga",
    "desc": "Dowolna karta · Self Buff",
    "sourceCategories": [
      "subtypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "self-buff"
        ]
      }
    }
  },
  {
    "id": "surprise_self_buff",
    "type": "surprise",
    "rarity": "rare",
    "family": "tag",
    "name": "Nagły Wzrost",
    "desc": "Losowa karta · Self Buff",
    "sourceCategories": [
      "subtypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "self-buff"
        ]
      }
    }
  },
  {
    "id": "choice_set_power",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Ustawienie Mocy",
    "desc": "Dowolna karta · Set Power",
    "sourceCategories": [
      "subtypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "set-power"
        ]
      }
    }
  },
  {
    "id": "surprise_set_power",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Nowy Poziom",
    "desc": "Losowa karta · Set Power",
    "sourceCategories": [
      "subtypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "set-power"
        ]
      }
    }
  },
  {
    "id": "choice_summon",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Kosmiczne Wezwanie",
    "desc": "Dowolna karta · Summon",
    "sourceCategories": [
      "subtypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "summon"
        ]
      }
    }
  },
  {
    "id": "surprise_summon",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Niespodziewane Przyzwanie",
    "desc": "Losowa karta · Summon",
    "sourceCategories": [
      "subtypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "summon"
        ]
      }
    }
  },
  {
    "id": "choice_unique_card_creation",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Unikat na Życzenie",
    "desc": "Dowolna karta · Unique Card Creation",
    "sourceCategories": [
      "subtypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "unique-card-creation"
        ]
      }
    }
  },
  {
    "id": "surprise_unique_card_creation",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Jedyny w Swoim Rodzaju",
    "desc": "Losowa karta · Unique Card Creation",
    "sourceCategories": [
      "subtypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "unique-card-creation"
        ]
      }
    }
  },
  {
    "id": "choice_random_card_pool",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Generator Losu",
    "desc": "Dowolna karta · Random Card Pool",
    "sourceCategories": [
      "subtypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "random-card-pool"
        ]
      }
    }
  },
  {
    "id": "surprise_random_card_pool",
    "type": "surprise",
    "rarity": "rare",
    "family": "tag",
    "name": "Koło Losu",
    "desc": "Losowa karta · Random Card Pool",
    "sourceCategories": [
      "subtypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "random-card-pool"
        ]
      }
    }
  },
  {
    "id": "choice_text_disruption",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Cisza Absolutna",
    "desc": "Dowolna karta · Text Disruption",
    "sourceCategories": [
      "subtypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "text-disruption"
        ]
      }
    }
  },
  {
    "id": "surprise_text_disruption",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Zakłócenie Tekstu",
    "desc": "Losowa karta · Text Disruption",
    "sourceCategories": [
      "subtypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "text-disruption"
        ]
      }
    }
  },
  {
    "id": "choice_power_steal",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Kradzież Mocy",
    "desc": "Dowolna karta · Power Steal",
    "sourceCategories": [
      "subtypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "power-steal"
        ]
      }
    }
  },
  {
    "id": "surprise_power_steal",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Przechwycenie Mocy",
    "desc": "Losowa karta · Power Steal",
    "sourceCategories": [
      "subtypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "power-steal"
        ]
      }
    }
  },
  {
    "id": "choice_row_interaction",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Linia Frontu",
    "desc": "Dowolna karta · Row Interaction",
    "sourceCategories": [
      "subtypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "row-interaction"
        ]
      }
    }
  },
  {
    "id": "surprise_row_interaction",
    "type": "surprise",
    "rarity": "rare",
    "family": "tag",
    "name": "Ruch w Szeregu",
    "desc": "Losowa karta · Row Interaction",
    "sourceCategories": [
      "subtypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "row-interaction"
        ]
      }
    }
  },
  {
    "id": "choice_full_location",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Pełna Lokacja",
    "desc": "Dowolna karta · Full Location",
    "sourceCategories": [
      "subtypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "full-location"
        ]
      }
    }
  },
  {
    "id": "surprise_full_location",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Tłok na Lokacji",
    "desc": "Losowa karta · Full Location",
    "sourceCategories": [
      "subtypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "full-location"
        ]
      }
    }
  },
  {
    "id": "choice_play_requirement",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Warunek Zagrania",
    "desc": "Dowolna karta · Play Requirement",
    "sourceCategories": [
      "subtypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "play-requirement"
        ]
      }
    }
  },
  {
    "id": "surprise_play_requirement",
    "type": "surprise",
    "rarity": "rare",
    "family": "tag",
    "name": "Ryzykowna Ręka",
    "desc": "Losowa karta · Play Requirement",
    "sourceCategories": [
      "subtypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "play-requirement"
        ]
      }
    }
  },
  {
    "id": "choice_unspent_energy",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Zapas Energii",
    "desc": "Dowolna karta · Unspent Energy",
    "sourceCategories": [
      "subtypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "unspent-energy"
        ]
      }
    }
  },
  {
    "id": "surprise_unspent_energy",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Niewydany Impuls",
    "desc": "Losowa karta · Unspent Energy",
    "sourceCategories": [
      "subtypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "unspent-energy"
        ]
      }
    }
  },
  {
    "id": "choice_winning",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Karta Zwycięstwa",
    "desc": "Dowolna karta · Winning",
    "sourceCategories": [
      "subtypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "winning"
        ]
      }
    }
  },
  {
    "id": "surprise_winning",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "As na Wygraną",
    "desc": "Losowa karta · Winning",
    "sourceCategories": [
      "subtypes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "winning"
        ]
      }
    }
  },
  {
    "id": "choice_zero_downsides",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Cena Potęgi",
    "desc": "Dowolna karta · Downside / Sauron-Nightmare",
    "sourceCategories": [
      "mechanicFamilies",
      "deckArchetypes"
    ],
    "filter": {
      "tags": {
        "anyOf": [
          "downside",
          "sauron-skaar"
        ]
      }
    }
  },
  {
    "id": "surprise_zero_downsides",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Ryzyko i Nagroda",
    "desc": "Losowa karta · Downside / Sauron-Nightmare",
    "sourceCategories": [
      "mechanicFamilies",
      "deckArchetypes"
    ],
    "filter": {
      "tags": {
        "anyOf": [
          "downside",
          "sauron-skaar"
        ]
      }
    }
  },
  {
    "id": "choice_avengers_all",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Zgromadzenie Avengers",
    "desc": "Dowolna karta · Avengers",
    "sourceCategories": [
      "teams"
    ],
    "filter": {
      "tags": {
        "anyOf": [
          "avengers",
          "new-avengers",
          "west-coast-avengers",
          "dark-avengers",
          "young-avengers"
        ]
      }
    }
  },
  {
    "id": "surprise_avengers_all",
    "type": "surprise",
    "rarity": "rare",
    "family": "tag",
    "name": "Wezwanie Avengers",
    "desc": "Losowa karta · Avengers",
    "sourceCategories": [
      "teams"
    ],
    "filter": {
      "tags": {
        "anyOf": [
          "avengers",
          "new-avengers",
          "west-coast-avengers",
          "dark-avengers",
          "young-avengers"
        ]
      }
    }
  },
  {
    "id": "choice_x_family",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Dziedzictwo X",
    "desc": "Dowolna karta · X-Men / X-Force / New Mutants",
    "sourceCategories": [
      "teams"
    ],
    "filter": {
      "tags": {
        "anyOf": [
          "xmen",
          "x-force",
          "new-mutants"
        ]
      }
    }
  },
  {
    "id": "surprise_x_family",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Przebudzenie Genu X",
    "desc": "Losowa karta · X-Men / X-Force / New Mutants",
    "sourceCategories": [
      "teams"
    ],
    "filter": {
      "tags": {
        "anyOf": [
          "xmen",
          "x-force",
          "new-mutants"
        ]
      }
    }
  },
  {
    "id": "choice_annihilators",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Annihilators na Życzenie",
    "desc": "Dowolna karta · Annihilators",
    "sourceCategories": [
      "teams"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "annihilators"
        ]
      }
    }
  },
  {
    "id": "surprise_annihilators",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Kosmiczny Szturm",
    "desc": "Losowa karta · Annihilators",
    "sourceCategories": [
      "teams"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "annihilators"
        ]
      }
    }
  },
  {
    "id": "choice_celestial_eternals",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Wola Celestiali",
    "desc": "Dowolna karta · Celestial Eternals",
    "sourceCategories": [
      "teams"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "celestial-eternals"
        ]
      }
    }
  },
  {
    "id": "surprise_celestial_eternals",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Kosmiczne Dziedzictwo",
    "desc": "Losowa karta · Celestial Eternals",
    "sourceCategories": [
      "teams"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "celestial-eternals"
        ]
      }
    }
  },
  {
    "id": "choice_atlanteans",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Tron Atlantydy",
    "desc": "Dowolna karta · Atlanteans",
    "sourceCategories": [
      "teams"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "atlanteans"
        ]
      }
    }
  },
  {
    "id": "surprise_atlanteans",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Głos Głębin",
    "desc": "Losowa karta · Atlanteans",
    "sourceCategories": [
      "teams"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "atlanteans"
        ]
      }
    }
  },
  {
    "id": "choice_agents_of_atlas",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Rozkaz Atlasu",
    "desc": "Dowolna karta · Agents Of Atlas",
    "sourceCategories": [
      "teams"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "agents-of-atlas"
        ]
      }
    }
  },
  {
    "id": "surprise_agents_of_atlas",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Misja Atlasu",
    "desc": "Losowa karta · Agents Of Atlas",
    "sourceCategories": [
      "teams"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "agents-of-atlas"
        ]
      }
    }
  },
  {
    "id": "choice_cabal",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Tajna Rada",
    "desc": "Dowolna karta · Cabal",
    "sourceCategories": [
      "teams"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "cabal"
        ]
      }
    }
  },
  {
    "id": "surprise_cabal",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Układ Cabalu",
    "desc": "Losowa karta · Cabal",
    "sourceCategories": [
      "teams"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "cabal"
        ]
      }
    }
  },
  {
    "id": "choice_illuminati",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Rada Illuminati",
    "desc": "Dowolna karta · Illuminati",
    "sourceCategories": [
      "teams"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "illuminati"
        ]
      }
    }
  },
  {
    "id": "surprise_illuminati",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Sekretne Rozdanie",
    "desc": "Losowa karta · Illuminati",
    "sourceCategories": [
      "teams"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "illuminati"
        ]
      }
    }
  },
  {
    "id": "choice_brotherhood",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Bractwo na Życzenie",
    "desc": "Dowolna karta · Brotherhood",
    "sourceCategories": [
      "teams"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "brotherhood"
        ]
      }
    }
  },
  {
    "id": "surprise_brotherhood",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Zew Bractwa",
    "desc": "Losowa karta · Brotherhood",
    "sourceCategories": [
      "teams"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "brotherhood"
        ]
      }
    }
  },
  {
    "id": "choice_hellfire_club",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Inner Circle",
    "desc": "Dowolna karta · Hellfire Club",
    "sourceCategories": [
      "teams"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "hellfire-club"
        ]
      }
    }
  },
  {
    "id": "surprise_hellfire_club",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Zaproszenie do Hellfire",
    "desc": "Losowa karta · Hellfire Club",
    "sourceCategories": [
      "teams"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "hellfire-club"
        ]
      }
    }
  },
  {
    "id": "choice_horsemen",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Jeździec Apokalipsy",
    "desc": "Dowolna karta · Horsemen",
    "sourceCategories": [
      "teams"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "horsemen"
        ]
      }
    }
  },
  {
    "id": "surprise_horsemen",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Pieczęć Apokalipsy",
    "desc": "Losowa karta · Horsemen",
    "sourceCategories": [
      "teams"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "horsemen"
        ]
      }
    }
  },
  {
    "id": "choice_hydra",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Rozkaz Hydry",
    "desc": "Dowolna karta · Hydra",
    "sourceCategories": [
      "teams"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "hydra"
        ]
      }
    }
  },
  {
    "id": "surprise_hydra",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Głowa Hydry",
    "desc": "Losowa karta · Hydra",
    "sourceCategories": [
      "teams"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "hydra"
        ]
      }
    }
  },
  {
    "id": "choice_heroes_for_hire",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Kontrakt Bohaterów",
    "desc": "Dowolna karta · Heroes For Hire",
    "sourceCategories": [
      "teams"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "heroes-for-hire"
        ]
      }
    }
  },
  {
    "id": "surprise_heroes_for_hire",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Zlecenie z Ulicy",
    "desc": "Losowa karta · Heroes For Hire",
    "sourceCategories": [
      "teams"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "heroes-for-hire"
        ]
      }
    }
  },
  {
    "id": "choice_marvel_knights",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Nocna Straż",
    "desc": "Dowolna karta · Marvel Knights",
    "sourceCategories": [
      "teams"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "marvel-knights"
        ]
      }
    }
  },
  {
    "id": "surprise_marvel_knights",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Miejski Patrol",
    "desc": "Losowa karta · Marvel Knights",
    "sourceCategories": [
      "teams"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "marvel-knights"
        ]
      }
    }
  },
  {
    "id": "choice_future_foundation",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Projekt Przyszłość",
    "desc": "Dowolna karta · Future Foundation",
    "sourceCategories": [
      "teams"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "future-foundation"
        ]
      }
    }
  },
  {
    "id": "surprise_future_foundation",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Fundacja Przyszłości",
    "desc": "Losowa karta · Future Foundation",
    "sourceCategories": [
      "teams"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "future-foundation"
        ]
      }
    }
  },
  {
    "id": "choice_defenders",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Linia Obrony",
    "desc": "Dowolna karta · Defenders",
    "sourceCategories": [
      "teams"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "defenders"
        ]
      }
    }
  },
  {
    "id": "surprise_defenders",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Obrońca z Cienia",
    "desc": "Losowa karta · Defenders",
    "sourceCategories": [
      "teams"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "defenders"
        ]
      }
    }
  },
  {
    "id": "choice_wakanda",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Wybór Wakandy",
    "desc": "Dowolna karta · Wakanda",
    "sourceCategories": [
      "teams"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "wakanda"
        ]
      }
    }
  },
  {
    "id": "surprise_wakanda",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Dar Wakandy",
    "desc": "Losowa karta · Wakanda",
    "sourceCategories": [
      "teams"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "wakanda"
        ]
      }
    }
  },
  {
    "id": "choice_black_order",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Rozkaz Thanosa",
    "desc": "Dowolna karta · Black Order",
    "sourceCategories": [
      "teams"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "black-order"
        ]
      }
    }
  },
  {
    "id": "surprise_black_order",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Czarny Rozkaz",
    "desc": "Losowa karta · Black Order",
    "sourceCategories": [
      "teams"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "black-order"
        ]
      }
    }
  },
  {
    "id": "choice_asgardians",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Wola Asgardu",
    "desc": "Dowolna karta · Asgardians",
    "sourceCategories": [
      "teams"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "asgardians"
        ]
      }
    }
  },
  {
    "id": "surprise_asgardians",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Bifrost Przeznaczenia",
    "desc": "Losowa karta · Asgardians",
    "sourceCategories": [
      "teams"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "asgardians"
        ]
      }
    }
  },
  {
    "id": "choice_fantastic4",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Fantastyczny Wybór",
    "desc": "Dowolna karta · Fantastic4",
    "sourceCategories": [
      "teams"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "fantastic4"
        ]
      }
    }
  },
  {
    "id": "surprise_fantastic4",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Fantastyczna Niespodzianka",
    "desc": "Losowa karta · Fantastic4",
    "sourceCategories": [
      "teams"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "fantastic4"
        ]
      }
    }
  },
  {
    "id": "choice_guardians",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Strażnicy na Wezwanie",
    "desc": "Dowolna karta · Guardians",
    "sourceCategories": [
      "teams"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "guardians"
        ]
      }
    }
  },
  {
    "id": "surprise_guardians",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Kosmiczny Strażnik",
    "desc": "Losowa karta · Guardians",
    "sourceCategories": [
      "teams"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "guardians"
        ]
      }
    }
  },
  {
    "id": "choice_inhumans",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Królewski Wybór",
    "desc": "Dowolna karta · Inhumans",
    "sourceCategories": [
      "teams"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "inhumans"
        ]
      }
    }
  },
  {
    "id": "surprise_inhumans",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Terrigenowa Niespodzianka",
    "desc": "Losowa karta · Inhumans",
    "sourceCategories": [
      "teams"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "inhumans"
        ]
      }
    }
  },
  {
    "id": "choice_midnight_sons",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Krąg Północy",
    "desc": "Dowolna karta · Midnight Sons",
    "sourceCategories": [
      "teams"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "midnight-sons"
        ]
      }
    }
  },
  {
    "id": "surprise_midnight_sons",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Nocne Przyzwanie",
    "desc": "Losowa karta · Midnight Sons",
    "sourceCategories": [
      "teams"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "midnight-sons"
        ]
      }
    }
  },
  {
    "id": "choice_shield",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Dyrektywa S.H.I.E.L.D.",
    "desc": "Dowolna karta · Shield",
    "sourceCategories": [
      "teams"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "shield"
        ]
      }
    }
  },
  {
    "id": "surprise_shield",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Tajna Misja",
    "desc": "Losowa karta · Shield",
    "sourceCategories": [
      "teams"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "shield"
        ]
      }
    }
  },
  {
    "id": "choice_sinister_six",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Złowieszcza Szóstka",
    "desc": "Dowolna karta · Sinister Six",
    "sourceCategories": [
      "teams"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "sinister-six"
        ]
      }
    }
  },
  {
    "id": "surprise_sinister_six",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Złowieszcze Rozdanie",
    "desc": "Losowa karta · Sinister Six",
    "sourceCategories": [
      "teams"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "sinister-six"
        ]
      }
    }
  },
  {
    "id": "choice_thunderbolts",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Projekt Thunderbolts",
    "desc": "Dowolna karta · Thunderbolts",
    "sourceCategories": [
      "teams"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "thunderbolts"
        ]
      }
    }
  },
  {
    "id": "surprise_thunderbolts",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Rekrutacja Thunderbolts",
    "desc": "Losowa karta · Thunderbolts",
    "sourceCategories": [
      "teams"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "thunderbolts"
        ]
      }
    }
  },
  {
    "id": "choice_monsters",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Bestiariusz",
    "desc": "Dowolna karta · Monsters",
    "sourceCategories": [
      "themes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "monsters"
        ]
      }
    }
  },
  {
    "id": "choice_robots_cyborgs",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Stalowy Wybór",
    "desc": "Dowolna karta · Robots Cyborgs",
    "sourceCategories": [
      "themes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "robots-cyborgs"
        ]
      }
    }
  },
  {
    "id": "choice_antiheroes",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Szara Strefa",
    "desc": "Dowolna karta · Antiheroes",
    "sourceCategories": [
      "themes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "antiheroes"
        ]
      }
    }
  },
  {
    "id": "surprise_antiheroes",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Niepewny Bohater",
    "desc": "Losowa karta · Antiheroes",
    "sourceCategories": [
      "themes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "antiheroes"
        ]
      }
    }
  },
  {
    "id": "choice_villains",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Galeria Złoczyńców",
    "desc": "Dowolna karta · Villains",
    "sourceCategories": [
      "themes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "villains"
        ]
      }
    }
  },
  {
    "id": "surprise_villains",
    "type": "surprise",
    "rarity": "rare",
    "family": "tag",
    "name": "Złoczyńca z Talii",
    "desc": "Losowa karta · Villains",
    "sourceCategories": [
      "themes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "villains"
        ]
      }
    }
  },
  {
    "id": "choice_cosmic_entities",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Wola Kosmosu",
    "desc": "Dowolna karta · Cosmic Entities",
    "sourceCategories": [
      "themes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "cosmic-entities"
        ]
      }
    }
  },
  {
    "id": "choice_geniuses",
    "type": "choice",
    "rarity": "epic",
    "family": "tag",
    "name": "Umysł Stratega",
    "desc": "Dowolna karta · Geniuses",
    "sourceCategories": [
      "themes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "geniuses"
        ]
      }
    }
  },
  {
    "id": "surprise_geniuses",
    "type": "surprise",
    "rarity": "epic",
    "family": "tag",
    "name": "Genialny Traf",
    "desc": "Losowa karta · Geniuses",
    "sourceCategories": [
      "themes"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "geniuses"
        ]
      }
    }
  },
  {
    "id": "choice_power_gte_cost",
    "type": "choice",
    "rarity": "epic",
    "family": "statistics",
    "name": "Przewaga Statystyk",
    "desc": "Dowolna karta · Siła ≥ Koszt",
    "sourceCategories": [
      "statistics"
    ],
    "filter": {
      "relations": [
        {
          "left": "power",
          "operator": ">=",
          "right": "cost"
        }
      ]
    }
  },
  {
    "id": "surprise_power_gte_cost",
    "type": "surprise",
    "rarity": "rare",
    "family": "statistics",
    "name": "Moc Ponad Cenę",
    "desc": "Losowa karta · Siła ≥ Koszt",
    "sourceCategories": [
      "statistics"
    ],
    "filter": {
      "relations": [
        {
          "left": "power",
          "operator": ">=",
          "right": "cost"
        }
      ]
    }
  },
  {
    "id": "choice_power_greater_than_cost",
    "type": "choice",
    "rarity": "epic",
    "family": "statistics",
    "name": "Dodatni Bilans",
    "desc": "Dowolna karta · Siła > Koszt",
    "sourceCategories": [
      "statistics"
    ],
    "filter": {
      "relations": [
        {
          "left": "power",
          "operator": ">",
          "right": "cost"
        }
      ]
    }
  },
  {
    "id": "choice_power_gte_cost_plus2",
    "type": "choice",
    "rarity": "epic",
    "family": "statistics",
    "name": "Nadwyżka Mocy",
    "desc": "Dowolna karta · Siła ≥ Koszt + 2",
    "sourceCategories": [
      "statistics"
    ],
    "filter": {
      "relations": [
        {
          "left": "power",
          "operator": ">=",
          "right": "cost",
          "offset": 2
        }
      ]
    }
  },
  {
    "id": "surprise_power_gte_cost_plus2",
    "type": "surprise",
    "rarity": "rare",
    "family": "statistics",
    "name": "Mocny Traf",
    "desc": "Losowa karta · Siła ≥ Koszt + 2",
    "sourceCategories": [
      "statistics"
    ],
    "filter": {
      "relations": [
        {
          "left": "power",
          "operator": ">=",
          "right": "cost",
          "offset": 2
        }
      ]
    }
  },
  {
    "id": "choice_power_gte_cost_plus4",
    "type": "choice",
    "rarity": "epic",
    "family": "statistics",
    "name": "Potęga Bez Kompromisów",
    "desc": "Dowolna karta · Siła ≥ Koszt + 4",
    "sourceCategories": [
      "statistics"
    ],
    "filter": {
      "relations": [
        {
          "left": "power",
          "operator": ">=",
          "right": "cost",
          "offset": 4
        }
      ]
    }
  },
  {
    "id": "choice_cost_gte_power",
    "type": "choice",
    "rarity": "epic",
    "family": "statistics",
    "name": "Ukryta Wartość",
    "desc": "Dowolna karta · Koszt ≥ Siła",
    "sourceCategories": [
      "statistics"
    ],
    "filter": {
      "relations": [
        {
          "left": "cost",
          "operator": ">=",
          "right": "power"
        }
      ]
    }
  },
  {
    "id": "surprise_cost_gte_power",
    "type": "surprise",
    "rarity": "rare",
    "family": "statistics",
    "name": "Ciężar Efektu",
    "desc": "Losowa karta · Koszt ≥ Siła",
    "sourceCategories": [
      "statistics"
    ],
    "filter": {
      "relations": [
        {
          "left": "cost",
          "operator": ">=",
          "right": "power"
        }
      ]
    }
  },
  {
    "id": "choice_cost_greater_than_power",
    "type": "choice",
    "rarity": "epic",
    "family": "statistics",
    "name": "Silnik pod Maską",
    "desc": "Dowolna karta · Koszt > Siła",
    "sourceCategories": [
      "statistics"
    ],
    "filter": {
      "relations": [
        {
          "left": "cost",
          "operator": ">",
          "right": "power"
        }
      ]
    }
  },
  {
    "id": "choice_cost_gte_power_plus2",
    "type": "choice",
    "rarity": "epic",
    "family": "statistics",
    "name": "Efekt Ponad Staty",
    "desc": "Dowolna karta · Koszt ≥ Siła + 2",
    "sourceCategories": [
      "statistics"
    ],
    "filter": {
      "relations": [
        {
          "left": "cost",
          "operator": ">=",
          "right": "power",
          "offset": 2
        }
      ]
    }
  },
  {
    "id": "surprise_cost_gte_power_plus2",
    "type": "surprise",
    "rarity": "epic",
    "family": "statistics",
    "name": "Ukryty Silnik",
    "desc": "Losowa karta · Koszt ≥ Siła + 2",
    "sourceCategories": [
      "statistics"
    ],
    "filter": {
      "relations": [
        {
          "left": "cost",
          "operator": ">=",
          "right": "power",
          "offset": 2
        }
      ]
    }
  },
  {
    "id": "choice_equal_cost_power",
    "type": "choice",
    "rarity": "epic",
    "family": "statistics",
    "name": "Idealny Bilans",
    "desc": "Dowolna karta · Koszt = Siła",
    "sourceCategories": [
      "statistics"
    ],
    "filter": {
      "relations": [
        {
          "left": "cost",
          "operator": "=",
          "right": "power"
        }
      ]
    }
  },
  {
    "id": "choice_efficient_low_cost",
    "type": "choice",
    "rarity": "epic",
    "family": "statistics",
    "name": "Rakieta Startowa",
    "desc": "Dowolna karta · Koszt maks. 3 · Siła 5+",
    "sourceCategories": [
      "statistics"
    ],
    "filter": {
      "cost": {
        "max": 3
      },
      "power": {
        "min": 5
      }
    }
  },
  {
    "id": "surprise_efficient_low_cost",
    "type": "surprise",
    "rarity": "epic",
    "family": "statistics",
    "name": "Tani Potwór",
    "desc": "Losowa karta · Koszt maks. 3 · Siła 5+",
    "sourceCategories": [
      "statistics"
    ],
    "filter": {
      "cost": {
        "max": 3
      },
      "power": {
        "min": 5
      }
    }
  },
  {
    "id": "choice_cheap_powerhouse",
    "type": "choice",
    "rarity": "epic",
    "family": "statistics",
    "name": "Kieszonkowa Potęga",
    "desc": "Dowolna karta · Koszt maks. 2 · Siła 4+",
    "sourceCategories": [
      "statistics"
    ],
    "filter": {
      "cost": {
        "max": 2
      },
      "power": {
        "min": 4
      }
    }
  },
  {
    "id": "surprise_cheap_powerhouse",
    "type": "surprise",
    "rarity": "epic",
    "family": "statistics",
    "name": "Mały Gigant",
    "desc": "Losowa karta · Koszt maks. 2 · Siła 4+",
    "sourceCategories": [
      "statistics"
    ],
    "filter": {
      "cost": {
        "max": 2
      },
      "power": {
        "min": 4
      }
    }
  },
  {
    "id": "choice_heavy_hitter",
    "type": "choice",
    "rarity": "epic",
    "family": "statistics",
    "name": "Kosmiczny Finisher",
    "desc": "Dowolna karta · Koszt 5+ · Siła 10+",
    "sourceCategories": [
      "statistics"
    ],
    "filter": {
      "cost": {
        "min": 5
      },
      "power": {
        "min": 10
      }
    }
  },
  {
    "id": "surprise_heavy_hitter",
    "type": "surprise",
    "rarity": "epic",
    "family": "statistics",
    "name": "Ciężki Finisher",
    "desc": "Losowa karta · Koszt 5+ · Siła 10+",
    "sourceCategories": [
      "statistics"
    ],
    "filter": {
      "cost": {
        "min": 5
      },
      "power": {
        "min": 10
      }
    }
  },
  {
    "id": "choice_upper_curve_power",
    "type": "choice",
    "rarity": "epic",
    "family": "statistics",
    "name": "Ciężka Artyleria",
    "desc": "Dowolna karta · Koszt 4+ · Siła 8+",
    "sourceCategories": [
      "statistics"
    ],
    "filter": {
      "cost": {
        "min": 4
      },
      "power": {
        "min": 8
      }
    }
  },
  {
    "id": "surprise_upper_curve_power",
    "type": "surprise",
    "rarity": "epic",
    "family": "statistics",
    "name": "Salwa z Orbity",
    "desc": "Losowa karta · Koszt 4+ · Siła 8+",
    "sourceCategories": [
      "statistics"
    ],
    "filter": {
      "cost": {
        "min": 4
      },
      "power": {
        "min": 8
      }
    }
  },
  {
    "id": "choice_low_power_engine",
    "type": "choice",
    "rarity": "epic",
    "family": "statistics",
    "name": "Cichy Silnik",
    "desc": "Dowolna karta · Koszt maks. 3 · Siła 0 lub mniej",
    "sourceCategories": [
      "statistics"
    ],
    "filter": {
      "cost": {
        "max": 3
      },
      "power": {
        "max": 0
      }
    }
  },
  {
    "id": "surprise_low_power_engine",
    "type": "surprise",
    "rarity": "epic",
    "family": "statistics",
    "name": "Ukryty Mechanizm",
    "desc": "Losowa karta · Koszt maks. 3 · Siła 0 lub mniej",
    "sourceCategories": [
      "statistics"
    ],
    "filter": {
      "cost": {
        "max": 3
      },
      "power": {
        "max": 0
      }
    }
  },
  {
    "id": "choice_massive_finisher",
    "type": "choice",
    "rarity": "epic",
    "family": "statistics",
    "name": "Kolaps Gwiazdy",
    "desc": "Dowolna karta · Koszt 6+ · Siła 12+",
    "sourceCategories": [
      "statistics"
    ],
    "filter": {
      "cost": {
        "min": 6
      },
      "power": {
        "min": 12
      }
    }
  },
  {
    "id": "surprise_massive_finisher",
    "type": "surprise",
    "rarity": "epic",
    "family": "statistics",
    "name": "Nadciąga Kolos",
    "desc": "Losowa karta · Koszt 6+ · Siła 12+",
    "sourceCategories": [
      "statistics"
    ],
    "filter": {
      "cost": {
        "min": 6
      },
      "power": {
        "min": 12
      }
    }
  },
  {
    "id": "choice_heavy_brick",
    "type": "choice",
    "rarity": "epic",
    "family": "statistics",
    "name": "Ciężki Silnik",
    "desc": "Dowolna karta · Koszt 5+ · Siła maks. 4",
    "sourceCategories": [
      "statistics"
    ],
    "filter": {
      "cost": {
        "min": 5
      },
      "power": {
        "max": 4
      }
    }
  },
  {
    "id": "choice_energy_collapse",
    "type": "choice",
    "rarity": "epic",
    "family": "statistics",
    "name": "Załamanie Kontrolowane",
    "desc": "Dowolna karta · Koszt 6 · Siła maks. 6",
    "sourceCategories": [
      "statistics"
    ],
    "filter": {
      "cost": {
        "exact": 6
      },
      "power": {
        "max": 6
      }
    }
  },
  {
    "id": "choice_duelist",
    "type": "choice",
    "rarity": "epic",
    "family": "statistics",
    "name": "Wybór Duelisty",
    "desc": "Dowolna karta · Koszt 3 · Siła 3–6",
    "sourceCategories": [
      "statistics"
    ],
    "filter": {
      "cost": {
        "exact": 3
      },
      "power": {
        "min": 3,
        "max": 6
      }
    }
  },
  {
    "id": "choice_cheap_trick",
    "type": "choice",
    "rarity": "epic",
    "family": "statistics",
    "name": "Sztuczka na Życzenie",
    "desc": "Dowolna karta · Koszt 1 · Siła maks. 2",
    "sourceCategories": [
      "statistics"
    ],
    "filter": {
      "cost": {
        "exact": 1
      },
      "power": {
        "max": 2
      }
    }
  },
  {
    "id": "choice_banned_card",
    "type": "choice",
    "rarity": "legendary",
    "family": "special",
    "name": "Zakazany As",
    "desc": "Dowolna banowana karta",
    "sourceCategories": [
      "special"
    ],
    "poolSource": {
      "kind": "banned-cards",
      "excludeOwnDeck": true,
      "excludeNames": [
        "Loki",
        "Arishem"
      ]
    }
  },
  {
    "id": "surprise_banned_card",
    "type": "surprise",
    "rarity": "legendary",
    "family": "special",
    "name": "Zakazane Rozdanie",
    "desc": "3 losowe banowane karty · wybierz 1",
    "sourceCategories": [
      "special"
    ],
    "poolSource": {
      "kind": "banned-cards",
      "excludeOwnDeck": true,
      "excludeNames": [
        "Loki",
        "Arishem"
      ]
    }
  },
  {
    "id": "choice_opponent_drafted",
    "type": "choice",
    "rarity": "legendary",
    "family": "special",
    "name": "Echo Rywali",
    "desc": "Kopia dowolnej karty wybranej już przez innego gracza",
    "sourceCategories": [
      "special"
    ],
    "poolSource": {
      "kind": "drafted-by-others",
      "excludeOwnDeck": true
    }
  },
  {
    "id": "surprise_opponent_drafted",
    "type": "surprise",
    "rarity": "epic",
    "family": "special",
    "name": "Powtórka z Draftu",
    "desc": "3 losowe karty wybrane już przez innych graczy · wybierz 1 kopię",
    "sourceCategories": [
      "special"
    ],
    "poolSource": {
      "kind": "drafted-by-others",
      "excludeOwnDeck": true
    }
  },
  {
    "id": "choice_graveyard_copy",
    "type": "choice",
    "rarity": "legendary",
    "family": "special",
    "name": "Archiwum Umarłych",
    "desc": "Kopia dowolnej realnej karty z Kosmicznego Cmentarzyska",
    "sourceCategories": [
      "special"
    ],
    "poolSource": {
      "kind": "graveyard",
      "status": "available",
      "excludeJokers": true,
      "excludeOwnDeck": true
    }
  },
  {
    "id": "surprise_graveyard_copy",
    "type": "surprise",
    "rarity": "epic",
    "family": "special",
    "name": "Szept Cmentarzyska",
    "desc": "3 losowe realne karty z Kosmicznego Cmentarzyska · wybierz 1 kopię",
    "sourceCategories": [
      "special"
    ],
    "poolSource": {
      "kind": "graveyard",
      "status": "available",
      "excludeJokers": true,
      "excludeOwnDeck": true
    }
  },
  {
    "id": "choice_joker_rejected",
    "type": "choice",
    "rarity": "epic",
    "family": "special",
    "name": "Druga Szansa",
    "desc": "Kopia dowolnej karty odrzuconej wcześniej przez Surprise Jokera",
    "sourceCategories": [
      "special"
    ],
    "poolSource": {
      "kind": "graveyard",
      "categories": [
        "jokerRejected"
      ],
      "status": "available",
      "excludeJokers": true,
      "excludeOwnDeck": true
    }
  },
  {
    "id": "surprise_joker_rejected",
    "type": "surprise",
    "rarity": "epic",
    "family": "special",
    "name": "Odrzucone Przeznaczenie",
    "desc": "3 losowe karty odrzucone wcześniej przez Surprise Jokery · wybierz 1 kopię",
    "sourceCategories": [
      "special"
    ],
    "poolSource": {
      "kind": "graveyard",
      "categories": [
        "jokerRejected"
      ],
      "status": "available",
      "excludeJokers": true,
      "excludeOwnDeck": true
    }
  },
  {
    "id": "choice_completed_pack_history",
    "type": "choice",
    "rarity": "legendary",
    "family": "special",
    "name": "Archiwum Paczek",
    "desc": "Kopia dowolnej realnej karty widzianej we wcześniej zakończonych paczkach",
    "sourceCategories": [
      "special"
    ],
    "poolSource": {
      "kind": "completed-packs",
      "excludeJokers": true,
      "excludeOwnDeck": true
    }
  },
  {
    "id": "surprise_completed_pack_history",
    "type": "surprise",
    "rarity": "epic",
    "family": "special",
    "name": "Kosmiczna Powtórka",
    "desc": "3 losowe karty z wcześniej zakończonych paczek · wybierz 1 kopię",
    "sourceCategories": [
      "special"
    ],
    "poolSource": {
      "kind": "completed-packs",
      "excludeJokers": true,
      "excludeOwnDeck": true
    }
  },
  {
    "id": "choice_current_pack_copy",
    "type": "choice",
    "rarity": "legendary",
    "family": "special",
    "name": "Lustrzane Rozdanie",
    "desc": "Kopia dowolnej realnej karty z aktualnej paczki",
    "sourceCategories": [
      "special"
    ],
    "poolSource": {
      "kind": "current-pack",
      "excludeJokers": true,
      "excludeOwnDeck": true
    }
  },
  {
    "id": "choice_on_reveal_cost4",
    "type": "choice",
    "rarity": "epic",
    "family": "hybrid",
    "hybridType": "tag-stat",
    "name": "Wielki Reveal",
    "desc": "Dowolna karta · On Reveal · Koszt 4+",
    "sourceCategories": [
      "hybrid"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "on-reveal"
        ]
      },
      "cost": {
        "min": 4
      }
    }
  },
  {
    "id": "surprise_on_reveal_cost4",
    "type": "surprise",
    "rarity": "rare",
    "family": "hybrid",
    "hybridType": "tag-stat",
    "name": "Ostatnie Odkrycie",
    "desc": "Losowa karta · On Reveal · Koszt 4+",
    "sourceCategories": [
      "hybrid"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "on-reveal"
        ]
      },
      "cost": {
        "min": 4
      }
    }
  },
  {
    "id": "choice_ongoing_cost3_or_less",
    "type": "choice",
    "rarity": "epic",
    "family": "hybrid",
    "hybridType": "tag-stat",
    "name": "Wieczny Silnik",
    "desc": "Dowolna karta · Ongoing · Koszt maks. 3",
    "sourceCategories": [
      "hybrid"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "ongoing"
        ]
      },
      "cost": {
        "max": 3
      }
    }
  },
  {
    "id": "surprise_ongoing_cost3_or_less",
    "type": "surprise",
    "rarity": "rare",
    "family": "hybrid",
    "hybridType": "tag-stat",
    "name": "Tani Ongoing",
    "desc": "Losowa karta · Ongoing · Koszt maks. 3",
    "sourceCategories": [
      "hybrid"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "ongoing"
        ]
      },
      "cost": {
        "max": 3
      }
    }
  },
  {
    "id": "choice_animals_cost2_or_less",
    "type": "choice",
    "rarity": "epic",
    "family": "hybrid",
    "hybridType": "faction-stat",
    "name": "Tania Bestia",
    "desc": "Dowolna karta · Animals · Koszt maks. 2",
    "sourceCategories": [
      "hybrid"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "animals"
        ]
      },
      "cost": {
        "max": 2
      }
    }
  },
  {
    "id": "surprise_animals_cost2_or_less",
    "type": "surprise",
    "rarity": "epic",
    "family": "hybrid",
    "hybridType": "faction-stat",
    "name": "Dziki Start",
    "desc": "Losowa karta · Animals · Koszt maks. 2",
    "sourceCategories": [
      "hybrid"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "animals"
        ]
      },
      "cost": {
        "max": 2
      }
    }
  },
  {
    "id": "choice_cosmic_cost5_plus",
    "type": "choice",
    "rarity": "epic",
    "family": "hybrid",
    "hybridType": "faction-stat",
    "name": "Kosmiczny Tytan",
    "desc": "Dowolna karta · Cosmic Entities · Koszt 5+",
    "sourceCategories": [
      "hybrid"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "cosmic-entities"
        ]
      },
      "cost": {
        "min": 5
      }
    }
  },
  {
    "id": "surprise_cosmic_cost5_plus",
    "type": "surprise",
    "rarity": "epic",
    "family": "hybrid",
    "hybridType": "faction-stat",
    "name": "Gniew Kosmosu",
    "desc": "Losowa karta · Cosmic Entities · Koszt 5+",
    "sourceCategories": [
      "hybrid"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "cosmic-entities"
        ]
      },
      "cost": {
        "min": 5
      }
    }
  },
  {
    "id": "choice_avengers_cost3_or_less",
    "type": "choice",
    "rarity": "epic",
    "family": "hybrid",
    "hybridType": "faction-stat",
    "name": "Avengers Assemble!",
    "desc": "Dowolna karta · Avengers family · Koszt maks. 3",
    "sourceCategories": [
      "hybrid"
    ],
    "filter": {
      "tags": {
        "anyOf": [
          "avengers",
          "new-avengers",
          "west-coast-avengers",
          "dark-avengers",
          "young-avengers"
        ]
      },
      "cost": {
        "max": 3
      }
    }
  },
  {
    "id": "surprise_avengers_cost3_or_less",
    "type": "surprise",
    "rarity": "rare",
    "family": "hybrid",
    "hybridType": "faction-stat",
    "name": "Avengers Reinforcement",
    "desc": "Losowa karta · Avengers family · Koszt maks. 3",
    "sourceCategories": [
      "hybrid"
    ],
    "filter": {
      "tags": {
        "anyOf": [
          "avengers",
          "new-avengers",
          "west-coast-avengers",
          "dark-avengers",
          "young-avengers"
        ]
      },
      "cost": {
        "max": 3
      }
    }
  },
  {
    "id": "choice_x_family_power5_plus",
    "type": "choice",
    "rarity": "rare",
    "family": "hybrid",
    "hybridType": "faction-stat",
    "name": "Mutant Elite",
    "desc": "Dowolna karta · X-family · Siła 5+",
    "sourceCategories": [
      "hybrid"
    ],
    "filter": {
      "tags": {
        "anyOf": [
          "xmen",
          "x-force",
          "new-mutants"
        ]
      },
      "power": {
        "min": 5
      }
    }
  },
  {
    "id": "surprise_x_family_power5_plus",
    "type": "surprise",
    "rarity": "epic",
    "family": "hybrid",
    "hybridType": "faction-stat",
    "name": "Gen X: Omega",
    "desc": "Losowa karta · X-family · Siła 5+",
    "sourceCategories": [
      "hybrid"
    ],
    "filter": {
      "tags": {
        "anyOf": [
          "xmen",
          "x-force",
          "new-mutants"
        ]
      },
      "power": {
        "min": 5
      }
    }
  },
  {
    "id": "choice_card_generation_cost2_or_less",
    "type": "choice",
    "rarity": "epic",
    "family": "hybrid",
    "hybridType": "tag-stat",
    "name": "Tani Generator",
    "desc": "Dowolna karta · Card Generation · Koszt maks. 2",
    "sourceCategories": [
      "hybrid"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "card-generation"
        ]
      },
      "cost": {
        "max": 2
      }
    }
  },
  {
    "id": "surprise_card_generation_cost2_or_less",
    "type": "surprise",
    "rarity": "rare",
    "family": "hybrid",
    "hybridType": "tag-stat",
    "name": "Drobna Przesyłka",
    "desc": "Losowa karta · Card Generation · Koszt maks. 2",
    "sourceCategories": [
      "hybrid"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "card-generation"
        ]
      },
      "cost": {
        "max": 2
      }
    }
  },
  {
    "id": "choice_self_buff_above_curve",
    "type": "choice",
    "rarity": "epic",
    "family": "hybrid",
    "hybridType": "tag-stat-relation",
    "name": "Moc za Cenę",
    "desc": "Dowolna karta · Self Buff · Siła > Koszt",
    "sourceCategories": [
      "hybrid"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "self-buff"
        ]
      },
      "relations": [
        {
          "left": "power",
          "operator": ">",
          "right": "cost"
        }
      ]
    }
  },
  {
    "id": "surprise_self_buff_above_curve",
    "type": "surprise",
    "rarity": "epic",
    "family": "hybrid",
    "hybridType": "tag-stat-relation",
    "name": "Przeciążony Wojownik",
    "desc": "Losowa karta · Self Buff · Siła > Koszt",
    "sourceCategories": [
      "hybrid"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "self-buff"
        ]
      },
      "relations": [
        {
          "left": "power",
          "operator": ">",
          "right": "cost"
        }
      ]
    }
  },
  {
    "id": "choice_location_on_reveal",
    "type": "choice",
    "rarity": "epic",
    "family": "hybrid",
    "hybridType": "multi-tag-all",
    "name": "Odsłona Rzeczywistości",
    "desc": "Dowolna karta · Location + On Reveal",
    "sourceCategories": [
      "hybrid"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "on-reveal"
        ],
        "anyOf": [
          "location-control",
          "location-points"
        ]
      }
    }
  },
  {
    "id": "surprise_location_on_reveal",
    "type": "surprise",
    "rarity": "epic",
    "family": "hybrid",
    "hybridType": "multi-tag-all",
    "name": "Pęknięcie Świata",
    "desc": "Losowa karta · Location + On Reveal",
    "sourceCategories": [
      "hybrid"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "on-reveal"
        ],
        "anyOf": [
          "location-control",
          "location-points"
        ]
      }
    }
  },
  {
    "id": "choice_move_destroy",
    "type": "choice",
    "rarity": "rare",
    "family": "hybrid",
    "hybridType": "multi-tag-all",
    "name": "Mobilny Zabójca",
    "desc": "Dowolna karta · Move + Destroy",
    "sourceCategories": [
      "hybrid"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "move",
          "destroy"
        ]
      }
    }
  },
  {
    "id": "surprise_move_destroy",
    "type": "surprise",
    "rarity": "epic",
    "family": "hybrid",
    "hybridType": "multi-tag-all",
    "name": "Ruchomy Chaos",
    "desc": "Losowa karta · Move + Destroy",
    "sourceCategories": [
      "hybrid"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "move",
          "destroy"
        ]
      }
    }
  },
  {
    "id": "choice_magicians_villains",
    "type": "choice",
    "rarity": "epic",
    "family": "hybrid",
    "hybridType": "multi-tag-all",
    "name": "Mroczny Magik",
    "desc": "Dowolna karta · Magicians + Villains",
    "sourceCategories": [
      "hybrid"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "magicians",
          "villains"
        ]
      }
    }
  },
  {
    "id": "surprise_magicians_villains",
    "type": "surprise",
    "rarity": "epic",
    "family": "hybrid",
    "hybridType": "multi-tag-all",
    "name": "Zakazane Arkana",
    "desc": "Losowa karta · Magicians + Villains",
    "sourceCategories": [
      "hybrid"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "magicians",
          "villains"
        ]
      }
    }
  },
  {
    "id": "choice_symbiote_destroy",
    "type": "choice",
    "rarity": "rare",
    "family": "hybrid",
    "hybridType": "multi-tag-all",
    "name": "Symbiotyczny Głód",
    "desc": "Dowolna karta · Symbiotes + Destroy",
    "sourceCategories": [
      "hybrid"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "symbiotes",
          "destroy"
        ]
      }
    }
  },
  {
    "id": "choice_ongoing_tech",
    "type": "choice",
    "rarity": "epic",
    "family": "hybrid",
    "hybridType": "multi-tag-all",
    "name": "Stała Kontra",
    "desc": "Dowolna karta · Ongoing + Tech",
    "sourceCategories": [
      "hybrid"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "ongoing",
          "tech"
        ]
      }
    }
  },
  {
    "id": "surprise_ongoing_tech",
    "type": "surprise",
    "rarity": "epic",
    "family": "hybrid",
    "hybridType": "multi-tag-all",
    "name": "Wieczny Plan B",
    "desc": "Losowa karta · Ongoing + Tech",
    "sourceCategories": [
      "hybrid"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "ongoing",
          "tech"
        ]
      }
    }
  },
  {
    "id": "choice_on_reveal_tech",
    "type": "choice",
    "rarity": "epic",
    "family": "hybrid",
    "hybridType": "multi-tag-all",
    "name": "Natychmiastowa Kontra",
    "desc": "Dowolna karta · On Reveal + Tech",
    "sourceCategories": [
      "hybrid"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "on-reveal",
          "tech"
        ]
      }
    }
  },
  {
    "id": "surprise_on_reveal_tech",
    "type": "surprise",
    "rarity": "epic",
    "family": "hybrid",
    "hybridType": "multi-tag-all",
    "name": "Reakcja Łańcuchowa",
    "desc": "Losowa karta · On Reveal + Tech",
    "sourceCategories": [
      "hybrid"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "on-reveal",
          "tech"
        ]
      }
    }
  },
  {
    "id": "choice_destroy_trigger",
    "type": "choice",
    "rarity": "epic",
    "family": "hybrid",
    "hybridType": "multi-tag-all",
    "name": "Łańcuch Destrukcji",
    "desc": "Dowolna karta · Destroy + Trigger Card",
    "sourceCategories": [
      "hybrid"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "destroy",
          "trigger-card"
        ]
      }
    }
  },
  {
    "id": "choice_cost_reduction_card_generation",
    "type": "choice",
    "rarity": "epic",
    "family": "hybrid",
    "hybridType": "multi-tag-all",
    "name": "Ekonomia Chaosu",
    "desc": "Dowolna karta · Cost Reduction + Card Generation",
    "sourceCategories": [
      "hybrid"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "cost-reduction",
          "card-generation"
        ]
      }
    }
  },
  {
    "id": "surprise_cost_reduction_card_generation",
    "type": "surprise",
    "rarity": "epic",
    "family": "hybrid",
    "hybridType": "multi-tag-all",
    "name": "Promocyjne Rozdanie",
    "desc": "Losowa karta · Cost Reduction + Card Generation",
    "sourceCategories": [
      "hybrid"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "cost-reduction",
          "card-generation"
        ]
      }
    }
  },
  {
    "id": "choice_energy_ramp_on_reveal",
    "type": "choice",
    "rarity": "epic",
    "family": "hybrid",
    "hybridType": "multi-tag-all",
    "name": "Skok Napięcia",
    "desc": "Dowolna karta · Energy Ramp + On Reveal",
    "sourceCategories": [
      "hybrid"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "on-reveal"
        ],
        "anyOf": [
          "energy",
          "ramp"
        ]
      }
    }
  },
  {
    "id": "surprise_energy_ramp_on_reveal",
    "type": "surprise",
    "rarity": "epic",
    "family": "hybrid",
    "hybridType": "multi-tag-all",
    "name": "Energia z Rękawa",
    "desc": "Losowa karta · Energy Ramp + On Reveal",
    "sourceCategories": [
      "hybrid"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "on-reveal"
        ],
        "anyOf": [
          "energy",
          "ramp"
        ]
      }
    }
  },
  {
    "id": "choice_discard_on_reveal",
    "type": "choice",
    "rarity": "epic",
    "family": "hybrid",
    "hybridType": "multi-tag-all",
    "name": "Kontrolowany Odrzut",
    "desc": "Dowolna karta · Discard + On Reveal",
    "sourceCategories": [
      "hybrid"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "discard",
          "on-reveal"
        ]
      }
    }
  },
  {
    "id": "surprise_discard_on_reveal",
    "type": "surprise",
    "rarity": "epic",
    "family": "hybrid",
    "hybridType": "multi-tag-all",
    "name": "Odrzut z Kapelusza",
    "desc": "Losowa karta · Discard + On Reveal",
    "sourceCategories": [
      "hybrid"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "discard",
          "on-reveal"
        ]
      }
    }
  },
  {
    "id": "choice_destroy_on_reveal",
    "type": "choice",
    "rarity": "rare",
    "family": "hybrid",
    "hybridType": "multi-tag-all",
    "name": "Rozkaz Zniszczenia",
    "desc": "Dowolna karta · Destroy + On Reveal",
    "sourceCategories": [
      "hybrid"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "destroy",
          "on-reveal"
        ]
      }
    }
  },
  {
    "id": "surprise_destroy_on_reveal",
    "type": "surprise",
    "rarity": "epic",
    "family": "hybrid",
    "hybridType": "multi-tag-all",
    "name": "Detonacja",
    "desc": "Losowa karta · Destroy + On Reveal",
    "sourceCategories": [
      "hybrid"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "destroy",
          "on-reveal"
        ]
      }
    }
  },
  {
    "id": "choice_move_trigger",
    "type": "choice",
    "rarity": "rare",
    "family": "hybrid",
    "hybridType": "multi-tag-all",
    "name": "Kinetyczny Zapłon",
    "desc": "Dowolna karta · Move + Trigger Card",
    "sourceCategories": [
      "hybrid"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "move",
          "trigger-card"
        ]
      }
    }
  },
  {
    "id": "surprise_move_trigger",
    "type": "surprise",
    "rarity": "epic",
    "family": "hybrid",
    "hybridType": "multi-tag-all",
    "name": "Ruchomy Spust",
    "desc": "Losowa karta · Move + Trigger Card",
    "sourceCategories": [
      "hybrid"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "move",
          "trigger-card"
        ]
      }
    }
  },
  {
    "id": "choice_villains_tech",
    "type": "choice",
    "rarity": "epic",
    "family": "hybrid",
    "hybridType": "multi-tag-all",
    "name": "Złoczyńczy Plan",
    "desc": "Dowolna karta · Villains + Tech",
    "sourceCategories": [
      "hybrid"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "villains",
          "tech"
        ]
      }
    }
  },
  {
    "id": "surprise_villains_tech",
    "type": "surprise",
    "rarity": "epic",
    "family": "hybrid",
    "hybridType": "multi-tag-all",
    "name": "Brudna Sztuczka",
    "desc": "Losowa karta · Villains + Tech",
    "sourceCategories": [
      "hybrid"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "villains",
          "tech"
        ]
      }
    }
  },
  {
    "id": "choice_avengers_on_reveal",
    "type": "choice",
    "rarity": "rare",
    "family": "hybrid",
    "hybridType": "faction-ability",
    "name": "Avengers: Reakcja",
    "desc": "Dowolna karta · Avengers family + On Reveal",
    "sourceCategories": [
      "hybrid"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "on-reveal"
        ],
        "anyOf": [
          "avengers",
          "new-avengers",
          "west-coast-avengers",
          "dark-avengers",
          "young-avengers"
        ]
      }
    }
  },
  {
    "id": "surprise_avengers_on_reveal",
    "type": "surprise",
    "rarity": "epic",
    "family": "hybrid",
    "hybridType": "faction-ability",
    "name": "Sygnał Avengers",
    "desc": "Losowa karta · Avengers family + On Reveal",
    "sourceCategories": [
      "hybrid"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "on-reveal"
        ],
        "anyOf": [
          "avengers",
          "new-avengers",
          "west-coast-avengers",
          "dark-avengers",
          "young-avengers"
        ]
      }
    }
  },
  {
    "id": "choice_x_family_on_reveal",
    "type": "choice",
    "rarity": "epic",
    "family": "hybrid",
    "hybridType": "faction-ability",
    "name": "Mutancka Reakcja",
    "desc": "Dowolna karta · X-family + On Reveal",
    "sourceCategories": [
      "hybrid"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "on-reveal"
        ],
        "anyOf": [
          "xmen",
          "x-force",
          "new-mutants"
        ]
      }
    }
  },
  {
    "id": "surprise_x_family_on_reveal",
    "type": "surprise",
    "rarity": "epic",
    "family": "hybrid",
    "hybridType": "faction-ability",
    "name": "Gen X: Odkrycie",
    "desc": "Losowa karta · X-family + On Reveal",
    "sourceCategories": [
      "hybrid"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "on-reveal"
        ],
        "anyOf": [
          "xmen",
          "x-force",
          "new-mutants"
        ]
      }
    }
  },
  {
    "id": "choice_cost_1_or_6_plus",
    "type": "choice",
    "rarity": "legendary",
    "family": "statistics",
    "name": "Skrajności",
    "desc": "Dowolna karta · Koszt 1 lub 6+",
    "sourceCategories": [
      "statistics"
    ],
    "filter": {
      "cost": {
        "anyOf": [
          {
            "exact": 1
          },
          {
            "min": 6
          }
        ]
      }
    },
    "hybridType": "stat-or"
  },
  {
    "id": "surprise_cost_1_or_6_plus",
    "type": "surprise",
    "rarity": "rare",
    "family": "statistics",
    "name": "Od Krańca do Krańca",
    "desc": "Losowa karta · Koszt 1 lub 6+",
    "sourceCategories": [
      "statistics"
    ],
    "filter": {
      "cost": {
        "anyOf": [
          {
            "exact": 1
          },
          {
            "min": 6
          }
        ]
      }
    },
    "hybridType": "stat-or"
  },
  {
    "id": "choice_power_exact_cost_plus1",
    "type": "choice",
    "rarity": "epic",
    "family": "statistics",
    "name": "Schodek w Górę",
    "desc": "Dowolna karta · Siła = Koszt + 1",
    "sourceCategories": [
      "statistics"
    ],
    "filter": {
      "relations": [
        {
          "left": "power",
          "operator": "=",
          "right": "cost",
          "offset": 1
        }
      ]
    },
    "hybridType": "stat-relation"
  },
  {
    "id": "surprise_power_exact_cost_plus1",
    "type": "surprise",
    "rarity": "rare",
    "family": "statistics",
    "name": "Krok Wyżej",
    "desc": "Losowa karta · Siła = Koszt + 1",
    "sourceCategories": [
      "statistics"
    ],
    "filter": {
      "relations": [
        {
          "left": "power",
          "operator": "=",
          "right": "cost",
          "offset": 1
        }
      ]
    },
    "hybridType": "stat-relation"
  },
  {
    "id": "choice_power_exact_cost_minus1",
    "type": "choice",
    "rarity": "epic",
    "family": "statistics",
    "name": "Schodek w Dół",
    "desc": "Dowolna karta · Siła = Koszt − 1",
    "sourceCategories": [
      "statistics"
    ],
    "filter": {
      "relations": [
        {
          "left": "power",
          "operator": "=",
          "right": "cost",
          "offset": -1
        }
      ]
    },
    "hybridType": "stat-relation"
  },
  {
    "id": "surprise_power_exact_cost_minus1",
    "type": "surprise",
    "rarity": "epic",
    "family": "statistics",
    "name": "Krok Niżej",
    "desc": "Losowa karta · Siła = Koszt − 1",
    "sourceCategories": [
      "statistics"
    ],
    "filter": {
      "relations": [
        {
          "left": "power",
          "operator": "=",
          "right": "cost",
          "offset": -1
        }
      ]
    },
    "hybridType": "stat-relation"
  },
  {
    "id": "choice_power_exact_cost_plus2",
    "type": "choice",
    "rarity": "epic",
    "family": "statistics",
    "name": "Podwójny Schodek",
    "desc": "Dowolna karta · Siła = Koszt + 2",
    "sourceCategories": [
      "statistics"
    ],
    "filter": {
      "relations": [
        {
          "left": "power",
          "operator": "=",
          "right": "cost",
          "offset": 2
        }
      ]
    },
    "hybridType": "stat-relation"
  },
  {
    "id": "surprise_power_exact_cost_plus2",
    "type": "surprise",
    "rarity": "rare",
    "family": "statistics",
    "name": "Dwa Kroki Wyżej",
    "desc": "Losowa karta · Siła = Koszt + 2",
    "sourceCategories": [
      "statistics"
    ],
    "filter": {
      "relations": [
        {
          "left": "power",
          "operator": "=",
          "right": "cost",
          "offset": 2
        }
      ]
    },
    "hybridType": "stat-relation"
  },
  {
    "id": "choice_power_exact_cost_minus2",
    "type": "choice",
    "rarity": "epic",
    "family": "statistics",
    "name": "Dwa Kroki w Dół",
    "desc": "Dowolna karta · Siła = Koszt − 2",
    "sourceCategories": [
      "statistics"
    ],
    "filter": {
      "relations": [
        {
          "left": "power",
          "operator": "=",
          "right": "cost",
          "offset": -2
        }
      ]
    },
    "hybridType": "stat-relation"
  },
  {
    "id": "surprise_power_exact_cost_minus2",
    "type": "surprise",
    "rarity": "epic",
    "family": "statistics",
    "name": "Podwójny Spadek",
    "desc": "Losowa karta · Siła = Koszt − 2",
    "sourceCategories": [
      "statistics"
    ],
    "filter": {
      "relations": [
        {
          "left": "power",
          "operator": "=",
          "right": "cost",
          "offset": -2
        }
      ]
    },
    "hybridType": "stat-relation"
  },
  {
    "id": "choice_power_double_cost",
    "type": "choice",
    "rarity": "rare",
    "family": "statistics",
    "name": "Podwójny Przelicznik",
    "desc": "Dowolna karta · Siła = 2 × Koszt",
    "sourceCategories": [
      "statistics"
    ],
    "filter": {
      "relations": [
        {
          "left": "power",
          "operator": "=",
          "right": "cost",
          "rightMultiplier": 2
        }
      ]
    },
    "hybridType": "stat-relation-multiplier"
  },
  {
    "id": "surprise_power_double_cost",
    "type": "surprise",
    "rarity": "epic",
    "family": "statistics",
    "name": "Dublet Mocy",
    "desc": "Losowa karta · Siła = 2 × Koszt",
    "sourceCategories": [
      "statistics"
    ],
    "filter": {
      "relations": [
        {
          "left": "power",
          "operator": "=",
          "right": "cost",
          "rightMultiplier": 2
        }
      ]
    },
    "hybridType": "stat-relation-multiplier"
  },
  {
    "id": "choice_cost_double_power",
    "type": "choice",
    "rarity": "rare",
    "family": "statistics",
    "name": "Odwrócona Stawka",
    "desc": "Dowolna karta · Koszt = 2 × Siła",
    "sourceCategories": [
      "statistics"
    ],
    "filter": {
      "relations": [
        {
          "left": "cost",
          "operator": "=",
          "right": "power",
          "rightMultiplier": 2
        }
      ]
    },
    "hybridType": "stat-relation-multiplier"
  },
  {
    "id": "surprise_cost_double_power",
    "type": "surprise",
    "rarity": "epic",
    "family": "statistics",
    "name": "Cena Podwójna",
    "desc": "Losowa karta · Koszt = 2 × Siła",
    "sourceCategories": [
      "statistics"
    ],
    "filter": {
      "relations": [
        {
          "left": "cost",
          "operator": "=",
          "right": "power",
          "rightMultiplier": 2
        }
      ]
    },
    "hybridType": "stat-relation-multiplier"
  },
  {
    "id": "choice_two_ability_types",
    "type": "choice",
    "rarity": "epic",
    "family": "hybrid",
    "name": "Podwójna Tożsamość",
    "desc": "Dowolna karta · Co najmniej 2 Ability Types",
    "sourceCategories": [
      "hybrid"
    ],
    "filter": {
      "tagCounts": [
        {
          "tags": [
            "activate",
            "endofgame",
            "endofturn",
            "gamestart",
            "moveable",
            "no-ability",
            "objective",
            "on-reveal",
            "ongoing",
            "quickdraw",
            "startofturn",
            "trigger-card"
          ],
          "min": 2
        }
      ]
    },
    "hybridType": "tag-count"
  },
  {
    "id": "surprise_two_ability_types",
    "type": "surprise",
    "rarity": "epic",
    "family": "hybrid",
    "name": "Dwie Twarze",
    "desc": "Losowa karta · Co najmniej 2 Ability Types",
    "sourceCategories": [
      "hybrid"
    ],
    "filter": {
      "tagCounts": [
        {
          "tags": [
            "activate",
            "endofgame",
            "endofturn",
            "gamestart",
            "moveable",
            "no-ability",
            "objective",
            "on-reveal",
            "ongoing",
            "quickdraw",
            "startofturn",
            "trigger-card"
          ],
          "min": 2
        }
      ]
    },
    "hybridType": "tag-count"
  },
  {
    "id": "choice_two_ability_two_archetypes",
    "type": "choice",
    "rarity": "epic",
    "family": "hybrid",
    "name": "Przeładowany System",
    "desc": "Dowolna karta · Min. 2 Ability Types + min. 2 Rodziny/Archetypy",
    "sourceCategories": [
      "hybrid"
    ],
    "filter": {
      "tagCounts": [
        {
          "tags": [
            "activate",
            "endofgame",
            "endofturn",
            "gamestart",
            "moveable",
            "no-ability",
            "objective",
            "on-reveal",
            "ongoing",
            "quickdraw",
            "startofturn",
            "trigger-card"
          ],
          "min": 2
        },
        {
          "tags": [
            "afflict",
            "bounce",
            "buff",
            "card-generation",
            "clog",
            "cost",
            "destroy",
            "discard",
            "disruption",
            "downside",
            "energy",
            "merge",
            "move",
            "spells",
            "tech",
            "zombie-horde",
            "highevo",
            "mill",
            "no-ability-buff",
            "wongreveal",
            "zoo",
            "end-of-turn-combo",
            "mister-negative",
            "lockdown",
            "scream",
            "mini-movers",
            "prio-control",
            "midrange-control",
            "aurora",
            "arishem-thanos",
            "hammer-bros",
            "fantomex",
            "skaar",
            "zombie-galacti",
            "werewolf-sentry",
            "surfer-buff",
            "classic-destroy",
            "destroy-combo",
            "move-combo",
            "ramp",
            "victoria-hand-big-hand",
            "small-buff",
            "spectrum-ongoing",
            "tribunal-ongoing",
            "doom-2099",
            "cerebro",
            "galactus",
            "darkhawk-ronan",
            "sauron-skaar"
          ],
          "min": 2
        }
      ]
    },
    "hybridType": "tag-count-combo"
  },
  {
    "id": "surprise_two_ability_two_archetypes",
    "type": "surprise",
    "rarity": "epic",
    "family": "hybrid",
    "name": "Szwajcarski Scyzoryk",
    "desc": "Losowa karta · Min. 2 Ability Types + min. 2 Rodziny/Archetypy",
    "sourceCategories": [
      "hybrid"
    ],
    "filter": {
      "tagCounts": [
        {
          "tags": [
            "activate",
            "endofgame",
            "endofturn",
            "gamestart",
            "moveable",
            "no-ability",
            "objective",
            "on-reveal",
            "ongoing",
            "quickdraw",
            "startofturn",
            "trigger-card"
          ],
          "min": 2
        },
        {
          "tags": [
            "afflict",
            "bounce",
            "buff",
            "card-generation",
            "clog",
            "cost",
            "destroy",
            "discard",
            "disruption",
            "downside",
            "energy",
            "merge",
            "move",
            "spells",
            "tech",
            "zombie-horde",
            "highevo",
            "mill",
            "no-ability-buff",
            "wongreveal",
            "zoo",
            "end-of-turn-combo",
            "mister-negative",
            "lockdown",
            "scream",
            "mini-movers",
            "prio-control",
            "midrange-control",
            "aurora",
            "arishem-thanos",
            "hammer-bros",
            "fantomex",
            "skaar",
            "zombie-galacti",
            "werewolf-sentry",
            "surfer-buff",
            "classic-destroy",
            "destroy-combo",
            "move-combo",
            "ramp",
            "victoria-hand-big-hand",
            "small-buff",
            "spectrum-ongoing",
            "tribunal-ongoing",
            "doom-2099",
            "cerebro",
            "galactus",
            "darkhawk-ronan",
            "sauron-skaar"
          ],
          "min": 2
        }
      ]
    },
    "hybridType": "tag-count-combo"
  },
  {
    "id": "choice_three_archetypes",
    "type": "choice",
    "rarity": "epic",
    "family": "hybrid",
    "name": "Wielozadaniowiec",
    "desc": "Dowolna karta · Co najmniej 3 Rodziny/Archetypy",
    "sourceCategories": [
      "hybrid"
    ],
    "filter": {
      "tagCounts": [
        {
          "tags": [
            "afflict",
            "bounce",
            "buff",
            "card-generation",
            "clog",
            "cost",
            "destroy",
            "discard",
            "disruption",
            "downside",
            "energy",
            "merge",
            "move",
            "spells",
            "tech",
            "zombie-horde",
            "highevo",
            "mill",
            "no-ability-buff",
            "wongreveal",
            "zoo",
            "end-of-turn-combo",
            "mister-negative",
            "lockdown",
            "scream",
            "mini-movers",
            "prio-control",
            "midrange-control",
            "aurora",
            "arishem-thanos",
            "hammer-bros",
            "fantomex",
            "skaar",
            "zombie-galacti",
            "werewolf-sentry",
            "surfer-buff",
            "classic-destroy",
            "destroy-combo",
            "move-combo",
            "ramp",
            "victoria-hand-big-hand",
            "small-buff",
            "spectrum-ongoing",
            "tribunal-ongoing",
            "doom-2099",
            "cerebro",
            "galactus",
            "darkhawk-ronan",
            "sauron-skaar"
          ],
          "min": 3
        }
      ]
    },
    "hybridType": "tag-count"
  },
  {
    "id": "surprise_three_archetypes",
    "type": "surprise",
    "rarity": "rare",
    "family": "hybrid",
    "name": "Wiele Dróg",
    "desc": "Losowa karta · Co najmniej 3 Rodziny/Archetypy",
    "sourceCategories": [
      "hybrid"
    ],
    "filter": {
      "tagCounts": [
        {
          "tags": [
            "afflict",
            "bounce",
            "buff",
            "card-generation",
            "clog",
            "cost",
            "destroy",
            "discard",
            "disruption",
            "downside",
            "energy",
            "merge",
            "move",
            "spells",
            "tech",
            "zombie-horde",
            "highevo",
            "mill",
            "no-ability-buff",
            "wongreveal",
            "zoo",
            "end-of-turn-combo",
            "mister-negative",
            "lockdown",
            "scream",
            "mini-movers",
            "prio-control",
            "midrange-control",
            "aurora",
            "arishem-thanos",
            "hammer-bros",
            "fantomex",
            "skaar",
            "zombie-galacti",
            "werewolf-sentry",
            "surfer-buff",
            "classic-destroy",
            "destroy-combo",
            "move-combo",
            "ramp",
            "victoria-hand-big-hand",
            "small-buff",
            "spectrum-ongoing",
            "tribunal-ongoing",
            "doom-2099",
            "cerebro",
            "galactus",
            "darkhawk-ronan",
            "sauron-skaar"
          ],
          "min": 3
        }
      ]
    },
    "hybridType": "tag-count"
  },
  {
    "id": "choice_three_subtypes",
    "type": "choice",
    "rarity": "epic",
    "family": "hybrid",
    "name": "Mechaniczny Scyzoryk",
    "desc": "Dowolna karta · Co najmniej 3 Subtypes",
    "sourceCategories": [
      "hybrid"
    ],
    "filter": {
      "tagCounts": [
        {
          "tags": [
            "board-generator",
            "card-copy",
            "cost-reduction",
            "deck-generator",
            "double-power",
            "draw",
            "delayed-reveal",
            "effect-multiplier",
            "give-power",
            "hand-gen",
            "multi-location-power",
            "scaler",
            "self-buff",
            "set-power",
            "revive",
            "summon",
            "transform",
            "unique-card-creation",
            "random-card-pool",
            "text-copy",
            "text-disruption",
            "power-steal",
            "row-interaction",
            "full-location",
            "play-requirement",
            "unspent-energy",
            "winning",
            "power-aura",
            "location-control",
            "location-points",
            "banish",
            "set-cost",
            "cost-increase"
          ],
          "min": 3
        }
      ]
    },
    "hybridType": "tag-count"
  },
  {
    "id": "surprise_three_subtypes",
    "type": "surprise",
    "rarity": "epic",
    "family": "hybrid",
    "name": "Pełen Pakiet",
    "desc": "Losowa karta · Co najmniej 3 Subtypes",
    "sourceCategories": [
      "hybrid"
    ],
    "filter": {
      "tagCounts": [
        {
          "tags": [
            "board-generator",
            "card-copy",
            "cost-reduction",
            "deck-generator",
            "double-power",
            "draw",
            "delayed-reveal",
            "effect-multiplier",
            "give-power",
            "hand-gen",
            "multi-location-power",
            "scaler",
            "self-buff",
            "set-power",
            "revive",
            "summon",
            "transform",
            "unique-card-creation",
            "random-card-pool",
            "text-copy",
            "text-disruption",
            "power-steal",
            "row-interaction",
            "full-location",
            "play-requirement",
            "unspent-energy",
            "winning",
            "power-aura",
            "location-control",
            "location-points",
            "banish",
            "set-cost",
            "cost-increase"
          ],
          "min": 3
        }
      ]
    },
    "hybridType": "tag-count"
  },
  {
    "id": "choice_early_series_on_reveal",
    "type": "choice",
    "rarity": "epic",
    "family": "hybrid",
    "name": "Prehistoryczne Odkrycie",
    "desc": "Dowolna karta · Starter / Recruit / Series 0–1 + On Reveal",
    "sourceCategories": [
      "hybrid"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "on-reveal"
        ],
        "anyOf": [
          "starter",
          "recruit-pass",
          "series0",
          "series1"
        ]
      }
    },
    "hybridType": "series-ability"
  },
  {
    "id": "surprise_early_series_on_reveal",
    "type": "surprise",
    "rarity": "epic",
    "family": "hybrid",
    "name": "Stare Dobre Odkrycie",
    "desc": "Losowa karta · Starter / Recruit / Series 0–1 + On Reveal",
    "sourceCategories": [
      "hybrid"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "on-reveal"
        ],
        "anyOf": [
          "starter",
          "recruit-pass",
          "series0",
          "series1"
        ]
      }
    },
    "hybridType": "series-ability"
  },
  {
    "id": "choice_series1_on_reveal",
    "type": "choice",
    "rarity": "epic",
    "family": "hybrid",
    "name": "Pierwsze Odkrycie",
    "desc": "Dowolna karta · Series 1 + On Reveal",
    "sourceCategories": [
      "hybrid"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "on-reveal",
          "series1"
        ]
      }
    },
    "hybridType": "series-ability"
  },
  {
    "id": "surprise_series1_on_reveal",
    "type": "surprise",
    "rarity": "epic",
    "family": "hybrid",
    "name": "Odkrycie z Serii Pierwszej",
    "desc": "Losowa karta · Series 1 + On Reveal",
    "sourceCategories": [
      "hybrid"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "on-reveal",
          "series1"
        ]
      }
    },
    "hybridType": "series-ability"
  },
  {
    "id": "choice_starter_zero_on_reveal",
    "type": "choice",
    "rarity": "rare",
    "family": "hybrid",
    "name": "Pierwotny Reveal",
    "desc": "Dowolna karta · Starter / Series 0 + On Reveal",
    "sourceCategories": [
      "hybrid"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "on-reveal"
        ],
        "anyOf": [
          "starter",
          "series0"
        ]
      }
    },
    "hybridType": "series-ability"
  },
  {
    "id": "surprise_starter_zero_on_reveal",
    "type": "surprise",
    "rarity": "epic",
    "family": "hybrid",
    "name": "Pierwsza Iskra",
    "desc": "Losowa karta · Starter / Series 0 + On Reveal",
    "sourceCategories": [
      "hybrid"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "on-reveal"
        ],
        "anyOf": [
          "starter",
          "series0"
        ]
      }
    },
    "hybridType": "series-ability"
  },
  {
    "id": "choice_modern_on_reveal",
    "type": "choice",
    "rarity": "epic",
    "family": "hybrid",
    "name": "Nowoczesne Odkrycie",
    "desc": "Dowolna karta · Series 4–5 + On Reveal",
    "sourceCategories": [
      "hybrid"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "on-reveal"
        ],
        "anyOf": [
          "series4",
          "series5"
        ]
      }
    },
    "hybridType": "series-ability"
  },
  {
    "id": "surprise_modern_on_reveal",
    "type": "surprise",
    "rarity": "rare",
    "family": "hybrid",
    "name": "Odkrycie Nowej Ery",
    "desc": "Losowa karta · Series 4–5 + On Reveal",
    "sourceCategories": [
      "hybrid"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "on-reveal"
        ],
        "anyOf": [
          "series4",
          "series5"
        ]
      }
    },
    "hybridType": "series-ability"
  },
  {
    "id": "choice_modern_activate",
    "type": "choice",
    "rarity": "epic",
    "family": "hybrid",
    "name": "Eksperymentalna Technologia",
    "desc": "Dowolna karta · Series 4–5 + Activate",
    "sourceCategories": [
      "hybrid"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "activate"
        ],
        "anyOf": [
          "series4",
          "series5"
        ]
      }
    },
    "hybridType": "series-ability"
  },
  {
    "id": "surprise_modern_activate",
    "type": "surprise",
    "rarity": "epic",
    "family": "hybrid",
    "name": "Nowy Prototyp",
    "desc": "Losowa karta · Series 4–5 + Activate",
    "sourceCategories": [
      "hybrid"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "activate"
        ],
        "anyOf": [
          "series4",
          "series5"
        ]
      }
    },
    "hybridType": "series-ability"
  },
  {
    "id": "choice_combo_or",
    "type": "choice",
    "rarity": "epic",
    "family": "hybrid",
    "name": "Wielkie Combo",
    "desc": "Dowolna karta · Ongoing Combo lub Wong Reveal",
    "sourceCategories": [
      "hybrid"
    ],
    "filter": {
      "tags": {
        "anyOf": [
          "spectrum-ongoing",
          "tribunal-ongoing",
          "wongreveal"
        ]
      }
    },
    "hybridType": "tag-or"
  },
  {
    "id": "surprise_combo_or",
    "type": "surprise",
    "rarity": "epic",
    "family": "hybrid",
    "name": "Combo z Kapelusza",
    "desc": "Losowa karta · Ongoing Combo lub Wong Reveal",
    "sourceCategories": [
      "hybrid"
    ],
    "filter": {
      "tags": {
        "anyOf": [
          "spectrum-ongoing",
          "tribunal-ongoing",
          "wongreveal"
        ]
      }
    },
    "hybridType": "tag-or"
  },
  {
    "id": "choice_copy_multiplier_or",
    "type": "choice",
    "rarity": "epic",
    "family": "hybrid",
    "name": "Komora Echa",
    "desc": "Dowolna karta · Text Copy lub Effect Multiplier lub Card Copy",
    "sourceCategories": [
      "hybrid"
    ],
    "filter": {
      "tags": {
        "anyOf": [
          "text-copy",
          "effect-multiplier",
          "card-copy"
        ]
      }
    },
    "hybridType": "mechanic-or"
  },
  {
    "id": "surprise_copy_multiplier_or",
    "type": "surprise",
    "rarity": "epic",
    "family": "hybrid",
    "name": "Echo Kosmosu",
    "desc": "Losowa karta · Text Copy lub Effect Multiplier lub Card Copy",
    "sourceCategories": [
      "hybrid"
    ],
    "filter": {
      "tags": {
        "anyOf": [
          "text-copy",
          "effect-multiplier",
          "card-copy"
        ]
      }
    },
    "hybridType": "mechanic-or"
  },
  {
    "id": "choice_copy_multiplier_and",
    "type": "choice",
    "rarity": "epic",
    "family": "hybrid",
    "name": "Echo do Potęgi",
    "desc": "Dowolna karta · Text Copy + Effect Multiplier",
    "sourceCategories": [
      "hybrid"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "text-copy",
          "effect-multiplier"
        ]
      }
    },
    "hybridType": "multi-tag-all"
  },
  {
    "id": "surprise_copy_multiplier_and",
    "type": "surprise",
    "rarity": "epic",
    "family": "hybrid",
    "name": "Echo do Kwadratu",
    "desc": "Losowa karta · Text Copy + Effect Multiplier",
    "sourceCategories": [
      "hybrid"
    ],
    "filter": {
      "tags": {
        "allOf": [
          "text-copy",
          "effect-multiplier"
        ]
      }
    },
    "hybridType": "multi-tag-all"
  },
  {
    "id": "choice_cheap_star",
    "type": "choice",
    "rarity": "epic",
    "family": "hybrid",
    "name": "Tania Gwiazda",
    "desc": "Dowolna karta · Koszt maks. 2 · Siła 5+",
    "sourceCategories": [
      "hybrid"
    ],
    "filter": {
      "cost": {
        "max": 2
      },
      "power": {
        "min": 5
      }
    },
    "hybridType": "stat-package"
  },
  {
    "id": "surprise_cheap_star",
    "type": "surprise",
    "rarity": "epic",
    "family": "hybrid",
    "name": "Mała Gwiazda",
    "desc": "Losowa karta · Koszt maks. 2 · Siła 5+",
    "sourceCategories": [
      "hybrid"
    ],
    "filter": {
      "cost": {
        "max": 2
      },
      "power": {
        "min": 5
      }
    },
    "hybridType": "stat-package"
  },
  {
    "id": "choice_cost_3_power_2_or_less",
    "type": "choice",
    "rarity": "rare",
    "family": "statistics",
    "name": "Cichy Slot III",
    "desc": "Dowolna karta · Koszt 3 · Siła 2 lub mniej",
    "sourceCategories": [
      "statistics"
    ],
    "filter": {
      "cost": {
        "exact": 3
      },
      "power": {
        "max": 2
      }
    }
  },
  {
    "id": "surprise_cost_3_power_2_or_less",
    "type": "surprise",
    "rarity": "epic",
    "family": "statistics",
    "name": "Trójka z Cienia",
    "desc": "Losowa karta · Koszt 3 · Siła 2 lub mniej",
    "sourceCategories": [
      "statistics"
    ],
    "filter": {
      "cost": {
        "exact": 3
      },
      "power": {
        "max": 2
      }
    }
  },
  {
    "id": "choice_cost_4_power_3_or_less",
    "type": "choice",
    "rarity": "rare",
    "family": "statistics",
    "name": "Cichy Slot IV",
    "desc": "Dowolna karta · Koszt 4 · Siła 3 lub mniej",
    "sourceCategories": [
      "statistics"
    ],
    "filter": {
      "cost": {
        "exact": 4
      },
      "power": {
        "max": 3
      }
    }
  },
  {
    "id": "surprise_cost_4_power_3_or_less",
    "type": "surprise",
    "rarity": "epic",
    "family": "statistics",
    "name": "Czwórka z Cienia",
    "desc": "Losowa karta · Koszt 4 · Siła 3 lub mniej",
    "sourceCategories": [
      "statistics"
    ],
    "filter": {
      "cost": {
        "exact": 4
      },
      "power": {
        "max": 3
      }
    }
  }
];
