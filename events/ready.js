/* ═══════════════════════════════════════════════════════════
 *  الشرطة العسكرية | وزارة الدفاع الأمريكي
 *  حدث التشغيل — Ready.js
 *  الإصدار: 1.0
 *  الوظيفة: يُنفذ عند تشغيل البوت (تسجيل الدخول)
 *  ═══════════════════════════════════════════════════════════ */

'use strict';

const { Events, ActivityType, REST, Routes } = require('discord.js');
const path = require('path');
const fs = require('fs');

const CONFIG = require('../config');
const firebase = require('../firebase');
const logger = require('../utils/logger');
const embeds = require('../utils/embeds');
const { cleanChannelById } = require('../utils/cleanChannel');

/* ═══════════════════════════════════════════════════════════
 *                    حالة اللوحات
 *  ═══════════════════════════════════════════════════════════ */
const panelState = {
  recruitment: null,
  reports: null,
  control: null,
  synchronized: null
};

/* ═══════════════════════════════════════════════════════════
 *              1. تسجيل الأوامر (Slash Commands)
 *  ═══════════════════════════════════════════════════════════ */

async function registerCommands(client) {
  try {
    const commands = [];
    const commandsPath = path.join(__dirname, '..', 'commands');

    /* ─── التحقق من وجود المجلد ─── */
    if (!fs.existsSync(commandsPath)) {
      console.warn('[Ready] ⚠️ مجلد الأوامر غير موجود:', commandsPath);
      return;
    }

    /* ─── قراءة جميع ملفات الأوامر ─── */
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
      try {
        const filePath = path.join(commandsPath, file);
        delete require.cache[require.resolve(filePath)];
        const command = require(filePath);

        if ('data' in command && 'execute' in command) {
          commands.push(command.data.toJSON());
          console.log(`[Ready] ✅ تم تحميل الأمر: ${command.data.name}`);
        } else {
          console.warn(`[Ready] ⚠️ الملف ${file} ينقصه "data" أو "execute"`);
        }
      } catch (err) {
        console.error(`[Ready] ❌ فشل تحميل الأمر ${file}:`, err.message);
      }
    }

    if (commands.length === 0) {
      console.log('[Ready] لا توجد أوامر لتسجيلها');
      return;
    }

    /* ─── تسجيل الأوامر في Discord ─── */
    const rest = new REST({ version: '10' }).setToken(CONFIG.TOKEN);

    console.log(`[Ready] 🔄 جاري تسجيل ${commands.length} أمر...`);

    /* ─── تسجيل على مستوى السيرفر (أسرع) ─── */
    if (CONFIG.GUILD_ID) {
      await rest.put(
        Routes.applicationGuildCommands(CONFIG.CLIENT_ID, CONFIG.GUILD_ID),
        { body: commands }
      );
      console.log(`[Ready] ✅ تم تسجيل ${commands.length} أمر في السيرفر`);
    } else {
      /* ─── تسجيل عالمي ─── */
      await rest.put(
        Routes.applicationCommands(CONFIG.CLIENT_ID),
        { body: commands }
      );
      console.log(`[Ready] ✅ تم تسجيل ${commands.length} أمر عالمياً`);
    }

  } catch (err) {
    console.error('[Ready] ❌ فشل تسجيل الأوامر:', err.message);
  }
}

/* ═══════════════════════════════════════════════════════════
 *              2. إعداد حالة البوت (Presence)
 *  ═══════════════════════════════════════════════════════════ */

function setBotPresence(client) {
  try {
    const activityTypes = {
      'PLAYING': ActivityType.Playing,
      'WATCHING': ActivityType.Watching,
      'LISTENING': ActivityType.Listening,
      'STREAMING': ActivityType.Streaming,
      'COMPETING': ActivityType.Competing
    };

    const type = activityTypes[CONFIG.BOT.ACTIVITY_TYPE] || ActivityType.Watching;

    client.user.setPresence({
      activities: [{
        name: CONFIG.BOT.STATUS,
        type: type
      }],
      status: 'online'
    });

    console.log(`[Ready] ✅ تم تعيين حالة البوت: ${CONFIG.BOT.STATUS}`);
  } catch (err) {
    console.error('[Ready] ❌ فشل تعيين حالة البوت:', err.message);
  }
}

