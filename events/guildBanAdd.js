/* ═══════════════════════════════════════════════════════════
 *  الشرطة العسكرية | وزارة الدفاع الأمريكي
 *  حدث البان — GuildBanAdd.js
 *  الإصدار: 1.0
 *  الوظيفة: معالجة البان (احتياطي لـ guildMemberRemove)
 *  ═══════════════════════════════════════════════════════════ */

'use strict';

const { Events, AuditLogEvent, EmbedBuilder } = require('discord.js');
const CONFIG = require('../config');
const firebase = require('../firebase');
const logger = require('../utils/logger');
const certificates = require('../utils/certificates');
const memberActions = require('../utils/memberActions');

module.exports = {
  name: Events.GuildBanAdd,

  async execute(ban, client) {
    try {
      const member = ban.user;
      if (member.bot) return;
      if (ban.guild.id !== CONFIG.GUILD_ID) return;

      console.log(`\n[GuildBanAdd] 🚫 بان: ${member.tag || member.username}`);

      /* ─── تجنب التكرار مع guildMemberRemove ─── */
      /* نتحقق: هل guildMemberRemove اشتغل قبلنا؟ */
      /* الحل: نتحقق من Firebase — لو العضو اختفى، معناه guildMemberRemove سبقنا */
      
      const memberData = await firebase.getMember(member.id);
      if (!memberData) {
        console.log(`   ℹ️ العضو غير مسجل — تم تجاهله (أو مُعالج سابقاً)`);
        return;
      }

      /* ─── من نفّذ البان؟ ─── */
      let executedBy = null;
      let reasonText = 'بدون سبب مذكور';

      try {
        const auditLogs = await ban.guild.fetchAuditLogs({ limit: 10 }).catch(() => null);
        if (auditLogs) {
          const banEntry = auditLogs.entries.find(e =>
            e.action === AuditLogEvent.MemberBanAdd
            && e.target?.id === member.id
            && (Date.now() - e.createdTimestamp) < 5000
          );

          if (banEntry) {
            executedBy = banEntry.executor?.id || null;
            reasonText = banEntry.reason || 'بدون سبب مذكور';
          }
        }
      } catch {}

      /* ═══════════════════════════════════════════════
       *  تنظيف شامل (لو guildMemberRemove ما اشتغل)
       *  ═══════════════════════════════════════════════ */
      const name = memberData.nameOriginal || memberData.name || 'Unknown';
      const militaryId = memberData.militaryId || 'M-XX';

      console.log(`   🧹 بدء التنظيف التلقائي (بان)`);

      /* ─── حذف الشهادات (لوق + DM) ─── */
      const allCerts = await firebase.getMemberCertificates(member.id);
      const deleteResult = await memberActions.deleteAllCertificateMessages(
        client,
        member.id,
        allCerts
      );

      /* ─── إبطال الشهادات ─── */
      const certResult = await firebase.invalidateAllCertificates(member.id, 'ban');
      console.log(`   ❌ إبطال ${certResult.invalidatedCount} شهادة`);

      /* ─── حذف من Firebase + إعادة ترقيم ─── */
      const removeResult = await firebase.removeMember(member.id);
      const reorderedCount = removeResult.changes?.length || 0;
      console.log(`   🔄 إعادة ترقيم ${reorderedCount} عضو`);

      /* ─── شهادات جديدة للأعضاء المُعاد ترقيمهم ─── */
      for (const change of (removeResult.changes || [])) {
        try {
          await certificates.reissueCertificateOnReorder(
            client,
            change.memberData,
            change.newId
          );

          const changedMember = await ban.guild.members.fetch(change.discordId).catch(() => null);
          if (changedMember && change.newNickname) {
            await changedMember.setNickname(change.newNickname, 'إعادة ترقيم').catch(() => {});
          }
        } catch (err) {
          console.error(`   ⚠️ فشل تحديث ${change.discordId}:`, err.message);
        }
      }

      /* ─── DM ─── */
      try {
        const dmEmbed = new EmbedBuilder()
          .setColor(0x000000)
          .setAuthor({
            name: 'وزارة الدفاع الأمريكي',
            iconURL: client.user.displayAvatarURL()
          })
          .setTitle('🚫 تم حظرك من السيرفر')
          .setDescription(
            `مرحباً **${name}**\n\n` +
            `تم **حظرك** من السيرفر وتم إزالتك تلقائياً من\n` +
            `**الشرطة العسكرية — وزارة الدفاع الأمريكي**\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `⚠️ **جميع بياناتك وشهاداتك تم حذفها**`
          )
          .addFields(
            { name: '📛 الاسم', value: name, inline: true },
            { name: '🆔 الرقم', value: `\`${militaryId}\``, inline: true },
            { name: '📝 السبب', value: reasonText, inline: false },
            { name: '👤 بواسطة', value: executedBy ? `<@${executedBy}>` : 'الإدارة', inline: true }
          )
          .setFooter({
            text: 'Military Police — Ministry of Defense',
            iconURL: client.user.displayAvatarURL()
          })
          .setTimestamp();

        await member.send({ embeds: [dmEmbed] }).catch((err) => {
          console.warn(`   ⚠️ فشل DM: ${err.message}`);
        });
      } catch (dmErr) {
        console.warn(`   ⚠️ فشل DM:`, dmErr.message);
      }

      /* ─── لوق الإبطال (مع صورة حمراء) ─── */
      if (certResult.invalidatedCount > 0) {
        /* ✨ حذف رسائل الإبطال القديمة أولاً */
        await memberActions.deleteInvalidationMessageFromLog(client, member.id, militaryId).catch(() => {});
        await memberActions.deleteInvalidationMessageFromDM(client, member.id).catch(() => {});

        await certificates.logCertificateInvalidation(client, {
          discordId: member.id,
          name,
          militaryId,
          certificatesCount: certResult.invalidatedCount,
          reason: 'ban',
          by: executedBy || 'النظام'
        }).catch(() => {});
      }

      /* ─── لوق الترميج الرئيسي ─── */
      await logger.logMemberRemoved(client, {
        discordId: member.id,
        name,
        militaryId,
        points: memberData.points || 0,
        reason: `🚫 بان — ${reasonText}`,
        by: executedBy || 'النظام',
        reordered: reorderedCount
      }).catch(() => {});

      /* ─── لوق عام ─── */
      await logger.sendLog(client, 'member_left', {
        description: `عضو في السلك تم حظره`,
        fields: [
          { name: '👤 العضو', value: member.tag || member.username, inline: true },
          { name: '🆔 الرقم', value: `\`${militaryId}\``, inline: true },
          { name: '📝 السبب', value: reasonText, inline: false },
          { name: '🎖️ شهادات مُبطلة', value: `${certResult.invalidatedCount}`, inline: true },
          { name: '🔄 إعادة ترقيم', value: `${reorderedCount}`, inline: true }
        ],
        userId: member.id,
        userName: member.tag || member.username,
        thumbnailUrl: member.displayAvatarURL()
      }).catch(() => {});

      /* ─── تحديث اللوحة ─── */
      await memberActions.refreshSynchronizedPanel(client);

      console.log(`   ✅ اكتمل التنظيف التلقائي (بان)`);

    } catch (err) {
      console.error('[GuildBanAdd] خطأ:', err);
    }
  }
};