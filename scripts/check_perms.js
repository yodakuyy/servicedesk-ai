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
        const roles = await get('/roles?role_name=ilike.*Supervisor*&select=*');
        const supervisorRole = roles.find(r => r.role_name.includes('Agent Supervisor'));

        if (!supervisorRole) {
            console.log('Role not found');
            return;
        }

        const roleId = supervisorRole.role_id;
        const menus = await get('/menus?select=id,label');
        const perms = await get(`/role_menu_permissions?role_id=eq.${roleId}&can_view=eq.true&select=menu_id,sort_order`);

        console.log(`Role: ${supervisorRole.role_name} (ID: ${roleId})`);
        console.log('\nMenu Permissions in DB:');

        const menuPermissions = perms.map(p => {
            const menu = menus.find(m => m.id === p.menu_id);
            return {
                label: menu ? menu.label : 'Unknown',
                sort_order: p.sort_order
            };
        }).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

        menuPermissions.forEach((m, idx) => {
            console.log(`${idx + 1}. ${m.label}`);
        });

    } catch (err) {
        console.error(err);
    }
}

run();
