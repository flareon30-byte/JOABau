import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { Search, Camera, ArrowLeft, Zap, Layers, History, Save } from 'lucide-react';

const FusionDepartment = () => {
    const [projects, setProjects] = useState([]);
    const [selectedProject, setSelectedProject] = useState(null);
    const [addresses, setAddresses] = useState([]);
    const [uniqueNvts, setUniqueNvts] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedNvt, setSelectedNvt] = useState(null);

    // History State
    const [fusionHistory, setFusionHistory] = useState([]);

    // Form State
    const [formData, setFormData] = useState({
        fusionCount: '',
        isTray: false,
        description: '',
        photos: []
    });
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => { fetchProjects(); }, []);

    useEffect(() => {
        if (selectedProject) { fetchAddresses(); }
    }, [selectedProject]);

    useEffect(() => {
        if (selectedNvt && selectedProject) {
            fetchFusionHistory();
        }
    }, [selectedNvt]);

    // Derive NVTs from addresses
    useEffect(() => {
        if (addresses.length > 0) {
            const nvts = new Set();
            addresses.forEach(addr => {
                if (addr.nvt) nvts.add(addr.nvt.trim());
            });
            setUniqueNvts(Array.from(nvts).sort());
        } else {
            setUniqueNvts([]);
        }
    }, [addresses]);

    const fetchProjects = async () => {
        try {
            const res = await api.get('/api/projects');
            setProjects(res.data);
        } catch (error) { console.error(error); }
    };

    const fetchAddresses = async () => {
        try {
            const res = await api.get(`/api/soplado/addresses/${selectedProject.id}`);
            setAddresses(res.data);
        } catch (error) { console.error(error); }
    };

    const fetchFusionHistory = async () => {
        try {
            const res = await api.get(`/api/fusion/works/${selectedProject.id}?nvt=${selectedNvt}`);
            setFusionHistory(res.data);
        } catch (error) { console.error(error); }
    };

    const handleFileChange = (e) => {
        setFormData({ ...formData, photos: Array.from(e.target.files) });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);

        const data = new FormData();
        data.append('projectId', selectedProject.id);
        data.append('nvt', selectedNvt);
        data.append('fusionCount', formData.fusionCount);
        data.append('isTray', formData.isTray);
        data.append('description', formData.description);

        formData.photos.forEach(file => {
            data.append('photos', file);
        });

        try {
            await api.post('/api/fusion/log-work', data, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            alert('Trabajo registrado correctamente');
            setFormData({ fusionCount: '', isTray: false, description: '', photos: [] });
            fetchFusionHistory();
        } catch (error) {
            console.error(error);
            alert('Error al registrar trabajo');
        } finally {
            setSubmitting(false);
        }
    };

    const filteredNvts = uniqueNvts.filter(n =>
        n.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // View: Project Selection
    if (!selectedProject) {
        return (
            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-slate-800">Fusión: Selecciona un Proyecto</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {projects.map(project => (
                        <div
                            key={project.id}
                            onClick={() => setSelectedProject(project)}
                            className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 cursor-pointer hover:shadow-md hover:border-purple-400 transition-all"
                        >
                            <h3 className="font-bold text-lg text-slate-800">{project.name}</h3>
                            <p className="text-sm text-slate-500 mt-2">{project._count?.addresses || 0} direcciones</p>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // View: NVT Selection
    if (!selectedNvt) {
        return (
            <div className="space-y-6">
                {/* Header & Search */}
                <div className="flex items-center gap-4">
                    <button onClick={() => setSelectedProject(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                        <ArrowLeft size={24} className="text-slate-600" />
                    </button>
                    <h2 className="text-2xl font-bold text-slate-800">{selectedProject.name} (Seleccionar NVT)</h2>
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input
                        type="text"
                        placeholder="Buscar NVT..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                </div>

                {/* List */}
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {filteredNvts.map(nvt => (
                        <div
                            key={nvt}
                            onClick={() => setSelectedNvt(nvt)}
                            className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 cursor-pointer hover:shadow-md hover:border-purple-400 transition-all flex items-center gap-3"
                        >
                            <Layers className="text-purple-600" />
                            <span className="font-bold text-slate-700">{nvt}</span>
                        </div>
                    ))}
                    {filteredNvts.length === 0 && <div className="col-span-full text-center text-slate-500 py-8">No se encontraron resultados</div>}
                </div>
            </div>
        );
    }

    // View: Work Log Form & History
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left: Form */}
            <div className="space-y-6">
                <div className="flex items-center gap-4 mb-2">
                    <button onClick={() => setSelectedNvt(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                        <ArrowLeft size={24} className="text-slate-600" />
                    </button>
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">NVT: {selectedNvt}</h2>
                        <p className="text-sm text-slate-500">Registrar nuevo trabajo</p>
                    </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="flex gap-4">
                            <div className="flex-1">
                                <label className="block text-sm font-medium text-slate-700 mb-1">Nº Fusiones</label>
                                <input
                                    type="number"
                                    value={formData.fusionCount}
                                    onChange={e => setFormData({ ...formData, fusionCount: e.target.value })}
                                    className="w-full border border-slate-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-purple-500"
                                    required
                                />
                            </div>
                            <div className="flex items-end mb-3">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.isTray}
                                        onChange={e => setFormData({ ...formData, isTray: e.target.checked })}
                                        className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
                                    />
                                    <span className="text-slate-700 font-medium">En bandeja</span>
                                </label>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Notas / Descripción</label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                className="w-full border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-purple-500 outline-none h-24 resize-none"
                                placeholder="Detalles del trabajo..."
                            />
                        </div>

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

                                {/* Preview of selected files (simple list since we don't have previews easily here) */}
                                {formData.photos.length > 0 && (
                                    <div className="col-span-2 p-2 bg-slate-50 rounded-lg border border-slate-200 text-[10px] font-bold text-slate-500 flex justify-between items-center">
                                        <span>{formData.photos.length} fotos seleccionadas</span>
                                        <button type="button" onClick={() => setFormData({ ...formData, photos: [] })} className="text-red-500">Limpiar</button>
                                    </div>
                                )}
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full py-3 rounded-xl font-bold text-white bg-purple-600 hover:bg-purple-700 transition-all flex items-center justify-center gap-2"
                        >
                            <Save size={20} /> {submitting ? 'Guardando...' : 'Guardar Trabajo'}
                        </button>
                    </form>
                </div>
            </div>

            {/* Right: History */}
            <div className="space-y-6">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <History /> Historial en {selectedNvt}
                </h3>
                <div className="space-y-4">
                    {fusionHistory.length === 0 ? (
                        <div className="text-slate-400 text-center py-8 bg-slate-50 rounded-xl border border-slate-100">
                            No hay trabajos registrados
                        </div>
                    ) : (
                        fusionHistory.map(work => (
                            <div key={work.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                                <div className="flex justify-between items-start mb-2">
                                    <span className="font-bold text-purple-700 text-lg">
                                        {work.fusionCount} Fusiones
                                    </span>
                                    <span className="text-xs text-slate-400">
                                        {new Date(work.createdAt).toLocaleDateString()}
                                    </span>
                                </div>
                                {work.isTray && (
                                    <span className="inline-block bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full font-bold mb-2">
                                        En Bandeja
                                    </span>
                                )}
                                {work.description && (
                                    <p className="text-slate-600 text-sm mb-2">{work.description}</p>
                                )}
                                {work.photos && work.photos.length > 0 && (
                                    <div className="text-xs text-slate-400 flex items-center gap-1">
                                        <Camera size={12} /> {work.photos.length} fotos
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default FusionDepartment;
