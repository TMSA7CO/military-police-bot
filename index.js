/* ═══════════════════════════════════════════════════════════
 *  الشرطة العسكرية | وزارة الدفاع الأمريكي
 *  نقطة الدخول الرئيسية للبوت — Index.js
 *  الإصدار: 1.0
 *  الوظيفة: تشغيل البوت + تحميل الأوامر والأحداث + Health Check
 *  ═══════════════════════════════════════════════════════════ */

'use strict';

/* ═══════════════════════════════════════════════════════════
 *                    المكتبات الأساسية
 *  ═══════════════════════════════════════════════════════════ */

const { Client, GatewayIntentBits, Partials, Collection } = require('discord.js');
const express = require('express');
const path = require('path');
const fs = require('fs');

const CONFIG = require('./config');

/* ═══════════════════════════════════════════════════════════
 *                    التحقق من الإعدادات
 *  ═══════════════════════════════════════════════════════════ */

console.log('\n═══════════════════════════════════════════════════════');
console.log('  🎖️  Military Police Bot — Starting...');
console.log('═══════════════════════════════════════════════════════\n');

const validation = CONFIG.validate();

if (!validation.valid) {
  console.error('\n❌ فشل التشغيل بسبب أخطاء في الإعدادات\n');
  process.exit(1);
}

/* ═══════════════════════════════════════════════════════════
 *                    إنشاء العميل (Client)
 *  ═══════════════════════════════════════════════════════════ */

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],
  partials: [
    Partials.Channel,
    Partials.Message,
    Partials.User,
    Partials.GuildMember,
    Partials.Reaction
  ]
});

/* ─── تخزين الأوامر ─── */
client.commands = new Collection();

/* ─── إعدادات إضافية ─── */
client.config = CONFIG;
client.startTime = Date.now();

/* ═══════════════════════════════════════════════════════════
 *                    تحميل الأوامر
 *  ═══════════════════════════════════════════════════════════ */

function loadCommands() {
  const commandsPath = path.join(__dirname, 'commands');

  if (!fs.existsSync(commandsPath)) {
    console.warn('[Commands] ⚠️ مجلد الأوامر غير موجود:', commandsPath);
    return 0;
  }

  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

  let loadedCount = 0;

  for (const file of commandFiles) {
    try {
      const filePath = path.join(commandsPath, file);
      const command = require(filePath);

      if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        loadedCount++;
        console.log(`[Commands] ✅ ${command.data.name}`);
      } else {
        console.warn(`[Commands] ⚠️ ${file} ينقصه "data" أو "execute"`);
      }
    } catch (err) {
      console.error(`[Commands] ❌ فشل تحميل ${file}:`, err.message);
    }
  }

  return loadedCount;
}

/* ═══════════════════════════════════════════════════════════
 *                    تحميل الأحداث
 *  ═══════════════════════════════════════════════════════════ */

function loadEvents() {
  const eventsPath = path.join(__dirname, 'events');

  if (!fs.existsSync(eventsPath)) {
    console.warn('[Events] ⚠️ مجلد الأحداث غير موجود:', eventsPath);
    return 0;
  }

  const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

  let loadedCount = 0;

  for (const file of eventFiles) {
    try {
      const filePath = path.join(eventsPath, file);
      const event = require(filePath);

      if ('name' in event) {
        if (event.once) {
          client.once(event.name, (...args) => {
            try {
              event.execute(...args, client);
            } catch (err) {
              console.error(`[Event:${event.name}]`, err.message);
            }
          });
        } else {
          client.on(event.name, (...args) => {
            try {
              event.execute(...args, client);
            } catch (err) {
              console.error(`[Event:${event.name}]`, err.message);
            }
          });
        }

        loadedCount++;
        console.log(`[Events] ✅ ${event.name} (${file})`);
      } else {
        console.warn(`[Events] ⚠️ ${file} ينقصه "name"`);
      }
    } catch (err) {
      console.error(`[Events] ❌ فشل تحميل ${file}:`, err.message);
    }
  }

  return loadedCount;
}

