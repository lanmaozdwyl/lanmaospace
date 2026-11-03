import {AMBIENT_SOUNDS, AmbientPlayer} from './lib/ambient.mjs';

const play = document.getElementById('ambient-master-play');
if (play) {
    const byId = id => document.getElementById(id);
    const cards = [...document.querySelectorAll('.ambient-sound-card')];
    const timers = [...document.querySelectorAll('.ambient-timer-pill')];
    let deadline = 0, timerId;
    const player = new AmbientPlayer({
        createContext: () => new (window.AudioContext || window.webkitAudioContext)(),
        onState: ({state, id, message}) => {
            const sound = AMBIENT_SOUNDS.find(item => item.id === id);
            const active = state === 'playing' || state === 'loading';
            byId('ambient-current-title').textContent = sound.title;
            byId('ambient-current-status').textContent = message || (state === 'loading' ? '正在加载声音，再点一次可取消…' : state === 'playing' ? sound.desc : '已暂停 · 点击播放，轻声陪伴');
            byId('ambient-play-label').textContent = state === 'loading' ? '取消加载' : state === 'playing' ? '暂停声音' : state === 'error' ? '重试播放' : '开启声音';
            byId('ambient-play-icon').textContent = active ? '⏸' : '▶';
            play.setAttribute('aria-label', byId('ambient-play-label').textContent);
            play.setAttribute('aria-pressed', String(active));
            play.classList.toggle('playing', state === 'playing');
            byId('ambient-wave').classList.toggle('active', state === 'playing');
            for (const card of cards) {
                const selected = card.dataset.sound === id;
                card.classList.toggle('active', selected);
                card.setAttribute('aria-checked', String(selected));
                card.tabIndex = selected ? 0 : -1;
            }
        },
    });
    const isActive = () => ['loading', 'playing'].includes(player.state);
    play.addEventListener('click', () => isActive() ? player.pause() : player.play());
    cards.forEach((card, index) => {
        card.addEventListener('click', () => card.dataset.sound === player.current && isActive() ? player.pause() : player.play(card.dataset.sound));
        card.addEventListener('keydown', event => {
            const delta = {ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1}[event.key];
            if (!delta && !['Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? cards.length - 1 : (index + delta + cards.length) % cards.length;
            cards[next].focus();
            player.play(cards[next].dataset.sound);
        });
    });
    byId('ambient-volume').addEventListener('input', event => player.setVolume(Number(event.target.value) / 100));
    player.setVolume(Number(byId('ambient-volume').value) / 100);
    const clearTimer = () => {
        clearTimeout(timerId);
        deadline = 0;
        for (const pill of timers) { const active = pill.dataset.timer === '0'; pill.classList.toggle('active', active); pill.setAttribute('aria-pressed', String(active)); }
    };
    const checkTimer = () => {
        if (deadline && Date.now() >= deadline) { clearTimer(); player.pause('定时已结束 · 声音已关闭'); }
        else if (deadline) { clearTimeout(timerId); timerId = setTimeout(checkTimer, Math.min(deadline - Date.now(), 1000)); }
    };
    for (const pill of timers) pill.addEventListener('click', () => {
        clearTimer();
        const seconds = Number(pill.dataset.timer);
        for (const button of timers) { const active = button === pill; button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active)); }
        if (seconds > 0) { deadline = Date.now() + seconds * 1000; checkTimer(); }
    });
    document.addEventListener('visibilitychange', checkTimer);
    window.addEventListener('pageshow', checkTimer);
    window.addEventListener('pagehide', () => player.dispose());
    window.addEventListener('lanmao-focus-state', ({detail = {}}) => {
        if (!byId('ambient-pomodoro-sync').checked) return;
        if (detail.running && detail.mode === 'focus') {
            if (detail.allowStart && !isActive()) player.play();
        } else if (isActive()) player.pause();
    });
    const credits = byId('ambient-credits');
    for (const sound of AMBIENT_SOUNDS) {
        const line = document.createElement('p');
        line.append(`${sound.title}：`);
        sound.credits.forEach((credit, i) => {
            if (i) line.append(' ＋ ');
            const source = document.createElement('a');
            source.textContent = `${credit.title} — ${credit.author}`;
            source.href = credit.url;
            source.target = '_blank';
            source.rel = 'noopener noreferrer';
            const license = document.createElement('a');
            license.textContent = credit.license;
            license.href = credit.licenseUrl;
            license.target = '_blank';
            license.rel = 'noopener noreferrer';
            line.append(source, '（', license, credit.editor ? `；中间编辑：${credit.editor}` : '', '）');
        });
        credits.append(line);
    }
    player.notify('paused', '就绪 · 选择一种声音，低音量开始');
}
