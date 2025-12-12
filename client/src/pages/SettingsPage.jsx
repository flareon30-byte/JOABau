import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { Save, DollarSign, Target, Lock } from 'lucide-react';

const SettingsPage = () => {
    const [settings, setSettings] = useState({
        extraPointPrice: 0,
        saturdayPointPrice: 0,
        monthlyTargetPoints: 100
    });
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState(null);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const res = await api.get('/api/settings');
            setSettings(res.data);
        } catch (error) {
            console.error('Error fetching settings:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage(null);
        try {
            await api.put('/api/settings', settings);
            setMessage({ type: 'success', text: 'Configuración guardada correctamente' });
        } catch (error) {
            console.error('Settings save error:', error);
            const serverMsg = error.response?.data?.message;
            const status = error.response?.status;
            const fallback = error.message;
            setMessage({
                type: 'error',
                text: `Error (${status || '?'}) al guardar: ${serverMsg || fallback}`
            });
        }
    };

    if (loading) return <div className="p-8">Cargando...</div>;

    return (
        <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
                <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                    <DollarSign className="text-joa-blue" />
                    Configuración Financiera
                </h2>

                {message && (
                    <div className={`p-4 rounded-lg mb-6 ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                        {message.text}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Objetivo Mensual de Puntos (Activaciones)
                        </label>
                        <div className="relative">
                            <Target className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                            <input
                                type="number"
                                value={settings.monthlyTargetPoints ?? ''}
                                onChange={(e) => setSettings({ ...settings, monthlyTargetPoints: e.target.value })}
                                className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-joa-blue outline-none"
                                required
                            />
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Puntos necesarios para activar la paga extra.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Precio por Punto Extra (€)
                            </label>
                            <div className="relative">
                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                                <input
                                    type="number"
                                    step="0.01"
                                    value={settings.extraPointPrice ?? ''}
                                    onChange={(e) => setSettings({ ...settings, extraPointPrice: e.target.value })}
                                    className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-joa-blue outline-none"
                                    required
                                />
                            </div>
                            <p className="text-xs text-slate-500 mt-1">Se aplica a puntos por encima del objetivo.</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Precio por Punto Sábado (€)
                            </label>
                            <div className="relative">
                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                                <input
                                    type="number"
                                    step="0.01"
                                    value={settings.saturdayPointPrice ?? ''}
                                    onChange={(e) => setSettings({ ...settings, saturdayPointPrice: e.target.value })}
                                    className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-joa-blue outline-none"
                                    required
                                />
                            </div>
                            <p className="text-xs text-slate-500 mt-1">Se aplica a todas las activaciones en sábado.</p>
                        </div>
                    </div>

                    <h3 className="font-bold text-slate-800 pt-4 border-t border-slate-100">Valores de Puntos por Tipo</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {[
                            { label: 'BP (Básico)', key: 'bpPoints' },
                            { label: 'BP 2 Familias', key: 'bp2FamPoints' },
                            { label: 'BR Multi', key: 'brMultiPoints' },
                            { label: 'SDU / TA', key: 'sduPoints' },
                            { label: 'MDU', key: 'mduPoints' },
                            { label: 'SP (cada uno)', key: 'spPoints' },
                        ].map(field => (
                            <div key={field.key}>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    {field.label}
                                </label>
                                <div className="relative">
                                    <Target className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={settings[field.key] ?? ''}
                                        onChange={(e) => setSettings({ ...settings, [field.key]: e.target.value })}
                                        className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-joa-blue outline-none"
                                        required
                                    />
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="pt-4">
                        <button
                            type="submit"
                            className="w-full bg-joa-blue hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                        >
                            <Save size={20} />
                            Guardar Configuración Financiera
                        </button>
                    </div>
                </form>

                <div className="my-8 border-t border-slate-200"></div>

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

            <form onSubmit={handleSubmit} className="space-y-6">
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
