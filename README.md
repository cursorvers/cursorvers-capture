# Gdrive Uploader

スマートフォンで撮影した写真を、指定した Google Drive フォルダへ自動アップロードする PWA の土台（S5: polish + e2e + share-link doc）。

## 概要

このGdrive Uploaderは、スマートフォンで撮影した写真を指定のGoogle Driveフォルダに直接アップロードするためのプログレッシブウェブアプリ（PWA）です。シンプルなUIで、素早く写真のアップロードを完了できます。オフラインからの復帰時アップロード、トークンのサイレントリフレッシュに対応しています。

## 動作要件

*   **ブラウザ:** 最新版のChromeまたはSafariを推奨します。
*   **Googleアカウント:** Google Driveへのアクセス権限を持つGoogleアカウントが必要です。
*   **インターネット接続:** 初回サインイン時およびアップロード時に必要です。オフライン時には撮影した写真が一時保存され、オンライン復帰後にアップロードが再開されます。

## GCP Project Setup (Google Cloud Platform)

Google Drive APIを使用するためには、GCPプロジェクトでの設定が必要です。

1.  **新しいGCPプロジェクトを作成**するか、既存のプロジェクトを選択します。
2.  **Google Drive APIを有効化**します。
3.  **OAuth 2.0 Client IDを作成**します。
    *	アプリケーションの種類: 「ウェブアプリケーション」を選択します。
    *	承認済みのJavaScript生成元: アプリケーションがデプロイされるURL（例: `http://localhost:3000`, `https://your-app-name.vercel.app`）を追加します。
    *	承認済みのリダイレクトURI: 不要です（GISライブラリが自動で処理します）。
4.  作成されたクライアントIDをコピーし、`NEXT_PUBLIC_GOOGLE_CLIENT_ID`として環境変数に設定します。

## Deploy to Vercel

このアプリケーションはVercelへのデプロイを前提としています。

1.  **Vercelアカウント**とプロジェクトがGitリポジトリ（GitHub, GitLab, Bitbucketなど）に接続されていることを確認します。
2.  プロジェクトの**環境変数**に`NEXT_PUBLIC_GOOGLE_CLIENT_ID`を設定します。GCPで取得したOAuth 2.0クライアントIDを指定してください。
3.  **Build & Development Settings**:
    *	**FRAMEWORK PRESET**: Next.js
    *	**BUILD COMMAND**: `pnpm build`
    *	**OUTPUT DIRECTORY**: `.next`
4.  Gitリポジリトリにプッシュすると、Vercelが自動的にデプロイを開始します。

## シェア方法

このアプリのURLに`?folder=あなたのフォルダID`を追加することで、特定のGoogle Driveフォルダを友達と簡単に共有できます。
例: `https://your-app-name.vercel.app/?folder=xxxxxxxxxxxxxxxxxxxxxxxxx`
このURLを共有すると、受け取った友達は自分のGoogleアカウントでサインインし、アプリを開くだけで同じフォルダに写真をアップロードできるようになります。

## プライバシー

このアプリケーションは、Googleアカウントの認証情報やアップロードされた写真のデータをサーバーサイドで保存しません。全てのデータ（Google認証トークン、フォルダID、一時保存された写真データなど）は、ユーザーのブラウザのIndexedDBまたはLocalStorageにのみ保存されます。これにより、ユーザーのプライバシーが最大限に保護されます。

## Phase 2 Backlog (今後の開発予定)

*	バックグラウンド同期: アプリを閉じた後もアップロードを継続。
*	複数アカウント対応: 複数のGoogleアカウントを切り替えて使用。
*	アップロードキューのUI: アップロード状況と履歴の表示。

## Lighthouse Score (測定値)

| Category       | Score |
| :------------- | :---- |
| Performance    | --    |
| Accessibility  | --    |
| Best Practices | --    |
| SEO            | --    |

<!-- Note: Run Lighthouse locally to fill in the scores after final build. -->