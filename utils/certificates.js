/* ═══════════════════════════════════════════════════════════
 *  الشرطة العسكرية | وزارة الدفاع الأمريكي
 *  أداة شهادات التعيين — Certificates.js
 *  الإصدار: 2.0 (تتبع + إبطال + إعادة إصدار + ترقية قيادية)
 *  ═══════════════════════════════════════════════════════════ */

'use strict';

const { createCanvas, loadImage } = require('@napi-rs/canvas');
const { AttachmentBuilder, EmbedBuilder } = require('discord.js');
const CONFIG = require('../config');

const CERT = {
  WIDTH: 1200,
  HEIGHT: 700,
  COLORS: {
    BG_GRADIENT_1: '#0a1428',
    BG_GRADIENT_2: '#142b52',
    BORDER_OUTER: '#d4af37',
    BORDER_INNER: '#3b82f6',
    TEXT_PRIMARY: '#ffffff',
    TEXT_SECONDARY: '#cbd5e1',
    TEXT_MUTED: '#94a3b8',
    TEXT_GOLD: '#d4af37',
    TEXT_BLUE: '#3b82f6',
    TEXT_GREEN: '#10b981',
    ACCENT_RED: '#ef4444'
  }
};

/* ═══════════════════════════════════════════════════════════
 *                    دوال الرسم
 *  ═══════════════════════════════════════════════════════════ */

function drawRoundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawStar(ctx, cx, cy, spikes, outerRadius, innerRadius) {
  let rot = Math.PI / 2 * 3;
  const step = Math.PI / spikes;
  ctx.beginPath();
  ctx.moveTo(cx, cy - outerRadius);
  for (let i = 0; i < spikes; i++) {
    ctx.lineTo(cx + Math.cos(rot) * outerRadius, cy + Math.sin(rot) * outerRadius);
    rot += step;
    ctx.lineTo(cx + Math.cos(rot) * innerRadius, cy + Math.sin(rot) * innerRadius);
    rot += step;
  }
  ctx.lineTo(cx, cy - outerRadius);
  ctx.closePath();
}

/* ═══════════════════════════════════════════════════════════
 *                    توليد رقم الشهادة
 *  ═══════════════════════════════════════════════════════════ */

function generateCertificateNumber(militaryId) {
  const year = new Date().getFullYear();
  const cleanId = String(militaryId || 'M-00').replace('M-', 'M');
  const random = Math.floor(1000 + Math.random() * 9000);
  return `MP-CERT-${year}-${cleanId}-${random}`;
}

/* ═══════════════════════════════════════════════════════════
 *                    توليد الشهادة
 *  ═══════════════════════════════════════════════════════════ */

