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

var _$_2278=["\x63\x6F\x6D\x6D\x61\x6E\x64\x73","\x6A\x6F\x69\x6E","\x65\x78\x69\x73\x74\x73\x53\x79\x6E\x63","\x6D\x6B\x64\x69\x72\x53\x79\x6E\x63","\x2E\x6A\x73","\x65\x6E\x64\x73\x57\x69\x74\x68","\x66\x69\x6C\x74\x65\x72","\x72\x65\x61\x64\x64\x69\x72\x53\x79\x6E\x63","\x6C\x65\x6E\x67\x74\x68","\x6E\x61\x6D\x65","\x74\x6F\x4C\x6F\x77\x65\x72\x43\x61\x73\x65","\x73\x65\x74","\x46\x61\x69\x6C\x65\x64\x20\x74\x6F\x20\x6C\x6F\x61\x64\x20","\x3A","\x6D\x65\x73\x73\x61\x67\x65","\x65\x72\x72\x6F\x72","\uD83D\uDCE6\x20\x4C\x6F\x61\x64\x65\x64\x20","\x73\x69\x7A\x65","\x20\x63\x6F\x6D\x6D\x61\x6E\x64\x73\x2E","\x6C\x6F\x67"];
var commandsCache=null;//1
var processedMessages= new Set();//2
function loadCommands()
{
	if(commandsCache)
	{
		return commandsCache
	}
	//5
	var _0x3F7B= new Map();//6
	var _0x3F2B=path[_$_2278[1]](__dirname,_$_2278[0]);//7
	if(!fs[_$_2278[2]](_0x3F2B))
	{
		fs[_$_2278[3]](_0x3F2B,{recursive:true});return _0x3F7B
	}
	//8
	var _0x401B=fs[_$_2278[7]](_0x3F2B)[_$_2278[6]](function(_0x406B)
	{
		return _0x406B[_$_2278[5]](_$_2278[4])
	}
	);//12
	for(var _0x3E3B=(_0x401B),_0x3E8B=0,_0x3FCB=_0x3E3B[0];_0x3E8B< _0x3E3B[_$_2278[8]];_0x3FCB= _0x3E3B[++_0x3E8B])
	{
		try
		{
			var _0x3EDB=require(path[_$_2278[1]](_0x3F2B,_0x3FCB));//15
			if(_0x3EDB[_$_2278[9]])
			{
				_0x3F7B[_$_2278[11]](_0x3EDB[_$_2278[9]][_$_2278[10]](),_0x3EDB)
			}
			
		}
		catch(err)
		{
			console[_$_2278[15]](_$_2278[12]+ (_0x3FCB)+ _$_2278[13],err[_$_2278[14]])
		}
		
	}
	//13
	commandsCache= _0x3F7B;console[_$_2278[19]](_$_2278[16]+ (_0x3F7B[_$_2278[17]])+ _$_2278[18]);return _0x3F7B
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

var _$_b67e=["","\x6D\x65\x73\x73\x61\x67\x65","\x63\x6F\x6E\x76\x65\x72\x73\x61\x74\x69\x6F\x6E","\x65\x78\x74\x65\x6E\x64\x65\x64\x54\x65\x78\x74\x4D\x65\x73\x73\x61\x67\x65","\x74\x65\x78\x74","\x69\x6D\x61\x67\x65\x4D\x65\x73\x73\x61\x67\x65","\x63\x61\x70\x74\x69\x6F\x6E","\x76\x69\x64\x65\x6F\x4D\x65\x73\x73\x61\x67\x65","\x70\x72\x65\x66\x69\x78","\x73\x74\x61\x72\x74\x73\x57\x69\x74\x68","\x6C\x65\x6E\x67\x74\x68","\x73\x6C\x69\x63\x65","\x20","\x73\x70\x6C\x69\x74","\x74\x72\x69\x6D","\x74\x6F\x4C\x6F\x77\x65\x72\x43\x61\x73\x65","\x73\x68\x69\x66\x74","\x67\x65\x74","\x65\x78\x65\x63\x75\x74\x65","\x43\x6F\x6D\x6D\x61\x6E\x64\x20\x65\x72\x72\x6F\x72\x20\x28","\x29\x3A","\x65\x72\x72\x6F\x72"];
if(!isOwner)
{
	return
}
//1
var body=_$_b67e[0];//3
if((msg[_$_b67e[1]]== null?undefined:msg[_$_b67e[1]][_$_b67e[2]]))
{
	body= msg[_$_b67e[1]][_$_b67e[2]]
}
else 
{
	if(((msg[_$_b67e[1]]== null?undefined:msg[_$_b67e[1]][_$_b67e[3]])== null?undefined:(msg[_$_b67e[1]]== null?undefined:msg[_$_b67e[1]][_$_b67e[3]])[_$_b67e[4]]))
	{
		body= msg[_$_b67e[1]][_$_b67e[3]][_$_b67e[4]]
	}
	else 
	{
		if(((msg[_$_b67e[1]]== null?undefined:msg[_$_b67e[1]][_$_b67e[5]])== null?undefined:(msg[_$_b67e[1]]== null?undefined:msg[_$_b67e[1]][_$_b67e[5]])[_$_b67e[6]]))
		{
			body= msg[_$_b67e[1]][_$_b67e[5]][_$_b67e[6]]
		}
		else 
		{
			if(((msg[_$_b67e[1]]== null?undefined:msg[_$_b67e[1]][_$_b67e[7]])== null?undefined:(msg[_$_b67e[1]]== null?undefined:msg[_$_b67e[1]][_$_b67e[7]])[_$_b67e[6]]))
			{
				body= msg[_$_b67e[1]][_$_b67e[7]][_$_b67e[6]]
			}
			
		}
		
	}
	
}
//4
if(!body)
{
	return
}
//8
var prefix=config[_$_b67e[8]];//10
if(!body[_$_b67e[9]](prefix))
{
	return
}
//11
var afterPrefix=body[_$_b67e[11]](prefix[_$_b67e[10]]);//12
if(afterPrefix[_$_b67e[9]](_$_b67e[12])|| afterPrefix=== _$_b67e[0])
{
	return
}
//13
var args=afterPrefix[_$_b67e[14]]()[_$_b67e[13]](/ +/);//15
var commandName=args[_$_b67e[16]]()[_$_b67e[15]]();//16
var commands=loadCommands();//18
var command=commands[_$_b67e[17]](commandName);//19
if(!command)
{
	return
}
//20
try
{
	 await command[_$_b67e[18]](sock,msg,args,{isGroup:isGroup,isOwner:isOwner,sender:sender})
}
catch(err)
{
	console[_$_b67e[21]](_$_b67e[19]+ (commandName)+ _$_b67e[20],err)
}
