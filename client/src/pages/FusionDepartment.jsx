import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, Camera, ArrowLeft, Zap } from 'lucide-react';

const FusionDepartment = () => {
    const [projects, setProjects] = useState([]);
    const [selectedProject, setSelectedProject] = useState(null);
    const [addresses, setAddresses] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedAddress, setSelectedAddress] = useState(null);

    // Form State
    const [formData, setFormData] = useState({
        description: '',
        photos: []
    });
    const [submitting, setSubmitting] = useState(false);

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
            const res = await axios.get('http://localhost:3000/api/projects', { withCredentials: true });
            setProjects(res.data);
        } catch (error) {
            console.error('Error fetching projects:', error);
        }
    };

    const fetchAddresses = async () => {
        try {
            // Reusing soplado endpoint for address search as it's the same logic
            const res = await axios.get(`http://localhost:3000/api/soplado/addresses/${selectedProject.id}?search=${searchTerm}`, { withCredentials: true });
            setAddresses(res.data);
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
        data.append('description', formData.description);

        formData.photos.forEach(file => {
            data.append('photos', file);
        });

        try {
            await axios.post(`http://localhost:3000/api/fusion/report/${selectedAddress.id}`, data, {
                withCredentials: true,
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            alert('Reporte de fusión enviado correctamente');
            setSelectedAddress(null);
            setFormData({ description: '', photos: [] });
            fetchAddresses();
        } catch (error) {
            console.error('Error submitting report:', error);
            alert('Error al enviar reporte');
        } finally {
            setSubmitting(false);
        }
    };

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

    // View: Address Selection
    if (!selectedAddress) {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <button onClick={() => setSelectedProject(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                        <ArrowLeft size={24} className="text-slate-600" />
                    </button>
                    <h2 className="text-2xl font-bold text-slate-800">{selectedProject.name} (Fusión)</h2>
                </div>

                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input
                        type="text"
                        placeholder="Buscar por NVT o Calle..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    {addresses.length === 0 ? (
                        <div className="p-8 text-center text-slate-500">No se encontraron direcciones</div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {addresses.map(address => (
                                <div
                                    key={address.id}
                                    onClick={() => setSelectedAddress(address)}
                                    className="p-4 hover:bg-slate-50 cursor-pointer transition-colors flex justify-between items-center"
                                >
                                    <div>
                                        <div className="font-medium text-slate-800">{address.street} {address.number}</div>
                                        <div className="text-sm text-slate-500">NVT: {address.nvt || 'N/A'}</div>
                                    </div>
                                    <div>
                                        {address.fusionInfo ? (
                                            <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-bold">REALIZADO</span>
                                        ) : (
                                            <span className="px-3 py-1 bg-slate-100 text-slate-500 rounded-full text-xs">PENDIENTE</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
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
                <div className="flex items-center gap-3 mb-6 text-purple-600">
                    <Zap size={24} />
                    <h3 className="text-lg font-bold">Reporte de Fusión</h3>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Descripción / Notas</label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            className="w-full border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-purple-500 outline-none h-32 resize-none"
                            placeholder="Detalles del trabajo realizado..."
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Fotos (Opcional)</label>
                        <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:bg-slate-50 transition-colors cursor-pointer relative">
                            <input
                                type="file"
                                multiple
                                accept="image/*"
                                onChange={handleFileChange}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                            <Camera className="mx-auto text-slate-400 mb-2" size={32} />
                            <p className="text-sm text-slate-500">
                                {formData.photos.length > 0
                                    ? `${formData.photos.length} archivos seleccionados`
                                    : 'Toca para tomar o subir fotos'}
                            </p>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={submitting}
                        className="w-full py-4 rounded-xl font-bold text-white bg-purple-600 hover:bg-purple-700 transition-all disabled:opacity-50"
                    >
                        {submitting ? 'Enviando...' : 'Guardar Fusión'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default FusionDepartment;