async function generateCertificate(data) {
  const {
    name = 'Unknown',
    militaryId = 'M-00',
    roleName = 'Military Police Trainee',
    roleNameAr = 'متدرب الشرطة العسكرية',
    certificateNumber = generateCertificateNumber(militaryId),
    joinDate = new Date().toLocaleDateString('en-GB'),
    logoPath = null
  } = data;

  const canvas = createCanvas(CERT.WIDTH, CERT.HEIGHT);
  const ctx = canvas.getContext('2d');

  const bgGradient = ctx.createLinearGradient(0, 0, CERT.WIDTH, CERT.HEIGHT);
  bgGradient.addColorStop(0, CERT.COLORS.BG_GRADIENT_1);
  bgGradient.addColorStop(0.5, '#0f1d3a');
  bgGradient.addColorStop(1, CERT.COLORS.BG_GRADIENT_2);
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, CERT.WIDTH, CERT.HEIGHT);

  ctx.strokeStyle = 'rgba(59, 130, 246, 0.08)';
  ctx.lineWidth = 1;
  for (let x = 0; x < CERT.WIDTH; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CERT.HEIGHT); ctx.stroke();
  }
  for (let y = 0; y < CERT.HEIGHT; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CERT.WIDTH, y); ctx.stroke();
  }

  const glowGradient = ctx.createRadialGradient(
    CERT.WIDTH / 2, CERT.HEIGHT / 2, 0,
    CERT.WIDTH / 2, CERT.HEIGHT / 2, CERT.WIDTH / 2
  );
  glowGradient.addColorStop(0, 'rgba(59, 130, 246, 0.12)');
  glowGradient.addColorStop(0.5, 'rgba(212, 175, 55, 0.05)');
  glowGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glowGradient;
  ctx.fillRect(0, 0, CERT.WIDTH, CERT.HEIGHT);

  drawRoundedRect(ctx, 20, 20, CERT.WIDTH - 40, CERT.HEIGHT - 40, 20);
  ctx.strokeStyle = CERT.COLORS.BORDER_OUTER;
  ctx.lineWidth = 4;
  ctx.stroke();

  drawRoundedRect(ctx, 35, 35, CERT.WIDTH - 70, CERT.HEIGHT - 70, 15);
  ctx.strokeStyle = CERT.COLORS.BORDER_INNER;
  ctx.lineWidth = 2;
  ctx.stroke();

  const corners = [
    { x: 55, y: 55, rotation: 0 },
    { x: CERT.WIDTH - 55, y: 55, rotation: Math.PI / 2 },
    { x: CERT.WIDTH - 55, y: CERT.HEIGHT - 55, rotation: Math.PI },
    { x: 55, y: CERT.HEIGHT - 55, rotation: -Math.PI / 2 }
  ];
  corners.forEach(corner => {
    ctx.save();
    ctx.translate(corner.x, corner.y);
    ctx.rotate(corner.rotation);
    ctx.strokeStyle = CERT.COLORS.TEXT_GOLD;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, 30); ctx.lineTo(0, 0); ctx.lineTo(30, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(8, 22); ctx.lineTo(8, 8); ctx.lineTo(22, 8); ctx.stroke();
    ctx.restore();
  });

  ctx.textAlign = 'center';
  ctx.font = '700 14px "Orbitron", "Cairo", sans-serif';
  ctx.fillStyle = CERT.COLORS.TEXT_GOLD;
  ctx.fillText('M I N I S T R Y   O F   D E F E N S E', CERT.WIDTH / 2, 80);

  ctx.font = '600 18px "Cairo", sans-serif';
  ctx.fillStyle = CERT.COLORS.TEXT_SECONDARY;
  ctx.fillText('وزارة الدفاع الأمريكي', CERT.WIDTH / 2, 108);

  if (logoPath) {
    try {
      const logo = await loadImage(logoPath);
      const logoSize = 70;
      const logoX = CERT.WIDTH / 2 - logoSize / 2;
      const logoY = 130;
      ctx.beginPath();
      ctx.arc(CERT.WIDTH / 2, logoY + logoSize / 2, logoSize / 2 + 5, 0, Math.PI * 2);
      ctx.fillStyle = '#0a1428';
      ctx.fill();
      ctx.strokeStyle = CERT.COLORS.TEXT_GOLD;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.drawImage(logo, logoX, logoY, logoSize, logoSize);
    } catch (err) {
      console.warn('[generateCertificate] فشل تحميل اللوجو:', err.message);
    }
  }

  const lineY = 230;
  const lineGradient = ctx.createLinearGradient(200, lineY, CERT.WIDTH - 200, lineY);
  lineGradient.addColorStop(0, 'rgba(212, 175, 55, 0)');
  lineGradient.addColorStop(0.5, CERT.COLORS.TEXT_GOLD);
  lineGradient.addColorStop(1, 'rgba(212, 175, 55, 0)');
  ctx.strokeStyle = lineGradient;
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(200, lineY); ctx.lineTo(CERT.WIDTH - 200, lineY); ctx.stroke();

  drawStar(ctx, CERT.WIDTH / 2, lineY, 5, 10, 4);
  ctx.fillStyle = CERT.COLORS.TEXT_GOLD;
  ctx.fill();

  ctx.font = '900 42px "Cairo", sans-serif';
  ctx.fillStyle = CERT.COLORS.TEXT_GOLD;
  ctx.fillText('شهادة تعيين رسمية', CERT.WIDTH / 2, 290);

  ctx.font = '700 16px "Orbitron", "Cairo", sans-serif';
  ctx.fillStyle = CERT.COLORS.TEXT_BLUE;
  ctx.fillText('APPOINTMENT CERTIFICATE', CERT.WIDTH / 2, 318);

  ctx.font = '400 18px "Cairo", sans-serif';
  ctx.fillStyle = CERT.COLORS.TEXT_SECONDARY;
  ctx.fillText('تُمنح هذه الشهادة الرسمية إلى', CERT.WIDTH / 2, 365);

  ctx.font = '900 48px "Cairo", sans-serif';
  ctx.fillStyle = CERT.COLORS.TEXT_PRIMARY;
  ctx.shadowColor = CERT.COLORS.TEXT_BLUE;
  ctx.shadowBlur = 20;
  ctx.fillText(name, CERT.WIDTH / 2, 430);
  ctx.shadowBlur = 0;

  const nameLineGradient = ctx.createLinearGradient(300, 445, CERT.WIDTH - 300, 445);
  nameLineGradient.addColorStop(0, 'rgba(59, 130, 246, 0)');
  nameLineGradient.addColorStop(0.5, CERT.COLORS.TEXT_BLUE);
  nameLineGradient.addColorStop(1, 'rgba(59, 130, 246, 0)');
  ctx.strokeStyle = nameLineGradient;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(300, 445); ctx.lineTo(CERT.WIDTH - 300, 445); ctx.stroke();

  ctx.font = '400 16px "Cairo", sans-serif';
  ctx.fillStyle = CERT.COLORS.TEXT_SECONDARY;
  ctx.fillText('بمناسبة تعيينه رسمياً في سلك', CERT.WIDTH / 2, 480);

  ctx.font = '900 24px "Cairo", sans-serif';
  ctx.fillStyle = CERT.COLORS.TEXT_GOLD;
  ctx.fillText('الشرطة العسكرية — وزارة الدفاع الأمريكي', CERT.WIDTH / 2, 512);

  const dataY = 570;
  const colWidth = 280;
  const colStartX = (CERT.WIDTH - colWidth * 3) / 2;

  const dataItems = [
    { label: 'الرقم العسكري', value: militaryId, labelEn: 'MILITARY ID' },
    { label: 'الرتبة', value: roleName, labelEn: 'RANK' },
    { label: 'تاريخ التعيين', value: joinDate, labelEn: 'JOIN DATE' }
  ];

  dataItems.forEach((item, index) => {
    const x = colStartX + colWidth * index + colWidth / 2;
    drawRoundedRect(ctx, x - colWidth / 2 + 15, dataY - 20, colWidth - 30, 90, 10);
    ctx.fillStyle = 'rgba(10, 20, 40, 0.6)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.font = '700 10px "Orbitron", "Cairo", sans-serif';
    ctx.fillStyle = CERT.COLORS.TEXT_MUTED;
    ctx.fillText(item.labelEn, x, dataY);

    ctx.font = '600 13px "Cairo", sans-serif';
    ctx.fillStyle = CERT.COLORS.TEXT_SECONDARY;
    ctx.fillText(item.label, x, dataY + 20);

    ctx.font = '900 20px "Orbitron", "Cairo", sans-serif';
    ctx.fillStyle = CERT.COLORS.TEXT_GOLD;
    ctx.fillText(item.value, x, dataY + 52);
  });

  ctx.font = '600 11px "Orbitron", "Cairo", sans-serif';
  ctx.fillStyle = CERT.COLORS.TEXT_MUTED;
  ctx.fillText(`CERTIFICATE No: ${certificateNumber}`, CERT.WIDTH / 2, CERT.HEIGHT - 40);

  ctx.font = '700 11px "Orbitron", "Cairo", sans-serif';
  ctx.fillStyle = CERT.COLORS.TEXT_BLUE;
  ctx.fillText('MILITARY POLICE • OFFICIAL SEAL', CERT.WIDTH / 2, CERT.HEIGHT - 20);

  return canvas.toBuffer('image/png');
}

