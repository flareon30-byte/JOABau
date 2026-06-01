import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Loader2, HardHat } from 'lucide-react';
import api from '../api/axios';

const CACHE_KEY = 'joa-map-geo-cache-v5';
const GOOGLE_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY;

const loadCache = () => {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); } catch { return {}; }
};
const saveCache = (cache) => {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch {}
};

const geocodeFull = async (street, number, city, cache) => {
    const cacheKey = [street, number, city].filter(Boolean).join(' ').trim();
    if (!cacheKey) return null;
    if (cache[cacheKey]?.lat) return cache[cacheKey];

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
    return null;
};

const scatter = (center, index) => {
    const a = 137.5 * (Math.PI / 180);
    const r = Math.sqrt(index + 1) * 0.00025;
    const t = (index + 1) * a;
    return { lat: center.lat + r * Math.sin(t), lng: center.lng + r * Math.cos(t) };
};

const CivilWorksMap = () => {
    const [leafletLoaded, setLeafletLoaded] = useState(false);
    const [addresses, setAddresses] = useState([]);
    const [activeWorkers, setActiveWorkers] = useState([]);
    const [loadingData, setLoadingData] = useState(true);
    const [loadingMap, setLoadingMap] = useState(false);
    
    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const markersGroupRef = useRef(null);
    const workersGroupRef = useRef(null);

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

    const fetchMapData = async () => {
        try {
            const res = await api.get('/api/civil-works/map');
            setAddresses(res.data.addresses || []);
            setActiveWorkers(res.data.activeWorkers || []);
        } catch (e) {
            console.error('Error fetching civil works data:', e);
        } finally {
            setLoadingData(false);
        }
    };

    useEffect(() => {
        fetchMapData();
        const interval = setInterval(fetchMapData, 30000); // refresh every 30s
        return () => clearInterval(interval);
    }, []);

    const getStatusInfo = (status) => {
        switch (status) {
            case 'CERRADO': return { color: 'green', cls: 'bg-emerald-500', label: 'Cerrado / Asfaltado' };
            case 'TUBO_METIDO': return { color: 'blue', cls: 'bg-blue-500', label: 'Tubo Metido' };
            case 'EN_PROGRESO': return { color: 'yellow', cls: 'bg-amber-400', label: 'En Progreso (Zanja)' };
            default: return { color: 'red', cls: 'bg-rose-500', label: 'Pendiente' };
        }
    };

    useEffect(() => {
        if (!leafletLoaded || !addresses.length || !mapRef.current) return;

        const L = window.L;
        setLoadingMap(true);

        const buildMap = async () => {
            let center = { lat: 49.8358, lng: 8.0163 };

            if (!mapInstanceRef.current) {
                mapInstanceRef.current = L.map(mapRef.current, { zoomControl: false }).setView([center.lat, center.lng], 16);
                L.control.zoom({ position: 'bottomright' }).addTo(mapInstanceRef.current);
                L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
                    attribution: '&copy; OpenStreetMap'
                }).addTo(mapInstanceRef.current);
                markersGroupRef.current = L.featureGroup().addTo(mapInstanceRef.current);
                workersGroupRef.current = L.layerGroup().addTo(mapInstanceRef.current);
            } else {
                markersGroupRef.current.clearLayers();
                workersGroupRef.current.clearLayers();
            }

            const cache = loadCache();
            const coordsList = new Array(addresses.length).fill(null);

            // Sequential for simplicity
            for (let i = 0; i < addresses.length; i++) {
                const addr = addresses[i];
                // Use existing GPS if available
                if (addr.simpleInstallation?.gpsLat) {
                    coordsList[i] = { lat: addr.simpleInstallation.gpsLat, lng: addr.simpleInstallation.gpsLng };
                } else {
                    coordsList[i] = await geocodeFull(addr.street, addr.number, addr.city, cache);
                }
            }
            saveCache(cache);

            const validCoords = coordsList.filter(Boolean);
            if (validCoords.length > 0) {
                const lats = validCoords.map(c => c.lat);
                const lngs = validCoords.map(c => c.lng);
                center = { lat: (Math.max(...lats) + Math.min(...lats))/2, lng: (Math.max(...lngs) + Math.min(...lngs))/2 };
            }

            addresses.forEach((addr, i) => {
                let coords = coordsList[i] || scatter(center, i);
                const statusInfo = getStatusInfo(addr.civilWorkStatus);

                const icon = L.divIcon({
                    html: `<div style="width:16px;height:16px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)" class="${statusInfo.cls}"></div>`,
                    className: '', iconSize: [16, 16], iconAnchor: [8, 8]
                });

                const marker = L.marker([coords.lat, coords.lng], { icon });
                marker.bindPopup(`
                    <div style="font:13px sans-serif;color:#1e293b;min-width:180px">
                        <b>Dirección:</b> ${addr.street} ${addr.number || ''}<br>
                        <b>Estado:</b> ${statusInfo.label}<br>
                        <b>Metros Zanja:</b> ${addr.civilWorkInfo?.metersTrench || 0}m
                    </div>
                `);
                markersGroupRef.current.addLayer(marker);
            });

            // Draw workers
            activeWorkers.forEach(workerLog => {
                const icon = L.divIcon({
                    html: `<div class="flex flex-col items-center">
                            <div class="bg-orange-600 text-white font-bold text-[10px] px-2 rounded shadow-md whitespace-nowrap mb-1">👷 ${workerLog.user.username}</div>
                            <div class="w-8 h-8 rounded-full bg-white border-2 border-orange-600 flex items-center justify-center text-orange-600 shadow-lg">📍</div>
                           </div>`,
                    className: '', iconSize: [60, 50], iconAnchor: [30, 50]
                });
                const workerMarker = L.marker([workerLog.gpsLat, workerLog.gpsLng], { icon });
                workersGroupRef.current.addLayer(workerMarker);
            });

            if (validCoords.length > 0) {
                mapInstanceRef.current.fitBounds(L.latLngBounds(validCoords), { padding: [40, 40] });
            } else {
                mapInstanceRef.current.setView([center.lat, center.lng], 16);
            }
            
            setLoadingMap(false);
        };

        buildMap();
    }, [leafletLoaded, addresses, activeWorkers]);

    return (
        <div className="flex flex-col gap-6 h-[calc(100vh-140px)] w-full">
            <div className="glass-panel rounded-2xl p-5 border border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/70">
                <div className="flex items-center gap-3">
                    <div className="bg-orange-100 p-2.5 rounded-2xl text-orange-600">
                        <HardHat size={24} />
                    </div>
                    <div>
                        <h3 className="font-extrabold text-slate-800 text-lg">Mapa de Obra Civil</h3>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Acometidas y Operarios</p>
                    </div>
                </div>
            </div>

            <div className="flex-1 bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden relative flex flex-col">
                {(loadingData || loadingMap) && (
                    <div className="absolute inset-0 bg-white/95 z-[1000] flex flex-col items-center justify-center">
                        <Loader2 className="animate-spin text-orange-600 mb-4" size={48} />
                        <h4 className="font-extrabold">Cargando mapa...</h4>
                    </div>
                )}
                <div ref={mapRef} className="flex-1 w-full bg-slate-50" />
            </div>
        </div>
    );
};

export default CivilWorksMap;
