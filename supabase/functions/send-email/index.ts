import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { SmtpClient } from "https://deno.land/x/smtp@v0.7.0/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { to, subject, html, smtp_config } = await req.json()

    if (!smtp_config) {
      throw new Error('SMTP Configuration is missing')
    }

    const client = new SmtpClient()

    // Connect to SMTP server
    await client.connectSync({
      hostname: smtp_config.host,
      port: parseInt(smtp_config.port),
      username: smtp_config.user,
      password: smtp_config.password,
      tls: smtp_config.encryption === 'tls' || smtp_config.port == 465,
    })

    // Send Email
    await client.send({
      from: smtp_config.from_email || smtp_config.user,
      to: to,
      subject: subject,
      content: html,
      html: html,
    })

    await client.close()

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error("Error sending email:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
