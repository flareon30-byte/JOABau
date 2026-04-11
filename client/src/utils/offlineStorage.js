import { openDB } from 'idb';

const DB_NAME = 'joa-offline-db';
const STORE_NAME = 'pending-activations';

export const initDB = async () => {
    return openDB(DB_NAME, 1, {
        upgrade(db) {
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
            }
        },
    });
};

export const savePendingActivation = async (data) => {
    const db = await initDB();
    const id = await db.add(STORE_NAME, {
        ...data,
        timestamp: new Date().getTime(),
        status: 'PENDING'
    });
    return id;
};

export const getPendingActivations = async () => {
    const db = await initDB();
    return db.getAll(STORE_NAME);
};

export const deletePendingActivation = async (id) => {
    const db = await initDB();
    return db.delete(STORE_NAME, id);
};

export const clearPendingActivations = async () => {
    const db = await initDB();
    return db.clear(STORE_NAME);
};
