import https from 'https';
import fs from 'fs';

const config = {
    url: 'https://vaoyksgpfkujugjaplke.supabase.co/rest/v1',
    key: 'sb_publishable_SDVFd0Ta40bkWLm7Wr1Fsg_sHnK7rHG'
};

const options = {
    headers: { 'apikey': config.key, 'Authorization': `Bearer ${config.key}` }
};

async function debug() {
    const menus = await fetch(`${config.url}/menus`, options).then(r => r.json());
    const userId = 'a602a9f6-e144-49f5-8d21-fa0419a2b465';
    const custom = await fetch(`${config.url}/user_menu_permissions?user_id=eq.${userId}`, options).then(r => r.json());

    let output = '--- ALL MENUS IN DB ---\n';
    menus.forEach(m => output += `- ${m.label} (${m.id})\n`);

    output += '\n--- CUSTOM PERMS FOR USER ---\n';
    custom.forEach(c => {
        const m = menus.find(m => m.id === c.menu_key);
        output += `- ${m ? m.label : c.menu_key} (can_view: ${c.can_view})\n`;
    });

    fs.writeFileSync('full_debug_results.txt', output);
    console.log('Results written to full_debug_results.txt');
}

debug();
