# Admin Management Workflow

Tanukiの管理者権限を安全に管理するための手順です。

## 結論

管理者権限はSupabaseの `admin_users` テーブルで管理します。

`ADMIN_EMAILS` は残しますが、主目的は以下に限定します。

- 初回セットアップ時の仮の管理者判定
- `admin_users` migrationをまだ適用していない環境のフォールバック
- DBトラブル時の緊急復旧

通常運用では、管理者を増減するときにVercel環境変数を書き換えるのではなく、`admin_users` を更新します。

## なぜDB管理にするか

Vercel環境変数だけで管理すると、変更のたびにデプロイ/再起動や環境ごとの差分管理が必要になります。

DB管理にすると、以下がやりやすくなります。

- 管理者の追加/停止をすぐ反映できる
- `owner` / `admin` のような役割を持てる
- 無効化した管理者の履歴を残せる
- 将来、管理画面から変更できる

## セキュリティ方針

フロントのボタン表示だけでは管理者判定をしません。

管理者向けAPIでは必ずサーバー側で `admin_users.is_active=true` を確認します。
これにより、ブラウザ側の表示を改変されても、API側で権限を止められます。

`admin_users` には一般ユーザー向けのRLS policyを作りません。
確認と更新は `SUPABASE_SERVICE_ROLE_KEY` を使うサーバー/API/管理スクリプトだけが行います。

## 初回セットアップ

### Step 1. migrationを適用する

Supabase SQL Editorで以下を実行します。

```text
supabase/20260507_admin_users.sql
```

### Step 2. 一度ログインする

管理者にしたいメールアドレスで、Tanukiに一度ログインしてください。

Supabase Authにユーザーが存在していないと、`admin_users.user_id` を紐づけられません。

### Step 3. dry-runで確認する

```bash
npm run db:admin-users -- --add --email your-email@example.com --role owner
```

`status: "dry-run"` と、追加予定の `user_id` / `email` / `role` が表示されます。

### Step 4. 実際に追加する

```bash
npm run db:admin-users -- --add --email your-email@example.com --role owner --dry-run false
```

## Supabaseで直接登録する場合

基本は `npm run db:admin-users` を使う方が安全です。
ただし、Supabase管理画面から直接登録しても問題ありません。

直接登録する場合は、以下の2点が必要です。

- Supabase Authの `users.id`
- ログインに使っているメールアドレス

### Step 1. user_idを確認する

Supabase Dashboardで以下を開きます。

```text
Authentication > Users
```

管理者にしたいユーザーを探し、`User UID` をコピーします。

注意: ユーザーがまだ一度もログインしていない場合、Authユーザーが存在しません。
先にTanukiへ一度ログインしてください。

### Step 2. admin_usersへ追加する

SQL Editorで以下を実行します。

```sql
insert into public.admin_users (
  user_id,
  email,
  role,
  is_active,
  notes
)
values (
  'ここにUser UID',
  'your-email@example.com',
  'owner',
  true,
  'initial owner'
)
on conflict (user_id) do update set
  email = excluded.email,
  role = excluded.role,
  is_active = true,
  notes = excluded.notes,
  updated_at = now();
```

`role` は最初の自分用アカウントなら `owner` にします。
追加の運用担当者は `admin` で構いません。

### Step 3. 登録確認

```sql
select user_id, email, role, is_active, notes, created_at, updated_at
from public.admin_users
order by updated_at desc;
```

対象メールアドレスが表示され、`is_active` が `true` なら登録完了です。

## 管理者一覧を見る

有効な管理者だけを見る場合:

```bash
npm run db:admin-users
```

無効化済みも含めて見る場合:

```bash
npm run db:admin-users -- --includeInactive true
```

## 管理者を無効化する

削除ではなく `is_active=false` にします。
履歴を残せるためです。

まずdry-run:

```bash
npm run db:admin-users -- --deactivate --email admin@example.com
```

問題なければ実行:

```bash
npm run db:admin-users -- --deactivate --email admin@example.com --dry-run false
```

## 管理者を再有効化する

```bash
npm run db:admin-users -- --activate --email admin@example.com --dry-run false
```

## roleの使い分け

現時点では `owner` と `admin` の動作差はありません。

将来的には以下のように分けられます。

| role | 想定 |
| --- | --- |
| `owner` | 管理者の追加/停止、課金や重要設定まで触れる |
| `admin` | 添削テスト、未登録単語確認、教材運用を行う |

## Vercel環境変数の扱い

`ADMIN_EMAILS` は完全削除せず、緊急用として残してOKです。

ただし、通常の管理者追加は `ADMIN_EMAILS` ではなく `admin_users` で行います。

`ADMIN_EMAILS` に大量のメールアドレスを入れて運用すると、誰が管理者か追いづらくなるため避けます。
