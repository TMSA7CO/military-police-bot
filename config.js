/* ═══════════════════════════════════════════════════════════
 *  الشرطة العسكرية | وزارة الدفاع الأمريكي
 *  ملف الإعدادات المركزي — Config.js
 *  الإصدار: 1.2 (شهادات + ترقية قيادية)
 *  ═══════════════════════════════════════════════════════════ */

'use strict';

require('dotenv').config();

const CONFIG = {

  /* ─── Discord ─── */
  TOKEN: process.env.DISCORD_BOT_TOKEN,
  GUILD_ID: process.env.DISCORD_GUILD_ID || '1556449432273297518',
  CLIENT_ID: process.env.DISCORD_CLIENT_ID,

  /* ─── Firebase ─── */
  FIREBASE: {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    databaseURL: process.env.FIREBASE_DATABASE_URL,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID,
    measurementId: process.env.FIREBASE_MEASUREMENT_ID
  },

  FIREBASE_URL: process.env.FIREBASE_DATABASE_URL ||
    'https://military-police-5bacb-default-rtdb.firebaseio.com',

  /* ═══════════════════════════════════════════════════════
   *                        القنوات
   *  ═══════════════════════════════════════════════════════ */
  CHANNELS: {
    /* التقديمات */
    APPLICATIONS: process.env.CHANNEL_APPLICATIONS || '1556804514411974676',
    RECRUITMENT_PANEL: process.env.CHANNEL_RECRUITMENT_PANEL || '1557618442599923853',

    /* التقارير */
    REPORTS_PANEL: process.env.CHANNEL_REPORTS_PANEL || '1557597987683967028',
    REPORTS_LOG: process.env.CHANNEL_REPORTS_LOG || '1556842403325812757',

    /* التذاكر */
    TICKET_ARMY: process.env.CHANNEL_TICKET_ARMY || '1557620905788575804',
    TICKET_MP: process.env.CHANNEL_TICKET_MP || '1557625878014595092',
    TICKET_LOG: process.env.CHANNEL_TICKET_LOG || '1557622700464144444',

    /* الإدارة */
    CONTROL_PANEL: process.env.CHANNEL_CONTROL_PANEL || '1556841047764635678',
    SYNCHRONIZED_PANEL: process.env.CHANNEL_SYNCHRONIZED_PANEL || null,

    /* الدعم والمراقبة */
    SUPPORT_WAITING: process.env.CHANNEL_SUPPORT_WAITING || '1557579207662637166',

    /* السجلات */
    LOGS: process.env.CHANNEL_LOGS || '1556477465751199874',

    /* ✨ سجل الشهادات (جديد) */
    CERTIFICATE_LOG: process.env.CHANNEL_CERTIFICATE_LOG || '1557866857334313132'
  },

  /* ═══════════════════════════════════════════════════════
   *                        الرتب
   *  ═══════════════════════════════════════════════════════ */
  ROLES: {
    /* القيادة */
    COMMANDER: process.env.ROLE_COMMANDER || '1556461913087676466',
    DEPUTY_COMMANDER: process.env.ROLE_DEPUTY_COMMANDER || '1556462097527734302',
    ASSISTANT_COMMANDER: process.env.ROLE_ASSISTANT_COMMANDER || '1556462201324445837',

    /* الأعضاء */
    MP_OFFICER: process.env.ROLE_MP_OFFICER || '1556464397885513870',
    MP_TRAINEE: process.env.ROLE_MP_TRAINEE || '1557843518565777549',

    /* خاصة */
    REJECTED: process.env.ROLE_REJECTED || '1556805070643925042'
  },

  /* ─── الرتب القيادية ─── */
  COMMAND_ROLES: [
    '1556461913087676466',
    '1556462097527734302',
    '1556462201324445837'
  ],

  /* ─── كل الرتب ─── */
  ALL_RANKS: [
    '1556461913087676466',
    '1556462097527734302',
    '1556462201324445837',
    '1556464397885513870',
    '1557843518565777549'
  ],

  ROLES_ON_ACCEPT: '1557843518565777549',
  ROLES_ON_REJECT: '1556805070643925042',

  /* ═══════════════════════════════════════════════════════
   *                    الصلاحيات
   *  ═══════════════════════════════════════════════════════ */
  PERMISSIONS: {
    PANEL_MANAGEMENT: [
      '1556461913087676466',
      '1556462097527734302'
    ],
    TICKET_STAFF: [
      '1556461913087676466',
      '1556462097527734302',
      '1556462201324445837',
      '1556464397885513870'
    ],
    REPORT_MANAGEMENT: [
      '1556461913087676466'
    ],
    SUPPORT_MANAGEMENT: [
      '1556461913087676466'
    ],
    TERMINATION: [
      '1556461913087676466'
    ],
    DEDUCT_POINTS: [
      '1556461913087676466'
    ],
    ADD_POINTS: [
      '1556461913087676466',
      '1556462097527734302'
    ],
    CHANGE_NAME: [
      '1556461913087676466',
      '1556462097527734302'
    ],
    ADD_MEMBER: [
      '1556461913087676466',
      '1556462097527734302'
    ],
    CONTROL_PANEL_ACCESS: [
      '1556461913087676466',
      '1556462097527734302'
    ],
    LEADERSHIP_PROMOTION: [
      '1556461913087676466'
    ],
    APPOINT_COMMANDER: [
      '1556461913087676466'
    ]
  },

  /* ═══════════════════════════════════════════════════════
   *                    الأرقام العسكرية
   *  ═══════════════════════════════════════════════════════ */
  MILITARY_ID: {
    PREFIX: process.env.MILITARY_ID_PREFIX || 'M-',
    START_NUMBER: parseInt(process.env.MILITARY_ID_START) || 4,
    COMMANDER: 'M-01',
    DEPUTY: 'M-02',
    ASSISTANT: 'M-03'
  },

  /* ═══════════════════════════════════════════════════════
   *                    إعدادات التذاكر
   *  ═══════════════════════════════════════════════════════ */
  TICKETS: {
    PREFIX_ARMY: process.env.TICKET_PREFIX_ARMY || 'MP_',
    PREFIX_MP: process.env.TICKET_PREFIX_MP || 'M_',
    MAX_TICKETS_PER_USER: 1,
    ARCHIVE_ON_CLOSE: true
  },

  /* ═══════════════════════════════════════════════════════
   *                    إعدادات التقارير
   *  ═══════════════════════════════════════════════════════ */
  REPORTS: {
    POINTS_PER_APPROVE: parseInt(process.env.REPORT_POINTS_PER_APPROVE) || 1,
    MAX_PROOF_FILES: 5,
    REJECT_REASON_REQUIRED: true
  },

  /* ═══════════════════════════════════════════════════════
   *                    إعدادات النقاط
   *  ═══════════════════════════════════════════════════════ */
  POINTS: {
    MIN_ADD: 1,
    MAX_ADD: 100,
    MIN_DEDUCT: 1,
    MAX_DEDUCT: 100,
    MIN_REASON_LENGTH: 5,
    MAX_REASON_LENGTH: 200
  },

  /* ═══════════════════════════════════════════════════════
   *                    إعدادات المراقبة
   *  ═══════════════════════════════════════════════════════ */
  MONITOR: {
    MAX_SESSIONS: parseInt(process.env.MAX_MONITOR_SESSIONS) || 10,
    MIN_SESSIONS: 1
  },

  /* ═══════════════════════════════════════════════════════
   *                    إعدادات الاسم
   *  ═══════════════════════════════════════════════════════ */
  NAME: {
    MAX_DISCORD_NICKNAME: 32,
    MIN_NAME_LENGTH: 3,
    MAX_NAME_LENGTH: 50,
    FORBIDDEN_PATTERNS: [
      /@everyone/gi,
      /@here/gi,
      /<@[!&]?\d+>/g,
      /<#\d+>/g,
      /https?:\/\/\S+/gi
    ]
  },

  /* ═══════════════════════════════════════════════════════
   *              ✨ إعدادات الشهادات (جديد)
   *  ═══════════════════════════════════════════════════════ */
  CERTIFICATES: {
    PREFIX: 'MP-CERT',

    STATUS: {
      ACTIVE: 'active',
      INVALIDATED: 'invalidated',
      SUPERSEDED: 'superseded'
    },

    AUTO_REISSUE_ON_REORDER: true,
    AUTO_REISSUE_ON_NAME_CHANGE: true,
    AUTO_REISSUE_ON_PROMOTION: true,
    INVALIDATE_ON_TERMINATION: true,

    LEADERSHIP_ROLES: [
      '1556461913087676466',
      '1556462097527734302',
      '1556462201324445837'
    ],

    SINGLE_SEAT_ROLES: [
      '1556461913087676466',
      '1556462097527734302',
      '1556462201324445837'
    ]
  },

  /* ═══════════════════════════════════════════════════════
   *                    الألوان
   *  ═══════════════════════════════════════════════════════ */
  COLORS: {
    PRIMARY: 0x1e40af,
    SUCCESS: 0x10b981,
    WARNING: 0xfbbf24,
    DANGER: 0xef4444,
    INFO: 0x3b82f6,
    GOLD: 0xd4af37,
    SILVER: 0xc0c0c0,
    BRONZE: 0xcd7f32,
    DARK: 0x0a1428,
    GRAY: 0x64748b
  },

  /* ═══════════════════════════════════════════════════════
   *                    الإيموجيات
   *  ═══════════════════════════════════════════════════════ */
  EMOJIS: {
    COMMANDER: '👑',
    DEPUTY: '🛡️',
    ASSISTANT: '⚔️',
    OFFICER: '🎖️',
    TRAINEE: '📚',

    ACCEPT: '✅',
    REJECT: '❌',
    WARNING: '⚠️',
    INFO: 'ℹ️',
    LOCK: '🔒',
    UNLOCK: '🔓',
    TRASH: '🗑️',
    EDIT: '✏️',
    ADD: '➕',
    REMOVE: '➖',
    REFRESH: '🔄',
    SHIELD: '🛡️',
    STAR: '⭐',

    TICKET: '🎫',
    ARMY: '🎯',
    MP: '🎖️',

    CHECK: '✔️',
    CROSS: '✖️',
    CLOCK: '🕒',
    FILE: '📄',
    LINK: '🔗',
    IMAGE: '📷'
  },

  /* ═══════════════════════════════════════════════════════
   *                    النصوص الثابتة
   *  ═══════════════════════════════════════════════════════ */
  TEXT: {
    BRAND: 'MILITARY POLICE',
    BRAND_AR: 'الشرطة العسكرية',
    MINISTRY: 'MINISTRY OF DEFENSE',
    MINISTRY_AR: 'وزارة الدفاع الأمريكي',
    FOOTER: 'Military Police — Ministry of Defense',
    INVITE: process.env.DISCORD_INVITE || 'https://discord.gg/nUv3zrG5rZ'
  },

  /* ═══════════════════════════════════════════════════════
   *                    إعدادات عامة
   *  ═══════════════════════════════════════════════════════ */
  BOT: {
    STATUS: process.env.BOT_STATUS || 'الشرطة العسكرية | وزارة الدفاع',
    ACTIVITY_TYPE: process.env.BOT_ACTIVITY_TYPE || 'WATCHING',
    PREFIX: process.env.PREFIX || '!'
  },

  ENV: process.env.NODE_ENV || 'production',
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  HEALTH_PORT: parseInt(process.env.HEALTH_PORT) || 8000
};

