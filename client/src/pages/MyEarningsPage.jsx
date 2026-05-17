import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { Wallet, TrendingUp, Calendar, AlertCircle, Calculator, CheckCircle, Target, DollarSign, Truck, Users, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const MyEarningsPage = () => {
    const { t } = useTranslation();
    const [data, setData] = useState(null);
    const [history, setHistory] = useState([]);
    const [showHistory, setShowHistory] = useState(false);
    const [showDietaCalendar, setShowDietaCalendar] = useState(false);
    const [loading, setLoading] = useState(true);
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    // Simulation State
    const [simExtraUnits, setSimExtraUnits] = useState(0);

    useEffect(() => {
        fetchMyEarnings();
        fetchHistory();
    }, []);

    const fetchHistory = async () => {
        try {
            const res = await api.get('/api/payroll/history');
            setHistory(res.data);
        } catch (error) {
            console.error('Error fetching history:', error);
        }
    };

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

    if (loading) return <div className="p-8 text-center text-slate-500">{t('earnings.loading')}</div>;

    // Safety check: Data fetch failed completely or returned nothing
    if (!data) return <div className="p-8 text-center text-red-500">{t('earnings.error_loading')}</div>;

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
                            <Wallet className="text-joa-blue" /> {t('earnings.my_earnings_title')}
                        </h2>
                        <p className="text-slate-500 text-sm">{t('earnings.back_office')}</p>
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
                            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">{t('earnings.base_salary')}</p>
                            <h3 className="text-3xl font-bold text-slate-800">{money(data.baseSalary)}</h3>
                            <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                                <CheckCircle size={12} className="text-green-500" /> {t('earnings.guaranteed')}
                            </p>
                        </div>
                    </div>

                    {/* 2. Revenue */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-green-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                        <div className="relative">
                            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">{t('earnings.generated_revenue')}</p>
                            <h3 className="text-3xl font-bold text-green-600">{money(revenue)}</h3>
                            <p className="text-xs text-slate-400 mt-2">
                                {t('earnings.company_value')}
                            </p>
                        </div>
                    </div>

                    {/* 3. Citas */}
                    <div className="bg-blue-600 p-6 rounded-2xl shadow-xl text-white relative overflow-hidden">
                        <div className="relative">
                            <p className="text-blue-200 text-xs font-bold uppercase tracking-wider mb-1">{t('earnings.appointments_scheduled')}</p>
                            <h3 className="text-4xl font-bold text-white">{appts}</h3>
                            <p className="text-xs text-blue-100 opacity-80 mt-2">
                                {t('earnings.in_this_period')}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Metrics Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                        <h3 className="font-bold text-slate-700 mb-6 flex items-center gap-2">
                            <Target className="text-green-500" />
                            {t('earnings.appointment_performance')}
                        </h3>

                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-bold text-slate-600">{t('earnings.total_period')}</span>
                            <span className="text-2xl font-bold text-slate-800">{appts}</span>
                        </div>
                        <div className="w-full bg-slate-100 h-4 rounded-full overflow-hidden">
                            <div className="bg-green-500 h-full rounded-full" style={{ width: `${Math.min(100, (appts / (target * 20)) * 100)}%` }}></div>
                        </div>
                        <p className="text-xs text-slate-400 mt-2 text-right">{t('earnings.monthly_target_ref', { target: target * 20 })}</p>
                    </div>

                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                        <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                            <DollarSign size={18} /> {t('earnings.profitability_summary')}
                        </h3>
                        <div className="space-y-3">
                            <div className="flex justify-between">
                                <span className="text-sm text-slate-500">{t('earnings.company_cost_est')}</span>
                                <span className="font-bold text-slate-700">{money(data.financials.total * 1.30)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-sm text-slate-500">{t('earnings.generated_revenue')}</span>
                                <span className="font-bold text-green-600">{money(revenue)}</span>
                            </div>
                            <div className="border-t border-slate-200 pt-2 flex justify-between">
                                <span className="font-bold text-slate-700">{t('earnings.balance')}</span>
                                <span className={`font-bold ${revenue - (data.financials.total * 1.3) > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                    {money(revenue - (data.financials.total * 1.30))}
                                </span>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-2">{t('earnings.cost_note')}</p>
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

    const cycleStart = data?.cycle?.start ? new Date(data.cycle.start).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }) : '';
    const cycleEnd = data?.cycle?.end ? new Date(data.cycle.end).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }) : '';

    return (
        <div className="max-w-5xl mx-auto space-y-8 pb-20 animate-fadeIn">
            {showHistory && (
                <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md flex items-center justify-center z-[110] p-4">
                    <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[80vh] overflow-hidden shadow-2xl relative flex flex-col border-4 border-slate-100">
                        <div className="p-8 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                                <Calendar className="text-joa-blue" size={28} /> {t('earnings.my_past_payrolls')}
                            </h3>
                            <button onClick={() => setShowHistory(false)} className="text-slate-400 hover:text-slate-800">
                                <AlertCircle size={28} />
                            </button>
                        </div>
                        <div className="flex-grow overflow-y-auto p-8">
                            {history.length === 0 ? (
                                <div className="text-center py-20 text-slate-400 italic">{t('earnings.no_past_payrolls')}</div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {history.map(log => (
                                        <div key={log.id} className="bg-white border-2 border-slate-100 rounded-2xl p-5">
                                            <div className="text-lg font-black text-slate-800 uppercase mb-4">
                                                {new Date(log.year, log.month - 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                                            </div>
                                            <div className="grid grid-cols-2 gap-3 mb-4">
                                                <div className="bg-slate-50 p-3 rounded-xl">
                                                    <div className="text-[9px] text-slate-400 font-bold uppercase">{t('earnings.points')}</div>
                                                    <div className="text-sm font-black text-slate-700">{log.points} pts</div>
                                                </div>
                                                <div className="bg-slate-50 p-3 rounded-xl">
                                                    <div className="text-[9px] text-slate-400 font-bold uppercase">{t('earnings.dietas')}</div>
                                                    <div className="text-sm font-black text-slate-700">{money(log.dietasAmount)}</div>
                                                </div>
                                            </div>
                                            <div className="bg-slate-900 text-white p-3 rounded-xl flex justify-between items-center text-sm font-black">
                                                <span>{t('earnings.total_received')}</span>
                                                <span>{money(log.totalEuros)}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
                            <button onClick={() => setShowHistory(false)} className="px-8 py-3 bg-slate-800 text-white rounded-2xl font-black uppercase text-xs tracking-widest">
                                {t('earnings.close_viewer')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Wallet className="text-joa-blue" /> {t('earnings.my_earnings_title')}
                    </h2>
                    <p className="text-slate-500 text-sm">{stats?.teamName || t('earnings.my_team')} {t('earnings.cycle_from_to', { start: cycleStart, end: cycleEnd })}</p>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={() => setShowHistory(true)}
                        className="bg-white border-2 border-slate-200 text-slate-600 px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all flex items-center gap-2"
                    >
                        <Calendar size={16} /> {t('earnings.view_past')}
                    </button>
                    <div className="bg-slate-800 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg">
                        {new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                    </div>
                </div>
            </div>

            {/* Top Cards: Personal Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* 1. Base Salary */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                    <div className="relative">
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">{t('earnings.base_salary_fixed')}</p>
                        <h3 className="text-3xl font-bold text-slate-800">{money(personal?.baseSalary)}</h3>
                        <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                            <CheckCircle size={12} className="text-green-500" /> {t('earnings.guaranteed')}
                        </p>
                    </div>
                </div>

                {/* 2. Variable (Bonus + Saturday + Dietas) */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-green-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                    <div className="relative">
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">{t('earnings.variable_estimated')}</p>
                        <h3 className={`text-3xl font-bold ${accumulatedBonus + (personal?.mySaturdayPay || 0) + (personal?.myDietasPay || 0) > 0 ? 'text-green-600' : 'text-slate-300'}`}>
                            {money(accumulatedBonus + (personal?.mySaturdayPay || 0) + (personal?.myDietasPay || 0))}
                        </h3>
                        <div className="text-xs text-slate-400 mt-2 space-y-0.5">
                            <p>{t('earnings.production_bonus')}: {money(accumulatedBonus)}</p>
                            <p>{t('earnings.saturday_extras')}: {money(personal?.mySaturdayPay)}</p>
                            <div className="flex justify-between items-center font-bold text-slate-600">
                                <p>{t('earnings.dietas')}: {money(personal?.myDietasPay)}</p>
                                <button 
                                    onClick={() => setShowDietaCalendar(true)}
                                    className="text-[10px] bg-joa-blue/10 text-joa-blue px-2 py-1 rounded hover:bg-joa-blue hover:text-white transition-all"
                                >
                                    {t('earnings.view_calendar')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. Total Percibir */}
                <div className="bg-blue-600 p-6 rounded-2xl shadow-xl text-white relative overflow-hidden group">
                    <div className="absolute top-1/2 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                    <div className="relative">
                        <p className="text-blue-200 text-xs font-bold uppercase tracking-wider mb-1">{t('earnings.total_to_receive')}</p>
                        <h3 className="text-4xl font-bold text-white">{money(personal?.totalEstimated)}</h3>
                        <p className="text-xs text-blue-100 opacity-80 mt-2">
                            {t('earnings.tax_note')}
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
                                <h3 className="font-bold text-lg text-slate-700">{t('earnings.profitability_goal')}</h3>
                                <p className="text-sm text-slate-500">{t('earnings.goal_desc')}</p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="flex justify-between items-end">
                            <div className="space-y-1">
                                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">{t('earnings.current_progress')}</p>
                                <p className="text-2xl font-black text-slate-800">{Math.round(progressPercent)}%</p>
                            </div>
                            <div className="text-right space-y-1">
                                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">{t('earnings.month_goal')}</p>
                                <p className="text-xs font-bold text-blue-600">
                                    {isGoalMet ? t('earnings.goal_met') : t('earnings.goal_missing', { percent: Math.max(0, 100 - Math.round(progressPercent)) })}
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
                                <p className="text-sm font-bold">{t('earnings.goal_warning', { percent: Math.round(progressPercent) })}</p>
                            </div>
                        ) : (
                            <div className="bg-green-50 border border-green-100 p-4 rounded-xl flex items-center gap-3 text-green-800 animate-fadeIn">
                                <CheckCircle size={20} />
                                <p className="text-sm font-bold">{t('earnings.goal_success_msg')}</p>
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
                    <Target className="text-joa-blue" size={20} /> {t('earnings.production_details')}
                </h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-center">
                        <p className="text-xs font-bold text-slate-400 uppercase mb-1">{t('earnings.basic_units')}</p>
                        <p className="text-2xl font-bold text-slate-700">{stats?.counts?.bp || 0}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-center">
                        <p className="text-xs font-bold text-slate-400 uppercase mb-1">{t('earnings.sdu')}</p>
                        <p className="text-2xl font-bold text-slate-700">{stats?.counts?.ta || 0}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-center">
                        <p className="text-xs font-bold text-slate-400 uppercase mb-1">{t('earnings.sp')}</p>
                        <p className="text-2xl font-bold text-slate-700">{stats?.counts?.sp || 0}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-center">
                        <p className="text-xs font-bold text-slate-400 uppercase mb-1">{t('earnings.mdu')}</p>
                        <p className="text-2xl font-bold text-slate-700">{stats?.counts?.mdu || 0}</p>
                    </div>
                </div>
            </div>

            <div className="text-center text-slate-400 text-xs mt-10">
                <p>{t('earnings.real_time_note')}</p>
            </div>

            {showDietaCalendar && (
                <ReadOnlyDietaCalendar 
                    user={user} 
                    onClose={() => setShowDietaCalendar(false)} 
                />
            )}
        </div>
    );
};

const ReadOnlyDietaCalendar = ({ user, onClose }) => {
    const { t } = useTranslation();
    const money = (val) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(val || 0);
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [dietas, setDietas] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchUserDietas = async () => {
        setLoading(true);
        try {
            const start = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).toISOString();
            const end = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
            end.setHours(23, 59, 59, 999);
            const res = await api.get(`/api/dietas/user?userId=${user.id}&startDate=${start}&endDate=${end.toISOString()}`);
            setDietas(res.data);
        } catch (error) {
            console.error('Error fetching logs:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUserDietas();
    }, [currentMonth, user.id]);

    const daysInMonth = (month, year) => new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = (month, year) => new Date(year, month, 1).getDay();

    const renderCalendar = () => {
        const month = currentMonth.getMonth();
        const year = currentMonth.getFullYear();
        const totalDays = daysInMonth(month, year);
        const startDay = (firstDayOfMonth(month, year) + 6) % 7; 
        
        const days = [];
        for (let i = 0; i < startDay; i++) {
            days.push(<div key={`empty-${i}`} className="p-4 border border-slate-50 opacity-20"></div>);
        }

        for (let d = 1; d <= totalDays; d++) {
            const dieta = dietas.find(log => {
                const logDate = new Date(log.date);
                return logDate.getDate() === d && logDate.getMonth() === month;
            });

            const isToday = new Date().toDateString() === new Date(year, month, d).toDateString();

            days.push(
                <div 
                    key={d} 
                    className={`relative p-3 h-20 border border-slate-100 flex flex-col items-center justify-between
                        ${isToday ? 'bg-blue-50/50' : ''}
                        ${dieta?.type === 'HOTEL' ? 'bg-blue-600/10' : ''}
                        ${dieta?.type === 'CASA' ? 'bg-slate-100' : ''}
                    `}
                >
                    <span className={`text-xs font-bold ${isToday ? 'text-joa-blue underline decoration-2' : 'text-slate-400'}`}>{d}</span>
                    {dieta && (
                        <div className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded shadow-sm text-center w-full truncate
                            ${dieta.isSaturday ? 'bg-orange-500 text-white' : (dieta.type === 'HOTEL' ? 'bg-blue-600 text-white' : 'bg-slate-400 text-white')}
                        `}>
                            {dieta.isSaturday ? `${t('earnings.saturday_extra')} (${money(dieta.amount)})` : (dieta.type === 'HOTEL' ? `${t('earnings.hotel')} (${money(dieta.amount)})` : `${t('earnings.home')} (${money(dieta.amount)})`)}
                        </div>
                    )}
                    {!dieta && <div className="h-4"></div>}
                </div>
            );
        }
        return days;
    };

    return (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md flex items-center justify-center z-[150] p-4">
            <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl relative border-4 border-slate-100 animate-in zoom-in-95 duration-200">
                <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-800 z-50">
                    <X size={24} />
                </button>

                <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-slate-800 p-2 rounded-xl text-white">
                            <Calendar size={20} />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800 text-lg">{t('earnings.dieta_calendar')}</h3>
                            <p className="text-xs text-slate-500 italic">{t('earnings.calendar_note')}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
                            className="p-1 hover:bg-slate-200 rounded-lg"
                        >
                            &larr;
                        </button>
                        <span className="text-sm font-black text-slate-700 uppercase">
                            {currentMonth.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                        </span>
                        <button 
                            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
                            className="p-1 hover:bg-slate-200 rounded-lg"
                        >
                            &rarr;
                        </button>
                    </div>
                </div>

                <div className="p-1 bg-slate-100">
                    <div className="grid grid-cols-7 text-center py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">
                        {[t('earnings.days.mon'), t('earnings.days.tue'), t('earnings.days.wed'), t('earnings.days.thu'), t('earnings.days.fri'), t('earnings.days.sat'), t('earnings.days.sun')].map(d => <div key={d}>{d}</div>)}
                    </div>
                    <div className="grid grid-cols-7 bg-white">
                        {loading ? (
                            <div className="col-span-7 h-64 flex items-center justify-center text-slate-400 text-sm italic">
                                {t('earnings.loading_history')}
                            </div>
                        ) : renderCalendar()}
                    </div>
                </div>

                <div className="p-4 bg-slate-50 flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    <div className="flex gap-4">
                        <div className="flex items-center gap-1"><div className="w-2 h-2 bg-blue-600 rounded"></div> {t('earnings.hotel_legend')}</div>
                        <div className="flex items-center gap-1"><div className="w-2 h-2 bg-slate-400 rounded"></div> {t('earnings.home_legend')}</div>
                        <div className="flex items-center gap-1"><div className="w-2 h-2 bg-orange-500 rounded"></div> {t('earnings.saturday_legend')}</div>
                    </div>
                    <span className="text-slate-600">{t('earnings.read_only')}</span>
                </div>
            </div>
        </div>
    );
}

export default MyEarningsPage;
