import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    Plus,
    Save,
    X,
    AlertTriangle,
    GripVertical,
    ArrowRight,
    ChevronDown,
    ChevronUp,
    Trash2,
    Info,
    Lock,
    Settings,
    Zap
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Status {
    status_id: string;
    status_name: string;
    status_code: string;
    sla_behavior: 'run' | 'pause' | 'stop';
    status_category: 'system' | 'agent';
    is_final: boolean;
    is_active: boolean;
    sort_order: number;
}

interface WorkflowNode {
    id: string;
    statusId: string;
    statusName: string;
    statusCode: string;
    x: number;
    y: number;
    color: string;
    isFinal: boolean;
    isSystem: boolean;
}

interface Transition {
    id: string;
    fromNodeId: string;
    toNodeId: string;
    condition?: string;
    conditionLabel?: string;
}

interface DepartmentWorkflow {
    workflow_id: string;
    company_id: number;
    department_id: number;
    workflow_name: string;
    is_active: boolean;
}

const WorkflowMapping: React.FC = () => {
    const [departments, setDepartments] = useState<DepartmentWorkflow[]>([]);
    const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
    const [statuses, setStatuses] = useState<Status[]>([]);
    const [nodes, setNodes] = useState<WorkflowNode[]>([]);
    const [transitions, setTransitions] = useState<Transition[]>([]);
    const [availableStatuses, setAvailableStatuses] = useState<Status[]>([]);
    const [loading, setLoading] = useState(true);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [showTransitionModal, setShowTransitionModal] = useState(false);
    const [showWarning, setShowWarning] = useState(false);
    const [pendingDepartmentChange, setPendingDepartmentChange] = useState<string | null>(null);

    const [draggedStatus, setDraggedStatus] = useState<Status | null>(null);
    const [draggingNode, setDraggingNode] = useState<string | null>(null);
    const [connectingFrom, setConnectingFrom] = useState<string | null>(null);

    // Group expand/collapse state
    const [expandedGroups, setExpandedGroups] = useState<{ system: boolean; agent: boolean }>({
        system: true,
        agent: true
    });

    const toggleGroup = (group: 'system' | 'agent') => {
        setExpandedGroups(prev => ({ ...prev, [group]: !prev[group] }));
    };

    // Filter statuses by category
    const systemStatuses = availableStatuses.filter(s => s.status_category === 'system');
    const agentStatuses = availableStatuses.filter(s => s.status_category === 'agent');

    const canvasRef = useRef<HTMLDivElement>(null);

    // New transition form
    const [transitionForm, setTransitionForm] = useState({
        fromNodeId: '',
        toNodeId: '',
        condition: '',
        conditionLabel: ''
    });

    // Color mapping based on status type
    const getStatusColor = (status: Status): string => {
        if (status.status_category === 'system') {
            if (status.is_final) return 'bg-gray-600'; // Dark gray for final system
            return 'bg-gray-400'; // Gray for system
        }

        const code = status.status_code.toLowerCase();
        if (code.includes('open') || code.includes('new')) return 'bg-blue-500';
        if (code.includes('progress') || code.includes('wip')) return 'bg-green-500';
        if (code.includes('pending') || code.includes('wait')) return 'bg-yellow-500';
        if (code.includes('resolved') || code.includes('complete')) return 'bg-emerald-400';
        if (code.includes('closed')) return 'bg-gray-600';
        if (code.includes('cancel') || code.includes('reject')) return 'bg-red-500';
        if (code.includes('reopen')) return 'bg-purple-500';

        return 'bg-indigo-500'; // Default
    };

    useEffect(() => {
        fetchDepartments();
        fetchStatuses();
    }, []);

    useEffect(() => {
        if (selectedDepartment && statuses.length > 0) {
            loadWorkflow();
        }
    }, [selectedDepartment, statuses]);

    const fetchDepartments = async () => {
        try {
            const { data, error } = await supabase
                .from('department_workflows')
                .select('workflow_id, company_id, department_id, workflow_name, is_active')
                .eq('is_active', true)
                .order('workflow_name');

            if (error) throw error;
            setDepartments(data || []);
            if (data && data.length > 0) {
                setSelectedDepartment(data[0].workflow_id);
            }
        } catch (error) {
            console.error('Error fetching departments:', error);
        }
    };

    const fetchStatuses = async () => {
        try {
            const { data, error } = await supabase
                .from('ticket_statuses')
                .select('*')
                .eq('is_active', true)
                .order('sort_order');

            if (error) throw error;
            setStatuses(data || []);
        } catch (error) {
            console.error('Error fetching statuses:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadWorkflow = async () => {
        // For now, initialize with empty workflow
        // In future, load from workflow_mappings table
        setNodes([]);
        setTransitions([]);
        updateAvailableStatuses([]);
        setHasUnsavedChanges(false);
    };

    const updateAvailableStatuses = (usedNodes: WorkflowNode[]) => {
        const usedStatusIds = usedNodes.map(n => n.statusId);
        const available = statuses.filter(s => !usedStatusIds.includes(s.status_id));
        setAvailableStatuses(available);
    };

    const handleDepartmentChange = (workflowId: string) => {
        if (hasUnsavedChanges) {
            setPendingDepartmentChange(workflowId);
            setShowWarning(true);
        } else {
            setSelectedDepartment(workflowId);
        }
    };

    const confirmDepartmentChange = () => {
        if (pendingDepartmentChange) {
            setSelectedDepartment(pendingDepartmentChange);
            setPendingDepartmentChange(null);
        }
        setShowWarning(false);
    };

    const handleDragStart = (status: Status) => {
        setDraggedStatus(status);
    };

    const handleCanvasDrop = (e: React.DragEvent) => {
        e.preventDefault();
        if (!draggedStatus || !canvasRef.current) return;

        const rect = canvasRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left - 75; // Center the node
        const y = e.clientY - rect.top - 25;

        const newNode: WorkflowNode = {
            id: `node_${Date.now()}`,
            statusId: draggedStatus.status_id,
            statusName: draggedStatus.status_name,
            statusCode: draggedStatus.status_code,
            x: Math.max(0, Math.min(x, rect.width - 150)),
            y: Math.max(0, Math.min(y, rect.height - 50)),
            color: getStatusColor(draggedStatus),
            isFinal: draggedStatus.is_final,
            isSystem: draggedStatus.status_category === 'system'
        };

        const newNodes = [...nodes, newNode];
        setNodes(newNodes);
        updateAvailableStatuses(newNodes);
        setDraggedStatus(null);
        setHasUnsavedChanges(true);
    };

    const handleNodeDragStart = (nodeId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setDraggingNode(nodeId);
    };

    const handleCanvasMouseMove = (e: React.MouseEvent) => {
        if (!draggingNode || !canvasRef.current) return;

        const rect = canvasRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left - 75;
        const y = e.clientY - rect.top - 25;

        setNodes(prev => prev.map(node =>
            node.id === draggingNode
                ? { ...node, x: Math.max(0, x), y: Math.max(0, y) }
                : node
        ));
    };

    const handleCanvasMouseUp = () => {
        if (draggingNode) {
            setDraggingNode(null);
            setHasUnsavedChanges(true);
        }
    };

    const handleConnectStart = (nodeId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const node = nodes.find(n => n.id === nodeId);
        if (node?.isFinal) return; // Final nodes cannot have outgoing connections
        setConnectingFrom(nodeId);
    };

    const handleConnectEnd = (nodeId: string) => {
        if (!connectingFrom || connectingFrom === nodeId) {
            setConnectingFrom(null);
            return;
        }

        const fromNode = nodes.find(n => n.id === connectingFrom);
        const toNode = nodes.find(n => n.id === nodeId);

        // Validation
        if (toNode?.statusCode.toLowerCase().includes('new')) {
            alert('Cannot create incoming transition to "New" status');
            setConnectingFrom(null);
            return;
        }

        // Check if transition already exists
        const exists = transitions.some(t => t.fromNodeId === connectingFrom && t.toNodeId === nodeId);
        if (exists) {
            setConnectingFrom(null);
            return;
        }

        const newTransition: Transition = {
            id: `trans_${Date.now()}`,
            fromNodeId: connectingFrom,
            toNodeId: nodeId
        };

        setTransitions(prev => [...prev, newTransition]);
        setConnectingFrom(null);
        setHasUnsavedChanges(true);
    };

    const removeNode = (nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (node?.isSystem) return; // Cannot remove system nodes

        const newNodes = nodes.filter(n => n.id !== nodeId);
        const newTransitions = transitions.filter(t => t.fromNodeId !== nodeId && t.toNodeId !== nodeId);

        setNodes(newNodes);
        setTransitions(newTransitions);
        updateAvailableStatuses(newNodes);
        setHasUnsavedChanges(true);
    };

    const removeTransition = (transitionId: string) => {
        setTransitions(prev => prev.filter(t => t.id !== transitionId));
        setHasUnsavedChanges(true);
    };

    const addTransitionManual = () => {
        if (!transitionForm.fromNodeId || !transitionForm.toNodeId) return;

        const newTransition: Transition = {
            id: `trans_${Date.now()}`,
            fromNodeId: transitionForm.fromNodeId,
            toNodeId: transitionForm.toNodeId,
            condition: transitionForm.condition || undefined,
            conditionLabel: transitionForm.conditionLabel || undefined
        };

        setTransitions(prev => [...prev, newTransition]);
        setTransitionForm({ fromNodeId: '', toNodeId: '', condition: '', conditionLabel: '' });
        setShowTransitionModal(false);
        setHasUnsavedChanges(true);
    };

    const handleSave = async () => {
        // TODO: Save workflow to database
        console.log('Saving workflow:', { nodes, transitions, departmentId: selectedDepartment });
        setHasUnsavedChanges(false);
        alert('Workflow saved successfully!');
    };

    const handleCancel = () => {
        loadWorkflow();
    };

    const getNodePosition = (nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        return node ? { x: node.x + 75, y: node.y + 25 } : { x: 0, y: 0 };
    };

    const selectedDeptName = departments.find(d => d.workflow_id === selectedDepartment)?.workflow_name || '';

    return (
        <div className="h-full flex flex-col bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-6 py-4">
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">Workflow Mapping</h1>
                        <p className="text-gray-500 text-sm">Configure workflow rules for each department</p>
                    </div>

                    {/* Unsaved Changes Warning */}
                    {hasUnsavedChanges && (
                        <div className="flex items-center gap-2 bg-amber-50 text-amber-700 px-3 py-1.5 rounded-lg border border-amber-200">
                            <AlertTriangle size={16} />
                            <span className="text-sm font-medium">You have unsaved changes</span>
                        </div>
                    )}
                </div>

                {/* Department Selector */}
                <div className="mt-4 flex items-center gap-4">
                    <label className="text-sm font-medium text-gray-700">Select Department:</label>
                    <div className="relative">
                        <select
                            value={selectedDepartment || ''}
                            onChange={(e) => handleDepartmentChange(e.target.value)}
                            className="appearance-none bg-white border border-gray-200 rounded-lg px-4 py-2 pr-10 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent min-w-[200px]"
                        >
                            {departments.map(dept => (
                                <option key={dept.workflow_id} value={dept.workflow_id}>
                                    {dept.workflow_name}
                                </option>
                            ))}
                        </select>
                        <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                </div>
            </div>

            {/* Action Bar */}
            <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3">
                <button
                    onClick={() => setShowTransitionModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
                >
                    <Plus size={16} />
                    Add Transition
                </button>
                <div className="flex-1" />
                <button
                    onClick={handleCancel}
                    disabled={!hasUnsavedChanges}
                    className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <X size={16} />
                    Cancel
                </button>
                <button
                    onClick={handleSave}
                    disabled={!hasUnsavedChanges}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Save size={16} />
                    Save
                </button>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Canvas */}
                <div className="flex-1 p-4 overflow-auto">
                    <div
                        ref={canvasRef}
                        className="relative w-full min-h-[600px] bg-white rounded-xl border-2 border-dashed border-gray-200 overflow-hidden"
                        style={{
                            backgroundImage: 'radial-gradient(circle, #e5e7eb 1px, transparent 1px)',
                            backgroundSize: '20px 20px'
                        }}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={handleCanvasDrop}
                        onMouseMove={handleCanvasMouseMove}
                        onMouseUp={handleCanvasMouseUp}
                        onMouseLeave={handleCanvasMouseUp}
                    >
                        {/* Transitions (Arrows) */}
                        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
                            <defs>
                                <marker
                                    id="arrowhead"
                                    markerWidth="10"
                                    markerHeight="7"
                                    refX="9"
                                    refY="3.5"
                                    orient="auto"
                                >
                                    <polygon points="0 0, 10 3.5, 0 7" fill="#6366f1" />
                                </marker>
                            </defs>
                            {transitions.map(trans => {
                                const from = getNodePosition(trans.fromNodeId);
                                const to = getNodePosition(trans.toNodeId);
                                const midX = (from.x + to.x) / 2;
                                const midY = (from.y + to.y) / 2;

                                return (
                                    <g key={trans.id}>
                                        <line
                                            x1={from.x}
                                            y1={from.y}
                                            x2={to.x}
                                            y2={to.y}
                                            stroke="#6366f1"
                                            strokeWidth="2"
                                            markerEnd="url(#arrowhead)"
                                            className="cursor-pointer pointer-events-auto hover:stroke-red-500"
                                            onClick={() => removeTransition(trans.id)}
                                        />
                                        {trans.conditionLabel && (
                                            <g transform={`translate(${midX - 15}, ${midY - 10})`}>
                                                <rect
                                                    x="0"
                                                    y="0"
                                                    width="30"
                                                    height="20"
                                                    rx="4"
                                                    fill="#fef3c7"
                                                    stroke="#f59e0b"
                                                    strokeWidth="1"
                                                />
                                                <text
                                                    x="15"
                                                    y="14"
                                                    textAnchor="middle"
                                                    fontSize="10"
                                                    fontWeight="bold"
                                                    fill="#92400e"
                                                >
                                                    IF
                                                </text>
                                            </g>
                                        )}
                                    </g>
                                );
                            })}
                        </svg>

                        {/* Nodes */}
                        {nodes.map(node => (
                            <div
                                key={node.id}
                                className={`absolute flex items-center gap-2 px-4 py-2 rounded-lg shadow-md cursor-move select-none ${node.color} text-white`}
                                style={{
                                    left: node.x,
                                    top: node.y,
                                    zIndex: draggingNode === node.id ? 10 : 2,
                                    minWidth: '150px'
                                }}
                                onMouseDown={(e) => handleNodeDragStart(node.id, e)}
                                onClick={() => connectingFrom && handleConnectEnd(node.id)}
                            >
                                <span className="font-medium text-sm truncate flex-1">{node.statusName}</span>
                                <div className="flex items-center gap-1">
                                    {node.isFinal && (
                                        <Lock size={12} className="opacity-70" title="Final status" />
                                    )}
                                    {!node.isFinal && (
                                        <button
                                            onClick={(e) => handleConnectStart(node.id, e)}
                                            className={`p-1 rounded hover:bg-white/20 transition-colors ${connectingFrom === node.id ? 'bg-white/30' : ''}`}
                                            title="Connect to another status"
                                        >
                                            <ArrowRight size={14} />
                                        </button>
                                    )}
                                    {!node.isSystem && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); removeNode(node.id); }}
                                            className="p-1 rounded hover:bg-white/20 transition-colors"
                                            title="Remove from workflow"
                                        >
                                            <X size={14} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}

                        {/* Empty State */}
                        {nodes.length === 0 && (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="text-center text-gray-400">
                                    <Settings size={48} className="mx-auto mb-3 opacity-50" />
                                    <p className="text-lg font-medium">No workflow configured</p>
                                    <p className="text-sm">Drag statuses from the right panel to start building</p>
                                </div>
                            </div>
                        )}

                        {/* Connecting indicator */}
                        {connectingFrom && (
                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-indigo-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium animate-pulse">
                                Click on target status to create transition
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Panel - Available Statuses */}
                <div className="w-72 bg-white border-l border-gray-200 p-4 overflow-y-auto">
                    <h3 className="font-bold text-gray-800 mb-1">Available Statuses</h3>
                    <p className="text-xs text-gray-500 mb-4">Drag to canvas to add to workflow</p>

                    <div className="space-y-3">
                        {/* System Statuses Group */}
                        <div className="border border-gray-200 rounded-lg overflow-hidden">
                            <button
                                onClick={() => toggleGroup('system')}
                                className="w-full flex items-center justify-between px-3 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors"
                            >
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-gray-400" />
                                    <span className="text-sm font-semibold text-gray-700">System Statuses</span>
                                    <span className="text-xs text-gray-400 bg-gray-200 px-1.5 py-0.5 rounded-full">
                                        {systemStatuses.length}
                                    </span>
                                </div>
                                {expandedGroups.system ? (
                                    <ChevronUp size={16} className="text-gray-400" />
                                ) : (
                                    <ChevronDown size={16} className="text-gray-400" />
                                )}
                            </button>
                            {expandedGroups.system && (
                                <div className="p-2 space-y-1.5 bg-white">
                                    {systemStatuses.length > 0 ? (
                                        systemStatuses.map(status => (
                                            <div
                                                key={status.status_id}
                                                draggable
                                                onDragStart={() => handleDragStart(status)}
                                                className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border border-gray-100 cursor-grab hover:bg-gray-50 hover:border-gray-200 transition-colors ${draggedStatus?.status_id === status.status_id ? 'opacity-50' : ''}`}
                                            >
                                                <GripVertical size={12} className="text-gray-300" />
                                                <div className={`w-2.5 h-2.5 rounded-full ${getStatusColor(status)}`} />
                                                <span className="flex-1 text-sm font-medium text-gray-700 truncate">{status.status_name}</span>
                                                {status.is_final && (
                                                    <Lock size={11} className="text-gray-400" title="Final status" />
                                                )}
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-xs text-gray-400 text-center py-2">No system statuses available</p>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Agent Statuses Group */}
                        <div className="border border-gray-200 rounded-lg overflow-hidden">
                            <button
                                onClick={() => toggleGroup('agent')}
                                className="w-full flex items-center justify-between px-3 py-2.5 bg-indigo-50 hover:bg-indigo-100 transition-colors"
                            >
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-indigo-500" />
                                    <span className="text-sm font-semibold text-gray-700">Agent Statuses</span>
                                    <span className="text-xs text-indigo-600 bg-indigo-100 px-1.5 py-0.5 rounded-full">
                                        {agentStatuses.length}
                                    </span>
                                </div>
                                {expandedGroups.agent ? (
                                    <ChevronUp size={16} className="text-gray-400" />
                                ) : (
                                    <ChevronDown size={16} className="text-gray-400" />
                                )}
                            </button>
                            {expandedGroups.agent && (
                                <div className="p-2 space-y-1.5 bg-white">
                                    {agentStatuses.length > 0 ? (
                                        agentStatuses.map(status => (
                                            <div
                                                key={status.status_id}
                                                draggable
                                                onDragStart={() => handleDragStart(status)}
                                                className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border border-gray-100 cursor-grab hover:bg-gray-50 hover:border-gray-200 transition-colors ${draggedStatus?.status_id === status.status_id ? 'opacity-50' : ''}`}
                                            >
                                                <GripVertical size={12} className="text-gray-300" />
                                                <div className={`w-2.5 h-2.5 rounded-full ${getStatusColor(status)}`} />
                                                <span className="flex-1 text-sm font-medium text-gray-700 truncate">{status.status_name}</span>
                                                {status.is_final && (
                                                    <Lock size={11} className="text-gray-400" title="Final status" />
                                                )}
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-xs text-gray-400 text-center py-2">No agent statuses available</p>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* All statuses in use message */}
                        {availableStatuses.length === 0 && (
                            <div className="text-center py-8 text-gray-400">
                                <Info size={24} className="mx-auto mb-2 opacity-50" />
                                <p className="text-sm">All statuses are in use</p>
                            </div>
                        )}
                    </div>

                    {/* Legend */}
                    <div className="mt-6 pt-4 border-t border-gray-100">
                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Color Legend</h4>
                        <div className="space-y-2 text-xs">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-gray-400" />
                                <span className="text-gray-600">System / Neutral</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-blue-500" />
                                <span className="text-gray-600">Ready / Active</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-green-500" />
                                <span className="text-gray-600">Working / Progress</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                                <span className="text-gray-600">Waiting / Pending</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-red-500" />
                                <span className="text-gray-600">Termination</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-purple-500" />
                                <span className="text-gray-600">Special (Reopen)</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Add Transition Modal */}
            {showTransitionModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h3 className="text-lg font-bold text-gray-800">Add Transition</h3>
                            <button
                                onClick={() => setShowTransitionModal(false)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">From Status</label>
                                <select
                                    value={transitionForm.fromNodeId}
                                    onChange={(e) => setTransitionForm({ ...transitionForm, fromNodeId: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="">Select status...</option>
                                    {nodes.filter(n => !n.isFinal).map(node => (
                                        <option key={node.id} value={node.id}>{node.statusName}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex justify-center">
                                <ArrowRight size={24} className="text-gray-400" />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">To Status</label>
                                <select
                                    value={transitionForm.toNodeId}
                                    onChange={(e) => setTransitionForm({ ...transitionForm, toNodeId: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="">Select status...</option>
                                    {nodes.filter(n => !n.statusCode.toLowerCase().includes('new')).map(node => (
                                        <option key={node.id} value={node.id}>{node.statusName}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-1.5">
                                    <Zap size={14} className="text-amber-500" />
                                    Condition (Optional)
                                </label>
                                <input
                                    type="text"
                                    value={transitionForm.conditionLabel}
                                    onChange={(e) => setTransitionForm({ ...transitionForm, conditionLabel: e.target.value })}
                                    placeholder="e.g. User Reply, Auto Close, Approval"
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                />
                                <p className="text-xs text-gray-400 mt-1">Add "IF" label to show conditional transition</p>
                            </div>
                        </div>

                        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                            <button
                                onClick={() => setShowTransitionModal(false)}
                                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg border border-gray-200 bg-white"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={addTransitionManual}
                                disabled={!transitionForm.fromNodeId || !transitionForm.toNodeId}
                                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50"
                            >
                                Add Transition
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Warning Modal */}
            {showWarning && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                                <AlertTriangle size={24} className="text-amber-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-gray-800 mb-2">Unsaved Changes</h3>
                                <p className="text-sm text-gray-600">You have unsaved changes. Do you want to discard them?</p>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                onClick={() => { setShowWarning(false); setPendingDepartmentChange(null); }}
                                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg border border-gray-200"
                            >
                                Keep Editing
                            </button>
                            <button
                                onClick={confirmDepartmentChange}
                                className="px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg"
                            >
                                Discard & Switch
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WorkflowMapping;
