# QueueDrop — İkinci Çekişmeli Kurul İncelemesi

İncelenen: 16–17 Eylül 2026 çalışmasının **bütünü** — tasarım güncellemesi,
API denetimi, kurul incelemesi, duman testi ve bunların üzerine kurulan
doğrulama anlatısı.

Bu incelemenin ilkinden farkı: elde artık canlı kanıt var. Uygulama gerçek
Spotify hesabıyla çalıştı, bir hata kullanıcıda patladı, ve bu turda üç ölçüm
yapıldı (aşağıda).

---

## 0 · Analist — ortak olgusal zemin

**Konu.** Çalışan bir vanilla-JS PWA üzerinde yapılan kapsamlı arayüz + API
çalışması ve ona eşlik eden dört doküman (MASTER, AUDIT, REVIEW, API-REVIEW).

**Ana iddialar (zaman içinde verilen).**
1. "Eski ID sözleşmesi tamamen korundu." — sonradan yanlış çıktı (K-1).
2. "API katmanı satır satır denetlendi, 9 bulgu düzeltildi."
3. "20/20 duman testi geçti."
4. "Kontrast 16/16 AA, denetim 348 kural, `partial: false`."

**Bu turda yapılan üç ölçüm.**

- **Ö-1.** `api-test.js`, aynı testi eski ve yeni `spotify.js` üzerinde
  çalıştırdı. Eski kod beş gövde şeklinden üçünde patlıyor
  (`Unexpected end of JSON input`), yenisi hepsini geçiyor.
- **Ö-2.** Tarayıcıda `[hidden]` + gözlemci köprüsü ölçüldü. `display:flex`
  yazıldıktan **hemen sonra** öğenin hesaplanmış görünümü hâlâ `none`;
  ancak gözlemcinin mikro-görevinden sonra `flex` oluyor.
- **Ö-3.** `hidden` özniteliği taşıyan 13 id'li öğe sayıldı; 13'ü de bir
  yerden yönetiliyor. Ancak `SYNCED_IDS` listesinde **3 ölü giriş** var
  (`now-playing-empty`, `queue-empty`, `step-client-id` artık `hidden`
  taşımıyor).

**Örtük varsayım.** Katman katman doğrulama (kontrast → CSS denetimi → DOM
sözleşmesi → duman testi) yeterli kapsama üretir.

---

## 1 · Muhalefet — açılış

**M-1. Asıl hatayı, onu aramak için yazılmış denetim kaçırdı.**
`API-REVIEW.md` `spotify.js`'i satır satır okuduğunu söyleyip dokuz bulgu
çıkardı. Ürünü fiilen bozan tek hata (A-10, gövdesiz başarı yanıtı) o
dokuzun içinde yok. Üstelik hata gizli değildi: denetimin *alıntıladığı*
bloğun son satırıydı — `return response.json();`. Denetim 429 özyinelemesini,
`state` eksikliğini, ağ hatasında çıkışı gördü; ekranın önündeki satırı
görmedi. Bu, denetimin derinliğine dair verilen güveni zayıflatır.

**M-2. "20/20 geçti" cümlesi, ürün bozukken kuruldu.**
Duman testi A-10 canlıyken tam puan verdi. Suite'i yazan kişi, test edilecek
şeyleri de seçti; seçmediği hiçbir şey ölçülmedi. `AUDIT.md`'ye eklenen
kapsam uyarısı CSS ile DOM'u ayırıyor ama **API sözleşmesi diye bir kör nokta
hiç adlandırılmamış**. Yani uyarı bile yanlış yere bakıyordu.

**M-3. `[hidden] !important` + gözlemci köprüsü, sessiz görünmezlik üretebilen
bir sıralama bağımlılığı.** Ö-2 bunu ölçtü: `display:flex` yazıldıktan sonra
öğe hâlâ görünmez, gözlemci koşana kadar. Gözlemci koşmazsa — öğe
`SYNCED_IDS`'te değilse, `enhance.js` yüklenmezse, bir istisna init'i
yarıda keserse — öğe **kalıcı olarak görünmez** kalır ve hiçbir hata vermez.
Bu, T-2'nin (sessiz ölü kod) tam olarak aynı şekli. Liste elle tutuluyor ve
Ö-3'e göre zaten kaymış: üç ölü giriş var.

**M-4. Ayakta kalan doğrulanmamış iddialar hâlâ var.** Premium şeridi,
403/404 fail-fast yolu, OAuth `state` gidiş-dönüşü ve kapaktan renk çıkarımı
bir kez bile gerçekten çalıştırılmadı. Kapak rengi için bu turda yapılan CORS
ölçümü **zaman aşımına uğradı** — yani bilmiyoruz.

