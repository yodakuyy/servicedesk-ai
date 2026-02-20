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
        const match = menus.find(m => m.label.toLowerCase().includes('dash'));
        console.log('Match found:', match);

        // Find all menus for role 2 again
        fetch(`${config.url}/role_menu_permissions?role_id=eq.2&can_view=eq.true`, options)
            .then(r => r.json())
            .then(perms => {
                console.log('Role 2 Permissions IDs:', perms.map(p => p.menu_id));
            });
    });
