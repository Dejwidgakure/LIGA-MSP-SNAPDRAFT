(function(){
    "use strict";

    const TOOLTIP_ID="mspCardTooltip";
    // Tooltip ma być świadomą inspekcją karty, nie reakcją na samo przejazdowe
    // muśnięcie kursorem podczas wybierania kart.
    const SHOW_DELAY=1100;
    const FOCUS_DELAY=260;
    const HIDE_DELAY=170;
    const MAX_VISIBLE_TIME=7000;
    const VIEWPORT_GAP=12;
    const TARGET_GAP=14;
    const MIN_USEFUL_BELOW_SPACE=150;
    const OPTIONS={
        backgroundImage:"draft-assets/cosmic_tlo.png",
        collectionUrlTemplate:"",
        collectionLabel:"Sprawdź kartę w Kolekcji Kart Wszechświata",
        ...(window.MSP_CARD_TOOLTIP_OPTIONS || {})
    };

    let tooltip=null;
    let activeTarget=null;
    let activeCard=null;
    let pinned=false;
    let dragState=null;
    let showTimer=0;
    let hideTimer=0;
    let lifeTimer=0;
    let cardIndex=new Map();
    let tagIndex=new Map();
    let cardNamesByLength=[];

    function normalize(value){
        return String(value ?? "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g,"")
            .trim()
            .toLocaleLowerCase("pl");
    }

    function escapeHtml(value){
        return String(value ?? "").replace(/[&<>"']/g,char=>({
            "&":"&amp;",
            "<":"&lt;",
            ">":"&gt;",
            '"':"&quot;",
            "'":"&#039;"
        }[char]));
    }

    function readCardDatabase(){
        try{
            return Array.isArray(cardDatabase) ? cardDatabase : [];
        }catch(error){
            return [];
        }
    }

    function readCategories(){
        try{
            if(typeof TAG_CATEGORIES!=="undefined" && TAG_CATEGORIES && typeof TAG_CATEGORIES==="object"){
                return TAG_CATEGORIES;
            }
        }catch(error){
            // Brak metadanych kategorii — techniczne ID pozostają bez wymyślonych nazw.
        }

        const tags=readTags();
        return Object.fromEntries(
            Object.keys(tags).map(categoryId=>[
                categoryId,
                {name:categoryId}
            ])
        );
    }

    function readTags(){
        try{
            return TAGS && typeof TAGS==="object" ? TAGS : {};
        }catch(error){
            return {};
        }
    }

    function rebuildIndexes(){
        const cards=readCardDatabase();
        const tags=readTags();

        cardIndex=new Map();
        cards.forEach(card=>{
            if(card?.name) cardIndex.set(normalize(card.name),card);
        });

        cardNamesByLength=[...cardIndex.keys()].sort((a,b)=>b.length-a.length);
        tagIndex=new Map();
        Object.entries(tags).forEach(([categoryId,definitions])=>{
            (Array.isArray(definitions) ? definitions : []).forEach(definition=>{
                if(!definition?.id) return;
                tagIndex.set(definition.id,{
                    ...definition,
                    categoryId
                });
            });
        });
    }

    function createTooltip(){
        if(tooltip) return tooltip;

        tooltip=document.createElement("aside");
        tooltip.id=TOOLTIP_ID;
        tooltip.className="msp-card-tooltip";
        tooltip.setAttribute("role","tooltip");
        tooltip.setAttribute("aria-hidden","true");
        tooltip.innerHTML=`
            <div class="msp-card-tooltip__shell">
                <div class="msp-card-tooltip__toolbar">
                    <div class="msp-card-tooltip__eyebrow"><span aria-hidden="true">✦</span>Dane karty<span aria-hidden="true">✦</span></div>
                    <div class="msp-card-tooltip__actions">
                        <button
                            class="msp-card-tooltip__pin"
                            type="button"
                            title="Przypnij tooltip"
                            aria-label="Przypnij tooltip"
                            aria-pressed="false"
                        >⌖</button>
                        <button
                            class="msp-card-tooltip__close"
                            type="button"
                            title="Zamknij przypięty tooltip"
                            aria-label="Zamknij tooltip"
                        >×</button>
                    </div>
                </div>
                <div class="msp-card-tooltip__content"></div>
                <a class="msp-card-tooltip__collection-link" href=""></a>
            </div>
        `;
        tooltip.style.setProperty(
            "--msp-ct-bg-image",
            `url("${String(OPTIONS.backgroundImage).replace(/["\\]/g,"\\$&")}")`
        );
        document.body.appendChild(tooltip);
        return tooltip;
    }

    function readPackCard(index){
        try{
            return Array.isArray(currentPack) ? currentPack[index] : null;
        }catch(error){
            return null;
        }
    }

    function readDeckCard(playerIndex,cardIndex){
        try{
            return Array.isArray(decks?.[playerIndex]) ? decks[playerIndex][cardIndex] : null;
        }catch(error){
            return null;
        }
    }

    function findCardNameInText(text){
        const normalizedText=normalize(text);
        if(!normalizedText) return "";

        for(const normalizedName of cardNamesByLength){
            if(normalizedText===normalizedName) return cardIndex.get(normalizedName)?.name || "";
            if(
                normalizedText.startsWith(normalizedName+" ") ||
                normalizedText.startsWith(normalizedName+"(") ||
                normalizedText.includes(" "+normalizedName+" ") ||
                normalizedText.includes(">"+normalizedName+"<")
            ){
                return cardIndex.get(normalizedName)?.name || "";
            }
        }
        return "";
    }

    function resolveCard(target){
        if(!(target instanceof Element)) return null;

        const directName=
            target.dataset.cardName ||
            target.getAttribute("data-card-name") ||
            target.dataset.name;
        if(directName){
            return cardIndex.get(normalize(directName)) || null;
        }

        if(target.dataset.packIndex!==undefined){
            const packCard=readPackCard(Number(target.dataset.packIndex));
            if(packCard && !packCard.joker && packCard.name) return packCard;
        }

        if(target.dataset.playerIndex!==undefined && target.dataset.cardIndex!==undefined){
            const deckCard=readDeckCard(
                Number(target.dataset.playerIndex),
                Number(target.dataset.cardIndex)
            );
            if(deckCard?.name) return deckCard;
        }

        const matchedName=findCardNameInText(target.textContent);
        return matchedName ? cardIndex.get(normalize(matchedName)) || null : null;
    }

    function findCardTarget(start){
        let element=start instanceof Element ? start : start?.parentElement;
        let depth=0;

        while(element && element!==document.body && depth<7){
            const hasDirectData=Boolean(
                element.dataset?.cardName ||
                element.hasAttribute?.("data-card-name") ||
                element.dataset?.name ||
                element.dataset?.packIndex!==undefined ||
                (
                    element.dataset?.playerIndex!==undefined &&
                    element.dataset?.cardIndex!==undefined
                )
            );
            if(hasDirectData && resolveCard(element)){
                return element;
            }

            element=element.parentElement;
            depth++;
        }
        return null;
    }

    function getCategoryStyle(categoryId,category){
        return {
            color:category?.color || "#b9c5d8",
            glow:category?.glow || "rgba(185,197,216,.30)"
        };
    }

    function groupCardTags(card){
        const categories=readCategories();
        const groups=new Map();
        const unknown=[];

        (Array.isArray(card.tags) ? card.tags : []).forEach(tagId=>{
            const definition=tagIndex.get(tagId);
            if(!definition){
                unknown.push({
                    id:tagId,
                    name:tagId,
                    description:"Tag nie posiada jeszcze definicji w tags.js."
                });
                return;
            }
            if(!groups.has(definition.categoryId)) groups.set(definition.categoryId,[]);
            groups.get(definition.categoryId).push(definition);
        });

        const ordered=Object.keys(categories)
            .filter(categoryId=>groups.has(categoryId))
            .map(categoryId=>({
                categoryId,
                category:categories[categoryId],
                tags:groups.get(categoryId)
            }));

        if(unknown.length){
            ordered.push({
                categoryId:"unknown",
                category:{name:"Nieprzypisane"},
                tags:unknown
            });
        }
        return ordered;
    }

    function renderGroup(group){
        const style=getCategoryStyle(group.categoryId,group.category);
        const chips=group.tags.map(tag=>`
            <span class="msp-card-tooltip__chip">${escapeHtml(tag.name)}</span>
        `).join("");

        return `
            <section
                class="msp-card-tooltip__group msp-card-tooltip__group--${escapeHtml(group.categoryId)}"
                style="--msp-tag-color:${escapeHtml(style.color)};--msp-tag-glow:${escapeHtml(style.glow)}"
            >
                <h3 class="msp-card-tooltip__group-title">${escapeHtml(group.category?.name || group.categoryId)}</h3>
                <div class="msp-card-tooltip__chips">${chips}</div>
            </section>
        `;
    }

    function renderCard(card){
        const groups=groupCardTags(card);
        const cost=Number.isFinite(Number(card.cost)) ? card.cost : "—";
        const power=Number.isFinite(Number(card.power)) ? card.power : "—";
        const root=createTooltip();
        const content=root.querySelector(".msp-card-tooltip__content");

        content.innerHTML=`
            <div class="msp-card-tooltip__summary">
                <h2 class="msp-card-tooltip__card-name">${escapeHtml(card.name)}</h2>
                <div class="msp-card-tooltip__stats">
                    <div class="msp-card-tooltip__stat msp-card-tooltip__stat--cost">
                        <span class="msp-card-tooltip__stat-label">Koszt</span>
                        <strong class="msp-card-tooltip__stat-orb">${escapeHtml(cost)}</strong>
                    </div>
                    <div class="msp-card-tooltip__stat msp-card-tooltip__stat--power">
                        <span class="msp-card-tooltip__stat-label">Siła</span>
                        <strong class="msp-card-tooltip__stat-orb">${escapeHtml(power)}</strong>
                    </div>
                </div>
            </div>
            <div class="msp-card-tooltip__groups">
                ${groups.length
                    ? groups.map(renderGroup).join("")
                    : '<div class="msp-card-tooltip__empty">Ta karta nie ma jeszcze przypisanych tagów.</div>'
                }
            </div>
        `;
        const collectionLink=root.querySelector(".msp-card-tooltip__collection-link");
        if(OPTIONS.collectionUrlTemplate){
            collectionLink.href=String(OPTIONS.collectionUrlTemplate)
                .replace("{card}",encodeURIComponent(card.name));
            collectionLink.textContent=OPTIONS.collectionLabel;
            collectionLink.hidden=false;
        }else{
            collectionLink.hidden=true;
            collectionLink.removeAttribute("href");
        }
        activeCard=card;
        tooltip.setAttribute("aria-label",`Informacje o karcie ${card.name}`);
    }

    function positionTooltip(target){
        if(!tooltip || !target?.isConnected) return;

        const targetRect=target.getBoundingClientRect();
        tooltip.style.removeProperty("--msp-ct-max-height");
        const tooltipRect=tooltip.getBoundingClientRect();
        // Tooltip jest kotwiczony pod kartą. Nad kartę trafia wyłącznie wtedy,
        // gdy pod nią nie ma nawet minimalnego, użytecznego miejsca.
        let left=targetRect.left+(targetRect.width-tooltipRect.width)/2;
        const spaceBelow=window.innerHeight-targetRect.bottom-TARGET_GAP-VIEWPORT_GAP;
        const spaceAbove=targetRect.top-TARGET_GAP-VIEWPORT_GAP;
        const placeBelow=spaceBelow>=MIN_USEFUL_BELOW_SPACE || spaceBelow>=spaceAbove;
        const availableHeight=Math.max(116,placeBelow?spaceBelow:spaceAbove);
        let top=placeBelow
            ? targetRect.bottom+TARGET_GAP
            : targetRect.top-Math.min(tooltipRect.height,availableHeight)-TARGET_GAP;

        left=Math.min(
            Math.max(VIEWPORT_GAP,left),
            window.innerWidth-tooltipRect.width-VIEWPORT_GAP
        );

        top=Math.max(VIEWPORT_GAP,top);

        tooltip.classList.toggle("msp-card-tooltip--above",!placeBelow);
        tooltip.style.setProperty("--msp-ct-max-height",`${Math.floor(availableHeight)}px`);
        tooltip.style.setProperty("--msp-ct-x",`${Math.round(left)}px`);
        tooltip.style.setProperty("--msp-ct-y",`${Math.round(top)}px`);
    }

    function clearTimers(){
        window.clearTimeout(showTimer);
        window.clearTimeout(hideTimer);
        window.clearTimeout(lifeTimer);
        showTimer=hideTimer=lifeTimer=0;
    }

    function setPinned(nextPinned){
        pinned=Boolean(nextPinned);
        if(!tooltip) return;

        tooltip.classList.toggle("msp-card-tooltip--pinned",pinned);
        const pinButton=tooltip.querySelector(".msp-card-tooltip__pin");
        if(pinButton){
            pinButton.setAttribute("aria-pressed",String(pinned));
            pinButton.title=pinned ? "Odepnij tooltip" : "Przypnij tooltip";
            pinButton.setAttribute("aria-label",pinButton.title);
        }
        window.clearTimeout(lifeTimer);
        lifeTimer=0;

        if(!pinned && tooltip.classList.contains("msp-card-tooltip--visible")){
            lifeTimer=window.setTimeout(()=>hideTooltip(true,true),MAX_VISIBLE_TIME);
        }
    }

    function hideTooltip(immediate=false,force=false){
        if(pinned && !force) return;
        window.clearTimeout(showTimer);
        window.clearTimeout(lifeTimer);
        showTimer=lifeTimer=0;

        const hide=()=>{
            if(tooltip){
                tooltip.classList.remove("msp-card-tooltip--visible");
                tooltip.setAttribute("aria-hidden","true");
            }
            setPinned(false);
            if(activeTarget){
                activeTarget.removeAttribute("aria-describedby");
            }
            activeTarget=null;
            activeCard=null;
        };

        window.clearTimeout(hideTimer);
        if(immediate) hide();
        else hideTimer=window.setTimeout(hide,HIDE_DELAY);
    }

    function scheduleTooltip(target,delay=SHOW_DELAY){
        if(pinned) return;
        if(target===activeTarget && tooltip?.classList.contains("msp-card-tooltip--visible")) return;

        clearTimers();
        if(activeTarget && activeTarget!==target){
            activeTarget.removeAttribute("aria-describedby");
        }
        activeTarget=target;

        showTimer=window.setTimeout(()=>{
            const card=resolveCard(target);
            if(!card || !target.isConnected || activeTarget!==target) return;

            renderCard(card);
            target.setAttribute("aria-describedby",TOOLTIP_ID);
            tooltip.classList.add("msp-card-tooltip--visible");
            tooltip.setAttribute("aria-hidden","false");
            positionTooltip(target);
            requestAnimationFrame(()=>positionTooltip(target));
            lifeTimer=window.setTimeout(()=>hideTooltip(true,true),MAX_VISIBLE_TIME);
        },delay);
    }

    function handlePointerOver(event){
        const target=findCardTarget(event.target);
        if(!target) return;
        if(target.contains(event.relatedTarget)) return;
        scheduleTooltip(target);
    }

    function handlePointerOut(event){
        if(!activeTarget) return;
        if(activeTarget.contains(event.relatedTarget)) return;
        if(tooltip?.contains(event.relatedTarget)) return;
        hideTooltip();
    }

    function handleFocusIn(event){
        const target=findCardTarget(event.target);
        if(target) scheduleTooltip(target,FOCUS_DELAY);
    }

    function handleFocusOut(event){
        if(
            activeTarget &&
            !activeTarget.contains(event.relatedTarget) &&
            !tooltip?.contains(event.relatedTarget)
        ){
            hideTooltip();
        }
    }

    function beginDrag(event){
        if(!pinned || event.button!==0 || event.target.closest("button,a")) return;

        const rect=tooltip.getBoundingClientRect();
        dragState={
            pointerId:event.pointerId,
            offsetX:event.clientX-rect.left,
            offsetY:event.clientY-rect.top
        };
        tooltip.classList.add("msp-card-tooltip--dragging");
        event.currentTarget.setPointerCapture?.(event.pointerId);
        event.preventDefault();
    }

    function moveDrag(event){
        if(!dragState || event.pointerId!==dragState.pointerId) return;

        const rect=tooltip.getBoundingClientRect();
        const left=Math.min(
            Math.max(VIEWPORT_GAP,event.clientX-dragState.offsetX),
            Math.max(VIEWPORT_GAP,window.innerWidth-rect.width-VIEWPORT_GAP)
        );
        const top=Math.min(
            Math.max(VIEWPORT_GAP,event.clientY-dragState.offsetY),
            Math.max(VIEWPORT_GAP,window.innerHeight-rect.height-VIEWPORT_GAP)
        );
        tooltip.style.setProperty("--msp-ct-x",`${Math.round(left)}px`);
        tooltip.style.setProperty("--msp-ct-y",`${Math.round(top)}px`);
    }

    function endDrag(event){
        if(!dragState || event.pointerId!==dragState.pointerId) return;
        dragState=null;
        tooltip?.classList.remove("msp-card-tooltip--dragging");
    }

    function initialize(){
        rebuildIndexes();
        createTooltip();
        const toolbar=tooltip.querySelector(".msp-card-tooltip__toolbar");
        const pinButton=tooltip.querySelector(".msp-card-tooltip__pin");
        const closeButton=tooltip.querySelector(".msp-card-tooltip__close");

        pinButton?.addEventListener("click",event=>{
            event.stopPropagation();
            setPinned(!pinned);
        });
        closeButton?.addEventListener("click",event=>{
            event.stopPropagation();
            hideTooltip(true,true);
        });
        toolbar?.addEventListener("pointerdown",beginDrag);
        toolbar?.addEventListener("pointermove",moveDrag);
        toolbar?.addEventListener("pointerup",endDrag);
        toolbar?.addEventListener("pointercancel",endDrag);
        tooltip.addEventListener("pointerenter",()=>{
            window.clearTimeout(hideTimer);
            hideTimer=0;
        });
        tooltip.addEventListener("pointerleave",()=>hideTooltip());

        document.addEventListener("pointerover",handlePointerOver,true);
        document.addEventListener("pointerout",handlePointerOut,true);
        document.addEventListener("focusin",handleFocusIn,true);
        document.addEventListener("focusout",handleFocusOut,true);
        document.addEventListener("click",event=>{
            if(tooltip?.contains(event.target)) return;
            hideTooltip(true);
        },true);
        document.addEventListener("pointerdown",event=>{
            if(tooltip?.contains(event.target)) return;
            // Wciśnięcie karty zawsze ma pierwszeństwo przed inspekcją.
            hideTooltip(true,true);
        },true);
        document.addEventListener("keydown",event=>{
            if(event.key==="Escape") hideTooltip(true,true);
        });
        window.addEventListener("scroll",()=>{
            if(pinned) return;
            if(activeTarget && activeTarget.contains(document.activeElement)){
                if(tooltip?.classList.contains("msp-card-tooltip--visible")){
                    requestAnimationFrame(()=>positionTooltip(activeTarget));
                }
                return;
            }
            hideTooltip(true,true);
        },true);
        window.addEventListener("resize",()=>{
            if(pinned && tooltip){
                const rect=tooltip.getBoundingClientRect();
                const left=Math.min(Math.max(VIEWPORT_GAP,rect.left),window.innerWidth-rect.width-VIEWPORT_GAP);
                const top=Math.min(Math.max(VIEWPORT_GAP,rect.top),window.innerHeight-rect.height-VIEWPORT_GAP);
                tooltip.style.setProperty("--msp-ct-x",`${Math.round(left)}px`);
                tooltip.style.setProperty("--msp-ct-y",`${Math.round(top)}px`);
                return;
            }
            hideTooltip(true,true);
        });

        window.CardTooltips={
            refresh:rebuildIndexes,
            hide:()=>hideTooltip(true,true),
            pin:()=>setPinned(true),
            unpin:()=>setPinned(false),
            mark(element,cardOrName){
                const name=typeof cardOrName==="string" ? cardOrName : cardOrName?.name;
                if(element && name) element.dataset.cardName=name;
                return element;
            },
            timing:Object.freeze({hoverDelay:SHOW_DELAY,focusDelay:FOCUS_DELAY,hideDelay:HIDE_DELAY})
        };
    }

    if(document.readyState==="loading"){
        document.addEventListener("DOMContentLoaded",initialize,{once:true});
    }else{
        initialize();
    }
})();
