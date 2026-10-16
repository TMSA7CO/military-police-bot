/* ═══════════════════════════════════════════════════════════
 *  الشرطة العسكرية | وزارة الدفاع الأمريكي
 *  أداة شهادات التعيين — Certificates.js
 *  الإصدار: 2.0 (تتبع + إبطال + إعادة إصدار + ترقية قيادية)
 *  ═══════════════════════════════════════════════════════════ */

'use strict';

const { createCanvas, loadImage } = require('@napi-rs/canvas');
const { AttachmentBuilder, EmbedBuilder } = require('discord.js');
const CONFIG = require('../config');
/* ✨ جديد — إجبار تحميل الخطوط قبل أي رسم */
const { ensureFontsReady } = require('./fontManager');
/* ═══════════════════════════════════════════════════════════
 *  ✨ دالة موحدة لعرض المُصدر
 *  ═══════════════════════════════════════════════════════════ */
function formatIssuer(issuedBy) {
  if (!issuedBy) return 'النظام';
  const str = String(issuedBy).trim();
  if (/^\d{17,20}$/.test(str)) return `<@${str}>`;
  return str;
}
/* ═══════════════════════════════════════════════════════════
 *  ✨ دوال مساعدة لرسم النص العربي على Canvas
 *  ═══════════════════════════════════════════════════════════ */

/**
 * رسم نص عربي باتجاه RTL
 * يدعم التقليص التلقائي إذا النص طويل
 */
function drawArabicText(ctx, text, x, y, options = {}) {
  const {
    font = '900 46px "Cairo", "Almarai", "Amiri", sans-serif',
    color = '#ffffff',
    shadowColor = null,
    shadowBlur = 0,
    maxWidth = null,
    minSize = 14,
    align = 'center'
  } = options;

  ctx.save();
  ctx.direction = 'rtl';
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';

  if (shadowColor) {
    ctx.shadowColor = shadowColor;
    ctx.shadowBlur = shadowBlur;
  }

  /* ─── إذا في حد أقصى للعرض → نقلّص الحجم تدريجياً ─── */
  if (maxWidth) {
    const sizeMatch = font.match(/(\d+)px/);
    const startSize = sizeMatch ? parseInt(sizeMatch[1], 10) : 46;
    const fontBuilder = (s) => font.replace(/\d+px/, `${s}px`);

    let size = startSize;
    while (size > minSize) {
      ctx.font = fontBuilder(size);
      if (ctx.measureText(text).width <= maxWidth) break;
      size -= 2;
    }
  } else {
    ctx.font = font;
  }

  ctx.fillStyle = color;
  ctx.fillText(text, x, y);

  ctx.restore();
}

/**
 * رسم النص مع قياس العرض الفعلي (بدون رسم)
 * مفيد للتشخيص
 */
function measureArabicText(ctx, text, font) {
  ctx.save();
  ctx.direction = 'rtl';
  ctx.font = font;
  const w = ctx.measureText(text).width;
  ctx.restore();
  return w;
}
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
 *  ✨ دوال مساعدة للخطوط العربية
 *  ═══════════════════════════════════════════════════════════ */

/**
 * رسم نص مع تقليص تلقائي حتى يدخل في العرض المطلوب
 */
function drawFittedText(ctx, text, x, y, maxWidth, fontBuilder, startSize, minSize = 14) {
  let size = startSize;
  while (size > minSize) {
    ctx.font = fontBuilder(size);
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 2;
  }
  ctx.fillText(text, x, y);
  return size;
}

/**
 * رسم نص عربي مع ضبط RTL والوسط
 */
function drawArabicText(ctx, text, x, y, options = {}) {
  const {
    font = '900 46px "Cairo", "Almarai", sans-serif',
    color = '#ffffff',
    shadowColor = null,
    shadowBlur = 0,
    maxWidth = null,
    minSize = 14
  } = options;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.direction = 'rtl';

  ctx.fillStyle = color;
  if (shadowColor) {
    ctx.shadowColor = shadowColor;
    ctx.shadowBlur = shadowBlur;
  }

  if (maxWidth) {
    /* استخراج الحجم من template */
    const sizeMatch = font.match(/(\d+)px/);
    const startSize = sizeMatch ? parseInt(sizeMatch[1], 10) : 46;
    const fontBuilder = (s) => font.replace(/\d+px/, `${s}px`);

    let size = startSize;
    while (size > minSize) {
      ctx.font = fontBuilder(size);
      if (ctx.measureText(text).width <= maxWidth) break;
      size -= 2;
    }
    ctx.fillText(text, x, y);
  } else {
    ctx.font = font;
    ctx.fillText(text, x, y);
  }

  ctx.shadowBlur = 0;
}

