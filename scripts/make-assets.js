// icon.svg から、アイコンと起動画面の元画像（assets/*.png）を作る（Playwright が必要）
//   node scripts/make-assets.js && npx @capacitor/assets generate --android --iconBackgroundColor '#080818' --splashBackgroundColor '#080818'
const { chromium } = require('playwright');
const fs = require('fs');
const root = require('path').join(__dirname, '..');
const svg = fs.readFileSync(root + '/icon.svg', 'utf8');
const inner = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
const defs = inner.match(/<defs>[\s\S]*?<\/defs>/)[0];
const art = inner.replace(defs, '').replace(/<rect[^>]*\/>/, '');
const BG = `<rect width="512" height="512" fill="url(#bg)"/>`;
const mk = (body, vb = '0 0 512 512') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}">${defs}${body}</svg>`;
const shots = [
  ['icon-only.png', 1024, mk(BG + art), false],
  ['icon-background.png', 1024, mk(BG), false],
  // 前景はアダプティブアイコンの安全域に収める（生成される ic_launcher.xml でさらに 66% に縮む）
  ['icon-foreground.png', 1024, mk(`<g transform="translate(256 256) scale(.86) translate(-256 -256)">${art}</g>`), true],
  ['splash.png', 2732, mk(`<rect x="-2000" y="-2000" width="4512" height="4512" fill="#080818"/><g transform="translate(256 256) scale(.2) translate(-256 -256)">${inner.replace(defs,'')}</g>`), false],
];
(async () => {
  const b = await chromium.launch();
  for (const [name, size, s, transparent] of shots) {
    const p = await b.newPage({ viewport: { width: size, height: size } });
    await p.setContent(`<html><body style="margin:0;background:transparent">${s.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
    await p.screenshot({ path: `${root}/assets/${name}`, omitBackground: transparent });
    await p.close();
  }
  fs.copyFileSync(`${root}/assets/splash.png`, `${root}/assets/splash-dark.png`);
  await b.close();
})();
