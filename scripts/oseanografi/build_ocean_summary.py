"""Bangun ringkasan oseanografi Copernicus Marine untuk menu Oseanografi.

Dua tahap (keduanya offline, data mentah tidak disimpan):

    # 1) unduh & ringkas per kelompok dataset ke cache (butuh akun Copernicus Marine)
    python scripts/oseanografi/build_ocean_summary.py fetch --groups phy,chl,pp,zsd,bgc,wave,wind \
        --cache <folder-cache> --env-file .env.local
    # 2) rakit JSON untuk website dari cache (tanpa jaringan)
    python scripts/oseanografi/build_ocean_summary.py assemble --cache <folder-cache>

Kredensial dibaca dari variabel lingkungan COPERNICUSMARINE_SERVICE_USERNAME / _PASSWORD (atau --env-file, yang hanya
memuat dua kunci itu). Kredensial tidak pernah dicetak.

Setiap bulan diringkas menjadi: rata-rata per WPP (bobot cos lintang; klorofil memakai rata-rata geometrik) dan grid
0,25° (rata-rata blok) untuk peta; arus & angin juga komponen u/v pada grid 1° untuk panah arah.
Klimatologi = rata-rata per bulan kalender 2012–2025 (sama dengan periode tren VIIRS).
"""
import argparse
import glob
import json
import math
import os
import time
import warnings
from datetime import datetime, timezone

import numpy as np

warnings.filterwarnings("ignore")
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT_DIR = os.path.join(ROOT, "src", "data", "oseanografi")
SHP_DIR = os.path.join(ROOT, "shp&shx")
VIIRS_MONTHLY = os.path.join(ROOT, "src", "data", "viirs", "monthly.json")
WPP_CODES = ["571", "572", "573", "711", "712", "713", "714", "715", "716", "717", "718"]
KEYS12 = WPP_CODES + ["total"]
BBOX = dict(minimum_longitude=90, maximum_longitude=145, minimum_latitude=-15, maximum_latitude=10)
LON0, LAT0, RES, NX, NY = 90.0, -15.0, 0.25, 220, 100
ARES, ANX, ANY = 1.0, 55, 25
CLIM = (2012, 2025)
SERIES_START = 2012
ALPHA = 0.05

# Kelompok dataset (diverifikasi lewat describe/open_dataset sebelum dipakai).
GROUPS = {
    # Rata-rata ensemble beberapa reanalisis (0,25°) — resolusi sama dengan grid peta, jauh lebih ringan daripada 0,083°.
    "phy": dict(dataset="cmems_mod_glo_phy-mnstd_my_0.25deg_P1M-m", product="GLOBAL_MULTIYEAR_PHY_ENS_001_031",
                raw=["thetao_mean", "so_mean", "uo_mean", "vo_mean", "zos_mean", "mlotst_mean"], depth=True, start=1993,
                service="arco-time-series", sst_raw="thetao_mean"),
    "chl": dict(dataset="cmems_obs-oc_glo_bgc-plankton_my_l4-multi-4km_P1M", product="OCEANCOLOUR_GLO_BGC_L4_MY_009_104",
                raw=["CHL"], start=1998, service="arco-time-series"),
    "pp": dict(dataset="cmems_obs-oc_glo_bgc-pp_my_l4-multi-4km_P1M", product="OCEANCOLOUR_GLO_BGC_L4_MY_009_104",
               raw=["PP"], start=SERIES_START, service="arco-time-series"),
    "zsd": dict(dataset="cmems_obs-oc_glo_bgc-transp_my_l4-multi-4km_P1M", product="OCEANCOLOUR_GLO_BGC_L4_MY_009_104",
                raw=["ZSD"], start=SERIES_START, service="arco-time-series"),
    "bgc": dict(dataset="cmems_mod_glo_bgc_my_0.25deg_P1M-m", product="GLOBAL_MULTIYEAR_BGC_001_029",
                raw=["no3", "o2", "ph"], depth=True, start=SERIES_START, service="arco-time-series"),
    "wave": dict(dataset="cmems_mod_glo_wav_my_0.2deg-climatology_P1M-m", product="GLOBAL_MULTIYEAR_WAV_001_032",
                 raw=["VHM0"], climatology=True),
    "wind": dict(dataset="cmems_obs-wind_glo_phy_my_l4_0.125deg_PT1H", product="WIND_GLO_PHY_L4_MY_012_006",
                 raw=["eastward_wind", "northward_wind"], year=2025, stride_hours=6),
}

