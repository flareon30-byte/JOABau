import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { Search, CheckCircle, XCircle, Camera, Upload, ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const BlowingDepartment = () => {
    const { t } = useTranslation();
    const [projects, setProjects] = useState([]);
    const [selectedProject, setSelectedProject] = useState(null);
    const [addresses, setAddresses] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [selectedAddress, setSelectedAddress] = useState(null);
    const [isNvtModalOpen, setIsNvtModalOpen] = useState(false);

    const ManageNvtModal = () => {
        const [nvts, setNvts] = useState([]);
        const [loading, setLoading] = useState(true);
        const [editingNvt, setEditingNvt] = useState(null);
        const [editForm, setEditForm] = useState({ street: '', number: '', city: '' });
        const [saving, setSaving] = useState(false);

        useEffect(() => {
            if (isNvtModalOpen && selectedProject) {
                fetchNvts();
            }
        }, [isNvtModalOpen]);

        const fetchNvts = async () => {
            setLoading(true);
            try {
                const res = await api.get(`/api/soplado/nvt-locations/${selectedProject.id}`);
                setNvts(res.data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        const handleEditClick = (nvt) => {
            setEditingNvt(nvt.nvtName);
            setEditForm({
                street: nvt.street || '',
                number: nvt.number || '',
                city: nvt.city || ''
            });
        };

        const handleSave = async (e, nvtName) => {
            e.preventDefault();
            setSaving(true);
            try {
                await api.post(`/api/soplado/nvt-locations/${selectedProject.id}`, {
                    nvtName,
                    ...editForm
                });
                setEditingNvt(null);
                fetchNvts();
            } catch (err) {
                console.error(err);
                alert('Error al guardar la dirección del NVT');
            } finally {
                setSaving(false);
            }
        };

        if (!isNvtModalOpen) return null;

        return (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4" onClick={() => setIsNvtModalOpen(false)}>
                <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden relative" onClick={e => e.stopPropagation()}>
                    {/* Header */}
                    <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                        <div>
                            <h3 className="font-extrabold text-slate-800 text-lg">Direcciones NVT</h3>
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">{selectedProject.name}</p>
                        </div>
                        <button onClick={() => setIsNvtModalOpen(false)} className="bg-slate-200 hover:bg-slate-300 text-slate-600 p-2 rounded-full transition-colors">
                            <ArrowLeft size={20} className="rotate-180" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                        {loading ? (
                            <div className="p-8 text-center text-slate-500">Cargando cajas NVT...</div>
                        ) : nvts.length === 0 ? (
                            <div className="p-8 text-center text-slate-500">No se encontraron NVT en este proyecto.</div>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {nvts.map(nvt => (
                                    <div key={nvt.nvtName} className="py-4 first:pt-0 last:pb-0 flex flex-col gap-3">
                                        <div className="flex justify-between items-start gap-4">
                                            <div>
                                                <span className="bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-lg text-xs font-bold font-mono">
                                                    {nvt.nvtName}
                                                </span>
                                                {!editingNvt || editingNvt !== nvt.nvtName ? (
                                                    <p className="text-sm text-slate-600 mt-2">
                                                        {nvt.street ? (
                                                            `${nvt.street} ${nvt.number || ''} ${nvt.city ? `, ${nvt.city}` : ''}`
                                                        ) : (
                                                            <span className="italic text-slate-400">Sin dirección asignada</span>
                                                        )}
                                                    </p>
                                                ) : null}
                                            </div>
                                            {(!editingNvt || editingNvt !== nvt.nvtName) && (
                                                <button
                                                    onClick={() => handleEditClick(nvt)}
                                                    className="text-blue-600 hover:text-blue-800 text-sm font-semibold hover:underline"
                                                >
                                                    {nvt.street ? 'Editar Dirección' : 'Asignar Dirección'}
                                                </button>
                                            )}
                                        </div>

                                        {editingNvt === nvt.nvtName && (
                                            <form onSubmit={(e) => handleSave(e, nvt.nvtName)} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-4">
                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                                    <div className="sm:col-span-2">
                                                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Calle</label>
                                                        <input
                                                            type="text"
                                                            value={editForm.street}
                                                            onChange={e => setEditForm({ ...editForm, street: e.target.value })}
                                                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                            required
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Número</label>
                                                        <input
                                                            type="text"
                                                            value={editForm.number}
                                                            onChange={e => setEditForm({ ...editForm, number: e.target.value })}
                                                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                        />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Ciudad</label>
                                                    <input
                                                        type="text"
                                                        value={editForm.city}
                                                        onChange={e => setEditForm({ ...editForm, city: e.target.value })}
                                                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                    />
                                                </div>
                                                <div className="flex justify-end gap-2 pt-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => setEditingNvt(null)}
                                                        className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-100 transition-colors"
                                                    >
                                                        Cancelar
                                                    </button>
                                                    <button
                                                        type="submit"
                                                        disabled={saving}
                                                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors"
                                                    >
                                                        {saving ? 'Guardando...' : 'Guardar'}
                                                    </button>
                                                </div>
                                            </form>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    // Form State
    const [status, setStatus] = useState('OK'); // OK or FALLIDO
    const [formData, setFormData] = useState({
        meters: '',
        tk: '',
        tubeColor: '',
        failureReason: '',
        photos: [],
        protocolPdf: null
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

        if (status === 'OK' && !formData.protocolPdf && !selectedAddress.sopladoInfo?.pdfPath) {
            alert('Error: El protocolo en PDF es obligatorio para cerrar el soplado como OK.');
            setSubmitting(false);
            return;
        }

        const data = new FormData();
        data.append('status', status);
        data.append('meters', formData.meters);
        data.append('tk', formData.tk);
        data.append('tubeColor', formData.tubeColor);

        if (status === 'FALLIDO') {
            data.append('failureReason', formData.failureReason);
        }

        if (formData.protocolPdf) {
            data.append('protocolPdf', formData.protocolPdf);
        }

        formData.photos.forEach(file => {
            data.append('photos', file);
        });

        try {
            await api.post(`/api/soplado/report/${selectedAddress.id}`, data, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            alert(t('blowing.report_success'));
            setSelectedAddress(null);
            setFormData({ meters: '', tk: '', tubeColor: '', failureReason: '', photos: [], protocolPdf: null });
            fetchAddresses(); // Refresh list
        } catch (error) {
            console.error('Error submitting report:', error);
            alert(t('blowing.report_error'));
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
            ? t('blowing.confirm_mark_ok', { count: selectedIds.length })
            : t('blowing.confirm_mark_pending', { count: selectedIds.length });

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
                alert(t('blowing.bulk_error'));
            }
        }
    };

    // View: Project Selection
    if (!selectedProject) {
        return (
            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-slate-800">{t('blowing.select_project')}</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {projects.map(project => (
                        <div
                            key={project.id}
                            onClick={() => setSelectedProject(project)}
                            className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 cursor-pointer hover:shadow-md hover:border-blue-400 transition-all"
                        >
                            <h3 className="font-bold text-lg text-slate-800">{project.name}</h3>
                            <p className="text-sm text-slate-500 mt-2">{project._count?.addresses || 0} {t('blowing.addresses')}</p>
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
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setSelectedProject(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                            <ArrowLeft size={24} className="text-slate-600" />
                        </button>
                        <h2 className="text-2xl font-bold text-slate-800">{selectedProject.name}</h2>
                    </div>
                    <button
                        onClick={() => setIsNvtModalOpen(true)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-sm transition-all text-sm"
                    >
                        📍 Direcciones NVT
                    </button>
                </div>

                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input
                        type="text"
                        placeholder={t('blowing.search_nvt_street')}
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
                                {selectedIds.length > 0 ? t('blowing.selected_count', { count: selectedIds.length }) : t('blowing.select_all')}
                            </span>
                        </div>
                        <select 
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="border border-slate-300 rounded-lg px-2 py-1 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="ALL">{t('blowing.show_all')}</option>
                            <option value="OK">{t('blowing.only_ok')}</option>
                            <option value="PENDIENTE">{t('blowing.only_pending')}</option>
                            <option value="FALLIDO">{t('blowing.only_failed')}</option>
                        </select>
                    </div>

                    {filteredAddresses.length === 0 ? (
                        <div className="p-8 text-center text-slate-500">{t('blowing.no_addresses')}</div>
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
                                            {address.sopladoStatus === 'OK' && <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold">{t('blowing.ok')}</span>}
                                            {address.sopladoStatus === 'FALLIDO' && <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold">{t('blowing.failed')}</span>}
                                            {(!address.sopladoStatus || address.sopladoStatus === 'PENDIENTE') && <span className="px-3 py-1 bg-slate-100 text-slate-500 rounded-full text-xs">{t('blowing.pending')}</span>}
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
                        <span className="font-bold text-slate-700 mr-2">{selectedIds.length} {t('blowing.selected_lowercase')}</span>

                        <button
                            onClick={() => handleBulkAction('OK')}
                            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-bold shadow-sm transition-colors flex items-center gap-2"
                        >
                            <CheckCircle size={18} /> {t('blowing.mark_ok')}
                        </button>

                        <button
                            onClick={() => handleBulkAction('PENDIENTE')}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2 rounded-lg font-medium transition-colors"
                        >
                            {t('blowing.mark_pending')}
                        </button>
                    </div>
                )}

                <ManageNvtModal />
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
                        <CheckCircle size={20} /> {t('blowing.blowing_ok')}
                    </button>
                    <button
                        onClick={() => setStatus('FALLIDO')}
                        className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 font-bold transition-all ${status === 'FALLIDO' ? 'bg-red-500 text-white shadow-lg shadow-red-500/30' : 'bg-slate-100 text-slate-400'
                            }`}
                    >
                        <XCircle size={20} /> {t('blowing.failed')}
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">{t('blowing.meters_blown')}</label>
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
                        <label className="block text-sm font-medium text-slate-700 mb-1">{t('blowing.tk_identifier')}</label>
                        <input
                            type="text"
                            value={formData.tk}
                            onChange={(e) => setFormData({ ...formData, tk: e.target.value })}
                            className="w-full border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-green-500 outline-none"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">{t('blowing.tube_color')}</label>
                        <select
                            value={formData.tubeColor}
                            onChange={(e) => setFormData({ ...formData, tubeColor: e.target.value })}
                            className="w-full border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-green-500 outline-none bg-white"
                            required
                        >
                            <option value="">{t('blowing.select_color')}</option>
                            {[
                                { key: 'red', val: 'Rojo' }, { key: 'green', val: 'Verde' }, { key: 'blue', val: 'Azul' }, { key: 'yellow', val: 'Amarillo' }, { key: 'white', val: 'Blanco' }, { key: 'gray', val: 'Gris' }, { key: 'brown', val: 'Marrón' }, { key: 'purple', val: 'Morado' }, { key: 'turquoise', val: 'Turquesa' }, { key: 'black', val: 'Negro' }, { key: 'orange', val: 'Naranja' }, { key: 'pink', val: 'Rosa' },
                                { key: 'red_striped', val: 'Rojo-Rayado' }, { key: 'green_striped', val: 'Verde-Rayado' }, { key: 'blue_striped', val: 'Azul-Rayado' }, { key: 'yellow_striped', val: 'Amarillo-Rayado' }, { key: 'white_striped', val: 'Blanco-Rayado' }, { key: 'gray_striped', val: 'Gris-Rayado' }, { key: 'brown_striped', val: 'Marrón-Rayado' }, { key: 'purple_striped', val: 'Morado-Rayado' }, { key: 'turquoise_striped', val: 'Turquesa-Rayado' }, { key: 'black_striped', val: 'Negro-Rayado' }
                            ].map(color => (
                                <option key={color.val} value={color.val}>{t(`blowing.colors.${color.key}`)}</option>
                            ))}
                        </select>
                    </div>

                    {status === 'FALLIDO' && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">{t('blowing.failure_reason')}</label>
                            <textarea
                                value={formData.failureReason}
                                onChange={(e) => setFormData({ ...formData, failureReason: e.target.value })}
                                className="w-full border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-red-500 outline-none h-32 resize-none"
                                required
                            />
                        </div>
                    )}

                    {/* PDF Protocol Upload */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Protocolo de Soplado (PDF) {status === 'OK' && <span className="text-red-500 font-bold">* Obligatorio</span>}
                        </label>
                        <div className="border-2 border-dashed border-slate-300 bg-slate-50/50 rounded-xl flex flex-col items-center justify-center p-6 hover:bg-slate-100 transition-colors cursor-pointer relative">
                            <input
                                type="file"
                                accept="application/pdf"
                                onChange={(e) => {
                                    const file = e.target.files[0];
                                    setFormData(prev => ({ ...prev, protocolPdf: file }));
                                }}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                            <Upload className="text-slate-500 mb-2" size={32} />
                            {formData.protocolPdf ? (
                                <div className="text-center">
                                    <p className="text-xs font-bold text-slate-700">{formData.protocolPdf.name}</p>
                                    <p className="text-[10px] text-slate-400 font-medium">({(formData.protocolPdf.size / 1024 / 1024).toFixed(2)} MB) - Clic para cambiar</p>
                                </div>
                            ) : selectedAddress?.sopladoInfo?.pdfPath ? (
                                <div className="text-center">
                                    <p className="text-xs font-bold text-green-700">✓ Protocolo ya subido</p>
                                    <p className="text-[10px] text-slate-400 font-medium">Haga clic aquí para reemplazar el PDF existente</p>
                                </div>
                            ) : (
                                <div className="text-xs text-slate-600 font-extrabold uppercase text-center leading-tight">
                                    Seleccionar Protocolo en PDF
                                </div>
                            )}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">{t('blowing.photos_evidence')}</label>
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
                                <div className="text-[10px] text-blue-700 font-extrabold uppercase text-center leading-tight whitespace-pre-line">
                                    {t('blowing.take_photo')}
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
                                <div className="text-[10px] text-slate-600 font-extrabold uppercase text-center leading-tight whitespace-pre-line">
                                    {t('blowing.gallery_multi')}
                                </div>
                            </div>

                            {/* Preview Counter */}
                            {formData.photos.length > 0 && (
                                <div className="col-span-2 p-2 bg-slate-50 rounded-lg border border-slate-200 text-[10px] font-bold text-slate-500 flex justify-between items-center">
                                    <span>{t('blowing.photos_selected', { count: formData.photos.length })}</span>
                                    <button type="button" onClick={() => setFormData({ ...formData, photos: [] })} className="text-red-500 font-extrabold uppercase">{t('blowing.clear')}</button>
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
                        {submitting ? t('blowing.sending') : t('blowing.send_report')}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default BlowingDepartment;
