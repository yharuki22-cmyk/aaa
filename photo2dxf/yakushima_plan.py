# -*- coding: utf-8 -*-
"""「屋久島の家」1階平面図 S=1:100 を写真から読み取り作図する(第一版)。

確実に読めた情報:
  - X通り芯 X1〜X13 (13本 @1,950 = 23,400)
  - 幅 約5,850 (上部 2,925+2,925 / 下部 3,300+600+1,950)
  - 室: 土間・車庫・台所・食堂・テラス(乱形石張り)・家族室・浴室・
        洗面所・子供室・寝室・納戸
写真に内部寸法が全ては写っていないため、間仕切り・建具の位置は推定を含む。
室ブロックは ROOMS で編集可能。

レイヤは住宅の作図標準(通り芯=赤CENTER1, 躯体=緑, 寸法=水色, 家具=水色,
床目地=極細赤, 外構=水色)に準拠。

usage: python yakushima_plan.py [出力パス]
"""
import math
import sys

import ezdxf
from ezdxf import units
from ezdxf.enums import TextEntityAlignment

# ---- 通り芯 ----
PITCH = 1_950
GX = {f"X{i+1}": i * PITCH for i in range(13)}     # X1..X13
WIDTH = 5_850
GY = {"Y1": 0, "Y2": 3_300, "Y3": 3_900, "Y5": WIDTH}   # 読み取れた主要Y

T = 150         # 壁厚
TEXT_H = 300

LAYERS = [
    ("01通り芯", 1, "CENTER1", 9),
    ("02躯体",   3, "Continuous", 30),
    ("03開口断面線", 7, "Continuous", 18),
    ("04開口見えがかり線", 4, "Continuous", 9),
    ("05設備機器", 7, "Continuous", 18),
    ("06床の目地", 1, "Continuous", 9),
    ("07家具",   4, "DASHED1", 9),
    ("08文字",   7, "Continuous", 18),
    ("09寸法",   4, "Continuous", 9),
    ("10線一般(中線)", 7, "Continuous", 15),
    ("16外構",   4, "Continuous", 13),
    ("18ハッチング", 1, "Continuous", 9),
]

# 室ブロック: 名前 -> (x1, y1, x2, y2)  (X1/Y1原点, mm)
X = GX
ROOMS = {
    "車庫":   (X["X1"], 0, X["X3"], 3_900),
    "土間":   (X["X1"], 3_900, X["X3"], WIDTH),
    "食堂":   (X["X4"], 0, X["X6"], 2_925),
    "台所":   (X["X4"], 2_925, X["X6"], WIDTH),
    "テラス": (X["X6"], 0, X["X7"], WIDTH),
    "家族室": (X["X7"], 0, X["X9"], 2_925),
    "浴室":   (X["X8"], 2_925, X["X9"], WIDTH),
    "洗面所": (X["X7"], 2_925, X["X8"], WIDTH),
    "子供室": (X["X9"], 0, X["X13"], 2_925),
    "寝室":   (X["X9"], 2_925, X["X12"], WIDTH),
    "納戸":   (X["X12"], 2_925, X["X13"], WIDTH),
}
# 階段・水回りの小室(X3-X4)は個別作図


def new_doc():
    doc = ezdxf.new("R2010", setup=True)
    doc.units = units.MM
    # 日本語はMSゴシック(日本語AutoCAD標準)。無い環境向けにbigfontも指定。
    doc.styles.add("JP", font="msgothic.ttc")
    doc.styles.add("DIM", font="arial.ttf")
    for name, patt in [("CENTER1", [50, 25, -6, 5, -6]), ("DASHED1", [12, 6, -6])]:
        if name in doc.linetypes:
            doc.linetypes.remove(name)
        doc.linetypes.add(name, pattern=patt, description=name)
    for name, color, lt, lw in LAYERS:
        doc.layers.add(name, color=color, linetype=lt, lineweight=lw)
    # 寸法端末=丸(_Dot)
    blk = doc.blocks.new("_Dot")
    blk.add_lwpolyline([(0, 0), (0, 0)], dxfattribs={"const_width": 40, "color": 0})
    s = doc.dimstyles.duplicate_entry("EZDXF", "S100")
    s.dxf.dimtxt = 250
    s.dxf.dimtsz = 0
    s.dxf.dimblk = "_Dot"
    s.dxf.dimasz = 50
    s.dxf.dimexe = 100
    s.dxf.dimexo = 200
    s.dxf.dimgap = 60
    s.dxf.dimdec = 0
    s.dxf.dimtxsty = "DIM"
    s.dxf.dimclrd = 4
    s.dxf.dimclrt = 4
    doc.header["$LTSCALE"] = 30
    return doc


