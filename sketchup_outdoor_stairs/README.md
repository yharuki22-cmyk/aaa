# 屋外階段パース用簡易モデル生成スクリプト（SketchUp Ruby API）

建築設計課題の夜間パース確認用に、既存の屋外階段（都市側⇔北大江公園側）を
SketchUp上へ自動生成する簡易ジェネレータです。**精密な施工モデルではなく、
構図・質感・光の当たり方をすばやく確認するためのベースモデル**を目的としています。

---

## 1. フォルダ構成

```
sketchup_outdoor_stairs/
├── main.rb                        # エントリーポイント（このファイルをloadする）
├── parameters.rb                  # 変更可能な全パラメータ
├── README.md                      # このファイル
└── lib/
    ├── geometry_helpers.rb        # 直方体・円柱・断面ロフト等の低レベル関数
    ├── material_library.rb        # マテリアル一式の定義
    ├── cleanup.rb                 # 再実行時の旧ジオメトリ／シーン削除処理
    ├── stair_generator.rb         # 既存階段（石造・簡略化）
    ├── retaining_wall_generator.rb# 右側擁壁
    ├── round_window_generator.rb  # 丸窓（金属縁＋ガラス＋発光面）
    ├── water_channel_generator.rb # 擁壁足元の水路（水面＋暖色反射）
    ├── drainage_light_generator.rb# 側溝照明（乳半アクリルパネル、Component化）
    ├── handrail_generator.rb      # 中央手すり（4区間＋支柱）
    ├── handrail_section_test.rb   # 手すり断面の個別確認用テストモード
    ├── context_generator.rb       # 左側建物・公園地盤・樹木
    └── camera_generator.rb        # カメラガイド・Scene登録・画像書き出し
```

---

## 2. 生成される要素（すべてGroup／Componentに分離）

`main.rb` を実行すると、`OutdoorStairsGenerator_Root` という1つの親Groupの下に
以下9つの名前付きGroupが生成されます（親Groupには属性ディクショナリで
「本スクリプトが生成したルート」であることを識別する属性が付与されます）。

| Group名 | 内容 |
|---|---|
| `Existing_Stairs` | 石造階段（1段ずつ生成） |
| `Right_Retaining_Wall` | 右側擁壁（勾配に沿った階段状ブロック） |
| `Round_Windows` | 丸窓×6（金属縁＋ガラス＋暖色発光面の入れ子Group） |
| `Water_Channel` | 擁壁足元の水路（水面＋暖色反射帯） |
| `Drainage_Lights` | 側溝照明（`OSG_DrainageLightPanel` Componentのインスタンス） |
| `Handrail` | 中央手すり（`Handrail_Rail` / `Handrail_Coping_Connection` / `Handrail_Posts`） |
| `Left_Context` | 左側建物の簡略ボリューム |
| `Park_Context` | 公園地盤＋樹木（簡略面） |
| `Camera_Guide` | カメラ位置・視点先を示す3D上のガイド（marker＋line） |

---

## 3. 想定した階段寸法（仮定値・要確認）

階段全長 24,000mm・全幅 6,215mm という既知の外形寸法に対し、
以下の**仮定値**で段数・蹴上げ・踏面を設定しています（`parameters.rb`で変更可能）。

- 段数: **80段**
- 蹴上げ: **165mm**
- 踏面: **300mm**
- 踏面300mm × 80段 = 24,000mm（全長と一致するように設定）
- 全体の立上り高さ: 165mm × 80段 = 13,200mm

実際の現況階段の実測値が判明次第、`parameters.rb` の
`STEP_COUNT` / `RISER_HEIGHT` / `TREAD_DEPTH` を修正してください
（`TREAD_DEPTH * STEP_COUNT` が `STAIR_TOTAL_LENGTH` に一致するように調整することを推奨します）。

### 座標系の考え方

