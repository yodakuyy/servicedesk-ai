import https from 'https';

const config = {
    url: 'https://vaoyksgpfkujugjaplke.supabase.co/rest/v1',
    key: 'sb_publishable_SDVFd0Ta40bkWLm7Wr1Fsg_sHnK7rHG'
};

function get(path) {
    return new Promise((resolve, reject) => {
        const options = {
            headers: {
                'apikey': config.key,
                'Authorization': `Bearer ${config.key}`
            }
        };
        https.get(`${config.url}${path}`, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
        }).on('error', reject);
    });
}

async function run() {
    const menus = await get('/menus?select=*');
    console.log('--- ALL MENUS IN DB ---');
    menus.forEach(m => {
        console.log(`ID: ${m.id} | Label: ${m.label} | Name: ${m.name || m.menu_name}`);
    });
}
run();
