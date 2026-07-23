# encoding: UTF-8
# =============================================================================
# context_generator.rb
# パースの構図確認用に、周辺環境（左側建物ボリューム／公園地盤・樹木）を
# 簡略ボリュームで生成する。
# =============================================================================

module OutdoorStairsGenerator
  module ContextGenerator
    # 左側建物（簡略ボックス） -------------------------------------------------
    def self.build_left_context(parent_entities, materials)
      group = parent_entities.add_group
      group.name = "Left_Context"

      x0 = -Parameters::LEFT_BUILDING_MARGIN
      x1 = Parameters::STAIR_TOTAL_LENGTH + Parameters::LEFT_BUILDING_MARGIN
      y0 = Parameters.stair_left_y + Parameters::LEFT_BUILDING_OFFSET
      y1 = y0 + Parameters::LEFT_BUILDING_DEPTH

      GeometryHelpers.add_box(group.entities, x0, x1, y0, y1, 0, Parameters::LEFT_BUILDING_HEIGHT)
      group.material = materials[:building]
      group
    end

    # 公園側地盤・樹木（簡略表現） -----------------------------------------------
    def self.build_park_context(parent_entities, materials)
      group = parent_entities.add_group
      group.name = "Park_Context"

      ground_z = Parameters.nose_height_at(Parameters::STAIR_TOTAL_LENGTH)
      x0 = Parameters::STAIR_TOTAL_LENGTH
      x1 = x0 + Parameters::PARK_GROUND_DEPTH
      y0 = -(Parameters::PARK_GROUND_WIDTH / 2.0)
      y1 = Parameters::PARK_GROUND_WIDTH / 2.0

      ground = group.entities.add_group
      ground.name = "Park_Ground"
      GeometryHelpers.add_box(
        ground.entities, x0, x1, y0, y1,
        ground_z - Parameters::PARK_GROUND_THICKNESS, Parameters::PARK_GROUND_THICKNESS
      )
      ground.material = materials[:ground]

      trees = group.entities.add_group
      trees.name = "Park_Trees"
      Parameters::PARK_TREES.each do |tree|
        build_tree(trees.entities, tree, materials)
      end

      group
    end

    # 樹木1本（円柱の幹＋簡略面の樹冠）を生成する
    def self.build_tree(entities, tree, materials)
      base_z = Parameters.nose_height_at(Parameters::STAIR_TOTAL_LENGTH)
      trunk_center = Geom::Point3d.new(tree[:x], tree[:y], base_z)
      trunk = GeometryHelpers.add_cylinder(entities, trunk_center, tree[:trunk_radius], tree[:trunk_height], 8)
      trunk.material = materials[:trunk]

      foliage_center = Geom::Point3d.new(tree[:x], tree[:y], base_z + tree[:trunk_height] + tree[:foliage_radius] * 0.6)
      build_foliage(entities, foliage_center, tree[:foliage_radius], materials)
    end

    # 樹冠: 円環＋上下の頂点を結ぶ低ポリゴンの簡略面（球体の代替）
    def self.build_foliage(entities, center, radius, materials)
      segments = 8
      ring_pts = GeometryHelpers.circle_points_3d(center, radius, segments)
      top_pt = Geom::Point3d.new(center.x, center.y, center.z + radius)
      bottom_pt = Geom::Point3d.new(center.x, center.y, center.z - radius * 0.6)

      segments.times do |i|
        j = (i + 1) % segments
        top_face = entities.add_face([ring_pts[i], ring_pts[j], top_pt])
        if top_face
          top_face.material = materials[:foliage]
          top_face.back_material = materials[:foliage]
        end

        bottom_face = entities.add_face([ring_pts[i], ring_pts[j], bottom_pt])
        next unless bottom_face

        bottom_face.material = materials[:foliage]
        bottom_face.back_material = materials[:foliage]
      end
    end
  end
end
