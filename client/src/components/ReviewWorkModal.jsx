import React, { useState } from 'react';
import { X, Upload, CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import api from '../api/axios';

const ReviewWorkModal = ({ isOpen, onClose, work, user, onSaved }) => {
    const [loading, setLoading] = useState(false);
    const [photos, setPhotos] = useState([]);
    const [comments, setComments] = useState('');
    const [error, setError] = useState('');
    const [aiResult, setAiResult] = useState(null); // Stores AI distance + coordinates
    
    // For Reviewer
    const [incorrectPhotos, setIncorrectPhotos] = useState([]);
    const [reviewComments, setReviewComments] = useState('');

    if (!isOpen || !work) return null;

    const isSubcontractor = user.role === 'SUBCONTRACTOR' || user.subcontractorId;
    const isManager = ['SUPER_ADMIN', 'ADMIN', 'PROJECT_MANAGER', 'SITE_MANAGER'].includes(user.role);

    const handlePhotoUpload = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;
        setLoading(true);
        setError('');
        try {
            const formData = new FormData();
            files.forEach(file => {
                formData.append('photos', file);
            });
            
            const res = await api.post('/api/uploads', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            
            if (res.data && res.data.urls) {
                setPhotos(prev => [...prev, ...res.data.urls]);
            }
        } catch (err) {
            setError('Error al subir fotos. Asegúrate de estar conectado.');
        } finally {
            setLoading(false);
        }
    };

    const handleRemovePhoto = (index) => {
        setPhotos(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmitWork = async () => {
        if (photos.length < 2) {
            setError('Se requieren al menos 2 fotos para documentar la tarea.');
            return;
        }
        setLoading(true);
        try {
            // Get AI Distance + GPS coordinates
            let distance = null;
            let actualCoordinates = null;
            try {
                const aiRes = await api.post('/api/ai/process-duct-route', { photos, comments });
                if (aiRes.data) {
                    distance = aiRes.data.distance || null;
                    actualCoordinates = aiRes.data.coordinates || null;
                    setAiResult(aiRes.data);
                }
            } catch (aiErr) {
                console.warn('AI processing failed, submitting without distance', aiErr);
            }

            await api.post(`/api/planning/${work.id}/submit`, {
                photos,
                distance,
                actualCoordinates,
                comments
            });
            onSaved();
            onClose();
        } catch (err) {
            setError('Error al enviar el trabajo para revisión.');
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async () => {
        setLoading(true);
        try {
            await api.post(`/api/planning/${work.id}/approve`);
            onSaved();
            onClose();
        } catch (err) {
            setError('Error al aprobar el trabajo.');
        } finally {
            setLoading(false);
        }
    };

    const handleReject = async () => {
        if (incorrectPhotos.length === 0 && !reviewComments) {
            setError('Por favor indica qué fotos están mal o añade un comentario.');
            return;
        }
        setLoading(true);
        try {
            await api.post(`/api/planning/${work.id}/reject`, { incorrectPhotos, reviewComments });
            onSaved();
            onClose();
        } catch (err) {
            setError('Error al rechazar el trabajo.');
        } finally {
            setLoading(false);
        }
    };

    const toggleIncorrectPhoto = (url) => {
        if (incorrectPhotos.includes(url)) {
            setIncorrectPhotos(prev => prev.filter(p => p !== url));
        } else {
            setIncorrectPhotos(prev => [...prev, url]);
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
                    <div>
                        <h2 className="text-lg font-bold text-slate-800">
                            {isSubcontractor ? 'Justificar Trabajo' : 'Revisar Trabajo'}
                        </h2>
                        <p className="text-xs text-slate-500">{work.type.replace('_', ' ')} - ID: {work.id.substring(0,8)}</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg flex items-center gap-2 text-sm">
                            <AlertCircle className="w-4 h-4" />
                            {error}
                        </div>
                    )}

                    {/* Subcontractor Upload View */}
                    {isSubcontractor && (work.status === 'PENDING' || work.status === 'RETURNED' || work.status === 'ASSIGNED') && (
                        <div className="space-y-4">
                            {work.status === 'RETURNED' && work.reviewComments && (
                                <div className="p-4 bg-red-50 border border-red-100 rounded-xl">
                                    <h4 className="text-red-800 font-bold text-sm mb-1">Motivo de Rechazo:</h4>
                                    <p className="text-sm text-red-600">{work.reviewComments}</p>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Fotos de Evidencia</label>
                                <div className="grid grid-cols-3 sm:grid-cols-4 gap-4 mb-4">
                                    {photos.map((url, idx) => (
                                        <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 group">
                                            <img src={url} alt="Evidencia" className="w-full h-full object-cover" />
                                            <button 
                                                onClick={() => handleRemovePhoto(idx)}
                                                className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ))}
                                    <label className="aspect-square rounded-xl border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50 transition-colors flex flex-col items-center justify-center cursor-pointer text-slate-500 hover:text-blue-500">
                                        {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Upload className="w-6 h-6 mb-1" />}
                                        <span className="text-xs font-medium">Subir</span>
                                        <input type="file" multiple accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={loading} />
                                    </label>
                                </div>
                                <p className="text-xs text-slate-500">La IA necesita al menos 2 fotos con GPS para calcular la distancia.</p>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Comentarios Adicionales (Opcional)</label>
                                <textarea
                                    value={comments}
                                    onChange={(e) => setComments(e.target.value)}
                                    className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-none h-24"
                                    placeholder="Añade algún comentario sobre la ejecución..."
                                />
                            </div>

                            <button
                                onClick={handleSubmitWork}
                                disabled={loading || photos.length < 2}
                                className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                            >
                                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                                Enviar a Revisión
                            </button>
                        </div>
                    )}

                    {/* Manager Review View */}
                    {isManager && work.status === 'PENDING_REVISION' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                                    <p className="text-xs font-bold text-slate-500 uppercase">Distancia Calculada (IA)</p>
                                    <p className="text-lg font-bold text-slate-800">{work.distance ? `${work.distance}m` : 'N/A'}</p>
                                </div>
                                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                                    <p className="text-xs font-bold text-slate-500 uppercase">Subcontrata</p>
                                    <p className="text-sm font-bold text-slate-800">{work.assignedTo?.name || 'N/A'}</p>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    Fotos Subidas <span className="text-xs font-normal text-slate-500">(Clicka en las incorrectas si vas a rechazar)</span>
                                </label>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                    {work.photos?.map((url, idx) => (
                                        <div 
                                            key={idx} 
                                            onClick={() => toggleIncorrectPhoto(url)}
                                            className={`relative aspect-square rounded-xl overflow-hidden cursor-pointer transition-all ${incorrectPhotos.includes(url) ? 'border-4 border-red-500 scale-95 opacity-80' : 'border border-slate-200 hover:border-blue-500'}`}
                                        >
                                            <img src={url} alt="Evidencia" className="w-full h-full object-cover" />
                                            {incorrectPhotos.includes(url) && (
                                                <div className="absolute inset-0 flex items-center justify-center bg-red-500/20">
                                                    <XCircle className="w-8 h-8 text-red-500 bg-white rounded-full" />
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Comentarios de Rechazo (si aplica)</label>
                                <textarea
                                    value={reviewComments}
                                    onChange={(e) => setReviewComments(e.target.value)}
                                    className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none resize-none h-24"
                                    placeholder="Indica qué deben corregir..."
                                />
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={handleReject}
                                    disabled={loading || (incorrectPhotos.length === 0 && !reviewComments)}
                                    className="flex-1 py-3 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 disabled:opacity-50 font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                                >
                                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-5 h-5" />}
                                    Rechazar
                                </button>
                                <button
                                    onClick={handleApprove}
                                    disabled={loading}
                                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                                >
                                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                                    Aprobar Trabajo
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Waiting View */}
                    {(isSubcontractor && work.status === 'PENDING_REVISION') && (
                        <div className="py-12 text-center text-slate-500 flex flex-col items-center">
                            <Loader2 className="w-12 h-12 mb-4 animate-spin text-blue-500" />
                            <p className="font-semibold text-slate-700">Trabajo en Revisión</p>
                            <p className="text-sm">El jefe de proyecto está revisando tus evidencias.</p>
                        </div>
                    )}
                    {(isManager && work.status === 'PENDING') && (
                        <div className="py-12 text-center text-slate-500 flex flex-col items-center">
                            <AlertCircle className="w-12 h-12 mb-4 text-slate-400" />
                            <p className="font-semibold text-slate-700">Pendiente de Subcontrata</p>
                            <p className="text-sm">La subcontrata aún no ha subido las evidencias.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ReviewWorkModal;