/* ═══════════════════════════════════════════════════════════
 *                    توليد الشهادة
 *  ═══════════════════════════════════════════════════════════ */

async function generateCertificate(data) {
    /* ✨ انتظر حتى تنتهي الخطوط من التحميل */
  await ensureFontsReady();
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
ctx.direction = 'rtl';
ctx.textBaseline = 'alphabetic';
  /* ═══════════════════════════════════════════════
   *  1. الخلفية — تدرج ملكي عميق
   *  ═══════════════════════════════════════════════ */
  const bgGradient = ctx.createLinearGradient(0, 0, CERT.WIDTH, CERT.HEIGHT);
  bgGradient.addColorStop(0, '#050d1f');
  bgGradient.addColorStop(0.35, '#0a1830');
  bgGradient.addColorStop(0.65, '#0d1f3d');
  bgGradient.addColorStop(1, '#050d1f');
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, CERT.WIDTH, CERT.HEIGHT);

  /* ═══════════════════════════════════════════════
   *  2. زخارف مائية دائرية خفيفة
   *  ═══════════════════════════════════════════════ */
  ctx.save();
  ctx.globalAlpha = 0.05;
  for (let i = 0; i < 8; i++) {
    ctx.strokeStyle = i % 2 === 0 ? '#d4af37' : '#3b82f6';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(CERT.WIDTH / 2, CERT.HEIGHT / 2, 100 + i * 55, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  /* ═══════════════════════════════════════════════
   *  3. توهج مركزي
   *  ═══════════════════════════════════════════════ */
  const glow = ctx.createRadialGradient(
    CERT.WIDTH / 2, 380, 0,
    CERT.WIDTH / 2, 380, 550
  );
  glow.addColorStop(0, 'rgba(212, 175, 55, 0.15)');
  glow.addColorStop(0.4, 'rgba(59, 130, 246, 0.08)');
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, CERT.WIDTH, CERT.HEIGHT);

  /* ═══════════════════════════════════════════════
   *  4. الإطار الذهبي الثلاثي
   *  ═══════════════════════════════════════════════ */
  /* الإطار الخارجي — ذهبي سميك */
  drawRoundedRect(ctx, 18, 18, CERT.WIDTH - 36, CERT.HEIGHT - 36, 24);
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 5;
  ctx.stroke();

  /* توهج حول الإطار */
  ctx.shadowColor = 'rgba(212, 175, 55, 0.6)';
  ctx.shadowBlur = 20;
  ctx.stroke();
  ctx.shadowBlur = 0;

  /* الإطار الأوسط — ذهبي رفيع */
  drawRoundedRect(ctx, 32, 32, CERT.WIDTH - 64, CERT.HEIGHT - 64, 18);
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.55)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  /* الإطار الداخلي — أزرق */
  drawRoundedRect(ctx, 42, 42, CERT.WIDTH - 84, CERT.HEIGHT - 84, 14);
  ctx.strokeStyle = 'rgba(59, 130, 246, 0.45)';
  ctx.lineWidth = 1;
  ctx.stroke();

  /* ═══════════════════════════════════════════════
   *  5. زوايا مزخرفة (نمط عسكري)
   *  ═══════════════════════════════════════════════ */
  const corners = [
    { x: 55, y: 55, sx: 1, sy: 1 },
    { x: CERT.WIDTH - 55, y: 55, sx: -1, sy: 1 },
    { x: CERT.WIDTH - 55, y: CERT.HEIGHT - 55, sx: -1, sy: -1 },
    { x: 55, y: CERT.HEIGHT - 55, sx: 1, sy: -1 }
  ];

  corners.forEach(c => {
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.scale(c.sx, c.sy);

    /* خط ذهبي سميك */
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(0, 40);
    ctx.lineTo(0, 0);
    ctx.lineTo(40, 0);
    ctx.stroke();

    /* خط أزرق رفيع داخل */
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.8)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(12, 30);
    ctx.lineTo(12, 12);
    ctx.lineTo(30, 12);
    ctx.stroke();

    /* نقطة ذهبية في الزاوية */
    ctx.beginPath();
    ctx.arc(5, 5, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#d4af37';
    ctx.fill();

    ctx.restore();
  });

  /* ═══════════════════════════════════════════════
   *  6. الترويسة الرسمية
   *  ═══════════════════════════════════════════════ */
  ctx.textAlign = 'center';

  /* السطر الإنجليزي العلوي */
  ctx.font = '900 14px "Orbitron", "Cairo", sans-serif';
  ctx.fillStyle = '#d4af37';
  ctx.fillText('M I N I S T R Y   O F   D E F E N S E', CERT.WIDTH / 2, 82);

  /* السطر العربي */
  ctx.font = '700 22px "Cairo", sans-serif';
  ctx.fillStyle = '#e8eef8';
  ctx.fillText('وزارة الدفاع الأمريكي', CERT.WIDTH / 2, 115);

  /* ═══════════════════════════════════════════════
   *  7. خط علوي رفيع ذهبي
   *  ═══════════════════════════════════════════════ */
  const topLine = ctx.createLinearGradient(150, 135, CERT.WIDTH - 150, 135);
  topLine.addColorStop(0, 'rgba(212, 175, 55, 0)');
  topLine.addColorStop(0.5, '#d4af37');
  topLine.addColorStop(1, 'rgba(212, 175, 55, 0)');
  ctx.strokeStyle = topLine;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(150, 135);
  ctx.lineTo(CERT.WIDTH - 150, 135);
  ctx.stroke();

  /* ═══════════════════════════════════════════════
   *  8. النجمة الذهبية الكبيرة
   *  ═══════════════════════════════════════════════ */
  drawStar(ctx, CERT.WIDTH / 2, 165, 5, 14, 6);
  ctx.fillStyle = '#d4af37';
  ctx.shadowColor = 'rgba(212, 175, 55, 0.7)';
  ctx.shadowBlur = 20;
  ctx.fill();
  ctx.shadowBlur = 0;

  /* ═══════════════════════════════════════════════
   *  9. العنوان الرئيسي
   *  ═══════════════════════════════════════════════ */
  ctx.font = '900 46px "Cairo", sans-serif';
  ctx.fillStyle = '#d4af37';
  ctx.shadowColor = 'rgba(212, 175, 55, 0.6)';
  ctx.shadowBlur = 30;
  ctx.fillText('شهادة تعيين رسمية', CERT.WIDTH / 2, 232);
  ctx.shadowBlur = 0;

  /* العنوان الإنجليزي */
  ctx.font = '700 14px "Orbitron", "Cairo", sans-serif';
  ctx.fillStyle = '#3b82f6';
  ctx.fillText('OFFICIAL APPOINTMENT CERTIFICATE', CERT.WIDTH / 2, 260);

  /* ═══════════════════════════════════════════════
   *  10. النص التقديمي
   *  ═══════════════════════════════════════════════ */
  ctx.font = '400 16px "Cairo", sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('تُمنح هذه الشهادة الرسمية بكل فخر واعتزاز إلى', CERT.WIDTH / 2, 305);