/* ═══════════════════════════════════════════════════════════
 *                    دوال مساعدة
 *  ═══════════════════════════════════════════════════════════ */

/**
 * تنسيق الرقم العسكري (M-04)
 */
CONFIG.formatMilitaryId = function (num) {
  return `${CONFIG.MILITARY_ID.PREFIX}${String(num).padStart(2, '0')}`;
};

/**
 * استخراج الرقم من الرقم العسكري
 */
CONFIG.parseMilitaryId = function (id) {
  if (!id) return 0;
  const num = parseInt(String(id).replace(CONFIG.MILITARY_ID.PREFIX, '').trim(), 10);
  return isNaN(num) ? 0 : num;
};

/**
 * هل الرقم من أرقام القيادة؟
 */
CONFIG.isCommandId = function (id) {
  return [
    CONFIG.MILITARY_ID.COMMANDER,
    CONFIG.MILITARY_ID.DEPUTY,
    CONFIG.MILITARY_ID.ASSISTANT
  ].includes(id);
};

/**
 * هل الرتبة من رتب القيادة؟
 */
CONFIG.isCommandRole = function (roleId) {
  return CONFIG.COMMAND_ROLES.includes(roleId);
};

/**
 * ✨ هل الرتبة قيادية؟
 */
CONFIG.isLeadershipRole = function (roleId) {
  return CONFIG.CERTIFICATES.LEADERSHIP_ROLES.includes(roleId);
};

