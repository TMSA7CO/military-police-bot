/* ═══════════════════════════════════════════════════════════
 *  الشرطة العسكرية | وزارة الدفاع الأمريكي
 *  حدث مغادرة عضو — GuildMemberRemove.js
 *  الإصدار: 2.0
 *  الوظيفة:
 *    - تسجيل المغادرة في اللوق
 *    - لو كان عنده رتب عسكرية → تنظيف تلقائي شامل
 *    - إبطال الشهادات
 *    - حذف الرسائل (لوق + DM)
 *    - حذف من Firebase
 *    - إعادة ترقيم
 *    - إرسال DM توضيحي (غادر / انطرد / اتبند)
 *  ═══════════════════════════════════════════════════════════ */

'use strict';

const { Events, AuditLogEvent, EmbedBuilder } = require('discord.js');
const CONFIG = require('../config');
const firebase = require('../firebase');
const logger = require('../utils/logger');
const certificates = require('../utils/certificates');
const memberActions = require('../utils/memberActions');

module.exports = {
  name: Events.GuildMemberRemove,

  async execute(member, client) {
    try {
      if (member.user.bot) return;
      if (member.guild.id !== CONFIG.GUILD_ID) return;

      console.log(`\n[GuildMemberRemove] 👋 غادر: ${member.user.tag}`);

      /* ═══════════════════════════════════════════════
       *  1. تحديد سبب المغادرة (Audit Log)
       *  ═══════════════════════════════════════════════ */
      let reason = 'leave';       // 'leave' | 'kick' | 'ban'
      let executedBy = null;      // من نفّذ الطرد/البان
      let reasonText = 'غادر السيرفر بنفسه';

      try {
        /* ─── فحص Audit Log ─── */
        const auditLogs = await member.guild.fetchAuditLogs({ limit: 10 }).catch(() => null);

        if (auditLogs) {
          /* ─── الحالة 1: بان ─── */
          const banEntry = auditLogs.entries.find(e =>
            e.action === AuditLogEvent.MemberBanAdd
            && e.target?.id === member.id
            && (Date.now() - e.createdTimestamp) < 5000
          );

          if (banEntry) {
            reason = 'ban';
            executedBy = banEntry.executor?.id || null;
            reasonText = banEntry.reason || 'بدون سبب مذكور';
          } else {
            /* ─── الحالة 2: طرد ─── */
            const kickEntry = auditLogs.entries.find(e =>
              e.action === AuditLogEvent.MemberKick
              && e.target?.id === member.id
              && (Date.now() - e.createdTimestamp) < 5000
            );

            if (kickEntry) {
              reason = 'kick';
              executedBy = kickEntry.executor?.id || null;
              reasonText = kickEntry.reason || 'بدون سبب مذكور';
            }
          }
        }
      } catch (auditErr) {
        console.warn(`[GuildMemberRemove] فشل قراءة Audit Log:`, auditErr.message);
      }

      console.log(`   📌 السبب: ${reason}${executedBy ? ` (بواسطة ${executedBy})` : ''}`);

      /* ═══════════════════════════════════════════════
       *  2. هل العضو لديه رتب عسكرية؟
       *  ═══════════════════════════════════════════════ */
      const memberData = await firebase.getMember(member.id);

      if (!memberData) {
        /* ─── عضو عادي (بدون رتب عسكرية) ─── */
        console.log(`   ℹ️ عضو عادي — لوق + DM فقط`);

        const joinedAt = member.joinedTimestamp
          ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`
          : 'غير معروف';

        /* ─── 1. لوق ─── */
        await logger.sendLog(client, 'member_left', {
          description: `عضو غادر السيرفر`,
          fields: [
            { name: '👤 العضو', value: member.user.tag, inline: true },
            { name: '🆔 الآيدي', value: `\`${member.id}\``, inline: true },
            { name: '📅 انضم', value: joinedAt, inline: true },
            { name: '📌 السبب', value: reasonText, inline: false }
          ],
          userId: member.id,
          userName: member.user.tag,
          thumbnailUrl: member.user.displayAvatarURL()
        }).catch(() => {});

        /* ─── 2. DM توضيحي ─── */
        try {
          const dmEmbed = buildNormalMemberDM(client, reason, member, reasonText, executedBy);
          const user = await client.users.fetch(member.id).catch(() => null);

          if (user) {
            await user.send({ embeds: [dmEmbed] }).catch((err) => {
              console.warn(`   ⚠️ فشل DM: ${err.message}`);
            });
            console.log(`   ✅ تم إرسال DM (عضو عادي)`);
          }
        } catch (dmErr) {
          console.warn(`   ⚠️ فشل DM:`, dmErr.message);
        }

        return;
      }

      /* ═══════════════════════════════════════════════
       *  3. تنظيف شامل — العضو كان في السلك
       *  ═══════════════════════════════════════════════ */
      console.log(`   🧹 بدء التنظيف التلقائي`);

      const name = memberData.nameOriginal || memberData.name || 'Unknown';
      const militaryId = memberData.militaryId || 'M-XX';

      /* ─── 3.1 جلب كل الشهادات ─── */
      const allCerts = await firebase.getMemberCertificates(member.id);

      /* ─── 3.2 حذف رسائل الشهادات (لوق + DM) ─── */
      const deleteResult = await memberActions.deleteAllCertificateMessages(
        client,
        member.id,
        allCerts
      );

      console.log(`   🗑️ حُذفت ${deleteResult.fromLog} من اللوق، ${deleteResult.fromDM} من DM`);

      /* ─── 3.3 إبطال كل الشهادات في Firebase ─── */
      const certResult = await firebase.invalidateAllCertificates(member.id, reason);
      console.log(`   ❌ تم إبطال ${certResult.invalidatedCount} شهادة`);

      /* ─── 3.4 حذف العضو من Firebase + إعادة ترقيم ─── */
      const removeResult = await firebase.removeMember(member.id);
      const reorderedCount = removeResult.changes?.length || 0;
      console.log(`   🔄 إعادة ترقيم ${reorderedCount} عضو`);

      /* ─── 3.5 شهادات جديدة للأعضاء المُعاد ترقيمهم ─── */
      for (const change of (removeResult.changes || [])) {
        try {
          await certificates.reissueCertificateOnReorder(
            client,
            change.memberData,
            change.newId
          );

          const changedMember = await member.guild.members.fetch(change.discordId).catch(() => null);
          if (changedMember && change.newNickname) {
            await changedMember.setNickname(change.newNickname, 'إعادة ترقيم').catch(() => {});
          }
        } catch (err) {
          console.error(`   ⚠️ فشل تحديث ${change.discordId}:`, err.message);
        }
      }

      /* ═══════════════════════════════════════════════
       *  4. رسالة DM توضيحية للعضو (لو ممكن)
       *  ═══════════════════════════════════════════════ */
      try {
        const dmEmbed = buildDMMessage(client, reason, name, militaryId, reasonText, executedBy);

        /* ─── محاولة الإرسال (قد تفشل عند البان) ─── */
        const user = await client.users.fetch(member.id).catch(() => null);
        if (user) {
          await user.send({ embeds: [dmEmbed] }).catch((err) => {
            console.warn(`   ⚠️ فشل DM: ${err.message}`);
          });
        }
      } catch (dmErr) {
        console.warn(`   ⚠️ فشل DM:`, dmErr.message);
      }

      /* ═══════════════════════════════════════════════
       *  5. لوق الإبطال (مع الصورة الحمراء)
       *  ═══════════════════════════════════════════════ */
      if (certResult.invalidatedCount > 0) {
        /* ✨ حذف رسائل الإبطال القديمة بالتوازي */
        await Promise.all([
          memberActions.deleteInvalidationMessageFromLog(client, member.id, militaryId).catch(() => {}),
          memberActions.deleteInvalidationMessageFromDM(client, member.id).catch(() => {})
        ]);

        await certificates.logCertificateInvalidation(client, {
          discordId: member.id,
          name,
          militaryId,
          certificatesCount: certResult.invalidatedCount,
          reason,
          by: executedBy || 'النظام'
        }).catch(() => {});
      }

      /* ═══════════════════════════════════════════════
       *  6. لوق الترميج الرئيسي
       *  ═══════════════════════════════════════════════ */
      const reasonLabel =
        reason === 'ban' ? '🚫 بان' :
        reason === 'kick' ? '👞 طرد' :
        '🚪 مغادرة';

      await logger.logMemberRemoved(client, {
        discordId: member.id,
        name,
        militaryId,
        points: memberData.points || 0,
        reason: `${reasonLabel} — ${reasonText}`,
        by: executedBy || 'النظام',
        reordered: reorderedCount
      }).catch(() => {});

      /* ═══════════════════════════════════════════════
       *  7. لوق المغادرة العام
       *  ═══════════════════════════════════════════════ */
      await logger.sendLog(client, 'member_left', {
        description: `عضو في السلك ${reasonLabel}`,
        fields: [
          { name: '👤 العضو', value: member.user.tag, inline: true },
          { name: '🆔 الرقم', value: `\`${militaryId}\``, inline: true },
          { name: '📌 السبب', value: reasonText, inline: false },
          { name: '🎖️ شهادات مُبطلة', value: `${certResult.invalidatedCount}`, inline: true },
          { name: '🔄 إعادة ترقيم', value: `${reorderedCount}`, inline: true }
        ],
        userId: member.id,
        userName: member.user.tag,
        thumbnailUrl: member.user.displayAvatarURL()
      }).catch(() => {});

      /* ═══════════════════════════════════════════════
       *  8. تحديث اللوحة المتزامنة
       *  ═══════════════════════════════════════════════ */
      await memberActions.refreshSynchronizedPanel(client);

      console.log(`   ✅ اكتمل التنظيف التلقائي`);

    } catch (err) {
      console.error('[GuildMemberRemove] خطأ:', err);
    }
  }
};
/* ═══════════════════════════════════════════════════════════
 *              DM لعضو عادي (بدون رتب عسكرية)
 *  ═══════════════════════════════════════════════════════════ */

