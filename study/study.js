import {getSupabase} from '../lib/supabase-client.js';
import {dayAt} from '../lib/focus.mjs';

const form = document.getElementById('study-form');
const fields = document.getElementById('study-fields');
const status = document.getElementById('study-status');
const previousNext = document.getElementById('study-previous-next');
const conflict = document.getElementById('study-conflict');
const useSaved = document.getElementById('study-use-saved');
const history = document.getElementById('study-history');
const historyDay = document.getElementById('study-history-day');
const limits = {goal: 120, review: 600, next: 120};
const names = Object.keys(limits);
const labels = {goal: '今日目标', review: '复盘', next: '下次起点'};

async function initStudyNotes() {
    let client;
    let userId;
    try {
        client = await getSupabase();
        const {data, error} = await client.auth.getSession();
        if (error || !data?.session?.user?.id) throw error || new Error('No session');
        userId = data.session.user.id;
    } catch {
        status.textContent = '登录后可填写和保存学习记录。';
        return;
    }

    let day = dayAt(Date.now());
    let dirty = false;
    let busy = false;
    let baseline;
    let conflictingNames = [];
    const prefix = `lanmao_study_notes_v1_${userId}_`;
    function read(date) {
        const raw = JSON.parse(localStorage.getItem(prefix + date)) ?? {};
        return Object.fromEntries(names.map(name => [name, typeof raw[name] === 'string' ? raw[name].slice(0, limits[name]) : '']));
    }
    function fill(record) {
        for (const name of names) form.elements[name].value = record[name];
        baseline = record;
        dirty = false;
        conflictingNames = [];
        conflict.hidden = useSaved.hidden = true;
        conflict.textContent = '';
    }
    function showHistory() {
        try {
            const record = read(historyDay.value);
            for (const name of names) document.getElementById('study-history-' + name).textContent = record[name] || '未填写';
        } catch {
            for (const name of names) document.getElementById('study-history-' + name).textContent = '无法读取';
        }
    }
    function refreshHistory() {
        const dates = [];
        previousNext.hidden = true;
        history.hidden = true;
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key?.startsWith(prefix)) continue;
            const date = key.slice(prefix.length);
            if (/^\d{4}-\d{2}-\d{2}$/.test(date) && date < day) dates.push(date);
        }
        dates.sort((a, b) => b.localeCompare(a));
        const selected = historyDay.value;
        historyDay.replaceChildren();
        for (const date of dates) {
            const option = document.createElement('option');
            option.value = option.textContent = date;
            historyDay.append(option);
        }
        if (!dates.length) return;
        historyDay.value = dates.includes(selected) ? selected : dates[0];
        history.hidden = false;
        showHistory();
        const next = read(dates[0]).next;
        if (next) {
            previousNext.textContent = `${dates[0]} 留下的下一步\n${next}`;
            previousNext.hidden = false;
        }
    }
    function load() {
        try {
            fill(read(day));
            refreshHistory();
            status.textContent = `${day} · 记录仅在此浏览器保存`;
        } catch {
            status.textContent = '暂时无法读取本机记录。';
        }
    }
    function syncStudyDay() {
        const today = dayAt(Date.now());
        if (today === day || dirty || busy || fields.disabled) return false;
        day = today;
        load();
        return true;
    }
    load();
    fields.disabled = false;
    historyDay.addEventListener('change', showHistory);
    useSaved.addEventListener('click', () => {
        try {
            const latest = read(day);
            for (const name of conflictingNames) {
                form.elements[name].value = latest[name];
                baseline[name] = latest[name];
            }
            conflictingNames = [];
            conflict.hidden = useSaved.hidden = true;
            dirty = names.some(name => form.elements[name].value.trim() !== baseline[name]);
            status.textContent = dirty ? '已采用冲突项的保存版本，其余修改可以继续保存。' : '已采用保存版本。';
        } catch {
            status.textContent = '无法读取已保存内容，本页草稿仍在。';
        }
    });

    form.addEventListener('beforeinput', syncStudyDay);
    form.addEventListener('input', event => {
        // Some input methods send only input. Keep the new field value if a day changes here.
        const target = event.target;
        const value = target?.value;
        if (syncStudyDay() && names.includes(target?.name)) target.value = value;
        dirty = true;
        status.textContent = day === dayAt(Date.now()) ? '有未保存的修改。' : `正在编辑 ${day} 的草稿，保存后将切换到今天。`;
    });
    form.addEventListener('submit', async event => {
        event.preventDefault();
        if (fields.disabled || busy || !baseline) return;
        syncStudyDay();
        busy = true;
        const key = prefix + day;
        let savedDay = '';
        function save() {
            if (fields.disabled) return;
            const latest = read(day);
            const changes = names.filter(name => form.elements[name].value.trim() !== baseline[name]);
            const collisions = changes.filter(name => latest[name] !== baseline[name] &&
                latest[name] !== form.elements[name].value.trim());
            if (collisions.length) {
                dirty = true;
                conflictingNames = collisions;
                status.textContent = '同一项已在其他标签页更新。本页草稿仍在。';
                conflict.textContent = collisions.map(name => `${labels[name]}已保存的内容：${latest[name] || '（空）'}`).join('\n');
                conflict.hidden = useSaved.hidden = false;
                return;
            }
            for (const name of changes) latest[name] = form.elements[name].value.trim().slice(0, limits[name]);
            localStorage.setItem(key, JSON.stringify(latest));
            fill(latest);
            savedDay = day;
            status.textContent = `已保存 ${day} 的学习记录。`;
        }
        try {
            if (navigator.locks) await navigator.locks.request(key, save);
            else save();
        } catch {
            status.textContent = '保存失败，当前输入仍在，请稍后重试。';
        } finally {
            busy = false;
            if (savedDay && syncStudyDay()) status.textContent = `已保存 ${savedDay} 的学习记录，已切换至 ${day}。`;
        }
    });
    window.addEventListener('focus', () => {
        if (dirty || busy || fields.disabled) return;
        if (!syncStudyDay()) load();
    });

    client.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT' || (session?.user?.id && session.user.id !== userId)) {
            fields.disabled = true;
            form.reset();
            previousNext.hidden = conflict.hidden = history.hidden = useSaved.hidden = true;
            previousNext.textContent = conflict.textContent = '';
            historyDay.replaceChildren();
            for (const name of names) document.getElementById('study-history-' + name).textContent = '';
            status.textContent = '登录状态已变化，请重新打开学习页。';
        }
    });
}

initStudyNotes();
