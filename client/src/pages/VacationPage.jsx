import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { Calendar, Plus, Clock, CheckCircle, XCircle, Trash2, Info } from 'lucide-react';

// Helper for Easter Calculation (Meeus/Jones/Butcher algorithm)
const getEaster = (year) => {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month - 1, day);
};

// Returns an array of YYYY-MM-DD strings for German national holidays
const getGermanHolidays = (year) => {
    const holidays = [
        `${year}-01-01`, // Neujahr
        `${year}-05-01`, // Tag der Arbeit
        `${year}-10-03`, // Tag der Deutschen Unidad
        `${year}-12-25`, // 1. Weihnachtstag
        `${year}-12-26`, // 2. Weihnachtstag
    ];

    const easter = getEaster(year);
    const dates = [
        -2, // Karfreitag
        1,  // Ostermontag
        39, // Christi Himmelfahrt
        50  // Pfingstmontag
    ];

    dates.forEach(offset => {
        const d = new Date(easter);
        d.setDate(easter.getDate() + offset);
        holidays.push(d.toISOString().split('T')[0]);
    });

    return holidays;
};

const calculateBusinessDays = (start, end) => {
    if (!start || !end) return 0;
    let count = 0;
    const curDate = new Date(start);
    const endDate = new Date(end);
    
    // Cache holidays for performance
    const holidayCache = {};

    while (curDate <= endDate) {
        const year = curDate.getFullYear();
        if (!holidayCache[year]) holidayCache[year] = getGermanHolidays(year);

        const dayOfWeek = curDate.getDay();
        const dateString = curDate.toISOString().split('T')[0];
        
        const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
        const isHoliday = holidayCache[year].includes(dateString);

        if (!isWeekend && !isHoliday) {
            count++;
        }
        curDate.setDate(curDate.getDate() + 1);
    }
    return count;
};

const VacationPage = () => {
    const [stats, setStats] = useState({ total: 0, used: 0, remaining: 0 });
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({
        startDate: '',
        endDate: '',
        type: 'VACATION',
        reason: ''
    });

    const fetchVacations = async () => {
        try {
            const res = await api.get('/api/vacations/my');
            setRequests(res.data.requests);
            setStats(res.data.stats);
        } catch (error) {
            console.error('Error fetching vacations:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchVacations();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.post('/api/vacations/request', formData);
            setShowModal(false);
            setFormData({ startDate: '', endDate: '', type: 'VACATION', reason: '' });
            fetchVacations();
        } catch (error) {
            alert('Error al solicitar vacaciones. Verifique que las fechas sean correctas.');
        }
    };

    const getStatusStyle = (status) => {
        switch (status) {
            case 'APPROVED': return 'bg-green-100 text-green-800 border-green-200';
            case 'DENIED': return 'bg-red-100 text-red-800 border-red-200';
            default: return 'bg-amber-100 text-amber-800 border-amber-200';
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'APPROVED': return <CheckCircle size={16} />;
            case 'DENIED': return <XCircle size={16} />;
            default: return <Clock size={16} />;
        }
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800">Mis Vacaciones</h1>
                    <p className="text-slate-500">Gestiona tus días de descanso y solicitudes</p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="flex items-center gap-2 bg-joa-blue text-white px-6 py-3 rounded-xl hover:bg-joa-blue-dark transition shadow-lg shadow-blue-100"
                >
                    <Plus size={20} />
                    Solicitar Vacaciones
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                            <Calendar size={24} />
                        </div>
                    </div>
                    <div className="text-2xl font-bold text-slate-800">{stats.total}</div>
                    <div className="text-slate-500 font-medium">Días Totales</div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                            <CheckCircle size={24} />
                        </div>
                    </div>
                    <div className="text-2xl font-bold text-slate-800">{stats.used}</div>
                    <div className="text-slate-500 font-medium">Días Disfrutados</div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-green-50 text-green-600 rounded-xl">
                            <Info size={24} />
                        </div>
                    </div>
                    <div className="text-2xl font-bold text-slate-800">{stats.remaining}</div>
                    <div className="text-slate-500 font-medium">Días Restantes</div>
                </div>
            </div>

            {/* Requests Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-200 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-slate-800">Historial de Solicitudes</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Período</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Tipo</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Días</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Estado</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Comentario Admin</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {requests.map((request) => {
                                const start = new Date(request.startDate).toLocaleDateString();
                                const end = new Date(request.endDate).toLocaleDateString();
                                return (
                                    <tr key={request.id} className="hover:bg-slate-50/50 transition duration-150">
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-slate-800">{start} - {end}</div>
                                        </td>
                                        <td className="px-6 py-4 text-slate-600">
                                            {request.type === 'VACATION' ? 'Vacaciones' : 'Día Libre'}
                                        </td>
                                        <td className="px-6 py-4 text-slate-600">
                                            {calculateBusinessDays(request.startDate, request.endDate)}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${getStatusStyle(request.status)}`}>
                                                {getStatusIcon(request.status)}
                                                {request.status === 'PENDING' ? 'Pendiente' : request.status === 'APPROVED' ? 'Aprobado' : 'Denegado'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-slate-500 italic text-sm">
                                            {request.managerComment || 'Sin comentarios'}
                                        </td>
                                    </tr>
                                );
                            })}
                            {requests.length === 0 && (
                                <tr>
                                    <td colSpan="5" className="px-6 py-12 text-center text-slate-400">
                                        No has realizado ninguna solicitud todavía.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal solicitud */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="px-8 py-6 bg-joa-blue text-white">
                            <h3 className="text-xl font-bold">Solicitud de Vacaciones</h3>
                            <p className="text-blue-100 text-sm">Completa el formulario para enviar la solicitud</p>
                        </div>
                        <form onSubmit={handleSubmit} className="p-8 space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Fecha Inicio</label>
                                    <input
                                        type="date"
                                        required
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-4 focus:ring-blue-100 focus:border-joa-blue transition outline-none"
                                        value={formData.startDate}
                                        onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Fecha Fin</label>
                                    <input
                                        type="date"
                                        required
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-4 focus:ring-blue-100 focus:border-joa-blue transition outline-none"
                                        value={formData.endDate}
                                        onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Tipo de Solicitud</label>
                                <select
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-4 focus:ring-blue-100 focus:border-joa-blue transition outline-none"
                                    value={formData.type}
                                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                >
                                    <option value="VACATION">Vacaciones</option>
                                    <option value="DAY_OFF">Día Libre</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Motivo o Notas (Opcional)</label>
                                <textarea
                                    rows="3"
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-4 focus:ring-blue-100 focus:border-joa-blue transition outline-none resize-none"
                                    value={formData.reason}
                                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                                />
                            </div>
                            {formData.startDate && formData.endDate && (
                                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 animate-fadeIn">
                                    <div className="flex justify-between items-center text-blue-800">
                                        <span className="text-sm font-bold lowercase tracking-wider">Días laborables a descontar:</span>
                                        <span className="text-lg font-black">{calculateBusinessDays(formData.startDate, formData.endDate)} días</span>
                                    </div>
                                    <p className="text-[10px] text-blue-600 mt-1 uppercase font-black tracking-widest leading-tight">
                                        * Sincronizado con calendario de festivos de Alemania y fines de semana excluidos.
                                    </p>
                                </div>
                            )}

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 px-6 py-3 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 transition"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-6 py-3 rounded-xl bg-joa-blue text-white font-bold hover:bg-joa-blue-dark transition shadow-lg shadow-blue-100"
                                >
                                    Enviar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default VacationPage;
