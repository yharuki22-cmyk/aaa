# -*- coding: utf-8 -*-
"""reference_geometry.json(参考DWGから抽出した実寸幾何)と写真から読み取った
注記・寸法から、AutoCADで開けるDXFを生成する。

幾何(壁・建具・設備・家具・外構・境界)は参考DWGの実データ。
文字・寸法・通り芯は本物のTEXT/DIMENSION/LINEとして再構築する。

usage: python generate_dxf.py [出力パス]
"""
import json
import sys

import ezdxf
from ezdxf import units
from ezdxf.enums import TextEntityAlignment

TEXT_H = 300        # 室名文字高 (1:100で紙面3mm)
DIM_TEXT_H = 250

# 参考図面の画層構成に合わせた画層 (色・線種はこちらで設定)
LAYERS = [
    ("01通り芯", 1, "CENTER"),
    ("02柱・壁(断面線)", 7, "CONTINUOUS"),
    ("03開口断面線", 5, "CONTINUOUS"),
    ("04開口見えがかり線", 3, "CONTINUOUS"),
    ("05設備機器", 1, "CONTINUOUS"),
    ("07家具", 30, "CONTINUOUS"),
    ("08文字", 7, "CONTINUOUS"),
    ("09寸法", 3, "CONTINUOUS"),
    ("10線一般(中線)", 8, "CONTINUOUS"),
    ("12切断線", 33, "CONTINUOUS"),
    ("13境界線", 6, "PHANTOM"),
    ("14図枠", 7, "CONTINUOUS"),
    ("16外構", 4, "CONTINUOUS"),
]

X_NAMES = ["い", "ろ", "は", "に", "ほ", "へ", "と", "ち", "り"]

# 植栽 (写真からの目測。参考DWGには描かれていない): (x, y, r, 実線か)
TREES = [
    (3_050, 1_800, 600, True), (3_950, 1_950, 620, True), (4_800, 1_750, 580, True),
    (5_400, 1_100, 900, False), (7_300, 1_500, 950, False), (9_400, 1_400, 900, False),
]


def new_doc():
    doc = ezdxf.new("R2010", setup=True)
    doc.units = units.MM
    doc.styles.add("JP", font="ipag.ttf")     # 室名など日本語用
    doc.styles.add("DIM", font="arial.ttf")   # 寸法値: 半角英数フォント
    for name, color, ltype in LAYERS:
        doc.layers.add(name, color=color, linetype=ltype)

    style = doc.dimstyles.duplicate_entry("EZDXF", "JIS100")
    style.dxf.dimtxt = DIM_TEXT_H
    style.dxf.dimtsz = 0
    style.dxf.dimblk = "DOT"       # 端末は黒丸
    style.dxf.dimasz = 100
    style.dxf.dimexo = 150
    style.dxf.dimexe = 150
    style.dxf.dimgap = 60
    style.dxf.dimtxsty = "DIM"
    style.dxf.dimdec = 0
    doc.header["$LTSCALE"] = 30    # 一点鎖線などの線種ピッチをmm図面向けに
    return doc


def label(msp, x, y, text, h=TEXT_H, layer="08文字", rotation=0.0):
    for i, line in enumerate(text.split("\n")):
        msp.add_text(
            line, height=h,
            dxfattribs={"layer": layer, "style": "JP", "rotation": rotation},
        ).set_placement((x, y - i * h * 1.6), align=TextEntityAlignment.MIDDLE_CENTER)


def hdim(msp, x1, x2, y, dimline_y, text=None):
    # 写真の表記に合わせてカンマ区切りの寸法値を明示する
    dim = msp.add_linear_dim(
        base=(x1, dimline_y), p1=(x1, y), p2=(x2, y),
        text=text or f"{round(abs(x2 - x1)):,}",
        dimstyle="JIS100", dxfattribs={"layer": "09寸法"},
    )
    dim.render()


def vdim(msp, y1, y2, x, dimline_x, text=None):
    dim = msp.add_linear_dim(
        base=(dimline_x, y1), p1=(x, y1), p2=(x, y2), angle=90,
        text=text or f"{round(abs(y2 - y1)):,}",
        dimstyle="JIS100", dxfattribs={"layer": "09寸法"},
    )
    dim.render()


