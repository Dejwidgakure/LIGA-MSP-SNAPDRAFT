const fs=require("fs");
const path=require("path");
const assert=require("assert");

const root=__dirname;
const css=fs.readFileSync(path.join(root,"draft-quests.css"),"utf8");
const ui=fs.readFileSync(path.join(root,"draft-quests-ui.js"),"utf8");
const html=fs.readFileSync(path.join(root,"snap-draft.html"),"utf8");

const assets=[
    "quest_arishem_pattern_main.webp",
    "quest_arishem_pattern_eye.webp",
    "quest_arishem_energy_overlay.webp",
    "quest_arishem_opening_portal.webp",
    "quest_arishem_reward_frame.webp",
    "quest_arishem_launcher_frame.webp",
    "quest_arishem_corner_tl.webp",
    "quest_arishem_corner_tr.webp",
    "quest_arishem_corner_bl.webp",
    "quest_arishem_corner_br.webp"
];

for(const asset of assets){
    const file=path.join(root,"draft-assets",asset);
    assert(fs.existsSync(file),`missing restored Arishem asset: ${asset}`);
    assert(fs.statSync(file).size>1000,`empty restored Arishem asset: ${asset}`);
    assert(css.includes(asset),`restored asset is not used by CSS: ${asset}`);
}

assert.match(ui,/0\.5\.0-arishem-sanctuary-restored/);
assert.match(html,/draft-quests\.css\?v=0\.7\.0-arishem-sanctuary-restored/);
assert.match(html,/draft-quests-ui\.js\?v=0\.5\.0-arishem-sanctuary-restored/);
assert.match(ui,/draft-quest-launcher-temple/,'latest launcher temple layer remains mounted');
assert.match(ui,/draft-quest-hero-layer/,'latest modal temple layer remains mounted');
assert.match(ui,/function triggerOverlayEntrance/,'opening animation lifecycle is restored');
assert.match(ui,/function pulseQuestPanel/,'quest completion pulse is restored');
assert.match(ui,/dataset\.questFx/,'toast visual state is finite and explicit');
assert.match(ui,/setTimeout\(\(\)=>\{[\s\S]*2800/,'toast cannot remain on screen indefinitely');
assert.doesNotMatch(ui,/draft-quest-toast-vfx/,'toast no longer injects an oversized VFX image');

assert.match(css,/QUEST UI V7 — SANCTUARY RESTORE MERGED WITH THE LATEST BUILD/);
assert.match(css,/\.draft-quest-close\{position:absolute!important/,'close control does not consume a grid row');
assert.match(css,/quest_arishem_reward_frame\.webp/,'completion copy is placed inside the reward frame');
assert.match(css,/quest_arishem_launcher_frame\.webp/,'opening copy is placed inside the launcher frame');
assert.match(css,/\.draft-quest-quick-preview\{[\s\S]*max-height:calc\(100dvh - 24px\)!important/,'quick preview is clamped to the viewport');
assert.match(css,/\.draft-quest-card-main::after/,'unused quest-card space receives the Arishem pattern');
assert.match(css,/\.draft-quest-player-summary>div::after/,'summary tiles receive the Arishem pattern');
assert.match(css,/\.draft-quest-footer-copy::after/,'footer tiles receive the Arishem pattern');

console.log("Arishem quest restoration regression OK");
