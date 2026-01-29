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
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve(parsed);
                } catch (e) {
                    reject(new Error(`Failed to parse: ${data}`));
                }
            });
        }).on('error', reject);
    });
}

async function run() {
    try {
        const roles = await get('/roles?select=*');
        const menus = await get('/menus?select=*');
        const perms = await get('/role_menu_permissions?select=*');

        const supervisorRole = roles.find(r => r.role_name.includes('Supervisor'));
        if (!supervisorRole) {
            console.log('Role Supervisor not found');
            return;
        }

        console.log(`Checking Role: ${supervisorRole.role_name} (ID: ${supervisorRole.role_id || supervisorRole.id})`);

        const supervisorPerms = perms.filter(p => p.role_id === (supervisorRole.role_id || supervisorRole.id));

        console.log('\nMenu Permissions in role_menu_permissions table:');
        menus.forEach(menu => {
            const p = supervisorPerms.find(p => p.menu_id === menu.id);
            const status = p ? (p.can_view ? '[V]' : '[ ]') : '[MISSING]';
            console.log(`${status} | ${menu.label || menu.menu_name}`);
        });

    } catch (err) {
        console.error(err);
    }
}
run();
