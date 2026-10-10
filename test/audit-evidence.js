// ============================================
// QueueDrop — Denetim ve Kanıt Testi (audit-evidence.js)
// Rol: TestingRealityChecker, AppSec, SoftwareArchitect, AccessibilityAuditor
// ============================================

const fs = require('fs');
const path = require('path');
const Parser = require('../js/parser.js');
const SpotifyAPI = require('../js/spotify.js');

const evidence = {
  timestamp: new Date().toISOString(),
  passed: 0,
  failed: 0,
  findings: []
};

function recordFinding(severity, id, title, description, proof) {
  evidence.findings.push({ severity, id, title, description, proof });
  console.log(`\n[${severity.toUpperCase()}] ${id}: ${title}`);
  console.log(`  Kanıt: ${proof}`);
}

function test(name, fn) {
  try {
    const result = fn();
    if (result !== false) {
      evidence.passed++;
      console.log(`  ✅ GEÇTİ: ${name}`);
      return true;
    } else {
      evidence.failed++;
      console.error(`  ❌ BAŞARISIZ: ${name}`);
      return false;
    }
  } catch (err) {
    evidence.failed++;
    console.error(`  ❌ HATA: ${name} -> ${err.message}`);
    return false;
  }
}

console.log('====================================================');
console.log('🔍 QUEUEDROP DERİN DENETİM VE KANIT TOPLAMA RAPORU');
console.log('====================================================\n');

// ----------------------------------------------------
// 1. DOM & Görünürlük Senkronizasyon Denetimi (Ö-3 / M-3)
// ----------------------------------------------------
console.log('--- 1. DOM & Senkronizasyon Denetimi ---');

const htmlContent = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf-8');
const enhanceContent = fs.readFileSync(path.join(__dirname, '../js/enhance.js'), 'utf-8');
const appContent = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf-8');

