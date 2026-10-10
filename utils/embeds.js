/* ═══════════════════════════════════════════════════════════
 *  الشرطة العسكرية | وزارة الدفاع الأمريكي
 *  أداة الإمبيدات — Embeds.js
 *  الإصدار: 1.0
 *  الوظيفة: قوالب إمبيدات جاهزة للاستخدام
 *  ═══════════════════════════════════════════════════════════ */

'use strict';

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const CONFIG = require('../config');

/* ═══════════════════════════════════════════════════════════
 *                    إعدادات عامة
 *  ═══════════════════════════════════════════════════════════ */

/**
 * الفوتر الموحد
 */
function getFooter(client) {
  return {
    text: CONFIG.TEXT.FOOTER,
    iconURL: client && client.user ? client.user.displayAvatarURL() : undefined
  };
}

/**
 * الوقت الحالي
 */
function now() {
  return new Date();
}

/* ═══════════════════════════════════════════════════════════
 *                    إمبيدات عامة
 *  ═══════════════════════════════════════════════════════════ */

/**
 * إمبيد نجاح
 */
function success(client, title, description, fields = []) {
  const embed = new EmbedBuilder()
    .setColor(CONFIG.COLORS.SUCCESS)
    .setTitle(`${CONFIG.EMOJIS.ACCEPT} ${title}`)
    .setTimestamp(now())
    .setFooter(getFooter(client));

  if (description) embed.setDescription(description);
  if (fields.length > 0) embed.addFields(fields);

  return embed;
}

/**
 * إمبيد خطأ
 */
function error(client, title, description, fields = []) {
  const embed = new EmbedBuilder()
    .setColor(CONFIG.COLORS.DANGER)
    .setTitle(`${CONFIG.EMOJIS.CROSS} ${title}`)
    .setTimestamp(now())
    .setFooter(getFooter(client));

  if (description) embed.setDescription(description);
  if (fields.length > 0) embed.addFields(fields);

  return embed;
}

/**
 * إمبيد تحذير
 */
function warning(client, title, description, fields = []) {
  const embed = new EmbedBuilder()
    .setColor(CONFIG.COLORS.WARNING)
    .setTitle(`${CONFIG.EMOJIS.WARNING} ${title}`)
    .setTimestamp(now())
    .setFooter(getFooter(client));

  if (description) embed.setDescription(description);
  if (fields.length > 0) embed.addFields(fields);

  return embed;
}

/**
 * إمبيد معلومات
 */
function info(client, title, description, fields = []) {
  const embed = new EmbedBuilder()
    .setColor(CONFIG.COLORS.INFO)
    .setTitle(`${CONFIG.EMOJIS.INFO} ${title}`)
    .setTimestamp(now())
    .setFooter(getFooter(client));

  if (description) embed.setDescription(description);
  if (fields.length > 0) embed.addFields(fields);

  return embed;
}

/**
 * إمبيد أساسي مخصص
 */
function custom(client, { title, description, color, fields, imageUrl, thumbnailUrl, footer, author }) {
  const embed = new EmbedBuilder()
    .setTimestamp(now())
    .setFooter(footer || getFooter(client));

  if (title) embed.setTitle(title);
  if (description) embed.setDescription(description);
  if (color) embed.setColor(color);
  if (fields && fields.length > 0) embed.addFields(fields.slice(0, 25));
  if (imageUrl) embed.setImage(imageUrl);
  if (thumbnailUrl) embed.setThumbnail(thumbnailUrl);
  if (author) embed.setAuthor(author);

  return embed;
}

/* ═══════════════════════════════════════════════════════════
 *                    إمبيدات التقديمات
 *  ═══════════════════════════════════════════════════════════ */

/**
 * إمبيد تقديم جديد (يُرسل لقناة الإدارة)
 */
