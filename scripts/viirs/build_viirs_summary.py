"""Bangun ringkasan VIIRS Boat Detection (VBD) untuk menu VIIRS website.

Dijalankan offline sekali (data mentah 2 GB tidak ikut ke repo/server):

    python scripts/viirs/build_viirs_summary.py --csv "D:/.../viirs_clean_all.csv"

Input  : viirs_clean_all.csv (output visualisasi/data_cleaning.py di repo riset_anjay)
         + shapefile WPP-RI di shp&shx/.
Output : src/data/viirs/*.json (ringkasan kecil yang dibaca website).

Filter mengikuti paper (draft_awal_eng): koordinat/waktu/radiansi valid, QF_Detect = 1,
Land_Mask != 1 (bukan daratan), EEZ Indonesia, lalu point-in-polygon ke 11 WPP-RI.
Kelas radiansi: rendah < 10, sedang 10-400, tinggi > 400 nW/cm2/sr (teks paper).
Jumlah per WPP adalah hasil hitung ulang, bukan disalin dari Tabel 5 paper.
"""
import argparse
import json
import os
import time
from datetime import datetime, timezone

import numpy as np
import pandas as pd
import shapefile  # pyshp
import shapely
from shapely.geometry import shape

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
WPP_CODES = ["571", "572", "573", "711", "712", "713", "714", "715", "716", "717", "718"]
EEZ_INDONESIA = "Indonesian Exclusive Economic Zone"
LOW_MAX = 10.0  # rendah: Rad_DNB < 10
HIGH_MIN = 400.0  # tinggi: Rad_DNB > 400; sedang: 10 <= Rad_DNB <= 400
CLASSES = ["low", "medium", "high"]
TREND_YEARS = (2012, 2025)  # paper: 2026 belum setahun penuh, tidak masuk uji tren
DENSITY_RES = 0.1  # derajat, grid kepadatan nasional (Fig 3, 6, 7)
MONTHLY_GRID_RES = 0.05  # derajat, grid bulanan WPP 712 & 717 (Fig 13, 14)
MONTHLY_GRID_YEAR = 2025
MONTHLY_GRID_WPP = ["712", "717"]
GRID_LON0, GRID_LAT0 = 90.0, -15.0  # titik asal indeks grid (mencakup seluruh WPP-RI)

# Tabel 2 paper: tahap data mentah tidak diproses ulang, hanya dikutip.
PAPER_TABLE2 = {
    "raw": {"records": 18115494, "attributes": 50, "sizeGb": 20.03},
    "postCleaning": {"records": 14211269, "attributes": 11, "sizeGb": 3.85},
    "analytical": {"records": 7380357},
}


def log(t0, msg):
    print(f"[{time.time() - t0:6.0f} dtk] {msg}", flush=True)


def load_csv(path, t0):
    cols = ["Lat_DNB", "Lon_DNB", "Rad_DNB", "Date_Mscan", "QF_Detect", "Land_Mask", "EEZ"]
    dtypes = {"Lat_DNB": "float64", "Lon_DNB": "float64", "Rad_DNB": "float64", "Date_Mscan": "string",
              "QF_Detect": "float32", "Land_Mask": "float32", "EEZ": "category"}
    parts = []
    for chunk in pd.read_csv(path, usecols=cols, dtype=dtypes, chunksize=2_000_000):
        parts.append(chunk)
        log(t0, f"dibaca {sum(len(p) for p in parts):,} baris")
    return pd.concat(parts, ignore_index=True)


def load_wpp(shp_dir):
    geoms = []
    for code in WPP_CODES:
        base = os.path.join(shp_dir, f"namobj_WPP-RI {code}")
        with open(base + ".shp", "rb") as shp, open(base + ".shx", "rb") as shx:
            reader = shapefile.Reader(shp=shp, shx=shx)
            parts = [shapely.make_valid(shape(s.__geo_interface__)) for s in reader.shapes()]
        geom = shapely.unary_union(parts)
        shapely.prepare(geom)
        geoms.append(geom)
    return geoms


def assign_wpp(lon, lat, candidates, geoms):
    """Indeks WPP per titik (-1 = di luar). Poligon WPP-RI tidak saling tumpang tindih."""
    assign = np.full(len(lon), -1, dtype=np.int8)
    for i, geom in enumerate(geoms):
        minx, miny, maxx, maxy = geom.bounds
        sel = candidates[(lon[candidates] >= minx) & (lon[candidates] <= maxx)
                         & (lat[candidates] >= miny) & (lat[candidates] <= maxy)]
        assign[sel[shapely.contains_xy(geom, lon[sel], lat[sel])]] = i
    return assign


