import {getSupabase} from '../lib/supabase-client.js';
import {dayAt} from '../lib/focus.mjs';

const form = document.getElementById('study-form');
const fields = document.getElementById('study-fields');
const status = document.getElementById('study-status');
const limits = {goal: 120, review: 600, next: 120};

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
    function storageKey() { return `lanmao_study_notes_v1_${userId}_${day}`; }
    function load() {
        try {
            const record = JSON.parse(localStorage.getItem(storageKey())) ?? {};
            for (const [name, limit] of Object.entries(limits)) {
                form.elements[name].value = typeof record[name] === 'string' ? record[name].slice(0, limit) : '';
            }
            status.textContent = `${day} · 记录仅在此浏览器保存`;
        } catch {
            status.textContent = '暂时无法读取本机记录。';
        }
    }
    load();
    fields.disabled = false;

    form.addEventListener('input', () => {
        if (dirty) return;
        dirty = true;
        status.textContent = '有未保存的修改。';
    });
    form.addEventListener('submit', event => {
        event.preventDefault();
        if (fields.disabled) return;
        const values = Object.fromEntries(Object.entries(limits).map(([name, limit]) => [
            name, form.elements[name].value.trim().slice(0, limit),
        ]));
        try {
            localStorage.setItem(storageKey(), JSON.stringify(values));
            dirty = false;
            status.textContent = `已保存 ${day} 的学习记录。`;
        } catch {
            status.textContent = '保存失败，当前输入仍在，请稍后重试。';
        }
    });
    window.addEventListener('focus', () => {
        if (dirty || fields.disabled) return;
        day = dayAt(Date.now());
        load();
    });

    client.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT' || (session?.user?.id && session.user.id !== userId)) {
            fields.disabled = true;
            form.reset();
            status.textContent = '登录状态已变化，请重新打开学习页。';
        }
    });
}

initStudyNotes();
