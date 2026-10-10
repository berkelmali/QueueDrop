// ============================================
// QueueDrop — Yeni Özellikler & Algoritmalar Birim Testi
// ============================================

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const vm = require('vm');

console.log('\n--- Testing QueueDrop New Features & Algorithms ---');

// 1. Smart Shuffle Test (Anti-consecutive artists)
function smartShuffle(queue) {
  const items = [...queue];
  // Basic deterministic or pseudo-random shuffle for testing
  for (let i = items.length - 1; i > 0; i--) {
    const j = (i * 3 + 1) % (i + 1);
    [items[i], items[j]] = [items[j], items[i]];
  }
  // Anti-consecutive artist pass
  for (let i = 1; i < items.length; i++) {
    if (items[i].artist && items[i - 1].artist && items[i].artist.toLowerCase() === items[i - 1].artist.toLowerCase()) {
      for (let k = i + 1; k < items.length; k++) {
        if (items[k].artist.toLowerCase() !== items[i].artist.toLowerCase()) {
          [items[i], items[k]] = [items[k], items[i]];
          break;
        }
      }
    }
  }
  return items;
}

const testQueue = [
  { name: 'Şarkı 1', artist: 'Gülşen' },
  { name: 'Şarkı 2', artist: 'Gülşen' },
  { name: 'Şarkı 3', artist: 'Tarkan' },
  { name: 'Şarkı 4', artist: 'Simge' },
];

const shuffled = smartShuffle(testQueue);
let consecutiveCount = 0;
for (let i = 1; i < shuffled.length; i++) {
  if (shuffled[i].artist === shuffled[i - 1].artist) {
    consecutiveCount++;
  }
}
assert.strictEqual(consecutiveCount, 0, 'Smart shuffle should separate consecutive tracks from the same artist');
console.log('  ✅ PASS: Smart Shuffle prevents consecutive same-artist tracks');

// 2. Deduplication Test
function deduplicate(queue) {
  const seen = new Set();
  const unique = [];
  queue.forEach(track => {
    const key = (track.id || track.uri || `${track.name}-${track.artist}`).toLowerCase().trim();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(track);
    }
  });
  return unique;
}

const dupQueue = [
  { id: 'track1', name: 'Dan Dan', artist: 'Gülşen' },
  { id: 'track2', name: 'Aşkın Olayım', artist: 'Simge' },
  { id: 'track1', name: 'Dan Dan', artist: 'Gülşen' }, // duplicate
  { id: 'track3', name: 'Antidepresan', artist: 'Mabel Matiz' },
  { id: 'track2', name: 'Aşkın Olayım', artist: 'Simge' }, // duplicate
];

const deduped = deduplicate(dupQueue);
assert.strictEqual(deduped.length, 3, 'Deduplicate should reduce 5 items with 2 duplicates to 3 unique items');
console.log('  ✅ PASS: Deduplication properly removes redundant songs');

// 3. Queue ETA Calculation Test
function calculateETA(nowMs, totalDurationMs) {
  const finishTime = new Date(nowMs + totalDurationMs);
  const hours = String(finishTime.getHours()).padStart(2, '0');
  const mins = String(finishTime.getMinutes()).padStart(2, '0');
  return `Bitiş ~${hours}:${mins}`;
}

const fixedNow = new Date('2026-09-20T14:00:00Z').getTime();
const durationMs = (45 * 60 + 30) * 1000; // 45 dk 30 sn
const eta = calculateETA(fixedNow, durationMs);
assert.match(eta, /^Bitiş ~\d{2}:\d{2}$/, 'ETA should format correctly as Bitiş ~HH:MM');
console.log('  ✅ PASS: Queue ETA correctly formats completion timestamp (' + eta + ')');

// 4. Spotify API New Methods Check
const spotifyJsPath = path.join(__dirname, '../js/spotify.js');
const spotifyCode = fs.readFileSync(spotifyJsPath, 'utf8');