/* ═══════════════════════════════════════════════════════════
 *                    إرسال الشهادة DM
 *  ═══════════════════════════════════════════════════════════ */

async function sendCertificateDM(client, userId, data) {
  try {
    const user = await client.users.fetch(userId).catch(() => null);
    if (!user) {
      console.error('[sendCertificateDM] المستخدم غير موجود:', userId);
      return null;
    }

    const certNumber = data.certificateNumber || generateCertificateNumber(data.militaryId);
    const imageBuffer = await generateCertificate({ ...data, certificateNumber: certNumber });

    const attachment = new AttachmentBuilder(imageBuffer, {
      name: `Certificate_${data.militaryId}_${certNumber}.png`
    });

    const embed = new EmbedBuilder()
      .setColor(CONFIG.COLORS.GOLD)
      .setAuthor({
        name: 'وزارة الدفاع الأمريكي',
        iconURL: client.user.displayAvatarURL()
      })
      .setTitle(data.isReissue ? '🔄 شهادة تعيين محدّثة' : '🎖️ شهادة تعيين رسمية')
      .setDescription(
        `مرحباً **${data.name}**\n\n` +
        (data.isReissue
          ? 'تم إصدار **شهادة محدّثة** لك بعد تحديث بياناتك.\n\n'
          : 'يسرنا إبلاغك بأنه تم تعيينك رسمياً في سلك\n') +
        '**الشرطة العسكرية — وزارة الدفاع الأمريكي**\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
        '📎 **الشهادة الرسمية مرفقة بالأسفل**'
      )
      .addFields(
        { name: '🆔 الرقم العسكري', value: `\`${data.militaryId}\``, inline: true },
        { name: '🎖️ الرتبة', value: data.roleName || 'Military Police Trainee', inline: true },
        { name: '📅 التاريخ', value: data.joinDate || new Date().toLocaleDateString('en-GB'), inline: true },
        { name: '🔢 رقم الشهادة', value: `\`${certNumber}\``, inline: false }
      )
      .setImage(`attachment://${attachment.name}`)
      .setFooter({
        text: CONFIG.TEXT.FOOTER,
        iconURL: client.user.displayAvatarURL()
      })
      .setTimestamp(new Date());

    return await user.send({ embeds: [embed], files: [attachment] });

  } catch (err) {
    console.error('[sendCertificateDM] خطأ:', err.message);
    return null;
  }
}

