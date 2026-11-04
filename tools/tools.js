// 工具站筛选：分类按钮 + 搜索框 + 全键盘操控。没有匹配时隐藏整个分类，显示空状态。
// 快捷键：数字 1~9 切换分类（按按钮顺序，超出范围忽略）、/ 聚焦搜索、Esc 清空搜索或退出搜索焦点。
// 纯前端过滤，不改卡片本身；内容不可用时也不影响页面打开。不使用内联脚本或 eval，符合站点 CSP。
(function () {
    var filterBtns = Array.prototype.slice.call(document.querySelectorAll('.tools-filters .filter-btn'));
    var cards = Array.prototype.slice.call(document.querySelectorAll('.tool-card'));
    var groups = Array.prototype.slice.call(document.querySelectorAll('.tools-category'));
    var search = document.getElementById('tools-search');
    var empty = document.getElementById('tools-empty');
    var requestedFilter = new URLSearchParams(window.location.search).get('category');
    var activeFilter = filterBtns.some(function (btn) { return btn.dataset.filter === requestedFilter; }) ? requestedFilter : 'all';

    function applyFilter() {
        var query = search.value.trim().toLowerCase();
        var visibleCount = 0;
        cards.forEach(function (card) {
            var matchCategory = activeFilter === 'all' || card.dataset.category === activeFilter;
            var haystack = (card.dataset.name + ' ' + card.textContent).toLowerCase();
            var matchQuery = !query || haystack.indexOf(query) !== -1;
            var visible = matchCategory && matchQuery;
            card.classList.toggle('hidden', !visible);
            if (visible) visibleCount += 1;
        });
        groups.forEach(function (group) {
            var anyVisible = group.querySelectorAll('.tool-card:not(.hidden)').length > 0;
            group.classList.toggle('hidden', !anyVisible);
        });
        empty.hidden = visibleCount > 0;
    }

    function setFilter(btn) {
        activeFilter = btn.dataset.filter;
        filterBtns.forEach(function (b) {
            var active = b === btn;
            b.classList.toggle('active', active);
            b.setAttribute('aria-pressed', String(active));
        });
        applyFilter();
    }

    // 键盘切换时给目标按钮一个短暂的高亮动画（样式在 tools.css，减少动效偏好下会关闭）
    function flash(btn) {
        btn.classList.toggle('key-flash', false);
        btn.classList.toggle('key-flash', true);
        if (typeof setTimeout === 'function') {
            setTimeout(function () { btn.classList.toggle('key-flash', false); }, 650);
        }
    }

    function isTypingTarget(el) {
        if (!el) return false;
        var tag = String(el.tagName || '').toUpperCase();
        return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable === true;
    }

    filterBtns.forEach(function (btn) {
        btn.addEventListener('click', function () { setFilter(btn); });
    });

    filterBtns.forEach(function (btn) {
        var active = btn.dataset.filter === activeFilter;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-pressed', String(active));
    });
    applyFilter();
    search.addEventListener('input', applyFilter);

    document.addEventListener('keydown', function (e) {
        // 输入法组字、带修饰键的系统/浏览器快捷键、已被别处处理的事件，一律不介入
        if (e.defaultPrevented || e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return;
        var typing = isTypingTarget(e.target);

        if (e.key === 'Escape') {
            if (typing && e.target !== search) return;
            if (search.value) {
                e.preventDefault();
                search.value = '';
                applyFilter();
            } else if (e.target === search) {
                search.blur();
            }
            return;
        }

        // 正在打字：数字键和斜杠都必须原样输入
        if (typing) return;

        if (e.key === '/') {
            e.preventDefault();
            search.focus();
            return;
        }

        if (/^[1-9]$/.test(e.key)) {
            var btn = filterBtns[Number(e.key) - 1];
            if (!btn) return;
            e.preventDefault();
            setFilter(btn);
            flash(btn);
        }
    });
})();
