# 🎵 QueueSpotify

> **Akıllı Spotify Kuyruk Oluşturucu, Oynatıcı & Canlı Ritim Asistanı**  
> Modern Web (PWA) ve Android (Capacitor) destekli, makine öğrenimi ve gerçek zamanlı DSP BPM tespiti ile güçlendirilmiş Spotify müzik deneyimi.

---

## ✨ Özellikler

- 🎧 **Spotify OAuth 2.0 + PKCE**: Gizli anahtar (Client Secret) gerektirmeyen, güvenli ve tarayıcı/mobil uyumlu kimlik doğrulama.
- ⚡ **Gerçek Zamanlı DSP BPM Tespiti**: Web Audio API ve Spectral Flux analizi ile çalan şarkının temposunu mikrofon veya ses akışından anlık hesaplama ve tempo senkronlu görsel nabız animasyonu.
- 🤖 **Makine Öğrenimi (ML) Öneri Motoru**:
  - Çok boyutlu özellik vektörü (BPM, enerji, dans edilebilirlik, akustiklik vb.).
  - Markov tempo sürekliliği ve harmonik geçiş skorlaması (1x, 2x, 0.5x, 1.5x triplet ve beatmatch kilidi).
  - Canlı ölçülen BPM verisiyle anlık akustik kalibrasyon.
  - Vibe modları: *Benzer*, *Parti*, *Chill*, *Keşfet* (MMR - Maximum Marginal Relevance çeşitlilik algoritması).
- 📜 **Senkronize Şarkı Sözleri (LRC)**: Zaman damgalı satır takibi, otomatik kaydırma ve temizlenmiş meta etiketler.
- 🔮 **Dinamik Lava Lamp Görselleştirici**: Albüm kapağından türetilen renk paletleri ve müzik temposuna duyarlı Canvas animasyonları.
- 🔀 **Akıllı Sıralama & Kuyruk Yönetimi**:
  - *Smart Shuffle*: Arka arkaya aynı sanatçının çalmasını önleyen akıllı karıştırma.
  - *Deduplication*: Yinelenen şarkıları otomatik temizleme.
  - *Kuyruk Bitiş Süresi (ETA)*: Kuyruğun tam olarak saat kaçta biteceğini hesaplama.
  - *Kuyruğu Çalma Listesine Kaydetme*: Tek tıkla Spotify hesabına aktarma.
- 📱 **PWA & Android Native**: Capacitor 7 altyapısı, sistem bildirimleri, koyu tema ve çevrimdışı önbellekleme desteği.

---

## 🚀 Hızlı Başlangıç

### Gereksinimler
- Node.js 18+
- Spotify Geliştirici Hesabı ([Spotify Developer Dashboard](https://developer.spotify.com/dashboard))

### Kurulum
```bash
# Bağımlılıkları yükleyin
npm install

# Testleri çalıştırın
npm test

# Web varlıklarını www/ dizinine derleyin
npm run build
```

---

## 🌐 Web Dağıtımı (Vercel)

Proje Vercel ile tek tıkla çalışacak şekilde yapılandırılmıştır:

1. Bu depoyu GitHub hesabınıza bağlayın veya [Vercel](https://vercel.com) üzerinden projeyi import edin.
2. Vercel otomatik olarak `node build.js` komutunu çalıştıracak ve `www` klasörünü sunacaktır (`name: "queuespotify"`).
3. Canlı site adresi: `https://queuespotify.vercel.app/`
4. Bu adresi [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) panelinizdeki uygulamanızın **Redirect URIs** bölümüne ekleyin.

---

## 📱 Android Derleme (APK)

```bash
# Web dosyalarını senkronize et ve Android projesini güncelle
npm run cap:sync

# Debug APK derle
cd android
./gradlew assembleDebug
```
Üretilen APK dosyası: `android/app/build/outputs/apk/debug/app-debug.apk`

---

## 🧪 Test Paketi

Proje kapsamlı bir otomatik test paketine sahiptir (161+ test):
```bash
npm test
```
- `test/parser.test.js`: Çok formatlı şarkı metni ve link ayrıştırıcı testleri.
- `test/audit-evidence.js`: WAI-ARIA erişilebilirlik, OAuth CSRF/PKCE güvenliği ve DOM senkronizasyon testleri.
- `test/features.test.js`: Akıllı karıştırma, tekilleştirme ve Spotify API metod testleri.
- `test/lyrics.test.js`: LRC zaman damgalı söz motoru testleri.
- `test/rhythm.test.js`: Spectral Flux ve anlık BPM tespiti testleri.
- `test/ml-recommender.test.js`: ML öneri motoru ve canlı BPM kalibrasyon testleri.

---

## 📄 Lisans
MIT License
