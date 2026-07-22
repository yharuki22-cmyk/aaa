# -*- coding: utf-8 -*-
"""事務所ビル「1階平面図 S=1:100」を、参考DWGで学習した作図標準で作図する。

layer_standard.py(参考DWG 95fdc24e から抽出した実レイヤ標準:色・線種・
線幅、壁厚150、寸法端末の丸)に準拠。前版の問題点を修正:
  - レイヤの色・線種を実データ準拠に(通り芯=水色CENTER2, 躯体=緑, 等)
  - 壁厚を150(RC躯体)に統一し、通り芯交点に柱型
  - 階段・PSにハッチング(06ハッチング=赤)
  - 開口部を通り芯モジュールに合わせて整理(散乱を解消)
  - 間仕切りを寸法チェーン(下1,400/1,150/1,450・2,000/2,000、
    左1,300/3,100/1,100/1,900)の芯に合わせる
  - 寸法端末は丸(_Dot)、寸法は水色(05寸法)

写真が90°回転して撮影されていたため正位置(X1〜X4横・Y1下)で作図。

usage: python office_plan.py [出力パス]
"""
import math
import sys

import ezdxf
from ezdxf.enums import TextEntityAlignment

import layer_standard as LS

# ---- 図面枠 (A3 1:100) ----
SHEET_W, SHEET_H, MARGIN = 42_000, 29_700, 1_000
ORIGIN = (15_500, 11_500)      # 通り芯X1・Y1交点のシート上の位置

# ---- 通り芯 ----
GX = {"X1": 0, "X2": 4_000, "X3": 8_000, "X4": 12_000}
GY = {"Y1": 0, "Y2": 7_400}
# 間仕切り芯 (写真の寸法チェーンから)
PX = {"a": 1_400, "b": 2_550}          # 下: 1,400 / 1,150 / 1,450
PY = {"c": 1_300, "d": 4_400, "e": 5_500}   # 左: 1,300 / 3,100 / 1,100 / 1,900

T = LS.WALL_T          # 壁厚150
COL = LS.COLUMN        # 柱500
TEXT_H = 300


class Plan:
    def __init__(self, msp):
        self.msp = msp

    def p(self, x, y):
        return (x + ORIGIN[0], y + ORIGIN[1])

    def line(self, a, b, layer):
        self.msp.add_line(self.p(*a), self.p(*b), dxfattribs={"layer": layer})

    def rect(self, x1, y1, x2, y2, layer, close=True):
        pts = [self.p(x1, y1), self.p(x2, y1), self.p(x2, y2), self.p(x1, y2)]
        self.msp.add_lwpolyline(pts, close=close, dxfattribs={"layer": layer})

    def text(self, x, y, s, h=TEXT_H, layer="04文字", style="JP", rot=0.0):
        self.msp.add_text(s, height=h,
            dxfattribs={"layer": layer, "style": style, "rotation": rot}
        ).set_placement(self.p(x, y), align=TextEntityAlignment.MIDDLE_CENTER)

    def circle(self, x, y, r, layer):
        self.msp.add_circle(self.p(x, y), r, dxfattribs={"layer": layer})

    def arc(self, x, y, r, a0, a1, layer):
        self.msp.add_arc(self.p(x, y), r, a0, a1, dxfattribs={"layer": layer})

    def hatch(self, poly, pattern="ANSI31", scale=80):
        h = self.msp.add_hatch(dxfattribs={"layer": "06ハッチング"})
        h.set_pattern_fill(pattern, scale=scale, color=1)
        h.paths.add_polyline_path([self.p(*pt) for pt in poly])

    # --- 躯体壁: 芯線に沿って壁厚Tの帯を描く。開口はopeningsで抜く ---
    def wall_x(self, x, y1, y2, openings=()):
        for a, b in self._segs(y1, y2, openings):
            self.rect(x - T / 2, a, x + T / 2, b, "02躯体")

    def wall_y(self, y, x1, x2, openings=()):
        for a, b in self._segs(x1, x2, openings):
            self.rect(a, y - T / 2, b, y + T / 2, "02躯体")

    @staticmethod
    def _segs(lo, hi, openings):
        segs, pos = [], lo
        for a, b in sorted(openings):
            if a > pos:
                segs.append((pos, a))
            pos = b
        if pos < hi:
            segs.append((pos, hi))
        return segs

    # --- 引違い窓: 16開口断面線。壁厚内に枠2本+ガラス2本 ---
    def window(self, p1, p2):
        (x1, y1), (x2, y2) = p1, p2
        L = math.hypot(x2 - x1, y2 - y1)
        ux, uy = (x2 - x1) / L, (y2 - y1) / L
        nx, ny = -uy, ux
        for off in (T / 2, T / 6, -T / 6, -T / 2):
            self.line((x1 + nx * off, y1 + ny * off),
                      (x2 + nx * off, y2 + ny * off), "16開口断面線")

    # --- 片開き戸: 建具枠(16)+開き軌跡の弧と扉(17赤) ---
    def door(self, hinge, jamb, side=1):
        hx, hy = hinge
        jx, jy = jamb
        w = math.hypot(jx - hx, jy - hy)
        aw = math.degrees(math.atan2(jy - hy, jx - hx))
        an = aw + 90 * side
        lx = hx + w * math.cos(math.radians(an))
        ly = hy + w * math.sin(math.radians(an))
        self.line((hx, hy), (lx, ly), "17開口見えがかり線")   # 扉
        s, e = (aw, an) if side > 0 else (an, aw)
        self.arc(hx, hy, w, s, e, "17開口見えがかり線")        # 軌跡

    def double_door(self, center, half, along_x=True, updown=1):
        cx, cy = center
        if along_x:
            self.door((cx - half, cy), (cx, cy), side=updown)
            self.door((cx + half, cy), (cx, cy), side=-updown)
        else:
            self.door((cx, cy - half), (cx, cy), side=updown)
            self.door((cx, cy + half), (cx, cy), side=-updown)


