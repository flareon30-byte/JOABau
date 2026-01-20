import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { Search, FileText, Download, Filter, Calendar, Trash2 } from 'lucide-react';

const BillingPage = () => {
    // 1. Projects State
    const [projects, setProjects] = useState([]);
    
    // 2. Filters State
    const [filters, setFilters] = useState({
        projectId: '',
        startDate: '',
        endDate: '',
        nvt: ''
    });

    // 3. Data State
    const [billingData, setBillingData] = useState({
        soplado: [],
        fusion: [],
        activation: [],
        protocol: []
    });
    const [loading, setLoading] = useState(false);

    // 4. Tab State
    const [activeTab, setActiveTab] = useState('soplado');

    // 5. Selection State (New)
    const [selectedIds, setSelectedIds] = useState([]);

    useEffect(() => {
        fetchProjects();
    }, []);

    // Effect to fetch data when filters change
    useEffect(() => {
        const timer = setTimeout(() => {
            fetchBillingData();
        }, 500);
        return () => clearTimeout(timer);
    }, [filters]);

    // Clear selection when tab changes
    useEffect(() => {
        setSelectedIds([]);
    }, [activeTab]);

    const fetchProjects = async () => {
        try {
            const res = await api.get('/api/projects');
            setProjects(res.data);
        } catch (error) { console.error(error); }
    };

    const fetchBillingData = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filters.projectId) params.append('projectId', filters.projectId);
            if (filters.startDate) params.append('startDate', filters.startDate);
            if (filters.endDate) params.append('endDate', filters.endDate);
            if (filters.nvt) params.append('nvt', filters.nvt);

            const res = await api.get(`/api/billing/data?${params.toString()}`);
            setBillingData(res.data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id, type) => {
        if (!window.confirm('¿Estás seguro de que quieres eliminar este trabajo? Se revertirá el estado de la dirección.')) return;

        try {
            await api.delete(`/api/billing/${type}/${id}`);
            alert('Registro eliminado');
            fetchBillingData();
        } catch (error) {
            console.error(error);
            alert('Error al eliminar');
        }
    };

    const handleExport = async () => {
        try {
            const params = new URLSearchParams();
            if (filters.projectId) params.append('projectId', filters.projectId);
            if (filters.startDate) params.append('startDate', filters.startDate);
            if (filters.endDate) params.append('endDate', filters.endDate);
            if (filters.nvt) params.append('nvt', filters.nvt);

            const response = await api.get(`/api/billing/export?${params.toString()}`, {
                responseType: 'blob'
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Facturacion_${new Date().toISOString().slice(0, 10)}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            console.error('Error exporting excel:', error);
            alert('Error al exportar Excel');
        }
    };

    // --- NEW: Download Docs (PDF + Photos) as ZIP ---
    const handleDownloadDocs = async (ids = []) => {
        const targetIds = ids.length > 0 ? ids : selectedIds;
        if (targetIds.length === 0) {
            alert('Selecciona al menos una activación.');
            return;
        }

        try {
            const params = new URLSearchParams();
            params.append('ids', targetIds.join(',')); // Send comma-separated IDs

            const response = await api.get(`/api/billing/export-photos?${params.toString()}`, {
                responseType: 'blob'
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Documentacion_Cliente_${new Date().toISOString().slice(0, 10)}.zip`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            console.error('Error downloading docs:', error);
            alert('Error al descargar documentación. Verifica que existan fotos/pdf.');
        }
    };

    // Selection Handlers
    const toggleSelectAll = (data) => {
        if (selectedIds.length === data.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(data.map(d => d.id));
        }
    };

    const toggleSelect = (id) => {
        if (selectedIds.includes(id)) {
            setSelectedIds(selectedIds.filter(sid => sid !== id));
        } else {
            setSelectedIds([...selectedIds, id]);
        }
    };


    const renderTable = () => {
        let data = [];
        let columns = [];
        let emptyMsg = "No hay datos";

        // Base URL for viewing PDFs
        const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

        switch (activeTab) {
            case 'soplado':
                data = billingData.soplado;
                columns = ['Fecha', 'Proyecto', 'Dirección', 'NVT', 'Metros', 'TK', 'Color', 'Acciones'];
                emptyMsg = "No hay trabajos de soplado";
                break;
            case 'fusion':
                data = billingData.fusion;
                columns = ['Fecha', 'Proyecto', 'NVT', 'Fusiones', 'Bandeja', 'Notas', 'Acciones'];
                emptyMsg = "No hay trabajos de fusión";
                break;
            case 'activation':
                data = billingData.activation;
                // Add Checkbox column header if activation tab
                columns = [
                    <div key="chk" className="flex items-center"><input type="checkbox" checked={data.length > 0 && selectedIds.length === data.length} onChange={() => toggleSelectAll(data)} className="w-4 h-4 rounded border-slate-300" /></div>,
                    'Fecha', 'Proyecto', 'Dirección', 'Cliente', 'Tipo', 'Fotos', 'PDF', 'Acciones'
                ];
                emptyMsg = "No hay activaciones";
                break;
            case 'protocol':
                data = billingData.protocol;
                columns = ['Fecha', 'Proyecto', 'Dirección', 'NVT', 'Estado', 'Notas', 'Acciones'];
                emptyMsg = "No hay protocolos completados";
                break;
            default:
                break;
        }

        if (loading) return <div className="p-8 text-center text-slate-500">Cargando datos...</div>;
        if (!data || data.length === 0) return <div className="p-8 text-center text-slate-500">{emptyMsg}</div>;

        return (
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-sm uppercase tracking-wider">
                            {columns.map((col, idx) => <th key={idx} className="p-4 font-semibold">{col}</th>)}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {data.map((row) => (
                            <tr key={row.id} className={`hover:bg-slate-50 transition-colors text-sm text-slate-700 ${selectedIds.includes(row.id) ? 'bg-blue-50' : ''}`}>

                                {activeTab === 'soplado' && (
                                    <>
                                        <td className="p-4">{new Date(row.createdAt).toLocaleDateString()}</td>
                                        <td className="p-4 font-medium text-slate-800">{row.address?.project?.name}</td>
                                        <td className="p-4">{row.address?.street} {row.address?.number}</td>
                                        <td className="p-4 font-bold text-blue-600">{row.address?.nvt || '-'}</td>
                                        <td className="p-4">{row.meters}m</td>
                                        <td className="p-4">{row.tk || '-'}</td>
                                        <td className="p-4">{row.tubeColor || '-'}</td>
                                    </>
                                )}
                                {activeTab === 'fusion' && (
                                    <>
                                        <td className="p-4">{new Date(row.createdAt).toLocaleDateString()}</td>
                                        <td className="p-4 font-medium text-slate-800">{row.project?.name}</td>
                                        <td className="p-4 font-bold text-purple-600">{row.nvtName}</td>
                                        <td className="p-4">{row.fusionCount}</td>
                                        <td className="p-4">{row.isTray ? 'Sí' : 'No'}</td>
                                        <td className="p-4 text-slate-500 truncate max-w-xs">{row.description}</td>
                                    </>
                                )}
                                {activeTab === 'activation' && (
                                    <>
                                        <td className="p-4">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.includes(row.id)}
                                                onChange={() => toggleSelect(row.id)}
                                                className="w-4 h-4 rounded border-slate-300"
                                            />
                                        </td>
                                        <td className="p-4">{new Date(row.createdAt).toLocaleDateString()}</td>
                                        <td className="p-4 font-medium text-slate-800">{row.address?.project?.name}</td>
                                        <td className="p-4">{row.address?.street} {row.address?.number}</td>
                                        <td className="p-4">{row.address?.clientName || 'Sin Nombre'}</td>
                                        <td className="p-4"><span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-bold">{row.activationType}</span></td>
                                        <td className="p-4 font-bold text-slate-500">{row.photos?.length || 0}</td>

                                        {/* PDF Status / Link */}
                                        <td className="p-4">
                                            {row.pdfPath ? (
                                                <a
                                                    href={`${BASE_URL}/${row.pdfPath}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-red-500 hover:text-red-700 flex items-center gap-1 font-semibold"
                                                    title="Ver PDF"
                                                >
                                                    <FileText size={18} /> PDF
                                                </a>
                                            ) : (
                                                <span className="text-slate-300">-</span>
                                            )}
                                        </td>
                                    </>
                                )}
                                {activeTab === 'protocol' && (
                                    <>
                                        <td className="p-4">{new Date(row.updatedAt).toLocaleDateString()}</td>
                                        <td className="p-4 font-medium text-slate-800">{row.address?.project?.name}</td>
                                        <td className="p-4">{row.address?.street} {row.address?.number}</td>
                                        <td className="p-4 font-bold text-purple-600">{row.address?.nvt || '-'}</td>
                                        <td className="p-4"><span className="bg-purple-100 text-purple-700 px-2 py-1 rounded-full text-xs font-bold">{row.status}</span></td>
                                        <td className="p-4 text-slate-500">{row.reciteReason || '-'}</td>
                                    </>
                                )}

                                {/* ACTIONS COLUMN */}
                                <td className="p-4 w-28">
                                    <div className="flex items-center gap-2">
                                        {activeTab === 'activation' && (
                                            <button
                                                onClick={() => handleDownloadDocs([row.id])} // Download ZIP for single item
                                                className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 p-2 rounded-lg transition-colors"
                                                title="Descargar ZIP (Fotos + PDF)"
                                            >
                                                <Download size={18} />
                                            </button>
                                        )}

                                        <button
                                            onClick={() => handleDelete(row.id, activeTab)}
                                            className="text-red-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors"
                                            title="Eliminar trabajo y revertir estado"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };



    return (
        <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <FileText className="text-blue-600" /> Facturación
                    </h2>
                    <p className="text-slate-500 text-sm">Gestiona y exporta los trabajos realizados para facturar.</p>
                </div>
                <div className="flex gap-2">
                    {activeTab === 'activation' && selectedIds.length > 0 && (
                        <button
                            onClick={() => handleDownloadDocs()}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-sm transition-all"
                        >
                            <Download size={20} /> Docs ({selectedIds.length})
                        </button>
                    )}
                    <button
                        onClick={handleExport}
                        className="bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-sm transition-all"
                    >
                        <Download size={20} /> Exportar Excel
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Proyecto</label>
                    <div className="relative">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <select
                            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                            value={filters.projectId}
                            onChange={(e) => setFilters({ ...filters, projectId: e.target.value })}
                        >
                            <option value="">Todos los proyectos</option>
                            {projects.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Desde</label>
                    <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="date"
                            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                            value={filters.startDate}
                            onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                        />
                    </div>
                </div>

                <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Hasta</label>
                    <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="date"
                            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                            value={filters.endDate}
                            onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                        />
                    </div>
                </div>

                <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Buscar NVT</label>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="text"
                            placeholder="Ej: NVT-01"
                            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                            value={filters.nvt}
                            onChange={(e) => setFilters({ ...filters, nvt: e.target.value })}
                        />
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="flex border-b border-slate-200 overflow-x-auto">
                    {[
                        { id: 'soplado', label: 'Soplado', color: 'blue' },
                        { id: 'fusion', label: 'Fusión', color: 'purple' },
                        { id: 'activation', label: 'Activaciones', color: 'green' },
                        { id: 'protocol', label: 'Protocolos', color: 'indigo' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-6 py-4 font-bold text-sm transition-all whitespace-nowrap ${activeTab === tab.id
                                ? `text-${tab.color}-600 border-b-2 border-${tab.color}-600 bg-${tab.color}-50`
                                : 'text-slate-500 hover:bg-slate-50'
                                }`}
                        >
                            {tab.label} ({billingData[tab.id]?.length || 0})
                        </button>
                    ))}
                </div>

                {/* Table Content */}
                <div>
                    {renderTable()}
                </div>
            </div>
        </div>
    );
};

export default BillingPage;
