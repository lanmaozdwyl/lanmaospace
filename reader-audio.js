import {AMBIENT_SOUNDS, AmbientPlayer} from './lib/ambient.mjs';
const byId = id => document.getElementById(id);
const trigger = byId('reader-toggle-noise');
const panel = byId('reader-audio-panel');
if (trigger && panel) {
    const select = byId('reader-audio-select');
    const toggle = byId('reader-audio-play');
    const status = byId('reader-audio-status');
    const player = new AmbientPlayer({
        createContext: () => new (window.AudioContext || window.webkitAudioContext)(),
        onState: ({state, message, id}) => {
            const sound = AMBIENT_SOUNDS.find(s => s.id === id);
            const active = ['loading', 'playing'].includes(state);
            byId('reader-noise-state').textContent = state === 'playing' ? '开' : state === 'loading' ? '载入' : '关';
            toggle.textContent = state === 'loading' ? '取消加载' : state === 'playing' ? '暂停声音' : state === 'error' ? '重试播放' : '播放声音';
            toggle.setAttribute('aria-pressed', String(active));
            status.textContent = message || (state === 'playing' ? `${sound.title} · ${sound.desc}` : state === 'loading' ? '正在加载声音…' : '已暂停 · 选择喜欢的声音，低音量开始');
        },
    });
    for (const sound of AMBIENT_SOUNDS) {
        const option = document.createElement('option');
        option.value = sound.id;
        option.textContent = sound.title;
        select.append(option);
    }
    const credit = () => {
        const sound = AMBIENT_SOUNDS.find(s => s.id === select.value);
        const list = byId('reader-audio-credits');
        list.replaceChildren();
        list.append(`${sound.desc}。录音经选段、柔化及循环处理；三档雨由同一实录制作。来源：`);
        for (const c of sound.credits) {
            const link = document.createElement('a');
            link.textContent = `${c.title} — ${c.author}`;
            link.href = c.url;
            link.target = '_blank'; link.rel = 'noopener noreferrer';
            const license = document.createElement('a');
            license.textContent = c.license;
            license.href = c.licenseUrl;
            license.target = '_blank'; license.rel = 'noopener noreferrer';
            list.append(link, '（', license, c.editor ? `；中间编辑 ${c.editor}` : '', '） ');
        }
    };
    trigger.addEventListener('click', () => { if (!panel.open) { panel.showModal(); trigger.setAttribute('aria-expanded', 'true'); } });
    byId('reader-audio-close').addEventListener('click', () => panel.close());
    panel.addEventListener('close', () => { trigger.setAttribute('aria-expanded', 'false'); trigger.focus(); });
    toggle.addEventListener('click', () => ['playing', 'loading'].includes(player.state) ? player.pause() : player.play(select.value));
    select.addEventListener('change', () => {
        credit();
        if (['playing', 'loading'].includes(player.state)) player.play(select.value);
    });
    byId('reader-audio-volume').addEventListener('input', e => player.setVolume(Number(e.target.value) / 100));
    window.addEventListener('pagehide', () => player.dispose());
    credit();
}
