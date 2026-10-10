/* ═══════════════════════════════════════════════════════════
 *  الشرطة العسكرية | وزارة الدفاع الأمريكي
 *  وحدة Firebase للبوت — Firebase.js
 *  الإصدار: 1.1 (إضافة دوال الشهادات)
 *  ═══════════════════════════════════════════════════════════ */

'use strict';

const CONFIG = require('./config');
const { initializeApp, getApps, getApp } = require('firebase/app');
const {
  getDatabase, ref, set, get, update, remove, push,
  query, orderByChild, equalTo, onValue
} = require('firebase/database');

/* ═══════════════════════════════════════════════════════════
 *                    التهيئة
 *  ═══════════════════════════════════════════════════════════ */
const firebaseApp = getApps().length ? getApp() : initializeApp(CONFIG.FIREBASE);
const db = getDatabase(firebaseApp);

/* ═══════════════════════════════════════════════════════════
 *                    التقديمات (Applications)
 *  ═══════════════════════════════════════════════════════════ */

/**
 * جلب تقديم بواسطة ID
 */
async function getApplication(applicationId) {
  try {
    const snap = await get(ref(db, `applications/${applicationId}`));
    if (!snap.exists()) return null;
    return { id: applicationId, ...snap.val() };
  } catch (err) {
    console.error('[getApplication]', err.message);
    return null;
  }
}

/**
 * تحديث تقديم
 */
