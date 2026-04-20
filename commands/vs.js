const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const config = require('../config');

module.exports = {
    name: 'vs',
    description: 'Save a replied-to status to your inbox',
    async execute(sock, m, args) {
        // Owner's private chat JID – used for all text feedback
        const ownerJid = `${config.ownerNumbers[0]}@s.whatsapp.net`;
        const from = m.key.remoteJid;

        try {
            const contextInfo = m.message?.extendedTextMessage?.contextInfo;
            const quoted = contextInfo?.quotedMessage;

            if (!quoted) {
                // Silent reaction only, error goes to owner
                await sock.sendMessage(from, { react: { text: '❌', key: m.key } });
                return sock.sendMessage(ownerJid, { text: `${config.branding}\n\n❌ *Error:* Reply to a status with !vs` });
            }

            const mediaType = quoted.imageMessage ? 'image' : quoted.videoMessage ? 'video' : null;
            const statusOwner = contextInfo.participant || '';

            // React with progress (visible to status contact)
            await sock.sendMessage(from, { react: { text: '⏳', key: m.key } });

            if (mediaType) {
                const mediaMessage = quoted[`${mediaType}Message`];
                const stream = await downloadContentFromMessage(mediaMessage, mediaType);
                
                let buffer = Buffer.from([]);
                for await (const chunk of stream) {
                    buffer = Buffer.concat([buffer, chunk]);
                }

                const caption = `${config.branding}\n\n*🎬 STATUS SAVED 🎬*\n━━━━━━━━━━━━━━━━━━━━\n👤 *Owner:* @${statusOwner.split('@')[0]}\n💬 *Caption:* ${mediaMessage.caption || 'No caption'}`;

                await sock.sendMessage(ownerJid, {
                    [mediaType]: buffer,
                    caption: caption,
                    mentions: [statusOwner]
                });
            } else {
                const statusText = quoted.conversation || quoted.extendedTextMessage?.text || 'Empty';
                const report = `${config.branding}\n\n*📝 TEXT STATUS SAVED 📝*\n━━━━━━━━━━━━━━━━━━━━\n👤 *Owner:* @${statusOwner.split('@')[0]}\n\n*Content:*\n${statusText}`;

                await sock.sendMessage(ownerJid, { text: report, mentions: [statusOwner] });
            }

            // Success reaction (visible to status contact)
            await sock.sendMessage(from, { react: { text: '✅', key: m.key } });

        } catch (err) {
            console.error('> Engine | SAVE Error:', err);
            // Silent reaction for the status contact
            await sock.sendMessage(from, { react: { text: '⚠️', key: m.key } });
            // Error details only to you
            await sock.sendMessage(ownerJid, { text: `${config.branding}\n\n❌ *Failed to save status.*\n\nError: ${err.message || 'Media might have expired.'}` });
        }
    }
};