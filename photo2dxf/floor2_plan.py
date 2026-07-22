# -*- coding: utf-8 -*-
"""2階平面図 S=1:100 を、支給テンプレートDWG(図面枠・表題欄・レイヤ標準入り)の
図面枠中央に作図する。通り芯符号と寸法を上下左右すべての側に入れる。

- テンプレート: scratchpad/floor2_ld.dxf (b399e938 をLibreDWGで変換)
- 通り芯: X=い〜り(@910=7,280) / Y=0〜6(@910=5,460)
- 室: 寝室A・寝室B・便所・クローゼット・ホール・物入・階段 + バルコニー(下屋)
- レイヤはテンプレート既定(住宅標準: 通り芯=赤CENTER1/躯体=緑/寸法=水色 等)

写真に内部寸法が全ては写っていないため、間仕切り・建具位置は推定を含む。
室配置は ROOMS で編集可能。

usage: python floor2_plan.py [出力パス]
"""
import math
import sys

import ezdxf
from ezdxf.addons import Importer
from ezdxf.enums import TextEntityAlignment
from ezdxf.math import Matrix44

TEMPLATE = "/tmp/claude-0/-home-user-aaa/3d7d2fff-af48-524c-a27a-0e4ee677a30a/scratchpad/floor2_ld.dxf"

# 左フレームの作図領域中心
FRAME_CENTER = (22_005, 16_949)

# テンプレートの正確なレイヤ名(全角/半角括弧に注意)
L_GRID = "01通り芯"
L_WALL = "02柱・壁(断面線）"
L_FURN = "07家具"
L_TEXT = "08文字"
L_DIM = "09寸法"
L_MID = "10線一般（中線）"
L_JOINT = "06床の目地"
L_EQUIP = "05設備機器"

# ---- 通り芯 ----
XN = ["い", "ろ", "は", "に", "ほ", "へ", "と", "ち", "り"]
GX = {n: i * 910 for i, n in enumerate(XN)}       # い=0 .. り=7280
GY = {i: i * 910 for i in range(7)}                # 0=0 .. 6=5460
XR, YT = GX["り"], GY[6]                            # 7280, 5460

T = 150      # 壁厚
TEXT_H = 300

# 室ブロック: 名前 -> (x1,y1,x2,y2)  (い/0 原点, mm)
ROOMS = {
    "寝室A":     (0,        0,       GX["に"], GY[4]),
    "寝室B":     (GX["に"], 0,       GX["と"], GY[4]),
    "クローゼット": (0,        GY[4],   GX["ろ"], GY[5]),
    "便所":      (0,        GY[5],   GX["ろ"], GY[6]),
    "ホール":     (GX["ろ"], GY[4],   GX["へ"], GY[6]),
    "物入":      (GX["へ"], GY[4],   GX["と"], GY[6]),
    "階段":      (GX["と"], GY[4],   GX["ち"], GY[6]),
}
# バルコニー(下屋屋根): と 以降の張り出し
BALCONY = (GX["と"], 0, GX["り"] + 1_050, GY[6])


