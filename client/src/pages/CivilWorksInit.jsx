import React, { useState, useEffect, useRef } from 'react';
import { 
    HardHat, Search, Check, RefreshCw, X, MapPin, 
    Layers, Plus, Trash2, Save, Undo, Loader2, Compass,
    UploadCloud, AlertCircle, FileImage, Image as ImageIcon
} from 'lucide-react';
import api from '../api/axios';
import exifr from 'exifr';

const CACHE_KEY = 'joa-map-geo-cache-v5';
const GOOGLE_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY;

const loadCache = () => {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); } catch { return {}; }
};
const saveCache = (cache) => {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch {}
};

const guessCountryCode = (street, city) => {
    const s = (street || '').toLowerCase();
    const c = (city || '').toLowerCase();
    
    // Spanish street indicators
    if (s.startsWith('calle') || s.startsWith('avenida') || s.startsWith('plaza') || s.startsWith('paseo') || s.startsWith('avda') || s.startsWith('c/') || s.includes(' de ') || s.includes(' del ')) {
        return 'ES';
    }
    // Spanish city indicators
    if (c.includes('madrid') || c.includes('barcelona') || c.includes('valencia') || c.includes('sevilla') || c.includes('zaragoza') || c.includes('toledo') || c.includes('getafe') || c.includes('alcorcon') || c.includes('mostoles') || c.includes('leganes') || c.includes('fuenlabrada')) {
        return 'ES';
    }
    
    // German street indicators
    if (s.includes('str.') || s.includes('straße') || s.includes('strasse') || s.includes('weg') || s.includes('gasse') || s.includes('platz') || s.includes('allee') || s.includes('pfad')) {
        return 'DE';
    }
    // German city indicators
    if (c.includes('berlin') || c.includes('münchen') || c.includes('munich') || c.includes('frankfurt') || c.includes('hamburg') || c.includes('mainz') || c.includes('wiesbaden') || c.includes('alzey') || c.includes('bickelheim') || c.includes('gau-bickelheim')) {
        return 'DE';
    }
    
    return null;
};

