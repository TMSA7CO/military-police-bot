/* ═══════════════════════════════════════════════════════════
 *  الشرطة العسكرية | وزارة الدفاع الأمريكي
 *  أمر بوت الدعم — Support-Bot.js
 *  الإصدار: 1.0
 *  الوظيفة:
 *    - إدخال البوت إلى قناة صوتية محددة
 *    - تشغيل رسالة صوتية تلقائية (TTS)
 *    - إشعار عند انضمام عسكري للقناة
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
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
  getVoiceConnection,
  StreamType,
  NoSubscriberBehavior
} = require('@discordjs/voice');
const { createReadStream, existsSync, mkdirSync, writeFileSync, unlinkSync } = require('fs');
const { join } = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const CONFIG = require('../config');
const logger = require('../utils/logger');

const ffmpegPath = require('ffmpeg-static');

/* ═══════════════════════════════════════════════════════════
 *                    إعدادات
 *  ═══════════════════════════════════════════════════════════ */

/* نص بوت الدعم */
const SUPPORT_MESSAGE = 'الشرطة العسكرية سوف تسحبك بعد قليل، الرجاء الانتظار يا عسكري.';

/* خريطة جلسات الدعم النشطة */
/* key: channelId */
/* value: { sessionId, startedBy, startedAt, connection, player, interval } */
const activeSupportSessions = new Map();

/* مجلد الملفات الصوتية المؤقتة */
const AUDIO_DIR = join(__dirname, '..', 'audio');
if (!existsSync(AUDIO_DIR)) {
  mkdirSync(AUDIO_DIR, { recursive: true });
}

/* ═══════════════════════════════════════════════════════════
 *              توليد ملف صوتي من النص (TTS)
 *  ═══════════════════════════════════════════════════════════ */

/**
 * توليد ملف صوتي بصيغة MP3 من نص عربي
 * يستخدم espeak-ng أو Microsoft TTS عبر Edge (بدون API key)
 */
