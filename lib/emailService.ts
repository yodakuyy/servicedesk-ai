import { supabase } from './supabase';

interface EmailPayload {
    event_key: string;
    company_id?: number | null;
    recipient_email: string;
    placeholders: Record<string, string>;
}

/**
 * Email Service Helper
 * Berfungsi untuk mengambil template dan mengirim email berdasarkan event.
 */
export const emailService = {
    /**
     * Mengambil template email berdasarkan event dan company_id
     */
    async getTemplate(event_key: string, company_id: number | null = null) {
        // Coba ambil template khusus departemen dulu
        let query = supabase
            .from('email_templates')
            .select('*')
            .eq('event_key', event_key)
            .eq('is_active', true);

        if (company_id) {
            const { data: deptTemplate } = await query.eq('company_id', company_id).single();
            if (deptTemplate) return deptTemplate;
        }

        // Jika tidak ada atau global, ambil yang global (company_id is null)
        const { data: globalTemplate } = await supabase
            .from('email_templates')
            .select('*')
            .eq('event_key', event_key)
            .is('company_id', null)
            .eq('is_active', true)
            .single();

        return globalTemplate;
    },

    /**
     * Mengambil konfigurasi SMTP global
     */
    async getSMTPConfig() {
        const { data, error } = await supabase
            .from('system_settings')
            .select('value')
            .eq('key', 'smtp_config')
            .single();
        
        if (error) {
            console.error('[EmailService] Error fetching SMTP config:', error);
            return null;
        }

        console.log('[EmailService] SMTP Config fetched:', data?.value ? 'Found' : 'Not Found');
        return data?.value || null;
    },

    /**
     * Fungsi utama untuk mengirim email
     */
    async triggerEmail(payload: EmailPayload) {
        try {
            console.log(`[EmailService] Triggering email for event: ${payload.event_key} to ${payload.recipient_email}`);
            
            // 1. Ambil Template
            const template = await this.getTemplate(payload.event_key, payload.company_id);
            if (!template) {
                console.warn(`[EmailService] No template found for event: ${payload.event_key}`);
                return { success: false, error: 'Template not found' };
            }

            // 2. Ambil SMTP Config
            const smtp = await this.getSMTPConfig();
            if (!smtp) {
                console.error('[EmailService] SMTP configuration missing in system_settings');
                return { success: false, error: 'SMTP config missing' };
            }

            // 3. Proses Placeholders (Replace {key} with value)
            let subject = template.subject;
            let body = template.body;

            Object.entries(payload.placeholders).forEach(([key, value]) => {
                const regex = new RegExp(`{${key}}`, 'g');
                subject = subject.replace(regex, value || '');
                body = body.replace(regex, value || '');
            });

            // 4. Kirim ke Backend / Supabase Edge Function
            // Karena kita di frontend (React), kita tidak bisa kirim SMTP langsung.
            // Kita akan panggil Edge Function Supabase 'send-email'
            const { data, error } = await supabase.functions.invoke('send-email', {
                body: {
                    to: payload.recipient_email,
                    subject: subject,
                    html: body,
                    smtp_config: smtp // Kita kirim config SMTP-nya juga
                }
            });

            if (error) {
                console.error('[EmailService] Failed to invoke send-email function:', error);
                // Fallback: Log ke console untuk simulasi jika function belum ada
                console.log('--- SIMULATED EMAIL ---');
                console.log('To:', payload.recipient_email);
                console.log('Subject:', subject);
                console.log('Body:', body);
                console.log('-----------------------');
                return { success: true, simulated: true };
            }

            return { success: true, data };

        } catch (err) {
            console.error('[EmailService] Error in triggerEmail:', err);
            return { success: false, error: err };
        }
    }
};