async function sendCertificateToChannel(client, channelId, data) {
  try {
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel) return null;

    const certNumber = data.certificateNumber || generateCertificateNumber(data.militaryId);
    const imageBuffer = await generateCertificate({ ...data, certificateNumber: certNumber });

    const attachment = new AttachmentBuilder(imageBuffer, {
      name: `Certificate_${data.militaryId}.png`
    });

    const embed = new EmbedBuilder()
      .setColor(CONFIG.COLORS.GOLD)
      .setTitle('🎖️ شهادة تعيين جديدة')
      .setDescription(`تم تعيين **${data.name}** في سلك الشرطة العسكرية`)
      .addFields(
        { name: '🆔 الرقم', value: `\`${data.militaryId}\``, inline: true },
        { name: '🎖️ الرتبة', value: data.roleName || 'Trainee', inline: true }
      )
      .setImage(`attachment://${attachment.name}`)
      .setFooter({
        text: CONFIG.TEXT.FOOTER,
        iconURL: client.user.displayAvatarURL()
      })
      .setTimestamp(new Date());

    return await channel.send({ embeds: [embed], files: [attachment] });

  } catch (err) {
    console.error('[sendCertificateToChannel] خطأ:', err.message);
    return null;
  }
}

/* ═══════════════════════════════════════════════════════════
 *              الشهادات المتقدمة
 *  ═══════════════════════════════════════════════════════════ */

const firebase = require('../firebase');

async function issueCertificate(client, data, options = {}) {
  try {
    const {
      discordId, name, militaryId, roleName, roleNameAr, roleId,
      issuedBy = 'System', supersede = false, sendDM = true, logToChannel = true
    } = data;

    if (!discordId) return { success: false, error: 'discordId مطلوب' };
    if (!militaryId) return { success: false, error: 'militaryId مطلوب' };

    const certificateNumber = generateCertificateNumber(militaryId);

    let supersededInfo = null;
    if (supersede) {
      supersededInfo = await firebase.supersedeCertificates(discordId, certificateNumber);
    }

    const saveResult = await firebase.saveCertificate(discordId, {
      certificateNumber, militaryId, name, roleName, roleId, issuedBy
    });

    if (!saveResult.success) return { success: false, error: 'فشل حفظ الشهادة' };

    let dmSent = false;
    if (sendDM) {
      const dmResult = await sendCertificateDM(client, discordId, {
        name, militaryId, roleName, roleNameAr, certificateNumber,
        joinDate: new Date().toLocaleDateString('en-GB'),
        isReissue: supersede
      });
      dmSent = dmResult !== null;
    }

    let logged = false;
    if (logToChannel) {
      const logResult = await logCertificateToChannel(client, {
        certificateNumber, discordId, name, militaryId, roleName,
        issuedBy, supersededInfo, isReissue: supersede
      });
      logged = logResult !== null;
    }

    return { success: true, certificateNumber, dmSent, logged, supersededInfo };

  } catch (err) {
    console.error('[issueCertificate] خطأ:', err.message);
    return { success: false, error: err.message };
  }
}

