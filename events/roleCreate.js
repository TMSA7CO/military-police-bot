/* ═══════════════════════════════════════════════════════════
 *  إنشاء رتبة — RoleCreate.js
 *  ═══════════════════════════════════════════════════════════ */

'use strict';

const { Events, AuditLogEvent } = require('discord.js');
const CONFIG = require('../config');
const logger = require('../utils/logger');

module.exports = {
  name: Events.GuildRoleCreate,

  async execute(role, client) {
    try {
      if (role.guild.id !== CONFIG.GUILD_ID) return;

      let executedBy = null;
      try {
        const auditLogs = await role.guild.fetchAuditLogs({ limit: 5 }).catch(() => null);
        if (auditLogs) {
          const entry = auditLogs.entries.find(e =>
            e.action === AuditLogEvent.RoleCreate
            && e.target?.id === role.id
            && (Date.now() - e.createdTimestamp) < 5000
          );
          if (entry) executedBy = entry.executor?.id || null;
        }
      } catch {}

      await logger.sendLog(client, 'role_created', {
        description: `تم إنشاء رتبة جديدة`,
        fields: [
          { name: '🎭 الرتبة', value: `<@&${role.id}>`, inline: true },
          { name: '📋 الاسم', value: `\`${role.name}\``, inline: true },
          { name: '🎨 اللون', value: `\`${role.hexColor}\``, inline: true },
          { name: '👤 بواسطة', value: executedBy ? `<@${executedBy}>` : 'غير معروف', inline: true }
        ],
        userId: executedBy
      }).catch(() => {});

    } catch (err) {
      console.error('[RoleCreate]', err.message);
    }
  }
};