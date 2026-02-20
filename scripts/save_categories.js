import https from 'https';
import fs from 'fs';
const config = {
    url: 'https://vaoyksgpfkujugjaplke.supabase.co/rest/v1',
    key: 'sb_publishable_SDVFd0Ta40bkWLm7Wr1Fsg_sHnK7rHG'
};
function get(path) {
    return new Promise((resolve) => {
        https.get(`${config.url}${path}`, { headers: { 'apikey': config.key, 'Authorization': `Bearer ${config.key}` } }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
        });
    });
}
async function run() {
    const categories = await get('/ticket_categories?select=id,name,parent_id');
    let out = '--- MASTER TICKET CATEGORIES ---\n';
    categories.forEach(c => {
        out += `ID: ${c.id} | Name: ${c.name} | Parent: ${c.parent_id}\n`;
    });
    fs.writeFileSync('categories_full.txt', out);
    console.log('Saved to categories_full.txt');
}
run();
