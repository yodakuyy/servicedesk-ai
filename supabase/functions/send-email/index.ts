import { SmtpClient } from "https://deno.land/x/smtp@v0.7.0/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { to, subject, html, smtp_config } = await req.json()

    if (!smtp_config) {
      throw new Error('Konfigurasi SMTP tidak ditemukan.')
    }

    const client = new SmtpClient()
    const port = Number(smtp_config.port)

    const host = (smtp_config.host || "").trim();
    console.log(`Mencoba koneksi ke ${host} port ${port}...`)

    await client.connect({
      hostname: host,
      port: port,
      username: (smtp_config.user || "").trim(),
      password: smtp_config.password, // Tanpa trim buat password biar aman
      tls: port === 465, 
    })

    await client.send({
      from: (smtp_config.from_email || smtp_config.user || "").trim(),
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
    console.error("SMTP Error Detail:", error)
    
    let detail = error.message;
    if (detail.includes("os error 111")) {
      detail = "Koneksi Ditolak Microsoft. Coba ganti Host di Settings jadi 'smtp-mail.outlook.com' atau hubungi IT buat buka akses SMTP AUTH.";
    }

    return new Response(JSON.stringify({ 
      error: error.message,
      detail: detail
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
