import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { CheckCircle, Camera, ArrowLeft, Calendar, MapPin, Trash2, X, FileText, PenTool } from 'lucide-react';
import SignaturePad from 'signature_pad';
import piexif from 'piexifjs';

const BASE_URL = import.meta.env.PROD ? window.location.origin : 'http://localhost:3000';

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
        mduInstalled: false,
        homeId: '',
        klsId: '',
        description: ''
    });

    const [pdfPath, setPdfPath] = useState(null);
    const [signatures, setSignatures] = useState({ client: null, tech: null });
    const [isSigning, setIsSigning] = useState('NONE'); // 'NONE' | 'CLIENT' | 'TECH'
    const [priceItems, setPriceItems] = useState([]);

    // Signature Refs
    const canvasRef = useRef(null);
    const signaturePadRef = useRef(null);

    const [photos, setPhotos] = useState([]); // Array of  { blob, preview, isExisting, originalPath }

    useEffect(() => {
        fetchAppointments();
    }, []);

    // PRE-REQUEST GPS PERMISSION on page load to avoid silent failures
    useEffect(() => {
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                () => console.log("GPS Permission Granted"),
                (err) => console.warn("GPS Permission Denied or Error:", err.message),
                { enableHighAccuracy: true, timeout: 5000 }
            );
        }
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
                    mduInstalled: info.mduInstalled || false,
                    homeId: info.homeIds && info.homeIds.length > 0 ? info.homeIds[0] : '',
                    klsId: info.klsId || selectedAppointment.address.klsId || '',
                    description: info.description || ''
                });

                setPdfPath(info.pdfPath || null);

                // Load existing photos
                if (info.photos && info.photos.length > 0) {
                    setPhotos(info.photos.map((path, i) => {
                        const cleanPath = path.replace(/\\/g, '/');
                        const encoded = cleanPath.split('/').map(segment => encodeURIComponent(segment)).join('/');
                        return {
                            blob: null,
                            preview: `${BASE_URL}/${encoded.replace(/^\/+/, '')}`,
                            isExisting: true,
                            originalPath: path
                        };
                    }));
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
                    mduInstalled: false,
                    homeId: '',
                    klsId: selectedAppointment.address.klsId || '',
                    description: ''
                });
                setPdfPath(null);
                setPhotos([]);
            }

            // Fetch dynamic concepts based on Client
            const fetchConcepts = async () => {
                let clientId = selectedAppointment.address?.project?.clientCompanyId;
                try {
                    let finalActivationItems = [];
                    
                    if (clientId) {
                        const pRes = await api.get(`/api/clients/${clientId}/price-items`);
                        finalActivationItems = pRes.data.filter(item => item.department === 'ACTIVATION');
                    }
                    
                    if (finalActivationItems.length === 0) {
                        const allClientsRes = await api.get('/api/clients');
                        const clientsWithItems = allClientsRes.data.filter(c => c.priceItems && c.priceItems.length > 0);
                        if (clientsWithItems.length > 0) {
                            finalActivationItems = clientsWithItems[0].priceItems.filter(item => item.department === 'ACTIVATION');
                        }
                    }

                    setPriceItems(finalActivationItems);

                    // Re-sync initially loaded custom activation name to the new combo values
                    const info = selectedAppointment.address.activationInfo;
                    if (!info || (!info.activationType && !info.customActivationName)) {
                        if (finalActivationItems.length > 0) {
                            setFormData(prev => ({ ...prev, activationType: finalActivationItems[0].name }));
                        }
                    } else if (info && info.customActivationName) {
                        setFormData(prev => ({ ...prev, activationType: info.customActivationName }));
                    }

                } catch(e) {
                    console.error("Error fetching priceItems in ActivationPage", e);
                }
            };
            fetchConcepts();
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

    const [processingPhotos, setProcessingPhotos] = useState(false);

    const processPhoto = async (file, gpsCoords = null) => {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error("Timeout processing photo")), 15000);
            const img = new Image();
            const objectUrl = URL.createObjectURL(file);

            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const MAX_DIM = 1600;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_DIM) { height *= MAX_DIM / width; width = MAX_DIM; }
                } else {
                    if (height > MAX_DIM) { width *= MAX_DIM / height; height = MAX_DIM; }
                }

                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);

                // Watermark logic
                const fontSize = Math.max(20, Math.floor(height * 0.035));
                const padding = fontSize;
                const lineHeight = fontSize * 1.4;
                const bottomBarHeight = lineHeight * 3 + padding * 2;

                ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
                ctx.fillRect(0, height - bottomBarHeight, width, bottomBarHeight);
                ctx.fillStyle = 'white';
                ctx.font = `bold ${fontSize}px Arial`;
                ctx.textBaseline = 'bottom';

                const dateStr = new Date().toLocaleString('es-ES');
                const userObj = JSON.parse(localStorage.getItem('user') || '{}');
                const techName = userObj.username?.split('@')[0] || 'Técnico';
                const addressStr = selectedAppointment ? `${selectedAppointment.address.street} ${selectedAppointment.address.number}${selectedAppointment.address.city ? ', ' + selectedAppointment.address.city : ''}` : 'Dirección';

                let textY = height - padding - lineHeight * 2;
                ctx.fillText(`📅 ${dateStr}`, padding, textY);
                textY += lineHeight;
                ctx.fillText(`👤 ${techName}`, padding, textY);
                textY += lineHeight;
                ctx.fillText(`📍 ${addressStr}`, padding, textY);

                const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                let finalBlob = null;

                try {
                    let processedDataUrl = dataUrl;
                    if (gpsCoords) {
                        const toRational = (decimal) => {
                            const abs = Math.abs(decimal);
                            const degrees = Math.floor(abs);
                            const minutesDecimal = (abs - degrees) * 60;
                            const minutes = Math.floor(minutesDecimal);
                            const seconds = Math.round((minutesDecimal - minutes) * 60 * 100);
                            return [[degrees, 1], [minutes, 1], [seconds, 100]];
                        };
                        const gps = {};
                        gps[piexif.GPSIFD.GPSLatitudeRef] = gpsCoords.lat >= 0 ? 'N' : 'S';
                        gps[piexif.GPSIFD.GPSLatitude] = toRational(gpsCoords.lat);
                        gps[piexif.GPSIFD.GPSLongitudeRef] = gpsCoords.lng >= 0 ? 'E' : 'W';
                        gps[piexif.GPSIFD.GPSLongitude] = toRational(gpsCoords.lng);
                        const exifObj = {"0th": {}, "Exif": {}, "GPS": gps};
                        processedDataUrl = piexif.insert(piexif.dump(exifObj), dataUrl);
                    }
                    const byteString = atob(processedDataUrl.split(',')[1]);
                    const ab = new ArrayBuffer(byteString.length);
                    const ia = new Uint8Array(ab);
                    for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
                    finalBlob = new Blob([ab], {type: 'image/jpeg'});
                } catch (e) {
                    console.error("EXIF error", e);
                    const byteString = atob(dataUrl.split(',')[1]);
                    const ab = new ArrayBuffer(byteString.length);
                    const ia = new Uint8Array(ab);
                    for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
                    finalBlob = new Blob([ab], {type: 'image/jpeg'});
                }

                clearTimeout(timeout);
                URL.revokeObjectURL(objectUrl);
                resolve({ blob: finalBlob, preview: URL.createObjectURL(finalBlob), isExisting: false, name: file.name });
            };
            img.onerror = () => { clearTimeout(timeout); URL.revokeObjectURL(objectUrl); reject(new Error("Img load fail")); };
            img.src = objectUrl;
        });
    };

    const handleFileChange = async (e) => {
        if (e.target.files && e.target.files.length > 0) {
            setProcessingPhotos(true);
            let gpsCoords = null;
            try {
                const pos = await new Promise((res, rej) => {
                    navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 5000 });
                });
                gpsCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            } catch (err) { console.warn("GPS fail", err); }

            const newPhotos = [];
            for (let i = 0; i < e.target.files.length; i++) {
                try {
                    const processed = await processPhoto(e.target.files[i], gpsCoords);
                    newPhotos.push(processed);
                } catch (err) { console.error(err); }
            }
            setPhotos([...photos, ...newPhotos]);
            setProcessingPhotos(false);
        }
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

    useEffect(() => {
        if (formData.activationType === 'SDU' && !formData.taInstalled) {
            setFormData(prev => ({ ...prev, taInstalled: true }));
        }
    }, [formData.activationType]);

    // Initialize Signature Pad when modal opens
    useEffect(() => {
        if (isSigning !== 'NONE' && canvasRef.current) {
            // Wait for modal transition/render
            const timer = setTimeout(() => {
                const canvas = canvasRef.current;
                if (!canvas) return;

                // High DPI adjustment
                const ratio = Math.max(window.devicePixelRatio || 1, 1);
                canvas.width = canvas.offsetWidth * ratio;
                canvas.height = canvas.offsetHeight * ratio;
                canvas.getContext("2d").scale(ratio, ratio);

                signaturePadRef.current = new SignaturePad(canvas, {
                    backgroundColor: 'rgba(255, 255, 255, 0)', // Transparent
                    penColor: 'rgb(0, 0, 0)'
                });
            }, 100);

            return () => clearTimeout(timer);
        }
    }, [isSigning]);

    const handleSignatureSave = async () => {
        if (!signaturePadRef.current || signaturePadRef.current.isEmpty()) {
            alert('Por favor, firme antes de continuar.');
            return;
        }

        const signatureData = signaturePadRef.current.toDataURL(); // Base64 png

        if (isSigning === 'CLIENT') {
            setSignatures(prev => ({ ...prev, client: signatureData }));
            signaturePadRef.current.clear();
            setIsSigning('TECH');
        } else if (isSigning === 'TECH') {
            const finalSignatures = {
                client: signatures.client,
                tech: signatureData
            };
            setSignatures(prev => ({ ...prev, tech: signatureData }));
            setIsSigning('NONE');

            // Trigger PDF Generation immediately with captured signatures
            await handleGeneratePdf(finalSignatures);
        }
    };

    const handleGeneratePdf = async (currentSignatures = null) => {
        if (!formData.klsId) {
            alert('Por favor, indica el KLS ID antes de generar el PDF.');
            return;
        }

        // Use passed signatures (from immediate flow) or state
        const sigs = currentSignatures || signatures;

        if (!sigs.client || !sigs.tech) {
            alert('Faltan las firmas. Por favor inicie el proceso de firma.');
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
                userPhone: user.phone || '',
                clientSignature: sigs.client,
                techSignature: sigs.tech
            };

            const res = await api.post('/api/activations/generate-pdf', payload);

            if (res.data.success) {
                setPdfPath(res.data.path);
                // alert('Documento generado y firmado correctamente.');
                // window.open(`${BASE_URL}/${res.data.path}`, '_blank');
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
        if (pdfPath) {
            data.append('pdfPath', pdfPath);
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
            const serverMsg = error.response?.data?.error || error.response?.data?.message || error.message;
            alert(`Error al enviar reporte: ${serverMsg}`);
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
                                onClick={() => {
                                    if (app.type === 'REPAIR') {
                                        navigate(`/repair/${app.id}/complete`);
                                    } else {
                                        setSelectedAppointment(app);
                                    }
                                }}
                                className={`bg-white p-6 rounded-xl shadow-sm border cursor-pointer hover:shadow-md transition-all ${app.status === 'COMPLETADO'
                                    ? 'border-green-500 bg-green-50'
                                    : 'border-slate-200 hover:border-green-400'
                                    }`}
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-2 text-blue-600 font-bold">
                                        <Calendar size={18} />
                                        {new Date(app.assignedDate).toLocaleDateString()} {new Date(app.assignedDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        {app.type === 'REPAIR' && <span className="bg-red-100 text-red-700 text-xs px-2 py-1 rounded-full border border-red-200 ml-2">AVERÍA</span>}
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
            <div className="bg-orange-100 text-orange-800 p-2 text-[10px] font-bold text-center rounded-lg border border-orange-200">
                ARCHIVO: ActivationPage.jsx (Técnico-Historial)
            </div>
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
                            className="w-full border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-green-500 outline-none font-bold text-slate-700"
                        >
                            {priceItems.length > 0 ? (
                                priceItems.map(item => (
                                    <option key={item.id} value={item.name}>
                                        {item.name}
                                    </option>
                                ))
                            ) : (
                                <option value="">No hay conceptos cargados - Revise DB</option>
                            )}
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

                    {formData.activationType === 'BR_MULTI' ? (
                        <div className="p-5 bg-purple-50 rounded-2xl border border-purple-100 space-y-4 shadow-sm animate-in fade-in slide-in-from-top-2">
                            <div className="flex items-center justify-between">
                                <h4 className="font-bold text-purple-700 text-sm uppercase tracking-wider">Desglose Multi (3 Partes)</h4>
                                <span className="bg-purple-100 text-purple-700 text-[10px] px-2 py-0.5 rounded-full font-bold">BP Incluido</span>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Cantidad de SP instaladas</label>
                                <input
                                    type="number"
                                    min="1"
                                    required
                                    value={formData.spInstalled}
                                    onChange={(e) => setFormData({ ...formData, spInstalled: parseInt(e.target.value) || 0 })}
                                    className="w-full border border-slate-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-purple-400 bg-white"
                                />
                                <p className="text-[10px] text-slate-500 mt-2 italic">Estas son las SP que se cobrarán al cliente.</p>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-3">Equipo de Red Adicional</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, taInstalled: true, mduInstalled: false })}
                                        className={`p-3 rounded-xl border font-bold text-sm transition-all ${formData.taInstalled ? 'bg-purple-600 border-purple-600 text-white shadow-lg shadow-purple-200 scale-[1.02]' : 'bg-white border-slate-200 text-slate-600 hover:border-purple-200'}`}
                                    >
                                        Incluye TA
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, mduInstalled: true, taInstalled: false })}
                                        className={`p-3 rounded-xl border font-bold text-sm transition-all ${formData.mduInstalled ? 'bg-purple-600 border-purple-600 text-white shadow-lg shadow-purple-200 scale-[1.02]' : 'bg-white border-slate-200 text-slate-600 hover:border-purple-200'}`}
                                    >
                                        Incluye MDU
                                    </button>
                                </div>
                                {(!formData.taInstalled && !formData.mduInstalled) && (
                                    <p className="text-[10px] text-red-500 mt-2 font-medium animate-pulse">Debes indicar si has instalado una TA o una MDU.</p>
                                )}
                            </div>
                        </div>
                    ) : (
                        !['SDU', 'MDU'].includes(formData.activationType) && (
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
                                        <span className="text-slate-700 font-medium">¿TA Instalado?</span>
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
                        )
                    )}

                    {/* Technician Comments */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Comentarios del Técnico</label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="Escribe aquí cualquier observación relevante..."
                            rows="3"
                            className="w-full border border-slate-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-green-500 resize-none"
                        ></textarea>
                    </div>

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

                            {/* Camera Button (Force Camera) */}
                            <div className="border-2 border-dashed border-blue-400 bg-blue-50/50 rounded-xl flex flex-col items-center justify-center p-4 hover:bg-blue-100 transition-colors cursor-pointer relative aspect-square">
                                <input
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    onChange={handleFileChange}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                                <Camera className="text-blue-600 mb-2" size={28} />
                                <div className="text-[10px] text-blue-700 font-extrabold uppercase text-center leading-tight">
                                    {processingPhotos ? 'Cargando...' : 'Hacer'}
                                    <br />
                                    {processingPhotos ? '' : 'Foto'}
                                </div>
                            </div>

                            {/* Gallery Button (Multiple) */}
                            <div className="border-2 border-dashed border-slate-300 bg-white rounded-xl flex flex-col items-center justify-center p-4 hover:bg-slate-50 transition-colors cursor-pointer relative aspect-square">
                                <input
                                    type="file"
                                    multiple
                                    accept="image/*"
                                    onChange={handleFileChange}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                                <FileText className="text-slate-500 mb-2" size={28} />
                                <div className="text-[10px] text-slate-600 font-extrabold uppercase text-center leading-tight">
                                    Galería
                                    <br />
                                    Varios
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* PDF Document Section */}
                    {/* PDF Document Section */}
                    <div className={`p-4 rounded-xl border-2 ${pdfPath ? 'border-green-200 bg-green-50' : 'border-blue-200 bg-blue-50'}`}>
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-base font-bold text-slate-700 flex items-center gap-2">
                                <FileText size={20} className={pdfPath ? 'text-green-600' : 'text-blue-500'} />
                                Firmas y Documentación V2
                            </label>
                            {pdfPath && (
                                <span className="text-xs text-green-700 font-bold bg-white px-2 py-1 rounded-full border border-green-200">¡Firmado!</span>
                            )}
                        </div>

                        {pdfPath ? (
                            <div className="space-y-4">
                                <p className="text-sm text-green-700">
                                    El documento ha sido generado y firmado digitalmente.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const cleanPath = pdfPath.split('?')[0];
                                        const encoded = cleanPath.split('/').map(segment => encodeURIComponent(segment)).join('/');
                                        const timestamp = pdfPath.includes('?t=') ? `?t=${pdfPath.split('?t=')[1]}` : '';
                                        const url = `${BASE_URL || window.location.origin}/${encoded}${timestamp}`;
                                        
                                        // PWA on Android often fails to open PDFs inline. We force a download strategy.
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.target = '_blank';
                                        a.download = cleanPath.split('/').pop() || 'Documento.pdf';
                                        document.body.appendChild(a);
                                        a.click();
                                        document.body.removeChild(a);
                                    }}
                                    className="w-full py-3 bg-white border-2 border-green-500 text-green-700 font-bold rounded-xl transition-all flex items-center justify-center gap-2 hover:bg-green-50"
                                >
                                    <FileText size={18} />
                                    Ver PDF Generado
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setPdfPath(null); setSignatures({ client: null, tech: null }); }}
                                    className="w-full py-2 text-slate-500 text-sm hover:text-red-500 transition-colors"
                                >
                                    Volver a firmar (Borrar actual)
                                </button>
                            </div>
                        ) : (
                            <div>
                                <p className="text-sm text-slate-600 mb-4">
                                    Se requiere la firma del cliente y del técnico.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => setIsSigning('CLIENT')}
                                    className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                                >
                                    <PenTool size={18} />
                                    Iniciar Proceso de Firma
                                </button>
                            </div>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={submitting}
                        className="w-full py-4 rounded-xl font-bold text-white bg-green-600 hover:bg-green-700 transition-all disabled:opacity-50"
                    >
                        {submitting ? 'Guardando...' : (selectedAppointment.status === 'COMPLETADO' ? 'Actualizar Activación' : 'Finalizar Activación')}
                    </button>
                </form>
                {/* Signature Modal */}
                {isSigning !== 'NONE' && (
                    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
                        <div className="bg-white w-full max-w-md rounded-2xl p-4 shadow-2xl">
                            <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2">
                                <div>
                                    <h3 className="text-xl font-bold text-slate-800">
                                        {isSigning === 'CLIENT' ? 'Firma del Cliente' : 'Firma del Técnico'}
                                    </h3>
                                    <p className="text-sm text-slate-500">
                                        {isSigning === 'CLIENT' ? 'Por favor, pida al cliente que firme.' : 'Firme usted para confirmar.'}
                                    </p>
                                </div>
                                <button onClick={() => setIsSigning('NONE')} className="text-slate-400 hover:text-slate-600">
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 touch-none overflow-hidden h-64 relative">
                                {/* Native Canvas */}
                                <canvas
                                    ref={canvasRef}
                                    className="w-full h-full touch-none"
                                ></canvas>
                                <div className="absolute bottom-2 right-2 text-[10px] text-slate-300 pointer-events-none">
                                    Área de Firma
                                </div>
                            </div>

                            <div className="flex gap-3 mt-4">
                                <button
                                    type="button"
                                    onClick={() => signaturePadRef.current?.clear()}
                                    className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors"
                                >
                                    Borrar / Corregir
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSignatureSave}
                                    className="flex-1 py-3 bg-joa-blue text-white font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
                                >
                                    {isSigning === 'CLIENT' ? 'Siguiente (Técnico)' : 'Finalizar y Generar'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            {viewingPhotoIndex !== null && photos[viewingPhotoIndex] && (
                <div
                    className="fixed inset-0 z-[9999] bg-slate-900/98 flex flex-col items-center justify-center p-2"
                >
                    <div className="absolute top-4 left-4 text-white/20 text-[10px] font-mono">v1.1-lightbox-history</div>
                    <button
                        onClick={() => setViewingPhotoIndex(null)}
                        className="absolute top-6 right-6 text-white p-3 bg-white/20 rounded-full hover:bg-white/40 active:scale-95 transition z-[10000]"
                    >
                        <X size={28} />
                    </button>

                    <div className="relative max-w-full max-h-[85vh] flex items-center justify-center">
                        <img
                            src={photos[viewingPhotoIndex].preview.startsWith('blob:') ? photos[viewingPhotoIndex].preview : `${photos[viewingPhotoIndex].preview}${photos[viewingPhotoIndex].preview.includes('?') ? '&' : '?'}cb=${Date.now()}`}
                            alt="Full View"
                            className="max-w-full max-h-[80vh] object-contain rounded shadow-2xl"
                        />
                    </div>

                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            removePhoto(viewingPhotoIndex);
                        }}
                        className="mt-6 flex items-center gap-2 bg-red-600/80 text-white px-8 py-3 rounded-full font-bold shadow-lg hover:bg-red-700 transition transform active:scale-95"
                    >
                        <Trash2 size={20} /> Eliminar Foto
                    </button>
                </div>
            )}
        </div>
    );
};

export default ActivationPage;
