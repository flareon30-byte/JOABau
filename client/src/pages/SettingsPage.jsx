import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { Save, DollarSign, Target, Lock, Truck, Users, Briefcase, Plus, Trash2, Tag, ChevronRight, Pencil, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const SettingsPage = () => {
    const { t } = useTranslation();

    const [clients, setClients] = useState([]);
    const [subcontractors, setSubcontractors] = useState([]);
    const [newClientName, setNewClientName] = useState('');
    const [selectedClientId, setSelectedClientId] = useState('');

    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState(null);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const [clientsRes, subsRes] = await Promise.all([
                api.get('/api/clients').catch(() => ({ data: [] })),
                api.get('/api/subcontractors').catch(() => ({ data: [] }))
            ]);
            setClients(clientsRes.data);
            setSubcontractors(subsRes.data || []);
            setLoading(false);
        } catch (error) {
            console.error('Error fetching settings:', error);
            setLoading(false);
        }
    };

    const handleCreateClient = async (e) => {
        e.preventDefault();
        if (!newClientName) return;
        try {
            const res = await api.post('/api/clients', { name: newClientName });
            setClients([...clients, res.data]);
            setNewClientName('');
            setMessage({ type: 'success', text: t('settings.success_add_client') });
        } catch (error) {
            setMessage({ type: 'error', text: t('settings.error_add_client') });
        }
    };

    const handleDeleteClient = async (id) => {
        if (!window.confirm(t('settings.confirm_delete_client'))) return;
        try {
            await api.delete(`/api/clients/${id}`);
            setClients(clients.filter(c => c.id !== id));
            setMessage({ type: 'success', text: t('settings.success_delete_client') });
        } catch (error) {
            setMessage({ type: 'error', text: t('settings.error_delete_client') });
        }
    };

    if (loading) return <div className="p-8">{t('settings.loading')}</div>;

    return (
        <div className="max-w-4xl mx-auto pb-20">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
                <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                    <Briefcase className="text-joa-blue" />
                    Rentabilidad & Clientes
                </h2>

                {message && (
                    <div className={`p-4 rounded-lg mb-6 ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                        {message.text}
                    </div>
                )}

                <p className="text-slate-500 mb-6">
                    Gestione las tarifas personalizadas que aplica a cada subcontrata para los diferentes clientes.
                </p>

                {!selectedClientId ? (
                    <div className="animate-fadeIn space-y-6">
                        <div className="flex items-center gap-2 mb-4">
                            <h3 className="text-xl font-bold text-slate-700">{t('settings.associated_clients')}</h3>
                        </div>
                        <p className="text-sm text-slate-500 mb-6">{t('settings.associated_clients_desc')}</p>

                        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                            <form onSubmit={handleCreateClient} className="flex gap-4">
                                <input 
                                    type="text" 
                                    value={newClientName}
                                    onChange={(e) => setNewClientName(e.target.value)}
                                    placeholder={t('settings.new_client_placeholder')} 
                                    className="flex-1 p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-joa-blue outline-none" 
                                />
                                <button type="submit" className="bg-joa-blue text-white px-6 py-3 rounded-xl font-bold shadow-md hover:bg-blue-700 transition">
                                    {t('settings.btn_add_client')}
                                </button>
                            </form>
                        </div>

                        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                            <table className="w-full text-left text-sm text-slate-600">
                                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-100">
                                    <tr>
                                        <th className="p-4 pl-6">{t('settings.col_client_name')}</th>
                                        <th className="p-4">{t('settings.col_active_techs')}</th>
                                        <th className="p-4 w-32">{t('settings.col_actions')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {clients.length === 0 ? (
                                        <tr><td colSpan="3" className="p-6 text-center text-slate-400">{t('settings.no_clients')}</td></tr>
                                    ) : (
                                        clients.map(client => (
                                            <tr key={client.id} className="hover:bg-slate-50">
                                                <td className="p-4 pl-6 font-bold text-slate-800">{client.name}</td>
                                                <td className="p-4"><span className="bg-green-100 text-green-700 px-2 py-1 rounded-md text-xs font-bold">{t('settings.active_label')}</span></td>
                                                <td className="p-4 flex items-center gap-4">
                                                    <button 
                                                        onClick={() => {
                                                            setSelectedClientId(client.id);
                                                        }} 
                                                        className="text-blue-500 hover:text-blue-700 p-2 hover:bg-blue-50 rounded-lg transition-colors font-bold flex items-center gap-1 group"
                                                    >
                                                        {t('settings.manage_btn')} <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDeleteClient(client.id)}
                                                        className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg transition-colors"
                                                        title={t('settings.delete_client_title')}
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <div className="animate-fadeIn">
                        <button 
                            onClick={() => setSelectedClientId('')}
                            className="text-slate-500 hover:text-slate-800 font-bold mb-6 flex items-center gap-2 text-sm"
                        >
                            {t('settings.back_to_clients')}
                        </button>

                        <div className="flex flex-col gap-6">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                                <h3 className="text-2xl font-black text-slate-800">
                                    {clients.find(c => c.id === selectedClientId)?.name}
                                </h3>
                            </div>

                            <PriceItemsManager 
                                clientId={selectedClientId} 
                                onMessage={(msg) => setMessage(msg)}
                                client={clients.find(c => c.id === selectedClientId)}
                                onUpdate={() => fetchSettings()}
                                subcontractors={subcontractors}
                            />
                        </div>
                    </div>
                )}

                <div className="my-12 border-t border-slate-200"></div>

                <PasswordChangeForm />
            </div>
        </div>
    );
};

const PasswordChangeForm = () => {
    const { t } = useTranslation();
    const [passData, setPassData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    const [message, setMessage] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        setPassData({ ...passData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage(null);

        if (passData.newPassword !== passData.confirmPassword) {
            setMessage({ type: 'error', text: t('settings.pass_no_match') });
            return;
        }

        if (passData.newPassword.length < 6) {
            setMessage({ type: 'error', text: t('settings.pass_too_short') });
            return;
        }

        setLoading(true);
        try {
            await api.post('/api/auth/update-password', {
                currentPassword: passData.currentPassword,
                newPassword: passData.newPassword
            });

            setMessage({ type: 'success', text: t('settings.pass_success_update') });
            setPassData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        } catch (error) {
            setMessage({ type: 'error', text: error.response?.data?.message || t('settings.error_processing') });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                <Lock className="text-joa-blue" />
                {t('settings.security_title')}
            </h2>

            {message && (
                <div className={`p-4 rounded-lg mb-6 ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {message.text}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6 max-w-lg">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">{t('settings.label_curr_pass')}</label>
                    <input
                        type="password"
                        name="currentPassword"
                        value={passData.currentPassword}
                        onChange={handleChange}
                        className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-joa-blue outline-none"
                        required
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">{t('settings.label_new_pass')}</label>
                        <input
                            type="password"
                            name="newPassword"
                            value={passData.newPassword}
                            onChange={handleChange}
                            className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-joa-blue outline-none"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">{t('settings.label_confirm_pass')}</label>
                        <input
                            type="password"
                            name="confirmPassword"
                            value={passData.confirmPassword}
                            onChange={handleChange}
                            className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-joa-blue outline-none"
                            required
                        />
                    </div>
                </div>

                <div className="pt-4">
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
                    >
                        {loading ? t('settings.updating') : t('settings.btn_update_pass')}
                    </button>
                </div>
            </form>
        </div>
    );
};

const PriceItemsManager = ({ clientId, onMessage, client, onUpdate, subcontractors = [] }) => {
    const { t } = useTranslation();
    const [newItem, setNewItem] = useState({ name: '', subcontractorId: '', priceToClient: '' });
    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const items = client?.priceItems || [];

    const handleAddItem = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                name: newItem.name,
                subcontractorId: newItem.subcontractorId || null,
                priceToClient: parseFloat(newItem.priceToClient || 0),
                department: null,
                bonusToTeam: 0,
                saturdayPay: 0
            };
            if (isEditing) {
                await api.put(`/api/clients/${clientId}/price-items/${editingId}`, payload);
                onMessage({ type: 'success', text: 'Concepto actualizado correctamente.' });
            } else {
                await api.post(`/api/clients/${clientId}/price-items`, payload);
                onMessage({ type: 'success', text: 'Concepto añadido correctamente.' });
            }
            resetForm();
            onUpdate();
        } catch (error) {
            onMessage({ type: 'error', text: t('settings.error_processing') });
        }
    };

    const resetForm = () => {
        setNewItem({ name: '', subcontractorId: '', priceToClient: '' });
        setIsEditing(false);
        setEditingId(null);
    };

    const handleEditClick = (item) => {
        setNewItem({ 
            name: item.name, 
            subcontractorId: item.subcontractorId || '', 
            priceToClient: item.priceToClient ? item.priceToClient.toString() : ''
        });
        setEditingId(item.id);
        setIsEditing(true);
        // Scroll to top of form
        window.scrollTo({ top: 300, behavior: 'smooth' });
    };

    const handleDeleteItem = async (itemId) => {
        if (!window.confirm(t('settings.confirm_delete_concept'))) return;
        try {
            await api.delete(`/api/clients/${clientId}/price-items/${itemId}`);
            onMessage({ type: 'success', text: t('settings.concept_deleted') });
            onUpdate();
        } catch (error) {
            onMessage({ type: 'error', text: t('settings.error_deleting') });
        }
    };

    return (
        <div className="space-y-6">
            <div className={`p-6 rounded-2xl border transition-all ${isEditing ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
                <h4 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                    {isEditing ? <Pencil size={18} className="text-amber-500" /> : <Plus size={18} />} 
                    {isEditing ? t('settings.edit_concept') : t('settings.add_concept')}
                </h4>
                <form onSubmit={handleAddItem} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">{t('settings.label_item_name')}</label>
                        <input 
                            type="text" 
                            required
                            placeholder={t('settings.placeholder_item_name')}
                            value={newItem.name}
                            onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                            className="p-2.5 border rounded-lg text-sm bg-white" 
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Subcontrata</label>
                        <select 
                            value={newItem.subcontractorId}
                            onChange={(e) => setNewItem({ ...newItem, subcontractorId: e.target.value })}
                            className="p-2.5 border rounded-lg text-sm bg-white font-bold"
                        >
                            <option value="">Todas (General)</option>
                            {subcontractors.map(sub => (
                                <option key={sub.id} value={sub.id}>{sub.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Precio Cliente (€)</label>
                        <input 
                            type="number" 
                            step="0.01"
                            required
                            placeholder="0.00"
                            value={newItem.priceToClient}
                            onChange={(e) => setNewItem({ ...newItem, priceToClient: e.target.value })}
                            className="p-2.5 border border-blue-200 rounded-lg text-sm font-bold bg-blue-50 text-blue-700" 
                        />
                    </div>
                    <div className="md:col-span-3 flex justify-end gap-2">
                        {isEditing && (
                            <button 
                                type="button" 
                                onClick={resetForm}
                                className="bg-white text-slate-500 border border-slate-200 px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-slate-50 transition flex items-center gap-2"
                            >
                                <X size={16} /> {t('settings.btn_cancel')}
                            </button>
                        )}
                        <button type="submit" className={`${isEditing ? 'bg-amber-500 hover:bg-amber-600' : 'bg-slate-800 hover:bg-slate-900'} text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-md transition flex items-center gap-2`}>
                             {isEditing ? <Save size={16} /> : <Plus size={16} />} 
                             {isEditing ? t('settings.btn_update_changes') : t('settings.btn_save_concept')}
                        </button>
                    </div>
                </form>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                        <tr>
                            <th className="p-4 pl-6 uppercase tracking-wider text-[10px]">Concepto</th>
                            <th className="p-4 uppercase tracking-wider text-[10px]">Subcontrata</th>
                            <th className="p-4 uppercase tracking-wider text-[10px]">Precio Cliente</th>
                            <th className="p-4 w-16"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {items.length === 0 ? (
                            <tr><td colSpan="4" className="p-10 text-center text-slate-400 italic">No hay conceptos configurados</td></tr>
                        ) : (
                            items.map(item => (
                                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="p-4 pl-6 font-bold text-slate-800">{item.name}</td>
                                    <td className="p-4">
                                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${
                                            item.subcontractor ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-slate-100 text-slate-700'
                                        }`}>
                                            {item.subcontractor?.name || 'Todas (General)'}
                                        </span>
                                    </td>
                                    <td className="p-4 font-black text-blue-600">{(item.priceToClient || 0).toFixed(2)}€</td>
                                    <td className="p-4">
                                        <div className="flex gap-1 justify-end">
                                            <button onClick={() => handleEditClick(item)} className="text-slate-400 hover:text-amber-500 p-2 transition-colors">
                                                <Pencil size={16} />
                                            </button>
                                            <button onClick={() => handleDeleteItem(item.id)} className="text-slate-400 hover:text-red-500 p-2 transition-colors">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default SettingsPage;
