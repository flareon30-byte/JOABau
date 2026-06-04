import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api/axios';
import { Phone, Calendar, Clock, CheckCircle, MessageSquare, Users, Edit2, Grid, List, X, FileText, Send, CheckSquare, Pencil, Trash, Plus, Loader, Save, Download, ChevronUp, ChevronDown, Sparkles, Brain, XCircle } from 'lucide-react';
import CalendarView from '../components/CalendarView';
import { useTranslation } from 'react-i18next';

const AppointmentsPage = () => {
    const { t } = useTranslation();
    const [searchParams] = useSearchParams();
    const [pendingAddresses, setPendingAddresses] = useState([]);
    const [scheduledAppointments, setScheduledAppointments] = useState([]);
    const [escalatedAddresses, setEscalatedAddresses] = useState([]);
    const [teams, setTeams] = useState([]);
    const [view, setView] = useState(searchParams.get('view') || 'pending'); // 'pending', 'scheduled', 'protocols', 'escalated'
    const [scheduledViewMode, setScheduledViewMode] = useState('list'); // 'list' or 'calendar'
    const [sortColumn, setSortColumn] = useState('date'); // 'date', 'address', 'nvt', 'team'
    const [sortDirection, setSortDirection] = useState('asc'); // 'asc', 'desc'

    // Filters
    const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
    const [projectFilter, setProjectFilter] = useState('');
    const [projects, setProjects] = useState([]);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Modal States
    const [selectedAddress, setSelectedAddress] = useState(null);
    const [isContactModalOpen, setIsContactModalOpen] = useState(false);
    const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
    const [isGeneralCalendarOpen, setIsGeneralCalendarOpen] = useState(false);

    // Forms
    const [contactForm, setContactForm] = useState({ result: 'No contesta', comment: '' });
    const [scheduleForm, setScheduleForm] = useState({ date: '', teamId: '', clientName: '', apartmentCount: '', orientationComment: '' });

    // New Edit Comment States
    const [isEditCommentModalOpen, setIsEditCommentModalOpen] = useState(false);
    const [editingComment, setEditingComment] = useState(null);
    const [editCommentForm, setEditCommentForm] = useState({ content: '', photosToRemove: [] });
    const [newEditPhotos, setNewEditPhotos] = useState([]);
    const [isSavingComment, setIsSavingComment] = useState(false);
    
    // Edit Address Master Data
    const [isEditAddressModalOpen, setIsEditAddressModalOpen] = useState(false);
    const [isSavingAddress, setIsSavingAddress] = useState(false);
    const [editAddressForm, setEditAddressForm] = useState({
        id: '',
        clientName: '',
        street: '',
        number: '',
        nvt: '',
        klsId: ''
    });
    // Derivation and History States
    const [isDeriveModalOpen, setIsDeriveModalOpen] = useState(false);
    const [deriveForm, setDeriveForm] = useState({ addressId: '', status: '', reason: '' });
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [selectedHistory, setSelectedHistory] = useState([]);
    const [historyAddressName, setHistoryAddressName] = useState('');

    // Building Modal States
    const [isBuildingModalOpen, setIsBuildingModalOpen] = useState(false);
    const [buildingClients, setBuildingClients] = useState([]);
    const [buildingAddressName, setBuildingAddressName] = useState('');
    const [isBuildingLoading, setIsBuildingLoading] = useState(false);

    // AI Manager States
    const [isAiModalOpen, setIsAiModalOpen] = useState(false);
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [aiResults, setAiResults] = useState(null);
    const [selectedAiAddress, setSelectedAiAddress] = useState(null);

    useEffect(() => {
        fetchData();
    }, [startDate, endDate]);

    useEffect(() => {
        fetchTeams();
        fetchProjects();
    }, []);

    const fetchData = async () => {
        try {
            const scheduledParams = (startDate && endDate) ? `?startDate=${startDate}&endDate=${endDate}` : '';
            const [pendingRes, scheduledRes, escalatedRes] = await Promise.all([
                api.get('/api/appointments/pending'),
                api.get(`/api/appointments/scheduled${scheduledParams}`),
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

    const handleExport = async () => {
        try {
            const params = (startDate && endDate) ? `?startDate=${startDate}&endDate=${endDate}` : '';
            const response = await api.get(`/api/appointments/export${params}`, {
                responseType: 'blob',
            });
            
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `citas_agendadas_${new Date().toISOString().split('T')[0]}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            console.error('Export error:', error);
            alert(t('appointments.error_cancel_appointment')); // Can be used as general error
        }
    };

    const handleExportAll = async () => {
        if (!projectFilter) {
            alert(t('appointments.select_project_first'));
            return;
        }
        try {
            const response = await api.get(`/api/appointments/export-all?projectId=${projectFilter}`, {
                responseType: 'blob',
            });
            
            const project = projects.find(p => p.id === projectFilter);
            const projectName = project ? project.name.replace(/[^a-z0-9]/gi, '_').toLowerCase() : 'proyecto';
            
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `reporte_completo_${projectName}_${new Date().toISOString().split('T')[0]}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            console.error('Export error:', error);
            alert(t('appointments.error_cancel_appointment'));
        }
    };

    const fetchTeams = async () => {
        try {
            const res = await api.get('/api/subcontractors');
            setTeams(res.data);
        } catch (error) {
            console.error('Error fetching subcontractors:', error);
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
            setScheduleForm({ date: '', teamId: '', clientName: '', apartmentCount: '', orientationComment: '' });
            fetchData();
        } catch (error) {
            console.error('Error scheduling:', error);
        }
    };

    const handleCancelAppointment = async () => {
        if (!window.confirm(t('appointments.confirm_delete_appointment'))) return;

        const appointmentId = scheduleForm.appointmentId; // Relies on state being set in openScheduleModal

        if (!appointmentId) {
            // Fallback if accessed via other means, but usually form state has it
            alert(t('appointments.error_no_appointment_id'));
            return;
        }

        try {
            await api.delete(`/api/appointments/${appointmentId}`);
            setIsScheduleModalOpen(false);
            fetchData();
        } catch (error) {
            console.error(error);
            alert(t('appointments.error_cancel_appointment'));
        }
    };

    const handleProtocolOverride = async (addressId) => {
        if (!window.confirm(t('appointments.confirm_protocol_override'))) return;
        try {
            await api.put(`/api/appointments/protocol-status/${addressId}`, { status: 'OK' });
            fetchData();
        } catch (err) {
            console.error(err);
            alert(t('appointments.error_protocol_override'));
        }
    };

    const openDeriveModal = (address, status) => {
        setDeriveForm({
            addressId: address.id,
            status: status,
            reason: ''
        });
        setIsDeriveModalOpen(true);
    };

    const handleDeriveSubmit = async (e) => {
        e.preventDefault();
        if (!deriveForm.reason.trim()) {
            alert(t('appointments.error_provide_reason'));
            return;
        }

        try {
            await api.put(`/api/appointments/address/${deriveForm.addressId}/order-status`, { 
                status: deriveForm.status,
                reason: deriveForm.reason
            });
            setIsDeriveModalOpen(false);
            fetchData();
        } catch (err) {
            console.error(err);
            alert(`Error al cambiar el estado a ${deriveForm.status}`);
        }
    };

    const handleResetOrder = async (addressId) => {
        if (!window.confirm(t('appointments.confirm_reset_order'))) return;

        try {
            await api.put(`/api/appointments/address/${addressId}/order-status`, { status: 'geplant' });
            fetchData();
        } catch (err) {
            console.error(err);
            alert(t('appointments.error_reset_order'));
        }
    };

    const openHistoryModal = (address) => {
        const history = address.appointment?.contactHistory || [];
        setSelectedHistory(history);
        setHistoryAddressName(`${address.street} ${address.number}`);
        setIsHistoryModalOpen(true);
    };

    const openBuildingClientsModal = async (address) => {
        setBuildingAddressName(`${address.street} ${address.number}`);
        setBuildingClients([]);
        setIsBuildingLoading(true);
        setIsBuildingModalOpen(true);
        try {
            const res = await api.get(`/api/appointments/building?projectId=${address.projectId}&street=${encodeURIComponent(address.street)}&number=${encodeURIComponent(address.number || '')}`);
            setBuildingClients(res.data);
        } catch (error) {
            console.error('Error fetching building clients:', error);
            alert(t('appointments.error_fetch_building'));
            setIsBuildingModalOpen(false);
        } finally {
            setIsBuildingLoading(false);
        }
    };

    const handleOpenAiManager = async () => {
        setIsAiModalOpen(true);
        setIsAiLoading(true);
        setAiResults(null);
        try {
            const res = await api.get(`/api/appointments/ai-manager${projectFilter ? `?projectId=${projectFilter}` : ''}`);
            setAiResults(res.data);
        } catch (error) {
            console.error('Error fetching AI suggestions:', error);
            alert('Error al analizar con IA. Verifica la conexión o la API Key.');
            setIsAiModalOpen(false);
        } finally {
            setIsAiLoading(false);
        }
    };

    const handleExportAiList = () => {
        if (!aiResults) return;
        
        const headers = ["Dirección", "Proyecto", "Cliente", "Categoría IA", "Conclusión IA", "Comentarios Técnicos"];
        const rows = [];
        
        const categories = [
            { key: 'call_back', name: 'Para Rellamar Hoy' },
            { key: 'work_finished', name: 'Trabajo Finalizado por Cliente' },
            { key: 'needs_auskundung', name: 'Requiere Auskundung/Estudio' },
            { key: 'others', name: 'Otros / Requieren Atención' }
        ];
        
        categories.forEach(cat => {
            const items = aiResults[cat.key] || [];
            items.forEach(item => {
                const id = typeof item === 'object' ? item.id : item;
                const reason = typeof item === 'object' ? item.reason : '';
                const addr = pendingAddresses.find(a => a.id === id);
                if (!addr) return;
                
                const commentsText = addr.appointment?.comments
                    ? addr.appointment.comments.map(c => `[${c.authorName}]: ${c.content}`).join(" | ")
                    : '';
                    
                rows.push([
                    `${addr.street} ${addr.number || ''}`,
                    addr.project?.name || '',
                    addr.clientName || '',
                    cat.name,
                    reason,
                    commentsText
                ]);
            });
        });
        
        // Build CSV with BOM and semicolons for Spanish Excel compatibility
        const csvContent = [
            headers.join(";"),
            ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(";"))
        ].join("\n");
        
        const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `Clasificacion_IA_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const getAiReason = (addressId) => {
        if (!aiResults) return '';
        for (const cat of ['call_back', 'work_finished', 'needs_auskundung', 'others']) {
            const found = aiResults[cat]?.find(item => (typeof item === 'object' ? item.id : item) === addressId);
            if (found && typeof found === 'object') {
                return found.reason;
            }
        }
        return '';
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
                teamId: existingAppointment.assignedSubcontractorId || existingAppointment.assignedTeamId || '',
                clientName: existingAppointment.clientName || '',
                apartmentCount: existingAppointment.apartmentCount || '',
                type: existingAppointment.type || 'ACTIVATION',
                orientationComment: existingAppointment.orientationComment || ''
            });
        } else {
            // Reset for new
            setScheduleForm({
                appointmentId: null,
                date: '',
                teamId: '',
                clientName: address.clientName || '',
                apartmentCount: address.apartmentCount || '',
                type: defaultType,
                orientationComment: ''
            });
        }
        setIsScheduleModalOpen(true);
    };

    const openEditCommentModal = (address) => {
        if (!address.appointment || !address.appointment.comments || address.appointment.comments.length === 0) return;
        
        const lastComment = address.appointment.comments[address.appointment.comments.length - 1];
        setEditingComment(lastComment);
        setEditCommentForm({ 
            content: lastComment.content || '', 
            photosToRemove: [] 
        });
        setNewEditPhotos([]);
        setIsEditCommentModalOpen(true);
    };

    const handleUpdateComment = async (e) => {
        e.preventDefault();
        setIsSavingComment(true);
        try {
            const formData = new FormData();
            formData.append('content', editCommentForm.content);
            editCommentForm.photosToRemove.forEach(p => formData.append('photosToRemove', p));
            newEditPhotos.forEach(file => formData.append('photos', file));

            await api.put(`/api/appointments/comments/${editingComment.id}`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            setIsEditCommentModalOpen(false);
            fetchData();
        } catch (error) {
            console.error(error);
            alert(t('appointments.error_cancel_appointment')); // Use a general error message if specific one not needed, or add one.
        } finally {
            setIsSavingComment(false);
        }
    };

    const openEditAddressModal = (address) => {
        setEditAddressForm({
            id: address.id,
            clientName: address.clientName || '',
            street: address.street || '',
            number: address.number || '',
            nvt: address.nvt || '',
            klsId: address.klsId || '',
            bauauftragId: address.bauauftragId || ''
        });
        setIsEditAddressModalOpen(true);
    };

    const handleEditAddressSubmit = async (e) => {
        e.preventDefault();
        setIsSavingAddress(true);
        try {
            await api.put(`/api/appointments/address/${editAddressForm.id}/details`, editAddressForm);
            setIsEditAddressModalOpen(false);
            fetchData();
        } catch (error) {
            console.error(error);
            alert(t('appointments.error_cancel_appointment'));
        } finally {
            setIsSavingAddress(false);
        }
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

    const sortAddresses = (list) => {
        return [...list].sort((a, b) => {
            const addrA = a.address || a;
            const addrB = b.address || b;
            const strA = `${addrA.street || ''} ${addrA.number || ''}`.trim();
            const strB = `${addrB.street || ''} ${addrB.number || ''}`.trim();
            return strA.localeCompare(strB, undefined, { numeric: true, sensitivity: 'base' });
        });
    };

    // Dynamic BASE_URL detection to avoid DNS issues
    const BASE_URL = window.location.origin.includes('localhost') 
        ? 'http://localhost:3000' 
        : window.location.origin;

    const allPendingFiltered = sortAddresses(filterAppointments(pendingAddresses));

    // Addresses with Recita/Incident requests
    const filteredRecite = sortAddresses(allPendingFiltered.filter(a => a.appointment?.status === 'RECITAR'));

    // Addresses that NEED Protocol check (excluding RECITAR)
    const filteredProtocols = sortAddresses(allPendingFiltered.filter(a => 
        a.requiresProtocol && a.protocolStatus !== 'OK' && a.appointment?.status !== 'RECITAR'
    ));

    // Addresses ready for Activation (or standard) (excluding RECITAR)
    const filteredPending = sortAddresses(allPendingFiltered.filter(a =>
        (!a.requiresProtocol || a.protocolStatus === 'OK') && a.appointment?.status !== 'RECITAR'
    ));

    // Custom sort for Scheduled
    const customSortScheduled = (list) => {
        return [...list].sort((a, b) => {
            const addrA = a.address || a;
            const addrB = b.address || b;
            
            let comparison = 0;
            
            if (sortColumn === 'date') {
                const dateA = a.assignedDate ? new Date(a.assignedDate).getTime() : 0;
                const dateB = b.assignedDate ? new Date(b.assignedDate).getTime() : 0;
                comparison = dateA - dateB;
            } else if (sortColumn === 'address') {
                const strA = `${addrA.street || ''} ${addrA.number || ''}`.trim();
                const strB = `${addrB.street || ''} ${addrB.number || ''}`.trim();
                comparison = strA.localeCompare(strB, undefined, { numeric: true, sensitivity: 'base' });
            } else if (sortColumn === 'nvt') {
                const nvtA = addrA.nvt || '';
                const nvtB = addrB.nvt || '';
                comparison = nvtA.localeCompare(nvtB, undefined, { numeric: true, sensitivity: 'base' });
            } else if (sortColumn === 'team') {
                const teamA = a.assignedSubcontractor ? a.assignedSubcontractor.name : (a.assignedTeam ? a.assignedTeam.name : '');
                const teamB = b.assignedSubcontractor ? b.assignedSubcontractor.name : (b.assignedTeam ? b.assignedTeam.name : '');
                comparison = teamA.localeCompare(teamB, undefined, { sensitivity: 'base' });
            }

            return sortDirection === 'asc' ? comparison : -comparison;
        });
    };

    const filteredScheduled = customSortScheduled(filterAppointments(scheduledAppointments));

    const handleSort = (column) => {
        if (sortColumn === column) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection('asc');
        }
    };
    const filteredEscalated = sortAddresses(filterAppointments(escalatedAddresses));

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h2 className="text-2xl font-bold text-slate-800">{t('appointments.management_title')}</h2>
                <div className="flex bg-slate-200 p-1 rounded-lg">
                    <button
                        onClick={() => setView('pending')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${view === 'pending' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-800'
                            }`}
                    >
                        {t('appointments.pending')} ({filteredPending.length})
                    </button>
                    <button
                        onClick={() => setView('protocols')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${view === 'protocols' ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-600 hover:text-slate-800'
                            }`}
                    >
                        {t('appointments.protocols')} ({filteredProtocols.length})
                    </button>
                    <button
                        onClick={() => setView('recita')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${view === 'recita' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-600 hover:text-slate-800'
                            }`}
                    >
                        {t('appointments.recitas')} ({filteredRecite.length})
                    </button>
                    <button
                        onClick={() => setView('scheduled')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${view === 'scheduled' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-800'
                            }`}
                    >
                        {t('appointments.scheduled')} ({filteredScheduled.length})
                    </button>
                    <button
                        onClick={() => setView('escalated')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${view === 'escalated' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-600 hover:text-slate-800'
                            }`}
                    >
                        {t('appointments.archived')} ({filteredEscalated.length})
                    </button>
                </div>
            </div>

            {/* Filters Bar */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 items-center">
                <div className="flex-1 w-full">
                    <input
                        type="text"
                        placeholder={t('appointments.search_placeholder')}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>

                {view === 'scheduled' && (
                    <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => {
                                    const today = new Date().toISOString().split('T')[0];
                                    setStartDate(today);
                                    setEndDate(today);
                                }}
                                className="bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-2 rounded-lg transition-all text-xs font-black uppercase tracking-tight border border-blue-200 active:scale-95 flex items-center gap-1.5 shadow-sm"
                                title={t('appointments.view_today')}
                            >
                                <Calendar size={14} />
                                {t('appointments.view_today')}
                            </button>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                            <span className="text-slate-400 text-xs font-bold uppercase">{t('appointments.to')}</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                        <button
                            onClick={handleExport}
                            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-all flex items-center justify-center gap-2 text-sm font-bold shadow-sm active:scale-95"
                        >
                            <Download size={18} />
                            <span>{t('appointments.export')}</span>
                        </button>
                    </div>
                )}

                <div className="w-full md:w-auto flex flex-col md:flex-row gap-2 items-center">
                    <select
                        value={projectFilter}
                        onChange={(e) => setProjectFilter(e.target.value)}
                        className="w-full md:w-64 border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                    >
                        <option value="">{t('appointments.all_projects')}</option>
                        {projects.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                    
                    <button
                        onClick={handleExportAll}
                        disabled={!projectFilter}
                        className={`px-4 py-2 rounded-lg flex items-center justify-center gap-2 text-sm font-bold shadow-sm transition-all whitespace-nowrap w-full md:w-auto ${
                            projectFilter 
                            ? 'bg-indigo-600 hover:bg-indigo-700 text-white active:scale-95' 
                            : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        }`}
                        title={!projectFilter ? t('appointments.select_project_first') : t('appointments.export_project_report')}
                    >
                        <Download size={18} />
                        <span className="hidden md:inline">{t('appointments.export_project_report')}</span>
                        <span className="md:hidden">{t('appointments.export_project_report_mobile')}</span>
                    </button>

                    {view === 'pending' && (
                        <button
                            onClick={handleOpenAiManager}
                            className="px-4 py-2 rounded-lg flex items-center justify-center gap-2 text-sm font-bold shadow-sm transition-all whitespace-nowrap w-full md:w-auto bg-purple-600 hover:bg-purple-700 text-white active:scale-95"
                            title="Clasificar pendientes con IA"
                        >
                            <Sparkles size={18} />
                            Gestor IA ✨
                        </button>
                    )}
                </div>
            </div>

            {view === 'pending' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {filteredPending.map(address => (
                        <div key={address.id} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-bold text-lg text-slate-800">{address.street} {address.number}</h3>
                                        <button 
                                            onClick={() => openEditAddressModal(address)}
                                            className="text-slate-400 hover:text-blue-600 transition-colors p-1"
                                            title="Editar ficha (Nombre, Bauauftrag, KLS, NVT)"
                                        >
                                            <Pencil size={14} />
                                        </button>
                                    </div>
                                    {address.clientName && (
                                        <p className="text-sm font-semibold text-blue-600 mb-1">{address.clientName}</p>
                                    )}
                                    <p className="text-sm text-slate-500">
                                        {address.project.name} | NVT: {address.nvt} | Bauauftrag: {address.bauauftragId || address.klsId || 'N/A'}
                                        {address.apartmentCount ? (
                                            <> | <span 
                                                onClick={() => openBuildingClientsModal(address)} 
                                                className="cursor-pointer font-bold text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1"
                                                title="Ver todos los clientes de este edificio"
                                            >
                                                Aptos: {address.apartmentCount}
                                            </span></>
                                        ) : ''}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <span className="inline-block px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-full font-bold mb-1">
                                        {t('appointments.attempts')}: {address.appointment?.contactAttempts || 0}/4
                                    </span>
                                    <p className="text-xs text-slate-400">
                                        {address.appointment?.updatedAt ? new Date(address.appointment.updatedAt).toLocaleDateString('es-ES') : t('appointments.no_contact')}
                                    </p>
                                </div>
                            </div>

                            {/* Alert for Protocol */}
                            {address.requiresProtocol && address.protocolStatus !== 'OK' && (
                                <div className="mb-4 bg-purple-50 border border-purple-100 p-3 rounded-lg flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2 text-purple-700">
                                        <FileText size={16} />
                                        <div className="text-xs">
                                            <span className="font-bold block">{t('appointments.requires_protocol')}</span>
                                            <span className="opacity-75">{t('appointments.current_status')} {address.protocolStatus}</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleProtocolOverride(address.id)}
                                        className="text-xs bg-purple-200 hover:bg-purple-300 text-purple-800 px-2 py-1 rounded transition-colors"
                                        title={t('appointments.force_ok')}
                                    >
                                        {t('appointments.force_ok')}
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
                                            <p className="text-xs font-black text-red-700 uppercase tracking-widest">{t('appointments.recita_request')}</p>
                                            <div className="flex items-center gap-2">
                                                <p className="text-[10px] text-red-400 font-bold">
                                                    {address.appointment.comments && address.appointment.comments.length > 0 ? address.appointment.comments[address.appointment.comments.length - 1].authorName : 'Técnico'}
                                                </p>
                                                <button 
                                                    onClick={() => openEditCommentModal(address)}
                                                    className="p-1 bg-red-100 text-red-600 rounded hover:bg-red-200 transition-colors"
                                                    title={t('appointments.edit_evidences')}
                                                >
                                                    <Pencil size={10} />
                                                </button>
                                            </div>
                                        </div>
                                        <p className="text-sm text-red-900 font-medium mb-3">
                                            {address.appointment.comments && address.appointment.comments.length > 0
                                                ? address.appointment.comments[address.appointment.comments.length - 1].content
                                                : t('appointments.no_reason')}
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
                                <div className="mb-4 bg-slate-50 p-3 rounded-xl text-[11px] text-slate-600 space-y-2 border border-slate-100 shadow-inner">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('appointments.last_actions')}</p>
                                    {address.appointment.contactHistory.slice(-5).map((entry, i) => (
                                        <div key={i} className="flex gap-2">
                                            <span className="text-blue-400 font-bold">•</span>
                                            <span>{entry}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="flex flex-col gap-3 mt-4">
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => openContactModal(address)}
                                        className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors text-sm font-semibold"
                                    >
                                        <Phone size={16} /> {t('appointments.contact')}
                                    </button>
                                    <button
                                        onClick={() => openScheduleModal(address)}
                                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg flex items-center justify-center gap-2 transition-colors text-sm font-semibold shadow-sm"
                                    >
                                        <Calendar size={16} /> {t('appointments.schedule')}
                                    </button>
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => openDeriveModal(address, 'DERIVADA')}
                                        className="flex-1 bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 py-1.5 rounded-lg flex items-center justify-center gap-2 transition-colors text-xs font-semibold"
                                        title={t('appointments.order_derivation')}
                                    >
                                        <Send size={14} /> {t('appointments.derive')}
                                    </button>
                                    <button
                                        onClick={() => openDeriveModal(address, 'CERRADA')}
                                        className="flex-1 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 py-1.5 rounded-lg flex items-center justify-center gap-2 transition-colors text-xs font-semibold"
                                        title={t('appointments.order_closing')}
                                    >
                                        <CheckSquare size={14} /> {t('appointments.order_closed')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                    {filteredPending.length === 0 && (
                        <div className="col-span-full text-center py-12 text-slate-400">
                            {t('appointments.no_pending_found')}
                        </div>
                    )}
                </div>
            )}

            {view === 'recita' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {filteredRecite.map(address => (
                        <div key={address.id} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-bold text-lg text-slate-800">{address.street} {address.number}</h3>
                                        <button 
                                            onClick={() => openEditAddressModal(address)}
                                            className="text-slate-400 hover:text-blue-600 transition-colors p-1"
                                            title="Editar ficha (Nombre, Bauauftrag, KLS, NVT)"
                                        >
                                            <Pencil size={14} />
                                        </button>
                                    </div>
                                    {address.clientName && (
                                        <p className="text-sm font-semibold text-blue-600 mb-1">{address.clientName}</p>
                                    )}
                                    <p className="text-sm text-slate-500">
                                        {address.project.name} | NVT: {address.nvt} | Bauauftrag: {address.bauauftragId || address.klsId || 'N/A'}
                                        {address.apartmentCount ? (
                                            <> | <span 
                                                onClick={() => openBuildingClientsModal(address)} 
                                                className="cursor-pointer font-bold text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1"
                                                title="Ver todos los clientes de este edificio"
                                            >
                                                Aptos: {address.apartmentCount}
                                            </span></>
                                        ) : ''}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <span className="inline-block px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-full font-bold mb-1">
                                        {t('appointments.attempts')}: {address.appointment?.contactAttempts || 0}/4
                                    </span>
                                    <p className="text-xs text-slate-400">
                                        {address.appointment?.updatedAt ? new Date(address.appointment.updatedAt).toLocaleDateString('es-ES') : t('appointments.no_contact')}
                                    </p>
                                </div>
                            </div>

                            {/* Alert for Protocol */}
                            {address.requiresProtocol && address.protocolStatus !== 'OK' && (
                                <div className="mb-4 bg-purple-50 border border-purple-100 p-3 rounded-lg flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2 text-purple-700">
                                        <FileText size={16} />
                                        <div className="text-xs">
                                            <span className="font-bold block">{t('appointments.requires_protocol')}</span>
                                            <span className="opacity-75">{t('appointments.current_status')} {address.protocolStatus}</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleProtocolOverride(address.id)}
                                        className="text-xs bg-purple-200 hover:bg-purple-300 text-purple-800 px-2 py-1 rounded transition-colors"
                                        title={t('appointments.force_ok')}
                                    >
                                        {t('appointments.force_ok')}
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
                                            <p className="text-xs font-black text-red-700 uppercase tracking-widest">{t('appointments.recita_request')}</p>
                                            <div className="flex items-center gap-2">
                                                <p className="text-[10px] text-red-400 font-bold">
                                                    {address.appointment.comments && address.appointment.comments.length > 0 ? address.appointment.comments[address.appointment.comments.length - 1].authorName : 'Técnico'}
                                                </p>
                                                <button 
                                                    onClick={() => openEditCommentModal(address)}
                                                    className="p-1 bg-red-100 text-red-600 rounded hover:bg-red-200 transition-colors"
                                                    title={t('appointments.edit_evidences')}
                                                >
                                                    <Pencil size={10} />
                                                </button>
                                            </div>
                                        </div>
                                        <p className="text-sm text-red-900 font-medium mb-3">
                                            {address.appointment.comments && address.appointment.comments.length > 0
                                                ? address.appointment.comments[address.appointment.comments.length - 1].content
                                                : t('appointments.no_reason')}
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
                                <div className="mb-4 bg-slate-50 p-3 rounded-xl text-[11px] text-slate-600 space-y-2 border border-slate-100 shadow-inner">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('appointments.last_actions')}</p>
                                    {address.appointment.contactHistory.slice(-5).map((entry, i) => (
                                        <div key={i} className="flex gap-2">
                                            <span className="text-blue-400 font-bold">•</span>
                                            <span>{entry}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="flex flex-col gap-3 mt-4">
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => openContactModal(address)}
                                        className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors text-sm font-semibold"
                                    >
                                        <Phone size={16} /> {t('appointments.contact')}
                                    </button>
                                    <button
                                        onClick={() => openScheduleModal(address)}
                                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg flex items-center justify-center gap-2 transition-colors text-sm font-semibold shadow-sm"
                                    >
                                        <Calendar size={16} /> {t('appointments.schedule')}
                                    </button>
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => openDeriveModal(address, 'DERIVADA')}
                                        className="flex-1 bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 py-1.5 rounded-lg flex items-center justify-center gap-2 transition-colors text-xs font-semibold"
                                        title={t('appointments.order_derivation')}
                                    >
                                        <Send size={14} /> {t('appointments.derive')}
                                    </button>
                                    <button
                                        onClick={() => openDeriveModal(address, 'CERRADA')}
                                        className="flex-1 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 py-1.5 rounded-lg flex items-center justify-center gap-2 transition-colors text-xs font-semibold"
                                        title={t('appointments.order_closing')}
                                    >
                                        <CheckSquare size={14} /> {t('appointments.order_closed')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                    {filteredRecite.length === 0 && (
                        <div className="col-span-full text-center py-12 text-slate-400">
                            {t('appointments.no_recitas_found')}
                        </div>
                    )}
                </div>
            )}

            {view === 'protocols' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {filteredProtocols.map(address => (
                        <div key={address.id} className="bg-purple-50 p-6 rounded-xl shadow-sm border border-purple-200 relative overflow-hidden">
                            <div className="absolute top-0 right-0 bg-purple-200 text-purple-800 text-xs px-2 py-1 rounded-bl-lg font-bold">
                                {t('appointments.requires_protocol').toUpperCase()}
                            </div>

                            <div className="flex justify-between items-start mb-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-bold text-lg text-slate-800">{address.street} {address.number}</h3>
                                        <button 
                                            onClick={() => openEditAddressModal(address)}
                                            className="text-slate-400 hover:text-purple-600 transition-colors p-1"
                                            title="Editar ficha (Nombre, Bauauftrag, KLS, NVT)"
                                        >
                                            <Pencil size={14} />
                                        </button>
                                    </div>
                                    {address.clientName && (
                                        <p className="text-sm font-semibold text-purple-700 mb-1">{address.clientName}</p>
                                    )}
                                    <p className="text-sm text-slate-500">
                                        {address.project.name} | NVT: {address.nvt}
                                        {address.apartmentCount ? (
                                            <> | <span 
                                                onClick={() => openBuildingClientsModal(address)} 
                                                className="cursor-pointer font-bold text-purple-600 hover:text-purple-800 hover:underline inline-flex items-center gap-1"
                                                title="Ver todos los clientes de este edificio"
                                            >
                                                Aptos: {address.apartmentCount}
                                            </span></>
                                        ) : ''}
                                    </p>
                                </div>
                            </div>

                            <div className="flex flex-col gap-3 mt-4">
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => openContactModal(address)}
                                        className="flex-1 bg-white hover:bg-slate-50 text-slate-700 py-2 rounded-lg flex items-center justify-center gap-2 border border-slate-200 transition-colors text-sm font-semibold"
                                    >
                                        <Phone size={16} /> {t('appointments.contact')}
                                    </button>
                                    <button
                                        onClick={() => openScheduleModal(address, null, 'PROTOCOL')}
                                        className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-sm text-sm font-semibold"
                                    >
                                        <Calendar size={16} /> {t('appointments.schedule_protocol')}
                                    </button>
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => openDeriveModal(address, 'DERIVADA')}
                                        className="flex-1 bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 py-1.5 rounded-lg flex items-center justify-center gap-2 transition-colors text-xs font-semibold"
                                        title={t('appointments.order_derivation')}
                                    >
                                        <Send size={14} /> {t('appointments.derive')}
                                    </button>
                                    <button
                                        onClick={() => openDeriveModal(address, 'CERRADA')}
                                        className="flex-1 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 py-1.5 rounded-lg flex items-center justify-center gap-2 transition-colors text-xs font-semibold"
                                        title={t('appointments.order_closing')}
                                    >
                                        <CheckSquare size={14} /> {t('appointments.order_closed')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                    {filteredProtocols.length === 0 && (
                        <div className="col-span-full text-center py-12 text-slate-400">
                            {t('appointments.no_protocol_found')}
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
                                title={t('appointments.view_list')}
                            >
                                <List size={20} />
                            </button>
                            <button
                                onClick={() => setScheduledViewMode('calendar')}
                                className={`p-2 rounded-md transition-all ${scheduledViewMode === 'calendar' ? 'bg-slate-100 text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                                title={t('appointments.view_calendar')}
                            >
                                <Grid size={20} />
                            </button>
                        </div>
                    </div>

                    {scheduledViewMode === 'list' ? (
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-visible">
                            <table className="w-full text-left text-sm text-slate-600">
                                <thead className="bg-slate-50 text-slate-800 font-bold border-b border-slate-200">
                                    <tr>
                                        <th className="p-4 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('date')}>
                                            <div className="flex items-center gap-1">{t('appointments.date')} {sortColumn === 'date' && (sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}</div>
                                        </th>
                                        <th className="p-4 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('address')}>
                                            <div className="flex items-center gap-1">{t('appointments.address')} {sortColumn === 'address' && (sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}</div>
                                        </th>
                                        <th className="p-4 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('nvt')}>
                                            <div className="flex items-center gap-1">NVT {sortColumn === 'nvt' && (sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}</div>
                                        </th>
                                        <th className="p-4 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('team')}>
                                            <div className="flex items-center gap-1">{t('appointments.assigned_team')} {sortColumn === 'team' && (sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}</div>
                                        </th>
                                        <th className="p-4">{t('appointments.status')}</th>
                                        <th className="p-4 text-right">{t('appointments.actions')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredScheduled.map(app => (
                                        <tr key={app.id} className="hover:bg-slate-50">
                                            <td className="p-4 font-medium">
                                                {app.assignedDate ? (
                                                    <>
                                                        {new Date(app.assignedDate).toLocaleDateString('es-ES')}
                                                        <div className="text-xs text-slate-400">{new Date(app.assignedDate).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</div>
                                                    </>
                                                ) : (
                                                    <span className="text-slate-400 italic text-xs">{t('appointments.no_date')}</span>
                                                )}
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="font-bold text-slate-800">{app.address.street} {app.address.number}</div>
                                                    <button 
                                                        onClick={() => openEditAddressModal(app.address)}
                                                        className="text-slate-400 hover:text-blue-600 transition-colors p-1"
                                                        title="Editar ficha"
                                                    >
                                                        <Pencil size={12} />
                                                    </button>
                                                </div>
                                                <div className="text-xs text-slate-500 mb-1.5">{app.address.project.name}</div>
                                                
                                                {/* Inline Compact Data */}
                                                <div className="text-[10px] sm:text-xs flex flex-wrap gap-1 mt-1">
                                                    <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
                                                        {app.clientName || t('appointments.no_client')}
                                                    </span>
                                                    <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
                                                        {app.apartmentCount || '?'} Apts
                                                    </span>
                                                    <span className={`px-1.5 py-0.5 rounded border ${app.type === 'REPAIR' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-green-50 text-green-600 border-green-100'}`}>
                                                        {app.type === 'REPAIR' ? t('appointments.repair') : (app.type || t('appointments.activation'))}
                                                    </span>
                                                </div>
                                                
                                                {app.orientationComment && (
                                                    <div className="mt-1.5 text-xs bg-blue-50/80 text-blue-800 p-1.5 rounded-lg border border-blue-100 inline-block w-full">
                                                        <span className="font-bold text-blue-600 mr-1">{t('appointments.note')}</span>
                                                        <span className="whitespace-pre-wrap">{app.orientationComment}</span>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-4 font-medium text-slate-700">
                                                {app.address.nvt || '-'}
                                            </td>
                                            <td className="p-4">
                                                 {app.assignedSubcontractor ? (
                                                     <span className="flex items-center gap-2">
                                                         <Users size={14} /> {app.assignedSubcontractor.name}
                                                     </span>
                                                 ) : app.assignedTeam ? (
                                                     <span className="flex items-center gap-2">
                                                         <Users size={14} /> {app.assignedTeam.name}
                                                     </span>
                                                 ) : <span className="text-red-400">{t('appointments.unassigned')}</span>}
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
                        <CalendarView 
                            appointments={filteredScheduled} 
                            onEventClick={(app) => openScheduleModal(app.address, app)} 
                        />
                    )}
                </div>
            )}

            {view === 'escalated' && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <table className="w-full text-left text-sm text-slate-600">
                        <thead className="bg-slate-50 text-slate-800 font-bold border-b border-slate-200">
                            <tr>
                                <th className="p-4">{t('appointments.address')}</th>
                                <th className="p-4">{t('appointments.client')}</th>
                                <th className="p-4">{t('appointments.project')}</th>
                                <th className="p-4">{t('appointments.status_cause')}</th>
                                <th className="p-4 text-right">{t('appointments.actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredEscalated.map(address => (
                                <tr key={address.id} className="hover:bg-slate-50">
                                    <td className="p-4">
                                        <div className="flex items-center gap-2">
                                            <div className="font-bold text-slate-800">{address.street} {address.number}</div>
                                            <button 
                                                onClick={() => openEditAddressModal(address)}
                                                className="text-slate-400 hover:text-blue-600 transition-colors p-1"
                                                title="Editar ficha"
                                            >
                                                <Pencil size={12} />
                                            </button>
                                        </div>
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
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => openHistoryModal(address)}
                                                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md transition-colors"
                                                title={t('appointments.history_and_cause')}
                                            >
                                                <Clock size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleResetOrder(address.id)}
                                                className="px-3 py-1 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-md text-xs font-medium transition-colors"
                                                title={t('appointments.restore')}
                                            >
                                                {t('appointments.restore')}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filteredEscalated.length === 0 && (
                        <div className="text-center py-12 text-slate-400">
                            {t('appointments.no_archived')}
                        </div>
                    )}
                </div>
            )}

            {/* Contact Modal */}
            {isContactModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
                        <h3 className="text-xl font-bold mb-4">{t('appointments.register_contact')}</h3>
                        <p className="text-sm text-slate-500 mb-4">{selectedAddress?.street} {selectedAddress?.number}</p>
                        <form onSubmit={handleContactSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">{t('appointments.result')}</label>
                                <select
                                    value={contactForm.result}
                                    onChange={(e) => setContactForm({ ...contactForm, result: e.target.value })}
                                    className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    <option value="No contesta">{t('appointments.no_answer')}</option>
                                    <option value="Número equivocado">{t('appointments.wrong_number')}</option>
                                    <option value="Buzón de voz">{t('appointments.voicemail')}</option>
                                    <option value="Contactado - Pide llamar luego">{t('appointments.call_later')}</option>
                                    <option value="Contactado - Rechaza">{t('appointments.rejects')}</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">{t('appointments.comment_optional')}</label>
                                <textarea
                                    value={contactForm.comment}
                                    onChange={(e) => setContactForm({ ...contactForm, comment: e.target.value })}
                                    className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none h-24 resize-none"
                                />
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <button type="button" onClick={() => setIsContactModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">{t('appointments.cancel')}</button>
                                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">{t('appointments.save')}</button>
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
                            <h3 className="text-xl font-bold">{t('appointments.schedule_appointment')}</h3>
                            <button onClick={() => setIsGeneralCalendarOpen(true)} className="text-blue-600 text-sm font-bold hover:underline flex items-center gap-1">
                                <Grid size={16} /> {t('appointments.view_general_calendar')}
                            </button>
                        </div>
                        <p className="text-sm text-slate-500 mb-4">{selectedAddress?.street} {selectedAddress?.number}</p>
                        <form onSubmit={handleScheduleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">{t('appointments.appointment_type')}</label>
                                <select
                                    value={scheduleForm.type}
                                    onChange={(e) => setScheduleForm({ ...scheduleForm, type: e.target.value })}
                                    className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    <option value="ACTIVATION">{t('appointments.type_activation')}</option>
                                    <option value="PROTOCOL">{t('appointments.type_protocol')}</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">{t('appointments.client_name')}</label>
                                <input
                                    type="text"
                                    value={scheduleForm.clientName}
                                    onChange={(e) => setScheduleForm({ ...scheduleForm, clientName: e.target.value })}
                                    className={`w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none ${selectedAddress?.clientName ? 'bg-slate-100 text-slate-500' : ''}`}
                                    placeholder={t('appointments.client_name')}
                                    readOnly={!!selectedAddress?.clientName}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">{t('appointments.apartments_count')}</label>
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
                                <label className="block text-sm font-medium text-slate-700 mb-1">{t('appointments.date_time')}</label>
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
                                        title={t('appointments.view_calendar')}
                                    >
                                        <Calendar size={20} />
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">{t('appointments.assign_team')}</label>
                                <select
                                    value={scheduleForm.teamId}
                                    onChange={(e) => setScheduleForm({ ...scheduleForm, teamId: e.target.value })}
                                    className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                    required
                                >
                                    <option value="">{t('appointments.select_team')}</option>
                                    {teams.map(team => (
                                        <option key={team.id} value={team.id}>{team.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">{t('appointments.orientation_comment')}</label>
                                <textarea
                                    value={scheduleForm.orientationComment}
                                    onChange={(e) => setScheduleForm({ ...scheduleForm, orientationComment: e.target.value })}
                                    className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none h-20 resize-none"
                                    placeholder="Ej. El cliente ya tiene la instalación hecha, solo es activar..."
                                />
                            </div>
                            <div className="flex justify-between mt-6">
                                {scheduleForm.appointmentId ? (
                                    <button
                                        type="button"
                                        onClick={handleCancelAppointment}
                                        className="px-4 py-2 text-red-600 hover:bg-red-50 hover:text-red-700 rounded-lg border border-red-200 transition-colors"
                                    >
                                        {t('appointments.delete_appointment')}
                                    </button>
                                ) : <div></div>}
                                <div className="flex gap-3">
                                    <button type="button" onClick={() => setIsScheduleModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">{t('appointments.close')}</button>
                                    <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">{t('appointments.save')}</button>
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
                            <h3 className="text-xl font-bold text-slate-800">{t('appointments.general_calendar_title')}</h3>
                            <button onClick={() => setIsGeneralCalendarOpen(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-500">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-hidden p-4 bg-slate-50">
                            <div className="mb-4 bg-blue-50 p-3 rounded-lg text-blue-700 text-sm flex items-center gap-2">
                                <CheckCircle size={16} />
                                {t('appointments.click_to_select')}
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
            {/* Edit Comment/Photos Modal */}
            {isEditCommentModalOpen && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="bg-slate-800 p-6 text-white flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-black flex items-center gap-2">
                                    <Pencil size={20} className="text-blue-400" />
                                    {t('appointments.edit_evidences')}
                                </h3>
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">{t('appointments.refine_report')}</p>
                            </div>
                            <button onClick={() => setIsEditCommentModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                                <X size={24} />
                            </button>
                        </div>
                        
                        <form onSubmit={handleUpdateComment} className="p-8 space-y-6">
                            {/* TEXT CONTENT */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">{t('appointments.reason_comment')}</label>
                                <textarea 
                                    className="w-full bg-slate-50 p-4 rounded-2xl border-2 border-slate-100 outline-none focus:border-blue-500 transition-all font-medium text-slate-700 min-h-[120px]"
                                    value={editCommentForm.content}
                                    onChange={(e) => setEditCommentForm({ ...editCommentForm, content: e.target.value })}
                                    required
                                />
                            </div>

                            {/* CURRENT PHOTOS WITH DELETE OPTION */}
                            <div className="space-y-4">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">{t('appointments.current_photos')}</label>
                                <div className="grid grid-cols-4 gap-3">
                                    {editingComment?.photos?.filter(p => !editCommentForm.photosToRemove.includes(p)).map((photo, pIdx) => (
                                        <div key={pIdx} className="relative aspect-square group">
                                            <img src={`${BASE_URL}${photo}`} className="w-full h-full object-cover rounded-xl shadow-md" alt="Preview" />
                                            <button 
                                                type="button"
                                                onClick={() => setEditCommentForm({
                                                    ...editCommentForm,
                                                    photosToRemove: [...editCommentForm.photosToRemove, photo]
                                                })}
                                                className="absolute -top-2 -right-2 bg-red-600 text-white p-1.5 rounded-full shadow-lg hover:scale-110 transition-all"
                                            >
                                                <Trash size={12} />
                                            </button>
                                        </div>
                                    ))}
                                    {editingComment?.photos?.length === 0 && (
                                        <div className="col-span-full py-4 text-center text-[10px] font-black text-slate-300 uppercase tracking-widest border-2 border-dashed border-slate-100 rounded-2xl">
                                            {t('appointments.no_photos')}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* ADD NEW PHOTOS */}
                            <div className="space-y-4">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">{t('appointments.add_new_evidences')}</label>
                                <div className="flex gap-2 flex-wrap">
                                    {newEditPhotos.map((file, fIdx) => (
                                        <div key={fIdx} className="relative w-16 h-16">
                                            <img src={URL.createObjectURL(file)} className="w-full h-full object-cover rounded-lg border-2 border-blue-200" alt="New" />
                                            <button 
                                                type="button"
                                                onClick={() => setNewEditPhotos(newEditPhotos.filter((_, i) => i !== fIdx))}
                                                className="absolute -top-1 -right-1 bg-slate-800 text-white p-1 rounded-full shadow-md"
                                            >
                                                <X size={10} />
                                            </button>
                                        </div>
                                    ))}
                                    <label className="w-16 h-16 flex flex-col items-center justify-center border-2 border-dashed border-blue-200 text-blue-500 rounded-lg cursor-pointer hover:bg-blue-50 transition-all">
                                        <Plus size={20} />
                                        <input 
                                            type="file" 
                                            multiple 
                                            accept="image/*" 
                                            className="hidden" 
                                            onChange={(e) => setNewEditPhotos([...newEditPhotos, ...Array.from(e.target.files)])}
                                        />
                                    </label>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isSavingComment}
                                className="w-full py-4 bg-blue-600 text-white rounded-3xl font-black uppercase tracking-widest shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all flex items-center justify-center gap-3"
                            >
                                {isSavingComment ? <Loader className="animate-spin" /> : <CheckCircle size={20} />}
                                {t('appointments.save_report_changes')}
                            </button>
                        </form>
                    </div>
                </div>
            )}
            {/* Edit Address Master Data Modal */}
            {isEditAddressModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] backdrop-blur-sm p-4">
                    <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden animate-slideUp">
                        <div className="bg-slate-900 p-6 text-white flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-bold flex items-center gap-2">
                                    <Pencil size={20} className="text-blue-400" /> {t('appointments.edit_master_data')}
                                </h3>
                                <p className="text-slate-400 text-xs mt-1 uppercase font-black tracking-widest">{t('appointments.master_data_correction')}</p>
                            </div>
                            <button onClick={() => setIsEditAddressModalOpen(false)} className="bg-slate-800 p-2 rounded-xl text-slate-400 hover:text-white transition-all">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleEditAddressSubmit} className="p-8 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">{t('appointments.client_name_ref')}</label>
                                        <input 
                                            type="text" 
                                            value={editAddressForm.clientName} 
                                            onChange={(e) => setEditAddressForm({ ...editAddressForm, clientName: e.target.value })}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-800"
                                            placeholder="Nombre completo..."
                                        />
                                    </div>
                                    <div className="grid grid-cols-4 gap-2">
                                        <div className="col-span-3">
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">{t('appointments.street')}</label>
                                            <input 
                                                type="text" 
                                                value={editAddressForm.street} 
                                                onChange={(e) => setEditAddressForm({ ...editAddressForm, street: e.target.value })}
                                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-800"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">{t('appointments.number')}</label>
                                            <input 
                                                type="text" 
                                                value={editAddressForm.number} 
                                                onChange={(e) => setEditAddressForm({ ...editAddressForm, number: e.target.value })}
                                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-800 text-center"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Bauauftrag ID</label>
                                        <input 
                                            type="text" 
                                            value={editAddressForm.bauauftragId} 
                                            onChange={(e) => setEditAddressForm({ ...editAddressForm, bauauftragId: e.target.value })}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-800"
                                            placeholder="Ej: BA-12345"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">KLS ID (Legado)</label>
                                        <input 
                                            type="text" 
                                            value={editAddressForm.klsId} 
                                            onChange={(e) => setEditAddressForm({ ...editAddressForm, klsId: e.target.value })}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-800"
                                            placeholder="Ej: 5900000"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">NVT / Referencia Técnica</label>
                                        <input 
                                            type="text" 
                                            value={editAddressForm.nvt} 
                                            onChange={(e) => setEditAddressForm({ ...editAddressForm, nvt: e.target.value })}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-800 uppercase"
                                            placeholder="Ej: 4V4500"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="bg-blue-50 p-4 rounded-3xl border border-blue-100 flex gap-3">
                                <div className="bg-blue-600 p-2 rounded-2xl text-white shadow-lg">
                                    <FileText size={20} />
                                </div>
                                <div className="text-xs text-blue-800">
                                    <p className="font-bold">{t('appointments.important_note')}</p>
                                    <p className="opacity-80">{t('appointments.important_note_desc')}</p>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isSavingAddress}
                                className="w-full py-4 bg-slate-900 text-white rounded-3xl font-black uppercase tracking-widest shadow-xl hover:bg-black transition-all flex items-center justify-center gap-3"
                            >
                                {isSavingAddress ? <Loader className="animate-spin" /> : <Save size={20} />}
                                {t('appointments.save_card_changes')}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Derivation / Order Status Modal with Reason */}
            {isDeriveModalOpen && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] backdrop-blur-sm p-4">
                    <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-slideUp">
                        <div className={`p-6 text-white flex justify-between items-center ${deriveForm.status === 'DERIVADA' ? 'bg-orange-600' : 'bg-green-600'}`}>
                            <div>
                                <h3 className="text-xl font-bold flex items-center gap-2">
                                    <Send size={20} /> {deriveForm.status === 'DERIVADA' ? t('appointments.order_derivation') : t('appointments.order_closing')}
                                </h3>
                                <p className="text-white/80 text-[10px] mt-1 uppercase font-black tracking-widest">{t('appointments.justification_required')}</p>
                            </div>
                            <button onClick={() => setIsDeriveModalOpen(false)} className="bg-white/10 p-2 rounded-xl hover:bg-white/20 transition-all text-white">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleDeriveSubmit} className="p-8 space-y-6">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">{t('appointments.specify_reason')}</label>
                                <textarea 
                                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 outline-none focus:border-orange-500 transition-all font-bold text-slate-800 h-32 resize-none"
                                    placeholder={deriveForm.status === 'DERIVADA' ? "Ej: Acometida no instalada por obra civil..." : "Ej: Trabajo terminado por empresa colaboradora..."}
                                    value={deriveForm.reason}
                                    onChange={(e) => setDeriveForm({ ...deriveForm, reason: e.target.value })}
                                    required
                                />
                                <p className="text-[10px] text-slate-400 mt-2 px-1">{t('appointments.reason_saved')}</p>
                            </div>
                            <button
                                type="submit"
                                className={`w-full py-4 text-white rounded-3xl font-black uppercase tracking-widest shadow-xl transition-all flex items-center justify-center gap-3 ${deriveForm.status === 'DERIVADA' ? 'bg-orange-600 shadow-orange-100 hover:bg-orange-700' : 'bg-green-600 shadow-green-100 hover:bg-green-700'}`}
                            >
                                <CheckCircle size={20} />
                                {deriveForm.status === 'DERIVADA' ? t('appointments.confirm_derivation') : t('appointments.confirm_closing')}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* History Modal */}
            {isHistoryModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[80] backdrop-blur-sm p-4">
                    <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-slideUp">
                        <div className="bg-slate-900 p-6 text-white flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-bold flex items-center gap-2">
                                    <Clock size={20} className="text-blue-400" /> {t('appointments.history_actions')}
                                </h3>
                                <p className="text-slate-400 text-[10px] mt-1 uppercase font-black tracking-widest">{historyAddressName}</p>
                            </div>
                            <button onClick={() => setIsHistoryModalOpen(false)} className="bg-slate-800 p-2 rounded-xl text-slate-400 hover:text-white transition-all">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-8 max-h-[60vh] overflow-y-auto">
                            {selectedHistory.length > 0 ? (
                                <div className="space-y-6">
                                    {selectedHistory.map((entry, idx) => (
                                        <div key={idx} className="relative pl-6 border-l-2 border-slate-100 py-1">
                                            <div className={`absolute left-[-9px] top-1 w-4 h-4 rounded-full border-2 border-white shadow-sm ${entry.includes('DERIVADA') || entry.includes('CERRADA') ? 'bg-orange-500' : 'bg-blue-500'}`} />
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                                                {entry.split(':')[0]}:{entry.split(':')[1]}
                                            </p>
                                            <div className={`p-4 rounded-2xl ${entry.includes('DERIVADA') || entry.includes('CERRADA') ? 'bg-orange-50 border border-orange-100 text-orange-900' : 'bg-slate-50 border border-slate-100 text-slate-700'}`}>
                                                <p className="text-sm font-bold leading-relaxed">{entry.split(':').slice(2).join(':').trim()}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12">
                                    <div className="bg-slate-50 w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-4 text-slate-300">
                                        <Clock size={32} />
                                    </div>
                                    <p className="text-slate-400 font-bold">{t('appointments.no_history')}</p>
                                </div>
                            )}
                        </div>
                        <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
                            <button 
                                onClick={() => setIsHistoryModalOpen(false)}
                                className="px-6 py-2 bg-white border border-slate-300 rounded-2xl text-slate-700 font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-all"
                            >
                                {t('appointments.close_viewer')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Building Clients Modal */}
            {isBuildingModalOpen && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex justify-center items-center p-4 z-50">
                    <div className="bg-white rounded-3xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h3 className="text-xl font-bold text-slate-800">{t('appointments.clients_in_building')}</h3>
                                <p className="text-sm text-slate-500 mt-1">{buildingAddressName}</p>
                            </div>
                            <button onClick={() => setIsBuildingModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                                <X size={20} className="text-slate-500" />
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto bg-slate-50 flex-1">
                            {isBuildingLoading ? (
                                <div className="text-center py-8 text-slate-500 flex flex-col items-center gap-2">
                                    <Loader className="animate-spin text-blue-500" size={24} /> 
                                    {t('appointments.loading_clients')}
                                </div>
                            ) : buildingClients.length === 0 ? (
                                <div className="text-center py-8 text-slate-500">{t('appointments.no_other_clients')}</div>
                            ) : (
                                <div className="grid gap-3">
                                    {buildingClients.map(client => (
                                        <div key={client.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between md:items-center gap-4 hover:shadow-md transition-all">
                                            <div>
                                                <p className="font-bold text-slate-800 text-lg">{client.clientName || 'Sin Nombre'}</p>
                                                <p className="text-sm text-slate-500 font-medium mt-1">
                                                    <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded mr-2">Bauauftrag: {client.bauauftragId || client.klsId || 'N/A'}</span>
                                                    NVT: {client.nvt || 'N/A'}
                                                </p>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2 md:justify-end">
                                                <span className={`px-3 py-1.5 text-xs font-bold rounded-full border ${client.orderStatus === 'CERRADA' ? 'bg-green-50 text-green-700 border-green-200' : client.orderStatus === 'DERIVADA' ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                                                    {client.orderStatus || t('appointments.pending_status')}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* AI Manager Modal */}
            {isAiModalOpen && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex justify-center items-center p-4 z-[60]">
                    <div className="bg-white rounded-3xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-purple-50">
                            <div className="flex items-center gap-3">
                                <div className="bg-purple-600 p-2 rounded-xl text-white">
                                    <Brain size={24} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-slate-800">Gestor IA Gemini ✨</h3>
                                    <p className="text-sm text-purple-700 font-medium">Analizando y clasificando citas pendientes...</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {aiResults && !isAiLoading && (
                                    <button
                                        onClick={handleExportAiList}
                                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl transition-all flex items-center justify-center gap-2 text-sm font-bold shadow-sm active:scale-95"
                                    >
                                        <Download size={18} />
                                        <span>Exportar Listas</span>
                                    </button>
                                )}
                                <button onClick={() => setIsAiModalOpen(false)} className="p-2 hover:bg-purple-200 rounded-full transition-colors">
                                    <X size={20} className="text-purple-700" />
                                </button>
                            </div>
                        </div>
                        
                        <div className="p-6 overflow-y-auto bg-slate-50 flex-1">
                            {isAiLoading ? (
                                <div className="flex flex-col items-center justify-center py-20 text-purple-600 space-y-4">
                                    <Sparkles className="animate-spin" size={48} />
                                    <p className="font-bold text-lg">La IA está leyendo los comentarios...</p>
                                    <p className="text-sm text-slate-500">Esto puede tardar unos segundos dependiendo del volumen.</p>
                                </div>
                            ) : aiResults ? (
                                <div className="space-y-8">
                                    {/* Call Back Section */}
                                    <div className="bg-slate-50 p-6 rounded-2xl shadow-sm border border-slate-200">
                                        <h4 className="text-lg font-bold text-blue-700 flex items-center gap-2 mb-4">
                                            <Phone size={20} /> Para Rellamar Hoy <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-xs">{aiResults.call_back?.length || 0}</span>
                                        </h4>
                                        <div className="grid gap-4">
                                            {aiResults.call_back?.map(item => {
                                                const id = typeof item === 'object' ? item.id : item;
                                                const reason = typeof item === 'object' ? item.reason : '';
                                                const addr = pendingAddresses.find(a => a.id === id);
                                                if (!addr) return null;
                                                const sortedComments = addr.appointment?.comments 
                                                    ? [...addr.appointment.comments].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) 
                                                    : [];
                                                return (
                                                    <div key={id} onClick={() => setSelectedAiAddress(addr)} className="p-4 border border-slate-200 rounded-2xl bg-white shadow-sm hover:shadow-md transition-all flex flex-col gap-3 cursor-pointer hover:bg-slate-50/80">
                                                        <div className="flex justify-between items-start">
                                                            <div>
                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                    <span className="font-bold text-slate-800 text-base">{addr.street} {addr.number}</span>
                                                                    {addr.project?.name && (
                                                                        <span className="text-[10px] bg-slate-100 text-slate-600 font-semibold px-2 py-0.5 rounded-full uppercase">
                                                                            {addr.project.name}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                {addr.clientName && (
                                                                    <p className="text-sm text-slate-500 font-medium">Cliente: {addr.clientName}</p>
                                                                )}
                                                            </div>
                                                            <button onClick={(e) => { e.stopPropagation(); openContactModal(addr); }} className="text-blue-600 p-2 bg-blue-50 hover:bg-blue-100 rounded-xl transition-all" title="Llamar">
                                                                <Phone size={18} />
                                                            </button>
                                                        </div>
                                                        
                                                        {reason && (
                                                            <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3 flex gap-2 items-start">
                                                                <Sparkles size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
                                                                <p className="text-xs text-blue-900 leading-relaxed">
                                                                    <strong className="font-semibold text-blue-800">Conclusión IA:</strong> {reason}
                                                                </p>
                                                            </div>
                                                        )}

                                                        {sortedComments.length > 0 && (
                                                            <div className="border-t border-slate-100 pt-3">
                                                                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Historial de Comentarios:</p>
                                                                <div className="max-h-[140px] overflow-y-auto space-y-2 pr-1">
                                                                    {sortedComments.map((comment, index) => (
                                                                        <div key={comment.id || index} className="text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                                                            <div className="flex justify-between items-center text-[10px] text-slate-400 mb-1">
                                                                                <span className="font-semibold text-slate-600">{comment.authorName}</span>
                                                                                <span>{new Date(comment.createdAt).toLocaleString()}</span>
                                                                            </div>
                                                                            <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{comment.content}</p>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                            {(!aiResults.call_back || aiResults.call_back.length === 0) && <p className="text-sm text-slate-400">Ninguna cita en esta categoría.</p>}
                                        </div>
                                    </div>

                                    {/* Work Finished Section */}
                                    <div className="bg-slate-50 p-6 rounded-2xl shadow-sm border border-slate-200">
                                        <h4 className="text-lg font-bold text-green-700 flex items-center gap-2 mb-4">
                                            <CheckCircle size={20} /> Trabajo Finalizado por Cliente <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded-full text-xs">{aiResults.work_finished?.length || 0}</span>
                                        </h4>
                                        <div className="grid gap-4">
                                            {aiResults.work_finished?.map(item => {
                                                const id = typeof item === 'object' ? item.id : item;
                                                const reason = typeof item === 'object' ? item.reason : '';
                                                const addr = pendingAddresses.find(a => a.id === id);
                                                if (!addr) return null;
                                                const sortedComments = addr.appointment?.comments 
                                                    ? [...addr.appointment.comments].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) 
                                                    : [];
                                                return (
                                                    <div key={id} onClick={() => setSelectedAiAddress(addr)} className="p-4 border border-slate-200 rounded-2xl bg-white shadow-sm hover:shadow-md transition-all flex flex-col gap-3 cursor-pointer hover:bg-slate-50/80">
                                                        <div className="flex justify-between items-start">
                                                            <div>
                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                    <span className="font-bold text-slate-800 text-base">{addr.street} {addr.number}</span>
                                                                    {addr.project?.name && (
                                                                        <span className="text-[10px] bg-slate-100 text-slate-600 font-semibold px-2 py-0.5 rounded-full uppercase">
                                                                            {addr.project.name}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                {addr.clientName && (
                                                                    <p className="text-sm text-slate-500 font-medium">Cliente: {addr.clientName}</p>
                                                                )}
                                                            </div>
                                                            <button onClick={(e) => { e.stopPropagation(); openScheduleModal(addr); }} className="text-green-600 p-2 bg-green-50 hover:bg-green-100 rounded-xl transition-all" title="Agendar">
                                                                <Calendar size={18} />
                                                            </button>
                                                        </div>
                                                        
                                                        {reason && (
                                                            <div className="bg-green-50/50 border border-green-100 rounded-xl p-3 flex gap-2 items-start">
                                                                <Sparkles size={16} className="text-green-600 mt-0.5 flex-shrink-0" />
                                                                <p className="text-xs text-green-900 leading-relaxed">
                                                                    <strong className="font-semibold text-green-800">Conclusión IA:</strong> {reason}
                                                                </p>
                                                            </div>
                                                        )}

                                                        {sortedComments.length > 0 && (
                                                            <div className="border-t border-slate-100 pt-3">
                                                                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Historial de Comentarios:</p>
                                                                <div className="max-h-[140px] overflow-y-auto space-y-2 pr-1">
                                                                    {sortedComments.map((comment, index) => (
                                                                        <div key={comment.id || index} className="text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                                                            <div className="flex justify-between items-center text-[10px] text-slate-400 mb-1">
                                                                                <span className="font-semibold text-slate-600">{comment.authorName}</span>
                                                                                <span>{new Date(comment.createdAt).toLocaleString()}</span>
                                                                            </div>
                                                                            <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{comment.content}</p>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                            {(!aiResults.work_finished || aiResults.work_finished.length === 0) && <p className="text-sm text-slate-400">Ninguna cita en esta categoría.</p>}
                                        </div>
                                    </div>

                                    {/* Needs Auskundung Section */}
                                    <div className="bg-slate-50 p-6 rounded-2xl shadow-sm border border-slate-200">
                                        <h4 className="text-lg font-bold text-orange-700 flex items-center gap-2 mb-4">
                                            <Grid size={20} /> Requiere Auskundung/Estudio <span className="bg-orange-100 text-orange-800 px-2 py-0.5 rounded-full text-xs">{aiResults.needs_auskundung?.length || 0}</span>
                                        </h4>
                                        <div className="grid gap-4">
                                            {aiResults.needs_auskundung?.map(item => {
                                                const id = typeof item === 'object' ? item.id : item;
                                                const reason = typeof item === 'object' ? item.reason : '';
                                                const addr = pendingAddresses.find(a => a.id === id);
                                                if (!addr) return null;
                                                const sortedComments = addr.appointment?.comments 
                                                    ? [...addr.appointment.comments].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) 
                                                    : [];
                                                return (
                                                    <div key={id} onClick={() => setSelectedAiAddress(addr)} className="p-4 border border-slate-200 rounded-2xl bg-white shadow-sm hover:shadow-md transition-all flex flex-col gap-3 cursor-pointer hover:bg-slate-50/80">
                                                        <div className="flex justify-between items-start">
                                                            <div>
                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                    <span className="font-bold text-slate-800 text-base">{addr.street} {addr.number}</span>
                                                                    {addr.project?.name && (
                                                                        <span className="text-[10px] bg-slate-100 text-slate-600 font-semibold px-2 py-0.5 rounded-full uppercase">
                                                                            {addr.project.name}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                {addr.clientName && (
                                                                    <p className="text-sm text-slate-500 font-medium">Cliente: {addr.clientName}</p>
                                                                )}
                                                            </div>
                                                            <button onClick={(e) => { e.stopPropagation(); openDeriveModal(addr, 'DERIVADA'); }} className="text-orange-600 p-2 bg-orange-50 hover:bg-orange-100 rounded-xl transition-all" title="Derivar a cliente">
                                                                <Send size={18} />
                                                            </button>
                                                        </div>
                                                        
                                                        {reason && (
                                                            <div className="bg-orange-50/50 border border-orange-100 rounded-xl p-3 flex gap-2 items-start">
                                                                <Sparkles size={16} className="text-orange-600 mt-0.5 flex-shrink-0" />
                                                                <p className="text-xs text-orange-900 leading-relaxed">
                                                                    <strong className="font-semibold text-orange-800">Conclusión IA:</strong> {reason}
                                                                </p>
                                                            </div>
                                                        )}

                                                        {sortedComments.length > 0 && (
                                                            <div className="border-t border-slate-100 pt-3">
                                                                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Historial de Comentarios:</p>
                                                                <div className="max-h-[140px] overflow-y-auto space-y-2 pr-1">
                                                                    {sortedComments.map((comment, index) => (
                                                                        <div key={comment.id || index} className="text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                                                            <div className="flex justify-between items-center text-[10px] text-slate-400 mb-1">
                                                                                <span className="font-semibold text-slate-600">{comment.authorName}</span>
                                                                                <span>{new Date(comment.createdAt).toLocaleString()}</span>
                                                                            </div>
                                                                            <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{comment.content}</p>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                            {(!aiResults.needs_auskundung || aiResults.needs_auskundung.length === 0) && <p className="text-sm text-slate-400">Ninguna cita en esta categoría.</p>}
                                        </div>
                                    </div>

                                    {/* Others Section */}
                                    <div className="bg-slate-50 p-6 rounded-2xl shadow-sm border border-slate-200">
                                        <h4 className="text-lg font-bold text-slate-700 flex items-center gap-2 mb-4">
                                            <FileText size={20} /> Otros / Requieren Atención <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded-full text-xs">{aiResults.others?.length || 0}</span>
                                        </h4>
                                        <div className="grid gap-4">
                                            {aiResults.others?.map(item => {
                                                const id = typeof item === 'object' ? item.id : item;
                                                const reason = typeof item === 'object' ? item.reason : '';
                                                const addr = pendingAddresses.find(a => a.id === id);
                                                if (!addr) return null;
                                                const sortedComments = addr.appointment?.comments 
                                                    ? [...addr.appointment.comments].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) 
                                                    : [];
                                                return (
                                                    <div key={id} onClick={() => setSelectedAiAddress(addr)} className="p-4 border border-slate-200 rounded-2xl bg-white shadow-sm hover:shadow-md transition-all flex flex-col gap-3 cursor-pointer hover:bg-slate-50/80">
                                                        <div className="flex justify-between items-start">
                                                            <div>
                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                    <span className="font-bold text-slate-800 text-base">{addr.street} {addr.number}</span>
                                                                    {addr.project?.name && (
                                                                        <span className="text-[10px] bg-slate-100 text-slate-600 font-semibold px-2 py-0.5 rounded-full uppercase">
                                                                            {addr.project.name}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                {addr.clientName && (
                                                                    <p className="text-sm text-slate-500 font-medium">Cliente: {addr.clientName}</p>
                                                                )}
                                                            </div>
                                                            <button onClick={(e) => { e.stopPropagation(); openHistoryModal(addr); }} className="text-slate-600 p-2 bg-slate-50 hover:bg-slate-100 rounded-xl transition-all" title="Ver comentarios">
                                                                <List size={18} />
                                                            </button>
                                                        </div>
                                                        
                                                        {reason && (
                                                            <div className="bg-slate-100 border border-slate-200 rounded-xl p-3 flex gap-2 items-start">
                                                                <Sparkles size={16} className="text-slate-600 mt-0.5 flex-shrink-0" />
                                                                <p className="text-xs text-slate-800 leading-relaxed">
                                                                    <strong className="font-semibold text-slate-700">Conclusión IA:</strong> {reason}
                                                                </p>
                                                            </div>
                                                        )}

                                                        {sortedComments.length > 0 && (
                                                            <div className="border-t border-slate-100 pt-3">
                                                                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Historial de Comentarios:</p>
                                                                <div className="max-h-[140px] overflow-y-auto space-y-2 pr-1">
                                                                    {sortedComments.map((comment, index) => (
                                                                        <div key={comment.id || index} className="text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                                                            <div className="flex justify-between items-center text-[10px] text-slate-400 mb-1">
                                                                                <span className="font-semibold text-slate-600">{comment.authorName}</span>
                                                                                <span>{new Date(comment.createdAt).toLocaleString()}</span>
                                                                            </div>
                                                                            <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{comment.content}</p>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                            {(!aiResults.others || aiResults.others.length === 0) && <p className="text-sm text-slate-400">Ninguna cita en esta categoría.</p>}
                                        </div>
                                    </div>
                                    
                                </div>
                            ) : null}
                        </div>
                    </div>
                </div>
            )}

            {/* AI Selected Address Details Modal */}
            {selectedAiAddress && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex justify-center items-center p-4 z-[70]">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col transform transition-all duration-300 scale-100">
                        {/* Header */}
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <div>
                                <span className="inline-block px-2 py-0.5 bg-purple-100 text-purple-800 text-[10px] font-bold rounded-full mb-1 uppercase tracking-wider">
                                    Detalle del Cliente (Gestor IA)
                                </span>
                                <h3 className="text-xl font-black text-slate-800">
                                    {selectedAiAddress.street} {selectedAiAddress.number}
                                </h3>
                                <p className="text-xs text-slate-500 font-medium mt-0.5">
                                    {selectedAiAddress.project?.name} | NVT: {selectedAiAddress.nvt || 'N/A'} | Bauauftrag: {selectedAiAddress.bauauftragId || selectedAiAddress.klsId || 'N/A'}
                                </p>
                            </div>
                            <button
                                onClick={() => setSelectedAiAddress(null)}
                                className="p-2 hover:bg-slate-200 rounded-full transition-colors"
                            >
                                <X size={20} className="text-slate-500" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-white">
                            {/* Client Name */}
                            {selectedAiAddress.clientName && (
                                <div className="bg-blue-50/30 border border-blue-100/50 rounded-2xl p-4">
                                    <h4 className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-1">Nombre del Cliente</h4>
                                    <p className="text-slate-800 font-bold text-base">{selectedAiAddress.clientName}</p>
                                </div>
                            )}

                            {/* AI Conclusion */}
                            {getAiReason(selectedAiAddress.id) && (
                                <div className="bg-purple-50 border border-purple-100 rounded-2xl p-4 flex gap-3 items-start">
                                    <Sparkles size={20} className="text-purple-600 mt-0.5 flex-shrink-0" />
                                    <div>
                                        <h4 className="text-xs font-bold text-purple-800 uppercase tracking-wider mb-1">Conclusión e Interpretación IA</h4>
                                        <p className="text-sm text-purple-950 leading-relaxed font-medium">
                                            {getAiReason(selectedAiAddress.id)}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Comments History */}
                            <div>
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Historial de Comentarios</h4>
                                {selectedAiAddress.appointment?.comments && selectedAiAddress.appointment.comments.length > 0 ? (
                                    <div className="space-y-3">
                                        {[...selectedAiAddress.appointment.comments]
                                            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                                            .map((comment, index) => (
                                                <div key={comment.id || index} className="text-sm bg-slate-50 p-4 rounded-2xl border border-slate-100 shadow-sm">
                                                    <div className="flex justify-between items-center text-xs text-slate-400 mb-2">
                                                        <span className="font-bold text-slate-600">{comment.authorName}</span>
                                                        <span>{new Date(comment.createdAt).toLocaleString()}</span>
                                                    </div>
                                                    <p className="text-slate-700 leading-relaxed whitespace-pre-wrap font-medium">{comment.content}</p>
                                                </div>
                                            ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-slate-400 italic">No hay comentarios en esta orden.</p>
                                )}
                            </div>
                        </div>

                        {/* Footer Actions */}
                        <div className="p-6 border-t border-slate-100 bg-slate-50 flex flex-wrap gap-3 justify-end items-center">
                            <button
                                onClick={() => {
                                    setSelectedAiAddress(null);
                                    openContactModal(selectedAiAddress);
                                }}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 text-sm font-bold shadow-sm active:scale-95"
                            >
                                <Phone size={16} />
                                Llamar
                            </button>
                            <button
                                onClick={() => {
                                    setSelectedAiAddress(null);
                                    openScheduleModal(selectedAiAddress);
                                }}
                                className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 text-sm font-bold shadow-sm active:scale-95"
                            >
                                <Calendar size={16} />
                                Agendar Cita
                            </button>
                            <button
                                onClick={() => {
                                    setSelectedAiAddress(null);
                                    openDeriveModal(selectedAiAddress, 'DERIVADA');
                                }}
                                className="bg-orange-600 hover:bg-orange-700 text-white px-5 py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 text-sm font-bold shadow-sm active:scale-95"
                            >
                                <Send size={16} />
                                Derivar
                            </button>
                            <button
                                onClick={() => {
                                    setSelectedAiAddress(null);
                                    openDeriveModal(selectedAiAddress, 'CERRADA');
                                }}
                                className="bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 text-sm font-bold shadow-sm active:scale-95"
                            >
                                <XCircle size={16} />
                                Cerrar Orden
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AppointmentsPage;
