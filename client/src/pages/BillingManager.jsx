import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { 
    Search, FileText, Download, Filter, Calendar, 
    Clock, CheckCircle, Coins, Users, Image as ImageIcon,
    AlertCircle, FileSpreadsheet, Eye, ChevronRight, Layers
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const getColorStyle = (colorName) => {
    if (!colorName) return {};
    const isStripe = colorName.endsWith('-raya');
    const baseName = isStripe ? colorName.split('-')[0] : colorName;
    
    const colorMap = {
        rojo: '#ef4444',
        verde: '#22c55e',
        azul: '#3b82f6',
        amarillo: '#facc15',
        blanco: '#ffffff',
        gris: '#6b7280',
        marron: '#78350f',
        violeta: '#a855f7',
        turquesa: '#14b8a6',
        negro: '#0f172a',
        naranja: '#f97316',
        rosa: '#ec4899'
    };
    
    const key = baseName.toLowerCase();
    const colorHex = colorMap[key] || '#cbd5e1';
    
    if (isStripe) {
        const stripeColor = key === 'blanco' ? '#000000' : '#ffffff';
        return {
            background: `repeating-linear-gradient(135deg, ${colorHex}, ${colorHex} 4px, ${stripeColor} 4px, ${stripeColor} 8px)`,
            border: '1px solid #94a3b8'
        };
    } else {
        return {
            backgroundColor: colorHex,
            border: key === 'blanco' ? '1px solid #cbd5e1' : `1px solid ${colorHex}`
        };
    }
};

const BillingPage = () => {
    const navigate = useNavigate();
    const { t } = useTranslation();

    // 1. Initial Metadata State
    const [projects, setProjects] = useState([]);
    const [subcontractors, setSubcontractors] = useState([]);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('acometidas'); // 'acometidas' | 'ductos'

    // 2. Filters State
    const getDefaultDates = () => {
        const now = new Date();
        const y = now.getFullYear();
        const m = now.getMonth();
        
        const first = new Date(y, m, 1);
        const last = new Date(y, m + 1, 0);
        
        const formatDate = (d) => {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        return { 
            firstDay: formatDate(first), 
            lastDay: formatDate(last) 
        };
    };

    const { firstDay, lastDay } = getDefaultDates();

    const [filters, setFilters] = useState({
        projectId: '',
        subcontractorId: '',
        reviewStatus: 'PENDIENTE_REVISION', // Default to review pending to focus on pending tasks
        startDate: firstDay,
        endDate: lastDay
    });

    const resetFilters = () => {
        const { firstDay, lastDay } = getDefaultDates();
        setFilters({
            projectId: '',
            subcontractorId: '',
            reviewStatus: 'PENDIENTE_REVISION',
            startDate: firstDay,
            endDate: lastDay
        });
    };

    // 3. Billing & Production Data State
    const [billingData, setBillingData] = useState({
        workLogs: [],
        ductLogs: [],
        totals: {
            totalEurosPending: 0,
            totalEurosApproved: 0,
            subcontractorSummary: []
        }
    });

    // 4. Conformity Modal State
    const [conformityModalOpen, setConformityModalOpen] = useState(false);
    const [selectedLog, setSelectedLog] = useState(null); // { log, type: 'work' | 'duct' }
    const [pricePaidInput, setPricePaidInput] = useState('');
    const [submittingConformity, setSubmittingConformity] = useState(false);

    // 5. Photo Gallery Modal State
    const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
    const [selectedPhotos, setSelectedPhotos] = useState([]);
    const [zoomPhoto, setZoomPhoto] = useState(null);

    // Helpers
    const getFileUrl = (path) => {
        if (!path) return '';
        let cleanPath = path.split('?')[0].replace(/\\/g, '/');
        if (!cleanPath.startsWith('/')) cleanPath = '/' + cleanPath;
        let baseUrl = api.defaults.baseURL || '';
        if (baseUrl === '/') baseUrl = '';
        if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
        const encodedPath = cleanPath.split('/').map(segment => encodeURIComponent(segment)).join('/');
        return `${baseUrl}${encodedPath}`;
    };

    // Fetch initial filter data
    const fetchMetadata = async () => {
        try {
            const [projRes, subRes] = await Promise.all([
                api.get('/api/projects'),
                api.get('/api/subcontractors')
            ]);
            setProjects(projRes.data || []);
            setSubcontractors(subRes.data || []);
        } catch (error) {
            console.error('Error fetching metadata:', error);
        }
    };

    // Fetch production logs and financial calculations
    const fetchBillingData = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filters.projectId) params.append('projectId', filters.projectId);
            if (filters.subcontractorId) params.append('subcontractorId', filters.subcontractorId);
            if (filters.reviewStatus) params.append('reviewStatus', filters.reviewStatus);
            if (filters.startDate) params.append('startDate', filters.startDate);
            if (filters.endDate) params.append('endDate', filters.endDate);

            const res = await api.get(`/api/billing/data?${params.toString()}`);
            const rawData = res.data || {};
            setBillingData({
                workLogs: Array.isArray(rawData.workLogs) ? rawData.workLogs : [],
                ductLogs: Array.isArray(rawData.ductLogs) ? rawData.ductLogs : [],
                totals: {
                    totalEurosPending: rawData.totals?.totalEurosPending !== undefined ? rawData.totals.totalEurosPending : 0,
                    totalEurosApproved: rawData.totals?.totalEurosApproved !== undefined ? rawData.totals.totalEurosApproved : 0,
                    subcontractorSummary: Array.isArray(rawData.totals?.subcontractorSummary) ? rawData.totals.subcontractorSummary : []
                }
            });
        } catch (error) {
            console.error('Error fetching billing data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMetadata();
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchBillingData();
        }, 300);
        return () => clearTimeout(timer);
    }, [filters]);

    // Handle excel report export
    const handleExport = async () => {
        try {
            const params = new URLSearchParams();
            if (filters.projectId) params.append('projectId', filters.projectId);
            if (filters.subcontractorId) params.append('subcontractorId', filters.subcontractorId);
            if (filters.reviewStatus) params.append('reviewStatus', filters.reviewStatus);
            if (filters.startDate) params.append('startDate', filters.startDate);
            if (filters.endDate) params.append('endDate', filters.endDate);

            const response = await api.get(`/api/billing/export?${params.toString()}`, {
                responseType: 'blob'
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Control_Produccion_${new Date().toISOString().slice(0, 10)}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            console.error('Error exporting excel:', error);
            alert('Error al exportar los datos a excel.');
        }
    };

    // Open Conformity Modal & suggest price
    const openConformityModal = (log, type) => {
        setSelectedLog({ log, type });
        if (type === 'work') {
            const suggested = log.address?.project?.pricePerAcometida || 0;
            setPricePaidInput(suggested.toString());
        } else {
            const distance = log.distance || 0;
            const pricePerMeter = log.project?.pricePerMeter || 0;
            const suggested = (distance * pricePerMeter).toFixed(2);
            setPricePaidInput(suggested);
        }
        setConformityModalOpen(true);
    };

    // Submit reviewed price and mark as REVISADO
    const submitConformity = async () => {
        if (!selectedLog) return;
        setSubmittingConformity(true);
        try {
            const endpoint = selectedLog.type === 'work' 
                ? `/api/civil-works/work-log/${selectedLog.log.id}/review`
                : `/api/civil-works/duct-log/${selectedLog.log.id}/review`;

            await api.put(endpoint, {
                status: 'REVISADO',
                pricePaid: parseFloat(pricePaidInput) || 0.0
            });

            setConformityModalOpen(false);
            fetchBillingData();
        } catch (error) {
            console.error('Error marking work log as reviewed:', error);
            alert('Error al procesar la conformidad del trabajo.');
        } finally {
            setSubmittingConformity(false);
        }
    };

    // Open photo viewer
    const handleViewPhotos = (photos) => {
        if (!photos || photos.length === 0) return;
        setSelectedPhotos(photos);
        setIsPhotoModalOpen(true);
    };

    return (
        <div className="max-w-7xl mx-auto space-y-6 px-4 py-6">
            {/* 1. Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <FileText className="text-blue-600" /> Control de Producción
                    </h2>
                    <p className="text-slate-500 text-sm">
                        Supervise partes diarios de subcontratas, revise trabajos civiles y otorgue conformidad para facturación.
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleExport}
                        className="bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-sm transition-all"
                    >
                        <Download size={20} /> Exportar Excel
                    </button>
                </div>
            </div>

            {/* 2. Top Metric Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-2xl border border-blue-200 shadow-sm flex items-center gap-4">
                    <div className="p-4 bg-blue-500 text-white rounded-xl">
                        <Clock size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-blue-800 uppercase tracking-wide">Importe Pendiente</p>
                        <p className="text-2xl font-black text-slate-800">{billingData.totals.totalEurosPending}€</p>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 p-6 rounded-2xl border border-emerald-200 shadow-sm flex items-center gap-4">
                    <div className="p-4 bg-emerald-500 text-white rounded-xl">
                        <Coins size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-emerald-800 uppercase tracking-wide">Importe Aprobado</p>
                        <p className="text-2xl font-black text-slate-800">{billingData.totals.totalEurosApproved}€</p>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className="p-4 bg-amber-500 text-white rounded-xl">
                        <AlertCircle size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Acometidas Pendientes</p>
                        <p className="text-2xl font-black text-slate-800">
                            {billingData.workLogs.filter(w => w.reviewStatus === 'PENDIENTE_REVISION').length}
                        </p>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className="p-4 bg-indigo-500 text-white rounded-xl">
                        <CheckCircle size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Metros Pendientes</p>
                        <p className="text-2xl font-black text-slate-800">
                            {billingData.ductLogs.filter(d => d.reviewStatus === 'PENDIENTE_REVISION')
                                .reduce((acc, d) => acc + (d.distance || 0), 0).toFixed(1)}m
                        </p>
                    </div>
                </div>
            </div>

            {/* 3. Subcontractor Aggregated Summary Table */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                    <Users className="text-slate-500" size={20} />
                    <h3 className="font-bold text-slate-800">Resumen Financiero por Subcontrata</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-100/50 border-b border-slate-200 text-slate-600 text-xs uppercase font-bold tracking-wider">
                                <th className="p-4">Subcontrata</th>
                                <th className="p-4 text-center">Acometidas</th>
                                <th className="p-4 text-center">Ductos Registrados</th>
                                <th className="p-4 text-right">Acumulado Estimado (Pendiente)</th>
                                <th className="p-4 text-right">Acumulado Aprobado (A Facturar)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {billingData.totals.subcontractorSummary.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="p-8 text-center text-slate-400 italic">
                                        No hay información disponible de subcontratas en este rango.
                                    </td>
                                </tr>
                            ) : (
                                billingData.totals.subcontractorSummary.map((sub) => (
                                    <tr key={sub.id} className="hover:bg-slate-50/50 transition-colors text-sm text-slate-700">
                                        <td className="p-4 font-bold text-slate-800">{sub.name}</td>
                                        <td className="p-4 text-center font-mono">{sub.workLogsCount}</td>
                                        <td className="p-4 text-center font-mono">{sub.ductLogsCount}</td>
                                        <td className="p-4 text-right font-mono text-amber-600 font-bold">{sub.pendingAmount}€</td>
                                        <td className="p-4 text-right font-mono text-emerald-600 font-bold">{sub.approvedAmount}€</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 4. Filters Control Panel */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <Filter size={18} className="text-slate-500" /> Filtros de Producción
                    </h3>
                    <button
                        onClick={resetFilters}
                        className="text-xs text-blue-600 hover:text-blue-800 font-bold underline transition-colors"
                    >
                        Limpiar Filtros
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Proyecto</label>
                        <select
                            value={filters.projectId}
                            onChange={(e) => setFilters({ ...filters, projectId: e.target.value })}
                            className="w-full border border-slate-200 rounded-xl p-2.5 bg-slate-50 text-slate-700 focus:bg-white outline-none focus:ring-2 focus:ring-blue-500/20 text-sm transition-all"
                        >
                            <option value="">Todos los Proyectos</option>
                            {projects.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Subcontrata</label>
                        <select
                            value={filters.subcontractorId}
                            onChange={(e) => setFilters({ ...filters, subcontractorId: e.target.value })}
                            className="w-full border border-slate-200 rounded-xl p-2.5 bg-slate-50 text-slate-700 focus:bg-white outline-none focus:ring-2 focus:ring-blue-500/20 text-sm transition-all"
                        >
                            <option value="">Todas las Subcontratas</option>
                            {subcontractors.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Estado Revisión</label>
                        <select
                            value={filters.reviewStatus}
                            onChange={(e) => setFilters({ ...filters, reviewStatus: e.target.value })}
                            className="w-full border border-slate-200 rounded-xl p-2.5 bg-slate-50 text-slate-700 focus:bg-white outline-none focus:ring-2 focus:ring-blue-500/20 text-sm transition-all"
                        >
                            <option value="TODOS">Cualquier Estado</option>
                            <option value="PENDIENTE_REVISION">Pendiente de Revisión</option>
                            <option value="REVISADO">Revisado (Aprobado)</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Desde</label>
                        <input
                            type="date"
                            value={filters.startDate}
                            onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                            className="w-full border border-slate-200 rounded-xl p-2.5 bg-slate-50 text-slate-700 focus:bg-white outline-none focus:ring-2 focus:ring-blue-500/20 text-sm transition-all"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Hasta</label>
                        <input
                            type="date"
                            value={filters.endDate}
                            onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                            className="w-full border border-slate-200 rounded-xl p-2.5 bg-slate-50 text-slate-700 focus:bg-white outline-none focus:ring-2 focus:ring-blue-500/20 text-sm transition-all"
                        />
                    </div>
                </div>
            </div>

            {/* 5. Production Logs Tabs & Tables */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                {/* Tabs selection */}
                <div className="flex border-b border-slate-100 bg-slate-50/50 p-2">
                    <button
                        onClick={() => setActiveTab('acometidas')}
                        className={`flex-1 py-3 text-center font-bold text-sm rounded-xl transition-all flex justify-center items-center gap-2 ${activeTab === 'acometidas' ? 'bg-white text-blue-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                        <CheckCircle size={16} /> Acometidas Realizadas ({billingData.workLogs.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('ductos')}
                        className={`flex-1 py-3 text-center font-bold text-sm rounded-xl transition-all flex justify-center items-center gap-2 ${activeTab === 'ductos' ? 'bg-white text-blue-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                        <Layers size={16} /> Ductos / Trazados Obra ({billingData.ductLogs.length})
                    </button>
                </div>

                <div className="p-4">
                    {loading ? (
                        <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                            <span>Cargando logs de producción...</span>
                        </div>
                    ) : activeTab === 'acometidas' ? (
                        // Acometidas Table
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs font-bold uppercase tracking-wider">
                                        <th className="p-4">Fecha</th>
                                        <th className="p-4">Subcontrata</th>
                                        <th className="p-4">Proyecto</th>
                                        <th className="p-4">Dirección</th>
                                        <th className="p-4">Estado Físico</th>
                                        <th className="p-4">Evidencias</th>
                                        <th className="p-4">Estado Revisión</th>
                                        <th className="p-4 text-right">Precio (€)</th>
                                        <th className="p-4 text-center">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {billingData.workLogs.length === 0 ? (
                                        <tr>
                                            <td colSpan="9" className="p-8 text-center text-slate-400 italic">
                                                No se encontraron acometidas que coincidan con los filtros.
                                            </td>
                                        </tr>
                                    ) : (
                                        billingData.workLogs.map((wl) => {
                                            const project = wl.address?.project;
                                            const pricePerAcometida = project?.pricePerAcometida || 0;
                                            const displayPrice = wl.reviewStatus === 'REVISADO' ? wl.pricePaid : pricePerAcometida;

                                            return (
                                                <tr key={wl.id} className="hover:bg-slate-50/50 transition-colors text-sm text-slate-700">
                                                    <td className="p-4 font-mono text-xs">{new Date(wl.report?.date || wl.createdAt).toLocaleDateString('es-ES')}</td>
                                                    <td className="p-4 font-bold text-slate-800">{wl.report?.subcontractor?.name}</td>
                                                    <td className="p-4 text-slate-500">{project?.name || 'N/A'}</td>
                                                    <td className="p-4">
                                                         <div>{wl.address?.street} {wl.address?.number}</div>
                                                         <div className="flex flex-wrap gap-1.5 items-center mt-1">
                                                             <span className="text-[10px] text-slate-400 font-bold uppercase">NVT: {wl.address?.nvt || 'Sin NVT'}</span>
                                                             {wl.connectionColor && (
                                                                 <span className="text-[10px] text-slate-500 font-extrabold uppercase px-1.5 py-0.5 bg-slate-50 rounded border border-slate-200 flex items-center gap-1 shadow-sm">
                                                                     <span 
                                                                         className="w-2.5 h-2.5 rounded-full inline-block shrink-0 shadow-sm" 
                                                                         style={getColorStyle(wl.connectionColor)}
                                                                     />
                                                                     {wl.connectionColor.replace('-raya', ' (Raya)')}
                                                                 </span>
                                                             )}
                                                         </div>
                                                     </td>
                                                    <td className="p-4">
                                                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${wl.status === 'HECHO' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                                                            {wl.status}
                                                        </span>
                                                    </td>
                                                    <td className="p-4">
                                                        {wl.photos && wl.photos.length > 0 ? (
                                                            <button
                                                                onClick={() => handleViewPhotos(wl.photos)}
                                                                className="text-xs text-blue-600 hover:text-blue-800 font-bold underline flex items-center gap-1"
                                                            >
                                                                <ImageIcon size={14} /> {wl.photos.length} Fotos
                                                            </button>
                                                        ) : (
                                                            <span className="text-slate-400 text-xs italic">Sin fotos</span>
                                                        )}
                                                    </td>
                                                    <td className="p-4">
                                                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${wl.reviewStatus === 'REVISADO' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                                                            {wl.reviewStatus === 'REVISADO' ? 'Revisado' : 'Pendiente'}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-right font-mono font-bold text-slate-800">
                                                        {displayPrice || 0}€
                                                    </td>
                                                    <td className="p-4 text-center">
                                                        {wl.reviewStatus === 'PENDIENTE_REVISION' ? (
                                                            <button
                                                                onClick={() => openConformityModal(wl, 'work')}
                                                                className="bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white px-3 py-1 rounded-lg text-xs font-bold transition-all border border-blue-200"
                                                            >
                                                                Dar Conformidad
                                                            </button>
                                                        ) : (
                                                            <span className="text-[10px] text-slate-400 font-mono italic">Conformado</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        // Ductos Table
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs font-bold uppercase tracking-wider">
                                        <th className="p-4">Fecha</th>
                                        <th className="p-4">Subcontrata</th>
                                        <th className="p-4">Proyecto Asignado</th>
                                        <th className="p-4 text-center">Longitud Zanja</th>
                                        <th className="p-4">Evidencias</th>
                                        <th className="p-4">Estado Revisión</th>
                                        <th className="p-4 text-right">Precio (€)</th>
                                        <th className="p-4 text-center">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {billingData.ductLogs.length === 0 ? (
                                        <tr>
                                            <td colSpan="8" className="p-8 text-center text-slate-400 italic">
                                                No se encontraron ductos de calle que coincidan con los filtros.
                                            </td>
                                        </tr>
                                    ) : (
                                        billingData.ductLogs.map((dl) => {
                                            const project = dl.project;
                                            const pricePerMeter = project?.pricePerMeter || 0;
                                            const distance = dl.distance || 0;
                                            const displayPrice = dl.reviewStatus === 'REVISADO' ? dl.pricePaid : (distance * pricePerMeter);

                                            return (
                                                <tr key={dl.id} className="hover:bg-slate-50/50 transition-colors text-sm text-slate-700">
                                                    <td className="p-4 font-mono text-xs">{new Date(dl.report?.date || dl.createdAt).toLocaleDateString('es-ES')}</td>
                                                    <td className="p-4 font-bold text-slate-800">{dl.report?.subcontractor?.name}</td>
                                                    <td className="p-4 text-slate-500">{project?.name || 'N/A'}</td>
                                                    <td className="p-4 text-center font-mono font-bold text-slate-800">
                                                        {distance}m
                                                    </td>
                                                    <td className="p-4">
                                                        {dl.photos && dl.photos.length > 0 ? (
                                                            <button
                                                                onClick={() => handleViewPhotos(dl.photos)}
                                                                className="text-xs text-blue-600 hover:text-blue-800 font-bold underline flex items-center gap-1"
                                                            >
                                                                <ImageIcon size={14} /> {dl.photos.length} Fotos
                                                            </button>
                                                        ) : (
                                                            <span className="text-slate-400 text-xs italic">Sin fotos</span>
                                                        )}
                                                    </td>
                                                    <td className="p-4">
                                                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${dl.reviewStatus === 'REVISADO' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                                                            {dl.reviewStatus === 'REVISADO' ? 'Revisado' : 'Pendiente'}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-right font-mono font-bold text-slate-800">
                                                        {parseFloat(displayPrice || 0).toFixed(2)}€
                                                    </td>
                                                    <td className="p-4 text-center">
                                                        {dl.reviewStatus === 'PENDIENTE_REVISION' ? (
                                                            <button
                                                                onClick={() => openConformityModal(dl, 'duct')}
                                                                className="bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white px-3 py-1 rounded-lg text-xs font-bold transition-all border border-blue-200"
                                                            >
                                                                Dar Conformidad
                                                            </button>
                                                        ) : (
                                                            <span className="text-[10px] text-slate-400 font-mono italic">Conformado</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* 6. CONFORMITY DIALOG MODAL */}
            {conformityModalOpen && selectedLog && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[5000] p-4">
                    <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl border border-slate-100 flex flex-col space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <h3 className="font-bold text-slate-800 text-lg">Dar Conformidad a Trabajo</h3>
                            <button
                                onClick={() => setConformityModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600 text-xl font-bold"
                            >
                                &times;
                            </button>
                        </div>

                        <div className="text-sm text-slate-600 space-y-2">
                            <p>
                                <strong>Subcontrata:</strong> {selectedLog.log.report?.subcontractor?.name}
                            </p>
                            <p>
                                <strong>Proyecto:</strong> {selectedLog.type === 'work' ? selectedLog.log.address?.project?.name : selectedLog.log.project?.name}
                            </p>
                            {selectedLog.type === 'work' ? (
                                <p>
                                    <strong>Acometida:</strong> {selectedLog.log.address?.street} {selectedLog.log.address?.number}
                                </p>
                            ) : (
                                <p>
                                    <strong>Distancia calculada:</strong> {selectedLog.log.distance} metros
                                </p>
                            )}
                            <p className="p-3 bg-slate-50 rounded-xl text-xs text-slate-500 italic mt-2">
                                * Se ha calculado una estimación en base a las tarifas registradas en la ficha del proyecto. Si es correcto pulse Confirmar, o altere el importe final a pagar abajo.
                            </p>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Importe Final a Pagar (€)</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={pricePaidInput}
                                    onChange={(e) => setPricePaidInput(e.target.value)}
                                    className="w-full border border-slate-200 rounded-xl p-3 bg-slate-50 text-slate-800 font-bold focus:bg-white outline-none focus:ring-2 focus:ring-blue-500/20 text-sm transition-all"
                                    placeholder="0.00"
                                    required
                                />
                                <span className="absolute right-4 top-3 text-slate-400 font-bold text-sm">€</span>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-3">
                            <button
                                onClick={() => setConformityModalOpen(false)}
                                className="px-4 py-2 rounded-xl text-slate-500 hover:bg-slate-100 text-sm font-bold transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={submitConformity}
                                disabled={submittingConformity}
                                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-6 py-2 rounded-xl font-bold text-sm shadow-sm transition-all"
                            >
                                {submittingConformity ? 'Guardando...' : 'Confirmar y Aprobar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 7. PHOTO VIEWER MODAL */}
            {isPhotoModalOpen && (
                <div 
                    className="fixed inset-0 bg-slate-950/95 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
                    onClick={() => setIsPhotoModalOpen(false)}
                >
                    <div 
                        className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-slate-100" 
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <div>
                                <h3 className="font-bold text-slate-800">Galería de Evidencias</h3>
                                <p className="text-xs text-slate-500">{selectedPhotos.length} fotos asociadas al parte diario</p>
                            </div>
                            <button 
                                onClick={() => setIsPhotoModalOpen(false)} 
                                className="bg-slate-200 hover:bg-slate-300 text-slate-600 px-3 py-1.5 rounded-xl transition-colors font-bold text-sm"
                            >
                                Cerrar
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto grid grid-cols-2 md:grid-cols-3 gap-4 custom-scrollbar max-h-[60vh]">
                            {selectedPhotos.map((photo, idx) => {
                                const url = getFileUrl(photo);
                                return (
                                    <div 
                                        key={idx} 
                                        className="relative aspect-video bg-slate-100 rounded-2xl overflow-hidden border border-slate-200 group cursor-zoom-in"
                                        onClick={() => setZoomPhoto(url)}
                                    >
                                        <img
                                            src={url}
                                            alt={`Evidencia ${idx}`}
                                            className="w-full h-full object-cover hover:scale-110 transition-transform duration-500"
                                            onError={(e) => { e.target.src = '/image-placeholder.png'; }}
                                        />
                                        <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center font-bold text-white text-xs">
                                            Ampliar Foto
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* 8. ZOOM LIGHTBOX FOR SINGLE PHOTO */}
            {zoomPhoto && (
                <div 
                    className="fixed inset-0 bg-black/98 z-[100000] flex items-center justify-center p-2 cursor-zoom-out" 
                    onClick={() => setZoomPhoto(null)}
                >
                    <img 
                        src={zoomPhoto} 
                        alt="Zoom de evidencia" 
                        className="max-w-full max-h-full object-contain shadow-2xl"
                    />
                </div>
            )}
        </div>
    );
};

export default BillingPage;
