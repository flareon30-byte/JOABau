import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { Camera, Save, ArrowLeft, Trash2, X, FileText, PenTool, Image as ImageIcon, Share, Hash } from 'lucide-react';
import SignaturePad from 'signature_pad';
import piexif from 'piexifjs';
import { savePendingActivation, saveActivationDraft, getActivationDraft, deleteActivationDraft } from '../utils/offlineStorage';

const BASE_URL = import.meta.env.PROD ? window.location.origin : 'http://localhost:3000';

const ActivationPageV2 = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [appointment, setAppointment] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [viewingPhotoIndex, setViewingPhotoIndex] = useState(null);
    const [priceItems, setPriceItems] = useState([]);

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
    const cameraInputRef = useRef(null);
    const galleryInputRef = useRef(null);

    let user = {};
    try {
        const userStr = localStorage.getItem('user');
        if (userStr && userStr !== "undefined") {
            user = JSON.parse(userStr);
        }
    } catch (e) {
        console.error("Error parsing user from localStorage", e);
    }

    useEffect(() => {
        const fetchAppointment = async () => {
            try {
                let found = null;
                let activeClientId = null;

                if (navigator.onLine) {
                    const res = await api.get('/api/dashboard/activator');
                    activeClientId = res.data?.activeClientId;
                    const appointmentList = res.data?.appointments || [];
                    if (!Array.isArray(appointmentList)) {
                        throw new Error("Appointments data is not an array");
                    }
                    found = appointmentList.find(a => String(a.id) === String(id));
                } else {
                    console.warn("Offline mode: Loading from cache...");
                    const cached = JSON.parse(localStorage.getItem('cachedAgenda') || '{}');
                    activeClientId = cached.activeClientId;
                    found = cached.appointments?.find(a => a.id === id);
                }

                if (found) {
                    setAppointment(found);

                    // Pre-fill form if activation info exists
                    if (found.address.activationInfo) {
                        const info = found.address.activationInfo;
                        console.log('Pre-filling with info:', info);
                        setFormData({
                            activationType: info.customActivationName || info.activationType || 'BP',
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
                            setPhotos(info.photos.map((path, i) => {
                                const cleanPath = path.replace(/\\/g, '/');
                                const encoded = cleanPath.split('/').map(segment => encodeURIComponent(segment)).join('/');
                                return {
                                    blob: null,
                                    preview: `${BASE_URL}/${encoded.replace(/^\/+/, '')}`,
                                    name: `Foto ${i + 1}`,
                                    isExisting: true,
                                    originalPath: path
                                };
                            }));
                        }
                    } else if (found.address.klsId) {
                        setFormData(prev => ({ ...prev, klsId: found.address.klsId }));
                    }

                    // Fetch custom price items (billing concepts)
                    let clientId = activeClientId || found.address?.project?.clientCompanyId;
                    try {
                        let finalActivationItems = [];
                        
                        if (navigator.onLine && clientId) {
                            const pRes = await api.get(`/api/clients/${clientId}/price-items`);
                            finalActivationItems = pRes.data.filter(item => item.department === 'ACTIVATION');
                            localStorage.setItem(`cachedPriceItems_${clientId}`, JSON.stringify(finalActivationItems));
                        } else if (clientId) {
                            console.warn("Offline mode: Loading price items from cache...");
                            finalActivationItems = JSON.parse(localStorage.getItem(`cachedPriceItems_${clientId}`) || '[]');
                        }
                        
                        // Fallback: If no local or remote items, get general ones if online
                        if (finalActivationItems.length === 0 && navigator.onLine) {
                            const allClientsRes = await api.get('/api/clients');
                            const clientsWithItems = allClientsRes.data.filter(c => c.priceItems && c.priceItems.length > 0);
                            if (clientsWithItems.length > 0) {
                                finalActivationItems = clientsWithItems[0].priceItems.filter(item => item.department === 'ACTIVATION');
                            }
                        }

                        setPriceItems(finalActivationItems);
                        
                        // If no custom value matches current DB value and there are items, default to the first one safely
                        const info = found.address.activationInfo;
                        if (!info || (!info.activationType && !info.customActivationName)) {
                            if (finalActivationItems.length > 0) {
                                setFormData(prev => ({ ...prev, activationType: finalActivationItems[0].name }));
                            }
                        }

                        // --- NEW: Load draft if exists ---
                        try {
                            const draft = await getActivationDraft(id);
                            if (draft) {
                                console.log('🔄 Draft found, recovering...', draft);
                                if (draft.formData) setFormData(prev => ({ ...prev, ...draft.formData }));
                                if (draft.photos && draft.photos.length > 0) {
                                    // Make sure blobs are recovered correctly and previews regenerated
                                    const recoveredPhotos = draft.photos.map(p => {
                                        if (p.blob && !p.isExisting) {
                                            return { ...p, preview: URL.createObjectURL(p.blob) };
                                        }
                                        return p;
                                    });
                                    setPhotos(recoveredPhotos);
                                }
                                if (draft.signatures) setSignatures(draft.signatures);
                                if (draft.pdfPath) setPdfPath(draft.pdfPath);
                            }
                        } catch (draftErr) {
                            console.error('Error loading draft:', draftErr);
                        }
                    } catch (err) {
                        console.error('Error fetching price items:', err);
                        // Fallback on error handled by the render method
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

    // --- NEW: Auto-save draft effect ---
    useEffect(() => {
        if (!id || loading || !appointment) return;

        const saveDraft = async () => {
            try {
                // We don't save existing photos (server paths) in draft to save space
                // But we definitely save new ones with blobs
                await saveActivationDraft(id, {
                    formData,
                    photos,
                    signatures,
                    pdfPath
                });
            } catch (err) {
                console.error('Error auto-saving draft:', err);
            }
        };

        const timeout = setTimeout(saveDraft, 1000); // Debounce save
        return () => clearTimeout(timeout);
    }, [formData, photos, signatures, pdfPath, id, loading, appointment]);

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
            // Logic: if TA is unchecked, clear the count
            if (name === 'taInstalled' && !checked) {
                newData.taCount = '';
            }
            return newData;
        });
    };

    const [processingPhotos, setProcessingPhotos] = useState(false);

    const processPhoto = async (file, gpsCoords = null) => {
        return new Promise((resolve, reject) => {
            // Safety timeout to prevent infinite spinning
            const timeout = setTimeout(() => {
                reject(new Error("Timeout processing photo"));
            }, 15000);

            const img = new Image();
            const objectUrl = URL.createObjectURL(file);

            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                // Resize logic: 1600px is plenty for documentation and safer for memory
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

                // Watermark
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
                const techName = user.username?.split('@')[0] || 'Técnico';
                const addressStr = appointment ? `${appointment.address.street} ${appointment.address.number}${appointment.address.city ? ', ' + appointment.address.city : ''}` : 'Dirección';

                const textX = padding;
                let textY = height - padding - lineHeight * 2;

                ctx.fillText(`📅 ${dateStr}`, textX, textY);
                textY += lineHeight;
                ctx.fillText(`👤 ${techName}`, textX, textY);
                textY += lineHeight;
                ctx.fillText(`📍 ${addressStr}`, textX, textY);

                const finalizeResult = () => {
                    // Final JPEG Data URL
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                    let finalBlob = null;

                    try {
                        // Embed GPS if available
                        let processedDataUrl = dataUrl;
                        if (gpsCoords) {
                            const zeroth = {};
                            const exif = {};
                            const gps = {};
                            
                            // Convert decimal degrees to EXIF rational format [degrees, minutes, seconds]
                            const toRational = (decimal) => {
                                const abs = Math.abs(decimal);
                                const degrees = Math.floor(abs);
                                const minutesDecimal = (abs - degrees) * 60;
                                const minutes = Math.floor(minutesDecimal);
                                const seconds = Math.round((minutesDecimal - minutes) * 60 * 100);
                                return [[degrees, 1], [minutes, 1], [seconds, 100]];
                            };

                            gps[piexif.GPSIFD.GPSLatitudeRef] = gpsCoords.lat >= 0 ? 'N' : 'S';
                            gps[piexif.GPSIFD.GPSLatitude] = toRational(gpsCoords.lat);
                            gps[piexif.GPSIFD.GPSLongitudeRef] = gpsCoords.lng >= 0 ? 'E' : 'W';
                            gps[piexif.GPSIFD.GPSLongitude] = toRational(gpsCoords.lng);
                            
                            const exifObj = {"0th": zeroth, "Exif": exif, "GPS": gps};
                            const exifBytes = piexif.dump(exifObj);
                            processedDataUrl = piexif.insert(exifBytes, dataUrl);
                        }

                        // Convert DataURL to Blob
                        const byteString = atob(processedDataUrl.split(',')[1]);
                        const mimeString = processedDataUrl.split(',')[0].split(':')[1].split(';')[0];
                        const ab = new ArrayBuffer(byteString.length);
                        const ia = new Uint8Array(ab);
                        for (let i = 0; i < byteString.length; i++) {
                            ia[i] = byteString.charCodeAt(i);
                        }
                        finalBlob = new Blob([ab], {type: mimeString});

                    } catch (exifErr) {
                        console.error("Error embedding EXIF:", exifErr);
                        // Fallback to standard blob if EXIF fails
                        const byteString = atob(dataUrl.split(',')[1]);
                        const ab = new ArrayBuffer(byteString.length);
                        const ia = new Uint8Array(ab);
                        for (let i = 0; i < byteString.length; i++) {
                            ia[i] = byteString.charCodeAt(i);
                        }
                        finalBlob = new Blob([ab], {type: 'image/jpeg'});
                    }

                    clearTimeout(timeout);
                    URL.revokeObjectURL(objectUrl);

                    if (finalBlob) {
                        resolve({
                            blob: finalBlob,
                            preview: URL.createObjectURL(finalBlob),
                            name: file.name
                        });
                    } else {
                        reject(new Error("Photo processing failed"));
                    }
                };

                // --- DRAW LOGO ---
                const logoImg = new Image();
                logoImg.onload = () => {
                    const logoHeight = bottomBarHeight * 0.45; // Más discreto y elegante
                    const logoWidth = (logoImg.width / logoImg.height) * logoHeight;
                    const logoX = width - padding - logoWidth - (padding / 2); // Un poco más de margen
                    const logoY = height - bottomBarHeight + (bottomBarHeight - logoHeight) / 2;
                    ctx.drawImage(logoImg, logoX, logoY, logoWidth, logoHeight);
                    finalizeResult();
                };
                logoImg.onerror = () => {
                    console.error("Logo load err - finishing without it");
                    finalizeResult();
                };
                logoImg.src = '/logo.png';
            };

            img.onerror = () => {
                clearTimeout(timeout);
                URL.revokeObjectURL(objectUrl);
                reject(new Error("Image load failed"));
            };

            img.src = objectUrl;
        });
    };

    const handlePhotoSelect = async (e) => {
        if (e.target.files && e.target.files.length > 0) {
            setProcessingPhotos(true);
            
            // Try to get current GPS location once for all selected photos
            let gpsCoords = null;
            try {
                const pos = await new Promise((res, rej) => {
                    navigator.geolocation.getCurrentPosition(res, rej, {
                        enableHighAccuracy: true,
                        timeout: 5000,
                        maximumAge: 0
                    });
                });
                gpsCoords = {
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude
                };
                console.log("GPS Location acquired:", gpsCoords);
            } catch (err) {
                console.warn("Could not get GPS location for photos:", err);
            }

            const newPhotos = [];
            try {
                for (let i = 0; i < e.target.files.length; i++) {
                    console.log(`Processing photo ${i + 1}/${e.target.files.length}`);
                    const processed = await processPhoto(e.target.files[i], gpsCoords);
                    newPhotos.push(processed);
                }
                setPhotos(prev => [...prev, ...newPhotos]);
                console.log("All photos processed successfully");
            } catch (error) {
                console.error("Photo processing error:", error);
                alert("Error al procesar algunas fotos. Inténtalo de nuevo.");
            } finally {
                setProcessingPhotos(false);
            }
        }
    };

    const removePhoto = (index) => {
        const photo = photos[index];
        // Revoke the blob URL to free memory
        if (photo.preview && photo.preview.startsWith('blob:')) {
            URL.revokeObjectURL(photo.preview);
        }
        setPhotos(prev => prev.filter((_, i) => i !== index));
        if (viewingPhotoIndex === index) setViewingPhotoIndex(null);
    };

    // Cleanup blob URLs on unmount
    useEffect(() => {
        return () => {
            photos.forEach(p => {
                if (p.preview && p.preview.startsWith('blob:')) {
                    URL.revokeObjectURL(p.preview);
                }
            });
        };
    }, []);

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

    const handleSharePdf = async () => {
        if (!pdfPath) return;
        
        try {
            const cleanPath = pdfPath.split('?')[0];
            const encoded = cleanPath.split('/').map(segment => encodeURIComponent(segment)).join('/');
            const url = `${BASE_URL || window.location.origin}/${encoded}`;

            // Check if Web Share API is available and can share files
            if (navigator.share) {
                try {
                    // Fetch the file to share it as an actual attachment if possible
                    const response = await fetch(url);
                    const blob = await response.blob();
                    const filename = cleanPath.split('/').pop() || 'Documento_Activacion.pdf';
                    const file = new File([blob], filename, { type: 'application/pdf' });

                    if (navigator.canShare && navigator.canShare({ files: [file] })) {
                        await navigator.share({
                            files: [file],
                            title: 'Orden de Activación - Joa Technologien',
                            text: 'Se adjunta el PDF de la orden de activación.'
                        });
                    } else {
                        // Fallback to URL sharing
                        await navigator.share({
                            title: 'Orden de Activación - Joa Technologien',
                            url: url
                        });
                    }
                } catch (shareErr) {
                    console.warn('File share failed, falling back to link share:', shareErr);
                    await navigator.share({
                        title: 'Orden de Activación - Joa Technologien',
                        url: url
                    });
                }
            } else {
                // Fallback for desktop or non-supported browsers
                window.open(`mailto:?subject=Orden de Activación - Joa Technologien&body=Puedes descargar el PDF aquí: ${url}`);
            }
        } catch (error) {
            console.error('Error sharing PDF:', error);
            alert('No se pudo abrir el menú de compartir. Puedes intentar descargar el PDF directamente.');
        }
    };

    const handleGeneratePdf = async (currentSignatures = null) => {
        // Validate mandatory fields
        if (!formData.activationType) {
            alert('Por favor, selecciona un tipo de activación.');
            return;
        }

        if (!navigator.onLine) {
            setPdfPath('OFFLINE_PENDING');
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
        data.append('hasMoreClients', formData.hasMoreClients ? 'true' : 'false');
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
            if (!navigator.onLine) {
                // OFFLINE MODE
                const offlineData = {
                    addressId: appointment.addressId,
                    formData: { ...formData },
                    photos: photos.filter(p => !p.isExisting).map(p => ({ blob: p.blob, name: p.name })),
                    existingPhotos: photos.filter(p => p.isExisting).map(p => p.originalPath),
                    signatures: { ...signatures },
                    type: 'ACTIVATION',
                    addressInfo: {
                        street: appointment.address.street,
                        number: appointment.address.number
                    }
                };
                
                await savePendingActivation(offlineData);
                
                // CLEAR DRAFT ON OFFLINE SAVE
                try {
                    await deleteActivationDraft(id);
                } catch (err) {
                    console.error('Error clearing draft offline:', err);
                }

                alert('⚠️ SIN CONEXIÓN: La activación se ha guardado en tu móvil. No olvides sincronizarla en el menú principal cuando tengas internet.');
                navigate('/dashboard');
                return;
            }

            await api.post(`/api/activations/report/${appointment.addressId}`, data, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            // CLEAR DRAFT ON SUCCESS
            try {
                await deleteActivationDraft(id);
            } catch (err) {
                console.error('Error clearing draft:', err);
            }

            navigate('/dashboard');
        } catch (error) {
            console.error('Error submitting activation:', error);
            const serverMsg = error.response?.data?.error || error.response?.data?.message || JSON.stringify(error.response?.data) || error.message;
            alert('Error al guardar la activación (V2.5 ERROR): ' + serverMsg);
        } finally {
            setSubmitting(false);
        }
    };

    console.log("Rendering ActivationPageV2. Loading:", loading, "AppointmentID:", id, "AppointmentOBJ:", appointment ? "exist" : "null");

    if (loading) return <div className="p-8 text-center bg-slate-50 min-h-screen pt-20 transition-all">Cargando datos...</div>;

    if (!appointment) {
        console.error("Critical: Appointment data missing for ID:", id);
        return (
            <div className="p-8 text-center text-red-500 bg-slate-50 min-h-screen pt-20">
                <h3 className="font-bold text-xl mb-2">Cita no encontrada.</h3>
                <p className="text-sm opacity-70 mb-6">No se han podido recuperar los datos de la intervención.</p>
                <div className="flex flex-col gap-3 max-w-xs mx-auto">
                    <button 
                        onClick={() => window.location.reload()} 
                        className="w-full py-3 bg-joa-blue text-white rounded-xl font-bold shadow-lg"
                    >
                        Reintentar carga
                    </button>
                    <button 
                        onClick={() => navigate('/dashboard')} 
                        className="w-full py-3 bg-slate-200 text-slate-700 rounded-xl font-bold"
                    >
                        Volver al Inicio
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 pb-20">
            {/* Header */}
            <div className="bg-white p-4 shadow-sm sticky top-0 z-10 flex items-center gap-4 border-b border-slate-100">
                <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-full">
                    <ArrowLeft size={24} className="text-slate-600" />
                </button>
                <div className="flex-1">
                    <h1 className="text-lg font-bold text-slate-800 leading-tight">Finalizar Activación</h1>
                    <div className="flex items-center gap-2 mt-0.5">
                        <span className="bg-red-600 text-white text-[9px] px-1.5 py-0.5 rounded-full font-black animate-pulse">V2.4 ACTIVADA</span>
                        <p className="text-[10px] text-slate-500 line-clamp-1">{appointment?.address?.street} {appointment?.address?.number}</p>
                    </div>
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
                                onClick={handleSharePdf}
                                className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                            >
                                <Share size={18} />
                                Compartir PDF (Outlook/WA)
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

                        {/* Camera Option */}
                        <button
                            type="button"
                            onClick={() => cameraInputRef.current?.click()}
                            disabled={processingPhotos}
                            className="aspect-square rounded-xl border-2 border-dashed border-blue-400 flex flex-col items-center justify-center text-blue-600 hover:bg-blue-50 transition-all bg-blue-50/20 disabled:opacity-50 group"
                        >
                            <Camera size={28} className="mb-1 group-hover:scale-110 transition-transform" />
                            <span className="text-[10px] font-black uppercase">Hacer Foto</span>
                        </button>

                        {/* Gallery Option */}
                        <button
                            type="button"
                            onClick={() => galleryInputRef.current?.click()}
                            disabled={processingPhotos}
                            className="aspect-square rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 hover:border-joa-blue hover:text-joa-blue transition-all bg-white disabled:opacity-50 group"
                        >
                            <ImageIcon size={28} className="mb-1 group-hover:scale-110 transition-transform" />
                            <span className="text-[10px] font-black uppercase">Galería</span>
                        </button>
                    </div>

                    {/* Hidden Inputs */}
                    <input
                        type="file"
                        ref={cameraInputRef}
                        onChange={handlePhotoSelect}
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                    />
                    <input
                        type="file"
                        ref={galleryInputRef}
                        onChange={handlePhotoSelect}
                        accept="image/*"
                        multiple
                        className="hidden"
                    />

                    {processingPhotos && (
                        <div className="flex items-center justify-center gap-2 py-2 text-joa-blue animate-pulse">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-joa-blue"></div>
                            <span className="text-[10px] font-black uppercase">Procesando evidencias...</span>
                        </div>
                    )}

                    <p className="text-xs text-slate-400 text-center">
                        Toca una foto para verla o eliminarla.
                    </p>
                </div>


                {/* Submit Button */}
                <button
                    type="submit"
                    disabled={submitting || (!pdfPath && navigator.onLine)}
                    className="w-full py-4 bg-joa-blue text-white font-bold rounded-xl shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {submitting ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    ) : (
                        <>
                            <Save size={20} />
                            {appointment?.status === 'COMPLETADO' ? 'Actualizar Activación' : 'Guardar y Finalizar'}
                        </>
                    )}
                </button>
                {!pdfPath && navigator.onLine && (
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
                        className="fixed inset-0 z-[9999] bg-slate-900/98 flex flex-col items-center justify-center p-2"
                    >
                        <button
                            onClick={() => setViewingPhotoIndex(null)}
                            className="absolute top-6 right-6 text-white p-3 bg-white/20 rounded-full hover:bg-white/40 active:scale-95 transition z-[10000]"
                        >
                            <X size={28} />
                        </button>

                        <div className="relative max-w-full max-h-[85vh] flex items-center justify-center">
                            <img
                                src={photos[viewingPhotoIndex].preview.startsWith('blob:') ? photos[viewingPhotoIndex].preview : `${photos[viewingPhotoIndex].preview}${photos[viewingPhotoIndex].preview.includes('?') ? '&' : '?'}cb=${Date.now()}`}
                                alt="Full viewing"
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
                )
            }
        </div >
    );
};

export default ActivationPageV2;
