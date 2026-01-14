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
    Zap,
    CheckCircle,
    XCircle
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

// Bridge table: workflow_statuses JOIN ticket_statuses
interface WorkflowStatus {
    workflow_status_id: string;
    workflow_id: string;
    status_id: string;
    is_initial: boolean;
    is_active: boolean;
    // Joined from ticket_statuses
    status_name: string;
    status_code: string;
    status_category: 'system' | 'agent';
    is_final: boolean;
    sla_behavior: 'run' | 'pause' | 'stop';
}

// Transition stored in workflow_transitions
interface WorkflowTransitionDB {
    transition_id: string;
    workflow_id: string;
    from_status_id: string;
    to_status_id: string;
    allowed_roles: string[];
    is_automatic: boolean;
    condition?: object;
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

    const [draggedStatus, setDraggedStatus] = useState<Status | null>(null);
    const [draggingNode, setDraggingNode] = useState<string | null>(null);
    const [connectingFrom, setConnectingFrom] = useState<string | null>(null);

    // Workflow statuses - status yang diizinkan di workflow ini
    const [workflowStatuses, setWorkflowStatuses] = useState<WorkflowStatus[]>([]);
    const [loadingWorkflowStatuses, setLoadingWorkflowStatuses] = useState(false);

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

    // New transition form - matching actual table structure
    const [transitionForm, setTransitionForm] = useState({
        fromStatusId: '',
        toStatusId: '',
        allowedRoles: [] as string[],
        isAutomatic: false,
        conditionLabel: ''
    });

    // Delete confirmation state
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const deleteWorkflow = async () => {
        if (!selectedDepartment) return;

        try {
            setLoading(true);
            // 1. Delete Transitions
            const { error: transError } = await supabase
                .from('workflow_transitions')
                .delete()
                .eq('workflow_id', selectedDepartment);

            if (transError) throw transError;

            // 2. Delete Statuses
            const { error: statusError } = await supabase
                .from('workflow_statuses')
                .delete()
                .eq('workflow_template_id', selectedDepartment);

            if (statusError) throw statusError;

            // 3. Delete Workflow Entry
            const { error: wfError } = await supabase
                .from('department_workflows')
                .delete()
                .eq('workflow_id', selectedDepartment);

            if (wfError) throw wfError;

            showToast('success', 'Workflow configuration deleted successfully');
            setShowDeleteConfirm(false);
            setSelectedDepartment(null);
            fetchDepartments(); // Refresh list
        } catch (error: any) {
            console.error('Error deleting workflow:', error);
            showToast('error', error.message || 'Failed to delete workflow');
        } finally {
            setLoading(false);
        }
    };

    // Enable Workflow feature state
    const [showEnableModal, setShowEnableModal] = useState(false);
    const [availableDepts, setAvailableDepts] = useState<{ id: number, name: string }[]>([]);
    const [selectedEnableId, setSelectedEnableId] = useState('');

