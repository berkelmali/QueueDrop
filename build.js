// ============================================
// QueueDrop — Capacitor Web Assets Build Script
// Copies web assets into the www/ directory
// ============================================

const fs = require('fs');
const path = require('path');

const ROOT_DIR = __dirname;
const WWW_DIR = path.join(ROOT_DIR, 'www');

// Clean and recreate www/
if (fs.existsSync(WWW_DIR)) {
  fs.rmSync(WWW_DIR, { recursive: true, force: true });
}
fs.mkdirSync(WWW_DIR, { recursive: true });

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  const stats = fs.statSync(src);
  if (stats.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    fs.readdirSync(src).forEach(child => {
      copyRecursive(path.join(src, child), path.join(dest, child));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

// Files and directories to copy
const itemsToCopy = [
  'index.html',
  'manifest.json',
  'sw.js',
  'assets',
  'css',
  'js'
];

console.log('📦 Building web assets for Capacitor (www/)...');

itemsToCopy.forEach(item => {
  const src = path.join(ROOT_DIR, item);
  const dest = path.join(WWW_DIR, item);
  if (fs.existsSync(src)) {
    copyRecursive(src, dest);
    console.log(`  ✓ Copied ${item}`);
  }
});

console.log('✨ Build complete! Assets ready in www/\n');
