/* ═══════════════════════════════════════════════════════════
 *  الشرطة العسكرية | وزارة الدفاع الأمريكي
 *  حدث القنوات الصوتية — VoiceStateUpdate.js
 *  الإصدار: 1.0
 *  الوظيفة:
 *    - بوت الدعم: إشعار عند انضمام شخص لقناة البوت
 *    - المراقبة: تسجيل المكالمات الصوتية في القنوات المراقَبة
 *  ═══════════════════════════════════════════════════════════ */

'use strict';

const {
  Events,
  EmbedBuilder,
  AttachmentBuilder
} = require('discord.js');
const {
  joinVoiceChannel,
  getVoiceConnection,
  VoiceConnectionStatus,
  EndBehaviorType,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  entersState,
  StreamType,
  NoSubscriberBehavior
} = require('@discordjs/voice');
const { createWriteStream, existsSync, mkdirSync, unlinkSync, statSync } = require('fs');
const { join } = require('path');
const { PassThrough } = require('stream');
const prism = require('prism-media');

const CONFIG = require('../config');
const firebase = require('../firebase');
const logger = require('../utils/logger');
const embeds = require('../utils/embeds');

/* ═══════════════════════════════════════════════════════════
 *                    حالة المراقبة النشطة
 *  ═══════════════════════════════════════════════════════════ */

/**
 * خريطة المراقبات النشطة
 * key: channelId
 * value: {
 *   sessionId, monitorId, channelId, channelName,
 *   connection, recording, users, startTime,
 *   audioFile, audioStream, players
 * }
 */
const activeMonitors = new Map();

/**
 * خريطة جلسات الدعم النشطة
 * key: channelId
 * value: { sessionId, startedBy, startedAt, botConnection, users }
 */
const activeSupportSessions = new Map();

/* ═══════════════════════════════════════════════════════════
 *                    مجلد التسجيلات
 *  ═══════════════════════════════════════════════════════════ */

const RECORDINGS_DIR = join(__dirname, '..', 'recordings');
if (!existsSync(RECORDINGS_DIR)) {
  mkdirSync(RECORDINGS_DIR, { recursive: true });
}

/* ═══════════════════════════════════════════════════════════
 *              قسم 1: بوت الدعم (Support Bot)
 *  ═══════════════════════════════════════════════════════════ */

/**
 * معالجة انضمام شخص لقناة بوت الدعم
 */
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

    /* ─── إيجاد قناة الإشعار (يمكن استخدام نفس القناة أو قناة منفصلة) ─── */
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

/**
 * معالجة مغادرة شخص لقناة بوت الدعم
 */
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
 *              قسم 2: المراقبة (Monitor)
 *  ═══════════════════════════════════════════════════════════ */

/**
 * بدء تسجيل في قناة صوتية
 */