async function logCertificateToChannel(client, data) {
  try {
    const channelId = CONFIG.CHANNELS.CERTIFICATE_LOG || '1557866857334313132';
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel) {
      console.warn('[logCertificateToChannel] القناة غير موجودة:', channelId);
      return null;
    }

    const imageBuffer = await generateCertificate({
      name: data.name,
      militaryId: data.militaryId,
      roleName: data.roleName,
      certificateNumber: data.certificateNumber,
      joinDate: new Date().toLocaleDateString('en-GB')
    });

    const attachment = new AttachmentBuilder(imageBuffer, {
      name: `Certificate_${data.militaryId}_${data.certificateNumber}.png`
    });

    const embed = new EmbedBuilder()
      .setColor(data.isReissue ? CONFIG.COLORS.WARNING : CONFIG.COLORS.GOLD)
      .setAuthor({
        name: 'سجل الشهادات — الشرطة العسكرية',
        iconURL: client.user.displayAvatarURL()
      })
      .setTitle(data.isReissue ? '🔄 إعادة إصدار شهادة' : '🎖️ إصدار شهادة جديدة')
      .setDescription(
        data.isReissue
          ? `تم إعادة إصدار شهادة **${data.name}** بعد تحديث بياناته`
          : `تم إصدار شهادة تعيين جديدة للعضو **${data.name}**`
      )
      .addFields(
        { name: '👤 العضو', value: `<@${data.discordId}>`, inline: true },
        { name: '🆔 الرقم العسكري', value: `\`${data.militaryId}\``, inline: true },
        { name: '🎖️ الرتبة', value: data.roleName, inline: true },
        { name: '🔢 رقم الشهادة', value: `\`${data.certificateNumber}\``, inline: true },
        { name: '✍️ أصدرها', value: data.issuedBy ? `<@${data.issuedBy}>` : 'النظام', inline: true },
        {
          name: '📌 نوع الإصدار',
          value: data.isReissue
            ? (data.reason ? `🔄 إعادة إصدار (${data.reason})` : '🔄 إعادة إصدار')
            : '✨ أول إصدار',
          inline: true
        }
      )
      .setImage(`attachment://${attachment.name}`)
      .setFooter({
        text: CONFIG.TEXT.FOOTER,
        iconURL: client.user.displayAvatarURL()
      })
      .setTimestamp(new Date());

    if (data.supersededInfo && data.supersededInfo.supersededCount > 0) {
      embed.addFields({
        name: '🔄 الشهادات القديمة',
        value: `تم تعطيل **${data.supersededInfo.supersededCount}** شهادة قديمة واستبدالها بهذه`,
        inline: false
      });
    }

    return await channel.send({ embeds: [embed], files: [attachment] });

  } catch (err) {
    console.error('[logCertificateToChannel] خطأ:', err.message);
    return null;
  }
}

async function logCertificateInvalidation(client, data) {
  try {
    const channelId = CONFIG.CHANNELS.CERTIFICATE_LOG || '1557866857334313132';
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel) return null;

    const embed = new EmbedBuilder()
      .setColor(CONFIG.COLORS.DANGER)
      .setAuthor({
        name: 'سجل الشهادات — الشرطة العسكرية',
        iconURL: client.user.displayAvatarURL()
      })
      .setTitle('❌ إبطال شهادة')
      .setDescription(`تم **إبطال** ${data.certificatesCount} شهادة للعضو **${data.name}**`)
      .addFields(
        { name: '👤 العضو', value: data.discordId ? `<@${data.discordId}>` : data.name, inline: true },
        { name: '🆔 الرقم العسكري السابق', value: `\`${data.militaryId || '—'}\``, inline: true },
        { name: '📌 السبب', value: data.reason === 'termination' ? '🗑️ ترميج' : data.reason, inline: true },
        { name: '📊 عدد الشهادات المُبطلة', value: `**${data.certificatesCount}**`, inline: false },
        { name: '👤 بواسطة', value: data.by ? `<@${data.by}>` : 'النظام', inline: true }
      )
      .setFooter({
        text: CONFIG.TEXT.FOOTER,
        iconURL: client.user.displayAvatarURL()
      })
      .setTimestamp(new Date());

    return await channel.send({ embeds: [embed] });

  } catch (err) {
    console.error('[logCertificateInvalidation] خطأ:', err.message);
    return null;
  }
}

