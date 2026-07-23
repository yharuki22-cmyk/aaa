# encoding: UTF-8
# =============================================================================
# main.rb
# 屋外階段パース用簡易モデル生成スクリプト（エントリーポイント）
#
# 実行方法の詳細は README.md を参照してください。
# Ruby Consoleから: load "main.rb" の後に
#   OutdoorStairsGenerator.generate_all
# を実行するとモデルが生成されます。
# =============================================================================

require "sketchup.rb"

base_dir = File.dirname(__FILE__)

# parameters.rb / lib以下を読み込む（loadを使うことで編集後の再読込にも対応する）
load File.join(base_dir, "parameters.rb")
load File.join(base_dir, "lib", "geometry_helpers.rb")
load File.join(base_dir, "lib", "material_library.rb")
load File.join(base_dir, "lib", "cleanup.rb")
load File.join(base_dir, "lib", "stair_generator.rb")
load File.join(base_dir, "lib", "retaining_wall_generator.rb")
load File.join(base_dir, "lib", "round_window_generator.rb")
load File.join(base_dir, "lib", "water_channel_generator.rb")
load File.join(base_dir, "lib", "drainage_light_generator.rb")
load File.join(base_dir, "lib", "handrail_generator.rb")
load File.join(base_dir, "lib", "handrail_section_test.rb")
load File.join(base_dir, "lib", "context_generator.rb")
load File.join(base_dir, "lib", "camera_generator.rb")

module OutdoorStairsGenerator
  # ---------------------------------------------------------------------
  # モデル生成本体
  # ---------------------------------------------------------------------
  def self.generate_all
    model = Sketchup.active_model
    removed_count = 0
    group_count = 0
    light_count = 0
    window_count = Parameters::ROUND_WINDOWS.length

    model.start_operation("Generate Outdoor Stairs Model", true)
    begin
      # 以前このスクリプトが生成した要素のみを削除する（既存モデルには触れない）
      removed_count = Cleanup.remove_previous_geometry(model)

      materials = MaterialLibrary.build(model)

      root = model.entities.add_group
      root.name = Parameters::ROOT_GROUP_NAME
      root.set_attribute(Parameters::ATTRIBUTE_DICTIONARY_NAME, "is_root", true)
      root.set_attribute(Parameters::ATTRIBUTE_DICTIONARY_NAME, "version", Parameters::SCRIPT_VERSION)
      root.set_attribute(Parameters::ATTRIBUTE_DICTIONARY_NAME, "generated_at", Time.now.to_s)

      entities = root.entities

      StairGenerator.build(entities, materials)
      RetainingWallGenerator.build(entities, materials)
      RoundWindowGenerator.build(entities, materials)
      WaterChannelGenerator.build(entities, materials)
      _lights_group, light_count = DrainageLightGenerator.build(entities, materials, model)
      HandrailGenerator.build(entities, materials) if Parameters::GENERATE_HANDRAIL
      ContextGenerator.build_left_context(entities, materials)
      ContextGenerator.build_park_context(entities, materials)
      CameraGenerator.build_camera_guide(entities, materials)

      group_count = entities.to_a.count { |e| e.is_a?(Sketchup::Group) }

      CameraGenerator.setup_scenes(model)

      model.commit_operation
    rescue StandardError => e
      model.abort_operation
      UI.messagebox("モデル生成中にエラーが発生しました:\n#{e.class}: #{e.message}")
      raise
    end

    puts "---- OutdoorStairsGenerator ----"
    puts "削除した以前のルートグループ数: #{removed_count}"
    puts "生成したグループ数（ルート直下）: #{group_count}"
    puts "配置した側溝照明の数: #{light_count}"
    puts "配置した丸窓の数: #{window_count}"
    puts "手すりの生成: #{Parameters::GENERATE_HANDRAIL ? '有効' : '無効（GENERATE_HANDRAIL = false）'}"
    puts "---------------------------------"

    UI.messagebox("モデル生成完了")
    nil
  end

  # ---------------------------------------------------------------------
  # 手すり断面テストモード（円形／楕円形／扁平形を個別に確認する）
  # ---------------------------------------------------------------------
  def self.test_handrail_sections
    HandrailSectionTest.run(Sketchup.active_model)
  end

  # ---------------------------------------------------------------------
  # シーン画像書き出し（例: D5 Render等への引き継ぎ前のスチル確認用）
  #   OutdoorStairsGenerator.export_main_scene("C:/tmp/main.png")
  # ---------------------------------------------------------------------
  def self.export_main_scene(filepath, width = Parameters::EXPORT_IMAGE_WIDTH, height = Parameters::EXPORT_IMAGE_HEIGHT)
    CameraGenerator.export_scene(Sketchup.active_model, CameraGenerator::MAIN_SCENE_NAME, filepath, width, height)
  end

  def self.export_lookdown_scene(filepath, width = Parameters::EXPORT_IMAGE_WIDTH, height = Parameters::EXPORT_IMAGE_HEIGHT)
    CameraGenerator.export_scene(Sketchup.active_model, CameraGenerator::LOOKDOWN_SCENE_NAME, filepath, width, height)
  end
end

# ---------------------------------------------------------------------
# Pluginsフォルダから読み込まれた場合のメニュー登録（多重登録防止）
# ---------------------------------------------------------------------
unless file_loaded?(__FILE__)
  if defined?(UI)
    menu = UI.menu("Plugins")
    menu.add_item("Outdoor Stairs: Generate Model") { OutdoorStairsGenerator.generate_all }
    menu.add_item("Outdoor Stairs: Test Handrail Sections") { OutdoorStairsGenerator.test_handrail_sections }
  end
  file_loaded(__FILE__)
end
