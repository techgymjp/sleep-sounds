// アプリ（Android）だけの処理: バックグラウンド再生・戻るボタン・広告。Web 版では「広告の設定」以外は何もしない
(() => {
  // EU など同意が必要な地域では「広告の設定」を出す
  Ads.initDone.then(() => { if (Ads.privacyOptionsRequired) $('adPrivacy').classList.remove('hidden'); });
  $('adPrivacyLink').addEventListener('click', e => { e.preventDefault(); Ads.showPrivacyOptions(); });

  const cap = window.Capacitor;
  const native = !!(cap && cap.isNativePlatform && cap.isNativePlatform());
  if (!native) return;
  const P = cap.Plugins;

  // ── バックグラウンド再生 ──────────────────────────────────────────────
  // 鳴らしているあいだは Android の「再生中」の通知を出し（フォアグラウンドサービス）、
  // 画面を消したりほかのアプリに切り替えたりしても音が止まらないようにする（MainActivity.java の BackgroundAudio）
  const Bg = P.BackgroundAudio;
  Sound.hooks.onChange = on => {
    if (!Bg) return;
    if (on) Bg.start({ title: L('眠りの音', 'Sleep Sounds'), text: L('再生中', 'Playing') }).catch(() => {});
    else Bg.stop().catch(() => {});
  };
  // 通知の「停止」を押されたら止める
  if (Bg) Bg.addListener('stopRequested', () => Sound.stopAll());

  // ── 戻るボタン ────────────────────────────────────────────────────────
  // 再生中はアプリを閉じずに裏に回して鳴らし続ける。止まっていればアプリを終了する
  if (P.App) {
    P.App.addListener('backButton', () => {
      if (Sound.playing) P.App.minimizeApp(); else P.App.exitApp();
    });
  }

  // ── 広告 ──────────────────────────────────────────────────────────────
  // バナー: 画面の下中央にいつも出す
  // 全画面広告: 止まっている状態から鳴らし始めるとき（▶・プリセット・音のスイッチ）。
  //            一時停止と再開をくり返したときに何度も出ないよう、前に出してから 3 分は出さない
  // リワード広告: 見ると 8 時間、バナーと全画面広告を出さない（寝ているあいだ画面に広告が出ない）
  const AD_FREE_MS = 8 * 60 * 60 * 1000;
  const START_AD_GAP_MS = 3 * 60 * 1000;
  const KEY = 'sleepSounds.adFreeUntil';
  let adFreeUntil = 0;
  try { adFreeUntil = +localStorage.getItem(KEY) || 0; } catch (e) {}
  let lastStartAd = 0;
  const adFree = () => Date.now() < adFreeUntil;

  Sound.hooks.onStart = () => {
    if (adFree() || !Ads.interstitialReady) return;
    if (Date.now() - lastStartAd < START_AD_GAP_MS) return;
    lastStartAd = Date.now();
    Sound.suspend();          // 広告が閉じるまで音を出さない（閉じたら ads.js が Sound.resume() で鳴らす）
    Ads.showInterstitial();
  };

  const box = $('noAds'), btn = $('noAdsBtn'), msg = $('noAdsMsg');
  btn.textContent = L('🎬 広告を見て 8 時間 広告なし', '🎬 Watch an ad for 8 hours ad-free');
  let msgTimer = null;

  function render() {
    const free = adFree();
    Ads.setBanner(!free);
    document.body.classList.toggle('has-banner', !free && Ads.available);
    box.classList.toggle('hidden', !Ads.canReward);
    btn.classList.toggle('hidden', free);
    if (free) {
      const min = Math.ceil((adFreeUntil - Date.now()) / 60000);
      const h = Math.floor(min / 60), m = min % 60;
      msg.textContent = L(`広告なし: あと ${h} 時間 ${m} 分`, `Ad-free: ${h}h ${m}m left`);
      msg.classList.remove('hidden');
    } else if (!msgTimer) {
      msg.classList.add('hidden');
    }
  }

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    const result = await Ads.showRewarded();
    btn.disabled = false;
    // 最後まで見たときだけ広告なしにする
    if (result === 'rewarded') {
      adFreeUntil = Date.now() + AD_FREE_MS;
      try { localStorage.setItem(KEY, String(adFreeUntil)); } catch (e) {}
    } else if (result === 'unavailable') {
      msg.textContent = L('広告を読み込めませんでした。少し待ってからお試しください', 'Could not load an ad. Please try again later.');
      msg.classList.remove('hidden');
      clearTimeout(msgTimer);
      msgTimer = setTimeout(() => { msgTimer = null; render(); }, 4000);
    }
    render();
  });

  render();
  Ads.initDone.then(render);
  setInterval(render, 30000);
})();
