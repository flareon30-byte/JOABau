import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { Search, FileText, Download, Filter, Calendar, Trash2, TrendingUp, Sun } from 'lucide-react';

const BillingPage = () => {
    // 1. Projects State
    const [projects, setProjects] = useState([]);

    // 2. Filters State
    const [filters, setFilters] = useState({
        projectId: '',
        clientCompanyId: '',
        startDate: '',
        endDate: '',
        nvt: '',
        type: ''
    });

    const [clients, setClients] = useState([]);

    // 3. Data State
    const [billingData, setBillingData] = useState({
        soplado: [],
        fusion: [],
        activation: [],
        protocol: [],
        repair: []
    });
    const [loading, setLoading] = useState(false);

    // 4. Tab State
    const [activeTab, setActiveTab] = useState('soplado');

    // 5. Selection State (New)
    const [selectedIds, setSelectedIds] = useState([]);

    // 6. Photo Modal State
    const [selectedPhotos, setSelectedPhotos] = useState([]);
    const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);

    // Photo Viewer Handler
    const handleViewPhotos = (photos) => {
        if (!photos || photos.length === 0) return;
        setSelectedPhotos(photos);
        setIsPhotoModalOpen(true);
    };

    useEffect(() => {
        fetchProjects();
        fetchClients();
    }, []);

    const fetchClients = async () => {
        try {
            const res = await api.get('/api/clients');
            setClients(res.data);
        } catch (error) { console.error(error); }
    };

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
            if (filters.clientCompanyId) params.append('clientCompanyId', filters.clientCompanyId);
            if (filters.startDate) params.append('startDate', filters.startDate);
            if (filters.endDate) params.append('endDate', filters.endDate);
            if (filters.nvt) params.append('nvt', filters.nvt);
            if (filters.type) params.append('type', filters.type);

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
            if (filters.clientCompanyId) params.append('clientCompanyId', filters.clientCompanyId);
            if (filters.startDate) params.append('startDate', filters.startDate);
            if (filters.endDate) params.append('endDate', filters.endDate);
            if (filters.nvt) params.append('nvt', filters.nvt);
            if (filters.type) params.append('type', filters.type);

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

        // Use relative path for production (since Express serves both API and frontend)
        // or fallback to localhost for local dev if environment variable is not set.
        let BASE_URL = '';
        if (import.meta.env.DEV) {
            BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        }

        const getFileUrl = (path) => {
            if (!path) return '';

            // 1. Remove any query strings that might be stored in the DB by mistake
            let cleanPath = path.split('?')[0];

            // 2. Fix backslashes
            cleanPath = cleanPath.replace(/\\/g, '/');

            // 3. Remove leading slash
            if (cleanPath.startsWith('/')) cleanPath = cleanPath.slice(1);

            // 4. EncodeURI to handle spaces and special chars in filenames
            const encodedPath = cleanPath.split('/').map(segment => encodeURIComponent(segment)).join('/');

            return `${BASE_URL ? BASE_URL + '/' : '/'}${encodedPath}`;
        };

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
                    'Fecha', 'Proyecto', 'Dirección', 'Cliente', 'Detalles', 'Fotos', 'PDF', 'Comentarios', 'Acciones'
                ];
                emptyMsg = "No hay activaciones";
                break;
            case 'protocol':
                data = billingData.protocol;
                columns = ['Fecha', 'Proyecto', 'Dirección', 'NVT', 'Estado', 'Notas', 'Acciones'];
                emptyMsg = "No hay protocolos completados";
                break;
            case 'repair':
                data = billingData.repair;
                columns = ['Fecha', 'Proyecto', 'Dirección', 'NVT', 'Tipo', 'Detalles', 'Acciones'];
                emptyMsg = "No hay reparaciones facturables completadas";
                break;
            case 'simpleInstallation':
                data = billingData.simpleInstallation;
                columns = [
                    <div key="chk" className="flex items-center"><input type="checkbox" checked={data.length > 0 && selectedIds.length === data.length} onChange={() => toggleSelectAll(data)} className="w-4 h-4 rounded border-slate-300" /></div>,
                    'Fecha', 'Dirección', 'Conceptos / Items', 'Comentarios', 'Fotos', 'PDF', 'Técnico', 'Proyecto', 'Acciones'
                ];
                emptyMsg = "No hay fichas de G&K / Otros enviadas";
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
                                        <td className="p-4">{row.address?.street} {row.address?.number} <div className="text-[10px] text-blue-600 font-bold">ID: {row.homeIds?.[0] || '-'}</div></td>
                                        <td className="p-4">{row.address?.clientName || 'Sin Nombre'}</td>
                                        <td className="p-4">
                                            <div className="flex flex-col gap-1">
                                                <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] font-bold w-fit">{row.activationType}</span>
                                                <div className="text-[10px] text-slate-500 font-black flex items-center gap-2">
                                                    <span className={(row.taInstalled || row.taPrice > 0 || row.activationType === 'SDU') ? 'text-blue-600' : ''}>
                                                        TA:{(row.taCount > 0) ? row.taCount : ((row.taInstalled || row.taPrice > 0 || row.activationType === 'SDU') ? 1 : 0)}
                                                    </span>
                                                    <span className="text-slate-300">|</span>
                                                    <span className={row.spInstalled > 0 ? 'text-purple-600' : ''}>
                                                        SP:{row.spInstalled || 0}
                                                    </span>
                                                    {row.mduInstalled && (
                                                        <>
                                                            <span className="text-slate-300">|</span>
                                                            <span className="text-orange-600">MDU</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </td>

                                        {/* Photos Column - Clickable for Modal */}
                                        <td className="p-4">
                                            {row.photos && row.photos.length > 0 ? (
                                                <button
                                                    onClick={() => handleViewPhotos(row.photos)}
                                                    className="font-bold text-blue-600 hover:text-blue-800 underline decoration-dotted transition-colors"
                                                    title="Ver Galería de Fotos"
                                                >
                                                    {row.photos.length} Fotos
                                                </button>
                                            ) : (
                                                <span className="text-slate-400">0</span>
                                            )}
                                        </td>

                                        {/* PDF Status / Link with Dynamic URL */}
                                        <td className="p-4">
                                            {(() => {
                                                if (!row.pdfPath) return <span className="text-slate-300">-</span>;

                                                // Check for broken/legacy paths
                                                const pathStr = String(row.pdfPath);
                                                const isLegacy = pathStr.includes('/tmp/') || pathStr.match(/^[a-zA-Z]:/);

                                                if (isLegacy) {
                                                    return (
                                                        <span className="text-slate-400 text-xs flex items-center gap-1 cursor-not-allowed" title="Archivo antiguo no disponible">
                                                            <FileText size={14} /> Expired
                                                        </span>
                                                    );
                                                }

                                                return (
                                                    <a
                                                        href={getFileUrl(row.pdfPath)}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-red-500 hover:text-red-700 flex items-center gap-1 font-semibold"
                                                        title="Ver PDF"
                                                    >
                                                        <FileText size={18} /> PDF
                                                    </a>
                                                );
                                            })()}
                                        </td>
                                        <td className="p-4">
                                            <div className="text-xs text-slate-500 italic truncate max-w-[120px]" title={row.description}>
                                                {row.description || '-'}
                                            </div>
                                        </td>
                                    </>
                                )}

                                {activeTab === 'simpleInstallation' && (
                                    <>
                                        <td className="p-4">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.includes(row.id)}
                                                onChange={() => toggleSelect(row.id)}
                                                className="w-4 h-4 rounded border-slate-300"
                                            />
                                        </td>
                                        <td className="p-4">{new Date(row.createdAt).toLocaleDateString('es-ES')}</td>
                                        <td className="p-4 text-slate-900 font-bold">
                                            {row.address.street} {row.address.number || ''}
                                        </td>
                                        <td className="p-4">
                                            <div className="flex flex-wrap gap-1">
                                                {row.items?.map(item => (
                                                    <span key={item.id} className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold border border-blue-100">
                                                        {item.quantity}x {item.priceItem?.name}
                                                    </span>
                                                ))}
                                                {(!row.items || row.items.length === 0) && (
                                                    <span className="text-slate-400 text-xs italic">Legacy (€{row.priceCharged || 0})</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-4 text-slate-500 max-w-xs truncate">
                                            {row.comments || '-'}
                                        </td>
                                        <td className="p-4 text-slate-500">
                                            <div className="flex gap-1 overflow-x-auto max-w-[100px] no-scrollbar">
                                                {row.photos?.map((p, i) => (
                                                    <a key={i} href={getFileUrl(p)} target="_blank" rel="noreferrer" className="flex-shrink-0 w-8 h-8 rounded border border-slate-200 overflow-hidden hover:scale-110 transition-transform">
                                                        <img src={getFileUrl(p)} alt="Photo" className="w-full h-full object-cover" onError={(e) => { e.target.src = '/image-placeholder.png'; }} />
                                                    </a>
                                                ))}
                                                {(!row.photos || row.photos.length === 0) && <span className="text-slate-300 italic">No fotos</span>}
                                            </div>
                                        </td>
                                        {/* NEW PDF COLUMN */}
                                        <td className="p-4">
                                            {row.pdfPath ? (
                                                <a
                                                    href={getFileUrl(row.pdfPath)}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-red-500 hover:text-red-700 flex items-center gap-1 font-bold"
                                                    title="Ver Informe PDF"
                                                >
                                                    <FileText size={18} /> INFO
                                                </a>
                                            ) : (
                                                <span className="text-slate-300">-</span>
                                            )}
                                        </td>
                                        <td className="p-4 text-slate-500">
                                            {row.createdBy?.username || '-'}
                                        </td>
                                        <td className="p-4 text-slate-500">
                                            {row.address?.project?.name || '-'}
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
                                {activeTab === 'repair' && (
                                    <>
                                        <td className="p-4">{new Date(row.updatedAt).toLocaleDateString()}</td>
                                        <td className="p-4 font-medium text-slate-800">{row.address?.project?.name}</td>
                                        <td className="p-4">{row.address?.street} {row.address?.number}</td>
                                        <td className="p-4 font-bold text-red-600">{row.address?.nvt || '-'}</td>
                                        <td className="p-4"><span className="bg-orange-100 text-orange-700 px-2 py-1 rounded-full text-xs font-bold">Avería</span></td>
                                        <td className="p-4 text-slate-500 italic">"{row.comments?.[0]?.text || 'Sin detalle'}"</td>
                                    </>
                                )}

                                {/* ACTIONS COLUMN */}
                                <td className="p-4 w-28">
                                    <div className="flex items-center gap-2">
                                        {(activeTab === 'activation' || activeTab === 'simpleInstallation') && (
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

    // --- PHOTO MODAL ---
    const PhotoModal = () => {
        if (!isPhotoModalOpen) return null;

        // Use relative path logic matching the main component
        let BASE_URL = '';
        if (import.meta.env.DEV) {
            BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        }

        const getUrl = (path) => {
            if (!path) return '';
            let cleanPath = path.split('?')[0].replace(/\\/g, '/');
            if (cleanPath.startsWith('/')) cleanPath = cleanPath.slice(1);
            
            // Encode each segment of the path
            const encodedPath = cleanPath.split('/').map(segment => encodeURIComponent(segment)).join('/');
            return `${BASE_URL ? BASE_URL + '/' : '/'}${encodedPath}`;
        };

        return (
            <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setIsPhotoModalOpen(false)}>
                <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                    <div className="p-4 border-b border-slate-200 flex justify-between items-center">
                        <h3 className="font-bold text-lg">Galería de Fotos ({selectedPhotos.length})</h3>
                        <button onClick={() => setIsPhotoModalOpen(false)} className="text-slate-500 hover:text-black font-bold text-xl">×</button>
                    </div>
                    <div className="p-4 overflow-y-auto grid grid-cols-2 md:grid-cols-3 gap-4">
                        {selectedPhotos.map((photo, idx) => (
                            <div key={idx} className="relative aspect-video bg-slate-100 rounded-lg overflow-hidden border border-slate-200 group">
                                <div key={idx} className="relative aspect-video bg-slate-100 rounded-lg overflow-hidden border border-slate-200 group">
                                    {(() => {
                                        const isLegacy = photo.includes('/tmp/') || photo.match(/^[a-zA-Z]:/);
                                        if (isLegacy) {
                                            return (
                                                <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 p-2 text-center">
                                                    <span className="text-xs">Imagen no disponible (Formato antiguo)</span>
                                                </div>
                                            );
                                        }
                                        return (
                                            <img
                                                src={getUrl(photo)}
                                                alt={`Evidencia ${idx}`}
                                                className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform"
                                                onClick={() => {
                                                    const url = getUrl(photo);
                                                    const a = document.createElement('a');
                                                    a.href = url;
                                                    a.target = '_blank';
                                                    // For images, we try to open, but if it's PWA it might still be tricky. 
                                                    // Download is the safest fallback if window.open is blocked/blank.
                                                    document.body.appendChild(a);
                                                    a.click();
                                                    document.body.removeChild(a);
                                                }}
                                            />
                                        );
                                    })()}
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="p-4 border-t border-slate-200 text-right">
                        <button onClick={() => setIsPhotoModalOpen(false)} className="px-4 py-2 bg-slate-200 hover:bg-slate-300 rounded-lg font-medium text-slate-700">Cerrar</button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <FileText className="text-blue-600" /> Facturación (v2.1)
                    </h2>
                    <p className="text-slate-500 text-sm">Gestiona y exporta los trabajos realizados para facturar.</p>
                </div>
                <div className="flex gap-2">
                    {(activeTab === 'activation' || activeTab === 'simpleInstallation') && selectedIds.length > 0 && (
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

            {/* Gross Revenue Dashboard (Top) */}
            {billingData.totals && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Grand Total Card */}
                    <div className="bg-gradient-to-br from-indigo-600 to-joa-blue p-6 rounded-3xl shadow-xl shadow-joa-blue/20 text-white relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                            <TrendingUp size={80} />
                        </div>
                        <p className="text-indigo-100 text-xs font-bold uppercase tracking-widest mb-1">Facturación Total (Bruta)</p>
                        <h3 className="text-4xl font-black mb-2">
                            {new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(billingData.totals.euros || 0)}
                        </h3>
                        <div className="flex items-center gap-2 text-xs text-indigo-100/80">
                            <span className="bg-white/20 px-2 py-0.5 rounded-full font-bold">Consolidado</span>
                            <span>{billingData.soplado.length + billingData.activation.length + billingData.simpleInstallation.length} trabajos realizados</span>
                        </div>
                    </div>

                    {/* Weekday Card */}
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col justify-center">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="bg-blue-100 p-2 rounded-xl text-blue-600">
                                <Calendar size={20} />
                            </div>
                            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Lunes a Viernes</p>
                        </div>
                        <h3 className="text-3xl font-black text-slate-800">
                            {new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(billingData.totals.weekdayGross || 0)}
                        </h3>
                        <p className="text-[10px] text-slate-400 mt-1 font-medium italic">Ingresos brutos generados en jornada ordinaria</p>
                    </div>

                    {/* Saturday Card */}
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col justify-center">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="bg-orange-100 p-2 rounded-xl text-orange-600">
                                <Sun size={20} />
                            </div>
                            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Sábados (Extra)</p>
                        </div>
                        <h3 className="text-3xl font-black text-slate-800">
                            {new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(billingData.totals.saturdayGross || 0)}
                        </h3>
                        <p className="text-[10px] text-slate-400 mt-1 font-medium italic">Facturación adicional por trabajos de sábado</p>
                    </div>
                </div>
            )}

            {/* Existing Filters section starts here... (Line 585 in original) */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Proyecto</label>
                    <div className="relative">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <select
                            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 text-sm"
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
                    <label className="text-xs font-bold text-slate-500 uppercase">Empresa Cliente</label>
                    <div className="relative">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <select
                            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 text-sm font-bold"
                            value={filters.clientCompanyId}
                            onChange={(e) => setFilters({ ...filters, clientCompanyId: e.target.value })}
                        >
                            <option value="">Todos los Clientes</option>
                            {clients.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
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

                {/* Activation Type Filter - Only visible if 'activation' tab is active */}
                {activeTab === 'activation' && (
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Tipo Activación</label>
                        <div className="relative">
                            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <select
                                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                                value={filters.type}
                                onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                            >
                                <option value="">Todos los tipos</option>
                                <option value="BP">BP</option>
                                <option value="BP_2_FAM">BP 2 FAM</option>
                                <option value="BR_MULTI">BR MULTI</option>
                                <option value="SDU">SDU</option>
                                <option value="MDU">MDU</option>
                            </select>
                        </div>
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="flex border-b border-slate-200 overflow-x-auto">
                    {[
                        { id: 'soplado', label: 'Soplado', color: 'blue' },
                        { id: 'fusion', label: 'Fusión', color: 'purple' },
                        { id: 'activation', label: 'Activaciones', color: 'green' },
                        { id: 'protocol', label: 'Protocolos', color: 'indigo' },
                        { id: 'repair', label: 'Reparaciones', color: 'orange' },
                        { id: 'simpleInstallation', label: 'G&K / Otros', color: 'cyan' }
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

            {/* Summary details moved to top or hidden if preferred... keeping simplified count footer if items exist */}
            {billingData.totals && billingData.totals.itemsSummary && Object.keys(billingData.totals.itemsSummary).length > 0 && (
                <div className="bg-slate-900 p-6 rounded-2xl shadow-lg mt-6 text-white">
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-4">Desglose de Unidades Facturadas</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                        {Object.entries(billingData.totals.itemsSummary).map(([name, count]) => (
                            <div key={name} className="bg-white/5 p-3 rounded-xl border border-white/10 text-center">
                                <p className="text-[9px] uppercase font-bold text-slate-400 mb-1 truncate px-1" title={name}>{name}</p>
                                <p className="text-xl font-black">{count}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <PhotoModal />
        </div>
    );
};

export default BillingPage;