// enhance.js içerisindeki SYNCED_IDS'i çıkar
const syncedMatch = enhanceContent.match(/const SYNCED_IDS = \[([\s\S]*?)\];/);
const syncedIds = syncedMatch
  ? syncedMatch[1].split(',').map(s => s.replace(/['"\s]/g, '')).filter(Boolean)
  : [];

// index.html içindeki id="..." olanları bul
const idRegex = /id=["']([^"']+)["']/g;
const allHtmlIds = [];
let m;
while ((m = idRegex.exec(htmlContent)) !== null) {
  allHtmlIds.push(m[1]);
}

// Gerçek HTML5 [hidden] taşıyan öğelerin id'lerini bul (aria-hidden ve visually-hidden sınıflarını hariç tut)
const allTags = htmlContent.match(/<[^>]+>/g) || [];
const hiddenIds = [];
allTags.forEach(tag => {
  const stripped = tag.replace(/aria-hidden="[^"]*"/g, '').replace(/class="[^"]*"/g, '');
  if (/\bhidden\b/.test(stripped)) {
    const idM = tag.match(/id=["']([^"']+)["']/);
    if (idM && !hiddenIds.includes(idM[1])) {
      hiddenIds.push(idM[1]);
    }
  }
});

test('SYNCED_IDS içindeki tüm ID\'ler index.html\'de mevcut mu?', () => {
  const missingFromHtml = syncedIds.filter(id => !allHtmlIds.includes(id));
  if (missingFromHtml.length > 0) {
    recordFinding('HIGH', 'DOM-1', 'Var olmayan ID listelenmiş',
      'enhance.js SYNCED_IDS listesinde index.html içinde bulunmayan id var.',
      `Eksik: ${missingFromHtml.join(', ')}`);
    return false;
  }
  return true;
});

test('SYNCED_IDS içinde ölü (hidden taşımayan) ID var mı?', () => {
  const deadIds = syncedIds.filter(id => !hiddenIds.includes(id));
  if (deadIds.length > 0) {
    recordFinding('MEDIUM', 'DOM-2', 'SYNCED_IDS ölü girişler içeriyor',
      'SYNCED_IDS listesinde tanımlı öğeler index.html üzerinde hidden taşımıyor.',
      `hidden taşımayanlar: ${deadIds.join(', ')}`);
    return false;
  }
  return true;
});

test('hidden özniteliği taşıyan tüm öğeler senkronize ediliyor mu?', () => {
  const unmonitored = hiddenIds.filter(id => !syncedIds.includes(id));
  if (unmonitored.length > 0) {
    recordFinding('MEDIUM', 'DOM-3', 'hidden taşıyan ama izlenmeyen öğeler var',
      'Bazı öğeler hidden taşıyor ancak SYNCED_IDS içinde değil. app.js display yazarsa kalıcı olarak görünmez kalabilir.',
      `İzlenmeyenler: ${unmonitored.join(', ')}`);
    return false;
  }
  return true;
});

// ----------------------------------------------------
// 2. ARIA & Sekme Erişilebilirlik Denetimi (AccessibilityAuditor)
// ----------------------------------------------------
console.log('\n--- 2. ARIA & Sekme Erişilebilirlik Denetimi ---');

test('index.html üzerinde WAI-ARIA tablist ve tab rolleri tanımlı mı?', () => {
  const hasTablist = htmlContent.includes('role="tablist"');
  const hasTabs = htmlContent.includes('role="tab"');
  const hasControls = htmlContent.includes('aria-controls="builder-tab"') && htmlContent.includes('aria-controls="live-queue-tab"');
  return hasTablist && hasTabs && hasControls;
});

test('switchTab fonksiyonu aria-selected ve tabindex senkronize ediyor mu?', () => {
  const hasAriaSelected = appContent.includes("setAttribute('aria-selected'") || appContent.includes('setAttribute("aria-selected"');
  const hasTabindex = appContent.includes("setAttribute('tabindex'") || appContent.includes('setAttribute("tabindex"');
  const hasPanelHidden = appContent.includes('panel.hidden = !isActive') || appContent.includes('panel.hidden =');
  return hasAriaSelected && hasTabindex && hasPanelHidden;
});

test('Sekme butonlarında klavye ok tuşları (ArrowLeft / ArrowRight) dolaşımı var mı?', () => {
  const hasKeydown = appContent.includes('ArrowRight') && appContent.includes('ArrowLeft');
  return hasKeydown;
});

// ----------------------------------------------------
// 3. Güvenlik & PKCE OAuth State Denetimi (AppSec)
// ----------------------------------------------------
console.log('\n--- 3. Güvenlik ve PKCE OAuth Denetimi ---');

const authContent = fs.readFileSync(path.join(__dirname, '../js/auth.js'), 'utf-8');

test('OAuth state doğrulaması null/undefined durumunda bypass ediliyor mu? (CWE-352)', () => {
  const isVulnerable = /if\s*\(\s*expectedState\s*&&\s*returnedState\s*!==\s*expectedState\s*\)/.test(authContent);
  if (isVulnerable) {
    recordFinding('HIGH', 'SEC-1', 'OAuth State Eksikliği Atlatması (Bypass)',
      'expectedState null veya boş olduğunda koşul false döner ve doğrulama atlanır. Saldırgan kullanıcının oturumunu manipüle edebilir.',
      'if (expectedState && returnedState !== expectedState) -> expectedState falsy ise hata fırlatılmıyor!');
    return false;
  }
  return true;
});

test('Redirect URI normalize ediliyor mu? (index.html çift URI engeli)', () => {
  const hasNormalization = /pathname\.replace\(\/\\\/index\\\.html\?\$/i.test(authContent) ||
                           /replace\(\/\\\/index\\\.html\?\$'?,/i.test(authContent) ||
                           authContent.includes('replace(/\\/index\\.html?$/i');
  return hasNormalization;
});

test('Eşzamanlı isteklerde token yenileme yarışı (Race Condition) var mı?', () => {
  const hasLock = /refreshPromise|isRefreshing|refreshInProgress/.test(authContent);
  if (!hasLock) {
    recordFinding('MEDIUM', 'SEC-2', 'Token Yenileme Eşzamanlılık Yarışı (Race Condition)',
      'Birden fazla paralel API çağrısı aynı anda getValidToken() çağırdığında her biri ayrı refresh isteği gönderir.',
      'auth.js içinde refreshPromise kilidi bulunmuyor.');
    return false;
  }
  return true;
});

// ----------------------------------------------------
// 4. Parser & Spotify URL / URI Uç Durum Denetimi
// ----------------------------------------------------
console.log('\n--- 4. Parser & Spotify Katalog Uç Durum Denetimi (awesome-public-datasets) ---');

test('Tireli sanatçı/parça adı bölünme hatası: "Spider-Man"', () => {
  const parsed = Parser.parse('Spider-Man');
  const isChipped = parsed[0] && parsed[0].track === 'Spider' && parsed[0].artist === 'Man';
  if (isChipped) {
    recordFinding('HIGH', 'PARSE-1', 'Tireli kelimeler yanlışlıkla Şarkı-Sanatçı olarak bölünüyor',
      'Kullanıcı "Spider-Man" veya "Jay-Z" girdiğinde unspaced tire ayrıştırıcısı bunu "Spider" - "Man" olarak ikiye bölüyor.',
      `Girdi: "Spider-Man" -> Ayrışan: { track: "${parsed[0].track}", artist: "${parsed[0].artist}" }`);
    return false;
  }
  return true;
});

test('Tireli sanatçı adı: "Jay-Z"', () => {
  const parsed = Parser.parse('Jay-Z');
  const isChipped = parsed[0] && parsed[0].track === 'Jay' && parsed[0].artist === 'Z';
  if (isChipped) {
    recordFinding('HIGH', 'PARSE-2', 'Jay-Z gibi tireli isimler ikiye bölünüyor',
      'Sanatçı veya şarkı adı tek parça tireli olduğunda sağ ve sol parça yanlış eşleşiyor.',
      `Girdi: "Jay-Z" -> Ayrışan: { track: "${parsed[0].track}", artist: "${parsed[0].artist}" }`);
    return false;
  }
  return true;
});

test('Spaced tire ile doğru ayrışma: "Take On Me - A-ha"', () => {
  const parsed = Parser.parse('Take On Me - A-ha');
  return parsed[0] && parsed[0].track === 'Take On Me' && parsed[0].artist === 'A-ha';
});

test('Featuring (feat. / ft.) formatı: "Levitating feat. DaBaby - Dua Lipa"', () => {
  const parsed = Parser.parse('Levitating feat. DaBaby - Dua Lipa');
  return parsed[0] && parsed[0].track.includes('Levitating') && parsed[0].artist.includes('Dua Lipa');
});

test('Spotify Web URL ayrıştırma: "https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT"', () => {
  const parsed = Parser.parse('https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT?si=abc123xyz');
  return parsed[0] && parsed[0].spotifyId === '4cOdK2wGLETKBW3PvgPWqT';
});

test('Spotify URI ayrıştırma: "spotify:track:4cOdK2wGLETKBW3PvgPWqT"', () => {
  const parsed = Parser.parse('spotify:track:4cOdK2wGLETKBW3PvgPWqT');
  return parsed[0] && parsed[0].spotifyId === '4cOdK2wGLETKBW3PvgPWqT';
});

test('SpotifyAPI.getTrack metodu tanımlı ve çağrılabilir mi?', () => {
  return typeof SpotifyAPI.getTrack === 'function';
});

// ----------------------------------------------------
// Özet ve Rapor Çıktısı
// ----------------------------------------------------
console.log('\n====================================================');
console.log(`📊 DENETİM SONUCU: ${evidence.passed} GEÇTİ, ${evidence.failed} BAŞARISIZ`);
console.log(`🚩 Toplam Bulgu Sayısı: ${evidence.findings.length}`);
console.log('====================================================\n');

fs.writeFileSync(path.join(__dirname, 'evidence-results.json'), JSON.stringify(evidence, null, 2));
console.log('Sonuçlar test/evidence-results.json dosyasına kaydedildi.');
