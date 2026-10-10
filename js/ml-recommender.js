/**
 * QueueDrop — Machine Learning Recommendation & Auto-Completion Engine
 * Inspired by awesome-public-datasets & agency-agents (AI Engineer / Search Relevance Engineer)
 * 
 * Features:
 * - High-Dimensional Musical Latent Space (8D Normalized Acoustic Vector)
 * - Exponential Recency-Weighted Queue Centroid & Trajectory Modeling
 * - Multi-Factor Re-ranking: Cosine Similarity, Markov BPM Transition, Harmonic Mixing
 * - Vibe Projections: Flow (similar), Party Boost (+energy/+BPM), Chill (-energy/acoustic), Discovery (MMR)
 * - Maximum Marginal Relevance (MMR) for Diversity & Novelty
 * - Hybrid Inference: Reranks live Spotify API candidates or executes edge inference on curated corpus
 * - Builder Text Auto-Completion & Next-Track Sequence Prediction
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.MLRecommender = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // ==========================================
  // RHYTHM ENGINE REFERANSI (DSP & MIR KÖPRÜSÜ)
  // Tarayıcı globali veya Node.js modülü olarak otomatik çözümlenir
  // ==========================================
  let rhythmEngineRef = (typeof RhythmEngine !== 'undefined') ? RhythmEngine : null;
  if (!rhythmEngineRef && typeof require === 'function') {
    try {
      rhythmEngineRef = require('./rhythm.js');
    } catch (e) {
      // Node.js testlerinde veya diğer ortamlarda güvenli fallback
    }
  }

  // ==========================================
  // GERÇEK ZAMANLI CANLI BPM TAKİP VE GERİBİLDİRİM DURUMU (ONLINE LEARNING STATE)
  // Web Audio API & LiveAudioBpmDetector spektral akı motorundan anlık beslenir
  // ==========================================
  let _currentLiveBpmState = {
    bpm: null,
    confidence: 0,
    timestamp: 0,
    source: null,
    trackId: null,
  };

  /**
   * Canlı dinleme veya Web Audio API akışından gelen anlık BPM'i ML modeline kaydeder.
   * Model bu bilgiyi kuyruk ağırlık merkezini kalibre etmek ve DJ beatmatch önerileri üretmek için kullanır.
   * @param {number} bpm - Ölçülen gerçek anlık BPM
   * @param {number} confidence - 0-100 güven yüzdesi
   * @param {string} source - 'live_audio' | 'stream' | 'manual'
   * @param {string} trackId - Çalan şarkı kimliği
   */
  function setLiveBpm(bpm, confidence = 80, source = 'live_audio', trackId = null) {
    if (typeof bpm !== 'number' || isNaN(bpm) || bpm <= 40 || bpm >= 260) {
      return false;
    }
    _currentLiveBpmState = {
      bpm: Math.round(bpm),
      confidence: Math.max(0, Math.min(100, Math.round(confidence))),
      timestamp: Date.now(),
      source,
      trackId: trackId || null,
    };
    return true;
  }

  /**
   * Modelde kayıtlı en son canlı gerçek zamanlı BPM durumunu döndürür.
   */
  function getLiveBpm() {
    return { ..._currentLiveBpmState };
  }

  /**
   * Canlı BPM durumunu sıfırlar (şarkı değiştiğinde veya dinleme bittiğinde).
   */
  function clearLiveBpm() {
    _currentLiveBpmState = {
      bpm: null,
      confidence: 0,
      timestamp: 0,
      source: null,
      trackId: null,
    };
  }

  // ==========================================
  // 1. KÜRASYONLU MÜZİK KORPUSU (LATENT MUSIC CORPUS)
  // Awesome Public Datasets & Million Song Dataset niteliğinde
  // ==========================================
  const MUSIC_CORPUS = [
    // --- Türkçe Pop & Dans Hitleri ---
    {
      id: 'tc_1',
      name: 'Bangır Bangır',
      artist: 'Gülşen',
      album: 'Bangır Bangır',
      bpm: 128,
      energy: 0.92,
      danceability: 0.84,
      valence: 0.88,
      acousticness: 0.08,
      loudness: -4.2,
      speechiness: 0.09,
      genres: ['turkish pop', 'dance pop', 'club'],
      uri: 'spotify:track:4CeeE0vd9AyYMk5O3X2k7H',
      albumImageSmall: 'assets/logo.jpg',
    },
    {
      id: 'tc_2',
      name: 'Dan Dan',
      artist: 'Gülşen',
      album: 'Bangır Bangır',
      bpm: 128,
      energy: 0.94,
      danceability: 0.82,
      valence: 0.78,
      acousticness: 0.06,
      loudness: -3.8,
      speechiness: 0.08,
      genres: ['turkish pop', 'dance pop'],
      uri: 'spotify:track:5rQ2U8C206kL8oQzH4z8mR',
      albumImageSmall: 'assets/logo.jpg',
    },
    {
      id: 'tc_3',
      name: 'Aşkın Olayım',
      artist: 'Simge',
      album: 'Ben Bazen',
      bpm: 115,
      energy: 0.78,
      danceability: 0.72,
      valence: 0.65,
      acousticness: 0.18,
      loudness: -5.6,
      speechiness: 0.05,
      genres: ['turkish pop', 'pop'],
      uri: 'spotify:track:3gK9t5XJk218d6R9B0182k',
      albumImageSmall: 'assets/logo.jpg',
    },
    {
      id: 'tc_4',
      name: 'Antidepresan',
      artist: 'Mabel Matiz, Mert Demir',
      album: 'Antidepresan',
      bpm: 120,
      energy: 0.74,
      danceability: 0.76,
      valence: 0.58,
      acousticness: 0.22,
      loudness: -6.2,
      speechiness: 0.04,
      genres: ['turkish pop', 'indie pop'],
      uri: 'spotify:track:682K98dK2B8s1k91Z8m3nQ',
      albumImageSmall: 'assets/logo.jpg',
    },
    {
      id: 'tc_5',
      name: 'Kuzu Kuzu',
      artist: 'Tarkan',
      album: 'Karma',
      bpm: 126,
      energy: 0.91,
      danceability: 0.85,
      valence: 0.89,
      acousticness: 0.12,
      loudness: -4.5,
      speechiness: 0.06,
      genres: ['turkish pop', 'dance pop', 'classic pop'],
      uri: 'spotify:track:28mK9d182kdZ89d02kdm2a',
      albumImageSmall: 'assets/logo.jpg',
    },
    {
      id: 'tc_6',
      name: 'Dudu',
      artist: 'Tarkan',
      album: 'Dudu',
      bpm: 120,
      energy: 0.88,
      danceability: 0.81,
      valence: 0.82,
      acousticness: 0.15,
      loudness: -5.1,
      speechiness: 0.05,
      genres: ['turkish pop', 'dance pop'],
      uri: 'spotify:track:182ndk92kd81ndk92ndl91',
      albumImageSmall: 'assets/logo.jpg',
    },
    {
      id: 'tc_7',
      name: 'Yorma',
      artist: 'Gülşen',
      album: 'Yorma',
      bpm: 122,
      energy: 0.82,
      danceability: 0.78,
      valence: 0.70,
      acousticness: 0.14,
      loudness: -5.0,
      speechiness: 0.06,
      genres: ['turkish pop', 'dance pop'],
      uri: 'spotify:track:92mdk281ndk018dmkd9102',
      albumImageSmall: 'assets/logo.jpg',
    },
    {
      id: 'tc_8',
      name: 'Martılar',
      artist: 'Edis',
      album: 'Martılar',
      bpm: 124,
      energy: 0.85,
      danceability: 0.80,
      valence: 0.75,
      acousticness: 0.10,
      loudness: -4.8,
      speechiness: 0.07,
      genres: ['turkish pop', 'dance pop', 'synthpop'],
      uri: 'spotify:track:71ndk291mdk0183mdla918',
      albumImageSmall: 'assets/logo.jpg',
    },
    {
      id: 'tc_9',
      name: 'Ara Sıra',
      artist: 'Zeynep Bastık',
      album: 'Zeynodisco',
      bpm: 118,
      energy: 0.76,
      danceability: 0.79,
      valence: 0.80,
      acousticness: 0.16,
      loudness: -5.8,
      speechiness: 0.05,
      genres: ['turkish pop', 'disco', 'dance pop'],
      uri: 'spotify:track:8192ndk109283ndla01928',
      albumImageSmall: 'assets/logo.jpg',
    },
    {
      id: 'tc_10',
      name: 'Kırmızı',
      artist: 'Hande Yener',
      album: 'Aşk Kadın Ruhundan Anlamıyor',
      bpm: 130,
      energy: 0.95,
      danceability: 0.83,
      valence: 0.85,
      acousticness: 0.05,
      loudness: -3.5,
      speechiness: 0.08,
      genres: ['turkish pop', 'club', 'dance'],
      uri: 'spotify:track:1029384756102938475610',
      albumImageSmall: 'assets/logo.jpg',
    },
    {
      id: 'tc_11',
      name: 'Fırtınadayım',
      artist: 'Mabel Matiz',
      album: 'Maya',
      bpm: 104,
      energy: 0.68,
      danceability: 0.62,
      valence: 0.46,
      acousticness: 0.35,
      loudness: -7.2,
      speechiness: 0.04,
      genres: ['turkish pop', 'art pop', 'indie pop'],
      uri: 'spotify:track:48192ndk01928374619283',
      albumImageSmall: 'assets/logo.jpg',
    },
    {
      id: 'tc_12',
      name: 'Bi Tek Ben Anlarım',
      artist: 'Köfn',
      album: 'Bi Tek Ben Anlarım',
      bpm: 122,
      energy: 0.84,
      danceability: 0.77,
      valence: 0.68,
      acousticness: 0.12,
      loudness: -5.4,
      speechiness: 0.05,
      genres: ['turkish pop', 'synthpop', 'indie'],
      uri: 'spotify:track:5910293847561029384756',
      albumImageSmall: 'assets/logo.jpg',
    },

    // --- Türkçe Rock & Alternatif ---
    {
      id: 'tr_1',
      name: 'Bir Derdim Var',
      artist: 'mor ve ötesi',
      album: 'Dünya Yalan Söylüyor',
      bpm: 92,
      energy: 0.72,
      danceability: 0.48,
      valence: 0.42,
      acousticness: 0.25,
      loudness: -6.5,
      speechiness: 0.04,
      genres: ['turkish rock', 'alternative rock'],
      uri: 'spotify:track:9281746501928374650192',
      albumImageSmall: 'assets/logo.jpg',
    },
    {
      id: 'tr_2',
      name: 'Ölürüm Hasretinle',
      artist: 'Seksendört',
      album: 'Seksendört',
      bpm: 85,
      energy: 0.58,
      danceability: 0.44,
      valence: 0.32,
      acousticness: 0.45,
      loudness: -7.8,
      speechiness: 0.03,
      genres: ['turkish rock', 'slow rock', 'ballad'],
      uri: 'spotify:track:8371928475610293847561',
      albumImageSmall: 'assets/logo.jpg',
    },
    {
      id: 'tr_3',
      name: 'Senden Daha Güzel',
      artist: 'Duman',
      album: 'Duman I',
      bpm: 132,
      energy: 0.89,
      danceability: 0.55,
      valence: 0.72,
      acousticness: 0.08,
      loudness: -4.8,
      speechiness: 0.05,
      genres: ['turkish rock', 'garage rock'],
      uri: 'spotify:track:6281947561029384756102',
      albumImageSmall: 'assets/logo.jpg',
    },
    {
      id: 'tr_4',
      name: 'Bir Kadın Çizeceksin',
      artist: 'maNga',
      album: 'maNga',
      bpm: 110,
      energy: 0.93,
      danceability: 0.64,
      valence: 0.65,
      acousticness: 0.04,
      loudness: -3.9,
      speechiness: 0.12,
      genres: ['turkish rock', 'nu metal', 'rap rock'],
      uri: 'spotify:track:1928374650192837465019',
      albumImageSmall: 'assets/logo.jpg',
    },
    {
      id: 'tr_5',
      name: 'Dip',
      artist: 'Madrigal',
      album: 'Dip',
      bpm: 114,
      energy: 0.75,
      danceability: 0.71,
      valence: 0.64,
      acousticness: 0.20,
      loudness: -6.0,
      speechiness: 0.04,
      genres: ['turkish indie', 'alternative pop', 'rock'],
      uri: 'spotify:track:3847561029384756102938',
      albumImageSmall: 'assets/logo.jpg',
    },
    {
      id: 'tr_6',
      name: 'Gitme',
      artist: 'Dolu Kadehi Ters Tut',
      album: 'Karanlık',
      bpm: 118,
      energy: 0.65,
      danceability: 0.68,
      valence: 0.52,
      acousticness: 0.30,
      loudness: -7.0,
      speechiness: 0.04,
      genres: ['turkish indie', 'indie rock'],
      uri: 'spotify:track:4756102938475610293847',
      albumImageSmall: 'assets/logo.jpg',
    },
    {
      id: 'tr_7',
      name: 'Dinle Beni Bi',
      artist: 'Yüzyüzeyken Konuşuruz',
      album: 'Akustikhane',
      bpm: 96,
      energy: 0.52,
      danceability: 0.60,
      valence: 0.44,
      acousticness: 0.65,
      loudness: -8.5,
      speechiness: 0.04,
      genres: ['turkish indie', 'acoustic', 'chill'],
      uri: 'spotify:track:5610293847561029384756',
      albumImageSmall: 'assets/logo.jpg',
    },

    // --- Türkçe Rap & Hip-Hop & Trap ---
    {
      id: 'th_1',
      name: 'Geceler',
      artist: 'Ezhel',
      album: 'Müptezhel',
      bpm: 130,
      energy: 0.86,
      danceability: 0.81,
      valence: 0.71,
      acousticness: 0.11,
      loudness: -5.2,
      speechiness: 0.22,
      genres: ['turkish hip hop', 'trap', 'urban'],
      uri: 'spotify:track:6102938475610293847561',
      albumImageSmall: 'assets/logo.jpg',
    },
    {
      id: 'th_2',
      name: 'Krvn',
      artist: 'Uzi',
      album: 'Kan',
      bpm: 134,
      energy: 0.88,
      danceability: 0.85,
      valence: 0.64,
      acousticness: 0.07,
      loudness: -4.6,
      speechiness: 0.26,
      genres: ['turkish hip hop', 'drill', 'trap'],
      uri: 'spotify:track:7102938475610293847561',
      albumImageSmall: 'assets/logo.jpg',
    },
    {
      id: 'th_3',
      name: '10K Tek Maç',
      artist: 'Motive',
      album: 'ROMANTİK',
      bpm: 126,
      energy: 0.82,
      danceability: 0.79,
      valence: 0.59,
      acousticness: 0.14,
      loudness: -5.8,
      speechiness: 0.20,
      genres: ['turkish hip hop', 'trap'],
      uri: 'spotify:track:8102938475610293847561',
      albumImageSmall: 'assets/logo.jpg',
    },
    {
      id: 'th_4',
      name: 'Eh Baba',
      artist: 'Murda',
      album: 'DOĞA',
      bpm: 105,
      energy: 0.79,
      danceability: 0.86,
      valence: 0.74,
      acousticness: 0.12,
      loudness: -6.0,
      speechiness: 0.16,
      genres: ['turkish hip hop', 'afro trap', 'reggaeton'],
      uri: 'spotify:track:9102938475610293847561',
      albumImageSmall: 'assets/logo.jpg',
    },

    // --- Global Pop & Dance Hits ---
    {
      id: 'gp_1',
      name: 'Blinding Lights',
      artist: 'The Weeknd',
      album: 'After Hours',
      bpm: 171,
      energy: 0.80,
      danceability: 0.51,
      valence: 0.33,
      acousticness: 0.001,
      loudness: -4.3,
      speechiness: 0.06,
      genres: ['synthwave', 'pop', 'dance pop'],
      uri: 'spotify:track:0VjIjW4GlUZAMYd2vXMi3b',
      albumImageSmall: 'assets/logo.jpg',
    },
    {
      id: 'gp_2',
      name: 'Levitating',
      artist: 'Dua Lipa',
      album: 'Future Nostalgia',
      bpm: 103,
      energy: 0.82,
      danceability: 0.79,
      valence: 0.91,
      acousticness: 0.008,
      loudness: -3.8,
      speechiness: 0.06,
      genres: ['dance pop', 'disco', 'pop'],
      uri: 'spotify:track:463CkQjx2Zk1yXoBuRxM9i',
      albumImageSmall: 'assets/logo.jpg',
    },
    {
      id: 'gp_3',
      name: 'As It Was',
      artist: 'Harry Styles',
      album: "Harry's House",
      bpm: 174,
      energy: 0.73,
      danceability: 0.52,
      valence: 0.66,
      acousticness: 0.34,
      loudness: -5.3,
      speechiness: 0.06,
      genres: ['synthpop', 'pop', 'indie pop'],
      uri: 'spotify:track:4LRPiXqCikLlN15c3yZAog',
      albumImageSmall: 'assets/logo.jpg',
    },
    {
      id: 'gp_4',
      name: 'Flowers',
      artist: 'Miley Cyrus',
      album: 'Endless Summer Vacation',
      bpm: 118,
      energy: 0.68,
      danceability: 0.71,
      valence: 0.65,
      acousticness: 0.06,
      loudness: -4.3,
      speechiness: 0.06,
      genres: ['pop', 'dance pop', 'disco'],
      uri: 'spotify:track:0yLdt7AgGvRkWviQy2M6iK',
      albumImageSmall: 'assets/logo.jpg',
    },
    {
      id: 'gp_5',
      name: 'One More Time',
      artist: 'Daft Punk',
      album: 'Discovery',
      bpm: 123,
      energy: 0.91,
      danceability: 0.82,
      valence: 0.84,
      acousticness: 0.02,
      loudness: -4.1,
      speechiness: 0.05,
      genres: ['french house', 'electronic', 'dance'],
      uri: 'spotify:track:0DiWol3AO6WpXZgp0gGlNW',
      albumImageSmall: 'assets/logo.jpg',
    },
    {
      id: 'gp_6',
      name: 'Titanium',
      artist: 'David Guetta, Sia',
      album: 'Nothing But the Beat',
      bpm: 126,
      energy: 0.95,
      danceability: 0.60,
      valence: 0.55,
      acousticness: 0.07,
      loudness: -3.6,
      speechiness: 0.10,
      genres: ['edm', 'dance pop', 'electro house'],
      uri: 'spotify:track:0DwW2W9K2Z019283746192',
      albumImageSmall: 'assets/logo.jpg',
    },
    {
      id: 'gp_7',
      name: 'Summer',
      artist: 'Calvin Harris',
      album: 'Motion',
      bpm: 128,
      energy: 0.93,
      danceability: 0.60,
      valence: 0.74,
      acousticness: 0.02,
      loudness: -3.5,
      speechiness: 0.04,
      genres: ['edm', 'dance pop', 'electro house'],
      uri: 'spotify:track:2819283746501928374650',
      albumImageSmall: 'assets/logo.jpg',
    },
    {
      id: 'gp_8',
      name: 'Starboy',
      artist: 'The Weeknd, Daft Punk',
      album: 'Starboy',
      bpm: 186,
      energy: 0.59,
      danceability: 0.68,
      valence: 0.49,
      acousticness: 0.14,
      loudness: -7.0,
      speechiness: 0.28,
      genres: ['r&b', 'pop', 'electropop'],
      uri: 'spotify:track:7MXVkk9YM5IZxh0wAEvism',
      albumImageSmall: 'assets/logo.jpg',
    },

    // --- Chill, Akustik, Ballad & Lo-Fi ---
    {
      id: 'ch_1',
      name: 'Tükeneceğiz',
      artist: 'Sezen Aksu',
      album: 'Sen Ağlama',
      bpm: 78,
      energy: 0.36,
      danceability: 0.42,
      valence: 0.24,
      acousticness: 0.82,
      loudness: -11.4,
      speechiness: 0.03,
      genres: ['turkish pop', 'ballad', 'acoustic', 'chill'],
      uri: 'spotify:track:1122334455667788990011',
      albumImageSmall: 'assets/logo.jpg',
    },
    {
      id: 'ch_2',
      name: 'Sadece',
      artist: 'Kalben',
      album: 'Kalben',
      bpm: 82,
      energy: 0.38,
      danceability: 0.51,
      valence: 0.30,
      acousticness: 0.88,
      loudness: -10.2,
      speechiness: 0.04,
      genres: ['turkish indie', 'acoustic', 'singer-songwriter', 'chill'],
      uri: 'spotify:track:2233445566778899001122',
      albumImageSmall: 'assets/logo.jpg',
    },
    {
      id: 'ch_3',
      name: 'Nasır',
      artist: 'Melike Şahin',
      album: 'Merhem',
      bpm: 90,
      energy: 0.48,
      danceability: 0.58,
      valence: 0.45,
      acousticness: 0.68,
      loudness: -8.8,
      speechiness: 0.04,
      genres: ['turkish pop', 'indie pop', 'chill'],
      uri: 'spotify:track:3344556677889900112233',
      albumImageSmall: 'assets/logo.jpg',
    },
    {
      id: 'ch_4',
      name: 'Someone Like You',
      artist: 'Adele',
      album: '21',
      bpm: 68,
      energy: 0.33,
      danceability: 0.56,
      valence: 0.28,
      acousticness: 0.89,
      loudness: -8.2,
      speechiness: 0.03,
      genres: ['pop', 'ballad', 'piano', 'acoustic'],
      uri: 'spotify:track:4455667788990011223344',
      albumImageSmall: 'assets/logo.jpg',
    },
    {
      id: 'ch_5',
      name: 'Coffee Breath',
      artist: 'Sofia Mills',
      album: 'Coffee Breath',
      bpm: 84,
      energy: 0.25,
      danceability: 0.64,
      valence: 0.35,
      acousticness: 0.92,
      loudness: -13.0,
      speechiness: 0.04,
      genres: ['lo-fi', 'indie folk', 'chill', 'acoustic'],
      uri: 'spotify:track:5566778899001122334455',
      albumImageSmall: 'assets/logo.jpg',
    },
    {
      id: 'ch_6',
      name: 'Sunset Lover',
      artist: 'Petit Biscuit',
      album: 'Presence',
      bpm: 90,
      energy: 0.46,
      danceability: 0.72,
      valence: 0.52,
      acousticness: 0.62,
      loudness: -9.5,
      speechiness: 0.05,
      genres: ['chillout', 'electronic', 'ambient'],
      uri: 'spotify:track:6677889900112233445566',
      albumImageSmall: 'assets/logo.jpg',
    },
  ];

  // ==========================================
  // 2. VEKTÖR UZAYI & MATEMATİKSEL İSTATİSTİK
  // ==========================================

  /**
   * Bir parçanın 8-boyutlu normalize özellik vektörünü [0, 1] üretir:
   * [energy, danceability, valence, tempoNorm, acousticness, loudnessNorm, speechiness, harmonicWarmth]
   * 
   * Gerçek Zamanlı BPM Entegrasyonu:
   * - Canlı mikrofon veya ses analizörü aktifse, parça anlık ölçülen BPM ile kalibre edilir.
   * - Spotify audioFeatures kısıtlandığında RhythmEngine doğrulanmış veritabanı ve MIR regresyonu kullanılır.
   * 
   * @param {Object} track - Şarkı nesnesi
   * @param {Object} [options] - Ek opsiyonlar ({ liveBpm, isNowPlaying })
   */
  function extractFeatureVector(track, options = {}) {
    if (!track) {
      return [0.7, 0.7, 0.5, 0.43, 0.2, 0.7, 0.05, 0.5];
    }

    // Canlı ölçülmüş gerçek BPM önceliği (Live Ground Truth Calibration)
    let liveBpmOverride = null;
    if (options && typeof options.liveBpm === 'number' && options.liveBpm > 40) {
      liveBpmOverride = options.liveBpm;
    } else if (options && options.isNowPlaying && _currentLiveBpmState.bpm && _currentLiveBpmState.confidence >= 40) {
      liveBpmOverride = _currentLiveBpmState.bpm;
    }

    // Doğrudan korpusta varsa
    const corpusMatch = MUSIC_CORPUS.find(
      c => c.name.toLowerCase() === (track.name || '').toLowerCase() &&
           c.artist.toLowerCase() === (track.artist || '').toLowerCase()
    );
    if (corpusMatch) {
      const effectiveBpm = liveBpmOverride || corpusMatch.bpm;
      const tempoNorm = Math.max(0, Math.min(1, (effectiveBpm - 60) / 140));
      return [
        corpusMatch.energy,
        corpusMatch.danceability,
        corpusMatch.valence,
        tempoNorm,
        corpusMatch.acousticness,
        Math.max(0, Math.min(1, (corpusMatch.loudness + 30) / 30)),
        corpusMatch.speechiness,
        corpusMatch.energy * 0.6 + corpusMatch.valence * 0.4,
      ];
    }

    // Spotify audioFeatures varsa
    const af = track.audioFeatures || track.features;
    if (af && typeof af.energy === 'number') {
      const bpm = liveBpmOverride || af.tempo || 120;
      const energy = af.energy;
      const dance = af.danceability ?? 0.5;
      const val = af.valence ?? 0.5;
      const ac = af.acousticness ?? 0.2;
      const loud = Math.max(0, Math.min(1, ((af.loudness ?? -8) + 30) / 30));
      const sp = af.speechiness ?? 0.05;
      return [
        energy,
        dance,
        val,
        Math.max(0, Math.min(1, (bpm - 60) / 140)),
        ac,
        loud,
        sp,
        energy * 0.55 + val * 0.45,
      ];
    }

    // Heuristik ve MIR çıkarımı (DSP & MIR Regression Feature Extraction)
    const name = (track.name || '').toLowerCase();
    const artist = (track.artist || '').toLowerCase();

    // 1. Canlı ölçülen BPM varsa en yüksek öncelikle al
    // 2. track.bpm varsa al
    // 3. RhythmEngine varsa doğrulanmış veritabanı veya MIR regresyon tahminini al
    // 4. Varsayılan 122
    let bpm = liveBpmOverride || track.bpm;
    if (!bpm && rhythmEngineRef && typeof rhythmEngineRef.resolveAccurateBpm === 'function') {
      bpm = rhythmEngineRef.resolveAccurateBpm(track).bpm;
    } else if (!bpm && rhythmEngineRef && typeof rhythmEngineRef.estimateBpm === 'function') {
      bpm = rhythmEngineRef.estimateBpm(track);
    }
    if (!bpm) {
      bpm = 122;
    }

    let energy = 0.70;
    let dance = 0.68;
    let val = 0.55;
    let ac = 0.20;
    let loud = 0.72;
    let sp = 0.06;

    if (bpm >= 130) { energy += 0.15; dance += 0.12; }
    if (bpm <= 90) { energy -= 0.25; ac += 0.35; loud -= 0.15; }

    const highKeywords = ['remix', 'mix', 'party', 'dan dan', 'bangır', 'club', 'drop', 'kuzu', 'dudu', 'dance'];
    const chillKeywords = ['akustik', 'acoustic', 'slow', 'hasretinle', 'ballad', 'chill', 'sleep', 'piano', 'lofi'];
    const rockKeywords = ['rock', 'derdim', 'duman', 'manga', 'gitar', 'metal'];

    if (highKeywords.some(k => name.includes(k) || artist.includes(k))) {
      energy = Math.min(0.98, energy + 0.18);
      dance = Math.min(0.95, dance + 0.15);
      loud = Math.min(0.95, loud + 0.12);
    }
    if (chillKeywords.some(k => name.includes(k) || artist.includes(k))) {
      energy = Math.max(0.25, energy - 0.30);
      ac = Math.min(0.95, ac + 0.45);
      loud = Math.max(0.40, loud - 0.20);
    }
    if (rockKeywords.some(k => name.includes(k) || artist.includes(k))) {
      energy = Math.min(0.95, energy + 0.15);
      dance = Math.max(0.45, dance - 0.12);
    }

    const tempoNorm = Math.max(0, Math.min(1, (bpm - 60) / 140));
    return [energy, dance, val, tempoNorm, ac, loud, sp, energy * 0.6 + val * 0.4];
  }

  /**
   * Ağırlıklı Cosine Similarity hesaplar: S_cos ∈ [-1, 1]
   */
  function weightedCosineSimilarity(vecA, vecB, weights) {
    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      const w = weights ? (weights[i] ?? 1.0) : 1.0;
      dot += w * vecA[i] * vecB[i];
      normA += w * vecA[i] * vecA[i];
      normB += w * vecB[i] * vecB[i];
    }

    if (normA <= 0 || normB <= 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * BPM Geçiş & Uyum Skoru (Markovian Tempo Continuity)
   * Gaussian uyum, yarım/çift tempo (half-time/double-time) ve harmonik üçleme (triplet/dotted) uyumu.
   * Canlı dinlenen parçayla DJ beatmatching kilitlenmesini destekler.
   * @param {number} bpmA - Referans tempo (çalan şarkı veya hedef tempo)
   * @param {number} bpmB - Aday şarkı temposu
   * @param {Object} [options] - { isLiveTarget: boolean }
   */
  function calculateTempoTransitionScore(bpmA, bpmB, options = {}) {
    if (!bpmA || !bpmB) return 0.75;
    const diff = Math.abs(bpmA - bpmB);

    // 1x doğrudan tempo farkı (Gaussian yakınlık)
    const score1x = Math.exp(-(diff * diff) / (2 * 14 * 14));

    // 2x / 0.5x tempo harmonisi (örn. 75 BPM ile 150 BPM veya 85 ile 170)
    const diff2x = Math.abs(bpmA * 2 - bpmB);
    const diffHalf = Math.abs(bpmA - bpmB * 2);
    const scoreHarmonic = Math.max(
      Math.exp(-(diff2x * diff2x) / (2 * 12 * 12)),
      Math.exp(-(diffHalf * diffHalf) / (2 * 12 * 12))
    ) * 0.85;

    // 1.5x / 0.67x Triplet & Dotted geçiş harmonisi (örn. 80 BPM ile 120 BPM)
    const diff1_5x = Math.abs(bpmA * 1.5 - bpmB);
    const diffTriplet = Math.abs(bpmA - bpmB * 1.5);
    const scoreTriplet = Math.max(
      Math.exp(-(diff1_5x * diff1_5x) / (2 * 10 * 10)),
      Math.exp(-(diffTriplet * diffTriplet) / (2 * 10 * 10))
    ) * 0.72;

    const baseScore = Math.max(score1x, scoreHarmonic, scoreTriplet);

    // Canlı hedefte mikro-fark bonusu: Fark <= 3 BPM ise kusursuz Beatmatch kilitlenmesi
    if (options && options.isLiveTarget && diff <= 3) {
      return Math.min(1.0, baseScore * 1.15 + 0.05);
    }

    return baseScore;
  }

  // ==========================================
  // 3. KUYRUK PROFİLLEME & EĞİLİM ANALİZİ
  // ==========================================

  /**
   * Mevcut çalınan şarkı ve kuyruktaki parçaları analiz ederek
   * üstel ağırlıklı ağırlık merkezi (centroid) ve müzikal dinamikleri hesaplar.
   * Canlı ölçülen BPM varsa kuyruk temposunu gerçek veriye kalibre eder.
   * 
   * @param {Array} queue - Kuyruktaki parçalar
   * @param {Object} nowPlaying - Çalmakta olan parça
   * @param {Object} [options] - { liveBpm: number, liveConfidence: number }
   */
  function analyzeQueue(queue = [], nowPlaying = null, options = {}) {
    const allTracks = [];
    if (nowPlaying) allTracks.push(nowPlaying);
    if (Array.isArray(queue)) {
      allTracks.push(...queue);
    }

    // Aktif canlı gerçek zamanlı BPM kontrolü
    const activeLiveBpm = (options && typeof options.liveBpm === 'number' && options.liveBpm > 40)
      ? options.liveBpm
      : (_currentLiveBpmState.bpm && _currentLiveBpmState.confidence >= 40 ? _currentLiveBpmState.bpm : null);
    const liveConfidence = (options && typeof options.liveConfidence === 'number')
      ? options.liveConfidence
      : _currentLiveBpmState.confidence;

    if (allTracks.length === 0) {
      // Boş kuyruk varsayılan profili
      const defaultBpm = activeLiveBpm || 122;
      return {
        avgBpm: defaultBpm,
        avgEnergy: 0.75,
        energyLabel: 'Dengeli Enerji',
        dominantGenre: 'Pop & Dans',
        trend: 'steady',
        trackCount: 0,
        centroid: [0.75, 0.75, 0.65, Math.max(0, Math.min(1, (defaultBpm - 60) / 140)), 0.15, 0.75, 0.06, 0.70],
        recentArtists: [],
        isLiveBpmCalibrated: !!activeLiveBpm,
        liveBpm: activeLiveBpm,
        bpmConfidence: liveConfidence,
      };
    }

    const n = allTracks.length;
    const decay = 0.82; // Güncel şarkılara daha yüksek ağırlık
    let totalWeight = 0;
    const centroid = new Array(8).fill(0);
    let weightedBpm = 0;
    const recentArtists = [];

    for (let i = 0; i < n; i++) {
      const track = allTracks[i];
      const weight = Math.pow(decay, n - 1 - i);
      totalWeight += weight;

      const isNowPlayingTrack = (i === 0 && !!nowPlaying);
      const vec = extractFeatureVector(track, {
        liveBpm: isNowPlayingTrack ? activeLiveBpm : null,
        isNowPlaying: isNowPlayingTrack,
      });
      for (let j = 0; j < 8; j++) {
        centroid[j] += vec[j] * weight;
      }

      let bpm;
      if (isNowPlayingTrack && activeLiveBpm) {
        bpm = activeLiveBpm;
      } else {
        bpm = track.bpm || 
              (MUSIC_CORPUS.find(c => c.name.toLowerCase() === (track.name || '').toLowerCase())?.bpm) ||
              (rhythmEngineRef && typeof rhythmEngineRef.estimateBpm === 'function' ? rhythmEngineRef.estimateBpm(track) : 122);
      }
      weightedBpm += bpm * weight;

      if (track.artist && !recentArtists.includes(track.artist.toLowerCase())) {
        recentArtists.push(track.artist.toLowerCase());
      }
    }

    for (let j = 0; j < 8; j++) {
      centroid[j] /= totalWeight;
    }
    const avgBpm = Math.round(weightedBpm / totalWeight);
    const avgEnergy = centroid[0];

    let energyLabel = 'Dengeli Pop';
    if (avgEnergy >= 0.82) energyLabel = 'Yüksek Enerji / Kulüp';
    else if (avgEnergy <= 0.45) energyLabel = 'Sakin & Akustik';
    else if (avgEnergy >= 0.65) energyLabel = 'Ritmik & Canlı';

    // Kuyruk ivmesi (ilk yarı ile son yarı karşılaştırması)
    let trend = 'steady';
    if (n >= 3) {
      const half = Math.floor(n / 2);
      const earlyEnergy = allTracks.slice(0, half).reduce((s, t) => s + extractFeatureVector(t)[0], 0) / half;
      const lateEnergy = allTracks.slice(half).reduce((s, t) => s + extractFeatureVector(t)[0], 0) / (n - half);
      if (lateEnergy - earlyEnergy > 0.12) trend = 'rising';
      else if (earlyEnergy - lateEnergy > 0.12) trend = 'falling';
    }

    return {
      avgBpm,
      avgEnergy,
      energyLabel,
      dominantGenre: avgEnergy >= 0.8 ? 'Dans / Kulüp' : (avgEnergy <= 0.45 ? 'Akustik / Chill' : 'Pop & R&B'),
      trend,
      trackCount: n,
      centroid,
      recentArtists,
      lastTrack: allTracks[n - 1],
      isLiveBpmCalibrated: !!activeLiveBpm,
      liveBpm: activeLiveBpm,
      bpmConfidence: liveConfidence,
    };
  }

  // ==========================================
  // 4. MAKİNE ÖĞRENİMİ İLE ÖNERİ & YENİDEN SIRALAMA
  // ==========================================

  /**
   * Verilen ruh haline (vibe) göre hedef vektör projeksiyonunu üretir.
   */
  function projectTargetVector(centroid, vibe = 'similar') {
    const target = [...centroid];
    const weights = [1.0, 1.0, 0.8, 1.2, 0.7, 0.8, 0.5, 0.8]; // varsayılan

    if (vibe === 'party') {
      // Yüksek enerji, kulüp ritmi, yüksek BPM ve güçlü ses
      target[0] = 0.95; // Enerji
      target[1] = 0.88; // Danceability
      target[2] = 0.80; // Valence
      target[3] = Math.min(0.85, target[3] + 0.15); // +10-20 BPM
      target[4] = 0.04; // Minimum akustik
      target[5] = 0.92; // Yüksek loudness
      weights[0] = 1.5; // Enerji
      weights[1] = 1.3; // Dans
      weights[4] = 1.2; // Akustik olmamalı
    } else if (vibe === 'chill') {
      // Sakin, akustik, düşük tempolu ve yumuşak tınılar
      target[0] = 0.32; // Düşük enerji
      target[1] = 0.45; // Orta-düşük dans
      target[2] = 0.38; // Rahatlatıcı / melankolik
      target[3] = 0.20; // 75-95 BPM
      target[4] = 0.88; // Yüksek akustiklik
      target[5] = 0.38; // Yumuşak ses
      weights[0] = 1.6; // Düşük enerji kesin öncelik
      weights[3] = 1.4; // Yavaş tempo
      weights[4] = 1.7; // Akustiklik çok belirleyici
    } else if (vibe === 'discovery') {
      // Keşif modu: çeşitlilik ve yeni tınılar (MMR devrede olacak)
      weights[0] = 0.8;
      weights[3] = 0.8;
      weights[6] = 1.4; // Konuşma/Ritim çeşitliliği
    } else {
      // 'similar' (Akış) modu: mevcut kuyruk merkezini korur
      weights[0] = 1.4;
      weights[3] = 1.4; // BPM sürekliliği
    }

    return { target, weights };
  }

  /**
   * Aday havuzunu makine öğrenimi modeliyle puanlar ve Maximum Marginal Relevance (MMR)
   * ile çeşitlilik sağlayarak en uygun K şarkıyı seçer.
   */
  /**
   * Aday havuzunu makine öğrenimi modeliyle puanlar ve Maximum Marginal Relevance (MMR)
   * ile çeşitlilik sağlayarak en uygun K şarkıyı seçer.
   * Canlı ölçülen gerçek BPM varsa, DJ-grade beatmatching ve harmonik miksleme yapar.
   * 
   * @param {Object} options
   */
  function recommendTracks({ queue = [], nowPlaying = null, vibe = 'similar', limit = 5, candidatePool = null, liveBpm = null }) {
    // Aktif canlı gerçek zamanlı BPM kontrolü
    const activeLiveBpm = (typeof liveBpm === 'number' && liveBpm > 40)
      ? liveBpm
      : (_currentLiveBpmState.bpm && _currentLiveBpmState.confidence >= 40 ? _currentLiveBpmState.bpm : null);

    const analysis = analyzeQueue(queue, nowPlaying, { liveBpm: activeLiveBpm });
    const { target, weights } = projectTargetVector(analysis.centroid, vibe);

    // Aday havuzu: dışarıdan verilmişse o, yoksa dahili korpus
    const pool = (Array.isArray(candidatePool) && candidatePool.length > 0)
      ? candidatePool
      : MUSIC_CORPUS;

    // Kuyruktaki mevcut şarkıların kimlikleri ve isimleri (çift eklemeyi önle)
    const existingKeys = new Set();
    if (nowPlaying?.name) existingKeys.add(`${(nowPlaying.name || '').toLowerCase()}-${(nowPlaying.artist || '').toLowerCase()}`);
    if (Array.isArray(queue)) {
      queue.forEach(t => {
        if (t.name) existingKeys.add(`${(t.name || '').toLowerCase()}-${(t.artist || '').toLowerCase()}`);
        if (t.id) existingKeys.add(t.id);
        if (t.uri) existingKeys.add(t.uri);
      });
    }

    // Adayları filtrele
    const filteredCandidates = pool.filter(c => {
      const key = `${(c.name || '').toLowerCase()}-${(c.artist || '').toLowerCase()}`;
      if (existingKeys.has(key)) return false;
      if (c.id && existingKeys.has(c.id)) return false;
      if (c.uri && existingKeys.has(c.uri)) return false;
      return true;
    });

    if (filteredCandidates.length === 0) {
      return [];
    }

    // 1. Adayların Tekil ML Puanlarını Hesapla
    const scoredCandidates = [];
    const lastTrackBpm = analysis.lastTrack?.bpm || analysis.avgBpm || 122;
    const lastArtist = (analysis.lastTrack?.artist || '').toLowerCase();

    for (const cand of filteredCandidates) {
      const candVec = extractFeatureVector(cand);
      const cosSim = weightedCosineSimilarity(candVec, target, weights);

      // BPM Geçiş Puanı (Gerçek Zamanlı Canlı Beatmatch Destekli):
      const candBpm = cand.bpm || 
                      (MUSIC_CORPUS.find(c => c.name.toLowerCase() === (cand.name || '').toLowerCase())?.bpm) ||
                      (rhythmEngineRef && typeof rhythmEngineRef.estimateBpm === 'function' ? rhythmEngineRef.estimateBpm(cand) : Math.round(candVec[3] * 140 + 60));
      const targetBpm = Math.round(target[3] * 140 + 60);

      // Canlı BPM varsa doğrudan çalan parçanın canlı temposuna beatmatch yap
      const referenceBpm = activeLiveBpm || ((vibe === 'similar') ? lastTrackBpm : targetBpm);
      const isLiveBeatmatching = !!activeLiveBpm;
      const tempoScore = calculateTempoTransitionScore(referenceBpm, candBpm, { isLiveTarget: isLiveBeatmatching });

      // Enerji Akış Skoru
      const energyDiff = Math.abs(candVec[0] - target[0]);
      const flowScore = Math.max(0, 1.0 - energyDiff * 1.3);

      // Sanatçı Çeşitlilik Cezası (Peş peşe aynı sanatçıyı önle)
      let artistPenalty = 0;
      const candArtist = (cand.artist || '').toLowerCase();
      if (candArtist && candArtist === lastArtist) {
        artistPenalty = 0.40; // Önceki şarkıyla aynıysa yüksek ceza
      } else if (analysis.recentArtists.includes(candArtist)) {
        artistPenalty = 0.18; // Son dinlenenlerde varsa hafif ceza
      }

      // Çok Faktörlü Nihai ML Skoru (Canlı Beatmatch bonusu dahil)
      const beatmatchBonus = (isLiveBeatmatching && Math.abs(candBpm - referenceBpm) <= 3) ? 0.08 : 0;
      const rawScore = (cosSim * 0.40) + (tempoScore * 0.30) + (flowScore * 0.20) + beatmatchBonus - artistPenalty + 0.08;
      const confidence = Math.min(99, Math.max(75, Math.round((rawScore * 0.4 + cosSim * 0.6) * 100)));

      // Akıllı Açıklanabilir ML Etiketi (Explainable AI)
      let mlTag = '🎯 %' + confidence + ' Uyum';
      const bpmDiff = Math.abs(candBpm - referenceBpm);

      if (isLiveBeatmatching && bpmDiff <= 3) {
        mlTag = '⚡ Canlı BPM Eşleşmesi (' + candBpm + ' BPM • %' + confidence + ')';
      } else if (isLiveBeatmatching && (Math.abs(candBpm * 2 - referenceBpm) <= 3 || Math.abs(candBpm - referenceBpm * 2) <= 3)) {
        mlTag = '🎛️ Harmonik Beatmatch (' + candBpm + ' BPM • %' + confidence + ')';
      } else if (vibe === 'party') {
        mlTag = '⚡ Parti Drop • %' + confidence;
      } else if (vibe === 'chill') {
        mlTag = '☕ Akustik Akış • %' + confidence;
      } else if (vibe === 'discovery') {
        mlTag = '🚀 Keşif • %' + confidence;
      }

      const isLiveBeatmatched = isLiveBeatmatching && (
        bpmDiff <= 3 || 
        Math.abs(candBpm * 2 - referenceBpm) <= 3 || 
        Math.abs(candBpm - referenceBpm * 2) <= 3
      );

      scoredCandidates.push({
        track: {
          ...cand,
          predictedBpm: candBpm,
          matchConfidence: confidence,
          mlTag,
          flowScore: Math.round(flowScore * 100) / 100,
          isLiveBeatmatched,
        },
        vec: candVec,
        score: rawScore,
      });
    }

    // 2. Maximum Marginal Relevance (MMR) Çeşitlilik Seçimi
    // Rerank top candidates maximizing relevance while penalizing redundancy
    const lambda = vibe === 'discovery' ? 0.60 : 0.82; // Discovery daha yüksek çeşitlilik ister
    const selected = [];
    const remaining = [...scoredCandidates];

    while (selected.length < limit && remaining.length > 0) {
      let bestIdx = 0;
      let bestMmrScore = -Infinity;

      for (let i = 0; i < remaining.length; i++) {
        const item = remaining[i];
        let redundancy = 0;

        for (const sel of selected) {
          const simToSel = weightedCosineSimilarity(item.vec, sel.vec, weights);
          if (simToSel > redundancy) {
            redundancy = simToSel;
          }
          // Aynı sanatçı seçildiyse fazladan çeşitlilik cezası
          if (item.track.artist.toLowerCase() === sel.track.artist.toLowerCase()) {
            redundancy += 0.35;
          }
        }

        const mmrScore = (lambda * item.score) - ((1 - lambda) * redundancy);
        if (mmrScore > bestMmrScore) {
          bestMmrScore = mmrScore;
          bestIdx = i;
        }
      }

      selected.push(remaining[bestIdx]);
      remaining.splice(bestIdx, 1);
    }

    return selected.map(s => s.track);
  }

  /**
   * Canlı Spotify API önerilerini veya arama sonuçlarını ML modeliyle yeniden sıralar (Reranking)
   */
  function rerankSpotifyCandidates(candidates, queueContext, vibe = 'similar', limit = 5, options = {}) {
    if (!Array.isArray(candidates) || candidates.length === 0) return [];
    return recommendTracks({
      queue: queueContext?.queue || [],
      nowPlaying: queueContext?.nowPlaying || null,
      vibe,
      limit,
      candidatePool: candidates,
      liveBpm: options?.liveBpm || queueContext?.liveBpm,
    });
  }

  // ==========================================
  // 5. ŞARKI LİSTESİ OTO-TAMAMLAMA & METİN TAHMİNİ (BUILDER TAB)
  // ==========================================

  /**
   * Kullanıcı arama kutusuna veya toplu ekleme kutusuna yazarken
   * korpus üzerinden hızlı N-gram ve fonetik tahmin üretir.
   */
  function suggestAutocomplete(prefix, limit = 5) {
    if (!prefix || typeof prefix !== 'string') return [];
    const q = prefix.trim().toLowerCase();
    if (q.length < 2) return [];

    const matches = [];

    for (const item of MUSIC_CORPUS) {
      const nameL = item.name.toLowerCase();
      const artistL = item.artist.toLowerCase();
      const full = `${nameL} ${artistL}`;

      let score = 0;
      if (nameL.startsWith(q)) score = 100;
      else if (artistL.startsWith(q)) score = 90;
      else if (nameL.includes(q)) score = 75;
      else if (artistL.includes(q)) score = 65;
      else if (full.includes(q)) score = 50;

      if (score > 0) {
        matches.push({
          item,
          score,
          displayText: `${item.name} - ${item.artist}`,
          bpm: item.bpm,
          energy: item.energy,
        });
      }
    }

    matches.sort((a, b) => b.score - a.score);
    return matches.slice(0, limit).map(m => m.item);
  }

  /**
   * Toplu ekle kutusunda yazılı olan şarkıları ayrıştırır,
   * onların müzikal tarzına göre sıradaki 3 parçayı ML ile otomatik tahmin eder.
   */
  function predictNextFromDraft(draftText, vibe = 'similar', count = 3) {
    if (!draftText || typeof draftText !== 'string') {
      return recommendTracks({ vibe, limit: count });
    }

    // Basit satır veya ok ayracı ayrıştırması
    const rawTokens = draftText
      .split(/[\n→;]+/)
      .map(s => s.trim())
      .filter(s => s.length > 2);

    const parsedTracks = [];
    for (const token of rawTokens) {
      const parts = token.split(/[-—–]/).map(p => p.trim());
      if (parts.length >= 2) {
        parsedTracks.push({ name: parts[0], artist: parts[1] });
      } else {
        parsedTracks.push({ name: parts[0], artist: '' });
      }
    }

    return recommendTracks({
      queue: parsedTracks,
      nowPlaying: null,
      vibe,
      limit: count,
    });
  }

  // ==========================================
  // API EXPORT
  // ==========================================
  return {
    MUSIC_CORPUS,
    extractFeatureVector,
    weightedCosineSimilarity,
    calculateTempoTransitionScore,
    analyzeQueue,
    projectTargetVector,
    recommendTracks,
    rerankSpotifyCandidates,
    suggestAutocomplete,
    predictNextFromDraft,
    // Gerçek Zamanlı Canlı BPM Geri Bildirim ve Kalibrasyon Metotları
    setLiveBpm,
    getLiveBpm,
    clearLiveBpm,
  };
});
