# encoding: UTF-8
# =============================================================================
# material_library.rb
# 夜間パース確認用の簡易マテリアル一式を定義する。
# テクスチャ画像は使用せず、色と半透明度のみで質感を想定する。
# =============================================================================

module OutdoorStairsGenerator
  module MaterialLibrary
    # 既存マテリアルがあれば再利用し、無ければ作成する
    def self.find_or_create(model, name)
      model.materials[name] || model.materials.add(name)
    end

    # 一式のマテリアルを作成し、名前でアクセスできるHashを返す
    def self.build(model)
      mats = {}

      mats[:stone] = find_or_create(model, "OSG_Stone")
      mats[:stone].color = Sketchup::Color.new(150, 148, 142)

      mats[:wall_stone] = find_or_create(model, "OSG_WallStone")
      mats[:wall_stone].color = Sketchup::Color.new(120, 118, 112)

      mats[:metal_frame] = find_or_create(model, "OSG_MetalFrame")
      mats[:metal_frame].color = Sketchup::Color.new(90, 88, 85)

      mats[:glass] = find_or_create(model, "OSG_Glass")
      mats[:glass].color = Sketchup::Color.new(190, 215, 225)
      mats[:glass].alpha = 0.25

      mats[:water] = find_or_create(model, "OSG_Water")
      mats[:water].color = Sketchup::Color.new(35, 70, 90)
      mats[:water].alpha = 0.55

      # 発光を想定した暖色面（SketchUp標準では実発光しないため色のみで表現）
      mats[:warm_glow] = find_or_create(model, "OSG_WarmGlow_Emissive")
      mats[:warm_glow].color = Sketchup::Color.new(255, 178, 96)

      mats[:acrylic_light] = find_or_create(model, "OSG_AcrylicLight")
      mats[:acrylic_light].color = Sketchup::Color.new(255, 220, 170)
      mats[:acrylic_light].alpha = 0.75

      mats[:handrail_metal] = find_or_create(model, "OSG_HandrailBronze")
      mats[:handrail_metal].color = Sketchup::Color.new(60, 48, 40)

      mats[:post_metal] = find_or_create(model, "OSG_PostBlack")
      mats[:post_metal].color = Sketchup::Color.new(18, 18, 18)

      mats[:building] = find_or_create(model, "OSG_BuildingContext")
      mats[:building].color = Sketchup::Color.new(200, 195, 188)

      mats[:ground] = find_or_create(model, "OSG_ParkGround")
      mats[:ground].color = Sketchup::Color.new(95, 128, 75)

      mats[:foliage] = find_or_create(model, "OSG_Foliage")
      mats[:foliage].color = Sketchup::Color.new(58, 105, 50)

      mats[:trunk] = find_or_create(model, "OSG_TreeTrunk")
      mats[:trunk].color = Sketchup::Color.new(92, 66, 46)

      mats
    end
  end
end
