import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
    MapPin, Loader2, HardHat, Map as MapIcon, ClipboardList, 
    Search, Check, RefreshCw, Layers, CheckCircle2, ChevronRight, X,
    Maximize2, Minimize2, Crosshair, Map
} from 'lucide-react';
import api from '../api/axios';
import PlanWorkModal from '../components/PlanWorkModal';

const CACHE_KEY = 'joa-map-geo-cache-v6';
const GOOGLE_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY;

const loadCache = () => {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); } catch { return {}; }
};
const saveCache = (cache) => {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch {}
};

const guessCountryCode = (street, city, projectName) => {
    const s = (street || '').toLowerCase();
    const c = (city || '').toLowerCase();
    const p = (projectName || '').toLowerCase();
    
    // German project name indicators
    if (p.includes('bickelheim') || p.includes('roxheim') || p.includes('bobenheim') || p.includes('germany') || p.includes('deutschland') || p.includes('fiber city')) {
        return 'DE';
    }
    // Spanish project name indicators
    if (p.includes('madrid') || p.includes('españa') || p.includes('spain') || p.includes('proyecto demo')) {
        return 'ES';
    }
    
    // Spanish street indicators
    if (s.startsWith('calle') || s.startsWith('avenida') || s.startsWith('plaza') || s.startsWith('paseo') || s.startsWith('avda') || s.startsWith('c/') || s.includes(' de ') || s.includes(' del ')) {
        return 'ES';
    }
    // Spanish city indicators
    if (c.includes('madrid') || c.includes('barcelona') || c.includes('valencia') || c.includes('sevilla') || c.includes('zaragoza') || c.includes('toledo') || c.includes('getafe') || c.includes('alcorcon') || c.includes('mostoles') || c.includes('leganes') || c.includes('fuenlabrada')) {
        return 'ES';
    }
    
    // German street indicators
    if (s.includes('str.') || s.includes('str ') || s.endsWith('str') || s.includes('straße') || s.includes('strasse') || s.includes('weg') || s.includes('gasse') || s.includes('platz') || s.includes('allee') || s.includes('pfad') || s.includes('ring') || s.includes('graben')) {
        return 'DE';
    }
    // German city indicators
    if (c.includes('berlin') || c.includes('münchen') || c.includes('munich') || c.includes('frankfurt') || c.includes('hamburg') || c.includes('mainz') || c.includes('wiesbaden') || c.includes('alzey') || c.includes('bickelheim') || c.includes('gau-bickelheim') || c.includes('bobenheim') || c.includes('roxheim') || c.includes('heim') || c.includes('burg') || c.includes('dorf') || c.includes('bach') || c.includes('berg') || c.includes('stadt') || c.includes('furt')) {
        return 'DE';
    }
    
    return null;
};

// Multi-stage geocoding — Stage 1: Google Maps (most accurate)
// Stage 2: Photon (house verification)
// Stage 3: Nominatim structured
// Stage 4: Photon street-only (fallback)
const geocodeFull = async (street, number, city, countryCode, cache, projectName) => {
    const cacheKey = [street, number, city].filter(Boolean).join(' ').trim();
    if (!cacheKey) return null;
    if (cache[cacheKey]?.lat) return cache[cacheKey];

    const guessed = guessCountryCode(street, city, projectName) || countryCode;
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
const scatter = (center, index, scale = 1.0) => {
    const a = 137.5 * (Math.PI / 180);
    const r = Math.sqrt(index + 1) * 0.00025 * scale;
    const t = (index + 1) * a;
    return { lat: center.lat + r * Math.sin(t), lng: center.lng + r * Math.cos(t) };
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

// Perpendicular offset helpers for parallel and overlapping routes
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
            lng: coords[i].lng + lngOffset,
            timestamp: coords[i].timestamp,
            photoUrl: coords[i].photoUrl
        });
    }
    return newCoords;
};

const offsetPoint = (pt, routeCoordinates, photoIdx, offsetMeters) => {
    if (!pt || typeof pt.lat !== 'number' || typeof pt.lng !== 'number' || isNaN(pt.lat) || isNaN(pt.lng)) return pt;
    if (offsetMeters === 0) return pt;
    const coords = cleanCoordinates(routeCoordinates);
    if (coords.length < 2) return pt;
    
    let nextPt = coords[photoIdx + 1] || coords[photoIdx - 1];
    if (!nextPt || typeof nextPt.lat !== 'number' || typeof nextPt.lng !== 'number' || isNaN(nextPt.lat) || isNaN(nextPt.lng)) return pt;
    
    const offsetDeg = offsetMeters * 0.000009;
    const offset = getPerpendicularOffset(pt, nextPt, offsetDeg);
    return {
        lat: pt.lat + offset.latOffset,
        lng: pt.lng + offset.lngOffset
    };
};

const areRoutesOverlapping = (r1, r2) => {
    const coords1 = cleanCoordinates(r1?.coordinates);
    const coords2 = cleanCoordinates(r2?.coordinates);
    
    if (coords1.length < 2 || coords2.length < 2) return false;
    
    const start1 = coords1[0];
    const end1 = coords1[coords1.length - 1];
    
    const start2 = coords2[0];
    const end2 = coords2[coords2.length - 1];
    
    const threshold = 0.00015; // ~15-16 meters
    
    const d1 = Math.abs(start1.lat - start2.lat) + Math.abs(start1.lng - start2.lng);
    const d2 = Math.abs(start1.lat - end2.lat) + Math.abs(start1.lng - end2.lng);
    const d3 = Math.abs(end1.lat - start2.lat) + Math.abs(end1.lng - start2.lng);
    const d4 = Math.abs(end1.lat - end2.lat) + Math.abs(end1.lng - end2.lng);
    
    return d1 < threshold || d2 < threshold || d3 < threshold || d4 < threshold;
};



