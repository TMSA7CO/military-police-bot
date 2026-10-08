/* ═══════════════════════════════════════════════════════════
 *  الشرطة العسكرية | وزارة الدفاع الأمريكي
 *  أمر اللوحة المتزامنة — Synchronized-Panel.js
 *  الإصدار: 1.0
 *  الوظيفة: إنشاء اللوحة المتزامنة في قناة محددة (تنظيف تلقائي)
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
    .setName('تحكم-بلوحة-المتزامنة')
    .setDescription('إنشاء اللوحة المتزامنة للشرطة العسكرية في قناة محددة')
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
       *  2. جلب عدد الأعضاء
       *  ═══════════════════════════════════════════════ */
      const members = await firebase.getAllMembers();
      const totalPoints = members.reduce((sum, m) => sum + (m.points || 0), 0);

      /* ═══════════════════════════════════════════════
       *  3. عرض قائمة اختيار القناة
       *  ═══════════════════════════════════════════════ */
      const selectMenu = new ChannelSelectMenuBuilder()
        .setCustomId('sync_panel_channel_select')
        .setPlaceholder('📌 اختر القناة التي تريد إرسال اللوحة فيها')
        .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setMinValues(1)
        .setMaxValues(1);

      const row = new ActionRowBuilder().addComponents(selectMenu);

      const embed = new EmbedBuilder()
        .setColor(CONFIG.COLORS.GOLD)
        .setAuthor({
          name: 'وزارة الدفاع الأمريكي',
          iconURL: client.user.displayAvatarURL()
        })
        .setTitle('🎖️ تحكم باللوحة المتزامنة')
        .setDescription(
          '**اختر القناة** التي تريد إرسال اللوحة المتزامنة فيها.\n\n' +
          '━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
          '📊 **معلومات حالية:**\n' +
          `> 👥 عدد الأعضاء: **${members.length}**\n` +
          `> ⭐ إجمالي النقاط: **${totalPoints}**\n\n` +
          '━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
          '🔘 **الأزرار المتوفرة:**\n' +
          '> ➕ إضافة عضو\n' +
          '> ⭐ إضافة نقاط\n' +
          '> ➖ خصم نقاط\n' +
          '> ✏️ تغيير اسم\n' +
          '> 🗑️ ترميج عضو\n' +
          '> 🔄 تحديث اللوحة\n\n' +
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
      console.error('[synchronized-panel] خطأ:', err.message);

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
        '👥 جاري جلب الأعضاء...\n' +
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
    console.log(`[synchronized-panel] 🧹 تنظيف القناة: #${channel.name}`);

    const cleanResult = await cleanChannelById(client, channelId, { client });

    console.log(`[synchronized-panel] ✅ تم حذف ${cleanResult.deleted} رسالة`);

    /* ═══════════════════════════════════════════════
     *  6. جلب الأعضاء
     *  ═══════════════════════════════════════════════ */
    const members = await firebase.getAllMembers();
    const totalPoints = members.reduce((sum, m) => sum + (m.points || 0), 0);

    /* ═══════════════════════════════════════════════
     *  7. إرسال اللوحة
     *  ═══════════════════════════════════════════════ */
    const panelPayload = embeds.synchronizedPanel(client, members);
    const message = await channel.send(panelPayload);

    console.log(`[synchronized-panel] ✅ تم إرسال اللوحة في #${channel.name}`);

    /* ═══════════════════════════════════════════════
     *  8. حفظ موقع اللوحة
     *  ═══════════════════════════════════════════════ */
    await firebase.savePanelLocation('synchronized', channel.id, message.id).catch(() => {});

    /* ═══════════════════════════════════════════════
     *  9. تحديث الرسالة → نجاح
     *  ═══════════════════════════════════════════════ */
    const successEmbed = new EmbedBuilder()
      .setColor(CONFIG.COLORS.SUCCESS)
      .setAuthor({
        name: 'وزارة الدفاع الأمريكي',
        iconURL: client.user.displayAvatarURL()
      })
      .setTitle('✅ تم إنشاء اللوحة المتزامنة بنجاح')
      .setDescription(
        `**القناة:** <#${channelId}>\n\n` +
        '━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
        '**📊 ملخص العملية:**\n' +
        `> 🧹 تم حذف \`${cleanResult.deleted}\` رسالة\n` +
        `> 👥 عدد الأعضاء: **${members.length}**\n` +
        `> ⭐ إجمالي النقاط: **${totalPoints}**\n` +
        `> 🎖️ تم إرسال اللوحة\n` +
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
      description: `تم إنشاء اللوحة المتزامنة`,
      fields: [
        { name: '👤 المنفذ', value: interaction.user.tag, inline: true },
        { name: '🎖️ القناة', value: `<#${channelId}>`, inline: true },
        { name: '👥 الأعضاء', value: `${members.length}`, inline: true },
        { name: '🧹 محذوفات', value: `${cleanResult.deleted}`, inline: true }
      ],
      userId: interaction.user.id
    }).catch(() => {});

    /* ═══════════════════════════════════════════════
     *  11. رسالة تأكيد مؤقتة
     *  ═══════════════════════════════════════════════ */
    await channel.send({
      content: `✅ تم إنشاء اللوحة المتزامنة من قبل ${interaction.user}`
    }).then(msg => {
      setTimeout(() => msg.delete().catch(() => {}), 5000);
    }).catch(() => {});

  } catch (err) {
    console.error('[synchronized-panel:select] خطأ:', err.message);

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
 * تحديث اللوحة المتزامنة (تُستدعى من أي مكان)
 */
async function refreshPanel(client) {
  try {
    const loc = await firebase.getPanelLocation('synchronized');
    if (!loc) return { success: false, error: 'اللوحة غير مثبتة' };

    const channel = await client.channels.fetch(loc.channelId).catch(() => null);
    if (!channel) return { success: false, error: 'القناة غير موجودة' };

    const message = await channel.messages.fetch(loc.messageId).catch(() => null);
    if (!message) return { success: false, error: 'الرسالة غير موجودة' };

    const members = await firebase.getAllMembers();
    const payload = embeds.synchronizedPanel(client, members);

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