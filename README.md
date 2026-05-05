# tanuki

AIシャドーイング添削アプリのMVP実装です。仕様書は `仕様書.md` に残しています。

## 起動

```bash
npm install
npm run dev
```

外部サービスの環境変数が未設定でも、録音、デモ提出、ステータス遷移、添削結果表示は動作します。

## 外部連携

`.env.example` を `.env.local` にコピーし、必要なキーを設定してください。

- Supabase: Authと永続DB保存
- Cloudflare R2: 録音音声保存。バケットは非公開のまま、Azure評価時だけサーバー側で署名付きURLを発行します。
- Azure Speech: Pronunciation Assessment
- OpenAIまたはAnthropic: 日本語フィードバック生成
- Stripe: 3日間無料体験つき月額980円のCheckout、Webhook、Customer Portal

Supabaseのテーブルは `supabase/schema.sql` をSQL Editorで実行して作成します。
