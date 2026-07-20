# -*- coding: utf-8 -*-
"""plan_data.py の寸法データから AutoCAD で開ける DXF を生成する。

usage: python generate_dxf.py [出力パス]
"""
import sys

import ezdxf
from ezdxf import units
from ezdxf.enums import TextEntityAlignment

import plan_data as d

WALL_W = 120          # 壁の見付け幅 (LWPOLYLINE の太さ)
TEXT_H = 300          # 室名文字高 (1:100 で紙面3mm)
DIM_TEXT_H = 250


def new_doc():
    doc = ezdxf.new("R2010", setup=True)
    doc.units = units.MM
    doc.styles.add("JP", font="ipag.ttf")

    for name, color, ltype in [
        ("敷地境界", 1, "PHANTOM"),
        ("通り芯", 1, "CENTER"),
        ("壁", 7, "CONTINUOUS"),
        ("室名", 4, "CONTINUOUS"),
        ("寸法", 3, "CONTINUOUS"),
        ("外構", 6, "CONTINUOUS"),
        ("図枠", 7, "CONTINUOUS"),
    ]:
        doc.layers.add(name, color=color, linetype=ltype)

    style = doc.dimstyles.duplicate_entry("EZDXF", "JIS100")
    style.dxf.dimtxt = DIM_TEXT_H
    style.dxf.dimasz = 150
    style.dxf.dimexo = 150
    style.dxf.dimexe = 150
    style.dxf.dimgap = 60
    style.dxf.dimtxsty = "JP"
    style.dxf.dimdec = 0
    style.dxf.dimlfac = 1.0
    return doc


def rect(msp, x1, y1, x2, y2, layer, width=0.0):
    msp.add_lwpolyline(
        [(x1, y1), (x2, y1), (x2, y2), (x1, y2)],
        close=True,
        dxfattribs={"layer": layer, "const_width": width},
    )


def label(msp, x, y, text, h=TEXT_H, layer="室名"):
    for i, line in enumerate(text.split("\n")):
        msp.add_text(
            line, height=h, dxfattribs={"layer": layer, "style": "JP"}
        ).set_placement((x, y - i * h * 1.6), align=TextEntityAlignment.MIDDLE_CENTER)


def hdim(msp, x1, x2, y, offset):
    dim = msp.add_linear_dim(
        base=(x1, y + offset), p1=(x1, y), p2=(x2, y),
        dimstyle="JIS100", dxfattribs={"layer": "寸法"},
    )
    dim.render()


def vdim(msp, y1, y2, x, offset):
    dim = msp.add_linear_dim(
        base=(x + offset, y1), p1=(x, y1), p2=(x, y2), angle=90,
        dimstyle="JIS100", dxfattribs={"layer": "寸法"},
    )
    dim.render()


