// ===== 导航与动效：优先使用合成动画，尊重系统减少动态效果设置 =====
const navbar = document.getElementById('navbar');
const navToggle = document.getElementById('nav-toggle');
const navLinks = document.getElementById('nav-links');
const sections = [...document.querySelectorAll('.section, .hero')];
const navLinkElements = [...document.querySelectorAll('.nav-link')];
const backToTop = document.getElementById('backToTop');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function setMenu(open) {
    navToggle.classList.toggle('open', open);
    navLinks.classList.toggle('open', open);
    navToggle.setAttribute('aria-expanded', String(open));
    navToggle.setAttribute('aria-label', open ? '关闭导航菜单' : '打开导航菜单');
}
navToggle.addEventListener('click', () => setMenu(!navLinks.classList.contains('open')));
navLinkElements.forEach(link => link.addEventListener('click', () => setMenu(false)));
document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && navLinks.classList.contains('open')) {
        setMenu(false);
        navToggle.focus();
    }
});
document.addEventListener('click', event => {
    if (!navbar.contains(event.target)) setMenu(false);
});
window.matchMedia('(max-width: 768px)').addEventListener('change', () => setMenu(false));

let scrollFrame = 0;
function updateScrollState() {
    const y = window.scrollY;
    navbar.classList.toggle('scrolled', y > 50);
    backToTop.classList.toggle('visible', y > 400);
    let current = 'home';
    sections.forEach(section => {
        if (y >= section.offsetTop - 120) current = section.id;
    });
    navLinkElements.forEach(link => {
        const active = link.hash === '#' + current;
        link.classList.toggle('active', active);
        if (active) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
    });
    scrollFrame = 0;
}
window.addEventListener('scroll', () => {
    if (!scrollFrame) scrollFrame = requestAnimationFrame(updateScrollState);
}, { passive: true });
window.addEventListener('resize', updateScrollState);
updateScrollState();
backToTop.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: reducedMotion.matches ? 'instant' : 'smooth' });
});

const hour = new Date().getHours();
document.getElementById('greeting').textContent = hour < 6 ? '夜深了' : hour < 12 ? '早上好' : hour < 14 ? '中午好' : hour < 18 ? '下午好' : '晚上好';

function animateCounters() {
    const counters = [...document.querySelectorAll('.stat-number')];
    const start = performance.now();
    function frame(now) {
        const progress = reducedMotion.matches ? 1 : Math.min((now - start) / 1200, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        counters.forEach(counter => {
            counter.textContent = Math.round(Number(counter.dataset.target) * eased);
        });
        if (progress < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
}

// 默认内容可见；所有 fade-up 元素统一注册，避免父容器永久透明。
if ('IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                revealObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0, rootMargin: '0px 0px -24px 0px' });
    if (!reducedMotion.matches) {
        document.querySelectorAll('.fade-up').forEach(el => {
            // 动画只作用于最外层，避免父子透明度相乘和重复位移。
            if (!el.parentElement.closest('.fade-up')) {
                revealObserver.observe(el);
                el.classList.add('reveal-pending');
            }
        });
    }
    reducedMotion.addEventListener('change', event => {
        if (event.matches) {
            revealObserver.disconnect();
            document.querySelectorAll('.reveal-pending').forEach(el => el.classList.add('visible'));
        }
    });
    const statsObserver = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting)) {
            animateCounters();
            statsObserver.disconnect();
        }
    });
    statsObserver.observe(document.querySelector('.hero-stats'));
} else {
    animateCounters();
}

// ===== 书单筛选 =====
const filterBtns = [...document.querySelectorAll('.filter-btn')];
const bookCards = [...document.querySelectorAll('.book-card')];
filterBtns.forEach(btn => {
    btn.setAttribute('aria-pressed', String(btn.classList.contains('active')));
    btn.addEventListener('click', () => {
        filterBtns.forEach(b => {
            b.classList.toggle('active', b === btn);
            b.setAttribute('aria-pressed', String(b === btn));
        });
        bookCards.forEach(card => {
            card.classList.toggle('hidden', btn.dataset.filter !== 'all' && card.dataset.category !== btn.dataset.filter);
        });
    });
});

