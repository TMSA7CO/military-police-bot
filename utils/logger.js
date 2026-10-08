/* ═══════════════════════════════════════════════════════════
 *  الشرطة العسكرية | وزارة الدفاع الأمريكي
 *  أداة اللوقات — Logger.js
 *  الإصدار: 1.1 (إضافة لوقات الشهادات والترقية القيادية)
 *  ═══════════════════════════════════════════════════════════ */

'use strict';

const { EmbedBuilder } = require('discord.js');
const CONFIG = require('../config');
const firebase = require('../firebase');

/* ═══════════════════════════════════════════════════════════
 *                    أنواع اللوقات
 *  ═══════════════════════════════════════════════════════════ */
const LOG_TYPES = {
  /* ─── التقديمات ─── */
  APPLICATION_SUBMITTED: 'application_submitted',
  APPLICATION_ACCEPTED: 'application_accepted',
  APPLICATION_REJECTED: 'application_rejected',

  /* ─── الأعضاء ─── */
  MEMBER_ADDED: 'member_added',
  MEMBER_REMOVED: 'member_removed',
  MEMBER_PROMOTED: 'member_promoted',
  MEMBER_DEMOTED: 'member_demoted',
  MEMBER_NAME_CHANGED: 'member_name_changed',
  MEMBER_POINTS_ADDED: 'member_points_added',
  MEMBER_POINTS_DEDUCTED: 'member_points_deducted',

  /* ─── التقارير ─── */
  REPORT_SUBMITTED: 'report_submitted',
  REPORT_APPROVED: 'report_approved',
  REPORT_REJECTED: 'report_rejected',

  /* ─── التذاكر ─── */
  TICKET_CREATED: 'ticket_created',
  TICKET_CLAIMED: 'ticket_claimed',
  TICKET_LEFT: 'ticket_left',
  TICKET_CLOSED: 'ticket_closed',
  TICKET_MEMBER_ADDED: 'ticket_member_added',
  TICKET_MEMBER_REMOVED: 'ticket_member_removed',

  /* ─── التوظيف ─── */
  RECRUITMENT_OPENED: 'recruitment_opened',
  RECRUITMENT_CLOSED: 'recruitment_closed',

  /* ─── المراقبة ─── */
  MONITOR_STARTED: 'monitor_started',
  MONITOR_STOPPED: 'monitor_stopped',
  MONITOR_RECORDING: 'monitor_recording',

  /* ─── الدعم ─── */
  SUPPORT_STARTED: 'support_started',
  SUPPORT_STOPPED: 'support_stopped',
  SUPPORT_USER_JOINED: 'support_user_joined',

  /* ─── النظام ─── */
  BOT_STARTED: 'bot_started',
  BOT_ERROR: 'bot_error',
  COMMAND_USED: 'command_used',

  /* ─── الشهادات (جديد) ─── */
  CERTIFICATE_ISSUED: 'certificate_issued',
  CERTIFICATE_REISSUED: 'certificate_reissued',
  CERTIFICATE_INVALIDATED: 'certificate_invalidated',
  CERTIFICATE_LEADERSHIP_PROMOTION: 'certificate_leadership_promotion',

  /* ─── عام ─── */
  CUSTOM: 'custom'
};

/* ═══════════════════════════════════════════════════════════
 *                    إعدادات كل نوع
 *  ═══════════════════════════════════════════════════════════ */
