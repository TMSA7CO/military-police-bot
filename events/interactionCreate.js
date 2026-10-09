/* ═══════════════════════════════════════════════════════════
 *  الشرطة العسكرية | وزارة الدفاع الأمريكي
 *  حدث التفاعلات — InteractionCreate.js
 *  الإصدار: 1.0
 *  الوظيفة: معالج كل الأزرار والنوافذ والأوامر
 *  ═══════════════════════════════════════════════════════════ */

'use strict';

const {
  Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
  StringSelectMenuBuilder, UserSelectMenuBuilder, ChannelSelectMenuBuilder,
  ChannelType, PermissionFlagsBits, AttachmentBuilder
} = require('discord.js');
const path = require('path');
const fs = require('fs');

const CONFIG = require('../config');
const firebase = require('../firebase');
const logger = require('../utils/logger');
const embeds = require('../utils/embeds');
const certificates = require('../utils/certificates');
const { cleanChannelById } = require('../utils/cleanChannel');

/* ═══════════════════════════════════════════════════════════
 *                    حالة المؤقتة
 *  ═══════════════════════════════════════════════════════════ */
const tempState = new Map(); // لحفظ البيانات المؤقتة بين الأزرار والـ modals

/* ═══════════════════════════════════════════════════════════
 *                    دوال مساعدة
 *  ═══════════════════════════════════════════════════════════ */

async function safeReply(interaction, options) {
  try {
    if (interaction.replied || interaction.deferred) {
      return await interaction.followUp(options);
    }
    return await interaction.reply(options);
  } catch (err) {
    console.error('[safeReply]', err.message);
    return null;
  }
}

async function safeDefer(interaction, ephemeral = true) {
  try {
    if (!interaction.replied && !interaction.deferred) {
      await interaction.deferReply({ ephemeral });
    }
  } catch (err) {
    console.error('[safeDefer]', err.message);
  }
}

async function safeUpdate(interaction, options) {
  try {
    if (interaction.deferred || interaction.replied) {
      return await interaction.editReply(options);
    }
    return await interaction.update(options);
  } catch (err) {
    console.error('[safeUpdate]', err.message);
    return null;
  }
}

function getPanelPayload(client, type) {
  switch (type) {
    case 'recruitment': return embeds.recruitmentPanel(client, true);
    case 'reports': return embeds.reportsPanel(client);
    case 'control': return embeds.controlPanel(client);
    default: return null;
  }
}

async function refreshSynchronizedPanel(client) {
  try {
    const loc = await firebase.getPanelLocation('synchronized');
    if (!loc) return;

    const channel = await client.channels.fetch(loc.channelId).catch(() => null);
    if (!channel) return;

    const message = await channel.messages.fetch(loc.messageId).catch(() => null);
    if (!message) return;

    const members = await firebase.getAllMembers();
    const payload = embeds.synchronizedPanel(client, members);
    await message.edit(payload);
    return true;
  } catch (err) {
    console.error('[refreshSynchronizedPanel]', err.message);
    return false;
  }
}

function generateTicketId(prefix) {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}${num}`;
}

function generateReportId() {
  return `RPT_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
}

function isStaff(member, permissionKey) {
  const allowedRoles = CONFIG.PERMISSIONS[permissionKey] || [];
  return CONFIG.hasAnyRole(member, allowedRoles);
}

/* ═══════════════════════════════════════════════════════════
 *              قسم 1: Slash Commands
 *  ═══════════════════════════════════════════════════════════ */

async function handleSlashCommand(interaction, client) {
  const command = client.commands?.get(interaction.commandName);

  if (!command) {
    return safeReply(interaction, {
      content: '❌ الأمر غير موجود',
      ephemeral: true
    });
  }

  try {
    await command.execute(interaction, client);
  } catch (err) {
    console.error(`[Command:${interaction.commandName}]`, err);
    await safeReply(interaction, {
      content: '❌ حدث خطأ أثناء تنفيذ الأمر',
      ephemeral: true
    });
  }
}

/* ═══════════════════════════════════════════════════════════
 *              قسم 2: لوحة التوظيف
 *  ═══════════════════════════════════════════════════════════ */

async function handleRecruitmentOpen(interaction, client) {
  if (!isStaff(interaction.member, 'PANEL_MANAGEMENT')) {
    return safeReply(interaction, {
      content: '❌ ليس لديك صلاحية لهذا الإجراء',
      ephemeral: true
    });
  }

  await safeDefer(interaction);

  await firebase.setRecruitmentStatus(true);

  const payload = embeds.recruitmentPanel(client, true);
  await safeUpdate(interaction, payload);

  await logger.logRecruitmentStatus(client, true, interaction.user.id);

  /* ─── تحديث موقع اللوحة ─── */
  await firebase.savePanelLocation('recruitment', interaction.channelId, interaction.message.id);
}

async function handleRecruitmentClose(interaction, client) {
  if (!isStaff(interaction.member, 'PANEL_MANAGEMENT')) {
    return safeReply(interaction, {
      content: '❌ ليس لديك صلاحية لهذا الإجراء',
      ephemeral: true
    });
  }

  await safeDefer(interaction);

  await firebase.setRecruitmentStatus(false);

  const payload = embeds.recruitmentPanel(client, false);
  await safeUpdate(interaction, payload);

  await logger.logRecruitmentStatus(client, false, interaction.user.id);
  await firebase.savePanelLocation('recruitment', interaction.channelId, interaction.message.id);
}

async function handleRecruitmentStatus(interaction, client) {
  await safeDefer(interaction);

  const status = await firebase.getRecruitmentStatus();
  const payload = embeds.recruitmentPanel(client, status.open === true);
  await safeUpdate(interaction, payload);

  await safeReply(interaction, {
    content: `✅ تم تحديث الحالة (${status.open ? '🟢 مفتوح' : '🔴 مغلق'})`,
    ephemeral: true
  });
}

/* ═══════════════════════════════════════════════════════════
 *              قسم 3: قبول / رفض التقديم
 *  ═══════════════════════════════════════════════════════════ */

async function handleApplicationAccept(interaction, client, appId) {
  if (!isStaff(interaction.member, 'PANEL_MANAGEMENT')) {
    return safeReply(interaction, { content: '❌ ليس لديك صلاحية', ephemeral: true });
  }

  await safeDefer(interaction);

  try {
    const application = await firebase.getApplication(appId);
    if (!application) {
      return safeReply(interaction, { content: '❌ التقديم غير موجود', ephemeral: true });
    }

    const guild = await client.guilds.fetch(CONFIG.GUILD_ID);
    const member = await guild.members.fetch(application.discordId).catch(() => null);

    if (!member) {
      return safeReply(interaction, {
        content: '❌ لم يتم العثور على العضو في السيرفر',
        ephemeral: true
      });
    }

    // 1. إضافة العضو في Firebase
    const addResult = await firebase.addMember(application.discordId, {
      name: application.name,
      roleId: CONFIG.ROLES.MP_TRAINEE
    });

    if (!addResult.success) {
      throw new Error('فشل حفظ العضو في قاعدة البيانات');
    }

    // 2. إعطاء الرتبة
    let roleAdded = false;
    try {
      await member.roles.add(CONFIG.ROLES.MP_TRAINEE, 'قبول التقديم');
      roleAdded = true;
      console.log(`[Accept] ✅ تم إعطاء الرتبة`);
    } catch (roleErr) {
      console.error(`[Accept] ❌ فشل إعطاء الرتبة:`, roleErr.message, roleErr.code);
    }

    // 3. ✅ انتظار بسيط قبل تغيير الاسم
    await new Promise(r => setTimeout(r, 1500));

    // 4. ✅ تغيير الاسم مع إعادة محاولة
    const nicknameToSet = addResult.fullName;
    let nicknameSet = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await member.setNickname(nicknameToSet, 'قبول التقديم');
        nicknameSet = true;
        console.log(`[Accept] ✅ تم تغيير الاسم (محاولة ${attempt})`);
        break;
      } catch (nickErr) {
        console.error(`[Accept] ❌ محاولة ${attempt}:`, nickErr.message, `(code: ${nickErr.code})`);
        if (attempt < 3) await new Promise(r => setTimeout(r, 1500));
      }
    }

    if (!nicknameSet) {
      console.error(`[Accept] ⚠️ فشل تغيير الاسم نهائياً`);
      console.error(`   Bot: ${guild.members.me.roles.highest.name} (${guild.members.me.roles.highest.position})`);
      console.error(`   Member: ${member.roles.highest.name} (${member.roles.highest.position})`);
    }

    // 5. إصدار الشهادة
    await certificates.issueCertificate(client, {
      discordId: application.discordId,
      name: application.name,
      militaryId: addResult.militaryId,
      roleName: 'Military Police Trainee',
      roleNameAr: 'متدرب الشرطة العسكرية',
      roleId: CONFIG.ROLES.MP_TRAINEE,
      issuedBy: interaction.user.id,
      supersede: false,
      sendDM: true,
      logToChannel: true
    });

    // 6. DM ترحيبي
    try {
      const welcomeEmbed = embeds.welcomeDM(client, {
        name: application.name,
        militaryId: addResult.militaryId
      });
      await member.send({ embeds: [welcomeEmbed] }).catch(() => {});
    } catch {}

    // 7. حذف التقديم
    await firebase.deleteApplication(appId);

    // 8. تحديث الرسالة
    const newEmbed = EmbedBuilder.from(interaction.message.embeds[0])
      .setColor(CONFIG.COLORS.SUCCESS)
      .setTitle('✅ تم قبول التقديم')
      .setFooter({ text: `تم القبول بواسطة ${interaction.user.tag}` });

    await interaction.message.edit({
      embeds: [newEmbed],
      components: []
    }).catch(() => {});

    await logger.logApplicationAccepted(client, {
      name: application.name,
      discordId: application.discordId,
      militaryId: addResult.militaryId,
      by: interaction.user.id
    }).catch(() => {});

    await refreshSynchronizedPanel(client);

    const statusLine = [
      roleAdded ? '✅ الرتبة' : '⚠️ الرتبة فشلت',
      nicknameSet ? '✅ الاسم' : '⚠️ الاسم فشل'
    ];

    await safeReply(interaction, {
      content:
        `✅ تم قبول **${application.name}**\n` +
        `🆔 الرقم: \`${addResult.militaryId}\`\n` +
        `${statusLine.join(' | ')}`,
      ephemeral: true
    });

  } catch (err) {
    console.error('[Accept]', err);
    await safeReply(interaction, {
      content: `❌ حدث خطأ: ${err.message}`,
      ephemeral: true
    });
  }
}


