import https from 'https';
const config = {
    url: 'https://vaoyksgpfkujugjaplke.supabase.co/rest/v1',
    key: 'sb_publishable_SDVFd0Ta40bkWLm7Wr1Fsg_sHnK7rHG'
};

async function checkMenus() {
    // 1. Get all menus
    const menuRes = await fetch(`${config.url}/menus?select=id,label`, {
        headers: { 'apikey': config.key, 'Authorization': `Bearer ${config.key}` }
    });
    const menus = await menuRes.json();
    console.log('All Menus:', menus);

    // 2. Get permissions for role_id 2
    const permRes = await fetch(`${config.url}/role_menu_permissions?role_id=eq.2&can_view=eq.true&select=menu_id`, {
        headers: { 'apikey': config.key, 'Authorization': `Bearer ${config.key}` }
    });
    const perms = await permRes.json();
    console.log('Permissions for Role 2:', perms);

    const allowedMenuIds = perms.map(p => p.menu_id);
    const allowedMenus = menus.filter(m => allowedMenuIds.includes(m.id)).map(m => m.label);
    console.log('Allowed Menu Labels for Role 2:', allowedMenus);
}

checkMenus();