async function generateTTSFile(text, outputPath) {
  try {
    /* ─── استخدام Windows SAPI عبر PowerShell (يعمل على Windows) ─── */
    if (process.platform === 'win32') {
      const escapedText = text.replace(/"/g, '`"');
      const psCommand = `
        Add-Type -AssemblyName System.Speech;
        $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer;
        $synth.SetOutputToWaveFile("${outputPath.replace(/\\/g, '\\\\')}");
        $synth.Speak("${escapedText}");
        $synth.Dispose();
      `;

      await execAsync(`powershell -Command "${psCommand.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, {
        timeout: 30000
      });

      /* تحويل WAV → MP3 */
      const mp3Path = outputPath.replace('.wav', '.mp3');
      await execAsync(`"${ffmpegPath}" -y -i "${outputPath}" -b:a 128k "${mp3Path}"`, {
        timeout: 30000
      });

      return mp3Path;
    }

    /* ─── على Linux (Koyeb) — استخدام espeak ─── */
    const mp3Path = outputPath.replace('.wav', '.mp3');
    await execAsync(`espeak-ng -v ar -w "${outputPath}" "${text}"`, { timeout: 30000 });
    await execAsync(`"${ffmpegPath}" -y -i "${outputPath}" -b:a 128k "${mp3Path}"`, { timeout: 30000 });

    return mp3Path;

  } catch (err) {
    console.error('[generateTTSFile]', err.message);
    return null;
  }
}

/**
 * توليد ملف صوتي مسبقاً (للاستخدام المتكرر)
 */
async function ensureAudioFile() {
  const audioPath = join(AUDIO_DIR, 'support_message.mp3');

  if (existsSync(audioPath)) {
    return audioPath;
  }

  console.log('[Support-Bot] 🎙️ جاري توليد الملف الصوتي...');

  const wavPath = join(AUDIO_DIR, 'support_message.wav');
  const result = await generateTTSFile(SUPPORT_MESSAGE, wavPath);

  /* حذف WAV */
  try { if (existsSync(wavPath)) unlinkSync(wavPath); } catch {}

  if (result && existsSync(result)) {
    console.log('[Support-Bot] ✅ تم توليد الملف الصوتي');
    return result;
  }

  console.warn('[Support-Bot] ⚠️ فشل توليد الملف الصوتي — سيتم استخدام ملف بديل');

  /* ─── ملف بديل: نغمة تنبيه بسيطة ─── */
  try {
    await execAsync(
      `"${ffmpegPath}" -y -f lavfi -i "sine=frequency=440:duration=1" -b:a 128k "${audioPath}"`,
      { timeout: 15000 }
    );
    return audioPath;
  } catch {
    return null;
  }
}

/* ═══════════════════════════════════════════════════════════
 *                    تعريف الأمر
 *  ═══════════════════════════════════════════════════════════ */

module.exports = {
  data: new SlashCommandBuilder()
    .setName('التحكم-بوت-الدعم')
    .setDescription('إدخال بوت الدعم لقناة صوتية محددة (للاستخدام في التحقيق)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Connect),

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
       *  2. عرض قائمة اختيار القناة الصوتية
       *  ═══════════════════════════════════════════════ */
      const selectMenu = new ChannelSelectMenuBuilder()
        .setCustomId('support_bot_channel_select')
        .setPlaceholder('🎤 اختر القناة الصوتية')
        .setChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)
        .setMinValues(1)
        .setMaxValues(1);

      const row = new ActionRowBuilder().addComponents(selectMenu);

      const embed = new EmbedBuilder()
        .setColor(CONFIG.COLORS.INFO)
        .setAuthor({
          name: 'وزارة الدفاع الأمريكي',
          iconURL: client.user.displayAvatarURL()
        })
        .setTitle('🎧 التحكم ببوت الدعم')
        .setDescription(
          '**اختر القناة الصوتية** التي تريد إدخال بوت الدعم فيها.\n\n' +
          '━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
          '📋 **وظائف البوت:**\n' +
          '> 🎙️ تشغيل رسالة صوتية تلقائية:\n' +
          `> _"${SUPPORT_MESSAGE}"_\n\n` +
          '> 🔔 إشعار تلقائي عند انضمام عسكري\n\n' +
          '⚠️ **لا تنسَ:** يجب إدخال البوت يدوياً إذا كنت تريد استخدام الأمر.'
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
      console.error('[support-bot] خطأ:', err.message);

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
     *  3. التحقق من أن البوت حر
     *  ═══════════════════════════════════════════════ */
    if (activeSupportSessions.has(channelId)) {
      const session = activeSupportSessions.get(channelId);
      return interaction.update({
        content:
          `❌ **البوت يعمل بالفعل في هذه القناة**\n\n` +
          `> بدأ من: <@${session.startedBy}>\n` +
          `> للإنهاء: استخدم أمر "إيقاف بوت الدعم"`,
        embeds: [],
        components: []
      });
    }

    /* ═══════════════════════════════════════════════
     *  4. تحديث الرسالة → "جاري الانضمام..."
     *  ═══════════════════════════════════════════════ */
    const loadingEmbed = new EmbedBuilder()
      .setColor(CONFIG.COLORS.WARNING)
      .setAuthor({
        name: 'وزارة الدفاع الأمريكي',
        iconURL: client.user.displayAvatarURL()
      })
      .setTitle('⏳ جاري الانضمام للقناة...')
      .setDescription(
        `**القناة:** <#${channelId}>\n\n` +
        '🎤 جاري الاتصال...\n' +
        '🎙️ جاري تحضير الرسالة الصوتية...'
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
     *  5. توليد الملف الصوتي (إن لم يكن موجوداً)
     *  ═══════════════════════════════════════════════ */
    const audioPath = await ensureAudioFile();

    /* ═══════════════════════════════════════════════
     *  6. الانضمام للقناة
     *  ═══════════════════════════════════════════════ */
    console.log(`[Support-Bot] 🎤 الانضمام للقناة: ${channel.name}`);

    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: false
    });

    /* ═══════════════════════════════════════════════
     *  7. انتظار جاهزية الاتصال
     *  ═══════════════════════════════════════════════ */
    try {
      await entersState(connection, VoiceConnectionStatus.Ready, 20000);
    } catch {
      connection.destroy();
      return interaction.editReply({
        embeds: [{
          color: CONFIG.COLORS.DANGER,
          title: '❌ فشل الاتصال',
          description: 'لم نتمكن من الاتصال بالقناة الصوتية',
          footer: { text: CONFIG.TEXT.FOOTER },
          timestamp: new Date().toISOString()
        }],
        components: []
      });
    }

    /* ═══════════════════════════════════════════════
     *  8. إنشاء Audio Player
     *  ═══════════════════════════════════════════════ */
    const player = createAudioPlayer({
      behaviors: {
        noSubscriber: NoSubscriberBehavior.Play
      }
    });

    connection.subscribe(player);

    /* ═══════════════════════════════════════════════
     *  9. تشغيل الرسالة الصوتية بشكل متكرر
     *  ═══════════════════════════════════════════════ */
    const playAudio = () => {
      try {
        if (!audioPath || !existsSync(audioPath)) {
          console.warn('[Support-Bot] ⚠️ ملف الصوت غير موجود');
          return;
        }

        const resource = createAudioResource(audioPath, {
          inputType: StreamType.Arbitrary
        });

        player.play(resource);
      } catch (err) {
        console.error('[Support-Bot] فشل تشغيل الصوت:', err.message);
      }
    };

    /* تشغيل فوري */
    playAudio();

    /* تشغيل متكرر كل 30 ثانية */
    player.on(AudioPlayerStatus.Idle, () => {
      setTimeout(() => {
        if (activeSupportSessions.has(channelId)) {
          playAudio();
        }
      }, 5000);
    });

    player.on('error', (err) => {
      console.error('[Support-Bot] خطأ player:', err.message);
    });

    /* ═══════════════════════════════════════════════
     *  10. حفظ الجلسة
     *  ═══════════════════════════════════════════════ */
    const sessionData = {
      sessionId: `SUP_${Date.now()}`,
      startedBy: interaction.user.id,
      startedAt: Date.now(),
      channelId: channel.id,
      channelName: channel.name,
      connection,
      player,
      audioPath
    };

    activeSupportSessions.set(channelId, sessionData);

    /* ═══════════════════════════════════════════════
     *  11. معالجة انقطاع الاتصال
     *  ═══════════════════════════════════════════════ */
    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Signalling, 5000),
          entersState(connection, VoiceConnectionStatus.Connecting, 5000)
        ]);
      } catch {
        console.log('[Support-Bot] انقطع الاتصال');
        activeSupportSessions.delete(channelId);
        try { connection.destroy(); } catch {}
      }
    });

    /* ═══════════════════════════════════════════════
     *  12. إشعار النجاح
     *  ═══════════════════════════════════════════════ */
    const successEmbed = new EmbedBuilder()
      .setColor(CONFIG.COLORS.SUCCESS)
      .setAuthor({
        name: 'وزارة الدفاع الأمريكي',
        iconURL: client.user.displayAvatarURL()
      })
      .setTitle('✅ بوت الدعم نشط')
      .setDescription(
        `**القناة:** <#${channelId}>\n\n` +
        '━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
        '**🎙️ الحالة:**\n' +
        '> ✅ البوت متصل بالقناة\n' +
        '> 🔁 الرسالة الصوتية تُشغّل بشكل متكرر\n' +
        '> 🔔 الإشعارات التلقائية نشطة\n\n' +
        '**⚠️ للإيقاف:**\n' +
        '> سيتم الإيقاف تلقائياً عند خروج آخر شخص من القناة.'
      )
      .addFields(
        { name: '🆔 الجلسة', value: `\`${sessionData.sessionId}\``, inline: true },
        { name: '👤 بواسطة', value: interaction.user.tag, inline: true }
      )
      .setFooter({
        text: CONFIG.TEXT.FOOTER,
        iconURL: client.user.displayAvatarURL()
      })
      .setTimestamp();

    const stopButton = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`support_stop_${channelId}`)
        .setLabel('إيقاف بوت الدعم')
        .setEmoji('⏹️')
        .setStyle(ButtonStyle.Danger)
    );

    await interaction.editReply({
      embeds: [successEmbed],
      components: [stopButton]
    });

    /* ═══════════════════════════════════════════════
     *  13. لوق
     *  ═══════════════════════════════════════════════ */
    await logger.sendLog(client, 'support_started', {
      description: `بوت الدعم بدأ العمل`,
      fields: [
        { name: '👤 المنفذ', value: interaction.user.tag, inline: true },
        { name: '🎤 القناة', value: channel.name, inline: true },
        { name: '🆔 الجلسة', value: `\`${sessionData.sessionId}\``, inline: true }
      ],
      userId: interaction.user.id
    }).catch(() => {});

  } catch (err) {
    console.error('[support-bot:select] خطأ:', err.message);

    await interaction.editReply({
      embeds: [{
        color: CONFIG.COLORS.DANGER,
        title: '❌ فشل تشغيل بوت الدعم',
        description: `**السبب:**\n\`\`\`${err.message}\`\`\``,
        footer: { text: CONFIG.TEXT.FOOTER },
        timestamp: new Date().toISOString()
      }],
      components: []
    }).catch(() => {});
  }
}