async function handleApplicationReject(interaction, client, appId) {
  if (!isStaff(interaction.member, 'PANEL_MANAGEMENT')) {
    return safeReply(interaction, { content: '❌ ليس لديك صلاحية', ephemeral: true });
  }

  await safeDefer(interaction);

  try {
    const application = await firebase.getApplication(appId);
    if (!application) {
      return safeReply(interaction, { content: '❌ التقديم غير موجود', ephemeral: true });
    }

    const guild = await client.guilds.fetch(CONFIG.GUILD_ID);
    const member = await guild.members.fetch(application.discordId).catch(() => null);

    let roleAdded = false;
    let dmSent = false;

    if (member) {
      // إعطاء رتبة REJECTED
      try {
        await member.roles.add(CONFIG.ROLES.REJECTED, 'رفض التقديم');
        roleAdded = true;
        console.log(`[Reject] ✅ تم إعطاء رتبة REJECTED`);
      } catch (roleErr) {
        console.error(`[Reject] ❌ فشل إعطاء الرتبة:`, roleErr.message, roleErr.code);
      }

      // ✅ إرسال DM الرفض
      try {
        const rejectEmbed = embeds.rejectedDM(client);
        await member.send({ embeds: [rejectEmbed] });
        dmSent = true;
        console.log(`[Reject] ✅ تم إرسال DM الرفض`);
      } catch (dmErr) {
        console.warn('[Reject] ❌ فشل DM:', dmErr.message);
      }
    }

    // تحديث Firebase
    await firebase.updateApplication(appId, {
      status: 'rejected',
      rejectedBy: interaction.user.id,
      rejectedAt: Date.now()
    });

    // تحديث الرسالة
    const newEmbed = EmbedBuilder.from(interaction.message.embeds[0])
      .setColor(CONFIG.COLORS.DANGER)
      .setTitle('❌ تم رفض التقديم')
      .setFooter({ text: `تم الرفض بواسطة ${interaction.user.tag}` });

    // ✅ دائماً نضيف زر إزالة الرفض
    const components = [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`app_remove_reject_${appId}`)
          .setLabel('إزالة الرفض (السماح بإعادة التقديم)')
          .setEmoji('🔄')
          .setStyle(ButtonStyle.Secondary)
      )
    ];

    await interaction.message.edit({
      embeds: [newEmbed],
      components: components
    }).catch(() => {});

    await logger.logApplicationRejected(client, {
      name: application.name,
      discordId: application.discordId,
      by: interaction.user.id,
      reason: 'قرار إداري'
    }).catch(() => {});

    const statusLine = [];
    statusLine.push(roleAdded ? '✅ رتبة الرفض أُعطيت' : '⚠️ فشل إعطاء رتبة الرفض');
    statusLine.push(dmSent ? '✅ DM أُرسل' : '⚠️ فشل DM');

    await safeReply(interaction, {
      content:
        `❌ تم رفض **${application.name}**\n` +
        `${statusLine.join(' | ')}\n` +
        `🔄 يمكنك إزالة الرفض من الزر في الرسالة`,
      ephemeral: true
    });

  } catch (err) {
    console.error('[Reject]', err);
    await safeReply(interaction, {
      content: `❌ حدث خطأ: ${err.message}`,
      ephemeral: true
    });
  }
}

/* ═══════════════════════════════════════════════════════════
 *  إزالة الرفض — يسمح للمرفوض بالتقديم مرة أخرى
 *  ═══════════════════════════════════════════════════════════ */
async function handleApplicationRemoveReject(interaction, client, appId) {
  if (!isStaff(interaction.member, 'PANEL_MANAGEMENT')) {
    return safeReply(interaction, {
      content: '❌ ليس لديك صلاحية لهذا الإجراء',
      ephemeral: true
    });
  }

  await safeDefer(interaction);

  try {
    const application = await firebase.getApplication(appId);
    if (!application) {
      return safeReply(interaction, {
        content: '❌ التقديم غير موجود',
        ephemeral: true
      });
    }

    const guild = await client.guilds.fetch(CONFIG.GUILD_ID);
    const member = await guild.members.fetch(application.discordId).catch(() => null);

    /* ─── إزالة رتبة REJECTED ─── */
    let roleRemoved = false;
    if (member) {
      try {
        await member.roles.remove(CONFIG.ROLES.REJECTED);
        roleRemoved = true;
        console.log(`[RemoveReject] ✅ تم إزالة رتبة REJECTED من ${member.user.tag}`);
      } catch (roleErr) {
        console.error(`[RemoveReject] ❌ فشل إزالة الرتبة:`, roleErr.message);
        return safeReply(interaction, {
          content: `❌ فشل إزالة الرتبة — ${roleErr.message}\n💡 تأكد أن رتبة البوت أعلى من رتبة REJECTED.`,
          ephemeral: true
        });
      }

      /* ─── DM للشخص ─── */
      try {
        const embed = new EmbedBuilder()
          .setColor(CONFIG.COLORS.SUCCESS)
          .setAuthor({
            name: 'وزارة الدفاع الأمريكي',
            iconURL: client.user.displayAvatarURL()
          })
          .setTitle('✅ تم إزالة الرفض عنك')
          .setDescription(
            'تم إزالة الرفض عنك من قبل الإدارة.\n\n' +
            '━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
            '🔄 **يمكنك الآن التقديم على الشرطة العسكرية مرة أخرى**'
          )
          .addFields({
            name: '📝 رابط التقديم',
            value: 'https://military-police-website.onrender.com/apply',
            inline: false
          })
          .setFooter({
            text: CONFIG.TEXT.FOOTER,
            iconURL: client.user.displayAvatarURL()
          })
          .setTimestamp();

        await member.send({ embeds: [embed] }).catch(() => {});
      } catch (dmErr) {
        console.warn('[RemoveReject] فشل إرسال DM:', dmErr.message);
      }
    }

    /* ─── حذف التقديم من Firebase ─── */
    await firebase.deleteApplication(appId);

    /* ─── تحديث الرسالة ─── */
    const finalEmbed = EmbedBuilder.from(interaction.message.embeds[0])
      .setColor(CONFIG.COLORS.SUCCESS)
      .setTitle('🔄 تم إزالة الرفض')
      .setFooter({ text: `بواسطة ${interaction.user.tag}` });

    await interaction.message.edit({
      embeds: [finalEmbed],
      components: []
    }).catch(() => {});

    /* ─── لوق ─── */
    await logger.sendLog(client, 'application_rejected', {
      description: `🔄 تم إزالة الرفض`,
      fields: [
        { name: '👤 العضو', value: application.name || '—', inline: true },
        { name: '🆔 الآيدي', value: `<@${application.discordId}>`, inline: true },
        { name: '👤 بواسطة', value: interaction.user.tag, inline: true }
      ],
      userId: interaction.user.id
    }).catch(() => {});

    await safeReply(interaction, {
      content: roleRemoved
        ? `✅ تم إزالة الرفض — يمكن لـ **${application.name}** التقديم الآن`
        : `⚠️ لم يتمكن البوت من إزالة الرتبة`,
      ephemeral: true
    });

  } catch (err) {
    console.error('[RemoveReject]', err);
    await safeReply(interaction, {
      content: `❌ حدث خطأ: ${err.message}`,
      ephemeral: true
    });
  }
}

/* ═══════════════════════════════════════════════════════════
 *              قسم 4: لوحة التقارير
 *  ═══════════════════════════════════════════════════════════ */

async function handleReportSubmit(interaction, client) {
  const modal = new ModalBuilder()
    .setCustomId('report_submit_modal')
    .setTitle('📄 تقرير مهمات الشرطة العسكرية');

  const typeInput = new TextInputBuilder()
    .setCustomId('report_type')
    .setLabel('نوع التقرير')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder('دورية / تفتيش / تحقيق / مرافقة')
    .setMaxLength(100);

  const timeInput = new TextInputBuilder()
    .setCustomId('report_time')
    .setLabel('الوقت (من - إلى)')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder('22:30 - 23:15')
    .setMaxLength(50);

  const teamInput = new TextInputBuilder()
    .setCustomId('report_team')
    .setLabel('الفريق / القطاع (اختياري)')
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setPlaceholder('قطاع شمال')
    .setMaxLength(100);

  const actionsInput = new TextInputBuilder()
    .setCustomId('report_actions')
    .setLabel('الإجراءات المنفذة')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setPlaceholder('اذكر جميع الإجراءات التي قمت بها...')
    .setMaxLength(1000);

  const forceInput = new TextInputBuilder()
    .setCustomId('report_force')
    .setLabel('استخدام القوة (إن وُجد)')
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setPlaceholder('مثال: توقيف - لا يوجد')
    .setMaxLength(200);

  const incidentsInput = new TextInputBuilder()
    .setCustomId('report_incidents')
    .setLabel('حوادث أو أعراض جانبية (إن وُجدت)')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setPlaceholder('اذكر أي حوادث حصلت...')
    .setMaxLength(500);

  const proofInput = new TextInputBuilder()
    .setCustomId('report_proof')
    .setLabel('رابط الأدلة (اختياري)')
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setPlaceholder('https://...')
    .setMaxLength(500);

  modal.addComponents(
    new ActionRowBuilder().addComponents(typeInput),
    new ActionRowBuilder().addComponents(timeInput),
    new ActionRowBuilder().addComponents(teamInput),
    new ActionRowBuilder().addComponents(actionsInput),
    new ActionRowBuilder().addComponents(proofInput)
  );

  await interaction.showModal(modal);
}

async function handleReportSubmitModal(interaction, client) {
  await safeDefer(interaction);

  try {
    // ✅ 1. محاولة جلب العضو من Firebase
    let member = await firebase.getMember(interaction.user.id);

    // ✅ 2. Fallback: لو ما موجود، نحاول إضافته تلقائياً
    if (!member) {
      console.log(`[ReportSubmit] العضو ${interaction.user.id} غير موجود — محاولة إضافة تلقائية`);

      const guild = await client.guilds.fetch(CONFIG.GUILD_ID).catch(() => null);
      const guildMember = guild ? await guild.members.fetch(interaction.user.id).catch(() => null) : null;

      if (!guildMember) {
        return safeReply(interaction, {
          content: '❌ أنت غير موجود في السيرفر',
          ephemeral: true
        });
      }

      // البحث عن رتبة عسكرية
      const militaryRole = CONFIG.ALL_RANKS.find(r => guildMember.roles.cache.has(r));

      if (!militaryRole) {
        return safeReply(interaction, {
          content: '❌ ليس لديك أي رتبة عسكرية — تواصل مع القيادة',
          ephemeral: true
        });
      }

      // استخراج الاسم
      let displayName = guildMember.nickname || guildMember.displayName || guildMember.user.username;
      displayName = displayName.replace(/^\[M-\d+\]\s*/, '').trim();
      if (!displayName || displayName.length < 2) {
        displayName = guildMember.user.username;
      }

      // إضافة تلقائية
      await firebase.addMember(interaction.user.id, {
        name: displayName,
        roleId: militaryRole
      });

      member = await firebase.getMember(interaction.user.id);

      if (!member) {
        return safeReply(interaction, {
          content: '❌ فشل الإضافة التلقائية — تواصل مع القيادة',
          ephemeral: true
        });
      }

      console.log(`[ReportSubmit] ✅ تم إضافة العضو: ${displayName}`);
    }

    // ✅ 3. بناء بيانات التقرير
    const reportData = {
      id: generateReportId(),
      discordId: interaction.user.id,
      name: member.nameOriginal || member.name || 'Unknown',
      militaryId: member.militaryId || 'M-XX',
      code: `${member.militaryId}-${Math.floor(1000 + Math.random() * 9000)}`,
      reportType: interaction.fields.getTextInputValue('report_type'),
      time: interaction.fields.getTextInputValue('report_time'),
      team: interaction.fields.getTextInputValue('report_team') || 'غير محدد',
      actions: interaction.fields.getTextInputValue('report_actions'),
      proofUrl: interaction.fields.getTextInputValue('report_proof') || null,
      submittedAt: Date.now()
    };

    // ✅ 4. حفظ في Firebase
    await firebase.saveReport(reportData.id, reportData);

    // ✅ 5. إرسال لقناة التقارير
    const logChannel = await client.channels.fetch(CONFIG.CHANNELS.REPORTS_LOG).catch(() => null);

    if (!logChannel) {
      console.error('[ReportSubmit] قناة التقارير غير موجودة');
      return safeReply(interaction, {
        content: '⚠️ تم حفظ التقرير لكن فشل إرساله للإدارة — تواصل مع القيادة',
        ephemeral: true
      });
    }

    const embed = embeds.reportLogEmbed(client, reportData);
    const buttons = embeds.reportActionButtons(reportData.id);

    await logChannel.send({ embeds: [embed], components: [buttons] });

    // ✅ 6. لوق
    await logger.logReportSubmitted(client, reportData).catch(() => {});

    await safeReply(interaction, {
      content: '✅ تم إرسال التقرير بنجاح — سيتم مراجعته من قبل القيادة',
      ephemeral: true
    });

  } catch (err) {
    console.error('[ReportSubmit]', err);
    await safeReply(interaction, {
      content: `❌ حدث خطأ: ${err.message}`,
      ephemeral: true
    });
  }
}