// ===== 音乐影视标签：点击、方向键、Home/End =====
const mediaTabs = [...document.querySelectorAll('.media-tab')];
const mediaContents = [...document.querySelectorAll('.media-content')];
function selectMedia(tab) {
    mediaTabs.forEach(item => {
        item.classList.toggle('active', item === tab);
        item.setAttribute('aria-selected', String(item === tab));
        item.tabIndex = item === tab ? 0 : -1;
    });
    mediaContents.forEach(content => content.classList.toggle('active', content.id === tab.dataset.tab));
}
mediaTabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectMedia(tab));
    tab.addEventListener('keydown', event => {
        let next;
        if (event.key === 'ArrowRight') next = (index + 1) % mediaTabs.length;
        else if (event.key === 'ArrowLeft') next = (index - 1 + mediaTabs.length) % mediaTabs.length;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = mediaTabs.length - 1;
        else return;
        event.preventDefault();
        selectMedia(mediaTabs[next]);
        mediaTabs[next].focus();
    });
});

// ===== Apple-Style Dark/Light Mode Switcher =====
(function initTheme() {
    const themeToggle = document.getElementById('theme-toggle');
    function applyTheme(theme) {
        if (theme === 'dark' || theme === 'light') {
            document.documentElement.setAttribute('data-theme', theme);
            document.body.setAttribute('data-theme', theme);
        } else {
            document.documentElement.removeAttribute('data-theme');
            document.body.removeAttribute('data-theme');
        }
        if (themeToggle) {
            const isDark = theme === 'dark' || (!theme && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
            themeToggle.setAttribute('aria-label', isDark ? '切换至亮色模式' : '切换至暗色模式');
            themeToggle.title = isDark ? '切换至亮色模式' : '切换至暗色模式';
            themeToggle.innerHTML = isDark ? '<span aria-hidden="true">☀️</span>' : '<span aria-hidden="true">🌙</span>';
        }
    }

    try {
        const savedTheme = localStorage.getItem('lanmao_theme');
        if (savedTheme) applyTheme(savedTheme);
    } catch (_) {}

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const current = document.documentElement.getAttribute('data-theme') || 
                (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
            const next = current === 'dark' ? 'light' : 'dark';
            try { localStorage.setItem('lanmao_theme', next); } catch (_) {}
            applyTheme(next);
        });
    }

    if (window.matchMedia) {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
            try {
                if (!localStorage.getItem('lanmao_theme')) {
                    applyTheme('');
                }
            } catch (_) {}
        });
    }
})();

