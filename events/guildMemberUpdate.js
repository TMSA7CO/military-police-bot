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

/* ✨ جديد — الإجراءات الموحدة */
const memberActions = require('../utils/memberActions');
const permissions = require('../utils/permissions');

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
/**
 * استخراج الاسم من displayName أو nickname
 * (بدون بادئة [M-XX])
 */
function extractDisplayName(member) {
  let name = member.nickname
    || member.displayName
    || member.user.globalName
    || member.user.username;

  /* إزالة بادئة [M-XX] */
  name = name.replace(/^\[M-\d+\]\s*/, '').trim();

  if (!name || name.length < 2) {
    name = member.user.username;
  }

  return name;
}

/**
 * ✨ استخراج الاسم من النك نيم فقط (بدون بادئة)
 * يُستخدم لمقارنة الاسم القديم والجديد
 */
function extractCleanName(nickname) {
  if (!nickname) return '';
  return nickname.replace(/^\[M-\d+\]\s*/, '').trim();
}
/* ═══════════════════════════════════════════════════════════
 *              إضافة عضو جديد (من خارج البوت)
 *  ═══════════════════════════════════════════════════════════ */

/**
 * ✅ إضافة عضو يدوياً — يستدعي performAddMember الموحدة
 * (نفس سلوك الزر تماماً)
 */
async function autoAddMember(client, member, newRole) {
  try {
    console.log(`[autoAddMember] ➕ إضافة يدوية: ${member.user.tag}`);

    /* ─── استخراج الاسم ─── */
    const name = extractDisplayName(member);

    /* ─── استدعاء الدالة الموحدة ─── */
    const result = await memberActions.performAddMember(
      client,
      member.id,
      name,
      newRole,
      'إضافة يدوية من Discord',
      'System (Auto-Detect)',
      'manual'
    );

    return result;

  } catch (err) {
    console.error('[autoAddMember]', err);
    return { success: false, error: err.message };
  }
}

/* ═══════════════════════════════════════════════════════════
 *              تحديث رتبة عضو موجود
 *  ═══════════════════════════════════════════════════════════ */

/**
 * ✅ تحديث رتبة يدوياً — ترقية أو تخفيض
 * (يستدعي منطق الترقية القيادية + reissueCertificateOnUpdate)
 */
