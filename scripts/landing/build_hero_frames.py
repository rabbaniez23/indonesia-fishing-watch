"""Pecah video hero landing menjadi urutan gambar untuk efek video mengikuti scroll.

Pakai:  python scripts/landing/build_hero_frames.py <video-asli.mp4> <folder-keluaran>
Butuh ffmpeg (dengan libwebp). Video asli 184 MB tidak masuk repo; hanya hasilnya.

Nama dan logo di lambung kapal disamarkan (kapal stok, bukan objek pemantauan). Koordinat
BLUR_KEYS khusus video ini: (detik, x tengah, y tengah) pada resolusi asli 3840x2160.
Bila video diganti, kosongkan BLUR_KEYS. Bila frame berubah, naikkan versi folder
(hero-v3) karena gambarnya di-cache permanen.
"""
import subprocess
import sys
import tempfile
from pathlib import Path

FPS = 12
DESKTOP_WIDTH = 2400
MOBILE_WIDTH = 810
MOBILE_FOCUS_X = 0.62  # posisi potongan potret: 0 = kiri, 1 = kanan
GRADE = "eq=saturation=0.62:contrast=1.04:brightness=-0.015"

BLUR_KEYS = [
    {"w": 150, "h": 46, "points": [(0, 2002, 1358), (3, 2097, 1368), (6, 2190, 1380), (9, 2265, 1395), (10.5, 2295, 1398), (12, 2365, 1420), (13.6, 2400, 1432)]},
    {"w": 76, "h": 54, "points": [(0, 2697, 1200), (3, 2660, 1185), (6, 2613, 1168), (9, 2535, 1155), (10.5, 2480, 1150), (12, 2463, 1145), (13.6, 2450, 1140)]},
]
FEATHER = 8
# Median menghapus garis huruf tanpa menggeser warna lambung, jadi samaran tidak tampak sebagai noda.
MEDIAN_RADIUS = 13


def lerp_expr(points: list[tuple[float, float]]) -> str:
    """Interpolasi linear bertahap terhadap waktu t, sebagai ekspresi ffmpeg."""
    expr = str(points[-1][1])
    for (t0, v0), (t1, v1) in reversed(list(zip(points, points[1:]))):
        expr = f"if(lt(t,{t1}),{v0}+({v1}-({v0}))*(t-{t0})/({t1}-{t0}),{expr})"
    return expr


def blur_graph(source: str) -> tuple[list[str], str]:
    chains: list[str] = []
    current = source
    for i, key in enumerate(BLUR_KEYS):
        w, h = key["w"], key["h"]
        end = key["points"][-1][0]
        x = lerp_expr([(t, cx - w / 2) for t, cx, _ in key["points"]])
        y = lerp_expr([(t, cy - h / 2) for t, _, cy in key["points"]])
        chains.append(f"[{current}]split[base{i}][copy{i}]")
        chains.append(f"[copy{i}]crop=w={w}:h={h}:x='{x}':y='{y}',format=gbrp,median=radius={MEDIAN_RADIUS},gblur=sigma=5,format=yuva420p,geq=lum='lum(X,Y)':cb='cb(X,Y)':cr='cr(X,Y)':a='255*min(1,min(min(X,W-1-X),min(Y,H-1-Y))/{FEATHER})'[patch{i}]")
        chains.append(f"[base{i}][patch{i}]overlay=x='{x}':y='{y}':enable='lte(t,{end})':eof_action=pass[out{i}]")
        current = f"out{i}"
    return chains, current


def main() -> None:
    video, out = sys.argv[1], Path(sys.argv[2])
    (out / "d").mkdir(parents=True, exist_ok=True)
    (out / "m").mkdir(parents=True, exist_ok=True)

    chains = [f"[0:v:0]fps={FPS}[src]"]
    blur, last = blur_graph("src")
    chains += blur
    chains.append(f"[{last}]{GRADE},split[a][b]")
    chains.append(f"[a]scale={DESKTOP_WIDTH}:-2:flags=lanczos[desktop]")
    chains.append(f"[b]crop=ih*9/16:ih:(iw-ih*9/16)*{MOBILE_FOCUS_X}:0,scale={MOBILE_WIDTH}:-2:flags=lanczos[mobile]")

    with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False) as graph:
        graph.write(";\n".join(chains))
    subprocess.run([
        "ffmpeg", "-v", "error", "-y", "-i", video, "-/filter_complex", graph.name,
        "-map", "[desktop]", "-c:v", "libwebp", "-quality", "72", "-compression_level", "5", str(out / "d" / "%04d.webp"),
        "-map", "[mobile]", "-c:v", "libwebp", "-quality", "62", "-compression_level", "5", str(out / "m" / "%04d.webp"),
    ], check=True)
    Path(graph.name).unlink()


if __name__ == "__main__":
    main()
