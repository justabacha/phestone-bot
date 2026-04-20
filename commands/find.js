const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const axios = require('axios');
const FormData = require('form-data');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const fs = require('fs');
const config = require('../config');

ffmpeg.setFfmpegPath(ffmpegPath);

module.exports = {
    name: 'find',
    description: 'Identify a song from a voice note or video (reply with !find)',
    async execute(sock, msg, args) {
        const chatId = msg.key.remoteJid;
        
        let mediaMessage = null;
        let mediaType = null;
        
        if (msg.message?.audioMessage) {
            mediaMessage = msg.message.audioMessage;
            mediaType = 'audio';
        } else if (msg.message?.videoMessage) {
            mediaMessage = msg.message.videoMessage;
            mediaType = 'video';
        } else if (msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.audioMessage) {
            mediaMessage = msg.message.extendedTextMessage.contextInfo.quotedMessage.audioMessage;
            mediaType = 'audio';
        } else if (msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.videoMessage) {
            mediaMessage = msg.message.extendedTextMessage.contextInfo.quotedMessage.videoMessage;
            mediaType = 'video';
        }
        
        if (!mediaMessage) {
            return sock.sendMessage(chatId, { 
                text: `${config.branding}\n\n❓Reply to a voice note or video clip with !find` 
            });
        }

        let tempInput = null;
        let tempOutput = null;
        
        try {
            await sock.sendMessage(chatId, { 
                text: `${config.branding}\n🎧 Listening closely...` 
            }, { quoted: msg });

            // Download media
            const stream = await downloadContentFromMessage(mediaMessage, mediaType);
            let buffer = Buffer.from([]);
            for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
            }
            console.log(`[FIND] Downloaded ${buffer.length} bytes`);

            // Save to temp file
            tempInput = `./temp_find_${Date.now()}.${mediaType === 'audio' ? 'ogg' : 'mp4'}`;
            tempOutput = `./temp_find_${Date.now()}.mp3`;
            fs.writeFileSync(tempInput, buffer);

            // Convert to MP3
            await new Promise((resolve, reject) => {
                ffmpeg(tempInput)
                    .toFormat('mp3')
                    .audioBitrate('128k')
                    .on('end', resolve)
                    .on('error', reject)
                    .save(tempOutput);
            });
            console.log(`[FIND] FFmpeg conversion complete`);

            const audioData = fs.readFileSync(tempOutput);
            console.log(`[FIND] MP3 size: ${audioData.length} bytes`);

            // Send to Audd.io
            const formData = new FormData();
            formData.append('api_token', process.env.AUDD_API_KEY);
            formData.append('file', audioData, { filename: 'audio.mp3' });
            // Optional: add return parameter
            formData.append('return', 'timecode,spotify,apple_music');

            const response = await axios.post('https://api.audd.io/', formData, {
                headers: formData.getHeaders()
            });

            console.log(`[FIND] Audd.io response status: ${response.data.status}`);
            if (response.data.error) {
                console.log(`[FIND] Audd.io error:`, response.data.error);
            }

            const data = response.data;

            if (data.status === 'success' && data.result) {
                const { title, artist, album, release_date } = data.result;
                const reply = `🎵 *SONG FOUND*\n\n` +
                                `*Title:* ${title}\n` +
                                `*Artist:* ${artist}\n` +
                                `*Album:* ${album || 'N/A'}\n` +
                                `*Released:* ${release_date || 'Unknown'}`;
                await sock.sendMessage(chatId, { text: `${config.branding}\n\n${reply}` }, { quoted: msg });
            } else if (data.status === 'error') {
                const errorMsg = data.error?.error_message || 'Unknown API error';
                console.error(`[FIND] Audd.io API error: ${errorMsg}`);
                await sock.sendMessage(chatId, { 
                    text: `${config.branding}\n\n❌API Error: ${errorMsg}` 
                });
            } else {
                // No match found
                console.log(`[FIND] No match found for audio`);
                await sock.sendMessage(chatId, { 
                    text: `${config.branding}\n\n❌Couldn't identify the song. Try a longer or clearer clip.` 
                });
            }

        } catch (e) {
            console.error('[FIND] Command error:', e.message);
            await sock.sendMessage(chatId, { 
                text: `${config.branding}\n\n⚠️Audio processing failed: ${e.message}` 
            });
        } finally {
            if (tempInput && fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
            if (tempOutput && fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput);
        }
    }
};