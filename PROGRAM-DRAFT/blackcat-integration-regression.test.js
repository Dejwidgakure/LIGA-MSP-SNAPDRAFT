const fs=require("fs");
const path=require("path");
const assert=require("assert");

const root=__dirname;
const read=file=>fs.readFileSync(path.join(root,file),"utf8");
const html=read("snap-draft.html");
const data=read("superpowers-data.js");
const ui=read("superpowers-ui.js");
const moduleSource=read("superpowers-blackcat.js");
const v7=read("superpowers-blackcat-v7.js");
const css=read("superpowers-blackcat.css");

assert(data.includes('id: "black_cat"'),"Black Cat must be registered in the canonical Superpower codex");
assert(data.includes('power: "KOCI HEIST"'),"the Polish power name must be canonical");
assert(data.includes('timing: "anytime_safe_draft_window"'),"the heist should work in a safe active-draft window");
assert(data.includes('economySynergy: "optional_jeffcoin_reward_tiles"'),"Economy must be an optional synergy, not a requirement");
assert(data.includes('mainExhibit: "steal_opponent_card_and_replace_same_cost"'),"the main exhibit contract must include a same-cost landing card");

for(const asset of [
  "blackcatpowershero.png","blackcatpowerslogo.png","blackcat_heist_museum_topdown.png",
  "blackcat_heist_vitrine.png","blackcat_heist_laser.png","blackcat_heist_vault_success.png"
]) assert(fs.existsSync(path.join(root,"draft-assets",asset)),`missing Black Cat asset: ${asset}`);

assert(html.includes('superpowers-blackcat.css?v=1.0.12-sacrifice-final'),"Black Cat CSS must be loaded by the canonical page");
assert(html.includes('superpowers-blackcat-v7.js?v=2.0.9-tags-v2'),"the current Black Cat v7 runtime must be loaded by the canonical page");
assert(html.includes('superpowers-blackcat.js?v=1.0.2'),"Black Cat runtime must be loaded by the canonical page");
assert(html.indexOf("superpowers-blackcat.js")<html.indexOf("superpowers-ui.js?v=107.0-black-cat"),"the Black Cat runtime must load before the generic UI lock aggregator");
assert(html.includes('if(powerId==="black_cat")'),"the roster activation router must dispatch Black Cat");
assert(html.includes('window.BlackCatUI?.onQueuePrepared?.();'),"pending queue loot must be applied whenever a queue is prepared or redrawn");