/* ═══════════════════════════════════════════════════════════
 *              إيقاف بوت الدعم
 *  ═══════════════════════════════════════════════════════════ */

async function stopSupportBot(client, channelId, stoppedBy) {
  try {
    const session = activeSupportSessions.get(channelId);
    if (!session) {
      return { success: false, error: 'لا يوجد بوت دعم نشط في هذه القناة' };
    }

    /* ─── إيقاف التشغيل المتكرر ─── */
    if (session.interval) {
      clearInterval(session.interval);
    }

    /* ─── إيقاف player ─── */
    try {
      session.player.stop();
    } catch {}

    /* ─── إغلاق الاتصال ─── */
    try {
      session.connection.destroy();
    } catch {}

    /* ─── حذف من الخريطة ─── */
    activeSupportSessions.delete(channelId);

    /* ─── لوق ─── */
    await logger.sendLog(client, 'support_stopped', {
      description: `بوت الدعم توقف`,
      fields: [
        { name: '👤 المنفذ', value: stoppedBy ? `<@${stoppedBy}>` : 'النظام', inline: true },
        { name: '🎤 القناة', value: session.channelName, inline: true },
        { name: '🕒 المدة', value: `${Math.floor((Date.now() - session.startedAt) / 1000)}s`, inline: true }
      ],
      userId: stoppedBy
    }).catch(() => {});

    return { success: true };

  } catch (err) {
    console.error('[stopSupportBot]', err.message);
    return { success: false, error: err.message };
  }
}

