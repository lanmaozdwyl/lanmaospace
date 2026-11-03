// 桌面和手机入口共用，避免 html/body 主题不同导致文字和背景混色。
export function initTheme({root, body, button, storage, media}) {
    let choice;
    try { const saved = storage?.getItem('lanmao_theme'); if (['light', 'dark'].includes(saved)) choice = saved; } catch {}
    function apply(theme, save = false) {
        choice = ['light', 'dark'].includes(theme) ? theme : undefined;
        for (const element of [root, body]) {
            if (choice) element.dataset.theme = choice;
            else delete element.dataset.theme;
        }
        const dark = choice === 'dark' || (!choice && media.matches);
        if (button) {
            const label = dark ? '切换至亮色模式' : '切换至暗色模式';
            button.setAttribute('aria-label', label);
            button.title = label;
            button.innerHTML = dark ? '<span aria-hidden="true">☀️</span>' : '<span aria-hidden="true">🌙</span>';
        }
        if (save) { try { if (choice) storage?.setItem('lanmao_theme', choice); else storage?.removeItem('lanmao_theme'); } catch {} }
    }
    function toggle() { apply((choice || (media.matches ? 'dark' : 'light')) === 'dark' ? 'light' : 'dark', true); }
    button?.addEventListener('click', toggle);
    media.addEventListener('change', () => { if (!choice) apply(); });
    apply(choice);
    return {apply, toggle};
}