def hdim(msp, pl, x1, x2, y, dy, style, text=None):
    d = msp.add_linear_dim(base=pl.p(x1, dy), p1=pl.p(x1, y), p2=pl.p(x2, y),
        text=text or f"{round(abs(x2 - x1)):,}", dimstyle=style,
        dxfattribs={"layer": "05寸法"})
    d.render()


def vdim(msp, pl, y1, y2, x, dx, style, text=None):
    d = msp.add_linear_dim(base=pl.p(dx, y1), p1=pl.p(x, y1), p2=pl.p(x, y2),
        angle=90, text=text or f"{round(abs(y2 - y1)):,}", dimstyle=style,
        dxfattribs={"layer": "05寸法"})
    d.render()


def main(out_path="output/office_floor_plan.dxf"):
    doc = ezdxf.new("R2010", setup=True)
    doc.units = 4
    LS.setup_standard(doc)
    DIM = LS.make_dimstyle(doc, "S100", 100)
    doc.header["$LTSCALE"] = 50
    msp = doc.modelspace()
    pl = Plan(msp)

    # ================= A3図面枠 =================
    msp.add_lwpolyline([(0, 0), (SHEET_W, 0), (SHEET_W, SHEET_H), (0, SHEET_H)],
                       close=True, dxfattribs={"layer": "09図面枠"})
    msp.add_lwpolyline([(MARGIN, MARGIN), (SHEET_W - MARGIN, MARGIN),
                        (SHEET_W - MARGIN, SHEET_H - MARGIN), (MARGIN, SHEET_H - MARGIN)],
                       close=True, dxfattribs={"layer": "09図面枠"})
    # 表題欄
    tb_x1, tb_y1, tb_x2 = 30_000, MARGIN, SHEET_W - MARGIN
    rows = [("図面名", "1階平面図"), ("縮尺", "S=1:100"), ("氏名", ""), ("日付", "")]
    rh = 600
    for i in range(len(rows) + 1):
        msp.add_line((tb_x1, tb_y1 + i * rh), (tb_x2, tb_y1 + i * rh),
                     dxfattribs={"layer": "09図面枠"})
    for x in (tb_x1, tb_x1 + 3_000, tb_x2):
        msp.add_line((x, tb_y1), (x, tb_y1 + len(rows) * rh),
                     dxfattribs={"layer": "09図面枠"})
    for i, (k, v) in enumerate(reversed(rows)):
        y = tb_y1 + (i + 0.5) * rh
        msp.add_text(k, height=280, dxfattribs={"layer": "04文字", "style": "JP"}
                     ).set_placement((tb_x1 + 1_500, y), align=TextEntityAlignment.MIDDLE_CENTER)
        if v:
            msp.add_text(v, height=280, dxfattribs={"layer": "04文字", "style": "JP"}
                         ).set_placement((tb_x1 + 7_000, y), align=TextEntityAlignment.MIDDLE_CENTER)
    # タイトル(左下)
    msp.add_lwpolyline([(4_000, 1_800), (12_400, 1_800), (12_400, 3_200), (4_000, 3_200)],
                       close=True, dxfattribs={"layer": "09図面枠"})
    msp.add_text("1階平面図  S=1:100", height=500,
                 dxfattribs={"layer": "04文字", "style": "JP"}
                 ).set_placement((8_200, 2_500), align=TextEntityAlignment.MIDDLE_CENTER)
    # 方位(右上)
    ncx, ncy, nr = 38_000, 26_000, 700
    msp.add_circle((ncx, ncy), nr, dxfattribs={"layer": "19線一般(中線)"})
    msp.add_lwpolyline([(ncx, ncy - nr), (ncx, ncy + nr), (ncx - nr * 0.35, ncy - nr * 0.1)],
                       close=True, dxfattribs={"layer": "19線一般(中線)"})
    msp.add_text("N", height=350, dxfattribs={"layer": "04文字", "style": "DIM"}
                 ).set_placement((ncx, ncy + nr + 350), align=TextEntityAlignment.MIDDLE_CENTER)

    # ================= 通り芯 =================
    for name, x in GX.items():
        pl.line((x, -4_700), (x, 8_300), "01通り芯")
        pl.circle(x, -5_100, 350, "01通り芯")
        pl.text(x, -5_100, name, h=280, layer="01通り芯", style="DIM")
    for name, y in GY.items():
        pl.line((-3_600, y), (12_800, y), "01通り芯")
        pl.circle(-4_000, y, 350, "01通り芯")
        pl.text(-4_000, y, name, h=280, layer="01通り芯", style="DIM")

    # ================= 躯体壁 =================
    # 外周
    pl.wall_x(GX["X1"], 0, 7_400, openings=[(2_200, 3_400), (5_600, 6_300)])
    pl.wall_x(GX["X4"], 0, 7_400, openings=[(1_000, 3_000), (4_400, 6_400)])
    pl.wall_y(GY["Y1"], 0, 12_000, openings=[
        (2_900, 3_800),                                   # 玄関
        (4_700, 5_600), (7_000, 7_900), (10_000, 10_900),  # 事務室出入口
        (6_100, 6_800), (8_400, 9_400)])                   # 窓
    pl.wall_y(GY["Y2"], 0, 12_000, openings=[
        (800, 1_600), (2_400, 3_400), (5_000, 7_000), (9_000, 11_000)])
    # 内部仕切り(X2通り=事務室と水回りの境、両開き戸)
    pl.wall_x(GX["X2"], 0, 7_400, openings=[(2_900, 4_500)])
    # 水回りの間仕切り
    pl.wall_x(PX["a"], PY["c"], 7_400)                     # 倉庫/ホール境
    pl.wall_x(PX["b"], PY["d"], 7_400, openings=[(6_050, 6_650)])  # 便所/廊下
    pl.wall_y(PY["c"], 0, PX["a"], openings=[(400, 1_100)])  # 倉庫下(戸)
    pl.wall_y(PY["d"], 0, PX["b"])                          # 廊下下
    pl.wall_y(PY["e"], 0, GX["X2"], openings=[(600, 1_300), (2_600, 3_400)])  # 便所/湯沸下

    # 柱型(通り芯交点)
    for x in GX.values():
        for y in GY.values():
            pl.rect(x - COL / 2, y - COL / 2, x + COL / 2, y + COL / 2, "02躯体")

    # ================= 建具 =================
    for y1, y2 in [(2_200, 3_400), (5_600, 6_300)]:
        pl.window((GX["X1"], y1), (GX["X1"], y2))
    for y1, y2 in [(1_000, 3_000), (4_400, 6_400)]:
        pl.window((GX["X4"], y1), (GX["X4"], y2))
    for x1, x2 in [(6_100, 6_800), (8_400, 9_400)]:
        pl.window((x1, GY["Y1"]), (x2, GY["Y1"]))
    for x1, x2 in [(800, 1_600), (2_400, 3_400), (5_000, 7_000), (9_000, 11_000)]:
        pl.window((x1, GY["Y2"]), (x2, GY["Y2"]))
    # ドア
    pl.door((3_800, 0), (2_900, 0), side=-1)               # 玄関 片開き
    for x in (4_700, 7_000, 10_000):                       # 事務室 片開き
        pl.door((x, 0), (x + 900, 0), side=1)
    pl.double_door((GX["X2"], 3_700), 800, along_x=False, updown=1)  # 事務室 両開き
    pl.door((PX["a"], 400), (PX["a"], 1_100), side=1)      # 倉庫
    pl.door((PX["b"], 6_050), (PX["b"], 6_650), side=1)    # 廊下→便所
    pl.door((600, PY["e"]), (1_300, PY["e"]), side=1)      # 便所
    pl.door((3_400, PY["e"]), (2_600, PY["e"]), side=-1)   # 湯沸室

    # ================= 階段(ハッチング) =================
    # 倉庫内の階段: PX.a〜X2, PY.c〜PY.d 付近を段割り+方向ハッチ
    sx1, sx2, sy1, sy2 = PX["a"] + 150, GX["X2"] - 150, PY["c"] + 200, PY["d"] - 200
    steps = 9
    for i in range(steps + 1):
        y = sy1 + (sy2 - sy1) * i / steps
        pl.line((sx1, y), (sx2, y), "19線一般(中線)")
    pl.line(((sx1 + sx2) / 2, sy1), ((sx1 + sx2) / 2, sy2), "19線一般(中線)")
    pl.text((sx1 + sx2) / 2, sy1 - 400, "UP", h=250, layer="04文字", style="DIM")
    # 上り口側にハッチング(赤)
    pl.hatch([(sx1, sy1), (sx2, sy1), (sx2, (sy1 + sy2) / 2), (sx1, (sy1 + sy2) / 2)],
             pattern="ANSI31", scale=60)

    # ================= 設備機器 =================
    # 男子便所(便所ブース PX.b〜X2 上部): 大便器・小便器・手洗い
    pl.rect(GX["X2"] - 380, 6_450, GX["X2"] - 80, 6_900, "15設備機器")   # 大便器タンク
    msp.add_ellipse(pl.p(GX["X2"] - 620, 6_675), major_axis=(300, 0), ratio=0.72,
                    dxfattribs={"layer": "15設備機器"})
    pl.rect(GX["X2"] - 380, 5_650, GX["X2"] - 80, 5_950, "15設備機器")   # 小便器
    pl.circle(2_950, 5_750, 170, "15設備機器")                           # 手洗い
    pl.circle(2_950, 5_750, 55, "15設備機器")
    # 湯沸室(便所ブース下 0〜PX.b 下部): 流し台
    pl.rect(150, PY["e"] - 500, 1_300, PY["e"] - 120, "15設備機器")
    pl.rect(300, PY["e"] - 430, 1_000, PY["e"] - 190, "15設備機器")
    pl.circle(1_150, PY["e"] - 310, 60, "15設備機器")

    # ================= 切断線 =================
    def cut(x, y, dx, dy, letter, adx, ady):
        pl.line((x, y), (x + dx, y + dy), "12切断線")
        pl.line((x, y), (x + adx * 700, y + ady * 700), "12切断線")
        pl.line((x + adx * 700, y + ady * 700),
                (x + adx * 700 - adx * 250 + ady * 150,
                 y + ady * 700 - ady * 250 + adx * 150), "12切断線")
        pl.line((x + adx * 700, y + ady * 700),
                (x + adx * 700 - adx * 250 - ady * 150,
                 y + ady * 700 - ady * 250 - adx * 150), "12切断線")
        pl.text(x + adx * 1_200, y + ady * 1_200, letter, h=400,
                layer="04文字", style="DIM")

    cut(-4_500, 5_000, 1_100, 0, "X", 0, 1)
    cut(13_600, 5_000, -1_100, 0, "X", 0, 1)
    cut(10_150, -4_900, 0, 1_000, "Y", -1, 0)
    cut(10_150, 8_600, 0, -900, "Y", -1, 0)

    # ================= 室名 =================
    for x, y, name in [
        (700, 2_850, "倉庫"), (2_950, 6_450, "男子便所"),
        (650, 6_600, "湯沸室"), (3_000, 4_900, "廊下"),
        (1_800, 700, "ホール"), (8_000, 3_700, "事務室1"),
    ]:
        pl.text(x, y, name)

    # ================= 寸法 =================
    # 下側
    hdim(msp, pl, 0, PX["a"], 0, -1_700, DIM)
    hdim(msp, pl, PX["a"], PX["b"], 0, -1_700, DIM)
    hdim(msp, pl, PX["b"], GX["X2"], 0, -1_700, DIM)
    for a, b in [("X1", "X2"), ("X2", "X3"), ("X3", "X4")]:
        hdim(msp, pl, GX[a], GX[b], 0, -2_500, DIM)
    hdim(msp, pl, 0, 12_000, 0, -3_300, DIM)
    # 左側
    for y1, y2 in [(0, PY["c"]), (PY["c"], PY["d"]), (PY["d"], PY["e"]), (PY["e"], 7_400)]:
        vdim(msp, pl, y1, y2, 0, -1_700, DIM)
    vdim(msp, pl, 0, PY["d"], 0, -2_500, DIM)
    vdim(msp, pl, PY["d"], 7_400, 0, -2_500, DIM)
    vdim(msp, pl, 0, 7_400, 0, -3_300, DIM)
    # 右側
    vdim(msp, pl, 0, 7_400, 12_000, 13_300, DIM)

    doc.saveas(out_path)
    print(f"saved: {out_path}")
    a = doc.audit()
    print(f"audit: errors={len(a.errors)} fixes={len(a.fixes)}")


if __name__ == "__main__":
    main(*sys.argv[1:])
