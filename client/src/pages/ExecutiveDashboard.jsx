import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api/axios';
import { Loader2, TrendingUp, AlertCircle, CheckCircle, Calendar, Briefcase, Activity } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444'];

export default function ExecutiveDashboard() {
  const { t } = useTranslation();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/planning/dashboard');
      setData(response.data);
    } catch (err) {
      console.error(err);
      setError('Error cargando los datos del dashboard.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 text-red-600 rounded-lg flex items-center gap-2">
        <AlertCircle className="w-5 h-5" />
        {error}
      </div>
    );
  }

  // Aggregate stats
  const totals = data.reduce((acc, proj) => {
    acc.total += proj.stats.total;
    acc.completed += proj.stats.completed;
    acc.pending += proj.stats.pending;
    acc.overdue += proj.stats.overdue;
    acc.brechasCount += proj.stats.brechasCount;
    acc.brechasResueltas += proj.stats.brechasResueltas;
    acc.completedAcometidas += proj.stats.completedAcometidas;
    acc.activations += proj.stats.activations || 0;
    return acc;
  }, { total: 0, completed: 0, pending: 0, overdue: 0, brechasCount: 0, brechasResueltas: 0, completedAcometidas: 0, activations: 0 });

  const pieData = [
    { name: 'Completado', value: totals.completed },
    { name: 'Pendiente', value: totals.pending },
    { name: 'Atrasado', value: totals.overdue },
  ];

  const chartData = data.map(p => ({
    name: p.name,
    Progreso: p.stats.progress,
    Acometidas: p.stats.completedAcometidas,
    Brechas: p.stats.brechasCount
  }));

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-2">
          <Activity className="w-8 h-8 text-blue-600" />
          Dashboard Ejecutivo
        </h1>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-lg text-blue-600">
              <Briefcase className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Proyectos Activos</p>
              <h3 className="text-2xl font-bold text-slate-800">{data.length}</h3>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-100 rounded-lg text-emerald-600">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Hitos Completados</p>
              <h3 className="text-2xl font-bold text-slate-800">{totals.completed} / {totals.total}</h3>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-red-100 rounded-lg text-red-600">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Hitos Atrasados</p>
              <h3 className="text-2xl font-bold text-slate-800">{totals.overdue}</h3>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-100 rounded-lg text-amber-600">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Brechas Resueltas</p>
              <h3 className="text-2xl font-bold text-slate-800">{totals.brechasResueltas} / {totals.brechasCount}</h3>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-100 rounded-lg text-indigo-600">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Acometidas Construidas</p>
              <h3 className="text-2xl font-bold text-slate-800">{totals.completedAcometidas}</h3>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-fuchsia-100 rounded-lg text-fuchsia-600">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Clientes Activados</p>
              <h3 className="text-2xl font-bold text-slate-800">{totals.activations}</h3>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Progress Chart */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-semibold text-slate-800 mb-6">Estado Global de Hitos</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={110}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Project Progress */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-semibold text-slate-800 mb-6">Avance por Proyecto (%)</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip cursor={{ fill: 'transparent' }} />
                <Bar dataKey="Progreso" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Detail Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-800">Detalle Operativo por Proyecto</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-slate-600">
            <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Proyecto</th>
                <th className="px-6 py-4">Progreso Global</th>
                <th className="px-6 py-4">Brechas</th>
                <th className="px-6 py-4">Hitos Atrasados</th>
                <th className="px-6 py-4">Acometidas</th>
                <th className="px-6 py-4">Activados</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {data.map((proj) => (
                <tr key={proj.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-800">{proj.name}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-full bg-slate-200 rounded-full h-2.5">
                        <div 
                          className="bg-blue-600 h-2.5 rounded-full" 
                          style={{ width: `${proj.stats.progress}%` }}
                        ></div>
                      </div>
                      <span className="font-semibold">{proj.stats.progress.toFixed(0)}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${proj.stats.brechasCount > 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                      {proj.stats.brechasResueltas} / {proj.stats.brechasCount}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {proj.stats.overdue > 0 ? (
                      <span className="flex items-center gap-1 text-red-600 font-medium">
                        <AlertCircle className="w-4 h-4" /> {proj.stats.overdue}
                      </span>
                    ) : (
                      <span className="text-slate-400">0</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-slate-500">
                    {proj.stats.completedAcometidas} / {proj.stats.totalAcometidas}
                  </td>
                  <td className="px-6 py-4 text-slate-500 font-bold text-emerald-600">
                    {proj.stats.activations || 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