# Variabel keluaran: kunci → (kelompok, cara hitung).
VARS = {
    "sst": dict(group="phy", label="Suhu permukaan laut", unit="°C", scale=100),
    "sss": dict(group="phy", label="Salinitas permukaan", unit="PSU", scale=100),
    "cur": dict(group="phy", label="Arus permukaan", unit="m/s", scale=1000, arrows=True),
    "ssh": dict(group="phy", label="Tinggi muka laut", unit="m", scale=1000),
    "mld": dict(group="phy", label="Kedalaman lapisan campuran", unit="m", scale=10),
    "chl": dict(group="chl", label="Klorofil-a", unit="mg/m³", scale=1000, log=True),
    "pp": dict(group="pp", label="Produktivitas primer", unit="mg C/m²/hari", scale=1),
    "zsd": dict(group="zsd", label="Kecerahan air (kedalaman Secchi)", unit="m", scale=10),
    "no3": dict(group="bgc", label="Nitrat", unit="mmol/m³", scale=100),
    "o2": dict(group="bgc", label="Oksigen terlarut", unit="mmol/m³", scale=10),
    "ph": dict(group="bgc", label="pH", unit="", scale=1000),
    "wave": dict(group="wave", label="Tinggi gelombang signifikan", unit="m", scale=100),
    "wind": dict(group="wind", label="Kecepatan angin permukaan", unit="m/s", scale=100, arrows=True),
}
GROUP_KEYS = {g: [k for k, v in VARS.items() if v["group"] == g] for g in GROUPS}


def log(t0, msg):
    print(f"[{time.time() - t0:7.0f} dtk] {msg}", flush=True)


def load_env(path):
    for line in open(path, encoding="utf-8-sig"):
        k, _, v = line.strip().partition("=")
        if k in ("COPERNICUSMARINE_SERVICE_USERNAME", "COPERNICUSMARINE_SERVICE_PASSWORD") and v:
            os.environ.setdefault(k, v.strip().strip('"').strip("'"))


def wpp_geoms():
    import shapefile
    import shapely
    from shapely.geometry import shape
    geoms = []
    for code in WPP_CODES:
        base = os.path.join(SHP_DIR, f"namobj_WPP-RI {code}")
        with open(base + ".shp", "rb") as shp, open(base + ".shx", "rb") as shx:
            r = shapefile.Reader(shp=shp, shx=shx)
            g = shapely.unary_union([shapely.make_valid(shape(s.__geo_interface__)) for s in r.shapes()])
        shapely.prepare(g)
        geoms.append(g)
    return geoms


class Grid:
    """Indeks bantu untuk satu grid sumber: WPP per sel, bobot luas, indeks blok 0,25° & 1°."""

    def __init__(self, lat, lon, geoms):
        import shapely
        la, lo = np.meshgrid(lat, lon, indexing="ij")
        la, lo = la.ravel(), lo.ravel()
        self.shape = (len(lat), len(lon))
        self.w = np.cos(np.radians(la))
        self.wpp = np.full(la.size, -1, dtype=np.int16)
        for i, g in enumerate(geoms):
            minx, miny, maxx, maxy = g.bounds
            sel = np.nonzero((lo >= minx) & (lo <= maxx) & (la >= miny) & (la <= maxy))[0]
            self.wpp[sel[shapely.contains_xy(g, lo[sel], la[sel])]] = i
        ix = np.clip(np.floor((lo - LON0) / RES).astype(int), 0, NX - 1)
        iy = np.clip(np.floor((la - LAT0) / RES).astype(int), 0, NY - 1)
        self.cell = iy * NX + ix
        ax = np.clip(np.floor((lo - LON0) / ARES).astype(int), 0, ANX - 1)
        ay = np.clip(np.floor((la - LAT0) / ARES).astype(int), 0, ANY - 1)
        self.acell = ay * ANX + ax

    def wpp_means(self, v, use_log=False):
        """12 nilai: 11 WPP + total (gabungan 11 WPP)."""
        v = v.ravel()
        ok = np.isfinite(v) & (self.wpp >= 0)
        if use_log:
            ok &= v > 0
        x = np.log10(v[ok]) if use_log else v[ok]
        w = self.w[ok]
        s = np.bincount(self.wpp[ok], weights=w * x, minlength=11)
        n = np.bincount(self.wpp[ok], weights=w, minlength=11)
        out = np.where(n > 0, s / np.where(n > 0, n, 1), np.nan)
        tot = (w * x).sum() / w.sum() if w.sum() > 0 else np.nan
        out = np.append(out, tot)
        return 10 ** out if use_log else out

    def block(self, v, use_log=False, arrow=False):
        v = v.ravel()
        ok = np.isfinite(v)
        if use_log:
            ok &= v > 0
        x = np.log10(v[ok]) if use_log else v[ok]
        idx = (self.acell if arrow else self.cell)[ok]
        size = ANX * ANY if arrow else NX * NY
        s = np.bincount(idx, weights=x, minlength=size)
        n = np.bincount(idx, minlength=size)
        out = np.where(n > 0, s / np.where(n > 0, n, 1), np.nan)
        return (10 ** out if use_log else out).astype(np.float32)


