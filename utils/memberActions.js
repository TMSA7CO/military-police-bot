/* ═══════════════════════════════════════════════════════════
 *  الشرطة العسكرية | وزارة الدفاع الأمريكي
 *  الدوال الموحدة للأعضاء — MemberActions.js
 *  الإصدار: 1.0
 *  الوظيفة:
 *    - توحيد الترميج / تغيير الاسم / الإضافة
 *    - نفس السلوك من الزر أو يدوياً
 *    - حذف رسائل الشهادات (لوق + DM)
 *    - تحديث اللوحة المتزامنة تلقائياً
 *  ═══════════════════════════════════════════════════════════ */

'use strict';

const CONFIG = require('../config');
const firebase = require('../firebase');
const logger = require('./logger');
const certificates = require('./certificates');

/* ═══════════════════════════════════════════════════════════
 *                    ثوابت
 *  ═══════════════════════════════════════════════════════════ */

const CERT_LOG_CHANNEL_ID =
  CONFIG.CHANNELS.CERTIFICATE_LOG || '1557866857334313132';

/** عدد الرسائل التي نفحصها في كل بحث */
const SEARCH_LIMIT = 100;

/* ═══════════════════════════════════════════════════════════
 *              ✨ 1. تحديث اللوحة المتزامنة
 *  ═══════════════════════════════════════════════════════════ */

/**
 * تحديث اللوحة المتزامنة (بعد أي عملية)
 */
async function refreshSynchronizedPanel(client) {
  try {
    const loc = await firebase.getPanelLocation('synchronized');
    if (!loc) return { success: false, error: 'اللوحة غير مثبتة' };

    const channel = await client.channels.fetch(loc.channelId).catch(() => null);
    if (!channel) return { success: false, error: 'القناة غير موجودة' };

    const message = await channel.messages.fetch(loc.messageId).catch(() => null);
    if (!message) return { success: false, error: 'الرسالة غير موجودة' };

    /* ─── نستدعي embed builder ─── */
    const embeds = require('./embeds');
    const members = await firebase.getAllMembers();
    const payload = embeds.synchronizedPanel(client, members);

    await message.edit(payload);
    return { success: true };

  } catch (err) {
    console.error('[memberActions:refreshPanel]', err.message);
    return { success: false, error: err.message };
  }
}

/* ═══════════════════════════════════════════════════════════
 *              ✨ 2. حذف رسالة شهادة من قناة اللوق
 *  ═══════════════════════════════════════════════════════════ */

/**
 * حذف رسالة شهادة من قناة اللوق
 *
 * @param {Client} client
 * @param {string} certificateNumber - رقم الشهادة
 * @returns {Object} - { deleted: 0|1 }
 */
async function deleteCertificateMessageFromLog(client, certificateNumber) {
  if (!certificateNumber) return { deleted: 0 };

  try {
    const channel = await client.channels.fetch(CERT_LOG_CHANNEL_ID).catch(() => null);
    if (!channel) return { deleted: 0 };

    const messages = await channel.messages.fetch({ limit: SEARCH_LIMIT }).catch(() => null);
    if (!messages || messages.size === 0) return { deleted: 0 };

    /* ─── البحث عن رسالة تحتوي رقم الشهادة ─── */
    const found = messages.find(m =>
      m.embeds.some(e => {
        /* من الفوتر */
        if (e.footer?.text?.includes(certificateNumber)) return true;
        /* من الحقول */
        if (e.fields?.some(f =>
          String(f.value || '').includes(certificateNumber) ||
          String(f.name || '').includes(certificateNumber)
        )) return true;
        /* من الوصف */
        if (e.description?.includes(certificateNumber)) return true;
        return false;
      })
    );

    if (found) {
      await found.delete().catch(() => {});
      return { deleted: 1, messageId: found.id };
    }

    return { deleted: 0 };

  } catch (err) {
    console.error('[memberActions:deleteFromLog]', err.message);
    return { deleted: 0, error: err.message };
  }
}

/* ═══════════════════════════════════════════════════════════
 *              ✨ 3. حذف رسالة شهادة من DM
 *  ═══════════════════════════════════════════════════════════ */

/**
 * حذف رسالة شهادة من الخاص (DM) للعضو
 *
 * ⚠️ ملاحظة: البوت يقدر يحذف رسائله هو فقط
 *
 * @param {Client} client
 * @param {string} userId
 * @param {string} certificateNumber
 * @returns {Object} - { deleted: 0|1 }
 */