// ===== Apple-Style Spotlight Search (Cmd/Ctrl + K) =====
(function initSpotlight() {
    const dialog = document.getElementById('spotlight-dialog');
    const input = document.getElementById('spotlight-input');
    const list = document.getElementById('spotlight-results');
    const trigger = document.getElementById('spotlight-trigger');

    if (!dialog || !input || !list) return;

    const searchIndex = [
        { title: '首页 · 概览与精选', category: '页面', url: '#home', icon: '🏠' },
        { title: '阅读书单 · 学术专著与笔记', category: '页面', url: '#books', icon: '📚' },
        { title: '沉浸伴读白噪声 · 雨声/布朗噪声/微风/柴火/脑波', category: '伴读音效', url: '#ambient', icon: '🎧' },
        { title: '雨落窗台白噪声 (Rainfall)', category: '伴读音效', url: '#ambient', icon: '🌧️' },
        { title: '深度布朗噪声 (Deep Brown Noise)', category: '伴读音效', url: '#ambient', icon: '🌊' },
        { title: '音乐与影视 · 治愈旋律与影片', category: '页面', url: '#music', icon: '🎵' },
        { title: '学术专注番茄钟 · 25m 深度专注 / 5m 小憩', category: '效率工具', url: '#focus', icon: '🍅' },
        { title: '精选学术与工程导航 · 顶级科研资源', category: '页面', url: '#links', icon: '🔗' },
        { title: '工具站 · 翻译/写作/编程全能合集', category: '页面', url: 'tools/', icon: '🛠️' },
        { title: '我的商店 · 生产力与服务咨询', category: '页面', url: 'store.html', icon: '🛒' },
        { title: '常见问题 · 购物与服务解答', category: '页面', url: 'faq.html', icon: '❓' },
        { title: '下载安卓版客户端 APK（无需谷歌框架）', category: '客户端下载', url: 'lanmaospace.apk', icon: '📱' },
        { title: '加密备忘录 · 本地安全私密笔记', category: '页面', url: 'memo.html', icon: '📝' },
        { title: '成员空间 · 个人主页与动态', category: '页面', url: 'space.html', icon: '🪐' },
        { title: '账号安全中心 · 密码与登录管理', category: '页面', url: 'account.html', icon: '🛡️' },

        { title: 'Overleaf 在线 LaTeX 论文协作与排版', category: '工具', url: 'tools/#writing', icon: '📝' },
        { title: 'Zotero 强大文献管理与引用导出', category: '工具', url: 'tools/#writing', icon: '📎' },
        { title: 'DeepL 高精度学术与专业 AI 翻译', category: '工具', url: 'tools/#translation', icon: '🌐' },
        { title: 'Google Colab 免配置云端 GPU Jupyter 环境', category: '工具', url: 'tools/#dev', icon: '🧪' },
        { title: 'GitHub 全球开源代码托管与协作', category: '工具', url: 'tools/#dev', icon: '🐙' },
        { title: 'VS Code 现代化轻量全能代码编辑器', category: '工具', url: 'tools/#dev', icon: '💎' },
        { title: 'Figma 协同式界面设计与原型工具', category: '工具', url: 'tools/#design', icon: '🎨' },
        { title: 'Excalidraw 纯粹手绘风格白板与草图', category: '工具', url: 'tools/#design', icon: '✏️' },

        { title: '百年孤独 (马尔克斯)', category: '书单', url: '#books', icon: '📘' },
        { title: '深度学习 (Deep Learning · Ian Goodfellow)', category: '书单', url: '#books', icon: '📗' },
        { title: '统计学习方法 (李航)', category: '书单', url: '#books', icon: '📒' },
        { title: '人类简史 (尤瓦尔·赫拉利)', category: '书单', url: '#books', icon: '📕' },
        { title: '小王子 (圣埃克苏佩里)', category: '书单', url: '#books', icon: '📙' },

        { title: '网易云音乐专属精选歌单 (ID: 9209159326)', category: '音乐', url: 'https://music.163.com/playlist?id=9209159326', icon: '🎧' },
        { title: '晴天 · 周杰伦', category: '音乐', url: '#music', icon: '🎸' },
        { title: 'Nuvole Bianche · Ludovico Einaudi', category: '音乐', url: '#music', icon: '🎹' },
        { title: '星际穿越 (Interstellar)', category: '影视', url: '#music', icon: '🎬' },
        { title: '肖申克的救赎', category: '影视', url: '#music', icon: '🎭' }
    ];

    let selectedIndex = 0;
    let currentResults = [];

    function renderResults(results) {
        currentResults = results;
        list.innerHTML = '';
        if (results.length === 0) {
            list.innerHTML = '<div class="spotlight-empty">未找到匹配内容</div>';
            return;
        }
        results.forEach((item, idx) => {
            const a = document.createElement('a');
            a.className = 'spotlight-item' + (idx === selectedIndex ? ' active' : '');
            a.href = item.url;
            if (item.url.startsWith('http')) {
                a.target = '_blank';
                a.rel = 'noopener noreferrer';
            }
            if (item.url.endsWith('.apk')) {
                a.setAttribute('download', 'lanmaospace.apk');
            }
            a.innerHTML = '<span class="spotlight-item-icon" aria-hidden="true">' + item.icon + '</span>' +
                '<div class="spotlight-item-text">' +
                '<span class="spotlight-item-title">' + item.title + '</span>' +
                '<span class="spotlight-item-cat">' + item.category + '</span>' +
                '</div>' +
                '<span class="spotlight-item-enter" aria-hidden="true">↵</span>';
            a.addEventListener('click', () => closeSpotlight());
            list.appendChild(a);
        });
    }

    function search(kw) {
        kw = kw.trim().toLowerCase();
        if (!kw) {
            renderResults(searchIndex.slice(0, 7));
            return;
        }
        const filtered = searchIndex.filter(item => 
            item.title.toLowerCase().includes(kw) || item.category.toLowerCase().includes(kw)
        );
        selectedIndex = 0;
        renderResults(filtered);
    }

    function openSpotlight() {
        dialog.showModal();
        input.value = '';
        search('');
        input.focus();
    }

    function closeSpotlight() {
        dialog.close();
    }

    if (trigger) {
        trigger.addEventListener('click', openSpotlight);
    }

    document.addEventListener('keydown', e => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            if (dialog.open) closeSpotlight();
            else openSpotlight();
        } else if (dialog.open) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (currentResults.length > 0) {
                    selectedIndex = (selectedIndex + 1) % currentResults.length;
                    renderResults(currentResults);
                }
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (currentResults.length > 0) {
                    selectedIndex = (selectedIndex - 1 + currentResults.length) % currentResults.length;
                    renderResults(currentResults);
                }
            } else if (e.key === 'Enter') {
                if (currentResults.length > 0 && currentResults[selectedIndex]) {
                    e.preventDefault();
                    const target = currentResults[selectedIndex];
                    closeSpotlight();
                    if (target.url.startsWith('http')) {
                        window.open(target.url, '_blank', 'noopener,noreferrer');
                    } else if (target.url.startsWith('#')) {
                        location.hash = target.url;
                    } else {
                        location.href = target.url;
                    }
                }
            }
        }
    });

    input.addEventListener('input', e => search(e.target.value));
    dialog.addEventListener('click', e => {
        if (e.target === dialog) closeSpotlight();
    });
})();

