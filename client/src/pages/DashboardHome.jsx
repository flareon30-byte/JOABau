import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { Calendar, CheckCircle, Clock, TrendingUp, Users, MapPin, DollarSign, Star, AlertCircle, X, Target } from 'lucide-react';

const StatCard = ({ title, value, icon: Icon, colorClass, subtext }) => (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-all group">
        <div className="flex items-start justify-between">
            <div>
                <p className="text-slate-500 text-sm font-medium mb-1">{title}</p>
                <h3 className="text-3xl font-bold text-slate-800 group-hover:text-joa-blue transition-colors">{value}</h3>
                {subtext && <p className="text-xs text-slate-400 mt-2">{subtext}</p>}
            </div>
            <div className={`p-3 rounded-xl ${colorClass} bg-opacity-10 group-hover:scale-110 transition-transform`}>
                <Icon className={`w-6 h-6 ${colorClass.replace('bg-', 'text-')}`} />
            </div>
        </div>
    </div>
);

const AppointmentModal = ({ appointment, onClose, onUpdate }) => {
    const [reciteReason, setReciteReason] = useState('');
    const [isReciting, setIsReciting] = useState(false);
    const [loading, setLoading] = useState(false);

    if (!appointment) return null;

    const handleRecite = async () => {
        if (!reciteReason) return alert('Por favor, indica el motivo.');
        setLoading(true);
        try {
            await api.post(`/api/appointments/${appointment.id}/recite`, {
                reason: reciteReason
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
                <h3 className="text-xl font-bold text-slate-800 mb-1">
                    {isReciting ? 'Solicitar Recita' : `${appointment.address.street} ${appointment.address.number}`}
                </h3>
                <p className="text-slate-500 text-sm mb-6">{appointment.address.project.name}</p>

                {isReciting ? (
                    <div className="space-y-4">
                        <p className="text-sm text-slate-600">Por favor, explica el motivo. Esto enviará una notificación al Back Office.</p>
                        <textarea
                            value={reciteReason}
                            onChange={(e) => setReciteReason(e.target.value)}
                            placeholder="Motivo de la recita..."
                            className="w-full border border-slate-300 rounded-lg p-3 h-32 focus:ring-2 focus:ring-joa-blue outline-none resize-none"
                        />
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
                        </div>

                        <div className="mt-6 flex gap-3">
                            {appointment.status !== 'COMPLETADO' && (
                                <button
                                    onClick={() => setIsReciting(true)}
                                    className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-colors"
                                >
                                    Recitar
                                </button>
                            )}
                            <button
                                onClick={() => {
                                    if (appointment.type === 'REPAIR') {
                                        window.location.href = `/repair/${appointment.id}/complete`;
                                    } else {
                                        window.location.href = `/activation/${appointment.id}/complete`;
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

const DashboardHome = () => {
    const [stats, setStats] = useState({});
    const [activatorData, setActivatorData] = useState(null);
    const [payroll, setPayroll] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedAppointment, setSelectedAppointment] = useState(null);
    const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'completed'
    const [searchQuery, setSearchQuery] = useState('');
    const [dateFilter, setDateFilter] = useState('today'); // 'today' | 'tomorrow' | 'next3' | 'week' | 'all'
    const money = (val) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(val || 0);

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const isActivator = ['ACTIVATOR', 'BLOWER', 'PROTOCOL_MANAGER'].includes(user.role);
    const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(user.role);

    const fetchData = async () => {
        try {
            if (isActivator) {
                const res = await api.get('/api/dashboard/activator');
                setActivatorData(res.data);
            } else {
                const statsRes = await api.get('/api/dashboard/stats');
                setStats(statsRes.data);

                if (isAdmin) {
                    const payrollRes = await api.get('/api/dashboard/payroll');
                    setPayroll(payrollRes.data.teams);
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

            const isCompleted = app.status === 'COMPLETADO';

            // Date Filtering for Pending
            let matchesDate = true;
            if (activeTab === 'pending' && !isCompleted && dateFilter !== 'all') {
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
                ? (!isCompleted && matchesSearch && matchesDate)
                : (isCompleted && matchesSearch);
        });

        const progress = Math.min((stats.regularEarnings / stats.target) * 100, 100);
        const bonusMoney = Math.max(0, stats.regularEarnings - stats.target);

        const saturdayMoney = stats.saturdayEarnings;


        return (
            <div className="space-y-8">
                {/* Welcome & Status */}
                <div className="bg-gradient-to-r from-joa-dark to-slate-800 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-joa-cyan/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
                    <div className="relative z-10">
                        <div className="flex justify-between items-start">
                            <div>
                                <h2 className="text-3xl font-bold mb-2">Hola, {user.username?.split('.')[0]}! 👋</h2>
                                <p className="text-slate-300 mb-6">Resumen de tu rendimiento económico.</p>
                            </div>
                        </div>

                        {stats.isBonusMode ? (
                            <div className="bg-green-500/20 border border-green-500/50 p-4 rounded-xl flex items-center gap-3 animate-pulse">
                                <Star className="text-yellow-400 fill-yellow-400" />
                                <div>
                                    <p className="font-bold text-green-400">¡Modo Paga Extra Activado!</p>
                                    <p className="text-xs text-green-200">Has superado tus gastos mensuales. Cada nuevo trabajo genera beneficios adicionales.</p>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-white/10 border border-white/20 p-4 rounded-xl flex items-center gap-3">
                                <AlertCircle className="text-slate-300" />
                                <div>
                                    <p className="font-bold text-white">Progreso de Gastos Cubiertos</p>
                                    <div className="w-full max-w-sm h-2 bg-white/20 rounded-full mt-2 mb-1">
                                        <div
                                            className="h-full bg-joa-cyan rounded-full transition-all duration-1000"
                                            style={{ width: `${progress}%` }}
                                        ></div>
                                    </div>
                                    <p className="text-xs text-slate-300">
                                        {stats.regularEarnings !== null
                                            ? `Faltan ${money(stats.target - stats.regularEarnings)} para cubrir tus gastos y cobrar extras.`
                                            : `Progreso actual: ${Math.round(progress)}%. Sigue así para llegar al objetivo.`
                                        }
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Stats Grid */}
                {/* Stats Grid - Production Breakdown */}
                <h3 className="text-slate-500 font-bold text-sm uppercase tracking-wider mb-2">Resumen de Producción (Mes Actual)</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center group hover:shadow-md transition-all">
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-full mb-3 group-hover:scale-110 transition-transform">
                            <span className="font-extrabold text-xs">BP</span>
                        </div>
                        <h3 className="text-4xl font-bold text-slate-800">{stats.counts?.bp || 0}</h3>
                        <p className="text-xs text-slate-400 font-bold uppercase mt-2">Básicas</p>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center group hover:shadow-md transition-all">
                        <div className="p-3 bg-green-50 text-green-600 rounded-full mb-3 group-hover:scale-110 transition-transform">
                            <span className="font-extrabold text-xs">TA</span>
                        </div>
                        <h3 className="text-4xl font-bold text-slate-800">{stats.counts?.ta || 0}</h3>
                        <p className="text-xs text-slate-400 font-bold uppercase mt-2">SDU / TA</p>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center group hover:shadow-md transition-all">
                        <div className="p-3 bg-purple-50 text-purple-600 rounded-full mb-3 group-hover:scale-110 transition-transform">
                            <span className="font-extrabold text-xs">SP</span>
                        </div>
                        <h3 className="text-4xl font-bold text-slate-800">{stats.counts?.sp || 0}</h3>
                        <p className="text-xs text-slate-400 font-bold uppercase mt-2">Activaciones SP</p>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center group hover:shadow-md transition-all">
                        <div className="p-3 bg-orange-50 text-orange-600 rounded-full mb-3 group-hover:scale-110 transition-transform">
                            <span className="font-extrabold text-xs">MDU</span>
                        </div>
                        <h3 className="text-4xl font-bold text-slate-800">{stats.counts?.mdu || 0}</h3>
                        <p className="text-xs text-slate-400 font-bold uppercase mt-2">MDU</p>
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
                            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">Total Activaciones</p>
                            <h4 className="text-2xl font-bold text-slate-800">{stats.saturdayActivations || 0}</h4>
                        </div>
                        <div className="bg-white p-4 rounded-2xl shadow-sm border border-orange-50">
                            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">Ganancia Extra</p>
                            <h4 className="text-2xl font-bold text-orange-600">
                                {money(saturdayMoney)}
                            </h4>
                        </div>
                        <div className="col-span-2 bg-gradient-to-br from-orange-500 to-orange-600 p-4 rounded-2xl shadow-lg flex items-center justify-between text-white">
                            <div>
                                <p className="text-orange-100 text-[10px] font-bold uppercase mb-1">Ganancia Neta Estimada</p>
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
                                            <span className="text-xs font-bold uppercase">{new Date(apt.assignedDate).toLocaleDateString('es-ES', { month: 'short' })}</span>
                                            <span className="text-xl font-bold">{new Date(apt.assignedDate).getDate()}</span>
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-800 flex items-center gap-2">
                                                {apt.address.street} {apt.address.number}
                                                {apt.type === 'REPAIR' && (
                                                    <span className="bg-red-100 text-red-600 text-[10px] px-2 py-0.5 rounded-full border border-red-200 uppercase tracking-wider">AVERÍA</span>
                                                )}
                                            </h4>
                                            <p className="text-sm text-slate-500">{apt.address.project.name} • {new Date(apt.assignedDate).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</p>
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

                <AppointmentModal appointment={selectedAppointment} onClose={() => setSelectedAppointment(null)} onUpdate={fetchData} />
            </div>
        );
    }

    // --- ADMIN / BACKOFFICE VIEW ---
    return (
        <div className="space-y-8">
            {/* Welcome Section */}
            <div className="bg-gradient-to-r from-joa-dark to-slate-800 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-joa-cyan/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
                <div className="relative z-10">
                    <h2 className="text-3xl font-bold mb-2">¡Hola, {user.username?.split('.')[0]}! 👋</h2>
                    <p className="text-slate-300 max-w-xl">
                        Bienvenido al panel de control de JOA Technologien.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard
                    title="Citas Pendientes"
                    value={stats.pendingAppointments || 0}
                    icon={Clock}
                    colorClass="text-orange-500 bg-orange-500"
                    subtext="Requieren atención del Back Office"
                />
                <StatCard
                    title="Citas Asignadas"
                    value={stats.assignedAppointments || 0}
                    icon={Calendar}
                    colorClass="text-joa-blue bg-joa-blue"
                    subtext="Programadas y pendientes de cierre"
                />
                <StatCard
                    title="Activaciones Terminadas"
                    value={stats.completedActivations || 0}
                    icon={CheckCircle}
                    colorClass="text-green-500 bg-green-500"
                    subtext="Total histórico"
                />
            </div>

            {isAdmin && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <TrendingUp size={20} className="text-joa-blue" />
                            Rendimiento de Equipos (Mes Actual)
                        </h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-slate-600">
                            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-100">
                                <tr>
                                    <th className="p-4 pl-6">Equipo</th>
                                    <th className="p-4">Activaciones</th>
                                    <th className="p-4">Producción Total</th>
                                    <th className="p-4">Estado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {payroll.length === 0 ? (
                                    <tr>
                                        <td colSpan="4" className="p-8 text-center text-slate-400">
                                            No hay datos registrados para este mes
                                        </td>
                                    </tr>
                                ) : (
                                    payroll.map((team, index) => (
                                        <tr key={index} className="hover:bg-slate-50 transition-colors">
                                            <td className="p-4 pl-6 font-medium text-slate-800 flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs">
                                                    {team.name.substring(0, 2).toUpperCase()}
                                                </div>
                                                {team.name}
                                            </td>
                                            <td className="p-4">
                                                <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 font-medium text-xs">
                                                    {team.activations} activaciones
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <span className="font-bold text-slate-800">{money(team.earnings)}</span>
                                            </td>
                                            <td className="p-4">
                                                <div className="w-full max-w-[100px] h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-gradient-to-r from-joa-blue to-joa-cyan"
                                                        style={{ width: `${Math.min((team.earnings / 12000) * 100, 100)}%` }}
                                                    ></div>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DashboardHome;