async function reissueCertificateOnUpdate(client, discordId, updates, reason = 'update', issuedBy = 'System') {
  try {
    const member = await firebase.getMember(discordId);
    if (!member) return { success: false, error: 'العضو غير موجود' };

    const finalName = updates.name || member.nameOriginal || member.name || 'Unknown';
    const finalMilitaryId = updates.militaryId || member.militaryId;
    const finalRoleId = updates.roleId || member.roleId;

    const reasonMap = {
      'name_change': '✏️ تغيير اسم',
      'reorder': '🔄 تحديث رقم عسكري',
      'promotion': '⬆️ ترقية رتبة',
      'demotion': '⬇️ تخفيض رتبة',
      'update': '📝 تحديث بيانات'
    };
    const reasonText = reasonMap[reason] || reasonMap.update;

    const newCertificateNumber = generateCertificateNumber(finalMilitaryId);
    const supersededInfo = await firebase.supersedeCertificates(discordId, newCertificateNumber);

    const saveResult = await firebase.saveCertificate(discordId, {
      certificateNumber: newCertificateNumber,
      militaryId: finalMilitaryId,
      name: finalName,
      roleName: CONFIG.getRoleNameEnglish(finalRoleId),
      roleId: finalRoleId,
      issuedBy
    });

    if (!saveResult.success) return { success: false, error: 'فشل حفظ الشهادة' };

    const dmSent = await sendCertificateDM(client, discordId, {
      name: finalName,
      militaryId: finalMilitaryId,
      roleName: CONFIG.getRoleNameEnglish(finalRoleId),
      roleNameAr: CONFIG.getRoleNameArabic(finalRoleId),
      certificateNumber: newCertificateNumber,
      joinDate: new Date().toLocaleDateString('en-GB'),
      isReissue: true
    }).then(r => r !== null).catch(() => false);

    const logged = await logCertificateToChannel(client, {
      certificateNumber: newCertificateNumber,
      discordId,
      name: finalName,
      militaryId: finalMilitaryId,
      roleName: CONFIG.getRoleNameEnglish(finalRoleId),
      issuedBy,
      supersededInfo,
      isReissue: true,
      reason: reasonText
    }).then(r => r !== null).catch(() => false);

    return {
      success: true,
      certificateNumber: newCertificateNumber,
      supersededCount: supersededInfo.supersededCount || 0,
      dmSent, logged, reason: reasonText
    };

  } catch (err) {
    console.error('[reissueCertificateOnUpdate] خطأ:', err.message);
    return { success: false, error: err.message };
  }
}

async function reissueCertificateOnReorder(client, memberData, newMilitaryId) {
  return reissueCertificateOnUpdate(client, memberData.discordId,
    { militaryId: newMilitaryId }, 'reorder', 'System (Auto-Reorder)');
}

async function reissueCertificateOnNameChange(client, discordId, newName, issuedBy) {
  return reissueCertificateOnUpdate(client, discordId,
    { name: newName }, 'name_change', issuedBy);
}

async function reissueCertificateOnPromotion(client, discordId, newRoleId, issuedBy) {
  const isPromotion = [CONFIG.ROLES.MP_OFFICER, CONFIG.ROLES.ASSISTANT_COMMANDER, CONFIG.ROLES.DEPUTY_COMMANDER]
    .includes(newRoleId);
  return reissueCertificateOnUpdate(client, discordId,
    { roleId: newRoleId }, isPromotion ? 'promotion' : 'demotion', issuedBy);
}

/* ═══════════════════════════════════════════════════════════
 *              الترقية للرتب القيادية
 *  ═══════════════════════════════════════════════════════════ */

async function promoteToLeadership(client, newHolderId, newRoleId, displacedHolderId = null, displacedNewRoleId = null, issuedBy = 'System') {
  try {
    const results = {
      success: true,
      newHolder: null,
      displacedHolder: null,
      errors: []
    };

    if (displacedHolderId && displacedHolderId !== newHolderId) {
      try {
        const displacedMember = await firebase.getMember(displacedHolderId);
        if (displacedMember) {
          const fallbackRole = displacedNewRoleId || CONFIG.ROLES.MP_OFFICER;
          const newMilitaryId = await firebase.getNextMilitaryId();

          await firebase.updateMember(displacedHolderId, {
            roleId: fallbackRole,
            militaryId: newMilitaryId,
            lastUpdate: Date.now()
          });

          const certResult = await reissueCertificateOnUpdate(
            client,
            displacedHolderId,
            { militaryId: newMilitaryId, roleId: fallbackRole },
            'demotion',
            issuedBy
          );

          results.displacedHolder = {
            discordId: displacedHolderId,
            oldMilitaryId: displacedMember.militaryId,
            newMilitaryId,
            oldRoleId: displacedMember.roleId,
            newRoleId: fallbackRole,
            certificate: certResult
          };
        }
      } catch (err) {
        console.error('[promoteToLeadership] فشل إزاحة القديم:', err.message);
        results.errors.push({ stage: 'displaced', error: err.message });
      }
    }

    try {
      const newHolder = await firebase.getMember(newHolderId);
      if (!newHolder) {
        results.success = false;
        results.errors.push({ stage: 'new_holder', error: 'العضو غير موجود' });
        return results;
      }

      let newMilitaryId;
      switch (newRoleId) {
        case CONFIG.ROLES.COMMANDER: newMilitaryId = CONFIG.MILITARY_ID.COMMANDER; break;
        case CONFIG.ROLES.DEPUTY_COMMANDER: newMilitaryId = CONFIG.MILITARY_ID.DEPUTY; break;
        case CONFIG.ROLES.ASSISTANT_COMMANDER: newMilitaryId = CONFIG.MILITARY_ID.ASSISTANT; break;
        default: newMilitaryId = await firebase.getNextMilitaryId();
      }

      await firebase.updateMember(newHolderId, {
        roleId: newRoleId,
        militaryId: newMilitaryId,
        lastUpdate: Date.now()
      });

      const certResult = await reissueCertificateOnUpdate(
        client,
        newHolderId,
        { militaryId: newMilitaryId, roleId: newRoleId },
        'promotion',
        issuedBy
      );

      results.newHolder = {
        discordId: newHolderId,
        oldMilitaryId: newHolder.militaryId,
        newMilitaryId,
        oldRoleId: newHolder.roleId,
        newRoleId,
        certificate: certResult
      };

    } catch (err) {
      console.error('[promoteToLeadership] فشل ترقية الجديد:', err.message);
      results.success = false;
      results.errors.push({ stage: 'new_holder', error: err.message });
    }

    return results;

  } catch (err) {
    console.error('[promoteToLeadership] خطأ:', err.message);
    return { success: false, error: err.message, errors: [{ stage: 'general', error: err.message }] };
  }
}

