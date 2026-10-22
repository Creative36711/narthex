"""Вырезка хромакея, связного с краем кадра (полости внутри фигуры, связанные с фоном, тоже уходят;
зелёные/бирюзовые детали ВНУТРИ фигуры не трогаются). Дополняет __chronicle_ai__/cutout-chromakey.py,
когда режим color съедает бирюзу.  python3 tools/cutout_flood.py in.png out.png"""
import sys, numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage
im = np.array(Image.open(sys.argv[1]).convert('RGB')).astype(int)
r, g, b = im[..., 0], im[..., 1], im[..., 2]
key = (g - np.maximum(r, b) > 70) & (g > 140) & (b < g * 0.75)   # чистый зелёный, не бирюза
lab, n = ndimage.label(key)
edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
bg = np.isin(lab, list(edge))
# крупные замкнутые зелёные «полости» (> 0.3 % кадра) тоже фон
sizes = ndimage.sum(key, lab, range(1, n + 1))
for i, s in enumerate(sizes, 1):
    if s > key.size * 0.003: bg |= (lab == i)
bg = ndimage.binary_dilation(bg, iterations=1)
alpha = np.where(bg, 0, 255).astype(np.uint8)
a = Image.fromarray(alpha).filter(ImageFilter.GaussianBlur(0.8))
out = im.copy()
edgezone = ndimage.binary_dilation(bg, iterations=3) & ~bg
spill = edgezone & (g > np.maximum(r, b))
out[..., 1] = np.where(spill, np.maximum(r, b), g)            # подавить зелёный ореол на кромке
res = Image.fromarray(out.astype(np.uint8)).convert('RGBA'); res.putalpha(a)
bbox = res.getbbox(); res = res.crop(bbox) if bbox else res
res.save(sys.argv[2])
