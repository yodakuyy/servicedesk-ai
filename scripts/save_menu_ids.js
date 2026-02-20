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
    const menus = await get('/menus?select=*');
    let out = '--- FULL MENU LIST ---\n';
    menus.forEach(m => {
        out += `ID: ${m.id} | Label: ${m.label}\n`;
    });
    fs.writeFileSync('menu_ids_raw.txt', out);
    console.log('Saved to menu_ids_raw.txt');
}
run();