- X軸: 階段の登り方向（0 = 都市側の階段起点、+24,000mm = 北大江公園側）
- Y軸: 階段の幅方向（0 = 中心、+Y = 左側、−Y = 右側）
- Z軸: 高さ（0 = 階段起点の地盤高さ）
- 「右側擁壁」は、都市側から公園側を見上げる視点を基準に **−Y側** に配置しています。

---

## 4. インストール方法

1. 本フォルダ（`sketchup_outdoor_stairs/`）をそのままローカルに配置します。
   場所はどこでも構いません（SketchUpのPluginsフォルダである必要はありません。
   Ruby Consoleから`load`する場合は任意の場所で構いません）。
2. SketchUpを起動し、対象のモデル（既存モデルがあれば開いておく）を用意します。

### 4-1. Ruby Consoleから読み込む方法（開発・確認用に推奨）

1. `Window > Ruby Console` を開く
2. 以下を実行（パスは環境に合わせて変更）

   ```ruby
   load "C:/path/to/sketchup_outdoor_stairs/main.rb"
   ```
   （Macの場合は `load "/Users/yourname/path/to/sketchup_outdoor_stairs/main.rb"`）

3. モデルを生成する

   ```ruby
   OutdoorStairsGenerator.generate_all
   ```

4. 手すり断面だけを個別に確認したい場合

   ```ruby
   OutdoorStairsGenerator.test_handrail_sections
   ```

`load` はファイルを毎回再読込するため、`parameters.rb` や `lib/*.rb` を編集した後は
同じ `load "main.rb"` を再実行するだけで変更が反映されます。

### 4-2. Pluginsフォルダから読み込む方法

1. `sketchup_outdoor_stairs` フォルダごと、SketchUpのPluginsフォルダにコピーします。
   - Windows: `%APPDATA%\SketchUp\SketchUp 20XX\SketchUp\Plugins`
   - Mac: `~/Library/Application Support/SketchUp 20XX/SketchUp/Plugins`
2. SketchUpを再起動します。
3. メニューバーの `Plugins > Outdoor Stairs: Generate Model` を実行するとモデルが生成されます。
   手すり断面テストは `Plugins > Outdoor Stairs: Test Handrail Sections` から実行できます。
4. 再起動せず読み込みたい場合は、Ruby Consoleで
   `load "（Pluginsフォルダ内のパス）/sketchup_outdoor_stairs/main.rb"` を実行してください。

---

## 5. parameters.rb の編集方法

`parameters.rb` は `module OutdoorStairsGenerator::Parameters` にまとめられた定数群です。
主なグループは以下の通りです。編集後は `main.rb` を再度 `load` してから
`OutdoorStairsGenerator.generate_all` を再実行してください。

| セクション | 主なパラメータ |
|---|---|
| 階段全体寸法 | `STEP_COUNT` / `RISER_HEIGHT` / `TREAD_DEPTH` |
| 右側擁壁 | `WALL_THICKNESS` / `WALL_OFFSET_FROM_STAIRS` / `WALL_HEIGHT_ABOVE_GROUND` |
| 丸窓 | `ROUND_WINDOWS`（配列。x, diameter, height_above_groundを個別指定） |
| 水路 | `WATER_LEVEL_HEIGHT` ほか |
| 側溝照明 | `DRAINAGE_LIGHT_SECTIONS`（区間ごとの配置間隔） |
| 手すり | `HANDRAIL_SECTION_BOUNDARIES` / 各断面寸法 / `HANDRAIL_POST_SPACING` |
| 周辺環境 | `LEFT_BUILDING_*` / `PARK_GROUND_*` / `PARK_TREES` |
| カメラ | `CAMERA_MAIN_EYE` / `CAMERA_MAIN_TARGET` / `CAMERA_MAIN_FOV_DEG` ほか |

数値はすべて `.mm` を付けて記述してください（例: `165.mm`）。

---

## 6. 再実行・削除の仕組み

