// ============================================
// QueueDrop — Main Application
// ============================================

const App = (() => {
  // App state
  let state = {
    currentScreen: 'login',
    currentTab: 'builder-tab',
    parsedItems: [],
    searchResults: [], // { track, alternatives, confidence, raw }
    userProfile: null,
    playbackState: null,
    isSearching: false,
    isAddingToQueue: false,
    // Live queue / now playing
    nowPlaying: null, // { track, isPlaying, progressMs, durationMs }
    liveQueue: [],    // array of track objects
    progressTimer: null,
    queueRefreshTimer: null,
    // Ekstra Özellik Durumları (Queue Studio & Player)
    isShuffle: false,
    repeatMode: 'off', // 'off' | 'track' | 'context'
    sleepTimerEnd: null,
    sleepTimerInterval: null,
    currentVolume: 70,
    currentLyrics: null,
  };

  /**
   * Initialize the application.
   */
  async function init() {
    console.log('🎵 QueueSpotify initializing...');

    // Register Service Worker
    registerServiceWorker();

    // Check for OAuth callback (web)
    try {
      const wasCallback = await SpotifyAuth.handleCallback();
      if (wasCallback) {
        console.log('✅ OAuth callback processed');
      }
    } catch (err) {
      console.error('OAuth callback error:', err);
      UI.showToast(err.message, 'error');
    }

    // Setup native listeners if running in Capacitor Android
    if (SpotifyAuth.initNativeListeners) {
      SpotifyAuth.initNativeListeners(
        async () => {
          console.log('✅ Native deep link OAuth processed');
          await onLoggedIn();
        },
        (err) => {
          console.error('Native OAuth error:', err);
          UI.showToast(err.message, 'error');
        }
      );
    }

    // Setup UI event listeners
    setupEventListeners();

    // Check login state
    if (SpotifyAuth.isLoggedIn()) {
      await onLoggedIn();
    } else {
      showLoginScreen();
    }

    // Restore client ID & setup redirect URI display
    const savedClientId = SpotifyAuth.getClientId();
    const clientIdInput = document.getElementById('client-id-input');
    if (clientIdInput && savedClientId) {
      clientIdInput.value = savedClientId;
    }

    const redirectCode = document.getElementById('redirect-uri-code');
    if (redirectCode) {
      redirectCode.textContent = SpotifyAuth.getRedirectUri();
    }
  }

  /**
   * Register Service Worker for PWA support.
   */
  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(err => {
        console.log('SW registration failed:', err);
      });
    }
  }

  /**
   * Launch Demo Mode for immediate preview and testing.
   */
  function enterDemoMode() {
    state.isDemo = true;
    state.userProfile = {
      id: 'demo_user',
      name: 'Berk G. (Demo)',
      image: 'assets/logo.jpg',
      product: 'premium',
    };
    updateProfileUI(state.userProfile);

    state.playbackState = {
      isPlaying: true,
      device: {
        id: 'demo_device',
        name: 'Telefon (Spotify Connect)',
        type: 'Smartphone',
        isActive: true,
      },
      currentTrack: {
        name: 'Canın Sağolsun',
        artist: 'Gülşen',
        album: 'Beni Durdursan mı?',
        image: 'assets/logo.jpg',
      },
    };
    updateDeviceUI(state.playbackState);

    // Initial demo Now Playing
    state.nowPlaying = {
      track: {
        id: 'demo_track_0',
        name: 'Canın Sağolsun',
        artist: 'Gülşen',
        album: 'Beni Durdursan mı?',
        albumImage: 'assets/logo.jpg',
        albumImageSmall: 'assets/logo.jpg',
        duration: 215000,
        uri: 'spotify:track:demo0',
      },
      isPlaying: true,
      progressMs: 75000,
      durationMs: 215000,
    };

    // Initial demo Live Queue
    state.liveQueue = [
      {
        id: 'demo_track_1',
        name: 'Dan Dan',
        artist: 'Gülşen',
        album: 'Bangır Bangır',
        albumImage: 'assets/logo.jpg',
        albumImageSmall: 'assets/logo.jpg',
        duration: 202000,
        uri: 'spotify:track:demo1',
      },
      {
        id: 'demo_track_2',
        name: 'Yurtta Aşk Cihanda Aşk',
        artist: 'Gülşen',
        album: 'Yurtta Aşk Cihanda Aşk',
        albumImage: 'assets/logo.jpg',
        albumImageSmall: 'assets/logo.jpg',
        duration: 245000,
        uri: 'spotify:track:demo2',
      },
      {
        id: 'demo_track_3',
        name: 'İtaat Yok',
        artist: 'Gülşen',
        album: 'Önsöz',
        albumImage: 'assets/logo.jpg',
        albumImageSmall: 'assets/logo.jpg',
        duration: 198000,
        uri: 'spotify:track:demo3',
      },
    ];

    // Pre-fill input with user prompt example
    const input = document.getElementById('song-input');
    if (input && !input.value) {
      input.value = 'Canın Sağolsun-gülşen → Dan Dan-gülşen → Yurtta Aşk Cihanda Aşk-gülşen → İtaat Yok-gülşen';
    }

    UI.showScreen('builder-screen');
    UI.renderNowPlaying(state.nowPlaying);
    UI.renderLiveQueue(state.liveQueue, state.nowPlaying.track);
    startProgressTimer();
    loadLyricsForTrack(state.nowPlaying.track);
    UI.showToast('✨ Demo modu aktif! Tüm özellikleri deneyebilirsiniz.', 'success', 3500);
  }

  /**
   * Setup all event listeners.
   */
  function setupEventListeners() {
    // Hook real playback trigger from UI (Queue items or search result cards)
    UI.setOnPlayTrack(handlePlayTrack);
    if (typeof UI.setOnRhythmOpen === 'function') {
      UI.setOnRhythmOpen(handleRhythmClick);
    }

    // Client ID save → advance to step 2
    const saveClientIdBtn = document.getElementById('save-client-id');
    if (saveClientIdBtn) {
      saveClientIdBtn.addEventListener('click', () => {
        const input = document.getElementById('client-id-input');
        const value = input?.value?.trim();
        if (value) {
          SpotifyAuth.setClientId(value);
          goToLoginStep(2);
        } else {
          UI.showToast('Client ID boş olamaz', 'error');
        }
      });
    }

    // Also allow Enter key in client-id-input to advance
    const clientIdInput = document.getElementById('client-id-input');
    if (clientIdInput) {
      clientIdInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          saveClientIdBtn?.click();
        }
      });
    }

    // Back to step 1
    const backToStep1 = document.getElementById('back-to-step1');
    if (backToStep1) {
      backToStep1.addEventListener('click', () => goToLoginStep(1));
    }

    // Copy Redirect URI button
    const copyUriBtn = document.getElementById('copy-redirect-uri-btn');
    if (copyUriBtn) {
      copyUriBtn.addEventListener('click', async () => {
        try {
          const uri = SpotifyAuth.getRedirectUri();
          await navigator.clipboard.writeText(uri);
          copyUriBtn.textContent = 'Kopyalandı!';
          copyUriBtn.style.color = 'var(--color-green-primary)';
          setTimeout(() => {
            copyUriBtn.textContent = 'Kopyala';
            copyUriBtn.style.color = '';
          }, 2000);
          UI.showToast('Redirect URI panoya kopyalandı', 'success');
        } catch (e) {
          UI.showToast(SpotifyAuth.getRedirectUri(), 'info', 6000);
        }
      });
    }

    // Step indicators clickable
    document.querySelectorAll('.login-step').forEach(stepEl => {
      stepEl.style.cursor = 'pointer';
      stepEl.addEventListener('click', () => {
        const s = parseInt(stepEl.dataset.step);
        if (s === 1) goToLoginStep(1);
        else if (s === 2 && SpotifyAuth.getClientId()) goToLoginStep(2);
      });
    });

    // Spotify Login
    const loginBtn = document.getElementById('spotify-login-btn');
    if (loginBtn) {
      loginBtn.addEventListener('click', async () => {
        try {
          const clientId = SpotifyAuth.getClientId();
          if (!clientId) {
            UI.showToast('Önce Client ID girin', 'error');
            goToLoginStep(1);
            return;
          }
          loginBtn.disabled = true;
          loginBtn.innerHTML = '<div class="btn-spinner"></div> Spotify\'a yönlendiriliyor...';
          await SpotifyAuth.login();
        } catch (err) {
          UI.showToast(err.message, 'error');
          loginBtn.disabled = false;
          loginBtn.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
            </svg>
            Spotify Hesabıyla Giriş Yap
          `;
        }
      });
    }

    // Demo Mode Button
    const demoBtn = document.getElementById('demo-mode-btn');
    if (demoBtn) {
      demoBtn.addEventListener('click', enterDemoMode);
    }

    // Search / Find Songs Button
    const searchBtn = document.getElementById('search-btn');
    if (searchBtn) {
      searchBtn.addEventListener('click', handleSearch);
    }

    // Textarea - Enter key shortcut (Ctrl+Enter to search)
    const textarea = document.getElementById('song-input');
    if (textarea) {
      textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          handleSearch();
        }
      });

      // Auto-resize textarea
      textarea.addEventListener('input', () => {
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 300) + 'px';
      });
    }

    // Quick insert buttons
    document.querySelectorAll('.quick-insert-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const textarea = document.getElementById('song-input');
        const text = btn.dataset.insert;
        if (textarea && text) {
          UI.insertAtCursor(textarea, text);
        }
      });
    });

    // Fill Example list
    const fillExample = () => {
      const textarea = document.getElementById('song-input');
      if (textarea) {
        textarea.value = 'Canın Sağolsun - Gülşen → Dan Dan - Gülşen → Yurtta Aşk Cihanda Aşk - Gülşen → İtaat Yok - Gülşen';
        textarea.focus();
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 300) + 'px';
        UI.showToast('Örnek şarkı listesi eklendi', 'info');
      }
    };
    const fillExampleBtn = document.getElementById('fill-example-btn');
    if (fillExampleBtn) fillExampleBtn.addEventListener('click', fillExample);
    const exampleSample = document.getElementById('example-text-sample');
    if (exampleSample) exampleSample.addEventListener('click', fillExample);

    // Add to Queue button
    const queueBtn = document.getElementById('add-to-queue-btn');
    if (queueBtn) {
      queueBtn.addEventListener('click', handleAddToQueue);
    }

    // Back to builder
    const backBtn = document.getElementById('back-to-builder');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        UI.showScreen('builder-screen');
      });
    }

    // New queue button (from success screen)
    const newQueueBtn = document.getElementById('new-queue-btn');
    if (newQueueBtn) {
      newQueueBtn.addEventListener('click', () => {
        const textarea = document.getElementById('song-input');
        if (textarea) textarea.value = '';
        state.searchResults = [];
        state.parsedItems = [];
        UI.showScreen('builder-screen');
      });
    }

    // Logout
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        SpotifyAuth.logout();
        state.userProfile = null;
        stopProgressTimer();
        stopQueueAutoRefresh();
        showLoginScreen();
        UI.showToast('Çıkış yapıldı', 'info');
      });
    }

    // ==========================================
    // Tab switching (Click & WAI-ARIA Keyboard Navigation)
    // ==========================================
    const tabBtns = Array.from(document.querySelectorAll('.tab-btn'));
    tabBtns.forEach((btn, index) => {
      btn.addEventListener('click', () => {
        const tabId = btn.dataset.tab;
        switchTab(tabId);
      });
      btn.addEventListener('keydown', (e) => {
        let targetIndex = -1;
        if (e.key === 'ArrowRight') {
          targetIndex = (index + 1) % tabBtns.length;
        } else if (e.key === 'ArrowLeft') {
          targetIndex = (index - 1 + tabBtns.length) % tabBtns.length;
        } else if (e.key === 'Home') {
          targetIndex = 0;
        } else if (e.key === 'End') {
          targetIndex = tabBtns.length - 1;
        }
        if (targetIndex !== -1) {
          e.preventDefault();
          tabBtns[targetIndex].focus();
          tabBtns[targetIndex].click();
        }
      });
    });

    // ==========================================
    // Playback controls (Now Playing)
    // ==========================================
    const ctrlPlayPause = document.getElementById('ctrl-play-pause');
    if (ctrlPlayPause) {
      ctrlPlayPause.addEventListener('click', handlePlayPause);
    }

    const ctrlPrev = document.getElementById('ctrl-prev');
    if (ctrlPrev) {
      ctrlPrev.addEventListener('click', handlePrevious);
    }

    const ctrlNext = document.getElementById('ctrl-next');
    if (ctrlNext) {
      ctrlNext.addEventListener('click', handleNext);
    }

    // Mini player controls
    const miniPlayPause = document.getElementById('mini-play-pause');
    if (miniPlayPause) {
      miniPlayPause.addEventListener('click', handlePlayPause);
    }

    const miniNext = document.getElementById('mini-next');
    if (miniNext) {
      miniNext.addEventListener('click', handleNext);
    }

    // Progress bar seek
    const progressContainer = document.getElementById('np-progress-container');
    if (progressContainer) {
      progressContainer.addEventListener('click', handleSeek);
    }

    // Queue refresh button
    const refreshBtn = document.getElementById('queue-refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        refreshBtn.classList.add('spinning');
        fetchLiveQueue().finally(() => {
          setTimeout(() => refreshBtn.classList.remove('spinning'), 800);
        });
      });
    }

    // Vibe / Quick discovery chips
    document.querySelectorAll('.vibe-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        handleVibeChip(btn.dataset.vibe);
      });
    });

    // Secondary playback controls (Shuffle, Repeat, Sleep Timer)
    const shuffleBtn = document.getElementById('ctrl-shuffle');
    if (shuffleBtn) shuffleBtn.addEventListener('click', handleShuffleToggle);

    const repeatBtn = document.getElementById('ctrl-repeat');
    if (repeatBtn) repeatBtn.addEventListener('click', handleRepeatToggle);

    const sleepTimerBtn = document.getElementById('ctrl-sleep-timer');
    if (sleepTimerBtn) sleepTimerBtn.addEventListener('click', handleSleepTimerModalClick);

    const lyricsBtn = document.getElementById('ctrl-lyrics');
    if (lyricsBtn) lyricsBtn.addEventListener('click', handleLyricsClick);

    const rhythmBtn = document.getElementById('ctrl-rhythm');
    if (rhythmBtn) rhythmBtn.addEventListener('click', handleRhythmClick);

    // Global keyboard shortcuts (R for Rhythm Screen, Escape to close)
    window.addEventListener('keydown', (e) => {
      const activeTag = document.activeElement?.tagName;
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;

      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        handleRhythmClick();
      } else if (e.key === 'Escape') {
        if (UI.isRhythmScreenOpen && UI.isRhythmScreenOpen()) {
          UI.closeRhythmScreen();
        } else if (UI.isLyricsOpen && UI.isLyricsOpen()) {
          UI.closeLyrics();
        }
      }
    });

    // Volume Slider
    const volumeSlider = document.getElementById('np-volume-slider');
    if (volumeSlider) {
      volumeSlider.addEventListener('input', (e) => {
        handleVolumeChange(parseInt(e.target.value, 10));
      });
    }

    // Queue Toolbar (Save as Playlist, Smart Flow, Smart Shuffle, Deduplicate)
    const savePlaylistBtn = document.getElementById('btn-save-playlist');
    if (savePlaylistBtn) savePlaylistBtn.addEventListener('click', handleSavePlaylistClick);

    const smartFlowBtn = document.getElementById('btn-smart-flow');
    if (smartFlowBtn) smartFlowBtn.addEventListener('click', handleSmartFlowClick);

    const smartShuffleBtn = document.getElementById('btn-smart-shuffle');
    if (smartShuffleBtn) smartShuffleBtn.addEventListener('click', handleSmartShuffleClick);

    const deduplicateBtn = document.getElementById('btn-deduplicate');
    if (deduplicateBtn) deduplicateBtn.addEventListener('click', handleDeduplicateClick);

    // Builder Tab: ML Tamamlama Butonu
    const mlCompleteBuilderBtn = document.getElementById('btn-ml-complete-builder');
    if (mlCompleteBuilderBtn) mlCompleteBuilderBtn.addEventListener('click', handleMlCompleteBuilderClick);
  }

  // ==========================================
  // Tab Switching
  // ==========================================

  function switchTab(tabId) {
    state.currentTab = tabId;

    // Update tab buttons with ARIA attributes
    document.querySelectorAll('.tab-btn').forEach(btn => {
      const isActive = btn.dataset.tab === tabId;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
      btn.setAttribute('tabindex', isActive ? '0' : '-1');
    });

    // Update tab panels with hidden attribute
    document.querySelectorAll('.tab-panel').forEach(panel => {
      const isActive = panel.id === tabId;
      panel.classList.toggle('active', isActive);
      panel.hidden = !isActive;
    });

    // When switching to live queue, fetch data and hide mini-player
    const miniPlayer = document.getElementById('mini-player');
    if (tabId === 'live-queue-tab') {
      if (miniPlayer) UI.setHidden(miniPlayer, true);
      fetchLiveQueue();
      startQueueAutoRefresh();
    } else {
      if (miniPlayer && state.nowPlaying && state.nowPlaying.track) {
        UI.setHidden(miniPlayer, false, 'flex');
      }
      stopQueueAutoRefresh();
    }
  }

  // ==========================================
  // Live Queue & Now Playing
  // ==========================================

  /**
   * Fetch current playback and queue from Spotify.
   */
  async function fetchLiveQueue() {
    if (state.isDemo && !SpotifyAuth.isLoggedIn()) {
      if (state.nowPlaying) UI.renderNowPlaying(state.nowPlaying);
      if (state.liveQueue) UI.renderLiveQueue(state.liveQueue, state.nowPlaying?.track);
      return;
    }

    try {
      // Fetch both in parallel
      const [nowPlayingData, queueData] = await Promise.all([
        SpotifyAPI.getCurrentlyPlaying(),
        SpotifyAPI.getQueue(),
      ]);

      // Track change check
      const prevTrackName = state.nowPlaying?.track?.name;
      const newTrackName = nowPlayingData?.track?.name;
      const isTrackChanged = newTrackName && (prevTrackName !== newTrackName);

      // Update now playing
      state.nowPlaying = nowPlayingData;
      UI.renderNowPlaying(nowPlayingData);

      if (nowPlayingData?.track && (isTrackChanged || !state.currentLyrics || state.currentLyrics.trackName !== nowPlayingData.track.name)) {
        loadLyricsForTrack(nowPlayingData.track);
      }

      if (UI.isRhythmScreenOpen && UI.isRhythmScreenOpen() && nowPlayingData) {
        if (isTrackChanged && nowPlayingData.track) {
          // Şarkı değiştiğinde yeni audio features çek
          const trackId = nowPlayingData.track.id || nowPlayingData.track.uri?.split(':').pop();
          if (trackId) {
            SpotifyAPI.getAudioFeatures(trackId).then(features => {
              UI.updateRhythmTrack(nowPlayingData.track, features);
            }).catch(() => {
              UI.updateRhythmTrack(nowPlayingData.track);
            });
          } else {
            UI.updateRhythmTrack(nowPlayingData.track);
          }
        }
        UI.updateRhythmPlayback(nowPlayingData);
      }

      // Update queue
      state.liveQueue = queueData.queue || [];
      UI.renderLiveQueue(state.liveQueue);

      // Start progress timer if playing
      if (nowPlayingData?.isPlaying) {
        startProgressTimer();
      } else {
        stopProgressTimer();
      }

      // Also update device status
      const playback = await SpotifyAPI.getPlaybackState();
      state.playbackState = playback;
      updateDeviceUI(playback);
    } catch (err) {
      console.error('fetchLiveQueue error:', err);
    }
  }

  /**
   * Alias / Polling helper for playback state
   */
  async function pollPlayerState() {
    return await fetchLiveQueue();
  }

  /**
   * Start a 1-second timer to smoothly update the progress bar.
   */
  function startProgressTimer() {
    stopProgressTimer();
    state.progressTimer = setInterval(() => {
      if (state.nowPlaying && state.nowPlaying.isPlaying) {
        state.nowPlaying.progressMs += 1000;
        if (state.nowPlaying.progressMs >= state.nowPlaying.durationMs) {
          // Track likely ended, refresh immediately
          state.nowPlaying.progressMs = state.nowPlaying.durationMs;
          fetchLiveQueue();
          return;
        }
        UI.updatePlaybackProgress(state.nowPlaying.progressMs, state.nowPlaying.durationMs);
        if (UI.isLyricsOpen && UI.isLyricsOpen()) {
          UI.updateActiveLyric(state.nowPlaying.progressMs);
        }
        if (UI.isRhythmScreenOpen && UI.isRhythmScreenOpen()) {
          UI.updateRhythmPlayback(state.nowPlaying);
        }
      }
    }, 1000);
  }

  function stopProgressTimer() {
    if (state.progressTimer) {
      clearInterval(state.progressTimer);
      state.progressTimer = null;
    }
  }

  /**
   * Auto-refresh queue and now playing every 4 seconds when on live queue tab or lyrics view.
   */
  function startQueueAutoRefresh() {
    stopQueueAutoRefresh();
    state.queueRefreshTimer = setInterval(() => {
      if (state.currentTab === 'live-queue-tab' || (UI.isLyricsOpen && UI.isLyricsOpen()) || (UI.isRhythmScreenOpen && UI.isRhythmScreenOpen())) {
        fetchLiveQueue();
      }
    }, 4000);
  }

  function stopQueueAutoRefresh() {
    if (state.queueRefreshTimer) {
      clearInterval(state.queueRefreshTimer);
      state.queueRefreshTimer = null;
    }
  }

  // ==========================================
  // Playback Controls
  // ==========================================

  async function handlePlayPause() {
    if (!state.nowPlaying) return;
    try {
      const wasPlaying = state.nowPlaying.isPlaying;
      if (state.isDemo && !SpotifyAuth.isLoggedIn()) {
        state.nowPlaying.isPlaying = !wasPlaying;
        UI.updatePlayPauseIcons(!wasPlaying);
        const eq = document.getElementById('np-equalizer');
        if (eq) eq.classList.toggle('paused', wasPlaying);
        if (!wasPlaying) startProgressTimer();
        else stopProgressTimer();
        if (UI.isRhythmScreenOpen && UI.isRhythmScreenOpen()) {
          UI.updateRhythmPlayback(state.nowPlaying);
        }
        return;
      }

      await SpotifyAPI.togglePlayPause(wasPlaying);
      state.nowPlaying.isPlaying = !wasPlaying;
      UI.updatePlayPauseIcons(!wasPlaying);

      const eq = document.getElementById('np-equalizer');
      if (eq) {
        eq.classList.toggle('paused', wasPlaying);
      }

      if (UI.isRhythmScreenOpen && UI.isRhythmScreenOpen()) {
        UI.updateRhythmPlayback(state.nowPlaying);
      }

      if (!wasPlaying) {
        startProgressTimer();
      } else {
        stopProgressTimer();
      }
    } catch (err) {
      UI.showToast('Oynatma kontrolü başarısız: ' + err.message, 'error');
    }
  }

  async function handleNext() {
    if (state.isDemo && !SpotifyAuth.isLoggedIn()) {
      if (state.liveQueue && state.liveQueue.length > 0) {
        const next = state.liveQueue.shift();
        state.nowPlaying = {
          track: next,
          isPlaying: true,
          progressMs: 0,
          durationMs: next.duration,
        };
        UI.renderNowPlaying(state.nowPlaying);
        UI.renderLiveQueue(state.liveQueue, next);
        UI.showToast(`Şimdi çalıyor: ${next.name}`, 'info');
        loadLyricsForTrack(next);
        if (UI.isRhythmScreenOpen && UI.isRhythmScreenOpen()) {
          UI.updateRhythmTrack(next);
          UI.updateRhythmPlayback(state.nowPlaying);
        }
      } else {
        UI.showToast('Kuyrukta başka şarkı yok', 'info');
      }
      return;
    }

    try {
      await SpotifyAPI.nextTrack();
      UI.showToast('Sonraki şarkıya geçildi', 'success');
      // Wait a moment for Spotify to update, then refresh
      setTimeout(() => fetchLiveQueue(), 500);
    } catch (err) {
      UI.showToast('Sonraki şarkıya geçilemedi', 'error');
    }
  }

  async function handlePrevious() {
    if (state.isDemo && !SpotifyAuth.isLoggedIn()) {
      if (state.nowPlaying) {
        state.nowPlaying.progressMs = 0;
        UI.updatePlaybackProgress(0, state.nowPlaying.durationMs);
        UI.showToast('Şarkı başına dönüldü', 'info');
      }
      return;
    }

    try {
      await SpotifyAPI.previousTrack();
      UI.showToast('Önceki şarkıya dönüldü', 'success');
      setTimeout(() => fetchLiveQueue(), 500);
    } catch (err) {
      UI.showToast('Önceki şarkıya dönülemedi', 'error');
    }
  }

  /**
   * Directly play a track on Spotify (or in demo mode) when triggered from queue or card.
   * @param {Object} track
   * @param {HTMLElement} [btn]
   */
  async function handlePlayTrack(track, btn) {
    if (!track) return;

    if (SpotifyAuth.isLoggedIn()) {
      const uri = track.uri || (track.id ? `spotify:track:${track.id}` : null);
      if (!uri) {
        UI.showToast('Bu şarkının Spotify URI bağlantısı bulunamadı', 'warning');
        return;
      }

      if (btn) {
        btn.classList.add('playing');
        btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>';
      }

      try {
        UI.showToast(`▶ ${track.name} çalınıyor...`, 'info', 2000);
        await SpotifyAPI.playTrack(uri);

        // Optimistic UI updates
        state.nowPlaying = {
          track: track,
          isPlaying: true,
          progressMs: 0,
          durationMs: track.duration || 0,
        };
        UI.renderNowPlaying(state.nowPlaying);
        UI.updatePlayPauseIcons(true);
        loadLyricsForTrack(track);
        if (UI.isRhythmScreenOpen && UI.isRhythmScreenOpen()) {
          UI.updateRhythmTrack(track);
          UI.updateRhythmPlayback(state.nowPlaying);
        }

        // Spotify oynatıcısının yeni şarkıyı tescil etmesi için kısa poll
        setTimeout(async () => {
          await fetchLiveQueue();
          if (btn) {
            btn.classList.remove('playing');
            btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
          }
        }, 1000);
      } catch (err) {
        if (btn) {
          btn.classList.remove('playing');
          btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
        }
        console.error('handlePlayTrack error:', err);
        UI.showToast('Şarkı başlatılamadı: ' + err.message, 'error');
      }
      return;
    }

    // Demo modu
    if (state.isDemo) {
      state.nowPlaying = {
        track: track,
        isPlaying: true,
        progressMs: 0,
        durationMs: track.duration || 0,
      };
      UI.renderNowPlaying(state.nowPlaying);
      UI.updatePlayPauseIcons(true);
      UI.showToast(`Şimdi çalıyor: ${track.name}`, 'info');
      loadLyricsForTrack(track);
      if (UI.isRhythmScreenOpen && UI.isRhythmScreenOpen()) {
        UI.updateRhythmTrack(track);
        UI.updateRhythmPlayback(state.nowPlaying);
      }
      return;
    }

    UI.showToast('Şarkıyı dinlemek için Spotify ile giriş yapın.', 'info', 3000);
  }

  async function handleSeek(e) {
    if (!state.nowPlaying) return;
    const container = document.getElementById('np-progress-container');
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percent = Math.max(0, Math.min(clickX / rect.width, 1));
    const seekMs = percent * state.nowPlaying.durationMs;

    if (state.isDemo && !SpotifyAuth.isLoggedIn()) {
      state.nowPlaying.progressMs = seekMs;
      UI.updatePlaybackProgress(seekMs, state.nowPlaying.durationMs);
      return;
    }

    try {
      await SpotifyAPI.seekTo(seekMs);
      state.nowPlaying.progressMs = seekMs;
      UI.updatePlaybackProgress(seekMs, state.nowPlaying.durationMs);
      if (UI.isLyricsOpen && UI.isLyricsOpen()) {
        UI.updateActiveLyric(seekMs);
      }
    } catch (err) {
      UI.showToast('Pozisyon değiştirilemedi', 'error');
    }
  }

  async function handleSeekMs(seekMs) {
    if (!state.nowPlaying) return;
    if (state.isDemo && !SpotifyAuth.isLoggedIn()) {
      state.nowPlaying.progressMs = seekMs;
      UI.updatePlaybackProgress(seekMs, state.nowPlaying.durationMs);
      if (UI.isLyricsOpen && UI.isLyricsOpen()) {
        UI.updateActiveLyric(seekMs);
      }
      return;
    }

    try {
      await SpotifyAPI.seekTo(seekMs);
      state.nowPlaying.progressMs = seekMs;
      UI.updatePlaybackProgress(seekMs, state.nowPlaying.durationMs);
      if (UI.isLyricsOpen && UI.isLyricsOpen()) {
        UI.updateActiveLyric(seekMs);
      }
    } catch (err) {
      console.warn('Seek error:', err);
    }
  }

  // ==========================================
  // Şarkı Sözleri (Lyrics Handlers)
  // ==========================================

  let activeLyricsFetchId = 0;

  async function handleLyricsClick() {
    if (UI.isLyricsOpen()) {
      UI.closeLyrics();
      if (state.currentTab !== 'live-queue-tab') stopQueueAutoRefresh();
      return;
    }

    const currentTrack = state.nowPlaying?.track;
    if (!currentTrack) {
      UI.showToast('Şu anda çalan bir şarkı bulunamadı', 'info');
      return;
    }

    // Open lyrics panel
    UI.openLyrics(currentTrack, state.currentLyrics, (seekMs) => {
      handleSeekMs(seekMs);
    });
    startQueueAutoRefresh();

    if (state.nowPlaying) {
      UI.updateActiveLyric(state.nowPlaying.progressMs);
    }

    // If lyrics not loaded for this track yet, load them now
    if (!state.currentLyrics || state.currentLyrics.trackName !== currentTrack.name) {
      await loadLyricsForTrack(currentTrack);
    }
  }

  async function loadLyricsForTrack(track) {
    if (!track || typeof LyricsEngine === 'undefined') return;
    const fetchId = ++activeLyricsFetchId;

    // Şarkı değiştiğinde panel açıksa anında başlığı, sanatçıyı, kapağı güncelle ve yükleniyor durumuna geçir
    if (UI.isLyricsOpen && UI.isLyricsOpen()) {
      UI.updateLyricsTrack(track, null);
    }

    try {
      const lyrics = await LyricsEngine.fetchLyrics(track.name, track.artist, track.duration);

      // Daha yeni bir şarkı gelmişse eski isteğin sonucunu yoksay (yarış durumunu engelle)
      if (fetchId !== activeLyricsFetchId) return;

      state.currentLyrics = {
        ...lyrics,
        trackName: track.name,
      };

      if (UI.isLyricsOpen && UI.isLyricsOpen()) {
        UI.updateLyricsTrack(track, state.currentLyrics);
        if (state.nowPlaying) {
          UI.updateActiveLyric(state.nowPlaying.progressMs);
        }
      }
    } catch (err) {
      console.warn('Load lyrics error:', err);
      if (fetchId === activeLyricsFetchId && UI.isLyricsOpen && UI.isLyricsOpen()) {
        UI.updateLyricsTrack(track, { synced: false, plainLyrics: '', notFound: true });
      }
    }
  }

  // ==========================================
  // Ritim Ekranı & Lav Lambası (Rhythm Handler)
  // ==========================================

  async function handleRhythmClick() {
    if (UI.isRhythmScreenOpen && UI.isRhythmScreenOpen()) {
      UI.closeRhythmScreen();
      return;
    }

    const currentTrack = state.nowPlaying?.track;
    if (!currentTrack) {
      UI.showToast('Şu anda çalan bir şarkı bulunamadı', 'info');
      return;
    }

    // Audio features ve cihaz ses seviyesini paralel olarak çek
    let audioFeatures = null;
    let volumePercent = 70;
    try {
      const trackId = currentTrack.id || currentTrack.uri?.split(':').pop();
      const [features, devices] = await Promise.all([
        trackId ? SpotifyAPI.getAudioFeatures(trackId) : Promise.resolve(null),
        SpotifyAPI.getDevices(),
      ]);
      audioFeatures = features;
      const activeDevice = devices?.find(d => d.isActive);
      if (activeDevice && typeof activeDevice.volume === 'number') {
        volumePercent = activeDevice.volume;
      }
    } catch (err) {
      console.warn('Rhythm features/volume fetch:', err);
    }

    UI.openRhythmScreen(currentTrack, state.nowPlaying, {
      onPlayPause: handlePlayPause,
      onNext: handleNext,
      onPrev: handlePrevious,
    }, audioFeatures, volumePercent);
    startQueueAutoRefresh();
  }

  // ==========================================
  // Hızlı Keşif & Ruh Hali (Vibe Handler)
  // ==========================================

  async function handleVibeChip(vibe) {
    const textarea = document.getElementById('song-input');
    if (!textarea) return;

    if (vibe === 'top') {
      UI.showToast('🔥 En çok dinledikleriniz taranıyor...', 'info', 2000);
      let tracks = [];
      if (state.isDemo && !SpotifyAuth.isLoggedIn()) {
        tracks = [
          { name: 'Dan Dan', artist: 'Gülşen' },
          { name: 'Aşkın Olayım', artist: 'Simge' },
          { name: 'Antidepresan', artist: 'Mabel Matiz' },
          { name: 'Kuzu Kuzu', artist: 'Tarkan' },
        ];
      } else {
        try {
          const top = await SpotifyAPI.getTopTracks('short_term', 5);
          tracks = top.length > 0 ? top : [
            { name: 'Dan Dan', artist: 'Gülşen' },
            { name: 'Aşkın Olayım', artist: 'Simge' },
          ];
        } catch (e) {
          tracks = [{ name: 'Dan Dan', artist: 'Gülşen' }];
        }
      }
      textarea.value = tracks.map(t => `${t.name} - ${t.artist}`).join(' → ');
    } else if (vibe === 'party') {
      textarea.value = 'Dan Dan - Gülşen → Bangır Bangır - Gülşen → Şımarık - Tarkan → Dua Lipa - Levitating → The Weeknd - Blinding Lights';
    } else if (vibe === 'chill') {
      textarea.value = 'Yurtta Aşk Cihanda Aşk - Gülşen → Kalbime Gömerim O Zaman - Gökhan Özen → Duman - Koyu Antoloji → Coldplay - Yellow';
    } else if (vibe === 'night') {
      textarea.value = 'Gecekondu - Ezhel → Antidepresan - Mabel Matiz → Kavşak - Can Bonomo → Mor ve Ötesi - Bir Derdim Var';
    } else if (vibe === 'lofi') {
      textarea.value = 'Lofi Beats - Chillhop Music → Coffee Shop Study - Lo-Fi Beats → Rain in Tokyo - Lofi Fruits';
    }

    textarea.focus();
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 300) + 'px';
    UI.showToast('✨ Liste hazırlandı! "Şarkıları bul" butonuna tıklayarak aratabilirsiniz.', 'success', 3000);
  }

  // ==========================================
  // İkincil Oynatıcı Kontrolleri (Shuffle, Repeat, Ses, Uyku)
  // ==========================================

  async function handleShuffleToggle() {
    state.isShuffle = !state.isShuffle;
    const btn = document.getElementById('ctrl-shuffle');
    if (btn) {
      btn.classList.toggle('active', state.isShuffle);
      btn.setAttribute('aria-pressed', String(state.isShuffle));
    }
    if (state.isDemo && !SpotifyAuth.isLoggedIn()) {
      UI.showToast(state.isShuffle ? '🔀 Karışık çalma açık' : '➡️ Düz çalma açık', 'info');
      return;
    }
    try {
      await SpotifyAPI.toggleShuffle(state.isShuffle);
      UI.showToast(state.isShuffle ? '🔀 Karışık çalma açık' : '➡️ Düz çalma açık', 'info');
    } catch (err) {
      UI.showToast('Karışık çalma ayarlanamadı: ' + err.message, 'warning');
    }
  }

  async function handleRepeatToggle() {
    const modes = ['off', 'context', 'track'];
    const currentIdx = modes.indexOf(state.repeatMode);
    state.repeatMode = modes[(currentIdx + 1) % modes.length];

    const btn = document.getElementById('ctrl-repeat');
    if (btn) {
      const isActive = state.repeatMode !== 'off';
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-pressed', String(isActive));
      btn.title = state.repeatMode === 'track' ? 'Tekrar: Tek Şarkı' : (state.repeatMode === 'context' ? 'Tekrar: Tüm Liste' : 'Tekrar: Kapalı');
    }

    const modeLabels = { off: 'Tekrar kapalı', context: '🔁 Tüm liste tekrarlanıyor', track: '🔂 Tek şarkı tekrarlanıyor' };
    if (state.isDemo && !SpotifyAuth.isLoggedIn()) {
      UI.showToast(modeLabels[state.repeatMode], 'info');
      return;
    }
    try {
      await SpotifyAPI.toggleRepeat(state.repeatMode);
      UI.showToast(modeLabels[state.repeatMode], 'info');
    } catch (err) {
      UI.showToast('Tekrarlama ayarlanamadı: ' + err.message, 'warning');
    }
  }

  let volumeDebounce = null;
  function handleVolumeChange(val) {
    state.currentVolume = val;
    const label = document.getElementById('np-volume-label');
    if (label) label.textContent = `${val}%`;

    clearTimeout(volumeDebounce);
    volumeDebounce = setTimeout(async () => {
      if (state.isDemo && !SpotifyAuth.isLoggedIn()) return;
      try {
        await SpotifyAPI.setVolume(val);
      } catch (err) {
        console.warn('Volume adjust error:', err);
      }
    }, 150);
  }

  function handleSleepTimerModalClick() {
    let remainingMinutes = 0;
    if (state.sleepTimerEnd) {
      remainingMinutes = Math.max(0, Math.ceil((state.sleepTimerEnd - Date.now()) / 60000));
    }
    UI.showSleepTimerModal(remainingMinutes, (selectedMinutes) => {
      if (selectedMinutes <= 0) {
        if (state.sleepTimerInterval) {
          clearInterval(state.sleepTimerInterval);
          state.sleepTimerInterval = null;
        }
        state.sleepTimerEnd = null;
        const badge = document.getElementById('sleep-timer-badge');
        if (badge) badge.style.display = 'none';
        const btn = document.getElementById('ctrl-sleep-timer');
        if (btn) btn.classList.remove('active');
        UI.showToast('Uyku zamanlayıcısı iptal edildi', 'info');
        return;
      }

      state.sleepTimerEnd = Date.now() + selectedMinutes * 60000;
      const btn = document.getElementById('ctrl-sleep-timer');
      if (btn) btn.classList.add('active');

      updateSleepTimerBadge();
      if (state.sleepTimerInterval) clearInterval(state.sleepTimerInterval);
      state.sleepTimerInterval = setInterval(updateSleepTimerBadge, 10000);

      UI.showToast(`⏱️ Uyku zamanlayıcısı: ${selectedMinutes} dakika sonra duracak`, 'success', 3500);
    });
  }

  function updateSleepTimerBadge() {
    const badge = document.getElementById('sleep-timer-badge');
    if (!state.sleepTimerEnd) {
      if (badge) badge.style.display = 'none';
      return;
    }
    const remainingMs = state.sleepTimerEnd - Date.now();
    if (remainingMs <= 0) {
      if (state.sleepTimerInterval) clearInterval(state.sleepTimerInterval);
      state.sleepTimerInterval = null;
      state.sleepTimerEnd = null;
      if (badge) badge.style.display = 'none';
      const btn = document.getElementById('ctrl-sleep-timer');
      if (btn) btn.classList.remove('active');

      if (state.nowPlaying && state.nowPlaying.isPlaying) {
        handlePlayPause();
      }
      UI.showToast('💤 Uyku zamanlayıcısı doldu: Müzik durduruldu. İyi dinlenmeler!', 'info', 6000);
      return;
    }

    const mins = Math.ceil(remainingMs / 60000);
    if (badge) {
      badge.textContent = `${mins}d`;
      badge.style.display = 'block';
    }
  }

  // ==========================================
  // Kuyruk Stüdyosu (Playlist, Smart Flow, Shuffle, Deduplicate)
  // ==========================================

  async function handleSavePlaylistClick() {
    const tracks = [];
    if (state.nowPlaying?.track) tracks.push(state.nowPlaying.track);
    if (state.liveQueue && state.liveQueue.length > 0) {
      tracks.push(...state.liveQueue);
    }

    if (tracks.length === 0) {
      UI.showToast('Kaydedilecek şarkı yok! Önce kuyruğu doldurun.', 'warning');
      return;
    }

    const defaultName = `QueueSpotify Mix (${new Date().toLocaleDateString('tr-TR')})`;
    UI.showSavePlaylistModal(defaultName, tracks.length, async (playlistName) => {
      const uris = tracks.map(t => t.uri || (t.id ? `spotify:track:${t.id}` : null)).filter(Boolean);
      if (uris.length === 0) {
        UI.showToast('Geçerli Spotify şarkı bağlantısı bulunamadı', 'error');
        return;
      }

      if (state.isDemo && !SpotifyAuth.isLoggedIn()) {
        UI.confetti();
        UI.showToast(`🎉 "${playlistName}" başarıyla kaydedildi! (Demo Modu)`, 'success', 4500);
        return;
      }

      try {
        UI.showToast('Çalma listesi oluşturuluyor...', 'info', 2000);
        const res = await SpotifyAPI.saveQueueAsPlaylist(playlistName, uris);
        UI.confetti();
        UI.showToast(`🎉 "${res.name}" Spotify kütüphanenize kaydedildi!`, 'success', 5000);
      } catch (err) {
        UI.showToast('Çalma listesi kaydedilemedi: ' + err.message, 'error', 5000);
      }
    });
  }

  async function handleSmartFlowClick() {
    // Canlı ritim / ses analizöründen anlık ölçülen BPM'i al
    const liveState = (typeof UI !== 'undefined' && typeof UI.getLiveRhythmState === 'function')
      ? UI.getLiveRhythmState()
      : null;
    const activeLiveBpm = (liveState && liveState.isLiveActive && liveState.bpm) ? liveState.bpm : null;
    const activeLiveConf = liveState ? liveState.confidence : 0;

    if (activeLiveBpm && typeof MLRecommender !== 'undefined') {
      MLRecommender.setLiveBpm(activeLiveBpm, activeLiveConf, 'live_audio', state.nowPlaying?.track?.id);
    }

    const queueAnalysis = (typeof MLRecommender !== 'undefined')
      ? MLRecommender.analyzeQueue(state.liveQueue, state.nowPlaying?.track, {
          liveBpm: activeLiveBpm,
          liveConfidence: activeLiveConf,
        })
      : null;

    UI.showSmartFlowModal(queueAnalysis, async (vibe) => {
      UI.showToast('🤖 ML modeli kuyruk dinamiklerini ve akustik vektörleri analiz ediyor...', 'info', 2200);

      const seedIds = [];
      if (state.nowPlaying?.track?.id) seedIds.push(state.nowPlaying.track.id);
      if (state.liveQueue && state.liveQueue.length > 0) {
        state.liveQueue.forEach(t => { if (t.id && seedIds.length < 5) seedIds.push(t.id); });
      }

      const vibeOptions = { limit: 10 };
      if (vibe === 'party') {
        vibeOptions.target_energy = 0.90;
        vibeOptions.target_danceability = 0.85;
      } else if (vibe === 'chill') {
        vibeOptions.target_energy = 0.35;
        vibeOptions.target_valence = 0.40;
      } else if (vibe === 'discovery') {
        vibeOptions.target_energy = 0.65;
      }

      let recommendations = [];

      // 1. Çevrimiçi ve Spotify bağlantısı varsa: Adayları çek ve ML modeliyle yeniden puanla (Rerank)
      if (!state.isDemo && SpotifyAuth.isLoggedIn()) {
        try {
          const rawCandidates = await SpotifyAPI.getRecommendations(seedIds, vibeOptions);
          if (rawCandidates && rawCandidates.length > 0 && typeof MLRecommender !== 'undefined') {
            recommendations = MLRecommender.rerankSpotifyCandidates(
              rawCandidates,
              { queue: state.liveQueue, nowPlaying: state.nowPlaying?.track, liveBpm: activeLiveBpm },
              vibe,
              5,
              { liveBpm: activeLiveBpm }
            );
          } else {
            recommendations = rawCandidates ? rawCandidates.slice(0, 5) : [];
          }
        } catch (err) {
          console.warn('Spotify recommendations API fallback to ML engine:', err);
        }
      }

      // 2. Spotify API sonuç vermediyse veya demo/çevrimdışı moddaysa:
      // Kendi zengin latent korpusumuz üzerinden doğrudan kenar ML çıkarımı (Edge ML Inference)
      if (recommendations.length === 0 && typeof MLRecommender !== 'undefined') {
        await new Promise(r => setTimeout(r, 400));
        recommendations = MLRecommender.recommendTracks({
          queue: state.liveQueue,
          nowPlaying: state.nowPlaying?.track,
          vibe,
          limit: 5,
          liveBpm: activeLiveBpm,
        });
      }

      if (recommendations.length === 0) {
        UI.showToast('Şu an uygun öneri bulunamadı. Kuyruğa daha fazla şarkı ekleyin.', 'warning');
        return;
      }

      // Ortalama ML güven skoru
      const avgConf = Math.round(
        recommendations.reduce((sum, r) => sum + (r.matchConfidence || 92), 0) / recommendations.length
      );

      // Kuyruğa ekle
      if (state.isDemo || !SpotifyAuth.isLoggedIn()) {
        recommendations.forEach(r => state.liveQueue.push(r));
        UI.renderLiveQueue(state.liveQueue, state.nowPlaying?.track);
        UI.showToast(`✨ ${recommendations.length} şarkı ML Akış Motoruyla (%${avgConf} uyum) kuyruğa eklendi!`, 'success', 3500);
      } else {
        const uris = recommendations.map(r => r.uri).filter(Boolean);
        const res = await SpotifyAPI.addMultipleToQueue(uris);
        if (res.success > 0) {
          UI.showToast(`✨ ${res.success} şarkı ML Akış Motoruyla (%${avgConf} uyum) kuyruğa eklendi!`, 'success', 3500);
          setTimeout(fetchLiveQueue, 600);
        } else {
          UI.showToast('Önerilen şarkılar kuyruğa eklenemedi', 'error');
        }
      }
    });
  }

  /**
   * Toplu ekle sekmesinde yazılan şarkıları ML ile analiz edip
   * listeyi otomatik devam ettiren asistan.
   */
  async function handleMlCompleteBuilderClick() {
    const textarea = document.getElementById('song-input');
    if (!textarea) return;

    const currentText = textarea.value.trim();
    UI.showToast('🤖 ML modeli listenin akustik profilini çıkarıyor...', 'info', 2000);

    let predictions = [];
    if (typeof MLRecommender !== 'undefined') {
      predictions = MLRecommender.predictNextFromDraft(currentText, 'similar', 3);
    }

    if (!predictions || predictions.length === 0) {
      UI.showToast('Tahmin üretilemedi, lütfen kutucuğa bir şarkı adı yazın', 'warning');
      return;
    }

    const newSnippet = predictions.map(p => `${p.name} - ${p.artist}`).join(' → ');
    if (currentText.length > 0) {
      const hasArrow = currentText.endsWith('→') || currentText.endsWith('-');
      textarea.value = hasArrow ? `${currentText} ${newSnippet}` : `${currentText} → ${newSnippet}`;
    } else {
      textarea.value = newSnippet;
    }

    textarea.focus();
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 300) + 'px';

    UI.confetti();
    const songNames = predictions.map(p => p.name).join(', ');
    UI.showToast(`🪄 ML Modeli ${predictions.length} uyumlu şarkı ekledi: ${songNames}`, 'success', 4500);
  }

  function handleSmartShuffleClick() {
    if (!state.liveQueue || state.liveQueue.length <= 1) {
      UI.showToast('Akıllı karıştırma için kuyrukta en az 2 şarkı olmalı', 'info');
      return;
    }

    const items = [...state.liveQueue];
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }

    // Anti-consecutive artist separation pass
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

    state.liveQueue = items;
    UI.renderLiveQueue(state.liveQueue, state.nowPlaying?.track);
    UI.showToast('🔀 Kuyruk akıllıca karıştırıldı (aynı sanatçılar ayrıldı)', 'success');
  }

  function handleDeduplicateClick() {
    if (!state.liveQueue || state.liveQueue.length <= 1) {
      UI.showToast('Kuyrukta kontrol edilecek kadar şarkı yok', 'info');
      return;
    }

    const seen = new Set();
    const uniqueQueue = [];
    let dupCount = 0;

    state.liveQueue.forEach(track => {
      const key = (track.id || track.uri || `${track.name}-${track.artist}`).toLowerCase().trim();
      if (seen.has(key)) {
        dupCount++;
      } else {
        seen.add(key);
        uniqueQueue.push(track);
      }
    });

    if (dupCount === 0) {
      UI.showToast('✓ Harika! Kuyrukta yinelenen şarkı bulunamadı.', 'info');
      return;
    }

    state.liveQueue = uniqueQueue;
    UI.renderLiveQueue(state.liveQueue, state.nowPlaying?.track);
    UI.showToast(`🧹 ${dupCount} adet mükerrer şarkı kuyruktan temizlendi!`, 'success');
  }

  // ==========================================
  // Login & Profile
  // ==========================================

  /**
   * Called when user is logged in.
   */
  async function onLoggedIn() {
    try {
      // Fetch user profile
      const profile = await SpotifyAPI.getUserProfile();
      state.userProfile = profile;
      SpotifyAuth.saveUserProfile(profile);

      // Update UI with profile info
      updateProfileUI(profile);

      // Check for active device
      const playback = await SpotifyAPI.getPlaybackState();
      state.playbackState = playback;
      updateDeviceUI(playback);

      // Show builder screen
      UI.showScreen('builder-screen');

      // Also fetch live queue data in background for mini player
      fetchLiveQueue();
    } catch (err) {
      console.error('Login check failed:', err);
      if (err.message.includes('tekrar giriş') || err.message.includes('Token')) {
        SpotifyAuth.logout();
        showLoginScreen();
      } else {
        UI.showToast(err.message, 'error');
        UI.showScreen('builder-screen');
      }
    }
  }

  /**
   * Show login screen.
   */
  function showLoginScreen() {
    UI.showScreen('login-screen');
    const savedClientId = SpotifyAuth.getClientId();
    if (savedClientId) {
      goToLoginStep(2);
    } else {
      goToLoginStep(1);
    }
  }

  /**
   * Navigate between steps in login screen.
   */
  function goToLoginStep(step) {
    const step1Panel = document.getElementById('step-client-id');
    const step2Panel = document.getElementById('step-spotify-login');
    const stepEls = document.querySelectorAll('.login-step');
    const stepLine = document.querySelector('.login-step-line');

    if (step === 1) {
      UI.setHidden(step1Panel, false, 'block');
      UI.setHidden(step2Panel, true);
      if (stepLine) stepLine.classList.remove('filled');
      stepEls.forEach(el => {
        const s = parseInt(el.dataset.step);
        el.classList.toggle('active', s === 1);
        el.classList.remove('done');
      });
    } else if (step === 2) {
      UI.setHidden(step1Panel, true);
      UI.setHidden(step2Panel, false, 'block');
      if (stepLine) stepLine.classList.add('filled');
      stepEls.forEach(el => {
        const s = parseInt(el.dataset.step);
        el.classList.toggle('active', s === 2);
        el.classList.toggle('done', s === 1);
      });
    }
  }

  /**
   * Update profile info in the topbar.
   */
  function updateProfileUI(profile) {
    // Avatar
    const avatars = document.querySelectorAll('.topbar-avatar img');
    avatars.forEach(img => {
      if (profile.image) {
        img.src = profile.image;
        img.alt = profile.name;
      }
    });

    // Name (if displayed)
    const nameEls = document.querySelectorAll('.user-name');
    nameEls.forEach(el => {
      el.textContent = profile.name || profile.id;
    });

    // Premium check
    if (profile.product !== 'premium') {
      // Kalıcı şerit: toast 6 saniyede kaybolur, bu kısıt kaybolmaz.
      if (UI.setPremiumWarning) UI.setPremiumWarning(true);
      UI.showToast('Spotify Premium gerekli — kuyruğa ekleme Premium hesap ister.', 'warning', 6000);
    } else if (UI.setPremiumWarning) {
      UI.setPremiumWarning(false);
    }
  }

  /**
   * Update device status indicator.
   */
  function updateDeviceUI(playback) {
    const deviceEl = document.getElementById('device-indicator');
    const warningEl = document.getElementById('device-warning');

    if (playback?.device) {
      if (deviceEl) {
        UI.setHidden(deviceEl, false, 'flex');
        deviceEl.innerHTML = `<span class="dot"></span>${UI.escapeHtml(playback.device.name)}`;
      }
      UI.setHidden(warningEl, true);
    } else {
      UI.setHidden(deviceEl, true);
      UI.setHidden(warningEl, false, 'flex');
    }
  }

  // ==========================================
  // Search & Preview
  // ==========================================

  /**
   * Handle the search/find action.
   */
  async function handleSearch() {
    const textarea = document.getElementById('song-input');
    const inputText = textarea?.value?.trim();

    if (!inputText) {
      UI.showToast('Lütfen şarkı listesi girin', 'warning');
      return;
    }

    // Parse input
    const parsed = Parser.parse(inputText);
    const { valid, warnings } = Parser.validate(parsed);

    if (valid.length === 0) {
      UI.showToast('Hiçbir şarkı ayrıştırılamadı. Formatı kontrol edin.', 'error');
      return;
    }

    state.parsedItems = valid;
    state.isSearching = true;

    // Show warnings
    warnings.forEach(w => {
      UI.showToast(w.message, 'warning');
    });

    // Switch to preview screen
    UI.showScreen('preview-screen');

    // Show shimmer loading
    const trackList = document.getElementById('track-list');
    UI.showShimmerLoading('track-list', valid.length);

    // Update header
    const previewCount = document.getElementById('preview-count');
    if (previewCount) previewCount.textContent = `${valid.length} şarkı`;

    // Search each track
    const results = [];
    for (let i = 0; i < valid.length; i++) {
      if (state.isDemo && !SpotifyAuth.isLoggedIn()) {
        await new Promise(r => setTimeout(r, 150));
        const mockDuration = 195000 + ((i * 17000) % 50000);
        results.push({
          best: {
            id: 'demo_' + i,
            uri: 'spotify:track:demo_' + i,
            name: valid[i].track,
            artist: valid[i].artist || 'Gülşen',
            album: 'QueueSpotify Seçkisi',
            albumImage: 'assets/logo.jpg',
            albumImageSmall: 'assets/logo.jpg',
            duration: mockDuration,
            popularity: 92,
          },
          alternatives: [
            {
              id: 'demo_alt_' + i,
              uri: 'spotify:track:demo_alt_' + i,
              name: valid[i].track + ' (Remix)',
              artist: valid[i].artist || 'Gülşen',
              album: 'Remixes',
              albumImage: 'assets/logo.jpg',
              albumImageSmall: 'assets/logo.jpg',
              duration: mockDuration - 15000,
              popularity: 75,
            }
          ],
          confidence: 'high',
          raw: valid[i].raw,
          requestedTrack: valid[i].track,
          requestedArtist: valid[i].artist,
        });
        continue;
      }

      try {
        const result = await SpotifyAPI.searchTrack(valid[i].track, valid[i].artist, valid[i].spotifyId);
        results.push({
          ...result,
          raw: valid[i].raw,
          requestedTrack: valid[i].track,
          requestedArtist: valid[i].artist,
        });
      } catch (err) {
        console.error(`Search error for "${valid[i].raw}":`, err);
        results.push({
          best: null,
          alternatives: [],
          confidence: 'none',
          raw: valid[i].raw,
          requestedTrack: valid[i].track,
          requestedArtist: valid[i].artist,
        });
      }
    }

    state.searchResults = results;
    state.isSearching = false;

    // Render results
    renderSearchResults();

    // Refresh device status
    const playback = await SpotifyAPI.getPlaybackState();
    state.playbackState = playback;
    updateDeviceUI(playback);
  }

  /**
   * Render search results as track cards.
   */
  function renderSearchResults() {
    const trackList = document.getElementById('track-list');
    if (!trackList) return;

    trackList.innerHTML = '';
    trackList.className = 'track-list stagger-children';

    let totalDuration = 0;
    let foundCount = 0;

    state.searchResults.forEach((result, index) => {
      const card = UI.createTrackCard(result.best, index, {
        confidence: result.confidence,
        alternatives: result.alternatives,
        raw: result.raw,
        showChange: true,
        onChangeClick: handleChangeTrack,
      });
      trackList.appendChild(card);

      if (result.best) {
        totalDuration += result.best.duration;
        foundCount++;
      }
    });

    // Update summary
    const summaryTracks = document.getElementById('summary-tracks');
    const summaryDuration = document.getElementById('summary-duration');
    const summaryFound = document.getElementById('summary-found');

    if (summaryTracks) summaryTracks.textContent = state.searchResults.length;
    if (summaryDuration) summaryDuration.textContent = SpotifyAPI.formatTotalDuration(totalDuration);
    if (summaryFound) summaryFound.textContent = `${foundCount}/${state.searchResults.length}`;

    // Update queue button
    const queueBtn = document.getElementById('add-to-queue-btn');
    if (queueBtn) {
      queueBtn.disabled = foundCount === 0;
      queueBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 5v14M5 12h14"/>
        </svg>
        Kuyruğa Ekle (${foundCount} şarkı)
      `;
    }
  }

  /**
   * Handle track change (select alternative).
   */
  function handleChangeTrack(trackIndex, alternatives) {
    UI.showAlternativesModal(trackIndex, alternatives, (index, selected) => {
      // Replace the track in results
      if (state.searchResults[index]) {
        const old = state.searchResults[index];
        state.searchResults[index] = {
          ...old,
          best: selected,
          confidence: 'high',
        };
        renderSearchResults();
        UI.showToast('Şarkı değiştirildi', 'success');
      }
    });
  }

  /**
   * Handle adding tracks to queue.
   */
  async function handleAddToQueue() {
    if (state.isAddingToQueue) return;

    const tracksToAdd = state.searchResults
      .filter(r => r.best && r.confidence !== 'none')
      .map(r => r.best);

    if (tracksToAdd.length === 0) {
      UI.showToast('Eklenecek şarkı bulunamadı', 'error');
      return;
    }

    if (state.isDemo && !SpotifyAuth.isLoggedIn()) {
      state.isAddingToQueue = true;
      const queueBtn = document.getElementById('add-to-queue-btn');
      if (queueBtn) {
        queueBtn.disabled = true;
        queueBtn.innerHTML = '<div class="btn-spinner"></div> Ekleniyor...';
      }
      const progressContainer = document.getElementById('queue-progress');
      UI.setHidden(progressContainer, false, 'block');

      for (let i = 0; i < tracksToAdd.length; i++) {
        await new Promise(r => setTimeout(r, 350));
        UI.updateProgress(i + 1, tracksToAdd.length);
        UI.markCardSuccess(i);
        state.liveQueue.push(tracksToAdd[i]);
      }
      state.isAddingToQueue = false;
      setTimeout(() => {
        showSuccessScreen({ success: tracksToAdd.length, failed: 0 }, tracksToAdd);
        UI.renderLiveQueue(state.liveQueue, state.nowPlaying?.track);
      }, 500);
      return;
    }

    // Check for active device
    const playback = await SpotifyAPI.getPlaybackState();
    if (!playback?.device) {
      UI.showToast('Aktif Spotify cihazı bulunamadı! Önce telefonunuzda veya bilgisayarınızda Spotify\'ı açın.', 'error', 5000);
      return;
    }

    state.isAddingToQueue = true;

    // Update button state
    const queueBtn = document.getElementById('add-to-queue-btn');
    if (queueBtn) {
      queueBtn.disabled = true;
      queueBtn.innerHTML = '<div class="btn-spinner"></div> Ekleniyor...';
    }

    // Show progress bar
    const progressContainer = document.getElementById('queue-progress');
    UI.setHidden(progressContainer, false, 'block');

    // Map the search results indexes for matching
    const indexMap = [];
    state.searchResults.forEach((r, i) => {
      if (r.best && r.confidence !== 'none') {
        indexMap.push(i);
      }
    });

    const uris = tracksToAdd.map(t => t.uri);

    const result = await SpotifyAPI.addMultipleToQueue(uris, (i, total, status) => {
      UI.updateProgress(i + 1, total);
      const realIndex = indexMap[i];
      if (status === 'success') {
        UI.markCardSuccess(realIndex);
      } else {
        UI.markCardError(realIndex);
      }
    });

    state.isAddingToQueue = false;

    if (result.success > 0) {
      if (result.aborted && result.abortReason) {
        UI.showToast(result.abortReason, 'warning', 6000);
      }
      // Show success screen
      setTimeout(() => {
        showSuccessScreen(result, tracksToAdd);
      }, 500);
    } else {
      // Gerçek sebebi göster. Genel bir mesaj, "Unexpected end of JSON input"
      // gibi bir hatayı aylarca saklayabiliyor — bir kez sakladı da.
      const ilkHata = (result.errors && result.errors[0] && result.errors[0].error) || '';
      UI.showToast(
        result.abortReason || ilkHata || 'Şarkılar kuyruğa eklenemedi. Spotify aktif mi kontrol edin.',
        'error',
        6000
      );
      if (ilkHata) console.error('Kuyruğa ekleme hataları:', result.errors);
      if (queueBtn) {
        queueBtn.disabled = false;
        queueBtn.innerHTML = `
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          Tekrar Dene
        `;
      }
    }
  }

  /**
   * Show the success screen.
   */
  function showSuccessScreen(result, tracks) {
    const totalDuration = tracks.reduce((sum, t) => sum + t.duration, 0);

    // Update success stats
    const successCount = document.getElementById('success-count');
    const successDuration = document.getElementById('success-duration');
    if (successCount) successCount.textContent = result.success;
    if (successDuration) successDuration.textContent = SpotifyAPI.formatTotalDuration(totalDuration);

    UI.showScreen('success-screen');
    UI.confetti();

    // Refresh live queue in background
    fetchLiveQueue();
  }

  // Expose init
  return { init };
})();

// Start the app when DOM is ready
document.addEventListener('DOMContentLoaded', App.init);