async function autoUpdateRole(client, member, oldRole, newRole) {
  try {
    const memberData = await firebase.getMember(member.id);
    if (!memberData) {
      /* لو ما كان موجود، نضيفه مباشرة */
      return autoAddMember(client, member, newRole);
    }

    /* ─── حساب الـ ID الجديد ─── */
    let newMilitaryId = CONFIG.getMilitaryIdForRole(newRole);
    if (!newMilitaryId) {
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

    /* ─── تحديث النك نيم ─── */
    const nameBase = memberData.nameOriginal || memberData.name || extractDisplayName(member);
    const fullName = CONFIG.buildFullName(newMilitaryId, nameBase);

    await firebase.updateMember(member.id, { nickname: fullName });

    try {
      await member.setNickname(fullName, 'تحديث الرتبة');
    } catch (err) {
      console.error(`[autoUpdateRole] فشل تغيير الاسم: ${err.message}`);
    }

    /* ─── تحديد: ترقية أو تخفيض ─── */
    const isPromotion = isHigherRole(newRole, oldRole);

    /* ─── الترقية القيادية → إعادة ترقيم الأفراد ─── */
    const oldWasLeadership = CONFIG.isLeadershipRole(oldRole);
    const newIsLeadership = CONFIG.isLeadershipRole(newRole);

    if (!oldWasLeadership && newIsLeadership) {
      console.log(`[autoUpdateRole] 🎖️ ترقية قيادية — إعادة ترقيم الأفراد`);

      const reorderResult = await firebase.reorderMilitaryIds();

      for (const change of (reorderResult.changes || [])) {
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
          console.error(`[autoUpdateRole] فشل إعادة ترقيم ${change.discordId}:`, err.message);
        }
      }
    }

    /* ─── إعادة إصدار الشهادة ─── */
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
        description: `تم ترقية العضو يدوياً`,
        fields: [
          { name: '👤 العضو', value: `<@${member.id}>`, inline: true },
          { name: '⬆️ من', value: CONFIG.getRoleNameEnglish(oldRole), inline: true },
          { name: '⬆️ إلى', value: CONFIG.getRoleNameEnglish(newRole), inline: true },
          { name: '🆔 الرقم', value: `\`${newMilitaryId}\``, inline: true }
        ],
        userId: member.id
      }).catch(() => {});
    } else {
      await logger.sendLog(client, 'member_demoted', {
        description: `تم تخفيض رتبة العضو يدوياً`,
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

/**
 * ✨ تغيير الاسم يدوياً — يستدعي performNameChange الموحدة
 */
async function handleNicknameChange(client, member, oldNickname, newNickname) {
  try {
    const oldClean = extractCleanName(oldNickname);
    const newClean = extractCleanName(newNickname);

    /* ─── لو الاسم الفعلي ما تغير، تجاهل ─── */
    if (oldClean === newClean) return null;

    /* ─── لو الاسم الجديد فارغ، تجاهل ─── */
    if (!newClean || newClean.length < 2) return null;

    console.log(`[handleNicknameChange] ✏️ تغيير يدوي: "${oldClean}" → "${newClean}"`);

    /* ─── استدعاء الدالة الموحدة ─── */
    const result = await memberActions.performNameChange(
      client,
      member.id,
      newClean,
      'تغيير يدوي من Discord',
      'System (Auto-Detect)',
      'manual'
    );

    return result;

  } catch (err) {
    console.error('[handleNicknameChange]', err);
    return { success: false, error: err.message };
  }
}

/* ═══════════════════════════════════════════════════════════
 *              إزالة عضو (ترميج يدوي)
 *  ═══════════════════════════════════════════════════════════ */

/**
 * ✅ ترميج يدوي — يستدعي performTerminate الموحدة
 * (نفس سلوك الزر تماماً + حذف الشهادات من اللوق + DM)
 */
async function autoRemoveMember(client, member, removedRole) {
  try {
    console.log(`[autoRemoveMember] 🗑️ ترميج يدوي: ${member.user.tag}`);

    /* ─── التحقق من وجود العضو في Firebase ─── */
    const memberData = await firebase.getMember(member.id);

    if (!memberData) {
      console.log(`[autoRemoveMember] العضو غير موجود في Firebase — تجاهل`);
      /* نحاول فقط إرجاع الاسم */
      try {
        await member.setNickname(null, 'إزالة الرتبة').catch(() => {});
      } catch {}
      return { success: true, skipped: true };
    }

    /* ─── استدعاء الدالة الموحدة ─── */
    const result = await memberActions.performTerminate(
      client,
      member.id,
      'ترميج يدوي من Discord',
      'System (Auto-Detect)',
      'manual'
    );

    return result;

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
      /* ─── تجاهل البوتات والسيرفرات الأخرى ─── */
      if (newMember.user.bot) return;
      if (newMember.guild.id !== CONFIG.GUILD_ID) return;

      /* ─── منع الحلقات اللانهائية ─── */
      if (processingMembers.has(newMember.id)) {
        console.log(`[GuildMemberUpdate] ⏭️ تخطي ${newMember.user.tag} — قيد المعالجة`);
        return;
      }

      /* ─── 1. تحقق من تغيير الرتب ─── */
      const oldRoles = getMilitaryRoles(oldMember);
      const newRoles = getMilitaryRoles(newMember);

      const addedRoles = newRoles.filter(r => !oldRoles.includes(r));
      const removedRoles = oldRoles.filter(r => !newRoles.includes(r));
      const hasRoleChange = addedRoles.length > 0 || removedRoles.length > 0;

      /* ─── 2. تحقق من تغيير الاسم ─── */
      const oldNickname = oldMember.nickname || '';
      const newNickname = newMember.nickname || '';
      const hasNicknameChange = oldNickname !== newNickname
        && extractCleanName(oldNickname) !== extractCleanName(newNickname);

      /* ─── لو ما فيه تغيير ─── */
      if (!hasRoleChange && !hasNicknameChange) return;

      /* ─── قفل العضو ─── */
      processingMembers.add(newMember.id);

      try {
        /* ═══════════════════════════════════════
         *  أ) تغيير الاسم (يدوياً)
         *  ═══════════════════════════════════════ */
        if (hasNicknameChange) {
          console.log(`\n[GuildMemberUpdate] 👤 ${newMember.user.tag}`);
          console.log(`   ✏️ تغيير اسم يدوي`);

          await handleNicknameChange(client, newMember, oldNickname, newNickname);
        }

        /* ═══════════════════════════════════════
         *  ب) تغيير الرتب (يدوياً)
         *  ═══════════════════════════════════════ */
        if (hasRoleChange) {
          const oldRole = getHighestRole(oldRoles);
          const newRole = getHighestRole(newRoles);

          console.log(`\n[GuildMemberUpdate] 👤 ${newMember.user.tag}`);
          console.log(`   📌 الرتبة القديمة: ${oldRole || '—'}`);
          console.log(`   📌 الرتبة الجديدة: ${newRole || '—'}`);

          /* 1. عضو جديد (ما كان عنده رتبة وصار عنده) */
          if (!oldRole && newRole) {
            console.log(`   ➡️ إضافة يدوية`);
            await autoAddMember(client, newMember, newRole);
          }
          /* 2. ترميج كامل (كان عنده رتبة وما عنده الآن) */
          else if (oldRole && !newRole) {
            console.log(`   ➡️ ترميج يدوي`);
            await autoRemoveMember(client, newMember, oldRole);
          }
          /* 3. تغيير رتبة (من رتبة لرتبة) */
          else if (oldRole && newRole && oldRole !== newRole) {
            console.log(`   ➡️ تحديث رتبة`);
            await autoUpdateRole(client, newMember, oldRole, newRole);
          }
        }

        /* ═══════════════════════════════════════
         *  ج) تحديث اللوحة المتزامنة
         *  ═══════════════════════════════════════ */
        await memberActions.refreshSynchronizedPanel(client);

      } finally {
        /* ─── فتح القفل بعد 3 ثواني ─── */
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
  handleNicknameChange,     /* ✨ جديد */
  getMilitaryRoles,
  getHighestRole,
  extractDisplayName,
  extractCleanName          /* ✨ جديد */
};