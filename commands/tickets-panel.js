/* ═══════════════════════════════════════════════════════════
 *  الشرطة العسكرية | وزارة الدفاع الأمريكي
 *  أمر لوحة التذاكر — Tickets-Panel.js
 *  الإصدار: 1.0
 *  الوظيفة: إنشاء لوحة تذاكر في قناة محددة (تنظيف تلقائي)
 *  ═══════════════════════════════════════════════════════════ */

'use strict';

const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ChannelSelectMenuBuilder,
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle
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
    .setName('تحكم-بلوحة-التذاكر')
    .setDescription('إنشاء لوحة التذاكر في قناة محددة (تنظيف تلقائي للقناة)')
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
       *  2. عرض قائمة اختيار القناة
       *  ═══════════════════════════════════════════════ */
      const selectMenu = new ChannelSelectMenuBuilder()
        .setCustomId('ticket_panel_channel_select')
        .setPlaceholder('📌 اختر القناة التي تريد إرسال اللوحة فيها')
        .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setMinValues(1)
        .setMaxValues(1);

      const row = new ActionRowBuilder().addComponents(selectMenu);

      const embed = new EmbedBuilder()
        .setColor(CONFIG.COLORS.PRIMARY)
        .setAuthor({
          name: 'وزارة الدفاع الأمريكي',
          iconURL: client.user.displayAvatarURL()
        })
        .setTitle('🎫 تحكم بلوحة التذاكر')
        .setDescription(
          '**اختر القناة** التي تريد إرسال لوحة التذاكر فيها.\n\n' +
          '━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
          '⚠️ **ملاحظة مهمة:**\n' +
          '> سيتم **حذف جميع الرسائل** في القناة المختارة قبل إرسال اللوحة.'
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
      console.error('[tickets-panel] خطأ:', err.message);

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
 *              معالج اختيار القناة (يُستدعى من interactionCreate)
 *  ═══════════════════════════════════════════════════════════ */

/**
 * معالجة اختيار القناة لإرسال اللوحة
 *
 * @param {ChannelSelectMenuInteraction} interaction
 * @param {Client} client
 */
async function handleChannelSelect(interaction, client) {
  try {
    /* ═══════════════════════════════════════════════
     *  1. التحقق من الصلاحيات مرة أخرى
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
     *  2. جلب القناة المختارة
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
     *  3. التحقق من صلاحيات البوت في القناة
     *  ═══════════════════════════════════════════════ */
    const botPermissions = channel.permissionsFor(channel.guild.members.me);

    if (!botPermissions.has(PermissionFlagsBits.SendMessages) ||
        !botPermissions.has(PermissionFlagsBits.ManageMessages)) {
      return interaction.update({
        content:
          '❌ **البوت لا يملك الصلاحيات المطلوبة في هذه القناة**\n\n' +
          '> يحتاج: `Send Messages` + `Manage Messages`',
        embeds: [],
        components: []
      });
    }

    /* ═══════════════════════════════════════════════
     *  4. تحديث الرسالة → "جاري التنظيف..."
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
        '🎫 جاري إرسال اللوحة...'
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
    console.log(`[tickets-panel] 🧹 تنظيف القناة: #${channel.name}`);

    const cleanResult = await cleanChannelById(client, channelId, { client });

    console.log(`[tickets-panel] ✅ تم حذف ${cleanResult.deleted} رسالة`);

    /* ═══════════════════════════════════════════════
     *  6. إرسال اللوحة
     *  ═══════════════════════════════════════════════ */
    const panelPayload = embeds.ticketsPanel(client);
    const message = await channel.send(panelPayload);

    console.log(`[tickets-panel] ✅ تم إرسال اللوحة في #${channel.name}`);

    /* ═══════════════════════════════════════════════
     *  7. حفظ موقع اللوحة في Firebase
     *  ═══════════════════════════════════════════════ */
    await firebase.savePanelLocation('tickets', channel.id, message.id).catch(() => {});

    /* ═══════════════════════════════════════════════
     *  8. تحديث الرسالة → نجاح
     *  ═══════════════════════════════════════════════ */
    const successEmbed = new EmbedBuilder()
      .setColor(CONFIG.COLORS.SUCCESS)
      .setAuthor({
        name: 'وزارة الدفاع الأمريكي',
        iconURL: client.user.displayAvatarURL()
      })
      .setTitle('✅ تم إنشاء لوحة التذاكر بنجاح')
      .setDescription(
        `**القناة:** <#${channelId}>\n\n` +
        '━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
        '**📊 ملخص العملية:**\n' +
        `> 🧹 تم حذف \`${cleanResult.deleted}\` رسالة\n` +
        `> 🎫 تم إرسال اللوحة\n` +
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
     *  9. لوق
     *  ═══════════════════════════════════════════════ */
    await logger.sendLog(client, 'command_used', {
      description: `تم إنشاء لوحة تذاكر جديدة`,
      fields: [
        { name: '👤 المنفذ', value: interaction.user.tag, inline: true },
        { name: '🎫 القناة', value: `<#${channelId}>`, inline: true },
        { name: '🧹 محذوفات', value: `${cleanResult.deleted}`, inline: true }
      ],
      userId: interaction.user.id
    }).catch(() => {});

    /* ═══════════════════════════════════════════════
     *  10. محاولة إرسال رسالة في القناة للإشارة
     *  ═══════════════════════════════════════════════ */
    await channel.send({
      content: `✅ تم إنشاء لوحة التذاكر من قبل ${interaction.user}`,
      embeds: []
    }).then(msg => {
      /* حذف الرسالة بعد 5 ثواني */
      setTimeout(() => msg.delete().catch(() => {}), 5000);
    }).catch(() => {});

  } catch (err) {
    console.error('[tickets-panel:select] خطأ:', err.message);

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
 *                    التصدير
 *  ═══════════════════════════════════════════════════════════ */

module.exports.handleChannelSelect = handleChannelSelect;