async function deleteCertificateMessageFromDM(client, userId, certificateNumber) {
  if (!certificateNumber || !userId) return { deleted: 0 };

  try {
    const user = await client.users.fetch(userId).catch(() => null);
    if (!user) return { deleted: 0 };

    const dmChannel = await user.createDM().catch(() => null);
    if (!dmChannel) return { deleted: 0 };

    const messages = await dmChannel.messages.fetch({ limit: SEARCH_LIMIT }).catch(() => null);
    if (!messages || messages.size === 0) return { deleted: 0 };

    /* ─── فلترة: رسائل البوت فقط + تحتوي رقم الشهادة ─── */
    const botMessages = messages.filter(m => m.author.id === client.user.id);

    const found = botMessages.find(m =>
      m.embeds.some(e => {
        if (e.footer?.text?.includes(certificateNumber)) return true;
        if (e.fields?.some(f =>
          String(f.value || '').includes(certificateNumber) ||
          String(f.name || '').includes(certificateNumber)
        )) return true;
        if (e.description?.includes(certificateNumber)) return true;
        return false;
      })
    );

    if (found) {
      await found.delete().catch(() => {});
      return { deleted: 1, messageId: found.id };
    }

    return { deleted: 0 };

  } catch (err) {
    console.error('[memberActions:deleteFromDM]', err.message);
    return { deleted: 0, error: err.message };
  }
}

/* ═══════════════════════════════════════════════════════════
 *              ✨ 4. حذف كل شهادات عضو
 *  ═══════════════════════════════════════════════════════════ */

/**
 * حذف كل رسائل الشهادات لعضو (من اللوق + DM)
 *
 * @param {Client} client
 * @param {string} userId
 * @param {Array} certificatesList - قائمة الشهادات من Firebase
 * @returns {Object} - { fromLog, fromDM }
 */
async function deleteAllCertificateMessages(client, userId, certificatesList) {
  const result = { fromLog: 0, fromDM: 0 };

  if (!Array.isArray(certificatesList) || certificatesList.length === 0) {
    return result;
  }

  for (const cert of certificatesList) {
    if (!cert.certificateNumber) continue;

    const logResult = await deleteCertificateMessageFromLog(client, cert.certificateNumber);
    result.fromLog += logResult.deleted || 0;

    const dmResult = await deleteCertificateMessageFromDM(client, userId, cert.certificateNumber);
    result.fromDM += dmResult.deleted || 0;

    /* ─── تأخير بسيط لتجنب Rate Limit ─── */
    await new Promise(r => setTimeout(r, 300));
  }

  return result;
}

/* ═══════════════════════════════════════════════════════════
 *              ✨ 5. ترميج عضو (موحّد)
 *  ═══════════════════════════════════════════════════════════ */

/**
 * ترميج عضو — نفس السلوك من الزر أو يدوياً
 *
 * @param {Client} client
 * @param {string} targetUserId - آيدي العضو المرمَّج
 * @param {string} reason - السبب
 * @param {string} byUserId - المنفذ (أو 'System')
 * @param {string} source - 'manual' | 'panel'
 * @returns {Object}
 */
