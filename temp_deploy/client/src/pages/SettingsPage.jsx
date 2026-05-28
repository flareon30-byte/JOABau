import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { Save, DollarSign, Target, Lock, Truck, Users, Briefcase, Plus, Trash2, Tag, ChevronRight, Pencil, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const SettingsPage = () => {
    const { t } = useTranslation();
    // Stores the complex financial config
    const [financials, setFinancials] = useState({
        installers: {
            salary: 1500,
            insuranceRate: 21.50,
            sokaBauPercent: 15.10,
            dietasPerDay: 0,
            car: 400,
            gas: 300,
            equipmentRent: 0,
            materials: 100,

            // Revenue Prices (Client pays)
            pricePerUnit: 60,
            pricePerTA: 25,
            pricePerMulti: 35,
            pricePerMDU: 50, // Added default

            // Bonus Payouts (Team receives)
            bonusPerUnit: 20,
            bonusPerTA: 5,
            bonusPerMulti: 10,
            bonusPerMDU: 15,

            saturdayRate: 40,
            extraSaturday: 50 // Added Extra Saturday for Dietas
        },
        blowers: {
            salary: 1600,
            insuranceRate: 21.50,
            sokaBauPercent: 15.10,
            dietasPerDay: 0,
            car: 400,
            gas: 300,
            equipmentRent: 0,
            materials: 50,
            pricePerUnit: 15, // Vivienda Soplada
            bonusPerUnit: 3,
            saturdayRate: 0,
            saturdayBonusPerUnit: 5,
            extraSaturday: 50 // Added Extra Saturday for Dietas
        },
        backOffice: {
            salary: 1500,
            insuranceRate: 21.50,
            dietasPerDay: 0,
            opCostPerPerson: 200,
            pricePerAppointment: 15,
            extraSaturday: 50 // Added Extra Saturday for Dietas
        },
        protocols: {
            salary: 1500,
            insuranceRate: 21.50,
            dietasPerDay: 0,
            opCostPerPerson: 200,
            extraSaturday: 50 // Added Extra Saturday for Dietas
        },
        fusion: {
            muffaHourPrice: 35.0,
            fusionUnitPrice: 15.0
        }
    });

    const [settings, setSettings] = useState({
        // Legacy points points - keep for now as they are used in activation creation
        bpPoints: 10, bp2FamPoints: 15, brMultiPoints: 20,
        sduPoints: 25, mduPoints: 30, spPoints: 5, taPoints: 0.5
    });

    const [clients, setClients] = useState([]);
    const [newClientName, setNewClientName] = useState('');
    const [selectedClientId, setSelectedClientId] = useState('');

    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState(null);
    const [activeTab, setActiveTab] = useState('clients'); // Start on clients now
    const [activeSubTab, setActiveSubTab] = useState('priceItems'); // New subtab for client config

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const res = await api.get('/api/settings');
            // Fetch clients
            const clientsRes = await api.get('/api/clients').catch(() => ({ data: [] }));
            setClients(clientsRes.data);
            
            setSettings(res.data);
            
            // Just defaults here. We only load financials when a client is selected!
            setLoading(false);
        } catch (error) {
            console.error('Error fetching settings:', error);
            setLoading(false);
        }
    };
    
    // Auto-load financials when jumping to client
    useEffect(() => {
        if (!selectedClientId) return;
        const client = clients.find(c => c.id === selectedClientId);
        if (client && client.settings) {
             setFinancials(prev => ({
                 ...prev,
                 installers: { ...prev.installers, ...(client.settings.installers || {}) },
                 blowers: { ...prev.blowers, ...(client.settings.blowers || {}) },
                 backOffice: { ...prev.backOffice, ...(client.settings.backOffice || {}) }
             }));
        }
    }, [selectedClientId, clients]);

    const handleFinancialChange = (group, field, value) => {
        setFinancials(prev => ({
            ...prev,
            [group]: {
                ...prev[group],
                [field]: parseFloat(value) || 0
            }
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage(null);
        if (!selectedClientId) {
             setMessage({ type: 'error', text: t('settings.alert_select_client') });
             return;
        }
        
        try {
            // Update the selected client's settings, instead of the global config.
            await api.put(`/api/clients/${selectedClientId}`, {
                name: clients.find(c => c.id === selectedClientId)?.name,
                isActive: true,
                settings: financials
            });
            
            // Also refresh clients list so settings bubble up
            const clientsRes = await api.get('/api/clients').catch(() => ({ data: [] }));
            setClients(clientsRes.data);
            
            setMessage({ type: 'success', text: t('settings.success_financial_save') });
        } catch (error) {
            console.error('Settings save error:', error);
            setMessage({ type: 'error', text: t('settings.error_financial_save') });
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

    const renderBackOfficeInputs = () => {
        const data = financials.backOffice || {};
        const groupKey = 'backOffice';
        return (
            <div className="space-y-6 animate-fadeIn">
                <div className="flex items-center gap-2 mb-4">
                    <h3 className="text-xl font-bold text-slate-700">{t('settings.back_office_mgmt')}</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Personnel Costs */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <h4 className="font-bold text-slate-600 mb-4 flex items-center gap-2"><Users size={18} /> {t('settings.personnel_costs')}</h4>
                        <div className="space-y-4">
                            <div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase">{t('settings.social_insurance')}</label>
                                <input type="number" step="0.01" value={data.insuranceRate} onChange={(e) => handleFinancialChange(groupKey, 'insuranceRate', e.target.value)} className="w-full p-2 border rounded-lg" />
                            </div>
                            {groupKey !== 'backOffice' && groupKey !== 'protocols' && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase">{t('settings.soka_bau')}</label>
                                    <input type="number" step="0.01" value={data.sokaBauPercent} onChange={(e) => handleFinancialChange(groupKey, 'sokaBauPercent', e.target.value)} className="w-full p-2 border rounded-lg" />
                                </div>
                            )}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase">{t('settings.dietas')}</label>
                                <input type="number" value={data.dietasPerDay} onChange={(e) => handleFinancialChange(groupKey, 'dietasPerDay', e.target.value)} className="w-full p-2 border rounded-lg" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-orange-600 uppercase">{t('settings.extra_saturday')}</label>
                                <input type="number" value={data.extraSaturday || 40} onChange={(e) => handleFinancialChange(groupKey, 'extraSaturday', e.target.value)} className="w-full p-2 border border-orange-200 rounded-lg bg-orange-50 font-bold outline-none" />
                            </div>
                        </div>
                    </div>

                    {/* Operational Costs */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <h4 className="font-bold text-slate-600 mb-4 flex items-center gap-2"><Truck size={18} /> {t('settings.operational_costs')}</h4>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase">{t('settings.op_cost_per_person')}</label>
                                <input type="number" value={data.opCostPerPerson} onChange={(e) => handleFinancialChange(groupKey, 'opCostPerPerson', e.target.value)} className="w-full p-2 border rounded-lg" />
                                <p className="text-[10px] text-slate-400 mt-1">{t('settings.op_cost_hint')}</p>
                            </div>
                        </div>
                    </div>

                    {/* Revenue */}
                    <div className="md:col-span-2 bg-blue-50 p-4 rounded-xl border border-blue-200">
                        <h4 className="font-bold text-blue-800 mb-4 flex items-center gap-2"><DollarSign size={18} /> {t('settings.billing_revenue')}</h4>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-blue-600 uppercase">{t('settings.price_per_appointment')}</label>
                                <input type="number" step="0.01" value={data.pricePerAppointment} onChange={(e) => handleFinancialChange(groupKey, 'pricePerAppointment', e.target.value)} className="w-full p-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500" />
                                <p className="text-[10px] text-blue-700 mt-1">{t('settings.appointment_revenue_hint')}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderProtocolInputs = () => {
        const data = financials.protocols || {};
        const groupKey = 'protocols';
        return (
            <div className="space-y-6 animate-fadeIn">
                <div className="flex items-center gap-2 mb-4">
                    <h3 className="text-xl font-bold text-slate-700">{t('settings.protocols_parameters')}</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Personnel Costs */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <h4 className="font-bold text-slate-600 mb-4 flex items-center gap-2"><Users size={18} /> {t('settings.personnel_costs')}</h4>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase">{t('settings.social_insurance')}</label>
                                <input type="number" step="0.01" value={data.insuranceRate} onChange={(e) => handleFinancialChange(groupKey, 'insuranceRate', e.target.value)} className="w-full p-2 border rounded-lg" />
                            </div>
                            {groupKey !== 'backOffice' && groupKey !== 'protocols' && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase">{t('settings.soka_bau')}</label>
                                    <input type="number" step="0.01" value={data.sokaBauPercent} onChange={(e) => handleFinancialChange(groupKey, 'sokaBauPercent', e.target.value)} className="w-full p-2 border rounded-lg" />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Operational Costs */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <h4 className="font-bold text-slate-600 mb-4 flex items-center gap-2"><Truck size={18} /> {t('settings.operational_costs')}</h4>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase">{t('settings.op_cost_per_person')}</label>
                                <input type="number" value={data.opCostPerPerson} onChange={(e) => handleFinancialChange(groupKey, 'opCostPerPerson', e.target.value)} className="w-full p-2 border rounded-lg" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderFinancialInputs = (groupKey, title) => {
        const data = financials[groupKey];
        return (
            <div className="space-y-6 animate-fadeIn">
                <div className="flex items-center gap-2 mb-4">
                    <h3 className="text-xl font-bold text-slate-700">{title}</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Personnel Costs */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <h4 className="font-bold text-slate-600 mb-4 flex items-center gap-2"><Users size={18} /> {t('settings.personnel_costs')}</h4>
                        <div className="space-y-4">
                            <div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase">{t('settings.social_insurance')}</label>
                                <input type="number" step="0.01" value={data.insuranceRate} onChange={(e) => handleFinancialChange(groupKey, 'insuranceRate', e.target.value)} className="w-full p-2 border rounded-lg" />
                            </div>
                            {groupKey !== 'backOffice' && groupKey !== 'protocols' && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase">{t('settings.soka_bau')}</label>
                                    <input type="number" step="0.01" value={data.sokaBauPercent} onChange={(e) => handleFinancialChange(groupKey, 'sokaBauPercent', e.target.value)} className="w-full p-2 border rounded-lg" />
                                </div>
                            )}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase">{t('settings.dietas')}</label>
                                <input type="number" value={data.dietasPerDay} onChange={(e) => handleFinancialChange(groupKey, 'dietasPerDay', e.target.value)} className="w-full p-2 border rounded-lg" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-orange-600 uppercase">{t('settings.extra_saturday')}</label>
                                <input type="number" value={data.extraSaturday || 40} onChange={(e) => handleFinancialChange(groupKey, 'extraSaturday', e.target.value)} className="w-full p-2 border border-orange-200 rounded-lg bg-orange-50 font-bold outline-none" />
                            </div>
                        </div>
                    </div>

                    {/* Operational Costs */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <h4 className="font-bold text-slate-600 mb-4 flex items-center gap-2"><Truck size={18} /> {t('settings.operational_costs_team')}</h4>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase">{t('settings.car_renting')}</label>
                                <input type="number" value={data.car} onChange={(e) => handleFinancialChange(groupKey, 'car', e.target.value)} className="w-full p-2 border rounded-lg" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase">{t('settings.gas_fuel')}</label>
                                <input type="number" value={data.gas} onChange={(e) => handleFinancialChange(groupKey, 'gas', e.target.value)} className="w-full p-2 border rounded-lg" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase">{t('settings.materials')}</label>
                                <input type="number" value={data.materials} onChange={(e) => handleFinancialChange(groupKey, 'materials', e.target.value)} className="w-full p-2 border rounded-lg" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase">{t('settings.equipment_rent')}</label>
                                <input type="number" value={data.equipmentRent || 0} onChange={(e) => handleFinancialChange(groupKey, 'equipmentRent', e.target.value)} className="w-full p-2 border rounded-lg" />
                            </div>
                        </div>
                    </div>

                    {/* Revenue & Bonus Split Section */}
                    <div className="md:col-span-2 bg-slate-100/50 p-6 rounded-2xl border border-slate-200 text-center">
                        <p className="text-slate-500 font-medium">
                            {t('settings.dynamic_catalog_hint')}
                        </p>
                    </div>
                </div>
            </div>
        );
    };

    if (loading) return <div className="p-8">{t('settings.loading')}</div>;

    return (
        <div className="max-w-4xl mx-auto pb-20">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
                <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                    <Briefcase className="text-joa-blue" />
                    {t('settings.title')}
                </h2>

                {message && (
                    <div className={`p-4 rounded-lg mb-6 ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                        {message.text}
                    </div>
                )}

                <p className="text-slate-500 mb-6">
                    {t('settings.subtitle')}
                </p>

                {/* Tabs */}
                <div className="flex flex-wrap gap-2 mb-8 border-b border-slate-200">
                    <button
                        onClick={() => setActiveTab('clients')}
                        className={`px-4 md:px-6 py-3 font-bold border-b-2 transition-colors ${activeTab === 'clients' ? 'border-joa-blue text-joa-blue' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                    >
                        {t('settings.tab_clients')}
                    </button>
                    <button
                        onClick={() => setActiveTab('installers')}
                        className={`px-4 md:px-6 py-3 font-bold border-b-2 transition-colors ${activeTab === 'installers' ? 'border-joa-blue text-joa-blue' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                    >
                        {t('settings.tab_installers')}
                    </button>
                    <button
                        onClick={() => setActiveTab('blowers')}
                        className={`px-4 md:px-6 py-3 font-bold border-b-2 transition-colors ${activeTab === 'blowers' ? 'border-joa-blue text-joa-blue' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                    >
                        {t('settings.tab_blowers')}
                    </button>
                    <button
                        onClick={() => setActiveTab('protocols')}
                        className={`px-4 md:px-6 py-3 font-bold border-b-2 transition-colors ${activeTab === 'protocols' ? 'border-joa-blue text-joa-blue' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                    >
                        {t('settings.tab_protocols')}
                    </button>
                    <button
                        onClick={() => setActiveTab('backOffice')}
                        className={`px-4 md:px-6 py-3 font-bold border-b-2 transition-colors ${activeTab === 'backOffice' ? 'border-joa-blue text-joa-blue' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                    >
                        {t('settings.tab_back_office')}
                    </button>
                    <button
                        onClick={() => setActiveTab('fusion')}
                        className={`px-4 md:px-6 py-3 font-bold border-b-2 transition-colors ${activeTab === 'fusion' ? 'border-joa-blue text-joa-blue' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                    >
                        {t('settings.tab_fusion')}
                    </button>
                </div>
                
                {/* Client selection banner if configuring prices */}
                {activeTab !== 'clients' && (
                    <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl mb-6">
                        <label className="block text-sm font-bold text-blue-800 mb-2">{t('settings.configuring_for_client')}</label>
                        <select 
                            value={selectedClientId}
                            onChange={(e) => setSelectedClientId(e.target.value)}
                            className="w-full md:w-1/2 p-2 border border-blue-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 font-bold bg-white"
                        >
                            <option value="">{t('settings.select_client_option')}</option>
                            {clients.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>
                )}

                {activeTab !== 'clients' ? (
                    selectedClientId ? (
                        <form onSubmit={handleSubmit}>
                            {activeTab === 'installers' && renderFinancialInputs('installers', t('settings.tab_installers'))}
                            {activeTab === 'blowers' && renderFinancialInputs('blowers', t('settings.tab_blowers'))}
                            {activeTab === 'backOffice' && renderBackOfficeInputs()}
                            {activeTab === 'protocols' && renderProtocolInputs()}
                            {activeTab === 'fusion' && (
                                <div className="space-y-6 animate-fadeIn">
                                    <div className="flex items-center gap-2 mb-4">
                                        <h3 className="text-xl font-bold text-slate-700">{t('settings.fusion_config')}</h3>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
                                            <h4 className="font-bold text-blue-800 mb-4 flex items-center gap-2"><DollarSign size={18} /> {t('settings.billing_rates')}</h4>
                                            <div className="space-y-4">
                                                <div>
                                                    <label className="block text-xs font-bold text-blue-600 uppercase">{t('settings.muffa_hours')}</label>
                                                    <input 
                                                        type="number" 
                                                        step="0.01" 
                                                        value={financials.fusion?.muffaHourPrice || 35} 
                                                        onChange={(e) => handleFinancialChange('fusion', 'muffaHourPrice', e.target.value)} 
                                                        className="w-full p-2 border border-blue-200 rounded-lg font-bold" 
                                                    />
                                                    <p className="text-[10px] text-blue-700 mt-1">{t('settings.muffa_hours_hint')}</p>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-blue-600 uppercase">{t('settings.fusion_unit_price')}</label>
                                                    <input 
                                                        type="number" 
                                                        step="0.01" 
                                                        value={financials.fusion?.fusionUnitPrice || 15} 
                                                        onChange={(e) => handleFinancialChange('fusion', 'fusionUnitPrice', e.target.value)} 
                                                        className="w-full p-2 border border-blue-200 rounded-lg font-bold" 
                                                    />
                                                    <p className="text-[10px] text-blue-700 mt-1">{t('settings.fusion_unit_price_hint')}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="pt-8 mt-8 border-t border-slate-100 flex justify-end">
                                <button
                                    type="submit"
                                    className="bg-joa-blue hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-xl transition-colors flex items-center gap-2 shadow-lg shadow-blue-500/20"
                                >
                                    <Save size={20} />
                                    {t('settings.btn_save_profitability')}
                                </button>
                            </div>
                        </form>
                    ) : (
                        <div className="p-10 text-center text-slate-400">
                            {t('settings.please_select_client_hint')}
                        </div>
                    )
                ) : ( // activeTab === 'clients'
                    !selectedClientId ? (
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
                                                                setActiveSubTab('priceItems');
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
                    ) : ( // activeTab === 'clients' && selectedClientId
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
                                    <div className="flex gap-2">
                                         <button 
                                            onClick={() => setActiveSubTab('priceItems')}
                                            className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${activeSubTab === 'priceItems' ? 'bg-joa-blue text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                                         >
                                            {t('settings.subtab_price_items')}
                                         </button>
                                         <button 
                                            onClick={() => setActiveSubTab('globalFinancials')}
                                            className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${activeSubTab === 'globalFinancials' ? 'bg-joa-blue text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                                         >
                                            {t('settings.subtab_financials')}
                                         </button>
                                     </div>
                                </div>

                                {activeSubTab === 'priceItems' ? (
                                    <PriceItemsManager 
                                        clientId={selectedClientId} 
                                        onMessage={(msg) => setMessage(msg)}
                                        client={clients.find(c => c.id === selectedClientId)}
                                        onUpdate={() => fetchSettings()}
                                    />
                                ) : (
                                    <form onSubmit={handleSubmit}>
                                        {renderFinancialInputs('installers', t('settings.tab_installers'))}
                                        {renderFinancialInputs('blowers', t('settings.tab_blowers'))}
                                        {renderBackOfficeInputs()}

                                        <div className="pt-8 mt-8 border-t border-slate-100 flex justify-end">
                                            <button
                                                type="submit"
                                                className="bg-joa-blue hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-xl transition-colors flex items-center gap-2 shadow-lg shadow-blue-500/20"
                                            >
                                                <Save size={20} />
                                                {t('settings.btn_save_client_financials')}
                                            </button>
                                        </div>
                                    </form>
                                )}
                            </div>
                        </div>
                    )
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

const PriceItemsManager = ({ clientId, onMessage, client, onUpdate }) => {
    const { t } = useTranslation();
    const [newItem, setNewItem] = useState({ name: '', department: 'ACTIVATION', priceToClient: '', bonusToTeam: '', saturdayPay: '' });
    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const items = client?.priceItems || [];

    const handleAddItem = async (e) => {
        e.preventDefault();
        try {
            if (isEditing) {
                await api.put(`/api/clients/${clientId}/price-items/${editingId}`, newItem);
                onMessage({ type: 'success', text: t('settings.concept_updated') });
            } else {
                await api.post(`/api/clients/${clientId}/price-items`, newItem);
                onMessage({ type: 'success', text: t('settings.concept_added') });
            }
            resetForm();
            onUpdate();
        } catch (error) {
            onMessage({ type: 'error', text: t('settings.error_processing') });
        }
    };

    const resetForm = () => {
        setNewItem({ name: '', department: 'ACTIVATION', priceToClient: '', bonusToTeam: '', saturdayPay: '' });
        setIsEditing(false);
        setEditingId(null);
    };

    const handleEditClick = (item) => {
        setNewItem({ 
            name: item.name, 
            department: item.department, 
            priceToClient: item.priceToClient, 
            bonusToTeam: item.bonusToTeam,
            saturdayPay: item.saturdayPay || ''
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
                <form onSubmit={handleAddItem} className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
                        <label className="text-[10px] font-bold text-slate-500 uppercase">{t('settings.label_department')}</label>
                        <select 
                            value={newItem.department}
                            onChange={(e) => setNewItem({ ...newItem, department: e.target.value })}
                            className="p-2.5 border rounded-lg text-sm bg-white font-bold"
                        >
                            <option value="ACTIVATION">{t('settings.dept_activation')}</option>
                            <option value="BLOWING">{t('settings.dept_blowing')}</option>
                            <option value="FUSION">{t('settings.dept_fusion')}</option>
                            <option value="PROTOCOLS">{t('settings.dept_protocols')}</option>
                        </select>
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">{t('settings.label_client_pay')}</label>
                        <input 
                            type="number" 
                            step="0.01"
                            required
                            value={newItem.priceToClient}
                            onChange={(e) => setNewItem({ ...newItem, priceToClient: e.target.value })}
                            className="p-2.5 border border-blue-200 rounded-lg text-sm font-bold bg-blue-50 text-blue-700" 
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">{t('settings.label_team_bonus')}</label>
                        <input 
                            type="number" 
                            step="0.01"
                            required
                            value={newItem.bonusToTeam}
                            onChange={(e) => setNewItem({ ...newItem, bonusToTeam: e.target.value })}
                            className="p-2.5 border border-green-200 rounded-lg text-sm font-bold bg-green-50 text-green-700" 
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-orange-600 uppercase">{t('settings.label_saturday_pay')}</label>
                        <input 
                            type="number" 
                            step="0.01"
                            required
                            value={newItem.saturdayPay}
                            onChange={(e) => setNewItem({ ...newItem, saturdayPay: e.target.value })}
                            className="p-2.5 border border-orange-200 rounded-lg text-sm font-bold bg-orange-50 text-orange-700" 
                        />
                    </div>
                    <div className="md:col-span-5 flex justify-end gap-2">
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

            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                        <tr>
                            <th className="p-4 pl-6 uppercase tracking-wider text-[10px]">{t('settings.col_concept')}</th>
                            <th className="p-4 uppercase tracking-wider text-[10px]">{t('settings.col_dept')}</th>
                            <th className="p-4 uppercase tracking-wider text-[10px]">{t('settings.col_client_pay')}</th>
                            <th className="p-4 uppercase tracking-wider text-[10px]">{t('settings.col_team_bonus')}</th>
                            <th className="p-4 uppercase tracking-wider text-[10px] text-orange-600">{t('settings.col_saturday')}</th>
                            <th className="p-4 w-16"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {items.length === 0 ? (
                            <tr><td colSpan="5" className="p-10 text-center text-slate-400 italic">{t('settings.no_concepts')}</td></tr>
                        ) : (
                            items.map(item => (
                                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="p-4 pl-6 font-bold text-slate-800">{item.name}</td>
                                    <td className="p-4">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                            item.department === 'ACTIVATION' ? 'bg-green-100 text-green-700' :
                                            item.department === 'BLOWING' ? 'bg-blue-100 text-blue-700' :
                                            item.department === 'FUSION' ? 'bg-purple-100 text-purple-700' :
                                            'bg-indigo-100 text-indigo-700'
                                        }`}>
                                            {item.department}
                                        </span>
                                    </td>
                                    <td className="p-4 font-black text-blue-600">{item.priceToClient.toFixed(2)}€</td>
                                    <td className="p-4 font-black text-green-600">{item.bonusToTeam.toFixed(2)}€</td>
                                    <td className="p-4 font-black text-orange-600">{(item.saturdayPay || 0).toFixed(2)}€</td>
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
