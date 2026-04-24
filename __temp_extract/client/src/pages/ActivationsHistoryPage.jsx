import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { Calendar, Filter, Download, Eye, X, Image as ImageIcon, AlertTriangle } from 'lucide-react';

const BASE_URL = import.meta.env.PROD ? '' : 'http://localhost:3000';

const ActivationsHistoryPage = () => {
    const [activations, setActivations] = useState([]);
    const [teams, setTeams] = useState([]);
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [filters, setFilters] = useState({
        startDate: '',
        endDate: '',
        teamId: '',
        projectId: ''
    });

    // Modal
    const [selectedActivation, setSelectedActivation] = useState(null);

    useEffect(() => {
        fetchData();
        fetchOptions();
    }, []);

    useEffect(() => {
        fetchData();
    }, [filters]);

    const fetchOptions = async () => {
        try {
            const [teamsRes, projectsRes] = await Promise.all([
                api.get('/api/teams'),
                api.get('/api/projects')
            ]);
            setTeams(teamsRes.data);
            setProjects(projectsRes.data);
        } catch (error) {
            console.error('Error fetching options:', error);
        }
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filters.startDate) params.append('startDate', filters.startDate);
            if (filters.endDate) params.append('endDate', filters.endDate);
            if (filters.teamId) params.append('teamId', filters.teamId);
            if (filters.projectId) params.append('projectId', filters.projectId);

            const res = await api.get(`/api/activations/all?${params.toString()}`);
            setActivations(res.data);
        } catch (error) {
            console.error('Error fetching activations:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleFilterChange = (e) => {
        setFilters({ ...filters, [e.target.name]: e.target.value });
    };

    const exportToCSV = () => {
        if (activations.length === 0) return;

        const headers = ['Fecha', 'Dirección', 'Proyecto', 'Equipo', 'Técnico', 'Tipo', 'Detalles', 'Home IDs', 'Comentarios', 'Puntos'];
        const rows = activations.map(act => [
            new Date(act.createdAt).toLocaleDateString(),
            `${act.address.street} ${act.address.number}`,
            act.address.project.name,
            act.address.appointment?.assignedTeam?.name || 'N/A',
            act.address.appointment?.assignedTeam?.members?.map(m => m.username).join(', ') || 'N/A',
            act.activationType,
            `AP:${act.apPorts} TA:${act.taInstalled ? act.taCount : 0} SP:${act.spInstalled}`,
            act.homeIds.join(', '),
            act.description || '',
            act.points
        ]);

        const csvContent = "data:text/csv;charset=utf-8,"
            + headers.join(",") + "\n"
            + rows.map(e => e.join(",")).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "activaciones_export.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [exportFiltersForm, setExportFiltersForm] = useState({
        startDate: '',
        endDate: '',
        projectId: ''
    });

    const openExportModal = () => {
        // Pre-fill with current filters if available
        setExportFiltersForm({
            startDate: filters.startDate,
            endDate: filters.endDate,
            projectId: filters.projectId
        });
        setIsExportModalOpen(true);
    };

    const handleExportPhotos = () => {
        const params = new URLSearchParams();
        if (exportFiltersForm.startDate) params.append('startDate', exportFiltersForm.startDate);
        if (exportFiltersForm.endDate) params.append('endDate', exportFiltersForm.endDate);
        if (exportFiltersForm.projectId) params.append('projectId', exportFiltersForm.projectId);

        // Trigger download via anchor click instead of window.open (fixes PWA blank screen)
        const url = `${BASE_URL}/api/activations/export-photos?${params.toString()}`;
        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setIsExportModalOpen(false);
    };

    const [isRepairModalOpen, setIsRepairModalOpen] = useState(false);
    const [repairForm, setRepairForm] = useState({
        type: 'WARRANTY', // WARRANTY, BILLABLE
        date: new Date().toISOString().split('T')[0],
        teamId: '',
        reason: ''
    });

    const openRepairModal = (act) => {
        setSelectedActivation(act);
        setRepairForm({
            type: 'WARRANTY',
            date: new Date().toISOString().split('T')[0],
            teamId: act.address.appointment?.assignedTeamId || '',
            reason: ''
        });
        setIsRepairModalOpen(true);
    };

    const handleRepairSubmit = async () => {
        if (!repairForm.teamId || !repairForm.date) {
            alert('Por favor selecciona equipo y fecha');
            return;
        }

        try {
            await api.post(`/api/appointments/repair/${selectedActivation.addressId}`, repairForm);
            alert('Cita de reparación creada correctamente');
            setIsRepairModalOpen(false);
            fetchData(); // Refresh list (might not show changed status if we only list 'activations', but it changes the backend state)
        } catch (error) {
            console.error(error);
            alert('Error al crear reparación');
        }
    };

    const RepairModal = () => {
        if (!isRepairModalOpen || !selectedActivation) return null;

        const originalTeamName = selectedActivation.address.appointment?.assignedTeam?.name || 'Desconocido';
        const originalDate = new Date(selectedActivation.createdAt).toLocaleDateString();

        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
                <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl relative">
                    <button onClick={() => setIsRepairModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
                        <X size={24} />
                    </button>

                    <h3 className="text-xl font-bold text-red-600 mb-1 flex items-center gap-2">
                        <AlertTriangle /> Reportar Incidencia / Reparación
                    </h3>
                    <p className="text-sm text-slate-500 mb-6 border-b border-slate-100 pb-4">
                        {selectedActivation.address.street} {selectedActivation.address.number}
                    </p>

                    <div className="bg-yellow-50 p-4 rounded-lg mb-6 border border-yellow-200 text-sm text-yellow-800">
                        <p><strong>Instalación Original:</strong></p>
                        <ul className="list-disc pl-5 mt-1">
                            <li>Realizada por: <strong>{originalTeamName}</strong></li>
                            <li>Fecha: {originalDate}</li>
                        </ul>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Tipo de Incidencia</label>
                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    onClick={() => setRepairForm({ ...repairForm, type: 'WARRANTY' })}
                                    className={`p-3 rounded-xl border text-center transition-all ${repairForm.type === 'WARRANTY' ? 'border-red-500 bg-red-50 text-red-700 ring-2 ring-red-200' : 'border-slate-200 hover:border-slate-300'}`}
                                >
                                    <div className="font-bold">Reclamación</div>
                                    <div className="text-xs opacity-75">(Garantía / Sin Cobro)</div>
                                </button>
                                <button
                                    onClick={() => setRepairForm({ ...repairForm, type: 'BILLABLE' })}
                                    className={`p-3 rounded-xl border text-center transition-all ${repairForm.type === 'BILLABLE' ? 'border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-200' : 'border-slate-200 hover:border-slate-300'}`}
                                >
                                    <div className="font-bold">Avería Externa</div>
                                    <div className="text-xs opacity-75">(Facturable)</div>
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Asignar a Equipo</label>
                            <select
                                value={repairForm.teamId}
                                onChange={(e) => setRepairForm({ ...repairForm, teamId: e.target.value })}
                                className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                            >
                                <option value="">Selecciona un equipo</option>
                                {teams.map(t => (
                                    <option key={t.id} value={t.id}>
                                        {t.name} {t.id === selectedActivation.address.appointment?.assignedTeamId ? '(Original)' : ''}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Fecha de Reparación</label>
                            <input
                                type="date"
                                value={repairForm.date}
                                onChange={(e) => setRepairForm({ ...repairForm, date: e.target.value })}
                                className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Motivo / Descripción</label>
                            <textarea
                                value={repairForm.reason}
                                onChange={(e) => setRepairForm({ ...repairForm, reason: e.target.value })}
                                className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="Describe el problema reportado..."
                                rows="2"
                            />
                        </div>

                        <div className="pt-4 flex justify-end gap-3">
                            <button
                                onClick={() => setIsRepairModalOpen(false)}
                                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleRepairSubmit}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-bold shadow-lg shadow-red-500/30 flex items-center gap-2"
                            >
                                <AlertTriangle size={18} />
                                Generar Cita de Reparación
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-slate-800">Historial de Activaciones</h2>
                <div className="flex gap-2">
                    <button
                        onClick={openExportModal}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                    >
                        <ImageIcon size={18} /> Exportar Fotos
                    </button>
                    <button
                        onClick={exportToCSV}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                    >
                        <Download size={18} /> Exportar CSV
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Desde</label>
                    <input
                        type="date"
                        name="startDate"
                        value={filters.startDate}
                        onChange={handleFilterChange}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Hasta</label>
                    <input
                        type="date"
                        name="endDate"
                        value={filters.endDate}
                        onChange={handleFilterChange}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Equipo</label>
                    <select
                        name="teamId"
                        value={filters.teamId}
                        onChange={handleFilterChange}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                        <option value="">Todos</option>
                        {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Proyecto</label>
                    <select
                        name="projectId"
                        value={filters.projectId}
                        onChange={handleFilterChange}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                        <option value="">Todos</option>
                        {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600">
                        <thead className="bg-slate-50 text-slate-800 font-bold border-b border-slate-200">
                            <tr>
                                <th className="p-4">Fecha</th>
                                <th className="p-4">Dirección</th>
                                <th className="p-4">Equipo</th>
                                <th className="p-4">Detalles</th>
                                <th className="p-4">Comentarios</th>
                                <th className="p-4">Puntos</th>
                                <th className="p-4 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr><td colSpan="7" className="p-8 text-center">Cargando...</td></tr>
                            ) : activations.length === 0 ? (
                                <tr><td colSpan="7" className="p-8 text-center text-slate-400">No se encontraron activaciones.</td></tr>
                            ) : (
                                activations.map(act => (
                                    <tr key={act.id} className="hover:bg-slate-50">
                                        <td className="p-4 whitespace-nowrap">
                                            {new Date(act.createdAt).toLocaleDateString()}
                                            <div className="text-xs text-slate-400">{new Date(act.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                        </td>
                                        <td className="p-4">
                                            <div className="font-bold text-slate-800">{act.address.street} {act.address.number}</div>
                                            <div className="text-xs">{act.address.project.name}</div>
                                        </td>
                                        <td className="p-4">
                                            <div className="font-medium text-slate-800">{act.address.appointment?.assignedTeam?.name || 'N/A'}</div>
                                            <div className="text-xs text-slate-400 truncate max-w-[150px]">
                                                {act.address.appointment?.assignedTeam?.members?.map(m => m.username.split('@')[0]).join(', ')}
                                            </div>
                                        </td>
                                        <td className="p-4 text-xs space-y-1">
                                            <div><span className="font-bold">AP:</span> {act.apPorts} | <span className="font-bold">SP:</span> {act.spInstalled}</div>
                                            <div><span className="font-bold">TA:</span> {act.taInstalled ? `Sí (${act.taCount})` : 'No'} {act.mduInstalled ? ' + MDU' : ''}</div>
                                            <div className="text-[10px] text-blue-600 font-bold truncate max-w-[120px]">ID: {act.homeIds.join(', ')}</div>
                                        </td>
                                        <td className="p-4">
                                            <div className="text-xs text-slate-500 italic max-w-[150px] truncate" title={act.description}>
                                                {act.description || '-'}
                                            </div>
                                        </td>
                                        <td className="p-4 font-bold text-joa-blue">{act.points}</td>
                                        <td className="p-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={() => openRepairModal(act)}
                                                    className="p-2 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600 transition-colors"
                                                    title="Reportar Incidencia / Reparación"
                                                >
                                                    <AlertTriangle size={18} />
                                                </button>
                                                <button
                                                    onClick={() => setSelectedActivation(act)}
                                                    className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-blue-600 transition-colors"
                                                    title="Ver Detalles y Fotos"
                                                >
                                                    <Eye size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Details Modal */}
            {selectedActivation && !isRepairModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl relative">
                        <button onClick={() => setSelectedActivation(null)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
                            <X size={24} />
                        </button>

                        <h3 className="text-xl font-bold text-slate-800 mb-1">Detalles de Activación</h3>
                        <p className="text-slate-500 text-sm mb-6">
                            {selectedActivation.address.street} {selectedActivation.address.number} - {new Date(selectedActivation.createdAt).toLocaleString()}
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                <h4 className="font-bold text-slate-700 mb-2">Información Técnica</h4>
                                <ul className="space-y-2 text-sm text-slate-600">
                                    <li><span className="font-medium">Tipo:</span> {selectedActivation.activationType}</li>
                                    <li><span className="font-medium">Puertos AP:</span> {selectedActivation.apPorts}</li>
                                    <li><span className="font-medium">TA Instalada:</span> {selectedActivation.taInstalled ? `Sí (${selectedActivation.taCount})` : 'No'}</li>
                                    <li><span className="font-medium">SP Instalados:</span> {selectedActivation.spInstalled}</li>
                                    <li><span className="font-medium">Home IDs:</span> {selectedActivation.homeIds.join(', ')}</li>
                                </ul>
                            </div>
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                <h4 className="font-bold text-slate-700 mb-2">Descripción</h4>
                                <p className="text-sm text-slate-600 whitespace-pre-wrap">
                                    {selectedActivation.description || 'Sin descripción.'}
                                </p>
                            </div>
                        </div>

                        <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <ImageIcon size={20} /> Fotos Adjuntas
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {selectedActivation.photos && selectedActivation.photos.length > 0 ? (
                                selectedActivation.photos.map((photo, i) => (
                                    <div key={i} className="aspect-square rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
                                        <img
                                            src={`${BASE_URL}/${photo.split('/').map(segment => encodeURIComponent(segment)).join('/')}`}
                                            alt={`Foto ${i + 1}`}
                                            className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform"
                                            onClick={() => {
                                                const encoded = photo.split('/').map(segment => encodeURIComponent(segment)).join('/');
                                                const url = `${BASE_URL || window.location.origin}/${encoded}`;
                                                const a = document.createElement('a');
                                                a.href = url;
                                                a.target = '_blank';
                                                document.body.appendChild(a);
                                                a.click();
                                                document.body.removeChild(a);
                                            }}
                                        />
                                    </div>
                                ))
                            ) : (
                                <p className="text-slate-400 text-sm col-span-full">No hay fotos adjuntas.</p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <RepairModal />

            {/* Export Photos Modal */}
            {isExportModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
                        <button onClick={() => setIsExportModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
                            <X size={24} />
                        </button>
                        <h3 className="text-xl font-bold text-slate-800 mb-4">Exportar Fotos de Activaciones</h3>
                        <p className="text-sm text-slate-500 mb-6">
                            Selecciona los filtros para generar un archivo ZIP con las fotos organizadas por carpetas (Dirección - Cliente).
                        </p>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Proyecto</label>
                                <select
                                    value={exportFiltersForm.projectId}
                                    onChange={(e) => setExportFiltersForm({ ...exportFiltersForm, projectId: e.target.value })}
                                    className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    <option value="">Todos los Proyectos</option>
                                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Desde</label>
                                    <input
                                        type="date"
                                        value={exportFiltersForm.startDate}
                                        onChange={(e) => setExportFiltersForm({ ...exportFiltersForm, startDate: e.target.value })}
                                        className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Hasta</label>
                                    <input
                                        type="date"
                                        value={exportFiltersForm.endDate}
                                        onChange={(e) => setExportFiltersForm({ ...exportFiltersForm, endDate: e.target.value })}
                                        className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                            </div>
                            <div className="pt-4 flex justify-end gap-3">
                                <button
                                    onClick={() => setIsExportModalOpen(false)}
                                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleExportPhotos}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                                >
                                    Descargar ZIP
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ActivationsHistoryPage;
