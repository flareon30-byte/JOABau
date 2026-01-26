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

    // Safely derived values for simulator
    const calculateProjectedTotal = (extraUnits) => {
        const unitsDone = stats?.unitsDone || 0;
        const breakEven = stats?.breakEvenUnits || 0;
        const totalUnits = unitsDone + parseFloat(extraUnits || 0);

        const extraAboveBE = Math.max(0, totalUnits - breakEven);

        // Team Bonus Pool
        const bonusPerUnit = financials?.bonusPerUnit || 0;
        const projectedBonusPool = extraAboveBE * bonusPerUnit;

        return projectedBonusPool;
    };

    const projectedTeamBonus = calculateProjectedTotal(simExtraUnits);
    const currentTeamBonus = stats?.bonusPool || 0;
    const teamBonusDiff = projectedTeamBonus - currentTeamBonus;

    // Progress
    const unitsDone = stats?.unitsDone || 0;
    const breakEvenUnits = stats?.breakEvenUnits || 1; // Avoid divide by zero
    const progressPercent = stats?.progressPercent || 0;

    const isGoalMet = unitsDone >= breakEvenUnits;
    const progressColor = isGoalMet ? 'bg-green-500' : 'bg-blue-500';

    // Calculate max value for progress bar (either break even * 1.5 or current units * 1.25 to leave space)
    const maxValue = Math.max(breakEvenUnits * 1.5, unitsDone * 1.25);

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
                        <h3 className={`text-3xl font-bold ${(personal?.myBonusShare || 0) + (personal?.mySaturdayPay || 0) > 0 ? 'text-green-600' : 'text-slate-300'}`}>
                            {money((personal?.myBonusShare || 0) + (personal?.mySaturdayPay || 0))}
                        </h3>
                        <div className="text-xs text-slate-400 mt-2 space-y-0.5">
                            <p>Bonus Producción: {money(personal?.myBonusShare)}</p>
                            <p>Extras Sábados: {money(personal?.mySaturdayPay)}</p>
                        </div>
                    </div>
                </div>

                {/* 3. Total */}
                <div className="bg-gradient-to-br from-joa-blue to-slate-900 p-6 rounded-2xl shadow-xl text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Wallet size={80} />
                    </div>
                    <p className="text-blue-100 text-xs font-bold uppercase tracking-wider mb-1">Total a Percibir</p>
                    <h3 className="text-4xl font-bold text-white mb-2">{money(personal?.totalEstimated)}</h3>
                    <p className="text-xs text-blue-200 opacity-80 border-t border-white/10 pt-2">
                        * Cálculo estimado antes de IRPF
                    </p>
                </div>
            </div>

            {/* Productivity & Goals Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Progress Visualizer */}
                <div className="lg:col-span-2 bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                    <h3 className="font-bold text-slate-700 mb-6 flex items-center gap-2">
                        <Target className={isGoalMet ? 'text-green-500' : 'text-blue-500'} />
                        Objetivo de Producción (Equipo)
                    </h3>

                    {/* The Bar */}
                    <div className="relative pt-6 pb-2">
                        <div className="flex justify-between text-sm font-bold text-slate-600 mb-2">
                            <span>0</span>
                            <span className="text-blue-600">Break-Even (Costes Cubiertos)</span>
                            <span>{maxValue.toFixed(0)}</span>
                        </div>

                        {/* Track */}
                        <div className="h-6 w-full bg-slate-100 rounded-full overflow-hidden relative">
                            {/* Break Even Marker Line */}
                            <div
                                className="absolute top-0 bottom-0 w-1 bg-red-400/50 z-10 border-r border-white/50"
                                style={{ left: `${(breakEvenUnits / maxValue) * 100}%` }}
                                title={`Objetivo: ${breakEvenUnits}`}
                            ></div>

                            {/* Fill */}
                            <div
                                className={`h-full rounded-full transition-all duration-1000 ease-out flex items-center justify-end pr-2 ${progressColor} shadow-lg shadow-blue-500/30`}
                                style={{ width: `${Math.min(100, (unitsDone / maxValue) * 100)}%` }}
                            >
                                <span className="text-[10px] font-bold text-white tabular-nums">
                                    {unitsDone} / {breakEvenUnits}
                                </span>
                            </div>
                        </div>

                        {/* Legend */}
                        <div className="flex justify-between mt-4">
                            <div className="text-center">
                                <p className="text-xs text-slate-400 uppercase font-bold">Hecho</p>
                                <p className="text-2xl font-bold text-slate-700">{unitsDone}</p>
                                <p className="text-xs text-slate-400">Unidades</p>
                            </div>
                            <div className="text-center">
                                <p className="text-xs text-slate-400 uppercase font-bold">Objetivo</p>
                                <p className="text-2xl font-bold text-blue-600">{breakEvenUnits}</p>
                                <p className="text-xs text-slate-400">Para cubrir costes</p>
                            </div>
                            <div className="text-center">
                                <p className="text-xs text-slate-400 uppercase font-bold">Progreso</p>
                                <p className={`text-2xl font-bold ${isGoalMet ? 'text-green-500' : 'text-orange-500'}`}>
                                    {progressPercent.toFixed(0)}%
                                </p>
                            </div>
                        </div>

                        {!isGoalMet ? (
                            <div className="mt-6 bg-orange-50 text-orange-700 text-sm p-3 rounded-lg flex items-center gap-2">
                                <AlertCircle size={16} />
                                Faltan <strong>{breakEvenUnits - unitsDone} unidades</strong> para empezar a generar bonus.
                            </div>
                        ) : (
                            <div className="mt-6 bg-green-50 text-green-700 text-sm p-3 rounded-lg flex items-center gap-2">
                                <CheckCircle size={16} />
                                ¡Objetivo cumplido! Cada unidad extra suma <strong>{money(financials?.bonusPerUnit)}</strong> al bonus del equipo.
                            </div>
                        )}
                    </div>
                </div>

                {/* Financial Details (Mini) */}
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4">
                    <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                        <DollarSign size={18} /> Estado Financiero
                    </h3>

                    <div className="flex justify-between items-center p-3 bg-white rounded-xl border border-slate-100">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-red-50 text-red-500 rounded-lg"><Users size={16} /></div>
                            <span className="text-sm text-slate-600">Costes Personal</span>
                        </div>
                        <span className="font-bold text-slate-700">{money(stats?.details?.salaryCost)}</span>
                    </div>

                    <div className="flex justify-between items-center p-3 bg-white rounded-xl border border-slate-100">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-red-50 text-red-500 rounded-lg"><Truck size={16} /></div>
                            <span className="text-sm text-slate-600">Gastos Operativos</span>
                        </div>
                        <span className="font-bold text-slate-700">{money(stats?.details?.opCost)}</span>
                    </div>

                    <div className="border-t border-slate-200 my-2"></div>

                    <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-400 uppercase">Coste Total Equipo</span>
                        <span className="font-bold text-red-400">-{money(stats?.totalCost)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-400 uppercase">Facturación Actual</span>
                        <span className="font-bold text-blue-600">{money(stats?.totalRevenue)}</span>
                    </div>
                </div>
            </div>

            {/* Production Breakdown */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                    <CheckCircle className="text-joa-blue" size={20} /> Detalle de Producción
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-center">
                        <p className="text-xs font-bold text-slate-400 uppercase mb-1">Básicas (BP)</p>
                        <p className="text-2xl font-bold text-slate-700">{stats?.counts?.bp || 0}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-center">
                        <p className="text-xs font-bold text-slate-400 uppercase mb-1">TA (SDU)</p>
                        <p className="text-2xl font-bold text-slate-700">{stats?.counts?.ta || 0}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-center">
                        <p className="text-xs font-bold text-slate-400 uppercase mb-1">Multi (BR)</p>
                        <p className="text-2xl font-bold text-slate-700">{stats?.counts?.multi || 0}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-center">
                        <p className="text-xs font-bold text-slate-400 uppercase mb-1">MDU</p>
                        <p className="text-2xl font-bold text-slate-700">{stats?.counts?.mdu || 0}</p>
                    </div>
                </div>
            </div>

            {/* Simulator */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                    <Calculator className="text-slate-400" />
                    <h3 className="font-bold text-slate-800">Simulador de Bonus</h3>
                </div>
                <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-4">
                            Si el equipo hace <span className="text-joa-blue font-bold text-lg">{simExtraUnits}</span> unidades extra...
                        </label>
                        <input
                            type="range"
                            min="0"
                            max="50"
                            step="1"
                            value={simExtraUnits}
                            onChange={(e) => setSimExtraUnits(parseInt(e.target.value))}
                            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-joa-blue"
                        />
                        <div className="flex justify-between text-xs text-slate-400 mt-2 font-medium">
                            <span>0</span>
                            <span>+25</span>
                            <span>+50</span>
                        </div>
                    </div>

                    <div className="text-center bg-blue-50/50 p-6 rounded-2xl border border-blue-100">
                        <p className="text-slate-500 text-sm font-medium mb-1">El Bonus del Equipo aumentaría en:</p>
                        <p className="text-4xl font-bold text-joa-blue transition-all duration-300">
                            +{money(teamBonusDiff)}
                        </p>
                        <p className="text-xs text-blue-400 mt-2">
                            A repartir entre todos los miembros
                        </p>
                    </div>
                </div>
            </div>

            <div className="text-center text-slate-400 text-xs mt-10">
                <p>Datos sincronizados con la configuración de rentabilidad de la empresa.</p>
            </div>
        </div>
    );
};

export default MyEarningsPage;
