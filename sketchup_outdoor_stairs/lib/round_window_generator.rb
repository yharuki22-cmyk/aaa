# encoding: UTF-8
# =============================================================================
# round_window_generator.rb
# 擁壁の丸窓（金属縁＋ガラス＋内部の暖色発光面）を生成する。
# 実際に擁壁をブーリアンでくり抜くのではなく、擁壁前面に張り出す
# 簡略部品として設置する（パース上で丸窓に見えることを優先した表現）。
# =============================================================================

module OutdoorStairsGenerator
  module RoundWindowGenerator
    # 戻り値: 生成した Round_Windows グループ
    def self.build(parent_entities, materials)
      group = parent_entities.add_group
      group.name = "Round_Windows"

      y_inner = Parameters.wall_inner_y

      Parameters::ROUND_WINDOWS.each_with_index do |win, index|
        window_group = group.entities.add_group
        window_group.name = "Round_Window_#{index + 1}"

        x = win[:x]
        diameter = win[:diameter]
        radius = diameter / 2.0
        z = Parameters.nose_height_at(x) + win[:height_above_ground]

        frame_origin = Geom::Point3d.new(x, y_inner + Parameters::ROUND_WINDOW_PROTRUSION, z)
        glass_origin = Geom::Point3d.new(x, y_inner + Parameters::ROUND_WINDOW_GLASS_OFFSET, z)
        glow_origin  = Geom::Point3d.new(x, y_inner + Parameters::ROUND_WINDOW_GLOW_OFFSET, z)

        # 金属縁（円環）
        frame = GeometryHelpers.add_ring_xz(
          window_group.entities, frame_origin, radius,
          radius - Parameters::ROUND_WINDOW_FRAME_WIDTH,
          Parameters::ROUND_WINDOW_FRAME_DEPTH
        )
        frame.material = materials[:metal_frame]

        # ガラス面（半透明）
        glass_radius = radius - Parameters::ROUND_WINDOW_FRAME_WIDTH
        glass = GeometryHelpers.add_disc_xz(window_group.entities, glass_origin, glass_radius)
        glass.material = materials[:glass]
        glass.back_material = materials[:glass]

        # 内部の暖色発光面（水面が光を反射しているイメージ）
        glow_radius = glass_radius * Parameters::ROUND_WINDOW_GLOW_SCALE
        glow = GeometryHelpers.add_disc_xz(window_group.entities, glow_origin, glow_radius)
        glow.material = materials[:warm_glow]
        glow.back_material = materials[:warm_glow]
      end

      group
    end
  end
end
