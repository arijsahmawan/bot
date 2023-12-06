const {makeWASocket, MessageType, Mimetype, MessageOptions, useMultiFileAuthState, downloadMediaMessage} = require('@whiskeysockets/baileys')
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
  		var chat = ''
  		sock.ev.on("messages.upsert", async ({messages}) => {
  			try{
		  		if(Reflect.ownKeys(messages[0].message)[0] === 'documentMessage'){
		  			const buffer = await downloadMediaMessage(
		  				messages[0],
		  				'buffer',
		  				{}
		  			)
		  			fs.writeFileSync(`./document/${messages[0].message.documentMessage.fileName}`, buffer, 'base64');
	  			}
	  		const msgType = Reflect.ownKeys(messages[0].message)[0];
		  		chat = msgType === 'conversation' ? messages[0].message.conversation : msgType === 'extendedTextMessage' ? messages[0].message.extendedTextMessage.text : msgType === 'imageMessage' ? messages[0].message.imageMessage.caption : msgType === 'videoMessage' ? messages[0].message.videoMessage.caption : '';
	  		}catch(error){
	  			console.log('=================================')
	  			console.error(error)
	  			console.log('=================================')
	  		}
	  		// console.log(messages[0].message)
	  		// console.log(messages[0].message.documentMessage)

	  		const id = messages[0].key.remoteJid;
	  		const msgId = id.split('@')[1] === 'g.us' ? messages[0].key.participant : id;
	  		// console.log(Object.keys(messages[0].message)[0])

	  		async function showChat() {
				if(messages[0].key.remoteJid.split('@')[1] === 'g.us'){
					const groupId = await sock.groupMetadata(id)
					console.log(`=> ${msgId.split('@')[0]} (${messages[0].pushName}) [${groupId.subject}]: ${chat}`)
				}else if(messages[0].key.remoteJid.split('@')[1] === 's.whatsapp.net'){
					console.log(`=> ${msgId.split('@')[0]} (${messages[0].pushName}): ${chat}`)
				}
	  		}
	  		showChat()
	  		function reply(text){sock.sendMessage(id, { text: text }, { quoted: messages[0] });};
	  		const command = chat.split(' ')[0]
	  		switch(command){
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
	  		case '.file':
	  			var allFile = ''
	  			fs.readdir('document', (error, files) => {
	  				if(error){
	  					console.error(error)
	  				}else{
	  					for (var i = 0; i < files.length; i++) {
	  						allFile += `\n[${i+1}] ${files[i]}`
	  					}
	  					reply(`Dokumen yang ada :\n${allFile}`)
	  				}
	  			})
	  			break;
	  		case '.get':
	  			fs.readdir('document', async (error, files) => {
	  				if(error){
	  					console.error(error)
	  				}else{
	  					const numberFile = parseInt(chat.split(' ')[1])
	  					const pathFile = `document/${files[numberFile-1]}`
	  					const fileExt = files[numberFile - 1].split('.')[1]
	  					var docType = ''
			            if (fileExt === 'pdf') {
			                docType = 'pdf';
			            } else if (fileExt === 'xls' || fileExt === 'xlsx') {
			                docType = 'vnd.openxmlformats-officedocument.spreadsheetml.sheet';
			            } else if (fileExt === 'doc' || fileExt === 'docx') {
			                docType = 'vnd.openxmlformats-officedocument.wordprocessingml.document';
			            } else if (fileExt === 'ppt' || fileExt === 'pptx') {
			                docType = 'vnd.ms-powerpoint';
			            }
	  					await sock.sendMessage(id, {
	  						document: fs.readFileSync(pathFile),
	  						mimetype: `application/${docType}`,
	  						fileName: files[numberFile - 1],
	  						ppt: true,
	  						xls: true
	  					})
	  				}
	  			})
	  			break;
		  	default:
	  			break;
	  		}
	  	})
}

connectToWhatsapp()