# -*- coding: utf-8 -*-
"""参考DWG(をDXF変換したもの)から配置図兼1階平面図の幾何を抽出する。

参考DWGはAspose.CAD評価版でDXF化しているため、文字(08文字)と寸法(09寸法)は
線分に分解されてしまっている。そこで幾何レイヤのみを抽出し、文字・寸法は
generate_dxf.py 側で本物のTEXT/DIMENSIONとして再構築する。

縮尺の校正: 柱・壁レイヤの通り芯グリッド(910mmモジュール)から
図面単位→mm の係数を求め、敷地南西角を原点(0,0)とする実寸mm座標に変換する。

usage: python extract_reference.py <reference.dxf> [reference_geometry.json]
"""
import json
import sys

import ezdxf

# 左シート「配置図兼1階平面図」の領域 (図面単位)
REGION = (200, 550, 700, 1090)

# 抽出対象レイヤ (08文字・09寸法は分解済みのため除外)
KEEP_LAYERS = [
    "0", "02柱・壁(断面線)", "03開口断面線", "04開口見えがかり線",
    "05設備機器", "07家具", "10線一般(中線)", "12切断線",
    "13境界線", "16外構",
]


def decode_layer(name: str) -> str:
    """DXFの \\U+XXXX エスケープをデコードする。"""
    out, i = "", 0
    while i < len(name):
        if name[i : i + 3] == "\\U+":
            out += chr(int(name[i + 3 : i + 7], 16))
            i += 7
        else:
            out += name[i]
            i += 1
    # 全角括弧のゆらぎを正規化
    return out.replace("（", "(").replace("）", ")")


def in_region(pts):
    x1, y1, x2, y2 = REGION
    return all(x1 <= x <= x2 and y1 <= y <= y2 for x, y in pts)


def cluster(vals, tol=1.5):
    vals = sorted(vals)
    groups = [[vals[0]]]
    for v in vals[1:]:
        if v - groups[-1][-1] <= tol:
            groups[-1].append(v)
        else:
            groups.append([v])
    return [sum(g) / len(g) for g in groups]


def main(src, dst="reference_geometry.json"):
    doc = ezdxf.readfile(src)
    msp = doc.modelspace()

    chains = {}   # layer -> [ [ [x,y], ... ], ... ]
    for e in msp.query("POLYLINE"):
        lay = decode_layer(e.dxf.layer)
        if lay not in KEEP_LAYERS:
            continue
        pts = [(v.dxf.location.x, v.dxf.location.y) for v in e.vertices]
        if len(pts) < 2 or not in_region(pts):
            continue
        chains.setdefault(lay, []).append(pts)

    # --- 校正: 壁レイヤの垂直線・水平線から通り芯グリッドを求める ---
    wall = chains["02柱・壁(断面線)"]
    vx, hy = [], []
    for pts in wall:
        for a, b in zip(pts, pts[1:]):
            if abs(a[0] - b[0]) < 0.05 and abs(a[1] - b[1]) > 1:
                vx.append(a[0])
            if abs(a[1] - b[1]) < 0.05 and abs(a[0] - b[0]) > 1:
                hy.append(a[1])
    cx, cy = cluster(vx), cluster(hy)
    # 壁は厚み分のペアで現れる → ペアの中央が通り芯
    # X: い通り = 最初のペア中央, り通り = 最後のペア中央 (8スパン = 7,280mm)
    gx_i = (cx[0] + cx[1]) / 2          # い
    gx_ri = (cx[-2] + cx[-1]) / 2       # り
    scale = 7280.0 / (gx_ri - gx_i)
    gy_0 = (cy[0] + cy[1]) / 2          # 0通り
    gy_6 = (cy[-2] + cy[-1]) / 2        # 6通り
    print(f"scale = {scale:.5f} mm/unit  (0-6スパン検算: {(gy_6 - gy_0) * scale:.0f} ≒ 5460)")

    # --- 原点: 敷地南西角。13境界線レイヤには四隅の円マークだけが入って
    # いるので、各円の外接矩形中心=角の座標として求める ---
    corners = []
    for pts in chains["13境界線"]:
        xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
        corners.append(((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2))
    u0 = min(c[0] for c in corners)
    v0 = min(c[1] for c in corners)
    site_w = (max(c[0] for c in corners) - u0) * scale
    site_d = (max(c[1] for c in corners) - v0) * scale
    print(f"敷地 {site_w:.0f} × {site_d:.0f} (図面の寸法値は 11,000 × 12,500)")

    # --- 敷地境界の矩形は元図で12切断線レイヤに描かれているため、
    # 角から角まで走る長い線分を13境界線へ移す ---
    def near_corner(p, tol=1.0):
        return any(abs(p[0] - c[0]) < tol and abs(p[1] - c[1]) < tol for c in corners)

    moved, keep = [], []
    for pts in chains.get("12切断線", []):
        if len(pts) == 2 and near_corner(pts[0]) and near_corner(pts[1]):
            moved.append(pts)
        else:
            keep.append(pts)
    chains["12切断線"] = keep
    chains["13境界線"].extend(moved)
    print(f"境界矩形 {len(moved)} 辺を 12切断線 → 13境界線 に移動")

    def tr(p):
        return [round((p[0] - u0) * scale, 1), round((p[1] - v0) * scale, 1)]

    out = {
        "meta": {
            "source": "reference DWG (配置図兼1階平面図 S=1:100)",
            "scale_mm_per_unit": scale,
            "site": [round(site_w, 1), round(site_d, 1)],
            # 通り芯は910モジュールの理想位置。Yは6通り(北面=北境界から2,500)
            # を基準に910ずつ下がる。元図は0通りの外壁だけ20mmほど南に
            # ずれて描かれているが、通り芯・寸法は設計値どおりとする。
            "grid_x": [round((gx_i - u0) * scale + i * 910, 1) for i in range(9)],
            "grid_y": [round((gy_6 - v0) * scale - (6 - j) * 910, 1) for j in range(7)],
        },
        "layers": {
            lay: [[tr(p) for p in pts] for pts in lst]
            for lay, lst in chains.items()
        },
    }
    with open(dst, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    n = sum(len(v) for v in out["layers"].values())
    print(f"saved {dst}: {n} chains")
    print("grid_x:", out["meta"]["grid_x"])
    print("grid_y:", out["meta"]["grid_y"])


if __name__ == "__main__":
    main(*sys.argv[1:])