const LOG_CONFIG = {
  /* ─── التقديمات ─── */
  [LOG_TYPES.APPLICATION_SUBMITTED]: {
    emoji: '📥', color: CONFIG.COLORS.PRIMARY,
    title: 'تقديم جديد', titleEn: 'New Application'
  },
  [LOG_TYPES.APPLICATION_ACCEPTED]: {
    emoji: '✅', color: CONFIG.COLORS.SUCCESS,
    title: 'قبول تقديم', titleEn: 'Application Accepted'
  },
  [LOG_TYPES.APPLICATION_REJECTED]: {
    emoji: '❌', color: CONFIG.COLORS.DANGER,
    title: 'رفض تقديم', titleEn: 'Application Rejected'
  },

  /* ─── الأعضاء ─── */
  [LOG_TYPES.MEMBER_ADDED]: {
    emoji: '➕', color: CONFIG.COLORS.SUCCESS,
    title: 'إضافة عضو', titleEn: 'Member Added'
  },
  [LOG_TYPES.MEMBER_REMOVED]: {
    emoji: '🗑️', color: CONFIG.COLORS.DANGER,
    title: 'ترميج عضو', titleEn: 'Member Terminated'
  },
  [LOG_TYPES.MEMBER_PROMOTED]: {
    emoji: '⬆️', color: CONFIG.COLORS.GOLD,
    title: 'ترقية عضو', titleEn: 'Member Promoted'
  },
  [LOG_TYPES.MEMBER_DEMOTED]: {
    emoji: '⬇️', color: CONFIG.COLORS.WARNING,
    title: 'تخفيض رتبة', titleEn: 'Member Demoted'
  },
  [LOG_TYPES.MEMBER_NAME_CHANGED]: {
    emoji: '✏️', color: CONFIG.COLORS.INFO,
    title: 'تغيير اسم', titleEn: 'Name Changed'
  },
  [LOG_TYPES.MEMBER_POINTS_ADDED]: {
    emoji: '➕', color: CONFIG.COLORS.SUCCESS,
    title: 'إضافة نقاط', titleEn: 'Points Added'
  },
  [LOG_TYPES.MEMBER_POINTS_DEDUCTED]: {
    emoji: '➖', color: CONFIG.COLORS.DANGER,
    title: 'خصم نقاط', titleEn: 'Points Deducted'
  },

  /* ─── التقارير ─── */
  [LOG_TYPES.REPORT_SUBMITTED]: {
    emoji: '📄', color: CONFIG.COLORS.PRIMARY,
    title: 'تقرير جديد', titleEn: 'New Report'
  },
  [LOG_TYPES.REPORT_APPROVED]: {
    emoji: '✅', color: CONFIG.COLORS.SUCCESS,
    title: 'قبول تقرير', titleEn: 'Report Approved'
  },
  [LOG_TYPES.REPORT_REJECTED]: {
    emoji: '❌', color: CONFIG.COLORS.DANGER,
    title: 'رفض تقرير', titleEn: 'Report Rejected'
  },

  /* ─── التذاكر ─── */
  [LOG_TYPES.TICKET_CREATED]: {
    emoji: '🎫', color: CONFIG.COLORS.PRIMARY,
    title: 'تذكرة جديدة', titleEn: 'New Ticket'
  },
  [LOG_TYPES.TICKET_CLAIMED]: {
    emoji: '🛡️', color: CONFIG.COLORS.INFO,
    title: 'استلام تذكرة', titleEn: 'Ticket Claimed'
  },
  [LOG_TYPES.TICKET_LEFT]: {
    emoji: '🚪', color: CONFIG.COLORS.WARNING,
    title: 'ترك تذكرة', titleEn: 'Ticket Left'
  },
  [LOG_TYPES.TICKET_CLOSED]: {
    emoji: '🔒', color: CONFIG.COLORS.DANGER,
    title: 'إغلاق تذكرة', titleEn: 'Ticket Closed'
  },
  [LOG_TYPES.TICKET_MEMBER_ADDED]: {
    emoji: '➕', color: CONFIG.COLORS.SUCCESS,
    title: 'إضافة عضو للتذكرة', titleEn: 'Member Added to Ticket'
  },
  [LOG_TYPES.TICKET_MEMBER_REMOVED]: {
    emoji: '➖', color: CONFIG.COLORS.WARNING,
    title: 'إزالة عضو من التذكرة', titleEn: 'Member Removed from Ticket'
  },

  /* ─── التوظيف ─── */
  [LOG_TYPES.RECRUITMENT_OPENED]: {
    emoji: '🔓', color: CONFIG.COLORS.SUCCESS,
    title: 'فتح التوظيف', titleEn: 'Recruitment Opened'
  },
  [LOG_TYPES.RECRUITMENT_CLOSED]: {
    emoji: '🔒', color: CONFIG.COLORS.DANGER,
    title: 'إغلاق التوظيف', titleEn: 'Recruitment Closed'
  },

  /* ─── المراقبة ─── */
  [LOG_TYPES.MONITOR_STARTED]: {
    emoji: '👁️', color: CONFIG.COLORS.INFO,
    title: 'بدء مراقبة', titleEn: 'Monitor Started'
  },
  [LOG_TYPES.MONITOR_STOPPED]: {
    emoji: '⏹️', color: CONFIG.COLORS.GRAY,
    title: 'إيقاف مراقبة', titleEn: 'Monitor Stopped'
  },
  [LOG_TYPES.MONITOR_RECORDING]: {
    emoji: '🎙️', color: CONFIG.COLORS.WARNING,
    title: 'تسجيل صوتي', titleEn: 'Voice Recording'
  },

  /* ─── الدعم ─── */
  [LOG_TYPES.SUPPORT_STARTED]: {
    emoji: '🎧', color: CONFIG.COLORS.INFO,
    title: 'بدء دعم', titleEn: 'Support Started'
  },
  [LOG_TYPES.SUPPORT_STOPPED]: {
    emoji: '⏹️', color: CONFIG.COLORS.GRAY,
    title: 'إنهاء دعم', titleEn: 'Support Stopped'
  },
  [LOG_TYPES.SUPPORT_USER_JOINED]: {
    emoji: '🔔', color: CONFIG.COLORS.WARNING,
    title: 'انضمام للدعم', titleEn: 'User Joined Support'
  },

  /* ─── النظام ─── */
  [LOG_TYPES.BOT_STARTED]: {
    emoji: '🚀', color: CONFIG.COLORS.SUCCESS,
    title: 'تشغيل البوت', titleEn: 'Bot Started'
  },
  [LOG_TYPES.BOT_ERROR]: {
    emoji: '⚠️', color: CONFIG.COLORS.DANGER,
    title: 'خطأ في البوت', titleEn: 'Bot Error'
  },
  [LOG_TYPES.COMMAND_USED]: {
    emoji: '⌨️', color: CONFIG.COLORS.GRAY,
    title: 'استخدام أمر', titleEn: 'Command Used'
  },

  /* ─── الشهادات (جديد) ─── */
  [LOG_TYPES.CERTIFICATE_ISSUED]: {
    emoji: '🎖️', color: CONFIG.COLORS.GOLD,
    title: 'إصدار شهادة', titleEn: 'Certificate Issued'
  },
  [LOG_TYPES.CERTIFICATE_REISSUED]: {
    emoji: '🔄', color: CONFIG.COLORS.WARNING,
    title: 'إعادة إصدار شهادة', titleEn: 'Certificate Reissued'
  },
  [LOG_TYPES.CERTIFICATE_INVALIDATED]: {
    emoji: '❌', color: CONFIG.COLORS.DANGER,
    title: 'إبطال شهادة', titleEn: 'Certificate Invalidated'
  },
  [LOG_TYPES.CERTIFICATE_LEADERSHIP_PROMOTION]: {
    emoji: '👑', color: CONFIG.COLORS.GOLD,
    title: 'ترقية قيادية', titleEn: 'Leadership Promotion'
  },

  /* ─── عام ─── */
  [LOG_TYPES.CUSTOM]: {
    emoji: '📋', color: CONFIG.COLORS.PRIMARY,
    title: 'سجل', titleEn: 'Log'
  }
};

