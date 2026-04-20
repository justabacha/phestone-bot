require('dotenv').config();
const fs = require('fs');                         // 👈 ADDED
const path = require('path');                     // 👈 ADDED
const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  DisconnectReason,
  delay,
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode-terminal');
const { handleMessages } = require('./handler');
const config = require('./config');

// === UNREAD COUNTER (ACCURATE & DEDUPLICATED) ===
let totalUnread = 0;
const chatUnreadMap = new Map();

function updateTotalUnread() {
  totalUnread = Array.from(chatUnreadMap.values()).reduce((sum, count) => sum + count, 0);
}
function getTotalUnread() {
  return totalUnread;
}
function setChatUnread(jid, count) {
  const cleanCount = typeof count === 'number' && count >= 0 ? count : 0;
  chatUnreadMap.set(jid, cleanCount);
  updateTotalUnread();
}
function attachUnreadTracker(sock) {
  sock.getTotalUnread = getTotalUnread;
}
function resetChatUnread(jid) {
  if (!jid) return;
  chatUnreadMap.set(jid, 0);
  updateTotalUnread();
}

// Logger: only show warnings and errors (no debug spam)
const logger = pino({ level: 'warn' });

// === SILENCE HARMLESS DECRYPTION NOISE ===
const originalEmit = process.emit;
process.emit = function (event, error) {
    if (event === 'warning') {
        if (error?.name === 'SessionError' && 
            (error?.message?.includes('No matching sessions') || 
             error?.message?.includes('Bad MAC'))) {
            return false;
        }
        if (error?.message?.includes('Failed to decrypt message') ||
            error?.message?.includes('Closing open session')) {
            return false;
        }
    }
    return originalEmit.apply(process, arguments);
};

const originalStdout = process.stdout.write;
process.stdout.write = function (chunk, encoding, callback) {
    const str = chunk.toString();
    if (str.includes('Failed to decrypt message') ||
        str.includes('Session error') ||
        str.includes('Bad MAC') ||
        str.includes('Closing open session') ||
        str.includes('No matching sessions found')) {
        return true;
    }
    return originalStdout.call(process.stdout, chunk, encoding, callback);
};
// ============================================

async function startBot() {
  try {
    const { state, saveCreds } = await useMultiFileAuthState('./session');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      version,
      logger,
      printQRInTerminal: false,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger),
      },
      browser: ['PHESTONE BOT', 'Chrome', '1.0.0'],
      syncFullHistory: false,
      shouldSyncHistoryMessage: () => false,
      generateHighQualityLinkPreview: true,
      markOnlineOnConnect: true,
    });

    // Attach unread tracker functions to the socket object
    attachUnreadTracker(sock);

    // 👇 FIX: Mark callback as async
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.clear();
        console.log('📱 Scan the QR code below:');
        qrcode.generate(qr, { small: true });
      }

      if (connection === 'open') {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✅ BOT CONNECTED SUCCESSFULLY!');
        console.log(`👑 Owner: ${config.ownerNumbers.join(', ')}`);
        console.log(`🎭its-phestone||rolling`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        // Send restart notification if flag exists
        const RESTART_FLAG_PATH = path.join(__dirname, '.restart_flag');
        if (fs.existsSync(RESTART_FLAG_PATH)) {
          try {
            const ownerJid = `${config.ownerNumbers[0]}@s.whatsapp.net`;
            await sock.sendMessage(ownerJid, { 
              text: `${config.branding}\n\n✅ *Bot is back online!*\nRestart completed successfully.` 
            });
            fs.unlinkSync(RESTART_FLAG_PATH);
          } catch (e) {
            console.error('Failed to send restart notification:', e.message);
          }
        }
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        if (shouldReconnect) {
          console.log(`⚠️ Connection closed. Reconnecting in 5 seconds...`);
          setTimeout(() => startBot(), 5000);
        } else {
          console.log('❌ Logged out. Delete the "session" folder and restart.');
          process.exit(1);
        }
      }
    });

    sock.ev.on('creds.update', saveCreds);

    // 🔥 INITIAL FULL SYNC (when bot starts)
    sock.ev.on('chats.set', ({ chats }) => {
      for (const chat of chats) {
        setChatUnread(chat.id, chat.unreadCount);
      }
      console.log(`[UNREAD] Initial sync: ${totalUnread} unread messages`);
    });

    // 🔄 LIVE UPDATES – WhatsApp's official unread counts
    sock.ev.on('chats.update', (updates) => {
      for (const update of updates) {
        if (typeof update.unreadCount === 'number') {
          setChatUnread(update.id, update.unreadCount);
        }
      }
    });

    // 📨 INCOMING MESSAGES – optimistic increment with deduplication
    sock.ev.on('messages.upsert', async ({ messages }) => {
      for (const msg of messages) {
        if (!msg.message) continue;

        const jid = msg.key.remoteJid;
        if (!jid || jid === 'status@broadcast') continue;

        // if YOU send message → mark chat as read
        if (msg.key.fromMe) {
          resetChatUnread(jid);
        }

        await handleMessages(sock, msg);
      }
    });

    return sock;
  } catch (err) {
    console.error('🔥 Fatal error:', err);
    console.log('Restarting in 10 seconds...');
    await delay(10000);
    startBot();
  }
}

startBot();

process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT. Shutting down gracefully...');
  process.exit(0);
});