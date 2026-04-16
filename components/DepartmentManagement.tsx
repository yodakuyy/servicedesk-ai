import React, { useState, useEffect } from 'react';
import {
    Plus,
    Search,
    ChevronLeft,
    ChevronRight,
    CheckCircle,
    X,
    Globe,
    Clock,
    AlertTriangle
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Department {
    company_id: number;
    company_name: string;
    description: string | null;
    is_active: boolean;
    services?: string[];
    created_at?: string;
    sla_escalation_mode?: 'immediate' | 'fresh_start' | 'proportional';
}

interface AdminUser {
    id: string;
    full_name: string;
    email: string;
    avatar_url?: string;
}

const ChecklistItem: React.FC<{
    title: string;
    desc: string;
    isDone: boolean;
    icon: React.ReactNode;
    onClick?: () => void;
}> = ({ title, desc, isDone, icon, onClick }) => (
    <div
        onClick={onClick}
        className={`p-3 rounded-xl border transition-all ${onClick ? 'cursor-pointer hover:shadow-md' : ''} ${isDone ? 'bg-emerald-50/30 border-emerald-100 hover:border-emerald-200' : 'bg-white border-gray-100 hover:border-indigo-200'}`}
    >
        <div className="flex items-start gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isDone ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
                {isDone ? <CheckCircle size={18} /> : icon}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <h4 className={`text-sm font-bold ${isDone ? 'text-emerald-900' : 'text-gray-700'}`}>{title}</h4>
                    {isDone && <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded uppercase">Done</span>}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                {!isDone && onClick && (
                    <div className="mt-2 text-[10px] font-bold text-indigo-600 flex items-center gap-1 uppercase tracking-wider">
                        Configure Now <ChevronRight size={10} />
                    </div>
                )}
            </div>
        </div>
    </div>
);

