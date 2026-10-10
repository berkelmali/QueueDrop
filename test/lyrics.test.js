// ============================================
// QueueDrop — Senkronize Şarkı Sözleri (Lyrics) Testi
// ============================================

const assert = require('assert');
const LyricsEngine = require('../js/lyrics.js');

console.log('\n--- Testing Synchronized Lyrics (LRC) Engine ---');

// 1. Standart LRC Ayrıştırma
const sampleLrc = `
[ti:Canın Sağolsun]
[ar:Gülşen]
[00:12.50]Bir yanım git diyor, bir yanım kal
[00:16.80]Giden gitsin sen yanımda kal
[00:22.10]Canın sağolsun, her şey aşktan
`;

const parsed = LyricsEngine.parseLRC(sampleLrc);
assert.strictEqual(parsed.length, 3, 'Meta tags should be skipped and 3 lines parsed');
assert.strictEqual(parsed[0].timeMs, 12500, '00:12.50 should convert to 12500 ms');
assert.strictEqual(parsed[0].text, 'Bir yanım git diyor, bir yanım kal');
assert.strictEqual(parsed[1].timeMs, 16800, '00:16.80 should convert to 16800 ms');
assert.strictEqual(parsed[2].timeMs, 22100, '00:22.10 should convert to 22100 ms');
console.log('  ✅ PASS: Standard LRC timestamps and metadata filtering');

// 2. 3 Basamaklı Milisaniye Formatı
const threeDigitLrc = `
[01:05.123] Üç basamaklı milisaniye testi
[02:10.005] İkinci satır
`;
const parsed3 = LyricsEngine.parseLRC(threeDigitLrc);
assert.strictEqual(parsed3[0].timeMs, 65123, '01:05.123 should convert to 65123 ms');
assert.strictEqual(parsed3[1].timeMs, 130005, '02:10.005 should convert to 130005 ms');
console.log('  ✅ PASS: 3-digit millisecond LRC format supported');

// 3. Çoklu Zaman Damgası Tek Satırda (Multi-timestamp line)
const multiLrc = `
[00:10.00][00:25.00] Nakarat tekrarı
`;
const parsedMulti = LyricsEngine.parseLRC(multiLrc);
assert.strictEqual(parsedMulti.length, 2, 'One line with two timestamps should produce 2 entries');
assert.strictEqual(parsedMulti[0].timeMs, 10000);
assert.strictEqual(parsedMulti[1].timeMs, 25000);
assert.strictEqual(parsedMulti[0].text, 'Nakarat tekrarı');
assert.strictEqual(parsedMulti[1].text, 'Nakarat tekrarı');
console.log('  ✅ PASS: Multi-timestamp single-line handling');

// 4. Aktif Satır Bulma (Active Line Matcher - Binary Search)
const testLines = [
  { timeMs: 10000, text: 'Satır 1' },
  { timeMs: 20000, text: 'Satır 2' },
  { timeMs: 30000, text: 'Satır 3' },
  { timeMs: 40000, text: 'Satır 4' },
];

assert.strictEqual(LyricsEngine.getActiveLineIndex(testLines, 5000), -1, 'Before first line should be -1');
assert.strictEqual(LyricsEngine.getActiveLineIndex(testLines, 10000), 0, 'Exact start should be index 0');
assert.strictEqual(LyricsEngine.getActiveLineIndex(testLines, 15000), 0, 'Midway line 1 should be index 0');
assert.strictEqual(LyricsEngine.getActiveLineIndex(testLines, 20000), 1, 'Exact start of line 2 should be index 1');
assert.strictEqual(LyricsEngine.getActiveLineIndex(testLines, 29999), 1, 'End of line 2 should be index 1');
assert.strictEqual(LyricsEngine.getActiveLineIndex(testLines, 35000), 2, 'Line 3 should be index 2');
assert.strictEqual(LyricsEngine.getActiveLineIndex(testLines, 50000), 3, 'After last line should be last index (3)');
console.log('  ✅ PASS: Active line detection algorithm across all edge cases');

// 5. Başlık Temizleme (Clean Track Title)
assert.strictEqual(LyricsEngine.cleanTrackTitle('Bohemian Rhapsody - 2011 Remaster'), 'Bohemian Rhapsody');
assert.strictEqual(LyricsEngine.cleanTrackTitle('Levitating (feat. DaBaby)'), 'Levitating');
assert.strictEqual(LyricsEngine.cleanTrackTitle('Save Your Tears ft. Ariana Grande'), 'Save Your Tears');
console.log('  ✅ PASS: Track title cleaner strips remaster and feat suffixes');

// 6. Yerleşik Fixture Sözleri Çekme Testi
(async () => {
  const lyrics = await LyricsEngine.fetchLyrics('Dan Dan', 'Gülşen', 202000);
  assert.strictEqual(lyrics.synced, true, 'Should find synced lyrics for Dan Dan');
  assert(lyrics.lines.length > 5, 'Should have multiple lines');
  assert.strictEqual(lyrics.lines[1].text, 'Soğudu havalar burda güneş açmıyo\'');
  console.log('  ✅ PASS: Embedded fixture lyrics retrieved instantly for Dan Dan');

  console.log('\n========================================');
  console.log('ALL SYNCHRONIZED LYRICS TESTS PASSED');
  console.log('========================================\n');
})();