**M-5. En kötü durum.** Kullanıcı bir sonraki hatada yine "doğrulandı" denmiş
bir şeye güvenir, hata yine kendisinde patlar. Maliyet teknik değil: verilen
raporlara duyulan güven.

---

## 2 · Savunma — nokta nokta

**M-1'e — tam kabul, itiraz yok.** A-10 alıntılanan bloğun içindeydi ve
görülmedi. Savunulacak tarafı yok. Eklenecek tek şey, bunun *neden* olduğu:
denetim "bu kod hangi hataları yapabilir" diye değil, "bu kodda bilinen
API anti-desenleri var mı" diye okundu. 429, `state`, logout — üçü de
kontrol listesi maddesi. Gövdesiz yanıt listede yoktu, o yüzden aranmadı.
Kontrol listesiyle denetim, listede olmayanı yapısal olarak kaçırır.

**M-2'ye — kabul, bir düzeltmeyle.** "20/20" ifadesi yanlış bir güven
üretti, doğru. Ancak suite hiçbir zaman API'yi test ettiğini iddia etmedi;
iddia edilen şey — sekme dönüşü, tema, yerleşim — gerçekten ölçüldü ve dört
gerçek hata buldu. Kabul edilen kısım şu: **kör noktanın adı konmadığı için
okuyucu kapsamı olduğundan geniş sandı.** Bu, raporlama kusuru ve gerçek.

**M-3'e — mekanizma kabul, şiddet kısmen itiraz.** Ölçüm doğru: pencere
gerçekten var. Ama mikro-görev boyamadan önce koşar, yani pratikte titreme
yok; ve Ö-3 bugün 13/13 öğenin yönetildiğini gösteriyor. İtiraz edilen kısım
"kırılgan" nitelemesi değil — o doğru — "bugün kırık" iddiası olurdu, o
yanlış. Kabul edilen: **hiçbir mekanizma bu değişmezi zorlamıyor**, üç ölü
giriş de listenin elle tutulduğunun kanıtı.

**M-4'e — tam kabul.** Dördü de çalıştırılmadı. CORS ölçümünün zaman aşımına
uğraması ayrıca kötü: bir ölçüm denendi ve sonuçsuz kaldı, ama `MASTER.md`
kapak rengini çalışan bir özellik gibi anlatıyor.

**Görmezden gelinen bağlam.** Denetimin kaçırdığı A-10 kullanıcıya bir kez
zarar verdi ve düzeltildi; denetimin *bulduğu* üç şey (429 sonsuz
özyinelemesi, ağ hatasında oturum silinmesi, eksik `state`) kullanıcıya hiç
"patlamayacak" türden hatalardı — ilki tarayıcıyı kilitlerdi, ikincisi
uçakta oturumu silerdi, üçüncüsü bir güvenlik açığıydı. Kullanıcı bunların
hiçbirini bildirmezdi. Yani denetim değersiz değil; **kapsamı abartılmış**.

**Gerçek güçlü yanlar.** OAuth akışı uçtan uca gerçek Spotify ile doğrulandı.
Kuyruğa ekleme gerçek hesapta çalıştı. A-10 için yazılan test, eski ve yeni
kodu yan yana koşturup farkı gösteriyor — iddia değil, ölçüm. `sw.js`
loopback'te tamamen devre dışı, yani "düzelttim ama tarayıcı eskisini
çalıştırıyor" sınıfı bir daha yaşanmayacak.

---

## 3 · Çapraz sorgu — tur 1 (Muhalefet → Savunma)

**S1.** Savunma diyor ki *"kontrol listesiyle denetim, listede olmayanı
yapısal olarak kaçırır."* Bu doğruysa, `API-REVIEW.md`'de kalan dört madde
(B-1…B-4) neden hâlâ "kayda geçti, düzeltilmedi" diye duruyor? Aynı liste
mantığıyla üretilmediler mi?
**Cevap.** Üretildiler. B-1 (localStorage) ve B-3 (modulo) bilinçli
tavizler, ama B-2 (şarkı başına 3 istek) ve B-4 (`isLoggedIn` adı) listeden
geldi ve hiçbiri ölçülmedi. Dürüst cevap: o dört madde de A-10 ile aynı
epistemik sınıfta — kanıtlanmış değil, tahmin edilmiş.

