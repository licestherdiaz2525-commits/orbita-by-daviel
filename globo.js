import {createEarthRenderer} from './tierra-render.js';

const $ = id => document.getElementById(id);
const english = new URLSearchParams(location.search).get('lang') === 'en';
const t = (es,en) => english ? en : es;
const clamp = (x,min,max) => Math.max(min,Math.min(max,x));
const longitude = value => ((value+180)%360+360)%360-180;
const normalize = value => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();

if (english) {
    document.documentElement.lang='en';
    document.title='Earth in 3D · Órbita by Daviel';
    document.querySelector('meta[name="description"]').content='Explore Earth in 3D. Find continents and oceans, rotate the globe, and zoom in on the surface.';
    document.querySelectorAll('[data-en]').forEach(el=>el.textContent=el.dataset.en);
    document.querySelectorAll('[data-en-label]').forEach(el=>{
        el.setAttribute('aria-label',el.dataset.enLabel);
        if(el.hasAttribute('title')) el.title=el.dataset.enLabel;
    });
    document.querySelector('[data-home]').href='en.html';
    document.querySelector('[data-atlas]').href='en.html#atlas';
    document.querySelector('[data-storm]').href='atmosfera.html?lang=en';
    $('region-query').placeholder='Continent, ocean or region';
}
$(english?'in-en':'in-es').setAttribute('aria-current','page');

// These are camera positions for broad geographical regions.
const regions = [
    ['north-atlantic','Atlántico Norte','North Atlantic',22,-48,1],
    ['caribbean','Mar Caribe','Caribbean Sea',16,-73,1.78],
    ['africa','África','Africa',4,19,1.22],
    ['pacific','Océano Pacífico','Pacific Ocean',3,-154,1.12],
    ['america-n','América del Norte','North America',44,-100,1.32],
    ['america-s','América del Sur','South America',-15,-60,1.34],
    ['europe','Europa','Europe',51,16,1.46],
    ['asia','Asia','Asia',38,89,1.2],
    ['oceania','Oceanía','Oceania',-21,149,1.3],
    ['antarctica','Antártida','Antarctica',-82,7,1.28],
    ['arctic','Océano Ártico','Arctic Ocean',81,0,1.28],
    ['indian','Océano Índico','Indian Ocean',-17,78,1.24],
    ['south-atlantic','Atlántico Sur','South Atlantic',-28,-20,1.22],
    ['southern','Océano Austral','Southern Ocean',-62,40,1.22],
    ['med','Mar Mediterráneo','Mediterranean Sea',35,18,1.85]
].map(([id,es,en,lat,lon,zoom])=>({id,es,en,lat,lon,zoom,name:t(es,en),search:normalize(es+' '+en)}));
const byId = new Map(regions.map(region=>[region.id,region]));
const start = regions[0];
const surface = $('surface'), viewer = $('viewer');
const state = {latitude:start.lat,longitude:start.lon,zoom:1,panX:0,panY:0,grid:false,interacting:false};
const pointers = new Map();
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let selected = start, spinning = false, frame = 0, previous = null, flight = null;
let pointerMode = 'orbit', two = null, drawEarth;
const coord = (v,pos,neg) => `${Math.round(Math.abs(v))}°${v<0?neg:pos}`;