async function handleReportAccept(interaction, client, reportId) {
  if (!isStaff(interaction.member, 'REPORT_MANAGEMENT')) {
    return safeReply(interaction, {
      content: '❌ ليس لديك صلاحية لهذا الإجراء',
      ephemeral: true
    });
  }

  await safeDefer(interaction);

  try {
    const report = await firebase.getReport(reportId);
    if (!report) {
      return safeReply(interaction, { content: '❌ التقرير غير موجود', ephemeral: true });
    }

    /* ─── إضافة النقاط ─── */
    const points = CONFIG.REPORTS.POINTS_PER_APPROVE || 1;
    const pointsResult = await firebase.addPoints(
      report.discordId,
      points,
      `قبول التقرير: ${report.reportType}`,
      interaction.user.id
    );

    /* ─── تحديث حالة التقرير ─── */
    await firebase.approveReport(reportId, interaction.user.id);

    /* ─── DM للعضو ─── */
    try {
      const user = await client.users.fetch(report.discordId).catch(() => null);
      if (user) {
        await user.send({
          embeds: [embeds.success(
            client,
            'تم قبول تقريرك',
            `تم **قبول** تقريرك بنجاح.\n\n⭐ **النقاط المضافة:** \`+${points}\`\n📊 **رصيدك الحالي:** \`${pointsResult.newPoints}\``
          )]
        }).catch(() => {});
      }
    } catch (dmErr) {
      console.warn('[ReportAccept] DM فشل:', dmErr.message);
    }

    /* ─── تحديث الرسالة ─── */
    const newEmbed = EmbedBuilder.from(interaction.message.embeds[0])
      .setColor(CONFIG.COLORS.SUCCESS)
      .setFooter({ text: `✅ تم القبول بواسطة ${interaction.user.tag}` });

    await interaction.message.edit({
      embeds: [newEmbed],
      components: []
    }).catch(() => {});

    /* ─── لوق ─── */
    await logger.logReportApproved(client, {
      name: report.name,
      discordId: report.discordId,
      points,
      newPoints: pointsResult.newPoints,
      by: interaction.user.id
    }).catch(() => {});

    /* ─── تحديث اللوحة المتزامنة ─── */
    await refreshSynchronizedPanel(client);

    await safeReply(interaction, {
      content: `✅ تم قبول التقرير — النقاط: \`+${points}\``,
      ephemeral: true
    });

  } catch (err) {
    console.error('[ReportAccept]', err);
    await safeReply(interaction, {
      content: `❌ حدث خطأ: ${err.message}`,
      ephemeral: true
    });
  }
}

async function handleReportReject(interaction, client, reportId) {
  if (!isStaff(interaction.member, 'REPORT_MANAGEMENT')) {
    return safeReply(interaction, {
      content: '❌ ليس لديك صلاحية لهذا الإجراء',
      ephemeral: true
    });
  }

  const modal = new ModalBuilder()
    .setCustomId(`report_reject_modal_${reportId}`)
    .setTitle('❌ رفض التقرير');

  const reasonInput = new TextInputBuilder()
    .setCustomId('reject_reason')
    .setLabel('سبب الرفض')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setPlaceholder('اذكر سبب رفض التقرير...')
    .setMaxLength(500);

  modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));

  await interaction.showModal(modal);
}

async function handleReportRejectModal(interaction, client, reportId) {
  await safeDefer(interaction);

  try {
    const reason = interaction.fields.getTextInputValue('reject_reason');

    const report = await firebase.getReport(reportId);
    if (!report) {
      return safeReply(interaction, { content: '❌ التقرير غير موجود', ephemeral: true });
    }

    /* ─── تحديث الحالة ─── */
    await firebase.rejectReport(reportId, reason, interaction.user.id);

    /* ─── DM للعضو ─── */
    try {
      const user = await client.users.fetch(report.discordId).catch(() => null);
      if (user) {
        await user.send({
          embeds: [embeds.error(
            client,
            'تم رفض تقريرك',
            `تم **رفض** تقريرك.\n\n📝 **السبب:** ${reason}\n\n⚠️ لم يتم إضافة أي نقاط.`
          )]
        }).catch(() => {});
      }
    } catch (dmErr) {
      console.warn('[ReportReject] DM فشل:', dmErr.message);
    }

    /* ─── تحديث الرسالة ─── */
    const newEmbed = EmbedBuilder.from(interaction.message.embeds[0])
      .setColor(CONFIG.COLORS.DANGER)
      .addFields({ name: '📝 سبب الرفض', value: reason, inline: false })
      .setFooter({ text: `❌ تم الرفض بواسطة ${interaction.user.tag}` });

    await interaction.message.edit({
      embeds: [newEmbed],
      components: []
    }).catch(() => {});

    /* ─── لوق ─── */
    await logger.logReportRejected(client, {
      name: report.name,
      discordId: report.discordId,
      reason,
      by: interaction.user.id
    }).catch(() => {});

    await safeReply(interaction, {
      content: '✅ تم رفض التقرير وإبلاغ صاحبه',
      ephemeral: true
    });

  } catch (err) {
    console.error('[ReportReject]', err);
    await safeReply(interaction, {
      content: `❌ حدث خطأ: ${err.message}`,
      ephemeral: true
    });
  }
}

/* ═══════════════════════════════════════════════════════════
 *              قسم 5: لوحة التحكم
 *  ═══════════════════════════════════════════════════════════ */

async function handleControlDMUser(interaction, client) {
  if (!isStaff(interaction.member, 'CONTROL_PANEL_ACCESS')) {
    return safeReply(interaction, { content: '❌ ليس لديك صلاحية', ephemeral: true });
  }

  const modal = new ModalBuilder()
    .setCustomId('control_dm_user_modal')
    .setTitle('📨 إرسال رسالة خاصة');

  const userIdInput = new TextInputBuilder()
    .setCustomId('dm_user_id')
    .setLabel('آيدي المستخدم')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder('1234567890123456789')
    .setMaxLength(20);

  const titleInput = new TextInputBuilder()
    .setCustomId('dm_title')
    .setLabel('عنوان الرسالة')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(200);

  const msgInput = new TextInputBuilder()
    .setCustomId('dm_message')
    .setLabel('نص الرسالة')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(1500);

  modal.addComponents(
    new ActionRowBuilder().addComponents(userIdInput),
    new ActionRowBuilder().addComponents(titleInput),
    new ActionRowBuilder().addComponents(msgInput)
  );

  await interaction.showModal(modal);
}