**S2.** *"13/13 öğe yönetiliyor"* bugünün fotoğrafı. Yarın biri `hidden`
taşıyan yeni bir öğe eklerse ne olur?
**Cevap.** Sessizce görünmez kalır. Hiçbir test, hiçbir denetim yakalamaz.
Bu, Ö-3'ün asıl bulgusu ve savunulacak yanı yok.

**S3.** Kapak rengi ölçümü zaman aşımına uğradı. `MASTER.md` hâlâ o özelliği
çalışıyormuş gibi anlatıyor. Bu, K-3'te (tema varsayılanı) düzeltilen
"belge ile kod çelişiyor" hatasının aynısı değil mi?
**Cevap.** Aynısı. `MASTER.md` "CORS engellenirse sessizce token rengine
döner" diyor — bu doğru bir *tasarım* ifadesi ama çalıştığı doğrulanmadı.
Belgenin dili ölçülmüş gibi okunuyor.

---

## 4 · Çapraz sorgu — tur 2 (Savunma → Muhalefet)

**S1.** M-2 diyor ki *"suite'i yazan kişi, test edilecek şeyleri de seçti."*
Bu her test suite'i için doğru. Öyleyse eleştiri neyi öneriyor — test
yazmamayı mı?
**Cevap.** Hayır; öneri, suite'in kapsamının raporlanma biçimini değiştirmek.
"20/20 geçti" yerine "20/20 geçti; API yanıt şekilleri, ağ hataları ve
Spotify sözleşmesi bu suite'in görüş alanı dışında" demek. Eleştiri testin
varlığına değil, sayının tek başına sunulmasına.

**S2.** M-5 "güven maliyeti" diyor. Ama kullanıcı zaten her adımda hataları
bildirdi ve düzeltildi. Gerçek zarar nerede?
**Cevap.** Zarar gecikmede. A-10 kullanıcıya 10 başarısız deneme ve kuyrukta
20 kopya olarak yansıdı; sebep, *daha önce yapılmış bir denetimde* duruyordu.
Zarar küçük ama nedeni yapısal: doğrulama, iddia verildikten sonra geliyor.

---

## 5 · Beş bağımsız hüküm

### J1 — Mantık / kanıt
**Hüküm: Kısmen Savunulabilir.** Belirleyici argüman: *"Üstelik hata gizli
değildi: denetimin alıntıladığı bloğun son satırıydı — `return
response.json();`."* Bir denetimin, kendi alıntıladığı satırdaki kusuru
kaçırması, o denetimin yöntemine dair güçlü bir kanıt. Savunmanın açıklaması
(kontrol listesi mantığı) mazeret değil, doğru bir teşhis — ve S1'de aynı
mantığın B-2/B-4'ü de kirlettiği kabul edildi. Buna karşılık ölçümler gerçek:
`api-test.js` eski/yeni farkını gösteriyor, Ö-2 ve Ö-3 sayısal. İddialar
artık kanıta bağlı; sorun geçmişte verilen iddiaların kanıttan önce
gelmesiydi. Güven: **Yüksek**.

### J2 — Risk
**Hüküm: Kısmen Savunulabilir.** Belirleyici argüman: *"Gözlemci koşmazsa —
öğe SYNCED_IDS'te değilse, enhance.js yüklenmezse, bir istisna init'i yarıda
keserse — öğe kalıcı olarak görünmez kalır ve hiçbir hata vermez."* Sessiz
başarısızlık, gürültülü başarısızlıktan daha kötüdür ve bu mimaride iki kez
gerçekleşti (T-2, sonra bu risk). Hafifletici: tespit edilen her hata geri
alınabilir ve tek dosyada; iş mantığı dosyaları büyük ölçüde korundu; en kötü
durum "bir özellik çalışmaz", "veri kaybolur" değil. Kalan risk gerçek ama
sınırlı ve tersine çevrilebilir. Güven: **Yüksek**.

### J3 — Uygulanabilirlik
**Hüküm: Savunulabilir.** Belirleyici argüman: *"OAuth akışı uçtan uca gerçek
Spotify ile doğrulandı. Kuyruğa ekleme gerçek hesapta çalıştı."* Uygulanabilirlik
sorusu "bu iş yapıldı mı ve sürdürülebilir mi" sorusudur. Cevap evet: uygulama
çalışıyor, sunucu kurulumu belgelenmiş, iki test suite'i ve dört doküman
klasörde duruyor, geri dönüş için yedek var. Muhalefetin noktaları yöntemle
ilgili, çıktının kullanılabilirliğiyle değil. Kalan işler (dört doğrulanmamış
özellik) dakikalar sürecek kontroller. Güven: **Orta**.

