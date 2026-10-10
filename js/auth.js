// ============================================
// QueueDrop — Spotify OAuth 2.0 + PKCE
// ============================================

const SpotifyAuth = (() => {
  const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize';
  const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
  const SCOPES = 'user-modify-playback-state user-read-playback-state user-read-currently-playing user-read-private playlist-modify-public playlist-modify-private user-top-read user-read-recently-played';

  // Storage keys
  const KEYS = {
    ACCESS_TOKEN: 'qd_access_token',
    REFRESH_TOKEN: 'qd_refresh_token',
    TOKEN_EXPIRY: 'qd_token_expiry',
    CODE_VERIFIER: 'qd_code_verifier',
    CLIENT_ID: 'qd_client_id',
    STATE: 'qd_auth_state',
    USER_PROFILE: 'qd_user_profile',
  };

  // --- PKCE Helpers ---

  function generateRandomString(length) {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    const values = crypto.getRandomValues(new Uint8Array(length));
    return Array.from(values, (x) => possible[x % possible.length]).join('');
  }

  async function generateCodeChallenge(codeVerifier) {
    const data = new TextEncoder().encode(codeVerifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  // --- Public API ---

  function isNative() {
    return !!(typeof window !== 'undefined' && window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform());
  }

  function getClientId() {
    return localStorage.getItem(KEYS.CLIENT_ID) || '';
  }

  function setClientId(id) {
    localStorage.setItem(KEYS.CLIENT_ID, id.trim());
  }

  function getRedirectUri() {
    if (isNative()) {
      return 'queuedrop://callback';
    }
    // Spotify redirect URI eşleşmesi birebirdir: "/" ile "/index.html"
    // ONUN için iki ayrı adrestir. Sunucu kökü index.html'e yönlendirdiğinde
    // ya da kullanıcı dosya adını elle yazdığında aynı uygulama iki farklı
    // URI üretir ve biri Dashboard'da kayıtlı olmadığı için akış patlar.
    // Dizin köküne normalize ederek ikisini tek adrese indiriyoruz.
    var path = window.location.pathname.replace(/\/index\.html?$/i, '/');
    if (path === '') path = '/';
    return window.location.origin + path;
  }

  function getAccessToken() {
    return localStorage.getItem(KEYS.ACCESS_TOKEN);
  }

  function isLoggedIn() {
    const token = getAccessToken();
    const expiry = localStorage.getItem(KEYS.TOKEN_EXPIRY);
    if (!token) return false;
    // If token is expired, we'll try to refresh
    if (expiry && Date.now() > parseInt(expiry)) {
      return !!localStorage.getItem(KEYS.REFRESH_TOKEN);
    }
    return true;
  }

  function isTokenExpired() {
    const expiry = localStorage.getItem(KEYS.TOKEN_EXPIRY);
    if (!expiry) return true;
    return Date.now() > parseInt(expiry);
  }

  async function login() {
    const clientId = getClientId();
    if (!clientId) {
      throw new Error('Client ID gerekli. Lütfen Spotify Developer Dashboard\'dan bir Client ID alın.');
    }

    const verifier = generateRandomString(64);
    localStorage.setItem(KEYS.CODE_VERIFIER, verifier);

    // CSRF koruması: dönüş adresindeki state, bizim ürettiğimizle eşleşmeli.
    const state = generateRandomString(32);
    localStorage.setItem(KEYS.STATE, state);

    const challenge = await generateCodeChallenge(verifier);

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      scope: SCOPES,
      code_challenge_method: 'S256',
      code_challenge: challenge,
      redirect_uri: getRedirectUri(),
      state: state,
      show_dialog: 'true',
    });

    const authUrl = `${SPOTIFY_AUTH_URL}?${params.toString()}`;

    if (isNative() && window.Capacitor?.Plugins?.Browser) {
      await window.Capacitor.Plugins.Browser.open({ url: authUrl });
    } else {
      window.location.href = authUrl;
    }
  }

  async function handleCallback(customUrl) {
    let urlParams;
    if (customUrl) {
      try {
        const dummyUrl = new URL(customUrl.replace(/^queuedrop:\/\//i, 'https://dummy.app/'));
        urlParams = dummyUrl.searchParams;
      } catch (e) {
        urlParams = new URLSearchParams(customUrl.split('?')[1] || '');
      }
    } else {
      urlParams = new URLSearchParams(window.location.search);
    }

    const code = urlParams.get('code');
    const error = urlParams.get('error');
    const returnedState = urlParams.get('state');

    if (error) {
      if (!isNative()) window.history.replaceState({}, document.title, getRedirectUri());
      throw new Error(`Spotify yetkilendirme hatası: ${error}`);
    }

    if (!code) return false;

    // state doğrulaması — tek kullanımlık, her hâlükârda temizlenir.
    const expectedState = localStorage.getItem(KEYS.STATE);
    localStorage.removeItem(KEYS.STATE);
    if (!expectedState || !returnedState || returnedState !== expectedState) {
      if (!isNative()) window.history.replaceState({}, document.title, getRedirectUri());
      throw new Error('Yetkilendirme yanıtı doğrulanamadı. Lütfen tekrar giriş yapın.');
    }

    const verifier = localStorage.getItem(KEYS.CODE_VERIFIER);
    const clientId = getClientId();

    if (!verifier || !clientId) {
      if (!isNative()) window.history.replaceState({}, document.title, getRedirectUri());
      throw new Error('Oturum bilgileri eksik. Lütfen tekrar giriş yapın.');
    }

    try {
      const response = await fetch(SPOTIFY_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: getRedirectUri(),
          code_verifier: verifier,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error_description || 'Token alınamadı');
      }

      const data = await response.json();
      saveTokens(data);

      if (!isNative()) window.history.replaceState({}, document.title, getRedirectUri());
      localStorage.removeItem(KEYS.CODE_VERIFIER);

      return true;
    } catch (err) {
      if (!isNative()) window.history.replaceState({}, document.title, getRedirectUri());
      throw err;
    }
  }

  function initNativeListeners(onLoginSuccess, onLoginError) {
    if (isNative() && window.Capacitor?.Plugins?.App) {
      window.Capacitor.Plugins.App.addListener('appUrlOpen', async (data) => {
        if (data.url && data.url.includes('queuedrop://callback')) {
          if (window.Capacitor.Plugins?.Browser) {
            await window.Capacitor.Plugins.Browser.close().catch(() => {});
          }
          try {
            const success = await handleCallback(data.url);
            if (success && typeof onLoginSuccess === 'function') {
              onLoginSuccess();
            }
          } catch (err) {
            if (typeof onLoginError === 'function') {
              onLoginError(err);
            }
          }
        }
      });
    }
  }

  // Eşzamanlı yenileme isteklerinde kilit (SEC-2)
  let refreshPromise = null;

  async function refreshAccessToken() {
    if (refreshPromise) return refreshPromise;

    refreshPromise = (async () => {
      const refreshToken = localStorage.getItem(KEYS.REFRESH_TOKEN);
      const clientId = getClientId();

      if (!refreshToken || !clientId) {
        logout();
        throw new Error('Oturum süresi doldu. Lütfen tekrar giriş yapın.');
      }

      try {
        const response = await fetch(SPOTIFY_TOKEN_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
            client_id: clientId,
          }),
        });

        if (!response.ok) {
          // Sunucu reddetti: refresh token gerçekten geçersiz.
          const authErr = new Error('Token yenilenemedi. Lütfen tekrar giriş yapın.');
          authErr.authFailure = true;
          throw authErr;
        }

        const data = await response.json();
        saveTokens(data);
        return data.access_token;
      } catch (err) {
        // Ağ hatasında oturumu SİLME. Çevrimdışıyken uygulamayı açmak
        // kullanıcıyı çıkışa zorlamamalı; yalnız sunucu reddettiyse çıkılır.
        if (err && err.authFailure) logout();
        throw err;
      }
    })().finally(() => {
      refreshPromise = null;
    });

    return refreshPromise;
  }

  async function getValidToken() {
    if (isTokenExpired()) {
      return await refreshAccessToken();
    }
    return getAccessToken();
  }

  function saveTokens(data) {
    localStorage.setItem(KEYS.ACCESS_TOKEN, data.access_token);
    if (data.refresh_token) {
      localStorage.setItem(KEYS.REFRESH_TOKEN, data.refresh_token);
    }
    const expiryMs = Date.now() + (data.expires_in * 1000) - 60000; // 1 min buffer
    localStorage.setItem(KEYS.TOKEN_EXPIRY, expiryMs.toString());
  }

  function logout() {
    Object.values(KEYS).forEach(key => {
      if (key !== KEYS.CLIENT_ID) {
        localStorage.removeItem(key);
      }
    });
  }

  function getUserProfile() {
    const stored = localStorage.getItem(KEYS.USER_PROFILE);
    return stored ? JSON.parse(stored) : null;
  }

  function saveUserProfile(profile) {
    localStorage.setItem(KEYS.USER_PROFILE, JSON.stringify(profile));
  }

  return {
    getClientId,
    setClientId,
    getRedirectUri,
    getAccessToken,
    isLoggedIn,
    isTokenExpired,
    login,
    handleCallback,
    refreshAccessToken,
    getValidToken,
    logout,
    getUserProfile,
    saveUserProfile,
    isNative,
    initNativeListeners,
  };
})();