/**
 * ✨ هل الرتبة فردية (مقعد واحد)؟
 */
CONFIG.isSingleSeatRole = function (roleId) {
  return CONFIG.CERTIFICATES.SINGLE_SEAT_ROLES.includes(roleId);
};

/**
 * جلب الرقم العسكري المناسب للرتبة
 */
CONFIG.getMilitaryIdForRole = function (roleId) {
  switch (roleId) {
    case CONFIG.ROLES.COMMANDER: return CONFIG.MILITARY_ID.COMMANDER;
    case CONFIG.ROLES.DEPUTY_COMMANDER: return CONFIG.MILITARY_ID.DEPUTY;
    case CONFIG.ROLES.ASSISTANT_COMMANDER: return CONFIG.MILITARY_ID.ASSISTANT;
    default: return null;
  }
};

/**
 * جلب اسم الرتبة بالعربية
 */
CONFIG.getRoleNameArabic = function (roleId) {
  const map = {
    [CONFIG.ROLES.COMMANDER]: 'قائد الشرطة العسكرية',
    [CONFIG.ROLES.DEPUTY_COMMANDER]: 'نائب القائد',
    [CONFIG.ROLES.ASSISTANT_COMMANDER]: 'مساعد القائد',
    [CONFIG.ROLES.MP_OFFICER]: 'ضابط الشرطة العسكرية',
    [CONFIG.ROLES.MP_TRAINEE]: 'متدرب الشرطة العسكرية',
    [CONFIG.ROLES.REJECTED]: 'مرفوض'
  };
  return map[roleId] || 'غير محدد';
};

