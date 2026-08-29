const fs=require("fs");
const assert=require("assert");
const path=require("path");
const root=__dirname;
const read=f=>fs.readFileSync(path.join(root,f),"utf8");
const bridge=read("superpowers-galactic-current-bridge.js");
const thor=read("superpowers-thor.js");
const iron=read("superpowers-ironfist-ui.js");
const dino=read("superpowers-devildino.js");
const gambit=read("superpowers-gambit.js");
const ui=read("superpowers-ui.js");
const html=read("snap-draft.html");

for(const id of ["rocket","iron_fist","thor","devil_dinosaur","gambit"]){
  const block=bridge.match(new RegExp(id+"\\s*:\\s*\\{[\\s\\S]*?\\n\\s*\\},","m"));
  assert.ok(block,`mode block exists for ${id}`);
  assert.match(block[0],/modeText\s*:/,`${id} has Galactic Current player wording`);
}
assert.ok(!/rollback|realn(?:a|e|ą|ych) instanc|atomowo/.test(bridge.match(/const POLICIES[\s\S]*?function modeEnabled/)[0]),"player compatibility notes avoid technical transaction wording");
assert.match(thor,/Naznacz dwie karty z aktualnego nurtu/);
assert.match(iron,/WRÓĆ DO NURTU/);
assert.match(dino,/WYPLUCIE DO NURTU/);
assert.match(gambit,/STRZAŁ W NURT/);
assert.match(gambit,/BRAK KART W DOPŁYWIE/);
assert.match(ui,/W aktualnym nurcie nie ma dostępnej karty do zaminowania/);
assert.match(html,/Bomby Rocketa są już uzbrojone w aktualnym nurcie/);
assert.match(html,/superpowers-galactic-current-bridge\.js\?v=3\.1\.0-gc-wording/);
console.log("PASS Galactic Current Superpowers Wording");
