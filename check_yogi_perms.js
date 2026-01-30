import https from 'https';
const config = {
    url: 'https://vaoyksgpfkujugjaplke.supabase.co/rest/v1',
    key: 'sb_publishable_SDVFd0Ta40bkWLm7Wr1Fsg_sHnK7rHG'
};

async function checkUserPerms() {
    // 1. Get Yogi Danis profile
    const profileRes = await fetch(`${config.url}/profiles?full_name=ilike.Yogi%20Danis&select=id`, {
        headers: { 'apikey': config.key, 'Authorization': `Bearer ${config.key}` }
    });
    const profiles = await profileRes.json();
    const userId = profiles[0]?.id;

    if (!userId) {
        console.log('User Yogi Danis not found');
        return;
    }

    console.log('User ID for Yogi Danis:', userId);

    // 2. Get custom perms
    const permRes = await fetch(`${config.url}/user_menu_permissions?user_id=eq.${userId}&can_view=eq.true&select=menu_key`, {
        headers: { 'apikey': config.key, 'Authorization': `Bearer ${config.key}` }
    });
    const perms = await permRes.json();
    console.log('Custom Permissions for Yogi Danis:', perms);

    // 3. Get all menus to match menu_key
    const menuRes = await fetch(`${config.url}/menus?select=id,label`, {
        headers: { 'apikey': config.key, 'Authorization': `Bearer ${config.key}` }
    });
    const menus = await menuRes.json();

    const customMenus = perms.map(p => {
        const menu = menus.find(m => m.id === p.menu_key);
        return menu ? menu.label : p.menu_key;
    });
    console.log('Custom Menu Labels:', customMenus);
}

checkUserPerms();
