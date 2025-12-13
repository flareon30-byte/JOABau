import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { Plus, Trash2, Upload, FileSpreadsheet, Folder, RefreshCw } from 'lucide-react';

const ProjectManagement = () => {
    const [projects, setProjects] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isImportMode, setIsImportMode] = useState(false);
    const [formData, setFormData] = useState({ name: '', file: null });
    const [uploading, setUploading] = useState(false);


    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [projectToDelete, setProjectToDelete] = useState(null);
    const [confirmName, setConfirmName] = useState('');
    const [importType, setImportType] = useState('standard'); // 'standard' | 'protocol'

    const fetchProjects = async () => {
        try {
            const response = await api.get('/api/projects');
            setProjects(response.data);
        } catch (error) {
            console.error('Error fetching projects:', error);
        }
    };

    useEffect(() => {
        fetchProjects();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setUploading(true);
        try {
            if (isImportMode) {
                const data = new FormData();
                data.append('projectName', formData.name);
                data.append('file', formData.file);
                data.append('importType', importType);

                await api.post('/api/projects/import', data, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                alert('Proyecto importado correctamente');
            } else {
                await api.post('/api/projects', { name: formData.name });
            }
            fetchProjects();
            setIsModalOpen(false);
            setFormData({ name: '', file: null });
        } catch (error) {
            console.error('Error saving project:', error);
            alert(error.response?.data?.message || 'Error al guardar proyecto');
        } finally {
            setUploading(false);
        }
    };

    const openDeleteModal = (project) => {
        setProjectToDelete(project);
        setConfirmName('');
        setDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!projectToDelete) return;
        if (confirmName !== projectToDelete.name) return;

        try {
            await api.delete(`/api/projects/${projectToDelete.id}`);
            fetchProjects();
            setDeleteModalOpen(false);
            setProjectToDelete(null);
        } catch (error) {
            console.error('Error deleting project:', error);
            alert('Error al eliminar el proyecto');
        }
    };

    const [isUpdateMode, setIsUpdateMode] = useState(false);

    const openModal = (importMode = false, type = 'standard') => {
        setIsImportMode(importMode);
        setImportType(type);
        setIsUpdateMode(false);
        setFormData({ name: '', file: null });
        setIsModalOpen(true);
    };

    const openUpdateModal = (project) => {
        setIsImportMode(true);
        setIsUpdateMode(true);
        setImportType('standard'); // Default to standard when updating via list item button
        setFormData({ name: project.name, file: null });
        setIsModalOpen(true);
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
                <h3 className="text-lg font-bold text-slate-800">Gestión de Proyectos</h3>
                <div className="flex gap-2">
                    <button
                        onClick={() => openModal(false)}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                    >
                        <Plus size={18} /> Nuevo Proyecto
                    </button>
                    <button
                        onClick={() => openModal(true, 'standard')}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                    >
                        <Upload size={18} /> Importar Excel
                    </button>
                    <button
                        onClick={() => openModal(true, 'protocol')}
                        className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                    >
                        <Upload size={18} /> Importar Multiviviendas
                    </button>
                </div>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {projects.map((project) => (
                    <div key={project.id} className="border border-slate-200 rounded-xl p-6 hover:shadow-md transition-shadow bg-slate-50">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
                                    <Folder size={24} />
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-800 text-lg">{project.name}</h4>
                                    <p className="text-sm text-slate-500">{project._count?.addresses || 0} direcciones</p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => openUpdateModal(project)}
                                    className="text-slate-400 hover:text-blue-600 transition-colors"
                                    title="Actualizar / Añadir Datos"
                                >
                                    <RefreshCw size={20} />
                                </button>
                                <button onClick={() => openDeleteModal(project)} className="text-slate-400 hover:text-red-500 transition-colors" title="Eliminar Proyecto">
                                    <Trash2 size={20} />
                                </button>
                            </div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-slate-200 flex justify-between items-center text-sm text-slate-500">
                            <span>Creado: {new Date(project.createdAt).toLocaleDateString()}</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Create/Import Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
                        <h3 className="text-xl font-bold mb-4">
                            {isUpdateMode ? 'Actualizar Proyecto' : (
                                isImportMode ? (importType === 'protocol' ? 'Importar Multiviviendas (Protocolo)' : 'Importar Proyecto General') : 'Nuevo Proyecto'
                            )}
                        </h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {isImportMode && importType === 'protocol' ? (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Seleccionar Proyecto Principal
                                    </label>
                                    <select
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                        required
                                    >
                                        <option value="">Selecciona un proyecto...</option>
                                        {projects.map(p => (
                                            <option key={p.id} value={p.name}>{p.name}</option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-slate-500 mt-1">
                                        Las direcciones del Excel se buscarán en este proyecto y se marcarán como "Requiere Protocolo".
                                    </p>
                                </div>
                            ) : (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del Proyecto</label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className={`w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none ${isUpdateMode ? 'bg-slate-100 text-slate-500' : ''}`}
                                        required
                                        readOnly={isUpdateMode}
                                    />
                                </div>
                            )}

                            {isImportMode && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Archivo Excel (.xlsx) {importType === 'protocol' && <span className="text-purple-600 font-bold">- Multiviviendas</span>}
                                    </label>
                                    <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:bg-slate-50 transition-colors cursor-pointer relative">
                                        <input
                                            type="file"
                                            accept=".xlsx, .xls, .csv"
                                            onChange={(e) => setFormData({ ...formData, file: e.target.files[0] })}
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                            required
                                        />
                                        <FileSpreadsheet className="mx-auto text-slate-400 mb-2" size={32} />
                                        <p className="text-sm text-slate-500">
                                            {formData.file ? formData.file.name : 'Arrastra o selecciona un archivo'}
                                        </p>
                                    </div>
                                    <p className="text-xs text-slate-400 mt-2">
                                        El Excel debe tener columnas: NVT, CALLE, NUMERO, CIUDAD, KLS... {importType === 'protocol' && <strong> y STATUS</strong>}
                                    </p>
                                </div>
                            )}

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
                                    disabled={uploading}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                                >
                                    {uploading ? 'Procesando...' : (isUpdateMode ? 'Actualizar' : (isImportMode ? 'Importar' : 'Crear'))}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteModalOpen && projectToDelete && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border-2 border-red-100">
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
                                <Trash2 size={32} />
                            </div>
                            <h3 className="text-xl font-bold text-slate-800">¿Eliminar Proyecto?</h3>
                            <p className="text-slate-500 mt-2">
                                Esta acción eliminará permanentemente el proyecto <strong>{projectToDelete.name}</strong> y todas sus direcciones asociadas.
                            </p>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Escribe <strong>{projectToDelete.name}</strong> para confirmar:
                                </label>
                                <input
                                    type="text"
                                    value={confirmName}
                                    onChange={(e) => setConfirmName(e.target.value)}
                                    className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-red-500 outline-none"
                                    placeholder="Nombre del proyecto"
                                />
                            </div>

                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    onClick={() => setDeleteModalOpen(false)}
                                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={confirmDelete}
                                    disabled={confirmName !== projectToDelete.name}
                                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Eliminar Definitivamente
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProjectManagement;
