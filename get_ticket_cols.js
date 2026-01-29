import fs from 'fs';
const config = {
    url: 'https://vaoyksgpfkujugjaplke.supabase.co/rest/v1',
    key: 'sb_publishable_SDVFd0Ta40bkWLm7Wr1Fsg_sHnK7rHG'
};
async function run() {
    const res = await fetch(`${config.url}/tickets?select=*&limit=1`, {
        headers: { 'apikey': config.key, 'Authorization': `Bearer ${config.key}` }
    });
    const data = await res.json();
    if (data.length > 0) {
        fs.writeFileSync('ticket_cols.txt', JSON.stringify(Object.keys(data[0]), null, 2));
    }
}
run();