/* ═══════════════════════════════════════════════
 *  11. اسم العضو — نجم الشهادة
 *  ═══════════════════════════════════════════════ */
drawArabicText(ctx, String(name), CERT.WIDTH / 2, 375, {
  font: '900 56px "Cairo", "Almarai", "Amiri", sans-serif',
  color: '#ffffff',
  shadowColor: 'rgba(59, 130, 246, 0.9)',
  shadowBlur: 35,
  maxWidth: CERT.WIDTH - 200,
  minSize: 22
});

  /* خط أزرق تحت الاسم */
  const nameLine = ctx.createLinearGradient(280, 395, CERT.WIDTH - 280, 395);
  nameLine.addColorStop(0, 'rgba(59, 130, 246, 0)');
  nameLine.addColorStop(0.5, '#3b82f6');
  nameLine.addColorStop(1, 'rgba(59, 130, 246, 0)');
  ctx.strokeStyle = nameLine;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(280, 395);
  ctx.lineTo(CERT.WIDTH - 280, 395);
  ctx.stroke();

  /* ═══════════════════════════════════════════════
   *  12. نص التخرج
   *  ═══════════════════════════════════════════════ */
  ctx.font = '400 15px "Cairo", sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('تقديراً لتعيينه الرسمي في سلك', CERT.WIDTH / 2, 432);

  ctx.font = '900 24px "Cairo", sans-serif';
  ctx.fillStyle = '#d4af37';
  ctx.fillText('الشرطة العسكرية — وزارة الدفاع الأمريكي', CERT.WIDTH / 2, 465);

  /* ═══════════════════════════════════════════════
   *  13. صندوق الرتبة
   *  ═══════════════════════════════════════════════ */
  const rankBoxWidth = 500;
  const rankBoxX = (CERT.WIDTH - rankBoxWidth) / 2;
  const rankBoxY = 490;
  const rankBoxH = 45;

  drawRoundedRect(ctx, rankBoxX, rankBoxY, rankBoxWidth, rankBoxH, 10);
  const rankGrad = ctx.createLinearGradient(rankBoxX, rankBoxY, rankBoxX + rankBoxWidth, rankBoxY);
  rankGrad.addColorStop(0, 'rgba(16, 185, 129, 0.15)');
  rankGrad.addColorStop(0.5, 'rgba(16, 185, 129, 0.3)');
  rankGrad.addColorStop(1, 'rgba(16, 185, 129, 0.15)');
  ctx.fillStyle = rankGrad;
  ctx.fill();
  ctx.strokeStyle = 'rgba(16, 185, 129, 0.6)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.font = '700 20px "Cairo", sans-serif';
  ctx.fillStyle = '#10b981';
  ctx.fillText(`بمنصب: ${roleNameAr || roleName}`, CERT.WIDTH / 2, rankBoxY + 30);

  /* ═══════════════════════════════════════════════
   *  14. صناديق البيانات الثلاثة
   *  ═══════════════════════════════════════════════ */
  const dataY = 575;
  const colWidth = 290;
  const colStartX = (CERT.WIDTH - colWidth * 3) / 2;

  const dataItems = [
    { label: 'الرقم العسكري', value: militaryId, icon: '🆔' },
    { label: 'الرتبة', value: roleName, icon: '🎖️' },
    { label: 'تاريخ التعيين', value: joinDate, icon: '📅' }
  ];

  dataItems.forEach((item, index) => {
    const x = colStartX + colWidth * index + colWidth / 2;
    const boxX = x - colWidth / 2 + 12;
    const boxW = colWidth - 24;

    /* خلفية الصندوق */
    drawRoundedRect(ctx, boxX, dataY - 18, boxW, 85, 10);
    const boxGrad = ctx.createLinearGradient(boxX, dataY - 18, boxX, dataY + 67);
    boxGrad.addColorStop(0, 'rgba(10, 25, 50, 0.9)');
    boxGrad.addColorStop(1, 'rgba(5, 15, 35, 0.95)');
    ctx.fillStyle = boxGrad;
    ctx.fill();

    ctx.strokeStyle = 'rgba(212, 175, 55, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    /* خط ذهبي علوي داخل الصندوق */
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(boxX + 15, dataY - 18);
    ctx.lineTo(boxX + boxW - 15, dataY - 18);
    ctx.stroke();

    /* التسمية */
    ctx.font = '600 12px "Cairo", sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(item.label, x, dataY + 3);

    /* القيمة */
    ctx.font = '900 22px "Orbitron", "Cairo", sans-serif';
    ctx.fillStyle = '#d4af37';
    ctx.shadowColor = 'rgba(212, 175, 55, 0.4)';
    ctx.shadowBlur = 10;
    ctx.fillText(String(item.value).substring(0, 20), x, dataY + 35);
    ctx.shadowBlur = 0;

    /* خط فاصل */
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - 50, dataY + 48);
    ctx.lineTo(x + 50, dataY + 48);
    ctx.stroke();

    /* الأيقونة */
    ctx.font = '14px "Cairo"';
    ctx.fillStyle = '#3b82f6';
    ctx.fillText(item.icon, x, dataY + 64);
  });

  /* ═══════════════════════════════════════════════
   *  15. الفوتر
   *  ═══════════════════════════════════════════════ */
  ctx.font = '600 10px "Orbitron", "Cairo", sans-serif';
  ctx.fillStyle = '#64748b';
  ctx.fillText(`CERTIFICATE NO: ${certificateNumber}`, CERT.WIDTH / 2, CERT.HEIGHT - 42);

  ctx.font = '700 10px "Orbitron", "Cairo", sans-serif';
  ctx.fillStyle = '#d4af37';
  ctx.fillText('★ MILITARY POLICE • OFFICIAL SEAL ★', CERT.WIDTH / 2, CERT.HEIGHT - 22);

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

    const sentMessage = await user.send({ embeds: [embed], files: [attachment] });

    /* ✨ إرجاع الرسالة مع معرّفاتها */
    return {
      message: sentMessage,
      messageId: sentMessage.id,
      channelId: sentMessage.channelId
    };

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

    /* ✨ امسح كل الشهادات القديمة قبل إصدار الجديدة */
    const memberActions = require('./memberActions');
    const allCerts = await firebase.getMemberCertificates(discordId);
    await memberActions.deleteAllCertificateMessages(client, discordId, allCerts).catch(() => {});

    /* ═══════════════════════════════════════════════
     *  1. استبدال الشهادات القديمة (لو supersede)
     *  ═══════════════════════════════════════════════ */
    let supersededInfo = null;
    if (supersede) {
      supersededInfo = await firebase.supersedeCertificates(discordId, certificateNumber);
    }

    /* ═══════════════════════════════════════════════
     *  2. حفظ الشهادة مبدئياً (بدون messageIds)
     *  ═══════════════════════════════════════════════ */
    const saveResult = await firebase.saveCertificate(discordId, {
      certificateNumber, militaryId, name, roleName, roleId, issuedBy
    });

    if (!saveResult.success) return { success: false, error: 'فشل حفظ الشهادة' };

    /* ═══════════════════════════════════════════════
     *  3. إرسال DM (إن مُفعّل)
     *  ═══════════════════════════════════════════════ */
    let dmSent = false;
    let dmResult = null;

    if (sendDM) {
      dmResult = await sendCertificateDM(client, discordId, {
        name, militaryId, roleName, roleNameAr, certificateNumber,
        joinDate: new Date().toLocaleDateString('en-GB'),
        isReissue: supersede
      });
      dmSent = dmResult !== null && dmResult !== undefined;
    }

    /* ═══════════════════════════════════════════════
     *  4. إرسال لقناة اللوق (إن مُفعّل)
     *  ═══════════════════════════════════════════════ */
    let logged = false;
    let logResult = null;

    if (logToChannel) {
      logResult = await logCertificateToChannel(client, {
        certificateNumber, discordId, name, militaryId,
        roleName, roleNameAr,   // ✅ أضفنا roleNameAr
        roleId,                  // ✅ وأضفنا roleId للاحتياط
        issuedBy, supersededInfo, isReissue: supersede
      });
      logged = logResult !== null && logResult !== undefined;
    }

    /* ═══════════════════════════════════════════════
     *  ✨ 5. تحديث الشهادة بمعرّفات الرسائل
     *  ═══════════════════════════════════════════════ */
    const messageIds = {};

    if (logResult && logResult.messageId) {
      messageIds.logMessageId = logResult.messageId;
      messageIds.logChannelId = logResult.channelId;
    }

    if (dmResult && dmResult.messageId) {
      messageIds.dmMessageId = dmResult.messageId;
      messageIds.dmChannelId = dmResult.channelId;
    }

    if (Object.keys(messageIds).length > 0) {
      await firebase.updateCertificateMessageIds(discordId, certificateNumber, messageIds)
        .catch(err => console.warn('[issueCertificate] messageIds update failed:', err.message));
    }

    return {
      success: true,
      certificateNumber,
      dmSent,
      logged,
      supersededInfo,
      messageIds
    };

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
      roleNameAr: data.roleNameAr,   // ✅ هذا هو الحل — نمرر الاسم العربي
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
        { name: '✍️ أصدرها', value: formatIssuer(data.issuedBy), inline: true },        
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

    const sentMessage = await channel.send({ embeds: [embed], files: [attachment] });

    /* ✨ إرجاع الرسالة مع معرّفاتها */
    return {
      message: sentMessage,
      messageId: sentMessage.id,
      channelId: sentMessage.channelId
    };

  } catch (err) {
    console.error('[logCertificateToChannel] خطأ:', err.message);
    return null;
  }
}

