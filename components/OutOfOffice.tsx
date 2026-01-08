import React, { useState, useEffect } from 'react';
import { Search, Filter, Trash2, Calendar, Clock, AlertCircle, CheckCircle2, XCircle, Plus, Info, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
// @ts-ignore
import Swal from 'https://cdn.jsdelivr.net/npm/sweetalert2@11/+esm';
import StatusBadge, { UserStatus } from './StatusBadge';

interface OOORequest {
   id: string;
   user_id: string;
   ooo_type: string;
   start_at: string;
   end_at: string;
   ended_at?: string;
   reason?: string;
   status: 'Active' | 'Ended' | 'Cancelled';
   is_forced: boolean;
   created_by?: string;
   created_at: string;
   tickets_reassigned?: number;
   agent_name?: string;
}

interface TeamMember {
   id: string;
   full_name: string;
   role_id: number;
   role_name: string;
   status: string;
   tickets_count: number;
   ooo_until?: string;
   ooo_days?: number;
}

interface OutOfOfficeProps {
   viewMode?: 'agent' | 'supervisor';
}

const OutOfOffice: React.FC<OutOfOfficeProps> = ({ viewMode = 'agent' }) => {
   const [loading, setLoading] = useState(true);
   const [activeOOO, setActiveOOO] = useState<OOORequest | null>(null);
   const [oooHistory, setOOOHistory] = useState<OOORequest[]>([]);
   const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
   const [userProfile, setUserProfile] = useState<any>(null);
   const [isModalOpen, setIsModalOpen] = useState(false);
   const [activeTab, setActiveTab] = useState<'agent' | 'supervisor'>(viewMode);
   const [agentSubTab, setAgentSubTab] = useState<'current' | 'history'>('current');
   const [supervisorSubTab, setSupervisorSubTab] = useState<'availability' | 'history'>('availability');

   // Modal states
   const [modalType, setModalType] = useState<'create' | 'detail' | 'force'>('create');
   const [selectedAgent, setSelectedAgent] = useState<TeamMember | null>(null);
   const [selectedOOO, setSelectedOOO] = useState<OOORequest | null>(null);

   // Supervisor Filter States
   const [searchQuery, setSearchQuery] = useState('');
   const [statusFilter, setStatusFilter] = useState<'All' | 'Available' | 'Out Of Office'>('All');

   // History Filter States
   const [historyFilters, setHistoryFilters] = useState({
      startDate: '',
      endDate: '',
      type: 'All',
      status: 'All',
      isForced: 'All' as 'All' | 'Forced' | 'Normal'
   });

   // History Pagination States
   const [historyPage, setHistoryPage] = useState(1);
   const historyPerPage = 10;

   // Team Monitoring Pagination States
   const [teamPage, setTeamPage] = useState(1);
   const teamPerPage = 10;

   // Reset page on filter change
   useEffect(() => {
      setHistoryPage(1);
   }, [historyFilters, searchQuery]);

   useEffect(() => {
      setTeamPage(1);
   }, [searchQuery, statusFilter]);

   // Form states
   const [formData, setFormData] = useState({
      type: 'Leave',
      startDate: '',
      startTime: '09:00',
      endDate: '',
      endTime: '18:00',
      reason: ''
   });

   useEffect(() => {
      const profile = localStorage.getItem('profile');
      if (profile) {
         setUserProfile(JSON.parse(profile));
      }
   }, []);

   useEffect(() => {
      if (userProfile) {
         fetchData();
      }
   }, [userProfile, activeTab, agentSubTab, supervisorSubTab]);

   const fetchData = async () => {
      setLoading(true);
      try {
         if (activeTab === 'agent') {
            // 1. Fetch current active OOO for the user
            const { data: activeData, error: activeError } = await supabase
               .from('out_of_office')
               .select('*')
               .eq('user_id', userProfile.id)
               .eq('status', 'Active')
               .gt('end_at', new Date().toISOString())
               .order('start_at', { ascending: true })
               .limit(1)
               .maybeSingle();

            if (activeError) throw activeError;

            // Auto-revert status if expired but still marked as OOO
            if (!activeData && (userProfile.status?.toUpperCase() === 'OOO' || userProfile.status === 'Out Of Office')) {
               await supabase.from('profiles').update({ status: 'Available' }).eq('id', userProfile.id);
               const updatedProfile = { ...userProfile, status: 'Available' };
               localStorage.setItem('profile', JSON.stringify(updatedProfile));
               setUserProfile(updatedProfile);
            }

            setActiveOOO(activeData);

            // 2. Fetch history for the user
            const { data: historyData } = await supabase
               .from('out_of_office')
               .select('*')
               .eq('user_id', userProfile.id)
               .order('created_at', { ascending: false });

            setOOOHistory((historyData || []).map((h: any) => ({
               ...h,
               agent_name: userProfile.full_name
            })));

         } else {
            // Fetch team availability
            // 1. Get profiles in the same company
            const { data: members, error: membersError } = await supabase
               .from('profiles')
               .select(`
            id,
            full_name,
            role_id,
            status,
            roles:role_id (role_name)
          `)
               .eq('company_id', userProfile.company_id);

            if (membersError) throw membersError;

            // Filter out Administrator role
            const filteredMembers = (members || []).filter((m: any) =>
               (m.roles?.role_name || '').toLowerCase() !== 'administrator'
            );

            // 2. Map members for team availability view
            const mappedMembers = await Promise.all(filteredMembers.map(async (m: any) => {
               const { count } = await supabase
                  .from('tickets')
                  .select('*', { count: 'exact', head: true })
                  .eq('assigned_to', m.id)
                  .neq('status', 'Closed');

               let ooo_until = undefined;
               let ooo_days = undefined;
               let memberStatus = m.status || 'Available';

               if (memberStatus.toLowerCase() === 'active') memberStatus = 'Available';
               if (memberStatus.toLowerCase() === 'available') memberStatus = 'Available';

               if (memberStatus.toUpperCase() === 'OOO' || memberStatus === 'Out Of Office') {
                  const { data: oooItem } = await supabase
                     .from('out_of_office')
                     .select('id, end_at')
                     .eq('user_id', m.id)
                     .eq('status', 'Active')
                     .order('end_at', { ascending: false })
                     .limit(1)
                     .maybeSingle();

                  if (oooItem) {
                     const endDate = new Date(oooItem.end_at);
                     if (endDate > new Date()) {
                        memberStatus = 'Out Of Office';
                        ooo_until = endDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
                        const diffTime = Math.abs(endDate.getTime() - new Date().getTime());
                        ooo_days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                     } else {
                        memberStatus = 'Available';
                        const syncStatus = async () => {
                           try {
                              await supabase.from('profiles').update({ status: 'Available' }).eq('id', m.id);
                              if (oooItem) {
                                 await supabase.from('out_of_office').update({ status: 'Ended', ended_at: new Date().toISOString() }).eq('id', oooItem.id);
                              }
                           } catch (e) {
                              console.error('Error syncing OOO status:', e);
                           }
                        };
                        syncStatus();
                     }
                  } else {
                     memberStatus = 'Available';
                     supabase.from('profiles').update({ status: 'Available' }).eq('id', m.id).then(({ error }) => {
                        if (error) console.error('Error syncing profile status:', error);
                     });
                  }
               }

               return {
                  id: m.id,
                  full_name: m.full_name,
                  role_id: m.role_id,
                  role_name: m.roles?.role_name || 'Agent',
                  status: memberStatus,
                  tickets_count: count || 0,
                  ooo_until,
                  ooo_days
               };
            }));

            setTeamMembers(mappedMembers);

            // 3. Fetch history for all members in company
            // Using a simple select('*') to avoid any join errors (PGRST200)
            const memberIds = filteredMembers.map((m: any) => m.id);
            const { data: allHistory, error: historyFetchError } = await supabase
               .from('out_of_office')
               .select('*')
               .in('user_id', memberIds)
               .order('created_at', { ascending: false });

            if (historyFetchError) {
               console.error('OOO History Fetch Error:', historyFetchError);
            }

            // Map names from the members list we already have for reliability
            const formattedHistory = (allHistory || []).map((h: any) => {
               const agent = members.find((m: any) => m.id === h.user_id);
               const creator = members.find((m: any) => m.id === h.created_by);
               return {
                  ...h,
                  agent_name: agent?.full_name || 'Unknown Agent',
                  created_by_name: creator?.full_name || (h.created_by === h.user_id ? (agent?.full_name || 'Self') : 'System')
               };
            });

            console.log('Formatted OOO History:', formattedHistory);
            setOOOHistory(formattedHistory);
         }
      } catch (error) {
         console.error('Error fetching OOO data:', error);
      } finally {
         setLoading(false);
      }
   };

   const handleSetOOO = async () => {
      try {
         const start = new Date(`${formData.startDate}T${formData.startTime}:00`).toISOString();
         const end = new Date(`${formData.endDate}T${formData.endTime}:00`).toISOString();

         const { data, error } = await supabase
            .from('out_of_office')
            .insert({
               user_id: userProfile.id,
               ooo_type: formData.type,
               start_at: start,
               end_at: end,
               reason: formData.reason,
               status: 'Active',
               created_by: userProfile.id
            })
            .select()
            .single();

         if (error) throw error;

         // Update user status
         await supabase
            .from('profiles')
            .update({ status: 'Out Of Office' })
            .eq('id', userProfile.id);

         Swal.fire({
            icon: 'success',
            title: 'OOO Set Successfully',
            text: 'Your status has been updated to Out of Office.',
            confirmButtonColor: '#4c40e6',
         });

         setIsModalOpen(false);
         fetchData();
      } catch (error: any) {
         Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.message,
         });
      }
   };

   const handleEndOOO = async (reqId: string, userId: string) => {
      const result = await Swal.fire({
         title: 'End OOO Early?',
         text: "This will set your status back to Available.",
         icon: 'question',
         showCancelButton: true,
         confirmButtonText: 'Yes, End Now',
         cancelButtonText: 'Cancel',
         confirmButtonColor: '#4c40e6',
      });

      if (result.isConfirmed) {
         try {
            await supabase
               .from('out_of_office')
               .update({
                  status: 'Ended',
                  ended_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
               })
               .eq('id', reqId);

            await supabase
               .from('profiles')
               .update({ status: 'Available' })
               .eq('id', userId);

            Swal.fire({
               icon: 'success',
               title: 'OOO Ended',
               text: 'You are now marked as Available.',
            });

            setIsModalOpen(false);
            fetchData();
         } catch (error: any) {
            Swal.fire({ icon: 'error', title: 'Error', text: error.message });
         }
      }
   };

   const handleCancelOOO = async (reqId: string, userId: string) => {
      const result = await Swal.fire({
         title: 'Cancel OOO Record?',
         text: "This will void the record and set status back to Available.",
         icon: 'warning',
         showCancelButton: true,
         confirmButtonText: 'Yes, Cancel Record',
         cancelButtonText: 'No, Keep it',
         confirmButtonColor: '#ef4444',
      });

      if (result.isConfirmed) {
         try {
            await supabase
               .from('out_of_office')
               .update({ status: 'Cancelled', updated_at: new Date().toISOString() })
               .eq('id', reqId);

            await supabase
               .from('profiles')
               .update({ status: 'Available' })
               .eq('id', userId);

            if (userId === userProfile.id) {
               const updatedProfile = { ...userProfile, status: 'Available' };
               localStorage.setItem('profile', JSON.stringify(updatedProfile));
               setUserProfile(updatedProfile);
            }

            Swal.fire({
               icon: 'success',
               title: 'OOO Cancelled',
               text: 'The record has been voided.',
            });

            setIsModalOpen(false);
            fetchData();
         } catch (error: any) {
            Swal.fire({ icon: 'error', title: 'Error', text: error.message });
         }
      }
   };

   const openSetOOOModal = () => {
      setModalType('create');
      setFormData({
         type: 'Leave',
         startDate: new Date().toISOString().split('T')[0],
         startTime: '09:00',
         endDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
         endTime: '18:00',
         reason: ''
      });
      setIsModalOpen(true);
   };

   const openDetailModal = async (member: TeamMember | OOORequest) => {
      // Check if it's a TeamMember (active status check) or already an OOORequest (history)
      if ('id' in member && 'full_name' in member && !('ooo_type' in member)) {
         if (member.status !== 'Out Of Office' && member.status !== 'OOO') return;

         setLoading(true);
         try {
            const { data, error } = await supabase
               .from('out_of_office')
               .select('*')
               .eq('user_id', member.id)
               .eq('status', 'Active')
               .order('created_at', { ascending: false })
               .limit(1)
               .maybeSingle();

            if (data) {
               setSelectedOOO({ ...data, agent_name: member.full_name });
               setModalType('detail');
               setIsModalOpen(true);
            }
         } catch (error) {
            console.error('Error fetching OOO detail:', error);
         } finally {
            setLoading(false);
         }
      } else {
         // It's already an OOORequest (from history)
         const request = member as OOORequest;
         setSelectedOOO(request);
         setModalType('detail');
         setIsModalOpen(true);
      }
   };

   const openForceOOOModal = (member: TeamMember) => {
      setSelectedAgent(member);
      setModalType('force');
      setFormData({
         type: 'Emergency',
         startDate: new Date().toISOString().split('T')[0],
         startTime: new Date().toTimeString().slice(0, 5),
         endDate: '',
         endTime: '',
         reason: 'Emergency Override'
      });
      setIsModalOpen(true);
   };

   const handleForceOOO = async () => {
      if (!selectedAgent) return;

      try {
         const start = new Date().toISOString();
         // For TBD, we might set a very far end date or handle it separately
         const end = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

         const { error } = await supabase
            .from('out_of_office')
            .insert({
               user_id: selectedAgent.id,
               ooo_type: formData.type,
               start_at: start,
               end_at: end,
               reason: formData.reason,
               status: 'Active',
               is_forced: true,
               created_by: userProfile.id
            });

         if (error) throw error;

         await supabase
            .from('profiles')
            .update({ status: 'Out Of Office' })
            .eq('id', selectedAgent.id);

         Swal.fire({
            icon: 'warning',
            title: 'Force OOO Active',
            text: `Agent ${selectedAgent.full_name} is now marked as Out of Office.`,
            confirmButtonColor: '#ef4444',
         });

         setIsModalOpen(false);
         fetchData();
      } catch (error: any) {
         Swal.fire({ icon: 'error', title: 'Error', text: error.message });
      }
   };

   const renderAgentView = () => (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
         {/* Sub-tabs for Agent */}
         <div className="flex gap-4 border-b border-gray-100 mb-2">
            <button
               onClick={() => setAgentSubTab('current')}
               className={`pb-4 text-sm font-bold transition-all relative ${agentSubTab === 'current' ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
            >
               My Availability
               {agentSubTab === 'current' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full" />}
            </button>
            <button
               onClick={() => setAgentSubTab('history')}
               className={`pb-4 text-sm font-bold transition-all relative ${agentSubTab === 'history' ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
            >
               History
               {agentSubTab === 'history' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full" />}
            </button>
         </div>

         {agentSubTab === 'current' ? (
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 overflow-hidden relative">
               <div className="flex justify-between items-start mb-8">
                  <div>
                     <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Availability Status</h3>
                     <div className="space-y-4">
                        <div className="flex items-center gap-8">
                           <span className="text-sm text-gray-500 w-40">Status</span>
                           <StatusBadge status={activeOOO ? 'Out Of Office' : 'Available'} />
                        </div>
                        <div className="flex items-center gap-8">
                           <span className="text-sm text-gray-500 w-40">Current Out Of Office</span>
                           <span className="text-sm font-semibold text-gray-800">
                              {activeOOO ? `${activeOOO.ooo_type} (${new Date(activeOOO.start_at).toLocaleDateString()} - ${new Date(activeOOO.end_at).toLocaleDateString()})` : 'None'}
                           </span>
                        </div>
                     </div>
                  </div>
                  {!activeOOO && (
                     <button
                        onClick={openSetOOOModal}
                        className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95"
                     >
                        <Plus size={18} /> Set Out of Office
                     </button>
                  )}
               </div>

               {activeOOO && (
                  <div className="mt-8 pt-8 border-t border-dashed border-gray-200">
                     <div className="bg-red-50 border border-red-100 rounded-2xl p-6 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-5">
                           <Calendar size={120} className="text-red-900" />
                        </div>

                        <div className="flex items-start gap-4 mb-6">
                           <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center text-red-600 flex-shrink-0">
                              <XCircle size={24} />
                           </div>
                           <div>
                              <h4 className="font-bold text-red-900 text-lg">You are Out of Office</h4>
                              <p className="text-red-700/70 text-sm">New tickets will not be assigned to you until your Out Of Office ends.</p>
                           </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                           <div className="space-y-1">
                              <span className="text-[10px] uppercase font-bold text-red-400 tracking-wider">Type</span>
                              <p className="font-bold text-red-900">{activeOOO.ooo_type}</p>
                           </div>
                           <div className="space-y-1">
                              <span className="text-[10px] uppercase font-bold text-red-400 tracking-wider">Period</span>
                              <div className="flex items-center gap-3 font-bold text-red-900">
                                 <p>{new Date(activeOOO.start_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</p>
                                 <ArrowRight size={14} />
                                 <p>{new Date(activeOOO.end_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</p>
                              </div>
                           </div>
                        </div>

                        <div className="flex items-center gap-3 p-4 bg-white/50 rounded-xl border border-red-100 mb-6">
                           <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                              <CheckCircle2 size={16} />
                           </div>
                           <p className="text-xs font-medium text-red-900">Assigned tickets automatically reassigned</p>
                        </div>

                        <button
                           onClick={() => handleEndOOO(activeOOO.id, userProfile.id)}
                           className="bg-white text-red-600 border border-red-200 px-6 py-3 rounded-xl font-bold text-sm shadow-sm hover:bg-red-50 hover:border-red-300 transition-all active:scale-95 flex items-center gap-2"
                        >
                           <Clock size={16} /> End OOO Early
                        </button>
                     </div>
                  </div>
               )}
            </div>
         ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
               <div className="px-8 py-6 border-b border-gray-50 bg-gray-50/30">
                  <h3 className="font-bold text-gray-800 text-lg">Out of Office History</h3>
               </div>
               <div className="overflow-x-auto">
                  <table className="w-full text-left">
                     <thead>
                        <tr className="text-[10px] uppercase tracking-widest font-bold text-gray-400 bg-gray-50/50">
                           <th className="px-8 py-4">Period</th>
                           <th className="px-8 py-4">Type</th>
                           <th className="px-8 py-4">Status</th>
                           <th className="px-8 py-4 text-right">Actions</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-gray-50">
                        {oooHistory.length > 0 ? oooHistory.map((h) => (
                           <tr key={h.id} className="group hover:bg-gray-50/80 transition-colors cursor-pointer" onClick={() => openDetailModal(h)}>
                              <td className="px-8 py-5">
                                 <div className="flex flex-col">
                                    <span className="font-bold text-gray-800 text-sm">
                                       {new Date(h.start_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} - {new Date(h.end_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </span>
                                    <span className="text-[10px] text-gray-400 flex items-center gap-1">
                                       <Clock size={10} /> {new Date(h.start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                 </div>
                              </td>
                              <td className="px-8 py-5">
                                 <div className="inline-flex px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] font-bold rounded uppercase">
                                    {h.ooo_type}
                                 </div>
                              </td>
                              <td className="px-8 py-5">
                                 <div className="flex items-center gap-2">
                                    <StatusBadge status={h.status} />
                                    {h.is_forced && (
                                       <span className="px-1.5 py-0.5 bg-red-100 text-red-600 text-[8px] font-black rounded uppercase">Forced</span>
                                    )}
                                 </div>
                              </td>
                              <td className="px-8 py-5 text-right">
                                 <button className="text-indigo-600 text-xs font-bold hover:underline">View Detail</button>
                              </td>
                           </tr>
                        )) : (
                           <tr>
                              <td colSpan={4} className="px-8 py-12 text-center text-gray-400 text-sm italic">No history records found</td>
                           </tr>
                        )}
                     </tbody>
                  </table>
               </div>
            </div>
         )}
      </div>
   );

   const renderSupervisorView = () => (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
         {/* Sub-tabs for Supervisor */}
         <div className="flex gap-4 border-b border-gray-100 mb-2">
            <button
               onClick={() => setSupervisorSubTab('availability')}
               className={`pb-4 text-sm font-bold transition-all relative ${supervisorSubTab === 'availability' ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
            >
               Team Monitoring
               {supervisorSubTab === 'availability' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full" />}
            </button>
            <button
               onClick={() => setSupervisorSubTab('history')}
               className={`pb-4 text-sm font-bold transition-all relative ${supervisorSubTab === 'history' ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
            >
               Monitoring History
               {supervisorSubTab === 'history' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full" />}
            </button>
         </div>

         {supervisorSubTab === 'availability' ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
               <div className="px-8 py-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/30">
                  <h3 className="font-bold text-gray-800 text-lg flex items-center gap-3">
                     <div className="w-2 h-2 bg-indigo-600 rounded-full animate-pulse"></div>
                     Live Status
                  </h3>
                  <div className="flex gap-4">
                     {/* Quick Filters */}
                     <div className="flex bg-gray-100 p-1 rounded-xl">
                        {(['All', 'Available', 'Out Of Office'] as const).map((s) => (
                           <button
                              key={s}
                              onClick={() => setStatusFilter(s)}
                              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${statusFilter === s ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                           >
                              {s}
                           </button>
                        ))}
                     </div>

                     <div className="relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                           type="text"
                           placeholder="Search agent..."
                           value={searchQuery}
                           onChange={(e) => setSearchQuery(e.target.value)}
                           className="pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 w-64"
                        />
                     </div>
                  </div>
               </div>

               {/* Alert Banner */}
               {teamMembers.filter(m => m.status === 'Out Of Office').length >= teamMembers.length / 2 && teamMembers.length > 0 && (
                  <div className="px-8 py-3 bg-amber-50 border-b border-amber-100 flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                     <AlertCircle size={18} className="text-amber-500" />
                     <p className="text-sm font-medium text-amber-800">
                        <span className="font-bold">Team Capacity Alert:</span> {teamMembers.filter(m => m.status === 'Out Of Office').length} of {teamMembers.length} agents are currently Out of Office.
                     </p>
                  </div>
               )}

               <div className="overflow-x-auto">
                  <table className="w-full text-left">
                     <thead>
                        <tr className="text-[10px] uppercase tracking-widest font-bold text-gray-400 bg-gray-50/50">
                           <th className="px-8 py-4">Name</th>
                           <th className="px-8 py-4">Role</th>
                           <th className="px-8 py-4">Status</th>
                           <th className="px-8 py-4">Tickets</th>
                           <th className="px-8 py-4 text-right">Actions</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-gray-50">
                        {(() => {
                           const filtered = teamMembers.filter(member => {
                              const matchesSearch = member.full_name.toLowerCase().includes(searchQuery.toLowerCase());
                              const matchesStatus = statusFilter === 'All' || member.status === statusFilter;
                              return matchesSearch && matchesStatus;
                           });

                           const totalPages = Math.ceil(filtered.length / teamPerPage);
                           const startIndex = (teamPage - 1) * teamPerPage;
                           const paginated = filtered.slice(startIndex, startIndex + teamPerPage);

                           if (filtered.length === 0) {
                              return (
                                 <tr>
                                    <td colSpan={5} className="px-8 py-12 text-center text-gray-400 text-sm italic">
                                       No team members found matching your search.
                                    </td>
                                 </tr>
                              );
                           }

                           return (
                              <>
                                 {paginated.map((member) => (
                                    <tr
                                       key={member.id}
                                       className={`group hover:bg-gray-50/80 transition-colors cursor-pointer ${member.status === 'Out Of Office' ? 'bg-red-50/30' : ''}`}
                                    >
                                       <td className="px-8 py-5" onClick={() => openDetailModal(member)}>
                                          <div className="flex items-center gap-3">
                                             <img src={`https://ui-avatars.com/api/?name=${member.full_name}&background=random`} className="w-8 h-8 rounded-full border border-white shadow-sm" alt="" />
                                             <div className="flex flex-col">
                                                <span className="font-bold text-gray-800 text-sm">{member.full_name}</span>
                                                {(member.status === 'Out Of Office' || member.status?.toUpperCase() === 'OOO') && member.ooo_until && (
                                                   <span className="text-[10px] text-red-500 font-medium flex items-center gap-1">
                                                      <Clock size={10} /> until {member.ooo_until} ({member.ooo_days}d)
                                                   </span>
                                                )}
                                             </div>
                                          </div>
                                       </td>
                                       <td className="px-8 py-5 text-sm text-gray-500 font-medium">{member.role_name}</td>
                                       <td className="px-8 py-5">
                                          <StatusBadge status={member.status} />
                                       </td>
                                       <td className="px-8 py-5">
                                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold ${member.tickets_count > 0 ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-400'}`}>
                                             {member.tickets_count}
                                          </span>
                                       </td>
                                       <td className="px-8 py-5 text-right">
                                          <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                             {member.status === 'Out Of Office' ? (
                                                <button
                                                   onClick={() => openDetailModal(member)}
                                                   className="bg-white border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:border-indigo-500 hover:text-indigo-600 transition-all"
                                                >
                                                   View Detail
                                                </button>
                                             ) : (
                                                <button
                                                   onClick={() => openForceOOOModal(member)}
                                                   className="bg-red-50 text-red-600 border border-red-100 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-600 hover:text-white transition-all shadow-sm"
                                                >
                                                   Force OOO
                                                </button>
                                             )}
                                          </div>
                                       </td>
                                    </tr>
                                 ))}
                                 {totalPages > 1 && (
                                    <tr>
                                       <td colSpan={5} className="px-8 py-4 bg-gray-50/20">
                                          <div className="flex items-center justify-between">
                                             <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                                Showing {startIndex + 1} to {Math.min(startIndex + teamPerPage, filtered.length)} of {filtered.length} members
                                             </span>
                                             <div className="flex gap-1">
                                                <button
                                                   onClick={(e) => { e.stopPropagation(); setTeamPage(prev => Math.max(1, prev - 1)); }}
                                                   disabled={teamPage === 1}
                                                   className="px-2 py-1 text-[10px] font-bold rounded border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50 transition-colors uppercase"
                                                >
                                                   Previous
                                                </button>
                                                {[...Array(totalPages)].map((_, i) => (
                                                   <button
                                                      key={i}
                                                      onClick={(e) => { e.stopPropagation(); setTeamPage(i + 1); }}
                                                      className={`w-6 h-6 flex items-center justify-center text-[10px] font-bold rounded transition-all ${teamPage === i + 1 ? 'bg-indigo-600 text-white shadow-sm' : 'hover:bg-gray-100 text-gray-500'}`}
                                                   >
                                                      {i + 1}
                                                   </button>
                                                ))}
                                                <button
                                                   onClick={(e) => { e.stopPropagation(); setTeamPage(prev => Math.min(totalPages, prev + 1)); }}
                                                   disabled={teamPage === totalPages}
                                                   className="px-2 py-1 text-[10px] font-bold rounded border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50 transition-colors uppercase"
                                                >
                                                   Next
                                                </button>
                                             </div>
                                          </div>
                                       </td>
                                    </tr>
                                 )}
                              </>
                           );
                        })()}
                     </tbody>
                  </table>
               </div>
            </div>
         ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
               <div className="px-8 py-6 border-b border-gray-50 bg-gray-50/30">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                     <h3 className="font-bold text-gray-800 text-lg">Full Out Of Office Audit History</h3>

                     <div className="flex flex-wrap gap-2">
                        {/* Filters */}
                        <div className="flex items-center bg-white border border-gray-200 rounded-lg px-2 py-1 gap-2">
                           <span className="text-[10px] font-bold text-gray-400">FROM</span>
                           <input
                              type="date"
                              value={historyFilters.startDate}
                              onChange={(e) => setHistoryFilters({ ...historyFilters, startDate: e.target.value })}
                              className="text-xs focus:outline-none"
                           />
                           <span className="text-[10px] font-bold text-gray-400">TO</span>
                           <input
                              type="date"
                              value={historyFilters.endDate}
                              onChange={(e) => setHistoryFilters({ ...historyFilters, endDate: e.target.value })}
                              className="text-xs focus:outline-none"
                           />
                        </div>

                        <select
                           value={historyFilters.type}
                           onChange={(e) => setHistoryFilters({ ...historyFilters, type: e.target.value })}
                           className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white font-medium focus:outline-none"
                        >
                           <option value="All">All Types</option>
                           <option value="Leave">Leave</option>
                           <option value="Sick">Sick</option>
                           <option value="Training">Training</option>
                           <option value="Emergency">Emergency</option>
                        </select>
                        <select
                           value={historyFilters.status}
                           onChange={(e) => setHistoryFilters({ ...historyFilters, status: e.target.value })}
                           className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white font-medium focus:outline-none"
                        >
                           <option value="All">All Status</option>
                           <option value="Active">Active</option>
                           <option value="Ended">Ended</option>
                           <option value="Cancelled">Cancelled</option>
                        </select>
                        <select
                           value={historyFilters.isForced}
                           onChange={(e) => setHistoryFilters({ ...historyFilters, isForced: e.target.value as any })}
                           className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white font-medium focus:outline-none"
                        >
                           <option value="All">All Entry</option>
                           <option value="Normal">Normal</option>
                           <option value="Forced">Forced</option>
                        </select>
                        <div className="relative">
                           <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                           <input
                              type="text"
                              placeholder="Search agent..."
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none w-40"
                           />
                        </div>
                     </div>
                  </div>
               </div>

               <div className="overflow-x-auto">
                  <table className="w-full text-left">
                     <thead>
                        <tr className="text-[10px] uppercase tracking-widest font-bold text-gray-400 bg-gray-50/50">
                           <th className="px-8 py-4">Agent</th>
                           <th className="px-8 py-4">Type</th>
                           <th className="px-8 py-4">Period</th>
                           <th className="px-8 py-4">Status</th>
                           <th className="px-8 py-4">Created By</th>
                           <th className="px-8 py-4 text-right">Actions</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-gray-50">
                        {(() => {
                           if (!oooHistory || oooHistory.length === 0) {
                              return (
                                 <tr>
                                    <td colSpan={6} className="px-8 py-12 text-center text-gray-400 text-sm italic">
                                       No history records found in database.
                                    </td>
                                 </tr>
                              );
                           }

                           const filtered = oooHistory.filter(h => {
                              const name = (h.agent_name || '').toLowerCase();
                              const query = searchQuery.toLowerCase();
                              const matchesSearch = !query || name.includes(query);
                              const matchesType = historyFilters.type === 'All' || h.ooo_type === historyFilters.type;
                              const matchesStatus = historyFilters.status === 'All' || h.status === historyFilters.status;
                              const matchesForced = historyFilters.isForced === 'All' || (historyFilters.isForced === 'Forced' ? h.is_forced : !h.is_forced);

                              const startAt = h.start_at ? new Date(h.start_at).getTime() : 0;
                              const fS = historyFilters.startDate ? new Date(historyFilters.startDate).getTime() : 0;
                              const fE = historyFilters.endDate ? new Date(historyFilters.endDate).setHours(23, 59, 59, 999) : Infinity;

                              const finalS = isNaN(fS) ? 0 : fS;
                              const finalE = isNaN(fE) ? Infinity : fE;
                              const matchesDate = startAt >= finalS && startAt <= finalE;

                              return matchesSearch && matchesType && matchesStatus && matchesForced && matchesDate;
                           });

                           const totalPages = Math.ceil(filtered.length / historyPerPage);
                           const startIndex = (historyPage - 1) * historyPerPage;
                           const paginated = filtered.slice(startIndex, startIndex + historyPerPage);

                           if (filtered.length === 0) {
                              return (
                                 <tr>
                                    <td colSpan={6} className="px-8 py-12 text-center text-gray-400 text-sm italic">
                                       No records match filters ({oooHistory.length} total found).
                                    </td>
                                 </tr>
                              );
                           }

                           return (
                              <>
                                 {paginated.map((h) => (
                                    <tr key={h.id} className="group hover:bg-gray-50/80 transition-colors cursor-pointer" onClick={() => openDetailModal(h)}>
                                       <td className="px-8 py-5">
                                          <div className="flex items-center gap-2">
                                             <img src={`https://ui-avatars.com/api/?name=${h.agent_name}&background=random`} className="w-6 h-6 rounded-full" alt="" />
                                             <span className="font-bold text-gray-800 text-sm">{h.agent_name}</span>
                                          </div>
                                       </td>
                                       <td className="px-8 py-5">
                                          <div className="flex flex-col gap-1">
                                             <span className="inline-flex px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] font-bold rounded uppercase w-fit">{h.ooo_type}</span>
                                             {h.is_forced && (
                                                <span className="px-1.5 py-0.5 bg-red-100 text-red-600 text-[8px] font-black rounded uppercase w-fit">Forced</span>
                                             )}
                                          </div>
                                       </td>
                                       <td className="px-8 py-5">
                                          <div className="flex flex-col">
                                             <span className="text-gray-800 text-xs font-medium">
                                                {new Date(h.start_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} - {new Date(h.end_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                             </span>
                                             <span className="text-[10px] text-gray-400">
                                                {new Date(h.start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                             </span>
                                          </div>
                                       </td>
                                       <td className="px-8 py-5">
                                          {h.status === 'Active' ? (
                                             <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-red-500 shadow-sm shadow-red-200"></div>
                                                <span className="text-[10px] font-black text-red-600 uppercase">Active</span>
                                             </div>
                                          ) : h.status === 'Ended' ? (
                                             <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-indigo-500 opacity-50 shadow-sm shadow-indigo-100"></div>
                                                <span className="text-[10px] font-bold text-gray-500 uppercase">Ended</span>
                                             </div>
                                          ) : (
                                             <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-gray-300 shadow-sm shadow-gray-100"></div>
                                                <span className="text-[10px] font-bold text-gray-400 uppercase line-through">Cancelled</span>
                                             </div>
                                          )}
                                       </td>
                                       <td className="px-8 py-5">
                                          <span className="text-xs text-gray-500 font-medium">{h.created_by_name || 'System'}</span>
                                       </td>
                                       <td className="px-8 py-5 text-right">
                                          <button className="text-indigo-600 text-xs font-bold hover:underline opacity-0 group-hover:opacity-100 transition-all">View Detail</button>
                                       </td>
                                    </tr>
                                 ))}
                                 {totalPages > 1 && (
                                    <tr>
                                       <td colSpan={6} className="px-8 py-4 bg-gray-50/20">
                                          <div className="flex items-center justify-between">
                                             <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                                Showing {startIndex + 1} to {Math.min(startIndex + historyPerPage, filtered.length)} of {filtered.length} entries
                                             </span>
                                             <div className="flex gap-1">
                                                <button
                                                   onClick={(e) => { e.stopPropagation(); setHistoryPage(prev => Math.max(1, prev - 1)); }}
                                                   disabled={historyPage === 1}
                                                   className="px-2 py-1 text-[10px] font-bold rounded border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50 transition-colors uppercase"
                                                >
                                                   Previous
                                                </button>
                                                {[...Array(totalPages)].map((_, i) => (
                                                   <button
                                                      key={i}
                                                      onClick={(e) => { e.stopPropagation(); setHistoryPage(i + 1); }}
                                                      className={`w-6 h-6 flex items-center justify-center text-[10px] font-bold rounded transition-all ${historyPage === i + 1 ? 'bg-indigo-600 text-white shadow-sm' : 'hover:bg-gray-100 text-gray-500'}`}
                                                   >
                                                      {i + 1}
                                                   </button>
                                                ))}
                                                <button
                                                   onClick={(e) => { e.stopPropagation(); setHistoryPage(prev => Math.min(totalPages, prev + 1)); }}
                                                   disabled={historyPage === totalPages}
                                                   className="px-2 py-1 text-[10px] font-bold rounded border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50 transition-colors uppercase"
                                                >
                                                   Next
                                                </button>
                                             </div>
                                          </div>
                                       </td>
                                    </tr>
                                 )}
                              </>
                           );
                        })()}
                     </tbody>
                  </table>
               </div>

               {/* Status Legend Footnote */}
               <div className="px-8 py-4 bg-gray-50/50 border-t border-gray-100">
                  <div className="flex flex-wrap gap-8 items-center">
                     <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status Guide:</span>
                     <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-red-500 shadow-sm shadow-red-200"></div>
                        <span className="text-[10px] font-bold text-gray-600 uppercase">Active: OOO is currently in progress</span>
                     </div>
                     <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-sm shadow-indigo-200"></div>
                        <span className="text-[10px] font-bold text-gray-600 uppercase">Ended: OOO period has concluded</span>
                     </div>
                     <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-gray-400 shadow-sm shadow-gray-100"></div>
                        <span className="text-[10px] font-bold text-gray-600 uppercase">Cancelled: Record has been voided</span>
                     </div>
                  </div>
               </div>
            </div>
         )}
      </div>
   );

   return (
      <div className="flex flex-col h-full bg-[#f8fafc] p-8 overflow-auto min-h-screen">
         {/* Header */}
         <div className="mb-8 flex justify-between items-end">
            <div>
               <div className="flex items-center gap-2 mb-2">
                  <div className="px-2 py-0.5 bg-indigo-100 text-indigo-600 text-[10px] font-bold rounded uppercase tracking-wider">Availability Management</div>
               </div>
               <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">Out Of Office</h2>
               <p className="text-gray-500 text-sm mt-1 max-w-lg">Manage your absence and team availability to ensure seamless ticket assignment.</p>
            </div>

            {/* Toggle View (Supervisors Only) */}
            {(userProfile?.role_id === 1 || userProfile?.role_id === 2 || userProfile?.role_id === '1' || userProfile?.role_id === '2') && (
               <div className="flex bg-gray-200/50 p-1.5 rounded-2xl border border-gray-100 shadow-inner">
                  <button
                     onClick={() => setActiveTab('agent')}
                     className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'agent' ? 'bg-white text-indigo-900 shadow-md' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                     My Availability
                  </button>
                  <button
                     onClick={() => setActiveTab('supervisor')}
                     className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'supervisor' ? 'bg-white text-indigo-900 shadow-md' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                     Team Monitoring
                  </button>
               </div>
            )}
         </div>

         {loading ? (
            <div className="flex-1 flex items-center justify-center">
               <div className="flex flex-col items-center gap-4">
                  <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-gray-500 font-medium animate-pulse">Syncing availability status...</p>
               </div>
            </div>
         ) : (
            activeTab === 'agent' ? renderAgentView() : renderSupervisorView()
         )}

         {/* MODALS */}
         {isModalOpen && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto p-4 sm:p-6 lg:p-8">
               <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity" onClick={() => setIsModalOpen(false)} />

               <div className="relative bg-white rounded-[2rem] shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-100">
                  {/* Modal Header */}
                  <div className={`p-8 border-b border-gray-100 flex justify-between items-center ${modalType === 'force' ? 'bg-red-50/50' : 'bg-gray-50/50'}`}>
                     <div>
                        <h3 className={`text-2xl font-black tracking-tight ${modalType === 'force' ? 'text-red-900' : 'text-gray-900'}`}>
                           {modalType === 'create' && '🛫 Set Out of Office'}
                           {modalType === 'detail' && '🛫 Out of Office Detail'}
                           {modalType === 'force' && '🚨 Force Out of Office'}
                        </h3>
                        <p className="text-gray-500 text-xs font-medium mt-1">
                           {modalType === 'create' && 'Notify system of your upcoming absence'}
                           {modalType === 'detail' && `Out of Office status for ${selectedOOO?.agent_name}`}
                           {modalType === 'force' && `Administrative override for ${selectedAgent?.full_name}`}
                        </p>
                     </div>
                     <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 rounded-full hover:bg-white hover:shadow-sm border border-transparent hover:border-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-all">
                        ✕
                     </button>
                  </div>

                  {/* Modal Content */}
                  <div className="p-8">
                     {modalType === 'create' && (
                        <div className="space-y-6">
                           <div>
                              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Out of Office Type</label>
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                 {['Leave', 'Sick', 'Training', 'Emergency', 'Other'].map((type) => (
                                    <button
                                       key={type}
                                       onClick={() => setFormData({ ...formData, type })}
                                       className={`px-4 py-3 rounded-2xl text-sm font-bold border transition-all ${formData.type === type ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100' : 'bg-white text-gray-600 border-gray-100 hover:border-indigo-200'}`}
                                    >
                                       {type}
                                    </button>
                                 ))}
                              </div>
                           </div>

                           <div className="grid grid-cols-2 gap-6">
                              <div>
                                 <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Start Date & Time</label>
                                 <input
                                    type="date"
                                    value={formData.startDate}
                                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all"
                                 />
                                 <input
                                    type="time"
                                    value={formData.startTime}
                                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm mt-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all"
                                 />
                              </div>
                              <div>
                                 <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">End Date & Time</label>
                                 <input
                                    type="date"
                                    value={formData.endDate}
                                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all"
                                 />
                                 <input
                                    type="time"
                                    value={formData.endTime}
                                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm mt-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all"
                                 />
                              </div>
                           </div>

                           <div>
                              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Reason (optional)</label>
                              <textarea
                                 placeholder="Family matter / Training AWS / etc"
                                 value={formData.reason}
                                 onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                                 className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm h-28 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all"
                              />
                           </div>

                           <div className="bg-orange-50/80 border border-orange-100 rounded-2xl p-4 flex gap-3">
                              <AlertCircle size={20} className="text-orange-500 flex-shrink-0" />
                              <div>
                                 <h4 className="text-xs font-bold text-orange-900 uppercase tracking-wide">While OOO:</h4>
                                 <ul className="text-xs text-orange-800/70 mt-1 space-y-1 list-disc pl-4">
                                    <li>You will not receive new tickets</li>
                                    <li>Existing tickets will be reassigned</li>
                                 </ul>
                              </div>
                           </div>
                        </div>
                     )}

                     {modalType === 'detail' && selectedOOO && (
                        <div className="space-y-8">
                           <div className="grid grid-cols-2 gap-y-8 gap-x-12">
                              <div className="space-y-1">
                                 <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Agent</span>
                                 <p className="text-sm font-bold text-gray-800">{selectedOOO.agent_name}</p>
                              </div>
                              <div className="space-y-1">
                                 <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Type</span>
                                 <div className="inline-flex px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded uppercase">{selectedOOO.ooo_type}</div>
                              </div>
                              <div className="col-span-2 space-y-1">
                                 <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Period</span>
                                 <div className="flex items-center gap-4 text-sm font-bold text-gray-800">
                                    <p>{new Date(selectedOOO.start_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</p>
                                    <ArrowRight size={14} className="text-gray-300" />
                                    <p>{new Date(selectedOOO.end_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</p>
                                    <span className="text-xs font-medium text-gray-400">
                                       ({Math.round((new Date(selectedOOO.end_at).getTime() - new Date(selectedOOO.start_at).getTime()) / (1000 * 60 * 60 * 24)) >= 1
                                          ? `${Math.round((new Date(selectedOOO.end_at).getTime() - new Date(selectedOOO.start_at).getTime()) / (1000 * 60 * 60 * 24))} days`
                                          : `${Math.round((new Date(selectedOOO.end_at).getTime() - new Date(selectedOOO.start_at).getTime()) / (1000 * 60 * 60))} hours`})
                                    </span>
                                 </div>
                              </div>
                              <div className="col-span-2 space-y-1">
                                 <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Reason</span>
                                 <p className={`text-sm p-4 rounded-2xl ${selectedOOO.reason ? 'text-gray-600 bg-gray-50' : 'text-gray-400 bg-gray-50/50 italic'}`}>
                                    {selectedOOO.reason ? `"${selectedOOO.reason}"` : 'No reason specified'}
                                 </p>
                              </div>
                              <div className="space-y-1">
                                 <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Tickets Reassigned</span>
                                 <p className="text-xl font-black text-indigo-600">{selectedOOO.tickets_reassigned || 0}</p>
                              </div>
                              <div className="space-y-1">
                                 <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</span>
                                 <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                    <p className="text-sm font-bold text-green-700">{selectedOOO.status}</p>
                                 </div>
                                 <p className="text-[10px] text-gray-400 font-medium mt-1 italic">
                                    * Tickets are automatically reassigned based on current workload.
                                 </p>
                              </div>
                           </div>
                        </div>
                     )}

                     {modalType === 'force' && selectedAgent && (
                        <div className="space-y-8">
                           <div className="bg-red-50 border border-red-100 rounded-2xl p-6 mb-4">
                              <div className="flex items-center gap-4 mb-4">
                                 <img src={`https://ui-avatars.com/api/?name=${selectedAgent.full_name}&background=random`} className="w-12 h-12 rounded-full border-2 border-white shadow-sm" alt="" />
                                 <div>
                                    <p className="text-xs font-bold text-red-400 uppercase tracking-widest">Forcing OOO for</p>
                                    <h4 className="text-lg font-black text-red-900">{selectedAgent.full_name}</h4>
                                 </div>
                              </div>

                              <div className="space-y-4">
                                 <div>
                                    <label className="block text-[10px] font-bold text-red-400 uppercase tracking-widest mb-2">Type</label>
                                    <select
                                       value={formData.type}
                                       onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                       className="w-full px-4 py-3 bg-white border border-red-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20"
                                    >
                                       <option>Emergency</option>
                                       <option>Leave</option>
                                       <option>Sick</option>
                                       <option>Training</option>
                                       <option>Other</option>
                                    </select>
                                 </div>
                                 <div className="flex items-center justify-between p-4 bg-white border border-red-50 rounded-2xl">
                                    <span className="text-sm font-bold text-red-900">Period</span>
                                    <span className="text-sm font-black text-red-600">NOW &rarr; TBD</span>
                                 </div>
                              </div>
                           </div>

                           <div className="bg-white p-4 rounded-2xl border-2 border-dashed border-red-200 flex gap-3">
                              <Info size={20} className="text-red-500 flex-shrink-0" />
                              <p className="text-xs font-bold text-red-900 uppercase">⚠️ All tickets will be reassigned immediately</p>
                           </div>
                        </div>
                     )}
                  </div>

                  {/* Modal Footer */}
                  <div className="p-8 bg-gray-50/50 border-t border-gray-100 flex justify-end gap-3">

                     {modalType === 'create' && (
                        <button
                           onClick={handleSetOOO}
                           className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold text-sm shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95"
                        >
                           Save Out Of Office
                        </button>
                     )}

                     {modalType === 'detail' && selectedOOO && (
                        <div className="flex gap-3">
                           {selectedOOO.status === 'Active' ? (
                              <>
                                 <button
                                    onClick={() => handleEndOOO(selectedOOO.id, selectedOOO.user_id)}
                                    className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold text-sm shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95"
                                 >
                                    End OOO Early
                                 </button>
                                 <button
                                    onClick={() => handleCancelOOO(selectedOOO.id, selectedOOO.user_id)}
                                    className="bg-white border border-gray-200 text-red-600 px-6 py-3 rounded-xl font-bold text-sm hover:bg-red-50 hover:border-red-200 transition-all active:scale-95"
                                 >
                                    Cancel OOO Record
                                 </button>
                              </>
                           ) : (
                              <button
                                 onClick={() => setIsModalOpen(false)}
                                 className="bg-gray-200 text-gray-600 px-8 py-3 rounded-xl font-bold text-sm hover:bg-gray-300 transition-all active:scale-95"
                              >
                                 Close Detail
                              </button>
                           )}
                        </div>
                     )}

                     {modalType === 'force' && (
                        <button
                           onClick={handleForceOOO}
                           className="bg-red-600 text-white px-8 py-3 rounded-xl font-bold text-sm shadow-xl shadow-red-200 hover:bg-red-700 transition-all active:scale-95"
                        >
                           Force OOO
                        </button>
                     )}
                  </div>
               </div>
            </div>
         )}
      </div>
   );
};

export default OutOfOffice;
