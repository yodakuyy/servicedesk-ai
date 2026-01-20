import React, { useState, useEffect } from 'react';
import { ArrowLeft, HelpCircle, Paperclip, Sparkles, Send, ChevronRight, X, Info } from 'lucide-react';

interface RequesterCreateIncidentProps {
    onBack?: () => void;
    onSubmit?: (data: any) => void;
    userProfile?: any;
}

const RequesterCreateIncident: React.FC<RequesterCreateIncidentProps> = ({ onBack, onSubmit, userProfile }) => {
    // Section 1: Who is affected?
    const [affectedUser, setAffectedUser] = useState<'myself' | 'someone_else'>('myself');
    const [someoneElseDetails, setSomeoneElseDetails] = useState({
        fullName: '',
        email: '',
        department: ''
    });

    // User's department (fetched from company table)
    const [myDepartment, setMyDepartment] = useState('');

    // Section 2: What's the problem?
    const [subject, setSubject] = useState('');
    const [description, setDescription] = useState('');
    const [showAINotice, setShowAINotice] = useState(false);

    // Section 3: Optional Details
    const [isOptionalDetailsExpanded, setIsOptionalDetailsExpanded] = useState(false);
    const [service, setService] = useState('');
    const [attachment, setAttachment] = useState<File | null>(null);

    // Submission State
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    // Fetch department name from company table
    useEffect(() => {
        const fetchDepartment = async () => {
            if (userProfile?.company_id) {
                try {
                    const { supabase } = await import('../lib/supabase');
                    const { data } = await supabase
                        .from('company')
                        .select('company_name')
                        .eq('company_id', userProfile.company_id)
                        .single();

                    if (data) {
                        setMyDepartment(data.company_name);
                    }
                } catch (error) {
                    console.error('Error fetching department:', error);
                }
            }
        };

        fetchDepartment();
    }, [userProfile?.company_id]);

    // Handlers
    const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        setDescription(val);

        // Simple trigger for AI Notice mock
        if (val.toLowerCase().includes('login') || val.toLowerCase().includes('password')) {
            setShowAINotice(true);
        } else {
            setShowAINotice(false);
        }
    };

    const handleSomeoneElseChange = (field: string, value: string) => {
        setSomeoneElseDetails(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        // Mock API call
        await new Promise(resolve => setTimeout(resolve, 1500));

        setIsSuccess(true);

        // Wait for success animation
        setTimeout(() => {
            if (onSubmit) {
                onSubmit({
                    affectedUser,
                    affectedUserDetails: affectedUser === 'myself' ? { ...userProfile, department: myDepartment } : someoneElseDetails,
                    subject,
                    description,
                    service,
                    attachment
                });
            }
        }, 1500);
    };

    // Validation
    const isSubjectValid = subject.trim().length > 0;
    const isDescriptionValid = description.trim().length > 0;
    const isSomeoneElseValid = affectedUser === 'myself' ||
        (someoneElseDetails.fullName.trim().length > 0 && someoneElseDetails.email.trim().length > 0);

    const isSubmitDisabled = !isSubjectValid || !isDescriptionValid || !isSomeoneElseValid || isSubmitting;

    if (isSuccess) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] animate-in zoom-in-95 duration-500">
                <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6">
                    <Send className="w-12 h-12 text-green-600 ml-1" />
                </div>
                <h2 className="text-3xl font-bold text-gray-900 mb-2">Incident Submitted!</h2>
                <p className="text-gray-500 text-lg max-w-md text-center">
                    We have received your report. Redirecting you to the ticket details...
                </p>
            </div>
        );
    }

    const myselfClassName = affectedUser === 'myself'
        ? 'bg-indigo-50 border-indigo-200 ring-1 ring-indigo-500/20'
        : 'bg-white border-gray-200 hover:bg-gray-50';

    const someoneElseClassName = affectedUser === 'someone_else'
        ? 'bg-indigo-50 border-indigo-200 ring-1 ring-indigo-500/20'
        : 'bg-white border-gray-200 hover:bg-gray-50';

    const optionalChevronClassName = isOptionalDetailsExpanded ? 'rotate-90' : '';

    return (
        <div className="max-w-3xl mx-auto p-8 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Top Navigation */}
            <div className="flex justify-between items-center text-sm font-medium text-gray-500">
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 hover:text-gray-800 transition-colors"
                >
                    <ArrowLeft size={16} />
                    Back to My Tickets
                </button>
                <button className="flex items-center gap-2 hover:text-indigo-600 transition-colors">
                    <HelpCircle size={16} />
                    Help Center
                </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-10">

                {/* 1. Who is affected? */}
                <section className="space-y-4">
                    <h2 className="text-xl font-bold text-gray-900">Who is affected by this issue?</h2>
                    <div className="flex flex-col sm:flex-row gap-4">
                        <label className={`flex-1 flex items-center gap-3 p-4 border rounded-xl cursor-pointer transition-all ${myselfClassName}`}>
                            <input
                                type="radio"
                                name="affectedUser"
                                value="myself"
                                checked={affectedUser === 'myself'}
                                onChange={() => setAffectedUser('myself')}
                                className="w-5 h-5 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                            />
                            <span className="font-semibold text-gray-900">Myself</span>
                        </label>
                        <label className={`flex-1 flex items-center gap-3 p-4 border rounded-xl cursor-pointer transition-all ${someoneElseClassName}`}>
                            <input
                                type="radio"
                                name="affectedUser"
                                value="someone_else"
                                checked={affectedUser === 'someone_else'}
                                onChange={() => setAffectedUser('someone_else')}
                                className="w-5 h-5 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                            />
                            <span className="font-semibold text-gray-900">Someone else</span>
                        </label>
                    </div>

                    {/* Show User Details if Myself */}
                    {affectedUser === 'myself' && (
                        <div className="p-6 bg-gray-50 border border-gray-100 rounded-xl space-y-4 animate-in fade-in slide-in-from-top-2">
                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-sm font-semibold text-gray-700">Full Name <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed focus:outline-none"
                                        value={userProfile?.full_name || ''}
                                        readOnly
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-semibold text-gray-700">Email Address <span className="text-red-500">*</span></label>
                                    <input
                                        type="email"
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed focus:outline-none"
                                        value={userProfile?.email || ''}
                                        readOnly
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-gray-700">Department</label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed focus:outline-none"
                                    value={myDepartment || ''}
                                    placeholder="Loading..."
                                    readOnly
                                />
                            </div>
                        </div>
                    )}

                    {/* Expand inline if someone else */}
                    {affectedUser === 'someone_else' && (
                        <div className="p-6 bg-gray-50 border border-gray-100 rounded-xl space-y-4 animate-in fade-in slide-in-from-top-2">
                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-sm font-semibold text-gray-700">Full Name <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                                        placeholder="e.g. John Doe"
                                        value={someoneElseDetails.fullName}
                                        onChange={(e) => handleSomeoneElseChange('fullName', e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-semibold text-gray-700">Email Address <span className="text-red-500">*</span></label>
                                    <input
                                        type="email"
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                                        placeholder="john.doe@company.com"
                                        value={someoneElseDetails.email}
                                        onChange={(e) => handleSomeoneElseChange('email', e.target.value)}
                                    />
                                    {someoneElseDetails.email.includes('@') && (
                                        <p className="text-xs text-green-600 flex items-center gap-1 animate-in fade-in">
                                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span> Valid email format
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-gray-700">Department <span className="text-gray-400 font-normal">(Optional)</span></label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                                    placeholder="e.g. Finance"
                                    value={someoneElseDetails.department}
                                    onChange={(e) => handleSomeoneElseChange('department', e.target.value)}
                                />
                            </div>
                        </div>
                    )}
                </section>

                {/* 2. What's the problem? */}
                <section className="space-y-6">
                    <div className="space-y-3">
                        <label htmlFor="subject" className="block text-xl font-bold text-gray-900">
                            What's going wrong? <span className="text-red-500">*</span>
                        </label>
                        <input
                            id="subject"
                            type="text"
                            placeholder="e.g. Cannot login to Finance System"
                            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium placeholder:text-gray-300 shadow-sm text-lg"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                        />
                        <p className="text-sm text-gray-400 font-medium">Short summary of the issue</p>
                    </div>

                    <div className="space-y-3 relative">
                        <label htmlFor="description" className="block text-xl font-bold text-gray-900">
                            Tell us more <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            id="description"
                            rows={6}
                            placeholder={"Describe what happened...\n• What were you trying to do?\n• What went wrong?\n• When did this start?"}
                            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium placeholder:text-gray-300 shadow-sm resize-none"
                            value={description}
                            onChange={handleDescriptionChange}
                        />

                        {/* Inline AI Notice */}
                        {showAINotice && (
                            <div className="mt-4 bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                                <div className="p-2 bg-white rounded-lg text-indigo-600 shadow-sm shrink-0">
                                    <Sparkles size={18} />
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-semibold text-gray-900 mb-1">
                                        This looks like a login-related issue.
                                    </p>
                                    <p className="text-sm text-gray-600">
                                        You don't need to choose a category — we'll handle it automatically.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowAINotice(false)}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        )}
                    </div>
                </section>

                {/* 3. Optional Details */}
                <section className="bg-white rounded-xl">
                    <button
                        type="button"
                        onClick={() => setIsOptionalDetailsExpanded(!isOptionalDetailsExpanded)}
                        className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-indigo-600 transition-colors py-2"
                    >
                        <ChevronRight size={16} className={`transition-transform duration-200 ${optionalChevronClassName}`} />
                        Add optional details
                    </button>

                    {isOptionalDetailsExpanded && (
                        <div className="pt-4 pb-2 space-y-6 animate-in slide-in-from-top-2 fade-in pl-6 border-l-2 border-gray-100 ml-1.5">
                            <div className="space-y-3">
                                <label className="block text-sm font-bold text-gray-900">
                                    Issue Type <span className="text-gray-400 font-normal ml-1">(Optional)</span>
                                </label>
                                <div className="space-y-2">
                                    <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-all">
                                        <input
                                            type="radio"
                                            name="issueType"
                                            value="software"
                                            checked={service === 'software'}
                                            onChange={(e) => setService(e.target.value)}
                                            className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                                        />
                                        <div>
                                            <span className="font-medium text-gray-900">Software / Application Issue</span>
                                            <p className="text-xs text-gray-500">Problems with apps, systems, or software errors</p>
                                        </div>
                                    </label>
                                    <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-all">
                                        <input
                                            type="radio"
                                            name="issueType"
                                            value="hardware"
                                            checked={service === 'hardware'}
                                            onChange={(e) => setService(e.target.value)}
                                            className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                                        />
                                        <div>
                                            <span className="font-medium text-gray-900">Hardware / Device Problem</span>
                                            <p className="text-xs text-gray-500">Laptop, monitor, keyboard, printer issues</p>
                                        </div>
                                    </label>
                                    <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-all">
                                        <input
                                            type="radio"
                                            name="issueType"
                                            value="network"
                                            checked={service === 'network'}
                                            onChange={(e) => setService(e.target.value)}
                                            className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                                        />
                                        <div>
                                            <span className="font-medium text-gray-900">Network / Connectivity</span>
                                            <p className="text-xs text-gray-500">WiFi, VPN, internet connection problems</p>
                                        </div>
                                    </label>
                                    <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-all">
                                        <input
                                            type="radio"
                                            name="issueType"
                                            value="other"
                                            checked={service === 'other'}
                                            onChange={(e) => setService(e.target.value)}
                                            className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                                        />
                                        <div>
                                            <span className="font-medium text-gray-900">Other</span>
                                            <p className="text-xs text-gray-500">Not sure or doesn't fit above categories</p>
                                        </div>
                                    </label>
                                </div>
                                <p className="text-xs text-gray-400 flex items-center gap-1">
                                    <Info size={12} />
                                    Helps us understand your issue better
                                </p>
                            </div>

                            <div className="space-y-3">
                                <label className="block text-sm font-bold text-gray-900">
                                    Attachment
                                </label>
                                <label className="flex items-center gap-2 w-fit px-4 py-2.5 text-sm font-semibold text-gray-600 bg-gray-50 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-100 hover:text-gray-900 transition-all group">
                                    <div className="p-1.5 bg-white rounded border border-gray-200 text-gray-400 group-hover:text-indigo-500 transition-colors">
                                        <Paperclip size={14} />
                                    </div>
                                    Add screenshot or file
                                    <input type="file" className="hidden" onChange={(e) => setAttachment(e.target.files ? e.target.files[0] : null)} />
                                </label>
                                {attachment && (
                                    <div className="text-sm text-indigo-600 font-medium flex items-center gap-2 bg-indigo-50 w-fit px-3 py-1.5 rounded-lg border border-indigo-100">
                                        <span className="w-2 h-2 rounded-full bg-indigo-500 block"></span>
                                        {attachment.name}
                                        <button
                                            type="button"
                                            onClick={() => setAttachment(null)}
                                            className="ml-2 text-indigo-400 hover:text-indigo-700"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </section>

                {/* 4. Smart System Notice */}
                <section className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100/50 rounded-2xl p-6">
                    <h3 className="flex items-center gap-2 font-bold text-indigo-900 mb-4">
                        <Sparkles size={18} className="text-indigo-600" />
                        What happens next?
                    </h3>
                    <ul className="space-y-3">
                        <li className="flex items-start gap-3 text-sm text-indigo-800/80 font-medium">
                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
                            We'll automatically route this to the right team
                        </li>
                        <li className="flex items-start gap-3 text-sm text-indigo-800/80 font-medium">
                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
                            Priority & response time are handled by the system
                        </li>
                        <li className="flex items-start gap-3 text-sm text-indigo-800/80 font-medium">
                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
                            You'll get updates by email
                        </li>
                    </ul>
                </section>

                {/* 5. Submit Action */}
                <div className="pt-2">
                    <button
                        type="submit"
                        disabled={isSubmitDisabled}
                        className="w-full md:w-auto px-8 py-4 bg-indigo-600 text-white rounded-xl font-bold text-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-indigo-500/30 transition-all flex items-center justify-center gap-2 group"
                    >
                        {isSubmitting ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Submitting...
                            </>
                        ) : (
                            <>
                                Submit Incident
                                <ArrowLeft size={20} className="rotate-180 group-hover:translate-x-1 transition-transform" />
                            </>
                        )}
                    </button>
                </div>

            </form>
        </div>
    );
};

export default RequesterCreateIncident;
