const fs = require('fs');
const path = require('path');
const config = require('../config');

// Path to a temporary flag file
const RESTART_FLAG_PATH = path.join(__dirname, '../.restart_flag');

module.exports = {
    name: 'restart',
    description: 'Restart the bot (owner only)',
    async execute(sock, msg, args, { isOwner }) {
        if (!isOwner) return;

        const chatId = msg.key.remoteJid;
        await sock.sendMessage(chatId, { text: `${config.branding}\n\n♻️Restarting...` }, { quoted: msg });

        // Write a flag file so we know this was an intentional restart
        try {
            fs.writeFileSync(RESTART_FLAG_PATH, '1');
        } catch (e) {
            // Ignore errors – the flag is a nice-to-have
        }

        // Give time for the message to send before exiting
        setTimeout(() => {
            process.exit(0);
        }, 1000);
    }
};