/**
 * إرسال لوق إبطال الشهادة (مع الصورة الحمراء)
 */
/**
 * إرسال لوق إبطال الشهادة (مع صورة الشهادة الحمراء)
 */
async function logCertificateInvalidation(client, data) {
  try {
    /* ✨ امسح كل شهادات العضو القديمة (تعيين + إبطال) قبل إبطال جديد */
    if (data.discordId) {
      const memberActions = require('./memberActions');
      const allCerts = await firebase.getMemberCertificates(data.discordId).catch(() => []);
      await memberActions.deleteAllCertificateMessages(client, data.discordId, allCerts).catch(() => {});
    }

    const channelId = CONFIG.CHANNELS.CERTIFICATE_LOG || '1557866857334313132';
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel) return null;

    /* ✨ توليد صورة الشهادة الملغاة */
    let imageBuffer = null;
    try {
      imageBuffer = await generateInvalidatedCertificate({
        name: data.name || 'Unknown',
        militaryId: data.militaryId || 'M-XX',
        reason: data.reason || 'termination',
        certificateNumber: data.certificateNumber || generateCertificateNumber(data.militaryId)
      });
    } catch (genErr) {
      console.warn('[logCertificateInvalidation] فشل توليد الصورة:', genErr.message);
    }

    /* ✨ بناء الإيمبيد */
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
        { name: '👤 بواسطة', value: formatIssuer(data.by), inline: true }      
      )
      .setFooter({
        text: CONFIG.TEXT.FOOTER,
        iconURL: client.user.displayAvatarURL()
      })
      .setTimestamp(new Date());

    /* ✨ إرفاق الصورة */
    const options = { embeds: [embed] };

    if (imageBuffer) {
      const attachment = new AttachmentBuilder(imageBuffer, {
        name: `INVALIDATED_${data.militaryId || 'UNKNOWN'}.png`
      });
      options.files = [attachment];
      embed.setImage(`attachment://${attachment.name}`);
    }

    const sentMessage = await channel.send(options);

    /* ✨ إرجاع الرسالة مع معرّفاتها */
    return {
      message: sentMessage,
      messageId: sentMessage.id,
      channelId: sentMessage.channelId
    };

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
      roleNameAr: CONFIG.getRoleNameArabic(finalRoleId),   // ✅ أضفنا
      roleId: finalRoleId,                                  // ✅ أضفنا
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
  /* ✨ انتظر حتى تنتهي الخطوط من التحميل قبل أي رسم */
  await ensureFontsReady();

  const {
    name = 'Unknown',
    militaryId = 'M-00',
    certificateNumber = 'INVALID',
    reason = 'termination'
  } = data;

