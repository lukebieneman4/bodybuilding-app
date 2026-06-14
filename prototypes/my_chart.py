"""
Your bodyweight trend — from your own weigh-ins.

Edit prototypes/my_weighins.csv with your data, set the four values in the
CONFIG block below, then run:

    python3 prototypes/my_chart.py

It writes prototypes/my_trend.png. Same estimator as the demo (local-linear-
trend Kalman filter + RTS smoother); all math is done in kilograms internally
(SI, per the core convention) and converted to your display unit at the edge.
"""
import csv, sys
from datetime import datetime, date
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch

# ============================ CONFIG — EDIT THIS ============================
WEIGHIN_CSV = "prototypes/my_weighins.csv"
UNIT        = "lb"           # "lb" or "kg" — the unit your CSV weights are in
GOAL        = 185.0          # your goal weight, in UNIT
TARGET_DATE = "2025-09-01"   # deadline as "YYYY-MM-DD", or None for no deadline
# ===========================================================================

KG_PER_LB = 0.45359237
R0_PCT_WK = 0.7              # ideal loss/gain rate, %BW/week (Helms 2014 / Garthe 2011)
R = 0.80 ** 2               # daily weigh-in measurement variance (kg^2)
q = 2.5e-4                 # slope smoothness knob
H = np.array([[1.0, 0.0]])

to_kg   = (lambda w: w * KG_PER_LB) if UNIT == "lb" else (lambda w: float(w))
to_disp = (lambda kg: kg / KG_PER_LB) if UNIT == "lb" else (lambda kg: kg)

def parse_date(s):
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%m/%d/%y"):
        try: return datetime.strptime(s.strip(), fmt).date()
        except ValueError: pass
    raise SystemExit(f"Can't parse date '{s}'. Use YYYY-MM-DD.")

# ---- load weigh-ins ------------------------------------------------------
rows = []
with open(WEIGHIN_CSV) as f:
    for raw in f:
        line = raw.strip()
        if not line or line.startswith("#"): continue
        parts = [p.strip() for p in line.split(",")]
        if len(parts) < 2: continue
        try: w = float(parts[1])
        except ValueError: continue          # skips the header row
        rows.append((parse_date(parts[0]), w))
if len(rows) < 2:
    raise SystemExit("Need at least 2 weigh-ins in the CSV.")
rows.sort(key=lambda r: r[0])
d0 = rows[0][0]
days = np.array([(d - d0).days for d, _ in rows], dtype=float)
obs  = np.array([to_kg(w) for _, w in rows])           # kg internally
GOAL_KG  = to_kg(GOAL)
START_KG = obs[0]
losing   = GOAL_KG < START_KG

# ---- local-linear-trend Kalman filter + RTS smoother ---------------------
def Fmat(dt): return np.array([[1.0, dt], [0.0, 1.0]])
def Qmat(dt): return q * np.array([[dt**3/3, dt**2/2], [dt**2/2, dt]])

n = len(obs)
x = np.array([obs[0], 0.0]); P = np.array([[R, 0.0], [0.0, 0.01]])
xf = np.zeros((n, 2)); Pf = np.zeros((n, 2, 2))
xp = np.zeros((n, 2)); Pp = np.zeros((n, 2, 2)); Fs = np.zeros((n, 2, 2))
xf[0], Pf[0], xp[0], Pp[0], Fs[0] = x, P, x, P, np.eye(2)
for i in range(1, n):
    dt = float(days[i] - days[i - 1]); F = Fmat(dt); Fs[i] = F
    x = F @ x; P = F @ P @ F.T + Qmat(dt); xp[i], Pp[i] = x, P
    S = (H @ P @ H.T).item() + R
    K = (P @ H.T / S).ravel()
    x = x + K * (obs[i] - (H @ x).item())
    P = (np.eye(2) - np.outer(K, H)) @ P
    xf[i], Pf[i] = x, P
xs, Ps = xf.copy(), Pf.copy()
for i in range(n - 2, -1, -1):
    C = Pf[i] @ Fs[i + 1].T @ np.linalg.inv(Pp[i + 1])
    xs[i] = xf[i] + C @ (xs[i + 1] - xp[i + 1])
    Ps[i] = Pf[i] + C @ (Ps[i + 1] - Pp[i + 1]) @ C.T
trend = xs[:, 0]; trend_sd = np.sqrt(Ps[:, 0, 0])
slope_robust = float(np.mean(xs[days >= days[-1] - 21, 1]))   # trailing 21-day rate

