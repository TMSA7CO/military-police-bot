/* ═══════════════════════════════════════════════════════════
 *  تعديل رتبة — RoleUpdate.js
 *  ═══════════════════════════════════════════════════════════ */

'use strict';

const { Events, AuditLogEvent } = require('discord.js');
const CONFIG = require('../config');
const logger = require('../utils/logger');

module.exports = {
  name: Events.GuildRoleUpdate,

  async execute(oldRole, newRole, client) {
    try {
      if (newRole.guild.id !== CONFIG.GUILD_ID) return;

      /* ─── تجاهل: لو ما فيه تغيير ─── */
      const nameChanged = oldRole.name !== newRole.name;
      const colorChanged = oldRole.hexColor !== newRole.hexColor;
      const permsChanged = !oldRole.permissions.equals(newRole.permissions);

      if (!nameChanged && !colorChanged && !permsChanged) return;

      let executedBy = null;
      try {
        const auditLogs = await newRole.guild.fetchAuditLogs({ limit: 5 }).catch(() => null);
        if (auditLogs) {
          const entry = auditLogs.entries.find(e =>
            e.action === AuditLogEvent.RoleUpdate
            && e.target?.id === newRole.id
            && (Date.now() - e.createdTimestamp) < 5000
          );
          if (entry) executedBy = entry.executor?.id || null;
        }
      } catch {}

      const changes = [];
      if (nameChanged) changes.push(`📛 الاسم: \`${oldRole.name}\` → \`${newRole.name}\``);
      if (colorChanged) changes.push(`🎨 اللون: \`${oldRole.hexColor}\` → \`${newRole.hexColor}\``);
      if (permsChanged) changes.push(`🔐 الصلاحيات: تم التعديل`);

      await logger.sendLog(client, 'role_updated', {
        description: `تم تعديل رتبة`,
        fields: [
          { name: '🎭 الرتبة', value: `<@&${newRole.id}>`, inline: true },
          { name: '👤 بواسطة', value: executedBy ? `<@${executedBy}>` : 'غير معروف', inline: true },
          { name: '📝 التغييرات', value: changes.join('\n'), inline: false }
        ],
        userId: executedBy
      }).catch(() => {});

    } catch (err) {
      console.error('[RoleUpdate]', err.message);
    }
  }
};