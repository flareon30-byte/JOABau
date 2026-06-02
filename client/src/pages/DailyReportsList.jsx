import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { Calendar, Users, Briefcase, FileText, ChevronDown, ChevronUp, MapPin, CheckCircle, Clock, Image, Map } from 'lucide-react';

const DailyReportsList = () => {
    const [reports, setReports] = useState([]);
    const [expandedReportId, setExpandedReportId] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchReports = async () => {
        try {
            const res = await api.get('/api/civil-works/daily-reports');
            setReports(res.data || []);
        } catch (error) {
            console.error('Error loading daily reports:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReports();
    }, []);

    const toggleExpandReport = (id) => {
        setExpandedReportId(expandedReportId === id ? null : id);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="bg-[#0a0f1c] rounded-[2rem] p-8 text-white shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-white/5 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl pointer-events-none"></div>
                <div className="relative z-10">
                    <h2 className="text-3xl font-black font-heading">Partes Diarios de Obra Civil</h2>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Avance Diario y Trazabilidad en Tiempo Real</p>
                </div>
            </div>

            {/* List of Reports */}
            <div className="space-y-4">
                {reports.length === 0 ? (
                    <div className="glass-panel bg-white/70 p-12 text-center rounded-3xl border border-slate-100">
                        <FileText className="mx-auto text-slate-300 w-16 h-16 mb-4" />
                        <h4 className="text-lg font-bold text-slate-800">No hay partes diarios enviados hoy</h4>
                        <p className="text-sm text-slate-500 mt-1">Los partes enviados por los operarios se mostrarán aquí al instante.</p>
                    </div>
                ) : (
                    reports.map((report) => {
                        const isExpanded = expandedReportId === report.id;
                        const reportDate = new Date(report.date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
                        
                        return (
                            <div key={report.id} className="glass-panel bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                                {/* Report Summary Header Row */}
                                <div 
                                    onClick={() => toggleExpandReport(report.id)}
                                    className="p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 cursor-pointer hover:bg-slate-50/50 transition-colors"
                                >
                                    <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                                        {/* Date badge */}
                                        <div className="flex flex-col items-center justify-center bg-orange-500/10 text-orange-600 rounded-2xl w-16 h-16 p-2 text-center font-heading border border-orange-500/10">
                                            <span className="text-[10px] font-bold uppercase">{new Date(report.date).toLocaleDateString('es-ES', { month: 'short' })}</span>
                                            <span className="text-2xl font-black leading-none">{new Date(report.date).getDate()}</span>
                                        </div>
                                        <div>
                                            <h4 className="text-lg font-black text-slate-800">{report.subcontractor.name}</h4>
                                            <p className="text-sm text-slate-500 font-semibold flex items-center gap-1.5 capitalize mt-0.5">
                                                <Calendar size={14} className="text-slate-400" />
                                                {reportDate}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Stats badges */}
                                    <div className="flex flex-wrap items-center gap-3">
                                        <span className="text-xs font-bold bg-slate-100 text-slate-600 px-3.5 py-1.5 rounded-xl border border-slate-200/50 flex items-center gap-1.5">
                                            <Users size={14} />
                                            {report.peoplePresent} operarios
                                        </span>
                                        <span className="text-xs font-bold bg-blue-50 text-blue-600 px-3.5 py-1.5 rounded-xl border border-blue-200/50 flex items-center gap-1.5">
                                            <CheckCircle size={14} />
                                            {report.workLogs ? report.workLogs.length : 0} acometidas
                                        </span>
                                        <span className="text-xs font-bold bg-purple-50 text-purple-600 px-3.5 py-1.5 rounded-xl border border-purple-200/50 flex items-center gap-1.5">
                                            <Map size={14} />
                                            {report.ductLogs ? report.ductLogs.length : 0} ductos
                                        </span>
                                        
                                        <div className="ml-2 text-slate-400">
                                            {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                        </div>
                                    </div>
                                </div>

                                {/* Expanded Report Details */}
                                {isExpanded && (
                                    <div className="border-t border-slate-100 bg-slate-50/50 p-6 space-y-6">
                                        {/* General comment */}
                                        {report.comments && (
                                            <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-inner">
                                                <h5 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Comentario del Responsable</h5>
                                                <p className="text-sm text-slate-700 italic">"{report.comments}"</p>
                                            </div>
                                        )}

                                        {/* Acometidas logs */}
                                        <div>
                                            <h5 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-3">Detalle de Acometidas Reportadas</h5>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {report.workLogs && report.workLogs.length > 0 ? (
                                                    report.workLogs.map(log => (
                                                        <div key={log.id} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex flex-col justify-between">
                                                            <div>
                                                                <div className="flex justify-between items-start mb-2">
                                                                    <h6 className="font-extrabold text-slate-800 text-sm flex items-center gap-1.5">
                                                                        <MapPin size={14} className="text-slate-400" />
                                                                        {log.address.street} {log.address.number || ''}
                                                                    </h6>
                                                                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                                                                        log.ready 
                                                                            ? 'bg-emerald-50 text-emerald-600 border-emerald-200' 
                                                                            : log.status === 'PLANIFICADO' 
                                                                                ? 'bg-amber-50 text-amber-600 border-amber-200' 
                                                                                : 'bg-slate-50 text-slate-500 border-slate-200'
                                                                    }`}>
                                                                        {log.ready ? 'HECHO (Acometida Lista)' : log.status}
                                                                    </span>
                                                                </div>
                                                                <p className="text-xs text-slate-400 font-medium">NVT: {log.address.nvt || 'Sin NVT'}</p>
                                                                {log.comments && (
                                                                    <p className="text-xs text-slate-600 mt-2 bg-slate-50 p-2.5 rounded-xl italic">"{log.comments}"</p>
                                                                )}
                                                            </div>

                                                            {/* Photos list for acometida */}
                                                            {log.photos && log.photos.length > 0 && (
                                                                <div className="grid grid-cols-4 gap-2 mt-4">
                                                                    {log.photos.map((photo, idx) => (
                                                                        <a key={idx} href={photo} target="_blank" rel="noreferrer" className="block aspect-square rounded-xl overflow-hidden border border-slate-200 bg-slate-50 relative group">
                                                                            <img src={photo} alt="Report" className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                                                                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                                                <Image size={14} className="text-white" />
                                                                            </div>
                                                                        </a>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))
                                                ) : (
                                                    <p className="text-xs text-slate-400 italic col-span-full">No se reportaron acometidas en este parte.</p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Ductos logs */}
                                        <div>
                                            <h5 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-3">Detalle de Ductos en Calle (Zanjas)</h5>
                                            <div className="space-y-4">
                                                {report.ductLogs && report.ductLogs.length > 0 ? (
                                                    report.ductLogs.map(log => {
                                                        const routeCoordinates = log.coordinates || [];
                                                        
                                                        return (
                                                            <div key={log.id} className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
                                                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-100">
                                                                    <div>
                                                                        <span className="bg-purple-100 text-purple-700 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg">
                                                                            Ducto de Calle {log.ductType || '7x22'}
                                                                        </span>
                                                                        <p className="text-xs text-slate-500 font-bold mt-1 uppercase tracking-wider">
                                                                            Calculado: <span className="text-slate-800 font-black">{log.distance || 0} metros</span>
                                                                        </p>
                                                                    </div>
                                                                    <span className={`text-xs font-bold px-3 py-1 rounded-full ${log.confirmed ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-orange-50 text-orange-700 border border-orange-200'}`}>
                                                                        {log.confirmed ? '✔ Confirmado por Responsable' : '⌛ Pendiente de Confirmación'}
                                                                    </span>
                                                                </div>

                                                                {log.comments && (
                                                                    <p className="text-sm text-slate-700 italic bg-slate-50 p-3 rounded-xl">"{log.comments}"</p>
                                                                )}

                                                                {/* Grid coordinates list */}
                                                                {routeCoordinates.length > 0 && (
                                                                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex flex-wrap gap-x-6 gap-y-2 text-xs">
                                                                        <div>
                                                                            <span className="text-slate-400 font-bold uppercase block text-[9px] tracking-widest">Inicio GPS</span>
                                                                            <span className="text-slate-700 font-semibold">{log.startLat?.toFixed(6)}, {log.startLng?.toFixed(6)}</span>
                                                                        </div>
                                                                        <div>
                                                                            <span className="text-slate-400 font-bold uppercase block text-[9px] tracking-widest">Fin GPS</span>
                                                                            <span className="text-slate-700 font-semibold">{log.endLat?.toFixed(6)}, {log.endLng?.toFixed(6)}</span>
                                                                        </div>
                                                                        <div>
                                                                            <span className="text-slate-400 font-bold uppercase block text-[9px] tracking-widest">Coordenadas Totales</span>
                                                                            <span className="text-slate-700 font-semibold">{routeCoordinates.length} puntos capturados</span>
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {/* Photo Gallery */}
                                                                {log.photos && log.photos.length > 0 && (
                                                                    <div>
                                                                        <h6 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1"><Image size={12}/> Evidencias del Trazado</h6>
                                                                        <div className="flex flex-wrap gap-2">
                                                                            {log.photos.map((photo, idx) => (
                                                                                <a key={idx} href={photo} target="_blank" rel="noreferrer" className="block w-20 h-20 rounded-xl overflow-hidden border border-slate-200 hover:scale-105 transition-transform bg-slate-50 relative group">
                                                                                    <img src={photo} alt="Duct" className="w-full h-full object-cover" />
                                                                                </a>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })
                                                ) : (
                                                    <p className="text-xs text-slate-400 italic">No se reportaron ductos de calle en este parte.</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default DailyReportsList;
