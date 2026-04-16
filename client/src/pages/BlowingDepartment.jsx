import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { Search, CheckCircle, XCircle, Camera, Upload, ArrowLeft } from 'lucide-react';

const BlowingDepartment = () => {
    const [projects, setProjects] = useState([]);
    const [selectedProject, setSelectedProject] = useState(null);
    const [addresses, setAddresses] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [selectedAddress, setSelectedAddress] = useState(null);

    // Form State
    const [status, setStatus] = useState('OK'); // OK or FALLIDO
    const [formData, setFormData] = useState({
        meters: '',
        tk: '',
        tubeColor: '',
        failureReason: '',
        photos: []
    });
    const [submitting, setSubmitting] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);

    useEffect(() => {
        fetchProjects();
    }, []);

    useEffect(() => {
        if (selectedProject) {
            fetchAddresses();
        }
    }, [selectedProject, searchTerm]);

    const fetchProjects = async () => {
        try {
            const res = await api.get('/api/projects');
            setProjects(res.data);
        } catch (error) {
            console.error('Error fetching projects:', error);
        }
    };

    const fetchAddresses = async () => {
        try {
            const res = await api.get(`/api/soplado/addresses/${selectedProject.id}?search=${searchTerm}`);
            const sorted = res.data.sort((a, b) => {
                const strA = `${a.street || ''} ${a.number || ''}`.trim();
                const strB = `${b.street || ''} ${b.number || ''}`.trim();
                return strA.localeCompare(strB, undefined, { numeric: true, sensitivity: 'base' });
            });
            setAddresses(sorted);
        } catch (error) {
            console.error('Error fetching addresses:', error);
        }
    };

    const handleFileChange = (e) => {
        setFormData({ ...formData, photos: Array.from(e.target.files) });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);

        const data = new FormData();
        data.append('status', status);
        data.append('meters', formData.meters);
        data.append('tk', formData.tk);
        data.append('tubeColor', formData.tubeColor);

        if (status === 'FALLIDO') {
            data.append('failureReason', formData.failureReason);
        }

        formData.photos.forEach(file => {
            data.append('photos', file);
        });

        try {
            await api.post(`/api/soplado/report/${selectedAddress.id}`, data, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            alert('Reporte enviado correctamente');
            setSelectedAddress(null);
            setFormData({ meters: '', tk: '', tubeColor: '', failureReason: '', photos: [] });
            fetchAddresses(); // Refresh list
        } catch (error) {
            console.error('Error submitting report:', error);
            alert('Error al enviar reporte');
        } finally {
            setSubmitting(false);
        }
    };

    useEffect(() => {
        if (selectedProject) {
            setSelectedIds([]); // Reset selection on project change
        }
    }, [selectedProject, searchTerm]);

    const handleSelectionToggle = (id, e) => {
        e.stopPropagation();
        setSelectedIds(prev => {
            if (prev.includes(id)) return prev.filter(i => i !== id);
            return [...prev, id];
        });
    };

    const filteredAddresses = addresses.filter(addr => {
        if (statusFilter === 'ALL') return true;
        const currentStatus = addr.sopladoStatus || 'PENDIENTE';
        return currentStatus === statusFilter;
    });

    const handleSelectAll = () => {
        if (selectedIds.length === filteredAddresses.length && filteredAddresses.length > 0) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filteredAddresses.map(a => a.id));
        }
    };

    const handleBulkAction = async (targetStatus) => {
        if (selectedIds.length === 0) return;

        const confirmMsg = targetStatus === 'OK'
            ? `¿Marcar ${selectedIds.length} direcciones como OK?`
            : `¿Marcar ${selectedIds.length} direcciones como PENDIENTE?`;

        if (window.confirm(confirmMsg)) {
            try {
                await api.post('/api/soplado/bulk-update', {
                    addressIds: selectedIds,
                    status: targetStatus
                });

                // Optimistic Update
                setAddresses(prev => prev.map(a =>
                    selectedIds.includes(a.id) ? { ...a, sopladoStatus: targetStatus } : a
                ));
                setSelectedIds([]); // Clear selection

            } catch (error) {
                console.error('Error in bulk action:', error);
                alert('Error al actualizar estado');
            }
        }
    };

    // View: Project Selection
    if (!selectedProject) {
        return (
            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-slate-800">Selecciona un Proyecto</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {projects.map(project => (
                        <div
                            key={project.id}
                            onClick={() => setSelectedProject(project)}
                            className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 cursor-pointer hover:shadow-md hover:border-blue-400 transition-all"
                        >
                            <h3 className="font-bold text-lg text-slate-800">{project.name}</h3>
                            <p className="text-sm text-slate-500 mt-2">{project._count?.addresses || 0} direcciones</p>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // View: Address Selection
    if (!selectedAddress) {
        return (
            <div className="space-y-6 pb-24">
                <div className="flex items-center gap-4">
                    <button onClick={() => setSelectedProject(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                        <ArrowLeft size={24} className="text-slate-600" />
                    </button>
                    <h2 className="text-2xl font-bold text-slate-800">{selectedProject.name}</h2>
                </div>

                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input
                        type="text"
                        placeholder="Buscar por NVT o Calle..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    {/* Header with Select All */}
                    <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-4 bg-slate-50">
                        <div className="flex items-center gap-4">
                            <div
                                onClick={handleSelectAll}
                                className={`w-6 h-6 rounded border-2 flex items-center justify-center cursor-pointer transition-all ${selectedIds.length > 0 && selectedIds.length === filteredAddresses.length
                                    ? 'bg-blue-600 border-blue-600 text-white'
                                    : 'bg-white border-slate-300'
                                    }`}
                            >
                                {selectedIds.length > 0 && selectedIds.length === filteredAddresses.length && <CheckCircle size={14} />}
                            </div>
                            <span className="text-sm font-bold text-slate-600">
                                {selectedIds.length > 0 ? `${selectedIds.length} Seleccionados` : 'Seleccionar Todos'}
                            </span>
                        </div>
                        <select 
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="border border-slate-300 rounded-lg px-2 py-1 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="ALL">Mostrar Todas</option>
                            <option value="OK">Solo OK</option>
                            <option value="PENDIENTE">Solo Pendientes</option>
                            <option value="FALLIDO">Solo Fallidos</option>
                        </select>
                    </div>

                    {filteredAddresses.length === 0 ? (
                        <div className="p-8 text-center text-slate-500">No se encontraron direcciones</div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {filteredAddresses.map(address => {
                                const isSelected = selectedIds.includes(address.id);
                                return (
                                    <div
                                        key={address.id}
                                        onClick={() => setSelectedAddress(address)}
                                        className={`p-4 hover:bg-slate-50 cursor-pointer transition-colors flex justify-between items-center ${isSelected ? 'bg-blue-50/50' : ''}`}
                                    >
                                        <div className="flex items-center gap-4">
                                            {/* Selection Checkbox */}
                                            <div
                                                onClick={(e) => handleSelectionToggle(address.id, e)}
                                                className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-all ${isSelected
                                                    ? 'bg-blue-600 border-blue-600 text-white'
                                                    : 'bg-white border-slate-300 hover:border-blue-400'
                                                    }`}
                                            >
                                                {isSelected && <CheckCircle size={14} />}
                                            </div>

                                            <div>
                                                <div className="font-medium text-slate-800">{address.street} {address.number}</div>
                                                <div className="text-sm text-slate-500">NVT: {address.nvt || 'N/A'}</div>
                                            </div>
                                        </div>

                                        <div className="flex flex-col items-end gap-1">
                                            {address.sopladoStatus === 'OK' && <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold">OK</span>}
                                            {address.sopladoStatus === 'FALLIDO' && <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold">FALLIDO</span>}
                                            {(!address.sopladoStatus || address.sopladoStatus === 'PENDIENTE') && <span className="px-3 py-1 bg-slate-100 text-slate-500 rounded-full text-xs">PENDIENTE</span>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Floating Bulk Action Bar */}
                {selectedIds.length > 0 && (
                    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white px-6 py-4 rounded-2xl shadow-2xl border border-slate-200 flex items-center gap-4 z-50 animate-in slide-in-from-bottom-4 fade-in">
                        <span className="font-bold text-slate-700 mr-2">{selectedIds.length} seleccionados</span>

                        <button
                            onClick={() => handleBulkAction('OK')}
                            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-bold shadow-sm transition-colors flex items-center gap-2"
                        >
                            <CheckCircle size={18} /> Marcar OK
                        </button>

                        <button
                            onClick={() => handleBulkAction('PENDIENTE')}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2 rounded-lg font-medium transition-colors"
                        >
                            Marcar Pendiente
                        </button>
                    </div>
                )}
            </div>
        );
    }

    // View: Report Form
    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-center gap-4 mb-6">
                <button onClick={() => setSelectedAddress(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                    <ArrowLeft size={24} className="text-slate-600" />
                </button>
                <div>
                    <h2 className="text-xl font-bold text-slate-800">{selectedAddress.street} {selectedAddress.number}</h2>
                    <p className="text-sm text-slate-500">NVT: {selectedAddress.nvt}</p>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <div className="flex gap-4 mb-8">
                    <button
                        onClick={() => setStatus('OK')}
                        className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 font-bold transition-all ${status === 'OK' ? 'bg-green-500 text-white shadow-lg shadow-green-500/30' : 'bg-slate-100 text-slate-400'
                            }`}
                    >
                        <CheckCircle size={20} /> SOPLADO OK
                    </button>
                    <button
                        onClick={() => setStatus('FALLIDO')}
                        className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 font-bold transition-all ${status === 'FALLIDO' ? 'bg-red-500 text-white shadow-lg shadow-red-500/30' : 'bg-slate-100 text-slate-400'
                            }`}
                    >
                        <XCircle size={20} /> FALLIDO
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Metros Soplados</label>
                        <input
                            type="number"
                            step="0.1"
                            value={formData.meters}
                            onChange={(e) => setFormData({ ...formData, meters: e.target.value })}
                            className="w-full border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-green-500 outline-none"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">TK (Identificador)</label>
                        <input
                            type="text"
                            value={formData.tk}
                            onChange={(e) => setFormData({ ...formData, tk: e.target.value })}
                            className="w-full border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-green-500 outline-none"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Color del Tubo</label>
                        <select
                            value={formData.tubeColor}
                            onChange={(e) => setFormData({ ...formData, tubeColor: e.target.value })}
                            className="w-full border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-green-500 outline-none bg-white"
                            required
                        >
                            <option value="">Selecciona un color</option>
                            {[
                                'Rojo', 'Verde', 'Azul', 'Amarillo', 'Blanco', 'Gris', 'Marrón', 'Morado', 'Turquesa', 'Negro', 'Naranja', 'Rosa',
                                'Rojo-Rayado', 'Verde-Rayado', 'Azul-Rayado', 'Amarillo-Rayado', 'Blanco-Rayado', 'Gris-Rayado', 'Marrón-Rayado', 'Morado-Rayado', 'Turquesa-Rayado', 'Negro-Rayado'
                            ].map(color => (
                                <option key={color} value={color}>{color}</option>
                            ))}
                        </select>
                    </div>

                    {status === 'FALLIDO' && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Motivo del Fallo</label>
                            <textarea
                                value={formData.failureReason}
                                onChange={(e) => setFormData({ ...formData, failureReason: e.target.value })}
                                className="w-full border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-red-500 outline-none h-32 resize-none"
                                required
                            />
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Fotos / Evidencias</label>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            {/* Camera Button */}
                            <div className="border-2 border-dashed border-blue-400 bg-blue-50/50 rounded-xl flex flex-col items-center justify-center p-4 hover:bg-blue-100 transition-colors cursor-pointer relative aspect-square">
                                <input
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    onChange={(e) => {
                                        const newFiles = Array.from(e.target.files);
                                        setFormData(prev => ({ ...prev, photos: [...prev.photos, ...newFiles] }));
                                    }}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                                <Camera className="text-blue-600 mb-2" size={28} />
                                <div className="text-[10px] text-blue-700 font-extrabold uppercase text-center leading-tight">
                                    Hacer
                                    <br />
                                    Foto
                                </div>
                            </div>

                            {/* Gallery Button (Multiple) */}
                            <div className="border-2 border-dashed border-slate-300 bg-white rounded-xl flex flex-col items-center justify-center p-4 hover:bg-slate-50 transition-colors cursor-pointer relative aspect-square">
                                <input
                                    type="file"
                                    multiple
                                    accept="image/*"
                                    onChange={(e) => {
                                        const newFiles = Array.from(e.target.files);
                                        setFormData(prev => ({ ...prev, photos: [...prev.photos, ...newFiles] }));
                                    }}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                                <Upload className="text-slate-500 mb-2" size={28} />
                                <div className="text-[10px] text-slate-600 font-extrabold uppercase text-center leading-tight">
                                    Galería
                                    <br />
                                    Varios
                                </div>
                            </div>

                            {/* Preview Counter */}
                            {formData.photos.length > 0 && (
                                <div className="col-span-2 p-2 bg-slate-50 rounded-lg border border-slate-200 text-[10px] font-bold text-slate-500 flex justify-between items-center">
                                    <span>{formData.photos.length} fotos seleccionadas</span>
                                    <button type="button" onClick={() => setFormData({ ...formData, photos: [] })} className="text-red-500 font-extrabold uppercase">Limpiar</button>
                                </div>
                            )}
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={submitting}
                        className={`w-full py-4 rounded-xl font-bold text-white transition-all ${status === 'OK' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                            } disabled:opacity-50`}
                    >
                        {submitting ? 'Enviando...' : 'Enviar Reporte'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default BlowingDepartment;
