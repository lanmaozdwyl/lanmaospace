// Local origin storage is not a cloud backup. Never request persistence on page load.
export function summarizeEstimate(estimate = {}) {
    const valid = n => typeof n === 'number' && Number.isFinite(n) && n >= 0;
    const usage = valid(estimate.usage) ? estimate.usage : null;
    const quota = valid(estimate.quota) && estimate.quota > 0 ? estimate.quota : null;
    const percent = usage !== null && quota !== null ? Math.min(100, usage / quota * 100) : null;
    const mb = n => (n / 1048576).toFixed(1);
    return {
        text: `已用 ${usage === null ? '未知' : mb(usage) + ' MB'} / 配额 ${quota === null ? '未知' : mb(quota) + ' MB'}`,
        percent,
    };
}

export async function persistenceState(storage) {
    if (typeof storage?.persisted !== 'function') return 'unsupported';
    try {
        if (await storage.persisted()) return 'granted';
        return typeof storage.persist === 'function' ? 'available' : 'unsupported';
    } catch { return 'error'; }
}

export const PERSISTENCE_COPY = {
    granted: ['已获持久存储授权', '浏览器会降低本站数据被自动回收的风险。清除网站数据、卸载应用或更换设备仍可能丢失书籍，请定期导出备份。'],
    available: ['尚未申请持久存储', '可向浏览器申请降低自动回收风险；是否批准由浏览器决定，本功能不能替代备份。'],
    denied: ['本次申请未获批准', '浏览器未授予持久存储。书架仍可使用，请定期导出备份；稍后可以重试。'],
    unsupported: ['当前环境不支持查询或申请', '无法确认本环境的持久存储状态。书架仍可使用，请通过导出备份保护本地数据。'],
    error: ['检测或申请失败', '暂时无法确认持久存储状态，请稍后重试。不要清除浏览器数据，请先导出备份。'],
};

export function initStoragePanel({ document: doc, storage, getStats, exportBackup, importBackup }) {
    const el = id => doc.getElementById(id);
    const dialog = el('storage-guard-dialog');
    const trigger = el('shelf-btn-storage-guard');
    if (!dialog || !trigger) return;
    const status = el('storage-persist-badge');
    const description = el('storage-persist-desc');
    const request = el('storage-request-persist-btn');
    const usage = el('storage-usage-num');
    const bar = el('storage-usage-bar-fill');
    const feedback = el('storage-panel-feedback');
    let busy = false;
    let generation = 0;
    function render(kind) {
        const copy = PERSISTENCE_COPY[kind];
        status.textContent = copy[0];
        description.textContent = copy[1];
        request.hidden = kind === 'granted' || kind === 'unsupported' || typeof storage?.persist !== 'function';
        request.textContent = kind === 'denied' || kind === 'error' ? '重新申请持久存储' : '申请持久存储';
    }
    function close() {
        generation++;
        if (typeof dialog.close === 'function') dialog.close();
        else dialog.removeAttribute('open');
        dialog.hidden = true;
    }
    async function refresh(token) {
        let counts;
        try { counts = getStats(); } catch { counts = null; }
        for (const key of ['books', 'highlights', 'bookmarks']) {
            el('storage-meta-' + key).textContent = counts ? String(counts[key]) : '未知';
        }
        usage.textContent = '正在估算…';
        bar.style.width = '0%';
        const tasks = [persistenceState(storage).then(kind => {
            if (token === generation && !busy) render(kind);
        }), (async () => {
            try {
                if (typeof storage?.estimate !== 'function') throw new Error('unsupported');
                const estimate = summarizeEstimate(await storage.estimate());
                if (token !== generation) return;
                usage.textContent = estimate.text;
                bar.style.width = `${estimate.percent ?? 0}%`;
            } catch {
                if (token === generation) usage.textContent = '本环境暂时无法提供容量估算';
            }
        })()];
        await Promise.all(tasks);
    }
    trigger.addEventListener('click', () => {
        feedback.textContent = '';
        dialog.hidden = false;
        if (!dialog.open) {
            if (typeof dialog.showModal === 'function') dialog.showModal();
            else dialog.setAttribute('open', '');
        }
        void refresh(++generation);
    });
    el('storage-guard-close-btn').addEventListener('click', close);
    dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
    dialog.addEventListener('click', event => { if (event.target === dialog) close(); });
    request.addEventListener('click', async () => {
        if (busy || typeof storage?.persist !== 'function') return;
        busy = true;
        generation++; // Discard a slower initial status query.
        request.disabled = true;
        request.textContent = '正在申请…';
        try { render(await storage.persist() ? 'granted' : 'denied'); }
        catch { render('error'); }
        finally { busy = false; request.disabled = false; }
    });
    el('storage-dialog-btn-export').addEventListener('click', async () => {
        close(); // Downloads/toasts outside a modal must remain interactive.
        try { await exportBackup(); }
        catch {
            trigger.click();
            feedback.textContent = '导出未完成，请检查设备存储后重试。';
        }
    });
    const input = el('storage-backup-file-input');
    input.addEventListener('change', () => {
        const file = input.files?.[0];
        input.value = ''; // Allow selecting the same file again after failure.
        if (!file) return;
        close();
        importBackup(file); // Use the reader's existing validation and restore flow.
    });
}
