import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { CheckCircle, Camera, ArrowLeft, Calendar, MapPin, Trash2, X, FileText } from 'lucide-react';

const BASE_URL = import.meta.env.PROD ? '' : 'http://localhost:3000';

const ActivationPage = () => {
    const [appointments, setAppointments] = useState([]);
    const [selectedAppointment, setSelectedAppointment] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [activeTab, setActiveTab] = useState('pending');
    const [searchQuery, setSearchQuery] = useState('');

    // Photo Viewer State
    const [viewingPhotoIndex, setViewingPhotoIndex] = useState(null);

    // Form State
    const [formData, setFormData] = useState({
        activationType: 'BP',
        familiesCount: 1,
        apPorts: 1,
        hasMoreClients: false,
        spInstalled: 0,
        taInstalled: false,
        homeId: '',
        klsId: '',
        description: ''
    });

    const [pdfPath, setPdfPath] = useState(null);
    const [signedPdf, setSignedPdf] = useState(null);

    const [photos, setPhotos] = useState([]); // Array of  { blob, preview, isExisting, originalPath }

    useEffect(() => {
        fetchAppointments();
    }, []);

    // Hydrate form when appointment is selected
    useEffect(() => {
        if (selectedAppointment) {
            if (selectedAppointment.address.activationInfo) {
                const info = selectedAppointment.address.activationInfo;
                setFormData({
                    activationType: info.activationType || 'BP',
                    familiesCount: info.familiesCount || 1,
                    apPorts: info.apPorts || 1,
                    hasMoreClients: info.hasMoreClients || false,
                    spInstalled: info.spInstalled || 0,
                    taInstalled: info.taInstalled || false,
                    homeId: info.homeIds && info.homeIds.length > 0 ? info.homeIds[0] : '',
                    klsId: info.klsId || selectedAppointment.address.klsId || '',
                    description: info.description || ''
                });

                setPdfPath(info.pdfPath || null);

                // Load existing photos
                if (info.photos && info.photos.length > 0) {
                    setPhotos(info.photos.map((path, i) => ({
                        blob: null,
                        preview: `${BASE_URL}/${path.replace(/\\/g, '/')}`,
                        isExisting: true,
                        originalPath: path
                    })));
                } else {
                    setPhotos([]);
                }
            } else {
                // Reset defaults
                setFormData({
                    activationType: 'BP',
                    familiesCount: 1,
                    apPorts: 1,
                    hasMoreClients: false,
                    spInstalled: 0,
                    taInstalled: false,
                    homeId: '',
                    klsId: selectedAppointment.address.klsId || '',
                    description: ''
                });
                setPdfPath(null);
                setPhotos([]);
            }
        }
    }, [selectedAppointment]);

    const fetchAppointments = async () => {
        try {
            const res = await api.get('/api/activations/my-appointments');
            setAppointments(res.data);
        } catch (error) {
            console.error('Error fetching appointments:', error);
        }
    };

    const handleFileChange = (e) => {
        const newFiles = Array.from(e.target.files);
        const newPhotos = newFiles.map(file => ({
            blob: file,
            preview: URL.createObjectURL(file),
            isExisting: false
        }));
        setPhotos([...photos, ...newPhotos]);
    };

    const removePhoto = (index) => {
        const newPhotos = [...photos];
        const removed = newPhotos.splice(index, 1)[0];
        if (!removed.isExisting && removed.preview) {
            URL.revokeObjectURL(removed.preview);
        }
        setPhotos(newPhotos);
        if (viewingPhotoIndex !== null) setViewingPhotoIndex(null);
    };

    const handleGeneratePdf = async () => {
        if (!formData.klsId) {
            alert('Por favor, indica el KLS ID antes de generar el PDF.');
            return;
        }

        try {
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            const payload = {
                addressId: selectedAppointment.addressId,
                clientName: selectedAppointment.clientName || selectedAppointment.address.clientName,
                street: selectedAppointment.address.street,
                number: selectedAppointment.address.number,
                city: selectedAppointment.address.city,
                klsId: formData.klsId,
                username: user.username,
                userPhone: user.phone || ''
            };

            const res = await api.post('/api/activations/generate-pdf', payload);

            if (res.data.success) {
                setPdfPath(res.data.path);
                alert('Documento PDF generado correctamente. Por favor, asegúrate de firmarlo/completarlo si es necesario.');
                window.open(`${BASE_URL}/${res.data.path}`, '_blank');
            }
        } catch (error) {
            console.error('Error creating PDF:', error);
            alert('Error al generar el PDF.');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (pdfPath) {
            const confirmed = window.confirm('¿Has rellenado correctamente el documento PDF de GlasfaserPlus?');
            if (!confirmed) return;
        } else {
            // Optional: prevent saving if not generated, or just warn
            if (!confirm('No has generado el documento PDF. ¿Estás seguro de que deseas guardar sin él? (Podrías tener problemas para finalizar)')) {
                return;
            }
        }

        setSubmitting(true);

        const data = new FormData();
        Object.keys(formData).forEach(key => {
            data.append(key, formData[key]);
        });

        const existingPaths = [];
        photos.forEach((photo, index) => {
            if (photo.isExisting && photo.originalPath) {
                existingPaths.push(photo.originalPath);
            } else if (photo.blob) {
                data.append('photos', photo.blob);
            }
        });

        data.append('existingPhotos', JSON.stringify(existingPaths));
        data.append('existingPhotos', JSON.stringify(existingPaths));
        if (pdfPath && !signedPdf) {
            data.append('pdfPath', pdfPath);
        }
        if (signedPdf) {
            data.append('signedPdf', signedPdf);
        }

        try {
            await api.post(`/api/activations/report/${selectedAppointment.addressId}`, data, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            alert('Activación guardada correctamente');
            setSelectedAppointment(null);
            fetchAppointments();
        } catch (error) {
            console.error('Error submitting activation:', error);
            alert('Error al enviar reporte');
        } finally {
            setSubmitting(false);
        }
    };

    if (!selectedAppointment) {
        const filteredAppointments = appointments.filter(app => {
            const matchesSearch =
                app.address.street.toLowerCase().includes(searchQuery.toLowerCase()) ||
                app.address.project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (app.address.city && app.address.city.toLowerCase().includes(searchQuery.toLowerCase()));

            const isCompleted = app.status === 'COMPLETADO';
            return activeTab === 'pending' ? (!isCompleted && matchesSearch) : (isCompleted && matchesSearch);
        });

        return (
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <h2 className="text-2xl font-bold text-slate-800">Mis Citas Asignadas</h2>

                    {/* Search Bar */}
                    <div className="relative w-full md:w-64">
                        <input
                            type="text"
                            placeholder="Buscar..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex bg-slate-100 p-1 rounded-xl w-full md:w-fit">
                    <button
                        onClick={() => setActiveTab('pending')}
                        className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'pending' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Pendientes
                    </button>
                    <button
                        onClick={() => setActiveTab('completed')}
                        className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'completed' ? 'bg-white text-green-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Terminadas
                    </button>
                </div>

                {filteredAppointments.length === 0 ? (
                    <div className="bg-white p-12 rounded-xl shadow-sm border border-slate-200 text-center">
                        <div className="text-slate-300 mb-2 flex justify-center">
                            {activeTab === 'pending' ? <Calendar size={48} /> : <CheckCircle size={48} />}
                        </div>
                        <p className="text-slate-500">
                            {activeTab === 'pending'
                                ? 'No tienes citas pendientes que coincidan con la búsqueda.'
                                : 'No tienes citas completadas que coincidan con la búsqueda.'}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {filteredAppointments.map(app => (
                            <div
                                key={app.id}
                                onClick={() => setSelectedAppointment(app)}
                                className={`bg-white p-6 rounded-xl shadow-sm border cursor-pointer hover:shadow-md transition-all ${app.status === 'COMPLETADO'
                                    ? 'border-green-500 bg-green-50'
                                    : 'border-slate-200 hover:border-green-400'
                                    }`}
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-2 text-blue-600 font-bold">
                                        <Calendar size={18} />
                                        {new Date(app.assignedDate).toLocaleDateString()} {new Date(app.assignedDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                    {app.status === 'COMPLETADO' && (
                                        <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                                            <CheckCircle size={14} /> Completado
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-start gap-3">
                                    <MapPin className="text-slate-400 mt-1" size={20} />
                                    <div>
                                        <h3 className="font-bold text-lg text-slate-800">{app.address.street} {app.address.number}</h3>
                                        <p className="text-sm text-slate-500">{app.address.project.name} | NVT: {app.address.nvt}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-center gap-4 mb-6">
                <button onClick={() => setSelectedAppointment(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                    <ArrowLeft size={24} className="text-slate-600" />
                </button>
                <div>
                    <h2 className="text-xl font-bold text-slate-800">{selectedAppointment.address.street} {selectedAppointment.address.number}</h2>
                    <p className="text-sm text-slate-500">
                        {selectedAppointment.status === 'COMPLETADO' ? 'Modificar Activación' : 'Completar Activación'}
                    </p>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <form onSubmit={handleSubmit} className="space-y-6">

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Activación</label>
                        <select
                            value={formData.activationType}
                            onChange={(e) => setFormData({ ...formData, activationType: e.target.value })}
                            className="w-full border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-green-500 outline-none"
                        >
                            <option value="BP">BP (Básico)</option>
                            <option value="BP_2_FAM">BP 2 Familias</option>
                            <option value="BR_MULTI">BR Multi</option>
                            <option value="SDU">SDU</option>
                            <option value="MDU">MDU</option>
                        </select>
                    </div>

                    {!['SDU', 'MDU'].includes(formData.activationType) && (
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Cant. Familias</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={formData.familiesCount}
                                    onChange={(e) => setFormData({ ...formData, familiesCount: e.target.value })}
                                    className="w-full border border-slate-300 rounded-lg p-3 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Puertos AP</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={formData.apPorts}
                                    onChange={(e) => setFormData({ ...formData, apPorts: e.target.value })}
                                    className="w-full border border-slate-300 rounded-lg p-3 outline-none"
                                />
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Home ID</label>
                        <input
                            type="text"
                            value={formData.homeId}
                            onChange={(e) => setFormData({ ...formData, homeId: e.target.value })}
                            className="w-full border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-green-500 outline-none"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">KLS ID (Automático)</label>
                        <input
                            type="text"
                            value={formData.klsId || 'No disponible'}
                            readOnly
                            className="w-full border border-slate-200 bg-slate-100 rounded-lg p-3 text-slate-600 outline-none"
                        />
                        {!formData.klsId && <p className="text-xs text-red-500 mt-1">Error: KLS ID no encontrado en la ficha.</p>}
                    </div>

                    {!['SDU', 'MDU'].includes(formData.activationType) && (
                        <>
                            <div className="space-y-3">
                                <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                                    <input
                                        type="checkbox"
                                        checked={formData.hasMoreClients}
                                        onChange={(e) => setFormData({ ...formData, hasMoreClients: e.target.checked })}
                                        className="w-5 h-5 text-green-600 rounded"
                                    />
                                    <span className="text-slate-700">¿Hay más clientes potenciales?</span>
                                </label>

                                <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                                    <input
                                        type="checkbox"
                                        checked={formData.taInstalled}
                                        onChange={(e) => setFormData({ ...formData, taInstalled: e.target.checked })}
                                        className="w-5 h-5 text-green-600 rounded"
                                    />
                                    <span className="text-slate-700">¿TA Instalado?</span>
                                </label>
                            </div>

                            {formData.activationType !== 'BP_2_FAM' && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">SP Instalados</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={formData.spInstalled}
                                        onChange={(e) => setFormData({ ...formData, spInstalled: e.target.value })}
                                        className="w-full border border-slate-300 rounded-lg p-3 outline-none"
                                    />
                                </div>
                            )}
                        </>
                    )}

                    {/* Photos Section */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Fotos</label>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                            {photos.map((photo, index) => (
                                <div
                                    key={index}
                                    onClick={() => setViewingPhotoIndex(index)}
                                    className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 group cursor-pointer hover:border-joa-blue transition-colors"
                                >
                                    <img src={photo.preview} alt="Preview" className="w-full h-full object-cover" />
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); removePhoto(index); }}
                                        className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            ))}

                            <div className="border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center p-4 hover:bg-slate-50 transition-colors cursor-pointer relative aspect-square">
                                <input
                                    type="file"
                                    multiple
                                    accept="image/*"
                                    onChange={handleFileChange}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                                <Camera className="text-slate-400 mb-2" size={24} />
                                <span className="text-xs text-slate-500 font-medium">Añadir Foto</span>
                            </div>
                        </div>
                    </div>

                    {/* PDF Document Section */}
                    {/* PDF Document Section */}
                    <div className={`p-4 rounded-xl border-2 ${pdfPath ? 'border-green-200 bg-green-50' : 'border-orange-200 bg-orange-50'}`}>
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-base font-bold text-slate-700 flex items-center gap-2">
                                <FileText size={20} className={pdfPath ? 'text-green-600' : 'text-orange-500'} />
                                Documentación GlasfaserPlus
                            </label>
                            {pdfPath ? (
                                <span className="text-xs text-green-700 font-bold bg-white px-2 py-1 rounded-full border border-green-200">¡Generado!</span>
                            ) : (
                                <span className="text-xs text-orange-700 font-bold bg-white px-2 py-1 rounded-full border border-orange-200">Pendiente</span>
                            )}
                        </div>
                        <p className="text-sm text-slate-600 mb-3">
                            {pdfPath
                                ? 'El documento ha sido generado. Puedes abrirlo para verificarlo o regenerarlo si han cambiado datos.'
                                : 'Es OBLIGATORIO generar y rellenar este documento antes de finalizar la activación.'}
                        </p>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={handleGeneratePdf}
                                className={`flex-1 py-3 font-bold rounded-lg transition-colors flex items-center justify-center gap-2 ${pdfPath
                                    ? 'bg-white border-2 border-green-500 text-green-700 hover:bg-green-50'
                                    : 'bg-orange-500 text-white hover:bg-orange-600 shadow-md'
                                    }`}
                            >
                                <FileText size={18} />
                                {pdfPath ? 'Abrir / Regenerar PDF' : 'Generar PDF Automático'}
                            </button>
                        </div>

                        <div className="mt-4 pt-4 border-t border-slate-200">
                            <label className="block text-sm font-medium text-slate-700 mb-2">Adjuntar PDF Firmado (Opcional si ya se envió)</label>
                            <div className="border-2 border-dashed border-slate-300 rounded-lg p-4 hover:bg-slate-50 transition-colors relative cursor-pointer">
                                <input
                                    type="file"
                                    accept=".pdf"
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    onChange={(e) => setSignedPdf(e.target.files[0])}
                                />
                                <div className="flex flex-col items-center justify-center text-slate-500">
                                    {signedPdf ? (
                                        <>
                                            <FileText size={24} className="text-joa-blue mb-1" />
                                            <span className="font-bold text-slate-700">{signedPdf.name}</span>
                                            <span className="text-xs text-green-600">Listo para enviar</span>
                                        </>
                                    ) : (
                                        <>
                                            <div className="mb-1 bg-slate-100 p-2 rounded-full">⬆️</div>
                                            <span className="font-bold">Subir PDF Firmado</span>
                                            <span className="text-xs">o arrastra el archivo aquí</span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={submitting}
                        className="w-full py-4 rounded-xl font-bold text-white bg-green-600 hover:bg-green-700 transition-all disabled:opacity-50"
                    >
                        {submitting ? 'Guardando...' : (selectedAppointment.status === 'COMPLETADO' ? 'Actualizar Activación' : 'Finalizar Activación')}
                    </button>
                </form>
            </div>

            {/* Photo Viewer Modal */}
            {viewingPhotoIndex !== null && photos[viewingPhotoIndex] && (
                <div
                    className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4"
                    onClick={() => setViewingPhotoIndex(null)}
                >
                    <button
                        onClick={() => setViewingPhotoIndex(null)}
                        className="absolute top-4 right-4 text-white hover:text-gray-300"
                    >
                        <X size={32} />
                    </button>

                    <img
                        src={photos[viewingPhotoIndex].preview}
                        alt="Full View"
                        className="max-w-full max-h-[80vh] object-contain rounded-lg mb-8"
                        onClick={(e) => e.stopPropagation()}
                    />

                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            removePhoto(viewingPhotoIndex);
                        }}
                        className="flex items-center gap-2 bg-red-600 text-white px-8 py-3 rounded-full font-bold shadow-lg hover:bg-red-700 transition transform active:scale-95"
                    >
                        <Trash2 size={20} /> Eliminar Foto
                    </button>
                </div>
            )}
        </div>
    );
};

export default ActivationPage;
