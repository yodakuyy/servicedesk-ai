import React, { useState, useEffect } from 'react';
import {
    Plus,
    Search,
    MoreVertical,
    ChevronLeft,
    ChevronRight,
    Edit2,
    Trash2,
    CheckCircle,
    XCircle,
    X,
    Building2,
    Globe
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Department {
    company_id: number;
    company_name: string;
    description: string | null;
    is_active: boolean;
    services?: string[];
    created_at?: string;
}

interface AdminUser {
    id: string;
    full_name: string;
    email: string;
    avatar_url?: string;
}

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
        is_active: true
    });

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 5;

    useEffect(() => {
        fetchDepartments();
    }, []);

    const fetchDepartments = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('company')
                .select('*')
                .order('company_id', { ascending: true });

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
            // Fetch profiles that are admins for this department
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

    const handleOpenModal = async (dept?: Department) => {
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
                is_active: dept.is_active
            });
            await fetchDepartmentAdmins(dept.company_id);
        } else {
            setEditingDepartment(null);
            setFormData({
                company_name: '',
                description: '',
                services: [],
                is_active: true
            });
            setDepartmentAdmins([]);
        }
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        try {
            if (editingDepartment) {
                // Update
                const { error } = await supabase
                    .from('company')
                    .update({
                        company_name: formData.company_name,
                        description: formData.description,
                        services: formData.services,
                        is_active: formData.is_active
                    })
                    .eq('company_id', editingDepartment.company_id);

                if (error) throw error;
            } else {
                // Create
                // Note: company_id is likely serial/auto-increment, so we don't send it?
                // Let's check schema assumption. Assuming company_id is auto-generated.
                const { error } = await supabase
                    .from('company')
                    .insert([{
                        company_name: formData.company_name,
                        description: formData.description,
                        services: formData.services,
                        is_active: formData.is_active
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

    // Filter departments based on search
    const filteredDepartments = departments.filter(dept =>
        dept.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (dept.description && dept.description.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    // Pagination logic
    const totalPages = Math.ceil(filteredDepartments.length / itemsPerPage);
    const showPagination = filteredDepartments.length > itemsPerPage;
    const currentDepartments = filteredDepartments.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    return (
        <div className="p-8 max-w-7xl mx-auto font-sans text-slate-600">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-800">Department Management</h1>
                <p className="text-gray-500">Manage your service desk departments and units.</p>
            </div>

            {/* Actions Bar */}
            <div className="flex justify-between items-center mb-6">
                <button
                    onClick={() => handleOpenModal()}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors shadow-sm"
                >
                    <Plus size={18} />
                    Add Department
                </button>

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

            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                            <th className="px-6 py-4 font-semibold text-sm text-gray-600">Department</th>
                            <th className="px-6 py-4 font-semibold text-sm text-gray-600">Description</th>
                            <th className="px-6 py-4 font-semibold text-sm text-gray-600">Status</th>
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
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => handleOpenModal(dept)}
                                            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors"
                                        >
                                            View
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>

                {/* Pagination in Footer */}
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

            {/* Add/Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h3 className="text-lg font-bold text-gray-800">
                                {editingDepartment ? 'Edit Department' : 'Add Department'}
                            </h3>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 space-y-5">
                            {/* Department Name */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Department Name</label>
                                <input
                                    type="text"
                                    value={formData.company_name}
                                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                                    placeholder="e.g. Marketing Team"
                                />
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Description</label>
                                <input
                                    type="text"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                                    placeholder="e.g. Team handling..."
                                />
                            </div>

                            {/* Services (Dynamic List) */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Services / Contexts</label>
                                <div className="space-y-2">
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            id="service-input"
                                            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                                            placeholder="Add a service (e.g. Network Security)"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    const val = e.currentTarget.value.trim();
                                                    if (val && !formData.services.includes(val)) {
                                                        setFormData({
                                                            ...formData,
                                                            services: [...formData.services, val]
                                                        });
                                                        e.currentTarget.value = '';
                                                    }
                                                }
                                            }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const input = document.getElementById('service-input') as HTMLInputElement;
                                                const val = input.value.trim();
                                                if (val && !formData.services.includes(val)) {
                                                    setFormData({
                                                        ...formData,
                                                        services: [...formData.services, val]
                                                    });
                                                    input.value = '';
                                                }
                                            }}
                                            className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
                                        >
                                            <Plus size={18} />
                                        </button>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {formData.services.map((service, idx) => (
                                            <div key={idx} className="flex items-center gap-1 bg-indigo-50 text-indigo-700 px-2 py-1 rounded text-xs font-medium border border-indigo-100">
                                                <span>{service}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const newServices = [...formData.services];
                                                        newServices.splice(idx, 1);
                                                        setFormData({ ...formData, services: newServices });
                                                    }}
                                                    className="hover:text-indigo-900"
                                                >
                                                    <X size={12} />
                                                </button>
                                            </div>
                                        ))}
                                        {formData.services.length === 0 && (
                                            <span className="text-xs text-gray-400 italic">No services added yet.</span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Default Language (Static for UI) */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Default Language</label>
                                <div className="relative">
                                    <div className="flex items-center gap-2 w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 text-sm cursor-not-allowed">
                                        <Globe size={16} />
                                        <span>English</span>
                                    </div>
                                </div>
                            </div>

                            {/* Admin Users */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Admin Users</label>

                                {editingDepartment ? (
                                    <div className="bg-gray-50 rounded-lg border border-gray-100 p-3">
                                        {adminsLoading ? (
                                            <div className="text-xs text-gray-400 text-center py-2">Loading admins...</div>
                                        ) : departmentAdmins.length > 0 ? (
                                            <div className="flex flex-wrap gap-2">
                                                {departmentAdmins.map(admin => (
                                                    <div key={admin.id} className="flex items-center gap-2 bg-white pl-1 pr-3 py-1 rounded-full border border-gray-200 shadow-sm">
                                                        <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold">
                                                            {admin.full_name.charAt(0)}
                                                        </div>
                                                        <span className="text-xs font-medium text-gray-700">{admin.full_name}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-center py-2">
                                                <p className="text-xs text-amber-600 font-medium mb-1">No admin assigned</p>
                                                <p className="text-[10px] text-gray-500 leading-tight">
                                                    To assign an admin, please go to <span className="font-bold text-gray-700">User Management</span> and set the user as Department Admin.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="text-xs text-gray-400 italic bg-gray-50 p-3 rounded-lg border border-gray-100">
                                        Admins can be assigned after creating the department.
                                    </div>
                                )}
                            </div>

                            {/* Active Toggle */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Active</label>
                                <button
                                    onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                                    className={`relative w-11 h-6 rounded-full transition-colors duration-200 ease-in-out focus:outline-none ${formData.is_active ? 'bg-emerald-500' : 'bg-gray-200'}`}
                                >
                                    <span
                                        className={`inline-block w-4 h-4 transform transition-transform duration-200 ease-in-out bg-white rounded-full shadow-sm mt-1 ml-1 ${formData.is_active ? 'translate-x-5' : 'translate-x-0'}`}
                                    />
                                    <span className={`absolute left-full ml-3 text-sm font-medium ${formData.is_active ? 'text-gray-900' : 'text-gray-400'}`}>
                                        {formData.is_active ? 'ON' : 'OFF'}
                                    </span>
                                </button>
                            </div>
                        </div>

                        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200 bg-white"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-sm shadow-indigo-200"
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DepartmentManagement;
