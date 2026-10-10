/* ═══════════════════════════════════════════════════════════
 *  الشرطة العسكرية | وزارة الدفاع الأمريكي
 *  حدث تحديث العضو — GuildMemberUpdate.js
 *  الإصدار: 2.0 (إصلاحات شاملة)
 *  ═══════════════════════════════════════════════════════════ */

'use strict';

const { Events } = require('discord.js');
const CONFIG = require('../config');
const firebase = require('../firebase');
const logger = require('../utils/logger');
const certificates = require('../utils/certificates');

const processingMembers = new Set();

/* ═══════════════════════════════════════════════════════════
 *                    دوال مساعدة
 *  ═══════════════════════════════════════════════════════════ */

function getMilitaryRoles(member) {
  const roles = [];
  for (const roleId of CONFIG.ALL_RANKS) {
    if (member.roles.cache.has(roleId)) roles.push(roleId);
  }
  return roles;
}

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

function isHigherRole(role1, role2) {
  const order = [
    CONFIG.ROLES.MP_TRAINEE,
    CONFIG.ROLES.MP_OFFICER,
    CONFIG.ROLES.ASSISTANT_COMMANDER,
    CONFIG.ROLES.DEPUTY_COMMANDER,
    CONFIG.ROLES.COMMANDER
  ];
  const i1 = order.indexOf(role1);
  const i2 = order.indexOf(role2);
  if (i1 === -1 || i2 === -1) return false;
  return i1 > i2;
}

/**
 * ✅ استخراج الاسم من displayName (وليس username)
 * displayName = الاسم الذي يظهر في الشات (nickname أو globalName)
 */
function extractDisplayName(member) {
  // الأولوية:
  // 1. nickname (الاسم في السيرفر)
  // 2. displayName (globalName من إعدادات المستخدم)
  // 3. username (الحساب - آخر حل)
  let name = member.nickname || member.displayName || member.user.globalName || member.user.username;
  // إزالة البادئة [M-XX]
  name = name.replace(/^\[M-\d+\]\s*/, '').trim();
  if (!name || name.length < 2) {
    name = member.user.username;
  }
  return name;
}

/* ═══════════════════════════════════════════════════════════
 *              إضافة عضو جديد (من خارج البوت)
 *  ═══════════════════════════════════════════════════════════ */

