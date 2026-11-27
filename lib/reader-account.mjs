export const READER_PROGRESS_KEY = 'lanmao_reader_progress_v1';

export function readerAccountKey(key, userId) {
    if (typeof userId !== 'string' || !userId) throw new Error('Reader account required');
    return `${key}:account:${encodeURIComponent(userId)}`;
}

export function readerAccountStorage(storage, userId) {
    const key = name => readerAccountKey(name, userId);
    return {
        getItem: name => storage.getItem(key(name)),
        setItem: (name, value) => storage.setItem(key(name), value),
        removeItem: name => storage.removeItem(key(name)),
    };
}
