import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { Save, DollarSign, Target, Lock, Truck, Users, Briefcase } from 'lucide-react';

const SettingsPage = () => {
    // Stores the complex financial config
    const [financials, setFinancials] = useState({
        installers: {
            salary: 1500,
            insurance: 330,
            dietasPerDay: 0,
            car: 400,
            gas: 300,
            materials: 100,

            // Revenue Prices (Client pays)
            pricePerUnit: 60,
            pricePerTA: 25,
            pricePerMulti: 35,

            // Bonus Payouts (Team receives)
            bonusPerUnit: 20,
            bonusPerTA: 5,
            bonusPerMulti: 10,

            saturdayRate: 40
        },
        blowers: {
            salary: 1600,
            insurance: 352,
            dietasPerDay: 0,
            car: 400,
            gas: 300,
            materials: 50,
            pricePerUnit: 0.40,
            bonusPerUnit: 0.05,
            saturdayRate: 40
        }
    });

    const [settings, setSettings] = useState({
        // Legacy points points - keep for now as they are used in activation creation
        bpPoints: 10, bp2FamPoints: 15, brMultiPoints: 20,
        sduPoints: 25, mduPoints: 30, spPoints: 5, taPoints: 0.5
    });

    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState(null);
    const [activeTab, setActiveTab] = useState('installers');

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const res = await api.get('/api/settings');
            // Merge existing financials if they exist
            if (res.data.financials) {
                setFinancials(prev => ({
                    ...prev,
                    ...res.data.financials
                }));
            }
            setSettings(res.data);
        } catch (error) {
            console.error('Error fetching settings:', error);
        } finally {
            setLoading(false);
        }
    };

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
        try {
            await api.put('/api/settings', {
                ...settings,
                financials: financials
            });
            setMessage({ type: 'success', text: 'Configuración Financiera Avanzada guardada correctamente' });
        } catch (error) {
            console.error('Settings save error:', error);
            setMessage({ type: 'error', text: 'Error al guardar la configuración' });
        }
    };

    if (loading) return <div className="p-8">Cargando...</div>;

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
                        <h4 className="font-bold text-slate-600 mb-4 flex items-center gap-2"><Users size={18} /> Costes de Personal (Por Persona/Mes)</h4>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase">Salario Base (€)</label>
                                <input type="number" value={data.salary} onChange={(e) => handleFinancialChange(groupKey, 'salary', e.target.value)} className="w-full p-2 border rounded-lg" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase">Seguros Sociales (€)</label>
                                <input type="number" value={data.insurance} onChange={(e) => handleFinancialChange(groupKey, 'insurance', e.target.value)} className="w-full p-2 border rounded-lg" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase">Dietas (por día) (€)</label>
                                <input type="number" value={data.dietasPerDay} onChange={(e) => handleFinancialChange(groupKey, 'dietasPerDay', e.target.value)} className="w-full p-2 border rounded-lg" />
                            </div>
                        </div>
                    </div>

                    {/* Operational Costs */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <h4 className="font-bold text-slate-600 mb-4 flex items-center gap-2"><Truck size={18} /> Gastos Operativos (Por Equipo/Mes)</h4>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase">Coche / Renting (€)</label>
                                <input type="number" value={data.car} onChange={(e) => handleFinancialChange(groupKey, 'car', e.target.value)} className="w-full p-2 border rounded-lg" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase">Combustible (€)</label>
                                <input type="number" value={data.gas} onChange={(e) => handleFinancialChange(groupKey, 'gas', e.target.value)} className="w-full p-2 border rounded-lg" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase">Materiales (€)</label>
                                <input type="number" value={data.materials} onChange={(e) => handleFinancialChange(groupKey, 'materials', e.target.value)} className="w-full p-2 border rounded-lg" />
                            </div>
                        </div>
                    </div>

                    {/* Revenue & Bonus Split Section */}
                    <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">

                        {/* 1. Facturación (Prices) */}
                        <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
                            <h4 className="font-bold text-blue-800 mb-4 flex items-center gap-2"><DollarSign size={18} /> Facturación (Cliente)</h4>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-blue-600 uppercase">Precio Base ({groupKey === 'installers' ? 'Instalación' : 'Metro'})</label>
                                    <input type="number" step="0.01" value={data.pricePerUnit} onChange={(e) => handleFinancialChange(groupKey, 'pricePerUnit', e.target.value)} className="w-full p-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500" />
                                </div>
                                {groupKey === 'installers' && (
                                    <>
                                        <div>
                                            <label className="block text-xs font-bold text-blue-600 uppercase">Precio TA</label>
                                            <input type="number" step="0.01" value={data.pricePerTA || 0} onChange={(e) => handleFinancialChange(groupKey, 'pricePerTA', e.target.value)} className="w-full p-2 border border-blue-200 rounded-lg" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-blue-600 uppercase">Precio Multi</label>
                                            <input type="number" step="0.01" value={data.pricePerMulti || 0} onChange={(e) => handleFinancialChange(groupKey, 'pricePerMulti', e.target.value)} className="w-full p-2 border border-blue-200 rounded-lg" />
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* 2. Bonus (Payouts) */}
                        <div className="bg-green-50 p-4 rounded-xl border border-green-200">
                            <h4 className="font-bold text-green-800 mb-4 flex items-center gap-2"><DollarSign size={18} /> Bonus y Extras (Técnico)</h4>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-green-600 uppercase">Bonus Base ({groupKey === 'installers' ? 'Instalación' : 'Metro'})</label>
                                    <input type="number" step="0.01" value={data.bonusPerUnit} onChange={(e) => handleFinancialChange(groupKey, 'bonusPerUnit', e.target.value)} className="w-full p-2 border border-green-200 rounded-lg focus:ring-2 focus:ring-green-500" />
                                    <p className="text-[10px] text-green-700 mt-1">* Se paga si se supera el Break-even</p>
                                </div>
                                {groupKey === 'installers' && (
                                    <>
                                        <div>
                                            <label className="block text-xs font-bold text-green-600 uppercase">Bonus TA</label>
                                            <input type="number" step="0.01" value={data.bonusPerTA || 0} onChange={(e) => handleFinancialChange(groupKey, 'bonusPerTA', e.target.value)} className="w-full p-2 border border-green-200 rounded-lg" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-green-600 uppercase">Bonus Multi</label>
                                            <input type="number" step="0.01" value={data.bonusPerMulti || 0} onChange={(e) => handleFinancialChange(groupKey, 'bonusPerMulti', e.target.value)} className="w-full p-2 border border-green-200 rounded-lg" />
                                        </div>
                                    </>
                                )}
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase">Tarifa Sábado (Por día)</label>
                                    <input type="number" value={data.saturdayRate} onChange={(e) => handleFinancialChange(groupKey, 'saturdayRate', e.target.value)} className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-500" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="max-w-4xl mx-auto pb-20">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
                <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                    <Briefcase className="text-joa-blue" />
                    Configuración de Rentabilidad
                </h2>

                {message && (
                    <div className={`p-4 rounded-lg mb-6 ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                        {message.text}
                    </div>
                )}

                <p className="text-slate-500 mb-6">
                    Define los costes base y precios de cobro para calcular la rentabilidad real de cada departamento.
                    El "Punto de Equilibrio" (Break-even) se calculará automáticamente con estos datos.
                </p>

                {/* Tabs */}
                <div className="flex gap-2 mb-8 border-b border-slate-200">
                    <button
                        onClick={() => setActiveTab('installers')}
                        className={`px-6 py-3 font-bold border-b-2 transition-colors ${activeTab === 'installers' ? 'border-joa-blue text-joa-blue' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                    >
                        Instaladores (Altas)
                    </button>
                    <button
                        onClick={() => setActiveTab('blowers')}
                        className={`px-6 py-3 font-bold border-b-2 transition-colors ${activeTab === 'blowers' ? 'border-joa-blue text-joa-blue' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                    >
                        Soplado
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    {activeTab === 'installers' && renderFinancialInputs('installers', 'Configuración de Instaladores')}
                    {activeTab === 'blowers' && renderFinancialInputs('blowers', 'Configuración de Soplado / Obra Civil')}

                    {/* Legacy Points Config Hidden */}
                    {/* 
                    <div className="mt-12 pt-8 border-t border-slate-200">
                        <h3 className="font-bold text-slate-500 text-sm uppercase mb-4">Valores de Puntos por Tipo de Activación (Referencia)</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {['bpPoints', 'bp2FamPoints', 'brMultiPoints', 'sduPoints', 'mduPoints', 'spPoints', 'taPoints'].map(key => (
                                <div key={key}>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase">{key}</label>
                                    <input 
                                        type="number" 
                                        step="0.1"
                                        value={settings[key] || 0} 
                                        onChange={(e) => setSettings({...settings, [key]: parseFloat(e.target.value)})}
                                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-sm"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
*/}

                    <div className="pt-8 mt-8 border-t border-slate-100 flex justify-end">
                        <button
                            type="submit"
                            className="bg-joa-blue hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-xl transition-colors flex items-center gap-2 shadow-lg shadow-blue-500/20"
                        >
                            <Save size={20} />
                            Guardar Toda la Configuración
                        </button>
                    </div>
                </form>

                <div className="my-12 border-t border-slate-200"></div>

                <PasswordChangeForm />
            </div>
        </div>
    );
};



const PasswordChangeForm = () => {
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
            setMessage({ type: 'error', text: 'Las nuevas contraseñas no coinciden' });
            return;
        }

        if (passData.newPassword.length < 6) {
            setMessage({ type: 'error', text: 'La contraseña debe tener al menos 6 caracteres' });
            return;
        }

        setLoading(true);
        try {
            await api.post('/api/auth/update-password', {
                currentPassword: passData.currentPassword,
                newPassword: passData.newPassword
            });

            setMessage({ type: 'success', text: 'Contraseña actualizada correctamente' });
            setPassData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        } catch (error) {
            setMessage({ type: 'error', text: error.response?.data?.message || 'Error al actualizar contraseña' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                <Lock className="text-joa-blue" />
                Seguridad
            </h2>

            {message && (
                <div className={`p-4 rounded-lg mb-6 ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {message.text}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6 max-w-lg">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Contraseña Actual</label>
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
                        <label className="block text-sm font-medium text-slate-700 mb-2">Nueva Contraseña</label>
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
                        <label className="block text-sm font-medium text-slate-700 mb-2">Confirmar Nueva Contraseña</label>
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
                        {loading ? 'Actualizando...' : 'Actualizar Contraseña'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default SettingsPage;