async function performTerminate(client, targetUserId, reason, byUserId = 'System', source = 'manual') {
  const result = {
    success: false,
    invalidatedCount: 0,
    reorderedCount: 0,
    deletedFromLog: 0,
    deletedFromDM: 0,
    error: null
  };

  try {
    /* ─── 1. جلب بيانات العضو ─── */
    const memberData = await firebase.getMember(targetUserId);
    if (!memberData) {
      result.error = 'العضو غير موجود في Firebase';
      return result;
    }

    const name = memberData.nameOriginal || memberData.name || 'Unknown';
    const militaryId = memberData.militaryId || 'M-XX';

    /* ─── 2. جلب كل شهادات العضو ─── */
    const allCerts = await firebase.getMemberCertificates(targetUserId);

    /* ─── 3. حذف رسائل الشهادات (لوق + DM) ─── */
    const deleteResult = await deleteAllCertificateMessages(client, targetUserId, allCerts);
    result.deletedFromLog = deleteResult.fromLog;
    result.deletedFromDM = deleteResult.fromDM;

    /* ─── 4. إبطال كل الشهادات في Firebase ─── */
    const certResult = await firebase.invalidateAllCertificates(targetUserId, 'termination');
    result.invalidatedCount = certResult.invalidatedCount || 0;

    /* ─── 5. لوق الإبطال + DM شهادة إبطال ─── */
    if (certResult.invalidatedCount > 0) {
      /* لوق الإبطال */
      await certificates.logCertificateInvalidation(client, {
        discordId: targetUserId,
        name,
        militaryId,
        certificatesCount: certResult.invalidatedCount,
        reason: 'termination',
        by: byUserId === 'System' ? null : byUserId
      }).catch(() => {});

      /* DM شهادة الإبطال (حمراء) */
      try {
        const invalidationDM = await certificates.sendInvalidationDM(client, targetUserId, {
          name,
          militaryId,
          count: certResult.invalidatedCount,
          reason: reason,
          certificateNumber: `INVALIDATED-${Date.now()}`
        });
        console.log('[performTerminate] ✅ DM invalidation sent:', invalidationDM?.messageId || 'no id');
      } catch (dmErr) {
        console.warn('[performTerminate] DM invalidation failed:', dmErr.message);
      }
    }

    /* ─── 6. حذف العضو من Firebase + إعادة ترقيم ─── */
    const removeResult = await firebase.removeMember(targetUserId);
    result.reorderedCount = removeResult.changes?.length || 0;

    /* ─── 7. تحديث Discord ─── */
    const guild = await client.guilds.fetch(CONFIG.GUILD_ID).catch(() => null);
    const guildMember = guild ? await guild.members.fetch(targetUserId).catch(() => null) : null;

    if (guildMember) {
      /* إزالة كل الرتب العسكرية */
      for (const roleId of CONFIG.ALL_RANKS) {
        await guildMember.roles.remove(roleId).catch(() => {});
      }
      /* إرجاع الاسم الأصلي */
      await guildMember.setNickname(null).catch(() => {});
    }

    /* ─── 8. لوق الترميج ─── */
    await logger.logMemberRemoved(client, {
      discordId: targetUserId,
      name,
      militaryId,
      points: memberData.points || 0,
      reason,
      by: byUserId === 'System' ? 'النظام' : byUserId,
      reordered: result.reorderedCount
    }).catch(() => {});

    /* ─── 9. شهادات جديدة للأعضاء المُعاد ترقيمهم ─── */
    if (guild) {
      for (const change of (removeResult.changes || [])) {
        try {
          await certificates.reissueCertificateOnReorder(
            client,
            change.memberData,
            change.newId
          );

          const changedMember = await guild.members.fetch(change.discordId).catch(() => null);
          if (changedMember && change.newNickname) {
            await changedMember.setNickname(change.newNickname, 'إعادة ترقيم').catch(() => {});
          }
        } catch (err) {
          console.error(`[performTerminate] reorder fail ${change.discordId}:`, err.message);
        }
      }
    }

    /* ─── 10. DM الترميج ─── */
    try {
      const user = await client.users.fetch(targetUserId).catch(() => null);
      if (user) {
        await user.send({
          embeds: [{
            color: 0xef4444,
            title: '❌ تم إزالة رتبتك العسكرية',
            description:
              `تم **ترميجك** من الشرطة العسكرية.\n\n` +
              `📛 **الاسم السابق:** ${name}\n` +
              `🆔 **الرقم السابق:** \`${militaryId}\`\n` +
              `📝 **السبب:** ${reason}\n\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
              `⚠️ **جميع شهاداتك تم إبطالها**\n` +
              `⚠️ **أنت الآن عسكري عادي**`,
            footer: { text: 'Military Police — Ministry of Defense' },
            timestamp: new Date().toISOString()
          }]
        }).catch(() => {});
      }
    } catch (dmErr) {
      console.warn('[performTerminate] DM termination failed:', dmErr.message);
    }

    /* ─── 11. تحديث اللوحة المتزامنة ─── */
    await refreshSynchronizedPanel(client);

    result.success = true;
    return result;

  } catch (err) {
    console.error('[performTerminate]', err);
    result.error = err.message;
    return result;
  }
}

/* ═══════════════════════════════════════════════════════════
 *              ✨ 6. تغيير اسم (موحّد)
 *  ═══════════════════════════════════════════════════════════ */

/**
 * تغيير اسم عضو — نفس السلوك من الزر أو يدوياً
 *
 * @param {Client} client
 * @param {string} targetUserId
 * @param {string} newName
 * @param {string} reason
 * @param {string} byUserId
 * @param {string} source - 'manual' | 'panel'
 * @returns {Object}
 */
async function performNameChange(client, targetUserId, newName, reason, byUserId = 'System', source = 'panel') {
  const result = {
    success: false,
    oldName: null,
    newName: null,
    deletedFromLog: 0,
    deletedFromDM: 0,
    error: null
  };

  try {
    /* ─── 1. جلب بيانات العضو ─── */
    const memberData = await firebase.getMember(targetUserId);
    if (!memberData) {
      result.error = 'العضو غير موجود في Firebase';
      return result;
    }

    const oldName = memberData.nameOriginal || memberData.name || 'Unknown';
    result.oldName = oldName;
    result.newName = newName;

    /* ─── 2. تنظيف الاسم ─── */
    const cleanName = CONFIG.sanitizeName(newName);
    if (!cleanName || cleanName.length < CONFIG.NAME.MIN_NAME_LENGTH) {
      result.error = `الاسم قصير جداً (الحد الأدنى ${CONFIG.NAME.MIN_NAME_LENGTH})`;
      return result;
    }

    /* ─── 3. جلب الشهادات النشطة قبل التحديث ─── */
    const activeCerts = await firebase.getActiveCertificates(targetUserId);

    /* ─── 4. حذف رسائل الشهادات القديمة ─── */
    const deleteResult = await deleteAllCertificateMessages(client, targetUserId, activeCerts);
    result.deletedFromLog = deleteResult.fromLog;
    result.deletedFromDM = deleteResult.fromDM;

    /* ─── 5. تحديث Firebase ─── */
    const fullName = CONFIG.buildFullName(memberData.militaryId, cleanName);

    await firebase.updateMember(targetUserId, {
      name: cleanName,
      nameOriginal: cleanName,
      nickname: fullName
    });

    /* ─── 6. تحديث Discord ─── */
    const guild = await client.guilds.fetch(CONFIG.GUILD_ID).catch(() => null);
    const guildMember = guild ? await guild.members.fetch(targetUserId).catch(() => null) : null;

    if (guildMember) {
      await guildMember.setNickname(fullName, 'تغيير الاسم').catch(() => {});
    }

    /* ─── 7. إعادة إصدار الشهادة (تُرسل DM + لوق) ─── */
    await certificates.reissueCertificateOnUpdate(
      client,
      targetUserId,
      { name: cleanName },
      'name_change',
      byUserId === 'System' ? 'النظام' : byUserId
    );

    /* ─── 8. لوق تغيير الاسم ─── */
    await logger.logNameChanged(client, {
      discordId: targetUserId,
      oldName,
      newName: cleanName,
      by: byUserId === 'System' ? 'النظام' : byUserId
    }).catch(() => {});

    /* ─── 9. DM للعضو ─── */
    try {
      const user = await client.users.fetch(targetUserId).catch(() => null);
      if (user) {
        await user.send({
          embeds: [{
            color: CONFIG.COLORS.INFO,
            title: '✏️ تم تحديث اسمك',
            description:
              `📛 **الاسم القديم:** \`${oldName}\`\n` +
              `✨ **الاسم الجديد:** \`${cleanName}\`\n` +
              `📝 **السبب:** ${reason || 'غير محدد'}\n` +
              `👤 **بواسطة:** ${byUserId === 'System' ? 'النظام' : `<@${byUserId}>`}`,
            footer: { text: 'Military Police — Ministry of Defense' },
            timestamp: new Date().toISOString()
          }]
        }).catch(() => {});
      }
    } catch (dmErr) {
      console.warn('[performNameChange] DM failed:', dmErr.message);
    }

    /* ─── 10. تحديث اللوحة المتزامنة ─── */
    await refreshSynchronizedPanel(client);

    result.success = true;
    return result;

  } catch (err) {
    console.error('[performNameChange]', err);
    result.error = err.message;
    return result;
  }
}

