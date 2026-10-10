// ============================================
// QueueDrop — Unit Tests (Parser & Helpers)
// ============================================

const Parser = require('../js/parser.js');
const SpotifyAPI = require('../js/spotify.js');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✅ PASS: ${message}`);
  } else {
    failed++;
    console.error(`  ❌ FAIL: ${message}`);
  }
}

function assertEqual(actual, expected, message) {
  const isMatch = JSON.stringify(actual) === JSON.stringify(expected);
  if (isMatch) {
    passed++;
    console.log(`  ✅ PASS: ${message}`);
  } else {
    failed++;
    console.error(`  ❌ FAIL: ${message}\n     Expected: ${JSON.stringify(expected)}\n     Actual:   ${JSON.stringify(actual)}`);
  }
}

console.log('\n--- 1. Testing Arrow Separated Input (User Prompt Example) ---');
{
  const input = 'Canın Sağolsun-gülşen → Dan Dan-gülşen → Yurtta Aşk Cihanda Aşk-gülşen → İtaat Yok-gülşen';
  const result = Parser.parse(input);
  assertEqual(result.length, 4, 'Should parse 4 items');
  assertEqual(result[0].track, 'Canın Sağolsun', 'Item 1 track is Canın Sağolsun');
  assertEqual(result[0].artist.toLowerCase(), 'gülşen', 'Item 1 artist is gülşen');
  assertEqual(result[1].track, 'Dan Dan', 'Item 2 track is Dan Dan');
  assertEqual(result[1].artist.toLowerCase(), 'gülşen', 'Item 2 artist is gülşen');
  assertEqual(result[2].track, 'Yurtta Aşk Cihanda Aşk', 'Item 3 track is Yurtta Aşk Cihanda Aşk');
  assertEqual(result[2].artist.toLowerCase(), 'gülşen', 'Item 3 artist is gülşen');
  assertEqual(result[3].track, 'İtaat Yok', 'Item 4 track is İtaat Yok');
  assertEqual(result[3].artist.toLowerCase(), 'gülşen', 'Item 4 artist is gülşen');
}

console.log('\n--- 2. Testing ASCII Arrow (->) and Semicolon (;) Separators ---');
{
  const input = 'Anti-Hero - Taylor Swift -> Flowers - Miley Cyrus ; Blinding Lights - The Weeknd';
  const result = Parser.parse(input);
  assertEqual(result.length, 3, 'Should parse 3 items across different separators');
  assertEqual(result[0].track, 'Anti-Hero', 'Handles hyphen in song title (Anti-Hero)');
  assertEqual(result[0].artist, 'Taylor Swift', 'Item 1 artist is Taylor Swift');
  assertEqual(result[1].track, 'Flowers', 'Item 2 track is Flowers');
  assertEqual(result[2].track, 'Blinding Lights', 'Item 3 track is Blinding Lights');
}

console.log('\n--- 3. Testing Multiline Input & Numbered Lists ---');
{
  const input = `1. Dudu - Tarkan
2. Kuzu Kuzu - Tarkan
3) Şımarık - Tarkan`;
  const result = Parser.parse(input);
  assertEqual(result.length, 3, 'Should parse 3 items on separate lines');
  assertEqual(result[0].track, 'Dudu', 'Strips leading list number "1."');
  assertEqual(result[0].artist, 'Tarkan', 'Item 1 artist is Tarkan');
  assertEqual(result[1].track, 'Kuzu Kuzu', 'Item 2 track is Kuzu Kuzu');
  assertEqual(result[2].track, 'Şımarık', 'Strips leading list number "3)"');
}

console.log('\n--- 4. Testing Turkish Normalization & Fuzzy Similarity ---');
{
  const normalized = Parser.normalizeTurkish('Gülşen - Canın Sağolsun');
  assert(!normalized.includes('ü') && !normalized.includes('ş') && !normalized.includes('ı'), 'Replaces Turkish characters ü, ş, ı');

  const simExact = Parser.similarity('Gülşen', 'Gulsen');
  assert(simExact >= 0.9, 'Fuzzy similarity between Gülşen and Gulsen should be >= 0.9');

  const match = Parser.fuzzyMatch('Canın Sağolsun', 'canin sagolsun');
  assert(match === true, 'fuzzyMatch handles case and diacritics');
}

console.log('\n--- 5. Testing Validation Logic ---');
{
  const items = [
    { track: 'Believer', artist: 'Imagine Dragons' },
    { track: '', artist: 'Unknown' },
    { track: 'Only Track', artist: '' },
  ];
  const { valid, warnings } = Parser.validate(items);
  assertEqual(valid.length, 2, 'Valid tracks should be 2 (one with artist, one track-only)');
  assertEqual(warnings.length, 2, 'Warnings should be generated for missing track name and missing artist');
}

console.log('\n--- 6. Testing Duration Formatting ---');
{
  assertEqual(SpotifyAPI.formatDuration(0), '0:00', '0 ms formats to 0:00');
  assertEqual(SpotifyAPI.formatDuration(65000), '1:05', '65,000 ms formats to 1:05');
  assertEqual(SpotifyAPI.formatDuration(215000), '3:35', '215,000 ms formats to 3:35');
  assertEqual(SpotifyAPI.formatTotalDuration(150000), '2 dk', '150,000 ms formats to 2 dk');
  assertEqual(SpotifyAPI.formatTotalDuration(3660000), '1 sa 1 dk', '3,660,000 ms formats to 1 sa 1 dk');
}

console.log('\n--- 7. Testing Music Dataset Fixtures (awesome-public-datasets) ---');
{
  const fs = require('fs');
  const path = require('path');
  const fixturesData = JSON.parse(fs.readFileSync(path.join(__dirname, 'datasets/music-fixtures.json'), 'utf-8'));

  fixturesData.fixtures.forEach((f, idx) => {
    const parsed = Parser.parse(f.input);
    assertEqual(parsed.length, f.expected.length, `Fixture #${idx + 1} (${f.category}): item count matches`);
    f.expected.forEach((exp, i) => {
      if (parsed[i]) {
        assertEqual(parsed[i].track, exp.track, `Fixture #${idx + 1} item #${i + 1} track matches`);
        assertEqual(parsed[i].artist, exp.artist, `Fixture #${idx + 1} item #${i + 1} artist matches`);
        if (exp.spotifyId) {
          assertEqual(parsed[i].spotifyId, exp.spotifyId, `Fixture #${idx + 1} item #${i + 1} spotifyId matches`);
        }
      }
    });
  });
}

console.log('\n========================================');
console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log('========================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}

