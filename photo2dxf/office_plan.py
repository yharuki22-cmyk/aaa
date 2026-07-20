# -*- coding: utf-8 -*-
"""事務所ビル「1階平面図 S=1:100」の写真から読み取った寸法でDXFを生成する。

- A3横(420×297 → モデル空間 42,000×29,700mm、1:100)の図面枠付き
- 通り芯: X1〜X4 (4,000×3=12,000) / Y1〜Y2 (7,400=4,400+3,000)
- 壁は二重線+通り芯交点の柱型、建具・設備・切断線・寸法・室名入り
- 画層構成は参考DWG(住宅図面)で学習したものに準拠

写真が90°回転していたため、正しい向き(X1〜X4が横方向、Y1が下)で作図。

usage: python office_plan.py [出力パス]
"""
import math
import sys

import ezdxf
from ezdxf import units
from ezdxf.enums import TextEntityAlignment

# ---- 図面枠 (A3 1:100) ----
SHEET_W, SHEET_H, MARGIN = 42_000, 29_700, 1_000
ORIGIN = (15_500, 11_500)      # 通り芯X1・Y1交点のシート上の位置

# ---- 通り芯 ----
GX = {"X1": 0, "X2": 4_000, "X3": 8_000, "X4": 12_000}
GY = {"Y1": 0, "Y2": 7_400}

T_EXT, T_INT = 150, 150        # 壁厚
COL = 400                      # 柱型
TEXT_H = 300

LAYERS = [
    ("01通り芯", 1, "CENTER"),
    ("02柱・壁(断面線)", 7, "CONTINUOUS"),
    ("03開口断面線", 5, "CONTINUOUS"),
    ("04開口見えがかり線", 3, "CONTINUOUS"),
    ("05設備機器", 1, "CONTINUOUS"),
    ("08文字", 7, "CONTINUOUS"),
    ("09寸法", 3, "CONTINUOUS"),
    ("10線一般(中線)", 8, "CONTINUOUS"),
    ("12切断線", 33, "CONTINUOUS"),
    ("14図枠", 7, "CONTINUOUS"),
]


def new_doc():
    doc = ezdxf.new("R2010", setup=True)
    doc.units = units.MM
    doc.styles.add("JP", font="ipag.ttf")
    doc.styles.add("DIM", font="arial.ttf")
    for name, color, ltype in LAYERS:
        doc.layers.add(name, color=color, linetype=ltype)
    style = doc.dimstyles.duplicate_entry("EZDXF", "JIS100")
    style.dxf.dimtxt = 250
    style.dxf.dimtsz = 0
    style.dxf.dimblk = "DOT"       # 端末は黒丸
    style.dxf.dimasz = 100
    style.dxf.dimexo = 150
    style.dxf.dimexe = 150
    style.dxf.dimgap = 60
    style.dxf.dimtxsty = "DIM"
    style.dxf.dimdec = 0
    doc.header["$LTSCALE"] = 30
    return doc