def main(out_path="output/site_floor_plan.dxf"):
    doc = new_doc()
    msp = doc.modelspace()
    gx, gy = d.GX, d.GY

    # 敷地境界
    rect(msp, 0, 0, d.SITE_W, d.SITE_D, "敷地境界")
    label(msp, d.SITE_W / 2, d.SITE_D + 900, "隣地境界線", layer="室名")
    label(msp, d.SITE_W / 2, -2600, "隣地境界線", layer="室名")
    label(msp, -3600, d.SITE_D / 2, "隣地境界線", layer="室名")
    label(msp, d.SITE_W + 1800, d.SITE_D / 2, "道路境界線", layer="室名")

    # 通り芯 + 符号
    for name, x in gx.items():
        msp.add_line((x, -1800), (x, d.SITE_D + 300), dxfattribs={"layer": "通り芯"})
        msp.add_circle((x, -2200), 350, dxfattribs={"layer": "通り芯"})
        label(msp, x, -2200, name, h=280, layer="通り芯")
    for num, y in gy.items():
        msp.add_line((-2600, y), (d.SITE_W + 300, y), dxfattribs={"layer": "通り芯"})
        msp.add_circle((-3000, y), 350, dxfattribs={"layer": "通り芯"})
        label(msp, -3000, y, str(num), h=280, layer="通り芯")

    # 建物外壁
    rect(msp, *d.MAIN_BLOCK, "壁", width=WALL_W)
    rect(msp, *d.EAST_BLOCK, "壁", width=WALL_W)

    # 部屋 (間仕切 + 室名)
    for x1, y1, x2, y2, name in d.ROOMS:
        rect(msp, x1, y1, x2, y2, "壁", width=WALL_W / 2)
        label(msp, (x1 + x2) / 2, (y1 + y2) / 2, name)
    label(msp, *d.LDK_LABEL)

    # 外構
    for x1, y1, x2, y2, name in (d.TERRACE, d.PORCH, d.PARKING):
        rect(msp, x1, y1, x2, y2, "外構")
        label(msp, (x1 + x2) / 2, (y1 + y2) / 2, name)
    # 駐車場の対角線(舗装記号)
    px1, py1, px2, py2, _ = d.PARKING
    msp.add_line((px1, py1), (px2, (py1 + py2) / 2), dxfattribs={"layer": "外構"})
    msp.add_line((px1, py2), (px2, (py1 + py2) / 2), dxfattribs={"layer": "外構"})
    label(msp, 2800, d.SITE_D - 700, d.FENCE_NOTE, h=260, layer="外構")
    for x, y, r, solid in d.TREES:
        attribs = {"layer": "外構"}
        if not solid:
            attribs["linetype"] = "DASHED"
        msp.add_circle((x, y), r, dxfattribs=attribs)

    # ---- 寸法 ----
    # 上部: い-は-ほ-と-り 各1,820 と敷地全幅 11,000
    for a, b in [("い", "は"), ("は", "ほ"), ("ほ", "と"), ("と", "り")]:
        hdim(msp, gx[a], gx[b], d.SITE_D, 1600)
    hdim(msp, 0, d.SITE_W, d.SITE_D, 2600)

    # 下部: 910 / 4,550 / 1,820, 全体 7,280, り→道路境界 2,000
    for a, b in [("い", "ろ"), ("ろ", "と"), ("と", "り")]:
        hdim(msp, gx[a], gx[b], 0, -3400)
    hdim(msp, gx["い"], gx["り"], 0, -4200)
    hdim(msp, gx["り"], d.SITE_W, 0, -4200)
    hdim(msp, 0, d.SITE_W, 0, -5000)

    # 左側: 通り芯 0→6 の 910/1,820/910/1,820, まとめ 5,460,
    #        テラス 1,000, 敷地 12,500
    for a, b in [(6, 5), (5, 3), (3, 2), (2, 0)]:
        vdim(msp, gy[a], gy[b], 0, -4400)
    vdim(msp, gy[0], gy[6], 0, -5200)
    vdim(msp, gy[0] - d.TERRACE_DEPTH, gy[0], 0, -4400)
    vdim(msp, 0, d.SITE_D, 0, -6000)

    # 右側: 敷地 12,500, 北境界→駐車場 2,500, 0通り→敷地基準 2,730
    vdim(msp, 0, d.SITE_D, d.SITE_W, 3000)
    vdim(msp, d.PARKING[1], d.SITE_D, d.SITE_W, 2000)
    vdim(msp, gy[0], gy[6], d.SITE_W, 2000)

    # 図面タイトル
    tx, ty = d.SITE_W / 2, -7600
    rect(msp, tx - 4200, ty - 550, tx + 4200, ty + 550, "図枠")
    label(msp, tx, ty, d.TITLE, h=500, layer="図枠")

    doc.saveas(out_path)
    print(f"saved: {out_path}")

    auditor = doc.audit()
    print(f"audit: errors={len(auditor.errors)} fixes={len(auditor.fixes)}")


if __name__ == "__main__":
    main(*sys.argv[1:])
