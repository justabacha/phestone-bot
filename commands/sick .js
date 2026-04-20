const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const config = require('../config');

module.exports = {
    name: 'sick', 
    description: 'Stealth save a view-once media to your inbox',
    async execute(sock, msg, args) {
        const chatId = msg.key.remoteJid;
        const ownerJid = `${config.ownerNumbers[0]}@s.whatsapp.net`;

        // Get the quoted message (the one being replied to)
        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (!quoted) {
            // Silent fail – no reply to the sender
            return;
        }

        // Determine if it's a view-once image or video
        let mediaMessage = null;
        let mediaType = null;

        if (quoted.imageMessage?.viewOnce === true) {
            mediaMessage = quoted.imageMessage;
            mediaType = 'image';
        } else if (quoted.videoMessage?.viewOnce === true) {
            mediaMessage = quoted.videoMessage;
            mediaType = 'video';
        }

        if (!mediaMessage) {
            // Not a view-once media, silently ignore
            return;
        }

        try {
            // Download the media
            const stream = await downloadContentFromMessage(mediaMessage, mediaType);
            let buffer = Buffer.from([]);
            for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
            }

            // Forward to owner's private chat
            await sock.sendMessage(ownerJid, {
                [mediaType]: buffer,
                caption: `${config.branding}\n🎥 *View-Once Saved*\nFrom: @${msg.key.participant?.split('@')[0] || chatId.split('@')[0]}`,
                mentions: [msg.key.participant || chatId]
            });

           // await sock.sendMessage(chatId, { react: { text: '👀', key: msg.key } });

        } catch (e) {
            console.error('[VONCE] Save failed:', e.message);
            // Send error only to owner
            await sock.sendMessage(ownerJid, { text: `${config.branding}\n\n⚠️ View-once save failed: ${e.message}` });
        }
    }
};