import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
    ChevronRight,
    Search,
    Plus,
    Settings,
    GripVertical,
    Folder,
    FolderOpen,
    Eye,
    EyeOff,
    Edit3,
    History,
    Info,
    ChevronDown,
    Layout,
    Check,
    X,
    Trash2
} from 'lucide-react';
// @ts-ignore
import Swal from 'https://cdn.jsdelivr.net/npm/sweetalert2@11/+esm';

interface CategoryNode {
    id: string;
    name: string;
    type: 'Incident' | 'Service Request' | 'Change Request';
    level: number;
    description: string;
    isActive: boolean;
    visible_to: string[];
    children?: CategoryNode[];
    parent_id?: string | null;
    default_group_id?: string | null;
    assignment_strategy?: 'manual' | 'round_robin';
}

// No mock data needed anymore

const CategoryManagement: React.FC = () => {
    const [categories, setCategories] = useState<CategoryNode[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [ticketType, setTicketType] = useState<'Incident' | 'Service Request' | 'Change Request'>('Incident');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
    const [isEditing, setIsEditing] = useState(false);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [availableGroups, setAvailableGroups] = useState<{ id: string, name: string }[]>([]);
    const [newCategoryData, setNewCategoryData] = useState({
        name: '',
        description: '',
        visible_to: ['admin', 'requestor', 'agent'],
        isActive: true,
        parent_id: null as string | null,
        level: 1,
        type: 'Incident' as 'Incident' | 'Service Request' | 'Change Request',
        default_group_id: null as string | null,
        assignment_strategy: 'manual' as 'manual' | 'round_robin'
    });

    useEffect(() => {
        fetchCategories();
        fetchGroups();
    }, []);

    const fetchGroups = async () => {
        const { data } = await supabase.from('groups').select('id, name').eq('is_active', true).order('name');
        if (data) setAvailableGroups(data);
    };

    const fetchCategories = async () => {
        try {
            setIsLoading(true);
            const { data, error } = await supabase
                .from('ticket_categories')
                .select('*')
                .order('level', { ascending: true })
                .order('name', { ascending: true });

            if (error) throw error;

            console.log('Raw data from Supabase:', data); // Debug log

            if (data && data.length > 0) {
                // Transform Supabase data to CategoryNode structure
                const nodes: CategoryNode[] = data.map((item: any) => ({
                    id: String(item.id),
                    name: item.name || 'Untitled',
                    type: item.category_type,
                    level: item.level || 1,
                    description: item.description || '',
                    isActive: item.is_active ?? true,
                    parent_id: item.parent_id ? String(item.parent_id) : null,
                    default_group_id: item.default_group_id ? String(item.default_group_id) : null,
                    assignment_strategy: item.assignment_strategy || 'manual',
                    visible_to: Array.isArray(item.visible_to) ? item.visible_to : []
                }));

                console.log('Mapped nodes:', nodes); // Debug log
                const tree = buildTree(nodes);
                setCategories(tree);
            } else {
                console.log('No data returned from Supabase table: ticket_categories');
                setCategories([]);
            }
        } catch (error) {
            console.error('Error fetching categories:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async (node: CategoryNode) => {
        try {
            const { error } = await supabase
                .from('ticket_categories')
                .update({
                    name: node.name,
                    description: node.description,
                    is_active: node.isActive,
                    visible_to: node.visible_to,
                    default_group_id: node.default_group_id,
                    assignment_strategy: node.assignment_strategy || 'manual'
                })
                .eq('id', node.id);

            if (error) throw error;

            setIsEditing(false);
            fetchCategories(); // Refresh data
            Swal.fire({
                icon: 'success',
                title: 'Changes Saved',
                text: 'Category has been updated successfully',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000,
                timerProgressBar: true
            });
        } catch (error: any) {
            console.error('Error updating category:', error);
            Swal.fire({
                icon: 'error',
                title: 'Save Failed',
                text: error.message || 'Failed to save changes'
            });
        }
    };

    const toggleVisibility = (role: string) => {
        if (!selectedNode || !isEditing) return;

        const currentVisible = selectedNode.visible_to || [];
        let newVisible;

        if (currentVisible.includes(role)) {
            newVisible = currentVisible.filter(r => r !== role);
        } else {
            newVisible = [...currentVisible, role];
        }

        // Optimistically update UI
        const updatedNode = { ...selectedNode, visible_to: newVisible };
        setCategories(prev => {
            const updateInTree = (nodes: CategoryNode[]): CategoryNode[] => {
                return nodes.map(n => {
                    if (n.id === updatedNode.id) return updatedNode;
                    if (n.children) return { ...n, children: updateInTree(n.children) };
                    return n;
                });
            };
            return updateInTree(prev);
        });
    };

    const handleDelete = async (node: CategoryNode) => {
        if (node.children && node.children.length > 0) {
            Swal.fire({
                icon: 'error',
                title: 'Cannot Delete',
                text: 'This category has subcategories. Please delete them first.',
            });
            return;
        }

        const result = await Swal.fire({
            title: 'Delete Category?',
            text: `Are you sure you want to delete "${node.name}"? This action cannot be undone.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#6b7280',
            confirmButtonText: 'Yes, delete it'
        });

        if (result.isConfirmed) {
            try {
                const { error } = await supabase
                    .from('ticket_categories')
                    .delete()
                    .eq('id', node.id);

                if (error) throw error;

                Swal.fire({
                    icon: 'success',
                    title: 'Deleted!',
                    text: 'Category has been deleted.',
                    timer: 1500,
                    showConfirmButton: false
                });

                setSelectedNodeId(null);
                fetchCategories();
            } catch (error: any) {
                console.error('Error deleting category:', error);
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: error.message || 'Failed to delete category'
                });
            }
        }
    };

    const buildTree = (flatNodes: CategoryNode[]): CategoryNode[] => {
        const map: { [key: string]: CategoryNode } = {};
        const roots: CategoryNode[] = [];

        flatNodes.forEach(node => {
            map[node.id] = { ...node, children: [] };
        });

        flatNodes.forEach(node => {
            if (node.parent_id && map[node.parent_id]) {
                map[node.parent_id].children?.push(map[node.id]);
            } else {
                roots.push(map[node.id]);
            }
        });

        return roots;
    };

    // Tree nodes flattened/filtered for easy lookup
    const flatNodes = useMemo(() => {
        const flat: { [key: string]: CategoryNode } = {};
        const traverse = (nodes: CategoryNode[]) => {
            nodes.forEach(node => {
                flat[node.id] = node;
                if (node.children) traverse(node.children);
            });
        };
        traverse(categories);
        return flat;
    }, [categories]);

    const selectedNode = selectedNodeId ? flatNodes[selectedNodeId] : null;

    const toggleExpand = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const newExpanded = new Set(expandedNodes);
        if (newExpanded.has(id)) newExpanded.delete(id);
        else newExpanded.add(id);
        setExpandedNodes(newExpanded);
    };

    const getBreadcrumbs = (nodeId: string | null): CategoryNode[] => {
        if (!nodeId) return [];
        const path: CategoryNode[] = [];
        let currentId: string | undefined = nodeId;

        // Simple path resolver (in a real app, parents would be in DB)
        const findPath = (nodes: CategoryNode[], targetId: string): boolean => {
            for (const node of nodes) {
                if (node.id === targetId) {
                    path.push(node);
                    return true;
                }
                if (node.children) {
                    if (findPath(node.children, targetId)) {
                        path.unshift(node);
                        return true;
                    }
                }
            }
            return false;
        };

        findPath(categories, nodeId);
        return path;
    };

    const renderTree = (nodes: CategoryNode[], isRoot = false) => {
        const filtered = nodes
            .filter(n => {
                const nodeType = n.type || '';
                return nodeType.toLowerCase() === ticketType.toLowerCase();
            })
            .filter(n => !searchQuery || n.name.toLowerCase().includes(searchQuery.toLowerCase()) || n.children?.some(c => c.name.toLowerCase().includes(searchQuery.toLowerCase())));

        if (isRoot && filtered.length === 0 && searchQuery === '') {
            return (
                <div className="flex flex-col items-center justify-center py-12 px-4 border-2 border-dashed border-gray-100 rounded-3xl bg-gray-50/50">
                    <p className="text-xs text-gray-400 font-bold mb-4 text-center">No {ticketType} categories found in database.</p>
                    <button className="text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-700 underline decoration-indigo-200 underline-offset-4">
                        Refresh or Add New
                    </button>
                </div>
            );
        }

        return filtered.map(node => {
            const hasChildren = node.children && node.children.length > 0;
            const isExpanded = expandedNodes.has(node.id);
            const isSelected = selectedNodeId === node.id;

            return (
                <div key={node.id} className="select-none">
                    <div
                        onClick={() => {
                            setSelectedNodeId(node.id);
                            setIsEditing(false);
                        }}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all group ${isSelected ? 'bg-indigo-50 border border-indigo-100 shadow-sm' : 'hover:bg-gray-50 border border-transparent'}`}
                    >
                        <GripVertical size={14} className="text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div
                            onClick={(e) => hasChildren && toggleExpand(node.id, e)}
                            className="p-1 hover:bg-white rounded transition-colors"
                        >
                            {hasChildren ? (
                                isExpanded ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />
                            ) : (
                                <div className="w-[14px]" />
                            )}
                        </div>
                        <div className={`p-1.5 rounded-md ${isSelected ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-100 text-gray-500'}`}>
                            {hasChildren ? (isExpanded ? <FolderOpen size={14} /> : <Folder size={14} />) : <Layout size={14} />}
                        </div>
                        <span className={`text-sm font-bold flex-1 ${isSelected ? 'text-indigo-900' : 'text-gray-700'}`}>
                            {node.name}
                        </span>
                    </div>

                    {hasChildren && isExpanded && (
                        <div className="ml-4 mt-1 border-l border-gray-100 pl-2">
                            {renderTree(node.children || [], false)}
                        </div>
                    )}
                </div>
            );
        });
    };

    const handleOpenAddModal = (parentNode: CategoryNode | null = null) => {
        if (parentNode && parentNode.level >= 5) {
            Swal.fire({
                icon: 'warning',
                title: 'Max Depth Reached',
                text: 'You cannot add subcategories beyond level 5.',
                confirmButtonColor: '#4f46e5'
            });
            return;
        }

        setNewCategoryData({
            name: '',
            description: '',
            visible_to: parentNode ? [...parentNode.visible_to] : ['admin', 'requestor', 'agent'],
            isActive: true,
            parent_id: parentNode ? parentNode.id : null,
            level: parentNode ? parentNode.level + 1 : 1,
            type: parentNode ? parentNode.type : ticketType,
            default_group_id: parentNode ? parentNode.default_group_id : null,
            assignment_strategy: parentNode ? parentNode.assignment_strategy : 'manual'
        });
        setIsAddModalOpen(true);
    };

    const handleCreateCategory = async () => {
        if (!newCategoryData.name.trim()) {
            Swal.fire({
                icon: 'error',
                title: 'Validation Error',
                text: 'Category name is required',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000
            });
            return;
        }

        try {
            setIsCreating(true);
            const { data, error } = await supabase
                .from('ticket_categories')
                .insert([{
                    name: newCategoryData.name.trim(),
                    description: newCategoryData.description,
                    category_type: newCategoryData.type,
                    parent_id: newCategoryData.parent_id,
                    level: newCategoryData.level,
                    is_active: newCategoryData.isActive,
                    visible_to: newCategoryData.visible_to,
                    default_group_id: newCategoryData.default_group_id,
                    assignment_strategy: newCategoryData.assignment_strategy
                }])
                .select()
                .single();

            if (error) throw error;

            Swal.fire({
                icon: 'success',
                title: 'Category Created',
                text: `${newCategoryData.name} has been created successfully`,
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000,
                timerProgressBar: true
            });

            setIsAddModalOpen(false);
            await fetchCategories();

            // Auto expand parent if exists
            if (newCategoryData.parent_id) {
                setExpandedNodes(prev => new Set([...prev, newCategoryData.parent_id!]));
            }

            // Auto select new node
            if (data) {
                setSelectedNodeId(String(data.id));
            }

        } catch (error: any) {
            console.error('Error creating category:', error);
            Swal.fire({
                icon: 'error',
                title: 'Creation Failed',
                text: error.message || 'Failed to create category',
                confirmButtonColor: '#4f46e5'
            });
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <div className="flex h-screen bg-white font-sans overflow-hidden">
            {/* LEFT PANEL — Category Tree */}
            <div className="w-[380px] border-r border-gray-100 flex flex-col bg-gray-50/30">
                <div className="p-8 pb-4">
                    <h2 className="text-xl font-black text-gray-900 tracking-tight mb-6">Ticket Category Management</h2>

                    <div className="space-y-6">
                        {/* Ticket Type Switch */}
                        <div>
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 block">Ticket Type</label>
                            <div className="flex bg-white p-1 rounded-xl border border-gray-200/60 shadow-inner">
                                {['Incident', 'Service Request', 'Change Request'].map((type) => (
                                    <button
                                        key={type}
                                        onClick={() => setTicketType(type as any)}
                                        className={`flex-1 py-2 px-2 rounded-lg text-[10px] md:text-xs font-bold transition-all flex items-center justify-center gap-2 ${ticketType === type ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-700'}`}
                                    >
                                        <div className={`w-1.5 h-1.5 rounded-full ${ticketType === type ? 'bg-white' : type === 'Incident' ? 'bg-indigo-300' : type === 'Change Request' ? 'bg-orange-300' : 'bg-gray-300'}`} />
                                        {type}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Search */}
                        <div className="relative">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search categories..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 transition-all shadow-sm"
                            />
                        </div>
                    </div>
                </div>

                {/* Category Tree View */}
                <div className="flex-1 overflow-y-auto px-6 py-4 custom-scrollbar space-y-1">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-40 space-y-3">
                            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                            <p className="text-xs text-gray-400 font-bold animate-pulse">Loading categories...</p>
                        </div>
                    ) : (
                        renderTree(categories, true)
                    )}
                </div>

                {/* Add Action (Bottom) */}
                <div className="p-6 pb-20 border-t border-gray-100 bg-white">
                    <button
                        onClick={() => handleOpenAddModal(null)}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 px-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 transition-all active:scale-95"
                    >
                        <Plus size={18} />
                        Add Category
                    </button>
                </div>
            </div>

            {/* RIGHT PANEL — Category Detail Editor */}
            <div className="flex-1 flex flex-col bg-white">
                {selectedNode ? (
                    <>
                        <div className="px-10 py-6 border-b border-gray-50 flex justify-between items-center">
                            {/* Breadcrumb */}
                            <div className="flex items-center gap-2">
                                {getBreadcrumbs(selectedNode.id).map((node, i, arr) => (
                                    <React.Fragment key={node.id}>
                                        <span className={`text-xs font-bold ${i === arr.length - 1 ? 'text-indigo-600' : 'text-gray-400'}`}>
                                            {node.name}
                                        </span>
                                        {i < arr.length - 1 && <ChevronRight size={14} className="text-gray-300" />}
                                    </React.Fragment>
                                ))}
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-3">
                                {isEditing ? (
                                    <>
                                        <button
                                            onClick={() => setIsEditing(false)}
                                            className="px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-lg text-xs font-bold hover:bg-gray-50 transition-all shadow-sm flex items-center gap-2"
                                        >
                                            <X size={16} />
                                            Cancel
                                        </button>
                                        <button
                                            onClick={() => handleSave(selectedNode)}
                                            className="bg-indigo-600 border border-indigo-700 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-indigo-700 transition-all shadow-sm flex items-center gap-2"
                                        >
                                            <Check size={16} />
                                            Save Changes
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        {selectedNode.level < 5 && (
                                            <button
                                                onClick={() => handleOpenAddModal(selectedNode)}
                                                className="bg-indigo-50 text-indigo-600 border border-indigo-100 px-4 py-2 rounded-lg text-xs font-bold hover:bg-indigo-600 hover:text-white transition-all shadow-sm flex items-center gap-2"
                                            >
                                                <Plus size={16} />
                                                Add Subcategory
                                            </button>
                                        )}
                                        <button
                                            onClick={() => setIsEditing(true)}
                                            className="bg-white border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-xs font-bold hover:border-indigo-500 hover:text-indigo-600 transition-all shadow-sm flex items-center gap-2"
                                        >
                                            <Edit3 size={16} />
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => handleDelete(selectedNode)}
                                            className="bg-white border border-gray-200 text-gray-400 px-3 py-2 rounded-lg text-xs font-bold hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-all shadow-sm"
                                            title="Delete Category"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-10 space-y-10 custom-scrollbar max-w-5xl w-full">
                            {/* Name Filed */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Name</label>
                                <input
                                    key={selectedNode.id}
                                    type="text"
                                    disabled={!isEditing}
                                    value={selectedNode.name}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setCategories(prev => {
                                            const updateInTree = (nodes: CategoryNode[]): CategoryNode[] => {
                                                return nodes.map(n => {
                                                    if (n.id === selectedNode.id) return { ...n, name: val };
                                                    if (n.children) return { ...n, children: updateInTree(n.children) };
                                                    return n;
                                                });
                                            };
                                            return updateInTree(prev);
                                        });
                                    }}
                                    className="w-full px-5 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-lg font-bold text-gray-800 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 disabled:bg-gray-100/50 disabled:cursor-not-allowed transition-all"
                                />
                            </div>

                            {/* Description Field */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Description</label>
                                <textarea
                                    disabled={!isEditing}
                                    rows={3}
                                    value={selectedNode.description}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setCategories(prev => {
                                            const updateInTree = (nodes: CategoryNode[]): CategoryNode[] => {
                                                return nodes.map(n => {
                                                    if (n.id === selectedNode.id) return { ...n, description: val };
                                                    if (n.children) return { ...n, children: updateInTree(n.children) };
                                                    return n;
                                                });
                                            };
                                            return updateInTree(prev);
                                        });
                                    }}
                                    className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-medium text-gray-600 placeholder:text-gray-300 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 disabled:bg-gray-100/50 disabled:cursor-not-allowed transition-all resize-none"
                                    placeholder="Add a description for this category..."
                                />
                            </div>

                            {/* Status Toggles */}
                            <div className="flex gap-12 pt-4">
                                <div className="flex items-center gap-4 group">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-black text-gray-700">Active</span>
                                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">Standard UI visibility</span>
                                    </div>
                                    <button
                                        disabled={!isEditing}
                                        onClick={() => {
                                            setCategories(prev => {
                                                const updateInTree = (nodes: CategoryNode[]): CategoryNode[] => {
                                                    return nodes.map(n => {
                                                        if (n.id === selectedNode.id) return { ...n, isActive: !n.isActive };
                                                        if (n.children) return { ...n, children: updateInTree(n.children) };
                                                        return n;
                                                    });
                                                };
                                                return updateInTree(prev);
                                            });
                                        }}
                                        className={`w-14 h-7 rounded-full relative transition-all ${selectedNode.isActive ? 'bg-indigo-600' : 'bg-gray-200'} ${!isEditing && 'opacity-60 cursor-not-allowed'}`}
                                    >
                                        <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-md transition-all ${selectedNode.isActive ? 'right-1' : 'left-1'}`} />
                                    </button>
                                </div>
                                <div className="flex flex-col gap-2 flex-grow">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Default Assignment Group</label>
                                    <select
                                        disabled={!isEditing}
                                        value={selectedNode.default_group_id || ''}
                                        onChange={(e) => {
                                            const val = e.target.value || null;
                                            setCategories(prev => {
                                                const updateInTree = (nodes: CategoryNode[]): CategoryNode[] => {
                                                    return nodes.map(n => {
                                                        if (n.id === selectedNode.id) return { ...n, default_group_id: val };
                                                        if (n.children) return { ...n, children: updateInTree(n.children) };
                                                        return n;
                                                    });
                                                };
                                                return updateInTree(prev);
                                            });
                                        }}
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 disabled:bg-gray-100/50 disabled:cursor-not-allowed transition-all"
                                    >
                                        <option value="">No Default Group</option>
                                        {availableGroups.map(g => (
                                            <option key={g.id} value={g.id}>{g.name}</option>
                                        ))}
                                    </select>
                                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wide ml-1">Tickets in this category will auto-route to this group</span>
                                </div>
                            </div>

                            {/* Assignment Strategy */}
                            <div className="space-y-4 pt-6 border-t border-gray-50">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Assignment Strategy</label>
                                <div className="grid grid-cols-2 gap-4">
                                    <button
                                        disabled={!isEditing}
                                        onClick={() => {
                                            setCategories(prev => {
                                                const updateInTree = (nodes: CategoryNode[]): CategoryNode[] => {
                                                    return nodes.map(n => {
                                                        if (n.id === selectedNode.id) return { ...n, assignment_strategy: 'manual' };
                                                        if (n.children) return { ...n, children: updateInTree(n.children) };
                                                        return n;
                                                    });
                                                };
                                                return updateInTree(prev);
                                            });
                                        }}
                                        className={`p-4 rounded-2xl border text-left transition-all ${selectedNode.assignment_strategy === 'manual' || !selectedNode.assignment_strategy ? 'bg-indigo-50 border-indigo-200 ring-1 ring-indigo-200' : 'bg-white border-gray-100 hover:bg-gray-50'} ${!isEditing && 'opacity-70 disabled:cursor-not-allowed'}`}
                                    >
                                        <div className="flex items-center gap-3 mb-1">
                                            <div className={`p-1.5 rounded-lg ${selectedNode.assignment_strategy === 'manual' || !selectedNode.assignment_strategy ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                                                <History size={14} />
                                            </div>
                                            <span className="font-black text-sm text-gray-800">Manual / Queue</span>
                                        </div>
                                        <p className="text-[10px] text-gray-500 font-semibold leading-relaxed">Tickets will sit in the group queue for manual distribution or pickup.</p>
                                    </button>

                                    <button
                                        disabled={!isEditing}
                                        onClick={() => {
                                            setCategories(prev => {
                                                const updateInTree = (nodes: CategoryNode[]): CategoryNode[] => {
                                                    return nodes.map(n => {
                                                        if (n.id === selectedNode.id) return { ...n, assignment_strategy: 'round_robin' };
                                                        if (n.children) return { ...n, children: updateInTree(n.children) };
                                                        return n;
                                                    });
                                                };
                                                return updateInTree(prev);
                                            });
                                        }}
                                        className={`p-4 rounded-2xl border text-left transition-all ${selectedNode.assignment_strategy === 'round_robin' ? 'bg-indigo-50 border-indigo-200 ring-1 ring-indigo-200' : 'bg-white border-gray-100 hover:bg-gray-50'} ${!isEditing && 'opacity-70 disabled:cursor-not-allowed'}`}
                                    >
                                        <div className="flex items-center gap-3 mb-1">
                                            <div className={`p-1.5 rounded-lg ${selectedNode.assignment_strategy === 'round_robin' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                                                <Settings size={14} className="animate-spin-slow" />
                                            </div>
                                            <span className="font-black text-sm text-gray-800">Round Robin</span>
                                        </div>
                                        <p className="text-[10px] text-gray-500 font-semibold leading-relaxed">Tickets will be automatically distributed evenly among active group agents.</p>
                                    </button>
                                </div>
                            </div>

                            {/* Visibility Section */}
                            <div className="space-y-6 pt-6 border-t border-gray-50">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Visibility Controls</label>
                                <div className="grid grid-cols-2 gap-4">
                                    {[
                                        { key: 'requestor', label: 'Requestor' },
                                        { key: 'agent', label: 'Agent' },
                                        { key: 'tier 2 agent', label: 'Tier 2 Agent' },
                                        { key: 'admin', label: 'Admin', forced: true }
                                    ].map((role) => (
                                        <div key={role.key} className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${selectedNode.visible_to.includes(role.key) ? 'bg-indigo-50/50 border-indigo-100' : 'bg-gray-50 border-gray-100'}`}>
                                            <div className="relative flex items-center">
                                                <input
                                                    type="checkbox"
                                                    disabled={!isEditing || role.forced}
                                                    checked={selectedNode.visible_to.includes(role.key)}
                                                    onChange={() => toggleVisibility(role.key)}
                                                    className="w-5 h-5 rounded-lg border-2 border-gray-200 text-indigo-600 focus:ring-indigo-500/20 disabled:checked:bg-indigo-300 transition-all cursor-pointer"
                                                />
                                            </div>
                                            <span className={`text-sm font-extrabold ${selectedNode.visible_to.includes(role.key) ? 'text-indigo-900' : 'text-gray-400'}`}>
                                                {role.label}
                                            </span>
                                            {role.forced && <div className="ml-auto text-[9px] font-black uppercase text-indigo-400 bg-indigo-100 px-1.5 py-0.5 rounded">Required</div>}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Audit Log Section */}
                            <div className="pt-10 border-t border-gray-50 flex items-center justify-between">
                                <div className="space-y-1">
                                    <h4 className="text-sm font-black text-gray-800">Compliance & Audit</h4>
                                    <p className="text-xs text-gray-400 font-medium">Tracking all classification changes for naming consistency.</p>
                                </div>
                                <button className="px-5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:border-indigo-500 hover:text-indigo-600 flex items-center gap-2 shadow-sm transition-all group">
                                    <History size={16} className="group-hover:rotate-180 transition-transform duration-500" />
                                    View Audit Log
                                </button>
                            </div>

                            {/* Level Protection Info */}
                            <div className="p-5 bg-blue-50/50 border border-blue-100 rounded-2xl flex gap-4">
                                <Info className="text-blue-500 flex-shrink-0" size={20} />
                                <div className="space-y-1">
                                    <p className="text-xs font-black text-blue-900 uppercase tracking-wide">Safety Logic Enabled</p>
                                    <p className="text-[11px] text-blue-800 font-medium leading-relaxed">
                                        Level depth is automatically set based on hierarchy. Hieratchy level {selectedNode.level} ensures proper reporting structure.
                                        {selectedNode.level === 5 ? " Maximum layer depth reached (Layer 5)." : " You can add subcategories to this node."}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-20">
                        <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mb-6 shadow-inner ring-8 ring-gray-50/50">
                            <Settings className="text-gray-200 animate-spin-slow" size={48} />
                        </div>
                        <h3 className="text-2xl font-black text-gray-800 mb-2 tracking-tight">Select a Category</h3>
                        <p className="text-gray-400 text-sm max-w-sm font-medium">
                            Choose a category or type from the sidebar to view and manage its configuration, visibility, and sub-layers.
                        </p>
                    </div>
                )}
            </div>

            {/* Add Category Modal */}
            {
                isAddModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center">
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsAddModalOpen(false)} />
                        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                            {/* Header */}
                            <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                                <div>
                                    <h3 className="text-xl font-black text-gray-900">
                                        {newCategoryData.parent_id ? 'Add Subcategory' : 'Add New Category'}
                                    </h3>
                                    <p className="text-xs text-gray-500 font-medium mt-1">
                                        {newCategoryData.parent_id ? `Under: ${flatNodes[newCategoryData.parent_id]?.name}` : 'Creating a top-level category'}
                                    </p>
                                </div>
                                <button onClick={() => setIsAddModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors">
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Body */}
                            <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                                {/* Metadata Row */}
                                <div className="flex gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Type</span>
                                        <div className="flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full ${newCategoryData.type === 'Incident' ? 'bg-indigo-500' : 'bg-orange-500'}`} />
                                            <span className="text-sm font-bold text-gray-700">{newCategoryData.type}</span>
                                        </div>
                                    </div>
                                    <div className="w-px bg-gray-200" />
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Level</span>
                                        <span className="block text-sm font-bold text-gray-700">{newCategoryData.level}</span>
                                    </div>
                                    <div className="w-px bg-gray-200" />
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Parent</span>
                                        <span className="block text-sm font-bold text-gray-700 truncate max-w-[150px]">
                                            {newCategoryData.parent_id ? flatNodes[newCategoryData.parent_id]?.name : 'None (Root)'}
                                        </span>
                                    </div>
                                </div>

                                {/* Name Input */}
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-gray-700 flex items-center gap-1">
                                        Name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={newCategoryData.name}
                                        onChange={(e) => setNewCategoryData({ ...newCategoryData, name: e.target.value })}
                                        placeholder="e.g., Access Issue"
                                        className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-800 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all placeholder:font-normal"
                                        autoFocus
                                    />
                                </div>

                                {/* Description Input */}
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-gray-700">Description</label>
                                    <textarea
                                        value={newCategoryData.description}
                                        onChange={(e) => setNewCategoryData({ ...newCategoryData, description: e.target.value })}
                                        placeholder="Optional description..."
                                        rows={3}
                                        className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all resize-none placeholder:font-normal"
                                    />
                                </div>

                                {/* Visibility & Status */}
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-3">
                                        <label className="text-xs font-bold text-gray-700">Visibility</label>
                                        <div className="space-y-2">
                                            {['requestor', 'agent', 'tier 2 agent', 'admin'].map((role) => (
                                                <label key={role} className="flex items-center gap-2 cursor-pointer group">
                                                    <input
                                                        type="checkbox"
                                                        checked={newCategoryData.visible_to.includes(role)}
                                                        disabled={role === 'admin'}
                                                        onChange={(e) => {
                                                            const newVisible = e.target.checked
                                                                ? [...newCategoryData.visible_to, role]
                                                                : newCategoryData.visible_to.filter(r => r !== role);
                                                            setNewCategoryData({ ...newCategoryData, visible_to: newVisible });
                                                        }}
                                                        className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500/20"
                                                    />
                                                    <span className={`text-xs font-medium ${newCategoryData.visible_to.includes(role) ? 'text-gray-900' : 'text-gray-500'}`}>
                                                        {role.charAt(0).toUpperCase() + role.slice(1)}
                                                    </span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-xs font-bold text-gray-700">Status</label>
                                        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                                            <button
                                                onClick={() => setNewCategoryData(prev => ({ ...prev, isActive: !prev.isActive }))}
                                                className={`w-10 h-6 rounded-full relative transition-all ${newCategoryData.isActive ? 'bg-indigo-600' : 'bg-gray-300'}`}
                                            >
                                                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${newCategoryData.isActive ? 'right-1' : 'left-1'}`} />
                                            </button>
                                            <span className="text-xs font-bold text-gray-700">{newCategoryData.isActive ? 'Active' : 'Inactive'}</span>
                                        </div>
                                    </div>
                                    <div className="space-y-3 col-span-2">
                                        <label className="text-xs font-bold text-gray-700">Default Assignment Group</label>
                                        <select
                                            value={newCategoryData.default_group_id || ''}
                                            onChange={(e) => setNewCategoryData(prev => ({ ...prev, default_group_id: e.target.value || null }))}
                                            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-800 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                                        >
                                            <option value="">No Default Group</option>
                                            {availableGroups.map(g => (
                                                <option key={g.id} value={g.id}>{g.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-3 col-span-2">
                                        <label className="text-xs font-bold text-gray-700">Assignment Strategy</label>
                                        <div className="flex gap-3">
                                            <button
                                                type="button"
                                                onClick={() => setNewCategoryData(prev => ({ ...prev, assignment_strategy: 'manual' }))}
                                                className={`flex-1 p-3 rounded-xl border text-left transition-all ${newCategoryData.assignment_strategy === 'manual' ? 'bg-indigo-50 border-indigo-200 ring-1 ring-indigo-200' : 'bg-white border-gray-100 hover:bg-gray-50'}`}
                                            >
                                                <span className="block font-bold text-xs text-gray-800 mb-1">Manual Queue</span>
                                                <span className="block text-[10px] text-gray-500 leading-tight">No auto-assignment</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setNewCategoryData(prev => ({ ...prev, assignment_strategy: 'round_robin' }))}
                                                className={`flex-1 p-3 rounded-xl border text-left transition-all ${newCategoryData.assignment_strategy === 'round_robin' ? 'bg-indigo-50 border-indigo-200 ring-1 ring-indigo-200' : 'bg-white border-gray-100 hover:bg-gray-50'}`}
                                            >
                                                <span className="block font-bold text-xs text-gray-800 mb-1">Round Robin</span>
                                                <span className="block text-[10px] text-gray-500 leading-tight">Auto-assign agents</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="px-8 py-5 border-t border-gray-100 bg-gray-50/50 flex items-center justify-end gap-3">
                                <button
                                    onClick={() => setIsAddModalOpen(false)}
                                    className="px-5 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl text-sm font-bold hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleCreateCategory}
                                    disabled={isCreating}
                                    className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {isCreating ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Creating...
                                        </>
                                    ) : (
                                        <>
                                            <Plus size={18} />
                                            {newCategoryData.parent_id ? 'Create Subcategory' : 'Create Category'}
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default CategoryManagement;
