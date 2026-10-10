# QueueDrop — Android & Google Play Store Yayınlama Rehberi

Bu belge, QueueDrop uygulamasının Android cihazlara doğrudan yüklenmesi (APK) ve **Google Play Console** üzerinden tüm dünyaya yayınlanması (AAB) için gereken adımları içerir.

---

## 1. Hazır Derlenmiş Dosyalar (Build Artifacts)

| Dosya Türü | Dosya Konumu | Kullanım Amacı |
|---|---|---|
| **Doğrudan Yüklenebilir APK** | [`android/app/build/outputs/apk/debug/app-debug.apk`](file:///d:/QueueSpotify/android/app/build/outputs/apk/debug/app-debug.apk) | Telefonunuza USB, WhatsApp, Drive vb. ile gönderip hemen test edebileceğiniz kurulum dosyası (~4.7 MB). |
| **Play Store App Bundle (.aab)** | [`android/app/build/outputs/bundle/release/app-release.aab`](file:///d:/QueueSpotify/android/app/build/outputs/bundle/release/app-release.aab) | Google Play Console'a yüklenen resmi yayın paketi (~3.5 MB). |

---

## 2. Spotify Developer Dashboard Ayarı (Zorunlu)

Uygulamanın hem Android telefonda hem de bilgisayarda sorunsuz giriş yapabilmesi için:

1. [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) adresine gidin.
2. Oluşturduğunuz QueueDrop uygulamasına tıklayıp **Settings** sekmesini açın.
3. **Redirect URIs** alanına şu iki adresi ekleyip kaydedin:
   - `queuedrop://callback` *(Android uygulamasının Deep Link adresi)*
   - `http://127.0.0.1:8099/` *(Web ortamı geliştirme ve test için)*

---

## 3. Google Play Console Yükleme Adımları

Google Play Store'da uygulama paylaşmak için [Google Play Console](https://play.google.com/console) geliştirici hesabı ($25 tek seferlik kayıt) gereklidir.

### Adım 1 · Yeni Uygulama Oluşturma
- **Uygulama Adı:** `QueueDrop`
- **Varsayılan Dil:** Türkçe (veya İngilizce)
- **Tür:** Uygulama (App)
- **Fiyatlandırma:** Ücretsiz (Free)

### Adım 2 · Mağaza Girişi (Store Listing)
- **Kısa Açıklama:** Spotify kuyruğunuza tek seferde toplu şarkı ekleyin. Yapıştır, bul, çal!
- **Tam Açıklama:** Şarkı listenizi metin olarak yapıştırın, QueueDrop otomatik ayrıştırsın ve Spotify kuyruğunuza tek dokunuşla eklesin.
- **Grafikler:**
  - Uygulama Simgesi: 512x512 PNG (`assets/logo.jpg` baz alınarak)
  - Özellik Grafiği (Feature Graphic): 1024x500 PNG
  - Ekran Görüntüleri: Telefon dikey formatında en az 2 ekran görüntüsü (`Claude outputs/shot-builder.png` ve `Claude outputs/shot-queue.png` kullanılabilir).

### Adım 3 · Gizlilik Politikası (Privacy Policy)
Google Play, internet izni kullanan uygulamalarda gizlilik politikası URL'si ister.
- QueueDrop kullanıcı verilerini veya Spotify şifrelerini sunucuda depolamaz; tüm token'lar cihazın kendi yerel belleğinde (localStorage) tutulur ve doğrudan Spotify resmi API'si ile haberleşir.
- Ücretsiz olarak GitHub Pages veya Notion sayfası üzerinden basit bir gizlilik metni linki verilebilir.

### Adım 4 · Yayınlama (Release)
- **Üretim (Production)** veya **Açık Test (Open Testing)** sekmesine gidin.
- Yeni sürüm oluşturun ve [`android/app/build/outputs/bundle/release/app-release.aab`](file:///d:/QueueSpotify/android/app/build/outputs/bundle/release/app-release.aab) dosyasını sürükleyip bırakın.
- Sürüm notlarını yazın (ör: *v1.0.0 - İlk Sürüm*).
- İncelemeye gönderin (Google incelemesi genellikle 24-48 saat sürer).

---

## 4. Play Store İçin Özel Keystore ile İmzalama (Opsiyonel / Tavsiye Edilen)

Eğer Google Play App Signing yerine kendi anahtarınızla imzalamak isterseniz:

```powershell
# 1. Anahtar üretimi (Java JDK yüklü olmalıdır):
keytool -genkey -v -keystore queuedrop-release.jks -alias queuedrop -keyalg RSA -keysize 2048 -validity 10000

# 2. Üretilen AAB paketini imzalama:
jarsigner -verbose -sigalg SHA256withRSA -digestalg SHA-256 -keystore queuedrop-release.jks android/app/build/outputs/bundle/release/app-release.aab queuedrop
```

---

## 5. Gelecekte Kod Değişikliği Yaptığınızda Tekrar Derleme

Web kodunda (`index.html`, `js/`, `css/`) değişiklik yaptığınızda Android uygulamasını güncellemek için tek komut yeterlidir:

```powershell
# Web kodunu derleyip Android ile eşitler:
npm run cap:sync

# Yeni APK üretmek için:
npm run android:apk

# Yeni Play Store AAB üretmek için:
npm run android:aab

# Projeyi doğrudan Android Studio'da açmak için:
npm run cap:open
```
