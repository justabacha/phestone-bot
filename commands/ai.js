const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const Groq = require('groq-sdk');
const config = require('../config');

// Initialize Groq with API key from environment variable
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

module.exports = {
    name: 'phesty',
    description: 'Ask AI a question or analyze an image (reply to an image with !phesty)',
    async execute(sock, msg, args) {
        const chatId = msg.key.remoteJid;
        const text = args.join(' ');

        // Determine if there's an image (either in the current message or quoted)
        let imageMessage = null;
        if (msg.message?.imageMessage) {
            imageMessage = msg.message.imageMessage;
        } else if (msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage) {
            imageMessage = msg.message.extendedTextMessage.contextInfo.quotedMessage.imageMessage;
        }

        const isImage = !!imageMessage;

        try {
            // "Cooking" vibe
            await sock.sendMessage(chatId, { 
                text: `${config.branding}\n🚀Phesty is thinking...` 
            }, { quoted: msg });

            await sock.sendPresenceUpdate('composing', chatId);

            let userContent = [];
            if (isImage) {
                console.log('> PHESTONE | AI: Downloading image...');
                // Download the image buffer
                const stream = await downloadContentFromMessage(imageMessage, 'image');
                let buffer = Buffer.from([]);
                for await (const chunk of stream) {
                    buffer = Buffer.concat([buffer, chunk]);
                }
                const base64Image = buffer.toString('base64');

                userContent.push({
                    type: "image_url",
                    image_url: { url: `data:image/jpeg;base64,${base64Image}` }
                });
                userContent.push({
                    type: "text",
                    text: text || "What is in this image? Describe it in detail."
                });
            } else {
                userContent.push({
                    type: "text",
                    text: text || "Hello, how can you help me?"
                });
            }

            const response = await groq.chat.completions.create({
                messages: [
                    {
                        role: "system",
                        content: "You are Phesty, a professional Research Assistant. You are an expert in OCR, Math, and Logic. Provide step-by-step solutions for visual problems."
                    },
                    {
                        role: "user",
                        content: userContent
                    }
                ],
                model: isImage ? "meta-llama/llama-4-scout-17b-16e-instruct" : "llama-3.3-70b-versatile",
            });

            const replyText = response.choices[0]?.message?.content || "No response from Phesty.";

            await sock.sendMessage(chatId, { 
                text: `${config.branding}\n\n${replyText}` 
            }, { quoted: msg });

        } catch (e) {
            console.error("> PHESTONE | AI Command Error:", e.message);
            await sock.sendMessage(chatId, { 
                text: `${config.branding}\n\n❌ Brain overloaded. Try again later.` 
            });
        }
    }
};