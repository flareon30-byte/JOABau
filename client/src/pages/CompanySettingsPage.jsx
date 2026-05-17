import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { Building2, Save, Mail, Phone, MapPin, CreditCard, Image as ImageIcon, Loader } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const CompanySettingsPage = () => {
    const { t } = useTranslation();
    const [settings, setSettings] = useState({
        name: '',
        taxId: '',
        address: '',
        phone: '',
        email: '',
        bankDetails: '',
        logoPath: ''
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const fetchSettings = async () => {
        try {
            const { data } = await api.get('/api/company');
            if (data) {
                if (data.logoPath && !data.logoPath.startsWith('http') && !data.logoPath.startsWith('data:')) {
                    let baseUrl = api.defaults.baseURL || '';
                    if (baseUrl === '/') baseUrl = '';
                    const cleanPath = data.logoPath.startsWith('/') ? data.logoPath : `/${data.logoPath}`;
                    data.logoPath = `${baseUrl}${cleanPath}${cleanPath.includes('?') ? '&' : '?'}v=${Date.now()}`;
                }
                setSettings(data);
            }
        } catch (error) {
            console.error('Error fetching settings', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSettings();
    }, []);

    const handleChange = (e) => {
        setSettings({ ...settings, [e.target.name]: e.target.value });
    };

    const handleLogoUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = async () => {
            setSettings({ ...settings, logoPath: reader.result }); // Preview
        };
        reader.readAsDataURL(file);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const res = await api.post('/api/company', settings);
            if (res.data) {
                const newPath = res.data.logoPath;
                if (newPath && !newPath.startsWith('http') && !newPath.startsWith('data:')) {
                    let baseUrl = api.defaults.baseURL || '';
                    if (baseUrl === '/') baseUrl = '';
                    const cleanPath = newPath.startsWith('/') ? newPath : `/${newPath}`;
                    res.data.logoPath = `${baseUrl}${cleanPath}?v=${Date.now()}`;
                }
                setSettings(res.data);
            }
            alert(t('company.success_save'));
        } catch (error) {
            alert(t('company.error_save'));
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="flex justify-center p-10"><Loader className="animate-spin text-joa-blue" /></div>;

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-white rounded-3xl p-8 shadow-xl shadow-slate-200/50 border border-slate-100">
                <div className="flex items-center gap-4 mb-8">
                    <div className="bg-blue-600 p-4 rounded-2xl text-white shadow-lg shadow-blue-200">
                        <Building2 size={32} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-slate-800">{t('company.title')}</h2>
                        <p className="text-slate-500">{t('company.subtitle')}</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Basic Info */}
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-black text-slate-400 uppercase mb-2">{t('company.label_name')}</label>
                            <input 
                                name="name"
                                value={settings.name}
                                onChange={handleChange}
                                className="w-full bg-slate-50 border-none rounded-xl p-3 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-black text-slate-400 uppercase mb-2">{t('company.label_tax_id')}</label>
                            <div className="relative">
                                <input 
                                    name="taxId"
                                    value={settings.taxId}
                                    onChange={handleChange}
                                    placeholder={t('company.placeholder_tax_id')}
                                    className="w-full bg-slate-50 border-none rounded-xl p-3 pl-10 font-bold text-slate-700 outline-none"
                                />
                                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-black text-slate-400 uppercase mb-2">{t('company.label_city')}</label>
                            <input 
                                name="city"
                                value={settings.city || ''}
                                onChange={handleChange}
                                className="w-full bg-slate-50 border-none rounded-xl p-3 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-black text-slate-400 uppercase mb-2">{t('company.label_country')}</label>
                            <select 
                                name="country"
                                value={settings.country || 'ES'}
                                onChange={handleChange}
                                className="w-full bg-slate-50 border-none rounded-xl p-3 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 shadow-inner"
                            >
                                <option value="ES">{t('company.country_es')}</option>
                                <option value="DE">{t('company.country_de')}</option>
                            </select>
                            <p className="text-[10px] text-slate-500 mt-1 font-bold italic">{t('company.hint_country')}</p>
                        </div>
                        <div className="md:col-span-2">
                             <label className="block text-xs font-black text-slate-400 uppercase mb-2">{t('company.label_address')}</label>
                             <textarea 
                                name="address"
                                value={settings.address || ''}
                                onChange={handleChange}
                                rows="2"
                                className="w-full bg-slate-50 border-none rounded-xl p-3 font-bold text-slate-700 outline-none shadow-inner"
                            />
                        </div>
                    </div>

                    {/* Logo & Contact */}
                    <div className="space-y-4">
                        <div className="bg-slate-50 p-6 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center relative overflow-hidden group">
                            {settings.logoPath ? (
                                <img src={settings.logoPath} alt="Logo" className="h-32 object-contain" />
                            ) : (
                                <div className="text-center text-slate-400">
                                    <ImageIcon size={40} className="mx-auto mb-2" />
                                    <p className="text-xs font-bold uppercase">{t('company.label_logo')}</p>
                                </div>
                            )}
                            <input 
                                type="file" 
                                accept="image/*" 
                                className="absolute inset-0 opacity-0 cursor-pointer" 
                                onChange={handleLogoUpload}
                            />
                            <div className="absolute inset-0 bg-blue-600/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none flex items-center justify-center">
                                <p className="bg-white px-4 py-2 rounded-full text-xs font-black text-blue-600 shadow-xl uppercase">{t('company.change_logo')}</p>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-black text-slate-400 uppercase mb-2">{t('company.label_email')}</label>
                            <div className="relative">
                                <input 
                                    name="email"
                                    value={settings.email}
                                    onChange={handleChange}
                                    className="w-full bg-slate-50 border-none rounded-xl p-3 pl-10 font-bold text-slate-700 outline-none"
                                />
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-black text-slate-400 uppercase mb-2">{t('company.label_phone')}</label>
                            <div className="relative">
                                <input 
                                    name="phone"
                                    value={settings.phone}
                                    onChange={handleChange}
                                    className="w-full bg-slate-50 border-none rounded-xl p-3 pl-10 font-bold text-slate-700 outline-none"
                                />
                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                            </div>
                        </div>
                    </div>

                    <div className="md:col-span-2">
                        <label className="block text-xs font-black text-slate-400 uppercase mb-2">{t('company.label_bank')}</label>
                        <div className="relative">
                            <input 
                                name="bankDetails"
                                value={settings.bankDetails}
                                onChange={handleChange}
                                placeholder={t('company.placeholder_bank')}
                                className="w-full bg-blue-50/50 border-2 border-blue-100 rounded-xl p-4 font-black text-blue-900 outline-none"
                            />
                            <CreditCard className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-300" size={24} />
                        </div>
                    </div>

                    <button 
                        type="submit"
                        disabled={saving}
                        className="md:col-span-2 py-4 bg-slate-800 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-slate-900 transition-all shadow-xl shadow-slate-200 flex items-center justify-center gap-3"
                    >
                        {saving ? <Loader className="animate-spin" /> : <Save size={20} />}
                        {saving ? t('company.btn_saving') : t('company.btn_save')}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default CompanySettingsPage;