const canvas = createCanvas(CERT.WIDTH, CERT.HEIGHT);
const ctx = canvas.getContext('2d');
ctx.direction = 'rtl';
ctx.textBaseline = 'alphabetic';

  /* ═══════════════════════════════════════════════
   *  1. الخلفية — تدرج أحمر داكن (مخيف لكن فخم)
   *  ═══════════════════════════════════════════════ */
  const bgGrad = ctx.createLinearGradient(0, 0, CERT.WIDTH, CERT.HEIGHT);
  bgGrad.addColorStop(0, '#0a0000');
  bgGrad.addColorStop(0.35, '#1a0505');
  bgGrad.addColorStop(0.65, '#2a0808');
  bgGrad.addColorStop(1, '#0a0000');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, CERT.WIDTH, CERT.HEIGHT);

  /* ═══════════════════════════════════════════════
   *  2. زخارف مائية حمراء
   *  ═══════════════════════════════════════════════ */
  ctx.save();
  ctx.globalAlpha = 0.06;
  for (let i = 0; i < 8; i++) {
    ctx.strokeStyle = i % 2 === 0 ? '#ef4444' : '#7f1d1d';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(CERT.WIDTH / 2, CERT.HEIGHT / 2, 100 + i * 55, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  /* ═══════════════════════════════════════════════
   *  3. توهج مركزي أحمر
   *  ═══════════════════════════════════════════════ */
  const glow = ctx.createRadialGradient(
    CERT.WIDTH / 2, 350, 0,
    CERT.WIDTH / 2, 350, 550
  );
  glow.addColorStop(0, 'rgba(239, 68, 68, 0.20)');
  glow.addColorStop(0.4, 'rgba(127, 29, 29, 0.10)');
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, CERT.WIDTH, CERT.HEIGHT);

  /* ═══════════════════════════════════════════════
   *  4. الإطار الأحمر الثلاثي
   *  ═══════════════════════════════════════════════ */
  /* الإطار الخارجي — أحمر سميك */
  drawRoundedRect(ctx, 18, 18, CERT.WIDTH - 36, CERT.HEIGHT - 36, 24);
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 5;
  ctx.shadowColor = 'rgba(239, 68, 68, 0.7)';
  ctx.shadowBlur = 25;
  ctx.stroke();
  ctx.shadowBlur = 0;

  /* الإطار الأوسط */
  drawRoundedRect(ctx, 32, 32, CERT.WIDTH - 64, CERT.HEIGHT - 64, 18);
  ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  /* الإطار الداخلي */
  drawRoundedRect(ctx, 42, 42, CERT.WIDTH - 84, CERT.HEIGHT - 84, 14);
  ctx.strokeStyle = 'rgba(127, 29, 29, 0.7)';
  ctx.lineWidth = 1;
  ctx.stroke();

  /* ═══════════════════════════════════════════════
   *  5. X كبير شفاف في الخلف (علامة الإلغاء)
   *  ═══════════════════════════════════════════════ */
  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 22;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(140, 140);
  ctx.lineTo(CERT.WIDTH - 140, CERT.HEIGHT - 140);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(CERT.WIDTH - 140, 140);
  ctx.lineTo(140, CERT.HEIGHT - 140);
  ctx.stroke();
  ctx.restore();

  /* ═══════════════════════════════════════════════
   *  6. زوايا حمراء (X في كل زاوية)
   *  ═══════════════════════════════════════════════ */
  const corners = [
    { x: 55, y: 55, sx: 1, sy: 1 },
    { x: CERT.WIDTH - 55, y: 55, sx: -1, sy: 1 },
    { x: CERT.WIDTH - 55, y: CERT.HEIGHT - 55, sx: -1, sy: -1 },
    { x: 55, y: CERT.HEIGHT - 55, sx: 1, sy: -1 }
  ];

  corners.forEach(c => {
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.scale(c.sx, c.sy);

    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 40);
    ctx.lineTo(0, 0);
    ctx.lineTo(40, 0);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(127, 29, 29, 0.9)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(12, 30);
    ctx.lineTo(12, 12);
    ctx.lineTo(30, 12);
    ctx.stroke();

    ctx.restore();
  });

  /* ═══════════════════════════════════════════════
   *  7. الترويسة
   *  ═══════════════════════════════════════════════ */
  ctx.textAlign = 'center';

  ctx.font = '900 14px "Orbitron", "Cairo", sans-serif';
  ctx.fillStyle = '#ef4444';
  ctx.fillText('M I N I S T R Y   O F   D E F E N S E', CERT.WIDTH / 2, 82);

  ctx.font = '700 20px "Cairo", sans-serif';
  ctx.fillStyle = '#fca5a5';
  ctx.fillText('وزارة الدفاع الأمريكي', CERT.WIDTH / 2, 112);

  /* خط فاصل أحمر */
  const topLine = ctx.createLinearGradient(150, 132, CERT.WIDTH - 150, 132);
  topLine.addColorStop(0, 'rgba(239, 68, 68, 0)');
  topLine.addColorStop(0.5, '#ef4444');
  topLine.addColorStop(1, 'rgba(239, 68, 68, 0)');
  ctx.strokeStyle = topLine;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(150, 132);
  ctx.lineTo(CERT.WIDTH - 150, 132);
  ctx.stroke();

  /* ═══════════════════════════════════════════════
   *  8. العنوان الرئيسي — شهادة ملغاة
   *  ═══════════════════════════════════════════════ */
  ctx.font = '900 62px "Cairo", sans-serif';
  ctx.fillStyle = '#ef4444';
  ctx.shadowColor = 'rgba(239, 68, 68, 0.9)';
  ctx.shadowBlur = 35;
  ctx.fillText('❌ شهادة ملغاة ❌', CERT.WIDTH / 2, 205);
  ctx.shadowBlur = 0;

  ctx.font = '700 18px "Orbitron", "Cairo", sans-serif';
  ctx.fillStyle = '#991b1b';
  ctx.fillText('I N V A L I D A T E D   C E R T I F I C A T E', CERT.WIDTH / 2, 240);

  /* ═══════════════════════════════════════════════
   *  9. صندوق التحذير
   *  ═══════════════════════════════════════════════ */
  const warnBoxW = 700;
  const warnBoxX = (CERT.WIDTH - warnBoxW) / 2;
  const warnBoxY = 260;
  const warnBoxH = 50;

  drawRoundedRect(ctx, warnBoxX, warnBoxY, warnBoxW, warnBoxH, 12);
  ctx.fillStyle = 'rgba(127, 29, 29, 0.4)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.font = '700 20px "Cairo", sans-serif';
  ctx.fillStyle = '#fca5a5';
  ctx.fillText('⚠️ هذه الشهادة أصبحت لاغية ولا يمكن استخدامها ⚠️', CERT.WIDTH / 2, warnBoxY + 33);

  /* ═══════════════════════════════════════════════
   *  10. اسم العضو
   *  ═══════════════════════════════════════════════ */
  ctx.font = '400 16px "Cairo", sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('تم إبطال شهادة العضو', CERT.WIDTH / 2, 355);

  ctx.font = '900 52px "Cairo", sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(239, 68, 68, 0.8)';
  ctx.shadowBlur = 30;
  ctx.fillText(name, CERT.WIDTH / 2, 420);
  ctx.shadowBlur = 0;

  /* خط تحت الاسم */
  const nameLine = ctx.createLinearGradient(300, 440, CERT.WIDTH - 300, 440);
  nameLine.addColorStop(0, 'rgba(239, 68, 68, 0)');
  nameLine.addColorStop(0.5, '#ef4444');
  nameLine.addColorStop(1, 'rgba(239, 68, 68, 0)');
  ctx.strokeStyle = nameLine;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(300, 440);
  ctx.lineTo(CERT.WIDTH - 300, 440);
  ctx.stroke();

  /* ═══════════════════════════════════════════════
   *  11. بيانات الشهادة
   *  ═══════════════════════════════════════════════ */
  const dataY = 490;
  const colWidth = 290;
  const colStartX = (CERT.WIDTH - colWidth * 2) / 2;

  const dataItems = [
    { label: 'الرقم العسكري السابق', value: militaryId, icon: '🆔' },
    { label: 'حالة الشهادة', value: 'ملغاة', icon: '❌' }
  ];

  dataItems.forEach((item, index) => {
    const x = colStartX + colWidth * index + colWidth / 2;
    const boxX = x - colWidth / 2 + 12;
    const boxW = colWidth - 24;
    const boxH = 85;

    drawRoundedRect(ctx, boxX, dataY - 18, boxW, boxH, 10);
    const boxGrad = ctx.createLinearGradient(boxX, dataY - 18, boxX, dataY + 67);
    boxGrad.addColorStop(0, 'rgba(30, 5, 5, 0.95)');
    boxGrad.addColorStop(1, 'rgba(15, 0, 0, 0.98)');
    ctx.fillStyle = boxGrad;
    ctx.fill();

    ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(boxX + 15, dataY - 18);
    ctx.lineTo(boxX + boxW - 15, dataY - 18);
    ctx.stroke();

    ctx.font = '600 12px "Cairo", sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(item.label, x, dataY + 3);

    ctx.font = '900 24px "Cairo", sans-serif';
    ctx.fillStyle = '#ef4444';
    ctx.fillText(String(item.value).substring(0, 22), x, dataY + 42);
  });

  /* ═══════════════════════════════════════════════
   *  12. السبب
   *  ═══════════════════════════════════════════════ */
  const reasonText =
    reason === 'termination' ? 'ترميج من السلك' :
    reason === 'manual' ? 'إزالة يدوية' :
    reason === 'demotion' ? 'تخفيض رتبة' :
    reason;

  const reasonBoxW = 700;
  const reasonBoxX = (CERT.WIDTH - reasonBoxW) / 2;
  const reasonBoxY = 600;
  const reasonBoxH = 40;

  drawRoundedRect(ctx, reasonBoxX, reasonBoxY, reasonBoxW, reasonBoxH, 8);
  ctx.fillStyle = 'rgba(127, 29, 29, 0.3)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.font = '700 18px "Cairo", sans-serif';
  ctx.fillStyle = '#f87171';
  ctx.fillText(`📝 السبب: ${reasonText}`, CERT.WIDTH / 2, reasonBoxY + 27);

  /* ═══════════════════════════════════════════════
   *  13. الفوتر
   *  ═══════════════════════════════════════════════ */
  ctx.font = '600 10px "Orbitron", "Cairo", sans-serif';
  ctx.fillStyle = '#7f1d1d';
  ctx.fillText(`CERTIFICATE NO: ${certificateNumber}`, CERT.WIDTH / 2, CERT.HEIGHT - 42);

  ctx.font = '700 10px "Orbitron", "Cairo", sans-serif';
  ctx.fillStyle = '#991b1b';
  ctx.fillText('★ MILITARY POLICE • INVALIDATED ★', CERT.WIDTH / 2, CERT.HEIGHT - 22);

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

    const certNumber = data.certificateNumber || generateCertificateNumber(data.militaryId);

    /* ─── توليد صورة الشهادة الملغاة ─── */
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

    const sentMessage = await user.send({ embeds: [embed], files: [attachment] });

    /* ✨ إرجاع الرسالة مع معرّفاتها */
    return {
      message: sentMessage,
      messageId: sentMessage.id,
      channelId: sentMessage.channelId
    };

  } catch (err) {
    console.error('[sendInvalidationDM]', err.message);
    return null;
  }
}


/* ═══════════════════════════════════════════════════════════
 *                    التصدير
 *  ═══════════════════════════════════════════════════════════ */

module.exports = {
  generateCertificate,
  generateCertificateNumber,
  generateInvalidatedCertificate,
  sendInvalidationDM,
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