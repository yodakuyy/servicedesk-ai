import https from 'https';
const config = {
    url: 'https://vaoyksgpfkujugjaplke.supabase.co/rest/v1',
    key: 'sb_publishable_SDVFd0Ta40bkWLm7Wr1Fsg_sHnK7rHG'
};

const options = {
    headers: { 'apikey': config.key, 'Authorization': `Bearer ${config.key}` }
};

async function checkReservedTickets() {
    // 1. Get status IDs
    const statuses = await fetch(`${config.url}/ticket_statuses?select=status_id,status_name`, options).then(r => r.json());
    const resolvedStatus = statuses.find(s => s.status_name === 'Resolved');
    const closedStatus = statuses.find(s => s.status_name === 'Closed');

    if (!resolvedStatus) {
        console.log('Resolved status not found');
        return;
    }

    console.log(`Resolved Status ID: ${resolvedStatus.status_id}`);

    // 2. Fetch Resolved tickets
    const res = await fetch(`${config.url}/tickets?status_id=eq.${resolvedStatus.status_id}&select=ticket_number,subject,updated_at,id`, options);
    const tickets = await res.json();

    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));

    console.log('\n--- TICKETS IN RESOLVED STATUS ---');

    if (tickets.length === 0) {
        console.log('No tickets found in Resolved status.');
    }

    tickets.forEach(t => {
        const updatedAt = new Date(t.updated_at);
        const diffMs = now.getTime() - updatedAt.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);
        const remainingHours = 24 - diffHours;

        if (diffHours >= 24) {
            console.log(`[SHOULD BE CLOSED] ${t.ticket_number}: ${t.subject} (Resolved ${diffHours.toFixed(1)} hours ago)`);
        } else {
            console.log(`[PENDING CLOSE] ${t.ticket_number}: ${t.subject} (Closes in ${remainingHours.toFixed(1)} hours)`);
        }
    });
}

checkReservedTickets();
