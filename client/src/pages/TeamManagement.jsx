import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { Plus, Trash2, Users, Briefcase, Settings } from 'lucide-react';
import TeamToolsModal from '../components/TeamToolsModal';

const TeamManagement = () => {
    const [teams, setTeams] = useState([]);
    const [users, setUsers] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({ name: '', department: 'BLOWING', memberIds: [] });

    // New states
    const [selectedTeam, setSelectedTeam] = useState(null); // For Tools Modal
    const [editingTeam, setEditingTeam] = useState(null);   // For Edit Modal

    const fetchData = async () => {
        try {
            const [teamsRes, usersRes] = await Promise.all([
                api.get('/api/teams'),
                api.get('/api/users')
            ]);
            setTeams(teamsRes.data);
            // Filter users who are not in a team OR are the ones in the team being edited (so they appear in the list)
            setUsers(usersRes.data);
        } catch (error) {
            console.error('Error fetching data:', error);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const openCreateModal = () => {
        setEditingTeam(null);
        setFormData({ name: '', department: 'BLOWING', memberIds: [] });
        setIsModalOpen(true);
    };

    const openEditModal = (team) => {
        setEditingTeam(team);
        setFormData({
            name: team.name,
            department: team.department,
            memberIds: team.members.map(m => m.id)
        });
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (formData.memberIds.length < 1) {
            alert('Un equipo debe tener al menos 1 miembro');
            return;
        }
        try {
            if (editingTeam) {
                // Update logic needed in backend likely, assuming PUT /api/teams/:id exists or create one.
                // NOTE: I haven't created PUT /api/teams/:id yet in this session, but user asked to modify teams.
                // I will assume for now I need to create it or just warn.
                // Let's check teamController quickly... it DOES NOT have updateTeam. 
                // I will create a quick updateTeam in teamController next.
                await api.put(`/api/teams/${editingTeam.id}`, formData);
            } else {
                await api.post('/api/teams', formData);
            }
            fetchData();
            setIsModalOpen(false);
            setEditingTeam(null);
            setFormData({ name: '', department: 'BLOWING', memberIds: [] });
        } catch (error) {
            console.error('Error saving team:', error);
            alert(error.response?.data?.message || 'Error al guardar equipo');
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('¿Eliminar equipo? Los usuarios quedarán libres.')) {
            try {
                await api.delete(`/api/teams/${id}`);
                fetchData();
            } catch (error) {
                console.error('Error deleting team:', error);
                alert(error.response?.data?.message || 'Error al eliminar equipo');
            }
        }
    };

    const toggleMemberSelection = (userId) => {
        setFormData(prev => {
            if (prev.memberIds.includes(userId)) {
                return { ...prev, memberIds: prev.memberIds.filter(id => id !== userId) };
            }
            // Allow more than 2 members? User prompt implied just modifying. Let's keep 2 limit or relax it.
            // Original code had limit 2. I'll stick to it unless user complains.
            if (prev.memberIds.length >= 2) return prev;
            return { ...prev, memberIds: [...prev.memberIds, userId] };
        });
    };

    // Filter available users: Free users OR users already in THIS team (if editing)
    const availableUsers = users.filter(u =>
        (!u.teamId && ['ACTIVATOR', 'BLOWER', 'PROTOCOL_MANAGER'].includes(u.role)) ||
        (editingTeam && formData.memberIds.includes(u.id))
    );

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
                <h3 className="text-lg font-bold text-slate-800">Gestión de Equipos</h3>
                <button
                    onClick={openCreateModal}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                >
                    <Plus size={18} /> Nuevo Equipo
                </button>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {teams.map((team) => (
                    <div key={team.id} className="border border-slate-200 rounded-xl p-4 hover:shadow-md transition-shadow relative group">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h4 className="font-bold text-slate-800 text-lg">{team.name}</h4>
                                <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded mt-1 inline-block">
                                    {team.department}
                                </span>
                            </div>
                            <div className="flex gap-1">
                                <button onClick={() => openEditModal(team)} className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="Editar Equipo">
                                    <Settings size={18} />
                                </button>
                                <button onClick={() => handleDelete(team.id)} className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded" title="Eliminar">
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2 mb-4">
                            {team.members.map(member => (
                                <div key={member.id} className="flex items-center text-sm text-slate-600">
                                    <Users size={14} className="mr-2 text-slate-400" />
                                    {member.username}
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={() => setSelectedTeam(team)}
                            className="w-full mt-2 py-2 border border-blue-200 text-blue-600 rounded-lg hover:bg-blue-50 flex items-center justify-center gap-2 font-medium transition-colors"
                        >
                            <Briefcase size={18} />
                            Gestionar Herramientas
                        </button>
                    </div>
                ))}
            </div>

            {/* Create/Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
                        <h3 className="text-xl font-bold mb-4">{editingTeam ? 'Editar Equipo' : 'Nuevo Equipo'}</h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del Equipo</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Departamento</label>
                                <select
                                    value={formData.department}
                                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                                    className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    <option value="BLOWING">Soplado</option>
                                    <option value="ACTIVATION">Activación</option>
                                    <option value="BACK_OFFICE">Back Office</option>
                                    <option value="PROTOCOLS">Protocolos</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Seleccionar Miembros (Max 2)</label>
                                <div className="border border-slate-200 rounded-lg max-h-40 overflow-y-auto p-2 space-y-1">
                                    {availableUsers.length === 0 ? (
                                        <p className="text-sm text-slate-400 text-center py-2">No hay usuarios disponibles</p>
                                    ) : (
                                        availableUsers.map(user => (
                                            <div
                                                key={user.id}
                                                onClick={() => toggleMemberSelection(user.id)}
                                                className={`p-2 rounded cursor-pointer text-sm flex justify-between items-center ${formData.memberIds.includes(user.id) ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'hover:bg-slate-50'
                                                    }`}
                                            >
                                                <span>{user.username}</span>
                                                <span className="text-xs text-slate-400">{user.role}</span>
                                            </div>
                                        ))
                                    )}
                                </div>
                                <p className="text-xs text-slate-500 mt-1 text-right">{formData.memberIds.length}/2 seleccionados</p>
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={formData.memberIds.length < 1}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {editingTeam ? 'Guardar Cambios' : 'Crear Equipo'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Tools Modal using the Component */}
            {selectedTeam && (
                <TeamToolsModal team={selectedTeam} onClose={() => setSelectedTeam(null)} />
            )}
        </div>
    );
};
export default TeamManagement;
