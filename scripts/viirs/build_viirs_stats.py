"""Statistik lanjutan VIIRS (Tabel 6 & 7, Fig 9-12 & 15 paper) dari ringkasan hasil build_viirs_summary.py.

    python scripts/viirs/build_viirs_stats.py

Input  : src/data/viirs/annual.json & monthly.json (tidak perlu membaca CSV 2 GB lagi).
Output : src/data/viirs/stats.json.

- Tren tahunan 2012-2025 (2026 belum setahun penuh, sesuai paper): Mann-Kendall dua sisi (koreksi ties),
  Kendall's tau, Sen's slope, LOESS (statsmodels lowess), CV = SD/rata-rata x 100.
- Musiman: STL (periode 12, robust) pada seri bulanan April 2012 - Desember 2025; rata-rata deteksi per bulan.
- Prediksi WPP 712 & 717: SARIMA vs ETS (model dipilih AIC terkecil dari grid kecil), latih s.d. Desember 2024,
  uji Januari 2025 - bulan terakhir data, lalu dilatih ulang pada seluruh data untuk proyeksi s.d. Desember 2027.
  Uji Diebold-Mariano (h=1, koreksi Harvey) dengan d_t = loss(ETS) - loss(SARIMA): negatif = galat ETS lebih kecil.
Parameter yang tidak disebut paper (frac LOESS, grid model, pembagian latih/uji) dicatat di stats.json.
"""
import itertools
import json
import math
import os
import warnings

import numpy as np
from scipy import stats
from statsmodels.nonparametric.smoothers_lowess import lowess
from statsmodels.tsa.exponential_smoothing.ets import ETSModel
from statsmodels.tsa.seasonal import STL
from statsmodels.tsa.statespace.sarimax import SARIMAX

warnings.filterwarnings("ignore")
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DATA = os.path.join(ROOT, "src", "data", "viirs")
TREND_END = 2025
SEASONAL_END = "2025-12"
LOESS_FRAC = 2 / 3
FORECAST_WPP = ["712", "717"]
TRAIN_END = "2024-12"
FORECAST_END = "2027-12"
ALPHA = 0.05


def load(name):
    with open(os.path.join(DATA, name), encoding="utf-8") as fh:
        return json.load(fh)


def r(x, nd=4):
    return None if x is None or not math.isfinite(x) else round(float(x), nd)


def mann_kendall(y):
    y = np.asarray(y, dtype=float)
    n = len(y)
    s = sum(np.sign(y[j] - y[i]) for i in range(n - 1) for j in range(i + 1, n))
    _, counts = np.unique(y, return_counts=True)
    var = (n * (n - 1) * (2 * n + 5) - sum(c * (c - 1) * (2 * c + 5) for c in counts)) / 18
    z = 0.0 if s == 0 else (s - np.sign(s)) / math.sqrt(var)
    p = 2 * (1 - stats.norm.cdf(abs(z)))
    tau = s / (n * (n - 1) / 2)
    slopes = [(y[j] - y[i]) / (j - i) for i in range(n - 1) for j in range(i + 1, n)]
    return {"S": int(s), "z": r(z), "tau": r(tau, 3), "p": r(p, 4), "senSlope": r(float(np.median(slopes)), 1),
            "direction": ("up" if s > 0 else "down") if p < ALPHA else "none", "significant": bool(p < ALPHA)}


def cv_class(cv):
    return "stable" if cv < 30 else ("moderate" if cv <= 50 else "high")


def month_range(start, end):
    y, m = map(int, start.split("-"))
    ey, em = map(int, end.split("-"))
    out = []
    while (y, m) <= (ey, em):
        out.append(f"{y}-{m:02d}")
        m += 1
        if m > 12:
            y, m = y + 1, 1
    return out


def fit_sarima(y):
    best = None
    for p, q, P, Q in itertools.product([0, 1], [0, 1], [0, 1], [0, 1]):
        try:
            res = SARIMAX(y, order=(p, 1, q), seasonal_order=(P, 1, Q, 12),
                          enforce_stationarity=False, enforce_invertibility=False).fit(disp=False)
        except Exception:
            continue
        if math.isfinite(res.aic) and (best is None or res.aic < best[0]):
            best = (res.aic, (p, 1, q), (P, 1, Q, 12))
    return best


