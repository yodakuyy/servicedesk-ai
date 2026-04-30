import React, { useState, useEffect } from 'react';
import { 
    Save, 
    Loader2, 
    Server, 
    Mail, 
    Lock, 
    Globe, 
    Clock, 
    ShieldCheck, 
    AlertTriangle,
    Eye,
    EyeOff,
    CheckCircle2
} from 'lucide-react';
import { supabase } from '../lib/supabase';
// @ts-ignore
import Swal from 'sweetalert2';

interface SMTPSettingsData {
    interval_reminder: number;
    smtp_host: string;
    smtp_port: number;
    smtp_encryption: 'none' | 'starttls' | 'ssl';
    smtp_user: string;
    smtp_pass: string;
    smtp_from: string;
    base_url: string;
}

const SMTPSettings: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [formData, setFormData] = useState<SMTPSettingsData>({
        interval_reminder: 2,
        smtp_host: 'smtp.office365.com',
        smtp_port: 587,
        smtp_encryption: 'starttls',
        smtp_user: 'AI.Support@modena.com',
        smtp_pass: '',
        smtp_from: 'AI.Support@modena.com',
        base_url: 'https://approval.modena.com'
    });

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('system_settings')
                .select('*')
                .eq('key', 'smtp_config')
                .single();

            if (error && error.code !== 'PGRST116') { // PGRST116 is "No rows found"
                console.warn('Error or table missing:', error.message);
            }

            if (data && data.value) {
                setFormData(data.value);
            }
        } catch (err) {
            console.error('Error fetching SMTP settings:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const { error } = await supabase
                .from('system_settings')
                .upsert({
                    key: 'smtp_config',
                    value: formData,
                    description: 'Global SMTP and Email Link settings',
                    updated_at: new Date().toISOString()
                });

            if (error) throw error;

            Swal.fire({
                icon: 'success',
                title: 'Settings Saved',
                text: 'Global configuration has been updated successfully.',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000
            });
        } catch (err: any) {
            console.error('Detailed Save Error:', JSON.stringify(err, null, 2));
            console.error('Error saving SMTP settings:', err);
            Swal.fire({
                icon: 'error',
                title: 'Save Failed',
                html: `
                    <p class="font-bold text-red-600 mb-2">${err.message || 'An error occurred'}</p>
                    <p class="text-xs text-gray-500">Check if the "system_settings" table exists and you have permissions.</p>
                `
            });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-4" />
                <p className="text-gray-500 font-medium">Loading settings...</p>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden mb-8">
                <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
                            <Server size={22} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-800">Global System Settings</h3>
                            <p className="text-xs text-gray-500 font-medium mt-0.5">SMTP Server & Application Defaults</p>
                        </div>
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all active:scale-95 disabled:opacity-50"
                    >
                        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        {saving ? 'Saving...' : 'Save Configuration'}
                    </button>
                </div>

                <div className="p-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Left Column */}
                        <div className="space-y-6">
                            {/* Interval Reminder */}
                            <div className="space-y-2">
                                <label className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                    <Clock size={14} className="text-indigo-400" /> Interval Reminder (Hari)
                                </label>
                                <input
                                    type="number"
                                    value={formData.interval_reminder}
                                    onChange={(e) => setFormData({ ...formData, interval_reminder: parseInt(e.target.value) || 0 })}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-base font-bold text-gray-800 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                                    placeholder="2"
                                />
                                <p className="text-[10px] text-gray-400 font-medium">Jarak waktu pengiriman email pengingat untuk tiket yang belum direspon.</p>
                            </div>

                            {/* SMTP Port */}
                            <div className="space-y-2">
                                <label className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                    <Server size={14} className="text-indigo-400" /> SMTP Port
                                </label>
                                <input
                                    type="number"
                                    value={formData.smtp_port}
                                    onChange={(e) => setFormData({ ...formData, smtp_port: parseInt(e.target.value) || 0 })}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-base font-bold text-gray-800 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                                    placeholder="587"
                                />
                            </div>

                            {/* SMTP Username */}
                            <div className="space-y-2">
                                <label className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                    <Mail size={14} className="text-indigo-400" /> SMTP Username
                                </label>
                                <input
                                    type="text"
                                    value={formData.smtp_user}
                                    onChange={(e) => setFormData({ ...formData, smtp_user: e.target.value })}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-base font-bold text-gray-800 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                                    placeholder="support@modena.com"
                                />
                            </div>

                            {/* SMTP From Address */}
                            <div className="space-y-2">
                                <label className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                    <Mail size={14} className="text-indigo-400" /> SMTP From Address
                                </label>
                                <input
                                    type="email"
                                    value={formData.smtp_from}
                                    onChange={(e) => setFormData({ ...formData, smtp_from: e.target.value })}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-base font-bold text-gray-800 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                                    placeholder="support@modena.com"
                                />
                            </div>
                        </div>

                        {/* Right Column */}
                        <div className="space-y-6">
                            {/* SMTP Host */}
                            <div className="space-y-2">
                                <label className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                    <Globe size={14} className="text-indigo-400" /> SMTP Host
                                </label>
                                <input
                                    type="text"
                                    value={formData.smtp_host}
                                    onChange={(e) => setFormData({ ...formData, smtp_host: e.target.value })}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-base font-bold text-gray-800 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                                    placeholder="smtp.office365.com"
                                />
                            </div>

                            {/* SMTP Encryption */}
                            <div className="space-y-2">
                                <label className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                    <ShieldCheck size={14} className="text-indigo-400" /> SMTP Encryption
                                </label>
                                <select
                                    value={formData.smtp_encryption}
                                    onChange={(e) => setFormData({ ...formData, smtp_encryption: e.target.value as any })}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-base font-bold text-gray-800 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all appearance-none cursor-pointer"
                                >
                                    <option value="none">None</option>
                                    <option value="starttls">STARTTLS</option>
                                    <option value="ssl">SSL / TLS</option>
                                </select>
                            </div>

                            {/* SMTP Password */}
                            <div className="space-y-2">
                                <label className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                    <Lock size={14} className="text-indigo-400" /> SMTP Password
                                </label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={formData.smtp_pass}
                                        onChange={(e) => setFormData({ ...formData, smtp_pass: e.target.value })}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-base font-bold text-gray-800 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                                        placeholder="••••••••••••"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-indigo-600 transition-colors"
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            {/* Base URL */}
                            <div className="space-y-2">
                                <label className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                    <Globe size={14} className="text-indigo-400" /> Base URL Link Email
                                </label>
                                <input
                                    type="text"
                                    value={formData.base_url}
                                    onChange={(e) => setFormData({ ...formData, base_url: e.target.value })}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-base font-bold text-gray-800 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                                    placeholder="https://approval.modena.com"
                                />
                                <p className="text-[10px] text-gray-400 font-medium">Domain utama yang akan digunakan untuk link di dalam email (misal: link tiket).</p>
                            </div>
                        </div>
                    </div>

                    {/* Security Note */}
                    <div className="mt-10 p-6 bg-emerald-50 border border-emerald-100 rounded-3xl flex items-start gap-4">
                        <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600 shrink-0">
                            <CheckCircle2 size={22} />
                        </div>
                        <div>
                            <h4 className="text-sm font-bold text-emerald-900">Security Recommendation</h4>
                            <p className="text-sm text-emerald-800 mt-1 opacity-80 font-medium">
                                We recommend using an App Password if your provider (Office 365, Gmail) has Multi-Factor Authentication enabled. This connection is encrypted during transmission.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Danger Zone Note */}
            <div className="bg-red-50 border border-red-100 rounded-3xl p-6 flex items-start gap-4">
                <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center text-red-600 shrink-0">
                    <AlertTriangle size={20} />
                </div>
                <div>
                    <h4 className="text-sm font-bold text-red-900">Warning</h4>
                    <p className="text-sm text-red-800 mt-1 opacity-80 font-medium">
                        Changing these settings will immediately affect all outgoing emails across the entire platform. Please verify credentials with a test email after saving.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default SMTPSettings;