/**
 * جلب اسم الرتبة بالإنجليزية
 */
CONFIG.getRoleNameEnglish = function (roleId) {
  const map = {
    [CONFIG.ROLES.COMMANDER]: 'Military Police Commander',
    [CONFIG.ROLES.DEPUTY_COMMANDER]: 'Deputy Military Police Commander',
    [CONFIG.ROLES.ASSISTANT_COMMANDER]: 'Assistant Military Police Commander',
    [CONFIG.ROLES.MP_OFFICER]: 'Military Police Officer',
    [CONFIG.ROLES.MP_TRAINEE]: 'Military Police Trainee',
    [CONFIG.ROLES.REJECTED]: 'Rejected'
  };
  return map[roleId] || 'Unknown';
};

/**
 * جلب أيقونة الرتبة
 */
CONFIG.getRoleEmoji = function (roleId) {
  const map = {
    [CONFIG.ROLES.COMMANDER]: CONFIG.EMOJIS.COMMANDER,
    [CONFIG.ROLES.DEPUTY_COMMANDER]: CONFIG.EMOJIS.DEPUTY,
    [CONFIG.ROLES.ASSISTANT_COMMANDER]: CONFIG.EMOJIS.ASSISTANT,
    [CONFIG.ROLES.MP_OFFICER]: CONFIG.EMOJIS.OFFICER,
    [CONFIG.ROLES.MP_TRAINEE]: CONFIG.EMOJIS.TRAINEE,
    [CONFIG.ROLES.REJECTED]: CONFIG.EMOJIS.CROSS
  };
  return map[roleId] || '👤';
};

/**
 * هل المستخدم يملك أي من الرتب المطلوبة؟
 */
CONFIG.hasAnyRole = function (member, roleIds) {
  if (!member || !member.roles) return false;
  if (!Array.isArray(roleIds)) roleIds = [roleIds];
  return roleIds.some(roleId => member.roles.cache.has(roleId));
};

/**
 * تنظيف الاسم من الرموز الخطيرة
 */
