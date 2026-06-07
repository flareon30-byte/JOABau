import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api/axios';
import { Loader2, Calendar, MapPin, AlertCircle, Plus, Filter, CheckCircle, Trash2, Pencil, User } from 'lucide-react';
import PlanWorkModal from '../components/PlanWorkModal';
import { useNavigate } from 'react-router-dom';

export default function PlanningTimeline() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [subcontractors, setSubcontractors] = useState([]);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [editWork, setEditWork] = useState(null);
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const handleDelete = async (id) => {
    if (!window.confirm('¿Seguro que deseas borrar esta planificación?')) return;
    try {
      await api.delete(`/api/planning/${id}`);
      fetchWorks(selectedProject);
    } catch (err) {
      console.error(err);
      alert('Error al borrar la planificación');
    }
  };

  const handleComplete = async (id) => {
    try {
      await api.put(`/api/planning/${id}`, { status: 'COMPLETED' });
      fetchWorks(selectedProject);
    } catch (err) {
      console.error(err);
      alert('Error al completar la planificación');
    }
  };

  const handleViewOnMap = (work) => {
    if (work.coordinates) {
      let lat, lng;
      if (Array.isArray(work.coordinates)) {
          lat = work.coordinates[0].lat;
          lng = work.coordinates[0].lng;
      } else {
          lat = work.coordinates.lat;
          lng = work.coordinates.lng;
      }
      navigate(`/dashboard/civil-works-map?lat=${lat}&lng=${lng}&zoom=18&taskId=${work.id}`);
    } else {
      navigate(`/dashboard/civil-works-map?taskId=${work.id}`);
    }
  };

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
      const [projRes, subRes] = await Promise.all([
          api.get('/api/projects'),
          api.get('/api/subcontractors')
      ]);
      setProjects(projRes.data);
      setSubcontractors(subRes.data);
      if (projRes.data.length > 0) {
        setSelectedProject(projRes.data[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchWorks = async (projectId) => {
    try {
      setLoading(true);
      const response = await api.get(`/api/planning/project/${projectId}`);
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
      case 'DUCTO_7x22': return 'Ducto de 7x22';
      case 'DUCTO_10x6': return 'Ducto de 10x6';
      case 'DUCTO_AMBOS': return 'Ducto de 7x22 + 10x6';
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
                  <th className="p-4 font-semibold uppercase text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {works.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="p-8 text-center text-slate-500">
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
                          <span className="inline-flex items-center gap-1 mt-1 text-xs text-slate-500 mr-3">
                            <MapPin className="w-3 h-3" /> Coordenadas guardadas
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 mt-1 text-xs text-slate-500">
                          <User className="w-3 h-3" /> Dibujado por: <span className="font-medium text-slate-700">{work.createdBy?.username || 'Desconocido'}</span>
                        </span>
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
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => handleViewOnMap(work)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Ver en Mapa"
                          >
                            <MapPin className="w-4 h-4" />
                          </button>
                          {work.status !== 'COMPLETED' && (
                            <button 
                              onClick={() => handleComplete(work.id)}
                              className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                              title="Marcar como Completado"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                          )}
                          {user.role === 'SUPER_ADMIN' && (
                            <button 
                              onClick={() => {
                                  setEditWork(work);
                                  setIsPlanModalOpen(true);
                              }}
                              className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                              title="Editar Planificación"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          )}
                          {user.role === 'SUPER_ADMIN' && (
                            <button 
                              onClick={() => handleDelete(work.id)}
                              className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Borrar Planificación"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isPlanModalOpen && (
          <PlanWorkModal 
              isOpen={isPlanModalOpen}
              onClose={() => {
                  setIsPlanModalOpen(false);
                  setEditWork(null);
              }}
              editWork={editWork}
              projects={projects}
              subcontractors={subcontractors}
              onSaved={() => {
                  setIsPlanModalOpen(false);
                  setEditWork(null);
                  fetchWorks(selectedProject);
              }}
          />
      )}
    </div>
  );
}
