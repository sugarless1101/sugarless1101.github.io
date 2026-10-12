# 内容の更新の手引き

内容は `index.html` にあります。変更する前に `DESIGN.md` を読み、対象の項目だけを編集します。作品の目次・番号、年譜の絞り込みボタン・件数は `main.js` がページを開いたときに作ります。内容を変更したらページを再読み込みしてください。

## 制作

`#projects` の `<ol class="works">` 内に、次の `li` を追加します。並び順が目次と番号の順になります。ひな形の題名・説明・URL は、確認済みの内容に置き換えてください。

```html
<li class="work" id="work-example">
  <span class="work-number" aria-hidden="true"></span>
  <div class="work-copy">
    <h3><a href="https://example.com/">
      作品の題名
      <svg class="outward" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true" focusable="false"><path d="M3 11 11 3M3 3h8v8"/></svg>
    </a></h3>
    <p class="medium" lang="en">使用した技術</p>
    <p class="lead">作品の短い説明</p>
    <div class="desc"><p>確認済みの詳細。</p></div>
  </div>
</li>
```

- 追加：`id` はページ全体で重ならない名前にします。省略すると `work-01` のような順番の名前が付きます。既存の ID と重なる場合は末尾に枝番が付きます。外部や年譜からリンクする作品には、順番を変えても保てる ID を明記してください。
- 修正：`h3` が目次の文字と読み上げ名の元です。矢印の SVG は目次から除かれます。目次・番号を別に編集する必要はありません。リンクのない作品は `h3` に題名だけを書けます。不要な説明の段落は省略できます。
- 削除：対象の `li.work` 全体を消します。削除した ID や、その作品内の別名アンカー（`anchor-alias`）へのリンクが残っていないか検索してください。既存 ID は不用意に変えません。

番号は 01、02…と自動で付き、読み上げからは隠れます。目次が電線に収まらない場合や狭い画面では「制作 · N works」にまとめます。

## 登壇

`#talks` の `<ul class="appearances">` に次の `li` を追加します。日付・イベント名・題名・URL・説明を置き換えます。`datetime` は機械が読める日付です。

```html
<li class="appearance">
  <h3><a href="https://example.com/slides">
    登壇の題名
    <svg class="outward" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true" focusable="false"><path d="M3 11 11 3M3 3h8v8"/></svg>
  </a></h3>
  <p class="lead"><time datetime="2026-10-04">2026.10.04</time> · <a href="https://example.com/event">イベント名</a> にて登壇</p>
  <p class="medium" lang="en">扱った分野・技術</p>
  <p class="talk-description">確認済みの登壇内容。</p>
  <p class="lead"><a href="https://example.com/slides">登壇資料</a> · <time datetime="2026-10-07">2026.10.07</time> 公開</p>
</li>
```

修正は対象の `li.appearance` 内で行い、削除はその `li` 全体を消します。年譜にも同じ登壇の記録がある場合は、必要な修正を両方に反映します。資料未公開などで事実がない欄は省略します。

## 年譜

`#timeline .history` の該当年の `<ol class="events">` に、出来事を追加します。

```html
<li data-cat="制作・報告">
  <time datetime="2026-10">2026.10</time>
  <div class="event-copy">
    <a href="https://example.com/">確認済みの出来事</a> 公開
    <span class="sub">補足がある場合</span>
    <p class="note">必要な詳細。</p>
  </div>
</li>
```

新しい年は、次のまとまりごと追加します。日付に合わせて既存の並びに挿入してください。出来事の `li` は必ず `ol.events` の中に置きます。

```html
<div class="year-group">
  <h3><time datetime="2027">2027</time></h3>
  <ol class="events">
    <li data-cat="登壇">
      <time datetime="2027-01">2027.01</time>
      <div class="event-copy">確認済みの出来事</div>
    </li>
  </ol>
</div>
```

修正は出来事の `li` 内で行います。削除はその `li` 全体を消し、出来事がなくなった年は `year-group` ごと消します。予定には `class="planned"` と「予定」の補足を付け、実績と区別します。

分類は `data-cat` に1つ書きます。既存の分類の優先順は次のとおりです。

1. 学校
2. 資格
3. 仕事・インターン
4. CTF・ハッカソン
5. 制作・報告
6. イベント・コミュニティ

「すべて」の後には、実際に使われている分類だけがこの順で並びます。「登壇」など新しい分類は、出来事で最初に出た順でその後ろに追加されます。分類を追加するために `main.js` を変える必要はありません。表記違いや前後の余分な空白は別の分類になるので、同じ分類には同じ文字を使います。`data-cat` を省略した出来事は「すべて」でだけ表示されます。「すべて」は絞り込み用の名前なので、出来事の分類には使いません。件数は表示中の出来事の数です。

## リンク

`#links` の `<ul class="links">` に追加します。`href` は実際の行き先、`link-url` は画面に表示する URL です。両方を確認してください。

```html
<li><a href="https://example.com/profile">
  <span class="link-name" lang="en">リンクの名前</span>
  <span class="link-url" lang="en">example.com/profile</span>
  <svg class="outward" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true" focusable="false"><path d="M3 11 11 3M3 3h8v8"/></svg>
</a></li>
```

日本語の名前では `lang="en"` を外します。修正は対象の `li` 内で行い、削除はその `li` 全体を消します。既存の文や行き先を、内容更新と関係なく変更しません。

