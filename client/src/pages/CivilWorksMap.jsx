import React, { useState, useEffect, useRef } from 'react';
import { 
    MapPin, Loader2, HardHat, Map as MapIcon, ClipboardList, 
    Search, Check, RefreshCw, Layers, CheckCircle2, ChevronRight, X 
} from 'lucide-react';
import api from '../api/axios';

const CACHE_KEY = 'joa-map-geo-cache-v5';
const GOOGLE_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY;

const loadCache = () => {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); } catch { return {}; }
};
const saveCache = (cache) => {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch {}
};

// Google Geocoder helper
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

// Circle scatter math for overlapping pins
const scatter = (center, index) => {
    const a = 137.5 * (Math.PI / 180);
    const r = Math.sqrt(index + 1) * 0.00025;
    const t = (index + 1) * a;
    return { lat: center.lat + r * Math.sin(t), lng: center.lng + r * Math.cos(t) };
};

const CivilWorksMap = () => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const [leafletLoaded, setLeafletLoaded] = useState(false);
    const [addresses, setAddresses] = useState([]);
    const [activeWorkers, setActiveWorkers] = useState([]);
    const [ductRoutes, setDuctRoutes] = useState([]);
    const [projects, setProjects] = useState([]);
    const [subcontractors, setSubcontractors] = useState([]);
    
    // UI Filters and Tabs
    const [activeTab, setActiveTab] = useState('map'); // 'map' | 'table'
    const [loadingData, setLoadingData] = useState(true);
    const [loadingMap, setLoadingMap] = useState(false);
    const [filterProject, setFilterProject] = useState('');
    const [filterSubcontractor, setFilterSubcontractor] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    // Table view states
    const [selectedAddressIds, setSelectedAddressIds] = useState([]);
    const [bulkUpdating, setBulkUpdating] = useState(false);

    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const markersGroupRef = useRef(null);
    const workersGroupRef = useRef(null);

    // Initialize Leaflet
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
        }
    }, []);

    // Load filter options and map coordinates
    const fetchAllData = async () => {
        try {
            const [mapRes, subsRes, projectsRes] = await Promise.all([
                api.get('/api/civil-works/map'),
                api.get('/api/subcontractors').catch(() => ({ data: [] })),
                api.get('/api/projects').catch(() => ({ data: [] }))
            ]);
            
            setAddresses(mapRes.data.addresses || []);
            setActiveWorkers(mapRes.data.activeWorkers || []);
            setDuctRoutes(mapRes.data.ductRoutes || []);
            setSubcontractors(subsRes.data || []);
            setProjects(projectsRes.data || []);
        } catch (e) {
            console.error('Error loading civil works data:', e);
        } finally {
            setLoadingData(false);
        }
    };

    useEffect(() => {
        fetchAllData();
        const interval = setInterval(fetchAllData, 30000); // refresh every 30s
        return () => clearInterval(interval);
    }, []);

    // Clean status colors according to request
    // Grey: SIN_TUBO, Yellow: PLANIFICADO, Green: HECHO
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

    // Filter Logic
    const filteredAddresses = addresses.filter(addr => {
        // If worker is associated with a subcontractor, restrict to their project
        if (user.role === 'SUBCONTRACTOR' && user.subcontractorId) {
            if (addr.project?.subcontractorId !== user.subcontractorId) return false;
        }

        if (filterProject && addr.projectId !== filterProject) return false;
        if (filterStatus && (addr.civilWorkStatus || 'SIN_TUBO') !== filterStatus) return false;
        if (filterSubcontractor && addr.project?.subcontractorId !== filterSubcontractor) return false;
        
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            const streetMatch = addr.street?.toLowerCase().includes(q);
            const nvtMatch = addr.nvt?.toLowerCase().includes(q);
            const cityMatch = addr.city?.toLowerCase().includes(q);
            const numMatch = addr.number?.toLowerCase().includes(q);
            if (!streetMatch && !nvtMatch && !cityMatch && !numMatch) return false;
        }
        return true;
    });

    const filteredDuctRoutes = ductRoutes.filter(route => {
        if (user.role === 'SUBCONTRACTOR' && user.subcontractorId) {
            if (route.report?.subcontractorId !== user.subcontractorId) return false;
        }
        if (filterSubcontractor && route.report?.subcontractorId !== filterSubcontractor) return false;
        return true;
    });

    // Map Render Loop
    useEffect(() => {
        if (!leafletLoaded || !addresses.length || !mapRef.current || activeTab !== 'map') return;

        const L = window.L;
        setLoadingMap(true);

        const buildMap = async () => {
            let center = { lat: 49.8358, lng: 8.0163 }; // Fallback Germany

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
            const coordsList = new Array(filteredAddresses.length).fill(null);

            // Geocode or fetch existing coordinates
            for (let i = 0; i < filteredAddresses.length; i++) {
                const addr = filteredAddresses[i];
                if (addr.gpsLat && addr.gpsLng) {
                    coordsList[i] = { lat: addr.gpsLat, lng: addr.gpsLng };
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

            // Draw connection circles
            filteredAddresses.forEach((addr, i) => {
                let coords = coordsList[i] || scatter(center, i);
                const statusInfo = getStatusInfo(addr.civilWorkStatus);

                const icon = L.divIcon({
                    html: `<div style="width:16px;height:16px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)" class="${statusInfo.cls}"></div>`,
                    className: '', iconSize: [16, 16], iconAnchor: [8, 8]
                });

                const marker = L.marker([coords.lat, coords.lng], { icon });
                marker.bindPopup(`
                    <div style="font:13px sans-serif;color:#1e293b;min-width:200px">
                        <b style="font-size:14px;color:#f97316">Acometida</b><br>
                        <b>Dirección:</b> ${addr.street} ${addr.number || ''}<br>
                        <b>NVT:</b> ${addr.nvt || 'N/A'}<br>
                        <b>Estado:</b> <span style="font-weight:bold">${statusInfo.label}</span><br>
                        <b>Proyecto:</b> ${addr.project?.name || 'N/A'}<br>
                        ${addr.civilWorkInfo?.metersTrench ? `<b>Metros Zanja:</b> ${addr.civilWorkInfo.metersTrench}m<br>` : ''}
                        ${addr.civilWorkInfo?.surfaceType ? `<b>Superficie:</b> ${addr.civilWorkInfo.surfaceType}<br>` : ''}
                    </div>
                `);
                markersGroupRef.current.addLayer(marker);
            });

            // Draw Subcontractor Duct lines
            filteredDuctRoutes.forEach(route => {
                if (!route.coordinates || !Array.isArray(route.coordinates) || route.coordinates.length < 2) return;
                const pathCoords = route.coordinates.map(pt => [pt.lat, pt.lng]);
                
                const polyline = L.polyline(pathCoords, {
                    color: '#8b5cf6', // Premium Purple for streets ducts
                    weight: 5,
                    opacity: 0.9,
                    dashArray: '8, 10'
                });

                const subName = route.report?.subcontractor?.name || 'Subcontrata';
                const distText = route.distance ? `${route.distance}m` : 'No calculada';
                const dateText = new Date(route.createdAt).toLocaleDateString('es-ES');

                polyline.bindPopup(`
                    <div style="font:13px sans-serif;color:#1e293b;min-width:200px">
                        <b style="font-size:14px;color:#8b5cf6">Ducto de Calle (Zanja)</b><br>
                        <b>Socio:</b> ${subName}<br>
                        <b>Longitud:</b> ${distText}<br>
                        <b>Fecha Reporte:</b> ${dateText}<br>
                        ${route.comments ? `<b>Detalles:</b> <i>"${route.comments}"</i>` : ''}
                    </div>
                `);

                markersGroupRef.current.addLayer(polyline);
            });

            // Draw active worker live locations
            activeWorkers.forEach(workerLog => {
                if (!workerLog.gpsLat || !workerLog.gpsLng) return;
                
                const icon = L.divIcon({
                    html: `<div class="flex flex-col items-center select-none pointer-events-none">
                            <div class="bg-orange-600 text-white font-bold text-[9px] px-1.5 py-0.5 rounded-md shadow-md whitespace-nowrap mb-1">👷 ${workerLog.user.username}</div>
                            <div class="w-6 h-6 rounded-full bg-white border-2 border-orange-600 flex items-center justify-center text-[10px] shadow-lg">📍</div>
                           </div>`,
                    className: '', iconSize: [50, 40], iconAnchor: [25, 40]
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
    }, [leafletLoaded, activeTab, filterProject, filterSubcontractor, filterStatus, searchQuery, addresses, activeWorkers, ductRoutes]);

    // Bulk address selection
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

    // Bulk action dispatcher
    const handleBulkStatusChange = async (newStatus) => {
        if (selectedAddressIds.length === 0) return;
        if (!window.confirm(`¿Deseas cambiar el estado de las ${selectedAddressIds.length} acometidas seleccionadas a ${newStatus}?`)) return;

        setBulkUpdating(true);
        try {
            // Bulk post status updates sequentially or parallel
            await Promise.all(selectedAddressIds.map(id => 
                api.post(`/api/civil-works/${id}`, { status: newStatus })
            ));
            
            alert('Estados de las acometidas actualizados correctamente.');
            setSelectedAddressIds([]);
            fetchAllData();
        } catch (error) {
            console.error('Error bulk updating status:', error);
            alert('Ocurrió un error al actualizar los estados.');
        } finally {
            setBulkUpdating(false);
        }
    };

    return (
        <div className="flex flex-col gap-6 h-[calc(100vh-140px)] w-full">
            {/* Header bar with Tab selections */}
            <div className="glass-panel rounded-2xl p-5 border border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/70">
                <div className="flex items-center gap-3">
                    <div className="bg-orange-100 p-2.5 rounded-2xl text-orange-600">
                        <HardHat size={24} />
                    </div>
                    <div>
                        <h3 className="font-extrabold text-slate-800 text-lg">Control de Obra Civil</h3>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Acometidas, Zanjas y Trazado</p>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200/50">
                    <button
                        onClick={() => setActiveTab('map')}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                            activeTab === 'map' 
                                ? 'bg-white text-orange-600 shadow-md shadow-slate-200' 
                                : 'text-slate-500 hover:text-slate-800'
                        }`}
                    >
                        <MapIcon size={14} /> Mapa Interactivo
                    </button>
                    <button
                        onClick={() => setActiveTab('table')}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                            activeTab === 'table' 
                                ? 'bg-white text-orange-600 shadow-md shadow-slate-200' 
                                : 'text-slate-500 hover:text-slate-800'
                        }`}
                    >
                        <ClipboardList size={14} /> Control Acometidas
                    </button>
                </div>
            </div>

            {/* Filter controls panel */}
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

                <div className="flex flex-wrap gap-3 w-full lg:w-auto">
                    {/* Project filter */}
                    <select
                        value={filterProject}
                        onChange={(e) => setFilterProject(e.target.value)}
                        className="bg-white border border-slate-200 text-slate-600 text-xs font-semibold rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                    >
                        <option value="">Todos los Proyectos</option>
                        {projects.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>

                    {/* Subcontractor filter (Admins only) */}
                    {['SUPER_ADMIN', 'ADMIN'].includes(user.role) && (
                        <select
                            value={filterSubcontractor}
                            onChange={(e) => setFilterSubcontractor(e.target.value)}
                            className="bg-white border border-slate-200 text-slate-600 text-xs font-semibold rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                        >
                            <option value="">Todas las Subcontratas</option>
                            {subcontractors.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    )}

                    {/* Status filter */}
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="bg-white border border-slate-200 text-slate-600 text-xs font-semibold rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                    >
                        <option value="">Todos los Estados</option>
                        <option value="SIN_TUBO">Gris - Sin Tubo</option>
                        <option value="PLANIFICADO">Amarillo - Citado / Planificado</option>
                        <option value="HECHO">Verde - Tubo instalado (Hecho)</option>
                    </select>

                    {/* Refresh btn */}
                    <button
                        onClick={fetchAllData}
                        className="p-2.5 text-slate-500 hover:text-orange-600 hover:bg-slate-50 rounded-xl border border-slate-200 bg-white transition-colors"
                        title="Recargar datos"
                    >
                        <RefreshCw size={16} />
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden relative flex flex-col min-h-0">
                
                {/* 1. Map Tab View */}
                {activeTab === 'map' && (
                    <div className="flex-1 w-full h-full relative flex flex-col">
                        {(loadingData || loadingMap) && (
                            <div className="absolute inset-0 bg-white/95 z-[1000] flex flex-col items-center justify-center">
                                <Loader2 className="animate-spin text-orange-600 mb-4" size={48} />
                                <h4 className="font-extrabold text-slate-800">Cargando mapa interactivo...</h4>
                            </div>
                        )}
                        
                        {/* Map wrapper */}
                        <div ref={mapRef} className="flex-1 w-full bg-slate-50" />

                        {/* Legend */}
                        <div className="absolute bottom-5 left-5 z-[500] bg-white/95 backdrop-blur border border-slate-200 rounded-2xl p-4 shadow-xl space-y-2 max-w-xs text-xs">
                            <h5 className="font-black text-slate-800 uppercase tracking-widest text-[10px] mb-2 flex items-center gap-1"><Layers size={12}/> Leyenda</h5>
                            <div className="flex items-center gap-2">
                                <div className="w-3.5 h-3.5 rounded-full bg-slate-400 border border-slate-200"></div>
                                <span className="text-slate-600 font-semibold">Gris: Sin tubo en portal</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3.5 h-3.5 rounded-full bg-amber-400 border border-amber-200"></div>
                                <span className="text-slate-600 font-semibold">Amarillo: Citado o Planificado</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 border border-emerald-200"></div>
                                <span className="text-slate-600 font-semibold">Verde: Tubo metido (Listo soplado)</span>
                            </div>
                            <div className="flex items-center gap-2 border-t border-slate-100 pt-1.5 mt-1">
                                <div className="w-6 h-[2px] bg-purple-600 border-t border-dashed"></div>
                                <span className="text-slate-600 font-semibold">Ducto de Calle (Zanja)</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* 2. Table / Bulk editing Tab View */}
                {activeTab === 'table' && (
                    <div className="flex-1 flex flex-col min-h-0 bg-white">
                        {bulkUpdating && (
                            <div className="absolute inset-0 bg-white/80 z-50 flex flex-col items-center justify-center">
                                <Loader2 className="animate-spin text-orange-600 mb-4" size={40} />
                                <h4 className="font-extrabold text-slate-800">Actualizando acometidas en lote...</h4>
                            </div>
                        )}

                        {/* Bulk Actions Header Bar */}
                        {selectedAddressIds.length > 0 && (
                            <div className="bg-orange-50 border-b border-orange-100 px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-3 animate-in slide-in-from-top duration-200">
                                <span className="text-sm font-extrabold text-orange-800">
                                    {selectedAddressIds.length} acometidas seleccionadas
                                </span>
                                
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handleBulkStatusChange('SIN_TUBO')}
                                        className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold px-3.5 py-2 rounded-xl transition-all"
                                    >
                                        Marcar Sin Tubo (Gris)
                                    </button>
                                    <button
                                        onClick={() => handleBulkStatusChange('PLANIFICADO')}
                                        className="bg-white hover:bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold px-3.5 py-2 rounded-xl transition-all"
                                    >
                                        Marcar Planificado (Amarillo)
                                    </button>
                                    <button
                                        onClick={() => handleBulkStatusChange('HECHO')}
                                        className="bg-white hover:bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold px-3.5 py-2 rounded-xl transition-all"
                                    >
                                        Marcar Tubo Metido (Verde)
                                    </button>
                                    <button
                                        onClick={() => setSelectedAddressIds([])}
                                        className="text-slate-400 hover:text-slate-600 p-1.5"
                                        title="Deseleccionar todas"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Table list */}
                        <div className="flex-1 overflow-auto custom-scrollbar">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-55 border-b border-slate-100 text-slate-400 text-[10px] font-bold uppercase tracking-widest sticky top-0 bg-slate-50/90 backdrop-blur z-10">
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
                                        <th className="p-4">Subcontrata</th>
                                        <th className="p-4">Estado Obra Civil</th>
                                        <th className="p-4">Acción Rápida</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredAddresses.length === 0 ? (
                                        <tr>
                                            <td colSpan="7" className="p-12 text-center text-slate-400 text-sm">
                                                No hay direcciones que coincidan con los filtros y la búsqueda actuales.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredAddresses.map(addr => {
                                            const isSelected = selectedAddressIds.includes(addr.id);
                                            const statusInfo = getStatusInfo(addr.civilWorkStatus);
                                            
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
                                                    <td className="p-4 font-bold text-slate-700 text-sm">
                                                        {addr.street} {addr.number || ''}
                                                        <p className="text-[10px] text-slate-400 font-semibold">{addr.city}</p>
                                                    </td>
                                                    <td className="p-4 font-semibold text-slate-600 text-xs">{addr.nvt || 'N/A'}</td>
                                                    <td className="p-4 font-semibold text-slate-600 text-xs">{addr.project?.name}</td>
                                                    <td className="p-4 font-semibold text-slate-600 text-xs">
                                                        {addr.project?.subcontractor?.name || <span className="text-slate-400 italic">Sin subcontrata</span>}
                                                    </td>
                                                    <td className="p-4 text-xs font-bold">
                                                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border ${
                                                            statusInfo.color === 'green' 
                                                                ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                                                                : statusInfo.color === 'yellow' 
                                                                    ? 'bg-amber-50 text-amber-600 border-amber-100' 
                                                                    : 'bg-slate-50 text-slate-500 border-slate-100'
                                                        }`}>
                                                            <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.cls}`}></span>
                                                            {statusInfo.label}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-xs">
                                                        <div className="flex gap-1.5">
                                                            <button
                                                                onClick={async () => {
                                                                    setBulkUpdating(true);
                                                                    await api.post(`/api/civil-works/${addr.id}`, { status: 'PLANIFICADO' });
                                                                    fetchAllData();
                                                                    setBulkUpdating(false);
                                                                }}
                                                                className="text-amber-600 hover:bg-amber-50 px-2 py-1 rounded-lg border border-amber-100 transition-colors"
                                                            >
                                                                Planificar
                                                            </button>
                                                            <button
                                                                onClick={async () => {
                                                                    setBulkUpdating(true);
                                                                    await api.post(`/api/civil-works/${addr.id}`, { status: 'HECHO' });
                                                                    fetchAllData();
                                                                    setBulkUpdating(false);
                                                                }}
                                                                className="text-emerald-600 hover:bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100 transition-colors"
                                                            >
                                                                Completar
                                                            </button>
                                                        </div>
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
            </div>
        </div>
    );
};

export default CivilWorksMap;
