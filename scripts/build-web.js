// Web 版（Vercel）とアプリ（Android）に使うファイルを www/ にまとめる
//   npm run build     … Web 版用。そのままコピーする
//   npm run build:app … アプリ用。Web 版だけの部分（他のストアへのリンクなど）を取り除く
// Web 版だけの部分は目印で囲む: HTML は <!-- web-only --> … <!-- /web-only -->、
// JS は // web-only:start … // web-only:end、CSS は /* web-only:start */ … /* web-only:end */
// （アプリの中に、画面に出ないのにコードとして残っている機能があると、ストアの審査で
//  「審査で見えない機能」と判断されることがあるため。App Store Guideline 5.6）
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const out = path.join(root, 'www');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out);
for (const item of ['index.html', 'css', 'js', 'icon.svg']) {
  const src = path.join(root, item);
  if (fs.existsSync(src)) fs.cpSync(src, path.join(out, item), { recursive: true });
}

const app = process.argv.includes('--app');
if (app) {
  const strip = {
    '.html': /[ \t]*<!-- web-only -->[\s\S]*?<!-- \/web-only -->[ \t]*\n?/g,
    '.js': /[ \t]*\/\/ web-only:start[\s\S]*?\/\/ web-only:end[ \t]*\n?/g,
    '.css': /[ \t]*\/\* web-only:start \*\/[\s\S]*?\/\* web-only:end \*\/[ \t]*\n?/g,
  };
  // 取り除き忘れがあればビルドを止める
  const banned = [/play\.google\.com/i, /apps\.apple\.com/i, /web-only/];
  const problems = [];
  const walk = dir => {
    for (const name of fs.readdirSync(dir)) {
      const file = path.join(dir, name);
      if (fs.statSync(file).isDirectory()) { walk(file); continue; }
      const re = strip[path.extname(name)];
      if (!re) continue;
      const text = fs.readFileSync(file, 'utf8').replace(re, '');
      fs.writeFileSync(file, text);
      for (const b of banned) if (b.test(text)) problems.push(`${path.relative(out, file)}: ${b}`);
    }
  };
  walk(out);
  if (problems.length) {
    console.error('アプリ用のビルドに Web 版だけの部分が残っています:\n  ' + problems.join('\n  '));
    process.exit(1);
  }
}

// Google Play 用のビルドでは本番の広告を使う
const mode = process.env.ADMOB_MODE === 'production' ? 'production' : 'test';
fs.writeFileSync(path.join(out, 'js', 'ads-config.js'), `// ビルド時に生成\nwindow.AD_MODE = '${mode}';\n`);
// 画面の下に出すバージョン（CI では VERSION_NAME / VERSION_CODE を使う）
const version = process.env.VERSION_CODE
  ? `v${process.env.VERSION_NAME || require('../package.json').version} (build ${process.env.VERSION_CODE})`
  : 'dev';
fs.writeFileSync(path.join(out, 'js', 'build-info.js'), `// ビルド時に生成\nwindow.APP_VERSION = '${version}';\n`);
console.log(`built web assets into www/ (${app ? 'app' : 'web'}, ads: ${mode}, version: ${version})`);
