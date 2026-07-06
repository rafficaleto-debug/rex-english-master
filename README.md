# レックス英語マスター v87.2

v87.2は、v87.1をベースにした **Safari / GitHub Pages キャッシュ対策強化版** です。

## 変更点

- 画面表示を v87.2 に更新
- URLに自動で `?build=v872-cache-safe-20260706` を付ける仕組みを追加
- 古い Service Worker / Cache Storage を自動削除
- `Cache-Control / Pragma / Expires` の no-cache 指定を追加
- GitHub Pages用に `.nojekyll` と `manifest.webmanifest` を追加
- 学習データは消さない設計

## アップロード方法

ZIPを解凍し、中身のファイルをすべて GitHub リポジトリ直下へ上書きアップロードしてください。

フォルダごとではなく、`index.html` がリポジトリ直下にある状態にしてください。
