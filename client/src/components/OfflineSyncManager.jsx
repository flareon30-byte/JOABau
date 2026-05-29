import React, { useState, useEffect } from 'react';
import { getPendingActivations, deletePendingActivation } from '../utils/offlineStorage';
import api from '../api/axios';
import { CloudOff, RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react';

const OfflineSyncManager = ({ onSyncComplete }) => {
    const [pending, setPending] = useState([]);
    const [syncing, setSyncing] = useState(false);
    const [status, setStatus] = useState(''); // 'IDLE', 'SYNCING', 'SUCCESS', 'ERROR'

    const checkPending = async () => {
        const items = await getPendingActivations();
        setPending(items);
    };

    useEffect(() => {
        checkPending();
        // Check every minute if there are new items or if we are back online
        const interval = setInterval(checkPending, 60000);
        return () => clearInterval(interval);
    }, []);

    const handleSync = async () => {
        if (!navigator.onLine) {
            alert('Aún no tienes conexión a internet para sincronizar.');
            return;
        }

        setSyncing(true);
        setStatus('SYNCING');
        let successCount = 0;
        let errorCount = 0;

        for (const item of pending) {
            try {
                // 1. Generate PDF if signatures exist
                let pdfPath = null;
                if (item.signatures?.client || item.signatures?.tech) {
                    const user = JSON.parse(localStorage.getItem('user') || '{}');
                    const pdfRes = await api.post('/api/activations/generate-pdf', {
                        addressId: item.addressId,
                        clientName: item.formData.clientName || item.addressInfo?.clientName,
                        street: item.addressInfo?.street,
                        number: item.addressInfo?.number,
                        klsId: item.formData.klsId,
                        username: user.username,
                        clientSignature: item.signatures.client,
                        techSignature: item.signatures.tech,
                        description: item.formData.description
                    });
                    if (pdfRes.data.success) {
                        pdfPath = pdfRes.data.path;
                    }
                }

                // 2. Prepare Form Data
                const data = new FormData();
                Object.keys(item.formData).forEach(key => {
                    data.append(key, item.formData[key]);
                });

                if (pdfPath) data.append('pdfPath', pdfPath);

                // Add Photos
                item.photos.forEach((photo, idx) => {
                    if (photo.blob) {
                        data.append('photos', photo.blob, photo.name || `photo_${idx}.jpg`);
                    }
                });

                data.append('existingPhotos', JSON.stringify(item.existingPhotos || []));

                // 3. Submit Report
                await api.post(`/api/activations/report/${item.addressId}`, data, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });

                // 4. Delete from local DB
                await deletePendingActivation(item.id);
                successCount++;
            } catch (err) {
                console.error('Error syncing individual item:', err);
                errorCount++;
            }
        }

        setSyncing(false);
        if (errorCount === 0) {
            setStatus('SUCCESS');
            setTimeout(() => setStatus('IDLE'), 5000);
        } else {
            setStatus('ERROR');
        }

        checkPending();
        if (onSyncComplete) onSyncComplete();
    };

    if (pending.length === 0 && status !== 'SUCCESS') return null;

    return (
        <div className={`p-6 rounded-3xl border-2 transition-all ${
            status === 'SUCCESS' ? 'bg-green-50 border-green-200' : 
            status === 'ERROR' ? 'bg-red-50 border-red-200' :
            'bg-amber-50 border-amber-200 shadow-lg shadow-amber-200/20'
        }`}>
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-2xl ${
                        status === 'SUCCESS' ? 'bg-green-500 text-white' :
                        status === 'ERROR' ? 'bg-red-500 text-white' :
                        'bg-amber-500 text-white'
                    }`}>
                        {status === 'SUCCESS' ? <CheckCircle size={24} /> : 
                         status === 'ERROR' ? <AlertTriangle size={24} /> : 
                         <CloudOff size={24} />}
                    </div>
                    <div>
                        <h4 className={`font-bold ${
                            status === 'SUCCESS' ? 'text-green-800' : 
                            status === 'ERROR' ? 'text-red-800' : 
                            'text-amber-800'
                        }`}>
                            {status === 'SUCCESS' ? '¡Sincronización Completada!' :
                             status === 'ERROR' ? 'Error al sincronizar algunos trabajos' :
                             `Tienes ${pending.length} trabajos guardados offline`}
                        </h4>
                        <p className="text-xs opacity-75">
                            {status === 'SUCCESS' ? 'Todos tus informes están a salvo en la oficina.' :
                             status === 'ERROR' ? 'Comprueba tu conexión e inténtalo de nuevo.' :
                             'Pulsa el botón de abajo para subirlos al sistema ahora que tienes señal.'}
                        </p>
                    </div>
                </div>

                {pending.length > 0 && (
                    <button
                        onClick={handleSync}
                        disabled={syncing || !navigator.onLine}
                        className={`px-8 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-md active:scale-95 ${
                            syncing ? 'bg-slate-200 text-slate-500' :
                            !navigator.onLine ? 'bg-slate-100 text-slate-400 cursor-not-allowed' :
                            'bg-amber-500 text-white hover:bg-amber-600 shadow-amber-500/20'
                        }`}
                    >
                        <RefreshCw size={20} className={syncing ? 'animate-spin' : ''} />
                        {syncing ? 'Subiendo...' : 'Sincronizar ahora'}
                    </button>
                )}
            </div>
        </div>
    );
};

export default OfflineSyncManager;