/* ═══════════════════════════════════════════════════════════
 *              3. إرسال لوحة التوظيف
 *  ═══════════════════════════════════════════════════════════ */

async function sendRecruitmentPanel(client) {
  try {
    const channelId = CONFIG.CHANNELS.RECRUITMENT_PANEL;
    if (!channelId || channelId === '0') {
      console.log('[Ready] ⏭️ لوحة التوظيف: القناة غير محددة');
      return;
    }

    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel) {
      console.warn('[Ready] ⚠️ قناة لوحة التوظيف غير موجودة:', channelId);
      return;
    }

    /* ─── تنظيف القناة قبل الإرسال ─── */
    console.log('[Ready] 🧹 تنظيف قناة لوحة التوظيف...');
    await cleanChannelById(client, channelId, { client });

    /* ─── جلب حالة التوظيف ─── */
    const status = await firebase.getRecruitmentStatus();
    const isOpen = status.open === true;

    /* ─── إرسال اللوحة ─── */
    const payload = embeds.recruitmentPanel(client, isOpen);
    const message = await channel.send(payload);

    /* ─── حفظ موقع اللوحة ─── */
    await firebase.savePanelLocation('recruitment', channel.id, message.id);

    panelState.recruitment = {
      channelId: channel.id,
      messageId: message.id,
      isOpen
    };

    console.log(`[Ready] ✅ تم إرسال لوحة التوظيف (${isOpen ? 'مفتوح' : 'مغلق'})`);

  } catch (err) {
    console.error('[Ready] ❌ فشل إرسال لوحة التوظيف:', err.message);
  }
}

/* ═══════════════════════════════════════════════════════════
 *              4. إرسال لوحة التقارير
 *  ═══════════════════════════════════════════════════════════ */

async function sendReportsPanel(client) {
  try {
    const channelId = CONFIG.CHANNELS.REPORTS_PANEL;
    if (!channelId) {
      console.log('[Ready] ⏭️ لوحة التقارير: القناة غير محددة');
      return;
    }

    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel) {
      console.warn('[Ready] ⚠️ قناة لوحة التقارير غير موجودة:', channelId);
      return;
    }

    /* ─── تنظيف القناة ─── */
    console.log('[Ready] 🧹 تنظيف قناة لوحة التقارير...');
    await cleanChannelById(client, channelId, { client });

    /* ─── إرسال اللوحة ─── */
    const payload = embeds.reportsPanel(client);
    const message = await channel.send(payload);

    /* ─── حفظ موقع اللوحة ─── */
    await firebase.savePanelLocation('reports', channel.id, message.id);

    panelState.reports = {
      channelId: channel.id,
      messageId: message.id
    };

    console.log('[Ready] ✅ تم إرسال لوحة التقارير');

  } catch (err) {
    console.error('[Ready] ❌ فشل إرسال لوحة التقارير:', err.message);
  }
}

/* ═══════════════════════════════════════════════════════════
 *              5. إرسال لوحة التحكم
 *  ═══════════════════════════════════════════════════════════ */

async function sendControlPanel(client) {
  try {
    const channelId = CONFIG.CHANNELS.CONTROL_PANEL;
    if (!channelId) {
      console.log('[Ready] ⏭️ لوحة التحكم: القناة غير محددة');
      return;
    }

    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel) {
      console.warn('[Ready] ⚠️ قناة لوحة التحكم غير موجودة:', channelId);
      return;
    }

    /* ─── تنظيف القناة ─── */
    console.log('[Ready] 🧹 تنظيف قناة لوحة التحكم...');
    await cleanChannelById(client, channelId, { client });

    /* ─── إرسال اللوحة ─── */
    const payload = embeds.controlPanel(client);
    const message = await channel.send(payload);

    /* ─── حفظ موقع اللوحة ─── */
    await firebase.savePanelLocation('control', channel.id, message.id);

    panelState.control = {
      channelId: channel.id,
      messageId: message.id
    };

    console.log('[Ready] ✅ تم إرسال لوحة التحكم');

  } catch (err) {
    console.error('[Ready] ❌ فشل إرسال لوحة التحكم:', err.message);
  }
}