/* ═══════════════════════════════════════════════════════════
 *                    الدالة الرئيسية
 *  ═══════════════════════════════════════════════════════════ */

async function sendLog(client, type, data = {}) {
  try {
    if (!client) {
      console.error('[sendLog] client غير محدد');
      return null;
    }

    const logConfig = LOG_CONFIG[type] || LOG_CONFIG[LOG_TYPES.CUSTOM];
    const channelId = CONFIG.CHANNELS.LOGS;

    if (!channelId) {
      console.error('[sendLog] CHANNEL_LOGS غير محدد');
      return null;
    }

    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel) {
      console.error('[sendLog] لم يتم العثور على قناة السجلات');
      return null;
    }

    const embed = new EmbedBuilder()
      .setColor(logConfig.color)
      .setTitle(`${logConfig.emoji} ${logConfig.title} | ${logConfig.titleEn}`)
      .setTimestamp(new Date())
      .setFooter({
        text: CONFIG.TEXT.FOOTER,
        iconURL: client.user.displayAvatarURL()
      });

    if (data.description) embed.setDescription(data.description);

    if (data.fields && Array.isArray(data.fields) && data.fields.length > 0) {
      const fields = data.fields.slice(0, 25).map(f => ({
        name: f.name || '—',
        value: String(f.value || '—').substring(0, 1024),
        inline: f.inline === true
      }));
      embed.addFields(fields);
    }

    if (data.userId) {
      embed.addFields({
        name: '👤 المستخدم',
        value: `<@${data.userId}> (\`${data.userId}\`)`,
        inline: true
      });
    }

    if (data.imageUrl) embed.setImage(data.imageUrl);
    if (data.thumbnailUrl) embed.setThumbnail(data.thumbnailUrl);

    const message = await channel.send({ embeds: [embed] });

    try {
      await firebase.saveLog(type, {
        ...data,
        messageId: message.id,
        channelId: channel.id,
        type,
        loggedAt: Date.now()
      });
    } catch (fbErr) {
      console.warn('[sendLog] فشل حفظ اللوق في Firebase:', fbErr.message);
    }

    return message;

  } catch (err) {
    console.error('[sendLog] خطأ:', err.message);
    return null;
  }
}