const DepartmentManagement: React.FC = () => {
    const [departments, setDepartments] = useState<Department[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
    const [departmentAdmins, setDepartmentAdmins] = useState<AdminUser[]>([]);
    const [adminsLoading, setAdminsLoading] = useState(false);
    const [formData, setFormData] = useState({
        company_name: '',
        description: '',
        services: [] as string[],
        is_active: true,
        sla_escalation_mode: 'immediate' as 'immediate' | 'fresh_start' | 'proportional'
    });

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Checklist state
    const [activeTab, setActiveTab] = useState<'basic' | 'checklist'>('basic');
    const [setupStatus, setSetupStatus] = useState({
        staffing: false,
        sla: false,
        workflow: false,
        businessHours: false,
        categories: false,
        loading: false
    });
    const [deptsProgress, setDeptsProgress] = useState<Record<number, number>>({});

    useEffect(() => {
        fetchDepartments();
    }, []);

    const fetchDepartments = async () => {
        try {
            setLoading(true);

            const profileStr = localStorage.getItem('profile');
            const currentUser = profileStr ? JSON.parse(profileStr) : null;
            const isAdmin = currentUser?.role_id === 1 || currentUser?.role_id === '1';
            const isDeptAdmin = currentUser?.is_department_admin === true;
            const isSuperAdmin = isAdmin && !isDeptAdmin;

            let query = supabase.from('company').select('*');
            if (currentUser && !isSuperAdmin) {
                query = query.eq('company_id', currentUser.company_id);
            }

            const { data, error } = await query.order('company_id', { ascending: true });

            if (error) throw error;
            setDepartments(data || []);
        } catch (error) {
            console.error('Error fetching departments:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchDepartmentAdmins = async (companyId: number) => {
        try {
            setAdminsLoading(true);
            const { data, error } = await supabase
                .from('profiles')
                .select('id, full_name, email')
                .eq('company_id', companyId)
                .eq('is_department_admin', true);

            if (error) throw error;
            setDepartmentAdmins(data || []);
        } catch (error) {
            console.error('Error fetching department admins:', error);
            setDepartmentAdmins([]);
        } finally {
            setAdminsLoading(false);
        }
    };

    const checkSetupStatus = async (companyId: number) => {
        try {
            setSetupStatus(prev => ({ ...prev, loading: true }));
            const [staffRes, slaRes, workflowRes] = await Promise.all([
                supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
                supabase.from('sla_policies').select('id, business_hours_id').eq('company_id', companyId),
                supabase.from('department_workflows').select('workflow_id', { count: 'exact', head: true }).eq('department_id', companyId)
            ]);

            setSetupStatus({
                staffing: (staffRes.count || 0) > 0,
                sla: (slaRes.data || []).length > 0,
                businessHours: (slaRes.data || []).some(p => p.business_hours_id),
                workflow: (workflowRes.count || 0) > 0,
                categories: true,
                loading: false
            });
        } catch (error) {
            console.error('Error checking setup status:', error);
            setSetupStatus(prev => ({ ...prev, loading: false }));
        }
    };

    const fetchDepartmentsProgress = async (depts: Department[]) => {
        const ids = depts.map(d => d.company_id);
        if (ids.length === 0) return;

        try {
            const [staffData, slaData, workflowData] = await Promise.all([
                supabase.from('profiles').select('company_id'),
                supabase.from('sla_policies').select('company_id, business_hours_id'),
                supabase.from('department_workflows').select('department_id')
            ]);

            const progress: Record<number, number> = {};
            depts.forEach(dept => {
                const id = dept.company_id;
                const hasStaff = staffData.data?.some(s => s.company_id === id) || false;
                const deptSlas = slaData.data?.filter(s => s.company_id === id) || [];
                const hasSla = deptSlas.length > 0;
                const hasBH = deptSlas.some(s => s.business_hours_id);
                const hasWF = workflowData.data?.some(w => w.department_id === id) || false;

                const score = [hasStaff, hasSla, hasBH, hasWF].filter(Boolean).length;
                progress[id] = Math.round((score / 4) * 100);
            });
            setDeptsProgress(prev => ({ ...prev, ...progress }));
        } catch (error) {
            console.error('Error fetching progress:', error);
        }
    };

    useEffect(() => {
        if (departments.length > 0) {
            fetchDepartmentsProgress(departments);
        }
    }, [departments]);

    const handleOpenModal = async (dept?: Department) => {
        setActiveTab('basic');
        if (dept) {
            setEditingDepartment(dept);
            let services = dept.services || [];
            if (typeof services === 'string') {
                try {
                    services = JSON.parse(services);
                } catch (e) {
                    console.error('Error parsing services JSON in modal:', e);
                    services = [];
                }
            }

            setFormData({
                company_name: dept.company_name,
                description: dept.description || '',
                services: Array.isArray(services) ? services : [],
                is_active: dept.is_active,
                sla_escalation_mode: dept.sla_escalation_mode || 'immediate'
            });
            await Promise.all([
                fetchDepartmentAdmins(dept.company_id),
                checkSetupStatus(dept.company_id)
            ]);
        } else {
            setEditingDepartment(null);
            setFormData({
                company_name: '',
                description: '',
                services: [],
                is_active: true,
                sla_escalation_mode: 'immediate'
            });
            setDepartmentAdmins([]);
            setSetupStatus({
                staffing: false,
                sla: false,
                workflow: false,
                businessHours: false,
                categories: false,
                loading: false
            });
        }
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        try {
            if (editingDepartment) {
                const { error } = await supabase
                    .from('company')
                    .update({
                        company_name: formData.company_name,
                        description: formData.description,
                        services: formData.services,
                        is_active: formData.is_active,
                        sla_escalation_mode: formData.sla_escalation_mode
                    })
                    .eq('company_id', editingDepartment.company_id);

                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('company')
                    .insert([{
                        company_name: formData.company_name,
                        description: formData.description,
                        services: formData.services,
                        is_active: formData.is_active,
                        sla_escalation_mode: formData.sla_escalation_mode
                    }]);

                if (error) throw error;
            }

            await fetchDepartments();
            setIsModalOpen(false);
        } catch (error: any) {
            console.error('Error saving department:', error);
            alert('Error saving department: ' + error.message);
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm('Are you sure you want to delete this department?')) return;

        try {
            const { error } = await supabase
                .from('company')
                .delete()
                .eq('company_id', id);

            if (error) throw error;
            fetchDepartments();
        } catch (error: any) {
            console.error('Error deleting department:', error);
            alert('Error deleting department: ' + error.message);
        }
    };

    const filteredDepartments = departments.filter(dept =>
        dept.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (dept.description && dept.description.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const totalPages = Math.ceil(filteredDepartments.length / itemsPerPage);
    const showPagination = filteredDepartments.length > itemsPerPage;
    const currentDepartments = filteredDepartments.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const profileStr = localStorage.getItem('profile');
    const currentUser = profileStr ? JSON.parse(profileStr) : null;
    const isAdmin = currentUser?.role_id === 1 || currentUser?.role_id === '1';
    const isDeptAdmin = currentUser?.is_department_admin === true;
    const isSuperAdmin = isAdmin && !isDeptAdmin;

    return (
        <div className="p-8 w-full font-sans text-slate-600">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-800">Department Management</h1>
                <p className="text-gray-500">Manage your service desk departments and units.</p>
            </div>

            <div className="flex justify-between items-center mb-6">
                {isSuperAdmin && (
                    <button
                        onClick={() => handleOpenModal()}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors shadow-sm"
                    >
                        <Plus size={18} />
                        Add Department
                    </button>
                )}

                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent w-64 bg-white"
                    />
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                            <th className="px-6 py-4 font-semibold text-sm text-gray-600">Department</th>
                            <th className="px-6 py-4 font-semibold text-sm text-gray-600">Description</th>
                            <th className="px-6 py-4 font-semibold text-sm text-gray-600">Status</th>
                            <th className="px-6 py-4 font-semibold text-sm text-gray-600">Setup Progress</th>
                            <th className="px-6 py-4 font-semibold text-sm text-gray-600 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {loading ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-8 text-center text-gray-500">Loading departments...</td>
                            </tr>
                        ) : currentDepartments.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-8 text-center text-gray-500">No departments found.</td>
                            </tr>
                        ) : (
                            currentDepartments.map((dept) => (
                                <tr key={dept.company_id} className="hover:bg-gray-50/50 transition-colors group">
                                    <td className="px-6 py-4">
                                        <span className="font-medium text-gray-800">{dept.company_name}</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-gray-500 text-sm">{dept.description || '-'}</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <span className={`w-2.5 h-2.5 rounded-full ${dept.is_active ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                                            <span className={`text-sm font-medium ${dept.is_active ? 'text-gray-700' : 'text-red-600'}`}>
                                                {dept.is_active ? 'Active' : 'Inactive'}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-40 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full transition-all duration-500 ${deptsProgress[dept.company_id] === 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                                                    style={{ width: `${deptsProgress[dept.company_id] || 0}%` }}
                                                ></div>
                                            </div>
                                            <span className={`text-[10px] font-bold ${deptsProgress[dept.company_id] === 100 ? 'text-emerald-600' : 'text-gray-400'}`}>
                                                {deptsProgress[dept.company_id] || 0}%
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => handleOpenModal(dept)}
                                            className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${isSuperAdmin || (isDeptAdmin && dept.company_id === currentUser?.company_id)
                                                ? 'text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100'
                                                : 'text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200'
                                                }`}
                                        >
                                            {isSuperAdmin || (isDeptAdmin && dept.company_id === currentUser?.company_id) ? 'Edit' : 'View'}
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>

                {showPagination && (
                    <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex items-center justify-center gap-4">
                        <button
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            className="p-1 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <ChevronLeft size={18} />
                        </button>
                        <span className="text-sm font-medium text-gray-600 px-3 py-1 bg-white rounded border border-gray-200 shadow-sm">
                            {currentPage}
                        </span>
                        <button
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                            className="p-1 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <ChevronRight size={18} />
                        </button>
                    </div>
                )}
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto pt-20">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
                        <div className="px-6 pt-6 pb-2 border-b border-gray-100 bg-gray-50/50 flex flex-col flex-shrink-0">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-bold text-gray-800">
                                    {editingDepartment ? 'Edit Department' : 'Add Department'}
                                </h3>
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {editingDepartment && (
                                <div className="flex gap-4">
                                    <button
                                        onClick={() => setActiveTab('basic')}
                                        className={`pb-2 text-sm font-semibold transition-all border-b-2 ${activeTab === 'basic' ? 'text-indigo-600 border-indigo-600' : 'text-gray-400 border-transparent hover:text-gray-600'}`}
                                    >
                                        Basic Info
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('checklist')}
                                        className={`pb-2 text-sm font-semibold transition-all border-b-2 flex items-center gap-1.5 ${activeTab === 'checklist' ? 'text-indigo-600 border-indigo-600' : 'text-gray-400 border-transparent hover:text-gray-600'}`}
                                    >
                                        Setup Checklist
                                        {!setupStatus.loading && (
                                            <span className={`w-2 h-2 rounded-full ${[setupStatus.staffing, setupStatus.sla, setupStatus.workflow, setupStatus.businessHours].every(x => x) ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                                        )}
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="flex-1 overflow-y-auto">
                            {activeTab === 'basic' ? (
                                <div className="p-6 space-y-5">
                                    {/* Permission check */}
                                    {isDeptAdmin && editingDepartment && editingDepartment.company_id !== currentUser?.company_id && (
                                        <div className="bg-amber-50 border border-amber-100 p-3 rounded-xl flex items-start gap-3 mb-4">
                                            <AlertTriangle className="text-amber-600 flex-shrink-0" size={18} />
                                            <p className="text-xs text-amber-800">
                                                <strong>View Only Mode:</strong> Anda hanya dapat mengedit pengaturan departemen Anda sendiri.
                                            </p>
                                        </div>
                                    )}
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Department Name</label>
                                        <input
                                            type="text"
                                            disabled={isDeptAdmin && editingDepartment?.company_id !== currentUser?.company_id}
                                            value={formData.company_name}
                                            onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm disabled:bg-gray-50 disabled:text-gray-500"
                                            placeholder="e.g. Marketing Team"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Description</label>
                                        <input
                                            type="text"
                                            disabled={isDeptAdmin && editingDepartment?.company_id !== currentUser?.company_id}
                                            value={formData.description}
                                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm disabled:bg-gray-50 disabled:text-gray-500"
                                            placeholder="e.g. Team handling..."
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Services / Contexts</label>
                                        <div className="space-y-2">
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    id="service-input"
                                                    disabled={isDeptAdmin && editingDepartment?.company_id !== currentUser?.company_id}
                                                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm disabled:bg-gray-50 disabled:text-gray-500"
                                                    placeholder="Add a service"
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            const val = e.currentTarget.value.trim();
                                                            if (val && !formData.services.includes(val)) {
                                                                setFormData({ ...formData, services: [...formData.services, val] });
                                                                e.currentTarget.value = '';
                                                            }
                                                        }
                                                    }}
                                                />
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {formData.services.filter(s => !s.startsWith('__type:')).map((service, idx) => (
                                                    <div key={idx} className="flex items-center gap-1 bg-indigo-50 text-indigo-700 px-2 py-1 rounded text-xs font-medium border border-indigo-100">
                                                        <span>{service}</span>
                                                        {(!isDeptAdmin || (isDeptAdmin && editingDepartment?.company_id === currentUser?.company_id)) && (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    const newServices = [...formData.services];
                                                                    const originalIdx = newServices.indexOf(service);
                                                                    if (originalIdx !== -1) {
                                                                        newServices.splice(originalIdx, 1);
                                                                        setFormData({ ...formData, services: newServices });
                                                                    }
                                                                }}
                                                                className="hover:text-indigo-900"
                                                            >
                                                                <X size={12} />
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-3">Module Access</label>
                                        <div className="grid grid-cols-1 gap-2 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100/50">
                                            {['Incident', 'Service Request', 'Change Request'].map((type) => {
                                                const isChecked = formData.services.includes(`__type:${type}`);
                                                return (
                                                    <label key={type} className="flex items-center gap-3 cursor-pointer group">
                                                        <div className="relative flex items-center">
                                                            <input
                                                                type="checkbox"
                                                                checked={isChecked}
                                                                disabled={isDeptAdmin && editingDepartment?.company_id !== currentUser?.company_id}
                                                                onChange={(e) => {
                                                                    const tag = `__type:${type}`;
                                                                    if (e.target.checked) {
                                                                        setFormData({ ...formData, services: [...formData.services, tag] });
                                                                    } else {
                                                                        setFormData({ ...formData, services: formData.services.filter(s => s !== tag) });
                                                                    }
                                                                }}
                                                                className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 transition-all cursor-pointer disabled:cursor-not-allowed"
                                                            />
                                                        </div>
                                                        <span className={`text-sm font-bold transition-colors ${isChecked ? 'text-indigo-900' : 'text-gray-500 group-hover:text-gray-700'}`}>
                                                            {type}
                                                        </span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                        <p className="text-[10px] text-gray-400 mt-2 ml-1 italic">Tentukan tipe tiket yang diizinkan untuk departemen ini. Jika tidak ada yang dipilih, maka semua akan aktif secara default.</p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">SLA Priority Change Mode</label>
                                        <div className="space-y-2 bg-gray-50 p-3 rounded-lg border border-gray-100">
                                            {['immediate', 'fresh_start', 'proportional'].map((mode) => (
                                                <label key={mode} className={`flex items-start gap-3 p-2 rounded-lg cursor-pointer transition-all ${formData.sla_escalation_mode === mode ? 'bg-indigo-50 border border-indigo-200' : 'hover:bg-gray-100 border border-transparent'} ${isDeptAdmin && editingDepartment?.company_id !== currentUser?.company_id ? 'pointer-events-none opacity-70' : ''}`}>
                                                    <input
                                                        type="radio"
                                                        name="sla_mode"
                                                        value={mode}
                                                        disabled={isDeptAdmin && editingDepartment?.company_id !== currentUser?.company_id}
                                                        checked={formData.sla_escalation_mode === mode}
                                                        onChange={() => setFormData({ ...formData, sla_escalation_mode: mode as any })}
                                                        className="mt-0.5 accent-indigo-600"
                                                    />
                                                    <div>
                                                        <span className="text-sm font-semibold text-gray-800 capitalize">{mode.replace('_', ' ')}</span>
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Admin Users</label>
                                        <div className="bg-gray-50 rounded-lg border border-gray-100 p-3 text-xs">
                                            {adminsLoading ? 'Loading...' : departmentAdmins.length > 0 ? departmentAdmins.map(a => a.full_name).join(', ') : 'No admins assigned'}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Active</label>
                                        <button
                                            disabled={isDeptAdmin && editingDepartment?.company_id !== currentUser?.company_id}
                                            onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                                            className={`relative w-11 h-6 rounded-full transition-colors ${formData.is_active ? 'bg-emerald-500' : 'bg-gray-300'} ${isDeptAdmin && editingDepartment?.company_id !== currentUser?.company_id ? 'cursor-not-allowed opacity-70' : ''}`}
                                        >
                                            <span className={`inline-block w-4 h-4 transform transition-transform bg-white rounded-full mt-1 ml-1 ${formData.is_active ? 'translate-x-5' : 'translate-x-0'}`} />
                                            <span className="absolute left-full ml-3 text-sm font-medium">{formData.is_active ? 'ON' : 'OFF'}</span>
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-6">
                                    <div className="mb-6">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-sm font-bold text-gray-700">Onboarding Progress</span>
                                            <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                                                {Math.round([setupStatus.staffing, setupStatus.sla, setupStatus.workflow, setupStatus.businessHours].filter(Boolean).length / 4 * 100)}%
                                            </span>
                                        </div>
                                        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                                            <div className="h-full bg-indigo-600" style={{ width: `${Math.round([setupStatus.staffing, setupStatus.sla, setupStatus.workflow, setupStatus.businessHours].filter(Boolean).length / 4 * 100)}%` }}></div>
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <ChecklistItem
                                            title="Staffing & Admins"
                                            desc="At least one agent assigned."
                                            isDone={setupStatus.staffing}
                                            icon={<Plus size={16} />}
                                            onClick={() => {
                                                window.dispatchEvent(new CustomEvent('navigate', { detail: 'user-management' }));
                                                setIsModalOpen(false);
                                            }}
                                        />
                                        <ChecklistItem
                                            title="SLA Policies"
                                            desc="Define time targets."
                                            isDone={setupStatus.sla}
                                            icon={<Clock size={16} />}
                                            onClick={() => {
                                                window.dispatchEvent(new CustomEvent('navigate', { detail: 'sla-management' }));
                                                setIsModalOpen(false);
                                            }}
                                        />
                                        <ChecklistItem
                                            title="Business Hours"
                                            desc="Assign operational hours."
                                            isDone={setupStatus.businessHours}
                                            icon={<Globe size={16} />}
                                            onClick={() => {
                                                window.dispatchEvent(new CustomEvent('navigate', { detail: 'business-hours' }));
                                                setIsModalOpen(false);
                                            }}
                                        />
                                        <ChecklistItem
                                            title="Workflow Mapping"
                                            desc="Set status positions."
                                            isDone={setupStatus.workflow}
                                            icon={<AlertTriangle size={16} />}
                                            onClick={() => {
                                                window.dispatchEvent(new CustomEvent('navigate', { detail: 'workflow-mapping' }));
                                                setIsModalOpen(false);
                                            }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3 flex-shrink-0">
                            <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg border border-gray-200 bg-white">Cancel</button>
                            {(isSuperAdmin || (isDeptAdmin && editingDepartment?.company_id === currentUser?.company_id) || !editingDepartment) && (
                                <button onClick={handleSave} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg">Save</button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DepartmentManagement;
