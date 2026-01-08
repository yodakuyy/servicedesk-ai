
import React, { useState, useRef, useEffect } from 'react';
import {
   ChevronLeft,
   ChevronDown,
   MoreHorizontal,
   Paperclip,
   Send,
   Smile,
   User,
   Clock,
   Star,
   ExternalLink,
   Edit2,
   Trash2,
   Info,
   List,
   CheckCircle,
   Plus,
   FileText,
   Image,
   Download,
   Eye,
   ArrowUpCircle,
   ArrowLeft,
   MessageSquare,
   X,
   Sparkles,
   Brain,
   Lightbulb,
   Copy,
   Loader2
} from 'lucide-react';
import EscalateModal from './EscalateModal';
import StatusBadge from './StatusBadge';

interface TicketDetailProps {
   ticketId: string | null;
   onBack: () => void;
}

interface ActivityLog {
   id: number;
   type: 'status_change' | 'created' | 'assigned';
   title: string;
   user: string;
   timestamp: string;
}

interface Attachment {
   id: number;
   name: string;
   size: string;
   type: 'image' | 'file';
}

const mockActivities: ActivityLog[] = [
   { id: 1, type: 'status_change', title: 'Status changed from New to Open', user: 'System', timestamp: '28 Feb 2025 - 10:40 PM' },
   { id: 2, type: 'created', title: 'Ticket Created', user: 'John Doe', timestamp: '28 Feb 2025 - 10:39 PM' },
   { id: 3, type: 'assigned', title: 'Assigned to Mike Ross', user: 'System Automated Rule', timestamp: '28 Feb 2025 - 10:45 PM' },
   { id: 4, type: 'assigned', title: 'Ticket reassigned from Andi → Citra', user: 'System (Agent Out of Office)', timestamp: '10 Feb 2026 - 09:01 AM' },
];

const mockAttachments: Attachment[] = [
   { id: 1, name: 'screenshot_error_sap.png', size: '2.4 MB', type: 'image' },
   { id: 2, name: 'system_logs.txt', size: '15 KB', type: 'file' },
];

