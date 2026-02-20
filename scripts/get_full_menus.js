import https from 'https';

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
    console.log('--- FINAL MENU LIST ---');
    menus.forEach(m => {
        console.log(`ID: ${m.id} | Label: ${m.label}`);
    });
}
run();
