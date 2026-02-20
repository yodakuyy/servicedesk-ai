import https from 'https';
import fs from 'fs';

const config = {
    url: 'https://vaoyksgpfkujugjaplke.supabase.co/rest/v1',
    key: 'sb_publishable_SDVFd0Ta40bkWLm7Wr1Fsg_sHnK7rHG'
};

const options = {
    headers: { 'apikey': config.key, 'Authorization': `Bearer ${config.key}` }
};

async function debugSLA() {
    let report = "";

    // 1. Tickets columns
    const tickets = await fetch(`${config.url}/tickets?select=*&limit=1`, options).then(r => r.json());
    report += "TICKETS COLUMNS:\n" + JSON.stringify(Object.keys(tickets[0] || {}), null, 2) + "\n\n";

    // 2. SLA Policies
    const policies = await fetch(`${config.url}/sla_policies?select=*`, options).then(r => r.json());
    report += "SLA POLICIES:\n" + JSON.stringify(policies, null, 2) + "\n\n";

    // 3. SLA Management? (checking if it exists)
    try {
        const mgmt = await fetch(`${config.url}/sla_management?select=*`, options).then(r => r.json());
        report += "SLA MANAGEMENT:\n" + JSON.stringify(mgmt, null, 2) + "\n\n";
    } catch (e) {
        report += "SLA MANAGEMENT: Table not found or error: " + e.message + "\n\n";
    }

    fs.writeFileSync('sla_debug.txt', report);
    console.log('SLA debug info written to sla_debug.txt');
}

debugSLA();