## 日本語の区切り

`.phrase` は任意です。意味のまとまりを囲むと、そのまとまりの間で折り返します。

```html
<p class="lead"><span class="phrase">脆弱性情報</span>を絞り込み、<span class="phrase">分析結果</span>を読む</p>
```

文全体や長すぎる句を1つの `.phrase` にしません。通常の日本語の区切りは維持され、長い英字の題名・識別子・URL は必要に応じて途中で折り返します。HTML の文字として `&` は `&amp;`、`<` は `&lt;` と書きます。

## 画像

画像は WebP を使い、`images/` 内の役割に合う場所に置きます。空や電灯の層は `images/layers/`、器具や鳥などは `images/fixtures/`、最後の積乱雲は `images/cumulonimbus/` です。内容用の新しい画像は、必要なら `images/content/` を作って置きます。名前と参照は大文字・小文字まで合わせます。

```html
<img src="images/content/example.webp?v=23" width="1200" height="800" alt="画像が伝える内容" decoding="async" loading="lazy">
```

幅と高さは実際の画像に合わせ、装飾画像なら `alt=""` にします。新しい要素を置くときは、手元で大きさと折り返しも確認します。既存の器具を差し替える場合は、昼夜・縦横・1倍と2倍・マスクなど関連する画像も確認してください。

上部の電灯（`lamp-tall*`・`lamp-wide*`・`lamp-glass-mask-*`）、電柱（`pole*`）、車両用信号（`signal-*`）は、`images/masters/` の元画像から `python tools/build-fixture-images.py` で作ります。配信用のファイルを直接編集しないでください。電灯は、表示する範囲（`main.js` の `lb`・`dg`・`gb` と `pad`）だけを切り抜くので、範囲を変えるときはツールと `main.js` の両方を同じ値にします。

画像を追加・差し替えたら、リポジトリのルートで次を行います。

1. `main.js` 先頭の `IMAGE_VERSION` を上げます（例：`'22'` → `'23'`）。
2. `node tools/version-images.mjs` を実行します。HTML/CSS の画像 URL に `?v=` の版の印を付け、版をそろえます。`index.html` が読む `style.css` と `main.js` の版の印（中身から作る）も更新します。
3. `node tools/version-images.mjs --check` で確認します。

JavaScript が作る画像 URL には `?v=${IMAGE_VERSION}` を付けます。版の印はキャッシュを更新するためのもので、ファイル名は変えません。

`style.css` や `main.js` だけを変えたときも、`node tools/version-images.mjs` を実行してください。版の印が古いままだと、ブラウザが前の CSS や JS を使い続けることがあります（GitHub Pages は 10 分キャッシュされます）。`--check` は、版の印が古いと失敗します。

## 書体

書体の指定は `fonts.css` にあります（Google Fonts の CSS を保存したもの）。書体や太さを足すときは、`tools/fetch-fonts-css.mjs` の `families` を変えて `node tools/fetch-fonts-css.mjs` を実行し、`node tools/version-images.mjs` で版の印を更新します。Google Fonts の CSS を `index.html` から直接読む形には戻さないでください（その接続が詰まると、ページが真っ白のまま止まります）。

## 更新後の確認

ルートで `python tools/check-paths.py` と `node tools/version-images.mjs --check` を実行します。参照ファイルの不足・大文字小文字の違い・版の不一致を直してください。`check-paths.py` は通信せず、JavaScript の既知の画像の組み立ても展開して調べます。画像の組み立て方を変えて「Unsupported image expression」が出た場合は、検査を飛ばさずツールにも新しい規則を追加します。外部リンクの有効性は別途確認します。

表示を確かめるときは、`python tools/serve.py 4175 .` で配信します。同時に複数の画像を要求できるサーバーです。昼夜、デスクトップとスマホ、長い題名や URL、目次の行き先、番号、分類と件数、最後までのスクロール、コピーとページ内検索を確認します。

ブラウザを起動できる環境の担当者は、初回に `npm install --prefix tools` と `npx --prefix tools playwright install chromium` で準備し、`node tools/smoke.mjs` を実行します。既定の URL は `http://127.0.0.1:4175/` です。別の URL は環境変数 `BASE` に設定します。PowerShell の例：

```powershell
$env:BASE = 'http://127.0.0.1:4175/'
node tools/smoke.mjs
```

このツールは Chromium を起動し、使えなければ Edge を起動します。昼夜 × 1920×1080（密度1）／390×844（密度3）で通信・ページエラー・電灯・スクロール・メニューの夜切り替えを確認し、失敗があれば終了コード1になります。ブラウザ起動禁止の実行環境では実行せず、ブラウザの検査担当者に渡します。自動検査だけでは見た目の確認は完了しません。

GitHub Pages は `main` へのプッシュで更新されます。確認を終えてから、通常の公開手順で反映します。`.nojekyll` は残してください。

## 内容の更新でしてはいけないこと

- 確認していない事実・実績・予定を足さない。
- 実績や担当範囲を誇張しない。詩的な文や宣伝文に書き換えない。
- 既存の文とリンクを、依頼なく変更しない。
- 個人の端末の場所、内部の作業名、未公開情報を公開リポジトリの文書に書かない。

コミットにはユーザーが設定している Git の名前とメールアドレスを使い、共同著者・署名・クレジットを勝手に追加しません。
