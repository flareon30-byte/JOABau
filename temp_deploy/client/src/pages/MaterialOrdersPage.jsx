import React, { useState, useEffect } from 'react';
import { Package, Plus, Clock, CheckCircle, Search, AlertCircle, X, Trash2 } from 'lucide-react';
import api from '../api/axios';
import { useTranslation } from 'react-i18next';

const MaterialOrdersPage = () => {
    const { t } = useTranslation();
    const [orders, setOrders] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [user, setUser] = useState(null);

    // Form state
    const [materialDescription, setMaterialDescription] = useState('');
    const [timeRemaining, setTimeRemaining] = useState('');

    useEffect(() => {
        const storedUser = JSON.parse(localStorage.getItem('user'));
        setUser(storedUser);
        fetchOrders();
    }, []);

    const fetchOrders = async () => {
        try {
            setLoading(true);
            const res = await api.get('/api/material-orders');
            setOrders(res.data);
        } catch (error) {
            console.error('Error fetching orders:', error);
            alert(t('material.loading_orders'));
        } finally {
            setLoading(false);
        }
    };

    const handleCreateOrder = async (e) => {
        e.preventDefault();
        if (!materialDescription.trim() || !timeRemaining.trim()) {
            alert(t('material.complete_fields'));
            return;
        }

        try {
            setSubmitting(true);
            await api.post('/api/material-orders', {
                materialDescription,
                timeRemaining,
            });
            
            // Refetch and close
            fetchOrders();
            setIsModalOpen(false);
            setMaterialDescription('');
            setTimeRemaining('');
            alert(t('material.success_order'));
        } catch (error) {
            console.error('Error creating order:', error);
            alert(t('material.error_order'));
        } finally {
            setSubmitting(false);
        }
    };

    const handleUpdateStatus = async (id, newStatus) => {
        try {
            const res = await api.put(`/api/material-orders/${id}/status`, { status: newStatus });
            setOrders(orders.map(o => o.id === id ? res.data : o));
        } catch (error) {
            console.error('Error updating status:', error);
            alert(t('material.error_status'));
        }
    };

    const handleDeleteOrder = async (id) => {
        if (!window.confirm(t('material.confirm_delete'))) return;
        try {
            await api.delete(`/api/material-orders/${id}`);
            setOrders(orders.filter(o => o.id !== id));
        } catch (error) {
            console.error('Error deleting order:', error);
            alert(t('material.error_delete'));
        }
    };

    const isSuperAdmin = user?.role === 'SUPER_ADMIN';

    const renderStatusBadge = (status) => {
        if (status === 'PENDIENTE') {
            return (
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 flex items-center gap-1 w-max">
                    <Clock size={12} />
                    {t('material.status_pending')}
                </span>
            );
        }
        if (status === 'REALIZADO') {
            return (
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 flex items-center gap-1 w-max">
                    <Package size={12} />
                    {t('material.status_realized')}
                </span>
            );
        }
        if (status === 'EN_ALMACEN') {
            return (
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 flex items-center gap-1 w-max">
                    <CheckCircle size={12} />
                    {t('material.status_in_warehouse')}
                </span>
            );
        }
        return null;
    };

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                        <Package className="text-joa-blue" />
                        {t('material.title')}
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">{t('material.subtitle')}</p>
                </div>
                
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-joa-blue hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors shadow-lg shadow-joa-blue/20 flex items-center gap-2 w-full md:w-auto justify-center"
                >
                    <Plus size={18} />
                    {t('material.btn_request')}
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center p-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-joa-blue"></div>
                </div>
            ) : orders.length === 0 ? (
                <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
                    <Package className="mx-auto h-12 w-12 text-slate-300 mb-4" />
                    <h3 className="text-lg font-medium text-slate-900">{t('material.no_orders_title')}</h3>
                    <p className="text-slate-500 mt-2">{t('material.no_orders_subtitle')}</p>
                </div>
            ) : (
                <div className="bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('material.col_tech')}</th>
                                    <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('material.col_description')}</th>
                                    <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('material.col_urgency')}</th>
                                    <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('material.col_date')}</th>
                                    <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('material.col_status')}</th>
                                    {isSuperAdmin && (
                                        <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">{t('material.col_actions')}</th>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {orders.map((order) => (
                                    <tr key={order.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="p-4">
                                            <div className="font-medium text-slate-800">{order.user?.username || t('material.unknown_user')}</div>
                                            {order.user?.team && (
                                                <div className="text-xs text-slate-500">{t('material.team_label', { name: order.user.team.name })}</div>
                                            )}
                                        </td>
                                        <td className="p-4 text-sm text-slate-600 whitespace-pre-wrap max-w-xs">
                                            {order.materialDescription}
                                        </td>
                                        <td className="p-4 text-sm text-slate-600">
                                            <div className="flex items-center gap-1.5 font-medium text-amber-700 bg-amber-50 px-3 py-1 rounded-lg w-max border border-amber-100">
                                                <AlertCircle size={14} />
                                                {order.timeRemaining}
                                            </div>
                                        </td>
                                        <td className="p-4 text-sm text-slate-500">
                                            {new Date(order.createdAt).toLocaleDateString('es-ES')}
                                        </td>
                                        <td className="p-4">
                                            {renderStatusBadge(order.status)}
                                        </td>
                                        {isSuperAdmin && (
                                            <td className="p-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <select
                                                        value={order.status}
                                                        onChange={(e) => handleUpdateStatus(order.id, e.target.value)}
                                                        className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg focus:ring-joa-blue focus:border-joa-blue p-2 cursor-pointer"
                                                    >
                                                        <option value="PENDIENTE">{t('material.status_pending')}</option>
                                                        <option value="REALIZADO">{t('material.status_realized')}</option>
                                                        <option value="EN_ALMACEN">{t('material.status_in_warehouse')}</option>
                                                    </select>
                                                    <button
                                                        onClick={() => handleDeleteOrder(order.id)}
                                                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                        title={t('material.confirm_delete')}
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Modal de Nuevo Pedido */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
                            <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                                <Package className="text-joa-blue" size={20} />
                                {t('material.modal_title')}
                            </h2>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1.5 rounded-lg transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        
                        <form onSubmit={handleCreateOrder} className="p-6 space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                    {t('material.label_description')}
                                </label>
                                <textarea
                                    className="w-full min-h-[120px] p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-joa-blue focus:border-transparent transition-all resize-none bg-slate-50"
                                    placeholder={t('material.placeholder_description')}
                                    value={materialDescription}
                                    onChange={e => setMaterialDescription(e.target.value)}
                                    required
                                ></textarea>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                    {t('material.label_urgency')}
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Clock size={18} className="text-slate-400" />
                                    </div>
                                    <input
                                        type="text"
                                        className="w-full pl-10 p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-joa-blue focus:border-transparent transition-all bg-slate-50"
                                        placeholder={t('material.placeholder_urgency')}
                                        value={timeRemaining}
                                        onChange={e => setTimeRemaining(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>
                            
                            <div className="pt-2 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 transition-colors flex-1"
                                >
                                    {t('material.btn_cancel')}
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-5 py-2.5 rounded-xl bg-joa-blue hover:bg-blue-700 text-white font-medium shadow-lg shadow-joa-blue/20 transition-colors disabled:opacity-70 flex-1 flex items-center justify-center gap-2"
                                >
                                    {submitting ? (
                                        <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                                    ) : (
                                        <Plus size={18} />
                                    )}
                                    {submitting ? t('material.btn_saving') : t('material.btn_submit')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MaterialOrdersPage;
