/* ═══════════════════════════════════════════════════════════
 *  حذف رسالة — MessageDelete.js
 *  ═══════════════════════════════════════════════════════════ */

'use strict';

const { Events } = require('discord.js');
const CONFIG = require('../config');
const logger = require('../utils/logger');

module.exports = {
  name: Events.MessageDelete,

  async execute(message, client) {
    try {
      if (!message.guild) return;
      if (message.guild.id !== CONFIG.GUILD_ID) return;
      if (message.author?.bot) return;

      /* ─── تجاهل رسائل البوت نفسه وقنوات اللوق ─── */
      if (message.channelId === CONFIG.CHANNELS.LOGS) return;

      const content = message.content
        ? (message.content.length > 1000
            ? message.content.substring(0, 1000) + '...'
            : message.content)
        : '*[رسالة تحتوي على صورة أو ملف فقط]*';

      await logger.sendLog(client, 'message_deleted', {
        description: `تم حذف رسالة في <#${message.channelId}>`,
        fields: [
          { name: '👤 صاحب الرسالة', value: message.author ? `${message.author.tag}` : 'غير معروف', inline: true },
          { name: '📌 القناة', value: `<#${message.channelId}>`, inline: true },
          { name: '💬 المحتوى', value: content, inline: false }
        ],
        userId: message.author?.id,
        userName: message.author?.tag
      }).catch(() => {});

    } catch (err) {
      console.error('[MessageDelete]', err.message);
    }
  }
};