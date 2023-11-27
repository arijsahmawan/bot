const {makeWASocket, MessageType, Mimetype, MessageOptions, useMultiFileAuthState} = require('@whiskeysockets/baileys')
const fs = require('fs')
const pino = require('pino')
const useCode = process.argv.includes("--useCode")
const rawData = require("./data.json")

async function connectToWhatsapp(){	
		const auth = await useMultiFileAuthState("auth")
  		const sock = makeWASocket({
	    	printQRInTerminal: !useCode,
    		browser: ["Chrome (Linux)", "", ""],
	    	auth: auth.state,
    		logger: pino({level: "silent"}),
			generateHighQualityLinkPreview: true
  		})
  		if(useCode && !sock.authState.creds.registered){
		    setTimeout(async function(){
      			const pCode = await sock.requestPairingCode(rawData.pNumber)
      			console.log("Pairing code : "+pCode)
    		}, 5000)
  		}

  		sock.ev.on("creds.update", auth.saveCreds)
  		sock.ev.on("connection.update", ({connection}) =>{
	    	if(connection === "open"){
      			console.log(`=====> Nomor WA yang terhubung: ${sock.user.id.split(":")[0]}\n`)
    		}else if(connection === "close"){
	      		connectToWhatsapp()
    		}
  		})

  		sock.ev.on("messages.upsert", ({messages}) => {
	  		// console.log(messages)

	  		const id = messages[0].key.remoteJid;
	  		const msgId = id.split('@')[1] === 'g.us' ? messages[0].key.participant : id;
	  		const msgType = Object.keys(messages[0].message)[0];
	  		const chat = msgType === 'conversation' ? messages[0].message.conversation : msgType === 'extendedTextMessage' ? messages[0].message.extendedTextMessage.text : msgType === 'imageMessage' ? messages[0].message.imageMessage.caption : msgType === 'videoMessage' ? messages[0].message.videoMessage.caption : '';

	  		async function showChat() {
				if(messages[0].key.remoteJid.split('@')[1] === 'g.us'){
					const groupId = await sock.groupMetadata(id)
					console.log(`=> ${msgId.split('@')[0]} (${messages[0].pushName}) [${groupId.subject}]: ${chat}`)
				}else if(messages[0].key.remoteJid.split('@')[1] === 's.whatsapp.net'){
					console.log(`=> ${msgId.split('@')[0]} (${messages[0].pushName}): ${chat}`)
				}
	  		}
	  		showChat()

	  		switch(chat){
	  		case '.everyone':
	  			async function tagAll(){
					var participant = await sock.groupMetadata(id);
					var participantLength = participant.participants.length;
					var mentions = [];
					for (let i = 0; i < participantLength; i++) {
				  		var serialized = participant.participants[i].id.split('@')[0];
				  		mentions.push({
				    		tag: `@${serialized}`,
				    		mention: `${serialized}@s.whatsapp.net`
				  		});
					}
					var messageText = mentions.map(mention => mention.tag).join(' ');
					const mentionMsg = await sock.sendMessage(id, {
				  		text: messageText,
				  		mentions: mentions.map(mention => mention.mention)
					});
				}
				tagAll()
	  			break;

		  	default:
	  			break;
	  		}
	  	})
}

connectToWhatsapp()