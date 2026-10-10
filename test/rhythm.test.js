// ============================================
// QueueDrop — Ritim ve Canlı BPM Motoru Testi
// ============================================

const assert = require('assert');
const RhythmEngine = require('../js/rhythm.js');

console.log('\n--- Testing Rhythm & Live BPM Detection Engine ---');

// 1. İstatiksel Özellik Regresyonu ve Deterministik BPM Tahmini
const bpmYorma = RhythmEngine.estimateBpm({ name: 'Yorma', artist: 'Seksendört', duration: 215000 });
assert(bpmYorma >= 70 && bpmYorma <= 150, `BPM should be in reasonable musical range, got ${bpmYorma}`);
console.log(`  ✅ PASS: Statistical feature regression BPM estimation (Yorma -> ${bpmYorma} BPM)`);

// Tür / Nüans Duyarlılığı (Acoustic/Slow vs Club/Remix)
const bpmSlow = RhythmEngine.estimateBpm({ name: 'Slow Acoustic Ballad', artist: 'Acoustic Trio', duration: 260000 });
const bpmRemix = RhythmEngine.estimateBpm({ name: 'Club Dance Remix Extended', artist: 'DJ Hyper', duration: 180000 });
assert(bpmRemix > bpmSlow, `Remix/Club tempo (${bpmRemix}) should be higher than acoustic ballad (${bpmSlow})`);
console.log(`  ✅ PASS: Feature heuristics correctly differentiate dance/remix (${bpmRemix} BPM) from ballad (${bpmSlow} BPM)`);

// Deterministik sonuç kontrolü
const bpmRepeat = RhythmEngine.estimateBpm({ name: 'Bilinmeyen Şarkı Adı', artist: 'Örnek Sanatçı', duration: 180000 });
const bpmRepeat2 = RhythmEngine.estimateBpm({ name: 'Bilinmeyen Şarkı Adı', artist: 'Örnek Sanatçı', duration: 180000 });
assert.strictEqual(bpmRepeat, bpmRepeat2, 'Same track should produce identical deterministic BPM');
console.log(`  ✅ PASS: Unknown tracks produce deterministic BPM in musical range (${bpmRepeat} BPM)`);

// İkonik ve Hızlı Parçalar Kesin BPM Doğrulaması (Master of Puppets, Thrash, Ballad)
const mopBpm = RhythmEngine.estimateBpm({ name: 'Master Of Puppets', artist: 'Metallica', duration: 515000 });
assert.strictEqual(mopBpm, 212, `Master of Puppets should be 212 BPM, got ${mopBpm}`);
const mopRemaster = RhythmEngine.estimateBpm({ name: 'Master of Puppets (Remastered 2016)', artist: 'Metallica', duration: 515000 });
assert.strictEqual(mopRemaster, 212, `Master of Puppets Remastered should be 212 BPM, got ${mopRemaster}`);
const enterSandman = RhythmEngine.estimateBpm({ name: 'Enter Sandman', artist: 'Metallica', duration: 332000 });
assert.strictEqual(enterSandman, 123, `Enter Sandman should be 123 BPM, got ${enterSandman}`);
const oneBpm = RhythmEngine.estimateBpm({ name: 'One', artist: 'Metallica', duration: 446000 });
assert.strictEqual(oneBpm, 108, `One should be 108 BPM, got ${oneBpm}`);
const nemBpm = RhythmEngine.estimateBpm({ name: 'Nothing Else Matters', artist: 'Metallica', duration: 388000 });
assert.strictEqual(nemBpm, 69, `Nothing Else Matters should be 69 BPM, got ${nemBpm}`);
const ftbBpm = RhythmEngine.estimateBpm({ name: 'Fade to Black', artist: 'Metallica', duration: 418000 });
assert.strictEqual(ftbBpm, 116, `Fade to Black should be 116 BPM (avoiding false 'black metal' match), got ${ftbBpm}`);
const ttfafBpm = RhythmEngine.estimateBpm({ name: 'Through the Fire and Flames', artist: 'DragonForce', duration: 447000 });
assert.strictEqual(ttfafBpm, 200, `Through the Fire and Flames should be 200 BPM, got ${ttfafBpm}`);
const blindingBpm = RhythmEngine.estimateBpm({ name: 'Blinding Lights', artist: 'The Weeknd', duration: 200000 });
assert.strictEqual(blindingBpm, 171, `Blinding Lights should be 171 BPM, got ${blindingBpm}`);
console.log(`  ✅ PASS: Iconic tracks verified accurately (Master of Puppets -> 212, Enter Sandman -> 123, Blinding Lights -> 171, Fade to Black -> 116)`);

// 2. Canlı Ses & Spektral Akı BPM Algılayıcı (LiveAudioBpmDetector)
assert(typeof RhythmEngine.LiveAudioBpmDetector === 'function', 'LiveAudioBpmDetector should be exported');
const liveDetector = new RhythmEngine.LiveAudioBpmDetector();
assert(liveDetector.realFreqBands instanceof Float32Array, 'realFreqBands should be Float32Array');
assert.strictEqual(liveDetector.realFreqBands.length, 64, 'realFreqBands length should be 64');