class Plan:
    """ORIGINオフセット付きの作図ヘルパ。座標は通り芯X1/Y1原点のmm。"""

    def __init__(self, msp):
        self.msp = msp

    def p(self, x, y):
        return (x + ORIGIN[0], y + ORIGIN[1])

    def line(self, a, b, layer):
        self.msp.add_line(self.p(*a), self.p(*b), dxfattribs={"layer": layer})

    def rect(self, x1, y1, x2, y2, layer):
        pts = [self.p(x1, y1), self.p(x2, y1), self.p(x2, y2), self.p(x1, y2)]
        self.msp.add_lwpolyline(pts, close=True, dxfattribs={"layer": layer})

    def text(self, x, y, s, h=TEXT_H, layer="08文字", style="JP", rot=0.0):
        self.msp.add_text(
            s, height=h, dxfattribs={"layer": layer, "style": style, "rotation": rot},
        ).set_placement(self.p(x, y), align=TextEntityAlignment.MIDDLE_CENTER)

    # --- 壁: 開口を除いた実体部分を矩形で描く(小口も閉じる) ---
    def wall_x(self, x, y1, y2, t=T_INT, openings=()):
        segs, pos = [], y1
        for a, b in sorted(openings):
            if a > pos:
                segs.append((pos, a))
            pos = b
        if pos < y2:
            segs.append((pos, y2))
        for a, b in segs:
            self.rect(x - t / 2, a, x + t / 2, b, "02柱・壁(断面線)")

    def wall_y(self, y, x1, x2, t=T_INT, openings=()):
        segs, pos = [], x1
        for a, b in sorted(openings):
            if a > pos:
                segs.append((pos, a))
            pos = b
        if pos < x2:
            segs.append((pos, x2))
        for a, b in segs:
            self.rect(a, y - t / 2, b, y + t / 2, "02柱・壁(断面線)")

    # --- 引違い窓 (壁芯線分 p1→p2) ---
    def window(self, p1, p2, t):
        (x1, y1), (x2, y2) = p1, p2
        L = math.hypot(x2 - x1, y2 - y1)
        ux, uy = (x2 - x1) / L, (y2 - y1) / L
        nx, ny = -uy, ux
        for off in (t / 2, 45, -45, -t / 2):
            self.line((x1 + nx * off, y1 + ny * off),
                      (x2 + nx * off, y2 + ny * off), "03開口断面線")

    # --- 開き戸 (吊元hinge→戸先jamb は壁芯上、side=+1で進行方向左に開く) ---
    def door(self, hinge, jamb, side=1):
        hx, hy = hinge
        jx, jy = jamb
        w = math.hypot(jx - hx, jy - hy)
        aw = math.degrees(math.atan2(jy - hy, jx - hx))
        an = aw + 90 * side
        lx = hx + w * math.cos(math.radians(an))
        ly = hy + w * math.sin(math.radians(an))
        self.line((hx, hy), (lx, ly), "04開口見えがかり線")
        start, end = (aw, an) if side > 0 else (an, aw)
        self.msp.add_arc(self.p(hx, hy), w, start, end,
                         dxfattribs={"layer": "04開口見えがかり線"})


def hdim(msp, pl, x1, x2, y, dy, text=None):
    dim = msp.add_linear_dim(
        base=pl.p(x1, dy), p1=pl.p(x1, y), p2=pl.p(x2, y),
        text=text or f"{round(abs(x2 - x1)):,}",
        dimstyle="JIS100", dxfattribs={"layer": "09寸法"})
    dim.render()


def vdim(msp, pl, y1, y2, x, dx, text=None):
    dim = msp.add_linear_dim(
        base=pl.p(dx, y1), p1=pl.p(x, y1), p2=pl.p(x, y2), angle=90,
        text=text or f"{round(abs(y2 - y1)):,}",
        dimstyle="JIS100", dxfattribs={"layer": "09寸法"})
    dim.render()


