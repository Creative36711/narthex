"""Залечить «дыры» после хромакея: пиксели внутри фигуры (не связанные с внешним фоном), ставшие прозрачными,
но чей цвет — не чистый ключевой зелёный (бирюза, патина), снова делаются непрозрачными.
RGB под прозрачностью скрипт cutout-chromakey сохраняет, поэтому восстановление точное.
python3 tools/alpha_heal.py file.png [...]"""
import sys, numpy as np
from PIL import Image
from scipy import ndimage
for p in sys.argv[1:]:
    im = np.array(Image.open(p).convert('RGBA')).astype(int)
    r, g, b, a = im[..., 0], im[..., 1], im[..., 2], im[..., 3]
    lab, _ = ndimage.label(a < 20)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    outside = np.isin(lab, list(edge))
    near = ndimage.binary_dilation(outside, iterations=2)
    key = (g - np.maximum(r, b) > 70) & (g > 140) & (b < g * 0.75)
    fix = (a < 250) & ~near & ~key
    im[..., 3] = np.where(fix, 255, a)
    Image.fromarray(im.astype(np.uint8)).save(p, optimize=True)
    print(p, 'исправлено пикселей:', int(fix.sum()), '| внутри остался чистый ключ:', int(((a < 250) & ~near & key).sum()))