/* ═══════════════════════════════════════════════════════════
 *              6. إرسال اللوحة المتزامنة (اختياري)
 *  ═══════════════════════════════════════════════════════════ */

async function sendSynchronizedPanel(client) {
  try {
    const channelId = CONFIG.CHANNELS.SYNCHRONIZED_PANEL;

    /* ─── لا نرسل تلقائياً إلا لو محدد ─── */
    if (!channelId || channelId === '0' || channelId === 'null') {
      console.log('[Ready] ⏭️ اللوحة المتزامنة: القناة غير محددة (تُرسل يدوياً)');
      return;
    }

    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel) {
      console.warn('[Ready] ⚠️ قناة اللوحة المتزامنة غير موجودة:', channelId);
      return;
    }

    /* ─── تنظيف القناة ─── */
    console.log('[Ready] 🧹 تنظيف قناة اللوحة المتزامنة...');
    await cleanChannelById(client, channelId, { client });

    /* ─── جلب الأعضاء ─── */
    const members = await firebase.getAllMembers();

    /* ─── إرسال اللوحة ─── */
    const payload = embeds.synchronizedPanel(client, members);
    const message = await channel.send(payload);

    /* ─── حفظ موقع اللوحة ─── */
    await firebase.savePanelLocation('synchronized', channel.id, message.id);

    panelState.synchronized = {
      channelId: channel.id,
      messageId: message.id
    };

    console.log(`[Ready] ✅ تم إرسال اللوحة المتزامنة (${members.length} عضو)`);

  } catch (err) {
    console.error('[Ready] ❌ فشل إرسال اللوحة المتزامنة:', err.message);
  }
}

/* ═══════════════════════════════════════════════════════════
 *              7. فحص الصلاحيات
 *  ═══════════════════════════════════════════════════════════ */

async function checkPermissions(client) {
  try {
    const guild = await client.guilds.fetch(CONFIG.GUILD_ID).catch(() => null);
    if (!guild) {
      console.error('[Ready] ❌ لم يتم العثور على السيرفر');
      return;
    }

    const me = guild.members.me;
    const requiredPerms = [
      'ManageRoles',
      'ManageNicknames',
      'ManageMessages',
      'ManageChannels',
      'SendMessages',
      'EmbedLinks',
      'AttachFiles',
      'ReadMessageHistory',
      'ViewChannel',
      'Connect',
      'Speak',
      'MentionEveryone'
    ];

    const missing = [];
    for (const perm of requiredPerms) {
      if (!me.permissions.has(perm)) {
        missing.push(perm);
      }
    }

    if (missing.length > 0) {
      console.warn('\n══════════════════════════════════════');
      console.warn('   ⚠️ صلاحيات ناقصة في السيرفر:');
      missing.forEach(p => console.warn(`   ❌ ${p}`));
      console.warn('══════════════════════════════════════\n');
    } else {
      console.log('[Ready] ✅ جميع الصلاحيات متوفرة');
    }
  } catch (err) {
    console.error('[Ready] ❌ فشل فحص الصلاحيات:', err.message);
  }
}

/* ═══════════════════════════════════════════════════════════
 *              8. إرسال تقرير التشغيل
 *  ═══════════════════════════════════════════════════════════ */

