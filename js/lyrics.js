// ============================================
// QueueDrop — Synchronized Lyrics Engine (LRC)
// LRCLIB API + Çok Kademeli Ayrıştırma & Önbellekleme
// ============================================

const LyricsEngine = (() => {
  const LRCLIB_BASE_URL = 'https://lrclib.net/api';
  const lyricsCache = new Map();

  // Yerleşik Fixture Sözleri (Çevrimdışı ve Demo Modu için)
  const EMBEDDED_FIXTURES = {
    'canın sağolsun': {
      synced: true,
      lines: [
        { timeMs: 0, text: '♪ (Giriş) ♪' },
        { timeMs: 12500, text: 'Bir yanım git diyor, bir yanım kal' },
        { timeMs: 16800, text: 'Giden gitsin sen yanımda kal' },
        { timeMs: 22100, text: 'Canın sağolsun, her şey aşktan' },
        { timeMs: 27400, text: 'Bir kere sevdim, dönmem artık yoldan' },
        { timeMs: 33000, text: 'Beni durdursan mı, akışına mı bıraksan?' },
        { timeMs: 38500, text: 'Gözlerinin içine baksam doyamam' },
        { timeMs: 44200, text: 'Canın sağolsun sevdiğim...' },
        { timeMs: 52000, text: '♪ (Enstrümantal ara) ♪' },
        { timeMs: 65000, text: 'Bir yanım git diyor, bir yanım kal' },
        { timeMs: 71000, text: 'Giden gitsin sen yanımda kal' },
        { timeMs: 76000, text: 'Canın sağolsun, her şey aşktan...' },
      ]
    },
    'dan dan': {
      synced: true,
      lines: [
        { timeMs: 0, text: '♪ (Giriş Melodisi) ♪' },
        { timeMs: 19230, text: 'Soğudu havalar burda güneş açmıyo\'' },
        { timeMs: 24380, text: 'Telefonu da hiç açmıyo\'' },
        { timeMs: 28780, text: 'Beklesin...' },
        { timeMs: 32500, text: 'Acelesi yok, aşk bu kaçmıyo\'' },
        { timeMs: 37200, text: 'Kapıları çalmadı kapattı yüzüme' },
        { timeMs: 41800, text: 'Dan dan dan! Vuruyor kalbime' },
        { timeMs: 46500, text: 'Ya gel ya git, yeter artık dinle!' },
        { timeMs: 51200, text: 'Dan dan dan! Çaldı zilinde' },
      ]
    },
    'blinding lights': {
      synced: true,
      lines: [
        { timeMs: 0, text: '♪ (Synth Intro) ♪' },
        { timeMs: 13130, text: 'Yeah...' },
        { timeMs: 27160, text: "I've been tryna call" },
        { timeMs: 29960, text: "I've been on my own for long enough" },
        { timeMs: 34500, text: 'Maybe you can show me how to love, maybe' },
        { timeMs: 41200, text: "I'm going through withdrawals" },
        { timeMs: 44800, text: "You don't even have to do too much" },
        { timeMs: 48900, text: 'You can turn me on with just a touch, baby' },
        { timeMs: 56000, text: 'I look around and Sin City\'s cold and empty' },
        { timeMs: 63000, text: 'No one\'s around to judge me' },
        { timeMs: 68000, text: 'I can\'t see clearly when you\'re gone' },
        { timeMs: 74000, text: 'I said, ooh, I\'m blinded by the lights' },
      ]
    },
    'kuzu kuzu': {
      synced: true,
      lines: [
        { timeMs: 0, text: '♪ (Oud & Perküsyon Giriş) ♪' },
        { timeMs: 14200, text: 'İşte kuzu kuzu geldim' },
        { timeMs: 18500, text: 'Dilediğince kır beni' },
        { timeMs: 23100, text: 'Yenildim sevgine teslim oldum' },
        { timeMs: 28000, text: 'İster vur, ister sev beni' },
        { timeMs: 33400, text: 'Sensizliği ben seçmedim ki' },
        { timeMs: 38200, text: 'Yüreğime söz geçiremedim ki' },
        { timeMs: 43000, text: 'Kuzu kuzu geldim kapına...' },
      ]
    }
  };

  /**
   * LRC formatındaki zaman damgalı metni ayrıştırır.
   * Desteklenen formatlar:
   * [mm:ss.xx] Şarkı sözü
   * [mm:ss.xxx] Şarkı sözü
   * [mm:ss] Şarkı sözü
   * [00:10.00][00:25.00] Çoklu zaman damgası
   *
   * @param {string} lrcText
   * @returns {Array<{timeMs: number, text: string}>}
   */
  function parseLRC(lrcText) {
    if (!lrcText || typeof lrcText !== 'string') return [];

    const lines = lrcText.split(/\r?\n/);
    const parsedLines = [];
    const timeTagRegex = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Meta etiketlerini atla: [ar:...], [ti:...], [al:...]
      if (/^\[(ar|ti|al|by|offset|length|re|ve):/i.test(trimmed)) {
        continue;
      }

      // Satırdaki tüm zaman etiketlerini bul
      const matches = [...trimmed.matchAll(timeTagRegex)];
      if (matches.length === 0) continue;

      // Zaman etiketlerinden arındırılmış saf söz metni
      const text = trimmed.replace(timeTagRegex, '').trim();

      for (const m of matches) {
        const min = parseInt(m[1], 10);
        const sec = parseInt(m[2], 10);
        let ms = 0;
        if (m[3]) {
          // İki basamaklıysa 10 ile çarp (örn .25 -> 250ms), üç basamaklıysa aynen al
          ms = m[3].length === 2 ? parseInt(m[3], 10) * 10 : parseInt(m[3].padEnd(3, '0').slice(0, 3), 10);
        }
        const timeMs = (min * 60 + sec) * 1000 + ms;
        parsedLines.push({ timeMs, text: text || '♪' });
      }
    }

    // Zamana göre artan sırala
    parsedLines.sort((a, b) => a.timeMs - b.timeMs);
    return parsedLines;
  }

  /**
   * Şarkının mevcut süresine (currentProgressMs) karşılık gelen aktif satır dizinini bulur.
   *
   * @param {Array<{timeMs: number, text: string}>} lines
   * @param {number} currentProgressMs
   * @returns {number} Aktif satırın dizini (henüz başlamadıysa -1)
   */
  function getActiveLineIndex(lines, currentProgressMs) {
    if (!lines || lines.length === 0 || currentProgressMs < lines[0].timeMs) {
      return -1;
    }

    // Binary search (İkili arama) ile en son geçen satırı bul
    let low = 0;
    let high = lines.length - 1;
    let best = 0;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (lines[mid].timeMs <= currentProgressMs) {
        best = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    return best;
  }

  /**
   * Başlık ve sanatçı adını temizleyip aramaya hazırlar.
   * Feat, Remastered vb. ekleri ayıklar.
   */
  function cleanTrackTitle(title) {
    if (!title) return '';
    return title
      .replace(/\s*-\s*\d{4}\s*Remaster.*/i, '')
      .replace(/\s*\(Remastered.*\)/i, '')
      .replace(/\s*\(feat\..*?\)/i, '')
      .replace(/\s*\[feat\..*?\]/i, '')
      .replace(/\s*feat\..*/i, '')
      .replace(/\s*ft\..*/i, '')
      .trim();
  }

  /**
   * Şarkı sözlerini çeker: Önbellek -> LRCLIB API -> LRCLIB Arama -> Yerleşik Fixture.
   *
   * @param {string} trackName
   * @param {string} artistName
   * @param {number} durationMs
   * @returns {Promise<{synced: boolean, lines: Array, plainLyrics: string, source: string}>}
   */
  async function fetchLyrics(trackName, artistName, durationMs = 0) {
    const cleanTitle = cleanTrackTitle(trackName);
    const cacheKey = `${cleanTitle.toLowerCase()}-${(artistName || '').toLowerCase()}`;

    if (lyricsCache.has(cacheKey)) {
      return lyricsCache.get(cacheKey);
    }

    // 1. Kademe: Yerleşik Fixture Kontrolü (Hızlı eşleşme)
    const lowerTitle = cleanTitle.toLowerCase();
    for (const [key, fixture] of Object.entries(EMBEDDED_FIXTURES)) {
      if (lowerTitle.includes(key)) {
        const result = {
          synced: fixture.synced,
          lines: fixture.lines,
          plainLyrics: fixture.lines.map(l => l.text).join('\n'),
          source: 'builtin',
        };
        lyricsCache.set(cacheKey, result);
        return result;
      }
    }

    // 2. Kademe: LRCLIB API ile Tam Arama
    let serviceUnavailable = false;
    try {
      const params = new URLSearchParams({
        track_name: cleanTitle,
        artist_name: artistName || '',
      });
      if (durationMs > 0) {
        params.append('duration', String(Math.round(durationMs / 1000)));
      }

      const headers = (typeof window === 'undefined')
        ? { 'User-Agent': 'QueueSpotify/1.0.0 (https://queuespotify.vercel.app)' }
        : {};

      const res = await fetch(`${LRCLIB_BASE_URL}/get?${params.toString()}`, { headers });

      if (res.ok) {
        const data = await res.json();
        if (data.syncedLyrics) {
          const lines = parseLRC(data.syncedLyrics);
          if (lines.length > 0) {
            const result = {
              synced: true,
              lines,
              plainLyrics: data.plainLyrics || lines.map(l => l.text).join('\n'),
              source: 'lrclib',
            };
            lyricsCache.set(cacheKey, result);
            return result;
          }
        }
        if (data.plainLyrics) {
          const result = {
            synced: false,
            lines: [],
            plainLyrics: data.plainLyrics,
            source: 'lrclib-plain',
          };
          lyricsCache.set(cacheKey, result);
          return result;
        }
      } else if (res.status === 503 || res.status === 429) {
        serviceUnavailable = true;
      }
    } catch (err) {
      // Ağ hatası (çevrimdışı vb.)
    }

    // 3. Kademe: LRCLIB Genişletilmiş Arama Fallback (Servis 503/429 vermediyse dene)
    if (!serviceUnavailable) {
      try {
        const query = `${cleanTitle} ${artistName || ''}`.trim();
        const headers = (typeof window === 'undefined')
          ? { 'User-Agent': 'QueueSpotify/1.0.0 (https://queuespotify.vercel.app)' }
          : {};
        const res = await fetch(`${LRCLIB_BASE_URL}/search?q=${encodeURIComponent(query)}`, { headers });

        if (res.ok) {
          const items = await res.json();
          if (Array.isArray(items) && items.length > 0) {
            // Senkronize olan ilk sonucu tercih et
            const matched = items.find(i => i.syncedLyrics) || items[0];
            if (matched.syncedLyrics) {
              const lines = parseLRC(matched.syncedLyrics);
              if (lines.length > 0) {
                const result = {
                  synced: true,
                  lines,
                  plainLyrics: matched.plainLyrics || lines.map(l => l.text).join('\n'),
                  source: 'lrclib-search',
                };
                lyricsCache.set(cacheKey, result);
                return result;
              }
            }
            if (matched.plainLyrics) {
              const result = {
                synced: false,
                lines: [],
                plainLyrics: matched.plainLyrics,
                source: 'lrclib-search-plain',
              };
              lyricsCache.set(cacheKey, result);
              return result;
            }
          }
        }
      } catch (err) {
        // Genişletilmiş arama hatası
      }
    }

    // Hiçbir söz bulunamazsa boş sonuç dön
    const notFoundResult = {
      synced: false,
      lines: [],
      plainLyrics: '',
      source: 'none',
    };
    lyricsCache.set(cacheKey, notFoundResult);
    return notFoundResult;
  }

  function clearCache() {
    lyricsCache.clear();
  }

  return {
    parseLRC,
    getActiveLineIndex,
    cleanTrackTitle,
    fetchLyrics,
    clearCache,
    EMBEDDED_FIXTURES,
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = LyricsEngine;
}
