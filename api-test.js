// spotify.js apiRequest gövde işleme testi — fetch sahte, gerçek kod çalışıyor.
// Betiğin bulunduğu klasördeki js/spotify.js — her makinede çalışsın.
const nodePath = require('path');
const path = nodePath.join(__dirname, 'js', 'spotify.js');
const fs = require('fs');
const vm = require('vm');

function run(fakeResponse) {
  const sandbox = {
    console,
    setTimeout,
    URLSearchParams,
    module: { exports: {} },
    SpotifyAuth: {
      getValidToken: async () => 'tok',
      refreshAccessToken: async () => 'tok2',
    },
    fetch: async () => fakeResponse,
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path, 'utf8'), sandbox);
  return sandbox.module.exports;
}

const mkRes = (status, body, ok = status < 400) => ({
  status, ok,
  headers: { get: () => null },
  text: async () => body,
  json: async () => { if (!body) throw new SyntaxError('Unexpected end of JSON input'); return JSON.parse(body); },
});

(async () => {
  const cases = [
    ['204 No Content',        mkRes(204, '')],
    ['200 BOŞ gövde  <-- hata buradaydı', mkRes(200, '')],
    ['200 sadece boşluk',     mkRes(200, '   ')],
    ['200 JSON olmayan gövde',mkRes(200, 'OK')],
    ['200 geçerli JSON',      mkRes(200, '{"a":1}')],
  ];
  let fail = 0;
  for (const [ad, res] of cases) {
    const API = run(res);
    try {
      await API.addToQueue('spotify:track:x');
      console.log('GEÇTI  addToQueue —', ad);
    } catch (e) {
      fail++;
      console.log('KALDI  addToQueue —', ad, '→', e.message);
    }
  }
  // hata yolları hâlâ hata mı?
  for (const [ad, res, bekle] of [
    ['403 Premium', mkRes(403, '{"error":{"status":403,"reason":"PREMIUM_REQUIRED","message":"x"}}', false), 403],
    ['404 cihaz yok', mkRes(404, '{"error":{"status":404,"reason":"NO_ACTIVE_DEVICE","message":"x"}}', false), 404],
  ]) {
    const API = run(res);
    try {
      await API.addToQueue('spotify:track:x');
      fail++; console.log('KALDI  hata yutuldu —', ad);
    } catch (e) {
      console.log(`GEÇTI  ${ad} hâlâ hata (status ${e.status}) → "${e.message.slice(0,48)}..."`);
    }
  }
  console.log(fail ? `\n${fail} test kaldı` : '\nTümü geçti');
  process.exit(fail ? 1 : 0);
})();