function showView() {
    const name = selected ? selected.name : t('Vista libre','Free view');
    if ($('region-name').textContent!==name) $('region-name').textContent=name;
    const angles = coord(state.latitude,'N','S')+' · '+coord(state.longitude,'E',t('O','W'));
    if ($('orientation').textContent!==angles) $('orientation').textContent=angles;
    const zoom = Number(state.zoom.toFixed(2))+'×';
    if ($('zoom-value').value!==zoom) $('zoom-value').value=zoom;
    $('zoom-in').disabled=state.zoom>=2.599;
    $('zoom-out').disabled=state.zoom<=.701;
}
function statusControls() {
    $('spin').setAttribute('aria-pressed',String(spinning));
    $('graticule').setAttribute('aria-pressed',String(state.grid));
    document.querySelectorAll('[data-region]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.region===selected?.id)));
}
function requestDraw() {
    if (!frame && !document.hidden) frame=requestAnimationFrame(render);
}
function render(now) {
    frame=0;
    if (document.hidden) return;
    if (flight) {
        const part=clamp((now-flight.start)/flight.duration,0,1);
        const eased=part*part*(3-2*part);
        for (const key of ['latitude','zoom','panX','panY']) state[key]=flight.from[key]+(flight.to[key]-flight.from[key])*eased;
        state.longitude=longitude(flight.from.longitude+flight.lonDelta*eased);
        if (part>=1) flight=null;
    } else if (spinning && previous!==null) {
        state.longitude=longitude(state.longitude+Math.min(now-previous,100)*.005);
    }
    previous=now;
    state.interacting=Boolean(pointers.size||flight||spinning);
    showView();
    if (drawEarth) {
        const panelOffset=matchMedia('(min-width: 761px)').matches ? clamp(surface.clientWidth*.10,102,152) : 0;
        drawEarth({...state,panX:state.panX+panelOffset});
    }
    if(flight||spinning) requestDraw();
}
function stopMovement(clearRegion) {
    flight=null;
    spinning=false;
    previous=null;
    if(clearRegion) selected=null;
    statusControls();
}
function go(region,instant=false) {
    stopMovement(false);
    selected=region;
    const target={latitude:region.lat,longitude:region.lon,zoom:region.zoom,panX:0,panY:0};
    if(instant||reduced.matches) Object.assign(state,target);
    else flight={from:{...state},to:target,lonDelta:longitude(target.longitude-state.longitude),start:performance.now(),duration:680};
    statusControls();requestDraw();
}
function adjustZoom(factor) {
    flight=null;
    state.zoom=clamp(state.zoom*factor,.70,2.6);
    requestDraw();
}
function movePan(dx,dy) {
    const maxX=surface.clientWidth*.32, maxY=surface.clientHeight*.32;
    state.panX=clamp(state.panX+dx,-maxX,maxX);
    state.panY=clamp(state.panY+dy,-maxY,maxY);
}
function reset() {
    go(start,true);
    state.grid=false;
    $('region-query').value='';
    $('search-feedback').hidden=true;
    closeSearch();
    statusControls();requestDraw();
}
$('zoom-in').onclick=()=>adjustZoom(1.22);
$('zoom-out').onclick=()=>adjustZoom(1/1.22);
$('reset').onclick=reset;
$('graticule').onclick=()=>{state.grid=!state.grid;statusControls();requestDraw();};
$('spin').onclick=()=>{
    flight=null;
    spinning=!spinning;
    if (spinning) selected=null;
    previous=null;statusControls();requestDraw();
};

const input=$('region-query'), menu=$('matches'), feedback=$('search-feedback');
let matches=[], highlight=-1;
function closeSearch() {
    menu.hidden=true;highlight=-1;input.setAttribute('aria-expanded','false');
    input.removeAttribute('aria-activedescendant');
}
function selectRegion(region) {
    input.value=region.name;
    feedback.hidden=true;
    closeSearch();
    go(region);
}
function lookup() {
    const terms=normalize(input.value).split(/\s+/).filter(Boolean);
    return regions.filter(region=>terms.every(term=>region.search.includes(term)));
}
function markOption(n) {
    highlight=n;
    [...menu.children].forEach((li,i)=>li.setAttribute('aria-selected',String(i===n)));
    if(n<0) input.removeAttribute('aria-activedescendant');
    else {
        const option=menu.children[n];
        input.setAttribute('aria-activedescendant',option.id);
        if(option.offsetTop<menu.scrollTop) menu.scrollTop=option.offsetTop;
        else if(option.offsetTop+option.offsetHeight>menu.scrollTop+menu.clientHeight) menu.scrollTop=option.offsetTop+option.offsetHeight-menu.clientHeight;
    }
}
function showSearch() {
    matches=lookup();
    menu.replaceChildren();
    matches.forEach(region=>{
        const item=document.createElement('li');
        item.id='place-'+region.id;item.setAttribute('role','option');
        item.textContent=region.name;
        item.onpointerdown=e=>e.preventDefault();
        item.onclick=()=>selectRegion(region);
        menu.append(item);
    });
    markOption(-1);
    menu.hidden=!matches.length;
    input.setAttribute('aria-expanded',String(Boolean(matches.length)));
    feedback.hidden=Boolean(matches.length);
    if(!matches.length) feedback.textContent=t('No se encontró esa región. Prueba con un continente u océano.','Region not found. Try a continent or an ocean.');
}
input.oninput=showSearch;
input.onfocus=showSearch;
input.onkeydown=event=>{
    if(event.key==='Escape') {closeSearch();return;}
    if(event.key==='ArrowDown'||event.key==='ArrowUp') {
        event.preventDefault();
        if(menu.hidden) showSearch();
        if(!matches.length) return;
        const next=highlight<0?(event.key==='ArrowDown'?0:matches.length-1):(highlight+(event.key==='ArrowDown'?1:-1)+matches.length)%matches.length;
        markOption(next);
    }
};
$('region-search').onsubmit=event=>{
    event.preventDefault();
    const results=lookup();
    if(!results.length||(!input.value.trim()&&highlight<0)) {showSearch();return;}
    selectRegion((highlight>=0&&!menu.hidden?matches[highlight]:null)||results[0]);
};
$('region-search').addEventListener('focusout',event=>{if(!$('region-search').contains(event.relatedTarget)) closeSearch();});
document.addEventListener('pointerdown',event=>{if(!$('region-search').contains(event.target)) closeSearch();});
document.querySelectorAll('[data-region]').forEach(b=>b.onclick=()=>selectRegion(byId.get(b.dataset.region)));

function pair() {
    const [a,b]=[...pointers.values()];
    return {x:(a.x+b.x)/2,y:(a.y+b.y)/2,dist:Math.hypot(a.x-b.x,a.y-b.y)};
}
surface.oncontextmenu=e=>e.preventDefault();
surface.onpointerdown=e=>{
    if (e.button!==0 && e.button!==2) return;
    if(pointers.size>1)return;
    surface.setPointerCapture(e.pointerId);
    surface.focus({preventScroll:true});
    pointerMode=e.button===2||e.shiftKey?'pan':'orbit';
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    stopMovement(false);
    if(pointers.size===2) two=pair();
};
surface.onpointermove=e=>{
    const last=pointers.get(e.pointerId);if(!last) return;
    const dx=e.clientX-last.x,dy=e.clientY-last.y;
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(!dx&&!dy) return;
    if(selected){selected=null;statusControls();}
    if(pointers.size===2) {
        const next=pair();
        if(two && two.dist>3) {
            state.zoom=clamp(state.zoom*next.dist/two.dist,.7,2.6);
            movePan(next.x-two.x,next.y-two.y);
        }
        two=next;
    } else if(pointerMode==='pan'||e.shiftKey) movePan(dx,dy);
    else {
        const sensitivity=95/(Math.max(100,Math.min(surface.clientWidth,surface.clientHeight)*.44)*state.zoom);
        state.longitude=longitude(state.longitude-dx*sensitivity);
        state.latitude=clamp(state.latitude+dy*sensitivity,-89.5,89.5);
    }
    requestDraw();
};
function endPointer(e) {
    if(!pointers.has(e.pointerId))return;
    pointers.delete(e.pointerId);two=null;
    if(!pointers.size) requestDraw();
}
surface.onpointerup=surface.onpointercancel=surface.onlostpointercapture=endPointer;
surface.addEventListener('wheel',e=>{
    e.preventDefault();
    const normalDelta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?surface.clientHeight:1);
    adjustZoom(Math.exp(-clamp(normalDelta,-100,100)*.002));
},{passive:false});
surface.onkeydown=e=>{
    if(e.key==='Home') reset();
    else if(e.key==='+'||e.key==='=') adjustZoom(1.22);
    else if(e.key==='-') adjustZoom(1/1.22);
    else if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) {
        stopMovement(true);
        const step=8/state.zoom;
        if(e.key==='ArrowLeft') state.longitude=longitude(state.longitude-step);
        if(e.key==='ArrowRight') state.longitude=longitude(state.longitude+step);
        if(e.key==='ArrowUp') state.latitude=clamp(state.latitude+step,-89.5,89.5);
        if(e.key==='ArrowDown') state.latitude=clamp(state.latitude-step,-89.5,89.5);
        requestDraw();
    } else return;
    e.preventDefault();
};

