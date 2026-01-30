import https from 'https';
import fs from 'fs';

const config = {
    url: 'https://vaoyksgpfkujugjaplke.supabase.co/rest/v1',
    key: 'sb_publishable_SDVFd0Ta40bkWLm7Wr1Fsg_sHnK7rHG'
};

const options = {
    headers: { 'apikey': config.key, 'Authorization': `Bearer ${config.key}` }
};

async function checkReservedTickets() {
    const statuses = await fetch(`${config.url}/ticket_statuses?select=status_id,status_name`, options).then(r => r.json());
    const resolvedStatus = statuses.find(s => s.status_name === 'Resolved');

    if (!resolvedStatus) return;

    const res = await fetch(`${config.url}/tickets?status_id=eq.${resolvedStatus.status_id}&select=ticket_number,subject,updated_at,id`, options);
    const tickets = await res.json();

    const now = new Date();
    let report = `Check Time: ${now.toLocaleString()}\n\n`;

    if (tickets.length === 0) {
        report += 'No tickets found in Resolved status.';
    } else {
        tickets.forEach(t => {
            const updatedAt = new Date(t.updated_at);
            const diffHours = (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60);
            const remainingHours = 24 - diffHours;

            if (diffHours >= 24) {
                report += `[OVERDUE FOR CLOSE] ${t.ticket_number}: ${t.subject}\n   - Resolved since: ${updatedAt.toLocaleString()}\n   - Elapsed: ${diffHours.toFixed(1)} hours\n\n`;
            } else {
                report += `[STILL IN RESOLVED] ${t.ticket_number}: ${t.subject}\n   - Resolved since: ${updatedAt.toLocaleString()}\n   - Self-closing in: ${remainingHours.toFixed(1)} hours\n\n`;
            }
        });
    }

    fs.writeFileSync('auto_close_report.txt', report);
    console.log('Report generated in auto_close_report.txt');
}

checkReservedTickets();