const TicketDetail: React.FC<TicketDetailProps> = ({ ticketId, onBack }) => {
   const [messageInput, setMessageInput] = useState('');
   const [pastedImage, setPastedImage] = useState<string | null>(null);
   const [activeTab, setActiveTab] = useState<'conversation' | 'detail' | 'activities' | 'attachments'>('detail');
   const [showActionMenu, setShowActionMenu] = useState(false);
   const [showEscalateModal, setShowEscalateModal] = useState(false);
   const [isContactDetailsOpen, setIsContactDetailsOpen] = useState(true);
   const [isAnalyzing, setIsAnalyzing] = useState(false);
   const [showAIResults, setShowAIResults] = useState(false);
   const [showPendingModal, setShowPendingModal] = useState(false);
   const [pendingRemark, setPendingRemark] = useState('');
   const [showResolvedModal, setShowResolvedModal] = useState(false);
   const [resolutionDetails, setResolutionDetails] = useState('');

   const actionMenuRef = useRef<HTMLDivElement>(null);
   const fileInputRef = useRef<HTMLInputElement>(null);
   const textareaRef = useRef<HTMLTextAreaElement>(null);

   // Auto-resize textarea
   useEffect(() => {
      if (textareaRef.current) {
         textareaRef.current.style.height = 'auto';
         textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 256)}px`;
      }
   }, [messageInput]);

   const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
         console.log('File selected:', file.name);
         // Here you would typically handle the file upload process
      }
   };

   const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const items = event.clipboardData.items;
      for (const item of items) {
         if (item.type.indexOf('image') !== -1) {
            const blob = item.getAsFile();
            if (blob) {
               const reader = new FileReader();
               reader.onload = (e) => {
                  setPastedImage(e.target?.result as string);
               };
               reader.readAsDataURL(blob);
            }
         }
      }
   };

   const handleRemoveImage = () => {
      setPastedImage(null);
   };

   const handleAnalyze = () => {
      setIsAnalyzing(true);
      setTimeout(() => {
         setIsAnalyzing(false);
         setShowAIResults(true);
      }, 2000);
   };

   // Close action menu when clicking outside
   useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
         if (actionMenuRef.current && !actionMenuRef.current.contains(event.target as Node)) {
            setShowActionMenu(false);
         }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
         document.removeEventListener('mousedown', handleClickOutside);
      };
   }, []);

   const renderActivities = () => (
      <div className="flex-1 overflow-y-auto p-6 bg-white">
         <div className="flex items-center gap-2 mb-6">
            <div className="p-1.5 bg-gray-100 rounded-md">
               <List size={18} className="text-gray-600" />
            </div>
            <h3 className="font-bold text-gray-800">Activity Log</h3>
         </div>

         <div className="relative pl-4 space-y-8">
            {/* Vertical Line */}
            <div className="absolute top-2 bottom-2 left-[23px] w-0.5 bg-gray-100"></div>

            {mockActivities.map((activity, index) => (
               <div key={activity.id} className="relative flex gap-4 items-start group">
                  {/* Icon Node */}
                  <div className={`z-10 w-10 h-10 rounded-full border-4 border-white shadow-sm flex items-center justify-center flex-shrink-0 ${activity.type === 'status_change' ? 'bg-green-50 text-green-600' :
                     activity.type === 'created' ? 'bg-blue-50 text-blue-600' :
                        'bg-purple-50 text-purple-600'
                     }`}>
                     {activity.type === 'status_change' && <CheckCircle size={16} />}
                     {activity.type === 'created' && <Plus size={16} />}
                     {activity.type === 'assigned' && <Edit2 size={16} />}
                  </div>

                  <div className="flex-1 pt-1">
                     <p className="font-bold text-gray-800 text-sm">{activity.title}</p>
                     <p className="text-xs text-gray-500 mt-0.5">by <span className="font-medium text-gray-700">{activity.user}</span></p>
                     <div className="flex items-center gap-1.5 mt-2 text-[10px] text-gray-400 font-medium">
                        <Clock size={10} /> {activity.timestamp}
                     </div>
                  </div>
               </div>
            ))}
         </div>
      </div>
   );

   const renderAttachments = () => (
      <div className="flex-1 overflow-y-auto p-6 bg-white">
         <div className="flex items-center gap-2 mb-6">
            <Paperclip size={18} className="text-gray-800 font-bold" strokeWidth={2.5} />
            <h3 className="font-bold text-gray-800">Attachments ({mockAttachments.length})</h3>
         </div>

         <div className="space-y-4">
            {mockAttachments.map((file) => (
               <div key={file.id} className="border border-gray-100 rounded-xl p-4 flex items-center justify-between hover:shadow-sm transition-shadow">
                  <div className="flex items-center gap-4">
                     <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${file.type === 'image' ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500'
                        }`}>
                        {file.type === 'image' ? <Image size={24} /> : <FileText size={24} />}
                     </div>
                     <div>
                        <p className="font-bold text-gray-800 text-sm mb-0.5">{file.name}</p>
                        <p className="text-xs text-gray-400">{file.size}</p>
                     </div>
                  </div>

                  <div className="flex items-center gap-2">
                     <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors" title="View">
                        <Eye size={18} />
                     </button>
                     <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors" title="Download">
                        <Download size={18} />
                     </button>
                  </div>
               </div>
            ))}

            {/* Upload Placeholder */}
            <button className="w-full h-24 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center text-gray-400 hover:border-indigo-300 hover:text-indigo-500 hover:bg-indigo-50/10 transition-all gap-2 group">
               <Plus size={24} className="group-hover:scale-110 transition-transform" />
               <span className="text-sm font-medium">Upload new file</span>
            </button>
         </div>
      </div>
   );

   return (
      <div className="flex h-full bg-[#f3f4f6] p-6 gap-6 overflow-hidden relative">
         {/* Escalate Modal */}
         {showEscalateModal && <EscalateModal onClose={() => setShowEscalateModal(false)} />}

         {/* Pending Remark Modal */}
         {showPendingModal && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
               <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
                  <h3 className="text-lg font-bold text-gray-900 text-center mb-6">
                     Please enter a remark/message about the pending status
                  </h3>

                  <textarea
                     value={pendingRemark}
                     onChange={(e) => setPendingRemark(e.target.value)}
                     placeholder="Put remark here"
                     className="w-full h-32 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-sm text-gray-700 placeholder:text-gray-400 mb-6 resize-none"
                  />

                  <div className="flex justify-center gap-4">
                     <button
                        onClick={() => {
                           console.log('Pending remark:', pendingRemark);
                           setShowPendingModal(false);
                           setPendingRemark('');
                        }}
                        className="px-8 py-2.5 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                     >
                        Submit
                     </button>
                     <button
                        onClick={() => {
                           setShowPendingModal(false);
                           setPendingRemark('');
                        }}
                        className="px-8 py-2.5 bg-gray-600 text-white font-bold rounded-lg hover:bg-gray-700 transition-colors shadow-sm"
                     >
                        Cancel
                     </button>
                  </div>
               </div>
            </div>
         )}

         {/* Resolved Modal */}
         {showResolvedModal && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
               <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
                  <h3 className="text-lg font-bold text-gray-900 text-center mb-6">
                     Resolution Details
                  </h3>

                  <textarea
                     value={resolutionDetails}
                     onChange={(e) => setResolutionDetails(e.target.value)}
                     placeholder="Enter resolution details here"
                     className="w-full h-32 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-sm text-gray-700 placeholder:text-gray-400 mb-6 resize-none"
                  />

                  <div className="flex justify-center gap-4">
                     <button
                        onClick={() => {
                           console.log('Resolution details:', resolutionDetails);
                           setShowResolvedModal(false);
                           setResolutionDetails('');
                        }}
                        className="px-8 py-2.5 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm whitespace-nowrap"
                     >
                        Confirm Resolution
                     </button>
                     <button
                        onClick={() => {
                           setShowResolvedModal(false);
                           setResolutionDetails('');
                        }}
                        className="px-8 py-2.5 bg-gray-600 text-white font-bold rounded-lg hover:bg-gray-700 transition-colors shadow-sm"
                     >
                        Cancel
                     </button>
                  </div>
               </div>
            </div>
         )}

         {/* Left Column - Chat Area */}
         <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

            {/* Back Button Header */}
            <div className="px-6 py-2 border-b border-gray-50 flex items-center bg-white">
               <button
                  onClick={onBack}
                  className="flex items-center gap-2 text-gray-500 hover:text-indigo-600 text-xs font-bold transition-colors py-1"
               >
                  <ArrowLeft size={16} /> Back to List
               </button>
            </div>

            {/* Tab Navigation */}
            <div className="px-6 py-3 border-b border-gray-50 flex items-center gap-1 bg-white sticky top-0 z-20">
               <button
                  onClick={() => setActiveTab('detail')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors ${activeTab === 'detail' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}
               >
                  <Info size={16} /> Detail
               </button>
               <button
                  onClick={() => setActiveTab('conversation')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors ${activeTab === 'conversation' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}
               >
                  <MessageSquare size={16} /> Conversation
               </button>
               <button
                  onClick={() => setActiveTab('activities')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors ${activeTab === 'activities' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}
               >
                  <List size={16} /> Activities
               </button>
               <button
                  onClick={() => setActiveTab('attachments')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors ${activeTab === 'attachments' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}
               >
                  <Paperclip size={16} /> Attachments
               </button>
            </div>

            {/* Ticket Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-white z-10">
               <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center border border-gray-100">
                     <span className="text-xs font-bold text-gray-500">#</span>
                  </div>
                  <div>
                     <div className="flex items-center gap-2">
                        <h2 className="text-base font-bold text-gray-800">{ticketId || 'Case-1'}</h2>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700 uppercase tracking-wide">OPEN</span>
                     </div>
                  </div>
               </div>

               <div className="flex items-center gap-2">
                  <div className="relative" ref={actionMenuRef}>
                     <button
                        onClick={() => setShowActionMenu(!showActionMenu)}
                        className="px-4 py-2 bg-white border border-gray-200 text-gray-600 text-xs font-bold rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1"
                     >
                        Action <ChevronDown size={14} />
                     </button>
                     {showActionMenu && (
                        <div className="absolute right-0 top-full mt-2 w-32 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                           <button
                              onClick={() => {
                                 setShowPendingModal(true);
                                 setShowActionMenu(false);
                              }}
                              className="w-full px-4 py-2 text-left text-xs font-medium text-gray-700 hover:bg-gray-50"
                           >
                              Pending
                           </button>
                           <button
                              onClick={() => {
                                 setShowResolvedModal(true);
                                 setShowActionMenu(false);
                              }}
                              className="w-full px-4 py-2 text-left text-xs font-medium text-gray-700 hover:bg-gray-50">
                              Resolved
                           </button>
                        </div>
                     )}
                  </div>

                  <button
                     onClick={() => setShowEscalateModal(true)}
                     className="px-4 py-2 bg-cyan-50 border border-cyan-100 text-cyan-600 text-xs font-bold rounded-lg hover:bg-cyan-100 transition-colors flex items-center gap-1"
                  >
                     <ArrowUpCircle size={14} /> Escalate
                  </button>

                  <button
                     className="px-4 py-2 bg-red-50 border border-red-100 text-red-500 text-xs font-bold rounded-lg hover:bg-red-100 transition-colors"
                  >
                     Cancel Ticket
                  </button>
               </div>
            </div>

            {/* Content Area */}
            {activeTab === 'conversation' && (
               <>
                  <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50/30 custom-scrollbar">
                     {/* System Message */}
                     <div className="flex gap-4">
                        <div className="w-10 h-10 rounded-full bg-indigo-900 flex-shrink-0 flex items-center justify-center text-white font-bold text-xs">
                           HB
                        </div>
                        <div className="flex-1">
                           <div className="flex items-baseline gap-2 mb-1">
                              <span className="text-sm font-bold text-gray-800">Hippo Bot</span>
                           </div>
                           <div className="bg-indigo-900 text-white p-4 rounded-2xl rounded-tl-none shadow-sm text-sm leading-relaxed max-w-2xl">
                              Thank you for contacting us. We have opened case {ticketId || 'Case-1'} to address your request. Sincerely,
                           </div>
                           <div className="flex items-center gap-2 mt-2 text-[10px] text-gray-400">
                              <Clock size={12} /> Read • 28 Feb 2025 - 6:40 PM
                           </div>
                        </div>
                     </div>

                     {/* User Message */}
                     <div className="flex gap-4">
                        <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 border-2 border-white shadow-sm">
                           <img src="https://ui-avatars.com/api/?name=John+Doe&background=random" alt="User" />
                        </div>
                        <div className="flex-1">
                           <div className="flex items-baseline gap-2 mb-1">
                              <span className="text-sm font-bold text-gray-800">John Doe</span>
                           </div>
                           <div className="bg-white border border-gray-200 text-gray-700 p-4 rounded-2xl rounded-tl-none shadow-sm text-sm leading-relaxed max-w-3xl">
                              The user interface, while functional, was somewhat confusing in certain areas, making it challenging to navigate and use effectively. This lack of clarity could potentially hinder users from fully utilizing the platform's features. Additionally, the presence of several spelling and grammar mistakes throughout the system further impacts the overall user experience, as it may reduce the perceived professionalism and reliability...
                              <div className="mt-2 text-indigo-600 font-semibold cursor-pointer text-xs">Read More</div>
                           </div>
                           <div className="flex items-center gap-2 mt-2 text-[10px] text-gray-400">
                              <Clock size={12} /> Read • 28 Feb 2025 - 12:40 PM
                           </div>
                        </div>
                     </div>

                     {/* Agent Message */}
                     <div className="flex gap-4">
                        <div className="w-10 h-10 rounded-full bg-indigo-800 flex-shrink-0 flex items-center justify-center text-white font-bold text-xs">
                           AG
                        </div>
                        <div className="flex-1">
                           <div className="flex items-baseline gap-2 mb-1">
                              <span className="text-sm font-bold text-gray-800">Agent</span>
                           </div>
                           <div className="bg-[#1e1b4b] text-gray-100 p-4 rounded-2xl rounded-tl-none shadow-md text-sm leading-relaxed max-w-2xl">
                              Thank you for your feedback. We're working to improve the interface for better clarity and usability while also addressing any language errors. Your insights are invaluable, and we appreciate your help in making the platform better.<br />
                              Best regards,
                           </div>
                           <div className="flex items-center gap-2 mt-2 text-[10px] text-gray-400">
                              <Clock size={12} /> Read • 28 Feb 2025 - 10:45 PM
                           </div>
                        </div>
                     </div>

                     {/* Agent Message 2 */}
                     <div className="flex gap-4">
                        <div className="w-10 h-10 rounded-full bg-indigo-800 flex-shrink-0 flex items-center justify-center text-white font-bold text-xs">
                           AG
                        </div>
                        <div className="flex-1">
                           <div className="flex items-baseline gap-2 mb-1">
                              <span className="text-sm font-bold text-gray-800">Agent</span>
                           </div>
                           <div className="bg-[#1e1b4b] text-gray-100 p-4 rounded-2xl rounded-tl-none shadow-md text-sm leading-relaxed max-w-2xl">
                              Hello again,<br /><br />
                              We've made some updates based on your feedback. Could you please check and let us know if everything looks good on your end? Your input helps us refine the experience further.<br />
                              Best regards,
                           </div>
                           <div className="flex items-center gap-2 mt-2 text-[10px] text-gray-400">
                              <Clock size={12} /> Read • 28 Feb 2025 - 10:45 PM
                           </div>
                        </div>
                     </div>
                  </div>

                  {/* Input Area */}
                  <div className="p-4 bg-white border-t border-gray-100">
                     {pastedImage && (
                        <div className="mb-2 relative inline-block">
                           <img src={pastedImage} alt="Pasted" className="h-20 rounded-lg border border-gray-200" />
                           <button
                              onClick={handleRemoveImage}
                              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600 transition-colors shadow-sm"
                           >
                              <X size={12} />
                           </button>
                        </div>
                     )}
                     <div className="flex items-end gap-2 bg-gray-50 border border-gray-100 rounded-xl p-2 focus-within:ring-2 focus-within:ring-indigo-100 focus-within:border-indigo-300 transition-all relative">
                        <div className="relative">
                           <button
                              onClick={() => fileInputRef.current?.click()}
                              className="p-2 text-gray-400 hover:text-gray-600 transition-colors rounded-lg"
                           >
                              <Paperclip size={18} />
                           </button>
                           <input
                              type="file"
                              ref={fileInputRef}
                              onChange={handleFileChange}
                              className="hidden"
                           />
                        </div>
                        <textarea
                           ref={textareaRef}
                           value={messageInput}
                           onChange={(e) => setMessageInput(e.target.value)}
                           onPaste={handlePaste}
                           placeholder="Start Typing..."
                           className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-2 max-h-64 resize-none placeholder:text-gray-400 overflow-y-auto"
                           rows={1}
                           style={{ minHeight: '40px' }}
                        />
                        <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                           <Smile size={18} />
                        </button>
                        <button className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm">
                           <Send size={18} />
                        </button>
                     </div>
                  </div>
               </>
            )}

            {activeTab === 'detail' && (
               <div className="flex-1 overflow-y-auto p-8 bg-white space-y-8">
                  {/* AI Analysis Card */}
                  <div className="bg-gradient-to-br from-indigo-50 to-white rounded-2xl p-6 border border-indigo-100 shadow-sm relative overflow-hidden group">
                     {/* Background Decoration */}
                     <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Sparkles size={120} className="text-indigo-600" />
                     </div>

                     <div className="relative z-10 space-y-6">
                        <div className="flex items-center gap-2 mb-4">
                           <div className="p-2 bg-indigo-600 rounded-lg text-white shadow-md shadow-indigo-200">
                              <Brain size={18} />
                           </div>
                           <h3 className="text-lg font-bold text-gray-800">AI Analysis & Insights</h3>
                        </div>

                        {!showAIResults && !isAnalyzing && (
                           <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
                              <p className="text-gray-500 text-sm max-w-md">
                                 Generate a comprehensive summary, recommended solutions, and draft response using AI.
                              </p>
                              <button
                                 onClick={handleAnalyze}
                                 className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-medium transition-all shadow-md shadow-indigo-200 hover:shadow-indigo-300 transform hover:-translate-y-0.5"
                              >
                                 <Sparkles size={16} />
                                 Generate Analysis
                              </button>
                           </div>
                        )}

                        {isAnalyzing && (
                           <div className="flex flex-col items-center justify-center py-10 space-y-4">
                              <Loader2 size={32} className="text-indigo-600 animate-spin" />
                              <p className="text-gray-500 text-sm font-medium animate-pulse">Analyzing ticket content...</p>
                           </div>
                        )}

                        {showAIResults && (
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                              <div className="space-y-4">
                                 <div>
                                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                       <FileText size={12} /> Ticket Summary
                                    </h4>
                                    <p className="text-sm text-gray-700 leading-relaxed bg-white/60 p-3 rounded-xl border border-indigo-50">
                                       User is reporting an issue with Order MORE 1.0 (PO-25031892-1) failing to synchronize with SAP. Immediate investigation into SAP integration logs is required.
                                    </p>
                                 </div>

                                 <div>
                                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                       <Lightbulb size={12} /> Recommended Solution
                                    </h4>
                                    <div className="bg-green-50/80 p-3 rounded-xl border border-green-100 text-sm text-gray-700 space-y-2">
                                       <p className="flex items-start gap-2">
                                          <span className="mt-1 w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0"></span>
                                          Check SAP Integration status for 'More 1.0'.
                                       </p>
                                       <p className="flex items-start gap-2">
                                          <span className="mt-1 w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0"></span>
                                          Resubmit PO-25031892-1 manually via middleware.
                                       </p>
                                    </div>
                                 </div>
                              </div>

                              <div className="space-y-4">
                                 <div>
                                    <div className="flex justify-between items-center mb-2">
                                       <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                                          <MessageSquare size={12} /> Draft Response
                                       </h4>
                                       <button className="text-[10px] flex items-center gap-1 text-indigo-600 font-bold hover:underline" title="Copy to clipboard">
                                          <Copy size={10} /> Copy
                                       </button>
                                    </div>
                                    <div className="bg-white p-3 rounded-xl border border-indigo-100 text-sm text-gray-600 italic relative">
                                       "Hi John, thank you for reporting. I've checked the SAP logs and it seems like a temporary sync timeout. I will manually push PO-25031892-1 to SAP now. Please allow 15 minutes for it to reflect."
                                    </div>
                                 </div>

                                 <div>
                                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                       <Clock size={12} /> Estimated Resolution
                                    </h4>
                                    <div className="flex items-center gap-2">
                                       <span className="text-xl font-bold text-gray-800">~2 Hours</span>
                                       <span className="text-xs text-gray-500">(based on 5 similar historical cases)</span>
                                    </div>
                                 </div>
                              </div>
                           </div>
                        )}
                     </div>
                  </div>

                  <div>
                     <h3 className="text-sm font-bold text-gray-900 mb-2">Subject:</h3>
                     <p className="text-gray-500 text-sm">ORDER MORE 1.0 TIDAK MASUK SAP</p>
                  </div>

                  <div>
                     <h3 className="text-sm font-bold text-gray-900 mb-2">Description:</h3>
                     <div className="text-gray-500 text-sm leading-relaxed whitespace-pre-line">
                        Dear team IT,

                        Mohon di bantu MoRe-PO-25031892-1 tidak masuk SAP
                     </div>
                  </div>

                  <div>
                     <h3 className="text-sm font-bold text-gray-900 mb-2">Category:</h3>
                     <p className="text-gray-500 text-sm">Software - MORE 1.0 - MoRe 1.0 - Other</p>
                  </div>
               </div>
            )}

            {activeTab === 'activities' && renderActivities()}
            {activeTab === 'attachments' && renderAttachments()}

         </div>

         {/* Right Column - Sidebar Details */}
         <div className="w-80 flex flex-col gap-6 flex-shrink-0 overflow-y-auto custom-scrollbar pr-1">

            {/* Contact Details Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
               <div
                  className="flex justify-between items-center mb-4 cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => setIsContactDetailsOpen(!isContactDetailsOpen)}
               >
                  <h3 className="font-bold text-gray-800 text-sm">Contact Details</h3>
                  <ChevronDown size={16} className={`text-gray-400 transition-transform duration-200 ${isContactDetailsOpen ? 'rotate-180' : ''}`} />
               </div>

               {isContactDetailsOpen && (
                  <div className="space-y-4 animate-in slide-in-from-top-2 duration-200">
                     <div>
                        <p className="text-xs font-bold text-gray-500 mb-1.5">Requester</p>
                        <div className="flex items-center gap-3">
                           <img src="https://ui-avatars.com/api/?name=John+Doe&background=random" className="w-9 h-9 rounded-full" alt="" />
                           <div className="min-w-0">
                              <p className="text-sm font-bold text-gray-800 truncate">John Doe</p>
                              <p className="text-xs text-gray-400 truncate">johndoe@gmail.com</p>
                           </div>
                        </div>
                     </div>

                     <div>
                        <p className="text-xs font-bold text-gray-500 mb-1.5">Requested For</p>
                        <div className="flex items-center gap-3">
                           <img src="https://ui-avatars.com/api/?name=John+Doe&background=random" className="w-9 h-9 rounded-full" alt="" />
                           <div className="min-w-0">
                              <p className="text-sm font-bold text-gray-800 truncate">John Doe</p>
                              <p className="text-xs text-gray-400 truncate">johndoe@gmail.com</p>
                           </div>
                        </div>
                     </div>

                     <div>
                        <p className="text-xs font-bold text-gray-500 mb-1.5">Agent</p>
                        <div className="flex items-center gap-3">
                           <div className="relative">
                              <img src="https://ui-avatars.com/api/?name=Mike+Ross&background=random" className="w-9 h-9 rounded-full" alt="" />
                              <div className="absolute -bottom-1 -right-1 scale-75">
                                 <StatusBadge status="Available" showLabel={false} />
                              </div>
                           </div>
                           <div className="min-w-0">
                              <p className="text-sm font-bold text-gray-800 truncate">Mike Ross</p>
                              <div className="flex items-center gap-2">
                                 <p className="text-xs text-gray-400 truncate">Support Agent</p>
                                 <StatusBadge status="Available" />
                              </div>
                           </div>
                        </div>
                     </div>

                     <div>
                        <p className="text-xs font-bold text-gray-500 mb-1.5">Second Layer Agent</p>
                        <div className="flex items-center gap-3">
                           <img src="https://ui-avatars.com/api/?name=Jane+Walker&background=random" className="w-9 h-9 rounded-full" alt="" />
                           <div className="min-w-0">
                              <p className="text-sm font-bold text-gray-800 truncate">Jane Walker</p>
                              <p className="text-xs text-gray-400 truncate">Network Specialist</p>
                           </div>
                        </div>
                     </div>
                  </div>
               )}
            </div>

            {/* Ticket Details Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
               <div className="flex justify-between items-center mb-4 cursor-pointer">
                  <h3 className="font-bold text-gray-800 text-sm">Ticket Details</h3>
                  <ChevronDown size={16} className="text-gray-400" />
               </div>

               <div className="space-y-4">
                  <div>
                     <p className="text-xs font-bold text-gray-500 mb-1">Ticket Information</p>
                     <div className="flex gap-2 items-start text-sm text-gray-600">
                        <div className="mt-0.5"><div className="w-4 h-4 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-600">!</div></div>
                        <div>
                           <span className="font-bold text-gray-700">Urgency</span>
                           <div className="flex items-center gap-1.5 font-bold text-yellow-500">
                              <div className="w-2.5 h-2.5 rounded-full bg-yellow-400"></div>
                              Medium
                           </div>
                        </div>
                     </div>
                     <div className="flex gap-2 items-start text-sm text-gray-600 mt-3">
                        <div className="mt-0.5"><Clock size={14} className="text-gray-400" /></div>
                        <div>
                           <span className="font-bold text-gray-700">Created Date</span>
                           <div className="text-gray-500">28 Feb 2025 - 10:40 PM</div>
                        </div>
                     </div>

                     {/* Standard SLA Response */}
                     <div className="flex gap-2 items-start text-sm text-gray-600 mt-3">
                        <div className="mt-0.5"><Clock size={14} className="text-gray-400" /></div>
                        <div>
                           <span className="font-bold text-gray-700">Standard SLA Response:</span>
                           <div className="text-gray-500">3 hours</div>
                        </div>
                     </div>

                     {/* Standard SLA Resolve */}
                     <div className="flex gap-2 items-start text-sm text-gray-600 mt-3">
                        <div className="mt-0.5"><Clock size={14} className="text-gray-400" /></div>
                        <div>
                           <span className="font-bold text-gray-700">Standard SLA Resolve:</span>
                           <div className="text-gray-500">12 hours</div>
                        </div>
                     </div>

                     {/* First Response Due Estimation */}
                     <div className="flex gap-2 items-start text-sm text-gray-600 mt-3">
                        <div className="mt-0.5"><Clock size={14} className="text-gray-400" /></div>
                        <div>
                           <span className="font-bold text-gray-700">First Response Due Estimation:</span>
                           <div className="flex items-center gap-2 text-gray-500">
                              <span>02 Dec 2025 15:30</span>
                              <span className="bg-green-100 text-green-600 px-1.5 py-0.5 rounded text-[10px] font-bold">Within SLA</span>
                           </div>
                        </div>
                     </div>

                     {/* Till First Response Due Estimation */}
                     <div className="flex gap-2 items-start text-sm text-gray-600 mt-3">
                        <div className="mt-0.5"><Clock size={14} className="text-gray-400" /></div>
                        <div>
                           <span className="font-bold text-gray-700">Till First Response Due Estimation:</span>
                           <div className="text-teal-500 font-medium">+0 day 2 hours 29 minutes</div>
                        </div>
                     </div>

                     {/* Resolve Due Estimation */}
                     <div className="flex gap-2 items-start text-sm text-gray-600 mt-3">
                        <div className="mt-0.5"><Clock size={14} className="text-gray-400" /></div>
                        <div>
                           <span className="font-bold text-gray-700">Resolve Due Estimation:</span>
                           <div className="flex items-center gap-2 text-gray-500">
                              <span>08 Dec 2025 11:43</span>
                              <span className="bg-green-100 text-green-600 px-1.5 py-0.5 rounded text-[10px] font-bold">Within SLA</span>
                           </div>
                        </div>
                     </div>

                     {/* Till Resolve Due Estimation */}
                     <div className="flex gap-2 items-start text-sm text-gray-600 mt-3">
                        <div className="mt-0.5"><Clock size={14} className="text-gray-400" /></div>
                        <div>
                           <span className="font-bold text-gray-700">Till Resolve Due Estimation:</span>
                           <div className="text-teal-500 font-medium">+0 day 12 hours 0 minutes</div>
                        </div>
                     </div>

                     {/* 2nd Layer Resolution Timer */}
                     <div className="flex gap-2 items-start text-sm text-gray-600 mt-3">
                        <div className="mt-0.5"><Clock size={14} className="text-gray-400" /></div>
                        <div>
                           <span className="font-bold text-gray-700">2nd Layer Resolution Timer:</span>
                           <div className="text-gray-500">0 Minutes</div>
                        </div>
                     </div>
                     <div className="flex gap-2 items-start text-sm text-gray-600 mt-3">
                        <div className="mt-0.5"><div className="w-4 h-4 flex items-center justify-center"><div className="w-3 h-3 border-2 border-gray-300 rounded-sm"></div></div></div>
                        <div>
                           <span className="font-bold text-gray-700">Rating</span>
                           <div className="flex gap-0.5 mt-0.5">
                              {[1, 2, 3, 4].map(i => <Star key={i} size={12} className="text-yellow-400 fill-current" />)}
                              <Star size={12} className="text-gray-200 fill-current" />
                           </div>
                        </div>
                     </div>
                  </div>

                  <div className="bg-gray-50 rounded-xl p-3 text-xs">
                     <p className="text-gray-400 mb-1">I appreciate the prompt response and acknowledgment of my feedback... It's reassuring</p>
                     <span className="font-bold text-gray-700 cursor-pointer hover:underline">Show more</span>
                  </div>
               </div>
            </div>

            {/* Other Details */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
               <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-gray-800 text-sm">Other Details</h3>
               </div>

               <div className="space-y-4">
                  <div>
                     <p className="text-xs font-medium text-gray-500 mb-1">Impact</p>
                     <div className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 bg-gray-50/50">
                        Low
                     </div>
                  </div>
                  <div>
                     <p className="text-xs font-medium text-gray-500 mb-1">Agent Group</p>
                     <div className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 bg-gray-50/50">
                        Service Desk
                     </div>
                  </div>
                  <div>
                     <p className="text-xs font-medium text-gray-500 mb-1">Priority</p>
                     <div className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 bg-gray-50/50">
                        High
                     </div>
                  </div>
                  <div>
                     <p className="text-xs font-medium text-gray-500 mb-1">Tagging</p>
                     <div className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 bg-gray-50/50 min-h-[42px] flex items-center flex-wrap gap-2">
                        <span className="bg-white border border-gray-200 px-2 py-0.5 rounded text-xs text-gray-600 font-medium">#SAP</span>
                        <span className="bg-white border border-gray-200 px-2 py-0.5 rounded text-xs text-gray-600 font-medium">#Network</span>
                     </div>
                  </div>
               </div>
            </div>

         </div>
      </div >
   );
};

export default TicketDetail;
