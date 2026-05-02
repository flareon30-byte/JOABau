import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { Camera, Save, ArrowLeft, Trash2, X, AlertTriangle } from 'lucide-react';

const RepairCompletionPage = () => {
    const { id } = useParams(); // Start with appointment ID or Address ID? Usually Appointment ID for routing, but backend needs Address ID or Appt ID.
    // In ActivationPageV2, route is /activation/:id/complete where :id is Appointment ID.

    const navigate = useNavigate();
    const [appointment, setAppointment] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // Form State
    const [description, setDescription] = useState('');
    const [photos, setPhotos] = useState([]);
    const [viewingPhotoIndex, setViewingPhotoIndex] = useState(null);
    const fileInputRef = useRef(null);

    useEffect(() => {
        const fetchAppointment = async () => {
            try {
                // We can use the same endpoint as dashboard to find the appointment by ID
                // Or a specific endpoint. Let's use the one that fetches user's appointments if possible, 
                // or just fetch by ID if we have an endpoint. 
                // Since we don't have a direct "get appointment by id" endpoint exposed universally, 
                // we might need to iterate or add one.
                // ActivationPage uses /api/dashboard/activator which returns list.
                // Issues might be assigned to anyone.
                // Let's try to fetch all my appointments and find it.

                const res = await api.get('/api/dashboard/activator'); // This endpoints returns appointments for the team.
                const found = res.data.appointments.find(a => a.id === id);

                if (found) {
                    setAppointment(found);
                    if (found.comments && found.comments.length > 0) {
                        // Pre-fill description if exists? No, usually start fresh or append.
                    }
                } else {
                    // Try another endpoint if not found? 
                    // Maybe it's not an "activator" dashboard item but generic.
                    // Let's assume it works for now as repairs are assigned to teams.
                    console.error('Appointment not found in current list');
                }
            } catch (error) {
                console.error('Error fetching appointment:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchAppointment();
    }, [id]);

    const processPhoto = async (file) => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    ctx.drawImage(img, 0, 0);

                    // Simple Watermark
                    const fontSize = Math.max(24, Math.floor(img.height * 0.03));
                    ctx.font = `bold ${fontSize}px Arial`;
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                    ctx.strokeStyle = 'black';
                    ctx.lineWidth = 2;

                    const text = `REPARACIÓN - ${new Date().toLocaleDateString()}`;
                    ctx.strokeText(text, 20, img.height - 20);
                    ctx.fillText(text, 20, img.height - 20);

                    canvas.toBlob((blob) => {
                        resolve({
                            blob,
                            preview: canvas.toDataURL('image/jpeg', 0.7),
                            name: file.name
                        });
                    }, 'image/jpeg', 0.8);
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    };

    const handlePhotoSelect = async (e) => {
        if (e.target.files && e.target.files.length > 0) {
            const newPhotos = [];
            for (let i = 0; i < e.target.files.length; i++) {
                const processed = await processPhoto(e.target.files[i]);
                newPhotos.push(processed);
            }
            setPhotos(prev => [...prev, ...newPhotos]);
        }
    };

    const removePhoto = (index) => {
        setPhotos(prev => prev.filter((_, i) => i !== index));
        if (viewingPhotoIndex === index) setViewingPhotoIndex(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!appointment) return;
        if (!description.trim()) {
            alert("Por favor, describe qué reparación se realizó.");
            return;
        }

        setSubmitting(true);

        const data = new FormData();
        data.append('description', description);

        photos.forEach((photo, index) => {
            data.append('photos', photo.blob, `repair_${index}.jpg`);
        });

        try {
            // Using addressId from appointment
            await api.post(`/api/issues/repair/${appointment.addressId}`, data, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            navigate('/dashboard');
        } catch (error) {
            console.error('Error submitting repair:', error);
            alert('Error al guardar la reparación. ' + (error.response?.data?.message || ''));
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="p-8 text-center bg-slate-50 min-h-screen pt-20">Cargando...</div>;
    if (!appointment) return <div className="p-8 text-center text-red-500 bg-slate-50 min-h-screen pt-20">Cita no encontrada o no tienes permisos.</div>;

    return (
        <div className="min-h-screen bg-slate-50 pb-20">
            {/* Header */}
            <div className="bg-white p-4 shadow-sm sticky top-0 z-10 flex items-center gap-4 border-b border-red-100">
                <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-full">
                    <ArrowLeft size={24} className="text-slate-600" />
                </button>
                <div>
                    <h1 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <AlertTriangle className="text-red-500" size={20} />
                        Finalizar Reparación
                    </h1>
                    <p className="text-xs text-slate-500">{appointment.address.street} {appointment.address.number}</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-6 max-w-lg mx-auto">
                <div className="p-4 bg-purple-50 rounded-2xl border border-purple-100 flex items-center justify-between shadow-sm">
                    <div>
                        <p className="text-[10px] font-black text-purple-400 uppercase tracking-widest mb-1">Identificador de Armario</p>
                        <h3 className="text-xl font-black text-purple-700 leading-none">
                            NVT: {appointment.address.nvt || 'Sin asignar'}
                        </h3>
                    </div>
                    <div className="bg-purple-600 p-2 rounded-lg text-white">
                        <AlertTriangle size={18} />
                    </div>
                </div>
                {/* Orientation Comment Alert */}
                {appointment?.orientationComment && (
                    <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex gap-3 shadow-sm">
                        <div className="text-blue-500 mt-0.5">
                            <AlertTriangle size={20} className="text-blue-500" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-1">Nota del Back Office</p>
                            <p className="text-sm font-medium text-blue-900 whitespace-pre-wrap leading-snug">{appointment.orientationComment}</p>
                        </div>
                    </div>
                )}

                {/* Information Card */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                    <h3 className="text-sm font-bold text-slate-500 uppercase mb-2">Detalles del problema</h3>
                    <div className="p-3 bg-red-50 rounded-lg text-red-800 text-sm border border-red-100">
                        {appointment.comments && appointment.comments.length > 0
                            ? appointment.comments[0].content
                            : 'Sin descripción previa.'}
                    </div>
                </div>

                {/* Description Input */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
                    <h3 className="font-bold text-slate-800 border-b border-slate-100 pb-2">Solución Aplicada</h3>
                    <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">Descripción de la reparación *</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows="4"
                            placeholder="Describe qué se reparó (ej: cambio de router, fusión nueva, etc)..."
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-joa-blue resize-none"
                            required
                        ></textarea>
                    </div>
                </div>

                {/* Photos */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                        <h3 className="font-bold text-slate-800">Fotos de la Reparación</h3>
                        <span className="text-xs text-slate-400">{photos.length} fotos</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
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

                        {/* Camera Button (Force Camera) */}
                        <div className="border-2 border-dashed border-blue-400 bg-blue-50/50 rounded-xl flex flex-col items-center justify-center p-4 hover:bg-blue-100 transition-colors cursor-pointer relative aspect-square">
                            <input
                                type="file"
                                accept="image/*"
                                capture="environment"
                                onChange={handlePhotoSelect}
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
                                onChange={handlePhotoSelect}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                            <div className="w-7 h-7 bg-slate-100 rounded-full flex items-center justify-center mb-2">
                                <span className="text-slate-400 text-lg">+</span>
                            </div>
                            <div className="text-[10px] text-slate-600 font-extrabold uppercase text-center leading-tight">
                                Galería
                                <br />
                                Varios
                            </div>
                        </div>
                    </div>
                </div>

                {/* Submit Button */}
                <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-4 bg-joa-blue text-white font-bold rounded-xl shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {submitting ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    ) : (
                        <>
                            <Save size={20} />
                            Finalizar Avería
                        </>
                    )}
                </button>
            </form>

            {/* Photo Viewer Modal */}
            {viewingPhotoIndex !== null && photos[viewingPhotoIndex] && (
                <div
                    className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4"
                    onClick={() => setViewingPhotoIndex(null)}
                >
                    <button
                        onClick={() => setViewingPhotoIndex(null)}
                        className="absolute top-4 right-4 text-white p-2 bg-white/10 rounded-full hover:bg-white/20 transition"
                    >
                        <X size={24} />
                    </button>
                    <img
                        src={photos[viewingPhotoIndex].preview}
                        alt="Full viewing"
                        className="max-h-[75vh] object-contain rounded-lg shadow-2xl"
                    />
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            removePhoto(viewingPhotoIndex);
                        }}
                        className="mt-6 flex items-center gap-2 bg-red-600 text-white px-8 py-3 rounded-full font-bold shadow-lg hover:bg-red-700 transition"
                    >
                        <Trash2 size={20} /> Eliminar Foto
                    </button>
                </div>
            )}
        </div>
    );
};

export default RepairCompletionPage;