class Draw:
    def __init__(self, msp):
        self.msp = msp

    def line(self, a, b, layer):
        self.msp.add_line(a, b, dxfattribs={"layer": layer})

    def rect(self, x1, y1, x2, y2, layer):
        self.msp.add_lwpolyline([(x1, y1), (x2, y1), (x2, y2), (x1, y2)],
                                close=True, dxfattribs={"layer": layer})

    def text(self, x, y, s, h=TEXT_H, layer="08文字", style="JP", rot=0.0):
        self.msp.add_text(s, height=h,
            dxfattribs={"layer": layer, "style": style, "rotation": rot}
        ).set_placement((x, y), align=TextEntityAlignment.MIDDLE_CENTER)

    def wall_band(self, x1, y1, x2, y2):
        """芯線(x1,y1)-(x2,y2)に沿って壁厚Tの帯を1枚描く(閉ポリライン)。"""
        t = T / 2
        if abs(x2 - x1) < 1:      # 縦壁
            self.rect(x1 - t, min(y1, y2) - t, x1 + t, max(y1, y2) + t, "02躯体")
        else:                      # 横壁
            self.rect(min(x1, x2) - t, y1 - t, max(x1, x2) + t, y1 + t, "02躯体")

    def room_walls(self, x1, y1, x2, y2):
        """室の四周を壁厚Tの帯で描く(隣室と芯共有で連続)。"""
        self.wall_band(x1, y1, x1, y2)   # 左
        self.wall_band(x2, y1, x2, y2)   # 右
        self.wall_band(x1, y1, x2, y1)   # 下
        self.wall_band(x1, y2, x2, y2)   # 上

    def door(self, hinge, jamb, side=1):
        hx, hy = hinge
        jx, jy = jamb
        w = math.hypot(jx - hx, jy - hy)
        aw = math.degrees(math.atan2(jy - hy, jx - hx))
        an = aw + 90 * side
        lx = hx + w * math.cos(math.radians(an))
        ly = hy + w * math.sin(math.radians(an))
        self.line((hx, hy), (lx, ly), "04開口見えがかり線")
        s, e = (aw, an) if side > 0 else (an, aw)
        self.msp.add_arc((hx, hy), w, s, e, dxfattribs={"layer": "04開口見えがかり線"})

    def stone_hatch(self, x1, y1, x2, y2):
        """テラスの乱形石張りハッチング。"""
        h = self.msp.add_hatch(dxfattribs={"layer": "18ハッチング"})
        h.set_pattern_fill("ANSI37", scale=120, color=1)
        h.paths.add_polyline_path([(x1, y1), (x2, y1), (x2, y2), (x1, y2)])

    def floor_joint(self, x1, y1, x2, y2, pitch=910, vertical=True):
        """床の目地(極細線)。"""
        if vertical:
            x = x1 + pitch
            while x < x2:
                self.line((x, y1), (x, y2), "06床の目地")
                x += pitch
        else:
            y = y1 + pitch
            while y < y2:
                self.line((x1, y), (x2, y), "06床の目地")
                y += pitch


