# Changelog

## [2025-01-07] - Zoom User ID ベースの通話管理システム実装

### 追加機能

#### 1. Zoom User ID ベースの通話管理
- **目的**: 通話を Zoom User ID で管理し、ユーザーアカウント間で柔軟に通話履歴を移行可能にする
- **実装内容**:
  - `calls` テーブルに `zoom_user_id` カラムを追加
  - インデックス `idx_calls_zoom_user_id` を作成してパフォーマンス最適化
  - 既存の143件の通話に `zoom_user_id` をポピュレート

#### 2. バックエンドプロセッサの更新
- **変更内容**:
  - Zoom webhook の `user_id` (Zoom User ID) を `calls.zoom_user_id` に保存
  - 新しい通話が自動的に Zoom User ID で記録される
  - デプロイ: `zoom-phone-processor-00010-8rm` (Cloud Run)

#### 3. 動的ユーザールックアップの実装
- **API 変更** (`/api/calls`):
  - プロジェクトメンバーの Zoom ID リストを取得
  - `zoom_user_id` で通話をフィルタリング
  - 表示時に動的に「現在その Zoom ID を持っているユーザー」を検索
- **メリット**:
  - Zoom ID を別のユーザーに割り当てると、即座に通話履歴が移動
  - 過去の通話履歴を新しいユーザーに完全に引き継ぎ可能

#### 4. RLS ポリシーの修正
- **変更内容**:
  - `user_id` 条件を完全に削除
  - `zoom_user_id` のみでアクセス制御
  - ディレクターが所属プロジェクトメンバーの通話を閲覧可能に
- **新しいアクセス制御ルール**:
  ```sql
  -- ユーザーは自分の zoom_user_id の通話を閲覧
  users.zoom_user_id = calls.zoom_user_id

  -- ディレクターはプロジェクトメンバーの通話を閲覧
  -- (自分がディレクターのプロジェクトメンバーの zoom_user_id)

  -- オーナーは全通話を閲覧
  role = 'owner'
  ```

#### 5. ホーム画面の UI 改善
- **ロール別メニュー表示**:
  - **Owner**: 通話履歴、プロジェクト、プロンプト管理、ユーザー管理、システム設定、プロフィール
  - **Director**: 通話履歴、プロジェクト、プロンプト管理、プロフィール
  - **User**: 通話履歴、プロフィール
- **UI 改善**:
  - ロールバッジの追加（システムオーナー/ディレクター/ユーザー）
  - メニューカードのアイコンとレイアウト改善
  - ホバー時のスケールアップアニメーション

### データベース変更

#### マイグレーション
1. `20250107_001_add_zoom_user_id_to_calls.sql`
   - `calls.zoom_user_id` カラムの追加
   - インデックスの作成
   - 既存データのポピュレート

2. `20250107_002_fix_calls_rls_for_zoom_user_id.sql`
   - RLS ポリシーに `zoom_user_id` サポートを追加
   - ディレクターのアクセス権限を拡張

3. `20250107_003_remove_user_id_from_calls_rls.sql`
   - `user_id` 条件を完全に削除
   - `zoom_user_id` のみでアクセス制御

### ツール

#### Zoom ID 付け替えスクリプト
- **ファイル**: `reassign-zoom-id.js`
- **使い方**:
  ```bash
  node reassign-zoom-id.js <old_user_email> <new_user_email> <zoom_user_id>
  ```
- **機能**:
  - 古いユーザーから Zoom ID を削除
  - 新しいユーザーに Zoom ID を割り当て
  - 通話履歴が即座に新しいユーザーに移動

### 破壊的変更

#### ⚠️ アクセス制御の変更
- **以前**: `user_id` または `zoom_user_id` で通話を閲覧可能
- **現在**: `zoom_user_id` のみで通話を閲覧可能

**影響**:
- Zoom ID を持っていないユーザーは自分の通話を見れない
- ただし、Owner は特権ですべての通話を閲覧可能
- 通話の所有権が `zoom_user_id` の持ち主に完全に移行

### テスト結果

#### 動作確認
- ✅ 深瀬雅己 (masaki.fukase@maroo-consulting.com)
  - 自分の Zoom ID (so7ga6TcSH6gOLafTgMmRA) の24件の通話を閲覧可能
  - Studioプロジェクトの通話履歴に24件表示
  - プロゲートプロジェクトの通話履歴に139件表示（メンバーの通話含む）
  - 合計163件の通話にアクセス可能

- ✅ システムオーナー (masa.f.0406@gmail.com)
  - Owner権限で全143件の通話を閲覧可能
  - 自分の `zoom_user_id` が null のため、自分の通話としては0件

### 今後の拡張性

#### 可能になったこと
1. **通話履歴の完全な引き継ぎ**
   - 新規ユーザーに Zoom ID を割り当てると、過去の通話がすべて見える

2. **動的な通話の所有権変更**
   - Zoom ID の持ち主が変わると、通話の表示も即座に変わる

3. **クリーンな権限管理**
   - Zoom ID を持っている人だけが通話を見れる
   - 混乱がない

#### ユースケース
- 新入社員に既存の通話履歴を引き継ぐ
- テストアカウントの通話を本番アカウントに移行
- 組織変更時の通話履歴の再配置

### 関連ドキュメント
- [Zoom User ID Architecture](./zoom_user_id_architecture.md)
- [Database Schema](./database_schema.md)
- [API Specification](./api_specification.md)

---

## [2025-01-06] - システムデフォルトプロンプト管理機能

### 追加機能
- Owner専用のシステム全体デフォルトプロンプト管理機能
- プロンプトバージョン管理と復元機能

---

## [2025-01-05] - AIプロンプトアシスタント実装

### 追加機能
- 音声録音機能
- Whisper APIによる文字起こし
- GPT-5-miniによるプロンプト生成

---

## [2025-01-04] - 基本的な通話処理フロー完成

### 追加機能
- Zoom Phone webhook処理
- 音声ダウンロード・文字起こし
- 通話ステータス検出
- Slack通知
