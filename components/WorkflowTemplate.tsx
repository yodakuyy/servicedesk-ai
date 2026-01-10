import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import {
    Plus,
    Edit,
    Trash2,
    Search,
    Filter,
    ArrowLeft,
    Save,
    Layout,
    ArrowRight,
    X,
    GripVertical,
    CheckCircle,
    XCircle,
    Settings,
    MoreVertical,
    AlertTriangle
} from 'lucide-react';

// --- Interfaces ---

interface WorkflowTemplate {
    id: string;
    name: string;
    description: string;
    category: string;
    version: number;
    is_active: boolean;
    created_at: string;
}

interface TicketStatus {
    status_id: string; // uuid - primary key from database
    status_code: string;
    status_name: string;
    status_category: 'open' | 'pending' | 'resolved' | 'closed' | 'system';
    is_final: boolean;
    sla_behavior: 'run' | 'pause' | 'stop';
}

interface WorkflowNode {
    id: string; // internal temp id for builder
    statusId: string; // from ticket_statuses
    statusName: string;
    statusCode: string;
    category: string;
    x: number;
    y: number;
}

interface WorkflowTransition {
    id: string; // internal temp id
    fromNodeId: string;
    toNodeId: string;
}

// --- List View Component ---

const TemplateList = ({
    templates,
    onCreate,
    onEdit,
    onDelete,
    loading
}: {
    templates: WorkflowTemplate[],
    onCreate: () => void,
    onEdit: (t: WorkflowTemplate) => void,
    onDelete: (id: string) => void,
    loading: boolean
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Workflow Templates</h2>
                    <p className="text-gray-500">Manage blueprint workflows for different departments</p>
                </div>
                <button
                    onClick={onCreate}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 flex items-center gap-2 font-medium shadow-sm transition-colors"
                >
                    <Plus size={18} />
                    Create Template
                </button>
            </div>

            <div className="flex gap-4 items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <div className="relative flex-1">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search templates..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Filter size={18} className="text-gray-400" />
                    <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm"
                    >
                        <option value="all">All Categories</option>
                        <option value="IT">IT</option>
                        <option value="HR">HR</option>
                        <option value="Finance">Finance</option>
                        <option value="General">General</option>
                    </select>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-12 text-gray-500">Loading templates...</div>
            ) : templates.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Layout size={32} className="text-gray-400" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-800 mb-1">No Templates Found</h3>
                    <p className="text-gray-500 mb-4">Get started by creating your first workflow template.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {templates.filter(t =>
                        (categoryFilter === 'all' || t.category === categoryFilter) &&
                        (t.name.toLowerCase().includes(searchQuery.toLowerCase()))
                    ).map(template => (
                        <div key={template.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all group relative cursor-pointer" onClick={() => onEdit(template)}>
                            <div className="flex justify-between items-start mb-4">
                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${template.category === 'IT' ? 'bg-blue-50 text-blue-600' :
                                    template.category === 'HR' ? 'bg-pink-50 text-pink-600' :
                                        template.category === 'Finance' ? 'bg-green-50 text-green-600' :
                                            'bg-gray-100 text-gray-600'
                                    }`}>
                                    {template.category}
                                </span>
                                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onDelete(template.id); }}
                                        className="p-2 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-600 transition-colors"
                                        title="Delete"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>

                            <h3 className="text-lg font-bold text-gray-800 mb-2 group-hover:text-indigo-600 transition-colors">
                                {template.name}
                            </h3>
                            <p className="text-sm text-gray-500 line-clamp-2 mb-4 h-10">
                                {template.description || 'No description provided.'}
                            </p>

                            <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded text-gray-600 border border-gray-200">
                                        v{template.version}
                                    </span>
                                    {template.is_active ? (
                                        <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                                            <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div> Active
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-1 text-xs text-gray-400 font-medium">
                                            <div className="w-1.5 h-1.5 rounded-full bg-gray-300"></div> Draft
                                        </span>
                                    )}
                                </div>
                                <span className="text-sm font-medium text-indigo-600 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                                    Configure <ArrowRight size={16} />
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// --- Builder Component ---

const WorkflowBuilder = ({
    templateId,
    templateName,
    onBack,
    onSave
}: {
    templateId: string,
    templateName: string,
    onBack: () => void,
    onSave: (nodes: WorkflowNode[], transitions: WorkflowTransition[]) => Promise<void>
}) => {
    const [statuses, setStatuses] = useState<TicketStatus[]>([]);
    const [nodes, setNodes] = useState<WorkflowNode[]>([]);
    const [transitions, setTransitions] = useState<WorkflowTransition[]>([]);
    const [loading, setLoading] = useState(true);

    // Canvas State
    const canvasRef = useRef<HTMLDivElement>(null);
    const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
    const [isDrawingMode, setIsDrawingMode] = useState(false);
    const [drawingStartNodeId, setDrawingStartNodeId] = useState<string | null>(null);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

    useEffect(() => {
        fetchData();
    }, [templateId]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Fetch Ticket Statuses
            const { data: statusData } = await supabase.from('ticket_statuses').select('*').order('is_final');
            setStatuses(statusData || []);

            // 2. Fetch Existing Workflow Configuration
            // Statuses - using correct column name workflow_status_id
            const { data: wfStatuses, error: wfStatusError } = await supabase
                .from('workflow_statuses')
                .select(`
                    workflow_status_id, 
                    status_id, 
                    ticket_statuses:status_id (status_name, status_code, status_category),
                    sort_order
                `)
                .eq('workflow_template_id', templateId)
                .order('sort_order');

            console.log('Loaded workflow_statuses:', wfStatuses, 'Error:', wfStatusError);

            // Transitions
            const { data: wfTransitions, error: wfTransError } = await supabase
                .from('workflow_transitions')
                .select('*')
                .eq('workflow_id', templateId);

            console.log('Loaded workflow_transitions:', wfTransitions, 'Error:', wfTransError);

            // 3. Map to UI Model
            // Since we might not have X/Y stored, we calculate auto-layout or use sort_order
            let loadedNodes: WorkflowNode[] = [];

            if (wfStatuses && wfStatuses.length > 0) {
                // Simple Layout Calculation
                loadedNodes = wfStatuses.map((ws: any, index: number) => ({
                    id: ws.workflow_status_id, // Use correct column name
                    statusId: ws.status_id,
                    statusName: ws.ticket_statuses?.status_name || 'Unknown',
                    statusCode: ws.ticket_statuses?.status_code || '',
                    category: ws.ticket_statuses?.status_category || 'open',
                    x: 50 + (index % 4) * 220, // Grid layout fallback
                    y: 50 + Math.floor(index / 4) * 150
                }));
            }

            console.log('Mapped nodes:', loadedNodes);

            // Map transitions
            const loadedTransitions: WorkflowTransition[] = (wfTransitions || []).map((t: any) => ({
                id: t.transition_id,
                fromNodeId: t.from_status_id, // These reference workflow_statuses.workflow_status_id
                toNodeId: t.to_status_id
            })).filter(t =>
                loadedNodes.some(n => n.id === t.fromNodeId) &&
                loadedNodes.some(n => n.id === t.toNodeId)
            );

            console.log('Mapped transitions:', loadedTransitions);

            setNodes(loadedNodes);
            setTransitions(loadedTransitions);

        } catch (error) {
            console.error('Error loading builder data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddStatus = (status: TicketStatus) => {
        // Prevent duplicate status if typically 1 status type per workflow? 
        // Or allow multiples? Usually 1.
        if (nodes.some(n => n.statusId === status.status_id)) {
            alert('Status already added to workflow');
            return;
        }

        const newNode: WorkflowNode = {
            id: `temp-${Date.now()}`,
            statusId: status.status_id,
            statusName: status.status_name,
            statusCode: status.status_code,
            category: status.status_category,
            x: 250, // Default center
            y: 100
        };
        setNodes([...nodes, newNode]);
    };

    const handleRemoveNode = (nodeId: string) => {
        setNodes(nodes.filter(n => n.id !== nodeId));
        setTransitions(transitions.filter(t => t.fromNodeId !== nodeId && t.toNodeId !== nodeId));
    };

    const handleCanvasMouseMove = (e: React.MouseEvent) => {
        if (draggedNodeId) {
            const canvasRect = canvasRef.current?.getBoundingClientRect();
            if (!canvasRect) return;

            const x = e.clientX - canvasRect.left - 90; // center offset
            const y = e.clientY - canvasRect.top - 30;

            setNodes(nodes.map(n => n.id === draggedNodeId ? { ...n, x, y } : n));
        }
        if (isDrawingMode) {
            const canvasRect = canvasRef.current?.getBoundingClientRect();
            if (canvasRect) {
                setMousePos({
                    x: e.clientX - canvasRect.left,
                    y: e.clientY - canvasRect.top
                });
            }
        }
    };

    const handleNodeClick = (nodeId: string) => {
        if (isDrawingMode && drawingStartNodeId) {
            if (drawingStartNodeId === nodeId) {
                // Cancel
                setDrawingStartNodeId(null);
                setIsDrawingMode(false);
                return;
            }
            // Add Transition
            const newTransition: WorkflowTransition = {
                id: `trans-${Date.now()}`,
                fromNodeId: drawingStartNodeId,
                toNodeId: nodeId
            };

            // Avoid duplicates
            if (!transitions.some(t => t.fromNodeId === newTransition.fromNodeId && t.toNodeId === newTransition.toNodeId)) {
                setTransitions([...transitions, newTransition]);
            }

            setDrawingStartNodeId(null);
            setIsDrawingMode(false);
        }
    };

    // Helper to get color
    const getStatusColor = (category: string) => {
        switch (category) {
            case 'open': return 'bg-blue-100 border-blue-300 text-blue-800';
            case 'pending': return 'bg-yellow-100 border-yellow-300 text-yellow-800';
            case 'resolved': return 'bg-green-100 border-green-300 text-green-800';
            case 'closed': return 'bg-gray-100 border-gray-300 text-gray-800';
            default: return 'bg-indigo-100 border-indigo-300 text-indigo-800';
        }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-100px)]">
            {/* Toolbar */}
            <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center flex-shrink-0">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full text-gray-500">
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                            {templateName}
                            <span className="text-xs font-normal text-gray-400 border border-gray-200 px-2 py-0.5 rounded">v2.0</span>
                        </h2>
                        <p className="text-xs text-gray-500">Drag statuses to canvas and connect them to define flow.</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => setIsDrawingMode(!isDrawingMode)}
                        className={`px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-2 transition-colors ${isDrawingMode ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                            }`}
                    >
                        <ArrowRight size={18} />
                        {isDrawingMode ? 'Cancel Connection' : 'Connect Statuses'}
                    </button>
                    <button
                        onClick={() => onSave(nodes, transitions)}
                        className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg flex items-center gap-2 shadow-sm"
                    >
                        <Save size={18} />
                        Save Workflow
                    </button>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar - Available Statuses */}
                <div className="w-64 bg-gray-50 border-r border-gray-200 flex flex-col flex-shrink-0">
                    <div className="p-4 border-b border-gray-200">
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Available Statuses</h3>
                    </div>
                    <div className="p-4 space-y-3 overflow-y-auto">
                        {statuses.filter(s => !nodes.some(n => n.statusId === s.status_id)).map(status => (
                            <div
                                key={status.status_id}
                                onClick={() => handleAddStatus(status)}
                                className="p-3 bg-white border border-gray-200 rounded-lg shadow-sm cursor-pointer hover:border-indigo-400 hover:shadow-md transition-all group"
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <span className="font-semibold text-gray-700 text-sm">{status.status_name}</span>
                                    <Plus size={14} className="text-gray-300 group-hover:text-indigo-600" />
                                </div>
                                <div className="flex gap-2">
                                    <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded capitalize">
                                        {status.status_category}
                                    </span>
                                </div>
                            </div>
                        ))}
                        {statuses.filter(s => !nodes.some(n => n.statusId === s.status_id)).length === 0 && (
                            <p className="text-xs text-center text-gray-400 italic mt-4">All statuses added.</p>
                        )}
                    </div>
                </div>

                {/* Main Canvas */}
                <div
                    ref={canvasRef}
                    className="flex-1 bg-[#f8fafc] relative bg-grid-pattern overflow-hidden cursor-default select-none"
                    onMouseMove={handleCanvasMouseMove}
                    onMouseUp={() => setDraggedNodeId(null)}
                    style={{
                        backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)',
                        backgroundSize: '20px 20px'
                    }}
                >
                    {/* Render Transitions (Lines) */}
                    <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
                        <defs>
                            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                                <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
                            </marker>
                        </defs>
                        {transitions.map(t => {
                            const from = nodes.find(n => n.id === t.fromNodeId);
                            const to = nodes.find(n => n.id === t.toNodeId);
                            if (!from || !to) return null;

                            // Calculate center points
                            const startX = from.x + 90; // Width/2
                            const startY = from.y + 30; // Height/2
                            const endX = to.x + 90;
                            const endY = to.y + 30;

                            return (
                                <g key={t.id}>
                                    <line
                                        x1={startX} y1={startY} x2={endX} y2={endY}
                                        stroke="#cbd5e1"
                                        strokeWidth="2"
                                        markerEnd="url(#arrowhead)"
                                    />
                                    {/* Delete button for transition - simplified as center click */}
                                    {/* Could add a circle in middle to delete */}
                                </g>
                            );
                        })}
                        {/* Drawing Line */}
                        {isDrawingMode && drawingStartNodeId && (
                            <line
                                x1={nodes.find(n => n.id === drawingStartNodeId)?.x! + 90}
                                y1={nodes.find(n => n.id === drawingStartNodeId)?.y! + 30}
                                x2={mousePos.x}
                                y2={mousePos.y}
                                stroke="#6366f1"
                                strokeWidth="2"
                                strokeDasharray="5,5"
                            />
                        )}
                    </svg>

                    {/* Render Nodes */}
                    {nodes.map(node => (
                        <div
                            key={node.id}
                            onMouseDown={(e) => { e.stopPropagation(); setDraggedNodeId(node.id); }}
                            onClick={() => {
                                if (isDrawingMode) {
                                    if (!drawingStartNodeId) setDrawingStartNodeId(node.id);
                                    else handleNodeClick(node.id);
                                }
                            }}
                            style={{ left: node.x, top: node.y }}
                            className={`absolute w-[180px] z-10 bg-white rounded-lg shadow-sm border-2 transition-shadow group
                                ${getStatusColor(node.category)}
                                ${drawingStartNodeId === node.id ? 'ring-2 ring-indigo-500 ring-offset-2' : ''}
                                ${isDrawingMode ? 'cursor-crosshair hover:border-indigo-400' : 'cursor-move hover:shadow-md'}
                            `}
                        >
                            <div className="p-3">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-2">
                                        <GripVertical size={14} className="text-gray-300" />
                                        <span className="font-bold text-sm truncate w-[100px]">{node.statusName}</span>
                                    </div>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleRemoveNode(node.id); }}
                                        className="text-gray-300 hover:text-red-500"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                                <div className="flex justify-between items-center mt-2">
                                    <span className="text-[10px] uppercase font-bold opacity-60">{node.category}</span>
                                    {isDrawingMode && drawingStartNodeId === node.id && (
                                        <span className="text-[10px] text-indigo-600 font-bold animate-pulse">Source</span>
                                    )}
                                </div>
                            </div>

                            {/* Connectors (Visual Only) */}
                            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-300 rounded-full opacity-0 group-hover:opacity-100"></div>
                            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-300 rounded-full opacity-0 group-hover:opacity-100"></div>
                        </div>
                    ))}

                    {nodes.length === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center text-gray-400 pointer-events-none">
                            <div className="text-center">
                                <Layout size={48} className="mx-auto mb-2 opacity-20" />
                                <p>Canvas is empty.</p>
                                <p className="text-sm">Select statuses from the left sidebar to start.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// --- Main Container ---

const WorkflowTemplate = () => {
    const [view, setView] = useState<'list' | 'create' | 'edit' | 'builder'>('list');
    const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState<WorkflowTemplate | null>(null);

    // Toast notification state
    const [toast, setToast] = useState<{ show: boolean; type: 'success' | 'error'; message: string }>({
        show: false,
        type: 'success',
        message: ''
    });

    const showToast = (type: 'success' | 'error', message: string) => {
        setToast({ show: true, type, message });
        setTimeout(() => setToast(prev => ({ ...prev, show: false })), 4000);
    };

    // Delete confirmation state
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

    // Form Data
    const [formData, setFormData] = useState({
        name: '',
        category: 'IT',
        description: '',
        version: 1,
        is_active: false
    });

    useEffect(() => {
        if (view === 'list') fetchTemplates();
    }, [view]);

    const fetchTemplates = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase.from('workflow_templates').select('*').order('created_at', { ascending: false });

            if (error) {
                throw error;
            }

            setTemplates(data || []);
        } catch (error: any) {
            console.error('Error fetching templates:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveBasic = async () => {
        if (!formData.name) {
            showToast('error', 'Template name is required');
            return;
        }
        try {
            if (view === 'create') {
                const { data, error } = await supabase.from('workflow_templates').insert([{
                    name: formData.name,
                    category: formData.category,
                    description: formData.description,
                    version: formData.version,
                    is_active: formData.is_active
                }]).select().single();

                if (error) throw error;

                showToast('success', 'Template created successfully!');
                setSelectedTemplate(data);
                setView('builder');
            } else {
                const { error } = await supabase.from('workflow_templates').update({
                    name: formData.name, category: formData.category, description: formData.description, is_active: formData.is_active
                }).eq('id', selectedTemplate?.id);

                if (error) throw error;
                showToast('success', 'Template updated successfully!');
                setView('list');
            }
        } catch (e: any) {
            console.error('Save error:', e);
            showToast('error', `Failed to save template: ${e.message}`);
        }
    };

    const handleSaveBuilder = async (nodes: WorkflowNode[], transitions: WorkflowTransition[]) => {
        if (!selectedTemplate) return;
        try {
            // 1. Clear old data (Full Replace Strategy)
            await supabase.from('workflow_transitions').delete().eq('workflow_id', selectedTemplate.id);
            await supabase.from('workflow_statuses').delete().eq('workflow_template_id', selectedTemplate.id);

            // 2. Insert Statuses
            const statusInserts = nodes.map((n, idx) => ({
                workflow_template_id: selectedTemplate.id,
                status_id: n.statusId,
                sort_order: idx + 1 // Or map x/y if we had columns
            }));

            const { data: insertedStatuses, error: statusError } = await supabase
                .from('workflow_statuses')
                .insert(statusInserts)
                .select();

            console.log('Insert status response:', insertedStatuses, statusError);

            if (statusError) throw statusError;

            // 3. Map Node IDs (temp) to Real IDs
            const statusMap = new Map<string, string>(); // statusId (ticket_status) -> workflow_statuses.workflow_status_id
            // Problem: If multiple nodes have SAME status_id (not allowed in my logic), this map works.
            insertedStatuses?.forEach((s: any) => {
                statusMap.set(s.status_id, s.workflow_status_id); // Use correct column name
            });

            console.log('Status map:', Object.fromEntries(statusMap));

            // 4. Insert Transitions
            const transInserts = transitions.map(t => {
                // Find start/end status_ids from nodes
                const fromNode = nodes.find(n => n.id === t.fromNodeId);
                const toNode = nodes.find(n => n.id === t.toNodeId);

                if (!fromNode || !toNode) return null;

                const realFromId = statusMap.get(fromNode.statusId);
                const realToId = statusMap.get(toNode.statusId);

                if (!realFromId || !realToId) return null;

                return {
                    workflow_id: selectedTemplate.id,
                    from_status_id: realFromId,
                    to_status_id: realToId,
                    allowed_roles: ['agent'], // Default value - required column
                    is_automatic: false,       // Default value
                    condition: {}              // Default empty object
                };
            }).filter(Boolean);

            if (transInserts.length > 0) {
                const { error: transError } = await supabase.from('workflow_transitions').insert(transInserts);
                if (transError) throw transError;
            }

            showToast('success', 'Workflow saved successfully!');
            setView('list');

        } catch (error: any) {
            console.error('Save failed:', error);
            showToast('error', 'Failed to save: ' + error.message);
        }
    };

    const handleDeleteTemplate = async () => {
        if (!deleteTargetId) return;
        try {
            // Try to delete related data first (ignore errors if columns don't exist)
            // These may fail if the template has no associated workflow data or different schema
            const { error: transErr } = await supabase.from('workflow_transitions').delete().eq('workflow_id', deleteTargetId);
            if (transErr) {
                console.log('Note: Could not delete transitions:', transErr.message);
            }

            const { error: statusErr } = await supabase.from('workflow_statuses').delete().eq('workflow_template_id', deleteTargetId);
            if (statusErr) {
                console.log('Note: Could not delete statuses:', statusErr.message);
            }

            // Delete the template itself - this one we care about
            const { error } = await supabase.from('workflow_templates').delete().eq('id', deleteTargetId);
            if (error) throw error;

            showToast('success', 'Template deleted successfully!');
            setShowDeleteConfirm(false);
            setDeleteTargetId(null);
            fetchTemplates();
        } catch (error: any) {
            console.error('Delete error:', error);
            showToast('error', 'Failed to delete template: ' + error.message);
        }
    };

    const handleEditClick = (t: WorkflowTemplate) => {
        setSelectedTemplate(t);
        setFormData({
            name: t.name,
            category: t.category,
            description: t.description || '',
            version: t.version,
            is_active: t.is_active
        });
        setView('edit'); // Basic Info
    };

    return (
        <div className="p-8 max-w-7xl mx-auto min-h-screen">
            {/* Toast Notification */}
            {toast.show && (
                <div
                    className={`fixed top-4 right-4 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border backdrop-blur-sm ${toast.type === 'success'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-red-50 border-red-200 text-red-800'
                        }`}
                    style={{ animation: 'slideIn 0.3s ease-out forwards' }}
                >
                    <style>{`
                        @keyframes slideIn {
                            from { transform: translateX(100%); opacity: 0; }
                            to { transform: translateX(0); opacity: 1; }
                        }
                    `}</style>
                    {toast.type === 'success' ? (
                        <CheckCircle size={20} className="text-emerald-500 flex-shrink-0" />
                    ) : (
                        <XCircle size={20} className="text-red-500 flex-shrink-0" />
                    )}
                    <span className="text-sm font-medium">{toast.message}</span>
                    <button
                        onClick={() => setToast(prev => ({ ...prev, show: false }))}
                        className="ml-2 p-1 rounded-full hover:bg-black/5 transition-colors"
                    >
                        <X size={14} />
                    </button>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                                <Trash2 size={24} className="text-red-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-gray-800 mb-2">Delete Template?</h3>
                                <p className="text-sm text-gray-600">
                                    This will permanently delete this template and all its workflow configuration.
                                    This action cannot be undone.
                                </p>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                onClick={() => {
                                    setShowDeleteConfirm(false);
                                    setDeleteTargetId(null);
                                }}
                                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteTemplate}
                                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg"
                            >
                                Delete Template
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {view === 'list' && (
                <TemplateList
                    templates={templates}
                    loading={loading}
                    onCreate={() => {
                        setFormData({ name: '', category: 'IT', description: '', version: 1, is_active: false });
                        setView('create');
                    }}
                    onEdit={handleEditClick}
                    onDelete={(id) => {
                        setDeleteTargetId(id);
                        setShowDeleteConfirm(true);
                    }}
                />
            )}

            {(view === 'create' || view === 'edit') && (
                <div className="max-w-2xl mx-auto bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                    <h2 className="text-xl font-bold mb-6">{view === 'create' ? 'New Template' : 'Edit Template'}</h2>
                    {/* Simplified Form */}
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Name</label>
                            <input className="w-full p-2 border rounded" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                        </div>
                        <div className="flex gap-4">
                            <div className="flex-1">
                                <label className="block text-sm font-medium mb-1">Category</label>
                                <select className="w-full p-2 border rounded" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}>
                                    <option>IT</option><option>HR</option><option>Finance</option><option>General</option>
                                </select>
                            </div>
                            <div className="flex-1">
                                <label className="block text-sm font-medium mb-1">Version</label>
                                <input
                                    type="number"
                                    min="1"
                                    className="w-full p-2 border rounded"
                                    value={formData.version}
                                    onChange={e => setFormData({ ...formData, version: parseInt(e.target.value) || 1 })}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Description</label>
                            <textarea className="w-full p-2 border rounded" rows={3} value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
                        </div>
                        <div className="flex items-center gap-2">
                            <input type="checkbox" checked={formData.is_active} onChange={e => setFormData({ ...formData, is_active: e.target.checked })} />
                            <label>Active</label>
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 mt-6">
                        <button onClick={() => setView('list')} className="px-4 py-2 border rounded">Cancel</button>
                        {view === 'edit' && (
                            <button onClick={() => setView('builder')} className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded">
                                Open Builder
                            </button>
                        )}
                        <button onClick={handleSaveBasic} className="px-4 py-2 bg-indigo-600 text-white rounded">
                            {view === 'create' ? 'Create & Build' : 'Save Changes'}
                        </button>
                    </div>
                </div>
            )}

            {view === 'builder' && selectedTemplate && (
                <WorkflowBuilder
                    templateId={selectedTemplate.id}
                    templateName={selectedTemplate.name}
                    onBack={() => setView('list')}
                    onSave={handleSaveBuilder}
                />
            )}
        </div>
    );
};

export default WorkflowTemplate;
