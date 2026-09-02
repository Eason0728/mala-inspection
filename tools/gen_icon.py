#!/usr/bin/env python3
"""
產生營運巡檢 App 的主畫面圖示（apple-touch-icon 180 + favicon-32）。

    python3 tools/gen_icon.py            # 產出定案色
    python3 tools/gen_icon.py --candidates   # 產出候選色供挑選

版型照 mala 族既有四顆（打卡／績效／庫存／排班）：上方干鍋 emblem、下方兩個字，
只換底色與文字色。emblem 直接從打卡那顆（~/mala-clock-in/assets/icon-180.png）抽 alpha，
逐 px 對齊，不是重畫一顆近似的。

favicon-32 依慣例只放干鍋不放字（32px 放字看不清）。
產完把兩顆以 base64 data URI 內嵌進 index.html 的 <head>
（有 `<!-- 巡檢 icon -->` 標記防重複插入），單檔版打包後也自動帶著圖示。
"""

import base64
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CLOCK_ICON = os.path.expanduser('~/mala-clock-in/assets/icon-180.png')
OUT_DIR = os.path.join(ROOT, 'assets')

TEXT = '巡檢'
FONT_PATH = '/System/Library/Fonts/Hiragino Sans GB.ttc'
FONT_INDEX = 2                       # W6，跟打卡／排班／宿舍同一支

# 打卡那顆量出來的幾何（180 畫布）
CLOCK_BG = np.array([0xFA, 0xBE, 0x00])   # 金黃底
EMBLEM_SPLIT_Y = 104                      # 104 以上是干鍋，以下是「打卡」兩字
TEXT_TOP = 112
TEXT_HEIGHT = 50

# 定案色（Eason 2026-09-02 在藏藍／磚橘／灰藍三案中選磚橘）
# 已用：打卡金黃 FABE00／績效紅 E8380D／庫存橄欖綠 3D5A3E／排班近黑 231815
BG = (0xC2, 0x6A, 0x1A)   # 磚橘：品牌暖色系、干鍋火焰最融合
FG = (0xFF, 0xFF, 0xFF)

CANDIDATES = {
    'A-藏藍': ((0x1F, 0x3A, 0x5F), (0xFF, 0xFF, 0xFF)),
    'B-磚橘': ((0xC2, 0x6A, 0x1A), (0xFF, 0xFF, 0xFF)),
    'C-灰藍': ((0x4A, 0x6B, 0x7C), (0xFF, 0xE8, 0x93)),
}


def emblem_alpha():
    """從打卡那顆抽出干鍋的 alpha 遮罩（含反鋸齒）。"""
    src = np.array(Image.open(CLOCK_ICON).convert('RGB')).astype(float)
    # 與底色的距離：干鍋線條（黑/紅/白）離金黃底都遠，底色本身為 0
    dist = np.abs(src - CLOCK_BG).sum(axis=2)
    alpha = np.clip(dist / 180.0, 0, 1)      # 180 ≈ 讓實線飽和、邊緣保留漸層
    alpha[EMBLEM_SPLIT_Y:, :] = 0            # 切掉「打卡」兩字，只留干鍋
    return alpha


def emblem_rgba():
    """保留干鍋原色（紅鍋身＋火焰），只把金黃底變透明。"""
    src = Image.open(CLOCK_ICON).convert('RGB')
    a = (emblem_alpha() * 255).astype(np.uint8)
    rgba = np.dstack([np.array(src), a])
    return Image.fromarray(rgba, 'RGBA')


def fit_font():
    for size in range(30, 90):
        font = ImageFont.truetype(FONT_PATH, size, index=FONT_INDEX)
        box = font.getbbox(TEXT, stroke_width=1)
        if box[3] - box[1] >= TEXT_HEIGHT:
            return font, box
    raise SystemExit('找不到合適字級')


def build_180(bg, fg):
    icon = Image.new('RGB', (180, 180), bg)
    icon.paste(emblem_rgba().convert('RGB'), (0, 0), emblem_rgba())
    font, box = fit_font()
    draw = ImageDraw.Draw(icon)
    x = (180 - (box[2] - box[0])) / 2 - box[0]
    y = TEXT_TOP - box[1]
    draw.text((x, y), TEXT, font=font, fill=fg, stroke_width=1, stroke_fill=fg)
    return icon


def build_32(bg):
    """favicon 只放干鍋、不放字（慣例）。"""
    icon = Image.new('RGB', (180, 180), bg)
    em = emblem_rgba()
    icon.paste(em.convert('RGB'), (0, 0), em)
    # 干鍋在上半部，裁出置中的方形再縮
    icon = icon.crop((10, 8, 170, 168)).resize((32, 32), Image.LANCZOS)
    return icon


MARK = '<!-- 巡檢 icon -->'
ANCHOR = '<meta name="viewport"'


def data_uri(path):
    return 'data:image/png;base64,' + base64.b64encode(open(path, 'rb').read()).decode()


def inject(html_path, uri180, uri32):
    html = open(html_path, encoding='utf-8').read()
    if MARK in html:
        head, rest = html.split(MARK, 1)
        html = head + rest.split(MARK, 1)[1]
    block = (f'{MARK}\n'
             f'<link rel="icon" type="image/png" sizes="32x32" href="{uri32}">\n'
             f'<link rel="apple-touch-icon" href="{uri180}">\n'
             f'{MARK}\n')
    line_end = html.index('\n', html.index(ANCHOR)) + 1
    html = html[:line_end] + block + html[line_end:]
    open(html_path, 'w', encoding='utf-8').write(html)
    print('  內嵌 → ' + os.path.relpath(html_path, ROOT))


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    if '--candidates' in sys.argv:
        for name, (bg, fg) in CANDIDATES.items():
            p = os.path.join(OUT_DIR, f'cand-{name}.png')
            build_180(bg, fg).save(p)
            print(f'候選 {name} → {os.path.relpath(p, ROOT)}')
        return

    icon = build_180(BG, FG)
    p180 = os.path.join(OUT_DIR, 'icon-180.png')
    p32 = os.path.join(OUT_DIR, 'favicon-32.png')
    icon.save(p180)
    build_32(BG).save(p32)
    for path in (p180, p32):
        print(f'{os.path.relpath(path, ROOT)}  {os.path.getsize(path)} bytes')
    inject(os.path.join(ROOT, 'index.html'), data_uri(p180), data_uri(p32))


if __name__ == '__main__':
    main()
