import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { 
    Calendar, Users, FileText, ChevronDown, ChevronUp, MapPin, 
    CheckCircle2, Clock, Image, Map, X, Search, AlertTriangle, 
    RotateCcw, DollarSign, Check, Eye, Filter, ListCollapse 
} from 'lucide-react';

const DailyReportsList = () => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const isManagement = ['SUPER_ADMIN', 'ADMIN', 'BACK_OFFICE'].includes(user.role);

    const [reports, setReports] = useState([]);
    const [subcontractors, setSubcontractors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedReportId, setExpandedReportId] = useState(null);

    // Filters State
    const [filterSubcontractor, setFilterSubcontractor] = useState('');
    const [filterStatus, setFilterStatus] = useState('TODOS');
    const [timeframe, setTimeframe] = useState('TODOS'); // DIARIO, SEMANAL, MENSUAL, TODOS
    
    // Date/Period Values
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
    const [selectedWeekDate, setSelectedWeekDate] = useState(new Date().toISOString().slice(0, 10));
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

    // Modals State
    const [approvalModal, setApprovalModal] = useState({
        isOpen: false,
        type: '', // 'work' or 'duct'
        logId: null,
        pricePaid: ''
    });
    
    const [rejectionModal, setRejectionModal] = useState({
        isOpen: false,
        type: '', // 'work' or 'duct'
        logId: null,
        comments: '',
        photos: [],
        incorrectPhotos: []
    });

    const fetchReports = async () => {
        try {
            const [reportsRes, subsRes] = await Promise.all([
                api.get('/api/civil-works/daily-reports'),
                api.get('/api/subcontractors').catch(() => ({ data: [] }))
            ]);
            setReports(reportsRes.data || []);
            setSubcontractors(subsRes.data || []);
        } catch (error) {
            console.error('Error loading daily reports:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReports();
    }, []);

    const toggleExpandReport = (id) => {
        setExpandedReportId(expandedReportId === id ? null : id);
    };

    // Calculate Week Range for filtering
    const getWeekRange = (dateStr) => {
        if (!dateStr) return { start: null, end: null };
        const date = new Date(dateStr);
        const day = date.getDay();
        const diff = date.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is Sunday
        const monday = new Date(date.setDate(diff));
        monday.setHours(0, 0, 0, 0);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);
        return { start: monday, end: sunday };
    };

    // 1. Calculate KPIs based on timeframe and subcontractor (ignoring status filter)
    const kpiReports = reports.filter(report => {
        if (filterSubcontractor && report.subcontractorId !== filterSubcontractor) {
            return false;
        }

        const reportDate = new Date(report.date);
        if (timeframe === 'DIARIO') {
            const reportDay = reportDate.toISOString().slice(0, 10);
            if (reportDay !== selectedDate) return false;
        } else if (timeframe === 'SEMANAL') {
            const { start, end } = getWeekRange(selectedWeekDate);
            if (reportDate < start || reportDate > end) return false;
        } else if (timeframe === 'MENSUAL') {
            const reportMonth = reportDate.toISOString().slice(0, 7);
            if (reportMonth !== selectedMonth) return false;
        }
        return true;
    });

    let totalAcometidas = 0;
    let approvedAcometidas = 0;
    let pendingAcometidas = 0;
    let returnedAcometidas = 0;

    let totalMeters = 0;
    let approvedMeters = 0;
    let pendingMeters = 0;
    let returnedMeters = 0;

    let totalWorkers = 0;
    
    let totalNvts = 0;
    let approvedNvts = 0;
    let pendingNvts = 0;
    let returnedNvts = 0;

    kpiReports.forEach(report => {
        totalWorkers += report.peoplePresent || 0;
        
        (report.workLogs || []).forEach(wl => {
            totalAcometidas++;
            if (wl.reviewStatus === 'REVISADO') approvedAcometidas++;
            else if (wl.reviewStatus === 'DEVUELTO') returnedAcometidas++;
            else pendingAcometidas++;
        });

        (report.ductLogs || []).forEach(dl => {
            const dist = dl.distance || 0;
            totalMeters += dist;
            if (dl.reviewStatus === 'REVISADO') approvedMeters += dist;
            else if (dl.reviewStatus === 'DEVUELTO') returnedMeters += dist;
            else pendingMeters += dist;
        });

        (report.nvtLogs || []).forEach(nl => {
            totalNvts++;
            if (nl.reviewStatus === 'REVISADO') approvedNvts++;
            else if (nl.reviewStatus === 'DEVUELTO') returnedNvts++;
            else pendingNvts++;
        });
    });

    // 2. Filter Reports for List Rendering (applying status filter)
    const filteredReports = reports.map(report => {
        // Subcontractor filter
        if (filterSubcontractor && report.subcontractorId !== filterSubcontractor) {
            return null;
        }

        // Timeframe filter
        const reportDate = new Date(report.date);
        if (timeframe === 'DIARIO') {
            const reportDay = reportDate.toISOString().slice(0, 10);
            if (reportDay !== selectedDate) return null;
        } else if (timeframe === 'SEMANAL') {
            const { start, end } = getWeekRange(selectedWeekDate);
            if (reportDate < start || reportDate > end) return null;
        } else if (timeframe === 'MENSUAL') {
            const reportMonth = reportDate.toISOString().slice(0, 7);
            if (reportMonth !== selectedMonth) return null;
        }

        // Review status filtering for logs inside report
        let filteredWorkLogs = report.workLogs || [];
        let filteredDuctLogs = report.ductLogs || [];
        let filteredNvtLogs = report.nvtLogs || [];

        if (filterStatus !== 'TODOS') {
            filteredWorkLogs = filteredWorkLogs.filter(wl => wl.reviewStatus === filterStatus);
            filteredDuctLogs = filteredDuctLogs.filter(dl => dl.reviewStatus === filterStatus);
            filteredNvtLogs = filteredNvtLogs.filter(nl => nl.reviewStatus === filterStatus);
        }

        // Omit report if status filter is active and no logs match
        if (filterStatus !== 'TODOS' && filteredWorkLogs.length === 0 && filteredDuctLogs.length === 0 && filteredNvtLogs.length === 0) {
            return null;
        }

        return {
            ...report,
            workLogs: filteredWorkLogs,
            ductLogs: filteredDuctLogs,
            nvtLogs: filteredNvtLogs
        };
    }).filter(Boolean);

    // Approve handler
    const handleApprove = async () => {
        const { type, logId, pricePaid } = approvalModal;
        try {
            let endpoint = '';
            if (type === 'work') endpoint = `/api/civil-works/work-log/${logId}/review`;
            else if (type === 'duct') endpoint = `/api/civil-works/duct-log/${logId}/review`;
            else if (type === 'nvt') endpoint = `/api/civil-works/nvt-log/${logId}/review`;
            
            await api.put(endpoint, {
                status: 'REVISADO',
                pricePaid: pricePaid ? parseFloat(pricePaid) : undefined
            });
            
            setApprovalModal({ isOpen: false, type: '', logId: null, pricePaid: '' });
            fetchReports();
        } catch (error) {
            console.error('Error approving:', error);
            alert(error.response?.data?.message || 'Error al aprobar el registro.');
        }
    };

    // Return/Reject handler
    const handleReject = async () => {
        const { type, logId, comments, incorrectPhotos } = rejectionModal;
        if (!comments.trim()) {
            alert('Debes ingresar el motivo de la devolución.');
            return;
        }
        try {
            let endpoint = '';
            if (type === 'work') endpoint = `/api/civil-works/work-log/${logId}/return`;
            else if (type === 'duct') endpoint = `/api/civil-works/duct-log/${logId}/return`;
            else if (type === 'nvt') endpoint = `/api/civil-works/nvt-log/${logId}/return`;
            
            await api.put(endpoint, {
                reviewComments: comments,
                incorrectPhotos
            });
            
            setRejectionModal({ isOpen: false, type: '', logId: null, comments: '', incorrectPhotos: [], photos: [] });
            fetchReports();
        } catch (error) {
            console.error('Error returning:', error);
            alert(error.response?.data?.message || 'Error al devolver el registro.');
        }
    };

    const toggleIncorrectPhoto = (photoUrl) => {
        setRejectionModal(prev => {
            const list = prev.incorrectPhotos.includes(photoUrl)
                ? prev.incorrectPhotos.filter(p => p !== photoUrl)
                : [...prev.incorrectPhotos, photoUrl];
            return { ...prev, incorrectPhotos: list };
        });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
            </div>
        );
    }

    const { start: weekStart, end: weekEnd } = getWeekRange(selectedWeekDate);

    return (
        <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            {/* Header */}
            <div className="bg-[#0a0f1c] rounded-[2rem] p-8 text-white shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-white/5 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl pointer-events-none"></div>
                <div className="relative z-10">
                    <h2 className="text-3xl font-black font-heading">Revisión y Aprobación de Partes de Obra Civil</h2>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">
                        Control de producción, validación de acometidas y zanjas antes de facturación
                    </p>
                </div>
            </div>

            {/* Metrics Dashboard */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Acometidas Card */}
                <div className="glass-panel bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden">
                    <div className="flex justify-between items-start">
                        <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Acometidas (Totales / Aprobadas)</span>
                            <div className="flex items-baseline gap-2">
                                <span className="text-3xl font-black text-slate-800">{totalAcometidas}</span>
                                <span className="text-sm font-bold text-emerald-600">({approvedAcometidas} apr.)</span>
                            </div>
                        </div>
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                            <CheckCircle2 size={24} />
                        </div>
                    </div>
                    {/* Progress Bar */}
                    <div className="mt-4 space-y-1.5">
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div 
                                className="bg-emerald-500 h-2 rounded-full transition-all duration-500" 
                                style={{ width: `${totalAcometidas > 0 ? (approvedAcometidas / totalAcometidas) * 100 : 0}%` }}
                            ></div>
                        </div>
                        <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase">
                            <span>Pendientes: {pendingAcometidas}</span>
                            <span>Devueltas: {returnedAcometidas}</span>
                        </div>
                    </div>
                </div>

                {/* Canalización/Metros Card */}
                <div className="glass-panel bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden">
                    <div className="flex justify-between items-start">
                        <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Canalización (Zanjas Totales / Aprobadas)</span>
                            <div className="flex items-baseline gap-2">
                                <span className="text-3xl font-black text-slate-800">{totalMeters.toFixed(1)}m</span>
                                <span className="text-sm font-bold text-emerald-600">({approvedMeters.toFixed(1)}m apr.)</span>
                            </div>
                        </div>
                        <div className="p-3 bg-purple-50 text-purple-600 rounded-2xl">
                            <Map size={24} />
                        </div>
                    </div>
                    {/* Progress Bar */}
                    <div className="mt-4 space-y-1.5">
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div 
                                className="bg-emerald-500 h-2 rounded-full transition-all duration-500" 
                                style={{ width: `${totalMeters > 0 ? (approvedMeters / totalMeters) * 100 : 0}%` }}
                            ></div>
                        </div>
                        <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase">
                            <span>Pendientes: {pendingMeters.toFixed(1)}m</span>
                            <span>Devueltas: {returnedMeters.toFixed(1)}m</span>
                        </div>
                    </div>
                </div>

                {/* Personal / Operarios Card */}
                <div className="glass-panel bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
                    <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Operarios en Obra Civil</span>
                        <h3 className="text-3xl font-black text-slate-800">{totalWorkers}</h3>
                        <p className="text-[10px] font-semibold text-slate-500 uppercase mt-1">Registrados en los partes cargados</p>
                    </div>
                    <div className="p-4 bg-orange-50 text-orange-600 rounded-3xl">
                        <Users size={28} />
                    </div>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="glass-panel bg-white rounded-3xl border border-slate-100 p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-2 text-slate-800 font-extrabold text-sm border-b border-slate-100 pb-3">
                    <Filter size={16} className="text-orange-500" />
                    <span>Filtros y Controles del Panel</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Subcontractor Selector */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Subcontrata / Socio</label>
                        <select 
                            value={filterSubcontractor}
                            onChange={(e) => setFilterSubcontractor(e.target.value)}
                            className="w-full text-slate-700 bg-slate-50 border border-slate-200 rounded-2xl p-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500"
                        >
                            <option value="">Todas las subcontratas</option>
                            {subcontractors.map(sub => (
                                <option key={sub.id} value={sub.id}>{sub.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Review Status Filter */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Estado del Trabajo</label>
                        <select 
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="w-full text-slate-700 bg-slate-50 border border-slate-200 rounded-2xl p-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500"
                        >
                            <option value="TODOS">Todos los estados</option>
                            <option value="PENDIENTE_REVISION">⏳ Pendientes de Aprobación</option>
                            <option value="REVISADO">🟢 Aprobados y Listos</option>
                            <option value="DEVUELTO">🔴 Devueltos por corrección</option>
                        </select>
                    </div>

                    {/* Timeframe Filter Tabs */}
                    <div className="space-y-1.5 sm:col-span-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Rango de Tiempo</label>
                        <div className="flex bg-slate-100 rounded-2xl p-1 gap-1">
                            {['TODOS', 'DIARIO', 'SEMANAL', 'MENSUAL'].map(t => (
                                <button
                                    key={t}
                                    onClick={() => setTimeframe(t)}
                                    className={`flex-1 text-xs font-bold py-2 rounded-xl transition-all ${
                                        timeframe === t 
                                            ? 'bg-white text-slate-800 shadow-sm' 
                                            : 'text-slate-500 hover:text-slate-800'
                                    }`}
                                >
                                    {t === 'TODOS' ? 'Histórico' : t.charAt(0) + t.slice(1).toLowerCase()}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Sub-Filters depending on Timeframe */}
                {timeframe !== 'TODOS' && (
                    <div className="flex flex-wrap items-center gap-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-100/50 animate-fadeIn">
                        {timeframe === 'DIARIO' && (
                            <div className="flex items-center gap-3 w-full sm:w-auto">
                                <span className="text-xs font-bold text-slate-500">Seleccionar Día:</span>
                                <input 
                                    type="date" 
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    className="text-slate-700 bg-white border border-slate-200 rounded-xl p-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500"
                                />
                            </div>
                        )}

                        {timeframe === 'SEMANAL' && (
                            <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-slate-500">Elegir Día de la Semana:</span>
                                    <input 
                                        type="date" 
                                        value={selectedWeekDate}
                                        onChange={(e) => setSelectedWeekDate(e.target.value)}
                                        className="text-slate-700 bg-white border border-slate-200 rounded-xl p-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500"
                                    />
                                </div>
                                {weekStart && weekEnd && (
                                    <span className="text-[11px] font-extrabold text-orange-600 bg-orange-50 px-3 py-1.5 rounded-xl border border-orange-100">
                                        Semana del {weekStart.toLocaleDateString('es-ES')} al {weekEnd.toLocaleDateString('es-ES')}
                                    </span>
                                )}
                            </div>
                        )}

                        {timeframe === 'MENSUAL' && (
                            <div className="flex items-center gap-3 w-full sm:w-auto">
                                <span className="text-xs font-bold text-slate-500">Seleccionar Mes:</span>
                                <input 
                                    type="month" 
                                    value={selectedMonth}
                                    onChange={(e) => setSelectedMonth(e.target.value)}
                                    className="text-slate-700 bg-white border border-slate-200 rounded-xl p-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500"
                                />
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Reports List */}
            <div className="space-y-4">
                {filteredReports.length === 0 ? (
                    <div className="glass-panel bg-white/70 p-12 text-center rounded-3xl border border-slate-100">
                        <FileText className="mx-auto text-slate-300 w-16 h-16 mb-4" />
                        <h4 className="text-lg font-bold text-slate-800">No hay partes diarios para los filtros elegidos</h4>
                        <p className="text-sm text-slate-500 mt-1">Ajusta los criterios de búsqueda o fecha seleccionada.</p>
                    </div>
                ) : (
                    filteredReports.map((report) => {
                        const isExpanded = expandedReportId === report.id;
                        const reportDate = new Date(report.date).toLocaleDateString('es-ES', { 
                            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' 
                        });
                        
                        return (
                            <div key={report.id} className="glass-panel bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                                {/* Header Row */}
                                <div 
                                    onClick={() => toggleExpandReport(report.id)}
                                    className="p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 cursor-pointer hover:bg-slate-50/50 transition-colors"
                                >
                                    <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                                        <div className="flex flex-col items-center justify-center bg-orange-500/10 text-orange-600 rounded-2xl w-16 h-16 p-2 text-center font-heading border border-orange-500/10">
                                            <span className="text-[10px] font-bold uppercase">{new Date(report.date).toLocaleDateString('es-ES', { month: 'short' })}</span>
                                            <span className="text-2xl font-black leading-none">{new Date(report.date).getDate()}</span>
                                        </div>
                                        <div>
                                            <h4 className="text-lg font-black text-slate-800">{report.subcontractor.name}</h4>
                                            <p className="text-xs text-slate-500 font-bold flex items-center gap-1.5 capitalize mt-0.5">
                                                <Calendar size={14} className="text-slate-400" />
                                                {reportDate}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Stats */}
                                    <div className="flex flex-wrap items-center gap-3">
                                        <span className="text-xs font-bold bg-slate-100 text-slate-600 px-3 py-1 rounded-xl border border-slate-200/50 flex items-center gap-1.5">
                                            <Users size={14} />
                                            {report.peoplePresent} operarios
                                        </span>
                                        <span className="text-xs font-bold bg-blue-50 text-blue-600 px-3 py-1 rounded-xl border border-blue-200/50 flex items-center gap-1.5">
                                            <CheckCircle2 size={14} />
                                            {report.workLogs ? report.workLogs.length : 0} acometidas
                                        </span>
                                        <span className="text-xs font-bold bg-purple-50 text-purple-600 px-3 py-1 rounded-xl border border-purple-200/50 flex items-center gap-1.5">
                                            <Map size={14} />
                                            {report.ductLogs ? report.ductLogs.length : 0} ductos
                                        </span>
                                        <span className="text-xs font-bold bg-emerald-50 text-emerald-600 px-3 py-1 rounded-xl border border-emerald-200/50 flex items-center gap-1.5">
                                            <CheckCircle2 size={14} />
                                            {report.nvtLogs ? report.nvtLogs.length : 0} NVTs
                                        </span>
                                        <div className="ml-2 text-slate-400">
                                            {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                        </div>
                                    </div>
                                </div>

                                {/* Expanded Area */}
                                {isExpanded && (
                                    <div className="border-t border-slate-100 bg-slate-50/50 p-6 space-y-6">
                                        {/* Comment block */}
                                        {report.comments && (
                                            <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-inner">
                                                <h5 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Nota general del responsable</h5>
                                                <p className="text-sm text-slate-700 italic">"{report.comments}"</p>
                                            </div>
                                        )}

                                        {/* Acometidas Area */}
                                        <div className="space-y-3">
                                            <h5 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                                                <CheckCircle2 size={14} className="text-blue-500" />
                                                Detalle de Acometidas Reportadas
                                            </h5>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {report.workLogs && report.workLogs.length > 0 ? (
                                                    report.workLogs.map(log => (
                                                        <div key={log.id} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex flex-col justify-between space-y-4">
                                                            <div className="space-y-2">
                                                                <div className="flex justify-between items-start">
                                                                    <h6 className="font-extrabold text-slate-800 text-sm flex items-center gap-1.5">
                                                                        <MapPin size={14} className="text-slate-400" />
                                                                        {log.address.street} {log.address.number || ''}
                                                                    </h6>
                                                                    <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full border ${
                                                                        log.reviewStatus === 'REVISADO' 
                                                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                                                            : log.reviewStatus === 'DEVUELTO'
                                                                                ? 'bg-red-50 text-red-700 border-red-200'
                                                                                : 'bg-amber-50 text-amber-700 border-amber-200'
                                                                    }`}>
                                                                        {log.reviewStatus === 'REVISADO' ? '🟢 Aprobado' : log.reviewStatus === 'DEVUELTO' ? '🔴 Devuelto' : '⏳ Pendiente'}
                                                                    </span>
                                                                </div>
                                                                <p className="text-xs text-slate-400 font-bold">NVT: {log.address.nvt || 'Sin NVT'} • Estado Físico: <span className="text-slate-600 font-extrabold">{log.status}</span></p>
                                                                
                                                                {log.comments && (
                                                                    <p className="text-xs text-slate-600 mt-2 bg-slate-50 p-2.5 rounded-xl italic">"{log.comments}"</p>
                                                                )}

                                                                {log.reviewStatus === 'DEVUELTO' && log.reviewComments && (
                                                                    <div className="bg-red-50 text-red-700 p-3 rounded-xl border border-red-100/50 text-xs">
                                                                        <span className="font-extrabold block mb-0.5">Motivo del rechazo:</span>
                                                                        <span className="italic">"{log.reviewComments}"</span>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Photos */}
                                                            {log.photos && log.photos.length > 0 && (
                                                                <div className="grid grid-cols-4 gap-2">
                                                                    {log.photos.map((photo, idx) => (
                                                                        <a key={idx} href={photo} target="_blank" rel="noreferrer" className="block aspect-square rounded-xl overflow-hidden border border-slate-200 bg-slate-50 relative group">
                                                                            <img src={photo} alt="Report" className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                                                                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                                                <Image size={14} className="text-white" />
                                                                            </div>
                                                                        </a>
                                                                    ))}
                                                                </div>
                                                            )}

                                                            {/* Admin Actions */}
                                                            {isManagement && log.reviewStatus === 'PENDIENTE_REVISION' && (
                                                                <div className="flex gap-2 pt-2 border-t border-slate-100">
                                                                    <button 
                                                                        onClick={() => setApprovalModal({ isOpen: true, type: 'work', logId: log.id, pricePaid: '' })}
                                                                        className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold py-2 rounded-xl shadow-sm transition-colors cursor-pointer"
                                                                    >
                                                                        <Check size={14} /> Aprobar
                                                                    </button>
                                                                    <button 
                                                                        onClick={() => setRejectionModal({ isOpen: true, type: 'work', logId: log.id, comments: '', incorrectPhotos: [], photos: log.photos || [] })}
                                                                        className="flex-1 flex items-center justify-center gap-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-bold py-2 rounded-xl shadow-sm transition-colors cursor-pointer"
                                                                    >
                                                                        <X size={14} /> Devolver
                                                                    </button>
                                                                </div>
                                                            )}
                                                            {isManagement && log.reviewStatus === 'REVISADO' && log.pricePaid > 0 && (
                                                                <div className="text-right text-xs font-bold text-slate-500 pt-2 border-t border-slate-100">
                                                                    Pago registrado: <span className="text-slate-800 font-extrabold">{log.pricePaid.toFixed(2)}€</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))
                                                ) : (
                                                    <p className="text-xs text-slate-400 italic col-span-full">No se reportaron acometidas en este parte.</p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Ductos Area */}
                                        <div className="space-y-3">
                                            <h5 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                                                <Map size={14} className="text-purple-500" />
                                                Detalle de Ductos en Calle (Zanjas)
                                            </h5>
                                            <div className="space-y-4">
                                                {report.ductLogs && report.ductLogs.length > 0 ? (
                                                    report.ductLogs.map(log => {
                                                        const routeCoordinates = log.coordinates || [];
                                                        return (
                                                            <div key={log.id} className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
                                                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-100">
                                                                    <div>
                                                                        <span className="bg-purple-100 text-purple-700 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg">
                                                                            Ducto de Calle {log.ductType || '7x22'}
                                                                        </span>
                                                                        <p className="text-xs text-slate-500 font-bold mt-1 uppercase tracking-wider">
                                                                            Calculado: <span className="text-slate-800 font-black">{log.distance || 0} metros</span>
                                                                        </p>
                                                                    </div>
                                                                    <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full border ${
                                                                        log.reviewStatus === 'REVISADO' 
                                                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                                                            : log.reviewStatus === 'DEVUELTO'
                                                                                ? 'bg-red-50 text-red-700 border-red-200'
                                                                                : 'bg-amber-50 text-amber-700 border-amber-200'
                                                                    }`}>
                                                                        {log.reviewStatus === 'REVISADO' ? '🟢 Aprobado' : log.reviewStatus === 'DEVUELTO' ? '🔴 Devuelto' : '⏳ Pendiente'}
                                                                    </span>
                                                                </div>

                                                                {log.comments && (
                                                                    <p className="text-sm text-slate-700 italic bg-slate-50 p-3 rounded-xl">"{log.comments}"</p>
                                                                )}

                                                                {log.reviewStatus === 'DEVUELTO' && log.reviewComments && (
                                                                    <div className="bg-red-50 text-red-700 p-3.5 rounded-xl border border-red-100/50 text-xs">
                                                                        <span className="font-extrabold block mb-0.5">Motivo del rechazo:</span>
                                                                        <span className="italic">"{log.reviewComments}"</span>
                                                                    </div>
                                                                )}

                                                                {/* Coords */}
                                                                {routeCoordinates.length > 0 && (
                                                                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex flex-wrap gap-x-6 gap-y-2 text-xs">
                                                                        <div>
                                                                            <span className="text-slate-400 font-bold uppercase block text-[9px] tracking-widest">Inicio GPS</span>
                                                                            <span className="text-slate-700 font-semibold">{log.startLat?.toFixed(6)}, {log.startLng?.toFixed(6)}</span>
                                                                        </div>
                                                                        <div>
                                                                            <span className="text-slate-400 font-bold uppercase block text-[9px] tracking-widest">Fin GPS</span>
                                                                            <span className="text-slate-700 font-semibold">{log.endLat?.toFixed(6)}, {log.endLng?.toFixed(6)}</span>
                                                                        </div>
                                                                        <div>
                                                                            <span className="text-slate-400 font-bold uppercase block text-[9px] tracking-widest">Coordenadas</span>
                                                                            <span className="text-slate-700 font-semibold">{routeCoordinates.length} puntos capturados</span>
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {/* Photos */}
                                                                {log.photos && log.photos.length > 0 && (
                                                                    <div className="space-y-2">
                                                                        <h6 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                                                            <Image size={12}/> Evidencias del Trazado
                                                                        </h6>
                                                                        <div className="flex flex-wrap gap-2">
                                                                            {log.photos.map((photo, idx) => (
                                                                                <a key={idx} href={photo} target="_blank" rel="noreferrer" className="block w-20 h-20 rounded-xl overflow-hidden border border-slate-200 hover:scale-105 transition-transform bg-slate-50 relative group">
                                                                                    <img src={photo} alt="Duct" className="w-full h-full object-cover" />
                                                                                </a>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {/* Admin Actions */}
                                                                {isManagement && log.reviewStatus === 'PENDIENTE_REVISION' && (
                                                                    <div className="flex gap-2 pt-2 border-t border-slate-100 max-w-md">
                                                                        <button 
                                                                            onClick={() => setApprovalModal({ isOpen: true, type: 'duct', logId: log.id, pricePaid: '' })}
                                                                            className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold py-2 rounded-xl shadow-sm transition-colors cursor-pointer"
                                                                        >
                                                                            <Check size={14} /> Aprobar Ducto
                                                                        </button>
                                                                        <button 
                                                                            onClick={() => setRejectionModal({ isOpen: true, type: 'duct', logId: log.id, comments: '', incorrectPhotos: [], photos: log.photos || [] })}
                                                                            className="flex-1 flex items-center justify-center gap-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-bold py-2 rounded-xl shadow-sm transition-colors cursor-pointer"
                                                                        >
                                                                            <X size={14} /> Devolver
                                                                        </button>
                                                                    </div>
                                                                )}
                                                                {isManagement && log.reviewStatus === 'REVISADO' && log.pricePaid > 0 && (
                                                                    <div className="text-right text-xs font-bold text-slate-500 pt-2 border-t border-slate-100">
                                                                        Pago registrado: <span className="text-slate-800 font-extrabold">{log.pricePaid.toFixed(2)}€</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })
                                                ) : (
                                                    <p className="text-xs text-slate-400 italic">No se reportaron ductos de calle en este parte.</p>
                                                )}
                                            </div>
                                        </div>

                                        {/* NVT Area */}
                                        <div className="space-y-3">
                                            <h5 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                                                <CheckCircle2 size={14} className="text-emerald-500" />
                                                Detalle de NVT Instalados
                                            </h5>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {report.nvtLogs && report.nvtLogs.length > 0 ? (
                                                    report.nvtLogs.map(log => (
                                                        <div key={log.id} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex flex-col justify-between space-y-4">
                                                            <div className="space-y-2">
                                                                <div className="flex justify-between items-start">
                                                                    <h6 className="font-extrabold text-slate-800 text-sm flex items-center gap-1.5">
                                                                        <CheckCircle2 size={14} className="text-slate-400" />
                                                                        Nudo de Red (NVT)
                                                                    </h6>
                                                                    <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full border ${
                                                                        log.reviewStatus === 'REVISADO' 
                                                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                                                            : log.reviewStatus === 'DEVUELTO'
                                                                                ? 'bg-red-50 text-red-700 border-red-200'
                                                                                : 'bg-amber-50 text-amber-700 border-amber-200'
                                                                    }`}>
                                                                        {log.reviewStatus === 'REVISADO' ? '🟢 Aprobado' : log.reviewStatus === 'DEVUELTO' ? '🔴 Devuelto' : '⏳ Pendiente'}
                                                                    </span>
                                                                </div>
                                                                <p className="text-xs text-slate-400 font-bold">Estado Físico: <span className="text-slate-600 font-extrabold">{log.status}</span></p>
                                                                
                                                                {log.notes && (
                                                                    <p className="text-xs text-slate-600 mt-2 bg-slate-50 p-2.5 rounded-xl italic">"{log.notes}"</p>
                                                                )}

                                                                {log.reviewStatus === 'DEVUELTO' && log.reviewComments && (
                                                                    <div className="bg-red-50 text-red-700 p-3 rounded-xl border border-red-100/50 text-xs">
                                                                        <span className="font-extrabold block mb-0.5">Motivo del rechazo:</span>
                                                                        <span className="italic">"{log.reviewComments}"</span>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Photos */}
                                                            {log.photoUrl && (
                                                                <div className="grid grid-cols-4 gap-2">
                                                                    <a href={log.photoUrl} target="_blank" rel="noreferrer" className="block aspect-square rounded-xl overflow-hidden border border-slate-200 bg-slate-50 relative group">
                                                                        <img src={log.photoUrl} alt="NVT Report" className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                                                                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                                            <Image size={14} className="text-white" />
                                                                        </div>
                                                                    </a>
                                                                </div>
                                                            )}

                                                            {/* Admin Actions */}
                                                            {isManagement && log.reviewStatus === 'PENDIENTE_REVISION' && (
                                                                <div className="flex gap-2 pt-2 border-t border-slate-100">
                                                                    <button 
                                                                        onClick={() => setApprovalModal({ isOpen: true, type: 'nvt', logId: log.id, pricePaid: '' })}
                                                                        className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold py-2 rounded-xl shadow-sm transition-colors cursor-pointer"
                                                                    >
                                                                        <Check size={14} /> Aprobar
                                                                    </button>
                                                                    <button 
                                                                        onClick={() => setRejectionModal({ isOpen: true, type: 'nvt', logId: log.id, comments: '', incorrectPhotos: [], photos: log.photoUrl ? [log.photoUrl] : [] })}
                                                                        className="flex-1 flex items-center justify-center gap-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-bold py-2 rounded-xl shadow-sm transition-colors cursor-pointer"
                                                                    >
                                                                        <X size={14} /> Devolver
                                                                    </button>
                                                                </div>
                                                            )}
                                                            {isManagement && log.reviewStatus === 'REVISADO' && log.pricePaid > 0 && (
                                                                <div className="text-right text-xs font-bold text-slate-500 pt-2 border-t border-slate-100">
                                                                    Pago registrado: <span className="text-slate-800 font-extrabold">{log.pricePaid.toFixed(2)}€</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))
                                                ) : (
                                                    <p className="text-xs text-slate-400 italic col-span-full">No se reportaron NVTs en este parte.</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {/* Approval Modal */}
            {approvalModal.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 flex flex-col space-y-4 animate-scaleUp">
                        <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                            <h3 className="font-extrabold text-slate-800 text-lg">Aprobar Trabajo</h3>
                            <button 
                                onClick={() => setApprovalModal({ isOpen: false, type: '', logId: null, pricePaid: '' })}
                                className="text-slate-400 hover:text-slate-600 focus:outline-none"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <p className="text-sm text-slate-600">
                                ¿Estás seguro de que deseas aprobar este trabajo? Esto lo marcará como facturable para contabilidad.
                            </p>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Precio a pagar (€)</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                        <DollarSign size={14} />
                                    </div>
                                    <input 
                                        type="number"
                                        step="0.01"
                                        placeholder="Dejar vacío o 0 para usar precio estándar"
                                        value={approvalModal.pricePaid}
                                        onChange={(e) => setApprovalModal(prev => ({ ...prev, pricePaid: e.target.value }))}
                                        className="pl-8 w-full text-slate-700 bg-slate-50 border border-slate-200 rounded-2xl p-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button 
                                onClick={() => setApprovalModal({ isOpen: false, type: '', logId: null, pricePaid: '' })}
                                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold py-2.5 rounded-xl transition-colors cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={handleApprove}
                                className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold py-2.5 rounded-xl shadow-sm transition-colors cursor-pointer"
                            >
                                Confirmar y Aprobar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Rejection Modal */}
            {rejectionModal.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-100 flex flex-col space-y-4 animate-scaleUp">
                        <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                            <h3 className="font-extrabold text-slate-800 text-lg flex items-center gap-2 text-red-600">
                                <AlertTriangle size={20} /> Devolver Trabajo por Errores
                            </h3>
                            <button 
                                onClick={() => setRejectionModal({ isOpen: false, type: '', logId: null, comments: '', incorrectPhotos: [], photos: [] })}
                                className="text-slate-400 hover:text-slate-600 focus:outline-none"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <p className="text-sm text-slate-600">
                                El trabajo devuelto se notificará inmediatamente a la subcontrata para que lo repita o corrija.
                            </p>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Motivo detallado (Requerido)</label>
                                <textarea
                                    required
                                    placeholder="Detalla qué está mal (ej: falta foto de NVT, tramo incorrecto, mala calidad de imagen...)"
                                    rows="3"
                                    value={rejectionModal.comments}
                                    onChange={(e) => setRejectionModal(prev => ({ ...prev, comments: e.target.value }))}
                                    className="w-full text-slate-700 bg-slate-50 border border-slate-200 rounded-2xl p-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-red-500"
                                />
                            </div>

                            {/* Mark incorrect photos */}
                            {rejectionModal.photos && rejectionModal.photos.length > 0 && (
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                                        Selecciona las fotos incorrectas (Opcional)
                                    </label>
                                    <div className="grid grid-cols-4 gap-2.5">
                                        {rejectionModal.photos.map((photo, idx) => {
                                            const isSelected = rejectionModal.incorrectPhotos.includes(photo);
                                            return (
                                                <div 
                                                    key={idx}
                                                    onClick={() => toggleIncorrectPhoto(photo)}
                                                    className={`aspect-square rounded-2xl overflow-hidden border-2 relative cursor-pointer group transition-all ${
                                                        isSelected 
                                                            ? 'border-red-500 ring-2 ring-red-500/20 shadow-md scale-95' 
                                                            : 'border-slate-200 hover:border-slate-300'
                                                    }`}
                                                >
                                                    <img src={photo} alt="Thumbnail" className="w-full h-full object-cover" />
                                                    <div className={`absolute inset-0 flex items-center justify-center transition-opacity ${
                                                        isSelected ? 'bg-red-500/40' : 'bg-black/0 group-hover:bg-black/10'
                                                    }`}>
                                                        {isSelected && <X className="text-white drop-shadow-md stroke-[3]" size={20} />}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button 
                                onClick={() => setRejectionModal({ isOpen: false, type: '', logId: null, comments: '', incorrectPhotos: [], photos: [] })}
                                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold py-2.5 rounded-xl transition-colors cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={handleReject}
                                className="flex-1 bg-red-500 hover:bg-red-600 text-white text-xs font-bold py-2.5 rounded-xl shadow-sm transition-colors cursor-pointer"
                            >
                                Enviar a Corregir
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DailyReportsList;
