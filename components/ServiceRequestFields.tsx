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
    Layout,
    Trash2,
    Type,
    List,
    Calendar,
    CheckSquare,
    Hash,
    FileText,
    Move,
    Eye,
    Save,
    X,
    AlertCircle,
    ArrowUp,
    ArrowDown,
    Link as LinkIcon,
    Paperclip,
    Edit2,
    Info
} from 'lucide-react';
// @ts-ignore
import Swal from 'https://cdn.jsdelivr.net/npm/sweetalert2@11/+esm';

interface CategoryNode {
    id: string;
    name: string;
    description?: string;
    type: 'Incident' | 'Service Request' | 'Change Request';
    level: number;
    children?: CategoryNode[];
    parent_id?: string | null;
}

interface CustomField {
    id: string;
    label: string;
    type: 'text' | 'textarea' | 'number' | 'date' | 'dropdown' | 'multiselect' | 'checkbox' | 'file' | 'label' | 'link';
    required: boolean;
    options?: string[]; // for dropdown/multiselect
    placeholder?: string;
    description?: string;
    defaultValue?: string; // used also for link URL or label text
}

const ServiceRequestFields: React.FC = () => {
    // --- Category Tree State (Reused) ---
    const [categories, setCategories] = useState<CategoryNode[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [ticketType, setTicketType] = useState<'Incident' | 'Service Request' | 'Change Request'>('Service Request'); // Default to SR
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

    // --- Field Editor State ---
    const [fields, setFields] = useState<CustomField[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [previewMode, setPreviewMode] = useState(true);
    const [isFieldsLoading, setIsFieldsLoading] = useState(false);

    useEffect(() => {
        fetchCategories();
    }, []);

    // Fetch Categories
    const fetchCategories = async () => {
        try {
            setIsLoading(true);
            const { data, error } = await supabase
                .from('ticket_categories')
                .select('id, name, description, category_type, level, parent_id')
                .order('level', { ascending: true })
                .order('name', { ascending: true });

            if (error) throw error;

            if (data && data.length > 0) {
                const nodes: CategoryNode[] = data.map((item: any) => ({
                    id: String(item.id),
                    name: item.name || 'Untitled',
                    description: item.description,
                    type: item.category_type,
                    level: item.level || 1,
                    parent_id: item.parent_id ? String(item.parent_id) : null,
                }));
                const tree = buildTree(nodes);
                setCategories(tree);
            }
        } catch (error) {
            console.error('Error fetching categories:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchFields = async (categoryId: string) => {
        try {
            setIsFieldsLoading(true);
            const { data, error } = await supabase
                .from('ticket_form_fields')
                .select('*')
                .eq('category_id', categoryId)
                .order('order_index', { ascending: true });

            if (error) throw error;

            if (data) {
                const mappedFields: CustomField[] = data.map((item: any) => ({
                    id: item.id,
                    label: item.label,
                    type: item.field_type as any,
                    required: item.is_required,
                    options: item.options || [],
                    placeholder: item.placeholder || '',
                    description: item.description || '',
                    defaultValue: item.default_value || ''
                }));
                setFields(mappedFields);
            } else {
                setFields([]);
            }
        } catch (error) {
            console.error('Error fetching fields:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Failed to load fields configuration.'
            });
        } finally {
            setIsFieldsLoading(false);
        }
    };

    const buildTree = (flatNodes: CategoryNode[]): CategoryNode[] => {
        const map: { [key: string]: CategoryNode } = {};
        const roots: CategoryNode[] = [];
        flatNodes.forEach(node => { map[node.id] = { ...node, children: [] }; });
        flatNodes.forEach(node => {
            if (node.parent_id && map[node.parent_id]) {
                map[node.parent_id].children?.push(map[node.id]);
            } else {
                roots.push(map[node.id]);
            }
        });
        return roots;
    };

    // Tree Helpers
    const toggleExpand = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const newExpanded = new Set(expandedNodes);
        if (newExpanded.has(id)) newExpanded.delete(id);
        else newExpanded.add(id);
        setExpandedNodes(newExpanded);
    };

    const renderTree = (nodes: CategoryNode[]) => {
        const filtered = nodes
            .filter(n => n.type === ticketType)
            .filter(n => !searchQuery || n.name.toLowerCase().includes(searchQuery.toLowerCase()) || n.children?.some(c => c.name.toLowerCase().includes(searchQuery.toLowerCase())));

        if (filtered.length === 0 && searchQuery === '') return <div className="p-4 text-center text-gray-400 text-xs text-center">No categories found.</div>;

        return filtered.map(node => {
            const hasChildren = node.children && node.children.length > 0;
            const isExpanded = expandedNodes.has(node.id);
            const isSelected = selectedNodeId === node.id;

            return (
                <div key={node.id} className="select-none">
                    <div
                        onClick={() => {
                            setSelectedNodeId(node.id);
                            fetchFields(node.id);
                            setPreviewMode(true);
                        }}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all group ${isSelected ? 'bg-indigo-50 border border-indigo-100 shadow-sm' : 'hover:bg-gray-50 border border-transparent'}`}
                    >
                        <div
                            onClick={(e) => hasChildren && toggleExpand(node.id, e)}
                            className="p-1 hover:bg-white rounded transition-colors"
                        >
                            {hasChildren ? (
                                isExpanded ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />
                            ) : <div className="w-[14px]" />}
                        </div>
                        <div className={`p-1.5 rounded-md ${isSelected ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                            {hasChildren ? (isExpanded ? <FolderOpen size={14} /> : <Folder size={14} />) : <Layout size={14} />}
                        </div>
                        <span className={`text-sm font-bold flex-1 truncate ${isSelected ? 'text-indigo-900' : 'text-gray-700'}`}>{node.name}</span>
                    </div>
                    {hasChildren && isExpanded && <div className="ml-4 mt-1 border-l border-gray-100 pl-2">{renderTree(node.children || [])}</div>}
                </div>
            );
        });
    };

    // Field Editor Actions
    const addField = () => {
        const newField: CustomField = {
            id: `temp-${Date.now()}`,
            label: 'New Field',
            type: 'text',
            required: false,
            placeholder: ''
        };
        setFields([...fields, newField]);
    };

    const updateField = (id: string, updates: Partial<CustomField>) => {
        setFields(fields.map(f => f.id === id ? { ...f, ...updates } : f));
    };

    const removeField = (id: string) => {
        setFields(fields.filter(f => f.id !== id));
    };

    const moveField = (index: number, direction: 'up' | 'down') => {
        const newFields = [...fields];
        if (direction === 'up' && index > 0) {
            [newFields[index], newFields[index - 1]] = [newFields[index - 1], newFields[index]];
        } else if (direction === 'down' && index < newFields.length - 1) {
            [newFields[index], newFields[index + 1]] = [newFields[index + 1], newFields[index]];
        }
        setFields(newFields);
    };

    const handleSaveFields = async () => {
        if (!selectedNodeId) return;
        setIsSaving(true);

        try {
            // 1. Delete existing fields for this category (Clean slate approach for easy reordering)
            // Note: In a production app with live ticket data, you might want to use upsert/diffing instead to preserve IDs.
            // But since this is a config editor, cleaning and rewriting guarantees the order_index is perfect.
            const { error: deleteError } = await supabase
                .from('ticket_form_fields')
                .delete()
                .eq('category_id', selectedNodeId);

            if (deleteError) throw deleteError;

            // 2. Prepare payload
            const payload = fields.map((f, index) => ({
                category_id: selectedNodeId,
                label: f.label,
                field_type: f.type,
                is_required: f.required,
                options: f.options || [],
                placeholder: f.placeholder,
                description: f.description,
                default_value: f.defaultValue,
                order_index: index
            }));

            // 3. Insert new fields
            if (payload.length > 0) {
                const { error: insertError } = await supabase
                    .from('ticket_form_fields')
                    .insert(payload);

                if (insertError) throw insertError;
            }

            // 4. Refresh to get real IDs back
            await fetchFields(selectedNodeId);

            Swal.fire({
                icon: 'success',
                title: 'Saved',
                text: 'Form configuration updated successfully',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 2000
            });
            setPreviewMode(true);

        } catch (error: any) {
            console.error('Error saving fields:', error);
            Swal.fire({
                icon: 'error',
                title: 'Save Failed',
                text: error.message || 'Could not save configuration'
            });
        } finally {
            setIsSaving(false);
        }
    };

    // Render Field Icon
    const getFieldIcon = (type: string) => {
        switch (type) {
            case 'text': return <Type size={16} />;
            case 'textarea': return <FileText size={16} />;
            case 'dropdown': return <List size={16} />;
            case 'multiselect': return <CheckSquare size={16} />;
            case 'date': return <Calendar size={16} />;
            case 'checkbox': return <CheckSquare size={16} />;
            case 'number': return <Hash size={16} />;
            case 'file': return <Paperclip size={16} />;
            case 'label': return <Info size={16} />;
            case 'link': return <LinkIcon size={16} />;
            default: return <Type size={16} />;
        }
    };

    const getNodeInfo = (id: string | null) => {
        if (!id) return null;
        const findNode = (nodes: CategoryNode[]): CategoryNode | null => {
            for (let n of nodes) {
                if (n.id === id) return n;
                if (n.children) {
                    const res = findNode(n.children);
                    if (res) return res;
                }
            }
            return null;
        }
        return findNode(categories);
    };

    const selectedNode = getNodeInfo(selectedNodeId);
    const selectedNodeName = selectedNode ? selectedNode.name : '';

    return (
        <div className="flex h-screen bg-white font-sans overflow-hidden">
            {/* LEFT PANEL — Category Tree */}
            <div className="w-[380px] border-r border-gray-100 flex flex-col bg-gray-50/30">
                <div className="p-8 pb-4">
                    <h2 className="text-xl font-black text-gray-900 tracking-tight mb-6">Field Configuration</h2>

                    {/* Ticket Type Toggle */}
                    <div className="flex p-1 bg-gray-200/50 rounded-xl mb-6">
                        {['Service Request', 'Change Request'].map((type) => (
                            <button
                                key={type}
                                onClick={() => {
                                    setTicketType(type as any);
                                    setSelectedNodeId(null);
                                    setFields([]);
                                }}
                                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${ticketType === type
                                    ? 'bg-white text-indigo-600 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
                                    }`}
                            >
                                {type === 'Service Request' ? 'Service Request' : 'Change Request'}
                            </button>
                        ))}
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
                </div >

                <div className="flex-1 overflow-y-auto px-6 py-4 custom-scrollbar space-y-1">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-40 space-y-3">
                            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                            <p className="text-xs text-gray-400 font-bold animate-pulse">Loading categories...</p>
                        </div>
                    ) : renderTree(categories)}
                </div>
            </div >

            {/* RIGHT PANEL — Field Editor */}
            {/* RIGHT PANEL — Field Editor */}
            <div className="flex-1 flex flex-col h-full overflow-hidden bg-gray-50">
                {selectedNodeId ? (
                    <>
                        {/* Header */}
                        <div className="bg-white border-b border-gray-200 px-8 py-5 flex items-center justify-between shadow-sm z-10">
                            <div>
                                <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
                                    Field Configuration
                                </h2>
                                <div className="flex items-center gap-2 text-xs font-bold text-gray-400 mt-1 uppercase tracking-wider">
                                    <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{ticketType}</span>
                                    <ChevronRight size={12} />
                                    <span>{selectedNodeName}</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setPreviewMode(!previewMode)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${previewMode
                                        ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200'
                                        : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200 shadow-sm'
                                        }`}
                                >
                                    {previewMode ? (
                                        <>
                                            <Edit2 size={16} />
                                            Edit Configuration
                                        </>
                                    ) : (
                                        <>
                                            <Eye size={16} />
                                            Preview Form
                                        </>
                                    )}
                                </button>

                                {!previewMode && (
                                    <button
                                        onClick={handleSaveFields}
                                        disabled={isSaving}
                                        className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-lg text-sm font-bold shadow-md shadow-indigo-200 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                                    >
                                        {isSaving ? (
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        ) : (
                                            <Save size={16} />
                                        )}
                                        Save Config
                                    </button>
                                )}
                            </div>
                        </div >

                        {
                            isFieldsLoading ? (
                                <div className="flex-1 flex items-center justify-center" >
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="w-8 h-8 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
                                        <p className="text-sm font-bold text-gray-400 animate-pulse">Loading fields...</p>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {previewMode ? (
                                        // PREVIEW MODE (VIEW ONLY)
                                        <div className="flex-1 overflow-y-auto bg-gray-50/50 p-12">
                                            <div className="max-w-2xl mx-auto bg-white p-8 rounded-2xl shadow-sm border border-gray-200 space-y-6 animate-in fade-in duration-300">
                                                <div className="pb-6 border-b border-gray-100">
                                                    <h2 className="text-2xl font-black text-gray-800">New Service Request</h2>
                                                    <p className="text-gray-500 text-sm mt-1">Submit a request for <span className="font-bold text-gray-700">{selectedNodeName}</span></p>
                                                    {categories.find(c => c.id === selectedNodeId)?.description ? (
                                                        <p className="text-sm text-gray-600 mt-2 leading-relaxed">{categories.find(c => c.id === selectedNodeId)?.description}</p>
                                                    ) : (
                                                        <p className="text-sm text-gray-400 mt-2 italic">No description available for this category.</p>
                                                    )}
                                                </div>

                                                <div className="space-y-6">
                                                    {/* Custom Fields */}
                                                    {fields.length === 0 ? (
                                                        <div className="py-12 text-center border-2 border-dashed border-gray-200 rounded-xl bg-gray-50">
                                                            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3 text-gray-400">
                                                                <Layout size={20} />
                                                            </div>
                                                            <p className="text-sm text-gray-500 font-medium">No custom fields configured.</p>
                                                            <p className="text-xs text-gray-400 mt-1">Click "Edit Configuration" to add fields.</p>
                                                        </div>
                                                    ) : fields.map(field => (
                                                        <div key={field.id} className="space-y-2">
                                                            {/* Skip Label/Link Rendering here, handle specially */}
                                                            {field.type === 'label' ? (
                                                                <div className="py-2 text-sm font-bold text-gray-700 border-b border-gray-100 uppercase tracking-wider mt-6 mb-2">{field.label}</div>
                                                            ) : field.type === 'link' ? (
                                                                <div className="py-2 flex items-center gap-2">
                                                                    <LinkIcon size={14} className="text-indigo-600" />
                                                                    <a href={field.defaultValue || '#'} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-indigo-600 hover:underline">
                                                                        {field.label}
                                                                    </a>
                                                                    {field.description && <span className="text-xs text-gray-400"> - {field.description}</span>}
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    <label className="block text-sm font-bold text-gray-700">
                                                                        {field.label} {field.required && <span className="text-red-500">*</span>}
                                                                    </label>

                                                                    {field.type === 'textarea' ? (
                                                                        <textarea
                                                                            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:font-normal text-sm"
                                                                            rows={3}
                                                                            placeholder={field.placeholder}
                                                                        />
                                                                    ) : field.type === 'dropdown' ? (
                                                                        <select className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm">
                                                                            <option value="">Select option...</option>
                                                                            {field.options?.map((opt, i) => <option key={i} value={opt}>{opt}</option>)}
                                                                        </select>
                                                                    ) : field.type === 'multiselect' ? (
                                                                        <div className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all h-[120px] overflow-y-auto custom-scrollbar">
                                                                            <div className="text-[10px] text-gray-400 mb-2 font-bold uppercase tracking-wide">Select one or more:</div>
                                                                            {field.options?.map((opt, i) => (
                                                                                <label key={i} className="flex items-center gap-2 py-1.5 cursor-pointer hover:bg-gray-50 rounded px-1 transition-colors">
                                                                                    <input type="checkbox" className="w-4 h-4 rounded text-indigo-600 border-gray-300 focus:ring-indigo-500" />
                                                                                    <span className="text-sm text-gray-700">{opt}</span>
                                                                                </label>
                                                                            ))}
                                                                        </div>
                                                                    ) : field.type === 'checkbox' ? (
                                                                        <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                                                                            <input type="checkbox" className="w-5 h-5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500" />
                                                                            <span className="text-sm font-medium text-gray-700">{field.placeholder || field.label}</span>
                                                                        </label>
                                                                    ) : field.type === 'file' ? (
                                                                        <div className="w-full px-4 py-8 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center text-gray-400 hover:bg-gray-50 hover:border-indigo-200 transition-all cursor-pointer group">
                                                                            <div className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                                                                                <Paperclip size={20} className="text-gray-400 group-hover:text-indigo-500" />
                                                                            </div>
                                                                            <span className="text-xs font-bold text-gray-500 group-hover:text-indigo-600">Click to upload file</span>
                                                                        </div>
                                                                    ) : (
                                                                        <input
                                                                            type={field.type}
                                                                            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:font-normal text-sm"
                                                                            placeholder={field.placeholder}
                                                                        />
                                                                    )}
                                                                    {field.description && <p className="text-xs text-gray-400 mt-1">{field.description}</p>}
                                                                </>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        // EDIT MODE
                                        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                                            <div className="max-w-3xl mx-auto space-y-6">

                                                {/* Fields List */}
                                                <div className="space-y-4">
                                                    {fields.map((field, index) => (
                                                        <div key={field.id} className="group bg-white p-5 rounded-2xl border border-gray-200 shadow-sm hover:border-indigo-300 hover:shadow-md transition-all animate-in slide-in-from-bottom-2 duration-300 relative">
                                                            {/* Reorder Controls */}
                                                            <div className="absolute right-3 top-3 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <button onClick={() => moveField(index, 'up')} disabled={index === 0} className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-indigo-600 disabled:opacity-30">
                                                                    <ArrowUp size={14} />
                                                                </button>
                                                                <button onClick={() => moveField(index, 'down')} disabled={index === fields.length - 1} className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-indigo-600 disabled:opacity-30">
                                                                    <ArrowDown size={14} />
                                                                </button>
                                                            </div>

                                                            <div className="flex items-start gap-4">
                                                                <div className="mt-3 text-gray-300 cursor-move hover:text-gray-500">
                                                                    <GripVertical size={20} />
                                                                </div>

                                                                <div className="flex-1 space-y-4">
                                                                    <div className="grid grid-cols-12 gap-4">
                                                                        {/* Label */}
                                                                        <div className="col-span-12 md:col-span-5 space-y-1">
                                                                            <label className="text-[10px] uppercase font-black text-gray-400 tracking-wider">
                                                                                {field.type === 'label' ? 'Display Text' : field.type === 'link' ? 'Link Text' : 'Field Label'}
                                                                            </label>
                                                                            <input
                                                                                type="text"
                                                                                value={field.label}
                                                                                onChange={(e) => updateField(field.id, { label: e.target.value })}
                                                                                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold text-gray-800 focus:bg-white focus:border-indigo-500 focus:outline-none transition-all"
                                                                                placeholder={field.type === 'label' ? 'e.g. Important Notice' : "e.g. Account ID"}
                                                                            />
                                                                        </div>

                                                                        {/* Type */}
                                                                        <div className="col-span-12 md:col-span-4 space-y-1">
                                                                            <label className="text-[10px] uppercase font-black text-gray-400 tracking-wider">Type</label>
                                                                            <div className="relative">
                                                                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">
                                                                                    {getFieldIcon(field.type)}
                                                                                </div>
                                                                                <select
                                                                                    value={field.type}
                                                                                    onChange={(e) => {
                                                                                        const val = e.target.value as any;
                                                                                        const updates: any = { type: val };
                                                                                        if (val === 'file' && !field.description) {
                                                                                            updates.description = 'Max file size: 1MB. Allowed: PDF, JPG, PNG';
                                                                                        }
                                                                                        updateField(field.id, updates);
                                                                                    }}
                                                                                    className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 focus:bg-white focus:border-indigo-500 focus:outline-none appearance-none transition-all cursor-pointer"
                                                                                >
                                                                                    <optgroup label="Input Fields">
                                                                                        <option value="text">Short Text</option>
                                                                                        <option value="textarea">Long Text / Description</option>
                                                                                        <option value="number">Number</option>
                                                                                        <option value="date">Date Picker</option>
                                                                                        <option value="checkbox">Checkbox / Toggle</option>
                                                                                        <option value="file">File Attachment</option>
                                                                                    </optgroup>
                                                                                    <optgroup label="Selection">
                                                                                        <option value="dropdown">Dropdown (Single)</option>
                                                                                        <option value="multiselect">Dropdown (Multi-Select)</option>
                                                                                    </optgroup>
                                                                                    <optgroup label="Static Content">
                                                                                        <option value="label">Label / Header</option>
                                                                                        <option value="link">Hyperlink</option>
                                                                                    </optgroup>
                                                                                </select>
                                                                            </div>
                                                                        </div>

                                                                        {/* Required Toggle (Hidden for static types) */}
                                                                        {field.type !== 'label' && field.type !== 'link' && (
                                                                            <div className="col-span-6 md:col-span-2 space-y-1 flex flex-col items-center">
                                                                                <label className="text-[10px] uppercase font-black text-gray-400 tracking-wider">Required</label>
                                                                                <button
                                                                                    onClick={() => updateField(field.id, { required: !field.required })}
                                                                                    className={`w-10 h-6 rounded-full relative transition-all mt-1 ${field.required ? 'bg-indigo-600' : 'bg-gray-200'}`}
                                                                                >
                                                                                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${field.required ? 'right-1' : 'left-1'}`} />
                                                                                </button>
                                                                            </div>
                                                                        )}

                                                                        {/* Delete */}
                                                                        <div className="col-span-6 md:col-span-1 flex items-center justify-end pt-5">
                                                                            <button
                                                                                onClick={() => removeField(field.id)}
                                                                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                                            >
                                                                                <Trash2 size={18} />
                                                                            </button>
                                                                        </div>
                                                                    </div>

                                                                    {/* Dynamic Options for Dropdown/Multiselect */}
                                                                    {(field.type === 'dropdown' || field.type === 'multiselect') && (
                                                                        <div className="bg-orange-50/50 p-4 rounded-xl border border-orange-100 space-y-2 animate-in fade-in zoom-in-95">
                                                                            <label className="text-[10px] uppercase font-black text-orange-400 tracking-wider">Options (Comma separated)</label>
                                                                            <input
                                                                                type="text"
                                                                                value={field.options?.join(', ') || ''}
                                                                                onChange={(e) => updateField(field.id, { options: e.target.value.split(',').map(s => s.trim()) })}
                                                                                className="w-full px-3 py-2 bg-white border border-orange-200 rounded-lg text-sm text-gray-700 focus:border-orange-400 focus:outline-none placeholder:text-orange-200"
                                                                                placeholder="Option 1, Option 2, Option 3"
                                                                            />
                                                                        </div>
                                                                    )}

                                                                    {/* URL Input for Link */}
                                                                    {field.type === 'link' && (
                                                                        <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 space-y-2 animate-in fade-in zoom-in-95">
                                                                            <label className="text-[10px] uppercase font-black text-blue-400 tracking-wider">Valid URL</label>
                                                                            <input
                                                                                type="text"
                                                                                value={field.defaultValue || ''}
                                                                                onChange={(e) => updateField(field.id, { defaultValue: e.target.value })}
                                                                                className="w-full px-3 py-2 bg-white border border-blue-200 rounded-lg text-sm text-gray-700 focus:border-blue-400 focus:outline-none placeholder:text-blue-200 font-mono"
                                                                                placeholder="https://example.com/doc"
                                                                            />
                                                                        </div>
                                                                    )}

                                                                    {/* Description/Help Text (Hidden for Label) */}
                                                                    {field.type !== 'label' && (
                                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                            {field.type !== 'link' && (
                                                                                <input
                                                                                    type="text"
                                                                                    value={field.placeholder || ''}
                                                                                    onChange={(e) => updateField(field.id, { placeholder: e.target.value })}
                                                                                    placeholder="Placeholder text..."
                                                                                    className="px-3 py-2 bg-white border border-gray-100 rounded-lg text-xs text-gray-600 focus:border-indigo-300 focus:outline-none"
                                                                                />
                                                                            )}
                                                                            <input
                                                                                type="text"
                                                                                value={field.description || ''}
                                                                                onChange={(e) => updateField(field.id, { description: e.target.value })}
                                                                                placeholder="Help tooltip / description..."
                                                                                className="px-3 py-2 bg-white border border-gray-100 rounded-lg text-xs text-gray-600 focus:border-indigo-300 focus:outline-none"
                                                                            />
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}

                                                    {/* Add Field Button */}
                                                    <button
                                                        onClick={addField}
                                                        className="w-full py-4 border-2 border-dashed border-gray-300 rounded-2xl text-gray-400 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all flex items-center justify-center gap-2 font-bold mb-12"
                                                    >
                                                        <Plus size={20} />
                                                        Add New Field
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-300">
                        <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4 rotate-12">
                            <FileText size={32} />
                        </div>
                        <p className="font-bold text-gray-400">Select a category to configure fields</p>
                    </div>
                )}
            </div >

            {/* Minimal Styles for custom-scrollbar/animations */}
            {/* Minimal Styles for custom-scrollbar/animations */}
            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { bg: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #e5e7eb; border-radius: 20px; }
                .animate-spin-slow { animation: spin 8s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div >
    );
};

// Simple Chevron Icon for Select
const ChevronDown: React.FC<{ size?: number; className?: string }> = ({ size = 16, className }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <polyline points="6 9 12 15 18 9"></polyline>
    </svg>
);

export default ServiceRequestFields;
