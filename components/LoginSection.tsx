import { supabase } from '../lib/supabase';
import React, { useState } from 'react';
import { Eye, EyeOff, Zap } from 'lucide-react';
// @ts-ignore
import Swal from 'https://cdn.jsdelivr.net/npm/sweetalert2@11/+esm';

interface LoginSectionProps {
  onLogin: () => void;
}

const LoginSection: React.FC<LoginSectionProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error(error);
      Swal.fire({
        icon: 'error',
        title: 'Login Failed',
        text: error.message,
        confirmButtonColor: '#4c40e6',
      });
      return;
    }

    if (!data) {
      Swal.fire({
        icon: 'error',
        title: 'Login Failed',
        text: 'Incorrect email or password',
        confirmButtonColor: '#4c40e6',
      });
      return;
    }
    // Ambil profile setelah login
    const user = data.user;

    // Revert ke standard Select (karena RPC belum di-run user)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select(`
      id,
      full_name,
      email,
      role_id,
      company_id,
      status
    `)
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('Profile fetch error:', profileError);
      Swal.fire({
        icon: 'error',
        title: 'Profile Error',
        text: profileError?.message || 'User profile not found via RPC',
        confirmButtonColor: '#4c40e6',
      });
      return;
    }

    // Check if user is active
    if (profile.status === 'Inactive') {
      console.log('Login blocked: User is inactive');
      Swal.fire({
        icon: 'error',
        title: 'Account Inactive',
        text: 'Your account has been deactivated. Please contact your administrator.',
        confirmButtonColor: '#ef4444',
      });
      // Sign out the user
      await supabase.auth.signOut();
      return;
    }

    console.log('=== PROFILE DATA ===');
    console.log('Full Profile:', profile);
    console.log('Profile ID:', profile.id);
    console.log('Profile Full Name:', profile.full_name);
    console.log('Profile Role ID:', profile.role_id);
    console.log('Profile Company ID:', profile.company_id);

    // Fetch role menu permissions berdasarkan role_id
    const { data: roleMenuPerms, error: roleMenuError } = await supabase
      .from('role_menu_permissions')
      .select('menu_id, can_view, can_create, can_update, can_delete, sort_order')
      .eq('role_id', profile.role_id);

    if (roleMenuError) {
      console.error('Error fetching role menu permissions:', roleMenuError);
    }

    // Fetch menus
    const { data: menus, error: menusError } = await supabase
      .from('menus')
      .select('*');

    if (menusError) {
      console.error('Error fetching menus:', menusError);
    }

    // Build accessible menus for this role
    const accessibleMenus = (roleMenuPerms || [])
      .map(perm => {
        const menu = (menus || []).find(m => String(m.id) === String(perm.menu_id));
        return {
          id: perm.menu_id,
          name: menu?.label || menu?.name || menu?.menu_name || 'Unknown',
          can_view: perm.can_view,
          can_create: perm.can_create,
          can_update: perm.can_update,
          can_delete: perm.can_delete,
          sort_order: perm.sort_order || 0
        };
      })
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

    console.log('=== ACCESSIBLE MENUS WITH SORT ORDER ===');
    console.log(JSON.stringify(accessibleMenus, null, 2));

    // Simpan session + profile + accessible menus
    localStorage.setItem('session', JSON.stringify(data.session));
    localStorage.setItem('profile', JSON.stringify(profile));
    localStorage.setItem('accessibleMenus', JSON.stringify(accessibleMenus));

    // Update last_active_at di profiles table
    const currentTime = new Date().toISOString();
    console.log('=== UPDATING LAST_ACTIVE_AT ===');
    console.log('User ID:', user.id);
    console.log('Current Time (ISO):', currentTime);

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ last_active_at: currentTime })
      .eq('id', user.id);

    if (updateError) {
      console.error('Error updating last_active_at:', updateError);
    } else {
      console.log('✅ Successfully updated last_active_at to:', currentTime);
    }

    onLogin();
  };

  return (
    <div className="w-full max-w-md space-y-8">
      {/* Header */}
      <div className="space-y-2">
        {/* <div className="w-10 h-10 bg-brand-primary/10 rounded-lg flex items-center justify-center mb-6">
          <Zap className="w-6 h-6 text-brand-primary fill-current" />
        </div> */}
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">LOGIN</h1>
        <p className="text-gray-500 text-sm">Manage your requests and get the support you need</p>
      </div>

      {/* Social Login */}
      <button
        type="button"
        onClick={onLogin}
        className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-200 rounded-full hover:bg-gray-50 transition-colors duration-200 group"
      >
        {/* Microsoft Logo */}
        <svg className="w-5 h-5" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg">
          <rect x="1" y="1" width="9" height="9" fill="#f25022" />
          <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
          <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
          <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
        </svg>
        <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">Sign in with Microsoft</span>
      </button>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-4 bg-white text-gray-400">or Sign in with Email</span>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email<span className="text-red-500">*</span>
            </label>
            <input
              id="email"
              type="email"
              placeholder="mail@website.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-full border border-gray-200 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 outline-none transition-all placeholder:text-gray-300 text-sm"
              required
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Password<span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Min. 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-full border border-gray-200 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 outline-none transition-all placeholder:text-gray-300 text-sm pr-10"
                required
                minLength={8}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <input
              id="remember-me"
              name="remember-me"
              type="checkbox"
              className="h-4 w-4 text-brand-primary border-gray-300 rounded focus:ring-brand-primary"
            />
            <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700 font-medium">
              Remember me
            </label>
          </div>

          <div className="text-sm">
            <a href="#" className="font-medium text-brand-primary hover:text-brand-700">
              Forget password?
            </a>
          </div>
        </div>

        <button
          type="submit"
          className="w-full flex justify-center py-3.5 px-4 border border-transparent rounded-full shadow-sm text-sm font-semibold text-white bg-brand-primary hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary transition-colors"
        >
          Login
        </button>
      </form>
    </div>
  );
};

export default LoginSection;