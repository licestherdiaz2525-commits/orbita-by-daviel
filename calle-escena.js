import {makeStreetFilm} from './calle-efectos.js';

const END = 28;
const clock = time => '0:'+String(Math.floor(time)).padStart(2,'0');
const clamp = (n,min,max) => Math.min(max,Math.max(min,n));

export function mountStreet(root, english, syncSound) {
    const t = (es,en) => english ? en : es;
    const stages = [
        [0,t('La calle','On the street'),t('Los vecinos pasan frente a un edificio de ladrillo. A la derecha se ve la entrada que usarán para refugiarse.','Neighbors walk past a brick building. The doorway on the right is where they will take shelter.')],
        [4,t('Estruendo y escombros','Rumble and debris'),t('Se oye una explosión fuera de cuadro. Después del estruendo, trozos de ladrillo y vidrio rebotan en la acera.','An explosion is heard off screen. After the rumble, bits of brick and glass strike the sidewalk and bounce.')],
        [9,t('Entrada al refugio','Taking shelter'),t('Un vecino sostiene la puerta mientras los demás entran. En una emergencia radiológica, los CDC aconsejan buscar el sótano o el centro del edificio, lejos de ventanas y paredes exteriores.','A neighbor holds the door as people go inside. In a radiation emergency, the CDC advises going to the basement or the middle of the building, away from windows and exterior walls.')],
        [19,t('Polvo en la acera','Dust on the sidewalk'),t('La puerta queda cerrada. Si el polvo contiene material radiactivo, este puede permanecer en las superficies y seguir emitiendo radiación. La capa de color permite ver ese depósito en la escena.','The door is closed. If dust contains radioactive material, it can settle on surfaces and continue to emit radiation. The colored layer lets you see that deposit in the scene.')]
    ];
    root.innerHTML = `
      <div class="st-grid">
        <div class="tr-player st-player">
          <div class="st-stage" role="group" tabindex="0" aria-label="${t('Escena animada de una calle ficticia','Animated scene of a fictional street')}">
            <img class="st-poster" src="calle-antes.webp" alt="">
            <canvas role="img"></canvas>
            <div class="tr-top"><span class="tr-location">${t('Barrio ficticio','Fictional neighborhood')}</span>
              <button type="button" class="tr-icon st-full" aria-label="${t('Ampliar vista','Expand view')}">⛶</button></div>
            <div class="st-caption"><small></small><strong></strong></div>
          </div>
          <div class="st-transport">
            <button type="button" class="st-play"></button>
            <button type="button" class="tr-icon st-reset" title="${t('Reiniciar','Restart')}" aria-label="${t('Reiniciar','Restart')}">↺</button>
            <label class="st-scrub"><span class="ar-sr">${t('Tiempo de la escena','Scene playback position')}</span><input type="range" min="0" max="28" step=".05" value="0"></label>
            <span class="st-time"></span>
            <select aria-label="${t('Velocidad de reproducción','Playback speed')}">
              <option value=".25">0.25×</option><option value=".5">0.5×</option><option value="1" selected>1×</option><option value="2">2×</option>
            </select>
          </div>
          <p class="st-story" role="status"></p>
        </div>
        <aside class="st-side">
          <div class="st-settings">
            <h2>${t('Vista de la calle','Street view')}</h2>
            <div class="st-lenses" role="group" aria-label="${t('Encuadre','Camera framing')}">
              <button type="button" data-lens="wide" aria-pressed="true">${t('Plano general','Wide view')}</button>
              <button type="button" data-lens="door" aria-pressed="false">${t('Ver entrada','Doorway')}</button>
            </div>
            <div class="st-layer">
              <h3>${t('Radiación','Radiation')}</h3>
              <button class="st-layer-toggle" type="button" aria-pressed="false"><span class="st-switch" aria-hidden="true"></span>${t('Ver material radiactivo','Show radioactive material')}</button>
              <p>${t('La radiación es invisible. El violeta indica dónde puede quedar material radiactivo. La capa es ilustrativa y no mide la dosis.','Radiation is invisible. Violet marks where radioactive material can settle. This illustrative layer does not measure dose.')}</p>
              <div class="st-key" hidden><span><i></i>${t('En el aire','Airborne')}</span><span><i></i>${t('En la acera','On sidewalk')}</span></div>
              <a href="https://www.cdc.gov/radiation-emergencies/causes/index.html" target="_blank" rel="noopener">${t('Exposición y contaminación · CDC','Exposure and contamination · CDC')} ↗</a>
            </div>
          </div>
          <section class="st-memory" aria-label="${t('Muertes históricas en Hiroshima','Historical deaths in Hiroshima')}">
            <h2>${t('Hiroshima, 1945','Hiroshima, 1945')}</h2>
            <p>${t('La ciudad de Hiroshima estima que unas <strong>140&nbsp;000 personas</strong> habían muerto a causa del bombardeo al terminar diciembre de 1945.','The City of Hiroshima estimates that about <strong>140,000 people</strong> had died as a result of the bombing by the end of December 1945.')}</p>
            <a href="https://www.city.hiroshima.lg.jp/english/peace/1029920/1009857.html" target="_blank" rel="noopener">${t('Archivo de la ciudad de Hiroshima','City of Hiroshima archive')} ↗</a>
          </section>
        </aside>
        <section class="st-chapter-wrap">
          <h2>${t('Momentos de la escena','Scene chapters')}</h2>
          <div class="st-chapters">${stages.map(([time,name],i)=>`<button type="button" data-chapter="${i}">
              <small>${clock(time)}</small><strong>${name}</strong></button>`).join('')}</div>
          <small class="st-credit">${t('Escena y sonido recreados.','Recreated scene and sound.')} <a href="https://www.cdc.gov/radiation-emergencies/response/get-inside.html" target="_blank" rel="noopener">${t('Guía de refugio · CDC','Shelter guidance · CDC')} ↗</a></small>
        </section>
      </div>`;
    const $ = selector => root.querySelector(selector);
    const list = selector => [...root.querySelectorAll(selector)];
    const stage = $('.st-stage'), canvas = $('canvas'), player = $('.st-player');
    const play = $('.st-play'), range = $('.st-scrub input'), story = $('.st-story');
    const title = $('.st-caption strong'), sequence = $('.st-caption small'), timer = $('.st-time');
    const lens = list('[data-lens]'), chapters = list('[data-chapter]');
    const toggle = $('.st-layer-toggle'), key = $('.st-key'), full = $('.st-full');
    let active = false, inView = true, playing = false, layer = false;
    let time = 0, speed = 1, raf = 0, last = null, stated = -1, whole = -1;
    let drag = null;
    const camera = {near:false,x:.78,y:.61};
    const paint = makeStreetFilm(canvas, $('.st-poster'), invalidate);

    function update() {
        let index = 0;
        while (index+1 < stages.length && time >= stages[index+1][0]) index++;
        if (index !== stated) {
            stated = index;
            const [,name,caption] = stages[index];
            title.textContent = name;
            sequence.textContent = t('Escena','Scene')+' '+(index+1)+' / '+stages.length;
            story.textContent = caption;
            canvas.setAttribute('aria-label',name+'. '+caption);
            chapters.forEach((b,i)=>b.setAttribute('aria-pressed',String(i===index)));
        }
        if (whole !== Math.floor(time)) {
            whole = Math.floor(time);
            timer.textContent = clock(time)+' / '+clock(END);
            range.setAttribute('aria-valuetext',timer.textContent);
        }
        range.value = String(time);
        const label = playing ? t('Pausar','Pause') : time >= END ? t('Repetir','Replay') : t('Reproducir','Play');
        if (play.dataset.label !== label) {
            play.dataset.label = label;
            play.textContent = (playing ? 'Ⅱ  ' : '▶  ')+label;
        }
        syncSound(time-4,speed,active && playing && inView && !document.hidden);
    }
    function invalidate() {
        if (active && inView && !document.hidden && !raf) raf = requestAnimationFrame(frame);
    }
    function frame(now) {
        raf = 0;
        if (!active || !inView || document.hidden) return;
        if (playing && last!==null) time = Math.min(END,time+(now-last)*speed/1000);
        last = playing ? now : null;
        if (time >= END) {playing=false;last=null;}
        update();
        paint(time,layer,camera);
        if (playing) invalidate();
    }
    function seek(seconds) {
        playing = false;
        last = null;
        time = clamp(seconds,0,END);
        update();invalidate();
    }
    function playback() {
        if (time >= END) time = 0;
        playing = !playing;
        last = null;
        update();invalidate();
    }
    play.onclick = playback;
    $('.st-reset').onclick = () => seek(0);
    range.oninput = () => seek(Number(range.value));
    $('select').onchange = event => { speed=Number(event.target.value);last=null;update(); };
    chapters.forEach((b,i) => b.onclick = () => seek(stages[i][0]));
    toggle.onclick = () => {
        layer = !layer;
        toggle.setAttribute('aria-pressed',String(layer));key.hidden = !layer;
        if (layer && !playing && time < 8) seek(stages[3][0]);
        else {update();invalidate();}
    };
    lens.forEach((b,i) => b.onclick = () => {
        camera.near = i===1;
        camera.x=.78;camera.y=.61;
        lens.forEach((item,n) => item.setAttribute('aria-pressed',String(n===i)));
        stage.classList.toggle('st-near',camera.near);
        invalidate();
    });
    stage.onpointerdown = event => {
        if (!camera.near || event.target.closest('button') || !event.isPrimary) return;
        stage.setPointerCapture(event.pointerId);
        drag = {x:event.clientX,y:event.clientY,cx:clamp(camera.x,.338,.662),cy:clamp(camera.y,.338,.662)};
    };
    stage.onpointermove = event => {
        if (!drag || !event.isPrimary) return;
        camera.x=clamp(drag.cx-(event.clientX-drag.x)/(stage.clientWidth*1.48),.338,.662);
        camera.y=clamp(drag.cy-(event.clientY-drag.y)/(stage.clientHeight*1.48),.338,.662);
        invalidate();
    };
    stage.onpointerup = stage.onpointercancel = stage.onlostpointercapture = () => {drag=null;};
    stage.onkeydown = event => {
        if (event.target!==stage) return;
        if (event.key===' ') playback();
        else if (camera.near && ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) {
            const delta=.035;
            camera.x=clamp(camera.x,.338,.662);
            camera.y=clamp(camera.y,.338,.662);
            if (event.key==='ArrowLeft') camera.x-=delta;
            if (event.key==='ArrowRight') camera.x+=delta;
            if (event.key==='ArrowUp') camera.y-=delta;
            if (event.key==='ArrowDown') camera.y+=delta;
            invalidate();
        } else return;
        event.preventDefault();
    };
    function expanded() {
        const yes = document.fullscreenElement===player || player.classList.contains('tr-expanded');
        const label = yes ? t('Cerrar vista ampliada','Close expanded view') : t('Ampliar vista','Expand view');
        full.title=label;full.setAttribute('aria-label',label);full.setAttribute('aria-pressed',String(yes));
        invalidate();
    }
    function overlay(value) {
        player.classList.toggle('tr-expanded',value);
        document.body.classList.toggle('tr-lock',value);expanded();
    }
    full.onclick = async () => {
        if (document.fullscreenElement===player) {await document.exitFullscreen();return;}
        if (player.classList.contains('tr-expanded')) {overlay(false);return;}
        if (document.fullscreenEnabled && player.requestFullscreen) {
            try {await player.requestFullscreen();return;} catch {}
        }
        overlay(true);
    };
    document.addEventListener('fullscreenchange',expanded);
    document.addEventListener('keydown',event => {
        if(event.key==='Escape' && player.classList.contains('tr-expanded')) overlay(false);
    });
    document.addEventListener('visibilitychange',() => {last=null;update();invalidate();});
    new ResizeObserver(invalidate).observe(stage);
    new IntersectionObserver(([entry]) => {inView=entry.isIntersecting;last=null;update();invalidate();}).observe(stage);
    update();
    return {setActive(value) {
        active=value;
        if(!active) {
            playing=false;last=null;drag=null;cancelAnimationFrame(raf);raf=0;
            if(player.classList.contains('tr-expanded')) overlay(false);
        }
        update();invalidate();
    }};
}