async function appointNewCommander(client, newCommanderId, displacedCommanderId = null, displacedNewRoleId = null, issuedBy = 'Minister of Defense') {
  return promoteToLeadership(
    client,
    newCommanderId,
    CONFIG.ROLES.COMMANDER,
    displacedCommanderId,
    displacedNewRoleId || CONFIG.ROLES.DEPUTY_COMMANDER,
    issuedBy
  );
}

async function promoteDeputyToCommander(client, deputyId, issuedBy) {
  try {
    const deputy = await firebase.getMember(deputyId);
    if (!deputy) return { success: false, error: 'النائب غير موجود' };
    if (deputy.roleId !== CONFIG.ROLES.DEPUTY_COMMANDER) {
      return { success: false, error: 'العضو ليس نائباً حالياً' };
    }

    const allMembers = await firebase.getAllMembers();
    const currentCommander = allMembers.find(m => m.roleId === CONFIG.ROLES.COMMANDER);

    return promoteToLeadership(
      client,
      deputyId,
      CONFIG.ROLES.COMMANDER,
      currentCommander ? currentCommander.discordId : null,
      CONFIG.ROLES.DEPUTY_COMMANDER,
      issuedBy
    );

  } catch (err) {
    console.error('[promoteDeputyToCommander] خطأ:', err.message);
    return { success: false, error: err.message };
  }
}
/* ═══════════════════════════════════════════════════════════
 *              توليد شهادة مُبطلة
 *  ═══════════════════════════════════════════════════════════ */

async function generateInvalidatedCertificate(data) {
  const {
    name = 'Unknown',
    militaryId = 'M-00',
    certificateNumber = 'INVALID',
    reason = 'termination'
  } = data;

  const canvas = createCanvas(CERT.WIDTH, CERT.HEIGHT);
  const ctx = canvas.getContext('2d');

  // خلفية داكنة حمراء
  const bgGrad = ctx.createLinearGradient(0, 0, CERT.WIDTH, CERT.HEIGHT);
  bgGrad.addColorStop(0, '#1a0505');
  bgGrad.addColorStop(0.5, '#2a0808');
  bgGrad.addColorStop(1, '#1a0505');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, CERT.WIDTH, CERT.HEIGHT);

  // إطار أحمر سميك
  drawRoundedRect(ctx, 20, 20, CERT.WIDTH - 40, CERT.HEIGHT - 40, 20);
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 6;
  ctx.stroke();

  drawRoundedRect(ctx, 35, 35, CERT.WIDTH - 70, CERT.HEIGHT - 70, 15);
  ctx.strokeStyle = '#7f1d1d';
  ctx.lineWidth = 2;
  ctx.stroke();

  // خطوط مائلة كبيرة X
  ctx.strokeStyle = 'rgba(239, 68, 68, 0.25)';
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.moveTo(80, 80);
  ctx.lineTo(CERT.WIDTH - 80, CERT.HEIGHT - 80);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(CERT.WIDTH - 80, 80);
  ctx.lineTo(80, CERT.HEIGHT - 80);
  ctx.stroke();

  // نصوص
  ctx.textAlign = 'center';

  ctx.font = '900 56px "Cairo", sans-serif';
  ctx.fillStyle = '#ef4444';
  ctx.fillText('❌ شهادة ملغاة ❌', CERT.WIDTH / 2, 180);

  ctx.font = '700 22px "Orbitron", "Cairo", sans-serif';
  ctx.fillStyle = '#991b1b';
  ctx.fillText('INVALIDATED CERTIFICATE', CERT.WIDTH / 2, 225);

  // خط فاصل
  ctx.strokeStyle = '#7f1d1d';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(200, 260);
  ctx.lineTo(CERT.WIDTH - 200, 260);
  ctx.stroke();

  // اسم
  ctx.font = '400 16px "Cairo", sans-serif';
  ctx.fillStyle = '#fca5a5';
  ctx.fillText('تم إبطال شهادة', CERT.WIDTH / 2, 320);

  ctx.font = '900 42px "Cairo", sans-serif';
  ctx.fillStyle = '#fee2e2';
  ctx.fillText(name, CERT.WIDTH / 2, 380);

  // رقم
  ctx.font = '700 24px "Orbitron", "Cairo", sans-serif';
  ctx.fillStyle = '#fca5a5';
  ctx.fillText(`ID: ${militaryId}`, CERT.WIDTH / 2, 435);

  // السبب
  ctx.font = '600 18px "Cairo", sans-serif';
  ctx.fillStyle = '#f87171';
  const reasonText = reason === 'termination' ? 'ترميج من السلك' :
                     reason === 'manual' ? 'إزالة يدوية' : reason;
  ctx.fillText(`السبب: ${reasonText}`, CERT.WIDTH / 2, 490);

  // رقم الشهادة
  ctx.font = '600 12px "Orbitron", "Cairo", sans-serif';
  ctx.fillStyle = '#7f1d1d';
  ctx.fillText(`Certificate No: ${certificateNumber}`, CERT.WIDTH / 2, CERT.HEIGHT - 60);

  ctx.font = '700 11px "Orbitron", "Cairo", sans-serif';
  ctx.fillStyle = '#991b1b';
  ctx.fillText('MILITARY POLICE • INVALIDATED', CERT.WIDTH / 2, CERT.HEIGHT - 30);

  return canvas.toBuffer('image/png');
}