def load_template():
    """テンプレートのレイヤ・図面枠を新規docへ移植(壊れたmaterials表を回避)。"""
    tpl = ezdxf.readfile(TEMPLATE)
    doc = ezdxf.new("R2010", setup=True)
    doc.units = 4
    # 必要な線種
    for name, patt in [("CENTER1", [50, 25, -6, 5, -6]),
                       ("DASHED1", [12, 6, -6]),
                       ("PHANTOM2", [32, 20, -4, 4, -4, 4, -4]),
                       ("HIDDEN2", [9, 6, -3])]:
        if name in doc.linetypes:
            doc.linetypes.remove(name)
        doc.linetypes.add(name, pattern=patt, description=name)
    # レイヤをテンプレートから正確にコピー
    for l in tpl.layers:
        if l.dxf.name in doc.layers:
            continue
        lt = l.dxf.linetype if l.dxf.linetype in doc.linetypes else "Continuous"
        doc.layers.add(l.dxf.name, color=l.dxf.color, linetype=lt,
                       lineweight=l.dxf.get("lineweight", -3))
    # 図面枠・表題欄・補助枠を移植
    frame = [e for e in tpl.modelspace()
             if e.dxf.layer in ("15極太線", "14補助線", L_TEXT)]
    imp = Importer(tpl, doc)
    imp.import_entities(frame)
    imp.finalize()

    if "JP" not in doc.styles:
        doc.styles.add("JP", font="msgothic.ttc")
    else:
        doc.styles.get("JP").dxf.font = "msgothic.ttc"
    if "DIM" not in doc.styles:
        doc.styles.add("DIM", font="arial.ttf")
    # 寸法端末=丸
    if "_Dot" not in doc.blocks:
        blk = doc.blocks.new("_Dot")
        blk.add_lwpolyline([(0, 0), (0, 0)], dxfattribs={"const_width": 40, "color": 0})
    s = doc.dimstyles.duplicate_entry("EZDXF", "S100") if "EZDXF" in doc.dimstyles \
        else doc.dimstyles.new("S100")
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
    """局所座標(い/0原点)で作図し、最後に枠中央へ平行移動する。"""

    def __init__(self, msp):
        self.msp = msp
        self.ents = []
        self.off = (0.0, 0.0)      # 中央寄せ後の寸法用オフセット

    def _add(self, e):
        self.ents.append(e)
        return e

    def line(self, a, b, layer):
        self._add(self.msp.add_line(a, b, dxfattribs={"layer": layer}))

    def rect(self, x1, y1, x2, y2, layer):
        self._add(self.msp.add_lwpolyline(
            [(x1, y1), (x2, y1), (x2, y2), (x1, y2)], close=True,
            dxfattribs={"layer": layer}))

    def circle(self, x, y, r, layer):
        self._add(self.msp.add_circle((x, y), r, dxfattribs={"layer": layer}))

    def text(self, x, y, s, h=TEXT_H, layer="08文字", style="JP", rot=0.0):
        t = self.msp.add_text(s, height=h,
            dxfattribs={"layer": layer, "style": style, "rotation": rot})
        t.set_placement((x, y), align=TextEntityAlignment.MIDDLE_CENTER)
        self._add(t)

    def wall_band(self, x1, y1, x2, y2):
        t = T / 2
        if abs(x2 - x1) < 1:
            self.rect(x1 - t, min(y1, y2) - t, x1 + t, max(y1, y2) + t, L_WALL)
        else:
            self.rect(min(x1, x2) - t, y1 - t, max(x1, x2) + t, y1 + t, L_WALL)

    def room_walls(self, x1, y1, x2, y2):
        self.wall_band(x1, y1, x1, y2)
        self.wall_band(x2, y1, x2, y2)
        self.wall_band(x1, y1, x2, y1)
        self.wall_band(x1, y2, x2, y2)

    def dim_h(self, x1, x2, y, base_y):
        ox, oy = self.off
        d = self.msp.add_linear_dim(base=(x1 + ox, base_y + oy),
            p1=(x1 + ox, y + oy), p2=(x2 + ox, y + oy),
            text=f"{round(abs(x2 - x1)):,}", dimstyle="S100",
            dxfattribs={"layer": L_DIM})
        d.render()

    def dim_v(self, y1, y2, x, base_x):
        ox, oy = self.off
        d = self.msp.add_linear_dim(base=(base_x + ox, y1 + oy),
            p1=(x + ox, y1 + oy), p2=(x + ox, y2 + oy),
            angle=90, text=f"{round(abs(y2 - y1)):,}", dimstyle="S100",
            dxfattribs={"layer": L_DIM})
        d.render()

    def translate(self, dx, dy):
        m = Matrix44.translate(dx, dy, 0)
        for e in self.ents:
            try:
                e.transform(m)
            except Exception:
                pass


def bbox_of(ents):
    from ezdxf.math import Vec3
    xs, ys = [], []
    for e in ents:
        t = e.dxftype()
        try:
            if t == "LINE":
                xs += [e.dxf.start.x, e.dxf.end.x]; ys += [e.dxf.start.y, e.dxf.end.y]
            elif t == "CIRCLE":
                xs += [e.dxf.center.x - e.dxf.radius, e.dxf.center.x + e.dxf.radius]
                ys += [e.dxf.center.y - e.dxf.radius, e.dxf.center.y + e.dxf.radius]
            elif t == "LWPOLYLINE":
                for p in e.get_points():
                    xs.append(p[0]); ys.append(p[1])
            elif t in ("TEXT", "MTEXT"):
                xs.append(e.dxf.insert.x); ys.append(e.dxf.insert.y)
        except Exception:
            pass
    return min(xs), min(ys), max(xs), max(ys)