def main(out_path="output/site_floor_plan.dxf"):
    with open("reference_geometry.json", encoding="utf-8") as f:
        data = json.load(f)
    meta = data["meta"]
    W, D = meta["site"]                      # 実測 10,980 × 12,500
    gx = dict(zip(X_NAMES, meta["grid_x"]))
    gy = {i: y for i, y in enumerate(meta["grid_y"])}

    doc = new_doc()
    msp = doc.modelspace()

    # ---- 参考DWGから抽出した幾何をそのまま配置 ----
    for lay, chains in data["layers"].items():
        for pts in chains:
            msp.add_lwpolyline(pts, dxfattribs={"layer": lay})

    # ---- 通り芯 + 符号 ----
    for name, x in gx.items():
        msp.add_line((x, -3_600), (x, D + 2_300), dxfattribs={"layer": "01通り芯"})
        msp.add_circle((x, -4_000), 350, dxfattribs={"layer": "01通り芯"})
        label(msp, x, -4_000, name, h=280, layer="01通り芯")
    for num, y in gy.items():
        msp.add_line((-3_600, y), (W + 2_300, y), dxfattribs={"layer": "01通り芯"})
        msp.add_circle((-4_000, y), 350, dxfattribs={"layer": "01通り芯"})
        label(msp, -4_000, y, str(num), h=280, layer="01通り芯")

    # ---- 寸法 ----
    # 上部: い-は-ほ-と-り 各1,820 と敷地全幅 (元図は10,980だが寸法値は11,000)
    for a, b in [("い", "は"), ("は", "ほ"), ("ほ", "と"), ("と", "り")]:
        hdim(msp, gx[a], gx[b], D, D + 1_600)
    hdim(msp, 0, W, D, D + 2_600, text="11,000")
    # フェンスの控え 100 (北西角)
    hdim(msp, 0, 100, D - 1_200, D - 1_200)

    # 下部: 910 / 4,550 / 1,820 → 7,280 / 2,000 → 11,000
    for a, b in [("い", "ろ"), ("ろ", "と"), ("と", "り")]:
        hdim(msp, gx[a], gx[b], 0, -1_400)
    hdim(msp, gx["い"], gx["り"], 0, -2_200)
    hdim(msp, gx["り"], W, 0, -2_200)
    hdim(msp, 0, W, 0, -3_000, text="11,000")

    # 左側: 6-5:910 / 5-3:1,820 / 3-2:910 / 2-0:1,820 → 5,460 / テラス1,000 / 12,500
    for a, b in [(6, 5), (5, 3), (3, 2), (2, 0)]:
        vdim(msp, gy[a], gy[b], 0, -1_200)
    vdim(msp, gy[0] - 1_000, gy[0], 0, -1_200)      # テラス(0通り外壁面から1,000)
    vdim(msp, gy[0], gy[6], 0, -2_000)
    vdim(msp, 0, D, 0, -2_800)

    # 右側: 北側境界→6通り 2,500 / 0-6通り 5,460 / 12,500
    vdim(msp, gy[6], D, W, W + 1_400)
    vdim(msp, gy[0], gy[6], W, W + 1_400)
    vdim(msp, 0, D, W, W + 2_200)

    # ---- 室名・注記 ----
    rooms = [
        (2_155, 9_545, "便所"), (2_610, 8_180, "浴室"),
        (4_430, 9_090, "洗面\n洗濯室"), (6_705, 9_090, "階段"),
        (5_795, 8_635, "物入"), (4_500, 6_700, "LDK"),
        (8_070, 8_600, "玄関"), (8_070, 6_830, "ホール"),
        (9_900, 9_080, "ポーチ"), (4_430, 3_940, "テラス"),
        (7_190, 11_275, "駐車場"),
    ]
    for x, y, name in rooms:
        label(msp, x, y, name)
    label(msp, W / 2, D + 700, "隣地境界線")
    label(msp, -600, 2_200, "隣地境界線", rotation=90)
    label(msp, 2_300, -700, "隣地境界線")
    label(msp, W + 600, 6_000, "道路境界線", rotation=90)
    label(msp, 2_500, 11_000, "アルミフェンス H=900", h=260)
    label(msp, 8_000, 4_100, "通し柱を示す", h=260)
    msp.add_line((8_770, 4_180), (gx["り"], gy[0]), dxfattribs={"layer": "08文字"})

    # ---- 方位 (北西角の外) ----
    cx, cy_, r = -2_200, D + 2_600, 700
    msp.add_circle((cx, cy_), r, dxfattribs={"layer": "10線一般(中線)"})
    msp.add_lwpolyline(
        [(cx, cy_ - r), (cx, cy_ + r), (cx - r * 0.35, cy_ - r * 0.1)],
        close=True, dxfattribs={"layer": "10線一般(中線)"})
    label(msp, cx, cy_ + r + 350, "N", h=350, layer="10線一般(中線)")

    # ---- 植栽 (写真より) ----
    for x, y, r, solid in TREES:
        attribs = {"layer": "16外構"}
        if not solid:
            attribs["linetype"] = "DASHED"
        msp.add_circle((x, y), r, dxfattribs=attribs)

    # ---- 図面タイトル ----
    tx, ty = W / 2, -5_600
    msp.add_lwpolyline(
        [(tx - 4_200, ty - 550), (tx + 4_200, ty - 550),
         (tx + 4_200, ty + 550), (tx - 4_200, ty + 550)],
        close=True, dxfattribs={"layer": "14図枠"})
    label(msp, tx, ty, "配置図兼1階平面図  S=1:100", h=500, layer="14図枠")

    doc.saveas(out_path)
    print(f"saved: {out_path}")
    auditor = doc.audit()
    print(f"audit: errors={len(auditor.errors)} fixes={len(auditor.fixes)}")


if __name__ == "__main__":
    main(*sys.argv[1:])
