import https from 'https';
import fs from 'fs';

const config = {
    url: 'https://vaoyksgpfkujugjaplke.supabase.co/rest/v1',
    key: 'sb_publishable_SDVFd0Ta40bkWLm7Wr1Fsg_sHnK7rHG'
};

const options = {
    headers: { 'apikey': config.key, 'Authorization': `Bearer ${config.key}` }
};

async function getSLATargets() {
    const targets = await fetch(`${config.url}/sla_targets?select=*`, options).then(r => r.json());
    fs.writeFileSync('sla_targets.json', JSON.stringify(targets, null, 2));
    console.log('SLA targets written to sla_targets.json');
}

getSLATargets();