assert(ui.includes('window.BlackCatUI?.isBusy?.()'),"generic Superpower UI must honor the Black Cat mutation lock");
assert(ui.includes('Dokończ KOCI HEIST Black Cat.'),"the mutation lock should explain the active heist in Polish");
assert(moduleSource.includes('cardCost(card)===cardCost(sourceCard)'),"all heist replacements must preserve printed Cost");
assert(moduleSource.includes('global.EconomyEngine?.credit?.(state.playerIndex,1'),"Economy-enabled JeffCoin loot must credit exactly one JeffCoin");
assert(moduleSource.includes('global.SuperpowerEngine?.createRuntimeAsset?.(state.playerName,"black_cat_queue_boost"'),"unspent queue loot must persist as a runtime asset");
assert(moduleSource.includes('actorDeck.push(stolen)'),"a successful main exhibit must join Black Cat's deck");
assert(moduleSource.includes('target.deck[target.index]=replacement'),"the victim must receive the same-cost replacement in the stolen slot");
assert(moduleSource.includes('global.SuperpowerEngine?.completeActivation?.(state.playerName,POWER_ID'),"every resolved heist must consume the once-per-draft power");
assert(!v7.includes('>UCIEKAM Z ŁUPEM<'),"the obsolete voluntary cash-out button must not be rendered");
assert(v7.includes('cell?.kind==="laser"&&session.visited?.has(targetIndex)'),"a discovered laser must be blocked by the engine");
assert(v7.includes('.spx-blackcat-legend-panel,.spx-blackcat-loot'),"legend and bag loot must both use floating tooltips");
assert(v7.includes('spx-blackcat-legend-card-slot'),"possible main loot must reuse the canonical Draft card renderer");
assert(v7.includes('spx-blackcat-board-main-card-slot'),"the board exhibit must reuse the canonical Draft card renderer");
assert(v7.includes('spx-blackcat-event-card-slot'),"the main-exhibit success event must show the stolen card instead of a key");
assert(v7.includes('function visibleGraveyardEntries()'),"Necromancer candidates must use the same visible graveyard pool as the Graveyard UI");
assert(v7.includes('getAvailableEntries?.()'),"Necromancer should prefer the Graveyard UI visible-entry contract");
assert.strictEqual((v7.match(/consumeGraveyardEntry/g)||[]).length,1,"a graveyard card may be consumed only after the gem pick is committed");
assert(v7.includes('spx-blackcat-portal-card-reason'),"gem reflections must explain why each offered card appeared");
assert(v7.includes('normalPicksChronological()'),"Echo must read the normal-pick history from the start of the current draft");
assert(v7.includes('"echo_copy","ECHO PIERWSZEGO PIKA"'),"Echo must offer copies of the two first normal picks");
assert(v7.includes('"shadow_copy","CIEŃ OSTATNIEGO PIKA"'),"Shadow must offer copies of the two latest normal picks");
assert(v7.includes('makeCard(candidate.card'),"gem reflections must create new card instances instead of removing source cards");
assert(v7.includes('DUŻA SYNERGIA:'),"Synergy gem reflections must identify the matching tag");
assert(v7.includes('is-selecting')&&v7.includes('global.setTimeout'),"a gem-offered card must complete its selection flare before the pick commits");
assert(v7.includes('data-own-gallery'),"target selection must render Black Cat's own gallery before rival galleries");
assert(v7.includes('disabled:!state.selectedTarget||!state.selectedSacrifice'),"the heist may start only after both cards are chosen");
assert(v7.includes('archiveCardToGraveyard("sacrificed",displaced'),"the deliberately sacrificed card must be archived only after success");
assert(v7.includes('actorDeck[sacrifice.index]=stolen'),"the stolen exhibit must replace exactly the preselected own card");
const synergyTagLogic=v7.slice(v7.indexOf('function synergyAllowedTagIds'),v7.indexOf('function strongestSharedTag'));
assert(synergyTagLogic.includes('["mechanicFamilies","subtypes","deckArchetypes"]'),"Synergy must whitelist Mechanic Families, detailed mechanics and Deck Archetypes");
assert(synergyTagLogic.includes('allowed.has(id)'),"Synergy tags must be filtered through the archetype/subtype whitelist");
assert(!synergyTagLogic.includes('card?.type'),"Synergy must not use card type tags");
assert(!synergyTagLogic.includes('abilityTypes')&&!synergyTagLogic.includes('series'),"Synergy must not use ability type or series tags");
assert(v7.includes('Rodzinach Mechanik, Mechanikach szczegółowych oraz Archetypach Deckowych / Paczkach'),"Synergy tooltip must describe the Tag Schema V2 synergy search");

assert(css.includes('font-family:"Exo 2","Segoe UI",sans-serif'),"Polish body copy must use a Latin Extended-safe font stack");
assert(css.includes('grid-template-columns:repeat(var(--bc-cols),1fr)'),"the board overlay must use the measured grid, not freehand positions");
assert(css.includes('@media(max-width:780px)'),"the full-screen museum must include a compact responsive layout");
assert(css.includes('@media(max-height:720px)'),"short desktop viewports must receive dedicated fit rules");
assert(css.includes('.spx-blackcat-floating-tooltip'),"loot legend tooltips must escape the scrollable museum shelf");
assert(css.includes('z-index:2147483600'),"floating loot tooltips must render above the full-screen Black Cat overlay");
assert(css.includes('.spx-blackcat-modal.is-target .spx-blackcat-target-card-native'),"target gallery cards must have a modal-scoped visual override");
assert(css.includes('.spx-blackcat-modal.is-target .spx-blackcat-own-gallery'),"the conditional sacrifice gallery must have its own scoped museum treatment");
assert(css.includes('.spx-blackcat-sacrifice-x'),"the chosen sacrifice must display Black Cat's red contract mark");
assert(css.includes('.spx-blackcat-modal.is-target .spx-blackcat-target-card-native .pack-planet'),"the gallery-only energy orb glow override must remain scoped to target selection");
assert(css.includes('.spx-blackcat-event.success:before'),"the main-exhibit event must use its dimmed vault scene");
assert(css.includes('scale(.94)!important'),"target gallery cards must be slightly reduced without changing their canonical internals");
assert(css.includes('.spx-blackcat-portal-card-reason'),"gem candidate reasons must have a dedicated readable treatment");
assert(css.includes('@keyframes bcGemChosenCard'),"gem-offered picks must receive a dedicated neon selection flare");

console.log("Black Cat integration regression: OK");
