import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { Camera, Save, ArrowLeft, Trash2, X, FileText, PenTool, Hash } from 'lucide-react';
import SignaturePad from 'signature_pad';
import useBranding from '../hooks/useBranding';

const BASE_URL = import.meta.env.PROD ? '' : 'http://localhost:3000';

const CompleteActivationPage = () => {
    const { branding } = useBranding();
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
        apPorts: '1',
        hasMoreClients: false,
        taInstalled: false,
        taCount: '',
        spInstalled: '',
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
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [notActivatedReason, setNotActivatedReason] = useState('');
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
                        const type = info.activationType || 'BP';
                        let families = info.familiesCount || 1;
                        let ports = info.apPorts ? String(info.apPorts) : '2';

                        if (!info.familiesCount || !info.apPorts) {
                            if (type === 'BP' || type === 'Unifamiliar') {
                                if (!info.familiesCount) families = 1;
                                if (!info.apPorts) ports = '1';
                            } else if (type === 'BP_2_FAM' || type === 'Dos familias') {
                                if (!info.familiesCount) families = 2;
                                if (!info.apPorts) ports = '2';
                            }
                        }

                        setFormData({
                            activationType: type,
                            familiesCount: families,
                            apPorts: ports,
                            hasMoreClients: info.hasMoreClients || false,
                            spInstalled: info.spInstalled || '',
                            taInstalled: info.taInstalled || false,
                            taCount: info.taCount || '',
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
        setFormData(prev => {
            const newData = {
                ...prev,
                [name]: type === 'checkbox' ? checked : value
            };
            if (name === 'activationType') {
                if (value === 'Unifamiliar' || value === 'BP') {
                    newData.familiesCount = 1;
                    newData.apPorts = '1';
                } else if (value === 'Dos familias' || value === 'BP_2_FAM') {
                    newData.familiesCount = 2;
                    newData.apPorts = '2';
                }
            }
            return newData;
        });
    };

    const processPhoto = async (file) => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');

                    // Set canvas size to image size
                    canvas.width = img.width;
                    canvas.height = img.height;

                    // Draw image
                    ctx.drawImage(img, 0, 0);

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
                    const addressStr = appointment ? `${appointment.address.street} ${appointment.address.number}, ${appointment.address.city ? appointment.address.city + ', ' : ''}${appointment.address.project.name}` : 'Dirección desconocida';

                    const textX = padding;
                    let textY = img.height - padding - lineHeight * 2;

                    ctx.fillText(`📅 ${dateStr}`, textX, textY);
                    textY += lineHeight;
                    ctx.fillText(`👤 ${techName}`, textX, textY);
                    textY += lineHeight;
                    ctx.fillText(`📍 ${addressStr}`, textX, textY);

                    // --- DRAW LOGO ---
                    const drawLogoAndResolve = () => {
                        const logoImg = new Image();
                        logoImg.crossOrigin = "anonymous";
                        
                        const timeout = setTimeout(() => {
                            console.error('Logo timeout. Saving without logo.');
                            saveBlob();
                        }, 2500);

                        const saveBlob = () => {
                            canvas.toBlob((blob) => {
                                resolve({
                                    blob,
                                    preview: canvas.toDataURL('image/jpeg', 0.7),
                                    name: file.name
                                });
                            }, 'image/jpeg', 0.82);
                        };

                        logoImg.onload = () => {
                            clearTimeout(timeout);
                            const logoHeight = bottomBarHeight * 0.95; 
                            const logoWidth = (logoImg.width / logoImg.height) * logoHeight;
                            const logoX = img.width - padding - logoWidth;
                            const logoY = img.height - bottomBarHeight + (bottomBarHeight - logoHeight) / 2;
                            
                            ctx.drawImage(logoImg, logoX, logoY, logoWidth, logoHeight);
                            saveBlob();
                        };

                        logoImg.onerror = () => {
                            clearTimeout(timeout);
                            console.error('Logo error loading.');
                            saveBlob();
                        };
                        
                        // Use dynamic branding logo
                        logoImg.src = branding.logoUrl; 
                    };

                    drawLogoAndResolve();
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

        if (!formData.klsId?.trim()) {
            alert('Por favor, indica o verifica el Bauauftrag ID (o KLS) antes de generar el PDF.');
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
                techSignature: sigs.tech,
                description: formData.description
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

    const handleFormSubmitClick = (e) => {
        if (e) e.preventDefault();
        setIsConfirmModalOpen(true);
    };

    const handleSubmit = async (isActivatedVal, reasonVal = '') => {
        if (!appointment) return;

        setSubmitting(true);

        const data = new FormData();
        data.append('activationType', formData.activationType);
        data.append('familiesCount', formData.familiesCount);
        data.append('apPorts', formData.apPorts);
        data.append('hasMoreClients', formData.hasMoreClients);
        data.append('taInstalled', formData.taInstalled);
        data.append('taCount', formData.taCount);
        data.append('spInstalled', formData.spInstalled);
        data.append('homeIds', JSON.stringify([formData.homeId])); // Sending as array
        data.append('klsId', formData.klsId);
        data.append('description', formData.description);
        data.append('isActivated', isActivatedVal);
        data.append('notActivatedReason', reasonVal);

        if (pdfPath) {
            data.append('pdfPath', pdfPath);
        }
        if (signatures.client) {
            data.append('clientSignature', signatures.client);
        }
        if (signatures.tech) {
            data.append('techSignature', signatures.tech);
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

        // Send list of existing photos that were KEPT
        data.append('existingPhotos', JSON.stringify(existingPaths));

        try {
            await api.post(`/api/activations/report/${appointment.addressId}`, data, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            navigate('/dashboard'); // Return to dashboard
        } catch (error) {
            console.error('Error submitting activation:', error);
            alert('Error al guardar la activación. Inténtalo de nuevo.');
        } finally {
            setSubmitting(false);
            setIsConfirmModalOpen(false);
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
                <div className="flex-1">
                    <h1 className="text-lg font-bold text-slate-800 leading-tight">Finalizar Activación</h1>
                    <div className="flex items-center gap-2 mt-0.5">
                        <span className="bg-red-600 text-white text-[9px] px-1.5 py-0.5 rounded-full font-black animate-pulse">V2.4 ACTIVADA</span>
                        <p className="text-[10px] text-slate-500 line-clamp-1">{appointment.address.street} {appointment.address.number}</p>
                    </div>
                </div>
            </div>

            <form onSubmit={handleFormSubmitClick} className="p-4 space-y-6 max-w-lg mx-auto">
                {/* Orientation Comment Alert */}
                {appointment?.orientationComment && (
                    <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex gap-3 shadow-sm">
                        <div className="text-blue-500 mt-0.5">
                            <FileText size={20} />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-1">Nota del Back Office</p>
                            <p className="text-sm font-medium text-blue-900 whitespace-pre-wrap leading-snug">{appointment.orientationComment}</p>
                        </div>
                    </div>
                )}

                {/* Technical Details */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
                    <h3 className="font-bold text-slate-800 border-b border-slate-100 pb-2">Detalles Técnicos</h3>

                    <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">Tipo de Activación</label>
                        <select
                            name="activationType"
                            value={formData.activationType}
                            onChange={handleInputChange}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-joa-blue"
                        >
                            <option value="BP">BP (Básico)</option>
                            <option value="BP_2_FAM">BP 2 Familias</option>
                            <option value="BR_MULTI">BR Multi</option>
                            <option value="SDU">SDU</option>
                            <option value="MDU">MDU</option>
                        </select>
                    </div>

                    {!['SDU', 'MDU'].includes(formData.activationType) && (
                        <>
                            {!['Unifamiliar', 'BP'].includes(formData.activationType) && (
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
                            )}

                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">Puertos AP</label>
                                <select
                                    name="apPorts"
                                    value={formData.apPorts}
                                    onChange={handleInputChange}
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-joa-blue"
                                >
                                    <option value="1">1 Puerto</option>
                                    <option value="2">2 Puertos</option>
                                    <option value="4">4 Puertos</option>
                                    <option value="8">8 Puertos</option>
                                    <option value="16">16 Puertos</option>
                                </select>
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
                                    ¿Se instaló TA?
                                </label>
                            </div>

                            {formData.taInstalled && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1">Cantidad de TA</label>
                                    <input
                                        type="number"
                                        name="taCount"
                                        value={formData.taCount}
                                        onChange={handleInputChange}
                                        placeholder="0"
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-joa-blue"
                                    />
                                </div>
                            )}

                            {formData.activationType !== 'BP_2_FAM' && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1">Cantidad de SP</label>
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

                    <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">Bauauftrag ID / KLS (Para el PDF)</label>
                        <div className="relative">
                            <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="text"
                                value={formData.klsId}
                                onChange={(e) => setFormData({ ...formData, klsId: e.target.value })}
                                className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-green-500 font-bold"
                                placeholder="Bauauftrag ID / KLS"
                            />
                        </div>
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
                    />
                    <p className="text-xs text-slate-400 text-center">
                        Haz clic en una foto para verla o eliminarla.
                    </p>
                </div>

                {/* Debug Header - REMOVE LATER */}
                <div className="bg-red-500 text-white text-center font-bold p-2 rounded mb-4">
                    DEBUG: VERSIÓN NUEVA FIRMAS ACTIVADA
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
                            {appointment.status === 'COMPLETADO' ? 'Actualizar Activación' : 'Guardar y Finalizar'}
                        </>
                    )}
                </button>
                {!pdfPath && (
                    <p className="text-center text-xs text-slate-500 mt-2">
                        Si el cliente quedó activado, debes firmar y generar el PDF.
                    </p>
                )}
            </form >

            {/* Confirmation Modal */}
            {isConfirmModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-100 transform scale-100 transition-all">
                        <div className="text-center mb-6">
                            <div className="mx-auto w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-3">
                                <PenTool size={24} />
                            </div>
                            <h3 className="text-xl font-extrabold text-slate-800">
                                Confirmar Finalización
                            </h3>
                            <p className="text-sm text-slate-500 mt-1">
                                ¿Se ha quedado activado y funcionando el cliente?
                            </p>
                        </div>

                        <div className="space-y-4 mb-6">
                            <button
                                type="button"
                                onClick={() => {
                                    if (!pdfPath) {
                                        alert('Para guardar como activado, es obligatorio firmar y generar el documento PDF.');
                                        return;
                                    }
                                    handleSubmit(true);
                                }}
                                className={`w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 border-2 transition-all ${
                                    pdfPath
                                        ? 'bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-100 active:scale-98'
                                        : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                                }`}
                            >
                                <span>✅ Sí, quedó activado</span>
                            </button>

                            <div className="border-t border-slate-100 my-2"></div>

                            <div className="space-y-2">
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider text-left">
                                    Motivo por el que no se activó:
                                </label>
                                <input
                                    type="text"
                                    placeholder="Ej: Fibra rota, CTO sin potencia..."
                                    value={notActivatedReason}
                                    onChange={(e) => setNotActivatedReason(e.target.value)}
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 text-sm font-medium"
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (!notActivatedReason.trim()) {
                                            alert('Por favor, indica brevemente el motivo por el cual no quedó activada la orden.');
                                            return;
                                        }
                                        handleSubmit(false, notActivatedReason);
                                    }}
                                    className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-100 active:scale-98"
                                >
                                    <span>❌ No, requiere nueva cita</span>
                                </button>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => setIsConfirmModalOpen(false)}
                            className="w-full py-2.5 text-slate-500 text-sm font-bold hover:bg-slate-50 rounded-xl transition-all"
                        >
                            Cancelar / Volver a editar
                        </button>
                    </div>
                </div>
            )}

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

export default CompleteActivationPage;