function buildNormalMemberDM(client, reason, member, reasonText, executedBy) {
  const baseFields = [
    { name: '📛 الاسم', value: member.user.username || 'Unknown', inline: true },
    { name: '🆔 الآيدي', value: `\`${member.id}\``, inline: true }
  ];

  /* ─── بان ─── */
  if (reason === 'ban') {
    return new EmbedBuilder()
      .setColor(0x000000)
      .setAuthor({
        name: 'وزارة الدفاع الأمريكي',
        iconURL: client.user.displayAvatarURL()
      })
      .setTitle('🚫 تم حظرك من السيرفر')
      .setDescription(
        `مرحباً **${member.user.username}**\n\n` +
        `تم **حظرك** من السيرفر.\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━`
      )
      .addFields(
        ...baseFields,
        { name: '📝 السبب', value: reasonText, inline: false },
        { name: '👤 بواسطة', value: executedBy ? `<@${executedBy}>` : 'الإدارة', inline: true }
      )
      .setFooter({
        text: 'Military Police — Ministry of Defense',
        iconURL: client.user.displayAvatarURL()
      })
      .setTimestamp();
  }

  /* ─── طرد ─── */
  if (reason === 'kick') {
    return new EmbedBuilder()
      .setColor(CONFIG.COLORS.DANGER)
      .setAuthor({
        name: 'وزارة الدفاع الأمريكي',
        iconURL: client.user.displayAvatarURL()
      })
      .setTitle('👞 تم طردك من السيرفر')
      .setDescription(
        `مرحباً **${member.user.username}**\n\n` +
        `تم **طردك** من السيرفر.\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━`
      )
      .addFields(
        ...baseFields,
        { name: '📝 السبب', value: reasonText, inline: false },
        { name: '👤 بواسطة', value: executedBy ? `<@${executedBy}>` : 'الإدارة', inline: true }
      )
      .setFooter({
        text: 'Military Police — Ministry of Defense',
        iconURL: client.user.displayAvatarURL()
      })
      .setTimestamp();
  }

  /* ─── مغادرة شخصية ─── */
  return new EmbedBuilder()
    .setColor(CONFIG.COLORS.WARNING)
    .setAuthor({
      name: 'وزارة الدفاع الأمريكي',
      iconURL: client.user.displayAvatarURL()
    })
    .setTitle('🚪 غادرت السيرفر')
    .setDescription(
      `مرحباً **${member.user.username}**\n\n` +
      `نشكرك على وقتك في السيرفر.\n` +
      `نتمنى لك التوفيق في مكان آخر. 🌟\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `💡 **للانضمام مجدداً:**\n` +
      `> ${CONFIG.TEXT.INVITE}`
    )
    .addFields(
      ...baseFields,
      { name: '📅 الحالة', value: 'مغادرة شخصية', inline: true }
    )
    .setFooter({
      text: 'Military Police — Ministry of Defense',
      iconURL: client.user.displayAvatarURL()
    })
    .setTimestamp();
}

/* ═══════════════════════════════════════════════════════════
 *              بناء رسالة DM حسب الحالة
 *  ═══════════════════════════════════════════════════════════ */

function buildDMMessage(client, reason, name, militaryId, reasonText, executedBy) {
  const baseFields = [
    { name: '📛 الاسم', value: name, inline: true },
    { name: '🆔 الرقم العسكري', value: `\`${militaryId}\``, inline: true }
  ];

  if (reason === 'ban') {
    return new EmbedBuilder()
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
        ...baseFields,
        { name: '📝 السبب', value: reasonText, inline: false },
        { name: '👤 بواسطة', value: executedBy ? `<@${executedBy}>` : 'الإدارة', inline: true }
      )
      .setFooter({
        text: 'Military Police — Ministry of Defense',
        iconURL: client.user.displayAvatarURL()
      })
      .setTimestamp();
  }

  if (reason === 'kick') {
    return new EmbedBuilder()
      .setColor(CONFIG.COLORS.DANGER)
      .setAuthor({
        name: 'وزارة الدفاع الأمريكي',
        iconURL: client.user.displayAvatarURL()
      })
      .setTitle('👞 تم طردك من السيرفر')
      .setDescription(
        `مرحباً **${name}**\n\n` +
        `تم **طردك** من السيرفر وتم إزالتك تلقائياً من\n` +
        `**الشرطة العسكرية — وزارة الدفاع الأمريكي**\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `⚠️ **جميع بياناتك وشهاداتك تم حذفها**`
      )
      .addFields(
        ...baseFields,
        { name: '📝 السبب', value: reasonText, inline: false },
        { name: '👤 بواسطة', value: executedBy ? `<@${executedBy}>` : 'الإدارة', inline: true }
      )
      .setFooter({
        text: 'Military Police — Ministry of Defense',
        iconURL: client.user.displayAvatarURL()
      })
      .setTimestamp();
  }

  /* ─── الحالة الافتراضية: غادر بنفسه ─── */
  return new EmbedBuilder()
    .setColor(CONFIG.COLORS.WARNING)
    .setAuthor({
      name: 'وزارة الدفاع الأمريكي',
      iconURL: client.user.displayAvatarURL()
    })
    .setTitle('🚪 غادرت السيرفر')
    .setDescription(
      `مرحباً **${name}**\n\n` +
      `لقد **غادرت** السيرفر، وتم إزالتك تلقائياً من\n` +
      `**الشرطة العسكرية — وزارة الدفاع الأمريكي**\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `⚠️ **جميع بياناتك وشهاداتك تم حذفها**\n\n` +
      `💡 **للانضمام مجدداً:** تقدّم من جديد عند فتح التوظيف`
    )
    .addFields(
      ...baseFields,
      { name: '📅 الحالة', value: 'مغادرة شخصية', inline: true }
    )
    .setFooter({
      text: 'Military Police — Ministry of Defense',
      iconURL: client.user.displayAvatarURL()
    })
    .setTimestamp();
}