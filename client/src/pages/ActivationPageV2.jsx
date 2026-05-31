import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { Camera, Save, ArrowLeft, Trash2, X, FileText, PenTool, Image as ImageIcon, Share, Hash, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import SignaturePad from 'signature_pad';
import piexif from 'piexifjs';
import { savePendingActivation, saveActivationDraft, getActivationDraft, deleteActivationDraft } from '../utils/offlineStorage';
import useBranding from '../hooks/useBranding';
import { useTranslation } from 'react-i18next';

const BASE_URL = import.meta.env.PROD ? window.location.origin : 'http://localhost:3000';

const calculateBlur = (img) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Scale down to max 500px for performance
    const scale = Math.min(500 / img.width, 500 / img.height);
    const w = Math.floor(img.width * scale);
    const h = Math.floor(img.height * scale);
    
    if (w < 3 || h < 3) return 1000;
    
    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(img, 0, 0, w, h);
    
    const imageData = ctx.getImageData(0, 0, w, h);
    const { width, height, data } = imageData;
    const grayscale = new Float32Array(width * height);
    for (let i = 0; i < data.length; i += 4) {
        grayscale[i / 4] = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    }

    let sum = 0;
    let count = 0;
    const laplacianValues = new Float32Array((width - 2) * (height - 2));
    let lapIndex = 0;

    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const idx = y * width + x;
            const top = (y - 1) * width + x;
            const bottom = (y + 1) * width + x;
            const left = y * width + (x - 1);
            const right = y * width + (x + 1);

            const laplacian = grayscale[top] + grayscale[bottom] + grayscale[left] + grayscale[right] - 4 * grayscale[idx];
            laplacianValues[lapIndex++] = laplacian;
            
            sum += laplacian;
            count++;
        }
    }

    const mean = sum / count;
    let variance = 0;
    for (let i = 0; i < count; i++) {
        variance += Math.pow(laplacianValues[i] - mean, 2);
    }
    return variance / count;
};

