import https from 'https';
const config = {
    url: 'https://vaoyksgpfkujugjaplke.supabase.co/rest/v1',
    key: 'sb_publishable_SDVFd0Ta40bkWLm7Wr1Fsg_sHnK7rHG'
};

async function patchTicket() {
    // 1. Cari ID Dedi Septiadi
    const userRes = await fetch(`${config.url}/profiles?email=eq.dedi.septiadi@modena.com&select=id`, {
        headers: { 'apikey': config.key, 'Authorization': `Bearer ${config.key}` }
    });
    const userData = await userRes.json();
    const dediId = userData[0]?.id;

    if (!dediId) {
        console.log('Dedi ID not found!');
        return;
    }

    console.log('Found Dedi ID:', dediId);

    // 2. Cari tiket terakhir yang dibuat (yang mungkin masih pakai requester_id Admin)
    // Kita update requester_id nya jadi dediId agar muncul di list Dedi
    const updateRes = await fetch(`${config.url}/tickets?subject=ilike.*More 2 error*&select=id`, {
        method: 'PATCH',
        headers: {
            'apikey': config.key,
            'Authorization': `Bearer ${config.key}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        },
        body: JSON.stringify({ requester_id: dediId })
    });

    const updateData = await updateRes.json();
    console.log('Ticket Updated:', updateData);
}

patchTicket();
