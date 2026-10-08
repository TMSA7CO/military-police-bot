/* ═══════════════════════════════════════════════════════════
 *  الشرطة العسكرية | وزارة الدفاع الأمريكي
 *  أداة تنظيف الرومات — CleanChannel.js
 *  الإصدار: 1.0
 *  الوظيفة: حذف جميع الرسائل في روم قبل إرسال لوحة جديدة
 *  ═══════════════════════════════════════════════════════════ */

'use strict';

const { ChannelType, Collection } = require('discord.js');

/* ═══════════════════════════════════════════════════════════
 *                    الثوابت
 *  ═══════════════════════════════════════════════════════════ */

const MAX_MESSAGES_PER_FETCH = 100;   // الحد الأقصى لكل fetch
const MAX_BULK_DELETE = 100;          // الحد الأقصى للحذف الجماعي
const MAX_TOTAL_ITERATIONS = 50;      // حماية من الحلقات اللانهائية
const DELAY_BETWEEN_FETCHES = 1000;   // 1 ثانية (لتجنب Rate Limit)
const DISCORD_MSG_MAX_AGE = 14 * 24 * 60 * 60 * 1000; // 14 يوم (بالميلي ثانية)

/* ═══════════════════════════════════════════════════════════
 *                    دوال مساعدة
 *  ═══════════════════════════════════════════════════════════ */

/**
 * تأخير بسيط
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * التحقق من أن الروم قابل للتنظيف
 */
function isCleanableChannel(channel) {
  if (!channel) return false;

  const validTypes = [
    ChannelType.GuildText,
    ChannelType.GuildAnnouncement,
    ChannelType.GuildVoice,
    ChannelType.GuildStageVoice,
    ChannelType.PublicThread,
    ChannelType.PrivateThread,
    ChannelType.AnnouncementThread
  ];

  return validTypes.includes(channel.type);
}

/**
 * التحقق من الصلاحيات
 */
function canCleanChannel(channel, client) {
  if (!channel || !channel.guild) return false;

  const botMember = channel.guild.members.me;
  if (!botMember) return false;

  const permissions = channel.permissionsFor(botMember);
  if (!permissions) return false;

  return permissions.has('ManageMessages') || permissions.has('ManageChannels');
}

/* ═══════════════════════════════════════════════════════════
 *                    الدالة الرئيسية
 *  ═══════════════════════════════════════════════════════════ */

/**
 * حذف جميع الرسائل في روم
 *
 * @param {TextChannel} channel - الروم المراد تنظيفه
 * @param {Object} options - خيارات إضافية
 * @param {Client} options.client - البوت (للتحقق من الصلاحيات)
 * @param {boolean} options.keepPinned - الإبقاء على الرسائل المثبتة (افتراضي: false)
 * @param {boolean} options.silent - إخفاء الرسائل في Console (افتراضي: false)
 * @returns {Promise<Object>} - نتيجة العملية
 */