async function startRecording(client, channel, sessionId, monitorId) {
  try {
    /* ─── الانضمام للقناة ─── */
    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: true
    });

    /* ─── ملف التسجيل ─── */
    const fileName = `recording_${channel.id}_${sessionId}_${Date.now()}.pcm`;
    const filePath = join(RECORDINGS_DIR, fileName);
    const audioStream = createWriteStream(filePath);

    const monitorData = {
      sessionId,
      monitorId,
      channelId: channel.id,
      channelName: channel.name,
      connection,
      recording: true,
      users: new Set(),
      startTime: Date.now(),
      audioFile: filePath,
      audioStream,
      player: null
    };

    activeMonitors.set(channel.id, monitorData);

    /* ─── معالجة الأخطاء ─── */
    connection.on('error', (err) => {
      console.error(`[Monitor] خطأ في الاتصال (${channel.name}):`, err.message);
    });

    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Signalling, 5000),
          entersState(connection, VoiceConnectionStatus.Connecting, 5000)
        ]);
      } catch {
        stopRecording(client, channel.id, 'disconnected');
      }
    });

    /* ─── استقبال الصوت من المستخدمين ─── */
    const receiver = connection.receiver;

    receiver.speaking.on('start', (userId) => {
      const monitor = activeMonitors.get(channel.id);
      if (!monitor || !monitor.recording) return;

      const member = channel.guild.members.cache.get(userId);
      if (!member || member.user.bot) return;

      /* ─── تسجيل اسم المتحدث ─── */
      monitor.users.add(userId);

      /* ─── إنشاء Audio Stream ─── */
      const audioStream = receiver.subscribe(userId, {
        end: {
          behavior: EndBehaviorType.AfterSilence,
          duration: 1000
        }
      });

      /* ─── تحويل Opus إلى PCM ─── */
      const opusDecoder = new prism.opus.Decoder({
        frameSize: 960,
        channels: 2,
        rate: 48000
      });

      const pcmStream = audioStream.pipe(opusDecoder);

      /* ─── كتابة في ملف التسجيل ─── */
      pcmStream.on('data', (chunk) => {
        try {
          monitor.audioStream.write(chunk);
        } catch (err) {
          console.error('[Monitor] فشل الكتابة:', err.message);
        }
      });

      pcmStream.on('error', (err) => {
        // تجاهل الأخطاء المتوقعة (مثل قطع المستخدم)
      });

      /* ─── حفظ وقت التحدث ─── */
      member._lastSpokeAt = Date.now();
    });

    /* ─── لوق بدء المراقبة ─── */
    await logger.sendLog(client, 'monitor_started', {
      description: `بدء مراقبة القناة **${channel.name}**`,
      fields: [
        { name: '🎤 القناة', value: channel.name, inline: true },
        { name: '🆔 الجلسة', value: `\`${sessionId}\``, inline: true },
        { name: '👤 المُراقب', value: `<@${monitorId}>`, inline: true }
      ],
      userId: monitorId
    }).catch(() => {});

    /* ─── حفظ في Firebase ─── */
    await firebase.saveMonitorSession(sessionId, {
      channelId: channel.id,
      channelName: channel.name,
      monitorId,
      guildId: channel.guild.id
    }).catch(() => {});

    return { success: true, sessionId };

  } catch (err) {
    console.error('[startRecording]', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * إيقاف التسجيل وإرسال الملف
 */
async function stopRecording(client, channelId, reason = 'manual') {
  try {
    const monitor = activeMonitors.get(channelId);
    if (!monitor) return { success: false, error: 'لا يوجد تسجيل نشط' };

    /* ─── إيقاف التسجيل ─── */
    monitor.recording = false;

    /* ─── إغلاق ملف التسجيل ─── */
    if (monitor.audioStream) {
      try {
        monitor.audioStream.end();
      } catch (err) {
        // تجاهل
      }
    }

    /* ─── إغلاق الاتصال ─── */
    try {
      monitor.connection.destroy();
    } catch (err) {
      // تجاهل
    }

    /* ─── حذف من الخريطة ─── */
    activeMonitors.delete(channelId);

    /* ─── حذف من Firebase ─── */
    await firebase.removeMonitorSession(monitor.sessionId).catch(() => {});

    /* ─── انتظار بسيط لإغلاق الملف ─── */
    await new Promise(r => setTimeout(r, 2000));

    /* ─── التحقق من الملف ─── */
    let fileSize = 0;
    try {
      const stats = statSync(monitor.audioFile);
      fileSize = stats.size;
    } catch {
      fileSize = 0;
    }

    /* ─── إذا كان الملف صغيراً جداً (لا توجد تسجيلات) ─── */
    if (fileSize < 1000) {
      try {
        unlinkSync(monitor.audioFile);
      } catch {}

      /* ─── إشعار بعدم وجود تسجيل ─── */
      await sendMonitorNotification(client, monitor, null, reason, 'no_audio');
      return { success: true, message: 'لا يوجد صوت مسجل' };
    }

    /* ─── تحويل PCM إلى MP3 ─── */
    const mp3Path = monitor.audioFile.replace('.pcm', '.mp3');
    const ffmpeg = require('ffmpeg-static');
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    try {
      await execAsync(`"${ffmpeg}" -f s16le -ar 48000 -ac 2 -i "${monitor.audioFile}" -b:a 128k "${mp3Path}"`);
    } catch (ffmpegErr) {
      console.error('[stopRecording] ffmpeg فشل:', ffmpegErr.message);
      // نستخدم الملف الخام كبديل
    }

    const finalFile = existsSync(mp3Path) ? mp3Path : monitor.audioFile;

    /* ─── إرسال الملف ─── */
    await sendMonitorNotification(client, monitor, finalFile, reason, 'has_audio');

    /* ─── حذف الملفات المؤقتة ─── */
    setTimeout(() => {
      try { if (existsSync(monitor.audioFile)) unlinkSync(monitor.audioFile); } catch {}
      try { if (existsSync(mp3Path)) unlinkSync(mp3Path); } catch {}
    }, 30000);

    return { success: true, file: finalFile };

  } catch (err) {
    console.error('[stopRecording]', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * إرسال إشعار المراقبة في القناة
 */
async function sendMonitorNotification(client, monitor, filePath, reason, status) {
  try {
    const channelId = CONFIG.CHANNELS.SUPPORT_WAITING;
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel) return;

    const duration = Math.floor((Date.now() - monitor.startTime) / 1000);
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;

    const embed = new EmbedBuilder()
      .setColor(status === 'has_audio' ? CONFIG.COLORS.INFO : CONFIG.COLORS.GRAY)
      .setAuthor({
        name: 'الشرطة العسكرية — المراقبة',
        iconURL: client.user.displayAvatarURL()
      })
      .setTitle(status === 'has_audio' ? '🎙️ تقرير مراقبة صوتي' : '📭 مراقبة بدون تسجيل')
      .setDescription(
        status === 'has_audio'
          ? 'تم تسجيل المكالمة الصوتية في القناة المراقَبة.'
          : 'انتهت المراقبة بدون تسجيل أي صوت.'
      )
      .addFields(
        { name: '🎤 القناة', value: monitor.channelName, inline: true },
        { name: '🕒 المدة', value: `${minutes}m ${seconds}s`, inline: true },
        { name: '🆔 الجلسة', value: `\`${monitor.sessionId}\``, inline: true },
        { name: '👤 بدأها', value: `<@${monitor.monitorId}>`, inline: true },
        { name: '📊 السبب', value: reason, inline: true },
        { name: '👥 عدد المتحدثين', value: `${monitor.users.size}`, inline: true }
      )
      .setFooter({
        text: CONFIG.TEXT.FOOTER,
        iconURL: client.user.displayAvatarURL()
      })
      .setTimestamp();

    const options = { embeds: [embed] };

    /* ─── إرفاق الملف ─── */
    if (status === 'has_audio' && filePath && existsSync(filePath)) {
      const file = new AttachmentBuilder(filePath, {
        name: `monitor_${monitor.sessionId}.mp3`
      });
      options.files = [file];
    }

    await channel.send(options).catch(() => {});

    /* ─── لوق ─── */
    await logger.sendLog(client, 'monitor_stopped', {
      description: `انتهت مراقبة **${monitor.channelName}**`,
      fields: [
        { name: '🆔 الجلسة', value: `\`${monitor.sessionId}\``, inline: true },
        { name: '🕒 المدة', value: `${minutes}m ${seconds}s`, inline: true },
        { name: '📊 الحالة', value: status, inline: true }
      ],
      userId: monitor.monitorId
    }).catch(() => {});

  } catch (err) {
    console.error('[sendMonitorNotification]', err.message);
  }
}

/* ═══════════════════════════════════════════════════════════
 *              قسم 3: معالج الحدث الرئيسي
 *  ═══════════════════════════════════════════════════════════ */

module.exports = {
  name: Events.VoiceStateUpdate,

  async execute(oldState, newState, client) {
    try {
      /* ═══════════════════════════════════════════════
       *  1. بوت الدعم
       *  ═══════════════════════════════════════════════ */
      await handleSupportBotJoin(client, newState, oldState);
      await handleSupportBotLeave(client, newState, oldState);

      /* ═══════════════════════════════════════════════
       *  2. المراقبة — متابعة الأعضاء
       *  ═══════════════════════════════════════════════ */
      const channelId = newState.channelId || oldState.channelId;
      if (!channelId) return;

      const monitor = activeMonitors.get(channelId);
      if (!monitor) return;

      /* ─── متابعة انضمام شخص ─── */
      if (newState.channelId === channelId && !oldState.channelId) {
        if (!newState.member.user.bot) {
          monitor.users.add(newState.member.id);
        }
      }

      /* ─── متابعة مغادرة شخص ─── */
      if (oldState.channelId === channelId && !newState.channelId) {
        if (!oldState.member.user.bot) {
          /* ─── التحقق: هل بقي أحد غير البوت؟ ─── */
          const channel = oldState.channel;
          if (channel) {
            const remainingHumans = channel.members.filter(m => !m.user.bot);
            if (remainingHumans.size === 0) {
              /* ─── لا يوجد أحد → إيقاف المراقبة ─── */
              console.log(`[Monitor] انتهت المراقبة في ${channel.name} — لا يوجد أعضاء`);
              await stopRecording(client, channelId, 'all_left');
            }
          }
        }
      }

    } catch (err) {
      console.error('[VoiceStateUpdate] خطأ:', err.message);
    }
  },

  /* ─── تصدير الدوال للاستخدام الخارجي ─── */
  startRecording,
  stopRecording,
  activeMonitors,
  activeSupportSessions
};