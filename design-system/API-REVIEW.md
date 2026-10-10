# QueueDrop — API Katmanı Denetimi

`js/auth.js` (OAuth 2.0 + PKCE) ve `js/spotify.js` (Web API istemcisi) satır
satır okundu. Aşağıdaki bulguların hepsi koddan doğrulanmıştır; hiçbiri tahmin
değildir. Güven etiketleri: [Kesin] kodda görülebilir, [Olası] koşula bağlı.

---

## Düzeltilen bulgular

### A-1 · Sonsuz özyineleme — 429 ve 401 [Kesin]

`apiRequest` hız sınırında (429) `sleep` edip **kendini tavansız** çağırıyordu.
Spotify 429 vermeye devam ederse bu döngü hiç bitmez: uygulama donar, istek
kuyruğu büyür. Aynı sorun 401'de de vardı — `refreshAccessToken()` başarılı
dönse bile token yine 401 alırsa (iptal edilmiş yetki, eksik scope) özyineleme
sonsuza gider.

Düzeltme: `attempt` sayacı. 429 için en fazla 3 deneme ve `Retry-After` 30
saniyeyle sınırlandı; 401 için tek yenileme hakkı. Tavana varınca anlaşılır bir
hata fırlatılıyor.

### A-2 · Ağ hatasında oturum siliniyordu [Kesin]

`refreshAccessToken`'ın `catch` bloğu **her** hatada `logout()` çağırıyordu.
`fetch` ağ hatasında da buraya düşer — yani çevrimdışıyken uygulamayı açmak
kullanıcının oturumunu siliyordu. Uçakta açtın, Client ID hariç her şeyi
kaybettin.

Düzeltme: yalnız sunucu gerçekten reddettiyse (HTTP hatası, `authFailure`
işaretli) çıkış yapılıyor. Ağ hatası oturumu bozmuyor.

### A-3 · OAuth `state` parametresi yoktu [Kesin]

Yetkilendirme isteğinde `state` gönderilmiyordu. PKCE, kod ele geçirmeyi
engeller ama `state` ayrı bir işi yapar: dönüş yanıtının bizim başlattığımız
akışa ait olduğunu doğrular. Yokluğunda uygulamaya başkasının yetkilendirme
kodu enjekte edilebilir.

Düzeltme: 32 karakterlik rastgele `state` üretilip `localStorage`'a yazılıyor,
dönüşte karşılaştırılıp tek kullanımlık olarak siliniyor. Uyuşmazsa akış
reddediliyor.

### A-4 · Ölümcül hatada 50 kez aynı duvara toslama [Kesin]

`addMultipleToQueue` her hatada döngüye devam ediyordu. Ama "Premium yok"
(403), "aktif cihaz yok" (404) ve "oturum düştü" (401) hataları **kalan her
şarkıda da** olacak. 50 şarkılık bir liste 50 başarısız istek ve 50 kırmızı
kart üretiyordu.

Düzeltme: `isFatal(err)` — bu üç durumda döngü kırılıyor, sebep
`result.abortReason` ile taşınıyor ve `app.js` genel mesaj yerine gerçek sebebi
gösteriyor.

### A-5 · Hata mesajları çevrilmemişti [Kesin]

`errData.error?.message` doğrudan gösteriliyordu: kullanıcı Türkçe bir arayüzde
`Player command failed: No active device found` görüyordu. `translateError`
eklendi; `PREMIUM_REQUIRED`, `NO_ACTIVE_DEVICE`, 429 ve 5xx için ne yapması
gerektiğini söyleyen Türkçe cümleler var.

### A-6 · "Cihaz yok" ile "ulaşılamadı" aynı şeydi [Kesin]

`getPlaybackState`'in `catch` bloğu her hatada `null` dönüyordu. Arayüz için
bu, "hiçbir şey çalmıyor" ile "Spotify'a ulaşılamadı"nın ayırt edilemez olması
demek — tasarımın ayırmayı hedeflediği iki durum.

Düzeltme: `lastPlaybackError` tutuluyor, `SpotifyAPI.getLastPlaybackError()`
ile dışa veriliyor; `ui.js` boş durum yerine hata durumunu gösteriyor.

### A-7 · Arama pazarı sabit `TR` idi [Kesin]

Üç arama çağrısında da `market: 'TR'` gömülüydü. Türkiye dışındaki bir hesap
için sonuçlar eksik ya da çalınamaz parçalar döndürebilir.

Düzeltme: `user-read-private` scope'u zaten var; `/me` yanıtındaki `country`
alanı `setMarket()` ile pazara yazılıyor, gelmezse `TR` varsayılan kalıyor.

### A-8 · Premium uyarısı 6 saniyede kayboluyordu [Kesin]

Ücretsiz hesap tespit edildiğinde yalnızca geçici bir toast gösteriliyordu.
Kısıt kalıcı, uyarı geçiciydi. Artık oluşturucu sekmesinde kalıcı bir şerit var.

### A-9 · Görsel URL'leri nitelik içine kaçırılmadan giriyordu [Kesin]

`<img src="${track.albumImageSmall}">` — kaynak Spotify CDN olduğu için pratikte
zararsız, ama metin alanları kaçırılırken URL'nin kaçırılmaması tutarsızlık.
`escapeHtml` üç yerde de uygulandı.

