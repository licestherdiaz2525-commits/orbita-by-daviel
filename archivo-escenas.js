import {mountTrinity as mountHistorical} from './trinity-view.js?v=audio1';
import {mountStreet} from './calle-escena.js';

function makeAudio(button, english) {
    const label = button.querySelector('span:last-child');
    const status = button.parentElement.querySelector('[role=status]');
    const t = (es, en) => english ? en : es;
    const filenames = ['trinity-eco.mp3', 'calle-impacto.mp3'];
    const tracks = new Map();
    let enabled = false, buffer, context, output, source;
    let selected = -1, time = -1, rate = 1, running = false;
    let began = 0, offset = 0, sourceRate = 1;

    function stop() {
        if (!source) return;
        source.stop();
        source.disconnect();
        source = null;
    }
    function render() {
        if (!enabled || !buffer || !running || document.hidden || time < 0 || time >= buffer.duration || context.state !== 'running') {
            stop();
            return;
        }
        const audibleTime = offset + (context.currentTime - began) * sourceRate;
        if (source && rate === sourceRate && Math.abs(audibleTime - time) < .25) return;
        stop();
        source = context.createBufferSource();
        source.buffer = buffer;
        source.playbackRate.value = rate;
        source.connect(output);
        offset = time;
        began = context.currentTime;
        sourceRate = rate;
        source.start(0, offset);
    }
    function show() {
        label.textContent = enabled ? t('Silenciar', 'Mute sound') : t('Activar sonido', 'Enable sound');
        button.setAttribute('aria-pressed', String(enabled));
    }
    function reportError(index) {
        if (selected !== index) return;
        enabled = false;
        stop();
        show();
        status.textContent = t('El audio no cargó. Pulsa para reintentar.', 'Audio could not load. Tap to retry.');
    }
    async function loadTrack(index) {
        if (index < 0 || !context) return;
        if (!tracks.has(index)) {
            tracks.set(index, fetch(filenames[index]).then(response => {
                if (!response.ok) throw new Error('audio');
                return response.arrayBuffer();
            }).then(bytes => context.decodeAudioData(bytes)));
        }
        try {
            const track = await tracks.get(index);
            if (index === selected) { buffer = track; render(); }
        } catch {
            tracks.delete(index);
            if (enabled) reportError(index);
        }
    }
    button.addEventListener('click', async () => {
        enabled = !enabled;
        status.textContent = '';
        show();
        if (!enabled) {stop(); return;}
        const index = selected;
        try {
            if (!context) {
                const AudioEngine = window.AudioContext || window.webkitAudioContext;
                context = new AudioEngine();
                output = context.createGain();
                output.gain.value = .66;
                output.connect(context.destination);
            }
            await Promise.all([context.resume(), loadTrack(index)]);
            render();
        } catch { reportError(index); }
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
    show();
    return {
        select(index) {
            if (selected === index) return;
            selected = index;
            buffer = null;
            if (enabled) loadTrack(index);
            running = false;
            time = -1;
            stop();
        },
        sync(index, seconds, speed, playing) {
            if (selected !== index) return;
            time = seconds;
            rate = speed;
            running = playing;
            render();
        }
    };
}

export function mountTrinity(root, english) {
    const t = (es, en) => english ? en : es;
    const labels = [t('Prueba Trinity', 'Trinity test'), t('Calle y refugio', 'Street and shelter')];
    const params = new URL(location.href).searchParams;
    let chosen = params.get('escena') === 'calle' ? 1 : 0;
    let active = false;
    root.classList.add('trinity');
    root.innerHTML = `
        <div class="ar-toolbar">
          <div class="ar-choice" role="group" aria-label="${t('Escenas del archivo nuclear', 'Nuclear archive scenes')}">
            ${labels.map((name, i) => `<button type="button" aria-controls="ar-scene-${i}" data-choice="${i}">
                <small>${t('Opción', 'Option')} ${i+1}</small><strong>${name}</strong></button>`).join('')}
          </div>
          <div class="ar-audio"><button type="button" class="ar-sound"><span class="ar-wave" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span></span></button><small role="status"></small></div>
          <a class="ar-language" hreflang="${english ? 'es' : 'en'}" lang="${english ? 'es' : 'en'}"></a>
        </div>
        <div id="ar-scene-0" hidden></div><div id="ar-scene-1" hidden></div>`;
    const buttons = Array.from(root.querySelectorAll('[data-choice]'));
    const panes = labels.map((_,i) => root.querySelector('#ar-scene-'+i));
    const language = root.querySelector('.ar-language');
    const viewers = [];
    const audio = makeAudio(root.querySelector('.ar-sound'), english);
    const mounts = [mountHistorical, mountStreet];

    function setSceneParam(url) {
        if (chosen === 1) url.searchParams.set('escena', 'calle');
        else url.searchParams.delete('escena');
    }
    function refresh() {
        buttons.forEach((button, i) => {
            panes[i].hidden = i !== chosen;
            button.setAttribute('aria-pressed', String(i === chosen));
        });
        audio.select(active ? chosen : -1);
        if (active && !viewers[chosen]) {
            const index = chosen;
            viewers[index] = mounts[index](panes[index], english,
                (time, speed, playing) => audio.sync(index, time, speed, playing));
        }
        viewers.forEach((view, i) => view.setActive(active && i === chosen));
        const alternate = new URL(location.href);
        alternate.searchParams.set('vista', 'trinity');
        setSceneParam(alternate);
        if (english) alternate.searchParams.delete('lang');
        else alternate.searchParams.set('lang', 'en');
        language.href = alternate.href;
        language.textContent = english ? 'Español' : 'English';
    }
    buttons.forEach((button, index) => button.addEventListener('click', () => {
        if (chosen === index) return;
        chosen = index;
        const url = new URL(location.href);
        setSceneParam(url);
        history.replaceState(null, '', url);
        refresh();
    }));
    return {setSceneParam, setActive(value) { active = value; refresh(); }};
}