/* ═══════════════════════════════════════════════════════════
 *              معالج زر الإيقاف
 *  ═══════════════════════════════════════════════════════════ */

async function handleStopButton(interaction, client, channelId) {
  try {
    /* ─── التحقق من الصلاحيات ─── */
    const allowedRoles = [
      CONFIG.ROLES.COMMANDER,
      CONFIG.ROLES.DEPUTY_COMMANDER
    ];

    if (!CONFIG.hasAnyRole(interaction.member, allowedRoles)) {
      return interaction.reply({
        content: '❌ ليس لديك صلاحية',
        ephemeral: true
      });
    }

    await interaction.deferReply({ ephemeral: true });

    const result = await stopSupportBot(client, channelId, interaction.user.id);

    if (result.success) {
      /* ─── تحديث رسالة النجاح السابقة ─── */
      try {
        const oldMessage = interaction.message;
        await oldMessage.edit({
          embeds: [new EmbedBuilder()
            .setColor(CONFIG.COLORS.GRAY)
            .setAuthor({
              name: 'وزارة الدفاع الأمريكي',
              iconURL: client.user.displayAvatarURL()
            })
            .setTitle('⏹️ تم إيقاف بوت الدعم')
            .setDescription(`تم إيقاف البوت في القناة من قبل <@${interaction.user.id}>`)
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
        content: '✅ تم إيقاف بوت الدعم'
      });
    } else {
      await interaction.editReply({
        content: `❌ ${result.error}`
      });
    }

  } catch (err) {
    console.error('[handleStopButton]', err.message);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: `❌ ${err.message}`, ephemeral: true }).catch(() => {});
    }
  }
}

/* ═══════════════════════════════════════════════════════════
 *                    التصدير
 *  ═══════════════════════════════════════════════════════════ */

module.exports.handleChannelSelect = handleChannelSelect;
module.exports.stopSupportBot = stopSupportBot;
module.exports.handleStopButton = handleStopButton;
module.exports.activeSupportSessions = activeSupportSessions;