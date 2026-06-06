import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api/axios';
import { Loader2, Calendar, MapPin, AlertCircle, Plus, Filter } from 'lucide-react';

export default function PlanningTimeline() {
  const { t } = useTranslation();
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [works, setWorks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    if (selectedProject) {
      fetchWorks(selectedProject);
    }
  }, [selectedProject]);

  const fetchProjects = async () => {
    try {
      const response = await api.get('/projects');
      setProjects(response.data);
      if (response.data.length > 0) {
        setSelectedProject(response.data[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchWorks = async (projectId) => {
    try {
      setLoading(true);
      const response = await api.get(`/planning/project/${projectId}`);
      setWorks(response.data);
    } catch (err) {
      console.error(err);
      setError('Error cargando la planificación.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'COMPLETED': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'IN_PROGRESS': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'ASSIGNED': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'OVERDUE': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getTypeLabel = (type) => {
    switch (type) {
      case 'BRECHA': return 'Brecha (Problema)';
      case 'ACOMETIDA': return 'Acometida';
      case 'DUCTO': return 'Ducto de Calle';
      case 'NVT': return 'Instalación NVT';
      default: return type;
    }
  };

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Línea de Tiempo de Planificación</h1>
          <p className="text-sm text-slate-500 mt-1">Gestión de hitos y brechas de obra</p>
        </div>
        
        <div className="flex gap-4 items-center">
          <select 
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            className="border-slate-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
          >
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm">
            <Filter className="w-4 h-4" />
            Filtros
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : error ? (
        <div className="p-4 bg-red-50 text-red-600 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-sm">
                  <th className="p-4 font-semibold uppercase">Tipo de Trabajo</th>
                  <th className="p-4 font-semibold uppercase">Ubicación / Notas</th>
                  <th className="p-4 font-semibold uppercase">Subcontrata Asignada</th>
                  <th className="p-4 font-semibold uppercase">Fecha Límite</th>
                  <th className="p-4 font-semibold uppercase text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {works.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="p-8 text-center text-slate-500">
                      No hay trabajos planificados para este proyecto. Ve al Mapa de Obra para dibujar hitos.
                    </td>
                  </tr>
                ) : (
                  works.map((work) => (
                    <tr key={work.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${work.type === 'BRECHA' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
                            {work.type === 'BRECHA' ? <AlertCircle className="w-5 h-5" /> : <MapPin className="w-5 h-5" />}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800">{getTypeLabel(work.type)}</p>
                            <p className="text-xs text-slate-400">ID: {work.id.substring(0, 8)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <p className="text-sm text-slate-700 max-w-md truncate" title={work.notes}>
                          {work.notes || 'Sin descripción'}
                        </p>
                        {work.coordinates && (
                          <span className="inline-flex items-center gap-1 mt-1 text-xs text-slate-500">
                            <MapPin className="w-3 h-3" /> Coordenadas guardadas
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        {work.assignedTo ? (
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">
                              {work.assignedTo.name.charAt(0)}
                            </div>
                            <span className="text-sm font-medium text-slate-700">{work.assignedTo.name}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-slate-400 italic">No asignada</span>
                        )}
                      </td>
                      <td className="p-4">
                        {work.deadline ? (
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <Calendar className="w-4 h-4 text-slate-400" />
                            {new Date(work.deadline).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </div>
                        ) : (
                          <span className="text-sm text-slate-400 italic">Sin fecha</span>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(work.status)}`}>
                          {work.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