/* ═══════════════════════════════════════════════════════════
 *              Shortcuts — التقديمات
 *  ═══════════════════════════════════════════════════════════ */

async function logApplicationSubmitted(client, data) {
  return sendLog(client, LOG_TYPES.APPLICATION_SUBMITTED, {
    description: `تم استلام تقديم جديد من **${data.name}**`,
    fields: [
      { name: '📌 الاسم', value: data.name || '—', inline: true },
      { name: '📌 العمر', value: String(data.age || '—'), inline: true },
      { name: '🆔 آيدي الطلب', value: `\`${data.applicationId || '—'}\``, inline: false }
    ],
    userId: data.discordId,
    userName: data.name
  });
}

async function logApplicationAccepted(client, data) {
  return sendLog(client, LOG_TYPES.APPLICATION_ACCEPTED, {
    description: `تم **قبول** تقديم **${data.name}**`,
    fields: [
      { name: '🆔 الرقم العسكري', value: `\`${data.militaryId || '—'}\``, inline: true },
      { name: '🎖️ الرتبة', value: 'Military Police Trainee', inline: true },
      { name: '✅ تم بواسطة', value: data.by ? `<@${data.by}>` : '—', inline: false }
    ],
    userId: data.discordId,
    userName: data.name
  });
}

async function logApplicationRejected(client, data) {
  return sendLog(client, LOG_TYPES.APPLICATION_REJECTED, {
    description: `تم **رفض** تقديم **${data.name}**`,
    fields: [
      { name: '❌ تم بواسطة', value: data.by ? `<@${data.by}>` : '—', inline: true },
      { name: '📝 السبب', value: data.reason || 'لم يُحدد', inline: false }
    ],
    userId: data.discordId,
    userName: data.name
  });
}

/* ─── الأعضاء ─── */
async function logMemberAdded(client, data) {
  return sendLog(client, LOG_TYPES.MEMBER_ADDED, {
    description: `تم إضافة عضو جديد للسلك`,
    fields: [
      { name: '👤 الاسم', value: data.name || '—', inline: true },
      { name: '🆔 الرقم', value: `\`${data.militaryId || '—'}\``, inline: true },
      { name: '🎖️ الرتبة', value: CONFIG.getRoleNameEnglish(data.roleId) || '—', inline: false },
      { name: '➕ تم بواسطة', value: data.by ? `<@${data.by}>` : 'النظام', inline: false }
    ],
    userId: data.discordId,
    userName: data.name
  });
}

