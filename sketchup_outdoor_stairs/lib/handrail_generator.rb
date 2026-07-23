# encoding: UTF-8
# =============================================================================
# handrail_generator.rb
# 階段中央（既定）に連続した手すりを生成する。
#
# 全長24mを4区間（握る／添える／なでる／離す）に分割し、区間ごとに
# 異なる断面（円形→楕円形→扁平形）を「直線経路への断面ロフト
# （Follow Me相当の簡易実装）」で押し出す。完全な連続ロフトの代わりに、
# 区間境界に短い移行区間（形状が変化するロフト）を挟むことで、
# 遠景では連続して見えるようにしている。
# 支柱は別グループとして垂直な円柱で生成する。
# =============================================================================

module OutdoorStairsGenerator
  module HandrailGenerator
    def self.build(parent_entities, materials)
      group = parent_entities.add_group
      group.name = "Handrail"

      y = Parameters::HANDRAIL_Y_OFFSET
      b = Parameters::HANDRAIL_SECTION_BOUNDARIES
      trans_len = Parameters::HANDRAIL_TRANSITION_LENGTH
      segs = Parameters::HANDRAIL_PROFILE_SEGMENTS

      profile_grip    = GeometryHelpers.circle_profile(Parameters::HANDRAIL_CIRCLE_RADIUS, segs)
      profile_support = GeometryHelpers.ellipse_profile(
        Parameters::HANDRAIL_ELLIPSE_HALF_WIDTH, Parameters::HANDRAIL_ELLIPSE_HALF_HEIGHT, segs
      )
      profile_graze = GeometryHelpers.flat_profile(
        Parameters::HANDRAIL_FLAT_HALF_WIDTH, Parameters::HANDRAIL_FLAT_HALF_HEIGHT, segs
      )

      up = Geom::Vector3d.new(0, 0, 1)
      rail_point = lambda do |x|
        Geom::Point3d.new(x, y, Parameters.nose_height_at(x) + Parameters::HANDRAIL_HEIGHT_ABOVE_NOSE)
      end

      # 区間境界（移行区間の分だけ手前・奥にずらす）
      seg1_end    = b[:grip_end] - trans_len / 2.0
      seg2_start  = b[:grip_end] + trans_len / 2.0
      seg2_end    = b[:support_end] - trans_len / 2.0
      seg3_start  = b[:support_end] + trans_len / 2.0
      seg3_end    = b[:graze_end] - trans_len / 2.0
      seg4_start  = b[:graze_end] + trans_len / 2.0
      coping_start = b[:release_end] - Parameters::HANDRAIL_COPING_LENGTH
      seg4_end    = [coping_start, seg4_start].max

      rail_group = group.entities.add_group
      rail_group.name = "Handrail_Rail"
      re = rail_group.entities

      # 区間1: 握る（円形）
      loft(re, rail_point, b[:grip_start], seg1_end, up, profile_grip, profile_grip)
      # 移行区間1: 円形→楕円形
      loft(re, rail_point, seg1_end, seg2_start, up, profile_grip, profile_support)
      # 区間2: 添える（楕円形）
      loft(re, rail_point, seg2_start, seg2_end, up, profile_support, profile_support)
      # 移行区間2: 楕円形→扁平形
      loft(re, rail_point, seg2_end, seg3_start, up, profile_support, profile_graze)
      # 区間3: なでる（扁平形）
      loft(re, rail_point, seg3_start, seg3_end, up, profile_graze, profile_graze)
      # 移行区間3: 扁平形のまま区間4へ（形状変化なし、経路のみ継続）
      loft(re, rail_point, seg3_end, seg4_start, up, profile_graze, profile_graze)
      # 区間4: 離す（扁平形、笠木手前まで）
      loft(re, rail_point, seg4_start, seg4_end, up, profile_graze, profile_graze)

      rail_group.material = materials[:handrail_metal]

      # 石の笠木への接続表現（最終区間の末端を簡略ブロックで納める）
      coping_group = group.entities.add_group
      coping_group.name = "Handrail_Coping_Connection"
      build_coping_block(coping_group.entities, seg4_end, b[:release_end], y)
      coping_group.material = materials[:stone]

      # 支柱（笠木ブロック手前までに配置）
      posts_group = group.entities.add_group
      posts_group.name = "Handrail_Posts"
      build_posts(posts_group.entities, y, seg4_end)
      posts_group.material = materials[:post_metal]

      group
    end

    # rail_point(x) を介して2点間を断面ロフトする（区間長が0以下の場合はスキップ）
    def self.loft(entities, rail_point, x0, x1, up, profile0, profile1)
      return if x1 <= x0

      GeometryHelpers.loft_profiles(entities, rail_point.call(x0), rail_point.call(x1), up, profile0, profile1)
    end

    # 手すり末端を石の笠木へ視覚的に接続する簡略ブロック
    def self.build_coping_block(entities, x0, x1, y_center)
      return if x1 <= x0

      half_w = Parameters::HANDRAIL_FLAT_HALF_WIDTH + 20.mm
      y0 = y_center - half_w
      y1 = y_center + half_w
      z_top = Parameters.nose_height_at(x1) + Parameters::HANDRAIL_HEIGHT_ABOVE_NOSE
      z_bottom = Parameters.nose_height_at(x0)

      GeometryHelpers.add_box(entities, x0, x1, y0, y1, z_bottom, z_top - z_bottom)
    end

    # 細い黒色金属の支柱を等間隔で生成する
    def self.build_posts(entities, y_center, x_end_limit)
      x = 0.0
      while x <= x_end_limit
        base_z = Parameters.nose_height_at(x)
        top_z = base_z + Parameters::HANDRAIL_HEIGHT_ABOVE_NOSE
        center = Geom::Point3d.new(x, y_center, base_z)
        GeometryHelpers.add_cylinder(entities, center, Parameters::HANDRAIL_POST_RADIUS, top_z - base_z, 10)
        x += Parameters::HANDRAIL_POST_SPACING
      end
    end
  end
end
