# -*- coding: utf-8 -*-
"""生成した DXF を PNG にレンダリングして確認する。"""
import sys

import matplotlib
matplotlib.use("Agg")
from matplotlib import font_manager, pyplot as plt

import ezdxf
from ezdxf.addons.drawing import RenderContext, Frontend
from ezdxf.addons.drawing.matplotlib import MatplotlibBackend

font_manager.fontManager.addfont("/usr/share/fonts/truetype/fonts-japanese-gothic.ttf")
matplotlib.rcParams["font.family"] = "IPAGothic"


def main(src="output/site_floor_plan.dxf", dst="output/preview.png"):
    doc = ezdxf.readfile(src)
    fig = plt.figure(figsize=(11, 14))
    ax = fig.add_axes([0, 0, 1, 1])
    ctx = RenderContext(doc)
    Frontend(ctx, MatplotlibBackend(ax)).draw_layout(doc.modelspace(), finalize=True)
    fig.savefig(dst, dpi=150, facecolor="white")
    print(f"saved: {dst}")


if __name__ == "__main__":
    main(*sys.argv[1:])
