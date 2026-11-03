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
        { title: '音乐与影视 · 治愈旋律与影片', category: '页面', url: '#music', icon: '🎵' },
        { title: '精选学术与工程导航 · 顶级科研资源', category: '页面', url: '#links', icon: '🔗' },
        { title: '工具站 · 翻译/写作/编程全能合集', category: '页面', url: 'tools/', icon: '🛠️' },
        { title: '我的商店 · 生产力与服务咨询', category: '页面', url: 'store.html', icon: '🛒' },
        { title: '常见问题 · 购物与服务解答', category: '页面', url: 'faq.html', icon: '❓' },
        { title: '下载安卓版客户端 APK (无需谷歌框架 / 19KB 原生极速)', category: '客户端下载', url: 'lanmaospace.apk', icon: '📱' },
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

// ===== Academic Pomodoro Focus Widget Driver =====
(function initPomodoro() {
    const widget = document.getElementById('pomodoro-widget');
    const toggle = document.getElementById('pomodoro-toggle');
    const panel = document.getElementById('pomodoro-panel');
    const closeBtn = document.getElementById('pomodoro-close');
    const timerDisplay = document.getElementById('pomodoro-timer');
    const miniTimeDisplay = document.getElementById('pomodoro-mini-time');
    const statusDisplay = document.getElementById('pomodoro-status');
    const startBtn = document.getElementById('pomodoro-start');
    const resetBtn = document.getElementById('pomodoro-reset');
    const modeBtns = document.querySelectorAll('.pomodoro-mode-btn');

    if (!widget || !toggle || !panel || !timerDisplay) return;

    let totalSeconds = 1500;
    let remainingSeconds = 1500;
    let timerId = null;
    let isRunning = false;
    let currentMode = 'focus';

    function formatTime(sec) {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
    }

    function updateDisplay() {
        const str = formatTime(remainingSeconds);
        timerDisplay.textContent = str;
        if (miniTimeDisplay) miniTimeDisplay.textContent = str;
        if (isRunning) {
            document.title = '(' + str + ') 蓝昴空间 · 专注中';
        } else {
            document.title = 'Lanmao Space | 蓝昴空间';
        }
    }

    function playChime() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const now = ctx.currentTime;
            
            const osc1 = ctx.createOscillator();
            const gain1 = ctx.createGain();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(587.33, now);
            gain1.gain.setValueAtTime(0.15, now);
            gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
            osc1.connect(gain1);
            gain1.connect(ctx.destination);
            osc1.start(now);
            osc1.stop(now + 0.6);

            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(880, now + 0.2);
            gain2.gain.setValueAtTime(0.15, now + 0.2);
            gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.start(now + 0.2);
            osc2.stop(now + 1.2);
        } catch (_) {}
    }

    function tick() {
        if (remainingSeconds > 0) {
            remainingSeconds--;
            updateDisplay();
        } else {
            clearInterval(timerId);
            timerId = null;
            isRunning = false;
            startBtn.textContent = '开始专注';
            statusDisplay.textContent = currentMode === 'focus' ? '🎉 专注完成！休息 5 分钟吧' : '☕ 休息结束，准备好投入了吗？';
            playChime();
            updateDisplay();
        }
    }

    function startTimer() {
        if (isRunning) {
            clearInterval(timerId);
            timerId = null;
            isRunning = false;
            startBtn.textContent = '继续专注';
            statusDisplay.textContent = '已暂停，随时恢复';
        } else {
            isRunning = true;
            startBtn.textContent = '暂停';
            statusDisplay.textContent = currentMode === 'focus' ? '深度专注中，排除干扰' : '小憩一下，眺望远方';
            timerId = setInterval(tick, 1000);
        }
        updateDisplay();
    }

    function resetTimer() {
        clearInterval(timerId);
        timerId = null;
        isRunning = false;
        remainingSeconds = totalSeconds;
        startBtn.textContent = '开始专注';
        statusDisplay.textContent = currentMode === 'focus' ? '专注时间，保持独立思考' : '短暂小憩，放松身心';
        updateDisplay();
    }

    function setMode(seconds, modeName) {
        modeBtns.forEach(b => b.classList.toggle('active', Number(b.dataset.time) === seconds));
        currentMode = modeName;
        totalSeconds = seconds;
        resetTimer();
    }

    toggle.addEventListener('click', () => {
        const isHidden = panel.hidden;
        panel.hidden = !isHidden;
        toggle.setAttribute('aria-expanded', String(isHidden));
    });

    closeBtn.addEventListener('click', () => {
        panel.hidden = true;
        toggle.setAttribute('aria-expanded', 'false');
    });

    startBtn.addEventListener('click', startTimer);
    resetBtn.addEventListener('click', resetTimer);

    modeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const time = Number(btn.dataset.time);
            setMode(time, time === 1500 ? 'focus' : 'break');
        });
    });

    updateDisplay();
})();

// ===== Register PWA Service Worker =====
if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
}
