import React, { useState, useRef, useEffect } from 'react';
import { Check, ArrowRight, MessageSquare, X, Send, Bot, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import Swal from 'sweetalert2';

interface DepartmentSelectionProps {
  onSelectDepartment: (id: string) => void;
}

interface Department {
  id: string;
  company_name: string;
  description: string;
  is_active: boolean;
  items?: string[];
  rawServices?: string[];
}

const DepartmentSelection: React.FC<DepartmentSelectionProps> = ({ onSelectDepartment }) => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showChatbot, setShowChatbot] = useState(false);
  const [messages, setMessages] = useState<{ id: number; text: string; sender: 'user' | 'ai' }[]>([
    { id: 1, text: "Hi! I'm your AI assistant. Need help choosing a department or have a quick question?", sender: 'ai' }
  ]);
  const [inputValue, setInputValue] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Fetch departments from Supabase
  useEffect(() => {
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    try {
      setLoading(true);
      setError(null);

      const profileStr = localStorage.getItem('profile');
      const profile = profileStr ? JSON.parse(profileStr) : null;

      // Determine if user is a Super Admin (Global) or Department Admin
      const isAdmin = profile?.role_id === 1 || profile?.role_id === '1';
      const isDeptAdmin = profile?.is_department_admin === true;
      const isSuperAdmin = isAdmin && !isDeptAdmin;

      console.log('🔍 Fetching active departments from Supabase...');

      let query = supabase
        .from('company')
        .select('*')
        .eq('is_active', true);

      // Show all active departments to everyone
      // This allows users to access other departments as Requesters
      const response = await query.order('company_id', { ascending: true });

      console.log('📊 Full response:', response);
      console.log('📊 Active departments data:', response.data);
      console.log('❌ Error:', response.error);
      console.log('📊 Status:', response.status);

      if (response.error) {
        console.error('❌ Supabase Error:', response.error);
        setError(`Database error: ${response.error.message}`);
        return;
      }

      if (!response.data || response.data.length === 0) {
        console.warn('⚠️ No active departments found');
        setError('No active departments available at the moment.');
        return;
      }

      console.log('✅ Got data, transforming...');

      // Transform data
      const transformed: Department[] = response.data.map((dept: any) => {
        let services = dept.services;
        if (typeof services === 'string') {
          try {
            services = JSON.parse(services);
          } catch (e) {
            console.error('Error parsing services JSON:', e);
            services = [];
          }
        }

        const allServices = services && Array.isArray(services) ? services : [];

        return {
          id: dept.company_id || dept.id || String(Math.random()),
          company_name: dept.company_name || 'Unknown',
          description: dept.description || 'No description',
          is_active: dept.is_active !== false,
          items: allServices.filter((s: string) => !s.startsWith('__type:')),
          rawServices: allServices // Keep everything for handleSelectDepartment
        };
      });

      console.log('✅ Transformed departments:', transformed);
      setDepartments(transformed);

    } catch (error: any) {
      console.error('💥 Exception:', error);
      setError(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;

    const newMessage = { id: Date.now(), text: inputValue, sender: 'user' as const };
    setMessages(prev => [...prev, newMessage]);
    setInputValue('');

    // Simulate AI response
    setTimeout(() => {
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        text: "I see. Based on that, I'd recommend selecting the DIT department for technical issues, or let me know if you need more specific guidance.",
        sender: 'ai'
      }]);
    }, 1000);
  };

  const handleSelectDepartment = async (deptId: string) => {
    try {
      // Get profile from localStorage
      const profileStr = localStorage.getItem('profile');
      if (!profileStr) {
        console.error('No profile found in localStorage');
        onSelectDepartment(deptId);
        return;
      }

      const profile = JSON.parse(profileStr);
      console.log('=== DEPARTMENT SELECTION ===');
      console.log('Selected Department ID:', deptId);
      console.log('User Role ID:', profile.role_id);

      // Determine effective role and admin status
      const isAdminRole = profile?.role_id === 1 || profile?.role_id === '1';
      const isDeptAdmin = profile?.is_department_admin === true;
      const isSuperAdmin = isAdminRole && !isDeptAdmin;

      console.log('Is Admin Role:', isAdminRole);
      console.log('Is Dept Admin:', isDeptAdmin);
      console.log('Is Super Admin:', isSuperAdmin);
      console.log('User Company ID:', profile.company_id);
      console.log('Target Dept ID:', deptId);

      // 🛑 REJECT: Dept Admin trying to access another department
      if (isDeptAdmin && String(deptId) !== String(profile.company_id)) {
        Swal.fire({
          icon: 'error',
          title: 'Akses Ditolak',
          text: `Sebagai Admin Departemen, Anda hanya diizinkan mengelola departemen Anda sendiri.`,
          confirmButtonColor: '#4f46e5',
          background: '#ffffff',
          customClass: {
            popup: 'rounded-2xl shadow-xl border border-gray-100'
          }
        });
        return;
      }

      let effectiveRoleId = profile.role_id;
      let effectiveIsDeptAdmin = profile.is_department_admin;

      if (!isSuperAdmin && !isDeptAdmin) {
        // Regular Agents/Requesters become Requesters (Role 4) if they visit another department
        if (String(deptId) !== String(profile.company_id)) {
          console.log('⚠️ Downgrading to Requester for crossover department access');
          effectiveRoleId = 4;
          effectiveIsDeptAdmin = false;
        }
      }

      // Find the selected department object to get its services
      const selectedDept = departments.find(d => String(d.id) === String(deptId));
      
      // Extract module access types (prefixed with __type:)
      // If no __type: entries exist, default to ALL for compatibility
      const allServices = (selectedDept?.rawServices || []) as string[];
      const typeSpecificServices = allServices
        .filter(s => s.startsWith('__type:'))
        .map(s => s.replace('__type:', ''));
      
      const effectiveServices = typeSpecificServices.length > 0 ? typeSpecificServices : [];

      // Update profile in localStorage for the session
      const updatedProfile = {
        ...profile,
        role_id: effectiveRoleId,
        is_department_admin: effectiveIsDeptAdmin,
        company_id: Number(deptId), // Ensure all components filter by the selected department
        services: effectiveServices // Store clean module types (Incident, etc.) for dynamic filtering
      };
      localStorage.setItem('profile', JSON.stringify(updatedProfile));

      // Fetch role menu permissions based on effective role
      const { data: roleMenuPerms, error: roleMenuError } = await supabase
        .from('role_menu_permissions')
        .select('menu_id, can_view, can_create, can_update, can_delete, sort_order')
        .eq('role_id', effectiveRoleId);

      if (roleMenuError) {
        console.error('Error fetching role menu permissions:', roleMenuError);
      }

      // Fetch user-specific menu permissions (CUSTOM overrides)
      const { data: userMenuPerms, error: userMenuError } = await supabase
        .from('user_menu_permissions')
        .select('menu_key, can_view, can_create, can_update, can_delete')
        .eq('user_id', profile.id);

      if (userMenuError) {
        console.error('Error fetching user menu permissions:', userMenuError);
      }

      // Fetch menus ordered by order_no
      const { data: menus, error: menusError } = await supabase
        .from('menus')
        .select('*')
        .order('order_no', { ascending: true });

      if (menusError) {
        console.error('Error fetching menus:', menusError);
      }

      console.log('Role Menu Permissions:', roleMenuPerms);
      console.log('User Menu Permissions (CUSTOM):', userMenuPerms);
      console.log('Menus:', menus);

      // Merge permissions: User-specific (CUSTOM) overrides Role-based
      const permissionsMap = new Map<string, any>();

      // Add role permissions first (using menu_id)
      (roleMenuPerms || []).forEach(perm => {
        permissionsMap.set(String(perm.menu_id), {
          ...perm,
          menu_id: perm.menu_id,
          source: 'ROLE'
        });
      });

      // Override with user-specific permissions (CUSTOM) - using menu_key
      // menu_key in user_menu_permissions corresponds to menu.id in menus table
      (userMenuPerms || []).forEach(perm => {
        const menuKey = String(perm.menu_key);
        const existing = permissionsMap.get(menuKey);
        permissionsMap.set(menuKey, {
          ...perm,
          menu_id: perm.menu_key, // Normalize to menu_id for consistency
          sort_order: existing?.sort_order || 0,
          source: 'CUSTOM'
        });
      });

      // Build accessible menus - only include menus with can_view permission
      // AND filter by department-specific services if they are defined
      const accessibleMenus = Array.from(permissionsMap.values())
        .filter(perm => perm.can_view === true)
        .map(perm => {
          const menuId = perm.menu_id || perm.menu_key;
          const menu = (menus || []).find(m => String(m.id) === String(menuId) || String(m.key) === String(menuId));
          return {
            id: menuId,
            name: menu?.label || menu?.name || menu?.menu_name || 'Unknown',
            can_view: perm.can_view,
            can_create: perm.can_create,
            can_update: perm.can_update,
            can_delete: perm.can_delete,
            sort_order: perm.sort_order || menu?.order_no || 0,
            source: perm.source
          };
        })
        .filter(menu => {
          // If no specific module access is checked, show all for backward compatibility
          if (effectiveServices.length === 0) return true;

          const menuName = (menu.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          const allowedServices = effectiveServices.map(s => s.toLowerCase());

          // Check if it's a service-related menu
          const isIncidentMenu = menuName.includes('incident');
          const isSRMenu = menuName.includes('servicerequest') || menuName.includes('myrequest');
          const isCRMenu = menuName.includes('changerequest') || menuName.includes('escalated');

          // If it's a service menu, check if the service is allowed
          if (isIncidentMenu && !allowedServices.includes('incident')) return false;
          if (isSRMenu && !allowedServices.includes('service request')) return false;
          if (isCRMenu && !allowedServices.includes('change request')) return false;

          return true;
        })
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

      console.log('Final Accessible Menus:', accessibleMenus);

      // Update localStorage with new accessible menus
      localStorage.setItem('accessibleMenus', JSON.stringify(accessibleMenus));

      // Proceed with department selection
      onSelectDepartment(deptId);
    } catch (error) {
      console.error('Error in handleSelectDepartment:', error);
      onSelectDepartment(deptId);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
          <p className="text-gray-600 font-medium">Loading departments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Select a Department</h1>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto">
            Choose a department to submit your ticket.
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-8 max-w-2xl mx-auto">
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-red-100 flex items-center justify-center mt-0.5">
                  <X className="w-3 h-3 text-red-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-red-800 mb-1">Error Loading Departments</h3>
                  <p className="text-sm text-red-600">{error}</p>
                  <button
                    onClick={fetchDepartments}
                    className="mt-3 text-xs font-medium text-red-700 hover:text-red-800 underline"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            </div>
            <div className="mt-4 p-4 bg-gray-100 rounded-lg">
              <p className="text-xs font-mono text-gray-600 mb-2">
                Debug: Check browser console (F12) for detailed logs
              </p>
              <p className="text-xs text-gray-600">
                Common fixes:
              </p>
              <ul className="text-xs text-gray-600 list-disc list-inside mt-1">
                <li>Run: ALTER TABLE public.company DISABLE ROW LEVEL SECURITY;</li>
                <li>Check if table 'company' exists in Supabase</li>
                <li>Verify Supabase URL and API key in .env file</li>
              </ul>
            </div>
          </div>
        )}

        {/* Grid */}
        {departments.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {departments.map((dept) => (
              <div
                key={dept.id}
                className="relative rounded-2xl p-8 transition-all duration-300 hover:-translate-y-1 group bg-white text-gray-900 shadow-sm border border-gray-100 hover:bg-[#1e1b4b] hover:text-white hover:shadow-xl hover:shadow-indigo-900/20 hover:border-transparent"
              >
                {/* Title Section */}
                <div className="mb-8">
                  <h3 className="text-2xl font-bold tracking-tight mb-1">
                    {dept.company_name}
                  </h3>
                  <p className="text-sm text-gray-500 group-hover:text-gray-300">
                    {dept.description}
                  </p>
                  <div className="w-full h-px mt-6 bg-gray-100 group-hover:bg-white/10" />
                </div>

                {/* List Items */}
                <ul className="space-y-4 mb-8">
                  {dept.items?.slice(0, 3).map((item, index) => (
                    <li key={index} className="flex items-center gap-3">
                      <div
                        className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center bg-green-100 text-green-600 group-hover:bg-white/20 group-hover:text-white"
                      >
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                      <span className="text-sm font-medium text-gray-600 group-hover:text-gray-100">
                        {item}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* Action Button */}
                <button
                  onClick={() => handleSelectDepartment(dept.id)}
                  className="w-full py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-semibold text-sm transition-colors bg-indigo-50 text-indigo-600 group-hover:bg-[#3b82f6] group-hover:text-white group-hover:shadow-lg group-hover:shadow-blue-500/30"
                >
                  Create Ticket
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        ) : !error && (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No active departments available at the moment.</p>
          </div>
        )}
      </div>

      {/* Floating Chatbot Button */}
      {!showChatbot && (
        <button
          onClick={() => setShowChatbot(true)}
          className="fixed bottom-8 right-8 p-4 bg-indigo-600 text-white rounded-full shadow-lg shadow-indigo-600/30 hover:bg-indigo-700 transition-transform hover:scale-105 z-50"
        >
          <MessageSquare size={24} />
        </button>
      )}

      {/* Chatbot Window */}
      {showChatbot && (
        <div className="fixed bottom-8 right-8 w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-300 z-50">
          {/* Header */}
          <div className="bg-indigo-600 p-4 flex justify-between items-center text-white">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-white/20 rounded-lg">
                <Bot size={20} />
              </div>
              <span className="font-bold text-sm">AI Assistant</span>
            </div>
            <button
              onClick={() => setShowChatbot(false)}
              className="p-1 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 h-80 overflow-y-auto p-4 bg-gray-50 space-y-4">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-3 rounded-2xl text-sm leading-relaxed shadow-sm ${msg.sender === 'user'
                  ? 'bg-indigo-600 text-white rounded-br-none'
                  : 'bg-white text-gray-700 border border-gray-100 rounded-bl-none'
                  }`}>
                  {msg.text}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 bg-white border-t border-gray-100">
            <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2 border border-gray-200 focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Ask something..."
                className="flex-1 bg-transparent border-none text-sm focus:ring-0 placeholder:text-gray-400"
              />
              <button
                onClick={handleSendMessage}
                className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                disabled={!inputValue.trim()}
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DepartmentSelection;