# ANYWAY — coffee EC site

コーヒーブランド「ANYWAY」のECサイト プロトタイプ。

## ファイル構成

```
hysd/
├── index.html      # TOPページ（ヒーロー / Why / 商品グリッド / About / フッター）
├── product.html    # 商品詳細ページ（Brew No.07 / Ethiopia をサンプルに）
└── README.md       # このファイル
```

## デザイン仕様

### カラー
- 背景: `#FAFAF7`（オフホワイト）
- 商品プレースホルダ: `#F1EFE8`（温かいグレージュ）
- テキスト: `#001829`（ブランドネイビー）
- アクセント: `#E6FD28`（ブランド黄緑）
- ブラウン: `#B08650`（4色目アクセント）

### フォント
- メイン: Quiroh（実装時は購入後 `@font-face` で読み込み、フォールバックは Space Grotesk）
- サブ: Source Serif Pro（Google Fonts から読み込み済み）

### イージング
- 全体の transition は `cubic-bezier(0.16, 1, 0.3, 1)` に統一
- ふわっと出てすーっと止まるシルキーな動き

## 主な機能

### TOPページ (`index.html`)
- ロゴホバーで左から黄色がスライドイン（隙間なし）
- 商品グリッド：1段目4商品均等、2段目以降サイズ違いでリズム配置
- 商品ホバー時に黄色い「View more」円カーソルが追従
- About セクションの「Read more about us」ボタンがマウスに追従

### 商品詳細ページ (`product.html`)
- 左カラム sticky（商品画像 / 価格 / Size / Grind / Add to Bag）
- 右カラムスクロール（CMSブロック配列駆動の読み物）
- 画像は右カラム幅いっぱいに表示
- ストーリー終了で左右一緒にスクロールアウト → 関連商品セクションへ
- Add to Bag ボタンは左から黄色塗りつぶしのホバー演出

## CMS連携の準備

### 安全寄りの接続方法
- ブラウザから直接 `microCMS` を叩かず、ローカルの Node サーバー経由で取得
- `X-MICROCMS-API-KEY` は `.env` に保持し、HTML/JSには出さない
- フロントは `/api/products` と `/api/products/:id` を読むだけの構成

#### 起動手順
```bash
cp .env.example .env
# .env に microCMS の値を記入
npm start
```

サーバー起動後:
- TOP: `http://127.0.0.1:8000/index.html`
- 詳細: `http://127.0.0.1:8000/product.html?id=p01`

### TOPページの商品データ
`index.html` 内の `PRODUCTS` 配列を CMS API から fetch するように差し替え：

```javascript
// 現状（ハードコード）
const PRODUCTS = [
  { id: "p01", name: "Brew No.07", italic: "Ethiopia", category: "coffee", price: 1800, ... },
  ...
];

// CMS連携後
const res = await fetch('https://your-microcms.io/api/v1/products', {
  headers: { 'X-MICROCMS-API-KEY': API_KEY }
});
const PRODUCTS = (await res.json()).contents;
```

### 商品詳細ページのストーリーブロック
`product.html` 内の `BLOCKS` 配列で順番入れ替え可能。ブロック種類：

| type | 用途 | フィールド |
|---|---|---|
| name | 商品名見出し | `eyebrow`, `title`, `titleEm` |
| lead | リード文 | `text` |
| body | 本文段落 | `text` |
| pull | プルクオート | `text`, `size?` |
| image | 画像 | `aspect`(wide/tall/square), `color`, `url?` |
| caption | 画像キャプション | `text` |
| spec | スペック表 | `items: [{label, value}]` |

CMS（microCMS推奨）でこれらをドラッグ&ドロップで並び替え可能なフィールドとして定義すれば、編集者が管理画面から自由にレイアウトできる構成。

## Stripe連携の準備

`product.html` の `addBtn` クリックハンドラに結線ポイントあり：

```javascript
addBtn.addEventListener("click", () => {
  // state.size と state.grind の組み合わせで Stripe priceId を引く
  // stripe.redirectToCheckout({ lineItems: [{ price: priceId, quantity: 1 }] })
});
```

商品ごとに Stripe で4パターン（200g whole / 200g medium / 500g whole / 500g medium）の Price を作成して、`state` から priceId を解決する形が定石。

### 本番用 Stripe Checkout URL

Stripe Checkout の `success_url` / `cancel_url` は、`.env` の `SITE_URL` を基準に生成される。未設定の場合はリクエスト元の URL を使う。

```bash
SITE_URL=https://example.com
STRIPE_SECRET_KEY=sk_live_your_secret_key
STRIPE_SHIPPING_RATE_ID=shr_your_live_shipping_rate_id
```

個別に戻り先を指定したい場合は、`STRIPE_SUCCESS_URL` / `STRIPE_CANCEL_URL` を設定すると `SITE_URL` より優先される。

## レスポンシブ対応

- モバイル: ~768px
- タブレット: 768px ~ 1280px  
- デスクトップ: 1280px ~

## ブラウザ対応

モダンブラウザ（Chrome / Safari / Firefox / Edge の最新版）対象。
`prefers-reduced-motion` 対応でアニメーション抑制も実装済み。

## Cloudflare Pages + Functions

Cloudflare Pages では、静的ファイルをそのまま配信し、`/api/*` だけを Pages Functions で処理する。

### ローカル確認

```bash
cp .dev.vars.example .dev.vars
# .dev.vars に microCMS / Stripe の値を記入
npm run cf:dev
```

### デプロイ

```bash
npm run cf:deploy
```

Cloudflare Dashboard から GitHub 連携で公開する場合は、Build command は `exit 0`、Build output directory はリポジトリルートを指定する。環境変数は Pages の Settings > Variables and Secrets で設定する。
