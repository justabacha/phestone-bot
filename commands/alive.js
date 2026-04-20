const { exec } = require('child_process');
const config = require('../config');

const formatUptime = (seconds) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
    
    return parts.join(' ');
};

const getOutdatedCount = () => {
    return new Promise((resolve) => {
        exec('npm outdated --json', (error, stdout) => {
            if (error && error.code === 1) {
                try {
                    const outdated = JSON.parse(stdout);
                    resolve(Object.keys(outdated).length);
                } catch (e) {
                    resolve(0);
                }
            } else {
                resolve(0);
            }
        });
    });
};

module.exports = {
    name: 'alive',
    description: 'Shows bot status, uptime, and updates',
    async execute(sock, msg) {
        const chatId = msg.key.remoteJid;

        const uptimePretty = formatUptime(process.uptime());

        const now = new Date();
        const dateString = now.toLocaleDateString('en-GB', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });

        // Get total unread from our custom tracker
        let totalUnread = 0;
        try {
            if (typeof sock.getTotalUnread === 'function') {
                totalUnread = sock.getTotalUnread();
            } else {
                totalUnread = '?';
            }
        } catch (e) {
            console.error('[ALIVE] Failed to get unread count:', e.message);
            totalUnread = '?';
        }

        const outdatedCount = await getOutdatedCount();
        const updateMessage = outdatedCount > 0
            ? `📦 *${outdatedCount} Major Update${outdatedCount !== 1 ? 's' : ''} available*`
            : `📦 *All packages up to date*`;

        const aliveMessage = `Hey, I'm Ryan, Phestone's WhatsApp Assistant.
━━━━━━━━━━━━━━━━━━━━
⏳ *Uptime:* ${uptimePretty}
📅 *${dateString}*
📨 *Unread messages:* ${totalUnread}
${updateMessage}
━━━━━━━━━━━━━━━━━━━━
${config.branding}`;

        await sock.sendMessage(chatId, { text: aliveMessage }, { quoted: msg });
    }
};