def main(out_path="output/floor2_plan.dxf"):
    doc = load_template()
    msp = doc.modelspace()
    d = Draw(msp)
    bx1, by1, bx2, by2 = BALCONY

    # ===== 通り芯 (線を四周に延長) =====
    x_ext = 1_500        # 建物外への通り芯延長
    for n, x in GX.items():
        d.line((x, -x_ext), (x, YT + x_ext), L_GRID)
    for i, y in GY.items():
        d.line((-x_ext, y), (bx2 + x_ext, y), L_GRID)

    # ===== 通り芯符号 (上下左右すべて) =====
    r = 300
    tb_up, tb_dn = YT + 2_400, -2_400          # 上/下のバブル位置
    lb, rb = -2_400, bx2 + 2_400               # 左/右のバブル位置
    for n, x in GX.items():                     # い〜り: 上・下
        for by in (tb_up, tb_dn):
            d.circle(x, by, r, L_GRID)
            d.text(x, by, n, h=240, layer="01通り芯", style="JP")
    for i, y in GY.items():                     # 0〜6: 左・右
        for bxp in (lb, rb):
            d.circle(bxp, y, r, L_GRID)
            d.text(bxp, y, str(i), h=240, layer="01通り芯", style="DIM")

    # ===== 躯体壁(厚150) + 室名 =====
    for name, (x1, y1, x2, y2) in ROOMS.items():
        d.room_walls(x1, y1, x2, y2)
        d.text((x1 + x2) / 2, (y1 + y2) / 2, name,
               h=260 if len(name) > 3 else TEXT_H)

    # ===== バルコニー(下屋屋根: 縦の目地線) =====
    d.rect(bx1, by1, bx2, by2, L_MID)
    xx = bx1 + 300
    while xx < bx2:
        d.line((xx, by1), (xx, by2), L_JOINT)
        xx += 300

    # ===== 便所(便器) =====
    tx1, ty1, tx2, ty2 = ROOMS["便所"]
    d.rect(tx1 + 120, ty1 + 250, tx1 + 380, ty1 + 620, L_EQUIP)
    d.msp.add_ellipse((tx1 + 250, ty1 + 720),
                      major_axis=(0, 180), ratio=0.7,
                      dxfattribs={"layer": L_EQUIP})
    d._add(list(d.msp)[-1])

    # ===== ホールの階段(下り)ハッチ・階段(上り) =====
    hx1, hy1, hx2, hy2 = ROOMS["ホール"]
    for i in range(8):
        yy = hy1 + (hy2 - hy1) * i / 8
        d.line((hx1, yy), (hx2, yy), L_MID)
    sx1, sy1, sx2, sy2 = ROOMS["階段"]
    for i in range(6):
        yy = sy1 + (sy2 - sy1) * i / 6
        d.line((sx1, yy), (sx2, yy), L_MID)
    d.text((sx1 + sx2) / 2, sy1 - 350, "UP", h=200, layer="08文字", style="DIM")

    # ===== 枠中央へ移動(幾何のみ。寸法はオフセットして最後に描く) =====
    bxx1, byy1, bxx2, byy2 = bbox_of(d.ents)
    cx, cy = (bxx1 + bxx2) / 2, (byy1 + byy2) / 2
    dx, dy = FRAME_CENTER[0] - cx, FRAME_CENTER[1] - cy
    d.translate(dx, dy)
    d.off = (dx, dy)

    # ===== 寸法(上下左右すべて) =====
    # 上: 1,820/1,820/910/910/1,820  下: 2,730/2,730/1,820  全長7,280
    top_chain = [0, 1820, 3640, 4550, 5460, 7280]
    for a, b in zip(top_chain, top_chain[1:]):
        d.dim_h(a, b, YT, YT + 1_100)
    d.dim_h(0, XR, YT, YT + 1_900)
    bot_chain = [0, 2730, 5460, 7280]
    for a, b in zip(bot_chain, bot_chain[1:]):
        d.dim_h(a, b, 0, -1_100)
    d.dim_h(0, XR, 0, -1_900)
    # 左: 3,640/1,820  全高5,460   右: 同じ(ミラー)
    left_chain = [0, 3640, 5460]
    for a, b in zip(left_chain, left_chain[1:]):
        d.dim_v(a, b, 0, -1_100)
    d.dim_v(0, YT, 0, -1_900)
    for a, b in zip(left_chain, left_chain[1:]):
        d.dim_v(a, b, XR, bx2 + 1_100)
    d.dim_v(0, YT, XR, bx2 + 1_900)

    doc.saveas(out_path)
    print(f"saved: {out_path}")
    a = doc.audit()
    print(f"audit: errors={len(a.errors)} fixes={len(a.fixes)}")
    print(f"plan center(local)=({cx:.0f},{cy:.0f}) -> frame {FRAME_CENTER}")


if __name__ == "__main__":
    main(*sys.argv[1:])