def main(out_path="output/yakushima_floor_plan.dxf"):
    doc = new_doc()
    msp = doc.modelspace()
    d = Draw(msp)

    # ===== 通り芯 =====
    ymin, ymax = -1_600, WIDTH + 1_600
    for name, x in GX.items():
        d.line((x, ymin - 400), (x, ymax), "01通り芯")
        msp.add_circle((x, ymin - 800), 300, dxfattribs={"layer": "01通り芯"})
        d.text(x, ymin - 800, name, h=240, layer="01通り芯", style="DIM")
    for name, y in GY.items():
        d.line((-1_600, y), (X["X13"] + 1_200, y), "01通り芯")
        msp.add_circle((-2_000, y), 300, dxfattribs={"layer": "01通り芯"})
        d.text(-2_000, y, name, h=240, layer="01通り芯", style="DIM")

    # ===== 室(壁厚150の躯体 + 室名) =====
    for name, (x1, y1, x2, y2) in ROOMS.items():
        if name != "テラス":          # テラスは開放(隣室の壁が境界)
            d.room_walls(x1, y1, x2, y2)
        d.text((x1 + x2) / 2, (y1 + y2) / 2, name, layer="08文字")

    # ===== テラス(乱形石張り) =====
    tx1, ty1, tx2, ty2 = ROOMS["テラス"]
    d.stone_hatch(tx1 + 100, ty1 + 100, tx2 - 100, ty2 - 100)

    # ===== 床の目地(主要室) =====
    for nm in ("子供室", "家族室", "食堂", "寝室"):
        x1, y1, x2, y2 = ROOMS[nm]
        d.floor_joint(x1, y1, x2, y2, pitch=910, vertical=True)

    # ===== 階段(X3-X4) =====
    sx1, sx2 = X["X3"] + 200, X["X4"] - 200
    sy1, sy2 = 200, 2_600
    for i in range(11):
        y = sy1 + (sy2 - sy1) * i / 10
        d.line((sx1, y), (sx2, y), "10線一般(中線)")
    d.line(((sx1 + sx2) / 2, sy1), ((sx1 + sx2) / 2, sy2), "10線一般(中線)")
    d.text((sx1 + sx2) / 2, sy2 + 300, "UP", h=220, layer="08文字", style="DIM")

    # ===== 設備(浴室・洗面・台所) =====
    bx1, by1, bx2, by2 = ROOMS["浴室"]
    d.rect(bx1 + 200, by1 + 300, bx2 - 200, by1 + 1_400, "05設備機器")   # 浴槽
    wx1, wy1, wx2, wy2 = ROOMS["洗面所"]
    msp.add_ellipse((wx1 + 500, wy2 - 500), major_axis=(300, 0), ratio=0.7,
                    dxfattribs={"layer": "05設備機器"})                   # 洗面器
    kx1, ky1, kx2, ky2 = ROOMS["台所"]
    d.rect(kx1 + 200, ky2 - 650, kx2 - 200, ky2 - 200, "05設備機器")     # 流し台
    # 車庫の車(簡易)
    gx1, gy1, gx2, gy2 = ROOMS["車庫"]
    d.rect(gx1 + 400, gy1 + 500, gx2 - 400, gy2 - 500, "07家具")

    # ===== エントランス記号(▲塗り) 玄関土間側 =====
    ex, ey = X["X2"], WIDTH + 150
    msp.add_solid([(ex - 250, ey), (ex + 250, ey), (ex, ey + 400)],
                  dxfattribs={"layer": "10線一般(中線)"})

    # ===== 寸法 =====
    def hdim(x1, x2, y, dy):
        dim = msp.add_linear_dim(base=(x1, dy), p1=(x1, y), p2=(x2, y),
            text=f"{round(abs(x2 - x1)):,}", dimstyle="S100",
            dxfattribs={"layer": "09寸法"})
        dim.render()

    def vdim(y1, y2, x, dx):
        dim = msp.add_linear_dim(base=(dx, y1), p1=(x, y1), p2=(x, y2), angle=90,
            text=f"{round(abs(y2 - y1)):,}", dimstyle="S100",
            dxfattribs={"layer": "09寸法"})
        dim.render()

    # X方向: 各1,950 と全長
    for i in range(12):
        hdim(i * PITCH, (i + 1) * PITCH, 0, -1_100)
    hdim(0, X["X13"], 0, -1_900)
    # Y方向: 上部 2,925+2,925、下部 3,300/600/1,950、全幅
    vdim(0, 2_925, X["X13"], X["X13"] + 1_100)
    vdim(2_925, WIDTH, X["X13"], X["X13"] + 1_100)
    vdim(0, WIDTH, X["X13"], X["X13"] + 1_900)
    vdim(0, GY["Y2"], 0, -1_100)
    vdim(GY["Y2"], GY["Y3"], 0, -1_100)
    vdim(GY["Y3"], WIDTH, 0, -1_100)

    # ===== タイトル =====
    d.text(X["X13"] / 2, WIDTH + 3_200, "1階平面図  S=1:100", h=500, layer="08文字")

    doc.saveas(out_path)
    print(f"saved: {out_path}")
    a = doc.audit()
    print(f"audit: errors={len(a.errors)} fixes={len(a.fixes)}")


if __name__ == "__main__":
    main(*sys.argv[1:])
