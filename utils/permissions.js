/* ═══════════════════════════════════════════════════════════
 *  الشرطة العسكرية | وزارة الدفاع الأمريكي
 *  نظام الصلاحيات — Permissions.js
 *  الإصدار: 1.0
 *  الوظيفة: دوال فحص الصلاحيات للوحة المتزامنة
 *  ═══════════════════════════════════════════════════════════ */

'use strict';

const CONFIG = require('../config');

/* ═══════════════════════════════════════════════════════════
 *                    ثوابت
 *  ═══════════════════════════════════════════════════════════ */

/** الحد الأدنى لمستوى القيادة (له وصول للوحة) */
const LEADERSHIP_MIN_LEVEL = 3;

/* ═══════════════════════════════════════════════════════════
 *                    دوال مساعدة أساسية
 *  ═══════════════════════════════════════════════════════════ */

/**
 * جلب ID أعلى رتبة للعضو
 * يعتمد على ALL_RANKS المرتبة من الأعلى للأدنى
 *
 * @param {GuildMember} member
 * @returns {string|null} - roleId أو null
 */
function getActorRoleId(member) {
  if (!member || !member.roles) return null;

  /* ALL_RANKS مرتبة من الأعلى للأدنى في config.js */
  for (const roleId of CONFIG.ALL_RANKS) {
    if (member.roles.cache.has(roleId)) return roleId;
  }

  return null;
}

/**
 * جلب مستوى العضو
 *
 * @param {GuildMember} member
 * @returns {number} - 0-5
 */
function getActorLevel(member) {
  const roleId = getActorRoleId(member);
  return CONFIG.getRoleLevel(roleId);
}

/**
 * هل هذا العضو من القيادة؟ (مستوى >= 3)
 *
 * @param {GuildMember} member
 * @returns {boolean}
 */
function isLeadership(member) {
  return getActorLevel(member) >= LEADERSHIP_MIN_LEVEL;
}

/* ═══════════════════════════════════════════════════════════
 *                    الفلترة
 *  ═══════════════════════════════════════════════════════════ */

/**
 * فلترة الأعضاء المؤهلين للتحكم بهم من قبل الفاعل
 *
 * القاعدة: مستوى الفاعل > مستوى الهدف
 *
 * @param {GuildMember} actor - منفّذ العملية
 * @param {Array} members - قائمة أعضاء Firebase
 * @param {Object} options - خيارات
 * @param {boolean} options.excludeSelf - استثناء الفاعل نفسه (افتراضي: true)
 * @returns {Array} - الأعضاء المؤهلين
 */
function filterTargetableMembers(actor, members, options = {}) {
  const { excludeSelf = true } = options;

  if (!Array.isArray(members)) return [];

  const actorLevel = getActorLevel(actor);

  /* القيادة فقط يمكنها الوصول */
  if (actorLevel < LEADERSHIP_MIN_LEVEL) return [];

  return members.filter(m => {
    /* استثناء النفس */
    if (excludeSelf && m.discordId === actor.id) return false;

    /* جلب مستوى الهدف */
    const targetLevel = CONFIG.getRoleLevel(m.roleId);

    /* تجاهل من ليس له مستوى صالح */
    if (targetLevel === 0) return false;

    /* القاعدة الذهبية: actorLevel > targetLevel */
    return CONFIG.canActOn(actorLevel, targetLevel);
  });
}

/**
 * فلترة الرتب التي يقدر الفاعل إضافتها
 *
 * القاعدة: مستوى الفاعل > مستوى الرتبة الجديدة
 *
 * @param {GuildMember} actor
 * @returns {Array} - قائمة { roleId, level, nameAr, nameEn }
 */
function filterAssignableRoles(actor) {
  const actorLevel = getActorLevel(actor);

  const allRoles = [
    { roleId: CONFIG.ROLES.MP_TRAINEE,          level: 1 },
    { roleId: CONFIG.ROLES.MP_OFFICER,          level: 2 },
    { roleId: CONFIG.ROLES.ASSISTANT_COMMANDER, level: 3 },
    { roleId: CONFIG.ROLES.DEPUTY_COMMANDER,    level: 4 },
    { roleId: CONFIG.ROLES.COMMANDER,           level: 5 }
  ];

  return allRoles
    .filter(r => CONFIG.canAssignRole(actorLevel, r.level))
    .map(r => ({
      ...r,
      nameAr: CONFIG.getLevelNameArabic(r.level),
      nameEn: CONFIG.getLevelNameEnglish(r.level)
    }));
}

/* ═══════════════════════════════════════════════════════════
 *                    الفحص الرئيسي
 *  ═══════════════════════════════════════════════════════════ */

/**
 * ✅ الفحص الشامل للصلاحية
 *
 * @param {GuildMember} actor - منفّذ العملية
 * @param {Object} target - { discordId, roleId } من Firebase
 * @param {string} action - نوع العملية
 *   - 'terminate'      → ترميج
 *   - 'add_points'     → إضافة نقاط
 *   - 'deduct_points'  → خصم نقاط
 *   - 'add_member'     → إضافة عضو جديد
 *   - 'change_name'    → تغيير اسم
 *
 * @returns {Object} - { ok: boolean, reason?: string, code?: string }
 */
