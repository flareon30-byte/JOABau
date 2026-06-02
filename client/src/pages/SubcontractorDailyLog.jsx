import React, { useState, useEffect, useRef } from 'react';
import api from '../api/axios';
import { 
    Calendar, Users, ClipboardList, MapPin, CheckCircle, Clock, 
    Image as ImageIcon, Map, Plus, Trash2, Camera, Compass, 
    BrainCircuit, Check, Loader2, X, AlertTriangle 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const SubcontractorDailyLog = () => {
    const navigate = useNavigate();
    const [leafletLoaded, setLeafletLoaded] = useState(false);
    const [assignedPipes, setAssignedPipes] = useState([]);
    const [searchResults, setSearchResults] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loadingPipes, setLoadingPipes] = useState(true);
    const [uploadingPhotos, setUploadingPhotos] = useState(false);

    // Main Report State
    const [peoplePresent, setPeoplePresent] = useState(1);
    const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
    const [reportComments, setReportComments] = useState('');

    // Active Connection Log form state
    const [selectedAddress, setSelectedAddress] = useState(null);
    const [connectionStatus, setConnectionStatus] = useState('PLANIFICADO'); // SIN_TUBO, PLANIFICADO, HECHO
    const [connectionComments, setConnectionComments] = useState('');
    const [connectionPhotos, setConnectionPhotos] = useState([]);
    const [connectionReady, setConnectionReady] = useState(false);
    
    // Active Duct Log form state
    const [ductPhotos, setDuctPhotos] = useState([]);
    const [ductComments, setDuctComments] = useState('');
    const [processingDuct, setProcessingDuct] = useState(false);
    const [calculatedDuct, setCalculatedDuct] = useState(null);
    const [ductConfirmed, setDuctConfirmed] = useState(false);

    // List of accumulated items for the submission
    const [addedConnections, setAddedConnections] = useState([]);
    const [addedDucts, setAddedDucts] = useState([]);
    
    const [submittingReport, setSubmittingReport] = useState(false);
    const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });

    const previewMapRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const polylineRef = useRef(null);

    // Load Leaflet dynamically
    useEffect(() => {
        const linkId = 'leaflet-css';
        if (!document.getElementById(linkId)) {
            const link = document.createElement('link');
            link.id = linkId;
            link.rel = 'stylesheet';
            link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
            document.head.appendChild(link);
        }

        let iv = null;
        const scriptId = 'leaflet-js';
        if (!document.getElementById(scriptId)) {
            const script = document.createElement('script');
            script.id = scriptId;
            script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
            script.onload = () => setLeafletLoaded(true);
            document.body.appendChild(script);
        } else {
            if (window.L) {
                setLeafletLoaded(true);
            } else {
                iv = setInterval(() => {
                    if (window.L) {
                        setLeafletLoaded(true);
                        clearInterval(iv);
                    }
                }, 100);
            }
        }

        return () => {
            if (iv) clearInterval(iv);
        };
    }, []);

    // Load assigned pipes
    const fetchAssignedPipes = async () => {
        try {
            const res = await api.get('/api/civil-works/assigned-pipes');
            setAssignedPipes(res.data || []);
        } catch (error) {
            console.error('Error fetching assigned pipes:', error);
        } finally {
            setLoadingPipes(false);
        }
    };

    useEffect(() => {
        fetchAssignedPipes();
    }, []);

    // Handle Address Search
    useEffect(() => {
        if (!searchQuery.trim()) {
            setSearchResults([]);
            return;
        }
        const delayDebounce = setTimeout(async () => {
            try {
                const res = await api.get(`/api/civil-works/addresses?query=${encodeURIComponent(searchQuery)}`);
                setSearchResults(res.data || []);
            } catch (err) {
                console.error('Error searching addresses:', err);
            }
        }, 300);
        return () => clearTimeout(delayDebounce);
    }, [searchQuery]);

    // Handle Geolocation lookup
    const handleGeolocateAddress = () => {
        if (!navigator.geolocation) {
            alert('La geolocalización no está soportada por tu navegador.');
            return;
        }
        setLoadingPipes(true);
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                try {
                    // Log operator's current location to backend first
                    await api.post('/api/civil-works/location', {
                        lat: pos.coords.latitude,
                        lng: pos.coords.longitude,
                        action: 'GEOLOCATE_SEARCH'
                    });

                    // Retrieve closest addresses by query
                    const res = await api.get('/api/civil-works/addresses?query=');
                    // Compute distance manually to sort closest
                    const sorted = (res.data || []).map(addr => {
                        const latDiff = (addr.gpsLat || 49.8) - pos.coords.latitude;
                        const lngDiff = (addr.gpsLng || 8.0) - pos.coords.longitude;
                        const dist = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);
                        return { ...addr, distance: dist };
                    }).sort((a, b) => a.distance - b.distance);

                    setSearchResults(sorted.slice(0, 10));
                    if (sorted.length > 0) {
                        setStatusMsg({ type: 'success', text: `Ubicación GPS obtenida. Direcciones más cercanas cargadas en la lista.` });
                    } else {
                        setStatusMsg({ type: 'warning', text: `GPS OK, pero no hay direcciones cargadas en el sistema.` });
                    }
                } catch (e) {
                    console.error(e);
                    alert('Error buscando dirección por geolocalización.');
                } finally {
                    setLoadingPipes(false);
                }
            },
            (err) => {
                console.warn(err);
                alert('No se pudo obtener la geolocalización. Revisa los permisos de ubicación en tu móvil.');
                setLoadingPipes(false);
            },
            { enableHighAccuracy: true }
        );
    };

    // Generic Image Uploader
    const handlePhotoUpload = async (e, type) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        setUploadingPhotos(true);
        const formData = new FormData();
        files.forEach(file => {
            formData.append('photos', file);
        });

        try {
            const res = await api.post('/api/uploads', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            const uploadedUrls = res.data.urls || [];
            
            if (type === 'connection') {
                setConnectionPhotos(prev => [...prev, ...uploadedUrls]);
            } else if (type === 'duct') {
                setDuctPhotos(prev => [...prev, ...uploadedUrls]);
            }
        } catch (error) {
            console.error('Error uploading photos:', error);
            alert('Error al subir fotos al servidor.');
        } finally {
            setUploadingPhotos(false);
        }
    };

    // Process Duct Route with Gemini AI
    const handleProcessDuct = async () => {
        if (ductPhotos.length < 2) {
            alert('Necesitas subir al menos 2 fotos del trayecto del ducto (ej: inicio y final) con geolocalización activa.');
            return;
        }

        setProcessingDuct(true);
        try {
            const res = await api.post('/api/ai/process-duct-route', {
                photos: ductPhotos,
                comments: ductComments
            });

            if (res.data.status === 'ok') {
                setCalculatedDuct(res.data);
                setDuctConfirmed(false); // Reset confirmation
                
                // Initialize/Update preview map
                setTimeout(() => {
                    renderDuctPreviewMap(res.data);
                }, 200);
            }
        } catch (err) {
            console.error('Error processing duct with AI:', err);
            alert(err.response?.data?.message || 'Error al procesar el trayecto con la IA. Asegúrate de que las fotos tengan datos GPS EXIF.');
        } finally {
            setProcessingDuct(false);
        }
    };

    // Render Leaflet Route Preview
    const renderDuctPreviewMap = (ductData) => {
        if (!leafletLoaded || !previewMapRef.current || !window.L) return;
        const L = window.L;

        const coords = ductData.coordinates.map(c => [c.lat, c.lng]);
        if (coords.length === 0) return;

        if (!mapInstanceRef.current) {
            mapInstanceRef.current = L.map(previewMapRef.current, { zoomControl: false }).setView(coords[0], 17);
            L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; OpenStreetMap'
            }).addTo(mapInstanceRef.current);
        } else {
            mapInstanceRef.current.setView(coords[0], 17);
        }

        // Clean previous polyline
        if (polylineRef.current) {
            mapInstanceRef.current.removeLayer(polylineRef.current);
        }

        // Draw new polyline
        polylineRef.current = L.polyline(coords, { color: '#8b5cf6', weight: 4, dashArray: '5, 8' }).addTo(mapInstanceRef.current);
        mapInstanceRef.current.fitBounds(L.latLngBounds(coords), { padding: [20, 20] });

        // Add start and end circle markers
        L.circleMarker(coords[0], { color: '#22c55e', fillOpacity: 0.8, radius: 6 }).addTo(mapInstanceRef.current).bindPopup('Punto de Inicio');
        L.circleMarker(coords[coords.length - 1], { color: '#ef4444', fillOpacity: 0.8, radius: 6 }).addTo(mapInstanceRef.current).bindPopup('Punto Final');
    };

    // Add connection to local report list
    const handleAddConnection = () => {
        if (!selectedAddress) {
            alert('Debes seleccionar una dirección física.');
            return;
        }

        const newLog = {
            addressId: selectedAddress.id,
            addressName: `${selectedAddress.street} ${selectedAddress.number || ''} (${selectedAddress.city || ''})`,
            nvt: selectedAddress.nvt,
            status: connectionReady ? 'HECHO' : connectionStatus,
            comments: connectionComments,
            photos: connectionPhotos,
            ready: connectionReady
        };

        setAddedConnections(prev => [...prev, newLog]);
        
        // Reset connection form
        setSelectedAddress(null);
        setConnectionStatus('PLANIFICADO');
        setConnectionComments('');
        setConnectionPhotos([]);
        setConnectionReady(false);
        setSearchQuery('');
        
        setStatusMsg({ type: 'success', text: 'Acometida añadida al parte del día.' });
    };

    // Add calculated duct to local report list
    const handleAddDuct = () => {
        if (!calculatedDuct) return;
        if (!ductConfirmed) {
            alert('Debes confirmar que estás de acuerdo con la distancia calculada y el trayecto.');
            return;
        }

        const newDuct = {
            photos: ductPhotos,
            comments: ductComments,
            startLat: calculatedDuct.startPoint.lat,
            startLng: calculatedDuct.startPoint.lng,
            endLat: calculatedDuct.endPoint.lat,
            endLng: calculatedDuct.endPoint.lng,
            coordinates: calculatedDuct.coordinates,
            distance: calculatedDuct.distance,
            confirmed: true
        };

        setAddedDucts(prev => [...prev, newDuct]);

        // Reset duct form
        setDuctPhotos([]);
        setDuctComments('');
        setCalculatedDuct(null);
        setDuctConfirmed(false);
        if (mapInstanceRef.current) {
            mapInstanceRef.current.remove();
            mapInstanceRef.current = null;
        }

        setStatusMsg({ type: 'success', text: 'Ducto de calle añadido al parte del día.' });
    };

    // Remove added connection item
    const handleRemoveConnection = (idx) => {
        setAddedConnections(prev => prev.filter((_, i) => i !== idx));
    };

    // Remove added duct item
    const handleRemoveDuct = (idx) => {
        setAddedDucts(prev => prev.filter((_, i) => i !== idx));
    };

    // Submit complete daily report to database
    const handleSubmitDailyReport = async () => {
        if (addedConnections.length === 0 && addedDucts.length === 0) {
            alert('Debes añadir al menos una acometida o un ducto de calle para poder enviar el parte.');
            return;
        }

        setSubmittingReport(true);
        setStatusMsg({ type: '', text: '' });

        try {
            const payload = {
                date: reportDate,
                peoplePresent: parseInt(peoplePresent) || 1,
                comments: reportComments,
                workLogs: addedConnections,
                ductLogs: addedDucts
            };

            await api.post('/api/civil-works/daily-report', payload);
            setStatusMsg({ type: 'success', text: 'Parte diario enviado correctamente y guardado en el sistema.' });
            
            // Clear all state
            setAddedConnections([]);
            setAddedDucts([]);
            setReportComments('');
            setPeoplePresent(1);
            
            // Redirect after 2s
            setTimeout(() => {
                navigate('/dashboard/civil-works-map');
            }, 2000);

        } catch (error) {
            console.error('Error submitting daily report:', error);
            setStatusMsg({ type: 'error', text: error.response?.data?.message || 'Error al enviar el parte diario.' });
        } finally {
            setSubmittingReport(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-20">
            {/* Header */}
            <div className="bg-[#0a0f1c] rounded-[2rem] p-8 text-white shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-white/5 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl pointer-events-none"></div>
                <div className="relative z-10 flex items-center gap-4">
                    <div className="bg-orange-500/20 p-3 rounded-2xl text-orange-400">
                        <ClipboardList size={32} />
                    </div>
                    <div>
                        <h2 className="text-3xl font-black font-heading">Reporte Diario de Trabajo</h2>
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Obra Civil & Acometidas</p>
                    </div>
                </div>
            </div>

            {/* Notifications */}
            {statusMsg.text && (
                <div className={`p-4 rounded-2xl flex items-start gap-3 border shadow-sm animate-in fade-in duration-200 ${
                    statusMsg.type === 'success' 
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                        : statusMsg.type === 'warning' 
                            ? 'bg-amber-50 text-amber-800 border-amber-200' 
                            : 'bg-red-50 text-red-800 border-red-200'
                }`}>
                    <div className="mt-0.5">
                        {statusMsg.type === 'error' ? <AlertTriangle size={18} /> : <CheckCircle size={18} />}
                    </div>
                    <p className="text-sm font-semibold">{statusMsg.text}</p>
                    <button onClick={() => setStatusMsg({ type: '', text: '' })} className="ml-auto p-0.5 text-slate-400 hover:text-slate-600">
                        <X size={16} />
                    </button>
                </div>
            )}

            {/* General Info Card */}
            <div className="glass-panel bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-6">
                <h3 className="text-lg font-black text-slate-800 flex items-center gap-2 border-b border-slate-50 pb-3">
                    <Users size={18} className="text-slate-400" /> Información General de la Jornada
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Fecha del Trabajo</label>
                        <div className="relative">
                            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="date"
                                value={reportDate}
                                onChange={(e) => setReportDate(e.target.value)}
                                className="w-full pl-12 pr-4 py-3.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 font-semibold text-slate-800 transition-all bg-slate-50/30"
                                required
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Operarios Trabajando Hoy</label>
                        <div className="relative">
                            <Users className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="number"
                                min="1"
                                value={peoplePresent}
                                onChange={(e) => setPeoplePresent(e.target.value)}
                                className="w-full pl-12 pr-4 py-3.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 font-semibold text-slate-800 transition-all bg-slate-50/30"
                                required
                            />
                        </div>
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Comentarios Generales del Parte</label>
                    <textarea
                        value={reportComments}
                        onChange={(e) => setReportComments(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl p-4 outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-slate-700 min-h-[80px]"
                        placeholder="Ej: Retraso en calle Colón por lluvia, material recibido completo."
                    />
                </div>
            </div>

            {/* Acometidas Report Form */}
            <div className="glass-panel bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-6">
                <h3 className="text-lg font-black text-slate-800 flex items-center gap-2 border-b border-slate-50 pb-3">
                    <MapPin size={18} className="text-orange-500" /> Reportar Acometidas (Por Dirección)
                </h3>

                <div className="space-y-4">
                    {/* Lista de Acometidas Asignadas */}
                    {assignedPipes.length > 0 && (
                        <div className="space-y-2">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest">Mis Acometidas Asignadas (Hacer clic para seleccionar)</label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-44 overflow-y-auto p-3 bg-slate-50 rounded-2xl border border-slate-100/80">
                                {assignedPipes.map(addr => {
                                    const isSelected = selectedAddress?.id === addr.id;
                                    return (
                                        <button
                                            key={addr.id}
                                            type="button"
                                            onClick={() => {
                                                setSelectedAddress(addr);
                                                setSearchResults([]);
                                                setSearchQuery('');
                                            }}
                                            className={`text-left p-3 rounded-xl border transition-all flex justify-between items-center text-xs font-semibold ${
                                                isSelected 
                                                    ? 'bg-orange-500/10 border-orange-500 text-orange-800 ring-2 ring-orange-500/20' 
                                                    : 'bg-white hover:bg-orange-50/40 border-slate-200/60 text-slate-700 hover:border-orange-200'
                                            }`}
                                        >
                                            <div className="truncate pr-2">
                                                <span className="font-extrabold block truncate">{addr.street} {addr.number || ''}</span>
                                                <span className="text-[9px] text-slate-400 font-bold block mt-0.5">NVT: {addr.nvt || 'N/A'}</span>
                                            </div>
                                            <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full shrink-0 ${
                                                addr.civilWorkStatus === 'HECHO'
                                                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                                    : addr.civilWorkStatus === 'PLANIFICADO'
                                                        ? 'bg-amber-50 text-amber-600 border border-amber-100'
                                                        : 'bg-slate-100 text-slate-500 border border-slate-200'
                                            }`}>
                                                {addr.civilWorkStatus || 'SIN_TUBO'}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Address Selection Search */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Buscar Dirección Asignada</label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Introduce calle, portal o NVT..."
                                    className="w-full pl-12 pr-4 py-3.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-slate-800 transition-all"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={handleGeolocateAddress}
                                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 rounded-xl flex items-center gap-2 font-semibold text-sm transition-colors border border-slate-200"
                                title="Buscar direcciones cercanas usando GPS"
                            >
                                <Compass size={18} className="text-slate-500" />
                                {loadingPipes ? 'Buscando...' : 'GPS'}
                            </button>
                        </div>

                        {/* Search Results Dropdown */}
                        {searchResults.length > 0 && (
                            <div className="border border-slate-200 rounded-2xl mt-2 max-h-52 overflow-y-auto bg-white shadow-lg p-2 space-y-1 z-50 relative">
                                <div className="text-[10px] font-bold text-slate-400 uppercase p-2 tracking-wider">Direcciones Encontradas</div>
                                {searchResults.map(addr => (
                                    <div
                                        key={addr.id}
                                        onClick={() => {
                                            setSelectedAddress(addr);
                                            setSearchResults([]);
                                            setSearchQuery('');
                                        }}
                                        className="p-3 hover:bg-orange-50/50 rounded-xl cursor-pointer text-sm font-semibold text-slate-700 flex justify-between items-center transition-colors border border-transparent hover:border-orange-100"
                                    >
                                        <div>
                                            <span>{addr.street} {addr.number || ''}</span>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">NVT: {addr.nvt || 'N/A'} - {addr.project?.name}</p>
                                        </div>
                                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                                            addr.civilWorkStatus === 'HECHO' 
                                                ? 'bg-emerald-50 text-emerald-600' 
                                                : addr.civilWorkStatus === 'PLANIFICADO' 
                                                    ? 'bg-amber-50 text-amber-600' 
                                                    : 'bg-slate-100 text-slate-500'
                                        }`}>
                                            {addr.civilWorkStatus || 'SIN_TUBO'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Selected Address Fields */}
                    {selectedAddress ? (
                        <div className="bg-orange-50/20 border border-orange-100 rounded-3xl p-5 space-y-5 animate-in slide-in-from-top-3 duration-200">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h4 className="font-extrabold text-slate-800 text-base">{selectedAddress.street} {selectedAddress.number}</h4>
                                    <p className="text-xs font-bold text-slate-500 uppercase mt-0.5">Ciudad: {selectedAddress.city || 'No especificada'} | NVT: {selectedAddress.nvt || 'Sin NVT'}</p>
                                </div>
                                <button 
                                    onClick={() => setSelectedAddress(null)}
                                    className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-lg transition-colors"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Estado del portal</label>
                                    <select
                                        value={connectionStatus}
                                        onChange={(e) => setConnectionStatus(e.target.value)}
                                        className="w-full border border-slate-200 rounded-xl p-3 bg-white font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                    >
                                        <option value="SIN_TUBO">Gris - Sin Tubo</option>
                                        <option value="PLANIFICADO">Amarillo - Citado o Planificado</option>
                                        <option value="HECHO">Verde - Tubo Colocado (Listo para soplado)</option>
                                    </select>
                                </div>

                                <div className="flex items-center">
                                    <label className="flex items-center gap-3 cursor-pointer mt-6 p-1 select-none">
                                        <input
                                            type="checkbox"
                                            checked={connectionReady}
                                            onChange={(e) => setConnectionReady(e.target.checked)}
                                            className="w-5 h-5 accent-emerald-500 border border-slate-300 rounded cursor-pointer"
                                        />
                                        <div>
                                            <span className="font-bold text-sm text-slate-800">¡Acometida Lista! (Verde)</span>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase">Marcar que el tubo ya está en la puerta del cliente</p>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            {/* Photos upload */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Fotos de la Acometida</label>
                                <div className="flex flex-wrap gap-3 items-center">
                                    {connectionPhotos.map((url, idx) => (
                                        <div key={idx} className="w-20 h-20 rounded-xl overflow-hidden border border-slate-200 relative bg-slate-100 group">
                                            <img src={url} alt="Acometida upload" className="w-full h-full object-cover" />
                                            <button
                                                type="button"
                                                onClick={() => setConnectionPhotos(prev => prev.filter((_, i) => i !== idx))}
                                                className="absolute top-1 right-1 bg-black/60 hover:bg-black text-white p-0.5 rounded-full"
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>
                                    ))}
                                    
                                    <label className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-300 hover:border-orange-500 flex flex-col items-center justify-center cursor-pointer transition-colors bg-white relative">
                                        {uploadingPhotos ? (
                                            <Loader2 className="animate-spin text-orange-500" size={20} />
                                        ) : (
                                            <>
                                                <Camera size={20} className="text-slate-400" />
                                                <span className="text-[9px] font-bold text-slate-400 uppercase mt-1">Fotos</span>
                                            </>
                                        )}
                                        <input
                                            type="file"
                                            multiple
                                            accept="image/*"
                                            onChange={(e) => handlePhotoUpload(e, 'connection')}
                                            className="hidden"
                                            disabled={uploadingPhotos}
                                        />
                                    </label>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Comentarios de la acometida</label>
                                <textarea
                                    value={connectionComments}
                                    onChange={(e) => setConnectionComments(e.target.value)}
                                    className="w-full border border-slate-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-slate-700 min-h-[60px] text-sm"
                                    placeholder="Detalles sobre el tubo colocado..."
                                />
                            </div>

                            <button
                                type="button"
                                onClick={handleAddConnection}
                                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors active:scale-95 shadow-md shadow-orange-500/10"
                            >
                                <Plus size={16} /> Añadir Acometida al Parte
                            </button>
                        </div>
                    ) : (
                        <div className="border border-slate-100 rounded-2xl bg-slate-50/50 p-6 text-center text-slate-500 text-sm">
                            Selecciona una dirección arriba o pulsa "GPS" para buscar portales cercanos.
                        </div>
                    )}
                </div>
            </div>

            {/* Street Duct Report Form */}
            <div className="glass-panel bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-6">
                <h3 className="text-lg font-black text-slate-800 flex items-center gap-2 border-b border-slate-50 pb-3">
                    <Map size={18} className="text-purple-600" /> Reportar Ducto en Calle (Zanja)
                </h3>

                <div className="space-y-4">
                    <div className="bg-purple-50/30 border border-purple-100/50 rounded-3xl p-5 space-y-5">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Evidencias del Trayecto (Fotos con GPS activado)</label>
                            <p className="text-[10px] text-slate-400 font-bold uppercase mb-3 leading-relaxed">
                                Toma fotos a lo largo de la zanja. Subiendo la primera y última foto (o varias a lo largo), la IA de Gemini calculará automáticamente la longitud e identificará el trazado.
                            </p>
                            <div className="flex flex-wrap gap-3 items-center">
                                {ductPhotos.map((url, idx) => (
                                    <div key={idx} className="w-20 h-20 rounded-xl overflow-hidden border border-slate-200 relative bg-slate-100 group">
                                        <img src={url} alt="Duct upload" className="w-full h-full object-cover" />
                                        <button
                                            type="button"
                                            onClick={() => setDuctPhotos(prev => prev.filter((_, i) => i !== idx))}
                                            className="absolute top-1 right-1 bg-black/60 hover:bg-black text-white p-0.5 rounded-full"
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                ))}
                                
                                <label className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-300 hover:border-purple-500 flex flex-col items-center justify-center cursor-pointer transition-colors bg-white relative">
                                    {uploadingPhotos ? (
                                        <Loader2 className="animate-spin text-purple-600" size={20} />
                                    ) : (
                                        <>
                                            <Camera size={20} className="text-slate-400" />
                                            <span className="text-[9px] font-bold text-slate-400 uppercase mt-1">Fotos GPS</span>
                                        </>
                                    )}
                                    <input
                                        type="file"
                                        multiple
                                        accept="image/*"
                                        onChange={(e) => handlePhotoUpload(e, 'duct')}
                                        className="hidden"
                                        disabled={uploadingPhotos}
                                    />
                                </label>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Comentarios del Ducto</label>
                            <textarea
                                value={ductComments}
                                onChange={(e) => setDuctComments(e.target.value)}
                                className="w-full border border-slate-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 text-slate-700 min-h-[60px] text-sm"
                                placeholder="Ej: Zanja de 110mm de diámetro bajo calzada, cruzando calle principal."
                            />
                        </div>

                        <button
                            type="button"
                            onClick={handleProcessDuct}
                            disabled={processingDuct || ductPhotos.length < 2}
                            className={`w-full text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 ${
                                ductPhotos.length >= 2 
                                    ? 'bg-purple-600 hover:bg-purple-700 shadow-purple-600/10' 
                                    : 'bg-slate-300 cursor-not-allowed shadow-none'
                            }`}
                        >
                            {processingDuct ? (
                                <>
                                    <Loader2 className="animate-spin" size={18} />
                                    La IA de Gemini está analizando las fotos GPS...
                                </>
                            ) : (
                                <>
                                    <BrainCircuit size={18} />
                                    Calcular Trazado y Distancia con Gemini AI
                                </>
                            )}
                        </button>
                    </div>

                    {/* Calculated duct results panel */}
                    {calculatedDuct && (
                        <div className="border border-purple-100 bg-purple-50/10 rounded-3xl p-6 space-y-6 animate-in zoom-in-95 duration-200">
                            <h4 className="font-extrabold text-slate-800 text-base flex items-center gap-2 text-purple-700">
                                <CheckCircle size={18} /> Trazado Calculado por la IA
                            </h4>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex flex-col justify-center">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Distancia del ducto</span>
                                    <span className="text-3xl font-black text-slate-800">{calculatedDuct.distance} <span className="text-base font-bold text-slate-500">metros</span></span>
                                </div>

                                <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Resumen del Trazado</span>
                                    <p className="text-sm font-semibold text-slate-700 leading-relaxed mt-1">"{calculatedDuct.summary}"</p>
                                </div>
                            </div>

                            {/* Leaflet preview map block */}
                            <div className="space-y-2">
                                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Previsualización del Recorrido</span>
                                <div ref={previewMapRef} className="h-60 w-full rounded-2xl border border-slate-100 bg-slate-50 overflow-hidden relative" />
                            </div>

                            {/* Consent Checkbox */}
                            <div className="bg-white rounded-2xl p-4 border border-purple-100 flex items-start gap-3">
                                <input
                                    type="checkbox"
                                    id="conformity-check"
                                    checked={ductConfirmed}
                                    onChange={(e) => setDuctConfirmed(e.target.checked)}
                                    className="w-5 h-5 accent-purple-600 border border-slate-300 rounded mt-0.5 cursor-pointer"
                                />
                                <label htmlFor="conformity-check" className="text-sm text-slate-700 font-semibold cursor-pointer select-none">
                                    Confirmo que el ducto se colocó en esta posición y estoy de acuerdo con la distancia calculada ({calculatedDuct.distance}m).
                                </label>
                            </div>

                            <button
                                type="button"
                                onClick={handleAddDuct}
                                disabled={!ductConfirmed}
                                className={`w-full text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors ${
                                    ductConfirmed 
                                        ? 'bg-purple-600 hover:bg-purple-700 active:scale-95 shadow-lg shadow-purple-600/10' 
                                        : 'bg-slate-300 cursor-not-allowed'
                                }`}
                            >
                                <Plus size={16} /> Añadir Ducto al Parte
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Added list overview */}
            <div className="glass-panel bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-6">
                <h3 className="text-lg font-black text-slate-800 flex items-center gap-2 border-b border-slate-50 pb-3">
                    <ClipboardList size={18} className="text-slate-400" /> Resumen de Trabajos a Enviar Hoy
                </h3>

                <div className="space-y-6">
                    {/* Connections */}
                    <div className="space-y-3">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                            Acometidas registradas ({addedConnections.length})
                        </h4>
                        
                        {addedConnections.length === 0 ? (
                            <p className="text-sm text-slate-400 italic bg-slate-50/50 rounded-2xl p-4 text-center border border-slate-100">
                                Ninguna acometida añadida todavía en esta jornada.
                            </p>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {addedConnections.map((item, idx) => (
                                    <div key={idx} className="bg-slate-50 rounded-2xl p-4 border border-slate-150 flex justify-between items-start">
                                        <div>
                                            <h5 className="font-extrabold text-slate-800 text-sm">{item.addressName}</h5>
                                            <div className="flex gap-2 items-center mt-1">
                                                <span className="text-[9px] bg-slate-200 text-slate-600 font-bold px-1.5 py-0.5 rounded">NVT: {item.nvt || 'N/A'}</span>
                                                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${
                                                    item.ready 
                                                        ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                                                        : 'bg-amber-50 text-amber-600 border-amber-100'
                                                }`}>
                                                    {item.ready ? 'HECHO (Lista)' : item.status}
                                                </span>
                                            </div>
                                            {item.comments && <p className="text-xs text-slate-500 italic mt-2">"{item.comments}"</p>}
                                        </div>
                                        <button 
                                            onClick={() => handleRemoveConnection(idx)}
                                            className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                                            title="Quitar"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Ducts */}
                    <div className="space-y-3">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                            Ductos de calle (Zanjas) ({addedDucts.length})
                        </h4>

                        {addedDucts.length === 0 ? (
                            <p className="text-sm text-slate-400 italic bg-slate-50/50 rounded-2xl p-4 text-center border border-slate-100">
                                Ningún ducto de calle añadido todavía.
                            </p>
                        ) : (
                            <div className="space-y-3">
                                {addedDucts.map((item, idx) => (
                                    <div key={idx} className="bg-slate-50 rounded-2xl p-4 border border-slate-150 flex justify-between items-center">
                                        <div>
                                            <h5 className="font-extrabold text-slate-800 text-sm">Zanja / Ducto de Calle - {item.distance} metros</h5>
                                            {item.comments && <p className="text-xs text-slate-500 italic mt-0.5">"{item.comments}"</p>}
                                        </div>
                                        <button 
                                            onClick={() => handleRemoveDuct(idx)}
                                            className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                                            title="Quitar"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Actions Footer */}
            <div className="flex justify-end gap-4">
                <button
                    type="button"
                    onClick={() => {
                        if (window.confirm('¿Seguro que deseas cancelar el parte? Los datos no guardados se perderán.')) {
                            navigate('/dashboard/civil-works-map');
                        }
                    }}
                    className="px-6 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl font-bold hover:bg-slate-50 transition-colors shadow-sm"
                >
                    Cancelar y Salir
                </button>
                
                <button
                    type="button"
                    onClick={handleSubmitDailyReport}
                    disabled={submittingReport || (addedConnections.length === 0 && addedDucts.length === 0)}
                    className={`px-8 py-4 text-white rounded-2xl font-bold flex items-center gap-2 transition-all shadow-lg active:scale-95 ${
                        submittingReport || (addedConnections.length === 0 && addedDucts.length === 0)
                            ? 'bg-slate-300 cursor-not-allowed shadow-none'
                            : 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-orange-500/20'
                    }`}
                >
                    {submittingReport ? (
                        <>
                            <Loader2 className="animate-spin" size={18} />
                            Enviando Parte...
                        </>
                    ) : (
                        <>
                            <Check size={18} />
                            Enviar Parte Diario Completo
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

export default SubcontractorDailyLog;