- `main.rb` を再実行すると、以前このスクリプトが生成した `OutdoorStairsGenerator_Root`
  グループ（属性ディクショナリ `OutdoorStairsGenerator` に `is_root => true` を持つグループ）
  だけを自動的に削除してから、新しいモデルを生成します。
- ユーザーが手作業で作成した他のGroup・Component・ジオメトリには一切影響しません。
- `Camera_Main` / `Camera_Lookdown` の2つのSceneも、同名のものがあれば再実行時に
  削除してから作り直されます。
- `DrainageLightGenerator` が作成するComponent定義（`OSG_DrainageLightPanel`）や
  `MaterialLibrary` が作成するマテリアルは、再実行のたびに重複作成されず再利用されます。

---

## 7. 実行結果

- 生成完了時に「モデル生成完了」というメッセージボックスが表示されます。
- Ruby Consoleには以下がログ出力されます。
  - 削除した以前のルートグループ数
  - 生成したグループ数（ルート直下、9であれば正常）
  - 配置した側溝照明の数
  - 配置した丸窓の数

---

## 8. カメラ・Scene・画像書き出し

- `Camera_Main`: 都市側（階段下部）から公園側を見上げる視点。目線高さ1,600mm。
  右側擁壁・丸窓・側溝照明・中央手すりが1枚に収まるよう調整しています。
- `Camera_Lookdown`: 階段全体を見下ろす確認用視点。
- 画像書き出し（Ruby Consoleから）:

  ```ruby
  OutdoorStairsGenerator.export_main_scene("C:/tmp/camera_main.png")
  OutdoorStairsGenerator.export_lookdown_scene("C:/tmp/camera_lookdown.png")
  ```

  サイズを指定する場合:

  ```ruby
  OutdoorStairsGenerator.export_main_scene("C:/tmp/camera_main.png", 2560, 1440)
  ```

---

## 9. よくあるエラー

| 症状 | 原因・対処 |
|---|---|
| `load` 時に `LoadError` | パスの区切り文字を確認（Windowsでも `/` を使うと安全）。ファイル名の大文字小文字も確認。 |
| `NoMethodError: undefined method 'mm'` | SketchUpのRuby Console以外（通常のRuby環境）で実行しようとしている。必ずSketchUp内で実行すること。 |
| `Plugins` メニューに項目が増え続ける | Pluginsフォルダ経由ではなく `load` を繰り返した場合は正常（`file_loaded?`により2重登録は防止済み）。SketchUpを再起動すればメニューは1つに戻ります。 |
| 生成後に階段や擁壁が極端に長い／短い | `parameters.rb` の `STEP_COUNT` / `TREAD_DEPTH` / `STAIR_TOTAL_LENGTH` の整合を確認。 |
| 丸窓が擁壁にめり込んで見える | `ROUND_WINDOW_PROTRUSION` / `ROUND_WINDOW_GLASS_OFFSET` / `ROUND_WINDOW_GLOW_OFFSET` を調整（擁壁前面からの張り出し量）。 |
| 手すりの断面が繋がって見えない | `HANDRAIL_TRANSITION_LENGTH` を長くする、または区間境界の位置を見直す。 |
| 再実行しても古いモデルが残る | 手動で `Group` 名を変更した場合、属性ディクショナリによる識別ができなくなるため削除対象外になります。手動でモデルをリネームしないでください。 |

---

## 10. SketchUpの対応バージョンに関する注意

- 本スクリプトは **SketchUp 2017以降の標準Ruby API**（`Sketchup::Group` /
  `Sketchup::ComponentDefinition` / `Geom::Point3d` / `Geom::Transformation` /
  `Sketchup::Camera` / `Sketchup::Pages` など）のみを使用しており、
  非推奨（deprecated）APIには依存していません。
- `Numeric#mm` など単位変換の拡張メソッドはSketchUp内蔵のRuby環境でのみ利用可能です。
  通常のRuby（`ruby` コマンド等）では動作しません。