async function autoAddMember(client, member, newRole) {
  try {
    // ✅ لو موجود مسبقاً، نحدّث بس
    const existing = await firebase.getMember(member.id);

    if (existing) {
      console.log(`[autoAddMember] العضو موجود — تحديث`);

      // تحديث الرتبة فقط (بدون مسح البيانات)
      if (existing.roleId !== newRole) {
        await firebase.updateMember(member.id, { roleId: newRole });
      }

      // تأكد من وجود شهادة نشطة
      const certs = await firebase.getActiveCertificates(member.id);
      if (certs.length === 0) {
        const certResult = await certificates.issueCertificate(client, {
          discordId: member.id,
          name: existing.nameOriginal || existing.name,
          militaryId: existing.militaryId,
          roleName: CONFIG.getRoleNameEnglish(newRole),
          roleNameAr: CONFIG.getRoleNameArabic(newRole),
          roleId: newRole,
          issuedBy: 'System (Auto-Detect)',
          supersede: false,
          sendDM: true,
          logToChannel: true
        });
        console.log(`[autoAddMember] شهادة صادرة: ${certResult.success ? 'OK' : 'FAIL'}`);
      }

      return { success: true, militaryId: existing.militaryId, wasExisting: true };
    }

    // ✅ عضو جديد
    const name = extractDisplayName(member);
    console.log(`[autoAddMember] اسم مستخرج: ${name}`);

    let militaryId = CONFIG.getMilitaryIdForRole(newRole);
    if (!militaryId) {
      militaryId = await firebase.getNextMilitaryId();
    }

    const fullName = CONFIG.buildFullName(militaryId, name);

    await firebase.addMember(member.id, {
      name,
      roleId: newRole
    });

    // محاولة تغيير الاسم (لو فشل، نكمل)
    try {
      await member.setNickname(fullName, 'تعيين رتبة جديدة');
      console.log(`[autoAddMember] ✅ تم تغيير الاسم`);
    } catch (nickErr) {
      console.error(`[autoAddMember] ❌ فشل تغيير الاسم:`, nickErr.message, `(code: ${nickErr.code})`);
      console.error(`   سبب متوقع: رتبة البوت أدنى من رتبة العضو، أو صلاحيات ناقصة`);
    }

    // ✅ إصدار شهادة
    const certResult = await certificates.issueCertificate(client, {
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

    console.log(`[autoAddMember] شهادة: ${certResult.success ? 'OK' : 'FAIL'} | DM: ${certResult.dmSent ? 'OK' : 'FAIL'}`);

    await logger.logMemberAdded(client, {
      discordId: member.id,
      name,
      militaryId,
      roleId: newRole,
      by: 'النظام (اكتشاف تلقائي)'
    }).catch(() => {});

    return { success: true, militaryId };

  } catch (err) {
    console.error('[autoAddMember]', err);
    return { success: false, error: err.message };
  }
}

/* ═══════════════════════════════════════════════════════════
 *              تحديث رتبة عضو موجود
 *  ═══════════════════════════════════════════════════════════ */

async function autoUpdateRole(client, member, oldRole, newRole) {
  try {
    const memberData = await firebase.getMember(member.id);
    if (!memberData) {
      return autoAddMember(client, member, newRole);
    }

    let newMilitaryId = CONFIG.getMilitaryIdForRole(newRole);
    if (!newMilitaryId) {
      if (CONFIG.isLeadershipRole(oldRole) && !CONFIG.isLeadershipRole(newRole)) {
        newMilitaryId = await firebase.getNextMilitaryId();
      } else {
        newMilitaryId = memberData.militaryId;
      }
    }

    await firebase.updateMember(member.id, {
      roleId: newRole,
      militaryId: newMilitaryId
    });

    const nameBase = memberData.nameOriginal || memberData.name || extractDisplayName(member);
    const fullName = CONFIG.buildFullName(newMilitaryId, nameBase);

    await firebase.updateMember(member.id, { nickname: fullName });

    try {
      await member.setNickname(fullName, 'تحديث الرتبة');
    } catch (err) {
      console.error(`[autoUpdateRole] فشل تغيير الاسم: ${err.message}`);
    }

    const isPromotion = isHigherRole(newRole, oldRole);

    // ✅ إعادة إصدار الشهادة
    await certificates.reissueCertificateOnUpdate(
      client,
      member.id,
      { militaryId: newMilitaryId, roleId: newRole },
      isPromotion ? 'promotion' : 'demotion',
      'System (Auto-Detect)'
    );

    // لوق
    if (isPromotion) {
      await logger.sendLog(client, 'member_promoted', {
        description: `تم ترقية العضو تلقائياً`,
        fields: [
          { name: '👤 العضو', value: `<@${member.id}>`, inline: true },
          { name: '⬆️ من', value: CONFIG.getRoleNameEnglish(oldRole), inline: true },
          { name: '⬇️ إلى', value: CONFIG.getRoleNameEnglish(newRole), inline: true },
          { name: '🆔 الرقم', value: `\`${newMilitaryId}\``, inline: true }
        ],
        userId: member.id
      }).catch(() => {});
    } else {
      await logger.sendLog(client, 'member_demoted', {
        description: `تم تخفيض رتبة العضو تلقائياً`,
        fields: [
          { name: '👤 العضو', value: `<@${member.id}>`, inline: true },
          { name: '⬇️ من', value: CONFIG.getRoleNameEnglish(oldRole), inline: true },
          { name: '⬇️ إلى', value: CONFIG.getRoleNameEnglish(newRole), inline: true }
        ],
        userId: member.id
      }).catch(() => {});
    }

    return { success: true, newMilitaryId };

  } catch (err) {
    console.error('[autoUpdateRole]', err);
    return { success: false, error: err.message };
  }
}

/* ═══════════════════════════════════════════════════════════
 *              إزالة عضو (ترميج يدوي)
 *  ═══════════════════════════════════════════════════════════ */

async function autoRemoveMember(client, member, removedRole) {
  try {
    const memberData = await firebase.getMember(member.id);
    if (!memberData) {
      console.log(`[autoRemoveMember] العضو غير موجود في Firebase — تجاهل`);
      // حتى لو ما كان موجود، نرجع الاسم
      try {
        await member.setNickname(null, 'إزالة الرتبة').catch(() => {});
      } catch {}
      return { success: true, skipped: true };
    }

    console.log(`[autoRemoveMember] بدء معالجة ترميج ${member.user.tag}`);
    console.log(`   📛 الاسم: ${memberData.nameOriginal || memberData.name}`);
    console.log(`   🆔 الرقم: ${memberData.militaryId}`);

    // ═══════════════════════════════════════════════════
    // 1. إبطال كل الشهادات
    // ═══════════════════════════════════════════════════
    const certResult = await firebase.invalidateAllCertificates(member.id, 'termination');
    console.log(`[autoRemoveMember] تم إبطال ${certResult.invalidatedCount} شهادة`);

    if (certResult.invalidatedCount > 0) {
      // لوق الإبطال
      await certificates.logCertificateInvalidation(client, {
        discordId: member.id,
        name: memberData.nameOriginal || memberData.name,
        militaryId: memberData.militaryId,
        certificatesCount: certResult.invalidatedCount,
        reason: 'termination',
        by: 'النظام (اكتشاف تلقائي)'
      }).catch(() => {});

      // ✅ إرسال DM يُعلمه بإبطال الشهادة (بصورة الشهادة المشطوبة)
      try {
        await certificates.sendInvalidationDM(client, member.id, {
          name: memberData.nameOriginal || memberData.name,
          militaryId: memberData.militaryId,
          count: certResult.invalidatedCount,
          reason: 'إزالة رتبتك من الشرطة العسكرية'
        });
        console.log(`[autoRemoveMember] ✅ تم إرسال DM الإبطال`);
      } catch (dmErr) {
        console.error(`[autoRemoveMember] ❌ فشل DM الإبطال:`, dmErr.message);
      }
    }

    // ═══════════════════════════════════════════════════
    // 2. حذف العضو من Firebase + إعادة الترتيب
    // ═══════════════════════════════════════════════════
    const removeResult = await firebase.removeMember(member.id);
    console.log(`[autoRemoveMember] تم الحذف — إعادة ترقيم ${removeResult.changes.length} عضو`);

    // ═══════════════════════════════════════════════════
    // 3. إرجاع الاسم الأصلي
    // ═══════════════════════════════════════════════════
    try {
      await member.setNickname(null, 'إزالة الرتبة');
      console.log(`[autoRemoveMember] ✅ تم إرجاع الاسم`);
    } catch (err) {
      console.error(`[autoRemoveMember] ❌ فشل إرجاع الاسم:`, err.message);
    }

    // ═══════════════════════════════════════════════════
    // 4. DM الترميج
    // ═══════════════════════════════════════════════════
    try {
      await member.send({
        embeds: [{
          color: 0xef4444,
          title: '❌ تم إزالة رتبتك العسكرية',
          description:
            `تم إزالة رتبتك من قبل الإدارة.\n\n` +
            `📛 **الاسم السابق:** ${memberData.nameOriginal || memberData.name}\n` +
            `🆔 **الرقم السابق:** \`${memberData.militaryId}\`\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `⚠️ **جميع شهاداتك تم إبطالها**`,
          footer: { text: 'Military Police — Ministry of Defense' },
          timestamp: new Date().toISOString()
        }]
      });
      console.log(`[autoRemoveMember] ✅ تم إرسال DM الترميج`);
    } catch (dmErr) {
      console.error(`[autoRemoveMember] ❌ فشل DM:`, dmErr.message);
    }

    // ═══════════════════════════════════════════════════
    // 5. لوق
    // ═══════════════════════════════════════════════════
    await logger.logMemberRemoved(client, {
      discordId: member.id,
      name: memberData.nameOriginal || memberData.name,
      militaryId: memberData.militaryId,
      points: memberData.points || 0,
      reason: 'إزالة رتبة خارجياً',
      by: 'النظام (اكتشاف تلقائي)',
      reordered: removeResult.changes.length
    }).catch(() => {});

    // ═══════════════════════════════════════════════════
    // 6. شهادات جديدة للأعضاء اللي تغير رقمهم
    // ═══════════════════════════════════════════════════
    for (const change of removeResult.changes) {
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
        console.error(`[autoRemoveMember] فشل تحديث ${change.discordId}:`, err.message);
      }
    }

    return { success: true, reordered: removeResult.changes.length };

  } catch (err) {
    console.error('[autoRemoveMember]', err);
    return { success: false, error: err.message };
  }
}

/* ═══════════════════════════════════════════════════════════
 *              تحديث اللوحة المتزامنة
 *  ═══════════════════════════════════════════════════════════ */

async function refreshSynchronizedPanel(client) {
  try {
    const loc = await firebase.getPanelLocation('synchronized');
    if (!loc) return false;

    const channel = await client.channels.fetch(loc.channelId).catch(() => null);
    if (!channel) return false;

    const message = await channel.messages.fetch(loc.messageId).catch(() => null);
    if (!message) return false;

    const members = await firebase.getAllMembers();
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
 *                    الحدث الرئيسي
 *  ═══════════════════════════════════════════════════════════ */

module.exports = {
  name: Events.GuildMemberUpdate,

  async execute(oldMember, newMember, client) {
    try {
      if (newMember.user.bot) return;
      if (newMember.guild.id !== CONFIG.GUILD_ID) return;
      if (processingMembers.has(newMember.id)) {
        console.log(`[GuildMemberUpdate] تخطي ${newMember.user.tag} — قيد المعالجة`);
        return;
      }

      const oldRoles = getMilitaryRoles(oldMember);
      const newRoles = getMilitaryRoles(newMember);

      const added = newRoles.filter(r => !oldRoles.includes(r));
      const removed = oldRoles.filter(r => !newRoles.includes(r));

      if (added.length === 0 && removed.length === 0) return;

      processingMembers.add(newMember.id);

      try {
        const oldRole = getHighestRole(oldRoles);
        const newRole = getHighestRole(newRoles);

        console.log(`\n[GuildMemberUpdate] 👤 ${newMember.user.tag}`);
        console.log(`   📌 القديم: ${oldRole || '—'}`);
        console.log(`   📌 الجديد: ${newRole || '—'}`);

        // 1. عضو جديد
        if (!oldRole && newRole) {
          console.log(`   ➡️ إضافة تلقائية`);
          await autoAddMember(client, newMember, newRole);
        }
        // 2. إزالة كاملة
        else if (oldRole && !newRole) {
          console.log(`   ➡️ ترميج تلقائي`);
          await autoRemoveMember(client, newMember, oldRole);
        }
        // 3. تغيير الرتبة
        else if (oldRole && newRole && oldRole !== newRole) {
          console.log(`   ➡️ تحديث رتبة`);
          await autoUpdateRole(client, newMember, oldRole, newRole);
        }

        // تحديث اللوحة
        await refreshSynchronizedPanel(client);

      } finally {
        setTimeout(() => processingMembers.delete(newMember.id), 3000);
      }

    } catch (err) {
      console.error('[GuildMemberUpdate] خطأ:', err);
      processingMembers.delete(newMember.id);
    }
  },

  autoAddMember,
  autoUpdateRole,
  autoRemoveMember,
  getMilitaryRoles,
  getHighestRole,
  extractDisplayName
};