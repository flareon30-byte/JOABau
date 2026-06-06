import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { Plus, Edit, Trash2, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const UserManagement = () => {
    const { t } = useTranslation();
    const [users, setUsers] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentUser, setCurrentUser] = useState(null); // For editing
    const [formData, setFormData] = useState({ username: '', password: '', role: 'OPERATOR', teamId: '', phone: '', baseSalary: 1500, vacationDaysTotal: 30, vehicleId: '', projectIds: [] });

    const [vehicles, setVehicles] = useState([]);
    const [projects, setProjects] = useState([]);

    const fetchData = async () => {
        try {
            const [usersRes, vehiclesRes, projectsRes] = await Promise.all([
                api.get('/api/users'),
                api.get('/api/vehicles'),
                api.get('/api/projects')
            ]);
            setUsers(usersRes.data);
            setVehicles(vehiclesRes.data);
            setProjects(projectsRes.data);
        } catch (error) {
            console.error('Error fetching data:', error);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleOpenModal = (user = null) => {
        if (user) {
            setCurrentUser(user);
            setFormData({
                username: user.username,
                password: '',
                role: user.role,
                teamId: user.teamId || '',
                phone: user.phone || '',
                baseSalary: user.baseSalary || 1500,
                vacationDaysTotal: user.vacationDaysTotal || 30,
                vehicleId: user.vehicleId || ''
            });
        } else {
            setCurrentUser(null);
            setFormData({ username: '', password: '', role: 'OPERATOR', teamId: '', phone: '', baseSalary: 1500, vacationDaysTotal: 30, vehicleId: '', projectIds: [] });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (currentUser) {
                await api.put(`/api/users/${currentUser.id}`, formData);
            } else {
                await api.post('/api/users', formData);
            }
            fetchData();
            setIsModalOpen(false);
        } catch (error) {
            console.error('Error saving user:', error);
            alert(t('users.error_save') + (error.response?.data?.details || error.message));
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm(t('users.confirm_delete'))) {
            try {
                await api.delete(`/api/users/${id}`);
                fetchData();
            } catch (error) {
                console.error('Error deleting user:', error);
                alert(error.response?.data?.message || t('users.error_delete'));
            }
        }
    };

    const getRoleLabel = (role) => {
        switch(role) {
            case 'SUPER_ADMIN': return t('users.role_super_admin');
            case 'ADMIN': return t('users.role_admin');
            case 'BACK_OFFICE': return t('users.role_back_office');
            case 'ACTIVATOR': return t('users.role_activator');
            case 'BLOWER': return t('users.role_blower');
            case 'PROTOCOL_MANAGER': return t('users.role_protocol_manager');
            default: return role;
        }
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
                <h3 className="text-lg font-bold text-slate-800">{t('users.title')}</h3>
                <button
                    onClick={() => handleOpenModal()}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                >
                    <Plus size={18} /> {t('users.new_user')}
                </button>
            </div>

            <div className="p-4 bg-slate-50 border-b border-slate-200">
                <div className="relative max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <input
                        type="text"
                        placeholder={t('users.search_placeholder')}
                        className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
                        <tr>
                            <th className="px-6 py-4">{t('users.col_user')}</th>
                            <th className="px-6 py-4">{t('users.col_phone')}</th>
                            <th className="px-6 py-4">{t('users.col_role')}</th>
                            <th className="px-6 py-4">{t('users.col_team')}</th>
                            <th className="px-6 py-4">{t('users.col_vehicle')}</th>
                            <th className="px-6 py-4">{t('users.col_salary')}</th>
                            <th className="px-6 py-4 text-right">{t('users.col_actions')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {users.map((user) => (
                            <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4 font-medium text-slate-800">{user.username}</td>
                                <td className="px-6 py-4 text-slate-500 text-sm">{user.phone || '-'}</td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${user.role === 'SUPER_ADMIN' ? 'bg-purple-100 text-purple-700' :
                                        user.role === 'ADMIN' ? 'bg-blue-100 text-blue-700' :
                                            'bg-slate-100 text-slate-700'
                                        }`}>
                                        {getRoleLabel(user.role)}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-slate-500">{user.teamId || '-'}</td>
                                <td className="px-6 py-4 text-slate-500 text-sm">
                                    {vehicles.find(v => v.id === user.vehicleId)?.plate || '-'}
                                </td>
                                <td className="px-6 py-4 text-slate-700 font-bold text-sm">
                                    {new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(user.baseSalary || 1500)}
                                </td>
                                <td className="px-6 py-4 text-right space-x-2">
                                    <button onClick={() => handleOpenModal(user)} className="text-blue-600 hover:bg-blue-50 p-2 rounded-lg transition-colors">
                                        <Edit size={18} />
                                    </button>
                                    <button onClick={() => handleDelete(user.id)} className="text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors">
                                        <Trash2 size={18} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
                        <h3 className="text-xl font-bold mb-4">{currentUser ? t('users.edit_user') : t('users.new_user')}</h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">{t('users.label_username')}</label>
                                <input
                                    type="text"
                                    value={formData.username}
                                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                    className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">{t('users.label_password')}</label>
                                <input
                                    type="password"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder={currentUser ? t('users.password_placeholder') : ''}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">{t('users.label_phone')}</label>
                                <input
                                    type="text"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="+49 123 456789"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">{t('users.label_role')}</label>
                                <select
                                    value={formData.role}
                                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                    className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    <option value="SUPER_ADMIN">{t('users.role_super_admin')}</option>
                                    <option value="ADMIN">{t('users.role_admin')}</option>
                                    <option value="BACK_OFFICE">{t('users.role_back_office')}</option>
                                    <option value="ACTIVATOR">{t('users.role_activator')}</option>
                                    <option value="BLOWER">{t('users.role_blower')}</option>
                                    <option value="PROTOCOL_MANAGER">{t('users.role_protocol_manager')}</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">{t('users.label_vehicle')}</label>
                                <select
                                    value={formData.vehicleId}
                                    onChange={(e) => setFormData({ ...formData, vehicleId: e.target.value })}
                                    className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    <option value="">{t('users.no_vehicle')}</option>
                                    {vehicles.map(v => (
                                        <option key={v.id} value={v.id}>{v.make} {v.model} ({v.plate})</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">{t('users.label_salary')}</label>
                                <input
                                    type="number"
                                    value={formData.baseSalary}
                                    onChange={(e) => setFormData({ ...formData, baseSalary: parseFloat(e.target.value) })}
                                    className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">{t('users.label_vacations')}</label>
                                <input
                                    type="number"
                                    value={formData.vacationDaysTotal}
                                    onChange={(e) => setFormData({ ...formData, vacationDaysTotal: parseInt(e.target.value) })}
                                    className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                    required
                                />
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    {t('users.btn_cancel')}
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                >
                                    {t('users.btn_save')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserManagement;
