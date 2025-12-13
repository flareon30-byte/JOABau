import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { Search, FileText, Download, Filter, Calendar, Trash2 } from 'lucide-react';

const BillingPage = () => {
    const [projects, setProjects] = useState([]);
    const [filters, setFilters] = useState({
        projectId: '',
        startDate: '',
        endDate: '',
        nvt: ''
    });

    // Data State
    const [billingData, setBillingData] = useState({
        soplado: [],
        fusion: [],
        activation: [],
        protocol: []
    });
    const [loading, setLoading] = useState(false);

    // Tab State
    const [activeTab, setActiveTab] = useState('soplado');

    useEffect(() => {
        fetchProjects();
    }, []);

    // Effect to fetch data when filters change (debounced for NVT)
    useEffect(() => {
        const timer = setTimeout(() => {
            fetchBillingData();
        }, 500);
        return () => clearTimeout(timer);
    }, [filters]);

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

    const renderTable = () => {
        let data = [];
        let columns = [];
        let emptyMsg = "No hay datos";

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
                columns = ['Fecha', 'Proyecto', 'Dirección', 'Cliente', 'Tipo', 'Familaires', 'Fotos', 'Acciones'];
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
                            <tr key={row.id} className="hover:bg-slate-50 transition-colors text-sm text-slate-700">
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
                                        <td className="p-4">{new Date(row.createdAt).toLocaleDateString()}</td>
                                        <td className="p-4 font-medium text-slate-800">{row.address?.project?.name}</td>
                                        <td className="p-4">{row.address?.street} {row.address?.number}</td>
                                        <td className="p-4">{row.address?.clientName || 'Sin Nombre'}</td>
                                        <td className="p-4"><span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-bold">{row.activationType}</span></td>
                                        <td className="p-4">{row.familiesCount}</td>
                                        <td className="p-4">{row.photos?.length || 0}</td>
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
                                <td className="p-4 w-10">
                                    <button
                                        onClick={() => handleDelete(row.id, activeTab)}
                                        className="text-red-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors"
                                        title="Eliminar trabajo y revertir estado"
                                    >
                                        <Trash2 size={18} />
                                    </button>
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
                <button
                    onClick={handleExport}
                    className="bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-sm transition-all"
                >
                    <Download size={20} /> Exportar Excel
                </button>
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