def fit_ets(y):
    best = None
    for trend, damped, seasonal in [(None, False, "add"), ("add", False, "add"), ("add", True, "add"),
                                    (None, False, "mul"), ("add", False, "mul"), ("add", True, "mul")]:
        try:
            res = ETSModel(y, error="add", trend=trend, damped_trend=damped, seasonal=seasonal,
                           seasonal_periods=12).fit(disp=False)
        except Exception:
            continue
        if math.isfinite(res.aic) and (best is None or res.aic < best[0]):
            best = (res.aic, {"error": "add", "trend": trend, "damped": damped, "seasonal": seasonal})
    return best


def sarima_forecast(y, order, sorder, steps):
    res = SARIMAX(y, order=order, seasonal_order=sorder, enforce_stationarity=False,
                  enforce_invertibility=False).fit(disp=False)
    return np.asarray(res.forecast(steps))


def ets_forecast(y, spec, steps):
    res = ETSModel(y, error=spec["error"], trend=spec["trend"], damped_trend=spec["damped"],
                   seasonal=spec["seasonal"], seasonal_periods=12).fit(disp=False)
    return np.asarray(res.forecast(steps))


def errors(actual, pred):
    actual, pred = np.asarray(actual, float), np.asarray(pred, float)
    e = actual - pred
    return {"rmse": r(math.sqrt(np.mean(e ** 2)), 1), "mape": r(np.mean(np.abs(e / actual)) * 100, 1),
            "mae": r(np.mean(np.abs(e)), 1)}


def diebold_mariano(loss_a, loss_b):
    """d = loss_a - loss_b, h = 1, koreksi sampel kecil Harvey dkk. (1997), p dari distribusi t (n-1)."""
    d = np.asarray(loss_a, float) - np.asarray(loss_b, float)
    n = len(d)
    var = np.var(d, ddof=0) / n
    if var <= 0:
        return {"dm": None, "p": None, "significant": False}
    dm = np.mean(d) / math.sqrt(var) * math.sqrt((n + 1 - 2 + 0) / n)
    p = 2 * (1 - stats.t.cdf(abs(dm), df=n - 1))
    return {"dm": r(dm, 3), "p": r(p, 3), "significant": bool(p < ALPHA)}


