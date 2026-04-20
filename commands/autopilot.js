const settings = require('../core/settings');
const config = require('../config');

module.exports = {
    name: 'autopilot',
    description: 'Toggle AI auto‑reply when you are away (private chats only)',
    async execute(sock, msg, args) {
        const chatId = msg.key.remoteJid;
        
        // Load current autopilot list
        let activeChats = settings.get('autopilot') || [];
        
        if (activeChats.includes(chatId)) {
            activeChats = activeChats.filter(id => id !== chatId);
            settings.set('autopilot', activeChats);
            return sock.sendMessage(chatId, { text: `${config.branding}\n🛑 Auto‑Pilot deactivated for this chat.\nWelcome back Boss!` });
        } else {
            activeChats.push(chatId);
            settings.set('autopilot', activeChats);
            return sock.sendMessage(chatId, { text: `${config.branding}\n🤖 Auto‑Pilot ACTIVATED.\nI'll step in if you're gone for 2 mins Boss!` });
        }
    }
};