function applicationEmbed(client, application) {
  const embed = new EmbedBuilder()
    .setColor(CONFIG.COLORS.PRIMARY)
    .setTitle('📥 تقديم جديد | الشرطة العسكرية')
    .setDescription(`تم استلام تقديم جديد يحتاج للمراجعة`)
    .addFields(
      { name: '📌 الاسم', value: application.name || '—', inline: true },
      { name: '📌 العمر', value: String(application.age || '—'), inline: true },
      { name: '📌 التوقيت', value: application.timezone || 'غير محدد', inline: true },
      { name: '📌 الخبرة', value: String(application.experience || '—').substring(0, 1024) },
      { name: '📌 الساعات المتاحة', value: application.hours || '—', inline: true },
      { name: '📌 مايك', value: application.hasMic || '—', inline: true },
      { name: '📌 سبب الانضمام', value: String(application.reason || '—').substring(0, 1024) },
      { name: '📌 الآيدي', value: `<@${application.discordId}>`, inline: true },
      { name: '📌 آيدي السيرفر', value: `\`${application.serverId || '—'}\``, inline: true }
    )
    .setFooter({
      text: `Application ID: ${application.id || '—'}`,
      iconURL: client.user.displayAvatarURL()
    })
    .setTimestamp(now());

  if (application.image) {
    embed.setImage(application.image);
  }

  return embed;
}

/**
 * أزرار قبول/رفض التقديم
 */
function applicationButtons(applicationId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`app_accept_${applicationId}`)
      .setLabel('قبول')
      .setEmoji('✅')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`app_reject_${applicationId}`)
      .setLabel('رفض')
      .setEmoji('❌')
      .setStyle(ButtonStyle.Danger)
  );
}

/* ═══════════════════════════════════════════════════════════
 *                    إمبيدات الشهادات
 *  ═══════════════════════════════════════════════════════════ */

/**
 * شهادة التعيين الرسمية
 */
function appointmentCertificate(client, data) {
  const {
    name,
    militaryId,
    roleName,
    roleNameAr,
    joinDate,
    certificateNumber
  } = data;

  const embed = new EmbedBuilder()
    .setColor(CONFIG.COLORS.GOLD)
    .setAuthor({
      name: 'وزارة الدفاع الأمريكي',
      iconURL: client.user.displayAvatarURL()
    })
    .setTitle('🎖️ شهادة تعيين رسمية')
    .setDescription(
      '**بسم الله الرحمن الرحيم**\n\n' +
      'تُمنح هذه الشهادة الرسمية\n\n' +
      `**${name}**\n\n` +
      'بمناسبة تعيينه رسمياً في سلك\n' +
      '**الشرطة العسكرية — وزارة الدفاع الأمريكي**\n\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━━'
    )
    .addFields(
      { name: '🆔 الرقم العسكري', value: `\`${militaryId}\``, inline: true },
      { name: '🎖️ الرتبة', value: roleName || '—', inline: true },
      { name: '📅 تاريخ التعيين', value: joinDate || new Date().toLocaleDateString('ar-EG'), inline: true },
      { name: '🔢 رقم الشهادة', value: `\`${certificateNumber || '—'}\``, inline: true },
      { name: '✍️ التوقيع', value: '**Commander** — الشرطة العسكرية', inline: false }
    )
    .setImage('attachment://certificate_banner.png')
    .setFooter({
      text: 'Military Police — Ministry of Defense',
      iconURL: client.user.displayAvatarURL()
    })
    .setTimestamp(now());

  return embed;
}

/* ═══════════════════════════════════════════════════════════
 *                    إمبيدات التوظيف
 *  ═══════════════════════════════════════════════════════════ */

/**
 * لوحة التحكم بالتوظيف
 */
