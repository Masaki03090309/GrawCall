# RAG Materials for Prompt Engineering

このディレクトリには、プロンプトアシスタントのRAG（Retrieval Augmented Generation）に使用する学習資料を配置します。

## 📂 ファイル配置方法

以下の形式でファイルを配置してください：

```
docs/rag-materials/
├── README.md                          # このファイル
├── prompt-engineering-basics.md       # プロンプトエンジニアリング基礎
├── sales-feedback-guidelines.md       # 営業フィードバックガイドライン
├── evaluation-criteria.md             # 評価基準の作り方
├── few-shot-examples.md              # Few-shot例の書き方
└── industry-specific-prompts.md      # 業種特化プロンプトの作り方
```

## 📝 推奨フォーマット

### Markdown形式（推奨）
- `.md` ファイル（Markdown）
- 見出しで構造化
- コードブロックで具体例を記載

**メリット**:
- Gitで差分管理が容易
- Claude Codeで直接読める
- RAG検索時にセクション単位で分割可能

### PDF形式
- `.pdf` ファイル
- 既存のドキュメントをそのまま使用可能

**メリット**:
- 既存資料をそのまま活用
- レイアウトを保持

## 🔄 使用方法

### 開発段階（現在）
1. このディレクトリにMarkdownまたはPDFを配置
2. `mockRAGSearch()`を実装に差し替え
3. ローカルファイルを読み込んでembedding生成
4. Supabase `learning_materials`テーブルに保存

### 本番運用（将来）
1. UIから学習資料をアップロード
2. 自動的にGCSに保存＆embedding生成
3. プロンプトアシスタントが自動参照

## 📋 推奨する内容

### 1. プロンプトエンジニアリング基礎
- プロンプトの構造（役割/タスク/制約/出力形式）
- 明確な指示の書き方
- Few-shot学習の活用法

### 2. 営業フィードバック特化
- 営業通話の評価観点
- 良い/悪いフィードバック例
- 建設的なフィードバックの書き方

### 3. 業種特化のカスタマイズ
- 展示会向けプロンプト例
- アポイント重視のプロンプト例
- ヒアリング重視のプロンプト例

### 4. 評価基準の明確化
- 評価軸の定義方法
- 数値化/段階評価の書き方
- 減点/加点の基準

## 🚀 次のステップ

資料を配置後：
1. `app/api/prompts/assistant/chat/route.ts`の`mockRAGSearch()`を実装に差し替え
2. OpenAI Embeddings APIでベクトル化
3. Supabase pgvectorで類似度検索
4. プロンプトアシスタントでテスト

---

**作成日**: 2025-01-07
**担当**: Claude Code
