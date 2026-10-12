/* ═══════════════════════════════════════════════════════════
 *  مدير الخطوط — FontManager.js
 *  يحمّل الخطوط العربية تلقائياً من الإنترنت ويسجلها في Canvas
 *  ═══════════════════════════════════════════════════════════ */

'use strict';

const { GlobalFonts } = require('@napi-rs/canvas');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

const FONTS_DIR = path.join(__dirname, '..', 'fonts');

/* ─── مصادر الخطوط (Google Fonts الرسمية عبر jsDelivr) ─── */
const FONT_SOURCES = [
  // Cairo — الأساسي (يدعم كل الأوزان عبر Variable Font)
  {
    family: 'Cairo',
    file: 'Cairo.ttf',
    url: 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/cairo/Cairo%5Bslnt%2Cwght%5D.ttf'
  },
  // Almarai — احتياطي 1 (أوزان ثابتة)
  {
    family: 'Almarai',
    file: 'Almarai-Regular.ttf',
    url: 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/almarai/Almarai-Regular.ttf'
  },
  {
    family: 'Almarai',
    file: 'Almarai-Bold.ttf',
    url: 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/almarai/Almarai-Bold.ttf'
  },
  {
    family: 'Almarai',
    file: 'Almarai-ExtraBold.ttf',
    url: 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/almarai/Almarai-ExtraBold.ttf'
  },
  // Amiri — احتياطي 2
  {
    family: 'Amiri',
    file: 'Amiri-Regular.ttf',
    url: 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/amiri/Amiri-Regular.ttf'
  },
  {
    family: 'Amiri',
    file: 'Amiri-Bold.ttf',
    url: 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/amiri/Amiri-Bold.ttf'
  }
];

let initialized = false;
let initPromise = null;

/* ─── تحميل ملف ─── */
async function downloadFont(url, destPath) {
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 30000,
      maxRedirects: 5
    });
    fs.writeFileSync(destPath, Buffer.from(response.data));
    return true;
  } catch (err) {
    console.error(`[FontManager] ❌ فشل تحميل ${url}:`, err.message);
    return false;
  }
}

/* ─── تهيئة الخطوط ─── */
async function initFonts() {
  if (initialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    console.log('[FontManager] 🔤 بدء تهيئة الخطوط...');

    if (!fs.existsSync(FONTS_DIR)) {
      fs.mkdirSync(FONTS_DIR, { recursive: true });
      console.log('[FontManager] 📁 تم إنشاء مجلد fonts');
    }

    // تحميل الخطوط الناقصة
    for (const font of FONT_SOURCES) {
      const destPath = path.join(FONTS_DIR, font.file);
      if (!fs.existsSync(destPath)) {
        console.log(`[FontManager] ⬇️  تحميل ${font.file}...`);
        const ok = await downloadFont(font.url, destPath);
        if (ok) console.log(`[FontManager] ✅ تم تحميل ${font.file}`);
      }
    }

    // تسجيل كل الخطوط
    const files = fs.readdirSync(FONTS_DIR);
    let registered = 0;

    for (const file of files) {
      if (file.endsWith('.ttf') || file.endsWith('.otf')) {
        try {
          const fullPath = path.join(FONTS_DIR, file);
          GlobalFonts.registerFromPath(fullPath);
          registered++;
        } catch (err) {
          console.warn(`[FontManager] ⚠️ فشل تسجيل ${file}:`, err.message);
        }
      }
    }

    console.log(`[FontManager] ✅ تم تسجيل ${registered} ملف خط`);

    try {
      const families = GlobalFonts.families;
      const names = families.map(f => f.family).join(', ');
      console.log(`[FontManager] 📚 الخطوط المتوفرة: ${names}`);
    } catch {}

    initialized = true;
  })();

  return initPromise;
}

async function ensureFontsReady() {
  if (initialized) return;
  await initFonts();
}

// بدء التحميل فوراً عند استيراد الملف
initFonts().catch(err => console.error('[FontManager] خطأ عام:', err.message));

module.exports = { initFonts, ensureFontsReady, FONTS_DIR };