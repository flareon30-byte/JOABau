import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { useTranslation } from 'react-i18next';
import { 
    Home, Calendar, Users, Plus, Pencil, Trash2, 
    AlertCircle, Clock, ArrowRight, X, Search, CheckSquare
} from 'lucide-react';

const AccommodationsPage = () => {
    const { t } = useTranslation();
    const [accommodations, setAccommodations] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    
    // User Role context
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(currentUser.role);

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({
        address: '',
        startDate: '',
        endDate: '',
        residentIds: []
    });
    const [searchUserQuery, setSearchUserQuery] = useState('');

    useEffect(() => {
        fetchAccommodations();
        if (isAdmin) {
            fetchUsers();
        }
    }, [isAdmin]);

    const fetchAccommodations = async () => {
        try {
            const res = await api.get('/api/accommodations');
            setAccommodations(res.data || []);
        } catch (error) {
            console.error('Error fetching accommodations:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchUsers = async () => {
        try {
            const res = await api.get('/api/users');
            // Filter only active users or technicians, but keeping all is fine
            setUsers(res.data || []);
        } catch (error) {
            console.error('Error fetching users:', error);
        }
    };

    const handleOpenCreateModal = () => {
        setEditingId(null);
        setFormData({
            address: '',
            startDate: '',
            endDate: '',
            residentIds: []
        });
        setSearchUserQuery('');
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (acc) => {
        setEditingId(acc.id);
        
        // Format dates to YYYY-MM-DD for input type="date"
        const formattedStart = acc.startDate ? new Date(acc.startDate).toISOString().split('T')[0] : '';
        const formattedEnd = acc.endDate ? new Date(acc.endDate).toISOString().split('T')[0] : '';

        setFormData({
            address: acc.address,
            startDate: formattedStart,
            endDate: formattedEnd,
            residentIds: acc.residents ? acc.residents.map(r => r.id) : []
        });
        setSearchUserQuery('');
        setIsModalOpen(true);
    };

    const handleDelete = async (id, address) => {
        if (!window.confirm(`¿Estás seguro de que deseas eliminar el alojamiento en "${address}"?`)) return;
        
        try {
            await api.delete(`/api/accommodations/${id}`);
            fetchAccommodations();
        } catch (error) {
            console.error('Error deleting accommodation:', error);
            alert('Error al eliminar el alojamiento.');
        }
    };

    const handleUserSelectToggle = (userId) => {
        setFormData(prev => {
            const current = [...prev.residentIds];
            const index = current.indexOf(userId);
            if (index > -1) {
                current.splice(index, 1);
            } else {
                current.push(userId);
            }
            return { ...prev, residentIds: current };
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!formData.address.trim()) {
            alert('La dirección es obligatoria.');
            return;
        }
        if (!formData.startDate || !formData.endDate) {
            alert('Las fechas de inicio y fin son obligatorias.');
            return;
        }
        if (new Date(formData.startDate) > new Date(formData.endDate)) {
            alert('La fecha de inicio no puede ser posterior a la fecha de fin.');
            return;
        }

        setSubmitting(true);
        try {
            if (editingId) {
                await api.put(`/api/accommodations/${editingId}`, formData);
            } else {
                await api.post('/api/accommodations', formData);
            }
            setIsModalOpen(false);
            fetchAccommodations();
        } catch (error) {
            console.error('Error saving accommodation:', error);
            alert(error.response?.data?.message || 'Error al guardar el alojamiento.');
        } finally {
            setSubmitting(false);
        }
    };

    // Helper: calculate days remaining
    const getDaysRemaining = (endDateStr) => {
        const end = new Date(endDateStr);
        const today = new Date();
        // Reset times to compare dates only
        end.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);

        const diffTime = end.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    };

    // Helper: get next renewal warning date
    const getNextRenewalWarningStr = () => {
        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth(); // 0-indexed
        
        let warningDate = new Date(currentYear, currentMonth, 20, 9, 0, 0);
        if (today.getDate() > 20) {
            // If already passed the 20th, next warning is next month
            warningDate = new Date(currentYear, currentMonth + 1, 20, 9, 0, 0);
        }

        return warningDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
    };

    // Filter users list based on query
    const filteredUsers = users.filter(u => 
        u.username.toLowerCase().includes(searchUserQuery.toLowerCase())
    );

    if (loading) {
        return (
            <div className="flex justify-center items-center h-96">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                        <Home className="text-indigo-600" />
                        {t('accommodations.title') || 'Alojamientos / Alquileres'}
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">
                        {t('accommodations.subtitle') || 'Supervisión y control de viviendas de técnicos de campo'}
                    </p>
                </div>

                {isAdmin && (
                    <button
                        onClick={handleOpenCreateModal}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-3 rounded-2xl transition-all flex items-center gap-2 shadow-lg shadow-indigo-100 hover:shadow-indigo-200 active:scale-98"
                    >
                        <Plus size={18} />
                        <span>{t('accommodations.add') || 'Añadir Alojamiento'}</span>
                    </button>
                )}
            </div>

            {/* Monthly Renewal Payment Warning Banner */}
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-3xl p-5 flex flex-col sm:flex-row gap-4 items-start sm:items-center shadow-sm">
                <div className="bg-amber-100 p-3 rounded-2xl text-amber-600">
                    <AlertCircle size={24} />
                </div>
                <div className="flex-1">
                    <h4 className="font-extrabold text-amber-800 text-sm tracking-tight">Recordatorio Mensual de Alquiler</h4>
                    <p className="text-xs text-amber-700 font-medium mt-0.5">
                        El sistema generará automáticamente una notificación de pago el día 20 de cada mes a las 09:00 AM para todos los alojamientos activos.
                    </p>
                </div>
                <div className="bg-white/80 border border-amber-200/50 rounded-2xl px-4 py-2 text-xs font-bold text-amber-800 whitespace-nowrap self-stretch sm:self-auto flex items-center justify-center gap-1.5 shadow-sm">
                    <Clock size={14} className="text-amber-500" />
                    <span>Próximo: {getNextRenewalWarningStr()}</span>
                </div>
            </div>

            {/* Accommodations Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {accommodations.map(acc => {
                    const daysRemaining = getDaysRemaining(acc.endDate);
                    const isExpired = daysRemaining < 0;

                    return (
                        <div 
                            key={acc.id} 
                            className="bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:border-slate-200/80 transition-all duration-300 flex flex-col justify-between overflow-hidden group"
                        >
                            {/* Card Top */}
                            <div className="p-6 space-y-4 flex-1">
                                <div className="flex justify-between items-start">
                                    {/* Status Badge */}
                                    {isExpired ? (
                                        <span className="bg-slate-100 text-slate-600 text-xs px-3 py-1 rounded-full font-bold">
                                            Expirado
                                        </span>
                                    ) : daysRemaining <= 7 ? (
                                        <span className="bg-rose-50 text-rose-600 border border-rose-100 text-xs px-3 py-1 rounded-full font-black animate-pulse">
                                            Vence en {daysRemaining} días
                                        </span>
                                    ) : (
                                        <span className="bg-emerald-50 text-emerald-600 border border-emerald-100 text-xs px-3 py-1 rounded-full font-bold">
                                            Activo ({daysRemaining} días)
                                        </span>
                                    )}

                                    {/* Admin Actions */}
                                    {isAdmin && (
                                        <div className="flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => handleOpenEditModal(acc)}
                                                className="text-slate-400 hover:text-indigo-600 hover:bg-slate-50 p-1.5 rounded-lg transition-colors"
                                                title="Editar"
                                            >
                                                <Pencil size={15} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(acc.id, acc.address)}
                                                className="text-slate-400 hover:text-red-600 hover:bg-slate-50 p-1.5 rounded-lg transition-colors"
                                                title="Eliminar"
                                            >
                                                <Trash2 size={15} />
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Address */}
                                <div>
                                    <h3 className="font-bold text-slate-800 text-lg leading-snug line-clamp-2" title={acc.address}>
                                        {acc.address}
                                    </h3>
                                </div>

                                {/* Dates */}
                                <div className="bg-slate-50 border border-slate-100/50 rounded-2xl p-3 flex justify-between items-center text-xs font-semibold text-slate-500">
                                    <div className="space-y-0.5">
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Entrada</p>
                                        <p className="text-slate-700">{acc.startDate ? new Date(acc.startDate).toLocaleDateString('es-ES') : 'N/A'}</p>
                                    </div>
                                    <ArrowRight size={14} className="text-slate-400" />
                                    <div className="space-y-0.5 text-right">
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Salida</p>
                                        <p className="text-slate-700">{acc.endDate ? new Date(acc.endDate).toLocaleDateString('es-ES') : 'N/A'}</p>
                                    </div>
                                </div>

                                {/* Residents */}
                                <div className="space-y-2">
                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                        <Users size={14} className="text-slate-400" />
                                        <span>Técnicos Hospedados ({acc.residents?.length || 0})</span>
                                    </h4>
                                    
                                    {acc.residents && acc.residents.length > 0 ? (
                                        <div className="flex flex-wrap gap-1.5">
                                            {acc.residents.map(res => (
                                                <span 
                                                    key={res.id} 
                                                    className="bg-indigo-50/50 border border-indigo-100 text-indigo-700 text-xs px-2.5 py-1 rounded-xl font-bold"
                                                >
                                                    {res.username.split('@')[0]}
                                                </span>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-slate-400 font-medium italic">Sin técnicos hospedados.</p>
                                    )}
                                </div>
                            </div>

                            {/* Card Footer */}
                            <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100/80 text-[11px] text-slate-400 font-bold flex justify-between items-center rounded-b-3xl">
                                <span>Recordatorio de renovación</span>
                                <span className="text-indigo-600">Día 20</span>
                            </div>
                        </div>
                    );
                })}

                {accommodations.length === 0 && (
                    <div className="col-span-full bg-white border border-dashed border-slate-200 rounded-3xl p-12 text-center text-slate-400">
                        <Home className="mx-auto text-slate-300 mb-3" size={40} />
                        <p className="font-bold text-slate-500">No hay alojamientos registrados</p>
                        {isAdmin && (
                            <p className="text-xs text-slate-400 mt-1">Pulsa en "Añadir Alojamiento" para registrar la primera vivienda.</p>
                        )}
                    </div>
                )}
            </div>

            {/* Create/Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
                    <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        {/* Modal Header */}
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h3 className="text-lg font-black text-slate-800 tracking-tight">
                                    {editingId ? 'Editar Alojamiento' : 'Registrar Nuevo Alojamiento'}
                                </h3>
                                <p className="text-xs text-slate-400 mt-0.5">Define los datos del alquiler y técnicos residentes</p>
                            </div>
                            <button 
                                onClick={() => setIsModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-100 rounded-full transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Body Form */}
                        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
                            {/* Address input */}
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                                    Dirección Completa
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ej: Calle Principal 123, 55116 Mainz"
                                    value={formData.address}
                                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                    className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-600 text-sm font-medium"
                                />
                            </div>

                            {/* Dates inputs */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                                        Fecha Entrada (Reserva)
                                    </label>
                                    <input
                                        type="date"
                                        required
                                        value={formData.startDate}
                                        onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                                        className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-600 text-sm font-medium"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                                        Fecha Salida (Fin Reserva)
                                    </label>
                                    <input
                                        type="date"
                                        required
                                        value={formData.endDate}
                                        onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                                        className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-600 text-sm font-medium"
                                    />
                                </div>
                            </div>

                            {/* Resident Selection */}
                            <div className="space-y-2 border-t border-slate-100 pt-4">
                                <div className="flex justify-between items-center">
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                                        Asignar Residentes ({formData.residentIds.length} seleccionados)
                                    </label>
                                </div>

                                {/* User Search input */}
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                    <input
                                        type="text"
                                        placeholder="Buscar técnico..."
                                        value={searchUserQuery}
                                        onChange={(e) => setSearchUserQuery(e.target.value)}
                                        className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-600 text-xs font-medium"
                                    />
                                </div>

                                {/* Users selection container */}
                                <div className="border border-slate-200 rounded-2xl max-h-48 overflow-y-auto p-2 bg-slate-50/50 space-y-1 shadow-inner">
                                    {filteredUsers.map(user => {
                                        const isSelected = formData.residentIds.includes(user.id);
                                        return (
                                            <div 
                                                key={user.id}
                                                onClick={() => handleUserSelectToggle(user.id)}
                                                className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all hover:bg-slate-100 border ${
                                                    isSelected 
                                                        ? 'bg-indigo-50 border-indigo-200 text-indigo-900 font-bold' 
                                                        : 'border-transparent text-slate-600'
                                                }`}
                                            >
                                                <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                                                    isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 bg-white'
                                                }`}>
                                                    {isSelected && <CheckSquare size={12} className="text-white" />}
                                                </div>
                                                <div className="flex-1 text-xs">
                                                    <p className="font-semibold">{user.username}</p>
                                                    <p className="text-[10px] text-slate-400 font-bold tracking-tight uppercase mt-0.5">{user.role}</p>
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {filteredUsers.length === 0 && (
                                        <p className="text-xs text-slate-400 text-center py-4 italic">No se encontraron usuarios.</p>
                                    )}
                                </div>
                            </div>

                            {/* Modal Footer Actions */}
                            <div className="flex gap-3 border-t border-slate-100 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 py-3 border-2 border-slate-200 text-slate-600 font-bold rounded-2xl hover:bg-slate-50 transition-colors text-sm"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100 flex items-center justify-center text-sm disabled:opacity-50"
                                >
                                    {submitting ? (
                                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                    ) : (
                                        editingId ? 'Actualizar Alojamiento' : 'Registrar Alojamiento'
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AccommodationsPage;