def derive(group, arrays):
    """Variabel turunan per kelompok dari array mentah (lat × lon)."""
    a = arrays
    if group == "phy":
        a = {k.removesuffix("_mean"): v for k, v in a.items()}
        out = {"sst": a.get("thetao"), "sss": a.get("so"), "ssh": a.get("zos"), "mld": a.get("mlotst")}
        if "uo" in a:
            out["cur"] = np.hypot(a["uo"], a["vo"])
            out["cur_u"], out["cur_v"] = a["uo"], a["vo"]
        return {k: v for k, v in out.items() if v is not None}
    if group == "chl":
        return {"chl": a["CHL"]}
    if group == "pp":
        return {"pp": a["PP"]}
    if group == "zsd":
        return {"zsd": a["ZSD"]}
    if group == "bgc":
        return {"no3": a["no3"], "o2": a["o2"], "ph": a["ph"]}
    if group == "wave":
        return {"wave": a["VHM0"]}
    raise ValueError(group)


def summarize(grid, group, months, frames_by_raw, with_grid):
    """frames_by_raw: {raw: array(time, lat, lon)} → dict untuk cache npz."""
    res = {"months": np.array(months)}
    keys = None
    for t in range(len(months)):
        arrays = {r: frames_by_raw[r][t] for r in frames_by_raw}
        d = derive(group, arrays)
        if keys is None:
            keys = [k for k in d if not k.endswith(("_u", "_v"))]
            for k in keys:
                res[f"{k}_wpp"] = []
                if with_grid:
                    res[f"{k}_grid"] = []
                    if VARS[k].get("arrows"):
                        res[f"{k}_u"], res[f"{k}_v"] = [], []
        for k in keys:
            lg = VARS[k].get("log", False)
            res[f"{k}_wpp"].append(grid.wpp_means(d[k], lg))
            if with_grid:
                res[f"{k}_grid"].append(grid.block(d[k], lg))
                if VARS[k].get("arrows"):
                    res[f"{k}_u"].append(grid.block(d[f"{k}_u"], arrow=True))
                    res[f"{k}_v"].append(grid.block(d[f"{k}_v"], arrow=True))
    return {k: np.array(v) for k, v in res.items()}