function checkPermission(actor, target, action) {
  /* ─── 1. الفاعل له وصول؟ ─── */
  const actorLevel = getActorLevel(actor);

  if (actorLevel < LEADERSHIP_MIN_LEVEL) {
    return {
      ok: false,
      code: 'NOT_LEADERSHIP',
      reason: 'ليس لديك وصول للوحة المتزامنة (مساعد قائد وأعلى فقط)'
    };
  }

  /* ─── 2. التحقق من البيانات ─── */
  if (!target) {
    return {
      ok: false,
      code: 'NO_TARGET',
      reason: 'لم يتم تحديد الهدف'
    };
  }

  /* ─── 3. عملية "إضافة عضو" — فحص خاص ─── */
  if (action === 'add_member') {
    const newRoleLevel = CONFIG.getRoleLevel(target.roleId);

    if (newRoleLevel === 0) {
      return {
        ok: false,
        code: 'INVALID_ROLE',
        reason: 'الرتبة المطلوبة غير صحيحة'
      };
    }

    if (!CONFIG.canAssignRole(actorLevel, newRoleLevel)) {
      return {
        ok: false,
        code: 'ROLE_TOO_HIGH',
        reason: `لا يمكنك إضافة شخص برتبة **${CONFIG.getLevelNameArabic(newRoleLevel)}** (نفس مستواك أو أعلى)`
      };
    }

    return { ok: true };
  }

  /* ─── 4. باقي العمليات: منع تنفيذ الإجراء على النفس ─── */
  if (target.discordId && actor.id === target.discordId) {
    return {
      ok: false,
      code: 'SELF_ACTION',
      reason: 'لا يمكنك تنفيذ هذا الإجراء على نفسك'
    };
  }

  /* ─── 5. جلب مستوى الهدف ─── */
  const targetLevel = CONFIG.getRoleLevel(target.roleId);

  if (targetLevel === 0) {
    return {
      ok: false,
      code: 'TARGET_NOT_MEMBER',
      reason: 'الهدف ليس عضواً في السلك'
    };
  }

  /* ─── 6. القاعدة الذهبية: actorLevel > targetLevel ─── */
  if (!CONFIG.canActOn(actorLevel, targetLevel)) {
    return {
      ok: false,
      code: 'LEVEL_TOO_HIGH',
      reason: `لا يمكنك تنفيذ هذا الإجراء على **${CONFIG.getLevelNameArabic(targetLevel)}** (نفس مستواك أو أعلى)`
    };
  }

  return { ok: true };
}

/* ═══════════════════════════════════════════════════════════
 *                    بناء رسائل الخطأ
 *  ═══════════════════════════════════════════════════════════ */

/**
 * بناء رسالة خطأ موحدة
 *
 * @param {Object} result - نتيجة checkPermission
 * @returns {string}
 */
function buildPermissionError(result) {
  if (!result || result.ok) return null;

  const emojis = {
    'NOT_LEADERSHIP':   '🚫',
    'NO_TARGET':        '❓',
    'INVALID_ROLE':     '❌',
    'ROLE_TOO_HIGH':    '🔺',
    'SELF_ACTION':      '👤',
    'TARGET_NOT_MEMBER':'🚪',
    'LEVEL_TOO_HIGH':   '🔺'
  };

  const emoji = emojis[result.code] || '❌';
  return `${emoji} **${result.reason}**`;
}

/* ═══════════════════════════════════════════════════════════
 *                    دوال إضافية
 *  ═══════════════════════════════════════════════════════════ */

/**
 * التحقق من أن رتبة معينة محجوزة (REJECTED)
 *
 * @param {string} roleId
 * @returns {boolean}
 */
function isRejectedRole(roleId) {
  return roleId === CONFIG.ROLES.REJECTED;
}

/**
 * جلب ملخص صلاحيات العضو (للعرض)
 *
 * @param {GuildMember} member
 * @returns {Object}
 */
function getMemberPermissionsSummary(member) {
  const roleId = getActorRoleId(member);
  const level = CONFIG.getRoleLevel(roleId);

  return {
    roleId,
    level,
    levelNameAr: CONFIG.getLevelNameArabic(level),
    levelNameEn: CONFIG.getLevelNameEnglish(level),
    isLeadership: level >= LEADERSHIP_MIN_LEVEL,
    canAccessPanel: level >= LEADERSHIP_MIN_LEVEL
  };
}

/* ═══════════════════════════════════════════════════════════
 *                    التصدير
 *  ═══════════════════════════════════════════════════════════ */

module.exports = {
  /* الثوابت */
  LEADERSHIP_MIN_LEVEL,

  /* دوال العضو */
  getActorRoleId,
  getActorLevel,
  isLeadership,
  getMemberPermissionsSummary,

  /* الفلترة */
  filterTargetableMembers,
  filterAssignableRoles,

  /* الفحص الرئيسي */
  checkPermission,
  buildPermissionError,

  /* فحوصات إضافية */
  isRejectedRole
};