---

## Kayda geçen, düzeltilmeyen maddeler

### B-1 · Token'lar `localStorage`'da [Kesin, kabul edilmiş taviz]

Erişim ve yenileme token'ları `localStorage`'da duruyor; bir XSS açığı bunları
okuyabilir. Sunucusuz bir PKCE SPA'sında pratik alternatif yok (bellekte
tutmak her sekme yenilemesinde yeniden giriş demek). XSS yüzeyi dar: tüm
kullanıcı metni `escapeHtml`'den geçiyor. Değiştirilmedi, bilinçli bir karar
olarak kaydedildi.

### B-2 · Arama, şarkı başına 3 isteğe kadar çıkabiliyor [Kesin, düşük risk]

`searchTrack` sonuç bulamazsa iki kez daha deniyor. 50 şarkılık bir liste en
kötü durumda 150 istek eder. Aramalar sıralı (`await` döngüsü) olduğu için
Spotify'ın 30 saniyelik penceresini pratikte zorlamıyor ve artık 429 geldiğinde
tavanlı geri çekilme var. İzlenmeli, şimdilik dokunulmadı.

### B-3 · `generateRandomString` modulo sapması [Kesin, ihmal edilebilir]

`x % 66` alfabesi 256'yı tam bölmediği için karakter dağılımı hafif eğik. 64
karakterlik bir doğrulayıcıda kalan entropi PKCE için fazlasıyla yeterli.
Kaydedildi, değiştirilmedi.

### B-4 · `isLoggedIn()` süresi dolmuş token için `true` dönebiliyor [Olası]

Yenileme token'ı varsa `true` dönüyor, ama `getAccessToken()` eski token'ı
veriyor. Pratikte zararsız: her istek `getValidToken()` üzerinden geçiyor ve o
gerektiğinde yeniliyor. Yalnız `isLoggedIn()`'in adı yaptığı işten daha geniş
bir söz veriyor.

---

## A-10 · Gövdesiz başarı yanıtı hata sayılıyordu [Kesin — canlıda yakalandı]

**Belirti.** Şarkılar Spotify kuyruğuna gerçekten ekleniyordu (Spotify'ın kendi
"Sıradaki" listesinde görüldü) ama uygulama "Şarkılar kuyruğa eklenemedi"
diyor, iki kartı da *Yok* işaretliyordu. Kullanıcı 10 kez denedi; kuyrukta 20
kopya oluştu. Oynatma kontrollerinde de aynı sınıftan bir hata çıktı:
`Unexpected non-whitespace character after JSON at position 2`.

**Kök neden.** `apiRequest` yalnız **204**'ü gövdesiz sayıyor, diğer her
başarıda `response.json()` çağırıyordu:

```js
if (response.status === 204) return null;
...
return response.json();   // 200 + boş gövde → SyntaxError
```

Spotify'ın `POST /me/player/queue` ucu çoğu zaman 204 döner ama **boş gövdeli
200** de dönebiliyor; `play`, `pause`, `next`, `previous`, `seek` için de aynı.
O durumda `response.json()` fırlatıyor, istek BAŞARILI olduğu hâlde çağıran
taraf hata sayıyordu. Bu kusur redesign'dan önce de vardı.

**Düzeltme.** Gövde metin olarak alınıyor; boşsa veya JSON değilse `null`
dönülüyor. Hata yolları (`!response.ok`) değişmedi.

**Kanıt — `api-test.js`** (sahte `fetch`, gerçek `spotify.js`, `vm` ile):

```
                                  ESKİ KOD              YENİ KOD
204 No Content                    geçti                 geçti
200 boş gövde                     Unexpected end of…    geçti
200 sadece boşluk                 Unexpected end of…    geçti
200 JSON olmayan gövde            Unexpected token 'O'  geçti
200 geçerli JSON                  geçti                 geçti
403 PREMIUM_REQUIRED              hata (status yok)     hata (status 403)
404 NO_ACTIVE_DEVICE              hata (status yok)     hata (status 404)
```

**Bu hatanın neden bu kadar uzun saklandığı.** Başarısızlık mesajı sabitti:
"Şarkılar kuyruğa eklenemedi. Spotify aktif mi kontrol edin." Gerçek istisna
(`Unexpected end of JSON input`) hiçbir yerde gösterilmiyordu. `app.js` artık
`result.errors[0].error` değerini toast'a yazıyor ve tamamını konsola
döküyor — genel bir cümle bir daha gerçek sebebi örtmeyecek.

---

## Geliştirme önbelleği — sw.js v4

Düzeltme diske yazıldıktan sonra da eski hata görüldü: tarayıcı hâlâ yama
öncesi `spotify.js`'i çalıştırıyordu. Service worker bu karışıklığı
sürekli yeniden üretebileceği için `sw.js` artık loopback'te (`127.0.0.1`,
`localhost`, `[::1]`) **hiç araya girmiyor**: ne ön-önbellekleme yapıyor, ne
`fetch` olayını yakalıyor, ve etkinleşirken tüm önbellekleri siliyor.
PWA önbelleği yalnız gerçek dağıtımda devrede.