def fetch(groups, cache, t0):
    import copernicusmarine as cm
    import logging
    logging.getLogger("copernicusmarine").setLevel(logging.ERROR)
    if not cm.login(check_credentials_valid=True):
        raise SystemExit("Kredensial Copernicus Marine tidak valid.")
    geoms = wpp_geoms()
    os.makedirs(cache, exist_ok=True)
    for g in groups:
        cfg = GROUPS[g]
        extra = dict(minimum_depth=0.4, maximum_depth=1) if cfg.get("depth") else {}
        if g == "wind":
            fetch_wind(cm, cfg, geoms, cache, t0)
            continue
        # Buka sekali hanya untuk koordinat & rentang waktu (lazy); data diambil per tahun dengan rentang waktu eksplisit
        # — jauh lebih cepat daripada .sel() pada dataset penuh (chunk tidak terbaca ulang).
        ds = cm.open_dataset(dataset_id=cfg["dataset"], variables=cfg["raw"], **BBOX, **extra)
        if "depth" in ds.dims:
            ds = ds.isel(depth=0)
        grid = Grid(ds["latitude"].values, ds["longitude"].values, geoms)
        log(t0, f"{g}: grid {grid.shape}, {int((grid.wpp >= 0).sum()):,} sel di WPP")
        if cfg.get("climatology"):
            path = os.path.join(cache, f"{g}_clim.npz")
            if not os.path.exists(path):
                sub = ds.load()
                months = [f"clim-{m:02d}" for m in range(1, 13)]
                frames = {r: sub[r].values for r in cfg["raw"]}
                np.savez_compressed(path, **summarize(grid, g, months, frames, True))
                bounds = None
                try:
                    cb = cm.open_dataset(dataset_id=cfg["dataset"], variables=["climatology_bounds"], **BBOX)
                    bounds = [str(cb["climatology_bounds"].values.ravel()[0])[:10], str(cb["climatology_bounds"].values.ravel()[-1])[:10]]
                except Exception:  # noqa: BLE001
                    pass
                with open(os.path.join(cache, f"{g}_clim.json"), "w") as fh:
                    json.dump({"bounds": bounds}, fh)
            log(t0, f"{g}: klimatologi selesai")
            continue
        if cfg.get("service") == "arco-time-series":
            fetch_blocks(cm, g, cfg, extra, grid, cache, t0)
            continue
        years = sorted({int(str(t)[:4]) for t in ds["time"].values if int(str(t)[:4]) >= cfg["start"]})
        for y in years:
            path = os.path.join(cache, f"{g}_{y}.npz")
            if os.path.exists(path):
                continue
            raw = cfg["raw"] if (g != "phy" or y >= SERIES_START) else [cfg.get("sst_raw", "thetao")]
            sub = cm.open_dataset(dataset_id=cfg["dataset"], variables=raw, **BBOX, **extra, service=cfg.get("service"),
                                  start_datetime=f"{y}-01-01T00:00:00", end_datetime=f"{y}-12-31T23:59:59")
            if "depth" in sub.dims:
                sub = sub.isel(depth=0)
            sub = sub.load()
            months = [str(t)[:7] for t in sub["time"].values]
            frames = {r: sub[r].values for r in raw}
            np.savez_compressed(path, **summarize(grid, g, months, frames, y >= SERIES_START))
            log(t0, f"{g}: {y} ({len(months)} bulan)")


