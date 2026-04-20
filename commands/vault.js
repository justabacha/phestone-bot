const os = require('os');
const config = require('../config');

module.exports = {
  name: 'vault',
  description: 'Show system telemetry and bot status',
  async execute(sock, msg, args, { isGroup, isOwner }) {
    const chatId = msg.key.remoteJid;

    // --- TELEMETRY CALCULATIONS ---
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    
    const totalMem = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
    const freeMem = (os.freemem() / 1024 / 1024 / 1024).toFixed(2);
    const usedMem = (totalMem - freeMem).toFixed(2);
    
    const cpuLoad = os.loadavg()[0].toFixed(2);
    
    // Response time calculation with fallback
    const timestamp = msg.messageTimestamp 
      ? msg.messageTimestamp * 1000 
      : Date.now();
    const responseTime = ((Date.now() - timestamp) / 1000).toFixed(3);

    // --- CLEAN UI LAYOUT ---
    const vaultReport = `${config.branding}

┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃      its-phestone | *VAULT*      
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
┃ 🛰️ STATUS: its-phestone||connected.
┃ ⏱️ UPTIME: ${hours}h ${minutes}m
┃ 🧠 RAM: ${usedMem}GB / ${totalMem}GB
┃ 📉 CPU: ${cpuLoad}%
┃ 📁 CACHE: Ghosted (24h)
┃ 🌐 OS: ${os.platform()}
┃ ⚡ Response: ${responseTime}s
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

    // Send the message, quoting the original command message
    await sock.sendMessage(chatId, { text: vaultReport }, { quoted: msg });
  }
};