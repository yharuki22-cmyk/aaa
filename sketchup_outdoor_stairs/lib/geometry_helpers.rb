# encoding: UTF-8
# =============================================================================
# geometry_helpers.rb
# 各ジェネレータ共通で使う低レベルジオメトリ生成ヘルパー
# （直方体、円柱、断面ロフト、断面形状関数など）
# =============================================================================

module OutdoorStairsGenerator
  module GeometryHelpers
    # -------------------------------------------------------------------------
    # 直方体（底面をXY平面に作り、上方向へpushpullする）
    # x0..x1, y0..y1 の底面を作り、height 分だけ +Z へ押し出す
    # -------------------------------------------------------------------------
    def self.add_box(entities, x0, x1, y0, y1, z0, height)
      pts = [
        Geom::Point3d.new(x0, y0, z0),
        Geom::Point3d.new(x1, y0, z0),
        Geom::Point3d.new(x1, y1, z0),
        Geom::Point3d.new(x0, y1, z0)
      ]
      face = entities.add_face(pts)
      # 法線が+Zを向くように統一（下から見た巻き順により反転している場合がある）
      face.reverse! if face.normal.z < 0
      face.pushpull(height)
      face
    end

    # -------------------------------------------------------------------------
    # 水平な面（水面・地盤・発光ストライプなどに使用、押し出しなし）
    # -------------------------------------------------------------------------
    def self.add_horizontal_face(entities, x0, x1, y0, y1, z)
      pts = [
        Geom::Point3d.new(x0, y0, z),
        Geom::Point3d.new(x1, y0, z),
        Geom::Point3d.new(x1, y1, z),
        Geom::Point3d.new(x0, y1, z)
      ]
      face = entities.add_face(pts)
      face.reverse! if face && face.normal.z < 0
      face
    end

    # -------------------------------------------------------------------------
    # 円柱（底面中心 center、半径 radius、高さ height、+Z方向に押し出し）
    # -------------------------------------------------------------------------
    def self.add_cylinder(entities, center, radius, height, segments = 16)
      pts = circle_points_3d(center, radius, segments)
      face = entities.add_face(pts)
      face.reverse! if face.normal.z < 0
      face.pushpull(height)
      face
    end

    # 中心・半径からXY平面上の円周点列（Point3d配列）を返す
    def self.circle_points_3d(center, radius, segments = 16)
      (0...segments).map do |i|
        theta = 2.0 * Math::PI * i / segments
        Geom::Point3d.new(
          center.x + radius * Math.cos(theta),
          center.y + radius * Math.sin(theta),
          center.z
        )
      end
    end

    # -------------------------------------------------------------------------
    # 円環（リング）フレーム: 外径 outer_radius, 内径 inner_radius の面を
    # X-Z平面（Y一定）に origin を中心として作り、+Y方向へ depth 分だけ押し出す。
    # 擁壁の鉛直面（法線がY軸方向）に丸窓を作る用途。
    # -------------------------------------------------------------------------
    def self.add_ring_xz(entities, origin, outer_radius, inner_radius, depth, segments = 24)
      outer_pts = circle_points_xz(origin, outer_radius, segments)
      inner_pts = circle_points_xz(origin, inner_radius, segments)

      outer_face = entities.add_face(outer_pts)
      inner_face_tmp = entities.add_face(inner_pts)
      # 内側の面を消すことで、外側の面に穴が自動的に生成される
      inner_face_tmp.erase!

      outer_face.reverse! if outer_face.normal.y < 0
      outer_face.pushpull(depth)
      outer_face
    end

    # X-Z平面（Y一定）上の円周点列を返す（擁壁の丸窓・水面・ガラス面などに使用）
    def self.circle_points_xz(origin, radius, segments = 24)
      (0...segments).map do |i|
        theta = 2.0 * Math::PI * i / segments
        Geom::Point3d.new(
          origin.x + radius * Math.cos(theta),
          origin.y,
          origin.z + radius * Math.sin(theta)
        )
      end
    end

    # 円盤（ガラス・発光面用）: X-Z平面に法線が±Y方向を向く円を作る
    def self.add_disc_xz(entities, origin, radius, segments = 24)
      pts = circle_points_xz(origin, radius, segments)
      entities.add_face(pts)
    end

    # -------------------------------------------------------------------------
    # 手すり断面形状ジェネレータ（ローカル2D座標 [w, v] の配列を返す）
    # 全て同じ segments 数を返すため、異なる断面同士でも移行区間をロフト可能
    # -------------------------------------------------------------------------

    # 円形断面
    def self.circle_profile(radius, segments)
      (0...segments).map do |i|
        theta = 2.0 * Math::PI * i / segments
        [radius * Math.cos(theta), radius * Math.sin(theta)]
      end
    end

    # 楕円断面
    def self.ellipse_profile(half_w, half_h, segments)
      (0...segments).map do |i|
        theta = 2.0 * Math::PI * i / segments
        [half_w * Math.cos(theta), half_h * Math.sin(theta)]
      end
    end

    # 扁平（角丸長方形近似・スーパー楕円）断面
    def self.flat_profile(half_w, half_h, segments, exponent = 4.0)
      power = 2.0 / exponent
      (0...segments).map do |i|
        theta = 2.0 * Math::PI * i / segments
        [signed_pow(Math.cos(theta), power) * half_w,
         signed_pow(Math.sin(theta), power) * half_h]
      end
    end

    def self.signed_pow(v, p)
      sign = v.zero? ? 0.0 : (v.negative? ? -1.0 : 1.0)
      sign * (v.abs**p)
    end

    # -------------------------------------------------------------------------
    # 断面を直線経路に沿って押し出す（Follow Me相当の簡易ロフト処理）
    # start_point → end_point の直線に沿って、start側とend側で異なる断面
    # （start_profile / end_profile、共に同じ点数のローカル2D配列）を接続する。
    # up_vector: 断面のローカルV軸（鉛直に近いベクトル）の基準
    # -------------------------------------------------------------------------
    def self.loft_profiles(entities, start_point, end_point, up_vector, start_profile, end_profile)
      direction = end_point - start_point
      return nil if direction.length < 0.1.mm

      u = direction.clone
      u.normalize!
      up = up_vector.clone
      up.normalize!

      # u と up が平行に近い場合は基準ベクトルをずらして特異点を回避
      up = Geom::Vector3d.new(1, 0, 0) if u.parallel?(up)

      w = u.cross(up)
      w.normalize!
      v = w.cross(u)
      v.normalize!

      start_ring = start_profile.map { |pw, pv| start_point.offset(w, pw).offset(v, pv) }
      end_ring   = end_profile.map   { |pw, pv| end_point.offset(w, pw).offset(v, pv) }

      segments = start_ring.length

      # 始端キャップ（外向き = -u方向）
      start_cap = entities.add_face(start_ring)
      start_cap.reverse! if start_cap.normal.dot(u) > 0

      # 終端キャップ（外向き = +u方向）
      end_cap = entities.add_face(end_ring)
      end_cap.reverse! if end_cap.normal.dot(u) < 0

      # 側面（四角形パッチ）
      segments.times do |i|
        j = (i + 1) % segments
        quad = [start_ring[i], start_ring[j], end_ring[j], end_ring[i]]
        side = entities.add_face(quad)
        next unless side # 縮退面（点が重なる等)はnilが返るためスキップ

        centroid = Geom::Point3d.new(
          (quad[0].x + quad[1].x + quad[2].x + quad[3].x) / 4.0,
          (quad[0].y + quad[1].y + quad[2].y + quad[3].y) / 4.0,
          (quad[0].z + quad[1].z + quad[2].z + quad[3].z) / 4.0
        )
        axis_point = start_point.offset(u, u.dot(centroid - start_point))
        outward = centroid - axis_point
        side.reverse! if outward.valid? && side.normal.dot(outward) < 0
      end

      true
    end
  end
end