def fetch_blocks(cm, g, cfg, extra, grid, cache, t0):
    """Layanan arco-time-series: chunk kecil secara spasial tetapi panjang dalam waktu (mis. 68 bulan). Data diambil per
    blok waktu yang sejajar batas chunk sehingga tiap chunk dibaca sekali, lalu diringkas & disimpan per tahun."""
    ds = cm.open_dataset(dataset_id=cfg["dataset"], variables=cfg["raw"], **BBOX, **extra, service="arco-time-series")
    # Panjang chunk waktu sumber: dari chunk dask (mengikuti chunk zarr); bila tidak diketahui pakai 72 bulan.
    enc = ds[cfg["raw"][0]].encoding.get("chunks")
    sizes = getattr(ds[cfg["raw"][0]], "chunksizes", {}).get("time")
    step = int(enc["time"]) if isinstance(enc, dict) and "time" in enc else int(sizes[0]) if sizes else 72
    log(t0, f"{g}: chunk waktu {step} bulan")
    times = [str(t)[:7] for t in ds["time"].values]
    years_all = [int(t[:4]) for t in times]
    first = next(i for i, y in enumerate(years_all) if y >= cfg["start"])
    for b0 in range((first // step) * step, len(times), step):
        b1 = min(b0 + step, len(times))
        need = sorted({years_all[i] for i in range(max(b0, first), b1)})
        todo = [y for y in need if not os.path.exists(os.path.join(cache, f"{g}_{y}.npz"))]
        if not todo:
            continue
        raw = cfg["raw"] if (g != "phy" or max(todo) >= SERIES_START) else [cfg.get("sst_raw", "thetao")]
        sub = ds[raw].isel(time=slice(b0, b1))
        if "depth" in sub.dims:
            sub = sub.isel(depth=0)
        sub = sub.load()
        bt = [str(t)[:7] for t in sub["time"].values]
        for y in todo:
            idx = [i for i, m in enumerate(bt) if int(m[:4]) == y]
            # Tahun yang terpotong batas blok diselesaikan saat blok berikutnya (gabungan dua blok).
            if len(idx) < sum(1 for m in times if int(m[:4]) == y):
                prev = os.path.join(cache, f"_{g}_{y}_part.npz")
                if not os.path.exists(prev):
                    np.savez_compressed(prev, months=np.array([bt[i] for i in idx]), **{r: sub[r].values[idx] for r in raw})
                    continue
                part = dict(np.load(prev))
                months = part["months"].tolist() + [bt[i] for i in idx]
                frames = {r: np.concatenate([part[r], sub[r].values[idx]]) for r in raw if r in part}
                os.remove(prev)
            else:
                months = [bt[i] for i in idx]
                frames = {r: sub[r].values[idx] for r in raw}
            yr_raw = cfg["raw"] if (g != "phy" or y >= SERIES_START) else [cfg.get("sst_raw", "thetao")]
            frames = {r: frames[r] for r in yr_raw}
            np.savez_compressed(os.path.join(cache, f"{g}_{y}.npz"), **summarize(grid, g, months, frames, y >= SERIES_START))
            log(t0, f"{g}: {y} ({len(months)} bulan)")
        del sub


def fetch_wind(cm, cfg, geoms, cache, t0):
    y = cfg["year"]
    grid = None
    for m in range(1, 13):
        path = os.path.join(cache, f"wind_{y}_{m:02d}.npz")
        if os.path.exists(path):
            continue
        end = f"{y}-{m:02d}-{[31, 29 if y % 4 == 0 else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]}T23:00:00"
        ds = cm.open_dataset(dataset_id=cfg["dataset"], variables=cfg["raw"], **BBOX,
                             start_datetime=f"{y}-{m:02d}-01T00:00:00", end_datetime=end)
        sub = ds.isel(time=slice(0, None, cfg["stride_hours"])).load()
        if grid is None:
            grid = Grid(sub["latitude"].values, sub["longitude"].values, geoms)
        u, v = sub["eastward_wind"].values, sub["northward_wind"].values
        speed = np.nanmean(np.hypot(u, v), axis=0)
        um, vm = np.nanmean(u, axis=0), np.nanmean(v, axis=0)
        np.savez_compressed(path, months=np.array([f"{y}-{m:02d}"]), samples=np.array([u.shape[0]]),
                            wind_wpp=np.array([grid.wpp_means(speed)]), wind_grid=np.array([grid.block(speed)]),
                            wind_u=np.array([grid.block(um, arrow=True)]), wind_v=np.array([grid.block(vm, arrow=True)]))
        log(t0, f"wind: {y}-{m:02d} ({u.shape[0]} sampel)")


# ------------------------------------------------------------------------------------------------ assemble

def mann_kendall(y):
    from scipy import stats
    y = np.asarray(y, float)
    n = len(y)
    s = sum(np.sign(y[j] - y[i]) for i in range(n - 1) for j in range(i + 1, n))
    _, c = np.unique(y, return_counts=True)
    var = (n * (n - 1) * (2 * n + 5) - sum(k * (k - 1) * (2 * k + 5) for k in c)) / 18
    z = 0.0 if s == 0 else (s - np.sign(s)) / math.sqrt(var)
    p = 2 * (1 - stats.norm.cdf(abs(z)))
    slopes = [(y[j] - y[i]) / (j - i) for i in range(n - 1) for j in range(i + 1, n)]
    return {"tau": rnd(s / (n * (n - 1) / 2), 3), "p": rnd(p, 4), "senPerYear": sig(float(np.median(slopes))),
            "direction": ("up" if s > 0 else "down") if p < ALPHA else "none", "significant": bool(p < ALPHA)}


def rnd(x, nd):
    return None if x is None or not np.isfinite(x) else round(float(x), nd)


def sig(x, digits=4):
    if x is None or not np.isfinite(x):
        return None
    if x == 0:
        return 0.0
    return float(f"{x:.{digits}g}")


def pearson(a, b):
    from scipy import stats
    a, b = np.asarray(a, float), np.asarray(b, float)
    ok = np.isfinite(a) & np.isfinite(b)
    if ok.sum() < 4 or np.std(a[ok]) == 0 or np.std(b[ok]) == 0:
        return {"r": None, "p": None, "n": int(ok.sum())}
    r, p = stats.pearsonr(a[ok], b[ok])
    return {"r": rnd(r, 3), "p": rnd(p, 4), "n": int(ok.sum())}


def load_cache(cache, group):
    files = sorted(glob.glob(os.path.join(cache, f"{group}_*.npz")))
    parts = [dict(np.load(f)) for f in files]
    if not parts:
        return None
    out = {}
    for k in set().union(*[p.keys() for p in parts]):
        arrs = [p[k] for p in parts if k in p]
        if k == "months":
            continue
        out[k] = arrs
    # bulan per kunci (phy sebelum 2012 hanya punya sst)
    out["_months"] = {}
    for p in parts:
        for k in p:
            if k.endswith("_wpp"):
                out["_months"].setdefault(k[:-4], []).extend(p["months"].tolist())
    for k, arrs in list(out.items()):
        if not k.startswith("_"):
            out[k] = np.concatenate(arrs, axis=0)
    return out


def assemble(cache, t0):
    os.makedirs(os.path.join(OUT_DIR, "grids"), exist_ok=True)
    viirs = json.load(open(VIIRS_MONTHLY, encoding="utf-8"))
    v_months = viirs["months"]
    v_series = {"total": viirs["total"], **viirs["wpp"]}
    v_clim_idx = [i for i, m in enumerate(v_months) if int(m[:4]) <= CLIM[1]]

    def clim12(months, values):
        """Rata-rata per bulan kalender untuk tahun CLIM; values: (n,) → 12."""
        out = []
        for mm in range(1, 13):
            sel = [i for i, m in enumerate(months) if m[:4].isdigit() and CLIM[0] <= int(m[:4]) <= CLIM[1] and int(m[5:7]) == mm]
            vals = np.asarray(values, float)[sel] if sel else np.array([np.nan])
            out.append(np.nanmean(vals) if np.isfinite(vals).any() else np.nan)
        return np.array(out)

    v_clim = {k: clim12([v_months[i] for i in v_clim_idx], [v_series[k][i] for i in v_clim_idx]) for k in KEYS12}

    meta_vars, series, seasonal, trends, link = [], {}, {}, {}, {"viirsSeasonal": {k: [rnd(x, 1) for x in v_clim[k]] for k in KEYS12}, "vars": {}}
    caches = {g: load_cache(cache, g) for g in GROUPS}
    ocean = None  # sel laut (dari grid suhu) — dipakai untuk memotong data angin yang juga mencakup daratan
    wave_bounds = None
    if os.path.exists(os.path.join(cache, "wave_clim.json")):
        wave_bounds = json.load(open(os.path.join(cache, "wave_clim.json"))).get("bounds")

    for key, cfg in VARS.items():
        c = caches.get(cfg["group"])
        if c is None or f"{key}_wpp" not in c or f"{key}_grid" not in c:
            log(t0, f"LEWATI {key}: cache belum ada")
            continue
        months = c["_months"][key]
        wpp = c[f"{key}_wpp"]  # (n, 12)
        kind = "climatology" if cfg["group"] == "wave" else ("year" if cfg["group"] == "wind" else "series")
        if kind != "series" and len({int(m[-2:]) for m in months}) < 12:
            log(t0, f"LEWATI {key}: baru {len(months)} dari 12 bulan")
            continue
        lg = cfg.get("log", False)
        grp = GROUPS[cfg["group"]]

        # Bulan grid (hanya bulan dengan grid tersimpan).
        if kind == "series":
            gmonths = [m for m in months if int(m[:4]) >= SERIES_START]
        else:
            gmonths = months
        grids = c[f"{key}_grid"]
        assert len(gmonths) == len(grids), (key, len(gmonths), len(grids))

        # ---- klimatologi WPP & grid
        if kind == "series":
            clim_w = np.array([clim12(months, wpp[:, j]) for j in range(12)]).T  # (12 bulan, 12 wilayah)
        else:
            clim_w = np.array([wpp[[i for i, m in enumerate(months) if int(m[-2:]) == mm][0]] for mm in range(1, 13)])
        frames = {}
        for mm in range(1, 13):
            sel = [i for i, m in enumerate(gmonths) if int(m[-2:]) == mm and (kind != "series" or CLIM[0] <= int(m[:4]) <= CLIM[1])]
            stack = grids[sel]
            frames[str(mm)] = (10 ** np.nanmean(np.log10(stack), axis=0) if lg else np.nanmean(stack, axis=0)) if len(sel) else np.full(NX * NY, np.nan)
        latest = gmonths[-1] if kind == "series" else None
        if latest:
            frames["latest"] = grids[-1]
        if key == "sst":
            ocean = np.isfinite(np.vstack(list(frames.values()))).any(axis=0)
        if key == "wind" and ocean is not None:
            frames = {k: np.where(ocean, f, np.nan) for k, f in frames.items()}

        # ---- peta
        allv = np.concatenate([f[np.isfinite(f)] for f in frames.values()])
        if lg:
            allv = allv[allv > 0]
        lo, hi = (np.percentile(np.log10(allv), [2, 98]) if lg else np.percentile(allv, [2, 98]))
        cells = np.nonzero(np.isfinite(np.vstack(list(frames.values()))).any(axis=0))[0]
        sc = cfg["scale"]
        gjson = {
            "key": key, "res": RES, "lon0": LON0, "lat0": LAT0, "nx": NX, "ny": NY, "scale": sc, "log": lg,
            "vmin": rnd(10 ** lo if lg else lo, 4), "vmax": rnd(10 ** hi if lg else hi, 4),
            "latestMonth": latest, "cells": cells.tolist(),
            "frames": {k: [None if not np.isfinite(f[i]) else int(round(float(f[i]) * sc)) for i in cells] for k, f in frames.items()},
        }
        if cfg.get("arrows"):
            us, vs = c[f"{key}_u"], c[f"{key}_v"]
            af = {}
            for mm in range(1, 13):
                sel = [i for i, m in enumerate(gmonths) if int(m[-2:]) == mm and (kind != "series" or CLIM[0] <= int(m[:4]) <= CLIM[1])]
                af[str(mm)] = (np.nanmean(us[sel], axis=0), np.nanmean(vs[sel], axis=0))
            if latest:
                af["latest"] = (us[-1], vs[-1])
            acells = np.nonzero(np.isfinite(af["1"][0]))[0]
            if ocean is not None:
                # Panah hanya di blok 1° yang memuat sel laut 0,25°.
                oy, ox = np.divmod(np.nonzero(ocean)[0], NX)
                amask = np.zeros(ANX * ANY, dtype=bool)
                amask[np.clip((oy * RES // ARES).astype(int), 0, ANY - 1) * ANX + np.clip((ox * RES // ARES).astype(int), 0, ANX - 1)] = True
                acells = acells[amask[acells]]
            gjson["arrows"] = {"res": ARES, "nx": ANX, "ny": ANY, "lon0": LON0, "lat0": LAT0, "scale": 1000, "cells": acells.tolist(),
                               "frames": {k: [[None if not np.isfinite(u[i]) else int(round(float(u[i]) * 1000)) for i in acells],
                                              [None if not np.isfinite(v[i]) else int(round(float(v[i]) * 1000)) for i in acells]]
                                          for k, (u, v) in af.items()}}
        with open(os.path.join(OUT_DIR, "grids", f"{key}.json"), "w", encoding="utf-8") as fh:
            json.dump(gjson, fh, separators=(",", ":"))

        # ---- musiman
        seasonal[key] = {}
        for j, area in enumerate(KEYS12):
            col = clim_w[:, j]
            seasonal[key][area] = {"mean": [sig(x) for x in col],
                                   "peak": int(np.nanargmax(col)) + 1 if np.isfinite(col).any() else None,
                                   "low": int(np.nanargmin(col)) + 1 if np.isfinite(col).any() else None,
                                   "amplitude": sig(float(np.nanmax(col) - np.nanmin(col))) if np.isfinite(col).any() else None}

        # ---- deret waktu & tren
        if kind == "series":
            sm = [m for m in months if int(m[:4]) >= SERIES_START]
            si = [months.index(m) for m in sm]
            series[key] = {"months": sm, **{area: [sig(x) for x in wpp[si, j]] for j, area in enumerate(KEYS12)}}
            full = sorted({int(m[:4]) for m in months if sum(1 for x in months if x[:4] == m[:4]) == 12 and int(m[:4]) <= CLIM[1]})
            tr = {"years": full}
            for j, area in enumerate(KEYS12):
                ann = []
                for y in full:
                    vals = wpp[[i for i, m in enumerate(months) if int(m[:4]) == y], j]
                    ann.append(10 ** np.nanmean(np.log10(vals)) if lg else np.nanmean(vals))
                mk = mann_kendall(ann) if np.isfinite(ann).all() else {}
                if mk:
                    mk["senPerDecade"] = sig(mk["senPerYear"] * 10)
                tr[area] = {"annual": [sig(x) for x in ann], **mk}
            trends[key] = tr

            # ---- keterkaitan dengan deteksi kapal VIIRS
            lk = {}
            vm_idx = [i for i, m in enumerate(v_months) if int(m[:4]) <= CLIM[1] and m in months]
            for j, area in enumerate(KEYS12):
                vals = np.array([wpp[months.index(v_months[i]), j] for i in vm_idx], float)
                det = np.array([v_series[area][i] for i in vm_idx], float)
                mm_ = np.array([int(v_months[i][5:7]) for i in vm_idx])
                va = vals - np.array([clim_w[m - 1, j] for m in mm_])
                da = det - np.array([v_clim[area][m - 1] for m in mm_])
                lk[area] = {"season": pearson(clim_w[:, j], v_clim[area]), "anomaly": pearson(va, da)}
            link["vars"][key] = lk
        else:
            link["vars"][key] = {area: {"season": pearson(clim_w[:, j], v_clim[area]), "anomaly": None} for j, area in enumerate(KEYS12)}

        if kind == "series":
            period = {"start": months[0], "end": months[-1], "climatology": list(CLIM)}
        elif kind == "climatology":
            period = {"climatologyBounds": wave_bounds}
        else:
            period = {"year": GROUPS["wind"]["year"], "strideHours": GROUPS["wind"]["stride_hours"]}
        meta_vars.append({"key": key, "label": cfg["label"], "unit": cfg["unit"], "kind": kind, "log": lg,
                          "arrows": bool(cfg.get("arrows")), "dataset": grp["dataset"], "product": grp["product"], "period": period})
        log(t0, f"{key}: {kind}, {len(months)} bulan, peta {len(cells):,} sel")

    meta = {"generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "wpp": WPP_CODES, "climatology": list(CLIM),
            "grid": {"res": RES, "lon0": LON0, "lat0": LAT0, "nx": NX, "ny": NY}, "variables": meta_vars,
            "source": "E.U. Copernicus Marine Service Information"}
    sizes = {}
    for name, payload in [("meta.json", meta), ("series.json", series), ("seasonal.json", seasonal), ("trends.json", trends), ("link.json", link)]:
        p = os.path.join(OUT_DIR, name)
        with open(p, "w", encoding="utf-8") as fh:
            json.dump(payload, fh, ensure_ascii=False, separators=(",", ":"))
        sizes[name] = os.path.getsize(p)
    for p in glob.glob(os.path.join(OUT_DIR, "grids", "*.json")):
        sizes["grids/" + os.path.basename(p)] = os.path.getsize(p)
    for k, v in sorted(sizes.items()):
        print(f"  {k:<24} {v / 1024:9.1f} KB")
    print(f"  {'TOTAL':<24} {sum(sizes.values()) / 1024:9.1f} KB")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("step", choices=["fetch", "assemble"])
    ap.add_argument("--groups", default=",".join(GROUPS))
    ap.add_argument("--cache", required=True)
    ap.add_argument("--env-file")
    a = ap.parse_args()
    t0 = time.time()
    if a.env_file:
        load_env(a.env_file)
    if a.step == "fetch":
        fetch([g for g in a.groups.split(",") if g], a.cache, t0)
    else:
        assemble(a.cache, t0)
    log(t0, "selesai")


if __name__ == "__main__":
    main()