const ActivationPageV2 = () => {
    const { t } = useTranslation();
    const { branding } = useBranding();
    const { id } = useParams();
    const navigate = useNavigate();
    const [appointment, setAppointment] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [viewingPhotoIndex, setViewingPhotoIndex] = useState(null);
    const [priceItems, setPriceItems] = useState([]);
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSyncedAt, setLastSyncedAt] = useState(null);

    // Photo Wizard State
    const [photoWizardStep, setPhotoWizardStep] = useState('IDLE');
    const [circuitCompleted, setCircuitCompleted] = useState(false);

    // Confirmation Modal State
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [isActivatedResult, setIsActivatedResult] = useState(null);
    const [notActivatedReason, setNotActivatedReason] = useState('');

    // Form State
    const [formData, setFormData] = useState({
        activationType: 'BP',
        familiesCount: 1,
        apPorts: '1',
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

    const fetchAppointment = useCallback(async () => {
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
                    const type = info.customActivationName || info.activationType || 'BP';
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

                    setFormData(prev => ({
                        ...prev,
                        activationType: type,
                        familiesCount: families,
                        apPorts: ports,
                        hasMoreClients: info.hasMoreClients || false,
                        spInstalled: info.spInstalled || '',
                        taInstalled: info.taInstalled || false,
                        taCount: info.taCount || '',
                        mduInstalled: info.mduInstalled || false,
                        isRepair: info.isRepair || false,
                        homeId: info.homeIds && info.homeIds.length > 0 ? info.homeIds[0] : '',
                        klsId: info.klsId || found.address.klsId || '',
                        description: info.description || ''
                    }));

                    setPdfPath(info.pdfPath && info.pdfPath !== 'null' ? info.pdfPath : null);

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
                        finalActivationItems = JSON.parse(localStorage.getItem(`cachedPriceItems_${clientId}`) || '[]');
                    }
                    
                    setPriceItems(finalActivationItems);
                    
                    const info = found.address.activationInfo;
                    if (!info || (!info.activationType && !info.customActivationName)) {
                        setFormData(prev => ({
                            ...prev,
                            activationType: '',
                            familiesCount: 1,
                            apPorts: '2'
                        }));
                    }
                    
                    // --- LOAD DRAFT / MERGE ---
                    try {
                        const localDraft = await getActivationDraft(id);
                        const serverDraft = found.address.activationInfo;
                        
                        let draftToUse = null;
                        if (localDraft && serverDraft) {
                            const serverTime = new Date(serverDraft.updatedAt).getTime();
                            const localTime = localDraft.updatedAt || 0;
                            
                            if (serverTime > localTime) {
                                console.log('🌐 Server draft is newer.');
                                draftToUse = null;
                            } else {
                                console.log('📱 Local draft is newer.');
                                draftToUse = localDraft;
                            }
                        } else if (localDraft) {
                            draftToUse = localDraft;
                        }

                        if (draftToUse) {
                            if (draftToUse.formData) setFormData(prev => ({ ...prev, ...draftToUse.formData }));
                            if (draftToUse.photos && draftToUse.photos.length > 0) {
                                const recoveredPhotos = draftToUse.photos.map(p => {
                                    if (p.blob && !p.isExisting) {
                                        return { ...p, preview: URL.createObjectURL(p.blob) };
                                    }
                                    return p;
                                });
                                setPhotos(recoveredPhotos);
                            }
                            if (draftToUse.signatures) setSignatures(draftToUse.signatures);
                            if (draftToUse.pdfPath && draftToUse.pdfPath !== 'null') setPdfPath(draftToUse.pdfPath);
                        }
                    } catch (draftErr) {
                        console.error('Error loading draft:', draftErr);
                    }

                } catch (err) {
                    console.error('Error fetching items:', err);
                }

            }
        } catch (error) {
            console.error('Error fetching appointment:', error);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        fetchAppointment();
    }, [fetchAppointment]);

    // --- NEW: Polling for updates ---
    useEffect(() => {
        if (!id || loading) return;

        const interval = setInterval(() => {
            if (navigator.onLine && !isSyncing && !submitting) {
                console.log('🔄 Polling for team updates...');
                fetchAppointment();
            }
        }, 30000); // Every 30 seconds

        return () => clearInterval(interval);
    }, [id, isSyncing, submitting, loading, fetchAppointment]);

    // --- NEW: Sync with Server Function ---
    const syncWithServer = async () => {
        if (!navigator.onLine || !id || !appointment?.addressId || loading) return;
        
        setIsSyncing(true);
        try {
            const syncData = new FormData();
            syncData.append('activationType', formData.activationType);
            syncData.append('familiesCount', formData.familiesCount);
            syncData.append('apPorts', formData.apPorts);
            syncData.append('hasMoreClients', formData.hasMoreClients);
            syncData.append('spInstalled', formData.spInstalled);
            syncData.append('taInstalled', formData.taInstalled);
            syncData.append('mduInstalled', formData.mduInstalled);
            syncData.append('isRepair', formData.isRepair);
            syncData.append('homeIds', JSON.stringify([formData.homeId]));
            syncData.append('description', formData.description);
            syncData.append('pdfPath', pdfPath);

            // Send existing photo paths to keep them
            const existingPaths = photos.filter(p => p.isExisting).map(p => p.originalPath);
            syncData.append('existingPhotos', JSON.stringify(existingPaths));

            // Append new photo blobs
            photos.forEach(p => {
                if (p.blob && !p.isExisting) {
                    syncData.append('photos', p.blob, p.name);
                }
            });

            await api.post(`/api/activations/sync-draft/${appointment.addressId}`, syncData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setLastSyncedAt(new Date());
            console.log('✅ Draft synced with server successfully');
        } catch (err) {
            console.error('❌ Error syncing with server:', err);
        } finally {
            setIsSyncing(false);
        }
    };

    // --- NEW: Auto-save draft effect ---
    useEffect(() => {
        if (!id || loading || !appointment) return;

        const saveDraft = async () => {
            try {
                // Local save for offline availability
                await saveActivationDraft(id, {
                    formData,
                    photos,
                    signatures,
                    pdfPath
                });

                // Server sync for team collaboration
                if (navigator.onLine) {
                    await syncWithServer();
                }
            } catch (err) {
                console.error('Error auto-saving draft:', err);
            }
        };

        const timeout = setTimeout(saveDraft, 2000); // Debounce save
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
                // Check for blur
                const variance = calculateBlur(img);
                console.log('Image variance:', variance);
                if (variance < 50) { // Threshold for blurry photo
                    clearTimeout(timeout);
                    URL.revokeObjectURL(objectUrl);
                    reject(new Error('BLURRY'));
                    return;
                }

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

                // Watermark logic
                 const applyWatermark = (logoImg = null) => {
                    const fontSize = Math.max(18, Math.floor(height * 0.022));
                    const padding = fontSize * 1.5;
                    
                    ctx.save();
                    ctx.shadowColor = 'rgba(0,0,0,0.8)';
                    ctx.shadowBlur = 6;
                    ctx.shadowOffsetX = 2;
                    ctx.shadowOffsetY = 2;

                    let techYOffset = padding;

                    if (logoImg) {
                        const logoWidth = width * 0.18;
                        const logoHeight = (logoImg.height / logoImg.width) * logoWidth;
                        ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
                        const logoX = (width - logoWidth) / 2;
                        ctx.drawImage(logoImg, logoX, padding, logoWidth, logoHeight);
                        techYOffset = padding + logoHeight + (fontSize * 0.5);
                    }

                    ctx.shadowColor = 'rgba(0,0,0,0.8)';
                    ctx.shadowBlur = 6;
                    ctx.shadowOffsetX = 2;
                    ctx.shadowOffsetY = 2;
                    ctx.fillStyle = 'white';
                    ctx.font = `bold ${fontSize}px Arial`;
                    ctx.textBaseline = 'top';
                    ctx.textAlign = 'center';
                    const techName = user.username?.split('@')[0] || 'Técnico';
                    ctx.fillText(techName.toUpperCase(), width / 2, techYOffset);


                    ctx.restore();
                    // Proceed to finalize
                    if (typeof finalizeResult === 'function') finalizeResult(canvas.toDataURL('image/jpeg', 0.85));
                };














                const finalizeResult = (dataUrl) => {
                    // Final JPEG Data URL

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
                    resolve({ blob: finalBlob, preview: URL.createObjectURL(finalBlob), name: file.name });
                };

                if (branding.logoUrl) {
                    const logoImg = new Image();
                    logoImg.crossOrigin = "anonymous";
                    logoImg.onload = () => applyWatermark(logoImg);
                    logoImg.onerror = () => applyWatermark(null);
                    logoImg.src = branding.logoUrl;
                } else {
                    applyWatermark(null);
                }
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
            let blurryDetected = false;
            try {
                for (let i = 0; i < e.target.files.length; i++) {
                    console.log(`Processing photo ${i + 1}/${e.target.files.length}`);
                    try {
                        const processed = await processPhoto(e.target.files[i], gpsCoords);
                        newPhotos.push(processed);
                    } catch (photoErr) {
                        if (photoErr.message === 'BLURRY') {
                            blurryDetected = true;
                        } else {
                            throw photoErr;
                        }
                    }
                }
                
                if (blurryDetected) {
                    alert('⚠️ Una o más fotos parecen estar muy borrosas u oscuras. Por favor, asegúrate de enfocar bien y de tener buena iluminación e inténtalo de nuevo.');
                    // Reset input
                    if (cameraInputRef.current) cameraInputRef.current.value = '';
                    if (galleryInputRef.current) galleryInputRef.current.value = '';
                    setProcessingPhotos(false);
                    return; // Stop circuit advancement
                }

                setPhotos(prev => [...prev, ...newPhotos]);
                console.log("All photos processed successfully");
                
                // Auto advance wizard
                if (photoWizardStep === 'UPLOAD_Q1_YES' || photoWizardStep === 'UPLOAD_Q1_NO') {
                    setPhotoWizardStep('Q2');
                } else if (photoWizardStep === 'UPLOAD_Q2_YES') {
                    setPhotoWizardStep('UPLOAD_Q3');
                } else if (photoWizardStep === 'UPLOAD_Q3') {
                    setPhotoWizardStep('IDLE');
                    setCircuitCompleted(true);
                }
                
                if (cameraInputRef.current) cameraInputRef.current.value = '';
                if (galleryInputRef.current) galleryInputRef.current.value = '';

            } catch (error) {
                console.error("Photo processing error:", error);
                alert("Error al procesar algunas fotos. Inténtalo de nuevo."); // Consider translating this if it's user facing, for now I will leave it
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
            alert(t('activations.please_sign'));
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
                            title: t('activations.share_pdf_title') || 'Orden de Activación - Joa Technologien',
                            text: t('activations.share_pdf_text') || 'Se adjunta el PDF de la orden de activación.'
                        });
                    } else {
                        // Fallback to URL sharing
                        await navigator.share({
                            title: t('activations.share_pdf_title') || 'Orden de Activación - Joa Technologien',
                            url: url
                        });
                    }
                } catch (shareErr) {
                    console.warn('File share failed, falling back to link share:', shareErr);
                    await navigator.share({
                        title: t('activations.share_pdf_title') || 'Orden de Activación - Joa Technologien',
                        url: url
                    });
                }
            } else {
                // Fallback for desktop or non-supported browsers
                window.open(`mailto:?subject=${encodeURIComponent(t('activations.share_pdf_title') || 'Orden de Activación - Joa Technologien')}&body=${encodeURIComponent((t('activations.share_pdf_body') || 'Puedes descargar el PDF aquí: ') + url)}`);
            }
        } catch (error) {
            console.error('Error sharing PDF:', error);
            alert(t('activations.share_pdf_err') || 'No se pudo abrir el menú de compartir. Puedes intentar descargar el PDF directamente.');
        }
    };

    const handleGeneratePdf = async (currentSignatures = null) => {
        // Validate mandatory fields
        if (!formData.activationType) {
            alert(t('activations.select_activation_type'));
            return;
        }

        if (!navigator.onLine) {
            setPdfPath('OFFLINE_PENDING');
            return;
        }

        const klsIdToUse = formData.klsId || appointment.address.klsId;

        if (!formData.klsId?.trim()) {
            alert(t('activations.kls_required'));
            return;
        }

        // Use passed signatures (from immediate flow) or state (if retrying - though retry usually clears)
        const sigs = currentSignatures || signatures;

        if (!sigs.client || !sigs.tech) {
            alert(t('activations.signatures_missing'));
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
            alert(t('activations.pdf_error') + ' ' + (error.response?.data?.message || ''));
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e, isActivated = true, reason = '') => {
        if (e) e.preventDefault();
        if (!appointment) return;

        if (!formData.activationType) {
            alert("Por favor, selecciona un Tipo de Instalación en el desplegable.");
            return;
        }

        setSubmitting(true);

        const data = new FormData();
        data.append('activationType', formData.activationType);
        data.append('isActivated', isActivated);
        data.append('notActivatedReason', reason);
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
                    isActivated,
                    notActivatedReason: reason,
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

                alert(t('activations.offline_saved'));
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
            alert(`${t('activations.save_error')} (V2.5 ERROR): ` + serverMsg);
        } finally {
            setSubmitting(false);
        }
    };

    console.log("Rendering ActivationPageV2. Loading:", loading, "AppointmentID:", id, "AppointmentOBJ:", appointment ? "exist" : "null");

    if (loading) return <div className="p-8 text-center bg-slate-50 min-h-screen pt-20 transition-all">{t('activations.loading_data')}</div>;

    if (!appointment) {
        console.error("Critical: Appointment data missing for ID:", id);
        return (
            <div className="p-8 text-center text-red-500 bg-slate-50 min-h-screen pt-20">
                <h3 className="font-bold text-xl mb-2">{t('activations.appointment_not_found')}</h3>
                <p className="text-sm opacity-70 mb-6">{t('activations.cannot_recover_data')}</p>
                <div className="flex flex-col gap-3 max-w-xs mx-auto">
                    <button 
                        onClick={() => window.location.reload()} 
                        className="w-full py-3 bg-joa-blue text-white rounded-xl font-bold shadow-lg"
                    >
                        {t('activations.retry_load')}
                    </button>
                    <button 
                        onClick={() => navigate('/dashboard')} 
                        className="w-full py-3 bg-slate-200 text-slate-700 rounded-xl font-bold"
                    >
                        {t('activations.back_to_home')}
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
                    <div className="flex items-center gap-2">
                        <h1 className="text-lg font-bold text-slate-800 leading-tight">{t('activations.finish_activation')}</h1>
                        {isSyncing ? (
                            <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full text-[10px] font-bold animate-pulse">
                                <Share size={12} /> {t('activations.syncing')}
                            </div>
                        ) : lastSyncedAt ? (
                            <div className="flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-600 rounded-full text-[10px] font-bold">
                                <CheckCircle size={12} /> {t('activations.synced')}
                            </div>
                        ) : null}
                        <button 
                            type="button"
                            onClick={() => fetchAppointment()}
                            className="p-1.5 text-slate-400 hover:text-joa-blue hover:bg-blue-50 rounded-lg transition-all"
                            title={t('activations.refresh_data')}
                        >
                            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                        <span className="bg-red-600 text-white text-[9px] px-1.5 py-0.5 rounded-full font-black animate-pulse">V2.4 ACTIVADA</span>
                        <p className="text-[10px] text-slate-500 line-clamp-1">{appointment?.address?.street} {appointment?.address?.number}</p>
                    </div>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-6 max-w-lg mx-auto">
                {/* Orientation Comment Alert */}
                {appointment?.orientationComment && (
                    <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex gap-3 shadow-sm">
                        <div className="text-blue-500 mt-0.5">
                            <FileText size={20} />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-1">{t('activations.back_office_note')}</p>
                            <p className="text-sm font-medium text-blue-900 whitespace-pre-wrap leading-snug">{appointment.orientationComment}</p>
                        </div>
                    </div>
                )}

                {/* Technical Details */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
                    <h3 className="font-bold text-slate-800 border-b border-slate-100 pb-2">{t('activations.tech_details')}</h3>

                    <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">{t('activations.activation_type')}</label>
                        <select
                            name="activationType"
                            value={formData.activationType}
                            onChange={handleInputChange}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-joa-blue"
                            required
                        >
                            <option value="" disabled hidden>Selecciona un tipo de instalación...</option>
                            {priceItems.length > 0 ? (
                                priceItems.map(item => (
                                    <option key={item.id} value={item.name}>
                                        {item.name}
                                    </option>
                                ))
                            ) : (
                                <option value="" disabled>{t('activations.no_concepts')}</option>
                            )}
                        </select>
                    </div>

                    {!['SDU', 'MDU'].includes(formData.activationType) && (
                        <>
                            {!['Unifamiliar', 'BP'].includes(formData.activationType) && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1">{t('activations.families_count')}</label>
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
                                <label className="block text-sm font-medium text-slate-600 mb-1">{t('activations.ap_ports')}</label>
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
                                    {t('activations.more_clients')}
                                </label>
                            </div>

                            {/* BR_MULTI Specific Logic */}
                            {formData.activationType === 'BR_MULTI' ? (
                                <div className="p-5 bg-purple-50 rounded-2xl border border-purple-100 space-y-4 shadow-sm">
                                    <div className="flex items-center justify-between">
                                        <h4 className="font-bold text-purple-700 text-sm uppercase tracking-wider">{t('activations.multi_breakdown')}</h4>
                                        <span className="bg-purple-100 text-purple-700 text-[10px] px-2 py-0.5 rounded-full font-bold">{t('activations.bp_included')}</span>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">{t('activations.sp_installed_qty')}</label>
                                        <input
                                            type="number"
                                            name="spInstalled"
                                            min="1"
                                            required
                                            value={formData.spInstalled}
                                            onChange={handleInputChange}
                                            className="w-full border border-slate-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-purple-400 bg-white"
                                        />
                                        <p className="text-[10px] text-slate-500 mt-2 italic">{t('activations.sp_charged_note')}</p>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-3">{t('activations.mdu_equipment')}</label>
                                        <div className="grid grid-cols-1 gap-3">
                                            <button
                                                type="button"
                                                onClick={() => setFormData({ ...formData, mduInstalled: !formData.mduInstalled, taInstalled: false })}
                                                className={`p-3 rounded-xl border font-bold text-sm transition-all ${formData.mduInstalled ? 'bg-purple-600 border-purple-600 text-white shadow-lg' : 'bg-white border-slate-200 text-slate-600'}`}
                                            >
                                                {t('activations.includes_mdu')}
                                            </button>
                                        </div>
                                        {!formData.mduInstalled && (
                                            <p className="text-[10px] text-red-500 mt-1 font-medium italic">{t('activations.must_indicate_mdu')}</p>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {/* ITEM: TA / SDU */}
                                    {(formData.activationType === 'Unifamiliar' || formData.activationType === 'BP') && (
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
                                                    {t('activations.ta_sdu_installed')}
                                                </label>
                                            </div>
                                            {formData.taInstalled && (
                                                <div className="pl-4 border-l-2 border-slate-200 animate-fadeIn">
                                                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">{t('activations.ta_count')}</label>
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
                                    )}

                                    {/* ITEM: SP */}
                                    {formData.activationType !== 'BP_2_FAM' && (
                                        <div>
                                            <label className="block text-sm font-medium text-slate-600 mb-1">{t('activations.sp_installed')}</label>
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
                                    {(formData.activationType === 'Dos familias' || formData.activationType === 'Multi' || formData.activationType === 'BP_2_FAM') && (
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
                                                {t('activations.mdu_multi_extra_installed')}
                                            </label>
                                        </div>
                                    )}

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
                                            {t('activations.is_repair')}
                                        </label>
                                    </div>
                                </>
                            )}
                        </>
                    )}
                </div>

                {/* Client Info */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
                    <h3 className="font-bold text-slate-800 border-b border-slate-100 pb-2">{t('activations.client_info')}</h3>

                    <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">{t('activations.home_id')}</label>
                        <input
                            type="text"
                            name="homeId"
                            value={formData.homeId}
                            onChange={handleInputChange}
                            placeholder={t('activations.placeholder_home_id') || "Ej: H-123456"}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-joa-blue font-mono"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">{t('activations.job_description')}</label>
                        <textarea
                            name="description"
                            value={formData.description}
                            onChange={handleInputChange}
                            rows="3"
                            placeholder={t('activations.placeholder_description') || "Detalles adicionales..."}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-joa-blue resize-none"
                        ></textarea>
                    </div>
                </div>

                {/* Signatures & PDF Section */}
                <div className={`p-6 rounded-2xl shadow-sm border-2 ${pdfPath ? 'border-green-200 bg-green-50' : 'border-blue-200 bg-blue-50'}`}>
                    <div className="flex justify-between items-center mb-4">
                        <label className="text-base font-bold text-slate-700 flex items-center gap-2">
                            <FileText size={20} className={pdfPath ? 'text-green-600' : 'text-blue-500'} />
                            {t('activations.signatures_docs')}
                        </label>
                        {pdfPath && (
                            <span className="text-xs text-green-700 font-bold bg-white px-3 py-1 rounded-full border border-green-200 shadow-sm">{t('activations.signed_generated')}</span>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">{t('activations.bauauftrag_kls')}</label>
                        <div className="relative">
                            <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="text"
                                value={formData.klsId}
                                onChange={(e) => setFormData({ ...formData, klsId: e.target.value })}
                                className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-green-500 font-bold"
                                placeholder={t('activations.bauauftrag_kls') || "Bauauftrag ID / KLS"}
                            />
                        </div>
                    </div>

                    {pdfPath ? (
                        <div className="space-y-4">
                            <p className="text-sm text-green-700">
                                {t('activations.doc_generated_signed')}
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
                                {t('activations.view_pdf')}
                            </button>

                            <button
                                type="button"
                                onClick={handleSharePdf}
                                className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                            >
                                <Share size={18} />
                                {t('activations.share_pdf')}
                            </button>
                            <button
                                type="button"
                                onClick={() => { setPdfPath(null); setSignatures({ client: null, tech: null }); }}
                                className="w-full py-2 text-slate-500 text-sm hover:text-red-500 transition-colors"
                            >
                                {t('activations.resign')}
                            </button>
                        </div>
                    ) : (
                        <div>
                            <p className="text-sm text-slate-600 mb-4">
                                {t('activations.signatures_required')}
                            </p>
                            <button
                                type="button"
                                onClick={() => setIsSigning('CLIENT')}
                                className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                            >
                                <PenTool size={18} />
                                {t('activations.start_signing')}
                            </button>
                        </div>
                    )}
                </div>

                {/* Photos */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                        <h3 className="font-bold text-slate-800">{t('activations.job_photos')}</h3>
                        <span className="text-xs text-slate-400">{t('activations.photos_count', { count: photos.length })}</span>
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
                            onClick={() => {
                                if (circuitCompleted) {
                                    cameraInputRef.current?.click();
                                } else {
                                    setPhotoWizardStep('Q1');
                                }
                            }}
                            disabled={processingPhotos}
                            className="aspect-square rounded-xl border-2 border-dashed border-blue-400 flex flex-col items-center justify-center text-blue-600 hover:bg-blue-50 transition-all bg-blue-50/20 disabled:opacity-50 group text-center p-2"
                        >
                            <Camera size={28} className="mb-1 group-hover:scale-110 transition-transform" />
                            <span className="text-[10px] font-black uppercase">{circuitCompleted ? t('activations.take_photo') : 'Subir Fotos (Circuito)'}</span>
                        </button>

                        {/* Gallery Option */}
                        <button
                            type="button"
                            onClick={() => {
                                if (circuitCompleted) {
                                    galleryInputRef.current?.click();
                                } else {
                                    setPhotoWizardStep('Q1');
                                }
                            }}
                            disabled={processingPhotos}
                            className="aspect-square rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 hover:border-joa-blue hover:text-joa-blue transition-all bg-white disabled:opacity-50 group text-center p-2"
                        >
                            <ImageIcon size={28} className="mb-1 group-hover:scale-110 transition-transform" />
                            <span className="text-[10px] font-black uppercase">{circuitCompleted ? t('activations.gallery') : 'Subir Fotos (Circuito)'}</span>
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
                            <span className="text-[10px] font-black uppercase">{t('activations.processing_evidence')}</span>
                        </div>
                    )}

                    <p className="text-xs text-slate-400 text-center">
                        {t('activations.touch_photo_info')}
                    </p>
                    {/* Submit Button */}
                    <button
                        type="button"
                        onClick={(e) => {
                            e.preventDefault();
                            setShowConfirmModal(true);
                        }}
                        disabled={submitting || (!pdfPath && navigator.onLine)}
                        className="w-full py-4 bg-joa-blue text-white font-bold rounded-xl shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {submitting ? (
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        ) : (
                            <>
                                <Save size={20} />
                                {appointment?.status === 'COMPLETADO' ? t('activations.update_activation') : t('activations.save_and_finish')}
                            </>
                        )}
                    </button>
                </div>

                {/* Confirmation Modal */}
                {showConfirmModal && (
                    <div className="fixed inset-0 bg-slate-900/90 flex items-center justify-center p-4 z-[9999]">
                        <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl relative">
                            <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <AlertCircle className="text-orange-500" /> Confirmación Final
                            </h2>
                            
                            <div className="bg-orange-50 p-4 rounded-2xl mb-6 border border-orange-100">
                                <p className="text-sm font-bold text-orange-800">
                                    ¿Te has asegurado de que el documento PDF está firmado correctamente por el cliente?
                                </p>
                            </div>

                            <div className="mb-6">
                                <p className="font-bold text-slate-700 mb-3">¿El cliente ha quedado activado y con servicio?</p>
                                
                                {isActivatedResult === null && (
                                    <div className="grid grid-cols-2 gap-3">
                                        <button 
                                            type="button"
                                            onClick={() => setIsActivatedResult(true)}
                                            className="py-3 px-4 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"
                                        >
                                            <CheckCircle size={18} /> Sí, Activado
                                        </button>
                                        <button 
                                            type="button"
                                            onClick={() => setIsActivatedResult(false)}
                                            className="py-3 px-4 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"
                                        >
                                            <X size={18} /> No se pudo
                                        </button>
                                    </div>
                                )}

                                {isActivatedResult === true && (
                                    <div className="bg-green-50 p-4 rounded-xl border border-green-200">
                                        <p className="text-green-700 font-bold text-center flex items-center justify-center gap-2"><CheckCircle size={18} /> Instalación completada</p>
                                    </div>
                                )}

                                {isActivatedResult === false && (
                                    <div className="space-y-3 mt-4 animate-in fade-in zoom-in duration-300">
                                        <label className="text-sm font-bold text-slate-700">Motivo por el que no se pudo activar:</label>
                                        <textarea 
                                            className="w-full border border-slate-300 rounded-xl p-3 focus:ring-2 focus:ring-red-500 outline-none"
                                            rows="3"
                                            placeholder="Ej: Fibra rota, falta splitter, cliente no estaba..."
                                            value={notActivatedReason}
                                            onChange={(e) => setNotActivatedReason(e.target.value)}
                                        ></textarea>
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-3">
                                <button 
                                    type="button"
                                    onClick={() => {
                                        setShowConfirmModal(false);
                                        setIsActivatedResult(null);
                                        setNotActivatedReason('');
                                    }}
                                    className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors"
                                >
                                    Volver
                                </button>
                                {(isActivatedResult === true || (isActivatedResult === false && notActivatedReason.trim())) && (
                                    <button 
                                        type="button"
                                        onClick={(e) => {
                                            setShowConfirmModal(false);
                                            handleSubmit(e, isActivatedResult, notActivatedReason);
                                        }}
                                        className="flex-1 py-3 bg-joa-blue text-white font-bold rounded-xl hover:bg-blue-700 transition-colors"
                                    >
                                        Guardar y Enviar
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {!pdfPath && navigator.onLine && (
                    <p className="text-center text-xs text-red-400 mt-2">
                        {t('activations.must_sign_generate')}
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
                                    {isSigning === 'CLIENT' ? t('activations.client_signature') : t('activations.tech_signature')}
                                </h3>
                                <p className="text-sm text-slate-500">
                                    {isSigning === 'CLIENT' ? t('activations.ask_client_sign') : t('activations.ask_tech_sign')}
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
                                {t('activations.sign_area')}
                            </div>
                        </div>

                        <div className="flex gap-3 mt-4">
                            <button
                                type="button"
                                onClick={() => signaturePadRef.current?.clear()}
                                className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors"
                            >
                                {t('activations.clear_correct')}
                            </button>
                            <button
                                type="button"
                                onClick={handleSignatureSave}
                                className="flex-1 py-3 bg-joa-blue text-white font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
                            >
                                {isSigning === 'CLIENT' ? t('activations.next_tech') : t('activations.finish_generate')}
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
                            <Trash2 size={20} /> {t('activations.delete_photo')}
                        </button>
                    </div>
                )
            }

            {/* Photo Wizard Modal */}
            {photoWizardStep !== 'IDLE' && (
                <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl relative text-center">
                        <button onClick={() => setPhotoWizardStep('IDLE')} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
                            <X size={24} />
                        </button>
                        
                        <div className="mx-auto w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4">
                            <Camera size={32} />
                        </div>

                        {photoWizardStep === 'Q1' && (
                            <>
                                <h3 className="text-xl font-extrabold text-slate-800 mb-2">Paso 1: Filoform</h3>
                                <p className="text-slate-600 mb-6 text-lg font-medium">¿Se ha Colocado Filoform?</p>
                                <div className="flex gap-4">
                                    <button
                                        type="button"
                                        onClick={() => setPhotoWizardStep('UPLOAD_Q1_YES')}
                                        className="flex-1 py-4 bg-joa-blue text-white font-bold rounded-2xl hover:bg-blue-700 transition shadow-lg shadow-blue-200"
                                    >
                                        Sí
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setPhotoWizardStep('UPLOAD_Q1_NO')}
                                        className="flex-1 py-4 bg-slate-200 text-slate-700 font-bold rounded-2xl hover:bg-slate-300 transition"
                                    >
                                        No
                                    </button>
                                </div>
                            </>
                        )}

                        {photoWizardStep === 'Q2' && (
                            <>
                                <h3 className="text-xl font-extrabold text-slate-800 mb-2">Paso 2: NVT</h3>
                                <p className="text-slate-600 mb-6 text-lg font-medium">¿Hay fusión en el NVT?</p>
                                <div className="flex gap-4">
                                    <button
                                        type="button"
                                        onClick={() => setPhotoWizardStep('UPLOAD_Q2_YES')}
                                        className="flex-1 py-4 bg-joa-blue text-white font-bold rounded-2xl hover:bg-blue-700 transition shadow-lg shadow-blue-200"
                                    >
                                        Sí
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setPhotoWizardStep('UPLOAD_Q3')}
                                        className="flex-1 py-4 bg-slate-200 text-slate-700 font-bold rounded-2xl hover:bg-slate-300 transition"
                                    >
                                        No
                                    </button>
                                </div>
                            </>
                        )}

                        {(photoWizardStep.startsWith('UPLOAD_')) && (
                            <>
                                <h3 className="text-xl font-extrabold text-slate-800 mb-2">Capturar Foto</h3>
                                <p className="text-slate-600 mb-6 font-medium text-lg">
                                    {photoWizardStep === 'UPLOAD_Q1_YES' && 'Sube la foto del Filoform instalado.'}
                                    {photoWizardStep === 'UPLOAD_Q1_NO' && 'Sube la foto del lugar por donde entró la acometida.'}
                                    {photoWizardStep === 'UPLOAD_Q2_YES' && 'Sube la foto de la bandeja del cliente con etiqueta y la fusión.'}
                                    {photoWizardStep === 'UPLOAD_Q3' && 'Sube la foto de AP o ONE Box Abierta y cerrada.'}
                                </p>
                                <div className="flex gap-4">
                                    <button
                                        type="button"
                                        onClick={() => cameraInputRef.current?.click()}
                                        className="flex-1 py-4 bg-joa-blue text-white font-bold rounded-2xl hover:bg-blue-700 transition flex justify-center items-center gap-2 shadow-lg shadow-blue-200 mb-4"
                                    >
                                        <Camera size={20} />
                                        Cámara
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => galleryInputRef.current?.click()}
                                        className="flex-1 py-4 bg-slate-200 text-slate-700 font-bold rounded-2xl hover:bg-slate-300 transition flex justify-center items-center gap-2 mb-4"
                                    >
                                        <ImageIcon size={20} />
                                        Galería
                                    </button>
                                </div>
                                {photoWizardStep === 'UPLOAD_Q3' && (
                                    <p className="text-xs text-slate-400 mt-2">Ésta es la última foto requerida.</p>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}
        </div >
    );
};

export default ActivationPageV2;