CONFIG.sanitizeName = function (name) {
  if (!name) return '';
  let cleaned = String(name);

  CONFIG.NAME.FORBIDDEN_PATTERNS.forEach(pattern => {
    cleaned = cleaned.replace(pattern, '');
  });

  cleaned = cleaned
    .replace(/[\n\r\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned;
};

/**
 * بناء الاسم الكامل مع الرقم العسكري
 * مثال: "[M-04] Ahmed_AlSaud"
 */
CONFIG.buildFullName = function (militaryId, name) {
  const clean = CONFIG.sanitizeName(name);
  const prefix = `[${militaryId}] `;
  const maxNameLength = CONFIG.NAME.MAX_DISCORD_NICKNAME - prefix.length;
  const trimmed = clean.slice(0, maxNameLength);
  return `${prefix}${trimmed}`;
};

/**
 * التحقق من صحة عدد النقاط
 */
CONFIG.validatePoints = function (points, type = 'add') {
  const num = parseInt(points, 10);

  if (isNaN(num)) {
    return { valid: false, error: 'يجب إدخال رقم صحيح' };
  }

  if (type === 'add') {
    if (num < CONFIG.POINTS.MIN_ADD) {
      return { valid: false, error: `الحد الأدنى ${CONFIG.POINTS.MIN_ADD} نقطة` };
    }
    if (num > CONFIG.POINTS.MAX_ADD) {
      return { valid: false, error: `الحد الأقصى ${CONFIG.POINTS.MAX_ADD} نقطة` };
    }
  } else if (type === 'deduct') {
    if (num < CONFIG.POINTS.MIN_DEDUCT) {
      return { valid: false, error: `الحد الأدنى ${CONFIG.POINTS.MIN_DEDUCT} نقطة` };
    }
    if (num > CONFIG.POINTS.MAX_DEDUCT) {
      return { valid: false, error: `الحد الأقصى ${CONFIG.POINTS.MAX_DEDUCT} نقطة` };
    }
  }

  return { valid: true, value: num };
};

/**
 * التحقق من صحة السبب
 */
CONFIG.validateReason = function (reason) {
  if (!reason || reason.trim().length < CONFIG.POINTS.MIN_REASON_LENGTH) {
    return { valid: false, error: `السبب يجب أن يكون ${CONFIG.POINTS.MIN_REASON_LENGTH} أحرف على الأقل` };
  }
  if (reason.trim().length > CONFIG.POINTS.MAX_REASON_LENGTH) {
    return { valid: false, error: `السبب طويل جداً (حد أقصى ${CONFIG.POINTS.MAX_REASON_LENGTH} حرف)` };
  }
  return { valid: true, value: reason.trim() };
};

/* ═══════════════════════════════════════════════════════════
 *                    التحقق من الإعدادات
 *  ═══════════════════════════════════════════════════════════ */

CONFIG.validate = function () {
  const errors = [];
  const warnings = [];

  if (!CONFIG.TOKEN || CONFIG.TOKEN.includes('REPLACE')) {
    errors.push('❌ DISCORD_BOT_TOKEN غير موجود أو غير صحيح');
  }

  if (!CONFIG.CLIENT_ID || CONFIG.CLIENT_ID.includes('REPLACE')) {
    errors.push('❌ DISCORD_CLIENT_ID غير موجود — احصل عليه من Discord Developer Portal');
  }

  if (!CONFIG.FIREBASE.databaseURL) {
    errors.push('❌ FIREBASE_DATABASE_URL غير موجود');
  }

  if (!CONFIG.CHANNELS.APPLICATIONS) {
    warnings.push('⚠️ CHANNEL_APPLICATIONS غير محدد');
  }

  if (!CONFIG.CHANNELS.REPORTS_LOG) {
    warnings.push('⚠️ CHANNEL_REPORTS_LOG غير محدد');
  }

  if (!CONFIG.CHANNELS.CONTROL_PANEL) {
    warnings.push('⚠️ CHANNEL_CONTROL_PANEL غير محدد');
  }

  if (!CONFIG.CHANNELS.CERTIFICATE_LOG) {
    warnings.push('⚠️ CHANNEL_CERTIFICATE_LOG غير محدد');
  }

  if (errors.length > 0) {
    console.error('\n══════════════════════════════════════');
    console.error('   أخطاء في الإعدادات:');
    errors.forEach(e => console.error('   ' + e));
    console.error('══════════════════════════════════════\n');
  }

  if (warnings.length > 0) {
    console.warn('\n══════════════════════════════════════');
    console.warn('   تحذيرات:');
    warnings.forEach(w => console.warn('   ' + w));
    console.warn('══════════════════════════════════════\n');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
};

/* ═══════════════════════════════════════════════════════════
 *                    التصدير
 *  ═══════════════════════════════════════════════════════════ */

module.exports = CONFIG;