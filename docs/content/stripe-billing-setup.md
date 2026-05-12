# Stripe課金テスト手順

この手順は、Tanukiの3日間無料体験から月額課金へ進むCheckoutフローをテストするためのものです。

## 作成済みのStripeテスト商品

Stripeの接続先:

```text
NodeTech サンドボックス
```

作成済みの商品:

| 種類 | ID | 内容 |
|---|---|---|
| Product | `prod_UV3rryD3YXfhO5` | Tanuki Monthly Test |
| Price | `price_1TW3k6FoMeSHXxvJ8bPIsvHB` | 月額980円 / JPY / monthly |

3日間無料体験はPrice側ではなく、アプリのCheckout作成時に `trial_period_days: 3` として付与しています。

## 必要な環境変数

ローカルの `.env.local` と、Vercel Project SettingsのProduction/Previewに以下を設定します。

```text
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PRICE_ID=price_1TW3k6FoMeSHXxvJ8bPIsvHB
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_APP_URL=https://tanuki.nodetech.jp
```

注意:

- `STRIPE_SECRET_KEY` と `STRIPE_WEBHOOK_SECRET` は秘密キーです。GitHubには絶対にコミットしません。
- `STRIPE_PRICE_ID` は今回作成したテスト用Price IDを指定します。
- Vercelに環境変数を追加・変更した後は、Productionを再デプロイしてください。

## Webhook設定

Stripe DashboardでWebhook Endpointを追加します。

```text
https://tanuki.nodetech.jp/api/webhooks/stripe
```

購読状態の同期に必要なイベント:

```text
checkout.session.completed
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
```

Webhook作成後に表示される署名シークレット `whsec_...` を `STRIPE_WEBHOOK_SECRET` に設定します。

## ローカルでWebhookを試す場合

Stripe CLIを使う場合は以下です。

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

表示された `whsec_...` を `.env.local` の `STRIPE_WEBHOOK_SECRET` に入れます。

## テスト決済の流れ

1. アプリにメールアドレスとパスワードでログインします。
2. `3日間無料体験` ボタンを押します。
3. Stripe Checkoutへ遷移します。
4. テストカードで決済します。

テストカード:

```text
4242 4242 4242 4242
有効期限: 将来の日付
CVC: 任意の3桁
郵便番号: 任意
```

5. Checkout成功後、`/?checkout=success&session_id=...` に戻ります。
6. アプリ側の `/api/billing/sync-checkout` が購読情報を同期します。
7. `user_billing.subscription_status` が `trialing` または `active` になれば成功です。

Webhookが設定済みの場合、Stripe側の購読更新も `/api/webhooks/stripe` 経由で同期されます。

## 現在の実装

| ファイル | 役割 |
|---|---|
| `src/app/api/checkout/route.ts` | Stripe Checkout Sessionを作成 |
| `src/app/api/billing/sync-checkout/route.ts` | Checkout成功後に購読情報を同期 |
| `src/app/api/webhooks/stripe/route.ts` | Stripe Webhookで購読状態を同期 |
| `src/app/api/billing/portal/route.ts` | Customer Portalを開く |
| `src/lib/billing.ts` | `user_billing` の購読状態を管理 |
| `src/lib/stripe-sync.ts` | Stripe SubscriptionをDBへ反映 |

## 次に確認すること

- Vercelに `STRIPE_SECRET_KEY` / `STRIPE_PRICE_ID` / `STRIPE_WEBHOOK_SECRET` が設定されているか
- Stripe DashboardでWebhook Endpointが作成済みか
- Checkout完了後に `user_billing` が更新されるか
- 無料ユーザーと有料/体験中ユーザーで添削制限の表示が切り替わるか
