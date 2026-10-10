/* ═══════════════════════════════════════════════════════════
 *  الشرطة العسكرية | وزارة الدفاع الأمريكي
 *  أمر تشغيل المراقبة — Monitor.js
 *  الإصدار: 1.0
 *  الوظيفة:
 *    - تشغيل مراقبة صوتية على قنوات محددة (1-10)
 *    - تسجيل المكالمات الصوتية تلقائياً
 *    - إرسال التسجيل عند خروج الجميع
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
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder
} = require('discord.js');

const CONFIG = require('../config');
const logger = require('../utils/logger');
const voiceEvents = require('../events/voiceStateUpdate.js');

/* ═══════════════════════════════════════════════════════════
 *                    حالة الأمر النشط
 *  ═══════════════════════════════════════════════════════════ */

/**
 * خريطة جلسات الإعداد النشطة
 * key: userId
 * value: { count, channels: [], step, sessionId }
 */
const setupSessions = new Map();

/* ═══════════════════════════════════════════════════════════
 *                    تعريف الأمر
 *  ═══════════════════════════════════════════════════════════ */

module.exports = {
  data: new SlashCommandBuilder()
    .setName('تشغيل-المراقبة')
    .setDescription('تشغيل مراقبة صوتية على قنوات محددة (1-10 مراقبات)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  /**
   * تنفيذ الأمر
   */
  async execute(interaction, client) {
    try {
      /* ═══════════════════════════════════════════════
       *  1. التحقق من الصلاحيات
       *  ═══════════════════════════════════════════════ */
      const allowedRoles = [CONFIG.ROLES.COMMANDER];

      if (!CONFIG.hasAnyRole(interaction.member, allowedRoles)) {
        return interaction.reply({
          content:
            '❌ **ليس لديك صلاحية لاستخدام هذا الأمر**\n\n' +
            '> هذا الأمر مخصص للقائد فقط.',
          ephemeral: true
        });
      }

      /* ═══════════════════════════════════════════════
       *  2. عرض قائمة اختيار عدد المراقبات
       *  ═══════════════════════════════════════════════ */
      const maxSessions = CONFIG.MONITOR.MAX_SESSIONS || 10;
      const options = [];

      for (let i = 1; i <= maxSessions; i++) {
        options.push({
          label: `${i} ${i === 1 ? 'مراقب' : 'مراقبات'}`,
          description: `تشغيل ${i} ${i === 1 ? 'مراقب' : 'مراقبات'} في ${i === 1 ? 'قناة' : 'قنوات'} مختلفة`,
          value: `${i}`,
          emoji: i === 1 ? '👁️' : i <= 3 ? '👁️‍🗨️' : '🔍'
        });
      }

      const countSelect = new StringSelectMenuBuilder()
        .setCustomId('monitor_count_select')
        .setPlaceholder('👁️ اختر عدد المراقبات')
        .addOptions(options);

      const row = new ActionRowBuilder().addComponents(countSelect);

      const embed = new EmbedBuilder()
        .setColor(CONFIG.COLORS.INFO)
        .setAuthor({
          name: 'وزارة الدفاع الأمريكي',
          iconURL: client.user.displayAvatarURL()
        })
        .setTitle('👁️ تشغيل المراقبة الصوتية')
        .setDescription(
          '**اختر عدد المراقبات** التي تريد تشغيلها.\n\n' +
          '━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
          '📋 **كيفية العمل:**\n' +
          '> 1️⃣ اختر عدد المراقبات (1-10)\n' +
          '> 2️⃣ اختر القنوات الصوتية للمراقبة\n' +
          '> 3️⃣ البوت سيدخل كل قناة ويبدأ التسجيل تلقائياً\n' +
          '> 4️⃣ عند خروج الجميع → إرسال التسجيل\n\n' +
          `⚠️ **الحد الأقصى:** ${maxSessions} مراقبات متزامنة`
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
      console.error('[monitor] خطأ:', err.message);

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
 *              معالج اختيار عدد المراقبات
 *  ═══════════════════════════════════════════════════════════ */

async function handleCountSelect(interaction, client) {
  try {
    /* ─── التحقق من الصلاحيات ─── */
    if (!CONFIG.hasAnyRole(interaction.member, [CONFIG.ROLES.COMMANDER])) {
      return interaction.update({
        content: '❌ ليس لديك صلاحية',
        embeds: [],
        components: []
      });
    }

    const count = parseInt(interaction.values[0], 10);
    if (isNaN(count) || count < 1 || count > 10) {
      return interaction.update({
        content: '❌ عدد غير صحيح',
        embeds: [],
        components: []
      });
    }

    /* ─── حفظ في الجلسة ─── */
    const sessionId = `MON_SETUP_${interaction.user.id}_${Date.now()}`;
    setupSessions.set(interaction.user.id, {
      count,
      channels: [],
      step: 1,
      sessionId
    });

    /* ─── عرض قائمة اختيار القنوات ─── */
    await showChannelSelect(interaction, client, count, 0);

  } catch (err) {
    console.error('[handleCountSelect]', err.message);
    await interaction.update({
      content: `❌ ${err.message}`,
      embeds: [],
      components: []
    }).catch(() => {});
  }
}

/* ═══════════════════════════════════════════════════════════
 *              عرض قائمة اختيار القنوات
 *  ═══════════════════════════════════════════════════════════ */

async function showChannelSelect(interaction, client, totalCount, currentIndex) {
  try {
    const session = setupSessions.get(interaction.user.id);
    if (!session) {
      return interaction.update({
        content: '❌ انتهت الجلسة، أعد المحاولة',
        embeds: [],
        components: []
      });
    }

    /* ─── بناء قائمة القنوات الصوتية ─── */
    const channelSelect = new ChannelSelectMenuBuilder()
      .setCustomId(`monitor_channel_select_${currentIndex}`)
      .setPlaceholder(`🎤 اختر القناة ${currentIndex + 1} من ${totalCount}`)
      .setChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)
      .setMinValues(1)
      .setMaxValues(1);

    const row = new ActionRowBuilder().addComponents(channelSelect);

    /* ─── عرض القنوات المختارة حتى الآن ─── */
    let selectedList = '';
    if (session.channels.length > 0) {
      selectedList = session.channels.map((ch, i) =>
        `> ${i + 1}. <#${ch.id}> — \`${ch.name}\``
      ).join('\n');
    } else {
      selectedList = '> *لم يتم اختيار أي قناة بعد*';
    }

    const embed = new EmbedBuilder()
      .setColor(CONFIG.COLORS.INFO)
      .setAuthor({
        name: 'وزارة الدفاع الأمريكي',
        iconURL: client.user.displayAvatarURL()
      })
      .setTitle(`👁️ اختيار القنوات (${currentIndex + 1}/${totalCount})`)
      .setDescription(
        `**اختر القناة رقم ${currentIndex + 1}** للمراقبة.\n\n` +
        '━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
        '**📋 القنوات المختارة حتى الآن:**\n' +
        selectedList
      )
      .setFooter({
        text: `الخطوة ${currentIndex + 1} من ${totalCount}`,
        iconURL: client.user.displayAvatarURL()
      })
      .setTimestamp();

    /* ─── زر إلغاء ─── */
    const cancelButton = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('monitor_setup_cancel')
        .setLabel('إلغاء الإعداد')
        .setEmoji('❌')
        .setStyle(ButtonStyle.Danger)
    );

    await interaction.update({
      embeds: [embed],
      components: [row, cancelButton]
    });

  } catch (err) {
    console.error('[showChannelSelect]', err.message);
  }
}

/* ═══════════════════════════════════════════════════════════
 *              معالج اختيار القناة
 *  ═══════════════════════════════════════════════════════════ */

async function handleChannelSelect(interaction, client, currentIndex) {
  try {
    /* ─── التحقق من الصلاحيات ─── */
    if (!CONFIG.hasAnyRole(interaction.member, [CONFIG.ROLES.COMMANDER])) {
      return interaction.update({
        content: '❌ ليس لديك صلاحية',
        embeds: [],
        components: []
      });
    }

    const session = setupSessions.get(interaction.user.id);
    if (!session) {
      return interaction.update({
        content: '❌ انتهت الجلسة',
        embeds: [],
        components: []
      });
    }

    /* ─── القناة المختارة ─── */
    const channelId = interaction.values[0];
    const channel = await client.channels.fetch(channelId).catch(() => null);

    if (!channel) {
      return interaction.update({
        content: '❌ لم يتم العثور على القناة',
        embeds: [],
        components: []
      });
    }

    /* ─── التحقق من التكرار ─── */
    if (session.channels.some(ch => ch.id === channelId)) {
      return interaction.update({
        content: '❌ هذه القناة مختارة بالفعل',
        embeds: [],
        components: []
      });
    }

    /* ─── التحقق من صلاحيات البوت ─── */
    const botPermissions = channel.permissionsFor(channel.guild.members.me);
    if (!botPermissions.has(PermissionFlagsBits.Connect) ||
        !botPermissions.has(PermissionFlagsBits.Speak)) {
      return interaction.update({
        content: `❌ البوت لا يملك صلاحية الاتصال أو التحدث في <#${channelId}>`,
        embeds: [],
        components: []
      });
    }

    /* ─── التحقق من وجود البوت في القناة ─── */
    if (voiceEvents.activeMonitors.has(channelId)) {
      return interaction.update({
        content: `❌ البوت يراقب هذه القناة بالفعل`,
        embeds: [],
        components: []
      });
    }

    /* ─── إضافة القناة للقائمة ─── */
    session.channels.push({
      id: channel.id,
      name: channel.name
    });

    /* ─── هل انتهينا؟ ─── */
    if (session.channels.length >= session.count) {
      /* ─── بدء المراقبة ─── */
      await startAllMonitors(interaction, client);
    } else {
      /* ─── طلب القناة التالية ─── */
      await showChannelSelect(interaction, client, session.count, session.channels.length);
    }

  } catch (err) {
    console.error('[handleChannelSelect:monitor]', err.message);
    await interaction.update({
      content: `❌ ${err.message}`,
      embeds: [],
      components: []
    }).catch(() => {});
  }
}

/* ═══════════════════════════════════════════════════════════
 *              بدء كل المراقبات
 *  ═══════════════════════════════════════════════════════════ */

async function startAllMonitors(interaction, client) {
  try {
    const session = setupSessions.get(interaction.user.id);
    if (!session) return;

    /* ─── عرض "جاري البدء..." ─── */
    const loadingEmbed = new EmbedBuilder()
      .setColor(CONFIG.COLORS.WARNING)
      .setAuthor({
        name: 'وزارة الدفاع الأمريكي',
        iconURL: client.user.displayAvatarURL()
      })
      .setTitle('⏳ جاري بدء المراقبات...')
      .setDescription(
        `**عدد المراقبات:** ${session.channels.length}\n\n` +
        '━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
        '🎤 جاري الاتصال بالقنوات...'
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

    /* ─── بدء المراقبة لكل قناة ─── */
    const results = [];
    let successCount = 0;
    let failCount = 0;

    for (const ch of session.channels) {
      try {
        const channel = await client.channels.fetch(ch.id).catch(() => null);
        if (!channel) {
          results.push({ channelId: ch.id, channelName: ch.name, success: false, error: 'القناة غير موجودة' });
          failCount++;
          continue;
        }

        const monitorSessionId = `${session.sessionId}_${ch.id}`;
        const result = await voiceEvents.startRecording(
          client,
          channel,
          monitorSessionId,
          interaction.user.id
        );

        if (result.success) {
          results.push({ channelId: ch.id, channelName: ch.name, success: true });
          successCount++;
        } else {
          results.push({ channelId: ch.id, channelName: ch.name, success: false, error: result.error });
          failCount++;
        }

        /* ─── تأخير بين كل قناة لتجنب Rate Limit ─── */
        await new Promise(r => setTimeout(r, 1500));

      } catch (err) {
        results.push({ channelId: ch.id, channelName: ch.name, success: false, error: err.message });
        failCount++;
      }
    }

    /* ─── عرض النتيجة ─── */
    let resultList = '';
    for (const r of results) {
      if (r.success) {
        resultList += `> ✅ <#${r.channelId}> — \`${r.channelName}\`\n`;
      } else {
        resultList += `> ❌ <#${r.channelId}> — \`${r.error}\`\n`;
      }
    }

    const finalEmbed = new EmbedBuilder()
      .setColor(failCount === 0 ? CONFIG.COLORS.SUCCESS : CONFIG.COLORS.WARNING)
      .setAuthor({
        name: 'وزارة الدفاع الأمريكي',
        iconURL: client.user.displayAvatarURL()
      })
      .setTitle(failCount === 0 ? '✅ تم بدء المراقبة' : '⚠️ تم بدء المراقبة مع أخطاء')
      .setDescription(
        `**الملخص:**\n` +
        `> ✅ نجحت: **${successCount}**\n` +
        `> ❌ فشلت: **${failCount}**\n\n` +
        '━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
        '**📋 التفاصيل:**\n' +
        resultList
      )
      .addFields(
        { name: '🆔 الجلسة', value: `\`${session.sessionId}\``, inline: true },
        { name: '👤 المنفذ', value: interaction.user.tag, inline: true }
      )
      .setFooter({
        text: `الحد الأقصى: ${CONFIG.MONITOR.MAX_SESSIONS} مراقبة`,
        iconURL: client.user.displayAvatarURL()
      })
      .setTimestamp();

    /* ─── زر إيقاف المراقبة الكاملة ─── */
    const stopButton = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`monitor_stop_${session.sessionId}`)
        .setLabel('إيقاف كل المراقبات')
        .setEmoji('⏹️')
        .setStyle(ButtonStyle.Danger)
    );

    await interaction.editReply({
      embeds: [finalEmbed],
      components: [stopButton]
    });

    /* ─── لوق ─── */
    await logger.sendLog(client, 'monitor_started', {
      description: `بدأ ${successCount} مراقبة صوتية`,
      fields: [
        { name: '👤 المنفذ', value: interaction.user.tag, inline: true },
        { name: '🆔 الجلسة', value: `\`${session.sessionId}\``, inline: true },
        { name: '📊 النتائج', value: `✅ ${successCount} | ❌ ${failCount}`, inline: true }
      ],
      userId: interaction.user.id
    }).catch(() => {});

    /* ─── حذف الجلسة ─── */
    setupSessions.delete(interaction.user.id);

  } catch (err) {
    console.error('[startAllMonitors]', err.message);

    await interaction.editReply({
      embeds: [{
        color: CONFIG.COLORS.DANGER,
        title: '❌ فشل بدء المراقبة',
        description: `**السبب:**\n\`\`\`${err.message}\`\`\``,
        footer: { text: CONFIG.TEXT.FOOTER },
        timestamp: new Date().toISOString()
      }],
      components: []
    }).catch(() => {});

    setupSessions.delete(interaction.user.id);
  }
}

/* ═══════════════════════════════════════════════════════════
 *              إلغاء الإعداد
 *  ═══════════════════════════════════════════════════════════ */

async function handleSetupCancel(interaction, client) {
  try {
    setupSessions.delete(interaction.user.id);

    await interaction.update({
      embeds: [new EmbedBuilder()
        .setColor(CONFIG.COLORS.GRAY)
        .setAuthor({
          name: 'وزارة الدفاع الأمريكي',
          iconURL: client.user.displayAvatarURL()
        })
        .setTitle('❌ تم إلغاء الإعداد')
        .setDescription('تم إلغاء عملية إعداد المراقبة.')
        .setFooter({
          text: CONFIG.TEXT.FOOTER,
          iconURL: client.user.displayAvatarURL()
        })
        .setTimestamp()
      ],
      components: []
    });

  } catch (err) {
    console.error('[handleSetupCancel]', err.message);
  }
}

/* ═══════════════════════════════════════════════════════════
 *              إيقاف كل المراقبات
 *  ═══════════════════════════════════════════════════════════ */

async function handleStopAll(interaction, client, sessionId) {
  try {
    /* ─── التحقق من الصلاحيات ─── */
    if (!CONFIG.hasAnyRole(interaction.member, [CONFIG.ROLES.COMMANDER])) {
      return interaction.reply({
        content: '❌ ليس لديك صلاحية',
        ephemeral: true
      });
    }

    await interaction.deferReply({ ephemeral: true });

    /* ─── جمع كل المراقبات في هذه الجلسة ─── */
    const toStop = [];
    for (const [channelId, monitor] of voiceEvents.activeMonitors) {
      if (monitor.sessionId.startsWith(sessionId)) {
        toStop.push(channelId);
      }
    }

    if (toStop.length === 0) {
      return interaction.editReply({
        content: '❌ لا توجد مراقبات نشطة لهذه الجلسة'
      });
    }

    /* ─── إيقاف كل مراقبة ─── */
    let stopped = 0;
    for (const channelId of toStop) {
      try {
        const result = await voiceEvents.stopRecording(client, channelId, 'manual');
        if (result.success) stopped++;
        await new Promise(r => setTimeout(r, 2000));
      } catch (err) {
        console.error(`[handleStopAll] فشل إيقاف ${channelId}:`, err.message);
      }
    }

    /* ─── تحديث الرسالة الأصلية ─── */
    try {
      await interaction.message.edit({
        embeds: [new EmbedBuilder()
          .setColor(CONFIG.COLORS.GRAY)
          .setAuthor({
            name: 'وزارة الدفاع الأمريكي',
            iconURL: client.user.displayAvatarURL()
          })
          .setTitle('⏹️ تم إيقاف كل المراقبات')
          .setDescription(`تم إيقاف **${stopped}** مراقبة من قبل <@${interaction.user.id}>`)
          .setFooter({
            text: CONFIG.TEXT.FOOTER,
            iconURL: client.user.displayAvatarURL()
          })
          .setTimestamp()
        ],
        components: []
      });
    } catch {}

    await interaction.editReply({
      content: `✅ تم إيقاف ${stopped} مراقبة`
    });

  } catch (err) {
    console.error('[handleStopAll]', err.message);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: `❌ ${err.message}`, ephemeral: true }).catch(() => {});
    }
  }
}

/* ═══════════════════════════════════════════════════════════
 *                    التصدير
 *  ═══════════════════════════════════════════════════════════ */

module.exports.handleCountSelect = handleCountSelect;
module.exports.handleChannelSelect = handleChannelSelect;
module.exports.handleSetupCancel = handleSetupCancel;
module.exports.handleStopAll = handleStopAll;
module.exports.setupSessions = setupSessions;