function recruitmentPanel(client, isOpen) {
  const statusText = isOpen
    ? '🟢 **التوظيف مفتوح حالياً** — يمكنك التقديم الآن'
    : '🔴 **التوظيف مغلق حالياً** — يرجى المحاولة لاحقاً';

  const description = isOpen
    ? 'الشرطة العسكرية — وزارة الدفاع الأمريكي\n\n' +
      '**نستقبل تقديمات جديدة الآن!**\n\n' +
      'انضم إلى نخبة القوات العسكرية وتعرّف على الرتب الخمس، القوانين، ونظام التقديم الرسمي.'
    : 'الشرطة العسكرية — وزارة الدفاع الأمريكي\n\n' +
      '**التوظيف مغلق حالياً**\n\n' +
      'يرجى متابعة السيرفر للإعلان عن فتح التوظيف قريباً.';

  /* ✅ رابط التقديم من CONFIG */
  const applyUrl = CONFIG.TEXT.APPLY_URL || 'https://military-police-website.onrender.com/apply';
  const discordUrl = CONFIG.TEXT.INVITE || 'https://discord.gg/nUv3zrG5rZ';

  const embed = new EmbedBuilder()
    .setColor(isOpen ? CONFIG.COLORS.SUCCESS : CONFIG.COLORS.DANGER)
    .setAuthor({
      name: 'وزارة الدفاع الأمريكي',
      iconURL: client.user.displayAvatarURL()
    })
    .setTitle('🎖️ لوحة التحكم بالتوظيف | Recruitment Control')
    .setDescription(description)
    .addFields(
      { name: '📊 الحالة', value: statusText, inline: false },
      {
        name: '📝 رابط التقديم',
        value: isOpen
          ? `[🔗 تقديم الآن](${applyUrl})`
          : `[🔗 الموقع الرسمي](${applyUrl})`,
        inline: true
      },
      { name: '💬 الديسكورد', value: `[💬 سيرفر الديسكورد](${discordUrl})`, inline: true }
    )
    .setFooter(getFooter(client))
    .setTimestamp(now());

  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('recruitment_open')
      .setLabel('فتح التوظيف')
      .setEmoji('🔓')
      .setStyle(ButtonStyle.Success)
      .setDisabled(isOpen),
    new ButtonBuilder()
      .setCustomId('recruitment_close')
      .setLabel('إغلاق التوظيف')
      .setEmoji('🔒')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(!isOpen),
    new ButtonBuilder()
      .setCustomId('recruitment_status')
      .setLabel('تحديث الحالة')
      .setEmoji('🔄')
      .setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [buttons] };
}

/* ═══════════════════════════════════════════════════════════
 *                    إمبيدات التذاكر
 *  ═══════════════════════════════════════════════════════════ */

/**
 * لوحة التذاكر الرئيسية
 */
function ticketsPanel(client) {
  const embed = new EmbedBuilder()
    .setColor(CONFIG.COLORS.PRIMARY)
    .setAuthor({
      name: 'وزارة الدفاع الأمريكي',
      iconURL: client.user.displayAvatarURL()
    })
    .setTitle('🎫 لوحة التذاكر | الشرطة العسكرية')
    .setDescription(
      'اختر نوع التذكرة التي تريد فتحها:\n\n' +
      '**🎯 شكوى ضد عسكري**\n' +
      'لتقديم شكوى رسمية ضد أحد أفراد القوات العسكرية\n\n' +
      '**🎖️ شكوى ضد شرطي عسكري**\n' +
      'لتقديم شكوى رسمية ضد أحد أعضاء الشرطة العسكرية\n\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
      '⚠️ **ملاحظة:** الشكاوى الكاذبة تعرض صاحبها للمحاسبة'
    )
    .setFooter(getFooter(client))
    .setTimestamp(now());

  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_army')
      .setLabel('شكوى ضد عسكري')
      .setEmoji('🎯')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('ticket_mp')
      .setLabel('شكوى ضد شرطي عسكري')
      .setEmoji('🎖️')
      .setStyle(ButtonStyle.Danger)
  );

  return { embeds: [embed], components: [buttons] };
}

/**
 * إمبيد التذكرة داخل الروم
 */