async function handleControlDMUserModal(interaction, client) {
  await safeDefer(interaction);

  try {
    const userId = interaction.fields.getTextInputValue('dm_user_id');
    const title = interaction.fields.getTextInputValue('dm_title');
    const message = interaction.fields.getTextInputValue('dm_message');

    const user = await client.users.fetch(userId).catch(() => null);

    if (!user) {
      return safeReply(interaction, {
        content: '❌ لم يتم العثور على المستخدم',
        ephemeral: true
      });
    }

    const embed = new EmbedBuilder()
      .setColor(CONFIG.COLORS.PRIMARY)
      .setAuthor({ name: 'وزارة الدفاع الأمريكي', iconURL: client.user.displayAvatarURL() })
      .setTitle(title)
      .setDescription(message)
      .setFooter({ text: `من: ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
      .setTimestamp();

    await user.send({ embeds: [embed] });

    await safeReply(interaction, {
      content: `✅ تم إرسال الرسالة إلى ${user.tag}`,
      ephemeral: true
    });

  } catch (err) {
    console.error('[ControlDMUser]', err);
    await safeReply(interaction, { content: `❌ ${err.message}`, ephemeral: true });
  }
}

async function handleControlCleanChannel(interaction, client) {
  if (!isStaff(interaction.member, 'CONTROL_PANEL_ACCESS')) {
    return safeReply(interaction, { content: '❌ ليس لديك صلاحية', ephemeral: true });
  }

  const modal = new ModalBuilder()
    .setCustomId('control_clean_channel_modal')
    .setTitle('🧹 تنظيف قناة');

  const channelIdInput = new TextInputBuilder()
    .setCustomId('clean_channel_id')
    .setLabel('آيدي القناة')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder('1234567890123456789')
    .setMaxLength(20);

  modal.addComponents(new ActionRowBuilder().addComponents(channelIdInput));

  await interaction.showModal(modal);
}

async function handleControlCleanChannelModal(interaction, client) {
  await safeDefer(interaction);

  try {
    const channelId = interaction.fields.getTextInputValue('clean_channel_id');
    const result = await cleanChannelById(client, channelId, { client });

    if (result.success) {
      await safeReply(interaction, {
        content: `✅ تم حذف **${result.deleted}** رسالة من القناة`,
        ephemeral: true
      });
    } else {
      await safeReply(interaction, {
        content: `❌ فشل: ${result.error}`,
        ephemeral: true
      });
    }

  } catch (err) {
    console.error('[ControlCleanChannel]', err);
    await safeReply(interaction, { content: `❌ ${err.message}`, ephemeral: true });
  }
}

async function handleControlEmbedAll(interaction, client) {
  if (!isStaff(interaction.member, 'CONTROL_PANEL_ACCESS')) {
    return safeReply(interaction, { content: '❌ ليس لديك صلاحية', ephemeral: true });
  }

  const modal = new ModalBuilder()
    .setCustomId('control_embed_all_modal')
    .setTitle('📢 إرسال إمبيد مع منشن للجميع');

  const channelInput = new TextInputBuilder()
    .setCustomId('embed_channel_id')
    .setLabel('آيدي القناة')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(20);

  const titleInput = new TextInputBuilder()
    .setCustomId('embed_title')
    .setLabel('العنوان')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(200);

  const msgInput = new TextInputBuilder()
    .setCustomId('embed_message')
    .setLabel('النص')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(2000);

  modal.addComponents(
    new ActionRowBuilder().addComponents(channelInput),
    new ActionRowBuilder().addComponents(titleInput),
    new ActionRowBuilder().addComponents(msgInput)
  );

  await interaction.showModal(modal);
}

async function handleControlEmbedAllModal(interaction, client) {
  await safeDefer(interaction);

  try {
    const channelId = interaction.fields.getTextInputValue('embed_channel_id');
    const title = interaction.fields.getTextInputValue('embed_title');
    const message = interaction.fields.getTextInputValue('embed_message');

    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel) {
      return safeReply(interaction, { content: '❌ القناة غير موجودة', ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setColor(CONFIG.COLORS.PRIMARY)
      .setAuthor({ name: 'وزارة الدفاع الأمريكي', iconURL: client.user.displayAvatarURL() })
      .setTitle(title)
      .setDescription(message)
      .setFooter({ text: `من: ${interaction.user.tag}` })
      .setTimestamp();

    await channel.send({ content: '@everyone', embeds: [embed] });

    await safeReply(interaction, { content: '✅ تم الإرسال', ephemeral: true });

  } catch (err) {
    console.error('[ControlEmbedAll]', err);
    await safeReply(interaction, { content: `❌ ${err.message}`, ephemeral: true });
  }
}

async function handleControlDMAll(interaction, client) {
  if (!isStaff(interaction.member, 'CONTROL_PANEL_ACCESS')) {
    return safeReply(interaction, { content: '❌ ليس لديك صلاحية', ephemeral: true });
  }

  const modal = new ModalBuilder()
    .setCustomId('control_dm_all_modal')
    .setTitle('📣 إرسال رسالة جماعية');

  const roleInput = new TextInputBuilder()
    .setCustomId('target_role_id')
    .setLabel('آيدي الرتبة (فارغ = جميع الأعضاء)')
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(20);

  const titleInput = new TextInputBuilder()
    .setCustomId('dm_all_title')
    .setLabel('العنوان')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(200);

  const msgInput = new TextInputBuilder()
    .setCustomId('dm_all_message')
    .setLabel('النص')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(1500);

  modal.addComponents(
    new ActionRowBuilder().addComponents(roleInput),
    new ActionRowBuilder().addComponents(titleInput),
    new ActionRowBuilder().addComponents(msgInput)
  );

  await interaction.showModal(modal);
}

async function handleControlDMAllModal(interaction, client) {
  await safeDefer(interaction);

  try {
    const roleId = interaction.fields.getTextInputValue('target_role_id');
    const title = interaction.fields.getTextInputValue('dm_all_title');
    const message = interaction.fields.getTextInputValue('dm_all_message');

    const guild = await client.guilds.fetch(CONFIG.GUILD_ID);
    await guild.members.fetch();

    let targets = [];

    if (roleId) {
      const role = guild.roles.cache.get(roleId);
      if (role) {
        targets = Array.from(role.members.values());
      }
    } else {
      targets = Array.from(guild.members.cache.values()).filter(m => !m.user.bot);
    }

    const embed = new EmbedBuilder()
      .setColor(CONFIG.COLORS.PRIMARY)
      .setAuthor({ name: 'وزارة الدفاع الأمريكي', iconURL: client.user.displayAvatarURL() })
      .setTitle(title)
      .setDescription(message)
      .setFooter({ text: `من: ${interaction.user.tag}` })
      .setTimestamp();

    let sent = 0;
    let failed = 0;

    for (const member of targets) {
      try {
        await member.send({ embeds: [embed] });
        sent++;
        await new Promise(r => setTimeout(r, 500));
      } catch {
        failed++;
      }
    }

    await safeReply(interaction, {
      content: `✅ تم الإرسال: **${sent}** — فشل: **${failed}**`,
      ephemeral: true
    });

  } catch (err) {
    console.error('[ControlDMAll]', err);
    await safeReply(interaction, { content: `❌ ${err.message}`, ephemeral: true });
  }
}

/* ═══════════════════════════════════════════════════════════
 *              قسم 6: التذاكر
 *  ═══════════════════════════════════════════════════════════ */

async function handleTicketArmy(interaction, client) {
  const modal = new ModalBuilder()
    .setCustomId('ticket_army_modal')
    .setTitle('🎯 شكوى ضد عسكري');

  const nameInput = new TextInputBuilder()
    .setCustomId('creator_name')
    .setLabel('اسم شخصية مقدم الشكوى')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(100);

  const idInput = new TextInputBuilder()
    .setCustomId('creator_id')
    .setLabel('آيدي مقدم الشكوى (في السيرفر)')
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(50);

  const targetNameInput = new TextInputBuilder()
    .setCustomId('target_name')
    .setLabel('اسم الشخص المشتكى عليه')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(100);

  const targetIdInput = new TextInputBuilder()
    .setCustomId('target_id')
    .setLabel('آيدي المشتكى عليه (إن وجد)')
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(50);

  const detailsInput = new TextInputBuilder()
    .setCustomId('details')
    .setLabel('تفاصيل الشكوى + رابط الأدلة')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(2000);

  modal.addComponents(
    new ActionRowBuilder().addComponents(nameInput),
    new ActionRowBuilder().addComponents(idInput),
    new ActionRowBuilder().addComponents(targetNameInput),
    new ActionRowBuilder().addComponents(targetIdInput),
    new ActionRowBuilder().addComponents(detailsInput)
  );

  await interaction.showModal(modal);
}

async function handleTicketArmyModal(interaction, client) {
  await safeDefer(interaction, false);

  try {
    const guild = await client.guilds.fetch(CONFIG.GUILD_ID);
    const creatorName = interaction.fields.getTextInputValue('creator_name');
    const creatorId = interaction.fields.getTextInputValue('creator_id') || 'غير محدد';
    const targetName = interaction.fields.getTextInputValue('target_name');
    const targetId = interaction.fields.getTextInputValue('target_id') || 'غير محدد';
    const details = interaction.fields.getTextInputValue('details');

    // ✅ إصلاح: بدون بادئة مزدوجة
    const ticketId = generateTicketId(CONFIG.TICKETS.PREFIX_ARMY); // MP_1234
    const channelName = ticketId; // ✅ نفسها بدون تكرار

    const ticketData = {
      ticketId,
      type: 'army',
      creatorDiscordId: interaction.user.id,
      creatorName,
      creatorId,
      targetName,
      targetId,
      details,
      createdAt: Date.now()
    };

    // ✅ إصلاح: التحقق من صلاحية قناة الأب
    let parentId = CONFIG.CHANNELS.TICKET_ARMY;
    if (parentId) {
      const parent = guild.channels.cache.get(parentId);
      if (!parent || parent.type !== ChannelType.GuildCategory) {
        console.warn(`[TicketArmy] parent ID ${parentId} ليس فئة — تم إلغاء parent`);
        parentId = null;
      }
    }

    // ✅ إصلاح: صلاحيات محسّنة — كل الرتب العسكرية ترى التذكرة
    const permissionOverwrites = [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionFlagsBits.ViewChannel]
      },
      {
        id: interaction.user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles
        ]
      },
      {
        id: client.user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ManageChannels,
          PermissionFlagsBits.ManageMessages,
          PermissionFlagsBits.EmbedLinks
        ]
      }
    ];

    // ✅ إضافة كل الرتب العسكرية
    for (const roleId of CONFIG.ALL_RANKS) {
      permissionOverwrites.push({
        id: roleId,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory
        ]
      });
    }

    const newChannel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: parentId || undefined,
      topic: `تذكرة ضد عسكري | صاحب التذكرة: ${interaction.user.tag}`,
      permissionOverwrites
    });

    // إرسال الإمبيد + الأزرار
    const embed = embeds.ticketEmbed(client, ticketData);
    const buttons = embeds.ticketClaimButtons();

    await newChannel.send({ embeds: [embed], components: [buttons] });

    // حفظ
    await firebase.saveTicket(ticketId, {
      ...ticketData,
      channelId: newChannel.id,
      status: 'open'
    });

    await logger.logTicketCreated(client, {
      ticketId,
      ticketType: 'army',
      creatorId: interaction.user.id,
      creatorName,
      targetName
    }).catch(() => {});

    await interaction.editReply({
      content: `✅ تم إنشاء تذكرة: <#${newChannel.id}>`
    });

  } catch (err) {
    console.error('[TicketArmy]', err);
    await safeReply(interaction, {
      content: `❌ ${err.message}`,
      ephemeral: true
    });
  }
}

async function handleTicketMPModal(interaction, client) {
  await safeDefer(interaction, false);

  try {
    const guild = await client.guilds.fetch(CONFIG.GUILD_ID);
    const creatorName = interaction.fields.getTextInputValue('creator_name');
    const creatorId = interaction.fields.getTextInputValue('creator_id') || 'غير محدد';
    const targetName = interaction.fields.getTextInputValue('target_name');
    const targetId = interaction.fields.getTextInputValue('target_id') || 'غير محدد';
    const details = interaction.fields.getTextInputValue('details');

    // ✅ إصلاح: بدون بادئة مزدوجة
    const ticketId = generateTicketId(CONFIG.TICKETS.PREFIX_MP); // M_1234
    const channelName = ticketId;

    const ticketData = {
      ticketId,
      type: 'mp',
      creatorDiscordId: interaction.user.id,
      creatorName,
      creatorId,
      targetName,
      targetId,
      details,
      createdAt: Date.now()
    };

    let parentId = CONFIG.CHANNELS.TICKET_MP;
    if (parentId) {
      const parent = guild.channels.cache.get(parentId);
      if (!parent || parent.type !== ChannelType.GuildCategory) {
        parentId = null;
      }
    }

    const permissionOverwrites = [
      { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      {
        id: interaction.user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles
        ]
      },
      {
        id: client.user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ManageChannels,
          PermissionFlagsBits.ManageMessages,
          PermissionFlagsBits.EmbedLinks
        ]
      }
    ];

    for (const roleId of CONFIG.ALL_RANKS) {
      permissionOverwrites.push({
        id: roleId,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory
        ]
      });
    }

    const newChannel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: parentId || undefined,
      topic: `تذكرة ضد شرطي عسكري | صاحب التذكرة: ${interaction.user.tag}`,
      permissionOverwrites
    });

    const embed = embeds.ticketEmbed(client, ticketData);
    const buttons = embeds.ticketClaimButtons();

    await newChannel.send({ embeds: [embed], components: [buttons] });

    await firebase.saveTicket(ticketId, {
      ...ticketData,
      channelId: newChannel.id,
      status: 'open'
    });

    await logger.logTicketCreated(client, {
      ticketId,
      ticketType: 'mp',
      creatorId: interaction.user.id,
      creatorName,
      targetName
    }).catch(() => {});

    await interaction.editReply({
      content: `✅ تم إنشاء تذكرة: <#${newChannel.id}>`
    });

  } catch (err) {
    console.error('[TicketMP]', err);
    await safeReply(interaction, {
      content: `❌ ${err.message}`,
      ephemeral: true
    });
  }
}

