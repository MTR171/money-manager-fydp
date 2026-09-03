#!/usr/bin/env node
/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║   Money Manager PWA — Icon Generator                        ║
 * ║   Converts icon.svg → all required PNG sizes using sharp    ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * Usage (from frontend/ directory):
 *   npm run generate-icons
 *   node public/generate-icons.cjs
 *
 * Output files (all written to frontend/public/):
 *   icon-192.png             192×192  – standard PWA icon
 *   icon-512.png             512×512  – large PWA icon
 *   icon-512-maskable.png    512×512  – maskable (safe-zone padded)
 *   apple-touch-icon.png     180×180  – iOS Safari "Add to Home Screen"
 *   favicon.svg              symlink  – already present
 *
 * Requirements:
 *   sharp is installed as a devDependency and downloaded automatically
 *   via npm install.  No native build tools are needed (sharp ships
 *   prebuilt binaries for Windows, macOS, and Linux).
 */

'use strict';

const path = require('path');
const fs   = require('fs');
const { execSync } = require('child_process');

// ── Resolve paths ─────────────────────────────────────────────────────────────
const PUBLIC_DIR  = __dirname;                            // frontend/public/
const FRONTEND_DIR = path.join(PUBLIC_DIR, '..');         // frontend/
const SVG_PATH    = path.join(PUBLIC_DIR, 'icon.svg');

// ── Ensure sharp is available ─────────────────────────────────────────────────
function ensureSharp() {
  try {
    return require('sharp');
  } catch (_) {
    console.log('[SETUP] sharp not found — installing (this is a one-time step)...');
    execSync('npm install sharp --save-dev', {
      stdio: 'inherit',
      cwd: FRONTEND_DIR,
    });
    return require('sharp');
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🎨  Money Manager PWA Icon Generator\n' + '─'.repeat(44));

  if (!fs.existsSync(SVG_PATH)) {
    console.error(`[ERROR] Source file not found: ${SVG_PATH}`);
    console.error('        Make sure icon.svg is in the public/ folder.');
    process.exit(1);
  }

  const sharp = ensureSharp();
  const svgBuffer = fs.readFileSync(SVG_PATH);

  // ── Standard icon sizes ────────────────────────────────────────────────────
  const icons = [
    { file: 'icon-192.png',       size: 192, label: 'Standard 192×192' },
    { file: 'icon-512.png',       size: 512, label: 'Standard 512×512' },
    { file: 'apple-touch-icon.png', size: 180, label: 'Apple Touch 180×180' },
  ];

  for (const { file, size, label } of icons) {
    const outputPath = path.join(PUBLIC_DIR, file);
    await sharp(svgBuffer)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toFile(outputPath);
    console.log(`  ✓  ${file.padEnd(28)} ${label}`);
  }

  // ── Maskable icon (Android adaptive icon with safe zone) ──────────────────
  // The "safe zone" for maskable icons is the centre 80% of the canvas.
  // We place the icon inside that zone on a solid #0f172a background so
  // the rounded/squircle/circle mask applied by Android never clips content.
  const CANVAS_SIZE  = 512;
  const SAFE_ZONE    = 0.80;                              // 80 % = PWA spec
  const INNER_SIZE   = Math.round(CANVAS_SIZE * SAFE_ZONE);  // 410 px
  const OFFSET       = Math.round((CANVAS_SIZE - INNER_SIZE) / 2);  // 51 px each side

  const innerBuffer = await sharp(svgBuffer)
    .resize(INNER_SIZE, INNER_SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const maskablePath = path.join(PUBLIC_DIR, 'icon-512-maskable.png');
  await sharp({
    create: {
      width: CANVAS_SIZE,
      height: CANVAS_SIZE,
      channels: 4,
      background: { r: 15, g: 23, b: 42, alpha: 255 },  // #0f172a
    },
  })
    .composite([{
      input: innerBuffer,
      top:  OFFSET,
      left: OFFSET,
    }])
    .png({ compressionLevel: 9 })
    .toFile(maskablePath);

  console.log(`  ✓  icon-512-maskable.png           Maskable 512×512 (safe-zone padded)`);

  // ── Symlink / copy favicon ─────────────────────────────────────────────────
  const faviconPath = path.join(PUBLIC_DIR, 'favicon.svg');
  if (!fs.existsSync(faviconPath)) {
    fs.copyFileSync(SVG_PATH, faviconPath);
    console.log(`  ✓  favicon.svg                     Copied from icon.svg`);
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(44));
  console.log('✅  All PWA icons generated in frontend/public/');
  console.log('\n   Next steps:');
  console.log('     npm run build       → production bundle + service worker');
  console.log('     npm run preview     → test the PWA locally at :4173');
  console.log('─'.repeat(44) + '\n');
}

main().catch(err => {
  console.error('\n[FAIL]', err.message || err);
  process.exit(1);
});
