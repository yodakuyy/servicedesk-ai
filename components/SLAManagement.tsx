import React, { useState, useEffect } from 'react';
import {
    Search,
    Eye,
    Settings,
    ExternalLink,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    X,
    Clock,
    CheckCircle2,
    AlertTriangle,
    Building2,
    Ticket,
    Filter,
    RefreshCw
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface SLAConfig {
    id: string;
    sla_name: string;
    company_id: number;
    company_name?: string;
    sla_type: 'response' | 'resolve' | 'response_resolve';
    is_active: boolean;
    used_by_count: number;
    description?: string;
    response_time_hours?: number;
    resolve_time_hours?: number;
    created_at?: string;
    updated_at?: string;
}

interface Company {
    company_id: number;
    company_name: string;
}

const SLAManagement: React.FC = () => {
    const [slaConfigs, setSlaConfigs] = useState<SLAConfig[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCompany, setSelectedCompany] = useState<string>('all');
    const [selectedStatus, setSelectedStatus] = useState<string>('all');
    const [showFilters, setShowFilters] = useState(false);

    // Detail modal state
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [selectedSLA, setSelectedSLA] = useState<SLAConfig | null>(null);

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Mock data for demo
    const mockSLAConfigs: SLAConfig[] = [
        {
            id: '1',
            sla_name: 'IT Support – General',
            company_id: 1,
            company_name: 'IT Department',
            sla_type: 'response',
            is_active: true,
            used_by_count: 124,
            description: 'Standard SLA for IT support requests',
            response_time_hours: 4,
            resolve_time_hours: 24
        },
        {
            id: '2',
            sla_name: 'HR – Request',
            company_id: 2,
            company_name: 'HR Department',
            sla_type: 'response_resolve',
            is_active: false,
            used_by_count: 0,
            description: 'Human Resources general request SLA',
            response_time_hours: 2,
            resolve_time_hours: 48
        },
        {
            id: '3',
            sla_name: 'Finance – Urgent',
            company_id: 3,
            company_name: 'Finance',
            sla_type: 'response_resolve',
            is_active: true,
            used_by_count: 45,
            description: 'Urgent financial requests requiring immediate attention',
            response_time_hours: 1,
            resolve_time_hours: 8
        },
        {
            id: '4',
            sla_name: 'IT Support – Critical',
            company_id: 1,
            company_name: 'IT Department',
            sla_type: 'response_resolve',
            is_active: true,
            used_by_count: 67,
            description: 'Critical IT issues that impact business operations',
            response_time_hours: 0.5,
            resolve_time_hours: 4
        },
        {
            id: '5',
            sla_name: 'General Inquiry',
            company_id: 4,
            company_name: 'Customer Service',
            sla_type: 'response',
            is_active: true,
            used_by_count: 234,
            description: 'General inquiries with standard response time',
            response_time_hours: 8,
            resolve_time_hours: 72
        },
        {
            id: '6',
            sla_name: 'IT Support – Low Priority',
            company_id: 1,
            company_name: 'IT Department',
            sla_type: 'resolve',
            is_active: false,
            used_by_count: 12,
            description: 'Low priority IT requests',
            response_time_hours: 24,
            resolve_time_hours: 168
        }
    ];

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);

            // Fetch companies
            const { data: companiesData } = await supabase
                .from('company')
                .select('company_id, company_name')
                .order('company_name');

            if (companiesData) {
                setCompanies(companiesData);
            }

            // Fetch SLA policies from database
            const { data: policiesData, error: policiesError } = await supabase
                .from('sla_policies')
                .select(`
                    *,
                    company:company_id(company_name)
                `)
                .order('name');

            if (policiesError) {
                console.error('Error fetching SLA policies:', policiesError);
                // Fallback to mock data
                setSlaConfigs(mockSLAConfigs);
            } else if (policiesData) {
                // Transform data to match interface
                const transformedData: SLAConfig[] = policiesData.map((policy: any) => ({
                    id: policy.id?.toString() || policy.policy_id?.toString(),
                    sla_name: policy.name || policy.policy_name || 'Unnamed Policy',
                    company_id: policy.company_id,
                    company_name: policy.company?.company_name || 'Unknown',
                    sla_type: policy.sla_type || (policy.resolution_enabled ? 'response_resolve' : 'response'),
                    is_active: policy.is_active ?? true,
                    used_by_count: policy.used_by_count || 0,
                    description: policy.description || '',
                    response_time_hours: policy.response_time_hours || policy.default_response_hours,
                    resolve_time_hours: policy.resolution_time_hours || policy.default_resolution_hours,
                    created_at: policy.created_at,
                    updated_at: policy.updated_at
                }));
                setSlaConfigs(transformedData);
            }

        } catch (error) {
            console.error('Error fetching data:', error);
            setSlaConfigs(mockSLAConfigs);
        } finally {
            setLoading(false);
        }
    };

    const handleToggleActive = async (sla: SLAConfig) => {
        // Check if SLA is used by tickets
        if (sla.is_active && sla.used_by_count > 0) {
            const confirmed = confirm(
                `This SLA is currently used by ${sla.used_by_count} tickets. Disabling it may affect ticket processing. Continue?`
            );
            if (!confirmed) return;
        }

        // Update state optimistically
        setSlaConfigs(prev =>
            prev.map(s =>
                s.id === sla.id ? { ...s, is_active: !s.is_active } : s
            )
        );

        // Update database
        try {
            const { error } = await supabase
                .from('sla_policies')
                .update({ is_active: !sla.is_active })
                .eq('id', sla.id);

            if (error) {
                console.error('Error updating SLA status:', error);
                // Revert on error
                setSlaConfigs(prev =>
                    prev.map(s =>
                        s.id === sla.id ? { ...s, is_active: sla.is_active } : s
                    )
                );
            }
        } catch (error) {
            console.error('Error updating SLA status:', error);
        }
    };

    const handleViewDetail = (sla: SLAConfig) => {
        setSelectedSLA(sla);
        setIsDetailModalOpen(true);
    };

    const handleGoToPolicies = (sla: SLAConfig) => {
        // Navigate to SLA Policies with filter
        console.log('Navigate to SLA Policies for:', sla.sla_name);
        // This would typically use a navigation function
    };

    const getSLATypeBadge = (type: string) => {
        switch (type) {
            case 'response':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        <Clock size={12} />
                        Response Only
                    </span>
                );
            case 'resolve':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                        <CheckCircle2 size={12} />
                        Resolve Only
                    </span>
                );
            case 'response_resolve':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                        <Clock size={12} />
                        Dual SLA
                    </span>
                );
            default:
                return null;
        }
    };

    const formatHours = (hours: number | undefined) => {
        if (!hours) return '-';
        if (hours < 1) return `${Math.round(hours * 60)} min`;
        if (hours === 1) return '1 hour';
        if (hours < 24) return `${hours} hours`;
        const days = Math.floor(hours / 24);
        const remainingHours = hours % 24;
        if (remainingHours === 0) return `${days} day${days > 1 ? 's' : ''}`;
        return `${days}d ${remainingHours}h`;
    };

    // Filter logic
    const filteredSLAs = slaConfigs.filter(sla => {
        const matchesSearch = sla.sla_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            sla.company_name?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCompany = selectedCompany === 'all' || sla.company_id.toString() === selectedCompany;
        const matchesStatus = selectedStatus === 'all' ||
            (selectedStatus === 'active' && sla.is_active) ||
            (selectedStatus === 'inactive' && !sla.is_active);

        return matchesSearch && matchesCompany && matchesStatus;
    });

    // Pagination logic
    const totalPages = Math.ceil(filteredSLAs.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedSLAs = filteredSLAs.slice(startIndex, endIndex);

    // Reset to page 1 when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, selectedCompany, selectedStatus]);

    // Stats
    const activeCount = slaConfigs.filter(s => s.is_active).length;
    const inactiveCount = slaConfigs.filter(s => !s.is_active).length;
    const totalTicketsAffected = slaConfigs.reduce((sum, s) => sum + s.used_by_count, 0);

    return (
        <div className="p-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-800">SLA Management</h1>
                <p className="text-gray-500 mt-1">Overview & activation of SLA configurations</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-5 border border-emerald-100">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-emerald-600">Active SLAs</p>
                            <p className="text-2xl font-bold text-emerald-800 mt-1">{activeCount}</p>
                        </div>
                        <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                            <CheckCircle2 size={24} className="text-emerald-600" />
                        </div>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-gray-50 to-slate-50 rounded-xl p-5 border border-gray-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-600">Inactive SLAs</p>
                            <p className="text-2xl font-bold text-gray-800 mt-1">{inactiveCount}</p>
                        </div>
                        <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
                            <AlertTriangle size={24} className="text-gray-500" />
                        </div>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-indigo-50 to-violet-50 rounded-xl p-5 border border-indigo-100">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-indigo-600">Tickets Affected</p>
                            <p className="text-2xl font-bold text-indigo-800 mt-1">{totalTicketsAffected.toLocaleString()}</p>
                        </div>
                        <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
                            <Ticket size={24} className="text-indigo-600" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
                <div className="flex flex-col lg:flex-row gap-4">
                    {/* Search */}
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search SLA name..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50/50 transition-all"
                        />
                    </div>

                    {/* Company Filter */}
                    <div className="relative min-w-[200px]">
                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <select
                            value={selectedCompany}
                            onChange={(e) => setSelectedCompany(e.target.value)}
                            className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50/50 appearance-none cursor-pointer transition-all"
                        >
                            <option value="all">All Departments</option>
                            {companies.map(company => (
                                <option key={company.company_id} value={company.company_id.toString()}>
                                    {company.company_name}
                                </option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                    </div>

                    {/* Status Filter */}
                    <div className="relative min-w-[160px]">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <select
                            value={selectedStatus}
                            onChange={(e) => setSelectedStatus(e.target.value)}
                            className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50/50 appearance-none cursor-pointer transition-all"
                        >
                            <option value="all">All Status</option>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                    </div>

                    {/* Refresh Button */}
                    <button
                        onClick={fetchData}
                        className="px-4 py-2.5 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2 text-gray-600"
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        <span className="hidden sm:inline">Refresh</span>
                    </button>
                </div>

                {/* Active Filters Display */}
                {(selectedCompany !== 'all' || selectedStatus !== 'all' || searchTerm) && (
                    <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-100">
                        <span className="text-xs text-gray-500">Active filters:</span>
                        {searchTerm && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 rounded-full text-xs text-gray-700">
                                Search: "{searchTerm}"
                                <button onClick={() => setSearchTerm('')} className="hover:text-gray-900">
                                    <X size={12} />
                                </button>
                            </span>
                        )}
                        {selectedCompany !== 'all' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 rounded-full text-xs text-blue-700">
                                Department: {companies.find(c => c.company_id.toString() === selectedCompany)?.company_name}
                                <button onClick={() => setSelectedCompany('all')} className="hover:text-blue-900">
                                    <X size={12} />
                                </button>
                            </span>
                        )}
                        {selectedStatus !== 'all' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 rounded-full text-xs text-emerald-700">
                                Status: {selectedStatus === 'active' ? 'Active' : 'Inactive'}
                                <button onClick={() => setSelectedStatus('all')} className="hover:text-emerald-900">
                                    <X size={12} />
                                </button>
                            </span>
                        )}
                        <button
                            onClick={() => {
                                setSearchTerm('');
                                setSelectedCompany('all');
                                setSelectedStatus('all');
                            }}
                            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                        >
                            Clear all
                        </button>
                    </div>
                )}
            </div>

            {/* SLA Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                            <th className="px-6 py-4 font-semibold text-xs text-gray-600 uppercase tracking-wide">SLA Name</th>
                            <th className="px-6 py-4 font-semibold text-xs text-gray-600 uppercase tracking-wide">Company</th>
                            <th className="px-6 py-4 font-semibold text-xs text-gray-600 uppercase tracking-wide">Type</th>
                            <th className="px-6 py-4 font-semibold text-xs text-gray-600 uppercase tracking-wide text-center">Active</th>
                            <th className="px-6 py-4 font-semibold text-xs text-gray-600 uppercase tracking-wide">Used By</th>
                            <th className="px-6 py-4 font-semibold text-xs text-gray-600 uppercase tracking-wide text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {loading ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-12 text-center">
                                    <div className="flex flex-col items-center gap-3">
                                        <RefreshCw size={24} className="text-indigo-500 animate-spin" />
                                        <span className="text-gray-500">Loading SLA configurations...</span>
                                    </div>
                                </td>
                            </tr>
                        ) : paginatedSLAs.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-12 text-center">
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                                            <Settings size={28} className="text-gray-400" />
                                        </div>
                                        <div>
                                            <p className="text-gray-700 font-medium">No SLA configurations found</p>
                                            <p className="text-gray-400 text-sm">Try adjusting your filters</p>
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            paginatedSLAs.map((sla) => (
                                <tr key={sla.id} className="hover:bg-gray-50/50 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div>
                                            <span className="font-medium text-gray-800">{sla.sla_name}</span>
                                            {sla.description && (
                                                <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{sla.description}</p>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-sm text-gray-600">{sla.company_name}</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        {getSLATypeBadge(sla.sla_type)}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <button
                                            onClick={() => handleToggleActive(sla)}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${sla.is_active ? 'bg-indigo-600' : 'bg-gray-200'
                                                }`}
                                        >
                                            <span
                                                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform ${sla.is_active ? 'translate-x-6' : 'translate-x-1'
                                                    }`}
                                            />
                                        </button>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-1.5">
                                            <Ticket size={14} className="text-gray-400" />
                                            <span className={`text-sm font-medium ${sla.used_by_count > 0 ? 'text-indigo-600' : 'text-gray-400'}`}>
                                                {sla.used_by_count === 0 ? '0' : sla.used_by_count.toLocaleString()}
                                            </span>
                                            <span className="text-xs text-gray-400">tickets</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => handleViewDetail(sla)}
                                                className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                title="View Detail"
                                            >
                                                <Eye size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleGoToPolicies(sla)}
                                                className="p-2 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                                title="Go to Policies"
                                            >
                                                <ExternalLink size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                        <div className="text-sm text-gray-500">
                            Showing {startIndex + 1} to {Math.min(endIndex, filteredSLAs.length)} of {filteredSLAs.length} SLA configurations
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                disabled={currentPage === 1}
                                className="p-2 rounded-lg border border-gray-200 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                <button
                                    key={page}
                                    onClick={() => setCurrentPage(page)}
                                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${currentPage === page
                                        ? 'bg-indigo-600 text-white'
                                        : 'hover:bg-gray-100 text-gray-600'
                                        }`}
                                >
                                    {page}
                                </button>
                            ))}
                            <button
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                disabled={currentPage === totalPages}
                                className="p-2 rounded-lg border border-gray-200 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Note: Edit Detail Info */}
            <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                <AlertTriangle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                    <p className="text-sm font-medium text-amber-800">SLA Management is View-Only</p>
                    <p className="text-sm text-amber-600 mt-1">
                        This page provides an overview and quick activation control. To edit SLA time configurations and rules, please go to <strong className="font-semibold">SLA Policies</strong>.
                    </p>
                </div>
            </div>

            {/* Detail Modal (Read-Only) */}
            {isDetailModalOpen && selectedSLA && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-indigo-50 to-violet-50">
                            <div>
                                <h3 className="text-lg font-bold text-gray-800">SLA Detail</h3>
                                <p className="text-xs text-gray-500">Read-only view</p>
                            </div>
                            <button
                                onClick={() => setIsDetailModalOpen(false)}
                                className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-white rounded-lg"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 space-y-5">
                            {/* SLA Name */}
                            <div>
                                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">SLA Name</label>
                                <p className="text-lg font-semibold text-gray-800">{selectedSLA.sla_name}</p>
                            </div>

                            {/* Description */}
                            {selectedSLA.description && (
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Description</label>
                                    <p className="text-sm text-gray-600">{selectedSLA.description}</p>
                                </div>
                            )}

                            {/* Company & Status */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Department</label>
                                    <p className="text-sm font-medium text-gray-800">{selectedSLA.company_name}</p>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Status</label>
                                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${selectedSLA.is_active
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-gray-100 text-gray-600'
                                        }`}>
                                        {selectedSLA.is_active ? (
                                            <>
                                                <CheckCircle2 size={12} />
                                                Active
                                            </>
                                        ) : (
                                            <>
                                                <X size={12} />
                                                Inactive
                                            </>
                                        )}
                                    </span>
                                </div>
                            </div>

                            {/* SLA Type */}
                            <div>
                                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">SLA Type</label>
                                {getSLATypeBadge(selectedSLA.sla_type)}
                            </div>

                            {/* Time Configuration */}
                            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Time Configuration</label>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-white rounded-lg p-3 border border-gray-100">
                                        <div className="flex items-center gap-2 text-blue-600 mb-1">
                                            <Clock size={16} />
                                            <span className="text-xs font-medium uppercase">Response Time</span>
                                        </div>
                                        <p className="text-lg font-bold text-gray-800">
                                            {formatHours(selectedSLA.response_time_hours)}
                                        </p>
                                    </div>
                                    <div className="bg-white rounded-lg p-3 border border-gray-100">
                                        <div className="flex items-center gap-2 text-emerald-600 mb-1">
                                            <CheckCircle2 size={16} />
                                            <span className="text-xs font-medium uppercase">Resolve Time</span>
                                        </div>
                                        <p className="text-lg font-bold text-gray-800">
                                            {formatHours(selectedSLA.resolve_time_hours)}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Usage Stats */}
                            <div className="flex items-center justify-between p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                                        <Ticket size={20} className="text-indigo-600" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-indigo-600 font-medium">Used By</p>
                                        <p className="text-lg font-bold text-indigo-800">{selectedSLA.used_by_count.toLocaleString()} tickets</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-between">
                            <button
                                onClick={() => {
                                    setIsDetailModalOpen(false);
                                    handleGoToPolicies(selectedSLA);
                                }}
                                className="px-4 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors flex items-center gap-2"
                            >
                                <ExternalLink size={16} />
                                Go to Policies
                            </button>
                            <button
                                onClick={() => setIsDetailModalOpen(false)}
                                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200 bg-white"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SLAManagement;
