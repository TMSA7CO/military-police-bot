/* ═══════════════════════════════════════════════════════════
 *  الشرطة العسكرية | وزارة الدفاع الأمريكي
 *  أمر لوحة التوظيف — Recruitment-Panel.js
 *  الإصدار: 1.0
 *  الوظيفة: إنشاء/تحديث لوحة التوظيف في قناة محددة (تنظيف تلقائي)
 *  ═══════════════════════════════════════════════════════════ */

'use strict';

const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ChannelSelectMenuBuilder,
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder
} = require('discord.js');

const CONFIG = require('../config');
const firebase = require('../firebase');
const embeds = require('../utils/embeds');
const logger = require('../utils/logger');
const { cleanChannelById } = require('../utils/cleanChannel');

/* ═══════════════════════════════════════════════════════════
 *                    تعريف الأمر
 *  ═══════════════════════════════════════════════════════════ */

module.exports = {
  data: new SlashCommandBuilder()
    .setName('تحكم-بلوحة-التوظيف')
    .setDescription('إنشاء لوحة التوظيف في قناة محددة (تنظيف تلقائي للقناة)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  /**
   * تنفيذ الأمر
   */
  async execute(interaction, client) {
    try {
      /* ═══════════════════════════════════════════════
       *  1. التحقق من الصلاحيات
       *  ═══════════════════════════════════════════════ */
      const allowedRoles = [
        CONFIG.ROLES.COMMANDER,
        CONFIG.ROLES.DEPUTY_COMMANDER
      ];

      if (!CONFIG.hasAnyRole(interaction.member, allowedRoles)) {
        return interaction.reply({
          content:
            '❌ **ليس لديك صلاحية لاستخدام هذا الأمر**\n\n' +
            '> هذا الأمر مخصص للقائد ونائب القائد فقط.',
          ephemeral: true
        });
      }

      /* ═══════════════════════════════════════════════
       *  2. جلب حالة التوظيف الحالية
       *  ═══════════════════════════════════════════════ */
      const status = await firebase.getRecruitmentStatus();
      const isOpen = status.open === true;

      /* ═══════════════════════════════════════════════
       *  3. عرض قائمة اختيار القناة
       *  ═══════════════════════════════════════════════ */
      const selectMenu = new ChannelSelectMenuBuilder()
        .setCustomId('recruitment_panel_channel_select')
        .setPlaceholder('📌 اختر القناة التي تريد إرسال اللوحة فيها')
        .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setMinValues(1)
        .setMaxValues(1);

      const row = new ActionRowBuilder().addComponents(selectMenu);

      const embed = new EmbedBuilder()
        .setColor(isOpen ? CONFIG.COLORS.SUCCESS : CONFIG.COLORS.DANGER)
        .setAuthor({
          name: 'وزارة الدفاع الأمريكي',
          iconURL: client.user.displayAvatarURL()
        })
        .setTitle('🎖️ تحكم بلوحة التوظيف')
        .setDescription(
          '**اختر القناة** التي تريد إرسال لوحة التوظيف فيها.\n\n' +
          '━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
          '📊 **حالة التوظيف الحالية:**\n' +
          (isOpen
            ? '> 🟢 **التوظيف مفتوح** — يمكن للأعضاء التقديم'
            : '> 🔴 **التوظيف مغلق** — لا يمكن للأعضاء التقديم'
          ) +
          '\n\n' +
          '━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
          '🔘 **الأزرار في اللوحة:**\n' +
          '> 🔓 فتح التوظيف\n' +
          '> 🔒 إغلاق التوظيف\n' +
          '> 🔄 تحديث الحالة\n\n' +
          '⚠️ **ملاحظة:**\n' +
          '> سيتم **حذف جميع الرسائل** في القناة المختارة قبل الإرسال.'
        )
        .setFooter({
          text: CONFIG.TEXT.FOOTER,
          iconURL: client.user.displayAvatarURL()
        })
        .setTimestamp();

      await interaction.reply({
        embeds: [embed],
        components: [row],
        ephemeral: true
      });

    } catch (err) {
      console.error('[recruitment-panel] خطأ:', err.message);

      if (!interaction.replied) {
        await interaction.reply({
          content: '❌ حدث خطأ أثناء تنفيذ الأمر',
          ephemeral: true
        }).catch(() => {});
      }
    }
  }
};

/* ═══════════════════════════════════════════════════════════
 *              معالج اختيار القناة
 *  ═══════════════════════════════════════════════════════════ */

async function handleChannelSelect(interaction, client) {
  try {
    /* ═══════════════════════════════════════════════
     *  1. التحقق من الصلاحيات
     *  ═══════════════════════════════════════════════ */
    const allowedRoles = [
      CONFIG.ROLES.COMMANDER,
      CONFIG.ROLES.DEPUTY_COMMANDER
    ];

    if (!CONFIG.hasAnyRole(interaction.member, allowedRoles)) {
      return interaction.update({
        content: '❌ ليس لديك صلاحية',
        embeds: [],
        components: []
      });
    }

    /* ═══════════════════════════════════════════════
     *  2. جلب القناة
     *  ═══════════════════════════════════════════════ */
    const channelId = interaction.values[0];
    const channel = await client.channels.fetch(channelId).catch(() => null);

    if (!channel) {
      return interaction.update({
        content: '❌ لم يتم العثور على القناة',
        embeds: [],
        components: []
      });
    }

    /* ═══════════════════════════════════════════════
     *  3. التحقق من صلاحيات البوت
     *  ═══════════════════════════════════════════════ */
    const botPermissions = channel.permissionsFor(channel.guild.members.me);

    if (!botPermissions.has(PermissionFlagsBits.SendMessages) ||
        !botPermissions.has(PermissionFlagsBits.ManageMessages) ||
        !botPermissions.has(PermissionFlagsBits.EmbedLinks)) {
      return interaction.update({
        content:
          '❌ **البوت لا يملك الصلاحيات المطلوبة في هذه القناة**\n\n' +
          '> يحتاج: `Send Messages` + `Manage Messages` + `Embed Links`',
        embeds: [],
        components: []
      });
    }

    /* ═══════════════════════════════════════════════
     *  4. تحديث الرسالة → "جاري التحضير..."
     *  ═══════════════════════════════════════════════ */
    const loadingEmbed = new EmbedBuilder()
      .setColor(CONFIG.COLORS.WARNING)
      .setAuthor({
        name: 'وزارة الدفاع الأمريكي',
        iconURL: client.user.displayAvatarURL()
      })
      .setTitle('⏳ جاري التحضير...')
      .setDescription(
        `**القناة المستهدفة:** <#${channelId}>\n\n` +
        '━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
        '🧹 جاري حذف الرسائل القديمة...\n' +
        '🎖️ جاري إرسال اللوحة...'
      )
      .setFooter({
        text: CONFIG.TEXT.FOOTER,
        iconURL: client.user.displayAvatarURL()
      })
      .setTimestamp();

    await interaction.update({
      embeds: [loadingEmbed],
      components: []
    });

    /* ═══════════════════════════════════════════════
     *  5. تنظيف القناة
     *  ═══════════════════════════════════════════════ */
    console.log(`[recruitment-panel] 🧹 تنظيف القناة: #${channel.name}`);

    const cleanResult = await cleanChannelById(client, channelId, { client });

    console.log(`[recruitment-panel] ✅ تم حذف ${cleanResult.deleted} رسالة`);

    /* ═══════════════════════════════════════════════
     *  6. جلب حالة التوظيف الحالية
     *  ═══════════════════════════════════════════════ */
    const status = await firebase.getRecruitmentStatus();
    const isOpen = status.open === true;

    /* ═══════════════════════════════════════════════
     *  7. إرسال اللوحة
     *  ═══════════════════════════════════════════════ */
    const panelPayload = embeds.recruitmentPanel(client, isOpen);
    const message = await channel.send(panelPayload);

    console.log(`[recruitment-panel] ✅ تم إرسال اللوحة في #${channel.name}`);

    /* ═══════════════════════════════════════════════
     *  8. حفظ موقع اللوحة
     *  ═══════════════════════════════════════════════ */
    await firebase.savePanelLocation('recruitment', channel.id, message.id).catch(() => {});

    /* ═══════════════════════════════════════════════
     *  9. تحديث الرسالة → نجاح
     *  ═══════════════════════════════════════════════ */
    const successEmbed = new EmbedBuilder()
      .setColor(CONFIG.COLORS.SUCCESS)
      .setAuthor({
        name: 'وزارة الدفاع الأمريكي',
        iconURL: client.user.displayAvatarURL()
      })
      .setTitle('✅ تم إنشاء لوحة التوظيف بنجاح')
      .setDescription(
        `**القناة:** <#${channelId}>\n\n` +
        '━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
        '**📊 ملخص العملية:**\n' +
        `> 🧹 تم حذف \`${cleanResult.deleted}\` رسالة\n` +
        `> 🎖️ تم إرسال اللوحة\n` +
        `> 📊 الحالة: ${isOpen ? '🟢 مفتوح' : '🔴 مغلق'}\n` +
        `> 🔗 [انتقل للقناة](https://discord.com/channels/${channel.guild.id}/${channel.id})`
      )
      .setFooter({
        text: CONFIG.TEXT.FOOTER,
        iconURL: client.user.displayAvatarURL()
      })
      .setTimestamp();

    await interaction.editReply({
      embeds: [successEmbed],
      components: []
    });

    /* ═══════════════════════════════════════════════
     *  10. لوق
     *  ═══════════════════════════════════════════════ */
    await logger.sendLog(client, 'command_used', {
      description: `تم إنشاء لوحة التوظيف`,
      fields: [
        { name: '👤 المنفذ', value: interaction.user.tag, inline: true },
        { name: '🎖️ القناة', value: `<#${channelId}>`, inline: true },
        { name: '📊 الحالة', value: isOpen ? '🟢 مفتوح' : '🔴 مغلق', inline: true },
        { name: '🧹 محذوفات', value: `${cleanResult.deleted}`, inline: true }
      ],
      userId: interaction.user.id
    }).catch(() => {});

    /* ═══════════════════════════════════════════════
     *  11. رسالة تأكيد مؤقتة
     *  ═══════════════════════════════════════════════ */
    await channel.send({
      content: `✅ تم إنشاء لوحة التوظيف من قبل ${interaction.user}`
    }).then(msg => {
      setTimeout(() => msg.delete().catch(() => {}), 5000);
    }).catch(() => {});

  } catch (err) {
    console.error('[recruitment-panel:select] خطأ:', err.message);

    await interaction.editReply({
      embeds: [{
        color: CONFIG.COLORS.DANGER,
        title: '❌ فشل إنشاء اللوحة',
        description: `**السبب:**\n\`\`\`${err.message}\`\`\``,
        footer: { text: CONFIG.TEXT.FOOTER },
        timestamp: new Date().toISOString()
      }],
      components: []
    }).catch(() => {});
  }
}

/* ═══════════════════════════════════════════════════════════
 *              دالة مساعدة — تحديث اللوحة
 *  ═══════════════════════════════════════════════════════════ */

/**
 * تحديث لوحة التوظيف
 */
async function refreshPanel(client) {
  try {
    const loc = await firebase.getPanelLocation('recruitment');
    if (!loc) return { success: false, error: 'اللوحة غير مثبتة' };

    const channel = await client.channels.fetch(loc.channelId).catch(() => null);
    if (!channel) return { success: false, error: 'القناة غير موجودة' };

    const message = await channel.messages.fetch(loc.messageId).catch(() => null);
    if (!message) return { success: false, error: 'الرسالة غير موجودة' };

    const status = await firebase.getRecruitmentStatus();
    const payload = embeds.recruitmentPanel(client, status.open === true);

    await message.edit(payload);
    return { success: true };

  } catch (err) {
    console.error('[refreshPanel]', err.message);
    return { success: false, error: err.message };
  }
}

/* ═══════════════════════════════════════════════════════════
 *                    التصدير
 *  ═══════════════════════════════════════════════════════════ */

module.exports.handleChannelSelect = handleChannelSelect;
module.exports.refreshPanel = refreshPanel;