function ticketEmbed(client, ticketData) {
  const embed = new EmbedBuilder()
    .setColor(ticketData.type === 'army' ? CONFIG.COLORS.PRIMARY : CONFIG.COLORS.DANGER)
    .setAuthor({
      name: 'الشرطة العسكرية — وزارة الدفاع',
      iconURL: client.user.displayAvatarURL()
    })
    .setTitle(`🎫 تذكرة #${ticketData.ticketId}`)
    .setDescription(
      ticketData.type === 'army'
        ? '**شكوى ضد عسكري**'
        : '**شكوى ضد شرطي عسكري**'
    )
    .addFields(
      { name: '📌 اسم مقدم الشكوى', value: ticketData.creatorName || '—', inline: true },
      { name: '🆔 آيدي مقدم الشكوى', value: `\`${ticketData.creatorId || '—'}\``, inline: true },
      { name: '👤 صاحب الحساب', value: `<@${ticketData.creatorDiscordId}>`, inline: false },
      { name: '📌 اسم المشتكى عليه', value: ticketData.targetName || '—', inline: true },
      { name: '🆔 آيدي المشتكى عليه', value: `\`${ticketData.targetId || 'غير محدد'}\``, inline: true },
      { name: '💬 ديسكورد المشتكى عليه', value: ticketData.targetDiscordId ? `<@${ticketData.targetDiscordId}>` : 'غير محدد', inline: false },
      { name: '📝 تفاصيل الشكوى', value: String(ticketData.details || '—').substring(0, 1024) }
    )
    .setFooter({
      text: `Ticket ID: ${ticketData.ticketId}`,
      iconURL: client.user.displayAvatarURL()
    })
    .setTimestamp(now());

  if (ticketData.proofUrl) {
    embed.addFields({ name: '🔗 رابط الأدلة', value: ticketData.proofUrl, inline: false });
  }

  if (ticketData.proofImages && ticketData.proofImages.length > 0) {
    embed.setImage(ticketData.proofImages[0]);
  }

  return embed;
}

/**
 * أزرار استلام التذكرة
 */
function ticketClaimButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_claim')
      .setLabel('استلام التذكرة')
      .setEmoji('🛡️')
      .setStyle(ButtonStyle.Success)
  );
}

/**
 * أزرار إدارة التذكرة (بعد الاستلام)
 */
function ticketManageButtons() {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_add_member')
      .setLabel('إضافة عضو')
      .setEmoji('➕')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('ticket_remove_member')
      .setLabel('إزالة عضو')
      .setEmoji('➖')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('ticket_summon_owner')
      .setLabel('استدعاء صاحب التذكرة')
      .setEmoji('📣')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('ticket_leave')
      .setLabel('ترك التذكرة')
      .setEmoji('🚪')
      .setStyle(ButtonStyle.Secondary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_close')
      .setLabel('إغلاق وحذف التذكرة')
      .setEmoji('🔒')
      .setStyle(ButtonStyle.Danger)
  );

  return [row1, row2];
}

/**
 * أزرار إغلاق التذكرة
 */
function ticketCloseButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_close')
      .setLabel('إغلاق التذكرة')
      .setEmoji('🔒')
      .setStyle(ButtonStyle.Danger)
  );
}

/* ═══════════════════════════════════════════════════════════
 *                    إمبيدات التقارير
 *  ═══════════════════════════════════════════════════════════ */

/**
 * لوحة التقارير
 */
function reportsPanel(client) {
  const embed = new EmbedBuilder()
    .setColor(CONFIG.COLORS.PRIMARY)
    .setAuthor({
      name: 'وزارة الدفاع الأمريكي',
      iconURL: client.user.displayAvatarURL()
    })
    .setTitle('📄 لوحة تقارير الشرطة العسكرية | Missions Reports')
    .setDescription(
      '**نظام رفع التقارير الرسمي**\n\n' +
      'اضغط على الزر أدناه لرفع تقرير جديد عن مهمة قمت بها.\n\n' +
      '**ملاحظات مهمة:**\n' +
      '✅ التقرير المقبول يمنحك **نقطة واحدة**\n' +
      '❌ التقرير المرفوض لا يمنحك أي نقاط\n' +
      '⚠️ التقارير المزيفة تعرضك للترميج\n\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
      '**نوع التقرير مطلوب + الوقت مطلوب + الأدلة مطلوبة**'
    )
    .setFooter(getFooter(client))
    .setTimestamp(now());

  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('report_submit')
      .setLabel('رفع تقرير جديد')
      .setEmoji('📝')
      .setStyle(ButtonStyle.Primary)
  );

  return { embeds: [embed], components: [buttons] };
}

