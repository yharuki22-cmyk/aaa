# encoding: UTF-8
# =============================================================================
# parameters.rb
# 屋外階段パース用簡易モデル生成スクリプトのパラメータ定義
#
# このファイルの数値を変更するだけで、階段・擁壁・丸窓・照明・手すり等の
# 形状や配置を調整できます。単位は SketchUp 標準の .mm 拡張を使用しています。
# =============================================================================

module OutdoorStairsGenerator
  module Parameters
    # -------------------------------------------------------------------------
    # 0. スクリプト識別用
    # -------------------------------------------------------------------------
    # 再実行時に「このスクリプトが生成したモデル」だけを判別するための識別子
    ATTRIBUTE_DICTIONARY_NAME = "OutdoorStairsGenerator".freeze
    SCRIPT_VERSION = "1.0.0".freeze
    ROOT_GROUP_NAME = "OutdoorStairsGenerator_Root".freeze

    # -------------------------------------------------------------------------
    # 1. 階段全体寸法
    # -------------------------------------------------------------------------
    # 階段全長・全幅は敷地実測に基づく既知値（変更不可の外形条件として扱う）
    STAIR_TOTAL_LENGTH = 24_000.mm   # 階段全長（水平投影・都市側→公園側）
    STAIR_TOTAL_WIDTH  = 6_215.mm    # 階段全幅

    # 段数・蹴上・踏面は仮定値。TREAD_DEPTH * STEP_COUNT が STAIR_TOTAL_LENGTH に
    # 一致するように設定してあります（README参照）。
    STEP_COUNT    = 80          # 段数
    RISER_HEIGHT  = 165.mm      # 蹴上げ（1段あたりの高さ）
    TREAD_DEPTH   = 300.mm      # 踏面（1段あたりの奥行き）
    # 合計値チェック: TREAD_DEPTH * STEP_COUNT == STAIR_TOTAL_LENGTH であること

    # -------------------------------------------------------------------------
    # 2. 右側擁壁
    # -------------------------------------------------------------------------
    WALL_THICKNESS            = 400.mm    # 擁壁の壁厚
    WALL_OFFSET_FROM_STAIRS   = 300.mm    # 階段右端から擁壁内面までの離れ（側溝スペース）
    WALL_HEIGHT_ABOVE_GROUND  = 1_800.mm  # 各地点の地盤（階段面）から見た擁壁の立上り高さ
    WALL_SEGMENT_COUNT        = 24        # 擁壁をスロープに沿わせるための分割段数（多いほど滑らか）

    # -------------------------------------------------------------------------
    # 3. 丸窓（擁壁の丸窓＋奥の水路表現）
    # -------------------------------------------------------------------------
    # 丸窓は配列で複数定義。x: 階段起点からの距離, diameter: 直径,
    # height_above_ground: その地点の階段面からの窓中心高さ
    ROUND_WINDOWS = [
      { x: 2_000.mm,  diameter: 180.mm, height_above_ground: 1_100.mm },
      { x: 5_500.mm,  diameter: 220.mm, height_above_ground: 1_150.mm },
      { x: 9_000.mm,  diameter: 260.mm, height_above_ground: 1_100.mm },
      { x: 13_000.mm, diameter: 200.mm, height_above_ground: 1_150.mm },
      { x: 17_500.mm, diameter: 240.mm, height_above_ground: 1_100.mm },
      { x: 21_500.mm, diameter: 180.mm, height_above_ground: 1_150.mm }
    ].freeze

    ROUND_WINDOW_FRAME_DEPTH     = 30.mm   # 金属縁の奥行き
    ROUND_WINDOW_FRAME_WIDTH     = 20.mm   # 金属縁の見付け幅（内外径の差）
    ROUND_WINDOW_PROTRUSION      = 150.mm  # 擁壁前面からの張り出し量（窓部品全体）
    ROUND_WINDOW_GLASS_OFFSET    = 120.mm  # 張り出し基準からガラス面までの距離
    ROUND_WINDOW_GLOW_OFFSET     = 20.mm   # 張り出し基準から発光面までの距離（壁面に近い側）
    ROUND_WINDOW_GLOW_SCALE      = 0.8     # 発光面の直径 = 窓直径 * この係数

    # -------------------------------------------------------------------------
    # 4. 水路（側溝内の水面・既存側溝に沿う水路表現）
    # -------------------------------------------------------------------------
    WATER_CHANNEL_WIDTH        = 220.mm    # 水路の幅（Y方向）
    WATER_CHANNEL_DEPTH        = 150.mm    # 水路の深さ（見た目上のくぼみ）
    WATER_LEVEL_HEIGHT         = 60.mm     # 水路底から水面までの高さ（変更可能）
    WATER_CHANNEL_MARGIN_START = 500.mm    # 水路の始端マージン（階段起点から）
    WATER_CHANNEL_MARGIN_END   = 500.mm    # 水路の終端マージン（階段終点まで）

    # -------------------------------------------------------------------------
    # 5. 側溝照明（乳半アクリルパネル）
    # -------------------------------------------------------------------------
    DRAINAGE_LIGHT_WIDTH  = 120.mm   # 照明パネル幅（X方向）
    DRAINAGE_LIGHT_HEIGHT = 60.mm    # 照明パネル高さ（Z方向）
    DRAINAGE_LIGHT_DEPTH  = 25.mm    # 照明パネル奥行き（Y方向）
    DRAINAGE_LIGHT_Z      = 150.mm   # 各地点の階段面から照明中心までの高さ

    # 区間ごとの配置間隔（密→疎）。x座標は階段起点からの距離。
    DRAINAGE_LIGHT_SECTIONS = [
      { from: 0.mm,      to: 8_000.mm,  spacing: 400.mm  }, # 密
      { from: 8_000.mm,  to: 16_000.mm, spacing: 800.mm  }, # やや密
      { from: 16_000.mm, to: 22_000.mm, spacing: 1_500.mm }, # 疎
      { from: 22_000.mm, to: 24_000.mm, spacing: 2_500.mm }  # 最も疎
    ].freeze

    # -------------------------------------------------------------------------
    # 6. 手すり
    # -------------------------------------------------------------------------
    HANDRAIL_Y_OFFSET       = 0.mm      # 階段幅方向の手すり位置（0=中央）
    HANDRAIL_HEIGHT_ABOVE_NOSE = 900.mm # 段鼻ラインから手すり芯までの鉛直高さ
    HANDRAIL_TRANSITION_LENGTH = 400.mm # 断面が切り替わる移行区間の長さ

    # 4区間の境界（階段起点からの距離）
    HANDRAIL_SECTION_BOUNDARIES = {
      grip_start:   0.mm,      # 「握る」区間 開始
      grip_end:     8_000.mm,
      support_end:  16_000.mm, # 「添える」区間 終了
      graze_end:    22_000.mm, # 「なでる」区間 終了
      release_end:  24_000.mm  # 「離す」区間 終了（笠木接続部含む）
    }.freeze

    HANDRAIL_COPING_LENGTH = 500.mm # 最終区間末端の石の笠木接続ブロック長さ

    # 断面寸法
    HANDRAIL_CIRCLE_RADIUS      = 19.mm            # 下部: 円形 φ38mm
    HANDRAIL_ELLIPSE_HALF_WIDTH = 30.mm             # 中部: 楕円 幅60mm
    HANDRAIL_ELLIPSE_HALF_HEIGHT = 15.mm            # 中部: 楕円 高さ30mm
    HANDRAIL_FLAT_HALF_WIDTH    = 50.mm             # 上部: 扁平 幅100mm
    HANDRAIL_FLAT_HALF_HEIGHT   = 10.mm             # 上部: 扁平 高さ20mm
    HANDRAIL_PROFILE_SEGMENTS   = 16                # 断面の分割数（全断面共通）

    # 支柱
    HANDRAIL_POST_SPACING = 1_500.mm  # 支柱間隔
    HANDRAIL_POST_RADIUS  = 15.mm     # 支柱の半径（細い金属丸棒）

    # -------------------------------------------------------------------------
    # 7. 周辺環境
    # -------------------------------------------------------------------------
    # 左側建物ボリューム（簡略ボックス）
    LEFT_BUILDING_OFFSET  = 1_500.mm  # 階段左端から建物までの離れ
    LEFT_BUILDING_DEPTH   = 8_000.mm  # 建物の奥行き（Y方向）
    LEFT_BUILDING_HEIGHT  = 18_000.mm # 建物の高さ
    LEFT_BUILDING_MARGIN  = 3_000.mm  # 建物の階段方向への張り出しマージン（前後）

    # 公園側地盤・樹木（階段上端＝公園側に配置）
    PARK_GROUND_DEPTH  = 10_000.mm  # 公園地盤の奥行き（X方向、階段終端から先）
    PARK_GROUND_WIDTH  = 14_000.mm  # 公園地盤の幅（Y方向）
    PARK_GROUND_THICKNESS = 300.mm  # 公園地盤の厚み

    # 樹木の配置（x, y は階段起点基準のワールド座標オフセット, trunk/foliageは寸法）
    PARK_TREES = [
      { x: 25_500.mm, y: 1_000.mm,  trunk_height: 3_000.mm, trunk_radius: 150.mm, foliage_radius: 1_400.mm },
      { x: 27_000.mm, y: -2_000.mm, trunk_height: 3_500.mm, trunk_radius: 180.mm, foliage_radius: 1_700.mm },
      { x: 29_000.mm, y: 2_500.mm,  trunk_height: 2_800.mm, trunk_radius: 140.mm, foliage_radius: 1_300.mm },
      { x: 31_000.mm, y: -500.mm,   trunk_height: 3_200.mm, trunk_radius: 160.mm, foliage_radius: 1_500.mm }
    ].freeze

    # -------------------------------------------------------------------------
    # 8. カメラ・シーン
    # -------------------------------------------------------------------------
    EYE_HEIGHT = 1_600.mm   # 人の目線高さ

    # 見上げ視点（Camera_Main）: 都市側（階段下部）から公園側を見上げる
    CAMERA_MAIN_EYE    = [-4_000.mm, 900.mm, EYE_HEIGHT]
    CAMERA_MAIN_TARGET = [19_000.mm, -800.mm, 8_500.mm]
    CAMERA_MAIN_FOV_DEG = 45.0  # 35mm相当を想定した画角

    # 見下ろし視点（Camera_Lookdown）
    CAMERA_LOOKDOWN_EYE    = [12_000.mm, 4_000.mm, 22_000.mm]
    CAMERA_LOOKDOWN_TARGET = [12_000.mm, 0.mm, 6_000.mm]
    CAMERA_LOOKDOWN_FOV_DEG = 50.0

    # 画像書き出し既定値
    EXPORT_IMAGE_WIDTH  = 1_920
    EXPORT_IMAGE_HEIGHT = 1_080

    # -------------------------------------------------------------------------
    # 派生値ヘルパー（他ファイルから参照する計算済み座標）
    # -------------------------------------------------------------------------

    # 階段の段鼻ライン（連続スロープ）上の高さ z を距離 x から求める
    def self.nose_height_at(x)
      slope = RISER_HEIGHT.to_f / TREAD_DEPTH.to_f
      x.to_f * slope
    end

    # 擁壁内面（階段に面する側）の Y 座標（右側=マイナスY）
    def self.wall_inner_y
      -(STAIR_TOTAL_WIDTH / 2.0) - WALL_OFFSET_FROM_STAIRS
    end

    # 擁壁外面の Y 座標
    def self.wall_outer_y
      wall_inner_y - WALL_THICKNESS
    end

    # 階段右端（マイナスY側）の Y 座標
    def self.stair_right_y
      -(STAIR_TOTAL_WIDTH / 2.0)
    end

    # 階段左端（プラスY側）の Y 座標
    def self.stair_left_y
      STAIR_TOTAL_WIDTH / 2.0
    end
  end
end