- SketchUp Free（Webブラウザ版）はRuby APIに対応していないため、
  **SketchUp Pro もしくは SketchUp Make Desktop版**が必要です。
- 動作確認は SketchUp 2021〜2024 相当のAPI仕様を基準にしています。

---

## 11. 夜間パース化（D5 Render / Enscape）への引き継ぎ方

本スクリプトが作るマテリアルは色・半透明度のみで、実発光（自己発光）は
SketchUp標準では表現できません。以下の対応関係を目安にレンダラー側で
発光・反射・ガラス設定を追加してください。

| モデル内のマテリアル | 用途 | レンダラー側での想定設定 |
|---|---|---|
| `OSG_WarmGlow_Emissive` | 丸窓内部の発光面／水路底の反射帯 | 自己発光（Emissive）マテリアルに置き換え、暖色・輝度を強める |
| `OSG_AcrylicLight` | 側溝照明パネル | 自己発光＋わずかな拡散（乳半アクリル感）を追加 |
| `OSG_Water` | 水面 | 反射率・粗さを設定し、夜間の反射を強調 |
| `OSG_Glass` | 丸窓のガラス | 屈折・反射のあるガラスマテリアルに置換 |
| `OSG_Stone` / `OSG_WallStone` | 階段・擁壁 | 石材テクスチャ＋ラフネスを追加（本スクリプトでは無地グレーのみ） |

### D5 Render
1. SketchUpモデルをそのまま同期（D5 SketchUpプラグイン使用）。
2. `OSG_WarmGlow_Emissive` / `OSG_AcrylicLight` を選択し、D5のマテリアルエディタで
   Emissive（自己発光）をONにして強度・色温度を調整。
3. `OSG_Water` は水マテリアルプリセットに差し替え、夜景用のライティング
   （街灯・IESライト等）を`Camera_Guide`の位置を参考に追加。

### Enscape
1. Enscapeを起動し、`Camera_Main` / `Camera_Lookdown` のSceneをEnscapeの
   視点として利用（SketchUpのシーンタブから直接ジャンプ可能）。
2. マテリアル編集で `OSG_WarmGlow_Emissive` / `OSG_AcrylicLight` に
   「Self-Illumination（自己発光）」を設定。
3. `Water_Channel` グループ内の水面には、Enscapeの水マテリアル、または
   反射強度を上げたガラス系マテリアルを割り当てる。

---

## 12. 開発の進め方（フェーズ構成）

このスクリプトは以下のフェーズに分けて段階的に構築しました。

- **フェーズ1**: `parameters.rb` の骨格、階段（`Existing_Stairs`）と
  擁壁（`Right_Retaining_Wall`）のみを生成する最小コード
- **フェーズ2**: 手すり（`Handrail`）の追加、断面形状（円形／楕円形／扁平形）を
  個別確認できるテストモード（`test_handrail_sections`）
- **フェーズ3**: 側溝照明（`Drainage_Lights`）・丸窓（`Round_Windows`）・
  水路（`Water_Channel`）の追加
- **フェーズ4**: カメラガイド・Scene登録（`Camera_Main` / `Camera_Lookdown`）・
  マテリアル一式・再実行時のクリーンアップ処理の追加

各フェーズで想定した不具合と確認手順は次のとおりです。

### フェーズ1（階段・擁壁）
- **想定不具合**: `add_face` の点の順序（巻き順）によって法線が下向きになり、
  `pushpull` が意図した方向に伸びない。
- **確認手順**: 生成後、階段を側面（Y方向）から見て、段が右肩上がりに
  積み上がっているか、擁壁が階段勾配に沿って階段状に立ち上がっているかを目視確認。
  `face.reverse! if face.normal.z < 0` で自動補正しているため通常は発生しない。