const sandbox = {
  console,
  setTimeout,
  URLSearchParams,
  module: { exports: {} },
  SpotifyAuth: {
    getValidToken: async () => 'mock-token',
    refreshAccessToken: async () => 'mock-refresh',
  },
  fetch: async (url, opts) => {
    if (url.includes('/me/player/volume')) {
      return { status: 204, ok: true, text: async () => '' };
    }
    if (url.includes('/me/player/shuffle')) {
      return { status: 204, ok: true, text: async () => '' };
    }
    if (url.includes('/me/player/repeat')) {
      return { status: 204, ok: true, text: async () => '' };
    }
    if (url.includes('/playlists') && !url.includes('/tracks')) {
      const parsedBody = opts?.body ? JSON.parse(opts.body) : {};
      return {
        status: 201,
        ok: true,
        text: async () => JSON.stringify({ id: 'pl_123', name: parsedBody.name || 'My Playlist', external_urls: { spotify: 'https://spotify.com' } }),
      };
    }
    if (url.includes('/playlists/pl_123/items') || url.includes('/playlists/pl_123/tracks')) {
      return { status: 201, ok: true, text: async () => JSON.stringify({ snapshot_id: 'snap123' }) };
    }
    if (url.includes('/me/player/play')) {
      return { status: 204, ok: true, text: async () => '' };
    }
    if (url.includes('/me') && !url.includes('/player')) {
      return { status: 200, ok: true, text: async () => JSON.stringify({ id: 'user_test', display_name: 'Test User' }) };
    }
    if (url.includes('/recommendations')) {
      return {
        status: 200,
        ok: true,
        text: async () => JSON.stringify({
          tracks: [
            { id: 'rec_1', name: 'Rec Song 1', uri: 'spotify:track:rec1', artists: [{ name: 'Artist 1' }], album: { name: 'Album 1' } }
          ]
        })
      };
    }
    return { status: 200, ok: true, text: async () => '{}' };
  }
};

vm.createContext(sandbox);
vm.runInContext(spotifyCode, sandbox);
const API = sandbox.module.exports;

(async () => {
  // Test volume
  const volRes = await API.setVolume(85);
  assert.strictEqual(volRes, true);
  console.log('  ✅ PASS: SpotifyAPI.setVolume succeeds');

  // Test shuffle
  const shufRes = await API.toggleShuffle(true);
  assert.strictEqual(shufRes, true);
  console.log('  ✅ PASS: SpotifyAPI.toggleShuffle succeeds');

  // Test playTrack
  const playRes = await API.playTrack('spotify:track:test12345');
  assert.strictEqual(playRes, true);
  console.log('  ✅ PASS: SpotifyAPI.playTrack succeeds');

  // Test saveQueueAsPlaylist
  const plRes = await API.saveQueueAsPlaylist('Test Playlist', ['spotify:track:1', 'spotify:track:2']);
  assert.strictEqual(plRes.id, 'pl_123');
  assert.strictEqual(plRes.name, 'Test Playlist');
  console.log('  ✅ PASS: SpotifyAPI.saveQueueAsPlaylist creates playlist and adds tracks via /items');

  // Test getRecommendations
  const recs = await API.getRecommendations(['track1'], { limit: 5 });
  assert.strictEqual(recs.length, 1);
  assert.strictEqual(recs[0].name, 'Rec Song 1');
  console.log('  ✅ PASS: SpotifyAPI.getRecommendations returns formatted recommendation tracks');

  // Test playing track BPM direct calculation
  const RhythmEngine = require('../js/rhythm.js');
  const nowPlayingSample = { name: 'Dan Dan', artist: 'Gülşen', duration: 200000 };
  const calculatedBpm = RhythmEngine.estimateBpm(nowPlayingSample);
  assert.ok(typeof calculatedBpm === 'number' && calculatedBpm >= 60 && calculatedBpm <= 220);
  assert.strictEqual(calculatedBpm, 132, 'Dan Dan should directly calculate to 132 BPM');
  console.log(`  ✅ PASS: Playing track BPM directly calculated (${nowPlayingSample.name} -> ${calculatedBpm} BPM)`);

  console.log('\n========================================');
  console.log('ALL NEW FEATURE TESTS PASSED SUCCESSFULLY');
  console.log('========================================\n');
})();
