// ===== 导航与动效：优先使用合成动画，尊重系统减少动态效果设置 =====
const navbar = document.getElementById('navbar');
const navToggle = document.getElementById('nav-toggle');
const navLinks = document.getElementById('nav-links');
const sections = [...document.querySelectorAll('.section, .hero')].filter(section => !section.hidden);
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
    const stats = document.querySelector('.hero-stats');
    if (stats && !stats.hidden) statsObserver.observe(stats);
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

// 明暗主题由 mobile-nav.js 使用 lib/theme.mjs 统一管理。

// ===== Apple-Style Spotlight Search (Cmd/Ctrl + K) =====
(function initSpotlight() {
    const dialog = document.getElementById('spotlight-dialog');
    const input = document.getElementById('spotlight-input');
    const list = document.getElementById('spotlight-results');
    const trigger = document.getElementById('spotlight-trigger');

    if (!dialog || !input || !list) return;

    const searchIndex = [
        { title: '首页 · 蓝昴空间', category: '页面', url: '#home', icon: '🏠' },
        { title: '阅读器 · 打开书架与本地阅读', category: '阅读', url: 'reader.html', icon: '📖' },
        { title: '自然声音 · 溪流/小雨/中雨/大雨/木鱼/钟声/海浪/鸟鸣', category: '伴读', url: '#ambient', icon: '🎧' },
        { title: '专注钟 · 开始一段专注时间', category: '专注', url: '#focus', icon: '🍅' },
        { title: '成员空间 · 个人主页与动态', category: '个人', url: 'space.html', icon: '🪐' },
        { title: '店主备忘录 · 加密私人笔记', category: '个人', url: 'memo.html', icon: '📝' },
        { title: '账号安全 · 密码与登录管理', category: '个人', url: 'account.html', icon: '🛡️' },
        { title: '留言板 · 交流与反馈', category: '交流', url: '#contact', icon: '💬' },
        { title: '设置头像', category: '个人', url: 'profile.html', icon: '👤' },
        { title: '下载安卓客户端', category: '客户端', url: 'lanmaospace.apk', icon: '📱' },
    ];

    const closeButton = document.getElementById('spotlight-close');
    let returnFocus = null;
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
        selectedIndex = 0;
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
        if (dialog.open) return;
        const focused = document.activeElement;
        const mobileTrigger = document.querySelector('.mobile-dock button[aria-controls="mobile-menu"]');
        returnFocus = focused && focused !== document.body && !focused.closest('dialog') && focused.getClientRects().length
            ? focused : (mobileTrigger?.getClientRects().length ? mobileTrigger : trigger);
        dialog.showModal();
        input.value = '';
        search('');
        input.focus({preventScroll:true});
    }

    function closeSpotlight() {
        dialog.close();
    }

    closeButton?.addEventListener('click', closeSpotlight);
    dialog.addEventListener('close', () => {
        const target = returnFocus?.getClientRects().length ? returnFocus : trigger;
        target?.focus({preventScroll:true});
    });

    if (trigger) {
        trigger.addEventListener('click', openSpotlight);
    }

    document.addEventListener('keydown', e => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            if (dialog.open) closeSpotlight();
            else openSpotlight();
        } else if (dialog.open && e.target === input) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (currentResults.length > 0) {
                    selectedIndex = (selectedIndex + 1) % currentResults.length;
                    renderResults(currentResults);
                    list.querySelector('.spotlight-item.active')?.scrollIntoView({block:'nearest'});
                }
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (currentResults.length > 0) {
                    selectedIndex = (selectedIndex - 1 + currentResults.length) % currentResults.length;
                    renderResults(currentResults);
                    list.querySelector('.spotlight-item.active')?.scrollIntoView({block:'nearest'});
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
        if (e.target !== dialog) return;
        const box = dialog.getBoundingClientRect();
        if (e.clientX < box.left || e.clientX > box.right || e.clientY < box.top || e.clientY > box.bottom) closeSpotlight();
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




// 伴读声音独立维护在 ambient.js / lib/ambient.mjs。

// ===== Register PWA Service Worker =====
if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
}


// “我的”菜单保持原生 details 的键盘操作，并支持点外部/按 Esc 收起。
const accountMenu = document.getElementById('home-account');
document.addEventListener('click', event => {
    if (accountMenu?.open && (!accountMenu.contains(event.target) || event.target.closest('a'))) accountMenu.open = false;
});
document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && accountMenu?.open) {
        accountMenu.open = false;
        accountMenu.querySelector('summary').focus();
    }
});

// ===== 首页 QQ 一键快速复制与优雅降级 =====
(function initContactCopyQQ() {
    const copyBtn = document.getElementById('contact-copy-qq-btn');
    const feedback = document.getElementById('contact-qq-feedback');
    if (!copyBtn) return;

    copyBtn.addEventListener('click', async () => {
        const text = '3126477562';
        let ok = false;
        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(text);
                ok = true;
            }
        } catch (_) {}

        if (!ok && typeof document !== 'undefined') {
            try {
                const ta = document.createElement('textarea');
                ta.value = text;
                ta.style.position = 'fixed';
                ta.style.opacity = '0';
                document.body.appendChild(ta);
                ta.select?.();
                ok = document.execCommand?.('copy');
                document.body.removeChild(ta);
            } catch (_) {}
        }

        const labelEl = copyBtn.querySelector('.copy-label');
        if (labelEl) labelEl.textContent = '已复制';
        copyBtn.classList.add('copied');

        if (feedback) {
            feedback.hidden = false;
            feedback.textContent = '✨ QQ 号 (3126477562) 已复制到剪贴板！可打开 QQ 搜索添加。';
        }

        setTimeout(() => {
            if (labelEl) labelEl.textContent = '复制';
            copyBtn.classList.remove('copied');
            if (feedback) feedback.hidden = true;
        }, 3000);
    });
})();
