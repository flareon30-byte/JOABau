import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { MapPin, Calendar, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

const PlannedTasksList = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchTasks = async () => {
        try {
            setLoading(true);
            const res = await api.get('/api/planning/my-tasks');
            setTasks(res.data);
        } catch (error) {
            console.error('Error fetching tasks:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTasks();
    }, []);

    const handleMarkCompleted = async (id) => {
        try {
            await api.put(`/api/planning/${id}`, { status: 'COMPLETED' });
            fetchTasks();
            // TODO: Generate Notification for Super Admin
            await api.post('/api/notifications', {
                type: 'TASK_COMPLETED',
                message: 'Una tarea planificada ha sido marcada como completada.',
                targetRole: 'SUPER_ADMIN',
                plannedWorkId: id
            });
        } catch (error) {
            console.error('Error marking as completed:', error);
            alert('Error al completar la tarea');
        }
    };

    const handleDeleteTask = async (taskId) => {
        if (!window.confirm('¿Seguro que deseas borrar esta planificación?')) return;
        try {
            await api.delete(`/api/planning/${taskId}`);
            fetchPlannedTasks();
        } catch (error) {
            console.error('Error deleting task:', error);
            alert('Error al borrar la planificación.');
        }
    };

    const handleViewOnMap = (task) => {
        // Redirigir al mapa con las coordenadas o el ID de la tarea
        if (task.coordinates) {
            let lat, lng;
            if (Array.isArray(task.coordinates)) {
                lat = task.coordinates[0].lat;
                lng = task.coordinates[0].lng;
            } else {
                lat = task.coordinates.lat;
                lng = task.coordinates.lng;
            }
            navigate(`/dashboard/civil-works-map?lat=${lat}&lng=${lng}&zoom=18&taskId=${task.id}`);
        } else {
            navigate(`/dashboard/civil-works-map?taskId=${task.id}`);
        }
    };

    if (loading) {
        return <div className="p-8 text-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div></div>;
    }

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Mis Tareas Planificadas</h2>
                    <p className="text-slate-500 mt-1">Lista de trabajos y brechas asignadas a tus proyectos.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {tasks.length === 0 ? (
                    <div className="col-span-full p-12 text-center text-slate-500 bg-white rounded-2xl border border-slate-200 border-dashed">
                        No hay tareas planificadas para tus proyectos.
                    </div>
                ) : (
                    tasks.map(task => {
                        const isCompleted = task.status === 'COMPLETED';
                        const isBrecha = task.type === 'BRECHA';
                        
                        return (
                            <div key={task.id} className={`bg-white rounded-2xl shadow-sm border ${isBrecha && !isCompleted ? 'border-orange-300' : 'border-slate-200'} overflow-hidden flex flex-col`}>
                                <div className={`p-4 border-b ${isCompleted ? 'bg-emerald-50 border-emerald-100' : (isBrecha ? 'bg-orange-50 border-orange-100' : 'bg-slate-50 border-slate-100')}`}>
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                                                isCompleted ? 'bg-emerald-100 text-emerald-800' : 
                                                (isBrecha ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800')
                                            }`}>
                                                {isBrecha ? <AlertTriangle size={12} /> : <CheckCircle size={12} />}
                                                {task.type}
                                            </span>
                                            <h3 className="mt-2 font-bold text-slate-800">{task.project?.name || 'Proyecto Desconocido'}</h3>
                                        </div>
                                    </div>
                                </div>
                                <div className="p-4 flex-grow space-y-3">
                                    <div className="flex items-center text-sm text-slate-600">
                                        <Calendar size={16} className="mr-2 text-slate-400" />
                                        <span>Límite: {task.deadline ? new Date(task.deadline).toLocaleDateString() : 'Sin fecha'}</span>
                                    </div>
                                    {task.notes && (
                                        <div className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
                                            {task.notes}
                                        </div>
                                    )}
                                </div>
                                <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-2">
                                    <button
                                        onClick={() => handleViewOnMap(task)}
                                        className="flex-1 flex justify-center items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 py-2 rounded-lg text-sm font-medium transition-colors"
                                    >
                                        <MapPin size={16} /> Mapa
                                    </button>
                                    {!isCompleted && (
                                        <button
                                            onClick={() => handleMarkCompleted(task.id)}
                                            className="flex-1 flex justify-center items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-medium transition-colors"
                                        >
                                            <CheckCircle size={16} /> Completar
                                        </button>
                                    )}
                                    {user.role === 'SUPER_ADMIN' && (
                                        <button
                                            onClick={() => handleDeleteTask(task.id)}
                                            className="flex-1 flex justify-center items-center gap-2 bg-red-50 border border-red-200 hover:bg-red-100 text-red-600 py-2 rounded-lg text-sm font-medium transition-colors"
                                        >
                                            Borrar
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default PlannedTasksList;
