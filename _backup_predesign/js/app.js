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
  };

  /**
   * Initialize the application.
   */
  async function init() {
    console.log('🎵 QueueDrop initializing...');

    // Register Service Worker
    registerServiceWorker();

    // Check for OAuth callback
    try {
      const wasCallback = await SpotifyAuth.handleCallback();
      if (wasCallback) {
        console.log('✅ OAuth callback processed');
      }
    } catch (err) {
      console.error('OAuth callback error:', err);
      UI.showToast(err.message, 'error');
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
    UI.showToast('✨ Demo modu aktif! Tüm özellikleri deneyebilirsiniz.', 'success', 3500);
  }

  /**
   * Setup all event listeners.
   */
  function setupEventListeners() {
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
    // Tab switching
    // ==========================================
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tabId = btn.dataset.tab;
        switchTab(tabId);
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
  }

  // ==========================================
  // Tab Switching
  // ==========================================

  function switchTab(tabId) {
    state.currentTab = tabId;

    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    // Update tab panels
    document.querySelectorAll('.tab-panel').forEach(panel => {
      panel.classList.toggle('active', panel.id === tabId);
    });

    // When switching to live queue, fetch data
    if (tabId === 'live-queue-tab') {
      fetchLiveQueue();
      startQueueAutoRefresh();
    } else {
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

      // Update now playing
      state.nowPlaying = nowPlayingData;
      UI.renderNowPlaying(nowPlayingData);

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
   * Start a 1-second timer to smoothly update the progress bar.
   */
  function startProgressTimer() {
    stopProgressTimer();
    state.progressTimer = setInterval(() => {
      if (state.nowPlaying && state.nowPlaying.isPlaying) {
        state.nowPlaying.progressMs += 1000;
        if (state.nowPlaying.progressMs > state.nowPlaying.durationMs) {
          // Track likely ended, refresh
          state.nowPlaying.progressMs = state.nowPlaying.durationMs;
          fetchLiveQueue();
          return;
        }
        UI.updatePlaybackProgress(state.nowPlaying.progressMs, state.nowPlaying.durationMs);
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
   * Auto-refresh queue every 10 seconds when on live queue tab.
   */
  function startQueueAutoRefresh() {
    stopQueueAutoRefresh();
    state.queueRefreshTimer = setInterval(() => {
      if (state.currentTab === 'live-queue-tab') {
        fetchLiveQueue();
      }
    }, 10000);
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
        return;
      }

      await SpotifyAPI.togglePlayPause(wasPlaying);
      state.nowPlaying.isPlaying = !wasPlaying;
      UI.updatePlayPauseIcons(!wasPlaying);

      const eq = document.getElementById('np-equalizer');
      if (eq) {
        eq.classList.toggle('paused', wasPlaying);
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
    } catch (err) {
      UI.showToast('Pozisyon değiştirilemedi', 'error');
    }
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
      if (step1Panel) step1Panel.style.display = 'block';
      if (step2Panel) step2Panel.style.display = 'none';
      if (stepLine) stepLine.classList.remove('filled');
      stepEls.forEach(el => {
        const s = parseInt(el.dataset.step);
        el.classList.toggle('active', s === 1);
        el.classList.remove('done');
      });
    } else if (step === 2) {
      if (step1Panel) step1Panel.style.display = 'none';
      if (step2Panel) step2Panel.style.display = 'block';
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
      UI.showToast('⚠️ Spotify Premium gerekli! Kuyruğa şarkı eklemek için Premium hesap gerekiyor.', 'warning', 6000);
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
        deviceEl.style.display = 'flex';
        deviceEl.innerHTML = `<span class="dot"></span>${UI.escapeHtml(playback.device.name)}`;
      }
      if (warningEl) warningEl.style.display = 'none';
    } else {
      if (deviceEl) deviceEl.style.display = 'none';
      if (warningEl) warningEl.style.display = 'flex';
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
            album: 'QueueDrop Seçkisi',
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
        const result = await SpotifyAPI.searchTrack(valid[i].track, valid[i].artist);
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
      if (progressContainer) progressContainer.style.display = 'block';

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
    if (progressContainer) progressContainer.style.display = 'block';

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
      // Show success screen
      setTimeout(() => {
        showSuccessScreen(result, tracksToAdd);
      }, 500);
    } else {
      UI.showToast('Şarkılar kuyruğa eklenemedi. Spotify aktif mi kontrol edin.', 'error');
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
