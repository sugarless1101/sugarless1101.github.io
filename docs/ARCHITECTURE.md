# コードの地図

このサイトは HTML、CSS、JavaScript をそのまま配信する静的サイトです。ビルドは不要です。GitHub Pages は `main` の更新を反映し、`.nojekyll` によって Jekyll の処理を避けます。内容の変更手順は [CONTENT.md](CONTENT.md)、見た目の決まりは `DESIGN.md` にあります。

## ファイルの構成

| 場所 | 役割 |
| --- | --- |
| `index.html` | 内容、見出し、作品・登壇・年譜・リンク、画像の土台、メニュー、電線 SVG の入れ物。冒頭の短いスクリプトは保存された昼夜を初期表示に反映する。 |
| `style.css` | 色・フォント・余白のトークン、レイアウト、文字と器具の表示、昼夜、画面幅と動きを減らす設定の規則。 |
| `main.js` | 即時実行関数内で DOM を組み立て、位置を測定し、操作と演出を動かす。外部ライブラリへの依存はない。 |
| `images/` 直下 | 空の背景画像や月など、共通の画像。 |
| `images/layers/` | 上部の空・雲・電灯と、最後の電灯。縦横、昼夜、解像度、消灯、光、マスクの派生画像。 |
| `images/cumulonimbus/` | 最後の積乱雲の base/body/top/wisps。昼夜と解像度違い。 |
| `images/fixtures/` | 電柱・車両用信号などの器具。 |
| `images/fixtures/wire-parts/` | 電線に付く金具の昼夜画像。 |
| `images/fixtures/birds/` | スズメの止まり姿勢、離陸、羽ばたきの画像。 |
| `images/fixtures/paper-plane/` | 紙飛行機の左右のロール姿勢。 |
| `images/fixtures/ped-signal/` | 最後の歩行者用信号の消灯・点灯姿勢と昼夜・解像度違い。 |
| `tools/` | 画像版の同期、パス検査、同時接続できる手元の配信サーバー、ブラウザの smoke 検査。Playwright は検査用の依存で、サイトでは使わない。 |
| `docs/` | 内容の更新手順と、このコードの地図。 |

## main.js の主な仕組み

行番号は編集で動くため、以下の関数名・識別子を検索して場所を探してください。表はファイルの前半から後半へ、おおむね実装順に並べています。