async function logMemberRemoved(client, data) {
  return sendLog(client, LOG_TYPES.MEMBER_REMOVED, {
    description: `تم **ترميج** العضو من السلك`,
    fields: [
      { name: '👤 الاسم', value: data.name || '—', inline: true },
      { name: '🆔 الرقم السابق', value: `\`${data.militaryId || '—'}\``, inline: true },
      { name: '⭐ النقاط المحذوفة', value: String(data.points || 0), inline: true },
      { name: '🗑️ تم بواسطة', value: data.by ? `<@${data.by}>` : '—', inline: false },
      { name: '📝 السبب', value: data.reason || 'لم يُحدد', inline: false },
      { name: '🔄 الأعضاء المُعاد ترقيمهم', value: String(data.reordered || 0), inline: true }
    ],
    userId: data.discordId,
    userName: data.name
  });
}

async function logNameChanged(client, data) {
  return sendLog(client, LOG_TYPES.MEMBER_NAME_CHANGED, {
    description: `تم تغيير اسم العضو`,
    fields: [
      { name: '📛 الاسم القديم', value: `\`${data.oldName || '—'}\``, inline: false },
      { name: '✨ الاسم الجديد', value: `\`${data.newName || '—'}\``, inline: false },
      { name: '✏️ تم بواسطة', value: data.by ? `<@${data.by}>` : '—', inline: false }
    ],
    userId: data.discordId,
    userName: data.newName
  });
}

async function logPointsAdded(client, data) {
  return sendLog(client, LOG_TYPES.MEMBER_POINTS_ADDED, {
    description: `تم إضافة **${data.points}** نقطة للعضو`,
    fields: [
      { name: '👤 العضو', value: `<@${data.discordId}>`, inline: true },
      { name: '➕ النقاط المضافة', value: `\`+${data.points}\``, inline: true },
      { name: '📊 الرصيد', value: `\`${data.oldPoints}\` → \`${data.newPoints}\``, inline: false },
      { name: '📝 السبب', value: data.reason || '—', inline: false },
      { name: '👤 تم بواسطة', value: data.by ? `<@${data.by}>` : '—', inline: false }
    ],
    userId: data.discordId,
    userName: data.name
  });
}

async function logPointsDeducted(client, data) {
  return sendLog(client, LOG_TYPES.MEMBER_POINTS_DEDUCTED, {
    description: `تم خصم **${data.points}** نقطة من العضو`,
    fields: [
      { name: '👤 العضو', value: `<@${data.discordId}>`, inline: true },
      { name: '➖ النقاط المخصومة', value: `\`-${data.points}\``, inline: true },
      { name: '📊 الرصيد', value: `\`${data.oldPoints}\` → \`${data.newPoints}\``, inline: false },
      { name: '📝 السبب', value: data.reason || '—', inline: false },
      { name: '👤 تم بواسطة', value: data.by ? `<@${data.by}>` : '—', inline: false }
    ],
    userId: data.discordId,
    userName: data.name
  });
}

/* ─── التقارير ─── */
async function logReportSubmitted(client, data) {
  return sendLog(client, LOG_TYPES.REPORT_SUBMITTED, {
    description: `تم استلام تقرير جديد من **${data.name}**`,
    fields: [
      { name: '📌 الاسم', value: data.name || '—', inline: true },
      { name: '🆔 الرقم', value: `\`${data.militaryId || '—'}\``, inline: true },
      { name: '📝 نوع التقرير', value: data.reportType || '—', inline: false }
    ],
    userId: data.discordId,
    userName: data.name
  });
}

async function logReportApproved(client, data) {
  return sendLog(client, LOG_TYPES.REPORT_APPROVED, {
    description: `تم **قبول** التقرير`,
    fields: [
      { name: '👤 العضو', value: `<@${data.discordId}>`, inline: true },
      { name: '⭐ النقاط المُضافة', value: `\`+${data.points || 1}\``, inline: true },
      { name: '📊 الرصيد الجديد', value: `\`${data.newPoints || '—'}\``, inline: true },
      { name: '✅ تم بواسطة', value: data.by ? `<@${data.by}>` : '—', inline: false }
    ],
    userId: data.discordId,
    userName: data.name
  });
}

