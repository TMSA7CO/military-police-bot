/* ═══════════════════════════════════════════════════════════
 *  تعديل رسالة — MessageUpdate.js
 *  ═══════════════════════════════════════════════════════════ */

'use strict';

const { Events } = require('discord.js');
const CONFIG = require('../config');
const logger = require('../utils/logger');

module.exports = {
  name: Events.MessageUpdate,

  async execute(oldMessage, newMessage, client) {
    try {
      if (!newMessage.guild) return;
      if (newMessage.guild.id !== CONFIG.GUILD_ID) return;
      if (newMessage.author?.bot) return;

      /* ─── تجاهل: نفس المحتوى ─── */
      if (oldMessage.content === newMessage.content) return;

      /* ─── تجاهل: الرسائل في اللوق ─── */
      if (newMessage.channelId === CONFIG.CHANNELS.LOGS) return;

      const oldContent = oldMessage.content || '*[غير متوفر]*';
      const newContent = newMessage.content || '*[غير متوفر]*';

      /* ─── اقتطاع ─── */
      const truncate = (str, len = 500) =>
        str.length > len ? str.substring(0, len) + '...' : str;

      await logger.sendLog(client, 'message_updated', {
        description: `تم تعديل رسالة في <#${newMessage.channelId}>`,
        fields: [
          { name: '👤 صاحب الرسالة', value: newMessage.author?.tag || 'غير معروف', inline: true },
          { name: '📌 القناة', value: `<#${newMessage.channelId}>`, inline: true },
          { name: '🔗 رابط الرسالة', value: `[اضغط هنا](${newMessage.url})`, inline: true },
          { name: '📝 قبل', value: truncate(oldContent), inline: false },
          { name: '✨ بعد', value: truncate(newContent), inline: false }
        ],
        userId: newMessage.author?.id,
        userName: newMessage.author?.tag
      }).catch(() => {});

    } catch (err) {
      console.error('[MessageUpdate]', err.message);
    }
  }
};