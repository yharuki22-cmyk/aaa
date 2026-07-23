# encoding: UTF-8
# =============================================================================
# camera_generator.rb
# 夜間パース確認用のカメラ位置ガイド（Camera_Guideグループ）と、
# SketchUpのScene（Page）登録・画像書き出しを行う。
# =============================================================================

module OutdoorStairsGenerator
  module CameraGenerator
    MAIN_SCENE_NAME = "Camera_Main".freeze
    LOOKDOWN_SCENE_NAME = "Camera_Lookdown".freeze

    # ---------------------------------------------------------------------
    # カメラ位置・視点先を3D空間内に可視化するガイドジオメトリ
    # （実際のレンダリングには影響しない、モデル調整用の目印）
    # ---------------------------------------------------------------------
    def self.build_camera_guide(parent_entities, materials)
      group = parent_entities.add_group
      group.name = "Camera_Guide"

      add_marker_and_line(
        group.entities,
        point_from(Parameters::CAMERA_MAIN_EYE),
        point_from(Parameters::CAMERA_MAIN_TARGET)
      )
      add_marker_and_line(
        group.entities,
        point_from(Parameters::CAMERA_LOOKDOWN_EYE),
        point_from(Parameters::CAMERA_LOOKDOWN_TARGET)
      )

      group.material = materials[:post_metal]
      group
    end

    def self.point_from(coords)
      Geom::Point3d.new(coords[0], coords[1], coords[2])
    end
    private_class_method :point_from

    def self.add_marker_and_line(entities, eye, target)
      marker_size = 200.mm
      GeometryHelpers.add_box(
        entities,
        eye.x - marker_size / 2.0, eye.x + marker_size / 2.0,
        eye.y - marker_size / 2.0, eye.y + marker_size / 2.0,
        eye.z - marker_size / 2.0, marker_size
      )
      entities.add_line(eye, target)
    end
    private_class_method :add_marker_and_line

    # ---------------------------------------------------------------------
    # SketchUpのカメラ・シーン(Page)を登録する
    # 既に同名のシーンが存在する場合は削除してから作り直す（再実行対応）
    # ---------------------------------------------------------------------
    def self.setup_scenes(model)
      Cleanup.remove_previous_scenes(model, [MAIN_SCENE_NAME, LOOKDOWN_SCENE_NAME])

      view = model.active_view

      apply_camera(
        view, Parameters::CAMERA_MAIN_EYE, Parameters::CAMERA_MAIN_TARGET, Parameters::CAMERA_MAIN_FOV_DEG
      )
      model.pages.add(MAIN_SCENE_NAME)

      apply_camera(
        view, Parameters::CAMERA_LOOKDOWN_EYE, Parameters::CAMERA_LOOKDOWN_TARGET, Parameters::CAMERA_LOOKDOWN_FOV_DEG
      )
      model.pages.add(LOOKDOWN_SCENE_NAME)
    end

    def self.apply_camera(view, eye_coords, target_coords, fov_deg)
      eye = point_from(eye_coords)
      target = point_from(target_coords)
      up = Geom::Vector3d.new(0, 0, 1)

      camera = Sketchup::Camera.new(eye, target, up)
      camera.perspective = true
      camera.fov = fov_deg
      view.camera = camera
    end
    private_class_method :apply_camera

    # ---------------------------------------------------------------------
    # 指定したシーンをアクティブにして画像を書き出す
    # （D5 Render / Enscape等へ引き継ぐ前のスチル確認用）
    # ---------------------------------------------------------------------
    def self.export_scene(model, scene_name, filepath,
                           width = Parameters::EXPORT_IMAGE_WIDTH,
                           height = Parameters::EXPORT_IMAGE_HEIGHT)
      page = model.pages[scene_name]
      return false unless page

      model.pages.selected_page = page
      view = model.active_view
      view.write_image(
        filename: filepath,
        width: width,
        height: height,
        antialias: true,
        compression: 0.9
      )
      true
    end
  end
end
