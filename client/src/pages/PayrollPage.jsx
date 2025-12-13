import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { Calendar, Euro, Users, Download, Filter, Search } from 'lucide-react';


const PayrollPage = () => {
    // Current Month Range Default
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

    const [filters, setFilters] = useState({
        startDate: firstDay,
        endDate: lastDay
    });

    const [summary, setSummary] = useState([]);
    const [prices, setPrices] = useState({ weekday: 0, saturday: 0 });
    const [loading, setLoading] = useState(false);
    const [showMoney, setShowMoney] = useState(false); // Toggle Points/Euros

    useEffect(() => {
        fetchPayrollData();
    }, [filters]);

    const fetchPayrollData = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filters.startDate) params.append('startDate', filters.startDate);
            if (filters.endDate) params.append('endDate', filters.endDate);

            const res = await api.get(`/api/payroll/summary?${params.toString()}`);
            setSummary(res.data.data);
            setPrices(res.data.meta.prices);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    // Helper formatter
    const money = (val) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(val);

    return (
        <div className="max-w-7xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Users className="text-green-600" /> Nóminas y Puntos
                    </h2>
                    <p className="text-slate-500 text-sm">Resumen de puntos acumulados por técnico/equipo para el pago de nóminas.</p>
                </div>

                <div className="flex items-center gap-4 bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
                    <span className={`text-sm font-bold ${!showMoney ? 'text-blue-600' : 'text-slate-400'}`}>Puntos</span>
                    <button
                        onClick={() => setShowMoney(!showMoney)}
                        className={`w-12 h-6 rounded-full p-1 transition-colors ${showMoney ? 'bg-green-500' : 'bg-slate-300'} relative`}
                    >
                        <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${showMoney ? 'translate-x-6' : 'translate-x-0'}`} />
                    </button>
                    <span className={`text-sm font-bold ${showMoney ? 'text-green-600' : 'text-slate-400'}`}>Euros (€)</span>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Desde</label>
                    <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="date"
                            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-green-500 bg-slate-50"
                            value={filters.startDate}
                            onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                        />
                    </div>
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Hasta</label>
                    <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="date"
                            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-green-500 bg-slate-50"
                            value={filters.endDate}
                            onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                        />
                    </div>
                </div>
            </div>

            {/* Content */}
            {loading ? (
                <div className="text-center py-12 text-slate-500">Cargando datos...</div>
            ) : summary.length === 0 ? (
                <div className="text-center py-12 text-slate-500 bg-slate-50 rounded-2xl border border-slate-200">
                    No hay datos en este rango de fechas.
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {summary.map(item => (
                        <div key={item.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-all">
                            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                                <h3 className="text-lg font-bold text-slate-800">{item.name}</h3>
                                <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                                    <Users size={14} />
                                    <span className="truncate" title={item.members}>{item.members}</span>
                                </div>
                            </div>

                            <div className="p-6 space-y-4">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-slate-500">Lunes - Viernes</span>
                                    <span className="font-medium text-slate-800">
                                        {showMoney ? money(item.weekdayMoney) : `${item.weekdayPoints.toFixed(1)} pts`}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-slate-500">Sábados</span>
                                    <span className={`font-medium ${item.saturdayPoints > 0 ? 'text-blue-600' : 'text-slate-800'}`}>
                                        {showMoney ? money(item.saturdayMoney) : `${item.saturdayPoints.toFixed(1)} pts`}
                                    </span>
                                </div>
                                <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                                    <span className="font-bold text-slate-700 uppercase text-sm">Total</span>
                                    <span className={`text-xl font-bold ${showMoney ? 'text-green-600' : 'text-purple-600'}`}>
                                        {showMoney ? money(item.totalMoney) : item.totalPoints.toFixed(1)}
                                    </span>
                                </div>
                            </div>
                            {!showMoney && (
                                <div className="bg-slate-50 px-6 py-2 text-xs text-slate-400 border-t border-slate-100 text-right">
                                    1 pt L-V = {money(prices.weekday)} | 1 pt SAB = {money(prices.saturday)}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default PayrollPage;