/* ═══════════════════════════════════════════════════════════
 *              ✨ 7. إضافة عضو (موحّد)
 *  ═══════════════════════════════════════════════════════════ */

/**
 * إضافة عضو جديد — نفس السلوك من الزر أو يدوياً
 *
 * @param {Client} client
 * @param {string} targetUserId
 * @param {string} name - اسم العضو
 * @param {string} roleId - الرتبة
 * @param {string} reason - السبب
 * @param {string} byUserId
 * @param {string} source - 'manual' | 'panel'
 * @returns {Object}
 */
async function performAddMember(client, targetUserId, name, roleId, reason, byUserId = 'System', source = 'panel') {
  const result = {
    success: false,
    militaryId: null,
    fullName: null,
    wasExisting: false,
    error: null
  };

  try {
    /* ─── 1. التحقق: هل العضو موجود بالفعل؟ ─── */
    const existing = await firebase.getMember(targetUserId);

    if (existing) {
      console.log(`[performAddMember] العضو موجود — تحديث`);

      /* تحديث الرتبة فقط */
      if (existing.roleId !== roleId) {
        await firebase.updateMember(targetUserId, { roleId });
      }

      /* تأكد من وجود شهادة نشطة */
      const activeCerts = await firebase.getActiveCertificates(targetUserId);
      if (activeCerts.length === 0) {
        await certificates.issueCertificate(client, {
          discordId: targetUserId,
          name: existing.nameOriginal || existing.name,
          militaryId: existing.militaryId,
          roleName: CONFIG.getRoleNameEnglish(roleId),
          roleNameAr: CONFIG.getRoleNameArabic(roleId),
          roleId,
          issuedBy: byUserId,
          supersede: false,
          sendDM: true,
          logToChannel: true
        });
      }

      result.wasExisting = true;
      result.militaryId = existing.militaryId;
      result.success = true;

      await refreshSynchronizedPanel(client);
      return result;
    }

    /* ─── 2. التحقق من Rرتبة REJECTED ─── */
    const guild = await client.guilds.fetch(CONFIG.GUILD_ID).catch(() => null);
    if (!guild) {
      result.error = 'السيرفر غير موجود';
      return result;
    }

    const guildMember = await guild.members.fetch(targetUserId).catch(() => null);
    if (!guildMember) {
      result.error = 'العضو غير موجود في السيرفر';
      return result;
    }

    if (guildMember.roles.cache.has(CONFIG.ROLES.REJECTED)) {
      result.error = 'لا يمكن إضافة شخص يحمل رتبة REJECTED — يجب إزالة الرفض أولاً';
      return result;
    }

    /* ─── 3. تنظيف الاسم ─── */
    const cleanName = CONFIG.sanitizeName(name);
    if (!cleanName || cleanName.length < CONFIG.NAME.MIN_NAME_LENGTH) {
      result.error = `الاسم قصير جداً (الحد الأدنى ${CONFIG.NAME.MIN_NAME_LENGTH})`;
      return result;
    }

    /* ─── 4. إضافة في Firebase ─── */
    const addResult = await firebase.addMember(targetUserId, {
      name: cleanName,
      roleId
    });

    if (!addResult.success) {
      result.error = 'فشل الإضافة في Firebase';
      return result;
    }

    result.militaryId = addResult.militaryId;
    result.fullName = addResult.fullName;

    /* ─── 5. إعطاء الرتبة + تغيير الاسم ─── */
    await guildMember.roles.add(roleId, `إضافة بواسطة ${byUserId}`).catch(() => {});
    await guildMember.setNickname(addResult.fullName, 'إضافة عضو').catch(() => {});

    /* ─── 6. إصدار شهادة (ذهبية — DM + لوق) ─── */
    await certificates.issueCertificate(client, {
      discordId: targetUserId,
      name: cleanName,
      militaryId: addResult.militaryId,
      roleName: CONFIG.getRoleNameEnglish(roleId),
      roleNameAr: CONFIG.getRoleNameArabic(roleId),
      roleId,
      issuedBy: byUserId,
      supersede: false,
      sendDM: true,
      logToChannel: true
    });

    /* ─── 7. لوق الإضافة ─── */
    await logger.logMemberAdded(client, {
      discordId: targetUserId,
      name: cleanName,
      militaryId: addResult.militaryId,
      roleId,
      by: byUserId === 'System' ? 'النظام' : byUserId,
      reason: reason || '—'
    }).catch(() => {});

    /* ─── 8. تحديث اللوحة المتزامنة ─── */
    await refreshSynchronizedPanel(client);

    result.success = true;
    return result;

  } catch (err) {
    console.error('[performAddMember]', err);
    result.error = err.message;
    return result;
  }
}

/* ═══════════════════════════════════════════════════════════
 *                    التصدير
 *  ═══════════════════════════════════════════════════════════ */

module.exports = {
  /* دوال موحدة */
  performTerminate,
  performNameChange,
  performAddMember,

  /* دوال مساعدة */
  refreshSynchronizedPanel,
  deleteCertificateMessageFromLog,
  deleteCertificateMessageFromDM,
  deleteAllCertificateMessages
};