const CivilWorksMap = () => {
    const [searchParams] = useSearchParams();
    const urlLat = searchParams.get('lat');
    const urlLng = searchParams.get('lng');
    const urlZoom = searchParams.get('zoom');
    const urlTaskId = searchParams.get('taskId');
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const [leafletLoaded, setLeafletLoaded] = useState(false);
    const [markerClusterLoaded, setMarkerClusterLoaded] = useState(false);
    const [geomanLoaded, setGeomanLoaded] = useState(false);
    const [addresses, setAddresses] = useState([]);
    const [activeWorkers, setActiveWorkers] = useState([]);
    const [ductRoutes, setDuctRoutes] = useState([]);
    const [plannedWorks, setPlannedWorks] = useState([]);
    const [nvtLogs, setNvtLogs] = useState([]);
    const [projects, setProjects] = useState([]);
    const [subcontractors, setSubcontractors] = useState([]);
    // UI Filters and Tabs
    const [activeTab, setActiveTab] = useState('map'); // 'map' | 'table'
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [showLegend, setShowLegend] = useState(true);
    const [loadingData, setLoadingData] = useState(true);
    const [loadingMap, setLoadingMap] = useState(false);
    const [isPlanningMode, setIsPlanningMode] = useState(false);
    const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
    const [planModalCoords, setPlanModalCoords] = useState(null);
    const [filterProject, setFilterProject] = useState('');
    const [filterSubcontractor, setFilterSubcontractor] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    // Table view states
    const [selectedAddressIds, setSelectedAddressIds] = useState([]);
    const [bulkUpdating, setBulkUpdating] = useState(false);

    const [companyCountry, setCompanyCountry] = useState('ES');
    const [progress, setProgress] = useState(0);
    const [progressLabel, setProgressLabel] = useState('');
    const [showPhotos, setShowPhotos] = useState(true);
    const [activePhotoModal, setActivePhotoModal] = useState(null);
    const cancelledRef = useRef(false);

    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const markersGroupRef = useRef(null);
    const workersGroupRef = useRef(null);
    const photoMarkersGroupRef = useRef(null);
    const lastCenteredFiltersRef = useRef({
        project: undefined,
        city: undefined,
        subcontractor: undefined,
        status: undefined,
        query: undefined,
        tab: undefined
    });

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

        const linkIdMC = 'leaflet-markercluster-css';
        if (!document.getElementById(linkIdMC)) {
            const link = document.createElement('link');
            link.id = linkIdMC;
            link.rel = 'stylesheet';
            link.href = 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css';
            document.head.appendChild(link);
        }

        
        const linkIdMCD = 'leaflet-markercluster-default-css';
        if (!document.getElementById(linkIdMCD)) {
            const link = document.createElement('link');
            link.id = linkIdMCD;
            link.rel = 'stylesheet';
            link.href = 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css';
            document.head.appendChild(link);
        }

        const linkIdGM = 'leaflet-geoman-css';
        if (!document.getElementById(linkIdGM)) {
            const link = document.createElement('link');
            link.id = linkIdGM;
            link.rel = 'stylesheet';
            link.href = 'https://unpkg.com/@geoman-io/leaflet-geoman-free@latest/dist/leaflet-geoman.css';
            document.head.appendChild(link);
        }

        const loadScript = (id, src) => {
            return new Promise((resolve) => {
                if (document.getElementById(id)) {
                    resolve();
                } else {
                    const script = document.createElement('script');
                    script.id = id;
                    script.src = src;
                    script.onload = resolve;
                    document.body.appendChild(script);
                }
            });
        };

        const initLeafletLibs = async () => {
            await loadScript('leaflet-js', 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js');
            setLeafletLoaded(true);

            // Give it a tiny tick for window.L to be ready
            await new Promise(r => setTimeout(r, 50));

            await loadScript('leaflet-markercluster-js', 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js');
            
            // Wait for L.markerClusterGroup
            await new Promise(r => {
                const check = () => {
                    if (window.L && window.L.markerClusterGroup) r();
                    else setTimeout(check, 50);
                };
                check();
            });
            setMarkerClusterLoaded(true);

            await loadScript('leaflet-geoman-js', 'https://unpkg.com/@geoman-io/leaflet-geoman-free@latest/dist/leaflet-geoman.min.js');
            // Wait for L.PM
            await new Promise(r => {
                const check = () => {
                    if (window.L && window.L.PM) r();
                    else setTimeout(check, 50);
                };
                check();
            });
            setGeomanLoaded(true);
        };

        initLeafletLibs();

        return () => {};
        }, []);

    // Fetch company settings for dynamic geolocalizer country code
    useEffect(() => {
        const fetchCompanyCountry = async () => {
            try {
                const res = await api.get('/api/company');
                if (res.data?.country) {
                    setCompanyCountry(res.data.country);
                }
            } catch (err) {
                console.error("Error loading company country:", err);
            }
        };
        fetchCompanyCountry();
    }, []);

    // Force Leaflet to recalculate map size when entering/exiting fullscreen mode
    useEffect(() => {
        if (mapInstanceRef.current) {
            const timer = setTimeout(() => {
                mapInstanceRef.current.invalidateSize();
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [isFullScreen]);

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
            setPlannedWorks(mapRes.data.plannedWorks || []);
            setNvtLogs(mapRes.data.nvtLogs || []);
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
    }, []);

    useEffect(() => {
        window.showMapPhotoModal = (url) => {
            setActivePhotoModal(url);
        };
        return () => {
            delete window.showMapPhotoModal;
        };
    }, []);


    // Clean status colors according to request
    // Grey: SIN_TUBO, Yellow: PLANIFICADO, Green: HECHO, Blue: INSTALLIERT
    const getStatusInfo = (status, orderStatus) => {
        if (status === 'HECHO' && orderStatus === 'Installiert') {
            return { color: 'blue', cls: 'bg-blue-600 border-blue-300', label: 'Activado (Installiert)' };
        }
        switch (status) {
            case 'HECHO': 
                return { color: 'green', cls: 'bg-emerald-500 border-emerald-300', label: 'Acometida Construida' };
            case 'PLANIFICADO': 
                return { color: 'yellow', cls: 'bg-amber-400 border-amber-300', label: 'Citado o Planificado' };
            default: 
                return { color: 'grey', cls: 'bg-slate-400 border-slate-300', label: 'Sin tubo / Pendiente' };
        }
    };

    // Cities list extractor
    const cities = [...new Set(addresses.map(a => a.city).filter(Boolean))].sort();

    // Filter Logic
    const filteredAddresses = addresses.filter(addr => {
        // If worker is associated with a subcontractor, restrict to their project
        if (user.role === 'SUBCONTRACTOR' && user.subcontractorId) {
            if (addr.project?.subcontractorId !== user.subcontractorId) return false;
        }

        if (filterProject && addr.projectId !== filterProject) return false;
        if (filterSubcontractor && addr.project?.subcontractorId !== filterSubcontractor) return false;
        
        if (filterStatus) {
            if (filterStatus === 'INSTALLIERT') {
                if (addr.civilWorkStatus !== 'HECHO' || addr.orderStatus !== 'Installiert') return false;
            } else if (filterStatus === 'HECHO') {
                if (addr.civilWorkStatus !== 'HECHO' || addr.orderStatus === 'Installiert') return false;
            } else {
                if ((addr.civilWorkStatus || 'SIN_TUBO') !== filterStatus) return false;
            }
        }
        
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
        if (!leafletLoaded || !markerClusterLoaded || !geomanLoaded || !addresses.length || !mapRef.current || activeTab !== 'map') return;

        const L = window.L;
        cancelledRef.current = false;
        setLoadingMap(true);
        setProgress(0);

        const buildMap = async () => {
            // ---- city center ----
            const cityName = filteredAddresses.find(a => a.city)?.city || '';
            
            // Determine project country based on filtered addresses to avoid country mismatches
            let projectCountry = companyCountry;
            const hasGermanIndicator = filteredAddresses.some(addr => {
                return guessCountryCode(addr.street, addr.city, addr.project?.name) === 'DE';
            });
            if (hasGermanIndicator) {
                projectCountry = 'DE';
            }

            const country = projectCountry === 'DE' ? 'Germany' : 'Spain';
            const region = projectCountry === 'DE' ? 'de' : 'es';
            const lang = projectCountry === 'DE' ? 'de' : 'es';

            let center = projectCountry === 'DE' ? { lat: 49.8358, lng: 8.0163 } : { lat: 40.4167, lng: -3.7037 }; // Default Madrid / Berlin
            
            if (cityName) {
                setProgressLabel(`Localizando ${cityName}…`);
                let cityResolved = false;
                if (GOOGLE_KEY) {
                    try {
                        const address = [cityName, country].filter(Boolean).join(', ');
                        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_KEY}&region=${region}&language=${lang}`;
                        const res = await fetch(url);
                        if (res.ok) {
                            const data = await res.json();
                            if (data.status === 'OK' && data.results?.length > 0) {
                                const loc = data.results[0].geometry.location;
                                center = { lat: loc.lat, lng: loc.lng };
                                cityResolved = true;
                            }
                        }
                    } catch {}
                }
                if (!cityResolved) {
                    try {
                        const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(cityName + ', ' + country)}&limit=1&lang=${lang}`;
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
            }

            if (cancelledRef.current) return;

            // If the map instance exists but container changed (e.g. switched tabs), clean it up first
            if (mapInstanceRef.current && mapInstanceRef.current.getContainer() !== mapRef.current) {
                try {
                    mapInstanceRef.current.remove();
                } catch (e) {
                    console.error("Error removing old Leaflet map container:", e);
                }
                mapInstanceRef.current = null;
            }

            // Bulletproof: Clear any internal leaflet id set on the new container DOM element
            if (mapRef.current && mapRef.current._leaflet_id) {
                mapRef.current._leaflet_id = null;
            }

            const isNewMap = !mapInstanceRef.current;
            const filtersChanged = 
                lastCenteredFiltersRef.current.project !== filterProject ||
                lastCenteredFiltersRef.current.subcontractor !== filterSubcontractor ||
                lastCenteredFiltersRef.current.status !== filterStatus ||
                lastCenteredFiltersRef.current.query !== searchQuery ||
                lastCenteredFiltersRef.current.tab !== activeTab;

            if (isNewMap) {
                mapInstanceRef.current = L.map(mapRef.current, { zoomControl: false }).setView([center.lat, center.lng], urlZoom ? parseInt(urlZoom) : 14);
                L.control.zoom({ position: 'bottomright' }).addTo(mapInstanceRef.current);
                L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
                    attribution: '&copy; OpenStreetMap'
                }).addTo(mapInstanceRef.current);
                
                const user = JSON.parse(localStorage.getItem('user') || '{}');
                const canPlan = ['SUPER_ADMIN', 'ADMIN', 'PROJECT_MANAGER'].includes(user.role);
                
                if (mapInstanceRef.current.pm && canPlan) {
                    mapInstanceRef.current.pm.addControls({
                        position: 'topleft',
                        drawCircle: false,
                        drawCircleMarker: false,
                        drawText: false,
                        editControls: false,
                        cutPolygon: false,
                        removalMode: false,
                    });
                    
                    mapInstanceRef.current.on('pm:create', (e) => {
                        const layer = e.layer;
                        const type = e.shape; // Polygon, Line, Marker
                        let coordinates = null;
                        
                        if (type === 'Marker') {
                            const latlng = layer.getLatLng();
                            coordinates = { lat: latlng.lat, lng: latlng.lng };
                        } else if (type === 'Polygon') {
                            const latlngs = layer.getLatLngs()[0];
                            coordinates = latlngs.map(ll => ({ lat: ll.lat, lng: ll.lng }));
                        } else if (type === 'Line') {
                            const latlngs = layer.getLatLngs();
                            coordinates = latlngs.map(ll => ({ lat: ll.lat, lng: ll.lng }));
                        }
                        
                        if (coordinates) {
                            setPlanModalCoords(coordinates);
                            setIsPlanModalOpen(true);
                            mapInstanceRef.current.removeLayer(layer); // Remove temporary drawn shape
                        }
                    });
                }

                markersGroupRef.current = L.featureGroup().addTo(mapInstanceRef.current);
                workersGroupRef.current = L.layerGroup().addTo(mapInstanceRef.current);
                
                if (!photoMarkersGroupRef.current) {
                photoMarkersGroupRef.current = L.markerClusterGroup({
                    maxClusterRadius: 40,
                    spiderfyOnMaxZoom: true,
                    showCoverageOnHover: false,
                    zoomToBoundsOnClick: true,
                    iconCreateFunction: function(cluster) {
                        return L.divIcon({ 
                            html: `<div style="background-color:rgba(15,23,42,0.8);color:white;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:bold;border:2px solid white;box-shadow:0 0 10px rgba(0,0,0,0.5);">${cluster.getChildCount()}</div>`,
                            className: 'custom-cluster-icon', 
                            iconSize: [30, 30] 
                        });
                    }
                });
                photoMarkersGroupRef.current.on('clustermouseover', function(a) {
                    a.layer.spiderfy();
                });
                mapInstanceRef.current.addLayer(photoMarkersGroupRef.current);
            }
            } else {
                markersGroupRef.current.clearLayers();
                workersGroupRef.current.clearLayers();
                photoMarkersGroupRef.current.clearLayers();
            }
            mapInstanceRef.current.invalidateSize();

            // Setup map click listener for planning mode
            mapInstanceRef.current.off('click');
            if (isPlanningMode && ['SUPER_ADMIN', 'ADMIN', 'PROJECT_MANAGER'].includes(user.role)) {
                mapInstanceRef.current.getContainer().style.cursor = 'crosshair';
                mapInstanceRef.current.on('click', (e) => {
                    setPlanModalCoords({ lat: e.latlng.lat, lng: e.latlng.lng });
                    setIsPlanModalOpen(true);
                });
            } else {
                mapInstanceRef.current.getContainer().style.cursor = '';
            }

            const BATCH = 10;
            const DELAY = 80;
            const cache = loadCache();
            const coordsList = new Array(filteredAddresses.length).fill(null);

            // Geocode or fetch existing coordinates in parallel-safe batches
            for (let i = 0; i < filteredAddresses.length; i += BATCH) {
                if (cancelledRef.current) return;
                const batch = filteredAddresses.slice(i, i + BATCH);
                const results = await Promise.all(
                    batch.map(async (addr) => {
                        if (addr.gpsLat && addr.gpsLng) {
                            return { lat: addr.gpsLat, lng: addr.gpsLng };
                        }
                        const coords = await geocodeFull(addr.street, addr.number, addr.city, companyCountry, cache, addr.project?.name);
                        if (coords && coords.lat && coords.lng) {
                            api.put(`/api/civil-works/address/${addr.id}/gps`, {
                                gpsLat: coords.lat,
                                gpsLng: coords.lng
                            }).catch(err => console.error("Error saving geocoded GPS to backend:", err));
                            addr.gpsLat = coords.lat;
                            addr.gpsLng = coords.lng;
                        }
                        return coords;
                    })
                );
                results.forEach((c, j) => { coordsList[i + j] = c; });
                saveCache(cache);

                const done = Math.min(i + BATCH, filteredAddresses.length);
                setProgress(Math.round((done / filteredAddresses.length) * 100));
                setProgressLabel(`Geolocalizando ${done}/${filteredAddresses.length} clientes…`);

                if (i + BATCH < filteredAddresses.length) {
                    await new Promise(r => setTimeout(r, DELAY));
                }
            }

            if (cancelledRef.current) return;
            setLoadingMap(false);

            const validCoords = coordsList.filter(Boolean);
            if (validCoords.length > 0) {
                const lats = validCoords.map(c => c.lat);
                const lngs = validCoords.map(c => c.lng);
                center = { lat: (Math.max(...lats) + Math.min(...lats))/2, lng: (Math.max(...lngs) + Math.min(...lngs))/2 };
            }

            // Draw connection circles
            filteredAddresses.forEach((addr, i) => {
                if (cancelledRef.current) return;
                let coords = coordsList[i] || scatter(center, i);
                const statusInfo = getStatusInfo(addr.civilWorkStatus, addr.orderStatus);

                let icon;
                if (statusInfo.color === 'blue') {
                    icon = L.divIcon({
                        html: `<div class="relative flex items-center justify-center w-5 h-5">
                                 <div class="absolute inset-0 rounded-full border-[3px] border-blue-600 bg-white/30 shadow-md"></div>
                                 <div class="w-2.5 h-2.5 rounded-full bg-emerald-500 border border-white z-10"></div>
                               </div>`,
                        className: '', iconSize: [20, 20], iconAnchor: [10, 10]
                    });
                } else {
                    icon = L.divIcon({
                        html: `<div style="width:16px;height:16px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)" class="${statusInfo.cls}"></div>`,
                        className: '', iconSize: [16, 16], iconAnchor: [8, 8]
                    });
                }

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
            const processedRoutes = [];
            const routeOffsets = {};
            const getRouteOffset = (route) => {
                const coords = cleanCoordinates(route?.coordinates);
                if (coords.length < 2) return 0;
                
                let currentOffset = 0;
                processedRoutes.forEach(prevRoute => {
                    if (areRoutesOverlapping(route, prevRoute)) {
                        let spacing = 4.0;
                        if (prevRoute.ductType === 'ambos' && route.ductType === 'ambos') {
                            spacing = 7.0;
                        } else if (prevRoute.ductType === 'ambos' || route.ductType === 'ambos') {
                            spacing = 5.5;
                        }
                        currentOffset += spacing;
                    }
                });
                
                processedRoutes.push(route);
                return currentOffset;
            };

            filteredDuctRoutes.forEach(route => {
                if (cancelledRef.current) return;
                const coords = cleanCoordinates(route?.coordinates);
                if (coords.length < 2) return;
                
                const routeOffset = getRouteOffset(route);
                routeOffsets[route.id] = routeOffset;
                
                const subName = route.report?.subcontractor?.name || 'Subcontrata';
                const distText = route.distance ? `${route.distance}m` : 'No calculada';
                const dateText = new Date(route.createdAt).toLocaleDateString('es-ES');

                if (route.ductType === 'ambos') {
                    // Draw 7x22 (orange) shifted slightly left (-2.5 meters relative to routeOffset)
                    const coordsOrange = offsetPolyline(route.coordinates, routeOffset - 2.5);
                    const pathCoordsOrange = coordsOrange.map(pt => [pt.lat, pt.lng]);
                    const polylineOrange = L.polyline(pathCoordsOrange, {
                        color: '#f97316',
                        weight: 5,
                        opacity: 0.9,
                        dashArray: '8, 10'
                    });
                    
                    // Draw 10x6 (pink) shifted slightly right (+2.5 meters relative to routeOffset)
                    const coordsPink = offsetPolyline(route.coordinates, routeOffset + 2.5);
                    const pathCoordsPink = coordsPink.map(pt => [pt.lat, pt.lng]);
                    const polylinePink = L.polyline(pathCoordsPink, {
                        color: '#ec4899',
                        weight: 5,
                        opacity: 0.9,
                        dashArray: '8, 10'
                    });
                    
                    const popupContent = `
                        <div style="font:13px sans-serif;color:#1e293b;min-width:200px">
                            <b style="font-size:14px;color:#f97316">Conductos en Paralelo (7x22 y 10x6)</b><br>
                            <b>Socio:</b> ${subName}<br>
                            <b>Longitud:</b> ${distText}<br>
                            <b>Fecha Reporte:</b> ${dateText}<br>
                            ${route.comments ? `<b>Detalles:</b> <i>"${route.comments}"</i>` : ''}
                        </div>
                    `;
                    polylineOrange.bindPopup(popupContent);
                    polylinePink.bindPopup(popupContent);
                    
                    markersGroupRef.current.addLayer(polylineOrange);
                    markersGroupRef.current.addLayer(polylinePink);
                } else {
                    const coords = offsetPolyline(route.coordinates, routeOffset);
                    const pathCoords = coords.map(pt => [pt.lat, pt.lng]);
                    
                    const ductColor = route.ductType === '10x6' ? '#ec4899' : '#f97316';
                    const polyline = L.polyline(pathCoords, {
                        color: ductColor,
                        weight: 5,
                        opacity: 0.9,
                        dashArray: '8, 10'
                    });

                    polyline.bindPopup(`
                        <div style="font:13px sans-serif;color:#1e293b;min-width:200px">
                            <b style="font-size:14px;color:${ductColor}">Conducto (${route.ductType || '7x22'})</b><br>
                            <b>Socio:</b> ${subName}<br>
                            <b>Longitud:</b> ${distText}<br>
                            <b>Fecha Reporte:</b> ${dateText}<br>
                            ${route.comments ? `<b>Detalles:</b> <i>"${route.comments}"</i>` : ''}
                        </div>
                    `);

                    markersGroupRef.current.addLayer(polyline);
                }
            });

            // Draw Photo Markers (Visual Record of Civil Works)
            const photoArray = [];

            // Helper to collect photos from duct routes
            filteredDuctRoutes.forEach(route => {
                const routeCoordinates = cleanCoordinates(route.coordinates);
                const hasPhotos = routeCoordinates.some(pt => pt && pt.photoUrl);
                if (!hasPhotos) return;

                routeCoordinates.forEach((pt) => {
                    if (pt && pt.photoUrl && pt.lat && pt.lng) {
                        photoArray.push({
                            lat: pt.lat,
                            lng: pt.lng,
                            photoUrl: pt.photoUrl,
                            timestamp: pt.timestamp,
                            type: 'Zanja / Ducto',
                            label: 'Foto de zanja',
                            status: route.report?.reviewStatus === 'REVISADO' ? '✅' : '⏳'
                        });
                    }
                });
            });

            // Helper to collect photos from nvt logs
            nvtLogs.forEach(log => {
                if (log.photoUrl && log.gpsLat && log.gpsLng) {
                    photoArray.push({
                        lat: log.gpsLat,
                        lng: log.gpsLng,
                        photoUrl: log.photoUrl,
                        type: 'NVT',
                        label: 'Nudo de Red (NVT)',
                        status: log.status
                    });
                }
            });

            if (showPhotos && photoArray.length > 0) {
                photoArray.forEach(pt => {
                    const html = `
                        <div class="photo-marker" style="
                            width:44px;height:44px;
                            border-radius:8px;
                            overflow:hidden;
                            border:3px solid white;
                            box-shadow:0 4px 12px rgba(0,0,0,0.4);
                            cursor:pointer;
                            transition:transform 0.2s;
                            background-color:black;
                        " onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'">
                            <img src="${pt.photoUrl}" style="width:100%;height:100%;object-fit:cover;" onerror="this.src='https://placehold.co/100x100?text=Foto'"/>
                        </div>
                    `;
                    const icon = L.divIcon({ html, className: '', iconSize: [44, 44], iconAnchor: [22, 22] });
                    const photoMarker = L.marker([pt.lat, pt.lng], { icon });
                    photoMarker.on('click', () => {
                        if (window.showMapPhotoModal) {
                            window.showMapPhotoModal(pt.photoUrl);
                        }
                    });
                    
                    const timeStr = pt.timestamp ? new Date(pt.timestamp).toLocaleTimeString() : '';
                    photoMarker.bindTooltip(`${pt.type} ${pt.status} ${timeStr}`, { direction: 'top', offset: [0, -20] });
                    
                    photoMarkersGroupRef.current.addLayer(photoMarker);
                });
            }

            // Draw active worker live locations
            activeWorkers.forEach(workerLog => {
                if (cancelledRef.current) return;
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

            
            // Add Planned Works markers
            plannedWorks.forEach(work => {
                if (!work.coordinates) return;
                
                const isResolved = work.status === 'COMPLETED';
                const isBrecha = work.type === 'BRECHA';
                let color = isResolved ? '#10b981' : (isBrecha ? '#ef4444' : '#3b82f6');
                
                const popupHtml = `
                    <div style="font-family:sans-serif; padding:4px; min-width: 200px;">
                        <h4 style="margin:0 0 8px 0;font-size:14px;color:#1e293b;border-bottom:1px solid #e2e8f0;padding-bottom:4px;">
                            ${work.type} ${isResolved ? '(Resuelto)' : ''}
                        </h4>
                        <div style="font-size:12px;color:#475569;margin-bottom:8px;">
                            <strong>Proyecto:</strong> ${projects.find(p=>p.id===work.projectId)?.name || 'N/A'}<br/>
                            <strong>Límite:</strong> ${work.deadline ? new Date(work.deadline).toLocaleDateString() : 'Sin fecha'}<br/>
                            <strong>Estado:</strong> ${work.status}
                        </div>
                        ${work.notes ? `<p style="margin:0;font-size:12px;background:#f8fafc;padding:6px;border-radius:4px;color:#334155;">${work.notes}</p>` : ''}
                    </div>
                `;

                if (Array.isArray(work.coordinates)) {
                    const pts = work.coordinates;
                    if (pts.length > 2 && pts[0].lat === pts[pts.length-1].lat && pts[0].lng === pts[pts.length-1].lng) {
                        const polygon = L.polygon(pts, {
                            color: color, fillColor: color, fillOpacity: 0.3, weight: 2, dashArray: isResolved ? null : '5, 5'
                        });
                        polygon.bindPopup(popupHtml);
                        markersGroupRef.current.addLayer(polygon);
                        validCoords.push([pts[0].lat, pts[0].lng]);
                    } else {
                        const polyline = L.polyline(pts, {
                            color: color, weight: 4, dashArray: isResolved ? null : '10, 10'
                        });
                        polyline.bindPopup(popupHtml);
                        markersGroupRef.current.addLayer(polyline);
                        validCoords.push([pts[0].lat, pts[0].lng]);
                    }
                } else if (work.coordinates.lat && work.coordinates.lng) {
                    const html = `<div style="
                        background-color: ${color}; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-weight: bold; box-shadow: 0 0 10px ${color}80; border: 2px solid white; animation: ${!isResolved && isBrecha ? 'pulse 2s infinite' : 'none'};
                    ">P</div>`;
                    const icon = L.divIcon({ html, className: '', iconSize: [24, 24], iconAnchor: [12, 12] });
                    const marker = L.marker([work.coordinates.lat, work.coordinates.lng], { icon });
                    marker.bindPopup(popupHtml);
                    markersGroupRef.current.addLayer(marker);
                    validCoords.push([work.coordinates.lat, work.coordinates.lng]);
                }
            });
            // Add NVT Logs
            nvtLogs.forEach(log => {
                if (log.gpsLat && log.gpsLng) {
                    const html = `<div style="
                        background-color: #8b5cf6;
                        color: white;
                        border-radius: 8px;
                        width: 24px;
                        height: 24px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-weight: bold;
                        box-shadow: 0 0 10px rgba(139, 92, 246, 0.6);
                        border: 2px solid white;
                    ">N</div>`;
                    const icon = L.divIcon({ html, className: '', iconSize: [24, 24], iconAnchor: [12, 12] });
                    const marker = L.marker([log.gpsLat, log.gpsLng], { icon });
                    marker.bindPopup(`
                        <div style="font-family:sans-serif; padding:4px;">
                            <h4 style="margin:0 0 4px 0;font-weight:bold;color:#1e293b;">Nudo de Red (NVT)</h4>
                            <p style="margin:0;font-size:12px;">Estado: ${log.status}</p>
                            ${log.subcontractorNotes ? `<p style="margin:4px 0 0 0;font-size:12px;">Notas: ${log.subcontractorNotes}</p>` : ''}
                            ${log.photoUrl ? `<img src="${log.photoUrl}" style="width:100px;border-radius:4px;margin-top:4px;" />` : ''}
                        </div>
                    `);
                    markersGroupRef.current.addLayer(marker);
                    validCoords.push([log.gpsLat, log.gpsLng]);
                }
            });

            if (isNewMap || filtersChanged) {
                if (validCoords.length > 0) {
                    mapInstanceRef.current.fitBounds(L.latLngBounds(validCoords), { padding: [40, 40] });
                } else {
                    mapInstanceRef.current.setView([center.lat, center.lng], 14);
                }
                // Save current snapshot
                lastCenteredFiltersRef.current = {
                    project: filterProject,
                    subcontractor: filterSubcontractor,
                    status: filterStatus,
                    query: searchQuery,
                    tab: activeTab
                };
            }
        };

        buildMap();

        return () => {
            cancelledRef.current = true;
        };
    }, [leafletLoaded, markerClusterLoaded, geomanLoaded, activeTab, filterProject, filterSubcontractor, filterStatus, searchQuery, addresses, activeWorkers, ductRoutes, plannedWorks, isPlanningMode, companyCountry, showPhotos, isFullScreen]);

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
            // Llamar al endpoint de actualización masiva optimizado
            await api.post('/api/civil-works/bulk-status', {
                addressIds: selectedAddressIds,
                status: newStatus
            });
            
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
                        <option value="HECHO">Verde - Acometida Construida</option>
                        <option value="INSTALLIERT">Azul - Activado (Installiert)</option>
                    </select>

                    {/* Toggle show photos */}
                    <label className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 text-xs font-semibold rounded-xl px-3.5 py-2.5 cursor-pointer hover:bg-slate-50 select-none">
                        <input
                            type="checkbox"
                            checked={showPhotos}
                            onChange={(e) => setShowPhotos(e.target.checked)}
                            className="w-4 h-4 rounded cursor-pointer accent-orange-600"
                        />
                        <span>Ver Fotos (Registro Visual)</span>
                    </label>

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
                    <div className={isFullScreen ? "fixed inset-0 z-[9999] w-screen h-screen bg-white flex flex-col" : "flex-1 w-full h-full relative flex flex-col"}>
                        {(loadingData || loadingMap) && (
                            <div className="absolute inset-0 bg-white/95 backdrop-blur-sm z-[1000] flex flex-col items-center justify-center p-6 text-center">
                                <Loader2 className="animate-spin text-orange-600 mb-4" size={48} />
                                <h4 className="font-extrabold text-slate-800 text-lg">
                                    {loadingData ? 'Cargando datos...' : 'Geolocalizando direcciones…'}
                                </h4>
                                <p className="text-slate-500 text-sm mt-1 max-w-xs">
                                    {loadingData
                                        ? 'Obteniendo clientes del servidor…'
                                        : 'Utilizando APIs cartográficas para posicionamiento exacto.'}
                                </p>
                                {!loadingData && (
                                    <>
                                        <div className="w-72 bg-slate-100 h-3 rounded-full mt-5 overflow-hidden border border-slate-200">
                                            <div
                                                className="bg-orange-500 h-full transition-all duration-300 rounded-full"
                                                style={{ width: `${progress}%` }}
                                            />
                                        </div>
                                        <span className="text-xs font-bold text-orange-600 mt-2">{progressLabel}</span>
                                    </>
                                )}
                            </div>
                        )}
                        
                        {/* Full Screen Toggle Button */}
                        <button
                            onClick={() => setIsFullScreen(!isFullScreen)}
                            className="absolute top-4 right-4 z-[10000] bg-white/95 backdrop-blur border border-slate-200 text-slate-700 hover:text-orange-600 p-3 rounded-2xl shadow-xl hover:scale-105 transition-all flex items-center gap-2 text-xs font-bold"
                            title={isFullScreen ? "Salir de pantalla completa" : "Pantalla completa"}
                        >
                            {isFullScreen ? (
                                <>
                                    <Minimize2 size={16} />
                                    <span>Salir</span>
                                </>
                            ) : (
                                <>
                                    <Maximize2 size={16} />
                                    <span>Pantalla Completa</span>
                                </>
                            )}
                        </button>
                        
                        {/* Map wrapper */}
                        <div key={isFullScreen ? 'fs-map' : 'normal-map'} ref={mapRef} className={isFullScreen ? "w-full h-full flex-1 z-10" : "w-full h-[55vh] sm:h-full flex-1 z-10 min-h-[420px]"} />

                        {/* Legend */}
                        {!showLegend ? (
                            <button
                                onClick={() => setShowLegend(true)}
                                className={`z-[500] bg-white/95 backdrop-blur border border-slate-200 text-slate-700 hover:text-orange-600 p-2.5 rounded-xl shadow-xl flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest ${
                                    isFullScreen 
                                        ? 'absolute bottom-5 left-5' 
                                        : 'sm:absolute sm:bottom-5 sm:left-5 max-sm:my-2 max-sm:mx-auto relative'
                                }`}
                                title="Mostrar leyenda"
                            >
                                <Layers size={12} /> Mostrar Leyenda
                            </button>
                        ) : (
                            <div className={`z-[500] bg-white/95 backdrop-blur border border-slate-200 p-4 shadow-xl text-xs ${
                                isFullScreen 
                                    ? 'absolute bottom-5 left-5 max-w-xs rounded-2xl space-y-2' 
                                    : 'sm:absolute sm:bottom-5 sm:left-5 sm:max-w-xs sm:rounded-2xl space-y-2 max-sm:border-t max-sm:border-x-0 max-sm:border-b-0 max-sm:shadow-none max-sm:p-3 max-sm:space-y-0 max-sm:flex max-sm:flex-wrap max-sm:gap-x-4 max-sm:gap-y-2 max-sm:justify-center max-sm:w-full relative sm:absolute'
                            }`}>
                                <div className="flex justify-between items-center mb-2 max-sm:w-full max-sm:justify-between max-sm:mb-1">
                                    <h5 className="font-black text-slate-800 uppercase tracking-widest text-[10px] flex items-center gap-1"><Layers size={12}/> Leyenda</h5>
                                    <button 
                                        onClick={() => setShowLegend(false)} 
                                        className="text-slate-400 hover:text-slate-600 transition-colors p-0.5 rounded-lg hover:bg-slate-100/50"
                                        title="Ocultar leyenda"
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                                <div className="flex items-center gap-2 max-sm:inline-flex">
                                    <div className="w-3.5 h-3.5 rounded-full bg-slate-400 border border-slate-200"></div>
                                    <span className="text-slate-600 font-semibold">Gris: Sin tubo en portal</span>
                                </div>
                                <div className="flex items-center gap-2 max-sm:inline-flex">
                                    <div className="w-3.5 h-3.5 rounded-full bg-amber-400 border border-amber-200"></div>
                                    <span className="text-slate-600 font-semibold">Amarillo: Citado o Planificado</span>
                                </div>
                                <div className="flex items-center gap-2 max-sm:inline-flex">
                                    <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 border border-emerald-200"></div>
                                    <span className="text-slate-600 font-semibold">Verde: Acometida Construida</span>
                                </div>
                                <div className="flex items-center gap-2 max-sm:inline-flex">
                                    <div className="relative flex items-center justify-center w-3.5 h-3.5">
                                        <div className="absolute inset-0 rounded-full border-[2.5px] border-blue-600 bg-white/30"></div>
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 border border-white z-10"></div>
                                    </div>
                                    <span className="text-slate-600 font-semibold">Doble anillo (Azul/Verde): Activado (Installiert)</span>
                                </div>
                                <div className="flex items-center gap-2 border-t border-slate-100 pt-1.5 mt-1 max-sm:border-t-0 max-sm:pt-0 max-sm:mt-0 max-sm:inline-flex">
                                    <div className="w-6 h-[2px] bg-[#f97316] border-t border-dashed"></div>
                                    <span className="text-slate-600 font-semibold">Conducto 7x22</span>
                                </div>
                                <div className="flex items-center gap-2 max-sm:inline-flex">
                                    <div className="w-6 h-[2px] bg-[#ec4899] border-t border-dashed"></div>
                                    <span className="text-slate-600 font-semibold">Conducto 10x6</span>
                                </div>
                            </div>
                        )}
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
                                        Marcar Acometida Construida (Verde)
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
            
            {isPlanModalOpen && planModalCoords && (
                <PlanWorkModal 
                    isOpen={isPlanModalOpen}
                    onClose={() => setIsPlanModalOpen(false)}
                    lat={planModalCoords.lat}
                    lng={planModalCoords.lng}
                    projects={projects}
                    onSaved={fetchAllData}
                />
            )}
        </div>
    );
};

export default CivilWorksMap;
