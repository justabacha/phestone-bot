const fs = require('fs');
const path = require('path');
const config = require('./config');
const settings = require('./core/settings');
const Groq = require('groq-sdk');
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const autoPilotTimers = new Map();

// --- MESSAGE CACHE FOR ANTIDELETE ---
const messageStore = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [id, data] of messageStore.entries()) {
    if (now - data.timestamp > 300000) messageStore.delete(id);
  }
}, 60000);

// --- COMMAND CACHE ---
let commandsCache = null;
const processedMessages = new Set();

function loadCommands() {
  if (commandsCache) return commandsCache;
  const commands = new Map();
  const cmdPath = path.join(__dirname, 'commands');
  if (!fs.existsSync(cmdPath)) {
    fs.mkdirSync(cmdPath, { recursive: true });
    return commands;
  }
  const files = fs.readdirSync(cmdPath).filter(f => f.endsWith('.js'));
  for (const file of files) {
    try {
      const cmd = require(path.join(cmdPath, file));
      if (cmd.name) commands.set(cmd.name.toLowerCase(), cmd);
    } catch (err) {
      console.error(`Failed to load ${file}:`, err.message);
    }
  }
  commandsCache = commands;
  console.log(`📦 Loaded ${commands.size} commands.`);
  return commands;
}

// --- MAIN HANDLER ---
async function handleMessages(sock, msg) {
  try {
    // Prevent duplicate processing
    if (processedMessages.has(msg.key.id)) return;
    processedMessages.add(msg.key.id);
    setTimeout(() => processedMessages.delete(msg.key.id), 60000);

    const from = msg.key.remoteJid;
    if (!from) return;

    // Skip status broadcasts entirely (no handling needed)
    if (from === 'status@broadcast') return;

    const isGroup = from.endsWith('@g.us');
    const sender = isGroup ? msg.key.participant : from;
    const isOwner = config.ownerNumbers.some(num => sender.includes(num)) || msg.key.fromMe;

    // --- STORE MESSAGE FOR ANTIDELETE ---
    if (msg.key.id) {
      let text = '';
      if (msg.message?.conversation) text = msg.message.conversation;
      else if (msg.message?.extendedTextMessage?.text) text = msg.message.extendedTextMessage.text;
      else if (msg.message?.imageMessage?.caption) text = msg.message.imageMessage.caption;
      else if (msg.message?.videoMessage?.caption) text = msg.message.videoMessage.caption;
      else if (msg.message?.documentMessage?.caption) text = msg.message.documentMessage.caption;
      else if (msg.message?.audioMessage) text = '[Audio]';
      else if (msg.message?.stickerMessage) text = '[Sticker]';
      else if (msg.message?.imageMessage) text = '[Image]';
      else if (msg.message?.videoMessage) text = '[Video]';
      else text = '[Media]';

      messageStore.set(msg.key.id, {
        key: msg.key,
        text,
        fromMe: msg.key.fromMe || false,
        remoteJid: from,
        participant: sender,
        timestamp: Date.now()
      });
    }

    // --- ANTIDELETE DETECTION (via protocolMessage) ---
    if (msg.message?.protocolMessage?.type === 0) {
      const mode = settings.get('antidelete') || 'off';
      if (mode !== 'off') {
        const deletedKey = msg.message.protocolMessage.key;
        const ghost = messageStore.get(deletedKey.id);
        if (ghost && !ghost.fromMe) {
          const chatIsGroup = deletedKey.remoteJid?.endsWith('@g.us');
          const shouldFire =
            mode === 'all' ||
            (mode === 'group' && chatIsGroup) ||
            (mode === 'private' && !chatIsGroup);
          if (shouldFire) {
            const reportSender = ghost.participant || ghost.remoteJid;
            const location = chatIsGroup ? 'Group Chat' : 'Private Chat';
            let report = `${config.branding}\n\n`;
            report += `*🚨 SILENT LOG: ANTIDELETE 🚨*\n`;
            report += `━━━━━━━━━━━━━━━━━━━━\n`;
            report += `👤 *From:* @${reportSender.split('@')[0]}\n`;
            report += `📍 *Where:* ${location}\n`;
            report += `💬 *Message:* ${ghost.text}`;

            const ownerJid = `${config.ownerNumbers[0]}@s.whatsapp.net`;
            await sock.sendMessage(ownerJid, { text: report, mentions: [reportSender] });
          }
        }
      }
    }

    // --- AUTO-PILOT (private chats only, owner away) ---
    if (!isGroup && !msg.key.fromMe) {
      const activeChats = settings.get('autopilot') || [];
      if (activeChats.includes(from)) {
        if (autoPilotTimers.has(from)) {
          clearTimeout(autoPilotTimers.get(from));
          autoPilotTimers.delete(from);
        }
        
        let userText = '';
        if (msg.message?.conversation) userText = msg.message.conversation;
        else if (msg.message?.extendedTextMessage?.text) userText = msg.message.extendedTextMessage.text;
        
        if (userText && userText.length > 2) {
          const timer = setTimeout(async () => {
            try {
              const response = await groq.chat.completions.create({
                messages: [
                  { 
                    role: "system", 
                    content: process.env.MY_PERSONA || 'You are Phestone. You reply casually like a real person, not an assistant. Keep it brief and natural.'
                  },
                  { 
                    role: "user", 
                    content: `Reply to this message as if you're me (Phestone). Message: "${userText}"\n\nKeep it short and in my voice.` 
                  }
                ],
                model: "llama-3.3-70b-versatile",
                temperature: 0.8,
                max_tokens: 100,
              });
              const aiReply = response.choices[0]?.message?.content;
              if (aiReply) {
                await sock.sendMessage(from, { text: `${config.branding}||●Digital Twin\n\n${aiReply}` });
              }
            } catch (e) {
              console.error('Auto-pilot AI error:', e.message);
            }
            autoPilotTimers.delete(from);
          }, 120000);
          
          autoPilotTimers.set(from, timer);
        }
      }
    }

    // --- COMMAND HANDLING (owner‑only) ---
    if (!isOwner) return;

    let body = '';
    if (msg.message?.conversation) body = msg.message.conversation;
    else if (msg.message?.extendedTextMessage?.text) body = msg.message.extendedTextMessage.text;
    else if (msg.message?.imageMessage?.caption) body = msg.message.imageMessage.caption;
    else if (msg.message?.videoMessage?.caption) body = msg.message.videoMessage.caption;
    if (!body) return;

    const prefix = config.prefix;
    if (!body.startsWith(prefix)) return;
    const afterPrefix = body.slice(prefix.length);
    if (afterPrefix.startsWith(' ') || afterPrefix === '') return;

    const args = afterPrefix.trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    const commands = loadCommands();
    const command = commands.get(commandName);
    if (!command) return;

    try {
      await command.execute(sock, msg, args, { isGroup, isOwner, sender });
    } catch (err) {
      console.error(`Command error (${commandName}):`, err);
    }
  } catch (err) {
    console.error('Handler error:', err);
  }
}

module.exports = { handleMessages, loadCommands };