/**
 * إمبيد التقرير (يُرسل للسجل)
 */
function reportLogEmbed(client, reportData) {
  const embed = new EmbedBuilder()
    .setColor(CONFIG.COLORS.PRIMARY)
    .setAuthor({
      name: 'تقرير مهمات الشرطة العسكرية',
      iconURL: client.user.displayAvatarURL()
    })
    .setTitle('📄 تقرير جديد | Missions Report')
    .setDescription(
      `**Name:** ${reportData.name || '—'} | **Id:** ${reportData.militaryId || '—'} | **Code:** ${reportData.code || '—'}`
    )
    .addFields(
      { name: '📊 نوع التقرير', value: reportData.reportType || '—', inline: true },
      { name: '🕒 الوقت', value: reportData.time || '—', inline: true },
      { name: '👥 الفريق / القطاع', value: reportData.team || 'غير محدد', inline: true },
      { name: '━━━━━━━━━━━━━━━━━━━', value: '**الإجراءات:**', inline: false },
    { name: '📝 الإجراءات المنفذة', value: String(reportData.actions || '—').substring(0, 1024), inline: false }
    )
    .setFooter({
      text: `Report ID: ${reportData.id} | By: ${reportData.name}`,
      iconURL: client.user.displayAvatarURL()
    })
    .setTimestamp(now());

  if (reportData.proofUrl) {
    embed.addFields({ name: '🔗 رابط الأدلة', value: reportData.proofUrl, inline: false });
  }

  if (reportData.proofImages && reportData.proofImages.length > 0) {
    embed.setImage(reportData.proofImages[0]);
  }

  return embed;
}

/**
 * أزرار قبول/رفض التقرير
 */
function reportActionButtons(reportId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`report_accept_${reportId}`)
      .setLabel('قبول التقرير')
      .setEmoji('✅')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`report_reject_${reportId}`)
      .setLabel('رفض التقرير')
      .setEmoji('❌')
      .setStyle(ButtonStyle.Danger)
  );
}

/* ═══════════════════════════════════════════════════════════
 *                    إمبيدات لوحة التحكم
 *  ═══════════════════════════════════════════════════════════ */

/**
 * لوحة التحكم الرئيسية
 */
function controlPanel(client) {
  const embed = new EmbedBuilder()
    .setColor(CONFIG.COLORS.PRIMARY)
    .setAuthor({
      name: 'وزارة الدفاع الأمريكي',
      iconURL: client.user.displayAvatarURL()
    })
    .setTitle('⚙️ لوحة التحكم | Control Panel')
    .setDescription(
      '**لوحة تحكم القيادة العليا**\n\n' +
      'اختر الإجراء المطلوب من الأزرار أدناه.\n\n' +
      '**الأزرار المتاحة:**\n' +
      '📨 إرسال رسالة خاصة لشخص معين\n' +
      '🧹 تنظيف قناة معينة\n' +
      '📢 إرسال إمبيد لقناة مع منشن للجميع\n' +
      '📣 إرسال رسالة جماعية للجميع\n\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
      '⚠️ **هذه اللوحة للقيادة فقط**'
    )
    .setFooter(getFooter(client))
    .setTimestamp(now());

  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('control_dm_user')
      .setLabel('إرسال رسالة خاصة')
      .setEmoji('📨')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('control_clean_channel')
      .setLabel('تنظيف قناة')
      .setEmoji('🧹')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('control_embed_all')
      .setLabel('إمبيد للجميع')
      .setEmoji('📢')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('control_dm_all')
      .setLabel('رسالة جماعية')
      .setEmoji('📣')
      .setStyle(ButtonStyle.Danger)
  );

  return { embeds: [embed], components: [buttons] };
}

/* ═══════════════════════════════════════════════════════════
 *                    إمبيدات اللوحة المتزامنة
 *  ═══════════════════════════════════════════════════════════ */

/**
 * اللوحة المتزامنة الرئيسية
 */
