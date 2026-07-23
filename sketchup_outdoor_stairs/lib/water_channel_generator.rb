# encoding: UTF-8
# =============================================================================
# water_channel_generator.rb
# 擁壁足元・既存側溝に沿う細い水路を生成する。
# 水面は水平な半透明面、水路底には夜間の反射を想定した暖色発光帯を置く。
# =============================================================================

module OutdoorStairsGenerator
  module WaterChannelGenerator
    # 戻り値: 生成した Water_Channel グループ
    def self.build(parent_entities, materials)
      group = parent_entities.add_group
      group.name = "Water_Channel"

      y_wall = Parameters.wall_inner_y
      y_stair_side = y_wall + Parameters::WATER_CHANNEL_WIDTH

      x_start = Parameters::WATER_CHANNEL_MARGIN_START
      x_end = Parameters::STAIR_TOTAL_LENGTH - Parameters::WATER_CHANNEL_MARGIN_END
      return group if x_end <= x_start

      segment_count = Parameters::WALL_SEGMENT_COUNT
      total_length = x_end - x_start
      segment_length = total_length / segment_count.to_f

      segment_count.times do |i|
        seg_x0 = x_start + i * segment_length
        seg_x1 = (i == segment_count - 1) ? x_end : (seg_x0 + segment_length)

        ground_z = Parameters.nose_height_at(seg_x0)
        basin_bottom_z = ground_z - Parameters::WATER_CHANNEL_DEPTH
        basin_height = Parameters::WATER_CHANNEL_DEPTH

        # 水路本体（水槽状のくぼみを表す簡易ボックス）
        basin = GeometryHelpers.add_box(
          group.entities, seg_x0, seg_x1, y_wall, y_stair_side, basin_bottom_z, basin_height
        )
        basin.material = materials[:wall_stone]

        # 水面（半透明・水平）
        water_z = basin_bottom_z + Parameters::WATER_LEVEL_HEIGHT
        water_face = GeometryHelpers.add_horizontal_face(
          group.entities, seg_x0, seg_x1, y_wall, y_stair_side, water_z
        )
        if water_face
          water_face.material = materials[:water]
          water_face.back_material = materials[:water]
        end

        # 水路底の暖色発光帯（水面越しに反射光として見える想定）
        glow_face = GeometryHelpers.add_horizontal_face(
          group.entities, seg_x0, seg_x1, y_wall, y_stair_side, basin_bottom_z + 2.mm
        )
        if glow_face
          glow_face.material = materials[:warm_glow]
          glow_face.back_material = materials[:warm_glow]
        end
      end

      group
    end
  end
end
