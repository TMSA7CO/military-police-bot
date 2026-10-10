/* ═══════════════════════════════════════════════════════════
 *  الشرطة العسكرية | وزارة الدفاع الأمريكي
 *  مشغل بوتات المراقبة — Index-Monitor.js
 *  الإصدار: 1.0
 *  الوظيفة: تشغيل 4 بوتات مراقبة صوتية
 *  ═══════════════════════════════════════════════════════════ */

'use strict';

require('dotenv').config();

const { Client, GatewayIntentBits, Partials } = require('discord.js');
const express = require('express');

const CONFIG = require('./config');
const voiceEvents = require('./events/voiceStateUpdate.js');

/* ═══════════════════════════════════════════════════════════
 *                    التوكنات
 *  ═══════════════════════════════════════════════════════════ */

const MONITOR_TOKENS = [
  process.env.MONITOR_BOT_TOKEN_1,
  process.env.MONITOR_BOT_TOKEN_2,
  process.env.MONITOR_BOT_TOKEN_3,
  process.env.MONITOR_BOT_TOKEN_4
].filter(t => t && t.length > 20);

/* ═══════════════════════════════════════════════════════════
 *                    حالة البوتات
 *  ═══════════════════════════════════════════════════════════ */

const monitorClients = [];
const startTime = Date.now();

/* ═══════════════════════════════════════════════════════════
 *              تشغيل بوت مراقبة
 *  ═══════════════════════════════════════════════════════════ */

async function startMonitorBot(token, index) {
  const botNumber = index + 1;
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildVoiceStates
    ],
    partials: [
      Partials.Channel,
      Partials.GuildMember
    ]
  });

  client.botIndex = index;

  client.once('ready', () => {
    console.log(`[Monitor ${botNumber}] ✅ متصل: ${client.user.tag} (${client.user.id})`);
    try {
      client.user.setPresence({
        activities: [{
          name: `المراقبة #${botNumber} | وزارة الدفاع`,
          type: 3 // WATCHING
        }],
        status: 'online'
      });
    } catch (err) {
      console.error(`[Monitor ${botNumber}] فشل تعيين الحالة:`, err.message);
    }
  });

  client.on('voiceStateUpdate', async (oldState, newState) => {
    try {
      await voiceEvents.execute(oldState, newState, client);
    } catch (err) {
      console.error(`[Monitor ${botNumber}] خطأ في voiceStateUpdate:`, err.message);
    }
  });

  client.on('error', (err) => {
    console.error(`[Monitor ${botNumber}] خطأ:`, err.message);
  });

  client.on('shardDisconnect', () => {
    console.warn(`[Monitor ${botNumber}] ⚠️ انقطع الاتصال`);
  });

  client.on('shardReconnecting', () => {
    console.log(`[Monitor ${botNumber}] 🔄 إعادة الاتصال...`);
  });

  await client.login(token);
  monitorClients.push({ client, index, botNumber });
  return client;
}

/* ═══════════════════════════════════════════════════════════
 *              سيرفر Health Check
 *  ═══════════════════════════════════════════════════════════ */

function startHealthServer() {
  const app = express();
  const PORT = (CONFIG.HEALTH_PORT || 8000) + 1; // 8001

  app.get('/', (req, res) => {
    res.json({
      status: 'online',
      service: 'monitor-bots',
      total: monitorClients.length,
      uptime: Math.floor((Date.now() - startTime) / 1000),
      timestamp: new Date().toISOString(),
      monitors: monitorClients.map(m => ({
        botNumber: m.botNumber,
        tag: m.client.user?.tag || 'starting',
        ready: m.client.isReady(),
        ping: m.client.ws.ping
      }))
    });
  });

  app.get('/health', (req, res) => {
    const readyCount = monitorClients.filter(m => m.client.isReady()).length;
    res.status(readyCount > 0 ? 200 : 503).json({
      status: readyCount > 0 ? 'healthy' : 'starting',
      ready: readyCount,
      total: monitorClients.length,
      uptime: Math.floor((Date.now() - startTime) / 1000)
    });
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Health] ✅ Health Check على المنفذ ${PORT}`);
  });
}

/* ═══════════════════════════════════════════════════════════
 *                    التشغيل الرئيسي
 *  ═══════════════════════════════════════════════════════════ */

async function main() {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  👁️  Monitor Bots — Starting...');
  console.log('═══════════════════════════════════════════════════════\n');

  if (MONITOR_TOKENS.length === 0) {
    console.error('❌ لا توجد توكنات مراقبة!');
    console.error('💡 أضف MONITOR_BOT_TOKEN_1..4 في ملف .env\n');
    process.exit(1);
  }

  console.log(`📋 عدد البوتات: ${MONITOR_TOKENS.length}\n`);

  startHealthServer();

  for (let i = 0; i < MONITOR_TOKENS.length; i++) {
    try {
      await startMonitorBot(MONITOR_TOKENS[i], i);
      await new Promise(r => setTimeout(r, 3000));
    } catch (err) {
      console.error(`[Monitor ${i + 1}] ❌ فشل الاتصال:`, err.message);
    }
  }

  console.log(`\n═══════════════════════════════════════════════════════`);
  console.log(`  ✅ تم تشغيل ${monitorClients.length} بوت مراقبة`);
  console.log(`═══════════════════════════════════════════════════════\n`);
}

/* ═══════════════════════════════════════════════════════════
 *                    معالجة الأخطاء
 *  ═══════════════════════════════════════════════════════════ */

process.on('unhandledRejection', (error) => {
  console.error('\n⚠️ Unhandled Rejection:');
  console.error(error);
});

process.on('uncaughtException', (error) => {
  console.error('\n❌ Uncaught Exception:');
  console.error(error);
});

process.on('SIGINT', async () => {
  console.log('\n⏹️ إيقاف بوتات المراقبة...');
  for (const m of monitorClients) {
    try { m.client.destroy(); } catch {}
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n⏹️ إيقاف بوتات المراقبة...');
  for (const m of monitorClients) {
    try { m.client.destroy(); } catch {}
  }
  process.exit(0);
});

/* ═══════════════════════════════════════════════════════════
 *                    تشغيل
 *  ═══════════════════════════════════════════════════════════ */

main();

module.exports = monitorClients;