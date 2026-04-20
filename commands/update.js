const { exec } = require('child_process');
const config = require('../config');

module.exports = {
    name: 'update',
    description: 'Pull latest code from GitHub and reconnect (owner only)',
    async execute(sock, msg, args, { isOwner }) {
        if (!isOwner) return;

        const chatId = msg.key.remoteJid;
        await sock.sendMessage(chatId, { text: `${config.branding}\n\n🔄 Pulling updates from GitHub...` }, { quoted: msg });

        exec('git pull', async (error, stdout, stderr) => {
            let response = '';
            if (error) {
                response = `❌ Git pull failed:\n${stderr || error.message}`;
            } else {
                response = `✅ Updates pulled:\n${stdout || 'Already up to date.'}`;
                response += `\n\n♻️ Reconnecting WhatsApp...`;
            }

            await sock.sendMessage(chatId, { text: `${config.branding}\n\n${response}` });

            if (!error) {
                // Soft reconnect – keeps process alive
                try {
                    sock.ws?.close(); // Triggers auto-reconnect
                } catch (e) {
                    console.error('Reconnect error:', e);
                }
            }
        });
    }
};