async function handleTicketClaim(interaction, client) {
  if (!isStaff(interaction.member, 'TICKET_STAFF')) {
    return safeReply(interaction, { content: '❌ ليس لديك صلاحية', ephemeral: true });
  }

  await safeDefer(interaction);

  try {
    // ✅ استخراج الـ ticketId بشكل موثوق
    const channelName = interaction.channel.name;
    // الآن channelName = MP_1234 أو M_1234 (بدون تكرار)
    const ticketId = channelName;

    let ticket = await firebase.getTicket(ticketId);

    // ✅ fallback: جرب البحث بالبادئة
    if (!ticket) {
      const cleanId = channelName.replace(/^(MP_|M_)/, '');
      ticket = await firebase.getTicket(cleanId) || await firebase.getTicket(`MP_${cleanId}`) || await firebase.getTicket(`M_${cleanId}`);
    }

    if (!ticket) {
      return safeReply(interaction, {
        content: '❌ التذكرة غير موجودة في قاعدة البيانات',
        ephemeral: true
      });
    }

    if (ticket.claimedBy) {
      return safeReply(interaction, {
        content: `❌ التذكرة مستلمة بالفعل من قبل <@${ticket.claimedBy}>`,
        ephemeral: true
      });
    }

    // تحديث الصلاحيات (تأكيد)
    await interaction.channel.permissionOverwrites.edit(ticket.creatorDiscordId, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true
    }).catch(() => {});

    // تحديث Firebase
    await firebase.updateTicket(ticketId, {
      claimedBy: interaction.user.id,
      claimedAt: Date.now()
    });

    // تحديث الرسالة
    const newButtons = embeds.ticketManageButtons();
    await interaction.message.edit({ components: [newButtons] }).catch(() => {});

    // إشعار
    await interaction.channel.send({
      content: `🛡️ تم استلام التذكرة من قبل ${interaction.user}`
    });

    // DM لصاحب التذكرة
    try {
      const user = await client.users.fetch(ticket.creatorDiscordId).catch(() => null);
      if (user) {
        await user.send({
          embeds: [embeds.info(
            client,
            'تم استلام تذكرتك',
            `تم استلام تذكرتك من قبل **${interaction.user.tag}**\n\nسيتم التواصل معك قريباً.`
          )]
        }).catch(() => {});
      }
    } catch {}

    await logger.logTicketClaimed(client, {
      ticketId,
      by: interaction.user.id,
      claimerName: interaction.user.tag
    }).catch(() => {});

    await safeReply(interaction, { content: '✅ تم استلام التذكرة', ephemeral: true });

  } catch (err) {
    console.error('[TicketClaim]', err);
    await safeReply(interaction, { content: `❌ ${err.message}`, ephemeral: true });
  }
}

async function handleTicketLeave(interaction, client) {
  if (!isStaff(interaction.member, 'TICKET_STAFF')) {
    return safeReply(interaction, { content: '❌ ليس لديك صلاحية', ephemeral: true });
  }

  await safeDefer(interaction);

  try {
    const channelName = interaction.channel.name;
    const ticketId = channelName.replace(/^(MP_|M_)/, '');

    const ticket = await firebase.getTicket(ticketId);
    if (!ticket) {
      return safeReply(interaction, { content: '❌ التذكرة غير موجودة', ephemeral: true });
    }

    /* ─── إزالة صلاحيات المستلم ─── */
    if (ticket.claimedBy && ticket.claimedBy !== interaction.user.id) {
      await interaction.channel.permissionOverwrites.delete(ticket.claimedBy).catch(() => {});
    }

    /* ─── إزالة صلاحيات المُستلم نفسه ─── */
    await interaction.channel.permissionOverwrites.delete(interaction.user.id).catch(() => {});

    /* ─── قفل الروم للجميع ─── */
    await interaction.channel.permissionOverwrites.edit(ticket.creatorDiscordId, {
      SendMessages: false
    });

    /* ─── تحديث Firebase ─── */
    await firebase.updateTicket(ticketId, {
      claimedBy: null,
      claimedAt: null,
      status: 'open'
    });

    /* ─── رجع الأزرار للاستلام ─── */
    const claimButtons = embeds.ticketClaimButtons();
    const message = await interaction.channel.messages.fetch(interaction.message.id).catch(() => null);
    if (message) {
      await message.edit({ components: [claimButtons] }).catch(() => {});
    }

    /* ─── إشعار ─── */
    await interaction.channel.send({
      content: `🚪 تم ترك التذكرة من قبل ${interaction.user}\n<@&${CONFIG.ROLES.MP_OFFICER}> — التذكرة متاحة للاستلام`
    });

    await safeReply(interaction, { content: '✅ تم ترك التذكرة', ephemeral: true });

  } catch (err) {
    console.error('[TicketLeave]', err);
    await safeReply(interaction, { content: `❌ ${err.message}`, ephemeral: true });
  }
}

async function handleTicketAddMember(interaction, client) {
  if (!isStaff(interaction.member, 'TICKET_STAFF')) {
    return safeReply(interaction, { content: '❌ ليس لديك صلاحية', ephemeral: true });
  }

  const select = new UserSelectMenuBuilder()
    .setCustomId('ticket_add_member_select')
    .setPlaceholder('اختر العضو لإضافته للتذكرة')
    .setMinValues(1)
    .setMaxValues(3);

  const row = new ActionRowBuilder().addComponents(select);

  await safeReply(interaction, {
    content: 'اختر العضو:',
    components: [row],
    ephemeral: true
  });
}

async function handleTicketAddMemberSelect(interaction, client) {
  await safeDefer(interaction);

  try {
    const selectedUsers = interaction.values;

    for (const userId of selectedUsers) {
      await interaction.channel.permissionOverwrites.edit(userId, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true
      }).catch(() => {});
    }

    const mentions = selectedUsers.map(id => `<@${id}>`).join(', ');

    await interaction.channel.send({
      content: `➕ تم إضافة: ${mentions}`
    });

    await safeReply(interaction, {
      content: `✅ تم إضافة ${selectedUsers.length} عضو`,
      ephemeral: true
    });

  } catch (err) {
    console.error('[TicketAddMember]', err);
    await safeReply(interaction, { content: `❌ ${err.message}`, ephemeral: true });
  }
}

async function handleTicketRemoveMember(interaction, client) {
  if (!isStaff(interaction.member, 'TICKET_STAFF')) {
    return safeReply(interaction, { content: '❌ ليس لديك صلاحية', ephemeral: true });
  }

  const select = new UserSelectMenuBuilder()
    .setCustomId('ticket_remove_member_select')
    .setPlaceholder('اختر العضو لإزالته من التذكرة')
    .setMinValues(1)
    .setMaxValues(3);

  const row = new ActionRowBuilder().addComponents(select);

  await safeReply(interaction, {
    content: 'اختر العضو:',
    components: [row],
    ephemeral: true
  });
}

async function handleTicketRemoveMemberSelect(interaction, client) {
  await safeDefer(interaction);

  try {
    const selectedUsers = interaction.values;
    const channelName = interaction.channel.name;
    const ticketId = channelName.replace(/^(MP_|M_)/, '');
    const ticket = await firebase.getTicket(ticketId);

    for (const userId of selectedUsers) {
      /* ─── لا يمكن إزالة صاحب التذكرة ─── */
      if (ticket && userId === ticket.creatorDiscordId) continue;

      /* ─── لا يمكن إزالة البوت ─── */
      if (userId === client.user.id) continue;

      await interaction.channel.permissionOverwrites.delete(userId).catch(() => {});
    }

    const mentions = selectedUsers.map(id => `<@${id}>`).join(', ');

    await interaction.channel.send({
      content: `➖ تم إزالة: ${mentions}`
    });

    await safeReply(interaction, {
      content: `✅ تم إزالة ${selectedUsers.length} عضو`,
      ephemeral: true
    });

  } catch (err) {
    console.error('[TicketRemoveMember]', err);
    await safeReply(interaction, { content: `❌ ${err.message}`, ephemeral: true });
  }
}

async function handleTicketSummonOwner(interaction, client) {
  if (!isStaff(interaction.member, 'TICKET_STAFF')) {
    return safeReply(interaction, { content: '❌ ليس لديك صلاحية', ephemeral: true });
  }

  await safeDefer(interaction);

  try {
    const channelName = interaction.channel.name;
    const ticketId = channelName.replace(/^(MP_|M_)/, '');

    const ticket = await firebase.getTicket(ticketId);
    if (!ticket) {
      return safeReply(interaction, { content: '❌ التذكرة غير موجودة', ephemeral: true });
    }

    await interaction.channel.send({
      content: `<@${ticket.creatorDiscordId}> — الرجاء الحضور إلى التذكرة، وإلا سيتم إغلاقها.`
    });

    /* ─── DM ─── */
    try {
      const user = await client.users.fetch(ticket.creatorDiscordId).catch(() => null);
      if (user) {
        await user.send({
          embeds: [embeds.warning(
            client,
            'استدعاء لحضور تذكرة',
            `تم استدعاؤك لحضور تذكرتك.\n\n⚠️ **يجب الحضور، وإلا سيتم إغلاق التذكرة تلقائياً.**`
          )]
        }).catch(() => {});
      }
    } catch {}

    await safeReply(interaction, { content: '✅ تم إرسال الاستدعاء', ephemeral: true });

  } catch (err) {
    console.error('[TicketSummon]', err);
    await safeReply(interaction, { content: `❌ ${err.message}`, ephemeral: true });
  }
}

async function handleTicketClose(interaction, client) {
  if (!isStaff(interaction.member, 'TICKET_STAFF')) {
    return safeReply(interaction, { content: '❌ ليس لديك صلاحية', ephemeral: true });
  }

  await safeDefer(interaction);

  try {
    const channelName = interaction.channel.name;
    const ticketId = channelName.replace(/^(MP_|M_)/, '');

    const ticket = await firebase.getTicket(ticketId);
    if (!ticket) {
      return safeReply(interaction, { content: '❌ التذكرة غير موجودة', ephemeral: true });
    }

    /* ─── جمع المحادثات ─── */
    const messages = await interaction.channel.messages.fetch({ limit: 100 });
    const transcript = messages.map(m =>
      `[${new Date(m.createdTimestamp).toLocaleString()}] ${m.author.tag}: ${m.content}`
    ).reverse().join('\n');

    /* ─── حفظ الأرشيف ─── */
    const archiveData = {
      ...ticket,
      transcript,
      closedBy: interaction.user.id,
      closedAt: Date.now()
    };

    await firebase.archiveTicket(ticketId, archiveData);

    /* ─── إرسال ملف الأرشيف ─── */
    const logChannel = await client.channels.fetch(CONFIG.CHANNELS.TICKET_LOG).catch(() => null);
    if (logChannel) {
      const buffer = Buffer.from(transcript || 'لا يوجد محتوى', 'utf-8');
      const attachment = new AttachmentBuilder(buffer, { name: `${ticketId}.txt` });

      await logChannel.send({
        content: `🔒 تم إغلاق التذكرة \`${ticketId}\` من قبل ${interaction.user}`,
        files: [attachment]
      }).catch(() => {});
    }

    /* ─── DM لصاحب التذكرة ─── */
    try {
      const user = await client.users.fetch(ticket.creatorDiscordId).catch(() => null);
      if (user) {
        await user.send({
          embeds: [embeds.info(
            client,
            'تم إغلاق تذكرتك',
            `تم إغلاق تذكرتك \`${ticketId}\`.\n\nشكراً لتواصلك.`
          )]
        }).catch(() => {});
      }
    } catch {}

    /* ─── لوق ─── */
    await logger.logTicketClosed(client, {
      ticketId,
      creatorId: ticket.creatorDiscordId,
      by: interaction.user.id
    }).catch(() => {});

    /* ─── حذف الروم ─── */
    await interaction.channel.delete().catch(() => {});

  } catch (err) {
    console.error('[TicketClose]', err);
    await safeReply(interaction, { content: `❌ ${err.message}`, ephemeral: true });
  }
}