// ===== Reading Progress Bar Driver =====
(function initReadingProgress() {
    const progressBar = document.getElementById('reading-progress');
    if (!progressBar) return;
    function updateProgress() {
        const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
        const progress = totalHeight > 0 ? window.scrollY / totalHeight : 0;
        progressBar.style.transform = 'scaleX(' + Math.min(1, Math.max(0, progress)) + ')';
    }
    window.addEventListener('scroll', updateProgress, { passive: true });
    window.addEventListener('resize', updateProgress);
    updateProgress();
})();




// ===== Ambient Focus Sounds & White Noise Engine (Procedural Web Audio) =====
(function initAmbientNoiseEngine() {
    const playBtn = document.getElementById('ambient-master-play');
    const playIcon = document.getElementById('ambient-play-icon');
    const playLabel = document.getElementById('ambient-play-label');
    const volSlider = document.getElementById('ambient-volume');
    const waveIndicator = document.getElementById('ambient-wave');
    const titleDisplay = document.getElementById('ambient-current-title');
    const statusDisplay = document.getElementById('ambient-current-status');
    const cards = document.querySelectorAll('.ambient-sound-card');
    const timerPills = document.querySelectorAll('.ambient-timer-pill');
    const syncCheckbox = document.getElementById('ambient-pomodoro-sync');

    if (!playBtn || !volSlider || cards.length === 0) return;

    let audioCtx = null;
    let masterGain = null;
    let activeNodes = [];
    let isPlaying = false;
    let currentSound = 'rain';
    let sleepTimerId = null;
    let fadeTimerId = null;
    let currentVolume = Number(volSlider.value) / 100;

    const SOUND_INFO = {
        rain: { title: '雨落窗台 · Rainfall', desc: '正在播放：淅沥细雨，遮蔽外界杂音' },
        brown: { title: '布朗噪声 · Deep Brown Noise', desc: '正在播放：温暖低频轰鸣，深度阅读心流' },
        breeze: { title: '林间微风 · Forest Breeze', desc: '正在播放：山林微风拂叶，清新自然' },
        fire: { title: '温暖柴火 · Cozy Campfire', desc: '正在播放：冬夜炉火毕剥，安心踏实' },
        alpha: { title: '双音背景 · Twin Tones', desc: '正在播放：216Hz 与226Hz合成纯音' }
    };

    function ensureAudioContext() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            masterGain = audioCtx.createGain();
            masterGain.gain.setValueAtTime(currentVolume, audioCtx.currentTime);
            masterGain.connect(audioCtx.destination);
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume().catch(() => {});
        }
    }

    function createRainSound() {
        const bufferSize = audioCtx.sampleRate * 3;
        const buffer = audioCtx.createBuffer(2, bufferSize, audioCtx.sampleRate);
        for (let channel = 0; channel < 2; channel++) {
            const data = buffer.getChannelData(channel);
            let b0 = 0, b1 = 0, b2 = 0;
            for (let i = 0; i < bufferSize; i++) {
                const white = Math.random() * 2 - 1;
                b0 = 0.99765 * b0 + white * 0.0990460;
                b1 = 0.96300 * b1 + white * 0.2965164;
                b2 = 0.57000 * b2 + white * 1.0526913;
                let sample = (b0 + b1 + b2 + white * 0.1848) * 0.12;
                if (Math.random() < 0.001) sample += (Math.random() - 0.5) * 0.4;
                data[i] = sample;
            }
        }
        const source = audioCtx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;

        const lpFilter = audioCtx.createBiquadFilter();
        lpFilter.type = 'lowpass';
        lpFilter.frequency.value = 1400;

        const hpFilter = audioCtx.createBiquadFilter();
        hpFilter.type = 'highpass';
        hpFilter.frequency.value = 280;

        source.connect(lpFilter);
        lpFilter.connect(hpFilter);
        hpFilter.connect(masterGain);
        source.start(0);

        return [source, lpFilter, hpFilter];
    }

    function createBrownNoiseSound() {
        const bufferSize = audioCtx.sampleRate * 4;
        const buffer = audioCtx.createBuffer(2, bufferSize, audioCtx.sampleRate);
        for (let channel = 0; channel < 2; channel++) {
            const data = buffer.getChannelData(channel);
            let lastOut = 0.0;
            for (let i = 0; i < bufferSize; i++) {
                const white = Math.random() * 2 - 1;
                lastOut = (lastOut + (0.025 * white)) / 1.025;
                data[i] = lastOut * 3.8;
            }
        }
        const source = audioCtx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;

        const lpFilter = audioCtx.createBiquadFilter();
        lpFilter.type = 'lowpass';
        lpFilter.frequency.value = 480;

        source.connect(lpFilter);
        lpFilter.connect(masterGain);
        source.start(0);

        return [source, lpFilter];
    }

    function createBreezeSound() {
        const bufferSize = audioCtx.sampleRate * 3;
        const buffer = audioCtx.createBuffer(2, bufferSize, audioCtx.sampleRate);
        for (let channel = 0; channel < 2; channel++) {
            const data = buffer.getChannelData(channel);
            let b0 = 0, b1 = 0;
            for (let i = 0; i < bufferSize; i++) {
                const white = Math.random() * 2 - 1;
                b0 = 0.99 * b0 + white * 0.05;
                b1 = 0.95 * b1 + white * 0.1;
                data[i] = (b0 + b1) * 0.45;
            }
        }
        const source = audioCtx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;

        const filter = audioCtx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 460;
        filter.Q.value = 1.4;

        // LFO for slow breathing wind swell
        const lfo = audioCtx.createOscillator();
        const lfoGain = audioCtx.createGain();
        lfo.frequency.value = 0.14; // 7-second wind cycle
        lfoGain.gain.value = 220;
        lfo.connect(lfoGain);
        lfoGain.connect(filter.frequency);
        lfo.start(0);

        source.connect(filter);
        filter.connect(masterGain);
        source.start(0);

        return [source, filter, lfo, lfoGain];
    }

    function createCampfireSound() {
        const bufferSize = audioCtx.sampleRate * 3;
        const buffer = audioCtx.createBuffer(2, bufferSize, audioCtx.sampleRate);
        for (let channel = 0; channel < 2; channel++) {
            const data = buffer.getChannelData(channel);
            let lastOut = 0.0;
            for (let i = 0; i < bufferSize; i++) {
                const white = Math.random() * 2 - 1;
                lastOut = (lastOut + (0.02 * white)) / 1.02;
                let sample = lastOut * 1.8;
                // Crackle impulses
                if (Math.random() < 0.0012) {
                    sample += (Math.random() > 0.5 ? 1 : -1) * (0.3 + Math.random() * 0.5);
                }
                data[i] = sample;
            }
        }
        const source = audioCtx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;

        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 1200;

        source.connect(filter);
        filter.connect(masterGain);
        source.start(0);

        return [source, filter];
    }

    function createAlphaWaveSound() {
        const osc1 = audioCtx.createOscillator();
        const osc2 = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        // Mix two sine tones; no claim about brainwave effects.
        osc1.type = 'sine';
        osc1.frequency.value = 216;

        osc2.type = 'sine';
        osc2.frequency.value = 226;

        gain.gain.value = 0.22;

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(masterGain);

        osc1.start(0);
        osc2.start(0);

        return [osc1, osc2, gain];
    }

    function stopAllNodes() {
        activeNodes.forEach(node => {
            try {
                if (node.stop) node.stop();
                if (node.disconnect) node.disconnect();
            } catch (_) {}
        });
        activeNodes = [];
    }

    function playSound(type) {
        ensureAudioContext();
        if(fadeTimerId){clearTimeout(fadeTimerId);fadeTimerId=null;}
        masterGain.gain.cancelScheduledValues(audioCtx.currentTime);
        masterGain.gain.setValueAtTime(currentVolume,audioCtx.currentTime);
        stopAllNodes();

        switch (type) {
            case 'rain': activeNodes = createRainSound(); break;
            case 'brown': activeNodes = createBrownNoiseSound(); break;
            case 'breeze': activeNodes = createBreezeSound(); break;
            case 'fire': activeNodes = createCampfireSound(); break;
            case 'alpha': activeNodes = createAlphaWaveSound(); break;
            default: activeNodes = createRainSound(); break;
        }

        currentSound = type;
        isPlaying = true;
        updateUI();
    }

    function pauseSound() {
        if (masterGain && audioCtx) {
            masterGain.gain.setValueAtTime(masterGain.gain.value, audioCtx.currentTime);
            masterGain.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
            if(fadeTimerId)clearTimeout(fadeTimerId);
            fadeTimerId=setTimeout(() => {
                fadeTimerId=null;
                stopAllNodes();
                if (masterGain && audioCtx) {
                    masterGain.gain.setValueAtTime(currentVolume, audioCtx.currentTime);
                }
            }, 300);
        } else {
            stopAllNodes();
        }
        isPlaying = false;
        updateUI();
    }

    function updateUI() {
        const info = SOUND_INFO[currentSound] || SOUND_INFO.rain;
        titleDisplay.textContent = info.title;

        if (isPlaying) {
            statusDisplay.textContent = info.desc;
            playIcon.textContent = '⏸';
            playLabel.textContent = '暂停声音';
            playBtn.classList.add('playing');
            waveIndicator.classList.add('active');
        } else {
            statusDisplay.textContent = '已暂停 · 点击卡片或播放键开启伴读心流';
            playIcon.textContent = '▶';
            playLabel.textContent = '开启声音';
            playBtn.classList.remove('playing');
            waveIndicator.classList.remove('active');
        }

        cards.forEach(card => {
            const isCur = card.dataset.sound === currentSound;
            card.classList.toggle('active', isCur);
            card.setAttribute('aria-checked', String(isCur));
        });
    }

    playBtn.addEventListener('click', () => {
        if (isPlaying) pauseSound();
        else playSound(currentSound);
    });

    cards.forEach(card => {
        card.addEventListener('click', () => {
            const selected = card.dataset.sound;
            if (currentSound === selected && isPlaying) {
                pauseSound();
            } else {
                playSound(selected);
            }
        });
    });

    volSlider.addEventListener('input', e => {
        currentVolume = Number(e.target.value) / 100;
        if (masterGain && audioCtx) {
            masterGain.gain.setValueAtTime(currentVolume, audioCtx.currentTime);
        }
    });

    timerPills.forEach(pill => {
        pill.addEventListener('click', () => {
            timerPills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            const seconds = Number(pill.dataset.timer);
            if (sleepTimerId) {
                clearTimeout(sleepTimerId);
                sleepTimerId = null;
            }
            if (seconds > 0) {
                sleepTimerId = setTimeout(() => {
                    pauseSound();
                    timerPills.forEach(p => p.classList.toggle('active', p.dataset.timer === '0'));
                }, seconds * 1000);
            }
        });
    });

    // 使用真实状态事件，兼容悬浮与主体按钮；只在本页主动开始时自动播音。
    window.addEventListener('lanmao-focus-state',event=>{
        if(!syncCheckbox?.checked)return;
        const detail=event.detail||{};
        if(detail.running&&detail.mode==='focus'){
            if(detail.allowStart&&!isPlaying)playSound(currentSound);
        }else if(isPlaying)pauseSound();
    });
    window.addEventListener('pagehide',()=>stopAllNodes());

    updateUI();
})();

// ===== Register PWA Service Worker =====
if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
}

