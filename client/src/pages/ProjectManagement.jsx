import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { Plus, Trash2, Upload, FileSpreadsheet, Folder, RefreshCw, Pencil, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const ProjectManagement = () => {
    const { t, i18n } = useTranslation();
    const [projects, setProjects] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isImportMode, setIsImportMode] = useState(false);
    const [formData, setFormData] = useState({ name: '', file: null, clientCompanyId: '', pricePerAcometida: '', pricePerMeter: '' });
    const [uploading, setUploading] = useState(false);


    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [projectToDelete, setProjectToDelete] = useState(null);
    const [confirmName, setConfirmName] = useState('');
    const [importType, setImportType] = useState('standard'); // 'standard' | 'protocol'
    const [clients, setClients] = useState([]);
    const [isPropertyMode, setIsPropertyMode] = useState(false);
    const [editingProject, setEditingProject] = useState(null);

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
        fetchClients();
    }, []);

    const fetchClients = async () => {
        try {
            const response = await api.get('/api/clients');
            setClients(response.data);
        } catch (error) {
            console.error('Error fetching clients:', error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setUploading(true);
        try {
            if (isPropertyMode && editingProject) {
                // Update Project Properties
                await api.put(`/api/projects/${editingProject.id}`, {
                    name: formData.name,
                    clientCompanyId: formData.clientCompanyId,
                    pricePerAcometida: formData.pricePerAcometida,
                    pricePerMeter: formData.pricePerMeter
                });
            } else if (isImportMode) {
                const data = new FormData();
                data.append('projectName', formData.name);
                data.append('file', formData.file);
                data.append('importType', importType);
                data.append('clientCompanyId', formData.clientCompanyId || '');

                const response = await api.post('/api/projects/import', data, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                alert(response.data.message || t('projects.success_import'));
            } else {
                await api.post('/api/projects', { 
                    name: formData.name,
                    clientCompanyId: formData.clientCompanyId,
                    pricePerAcometida: formData.pricePerAcometida,
                    pricePerMeter: formData.pricePerMeter
                });
            }
            fetchProjects();
            setIsModalOpen(false);
            setFormData({ name: '', file: null, clientCompanyId: '', pricePerAcometida: '', pricePerMeter: '' });
        } catch (error) {
            console.error('Error saving project:', error);
            alert(error.response?.data?.message || t('projects.error_save'));
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
            alert(t('projects.error_delete'));
        }
    };

    const [isUpdateMode, setIsUpdateMode] = useState(false);

    const openModal = (importMode = false, type = 'standard') => {
        setIsImportMode(importMode);
        setImportType(type);
        setIsUpdateMode(false);
        setIsPropertyMode(false);
        setFormData({ name: '', file: null, clientCompanyId: '', pricePerAcometida: '', pricePerMeter: '' });
        setIsModalOpen(true);
    };

    const openEditPropertiesModal = (project) => {
        setIsPropertyMode(true);
        setIsImportMode(false);
        setIsUpdateMode(false);
        setEditingProject(project);
        setFormData({ 
            name: project.name, 
            file: null, 
            clientCompanyId: project.clientCompanyId || '',
            pricePerAcometida: project.pricePerAcometida !== undefined ? project.pricePerAcometida : '',
            pricePerMeter: project.pricePerMeter !== undefined ? project.pricePerMeter : ''
        });
        setIsModalOpen(true);
    };

    const openUpdateModal = (project) => {
        setIsImportMode(true);
        setIsUpdateMode(true);
        setImportType('standard'); // Default to standard when updating via list item button
        setFormData({ name: project.name, file: null, clientCompanyId: '', pricePerAcometida: '', pricePerMeter: '' });
        setIsModalOpen(true);
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
                <h3 className="text-lg font-bold text-slate-800">{t('projects.title')}</h3>
                <div className="flex gap-2">
                    <button
                        onClick={() => openModal(false)}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                    >
                        <Plus size={18} /> {t('projects.new_project')}
                    </button>
                    <button
                        onClick={() => openModal(true, 'standard')}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                    >
                        <Upload size={18} /> {t('projects.import_excel')}
                    </button>
                    <button
                        onClick={() => openModal(true, 'protocol')}
                        className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                    >
                        <Upload size={18} /> {t('projects.import_multi')}
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
                                    <p className="text-sm text-slate-500">{project._count?.addresses || 0} {t('projects.addresses')}</p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => openEditPropertiesModal(project)}
                                    className="text-slate-400 hover:text-blue-600 transition-colors"
                                    title={t('projects.edit_properties')}
                                >
                                    <Pencil size={20} />
                                </button>
                                <button
                                    onClick={() => openUpdateModal(project)}
                                    className="text-slate-400 hover:text-blue-600 transition-colors"
                                    title={t('projects.update_data')}
                                >
                                    <RefreshCw size={20} />
                                </button>
                                <button onClick={() => openDeleteModal(project)} className="text-slate-400 hover:text-red-500 transition-colors" title={t('projects.delete_project')}>
                                    <Trash2 size={20} />
                                </button>
                            </div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-slate-200 flex flex-col gap-2 text-sm text-slate-500">
                            <div className="flex items-center gap-2">
                                <User size={14} className="text-slate-400" />
                                <span className={project.clientCompany ? "font-bold text-slate-700" : "italic"}>
                                    {project.clientCompany?.name || t('projects.no_client')}
                                </span>
                            </div>
                            <span>{t('projects.created')}: {new Date(project.createdAt).toLocaleDateString(i18n.language)}</span>
                            <div className="flex justify-between items-center text-xs text-slate-500 bg-slate-100 p-2 rounded-lg mt-1 font-mono">
                                <span>Acometida: <strong>{project.pricePerAcometida || 0}€</strong></span>
                                <span>Metro: <strong>{project.pricePerMeter || 0}€</strong></span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Create/Import Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
                        <h3 className="text-xl font-bold mb-4">
                            {isUpdateMode ? t('projects.update_title') : (
                                isImportMode ? (importType === 'protocol' ? t('projects.import_multi_title') : t('projects.import_general')) : t('projects.new_project_title')
                            )}
                        </h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {isImportMode && importType === 'protocol' ? (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        {t('projects.select_main')}
                                    </label>
                                    <select
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                        required
                                    >
                                        <option value="">{t('projects.select_project_placeholder')}</option>
                                        {projects.map(p => (
                                            <option key={p.id} value={p.name}>{p.name}</option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-slate-500 mt-1">
                                        {t('projects.protocol_hint')}
                                    </p>
                                </div>
                            ) : (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">{t('projects.project_name')}</label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className={`w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none ${isUpdateMode ? 'bg-slate-100 text-slate-500' : ''}`}
                                        placeholder={t('projects.project_name')}
                                        required
                                        readOnly={isUpdateMode}
                                    />
                                </div>
                            )}

                            {(!isUpdateMode || isPropertyMode) && (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">{t('projects.client_company')}</label>
                                        <select
                                            value={formData.clientCompanyId}
                                            onChange={(e) => setFormData({ ...formData, clientCompanyId: e.target.value })}
                                            className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                        >
                                            <option value="">{t('projects.none_unassigned')}</option>
                                            {clients.map(c => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                        </select>
                                        <p className="text-[10px] text-slate-400 mt-1 italic">{t('projects.client_hint')}</p>
                                    </div>
                                    {!isImportMode && (
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">Precio Acometida (€)</label>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    value={formData.pricePerAcometida}
                                                    onChange={(e) => setFormData({ ...formData, pricePerAcometida: e.target.value })}
                                                    className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                                    placeholder="0.00"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">Precio Metro Zanja (€)</label>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    value={formData.pricePerMeter}
                                                    onChange={(e) => setFormData({ ...formData, pricePerMeter: e.target.value })}
                                                    className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                                    placeholder="0.00"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {isImportMode && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        {t('projects.excel_file')} {importType === 'protocol' && <span className="text-purple-600 font-bold">- Multiviviendas</span>}
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
                                            {formData.file ? formData.file.name : t('projects.drop_file')}
                                        </p>
                                    </div>
                                    <p className="text-xs text-slate-400 mt-2">
                                        {t('projects.excel_hint_standard')} {importType === 'protocol' && <strong>{t('projects.excel_hint_protocol')}</strong>}
                                    </p>
                                </div>
                            )}

                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    {t('projects.cancel')}
                                </button>
                                <button
                                    type="submit"
                                    disabled={uploading}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                                >
                                    {uploading ? t('projects.processing') : (isPropertyMode ? t('projects.save_changes') : (isUpdateMode ? t('projects.update_excel') : (isImportMode ? t('projects.import') : t('projects.create'))))}
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
                            <h3 className="text-xl font-bold text-slate-800">{t('projects.delete_confirm_title')}</h3>
                            <p className="text-slate-500 mt-2">
                                {t('projects.delete_confirm_desc')} <strong>{projectToDelete.name}</strong> {t('projects.delete_confirm_desc2')}
                            </p>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    {t('projects.type_to_confirm')} <strong>{projectToDelete.name}</strong> {t('projects.to_confirm')}
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
                                    {t('projects.cancel')}
                                </button>
                                <button
                                    onClick={confirmDelete}
                                    disabled={confirmName !== projectToDelete.name}
                                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {t('projects.delete_permanently')}
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
