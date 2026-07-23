# encoding: UTF-8
# =============================================================================
# retaining_wall_generator.rb
# 階段右側（下側=都市側から見て右手）に連続する擁壁を生成する。
# 実際の擁壁は階段勾配に沿って連続的に立ち上がるが、ここでは
# WALL_SEGMENT_COUNT 個の階段状ブロックで近似する簡略表現とする。
# =============================================================================

module OutdoorStairsGenerator
  module RetainingWallGenerator
    # 戻り値: 生成した Right_Retaining_Wall グループ
    def self.build(parent_entities, materials)
      group = parent_entities.add_group
      group.name = "Right_Retaining_Wall"

      y_inner = Parameters.wall_inner_y
      y_outer = Parameters.wall_outer_y
      total_length = Parameters::STAIR_TOTAL_LENGTH
      segment_count = Parameters::WALL_SEGMENT_COUNT
      segment_length = total_length / segment_count.to_f

      segment_count.times do |i|
        x0 = i * segment_length
        x1 = (i == segment_count - 1) ? total_length : (x0 + segment_length)

        # 各セグメントの立上り高さは、セグメント開始位置の段鼻高さを基準にする
        base_z = Parameters.nose_height_at(x0)
        top_z = base_z + Parameters::WALL_HEIGHT_ABOVE_GROUND

        GeometryHelpers.add_box(group.entities, x0, x1, y_outer, y_inner, 0, top_z)
      end

      group.material = materials[:wall_stone]
      group
    end
  end
end
