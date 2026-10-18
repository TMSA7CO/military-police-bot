/* ═══════════════════════════════════════════════════════════
 *  الشرطة العسكرية | وزارة الدفاع الأمريكي
 *  حدث القنوات الصوتية — VoiceStateUpdate.js
 *  الإصدار: 2.0
 *  الوظيفة: إشعارات بوت الدعم فقط
 *  (تمت إزالة نظام المراقبة نهائياً)
 *  ═══════════════════════════════════════════════════════════ */

'use strict';

const { Events, EmbedBuilder } = require('discord.js');

const CONFIG = require('../config');
const logger = require('../utils/logger');
const embeds = require('../utils/embeds');

/* ═══════════════════════════════════════════════════════════
 *              خريطة جلسات الدعم (احتياطية)
 *  ═══════════════════════════════════════════════════════════
 *  ⚠️ ملاحظة: الإدارة الفعلية للجلسات موجودة في
 *  commands/support-bot.js داخل activeSupportSessions هناك.
 *  هذا التصدير احتياطي للتوافق مع أي كود قديم.
 */
const activeSupportSessions = new Map();

/* ═══════════════════════════════════════════════════════════
 *              انضمام شخص لقناة بوت الدعم
 *  ═══════════════════════════════════════════════════════════ */

async function handleSupportBotJoin(client, newState, oldState) {
  /* ─── تجاهل التغييرات غير المهمة ─── */
  if (!newState.channelId || newState.channelId === oldState.channelId) return;

  const channel = newState.channel;
  if (!channel) return;

  /* ─── هل القناة هي قناة الدعم؟ ─── */
  const supportChannelId = CONFIG.CHANNELS.SUPPORT_WAITING;
  if (!supportChannelId || channel.id !== supportChannelId) return;

  /* ─── تجاهل البوتات ─── */
  if (newState.member.user.bot) return;

  /* ─── هل البوت موجود في القناة؟ ─── */
  const botMember = channel.members.get(client.user.id);
  if (!botMember) return;

  /* ─── إرسال إشعار ─── */
  try {
    const notifyChannel = await client.channels.fetch(supportChannelId).catch(() => null);
    if (!notifyChannel) return;

    const notifyTextChannel = notifyChannel.isTextBased()
      ? notifyChannel
      : await client.channels.fetch(CONFIG.CHANNELS.SUPPORT_WAITING).catch(() => null);

    if (!notifyTextChannel) return;

    /* ─── إمبيد الإشعار ─── */
    const embed = embeds.supportUserJoined(client, {
      userId: newState.member.id,
      username: newState.member.user.tag,
      channelName: channel.name
    });

    /* ─── منشن الرتب ─── */
    const mentionRoles = [
      CONFIG.ROLES.MP_OFFICER,
      CONFIG.ROLES.MP_TRAINEE
    ].map(r => `<@&${r}>`).join(' ');

    await notifyTextChannel.send({
      content: `${mentionRoles} 🔔 شخص في الانتظار`,
      embeds: [embed]
    }).catch(err => console.error('[Support] فشل الإرسال:', err.message));

    /* ─── لوق ─── */
    await logger.sendLog(client, 'support_user_joined', {
      description: `شخص دخل قناة الانتظار`,
      fields: [
        { name: '👤 المستخدم', value: `<@${newState.member.id}>`, inline: true },
        { name: '🎤 القناة', value: channel.name, inline: true }
      ],
      userId: newState.member.id,
      userName: newState.member.user.tag
    }).catch(() => {});

  } catch (err) {
    console.error('[SupportBotJoin]', err.message);
  }
}

/* ═══════════════════════════════════════════════════════════
 *              مغادرة شخص لقناة بوت الدعم
 *  ═══════════════════════════════════════════════════════════ */

async function handleSupportBotLeave(client, newState, oldState) {
  if (!oldState.channelId || newState.channelId === oldState.channelId) return;

  const channel = oldState.channel;
  if (!channel) return;

  const supportChannelId = CONFIG.CHANNELS.SUPPORT_WAITING;
  if (!supportChannelId || channel.id !== supportChannelId) return;

  if (oldState.member.user.bot) return;

  /* ─── هل البوت لا يزال في القناة؟ ─── */
  const botMember = channel.members.get(client.user.id);
  if (!botMember) return;

  /* ─── هل بقي أحد في القناة غير البوت؟ ─── */
  const remainingHumans = channel.members.filter(m => !m.user.bot);
  if (remainingHumans.size === 0) return;

  /* ─── إشعار المغادرة ─── */
  try {
    const notifyChannel = await client.channels.fetch(supportChannelId).catch(() => null);
    if (!notifyChannel || !notifyChannel.isTextBased()) return;

    const embed = new EmbedBuilder()
      .setColor(CONFIG.COLORS.GRAY)
      .setAuthor({
        name: 'الشرطة العسكرية — بوت الدعم',
        iconURL: client.user.displayAvatarURL()
      })
      .setTitle('👋 غادر قناة الانتظار')
      .setDescription(`**${oldState.member.user.tag}** غادر القناة الصوتية.`)
      .addFields(
        { name: '👤 المستخدم', value: `<@${oldState.member.id}>`, inline: true },
        { name: '🎤 القناة', value: channel.name, inline: true }
      )
      .setFooter({
        text: CONFIG.TEXT.FOOTER,
        iconURL: client.user.displayAvatarURL()
      })
      .setTimestamp();

    await notifyChannel.send({ embeds: [embed] }).catch(() => {});

  } catch (err) {
    console.error('[SupportBotLeave]', err.message);
  }
}

/* ═══════════════════════════════════════════════════════════
 *              الحدث الرئيسي
 *  ═══════════════════════════════════════════════════════════ */

module.exports = {
  name: Events.VoiceStateUpdate,

  async execute(oldState, newState, client) {
    try {
      await handleSupportBotJoin(client, newState, oldState);
      await handleSupportBotLeave(client, newState, oldState);
    } catch (err) {
      console.error('[VoiceStateUpdate] خطأ:', err.message);
    }
  },

  activeSupportSessions
};