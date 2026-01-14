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
    AlertTriangle,
    Info
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
    slaBehavior: 'run' | 'pause' | 'stop';
    isFinal: boolean;
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
                        <option value="all">All Scopes</option>
                        <option value="General">General</option>
                        <option value="Custom">Custom</option>
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
                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${template.category === 'General' ? 'bg-indigo-50 text-indigo-600' :
                                    template.category === 'Custom' ? 'bg-amber-50 text-amber-600' :
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
    templateVersion,
    onBack,
    onSave
}: {
    templateId: string,
    templateName: string,
    templateVersion: number,
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
            // 1. Fetch Ticket Statuses (for sidebar)
            const { data: statusData } = await supabase.from('ticket_statuses').select('*').order('is_final');
            setStatuses(statusData || []);

            // 2. Fetch Template Statuses from NEW TABLE: workflow_template_statuses
            const { data: wfStatuses, error: wfStatusError } = await supabase
                .from('workflow_template_statuses')
                .select(`
                    workflow_template_status_id, 
                    status_id, 
                    ticket_statuses:status_id (status_name, status_code, status_category, sla_behavior, is_final),
                    sort_order,
                    position_x,
                    position_y
                `)
                .eq('workflow_template_id', templateId)
                .order('sort_order');

            console.log('Loaded workflow_template_statuses:', wfStatuses, 'Error:', wfStatusError);

            // 3. Fetch Template Transitions from NEW TABLE: workflow_template_transitions
            const { data: wfTransitions, error: wfTransError } = await supabase
                .from('workflow_template_transitions')
                .select('*')
                .eq('workflow_template_id', templateId);

            console.log('Loaded workflow_template_transitions:', wfTransitions, 'Error:', wfTransError);

            // 4. Map to UI Model
            let loadedNodes: WorkflowNode[] = [];

            if (wfStatuses && wfStatuses.length > 0) {
                // Use saved positions if available, otherwise fallback to grid layout
                loadedNodes = wfStatuses.map((ws: any, index: number) => ({
                    id: ws.workflow_template_status_id, // PK from new table
                    statusId: ws.status_id,
                    statusName: ws.ticket_statuses?.status_name || 'Unknown',
                    statusCode: ws.ticket_statuses?.status_code || '',
                    category: ws.ticket_statuses?.status_category || 'open',
                    slaBehavior: ws.ticket_statuses?.sla_behavior || 'run',
                    isFinal: ws.ticket_statuses?.is_final || false,
                    x: ws.position_x ?? (50 + (index % 4) * 220), // Use saved position or fallback
                    y: ws.position_y ?? (50 + Math.floor(index / 4) * 150)
                }));
            }

            console.log('Mapped nodes:', loadedNodes);

            // 5. Map transitions - these now reference ticket_statuses.status_id directly
            // We need to map from_status_id/to_status_id to node IDs
            const statusIdToNodeId = new Map<string, string>();
            loadedNodes.forEach(n => statusIdToNodeId.set(n.statusId, n.id));

            const loadedTransitions: WorkflowTransition[] = (wfTransitions || []).map((t: any) => ({
                id: t.workflow_template_transition_id,
                fromNodeId: statusIdToNodeId.get(t.from_status_id) || '',
                toNodeId: statusIdToNodeId.get(t.to_status_id) || ''
            })).filter(t => t.fromNodeId && t.toNodeId);

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
            slaBehavior: status.sla_behavior,
            isFinal: status.is_final,
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

    // Remove a transition
    const removeTransition = (transitionId: string) => {
        setTransitions(transitions.filter(t => t.id !== transitionId));
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
                            <span className="text-xs font-normal text-gray-400 border border-gray-200 px-2 py-0.5 rounded">v{templateVersion}</span>
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
                        {isDrawingMode ? 'Cancel' : 'Add Transition'}
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

            {/* Legend Bar */}
            <div className="bg-gray-50 border-b border-gray-200 px-6 py-2 flex items-center gap-6 flex-shrink-0">
                <Info size={14} className="text-gray-400" />
                <div className="flex items-center gap-4 text-xs">
                    <span className="flex items-center gap-1">
                        <span className="w-3 h-3 rounded bg-green-100 border border-green-300"></span>
                        <span className="text-gray-600">SLA Running</span>
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="w-3 h-3 rounded bg-yellow-100 border border-yellow-300"></span>
                        <span className="text-gray-600">SLA Paused</span>
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="w-3 h-3 rounded bg-red-100 border border-red-300"></span>
                        <span className="text-gray-600">SLA Stopped</span>
                    </span>
                    <span className="border-l border-gray-300 pl-4 flex items-center gap-1">
                        <span className="px-1.5 py-0.5 bg-green-600 text-white text-[9px] font-bold rounded">Start</span>
                        <span className="text-gray-500">First status</span>
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="px-1.5 py-0.5 bg-red-600 text-white text-[9px] font-bold rounded">Final</span>
                        <span className="text-gray-500">End status</span>
                    </span>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar - Available Statuses */}
                <div className="w-64 bg-gray-50 border-r border-gray-200 flex flex-col flex-shrink-0">
                    <div className="p-4 border-b border-gray-200">
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Available Statuses</h3>
                    </div>
                    <div className="p-4 space-y-2 overflow-y-auto flex-1">
                        {statuses.map(status => {
                            const isOnCanvas = nodes.some(n => n.statusId === status.status_id);
                            // SLA behavior colors
                            const slaDotColor = status.sla_behavior === 'run'
                                ? 'bg-green-500'
                                : status.sla_behavior === 'pause'
                                    ? 'bg-yellow-500'
                                    : 'bg-red-500';
                            return (
                                <div
                                    key={status.status_id}
                                    onClick={() => !isOnCanvas && handleAddStatus(status)}
                                    className={`p-3 rounded-lg border transition-all flex items-center justify-between
                                        ${isOnCanvas
                                            ? 'bg-gray-100 border-gray-200 cursor-default opacity-60'
                                            : 'bg-white border-gray-200 shadow-sm cursor-pointer hover:border-indigo-400 hover:shadow-md group'
                                        }`}
                                >
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            {/* SLA Behavior Indicator */}
                                            <span className={`w-2 h-2 rounded-full ${slaDotColor}`} title={`SLA: ${status.sla_behavior.toUpperCase()}`}></span>
                                            <span className={`font-semibold text-sm ${isOnCanvas ? 'text-gray-500' : 'text-gray-700'}`}>
                                                {status.status_name}
                                            </span>
                                        </div>
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded capitalize font-medium bg-gray-100 text-gray-600`}>
                                            {status.status_category}
                                        </span>
                                    </div>
                                    {isOnCanvas ? (
                                        <CheckCircle size={18} className="text-green-500" />
                                    ) : (
                                        <Plus size={16} className="text-gray-300 group-hover:text-indigo-600" />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Main Canvas - Scrollable */}
                <div className="flex-1 overflow-auto bg-[#f8fafc] relative">
                    <div
                        ref={canvasRef}
                        className="relative bg-grid-pattern cursor-default select-none"
                        onMouseMove={handleCanvasMouseMove}
                        onMouseUp={() => setDraggedNodeId(null)}
                        style={{
                            backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)',
                            backgroundSize: '20px 20px',
                            // Dynamic height based on node positions, minimum 600px
                            minHeight: Math.max(600, nodes.length > 0
                                ? Math.max(...nodes.map(n => n.y)) + 200
                                : 600),
                            minWidth: Math.max(800, nodes.length > 0
                                ? Math.max(...nodes.map(n => n.x)) + 250
                                : 800),
                            paddingBottom: '100px' // Extra padding at bottom
                        }}
                    >
                        {/* Render Transitions (Curved Lines) */}
                        <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
                            <defs>
                                {/* Define arrow markers for each color */}
                                {['#22c55e', '#f59e0b', '#3b82f6', '#8b5cf6', '#94a3b8'].map((color, i) => (
                                    <marker
                                        key={`arrow-${i}`}
                                        id={`arrowhead-${i}`}
                                        markerWidth="10"
                                        markerHeight="7"
                                        refX="9"
                                        refY="3.5"
                                        orient="auto"
                                    >
                                        <polygon points="0 0, 10 3.5, 0 7" fill={color} />
                                    </marker>
                                ))}
                            </defs>
                            {transitions.map((t, index) => {
                                const from = nodes.find(n => n.id === t.fromNodeId);
                                const to = nodes.find(n => n.id === t.toNodeId);
                                if (!from || !to) return null;

                                // Color palette for transitions
                                const colors = ['#22c55e', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899'];
                                const color = colors[index % colors.length];
                                const arrowId = `arrowhead-${index % 5}`;

                                // Calculate edge points (not center)
                                const NODE_WIDTH = 180;
                                const NODE_HEIGHT = 60;

                                // Determine direction and connection points
                                let startX, startY, endX, endY;
                                const dx = to.x - from.x;
                                const dy = to.y - from.y;

                                // Connect from right edge to left edge if going right
                                if (Math.abs(dx) > Math.abs(dy)) {
                                    if (dx > 0) {
                                        // Going right
                                        startX = from.x + NODE_WIDTH;
                                        startY = from.y + NODE_HEIGHT / 2;
                                        endX = to.x;
                                        endY = to.y + NODE_HEIGHT / 2;
                                    } else {
                                        // Going left
                                        startX = from.x;
                                        startY = from.y + NODE_HEIGHT / 2;
                                        endX = to.x + NODE_WIDTH;
                                        endY = to.y + NODE_HEIGHT / 2;
                                    }
                                } else {
                                    if (dy > 0) {
                                        // Going down
                                        startX = from.x + NODE_WIDTH / 2;
                                        startY = from.y + NODE_HEIGHT;
                                        endX = to.x + NODE_WIDTH / 2;
                                        endY = to.y;
                                    } else {
                                        // Going up
                                        startX = from.x + NODE_WIDTH / 2;
                                        startY = from.y;
                                        endX = to.x + NODE_WIDTH / 2;
                                        endY = to.y + NODE_HEIGHT;
                                    }
                                }

                                // Calculate bezier control points for curved line
                                const midX = (startX + endX) / 2;
                                const midY = (startY + endY) / 2;

                                // Add curve based on direction
                                let ctrl1X, ctrl1Y, ctrl2X, ctrl2Y;
                                if (Math.abs(dx) > Math.abs(dy)) {
                                    // Horizontal dominant - curve vertically
                                    ctrl1X = startX + (endX - startX) * 0.4;
                                    ctrl1Y = startY;
                                    ctrl2X = startX + (endX - startX) * 0.6;
                                    ctrl2Y = endY;
                                } else {
                                    // Vertical dominant - curve horizontally
                                    ctrl1X = startX;
                                    ctrl1Y = startY + (endY - startY) * 0.4;
                                    ctrl2X = endX;
                                    ctrl2Y = startY + (endY - startY) * 0.6;
                                }

                                const pathD = `M ${startX} ${startY} C ${ctrl1X} ${ctrl1Y}, ${ctrl2X} ${ctrl2Y}, ${endX} ${endY}`;

                                return (
                                    <g key={t.id} className="transition-group">
                                        {/* Main curved path */}
                                        <path
                                            d={pathD}
                                            fill="none"
                                            stroke={color}
                                            strokeWidth="2.5"
                                            markerEnd={`url(#${arrowId})`}
                                            className="transition-all"
                                        />
                                        {/* Invisible wider path for easier hover detection */}
                                        <path
                                            d={pathD}
                                            fill="none"
                                            stroke="transparent"
                                            strokeWidth="20"
                                            className="pointer-events-auto cursor-pointer"
                                        />
                                        {/* Delete button at midpoint */}
                                        <g
                                            className="pointer-events-auto cursor-pointer opacity-0 hover:opacity-100 transition-opacity"
                                            onClick={() => removeTransition(t.id)}
                                        >
                                            <circle
                                                cx={midX}
                                                cy={midY}
                                                r="10"
                                                fill="#ef4444"
                                                className="drop-shadow-sm"
                                            />
                                            <text
                                                x={midX}
                                                y={midY + 4}
                                                textAnchor="middle"
                                                fill="white"
                                                fontSize="12"
                                                fontWeight="bold"
                                            >
                                                ×
                                            </text>
                                        </g>
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
                        {nodes.map((node, nodeIndex) => {
                            // Determine node colors based on SLA BEHAVIOR (not category)
                            // 🟢 Green = SLA RUN, 🟡 Yellow = SLA PAUSE, 🔴 Red = SLA STOP
                            let nodeColors = '';
                            let slaBadgeText = '';

                            if (node.slaBehavior === 'run') {
                                nodeColors = 'bg-green-50 border-green-300';
                                slaBadgeText = 'Running';
                            } else if (node.slaBehavior === 'pause') {
                                nodeColors = 'bg-yellow-50 border-yellow-300';
                                slaBadgeText = 'Paused';
                            } else {
                                nodeColors = 'bg-red-50 border-red-300';
                                slaBadgeText = 'Stopped';
                            }

                            // Check if this is the first/start node (first in list or "New" status)
                            const isStartNode = nodeIndex === 0 || node.statusCode?.toLowerCase() === 'new';

                            return (
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
                                    className={`absolute w-[180px] z-10 rounded-xl shadow-sm border-2 transition-all group
                                    ${nodeColors}
                                    ${drawingStartNodeId === node.id ? 'ring-2 ring-indigo-500 ring-offset-2' : ''}
                                    ${isDrawingMode ? 'cursor-crosshair' : 'cursor-move hover:shadow-md'}
                                `}
                                >
                                    {/* Start Badge */}
                                    {isStartNode && (
                                        <div className="absolute -top-3 left-3 px-2 py-0.5 bg-green-600 text-white text-[10px] font-bold rounded">
                                            Start
                                        </div>
                                    )}

                                    {/* Final Badge */}
                                    {node.isFinal && (
                                        <div className="absolute -top-3 right-3 px-2 py-0.5 bg-red-600 text-white text-[10px] font-bold rounded">
                                            Final
                                        </div>
                                    )}

                                    <div className="p-3 pt-4">
                                        <div className="flex justify-between items-start">
                                            <div className="flex items-center gap-2">
                                                <GripVertical size={12} className="text-gray-300 opacity-50" />
                                                <span className="font-bold text-sm text-gray-800">{node.statusName}</span>
                                            </div>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleRemoveNode(node.id); }}
                                                className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                        <div className="flex items-center gap-2 mt-2">
                                            {/* Category Badge */}
                                            <span className="text-[10px] capitalize font-medium px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                                                {node.category}
                                            </span>
                                            {/* SLA Badge (optional, smaller) */}
                                            {node.slaBehavior === 'pause' && (
                                                <span className="text-[9px] uppercase font-bold text-yellow-600">
                                                    ⏸ Paused
                                                </span>
                                            )}
                                            {isDrawingMode && drawingStartNodeId === node.id && (
                                                <span className="text-[10px] text-indigo-600 font-bold animate-pulse">Source</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        {nodes.length === 0 && (
                            <div className="absolute inset-0 flex items-center justify-center text-gray-400 pointer-events-none">
                                <div className="text-center">
                                    <Layout size={48} className="mx-auto mb-2 opacity-20" />
                                    <p>Canvas is empty.</p>
                                    <p className="text-sm">Select statuses from the left sidebar to start.</p>
                                </div>
                            </div>
                        )}

                        {/* Bottom Info Banner */}
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-lg px-4 py-2 shadow-sm flex items-center gap-2 text-gray-600 text-sm">
                            <span className="text-yellow-500">💡</span>
                            <span>
                                <strong>Template Mode:</strong> Everything shown here is for reference only. Actual workflows will be configured when this template is applied in{' '}
                                <span className="text-indigo-600 font-medium">Workflow Mapping</span>.
                            </span>
                        </div>
                    </div>
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
        category: 'General',
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
            // 1. Clear old template statuses and transitions
            await supabase.from('workflow_template_transitions').delete().eq('workflow_template_id', selectedTemplate.id);
            await supabase.from('workflow_template_statuses').delete().eq('workflow_template_id', selectedTemplate.id);

            // 2. Insert Template Statuses to NEW TABLE (with position)
            const statusInserts = nodes.map((n, idx) => ({
                workflow_template_id: selectedTemplate.id,
                status_id: n.statusId,
                sort_order: idx + 1,
                position_x: Math.round(n.x),
                position_y: Math.round(n.y)
            }));

            const { data: insertedStatuses, error: statusError } = await supabase
                .from('workflow_template_statuses')
                .insert(statusInserts)
                .select();

            console.log('Insert template statuses response:', insertedStatuses, statusError);

            if (statusError) throw statusError;

            // 3. Insert Template Transitions to NEW TABLE
            if (transitions.length > 0) {
                // Build mapping from node ID to status_id
                const nodeIdToStatusId = new Map<string, string>();
                nodes.forEach(n => nodeIdToStatusId.set(n.id, n.statusId));

                const transitionInserts = transitions.map(t => {
                    const fromStatusId = nodeIdToStatusId.get(t.fromNodeId);
                    const toStatusId = nodeIdToStatusId.get(t.toNodeId);

                    if (!fromStatusId || !toStatusId) return null;

                    return {
                        workflow_template_id: selectedTemplate.id,
                        from_status_id: fromStatusId,  // References ticket_statuses.status_id
                        to_status_id: toStatusId,      // References ticket_statuses.status_id
                        allowed_roles: 'agent',        // varchar, not array
                        is_automatic: false,
                        condition: {}
                    };
                }).filter(Boolean);

                if (transitionInserts.length > 0) {
                    const { error: transError } = await supabase
                        .from('workflow_template_transitions')
                        .insert(transitionInserts);

                    if (transError) throw transError;
                }

                console.log('Template transitions saved:', transitionInserts.length);
            }

            showToast('success', `Template saved with ${nodes.length} statuses and ${transitions.length} transitions!`);
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
                        setFormData({ name: '', category: 'General', description: '', version: 1, is_active: false });
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
                                <label className="block text-sm font-medium mb-1">Template Scope</label>
                                <select className="w-full p-2 border rounded" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}>
                                    <option value="General">General</option>
                                    <option value="Custom">Custom</option>
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
                            <input type="checkbox" id="is_active" checked={formData.is_active} onChange={e => setFormData({ ...formData, is_active: e.target.checked })} />
                            <label htmlFor="is_active">Active</label>
                        </div>

                        {/* Scope Description */}
                        <div className="mt-4 text-sm text-gray-600">
                            <div className="flex items-start gap-2">
                                <span className="mt-0.5 text-gray-400">ⓘ</span>
                                <div>
                                    <p className="mb-1">Define the scope for this workflow template.</p>
                                    {formData.category === 'General' && (
                                        <p><span className="font-semibold text-gray-800">General:</span> This template is reusable and suitable for any department or scenario.</p>
                                    )}
                                    {formData.category === 'Custom' && (
                                        <p><span className="font-semibold text-gray-800">Custom:</span> This template is tailored for specific department or use case.</p>
                                    )}
                                </div>
                            </div>
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
                    templateVersion={selectedTemplate.version}
                    onBack={() => setView('list')}
                    onSave={handleSaveBuilder}
                />
            )}
        </div>
    );
};

export default WorkflowTemplate;
