const config = require('../config');
const { loadCommands } = require('../handler');

module.exports = {
  name: 'help',
  description: 'Show all available commands',
  async execute(sock, msg, args) {
    const from = msg.key.remoteJid;
    const commands = loadCommands();
    
    let helpText = `${config.branding}\n\n`;
    helpText += `Prefix: \`${config.prefix}\`\n\n*Commands:*\n`;
    
    for (const [name, cmd] of commands) {
      helpText += `▸ *${config.prefix}${name}* - ${cmd.description || 'No description'}\n`;
    }
    
    // Send only ONE reply
    await sock.sendMessage(from, { text: helpText });
  }
};