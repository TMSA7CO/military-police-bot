/* ═══════════════════════════════════════════════════════════
 *  الشرطة العسكرية | وزارة الدفاع الأمريكي
 *  حدث تحديث العضو — GuildMemberUpdate.js
 *  الإصدار: 1.0
 *  الوظيفة:
 *    - مزامنة تلقائية عند تغيير الرتب من خارج البوت
 *    - إصدار/إبطال الشهادات تلقائياً
 *    - تحديث Firebase + اللوحة المتزامنة
 *  ═══════════════════════════════════════════════════════════ */

'use strict';

const { Events } = require('discord.js');
const CONFIG = require('../config');
const firebase = require('../firebase');
const logger = require('../utils/logger');
const certificates = require('../utils/certificates');

/* ═══════════════════════════════════════════════════════════
 *                    منع التكرار
 *  ═══════════════════════════════════════════════════════════ */
const processingMembers = new Set();

/* ═══════════════════════════════════════════════════════════
 *                    دوال مساعدة
 *  ═══════════════════════════════════════════════════════════ */

/**
 * جلب الرتب العسكرية الحالية للعضو
 */
function getMilitaryRoles(member) {
  const roles = [];
  for (const roleId of CONFIG.ALL_RANKS) {
    if (member.roles.cache.has(roleId)) {
      roles.push(roleId);
    }
  }
  return roles;
}

/**
 * هل الرتبتان من نفس الفئة؟
 */
function isSameCategory(role1, role2) {
  const leadership = [
    CONFIG.ROLES.COMMANDER,
    CONFIG.ROLES.DEPUTY_COMMANDER,
    CONFIG.ROLES.ASSISTANT_COMMANDER
  ];
  const isLeader1 = leadership.includes(role1);
  const isLeader2 = leadership.includes(role2);
  return isLeader1 === isLeader2;
}

/**
 * تحديد الرتبة الأعلى من القائمة
 */
function getHighestRole(roles) {
  const order = [
    CONFIG.ROLES.COMMANDER,
    CONFIG.ROLES.DEPUTY_COMMANDER,
    CONFIG.ROLES.ASSISTANT_COMMANDER,
    CONFIG.ROLES.MP_OFFICER,
    CONFIG.ROLES.MP_TRAINEE
  ];

  for (const role of order) {
    if (roles.includes(role)) return role;
  }
  return null;
}

/* ═══════════════════════════════════════════════════════════
 *              مزامنة العضو مع Firebase
 *  ═══════════════════════════════════════════════════════════ */

/**
 * إضافة عضو جديد تلقائياً (لو أُعطي رتبة من خارج البوت)
 */
