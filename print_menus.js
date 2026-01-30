import https from 'https';
const config = {
    url: 'https://vaoyksgpfkujugjaplke.supabase.co/rest/v1',
    key: 'sb_publishable_SDVFd0Ta40bkWLm7Wr1Fsg_sHnK7rHG'
};

const options = {
    headers: { 'apikey': config.key, 'Authorization': `Bearer ${config.key}` }
};

fetch(`${config.url}/menus?select=id,label`, options)
    .then(r => r.json())
    .then(menus => {
        console.log('--- ALL MENUS ---');
        menus.forEach(m => console.log(`${m.id}: ${m.label}`));
    });