async function sendStartupReport(client) {
  try {
    /* ─── جمع الإحصائيات ─── */
    const guild = await client.guilds.fetch(CONFIG.GUILD_ID).catch(() => null);
    const members = await firebase.getAllMembers();

    const stats = {
      guildName: guild ? guild.name : 'غير معروف',
      guildId: CONFIG.GUILD_ID,
      totalMembers: guild ? guild.memberCount : 0,
      mpMembers: members.length,
      totalPoints: members.reduce((sum, m) => sum + (m.points || 0), 0),
      ping: Math.round(client.ws.ping),
      uptime: '< 1 دقيقة'
    };

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('  🎖️  Military Police Bot');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`  ✅  البوت: ${client.user.tag}`);
    console.log(`  🆔  الآيدي: ${client.user.id}`);
    console.log(`  🌐  السيرفر: ${stats.guildName}`);
    console.log(`  👥  الأعضاء في السيرفر: ${stats.totalMembers}`);
    console.log(`  🎖️  أعضاء الشرطة العسكرية: ${stats.mpMembers}`);
    console.log(`  ⭐  إجمالي النقاط: ${stats.totalPoints}`);
    console.log(`  📡  Ping: ${stats.ping}ms`);
    console.log(`  🕒  الوقت: ${new Date().toLocaleString('ar-EG')}`);
    console.log('═══════════════════════════════════════════════════════\n');

    /* ─── إرسال لوق ─── */
    await logger.logBotStarted(client).catch(() => {});

  } catch (err) {
    console.error('[Ready] ❌ فشل إرسال تقرير التشغيل:', err.message);
  }
}

/* ═══════════════════════════════════════════════════════════
 *              9. الحدث الرئيسي
 *  ═══════════════════════════════════════════════════════════ */

module.exports = {
  name: Events.ClientReady,
  once: true,

  async execute(client) {
    console.log('\n🚀 بدء تشغيل البوت...\n');

    try {
      /* ═══════════════════════════════════════════════
       *  1. إعداد Presence
       *  ═══════════════════════════════════════════════ */
      setBotPresence(client);

      /* ═══════════════════════════════════════════════
       *  2. تسجيل الأوامر
       *  ═══════════════════════════════════════════════ */
      await registerCommands(client);

      /* ═══════════════════════════════════════════════
       *  3. انتظار بسيط (للتأكد من جاهزية السيرفر)
       *  ═══════════════════════════════════════════════ */
      await new Promise(resolve => setTimeout(resolve, 3000));

      /* ═══════════════════════════════════════════════
       *  4. فحص الصلاحيات
       *  ═══════════════════════════════════════════════ */
      await checkPermissions(client);

      /* ═══════════════════════════════════════════════
       *  5. إرسال اللوحات التلقائية (بالترتيب)
       *  ═══════════════════════════════════════════════ */
      console.log('\n📋 بدء إرسال اللوحات التلقائية...\n');

      /* ─── التوظيف ─── */
      await sendRecruitmentPanel(client);
      await new Promise(resolve => setTimeout(resolve, 2000));

      /* ─── التقارير ─── */
      await sendReportsPanel(client);
      await new Promise(resolve => setTimeout(resolve, 2000));

      /* ─── التحكم ─── */
      await sendControlPanel(client);
      await new Promise(resolve => setTimeout(resolve, 2000));

      /* ─── المتزامنة (اختياري) ─── */
      await sendSynchronizedPanel(client);

      /* ═══════════════════════════════════════════════
       *  6. إرسال تقرير التشغيل
       *  ═══════════════════════════════════════════════ */
      await sendStartupReport(client);

      /* ═══════════════════════════════════════════════
       *  7. تخزين الحالة العامة
       *  ═══════════════════════════════════════════════ */
      client.panelState = panelState;

      console.log('✅ البوت جاهز للعمل!\n');

    } catch (err) {
      console.error('[Ready] ❌ خطأ عام:', err.message);
      console.error(err.stack);

      /* ─── محاولة إرسال الخطأ للسجل ─── */
      await logger.logError(client, err.message, 'Ready Event').catch(() => {});
    }
  }
};

/* ═══════════════════════════════════════════════════════════
 *                    دوال مساعدة للتصدير
 *  ═══════════════════════════════════════════════════════════ */

module.exports.panelState = panelState;
module.exports.sendRecruitmentPanel = sendRecruitmentPanel;
module.exports.sendReportsPanel = sendReportsPanel;
module.exports.sendControlPanel = sendControlPanel;
module.exports.sendSynchronizedPanel = sendSynchronizedPanel;