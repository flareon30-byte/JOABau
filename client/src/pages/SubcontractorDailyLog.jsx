import React, { useState, useEffect, useRef } from 'react';
import api from '../api/axios';
import { 
    Calendar, Users, ClipboardList, MapPin, CheckCircle, Clock, 
    Image as ImageIcon, Map, Plus, Trash2, Camera, Compass, 
    BrainCircuit, Check, Loader2, X, AlertTriangle 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const CONNECTION_COLORS = [
    'rojo', 'verde', 'azul', 'amarillo', 'blanco', 'gris', 'marron', 'violeta', 'turquesa', 'negro', 'naranja', 'rosa',
    'Rojo-raya', 'verde-raya', 'azul-raya', 'amarillo-raya', 'blanco-raya', 'gris-raya', 'marron-raya', 'violeta-raya', 'turquesa-raya', 'negro-raya'
];

const getColorStyle = (colorName) => {
    if (!colorName) return {};
    const isStripe = colorName.endsWith('-raya');
    const baseName = isStripe ? colorName.split('-')[0] : colorName;
    
    const colorMap = {
        rojo: '#ef4444',
        verde: '#22c55e',
        azul: '#3b82f6',
        amarillo: '#facc15',
        blanco: '#ffffff',
        gris: '#6b7280',
        marron: '#78350f',
        violeta: '#a855f7',
        turquesa: '#14b8a6',
        negro: '#0f172a',
        naranja: '#f97316',
        rosa: '#ec4899'
    };
    
    const key = baseName.toLowerCase();
    const colorHex = colorMap[key] || '#cbd5e1';
    
    if (isStripe) {
        const stripeColor = key === 'blanco' ? '#000000' : '#ffffff';
        return {
            background: `repeating-linear-gradient(135deg, ${colorHex}, ${colorHex} 6px, ${stripeColor} 6px, ${stripeColor} 12px)`,
            border: '1.5px solid #94a3b8'
        };
    } else {
        return {
            backgroundColor: colorHex,
            border: key === 'blanco' ? '1.5px solid #cbd5e1' : `1.5px solid ${colorHex}`
        };
    }
};

// Clean and validate coordinate arrays
const cleanCoordinates = (coords) => {
    if (!coords) return [];
    let parsed = coords;
    if (typeof coords === 'string') {
        try {
            parsed = JSON.parse(coords);
        } catch (e) {
            return [];
        }
    }
    if (!Array.isArray(parsed)) return [];
    return parsed
        .map(pt => {
            if (!pt) return null;
            const lat = typeof pt.lat === 'number' ? pt.lat : (typeof pt.latitude === 'number' ? pt.latitude : parseFloat(pt.lat));
            const lng = typeof pt.lng === 'number' ? pt.lng : (typeof pt.longitude === 'number' ? pt.longitude : parseFloat(pt.lng));
            if (isNaN(lat) || isNaN(lng)) return null;
            return {
                ...pt,
                lat,
                lng
            };
        })
        .filter(Boolean);
};

const getPerpendicularOffset = (p1, p2, offsetDeg) => {
    const latDiff = p2.lat - p1.lat;
    const lngDiff = p2.lng - p1.lng;
    const len = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);
    if (len === 0) return { latOffset: 0, lngOffset: 0 };
    return {
        latOffset: (-lngDiff / len) * offsetDeg,
        lngOffset: (latDiff / len) * offsetDeg
    };
};

const offsetPolyline = (coordinates, offsetMeters) => {
    const coords = cleanCoordinates(coordinates);
    if (coords.length === 0) return [];
    if (coords.length < 2) return coords;
    if (offsetMeters === 0) return coords;
    
    const offsetDeg = offsetMeters * 0.000009; // 1 meter ~ 0.000009 degrees
    const newCoords = [];
    
    for (let i = 0; i < coords.length; i++) {
        let latOffset = 0;
        let lngOffset = 0;
        
        if (i === 0) {
            const offset = getPerpendicularOffset(coords[0], coords[1], offsetDeg);
            latOffset = offset.latOffset;
            lngOffset = offset.lngOffset;
        } else if (i === coords.length - 1) {
            const offset = getPerpendicularOffset(coords[i - 1], coords[i], offsetDeg);
            latOffset = offset.latOffset;
            lngOffset = offset.lngOffset;
        } else {
            const offset1 = getPerpendicularOffset(coords[i - 1], coords[i], offsetDeg);
            const offset2 = getPerpendicularOffset(coords[i], coords[i + 1], offsetDeg);
            latOffset = (offset1.latOffset + offset2.latOffset) / 2;
            lngOffset = (offset1.lngOffset + offset2.lngOffset) / 2;
        }
        
        newCoords.push({
            lat: coords[i].lat + latOffset,
            lng: coords[i].lng + lngOffset
        });
    }
    return newCoords;
};