# ---- horizon (target date, or rate-based estimate) -----------------------
if TARGET_DATE:
    prep_days = max((parse_date(TARGET_DATE) - d0).days, int(days[-1]) + 1)
else:
    daily = (R0_PCT_WK / 100) * START_KG / 7
    prep_days = int(days[-1] + abs(START_KG - GOAL_KG) / max(daily, 1e-6))
full = np.arange(0, prep_days + 1)

# ---- ideal non-linear curve (decelerating; crosses goal at the date) -----
asym = GOAL_KG - (0.5 if losing else -0.5)
ratio = (GOAL_KG - asym) / (START_KG - asym)
k_id = -np.log(ratio) / prep_days if 0 < ratio < 1 else 0.0
ideal = asym + (START_KG - asym) * np.exp(-k_id * full)
ideal_slope_now = -(START_KG - asym) * k_id * np.exp(-k_id * days[-1])

# ---- projection to goal: propagate trend forward, widening band ----------
# Forward projection assumes the recent trailing rate roughly persists, with
# only modest drift — so it uses a gentler process noise than the historical
# smoother (whose band reflects full rate uncertainty). Keeps the cone honest
# but readable; a real rate change will show up as the trend updates.
q_proj = q * 0.15
def Qp(dt): return q_proj * np.array([[dt**3/3, dt**2/2], [dt**2/2, dt]])
xh = np.array([xf[-1, 0], slope_robust]); Ph = Pf[-1].copy()
pdays, plvl, psd = [days[-1]], [xh[0]], [np.sqrt(Ph[0, 0])]; goal_eta = None
for dd in range(1, int(prep_days - days[-1]) + 21):
    xh = Fmat(1.0) @ xh; Ph = Fmat(1.0) @ Ph @ Fmat(1.0).T + Qp(1.0)
    pdays.append(days[-1] + dd); plvl.append(xh[0]); psd.append(np.sqrt(Ph[0, 0]))
    crossed = (xh[0] <= GOAL_KG) if losing else (xh[0] >= GOAL_KG)
    if goal_eta is None and crossed: goal_eta = days[-1] + dd
    # stop ~2 weeks past the projected goal so the band stays readable
    if goal_eta is not None and (days[-1] + dd) >= goal_eta + 14: break
pdays, plvl, psd = map(np.array, (pdays, plvl, psd))

# ---- status: actual rate vs ideal pace -----------------------------------
unit_div = KG_PER_LB if UNIT == "lb" else 1.0          # rate is a delta in kg/day
rate_disp = slope_robust * 7 / unit_div                 # display unit per week
ideal_disp = ideal_slope_now * 7 / unit_div
rate_pct = slope_robust * 7 / trend[-1] * 100
diff = (slope_robust - ideal_slope_now) * 7             # kg/wk, signed
status, scol = ("On track", "#2E7D5B")
if losing and diff < -0.12:   status, scol = ("Slightly fast", "#B4690E")
elif losing and diff > 0.12:  status, scol = ("Behind pace", "#B4690E")
eta_txt = ""
if goal_eta is not None:
    wk = (goal_eta - days[-1]) / 7
    lvl0 = xf[-1, 0]; ssd = float(np.sqrt(Pf[-1, 1, 1]))   # current rate uncertainty
    def eta_wk(sl):                                         # weeks-to-goal at rate sl
        if (sl < 0) == losing and abs(sl) > 1e-6:
            return (GOAL_KG - lvl0) / sl / 7
        return None
    e_fast, e_slow = eta_wk(slope_robust - ssd), eta_wk(slope_robust + ssd)
    if e_fast and e_slow and 0 < e_fast < e_slow < wk * 4:
        eta_txt = f"goal in ~{wk:.0f} wk  ({e_fast:.0f}–{e_slow:.0f} wk)"
    else:
        eta_txt = f"projected goal in ~{wk:.0f} wk"

print(f"latest trend : {to_disp(trend[-1]):.1f} {UNIT}")
print(f"current rate : {rate_disp:+.2f} {UNIT}/wk ({rate_pct:+.2f} %/wk)")
print(f"ideal pace   : {ideal_disp:+.2f} {UNIT}/wk   -> {status}")
print(f"{eta_txt}   (target horizon: day {prep_days})" if eta_txt else f"(target horizon: day {prep_days})")

