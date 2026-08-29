// ===============================
// 🎴 CUSTOM PACK DEFINITIONS v1.21 FINAL LAST
// ===============================

const customPackCategories = {
    mechanics: {
        name: "ARCHETYPY I MECHANIKI",
        description: "Paczki budowane wokół sposobu działania kart i konkretnych synergii.",
        icon: "⚙"
    },
    thematic: {
        name: "PACZKI TEMATYCZNE",
        description: "Drużyny, uniwersa, stworzenia i motywy fabularne.",
        icon: "🧬"
    },
    statistics: {
        name: "PACZKI STATYSTYK",
        description: "Paczki filtrowane według Kosztu, Siły albo ich kombinacji.",
        icon: "📊"
    },
    special: {
        name: "PACZKI SPECJALNE I JUBILEUSZOWE",
        description: "Archiwalne zwycięskie decki i wyjątkowe edycje MSP SnapDraft.",
        icon: "✦"
    }
};

const customPacks = [

    {
        id: "jubilee_1_2",
        name: "JUBILEUSZ DRAFT 1 & 2 - Hahke & Dejwidgakure",
        category: "special",
        summary: "Karty ze zwycięskich decków Draftów 1 i 2.",
        tags: ["wind1", "wind2"]
    },

    {
        id: "jubilee_3_4",
        name: "JUBILEUSZ DRAFT 3 & 4 - kb & Dejwidgakure",
        category: "special",
        summary: "Karty ze zwycięskich decków Draftów 3 i 4.",
        tags: ["wind3", "wind4"]
    },

    {
        id: "jubilee_5_6",
        name: "JUBILEUSZ DRAFT 5 & 6 - Xevo & kb",
        category: "special",
        summary: "Karty ze zwycięskich decków Draftów 5 i 6.",
        tags: ["wind5", "wind6"]
    },

    {
        id: "jubilee_7_8",
        name: "JUBILEUSZ DRAFT 7 & 8 - Marek & Jacusinski",
        category: "special",
        summary: "Karty ze zwycięskich decków Draftów 7 i 8.",
        tags: ["wind7", "wind8"]
    },

    {
        id: "jubilee_9_10",
        name: "JUBILEUSZ DRAFT 9 & 10 - Jacusinski & Hardkor",
        category: "special",
        summary: "Karty ze zwycięskich decków Draftów 9 i 10.",
        tags: ["wind9", "wind10"]
    },

    {
        id: "jubilee_11_12",
        name: "JUBILEUSZ DRAFT 11 & 12 - Raciatek & Polop852",
        category: "special",
        summary: "Karty ze zwycięskich decków Draftów 11 i 12.",
        tags: ["wind11", "wind12"]
    },

    {
        id: "jubilee_13_14",
        name: "JUBILEUSZ DRAFT 13 & 14 - Supcio & Dejwidgakure",
        category: "special",
        summary: "Karty ze zwycięskich decków Draftów 13 i 14.",
        tags: ["wind13", "wind14"]
    },

    {
        id: "jubilee_15_16",
        name: "JUBILEUSZ DRAFT 15 & 16 - Supcio & Weregesu",
        category: "special",
        summary: "Karty ze zwycięskich decków Draftów 15 i 16.",
        tags: ["wind15", "wind16"]
    },

    {
        id: "jubilee_17_18",
        name: "JUBILEUSZ DRAFT 17 & 18 - Supcio & Kmythic",
        category: "special",
        summary: "Karty ze zwycięskich decków Draftów 17 i 18.",
        tags: ["wind17", "wind18"]
    },
 {
        id: "jubilee_19",
        name: "JUBILEUSZ DRAFT 19 - Dejwidgakure",
        category: "special",
        summary: "Karty ze zwycięskiego decku Draftu 19.",
        tags: ["wind19"]
    },

{
    id: "animal_pack",
    name: "PACZKA ZWIERZAKOWA 🐾",
    category: "thematic",
    summary: "Bohaterowie i stworzenia oznaczone jako Animals.",
    tags: ["animals"]
},

{
    id: "avengers_pack",
    name: "AVENGERS ASSEMBLE! 🅰️",
    category: "thematic",
    summary: "Avengers, New Avengers, West Coast Avengers, Dark Avengers i Young Avengers.",
    tags: ["avengers", "new-avengers", "west-coast-avengers", "dark-avengers", "young-avengers"]
},
{
    id: "low_cost",
    name: "LOW COST",
    category: "statistics",
    summary: "Wyłącznie karty o Koszcie od 0 do 2.",
    minCost: 0,
    maxCost: 2
},
{
    id: "tanie_mocne",
    name: "TANIE & MOCNE",
    category: "statistics",
    summary: "Karty za 2–3 o Sile co najmniej 5.",
    tags: [],
    minCost: 2,
    maxCost: 3,
    minPower: 5
},
    {
    id: "zoo_pack",
    name: "ZOO PACK",
    category: "statistics",
    summary: "Wyłącznie karty o Koszcie 0 albo 1.",
    tags: [],
    minCost: 0,
    maxCost: 1
},
    {
     id: "spell_pack",
    name: "PACZKA SPELLOWA",
    category: "mechanics",
    summary: "Spelle, ich generatorzy i karty bezpośrednio wspierające Spelle.",
    tags: ["spells"] 
},
     {
     id: "card_gen_pack",
    name: "PACZKA GENERATORÓW",
    category: "mechanics",
    summary: "Karty tworzące inne karty w ręce albo bezpośrednio wspierające ich generowanie.",
    tags: ["card-generation"] 
},
    
{
    id: "red_pack",
    name: "RED PACK 🔴",
    category: "thematic",
    summary: "Karty, których nazwa zawiera słowo „Red”.",
    nameIncludes: "red"
},
     {
        id: "jubilee_2_5",
        name: "JUBILEUSZ DRAFT 2 & 5 - Dejwidgakure & Xevo",
        category: "special",
        summary: "Karty ze zwycięskich decków Draftów 2 i 5.",
        tags: ["wind5", "wind2"]
    },
{
    id: "spider_pack",
    name: "PACZKA SPIDERVERSE 🕷️",
    category: "thematic",
    summary: "Postacie i karty należące do Spider-Verse.",
    tags: ["spider-verse"] 
}

,
{
    id: "on_reveal_party",
    name: "REVEAL PARTY ✨",
    category: "mechanics",
    summary: "Paczka zbudowana wokół kart On Reveal.",
    tags: ["on-reveal"]
},
{
    id: "ongoing_forever",
    name: "ONGOING FOREVER ♾️",
    category: "mechanics",
    summary: "Paczka zbudowana wokół kart Ongoing.",
    tags: ["ongoing"]
},
{
    id: "trigger_happy",
    name: "TRIGGER HAPPY 💥",
    category: "mechanics",
    summary: "Karty z Ability Type Trigger Card.",
    tags: ["trigger-card"]
},
{
    id: "destroy_everything",
    name: "DESTROY EVERYTHING 💀",
    category: "mechanics",
    summary: "Karty należące do archetypu Destroy.",
    tags: ["destroy"]
},
{
    id: "move_it",
    name: "MOVE IT! 🌀",
    category: "mechanics",
    summary: "Karty należące do archetypu Move.",
    tags: ["move"]
},
{
    id: "control_room",
    name: "CONTROL ROOM 🚨",
    category: "mechanics",
    summary: "Tech, Lockdown i Clog — szeroka paczka kontroli.",
    tags: ["tech", "lockdown", "clog"]
},
{
    id: "cosmic_casino",
    name: "COSMIC CASINO 🎰",
    category: "mechanics",
    summary: "Generowanie kart i losowe pule kart.",
    tags: ["card-generation", "random-card-pool"],
    // FINAL LAST HOTFIX: the badges describe real composition, not a loose OR pool.
    // Keep legacy tags for UI/filter metadata, but alternate dedicated buckets so
    // both Card Generation and Random Card Pool are represented in the pack.
    composition: {
        mode: "cycle",
        shuffleBuckets: true,
        buckets: [
            {
                id: "card_generation",
                label: "CARD GENERATION",
                filter: { tags: { allOf: ["card-generation"] } }
            },
            {
                id: "random_card_pool",
                label: "RANDOM CARD POOL",
                filter: { tags: { allOf: ["random-card-pool"] } }
            }
        ]
    }
},
{
    id: "big_boys",
    name: "BIG BOYS 💪",
    category: "statistics",
    summary: "Wyłącznie karty o Sile co najmniej 8.",
    minPower: 8
},
{
    id: "tiny_titans",
    name: "TINY TITANS ⭐",
    category: "statistics",
    summary: "Mały koszt, duża moc: Koszt maks. 2 i Siła co najmniej 5.",
    maxCost: 2,
    minPower: 5
},
{
    id: "zero_heroes",
    name: "ZERO HEROES 0️⃣",
    category: "statistics",
    summary: "Karty o Sile 0 lub mniejszej.",
    maxPower: 0
},
{
    id: "heavy_metal",
    name: "HEAVY METAL 🔨",
    category: "statistics",
    summary: "Ciężkie karty o Koszcie co najmniej 5.",
    minCost: 5
},
{
    id: "glass_cannon",
    name: "GLASS CANNON 💣",
    category: "statistics",
    summary: "Karty o Koszcie maks. 3 i Sile co najmniej 6.",
    maxCost: 3,
    minPower: 6
},
{
    id: "magic_mystic",
    name: "MAGIC & MYSTIC 🔮",
    category: "thematic",
    summary: "Magowie i karty oznaczone jako Magicians.",
    tags: ["magicians"]
},
{
    id: "cosmic_horror",
    name: "COSMIC HORROR 🌌",
    category: "thematic",
    summary: "Kosmiczne byty i potwory.",
    tags: ["cosmic-entities", "monsters"]
},
{
    id: "villain_pack",
    name: "VILLAIN PACK 😈",
    category: "thematic",
    summary: "Złoczyńcy Marvela.",
    tags: ["villains"]
},
{
    id: "robots_cyborgs",
    name: "ROBOTS & CYBORGS 🤖",
    category: "thematic",
    summary: "Roboty, androidy i cyborgi.",
    tags: ["robots-cyborgs"]
},
{
    id: "symbiote_invasion",
    name: "SYMBIOTE INVASION 🖤",
    category: "thematic",
    summary: "Symbionty i postacie związane z symbiotami.",
    tags: ["symbiotes"]
},
{
    id: "x_family_pack",
    name: "X-FAMILY ❌",
    category: "thematic",
    summary: "X-Men, X-Force i New Mutants w jednej wspólnej puli.",
    tags: ["xmen", "x-force", "new-mutants"]
}

,
{
    id: "perfect_curve",
    name: "PERFECT CURVE 📈",
    category: "statistics",
    summary: "Gwarantowana rotacja kosztów: 1 → 2 → 3 → 4 → 5 → 6+ i od początku.",
    composition: {
        mode: "cycle",
        shuffleBuckets: false,
        buckets: [
            { label: "COST 1", filter: { cost: { exact: 1 } } },
            { label: "COST 2", filter: { cost: { exact: 2 } } },
            { label: "COST 3", filter: { cost: { exact: 3 } } },
            { label: "COST 4", filter: { cost: { exact: 4 } } },
            { label: "COST 5", filter: { cost: { exact: 5 } } },
            { label: "COST 6+", filter: { cost: { min: 6 } } }
        ]
    }
},
{
    id: "universal_pack",
    name: "SWISS ARMY PACK 🛠️",
    category: "mechanics",
    summary: "Tylko wyjątkowo uniwersalne karty należące do co najmniej 3 archetypów.",
    filter: {
        tagCounts: [
            { category: "deckArchetypes", min: 3 }
        ]
    }
},
{
    id: "ability_rainbow",
    name: "ABILITY RAINBOW 🌈",
    category: "mechanics",
    summary: "Generator rotuje między różnymi Ability Types, aby paczka była mechanicznie różnorodna.",
    composition: {
        mode: "tag-rainbow",
        category: "abilityTypes",
        shuffleBuckets: true
    }
},
{
    id: "archetype_rainbow",
    name: "ARCHETYPE RAINBOW 🧩",
    category: "mechanics",
    summary: "Każdy kolejny slot pochodzi z innego archetypu; generator maksymalizuje różnorodność.",
    composition: {
        mode: "tag-rainbow",
        category: "deckArchetypes",
        shuffleBuckets: true
    }
},
{
    id: "beast_mode",
    name: "BEAST MODE 🐾",
    category: "thematic",
    summary: "Łączy prawdziwe Animals i postacie tylko inspirowane zwierzętami.",
    filter: {
        tags: {
            anyOf: ["animals", "animal-themed"]
        }
    }
}


];

window.CUSTOM_PACK_CATEGORIES = customPackCategories;
