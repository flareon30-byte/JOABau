import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { Calendar as CalendarIcon, Clock, CheckCircle, XCircle, User, Filter, ChevronLeft, ChevronRight } from 'lucide-react';

const AdminVacationPage = () => {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('list'); // 'list' or 'calendar'
    const [currentMonth, setCurrentMonth] = useState(new Date());

    const fetchAllRequests = async () => {
        try {
            const res = await api.get('/api/vacations/all');
            setRequests(res.data);
        } catch (error) {
            console.error('Error fetching all requests:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAllRequests();
    }, []);

    const handleUpdateStatus = async (id, status, comment = '') => {
        try {
            await api.put(`/api/vacations/${id}/status`, { status, managerComment: comment });
            fetchAllRequests();
        } catch (error) {
            alert('Error al actualizar el estado.');
        }
    };

    const getStatusStyle = (status) => {
        switch (status) {
            case 'APPROVED': return 'bg-green-100 text-green-800 border-green-200';
            case 'DENIED': return 'bg-red-100 text-red-800 border-red-200';
            default: return 'bg-amber-100 text-amber-800 border-amber-200';
        }
    };

    // Calendar logic
    const getDaysInMonth = (date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        // Days to show from previous month
        const prevMonthDays = [];
        const startDay = firstDay === 0 ? 6 : firstDay - 1; // Adjust for Monday start
        for (let i = startDay; i > 0; i--) {
            prevMonthDays.push({ day: new Date(year, month, 1 - i), current: false });
        }

        // Days in current month
        const currentDays = [];
        for (let i = 1; i <= daysInMonth; i++) {
            currentDays.push({ day: new Date(year, month, i), current: true });
        }

        return [...prevMonthDays, ...currentDays];
    };

    const calendarDays = getDaysInMonth(currentMonth);

    const getVacationsForDay = (day) => {
        return requests.filter(req => {
            const start = new Date(req.startDate);
            const end = new Date(req.endDate);
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
            const d = new Date(day);
            d.setHours(12, 0, 0, 0);
            return d >= start && d <= end && req.status === 'APPROVED';
        });
    };

    const changeMonth = (offset) => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + offset, 1));
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800">Gestión de Vacaciones</h1>
                    <p className="text-slate-500">Supervisa y aprueba las solicitudes del personal</p>
                </div>
                <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button
                        onClick={() => setActiveTab('list')}
                        className={`px-4 py-2 rounded-lg font-bold text-sm transition ${activeTab === 'list' ? 'bg-white text-joa-blue shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Lista
                    </button>
                    <button
                        onClick={() => setActiveTab('calendar')}
                        className={`px-4 py-2 rounded-lg font-bold text-sm transition ${activeTab === 'calendar' ? 'bg-white text-joa-blue shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Calendario
                    </button>
                </div>
            </div>

            {activeTab === 'list' ? (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-6 border-b border-slate-200 flex justify-between items-center">
                        <h2 className="text-xl font-bold text-slate-800">Solicitudes Recientes</h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-center">Técnico</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Período</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Tipo</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Estado</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {requests.map((request) => (
                                    <tr key={request.id} className="hover:bg-slate-50/50 transition duration-150">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 font-bold border border-slate-200">
                                                    {request.user.username.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="font-bold text-slate-800">{request.user.username}</div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 font-medium text-slate-700">
                                            {new Date(request.startDate).toLocaleDateString()} - {new Date(request.endDate).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 text-slate-600">
                                            {request.type === 'VACATION' ? 'Vacaciones' : 'Día Libre'}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${getStatusStyle(request.status)}`}>
                                                {request.status === 'PENDING' ? 'Pendiente' : request.status === 'APPROVED' ? 'Aprobado' : 'Denegado'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            {request.status === 'PENDING' ? (
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => handleUpdateStatus(request.id, 'APPROVED')}
                                                        className="p-2 bg-green-50 text-green-600 hover:bg-green-100 rounded-lg transition"
                                                        title="Aprobar"
                                                    >
                                                        <CheckCircle size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            const comm = prompt('Motivo de denegación:');
                                                            if (comm !== null) handleUpdateStatus(request.id, 'DENIED', comm);
                                                        }}
                                                        className="p-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition"
                                                        title="Denegar"
                                                    >
                                                        <XCircle size={18} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <span className="text-slate-400 text-sm italic">Completado</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-slate-800 capitalize">
                            {currentMonth.toLocaleString('es-ES', { month: 'long', year: 'numeric' })}
                        </h2>
                        <div className="flex gap-2">
                            <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-600"><ChevronLeft size={20} /></button>
                            <button onClick={() => changeMonth(1)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition"><ChevronRight size={20} /></button>
                        </div>
                    </div>
                    <div className="grid grid-cols-7 gap-px bg-slate-200 border border-slate-200 rounded-xl overflow-hidden mt-2">
                        {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(day => (
                            <div key={day} className="bg-slate-50 py-3 text-center text-xs font-bold text-slate-500 uppercase">{day}</div>
                        ))}
                        {calendarDays.map((dateObj, i) => {
                            const dayVacations = getVacationsForDay(dateObj.day);
                            return (
                                <div key={i} className={`min-h-[120px] bg-white p-2 ${dateObj.current ? '' : 'bg-slate-50/50 opacity-40'}`}>
                                    <div className={`text-sm font-bold mb-2 ${dateObj.day.toDateString() === new Date().toDateString() ? 'bg-joa-blue text-white w-6 h-6 flex items-center justify-center rounded-full' : 'text-slate-500'}`}>
                                        {dateObj.day.getDate()}
                                    </div>
                                    <div className="space-y-1">
                                        {dayVacations.map(v => (
                                            <div key={v.id} className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold truncate border border-blue-200">
                                                {v.user.username}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminVacationPage;