# ============================== RENDER ====================================
INK="#1F2933"; SUB="#6B7280"; TREND="#0E7C7B"; IDEAL="#C08552"; DOT="#9AA5B1"; GOALC="#A8B0BA"
BG="#FBFAF7"
plt.rcParams.update({"font.family": "DejaVu Sans"})
fig, ax = plt.subplots(figsize=(11, 6.4), dpi=150)
fig.subplots_adjust(top=0.84, left=0.08, right=0.96, bottom=0.10)
fig.patch.set_facecolor(BG); ax.set_facecolor(BG)

D = to_disp  # shorthand
ax.plot(full, D(ideal), ls=(0,(5,4)), lw=1.8, color=IDEAL, alpha=0.9, label="Ideal target", zorder=3)
ax.scatter(days, D(obs), s=18, color=DOT, alpha=0.5, edgecolors="none", label="Weigh-ins", zorder=2)
ax.fill_between(days, D(trend-1.96*trend_sd), D(trend+1.96*trend_sd), color=TREND, alpha=0.13, lw=0, zorder=3)
ax.plot(days, D(trend), lw=3.0, color=TREND, label="Trend (95% band)", zorder=5, solid_capstyle="round")
ax.plot(pdays, D(plvl), lw=2.2, color=TREND, ls=(0,(1,1.4)), alpha=0.85, label="Projection", zorder=4)
ax.axhline(D(GOAL_KG), color=GOALC, lw=1.2, ls=(0,(2,3)), zorder=1)
ax.text(full[-1], D(GOAL_KG), f"  goal {GOAL:g} {UNIT}", va="bottom", ha="right", color=SUB, fontsize=9)
if TARGET_DATE:
    ax.axvline(prep_days, color=GOALC, lw=1.0, ls=":", zorder=1)
ax.scatter([days[-1]],[D(trend[-1])], s=44, color=TREND, zorder=7, edgecolors="white", linewidths=1.4)
if goal_eta is not None:
    ax.scatter([goal_eta],[D(GOAL_KG)], s=44, color=TREND, zorder=6, edgecolors="white", linewidths=1.4)

# ---- corner stat-card (axes fraction → never overlaps the data) ----------
cx, cy, cw, ch = 0.685, 0.78, 0.30, 0.185
ax.add_patch(FancyBboxPatch((cx, cy), cw, ch, boxstyle="round,pad=0.012,rounding_size=0.02",
        linewidth=0, facecolor="white", alpha=0.85, zorder=8, transform=ax.transAxes))
tx = cx + 0.022
ax.text(tx, cy+ch-0.045, f"● {status}", color=scol, fontsize=11, fontweight="bold",
        ha="left", va="center", transform=ax.transAxes, zorder=9)
ax.text(tx, cy+ch-0.105, f"{D(trend[-1]):.1f} {UNIT}", color=INK, fontsize=15, fontweight="bold",
        ha="left", va="center", transform=ax.transAxes, zorder=9)
ax.text(tx, cy+0.052, f"{rate_disp:+.2f} {UNIT}/wk · {rate_pct:+.2f}%/wk", color=SUB, fontsize=9.5,
        ha="left", va="center", transform=ax.transAxes, zorder=9)
if eta_txt:
    ax.text(tx, cy+0.018, eta_txt, color=SUB, fontsize=8.5, ha="left", va="center",
            transform=ax.transAxes, zorder=9)

lo = min(D(GOAL_KG), D(trend.min()), D(obs.min())) - 1.5
hi = max(D(obs.max()), D(trend.max())) + 1.5
ax.set_xlim(-2, full[-1] + 4); ax.set_ylim(lo, hi)
ax.set_xlabel("Day", color=SUB, fontsize=10); ax.set_ylabel(f"Weight ({UNIT})", color=SUB, fontsize=10)
ax.tick_params(colors=SUB, labelsize=9)
for s in ("top","right"): ax.spines[s].set_visible(False)
for s in ("left","bottom"): ax.spines[s].set_color("#D7D3CA")
ax.grid(axis="y", color="#ECE8DF", lw=0.9); ax.set_axisbelow(True)
fig.text(0.08, 0.93, "Your bodyweight trend", color=INK, fontsize=17, fontweight="bold", ha="left")
fig.text(0.08, 0.885, f"{len(rows)} weigh-ins · {int(days[-1])+1} days · trend, honest uncertainty, ideal vs actual",
         color=SUB, fontsize=10, ha="left")
ax.legend(loc="lower left", frameon=False, fontsize=9, labelcolor=INK, ncol=2, columnspacing=1.4)
plt.savefig("prototypes/my_trend.png", facecolor=BG, bbox_inches="tight")
print("saved prototypes/my_trend.png")
