import https from 'https';
const config = {
    url: 'https://vaoyksgpfkujugjaplke.supabase.co/rest/v1',
    key: 'sb_publishable_SDVFd0Ta40bkWLm7Wr1Fsg_sHnK7rHG'
};

const options = {
    headers: { 'apikey': config.key, 'Authorization': `Bearer ${config.key}` }
};

async function inspectTables() {
    const tickets = await fetch(`${config.url}/tickets?select=*&limit=1`, options).then(r => r.json());
    console.log('Tickets Columns:', Object.keys(tickets[0] || {}));

    const policies = await fetch(`${config.url}/sla_policies?select=*&limit=1`, options).then(r => r.json());
    console.log('SLA Policies Columns:', Object.keys(policies[0] || {}));

    // Check if sla_management table exists (user mentioned it)
    const mgmt = await fetch(`${config.url}/sla_management?select=*&limit=1`, options).then(r => r.json());
    console.log('SLA Management Columns:', Object.keys(mgmt[0] || {}));
}

inspectTables();
