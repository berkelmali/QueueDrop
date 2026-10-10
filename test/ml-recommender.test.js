const assert = require('assert');
const MLRecommender = require('../js/ml-recommender.js');

console.log('\n--- Testing Machine Learning Recommender & Auto-Completion Engine ---');

// 1. Test Feature Vector Extraction & Normalization
const bangirVec = MLRecommender.extractFeatureVector({ name: 'Bangır Bangır', artist: 'Gülşen' });
assert.strictEqual(bangirVec.length, 8);
bangirVec.forEach((val, idx) => {
  assert.ok(val >= 0 && val <= 1, `Feature index ${idx} value (${val}) should be in [0, 1]`);
});
assert.ok(bangirVec[0] > 0.85, 'Bangır Bangır should have high energy (>0.85)');
console.log('  ✅ PASS: 8D Feature vector extraction and [0, 1] normalization verified');

// 2. Test Weighted Cosine Similarity
const simIdentical = MLRecommender.weightedCosineSimilarity(bangirVec, bangirVec);
assert.ok(Math.abs(simIdentical - 1.0) < 0.0001, 'Identical vectors must have cosine similarity 1.0');

const chillVec = MLRecommender.extractFeatureVector({ name: 'Tükeneceğiz', artist: 'Sezen Aksu' });
const simDissimilar = MLRecommender.weightedCosineSimilarity(bangirVec, chillVec);
assert.ok(simDissimilar < 0.85, 'High-energy dance and acoustic ballad should have lower cosine similarity');
console.log('  ✅ PASS: Weighted cosine similarity metrics accurate');

// 3. Test Tempo Transition & Harmonic Alignment
const tempo1x = MLRecommender.calculateTempoTransitionScore(124, 126);
assert.ok(tempo1x > 0.90, 'Adjacent BPMs (124 -> 126) should have high transition score (>0.90)');

const tempoHarmonic = MLRecommender.calculateTempoTransitionScore(85, 170);
assert.ok(tempoHarmonic > 0.80, 'Double-time BPM (85 -> 170) should be recognized via harmonic alignment (>0.80)');

const tempoClash = MLRecommender.calculateTempoTransitionScore(65, 140);
assert.ok(tempoClash < tempo1x, 'Mismatched tempos should have lower transition score');
console.log('  ✅ PASS: Markov tempo continuity and harmonic half/double-time alignment verified');

// 4. Test Queue Analysis & Dynamic Centroid
const mockQueue = [
  { name: 'Bangır Bangır', artist: 'Gülşen', bpm: 128 },
  { name: 'Dan Dan', artist: 'Gülşen', bpm: 128 },
  { name: 'Kuzu Kuzu', artist: 'Tarkan', bpm: 126 },
];
const analysis = MLRecommender.analyzeQueue(mockQueue);
assert.strictEqual(analysis.trackCount, 3);
assert.ok(analysis.avgBpm >= 125 && analysis.avgBpm <= 129, `Average BPM should be ~127, got ${analysis.avgBpm}`);
assert.ok(analysis.avgEnergy > 0.85, 'Energy should be classified as club/dance');
assert.strictEqual(analysis.recentArtists.length, 2);
console.log(`  ✅ PASS: Queue profiling & centroid calculation (Avg BPM: ${analysis.avgBpm}, Energy: ${analysis.energyLabel})`);

// 5. Test Vibe Projections & Recommendations
const similarRecs = MLRecommender.recommendTracks({ queue: mockQueue, vibe: 'similar', limit: 3 });
assert.strictEqual(similarRecs.length, 3);
// Should not recommend songs already in queue
const queueNames = mockQueue.map(m => m.name.toLowerCase());
similarRecs.forEach(r => {
  assert.ok(!queueNames.includes(r.name.toLowerCase()), `Recommended track ${r.name} should not already be in queue`);
  assert.ok(r.matchConfidence >= 75 && r.matchConfidence <= 100, 'Match confidence should be realistic %');
  assert.ok(r.mlTag, 'Recommended track should contain explainable ML tag');
});
console.log('  ✅ PASS: Vibe "similar" generates valid non-duplicate recommendations with ML tags');

// 6. Test Party Vibe Projects High Energy
const partyRecs = MLRecommender.recommendTracks({ queue: mockQueue, vibe: 'party', limit: 3 });
partyRecs.forEach(r => {
  assert.ok(r.energy >= 0.70, `Party recommendation ${r.name} should have high energy`);
});
console.log('  ✅ PASS: Vibe "party" boosts high-energy dance tracks');

// 7. Test Chill Vibe Projects Lower Energy & High Acousticness
const chillRecs = MLRecommender.recommendTracks({ queue: mockQueue, vibe: 'chill', limit: 3 });
chillRecs.forEach(r => {
  assert.ok(r.energy <= 0.65 || r.acousticness >= 0.3, `Chill recommendation ${r.name} should be acoustic/chill`);
});
console.log('  ✅ PASS: Vibe "chill" projects toward relaxed/acoustic music');

