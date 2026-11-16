# Google Play ストア掲載情報（下書き）

Play Console の「ストアの掲載情報」に貼り付けて使います。既定の言語を日本語にし、「翻訳を管理」から英語（en-US）を追加してください。

## 画像（このフォルダ）

| 用途 | ファイル | サイズ |
| --- | --- | --- |
| アプリのアイコン | `icon-512.png` | 512 × 512 |
| フィーチャー グラフィック | `feature-graphic.png` | 1024 × 500 |
| スマートフォンのスクリーンショット（日本語） | `ja-1-deep-sleep.png` 〜 `ja-4-mix.png` | 1080 × 1920 |
| スマートフォンのスクリーンショット（英語） | `en-1-deep-sleep.png` 〜 `en-4-mix.png` | 1080 × 1920 |

撮り直すとき: `npm run build` → `node scripts/store-shots.js`（Playwright が必要）

## 日本語（ja-JP）

**アプリ名**（30 字以内）

```
眠りの音 - 雨音・波音・ホワイトノイズ
```

**簡単な説明**（80 字以内）

```
雨音・波音・焚き火・ノイズ・バイノーラルビートを重ねて、自分だけの眠りの音を。画面を消しても鳴り続けます。
```

**詳しい説明**（4000 字以内）

```
「眠りの音」は、眠る前やリラックスしたいときに流す音を、自分で重ねて作れるアプリです。

すべての音はアプリの中でその場で作っています。録音を繰り返し流すのではないので、同じところで途切れたり、つなぎ目が聞こえたりしにくくなっています。ネットにつながっていなくても使えます。

■ 8 種類の音
・雨音 — ポツポツ降る雨のしずく。雨の強さと音の細かさを変えられます
・波音 — 寄せては返す波。波の速さを変えられます
・焚き火 — 炎のはぜる音。温かさ（こもり具合）を変えられます
・ホワイトノイズ／ピンクノイズ／ブラウンノイズ — まわりの雑音を目立たなくします
・バイノーラルビート — 左右の耳にわずかに違う高さの音を流します（ヘッドフォン推奨）
・ソルフェジオ — 高さがゆっくり上下するやわらかなドローン

■ すぐ使えるプリセット
深い眠り・瞑想・雨の夜・焚き火・海辺。押すだけで音の組み合わせが切り替わります。そこから好きな音を足したり、音量を変えたりできます。

■ おやすみタイマー
15 分・30 分・60 分・90 分。最後の 30 秒でゆっくり音が小さくなって止まります。

■ 画面を消しても鳴り続ける
再生中は通知に「再生中」が出て、画面を消しても、ほかのアプリを使っても音が止まりません。通知の「停止」でいつでも止められます。

■ 広告について
無料でお使いいただくため、広告を表示します。広告の動画を 1 本見ると、8 時間は広告が出なくなります（寝ているあいだに画面に広告が出ません）。

※ このアプリは医療機器ではありません。睡眠や健康についての効果を保証するものではありません。
```

## 英語（en-US）

**App name**（30 文字以内）

```
Sleep Sounds - Rain & Waves
```

**Short description**（80 文字以内）

```
Mix rain, ocean waves, campfire, noise and binaural beats. Plays with screen off
```

**Full description**

```
Sleep Sounds lets you build your own soundscape for sleep and relaxation by layering sounds.

Every sound is generated live inside the app, not looped from a short recording, so there are no audible seams. It works offline.

- 8 sounds
  - Rain: gentle raindrops, with adjustable intensity and fineness
  - Ocean waves: rolling waves, with adjustable speed
  - Campfire: crackling flames, with adjustable warmth
  - White, pink and brown noise: mask the noises around you
  - Binaural beats: slightly different tones in each ear (headphones recommended)
  - Solfeggio drone: a soft tone that slowly drifts up and down

- Ready-made presets
  Deep Sleep, Meditation, Rainy Night, Campfire and Seaside. Tap one to switch the mix, then add sounds or adjust volumes as you like.

- Sleep timer
  15, 30, 60 or 90 minutes. The sound fades out gently over the last 30 seconds.

- Keeps playing with the screen off
  While playing, a "Playing" notification appears and the sound continues even when the screen is off or you use other apps. Tap "Stop" in the notification at any time.

- About ads
  The app is free and shows ads. Watch one video ad to go ad-free for 8 hours, so no ads appear on screen while you sleep.

This app is not a medical device and does not guarantee any effect on sleep or health.
```

## 「アプリのコンテンツ」で答えること（ゲームのアプリとの違い）

- **アプリのカテゴリ**: アプリ（ゲームではない）→「健康＆フィットネス」または「ライフスタイル」
- **フォアグラウンド サービスの権限**: 「メディアの再生」（`FOREGROUND_SERVICE_MEDIA_PLAYBACK`）を使っている、と申告する
  - 説明の例: 「ユーザーが選んだ睡眠用の音を、画面を消したあとも再生し続けるために使います。再生中は通知を表示し、通知の停止ボタンかアプリの停止ボタンで止まります。」
  - 動作の動画（YouTube の限定公開など）の URL を求められたら、再生 → 画面を消す → 音が続く → 通知の「停止」で止まる、を撮る
- そのほか（プライバシーポリシー・広告・広告 ID・データセーフティ・ターゲット 13 歳以上）は JET STRIKE と同じ