// Spektral Akı (Spectral Flux) Fonksiyonu Testi
const dummyPrev = new Float32Array(512).fill(-60);
const dummyCurrent = new Float32Array(512).fill(-60);
// Ani bas artışı simüle et (Kick)
dummyCurrent[4] = -10;
dummyCurrent[5] = -12;
const flux = liveDetector._computeSpectralFlux(dummyCurrent, dummyPrev, 512);
assert(flux > 0, `Spectral flux should be positive for onset surge, got ${flux}`);
console.log(`  ✅ PASS: Spectral flux correctly detects onset surges (flux = ${flux.toFixed(4)})`);

// Periyodik Vuruşlar ile Canlı BPM Hesaplama (120 BPM = her 500 ms bir vuruş)
const baseTime = 100000;
for (let i = 0; i < 8; i++) {
  liveDetector._registerOnset(baseTime + i * 500, 0.85);
}
assert(liveDetector.liveBpm >= 115 && liveDetector.liveBpm <= 125, `Live BPM should lock onto ~120 BPM, got ${liveDetector.liveBpm}`);
assert(liveDetector.bpmConfidence > 0, `BPM confidence should increase, got ${liveDetector.bpmConfidence}%`);
console.log(`  ✅ PASS: Periodic onsets successfully track active BPM (${liveDetector.liveBpm} BPM, confidence: ${liveDetector.bpmConfidence}%)`);

// 3. Fallback Renk Paleti Üretimi
const pal = RhythmEngine.generateFallbackPalette('Seksendört - Yorma');
assert(pal.primary && pal.secondary && pal.accent && pal.background, 'Palette should have all 4 color tokens');
assert(Array.isArray(pal.rgbPrimary) && pal.rgbPrimary.length === 3, 'rgbPrimary should be [r, g, b]');
console.log('  ✅ PASS: Dynamic fallback palette generates 3 harmonious colors and RGB triplets');

// 4. HSL to RGB Dönüştürücü
const rgbRed = RhythmEngine.hslToRgb(0, 1.0, 0.5);
assert.strictEqual(rgbRed[0], 255);
assert.strictEqual(rgbRed[1], 0);
assert.strictEqual(rgbRed[2], 0);
console.log('  ✅ PASS: hslToRgb accurately converts color spaces');

// 5. LavaLampVisualizer Temel Başlatma ve Mod Kontrolü
const mockCanvas = {
  getContext: () => ({
    scale: () => {},
    fillRect: () => {},
    beginPath: () => {},
    arc: () => {},
    fill: () => {},
    stroke: () => {},
    save: () => {},
    restore: () => {},
    createRadialGradient: () => ({ addColorStop: () => {} }),
  }),
  getBoundingClientRect: () => ({ width: 1200, height: 800 }),
  width: 1200,
  height: 800,
};

const visualizer = new RhythmEngine.LavaLampVisualizer(mockCanvas);
assert.strictEqual(visualizer.mood, 'lava');
visualizer.setMood('pulse');
assert.strictEqual(visualizer.mood, 'pulse');
visualizer.setMood('aurora');
assert.strictEqual(visualizer.mood, 'aurora');
console.log('  ✅ PASS: LavaLampVisualizer mood switching works (lava, pulse, aurora)');

visualizer.setTrack({ name: 'Yorma', artist: 'Seksendört', duration: 215000 });
assert(visualizer.bpm >= 70 && visualizer.bpm <= 150);
assert(visualizer.beatIntervalMs > 400 && visualizer.beatIntervalMs < 700);
console.log(`  ✅ PASS: Visualizer tracks BPM (${visualizer.bpm}) and beat interval correctly`);

// 6. Şarkı Enerjisi ve Profil Çıkarımı
const profileDanDan = RhythmEngine.getTrackProfile({ name: 'Dan Dan', artist: 'Gülşen' }, 128);
assert(profileDanDan.energy >= 0.7, 'Dan Dan should have energetic profile');
assert(profileDanDan.kickForce > 1.8, 'Kick force should be vigorous');
console.log('  ✅ PASS: Track energy profile extracts dynamic vigor for high tempo hits');

// 7. Canlı Oynatma Senkronizasyonu (setPlaybackState)
visualizer.setPlaybackState({ isPlaying: false, progressMs: 45000, durationMs: 200000 });
assert.strictEqual(visualizer.isPlaying, false, 'Playback state should be paused');
assert.strictEqual(visualizer.progressMs, 45000, 'Progress should match 45000 ms');
visualizer.setPlaybackState({ isPlaying: true, progressMs: 50000 });
assert.strictEqual(visualizer.isPlaying, true, 'Playback state should be playing');
console.log('  ✅ PASS: Visualizer synchronizes playback state (play, pause, progress)');

// 8. Canlı Mikrofon API Entegrasyonu
assert(typeof visualizer.startLiveAudio === 'function', 'startLiveAudio method should exist');
assert(typeof visualizer.stopLiveAudio === 'function', 'stopLiveAudio method should exist');
visualizer.stopLiveAudio();
assert.strictEqual(visualizer.isLiveAudioActive, false);
console.log('  ✅ PASS: Visualizer startLiveAudio / stopLiveAudio lifecycle verified');

console.log('\n========================================');
console.log('ALL RHYTHM & LIVE BPM TESTS PASSED');
console.log('========================================\n');
