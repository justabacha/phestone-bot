const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const Groq = require('groq-sdk');
const config = require('../config');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Known language codes supported by Whisper
const SUPPORTED_LANGUAGES = ['en', 'sw', 'auto'];

module.exports = {
    name: 'transcribe',
    description: 'Transcribe a voice note. Usage: !transcribe [en|sw] (default: auto-detect)',
    async execute(sock, msg, args) {
        const chatId = msg.key.remoteJid;
        
        // Get the quoted audio message
        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const audioMessage = quoted?.audioMessage;

        if (!audioMessage) {
            return; // Silent fail
        }

        // Determine language from arguments
        let language = args[0]?.toLowerCase();
        if (!SUPPORTED_LANGUAGES.includes(language)) {
            language = undefined; // Auto-detect
        }

        try {
            // Optional reaction to indicate processing
            await sock.sendMessage(chatId, { react: { text: '🎙️', key: msg.key } });

            // Download the audio
            const stream = await downloadContentFromMessage(audioMessage, 'audio');
            let buffer = Buffer.from([]);
            for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
            }

            // Create a File object for Groq
            const file = new File([buffer], 'audio.ogg', { type: 'audio/ogg' });

            // Prepare transcription options
            const options = {
                file,
                model: 'whisper-large-v3',
                response_format: 'json',
            };

            // Set language if specified
            if (language && language !== 'auto') {
                options.language = language;
            }

            // Include common words/phrases you use
            options.prompt = "Phestone, bro, niaje, poa, sawa, shughuli, maze, hiyo, kumbe, eeh, ngori, mbaya, freshi, baridi, manze, msee, msupa, chapo, mandazi, ugali, nyama, chai, pole, asante, karibu, twende, kesho, leo, jana, usiku, mchana, asubuhi, jioni, salama, safi, kabisa, kidogo, kubwa, mimi, wewe, yeye, sisi, nyinyi, wao, English, Kiswahili";

            // Call Groq API
            const transcription = await groq.audio.transcriptions.create(options);

            // Send the transcribed text
            await sock.sendMessage(chatId, { 
                text: `${config.branding} ||📝 *Transcription:*\n\n${transcription.text}` 
            }, { quoted: msg });

        } catch (e) {
            console.error('[TRANSCRIBE] Error:', e.message);
            const ownerJid = `${config.ownerNumbers[0]}@s.whatsapp.net`;
            await sock.sendMessage(ownerJid, { text: `⚠️Transcribe failed: ${e.message}` });
        }
    }
};