async function updateApplication(applicationId, updates) {
  try {
    await update(ref(db, `applications/${applicationId}`), {
      ...updates,
      updatedAt: Date.now()
    });
    return { success: true };
  } catch (err) {
    console.error('[updateApplication]', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * حذف تقديم
 */
async function deleteApplication(applicationId) {
  try {
    await remove(ref(db, `applications/${applicationId}`));
    return { success: true };
  } catch (err) {
    console.error('[deleteApplication]', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * البحث عن تقديم بواسطة Discord ID
 */
async function findApplicationByDiscordId(discordId) {
  try {
    const applicationsRef = ref(db, 'applications');
    const q = query(applicationsRef, orderByChild('discordId'), equalTo(discordId));
    const snap = await get(q);
    if (!snap.exists()) return [];
    const result = [];
    snap.forEach(child => {
      result.push({ id: child.key, ...child.val() });
    });
    return result;
  } catch (err) {
    console.error('[findApplicationByDiscordId]', err.message);
    return [];
  }
}

/* ═══════════════════════════════════════════════════════════
 *                    حالة التوظيف (Recruitment)
 *  ═══════════════════════════════════════════════════════════ */

async function getRecruitmentStatus() {
  try {
    const snap = await get(ref(db, 'recruitment/status'));
    if (!snap.exists()) {
      await set(ref(db, 'recruitment/status'), { open: true, updatedAt: Date.now() });
      return { open: true };
    }
    return snap.val();
  } catch (err) {
    console.error('[getRecruitmentStatus]', err.message);
    return { open: true };
  }
}

async function setRecruitmentStatus(open) {
  try {
    await set(ref(db, 'recruitment/status'), {
      open: open === true,
      updatedAt: Date.now(),
      updatedAtISO: new Date().toISOString()
    });
    return { success: true, open };
  } catch (err) {
    console.error('[setRecruitmentStatus]', err.message);
    return { success: false, error: err.message };
  }
}

/* ═══════════════════════════════════════════════════════════
 *                    الأعضاء (Members)
 *  ═══════════════════════════════════════════════════════════ */

/**
 * جلب الرقم العسكري التالي المتاح
 */
async function getNextMilitaryId() {
  try {
    const snap = await get(ref(db, 'members'));
    if (!snap.exists()) return CONFIG.formatMilitaryId(CONFIG.MILITARY_ID.START_NUMBER);

    const numbers = [];
    snap.forEach(child => {
      const id = child.val().militaryId;
      const num = CONFIG.parseMilitaryId(id);
      if (num >= CONFIG.MILITARY_ID.START_NUMBER) numbers.push(num);
    });

    if (numbers.length === 0) return CONFIG.formatMilitaryId(CONFIG.MILITARY_ID.START_NUMBER);
    return CONFIG.formatMilitaryId(Math.max(...numbers) + 1);
  } catch (err) {
    console.error('[getNextMilitaryId]', err.message);
    return CONFIG.formatMilitaryId(CONFIG.MILITARY_ID.START_NUMBER);
  }
}

/**
 * إضافة عضو جديد
 */
async function addMember(discordId, data) {
  try {
    const { roleId, name, ...rest } = data;

    let militaryId = CONFIG.getMilitaryIdForRole(roleId);
    if (!militaryId) {
      militaryId = await getNextMilitaryId();
    }

    const fullName = CONFIG.buildFullName(militaryId, name);

    await set(ref(db, `members/${discordId}`), {
      ...rest,
      discordId,
      name: name || 'Unknown',
      nameOriginal: name || 'Unknown',
      nickname: fullName,
      roleId: roleId || null,
      militaryId,
      points: 0,
      joinedAt: Date.now(),
      joinedAtISO: new Date().toISOString()
    });

    return { success: true, militaryId, fullName };
  } catch (err) {
    console.error('[addMember]', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * جلب عضو
 */
async function getMember(discordId) {
  try {
    const snap = await get(ref(db, `members/${discordId}`));
    if (!snap.exists()) return null;
    return { discordId, ...snap.val() };
  } catch (err) {
    console.error('[getMember]', err.message);
    return null;
  }
}

/**
 * جلب جميع الأعضاء مرتبين حسب الرقم
 */
async function getAllMembers() {
  try {
    const snap = await get(ref(db, 'members'));
    if (!snap.exists()) return [];
    const members = [];
    snap.forEach(child => {
      members.push({ discordId: child.key, ...child.val() });
    });
    members.sort((a, b) => CONFIG.parseMilitaryId(a.militaryId) - CONFIG.parseMilitaryId(b.militaryId));
    return members;
  } catch (err) {
    console.error('[getAllMembers]', err.message);
    return [];
  }
}

/**
 * تحديث بيانات عضو
 */
async function updateMember(discordId, updates) {
  try {
    await update(ref(db, `members/${discordId}`), {
      ...updates,
      lastUpdate: Date.now()
    });
    return { success: true };
  } catch (err) {
    console.error('[updateMember]', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * حذف عضو (ترميج)
 */
async function removeMember(discordId) {
  try {
    const memberSnap = await get(ref(db, `members/${discordId}`));
    const removedMember = memberSnap.exists()
      ? { discordId, ...memberSnap.val() }
      : null;

    await remove(ref(db, `members/${discordId}`));

    const reorderResult = await reorderMilitaryIds();

    return {
      success: true,
      removed: removedMember,
      changes: reorderResult.changes || []
    };
  } catch (err) {
    console.error('[removeMember]', err.message);
    return { success: false, error: err.message, removed: null, changes: [] };
  }
}

/**
 * إعادة ترتيب الأرقام العسكرية
 */
async function reorderMilitaryIds() {
  try {
    const membersSnap = await get(ref(db, 'members'));
    if (!membersSnap.exists()) return { success: true, changes: [] };

    const members = [];
    membersSnap.forEach(child => {
      members.push({ discordId: child.key, ...child.val() });
    });

    const regularMembers = members.filter(m => !CONFIG.isCommandRole(m.roleId));
    regularMembers.sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));

    const changes = [];
    let counter = CONFIG.MILITARY_ID.START_NUMBER;

    for (const member of regularMembers) {
      const newId = CONFIG.formatMilitaryId(counter);
      const oldId = member.militaryId || 'غير محدد';

      if (oldId !== newId) {
        const nameBase = member.nameOriginal || member.name || 'Unknown';
        const newFullName = CONFIG.buildFullName(newId, nameBase);

        await update(ref(db, `members/${member.discordId}`), {
          militaryId: newId,
          nickname: newFullName,
          lastReorderedAt: Date.now()
        });

        changes.push({
          discordId: member.discordId,
          oldId,
          newId,
          oldNickname: member.nickname || '',
          newNickname: newFullName,
          name: nameBase,
          roleId: member.roleId,
          memberData: {
            discordId: member.discordId,
            name: nameBase,
            roleId: member.roleId
          }
        });
      }
      counter++;
    }

    return { success: true, changes };
  } catch (err) {
    console.error('[reorderMilitaryIds]', err.message);
    return { success: false, error: err.message, changes: [] };
  }
}

/* ═══════════════════════════════════════════════════════════
 *                    النقاط (Points)
 *  ═══════════════════════════════════════════════════════════ */

/**
 * إضافة نقاط لعضو
 */
async function addPoints(discordId, points, reason, by) {
  try {
    const member = await getMember(discordId);
    if (!member) return { success: false, error: 'العضو غير موجود' };

    const oldPoints = member.points || 0;
    const newPoints = oldPoints + points;

    await update(ref(db, `members/${discordId}`), {
      points: newPoints,
      lastPointsUpdate: Date.now()
    });

    await logPointsAction({
      type: 'add',
      discordId,
      name: member.name,
      militaryId: member.militaryId,
      points,
      oldPoints,
      newPoints,
      reason,
      by,
      timestamp: Date.now()
    });

    return { success: true, oldPoints, newPoints, added: points, reason };
  } catch (err) {
    console.error('[addPoints]', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * خصم نقاط من عضو
 */
async function removePoints(discordId, points, reason, by) {
  try {
    const member = await getMember(discordId);
    if (!member) return { success: false, error: 'العضو غير موجود' };

    const oldPoints = member.points || 0;
    const newPoints = Math.max(0, oldPoints - points);

    await update(ref(db, `members/${discordId}`), {
      points: newPoints,
      lastPointsUpdate: Date.now()
    });

    await logPointsAction({
      type: 'deduct',
      discordId,
      name: member.name,
      militaryId: member.militaryId,
      points,
      oldPoints,
      newPoints,
      reason,
      by,
      timestamp: Date.now()
    });

    return { success: true, oldPoints, newPoints, deducted: points, reason };
  } catch (err) {
    console.error('[removePoints]', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * حفظ عملية نقاط في السجل
 */
async function logPointsAction(data) {
  try {
    const logsRef = ref(db, `logs/points/${data.discordId}`);
    const newLogRef = push(logsRef);
    await set(newLogRef, data);
    return { success: true };
  } catch (err) {
    console.error('[logPointsAction]', err.message);
    return { success: false };
  }
}

/* ═══════════════════════════════════════════════════════════
 *                    التقارير (Reports)
 *  ═══════════════════════════════════════════════════════════ */

async function saveReport(reportId, data) {
  try {
    await set(ref(db, `reports/${reportId}`), {
      ...data,
      createdAt: Date.now(),
      createdAtISO: new Date().toISOString(),
      status: 'pending'
    });
    return { success: true, reportId };
  } catch (err) {
    console.error('[saveReport]', err.message);
    return { success: false, error: err.message };
  }
}

async function getReport(reportId) {
  try {
    const snap = await get(ref(db, `reports/${reportId}`));
    if (!snap.exists()) return null;
    return { id: reportId, ...snap.val() };
  } catch (err) {
    console.error('[getReport]', err.message);
    return null;
  }
}

async function approveReport(reportId, approvedBy) {
  try {
    await update(ref(db, `reports/${reportId}`), {
      status: 'approved',
      approvedBy,
      approvedAt: Date.now()
    });
    return { success: true };
  } catch (err) {
    console.error('[approveReport]', err.message);
    return { success: false, error: err.message };
  }
}

async function rejectReport(reportId, reason, rejectedBy) {
  try {
    await update(ref(db, `reports/${reportId}`), {
      status: 'rejected',
      rejectReason: reason || 'غير محدد',
      rejectedBy,
      rejectedAt: Date.now()
    });
    return { success: true };
  } catch (err) {
    console.error('[rejectReport]', err.message);
    return { success: false, error: err.message };
  }
}

/* ═══════════════════════════════════════════════════════════
 *                    التذاكر (Tickets)
 *  ═══════════════════════════════════════════════════════════ */

async function saveTicket(ticketId, data) {
  try {
    await set(ref(db, `tickets/${ticketId}`), {
      ...data,
      createdAt: Date.now(),
      createdAtISO: new Date().toISOString(),
      status: 'open'
    });
    return { success: true, ticketId };
  } catch (err) {
    console.error('[saveTicket]', err.message);
    return { success: false, error: err.message };
  }
}

async function getTicket(ticketId) {
  try {
    const snap = await get(ref(db, `tickets/${ticketId}`));
    if (!snap.exists()) return null;
    return { id: ticketId, ...snap.val() };
  } catch (err) {
    console.error('[getTicket]', err.message);
    return null;
  }
}

async function updateTicket(ticketId, updates) {
  try {
    await update(ref(db, `tickets/${ticketId}`), {
      ...updates,
      updatedAt: Date.now()
    });
    return { success: true };
  } catch (err) {
    console.error('[updateTicket]', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * أرشفة تذكرة
 */
async function archiveTicket(ticketId, transcript) {
  try {
    await set(ref(db, `tickets_archive/${ticketId}`), {
      ...transcript,
      archivedAt: Date.now(),
      archivedAtISO: new Date().toISOString()
    });
    await remove(ref(db, `tickets/${ticketId}`));
    return { success: true, archiveId: ticketId };
  } catch (err) {
    console.error('[archiveTicket]', err.message);
    return { success: false, error: err.message };
  }
}

/* ═══════════════════════════════════════════════════════════
 *                    السجلات (Logs)
 *  ═══════════════════════════════════════════════════════════ */

async function saveLog(eventType, data) {
  try {
    const logsRef = ref(db, `logs/${eventType}`);
    const newLogRef = push(logsRef);
    await set(newLogRef, {
      ...data,
      timestamp: Date.now(),
      timestampISO: new Date().toISOString()
    });
    return { success: true, logId: newLogRef.key };
  } catch (err) {
    console.error('[saveLog]', err.message);
    return { success: false, error: err.message };
  }
}

/* ═══════════════════════════════════════════════════════════
 *                    اللوحات (Panels)
 *  ═══════════════════════════════════════════════════════════ */

async function savePanelLocation(panelType, channelId, messageId) {
  try {
    await set(ref(db, `panels/${panelType}`), {
      channelId,
      messageId,
      updatedAt: Date.now()
    });
    return { success: true };
  } catch (err) {
    console.error('[savePanelLocation]', err.message);
    return { success: false, error: err.message };
  }
}

async function getPanelLocation(panelType) {
  try {
    const snap = await get(ref(db, `panels/${panelType}`));
    if (!snap.exists()) return null;
    return snap.val();
  } catch (err) {
    console.error('[getPanelLocation]', err.message);
    return null;
  }
}

/* ═══════════════════════════════════════════════════════════
 *              ✨ الشهادات (Certificates) — جديد
 *  ═══════════════════════════════════════════════════════════ */

/**
 * حفظ شهادة جديدة
 */
async function saveCertificate(discordId, certificateData) {
  try {
    const {
      certificateNumber, militaryId, name, roleName, roleId, issuedBy
    } = certificateData;

    if (!certificateNumber) {
      return { success: false, error: 'رقم الشهادة مطلوب' };
    }

    await set(ref(db, `certificates/${discordId}/${certificateNumber}`), {
      certificateNumber,
      discordId,
      militaryId: militaryId || null,
      name: name || 'Unknown',
      roleName: roleName || 'Unknown',
      roleId: roleId || null,
      issuedBy: issuedBy || 'System',
      status: 'active',
      issuedAt: Date.now(),
      issuedAtISO: new Date().toISOString()
    });

    return { success: true, certificateNumber };
  } catch (err) {
    console.error('[saveCertificate]', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * جلب جميع شهادات عضو
 */
async function getMemberCertificates(discordId) {
  try {
    const snap = await get(ref(db, `certificates/${discordId}`));
    if (!snap.exists()) return [];
    const certs = [];
    snap.forEach(child => {
      certs.push({ certificateNumber: child.key, ...child.val() });
    });
    certs.sort((a, b) => (b.issuedAt || 0) - (a.issuedAt || 0));
    return certs;
  } catch (err) {
    console.error('[getMemberCertificates]', err.message);
    return [];
  }
}

/**
 * جلب الشهادات النشطة فقط
 */
async function getActiveCertificates(discordId) {
  try {
    const all = await getMemberCertificates(discordId);
    return all.filter(c => c.status === 'active');
  } catch (err) {
    console.error('[getActiveCertificates]', err.message);
    return [];
  }
}

/**
 * تعطيل شهادة واحدة
 */
async function invalidateCertificate(discordId, certificateNumber, reason = 'unknown', supersededBy = null) {
  try {
    const updates = {
      status: supersededBy ? 'superseded' : 'invalidated',
      invalidatedAt: Date.now(),
      invalidatedAtISO: new Date().toISOString(),
      invalidatedReason: reason
    };

    if (supersededBy) updates.supersededBy = supersededBy;

    await update(ref(db, `certificates/${discordId}/${certificateNumber}`), updates);
    return { success: true };
  } catch (err) {
    console.error('[invalidateCertificate]', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * تعطيل جميع شهادات عضو (للترميج)
 */
async function invalidateAllCertificates(discordId, reason = 'termination') {
  try {
    const certs = await getMemberCertificates(discordId);
    const results = [];

    for (const cert of certs) {
      if (cert.status === 'active') {
        const result = await invalidateCertificate(discordId, cert.certificateNumber, reason);
        results.push({ certificateNumber: cert.certificateNumber, ...result });
      }
    }

    return { success: true, invalidatedCount: results.length, results };
  } catch (err) {
    console.error('[invalidateAllCertificates]', err.message);
    return { success: false, error: err.message, invalidatedCount: 0 };
  }
}

/**
 * استبدال الشهادات القديمة
 */
async function supersedeCertificates(discordId, newCertificateNumber) {
  try {
    const certs = await getActiveCertificates(discordId);
    const results = [];

    for (const cert of certs) {
      const result = await invalidateCertificate(
        discordId,
        cert.certificateNumber,
        'reordered',
        newCertificateNumber
      );
      results.push({ certificateNumber: cert.certificateNumber, ...result });
    }

    return { success: true, supersededCount: results.length, results };
  } catch (err) {
    console.error('[supersedeCertificates]', err.message);
    return { success: false, error: err.message, supersededCount: 0 };
  }
}

/* ═══════════════════════════════════════════════════════════
 *                    المراقبة (Monitor)
 *  ═══════════════════════════════════════════════════════════ */

async function saveMonitorSession(sessionId, data) {
  try {
    await set(ref(db, `monitor/${sessionId}`), {
      ...data,
      startedAt: Date.now(),
      status: 'active'
    });
    return { success: true };
  } catch (err) {
    console.error('[saveMonitorSession]', err.message);
    return { success: false, error: err.message };
  }
}

async function removeMonitorSession(sessionId) {
  try {
    await remove(ref(db, `monitor/${sessionId}`));
    return { success: true };
  } catch (err) {
    console.error('[removeMonitorSession]', err.message);
    return { success: false, error: err.message };
  }
}

/* ═══════════════════════════════════════════════════════════
 *                    بوت الدعم (Support)
 *  ═══════════════════════════════════════════════════════════ */

async function saveSupportSession(sessionId, data) {
  try {
    await set(ref(db, `support/${sessionId}`), {
      ...data,
      startedAt: Date.now(),
      status: 'active'
    });
    return { success: true };
  } catch (err) {
    console.error('[saveSupportSession]', err.message);
    return { success: false, error: err.message };
  }
}

async function removeSupportSession(sessionId) {
  try {
    await remove(ref(db, `support/${sessionId}`));
    return { success: true };
  } catch (err) {
    console.error('[removeSupportSession]', err.message);
    return { success: false, error: err.message };
  }
}

/* ═══════════════════════════════════════════════════════════
 *                    التصدير
 *  ═══════════════════════════════════════════════════════════ */

module.exports = {
  /* Firebase Core */
  db, ref, set, get, update, remove, push, query, orderByChild, equalTo, onValue,

  /* التقديمات */
  getApplication, updateApplication, deleteApplication, findApplicationByDiscordId,

  /* التوظيف */
  getRecruitmentStatus, setRecruitmentStatus,

  /* الأعضاء */
  getNextMilitaryId, addMember, getMember, getAllMembers,
  updateMember, removeMember, reorderMilitaryIds,

  /* النقاط */
  addPoints, removePoints,

  /* التقارير */
  saveReport, getReport, approveReport, rejectReport,

  /* التذاكر */
  saveTicket, getTicket, updateTicket, archiveTicket,

  /* السجلات */
  saveLog,

  /* اللوحات */
  savePanelLocation, getPanelLocation,

  /* ✨ الشهادات (جديد) */
  saveCertificate,
  getMemberCertificates,
  getActiveCertificates,
  invalidateCertificate,
  invalidateAllCertificates,
  supersedeCertificates,

  /* المراقبة */
  saveMonitorSession, removeMonitorSession,

  /* الدعم */
  saveSupportSession, removeSupportSession
};