/* ═══════════════════════════════════════════════════════════
 *                    سيرفر Health Check (Koyeb)
 *  ═══════════════════════════════════════════════════════════ */

function startHealthServer() {
  const app = express();
  const PORT = CONFIG.HEALTH_PORT || 8000;

  app.get('/', (req, res) => {
    res.json({
      status: 'online',
      bot: client.user ? client.user.tag : 'starting',
      guilds: client.guilds.cache.size,
      uptime: Math.floor((Date.now() - client.startTime) / 1000),
      timestamp: new Date().toISOString()
    });
  });

  app.get('/health', (req, res) => {
    const isReady = client.isReady();

    res.status(isReady ? 200 : 503).json({
      status: isReady ? 'healthy' : 'starting',
      ready: isReady,
      ping: client.ws.ping,
      uptime: Math.floor((Date.now() - client.startTime) / 1000)
    });
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Health] ✅ Health Check على المنفذ ${PORT}`);
  });
}

/* ═══════════════════════════════════════════════════════════
 *                    معالجة الأخطاء العامة
 *  ═══════════════════════════════════════════════════════════ */

process.on('unhandledRejection', (error) => {
  console.error('\n⚠️ Unhandled Rejection:');
  console.error(error);
});

process.on('uncaughtException', (error) => {
  console.error('\n❌ Uncaught Exception:');
  console.error(error);

  /* ─── في Koyeb، الأفضل الخروج لإعادة التشغيل ─── */
  if (CONFIG.ENV === 'production') {
    setTimeout(() => {
      console.error('🔴 الخروج بعد خطأ غير متوقع...');
      process.exit(1);
    }, 5000);
  }
});

process.on('SIGINT', () => {
  console.log('\n⏹️ إيقاف البوت (SIGINT)...');
  shutdown();
});

process.on('SIGTERM', () => {
  console.log('\n⏹️ إيقاف البوت (SIGTERM)...');
  shutdown();
});

async function shutdown() {
  try {
    console.log('🔌 إغلاق الاتصال بـ Discord...');
    client.destroy();
  } catch (err) {
    // تجاهل
  }

  console.log('✅ تم إيقاف البوت بنجاح\n');
  process.exit(0);
}

/* ═══════════════════════════════════════════════════════════
 *                    التشغيل الرئيسي
 *  ═══════════════════════════════════════════════════════════ */

async function main() {
  try {
    /* ─── 1. تحميل الأوامر ─── */
    console.log('\n📂 تحميل الأوامر...');
    const commandsLoaded = loadCommands();
    console.log(`[Commands] تم تحميل ${commandsLoaded} أمر\n`);

    /* ─── 2. تحميل الأحداث ─── */
    console.log('📂 تحميل الأحداث...');
    const eventsLoaded = loadEvents();
    console.log(`[Events] تم تحميل ${eventsLoaded} حدث\n`);

    /* ─── 3. تشغيل Health Server ─── */
    startHealthServer();

    /* ─── 4. تسجيل الدخول ─── */
    console.log('🔐 جاري تسجيل الدخول...\n');

    await client.login(CONFIG.TOKEN);

    /* ─── ملاحظة: الباقي يُنفّذ في `events/ready.js` ─── */

  } catch (err) {
    console.error('\n❌ فشل التشغيل:');
    console.error(err.message);

    if (err.message.includes('TOKEN_INVALID')) {
      console.error('🔑 التوكن غير صحيح — تأكد من DISCORD_BOT_TOKEN في .env\n');
    }

    if (err.message.includes('DISALLOWED_INTENTS')) {
      console.error('⚠️ Intents غير مفعلة — فعّلها من Discord Developer Portal\n');
    }

    process.exit(1);
  }
}

/* ═══════════════════════════════════════════════════════════
 *                    التشغيل
 *  ═══════════════════════════════════════════════════════════ */

main();

/* ═══════════════════════════════════════════════════════════
 *                    تصدير Client (للاستخدام)
 *  ═══════════════════════════════════════════════════════════ */

module.exports = client;