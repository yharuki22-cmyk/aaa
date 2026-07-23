# encoding: UTF-8
# =============================================================================
# handrail_section_test.rb
# 手すりの3断面形状（円形／楕円形／扁平形）を個別に確認するためのテストモード。
# 本番モデルとは別の一時グループ（Handrail_Section_Test）を生成する。
# =============================================================================

module OutdoorStairsGenerator
  module HandrailSectionTest
    GROUP_NAME = "Handrail_Section_Test".freeze
    SEGMENT_LENGTH = 500.mm
    ROW_SPACING = 400.mm

    def self.run(model)
      model.start_operation("Handrail Section Test", true)
      begin
        # 前回のテストグループがあれば削除する
        existing = model.entities.to_a.find { |e| e.is_a?(Sketchup::Group) && e.name == GROUP_NAME }
        existing.erase! if existing

        root = model.entities.add_group
        root.name = GROUP_NAME

        up = Geom::Vector3d.new(0, 0, 1)
        segs = Parameters::HANDRAIL_PROFILE_SEGMENTS

        samples = {
          "Circle_Grip_Phi38" => GeometryHelpers.circle_profile(Parameters::HANDRAIL_CIRCLE_RADIUS, segs),
          "Ellipse_Support_60x30" => GeometryHelpers.ellipse_profile(
            Parameters::HANDRAIL_ELLIPSE_HALF_WIDTH, Parameters::HANDRAIL_ELLIPSE_HALF_HEIGHT, segs
          ),
          "Flat_Graze_100x20" => GeometryHelpers.flat_profile(
            Parameters::HANDRAIL_FLAT_HALF_WIDTH, Parameters::HANDRAIL_FLAT_HALF_HEIGHT, segs
          )
        }

        samples.each_with_index do |(name, profile), i|
          y = i * ROW_SPACING
          start_pt = Geom::Point3d.new(0, y, 0)
          end_pt = Geom::Point3d.new(SEGMENT_LENGTH, y, 0)

          sub = root.entities.add_group
          sub.name = name
          GeometryHelpers.loft_profiles(sub.entities, start_pt, end_pt, up, profile, profile)
        end

        model.commit_operation
      rescue StandardError => e
        model.abort_operation
        UI.messagebox("手すり断面テスト生成中にエラーが発生しました:\n#{e.class}: #{e.message}")
        raise
      end

      UI.messagebox("手すり断面テスト形状を生成しました（#{GROUP_NAME} グループ）")
    end
  end
end
