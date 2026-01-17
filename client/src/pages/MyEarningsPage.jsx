import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { Wallet, TrendingUp, Calendar, AlertCircle, Calculator } from 'lucide-react';

const MyEarningsPage = () => {
    const [stats, setStats] = useState(null);
    const [meta, setMeta] = useState(null);
    const [loading, setLoading] = useState(true);

    // Simulation State
    const [simPoints, setSimPoints] = useState(0);
    const [simSatPoints, setSimSatPoints] = useState(0);

    useEffect(() => {
        fetchMyEarnings();
    }, []);

    const fetchMyEarnings = async () => {
        try {
            const res = await api.get('/api/payroll/my-summary');
            setStats(res.data.stats);
            setMeta(res.data.meta);
        } catch (error) {
            console.error('Error fetching earnings:', error);
        } finally {
            setLoading(false);
        }
    };

    const money = (val) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(val);

    if (loading) return <div className="p-8 text-center text-slate-500">Cargando datos financieros...</div>;
    if (!stats || !meta) return <div className="p-8 text-center text-red-500">No se pudieron cargar los datos. Asegúrate de estar asignado a un equipo.</div>;

    // Calculation Helper
    const calculateTotal = (extraP, extraSatP) => {
        const currentLV = stats.weekdayPoints;
        const currentSat = stats.saturdayPoints;

        const totalLV = currentLV + parseFloat(extraP || 0);
        const totalSat = currentSat + parseFloat(extraSatP || 0);

        const target = stats.target;
        const bonusPoints = Math.max(0, totalLV - target);

        const moneyLV = bonusPoints * meta.prices.weekday;
        const moneySat = totalSat * meta.prices.saturday;

        return moneyLV + moneySat;
    };

    const currentTotal = calculateTotal(0, 0);
    const projectedTotal = calculateTotal(simPoints, simSatPoints);
    const difference = projectedTotal - currentTotal;

    const progressPercent = Math.min(100, (stats.weekdayPoints / stats.target) * 100);

    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-20">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <Wallet className="text-green-600" /> Mis Ganancias (Estimación)
                </h2>
                <p className="text-slate-500 text-sm">Resumen de puntos y bonus acumulados este mes.</p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* L-V Performance */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <p className="text-slate-500 text-xs font-bold uppercase">Puntos Lunes-Viernes</p>
                            <h3 className="text-3xl font-bold text-slate-800 mt-1">{stats.weekdayPoints.toFixed(1)}</h3>
                        </div>
                        <div className={`p-2 rounded-lg ${stats.weekdayPoints >= stats.target ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}`}>
                            <TrendingUp size={20} />
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-2">
                        <div className="flex justify-between text-xs font-medium text-slate-500">
                            <span>Progreso Meta</span>
                            <span>{stats.target} pts</span>
                        </div>
                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-1000 ${stats.weekdayPoints >= stats.target ? 'bg-green-500' : 'bg-orange-400'}`}
                                style={{ width: `${progressPercent}%` }}
                            ></div>
                        </div>
                        {stats.weekdayPoints < stats.target && (
                            <p className="text-xs text-orange-500 mt-1 flex items-center gap-1">
                                <AlertCircle size={12} />
                                Faltan {(stats.target - stats.weekdayPoints).toFixed(1)} pts para bonus
                            </p>
                        )}
                    </div>
                </div>

                {/* Saturdays */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <p className="text-slate-500 text-xs font-bold uppercase">Puntos Sábados</p>
                            <h3 className="text-3xl font-bold text-blue-600 mt-1">{stats.saturdayPoints.toFixed(1)}</h3>
                        </div>
                        <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                            <Calendar size={20} />
                        </div>
                    </div>
                    <div className="text-sm text-slate-500">
                        <p>Valor Sábado: <span className="font-bold text-slate-700">{money(meta.prices.saturday)} / pt</span></p>
                        <p className="mt-1 text-green-600 font-bold">Total: {money(stats.saturdayMoney)}</p>
                    </div>
                </div>

                {/* Total Money */}
                <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-2xl shadow-lg text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-10">
                        <Wallet size={100} />
                    </div>
                    <p className="text-slate-300 text-xs font-bold uppercase mb-1">Bonus Variable Acumulado</p>
                    <h3 className="text-4xl font-bold text-white mb-4">{money(currentTotal)}</h3>

                    <div className="text-xs text-slate-400 border-t border-slate-700/50 pt-3">
                        <p>Precio Bonus L-V: {money(meta.prices.weekday)}</p>
                        <p>Precio Sábado: {money(meta.prices.saturday)}</p>
                    </div>
                </div>
            </div>

            {/* Calculator / Simulator */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                    <Calculator className="text-joa-blue" />
                    <h3 className="font-bold text-slate-800">Simuladora de Puntos</h3>
                </div>

                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                    <div className="space-y-4">
                        <p className="text-sm text-slate-600">
                            Añade puntos hipotéticos para ver cuánto aumentarían tus ganancias a final de mes.
                        </p>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Puntos Extra L-V</label>
                            <input
                                type="number"
                                min="0"
                                value={simPoints}
                                onChange={(e) => setSimPoints(e.target.value)}
                                className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-joa-blue outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Puntos Extra Sábados</label>
                            <input
                                type="number"
                                min="0"
                                value={simSatPoints}
                                onChange={(e) => setSimSatPoints(e.target.value)}
                                className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-joa-blue outline-none"
                            />
                        </div>
                    </div>

                    <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 text-center space-y-2">
                        <p className="text-slate-500 font-medium">Proyección Total</p>
                        <p className="text-4xl font-bold text-slate-800">{money(projectedTotal)}</p>

                        {difference > 0 && (
                            <div className="inline-block bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-bold animate-pulse">
                                +{money(difference)} extra
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MyEarningsPage;