/* ═══════════════════════════════════════════════════════════
 *  استبدل دالة synchronizedPanel الموجودة بهذه بالكامل
 *  ═══════════════════════════════════════════════════════════ */

function synchronizedPanel(client, members) {
  const totalMembers = members.length;
  const totalPoints = members.reduce((sum, m) => sum + (m.points || 0), 0);

  let memberList = '';
  if (members.length === 0) {
    memberList = '*لا يوجد أعضاء مسجلين حالياً*';
  } else {
    members.forEach(member => {
      const emoji = CONFIG.getRoleEmoji(member.roleId);
      const id = member.militaryId || '—';
      const name = member.name || 'Unknown';
      const points = member.points || 0;
      const roleShort = getRoleShortName(member.roleId);
      memberList += `${emoji} **${id}** | ${name} | ${roleShort} | ⭐ **${points}**\n`;
    });
    if (memberList.length > 3800) {
      memberList = memberList.substring(0, 3700) + '\n*... (قائمة مختصرة)*';
    }
  }

  const embed = new EmbedBuilder()
    .setColor(CONFIG.COLORS.GOLD)
    .setAuthor({
      name: 'وزارة الدفاع الأمريكي — الشرطة العسكرية',
      iconURL: client.user.displayAvatarURL()
    })
    .setTitle('🎖️ اللوحة المتزامنة | Synchronized Panel')
    .setDescription(
      `**الإحصائيات العامة:**\n` +
      `👥 إجمالي الأعضاء: **${totalMembers}**\n` +
      `⭐ إجمالي النقاط: **${totalPoints}**\n` +
      `🕒 آخر تحديث: <t:${Math.floor(Date.now() / 1000)}:R>\n` +
      '━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
      '**📋 قائمة الأعضاء:**'
    )
    .addFields({ name: '\u200b', value: memberList })
    .setFooter(getFooter(client))
    .setTimestamp(now());

  // ✅ إصلاح حرج: صفين بدل صف واحد (5 + 1)
  const row1 = new ActionRowBuilder().addComponents(
  new ButtonBuilder()
    .setCustomId('panel_add_member')
    .setLabel('إضافة عضو')
    .setEmoji('➕')
    .setStyle(ButtonStyle.Success),
  new ButtonBuilder()
    .setCustomId('panel_add_points')
    .setLabel('إضافة نقاط')
    .setEmoji('⭐')
    .setStyle(ButtonStyle.Primary),
  new ButtonBuilder()
    .setCustomId('panel_deduct_points')
    .setLabel('خصم نقاط')
    .setEmoji('➖')
    .setStyle(ButtonStyle.Secondary),
  new ButtonBuilder()
    .setCustomId('panel_change_name')
    .setLabel('تغيير اسم')
    .setEmoji('✏️')
    .setStyle(ButtonStyle.Primary),
  new ButtonBuilder()
    .setCustomId('panel_terminate')
    .setLabel('ترميج عضو')
    .setEmoji('🗑️')
    .setStyle(ButtonStyle.Danger)
);

const row2 = new ActionRowBuilder().addComponents(
  new ButtonBuilder()
    .setCustomId('panel_refresh')
    .setLabel('تحديث اللوحة')
    .setEmoji('🔄')
    .setStyle(ButtonStyle.Secondary)
);

return { embeds: [embed], components: [row1, row2] };
}
/**
 * اسم الرتبة المختصر
 */
function getRoleShortName(roleId) {
  const map = {
    [CONFIG.ROLES.COMMANDER]: 'Commander',
    [CONFIG.ROLES.DEPUTY_COMMANDER]: 'Deputy',
    [CONFIG.ROLES.ASSISTANT_COMMANDER]: 'Assistant',
    [CONFIG.ROLES.MP_OFFICER]: 'Officer',
    [CONFIG.ROLES.MP_TRAINEE]: 'Trainee'
  };
  return map[roleId] || 'Unknown';
}

/* ═══════════════════════════════════════════════════════════
 *                    إمبيدات الشهادات DM
 *  ═══════════════════════════════════════════════════════════ */