/* ═══════════════════════════════════════════════════════════
 *              قسم 7: اللوحة المتزامنة
 *  ═══════════════════════════════════════════════════════════ */

async function handlePanelRefresh(interaction, client) {
  if (!isStaff(interaction.member, 'PANEL_MANAGEMENT')) {
    return safeReply(interaction, { content: '❌ ليس لديك صلاحية', ephemeral: true });
  }

  await safeDefer(interaction);

  const members = await firebase.getAllMembers();
  const payload = embeds.synchronizedPanel(client, members);

  await safeUpdate(interaction, payload);
}

async function handlePanelAddMember(interaction, client) {
  if (!isStaff(interaction.member, 'ADD_MEMBER')) {
    return safeReply(interaction, { content: '❌ ليس لديك صلاحية', ephemeral: true });
  }

  const select = new UserSelectMenuBuilder()
    .setCustomId('panel_add_member_select')
    .setPlaceholder('اختر العضو لإضافته')
    .setMinValues(1)
    .setMaxValues(1);

  const row = new ActionRowBuilder().addComponents(select);

  await safeReply(interaction, {
    content: 'اختر العضو:',
    components: [row],
    ephemeral: true
  });
}

async function handlePanelAddMemberSelect(interaction, client) {
  if (!isStaff(interaction.member, 'ADD_MEMBER')) {
    return safeReply(interaction, { content: '❌ ليس لديك صلاحية', ephemeral: true });
  }

  const userId = interaction.values[0];

  /* ─── حفظ مؤقت ─── */
  tempState.set(`add_member_${interaction.user.id}`, { userId });

  const modal = new ModalBuilder()
    .setCustomId('panel_add_member_modal')
    .setTitle('➕ إضافة عضو');

  const nameInput = new TextInputBuilder()
    .setCustomId('member_name')
    .setLabel('الاسم')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(50);

  const roleInput = new TextInputBuilder()
    .setCustomId('member_role')
    .setLabel('الرتبة (1=Trainee, 2=Officer, 3=Assistant, 4=Deputy, 5=Commander)')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(1);

  modal.addComponents(
    new ActionRowBuilder().addComponents(nameInput),
    new ActionRowBuilder().addComponents(roleInput)
  );

  await interaction.showModal(modal);
}

async function handlePanelAddMemberModal(interaction, client) {
  await safeDefer(interaction);

  try {
    const temp = tempState.get(`add_member_${interaction.user.id}`);
    if (!temp) {
      return safeReply(interaction, { content: '❌ انتهت الجلسة', ephemeral: true });
    }

    const userId = temp.userId;
    const name = interaction.fields.getTextInputValue('member_name');
    const roleNum = interaction.fields.getTextInputValue('member_role');

    const roleMap = {
      '1': CONFIG.ROLES.MP_TRAINEE,
      '2': CONFIG.ROLES.MP_OFFICER,
      '3': CONFIG.ROLES.ASSISTANT_COMMANDER,
      '4': CONFIG.ROLES.DEPUTY_COMMANDER,
      '5': CONFIG.ROLES.COMMANDER
    };

    const roleId = roleMap[roleNum];
    if (!roleId) {
      return safeReply(interaction, { content: '❌ رقم الرتبة غير صحيح', ephemeral: true });
    }

    /* ─── إضافة العضو ─── */
    const result = await firebase.addMember(userId, { name, roleId });

    if (!result.success) {
      return safeReply(interaction, { content: '❌ فشل الإضافة', ephemeral: true });
    }

    /* ─── إعطاء الرتبة في Discord ─── */
    const guild = await client.guilds.fetch(CONFIG.GUILD_ID);
    const member = await guild.members.fetch(userId).catch(() => null);
    if (member) {
      await member.roles.add(roleId).catch(() => {});
      await member.setNickname(result.fullName).catch(() => {});
    }

    /* ─── إصدار شهادة ─── */
    await certificates.issueCertificate(client, {
      discordId: userId,
      name,
      militaryId: result.militaryId,
      roleName: CONFIG.getRoleNameEnglish(roleId),
      roleNameAr: CONFIG.getRoleNameArabic(roleId),
      roleId,
      issuedBy: interaction.user.id,
      supersede: false,
      sendDM: true,
      logToChannel: true
    });

    /* ─── تحديث اللوحة ─── */
    await refreshSynchronizedPanel(client);
    tempState.delete(`add_member_${interaction.user.id}`);

    await safeReply(interaction, {
      content: `✅ تم إضافة <@${userId}> — الرقم: \`${result.militaryId}\``,
      ephemeral: true
    });

  } catch (err) {
    console.error('[PanelAddMember]', err);
    await safeReply(interaction, { content: `❌ ${err.message}`, ephemeral: true });
  }
}

async function handlePanelAddPoints(interaction, client) {
  if (!isStaff(interaction.member, 'ADD_POINTS')) {
    return safeReply(interaction, { content: '❌ ليس لديك صلاحية', ephemeral: true });
  }

  /* ─── عرض قائمة الأعضاء ─── */
  const members = await firebase.getAllMembers();

  if (members.length === 0) {
    return safeReply(interaction, { content: '❌ لا يوجد أعضاء', ephemeral: true });
  }

  const options = members.slice(0, 25).map(m => ({
    label: `${m.militaryId} | ${m.name}`.substring(0, 100),
    description: `النقاط: ${m.points || 0}`,
    value: m.discordId
  }));

  const select = new StringSelectMenuBuilder()
    .setCustomId('panel_add_points_select')
    .setPlaceholder('اختر العضو')
    .addOptions(options);

  const row = new ActionRowBuilder().addComponents(select);

  await safeReply(interaction, {
    content: '➕ اختر العضو لإضافة نقاط:',
    components: [row],
    ephemeral: true
  });
}

async function handlePanelAddPointsSelect(interaction, client) {
  if (!isStaff(interaction.member, 'ADD_POINTS')) {
    return safeReply(interaction, { content: '❌ ليس لديك صلاحية', ephemeral: true });
  }

  const userId = interaction.values[0];
  const member = await firebase.getMember(userId);

  tempState.set(`add_points_${interaction.user.id}`, { userId });

  const modal = new ModalBuilder()
    .setCustomId('panel_add_points_modal')
    .setTitle('⭐ إضافة نقاط');

  const pointsInput = new TextInputBuilder()
    .setCustomId('points_amount')
    .setLabel(`عدد النقاط (${member.points || 0} → ?)`)
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder('1-100')
    .setMaxLength(3);

  const reasonInput = new TextInputBuilder()
    .setCustomId('points_reason')
    .setLabel('السبب')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(200);

  modal.addComponents(
    new ActionRowBuilder().addComponents(pointsInput),
    new ActionRowBuilder().addComponents(reasonInput)
  );

  await interaction.showModal(modal);
}

async function handlePanelAddPointsModal(interaction, client) {
  await safeDefer(interaction);

  try {
    const temp = tempState.get(`add_points_${interaction.user.id}`);
    if (!temp) return safeReply(interaction, { content: '❌ انتهت الجلسة', ephemeral: true });

    const userId = temp.userId;
    const pointsStr = interaction.fields.getTextInputValue('points_amount');
    const reason = interaction.fields.getTextInputValue('points_reason');

    /* ─── Validation ─── */
    const pointsCheck = CONFIG.validatePoints(pointsStr, 'add');
    if (!pointsCheck.valid) {
      return safeReply(interaction, { content: `❌ ${pointsCheck.error}`, ephemeral: true });
    }

    const reasonCheck = CONFIG.validateReason(reason);
    if (!reasonCheck.valid) {
      return safeReply(interaction, { content: `❌ ${reasonCheck.error}`, ephemeral: true });
    }

    /* ─── إضافة ─── */
    const result = await firebase.addPoints(userId, pointsCheck.value, reasonCheck.value, interaction.user.id);

    if (!result.success) {
      return safeReply(interaction, { content: `❌ ${result.error}`, ephemeral: true });
    }

    /* ─── DM ─── */
    try {
      const user = await client.users.fetch(userId).catch(() => null);
      if (user) {
        await user.send({
          embeds: [embeds.success(
            client,
            'إشعار رسمي | إضافة نقاط',
            `تم إضافة **${pointsCheck.value}** نقطة إلى رصيدك.\n\n📊 **رصيدك الجديد:** \`${result.newPoints}\`\n📝 **السبب:** ${reasonCheck.value}\n👤 **بواسطة:** ${interaction.user.tag}`
          )]
        }).catch(() => {});
      }
    } catch {}

    /* ─── لوق ─── */
    const member = await firebase.getMember(userId);
    await logger.logPointsAdded(client, {
      discordId: userId,
      name: member?.name,
      points: pointsCheck.value,
      oldPoints: result.oldPoints,
      newPoints: result.newPoints,
      reason: reasonCheck.value,
      by: interaction.user.id
    }).catch(() => {});

    /* ─── تحديث ─── */
    await refreshSynchronizedPanel(client);
    tempState.delete(`add_points_${interaction.user.id}`);

    await safeReply(interaction, {
      content: `✅ تم إضافة **${pointsCheck.value}** نقطة — الرصيد الجديد: \`${result.newPoints}\``,
      ephemeral: true
    });

  } catch (err) {
    console.error('[PanelAddPoints]', err);
    await safeReply(interaction, { content: `❌ ${err.message}`, ephemeral: true });
  }
}

async function handlePanelDeductPoints(interaction, client) {
  if (!isStaff(interaction.member, 'DEDUCT_POINTS')) {
    return safeReply(interaction, { content: '❌ ليس لديك صلاحية', ephemeral: true });
  }

  const members = await firebase.getAllMembers();
  if (members.length === 0) {
    return safeReply(interaction, { content: '❌ لا يوجد أعضاء', ephemeral: true });
  }

  const options = members.slice(0, 25).map(m => ({
    label: `${m.militaryId} | ${m.name}`.substring(0, 100),
    description: `النقاط: ${m.points || 0}`,
    value: m.discordId
  }));

  const select = new StringSelectMenuBuilder()
    .setCustomId('panel_deduct_points_select')
    .setPlaceholder('اختر العضو')
    .addOptions(options);

  const row = new ActionRowBuilder().addComponents(select);

  await safeReply(interaction, {
    content: '➖ اختر العضو لخصم نقاط:',
    components: [row],
    ephemeral: true
  });
}

