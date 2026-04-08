import React, { useState, useEffect } from 'react';
import { Truck, Plus, Trash2, Edit3, AlertCircle, Fuel, Gauge, TrendingUp, Search, X } from 'lucide-react';
import api from '../api/axios';

const VehicleManagement = () => {
    const [vehicles, setVehicles] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentVehicle, setCurrentVehicle] = useState(null);
    const [formData, setFormData] = useState({
        make: '',
        model: '',
        plate: '',
        initialKms: 0,
        annualKmLimit: 10000
    });
    const [searchTerm, setSearchTerm] = useState('');
    const [isLogsModalOpen, setIsLogsModalOpen] = useState(false);
    const [selectedVehicleStats, setSelectedVehicleStats] = useState(null);
    const [loadingStats, setLoadingStats] = useState(false);

    // Image Viewer Modal
    const [viewerImage, setViewerImage] = useState(null);

    const fetchVehicles = async () => {
        try {
            const { data } = await api.get('/api/vehicles');
            setVehicles(data);
        } catch (error) {
            console.error('Error fetching vehicles', error);
        }
    };

    const fetchVehicleHistory = async (id) => {
        setLoadingStats(true);
        setIsLogsModalOpen(true);
        try {
            const { data } = await api.get(`/api/vehicles/${id}/stats`);
            setSelectedVehicleStats(data);
        } catch (error) {
            console.error('Error fetching vehicle stats', error);
            alert('Error cargando historial');
        } finally {
            setLoadingStats(false);
        }
    };

    const handleDeleteLog = async (logId, vehicleId) => {
        if (!window.confirm('¿Eliminar este registro de bitácora? Esto recalculará el kilometraje actual del coche.')) return;
        try {
            await api.delete(`/api/vehicles/log/${logId}`);
            // Refresh both lists
            fetchVehicles();
            fetchVehicleHistory(vehicleId);
        } catch (error) {
            console.error('Error deleting log', error);
            alert('Error al eliminar registro');
        }
    };

    useEffect(() => {
        fetchVehicles();
    }, []);

    const handleOpenModal = (vehicle = null) => {
        if (vehicle) {
            setCurrentVehicle(vehicle);
            setFormData({
                make: vehicle.make,
                model: vehicle.model,
                plate: vehicle.plate,
                initialKms: vehicle.initialKms,
                annualKmLimit: vehicle.annualKmLimit
            });
        } else {
            setCurrentVehicle(null);
            setFormData({ make: '', model: '', plate: '', initialKms: 0, annualKmLimit: 10000 });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (currentVehicle) {
                await api.put(`/api/vehicles/${currentVehicle.id}`, formData);
            } else {
                await api.post('/api/vehicles', formData);
            }
            fetchVehicles();
            setIsModalOpen(false);
        } catch (error) {
            alert('Error guardando vehículo');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('¿Eliminar este vehículo?')) return;
        try {
            await api.delete(`/api/vehicles/${id}`);
            fetchVehicles();
        } catch (error) {
            alert('Error eliminando');
        }
    };

    const getProgressColor = (percent) => {
        if (percent > 90) return 'bg-red-500';
        if (percent > 75) return 'bg-orange-500';
        return 'bg-green-500';
    };

    const money = (val) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(val || 0);

    const filteredVehicles = vehicles.filter(v => 
        v.plate.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.make.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.model.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Truck className="text-blue-600" /> Control de Flota (Admin)
                    </h1>
                    <p className="text-slate-500 text-sm">Auditoría de gastos, tickets y kilometraje real.</p>
                </div>
                <button 
                    onClick={() => handleOpenModal()}
                    className="bg-blue-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700 transition-all shadow-lg hover:shadow-blue-200"
                >
                    <Plus size={20} /> Añadir Vehículo
                </button>
            </div>

            {/* Search and Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="md:col-span-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                        type="text" 
                        placeholder="Buscar por matrícula o marca..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>
            </div>

            {/* Vehicles Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredVehicles.map(v => {
                    const kmsDriven = v.currentKms - v.initialKms;
                    const progress = Math.min(100, (kmsDriven / (v.annualKmLimit || 10000)) * 100);
                    const isAlert = progress > 90;

                    return (
                        <div key={v.id} className={`bg-white rounded-2xl p-6 border ${isAlert ? 'border-red-200 bg-red-50/10' : 'border-slate-100'} shadow-sm hover:shadow-md transition-all flex flex-col`}>
                            <div className="flex justify-between items-start mb-4">
                                <div className="bg-slate-100 p-3 rounded-xl">
                                    <Truck className={isAlert ? 'text-red-600' : 'text-blue-600'} />
                                </div>
                                <div className="flex gap-1">
                                    <button 
                                        onClick={() => fetchVehicleHistory(v.id)}
                                        className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg flex items-center gap-1 text-xs font-bold" 
                                        title="Ver historial y fotos"
                                    >
                                        <Search size={14} /> Bitácora
                                    </button>
                                    <button onClick={() => handleOpenModal(v)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                                        <Edit3 size={18} />
                                    </button>
                                    <button onClick={() => handleDelete(v.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>

                            <div className="mb-4">
                                <h3 className="font-bold text-lg text-slate-800 uppercase tracking-tight">{v.make} {v.model}</h3>
                                <div className="inline-block px-3 py-1 bg-blue-100 text-blue-700 rounded-lg font-mono font-bold text-sm mt-1">
                                    {v.plate}
                                </div>
                            </div>

                            <div className="space-y-4 flex-grow">
                                <div className="flex justify-between items-end text-sm">
                                    <span className="text-slate-500 font-medium">Uso del Seguro (10k km/año)</span>
                                    <span className={`font-bold ${isAlert ? 'text-red-600' : 'text-slate-700'}`}>{kmsDriven.toFixed(0)} / {v.annualKmLimit} km</span>
                                </div>
                                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                                    <div 
                                        className={`h-full transition-all duration-1000 ${getProgressColor(progress)}`}
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4 pt-2">
                                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                        <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Kms Actuales</p>
                                        <p className="font-bold text-slate-700 flex items-center gap-1"><Gauge size={14} className="text-blue-500" /> {v.currentKms}</p>
                                    </div>
                                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                        <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Equipo Asignado</p>
                                        <p className="font-bold text-slate-700 truncate">{v.team?.name || 'Libre'}</p>
                                    </div>
                                </div>
                            </div>

                            {isAlert && (
                                <div className="mt-4 flex items-center gap-2 text-red-600 text-xs font-bold animate-pulse">
                                    <AlertCircle size={14} /> LÍMITE DE SEGURO PRÓXIMO - PARAR COCHE
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-scaleIn">
                        <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-slate-800">{currentVehicle ? 'Editar Vehículo' : 'Nuevo Vehículo'}</h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">&times;</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1">Marca</label>
                                    <input 
                                        type="text" 
                                        required 
                                        value={formData.make}
                                        onChange={(e) => setFormData({ ...formData, make: e.target.value })}
                                        className="w-full p-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="Ej: Ford"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1">Modelo</label>
                                    <input 
                                        type="text" 
                                        required 
                                        value={formData.model}
                                        onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                                        className="w-full p-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="Ej: Transit"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">Matrícula</label>
                                <input 
                                    type="text" 
                                    required 
                                    value={formData.plate}
                                    onChange={(e) => setFormData({ ...formData, plate: e.target.value })}
                                    className="w-full p-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                                    placeholder="0000XXX"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1">Kms Iniciales</label>
                                    <input 
                                        type="number" 
                                        required 
                                        value={formData.initialKms}
                                        onChange={(e) => setFormData({ ...formData, initialKms: e.target.value })}
                                        className="w-full p-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1">Límite Seguro (Km)</label>
                                    <input 
                                        type="number" 
                                        required 
                                        value={formData.annualKmLimit}
                                        onChange={(e) => setFormData({ ...formData, annualKmLimit: e.target.value })}
                                        className="w-full p-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>
                            <div className="pt-4 flex gap-3">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition-all">Cancelar</button>
                                <button type="submit" className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200">Guardar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* History and Photos Modal */}
            {isLogsModalOpen && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fadeIn">
                    <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[85vh] shadow-2xl overflow-hidden flex flex-col">
                        <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="bg-blue-600 p-2 rounded-xl text-white shadow-lg shadow-blue-100">
                                    <TrendingUp size={20} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-slate-800">Bitácora de Actividad</h2>
                                    <p className="text-xs text-slate-500">Repasando: <b>{selectedVehicleStats?.vehicle.plate}</b></p>
                                </div>
                            </div>
                            <button onClick={() => setIsLogsModalOpen(false)} className="bg-slate-100 p-2 rounded-full text-slate-400 hover:text-slate-800 hover:bg-slate-200 transition-all">
                                <AlertCircle size={24} />
                            </button>
                        </div>

                        <div className="flex-grow overflow-y-auto p-6">
                            {loadingStats ? (
                                <div className="text-center py-12 text-slate-400 font-bold animate-pulse">Sincronizando registros...</div>
                            ) : selectedVehicleStats?.vehicle.logs.length === 0 ? (
                                <div className="text-center py-12 text-slate-400 italic">No hay registros de actividad para este vehículo.</div>
                            ) : (
                                <div className="space-y-6">
                                    {/* Stats Mini Banner */}
                                    <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex justify-between items-center">
                                        <div>
                                            <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1">Gasto Acumulado Gasolina</p>
                                            <h4 className="text-2xl font-black text-blue-700">{money(selectedVehicleStats?.stats.totalFuelCost)}</h4>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1 text-right">Kms Recorridos</p>
                                            <h4 className="text-2xl font-black text-blue-700 text-right">{selectedVehicleStats?.stats.kmsDriven.toFixed(0)} km</h4>
                                        </div>
                                    </div>

                                    <div className="divide-y divide-slate-100">
                                        {selectedVehicleStats?.vehicle.logs.map((log, idx) => (
                                            <div key={log.id} className="py-4 first:pt-0">
                                                <div className="flex justify-between items-start mb-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`p-2 rounded-lg ${log.type === 'FUEL' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                                                            {log.type === 'FUEL' ? <Fuel size={18} /> : <Gauge size={18} />}
                                                        </div>
                                                        <div>
                                                            <p className="text-xs font-black text-slate-400 uppercase tracking-tight">
                                                                {new Date(log.createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                                                            </p>
                                                            <h5 className="font-bold text-slate-800">
                                                                {log.type === 'FUEL' ? `Repostaje: ${money(log.amount)}` : `Odométro: ${log.kms} km`}
                                                            </h5>
                                                        </div>
                                                    </div>
                                                    <button 
                                                        onClick={() => handleDeleteLog(log.id, selectedVehicleStats.vehicle.id)}
                                                        className="p-2 text-red-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                        title="Borrar registro"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>

                                                {/* Photos Row */}
                                                {log.photos && log.photos.length > 0 && (
                                                    <div className="flex gap-2 overflow-x-auto pb-2">
                                                        {log.photos.map((photo, pIdx) => (
                                                            <div 
                                                                key={pIdx} 
                                                                onClick={() => setViewerImage(photo)}
                                                                className="relative w-32 h-24 rounded-xl overflow-hidden border border-slate-200 group flex-shrink-0 cursor-pointer"
                                                            >
                                                                <img src={photo} alt="Log" className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                                    <Search className="text-white" size={20} />
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest italic">Joa Technologien Auditoría de Flota</p>
                        </div>
                    </div>
                </div>
            )}

            {/* FULL IMAGE VIEWER MODAL */}
            {viewerImage && (
                <div 
                    className="fixed inset-0 bg-slate-900/95 backdrop-blur-xl z-[100] flex items-center justify-center p-4 animate-fadeIn"
                    onClick={() => setViewerImage(null)}
                >
                    <button 
                        onClick={() => setViewerImage(null)}
                        className="absolute top-6 right-6 bg-white/10 hover:bg-white/20 text-white p-3 rounded-full transition-all border border-white/10"
                    >
                        <X size={24} />
                    </button>
                    <div className="max-w-4xl w-full max-h-[90vh] flex items-center justify-center animate-scaleIn">
                        <img 
                            src={viewerImage} 
                            alt="Full Ticket" 
                            className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl border border-white/10 shadow-black/50"
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default VehicleManagement;
