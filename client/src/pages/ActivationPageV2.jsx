import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { Camera, Save, ArrowLeft, Trash2, X, FileText, PenTool } from 'lucide-react';
import SignaturePad from 'signature_pad';

const BASE_URL = import.meta.env.PROD ? '' : 'http://localhost:3000';

const ActivationPageV2 = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [appointment, setAppointment] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [viewingPhotoIndex, setViewingPhotoIndex] = useState(null);

    // Form State
    const [formData, setFormData] = useState({
        activationType: 'BP',
        familiesCount: 1,
        apPorts: '2',
        hasMoreClients: false,
        taInstalled: false,
        taCount: '',
        spInstalled: '',
        mduInstalled: false, // New
        isRepair: false,     // New
        homeId: '',
        klsId: '',
        description: ''
    });

    const [pdfPath, setPdfPath] = useState(null);
    const [signatures, setSignatures] = useState({ client: null, tech: null });
    const [isSigning, setIsSigning] = useState('NONE'); // 'NONE' | 'CLIENT' | 'TECH'

    // Signature Refs
    const canvasRef = useRef(null);
    const signaturePadRef = useRef(null);

    const [photos, setPhotos] = useState([]);
    const fileInputRef = useRef(null);
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    useEffect(() => {
        const fetchAppointment = async () => {
            try {
                const res = await api.get('/api/dashboard/activator');
                const found = res.data.appointments.find(a => a.id === id);
                if (found) {
                    setAppointment(found);

                    // Pre-fill form if activation info exists
                    if (found.address.activationInfo) {
                        const info = found.address.activationInfo;
                        console.log('Pre-filling with info:', info);
                        setFormData({
                            activationType: info.activationType || 'BP',
                            familiesCount: info.familiesCount || 1,
                            apPorts: info.apPorts ? String(info.apPorts) : '2',
                            hasMoreClients: info.hasMoreClients || false,
                            spInstalled: info.spInstalled || '',
                            taInstalled: info.taInstalled || false,
                            taCount: info.taCount || '',
                            mduInstalled: info.mduInstalled || false,
                            isRepair: info.isRepair || false,
                            homeId: info.homeIds && info.homeIds.length > 0 ? info.homeIds[0] : '',
                            klsId: info.klsId || found.address.klsId || '',
                            description: info.description || ''
                        });

                        setPdfPath(info.pdfPath || null);

                        // Load existing photos
                        if (info.photos && info.photos.length > 0) {
                            setPhotos(info.photos.map((path, i) => ({
                                blob: null,
                                preview: `${BASE_URL}/${path.replace(/\\/g, '/')}`,
                                name: `Foto ${i + 1}`,
                                isExisting: true,
                                originalPath: path
                            })));
                        }
                    } else if (found.address.klsId) {
                        setFormData(prev => ({ ...prev, klsId: found.address.klsId }));
                    }
                } else {
                    console.error('Appointment not found');
                }
            } catch (error) {
                console.error('Error fetching appointment:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchAppointment();
    }, [id]);

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

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const processPhoto = async (file) => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');

                    // Resize to a maximum dimension to avoid massive files
                    const MAX_DIM = 2000;
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

                    // Draw image
                    ctx.drawImage(img, 0, 0, width, height);

                    // Watermark Settings
                    const fontSize = Math.max(24, Math.floor(img.height * 0.03)); // Responsive font size
                    const padding = fontSize;
                    const lineHeight = fontSize * 1.5;
                    const bottomBarHeight = lineHeight * 3 + padding * 2;

                    // Draw semi-transparent background
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
                    ctx.fillRect(0, img.height - bottomBarHeight, img.width, bottomBarHeight);

                    // Draw Text
                    ctx.fillStyle = 'white';
                    ctx.font = `bold ${fontSize}px Arial`;
                    ctx.textBaseline = 'bottom';

                    const dateStr = new Date().toLocaleString('es-ES');
                    const techName = user.username?.split('@')[0] || 'Técnico';
                    const addressStr = appointment ? `${appointment.address.street} ${appointment.address.number}, ${appointment.address.project.name}` : 'Dirección desconocida';

                    const textX = padding;
                    let textY = img.height - padding - lineHeight * 2;

                    ctx.fillText(`📅 ${dateStr}`, textX, textY);
                    textY += lineHeight;
                    ctx.fillText(`👤 ${techName}`, textX, textY);
                    textY += lineHeight;
                    ctx.fillText(`📍 ${addressStr}`, textX, textY);

                    // Convert to Blob
                    canvas.toBlob((blob) => {
                        resolve({
                            blob,
                            preview: canvas.toDataURL('image/jpeg', 0.7),
                            name: file.name
                        });
                    }, 'image/jpeg', 0.6);
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
        // Validate mandatory fields
        if (!formData.activationType) {
            alert('Por favor, selecciona un tipo de activación.');
            return;
        }

        const klsIdToUse = formData.klsId || appointment.address.klsId;

        if (!klsIdToUse) {
            alert('Por favor, indica o verifica el KLS ID antes de generar el PDF.');
            return;
        }

        // Use passed signatures (from immediate flow) or state (if retrying - though retry usually clears)
        const sigs = currentSignatures || signatures;

        if (!sigs.client || !sigs.tech) {
            alert('Faltan las firmas. Por favor inicie el proceso de firma.');
            return;
        }

        try {
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            const payload = {
                addressId: appointment.addressId,
                clientName: appointment.clientName || appointment.address.clientName,
                street: appointment.address.street,
                number: appointment.address.number,
                city: appointment.address.city,
                klsId: klsIdToUse,
                username: user.username,
                userPhone: user.phone || '',
                clientSignature: sigs.client,
                techSignature: sigs.tech
            };

            setLoading(true);
            const res = await api.post('/api/activations/generate-pdf', payload);

            if (res.data.success) {
                setPdfPath(res.data.path);
                // alert('Documento generado y firmado correctamente.');
            }
        } catch (error) {
            console.error('Error creating PDF:', error);
            alert('Error al generar el PDF. ' + (error.response?.data?.message || ''));
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!appointment) return;

        setSubmitting(true);

        const data = new FormData();
        data.append('activationType', formData.activationType);
        // Ensure numeric fields are valid
        data.append('familiesCount', parseInt(formData.familiesCount) || 1);
        data.append('apPorts', parseInt(formData.apPorts) || 2);
        data.append('taCount', parseInt(formData.taCount) || 0);
        data.append('spInstalled', parseInt(formData.spInstalled) || 0);

        data.append('taInstalled', formData.taInstalled);
        data.append('mduInstalled', formData.mduInstalled);
        data.append('isRepair', formData.isRepair);
        data.append('homeIds', JSON.stringify([formData.homeId]));
        data.append('klsId', formData.klsId);
        data.append('description', formData.description);

        if (pdfPath) {
            data.append('pdfPath', pdfPath);
        }

        // Separate existing photos from new photos
        const existingPaths = [];
        photos.forEach((photo, index) => {
            if (photo.isExisting && photo.originalPath) {
                existingPaths.push(photo.originalPath);
            } else if (photo.blob) {
                data.append('photos', photo.blob, `photo_${index}.jpg`);
            }
        });

        data.append('existingPhotos', JSON.stringify(existingPaths));

        try {
            await api.post(`/api/activations/report/${appointment.addressId}`, data, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            navigate('/dashboard');
        } catch (error) {
            console.error('Error submitting activation:', error);
            const serverMsg = error.response?.data?.message || error.message;
            alert('Error al guardar la activación: ' + serverMsg);
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="p-8 text-center bg-slate-50 min-h-screen pt-20">Cargando...</div>;
    if (!appointment) return <div className="p-8 text-center text-red-500 bg-slate-50 min-h-screen pt-20">Cita no encontrada.</div>;

    return (
        <div className="min-h-screen bg-slate-50 pb-20">
            {/* Header */}
            <div className="bg-white p-4 shadow-sm sticky top-0 z-10 flex items-center gap-4">
                <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-full">
                    <ArrowLeft size={24} className="text-slate-600" />
                </button>
                <div>
                    <h1 className="text-lg font-bold text-slate-800">Finalizar Activación (V2)</h1>
                    <p className="text-xs text-slate-500">{appointment.address.street} {appointment.address.number}</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-6 max-w-lg mx-auto">

                {/* Technical Details */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
                    <h3 className="font-bold text-slate-800 border-b border-slate-100 pb-2">Detalles Técnicos y Facturación</h3>

                    <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">Tipo de Activación (Base)</label>
                        <select
                            name="activationType"
                            value={formData.activationType}
                            onChange={handleInputChange}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-joa-blue"
                        >
                            <option value="BP">BP (Básico)</option>
                            <option value="BP_2_FAM">BP 2 Familias</option>
                            <option value="BR_MULTI">SP (BR Multi)</option>
                            <option value="SDU">SDU</option>
                            <option value="MDU">MDU</option>
                        </select>
                    </div>

                    {!['SDU', 'MDU'].includes(formData.activationType) && (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">Cant. Familias</label>
                                <input
                                    type="number"
                                    name="familiesCount"
                                    value={formData.familiesCount}
                                    onChange={handleInputChange}
                                    min="1"
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-joa-blue"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">Puertos AP</label>
                                <input
                                    type="number"
                                    name="apPorts"
                                    value={formData.apPorts}
                                    onChange={handleInputChange}
                                    placeholder="2"
                                    min="1"
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-joa-blue"
                                />
                            </div>

                            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                                <input
                                    type="checkbox"
                                    name="hasMoreClients"
                                    checked={formData.hasMoreClients}
                                    onChange={handleInputChange}
                                    id="moreClientsCheck"
                                    className="w-5 h-5 text-joa-blue rounded focus:ring-joa-blue"
                                />
                                <label htmlFor="moreClientsCheck" className="text-sm font-medium text-slate-700 flex-1">
                                    ¿Hay más clientes potenciales?
                                </label>
                            </div>

                            {/* BR_MULTI Specific Logic */}
                            {formData.activationType === 'BR_MULTI' ? (
                                <div className="p-5 bg-purple-50 rounded-2xl border border-purple-100 space-y-4 shadow-sm">
                                    <div className="flex items-center justify-between">
                                        <h4 className="font-bold text-purple-700 text-sm uppercase tracking-wider">Desglose Multi (3 Partes)</h4>
                                        <span className="bg-purple-100 text-purple-700 text-[10px] px-2 py-0.5 rounded-full font-bold">BP Incluido</span>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Cantidad de SP instaladas</label>
                                        <input
                                            type="number"
                                            name="spInstalled"
                                            min="1"
                                            required
                                            value={formData.spInstalled}
                                            onChange={handleInputChange}
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
                                                className={`p-3 rounded-xl border font-bold text-sm transition-all ${formData.taInstalled ? 'bg-purple-600 border-purple-600 text-white shadow-lg' : 'bg-white border-slate-200 text-slate-600'}`}
                                            >
                                                Incluye TA
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setFormData({ ...formData, mduInstalled: true, taInstalled: false })}
                                                className={`p-3 rounded-xl border font-bold text-sm transition-all ${formData.mduInstalled ? 'bg-purple-600 border-purple-600 text-white shadow-lg' : 'bg-white border-slate-200 text-slate-600'}`}
                                            >
                                                Incluye MDU
                                            </button>
                                        </div>
                                        {(!formData.taInstalled && !formData.mduInstalled) && (
                                            <p className="text-[10px] text-red-500 mt-1 font-medium italic">Debes indicar si has instalado una TA o una MDU.</p>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {/* ITEM: TA / SDU */}
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                                            <input
                                                type="checkbox"
                                                name="taInstalled"
                                                checked={formData.taInstalled}
                                                onChange={handleInputChange}
                                                id="taCheck"
                                                className="w-5 h-5 text-joa-blue rounded focus:ring-joa-blue"
                                            />
                                            <label htmlFor="taCheck" className="text-sm font-medium text-slate-700 flex-1">
                                                ¿Se instaló TA / SDU?
                                            </label>
                                        </div>
                                        {formData.taInstalled && (
                                            <div className="pl-4 border-l-2 border-slate-200 animate-fadeIn">
                                                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Cantidad de TA</label>
                                                <input
                                                    type="number"
                                                    name="taCount"
                                                    value={formData.taCount}
                                                    onChange={handleInputChange}
                                                    placeholder="1"
                                                    className="w-full p-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-joa-blue"
                                                />
                                            </div>
                                        )}
                                    </div>

                                    {/* ITEM: SP */}
                                    {formData.activationType !== 'BP_2_FAM' && (
                                        <div>
                                            <label className="block text-sm font-medium text-slate-600 mb-1">Cantidad de SP Instalados</label>
                                            <input
                                                type="number"
                                                name="spInstalled"
                                                value={formData.spInstalled}
                                                onChange={handleInputChange}
                                                placeholder="0"
                                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-joa-blue"
                                            />
                                        </div>
                                    )}

                                    {/* ITEM: MDU Extra */}
                                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                                        <input
                                            type="checkbox"
                                            name="mduInstalled"
                                            checked={formData.mduInstalled}
                                            onChange={handleInputChange}
                                            id="mduCheck"
                                            className="w-5 h-5 text-joa-blue rounded focus:ring-joa-blue"
                                        />
                                        <label htmlFor="mduCheck" className="text-sm font-medium text-slate-700 flex-1">
                                            ¿Se instaló MDU / Multi Extra?
                                        </label>
                                    </div>

                                    {/* ITEM: Avería */}
                                    <div className="flex items-center gap-3 p-3 bg-red-50 rounded-xl border border-red-200">
                                        <input
                                            type="checkbox"
                                            name="isRepair"
                                            checked={formData.isRepair}
                                            onChange={handleInputChange}
                                            id="repairCheck"
                                            className="w-5 h-5 text-red-600 rounded focus:ring-red-600"
                                        />
                                        <label htmlFor="repairCheck" className="text-sm font-medium text-red-700 flex-1">
                                            ¿Es una Avería Facturable?
                                        </label>
                                    </div>
                                </>
                            )}
                        </>
                    )}
                </div>

                {/* Client Info */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
                    <h3 className="font-bold text-slate-800 border-b border-slate-100 pb-2">Información del Cliente</h3>

                    <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">HOME ID</label>
                        <input
                            type="text"
                            name="homeId"
                            value={formData.homeId}
                            onChange={handleInputChange}
                            placeholder="Ej: H-123456"
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-joa-blue font-mono"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">Descripción del Trabajo</label>
                        <textarea
                            name="description"
                            value={formData.description}
                            onChange={handleInputChange}
                            rows="3"
                            placeholder="Detalles adicionales..."
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-joa-blue resize-none"
                        ></textarea>
                    </div>
                </div>

                {/* Signatures & PDF Section */}
                <div className={`p-6 rounded-2xl shadow-sm border-2 ${pdfPath ? 'border-green-200 bg-green-50' : 'border-blue-200 bg-blue-50'}`}>
                    <div className="flex justify-between items-center mb-4">
                        <label className="text-base font-bold text-slate-700 flex items-center gap-2">
                            <FileText size={20} className={pdfPath ? 'text-green-600' : 'text-blue-500'} />
                            Firmas y Documentación
                        </label>
                        {pdfPath && (
                            <span className="text-xs text-green-700 font-bold bg-white px-3 py-1 rounded-full border border-green-200 shadow-sm">¡Firmado y Generado!</span>
                        )}
                    </div>

                    <div className="mb-4">
                        <label className="block text-sm font-medium text-slate-600 mb-1">KLS ID (Para el PDF)</label>
                        <input
                            type="text"
                            name="klsId"
                            value={formData.klsId}
                            onChange={handleInputChange}
                            placeholder="KLS ID"
                            className="w-full p-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-joa-blue"
                        />
                    </div>

                    {pdfPath ? (
                        <div className="space-y-4">
                            <p className="text-sm text-green-700">
                                El documento ha sido generado y firmado digitalmente.
                            </p>
                            <button
                                type="button"
                                onClick={() => window.open(`${BASE_URL}/${pdfPath}`, '_blank')}
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
                                Se requiere la firma del cliente y del técnico para generar la documentación automáticamente.
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

                {/* Photos */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                        <h3 className="font-bold text-slate-800">Fotos del Trabajo</h3>
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
                                {/* Quick remove button */}
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); removePhoto(index); }}
                                    className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        ))}

                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="aspect-square rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 hover:border-joa-blue hover:text-joa-blue transition-colors bg-slate-50"
                        >
                            <Camera size={24} className="mb-1" />
                            <span className="text-xs font-medium">Añadir Foto</span>
                        </button>
                    </div>

                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handlePhotoSelect}
                        accept="image/*"
                        multiple
                        className="hidden"
                        capture="environment" // Prefer rear camera on mobile
                    />
                    <p className="text-xs text-slate-400 text-center">
                        Haz clic en una foto para verla o eliminarla.
                    </p>
                </div>

                {/* Debug Header - REMOVE LATER */}
                <div className="bg-red-500 text-white text-center font-bold p-2 rounded mb-4">
                    DEBUG: VERSIÓN V2 NUEVA FIRMAS ACTIVADA
                </div>

                {/* Submit Button */}
                <button
                    type="submit"
                    disabled={submitting || !pdfPath}
                    className="w-full py-4 bg-joa-blue text-white font-bold rounded-xl shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {submitting ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    ) : (
                        <>
                            <Save size={20} />
                            {appointment.status === 'COMPLETADO' ? 'Actualizar Activación' : 'Guardar y Finalizar'}
                        </>
                    )}
                </button>
                {!pdfPath && (
                    <p className="text-center text-xs text-red-400 mt-2">
                        Debes firmar y generar el PDF antes de finalizar.
                    </p>
                )}
            </form >

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

            {/* Photo Viewer Modal */}
            {
                viewingPhotoIndex !== null && photos[viewingPhotoIndex] && (
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

                        <div
                            className="relative max-w-full max-h-[80vh] mb-8"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <img
                                src={photos[viewingPhotoIndex].preview}
                                alt="Full viewing"
                                className="max-h-[75vh] object-contain rounded-lg shadow-2xl"
                            />
                        </div>

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
                )
            }
        </div >
    );
};

export default ActivationPageV2;
