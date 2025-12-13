import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { Search, CheckCircle, XCircle, Camera, Upload, ArrowLeft } from 'lucide-react';

const BlowingDepartment = () => {
    const [projects, setProjects] = useState([]);
    const [selectedProject, setSelectedProject] = useState(null);
    const [addresses, setAddresses] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
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
        data.append('status', status);
        if (status === 'OK') {
            data.append('meters', formData.meters);
            data.append('tk', formData.tk);
            data.append('tubeColor', formData.tubeColor);
        } else {
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
            <div className="space-y-6">
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
                                        {address.sopladoStatus === 'OK' && <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold">OK</span>}
                                        {address.sopladoStatus === 'FALLIDO' && <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold">FALLIDO</span>}
                                        {!address.sopladoStatus && <span className="px-3 py-1 bg-slate-100 text-slate-500 rounded-full text-xs">PENDIENTE</span>}
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
                    {status === 'OK' ? (
                        <>
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
                        </>
                    ) : (
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
