import React, { useState, useEffect } from 'react';
import { MapPin, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../api/axios';
import ProjectMapModal from '../components/ProjectMapModal';

const ProjectMapPage = () => {
    const { t } = useTranslation();
    const [projects, setProjects] = useState([]);
    const [selectedProjectId, setSelectedProjectId] = useState('');
    const [mapOpen, setMapOpen] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetch_ = async () => {
            try {
                const res = await api.get('/api/projects');
                const sorted = [...res.data].sort((a, b) => a.name.localeCompare(b.name));
                setProjects(sorted);
                if (sorted.length > 0) setSelectedProjectId(sorted[0].id);
            } catch (e) {
                console.error('Error fetching projects:', e);
            } finally {
                setLoading(false);
            }
        };
        fetch_();
    }, []);

    const selectedProject = projects.find(p => p.id === selectedProjectId);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-slate-100 p-6 flex flex-col items-center justify-center">
            {/* Card */}
            <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-lg p-8 flex flex-col items-center gap-6">

                {/* Icon & title */}
                <div className="bg-indigo-100 rounded-2xl p-4">
                    <MapPin size={36} className="text-indigo-600" />
                </div>
                <div className="text-center">
                    <h1 className="text-2xl font-extrabold text-slate-800">Mapa del Proyecto</h1>
                    <p className="text-slate-500 text-sm mt-1">
                        Selecciona un proyecto para ver la distribución de clientes en el mapa
                    </p>
                </div>

                {/* Project selector */}
                {loading ? (
                    <div className="w-full h-12 bg-slate-100 rounded-xl animate-pulse" />
                ) : (
                    <div className="w-full relative">
                        <select
                            id="map-project-select"
                            value={selectedProjectId}
                            onChange={e => setSelectedProjectId(e.target.value)}
                            className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 pr-10 text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition cursor-pointer"
                        >
                            {projects.map(p => (
                                <option key={p.id} value={p.id}>
                                    {p.name}
                                    {p._count?.addresses ? ` (${p._count.addresses} clientes)` : ''}
                                </option>
                            ))}
                        </select>
                        <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                )}

                {/* Stats pill */}
                {selectedProject && (
                    <div className="flex items-center gap-3 text-xs">
                        <span className="bg-indigo-100 text-indigo-700 font-bold px-3 py-1 rounded-full">
                            {selectedProject._count?.addresses ?? '?'} puntos de red
                        </span>
                    </div>
                )}

                {/* Open map button */}
                <button
                    id="btn-open-project-map"
                    disabled={!selectedProjectId || loading}
                    onClick={() => setMapOpen(true)}
                    className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-2xl transition-all duration-200 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:-translate-y-0.5 active:translate-y-0 text-base"
                >
                    <MapPin size={18} />
                    Ver Mapa del Proyecto
                </button>

                {/* Legend preview */}
                <div className="w-full border-t border-slate-100 pt-4 grid grid-cols-2 gap-2 text-xs">
                    {[
                        { color: 'bg-slate-400', label: 'No soplado' },
                        { color: 'bg-rose-500', label: 'Soplado sin cita' },
                        { color: 'bg-amber-400', label: 'Citada' },
                        { color: 'bg-emerald-500', label: 'Terminada' },
                    ].map(({ color, label }) => (
                        <div key={label} className="flex items-center gap-2 text-slate-600">
                            <span className={`w-3 h-3 rounded-full ${color} shrink-0 border border-white shadow-sm`} />
                            <span className="font-semibold">{label}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Map modal */}
            <ProjectMapModal
                isOpen={mapOpen}
                projectId={selectedProjectId}
                onClose={() => setMapOpen(false)}
            />
        </div>
    );
};

export default ProjectMapPage;