async function handlePanelDeductPointsSelect(interaction, client) {
  if (!isStaff(interaction.member, 'DEDUCT_POINTS')) {
    return safeReply(interaction, { content: '❌ ليس لديك صلاحية', ephemeral: true });
  }

  const userId = interaction.values[0];
  const member = await firebase.getMember(userId);

  tempState.set(`deduct_points_${interaction.user.id}`, { userId });

  const modal = new ModalBuilder()
    .setCustomId('panel_deduct_points_modal')
    .setTitle('➖ خصم نقاط');

  const pointsInput = new TextInputBuilder()
    .setCustomId('points_amount')
    .setLabel(`عدد النقاط (${member.points || 0} → ?)`)
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder('1-100')
    .setMaxLength(3);

  const reasonInput = new TextInputBuilder()
    .setCustomId('points_reason')
    .setLabel('السبب')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(200);

  modal.addComponents(
    new ActionRowBuilder().addComponents(pointsInput),
    new ActionRowBuilder().addComponents(reasonInput)
  );

  await interaction.showModal(modal);
}

async function handlePanelDeductPointsModal(interaction, client) {
  await safeDefer(interaction);

  try {
    const temp = tempState.get(`deduct_points_${interaction.user.id}`);
    if (!temp) return safeReply(interaction, { content: '❌ انتهت الجلسة', ephemeral: true });

    const userId = temp.userId;
    const pointsStr = interaction.fields.getTextInputValue('points_amount');
    const reason = interaction.fields.getTextInputValue('points_reason');

    const pointsCheck = CONFIG.validatePoints(pointsStr, 'deduct');
    if (!pointsCheck.valid) {
      return safeReply(interaction, { content: `❌ ${pointsCheck.error}`, ephemeral: true });
    }

    const reasonCheck = CONFIG.validateReason(reason);
    if (!reasonCheck.valid) {
      return safeReply(interaction, { content: `❌ ${reasonCheck.error}`, ephemeral: true });
    }

    const result = await firebase.removePoints(userId, pointsCheck.value, reasonCheck.value, interaction.user.id);

    if (!result.success) {
      return safeReply(interaction, { content: `❌ ${result.error}`, ephemeral: true });
    }

    /* ─── DM ─── */
    try {
      const user = await client.users.fetch(userId).catch(() => null);
      if (user) {
        await user.send({
          embeds: [embeds.warning(
            client,
            'إشعار رسمي | خصم نقاط',
            `تم خصم **${pointsCheck.value}** نقطة من رصيدك.\n\n📊 **رصيدك الجديد:** \`${result.newPoints}\`\n📝 **السبب:** ${reasonCheck.value}\n👤 **بواسطة:** ${interaction.user.tag}`
          )]
        }).catch(() => {});
      }
    } catch {}

    /* ─── لوق ─── */
    const member = await firebase.getMember(userId);
    await logger.logPointsDeducted(client, {
      discordId: userId,
      name: member?.name,
      points: pointsCheck.value,
      oldPoints: result.oldPoints,
      newPoints: result.newPoints,
      reason: reasonCheck.value,
      by: interaction.user.id
    }).catch(() => {});

    await refreshSynchronizedPanel(client);
    tempState.delete(`deduct_points_${interaction.user.id}`);

    await safeReply(interaction, {
      content: `✅ تم خصم **${pointsCheck.value}** نقطة — الرصيد الجديد: \`${result.newPoints}\``,
      ephemeral: true
    });

  } catch (err) {
    console.error('[PanelDeductPoints]', err);
    await safeReply(interaction, { content: `❌ ${err.message}`, ephemeral: true });
  }
}

async function handlePanelChangeName(interaction, client) {
  if (!isStaff(interaction.member, 'CHANGE_NAME')) {
    return safeReply(interaction, { content: '❌ ليس لديك صلاحية', ephemeral: true });
  }

  const members = await firebase.getAllMembers();
  if (members.length === 0) {
    return safeReply(interaction, { content: '❌ لا يوجد أعضاء', ephemeral: true });
  }

  const options = members.slice(0, 25).map(m => ({
    label: `${m.militaryId} | ${m.name}`.substring(0, 100),
    value: m.discordId
  }));

  const select = new StringSelectMenuBuilder()
    .setCustomId('panel_change_name_select')
    .setPlaceholder('اختر العضو')
    .addOptions(options);

  const row = new ActionRowBuilder().addComponents(select);

  await safeReply(interaction, {
    content: '✏️ اختر العضو لتغيير اسمه:',
    components: [row],
    ephemeral: true
  });
}

async function handlePanelChangeNameSelect(interaction, client) {
  if (!isStaff(interaction.member, 'CHANGE_NAME')) {
    return safeReply(interaction, { content: '❌ ليس لديك صلاحية', ephemeral: true });
  }

  const userId = interaction.values[0];
  const member = await firebase.getMember(userId);

  tempState.set(`change_name_${interaction.user.id}`, { userId });

  const modal = new ModalBuilder()
    .setCustomId('panel_change_name_modal')
    .setTitle('✏️ تغيير اسم');

  const nameInput = new TextInputBuilder()
    .setCustomId('new_name')
    .setLabel(`الاسم الجديد (الحالي: ${member.name})`)
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(50);

  modal.addComponents(new ActionRowBuilder().addComponents(nameInput));

  await interaction.showModal(modal);
}

async function handlePanelChangeNameModal(interaction, client) {
  await safeDefer(interaction);

  try {
    const temp = tempState.get(`change_name_${interaction.user.id}`);
    if (!temp) return safeReply(interaction, { content: '❌ انتهت الجلسة', ephemeral: true });

    const userId = temp.userId;
    const newName = interaction.fields.getTextInputValue('new_name');

    const member = await firebase.getMember(userId);
    if (!member) return safeReply(interaction, { content: '❌ العضو غير موجود', ephemeral: true });

    const oldName = member.name;

    /* ─── تحديث Firebase ─── */
    await firebase.updateMember(userId, {
      name: newName,
      nameOriginal: newName
    });

    /* ─── تحديث الـ Nickname ─── */
    const fullName = CONFIG.buildFullName(member.militaryId, newName);
    await firebase.updateMember(userId, { nickname: fullName });

    const guild = await client.guilds.fetch(CONFIG.GUILD_ID);
    const guildMember = await guild.members.fetch(userId).catch(() => null);
    if (guildMember) {
      await guildMember.setNickname(fullName).catch(() => {});
    }

    /* ─── إعادة إصدار الشهادة ─── */
    await certificates.reissueCertificateOnNameChange(
      client,
      userId,
      newName,
      interaction.user.id
    );

    /* ─── DM ─── */
    try {
      const user = await client.users.fetch(userId).catch(() => null);
      if (user) {
        await user.send({
          embeds: [embeds.info(
            client,
            'تم تحديث اسمك',
            `📛 **الاسم القديم:** \`${oldName}\`\n✨ **الاسم الجديد:** \`${newName}\`\n👤 **بواسطة:** ${interaction.user.tag}`
          )]
        }).catch(() => {});
      }
    } catch {}

    /* ─── لوق ─── */
    await logger.logNameChanged(client, {
      discordId: userId,
      oldName,
      newName,
      by: interaction.user.id
    }).catch(() => {});

    await refreshSynchronizedPanel(client);
    tempState.delete(`change_name_${interaction.user.id}`);

    await safeReply(interaction, {
      content: `✅ تم تغيير الاسم إلى **${newName}**`,
      ephemeral: true
    });

  } catch (err) {
    console.error('[PanelChangeName]', err);
    await safeReply(interaction, { content: `❌ ${err.message}`, ephemeral: true });
  }
}

async function handlePanelTerminate(interaction, client) {
  if (!isStaff(interaction.member, 'TERMINATION')) {
    return safeReply(interaction, { content: '❌ ليس لديك صلاحية', ephemeral: true });
  }

  const members = await firebase.getAllMembers();
  if (members.length === 0) {
    return safeReply(interaction, { content: '❌ لا يوجد أعضاء', ephemeral: true });
  }

  const options = members.slice(0, 25).map(m => ({
    label: `${m.militaryId} | ${m.name}`.substring(0, 100),
    description: `النقاط: ${m.points || 0}`,
    value: m.discordId
  }));

  const select = new StringSelectMenuBuilder()
    .setCustomId('panel_terminate_select')
    .setPlaceholder('اختر العضو للترميج')
    .addOptions(options);

  const row = new ActionRowBuilder().addComponents(select);

  await safeReply(interaction, {
    content: '🗑️ اختر العضو للترميج:',
    components: [row],
    ephemeral: true
  });
}

async function handlePanelTerminateSelect(interaction, client) {
  if (!isStaff(interaction.member, 'TERMINATION')) {
    return safeReply(interaction, { content: '❌ ليس لديك صلاحية', ephemeral: true });
  }

  const userId = interaction.values[0];
  const member = await firebase.getMember(userId);

  tempState.set(`terminate_${interaction.user.id}`, { userId });

  const modal = new ModalBuilder()
    .setCustomId('panel_terminate_modal')
    .setTitle('🗑️ ترميج عضو');

  const reasonInput = new TextInputBuilder()
    .setCustomId('terminate_reason')
    .setLabel(`سبب ترميج ${member.name} (${member.militaryId})`)
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(300);

  modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));

  await interaction.showModal(modal);
}

