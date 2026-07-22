# -*- coding: utf-8 -*-
"""参考DWG(95fdc24e / Ⅱ部建築学科の課題図)から抽出した作図標準。

LibreDWG(dwg2dxf)でDWGを可逆変換し、レイヤの実際の色(ACI)・線種・線幅、
線種定義、寸法端末(_Dot=丸)を読み取ったもの。この標準に従って各図面を
作図する。壁厚など寸法系の基準値もこのDWGの実測に合わせる。

参照: build時に scratchpad/office_ld.dxf を解析。
"""
import ezdxf
from ezdxf.enums import TextEntityAlignment

# ---- レイヤ標準 (name: ACI色, 線種, 線幅[1/100mm, -3=既定]) ----
# 色: 1赤 2黄 3緑 4水 5青 6紫 7白黒
LAYER_STD = [
    ("01通り芯",          4, "CENTER2",    -3),
    ("02躯体",            3, "CONTINUOUS", -3),   # 壁・柱(RC躯体)
    ("03仕上げ線",         7, "CONTINUOUS", -3),
    ("04文字",            7, "CONTINUOUS", -3),
    ("05寸法",            4, "CONTINUOUS", -3),
    ("06ハッチング",        1, "CONTINUOUS", -3),
    ("09図面枠",          5, "CONTINUOUS",  50),
    ("10線一般(中線)",      7, "CONTINUOUS", -3),
    ("10補助線",           6, "HIDDEN",       9),
    ("11切断線",           7, "CENTER1",    -3),
    ("12切断線",           7, "CENTER1",    -3),
    ("13保護CON(保護材)",   4, "CONTINUOUS", -3),
    ("14押さえ金物",        4, "CONTINUOUS", -3),
    ("15設備機器",         7, "CONTINUOUS", -3),
    ("16開口断面線",        7, "CONTINUOUS", -3),
    ("17開口見えがかり線",    1, "CONTINUOUS", -3),
    ("18床の目地",         1, "CONTINUOUS", -3),
    ("19線一般(中線)",      7, "CONTINUOUS", -3),
    ("20線一般(細線)",      1, "CONTINUOUS", -3),
    ("図面枠",            5, "CONTINUOUS", -3),
]

# ---- 線種定義 (ezdxf setup=True に無い/上書きしたいもの) ----
# CENTER2: 一点鎖線(短)  CENTER1: 一点鎖線(長)  HIDDEN: 破線
LINETYPE_DEFS = {
    "CENTER2": [12.0, 6.0, -1.5, 1.0, -1.5],
    "CENTER1": [50.0, 25.0, -6.0, 5.0, -6.0],
    "HIDDEN":  [9.0, 6.0, -3.0],
    "DASHED1": [12.0, 6.0, -6.0],
}

# ---- 基準寸法 (このDWGの実測) ----
WALL_T = 150          # RC躯体 壁厚
COLUMN = 500          # 柱型 (通り芯交点)

# ---- 寸法端末: _Dot(丸) ----
DOT_NAME = "_Dot"


def _dot_block(doc):
    """寸法端末の丸(_Dot)ブロックを定義する。参考DWGと同じ構成。"""
    if DOT_NAME in doc.blocks:
        return
    blk = doc.blocks.new(DOT_NAME)
    # 半径0.5の塗り(太幅ポリライン点) + ByBlockの短線
    blk.add_lwpolyline([(0, 0), (0, 0)], format="xy",
                       dxfattribs={"const_width": 0.5, "color": 0})
    blk.add_line((-0.5, 0), (-1.0, 0), dxfattribs={"color": 0, "lineweight": -2})


def setup_standard(doc):
    """docにレイヤ標準・線種・寸法端末・寸法スタイルを流し込む。"""
    # 線種
    for name, pattern in LINETYPE_DEFS.items():
        if name in doc.linetypes:
            doc.linetypes.remove(name)
        doc.linetypes.add(name, pattern=pattern, description=name)
    # レイヤ (ezdxf: add(name, color=, linetype=, lineweight=))
    for name, color, ltype, lw in LAYER_STD:
        if ltype != "CONTINUOUS" and ltype not in doc.linetypes:
            ltype = "Continuous"
        elif ltype == "CONTINUOUS":
            ltype = "Continuous"
        kw = {"color": color, "linetype": ltype}
        if lw != -3:
            kw["lineweight"] = lw
        if name in doc.layers:
            lay = doc.layers.get(name)
            lay.dxf.color = color
            lay.dxf.linetype = ltype
            if lw != -3:
                lay.dxf.lineweight = lw
        else:
            doc.layers.add(name, **kw)
    # 文字スタイル
    if "JP" not in doc.styles:
        doc.styles.add("JP", font="ipag.ttf")
    if "DIM" not in doc.styles:
        doc.styles.add("DIM", font="arial.ttf")
    # 寸法端末の丸
    _dot_block(doc)


def make_dimstyle(doc, name, scale, txt=2.5):
    """縮尺scale(例1:100→100)向けの寸法スタイル。端末は丸(_Dot)、水色。"""
    if name in doc.dimstyles:
        return name
    s = doc.dimstyles.duplicate_entry("EZDXF", name) if "EZDXF" in doc.dimstyles \
        else doc.dimstyles.new(name)
    s.dxf.dimtxt = txt * scale
    s.dxf.dimtsz = 0
    s.dxf.dimblk = DOT_NAME          # 端末=丸
    s.dxf.dimasz = 0.5 * scale
    s.dxf.dimexe = 0.18 * scale
    s.dxf.dimexo = 2.0 * scale
    s.dxf.dimgap = 0.6 * scale
    s.dxf.dimdec = 0
    s.dxf.dimtxsty = "DIM"
    s.dxf.dimclrd = 4                # 寸法線: 水色
    s.dxf.dimclre = 4
    s.dxf.dimclrt = 4                # 文字: 水色
    return name