def main():
    annual, monthly = load("annual.json"), load("monthly.json")
    years = annual["years"]
    t_idx = [i for i, y in enumerate(years) if y <= TREND_END]
    t_years = [years[i] for i in t_idx]
    series = {"total": annual["total"]["all"], **{c: annual["wpp"][c]["all"] for c in annual["wpp"]}}

    trend = {}
    for key, vals in series.items():
        y = np.array([vals[i] for i in t_idx], dtype=float)
        mean, sd = float(np.mean(y)), float(np.std(y, ddof=1))
        cv = sd / mean * 100
        fit = lowess(y, np.array(t_years, float), frac=LOESS_FRAC, return_sorted=False)
        trend[key] = {"values": [int(v) for v in y], "loess": [r(v, 1) for v in fit],
                      "mean": r(mean, 1), "sd": r(sd, 1), "cv": r(cv, 1), "cvClass": cv_class(cv),
                      **mann_kendall(y)}

    months = monthly["months"]
    s_months = [m for m in months if m <= SEASONAL_END]
    s_idx = [months.index(m) for m in s_months]
    seasonal = {}
    for key in ["total"] + list(monthly["wpp"]):
        full = monthly["total"] if key == "total" else monthly["wpp"][key]
        y = np.array([full[i] for i in s_idx], dtype=float)
        comp = STL(y, period=12, robust=True).fit().seasonal
        cal = np.array([int(m[5:]) for m in s_months])
        index = [float(np.mean(comp[cal == mm])) for mm in range(1, 13)]
        mean_month = [float(np.mean(y[cal == mm])) for mm in range(1, 13)]
        seasonal[key] = {"seasonalIndex": [r(v, 1) for v in index], "monthlyMean": [r(v, 1) for v in mean_month],
                         "peakMonth": int(np.argmax(index)) + 1, "lowMonth": int(np.argmin(index)) + 1,
                         "amplitude": r(max(index) - min(index), 1)}

    forecast = {}
    last_month = months[-1]
    for code in FORECAST_WPP:
        y_all = np.array(monthly["wpp"][code], dtype=float)
        n_train = months.index(TRAIN_END) + 1
        train, test = y_all[:n_train], y_all[n_train:]
        sar = fit_sarima(train)
        ets = fit_ets(train)
        p_sar = sarima_forecast(train, sar[1], sar[2], len(test))
        p_ets = ets_forecast(train, ets[1], len(test))
        future = month_range(last_month, FORECAST_END)[1:]
        f_sar = sarima_forecast(y_all, sar[1], sar[2], len(future))
        f_ets = ets_forecast(y_all, ets[1], len(future))
        ape = lambda p: np.abs((test - p) / test) * 100
        se = lambda p: (test - p) ** 2
        forecast[code] = {
            "months": months, "actual": [int(v) for v in y_all], "trainEnd": TRAIN_END,
            "test": {"months": months[n_train:], "sarima": [r(v, 1) for v in p_sar], "ets": [r(v, 1) for v in p_ets]},
            "future": {"months": future, "sarima": [r(v, 1) for v in f_sar], "ets": [r(v, 1) for v in f_ets]},
            "models": {"sarima": {"order": list(sar[1]), "seasonalOrder": list(sar[2]), "aic": r(sar[0], 1)},
                       "ets": {**ets[1], "aic": r(ets[0], 1)}},
            "metrics": {"sarima": errors(test, p_sar), "ets": errors(test, p_ets)},
            "dm": {"mape": diebold_mariano(ape(p_ets), ape(p_sar)), "rmse": diebold_mariano(se(p_ets), se(p_sar))},
        }

    out = {
        "params": {"trendYears": [t_years[0], t_years[-1]], "alpha": ALPHA, "loessFrac": r(LOESS_FRAC, 3),
                   "cvClasses": {"stable": "< 30%", "moderate": "30-50%", "high": "> 50%"},
                   "seasonalRange": [s_months[0], s_months[-1]], "stl": {"period": 12, "robust": True},
                   "forecast": {"train": [months[0], TRAIN_END], "test": [months[months.index(TRAIN_END) + 1], last_month],
                                "horizonEnd": FORECAST_END,
                                "sarimaGrid": "p,q,P,Q ∈ {0,1}; d = D = 1; s = 12 (AIC terkecil)",
                                "etsGrid": "galat aditif; tren tidak ada/aditif/aditif teredam; musiman aditif/multiplikatif (AIC terkecil)",
                                "dm": "h = 1, koreksi Harvey; d = loss ETS − loss SARIMA (negatif = ETS lebih akurat)"}},
        "trend": trend, "seasonal": seasonal, "forecast": forecast,
    }
    path = os.path.join(DATA, "stats.json")
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False, separators=(",", ":"))

    print("Tren 2012-2025 (tau, p, Sen, CV):")
    for k, v in trend.items():
        print(f"  {k:>5}: tau {v['tau']:+.3f}  p {v['p']:.3f}  Sen {v['senSlope']:+10.1f}  CV {v['cv']:5.1f}% {v['cvClass']:<8} {v['direction']}")
    print("\nMusiman (puncak, terendah, amplitudo):")
    for k, v in seasonal.items():
        print(f"  {k:>5}: puncak {v['peakMonth']:>2}  terendah {v['lowMonth']:>2}  amplitudo {v['amplitude']}")
    print("\nPrediksi:")
    for k, v in forecast.items():
        print(f"  {k}: SARIMA {v['models']['sarima']['order']}{v['models']['sarima']['seasonalOrder']} {v['metrics']['sarima']}")
        print(f"       ETS {v['models']['ets']} {v['metrics']['ets']}")
        print(f"       DM MAPE {v['dm']['mape']}  RMSE {v['dm']['rmse']}")
    print(f"\nstats.json: {os.path.getsize(path) / 1024:.1f} KB")


if __name__ == "__main__":
    main()