// Geocoding helper with Nominatim / Photon fallbacks
const geocodeFull = async (street, number, city, countryCode, cache) => {
    const cacheKey = [street, number, city].filter(Boolean).join(' ').trim();
    if (!cacheKey) return null;
    if (cache[cacheKey]?.lat) return cache[cacheKey];

    const guessed = guessCountryCode(street, city) || countryCode;
    const country = guessed === 'DE' ? 'Germany' : 'Spain';
    const region = guessed === 'DE' ? 'de' : 'es';
    const lang = guessed === 'DE' ? 'de' : 'es';

    // Stage 1: Google Maps Geocoding API
    if (GOOGLE_KEY) {
        try {
            const address = [street, number, city, country].filter(Boolean).join(', ');
            const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_KEY}&region=${region}&language=${lang}`;
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                if (data.status === 'OK' && data.results?.length > 0) {
                    const loc = data.results[0].geometry.location;
                    const coords = { lat: loc.lat, lng: loc.lng };
                    cache[cacheKey] = coords;
                    return coords;
                }
            }
        } catch {}
    }

    // Stage 2: Photon
    try {
        const q = [street, number, city, country].filter(Boolean).join(', ').trim();
        const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=1&lang=${lang}`;
        const res = await fetch(url);
        if (res.ok) {
            const data = await res.json();
            if (data?.features?.length > 0) {
                const feat = data.features[0];
                const [lng, lat] = feat.geometry.coordinates;
                const type = feat.properties?.type || '';
                if (['house', 'building', 'amenity', 'tourism'].includes(type)) {
                    const coords = { lat: parseFloat(lat), lng: parseFloat(lng) };
                    cache[cacheKey] = coords;
                    return coords;
                }
            }
        }
    } catch {}

    // Stage 3: Nominatim structured
    if (number && street) {
        try {
            const params = new URLSearchParams({
                format: 'json',
                housenumber: number,
                street: street,
                city: city || '',
                countrycodes: region,
                limit: '1',
            });
            const url = `https://nominatim.openstreetmap.org/search?${params}`;
            const res = await fetch(url, {
                headers: { 'Accept': 'application/json', 'Accept-Language': lang }
            });
            if (res.ok) {
                const data = await res.json();
                if (data?.length > 0) {
                    const coords = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
                    cache[cacheKey] = coords;
                    return coords;
                }
            }
        } catch {}
    }

    // Stage 4: Photon street-only
    const streetKey = [street, city, country].filter(Boolean).join(', ').trim();
    if (cache[streetKey]?.lat) return cache[streetKey];
    try {
        const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(streetKey)}&limit=1&lang=${lang}`;
        const res = await fetch(url);
        if (res.ok) {
            const data = await res.json();
            if (data?.features?.length > 0) {
                const [lng, lat] = data.features[0].geometry.coordinates;
                const coords = { lat: parseFloat(lat), lng: parseFloat(lng) };
                cache[streetKey] = coords;
                return coords;
            }
        }
    } catch {}

    return null;
};

// Circle scatter math for overlapping pins
const scatter = (center, index) => {
    const a = 137.5 * (Math.PI / 180);
    const r = Math.sqrt(index + 1) * 0.00025;
    const t = (index + 1) * a;
    return { lat: center.lat + r * Math.sin(t), lng: center.lng + r * Math.cos(t) };
};

// Haversine formula to compute distance in meters for live UI display
const calculateDistance = (points) => {
    if (!points || points.length < 2) return 0;
    let total = 0;
    for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i+1];
        const R = 6371e3; // meters
        const phi1 = p1.lat * Math.PI/180;
        const phi2 = p2.lat * Math.PI/180;
        const deltaPhi = (p2.lat-p1.lat) * Math.PI/180;
        const deltaLambda = (p2.lng-p1.lng) * Math.PI/180;

        const a = Math.sin(deltaPhi/2) * Math.sin(deltaPhi/2) +
                  Math.cos(phi1) * Math.cos(phi2) *
                  Math.sin(deltaLambda/2) * Math.sin(deltaLambda/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        total += R * c;
    }
    return parseFloat(total.toFixed(2));
};

const CivilWorksInit = () => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const [leafletLoaded, setLeafletLoaded] = useState(false);
    
    // Core Data
    const [addresses, setAddresses] = useState([]);
    const [ductRoutes, setDuctRoutes] = useState([]);
    const [projects, setProjects] = useState([]);
    const [subcontractors, setSubcontractors] = useState([]);
    
    // UI Navigation
    const [activeTab, setActiveTab] = useState('connections'); // 'connections' | 'ducts'
    const [loadingData, setLoadingData] = useState(true);
    
    // Filters & States for Connection Tab
    const [filterProject, setFilterProject] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedAddressIds, setSelectedAddressIds] = useState([]);
    const [bulkUpdating, setBulkUpdating] = useState(false);
    
    // States for Manual Duct Drawing Tab
    const [selectedSubcontractorId, setSelectedSubcontractorId] = useState('');
    const [ductType, setDuctType] = useState('7x22');
    const [ductComments, setDuctComments] = useState('');
    const [drawnPoints, setDrawnPoints] = useState([]);
    const [savingDuct, setSavingDuct] = useState(false);
    const [companyCountry, setCompanyCountry] = useState('ES');
    const [activePhotoModal, setActivePhotoModal] = useState(null);

    // States for Photo Batch Import
    const [photoImportFiles, setPhotoImportFiles] = useState([]);
    const [photoImportPoints, setPhotoImportPoints] = useState([]);
    const [isParsingPhotos, setIsParsingPhotos] = useState(false);
    const [photoImportSubcontractorId, setPhotoImportSubcontractorId] = useState('');
    const [photoImportDuctType, setPhotoImportDuctType] = useState('7x22');
    const [photoImportComments, setPhotoImportComments] = useState('');
    const [photoImportErrors, setPhotoImportErrors] = useState([]);
    const [isSavingPhotoImport, setIsSavingPhotoImport] = useState(false);
    const [uploadProgressText, setUploadProgressText] = useState('');

    // References
    const initMapRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const polylineRef = useRef(null);
    const markersGroupRef = useRef(null);
    const savedDuctsGroupRef = useRef(null);
    const addressesGroupRef = useRef(null);
    const photoMarkersGroupRef = useRef(null);
    const searchMarkerRef = useRef(null);
    const importPreviewGroupRef = useRef(null);

    // Search and centering states
    const [mapSearchQuery, setMapSearchQuery] = useState('');
    const [mapSearchResults, setMapSearchResults] = useState([]);
    
    // Load Leaflet Script & CSS
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
        return () => { if (iv) clearInterval(iv); };
    }, []);

    // Load static lists
    const loadAllData = async () => {
        try {
            const [mapRes, subsRes, projectsRes, companyRes] = await Promise.all([
                api.get('/api/civil-works/map'),
                api.get('/api/subcontractors').catch(() => ({ data: [] })),
                api.get('/api/projects').catch(() => ({ data: [] })),
                api.get('/api/company').catch(() => ({ data: {} }))
            ]);
            setAddresses(mapRes.data.addresses || []);
            setDuctRoutes(mapRes.data.ductRoutes || []);
            setSubcontractors(subsRes.data || []);
            setProjects(projectsRes.data || []);
            if (companyRes.data?.country) {
                setCompanyCountry(companyRes.data.country);
            }
        } catch (error) {
            console.error('Error loading initialization data:', error);
        } finally {
            setLoadingData(false);
        }
    };

    useEffect(() => {
        loadAllData();
    }, []);

    // Filtered Addresses for Connections list
    const filteredAddresses = addresses.filter(addr => {
        if (filterProject && addr.projectId !== filterProject) return false;
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            const streetMatch = addr.street?.toLowerCase().includes(q);
            const nvtMatch = addr.nvt?.toLowerCase().includes(q);
            const cityMatch = addr.city?.toLowerCase().includes(q);
            const numMatch = addr.number?.toLowerCase().includes(q);
            if (!streetMatch && !nvtMatch && !cityMatch && !numMatch) return false;
        }
        return true;
    }).sort((a, b) => {
        const streetA = a.street || '';
        const streetB = b.street || '';
        const comp = streetA.localeCompare(streetB, 'es', { sensitivity: 'base' });
        if (comp !== 0) return comp;
        
        const numA = a.number || '';
        const numB = b.number || '';
        const intA = parseInt(numA, 10);
        const intB = parseInt(numB, 10);
        if (!isNaN(intA) && !isNaN(intB)) {
            return intA - intB;
        }
        return numA.localeCompare(numB, 'es', { numeric: true, sensitivity: 'base' });
    });

    // Checkboxes helpers
    const toggleSelectAddress = (id) => {
        setSelectedAddressIds(prev => {
            if (prev.includes(id)) return prev.filter(i => i !== id);
            return [...prev, id];
        });
    };

    const toggleSelectAll = () => {
        if (selectedAddressIds.length === filteredAddresses.length) {
            setSelectedAddressIds([]);
        } else {
            setSelectedAddressIds(filteredAddresses.map(a => a.id));
        }
    };

    // Bulk status updates for Connections
    const handleBulkStatusChange = async (newStatus) => {
        if (selectedAddressIds.length === 0) return;
        if (!window.confirm(`¿Deseas marcar las ${selectedAddressIds.length} acometidas seleccionadas como ${newStatus}?`)) return;

        setBulkUpdating(true);
        try {
            await api.post('/api/civil-works/bulk-status', {
                addressIds: selectedAddressIds,
                status: newStatus
            });
            alert('Acometidas actualizadas correctamente.');
            setSelectedAddressIds([]);
            loadAllData();
        } catch (error) {
            console.error('Error bulk updating addresses:', error);
            alert('Error al actualizar los estados.');
        } finally {
            setBulkUpdating(false);
        }
    };

    const activeTabRef = useRef(activeTab);
    useEffect(() => {
        activeTabRef.current = activeTab;
    }, [activeTab]);

    // Initialize Leaflet Map for Duct Drawing and Photo Import
    useEffect(() => {
        if (!leafletLoaded || !initMapRef.current || (activeTab !== 'ducts' && activeTab !== 'photoImport')) return;
        const L = window.L;

        // Clean container first if needed
        if (mapInstanceRef.current && mapInstanceRef.current.getContainer() !== initMapRef.current) {
            try { mapInstanceRef.current.remove(); } catch (e) {}
            mapInstanceRef.current = null;
        }

        if (initMapRef.current && initMapRef.current._leaflet_id) {
            initMapRef.current._leaflet_id = null;
        }

        // Reset search marker reference
        searchMarkerRef.current = null;

        const resolveCenterAndSet = async () => {
            let center = companyCountry === 'DE' ? [49.8358, 8.0163] : [40.4167, -3.7037]; // Berlin / Madrid fallback

            if (filterProject && addresses.length > 0) {
                const projectAddresses = addresses.filter(a => a.projectId === filterProject);
                const geocoded = projectAddresses.find(a => a.gpsLat && a.gpsLng);
                if (geocoded) {
                    center = [geocoded.gpsLat, geocoded.gpsLng];
                } else {
                    const city = projectAddresses.find(a => a.city)?.city;
                    const projectObj = projects.find(p => p.id === filterProject);
                    const searchTerm = city || projectObj?.name;
                    if (searchTerm) {
                        const cache = loadCache();
                        const coords = await geocodeFull(searchTerm, '', '', companyCountry, cache);
                        saveCache(cache);
                        if (coords) {
                            center = [coords.lat, coords.lng];
                        }
                    }
                }
            }

            if (mapInstanceRef.current) {
                mapInstanceRef.current.setView(center, 15);
            }
        };

        if (!mapInstanceRef.current) {
            let initialCenter = companyCountry === 'DE' ? [49.8358, 8.0163] : [40.4167, -3.7037];
            mapInstanceRef.current = L.map(initMapRef.current, { zoomControl: false }).setView(initialCenter, 15);
            L.control.zoom({ position: 'bottomright' }).addTo(mapInstanceRef.current);
            L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; OpenStreetMap'
            }).addTo(mapInstanceRef.current);

            markersGroupRef.current = L.layerGroup().addTo(mapInstanceRef.current);
            savedDuctsGroupRef.current = L.layerGroup().addTo(mapInstanceRef.current);
            addressesGroupRef.current = L.layerGroup().addTo(mapInstanceRef.current);
            photoMarkersGroupRef.current = L.layerGroup().addTo(mapInstanceRef.current);
            importPreviewGroupRef.current = L.layerGroup().addTo(mapInstanceRef.current);
            polylineRef.current = L.polyline([], { 
                color: ductType === '5x10' ? '#ec4899' : '#8b5cf6', 
                weight: 5,
                opacity: 0.9,
                dashArray: '8, 10'
            }).addTo(mapInstanceRef.current);

            // Add map click listener for drawing points
            mapInstanceRef.current.on('click', (e) => {
                if (activeTabRef.current !== 'ducts') return;
                const { lat, lng } = e.latlng;
                const newPoint = { lat, lng };

                setDrawnPoints(prev => {
                    const updated = [...prev, newPoint];
                    polylineRef.current.setLatLngs(updated.map(pt => [pt.lat, pt.lng]));
                    
                    const marker = L.circleMarker([lat, lng], {
                        color: ductType === '5x10' ? '#ec4899' : '#8b5cf6',
                        fillColor: '#fff',
                        fillOpacity: 1,
                        radius: 5,
                        weight: 2
                    }).addTo(markersGroupRef.current);

                    marker.bindPopup(`Punto ${updated.length}`);
                    return updated;
                });
            });
        } else {
            markersGroupRef.current.clearLayers();
            if (savedDuctsGroupRef.current) savedDuctsGroupRef.current.clearLayers();
            if (addressesGroupRef.current) addressesGroupRef.current.clearLayers();
            if (photoMarkersGroupRef.current) photoMarkersGroupRef.current.clearLayers();
            if (importPreviewGroupRef.current) importPreviewGroupRef.current.clearLayers();
            polylineRef.current.setLatLngs([]);
        }

        resolveCenterAndSet();

        return () => {
            // Keep map running
        };
    }, [leafletLoaded, activeTab, filterProject]);

    // Recolor polyline live when ductType changes
    useEffect(() => {
        if (polylineRef.current) {
            polylineRef.current.setStyle({
                color: ductType === '5x10' ? '#ec4899' : '#8b5cf6'
            });
        }
    }, [ductType]);

    // Clear drawn duct points
    const handleClearDrawnDuct = () => {
        setDrawnPoints([]);
        if (polylineRef.current) polylineRef.current.setLatLngs([]);
        if (markersGroupRef.current) markersGroupRef.current.clearLayers();
        if (searchMarkerRef.current && mapInstanceRef.current) {
            try { mapInstanceRef.current.removeLayer(searchMarkerRef.current); } catch (e) {}
            searchMarkerRef.current = null;
        }
    };

    // Draw saved ducts on map
    const drawSavedDucts = () => {
        if (!leafletLoaded || !mapInstanceRef.current || !savedDuctsGroupRef.current) return;
        const L = window.L;
        savedDuctsGroupRef.current.clearLayers();

        ductRoutes.forEach(route => {
            if (!route.coordinates || !Array.isArray(route.coordinates) || route.coordinates.length < 2) return;
            const pathCoords = route.coordinates.map(pt => [pt.lat, pt.lng]);
            
            const ductColor = route.ductType === '5x10' ? '#ec4899' : '#8b5cf6';
            const polyline = L.polyline(pathCoords, {
                color: ductColor,
                weight: 5,
                opacity: 0.95
            });

            const subName = route.report?.subcontractor?.name || 'Subcontrata';
            const distText = route.distance ? `${route.distance}m` : 'No calculada';
            const dateText = new Date(route.createdAt).toLocaleDateString('es-ES');

            // Generate popup content with delete button dynamically
            const popupContent = document.createElement('div');
            popupContent.style.font = '13px sans-serif';
            popupContent.style.color = '#1e293b';
            popupContent.style.minWidth = '180px';
            popupContent.innerHTML = `
                <b style="font-size: 14px; color: ${ductColor}">Ducto de Calle (${route.ductType || '7x22'})</b><br>
                <b>Socio:</b> ${subName}<br>
                <b>Longitud:</b> ${distText}<br>
                <b>Fecha:</b> ${dateText}<br>
                ${route.comments ? `<b>Detalles:</b> <i>"${route.comments}"</i><br>` : ''}
            `;

            // Delete button for Admin / Super Admin
            if (['SUPER_ADMIN', 'ADMIN', 'BACK_OFFICE'].includes(user.role)) {
                const btn = document.createElement('button');
                btn.textContent = 'Borrar Ducto';
                btn.style.marginTop = '10px';
                btn.style.width = '100%';
                btn.style.background = '#ef4444';
                btn.style.color = 'white';
                btn.style.border = 'none';
                btn.style.padding = '8px 12px';
                btn.style.borderRadius = '8px';
                btn.style.fontWeight = 'bold';
                btn.style.cursor = 'pointer';
                btn.style.fontSize = '12px';
                btn.style.transition = 'background 0.2s';
                
                btn.onmouseover = () => btn.style.background = '#dc2626';
                btn.onmouseout = () => btn.style.background = '#ef4444';
                
                btn.onclick = async () => {
                    if (window.confirm('¿Estás seguro de que deseas eliminar este ducto permanentemente?')) {
                        try {
                            await api.delete(`/api/civil-works/duct-log/${route.id}`);
                            alert('Ducto eliminado correctamente.');
                            if (mapInstanceRef.current) mapInstanceRef.current.closePopup();
                            loadAllData(); // reload data to refresh map
                        } catch (error) {
                            console.error('Error deleting duct:', error);
                            alert(error.response?.data?.message || 'Error al eliminar el ducto.');
                        }
                    }
                };
                popupContent.appendChild(btn);
            }

            polyline.bindPopup(popupContent);
            savedDuctsGroupRef.current.addLayer(polyline);
        });
    };

    const getStatusInfo = (status) => {
        switch (status) {
            case 'HECHO': 
                return { color: 'green', cls: 'bg-emerald-500 border-emerald-300', label: 'Tubo instalado (Listo soplado)' };
            case 'PLANIFICADO': 
                return { color: 'yellow', cls: 'bg-amber-400 border-amber-300', label: 'Citado o Planificado' };
            default: 
                return { color: 'grey', cls: 'bg-slate-400 border-slate-300', label: 'Sin tubo / Pendiente' };
        }
    };

    const drawProjectAddresses = async () => {
        if (!leafletLoaded || !mapInstanceRef.current || !addressesGroupRef.current) return;
        const L = window.L;
        addressesGroupRef.current.clearLayers();

        if (!filterProject) return;

        const projectAddresses = addresses.filter(addr => addr.projectId === filterProject);
        if (projectAddresses.length === 0) return;

        const cache = loadCache();
        const BATCH = 10;
        const DELAY = 80;

        for (let i = 0; i < projectAddresses.length; i += BATCH) {
            const batch = projectAddresses.slice(i, i + BATCH);
            const results = await Promise.all(
                batch.map(async (addr) => {
                    if (addr.gpsLat && addr.gpsLng) {
                        return { addr, coords: { lat: addr.gpsLat, lng: addr.gpsLng } };
                    }
                    const coords = await geocodeFull(addr.street, addr.number || '', addr.city || '', companyCountry, cache);
                    return { addr, coords };
                })
            );
            
            saveCache(cache);

            results.forEach(({ addr, coords }, idx) => {
                if (!coords) return;
                
                // If coordinates are overlapping, scatter them slightly
                const isOverlapping = results.slice(0, idx).some(r => r.coords && r.coords.lat === coords.lat && r.coords.lng === coords.lng);
                const finalCoords = isOverlapping ? scatter(coords, idx) : coords;

                const statusInfo = getStatusInfo(addr.civilWorkStatus);

                const icon = L.divIcon({
                    html: `<div style="width:14px;height:14px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.35)" class="${statusInfo.cls}"></div>`,
                    className: '', iconSize: [14, 14], iconAnchor: [7, 7]
                });

                const marker = L.marker([finalCoords.lat, finalCoords.lng], { icon });
                marker.bindPopup(`
                    <div style="font:13px sans-serif;color:#1e293b;min-width:180px">
                        <b style="font-size:13px;color:#f97316">Acometida</b><br>
                        <b>Dirección:</b> ${addr.street} ${addr.number || ''}<br>
                        <b>NVT:</b> ${addr.nvt || 'N/A'}<br>
                        <b>Estado:</b> <span style="font-weight:bold">${statusInfo.label}</span>
                    </div>
                `);
                
                if (addressesGroupRef.current) {
                    addressesGroupRef.current.addLayer(marker);
                }
            });

            if (i + BATCH < projectAddresses.length) {
                await new Promise(r => setTimeout(r, DELAY));
            }
        }
    };

    const drawPhotoMarkers = () => {
        if (!leafletLoaded || !mapInstanceRef.current || !photoMarkersGroupRef.current) return;
        const L = window.L;
        photoMarkersGroupRef.current.clearLayers();

        const cameraIcon = L.divIcon({
            html: `<div class="flex items-center justify-center w-7 h-7 rounded-full bg-orange-500 border-2 border-white shadow-md text-[13px] hover:scale-125 transition-transform cursor-pointer">📸</div>`,
            className: '', iconSize: [28, 28], iconAnchor: [14, 14]
        });

        // A. Connection Photos (Acometidas) - only for the selected project
        if (filterProject) {
            const projectAddresses = addresses.filter(addr => addr.projectId === filterProject);
            projectAddresses.forEach((addr, i) => {
                if (addr.civilWorkInfo?.photos && Array.isArray(addr.civilWorkInfo.photos) && addr.civilWorkInfo.photos.length > 0) {
                    let coords = null;
                    if (addr.gpsLat && addr.gpsLng) {
                        coords = { lat: addr.gpsLat, lng: addr.gpsLng };
                    } else {
                        const cache = loadCache();
                        const cacheKey = [addr.street, addr.number, addr.city].filter(Boolean).join(' ').trim();
                        coords = cache[cacheKey]; // fetch from cache
                    }
                    if (!coords) return;

                    addr.civilWorkInfo.photos.forEach((photoUrl, photoIdx) => {
                        const photoCoords = addr.civilWorkInfo.photos.length > 1 ? scatter(coords, photoIdx) : coords;
                        const photoMarker = L.marker([photoCoords.lat, photoCoords.lng], { icon: cameraIcon });
                        
                        photoMarker.bindTooltip(`
                            <div style="padding:2px; width:135px; text-align:center; font:11px sans-serif; white-space: normal;">
                                <img src="${photoUrl}" style="width:100%; height:auto; border-radius:4px; display:block; margin-bottom:4px;" />
                                <b>Acometida</b><br>
                                ${addr.street} ${addr.number || ''}
                            </div>
                        `, { direction: 'top', offset: [0, -10], opacity: 0.95 });

                        photoMarker.on('click', () => {
                            setActivePhotoModal(photoUrl);
                        });

                        photoMarkersGroupRef.current.addLayer(photoMarker);
                    });
                }
            });
        }

        // B. Duct Photos (Ductos)
        ductRoutes.forEach(route => {
            if (route.photos && Array.isArray(route.photos) && route.photos.length > 0) {
                route.photos.forEach((photoUrl, photoIdx) => {
                    let pt = null;
                    if (route.coordinates && Array.isArray(route.coordinates) && route.coordinates[photoIdx]) {
                        pt = route.coordinates[photoIdx];
                    } else if (route.coordinates && Array.isArray(route.coordinates) && route.coordinates.length > 0) {
                        pt = route.coordinates[0]; // fallback
                    }
                    if (!pt || !pt.lat || !pt.lng) return;

                    const photoMarker = L.marker([pt.lat, pt.lng], { icon: cameraIcon });
                    
                    const subName = route.report?.subcontractor?.name || 'Socio';
                    const dateText = new Date(route.createdAt).toLocaleDateString('es-ES');

                    photoMarker.bindTooltip(`
                        <div style="padding:2px; width:135px; text-align:center; font:11px sans-serif; white-space: normal;">
                            <img src="${photoUrl}" style="width:100%; height:auto; border-radius:4px; display:block; margin-bottom:4px;" />
                            <b>Ducto (${route.ductType || '7x22'})</b><br>
                            ${subName} - ${dateText}
                        </div>
                    `, { direction: 'top', offset: [0, -10], opacity: 0.95 });

                    photoMarker.on('click', () => {
                        setActivePhotoModal(photoUrl);
                    });

                    photoMarkersGroupRef.current.addLayer(photoMarker);
                });
            }
        });
    };

    const drawPhotoImportPreview = () => {
        if (!leafletLoaded || !mapInstanceRef.current || !importPreviewGroupRef.current) return;
        const L = window.L;
        importPreviewGroupRef.current.clearLayers();

        if (photoImportPoints.length === 0) return;

        // Draw polyline connecting points
        const pathCoords = photoImportPoints.map(pt => [pt.lat, pt.lng]);
        const color = photoImportDuctType === '5x10' ? '#ec4899' : '#8b5cf6';
        
        const polyline = L.polyline(pathCoords, {
            color: color,
            weight: 5,
            opacity: 0.8,
            dashArray: '5, 10'
        });
        importPreviewGroupRef.current.addLayer(polyline);

        // Draw camera markers for each point
        const cameraIcon = L.divIcon({
            html: `<div class="flex items-center justify-center w-7 h-7 rounded-full bg-blue-500 border-2 border-white shadow-md text-[13px] hover:scale-125 transition-transform cursor-pointer">📸</div>`,
            className: '', iconSize: [28, 28], iconAnchor: [14, 14]
        });

        photoImportPoints.forEach((pt, idx) => {
            const isOverlapping = photoImportPoints.slice(0, idx).some(p => p.lat === pt.lat && p.lng === pt.lng);
            const finalCoords = isOverlapping ? scatter(pt, idx) : pt;
            const marker = L.marker([finalCoords.lat, finalCoords.lng], { icon: cameraIcon });
            
            // Generate a local object URL to display the image locally in tooltip
            const localUrl = URL.createObjectURL(pt.file);
            const timeText = pt.timestamp.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            const dateText = pt.timestamp.toLocaleDateString('es-ES');

            marker.bindTooltip(`
                <div style="padding:2px; width:135px; text-align:center; font:11px sans-serif; white-space: normal;">
                    <img src="${localUrl}" style="width:100%; height:auto; border-radius:4px; display:block; margin-bottom:4px;" />
                    <b>Foto #${idx + 1} de Ducto</b><br>
                    <span style="font-size:9px; color:#64748b">${pt.file.name}</span><br>
                    <b>Hora:</b> ${timeText} (${dateText})
                </div>
            `, { direction: 'top', offset: [0, -10], opacity: 0.95 });

            marker.on('click', () => {
                setActivePhotoModal(localUrl);
            });

            importPreviewGroupRef.current.addLayer(marker);
        });

        // Fit map bounds to the preview path
        if (pathCoords.length > 0) {
            mapInstanceRef.current.fitBounds(L.latLngBounds(pathCoords), { padding: [50, 50] });
        }
    };

    // Redraw saved ducts, project address markers, and photos when data/project updates
    useEffect(() => {
        if (activeTab === 'ducts') {
            drawSavedDucts();
            drawProjectAddresses();
            drawPhotoMarkers();
            if (importPreviewGroupRef.current) importPreviewGroupRef.current.clearLayers();
        } else if (activeTab === 'photoImport') {
            drawSavedDucts();
            drawProjectAddresses();
            drawPhotoMarkers();
            drawPhotoImportPreview();
            if (polylineRef.current) polylineRef.current.setLatLngs([]);
            if (markersGroupRef.current) markersGroupRef.current.clearLayers();
        }
    }, [leafletLoaded, activeTab, ductRoutes, filterProject, addresses, photoImportPoints, photoImportDuctType]);

    // Live search for centering map
    useEffect(() => {
        if (!mapSearchQuery.trim()) {
            setMapSearchResults([]);
            return;
        }
        const q = mapSearchQuery.toLowerCase();
        const matches = addresses.filter(addr => {
            if (filterProject && addr.projectId !== filterProject) return false;
            const streetMatch = addr.street?.toLowerCase().includes(q);
            const nvtMatch = addr.nvt?.toLowerCase().includes(q);
            const numMatch = addr.number?.toLowerCase().includes(q);
            return streetMatch || nvtMatch || numMatch;
        });
        setMapSearchResults(matches.slice(0, 5));
    }, [mapSearchQuery, filterProject, addresses]);

    const handleSelectSearchAddress = async (addr) => {
        setMapSearchQuery('');
        setMapSearchResults([]);

        const L = window.L;
        if (!mapInstanceRef.current || !L) return;

        let coords = null;
        if (addr.gpsLat && addr.gpsLng) {
            coords = { lat: addr.gpsLat, lng: addr.gpsLng };
        } else {
            const cache = loadCache();
            coords = await geocodeFull(addr.street, addr.number || '', addr.city || '', companyCountry, cache);
            saveCache(cache);
        }

        if (coords) {
            mapInstanceRef.current.setView([coords.lat, coords.lng], 18);

            // Clean previous search marker
            if (searchMarkerRef.current) {
                try { mapInstanceRef.current.removeLayer(searchMarkerRef.current); } catch (e) {}
            }

            // Create blue marker for address location
            const searchIcon = L.divIcon({
                html: `<div class="flex flex-col items-center select-none pointer-events-none">
                        <div class="bg-blue-600 text-white font-bold text-[9px] px-1.5 py-0.5 rounded-md shadow-md whitespace-nowrap mb-1">${addr.street} ${addr.number || ''}</div>
                        <div class="w-6 h-6 rounded-full bg-white border-2 border-blue-600 flex items-center justify-center text-[10px] shadow-lg">📍</div>
                       </div>`,
                className: '', iconSize: [50, 40], iconAnchor: [25, 40]
            });

            searchMarkerRef.current = L.marker([coords.lat, coords.lng], { icon: searchIcon }).addTo(mapInstanceRef.current);
            searchMarkerRef.current.bindPopup(`<b>${addr.street} ${addr.number || ''}</b><br>NVT: ${addr.nvt || 'N/A'}`).openPopup();
        } else {
            alert('No se pudo geolocalizar la dirección seleccionada.');
        }
    };

    // Remove the last drawn point (Undo)
    const handleUndoLastPoint = () => {
        setDrawnPoints(prev => {
            if (prev.length === 0) return prev;
            const updated = prev.slice(0, -1);
            
            // Update polyline
            if (polylineRef.current) {
                polylineRef.current.setLatLngs(updated.map(pt => [pt.lat, pt.lng]));
            }
            
            // Remove the last marker layer from Leaflet
            if (markersGroupRef.current) {
                const layers = markersGroupRef.current.getLayers();
                if (layers.length > 0) {
                    markersGroupRef.current.removeLayer(layers[layers.length - 1]);
                }
            }

            return updated;
        });
    };

    // Save Manual Duct Line
    const handleSaveManualDuct = async () => {
        if (!selectedSubcontractorId) {
            alert('Debes seleccionar una subcontrata para asociar la autoría del ducto.');
            return;
        }
        if (drawnPoints.length < 2) {
            alert('Por favor, haz clic en el mapa para marcar al menos 2 puntos que definan el ducto.');
            return;
        }

        setSavingDuct(true);
        try {
            await api.post('/api/civil-works/manual-duct', {
                subcontractorId: selectedSubcontractorId,
                coordinates: drawnPoints,
                ductType,
                comments: ductComments || 'Carga inicial manual'
            });

            alert('Ducto guardado correctamente y visible en el mapa de obra civil.');
            handleClearDrawnDuct();
            setDuctComments('');
            loadAllData();
        } catch (error) {
            console.error('Error saving manual duct:', error);
            alert(error.response?.data?.message || 'Error al guardar el ducto manual.');
        } finally {
            setSavingDuct(false);
        }
    };

    // Handle Photo Selection and Metadata Parsing
    const handlePhotoImportSelect = async (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        setIsParsingPhotos(true);
        setPhotoImportErrors([]);
        
        const validPoints = [];
        const invalidFiles = [];

        for (const file of files) {
            try {
                if (!file.type.startsWith('image/')) {
                    invalidFiles.push(`${file.name} (No es una imagen)`);
                    continue;
                }

                // Extract GPS
                const gps = await exifr.gps(file).catch(() => null);
                // Extract timestamp
                const meta = await exifr.parse(file, ['DateTimeOriginal']).catch(() => null);
                
                if (gps && gps.latitude && gps.longitude) {
                    const timestamp = meta?.DateTimeOriginal || file.lastModifiedDate || new Date();
                    validPoints.push({
                        lat: gps.latitude,
                        lng: gps.longitude,
                        timestamp: new Date(timestamp),
                        file: file,
                        uploadedUrl: null
                    });
                } else {
                    // Try server-side visual extraction (via extract-gps endpoint)
                    const formData = new FormData();
                    formData.append('photo', file);
                    const response = await api.post('/api/uploads/extract-gps', formData, {
                        headers: { 'Content-Type': 'multipart/form-data' }
                    }).catch(() => null);

                    if (response && response.data && response.data.status === 'ok') {
                        validPoints.push({
                            lat: response.data.gps.lat,
                            lng: response.data.gps.lng,
                            timestamp: new Date(response.data.timestamp),
                            file: file,
                            uploadedUrl: response.data.url
                        });
                    } else {
                        invalidFiles.push(`${file.name} (Sin metadatos GPS ni marca de agua legible)`);
                    }
                }
            } catch (err) {
                console.error('Error parsing EXIF for', file.name, err);
                invalidFiles.push(`${file.name} (Error al leer metadatos)`);
            }
        }

        // Sort chronologically by timestamp
        validPoints.sort((a, b) => a.timestamp - b.timestamp);

        setPhotoImportPoints(validPoints);
        setPhotoImportErrors(invalidFiles);
        setIsParsingPhotos(false);
    };

    // Save Duct from Photos Import
    const handleSavePhotoImport = async () => {
        if (!photoImportSubcontractorId) {
            alert('Debes seleccionar una subcontrata para asociar la autoría del ducto.');
            return;
        }
        if (photoImportPoints.length < 2) {
            alert('Se requieren al menos 2 fotos con coordenadas GPS para poder trazar un ducto.');
            return;
        }

        setIsSavingPhotoImport(true);
        setUploadProgressText('Iniciando subida de imágenes...');

        try {
            // 1. Upload photos sequentially (reusing already uploaded ones)
            const urls = [];
            for (let i = 0; i < photoImportPoints.length; i++) {
                const pt = photoImportPoints[i];
                if (pt.uploadedUrl) {
                    urls.push(pt.uploadedUrl);
                } else {
                    setUploadProgressText(`Subiendo foto ${i + 1} de ${photoImportPoints.length}...`);
                    const formData = new FormData();
                    formData.append('photos', pt.file);
                    const response = await api.post('/api/uploads', formData, {
                        headers: { 'Content-Type': 'multipart/form-data' }
                    });
                    if (response.data && Array.isArray(response.data.urls)) {
                        urls.push(response.data.urls[0]);
                    } else {
                        throw new Error(`Error al subir la foto: ${pt.file.name}`);
                    }
                }
            }

            setUploadProgressText('Registrando ducto y asociando coordenadas...');

            // 2. Map URLs to coordinates (matching index of sorted files)
            const coordinates = photoImportPoints.map((pt, idx) => ({
                lat: pt.lat,
                lng: pt.lng,
                timestamp: pt.timestamp.toISOString(),
                photoUrl: urls[idx] || null
            }));

            // 3. Post to manual-duct API (now saving photos in database as well)
            await api.post('/api/civil-works/manual-duct', {
                subcontractorId: photoImportSubcontractorId,
                coordinates,
                ductType: photoImportDuctType,
                comments: photoImportComments || 'Importado por lote de fotos geolocalizadas',
                photos: urls
            });

            alert('¡Ducto y fotos importados correctamente! Ya están visibles en el mapa de obra civil.');
            
            // Clean up
            setPhotoImportPoints([]);
            setPhotoImportFiles([]);
            setPhotoImportComments('');
            setPhotoImportErrors([]);
            setUploadProgressText('');
            loadAllData();
        } catch (error) {
            console.error('Error saving photo import:', error);
            alert(error.response?.data?.message || 'Error al guardar la importación de fotos.');
        } finally {
            setIsSavingPhotoImport(false);
        }
    };

    const calculatedMeters = calculateDistance(drawnPoints);

    return (
        <div className="flex flex-col gap-6 w-full">
            {/* Header */}
            <div className="glass-panel rounded-2xl p-5 border border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/70">
                <div className="flex items-center gap-3">
                    <div className="bg-orange-100 p-2.5 rounded-2xl text-orange-600">
                        <HardHat size={24} />
                    </div>
                    <div>
                        <h3 className="font-extrabold text-slate-800 text-lg">Inicialización y Carga Inicial de Obra</h3>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Actualizar el sistema con datos de proyectos en marcha</p>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200/50">
                    <button
                        onClick={() => setActiveTab('connections')}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                            activeTab === 'connections' 
                                ? 'bg-white text-orange-600 shadow-md shadow-slate-200' 
                                : 'text-slate-500 hover:text-slate-800'
                        }`}
                    >
                        <MapPin size={14} /> Acometidas Iniciales
                    </button>
                    <button
                        onClick={() => setActiveTab('ducts')}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                            activeTab === 'ducts' 
                                ? 'bg-white text-orange-600 shadow-md shadow-slate-200' 
                                : 'text-slate-500 hover:text-slate-800'
                        }`}
                    >
                        <Layers size={14} /> Ductos Iniciales
                    </button>
                    <button
                        onClick={() => setActiveTab('photoImport')}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                            activeTab === 'photoImport' 
                                ? 'bg-white text-orange-600 shadow-md shadow-slate-200' 
                                : 'text-slate-500 hover:text-slate-800'
                        }`}
                    >
                        <UploadCloud size={14} /> Importar desde Fotos
                    </button>
                </div>
            </div>

            {loadingData ? (
                <div className="flex items-center justify-center h-64 bg-white rounded-3xl border border-slate-100 shadow-md">
                    <Loader2 className="animate-spin text-orange-600" size={36} />
                </div>
            ) : (
                <>
                    {/* TAB 1: CONNECTIONS IN BULK */}
                    {activeTab === 'connections' && (
                        <div className="space-y-6">
                            {/* Filters row */}
                            <div className="glass-panel bg-white/80 border border-slate-100 p-5 rounded-3xl flex flex-wrap gap-4 items-center">
                                <div className="flex-1 min-w-[200px] relative">
                                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Buscar por calle, portal, NVT..."
                                        className="w-full pl-10 pr-4 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-slate-700"
                                    />
                                </div>

                                <div className="w-full sm:w-auto">
                                    <select
                                        value={filterProject}
                                        onChange={(e) => setFilterProject(e.target.value)}
                                        className="bg-white border border-slate-200 text-slate-600 text-xs font-semibold rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-500/20 w-full"
                                    >
                                        <option value="">Todos los Proyectos</option>
                                        {projects.map(p => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <button
                                    onClick={loadAllData}
                                    className="p-2.5 text-slate-500 hover:text-orange-600 hover:bg-slate-50 rounded-xl border border-slate-200 bg-white transition-colors"
                                    title="Recargar datos"
                                >
                                    <RefreshCw size={16} />
                                </button>
                            </div>

                            {/* Selection Header */}
                            {selectedAddressIds.length > 0 && (
                                <div className="bg-orange-50 border border-orange-100 p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-3 animate-in slide-in-from-top duration-200">
                                    <span className="text-sm font-extrabold text-orange-800">
                                        {selectedAddressIds.length} acometidas seleccionadas
                                    </span>
                                    
                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            onClick={() => handleBulkStatusChange('HECHO')}
                                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-sm flex items-center gap-1"
                                            disabled={bulkUpdating}
                                        >
                                            <Check size={14} /> Marcar como Instalado (HECHO)
                                        </button>
                                        <button
                                            onClick={() => handleBulkStatusChange('SIN_TUBO')}
                                            className="bg-slate-600 hover:bg-slate-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-sm"
                                            disabled={bulkUpdating}
                                        >
                                            Marcar como Pendiente (SIN TUBO)
                                        </button>
                                        <button
                                            onClick={() => setSelectedAddressIds([])}
                                            className="text-slate-400 hover:text-slate-600 p-1.5"
                                            title="Limpiar selección"
                                        >
                                            <X size={18} />
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Table list */}
                            <div className="bg-white border border-slate-100 rounded-3xl shadow-xl overflow-hidden max-h-[50vh] overflow-y-auto custom-scrollbar">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 text-[10px] font-bold uppercase tracking-widest sticky top-0 bg-slate-50/95 backdrop-blur z-10">
                                            <th className="p-4 w-12 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={filteredAddresses.length > 0 && selectedAddressIds.length === filteredAddresses.length}
                                                    onChange={toggleSelectAll}
                                                    className="w-4 h-4 rounded cursor-pointer accent-orange-600"
                                                />
                                            </th>
                                            <th className="p-4">Dirección Física</th>
                                            <th className="p-4">NVT</th>
                                            <th className="p-4">Proyecto</th>
                                            <th className="p-4 text-center">Estado Obra Civil</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredAddresses.length === 0 ? (
                                            <tr>
                                                <td colSpan="5" className="p-12 text-center text-slate-400 text-sm">
                                                    No se encontraron direcciones. Ajusta los filtros de búsqueda.
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredAddresses.map(addr => {
                                                const isSelected = selectedAddressIds.includes(addr.id);
                                                return (
                                                    <tr 
                                                        key={addr.id}
                                                        className={`border-b border-slate-50 hover:bg-slate-50/50 transition-colors ${
                                                            isSelected ? 'bg-orange-50/10' : ''
                                                        }`}
                                                    >
                                                        <td className="p-4 text-center">
                                                            <input
                                                                type="checkbox"
                                                                checked={isSelected}
                                                                onChange={() => toggleSelectAddress(addr.id)}
                                                                className="w-4 h-4 rounded cursor-pointer accent-orange-600"
                                                            />
                                                        </td>
                                                        <td className="p-4">
                                                            <div className="font-extrabold text-slate-800 text-sm">{addr.street} {addr.number || ''}</div>
                                                            <div className="text-[10px] text-slate-400 font-bold uppercase">{addr.city || 'N/A'}</div>
                                                        </td>
                                                        <td className="p-4 font-semibold text-slate-600 text-xs">
                                                            {addr.nvt || <span className="text-slate-300 italic">No asignado</span>}
                                                        </td>
                                                        <td className="p-4 font-bold text-slate-500 text-xs">
                                                            {addr.project?.name || 'N/A'}
                                                        </td>
                                                        <td className="p-4 text-center">
                                                            <span className={`text-[10px] font-extrabold px-3 py-1 rounded-full border ${
                                                                addr.civilWorkStatus === 'HECHO'
                                                                    ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                                                    : addr.civilWorkStatus === 'PLANIFICADO'
                                                                        ? 'bg-amber-50 text-amber-600 border-amber-100'
                                                                        : 'bg-slate-50 text-slate-500 border-slate-200'
                                                            }`}>
                                                                {addr.civilWorkStatus === 'HECHO' 
                                                                    ? 'HECHO (Tubo Instalado)' 
                                                                    : addr.civilWorkStatus || 'SIN_TUBO'}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* TAB 2 & 3: DUCT INITIALIZATION (MANUAL & BATCH PHOTO IMPORT) */}
                    {(activeTab === 'ducts' || activeTab === 'photoImport') && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {activeTab === 'ducts' ? (
                                /* Drawing form panel */
                                <div className="lg:col-span-1 space-y-6 flex flex-col justify-between bg-white border border-slate-100 p-6 rounded-3xl shadow-xl h-fit">
                                    <div className="space-y-5">
                                        <h4 className="font-black text-slate-800 text-md border-b border-slate-50 pb-2">Registro de Ducto Manual</h4>
                                        
                                        {/* Subcontractor selection */}
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Subcontrata Constructora</label>
                                            <select
                                                value={selectedSubcontractorId}
                                                onChange={(e) => setSelectedSubcontractorId(e.target.value)}
                                                className="bg-white border border-slate-200 text-slate-700 text-sm rounded-xl px-3.5 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500/20 w-full font-semibold"
                                            >
                                                <option value="">Selecciona Subcontrata...</option>
                                                {subcontractors.map(s => (
                                                    <option key={s.id} value={s.id}>{s.name}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Project filter (centering fallback) */}
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Proyecto Destino (Centrar Mapa)</label>
                                            <select
                                                value={filterProject}
                                                onChange={(e) => setFilterProject(e.target.value)}
                                                className="bg-white border border-slate-200 text-slate-700 text-sm rounded-xl px-3.5 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500/20 w-full font-semibold"
                                            >
                                                <option value="">Selecciona Proyecto...</option>
                                                {projects.map(p => (
                                                    <option key={p.id} value={p.id}>{p.name}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Search address to center map */}
                                        {filterProject && (
                                            <div className="relative">
                                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Buscar Dirección para ubicar en Mapa</label>
                                                <div className="relative">
                                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                                    <input
                                                        type="text"
                                                        value={mapSearchQuery}
                                                        onChange={(e) => setMapSearchQuery(e.target.value)}
                                                        placeholder="Escribe calle o NVT..."
                                                        className="w-full pl-9 pr-4 py-2.5 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-orange-500/20 text-slate-700 font-medium"
                                                    />
                                                    {mapSearchQuery && (
                                                        <button 
                                                            type="button"
                                                            onClick={() => { setMapSearchQuery(''); setMapSearchResults([]); }}
                                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                                        >
                                                            <X size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                                
                                                {mapSearchResults.length > 0 && (
                                                    <div className="absolute left-0 right-0 bg-white border border-slate-100 rounded-2xl shadow-xl z-[1000] mt-1 overflow-hidden max-h-48 overflow-y-auto">
                                                        {mapSearchResults.map(addr => (
                                                            <button
                                                                key={addr.id}
                                                                type="button"
                                                                onClick={() => handleSelectSearchAddress(addr)}
                                                                className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-50 last:border-0 text-[11px] font-semibold text-slate-700 flex flex-col gap-0.5"
                                                            >
                                                                <span className="font-extrabold text-slate-900">{addr.street} {addr.number || ''}</span>
                                                                <span className="text-[9px] text-slate-400 font-bold uppercase">NVT: {addr.nvt || 'N/A'}</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Duct type selector */}
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Tipo de Ducto</label>
                                            <div className="grid grid-cols-2 gap-3">
                                                <button
                                                    type="button"
                                                    onClick={() => setDuctType('7x22')}
                                                    className={`p-3.5 rounded-2xl border text-xs font-black transition-all flex flex-col items-center gap-1.5 ${
                                                        ductType === '7x22'
                                                            ? 'border-purple-600 bg-purple-50 text-purple-800 ring-2 ring-purple-500/20'
                                                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                                    }`}
                                                >
                                                    <span className="w-4 h-4 rounded-full bg-purple-500 border border-white shadow"></span>
                                                    Ducto 7x22
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setDuctType('5x10')}
                                                    className={`p-3.5 rounded-2xl border text-xs font-black transition-all flex flex-col items-center gap-1.5 ${
                                                        ductType === '5x10'
                                                            ? 'border-pink-600 bg-pink-50 text-pink-800 ring-2 ring-pink-500/20'
                                                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                                    }`}
                                                >
                                                    <span className="w-4 h-4 rounded-full bg-pink-500 border border-white shadow"></span>
                                                    Ducto 5x10
                                                </button>
                                            </div>
                                        </div>

                                        {/* Coordinates details */}
                                        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-2 text-xs">
                                            <div className="flex justify-between font-semibold text-slate-500">
                                                <span>Puntos marcados:</span>
                                                <span className="text-slate-800 font-bold">{drawnPoints.length}</span>
                                            </div>
                                            <div className="flex justify-between font-semibold text-slate-500">
                                                <span>Longitud calculada:</span>
                                                <span className="text-orange-600 font-extrabold">{calculatedMeters} metros</span>
                                            </div>
                                        </div>

                                        {/* Comments */}
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Comentarios (Opcional)</label>
                                            <textarea
                                                value={ductComments}
                                                onChange={(e) => setDuctComments(e.target.value)}
                                                rows="2"
                                                className="w-full border border-slate-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-slate-700 text-xs"
                                                placeholder="Indica detalles de la zanja/ducto ya colocados..."
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2 pt-4 border-t border-slate-55 flex flex-col gap-2">
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={handleUndoLastPoint}
                                                disabled={drawnPoints.length === 0}
                                                className="flex-1 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors border border-slate-200"
                                                title="Deshacer último punto marcado"
                                            >
                                                <Undo size={14} /> Deshacer
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleClearDrawnDuct}
                                                disabled={drawnPoints.length === 0}
                                                className="flex-1 bg-rose-50 hover:bg-rose-100 disabled:opacity-50 text-rose-700 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors border border-rose-200"
                                            >
                                                <Trash2 size={14} /> Limpiar
                                            </button>
                                        </div>
                                        
                                        <button
                                            type="button"
                                            onClick={handleSaveManualDuct}
                                            disabled={savingDuct || drawnPoints.length < 2 || !selectedSubcontractorId}
                                            className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold py-3.5 rounded-xl shadow-md flex items-center justify-center gap-2 transition-all active:scale-95 text-sm"
                                        >
                                            {savingDuct ? (
                                                <>
                                                    <Loader2 className="animate-spin" size={16} /> Guardando...
                                                </>
                                            ) : (
                                                <>
                                                    <Save size={16} /> Guardar Ducto en Obra
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                /* Photo Import Form Panel */
                                <div className="lg:col-span-1 space-y-6 flex flex-col justify-between bg-white border border-slate-100 p-6 rounded-3xl shadow-xl h-fit">
                                    <div className="space-y-5">
                                        <h4 className="font-black text-slate-800 text-md border-b border-slate-50 pb-2">Importar Ducto por Fotos</h4>
                                        
                                        {/* Subcontractor selection */}
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Subcontrata Constructora</label>
                                            <select
                                                value={photoImportSubcontractorId}
                                                onChange={(e) => setPhotoImportSubcontractorId(e.target.value)}
                                                className="bg-white border border-slate-200 text-slate-700 text-sm rounded-xl px-3.5 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500/20 w-full font-semibold"
                                            >
                                                <option value="">Selecciona Subcontrata...</option>
                                                {subcontractors.map(s => (
                                                    <option key={s.id} value={s.id}>{s.name}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Project selection */}
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Proyecto Destino</label>
                                            <select
                                                value={filterProject}
                                                onChange={(e) => setFilterProject(e.target.value)}
                                                className="bg-white border border-slate-200 text-slate-700 text-sm rounded-xl px-3.5 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500/20 w-full font-semibold"
                                            >
                                                <option value="">Selecciona Proyecto...</option>
                                                {projects.map(p => (
                                                    <option key={p.id} value={p.id}>{p.name}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Duct type */}
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Medida de Ducto</label>
                                            <div className="grid grid-cols-2 gap-3">
                                                <button
                                                    type="button"
                                                    onClick={() => setPhotoImportDuctType('7x22')}
                                                    className={`py-3 rounded-xl border text-xs font-extrabold transition-all flex items-center justify-center gap-2 ${
                                                        photoImportDuctType === '7x22'
                                                            ? 'border-violet-200 bg-violet-50 text-violet-700 ring-2 ring-violet-500/10'
                                                            : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                                                    }`}
                                                >
                                                    <span className="w-2.5 h-2.5 rounded-full bg-[#8b5cf6]" />
                                                    Ducto 7x22 (Violeta)
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setPhotoImportDuctType('5x10')}
                                                    className={`py-3 rounded-xl border text-xs font-extrabold transition-all flex items-center justify-center gap-2 ${
                                                        photoImportDuctType === '5x10'
                                                            ? 'border-pink-200 bg-pink-50/50 text-pink-700 ring-2 ring-pink-500/10'
                                                            : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                                                    }`}
                                                >
                                                    <span className="w-2.5 h-2.5 rounded-full bg-[#ec4899]" />
                                                    Ducto 5x10 (Rosa)
                                                </button>
                                            </div>
                                        </div>

                                        {/* File Uploader Dropzone */}
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Subir Lote de Fotos con GPS</label>
                                            <div className="border-2 border-dashed border-slate-200 hover:border-orange-500 rounded-2xl p-5 text-center transition-all bg-slate-50/50 hover:bg-orange-50/5 cursor-pointer relative group">
                                                <input 
                                                    type="file" 
                                                    multiple 
                                                    accept="image/*" 
                                                    onChange={handlePhotoImportSelect}
                                                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                                    disabled={isParsingPhotos || isSavingPhotoImport}
                                                />
                                                <div className="flex flex-col items-center gap-2.5 py-2">
                                                    <div className="bg-orange-100 text-orange-600 p-2.5 rounded-full group-hover:scale-110 transition-transform">
                                                        <UploadCloud size={20} />
                                                    </div>
                                                    <div>
                                                        <span className="text-xs font-extrabold text-slate-700 block">Selecciona las fotos de obra</span>
                                                        <span className="text-[10px] text-slate-400 font-bold block mt-1 uppercase tracking-wider">Las fotos se ordenarán automáticamente</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Parsing progress */}
                                        {isParsingPhotos && (
                                            <div className="flex items-center gap-2 text-xs font-bold text-orange-600 bg-orange-50/50 border border-orange-100 p-3.5 rounded-xl animate-pulse">
                                                <Loader2 size={14} className="animate-spin" />
                                                Procesando metadatos de las imágenes...
                                            </div>
                                        )}

                                        {/* Summary analysis */}
                                        {(photoImportPoints.length > 0 || photoImportErrors.length > 0) && (
                                            <div className="space-y-3 bg-slate-50 border border-slate-100 rounded-2xl p-4 text-xs font-semibold text-slate-700">
                                                {photoImportPoints.length > 0 && (
                                                    <>
                                                        <div className="flex justify-between items-center border-b border-slate-200/50 pb-2">
                                                            <span>Fotos geolocalizadas:</span>
                                                            <span className="font-extrabold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-lg">{photoImportPoints.length} fotos</span>
                                                        </div>
                                                        <div className="flex justify-between items-center border-b border-slate-200/50 pb-2">
                                                            <span>Distancia estimada:</span>
                                                            <span className="font-extrabold text-slate-800">{calculateDistance(photoImportPoints)} metros</span>
                                                        </div>
                                                    </>
                                                )}
                                                {photoImportErrors.length > 0 && (
                                                    <div className="space-y-1 pt-1">
                                                        <div className="text-amber-600 font-bold flex items-center gap-1 text-[10px] uppercase">
                                                            <AlertCircle size={12} />
                                                            Omitidas sin metadatos GPS ({photoImportErrors.length}):
                                                        </div>
                                                        <div className="max-h-24 overflow-y-auto text-[9px] text-slate-500 bg-white border border-slate-200/60 rounded-xl p-2 font-mono custom-scrollbar">
                                                            {photoImportErrors.map((err, idx) => (
                                                                <div key={idx} className="truncate">{err}</div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Comments */}
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Comentarios (Opcional)</label>
                                            <textarea
                                                value={photoImportComments}
                                                onChange={(e) => setPhotoImportComments(e.target.value)}
                                                rows="2"
                                                className="w-full border border-slate-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-slate-700 text-xs"
                                                placeholder="Comentarios sobre este lote de fotos importadas..."
                                            />
                                        </div>
                                    </div>

                                    <div className="pt-4 border-t border-slate-100">
                                        <button
                                            type="button"
                                            onClick={handleSavePhotoImport}
                                            disabled={isSavingPhotoImport || photoImportPoints.length < 2 || !photoImportSubcontractorId}
                                            className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold py-3.5 rounded-xl shadow-md flex items-center justify-center gap-2 transition-all active:scale-95 text-sm"
                                        >
                                            {isSavingPhotoImport ? (
                                                <>
                                                    <Loader2 className="animate-spin" size={16} />
                                                    <span className="text-xs truncate">{uploadProgressText}</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Save size={16} /> Importar y Guardar Ducto
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Shared Interactive Map */}
                            <div className="lg:col-span-2 bg-slate-100 border border-slate-100 rounded-3xl overflow-hidden shadow-xl min-h-[500px] relative flex flex-col">
                                <div className="absolute top-4 left-4 z-[500] bg-orange-600/90 text-white px-4 py-2.5 rounded-2xl text-xs font-black shadow-md flex items-center gap-2 border border-orange-500/30 backdrop-blur-sm">
                                    {activeTab === 'ducts' ? (
                                        <>
                                            <Compass size={14} className="animate-pulse" /> Modo Trazado: Haz clic sobre el mapa para dibujar el ducto punto por punto.
                                        </>
                                    ) : (
                                        <>
                                            <UploadCloud size={14} className="animate-pulse" /> Vista Previa: Trazado generado cronológicamente a partir de las fotos.
                                        </>
                                    )}
                                </div>
                                <div ref={initMapRef} className="w-full h-full flex-1 z-10 drawing-map-container" />
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Full-screen Photo Modal */}
            {activePhotoModal && (
                <div 
                    className="fixed inset-0 bg-black/85 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm"
                    onClick={() => setActivePhotoModal(null)}
                >
                    <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
                        <button 
                            className="absolute top-4 right-4 bg-white/20 hover:bg-white/40 text-white rounded-full p-2.5 transition-colors"
                            onClick={() => setActivePhotoModal(null)}
                        >
                            <X size={24} />
                        </button>
                        <img 
                            src={activePhotoModal} 
                            alt="Trabajo realizado" 
                            className="max-w-full max-h-[80vh] rounded-2xl object-contain shadow-2xl border border-white/10" 
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default CivilWorksInit;