async function autoAddMember(client, member, newRole) {
  try {
    /* ─── جلب الاسم الحالي ─── */
    let name = member.nickname || member.user.username;

    /* ─── إزالة الرقم العسكري من الاسم إن وُجد ─── */
    name = name.replace(/^\[M-\d+\]\s*/, '').trim();

    if (!name || name.length < 3) {
      name = member.user.username;
    }

    /* ─── الرقم العسكري ─── */
    let militaryId = CONFIG.getMilitaryIdForRole(newRole);
    if (!militaryId) {
      militaryId = await firebase.getNextMilitaryId();
    }

    /* ─── الاسم الكامل ─── */
    const fullName = CONFIG.buildFullName(militaryId, name);

    /* ─── حفظ في Firebase ─── */
    await firebase.addMember(member.id, {
      name,
      roleId: newRole
    });

    /* ─── تحديث الـ Nickname ─── */
    await member.setNickname(fullName).catch(() => {});

    /* ─── إصدار شهادة ─── */
    await certificates.issueCertificate(client, {
      discordId: member.id,
      name,
      militaryId,
      roleName: CONFIG.getRoleNameEnglish(newRole),
      roleNameAr: CONFIG.getRoleNameArabic(newRole),
      roleId: newRole,
      issuedBy: 'System (Auto-Detect)',
      supersede: false,
      sendDM: true,
      logToChannel: true
    });

    /* ─── لوق ─── */
    await logger.logMemberAdded(client, {
      discordId: member.id,
      name,
      militaryId,
      roleId: newRole,
      by: 'النظام (اكتشاف تلقائي)'
    }).catch(() => {});

    return { success: true, militaryId };

  } catch (err) {
    console.error('[autoAddMember]', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * تحديث رتبة عضو موجود
 */
async function autoUpdateRole(client, member, oldRole, newRole) {
  try {
    const memberData = await firebase.getMember(member.id);
    if (!memberData) return { success: false, error: 'العضو غير موجود' };

    /* ─── الرقم العسكري الجديد ─── */
    let newMilitaryId = CONFIG.getMilitaryIdForRole(newRole);
    if (!newMilitaryId) {
      /* ─── لو الرتبة الجديدة عادية والعضو كان قيادي → رقم جديد ─── */
      if (CONFIG.isLeadershipRole(oldRole) && !CONFIG.isLeadershipRole(newRole)) {
        newMilitaryId = await firebase.getNextMilitaryId();
      } else {
        newMilitaryId = memberData.militaryId;
      }
    }

    /* ─── تحديث Firebase ─── */
    await firebase.updateMember(member.id, {
      roleId: newRole,
      militaryId: newMilitaryId
    });

    /* ─── الاسم الكامل ─── */
    const nameBase = memberData.nameOriginal || memberData.name;
    const fullName = CONFIG.buildFullName(newMilitaryId, nameBase);

    await firebase.updateMember(member.id, { nickname: fullName });
    await member.setNickname(fullName).catch(() => {});

    /* ─── إعادة إصدار الشهادة ─── */
    const isPromotion = isHigherRole(newRole, oldRole);
    await certificates.reissueCertificateOnUpdate(
      client,
      member.id,
      { militaryId: newMilitaryId, roleId: newRole },
      isPromotion ? 'promotion' : 'demotion',
      'System (Auto-Detect)'
    );

    /* ─── لوق ─── */
    if (isPromotion) {
      await logger.sendLog(client, 'member_promoted', {
        description: `تم ترقية العضو تلقائياً`,
        fields: [
          { name: '👤 العضو', value: `<@${member.id}>`, inline: true },
          { name: '⬆️ من', value: CONFIG.getRoleNameEnglish(oldRole), inline: true },
          { name: '⬇️ إلى', value: CONFIG.getRoleNameEnglish(newRole), inline: true },
          { name: '🆔 الرقم الجديد', value: `\`${newMilitaryId}\``, inline: true }
        ],
        userId: member.id,
        userName: nameBase
      }).catch(() => {});
    } else {
      await logger.sendLog(client, 'member_demoted', {
        description: `تم تخفيض رتبة العضو تلقائياً`,
        fields: [
          { name: '👤 العضو', value: `<@${member.id}>`, inline: true },
          { name: '⬇️ من', value: CONFIG.getRoleNameEnglish(oldRole), inline: true },
          { name: '⬇️ إلى', value: CONFIG.getRoleNameEnglish(newRole), inline: true },
          { name: '🆔 الرقم الجديد', value: `\`${newMilitaryId}\``, inline: true }
        ],
        userId: member.id,
        userName: nameBase
      }).catch(() => {});
    }

    return { success: true, newMilitaryId };

  } catch (err) {
    console.error('[autoUpdateRole]', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * هل الرتبة الأولى أعلى من الثانية؟
 */
function isHigherRole(role1, role2) {
  const order = [
    CONFIG.ROLES.MP_TRAINEE,
    CONFIG.ROLES.MP_OFFICER,
    CONFIG.ROLES.ASSISTANT_COMMANDER,
    CONFIG.ROLES.DEPUTY_COMMANDER,
    CONFIG.ROLES.COMMANDER
  ];
  const index1 = order.indexOf(role1);
  const index2 = order.indexOf(role2);
  if (index1 === -1 || index2 === -1) return false;
  return index1 > index2;
}

/**
 * معالجة إزالة الرتبة (ترميج من خارج البوت)
 */
async function autoRemoveMember(client, member, removedRole) {
  try {
    const memberData = await firebase.getMember(member.id);
    if (!memberData) return { success: false, error: 'العضو غير موجود في Firebase' };

    /* ─── 1. إبطال كل الشهادات ─── */
    const certResult = await firebase.invalidateAllCertificates(member.id, 'termination');

    if (certResult.invalidatedCount > 0) {
      await certificates.logCertificateInvalidation(client, {
        discordId: member.id,
        name: memberData.name,
        militaryId: memberData.militaryId,
        certificatesCount: certResult.invalidatedCount,
        reason: 'termination',
        by: 'النظام (اكتشاف تلقائي)'
      }).catch(() => {});
    }

    /* ─── 2. حذف العضو + إعادة الترتيب ─── */
    const removeResult = await firebase.removeMember(member.id);

    /* ─── 3. إرجاع الاسم الأصلي ─── */
    await member.setNickname(null).catch(() => {});

    /* ─── 4. لوق ─── */
    await logger.logMemberRemoved(client, {
      discordId: member.id,
      name: memberData.name,
      militaryId: memberData.militaryId,
      points: memberData.points || 0,
      reason: 'إزالة رتبة خارجياً',
      by: 'النظام (اكتشاف تلقائي)',
      reordered: removeResult.changes.length
    }).catch(() => {});

    /* ─── 5. لكل عضو تغيّر رقمه → شهادة جديدة ─── */
    for (const change of removeResult.changes) {
      try {
        await certificates.reissueCertificateOnReorder(
          client,
          change.memberData,
          change.newId
        );

        /* تحديث Discord */
        const guild = member.guild;
        const changedMember = await guild.members.fetch(change.discordId).catch(() => null);
        if (changedMember && change.newNickname) {
          await changedMember.setNickname(change.newNickname).catch(() => {});
        }
      } catch (err) {
        console.error(`[autoRemoveMember] فشل تحديث ${change.discordId}:`, err.message);
      }
    }

    /* ─── 6. DM ─── */
    try {
      await member.send({
        embeds: [{
          color: CONFIG.COLORS.DANGER,
          title: '❌ تم إزالة رتبتك',
          description: `تم إزالة رتبتك العسكرية من قبل الإدارة.\n\n⚠️ **ملاحظة:** الشهادات المرتبطة بك تم إبطالها.`,
          footer: {
            text: CONFIG.TEXT.FOOTER
          },
          timestamp: new Date().toISOString()
        }]
      }).catch(() => {});
    } catch {}

    return { success: true, reordered: removeResult.changes.length };

  } catch (err) {
    console.error('[autoRemoveMember]', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * تحديث اللوحة المتزامنة
 */
async function refreshSynchronizedPanel(client) {
  try {
    const loc = await firebase.getPanelLocation('synchronized');
    if (!loc) return;

    const channel = await client.channels.fetch(loc.channelId).catch(() => null);
    if (!channel) return;

    const message = await channel.messages.fetch(loc.messageId).catch(() => null);
    if (!message) return;

    const members = await firebase.getAllMembers();

    /* ─── استيراد embeds ديناميكياً لتجنب circular dependency ─── */
    const embeds = require('../utils/embeds');
    const payload = embeds.synchronizedPanel(client, members);

    await message.edit(payload);
    return true;
  } catch (err) {
    console.error('[refreshSynchronizedPanel]', err.message);
    return false;
  }
}

/* ═══════════════════════════════════════════════════════════
 *              معالج الحدث الرئيسي
 *  ═══════════════════════════════════════════════════════════ */

module.exports = {
  name: Events.GuildMemberUpdate,

  async execute(oldMember, newMember, client) {
    try {
      /* ─── تجاهل البوتات ─── */
      if (newMember.user.bot) return;

      /* ─── تجاهل السيرفرات الأخرى ─── */
      if (newMember.guild.id !== CONFIG.GUILD_ID) return;

      /* ─── منع التكرار ─── */
      if (processingMembers.has(newMember.id)) {
        console.log(`[GuildMemberUpdate] تخطي ${newMember.user.tag} — قيد المعالجة`);
        return;
      }

      /* ─── الرتب القديمة والجديدة ─── */
      const oldRoles = getMilitaryRoles(oldMember);
      const newRoles = getMilitaryRoles(newMember);

      /* ─── هل تغيّرت الرتب العسكرية؟ ─── */
      const added = newRoles.filter(r => !oldRoles.includes(r));
      const removed = oldRoles.filter(r => !newRoles.includes(r));

      if (added.length === 0 && removed.length === 0) return;

      /* ─── قفل العضو أثناء المعالجة ─── */
      processingMembers.add(newMember.id);

      try {
        const oldRole = getHighestRole(oldRoles);
        const newRole = getHighestRole(newRoles);

        console.log(`\n[GuildMemberUpdate] 👤 ${newMember.user.tag}`);
        console.log(`   📌 القديم: ${oldRole || 'لا يوجد'}`);
        console.log(`   📌 الجديد: ${newRole || 'لا يوجد'}`);
        console.log(`   ➕ مضافة: ${added.length}`);
        console.log(`   ➖ مزالة: ${removed.length}`);

        /* ═══════════════════════════════════════════════
         *  الحالة 1: عضو جديد (لم تكن له رتبة عسكرية)
         *  ═══════════════════════════════════════════════ */
        if (!oldRole && newRole) {
          console.log(`   ✅ إضافة تلقائية`);
          await autoAddMember(client, newMember, newRole);
        }

        /* ═══════════════════════════════════════════════
         *  الحالة 2: إزالة كاملة (كانت له رتبة والآن لا)
         *  ═══════════════════════════════════════════════ */
        else if (oldRole && !newRole) {
          console.log(`   🗑️ ترميج تلقائي`);
          await autoRemoveMember(client, newMember, oldRole);
        }

        /* ═══════════════════════════════════════════════
         *  الحالة 3: تغيير الرتبة (ترقية أو تخفيض)
         *  ═══════════════════════════════════════════════ */
        else if (oldRole && newRole && oldRole !== newRole) {
          console.log(`   🔄 تحديث تلقائي`);
          await autoUpdateRole(client, newMember, oldRole, newRole);
        }

        /* ─── تحديث اللوحة المتزامنة ─── */
        await refreshSynchronizedPanel(client);

      } finally {
        /* ─── فك القفل ─── */
        setTimeout(() => {
          processingMembers.delete(newMember.id);
        }, 3000);
      }

    } catch (err) {
      console.error('[GuildMemberUpdate] خطأ:', err.message);
      processingMembers.delete(newMember.id);
    }
  },

  /* ─── تصدير الدوال ─── */
  autoAddMember,
  autoUpdateRole,
  autoRemoveMember,
  getMilitaryRoles,
  getHighestRole
};