module.exports = {
  name: 'ping',
  description: 'Check bot response time',
  async execute(sock, msg, args, { isGroup, isOwner }) {
    const start = Date.now();
    await sock.sendMessage(msg.key.remoteJid, { text: '👑its-phestone||rolling...' });
    const end = Date.now();
    await sock.sendMessage(msg.key.remoteJid, { 
      text: `🏓 Pong! Latency: ${end - start}ms`,
      edit: msg.key // edit the previous message (Baileys feature)
    });
  }
};