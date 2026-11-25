import {buildRenderer} from './trinity-render.js';

const DURATION=44;
const SHOTS=[[0,.31,1],[.74,.095,1.10],[-.55,.94,.83]];
const limit=(value,min,max)=>Math.min(max,Math.max(min,value));
const clock=time=>'00:'+String(Math.floor(time)).padStart(2,'0');

function makeFilmRenderer(canvas,onReady,onError){
    const context=canvas.getContext('2d');
    const sheets=new Map();
    let needed='';
    // The three intervals mirror the filmstrip bake. Closer frames cover the first glow.
    const framePosition=time=>time<=10 ? time*14/10 : time<=18 ? 14+(time-10)*18/8 : 32+(time-18)*27/26;
    return state=>{
        const key=state.shot+'-'+Number(state.relief);
        needed=key;
        if(!sheets.has(key)){
            const image=new Image();
            if(sheets.size>=2)sheets.delete(sheets.keys().next().value);
            sheets.set(key,image);
            image.onload=()=>{if(needed===key) onReady();};
            image.onerror=()=>{if(needed===key)onError();};
            image.src='trinity-tomas-'+key+'.webp';
        }
        const img=sheets.get(key);
        if(!img.complete||!img.naturalWidth) return false;
        const w=Math.max(1,canvas.clientWidth),h=Math.max(1,canvas.clientHeight);
        if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
        const position=framePosition(state.seconds);
        const displayScale=Math.max(w/544,h/350)*Math.max(1,state.zoom/SHOTS[state.shot][2]);
        const dw=544*displayScale,dh=350*displayScale;
        const drawFrame=index=>context.drawImage(img,(index%7)*544,Math.floor(index/7)*350,544,350,(w-dw)/2,(h-dh)/2,dw,dh);
        drawFrame(Math.floor(position));
        context.globalAlpha=position-Math.floor(position);
        drawFrame(Math.min(59,Math.floor(position)+1));
        context.globalAlpha=1;
        return true;
    };
}

