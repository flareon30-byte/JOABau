import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Trash2, Users } from 'lucide-react';

const TeamManagement = () => {
    const [teams, setTeams] = useState([]);
    const [users, setUsers] = useState([]); // Available users to add
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({ name: '', department: 'BLOWING', memberIds: [] });

    const fetchData = async () => {
        try {
            const [teamsRes, usersRes] = await Promise.all([
                axios.get('http://localhost:3000/api/teams', { withCredentials: true }),
                axios.get('http://localhost:3000/api/users', { withCredentials: true })
            ]);
            setTeams(teamsRes.data);
            // Filter users who are not in a team or are Activators/Blowers/Protocol Managers
            setUsers(usersRes.data.filter(u => !u.teamId && ['ACTIVATOR', 'BLOWER', 'PROTOCOL_MANAGER'].includes(u.role)));
        } catch (error) {
            console.error('Error fetching data:', error);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (formData.memberIds.length < 1) {
            alert('Un equipo debe tener al menos 1 miembro');
            return;
        }
        try {
            await axios.post('http://localhost:3000/api/teams', formData, { withCredentials: true });
            fetchData();
            setIsModalOpen(false);
            setFormData({ name: '', department: 'BLOWING', memberIds: [] });
        } catch (error) {
            console.error('Error creating team:', error);
            alert(error.response?.data?.message || 'Error al crear equipo');
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('¿Eliminar equipo? Los usuarios quedarán libres.')) {
            try {
                await axios.delete(`http://localhost:3000/api/teams/${id}`, { withCredentials: true });
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
            if (prev.memberIds.length >= 2) return prev;
            return { ...prev, memberIds: [...prev.memberIds, userId] };
        });
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
                <h3 className="text-lg font-bold text-slate-800">Gestión de Equipos</h3>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                >
                    <Plus size={18} /> Nuevo Equipo
                </button>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {teams.map((team) => (
                    <div key={team.id} className="border border-slate-200 rounded-xl p-4 hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h4 className="font-bold text-slate-800">{team.name}</h4>
                                <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded mt-1 inline-block">
                                    {team.department}
                                </span>
                            </div>
                            <button onClick={() => handleDelete(team.id)} className="text-red-400 hover:text-red-600">
                                <Trash2 size={18} />
                            </button>
                        </div>
                        <div className="space-y-2">
                            {team.members.map(member => (
                                <div key={member.id} className="flex items-center text-sm text-slate-600">
                                    <Users size={14} className="mr-2" />
                                    {member.username} ({member.role})
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
                        <h3 className="text-xl font-bold mb-4">Nuevo Equipo</h3>
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
                                <label className="block text-sm font-medium text-slate-700 mb-2">Seleccionar Miembros (2)</label>
                                <div className="border border-slate-200 rounded-lg max-h-40 overflow-y-auto p-2 space-y-1">
                                    {users.length === 0 ? (
                                        <p className="text-sm text-slate-400 text-center py-2">No hay usuarios disponibles</p>
                                    ) : (
                                        users.map(user => (
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
                                    Crear Equipo
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TeamManagement;