def radiance_class(rad):
    cls = np.full(len(rad), 1, dtype=np.int8)  # sedang
    cls[rad < LOW_MAX] = 0
    cls[rad > HIGH_MIN] = 2
    return cls


def pct(part, whole):
    return round(float(part) / float(whole) * 100, 2) if whole else None


def describe(rad):
    if len(rad) == 0:
        return {"n": 0, "median": None, "mean": None, "sd": None}
    return {"n": int(len(rad)), "median": round(float(np.median(rad)), 2),
            "mean": round(float(np.mean(rad)), 2), "sd": round(float(np.std(rad, ddof=1)), 2)}


def class_counts(cls):
    counts = np.bincount(cls, minlength=3)
    return {name: int(counts[i]) for i, name in enumerate(CLASSES)}


def grid_cells(lon, lat, res, weights_by_key):
    """Kelompokkan titik ke sel grid; kembalikan baris [ix, iy, *jumlah per key]."""
    ix = np.floor((lon - GRID_LON0) / res).astype(np.int32)
    iy = np.floor((lat - GRID_LAT0) / res).astype(np.int32)
    key = ix.astype(np.int64) * 100000 + iy
    uniq, inv = np.unique(key, return_inverse=True)
    columns = [np.bincount(inv, weights=w.astype(np.float64), minlength=len(uniq)).astype(np.int64)
               for w in weights_by_key]
    rows = []
    for j, k in enumerate(uniq):
        rows.append([int(k // 100000), int(k % 100000)] + [int(c[j]) for c in columns])
    return rows


def write_json(out_dir, name, payload):
    path = os.path.join(out_dir, name)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, separators=(",", ":"))
    return os.path.getsize(path)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--csv", required=True, help="path viirs_clean_all.csv")
    ap.add_argument("--shp", default=os.path.join(ROOT, "shp&shx"), help="folder shapefile WPP-RI")
    ap.add_argument("--out", default=os.path.join(ROOT, "src", "data", "viirs"), help="folder output JSON")
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)
    t0 = time.time()

    df = load_csv(args.csv, t0)
    total_rows = len(df)
    lat = df["Lat_DNB"].to_numpy()
    lon = df["Lon_DNB"].to_numpy()
    rad = df["Rad_DNB"].to_numpy()
    qf = df["QF_Detect"].to_numpy()
    land = df["Land_Mask"].to_numpy()
    when = pd.to_datetime(df["Date_Mscan"], errors="coerce")
    year = when.dt.year.to_numpy(dtype="float64", na_value=np.nan)
    month = when.dt.month.to_numpy(dtype="float64", na_value=np.nan)
    idn = (df["EEZ"] == EEZ_INDONESIA).to_numpy()
    dup = df.duplicated(subset=["Date_Mscan", "Lat_DNB", "Lon_DNB", "Rad_DNB", "QF_Detect"]).to_numpy()
    date_min, date_max = when.min(), when.max()
    qf_dist = {str(int(k)) if pd.notna(k) else "kosong": int(v)
               for k, v in df["QF_Detect"].value_counts(dropna=False).sort_index().items()}
    land_dist = {str(int(k)) if pd.notna(k) else "kosong": int(v)
                 for k, v in df["Land_Mask"].value_counts(dropna=False).sort_index().items()}
    del df, when
    log(t0, "kolom siap")

    # --- Tahapan filter (urutan sesuai paper) ---
    coords_ok = np.isfinite(lat) & np.isfinite(lon) & (np.abs(lat) <= 90) & (np.abs(lon) <= 180)
    valid = coords_ok & np.isfinite(rad) & np.isfinite(year)
    s_qf = valid & (qf == 1)
    s_land = s_qf & (land != 1)
    s_eez = s_land & idn
    assign = assign_wpp(lon, lat, np.nonzero(s_eez)[0], load_wpp(args.shp))
    final = s_eez & (assign >= 0)
    log(t0, f"point-in-polygon selesai, dataset akhir {final.sum():,} titik")

    f_idx = np.nonzero(final)[0]
    f_rad, f_wpp = rad[f_idx], assign[f_idx]
    f_year, f_month = year[f_idx].astype(np.int16), month[f_idx].astype(np.int8)
    f_lon, f_lat = lon[f_idx], lat[f_idx]
    f_cls = radiance_class(f_rad)
    n_final = len(f_idx)

    # --- meta & preprocessing ---
    years_present = sorted(int(y) for y in np.unique(f_year))
    months_by_year = {str(y): sorted(int(m) for m in np.unique(f_month[f_year == y])) for y in years_present}
    meta = {
        "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": {"file": os.path.basename(args.csv), "rows": int(total_rows),
                   "producer": "visualisasi/data_cleaning.py (repo riset_anjay)",
                   "dataset": "EOG VIIRS Boat Detection (VBD)"},
        "dateRange": {"start": date_min.strftime("%Y-%m-%d"), "end": date_max.strftime("%Y-%m-%d")},
        "filters": ["Waktu, koordinat, dan radiansi valid", "QF_Detect = 1", "Land_Mask != 1 (bukan daratan)",
                    "EEZ = Indonesian Exclusive Economic Zone", "Di dalam poligon 11 WPP-RI (shp&shx)"],
        "classes": {"low": {"label": "Rendah", "rule": "Rad_DNB < 10"},
                    "medium": {"label": "Sedang", "rule": "10 <= Rad_DNB <= 400"},
                    "high": {"label": "Tinggi", "rule": "Rad_DNB > 400"}},
        "radianceUnit": "nW/cm²/sr",
        "wpp": WPP_CODES,
        "years": years_present,
        "monthsByYear": months_by_year,
        "trendYears": list(TREND_YEARS),
    }
    preprocessing = {
        "paperTable2": PAPER_TABLE2,
        "steps": [
            {"id": "clean", "label": "Data hasil cleaning (viirs_clean_all.csv)", "records": int(total_rows)},
            {"id": "valid", "label": "Waktu, koordinat, dan radiansi valid", "records": int(valid.sum())},
            {"id": "qf", "label": "QF_Detect = 1", "records": int(s_qf.sum())},
            {"id": "land", "label": "Bukan daratan (Land_Mask != 1)", "records": int(s_land.sum())},
            {"id": "eez", "label": "Di ZEE Indonesia", "records": int(s_eez.sum())},
            {"id": "wpp", "label": "Di dalam 11 WPP-RI", "records": int(n_final)},
        ],
        "qfDetect": qf_dist,
        "landMask": land_dist,
        "notes": {
            "duplicates": int(dup.sum()),
            "duplicatesInFinal": int(dup[f_idx].sum()),
            "nonPositiveRadiance": int(np.sum(np.isfinite(rad) & (rad <= 0))),
            "nonPositiveRadianceInFinal": int(np.sum(f_rad <= 0)),
            "invalidRows": int(total_rows - valid.sum()),
        },
    }

    # --- profil per WPP (setara Tabel 5, hitung ulang) ---
    def profile_row(mask):
        r = f_rad[mask]
        cc = class_counts(f_cls[mask])
        n = int(mask.sum())
        row = describe(r)
        row.update({"share": pct(n, n_final), "classes": cc,
                    "classPct": {k: pct(v, n) for k, v in cc.items()}})
        return row

    profile = {"total": profile_row(np.ones(n_final, dtype=bool)),
               "wpp": {code: profile_row(f_wpp == i) for i, code in enumerate(WPP_CODES)}}

    # --- histogram radiansi skala log (Fig 4a), radiansi <= 0 tidak ditampilkan ---
    pos = f_rad[f_rad > 0]
    edges = np.logspace(np.floor(np.log10(pos.min())), np.ceil(np.log10(pos.max())), 61)
    hist, _ = np.histogram(pos, bins=edges)
    radiance_hist = {"edges": [float(f"{e:.6g}") for e in edges], "counts": [int(c) for c in hist],
                     "median": round(float(np.median(f_rad)), 2), "thresholds": [LOW_MAX, HIGH_MIN],
                     "excludedNonPositive": int(n_final - len(pos))}

    # --- tahunan per WPP x kelas (Fig 8, 9, 10) ---
    yidx = f_year - years_present[0]
    ny = len(years_present)

    def by_year(mask):
        out = {}
        for ci, name in enumerate(CLASSES):
            m = mask & (f_cls == ci)
            out[name] = [int(v) for v in np.bincount(yidx[m], minlength=ny)]
        out["all"] = [int(v) for v in np.bincount(yidx[mask], minlength=ny)]
        return out

    annual = {"years": years_present, "total": by_year(np.ones(n_final, dtype=bool)),
              "wpp": {code: by_year(f_wpp == i) for i, code in enumerate(WPP_CODES)}}

    # --- bulanan per WPP (Fig 11, 12, dasar STL/forecast di V3) ---
    ym = [(y, m) for y in years_present for m in months_by_year[str(y)]]
    ym_key = {k: j for j, k in enumerate(ym)}
    pair_code = f_year.astype(np.int32) * 100 + f_month
    uniq_codes, inv = np.unique(pair_code, return_inverse=True)
    lookup = np.array([ym_key[(int(c // 100), int(c % 100))] for c in uniq_codes], dtype=np.int32)
    f_ym = lookup[inv]

    def by_month(mask):
        return [int(v) for v in np.bincount(f_ym[mask], minlength=len(ym))]

    monthly = {"months": [f"{y}-{m:02d}" for y, m in ym], "total": by_month(np.ones(n_final, dtype=bool)),
               "wpp": {code: by_month(f_wpp == i) for i, code in enumerate(WPP_CODES)}}

    # --- grid kepadatan nasional per kelas (Fig 3, 6, 7) ---
    one = np.ones(n_final, dtype=np.int8)
    density = {"res": DENSITY_RES, "lon0": GRID_LON0, "lat0": GRID_LAT0,
               "columns": ["ix", "iy", "all", "low", "medium", "high"],
               "cells": grid_cells(f_lon, f_lat, DENSITY_RES,
                                   [one, f_cls == 0, f_cls == 1, f_cls == 2])}
    log(t0, f"grid kepadatan: {len(density['cells']):,} sel")

    # --- grid bulanan WPP 712 & 717 tahun 2025 (Fig 13, 14) ---
    monthly_grid = {"year": MONTHLY_GRID_YEAR, "res": MONTHLY_GRID_RES, "lon0": GRID_LON0, "lat0": GRID_LAT0,
                    "columns": ["ix", "iy"] + [str(m) for m in range(1, 13)], "wpp": {}}
    for code in MONTHLY_GRID_WPP:
        m = (f_wpp == WPP_CODES.index(code)) & (f_year == MONTHLY_GRID_YEAR)
        monthly_grid["wpp"][code] = {
            "monthTotals": [int(np.sum(m & (f_month == mm))) for mm in range(1, 13)],
            "cells": grid_cells(f_lon[m], f_lat[m], MONTHLY_GRID_RES,
                                [f_month[m] == mm for mm in range(1, 13)]),
        }

    sizes = {name: write_json(args.out, name, payload) for name, payload in [
        ("meta.json", meta), ("preprocessing.json", preprocessing), ("profile.json", profile),
        ("radiance-hist.json", radiance_hist), ("annual.json", annual), ("monthly.json", monthly),
        ("density.json", density), ("monthly-grid-2025.json", monthly_grid)]}

    # --- pemeriksaan konsistensi ---
    assert profile["total"]["n"] == n_final
    assert sum(r["n"] for r in profile["wpp"].values()) == n_final
    assert sum(annual["total"]["all"]) == n_final
    assert sum(monthly["total"]) == n_final
    assert sum(c[2] for c in density["cells"]) == n_final
    assert sum(sum(c[3:6]) for c in density["cells"]) == n_final
    for code in MONTHLY_GRID_WPP:
        g = monthly_grid["wpp"][code]
        assert sum(sum(c[2:]) for c in g["cells"]) == sum(g["monthTotals"])

    print("\nTahapan filter:")
    for s in preprocessing["steps"]:
        print(f"  {s['records']:>12,}  {s['label']}")
    print("\nProfil WPP (n, porsi %, median, rendah/sedang/tinggi %):")
    for code, r in profile["wpp"].items():
        cp = r["classPct"]
        print(f"  {code}: {r['n']:>10,} {r['share']:6.2f} {r['median']:7.2f}  "
              f"{cp['low']:6.2f} / {cp['medium']:6.2f} / {cp['high']:5.2f}")
    t, cp = profile["total"], profile["total"]["classPct"]
    print(f"  ALL: {t['n']:>10,} {100:6.2f} {t['median']:7.2f}  {cp['low']:6.2f} / {cp['medium']:6.2f} / {cp['high']:5.2f}")
    print("\nUkuran file:")
    for name, size in sizes.items():
        print(f"  {name:<24} {size / 1024:9.1f} KB")
    print(f"  {'TOTAL':<24} {sum(sizes.values()) / 1024:9.1f} KB")
    log(t0, "selesai")


if __name__ == "__main__":
    main()
