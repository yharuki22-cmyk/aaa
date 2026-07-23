# encoding: UTF-8
# =============================================================================
# cleanup.rb
# 再実行時に、以前このスクリプトが生成したジオメトリ・シーンだけを
# 安全に削除するための処理。属性ディクショナリで判定するため、
# ユーザーが作成した他のグループやシーンには一切影響しない。
# =============================================================================

module OutdoorStairsGenerator
  module Cleanup
    # モデル直下から、本スクリプトが生成したルートグループを探して削除する
    def self.remove_previous_geometry(model)
      dict_name = Parameters::ATTRIBUTE_DICTIONARY_NAME
      removed_count = 0

      model.entities.to_a.each do |entity|
        next unless entity.is_a?(Sketchup::Group)
        next unless entity.get_attribute(dict_name, "is_root", false)

        entity.erase!
        removed_count += 1
      end

      removed_count
    end

    # 本スクリプトが作成したシーン（Camera_Main / Camera_Lookdown）を削除する
    def self.remove_previous_scenes(model, scene_names)
      scene_names.each do |name|
        page = model.pages[name]
        model.pages.erase(page) if page
      end
    end
  end
end
