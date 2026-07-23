# encoding: UTF-8
# =============================================================================
# drainage_light_generator.rb
# 右側擁壁の足元・既存側溝に沿って小さな照明部品（乳半アクリルパネル）を
# 配置する。照明本体はComponentとして1つだけ定義し、各配置位置へ
# インスタンスとして挿入することで再利用する。
# =============================================================================

module OutdoorStairsGenerator
  module DrainageLightGenerator
    COMPONENT_NAME = "OSG_DrainageLightPanel".freeze

    # 照明パネルのComponentDefinitionを取得（無ければ作成）
    def self.get_or_create_definition(model, materials)
      definitions = model.definitions
      existing = definitions[COMPONENT_NAME]
      return existing if existing

      defn = definitions.add(COMPONENT_NAME)
      w = Parameters::DRAINAGE_LIGHT_WIDTH
      h = Parameters::DRAINAGE_LIGHT_HEIGHT
      d = Parameters::DRAINAGE_LIGHT_DEPTH

      pts = [
        Geom::Point3d.new(-w / 2.0, -d / 2.0, -h / 2.0),
        Geom::Point3d.new(w / 2.0, -d / 2.0, -h / 2.0),
        Geom::Point3d.new(w / 2.0, d / 2.0, -h / 2.0),
        Geom::Point3d.new(-w / 2.0, d / 2.0, -h / 2.0)
      ]
      face = defn.entities.add_face(pts)
      face.reverse! if face.normal.z < 0
      face.pushpull(h)

      defn.entities.to_a.each do |f|
        next unless f.is_a?(Sketchup::Face)

        f.material = materials[:acrylic_light]
        f.back_material = materials[:acrylic_light]
      end

      defn
    end

    # 戻り値: [生成した Drainage_Lights グループ, 配置した照明数]
    def self.build(parent_entities, materials, model)
      group = parent_entities.add_group
      group.name = "Drainage_Lights"

      defn = get_or_create_definition(model, materials)
      y_center = Parameters.wall_inner_y + 40.mm
      light_count = 0

      Parameters::DRAINAGE_LIGHT_SECTIONS.each_with_index do |section, index|
        x = section[:from]
        # 前区間の配置位置と重複しないよう、2区間目以降は間隔分だけずらして開始する
        x += section[:spacing] if index.positive?

        while x <= section[:to] + 0.01.mm
          z_center = Parameters.nose_height_at(x) + Parameters::DRAINAGE_LIGHT_Z
          transformation = Geom::Transformation.new(Geom::Point3d.new(x, y_center, z_center))
          group.entities.add_instance(defn, transformation)
          light_count += 1
          x += section[:spacing]
        end
      end

      [group, light_count]
    end
  end
end