const SubcontractorDailyLog = () => {
    const navigate = useNavigate();
    const [leafletLoaded, setLeafletLoaded] = useState(false);
    const [assignedPipes, setAssignedPipes] = useState([]);
    const [searchResults, setSearchResults] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loadingPipes, setLoadingPipes] = useState(true);
    const [uploadingPhotos, setUploadingPhotos] = useState(false);

    // Returned Logs State
    const [returnedLogs, setReturnedLogs] = useState({ workLogs: [], ductLogs: [], hpLogs: [] });
    const [loadingReturned, setLoadingReturned] = useState(false);

    // Correction Modal State
    const [correctionModalOpen, setCorrectionModalOpen] = useState(false);
    const [selectedCorrectionLog, setSelectedCorrectionLog] = useState(null); // { log, type: 'work' | 'duct' }
    const [correctedPhotos, setCorrectedPhotos] = useState([]);
    const [correctedComments, setCorrectedComments] = useState('');
    const [correctedDistance, setCorrectedDistance] = useState('');
    const [submittingCorrection, setSubmittingCorrection] = useState(false);

    const getFileUrl = (path) => {
        if (!path) return '';
        if (path.startsWith('http://') || path.startsWith('https://')) return path;
        let cleanPath = path.split('?')[0].replace(/\\/g, '/');
        if (!cleanPath.startsWith('/')) cleanPath = '/' + cleanPath;
        let baseUrl = api.defaults.baseURL || '';
        if (baseUrl === '/') baseUrl = '';
        if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
        const encodedPath = cleanPath.split('/').map(segment => encodeURIComponent(segment)).join('/');
        return `${baseUrl}${encodedPath}`;
    };

    const fetchReturnedLogs = async () => {
        setLoadingReturned(true);
        try {
            const res = await api.get('/api/civil-works/returned');
            setReturnedLogs(res.data || { workLogs: [], ductLogs: [], hpLogs: [] });
        } catch (error) {
            console.error('Error fetching returned logs:', error);
        } finally {
            setLoadingReturned(false);
        }
    };

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
    const [connectionColor, setConnectionColor] = useState('');
    
    // Active Duct Log form state
    const [ductPhotos, setDuctPhotos] = useState([]);
    const [ductCoordinates, setDuctCoordinates] = useState([]);
    const [ductComments, setDuctComments] = useState('');
    const [processingDuct, setProcessingDuct] = useState(false);
    const [calculatedDuct, setCalculatedDuct] = useState(null);
    const [ductConfirmed, setDuctConfirmed] = useState(false);
    const [ductType, setDuctType] = useState('7x22');

    // List of accumulated items for the submission
    const [addedConnections, setAddedConnections] = useState([]);
    const [addedDucts, setAddedDucts] = useState([]);
    
    // NVT Log State
    const [addedNvts, setAddedNvts] = useState([]);
    const [nvtStatus, setNvtStatus] = useState('COMPLETED');
    const [nvtComments, setNvtComments] = useState('');
    const [nvtPhotoUrl, setNvtPhotoUrl] = useState(null);
    const [nvtGps, setNvtGps] = useState(null);

    // HP+ Log State (Bolas Naranjas)
    const [addedHps, setAddedHps] = useState([]);
    const [hpSelectedAddress, setHpSelectedAddress] = useState(null);
    const [hpQuantity, setHpQuantity] = useState(1);
    const [hpComments, setHpComments] = useState('');
    const [hpPhotos, setHpPhotos] = useState([]);
    const [hpGpsData, setHpGpsData] = useState([]);
    const [hpSearchQuery, setHpSearchQuery] = useState('');
    const [hpSearchResults, setHpSearchResults] = useState([]);
    
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
        fetchReturnedLogs();
    }, []);

    // Recolor polyline live when ductType changes
    useEffect(() => {
        if (polylineRef.current) {
            const color = ductType === '10x6' ? '#ec4899' : '#f97316';
            polylineRef.current.setStyle({ color });
        }
    }, [ductType]);

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

    // Generic Image Uploader — now captures GPS data from server response
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
            const gpsData = res.data.gpsData || uploadedUrls.map(() => null);

            if (type === 'connection') {
                setConnectionPhotos(prev => [...prev, ...uploadedUrls]);
            } else if (type === 'duct') {
                setDuctPhotos(prev => [...prev, ...uploadedUrls]);
            } else if (type === 'hp') {
                setHpPhotos(prev => [...prev, ...uploadedUrls]);
                setHpGpsData(prev => [...prev, ...gpsData]);
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
        if (!leafletLoaded || !previewMapRef.current || !window.L || !ductData) return;
        const L = window.L;

        const cleaned = cleanCoordinates(ductData.coordinates);
        const coords = cleaned.map(c => [c.lat, c.lng]);
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
        if (ductType === 'ambos') {
            const coordsOrange = offsetPolyline(ductData.coordinates, -2.5);
            const pathOrange = coordsOrange.map(pt => [pt.lat, pt.lng]);
            const polylineOrange = L.polyline(pathOrange, { color: '#f97316', weight: 4, dashArray: '5, 8' }).addTo(mapInstanceRef.current);
            
            const coordsPink = offsetPolyline(ductData.coordinates, 2.5);
            const pathPink = coordsPink.map(pt => [pt.lat, pt.lng]);
            const polylinePink = L.polyline(pathPink, { color: '#ec4899', weight: 4, dashArray: '5, 8' }).addTo(mapInstanceRef.current);
            
            polylineRef.current = L.featureGroup([polylineOrange, polylinePink]).addTo(mapInstanceRef.current);
        } else {
            const color = ductType === '10x6' ? '#ec4899' : '#f97316';
            polylineRef.current = L.polyline(coords, { color: color, weight: 4, dashArray: '5, 8' }).addTo(mapInstanceRef.current);
        }
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

        const isHecho = connectionReady || connectionStatus === 'HECHO';

        if (isHecho && connectionPhotos.length === 0) {
            alert('Debes subir al menos una foto de comprobación (profundidad, bola colocada, posición, etc.) para marcar la acometida como lista.');
            return;
        }

        if (isHecho && !connectionColor) {
            alert('Debes seleccionar en qué color se ha realizado la conexión.');
            return;
        }

        const newLog = {
            addressId: selectedAddress.id,
            addressName: `${selectedAddress.street} ${selectedAddress.number || ''} (${selectedAddress.city || ''})`,
            nvt: selectedAddress.nvt,
            status: isHecho ? 'HECHO' : connectionStatus,
            comments: connectionComments,
            photos: connectionPhotos,
            ready: isHecho,
            connectionColor: isHecho ? connectionColor : null
        };

        setAddedConnections(prev => [...prev, newLog]);
        
        // Reset connection form
        setSelectedAddress(null);
        setConnectionStatus('PLANIFICADO');
        setConnectionComments('');
        setConnectionPhotos([]);
        setConnectionReady(false);
        setConnectionColor('');
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
            confirmed: true,
            ductType: ductType
        };

        setAddedDucts(prev => [...prev, newDuct]);

        // Reset duct form
        setDuctPhotos([]);
        setDuctComments('');
        setCalculatedDuct(null);
        setDuctConfirmed(false);
        setDuctType('7x22');
        if (mapInstanceRef.current) {
            mapInstanceRef.current.remove();
            mapInstanceRef.current = null;
        }

        setStatusMsg({ type: 'success', text: 'Ducto de calle añadido al parte del día.' });
    };

    const handleAddNvt = () => {
        if (!nvtPhotoUrl) {
            alert('Debe subir una foto del NVT.');
            return;
        }
        
        // Let's ask for the NVT box name (e.g. NVT 12, Muffa 5) if we can select or prompt one
        const nvtName = window.prompt("Introduce el nombre/código de la caja NVT (ej: NVT-01):");
        if (!nvtName) {
            alert("Es obligatorio introducir un nombre o código para identificar el NVT.");
            return;
        }

        setAddedNvts([...addedNvts, {
            nvtName: nvtName,
            status: nvtStatus,
            comments: nvtComments,
            photos: [nvtPhotoUrl],
            lat: nvtGps ? nvtGps.lat : null,
            lng: nvtGps ? nvtGps.lng : null
        }]);
        
        setNvtStatus('COMPLETED');
        setNvtComments('');
        setNvtPhotoUrl(null);
        setNvtGps(null);
        setStatusMsg({ type: 'success', text: `NVT "${nvtName}" añadido al parte.` });
    };

    // Correction Handlers
    const openCorrectionModal = (log, type) => {
        setSelectedCorrectionLog({ log, type });
        const goodPhotos = (log.photos || []).filter(p => !(log.incorrectPhotos || []).includes(p));
        setCorrectedPhotos(goodPhotos);
        setCorrectedComments(log.comments || '');
        if (type === 'duct') {
            setCorrectedDistance(log.distance ? log.distance.toString() : '');
        } else {
            setCorrectedDistance('');
        }
        setCorrectionModalOpen(true);
    };

    const handleCorrectionPhotoUpload = async (e) => {
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
            setCorrectedPhotos(prev => [...prev, ...uploadedUrls]);
        } catch (error) {
            console.error('Error uploading correction photos:', error);
            alert('Error al subir fotos al servidor.');
        } finally {
            setUploadingPhotos(false);
        }
    };

    const submitCorrection = async () => {
        if (!selectedCorrectionLog) return;
        if (correctedPhotos.length === 0) {
            alert('Por favor, suba al menos una foto correcta para reenviar el trabajo.');
            return;
        }
        setSubmittingCorrection(true);
        try {
            const endpoint = selectedCorrectionLog.type === 'work'
                ? `/api/civil-works/work-log/${selectedCorrectionLog.log.id}/resubmit`
                : selectedCorrectionLog.type === 'duct'
                    ? `/api/civil-works/duct-log/${selectedCorrectionLog.log.id}/resubmit`
                    : `/api/civil-works/hp-log/${selectedCorrectionLog.log.id}/resubmit`;

            const payload = {
                photos: correctedPhotos,
                comments: correctedComments
            };

            if (selectedCorrectionLog.type === 'duct') {
                payload.distance = parseFloat(correctedDistance) || undefined;
            }

            await api.put(endpoint, payload);
            setCorrectionModalOpen(false);
            setStatusMsg({ type: 'success', text: 'Trabajo corregido y reenviado a revisión correctamente.' });
            
            fetchReturnedLogs();
            fetchAssignedPipes();
        } catch (error) {
            console.error('Error resubmitting correction:', error);
            alert('Error al reenviar el trabajo corregido.');
        } finally {
            setSubmittingCorrection(false);
        }
    };

    // Remove added connection item
    const handleRemoveConnection = (idx) => {
        setAddedConnections(prev => prev.filter((_, i) => i !== idx));
    };

    // Remove added duct item
    const removeDuct = (index) => {
        setAddedDucts(addedDucts.filter((_, i) => i !== index));
    };

    const removeNvt = (index) => {
        setAddedNvts(addedNvts.filter((_, i) => i !== index));
    };

    // HP+ search debounce
    useEffect(() => {
        if (!hpSearchQuery.trim()) { setHpSearchResults([]); return; }
        const delay = setTimeout(async () => {
            try {
                const res = await api.get(`/api/civil-works/addresses?query=${encodeURIComponent(hpSearchQuery)}`);
                setHpSearchResults(res.data || []);
            } catch (err) { console.error('HP+ search error:', err); }
        }, 300);
        return () => clearTimeout(delay);
    }, [hpSearchQuery]);

    const handleAddHp = () => {
        if (hpPhotos.length === 0) {
            alert('Debes subir al menos una foto de la HP+ colocada.');
            return;
        }
        const firstGps = hpGpsData.find(g => g && g.lat && g.lng);
        const lat = firstGps?.lat || hpSelectedAddress?.gpsLat || null;
        const lng = firstGps?.lng || hpSelectedAddress?.gpsLng || null;

        setAddedHps(prev => [...prev, {
            addressId: hpSelectedAddress?.id || null,
            addressName: hpSelectedAddress
                ? `${hpSelectedAddress.street} ${hpSelectedAddress.number || ''} (${hpSelectedAddress.city || ''})`
                : null,
            quantity: parseInt(hpQuantity) || 1,
            lat,
            lng,
            photos: hpPhotos,
            comments: hpComments
        }]);
        setHpSelectedAddress(null);
        setHpQuantity(1);
        setHpComments('');
        setHpPhotos([]);
        setHpGpsData([]);
        setHpSearchQuery('');
        setHpSearchResults([]);
        setStatusMsg({ type: 'success', text: 'HP+ añadida al parte del día.' });
    };

    const removeHp = (index) => {
        setAddedHps(addedHps.filter((_, i) => i !== index));
    };

    // Submit complete daily report to database
    const handleSubmitDailyReport = async () => {
        if (addedConnections.length === 0 && addedDucts.length === 0 && addedNvts.length === 0 && addedHps.length === 0) {
            alert('Debes añadir al menos una acometida, ducto, NVT o HP+ para poder enviar el parte.');
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
                ductLogs: addedDucts,
                nvtLogs: addedNvts,
                hpLogs: addedHps
            };

            await api.post('/api/civil-works/daily-report', payload);
            setStatusMsg({ type: 'success', text: 'Parte diario enviado correctamente y guardado en el sistema.' });
            
            // Clear all state
            setAddedConnections([]);
            setAddedDucts([]);
            setAddedNvts([]);
            setAddedHps([]);
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

            {/* Trabajos Devueltos Section */}
            {(returnedLogs.workLogs.length > 0 || returnedLogs.ductLogs.length > 0 || (returnedLogs.hpLogs && returnedLogs.hpLogs.length > 0)) && (
                <div className="glass-panel bg-white rounded-3xl p-6 shadow-sm border-2 border-rose-200 space-y-4">
                    <div className="flex items-center gap-2 border-b border-rose-50 pb-3">
                        <AlertTriangle className="text-rose-500 animate-pulse shrink-0" size={24} />
                        <div>
                            <h3 className="text-lg font-black text-rose-955">Trabajos Devueltos (Revisión Fallida)</h3>
                            <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mt-0.5">
                                Tienes trabajos rechazados por el cliente. Revise los motivos y reenvíelos.
                            </p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {/* Returned Work Logs (Acometidas) */}
                        {returnedLogs.workLogs.map((wl) => (
                            <div key={wl.id} className="bg-rose-50/20 border border-rose-100 rounded-2xl p-4 space-y-3">
                                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                                    <div>
                                        <span className="text-[10px] bg-rose-100 text-rose-800 font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">Acometida Rechazada</span>
                                        <h4 className="font-extrabold text-slate-800 text-sm mt-1">{wl.address?.street} {wl.address?.number}</h4>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">NVT: {wl.address?.nvt || 'Sin NVT'} | Proyecto: {wl.address?.project?.name}</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => openCorrectionModal(wl, 'work')}
                                        className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 self-start"
                                    >
                                        <BrainCircuit size={14} /> Corregir y Reenviar
                                    </button>
                                </div>

                                <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 text-xs text-rose-900 font-semibold leading-relaxed">
                                    <strong>Motivo de rechazo:</strong> "{wl.reviewComments || 'Sin comentarios específicos.'}"
                                </div>

                                <div>
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Fotos del Trabajo:</span>
                                    <div className="flex flex-wrap gap-2.5">
                                        {wl.photos && wl.photos.map((photo, idx) => {
                                            const isIncorrect = (wl.incorrectPhotos || []).includes(photo);
                                            return (
                                                <div key={idx} className={`relative w-20 h-20 rounded-xl overflow-hidden border ${isIncorrect ? 'border-rose-500 ring-2 ring-rose-500/20' : 'border-slate-200'}`}>
                                                    <img src={getFileUrl(photo)} alt="Evidence" className="w-full h-full object-cover" />
                                                    {isIncorrect && (
                                                        <div className="absolute inset-0 bg-rose-500/30 flex items-center justify-center">
                                                            <div className="bg-rose-600 text-white p-0.5 rounded-full shadow-sm" title="Foto Incorrecta">
                                                                <AlertTriangle size={12} />
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        ))}

                        {/* Returned Duct Logs (Ductos) */}
                        {returnedLogs.ductLogs.map((dl) => (
                            <div key={dl.id} className="bg-rose-50/20 border border-rose-100 rounded-2xl p-4 space-y-3">
                                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                                    <div>
                                        <span className="text-[10px] bg-rose-100 text-rose-800 font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">Ducto Rechazado</span>
                                        <h4 className="font-extrabold text-slate-800 text-sm mt-1">Ducto de calle - {dl.distance} metros</h4>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Proyecto: {dl.report?.subcontractor?.projects?.[0]?.name || 'N/A'}</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => openCorrectionModal(dl, 'duct')}
                                        className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 self-start"
                                    >
                                        <BrainCircuit size={14} /> Corregir y Reenviar
                                    </button>
                                </div>

                                <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 text-xs text-rose-900 font-semibold leading-relaxed">
                                    <strong>Motivo de rechazo:</strong> "{dl.reviewComments || 'Sin comentarios específicos.'}"
                                </div>

                                <div>
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Fotos del Ducto:</span>
                                    <div className="flex flex-wrap gap-2.5">
                                        {dl.photos && dl.photos.map((photo, idx) => {
                                            const isIncorrect = (dl.incorrectPhotos || []).includes(photo);
                                            return (
                                                <div key={idx} className={`relative w-20 h-20 rounded-xl overflow-hidden border ${isIncorrect ? 'border-rose-500 ring-2 ring-rose-500/20' : 'border-slate-200'}`}>
                                                    <img src={getFileUrl(photo)} alt="Evidence" className="w-full h-full object-cover" />
                                                    {isIncorrect && (
                                                        <div className="absolute inset-0 bg-rose-500/30 flex items-center justify-center">
                                                            <div className="bg-rose-600 text-white p-0.5 rounded-full shadow-sm" title="Foto Incorrecta">
                                                                <AlertTriangle size={12} />
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        ))}

                        {/* Returned HP+ Logs */}
                        {returnedLogs.hpLogs && returnedLogs.hpLogs.map((hl) => (
                            <div key={hl.id} className="bg-rose-50/20 border border-rose-100 rounded-2xl p-4 space-y-3">
                                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                                    <div>
                                        <span className="text-[10px] bg-orange-100 text-orange-800 font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">HP+ Rechazada</span>
                                        <h4 className="font-extrabold text-slate-800 text-sm mt-1">
                                            {hl.quantity} HP+ {hl.address ? `— ${hl.address.street} ${hl.address.number || ''}` : '— Sin dirección'}
                                        </h4>
                                        {hl.lat && (
                                            <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">📍 GPS: {hl.lat.toFixed(5)}, {hl.lng.toFixed(5)}</p>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => openCorrectionModal(hl, 'hp')}
                                        className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 self-start"
                                    >
                                        <BrainCircuit size={14} /> Corregir y Reenviar
                                    </button>
                                </div>

                                <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 text-xs text-rose-900 font-semibold leading-relaxed">
                                    <strong>Motivo de rechazo:</strong> "{hl.reviewComments || 'Sin comentarios específicos.'}"
                                </div>

                                <div>
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Fotos de la HP+:</span>
                                    <div className="flex flex-wrap gap-2.5">
                                        {hl.photos && hl.photos.map((photo, idx) => {
                                            const isIncorrect = (hl.incorrectPhotos || []).includes(photo);
                                            return (
                                                <div key={idx} className={`relative w-20 h-20 rounded-xl overflow-hidden border ${isIncorrect ? 'border-rose-500 ring-2 ring-rose-500/20' : 'border-slate-200'}`}>
                                                    <img src={getFileUrl(photo)} alt="HP+" className="w-full h-full object-cover" />
                                                    {isIncorrect && (
                                                        <div className="absolute inset-0 bg-rose-500/30 flex items-center justify-center">
                                                            <div className="bg-rose-600 text-white p-0.5 rounded-full shadow-sm" title="Foto Incorrecta">
                                                                <AlertTriangle size={12} />
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
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

                            {(connectionReady || connectionStatus === 'HECHO') && (
                                <div className="space-y-3 bg-[#fffaf5] p-5 rounded-2xl border border-orange-100 shadow-sm animate-in fade-in duration-200">
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest">
                                        Color de la Conexión <span className="text-red-500 font-extrabold">* Obligatorio</span>
                                    </label>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase">Selecciona el color del tubo al que se ha conectado el portal:</p>
                                    <div className="flex flex-wrap gap-2 pt-1">
                                        {CONNECTION_COLORS.map((color) => {
                                            const isSelected = connectionColor === color;
                                            const style = getColorStyle(color);
                                            return (
                                                <button
                                                    key={color}
                                                    type="button"
                                                    onClick={() => setConnectionColor(color)}
                                                    className={`px-3 py-2.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                                                        isSelected
                                                            ? 'bg-orange-500/10 ring-4 ring-orange-500/20 border-orange-500 text-orange-950 font-black scale-[1.03]'
                                                            : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 hover:scale-[1.02]'
                                                    }`}
                                                >
                                                    <span 
                                                        className="w-3.5 h-3.5 rounded-full inline-block shrink-0 shadow-sm" 
                                                        style={style}
                                                    />
                                                    <span className="capitalize">{color.replace('-raya', ' (Raya)')}</span>
                                                    {isSelected && <Check size={12} className="text-orange-600 shrink-0" />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

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
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Medida de Ducto</label>
                            <select
                                value={ductType}
                                onChange={(e) => setDuctType(e.target.value)}
                                className="bg-white border border-slate-200 text-slate-700 text-sm rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500/20 w-full"
                            >
                                <option value="7x22">Conducto 7x22</option>
                                <option value="10x6">Conducto 10x6</option>
                                <option value="ambos">Ambos (7x22 y 10x6 en paralelo)</option>
                            </select>
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

            {/* NVT Section */}
            <div className="glass-panel bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-6">
                <h3 className="text-lg font-black text-slate-800 flex items-center gap-2 border-b border-slate-50 pb-3">
                    <CheckCircle size={18} className="text-emerald-600" /> Reportar NVT
                </h3>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Estado</label>
                        <select
                            value={nvtStatus}
                            onChange={(e) => setNvtStatus(e.target.value)}
                            className="bg-white border border-slate-200 text-slate-700 text-sm rounded-xl px-3.5 py-2.5 w-full focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        >
                            <option value="COMPLETED">Instalado / Completado</option>
                            <option value="INCOMPLETE">Incompleto / Faltan Materiales</option>
                            <option value="PROBLEM">Problema / Brecha</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Comentarios</label>
                        <textarea
                            value={nvtComments}
                            onChange={(e) => setNvtComments(e.target.value)}
                            className="w-full border border-slate-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-700 min-h-[60px] text-sm"
                            placeholder="Comentarios sobre la instalación del NVT..."
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Foto NVT</label>
                        {nvtPhotoUrl ? (
                            <div className="relative inline-block">
                                <img src={getFileUrl(nvtPhotoUrl)} alt="NVT" className="h-32 object-cover rounded-xl border border-slate-200" />
                                <button
                                    onClick={() => setNvtPhotoUrl(null)}
                                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        ) : (
                            <label className="flex items-center justify-center w-full h-32 bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                                <div className="text-center">
                                    <Camera className="mx-auto text-slate-400 mb-2" size={24} />
                                    <span className="text-sm text-slate-500 font-medium">Subir Foto</span>
                                </div>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={async (e) => {
                                        if (e.target.files.length > 0) {
                                            const file = e.target.files[0];
                                            setUploadingPhotos(true);
                                            try {
                                                const formData = new FormData();
                                                formData.append('photo', file);
                                                const res = await api.post('/api/uploads/extract-gps', formData, {
                                                    headers: { 'Content-Type': 'multipart/form-data' }
                                                });
                                                setNvtPhotoUrl(res.data.url);
                                                if (res.data.gps) {
                                                    setNvtGps(res.data.gps);
                                                } else {
                                                    setNvtGps(null);
                                                }
                                            } catch (err) {
                                                console.error('Error uploading NVT photo', err);
                                                
                                                // If server returned no GPS, we let the subcontractor proceed anyway, they shouldn't be blocked.
                                                // The image is still uploaded and saved in the backend uploads, let's use the uploaded url if present.
                                                const errorUrl = err.response?.data?.url;
                                                const serverMsg = err.response?.data?.message;
                                                const details = err.response?.data?.details || '';
                                                
                                                if (errorUrl) {
                                                    const confirmProceed = window.confirm(
                                                        `No pudimos extraer coordenadas GPS automáticamente:\n\n"${serverMsg}"\n\nDetalles del Servidor:\n${details}\n\n¿Deseas continuar añadiendo esta foto sin coordenadas geográficas exactas? (Se subirá la foto correctamente al reporte).`
                                                    );
                                                    if (confirmProceed) {
                                                        setNvtPhotoUrl(errorUrl);
                                                        setNvtGps(null);
                                                    }
                                                } else {
                                                    alert(`Error al procesar la foto o extraer coordenadas.\n\nServidor dice:\n${serverMsg || err.message}\n${details}`);
                                                }
                                            } finally {
                                                setUploadingPhotos(false);
                                            }
                                        }
                                    }}
                                    className="hidden"
                                    disabled={uploadingPhotos}
                                />
                            </label>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={handleAddNvt}
                        disabled={!nvtPhotoUrl}
                        className={`w-full text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors ${
                            nvtPhotoUrl 
                                ? 'bg-emerald-600 hover:bg-emerald-700 active:scale-95 shadow-lg shadow-emerald-600/10' 
                                : 'bg-slate-300 cursor-not-allowed'
                        }`}
                    >
                        <Plus size={16} /> Añadir NVT al Parte
                    </button>
                </div>
            </div>

            {/* HP+ Section */}
            <div className="glass-panel bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-5">
                <h3 className="text-lg font-black text-slate-800 flex items-center gap-2 border-b border-slate-50 pb-3">
                    <span className="w-5 h-5 rounded-full bg-orange-500 inline-block border-2 border-orange-300 shadow-sm" /> Reportar HP+ (Bolas Naranjas)
                </h3>

                <div className="bg-orange-50 border border-orange-100 rounded-2xl p-3 flex items-start gap-2">
                    <span className="text-orange-400 mt-0.5 shrink-0"><MapPin size={16} /></span>
                    <p className="text-xs text-orange-700 font-semibold leading-relaxed">
                        Las HP+ son las bolas naranjas de señalización enterradas frente a la vivienda. La foto debe tener GPS activado para ubicarlas exactamente en el mapa de obra.
                    </p>
                </div>

                <div className="space-y-4">
                    {/* HP+ Address Search */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
                            Dirección asociada (opcional — mejora la localización)
                        </label>
                        {hpSelectedAddress ? (
                            <div className="flex items-center justify-between bg-orange-50 border border-orange-200 rounded-xl p-3">
                                <div>
                                    <p className="font-bold text-slate-800 text-sm">{hpSelectedAddress.street} {hpSelectedAddress.number || ''}</p>
                                    <p className="text-xs text-slate-500">{hpSelectedAddress.city} — NVT: {hpSelectedAddress.nvt || 'Sin NVT'}</p>
                                </div>
                                <button type="button" onClick={() => { setHpSelectedAddress(null); setHpSearchQuery(''); }}
                                    className="text-slate-400 hover:text-red-500 p-1 rounded-lg transition-colors"><X size={16} /></button>
                            </div>
                        ) : (
                            <div className="relative">
                                <input
                                    type="text"
                                    value={hpSearchQuery}
                                    onChange={(e) => setHpSearchQuery(e.target.value)}
                                    placeholder="Buscar dirección (calle, NVT)..."
                                    className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 font-semibold text-slate-700 text-sm bg-slate-50/30"
                                />
                                {hpSearchResults.length > 0 && (
                                    <div className="absolute z-20 w-full bg-white border border-slate-200 rounded-xl shadow-xl mt-1 max-h-48 overflow-y-auto">
                                        {hpSearchResults.map(addr => (
                                            <button key={addr.id} type="button"
                                                onClick={() => { setHpSelectedAddress(addr); setHpSearchQuery(''); setHpSearchResults([]); }}
                                                className="w-full text-left px-4 py-2.5 hover:bg-orange-50 text-sm font-semibold text-slate-800 border-b border-slate-50 last:border-0 transition-colors"
                                            >
                                                {addr.street} {addr.number || ''}
                                                <span className="text-xs text-slate-400 ml-1">— {addr.city} / NVT: {addr.nvt || 'Sin NVT'}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Quantity */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
                            Número de HP+ colocadas
                        </label>
                        <input
                            type="number" min="1" max="20"
                            value={hpQuantity}
                            onChange={(e) => setHpQuantity(e.target.value)}
                            className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 font-bold text-slate-800 text-center text-lg bg-slate-50/30"
                        />
                    </div>

                    {/* Comments */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Comentarios (opcional)</label>
                        <textarea
                            value={hpComments}
                            onChange={(e) => setHpComments(e.target.value)}
                            rows={2}
                            placeholder="Ej: HP+ colocada frente al garaje, a 30cm de profundidad..."
                            className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 resize-none text-sm font-semibold text-slate-700 bg-slate-50/30"
                        />
                    </div>

                    {/* Photo Upload */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
                            📷 Foto de la HP+ <span className="text-orange-500">(obligatoria — con GPS activado)</span>
                        </label>
                        {hpPhotos.length > 0 ? (
                            <div className="space-y-3">
                                <div className="flex flex-wrap gap-2">
                                    {hpPhotos.map((url, i) => (
                                        <div key={i} className="relative w-24 h-24 rounded-xl overflow-hidden border border-slate-200 group">
                                            <img src={getFileUrl(url)} alt="HP+" className="w-full h-full object-cover" />
                                            {hpGpsData[i] && (
                                                <div className="absolute bottom-0 left-0 right-0 bg-emerald-600/90 text-white text-[8px] font-bold px-1 py-0.5 text-center">
                                                    📍 GPS OK
                                                </div>
                                            )}
                                            <button type="button"
                                                onClick={() => { setHpPhotos(p => p.filter((_, j) => j !== i)); setHpGpsData(p => p.filter((_, j) => j !== i)); }}
                                                className="absolute top-1 right-1 bg-red-600 text-white p-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                            ><X size={10} /></button>
                                        </div>
                                    ))}
                                    <label className="w-24 h-24 rounded-xl border-2 border-dashed border-orange-200 bg-orange-50/50 flex flex-col items-center justify-center cursor-pointer hover:bg-orange-100/50 transition-colors">
                                        <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => handlePhotoUpload(e, 'hp')} />
                                        <Plus size={20} className="text-orange-400" />
                                        <span className="text-[9px] text-orange-400 font-bold mt-1">Añadir</span>
                                    </label>
                                </div>
                                {!hpGpsData.some(g => g && g.lat) && (
                                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 flex items-center gap-2">
                                        <AlertTriangle size={14} className="text-amber-500 shrink-0" />
                                        <p className="text-xs text-amber-700 font-semibold">
                                            No se encontró GPS en las fotos. Activa la ubicación en tu cámara o usa una app con marca de agua GPS.
                                        </p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <label className="flex flex-col items-center justify-center gap-3 py-10 border-2 border-dashed border-orange-200 rounded-2xl bg-orange-50/30 cursor-pointer hover:bg-orange-50/60 transition-colors">
                                <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => handlePhotoUpload(e, 'hp')} />
                                {uploadingPhotos ? <Loader2 className="animate-spin text-orange-400" size={24} /> : <Camera className="text-orange-300" size={24} />}
                                <span className="text-sm text-slate-500 font-semibold">Subir foto de la HP+</span>
                                <span className="text-xs text-orange-500 font-bold">El GPS se leerá automáticamente de los metadatos o la marca de agua</span>
                            </label>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={handleAddHp}
                        disabled={hpPhotos.length === 0 || uploadingPhotos}
                        className={`w-full text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors ${
                            hpPhotos.length > 0 && !uploadingPhotos
                                ? 'bg-orange-500 hover:bg-orange-600 active:scale-95 shadow-lg shadow-orange-500/20'
                                : 'bg-slate-300 cursor-not-allowed'
                        }`}
                    >
                        <Plus size={16} /> Añadir HP+ al Parte
                    </button>
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
                                            <div className="flex flex-wrap gap-2 items-center mt-1">
                                                <span className="text-[9px] bg-slate-200 text-slate-600 font-bold px-1.5 py-0.5 rounded">NVT: {item.nvt || 'N/A'}</span>
                                                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${
                                                    item.ready 
                                                        ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                                                        : 'bg-amber-50 text-amber-600 border-amber-100'
                                                }`}>
                                                    {item.ready ? 'HECHO (Lista)' : item.status}
                                                </span>
                                                {item.connectionColor && (
                                                    <span className="text-[9px] bg-slate-100 text-slate-700 border border-slate-200 font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                                                        <span 
                                                            className="w-2 h-2 rounded-full inline-block shrink-0" 
                                                            style={getColorStyle(item.connectionColor)}
                                                        />
                                                        {item.connectionColor.replace('-raya', ' (Raya)')}
                                                    </span>
                                                )}
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

            {/* HP+ Summary in Submitted Work */}
            {addedHps.length > 0 && (
                <div className="glass-panel bg-white rounded-3xl p-6 shadow-sm border border-orange-100 space-y-4">
                    <h3 className="text-lg font-black text-slate-800 flex items-center gap-2 border-b border-slate-50 pb-3">
                        <span className="w-5 h-5 rounded-full bg-orange-500 inline-block border-2 border-orange-300" />
                        HP+ a enviar en este parte ({addedHps.length})
                    </h3>
                    <div className="space-y-3">
                        {addedHps.map((item, idx) => (
                            <div key={idx} className="bg-orange-50 rounded-2xl p-4 border border-orange-100 flex justify-between items-center">
                                <div>
                                    <h5 className="font-extrabold text-slate-800 text-sm">
                                        {item.quantity} HP+ {item.addressName ? `— ${item.addressName}` : '— Sin dirección asociada'}
                                    </h5>
                                    <div className="flex items-center gap-2 mt-1">
                                        {item.lat ? (
                                            <span className="text-[9px] bg-emerald-100 text-emerald-700 font-bold px-1.5 py-0.5 rounded-full">
                                                📍 GPS: {item.lat.toFixed(5)}, {item.lng.toFixed(5)}
                                            </span>
                                        ) : (
                                            <span className="text-[9px] bg-amber-100 text-amber-700 font-bold px-1.5 py-0.5 rounded-full">
                                                ⚠ Sin GPS
                                            </span>
                                        )}
                                        <span className="text-[9px] bg-slate-200 text-slate-600 font-bold px-1.5 py-0.5 rounded-full">
                                            {item.photos.length} foto{item.photos.length !== 1 ? 's' : ''}
                                        </span>
                                    </div>
                                    {item.comments && <p className="text-xs text-slate-500 italic mt-1">"{item.comments}"</p>}
                                </div>
                                <button onClick={() => removeHp(idx)} className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors" title="Quitar">
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

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
                    disabled={submittingReport || (addedConnections.length === 0 && addedDucts.length === 0 && addedNvts.length === 0 && addedHps.length === 0)}
                    className={`px-8 py-4 text-white rounded-2xl font-bold flex items-center gap-2 transition-all shadow-lg active:scale-95 ${
                        submittingReport || (addedConnections.length === 0 && addedDucts.length === 0 && addedNvts.length === 0 && addedHps.length === 0)
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

            {/* CORRECTION / RESUBMIT MODAL */}
            {correctionModalOpen && selectedCorrectionLog && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[5000] p-4">
                    <div className="bg-white rounded-3xl w-full max-w-xl p-6 shadow-2xl border border-slate-100 flex flex-col space-y-4 max-h-[90vh]">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                                <BrainCircuit className="text-rose-600" /> Corregir Trabajo Devuelto
                            </h3>
                            <button
                                onClick={() => setCorrectionModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600 text-xl font-bold"
                            >
                                &times;
                            </button>
                        </div>

                        <div className="text-sm text-slate-600">
                            {selectedCorrectionLog.type === 'work' ? (
                                <>
                                    <strong>Acometida:</strong> {selectedCorrectionLog.log.address?.street} {selectedCorrectionLog.log.address?.number}
                                </>
                            ) : (
                                <>
                                    <strong>Ducto de calle:</strong> {selectedCorrectionLog.log.distance} metros
                                </>
                            )}
                            <div className="bg-rose-50 text-rose-950 p-3 rounded-xl border border-rose-100 text-xs font-semibold mt-2 leading-relaxed">
                                <strong>Motivo de rechazo:</strong> "{selectedCorrectionLog.log.reviewComments}"
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                            {/* Duct distance field if duct log */}
                            {selectedCorrectionLog.type === 'duct' && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                                        Distancia (m)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={correctedDistance}
                                        onChange={(e) => setCorrectedDistance(e.target.value)}
                                        className="w-full border border-slate-200 rounded-xl p-3 bg-slate-50 text-slate-800 font-bold focus:bg-white outline-none focus:ring-2 focus:ring-rose-500/20 text-sm transition-all"
                                        placeholder="0.0"
                                        required
                                    />
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                                    Fotos de Evidencia (Correctas + Nuevas cargadas)
                                </label>
                                <div className="flex flex-wrap gap-3 items-center">
                                    {correctedPhotos.map((url, idx) => (
                                        <div key={idx} className="w-20 h-20 rounded-xl overflow-hidden border border-slate-200 relative bg-slate-100 group">
                                            <img src={getFileUrl(url)} alt="Correction upload" className="w-full h-full object-cover" />
                                            <button
                                                type="button"
                                                onClick={() => setCorrectedPhotos(prev => prev.filter((_, i) => i !== idx))}
                                                className="absolute top-1 right-1 bg-black/60 hover:bg-black text-white p-0.5 rounded-full"
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>
                                    ))}
                                    
                                    <label className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-300 hover:border-rose-500 flex flex-col items-center justify-center cursor-pointer transition-colors bg-white relative">
                                        {uploadingPhotos ? (
                                            <Loader2 className="animate-spin text-rose-600" size={20} />
                                        ) : (
                                            <>
                                                <Camera size={20} className="text-slate-400" />
                                                <span className="text-[9px] font-bold text-slate-400 uppercase mt-1">Añadir Foto</span>
                                            </>
                                        )}
                                        <input
                                            type="file"
                                            multiple
                                            accept="image/*"
                                            onChange={handleCorrectionPhotoUpload}
                                            className="hidden"
                                            disabled={uploadingPhotos}
                                        />
                                    </label>
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1 italic">
                                    * Hemos mantenido las fotos que el revisor NO marcó como erróneas. Reemplace las incorrectas subiendo las nuevas imágenes correctas.
                                </p>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                                    Comentario o Aclaraciones (Opcional)
                                </label>
                                <textarea
                                    value={correctedComments}
                                    onChange={(e) => setCorrectedComments(e.target.value)}
                                    rows="2"
                                    className="w-full border border-slate-200 rounded-xl p-3 bg-slate-50 text-slate-800 text-sm focus:bg-white outline-none focus:ring-2 focus:ring-rose-500/20 transition-all placeholder:text-slate-400"
                                    placeholder="Indique los cambios realizados..."
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                            <button
                                onClick={() => setCorrectionModalOpen(false)}
                                className="px-4 py-2 rounded-xl text-slate-500 hover:bg-slate-100 text-sm font-bold transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={submitCorrection}
                                disabled={submittingCorrection || uploadingPhotos}
                                className="bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 text-white px-6 py-2 rounded-xl font-bold text-sm shadow-sm transition-all flex items-center gap-1.5"
                            >
                                {submittingCorrection ? (
                                    <>
                                        <Loader2 className="animate-spin" size={14} /> Reenviando...
                                    </>
                                ) : (
                                    'Volver a Enviar al Cliente'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SubcontractorDailyLog;