async function cleanChannel(channel, options = {}) {
  const {
    client = null,
    keepPinned = false,
    silent = false
  } = options;

  /* ─── التحقق الأساسي ─── */
  if (!channel) {
    return { success: false, error: 'الروم غير موجود', deleted: 0 };
  }

  if (!isCleanableChannel(channel)) {
    return { success: false, error: 'نوع الروم غير مدعوم', deleted: 0 };
  }

  /* ─── التحقق من الصلاحيات ─── */
  if (client && !canCleanChannel(channel, client)) {
    return {
      success: false,
      error: 'البوت لا يملك صلاحية Manage Messages في هذا الروم',
      deleted: 0
    };
  }

  let totalDeleted = 0;
  let iterations = 0;

  try {
    if (!silent) {
      console.log(`[cleanChannel] 🧹 بدء تنظيف الروم: #${channel.name} (${channel.id})`);
    }

    /* ═══════════════════════════════════════════════════
     *              الحلقة الرئيسية
     *  ═══════════════════════════════════════════════════ */
    while (iterations < MAX_TOTAL_ITERATIONS) {
      iterations++;

      /* ─── جلب آخر 100 رسالة ─── */
      let messages;
      try {
        messages = await channel.messages.fetch({
          limit: MAX_MESSAGES_PER_FETCH
        });
      } catch (fetchErr) {
        console.error('[cleanChannel] فشل جلب الرسائل:', fetchErr.message);
        break;
      }

      /* ─── لو ما فيه رسائل، ننتهي ─── */
      if (messages.size === 0) {
        if (!silent) console.log('[cleanChannel] ✅ لا توجد رسائل — انتهى التنظيف');
        break;
      }

      /* ─── تصفية الرسائل ─── */
      let toDelete = messages;

      if (keepPinned) {
        toDelete = messages.filter(m => !m.pinned);
      }

      /* ─── لو كلها مثبتة، نوقف ─── */
      if (toDelete.size === 0) {
        if (!silent) console.log('[cleanChannel] ✅ لا توجد رسائل قابلة للحذف');
        break;
      }

      /* ─── تقسيم الرسائل: حديثة (bulk) / قديمة (individual) ─── */
      const now = Date.now();
      const recentMessages = toDelete.filter(
        m => (now - m.createdTimestamp) < DISCORD_MSG_MAX_AGE
      );
      const oldMessages = toDelete.filter(
        m => (now - m.createdTimestamp) >= DISCORD_MSG_MAX_AGE
      );

      /* ─── حذف الرسائل الحديثة بشكل جماعي ─── */
      if (recentMessages.size > 0) {
        try {
          const bulkArray = Array.from(recentMessages.values()).slice(0, MAX_BULK_DELETE);

          if (bulkArray.length === 1) {
            /* لو رسالة واحدة، نحذفها فردياً */
            await bulkArray[0].delete();
            totalDeleted += 1;
          } else {
            const deleted = await channel.bulkDelete(bulkArray, true);
            totalDeleted += deleted.size;
          }
        } catch (bulkErr) {
          console.error('[cleanChannel] فشل الحذف الجماعي:', bulkErr.message);

          /* ─── fallback: حذف فردي ─── */
          for (const msg of recentMessages.values()) {
            try {
              await msg.delete();
              totalDeleted++;
              await sleep(150); // تأخير بسيط بين كل رسالة
            } catch (e) {
              // تجاهل
            }
          }
        }
      }

      /* ─── حذف الرسائل القديمة (أكثر من 14 يوم) بشكل فردي ─── */
      for (const msg of oldMessages.values()) {
        try {
          await msg.delete();
          totalDeleted++;
          await sleep(150);
        } catch (e) {
          // تجاهل الرسائل اللي فشل حذفها
        }
      }

      /* ─── لو الروم فيه رسائل كثيرة، ننتظر شوي ─── */
      if (messages.size >= MAX_MESSAGES_PER_FETCH) {
        await sleep(DELAY_BETWEEN_FETCHES);
      } else {
        /* ─── لو جبنا أقل من 100، معناه خلصنا ─── */
        break;
      }
    }

    if (!silent) {
      console.log(`[cleanChannel] ✅ اكتمل تنظيف #${channel.name} — تم حذف ${totalDeleted} رسالة`);
    }

    return {
      success: true,
      deleted: totalDeleted,
      iterations
    };

  } catch (err) {
    console.error('[cleanChannel] خطأ غير متوقع:', err.message);
    return {
      success: false,
      error: err.message,
      deleted: totalDeleted
    };
  }
}

/* ═══════════════════════════════════════════════════════════
 *                    دوال مساعدة للاستخدام السريع
 *  ═══════════════════════════════════════════════════════════ */

/**
 * تنظيف روم ثم إرسال شيء واحد فيه
 * مفيدة للوحات اللي ترسل مرة واحدة
 *
 * @param {TextChannel} channel - الروم
 * @param {Function} sendCallback - دالة ترسل الرسالة الجديدة
 * @param {Object} options - خيارات
 * @returns {Promise<Message|null>} - الرسالة الجديدة
 */
async function cleanAndSend(channel, sendCallback, options = {}) {
  if (!channel || typeof sendCallback !== 'function') {
    return null;
  }

  /* ─── تنظيف الروم ─── */
  const cleanResult = await cleanChannel(channel, options);

  if (!cleanResult.success) {
    console.error('[cleanAndSend] فشل التنظيف:', cleanResult.error);
    /* ─── نحاول نرسل على أي حال ─── */
  }

  /* ─── إرسال الرسالة الجديدة ─── */
  try {
    return await sendCallback();
  } catch (err) {
    console.error('[cleanAndSend] فشل إرسال الرسالة:', err.message);
    return null;
  }
}

/**
 * تنظيف روم بواسطة ID
 */
async function cleanChannelById(client, channelId, options = {}) {
  if (!client || !channelId) {
    return { success: false, error: 'client أو channelId غير محدد', deleted: 0 };
  }

  try {
    const channel = await client.channels.fetch(channelId);

    if (!channel) {
      return { success: false, error: 'لم يتم العثور على الروم', deleted: 0 };
    }

    return await cleanChannel(channel, { ...options, client });

  } catch (err) {
    console.error('[cleanChannelById]', err.message);
    return { success: false, error: err.message, deleted: 0 };
  }
}

/* ═══════════════════════════════════════════════════════════
 *                    التصدير
 *  ═══════════════════════════════════════════════════════════ */

module.exports = {
  cleanChannel,
  cleanAndSend,
  cleanChannelById,
  isCleanableChannel,
  canCleanChannel,
  sleep
};