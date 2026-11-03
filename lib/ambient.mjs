// 音频只在用户主动播放时下载；原始录音及修改说明见 AUDIO-SOURCES.md。
const cc0 = 'https://creativecommons.org/publicdomain/zero/1.0/';
const credit = (author, title, url, license = 'CC0', licenseUrl = cc0, editor = '') => ({author, title, url, license, licenseUrl, editor});
const rain = credit('alex36917', 'rain ambience', 'https://freesound.org/people/alex36917/sounds/524605/', 'CC BY 4.0', 'https://creativecommons.org/licenses/by/4.0/', 'Porrumentzio / Blanket');
export const AMBIENT_SOUNDS = [
    {id: 'stream', title: '山间溪流', desc: '细碎水流，轻轻绕过石头', credits: [credit('gluckose', 'stream2.wav', 'https://freesound.org/people/gluckose/sounds/333987/')]},
    {id: 'rain-light', title: '檐下小雨', desc: '稀疏柔雨，轻一点的陪伴', credits: [rain]},
    {id: 'rain-medium', title: '窗外中雨', desc: '均匀雨声，保留自然起伏', credits: [rain]},
    {id: 'rain-heavy', title: '绵密大雨', desc: '两段实录叠成雨幕，不加雷声', credits: [rain]},
    {id: 'wooden-fish', title: '慢敲木鱼', desc: '柔和合成木鱼，每 2.4 秒轻敲一次', credits: [credit('Lanmao Space', '自制木鱼合成音（非现场录音）', 'https://github.com/lanmaozdwyl/lanmaospace/blob/main/scripts/generate-ambient.py')]},
    {id: 'temple-bell', title: '寺院远钟', desc: '钟声渐散，每 24 秒响一次', credits: [credit('Mike Koenig', 'Zen Buddhist Temple Bell', 'https://soundbible.com/1491-Zen-Buddhist-Temple-Bell.html', 'CC BY 3.0', 'https://creativecommons.org/licenses/by/3.0/')]},
    {id: 'waves', title: '缓缓海浪', desc: '海浪推近又退去，保留呼吸感', credits: [credit('florianreichelt', 'Waves Of Hawaii', 'https://freesound.org/people/florianreichelt/sounds/450755/')]},
    {id: 'forest', title: '林间鸟鸣', desc: '轻鸟鸣与柔风混合，树叶轻响', credits: [credit('kvgarlic', 'Birds', 'https://freesound.org/people/kvgarlic/sounds/156826/', 'CC0', cc0, 'Porrumentzio / Blanket'), credit('felix.blume', 'Wind', 'https://freesound.org/people/felix.blume/sounds/217506/', 'CC0', cc0, 'Porrumentzio / Blanket')]},
].map(sound => ({...sound, url: `/audio/${sound.id}.mp3`}));

export class AmbientPlayer {
    constructor({createContext, fetchAudio = (...args) => fetch(...args), onState = () => {}, schedule = (...args) => setTimeout(...args), cancel = id => clearTimeout(id)} = {}) {
        this.createContext = createContext;
        this.fetchAudio = fetchAudio;
        this.onState = onState;
        this.schedule = schedule;
        this.cancel = cancel;
        this.cache = new Map();
        this.retiring = new Map();
        this.volume = .4;
        this.sequence = 0;
        this.state = 'paused';
        this.current = 'stream';
    }
    notify(state, message = '') {
        this.state = state;
        this.onState({state, id: this.current, message});
    }
    setVolume(value) {
        this.volume = Math.max(0, Math.min(1, Number(value) || 0));
        if (this.gain) {
            this.gain.gain.cancelScheduledValues(this.context.currentTime);
            this.gain.gain.setTargetAtTime(this.volume, this.context.currentTime, .06);
        }
    }
    finish(node) {
        if (!node) return;
        try { node.source.stop(); } catch { /* 已经停止 */ }
        node.source.disconnect();
        node.gain.disconnect();
    }
    retire(immediate = false) {
        const node = this.active;
        this.active = null;
        if (!node) return;
        if (immediate) { this.finish(node); return; }
        const now = this.context.currentTime;
        node.gain.gain.cancelScheduledValues(now);
        node.gain.gain.setValueAtTime(node.gain.gain.value, now);
        node.gain.gain.linearRampToValueAtTime(0, now + .45);
        const timer = this.schedule(() => { this.retiring.delete(node); this.finish(node); }, 500);
        this.retiring.set(node, timer);
    }
    async play(id = this.current) {
        const sound = AMBIENT_SOUNDS.find(item => item.id === id);
        if (!sound) return;
        const token = ++this.sequence;
        this.controller?.abort();
        this.retire();
        this.current = id;
        this.notify('loading');
        const controller = new AbortController();
        this.controller = controller;
        const timeout = this.schedule(() => controller.abort(), 25000);
        try {
            if (!this.context) {
                this.context = this.createContext();
                this.gain = this.context.createGain();
                this.gain.gain.value = this.volume;
                this.gain.connect(this.context.destination);
                this.context.addEventListener?.('statechange', () => {
                    if (this.state === 'playing' && this.context.state !== 'running') this.pause('播放被系统暂停，点击继续');
                });
            }
            // 必须在点击回调内先调用 resume，兼容 Android 的音频手势限制。
            const resumed = this.context.resume();
            const aborted = new Promise((_, reject) => controller.signal.addEventListener('abort', () => reject(Error('播放已取消或超时')), {once: true}));
            const load = async () => {
                await resumed;
                if (token !== this.sequence || controller.signal.aborted) throw Error('播放已取消');
                if (this.cache.has(id)) return this.cache.get(id);
                const response = await this.fetchAudio(sound.url, {signal: controller.signal});
                if (!response.ok) throw Error('音频暂时无法加载');
                return this.context.decodeAudioData(await response.arrayBuffer());
            };
            const buffer = await Promise.race([load(), aborted]);
            if (token !== this.sequence) return;
            this.cache.delete(id);
            this.cache.set(id, buffer);
            while (this.cache.size > 2) this.cache.delete(this.cache.keys().next().value);
            const source = this.context.createBufferSource();
            const gain = this.context.createGain();
            source.buffer = buffer;
            source.loop = true;
            gain.gain.setValueAtTime(0, this.context.currentTime);
            gain.gain.linearRampToValueAtTime(1, this.context.currentTime + .65);
            source.connect(gain);
            gain.connect(this.gain);
            this.active = {source, gain};
            source.start();
            this.notify('playing');
        } catch {
            if (token === this.sequence) {
                this.retire(true);
                this.notify('error', '声音未能播放，请检查网络后点击重试');
            }
        } finally {
            this.cancel(timeout);
            if (this.controller === controller) this.controller = null;
        }
    }
    pause(message = '') {
        ++this.sequence;
        this.controller?.abort();
        this.retire();
        this.notify('paused', message);
    }
    dispose() {
        this.pause();
        for (const [node, timer] of this.retiring) { this.cancel(timer); this.finish(node); }
        this.retiring.clear();
        this.cache.clear();
    }
}
