import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { Calendar, CheckCircle, Clock, TrendingUp, Users, MapPin, DollarSign, Star, AlertCircle, X, Target, Camera, Trash2, Navigation, Calculator, Truck, Percent, Wallet } from 'lucide-react';
import OfflineSyncManager from '../components/OfflineSyncManager';

const StatCard = ({ title, value, icon: Icon, colorClass, subtext, onClick }) => (
    <div 
        onClick={onClick}
        className={`glass-panel p-7 rounded-[2rem] transition-all duration-500 group border-b-[3px] border-b-transparent hover:border-b-joa-cyan shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_50px_rgba(0,210,255,0.1)] relative overflow-hidden ${onClick ? 'cursor-pointer hover:-translate-y-1' : ''}`}
    >
        {/* Subtle background glow */}
        <div className={`absolute top-0 right-0 w-32 h-32 ${colorClass.replace('text-', 'bg-')} opacity-[0.03] rounded-full blur-3xl -mr-10 -mt-10 group-hover:opacity-10 transition-opacity`}></div>
        
        <div className="flex items-start justify-between relative z-10">
            <div>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2 font-heading">{title}</p>
                <h3 className="text-4xl font-heading font-black text-slate-800 transition-colors bg-clip-text group-hover:bg-gradient-to-r group-hover:from-joa-blue group-hover:to-joa-cyan group-hover:text-transparent">
                    {value}
                </h3>
                {subtext && <p className="text-[11px] text-slate-400 mt-3 font-medium bg-slate-50 py-1 px-3 rounded-full inline-block border border-slate-100">{subtext}</p>}
            </div>
            <div className={`p-4 rounded-2xl ${colorClass} bg-opacity-[0.08] group-hover:scale-110 group-hover:-rotate-3 transition-all duration-500 relative`}>
                <div className={`absolute inset-0 rounded-2xl ${colorClass.replace('text-', 'bg-')} opacity-20 blur-md group-hover:opacity-40 transition-opacity`}></div>
                <Icon className={`w-8 h-8 relative z-10 ${colorClass.replace('bg-', 'text-')} drop-shadow-sm`} />
            </div>
        </div>
    </div>
);