async function logReportRejected(client, data) {
  return sendLog(client, LOG_TYPES.REPORT_REJECTED, {
    description: `تم **رفض** التقرير`,
    fields: [
      { name: '👤 العضو', value: `<@${data.discordId}>`, inline: true },
      { name: '📝 السبب', value: data.reason || '—', inline: false },
      { name: '❌ تم بواسطة', value: data.by ? `<@${data.by}>` : '—', inline: false }
    ],
    userId: data.discordId,
    userName: data.name
  });
}

/* ─── التذاكر ─── */
async function logTicketCreated(client, data) {
  return sendLog(client, LOG_TYPES.TICKET_CREATED, {
    description: `تذكرة جديدة تم إنشاؤها`,
    fields: [
      { name: '🎫 النوع', value: data.ticketType === 'army' ? 'شكوى ضد عسكري' : 'شكوى ضد شرطي عسكري', inline: true },
      { name: '🆔 رقم التذكرة', value: `\`${data.ticketId || '—'}\``, inline: true },
      { name: '👤 مقدم الشكوى', value: `<@${data.creatorId}>`, inline: false },
      { name: '📝 المشتكى عليه', value: data.targetName || '—', inline: false }
    ],
    userId: data.creatorId,
    userName: data.creatorName
  });
}

async function logTicketClaimed(client, data) {
  return sendLog(client, LOG_TYPES.TICKET_CLAIMED, {
    description: `تم استلام التذكرة`,
    fields: [
      { name: '🆔 رقم التذكرة', value: `\`${data.ticketId}\``, inline: true },
      { name: '🛡️ تم بواسطة', value: `<@${data.by}>`, inline: true }
    ],
    userId: data.by,
    userName: data.claimerName
  });
}

async function logTicketClosed(client, data) {
  return sendLog(client, LOG_TYPES.TICKET_CLOSED, {
    description: `تم إغلاق التذكرة`,
    fields: [
      { name: '🆔 رقم التذكرة', value: `\`${data.ticketId}\``, inline: true },
      { name: '👤 صاحب التذكرة', value: data.creatorId ? `<@${data.creatorId}>` : '—', inline: true },
      { name: '🔒 تم بواسطة', value: data.by ? `<@${data.by}>` : '—', inline: false },
      { name: '🔗 رابط الأرشفة', value: data.archiveUrl || 'غير متوفر', inline: false }
    ]
  });
}

