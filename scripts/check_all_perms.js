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
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error(`Failed to parse response from ${path}: ${data}`));
                }
            });
        }).on('error', reject);
    });
}

async function run() {
    try {
        const roles = await get('/roles?select=*');
        const menus = await get('/menus?select=*');
        const perms = await get(`/role_menu_permissions?can_view=eq.true&select=*`);

        console.log('--- ALL ROLES PERMISSIONS ---');

        roles.forEach(role => {
            const rolePerms = perms.filter(p => p.role_id === role.id || p.role_id === role.role_id);
            if (rolePerms.length > 0) {
                console.log(`\nRole: ${role.role_name} (ID: ${role.id || role.role_id})`);
                const sorted = rolePerms.map(p => {
                    const menu = menus.find(m => m.id === p.menu_id);
                    return { label: menu ? menu.label : 'Unknown', sort: p.sort_order };
                }).sort((a, b) => (a.sort || 0) - (b.sort || 0));

                sorted.forEach((m, idx) => {
                    console.log(`  ${idx + 1}. ${m.label}`);
                });
            }
        });

    } catch (err) {
        console.error(err);
    }
}

run();
