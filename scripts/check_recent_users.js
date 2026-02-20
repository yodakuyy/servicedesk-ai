import fs from 'fs';
const config = {
    url: 'https://vaoyksgpfkujugjaplke.supabase.co/rest/v1',
    key: 'sb_publishable_SDVFd0Ta40bkWLm7Wr1Fsg_sHnK7rHG'
};
async function run() {
    const res = await fetch(`${config.url}/profiles?select=email,full_name,role_id,status,created_at&order=created_at.desc&limit=10`, {
        headers: { 'apikey': config.key, 'Authorization': `Bearer ${config.key}` }
    });
    const data = await res.json();
    fs.writeFileSync('recent_users.txt', JSON.stringify(data, null, 2));
    console.log('Saved to recent_users.txt');
}
run();
