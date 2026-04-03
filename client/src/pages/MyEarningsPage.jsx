import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { Wallet, TrendingUp, Calendar, AlertCircle, Calculator, CheckCircle, Target, DollarSign, Truck, Users } from 'lucide-react';

const MyEarningsPage = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    // Simulation State
    const [simExtraUnits, setSimExtraUnits] = useState(0);

    useEffect(() => {
        fetchMyEarnings();
    }, []);

    const fetchMyEarnings = async () => {
        try {
            const res = await api.get('/api/payroll/my-summary');
            setData(res.data);
        } catch (error) {
            console.error('Error fetching earnings:', error);
        } finally {
            setLoading(false);
        }
    };

    const money = (val) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(val || 0);

    if (loading) return <div className="p-8 text-center text-slate-500">Cargando datos financieros...</div>;

    // Safety check: Data fetch failed completely or returned nothing
    if (!data) return <div className="p-8 text-center text-red-500">No se pudieron cargar los datos.</div>;

    const { stats, personal, financials } = data;

    // Special View for Back Office
    if (data.role === 'BACK_OFFICE') {
        const { metrics } = data;
        const revenue = metrics?.revenueGenerated || 0;
        const appts = metrics?.appointmentsDone || 0;
        const target = metrics?.targetDaily || 15;
        // Asuming we count monthly appointments in appts, let's just show Monthly Progress
        // or simplistic view.

        return (
            <div className="max-w-5xl mx-auto space-y-8 pb-20 animate-fadeIn">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                            <Wallet className="text-joa-blue" /> Mis Ganancias
                        </h2>
                        <p className="text-slate-500 text-sm">Back Office - Rendimiento Personal</p>
                    </div>
                    <div className="bg-slate-800 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg">
                        {new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                    </div>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* 1. Base Salary */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                        <div className="relative">
                            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Sueldo Base</p>
                            <h3 className="text-3xl font-bold text-slate-800">{money(data.baseSalary)}</h3>
                            <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                                <CheckCircle size={12} className="text-green-500" /> Garantizado
                            </p>
                        </div>
                    </div>

                    {/* 2. Revenue */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-green-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                        <div className="relative">
                            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Ingresos Generados</p>
                            <h3 className="text-3xl font-bold text-green-600">{money(revenue)}</h3>
                            <p className="text-xs text-slate-400 mt-2">
                                Valor aportado a la empresa
                            </p>
                        </div>
                    </div>

                    {/* 3. Citas */}
                    <div className="bg-blue-600 p-6 rounded-2xl shadow-xl text-white relative overflow-hidden">
                        <div className="relative">
                            <p className="text-blue-200 text-xs font-bold uppercase tracking-wider mb-1">Citas Agendadas</p>
                            <h3 className="text-4xl font-bold text-white">{appts}</h3>
                            <p className="text-xs text-blue-100 opacity-80 mt-2">
                                En este periodo
                            </p>
                        </div>
                    </div>
                </div>

                {/* Metrics Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                        <h3 className="font-bold text-slate-700 mb-6 flex items-center gap-2">
                            <Target className="text-green-500" />
                            Rendimiento de Citas
                        </h3>

                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-bold text-slate-600">Total Periodo</span>
                            <span className="text-2xl font-bold text-slate-800">{appts}</span>
                        </div>
                        <div className="w-full bg-slate-100 h-4 rounded-full overflow-hidden">
                            <div className="bg-green-500 h-full rounded-full" style={{ width: `${Math.min(100, (appts / (target * 20)) * 100)}%` }}></div>
                        </div>
                        <p className="text-xs text-slate-400 mt-2 text-right">Objetivo aprox. mensual: {target * 20} (Ref)</p>
                    </div>

                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                        <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                            <DollarSign size={18} /> Resumen Rentabilidad
                        </h3>
                        <div className="space-y-3">
                            <div className="flex justify-between">
                                <span className="text-sm text-slate-500">Coste Empresa (Est.)</span>
                                <span className="font-bold text-slate-700">{money(data.financials.total * 1.30)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-sm text-slate-500">Ingresos Generados</span>
                                <span className="font-bold text-green-600">{money(revenue)}</span>
                            </div>
                            <div className="border-t border-slate-200 pt-2 flex justify-between">
                                <span className="font-bold text-slate-700">Balance</span>
                                <span className={`font-bold ${revenue - (data.financials.total * 1.3) > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                    {money(revenue - (data.financials.total * 1.30))}
                                </span>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-2">* Coste estimado incluye SS y gastos operativos básicos.</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Individual Profitability Stats
    const myCurrentRevenue = stats?.myCurrentRevenue || 0;
    const myTargetRevenue = stats?.myTargetRevenue || 0;
    const progressPercent = Math.min(stats?.myProgressPercent || 0, 100);
    const accumulatedBonus = personal?.myBonusShare || 0;

    const isGoalMet = progressPercent >= 100;
    const progressColor = isGoalMet ? 'bg-green-500' : 'bg-blue-500';

    return (
        <div className="max-w-5xl mx-auto space-y-8 pb-20 animate-fadeIn">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Wallet className="text-joa-blue" /> Mis Ganancias
                    </h2>
                    <p className="text-slate-500 text-sm">{stats?.teamName || 'Mi Equipo'} - Cálculo de Rentabilidad Real</p>
                </div>
                <div className="bg-slate-800 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg">
                    {new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                </div>
            </div>

            {/* Top Cards: Personal Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* 1. Base Salary */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                    <div className="relative">
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Sueldo Base (Fijo)</p>
                        <h3 className="text-3xl font-bold text-slate-800">{money(personal?.baseSalary)}</h3>
                        <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                            <CheckCircle size={12} className="text-green-500" /> Garantizado
                        </p>
                    </div>
                </div>

                {/* 2. Variable (Bonus + Saturday) */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-green-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                    <div className="relative">
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Variable (Estimado)</p>
                        <h3 className={`text-3xl font-bold ${accumulatedBonus + (personal?.mySaturdayPay || 0) > 0 ? 'text-green-600' : 'text-slate-300'}`}>
                            {money(accumulatedBonus + (personal?.mySaturdayPay || 0))}
                        </h3>
                        <div className="text-xs text-slate-400 mt-2 space-y-0.5">
                            <p>Bonus Producción: {money(accumulatedBonus)}</p>
                            <p>Extras Sábados: {money(personal?.mySaturdayPay)}</p>
                        </div>
                    </div>
                </div>

                {/* 3. Total Percibir */}
                <div className="bg-blue-600 p-6 rounded-2xl shadow-xl text-white relative overflow-hidden group">
                    <div className="absolute top-1/2 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                    <div className="relative">
                        <p className="text-blue-200 text-xs font-bold uppercase tracking-wider mb-1">Total a Percibir</p>
                        <h3 className="text-4xl font-bold text-white">{money(personal?.totalEstimated)}</h3>
                        <p className="text-xs text-blue-100 opacity-80 mt-2">
                            * Cálculo estimado antes de IRPF
                        </p>
                    </div>
                </div>
            </div>

            {/* Profitability Progress: Revenue Goal */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                        <div className="flex items-center gap-3">
                            <div className={`p-3 rounded-xl ${isGoalMet ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'}`}>
                                <TrendingUp size={24} />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg text-slate-700">Objetivo de Rentabilidad (Individual)</h3>
                                <p className="text-sm text-slate-500">Saldo generado para cubrir tus gastos y cobrar extras</p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="flex justify-between items-end">
                            <div className="space-y-1">
                                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Progreso Actual</p>
                                <p className="text-2xl font-black text-slate-800">{Math.round(progressPercent)}%</p>
                            </div>
                            <div className="text-right space-y-1">
                                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Meta del Mes</p>
                                <p className="text-xs font-bold text-blue-600">
                                    {isGoalMet ? '¡Objetivo Superado!' : `Falta un ${Math.max(0, 100 - Math.round(progressPercent))}% para Bonus`}
                                </p>
                            </div>
                        </div>

                        <div className="relative h-6 w-full bg-slate-100 rounded-2xl overflow-hidden shadow-inner p-1">
                            <div 
                                className={`h-full rounded-xl transition-all duration-1000 shadow-lg ${isGoalMet ? 'bg-gradient-to-r from-green-500 to-emerald-400' : 'bg-gradient-to-r from-blue-500 to-sky-400'}`}
                                style={{ width: `${progressPercent}%` }}
                            >
                                <div className="h-full flex items-center justify-end px-3">
                                    <span className="text-[10px] font-black text-white">{Math.round(progressPercent)}%</span>
                                </div>
                            </div>
                        </div>

                        {!isGoalMet ? (
                            <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex items-center gap-3 text-slate-600">
                                <AlertCircle size={20} />
                                <p className="text-sm font-bold">Has cubierto un {Math.round(progressPercent)}% de tus gastos mensuales para empezar a cobrar extras.</p>
                            </div>
                        ) : (
                            <div className="bg-green-50 border border-green-100 p-4 rounded-xl flex items-center gap-3 text-green-800 animate-fadeIn">
                                <CheckCircle size={20} />
                                <p className="text-sm font-bold">¡Enhorabuena! Has llegado al 100%. A partir de aquí todo el valor que generes suma bonus extra.</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="lg:col-span-3">
                    {/* Detailed financial cost breakdown removed for technician privacy */}
                </div>
            </div>

            {/* Production Details */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                    <Target className="text-joa-blue" size={20} /> Detalle de Mi Producción (Unidades)
                </h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-center">
                        <p className="text-xs font-bold text-slate-400 uppercase mb-1">Básicas (BP)</p>
                        <p className="text-2xl font-bold text-slate-700">{stats?.counts?.bp || 0}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-center">
                        <p className="text-xs font-bold text-slate-400 uppercase mb-1">TA (SDU)</p>
                        <p className="text-2xl font-bold text-slate-700">{stats?.counts?.ta || 0}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-center">
                        <p className="text-xs font-bold text-slate-400 uppercase mb-1">SP Instalados</p>
                        <p className="text-2xl font-bold text-slate-700">{stats?.counts?.sp || 0}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-center">
                        <p className="text-xs font-bold text-slate-400 uppercase mb-1">MDU</p>
                        <p className="text-2xl font-bold text-slate-700">{stats?.counts?.mdu || 0}</p>
                    </div>
                </div>
            </div>

            <div className="text-center text-slate-400 text-xs mt-10">
                <p>Datos calculados en tiempo real según la rentabilidad de cada servicio realizado.</p>
            </div>
        </div>
    );
};

export default MyEarningsPage;