### J4 — Şüpheci
**Hüküm: Kısmen Savunulabilir.** Belirleyici argüman: *"Duman testi A-10
canlıyken tam puan verdi."* En güçlü itiraz bu ve savunma onu tam olarak
karşılamadı — "suite API'yi test ettiğini iddia etmedi" demek, sayının nasıl
sunulduğu sorusunu yanıtlamıyor; nitekim S1'de bu kabul edildi. Bu turda üç
tur inceleme, bir mekanik denetim ve bir test suite'i, ürünü fiilen bozan
hatayı bulamadı; hatayı kullanıcı buldu. Bu tekrar eden bir örüntü: T-2 için
tarayıcı gerekti, A-10 için gerçek Spotify yanıtı gerekti. Her seferinde
eksik olan aynı şey — **gerçek koşullar**. "Savunulamaz" demiyorum, çünkü
her bulgu düzeltildi ve son iddialar ölçüme bağlandı. Ama süreç hâlâ kendi
kör noktasını kendi bulamıyor. Güven: **Yüksek**.

### J5 — Dengeleyici
**Hüküm: Kısmen Savunulabilir.** İki taraf da kendi alanında haklı.
Muhalefet yöntem hakkında haklı: kontrol listesiyle denetim, listede olmayanı
kaçırır ve bu somut bir zarar verdi. Savunma sonuç hakkında haklı:
*"denetimin bulduğu üç şey kullanıcıya hiç 'patlamayacak' türden hatalardı —
ilki tarayıcıyı kilitlerdi, ikincisi uçakta oturumu silerdi, üçüncüsü bir
güvenlik açığıydı."* Bu doğru ve önemsiz değil; kullanıcı-bildirimli hata
avcılığı bu üçünü asla bulamazdı. Yani iki yöntem birbirinin yerine geçmiyor,
tamamlıyor. Kararı değiştiren nokta: eksik olan üçüncü bir katman —
*gerçek yanıtlarla sözleşme testi* — ve o katman bu turda ilk kez
(`api-test.js`) kuruldu. Güven: **Orta**.

---

## 6 · Sayım

| Hüküm | Sayı | Hâkimler |
|---|---|---|
| Savunulabilir | 1 | J3 |
| **Kısmen Savunulabilir** | **4** | J1, J2, J4, J5 |
| Savunulamaz | 0 | — |

Yeter sayı: 5/5 geçerli hüküm (≥4 gerekli). ✅
Çoğunluk: 4/5 — **Kısmen Savunulabilir**.
Çoğunlukta Yüksek güven: 3 (J1, J2, J4) → **Güç etiketi: Güçlü**.

## Nihai hüküm

**Kısmen Savunulabilir (Güçlü).**

Çıktı ayakta: uygulama çalışıyor, OAuth gerçek hesapla doğrulandı, kuyruğa
ekleme gerçek kuyrukta görüldü, her bulunan hata düzeltildi ve son iddialar
ölçüme bağlı. Ayakta kalan eleştiri ilk incelemedekiyle aynı yerde ama daha
keskin: **doğrulama yöntemi, kendi kör noktasını kendisi bulamıyor.** Üç
katman (mekanik denetim, kurul, duman testi) ürünü fiilen bozan hatayı
kaçırdı; onu kullanıcı buldu.

---

## Kurulun önerdiği üç değişiklik

1. **Değişmezi teste çevir.** Ö-3'teki envanter kontrolü (her `hidden`
   öğesinin bir yerden yönetildiği) elle yapılmış bir sorgu. Suite'e
   eklenirse, yarın eklenen bir öğe sessizce görünmez kalmaz. Ayrıca
   `SYNCED_IDS`'teki üç ölü giriş temizlenmeli.
2. **Sözleşme testini genişlet.** `api-test.js` yalnız `addToQueue`'yu ve
   yalnız gövde şekillerini kapsıyor. Aynı matris `getQueue`,
   `getCurrentlyPlaying`, `togglePlayPause`, `seekTo` için de kurulmalı —
   A-10 bu uçların hepsinde vardı.
3. **Sayıyı tek başına raporlama.** "20/20 geçti" yerine, suite'in
   göremediğini de söyleyen bir cümle. Bu incelemedeki en güçlü itiraz
   (J4) tam olarak buydu.

Bu üçü, kaçırılanı geçmişe dönük düzeltmez; bir sonrakini yakalama şansını
artırır. Kurul, bunlar yapılmadan verilen "doğrulandı" ifadelerinin aynı
indirimle okunmasını önerir.
