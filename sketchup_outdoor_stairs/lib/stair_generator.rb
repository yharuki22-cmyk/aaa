# encoding: UTF-8
# =============================================================================
# stair_generator.rb
# 既存階段（石造・簡略化）を1段ずつ生成する
# =============================================================================

module OutdoorStairsGenerator
  module StairGenerator
    # parent_entities: 親グループ（ルート）のentities
    # materials: MaterialLibrary.build の戻り値
    # 戻り値: 生成した Existing_Stairs グループ
    def self.build(parent_entities, materials)
      group = parent_entities.add_group
      group.name = "Existing_Stairs"

      width = Parameters::STAIR_TOTAL_WIDTH
      y0 = -(width / 2.0)
      y1 = width / 2.0

      # 1段ずつブロックを積み上げる方式（各段の天端が踏面、側面が蹴上げになる）
      Parameters::STEP_COUNT.times do |i|
        x0 = i * Parameters::TREAD_DEPTH
        x1 = x0 + Parameters::TREAD_DEPTH
        top_z = (i + 1) * Parameters::RISER_HEIGHT

        GeometryHelpers.add_box(group.entities, x0, x1, y0, y1, 0, top_z)
      end

      group.material = materials[:stone]
      group
    end
  end
end
