import https from 'https';
const config = {
    url: 'https://vaoyksgpfkujugjaplke.supabase.co/rest/v1',
    key: 'sb_publishable_SDVFd0Ta40bkWLm7Wr1Fsg_sHnK7rHG'
};
function get(path) {
    return new Promise((resolve, reject) => {
        https.get(`${config.url}${path}`, { headers: { 'apikey': config.key, 'Authorization': `Bearer ${config.key}` } }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
        });
    });
}
async function run() {
    const menus = await get('/menus?select=*');
    const targets = ['Dashboard', 'My Dashbord', 'Help Center', 'Service Requests', 'Incidents', 'Knowledge Base', 'Out of Office'];
    menus.forEach(m => {
        if (targets.includes(m.label)) {
            console.log(`LABEL: ${m.label} | ID: ${m.id}`);
        }
    });
}
run();