| 場所の目印 | 仕組み |
| --- | --- |
| 冒頭：`IMAGE_VERSION`、`buildWorkNavigation` | 画像の版を管理する。`li.work` の DOM 順から ID・2桁番号・SVG の目次と作品数を作る。題名は文字分割前の `h3` から取り、矢印を除き空白を整える。リンクの操作登録より先に実行する。 |
| `Spring` | 周波数・減衰・振幅制限を持つばね。器具の応答や電線の固有モードに使う。 |
| `windState`、`beginWind`、`stepWind`、`windStrength` | 共通の風。雲・電線・鳥・飛行機が同じ風の状態を参照する。 |
| `layerPicture`、`lampControl`、`composeTopLight` | 上部の画像層と電灯の点消灯。点灯時の立ち上がり、消灯時の残光、操作の判定をまとめる。 |
| `morseCode`、`startMorse`、`morseLevel` | 電灯の HELLO のモールス。電灯の状態と可視性を確認し、専用の描画経路から明るさを合成する。 |
| `applyMode`、`toggleNightMode`、`nightMix`、`pairPhoto`、`pairBackground`、`paintMode` | `data-mode` とセッション保存、月とメニューのボタン、昼夜の画像の重ねと切り替え。毎フレームに画像の URL を差し替えない。 |
| `createLamp`、`paintLamp`、`paintLampElements` | 器具・内容・リンクの光の状態を管理。ポインタ、フォーカス、タッチからの反応を共有する。 |
| `paintSignal`、`paintYellow`、`reactSignal` | 登壇の横にある信号。昼の青信号、夜の黄色の点滅、器具の揺れ。 |
| `cloudDescent`、`paintCloudDescent` | 上部の雲が下がる演出。文字や帯の位置は測定時に決める。 |
| `fitFlows`、`paintFlows` | 雲の流れをタイルで更新。画面幅や画像の大きさをキャッシュして使う。 |
| `textNodes`、`readingPhrases`、`splitCharacters`、`splitLines` | 題名の文字、技術の語、本文の行などを分割し、表示と操作の演出に使う。長い英字のまとまりは必要なら折り返す。 |
| `splitSource`、`sourceText`、`coalesceSplitSources`、`fitSplitSources`、`restingTextRect` | 見た目用の分割文字は読み上げから隠す。元の連続文字を `.split-source` として重ね、読み上げ・コピー・ページ内検索を保つ。位置を合わせる処理は演出の変位を差し引く。 |
| `wireDefinitions`、`catenary`、`wireRestY`、`wireDisplacement`、`projectedWirePoint`、`drawWires`、`stepWires` | 制作の上の電線。カテナリーで静止曲線を作り、弦のモードと風・ばねの変位を重ねる。端点と金具は同じ曲線から求める。 |
| `fitWires` | 電柱と電線、目次の配置。`refreshGeometry` から呼ばれ、SVG の見えない測定用文字で長さを一度読み、収まらなければまとめた表示にする。測定のために表示モードを切り替えない。 |
| `projectSpan`、`finalSpan`、`fitFinalSpan`、`drawFinalWires` | 制作と最後の径間で電線の物理・鳥・光の粒を共有する。最後の径間はリンクやフッターの配置から位置を決める。 |
| `pedState`、`paintPedestrian` | 最後の「ページ先頭へ」に対応する歩行者用信号。ポインタ・フォーカスと先頭へ戻る操作に応答する。 |
| `spritePoses`、`fitBirds`、`launchBird`、`paintBirds` | 電線に止まる鳥。止まる場所は文字を避けて測定時に決め、画像姿勢を重ねて羽ばたかせる。 |
| `cacheWireArc`、`sendWirePacket`、`paintPackets` | 電線の光の粒。目次のポインタ・フォーカス・クリックから要求を出し、作品への応答を返す。リンク位置と弧長を測定時にキャッシュする。 |
| `spawnFirework`、`drawFirework`、`paintFireworks`、`clearFinalEffects` | 夜の最後の場面の花火。文字・空の領域を避けて出し、画面外や昼夜切り替えで後始末する。 |
| `refreshGeometry`、`geometry`、`queueGeometry`、`layoutBox` | 位置の一度読みのキャッシュ。画像・文字・電線・画面の位置を測り、毎フレームの計算に渡す。リサイズ・フォント読み込み・絞り込みなどの後に再測定する。 |
| `observer`、`renderObserver`、`inView`、`syncSceneDormancy`、`visibleAnimation` | 画面内外を管理する。画面外の所有者の演出を休止し、再表示時に使える土台を残す。 |
| `spawnContrail`、`paintWindowTrails`、`paintContrailGlints` | 空や窓の飛行機雲と、その光。文字との間隔を測定済みの領域から計算する。 |
| `spawnFlock`、`paintFlocks` | 空を飛ぶ鳥の群れ。近くの鳥・空の範囲・風を使って進む。 |
| `planePhysicsParameters`、`createPlaneGlider`、`projectPlaneGlider`、`stepPlaneGlider`、`spawnPaperPlane`、`paintPaperPlanes` | 紙飛行機の滑空。速度・姿勢・揚力・抗力・投影を計算し、風や旋回を加える。`checkPlaneCollision`、`strikePlane`、`paintFallingPlane` が電線や鳥との衝突と落下を扱う。 |
| `syncMotion`、`tick` | `requestAnimationFrame` の入口。キャッシュを参照し、可視の場面だけの時計と動きを進める。メニューを開いている間やタブ非表示中は停止する。 |
| `sizeStars`、`spawnMeteor`、`drawStars`、`paintNightSky` | 星と流れ星の canvas。大きさは測定時に設定し、可視の夜の場面だけ更新する。 |
| `commandKeys`、`runSkyCommand`、`chooseFormationRoute` | 隠しコマンド（↑↑↓↓←→←→BA）。表示中の場面と昼夜に合わせ、鳥・紙飛行機の編隊・流れ星を出す。 |
| `openMenu`、`closeMenu`、`preferredCategories`、`usedCategories`、`setCount` | メニューとフォーカスの管理、年譜の分類・件数。既知の分類は優先順、追加分類は出来事での初出順。分類のない出来事は「すべて」で表示する。 |
| `applyReducedMotion`、`scheduleSteadyPaint` | 動きを減らす設定の変更に応答し、安定した表示を描画する。 |
| 末尾：`window.__motionDebug` | 検査用の状態・計算結果・操作への入口。電灯・風・雲・信号・鳥・飛行機・電線などを観測できる。関数や getter の中には明示的に位置を測るものがあり、通常の毎フレーム処理から呼ばない。 |

## 守るべき約束

- 毎フレームに位置や計算済みスタイルを読まない。`getBoundingClientRect`、`getClientRects`、`getBBox`、SVG の文字幅・弧長、`offset*`、`client*` などの測定は `refreshGeometry` とその測定処理、必要な文字位置の再調整にまとめ、結果をキャッシュする。
- 測定のためにクラスや表示状態を切り替えない。書き込み・測定を往復しない。見えない目次の文字幅は、同じ書体の独立した測定用 SVG 文字で読む。
- DOM の動きは `transform` と `opacity` を使う。電線 SVG や星・花火の canvas は既存の専用描画経路を使い、レイアウトを変える動きを追加しない。画像の読み込みや姿勢の準備は描画ループの外で行う。
- 画面外では休む。`inView` と所有者を使い、非表示のタブや開いているメニューにも対応する。土台の空・雲・電灯などの画像を休止のために隠さない。
- `prefers-reduced-motion` を尊重する。新しい演出にも停止と安定表示、切り替え時の後始末を用意する。
- 明滅は1秒に3回以下にする。信号、電灯、モールスなどを変更するときは同時に出る光も確認する。
- 分割文字だけを残さない。読み上げ名、コピー、検索のための元の文字列と、その位置合わせを保つ。
- ポインタとフォーカスの両方を維持する。生成された目次のリンクも、光の粒と電灯の既存の登録処理を通す。
- 公開文書には、個人の端末の場所、内部の作業名、未公開情報を含めない。

内容の追加・削除後は `tools/check-paths.py`、画像版の検査、ブラウザを起動できる担当者による `tools/smoke.mjs` と目視確認を行います。ブラウザ起動禁止の環境では Node/Python の静的・DOM 検査までとし、ブラウザ検査は実行しません。
