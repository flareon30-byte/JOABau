import React, { useState, useEffect, useRef } from 'react';
import { Camera as CameraIcon, MapPin, CheckCircle, Navigation, Type, MessageSquare, Trash2, ArrowLeft, Image as ImageIcon, Tag, QrCode, Shield, PenTool } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import SignaturePad from 'signature_pad';
import api from '../api/axios';

const GnkInstallationForm = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState(1); // 1: GPS & Info, 2: Photos, 3: Review
    
    // Form State
    const [address, setAddress] = useState({ street: '', number: '', city: '' });
    const [contactName, setContactName] = useState('');
    const [comments, setComments] = useState('');
    const [muenetData, setMuenetData] = useState({
        customerFirstName: '',
        customerLastName: '',
        olt: '',
        pon: '',
        splitterPort: '',
        gponSerialNumber: '',
        isReadyForOperation: true,
        gpsAlt: ''
    });
    const [specialPhotos, setSpecialPhotos] = useState({
        photoHuep: null,
        photoModem: null,
        photoOtdr: null
    });
    const [photos, setPhotos] = useState([]);
    
    // Tech State
    const [loadingLocation, setLoadingLocation] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [gpsCoordinates, setGpsCoordinates] = useState(null);
    const fileInputRef = useRef(null);
    const huepInputRef = useRef(null);
    const modemInputRef = useRef(null);
    const otdrInputRef = useRef(null);
    
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const [availableItems, setAvailableItems] = useState([]);
    const [selectedQuantities, setSelectedQuantities] = useState({}); // itemId -> qty

    // Canvas for image processing
    const canvasRef = useRef(null);
    const signatureCanvasRef = useRef(null);
    const sigPad = useRef(null);

    useEffect(() => {
        if (signatureCanvasRef.current && step === 3) {
            // Delay ensures DOM has calculated accurate offsetWidth/Height
            const timer = setTimeout(() => {
                const canvas = signatureCanvasRef.current;
                if (!canvas) return;
                
                const ratio = Math.max(window.devicePixelRatio || 1, 1);
                canvas.width = canvas.offsetWidth * ratio;
                canvas.height = canvas.offsetHeight * ratio;
                canvas.getContext("2d").scale(ratio, ratio);

                sigPad.current = new SignaturePad(canvas, {
                    backgroundColor: 'rgb(255, 255, 255)', // Solid white for better PDF contrast
                    penColor: 'rgb(0, 0, 0)'
                });
                sigPad.current.clear();
            }, 250); // Increased timeout for slower mobile renders
            return () => clearTimeout(timer);
        }
    }, [step]);

    useEffect(() => {
        if (user.activeClientCompanyId) {
            fetchClientItems();
        }
    }, [user.activeClientCompanyId]);

    const fetchClientItems = async () => {
        try {
            const res = await api.get(`/api/clients/${user.activeClientCompanyId}/price-items`);
            setAvailableItems(res.data);
            // Default quantities to 0
            const defaults = {};
            res.data.forEach(item => {
                defaults[item.id] = 0;
            });
            setSelectedQuantities(defaults);
        } catch (error) {
            console.error('Error fetching client items:', error);
        }
    };

    const handleQuantityChange = (itemId, val) => {
        setSelectedQuantities(prev => ({
            ...prev,
            [itemId]: parseInt(val || 0)
        }));
    };

    const getGPSLocation = () => {
        setLoadingLocation(true);
        setErrorMessage('');
        
        if (!navigator.geolocation) {
            setErrorMessage('Geolocalización no soportada por el navegador.');
            setLoadingLocation(false);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude, altitude } = position.coords;
                setGpsCoordinates({ lat: latitude, lng: longitude, alt: altitude });
                setMuenetData(prev => ({ ...prev, gpsAlt: altitude ? Math.round(altitude) : '' }));
                
                // Reverse Geocoding via Nominatim (OpenStreetMap)
                try {
                    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
                    const data = await res.json();
                    if (data.address) {
                        setAddress({
                            street: data.address.road || '',
                            number: data.address.house_number || '',
                            city: data.address.city || data.address.town || data.address.village || ''
                        });
                    }
                } catch (err) {
                    console.warn("Reverse geocode failed", err);
                    setErrorMessage("Ubicación obtenida, pero no pudimos extraer el nombre de la calle. Por favor, rellénala a mano.");
                }
                setLoadingLocation(false);
            },
            (error) => {
                console.error(error);
                setErrorMessage('Error obteniendo ubicación. Asegúrate de dar permisos de GPS.');
                setLoadingLocation(false);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    };

    const handlePhotoSelect = async (e, targetField = null) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        // Process each image: stamp the address, date, and user on it
        for (const file of files) {
            await processAndStampImage(file, targetField);
        }
        
        // Clear input to allow re-selecting the same file if needed
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (huepInputRef.current) huepInputRef.current.value = '';
        if (modemInputRef.current) modemInputRef.current.value = '';
        if (otdrInputRef.current) otdrInputRef.current.value = '';
    };

    const processAndStampImage = (file, targetField = null) => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = canvasRef.current;
                    const ctx = canvas.getContext('2d');

                    // RESIZE LOGIC: Max 1600px dimension
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

                    // Set canvas size to calculated size
                    canvas.width = width;
                    canvas.height = height;

                    // Draw image scaled
                    ctx.drawImage(img, 0, 0, width, height);

                    // --- DRAW FOOTER STAMP ---
                    // Calculate relative sizes for text
                    const footerHeight = Math.max(120, height * 0.12); // at least 120px or 12%
                    const fontSizeTitle = Math.max(24, Math.floor(height * 0.025));
                    const fontSizeBody = Math.max(18, Math.floor(height * 0.018));
                    const padding = fontSizeBody;

                    // Draw semi-transparent background at the bottom
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
                    ctx.fillRect(0, height - footerHeight, width, footerHeight);

                    // Prepare text data
                    const timestampStr = new Date().toLocaleString('es-ES', { dateStyle: 'long', timeStyle: 'short' });
                    const addrStr = `${address.street || 'Calle desconocida'} ${address.number || ''}, ${address.city || ''}`.trim();
                    const techStr = `Técnico: ${user.username || 'Desconocido'}`;
                    const customClientStr = user.activeClientCompany?.name || 'Cliente';

                    // Draw Text
                    ctx.fillStyle = '#FFFFFF';
                    ctx.textAlign = 'left';
                    ctx.textBaseline = 'top';

                    // Draw active client tag
                    ctx.font = `bold ${fontSizeBody}px Arial`;
                    ctx.fillStyle = '#06b6d4'; // Cyan
                    ctx.fillText(customClientStr.toUpperCase(), padding, height - footerHeight + padding);

                    // Draw Address
                    ctx.font = `bold ${fontSizeTitle}px Arial`;
                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillText(addrStr, padding, height - footerHeight + padding + fontSizeBody + 10);

                    // Draw Timestamp
                    ctx.font = `${fontSizeBody}px Arial`;
                    ctx.fillText(`📅 ${timestampStr}`, padding, height - footerHeight + padding + fontSizeBody + fontSizeTitle + 20);

                    // Draw Tech Name (Aligned Right)
                    ctx.textAlign = 'right';
                    ctx.fillText(`👤 ${techStr}`, width - padding, height - footerHeight + padding + fontSizeBody + fontSizeTitle + 20);

                    // Export with standard quality (0.7) to save data / avoid Nginx limits
                    const stampedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
                    
                    // We will store the original coordinates if available
                    fetch(stampedDataUrl).then(res => res.blob()).then(blob => {
                        const newFile = new File([blob], `stamped_${file.name}`, { type: 'image/jpeg' });
                        const preview = URL.createObjectURL(newFile);
                        
                        if (targetField) {
                            setSpecialPhotos(prev => ({
                                ...prev,
                                [targetField]: { file: newFile, preview }
                            }));
                        } else {
                            setPhotos(prev => [...prev, {
                                file: newFile,
                                preview,
                                originalName: file.name
                            }]);
                        }
                        resolve();
                    });
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        });
    };

    const removePhoto = (index) => {
        setPhotos(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async () => {
        if (!address.street) {
            setErrorMessage('La calle de la dirección es obligatoria.');
            return;
        }
        if (sigPad.current && sigPad.current.isEmpty()) {
            setErrorMessage('La firma del cliente es obligatoria para este informe profesional.');
            return;
        }

        setIsSubmitting(true);
        setErrorMessage('');
        
        try {
            const formData = new FormData();
            formData.append('contactName', contactName || '');
            formData.append('comments', comments || '');
            formData.append('addressInfo', JSON.stringify(address));
            
            // MUENET Fields
            Object.entries(muenetData).forEach(([key, val]) => {
                formData.append(key, val);
            });
            if (gpsCoordinates) {
                formData.append('gpsLat', gpsCoordinates.lat);
                formData.append('gpsLng', gpsCoordinates.lng);
            }

            // Categorized Photos
            if (specialPhotos.photoHuep) formData.append('photoHuep', specialPhotos.photoHuep.file);
            if (specialPhotos.photoModem) formData.append('photoModem', specialPhotos.photoModem.file);
            if (specialPhotos.photoOtdr) formData.append('photoOtdr', specialPhotos.photoOtdr.file);

            // Signature
            if (sigPad.current) {
                const sigDataUrl = sigPad.current.toDataURL();
                const sigBlob = await fetch(sigDataUrl).then(res => res.blob());
                formData.append('signature', sigBlob, 'signature.png');
            }
            
            // Items
            const itemsToSubmit = Object.entries(selectedQuantities)
                .filter(([_, qty]) => qty > 0)
                .map(([itemId, qty]) => ({ priceItemId: itemId, quantity: qty }));
            formData.append('itemsJSON', JSON.stringify(itemsToSubmit));
            
            photos.forEach(p => {
                formData.append('photos', p.file);
            });

            await api.post('/api/simple-installations', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            setSuccessMessage('¡Ficha profesional enviada con éxito!');
            setTimeout(() => { navigate('/dashboard'); }, 2000);

        } catch (error) {
            console.error(error);
            const serverMsg = error.response?.data?.details || error.response?.data?.message;
            const targetUrl = api.defaults.baseURL === '/' ? window.location.origin : api.defaults.baseURL;
            setErrorMessage(serverMsg ? `Error: ${serverMsg}` : `Hubo un problema al enviar la ficha a ${targetUrl}. Revisa la conexión.`);
            setIsSubmitting(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto pb-24">
            {/* Hidden canvas for image processing */}
            <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>

            <div className="flex items-center gap-4 mb-8">
                <button onClick={() => navigate('/dashboard')} className="p-2 bg-slate-200 hover:bg-slate-300 rounded-full text-slate-700 transition-colors">
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Nueva Ficha de Instalación</h1>
                    <p className="text-sm text-slate-500 font-medium">{user.activeClientCompany?.name || 'Cargando cliente...'}</p>
                </div>
            </div>

            {errorMessage && (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-6 shadow-sm border border-red-100 flex items-center gap-2">
                    <CheckCircle className="rotate-45" size={20} />
                    {errorMessage}
                </div>
            )}
            
            {successMessage && (
                <div className="bg-green-50 text-green-700 p-4 rounded-xl mb-6 shadow-sm border border-green-100 flex items-center gap-2">
                    <CheckCircle size={20} />
                    {successMessage}
                </div>
            )}

            {/* Steps Indicator */}
            <div className="flex gap-2 mb-8 select-none">
                <div className={`flex-1 h-2 rounded-full ${step >= 1 ? 'bg-joa-blue' : 'bg-slate-200'}`}></div>
                <div className={`flex-1 h-2 rounded-full ${step >= 2 ? 'bg-joa-blue' : 'bg-slate-200'}`}></div>
                <div className={`flex-1 h-2 rounded-full ${step >= 3 ? 'bg-joa-blue' : 'bg-slate-200'}`}></div>
            </div>

            <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 p-6 md:p-8 border border-slate-100">

                {step === 1 && (
                    <div className="space-y-6 animate-fadeIn">
                        <div className="flex items-center justify-between mb-2">
                            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <MapPin className="text-joa-blue" />
                                1. Ubicación y Contacto
                            </h2>
                            <button 
                                onClick={getGPSLocation}
                                disabled={loadingLocation}
                                className="bg-blue-50 hover:bg-blue-100 text-joa-blue px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
                            >
                                <Navigation size={16} />
                                {loadingLocation ? 'Buscando...' : 'Auto-Localizar (GPS)'}
                            </button>
                        </div>

                        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
                            <div className="grid grid-cols-3 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Calle</label>
                                    <input 
                                        type="text" 
                                        value={address.street}
                                        onChange={(e) => setAddress({...address, street: e.target.value})}
                                        placeholder="Ej: Hauptstraße"
                                        className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-joa-blue outline-none" 
                                    />
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Núm</label>
                                    <input 
                                        type="text" 
                                        value={address.number}
                                        onChange={(e) => setAddress({...address, number: e.target.value})}
                                        placeholder="Ej: 14"
                                        className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-joa-blue outline-none" 
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Ciudad / Pueblo</label>
                                <input 
                                    type="text" 
                                    value={address.city}
                                    onChange={(e) => setAddress({...address, city: e.target.value})}
                                    className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-joa-blue outline-none" 
                                />
                            </div>
                        </div>

                        {/* DYNAMIC PRICE ITEMS */}
                        {availableItems.length > 0 && (
                            <div className="space-y-4 pt-2">
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                                    <Tag size={14} className="text-joa-blue" /> Unidades Instaladas ({user.activeClientCompany?.name})
                                </label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {availableItems.map(item => (
                                        <div key={item.id} className="bg-white border border-slate-200 p-3 rounded-2xl flex items-center justify-between shadow-sm hover:border-joa-blue transition-colors">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-700 text-sm">{item.name}</span>
                                                <span className="text-[10px] text-slate-400 font-bold uppercase">{item.department}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button 
                                                    onClick={() => handleQuantityChange(item.id, Math.max(0, (selectedQuantities[item.id] || 0) - 1))}
                                                    className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500 active:bg-slate-200"
                                                >
                                                    -
                                                </button>
                                                <input 
                                                    type="number" 
                                                    value={selectedQuantities[item.id] || 0}
                                                    onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                                                    className="w-12 text-center font-black text-joa-blue focus:outline-none"
                                                />
                                                <button 
                                                    onClick={() => handleQuantityChange(item.id, (selectedQuantities[item.id] || 0) + 1)}
                                                    className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500 active:bg-slate-200"
                                                >
                                                    +
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* NEW MUENET FIELDS */}
                        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 mt-6 space-y-4">
                            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-2">
                                <Shield className="text-joa-blue" size={16} /> Datos del Cliente y Red
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Nombre (Vorname)</label>
                                    <input 
                                        type="text" 
                                        value={muenetData.customerFirstName}
                                        onChange={(e) => setMuenetData({...muenetData, customerFirstName: e.target.value})}
                                        className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-joa-blue outline-none text-sm" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Apellido (Name)</label>
                                    <input 
                                        type="text" 
                                        value={muenetData.customerLastName}
                                        onChange={(e) => setMuenetData({...muenetData, customerLastName: e.target.value})}
                                        className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-joa-blue outline-none text-sm" 
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">OLT</label>
                                    <input 
                                        type="text" 
                                        value={muenetData.olt}
                                        onChange={(e) => setMuenetData({...muenetData, olt: e.target.value})}
                                        placeholder="Ej: OLT 2"
                                        className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-joa-blue outline-none text-sm" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">PON</label>
                                    <input 
                                        type="text" 
                                        value={muenetData.pon}
                                        onChange={(e) => setMuenetData({...muenetData, pon: e.target.value})}
                                        placeholder="Splitter 2"
                                        className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-joa-blue outline-none text-sm" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Port</label>
                                    <input 
                                        type="number" 
                                        value={muenetData.splitterPort}
                                        onChange={(e) => setMuenetData({...muenetData, splitterPort: e.target.value})}
                                        placeholder="41"
                                        className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-joa-blue outline-none text-sm" 
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                                    <QrCode size={12} /> GPON Serial (GNXS...)
                                </label>
                                <input 
                                    type="text" 
                                    value={muenetData.gponSerialNumber}
                                    onChange={(e) => setMuenetData({...muenetData, gponSerialNumber: e.target.value})}
                                    placeholder="GNXS05DF..."
                                    className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-joa-blue outline-none text-sm font-mono" 
                                />
                            </div>
                        </div>

                        <div className="pt-2 flex items-center gap-3">
                            <label className="flex items-center gap-3 cursor-pointer group">
                                <input 
                                    type="checkbox" 
                                    checked={muenetData.isReadyForOperation}
                                    onChange={(e) => setMuenetData({...muenetData, isReadyForOperation: e.target.checked})}
                                    className="w-5 h-5 rounded border-slate-300 text-joa-blue focus:ring-joa-blue"
                                />
                                <span className="text-sm font-bold text-slate-700">Anschluss betriebsbereit (Conexión Lista)</span>
                            </label>
                        </div>

                        <div className="pt-2">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                                <MessageSquare size={14} /> Comentarios / Notas de Instalación
                            </label>
                            <textarea 
                                value={comments}
                                onChange={(e) => setComments(e.target.value)}
                                placeholder="Añade detalles del trabajo realizado, problemas encontrados..."
                                className="w-full h-32 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-joa-blue outline-none resize-none transition-all" 
                            />
                        </div>

                        <div className="pt-4 text-right">
                            <button 
                                onClick={() => {
                                    if(!address.street) setErrorMessage('Por favor, indica la calle antes de continuar.');
                                    else setStep(2);
                                }}
                                className="bg-joa-blue hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-xl shadow-lg shadow-blue-500/30 transition-transform hover:scale-105"
                            >
                                Siguiente: Fotos
                            </button>
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div className="space-y-6 animate-fadeIn">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <CameraIcon className="text-joa-blue" />
                                2. Fotografías (Marcadas)
                            </h2>
                        </div>

                        <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl text-sm text-blue-800 flex gap-3 items-start mb-6 font-medium">
                            <Shield size={18} className="text-blue-500 shrink-0 mt-0.5" />
                            <p>
                                Para generar el informe profesional, es necesario tomar las siguientes fotos específicas. 
                                Se les imprimirá un pie de página con los datos de red y ubicación.
                            </p>
                        </div>

                        {/* Categorized Photos */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                            {/* PHOTO HUEP */}
                            <div className="space-y-2">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Foto HÜP (Offen)</label>
                                <div className="relative aspect-square rounded-2xl overflow-hidden border-2 border-slate-200 bg-slate-50 flex items-center justify-center group">
                                    {specialPhotos.photoHuep ? (
                                        <>
                                            <img src={specialPhotos.photoHuep.preview} className="w-full h-full object-cover" />
                                            <button onClick={() => setSpecialPhotos({...specialPhotos, photoHuep: null})} className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Trash2 size={16} />
                                            </button>
                                        </>
                                    ) : (
                                        <button onClick={() => huepInputRef.current.click()} className="flex flex-col items-center text-slate-400 hover:text-joa-blue transition-colors">
                                            <CameraIcon size={32} />
                                            <span className="text-[10px] font-bold mt-1">CAPTURAR</span>
                                        </button>
                                    )}
                                    <input type="file" accept="image/*" capture="environment" className="hidden" ref={huepInputRef} onChange={(e) => handlePhotoSelect(e, 'photoHuep')} />
                                </div>
                            </div>

                            {/* PHOTO MODEM */}
                            <div className="space-y-2">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Foto Modem</label>
                                <div className="relative aspect-square rounded-2xl overflow-hidden border-2 border-slate-200 bg-slate-50 flex items-center justify-center group">
                                    {specialPhotos.photoModem ? (
                                        <>
                                            <img src={specialPhotos.photoModem.preview} className="w-full h-full object-cover" />
                                            <button onClick={() => setSpecialPhotos({...specialPhotos, photoModem: null})} className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Trash2 size={16} />
                                            </button>
                                        </>
                                    ) : (
                                        <button onClick={() => modemInputRef.current.click()} className="flex flex-col items-center text-slate-400 hover:text-joa-blue transition-colors">
                                            <CameraIcon size={32} />
                                            <span className="text-[10px] font-bold mt-1">CAPTURAR</span>
                                        </button>
                                    )}
                                    <input type="file" accept="image/*" capture="environment" className="hidden" ref={modemInputRef} onChange={(e) => handlePhotoSelect(e, 'photoModem')} />
                                </div>
                            </div>

                            {/* PHOTO OTDR */}
                            <div className="space-y-2">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Foto OTDR</label>
                                <div className="relative aspect-square rounded-2xl overflow-hidden border-2 border-slate-200 bg-slate-50 flex items-center justify-center group">
                                    {specialPhotos.photoOtdr ? (
                                        <>
                                            <img src={specialPhotos.photoOtdr.preview} className="w-full h-full object-cover" />
                                            <button onClick={() => setSpecialPhotos({...specialPhotos, photoOtdr: null})} className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Trash2 size={16} />
                                            </button>
                                        </>
                                    ) : (
                                        <button onClick={() => otdrInputRef.current.click()} className="flex flex-col items-center text-slate-400 hover:text-joa-blue transition-colors">
                                            <CameraIcon size={32} />
                                            <span className="text-[10px] font-bold mt-1">CAPTURAR</span>
                                        </button>
                                    )}
                                    <input type="file" accept="image/*" capture="environment" className="hidden" ref={otdrInputRef} onChange={(e) => handlePhotoSelect(e, 'photoOtdr')} />
                                </div>
                            </div>
                        </div>

                        <div className="border-t border-slate-100 pt-6">
                            <h3 className="text-sm font-bold text-slate-600 mb-4 flex items-center gap-2">
                                <ImageIcon size={18} className="text-slate-400" /> Otras Fotos Adicionales
                            </h3>
                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-4 mb-4">
                                {photos.map((photo, index) => (
                                    <div key={index} className="relative aspect-square rounded-2xl overflow-hidden border-2 border-slate-200 group bg-slate-50">
                                        <img src={photo.preview} alt={`Foto ${index+1}`} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <button type="button" onClick={() => removePhoto(index)} className="bg-red-500 text-white p-2 rounded-full hover:bg-red-600 transition-colors shadow-lg">
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                ))}

                                <label className="border-2 border-dashed border-slate-300 hover:border-joa-blue hover:bg-blue-50 rounded-2xl aspect-square flex flex-col items-center justify-center text-slate-400 hover:text-joa-blue cursor-pointer transition-colors">
                                    <CameraIcon size={24} className="mb-1" />
                                    <span className="text-[10px] font-bold">Añadir</span>
                                    <input 
                                        type="file" 
                                        accept="image/*" 
                                        capture="environment" 
                                        multiple 
                                        className="hidden" 
                                        ref={fileInputRef}
                                        onChange={handlePhotoSelect} 
                                    />
                                </label>
                            </div>
                        </div>

                        <div className="pt-6 border-t border-slate-100 flex justify-between">
                            <button 
                                onClick={() => setStep(1)}
                                className="px-6 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-colors"
                            >
                                Atrás
                            </button>
                            <button 
                                onClick={() => setStep(3)}
                                className="bg-joa-blue hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-xl shadow-lg transition-transform hover:scale-105"
                            >
                                Revisar y Enviar
                            </button>
                        </div>
                    </div>
                )}

                {step === 3 && (
                    <div className="space-y-6 animate-fadeIn">
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2 mb-6">
                            <CheckCircle className="text-green-500" />
                            3. Revisión Final y Firma
                        </h2>

                        <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Cliente</h4>
                                    <p className="text-sm font-bold text-slate-800 truncate">
                                        {muenetData.customerFirstName} {muenetData.customerLastName}
                                    </p>
                                </div>
                                <div>
                                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Dirección</h4>
                                    <p className="text-sm font-bold text-slate-800 truncate">
                                        {address.street} {address.number}
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-200">
                                <div>
                                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">OLT</h4>
                                    <p className="text-sm font-semibold text-slate-700">{muenetData.olt || '-'}</p>
                                </div>
                                <div>
                                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">PON</h4>
                                    <p className="text-sm font-semibold text-slate-700">{muenetData.pon || '-'}</p>
                                </div>
                                <div>
                                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Port</h4>
                                    <p className="text-sm font-semibold text-slate-700">{muenetData.splitterPort || '-'}</p>
                                </div>
                            </div>

                            <div className="pt-3 border-t border-slate-200">
                                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">GPON Serial</h4>
                                <p className="text-sm font-mono font-bold text-slate-700">{muenetData.gponSerialNumber || 'No definido'}</p>
                            </div>

                            {/* Review Items */}
                            {Object.entries(selectedQuantities).some(([_, qty]) => qty > 0) && (
                                <div className="pt-3 border-t border-slate-200">
                                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Unidades Instaladas</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {availableItems.filter(i => selectedQuantities[i.id] > 0).map(item => (
                                            <div key={item.id} className="bg-joa-blue/10 border border-joa-blue/20 px-2 py-1 rounded-lg flex items-center gap-2">
                                                <span className="font-bold text-joa-blue text-xs">{selectedQuantities[item.id]}x</span>
                                                <span className="text-[10px] font-medium text-slate-700">{item.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* SIGNATURE SECTION */}
                            <div className="pt-4 border-t border-slate-200">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                    <PenTool size={12} /> Firma del Cliente
                                </label>
                                <div className="bg-white border-2 border-slate-200 rounded-2xl overflow-hidden relative">
                                    <canvas 
                                        ref={signatureCanvasRef} 
                                        className="w-full h-48 touch-none cursor-crosshair"
                                    ></canvas>
                                    <button 
                                        type="button"
                                        onClick={() => sigPad.current && sigPad.current.clear()}
                                        className="absolute bottom-2 right-2 text-[10px] font-bold text-slate-400 hover:text-red-500 transition-colors uppercase px-3 py-1 bg-slate-100 rounded-lg"
                                    >
                                        Limpiar
                                    </button>
                                </div>
                                <p className="text-[10px] text-slate-400 mt-2 italic text-center">
                                    Al firmar, el cliente confirma que la instalación ha sido realizada correctamente y está operativa.
                                </p>
                            </div>
                        </div>

                        <div className="pt-6 flex gap-4">
                            <button 
                                onClick={() => setStep(2)}
                                className="flex-1 py-4 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                            >
                                Volver
                            </button>
                            <button 
                                onClick={handleSubmit}
                                disabled={isSubmitting}
                                className="flex-[2] bg-green-500 hover:bg-green-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-green-500/30 transition-all flex items-center justify-center gap-2"
                            >
                                {isSubmitting ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        Enviando...
                                    </>
                                ) : (
                                    <>Enviar Informe Profesional</>
                                )}
                            </button>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};

export default GnkInstallationForm;
