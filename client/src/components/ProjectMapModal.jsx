import React, { useEffect, useState, useRef } from 'react';
import api from '../api/axios';
import { X, Loader2, Info, MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const CACHE_KEY = 'joa-map-geo-cache-v4';

const loadCache = () => {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); } catch { return {}; }
};
const saveCache = (cache) => {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch {}
};

// Attempt to geocode a full address using Photon (Komoot) – no rate limits, excellent for Germany
const geocodeFull = async (street, number, city, cache) => {
    const q = [street, number, city].filter(Boolean).join(' ').trim();
    if (!q) return null;
    if (cache[q]?.lat) return cache[q];

    try {
        const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=1`;
        const res = await fetch(url);
        if (res.ok) {
            const data = await res.json();
            if (data?.features?.length > 0) {
                const [lng, lat] = data.features[0].geometry.coordinates;
                const coords = { lat: parseFloat(lat), lng: parseFloat(lng) };
                cache[q] = coords;
                return coords;
            }
        }
    } catch {}

    // Fallback: street only
    const qs = [street, city].filter(Boolean).join(' ').trim();
    if (cache[qs]?.lat) return cache[qs];
    try {
        const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(qs)}&limit=1`;
        const res = await fetch(url);
        if (res.ok) {
            const data = await res.json();
            if (data?.features?.length > 0) {
                const [lng, lat] = data.features[0].geometry.coordinates;
                const coords = { lat: parseFloat(lat), lng: parseFloat(lng) };
                cache[qs] = coords;
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

const ProjectMapModal = ({ isOpen, projectId, onClose }) => {
    const { t } = useTranslation();
    const [leafletLoaded, setLeafletLoaded] = useState(false);
    const [addresses, setAddresses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [progress, setProgress] = useState(0);
    const [progressLabel, setProgressLabel] = useState('');
    const [project, setProject] = useState(null);

    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const markersGroupRef = useRef(null);
    const cancelledRef = useRef(false);

    // Load Leaflet dynamically
    useEffect(() => {
        if (!isOpen) return;
        cancelledRef.current = false;

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
    }, [isOpen]);

    // Fetch address data
    useEffect(() => {
        if (!isOpen || !projectId) return;
        const fetch_ = async () => {
            setLoading(true);
            setProgress(0);
            try {
                const [projRes, mapRes] = await Promise.all([
                    api.get('/api/projects'),
                    api.get(`/api/projects/${projectId}/map-data`)
                ]);
                setProject(projRes.data.find(p => p.id === projectId));
                setAddresses(mapRes.data);
            } catch (e) {
                console.error('Error fetching map data:', e);
            } finally {
                setLoading(false);
            }
        };
        fetch_();
    }, [isOpen, projectId]);

    const getStatus = (addr) => {
        const done =
            addr.appointment?.status === 'COMPLETADO' ||
            (addr.activationInfo && !addr.activationInfo.isDraft) ||
            addr.simpleInstallation !== null;
        if (done) return { color: 'green',  label: t('map.status_completed') || 'Terminada',     cls: 'bg-emerald-500' };
        if (addr.appointment?.status === 'CITADO') return { color: 'yellow', label: t('map.status_scheduled') || 'Citada', cls: 'bg-amber-400' };
        if (addr.sopladoStatus === 'OK') return { color: 'red', label: t('map.status_blown') || 'Soplado sin cita', cls: 'bg-rose-500 animate-pulse' };
        return { color: 'gray', label: t('map.status_not_blown') || 'No soplado', cls: 'bg-slate-400' };
    };

    // Build map once data + leaflet are ready
    useEffect(() => {
        if (!isOpen || !leafletLoaded || !addresses.length || !mapRef.current) return;

        const L = window.L;

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
            } else {
                mapInstanceRef.current.setView([center.lat, center.lng], 14);
                markersGroupRef.current.clearLayers();
            }

            // ---- geocode each address in batches ----
            const BATCH = 10;         // parallel requests per batch
            const DELAY = 100;        // ms between batches (Photon is generous)

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
                if (i + BATCH < addresses.length) await new Promise(r => setTimeout(r, DELAY));
            }

            if (cancelledRef.current) return;

            // ---- place markers ----
            // Group addresses that share the exact same geocoded point (Photon returned
            // the street centre because the house number wasn't in OSM).
            // Spread them in a compact 4-column grid with ~10m spacing so they stay
            // close to the real street but don't pile on top of each other.
            const JITTER_COLS  = 4;
            const JITTER_LAT   = 0.00009;  // ≈ 10 m north-south
            const JITTER_LNG   = 0.00014;  // ≈ 10 m east-west

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
                        // Grid layout: row × col, centred around the original point
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

                marker.bindPopup(`
                    <div style="font:13px sans-serif;color:#1e293b;min-width:180px">
                        <div style="font-weight:900;font-size:11px;text-transform:uppercase;color:#4338ca;border-bottom:1px solid #e2e8f0;padding-bottom:6px;margin-bottom:8px">🏠 Detalle del cliente</div>
                        <div style="line-height:1.7;font-size:11px">
                            <b>Nombre:</b> ${addr.clientName || '—'}<br>
                            <b>Dirección:</b> ${addr.street} ${addr.number || ''}<br>
                            <b>Ciudad:</b> ${addr.city || '—'}<br>
                            <b>NVT:</b> <code style="background:#f1f5f9;padding:1px 4px;border-radius:3px">${addr.nvt || '—'}</code>
                        </div>
                    </div>
                `, { maxWidth: 240 });

                markersGroupRef.current.addLayer(marker);
            });

            if (markersGroupRef.current.getLayers().length > 0) {
                mapInstanceRef.current.fitBounds(markersGroupRef.current.getBounds(), { padding: [40, 40] });
            }
        };

        buildMap();
    }, [leafletLoaded, addresses]);

    const handleClose = () => {
        cancelledRef.current = true;
        if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; }
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
                                {project ? project.name : 'Cargando…'}
                            </h3>
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">
                                {addresses.length} {t('map.total_addresses') || 'Clientes / Puntos de Red'}
                            </p>
                        </div>
                    </div>
                    <button onClick={handleClose} className="bg-slate-200 hover:bg-slate-300 text-slate-600 p-2 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 relative bg-slate-50">

                    {/* Loader overlay */}
                    {(loading || progress < 100) && (
                        <div className="absolute inset-0 bg-white/90 backdrop-blur-sm z-[1000] flex flex-col items-center justify-center p-6 text-center">
                            <Loader2 className="animate-spin text-indigo-600 mb-4" size={48} />
                            <h4 className="font-extrabold text-slate-800 text-lg">
                                {loading ? 'Cargando proyecto…' : 'Geolocalizando direcciones…'}
                            </h4>
                            <p className="text-slate-500 text-sm mt-1 max-w-xs">
                                {loading
                                    ? 'Obteniendo los datos del proyecto…'
                                    : 'Cada cliente se posicionará en su dirección exacta. Solo ocurre la primera vez.'}
                            </p>
                            {!loading && (
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

                    {/* Map */}
                    <div ref={mapRef} className="w-full h-full z-10" />

                    {/* Legend */}
                    <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-slate-100 z-[999] font-sans">
                        <div className="flex items-center gap-1.5 font-extrabold text-xs text-slate-700 uppercase tracking-wider pb-1.5 border-b border-slate-100 mb-2.5">
                            <Info size={14} className="text-slate-500" />
                            <span>Leyenda del Mapa</span>
                        </div>
                        <div className="space-y-2 text-xs">
                            {[
                                { cls: 'bg-slate-400', label: 'No soplado' },
                                { cls: 'bg-rose-500', label: 'Soplado sin cita', pulse: true },
                                { cls: 'bg-amber-400', label: 'Citada — pasa el ratón para ver la fecha', amber: true },
                                { cls: 'bg-emerald-500', label: 'Terminada' },
                            ].map(({ cls, label, pulse, amber }) => (
                                <div key={label} className="flex items-start gap-2.5">
                                    <span className={`w-3.5 h-3.5 mt-0.5 rounded-full border border-white shadow-sm shrink-0 ${cls} ${pulse ? 'animate-pulse' : ''}`} />
                                    <span className={`font-semibold ${amber ? 'text-amber-700' : 'text-slate-600'}`}>{label}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProjectMapModal;