function fullState() {
    const open=document.fullscreenElement===viewer||viewer.classList.contains('expanded');
    const label=open?t('Salir de pantalla completa','Exit full screen'):t('Pantalla completa','Full screen');
    $('expand').setAttribute('aria-label',label);$('expand').title=label;
    $('expand').setAttribute('aria-pressed',String(open));
    requestDraw();
}
$('expand').onclick=async()=>{
    if(document.fullscreenElement===viewer) {await document.exitFullscreen();return;}
    if(viewer.classList.contains('expanded')) {viewer.classList.remove('expanded');fullState();return;}
    if(document.fullscreenEnabled && viewer.requestFullscreen) {
        try{await viewer.requestFullscreen();return;}catch{}
    }
    viewer.classList.add('expanded');fullState();
};
document.addEventListener('fullscreenchange',fullState);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&viewer.classList.contains('expanded')){viewer.classList.remove('expanded');fullState();}});
document.addEventListener('visibilitychange',()=>{previous=null;if(!document.hidden)requestDraw();});
new ResizeObserver(()=>{movePan(0,0);requestDraw();}).observe(surface);
drawEarth=createEarthRenderer(surface,()=>{$('loading').hidden=true;requestDraw();},()=>{
    $('loading').hidden=false;
    $('loading').textContent=t('La imagen de la Tierra no cargó. Actualiza la página para reintentar.','Earth imagery did not load. Refresh the page to retry.');
});
statusControls();fullState();requestDraw();
