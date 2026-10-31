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

// ===== 留言板 =====
const messageForm = document.getElementById('messageForm');
const messagesList = document.getElementById('messagesList');

// 随机颜色
const avatarColors = [
    'linear-gradient(135deg, #667eea, #764ba2)',
    'linear-gradient(135deg, #f093fb, #f5576c)',
    'linear-gradient(135deg, #4facfe, #00f2fe)',
    'linear-gradient(135deg, #43e97b, #38f9d7)',
    'linear-gradient(135deg, #fa709a, #fee140)',
    'linear-gradient(135deg, #a18cd1, #fbc2eb)',
    'linear-gradient(135deg, #ffecd2, #fcb69f)',
];

const avatarEmojis = ['🐱', '🐶', '🐰', '🐼', '🦊', '🐸', '🦉', '🐝', '🦋', '🐳', '🐨', '🐯'];

messageForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const name = document.getElementById('name').value.trim();
    const message = document.getElementById('message').value.trim();

    if (!name || !message) return;

    const today = new Date().toISOString().slice(0, 10);
    const randomColor = avatarColors[Math.floor(Math.random() * avatarColors.length)];
    const randomEmoji = avatarEmojis[Math.floor(Math.random() * avatarEmojis.length)];

    const messageHTML = `
        <div class="message-item" style="animation: fadeIn 0.4s ease;">
            <div class="message-avatar" style="background: ${randomColor};">${randomEmoji}</div>
            <div class="message-content">
                <div class="message-header">
                    <span class="message-name">${escapeHtml(name)}</span>
                    <span class="message-time">${today}</span>
                </div>
                <p>${escapeHtml(message)}</p>
            </div>
        </div>
    `;

    messagesList.insertAdjacentHTML('afterbegin', messageHTML);

    // 清空表单
    messageForm.reset();

    // 提示
    showToast('留言成功！感谢你的留言 🎉');
});

// HTML转义
function escapeHtml(text) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// Toast 提示
function showToast(message) {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        bottom: 80px;
        left: 50%;
        transform: translateX(-50%) translateY(20px);
        background: var(--blue);
        color: white;
        padding: 12px 28px;
        border-radius: 100px;
        font-size: 0.9rem;
        box-shadow: 0 4px 20px rgba(74, 158, 125, 0.3);
        z-index: 10000;
        opacity: 0;
        transition: all 0.3s ease;
    `;
    toast.setAttribute('role', 'status');
    toast.textContent = message;
    document.body.appendChild(toast);

    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(-50%) translateY(0)';
    });

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(20px)';
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}
