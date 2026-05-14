import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import { Search, Camera, ArrowLeft, Zap, Layers, History, Save, Upload, MapPin, Clock, RefreshCw, X, Trash2 } from 'lucide-react';
import useBranding from '../hooks/useBranding';
import { saveFusionDraft, getFusionDraft, deleteFusionDraft } from '../utils/offlineStorage';

const FusionDepartment = () => {
    const { branding } = useBranding();
    const [projects, setProjects] = useState([]);
    const [selectedProject, setSelectedProject] = useState(null);
    const [addresses, setAddresses] = useState([]);
    const [uniqueNvts, setUniqueNvts] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedNvt, setSelectedNvt] = useState(null);
    const [isMuffaMode, setIsMuffaMode] = useState(false);

    // History State
    const [fusionHistory, setFusionHistory] = useState([]);

    // Form State
    const [formData, setFormData] = useState({
        fusionCount: '',
        isTray: false,
        description: '',
        address: '',
        hours: ''
    });
    const [photos, setPhotos] = useState([]); // Array of objects: { blob, preview, name }
    const [submitting, setSubmitting] = useState(false);
    const [isLocating, setIsLocating] = useState(false);
    const [isProcessingPhotos, setIsProcessingPhotos] = useState(false);
    const [viewingPhoto, setViewingPhoto] = useState(null);

    // Get current user from localStorage
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    useEffect(() => { fetchProjects(); }, []);

    useEffect(() => {
        if (selectedProject) { fetchAddresses(); }
    }, [selectedProject]);

    useEffect(() => {
        if ((selectedNvt || isMuffaMode) && selectedProject) {
            fetchFusionHistory();
            loadDraft();
        }
    }, [selectedNvt, isMuffaMode, selectedProject]);

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
            const url = isMuffaMode 
                ? `/api/fusion/works/${selectedProject.id}?type=MUFFA`
                : `/api/fusion/works/${selectedProject.id}?nvt=${selectedNvt}`;
            const res = await api.get(url);
            setFusionHistory(res.data);
        } catch (error) { console.error(error); }
    };

    // --- DRAFT PERSISTENCE ---
    const getDraftId = () => {
        if (!selectedProject) return null;
        return isMuffaMode 
            ? `fusion_${selectedProject.id}_MUFFA`
            : `fusion_${selectedProject.id}_${selectedNvt}`;
    };

    const loadDraft = async () => {
        const draftId = getDraftId();
        if (!draftId) return;

        try {
            const draft = await getFusionDraft(draftId);
            if (draft) {
                console.log("Recovering draft for", draftId);
                setFormData(prev => ({ ...prev, ...draft.formData }));
                if (draft.photos && draft.photos.length > 0) {
                    const recoveredPhotos = draft.photos.map(p => ({
                        ...p,
                        preview: URL.createObjectURL(p.blob)
                    }));
                    setPhotos(recoveredPhotos);
                }
            }
        } catch (err) {
            console.error("Error loading draft", err);
        }
    };

    useEffect(() => {
        const draftId = getDraftId();
        if (!draftId || isProcessingPhotos || submitting) return;

        const autoSave = async () => {
            try {
                await saveFusionDraft(draftId, {
                    formData,
                    photos: photos.map(p => ({ blob: p.blob, name: p.name }))
                });
            } catch (err) {
                console.error("Auto-save failed", err);
            }
        };

        const timeout = setTimeout(autoSave, 2000);
        return () => clearTimeout(timeout);
    }, [formData, photos, isMuffaMode, selectedNvt, selectedProject]);

    // --- PHOTO BRANDING ---
    const processPhoto = async (file) => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const objectUrl = URL.createObjectURL(file);

            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                const MAX_DIM = 1600;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_DIM) {
                        height *= MAX_DIM / width;
                        width = MAX_DIM;
                    }
                } else {
                    if (height > MAX_DIM) {
                        width *= MAX_DIM / height;
                        height = MAX_DIM;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);

                // Watermark logic
                const finalize = (logoImg = null) => {
                    const fontSize = Math.max(20, Math.floor(height * 0.025));
                    const padding = fontSize * 1.5;
                    
                    ctx.save();
                    ctx.shadowColor = 'rgba(0,0,0,0.8)';
                    ctx.shadowBlur = 6;
                    ctx.shadowOffsetX = 2;
                    ctx.shadowOffsetY = 2;

                    let techYOffset = padding;

                    if (logoImg) {
                        const logoWidth = width * 0.18;
                        const logoHeight = (logoImg.height / logoImg.width) * logoWidth;
                        ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
                        ctx.drawImage(logoImg, padding, padding, logoWidth, logoHeight);
                        techYOffset = padding + logoHeight + (fontSize * 0.5);
                    }

                    ctx.shadowColor = 'rgba(0,0,0,0.8)';
                    ctx.shadowBlur = 6;
                    ctx.shadowOffsetX = 2;
                    ctx.shadowOffsetY = 2;
                    ctx.fillStyle = 'white';
                    ctx.font = `bold ${fontSize}px Arial`;
                    ctx.textBaseline = 'top';
                    const techName = user.username?.split('@')[0] || 'Técnico JOA';
                    ctx.fillText(techName.toUpperCase(), padding, techYOffset);
                    
                    const today = new Date().toLocaleDateString('es-ES');
                    ctx.fillText(today, padding, techYOffset + fontSize + 5);

                    ctx.restore();

                    canvas.toBlob((blob) => {
                        URL.revokeObjectURL(objectUrl);
                        resolve({
                            blob,
                            preview: URL.createObjectURL(blob),
                            name: file.name
                        });
                    }, 'image/jpeg', 0.85);
                };

                if (branding.logoUrl) {
                    const logoImg = new Image();
                    logoImg.crossOrigin = "anonymous";
                    logoImg.onload = () => finalize(logoImg);
                    logoImg.onerror = () => finalize(null);
                    logoImg.src = branding.logoUrl;
                } else {
                    finalize(null);
                }
            };
            img.onerror = () => reject(new Error("Image load failed"));
            img.src = objectUrl;
        });
    };

    const handlePhotoSelect = async (e) => {
        if (e.target.files && e.target.files.length > 0) {
            setIsProcessingPhotos(true);
            const selectedFiles = Array.from(e.target.files);
            const processedPhotos = [];

            for (const file of selectedFiles) {
                try {
                    const processed = await processPhoto(file);
                    processedPhotos.push(processed);
                } catch (err) {
                    console.error("Error processing photo", err);
                }
            }

            setPhotos(prev => [...prev, ...processedPhotos]);
            setIsProcessingPhotos(false);
        }
    };

    const removePhoto = (index) => {
        const photo = photos[index];
        if (photo.preview.startsWith('blob:')) URL.revokeObjectURL(photo.preview);
        setPhotos(prev => prev.filter((_, i) => i !== index));
    };

    const updateLocation = () => {
        if ("geolocation" in navigator) {
            setIsLocating(true);
            navigator.geolocation.getCurrentPosition(async (position) => {
                const { latitude, longitude } = position.coords;
                setFormData(prev => ({ ...prev, address: `GPS: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}` }));
                setIsLocating(false);
            }, (error) => {
                console.warn("Geolocation error", error);
                setIsLocating(false);
                alert("No se pudo obtener la ubicación GPS.");
            }, { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 });
        } else {
            alert("Tu navegador no soporta geolocalización.");
        }
    };

    // Auto-fill location for Muffas
    useEffect(() => {
        if (isMuffaMode && !formData.address) {
            updateLocation();
        }
    }, [isMuffaMode]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);

        const data = new FormData();
        data.append('projectId', selectedProject.id);
        if (isMuffaMode) {
            data.append('type', 'MUFFA');
            data.append('address', formData.address);
            data.append('hours', formData.hours);
        } else {
            data.append('type', 'NVT');
            data.append('nvt', selectedNvt);
        }
        data.append('fusionCount', formData.fusionCount);
        data.append('isTray', formData.isTray);
        data.append('description', formData.description);

        photos.forEach((p, i) => {
            data.append('photos', p.blob, `foto_${i}.jpg`);
        });

        try {
            await api.post('/api/fusion/log-work', data, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            alert('Trabajo registrado correctamente');
            
            // Clear draft
            const draftId = getDraftId();
            if (draftId) await deleteFusionDraft(draftId);

            setFormData({ fusionCount: '', isTray: false, description: '', address: '', hours: '' });
            setPhotos([]);
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
    if (!selectedNvt && !isMuffaMode) {
        return (
            <div className="space-y-6">
                {/* Header & Search */}
                <div className="flex items-center gap-4">
                    <button onClick={() => setSelectedProject(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                        <ArrowLeft size={24} className="text-slate-600" />
                    </button>
                    <h2 className="text-2xl font-bold text-slate-800">{selectedProject.name} (Seleccionar NVT o Muffa)</h2>
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
                    {/* Special Muffa Item */}
                    <div
                        onClick={() => setIsMuffaMode(true)}
                        className="bg-gradient-to-br from-purple-600 to-indigo-700 p-6 rounded-xl shadow-lg border border-transparent cursor-pointer hover:scale-[1.02] transition-all flex items-center gap-3 text-white"
                    >
                        <Zap className="text-yellow-300" />
                        <span className="font-black text-lg">NUEVA MUFFA</span>
                    </div>

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
                    <button 
                        onClick={() => {
                            setSelectedNvt(null);
                            setIsMuffaMode(false);
                            setFormData({ fusionCount: '', isTray: false, description: '', address: '', hours: '' });
                            setPhotos([]);
                        }} 
                        className="p-2 hover:bg-slate-200 rounded-full transition-colors"
                    >
                        <ArrowLeft size={24} className="text-slate-600" />
                    </button>
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">
                            {isMuffaMode ? 'Trabajo en MUFFA' : `NVT: ${selectedNvt}`}
                        </h2>
                        <p className="text-sm text-slate-500">Registrar nuevo trabajo</p>
                    </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        
                        {isMuffaMode && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="col-span-full">
                                    <label className="block text-sm font-bold text-slate-700 mb-1 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <MapPin size={16} className="text-purple-500" /> Dirección de la Muffa
                                        </div>
                                        <button 
                                            type="button" 
                                            onClick={updateLocation}
                                            className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-1 rounded flex items-center gap-1 transition-colors font-bold"
                                        >
                                            <RefreshCw size={10} className={isLocating ? 'animate-spin' : ''} />
                                            {isLocating ? 'Localizando...' : 'Actualizar GPS'}
                                        </button>
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.address}
                                        onChange={e => setFormData({ ...formData, address: e.target.value })}
                                        placeholder="Se rellena automáticamente con GPS..."
                                        className="w-full border border-slate-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-purple-500 font-medium"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1 flex items-center gap-2">
                                        <Clock size={16} className="text-purple-500" /> Horas dedicadas
                                    </label>
                                    <input
                                        type="number"
                                        step="0.5"
                                        value={formData.hours}
                                        onChange={e => setFormData({ ...formData, hours: e.target.value })}
                                        placeholder="Ej: 2.5"
                                        className="w-full border border-slate-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-purple-500 font-bold"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Nº Fusiones Totales</label>
                                    <input
                                        type="number"
                                        value={formData.fusionCount}
                                        onChange={e => setFormData({ ...formData, fusionCount: e.target.value })}
                                        className="w-full border border-slate-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-purple-500 font-bold"
                                        required
                                    />
                                </div>
                            </div>
                        )}

                        {!isMuffaMode && (
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
                        )}

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Notas / Descripción del trabajo</label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                className="w-full border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-purple-500 outline-none h-24 resize-none"
                                placeholder="Detalla lo realizado..."
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Fotos / Evidencias</label>
                            
                            {/* Photo Grid Preview */}
                            {photos.length > 0 && (
                                <div className="grid grid-cols-4 gap-2 mb-4">
                                    {photos.map((p, idx) => (
                                        <div key={idx} className="relative aspect-square group">
                                            <img 
                                                src={p.preview} 
                                                alt="preview" 
                                                onClick={() => setViewingPhoto(p.preview)}
                                                className="w-full h-full object-cover rounded-lg border border-slate-200 cursor-pointer" 
                                            />
                                            <button 
                                                type="button"
                                                onClick={() => removePhoto(idx)}
                                                className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1 shadow-lg z-10"
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>
                                    ))}
                                    {isProcessingPhotos && (
                                        <div className="aspect-square bg-slate-100 rounded-lg flex items-center justify-center border border-dashed border-slate-300">
                                            <RefreshCw size={20} className="text-slate-400 animate-spin" />
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4 mb-4">
                                {/* Camera Button */}
                                <div className="border-2 border-dashed border-blue-400 bg-blue-50/50 rounded-xl flex flex-col items-center justify-center p-4 hover:bg-blue-100 transition-colors cursor-pointer relative aspect-square">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        capture="environment"
                                        onChange={handlePhotoSelect}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        disabled={isProcessingPhotos}
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
                                        onChange={handlePhotoSelect}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        disabled={isProcessingPhotos}
                                    />
                                    <Upload className="text-slate-500 mb-2" size={28} />
                                    <div className="text-[10px] text-slate-600 font-extrabold uppercase text-center leading-tight">
                                        Galería
                                        <br />
                                        Varios
                                    </div>
                                </div>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={submitting || isProcessingPhotos}
                            className={`w-full py-3 rounded-xl font-bold text-white transition-all flex items-center justify-center gap-2 ${isMuffaMode ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-purple-600 hover:bg-purple-700'}`}
                        >
                            <Save size={20} /> {submitting ? 'Guardando...' : 'Guardar Trabajo'}
                        </button>
                    </form>
                </div>
            </div>

            {/* Right: History */}
            <div className="space-y-6">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <History /> {isMuffaMode ? 'Historial de Muffas' : `Historial en ${selectedNvt}`}
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
                                    <div className="flex flex-col">
                                        <span className={`font-bold text-lg ${work.type === 'MUFFA' ? 'text-indigo-700' : 'text-purple-700'}`}>
                                            {work.fusionCount} Fusiones
                                        </span>
                                        {work.type === 'MUFFA' && (
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold">MUFFA</span>
                                                <span className="text-xs text-slate-500 font-bold flex items-center gap-1"><Clock size={12}/> {work.hours}h</span>
                                            </div>
                                        )}
                                    </div>
                                    <span className="text-xs text-slate-400 font-medium">
                                        {new Date(work.createdAt).toLocaleDateString('es-ES')}
                                    </span>
                                </div>
                                {work.address && (
                                    <p className="text-xs text-slate-500 font-bold mb-2 flex items-center gap-1">
                                        <MapPin size={12} className="text-slate-400"/> {work.address}
                                    </p>
                                )}
                                {work.isTray && (
                                    <span className="inline-block bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full font-bold mb-2">
                                        En Bandeja
                                    </span>
                                )}
                                {work.description && (
                                    <p className="text-slate-600 text-sm mb-2 italic">"{work.description}"</p>
                                )}
                                {work.photos && work.photos.length > 0 && (
                                    <div className="grid grid-cols-4 gap-1 mt-2">
                                        {work.photos.slice(0, 4).map((p, i) => {
                                            const fullUrl = `${api.defaults.baseURL || ''}/${p.replace(/\\/g, '/')}`;
                                            return (
                                                <img 
                                                    key={i} 
                                                    src={fullUrl} 
                                                    onClick={() => setViewingPhoto(fullUrl)}
                                                    className="w-full aspect-square object-cover rounded shadow-sm border border-slate-100 cursor-pointer hover:opacity-80 transition-opacity" 
                                                    alt="fusion" 
                                                />
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
            {/* Modal for viewing photos */}
            {viewingPhoto && (
                <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <button 
                        onClick={() => setViewingPhoto(null)}
                        className="absolute top-6 right-6 text-white bg-white/10 hover:bg-white/20 p-3 rounded-full transition-colors"
                    >
                        <X size={32} />
                    </button>
                    <img 
                        src={viewingPhoto} 
                        alt="Full size" 
                        className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
                    />
                </div>
            )}
        </div>
    );
};

export default FusionDepartment;