/**
 * رسالة ترحيب بعد القبول
 */
function welcomeDM(client, data) {
  return new EmbedBuilder()
    .setColor(CONFIG.COLORS.SUCCESS)
    .setAuthor({
      name: 'وزارة الدفاع الأمريكي',
      iconURL: client.user.displayAvatarURL()
    })
    .setTitle('🎖️ مبروك | تم قبولك في الشرطة العسكرية')
    .setDescription(
      `مرحباً **${data.name}**\n\n` +
      '━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
      'يسرنا إبلاغك بأنه تم **قبول تقديمك** في\n' +
      '**الشرطة العسكرية — وزارة الدفاع الأمريكي**\n\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━━'
    )
    .addFields(
      { name: '🆔 رقمك العسكري', value: `\`${data.militaryId}\``, inline: true },
      { name: '🎖️ رتبتك الحالية', value: 'Military Police Trainee', inline: true },
      { name: '📅 تاريخ الانضمام', value: `<t:${Math.floor(Date.now() / 1000)}:D>`, inline: true },
      { name: '📌 ملاحظة', value: 'ستحصل على رتبة **Officer** بعد اجتياز فترة التدريب بنجاح.', inline: false }
    )
    .setFooter(getFooter(client))
    .setTimestamp(now());
}

/**
 * رسالة رفض
 */
function rejectedDM(client) {
  return new EmbedBuilder()
    .setColor(CONFIG.COLORS.DANGER)
    .setAuthor({
      name: 'وزارة الدفاع الأمريكي',
      iconURL: client.user.displayAvatarURL()
    })
    .setTitle('❌ تم رفض تقديمك')
    .setDescription(
      'نأسف لإبلاغك بأنه تم **رفض تقديمك** على الشرطة العسكرية.\n\n' +
      '**الرجاء عدم السؤال عن سبب الرفض** لتجنب أي مشاكل.\n\n' +
      'يمكنك التقديم مجدداً بعد تحسين مهاراتك.'
    )
    .setFooter(getFooter(client))
    .setTimestamp(now());
}

/* ═══════════════════════════════════════════════════════════
 *                    إمبيدات بوت الدعم
 *  ═══════════════════════════════════════════════════════════ */

/**
 * إشعار انضمام شخص للدعم
 */
function supportUserJoined(client, data) {
  return new EmbedBuilder()
    .setColor(CONFIG.COLORS.WARNING)
    .setAuthor({
      name: 'الشرطة العسكرية — بوت الدعم',
      iconURL: client.user.displayAvatarURL()
    })
    .setTitle('🔔 شخص في الانتظار')
    .setDescription(
      `**${data.username}** دخل القناة الصوتية وهو في انتظار أحد أفراد الشرطة العسكرية.`
    )
    .addFields(
      { name: '👤 المستخدم', value: `<@${data.userId}>`, inline: true },
      { name: '🎤 القناة', value: data.channelName || 'غير محدد', inline: true },
      { name: '🕒 الوقت', value: `<t:${Math.floor(Date.now() / 1000)}:T>`, inline: true }
    )
    .setFooter(getFooter(client))
    .setTimestamp(now());
}

/* ═══════════════════════════════════════════════════════════
 *                    التصدير
 *  ═══════════════════════════════════════════════════════════ */

module.exports = {
  /* عام */
  success,
  error,
  warning,
  info,
  custom,

  /* التقديمات */
  applicationEmbed,
  applicationButtons,

  /* الشهادات */
  appointmentCertificate,

  /* التوظيف */
  recruitmentPanel,

  /* التذاكر */
  ticketsPanel,
  ticketEmbed,
  ticketClaimButtons,
  ticketManageButtons,
  ticketCloseButtons,

  /* التقارير */
  reportsPanel,
  reportLogEmbed,
  reportActionButtons,

  /* لوحة التحكم */
  controlPanel,

  /* اللوحة المتزامنة */
  synchronizedPanel,
  getRoleShortName,

  /* DM */
  welcomeDM,
  rejectedDM,

  /* الدعم */
  supportUserJoined
};