def main(out_path="output/office_floor_plan.dxf"):
    doc = new_doc()
    msp = doc.modelspace()
    pl = Plan(msp)

    # ================= A3図面枠 =================
    msp.add_lwpolyline(
        [(0, 0), (SHEET_W, 0), (SHEET_W, SHEET_H), (0, SHEET_H)],
        close=True, dxfattribs={"layer": "14図枠"})
    msp.add_lwpolyline(
        [(MARGIN, MARGIN), (SHEET_W - MARGIN, MARGIN),
         (SHEET_W - MARGIN, SHEET_H - MARGIN), (MARGIN, SHEET_H - MARGIN)],
        close=True, dxfattribs={"layer": "14図枠"})

    # 表題欄 (右下)
    tb_x1, tb_y1, tb_x2 = 30_000, MARGIN, SHEET_W - MARGIN
    rows = [("図面名", "1階平面図"), ("縮尺", "S=1:100"), ("氏名", ""), ("日付", "")]
    rh = 600
    for i in range(len(rows) + 1):
        y = tb_y1 + i * rh
        msp.add_line((tb_x1, y), (tb_x2, y), dxfattribs={"layer": "14図枠"})
    for x in (tb_x1, tb_x1 + 3_000, tb_x2):
        msp.add_line((x, tb_y1), (x, tb_y1 + len(rows) * rh),
                     dxfattribs={"layer": "14図枠"})
    for i, (k, v) in enumerate(reversed(rows)):
        y = tb_y1 + (i + 0.5) * rh
        msp.add_text(k, height=280, dxfattribs={"layer": "14図枠", "style": "JP"}
                     ).set_placement((tb_x1 + 1_500, y), align=TextEntityAlignment.MIDDLE_CENTER)
        if v:
            msp.add_text(v, height=280, dxfattribs={"layer": "14図枠", "style": "JP"}
                         ).set_placement((tb_x1 + 3_000 + 4_000, y), align=TextEntityAlignment.MIDDLE_LEFT)

    # 図面タイトル (左下)
    msp.add_lwpolyline(
        [(4_000, 1_800), (12_400, 1_800), (12_400, 3_200), (4_000, 3_200)],
        close=True, dxfattribs={"layer": "14図枠"})
    msp.add_text("1階平面図  S=1:100", height=500,
                 dxfattribs={"layer": "14図枠", "style": "JP"}
                 ).set_placement((8_200, 2_500), align=TextEntityAlignment.MIDDLE_CENTER)

    # 方位 (右上)
    ncx, ncy, nr = 38_000, 26_000, 700
    msp.add_circle((ncx, ncy), nr, dxfattribs={"layer": "10線一般(中線)"})
    msp.add_lwpolyline(
        [(ncx, ncy - nr), (ncx, ncy + nr), (ncx - nr * 0.35, ncy - nr * 0.1)],
        close=True, dxfattribs={"layer": "10線一般(中線)"})
    msp.add_text("N", height=350, dxfattribs={"layer": "10線一般(中線)", "style": "DIM"}
                 ).set_placement((ncx, ncy + nr + 350), align=TextEntityAlignment.MIDDLE_CENTER)

    # ================= 通り芯 =================
    for name, x in GX.items():
        pl.line((x, -4_700), (x, 8_300), "01通り芯")
        msp.add_circle(pl.p(x, -5_100), 350, dxfattribs={"layer": "01通り芯"})
        pl.text(x, -5_100, name, h=280, layer="01通り芯", style="DIM")
    for name, y in GY.items():
        pl.line((-3_550, y), (12_800, y), "01通り芯")
        msp.add_circle(pl.p(-3_900, y), 350, dxfattribs={"layer": "01通り芯"})
        pl.text(-3_900, y, name, h=280, layer="01通り芯", style="DIM")

    # ================= 壁 =================
    # 外壁 (窓は「通り芯から1,000離して幅2,000」ルール)
    pl.wall_x(0, 0, 7_400, T_EXT, openings=[(2_200, 3_400), (5_600, 6_300)])
    pl.wall_x(12_000, 0, 7_400, T_EXT,
              openings=[(1_000, 3_000), (4_400, 6_400)])
    pl.wall_y(0, 0, 12_000, T_EXT, openings=[
        (2_900, 3_800),                       # 玄関片開き
        (4_700, 5_600), (7_000, 7_900), (10_000, 10_900),   # 事務室ドア
        (6_100, 6_800), (8_400, 9_400),       # 窓
    ])
    pl.wall_y(7_400, 0, 12_000, T_EXT, openings=[
        (800, 1_600), (2_400, 3_400), (5_000, 7_000), (9_000, 11_000)])
    # X2通りの壁 (事務室仕切り、両開きドア)
    pl.wall_x(4_000, 0, 7_400, T_EXT, openings=[(2_000, 3_800)])
    # 間仕切り
    pl.wall_x(1_400, 1_300, 4_400)                     # 倉庫/階段
    pl.wall_x(2_000, 4_400, 7_400, openings=[(4_600, 5_400)])   # 便所/湯沸・廊下
    pl.wall_x(2_550, 1_400, 3_100)                     # 階段/ホール
    pl.wall_y(1_300, 0, 1_400, openings=[(300, 1_200)])          # 倉庫南
    pl.wall_y(4_400, 0, 2_550)                         # 便所南・廊下南
    pl.wall_y(5_500, 0, 4_000,
              openings=[(1_200, 1_900), (2_200, 3_000)])         # 便所ブース/湯沸南
    # 玄関ポーチ
    pl.wall_x(2_550, -1_000, 0, 150)
    pl.wall_x(4_000, -1_000, 0, 150)
    pl.line((2_550, -1_000), (4_000, -1_000), "10線一般(中線)")
    pl.line((2_550, -1_150), (4_000, -1_150), "10線一般(中線)")

    # 柱型 (通り芯交点)
    for x in GX.values():
        for y in GY.values():
            pl.rect(x - COL / 2, y - COL / 2, x + COL / 2, y + COL / 2,
                    "02柱・壁(断面線)")

    # ================= 建具 =================
    # 窓 (壁開口に合わせる)
    for y1, y2 in [(2_200, 3_400), (5_600, 6_300)]:
        pl.window((0, y1), (0, y2), T_EXT)
    for y1, y2 in [(1_000, 3_000), (4_400, 6_400)]:
        pl.window((12_000, y1), (12_000, y2), T_EXT)
    for x1, x2 in [(6_100, 6_800), (8_400, 9_400)]:
        pl.window((x1, 0), (x2, 0), T_EXT)
    for x1, x2 in [(800, 1_600), (2_400, 3_400), (5_000, 7_000), (9_000, 11_000)]:
        pl.window((x1, 7_400), (x2, 7_400), T_EXT)

    # ドア
    pl.door((300, 1_300), (1_200, 1_300), side=-1)     # 倉庫 → ホール側へ
    pl.door((2_000, 4_600), (2_000, 5_400), side=1)    # 男子便所
    pl.door((1_900, 5_500), (1_200, 5_500), side=-1)   # 便所ブース
    pl.door((2_200, 5_500), (3_000, 5_500), side=1)    # 湯沸室
    pl.door((4_000, 2_000), (4_000, 2_900), side=1)    # 事務室 両開き
    pl.door((4_000, 3_800), (4_000, 2_900), side=-1)
    pl.door((3_800, 0), (2_900, 0), side=-1)           # 玄関 片開き
    for x in (4_700, 7_000, 10_000):                   # 事務室 片開き戸
        pl.door((x, 0), (x + 900, 0), side=1)

    # ================= 階段 =================
    for i in range(8):
        y = 1_400 + i * 240
        pl.line((1_400, y), (2_550, y), "10線一般(中線)")
    pl.line((1_975, 1_150), (1_975, 3_250), "10線一般(中線)")
    pl.line((1_975, 3_250), (1_890, 3_050), "10線一般(中線)")
    pl.line((1_975, 3_250), (2_060, 3_050), "10線一般(中線)")
    pl.text(1_650, 1_050, "UP", h=250, style="DIM")
    pl.line((1_400, 2_900), (2_550, 3_200), "10線一般(中線)")   # 破断線

    # ================= 設備機器 =================
    LAY_E = {"layer": "05設備機器"}
    # --- 男子便所ブース: 大便器 (X1壁際、東向き) ---
    pl.rect(75, 6_400, 375, 6_860, "05設備機器")                # ロータンク
    msp.add_ellipse(pl.p(680, 6_630), major_axis=(300, 0),
                    ratio=0.72, dxfattribs=LAY_E)               # 便鉢
    pl.line((375, 6_480), (520, 6_480), "05設備機器")
    pl.line((375, 6_780), (520, 6_780), "05設備機器")
    # --- 前室: 小便器 (X1壁際) ---
    pl.rect(75, 5_020, 200, 5_480, "05設備機器")                # 背面
    msp.add_ellipse(pl.p(310, 5_250), major_axis=(230, 0),
                    ratio=0.87, dxfattribs=LAY_E)
    # --- 前室: 手洗い器 (丸、隅) ---
    msp.add_circle(pl.p(450, 4_680), 170, dxfattribs=LAY_E)
    msp.add_circle(pl.p(450, 4_680), 60, dxfattribs=LAY_E)      # 排水口
    # --- 湯沸室: 流し台 (Y2壁際、水槽+水栓) ---
    pl.rect(2_450, 6_950, 3_900, 7_325, "05設備機器")           # カウンター
    pl.rect(2_600, 7_010, 3_300, 7_265, "05設備機器")           # シンク
    msp.add_circle(pl.p(3_600, 7_140), 70, dxfattribs=LAY_E)    # 水栓
    pl.line((3_600, 7_140), (3_380, 7_140), "05設備機器")

    # ================= 切断線 =================
    def cut_flag(x, y, dx, dy, letter, adx, ady):
        # 切断位置の短い線 + 見る方向の矢印 + 記号
        pl.line((x, y), (x + dx, y + dy), "12切断線")
        pl.line((x, y), (x + adx * 700, y + ady * 700), "12切断線")
        pl.line((x + adx * 700, y + ady * 700),
                (x + adx * 700 - adx * 250 + ady * 150,
                 y + ady * 700 - ady * 250 + adx * 150), "12切断線")
        pl.line((x + adx * 700, y + ady * 700),
                (x + adx * 700 - adx * 250 - ady * 150,
                 y + ady * 700 - ady * 250 - adx * 150), "12切断線")
        pl.text(x + adx * 1_200, y + ady * 1_200, letter, h=400,
                layer="12切断線", style="DIM")

    # X-X断面 (Y=5,000 を横切り、+Y方向を見る)
    cut_flag(-4_500, 5_000, 1_100, 0, "X", 0, 1)
    cut_flag(13_600, 5_000, -1_100, 0, "X", 0, 1)
    # Y-Y断面 (X=10,150 を縦切り、-X方向を見る)
    cut_flag(10_150, -5_800, 0, 1_100, "Y", -1, 0)
    cut_flag(10_150, 8_600, 0, -900, "Y", -1, 0)

    # ================= 室名 =================
    for x, y, name in [
        (700, 2_850, "倉庫"), (1_000, 5_900, "男子便所"),
        (3_000, 6_400, "湯沸室"), (3_000, 4_950, "廊下"),
        (3_270, 700, "ホール"), (8_000, 3_700, "事務室1"),
    ]:
        pl.text(x, y, name)

    # ================= 寸法 =================
    # 下側: 2,000/2,000 → 1,400/1,150/1,450 → 4,000×3 → 12,000
    hdim(msp, pl, 0, 2_000, 0, -1_700)
    hdim(msp, pl, 2_000, 4_000, 0, -1_700)
    hdim(msp, pl, 0, 1_400, 0, -2_500)
    hdim(msp, pl, 1_400, 2_550, 0, -2_500)
    hdim(msp, pl, 2_550, 4_000, 0, -2_500)
    for a, b in [("X1", "X2"), ("X2", "X3"), ("X3", "X4")]:
        hdim(msp, pl, GX[a], GX[b], 0, -3_300)
    hdim(msp, pl, 0, 12_000, 0, -4_100)
    # 左側: 1,300/3,100/1,100/1,900 → 4,400/3,000 → 7,400
    for y1, y2 in [(0, 1_300), (1_300, 4_400), (4_400, 5_500), (5_500, 7_400)]:
        vdim(msp, pl, y1, y2, 0, -1_300)
    vdim(msp, pl, 0, 4_400, 0, -2_100)
    vdim(msp, pl, 4_400, 7_400, 0, -2_100)
    vdim(msp, pl, 0, 7_400, 0, -2_900)
    # 右側: 7,400
    vdim(msp, pl, 0, 7_400, 12_000, 13_300)

    doc.saveas(out_path)
    print(f"saved: {out_path}")
    auditor = doc.audit()
    print(f"audit: errors={len(auditor.errors)} fixes={len(auditor.fixes)}")


if __name__ == "__main__":
    main(*sys.argv[1:])
