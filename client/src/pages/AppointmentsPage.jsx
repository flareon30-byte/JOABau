import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api/axios';
import { Phone, Calendar, Clock, CheckCircle, MessageSquare, Users, Edit2, Grid, List, X, FileText, Send, CheckSquare } from 'lucide-react';
import CalendarView from '../components/CalendarView';

const AppointmentsPage = () => {
    const [searchParams] = useSearchParams();
    const [pendingAddresses, setPendingAddresses] = useState([]);
    const [scheduledAppointments, setScheduledAppointments] = useState([]);
    const [escalatedAddresses, setEscalatedAddresses] = useState([]);
    const [teams, setTeams] = useState([]);
    const [view, setView] = useState('pending'); // 'pending' or 'scheduled'
    const [scheduledViewMode, setScheduledViewMode] = useState('list'); // 'list' or 'calendar'

    // Filters
    const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
    const [projectFilter, setProjectFilter] = useState('');
    const [projects, setProjects] = useState([]);

    // Modal States
    const [selectedAddress, setSelectedAddress] = useState(null);
    const [isContactModalOpen, setIsContactModalOpen] = useState(false);
    const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
    const [isGeneralCalendarOpen, setIsGeneralCalendarOpen] = useState(false);

    // Forms
    const [contactForm, setContactForm] = useState({ result: 'No contesta', comment: '' });
    const [scheduleForm, setScheduleForm] = useState({ date: '', teamId: '', clientName: '', apartmentCount: '' });

    useEffect(() => {
        fetchData();
        fetchTeams();
        fetchProjects();
    }, []);

    const fetchData = async () => {
        try {
            const [pendingRes, scheduledRes, escalatedRes] = await Promise.all([
                api.get('/api/appointments/pending'),
                api.get('/api/appointments/scheduled'),
                api.get('/api/appointments/escalated')
            ]);
            setPendingAddresses(pendingRes.data || []);
            setScheduledAppointments(scheduledRes.data || []);
            setEscalatedAddresses(escalatedRes.data || []);
        } catch (error) {
            console.error('Error fetching appointments:', error);
            setPendingAddresses([]);
            setScheduledAppointments([]);
            setEscalatedAddresses([]);
        }
    };

    const fetchTeams = async () => {
        try {
            const res = await api.get('/api/teams');
            setTeams(res.data);
        } catch (error) {
            console.error('Error fetching teams:', error);
        }
    };

    const fetchProjects = async () => {
        try {
            const res = await api.get('/api/projects');
            setProjects(res.data);
        } catch (error) {
            console.error('Error fetching projects:', error);
        }
    };

    // ... (handlers remain the same)

    const handleContactSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.post(`/api/appointments/log-contact/${selectedAddress.id}`, contactForm);
            setIsContactModalOpen(false);
            setContactForm({ result: 'No contesta', comment: '' });
            fetchData();
        } catch (error) {
            console.error('Error logging contact:', error);
        }
    };

    const handleScheduleSubmit = async (e) => {
        e.preventDefault();
        try {
            // Fix timezone: Convert local input time to ISO string (UTC) explicitly
            const dateObj = new Date(scheduleForm.date);
            const payload = {
                ...scheduleForm,
                date: dateObj.toISOString()
            };

            await api.post(`/api/appointments/schedule/${selectedAddress.id}`, payload);
            setIsScheduleModalOpen(false);
            setScheduleForm({ date: '', teamId: '', clientName: '', apartmentCount: '' });
            fetchData();
        } catch (error) {
            console.error('Error scheduling:', error);
        }
    };

    const handleCancelAppointment = async () => {
        if (!window.confirm('¿Eliminar esta cita? La dirección volverá a la lista de pendientes.')) return;

        const appointmentId = scheduleForm.appointmentId; // Relies on state being set in openScheduleModal

        if (!appointmentId) {
            // Fallback if accessed via other means, but usually form state has it
            alert('Error: No se encontró ID de cita para cancelar.');
            return;
        }

        try {
            await api.delete(`/api/appointments/${appointmentId}`);
            setIsScheduleModalOpen(false);
            fetchData();
        } catch (error) {
            console.error(error);
            alert('Error al cancelar la cita');
        }
    };

    const handleProtocolOverride = async (addressId) => {
        if (!window.confirm('¿Seguro que deseas marcar el protocolo como OK manualmente? Esto permitirá agendar la activación.')) return;
        try {
            await api.put(`/api/appointments/protocol-status/${addressId}`, { status: 'OK' });
            fetchData();
        } catch (err) {
            console.error(err);
            alert('Error al actualizar protocolo');
        }
    };

    const handleOrderStatusUpdate = async (addressId, newStatus) => {
        let msg = newStatus === 'DERIVADA'
            ? '¿Seguro que deseas derivar esta dirección a la empresa colaboradora? Desaparecerá de las pendientes.'
            : '¿Seguro que deseas marcar esta orden como CERRADA? Significa que la empresa colaboradora ya la ha terminado. Desaparecerá de las pendientes.';

        if (!window.confirm(msg)) return;

        try {
            await api.put(`/api/appointments/address/${addressId}/order-status`, { status: newStatus });
            fetchData();
        } catch (err) {
            console.error(err);
            alert(`Error al cambiar el estado a ${newStatus}`);
        }
    };

    const handleResetOrder = async (addressId) => {
        if (!window.confirm('¿Deseas devolver esta dirección a la lista de pendientes? Se reiniciará a estado "geplant".')) return;

        try {
            await api.put(`/api/appointments/address/${addressId}/order-status`, { status: 'geplant' });
            fetchData();
        } catch (err) {
            console.error(err);
            alert('Error al restaurar el estado de la dirección');
        }
    };

    const openContactModal = (address) => {
        setSelectedAddress(address);
        setIsContactModalOpen(true);
    };

    const openScheduleModal = (address, existingAppointment = null, defaultType = 'ACTIVATION') => {
        setSelectedAddress(address);
        if (existingAppointment) {
            // Pre-fill for editing
            const date = new Date(existingAppointment.assignedDate);
            // Format date for datetime-local input (YYYY-MM-DDTHH:mm)
            const formattedDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);

            setScheduleForm({
                appointmentId: existingAppointment.id,
                date: formattedDate,
                teamId: existingAppointment.assignedTeamId || '',
                clientName: existingAppointment.clientName || '',
                apartmentCount: existingAppointment.apartmentCount || '',
                type: existingAppointment.type || 'ACTIVATION'
            });
        } else {
            // Reset for new
            setScheduleForm({
                appointmentId: null,
                date: '',
                teamId: '',
                clientName: address.clientName || '',
                apartmentCount: '',
                type: defaultType
            });
        }
        setIsScheduleModalOpen(true);
    };

    // Filter Logic
    const filterAppointments = (list) => {
        if (!Array.isArray(list)) return [];
        return list.filter(item => {
            if (!item) return false;

            // Determine if item is an Appointment (has .address) or an Address (is the address)
            // Pending items are Addresses. Scheduled items are Appointments.
            const address = item.address || item;

            // Safety check for address properties
            if (!address || !address.street) return false;

            const street = address.street || '';
            const clientName = (item.clientName || address.clientName) || '';
            const nvt = address.nvt || '';

            const matchesSearch =
                street.toLowerCase().includes(searchTerm.toLowerCase()) ||
                clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                nvt.toLowerCase().includes(searchTerm.toLowerCase());

            // Check project id. 
            // Keep in mind 'address.project' might differ in structure depending on include
            // For Pending: includes project. For Scheduled: appointment includes address, which includes project.
            const projectId = address.project?.id;
            const matchesProject = projectFilter ? projectId === projectFilter : true;

            return matchesSearch && matchesProject;
        });
    };

    const BASE_URL = import.meta.env.VITE_API_URL || 'https://api.joatechnologien.de';

    const allPendingFiltered = filterAppointments(pendingAddresses);

    // Addresses that NEED Protocol check
    const filteredProtocols = allPendingFiltered.filter(a => a.requiresProtocol && a.protocolStatus !== 'OK');

    // Addresses ready for Activation (or standard)
    const filteredPending = allPendingFiltered.filter(a =>
        (!a.requiresProtocol || a.protocolStatus === 'OK') && a.sopladoStatus === 'OK'
    );

    const filteredScheduled = filterAppointments(scheduledAppointments);
    const filteredEscalated = filterAppointments(escalatedAddresses);

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h2 className="text-2xl font-bold text-slate-800">Gestión de Citas</h2>
                <div className="flex bg-slate-200 p-1 rounded-lg">
                    <button
                        onClick={() => setView('pending')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${view === 'pending' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-800'
                            }`}
                    >
                        Pendientes ({filteredPending.length})
                    </button>
                    <button
                        onClick={() => setView('protocols')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${view === 'protocols' ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-600 hover:text-slate-800'
                            }`}
                    >
                        Protocolos ({filteredProtocols.length})
                    </button>
                    <button
                        onClick={() => setView('scheduled')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${view === 'scheduled' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-800'
                            }`}
                    >
                        Agendadas ({filteredScheduled.length})
                    </button>
                    <button
                        onClick={() => setView('escalated')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${view === 'escalated' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-600 hover:text-slate-800'
                            }`}
                    >
                        Archivo ({filteredEscalated.length})
                    </button>
                </div>
            </div>

            {/* Filters Bar */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                    <input
                        type="text"
                        placeholder="Buscar por dirección o cliente..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>
                <div className="w-full md:w-64">
                    <select
                        value={projectFilter}
                        onChange={(e) => setProjectFilter(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                        <option value="">Todos los Proyectos</option>
                        {projects.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {view === 'pending' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {filteredPending.map(address => (
                        <div key={address.id} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="font-bold text-lg text-slate-800">{address.street} {address.number}</h3>
                                    {address.clientName && (
                                        <p className="text-sm font-semibold text-blue-600 mb-1">{address.clientName}</p>
                                    )}
                                    <p className="text-sm text-slate-500">{address.project.name} | NVT: {address.nvt} | KLS: {address.klsId || 'N/A'}</p>
                                </div>
                                <div className="text-right">
                                    <span className="inline-block px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-full font-bold mb-1">
                                        Intentos: {address.appointment?.contactAttempts || 0}/4
                                    </span>
                                    <p className="text-xs text-slate-400">
                                        {address.appointment?.updatedAt ? new Date(address.appointment.updatedAt).toLocaleDateString() : 'Sin contacto'}
                                    </p>
                                </div>
                            </div>

                            {/* Alert for Protocol */}
                            {address.requiresProtocol && address.protocolStatus !== 'OK' && (
                                <div className="mb-4 bg-purple-50 border border-purple-100 p-3 rounded-lg flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2 text-purple-700">
                                        <FileText size={16} />
                                        <div className="text-xs">
                                            <span className="font-bold block">Requiere Protocolo</span>
                                            <span className="opacity-75">Estado actual: {address.protocolStatus}</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleProtocolOverride(address.id)}
                                        className="text-xs bg-purple-200 hover:bg-purple-300 text-purple-800 px-2 py-1 rounded transition-colors"
                                        title="Marcar manualmente como OK"
                                    >
                                        Forzar OK
                                    </button>
                                </div>
                            )}

                            {/* Alert for Recite */}
                            {address.appointment?.status === 'RECITAR' && (
                                <div className="mb-4 bg-red-50 border border-red-100 p-4 rounded-xl flex items-start gap-4">
                                    <div className="bg-red-500 p-2 rounded-lg text-white">
                                        <MessageSquare size={18} />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-center mb-1">
                                            <p className="text-xs font-black text-red-700 uppercase tracking-widest">Solicitud de Recita / Incidencia</p>
                                            <p className="text-[10px] text-red-400 font-bold">
                                                {address.appointment.comments && address.appointment.comments.length > 0 ? address.appointment.comments[address.appointment.comments.length - 1].authorName : 'Técnico'}
                                            </p>
                                        </div>
                                        <p className="text-sm text-red-900 font-medium mb-3">
                                            {address.appointment.comments && address.appointment.comments.length > 0
                                                ? address.appointment.comments[address.appointment.comments.length - 1].content
                                                : 'Sin motivo especificado'}
                                        </p>

                                        {/* FOTOS DE LA RECITA */}
                                        {address.appointment.comments && 
                                         address.appointment.comments.length > 0 && 
                                         address.appointment.comments[address.appointment.comments.length - 1].photos?.length > 0 && (
                                            <div className="flex gap-2 flex-wrap mt-2">
                                                {address.appointment.comments[address.appointment.comments.length - 1].photos.map((photo, pIdx) => (
                                                    <a 
                                                        key={pIdx} 
                                                        href={`${BASE_URL}${photo.startsWith('/') ? photo : '/' + photo}`} 
                                                        target="_blank" 
                                                        rel="noreferrer"
                                                        className="block w-16 h-16 rounded-lg overflow-hidden border-2 border-red-200 hover:border-red-500 transition-all shadow-sm"
                                                    >
                                                        <img 
                                                            src={`${BASE_URL}${photo.startsWith('/') ? photo : '/' + photo}`} 
                                                            alt="Evidencia recita" 
                                                            className="w-full h-full object-cover"
                                                        />
                                                    </a>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* History Preview */}
                            {address.appointment?.contactHistory?.length > 0 && (
                                <div className="mb-4 bg-slate-50 p-3 rounded-lg text-xs text-slate-600 space-y-1">
                                    {address.appointment.contactHistory.slice(-2).map((entry, i) => (
                                        <div key={i}>{entry}</div>
                                    ))}
                                </div>
                            )}

                            <div className="flex flex-col gap-3 mt-4">
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => openContactModal(address)}
                                        className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors text-sm font-semibold"
                                    >
                                        <Phone size={16} /> Contactar
                                    </button>
                                    <button
                                        onClick={() => openScheduleModal(address)}
                                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg flex items-center justify-center gap-2 transition-colors text-sm font-semibold shadow-sm"
                                    >
                                        <Calendar size={16} /> Agendar
                                    </button>
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => handleOrderStatusUpdate(address.id, 'DERIVADA')}
                                        className="flex-1 bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 py-1.5 rounded-lg flex items-center justify-center gap-2 transition-colors text-xs font-semibold"
                                        title="Avisar a la empresa colaboradora para que envíen responsable"
                                    >
                                        <Send size={14} /> Derivar
                                    </button>
                                    <button
                                        onClick={() => handleOrderStatusUpdate(address.id, 'CERRADA')}
                                        className="flex-1 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 py-1.5 rounded-lg flex items-center justify-center gap-2 transition-colors text-xs font-semibold"
                                        title="Marcar como terminada por la empresa colaboradora"
                                    >
                                        <CheckSquare size={14} /> Orden Cerrada
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                    {filteredPending.length === 0 && (
                        <div className="col-span-full text-center py-12 text-slate-400">
                            No se encontraron direcciones pendientes con los filtros actuales.
                        </div>
                    )}
                </div>
            )}

            {view === 'protocols' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {filteredProtocols.map(address => (
                        <div key={address.id} className="bg-purple-50 p-6 rounded-xl shadow-sm border border-purple-200 relative overflow-hidden">
                            <div className="absolute top-0 right-0 bg-purple-200 text-purple-800 text-xs px-2 py-1 rounded-bl-lg font-bold">
                                PROTOCOLO REQUERIDO
                            </div>

                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="font-bold text-lg text-slate-800">{address.street} {address.number}</h3>
                                    {address.clientName && (
                                        <p className="text-sm font-semibold text-purple-700 mb-1">{address.clientName}</p>
                                    )}
                                    <p className="text-sm text-slate-500">{address.project.name} | NVT: {address.nvt}</p>
                                </div>
                            </div>

                            <div className="flex flex-col gap-3 mt-4">
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => openContactModal(address)}
                                        className="flex-1 bg-white hover:bg-slate-50 text-slate-700 py-2 rounded-lg flex items-center justify-center gap-2 border border-slate-200 transition-colors text-sm font-semibold"
                                    >
                                        <Phone size={16} /> Contactar
                                    </button>
                                    <button
                                        onClick={() => openScheduleModal(address, null, 'PROTOCOL')}
                                        className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-sm text-sm font-semibold"
                                    >
                                        <Calendar size={16} /> Agendar Protocolo
                                    </button>
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => handleOrderStatusUpdate(address.id, 'DERIVADA')}
                                        className="flex-1 bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 py-1.5 rounded-lg flex items-center justify-center gap-2 transition-colors text-xs font-semibold"
                                        title="Avisar a la empresa colaboradora para que envíen responsable"
                                    >
                                        <Send size={14} /> Derivar
                                    </button>
                                    <button
                                        onClick={() => handleOrderStatusUpdate(address.id, 'CERRADA')}
                                        className="flex-1 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 py-1.5 rounded-lg flex items-center justify-center gap-2 transition-colors text-xs font-semibold"
                                        title="Marcar como terminada por la empresa colaboradora"
                                    >
                                        <CheckSquare size={14} /> Orden Cerrada
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                    {filteredProtocols.length === 0 && (
                        <div className="col-span-full text-center py-12 text-slate-400">
                            No hay direcciones pendientes de protocolo.
                        </div>
                    )}
                </div>
            )}

            {view === 'scheduled' && (
                <div className="space-y-4">
                    <div className="flex justify-end">
                        <div className="flex bg-white border border-slate-200 rounded-lg p-1">
                            <button
                                onClick={() => setScheduledViewMode('list')}
                                className={`p-2 rounded-md transition-all ${scheduledViewMode === 'list' ? 'bg-slate-100 text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                                title="Vista de Lista"
                            >
                                <List size={20} />
                            </button>
                            <button
                                onClick={() => setScheduledViewMode('calendar')}
                                className={`p-2 rounded-md transition-all ${scheduledViewMode === 'calendar' ? 'bg-slate-100 text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                                title="Vista de Calendario"
                            >
                                <Grid size={20} />
                            </button>
                        </div>
                    </div>

                    {scheduledViewMode === 'list' ? (
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <table className="w-full text-left text-sm text-slate-600">
                                <thead className="bg-slate-50 text-slate-800 font-bold border-b border-slate-200">
                                    <tr>
                                        <th className="p-4">Fecha</th>
                                        <th className="p-4">Dirección</th>
                                        <th className="p-4">Equipo Asignado</th>
                                        <th className="p-4">Estado</th>
                                        <th className="p-4 text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredScheduled.map(app => (
                                        <tr key={app.id} className="hover:bg-slate-50">
                                            <td className="p-4 font-medium">
                                                {new Date(app.assignedDate).toLocaleDateString()}
                                                <div className="text-xs text-slate-400">{new Date(app.assignedDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                            </td>
                                            <td className="p-4">
                                                <div className="font-bold text-slate-800">{app.address.street} {app.address.number}</div>
                                                <div className="text-xs">{app.address.project.name}</div>
                                            </td>
                                            <td className="p-4">
                                                {app.assignedTeam ? (
                                                    <span className="flex items-center gap-2">
                                                        <Users size={14} /> {app.assignedTeam.name}
                                                    </span>
                                                ) : <span className="text-red-400">Sin asignar</span>}
                                            </td>
                                            <td className="p-4">
                                                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">
                                                    {app.status}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right">
                                                <button
                                                    onClick={() => openScheduleModal(app.address, app)}
                                                    className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-blue-600 transition-colors"
                                                    title="Editar Cita"
                                                >
                                                    <Edit2 size={18} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <CalendarView appointments={filteredScheduled} />
                    )}
                </div>
            )}

            {view === 'escalated' && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <table className="w-full text-left text-sm text-slate-600">
                        <thead className="bg-slate-50 text-slate-800 font-bold border-b border-slate-200">
                            <tr>
                                <th className="p-4">Dirección</th>
                                <th className="p-4">Cliente</th>
                                <th className="p-4">Proyecto</th>
                                <th className="p-4">Estado (Causa)</th>
                                <th className="p-4 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredEscalated.map(address => (
                                <tr key={address.id} className="hover:bg-slate-50">
                                    <td className="p-4">
                                        <div className="font-bold text-slate-800">{address.street} {address.number}</div>
                                    </td>
                                    <td className="p-4">
                                        <div className="text-slate-600">{address.clientName || 'N/A'}</div>
                                    </td>
                                    <td className="p-4">
                                        {address.project?.name || 'Otro'}
                                    </td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${address.orderStatus === 'CERRADA'
                                            ? 'bg-green-100 text-green-700'
                                            : 'bg-orange-100 text-orange-700'
                                            }`}>
                                            {address.orderStatus}
                                        </span>
                                    </td>
                                    <td className="p-4 text-right">
                                        <button
                                            onClick={() => handleResetOrder(address.id)}
                                            className="px-3 py-1 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-md text-xs font-medium transition-colors"
                                            title="Devolver a lista de Pendientes"
                                        >
                                            Restaurar
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filteredEscalated.length === 0 && (
                        <div className="text-center py-12 text-slate-400">
                            No hay direcciones archivadas.
                        </div>
                    )}
                </div>
            )}

            {/* Contact Modal */}
            {isContactModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
                        <h3 className="text-xl font-bold mb-4">Registrar Intento de Contacto</h3>
                        <p className="text-sm text-slate-500 mb-4">{selectedAddress?.street} {selectedAddress?.number}</p>
                        <form onSubmit={handleContactSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Resultado</label>
                                <select
                                    value={contactForm.result}
                                    onChange={(e) => setContactForm({ ...contactForm, result: e.target.value })}
                                    className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    <option value="No contesta">No contesta</option>
                                    <option value="Número equivocado">Número equivocado</option>
                                    <option value="Buzón de voz">Buzón de voz</option>
                                    <option value="Contactado - Pide llamar luego">Contactado - Pide llamar luego</option>
                                    <option value="Contactado - Rechaza">Contactado - Rechaza</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Comentario (Opcional)</label>
                                <textarea
                                    value={contactForm.comment}
                                    onChange={(e) => setContactForm({ ...contactForm, comment: e.target.value })}
                                    className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none h-24 resize-none"
                                />
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <button type="button" onClick={() => setIsContactModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
                                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Guardar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Schedule Modal */}
            {isScheduleModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold">Agendar Cita</h3>
                            <button onClick={() => setIsGeneralCalendarOpen(true)} className="text-blue-600 text-sm font-bold hover:underline flex items-center gap-1">
                                <Grid size={16} /> Ver Calendario General
                            </button>
                        </div>
                        <p className="text-sm text-slate-500 mb-4">{selectedAddress?.street} {selectedAddress?.number}</p>
                        <form onSubmit={handleScheduleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Cita</label>
                                <select
                                    value={scheduleForm.type}
                                    onChange={(e) => setScheduleForm({ ...scheduleForm, type: e.target.value })}
                                    className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    <option value="ACTIVATION">Activación (Instalación)</option>
                                    <option value="PROTOCOL">Protocolo (Medición)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del Cliente</label>
                                <input
                                    type="text"
                                    value={scheduleForm.clientName}
                                    onChange={(e) => setScheduleForm({ ...scheduleForm, clientName: e.target.value })}
                                    className={`w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none ${selectedAddress?.clientName ? 'bg-slate-100 text-slate-500' : ''}`}
                                    placeholder="Nombre completo"
                                    readOnly={!!selectedAddress?.clientName}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Número de Apartamentos</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={scheduleForm.apartmentCount}
                                    onChange={(e) => setScheduleForm({ ...scheduleForm, apartmentCount: e.target.value })}
                                    className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="Ej. 1"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Fecha y Hora</label>
                                <div className="flex gap-2">
                                    <input
                                        type="datetime-local"
                                        value={scheduleForm.date}
                                        onChange={(e) => setScheduleForm({ ...scheduleForm, date: e.target.value })}
                                        className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setIsGeneralCalendarOpen(true)}
                                        className="bg-blue-100 hover:bg-blue-200 text-blue-600 p-2 rounded-lg transition-colors"
                                        title="Seleccionar en Calendario"
                                    >
                                        <Calendar size={20} />
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Asignar Equipo</label>
                                <select
                                    value={scheduleForm.teamId}
                                    onChange={(e) => setScheduleForm({ ...scheduleForm, teamId: e.target.value })}
                                    className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                    required
                                >
                                    <option value="">Seleccionar Equipo...</option>
                                    {teams.map(team => (
                                        <option key={team.id} value={team.id}>{team.name} ({team.department})</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex justify-between mt-6">
                                {scheduleForm.appointmentId ? (
                                    <button
                                        type="button"
                                        onClick={handleCancelAppointment}
                                        className="px-4 py-2 text-red-600 hover:bg-red-50 hover:text-red-700 rounded-lg border border-red-200 transition-colors"
                                    >
                                        Eliminar Cita
                                    </button>
                                ) : <div></div>}
                                <div className="flex gap-3">
                                    <button type="button" onClick={() => setIsScheduleModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cerrar</button>
                                    <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Guardar</button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* General Calendar Modal */}
            {isGeneralCalendarOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
                    <div className="bg-white rounded-2xl w-full max-w-5xl h-[80vh] shadow-2xl flex flex-col">
                        <div className="p-4 border-b border-slate-200 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-slate-800">Calendario General de Citas</h3>
                            <button onClick={() => setIsGeneralCalendarOpen(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-500">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-hidden p-4 bg-slate-50">
                            <div className="mb-4 bg-blue-50 p-3 rounded-lg text-blue-700 text-sm flex items-center gap-2">
                                <CheckCircle size={16} />
                                Haz clic en una franja horaria para seleccionarla automáticamente.
                            </div>
                            <CalendarView
                                appointments={scheduledAppointments}
                                onSlotClick={(day, hour) => {
                                    const selectedDate = new Date(day);
                                    selectedDate.setHours(hour, 0, 0, 0);
                                    // Format for datetime-local: YYYY-MM-DDTHH:mm
                                    const formattedDate = new Date(selectedDate.getTime() - (selectedDate.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);

                                    setScheduleForm(prev => ({ ...prev, date: formattedDate }));
                                    setIsGeneralCalendarOpen(false);

                                    // If we are not already in the schedule modal (e.g. just viewing calendar), do nothing or maybe open it?
                                    // But the user flow implies we are coming from the modal usually.
                                    // If we are just viewing the calendar from the main page list view, we might not want to open the modal.
                                    // However, the request specifically asked for this flow in the context of "Agendar Cita".
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AppointmentsPage;