// 8. Test MMR Diversity (Discovery Mode)
const discoveryRecs = MLRecommender.recommendTracks({ queue: mockQueue, vibe: 'discovery', limit: 4 });
const discoveryArtists = new Set(discoveryRecs.map(r => r.artist.toLowerCase()));
assert.ok(discoveryArtists.size >= 3, 'Discovery mode with MMR must maximize artist diversity');
console.log('  ✅ PASS: Maximum Marginal Relevance (MMR) enforces artist diversity in discovery mode');

// 9. Test Builder Autocomplete
const autoMatches = MLRecommender.suggestAutocomplete('Gul');
const autoMatchesAscii = MLRecommender.suggestAutocomplete('Gül');
assert.ok(autoMatches.length > 0 || autoMatchesAscii.length > 0, 'Autocomplete should match Gülşen');
console.log('  ✅ PASS: Fast N-gram autocomplete returns catalog suggestions');

// 10. Test Sequence Prediction from Draft Text
const draft = 'Duman - Senden Daha Güzel → mor ve ötesi - Bir Derdim Var';
const nextTracks = MLRecommender.predictNextFromDraft(draft, 'similar', 3);
assert.strictEqual(nextTracks.length, 3);
console.log(`  ✅ PASS: Draft prediction predicted: "${nextTracks.map(t => t.name).join(', ')}" for rock draft`);

// 11. Test Real-Time Live BPM State Management
MLRecommender.setLiveBpm(128, 92, 'live_audio', 'track_test_1');
const liveState = MLRecommender.getLiveBpm();
assert.strictEqual(liveState.bpm, 128);
assert.strictEqual(liveState.confidence, 92);
assert.strictEqual(liveState.source, 'live_audio');
console.log(`  ✅ PASS: Real-time live BPM state registered (BPM: ${liveState.bpm}, Conf: %${liveState.confidence})`);

// 12. Test Live BPM Feature Vector Calibration & RhythmEngine Grounding
const nowPlayingTrack = { name: 'Canlı Çalan Parça', artist: 'Canlı Grup' };
const calibratedVec = MLRecommender.extractFeatureVector(nowPlayingTrack, { isNowPlaying: true });
// 128 BPM -> tempoNorm = (128 - 60) / 140 = 68 / 140 ≈ 0.4857
assert.ok(Math.abs(calibratedVec[3] - ((128 - 60) / 140)) < 0.01, 'tempoNorm should be calibrated to live 128 BPM');

// Doğrulanmış ikonik parça (Master of Puppets -> 212 BPM) RhythmEngine üzerinden ML özellik vektörüne yansımalı
const mopVec = MLRecommender.extractFeatureVector({ name: 'Master Of Puppets', artist: 'Metallica' });
const expectedMopNorm = Math.max(0, Math.min(1, (212 - 60) / 140)); // 1.0 (clamped)
assert.strictEqual(mopVec[3], expectedMopNorm, 'Master of Puppets should use verified 212 BPM in ML vector');
console.log('  ✅ PASS: Feature vector calibrated with live BPM and RhythmEngine ground truth');

// 13. Test Queue Profiling with Live Grounded Calibration
const liveQueueTest = [
  { name: 'Kuyruk 1', artist: 'Sanatçı 1', bpm: 120 },
  { name: 'Kuyruk 2', artist: 'Sanatçı 2', bpm: 124 },
];
const liveCalibratedAnalysis = MLRecommender.analyzeQueue(liveQueueTest, { name: 'Çalan Parça', artist: 'Canlı Sanatçı' });
assert.strictEqual(liveCalibratedAnalysis.isLiveBpmCalibrated, true, 'Queue analysis should be marked as live BPM calibrated');
assert.strictEqual(liveCalibratedAnalysis.liveBpm, 128, 'Live BPM in queue analysis should be 128');
assert.strictEqual(liveCalibratedAnalysis.bpmConfidence, 92, 'BPM confidence should match 92');
console.log(`  ✅ PASS: Live BPM queue calibration verified (Live: ${liveCalibratedAnalysis.liveBpm} BPM, %${liveCalibratedAnalysis.bpmConfidence})`);

// 14. Test Live Beatmatching Recommendations & Dynamic ML Tags
const liveBeatmatchRecs = MLRecommender.recommendTracks({
  queue: liveQueueTest,
  nowPlaying: { name: 'Çalan Parça', artist: 'Canlı Sanatçı' },
  vibe: 'similar',
  limit: 3,
  liveBpm: 128,
});
assert.strictEqual(liveBeatmatchRecs.length, 3);
const hasBeatmatched = liveBeatmatchRecs.some(r => r.isLiveBeatmatched || r.mlTag.includes('BPM Eşleşmesi') || r.mlTag.includes('Beatmatch'));
assert.ok(hasBeatmatched, 'At least one candidate should be beatmatched or tagged with live BPM compatibility');
console.log(`  ✅ PASS: Real-time beatmatching recommendations generated (Tag: "${liveBeatmatchRecs[0].mlTag}")`);

// 15. Test State Reset / Cleanup
MLRecommender.clearLiveBpm();
const clearedState = MLRecommender.getLiveBpm();
assert.strictEqual(clearedState.bpm, null);
assert.strictEqual(clearedState.confidence, 0);
console.log('  ✅ PASS: Live BPM state successfully cleared');

console.log('\n========================================');
console.log('ALL ML RECOMMENDER & LIVE BPM TESTS PASSED');
console.log('========================================\n');
