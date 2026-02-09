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
    Edit3,
    History,
    Info,
    ChevronDown,
    Layout,
    Check,
    X,
    ArrowLeft,
    Loader2
} from 'lucide-react';
import Swal from 'sweetalert2';

interface KBCategoryNode {
    id: string;
    name: string;
    level: number;
    description?: string;
    isActive: boolean;
    children?: KBCategoryNode[];
    parent_id?: string | null;
}

interface KBCategoryManagementProps {
    onClose: () => void;
}

const KBCategoryManagement: React.FC<KBCategoryManagementProps> = ({ onClose }) => {
    const [categories, setCategories] = useState<KBCategoryNode[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
    const [isEditing, setIsEditing] = useState(false);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isCreating, setIsCreating] = useState(false);

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        isActive: true,
        parent_id: null as string | null,
        level: 1
    });

    useEffect(() => {
        fetchCategories();
    }, []);

    const fetchCategories = async () => {
        try {
            setIsLoading(true);
            const { data, error } = await supabase
                .from('kb_categories')
                .select('*')
                .order('name', { ascending: true });

            if (error) throw error;

            if (data) {
                const nodes: KBCategoryNode[] = data.map((item: any) => ({
                    id: String(item.id),
                    name: item.name,
                    level: item.level || 1, // Assumption: level might be calculated or present
                    description: item.description || '',
                    isActive: item.is_active ?? true,
                    parent_id: item.parent_id ? String(item.parent_id) : null,
                }));

                // Calculate levels dynamically if not present or just trust the tree builder
                const tree = buildTree(nodes);
                setCategories(tree);
            } else {
                setCategories([]);
            }
        } catch (error) {
            console.error('Error fetching KB categories:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async (node: KBCategoryNode) => {
        try {
            const { error } = await supabase
                .from('kb_categories')
                .update({
                    name: node.name,
                    description: node.description,
                    is_active: node.isActive
                })
                .eq('id', node.id);

            if (error) throw error;
            setIsEditing(false);
            fetchCategories();
            Swal.fire({
                icon: 'success',
                title: 'Saved',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 2000
            });
        } catch (error) {
            console.error('Error updating category:', error);
            Swal.fire('Error', 'Failed to save changes', 'error');
        }
    };

    const buildTree = (flatNodes: KBCategoryNode[]): KBCategoryNode[] => {
        const map: { [key: string]: KBCategoryNode } = {};
        const roots: KBCategoryNode[] = [];

        flatNodes.forEach(node => {
            map[node.id] = { ...node, children: [] };
        });

        flatNodes.forEach(node => {
            if (node.parent_id && map[node.parent_id]) {
                // Calculate level based on parent
                map[node.id].level = (map[node.parent_id].level || 1) + 1;
                map[node.parent_id].children?.push(map[node.id]);
            } else {
                map[node.id].level = 1;
                roots.push(map[node.id]);
            }
        });

        return roots;
    };

    // Flatten for easy lookup
    const flatNodes = useMemo(() => {
        const flat: { [key: string]: KBCategoryNode } = {};
        const traverse = (nodes: KBCategoryNode[]) => {
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

    // Breadcrumbs
    const getBreadcrumbs = (nodeId: string | null): KBCategoryNode[] => {
        if (!nodeId) return [];
        const path: KBCategoryNode[] = [];
        const findPath = (nodes: KBCategoryNode[], targetId: string): boolean => {
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

    const renderTree = (nodes: KBCategoryNode[]) => {
        const filtered = nodes.filter(n =>
            !searchQuery ||
            n.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            n.children?.some(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
        );

        if (nodes.length === 0 && searchQuery === '') {
            // Only show empty state if it's the root call and truly empty
            return null;
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
                            {renderTree(node.children || [])}
                        </div>
                    )}
                </div>
            );
        });
    };

    const handleOpenAddModal = (parentNode: KBCategoryNode | null = null) => {
        if (parentNode && (parentNode.level || 1) >= 2) { // Limit depth to 2 to match ArticleEditor UI (Main > Sub)
            Swal.fire('Limit Reached', 'Only 2 levels of categories are supported (Main > Sub).', 'warning');
            return;
        }

        setFormData({
            name: '',
            description: '',
            isActive: true,
            parent_id: parentNode ? parentNode.id : null,
            level: parentNode ? (parentNode.level || 1) + 1 : 1
        });
        setIsAddModalOpen(true);
    };

    const handleCreateCategory = async () => {
        if (!formData.name.trim()) {
            Swal.fire('Validation Error', 'Category name is required', 'error');
            return;
        }

        try {
            setIsCreating(true);
            const { data, error } = await supabase
                .from('kb_categories')
                .insert([{
                    name: formData.name.trim(),
                    description: formData.description,
                    parent_id: formData.parent_id,
                    is_active: formData.isActive
                }])
                .select()
                .single();

            if (error) throw error;

            Swal.fire({
                icon: 'success',
                title: 'Category Created',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 2000
            });

            setIsAddModalOpen(false);
            fetchCategories();

            if (formData.parent_id) {
                setExpandedNodes(prev => new Set([...prev, formData.parent_id!]));
            }
            if (data) setSelectedNodeId(String(data.id));

        } catch (error: any) {
            console.error('Error creating KB category:', error);
            Swal.fire('Error', error.message || 'Failed to create category', 'error');
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-white font-sans overflow-hidden">
            {/* Header with Back Button */}
            <div className="h-16 px-6 border-b border-gray-200 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h2 className="text-lg font-bold text-gray-900">Knowledge Base Categories</h2>
                        <p className="text-xs text-gray-500">Manage knowledge base structure</p>
                    </div>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* LEFT PANEL — Category Tree */}
                <div className="w-[320px] border-r border-gray-100 flex flex-col bg-gray-50/30">
                    <div className="p-4 space-y-4">
                        <div className="relative">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto px-4 py-2 custom-scrollbar space-y-1">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center py-10">
                                <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                            </div>
                        ) : categories.length === 0 ? (
                            <div className="text-center py-10 text-gray-400 text-xs">No categories found.</div>
                        ) : (
                            renderTree(categories)
                        )}
                    </div>

                    <div className="p-4 border-t border-gray-200 bg-white">
                        <button
                            onClick={() => handleOpenAddModal(null)}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 px-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 transition-all text-sm"
                        >
                            <Plus size={16} />
                            Add Root Category
                        </button>
                    </div>
                </div>

                {/* RIGHT PANEL — Details */}
                <div className="flex-1 flex flex-col bg-white">
                    {selectedNode ? (
                        <>
                            <div className="px-8 py-4 border-b border-gray-50 flex justify-between items-center">
                                <div className="flex items-center gap-2 overflow-hidden">
                                    {getBreadcrumbs(selectedNode.id).map((node, i, arr) => (
                                        <React.Fragment key={node.id}>
                                            <span className={`text-xs font-bold whitespace-nowrap ${i === arr.length - 1 ? 'text-indigo-600' : 'text-gray-400'}`}>
                                                {node.name}
                                            </span>
                                            {i < arr.length - 1 && <ChevronRight size={12} className="text-gray-300" />}
                                        </React.Fragment>
                                    ))}
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    {isEditing ? (
                                        <>
                                            <button onClick={() => setIsEditing(false)} className="px-3 py-1.5 border rounded-lg text-xs font-bold hover:bg-gray-50">Cancel</button>
                                            <button onClick={() => handleSave(selectedNode)} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700">Save</button>
                                        </>
                                    ) : (
                                        <>
                                            <button onClick={() => handleOpenAddModal(selectedNode)} className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold hover:bg-indigo-100 flex items-center gap-1">
                                                <Plus size={14} /> Sub
                                            </button>
                                            <button onClick={() => setIsEditing(true)} className="px-3 py-1.5 border rounded-lg text-xs font-bold hover:bg-gray-50 flex items-center gap-1">
                                                <Edit3 size={14} /> Edit
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-8 space-y-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-gray-400 uppercase">Category Name</label>
                                    <input
                                        type="text"
                                        disabled={!isEditing}
                                        value={selectedNode.name}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setCategories(prev => {
                                                const updateInTree = (nodes: KBCategoryNode[]): KBCategoryNode[] => nodes.map(n => {
                                                    if (n.id === selectedNode.id) return { ...n, name: val };
                                                    if (n.children) return { ...n, children: updateInTree(n.children) };
                                                    return n;
                                                });
                                                return updateInTree(prev);
                                            });
                                        }}
                                        className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-lg font-bold text-gray-800 disabled:bg-gray-100/50"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-gray-400 uppercase">Description</label>
                                    <textarea
                                        disabled={!isEditing}
                                        rows={3}
                                        value={selectedNode.description || ''}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setCategories(prev => {
                                                const updateInTree = (nodes: KBCategoryNode[]): KBCategoryNode[] => nodes.map(n => {
                                                    if (n.id === selectedNode.id) return { ...n, description: val };
                                                    if (n.children) return { ...n, children: updateInTree(n.children) };
                                                    return n;
                                                });
                                                return updateInTree(prev);
                                            });
                                        }}
                                        className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm disabled:bg-gray-100/50 resize-none"
                                        placeholder="No description set."
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-gray-400 uppercase">Status</label>
                                    <div className="flex items-center gap-3">
                                        <button
                                            disabled={!isEditing}
                                            onClick={() => {
                                                setCategories(prev => {
                                                    const updateInTree = (nodes: KBCategoryNode[]): KBCategoryNode[] => nodes.map(n => {
                                                        if (n.id === selectedNode.id) return { ...n, isActive: !n.isActive };
                                                        if (n.children) return { ...n, children: updateInTree(n.children) };
                                                        return n;
                                                    });
                                                    return updateInTree(prev);
                                                });
                                            }}
                                            className={`w-12 h-6 rounded-full relative transition-all ${selectedNode.isActive ? 'bg-green-500' : 'bg-gray-300'} ${!isEditing && 'opacity-60 cursor-not-allowed'}`}
                                        >
                                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${selectedNode.isActive ? 'right-1' : 'left-1'}`} />
                                        </button>
                                        <span className="text-sm font-bold text-gray-700">{selectedNode.isActive ? 'Active' : 'Inactive'}</span>
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-10 text-gray-400">
                            <Settings className="mb-4 text-gray-200" size={48} />
                            <p>Select a category to view details</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Add Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsAddModalOpen(false)} />
                    <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-gray-900">{formData.parent_id ? 'New Subcategory' : 'New Category'}</h3>
                            <button onClick={() => setIsAddModalOpen(false)}><X size={20} className="text-gray-400" /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-gray-700">Name</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                                    placeholder="Category Name"
                                    autoFocus
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-gray-700">Description</label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none resize-none"
                                    rows={3}
                                    placeholder="Optional"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="isActiveNew"
                                    checked={formData.isActive}
                                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                                    className="rounded text-indigo-600 focus:ring-indigo-500"
                                />
                                <label htmlFor="isActiveNew" className="text-sm font-medium text-gray-700">Active</label>
                            </div>
                        </div>
                        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-2">
                            <button onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                            <button
                                onClick={handleCreateCategory}
                                disabled={isCreating}
                                className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg flex items-center gap-2"
                            >
                                {isCreating && <Loader2 size={14} className="animate-spin" />}
                                Create
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default KBCategoryManagement;
