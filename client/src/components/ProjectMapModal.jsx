import React, { useEffect, useState, useRef } from 'react';
import api from '../api/axios';
import { X, Loader2, Info, MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const ProjectMapModal = ({ isOpen, projectId, onClose }) => {
    const { t } = useTranslation();
    const [leafletLoaded, setLeafletLoaded] = useState(false);
    const [addresses, setAddresses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [progress, setProgress] = useState(0);
    const [project, setProject] = useState(null);

    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const markersGroupRef = useRef(null);

    // 1. Dynamic Leaflet asset loading
    useEffect(() => {
        if (!isOpen) return;

        // Load CSS
        const linkId = 'leaflet-css';
        if (!document.getElementById(linkId)) {
            const link = document.createElement('link');
            link.id = linkId;
            link.rel = 'stylesheet';
            link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
            document.head.appendChild(link);
        }

        // Load JS
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
                const interval = setInterval(() => {
                    if (window.L) {
                        setLeafletLoaded(true);
                        clearInterval(interval);
                    }
                }, 100);
                return () => clearInterval(interval);
            }
        }
    }, [isOpen]);

    // 2. Fetch Map Data
    useEffect(() => {
        if (!isOpen || !projectId) return;

        const fetchData = async () => {
            setLoading(true);
            setProgress(0);
            try {
                // Fetch project details
                const projRes = await api.get('/api/projects');
                const matchedProj = projRes.data.find(p => p.id === projectId);
                setProject(matchedProj);

                // Fetch map addresses
                const res = await api.get(`/api/projects/${projectId}/map-data`);
                setAddresses(res.data);
            } catch (error) {
                console.error('Error fetching map data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [isOpen, projectId]);

    // 3. Multi-Stage Failsafe Geocoding helpers with local caching
    const geocodeCity = async (city) => {
        const cacheKey = 'joa-map-geo-cache-v2'; // Bumped cache key version to discard corrupt/null caches
        let cache = {};
        try {
            cache = JSON.parse(localStorage.getItem(cacheKey) || '{}');
        } catch (e) {}

        if (cache[city] && cache[city].lat && cache[city].lng) return cache[city];

        // --- STAGE 1: Photon API by Komoot (Extremely fast, free, no rate blocks, ideal for Germany) ---
        try {
            const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(city)}`;
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                if (data && data.features && data.features.length > 0) {
                    const coords = {
                        lat: parseFloat(data.features[0].geometry.coordinates[1]),
                        lng: parseFloat(data.features[0].geometry.coordinates[0])
                    };
                    cache[city] = coords;
                    localStorage.setItem(cacheKey, JSON.stringify(cache));
                    return coords;
                }
            }
        } catch (error) {
            console.error('Photon city geocoding error:', city, error);
        }

        // --- STAGE 2: Nominatim German Mirror ---
        try {
            const url = `https://nominatim.openstreetmap.de/search?format=json&q=${encodeURIComponent(city)}`;
            const res = await fetch(url, {
                headers: { 'Accept': 'application/json' }
            });
            if (res.ok) {
                const data = await res.json();
                if (data && data.length > 0) {
                    const coords = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
                    cache[city] = coords;
                    localStorage.setItem(cacheKey, JSON.stringify(cache));
                    return coords;
                }
            }
        } catch (error) {
            console.error('Nominatim DE city geocoding error:', city, error);
        }

        return null;
    };

    const getCleanStreet = (street) => {
        if (!street) return '';
        // Clean German street names of house numbers (e.g. "Bahnhofstraße 12a" -> "Bahnhofstraße")
        return street.replace(/\s+\d+.*$/, '').trim();
    };

    const geocodeStreet = async (streetName, city) => {
        const cacheKey = 'joa-map-geo-cache-v2';
        let cache = {};
        try {
            cache = JSON.parse(localStorage.getItem(cacheKey) || '{}');
        } catch (e) {}

        const queryStr = `${streetName}, ${city || ''}`.trim();
        if (cache[queryStr] && cache[queryStr].lat && cache[queryStr].lng) return cache[queryStr];

        // --- STAGE 1: Photon API by Komoot (Extremely fast, free, no rate blocks, ideal for Germany) ---
        try {
            const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(queryStr)}`;
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                if (data && data.features && data.features.length > 0) {
                    const coords = {
                        lat: parseFloat(data.features[0].geometry.coordinates[1]),
                        lng: parseFloat(data.features[0].geometry.coordinates[0])
                    };
                    cache[queryStr] = coords;
                    localStorage.setItem(cacheKey, JSON.stringify(cache));
                    return coords;
                }
            }
        } catch (error) {
            console.error('Photon street geocoding error:', queryStr, error);
        }

        // --- STAGE 2: Nominatim German Mirror ---
        try {
            const url = `https://nominatim.openstreetmap.de/search?format=json&q=${encodeURIComponent(queryStr)}`;
            const res = await fetch(url, {
                headers: { 'Accept': 'application/json' }
            });
            if (res.ok) {
                const data = await res.json();
                if (data && data.length > 0) {
                    const coords = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
                    cache[queryStr] = coords;
                    localStorage.setItem(cacheKey, JSON.stringify(cache));
                    return coords;
                }
            }
        } catch (error) {
            console.error('Nominatim DE street geocoding error:', queryStr, error);
        }

        // --- STAGE 3: Nominatim Official ---
        try {
            const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(queryStr)}`;
            const res = await fetch(url, {
                headers: { 'Accept': 'application/json' }
            });
            if (res.ok) {
                const data = await res.json();
                if (data && data.length > 0) {
                    const coords = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
                    cache[queryStr] = coords;
                    localStorage.setItem(cacheKey, JSON.stringify(cache));
                    return coords;
                }
            }
        } catch (error) {
            console.error('Nominatim ORG street geocoding error:', queryStr, error);
        }

        return null;
    };

    const getScatteredCoords = (center, index) => {
        const goldenAngle = 137.5 * (Math.PI / 180);
        const radiusMultiplier = 0.00035; 
        const radius = Math.sqrt(index + 1) * radiusMultiplier;
        const theta = (index + 1) * goldenAngle;
        
        return {
            lat: center.lat + radius * Math.sin(theta),
            lng: center.lng + radius * Math.cos(theta),
            isScattered: true
        };
    };

    const getAddressStatus = (addr) => {
        const isCompleted = 
            addr.appointment?.status === 'COMPLETADO' ||
            (addr.activationInfo && !addr.activationInfo.isDraft) ||
            addr.simpleInstallation !== null;
            
        if (isCompleted) {
            return {
                color: 'green',
                label: t('map.status_completed') || 'Terminada',
                class: 'bg-emerald-500 shadow-emerald-500/50'
            };
        }

        const isScheduled = addr.appointment?.status === 'CITADO';
        if (isScheduled) {
            return {
                color: 'yellow',
                label: t('map.status_scheduled') || 'Citada',
                class: 'bg-amber-400 shadow-amber-400/50'
            };
        }

        const isBlown = addr.sopladoStatus === 'OK';
        if (isBlown) {
            return {
                color: 'red',
                label: t('map.status_blown') || 'Soplado sin cita',
                class: 'bg-rose-500 shadow-rose-500/50 animate-pulse'
            };
        }

        return {
            color: 'gray',
            label: t('map.status_not_blown') || 'No soplado',
            class: 'bg-slate-400 shadow-slate-400/50'
        };
    };

    // 4. Map initialization & rendering
    useEffect(() => {
        if (!isOpen || !leafletLoaded || !addresses.length || !mapRef.current) return;

        const L = window.L;

        const initMap = async () => {
            const firstCity = addresses.find(a => a.city)?.city || 'Gau-Bickelheim';
            const center = await geocodeCity(firstCity) || { lat: 49.8358, lng: 8.0163 };

            if (!mapInstanceRef.current) {
                mapInstanceRef.current = L.map(mapRef.current, {
                    zoomControl: false
                }).setView([center.lat, center.lng], 13);

                L.control.zoom({ position: 'bottomright' }).addTo(mapInstanceRef.current);

                L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
                    attribution: '&copy; OpenStreetMap'
                }).addTo(mapInstanceRef.current);

                markersGroupRef.current = L.featureGroup().addTo(mapInstanceRef.current);
            } else {
                mapInstanceRef.current.setView([center.lat, center.lng], 13);
                markersGroupRef.current.clearLayers();
            }

            // Extract unique streets in this city
            const uniqueStreets = [...new Set(addresses.map(a => getCleanStreet(a.street)))].filter(Boolean);
            const streetCoordsMap = {};

            // Sequential failsafe geocoding with short delay for uncached streets
            let streetIndex = 0;
            for (const str of uniqueStreets) {
                const queryStr = `${str}, ${firstCity}`.trim();
                
                const cacheKey = 'joa-map-geo-cache-v2';
                let cache = {};
                try {
                    cache = JSON.parse(localStorage.getItem(cacheKey) || '{}');
                } catch (e) {}

                if (!cache[queryStr]) {
                    await new Promise(r => setTimeout(r, 80));
                }

                const coords = await geocodeStreet(str, firstCity);
                if (coords) {
                    streetCoordsMap[str] = coords;
                }
                
                streetIndex++;
                setProgress(Math.round((streetIndex / uniqueStreets.length) * 100));
            }

            const streetIndexes = {};

            // Tight compact grid layout: keeps all markers within ~25m of street center
            // regardless of how many houses share the same street.
            // ~0.00015 degrees ≈ 15 meters. Grid of 8 columns × N rows.
            const COLS = 8;
            const STEP_LAT = 0.00014; // ~15m north-south spacing
            const STEP_LNG = 0.00020; // ~15m east-west spacing (slightly wider for lng)

            let addrIndex = 0;
            for (const addr of addresses) {
                const status = getAddressStatus(addr);
                const cleanStr = getCleanStreet(addr.street);
                const streetCoords = streetCoordsMap[cleanStr];

                let coords;
                if (streetCoords) {
                    const idxOnStreet = streetIndexes[cleanStr] || 0;
                    streetIndexes[cleanStr] = idxOnStreet + 1;

                    // Place in a compact rectangular grid around the street centroid
                    const col = idxOnStreet % COLS;
                    const row = Math.floor(idxOnStreet / COLS);
                    // Offset symmetrically so they cluster tightly around the street point
                    const colOffset = (col - (COLS - 1) / 2) * STEP_LNG;
                    const rowOffset = (row - 0.5) * STEP_LAT;

                    coords = {
                        lat: streetCoords.lat + rowOffset,
                        lng: streetCoords.lng + colOffset
                    };
                } else {
                    // Fallback to spiral scatter if street geocoding failed
                    coords = getScatteredCoords(center, addrIndex);
                }

                const iconHtml = `<div class="w-4.5 h-4.5 rounded-full border-2 border-white shadow-md transition-all duration-300 transform hover:scale-130 flex items-center justify-center ${status.class}"></div>`;
                const customIcon = L.divIcon({
                    html: iconHtml,
                    className: 'custom-map-marker',
                    iconSize: [18, 18],
                    iconAnchor: [9, 9]
                });

                const marker = L.marker([coords.lat, coords.lng], { icon: customIcon });

                // Tooltip on hover for Yellow (Citadas) points
                if (status.color === 'yellow' && addr.appointment?.assignedDate) {
                    const apptDateStr = new Date(addr.appointment.assignedDate).toLocaleString('es-ES', {
                        dateStyle: 'short',
                        timeStyle: 'short'
                    });
                    
                    marker.bindTooltip(
                        `<div class="p-1 font-sans font-bold text-slate-800 text-xs leading-snug">
                            <div class="text-amber-600 flex items-center gap-1 font-extrabold uppercase tracking-wide">
                                📅 Cita Programada
                            </div>
                            <div class="mt-1 font-semibold text-slate-700">${apptDateStr}</div>
                         </div>`, 
                        {
                            permanent: false,
                            direction: 'top',
                            opacity: 0.95,
                            offset: [0, -8]
                        }
                    );
                }

                // Popup on click
                const popupHtml = `
                    <div class="p-3 font-sans max-w-xs text-slate-800">
                        <div class="flex items-center gap-1.5 font-black text-xs uppercase text-indigo-700 border-b border-slate-100 pb-1.5 mb-2">
                            <span>🏠 DETALLE DEL CLIENTE</span>
                        </div>
                        <div class="space-y-1.5 text-[11px] leading-relaxed">
                            <div><strong>Nombre:</strong> ${addr.clientName || 'Sin Nombre'}</div>
                            <div><strong>Dirección:</strong> ${addr.street} ${addr.number || ''}</div>
                            <div><strong>Ciudad:</strong> ${addr.city || '-'}</div>
                            <div><strong>Caja NVT:</strong> <span class="bg-slate-100 px-1.5 py-0.5 rounded font-mono font-bold text-slate-600">${addr.nvt || 'Sin NVT'}</span></div>
                            <div class="pt-2 flex items-center gap-2 border-t border-slate-100 mt-2">
                                <span class="w-3.5 h-3.5 rounded-full inline-block border border-white ${status.class}"></span>
                                <span class="font-extrabold text-slate-700">${status.label}</span>
                            </div>
                        </div>
                    </div>
                `;
                marker.bindPopup(popupHtml, {
                    maxWidth: 250,
                    className: 'custom-map-popup'
                });

                markersGroupRef.current.addLayer(marker);
                addrIndex++;
            }

            if (markersGroupRef.current.getLayers().length > 0) {
                mapInstanceRef.current.fitBounds(markersGroupRef.current.getBounds(), {
                    padding: [40, 40]
                });
            }
        };

        initMap();
    }, [leafletLoaded, addresses]);

    // Handle close and clean map
    const handleClose = () => {
        if (mapInstanceRef.current) {
            mapInstanceRef.current.remove();
            mapInstanceRef.current = null;
        }
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-6xl h-[85vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden relative">
                
                {/* Header */}
                <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <div className="flex items-center gap-3">
                        <div className="bg-indigo-100 p-2.5 rounded-2xl text-indigo-600">
                            <MapPin size={24} />
                        </div>
                        <div>
                            <h3 className="font-extrabold text-slate-800 text-lg">
                                {project ? project.name : t('map.loading') || 'Cargando Proyecto...'}
                            </h3>
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">
                                {addresses.length} {t('map.total_addresses') || 'Clientes / Puntos de Red'}
                            </p>
                        </div>
                    </div>
                    
                    <button 
                        onClick={handleClose} 
                        className="bg-slate-200 hover:bg-slate-300 text-slate-600 p-2 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content Area */}
                <div className="flex-1 relative bg-slate-50">
                    
                    {/* Geocoding Progress Loader */}
                    {(loading || progress < 100) && (
                        <div className="absolute inset-0 bg-white/90 backdrop-blur-sm z-[1000] flex flex-col items-center justify-center p-6 text-center">
                            <Loader2 className="animate-spin text-indigo-600 mb-4" size={48} />
                            <h4 className="font-extrabold text-slate-800 text-lg">
                                {loading ? 'Cargando información del proyecto...' : 'Geolocalizando calles del proyecto...'}
                            </h4>
                            <p className="text-slate-500 text-sm mt-1 max-w-sm">
                                {loading ? 'Esto tardará solo un instante.' : 'Estamos localizando las calles de forma segura para posicionar a los clientes.'}
                            </p>
                            
                            {!loading && (
                                <div className="w-64 bg-slate-100 h-2.5 rounded-full mt-5 overflow-hidden border border-slate-200">
                                    <div 
                                        className="bg-indigo-600 h-full transition-all duration-300 rounded-full" 
                                        style={{ width: `${progress}%` }}
                                    ></div>
                                </div>
                            )}
                            <span className="text-xs font-bold text-indigo-600 mt-2">
                                {loading ? '' : `Analizando calles: ${progress}%`}
                            </span>
                        </div>
                    )}

                    {/* Leaflet Map Canvas */}
                    <div ref={mapRef} className="w-full h-full z-10"></div>

                    {/* Floating Legend */}
                    <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-slate-100 z-[999] max-w-xs space-y-3 font-sans">
                        <div className="flex items-center gap-1.5 font-extrabold text-xs text-slate-700 uppercase tracking-wider pb-1.5 border-b border-slate-100">
                            <Info size={14} className="text-slate-500" />
                            <span>Leyenda del Mapa</span>
                        </div>
                        <div className="space-y-2.5 text-xs">
                            <div className="flex items-center gap-3">
                                <span className="w-3.5 h-3.5 rounded-full bg-slate-400 border border-white shadow-sm shrink-0"></span>
                                <span className="text-slate-600 font-bold">No soplado</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="w-3.5 h-3.5 rounded-full bg-rose-500 border border-white shadow-sm shrink-0 animate-pulse"></span>
                                <span className="text-slate-600 font-bold">Soplado sin cita</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="w-3.5 h-3.5 rounded-full bg-amber-400 border border-white shadow-sm shrink-0"></span>
                                <span className="text-slate-600 font-bold flex flex-col">
                                    <span>Citada (Cita pendiente)</span>
                                    <span className="text-[10px] text-amber-600 font-extrabold uppercase">Pasa el ratón para ver la cita</span>
                                </span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 border border-white shadow-sm shrink-0"></span>
                                <span className="text-slate-600 font-bold">Terminada (Completado)</span>
                            </div>
                        </div>
                    </div>

                </div>

            </div>
        </div>
    );
};

export default ProjectMapModal;
