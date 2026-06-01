import React, { useState, useEffect } from 'react';
import { MapPin, CheckCircle, ChevronRight, Loader2, Navigation } from 'lucide-react';
import api from '../api/axios';

const CivilWorkerDashboard = () => {
    const [addresses, setAddresses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [gpsLoading, setGpsLoading] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        fetchAddresses();
    }, []);

    const fetchAddresses = async () => {
        try {
            const res = await api.get('/api/civil-works/map');
            setAddresses(res.data.addresses || []);
        } catch (e) {
            console.error('Error', e);
        } finally {
            setLoading(false);
        }
    };

    const handleCheckIn = () => {
        setGpsLoading(true);
        setMessage('');
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(async (pos) => {
                try {
                    await api.post('/api/civil-works/location', {
                        lat: pos.coords.latitude,
                        lng: pos.coords.longitude,
                        action: 'CHECK_IN'
                    });
                    setMessage('¡Ubicación registrada con éxito!');
                } catch (e) {
                    setMessage('Error al guardar ubicación.');
                }
                setGpsLoading(false);
                setTimeout(() => setMessage(''), 3000);
            }, () => {
                setMessage('Debes permitir el acceso a la ubicación.');
                setGpsLoading(false);
            }, { enableHighAccuracy: true });
        } else {
            setMessage('Geolocalización no soportada.');
            setGpsLoading(false);
        }
    };

    const updateStatus = async (id, newStatus) => {
        try {
            await api.post(`/api/civil-works/${id}`, { status: newStatus });
            fetchAddresses();
        } catch (e) {
            console.error('Error updating', e);
        }
    };

    if (loading) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-orange-500" size={40} /></div>;

    return (
        <div className="max-w-md mx-auto p-4 flex flex-col gap-6">
            <div className="bg-orange-600 rounded-3xl p-6 text-white shadow-xl shadow-orange-500/30 text-center relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-20"><Navigation size={100} /></div>
                <h2 className="text-2xl font-black relative z-10">Obra Civil</h2>
                <p className="opacity-80 text-sm mb-6 relative z-10">Panel de Operario</p>
                
                <button 
                    onClick={handleCheckIn}
                    disabled={gpsLoading}
                    className="relative z-10 w-full bg-white text-orange-600 font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-orange-50 transition active:scale-95"
                >
                    {gpsLoading ? <Loader2 className="animate-spin" /> : <MapPin />}
                    Fichar Ubicación Actual (GPS)
                </button>
                {message && <p className="mt-4 text-sm font-bold bg-black/20 p-2 rounded-lg">{message}</p>}
            </div>

            <div className="flex flex-col gap-3">
                <h3 className="font-bold text-slate-700 ml-2">Casas Asignadas</h3>
                {addresses.map(addr => (
                    <div key={addr.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-3">
                        <div className="flex justify-between items-start">
                            <div>
                                <h4 className="font-bold text-slate-800">{addr.street} {addr.number}</h4>
                                <p className="text-xs text-slate-500">{addr.city}</p>
                            </div>
                            <span className="text-[10px] font-bold px-2 py-1 rounded bg-slate-100 text-slate-600">
                                {addr.civilWorkStatus || 'PENDIENTE'}
                            </span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 mt-2">
                            <button 
                                onClick={() => updateStatus(addr.id, 'EN_PROGRESO')}
                                className="bg-amber-100 text-amber-700 py-2 rounded-lg text-xs font-bold"
                            >
                                Iniciar Zanja
                            </button>
                            <button 
                                onClick={() => updateStatus(addr.id, 'CERRADO')}
                                className="bg-emerald-100 text-emerald-700 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1"
                            >
                                <CheckCircle size={14} /> Finalizar
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default CivilWorkerDashboard;
