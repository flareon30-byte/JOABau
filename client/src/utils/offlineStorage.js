import { openDB } from 'idb';

const DB_NAME = 'joa-offline-db';
const STORE_NAME = 'pending-activations';
const DRAFT_STORE = 'activation-drafts';

export const initDB = async () => {
    return openDB(DB_NAME, 2, {
        upgrade(db, oldVersion) {
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
            }
            if (!db.objectStoreNames.contains(DRAFT_STORE)) {
                db.createObjectStore(DRAFT_STORE, { keyPath: 'appointmentId' });
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

export const saveActivationDraft = async (appointmentId, data) => {
    const db = await initDB();
    return db.put(DRAFT_STORE, {
        appointmentId,
        ...data,
        updatedAt: new Date().getTime()
    });
};

export const getActivationDraft = async (appointmentId) => {
    const db = await initDB();
    return db.get(DRAFT_STORE, appointmentId);
};

export const deleteActivationDraft = async (appointmentId) => {
    const db = await initDB();
    return db.delete(DRAFT_STORE, appointmentId);
};
