import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { Plus, Trash2, Edit2, Users, Briefcase, Phone, Mail, UserPlus, X, Shield, Lock, User } from 'lucide-react';

const SubcontractorManagement = () => {
    const [subcontractors, setSubcontractors] = useState([]);
    const [projects, setProjects] = useState([]);
    const [users, setUsers] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);
    const [editingSub, setEditingSub] = useState(null);
    const [selectedSubForUser, setSelectedSubForUser] = useState(null);

    const [formData, setFormData] = useState({
        name: '',
        responsible: '',
        phone: '',
        email: '',
        peopleCount: 0,
        projectIds: []
    });

    const [userFormData, setUserFormData] = useState({
        username: '',
        password: '',
        phone: ''
    });

    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        try {
            const [subsRes, projectsRes, usersRes] = await Promise.all([
                api.get('/api/subcontractors'),
                api.get('/api/projects'),
                api.get('/api/users')
            ]);
            setSubcontractors(subsRes.data || []);
            setProjects(projectsRes.data || []);
            setUsers(usersRes.data || []);
        } catch (error) {
            console.error('Error fetching subcontractor data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const openCreateModal = () => {
        setEditingSub(null);
        setFormData({
            name: '',
            responsible: '',
            phone: '',
            email: '',
            peopleCount: 0,
            projectIds: []
        });
        setIsModalOpen(true);
    };

    const openEditModal = (sub) => {
        setEditingSub(sub);
        setFormData({
            name: sub.name,
            responsible: sub.responsible || '',
            phone: sub.phone || '',
            email: sub.email || '',
            peopleCount: sub.peopleCount || 0,
            projectIds: sub.projects ? sub.projects.map(p => p.id) : []
        });
        setIsModalOpen(true);
    };

    const openUserModal = (sub) => {
        setSelectedSubForUser(sub);
        setUserFormData({
            username: '',
            password: '',
            phone: sub.phone || ''
        });
        setIsUserModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingSub) {
                await api.put(`/api/subcontractors/${editingSub.id}`, formData);
            } else {
                await api.post('/api/subcontractors', formData);
            }
            fetchData();
            setIsModalOpen(false);
        } catch (error) {
            console.error('Error saving subcontractor:', error);
            alert(error.response?.data?.message || 'Error al guardar la subcontrata');
        }
    };

    const handleUserSubmit = async (e) => {
        e.preventDefault();
        try {
            const newUser = {
                username: userFormData.username,
                password: userFormData.password,
                phone: userFormData.phone,
                role: 'SUBCONTRACTOR',
                subcontractorId: selectedSubForUser.id,
                baseSalary: 0,
                vacationDaysTotal: 0
            };
            await api.post('/api/users', newUser);
            alert('Usuario creado correctamente para la subcontrata.');
            fetchData();
            setIsUserModalOpen(false);
        } catch (error) {
            console.error('Error creating user for subcontractor:', error);
            alert(error.response?.data?.message || 'Error al crear el usuario.');
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('¿Seguro que deseas eliminar esta subcontrata? Los usuarios y proyectos vinculados serán desasociados.')) {
            try {
                await api.delete(`/api/subcontractors/${id}`);
                fetchData();
            } catch (error) {
                console.error('Error deleting subcontractor:', error);
                alert('Error al eliminar la subcontrata');
            }
        }
    };

    const handleDeleteUser = async (userId) => {
        if (window.confirm('¿Seguro que deseas eliminar la cuenta de este operario?')) {
            try {
                await api.delete(`/api/users/${userId}`);
                fetchData();
            } catch (error) {
                console.error('Error deleting user:', error);
                alert('Error al eliminar el usuario');
            }
        }
    };

    const handleProjectToggle = (projectId) => {
        setFormData(prev => {
            const exist = prev.projectIds.includes(projectId);
            if (exist) {
                return { ...prev, projectIds: prev.projectIds.filter(id => id !== projectId) };
            } else {
                return { ...prev, projectIds: [...prev.projectIds, projectId] };
            }
        });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header section */}
            <div className="flex justify-between items-center bg-[#0a0f1c] rounded-[2rem] p-8 text-white shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-white/5 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl pointer-events-none"></div>
                <div className="relative z-10">
                    <h2 className="text-3xl font-black font-heading">Gestión de Subcontratas</h2>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Socios de Obra Civil</p>
                </div>
                <button
                    onClick={openCreateModal}
                    className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold px-6 py-3.5 rounded-2xl flex items-center gap-2 transition-all hover:scale-[1.02] shadow-lg shadow-orange-500/20 active:scale-95"
                >
                    <Plus size={18} /> Nueva Subcontrata
                </button>
            </div>

            {/* Grid of Subcontractors */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {subcontractors.length === 0 ? (
                    <div className="col-span-full glass-panel bg-white/70 p-12 text-center rounded-3xl border border-slate-100">
                        <Users className="mx-auto text-slate-300 w-16 h-16 mb-4" />
                        <h4 className="text-lg font-bold text-slate-800">No hay subcontratas registradas</h4>
                        <p className="text-sm text-slate-500 mt-1">Haz clic en "Nueva Subcontrata" para dar de alta a tu primer socio.</p>
                    </div>
                ) : (
                    subcontractors.map((sub) => (
                        <div key={sub.id} className="glass-panel bg-white rounded-3xl p-6 shadow-sm border border-slate-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between group relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/[0.02] rounded-full blur-2xl pointer-events-none"></div>
                            
                            <div>
                                {/* Header */}
                                <div className="flex justify-between items-start mb-4 border-b border-slate-50 pb-4">
                                    <div>
                                        <h4 className="text-xl font-bold text-slate-800 group-hover:text-orange-600 transition-colors">{sub.name}</h4>
                                        <p className="text-xs text-slate-400 font-semibold uppercase mt-0.5 flex items-center gap-1.5">
                                            <Users size={12} className="text-slate-400" />
                                            {sub.peopleCount || 0} operarios previstos
                                        </p>
                                    </div>
                                    <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => openEditModal(sub)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all" title="Editar">
                                            <Edit2 size={16} />
                                        </button>
                                        <button onClick={() => handleDelete(sub.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all" title="Eliminar">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>

                                {/* Body Information */}
                                <div className="space-y-2 mb-6">
                                    {sub.responsible && (
                                        <div className="flex items-center text-sm text-slate-600 font-medium">
                                            <span className="w-24 text-slate-400 text-xs font-bold uppercase">Responsable:</span>
                                            <span className="text-slate-800">{sub.responsible}</span>
                                        </div>
                                    )}
                                    {sub.phone && (
                                        <div className="flex items-center text-sm text-slate-600">
                                            <Phone size={14} className="mr-2.5 text-slate-400" />
                                            <a href={`tel:${sub.phone}`} className="hover:underline">{sub.phone}</a>
                                        </div>
                                    )}
                                    {sub.email && (
                                        <div className="flex items-center text-sm text-slate-600">
                                            <Mail size={14} className="mr-2.5 text-slate-400" />
                                            <a href={`mailto:${sub.email}`} className="hover:underline truncate">{sub.email}</a>
                                        </div>
                                    )}
                                </div>

                                {/* Assigned Projects */}
                                <div className="mb-6 bg-slate-50 rounded-2xl p-4 border border-slate-100">
                                    <h5 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                                        <Briefcase size={12} />
                                        Proyectos Asignados ({sub.projects ? sub.projects.length : 0})
                                    </h5>
                                    {sub.projects && sub.projects.length > 0 ? (
                                        <div className="flex flex-wrap gap-1.5">
                                            {sub.projects.map(p => (
                                                <span key={p.id} className="text-[11px] font-bold bg-white text-slate-700 border border-slate-200/80 px-2.5 py-1 rounded-lg">
                                                    {p.name}
                                                </span>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-slate-400 italic">Ningún proyecto asignado</p>
                                    )}
                                </div>

                                {/* Subcontractor User Accounts */}
                                <div className="mb-6 bg-orange-50/50 rounded-2xl p-4 border border-orange-100/50">
                                    <div className="flex justify-between items-center mb-2.5">
                                        <h5 className="text-xs font-black text-orange-600 uppercase tracking-wider flex items-center gap-1.5">
                                            <Shield size={12} />
                                            Cuentas de Acceso ({sub.users ? sub.users.length : 0})
                                        </h5>
                                        <button
                                            onClick={() => openUserModal(sub)}
                                            className="text-xs text-orange-600 hover:text-orange-700 font-bold flex items-center gap-1"
                                        >
                                            <UserPlus size={12} /> Crear Cuenta
                                        </button>
                                    </div>
                                    {sub.users && sub.users.length > 0 ? (
                                        <div className="space-y-1.5">
                                            {sub.users.map(u => (
                                                <div key={u.id} className="flex justify-between items-center text-xs bg-white border border-orange-100 rounded-lg p-2">
                                                    <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                                                        <User size={12} className="text-slate-400" />
                                                        {u.username}
                                                    </span>
                                                    <button
                                                        onClick={() => handleDeleteUser(u.id)}
                                                        className="text-red-500 hover:bg-red-50 p-1 rounded-md"
                                                        title="Eliminar acceso"
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-slate-400 italic">Sin cuentas creadas</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Subcontractor Create/Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl w-full max-w-lg p-8 shadow-2xl relative border border-slate-100 animate-in zoom-in-95 duration-200">
                        <button
                            onClick={() => setIsModalOpen(false)}
                            className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 transition-colors"
                        >
                            <X size={20} />
                        </button>
                        
                        <h3 className="text-2xl font-black text-slate-800 mb-6">
                            {editingSub ? 'Editar Subcontrata' : 'Nueva Subcontrata'}
                        </h3>
                        
                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Nombre de la Subcontrata *</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all"
                                    placeholder="Ej: Excavaciones Sánchez"
                                    required
                                />
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Responsable</label>
                                    <input
                                        type="text"
                                        value={formData.responsible}
                                        onChange={(e) => setFormData({ ...formData, responsible: e.target.value })}
                                        className="w-full border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all"
                                        placeholder="Ej: Juan Sánchez"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Operarios Previstos</label>
                                    <input
                                        type="number"
                                        value={formData.peopleCount}
                                        onChange={(e) => setFormData({ ...formData, peopleCount: e.target.value })}
                                        className="w-full border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all"
                                        min="0"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Teléfono de contacto</label>
                                    <input
                                        type="text"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        className="w-full border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all"
                                        placeholder="+34 600 000 000"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Email corporativo</label>
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        className="w-full border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all"
                                        placeholder="contacto@empresa.com"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Asignar Proyectos para Ejecución</label>
                                <div className="border border-slate-100 rounded-2xl max-h-44 overflow-y-auto p-3 space-y-1.5 bg-slate-50/50">
                                    {projects.length === 0 ? (
                                        <p className="text-sm text-slate-400 text-center py-4">No hay proyectos creados en el sistema.</p>
                                    ) : (
                                        projects.map(proj => (
                                            <div
                                                key={proj.id}
                                                onClick={() => handleProjectToggle(proj.id)}
                                                className={`p-3 rounded-xl cursor-pointer text-sm font-semibold flex justify-between items-center transition-all ${
                                                    formData.projectIds.includes(proj.id) 
                                                        ? 'bg-orange-500/10 text-orange-700 border border-orange-500/20' 
                                                        : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-100'
                                                }`}
                                            >
                                                <span>{proj.name}</span>
                                                {proj.subcontractorId && proj.subcontractorId !== editingSub?.id && (
                                                    <span className="text-[10px] bg-slate-100 text-slate-500 font-bold px-2 py-0.5 rounded-full">
                                                        Ocupado
                                                    </span>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 mt-8">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-6 py-3 border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl font-bold shadow-lg shadow-orange-500/10 transition-colors"
                                >
                                    {editingSub ? 'Guardar Cambios' : 'Crear Subcontrata'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Create Subcontractor User Modal */}
            {isUserModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl relative border border-slate-100 animate-in zoom-in-95 duration-200">
                        <button
                            onClick={() => setIsUserModalOpen(false)}
                            className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 transition-colors"
                        >
                            <X size={20} />
                        </button>
                        
                        <h3 className="text-2xl font-black text-slate-800 mb-2">Crear Acceso de Operario</h3>
                        <p className="text-slate-400 text-sm mb-6">Subcontrata: <strong className="text-slate-800">{selectedSubForUser?.name}</strong></p>
                        
                        <form onSubmit={handleUserSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                                    <User size={12} /> Usuario de Acceso
                                </label>
                                <input
                                    type="text"
                                    value={userFormData.username}
                                    onChange={(e) => setUserFormData({ ...userFormData, username: e.target.value })}
                                    className="w-full border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all"
                                    placeholder="nombre.subcontrata"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                                    <Lock size={12} /> Contraseña de Acceso
                                </label>
                                <input
                                    type="password"
                                    value={userFormData.password}
                                    onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                                    className="w-full border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all"
                                    placeholder="Mínimo 6 caracteres"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                                    <Phone size={12} /> Teléfono del Operario
                                </label>
                                <input
                                    type="text"
                                    value={userFormData.phone}
                                    onChange={(e) => setUserFormData({ ...userFormData, phone: e.target.value })}
                                    className="w-full border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all"
                                    placeholder="+34 600 000 000"
                                />
                            </div>

                            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-50">
                                <button
                                    type="button"
                                    onClick={() => setIsUserModalOpen(false)}
                                    className="px-5 py-2.5 border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl font-bold shadow-lg shadow-orange-500/10 transition-colors"
                                >
                                    Crear Usuario
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SubcontractorManagement;
