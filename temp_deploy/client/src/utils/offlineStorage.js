import { openDB } from 'idb';

const DB_NAME = 'joa-offline-db';
const STORE_NAME = 'pending-activations';
const DRAFT_STORE = 'activation-drafts';
const FUSION_DRAFT_STORE = 'fusion-drafts';

export const initDB = async () => {
    return openDB(DB_NAME, 3, {
        upgrade(db, oldVersion) {
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
            }
            if (!db.objectStoreNames.contains(DRAFT_STORE)) {
                db.createObjectStore(DRAFT_STORE, { keyPath: 'appointmentId' });
            }
            if (!db.objectStoreNames.contains(FUSION_DRAFT_STORE)) {
                db.createObjectStore(FUSION_DRAFT_STORE, { keyPath: 'draftId' });
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

export const saveFusionDraft = async (draftId, data) => {
    const db = await initDB();
    return db.put(FUSION_DRAFT_STORE, {
        draftId,
        ...data,
        updatedAt: new Date().getTime()
    });
};

export const getFusionDraft = async (draftId) => {
    const db = await initDB();
    return db.get(FUSION_DRAFT_STORE, draftId);
};

export const deleteFusionDraft = async (draftId) => {
    const db = await initDB();
    return db.delete(FUSION_DRAFT_STORE, draftId);
};
