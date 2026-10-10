// ============================================
// QueueDrop — Spotify API Client
// ============================================

const SpotifyAPI = (() => {
  const BASE_URL = 'https://api.spotify.com/v1';
  const MAX_RETRIES = 3;

  // Arama pazarı: kullanıcının hesabından gelir, gelmezse TR.
  let searchMarket = 'TR';
  function setMarket(code) {
    if (typeof code === 'string' && /^[A-Za-z]{2}$/.test(code)) searchMarket = code.toUpperCase();
  }
  function getMarket() { return searchMarket; }

  // Son çalma-durumu hatası: "cihaz yok" ile "ulaşılamadı" ayrılabilsin diye.
  let lastPlaybackError = null;
  function getLastPlaybackError() { return lastPlaybackError; }

  function apiError(message, status, reason) {
    const err = new Error(message);
    err.status = status;
    if (reason) err.reason = reason;
    return err;
  }

  /** Spotify hata gövdesini kullanıcının okuyabileceği bir cümleye çevirir. */
  function translateError(status, reason, fallback) {
    if (reason === 'PREMIUM_REQUIRED' || (fallback && /premium/i.test(fallback))) {
      return 'Bu işlem Spotify Premium gerektiriyor. Hesabınız Premium değilse kuyruğa ekleme çalışmaz.';
    }
    if (status === 403) {
      if (fallback && /scope|permission|insufficient|unauthorized/i.test(fallback)) {
        return 'Çalma listesi oluşturma izni eksik. Lütfen sağ üstteki profil simgenize tıklayıp Çıkış Yapın ve yeni izinleri onaylamak için tekrar giriş yapın.';
      }
      return fallback || 'İşlem için yetki verilmedi (403). Lütfen oturumu kapatıp yeniden giriş yapın.';
    }
    if (reason === 'NO_ACTIVE_DEVICE' || status === 404) {
      return 'Aktif Spotify cihazı yok. Spotify uygulamasını açıp bir şarkı başlatın, sonra tekrar deneyin.';
    }
    if (status === 429) return 'Spotify istek sınırına takıldı. Biraz bekleyip tekrar deneyin.';
    if (status >= 500) return 'Spotify şu anda yanıt vermiyor. Birazdan tekrar deneyin.';
    return fallback || `Spotify hatası (${status})`;
  }

  /** Kalan her istekte de tekrarlanacak, yani devam etmenin anlamı olmayan hatalar. */
  function isFatal(err) {
    return !!err && (err.status === 401 || err.status === 403 || err.status === 404);
  }

  // Blacklist patterns for filtering out covers/karaoke
  const BLACKLIST_PATTERNS = /\b(karaoke|tribute|cover|instrumental|enstrümantal|8d audio|slowed|reverb|sped up|nightcore)\b/i;

  /**
   * Make an authenticated request to Spotify API.
   */
  async function apiRequest(endpoint, options = {}, attempt = 0) {
    const token = await SpotifyAuth.getValidToken();
    if (!token) throw new Error('Giriş yapılmamış');

    const url = endpoint.startsWith('http') ? endpoint : `${BASE_URL}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    // Handle rate limiting
    // Hız sınırı — tavanlı. Eskiden tavan yoktu: Spotify 429 vermeye devam
    // ederse özyineleme sonsuza kadar sürerdi.
    if (response.status === 429) {
      if (attempt >= MAX_RETRIES) {
        throw apiError(translateError(429), 429);
      }
      const header = parseInt(response.headers.get('Retry-After') || '2', 10);
      const retryAfter = Math.min(Number.isFinite(header) ? header : 2, 30);
      await sleep(retryAfter * 1000);
      return apiRequest(endpoint, options, attempt + 1);
    }

    // Token süresi dolmuş — bir kez yenile, bir kez daha dene. Sonra vazgeç.
    if (response.status === 401) {
      if (attempt >= 1) {
        throw apiError('Oturum doğrulanamadı. Lütfen tekrar giriş yapın.', 401);
      }
      await SpotifyAuth.refreshAccessToken();
      return apiRequest(endpoint, options, attempt + 1);
    }

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const reason = errData.error?.reason || '';
      throw apiError(
        translateError(response.status, reason, errData.error?.message),
        response.status,
        reason
      );
    }

    // Gövdesiz başarı yanıtları.
    //
    // Burada ÖNEMLİ bir tuzak vardı: kod yalnız 204'ü gövdesiz sayıyor,
    // diğer her başarıda `response.json()` çağırıyordu. Spotify'ın
    // POST /me/player/queue ucu çoğu zaman 204 döner ama **boş gövdeli 200**
    // de dönebiliyor. O durumda `response.json()` "Unexpected end of JSON
    // input" fırlatıyor, şarkı Spotify'a EKLENDİĞİ hâlde uygulama başarısız
    // sayıyordu. Aynı tuzak play/pause/next/previous/seek için de geçerli.
    //
    // Çözüm: gövdeyi metin olarak al, boşsa null dön, JSON değilse de null.
    if (response.status === 204 || response.status === 205) return null;

    const text = await response.text();
    if (!text || !text.trim()) return null;
    try {
      return JSON.parse(text);
    } catch (e) {
      return null; // başarı yanıtı JSON değil — hata sayma
    }
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current user profile.
   */
  async function getUserProfile() {
    const data = await apiRequest('/me');
    setMarket(data.country); // arama sonuçları kullanıcının ülkesine göre
    return {
      id: data.id,
      name: data.display_name,
      image: data.images?.[0]?.url || null,
      product: data.product, // 'premium' or 'free'
      country: data.country || null,
    };
  }

  /**
   * Get current playback state (active device info).
   */
  async function getPlaybackState() {
    try {
      const data = await apiRequest('/me/player');
      lastPlaybackError = null;
      if (!data) return null;
      return {
        isPlaying: data.is_playing,
        device: data.device ? {
          id: data.device.id,
          name: data.device.name,
          type: data.device.type,
          isActive: data.device.is_active,
        } : null,
        currentTrack: data.item ? {
          name: data.item.name,
          artist: data.item.artists?.map(a => a.name).join(', '),
          album: data.item.album?.name,
          image: data.item.album?.images?.[0]?.url,
        } : null,
      };
    } catch (err) {
      // null dönüşü "cihaz yok" anlamına da geliyordu; artık ayırt edilebilir.
      lastPlaybackError = { status: err.status || 0, message: err.message };
      return null;
    }
  }

  /**
   * Get a track by its Spotify ID or URI.
   * @param {string} trackId
   * @returns {Promise<Object>}
   */
  async function getTrack(trackId) {
    if (!trackId) throw apiError('Geçersiz şarkı ID', 400);
    const cleanId = trackId.replace(/^spotify:track:/, '').split('?')[0].trim();
    const data = await apiRequest(`/tracks/${cleanId}`);
    return formatTrack(data);
  }

  // Önbellek: trackId -> audioFeatures (aynı şarkı için tekrar istek atılmaz)
  const _audioFeaturesCache = new Map();
  // Spotify API Kasım 2024 itibarıyla /audio-features endpoint'ini üçüncü taraf geliştirici
  // uygulamaları için kısıtlamış olup HTTP 403 Forbidden dönmektedir. Konsol hatalarını
  // önlemek ve kullanıcının anlık BPM isteğini dinamik motorla karşılamak için varsayılan olarak kapalıdır.
  let _audioFeaturesUnsupported = true;

  /**
   * Şarkının akustik özelliklerini Spotify Audio Features API'sinden alır.
   * @param {string} trackId - Spotify track ID veya URI
   * @returns {Promise<{energy:number, danceability:number, tempo:number, loudness:number, valence:number, acousticness:number, instrumentalness:number}|null>}
   */
  async function getAudioFeatures(trackId) {
    if (!trackId || _audioFeaturesUnsupported) return null;
    const cleanId = trackId.replace(/^spotify:track:/, '').split('?')[0].trim();

    // Önbellekte varsa hemen dön
    if (_audioFeaturesCache.has(cleanId)) {
      return _audioFeaturesCache.get(cleanId);
    }

    try {
      const data = await apiRequest(`/audio-features/${cleanId}`);
      if (!data) return null;

      const features = {
        energy: data.energy ?? 0.5,
        danceability: data.danceability ?? 0.5,
        tempo: data.tempo ?? 120,
        loudness: data.loudness ?? -8,
        valence: data.valence ?? 0.5,
        acousticness: data.acousticness ?? 0.2,
        instrumentalness: data.instrumentalness ?? 0,
        liveness: data.liveness ?? 0.1,
        speechiness: data.speechiness ?? 0.05,
      };

      _audioFeaturesCache.set(cleanId, features);

      // Önbellek büyümesin: 50 şarkıyı aşınca en eski yarıyı temizle
      if (_audioFeaturesCache.size > 50) {
        const keys = [..._audioFeaturesCache.keys()];
        for (let i = 0; i < 25; i++) _audioFeaturesCache.delete(keys[i]);
      }

      return features;
    } catch (err) {
      if (err.status === 403) {
        // Spotify artık yeni API istemcilerinde audio-features'ı 403 ile kısıtladı.
        // Tekrar tekrar istek atıp konsolu kirletmemek için sessizce devre dışı bırak.
        _audioFeaturesUnsupported = true;
      }
      return null;
    }
  }

  /**
   * Search for a track with smart matching.
   * Returns the best matching track and alternatives.
   *
   * @param {string} trackName
   * @param {string} [artistName]
   * @param {string} [spotifyId]
   * @returns {Promise<{best: Object|null, alternatives: Array, confidence: string}>}
   */
  async function searchTrack(trackName, artistName, spotifyId) {
    // Check if trackName or explicit spotifyId is a Spotify URL or URI
    const directId = spotifyId ||
      ((trackName || '').match(/(?:https?:\/\/open\.spotify\.com\/(?:intl-[a-z]{2}\/)?track\/|spotify:track:)([a-zA-Z0-9]{22})/i) || [])[1];

    if (directId) {
      try {
        const directTrack = await getTrack(directId);
        if (directTrack) {
          return { best: directTrack, alternatives: [], confidence: 'high' };
        }
      } catch (err) {
        console.warn('Direct track get failed, falling back to search query:', err);
      }
    }

    // Build the search query with field filters
    let query;
    if (artistName) {
      query = `track:"${trackName}" artist:"${artistName}"`;
    } else {
      query = `track:"${trackName}"`;
    }

    const params = new URLSearchParams({
      q: query,
      type: 'track',
      limit: '10',
      market: searchMarket,
    });

    const data = await apiRequest(`/search?${params.toString()}`);
    const tracks = data?.tracks?.items || [];

    if (tracks.length === 0 && artistName) {
      // Fallback 1: Try without field filters (broader search)
      const fallbackParams = new URLSearchParams({
        q: `${trackName} ${artistName}`,
        type: 'track',
        limit: '10',
        market: searchMarket,
      });
      const fallbackData = await apiRequest(`/search?${fallbackParams.toString()}`);
      const fallbackTracks = fallbackData?.tracks?.items || [];

      if (fallbackTracks.length === 0) {
        // Fallback 2: Try reversed (maybe user wrote Artist - Track)
        const reverseParams = new URLSearchParams({
          q: `track:"${artistName}" artist:"${trackName}"`,
          type: 'track',
          limit: '10',
          market: searchMarket,
        });
        const reverseData = await apiRequest(`/search?${reverseParams.toString()}`);
        return scoreAndRank(reverseData?.tracks?.items || [], artistName, trackName);
      }

      return scoreAndRank(fallbackTracks, trackName, artistName);
    }

    return scoreAndRank(tracks, trackName, artistName);
  }

  /**
   * Score and rank search results to find the best match.
   */
  function scoreAndRank(tracks, trackName, artistName) {
    if (!tracks || tracks.length === 0) {
      return { best: null, alternatives: [], confidence: 'none' };
    }

    // Score each track
    const scored = tracks.map(track => {
      let score = 0;

      // 1. Artist match (most important)
      if (artistName) {
        const artistNames = track.artists.map(a => a.name);
        const bestArtistMatch = Math.max(
          ...artistNames.map(name => Parser.similarity(name, artistName))
        );
        score += bestArtistMatch * 40;
      }

      // 2. Track name match
      const titleSim = Parser.similarity(track.name, trackName);
      score += titleSim * 30;

      // 3. Popularity bonus (prefer popular = original)
      score += (track.popularity / 100) * 15;

      // 4. Penalty for karaoke/cover/tribute
      if (BLACKLIST_PATTERNS.test(track.name) || 
          track.artists.some(a => BLACKLIST_PATTERNS.test(a.name))) {
        score -= 30;
      }

      // 5. Penalty for remix (unless user specifically asked)
      const isRemix = /\b(remix|mix)\b/i.test(track.name);
      const userWantsRemix = /\b(remix|mix)\b/i.test(trackName);
      if (isRemix && !userWantsRemix) {
        score -= 10;
      }

      // 6. Bonus for exact title match
      if (Parser.fuzzyMatch(track.name, trackName)) {
        score += 10;
      }

      // 7. Album type bonus
      if (track.album?.album_type === 'album') score += 3;
      if (track.album?.album_type === 'single') score += 1;

      return {
        ...formatTrack(track),
        _score: score,
      };
    });

    // Sort by score descending
    scored.sort((a, b) => b._score - a._score);

    const best = scored[0] || null;
    const alternatives = scored.slice(1, 5);

    // Determine confidence level
    let confidence = 'none';
    if (best) {
      if (best._score >= 70) confidence = 'high';
      else if (best._score >= 40) confidence = 'medium';
      else confidence = 'low';
    }

    return { best, alternatives, confidence };
  }

  /**
   * Format a Spotify track object into our simplified format.
   */
  function formatTrack(track) {
    return {
      uri: track.uri,
      id: track.id,
      name: track.name,
      artist: track.artists?.map(a => a.name).join(', ') || '',
      artistId: track.artists?.[0]?.id || '',
      album: track.album?.name || '',
      albumImage: track.album?.images?.[1]?.url || track.album?.images?.[0]?.url || '',
      albumImageSmall: track.album?.images?.[2]?.url || track.album?.images?.[1]?.url || '',
      duration: track.duration_ms || 0,
      popularity: track.popularity || 0,
      previewUrl: track.preview_url || null,
      externalUrl: track.external_urls?.spotify || '',
    };
  }

  /**
   * Add a track to the user's playback queue.
   * @param {string} uri - Spotify track URI (e.g., "spotify:track:xxx")
   * @returns {Promise<boolean>}
   */
  async function addToQueue(uri) {
    const params = new URLSearchParams({ uri });
    await apiRequest(`/me/player/queue?${params.toString()}`, {
      method: 'POST',
    });
    return true;
  }

  /**
   * Add multiple tracks to queue sequentially with a small delay.
   * @param {Array<string>} uris - Array of Spotify track URIs
   * @param {Function} onProgress - Callback with (index, total, track)
   * @returns {Promise<{success: number, failed: number, errors: Array}>}
   */
  async function addMultipleToQueue(uris, onProgress) {
    let success = 0;
    let failed = 0;
    let aborted = false;
    let abortReason = '';
    const errors = [];

    for (let i = 0; i < uris.length; i++) {
      try {
        await addToQueue(uris[i]);
        success++;
        if (onProgress) onProgress(i, uris.length, 'success');
      } catch (err) {
        failed++;
        errors.push({ index: i, uri: uris[i], error: err.message, status: err.status });
        if (onProgress) onProgress(i, uris.length, 'error');

        // Premium yok / cihaz yok / oturum düştü: kalan her şarkıda da olacak.
        // 50 kez aynı hatayı almak yerine dur ve sebebi taşı.
        if (isFatal(err)) {
          aborted = true;
          abortReason = err.message;
          break;
        }
      }

      // Small delay between requests to avoid rate limiting
      if (i < uris.length - 1) {
        await sleep(150);
      }
    }

    return {
      success,
      failed,
      errors,
      aborted,
      abortReason,
      skipped: uris.length - success - failed,
    };
  }

  /**
   * Format milliseconds to mm:ss string.
   */
  function formatDuration(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  /**
   * Format total duration to human-readable string.
   */
  function formatTotalDuration(ms) {
    const totalMinutes = Math.floor(ms / 60000);
    if (totalMinutes < 60) return `${totalMinutes} dk`;
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${hours} sa ${mins} dk`;
  }

  /**
   * Kullanıcının tüm Spotify cihazlarını listeler.
   *
   * Neden gerekli: uygulama bilgisayarda açıkken müzik telefonda çalıyor
   * olabilir (ya da tersi). Kuyruğa ekleme her zaman AKTİF cihaza gider;
   * aktif cihaz kullanıcının baktığı cihaz olmak zorunda değil.
   */
  async function getDevices() {
    try {
      const data = await apiRequest('/me/player/devices');
      const list = (data && data.devices) ? data.devices : [];
      return list.map((d) => ({
        id: d.id,
        name: d.name,
        type: d.type,
        isActive: !!d.is_active,
        isRestricted: !!d.is_restricted,
        volume: d.volume_percent,
      }));
    } catch (err) {
      lastPlaybackError = { status: err.status || 0, message: err.message };
      return [];
    }
  }

  /**
   * Çalmayı başka bir cihaza aktarır. play=false ise mevcut durum korunur.
   */
  async function transferPlayback(deviceId, play) {
    await apiRequest('/me/player', {
      method: 'PUT',
      body: JSON.stringify({ device_ids: [deviceId], play: !!play }),
    });
    return true;
  }

  /**
   * Get the user's current playback queue.
   * Returns currently_playing track and queue array.
   */
  async function getQueue() {
    try {
      const data = await apiRequest('/me/player/queue');
      if (!data) return { currentlyPlaying: null, queue: [] };
      return {
        currentlyPlaying: data.currently_playing ? formatTrack(data.currently_playing) : null,
        queue: (data.queue || []).map(t => formatTrack(t)),
      };
    } catch (err) {
      console.error('getQueue error:', err);
      return { currentlyPlaying: null, queue: [] };
    }
  }

  /**
   * Get the currently playing track with progress info.
   */
  async function getCurrentlyPlaying() {
    try {
      const data = await apiRequest('/me/player/currently-playing');
      if (!data || !data.item) return null;
      return {
        track: formatTrack(data.item),
        isPlaying: data.is_playing,
        progressMs: data.progress_ms || 0,
        durationMs: data.item.duration_ms || 0,
        timestamp: data.timestamp,
      };
    } catch (err) {
      console.error('getCurrentlyPlaying error:', err);
      return null;
    }
  }

  /**
   * Toggle play/pause.
   */
  async function togglePlayPause(isCurrentlyPlaying) {
    if (isCurrentlyPlaying) {
      await apiRequest('/me/player/pause', { method: 'PUT' });
    } else {
      await apiRequest('/me/player/play', { method: 'PUT' });
    }
  }

  /**
   * Play a specific track URI immediately on active player.
   * @param {string} uri - Spotify track URI (e.g. spotify:track:...)
   */
  async function playTrack(uri) {
    if (!uri) return false;
    await apiRequest('/me/player/play', {
      method: 'PUT',
      body: JSON.stringify({ uris: [uri] }),
    });
    return true;
  }

  /**
   * Skip to the next track.
   */
  async function nextTrack() {
    await apiRequest('/me/player/next', { method: 'POST' });
  }

  /**
   * Skip to the previous track.
   */
  async function previousTrack() {
    await apiRequest('/me/player/previous', { method: 'POST' });
  }

  /**
   * Seek to a position in the current track.
   * @param {number} positionMs - Position in milliseconds
   */
  async function seekTo(positionMs) {
    const params = new URLSearchParams({ position_ms: Math.round(positionMs) });
    await apiRequest(`/me/player/seek?${params.toString()}`, { method: 'PUT' });
  }

  /**
   * Set playback volume percentage (0-100).
   * @param {number} volumePercent
   */
  async function setVolume(volumePercent) {
    const vol = Math.max(0, Math.min(100, Math.round(volumePercent)));
    const params = new URLSearchParams({ volume_percent: vol });
    await apiRequest(`/me/player/volume?${params.toString()}`, { method: 'PUT' });
    return true;
  }

  /**
   * Set shuffle state.
   * @param {boolean} state
   */
  async function toggleShuffle(state) {
    const params = new URLSearchParams({ state: !!state });
    await apiRequest(`/me/player/shuffle?${params.toString()}`, { method: 'PUT' });
    return true;
  }

  /**
   * Set repeat mode ('track', 'context', 'off').
   * @param {string} mode
   */
  async function toggleRepeat(mode = 'off') {
    const params = new URLSearchParams({ state: mode });
    await apiRequest(`/me/player/repeat?${params.toString()}`, { method: 'PUT' });
    return true;
  }

  /**
   * Save a list of track URIs as a new Spotify playlist.
   * @param {string} playlistName
   * @param {Array<string>} trackUris
   * @returns {Promise<{id: string, name: string, externalUrl: string}>}
   */
  async function saveQueueAsPlaylist(playlistName, trackUris) {
    if (!trackUris || trackUris.length === 0) {
      throw new Error('Kaydedilecek şarkı bulunamadı');
    }

    const name = (playlistName && playlistName.trim()) ? playlistName.trim() : `QueueDrop Mix (${new Date().toLocaleDateString('tr-TR')})`;
    
    // Create new playlist via modern /me/playlists endpoint
    let playlist;
    try {
      playlist = await apiRequest('/me/playlists', {
        method: 'POST',
        body: JSON.stringify({
          name,
          description: 'QueueDrop — Akıllı Kuyruk Yöneticisi ile oluşturuldu.',
          public: false,
        }),
      });
    } catch (err) {
      // 403 usually indicates token lacks playlist-modify scopes or deprecated endpoint
      if (err.status === 403) {
        throw new Error('Çalma listesi oluşturma izni eksik olabilir. Lütfen sağ üstteki profil simgenizden Çıkış Yap\'ıp tekrar bağlanarak yeni izinleri onaylayın.');
      }
      // Fallback to /users/{profile.id}/playlists if older API behavior
      const profile = await getUserProfile().catch(() => null);
      if (profile?.id) {
        playlist = await apiRequest(`/users/${encodeURIComponent(profile.id)}/playlists`, {
          method: 'POST',
          body: JSON.stringify({
            name,
            description: 'QueueDrop — Akıllı Kuyruk Yöneticisi ile oluşturuldu.',
            public: false,
          }),
        });
      } else {
        throw err;
      }
    }

    if (!playlist || !playlist.id) throw new Error('Çalma listesi oluşturulamadı');

    // Add tracks in chunks of 100
    const chunkSize = 100;
    for (let i = 0; i < trackUris.length; i += chunkSize) {
      const chunk = trackUris.slice(i, i + chunkSize);
      try {
        await apiRequest(`/playlists/${playlist.id}/items`, {
          method: 'POST',
          body: JSON.stringify({ uris: chunk }),
        });
      } catch (itemErr) {
        // Fallback to /tracks for older API versions
        await apiRequest(`/playlists/${playlist.id}/tracks`, {
          method: 'POST',
          body: JSON.stringify({ uris: chunk }),
        });
      }
      if (i + chunkSize < trackUris.length) {
        await sleep(200);
      }
    }

    return {
      id: playlist.id,
      name: playlist.name,
      externalUrl: playlist.external_urls?.spotify || '',
    };
  }

  /**
   * Get Spotify recommendations based on seed track IDs and optional vibes.
   * @param {Array<string>} seedTrackIds
   * @param {Object} options - { limit, target_energy, target_danceability, target_valence }
   * @returns {Promise<Array>}
   */
  async function getRecommendations(seedTrackIds = [], options = {}) {
    try {
      const cleanSeeds = seedTrackIds
        .map(id => (typeof id === 'string' && id.startsWith('spotify:track:') ? id.replace('spotify:track:', '') : id))
        .filter(Boolean)
        .slice(0, 5);

      const params = new URLSearchParams({
        limit: options.limit || 10,
        market: searchMarket,
      });

      if (cleanSeeds.length > 0) {
        params.append('seed_tracks', cleanSeeds.join(','));
      } else {
        // Fallback seed genre if no track seeds available
        params.append('seed_genres', 'pop,dance');
      }

      if (options.target_energy !== undefined) params.append('target_energy', options.target_energy);
      if (options.target_danceability !== undefined) params.append('target_danceability', options.target_danceability);
      if (options.target_valence !== undefined) params.append('target_valence', options.target_valence);

      const data = await apiRequest(`/recommendations?${params.toString()}`);
      return (data?.tracks || []).map(formatTrack);
    } catch (err) {
      console.warn('getRecommendations fallback:', err);
      return [];
    }
  }

  /**
   * Get current user's top tracks.
   * @param {string} timeRange - 'short_term' (4 weeks) | 'medium_term' (6 months) | 'long_term'
   * @param {number} limit
   */
  async function getTopTracks(timeRange = 'short_term', limit = 10) {
    try {
      const params = new URLSearchParams({ time_range: timeRange, limit });
      const data = await apiRequest(`/me/top/tracks?${params.toString()}`);
      return (data?.items || []).map(formatTrack);
    } catch (err) {
      console.warn('getTopTracks fallback:', err);
      return [];
    }
  }

  /**
   * Get user's recently played tracks.
   * @param {number} limit
   */
  async function getRecentlyPlayed(limit = 10) {
    try {
      const params = new URLSearchParams({ limit });
      const data = await apiRequest(`/me/player/recently-played?${params.toString()}`);
      return (data?.items || []).map(item => formatTrack(item.track));
    } catch (err) {
      console.warn('getRecentlyPlayed fallback:', err);
      return [];
    }
  }

  return {
    getUserProfile,
    getPlaybackState,
    getDevices,
    transferPlayback,
    getTrack,
    getAudioFeatures,
    searchTrack,
    addToQueue,
    addMultipleToQueue,
    formatDuration,
    formatTotalDuration,
    getQueue,
    getCurrentlyPlaying,
    getLastPlaybackError,
    getMarket,
    setMarket,
    togglePlayPause,
    playTrack,
    nextTrack,
    previousTrack,
    seekTo,
    setVolume,
    toggleShuffle,
    toggleRepeat,
    saveQueueAsPlaylist,
    getRecommendations,
    getTopTracks,
    getRecentlyPlayed,
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SpotifyAPI;
}
