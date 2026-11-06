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
    const STORAGE_KEY_AMBIENT_VOL = 'lanmao_ambient_vol_v1';
    let savedVol = null;
    try {
        if (typeof localStorage !== 'undefined') {
            savedVol = localStorage.getItem(STORAGE_KEY_AMBIENT_VOL);
        }
    } catch (_) {}
    let initialVol = savedVol !== null && !isNaN(Number(savedVol)) ? Math.max(0, Math.min(100, Number(savedVol))) : 40;
    let lastNonZeroVol = initialVol > 0 ? initialVol : 40;

    function syncVolumeDisplay(vol) {
        const volInput = byId('ambient-volume');
        const volVal = byId('ambient-vol-value');
        const volIcon = byId('ambient-vol-icon');
        const muteBtn = byId('ambient-vol-mute');
        if (volInput && Number(volInput.value) !== vol) {
            volInput.value = String(vol);
        }
        if (volVal) {
            volVal.textContent = `${vol}%`;
        }
        if (volIcon) {
            volIcon.textContent = vol === 0 ? '🔇' : vol < 50 ? '🔉' : '🔊';
        }
        if (muteBtn) {
            muteBtn.setAttribute('aria-label', vol === 0 ? '恢复音量' : '静音声音');
            muteBtn.setAttribute('title', vol === 0 ? '恢复音量' : '静音声音');
        }
    }

    function setVol(vol, persist = true) {
        vol = Math.max(0, Math.min(100, Math.round(vol)));
        player.setVolume(vol / 100);
        syncVolumeDisplay(vol);
        if (vol > 0) lastNonZeroVol = vol;
        if (persist) {
            try {
                if (typeof localStorage !== 'undefined') {
                    localStorage.setItem(STORAGE_KEY_AMBIENT_VOL, String(vol));
                }
            } catch (_) {}
        }
    }

    byId('ambient-volume')?.addEventListener('input', event => setVol(Number(event.target.value)));
    byId('ambient-vol-mute')?.addEventListener('click', () => {
        const currentVal = Number(byId('ambient-volume')?.value ?? 40);
        if (currentVal > 0) {
            lastNonZeroVol = currentVal;
            setVol(0, true);
        } else {
            setVol(lastNonZeroVol || 40, true);
        }
    });

    setVol(initialVol, false);
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

    const STORAGE_KEY_AMBIENT_SYNC = 'lanmao_ambient_sync_v1';

    function getAmbientSyncState() {
        const el = byId('ambient-pomodoro-sync');
        if (el && typeof el.checked === 'boolean') {
            return el.checked;
        }
        try {
            if (typeof localStorage !== 'undefined') {
                const saved = localStorage.getItem(STORAGE_KEY_AMBIENT_SYNC);
                if (saved !== null) return saved === 'true';
            }
        } catch (_) {}
        return true;
    }

    function syncAmbientSyncUI(enabled) {
        const check = byId('ambient-pomodoro-sync');
        if (check && check.checked !== enabled) {
            check.checked = enabled;
        }

        const focusToggle = byId('focus-ambient-toggle');
        if (focusToggle) {
            focusToggle.setAttribute('aria-pressed', String(enabled));
            focusToggle.setAttribute('title', enabled ? '伴读声音联动开关：开 (专注自动播放/休息静音)' : '伴读声音联动开关：关');
            focusToggle.classList.toggle('off', !enabled);
        }

        const pomodoroToggle = byId('pomodoro-ambient-toggle');
        if (pomodoroToggle) {
            pomodoroToggle.setAttribute('aria-pressed', String(enabled));
            pomodoroToggle.textContent = enabled ? '🎧 伴读联动: 开' : '🎧 伴读联动: 关';
            pomodoroToggle.classList.toggle('off', !enabled);
        }
    }

    function setAmbientSyncState(enabled) {
        try {
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem(STORAGE_KEY_AMBIENT_SYNC, String(enabled));
            }
        } catch (_) {}
        syncAmbientSyncUI(enabled);
    }

    try {
        if (typeof localStorage !== 'undefined') {
            const savedSync = localStorage.getItem(STORAGE_KEY_AMBIENT_SYNC);
            if (savedSync !== null && byId('ambient-pomodoro-sync')) {
                byId('ambient-pomodoro-sync').checked = (savedSync === 'true');
            }
        }
    } catch (_) {}
    syncAmbientSyncUI(getAmbientSyncState());

    byId('ambient-pomodoro-sync')?.addEventListener('change', event => {
        setAmbientSyncState(event.target.checked);
    });

    window.addEventListener('lanmao-ambient-sync-changed', ({detail = {}}) => {
        if (typeof detail.enabled === 'boolean') {
            syncAmbientSyncUI(detail.enabled);
        }
    });

    window.addEventListener('lanmao-focus-state', ({detail = {}}) => {
        if (!getAmbientSyncState()) return;
        if (detail.running && detail.mode === 'focus') {
            if (detail.allowStart && !isActive()) {
                player.play();
                const cur = byId('ambient-current-status');
                if (cur) cur.textContent = '🎧 深度专注中 · 伴读声音相伴心流';
            }
        } else if (isActive()) {
            if (detail.mode === 'short-break' || detail.mode === 'long-break') {
                player.pause('☕ 专注休息中 · 伴读声音已自动静音淡出');
            } else {
                player.pause('已暂停 · 点击播放，轻声陪伴');
            }
        }
    });
    ['pomodoro-start', 'focus-main-start', 'focus-next-pill-btn', 'pomodoro-next-btn', 'focus-ambient-toggle', 'pomodoro-ambient-toggle'].forEach(btnId => {
        byId(btnId)?.addEventListener('click', () => {
            if (getAmbientSyncState()) player.unlock?.();
        });
    });
    document.addEventListener('keydown', event => {
        if ((event.code === 'Space' || event.key === ' ') && getAmbientSyncState()) {
            player.unlock?.();
        }
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
