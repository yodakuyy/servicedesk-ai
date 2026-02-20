import https from 'https';
const config = {
    url: 'https://vaoyksgpfkujugjaplke.supabase.co/rest/v1',
    key: 'sb_publishable_SDVFd0Ta40bkWLm7Wr1Fsg_sHnK7rHG'
};

async function listMenus() {
    const res = await fetch(`${config.url}/menus?select=id,label`, {
        headers: { 'apikey': config.key, 'Authorization': `Bearer ${config.key}` }
    });
    const menus = await res.json();
    console.log(JSON.stringify(menus, null, 2));
}

listMenus();
