// Google Play 用のスクリーンショットなどを撮る（Playwright が必要）
//   npm run build && node scripts/store-shots.js
// 出力: docs/store/{ja,en}-N-*.png（1080×1920）、icon-512.png、feature-graphic.png（1024×500）
const { chromium } = require('playwright');
const path = require('path');
const root = path.join(__dirname, '..');
const url = 'file://' + path.join(root, 'www', 'index.html');
const out = path.join(root, 'docs', 'store');

const scenes = [
  { name: '1-deep-sleep', run: async p => { await p.click('.preset-btn[data-id=sleep]'); await p.click('.timer-btn[data-min="60"]'); } },
  { name: '2-rain', run: async p => {
      await p.click('.preset-btn[data-id=rain]'); await p.click('.timer-btn[data-min="30"]');
      await p.evaluate(() => document.getElementById('card-rain').scrollIntoView({ block: 'center' }));
    } },
  { name: '3-campfire', run: async p => {
      await p.click('.preset-btn[data-id=campfire]');
      await p.evaluate(() => document.getElementById('card-fire').scrollIntoView({ block: 'center' }));
    } },
  { name: '4-mix', run: async p => {
      await p.click('.preset-btn[data-id=ocean]');
      await p.click('#tog-binaural + .tog-sl');
      await p.evaluate(() => document.getElementById('card-ocean').scrollIntoView({ block: 'start' }));
    } },
];

(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  for (const lang of ['ja', 'en']) {
    for (const s of scenes) {
      const p = await b.newPage({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: lang === 'ja' ? 'ja-JP' : 'en-US' });
      await p.goto(url);
      await s.run(p);
      await p.waitForTimeout(1800);
      await p.screenshot({ path: path.join(out, `${lang}-${s.name}.png`) });
      await p.close();
    }
  }
  const img = 'data:image/png;base64,' + require('fs').readFileSync(path.join(root, 'assets', 'icon-only.png')).toString('base64');
  const icon = await b.newPage({ viewport: { width: 512, height: 512 } });
  await icon.setContent(`<body style="margin:0"><img src="${img}" width="512" height="512"></body>`);
  await icon.screenshot({ path: path.join(out, 'icon-512.png') });

  const fg = await b.newPage({ viewport: { width: 1024, height: 500 } });
  await fg.setContent(`<html><body style="margin:0;width:1024px;height:500px;overflow:hidden;background:linear-gradient(135deg,#080818,#0d1b2a 60%,#0a1020);font-family:'Noto Sans CJK JP',sans-serif;color:#a8d8ea;display:flex;align-items:center;gap:56px;padding:0 90px;box-sizing:border-box">
    <img src="${img}" style="width:260px;height:260px;border-radius:56px;box-shadow:0 0 60px rgba(79,195,247,.3)">
    <div><div style="font-size:84px;font-weight:300;letter-spacing:.08em">眠りの音</div>
    <div style="font-size:30px;color:#6a9ab8;margin-top:14px;letter-spacing:.05em">雨音・波音・焚き火・ノイズを重ねて</div>
    <div style="font-size:24px;color:#3e6680;margin-top:12px;letter-spacing:.12em">SLEEP SOUNDS</div></div></body></html>`);
  await fg.waitForTimeout(300);
  await fg.screenshot({ path: path.join(out, 'feature-graphic.png') });
  await b.close();
  console.log('saved to docs/store/');
})();
