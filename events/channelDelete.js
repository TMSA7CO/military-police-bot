/* ═══════════════════════════════════════════════════════════
 *  حذف قناة — ChannelDelete.js
 *  ═══════════════════════════════════════════════════════════ */

'use strict';

const { Events, AuditLogEvent } = require('discord.js');
const CONFIG = require('../config');
const logger = require('../utils/logger');

module.exports = {
  name: Events.ChannelDelete,

  async execute(channel, client) {
    try {
      if (!channel.guild) return;
      if (channel.guild.id !== CONFIG.GUILD_ID) return;

      let executedBy = null;
      try {
        const auditLogs = await channel.guild.fetchAuditLogs({ limit: 5 }).catch(() => null);
        if (auditLogs) {
          const entry = auditLogs.entries.find(e =>
            e.action === AuditLogEvent.ChannelDelete
            && e.target?.id === channel.id
            && (Date.now() - e.createdTimestamp) < 5000
          );
          if (entry) executedBy = entry.executor?.id || null;
        }
      } catch {}

      await logger.sendLog(client, 'channel_deleted', {
        description: `تم حذف قناة`,
        fields: [
          { name: '📋 الاسم', value: `\`${channel.name}\``, inline: true },
          { name: '📂 النوع', value: `\`${channel.type}\``, inline: true },
          { name: '👤 بواسطة', value: executedBy ? `<@${executedBy}>` : 'غير معروف', inline: true }
        ],
        userId: executedBy
      }).catch(() => {});

    } catch (err) {
      console.error('[ChannelDelete]', err.message);
    }
  }
};