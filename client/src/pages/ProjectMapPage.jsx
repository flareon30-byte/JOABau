import React, { useState, useEffect, useRef } from 'react';
import { MapPin, ChevronDown, Loader2, Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../api/axios';

const CACHE_KEY = 'joa-map-geo-cache-v5'; // v5: Google Maps API
const GOOGLE_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY;

const loadCache = () => {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); } catch { return {}; }
};
const saveCache = (cache) => {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch {}
};

// Multi-stage geocoding — Stage 1: Google Maps (most accurate)
// Stage 2: Photon (house verification)
// Stage 3: Nominatim structured (precise for German rural addresses)
// Stage 4: Photon street-only (fallback)
const geocodeFull = async (street, number, city, cache) => {
    const cacheKey = [street, number, city].filter(Boolean).join(' ').trim();
    if (!cacheKey) return null;
    if (cache[cacheKey]?.lat) return cache[cacheKey];

    // Stage 1: Google Maps Geocoding API
    if (GOOGLE_KEY) {
        try {
            const address = [street, number, city, 'Germany'].filter(Boolean).join(', ');
            const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_KEY}&region=de&language=de`;
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
        const q = [street, number, city].filter(Boolean).join(', ').trim();
        const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=1&lang=de`;
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
                countrycodes: 'de',
                limit: '1',
            });
            const url = `https://nominatim.openstreetmap.org/search?${params}`;
            const res = await fetch(url, {
                headers: { 'Accept': 'application/json', 'Accept-Language': 'de' }
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
    const streetKey = [street, city].filter(Boolean).join(', ').trim();
    if (cache[streetKey]?.lat) return cache[streetKey];
    try {
        const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(streetKey)}&limit=1&lang=de`;
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

// Fallback scatter for addresses that cannot be geocoded at all
const scatter = (center, index) => {
    const a = 137.5 * (Math.PI / 180);
    const r = Math.sqrt(index + 1) * 0.00025;
    const t = (index + 1) * a;
    return { lat: center.lat + r * Math.sin(t), lng: center.lng + r * Math.cos(t) };
};

const ProjectMapPage = () => {
    const { t } = useTranslation();
    const [projects, setProjects] = useState([]);
    const [selectedProjectId, setSelectedProjectId] = useState('');
    const [leafletLoaded, setLeafletLoaded] = useState(false);
    const [addresses, setAddresses] = useState([]);
    const [nvtLocations, setNvtLocations] = useState([]);
    const [loadingData, setLoadingData] = useState(false);
    const [loadingMap, setLoadingMap] = useState(false);
    const [progress, setProgress] = useState(0);
    const [progressLabel, setProgressLabel] = useState('');
    const [userLocation, setUserLocation] = useState(null);

    // Retrieve logged-in user profile & role
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const isTechnician = ['BLOWER', 'ACTIVATOR', 'PROTOCOL_MANAGER'].includes(user.role);

    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const markersGroupRef = useRef(null);
    const cancelledRef = useRef(false);

    // Dynamic stats
    const [stats, setStats] = useState({ notBlown: 0, blown: 0, scheduled: 0, completed: 0 });

    // Request browser Geolocation on mount
    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setUserLocation({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    });
                },
                (error) => {
                    console.warn('Geolocation access declined or unavailable:', error.message);
                },
                { enableHighAccuracy: true, timeout: 10000 }
            );
        }
    }, []);

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

        const scriptId = 'leaflet-js';
        if (!document.getElementById(scriptId)) {
            const script = document.createElement('script');
            script.id = scriptId;
            script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
            script.onload = () => setLeafletLoaded(true);
            document.body.appendChild(script);
        } else {
            if (window.L) setLeafletLoaded(true);
            else {
                const iv = setInterval(() => { if (window.L) { setLeafletLoaded(true); clearInterval(iv); } }, 100);
                return () => clearInterval(iv);
            }
        }
    }, []);

    // Fetch project list
    useEffect(() => {
        const fetchProjects = async () => {
            try {
                const res = await api.get('/api/projects');
                const sorted = [...res.data].sort((a, b) => a.name.localeCompare(b.name));
                setProjects(sorted);
                if (sorted.length > 0) {
                    setSelectedProjectId(sorted[0].id);
                }
            } catch (e) {
                console.error('Error fetching projects:', e);
            }
        };
        fetchProjects();
    }, []);

    // Fetch address data for selected project
    const fetchMapData = async () => {
        if (!selectedProjectId) return;
        setLoadingData(true);
        setAddresses([]);
        setNvtLocations([]);
        try {
            const [addressesRes, nvtRes] = await Promise.all([
                api.get(`/api/projects/${selectedProjectId}/map-data`),
                api.get(`/api/soplado/nvt-locations/${selectedProjectId}`)
            ]);
            setAddresses(addressesRes.data);
            setNvtLocations(nvtRes.data.filter(n => n.street && n.street.trim() !== ''));

            // Compute stats
            let notBlown = 0, blown = 0, scheduled = 0, completed = 0;
            addressesRes.data.forEach(addr => {
                const done =
                    addr.appointment?.status === 'COMPLETADO' ||
                    (addr.activationInfo && !addr.activationInfo.isDraft) ||
                    addr.simpleInstallation !== null;
                if (done) completed++;
                else if (addr.appointment?.status === 'CITADO') scheduled++;
                else if (addr.sopladoStatus === 'OK') blown++;
                else notBlown++;
            });
            setStats({ notBlown, blown, scheduled, completed });
        } catch (e) {
            console.error('Error loading project map data:', e);
        } finally {
            setLoadingData(false);
        }
    };

    useEffect(() => {
        fetchMapData();
    }, [selectedProjectId]);

    const getStatus = (addr) => {
        const done =
            addr.appointment?.status === 'COMPLETADO' ||
            (addr.activationInfo && !addr.activationInfo.isDraft) ||
            addr.simpleInstallation !== null;
        if (done) return { color: 'green',  label: 'Terminada',     cls: 'bg-emerald-500' };
        if (addr.appointment?.status === 'CITADO') return { color: 'yellow', label: 'Citada', cls: 'bg-amber-400' };
        if (addr.sopladoStatus === 'OK') return { color: 'red', label: 'Soplado sin cita', cls: 'bg-rose-500 animate-pulse' };
        return { color: 'gray', label: 'No soplado', cls: 'bg-slate-400' };
    };

    // Render Leaflet map
    useEffect(() => {
        if (!leafletLoaded || !addresses.length || !mapRef.current) return;

        const L = window.L;
        cancelledRef.current = false;
        setLoadingMap(true);
        setProgress(0);

        const buildMap = async () => {
            // ---- city center ----
            const cityName = addresses.find(a => a.city)?.city || '';
            let center = { lat: 49.8358, lng: 8.0163 };
            if (cityName) {
                setProgressLabel(`Localizando ${cityName}…`);
                try {
                    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(cityName)}&limit=1`;
                    const res = await fetch(url);
                    if (res.ok) {
                        const d = await res.json();
                        if (d?.features?.length) {
                            const [lng, lat] = d.features[0].geometry.coordinates;
                            center = { lat: parseFloat(lat), lng: parseFloat(lng) };
                        }
                    }
                } catch {}
            }
            if (cancelledRef.current) return;

            // ---- init Leaflet ----
            if (!mapInstanceRef.current) {
                mapInstanceRef.current = L.map(mapRef.current, { zoomControl: false })
                    .setView([center.lat, center.lng], 14);
                L.control.zoom({ position: 'bottomright' }).addTo(mapInstanceRef.current);
                L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
                    attribution: '&copy; OpenStreetMap'
                }).addTo(mapInstanceRef.current);
                markersGroupRef.current = L.featureGroup().addTo(mapInstanceRef.current);

                // --- POPUP OPEN LISTENER FOR AJAX REQUEST BUTTONS ---
                mapInstanceRef.current.on('popupopen', (e) => {
                    const popupEl = e.popup.getElement();
                    const btn = popupEl.querySelector('[id^="btn-request-"]');
                    if (btn) {
                        const addrId = btn.id.replace('btn-request-', '');
                        btn.onclick = async () => {
                            btn.disabled = true;
                            btn.innerHTML = `<svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Solicitando...`;
                            try {
                                await api.post(`/api/appointments/request-appointment/${addrId}`);
                                btn.className = "mt-3 w-full bg-emerald-500 text-white font-bold py-2 px-3 rounded-lg text-xs text-center flex items-center justify-center gap-1.5 shadow-sm";
                                btn.innerHTML = `✓ Cita Solicitada`;
                                btn.onclick = null;
                                
                                // Auto reload backend data to refresh state
                                setTimeout(() => {
                                    fetchMapData();
                                }, 1500);
                            } catch (err) {
                                console.error(err);
                                const errMsg = err.response?.data?.message || 'Error al solicitar la orden.';
                                alert(errMsg);
                                btn.disabled = false;
                                btn.innerHTML = `📋 Solicitar cita para mi equipo`;
                            }
                        };
                    }
                });
            } else {
                mapInstanceRef.current.setView([center.lat, center.lng], 14);
                markersGroupRef.current.clearLayers();
            }

            // ---- geocode each address in parallel-safe batches ----
            const BATCH = 10;
            const DELAY = 80;
            const cache = loadCache();
            const coordsList = new Array(addresses.length).fill(null);

            for (let i = 0; i < addresses.length; i += BATCH) {
                if (cancelledRef.current) return;
                const batch = addresses.slice(i, i + BATCH);
                const results = await Promise.all(
                    batch.map(addr => geocodeFull(addr.street, addr.number, addr.city, cache))
                );
                results.forEach((c, j) => { coordsList[i + j] = c; });
                saveCache(cache);
                
                const done = Math.min(i + BATCH, addresses.length);
                setProgress(Math.round((done / addresses.length) * 100));
                setProgressLabel(`Geolocalizando ${done}/${addresses.length} clientes…`);
                
                if (i + BATCH < addresses.length) {
                    await new Promise(r => setTimeout(r, DELAY));
                }
            }

            const nvtCoordsList = new Array(nvtLocations.length).fill(null);
            for (let i = 0; i < nvtLocations.length; i += BATCH) {
                if (cancelledRef.current) return;
                const batch = nvtLocations.slice(i, i + BATCH);
                const results = await Promise.all(
                    batch.map(n => geocodeFull(n.street, n.number, n.city, cache))
                );
                results.forEach((c, j) => { nvtCoordsList[i + j] = c; });
                saveCache(cache);
                if (i + BATCH < nvtLocations.length) {
                    await new Promise(r => setTimeout(r, DELAY));
                }
            }

            if (cancelledRef.current) return;
            setLoadingMap(false);

            // ---- place user location marker if available ----
            if (userLocation) {
                const userIcon = L.divIcon({
                    html: `
                        <div class="relative flex items-center justify-center">
                            <div class="absolute w-6 h-6 bg-blue-500 rounded-full animate-ping opacity-40"></div>
                            <div class="relative w-4 h-4 bg-blue-600 rounded-full border-2 border-white shadow-md"></div>
                        </div>
                    `,
                    className: '',
                    iconSize: [24, 24],
                    iconAnchor: [12, 12]
                });
                const userMarker = L.marker([userLocation.lat, userLocation.lng], { icon: userIcon });
                userMarker.bindTooltip("Tu ubicación actual", { permanent: false, direction: 'top' });
                markersGroupRef.current.addLayer(userMarker);
            }

            // ---- place markers ----
            const JITTER_COLS  = 4;
            const JITTER_LAT   = 0.00009;  // ≈ 10 m
            const JITTER_LNG   = 0.00014;  // ≈ 10 m

            const coordCount = {};
            addresses.forEach((_, i) => {
                const c = coordsList[i];
                if (!c) return;
                const k = `${c.lat.toFixed(5)}_${c.lng.toFixed(5)}`;
                coordCount[k] = (coordCount[k] || 0) + 1;
            });
            const coordSeen = {};

            addresses.forEach((addr, i) => {
                if (cancelledRef.current) return;
                const status = getStatus(addr);
                let coords = coordsList[i];

                if (!coords) {
                    coords = scatter(center, i);
                } else {
                    const k = `${coords.lat.toFixed(5)}_${coords.lng.toFixed(5)}`;
                    const total = coordCount[k] || 1;
                    if (total > 1) {
                        const idx = coordSeen[k] || 0;
                        coordSeen[k] = idx + 1;
                        
                        const col      = idx % JITTER_COLS;
                        const row      = Math.floor(idx / JITTER_COLS);
                        const totalRows = Math.ceil(total / JITTER_COLS);
                        const colOffset = (col - (JITTER_COLS - 1) / 2) * JITTER_LNG;
                        const rowOffset = (row - (totalRows - 1) / 2) * JITTER_LAT;
                        coords = {
                            lat: coords.lat + rowOffset,
                            lng: coords.lng + colOffset
                        };
                    }
                }

                const icon = L.divIcon({
                    html: `<div style="width:14px;height:14px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)" class="${status.cls}"></div>`,
                    className: '',
                    iconSize: [14, 14],
                    iconAnchor: [7, 7]
                });

                const marker = L.marker([coords.lat, coords.lng], { icon });

                if (status.color === 'yellow' && addr.appointment?.assignedDate) {
                    const dateStr = new Date(addr.appointment.assignedDate).toLocaleString('es-ES', {
                        dateStyle: 'short', timeStyle: 'short'
                    });
                    marker.bindTooltip(
                        `<div style="font:bold 11px sans-serif;color:#92400e">📅 ${dateStr}</div>`,
                        { permanent: false, direction: 'top', opacity: 0.95, offset: [0, -6] }
                    );
                }

                // Render AJAX Request Button if red marker and user is technician
                let requestBtnHtml = '';
                if (status.color === 'red' && isTechnician) {
                    requestBtnHtml = `
                        <button id="btn-request-${addr.id}" style="margin-top:12px;width:100%;background:#4f46e5;color:#fff;font-weight:700;border:none;border-radius:8px;padding:8px;font-size:11px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;box-shadow:0 1px 2px rgba(0,0,0,.05)">
                            📋 Solicitar cita para mi equipo
                        </button>
                    `;
                }

                marker.bindPopup(`
                    <div style="font:13px sans-serif;color:#1e293b;min-width:180px">
                        <div style="font-weight:900;font-size:11px;text-transform:uppercase;color:#4338ca;border-bottom:1px solid #e2e8f0;padding-bottom:6px;margin-bottom:8px">🏠 Detalle del cliente</div>
                        <div style="line-height:1.7;font-size:11px">
                            <b>Nombre:</b> ${addr.clientName || '—'}<br>
                            <b>Dirección:</b> ${addr.street} ${addr.number || ''}<br>
                            <b>Ciudad:</b> ${addr.city || '—'}<br>
                            <b>NVT:</b> <code style="background:#f1f5f9;padding:1px 4px;border-radius:3px">${addr.nvt || '—'}</code>
                        </div>
                        ${requestBtnHtml}
                    </div>
                `, { maxWidth: 240 });

                markersGroupRef.current.addLayer(marker);
            });

            // ---- place NVT markers ----
            nvtLocations.forEach((nvt, i) => {
                if (cancelledRef.current) return;
                const coords = nvtCoordsList[i];
                if (!coords) return;

                const nvtIcon = L.divIcon({
                    html: `<div style="width:16px;height:16px;border-radius:4px;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;color:#fff;font-size:9px;font-weight:900" class="bg-indigo-700">N</div>`,
                    className: '',
                    iconSize: [16, 16],
                    iconAnchor: [8, 8]
                });

                const nvtMarker = L.marker([coords.lat, coords.lng], { icon: nvtIcon });
                nvtMarker.bindPopup(`
                    <div style="font:13px sans-serif;color:#1e293b;min-width:180px">
                        <div style="font-weight:900;font-size:11px;text-transform:uppercase;color:#4f46e5;border-bottom:1px solid #e2e8f0;padding-bottom:6px;margin-bottom:8px">📦 Caja NVT</div>
                        <div style="line-height:1.7;font-size:11px">
                            <b>NVT:</b> <code style="background:#f1f5f9;padding:1px 4px;border-radius:3px">${nvt.nvtName}</code><br>
                            <b>Dirección:</b> ${nvt.street} ${nvt.number || ''}<br>
                            <b>Ciudad:</b> ${nvt.city || '—'}
                        </div>
                    </div>
                `, { maxWidth: 240 });

                markersGroupRef.current.addLayer(nvtMarker);
            });

            if (markersGroupRef.current.getLayers().length > 0) {
                mapInstanceRef.current.fitBounds(markersGroupRef.current.getBounds(), { padding: [40, 40] });
            }
        };

        buildMap();

        return () => {
            cancelledRef.current = true;
        };
    }, [leafletLoaded, addresses, userLocation, nvtLocations]);

    return (
        <div className="flex flex-col gap-6 h-[calc(100vh-140px)] w-full">
            {/* Header Control Bar */}
            <div className="glass-panel rounded-2xl p-5 border border-slate-100/80 shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/70 backdrop-blur-md">
                <div className="flex items-center gap-3">
                    <div className="bg-indigo-100 p-2.5 rounded-2xl text-indigo-600">
                        <MapPin size={24} />
                    </div>
                    <div>
                        <h3 className="font-extrabold text-slate-800 text-lg">
                            Mapa de Distribución
                        </h3>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">
                            Visualización en tiempo real de los estados de red
                        </p>
                    </div>
                </div>

                {/* Dropdown Project Selector */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
                    <div className="relative min-w-[240px]">
                        <select
                            value={selectedProjectId}
                            onChange={e => setSelectedProjectId(e.target.value)}
                            className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 pr-10 text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition cursor-pointer"
                        >
                            {projects.map(p => (
                                <option key={p.id} value={p.id}>
                                    {p.name}
                                </option>
                            ))}
                        </select>
                        <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                </div>
            </div>

            {/* Main Content: Map container and Stats sidebar */}
            <div className="flex-1 flex flex-col lg:flex-row gap-6 relative min-h-0">
                {/* Map Panel */}
                <div className="flex-1 bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden relative min-h-[450px] lg:min-h-0 flex flex-col">
                    {/* Loader Overlay */}
                    {(loadingData || loadingMap) && (
                        <div className="absolute inset-0 bg-white/95 backdrop-blur-sm z-[1000] flex flex-col items-center justify-center p-6 text-center">
                            <Loader2 className="animate-spin text-indigo-600 mb-4" size={48} />
                            <h4 className="font-extrabold text-slate-800 text-lg">
                                {loadingData ? 'Cargando datos...' : 'Geolocalizando direcciones…'}
                            </h4>
                            <p className="text-slate-500 text-sm mt-1 max-w-xs">
                                {loadingData
                                    ? 'Obteniendo clientes del servidor…'
                                    : 'Utilizando Google Maps API para posicionamiento exacto.'}
                            </p>
                            {!loadingData && (
                                <>
                                    <div className="w-72 bg-slate-100 h-3 rounded-full mt-5 overflow-hidden border border-slate-200">
                                        <div
                                            className="bg-indigo-600 h-full transition-all duration-300 rounded-full"
                                            style={{ width: `${progress}%` }}
                                        />
                                    </div>
                                    <span className="text-xs font-bold text-indigo-600 mt-2">{progressLabel}</span>
                                </>
                            )}
                        </div>
                    )}

                    {/* Inline Leaflet Map */}
                    <div ref={mapRef} className="w-full h-full flex-1 z-10" />
                </div>

                {/* Sidebar Stats and Legend */}
                <div className="w-full lg:w-80 bg-white rounded-3xl border border-slate-100 shadow-xl p-6 flex flex-col gap-6 shrink-0 justify-between">
                    <div>
                        <div className="flex items-center gap-1.5 font-extrabold text-xs text-slate-700 uppercase tracking-wider pb-3 border-b border-slate-100 mb-4">
                            <Info size={16} className="text-slate-500" />
                            <span>Leyenda y Métricas</span>
                        </div>

                        {/* Custom Legend with counters */}
                        <div className="space-y-4">
                            {[
                                { color: 'bg-indigo-700', label: 'Caja NVT', count: nvtLocations.length, desc: 'Ubicación física de la caja NVT', square: true },
                                { color: 'bg-slate-400', label: 'No soplado', count: stats.notBlown, desc: 'Puntos sin soplado realizado' },
                                { color: 'bg-rose-500', label: 'Soplado sin cita', count: stats.blown, desc: 'Soplado OK, sin cita agendada', pulse: true },
                                { color: 'bg-amber-400', label: 'Citada', count: stats.scheduled, desc: 'Pasa el ratón sobre los puntos amarillos' },
                                { color: 'bg-emerald-500', label: 'Terminada', count: stats.completed, desc: 'Instalaciones finalizadas' },
                            ].map(({ color, label, count, desc, pulse, square }) => (
                                <div key={label} className="bg-slate-50/50 hover:bg-slate-50 rounded-xl p-3 border border-slate-100/60 transition-all flex items-start gap-3">
                                    <span className={`w-4 h-4 mt-0.5 border-2 border-white shadow shrink-0 ${color} ${square ? 'rounded-md' : 'rounded-full'} ${pulse ? 'animate-pulse' : ''}`} />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-center gap-2">
                                            <span className="font-bold text-slate-700 text-sm">{label}</span>
                                            <span className="bg-white border border-slate-200 text-slate-700 font-extrabold text-xs px-2 py-0.5 rounded-full">
                                                {count}
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Total pill */}
                    <div className="border-t border-slate-100 pt-4 mt-auto">
                        <div className="bg-indigo-50 border border-indigo-100/40 rounded-2xl p-4 flex justify-between items-center">
                            <div>
                                <h4 className="text-xs font-bold text-indigo-700 uppercase tracking-wide">Total Clientes</h4>
                                <p className="text-[11px] text-indigo-500 mt-0.5">En el proyecto seleccionado</p>
                            </div>
                            <span className="text-2xl font-black text-indigo-700">
                                {addresses.length}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProjectMapPage;
