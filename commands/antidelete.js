const settings = require('../core/settings');
const config = require('../config');

module.exports = {
  name: 'antidelete',
  description: 'Toggle anti-delete monitoring (all/group/private/off)',
  async execute(sock, msg, args) {
    const chatId = msg.key.remoteJid;
    const input = args.join(' ').toLowerCase();

    if (!input) {
      const current = settings.get('antidelete') || 'off';
      return sock.sendMessage(
        chatId,
        {
          text: `${config.branding}\n\n🛡️ *ANTIDELETE SYSTEM*\nCurrent mode: ${current.toUpperCase()}\n\n*Usage:*\n!antidelete group on/off\n!antidelete private on/off\n!antidelete all on/off\n!antidelete off`,
        },
        { quoted: msg }
      );
    }

    // Determine new mode
    let newMode = 'off';
    if (input.includes('off')) {
      newMode = 'off';
    } else if (input.includes('all')) {
      newMode = 'all';
    } else if (input.includes('group')) {
      newMode = 'group';
    } else if (input.includes('private')) {
      newMode = 'private';
    } else if (input.includes('on')) {
      newMode = 'all'; // Default 'on' to all
    } else {
      // If input not recognized, show help
      return sock.sendMessage(
        chatId,
        {
          text: `${config.branding}\n\n❌ Invalid mode. Use: all, group, private, off`,
        },
        { quoted: msg }
      );
    }

    // Save to settings.json
    settings.set('antidelete', newMode);

    // Response
    const statusEmoji = newMode === 'off' ? '🔴' : '🟢';
    const modeDisplay = newMode.toUpperCase();

    await sock.sendMessage(
      chatId,
      {
        text: `${config.branding}\n\n🛡️ *ANTIDELETE SYSTEM*\n━━━━━━━━━━━━━━━━━━━━\n● *Mode:* ${modeDisplay}\n● *Status:* ${statusEmoji}\n\n_Engine is now monitoring ${newMode === 'all' ? 'all chats' : newMode + 's'}._`,
      },
      { quoted: msg }
    );
  },
};