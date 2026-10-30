// ===== 导航栏滚动效果 =====
const navbar = document.getElementById('navbar');
const navToggle = document.getElementById('nav-toggle');
const navLinks = document.getElementById('nav-links');
const sections = document.querySelectorAll('.section, .hero');
const navLinkElements = document.querySelectorAll('.nav-link');

// 滚动时添加导航栏阴影
window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }

    // 高亮当前导航
    let current = '';
    sections.forEach(section => {
        const sectionTop = section.offsetTop - 100;
        if (window.scrollY >= sectionTop) {
            current = section.getAttribute('id');
        }
    });

    navLinkElements.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === '#' + current) {
            link.classList.add('active');
        }
    });
});

// 移动端汉堡菜单
navToggle.addEventListener('click', () => {
    navToggle.classList.toggle('open');
    navLinks.classList.toggle('open');
});

// 点击导航链接后关闭菜单
navLinkElements.forEach(link => {
    link.addEventListener('click', () => {
        navToggle.classList.remove('open');
        navLinks.classList.remove('open');
    });
});

// ===== 问候语 =====
function setGreeting() {
    const hour = new Date().getHours();
    const greetingEl = document.getElementById('greeting');
    if (hour < 6) {
        greetingEl.textContent = '夜深了';
    } else if (hour < 12) {
        greetingEl.textContent = '早上好';
    } else if (hour < 14) {
        greetingEl.textContent = '中午好';
    } else if (hour < 18) {
        greetingEl.textContent = '下午好';
    } else {
        greetingEl.textContent = '晚上好';
    }
}
setGreeting();

// ===== 数字递增动画 =====
function animateCounters() {
    const counters = document.querySelectorAll('.stat-number');
    counters.forEach(counter => {
        const target = parseInt(counter.getAttribute('data-target'));
        const duration = 2000;
        const step = target / (duration / 16);
        let current = 0;

        const timer = setInterval(() => {
            current += step;
            if (current >= target) {
                counter.textContent = target;
                clearInterval(timer);
            } else {
                counter.textContent = Math.floor(current);
            }
        }, 16);
    });
}

// 使用 IntersectionObserver 触发计数器动画
const heroObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            animateCounters();
            heroObserver.disconnect();
        }
    });
}, { threshold: 0.5 });

const heroStats = document.querySelector('.hero-stats');
if (heroStats) {
    heroObserver.observe(heroStats);
}

// ===== 滚动显示动画 =====
const revealElements = document.querySelectorAll('.section-header, .book-card, .song-card, .movie-card, .friend-card, .tool-card, .contact-wrapper, .friend-apply');

const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry, index) => {
        if (entry.isIntersecting) {
            setTimeout(() => {
                entry.target.classList.add('visible');
            }, index * 50);
            revealObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

revealElements.forEach(el => {
    el.classList.add('reveal');
    revealObserver.observe(el);
});

// ===== 书单筛选 =====
const filterBtns = document.querySelectorAll('.filter-btn');
const bookCards = document.querySelectorAll('.book-card');

filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const filter = btn.getAttribute('data-filter');

        bookCards.forEach(card => {
            if (filter === 'all' || card.getAttribute('data-category') === filter) {
                card.classList.remove('hidden');
                card.style.animation = 'fadeIn 0.4s ease forwards';
            } else {
                card.classList.add('hidden');
            }
        });
    });
});

// ===== 音乐影视Tab切换 =====
const mediaTabs = document.querySelectorAll('.media-tab');
const mediaContents = document.querySelectorAll('.media-content');

mediaTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        mediaTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        const targetId = tab.getAttribute('data-tab');
        mediaContents.forEach(content => {
            content.classList.remove('active');
            if (content.id === targetId) {
                content.classList.add('active');
            }
        });
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
        background: var(--primary);
        color: white;
        padding: 12px 28px;
        border-radius: 100px;
        font-size: 0.9rem;
        box-shadow: 0 4px 20px rgba(74, 158, 125, 0.3);
        z-index: 10000;
        opacity: 0;
        transition: all 0.3s ease;
    `;
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

// ===== 回到顶部 =====
const backToTop = document.getElementById('backToTop');

window.addEventListener('scroll', () => {
    if (window.scrollY > 400) {
        backToTop.classList.add('visible');
    } else {
        backToTop.classList.remove('visible');
    }
});

backToTop.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ===== 页面加载动画 =====
document.addEventListener('DOMContentLoaded', () => {
    document.body.style.opacity = '0';
    requestAnimationFrame(() => {
        document.body.style.transition = 'opacity 0.6s ease';
        document.body.style.opacity = '1';
    });
});
