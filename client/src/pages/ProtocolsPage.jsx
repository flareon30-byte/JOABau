
import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { Calendar, CheckCircle, Clock, MapPin, X, ClipboardList } from 'lucide-react';

const AppointmentModal = ({ appointment, onClose, onUpdate }) => {
    const [attendedBy, setAttendedBy] = useState('');
    const [comments, setComments] = useState('');
    const [reciteReason, setReciteReason] = useState('');
    const [isReciting, setIsReciting] = useState(false);
    const [loading, setLoading] = useState(false);

    if (!appointment) return null;

    const handleComplete = async () => {
        if (!attendedBy) return alert('Por favor, indica quién atendió.');
        setLoading(true);
        try {
            await api.put(`/api/appointments/${appointment.id}/status`, {
                status: 'COMPLETADO',
                attendedBy,
                comments
            });
            if (onUpdate) onUpdate();
            onClose();
        } catch (error) {
            console.error(error);
            alert('Error al guardar datos');
        } finally {
            setLoading(false);
        }
    };

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
                <div className="flex items-center gap-2 mb-4">
                    <ClipboardList className="text-purple-600" size={24} />
                    <h3 className="text-xl font-bold text-slate-800">
                        {isReciting ? 'Solicitar Recita' : 'Detalles de Protocolo'}
                    </h3>
                </div>

                <h3 className="text-xl font-bold text-slate-800 mb-1">{appointment.address.street} {appointment.address.number}</h3>
                <p className="text-slate-500 text-sm mb-6">{appointment.address.project.name}</p>

                {isReciting ? (
                    <div className="space-y-4">
                        <p className="text-sm text-slate-600">Por favor, explica por qué es necesario recitar esta cita. Esto enviará una notificación al Back Office.</p>
                        <textarea
                            value={reciteReason}
                            onChange={(e) => setReciteReason(e.target.value)}
                            placeholder="Motivo de la recita..."
                            className="w-full border border-slate-300 rounded-lg p-3 h-32 focus:ring-2 focus:ring-purple-500 outline-none resize-none"
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
                                {loading ? 'Enviando...' : 'Confirmar Recita'}
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        {appointment.status === 'COMPLETADO' ? (
                            <div className="text-center py-4">
                                <CheckCircle className="mx-auto text-green-500 mb-2" size={48} />
                                <p className="font-bold text-green-700">Protocolo Completado</p>
                            </div>
                        ) : (
                            <div className="space-y-4 mb-6">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Atendido por</label>
                                    <input
                                        type="text"
                                        value={attendedBy}
                                        onChange={(e) => setAttendedBy(e.target.value)}
                                        className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none"
                                        placeholder="Nombre de la persona"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Comentarios</label>
                                    <textarea
                                        value={comments}
                                        onChange={(e) => setComments(e.target.value)}
                                        className="w-full border border-slate-300 rounded-lg p-2 h-24 focus:ring-2 focus:ring-purple-500 outline-none resize-none"
                                        placeholder="Observaciones adicionales..."
                                    />
                                </div>
                            </div>
                        )}

                        <div className="flex gap-3">
                            {appointment.status !== 'COMPLETADO' && (
                                <>
                                    <button
                                        onClick={() => setIsReciting(true)}
                                        className="flex-1 py-3 rounded-xl border border-red-100 bg-red-50 text-red-600 font-bold hover:bg-red-100 transition-colors"
                                    >
                                        Recitar
                                    </button>
                                    <button
                                        onClick={handleComplete}
                                        disabled={loading || !attendedBy}
                                        className="flex-1 py-3 rounded-xl bg-green-600 text-white font-bold hover:bg-green-700 transition-colors shadow-lg shadow-green-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {loading ? 'Guardando...' : 'Protocolo Terminado'}
                                    </button>
                                </>
                            )}
                            {appointment.status === 'COMPLETADO' && (
                                <button
                                    onClick={onClose}
                                    className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 transition-colors"
                                >
                                    Cerrar
                                </button>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

const ProtocolsPage = () => {
    const [activatorData, setActivatorData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedAppointment, setSelectedAppointment] = useState(null);
    const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'completed'
    const [searchQuery, setSearchQuery] = useState('');

    const user = JSON.parse(localStorage.getItem('user') || '{}');

    const fetchData = async () => {
        try {
            // We reuse the activator endpoint as it fetches appointments for the user's team
            const res = await api.get('/api/dashboard/activator');
            setActivatorData(res.data);
        } catch (error) {
            console.error('Error fetching protocols data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
        </div>
    );

    if (!activatorData) return <div className="p-8 text-center text-slate-500">No hay datos disponibles. Asegúrate de estar asignado al equipo de Protocolos.</div>;

    const { appointments } = activatorData;

    // Filter Appointments
    const filteredAppointments = appointments.filter(app => {
        const matchesSearch =
            app.address.street.toLowerCase().includes(searchQuery.toLowerCase()) ||
            app.address.project.name.toLowerCase().includes(searchQuery.toLowerCase());

        const isCompleted = app.status === 'COMPLETADO';

        return activeTab === 'pending'
            ? (!isCompleted && matchesSearch)
            : (isCompleted && matchesSearch);
    });

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-900 to-slate-900 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl -mr-16 -mt-16"></div>
                <div className="relative z-10">
                    <h2 className="text-3xl font-bold mb-2">Gestión de Protocolos</h2>
                    <p className="text-purple-200">Revisión y gestión de citas de protocolo.</p>
                </div>
            </div>

            {/* List */}
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

                    {/* Search */}
                    <div className="relative flex-1 md:w-64 w-full">
                        <input
                            type="text"
                            placeholder="Buscar dirección..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                        />
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                            <MapPin size={16} />
                        </div>
                    </div>
                </div>

                <div className="divide-y divide-slate-50">
                    {filteredAppointments.length === 0 ? (
                        <div className="p-12 text-center">
                            <div className="text-slate-300 mb-2">
                                {activeTab === 'pending' ? <Calendar size={48} className="mx-auto" /> : <CheckCircle size={48} className="mx-auto" />}
                            </div>
                            <p className="text-slate-500">{activeTab === 'pending' ? 'No hay protocolos pendientes.' : 'No has completado protocolos aún.'}</p>
                        </div>
                    ) : (
                        filteredAppointments.map(apt => (
                            <div
                                key={apt.id}
                                onClick={() => setSelectedAppointment(apt)}
                                className="p-4 hover:bg-slate-50 transition-colors cursor-pointer flex items-center justify-between group"
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`flex flex-col items-center justify-center w-14 h-14 rounded-xl transition-colors ${apt.status === 'COMPLETADO' ? 'bg-green-50 text-green-600 group-hover:bg-green-100' : 'bg-purple-50 text-purple-600 group-hover:bg-purple-600 group-hover:text-white'}`}>
                                        <span className="text-xs font-bold uppercase">{new Date(apt.assignedDate).toLocaleDateString('es-ES', { month: 'short' })}</span>
                                        <span className="text-xl font-bold">{new Date(apt.assignedDate).getDate()}</span>
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-800">{apt.address.street} {apt.address.number}</h4>
                                        <p className="text-sm text-slate-500">{apt.address.project.name} • {new Date(apt.assignedDate).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</p>
                                    </div>
                                </div>
                                <div className="hidden md:flex items-center gap-4">
                                    {apt.status === 'COMPLETADO' ? (
                                        <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold flex items-center gap-1">
                                            <CheckCircle size={14} /> Completado
                                        </span>
                                    ) : (
                                        <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-bold flex items-center gap-1">
                                            <Clock size={14} /> Pendiente
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
};

export default ProtocolsPage;
