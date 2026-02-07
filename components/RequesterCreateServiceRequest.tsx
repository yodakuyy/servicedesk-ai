import React, { useState, useEffect } from 'react';
import {
    ArrowLeft, Send, Search, ChevronRight, Folder,
    FileText, Calendar, Hash, Type, CheckSquare,
    List, Paperclip, Info, AlertCircle
} from 'lucide-react';
import { supabase } from '../lib/supabase';
// @ts-ignore
import Swal from 'https://cdn.jsdelivr.net/npm/sweetalert2@11/+esm';

interface RequesterCreateServiceRequestProps {
    onBack?: () => void;
    onSubmitSuccess?: () => void;
    userProfile?: any;
    ticketType?: 'Service Request' | 'Change Request'; // Make it reusable
}

interface CategoryNode {
    id: string;
    name: string;
    description?: string;
    type: string;
    level: number;
    children?: CategoryNode[];
    parent_id?: string | null;
}

interface CustomField {
    id: string;
    label: string;
    type: 'text' | 'textarea' | 'number' | 'date' | 'dropdown' | 'multiselect' | 'checkbox' | 'file' | 'label' | 'link';
    required: boolean;
    options?: string[];
    placeholder?: string;
    description?: string;
    defaultValue?: string;
    order_index: number;
}

