import React, { useState, useEffect, useRef } from 'react';
import api from '../api/axios';
import { Camera, Trash2, PenTool, X, Upload } from 'lucide-react';

const TeamToolsModal = ({ team, onClose }) => {
    const [tools, setTools] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newTool, setNewTool] = useState({ name: '', serialNumber: '', status: 'ACTIVE', photos: [] });
    const fileInputRef = useRef(null);
    const [photoPreview, setPhotoPreview] = useState(null);

    const fetchTools = async () => {
        try {
            const res = await api.get(`/api/tools/team/${team.id}`);
            setTools(res.data);
        } catch (error) {
            console.error('Error loading tools', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTools();
    }, [team.id]);

    const handlePhotoChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setNewTool({ ...newTool, photos: [file] });
            setPhotoPreview(URL.createObjectURL(file));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const formData = new FormData();
        formData.append('name', newTool.name);
        formData.append('serialNumber', newTool.serialNumber);
        formData.append('status', newTool.status);
        if (newTool.photos[0]) {
            formData.append('photos', newTool.photos[0]);
        }

        try {
            await api.post(`/api/tools/team/${team.id}`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setNewTool({ name: '', serialNumber: '', status: 'ACTIVE', photos: [] });
            setPhotoPreview(null);
            fetchTools();
        } catch (error) {
            alert('Error adding tool');
        }
    };

    const handleDelete = async (id) => {
        if (confirm('¿Eliminar herramienta?')) {
            try {
                await api.delete(`/api/tools/${id}`);
                fetchTools();
            } catch (error) {
                alert('Error deleting tool');
            }
        }
    };

    const getPhotoUrl = (path) => {
        if (!path) return null;
        // Fix path slashes
        const normalized = path.replace(/\\/g, '/');
        // If it's stored as 'uploads/file.jpg', prepending / gets us /uploads/file.jpg which works via static serve
        return `/${normalized}`;
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-4xl h-[90vh] flex flex-col shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">Inventario de Herramientas</h2>
                        <p className="text-slate-500">Equipo: {team.name}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="flex-1 flex overflow-hidden">
                    {/* Add Tool Form - Left Panel */}
                    <div className="w-1/3 bg-slate-50 p-6 border-r border-slate-200 overflow-y-auto">
                        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                            <PenTool size={20} className="text-blue-600" />
                            Registrar Herramienta
                        </h3>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre / Tipo</label>
                                <input
                                    type="text"
                                    placeholder="Ej: Fusionadora Fujikura"
                                    value={newTool.name}
                                    onChange={e => setNewTool({ ...newTool, name: e.target.value })}
                                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Número de Serie</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="S/N 12345678"
                                        value={newTool.serialNumber}
                                        onChange={e => setNewTool({ ...newTool, serialNumber: e.target.value })}
                                        className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none uppercase"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current.click()}
                                        className="bg-slate-200 hover:bg-slate-300 text-slate-700 p-2 rounded-lg flex items-center justify-center"
                                        title="Escanear etiqueta (Foto)"
                                    >
                                        <Camera size={20} />
                                    </button>
                                </div>
                                <p className="text-xs text-slate-400 mt-1">
                                    💡 Haz una foto a la etiqueta para guardar el número de serie.
                                </p>
                            </div>

                            {/* Photo Upload Hidden Input */}
                            <input
                                type="file"
                                ref={fileInputRef}
                                accept="image/*"
                                capture="environment"
                                className="hidden"
                                onChange={handlePhotoChange}
                            />

                            {/* Photo Preview */}
                            {photoPreview && (
                                <div className="mt-2 relative group rounded-lg overflow-hidden border border-slate-200">
                                    <img src={photoPreview} alt="Preview" className="w-full h-40 object-cover" />
                                    <button
                                        type="button"
                                        onClick={() => { setPhotoPreview(null); setNewTool({ ...newTool, photos: [] }) }}
                                        className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Estado</label>
                                <select
                                    value={newTool.status}
                                    onChange={e => setNewTool({ ...newTool, status: e.target.value })}
                                    className="w-full p-2 border border-slate-300 rounded-lg"
                                >
                                    <option value="ACTIVE">✅ Activo</option>
                                    <option value="REPAIR">🔧 En Reparación</option>
                                    <option value="BROKEN">❌ Averiado / Baja</option>
                                </select>
                            </div>

                            <button
                                type="submit"
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                            >
                                <Upload size={18} /> Guardar Item
                            </button>
                        </form>
                    </div>

                    {/* Tools List - Right Panel */}
                    <div className="w-2/3 bg-white p-6 overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-lg text-slate-800">Inventario Actual ({tools.length})</h3>
                            <div className="flex gap-2">
                                <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">Active: {tools.filter(t => t.status === 'ACTIVE').length}</span>
                                <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full">Repair: {tools.filter(t => t.status === 'REPAIR').length}</span>
                            </div>
                        </div>

                        {loading ? (
                            <div className="text-center py-10 text-slate-400">Cargando...</div>
                        ) : tools.length === 0 ? (
                            <div className="text-center py-20 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                                <PenTool size={48} className="mx-auto mb-4 opacity-50" />
                                <p>Este equipo no tiene herramientas asignadas.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {tools.map(tool => (
                                    <div key={tool.id} className="border border-slate-200 rounded-xl p-4 hover:shadow-lg transition-all flex gap-4">
                                        {/* Tool Image */}
                                        <div className="w-20 h-20 bg-slate-100 rounded-lg flex-shrink-0 overflow-hidden border border-slate-100">
                                            {tool.photos && tool.photos[0] ? (
                                                <img
                                                    src={getPhotoUrl(tool.photos[0])}
                                                    alt={tool.name}
                                                    className="w-full h-full object-cover"
                                                    onClick={() => window.open(getPhotoUrl(tool.photos[0]), '_blank')}
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-slate-300">
                                                    <PenTool size={24} />
                                                </div>
                                            )}
                                        </div>

                                        {/* Tool Info */}
                                        <div className="flex-1">
                                            <div className="flex justify-between items-start">
                                                <h4 className="font-bold text-slate-800">{tool.name}</h4>
                                                <button onClick={() => handleDelete(tool.id)} className="text-slate-400 hover:text-red-500">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                            <p className="text-sm text-slate-500 mb-2 font-mono bg-slate-50 inline-block px-1 rounded border border-slate-100">
                                                S/N: {tool.serialNumber}
                                            </p>

                                            <div>
                                                {tool.status === 'ACTIVE' && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Activo</span>}
                                                {tool.status === 'REPAIR' && <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">En Reparación</span>}
                                                {tool.status === 'BROKEN' && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">Averiado</span>}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TeamToolsModal;
