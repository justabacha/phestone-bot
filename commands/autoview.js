const settings = require('../core/settings');
const config = require('../config');

module.exports = {
    name: 'autoview',
    description: 'Configure auto status reactions',
    async execute(sock, msg, args) {
        const chatId = msg.key.remoteJid;
        const input = args.join(' ').toLowerCase();

        const updateAndReply = async (updates, message) => {
            for (const [key, value] of Object.entries(updates)) {
                settings.set(key, value);
            }
            await sock.sendMessage(chatId, { text: `${config.branding}\n\n${message}` }, { quoted: msg });
        };

        if (!input) {
            const react = settings.get('autoReact') ? 'ON' : 'OFF';
            const emojis = settings.get('reactEmojis') || [];
            return updateAndReply({},
                `✨ *Auto-Status React*\n` +
                `React: ${react}\n` +
                `Emojis: ${emojis.join(' ')}`
            );
        }

        if (input === 'on') {
            return updateAndReply({ autoReact: true }, `✨ Auto-React enabled.`);
        }
        if (input === 'off') {
            return updateAndReply({ autoReact: false }, `✨ Auto-React disabled.`);
        }
        if (input.startsWith('emojis')) {
            const emojiString = input.slice(6).trim();
            if (!emojiString) {
                return updateAndReply({}, `❌ Provide emojis separated by commas.\nExample: !autoview emojis 😂,🎭,❤️`);
            }
            const emojis = emojiString.split(',').map(e => e.trim()).filter(e => e);
            return updateAndReply({ reactEmojis: emojis }, `✅ Emoji pool updated: ${emojis.join(' ')}`);
        }

        return updateAndReply({}, `❌ Unknown option. Use: on/off, emojis <list>`);
    }
};