export function mountTrinity(root,english,syncSound=()=>{}){
    const t=(spanish,eng)=>english?eng:spanish;
    const phases=[
        {name:t('Desde el espacio','From space'),image:'orbita',start:0,shot:0,
         caption:t('El viaje comienza sobre América y desciende hacia la Jornada del Muerto, en Nuevo México. Allí se realizó la prueba Trinity el 16 de julio de 1945.','The journey begins above the Americas and descends into the Jornada del Muerto desert in New Mexico. The Trinity test took place here on July 16, 1945.')},
        {name:t('Resplandor','First light'),image:'luz',start:10,shot:13,
         caption:t('La luz aparece junto al suelo y tiñe el desierto. En la escena el brillo está atenuado para que se distinga el contorno de la nube.','Light appears near the ground and illuminates the desert. The glow is softened in the scene so you can see the cloud’s outline.')},
        {name:t('Columna ascendente','Rising column'),image:'columna',start:17,shot:22,
         caption:t('El gas caliente asciende y arrastra aire y polvo. Fíjate en la columna que se forma entre el suelo y la parte superior de la nube.','Hot gas rises and draws in air and dust. Look at the narrow region beneath the cloud, where a column extends from the base toward the top.')},
        {name:t('Nube en expansión','Spreading cloud'),image:'nube',start:30,shot:39,
         caption:t('La parte superior se ensancha y sus bordes se enrollan al mezclarse con el aire. Prueba la vista de perfil para distinguir los pliegues en sombra.','The cloud spreads at the top and its edges curl as they mix with the surrounding air. Try the side view to see the folds in shadow.')}
    ];
    const layerNames=[t('Paisaje','Landscape'),t('Relieve','Relief')];
    const shotNames=[t('General','Wide'),t('Perfil','Side'),t('Aérea','Aerial')];
    const photoLabel=t('Fotografía de 1945','1945 photograph');
    const restartLabel=t('Volver al inicio','Return to start');
    const timeLabel=t('Tiempo de reproducción','Playback position');
    const fullLabel=t('Ampliar la vista','Expand view');
    root.classList.add('trinity');
    root.innerHTML=`
        <div class="tr-grid">
          <div class="tr-player">
            <div class="tr-stage" role="group" tabindex="0" aria-label="${t('Vista tridimensional de Trinity','Three-dimensional view of Trinity')}">
              <canvas class="tr-gpu" role="img" aria-label="${t('Reconstrucción de la nube y el terreno','Reconstruction of the cloud and terrain')}"></canvas>
              <canvas class="tr-film" hidden aria-hidden="true"></canvas>
              <img class="tr-poster" src="trinity-orbita.webp" alt="">
              <img class="tr-photo" src="trinity-archivo.webp" alt="${t('Fotografía histórica en blanco y negro del resplandor de Trinity sobre el horizonte del desierto','Black-and-white archival photograph of the Trinity glow on the desert horizon')}" hidden>
              <div class="tr-top"><span class="tr-location">${t('Nuevo México, EE. UU.','New Mexico, USA')}</span>
                <button type="button" class="tr-icon tr-full" aria-label="${fullLabel}" title="${fullLabel}">⛶</button></div>
              <div class="tr-foot"><div><small class="tr-stage-label"></small><strong class="tr-stage-name"></strong></div>
                <button class="tr-return" type="button" hidden></button><div class="tr-zoom"><button class="tr-icon" type="button" data-zoom="-1" aria-label="${t('Alejar','Zoom out')}" title="${t('Alejar','Zoom out')}">−</button>
                  <button class="tr-icon" type="button" data-zoom="1" aria-label="${t('Acercar','Zoom in')}" title="${t('Acercar','Zoom in')}">+</button></div>
              </div>
            </div>
            <div class="tr-trans">
              <button type="button" class="tr-play"></button>
              <button type="button" class="tr-icon tr-reset" aria-label="${restartLabel}" title="${restartLabel}">↺</button>
              <input class="tr-seek" type="range" min="0" max="44" step=".05" value="0" aria-label="${timeLabel}">
              <span class="tr-time"></span>
              <select class="tr-speed" aria-label="${t('Velocidad de reproducción','Playback speed')}"><option value=".25">0.25×</option><option value=".5">0.5×</option><option value="1" selected>1×</option><option value="2">2×</option></select>
            </div>
            <p class="tr-description" role="status"></p>
          </div>
          <aside class="tr-tools">
            <h2>${t('Controles de vista','View controls')}</h2>
            <fieldset><legend>${t('Aspecto del terreno','Terrain style')}</legend><div class="tr-layers">
              ${layerNames.map((name,i)=>`<button type="button" data-layer="${i}"><i aria-hidden="true"></i><span>${name}</span></button>`).join('')}
            </div></fieldset>
            <fieldset><legend>${t('Cámara','Camera')}</legend><div class="tr-presets">
              ${shotNames.map((name,i)=>`<button type="button" data-camera="${i}">${name}</button>`).join('')}
            </div></fieldset>
            <small class="tr-hint"></small>
            <div class="tr-hist">
              <button type="button" class="tr-photo-button"><img src="trinity-archivo.webp" alt=""><span>${photoLabel}</span></button>
              <a href="https://www.nps.gov/mapr/learn/historyculture/trinity.htm" target="_blank" rel="noopener">${t('Fuente histórica · NPS','Historical source · NPS')} ↗</a>
            </div>
          </aside>
        </div>
        <section class="tr-sequence" aria-label="${t('Etapas del recorrido','Tour chapters')}"><h2>${t('Etapas del recorrido','Tour chapters')}</h2><div class="tr-chapters">
          ${phases.map((p,i)=>`<button type="button" data-phase="${i}"><img src="trinity-${p.image}.webp" alt=""><span><strong>${p.name}</strong><small>${clock(p.shot)}</small></span></button>`).join('')}
        </div></section>
        <small class="tr-notes">${t('Reconstrucción visual. El reloj indica la duración del recorrido. Fotografía histórica de Los Alamos National Laboratory, publicada por el National Park Service.','Visual reconstruction. The clock shows playback time. Archival photograph by Los Alamos National Laboratory, published by the National Park Service.')}</small>`;
    const el=selector=>root.querySelector(selector);
    const all=selector=>Array.from(root.querySelectorAll(selector));
    const player=el('.tr-player'),stage=el('.tr-stage'),seek=el('.tr-seek');
    const gpu=el('.tr-gpu'),film=el('.tr-film'),poster=el('.tr-poster'),photo=el('.tr-photo');
    const timeReadout=el('.tr-time'),play=el('.tr-play'),description=el('.tr-description');
    const phaseButtons=all('[data-phase]'),cameraButtons=all('[data-camera]'),layerButtons=all('[data-layer]');
    const zoomButtons=all('[data-zoom]'),photoButton=el('.tr-photo-button');
    const precisionHint=t('Arrastra para girar. Usa dos dedos o los botones para acercarte.','Drag to orbit. Pinch or use the buttons to zoom.');
    const state={seconds:0,shot:0,yaw:SHOTS[0][0],pitch:SHOTS[0][1],zoom:SHOTS[0][2],relief:false,quality:1};
    let active=false,visible=true,playing=false,photograph=false,freeCamera=false;
    let render=null,usingFilm=false,pending=0,previousTime=null,speed=1,lastDraw=0;
    let announcedPhase=-2,displayedSecond=-1,lastPlaying=null;
    const pointers=new Map();
    let pinchDistance=0,swipe=0;

    function requestDraw(){
        if(active&&visible&&!document.hidden&&!pending) pending=requestAnimationFrame(draw);
    }
    function announce(){
        syncSound(state.seconds-10,speed,playing && active && visible && !document.hidden && !photograph && Boolean(render));
        let phase=0;
        while(phase+1<phases.length&&state.seconds>=phases[phase+1].start)phase++;
        const current=photograph?-1:phase;
        if(announcedPhase!==current){
            announcedPhase=current;
            el('.tr-stage-label').textContent=photograph?t('Los Alamos National Laboratory','Los Alamos National Laboratory'):t('Recorrido','Tour')+' · '+(phase+1)+' / '+phases.length;
            el('.tr-stage-name').textContent=photograph?photoLabel:phases[phase].name;
            description.textContent=photograph?t('Imagen de la prueba del 16 de julio de 1945. Pulsa «Volver al visor» para retomar la animación en el mismo punto.','Image of the July 16, 1945 test. Choose “Back to viewer” to resume the animation at the same point.'):phases[phase].caption;
            phaseButtons.forEach((b,i)=>b.setAttribute('aria-pressed',i===current));
        }
        if(displayedSecond!==Math.floor(state.seconds)){
            displayedSecond=Math.floor(state.seconds);
            const value=clock(state.seconds)+' / '+clock(DURATION);
            timeReadout.textContent=value;
            seek.setAttribute('aria-valuetext',value);
        }
        seek.value=state.seconds;
        const label=playing?t('Pausar','Pause'):state.seconds>=DURATION?t('Repetir','Replay'):t('Reproducir','Play');
        if(lastPlaying!==label){lastPlaying=label;play.textContent=(playing?'Ⅱ  ':'▶  ')+label;}
    }
    function controls(){
        photo.hidden=!photograph;
        photoButton.setAttribute('aria-pressed',photograph);
        photoButton.lastElementChild.textContent=photograph?t('Volver al visor','Back to viewer'):photoLabel;
        el('.tr-zoom').hidden=photograph;
        el('.tr-return').hidden=!photograph;
        cameraButtons.forEach((button,i)=>button.setAttribute('aria-pressed',!freeCamera&&i===state.shot));
        layerButtons.forEach((button,i)=>button.setAttribute('aria-pressed',state.relief===Boolean(i)));
        const minZoom=usingFilm?SHOTS[state.shot][2]:.63;
        zoomButtons[0].disabled=state.zoom<=minZoom+.001;
        zoomButtons[1].disabled=state.zoom>=1.84;
        el('.tr-hint').textContent=usingFilm?t('Desliza sobre la escena o elige una de las tres cámaras.','Swipe across the scene or choose one of the three cameras.'):precisionHint;
        announce();
        requestDraw();
    }
    function draw(now){
        pending=0;
        if(!active||!visible||document.hidden)return;
        if(playing&&render){
            if(previousTime!==null)state.seconds=Math.min(DURATION,state.seconds+(now-previousTime)*speed/1000);
            previousTime=now;
            if(state.seconds>=DURATION)playing=false;
        }
        announce();
        if(!photograph&&render){
            const shouldPaint=!playing||now-lastDraw>=1000/30;
            if(shouldPaint){
                if(playing&&lastDraw>0){const gap=now-lastDraw;
                    if(gap>72)state.quality=Math.max(.56,state.quality-.045);
                    else if(gap<42)state.quality=Math.min(1,state.quality+.004);
                }
                const ready=render(state);
                if(ready!==false)poster.hidden=true;
                lastDraw=now;
            }
        }
        if(playing)requestDraw();
    }
    function seekTo(seconds){
        photograph=false;playing=false;previousTime=null;
        state.seconds=limit(seconds,0,DURATION);
        controls();
    }
    function togglePlay(){
        photograph=false;
        if(!playing&&state.seconds>=DURATION)state.seconds=0;
        playing=!playing;previousTime=null;lastDraw=0;
        controls();
    }
    play.onclick=togglePlay;
    el('.tr-reset').onclick=()=>seekTo(0);
    seek.oninput=()=>seekTo(Number(seek.value));
    el('.tr-speed').onchange=e=>{speed=Number(e.target.value);previousTime=null;announce();};
    phaseButtons.forEach((button,i)=>button.onclick=()=>seekTo(phases[i].shot));
    photoButton.onclick=()=>{playing=false;photograph=!photograph;previousTime=null;controls();};
    // Terrain choices take visitors straight to the landscape if they are still in orbit.
    layerButtons.forEach((button,i)=>button.onclick=()=>{
        photograph=false;state.relief=Boolean(i);
        if(state.seconds<9.5){state.seconds=9.5;previousTime=null;}
        controls();
    });
    cameraButtons.forEach((button,i)=>button.onclick=()=>{
        photograph=false;state.shot=i;freeCamera=false;
        [state.yaw,state.pitch,state.zoom]=SHOTS[i];controls();
    });
    function magnify(factor){
        if(photograph)return;
        state.zoom=limit(state.zoom*factor,usingFilm?SHOTS[state.shot][2]:.63,1.85);
        controls();
    }
    zoomButtons.forEach(b=>b.onclick=()=>magnify(Math.pow(1.19,Number(b.dataset.zoom))));
    function orbit(dx,dy){
        if(photograph)return;
        if(usingFilm){
            swipe+=dx;
            if(Math.abs(swipe)>48){
                const index=(state.shot+(swipe>0?1:2))%SHOTS.length;
                cameraButtons[index].click();swipe=0;
            }
            return;
        }
        state.yaw-=dx*.0075;
        state.pitch=limit(state.pitch+dy*.005,.04,1.46);
        freeCamera=true;controls();
    }
    const distance=()=>{const [a,b]=[...pointers.values()];return Math.hypot(a.x-b.x,a.y-b.y);};
    stage.onpointerdown=e=>{
        if(e.target.closest('button')||photograph)return;
        stage.focus({preventScroll:true});swipe=0;
        stage.setPointerCapture(e.pointerId);
        pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
        if(pointers.size===2)pinchDistance=distance();
    };
    stage.onpointermove=e=>{
        const old=pointers.get(e.pointerId);if(!old)return;
        pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
        if(pointers.size===1)orbit(e.clientX-old.x,e.clientY-old.y);
        else if(pointers.size===2){const now=distance();if(pinchDistance>2)magnify(now/pinchDistance);pinchDistance=now;}
    };
    stage.onpointerup=stage.onpointercancel=stage.onlostpointercapture=e=>{pointers.delete(e.pointerId);pinchDistance=0;};
    stage.addEventListener('wheel',e=>{
        if(document.activeElement!==stage&&!e.ctrlKey)return;
        e.preventDefault();magnify(Math.exp(-limit(e.deltaY,-80,80)*.004));
    },{passive:false});
    stage.onkeydown=e=>{
        if(e.target!==stage)return;
        const moves={ArrowLeft:[-12,0],ArrowRight:[12,0],ArrowUp:[0,12],ArrowDown:[0,-12]};
        if(moves[e.key])orbit(...moves[e.key]);
        else if(e.key==='+'||e.key==='=')magnify(1.19);
        else if(e.key==='-')magnify(1/1.19);
        else if(e.key===' ')togglePlay();else return;
        e.preventDefault();
    };
    const returnToScene=el('.tr-return');
    returnToScene.textContent=t('Volver al visor','Back to viewer');
    returnToScene.onclick=()=>{photograph=false;controls();};
    const full=el('.tr-full');
    function syncExpanded(){
        const expanded=document.fullscreenElement===player||player.classList.contains('tr-expanded');
        const label=expanded?t('Cerrar vista ampliada','Close expanded view'):fullLabel;
        full.title=label;full.setAttribute('aria-label',label);full.setAttribute('aria-pressed',expanded);
        requestDraw();
    }
    function toggleOverlay(on){
        player.classList.toggle('tr-expanded',on);
        document.body.classList.toggle('tr-lock',on);syncExpanded();
    }
    full.onclick=async()=>{
        if(document.fullscreenElement===player){await document.exitFullscreen();return;}
        if(player.classList.contains('tr-expanded')){toggleOverlay(false);return;}
        if(document.fullscreenEnabled&&player.requestFullscreen){
            try{await player.requestFullscreen();return;}catch{}
        }
        toggleOverlay(true);
    };
    document.addEventListener('fullscreenchange',syncExpanded);
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&player.classList.contains('tr-expanded'))toggleOverlay(false);});
    document.addEventListener('visibilitychange',()=>{previousTime=null;lastDraw=0;announce();requestDraw();});
    new ResizeObserver(requestDraw).observe(stage);
    new IntersectionObserver(entries=>{
        visible=entries[0].isIntersecting;previousTime=null;lastDraw=0;announce();requestDraw();
    }).observe(stage);
    function startFilm(){
        usingFilm=true;gpu.hidden=true;film.hidden=false;
        [state.yaw,state.pitch,state.zoom]=SHOTS[state.shot];freeCamera=false;
        render=makeFilmRenderer(film,requestDraw,()=>{
            poster.hidden=false;poster.src=phaseButtons[Math.max(0,announcedPhase)].querySelector('img').src;
            playing=false;announce();
        });
        controls();
    }
    function startGPU(){
        buildRenderer(gpu).then(drawScene=>{
            usingFilm=false;render=drawScene;gpu.hidden=false;film.hidden=true;
            previousTime=null;controls();
         }).catch(error=>{console.warn('Trinity 3D:',error.message);startFilm();});
    }
    gpu.addEventListener('webglcontextlost',e=>{e.preventDefault();startFilm();});
    gpu.addEventListener('webglcontextrestored',startGPU);
    controls();startGPU();
    return {setActive(value){
        active=value;previousTime=null;lastDraw=0;
        if(!active){
            playing=false;cancelAnimationFrame(pending);pending=0;
            if(player.classList.contains('tr-expanded'))toggleOverlay(false);
            pointers.clear();
        }
        announce();requestDraw();
    }};
}