### フェーズ2（手すり・断面テスト）
- **想定不具合**: 断面同士の頂点数が異なるとロフト時に面が捩れる／エラーになる。
  進行方向ベクトルと基準アップベクトルが平行に近いと外積が不定になる。
- **確認手順**: `OutdoorStairsGenerator.test_handrail_sections` を実行し、
  `Handrail_Section_Test` グループ内の3つの断面（円形・楕円形・扁平形）が
  それぞれ独立した短い部材として正しい寸法で生成されているかを確認。
  本番の手すりは区間境界で断面が変形（ロフト）しているか、支柱が地面から
  手すりまで正しく届いているかを側面から確認。

### フェーズ3（側溝照明・丸窓・水路）
- **想定不具合**: 区間境界で照明が重複配置される。丸窓の内径がフレーム幅より
  小さくなり負の半径になる。水路が階段有効長を超えてマイナス長になる。
- **確認手順**: Ruby Consoleに出力される「配置した側溝照明の数」「配置した丸窓の数」
  が期待値と一致するか確認（既定値では照明35箇所、丸窓6箇所）。
  丸窓を正面から見て、金属縁の内側にガラス・その奥に暖色発光面が
  同心円状に見えるか確認。

### フェーズ4（カメラ・Scene・再実行）
- **想定不具合**: Scene登録時に `active_view` が取得できない
  （モデルが開かれていない等）。再実行時に旧グループが消えず二重生成される。
  マテリアルやComponent定義が再実行のたびに増殖する。
- **確認手順**: `OutdoorStairsGenerator.generate_all` を2回連続実行し、
  Ruby Console出力の「削除した以前のルートグループ数」が2回目以降 `1` に
  なること、モデル階層に `OutdoorStairsGenerator_Root` が常に1つだけ
  存在することを確認。`Window > Materials` で `OSG_` 接頭辞のマテリアルが
  重複していないことを確認。

---

## 13. 自己レビューで洗い出した懸念点と対応

コード作成後、構文・API利用方法について以下の点をレビューし、対応しました。

- `Sketchup::Face#pushpull` 後は返り値のFaceが無効になる可能性があるため、
  `pushpull` 実行後にそのFaceオブジェクトを再利用しないよう統一。
- 丸窓の穴あけは、擁壁を実際にブーリアン（くり抜き）せず、擁壁前面に
  張り出す部品として構成（要件どおりの簡略表現）。
- 手すりの断面ロフトは、`Follow Me` の代わりに始端・終端の断面点列を
  手動で接続する方式を採用し、経路（進行方向）と断面基準ベクトルが
  平行になる特異点を回避する処理を追加。
- 側溝照明の区間境界（例: 8,000mm地点）で位置が重複しないよう、
  2区間目以降は配置開始位置をずらす処理を追加。
- 再実行時に既存モデルを誤って削除しないよう、削除対象は属性
  ディクショナリで明示的にマークされたルートグループのみに限定。
- `model.entities.grep(...)` のような一部環境依存の可能性がある書き方は避け、
  `to_a` + `is_a?` による判定に統一。
- 単位変換はすべて `.mm` を使用し、`STAIR_TOTAL_LENGTH` と
  `TREAD_DEPTH * STEP_COUNT` の整合をコメントで明記。

ロジック部分（面・ソリッド生成の分岐、区間分割、再実行時のクリーンアップ、
グループ数・照明数・丸窓数の集計など）は、SketchUpの主要クラスを模した
Rubyスタブ環境上で `OutdoorStairsGenerator.generate_all` を実際に実行し、
例外が発生しないこと、グループ階層と数量（ルート直下9グループ、
側溝照明35個、丸窓6個など）が意図どおりであることを確認済みです。
ただし、面の穴あけ（丸窓フレームの中抜き）やソリッドの妥当性など、
SketchUp実機のジオメトリエンジン依存の挙動は、実際のSketchUp上での
最終確認を推奨します。
