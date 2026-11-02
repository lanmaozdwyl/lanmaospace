// 工具站筛选：分类按钮 + 搜索框。没有匹配时隐藏整个分类，显示空状态。
// 纯前端过滤，不改卡片本身；内容不可用时也不影响页面打开。
(function () {
    var filterBtns = Array.prototype.slice.call(document.querySelectorAll(".tools-filters .filter-btn"));
    var cards = Array.prototype.slice.call(document.querySelectorAll(".tool-card"));
    var groups = Array.prototype.slice.call(document.querySelectorAll(".tools-category"));
    var search = document.getElementById("tools-search");
    var empty = document.getElementById("tools-empty");
    var requestedFilter = new URLSearchParams(window.location.search).get("category");
    var activeFilter = filterBtns.some(function (btn) { return btn.dataset.filter === requestedFilter; }) ? requestedFilter : "all";

    function applyFilter() {
        var query = search.value.trim().toLowerCase();
        var visibleCount = 0;
        cards.forEach(function (card) {
            var matchCategory = activeFilter === "all" || card.dataset.category === activeFilter;
            var haystack = (card.dataset.name + " " + card.textContent).toLowerCase();
            var matchQuery = !query || haystack.indexOf(query) !== -1;
            var visible = matchCategory && matchQuery;
            card.classList.toggle("hidden", !visible);
            if (visible) visibleCount += 1;
        });
        groups.forEach(function (group) {
            var anyVisible = group.querySelectorAll(".tool-card:not(.hidden)").length > 0;
            group.classList.toggle("hidden", !anyVisible);
        });
        empty.hidden = visibleCount > 0;
    }

    filterBtns.forEach(function (btn) {
        btn.addEventListener("click", function () {
            activeFilter = btn.dataset.filter;
            filterBtns.forEach(function (b) {
                var active = b === btn;
                b.classList.toggle("active", active);
                b.setAttribute("aria-pressed", String(active));
            });
            applyFilter();
        });
    });

    filterBtns.forEach(function (btn) {
        var active = btn.dataset.filter === activeFilter;
        btn.classList.toggle("active", active);
        btn.setAttribute("aria-pressed", String(active));
    });
    applyFilter();
    search.addEventListener("input", applyFilter);
})();