const RequesterCreateServiceRequest: React.FC<RequesterCreateServiceRequestProps> = ({
    onBack,
    onSubmitSuccess,
    userProfile,
    ticketType = 'Service Request'
}) => {
    // Top Level State
    const [step, setStep] = useState<1 | 2>(1); // 1: Select Category, 2: Fill Form

    // Step 1: Category Selection
    const [categories, setCategories] = useState<CategoryNode[]>([]);
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
    const [selectedCategoryName, setSelectedCategoryName] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoadingCategories, setIsLoadingCategories] = useState(true);

    // Step 2: Form Data
    const [fields, setFields] = useState<CustomField[]>([]);
    const [formValues, setFormValues] = useState<{ [key: string]: any }>({});
    const [isLoadingFields, setIsLoadingFields] = useState(false);
    const [files, setFiles] = useState<{ [key: string]: File }>({});

    // Submission
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [openStatusId, setOpenStatusId] = useState<string | null>(null);

    // Initial Load
    useEffect(() => {
        fetchCategories();
        fetchOpenStatus();
        setStep(1); // Reset step when ticket type changes
    }, [ticketType]);

    const fetchOpenStatus = async () => {
        const { data } = await supabase
            .from('ticket_statuses')
            .select('status_id')
            .eq('status_name', 'Open')
            .single();
        if (data) setOpenStatusId(data.status_id);
    };

    const fetchCategories = async () => {
        setIsLoadingCategories(true);
        try {
            const { data, error } = await supabase
                .from('ticket_categories')
                .select('*')
                .eq('category_type', ticketType) // Filter by Service Request or Change Request
                .eq('is_active', true)
                .order('level', { ascending: true })
                .order('name', { ascending: true });

            if (error) throw error;

            if (data) {
                // Build Tree
                const nodes: CategoryNode[] = data.map((item: any) => ({
                    id: String(item.id),
                    name: item.name,
                    description: item.description,
                    type: item.category_type,
                    level: item.level,
                    parent_id: item.parent_id ? String(item.parent_id) : null,
                    children: []
                }));
                const tree = buildTree(nodes);
                setCategories(tree);
            }
        } catch (error) {
            console.error('Error fetching categories:', error);
        } finally {
            setIsLoadingCategories(false);
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

    const handleCategorySelect = (node: CategoryNode) => {
        setSelectedCategoryId(node.id);
        setSelectedCategoryName(node.name);
        fetchFields(node.id);
        setStep(2);
    };

    // Render Tree Recursively
    const renderCategoryTree = (nodes: CategoryNode[]) => {
        const filtered = nodes.filter(n =>
            !searchQuery ||
            n.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            n.children?.some(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
        );

        if (filtered.length === 0 && searchQuery) return <div className="text-gray-400 text-sm p-4">No categories found matching "{searchQuery}"</div>;

        return (
            <div className="space-y-2">
                {filtered.map(node => (
                    <div key={node.id} className="ml-2">
                        <div
                            onClick={() => handleCategorySelect(node)}
                            className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all hover:bg-indigo-50 hover:border-indigo-200 group ${selectedCategoryId === node.id ? 'bg-indigo-50 border-indigo-300 ring-1 ring-indigo-500/20' : 'bg-white border-gray-100'}`}
                        >
                            <div className="p-2 bg-gray-50 rounded-lg text-gray-400 group-hover:text-indigo-500 group-hover:bg-white transition-colors">
                                {node.children && node.children.length > 0 ? <Folder size={18} /> : <FileText size={18} />}
                            </div>
                            <div className="flex-1">
                                <h4 className="font-bold text-gray-800 text-sm">{node.name}</h4>
                                {node.description && <p className="text-xs text-gray-500 mt-0.5">{node.description}</p>}
                            </div>
                            {node.children && node.children.length === 0 && (
                                <ChevronRight size={16} className="text-gray-300 group-hover:text-indigo-400" />
                            )}
                        </div>
                        {/* Recursive Children */}
                        {node.children && node.children.length > 0 && (
                            <div className="mt-2 ml-4 border-l-2 border-gray-100 pl-4">
                                {renderCategoryTree(node.children)}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        );
    };

    const fetchFields = async (categoryId: string) => {
        setIsLoadingFields(true);
        setFormValues({});
        setFiles({});
        try {
            const { data, error } = await supabase
                .from('ticket_form_fields')
                .select('*')
                .eq('category_id', categoryId)
                .order('order_index', { ascending: true });

            if (error) throw error;

            if (data) {
                const mapped: CustomField[] = data.map((item: any) => ({
                    id: item.id,
                    label: item.label,
                    type: item.field_type,
                    required: item.is_required,
                    options: item.options,
                    placeholder: item.placeholder,
                    description: item.description,
                    defaultValue: item.default_value,
                    order_index: item.order_index
                }));
                setFields(mapped);

                // Initialize default values
                const initialValues: any = {};
                mapped.forEach(f => {
                    if (f.defaultValue) initialValues[f.id] = f.defaultValue;
                    if (f.type === 'checkbox') initialValues[f.id] = false;
                });
                setFormValues(initialValues);
            }
        } catch (error) {
            console.error('Error fetching fields:', error);
            Swal.fire('Error', 'Failed to load form fields', 'error');
        } finally {
            setIsLoadingFields(false);
        }
    };

    // Form Handling
    const handleInputChange = (fieldId: string, value: any) => {
        setFormValues(prev => ({ ...prev, [fieldId]: value }));
    };

    const handleFileChange = (fieldId: string, file: File) => {
        setFiles(prev => ({ ...prev, [fieldId]: file }));
    };

    const validateForm = () => {
        for (const field of fields) {
            if (field.required && field.type !== 'label' && field.type !== 'link') {
                if (field.type === 'file') {
                    if (!files[field.id]) return false;
                } else {
                    const val = formValues[field.id];
                    if (val === undefined || val === null || val === '') return false;
                    if (Array.isArray(val) && val.length === 0) return false;
                }
            }
        }
        return true;
    };

    const handleSubmit = async () => {
        if (!validateForm()) {
            Swal.fire({
                icon: 'warning',
                title: 'Missing Fields',
                text: 'Please fill in all required fields.',
                confirmButtonColor: '#4f46e5'
            });
            return;
        }

        if (!openStatusId) {
            Swal.fire('Error', 'System configuration error (Status ID missing)', 'error');
            return;
        }

        setIsSubmitting(true);

        try {
            // 1. Construct Description from Form Data
            let descriptionHtml = `<div class="service-request-summary"><h3>${ticketType} Details</h3><table style="width:100%; border-collapse: collapse; margin-top: 10px;">`;

            fields.forEach(field => {
                if (field.type === 'label' || field.type === 'link') return; // Skip display-only fields

                const val = formValues[field.id];
                const file = files[field.id];
                let displayVal = val;

                if (field.type === 'file') {
                    displayVal = file ? `File: ${file.name} (${(file.size / 1024).toFixed(1)} KB)` : 'No file';
                } else if (Array.isArray(val)) {
                    displayVal = val.join(', ');
                } else if (typeof val === 'boolean') {
                    displayVal = val ? 'Yes' : 'No';
                }

                descriptionHtml += `
                    <tr style="border-bottom: 1px solid #eee;">
                        <td style="padding: 8px; font-weight: bold; color: #555; width: 40%;">${field.label}</td>
                        <td style="padding: 8px; color: #000;">${displayVal || '-'}</td>
                    </tr>
                `;
            });
            descriptionHtml += `</table></div>`;

            // 2. Insert Ticket
            const ticketPayload = {
                subject: `${ticketType}: ${selectedCategoryName}`, // Subject is Category Name or maybe a field?
                description: descriptionHtml,
                status_id: openStatusId,
                ticket_number: `SR-${Math.floor(Math.random() * 100000)}`, // Simple random number for now
                priority: 'Medium', // Default
                requester_id: userProfile?.id,
                created_by: userProfile?.id,
                ticket_type: ticketType === 'Service Request' ? 'service_request' : 'change_request',
                category_id: selectedCategoryId,
                is_category_verified: true,
            };

            const { data: ticketData, error: ticketError } = await supabase
                .from('tickets')
                .insert(ticketPayload)
                .select()
                .single();

            if (ticketError) throw ticketError;

            // 3. Upload Files if any
            const filePromises = Object.entries(files).map(async ([fieldId, file]) => {
                if (!file) return;
                const filePath = `tickets/${ticketData.id}/${Math.floor(Date.now() / 1000)}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;

                const { error: uploadError } = await supabase.storage
                    .from('ticket-attachments')
                    .upload(filePath, file);

                if (uploadError) {
                    console.error('File Upload Error:', uploadError);
                } else {
                    // Link to ticket
                    await supabase
                        .from('ticket_attachments')
                        .insert({
                            ticket_id: ticketData.id,
                            file_name: file.name,
                            file_path: filePath,
                            mime_type: file.type,
                            uploaded_by: userProfile?.id
                        });
                }
            });

            await Promise.all(filePromises);

            // Success
            Swal.fire({
                icon: 'success',
                title: 'Request Submitted',
                text: 'Your request has been successfully created.',
                timer: 2000,
                showConfirmButton: false
            });

            if (onSubmitSuccess) onSubmitSuccess();

        } catch (error: any) {
            console.error('Submission Error:', error);
            Swal.fire({
                icon: 'error',
                title: 'Submission Failed',
                text: error.message || 'Could not submit request'
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Render Field Helper
    const renderField = (field: CustomField) => {
        const commonClasses = "w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:font-normal text-sm";

        switch (field.type) {
            case 'label':
                return <div className="py-2 text-sm font-bold text-gray-700 border-b border-gray-100 uppercase tracking-wider mt-6 mb-2">{field.label}</div>;

            case 'link':
                return (
                    <div className="py-2 flex items-center gap-2 mb-4">
                        <a href={field.defaultValue || '#'} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-indigo-600 hover:underline flex items-center gap-2">
                            {field.label}
                        </a>
                        {field.description && <span className="text-xs text-gray-400">- {field.description}</span>}
                    </div>
                );

            case 'text':
                return <input type="text" className={commonClasses} placeholder={field.placeholder} value={formValues[field.id] || ''} onChange={e => handleInputChange(field.id, e.target.value)} />;

            case 'textarea':
                return <textarea className={commonClasses} rows={3} placeholder={field.placeholder} value={formValues[field.id] || ''} onChange={e => handleInputChange(field.id, e.target.value)} />;

            case 'number':
                return <input type="number" className={commonClasses} placeholder={field.placeholder} value={formValues[field.id] || ''} onChange={e => handleInputChange(field.id, e.target.value)} />;

            case 'date':
                return <input type="date" className={commonClasses} value={formValues[field.id] || ''} onChange={e => handleInputChange(field.id, e.target.value)} />;

            case 'dropdown':
                return (
                    <select className={commonClasses} value={formValues[field.id] || ''} onChange={e => handleInputChange(field.id, e.target.value)}>
                        <option value="">Select option...</option>
                        {field.options?.map((opt, i) => <option key={i} value={opt}>{opt}</option>)}
                    </select>
                );

            case 'checkbox':
                return (
                    <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors bg-white">
                        <input type="checkbox" className="w-5 h-5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500" checked={formValues[field.id] || false} onChange={e => handleInputChange(field.id, e.target.checked)} />
                        <span className="text-sm font-medium text-gray-700">{field.placeholder || field.label}</span>
                    </label>
                );

            case 'multiselect':
                // Simple multiselect implementation
                const currentVals = formValues[field.id] || [];
                return (
                    <div className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl max-h-[150px] overflow-y-auto">
                        {field.options?.map((opt, i) => (
                            <label key={i} className="flex items-center gap-2 py-1.5 cursor-pointer hover:bg-gray-50">
                                <input
                                    type="checkbox"
                                    className="rounded text-indigo-600 focus:ring-indigo-500"
                                    checked={currentVals.includes(opt)}
                                    onChange={(e) => {
                                        if (e.target.checked) handleInputChange(field.id, [...currentVals, opt]);
                                        else handleInputChange(field.id, currentVals.filter((v: string) => v !== opt));
                                    }}
                                />
                                <span className="text-sm text-gray-700">{opt}</span>
                            </label>
                        ))}
                    </div>
                );

            case 'file':
                return (
                    <div className="w-full px-4 py-8 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center text-gray-400 hover:bg-gray-50 hover:border-indigo-200 transition-all cursor-pointer relative">
                        <input
                            type="file"
                            className="absolute inset-0 opacity-0 cursor-pointer"
                            onChange={(e) => {
                                if (e.target.files && e.target.files[0]) handleFileChange(field.id, e.target.files[0]);
                            }}
                        />
                        <Paperclip size={24} className={files[field.id] ? "text-indigo-500" : "text-gray-300"} />
                        <span className="text-sm font-bold mt-2 text-gray-600">
                            {files[field.id] ? files[field.id].name : "Click to upload file"}
                        </span>
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 bg-gray-50/50 min-h-screen">
            {/* Header */}
            <div className="flex items-center justify-between">
                <button onClick={onBack} className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-gray-900 transition-colors">
                    <ArrowLeft size={16} /> Back
                </button>
                <div className="flex items-center gap-2 px-3 py-1 bg-white border border-gray-200 rounded-full shadow-sm">
                    <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                    <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">{ticketType}</span>
                </div>
            </div>

            <div className="bg-white rounded-3xl shadow-xl shadow-indigo-100/50 overflow-hidden border border-white">
                {step === 1 ? (
                    // STEP 1: CATEGORY SELECTION
                    <div className="p-8">
                        <div className="text-center mb-8">
                            <h2 className="text-2xl font-black text-gray-900 mb-2">What do you need help with?</h2>
                            <p className="text-gray-500">Select a category to proceed with your request.</p>
                        </div>

                        {/* Search */}
                        <div className="relative max-w-lg mx-auto mb-8">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                            <input
                                type="text"
                                className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 text-gray-900 font-medium placeholder:text-gray-400 transition-all shadow-inner"
                                placeholder="Search services..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                        </div>

                        {/* List */}
                        <div className="custom-scrollbar max-h-[500px] overflow-y-auto">
                            {isLoadingCategories ? (
                                <div className="flex justify-center p-12">
                                    <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                                </div>
                            ) : (
                                renderCategoryTree(categories)
                            )}
                        </div>
                    </div>
                ) : (
                    // STEP 2: FILL FORM
                    <div className="flex flex-col h-full">
                        <div className="px-8 py-6 border-b border-gray-100 bg-gray-50/50 flex items-center gap-4">
                            <div className="p-3 bg-white rounded-xl shadow-sm text-indigo-600">
                                <FileText size={24} />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-gray-900">{selectedCategoryName}</h2>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">New {ticketType}</p>
                            </div>
                        </div>

                        <div className="p-8 space-y-6">
                            {isLoadingFields ? (
                                <div className="space-y-4">
                                    {[1, 2, 3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse"></div>)}
                                </div>
                            ) : fields.length === 0 ? (
                                <div className="text-center py-12 text-gray-400">
                                    <AlertCircle size={32} className="mx-auto mb-2 text-gray-300" />
                                    <p>No specific form fields configured for this category.</p>
                                    <p className="text-sm mt-2">You can proceed with a generic description.</p>
                                    {/* Maybe adding a generic description field here would be good if no fields exist? */}
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {fields.map(field => {
                                        if (field.type === 'label' || field.type === 'link') return <div key={field.id}>{renderField(field)}</div>;

                                        return (
                                            <div key={field.id} className="space-y-2 animate-in slide-in-from-bottom-2">
                                                <label className="text-sm font-bold text-gray-700 flex items-center gap-1">
                                                    {field.label}
                                                    {field.required && <span className="text-red-500">*</span>}
                                                </label>
                                                {renderField(field)}
                                                {field.description && <p className="text-xs text-gray-400">{field.description}</p>}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="px-8 py-6 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between">
                            <button
                                onClick={() => setStep(1)}
                                className="px-6 py-2.5 text-gray-500 font-bold hover:bg-gray-200 rounded-xl transition-colors"
                            >
                                Change Category
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={isSubmitting}
                                className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-indigo-200 transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {isSubmitting ? 'Submitting...' : 'Submit Request'}
                                <Send size={18} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default RequesterCreateServiceRequest;