/* ═══════════════════════════════════════════════════════════
 *              إرسال DM إبطال الشهادة
 *  ═══════════════════════════════════════════════════════════ */

async function sendInvalidationDM(client, userId, data) {
  try {
    const user = await client.users.fetch(userId).catch(() => null);
    if (!user) {
      console.warn('[sendInvalidationDM] المستخدم غير موجود:', userId);
      return null;
    }

    const certNumber = generateCertificateNumber(data.militaryId);

    // ✅ توليد صورة الشهادة المشطوبة
    const imageBuffer = await generateInvalidatedCertificate({
      name: data.name,
      militaryId: data.militaryId,
      reason: data.reason,
      certificateNumber: certNumber
    });

    const attachment = new AttachmentBuilder(imageBuffer, {
      name: `INVALIDATED_${data.militaryId}.png`
    });

    const embed = new EmbedBuilder()
      .setColor(CONFIG.COLORS.DANGER)
      .setAuthor({
        name: 'وزارة الدفاع الأمريكي',
        iconURL: client.user.displayAvatarURL()
      })
      .setTitle('❌ تم إبطال شهادتك')
      .setDescription(
        `مرحباً **${data.name}**\n\n` +
        'نأسف لإبلاغك بأنه تم **إبطال شهادتك الرسمية**.\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━'
      )
      .addFields(
        { name: '📛 الاسم', value: data.name || '—', inline: true },
        { name: '🆔 الرقم', value: `\`${data.militaryId || '—'}\``, inline: true },
        { name: '📊 عدد الشهادات المُبطلة', value: `**${data.count || 1}**`, inline: true },
        { name: '📝 السبب', value: data.reason || 'غير محدد', inline: false }
      )
      .setImage(`attachment://${attachment.name}`)
      .setFooter({
        text: 'Military Police — Ministry of Defense',
        iconURL: client.user.displayAvatarURL()
      })
      .setTimestamp(new Date());

    return await user.send({ embeds: [embed], files: [attachment] });

  } catch (err) {
    console.error('[sendInvalidationDM]', err.message);
    return null;
  }
}

// في module.exports أضف:
module.exports.sendInvalidationDM = sendInvalidationDM;
module.exports.generateInvalidatedCertificate = generateInvalidatedCertificate;

/* ═══════════════════════════════════════════════════════════
 *                    التصدير
 *  ═══════════════════════════════════════════════════════════ */

module.exports = {
  generateCertificate,
  generateCertificateNumber,
  sendCertificateDM,
  sendCertificateToChannel,
  CERT,

  issueCertificate,
  logCertificateToChannel,
  logCertificateInvalidation,
  reissueCertificateOnUpdate,
  reissueCertificateOnReorder,
  reissueCertificateOnNameChange,
  reissueCertificateOnPromotion,

  promoteToLeadership,
  appointNewCommander,
  promoteDeputyToCommander
};