const AppointmentModal = ({ appointment, onClose, onUpdate, navigate }) => {
    const [reciteReason, setReciteReason] = useState('');
    const [isReciting, setIsReciting] = useState(false);
    const [loading, setLoading] = useState(false);
    const [photos, setPhotos] = useState([]);

    if (!appointment) return null;

    const handlePhotoSelect = (e) => {
        if (e.target.files) {
            const newPhotos = Array.from(e.target.files).map(file => ({
                file,
                preview: URL.createObjectURL(file)
            }));
            setPhotos(prev => [...prev, ...newPhotos]);
        }
    };

    const removePhoto = (index) => {
        setPhotos(prev => {
            const newPhotos = [...prev];
            URL.revokeObjectURL(newPhotos[index].preview);
            newPhotos.splice(index, 1);
            return newPhotos;
        });
    };

    const openMap = (type) => {
        if (!appointment) return;
        const query = encodeURIComponent(`${appointment.address.street} ${appointment.address.number || ''}, ${appointment.address.city || ''}`);
        if (type === 'waze') {
            window.open(`https://waze.com/ul?q=${query}`, '_blank');
        } else {
            window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
        }
    };

    const handleRecite = async () => {
        if (!reciteReason) return alert('Por favor, indica el motivo.');
        setLoading(true);
        try {
            const formData = new FormData();
            formData.append('reason', reciteReason);
            photos.forEach(p => {
                formData.append('photos', p.file);
            });

            await api.post(`/api/appointments/${appointment.id}/recite`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (onUpdate) onUpdate();
            onClose();
        } catch (error) {
            console.error(error);
            alert('Error al solicitar recita');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
                    <X size={24} />
                </button>
                <div className="flex justify-between items-start mb-1 pr-8">
                    <h3 className="text-xl font-bold text-slate-800">
                        {isReciting ? 'Solicitar Recita o Derivar' : `${appointment.address.street} ${appointment.address.number}`}
                    </h3>
                </div>
                <div className="flex justify-between items-center mb-6">
                    <p className="text-slate-500 text-sm">{appointment.address.project.name}</p>
                    {!isReciting && (
                        <div className="flex gap-2">
                            <button onClick={() => openMap('gmaps')} className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 text-xs font-bold transition-colors" title="Abrir en Google Maps">
                                <MapPin size={14} /> Maps
                            </button>
                            <button onClick={() => openMap('waze')} className="flex items-center gap-1 px-3 py-1.5 bg-sky-50 text-sky-600 rounded-lg hover:bg-sky-100 text-xs font-bold transition-colors" title="Abrir en Waze">
                                <Navigation size={14} /> Waze
                            </button>
                        </div>
                    )}
                </div>

                {isReciting ? (
                    <div className="space-y-4">
                        <p className="text-sm text-slate-600">Por favor, explica detalladamente el motivo. Esto enviará una notificación al Back Office y cambiará el estado.</p>
                        <textarea
                            value={reciteReason}
                            onChange={(e) => setReciteReason(e.target.value)}
                            placeholder="Motivo (ej: Cliente no está, 3 familias en vez de 1, etc.)..."
                            className="w-full border border-slate-300 rounded-lg p-3 h-24 focus:ring-2 focus:ring-joa-blue outline-none resize-none"
                        />

                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-sm font-bold text-slate-700">Fotos (Opcional)</label>
                                <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors">
                                    <Camera size={16} /> Añadir
                                    <input type="file" multiple accept="image/*" className="hidden" onChange={handlePhotoSelect} />
                                </label>
                            </div>

                            {photos.length > 0 && (
                                <div className="grid grid-cols-4 gap-2 mt-3">
                                    {photos.map((photo, idx) => (
                                        <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-slate-200 group">
                                            <img src={photo.preview} alt={`Preview ${idx}`} className="w-full h-full object-cover" />
                                            <button
                                                type="button"
                                                onClick={() => removePhoto(idx)}
                                                className="absolute top-1 right-1 bg-white/90 p-1 rounded-md text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setIsReciting(false)}
                                className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleRecite}
                                disabled={loading}
                                className="flex-1 py-3 rounded-xl bg-orange-500 text-white font-bold hover:bg-orange-600 disabled:opacity-50"
                            >
                                {loading ? 'Enviando...' : 'Confirmar'}
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="space-y-4">
                            <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 flex justify-between items-center">
                                <div>
                                    <p className="text-[10px] font-black text-purple-400 uppercase tracking-widest mb-1">Identificador NVT</p>
                                    <p className="font-black text-purple-700 text-xl leading-none">
                                        {appointment.address.nvt || 'Sin asignar'}
                                    </p>
                                </div>
                                <div className="bg-purple-600 p-2 rounded-lg text-white">
                                    <Target size={16} />
                                </div>
                            </div>
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Cliente</p>
                                <p className="font-medium text-slate-800 text-lg">{appointment.clientName || 'No especificado'}</p>
                            </div>
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Apartamentos</p>
                                <p className="font-medium text-slate-800 text-lg">{appointment.apartmentCount || 'No especificado'}</p>
                            </div>
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Fecha Programada</p>
                                <p className="font-medium text-slate-800 text-lg">
                                    {new Date(appointment.assignedDate).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                                </p>
                            </div>
                            {appointment.orientationComment && (
                                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                                    <p className="text-xs font-bold text-blue-500 uppercase tracking-wider mb-1">Nota del Back Office</p>
                                    <p className="font-medium text-blue-900 text-lg whitespace-pre-wrap">{appointment.orientationComment}</p>
                                </div>
                            )}
                        </div>

                        <div className="mt-6 flex gap-3">
                            {appointment.status !== 'COMPLETADO' && (
                                <button
                                    onClick={() => setIsReciting(true)}
                                    className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-colors"
                                >
                                    Recitar o Derivar
                                </button>
                            )}
                            <button
                                onClick={() => {
                                    if (appointment.type === 'REPAIR') {
                                        navigate(`/repair/${appointment.id}/complete`);
                                    } else {
                                        navigate(`/activation/${appointment.id}/complete`);
                                    }
                                }}
                                className={`flex-1 py-3 rounded-xl font-bold transition-colors shadow-lg ${appointment.status === 'COMPLETADO'
                                    ? 'bg-green-600 hover:bg-green-700 text-white shadow-green-200'
                                    : 'bg-joa-blue hover:bg-blue-700 text-white shadow-blue-200'
                                    }`}
                            >
                                {appointment.status === 'COMPLETADO' ? 'Modificar' : (appointment.type === 'REPAIR' ? 'Cerrar Avería' : 'Cerrar Activación')}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

const DietaModal = ({ onLogged, onClose }) => {
    const [submitting, setSubmitting] = useState(false);

    const handleLog = async (type) => {
        setSubmitting(true);
        try {
            await api.post('/api/dietas/log', { type });
            onLogged();
        } catch (error) {
            console.error('Error logging diet:', error);
            alert('Error al registrar la dieta');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-md flex items-center justify-center z-[9999] p-4">
            <div className="bg-white rounded-3xl w-full max-w-sm p-8 shadow-2xl text-center border-4 border-joa-blue relative">
                <button 
                    onClick={onClose}
                    className="absolute top-4 right-4 text-slate-400 hover:text-slate-800 transition-colors"
                >
                    <X size={24} />
                </button>
                <div className="w-16 h-16 bg-joa-blue/10 text-joa-blue rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <Wallet size={32} />
                </div>
                <h3 className="text-2xl font-bold text-slate-800 mb-2">Registro de Dieta</h3>
                <p className="text-slate-500 mb-8 px-2 text-sm italic">Opcional: Si hoy estás enfermo o no trabajas, puedes cerrar esta ventana con la (X).</p>
                <p className="text-slate-500 mb-8 font-medium">¿Dónde duermes hoy?</p>

                <div className="space-y-4">
                    <button
                        onClick={() => handleLog('HOTEL')}
                        disabled={submitting}
                        className="w-full py-4 bg-joa-blue text-white rounded-2xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all flex items-center justify-center gap-3 active:scale-95"
                    >
                        <Truck size={20} />
                        Duermo en Hotel (28€)
                    </button>
                    <button
                        onClick={() => handleLog('CASA')}
                        disabled={submitting}
                        className="w-full py-4 bg-slate-100 text-slate-700 rounded-2xl font-bold hover:bg-slate-200 transition-all flex items-center justify-center gap-3 active:scale-95"
                    >
                        <Navigation size={20} />
                        Duermo en Casa (14€)
                    </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-6 uppercase tracking-widest font-bold font-sans">Joa Technologien System</p>
            </div>
        </div>
    );
};

const DashboardHome = () => {
    const navigate = useNavigate();
    const [stats, setStats] = useState({
        pendingAppointments: 0,
    });
    const [activatorData, setActivatorData] = useState(null);
    const [payroll, setPayroll] = useState([]);
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedAppointment, setSelectedAppointment] = useState(null);
    const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'completed'
    const [searchQuery, setSearchQuery] = useState('');
    const [dateFilter, setDateFilter] = useState('today');
    const [showDietaPrompt, setShowDietaPrompt] = useState(false);
    
    const money = (val) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(val || 0);

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const isActivator = ['ACTIVATOR', 'BLOWER', 'PROTOCOL_MANAGER'].includes(user.role);
    const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(user.role);

    console.log("Rendering DashboardHome. showDietaPrompt:", showDietaPrompt);

    const fetchData = async () => {

        try {
            console.log("Checking dieta for user role:", user.role);
            // Check for daily dieta log
            if (isActivator) {
                const dietaRes = await api.get('/api/dietas/today').catch(() => ({ data: null }));
                console.log("Dieta data found:", dietaRes.data);
                if (!dietaRes.data?.onVacation && (!dietaRes.data || dietaRes.data === "")) {
                    setShowDietaPrompt(true);
                }
            }

            // Fetch clients for the dropdown
            const clientsRes = await api.get('/api/clients').catch(() => ({ data: [] }));
            setClients(clientsRes.data);

            if (isActivator) {
                if (navigator.onLine) {
                    try {
                        const res = await api.get('/api/dashboard/activator');
                        setActivatorData(res.data);
                        localStorage.setItem('cachedAgenda', JSON.stringify(res.data));
                    } catch (err) {
                        const cached = JSON.parse(localStorage.getItem('cachedAgenda') || 'null');
                        if (cached) setActivatorData(cached);
                    }
                } else {
                    const cached = JSON.parse(localStorage.getItem('cachedAgenda') || 'null');
                    if (cached) setActivatorData(cached);
                }
            } else {
                const statsRes = await api.get('/api/dashboard/stats');
                setStats(statsRes.data);

                if (isAdmin) {
                    const payrollRes = await api.get('/api/dashboard/payroll');
                    setPayroll(payrollRes.data); // Store the whole object { teams, technicians }
                }
            }
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };


    useEffect(() => {
        fetchData();
    }, [isActivator, isAdmin]);

    const [updatingClient, setUpdatingClient] = useState(false);

    const handleClientChange = async (e) => {
        const clientId = e.target.value;
        setUpdatingClient(true);
        try {
            const res = await api.put('/api/users/active-client', { activeClientCompanyId: clientId });
            // Update local storage user
            const updatedUser = { ...user, activeClientCompanyId: res.data.activeClientCompanyId, activeClientCompany: res.data.activeClientCompany };
            localStorage.setItem('user', JSON.stringify(updatedUser));
            window.location.reload(); // Reload to refresh contexts/dashboard
        } catch (err) {
            console.error('Error changing client:', err);
            alert('Error al cambiar de cliente activo');
        } finally {
            setUpdatingClient(false);
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-joa-blue"></div>
        </div>
    );

    // --- ACTIVATOR VIEW ---
    if (isActivator && activatorData) {

        const { stats, appointments } = activatorData;

        // Filter Appointments
        const filteredAppointments = appointments.filter(app => {
            const matchesSearch =
                app.address.street.toLowerCase().includes(searchQuery.toLowerCase()) ||
                app.address.project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (app.address.city && app.address.city.toLowerCase().includes(searchQuery.toLowerCase()));

            const isReported = ['COMPLETADO', 'RECITAR', 'CANCELADO'].includes(app.status);
            
            // Date Filtering for Pending
            let matchesDate = true;
            if (activeTab === 'pending' && !isReported && dateFilter !== 'all') {
                const appDate = new Date(app.assignedDate);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                appDate.setHours(0, 0, 0, 0);

                const diffTime = appDate.getTime() - today.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                if (dateFilter === 'today') {
                    matchesDate = diffDays === 0;
                } else if (dateFilter === 'tomorrow') {
                    matchesDate = diffDays === 1;
                } else if (dateFilter === 'next3') {
                    matchesDate = diffDays >= 0 && diffDays <= 3;
                } else if (dateFilter === 'week') {
                    matchesDate = diffDays >= 0 && diffDays <= 7;
                }
            }

            return activeTab === 'pending'
                ? (!isReported && matchesSearch && matchesDate)
                : (isReported && matchesSearch);
        });

        const progress = stats.moneyProgressPercent || 0;
        const bonusMoney = stats.accumulatedBonus || 0;
        const saturdayMoney = stats.saturdayEarnings;
        const isBlower = stats.role === 'BLOWER';

        return (
            <div className="space-y-8">
                {showDietaPrompt && (
                    <DietaModal 
                        onLogged={() => setShowDietaPrompt(false)} 
                        onClose={() => setShowDietaPrompt(false)} 
                    />
                )}
                
                {/* Offline Sync Manager for Technicians */}
                <OfflineSyncManager onSyncComplete={fetchData} />

                {/* Welcome & Status */}

                <div className="bg-[#0a0f1c] rounded-[2.5rem] p-10 text-white shadow-[0_20px_50px_rgba(0,0,0,0.2)] relative overflow-hidden border border-[#ffffff]/10 group">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-joa-cyan/20 rounded-full blur-[100px] -mr-20 -mt-20 mix-blend-screen pointer-events-none group-hover:bg-joa-cyan/30 transition-colors duration-1000"></div>
                    <div className="absolute bottom-0 left-[20%] w-80 h-80 bg-joa-blue/20 rounded-full blur-[100px] -mb-20 mix-blend-screen pointer-events-none"></div>
                    <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik00MCAwaC0xdjQwaDFWMHptLTQwIDQwaDQwdi0xSDB2MXoiIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyIvPjwvZz48L3N2Zz4=')] opacity-30 pointer-events-none"></div>

                    <div className="relative z-10">
                        <div className="flex justify-between items-start flex-col md:flex-row gap-6 mb-8">
                            <div>
                                <h2 className="text-4xl font-heading font-black mb-3">Hola, <span className="text-transparent bg-clip-text bg-gradient-to-r from-joa-cyan to-white">{user.username?.split('.')[0]}</span>! 👋</h2>
                                <p className="text-slate-300 text-lg font-medium">
                                    {isBlower ? 'Panel de Soplado - Resumen de rendimiento.' : 'Resumen económico • v3.0 OFFLINE READY'}
                                </p>
                            </div>
                            
                            <div className="bg-white/5 p-4 rounded-2xl border border-white/10 backdrop-blur-md self-stretch md:self-auto flex flex-col justify-center shadow-inner shadow-black/10">
                                <label className="text-[10px] font-bold text-joa-cyan uppercase tracking-widest mb-1 block">Tu Cliente Activo</label>
                                <div className="text-white text-base font-bold w-full md:w-48 truncate">
                                    {user.activeClientCompany?.name || 'No asignado'}
                                </div>
                            </div>
                        </div>

                        {/* Generic Installation Button for any client with assigned items */}
                        {user.activeClientCompany && (
                            <div className="mb-6">
                                <button 
                                    onClick={() => navigate('/dashboard/gnk-installation')}
                                    className="w-full md:w-auto bg-green-500 hover:bg-green-600 text-white font-bold py-4 px-8 rounded-xl shadow-lg shadow-green-500/30 transition-transform hover:scale-105 flex items-center justify-center gap-2"
                                >
                                    <MapPin />
                                    Nuevo Informe de Instalación Profesional
                                </button>
                            </div>
                        )}

                        {stats.isBonusMode ? (
                            <div className="bg-yellow-500/20 border border-yellow-500/50 p-6 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 animate-in zoom-in duration-500 shadow-lg shadow-yellow-500/10">
                                <div className="flex items-center gap-4">
                                    <div className="bg-yellow-500 p-3 rounded-xl">
                                        <TrendingUp className="text-white" size={24} />
                                    </div>
                                    <div>
                                        <h4 className="text-xl font-bold text-yellow-400">¡Bonus Activo! 💸</h4>
                                        <p className="text-sm text-slate-300">Has cubierto tus gastos. ¡Ahora todo suma extra!</p>
                                    </div>
                                </div>
                                <div className="text-right flex flex-col items-center md:items-end">
                                    <p className="text-[10px] font-bold text-yellow-500 uppercase tracking-widest mb-1">Tu Bonus Acumulado</p>
                                    <p className="text-4xl font-black text-white">{money(stats.accumulatedBonus)}</p>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-white/5 border border-white/10 p-5 rounded-2xl">
                                <div className="flex justify-between items-center mb-3">
                                    <div className="flex items-center gap-2">
                                        <Calculator className="text-joa-cyan" size={18} />
                                        <p className="font-bold text-sm text-white">Objetivo de Rentabilidad (Gastos)</p>
                                                               <p className="text-xs font-bold text-slate-300">
                                        {Math.round(stats.moneyProgressPercent)}% / 100%
                                    </p>
                                </div>
                                <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden border border-white/5">
                                    <div
                                        className="h-full bg-gradient-to-r from-joa-cyan to-blue-400 rounded-full transition-all duration-1000 shadow-[0_0_15px_rgba(0,186,224,0.4)]"
                                        style={{ width: `${stats.moneyProgressPercent}%` }}
                                    ></div>
                                </div>
                                <div className="flex justify-between mt-2">
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Inicio Mes</p>
                                    <p className="text-[10px] text-joa-cyan font-black uppercase tracking-tight">
                                        Falta un {Math.max(0, 100 - Math.round(stats.moneyProgressPercent))}% para entrar en nivel de Bonus
                                    </p>
                                </div>
         </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Stats Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 group hover:shadow-md transition-all">
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-xl group-hover:scale-110 transition-transform">
                            <Target size={24} />
                        </div>
                        <div>
                            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Progreso de Producción</p>
                            <h3 className="text-2xl font-bold text-slate-800">{Math.round(stats.moneyProgressPercent)}%</h3>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 group hover:shadow-md transition-all">
                        <div className="p-3 bg-orange-50 text-orange-600 rounded-xl group-hover:scale-110 transition-transform">
                            <TrendingUp size={24} />
                        </div>
                        <div>
                            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Objetivo del Mes</p>
                            <h3 className="text-2xl font-bold text-slate-800">100%</h3>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 group hover:shadow-md transition-all">
                        <div className="p-3 bg-green-50 text-green-600 rounded-xl group-hover:scale-110 transition-transform">
                            <DollarSign size={24} />
                        </div>
                        <div>
                            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Tu Bonus Actual</p>
                            <h3 className={`${stats.accumulatedBonus > 0 ? 'text-green-600' : 'text-slate-400'} text-2xl font-bold`}>
                                {money(stats.accumulatedBonus)}
                            </h3>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 group hover:shadow-md transition-all">
                        <div className="p-3 bg-sky-50 text-sky-600 rounded-xl group-hover:scale-110 transition-transform">
                            <Percent size={24} />
                        </div>
                        <div>
                            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Rentabilidad</p>
                            <h3 className="text-2xl font-bold text-slate-800">{Math.round(stats.moneyProgressPercent)}%</h3>
                        </div>
                    </div>
                </div>
                <div className="mt-8">
                    <h3 className="text-slate-500 font-bold text-sm uppercase tracking-wider mb-4 px-2">Desglose de Producción (Mes Actual)</h3>
                    <div className="flex flex-wrap gap-4 md:gap-6">
                        {Object.entries(stats.counts).map(([label, count]) => {
                            // Don't show technical internal counters like 'viviendas' (for blowers) or 'gk'
                            if (label === 'viviendas' || label === 'gk') return null;
                            if (count === 0 && (label === 'bp' || label === 'ta' || label === 'sp' || label === 'mdu')) return null; // hide 0 standard ones
                            if (count === 0 && !['bp', 'ta', 'sp', 'mdu'].includes(label)) return null; // hide 0 dynamic ones
                            
                            return (
                                <div key={label} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center group hover:shadow-md transition-all min-w-[120px] flex-1 md:flex-none">
                                    <div className="p-3 bg-blue-50 text-blue-600 rounded-full mb-3 group-hover:scale-110 transition-transform">
                                        <span className="font-extrabold text-xs">
                                            {label === 'bp' ? 'BP' : 
                                             label === 'ta' ? 'TA' : 
                                             label === 'sp' ? 'SP' : 
                                             label === 'mdu' ? 'MDU' : label.substring(0, 2).toUpperCase()}
                                        </span>
                                    </div>
                                    <h3 className="text-4xl font-bold text-slate-800">{count}</h3>
                                    <p className="text-xs text-slate-400 font-bold uppercase mt-2">
                                        {label === 'bp' ? 'Básicas' : 
                                         label === 'ta' ? 'SDU / TA' : 
                                         label === 'sp' ? 'Activación SP' : 
                                         label === 'mdu' ? 'MDU' : label}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Saturday Section */}
                <div className="bg-orange-50 p-6 rounded-3xl border border-orange-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <Calendar className="text-orange-600" size={20} />
                            <h3 className="font-bold text-slate-800">Producción de Sábados (Extra)</h3>
                        </div>
                        <span className="bg-orange-600 text-white px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-orange-200">Bonus Directo</span>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-white p-4 rounded-2xl shadow-sm border border-orange-50">
                            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">
                                {isBlower ? 'Soplados Sábado' : 'Total Activaciones'}
                            </p>
                            <h4 className="text-2xl font-bold text-slate-800">{stats.saturdayActivations || 0}</h4>
                        </div>
                        <div className="bg-white p-4 rounded-2xl shadow-sm border border-orange-50">
                            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">Ganancia Extra Sábado</p>
                            <h4 className="text-2xl font-bold text-orange-600">
                                {money(saturdayMoney)}
                            </h4>
                        </div>
                        <div className="col-span-2 bg-gradient-to-br from-orange-500 to-orange-600 p-4 rounded-2xl shadow-lg flex items-center justify-between text-white">
                            <div>
                                <p className="text-orange-100 text-[10px] font-bold uppercase mb-1">Ganancia Neta Estimada Sábados</p>
                                <h4 className="text-2xl font-bold">{money(saturdayMoney)}</h4>
                            </div>
                            <TrendingUp className="opacity-20" size={40} />
                        </div>
                    </div>
                </div>

                {/* Agenda / Task List */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row gap-4 items-center justify-between">
                        {/* Tabs */}
                        <div className="flex bg-slate-100 p-1 rounded-xl w-full md:w-auto">
                            <button
                                onClick={() => setActiveTab('pending')}
                                className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'pending' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Pendientes
                            </button>
                            <button
                                onClick={() => setActiveTab('completed')}
                                className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'completed' ? 'bg-white text-green-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Terminadas
                            </button>
                        </div>

                        {/* Search & Filter */}
                        <div className="flex gap-2 w-full md:w-auto">
                            {activeTab === 'pending' && (
                                <select
                                    value={dateFilter}
                                    onChange={(e) => setDateFilter(e.target.value)}
                                    className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-joa-blue/50"
                                >
                                    <option value="today">📅 Hoy</option>
                                    <option value="tomorrow">📅 Mañana</option>
                                    <option value="next3">📅 +3 Días</option>
                                    <option value="week">📅 Semana</option>
                                    <option value="all">📅 Todo</option>
                                </select>
                            )}

                            <div className="relative flex-1 md:w-64">
                                <input
                                    type="text"
                                    placeholder="Buscar..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-joa-blue/50"
                                />
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="divide-y divide-slate-50">
                        {filteredAppointments.length === 0 ? (
                            <div className="p-12 text-center">
                                <div className="text-slate-300 mb-2">
                                    {activeTab === 'pending' ? <Calendar size={48} className="mx-auto" /> : <CheckCircle size={48} className="mx-auto" />}
                                </div>
                                <p className="text-slate-500">{activeTab === 'pending' ? 'No hay activaciones pendientes.' : 'No has completado activaciones aún.'}</p>
                                {searchQuery && <p className="text-xs text-slate-400 mt-2">Prueba con otra búsqueda.</p>}
                            </div>
                        ) : (
                            filteredAppointments.map(apt => (
                                <div
                                    key={apt.id}
                                    onClick={() => setSelectedAppointment(apt)}
                                    className="p-4 hover:bg-slate-50 transition-colors cursor-pointer flex items-center justify-between group"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`flex flex-col items-center justify-center w-14 h-14 rounded-xl transition-colors ${apt.status === 'COMPLETADO' ? 'bg-green-50 text-green-600 group-hover:bg-green-100' : 'bg-slate-100 text-slate-600 group-hover:bg-joa-blue group-hover:text-white'}`}>
                                            <span className="text-xs font-bold uppercase">{apt.assignedDate ? new Date(apt.assignedDate).toLocaleDateString('es-ES', { month: 'short' }) : '--'}</span>
                                            <span className="text-xl font-bold">{apt.assignedDate ? new Date(apt.assignedDate).getDate() : '?'}</span>
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-800 flex items-center gap-2">
                                                {apt.address.street} {apt.address.number}
                                                {apt.type === 'REPAIR' && (
                                                    <span className="bg-red-100 text-red-600 text-[10px] px-2 py-0.5 rounded-full border border-red-200 uppercase tracking-wider">AVERÍA</span>
                                                )}
                                            </h4>
                                            <p className="text-sm text-slate-500">{apt.address.project.name} • {apt.assignedDate ? new Date(apt.assignedDate).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : 'Hora no asignada'}</p>
                                        </div>
                                    </div>
                                    <div className="hidden md:flex items-center gap-4">
                                        {apt.status === 'COMPLETADO' ? (
                                            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold flex items-center gap-1">
                                                <CheckCircle size={14} /> Completado
                                            </span>
                                        ) : (
                                            <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold flex items-center gap-1">
                                                <Clock size={14} /> Programado
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <AppointmentModal appointment={selectedAppointment} onClose={() => setSelectedAppointment(null)} onUpdate={fetchData} navigate={navigate} />
            </div>
        );
    }

    // --- ADMIN / BACKOFFICE VIEW ---
    return (
        <div className="space-y-8">
            {/* Welcome Section */}
            <div className="bg-[#0a0f1c] rounded-[2.5rem] p-10 text-white shadow-[0_20px_50px_rgba(0,0,0,0.2)] relative overflow-hidden border border-[#ffffff]/10 group">
                <div className="absolute top-0 right-0 w-96 h-96 bg-joa-cyan/20 rounded-full blur-[100px] -mr-20 -mt-20 mix-blend-screen pointer-events-none group-hover:bg-joa-cyan/30 transition-colors duration-1000"></div>
                <div className="absolute bottom-0 left-[20%] w-80 h-80 bg-joa-blue/20 rounded-full blur-[100px] -mb-20 mix-blend-screen pointer-events-none"></div>
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik00MCAwaC0xdjQwaDFWMHptLTQwIDQwaDQwdi0xSDB2MXoiIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyIvPjwvZz48L3N2Zz4=')] opacity-30 pointer-events-none"></div>

                <div className="relative z-10">
                    <div className="flex justify-between items-start flex-col md:flex-row gap-6">
                        <div>
                            <h2 className="text-4xl font-heading font-black mb-3">¡Hola, <span className="text-transparent bg-clip-text bg-gradient-to-r from-joa-cyan to-white">{user.username?.split('.')[0]}</span>! 👋</h2>
                            <p className="text-slate-300 text-lg font-medium max-w-xl mb-6">
                                Bienvenido al panel central de comando de JOA Technologien.
                            </p>
                        </div>

                        {/* Client Switcher Selector for Admin */}
                        <div className="bg-white/5 p-4 rounded-2xl border border-white/10 backdrop-blur-md self-stretch md:self-auto flex flex-col justify-center mb-6 md:mb-0 shadow-inner shadow-black/10">
                            <label className="text-[10px] font-bold text-joa-cyan uppercase tracking-wider mb-2 block">Cliente Analizado</label>
                            <div className="relative">
                                <select 
                                    value={user.activeClientCompanyId || ''} 
                                    onChange={handleClientChange}
                                    disabled={updatingClient}
                                    className="bg-transparent text-white border-0 border-b-2 border-white/20 focus:border-joa-cyan focus:ring-0 px-0 py-2 text-base font-bold w-full md:w-56 appearance-none cursor-pointer outline-none transition-colors"
                                >
                                    <option value="" className="text-slate-800">-- Selecciona Cliente --</option>
                                    {clients.map(c => (
                                        <option key={c.id} value={c.id} className="text-slate-800">{c.name}</option>
                                    ))}
                                </select>
                                <div className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none text-white/50">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard
                    title="Citas Pendientes"
                    value={stats.pendingAppointments || 0}
                    icon={Clock}
                    colorClass="text-orange-500 bg-orange-500"
                    subtext="Requieren atención del Back Office"
                    onClick={() => navigate('/dashboard/appointments?view=pending')}
                />
                <StatCard
                    title="Citas Asignadas"
                    value={stats.assignedAppointments || 0}
                    icon={Calendar}
                    colorClass="text-joa-blue bg-joa-blue"
                    subtext="Programadas y pendientes de cierre"
                    onClick={() => navigate('/dashboard/appointments?view=scheduled')}
                />
                <StatCard
                    title="Activaciones Terminadas"
                    value={stats.completedActivations || 0}
                    icon={CheckCircle}
                    colorClass="text-green-500 bg-green-500"
                    subtext="Total histórico"
                    onClick={() => navigate('/dashboard/billing')}
                />
            </div>

            {isAdmin && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Teams Table */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <Users size={20} className="text-joa-blue" />
                                Rendimiento de Equipos
                            </h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-slate-600">
                                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-100">
                                    <tr>
                                        <th className="p-4 pl-6">Equipo</th>
                                        <th className="p-4">Producción</th>
                                        <th className="p-4 text-right pr-6">Estado</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {(!payroll.teams || payroll.teams.length === 0) ? (
                                        <tr>
                                            <td colSpan="3" className="p-8 text-center text-slate-400">No hay datos</td>
                                        </tr>
                                    ) : (
                                        payroll.teams.map((team, index) => (
                                            <tr key={index} className="hover:bg-slate-50 transition-colors">
                                                <td className="p-4 pl-6 font-medium text-slate-800">{team.name}</td>
                                                <td className="p-4 font-bold">{money(team.earnings)}</td>
                                                <td className="p-4 text-right pr-6">
                                                    <div className="flex items-center justify-end gap-3">
                                                        <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full bg-gradient-to-r from-joa-blue to-joa-cyan"
                                                                style={{ width: `${team.progress}%` }}
                                                            ></div>
                                                        </div>
                                                        <span className="text-[10px] font-black text-slate-400">
                                                            {Math.round(team.progress)}%
                                                        </span>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Individual Technicians Table */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <Star size={20} className="text-yellow-500" />
                                Producción por Técnico
                            </h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-slate-600">
                                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-100">
                                    <tr>
                                        <th className="p-4 pl-6">Técnico</th>
                                        <th className="p-4">Total</th>
                                        <th className="p-4 text-right pr-6">Progreso (Bonus)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {(!payroll.technicians || payroll.technicians.length === 0) ? (
                                        <tr>
                                            <td colSpan="3" className="p-8 text-center text-slate-400">No hay datos</td>
                                        </tr>
                                    ) : (
                                        payroll.technicians.map((tech, index) => (
                                            <tr key={index} className="hover:bg-slate-50 transition-colors">
                                                <td className="p-4 pl-6 font-medium text-slate-800">{tech.name}</td>
                                                <td className="p-4 font-bold text-green-600">{money(tech.earnings)}</td>
                                                <td className="p-4 text-right pr-6">
                                                    <div className="flex items-center justify-end gap-3">
                                                        <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full bg-gradient-to-r from-yellow-400 to-orange-500"
                                                                style={{ width: `${tech.progress}%` }}
                                                            ></div>
                                                        </div>
                                                        <span className="text-[10px] font-black text-slate-400">
                                                            {Math.round(tech.progress)}%
                                                        </span>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
            
            {showDietaPrompt && (
                <DietaModal 
                    onLogged={() => setShowDietaPrompt(false)} 
                    onClose={() => setShowDietaPrompt(false)} 
                />
            )}
        </div>
    );
};

export default DashboardHome;
