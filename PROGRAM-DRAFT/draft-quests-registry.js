/* ============================================================
   MSP SNAPDRAFT — DRAFTOWE QUESTY — DESIGN REGISTRY
   Version 1.0.0-new-quests-v1

   DATA ONLY.
   Ten plik opisuje bibliotekę Questów i zasady generatora.
   Nie implementuje silnika wykonywania Questów.

   Kanon:
   - 12 normalnych picków na gracza.
   - Najkrótsze okno Questa: 2 własne normalne picki.
   - Standardowe okna: next2 / next3 / next6 / pick6 / draftEnd.
   - Archetypes/Subtypes nigdy nie są Street Level; minimum Avengers.
   - Questy zależne od stanu decku mogą mieć ograniczone okno aktywacji.
   - Nazwa Questa opisuje mechanikę, NIE wylosowany Cost/Power/tag.
   - Parametry są losowane wyłącznie z legalnych konfiguracji.
   - Tier: Street Level / Avengers Level / Celestial Level.
   - Bazowe nagrody: 2 / 3 / 4 JC; wyjątkowy Celestial może mieć 5 JC.
============================================================ */

(function(global){
    "use strict";

    const VERSION = "1.0.0-new-quests-v1";

    const EXTENSION = Object.freeze({
        id: "draft_quests",
        name: "Draftowe Questy",
        currency: "jeff_coin",
        startingQuestSlots: 3,
        intendedTierMix: ["street", "avengers", "celestial"],
        freeRerollsPerPlayer: 3
    });

    const TIERS = Object.freeze({
        street: Object.freeze({
            id: "street",
            name: "Street Level",
            defaultRewardJC: 2,
            maxRewardJC: 2
        }),
        avengers: Object.freeze({
            id: "avengers",
            name: "Avengers Level",
            defaultRewardJC: 3,
            maxRewardJC: 3
        }),
        celestial: Object.freeze({
            id: "celestial",
            name: "Celestial Level",
            defaultRewardJC: 4,
            maxRewardJC: 5
        })
    });

    const WINDOWS = Object.freeze({
        next2: Object.freeze({
            id: "next2",
            type: "relativeNormalPicks",
            count: 2,
            label: "następne 2 picki"
        }),
        next3: Object.freeze({
            id: "next3",
            type: "relativeNormalPicks",
            count: 3,
            label: "następne 3 picki"
        }),
        next6: Object.freeze({
            id: "next6",
            type: "relativeNormalPicks",
            count: 6,
            label: "6 kolejnych picków"
        }),
        pick6: Object.freeze({
            id: "pick6",
            type: "globalNormalPickCheckpoint",
            pickNumber: 6,
            label: "po 6. picku"
        }),
        pick7: Object.freeze({
            id: "pick7",
            type: "globalNormalPickCheckpoint",
            pickNumber: 7,
            label: "przed ukończeniem 7. picku"
        }),
        draftEnd: Object.freeze({
            id: "draftEnd",
            type: "draftEnd",
            normalPickCap: 12,
            label: "do końca draftu"
        })
    });

    const ACTIVATION_PROFILES = Object.freeze({
        earlyCheckpoint: Object.freeze({
            id: "earlyCheckpoint",
            startPool: true,
            rerollPool: true,
            minCompletedNormalPicks: 0,
            maxCompletedNormalPicks: 2
        }),
        midDeck: Object.freeze({
            id: "midDeck",
            startPool: false,
            rerollPool: true,
            minCompletedNormalPicks: 3,
            maxCompletedNormalPicks: 9
        }),
        longHorizon: Object.freeze({
            id: "longHorizon",
            startPool: true,
            rerollPool: true,
            minCompletedNormalPicks: 0,
            maxCompletedNormalPicks: 4
        }),
        earlyCommerce: Object.freeze({
            id: "earlyCommerce",
            startPool: true,
            rerollPool: true,
            minCompletedNormalPicks: 0,
            maxCompletedNormalPicks: 6
        }),
        eventLongHorizon: Object.freeze({
            id: "eventLongHorizon",
            startPool: true,
            rerollPool: true,
            minCompletedNormalPicks: 0,
            maxCompletedNormalPicks: 4
        })
    });

    const COST_BUCKETS = Object.freeze([
        Object.freeze({id:"0-1", label:"0–1", min:0, max:1}),
        Object.freeze({id:"2",   label:"2",   min:2, max:2}),
        Object.freeze({id:"3",   label:"3",   min:3, max:3}),
        Object.freeze({id:"4",   label:"4",   min:4, max:4}),
        Object.freeze({id:"5",   label:"5",   min:5, max:5}),
        Object.freeze({id:"6+",  label:"6+",  min:6, max:null})
    ]);

    const QUESTS = [

        /* ======================================================
           Q001–Q007 — PIERWSZY ZATWIERDZONY CORE
        ====================================================== */

        {
            code: "Q001",
            id: "ability-signal",
            name: "Sygnał Zdolności",
            family: "cardTarget",
            tier: "street",
            rewardJC: 2,
            evaluation: "hit",
            window: "next2",
            textTemplate: "W ciągu następnych 2 picków wybierz kartę typu {targetTagName}.",
            evaluator: "pickedCardHasTag",
            parameters: {
                targetTag: {
                    source: "tagCategory",
                    category: "abilityTypes",
                    eligibility: {
                        minActivePoolShare: 0.12
                    }
                }
            },
            progress: {
                type: "counter",
                target: 1
            },
            failure: "windowExpired",
            requirements: {
                normalPicks: true
            }
        },

        {
            code: "Q002",
            id: "cost-target",
            name: "Cel Kosztowy",
            family: "cardTarget",
            tier: "street",
            rewardJC: 2,
            evaluation: "hit",
            window: "next2",
            textTemplate: "W ciągu następnych 2 picków wybierz kartę o Cost {targetCostLabel}.",
            evaluator: "pickedCardMatchesCostBucket",
            parameters: {
                targetCost: {
                    source: "costBuckets",
                    values: ["0-1", "2", "3", "4", "5", "6+"],
                    eligibility: {
                        minActivePoolShare: 0.12
                    }
                }
            },
            progress: {
                type: "counter",
                target: 1
            },
            failure: "windowExpired",
            requirements: {
                normalPicks: true
            }
        },

        {
            code: "Q003",
            id: "power-threshold",
            name: "Próg Mocy",
            family: "cardTarget",
            tier: "street",
            rewardJC: 2,
            evaluation: "hit",
            window: "next2",
            textTemplate: "W ciągu następnych 2 picków wybierz kartę mającą co najmniej {targetPower} Power.",
            evaluator: "pickedCardPowerAtLeast",
            parameters: {
                targetPower: {
                    source: "values",
                    values: [4, 5, 6, 7, 8],
                    eligibility: {
                        metric: "activePoolShareMatchingPredicate",
                        minActivePoolShare: 0.15
                    }
                }
            },
            progress: {
                type: "counter",
                target: 1
            },
            failure: "windowExpired",
            requirements: {
                normalPicks: true
            }
        },

        {
            code: "Q004",
            id: "pack-edge-pick",
            name: "Skrajny Wybór",
            family: "pack",
            tier: "street",
            rewardJC: 2,
            evaluation: "hit",
            window: "next2",
            textTemplate: "W ciągu następnych 2 picków wybierz przynajmniej jedną kartę znajdującą się na skraju paczki.",
            evaluator: "pickedCardIsPackEdge",
            parameters: {},
            progress: {
                type: "counter",
                target: 1
            },
            failure: "windowExpired",
            requirements: {
                normalPicks: true,
                packLayout: true,
                excludedModes: ["galacticCurrent"]
            }
        },

        {
            code: "Q005",
            id: "ability-discipline",
            name: "Dyscyplina Zdolności",
            family: "restriction",
            tier: "street",
            rewardJC: 2,
            evaluation: "sequence",
            window: "next3",
            textTemplate: "Przez następne 3 picki nie wybieraj kart typu {targetTagName}.",
            evaluator: "pickedCardDoesNotHaveTag",
            parameters: {
                targetTag: {
                    source: "tagCategory",
                    category: "abilityTypes",
                    eligibility: {
                        minActivePoolShare: 0.12,
                        maxActivePoolShare: 0.60
                    }
                }
            },
            progress: {
                type: "survival",
                target: 3
            },
            failure: "conditionBroken",
            requirements: {
                normalPicks: true
            }
        },

        {
            code: "Q006",
            id: "cost-spectrum",
            name: "Spektrum Kosztów",
            family: "deckState",
            tier: "avengers",
            rewardJC: 3,
            evaluation: "checkpoint",
            window: "next6",
            textTemplate: "W ciągu 6 picków miej w decku karty z co najmniej {requiredBuckets} różnych przedziałów Cost.",
            evaluator: "deckHasDistinctCostBuckets",
            parameters: {
                requiredBuckets: {
                    source: "values",
                    values: [4]
                },
                buckets: ["0-1", "2", "3", "4", "5", "6+"]
            },
            progress: {
                type: "distinctCounter",
                targetParameter: "requiredBuckets"
            },
            failure: "checkpointMissed",
            requirements: {
                normalPicks: true
            }
        },

        {
            code: "Q007",
            id: "archetype-core",
            name: "Rdzeń Archetypu",
            family: "deckState",
            tier: "avengers",
            rewardJC: 3,
            evaluation: "checkpoint",
            window: "next6",
            textTemplate: "W ciągu 6 picków miej w decku co najmniej {requiredCards} kart z archetypu {targetTagName}.",
            evaluator: "deckHasTagCount",
            parameters: {
                targetTag: {
                    source: "tagCategory",
                    category: "deckArchetypes",
                    eligibility: {
                        minActivePoolShare: 0.10
                    }
                },
                requiredCards: {
                    source: "values",
                    values: [3]
                }
            },
            progress: {
                type: "counter",
                targetParameter: "requiredCards"
            },
            failure: "checkpointMissed",
            requirements: {
                normalPicks: true
            }
        },

        /* ======================================================
           Q008–Q015 — COST / POWER / PICK SEQUENCES
        ====================================================== */

        {
            code: "Q008",
            id: "cost-pair",
            name: "Kosztowa Para",
            family: "pickSequence",
            tier: "street",
            rewardJC: 2,
            evaluation: "aggregate",
            window: "next3",
            textTemplate: "Wśród następnych 3 picków wybierz co najmniej 2 karty o tym samym Base Cost.",
            evaluator: "pickedCardsContainSameCostPair",
            parameters: {
                requiredMatchingCards: {
                    source: "values",
                    values: [2]
                }
            },
            progress: {
                type: "bestGroupCount",
                groupBy: "baseCost",
                targetParameter: "requiredMatchingCards"
            },
            failure: "aggregateMissed",
            requirements: {
                normalPicks: true
            }
        },

        {
            code: "Q009",
            id: "cost-contrast",
            name: "Kosztowy Kontrast",
            family: "pickSequence",
            tier: "avengers",
            rewardJC: 3,
            evaluation: "aggregate",
            window: "next2",
            textTemplate: "Twoje następne 2 picki muszą różnić się Base Costem o co najmniej {minCostGap}.",
            evaluator: "pickedCardsCostGapAtLeast",
            parameters: {
                minCostGap: {
                    source: "values",
                    values: [3]
                }
            },
            progress: {
                type: "pairDelta",
                field: "baseCost",
                targetParameter: "minCostGap"
            },
            failure: "aggregateMissed",
            requirements: {
                normalPicks: true
            }
        },

        {
            code: "Q010",
            id: "power-average",
            name: "Przewaga Mocy",
            family: "pickSequence",
            tier: "avengers",
            rewardJC: 3,
            evaluation: "aggregate",
            window: "next3",
            textTemplate: "Średni Base Power Twoich następnych 3 picków musi wynosić co najmniej {targetAveragePower}.",
            evaluator: "pickedCardsAveragePowerAtLeast",
            parameters: {
                targetAveragePower: {
                    source: "values",
                    values: [4.5, 5, 5.5],
                    eligibility: {
                        metric: "activePoolSequenceFeasibility",
                        minimumReasonableOpportunity: 0.35
                    }
                }
            },
            progress: {
                type: "runningAverage",
                field: "basePower",
                targetParameter: "targetAveragePower"
            },
            failure: "aggregateMissed",
            requirements: {
                normalPicks: true
            }
        },

        {
            code: "Q011",
            id: "power-pair",
            name: "Lustrzana Moc",
            family: "pickSequence",
            tier: "avengers",
            rewardJC: 3,
            evaluation: "aggregate",
            window: "next3",
            textTemplate: "Wśród następnych 3 picków wybierz co najmniej 2 karty o tym samym Base Power.",
            evaluator: "pickedCardsContainSamePowerPair",
            parameters: {
                requiredMatchingCards: {
                    source: "values",
                    values: [2]
                }
            },
            progress: {
                type: "bestGroupCount",
                groupBy: "basePower",
                targetParameter: "requiredMatchingCards"
            },
            failure: "aggregateMissed",
            requirements: {
                normalPicks: true
            }
        },

        {
            code: "Q012",
            id: "cost-direction",
            name: "Kierunek Krzywej",
            family: "pickSequence",
            tier: "celestial",
            rewardJC: 4,
            evaluation: "sequence",
            window: "next3",
            textTemplate: "Przez następne 3 picki wybieraj karty o ściśle {directionLabel} Base Cost.",
            evaluator: "pickedCardsStrictCostDirection",
            parameters: {
                direction: {
                    source: "enum",
                    values: [
                        {id:"ascending", label:"rosnącym"},
                        {id:"descending", label:"malejącym"}
                    ]
                }
            },
            progress: {
                type: "orderedSequence",
                field: "baseCost",
                target: 3
            },
            failure: "conditionBroken",
            requirements: {
                normalPicks: true
            }
        },

        {
            code: "Q013",
            id: "three-orbits",
            name: "Trzy Orbity",
            family: "pickSequence",
            tier: "avengers",
            rewardJC: 3,
            evaluation: "sequence",
            window: "next3",
            textTemplate: "Twoje następne 3 picki muszą mieć 3 różne Base Costy.",
            evaluator: "pickedCardsHaveDistinctCosts",
            parameters: {
                requiredDistinctCosts: {
                    source: "values",
                    values: [3]
                }
            },
            progress: {
                type: "distinctCounter",
                field: "baseCost",
                targetParameter: "requiredDistinctCosts"
            },
            failure: "conditionBroken",
            requirements: {
                normalPicks: true
            }
        },

        {
            code: "Q014",
            id: "curve-spectrum",
            name: "Pełne Spektrum",
            family: "pickSequence",
            tier: "celestial",
            rewardJC: 4,
            evaluation: "aggregate",
            window: "next3",
            textTemplate: "W następnych 3 pickach wybierz po 1 karcie z każdego zakresu: Cost 0–2, Cost 3–4 i Cost 5+.",
            evaluator: "pickedCardsCoverCostBands",
            parameters: {
                bands: [
                    {id:"low",  label:"0–2", min:0, max:2},
                    {id:"mid",  label:"3–4", min:3, max:4},
                    {id:"high", label:"5+",  min:5, max:null}
                ]
            },
            progress: {
                type: "coverage",
                source: "bands",
                target: 3
            },
            failure: "aggregateMissed",
            requirements: {
                normalPicks: true
            }
        },

        {
            code: "Q015",
            id: "light-cargo",
            name: "Lekki Bagaż",
            family: "restriction",
            tier: "street",
            rewardJC: 2,
            evaluation: "sequence",
            window: "next3",
            textTemplate: "Przez następne 3 picki nie wybieraj kart o Base Cost 5 lub wyższym.",
            evaluator: "pickedCardCostBelow",
            parameters: {
                forbiddenCostAtLeast: {
                    source: "values",
                    values: [5]
                }
            },
            progress: {
                type: "survival",
                target: 3
            },
            failure: "conditionBroken",
            requirements: {
                normalPicks: true
            }
        },

        /* ======================================================
           Q016–Q030 — DRUGA FALA: RELACJE / DECK STATE / SUMY

           Tiering canon:
           - Street: szerokie Ability Types / Series / Cost / Power.
           - Archetypes/Subtypes: minimum Avengers.
           - Długie i final-deck constraints: zwykle Celestial.
        ====================================================== */

        {
            code: "Q016",
            id: "repeating-signal",
            name: "Powtarzalny Sygnał",
            family: "pickSequence",
            tier: "street",
            rewardJC: 2,
            evaluation: "aggregate",
            window: "next2",
            textTemplate: "Twoje następne 2 picki muszą współdzielić przynajmniej jeden Ability Type.",
            evaluator: "twoPicksShareAnyAbilityType",
            parameters: {},
            progress: {type:"pairMatch", target:2},
            failure: "aggregateMissed",
            requirements: {normalPicks:true}
        },

        {
            code: "Q017",
            id: "series-signal",
            name: "Sygnał Serii",
            family: "cardTarget",
            tier: "street",
            rewardJC: 2,
            evaluation: "hit",
            window: "next2",
            textTemplate: "W ciągu następnych 2 picków wybierz kartę z {targetSeriesName}.",
            evaluator: "pickedCardHasSeries",
            parameters: {
                targetSeries: {
                    source:"tagCategory",
                    category:"series",
                    eligibility:{minActivePoolShare:0.10,minActivePoolCount:4}
                }
            },
            progress:{type:"counter",target:1},
            failure:"windowExpired",
            requirements:{normalPicks:true}
        },

        {
            code: "Q018",
            id: "energy-surplus",
            name: "Nadwyżka Energii",
            family: "cardTarget",
            tier: "street",
            rewardJC: 2,
            evaluation: "hit",
            window: "next2",
            textTemplate: "W ciągu następnych 2 picków wybierz kartę, której Base Power jest większy od Base Cost.",
            evaluator: "pickedCardPowerComparedToCost",
            parameters:{relation:"greater"},
            progress:{type:"counter",target:1},
            failure:"windowExpired",
            requirements:{normalPicks:true}
        },

        {
            code: "Q019",
            id: "steady-course",
            name: "Stabilny Kurs",
            family: "restriction",
            tier: "street",
            rewardJC: 2,
            evaluation: "sequence",
            window: "next2",
            textTemplate: "Przez następne 2 picki wybieraj wyłącznie karty o Base Cost {maxCost} lub niższym.",
            evaluator: "allPicksCostAtMost",
            parameters:{maxCost:{source:"values",values:[4,5]}},
            progress:{type:"survival",target:2},
            failure:"conditionBroken",
            requirements:{normalPicks:true}
        },

        {
            code: "Q020",
            id: "double-frequency",
            name: "Podwójna Częstotliwość",
            family: "cardTarget",
            tier: "street",
            rewardJC: 2,
            evaluation: "hit",
            window: "next2",
            textTemplate: "W ciągu następnych 2 picków wybierz kartę typu {targetTagAName} lub {targetTagBName}.",
            evaluator: "pickedCardHasAnyTag",
            parameters:{
                targetTags:{
                    source:"twoCompatibleTags",
                    category:"abilityTypes",
                    eligibility:{minEachActivePoolShare:0.08,minCombinedActivePoolShare:0.22}
                }
            },
            progress:{type:"counter",target:1},
            failure:"windowExpired",
            requirements:{normalPicks:true}
        },

        {
            code: "Q021",
            id: "shared-orbit",
            name: "Wspólna Orbita",
            family: "pickSequence",
            tier: "avengers",
            rewardJC: 3,
            evaluation: "aggregate",
            window: "next3",
            textTemplate: "Wśród następnych 3 picków wybierz 2 karty współdzielące dowolny archetyp.",
            evaluator: "windowContainsPairSharingArchetype",
            parameters:{},
            progress:{type:"pairMatch",target:2},
            failure:"aggregateMissed",
            requirements:{normalPicks:true}
        },

        {
            code: "Q022",
            id: "reactor-overload",
            name: "Przeciążenie Reaktora",
            family: "pickSequence",
            tier: "avengers",
            rewardJC: 3,
            evaluation: "aggregate",
            window: "next2",
            textTemplate: "Łączny Base Power Twoich następnych 2 picków musi wynieść co najmniej {targetSum}.",
            evaluator: "windowFieldSumAtLeast",
            parameters:{field:"basePower",targetSum:{source:"values",values:[10,11,12]}},
            progress:{type:"runningSum",field:"basePower",targetParameter:"targetSum"},
            failure:"aggregateMissed",
            requirements:{normalPicks:true}
        },

        {
            code: "Q023",
            id: "cargo-limit",
            name: "Limit Ładunku",
            family: "pickSequence",
            tier: "avengers",
            rewardJC: 3,
            evaluation: "aggregate",
            window: "next2",
            textTemplate: "Łączny Base Power Twoich następnych 2 picków nie może przekroczyć {targetSum}.",
            evaluator: "windowFieldSumAtMost",
            parameters:{field:"basePower",targetSum:{source:"values",values:[8,9,10]}},
            progress:{type:"runningSum",field:"basePower",targetParameter:"targetSum"},
            failure:"aggregateMissed",
            requirements:{normalPicks:true}
        },

        {
            code: "Q024",
            id: "light-construction",
            name: "Lekka Konstrukcja",
            family: "deckState",
            tier: "avengers",
            rewardJC: 3,
            evaluation: "checkpoint",
            window: "pick6",
            activationProfile: "earlyCheckpoint",
            textTemplate: "Po 6. picku średni Base Cost Twojego decku nie może przekraczać {targetAverage}.",
            evaluator: "deckAverageFieldAtMost",
            parameters:{field:"baseCost",targetAverage:{source:"values",values:[3,3.25,3.5]}},
            progress:{type:"runningAverage",field:"baseCost",targetParameter:"targetAverage"},
            failure:"checkpointMissed",
            requirements:{normalPicks:true}
        },

        {
            code: "Q025",
            id: "fleet-power",
            name: "Potęga Floty",
            family: "deckState",
            tier: "avengers",
            rewardJC: 3,
            evaluation: "checkpoint",
            window: "pick6",
            activationProfile: "earlyCheckpoint",
            textTemplate: "Po 6. picku średni Base Power Twojego decku musi wynosić co najmniej {targetAverage}.",
            evaluator: "deckAverageFieldAtLeast",
            parameters:{field:"basePower",targetAverage:{source:"values",values:[4.5,5,5.5]}},
            progress:{type:"runningAverage",field:"basePower",targetParameter:"targetAverage"},
            failure:"checkpointMissed",
            requirements:{normalPicks:true}
        },

        {
            code: "Q026",
            id: "new-signal",
            name: "Nowy Sygnał",
            family: "deckReactive",
            tier: "avengers",
            rewardJC: 3,
            evaluation: "hit",
            window: "next2",
            activationProfile: "midDeck",
            textTemplate: "W ciągu następnych 2 picków wybierz kartę z Ability Type, którego nie miałeś w decku w chwili aktywacji Próby.",
            evaluator: "pickedCardHasAbilityTypeMissingFromDeck",
            parameters:{},
            progress:{type:"counter",target:1},
            failure:"windowExpired",
            requirements:{normalPicks:true}
        },

        {
            code: "Q027",
            id: "power-constellation",
            name: "Konstelacja Mocy",
            family: "finalDeck",
            tier: "celestial",
            rewardJC: 4,
            evaluation: "checkpoint",
            window: "draftEnd",
            activationProfile: "longHorizon",
            textTemplate: "Na koniec draftu miej w decku co najmniej 4 karty o tym samym Base Power.",
            evaluator: "deckHasSameFieldCount",
            parameters:{field:"basePower",requiredCards:4},
            progress:{type:"bestGroupCount",groupBy:"basePower",targetParameter:"requiredCards"},
            failure:"checkpointMissed",
            requirements:{normalPicks:true}
        },

        {
            code: "Q028",
            id: "galactic-diversity",
            name: "Galaktyczna Różnorodność",
            family: "finalDeck",
            tier: "celestial",
            rewardJC: 4,
            evaluation: "checkpoint",
            window: "draftEnd",
            activationProfile: "longHorizon",
            textTemplate: "Na koniec draftu miej w decku karty reprezentujące co najmniej 6 różnych archetypów.",
            evaluator: "deckHasDistinctTagCount",
            parameters:{category:"deckArchetypes",requiredDistinct:6},
            progress:{type:"distinctCounter",targetParameter:"requiredDistinct"},
            failure:"checkpointMissed",
            requirements:{normalPicks:true}
        },

        {
            code: "Q029",
            id: "curve-polarization",
            name: "Polaryzacja Krzywej",
            family: "finalDeck",
            tier: "celestial",
            rewardJC: 4,
            evaluation: "checkpoint",
            window: "draftEnd",
            activationProfile: "longHorizon",
            textTemplate: "Na koniec draftu miej co najmniej 3 karty Cost 0–2 i co najmniej 3 karty Cost 5+.",
            evaluator: "deckHasCostPolarization",
            parameters:{lowMax:2,highMin:5,requiredLow:3,requiredHigh:3},
            progress:{type:"dualCounter",target:6},
            failure:"checkpointMissed",
            requirements:{normalPicks:true}
        },

        {
            code: "Q030",
            id: "balance-trial",
            name: "Próba Równowagi",
            family: "finalDeck",
            tier: "celestial",
            rewardJC: 4,
            evaluation: "checkpoint",
            window: "draftEnd",
            activationProfile: "longHorizon",
            textTemplate: "Na koniec draftu utrzymaj średni Base Cost decku pomiędzy {minAverage} a {maxAverage}.",
            evaluator: "deckAverageFieldBetween",
            parameters:{field:"baseCost",minAverage:2.75,maxAverage:3.5},
            progress:{type:"range",target:1},
            failure:"checkpointMissed",
            requirements:{normalPicks:true}
        }

        ,

        /* ======================================================
           Q031–Q040 — NOWE QUESTY V1
           Pack-reactive / deck delta / Economy events.

           Canon:
           - Archetypes/Subtypes: minimum Avengers.
           - Questy zależne od istniejącego decku nie trafiają do startPool.
           - Economy event quests są nieliczne i wyraźnie różne.
           - Czarna Owca / unikalny Cost w paczce NIE wchodzi do puli.
        ====================================================== */

        {
            code: "Q031",
            id: "giant-hunter",
            name: "Łowca Olbrzymów",
            family: "packReactive",
            tier: "street",
            rewardJC: 2,
            evaluation: "hit",
            window: "next2",
            textTemplate: "W ciągu następnych 2 picków wybierz kartę o najwyższym Base Cost spośród kart aktualnie dostępnych w paczce.",
            evaluator: "pickedSourceCardIsPackExtremeCost",
            parameters: {direction:"highest"},
            progress: {type:"counter",target:1},
            failure: "windowExpired",
            requirements: {
                normalPicks:true,
                packLayout:true,
                excludedModes:["galacticCurrent"]
            }
        },

        {
            code: "Q032",
            id: "small-loot",
            name: "Mały Łup",
            family: "packReactive",
            tier: "street",
            rewardJC: 2,
            evaluation: "hit",
            window: "next2",
            textTemplate: "W ciągu następnych 2 picków wybierz kartę o najniższym Base Cost spośród kart aktualnie dostępnych w paczce.",
            evaluator: "pickedSourceCardIsPackExtremeCost",
            parameters: {direction:"lowest"},
            progress: {type:"counter",target:1},
            failure: "windowExpired",
            requirements: {
                normalPicks:true,
                packLayout:true,
                excludedModes:["galacticCurrent"]
            }
        },

        {
            code: "Q033",
            id: "pack-dominance",
            name: "Dominacja",
            family: "packReactive",
            tier: "avengers",
            rewardJC: 3,
            evaluation: "hit",
            window: "next2",
            textTemplate: "W ciągu następnych 2 picków wybierz kartę o najwyższym Base Power spośród kart aktualnie dostępnych w paczce.",
            evaluator: "pickedSourceCardIsPackHighestPower",
            parameters: {},
            progress: {type:"counter",target:1},
            failure: "windowExpired",
            requirements: {
                normalPicks:true,
                packLayout:true,
                excludedModes:["galacticCurrent"]
            }
        },

        {
            code: "Q034",
            id: "broaden-horizon",
            name: "Poszerz Horyzont",
            family: "deckDelta",
            tier: "avengers",
            rewardJC: 3,
            evaluation: "checkpoint",
            window: "next3",
            activationProfile: "midDeck",
            textTemplate: "W ciągu następnych 3 picków zwiększ liczbę różnych przedziałów Base Cost w swoim decku o co najmniej 2.",
            evaluator: "deckDistinctCostBucketDeltaAtLeast",
            parameters: {requiredIncrease:2},
            progress: {type:"delta",targetParameter:"requiredIncrease"},
            failure: "checkpointMissed",
            requirements: {normalPicks:true}
        },

        {
            code: "Q035",
            id: "new-doctrine",
            name: "Nowa Doktryna",
            family: "deckDelta",
            tier: "avengers",
            rewardJC: 3,
            evaluation: "checkpoint",
            window: "next3",
            activationProfile: "midDeck",
            textTemplate: "W ciągu następnych 3 picków dodaj do decku co najmniej 2 różne Ability Types, których nie miałeś w chwili aktywacji Próby.",
            evaluator: "deckNewAbilityTypesAddedAtLeast",
            parameters: {requiredNewTypes:2},
            progress: {type:"distinctDelta",targetParameter:"requiredNewTypes"},
            failure: "checkpointMissed",
            requirements: {normalPicks:true}
        },

        {
            code: "Q036",
            id: "expand-core",
            name: "Rozbudowa Rdzenia",
            family: "deckDelta",
            tier: "avengers",
            rewardJC: 3,
            evaluation: "checkpoint",
            window: "next3",
            activationProfile: "midDeck",
            textTemplate: "W ciągu następnych 3 picków dodaj do decku co najmniej 2 karty z archetypu {targetArchetypeName}, który był jednym z Twoich najmocniejszych rdzeni przy aktywacji Próby.",
            evaluator: "deckDominantArchetypeGrowthAtLeast",
            parameters: {requiredGrowth:2},
            progress: {type:"delta",targetParameter:"requiredGrowth"},
            failure: "checkpointMissed",
            requirements: {normalPicks:true}
        },

        {
            code: "Q037",
            id: "ability-specialization",
            name: "Specjalizacja Zdolności",
            family: "finalDeck",
            tier: "avengers",
            rewardJC: 3,
            evaluation: "checkpoint",
            window: "draftEnd",
            activationProfile: "longHorizon",
            textTemplate: "Na koniec draftu miej w decku co najmniej 4 karty typu {targetTagName}.",
            evaluator: "deckHasTagCount",
            parameters: {
                targetTag: {
                    source:"tagCategory",
                    category:"abilityTypes",
                    eligibility:{
                        minActivePoolShare:0.14,
                        minActivePoolCount:8
                    }
                },
                requiredCards: {
                    source:"values",
                    values:[4]
                }
            },
            progress:{type:"counter",targetParameter:"requiredCards"},
            failure:"checkpointMissed",
            requirements:{normalPicks:true}
        },

        {
            code: "Q038",
            id: "first-investment",
            name: "Pierwsza Inwestycja",
            family: "economyEvent",
            tier: "street",
            rewardJC: 2,
            evaluation: "event",
            window: "pick7",
            activationProfile: "earlyCommerce",
            textTemplate: "Dokonaj dowolnego zakupu w Jeff’s Cosmic Shop przed ukończeniem swojego 7. normalnego picku.",
            evaluator: "shopPurchaseBeforeNormalPick",
            parameters:{beforePick:7},
            progress:{type:"eventCounter",target:1},
            failure:"checkpointMissed",
            requirements:{normalPicks:true,economyEnabled:true}
        },

        {
            code: "Q039",
            id: "first-deal",
            name: "Pierwszy Interes",
            family: "extensionEvent",
            tier: "celestial",
            rewardJC: 4,
            evaluation: "event",
            window: "draftEnd",
            activationProfile: "eventLongHorizon",
            textTemplate: "Doprowadź do jednej zakończonej sukcesem transakcji na Galaktycznym Targu.",
            evaluator: "tradeMarketTransactionCompleted",
            parameters:{requiredTransactions:1},
            progress:{type:"eventCounter",target:1},
            failure:"checkpointMissed",
            requirements:{
                normalPicks:true,
                economyEnabled:true,
                extensions:["galacticMarket"]
            }
        },

        {
            code: "Q040",
            id: "life-on-the-edge",
            name: "Życie na Krawędzi",
            family: "economyEvent",
            tier: "celestial",
            rewardJC: 4,
            evaluation: "event",
            window: "draftEnd",
            activationProfile: "eventLongHorizon",
            textTemplate: "Dokonaj zakupu w Jeff’s Cosmic Shop, po którym zostanie Ci maksymalnie 1 JeffCoin.",
            evaluator: "shopPurchaseLeavesBalanceAtMost",
            parameters:{maxBalance:1},
            progress:{type:"eventCounter",target:1},
            failure:"checkpointMissed",
            requirements:{normalPicks:true,economyEnabled:true}
        }

    ];

    const REGISTRY = Object.freeze({
        version: VERSION,
        extension: EXTENSION,
        tiers: TIERS,
        windows: WINDOWS,
        activationProfiles: ACTIVATION_PROFILES,
        costBuckets: COST_BUCKETS,
        quests: QUESTS
    });

    global.DraftQuestRegistry = REGISTRY;

    if(typeof module !== "undefined" && module.exports){
        module.exports = REGISTRY;
    }

})(typeof window !== "undefined" ? window : globalThis);