async function handlePanelTerminateModal(interaction, client) {
  await safeDefer(interaction);

  try {
    const temp = tempState.get(`terminate_${interaction.user.id}`);
    if (!temp) return safeReply(interaction, { content: '❌ انتهت الجلسة', ephemeral: true });

    const userId = temp.userId;
    const reason = interaction.fields.getTextInputValue('terminate_reason');

    const member = await firebase.getMember(userId);
    if (!member) return safeReply(interaction, { content: '❌ العضو غير موجود', ephemeral: true });

    /* ─── 1. إبطال الشهادات ─── */
    const certResult = await firebase.invalidateAllCertificates(userId, 'termination');

    /* ─── 2. لوق الإبطال ─── */
    if (certResult.invalidatedCount > 0) {
      await certificates.logCertificateInvalidation(client, {
        discordId: userId,
        name: member.name,
        militaryId: member.militaryId,
        certificatesCount: certResult.invalidatedCount,
        reason: 'termination',
        by: interaction.user.id
      }).catch(() => {});
    }

    /* ─── 3. حذف العضو + إعادة الترتيب ─── */
    const removeResult = await firebase.removeMember(userId);

    /* ─── 4. تحديث Discord ─── */
    const guild = await client.guilds.fetch(CONFIG.GUILD_ID);
    const guildMember = await guild.members.fetch(userId).catch(() => null);

    if (guildMember) {
      /* إزالة كل الرتب */
      for (const roleId of CONFIG.ALL_RANKS) {
        await guildMember.roles.remove(roleId).catch(() => {});
      }
      /* إرجاع الاسم الأصلي */
      await guildMember.setNickname(null).catch(() => {});
    }

    /* ─── 5. لوق الترميج ─── */
    await logger.logMemberRemoved(client, {
      discordId: userId,
      name: member.name,
      militaryId: member.militaryId,
      points: member.points || 0,
      reason,
      by: interaction.user.id,
      reordered: removeResult.changes.length
    }).catch(() => {});

    /* ─── 6. لكل عضو تغيّر رقمه → شهادة جديدة ─── */
    for (const change of removeResult.changes) {
      try {
        await certificates.reissueCertificateOnReorder(
          client,
          change.memberData,
          change.newId
        );

        /* تحديث Discord */
        const changedMember = await guild.members.fetch(change.discordId).catch(() => null);
        if (changedMember && change.newNickname) {
          await changedMember.setNickname(change.newNickname).catch(() => {});
        }
      } catch (err) {
        console.error(`[Terminate] فشل تحديث ${change.discordId}:`, err.message);
      }
    }

    /* ─── 7. DM ─── */
    try {
      const user = await client.users.fetch(userId).catch(() => null);
      if (user) {
        await user.send({
          embeds: [embeds.error(
            client,
            'تم ترميجك',
            `تم **ترميجك** من الشرطة العسكرية.\n\n📝 **السبب:** ${reason}\n\n⚠️ أنت الآن عسكري عادي، ولا يحق لك المساس بأعمال الشرطة العسكرية.`
          )]
        }).catch(() => {});
      }
    } catch {}

    /* ─── تحديث ─── */
    await refreshSynchronizedPanel(client);
    tempState.delete(`terminate_${interaction.user.id}`);

    await safeReply(interaction, {
      content: `✅ تم ترميج **${member.name}** — تم إبطال ${certResult.invalidatedCount} شهادة — إعادة ترقيم ${removeResult.changes.length} عضو`,
      ephemeral: true
    });

  } catch (err) {
    console.error('[PanelTerminate]', err);
    await safeReply(interaction, { content: `❌ ${err.message}`, ephemeral: true });
  }
}

/* ═══════════════════════════════════════════════════════════
 *              الحدث الرئيسي
 *  ═══════════════════════════════════════════════════════════ */

module.exports = {
  name: Events.InteractionCreate,

  async execute(interaction, client) {
    try {
      /* ═══════════════════════════════════════════════
       *  Slash Commands
       *  ═══════════════════════════════════════════════ */
      if (interaction.isChatInputCommand()) {
        return handleSlashCommand(interaction, client);
      }

      /* ═══════════════════════════════════════════════
       *  Buttons
       *  ═══════════════════════════════════════════════ */
      if (interaction.isButton()) {
        const id = interaction.customId;


        /* ─── Support Bot Stop (جديد) ─── */
        if (id.startsWith('support_stop_')) {
          const mod = require('../commands/support-bot.js');
          return mod.handleStopButton(interaction, client, id.replace('support_stop_', ''));
        }

        /* ─── Monitor Cancel/Stop (جديد) ─── */
        if (id === 'monitor_setup_cancel') {
          const mod = require('../commands/monitor.js');
          return mod.handleSetupCancel(interaction, client);
        }

        if (id.startsWith('monitor_stop_')) {
          const mod = require('../commands/monitor.js');
          return mod.handleStopAll(interaction, client, id.replace('monitor_stop_', ''));
        }
        /* ─── إزالة الرفض (جديد) ─── */
        if (id.startsWith('app_remove_reject_')) {
          return handleApplicationRemoveReject(interaction, client, id.replace('app_remove_reject_', ''));
        }
        
        /* ─── التوظيف ─── */
        if (id === 'recruitment_open') return handleRecruitmentOpen(interaction, client);
        if (id === 'recruitment_close') return handleRecruitmentClose(interaction, client);
        if (id === 'recruitment_status') return handleRecruitmentStatus(interaction, client);

        /* ─── القبول / الرفض ─── */
        if (id.startsWith('app_accept_')) {
          return handleApplicationAccept(interaction, client, id.replace('app_accept_', ''));
        }
        if (id.startsWith('app_reject_')) {
          return handleApplicationReject(interaction, client, id.replace('app_reject_', ''));
        }

        /* ─── التقارير ─── */
        if (id === 'report_submit') return handleReportSubmit(interaction, client);
        if (id.startsWith('report_accept_')) {
          return handleReportAccept(interaction, client, id.replace('report_accept_', ''));
        }
        if (id.startsWith('report_reject_')) {
          return handleReportReject(interaction, client, id.replace('report_reject_', ''));
        }

        /* ─── لوحة التحكم ─── */
        if (id === 'control_dm_user') return handleControlDMUser(interaction, client);
        if (id === 'control_clean_channel') return handleControlCleanChannel(interaction, client);
        if (id === 'control_embed_all') return handleControlEmbedAll(interaction, client);
        if (id === 'control_dm_all') return handleControlDMAll(interaction, client);

        /* ─── التذاكر ─── */
        if (id === 'ticket_army') return handleTicketArmy(interaction, client);
        if (id === 'ticket_mp') return handleTicketMP(interaction, client);
        if (id === 'ticket_claim') return handleTicketClaim(interaction, client);
        if (id === 'ticket_leave') return handleTicketLeave(interaction, client);
        if (id === 'ticket_add_member') return handleTicketAddMember(interaction, client);
        if (id === 'ticket_remove_member') return handleTicketRemoveMember(interaction, client);
        if (id === 'ticket_summon_owner') return handleTicketSummonOwner(interaction, client);
        if (id === 'ticket_close') return handleTicketClose(interaction, client);

        /* ─── اللوحة المتزامنة ─── */
        if (id === 'panel_refresh') return handlePanelRefresh(interaction, client);
        if (id === 'panel_add_member') return handlePanelAddMember(interaction, client);
        if (id === 'panel_add_points') return handlePanelAddPoints(interaction, client);
        if (id === 'panel_deduct_points') return handlePanelDeductPoints(interaction, client);
        if (id === 'panel_change_name') return handlePanelChangeName(interaction, client);
        if (id === 'panel_terminate') return handlePanelTerminate(interaction, client);
      }

      /* ═══════════════════════════════════════════════
       *  Select Menus
       *  ═══════════════════════════════════════════════ */
      if (interaction.isUserSelectMenu()) {
        const id = interaction.customId;
        if (id === 'ticket_add_member_select') return handleTicketAddMemberSelect(interaction, client);
        if (id === 'ticket_remove_member_select') return handleTicketRemoveMemberSelect(interaction, client);
        if (id === 'panel_add_member_select') return handlePanelAddMemberSelect(interaction, client);
      }

        if (interaction.isStringSelectMenu()) {
        const id = interaction.customId;

        /* ─── Monitor Count (جديد) ─── */
        if (id === 'monitor_count_select') {
          const mod = require('../commands/monitor.js');
          return mod.handleCountSelect(interaction, client);
        }

        if (id === 'panel_add_points_select') return handlePanelAddPointsSelect(interaction, client);
        if (id === 'panel_deduct_points_select') return handlePanelDeductPointsSelect(interaction, client);
        if (id === 'panel_change_name_select') return handlePanelChangeNameSelect(interaction, client);
        if (id === 'panel_terminate_select') return handlePanelTerminateSelect(interaction, client);
      }

      /* ═══════════════════════════════════════════════
       *  Channel Select Menus — جديد كامل
       *  ═══════════════════════════════════════════════ */
      if (interaction.isChannelSelectMenu()) {
        const id = interaction.customId;

        /* ─── لوحة التذاكر ─── */
        if (id === 'ticket_panel_channel_select') {
          const mod = require('../commands/tickets-panel.js');
          return mod.handleChannelSelect(interaction, client);
        }

        /* ─── لوحة التقارير ─── */
        if (id === 'report_panel_channel_select') {
          const mod = require('../commands/report-panel.js');
          return mod.handleChannelSelect(interaction, client);
        }

        /* ─── لوحة التحكم ─── */
        if (id === 'control_panel_channel_select') {
          const mod = require('../commands/control-panel.js');
          return mod.handleChannelSelect(interaction, client);
        }

        /* ─── اللوحة المتزامنة ─── */
        if (id === 'sync_panel_channel_select') {
          const mod = require('../commands/synchronized-panel.js');
          return mod.handleChannelSelect(interaction, client);
        }

        /* ─── لوحة التوظيف ─── */
        if (id === 'recruitment_panel_channel_select') {
          const mod = require('../commands/recruitment-panel.js');
          return mod.handleChannelSelect(interaction, client);
        }

        /* ─── بوت الدعم ─── */
        if (id === 'support_bot_channel_select') {
          const mod = require('../commands/support-bot.js');
          return mod.handleChannelSelect(interaction, client);
        }

        /* ─── المراقبة (ديناميكي) ─── */
        if (id.startsWith('monitor_channel_select_')) {
          const idx = parseInt(id.replace('monitor_channel_select_', ''), 10);
          const mod = require('../commands/monitor.js');
          return mod.handleChannelSelect(interaction, client, idx);
        }
      }

      /* ═══════════════════════════════════════════════
       *  Modals
       *  ═══════════════════════════════════════════════ */
      if (interaction.isModalSubmit()) {
        const id = interaction.customId;

        /* ─── التقارير ─── */
        if (id === 'report_submit_modal') return handleReportSubmitModal(interaction, client);
        if (id.startsWith('report_reject_modal_')) {
          return handleReportRejectModal(interaction, client, id.replace('report_reject_modal_', ''));
        }

        /* ─── لوحة التحكم ─── */
        if (id === 'control_dm_user_modal') return handleControlDMUserModal(interaction, client);
        if (id === 'control_clean_channel_modal') return handleControlCleanChannelModal(interaction, client);
        if (id === 'control_embed_all_modal') return handleControlEmbedAllModal(interaction, client);
        if (id === 'control_dm_all_modal') return handleControlDMAllModal(interaction, client);

        /* ─── التذاكر ─── */
        if (id === 'ticket_army_modal') return handleTicketArmyModal(interaction, client);
        if (id === 'ticket_mp_modal') return handleTicketMPModal(interaction, client);

        /* ─── اللوحة المتزامنة ─── */
        if (id === 'panel_add_member_modal') return handlePanelAddMemberModal(interaction, client);
        if (id === 'panel_add_points_modal') return handlePanelAddPointsModal(interaction, client);
        if (id === 'panel_deduct_points_modal') return handlePanelDeductPointsModal(interaction, client);
        if (id === 'panel_change_name_modal') return handlePanelChangeNameModal(interaction, client);
        if (id === 'panel_terminate_modal') return handlePanelTerminateModal(interaction, client);
      }

    } catch (err) {
      console.error('[InteractionCreate] خطأ عام:', err);
      console.error(err.stack);

      /* ─── محاولة إبلاغ المستخدم ─── */
      try {
        await logger.logError(client, err.message, 'InteractionCreate').catch(() => {});
      } catch {}

      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: '❌ حدث خطأ داخلي — تم إبلاغ الإدارة',
            ephemeral: true
          }).catch(() => {});
        }
      } catch {}
    }
  }
};