/* ─── التوظيف ─── */
async function logRecruitmentStatus(client, isOpen, by) {
  return sendLog(client, isOpen ? LOG_TYPES.RECRUITMENT_OPENED : LOG_TYPES.RECRUITMENT_CLOSED, {
    description: isOpen ? '🔓 تم **فتح** التوظيف' : '🔒 تم **إغلاق** التوظيف',
    fields: [
      { name: '👤 بواسطة', value: by ? `<@${by}>` : '—', inline: true },
      { name: '🕒 الوقت', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
    ],
    userId: by
  });
}

/* ─── النظام ─── */
async function logBotStarted(client) {
  return sendLog(client, LOG_TYPES.BOT_STARTED, {
    description: 'تم تشغيل البوت بنجاح',
    fields: [
      { name: '🤖 البوت', value: `<@${client.user.id}>`, inline: true },
      { name: '📊 السيرفرات', value: String(client.guilds.cache.size), inline: true },
      { name: '👥 المستخدمين', value: String(client.users.cache.size), inline: true }
    ]
  });
}

async function logError(client, error, context = '') {
  return sendLog(client, LOG_TYPES.BOT_ERROR, {
    description: `خطأ في البوت`,
    fields: [
      { name: '❌ الخطأ', value: `\`\`\`${String(error).substring(0, 1000)}\`\`\``, inline: false },
      { name: '📍 السياق', value: context || 'غير محدد', inline: false }
    ]
  });
}

/* ═══════════════════════════════════════════════════════════
 *              Shortcuts — الشهادات (جديد)
 *  ═══════════════════════════════════════════════════════════ */

async function logCertificateIssued(client, data) {
  return sendLog(client, LOG_TYPES.CERTIFICATE_ISSUED, {
    description: `تم إصدار شهادة تعيين`,
    fields: [
      { name: '👤 الاسم', value: data.name || '—', inline: true },
      { name: '🆔 الرقم', value: `\`${data.militaryId || '—'}\``, inline: true },
      { name: '🎖️ الرتبة', value: data.roleName || '—', inline: true },
      { name: '🔢 رقم الشهادة', value: `\`${data.certificateNumber || '—'}\``, inline: false }
    ],
    userId: data.discordId,
    userName: data.name
  });
}

async function logCertificateReissued(client, data) {
  return sendLog(client, LOG_TYPES.CERTIFICATE_REISSUED, {
    description: `تم إعادة إصدار شهادة بعد تحديث البيانات`,
    fields: [
      { name: '👤 الاسم', value: data.name || '—', inline: true },
      { name: '🆔 الرقم الجديد', value: `\`${data.militaryId || '—'}\``, inline: true },
      { name: '🔄 الشهادات المستبدلة', value: String(data.supersededCount || 0), inline: true },
      { name: '📝 السبب', value: data.reason || '—', inline: false },
      { name: '🔢 رقم الشهادة الجديدة', value: `\`${data.certificateNumber || '—'}\``, inline: false }
    ],
    userId: data.discordId,
    userName: data.name
  });
}

async function logCertificateInvalidated(client, data) {
  return sendLog(client, LOG_TYPES.CERTIFICATE_INVALIDATED, {
    description: `تم إبطال شهادات العضو`,
    fields: [
      { name: '👤 الاسم', value: data.name || '—', inline: true },
      { name: '🆔 الرقم السابق', value: `\`${data.militaryId || '—'}\``, inline: true },
      { name: '📊 عدد الشهادات المُبطلة', value: String(data.count || 0), inline: true },
      { name: '📝 السبب', value: data.reason || '—', inline: false }
    ],
    userId: data.discordId,
    userName: data.name
  });
}

async function logLeadershipPromotion(client, data) {
  const fields = [
    { name: '👑 الرتبة الجديدة', value: CONFIG.getRoleNameEnglish(data.newRoleId), inline: true },
    { name: '🆔 الرقم الجديد', value: `\`${data.newMilitaryId}\``, inline: true },
    { name: '📅 التاريخ', value: `<t:${Math.floor(Date.now() / 1000)}:D>`, inline: true }
  ];

  if (data.displaced) {
    fields.push({
      name: '🔄 الشخص المُزاح',
      value: `<@${data.displaced.discordId}> — رتبته الجديدة: ${CONFIG.getRoleNameEnglish(data.displaced.newRoleId)}`,
      inline: false
    });
  }

  return sendLog(client, LOG_TYPES.CERTIFICATE_LEADERSHIP_PROMOTION, {
    description: `تم ترقية <@${data.discordId}> إلى رتبة قيادية`,
    fields,
    userId: data.discordId,
    userName: data.name
  });
}

/* ═══════════════════════════════════════════════════════════
 *                    التصدير
 *  ═══════════════════════════════════════════════════════════ */

module.exports = {
  /* الثوابت */
  LOG_TYPES,

  /* الدالة الرئيسية */
  sendLog,

  /* التقديمات */
  logApplicationSubmitted,
  logApplicationAccepted,
  logApplicationRejected,

  /* الأعضاء */
  logMemberAdded,
  logMemberRemoved,
  logNameChanged,
  logPointsAdded,
  logPointsDeducted,

  /* التقارير */
  logReportSubmitted,
  logReportApproved,
  logReportRejected,

  /* التذاكر */
  logTicketCreated,
  logTicketClaimed,
  logTicketClosed,

  /* التوظيف */
  logRecruitmentStatus,

  /* النظام */
  logBotStarted,
  logError,

  /* الشهادات (جديد) */
  logCertificateIssued,
  logCertificateReissued,
  logCertificateInvalidated,
  logLeadershipPromotion
};