    // Template selection for Enable Workflow
    const [availableTemplates, setAvailableTemplates] = useState<{ id: string, name: string, category: string }[]>([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState('');
    const [enablingWorkflow, setEnablingWorkflow] = useState(false);

    const fetchAvailableDepts = async () => {
        try {
            // 1. Get all departments (from company table as per project structure)
            const { data: allDepts, error: deptError } = await supabase
                .from('company')
                .select('company_id, company_name')
                .eq('is_active', true);

            if (deptError) throw deptError;

            // 2. Get existing workflows
            const { data: existingWorkflows, error: wfError } = await supabase
                .from('department_workflows')
                .select('department_id');

            if (wfError) throw wfError;

            const existingIds = existingWorkflows?.map(w => w.department_id) || [];

            // 3. Filter: Only show departments without workflow
            const available = (allDepts || [])
                .filter(d => !existingIds.includes(d.company_id))
                .map(d => ({ id: d.company_id, name: d.company_name }));

            setAvailableDepts(available);
            if (available.length > 0) {
                setSelectedEnableId(available[0].id.toString());
            }

        } catch (error) {
            console.error('Error fetching available departments:', error);
        }
    };

    const fetchAvailableTemplates = async () => {
        try {
            const { data, error } = await supabase
                .from('workflow_templates')
                .select('id, name, category')
                .eq('is_active', true)
                .order('name');

            if (error) throw error;

            setAvailableTemplates(data || []);
            // Don't auto-select - let user choose or start empty
            setSelectedTemplateId('');
        } catch (error) {
            console.error('Error fetching templates:', error);
            setAvailableTemplates([]);
        }
    };

    const enableWorkflow = async () => {
        if (!selectedEnableId) return;

        setEnablingWorkflow(true);
        try {
            const dept = availableDepts.find(d => d.id.toString() === selectedEnableId);
            if (!dept) return;

            // 1. Create department workflow entry
            // Note: Using dept.id as department_id, assuming company_id = 1 for now
            // You may need to adjust this based on your actual data model
            const { data: newWorkflow, error: wfError } = await supabase
                .from('department_workflows')
                .insert({
                    company_id: 1, // Default company, adjust if needed
                    department_id: dept.id,
                    workflow_name: selectedTemplateId
                        ? dept.name + ' Workflow|template:' + selectedTemplateId
                        : dept.name + ' Workflow',
                    is_active: true
                })
                .select()
                .single();

            if (wfError) {
                // Handle duplicate key constraint violation
                if (wfError.code === '23505') {
                    showToast('error', `Workflow for ${dept.name} already exists. Please edit the existing workflow instead.`);
                    return;
                }
                throw wfError;
            }

            // 2. If template selected, copy statuses and transitions from TEMPLATE tables
            if (selectedTemplateId && newWorkflow) {
                // 2a. Fetch template statuses from NEW TABLE: workflow_template_statuses
                const { data: templateStatuses, error: statusErr } = await supabase
                    .from('workflow_template_statuses')
                    .select('status_id, sort_order')
                    .eq('workflow_template_id', selectedTemplateId);

                if (statusErr) throw statusErr;

                // 2b. Insert statuses into department workflow (workflow_statuses table)
                // Note: workflow_statuses.workflow_template_id references workflow_templates, not department_workflows
                // So we use selectedTemplateId (the actual template ID)
                if (templateStatuses && templateStatuses.length > 0) {
                    const statusInserts = templateStatuses.map(s => ({
                        workflow_template_id: selectedTemplateId, // FK to workflow_templates
                        status_id: s.status_id,
                        sort_order: s.sort_order
                    }));

                    const { data: insertedStatuses, error: insertErr } = await supabase
                        .from('workflow_statuses')
                        .upsert(statusInserts, { onConflict: 'workflow_template_id,status_id', ignoreDuplicates: true })
                        .select();

                    if (insertErr) throw insertErr;

                    // 2c. Fetch template transitions from NEW TABLE: workflow_template_transitions
                    const { data: templateTransitions, error: transErr } = await supabase
                        .from('workflow_template_transitions')
                        .select('from_status_id, to_status_id, allowed_roles, is_automatic, condition')
                        .eq('workflow_template_id', selectedTemplateId);

                    if (transErr) throw transErr;

                    // 2d. Insert transitions into department workflow (workflow_transitions table)
                    if (templateTransitions && templateTransitions.length > 0) {
                        const transitionInserts = templateTransitions.map(t => ({
                            workflow_id: newWorkflow.workflow_id, // FK to department_workflows
                            from_status_id: t.from_status_id,    // FK to ticket_statuses
                            to_status_id: t.to_status_id,        // FK to ticket_statuses
                            allowed_roles: t.allowed_roles ? [t.allowed_roles] : ['agent'], // Convert varchar to array
                            is_automatic: t.is_automatic || false,
                            condition: t.condition || {}
                        }));

                        const { error: transInsertErr } = await supabase
                            .from('workflow_transitions')
                            .insert(transitionInserts);

                        if (transInsertErr) throw transInsertErr;
                    }
                }

                showToast('success', `Workflow enabled for ${dept.name} (copied from template)`);
            } else {
                showToast('success', `Workflow enabled for ${dept.name} (empty workflow)`);
            }

            setShowEnableModal(false);
            setSelectedTemplateId('');

            // Refresh departments list
            await fetchDepartments();

            // Auto-select the newly created workflow to show it on canvas immediately
            if (newWorkflow) {
                setSelectedDepartment(newWorkflow.workflow_id);
            }
        } catch (error: any) {
            console.error('Error enabling workflow:', error);
            showToast('error', error.message || 'Failed to enable workflow');
        } finally {
            setEnablingWorkflow(false);
        }
    };

    useEffect(() => {
        if (showEnableModal) {
            fetchAvailableDepts();
            fetchAvailableTemplates();
        }
    }, [showEnableModal]);









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
            fetchWorkflowStatuses(selectedDepartment);
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

    // Fetch workflow statuses - status yang diizinkan di workflow ini
    const fetchWorkflowStatuses = async (workflowId: string) => {
        setLoadingWorkflowStatuses(true);
        try {
            // Get the selected department's workflow info
            const selectedWorkflow = departments.find(d => d.workflow_id === workflowId);

            // Extract template ID from workflow_name if present (format: "Name|template:uuid")
            let templateId: string | null = null;
            if (selectedWorkflow?.workflow_name?.includes('|template:')) {
                templateId = selectedWorkflow.workflow_name.split('|template:')[1];
            }

            let data: any[] = [];

            // If workflow uses a template, load from workflow_template_statuses
            if (templateId) {
                const { data: templateData, error } = await supabase
                    .from('workflow_template_statuses')
                    .select(`
                        workflow_template_status_id,
                        workflow_template_id,
                        status_id,
                        ticket_statuses (
                            status_name,
                            status_code,
                            status_category,
                            is_final,
                            sla_behavior
                        )
                    `)
                    .eq('workflow_template_id', templateId);

                if (error) throw error;

                // Map to expected structure
                data = (templateData || []).map((item: any) => ({
                    workflow_status_id: item.workflow_template_status_id,
                    workflow_template_id: item.workflow_template_id,
                    status_id: item.status_id,
                    ticket_statuses: item.ticket_statuses
                }));
            } else {
                // Fallback: try loading from workflow_statuses (legacy)
                const { data: legacyData, error } = await supabase
                    .from('workflow_statuses')
                    .select(`
                        workflow_status_id,
                        workflow_template_id,
                        status_id,
                        ticket_statuses (
                            status_name,
                            status_code,
                            status_category,
                            is_final,
                            sla_behavior
                        )
                    `)
                    .eq('workflow_template_id', workflowId);

                if (error) throw error;
                data = legacyData || [];
            }

            // Transform the data to flatten the joined table
            const transformedData: WorkflowStatus[] = data.map((item: any) => ({
                workflow_status_id: item.workflow_status_id,
                workflow_id: item.workflow_template_id,
                status_id: item.status_id,
                is_initial: false, // Default to false since column doesn't exist
                is_active: true, // Default to true since column doesn't exist
                status_name: item.ticket_statuses?.status_name || '',
                status_code: item.ticket_statuses?.status_code || '',
                status_category: item.ticket_statuses?.status_category || 'agent',
                is_final: item.ticket_statuses?.is_final || false,
                sla_behavior: item.ticket_statuses?.sla_behavior || 'run'
            }));

            setWorkflowStatuses(transformedData);
            console.log('Workflow statuses loaded:', transformedData);
        } catch (error) {
            console.error('Error fetching workflow statuses:', error);
            setWorkflowStatuses([]);
        } finally {
            setLoadingWorkflowStatuses(false);
        }
    };

    const loadWorkflow = async () => {
        if (!selectedDepartment) return;

        try {
            // Get the selected department's workflow info
            const selectedWorkflow = departments.find(d => d.workflow_id === selectedDepartment);

            // Extract template ID from workflow_name if present (format: "Name|template:uuid")
            let templateId: string | null = null;
            if (selectedWorkflow?.workflow_name?.includes('|template:')) {
                templateId = selectedWorkflow.workflow_name.split('|template:')[1];
            }

            let statusData: any[] = [];

            // If workflow uses a template, load from workflow_template_statuses
            if (templateId) {
                const { data, error } = await supabase
                    .from('workflow_template_statuses')
                    .select(`
                        workflow_template_status_id,
                        workflow_template_id,
                        status_id,
                        sort_order,
                        position_x,
                        position_y,
                        ticket_statuses (
                            status_name,
                            status_code,
                            status_category,
                            is_final,
                            sla_behavior
                        )
                    `)
                    .eq('workflow_template_id', templateId)
                    .order('sort_order');

                if (error) throw error;

                // Map to same structure as workflow_statuses
                statusData = (data || []).map((item: any) => ({
                    workflow_status_id: item.workflow_template_status_id,
                    workflow_template_id: item.workflow_template_id,
                    status_id: item.status_id,
                    position_x: item.position_x,
                    position_y: item.position_y,
                    ticket_statuses: item.ticket_statuses
                }));

                console.log('Loaded from template:', templateId, statusData.length, 'statuses');
            } else {
                // Fallback: try loading from workflow_statuses (legacy)
                const { data, error } = await supabase
                    .from('workflow_statuses')
                    .select(`
                        workflow_status_id,
                        workflow_template_id,
                        status_id,
                        ticket_statuses (
                            status_name,
                            status_code,
                            status_category,
                            is_final,
                            sla_behavior
                        )
                    `)
                    .eq('workflow_template_id', selectedDepartment);

                if (error) throw error;
                statusData = data || [];
            }

            // 2. Fetch workflow_transitions
            const { data: transData, error: transError } = await supabase
                .from('workflow_transitions')
                .select('*')
                .eq('workflow_id', selectedDepartment);

            if (transError) throw transError;

            // 3. Convert statusData to WorkflowNode[]
            // Use saved positions from template if available, otherwise use vertical layout
            const NODE_WIDTH = 180;
            const NODE_HEIGHT = 80;
            const VERTICAL_GAP = 100;
            const START_X = 80;
            const START_Y = 50;
            const FINAL_COLUMN_X = 400; // X position for final statuses (right side)

            // Check if positions are saved in template
            const hasPositions = statusData.some((item: any) =>
                item.position_x !== null && item.position_y !== null
            );

            const allNodes: WorkflowNode[] = [];

            if (hasPositions) {
                // Use saved positions from template
                statusData.forEach((item: any) => {
                    allNodes.push({
                        id: item.workflow_status_id,
                        statusId: item.status_id,
                        statusName: item.ticket_statuses?.status_name || 'Unknown',
                        statusCode: item.ticket_statuses?.status_code || '',
                        x: item.position_x || START_X,
                        y: item.position_y || START_Y,
                        color: getStatusColorFromCode(item.ticket_statuses?.status_code || ''),
                        isFinal: item.ticket_statuses?.is_final || false,
                        isSystem: item.ticket_statuses?.status_category === 'system'
                    });
                });
            } else {
                // Generate vertical layout (like Workflow Template)
                // Separate main flow and final statuses
                const mainFlowStatuses = statusData.filter((item: any) =>
                    !item.ticket_statuses?.is_final ||
                    item.ticket_statuses?.status_code?.toLowerCase().includes('closed')
                ).sort((a: any, b: any) => {
                    // Sort by logical order: New -> Open -> Progress -> Resolved -> Closed
                    const order = ['new', 'open', 'assign', 'progress', 'work', 'resolved', 'complete', 'closed'];
                    const aCode = a.ticket_statuses?.status_code?.toLowerCase() || '';
                    const bCode = b.ticket_statuses?.status_code?.toLowerCase() || '';
                    const aIndex = order.findIndex(o => aCode.includes(o));
                    const bIndex = order.findIndex(o => bCode.includes(o));
                    return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
                });

                const finalStatuses = statusData.filter((item: any) =>
                    item.ticket_statuses?.is_final &&
                    !item.ticket_statuses?.status_code?.toLowerCase().includes('closed')
                );

                // Position main flow vertically on left side
                mainFlowStatuses.forEach((item: any, index: number) => {
                    allNodes.push({
                        id: item.workflow_status_id,
                        statusId: item.status_id,
                        statusName: item.ticket_statuses?.status_name || 'Unknown',
                        statusCode: item.ticket_statuses?.status_code || '',
                        x: START_X,
                        y: START_Y + index * (NODE_HEIGHT + VERTICAL_GAP),
                        color: getStatusColorFromCode(item.ticket_statuses?.status_code || ''),
                        isFinal: item.ticket_statuses?.is_final || false,
                        isSystem: item.ticket_statuses?.status_category === 'system'
                    });
                });

                // Position final statuses (like Canceled, Rejected) on right side
                finalStatuses.forEach((item: any, index: number) => {
                    allNodes.push({
                        id: item.workflow_status_id,
                        statusId: item.status_id,
                        statusName: item.ticket_statuses?.status_name || 'Unknown',
                        statusCode: item.ticket_statuses?.status_code || '',
                        x: FINAL_COLUMN_X,
                        y: START_Y + 150 + index * (NODE_HEIGHT + VERTICAL_GAP), // Start a bit lower on right
                        color: getStatusColorFromCode(item.ticket_statuses?.status_code || ''),
                        isFinal: item.ticket_statuses?.is_final || false,
                        isSystem: item.ticket_statuses?.status_category === 'system'
                    });
                });
            }

            // 4. Convert workflow_transitions to Transition[]
            // Map from_status_id/to_status_id to workflow_status_id (node id)
            const statusIdToNodeId = new Map<string, string>();
            statusData.forEach((item: any) => {
                statusIdToNodeId.set(item.status_id, item.workflow_status_id);
            });

            // Also load transitions from template if using template
            let transitionsToUse = transData || [];
            if (templateId && (!transData || transData.length === 0)) {
                // Load transitions from template
                const { data: templateTransData } = await supabase
                    .from('workflow_template_transitions')
                    .select('*')
                    .eq('workflow_template_id', templateId);

                if (templateTransData && templateTransData.length > 0) {
                    transitionsToUse = templateTransData.map((t: any) => ({
                        ...t,
                        transition_id: t.workflow_template_transition_id
                    }));
                }
            }

            const workflowTransitions: Transition[] = transitionsToUse.map((item: any) => ({
                id: item.transition_id || item.workflow_template_transition_id,
                fromNodeId: statusIdToNodeId.get(item.from_status_id) || '',
                toNodeId: statusIdToNodeId.get(item.to_status_id) || '',
                conditionLabel: item.condition?.label
            })).filter((t: Transition) => t.fromNodeId && t.toNodeId);

            // 5. Update state
            setNodes(allNodes);
            setTransitions(workflowTransitions);
            updateAvailableStatuses(allNodes);
            setHasUnsavedChanges(false);

            console.log('Workflow loaded:', { nodes: allNodes.length, transitions: workflowTransitions.length });

        } catch (error) {
            console.error('Error loading workflow:', error);
            setNodes([]);
            setTransitions([]);
            updateAvailableStatuses([]);
        }
    };

    // Helper function to get color from status code
    const getStatusColorFromCode = (code: string): string => {
        const lowerCode = code.toLowerCase();
        if (lowerCode.includes('new')) return 'bg-blue-500';
        if (lowerCode.includes('open') || lowerCode.includes('assign')) return 'bg-indigo-500';
        if (lowerCode.includes('progress') || lowerCode.includes('work')) return 'bg-green-500';
        if (lowerCode.includes('pending') || lowerCode.includes('wait')) return 'bg-yellow-500';
        if (lowerCode.includes('resolved') || lowerCode.includes('complete')) return 'bg-emerald-400';
        if (lowerCode.includes('closed')) return 'bg-gray-600';
        if (lowerCode.includes('cancel') || lowerCode.includes('reject')) return 'bg-red-500';
        if (lowerCode.includes('reopen')) return 'bg-purple-500';
        return 'bg-indigo-500';
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

    const handleCanvasDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        if (!draggedStatus || !canvasRef.current || !selectedDepartment) return;

        const rect = canvasRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left - 75; // Center the node
        const y = e.clientY - rect.top - 25;

        try {
            // Save to database
            const { data, error } = await supabase
                .from('workflow_statuses')
                .insert({
                    workflow_template_id: selectedDepartment,
                    status_id: draggedStatus.status_id,
                    sort_order: nodes.length + 1
                })
                .select()
                .single();

            if (error) throw error;

            const newNode: WorkflowNode = {
                id: data.workflow_status_id, // Use real DB ID
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
            showToast('success', 'Status added to workflow');

        } catch (error: any) {
            console.error('Error adding status:', error);
            showToast('error', error.message || 'Failed to add status');
        }
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

    const handleConnectEnd = async (nodeId: string) => {
        if (!connectingFrom || connectingFrom === nodeId || !selectedDepartment) {
            setConnectingFrom(null);
            return;
        }

        const fromNode = nodes.find(n => n.id === connectingFrom);
        const toNode = nodes.find(n => n.id === nodeId);

        // Validation
        if (toNode?.statusCode.toLowerCase().includes('new')) {
            showToast('error', 'Cannot create incoming transition to "New" status');
            setConnectingFrom(null);
            return;
        }

        // Check if transition already exists
        const exists = transitions.some(t => t.fromNodeId === connectingFrom && t.toNodeId === nodeId);
        if (exists) {
            showToast('error', 'This transition already exists');
            setConnectingFrom(null);
            return;
        }

        if (!fromNode || !toNode) {
            setConnectingFrom(null);
            return;
        }

        try {
            // Save to database immediately
            const { data, error } = await supabase
                .from('workflow_transitions')
                .insert({
                    workflow_id: selectedDepartment,
                    from_status_id: fromNode.statusId,  // status_id references ticket_statuses
                    to_status_id: toNode.statusId,      // status_id references ticket_statuses
                    allowed_roles: ['agent'],           // Default role
                    is_automatic: false
                })
                .select()
                .single();

            if (error) throw error;

            // Add to local state
            const newTransition: Transition = {
                id: data.transition_id,
                fromNodeId: connectingFrom,
                toNodeId: nodeId
            };

            setTransitions(prev => [...prev, newTransition]);
            showToast('success', `Transition: ${fromNode.statusName} → ${toNode.statusName}`);
        } catch (error: any) {
            console.error('Error saving transition:', error);
            showToast('error', error.message || 'Failed to create transition');
        } finally {
            setConnectingFrom(null);
        }
    };

    const removeNode = async (nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (node?.isSystem) {
            showToast('error', 'Cannot remove system nodes');
            return;
        }

        try {
            // 1. Delete associated transitions first
            const { error: transError } = await supabase
                .from('workflow_transitions')
                .delete()
                .eq('workflow_id', selectedDepartment)
                .or(`from_status_id.eq.${node?.statusId},to_status_id.eq.${node?.statusId}`);

            if (transError) throw transError;

            // 2. Delete the status from workflow
            const { error: statusError } = await supabase
                .from('workflow_statuses')
                .delete()
                .eq('workflow_status_id', nodeId);

            if (statusError) throw statusError;

            // Update local state
            const newNodes = nodes.filter(n => n.id !== nodeId);
            const newTransitions = transitions.filter(t => t.fromNodeId !== nodeId && t.toNodeId !== nodeId);

            setNodes(newNodes);
            setTransitions(newTransitions);
            updateAvailableStatuses(newNodes);
            showToast('success', 'Status removed from workflow');

        } catch (error: any) {
            console.error('Error removing status:', error);
            showToast('error', error.message || 'Failed to remove status');
        }
    };

    const removeTransition = async (transitionId: string) => {
        try {
            const { error } = await supabase
                .from('workflow_transitions')
                .delete()
                .eq('transition_id', transitionId);

            if (error) throw error;

            setTransitions(prev => prev.filter(t => t.id !== transitionId));
            showToast('success', 'Transition removed');
        } catch (error: any) {
            console.error('Error removing transition:', error);
            showToast('error', error.message || 'Failed to remove transition');
        }
    };

    const addTransitionManual = async () => {
        if (!transitionForm.fromStatusId || !transitionForm.toStatusId || !selectedDepartment) return;

        // Validation: From and To cannot be the same
        if (transitionForm.fromStatusId === transitionForm.toStatusId) {
            showToast('error', 'From Status and To Status cannot be the same');
            return;
        }

        // Get the actual status records to retrieve status_id (which references ticket_statuses)
        const fromWorkflowStatus = workflowStatuses.find(s => s.workflow_status_id === transitionForm.fromStatusId);
        const toWorkflowStatus = workflowStatuses.find(s => s.workflow_status_id === transitionForm.toStatusId);

        if (!fromWorkflowStatus || !toWorkflowStatus) {
            showToast('error', 'Invalid status selection');
            return;
        }

        try {
            // Save to database - use status_id (references ticket_statuses), NOT workflow_status_id
            const { data, error } = await supabase
                .from('workflow_transitions')
                .insert({
                    workflow_id: selectedDepartment,
                    from_status_id: fromWorkflowStatus.status_id, // This references ticket_statuses.status_id
                    to_status_id: toWorkflowStatus.status_id,     // This references ticket_statuses.status_id
                    allowed_roles: transitionForm.allowedRoles.length > 0 ? transitionForm.allowedRoles : ['agent'],
                    is_automatic: transitionForm.isAutomatic,
                    condition: transitionForm.conditionLabel ? { label: transitionForm.conditionLabel } : {}
                })
                .select()
                .single();

            if (error) throw error;

            // Add to local state for canvas display
            const newTransition: Transition = {
                id: data.transition_id,
                fromNodeId: transitionForm.fromStatusId,
                toNodeId: transitionForm.toStatusId,
                conditionLabel: transitionForm.conditionLabel || undefined
            };

            setTransitions(prev => [...prev, newTransition]);
            setTransitionForm({
                fromStatusId: '',
                toStatusId: '',
                allowedRoles: [],
                isAutomatic: false,
                conditionLabel: ''
            });
            setShowTransitionModal(false);

            showToast('success', `Transition added: ${fromWorkflowStatus.status_name} → ${toWorkflowStatus.status_name}`);
        } catch (error: any) {
            console.error('Error saving transition:', error);
            showToast('error', error.message || 'Failed to save transition. Please try again.');
        }
    };

    const handleSave = async () => {
        // TODO: Save workflow to database
        console.log('Saving workflow:', { nodes, transitions, departmentId: selectedDepartment });
        setHasUnsavedChanges(false);
        showToast('success', 'Workflow saved successfully!');
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
            {/* Toast Notification */}
            {toast.show && (
                <div
                    className={`fixed top-4 right-4 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border backdrop-blur-sm ${toast.type === 'success'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-red-50 border-red-200 text-red-800'
                        }`}
                    style={{
                        animation: 'slideIn 0.3s ease-out forwards'
                    }}
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

            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-6 py-4">
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">Workflow Mapping</h1>
                        <p className="text-gray-500 text-sm">Configure workflow rules for each department</p>
                    </div>


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
                                    {dept.workflow_name.split('|template:')[0]}
                                </option>
                            ))}
                        </select>
                        <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>

                    {selectedDepartment && (
                        <button
                            onClick={() => setShowDeleteConfirm(true)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete Workflow Configuration"
                        >
                            <Trash2 size={18} />
                        </button>
                    )}

                    <div className="h-6 w-px bg-gray-200 mx-2"></div>

                    <button
                        onClick={() => setShowEnableModal(true)}
                        className="text-indigo-600 hover:text-indigo-700 text-sm font-medium flex items-center gap-1 hover:underline"
                    >
                        <Plus size={14} />
                        Enable Workflow for Department
                    </button>
                </div>
            </div>

            {/* Action Bar - Only show when workflow has nodes */}
            {selectedDepartment && nodes.length > 0 && (
                <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3">
                    <button
                        onClick={() => setShowTransitionModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
                    >
                        <Plus size={16} />
                        Add Transition
                    </button>
                    <div className="flex-1" />
                </div>
            )}

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

                        {/* Nodes - Styled like Workflow Template */}
                        {nodes.map((node, index) => {
                            // Determine if this is Start (first non-final in main flow) or Final
                            const isStart = index === 0 && !node.isFinal;
                            const bgColorMap: Record<string, string> = {
                                'bg-blue-500': 'bg-blue-50 border-blue-300',
                                'bg-indigo-500': 'bg-indigo-50 border-indigo-300',
                                'bg-green-500': 'bg-green-50 border-green-300',
                                'bg-yellow-500': 'bg-yellow-50 border-yellow-300',
                                'bg-emerald-400': 'bg-emerald-50 border-emerald-300',
                                'bg-gray-600': 'bg-gray-100 border-gray-400',
                                'bg-red-500': 'bg-red-50 border-red-300',
                                'bg-purple-500': 'bg-purple-50 border-purple-300'
                            };
                            const textColorMap: Record<string, string> = {
                                'bg-blue-500': 'text-blue-800',
                                'bg-indigo-500': 'text-indigo-800',
                                'bg-green-500': 'text-green-800',
                                'bg-yellow-500': 'text-yellow-800',
                                'bg-emerald-400': 'text-emerald-800',
                                'bg-gray-600': 'text-gray-800',
                                'bg-red-500': 'text-red-800',
                                'bg-purple-500': 'text-purple-800'
                            };
                            const cardStyle = bgColorMap[node.color] || 'bg-gray-50 border-gray-300';
                            const textStyle = textColorMap[node.color] || 'text-gray-800';

                            return (
                                <div
                                    key={node.id}
                                    className={`absolute rounded-xl shadow-md cursor-move select-none border-2 ${cardStyle} transition-all hover:shadow-lg`}
                                    style={{
                                        left: node.x,
                                        top: node.y,
                                        zIndex: draggingNode === node.id ? 10 : 2,
                                        minWidth: '160px',
                                        padding: '12px 16px'
                                    }}
                                    onMouseDown={(e) => handleNodeDragStart(node.id, e)}
                                    onClick={() => connectingFrom && handleConnectEnd(node.id)}
                                >
                                    {/* Start Badge */}
                                    {isStart && (
                                        <div className="absolute -top-3 left-3 px-2 py-0.5 bg-green-500 text-white text-xs font-bold rounded">
                                            Start
                                        </div>
                                    )}

                                    {/* Final Badge */}
                                    {node.isFinal && (
                                        <div className="absolute -top-3 right-3 px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded">
                                            Final
                                        </div>
                                    )}

                                    {/* Status Name */}
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className={`w-2 h-2 rounded-full ${node.color}`} />
                                        <span className={`font-semibold text-sm ${textStyle}`}>{node.statusName}</span>
                                    </div>

                                    {/* Category Label */}
                                    <div className="text-xs text-gray-500">
                                        {node.isSystem ? 'System' : 'Agent'}
                                    </div>

                                    {/* Action buttons */}
                                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                        {!node.isFinal && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleConnectStart(node.id, e); }}
                                                className={`p-1 rounded hover:bg-black/10 transition-colors ${connectingFrom === node.id ? 'bg-black/10' : ''}`}
                                                title="Connect to another status"
                                            >
                                                <ArrowRight size={14} className="text-gray-500" />
                                            </button>
                                        )}
                                        {!node.isSystem && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); removeNode(node.id); }}
                                                className="p-1 rounded hover:bg-red-100 transition-colors"
                                                title="Remove from workflow"
                                            >
                                                <X size={14} className="text-gray-400 hover:text-red-500" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}

                        {/* Empty State - Contextual based on workflow status */}
                        {nodes.length === 0 && (
                            <div className="absolute inset-0 flex items-center justify-center">
                                {!selectedDepartment || departments.length === 0 ? (
                                    /* No department workflow exists */
                                    <div className="text-center max-w-md px-8">
                                        <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <AlertTriangle size={40} className="text-amber-500" />
                                        </div>
                                        <h3 className="text-xl font-bold text-gray-800 mb-2">No Workflow Enabled</h3>
                                        <p className="text-gray-500 mb-6">
                                            Enable a workflow template for a department to start configuring status flow.
                                        </p>
                                        <button
                                            onClick={() => setShowEnableModal(true)}
                                            className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium shadow-lg shadow-indigo-200"
                                        >
                                            <Zap size={18} />
                                            Enable Workflow for Department
                                        </button>
                                    </div>
                                ) : (
                                    /* Workflow exists but canvas is empty */
                                    <div className="text-center text-gray-400">
                                        <Settings size={48} className="mx-auto mb-3 opacity-50" />
                                        <p className="text-lg font-medium">Workflow is empty</p>
                                        <p className="text-sm">Drag statuses from the right panel to start building</p>
                                        <p className="text-xs mt-2 text-gray-300">Or select a template when enabling workflow</p>
                                    </div>
                                )}
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

                {/* Right Panel - Available Statuses (Only show when workflow is active) */}
                {selectedDepartment && departments.length > 0 && (
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
                )}
            </div>

            {/* Add Transition Modal */}
            {showTransitionModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <div>
                                <h3 className="text-lg font-bold text-gray-800">Add Transition</h3>
                                <p className="text-xs text-gray-500">Define status transition for this workflow</p>
                            </div>
                            <button
                                onClick={() => setShowTransitionModal(false)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            {/* Loading state */}
                            {loadingWorkflowStatuses ? (
                                <div className="text-center py-8">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-2"></div>
                                    <p className="text-sm text-gray-500">Loading workflow statuses...</p>
                                </div>
                            ) : workflowStatuses.length === 0 ? (
                                <div className="text-center py-8 bg-amber-50 rounded-lg border border-amber-200">
                                    <AlertTriangle size={32} className="mx-auto mb-2 text-amber-500" />
                                    <p className="text-sm font-medium text-amber-700">No statuses configured for this workflow</p>
                                    <p className="text-xs text-amber-600 mt-1">Please add statuses to workflow_statuses table first</p>
                                </div>
                            ) : (
                                <>
                                    {/* From Status */}
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">From Status</label>
                                        <select
                                            value={transitionForm.fromStatusId}
                                            onChange={(e) => setTransitionForm({ ...transitionForm, fromStatusId: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        >
                                            <option value="">Select status...</option>
                                            {workflowStatuses
                                                .filter(s => !s.is_final) // Final status cannot be "from"
                                                .map(status => (
                                                    <option key={status.workflow_status_id} value={status.workflow_status_id}>
                                                        {status.status_name}
                                                    </option>
                                                ))
                                            }
                                        </select>
                                        <p className="text-xs text-gray-400 mt-1">Status where transition starts (excludes final statuses)</p>
                                    </div>

                                    <div className="flex justify-center">
                                        <ArrowRight size={24} className="text-gray-400" />
                                    </div>

                                    {/* To Status */}
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">To Status</label>
                                        <select
                                            value={transitionForm.toStatusId}
                                            onChange={(e) => setTransitionForm({ ...transitionForm, toStatusId: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        >
                                            <option value="">Select status...</option>
                                            {workflowStatuses
                                                .filter(s => s.workflow_status_id !== transitionForm.fromStatusId) // Exclude selected from
                                                .map(status => (
                                                    <option key={status.workflow_status_id} value={status.workflow_status_id}>
                                                        {status.status_name}
                                                        {status.is_final && ' (Final)'}
                                                    </option>
                                                ))
                                            }
                                        </select>
                                        <p className="text-xs text-gray-400 mt-1">Status where transition ends</p>
                                    </div>

                                    {/* Options */}
                                    <div className="border-t border-gray-100 pt-4 space-y-3">
                                        <label className="flex items-center gap-3 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={transitionForm.isAutomatic}
                                                onChange={(e) => setTransitionForm({ ...transitionForm, isAutomatic: e.target.checked })}
                                                className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                            />
                                            <div>
                                                <span className="text-sm font-medium text-gray-700">Automatic Transition</span>
                                                <p className="text-xs text-gray-400">This transition happens automatically based on conditions</p>
                                            </div>
                                        </label>
                                    </div>

                                    {/* Condition Label (Optional) */}
                                    <div>
                                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-1.5">
                                            <Zap size={14} className="text-amber-500" />
                                            Display Label (Optional)
                                        </label>
                                        <input
                                            type="text"
                                            value={transitionForm.conditionLabel}
                                            onChange={(e) => setTransitionForm({ ...transitionForm, conditionLabel: e.target.value })}
                                            placeholder="e.g. Resolve, Escalate, Send to Customer"
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                        />
                                        <p className="text-xs text-gray-400 mt-1">Custom label shown on the transition button</p>
                                    </div>
                                </>
                            )}
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
                                disabled={!transitionForm.fromStatusId || !transitionForm.toStatusId || loadingWorkflowStatuses}
                                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
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
                                onClick={() => setShowWarning(false)}
                                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
                            >
                                Cancel
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

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                                <Trash2 size={24} className="text-red-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-gray-800 mb-2">Delete Workflow?</h3>
                                <p className="text-sm text-gray-600">
                                    Are you sure you want to delete this workflow configuration?
                                    All statuses and transitions will be permanently removed.
                                </p>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={deleteWorkflow}
                                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg"
                            >
                                Delete Workflow
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Enable Workflow Modal */}
            {showEnableModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-gray-800">Enable Workflow for Department</h3>
                            <button onClick={() => setShowEnableModal(false)} className="text-gray-400 hover:text-gray-600">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6">
                            {availableDepts.length === 0 ? (
                                <div className="text-center py-6 bg-gray-50 rounded-lg">
                                    <CheckCircle size={32} className="mx-auto mb-2 text-green-500" />
                                    <p className="text-gray-600 font-medium">All departments already have workflows enabled.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {/* Department Selector */}
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Select Department</label>
                                        <select
                                            value={selectedEnableId}
                                            onChange={(e) => setSelectedEnableId(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        >
                                            <option value="" disabled>Select a department...</option>
                                            {availableDepts.map(dept => (
                                                <option key={dept.id} value={dept.id}>{dept.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Template Selector */}
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                            Base Template
                                            <span className="text-gray-400 font-normal ml-1">(Optional)</span>
                                        </label>
                                        <select
                                            value={selectedTemplateId}
                                            onChange={(e) => setSelectedTemplateId(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        >
                                            <option value="">Start with empty workflow</option>
                                            {availableTemplates.map(template => (
                                                <option key={template.id} value={template.id}>
                                                    {template.name} ({template.category})
                                                </option>
                                            ))}
                                        </select>
                                        <p className="text-xs text-gray-500 mt-1">
                                            {selectedTemplateId
                                                ? 'Statuses and transitions will be copied from the selected template.'
                                                : 'You can configure statuses and transitions manually later.'
                                            }
                                        </p>
                                    </div>

                                    {/* Info Box */}
                                    {selectedTemplateId && (
                                        <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 flex items-start gap-2">
                                            <Info size={16} className="text-indigo-600 flex-shrink-0 mt-0.5" />
                                            <p className="text-xs text-indigo-700">
                                                The selected template's workflow configuration will be copied to this department.
                                                You can customize it after creation.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3 rounded-b-2xl">
                            <button
                                onClick={() => setShowEnableModal(false)}
                                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg border border-gray-200 bg-white"
                            >
                                Cancel
                            </button>
                            {availableDepts.length > 0 && (
                                <button
                                    onClick={enableWorkflow}
                                    disabled={!selectedEnableId || enablingWorkflow}
                                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {enablingWorkflow ? (
                                        <>
                                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                            </svg>
                                            Creating...
                                        </>
                                    ) : (
                                        selectedTemplateId ? 'Enable with Template' : 'Enable Workflow'
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WorkflowMapping;
