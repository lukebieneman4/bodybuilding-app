"""
M1 weight-engine prototype + signature chart render.

Validate the trend estimator and ideal-loss curve numerically (single-draw
checks + a Monte-Carlo unbiasedness check), then render the hero bodyweight
view so the *product* can be judged before any Swift/Xcode/App-Store
commitment. The validated math ports to BodybuildingCore afterward (Swift stays
the source of truth; tests match these numbers).

Estimator: local-linear-trend Kalman filter (state = [level_kg, slope_kg/day])
with an RTS smoother for the displayed trend + confidence band.

Ideal curve: non-linear decelerating approach to goal. Rate target ~0.7 %BW/wk
for a natural athlete — within the 0.5-1.0 %/wk band that preserves lean mass:
  - Helms, Aragon & Fitschen (2014), J Int Soc Sports Nutr 11:20.
  - Garthe et al. (2011), Int J Sport Nutr Exerc Metab 21(2):97-104.
(Exact parameters to be confirmed by the hypertrophy-scientist before "done".)
"""
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch

# ---- scenario: natural athlete, week ~11 of a 17-week cut ---------------
START_KG, GOAL_KG = 90.0, 80.0
PREP_DAYS = 119          # target date (17 weeks)
TODAY = 80              # days of weigh-ins logged so far (~week 11)
BUFFER_KG = 1.0         # "arrive-early" target: aim 1 kg under goal by date
R = 0.80 ** 2           # daily weigh-in measurement variance (kg^2)
q = 2.5e-4             # slope diffusion (kg/day per day) — smoothness knob
H = np.array([[1.0, 0.0]])

def latent_base(t):     # underlying fat-loss trajectory
    asym = GOAL_KG - 0.3
    k = -np.log((GOAL_KG - asym) / (START_KG - asym)) / (PREP_DAYS * 1.1)
    return asym + (START_KG - asym) * np.exp(-k * t)

def latent_weight(t):   # + water-retention plateau (~wk 6) then "whoosh"
    return latent_base(t) + 0.9 * np.exp(-((t - 42) ** 2) / (2 * 9.0 ** 2))

def gen_data(seed):
    rng = np.random.default_rng(seed)
    full = np.arange(PREP_DAYS)
    truth = latent_weight(full)
    w = np.zeros(PREP_DAYS)                    # AR(1) water weight
    for i in range(1, PREP_DAYS):
        w[i] = 0.6 * w[i - 1] + rng.normal(0, 0.55)
    obs_all = truth + w + rng.normal(0, 0.40, PREP_DAYS)
    keep = (rng.random(PREP_DAYS) < 0.75) & (full < TODAY); keep[0] = True
    return full, truth, keep, full[keep], obs_all[keep]

def Fmat(dt): return np.array([[1.0, dt], [0.0, 1.0]])
def Qmat(dt): return q * np.array([[dt**3/3, dt**2/2], [dt**2/2, dt]])

def kalman_smooth(days, obs):
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
    return xf, Pf, xs, Ps

def trailing_rate(days, xs):       # mean smoothed slope over trailing 21 days
    return float(np.mean(xs[days >= days[-1] - 21, 1]))

# ===== MONTE-CARLO VALIDATION (the estimator is unbiased across draws) =====
rmse_l, ratebias_l, ratemae_l, nr_l = [], [], [], []
for seed in range(400):
    full, truth, keep, days, obs = gen_data(seed)
    xf, Pf, xs, Ps = kalman_smooth(days, obs)
    trend = xs[:, 0]
    rmse_l.append(np.sqrt(np.mean((trend - truth[keep]) ** 2)))
    est = trailing_rate(days, xs) * 7
    realized = (truth[days[-1]] - truth[days[-1] - 21]) / 21 * 7
    ratebias_l.append(est - realized); ratemae_l.append(abs(est - realized))
    nr_l.append(np.var(np.diff(obs)) / np.var(np.diff(trend)))
print("=== Monte-Carlo over 400 synthetic cuts ===")
print(f"trend RMSE vs latent weight   : {np.mean(rmse_l):.3f} kg   (target < 0.30)")
print(f"trailing-rate bias            : {np.mean(ratebias_l):+.3f} kg/wk  (target ~0, unbiased)")
print(f"trailing-rate mean abs error  : {np.mean(ratemae_l):.3f} kg/wk")
print(f"noise rejection (raw/trend)   : {np.mean(nr_l):.0f}x   (target > 4x)")

# ===== SINGLE DRAW FOR THE CHART ==========================================
full, truth, keep, days, obs = gen_data(7)
xf, Pf, xs, Ps = kalman_smooth(days, obs)
trend = xs[:, 0]; trend_sd = np.sqrt(Ps[:, 0, 0])
slope_robust = trailing_rate(days, xs)

# ideal non-linear curve (decelerating; hits goal at the date)
asym = GOAL_KG - BUFFER_KG
k_id = -np.log((GOAL_KG - asym) / (START_KG - asym)) / PREP_DAYS
ideal = asym + (START_KG - asym) * np.exp(-k_id * full)
ideal_slope_now = -(START_KG - asym) * k_id * np.exp(-k_id * days[-1])

# projection: propagate last state forward to ~goal date, widening band
xh = np.array([xf[-1, 0], slope_robust]); Ph = Pf[-1].copy()
pdays, plvl, psd = [days[-1]], [xh[0]], [np.sqrt(Ph[0, 0])]; goal_eta = None
for d in range(1, PREP_DAYS - TODAY + 14):
    xh = Fmat(1.0) @ xh; Ph = Fmat(1.0) @ Ph @ Fmat(1.0).T + Qmat(1.0)
    pdays.append(days[-1] + d); plvl.append(xh[0]); psd.append(np.sqrt(Ph[0, 0]))
    if goal_eta is None and xh[0] <= GOAL_KG: goal_eta = days[-1] + d
pdays, plvl, psd = map(np.array, (pdays, plvl, psd))

rate_wk = slope_robust * 7
rate_pct = rate_wk / trend[-1] * 100
diff = rate_wk - ideal_slope_now * 7
status, scol = ("On track", "#2E7D5B")
if diff < -0.12:  status, scol = ("Slightly fast", "#B4690E")
elif diff > 0.12: status, scol = ("Behind pace", "#B4690E")
print(f"\nthis draw: trend {trend[-1]:.1f} kg, rate {rate_wk:+.2f} kg/wk "
      f"({rate_pct:+.2f}%/wk), ideal {ideal_slope_now*7:+.2f} kg/wk, "
      f"goal ~day {goal_eta} (target {PREP_DAYS}) -> {status}")

# ---- render -------------------------------------------------------------
INK="#1F2933"; SUB="#6B7280"; TREND="#0E7C7B"; IDEAL="#C08552"
DOT="#9AA5B1"; GOALC="#A8B0BA"
plt.rcParams.update({"font.family": "DejaVu Sans"})
fig, ax = plt.subplots(figsize=(11, 6.4), dpi=150)
fig.subplots_adjust(top=0.84, left=0.07, right=0.97, bottom=0.10)
fig.patch.set_facecolor("#FBFAF7"); ax.set_facecolor("#FBFAF7")

ax.plot(full, ideal, ls=(0,(5,4)), lw=1.8, color=IDEAL, alpha=0.9, label="Ideal target", zorder=3)
ax.scatter(days, obs, s=16, color=DOT, alpha=0.45, edgecolors="none", label="Daily weigh-ins", zorder=2)
ax.fill_between(days, trend-1.96*trend_sd, trend+1.96*trend_sd, color=TREND, alpha=0.13, lw=0, zorder=3)
ax.plot(days, trend, lw=3.0, color=TREND, label="Trend (95% band)", zorder=5, solid_capstyle="round")
ax.fill_between(pdays, plvl-1.96*psd, plvl+1.96*psd, color=TREND, alpha=0.07, lw=0, zorder=2)
ax.plot(pdays, plvl, lw=2.2, color=TREND, ls=(0,(1,1.4)), alpha=0.85, label="Projection", zorder=4)
ax.axhline(GOAL_KG, color=GOALC, lw=1.2, ls=(0,(2,3)), zorder=1)
ax.text(PREP_DAYS+2, GOAL_KG+0.18, f"goal {GOAL_KG:.0f} kg", va="bottom", ha="right", color=SUB, fontsize=9)
ax.axvline(PREP_DAYS, color=GOALC, lw=1.0, ls=":", zorder=1)
ax.text(PREP_DAYS-1.5, GOAL_KG-1.35, "target date", color=SUB, fontsize=8.5, ha="right")
if goal_eta:
    ax.scatter([goal_eta],[GOAL_KG], s=46, color=TREND, zorder=6, edgecolors="white", linewidths=1.4)

# "today" marker on the trend
ax.scatter([days[-1]],[trend[-1]], s=42, color=TREND, zorder=7, edgecolors="white", linewidths=1.4)
ax.text(days[-1]-2, trend[-1]+1.55, f"{trend[-1]:.1f} kg", color=INK, fontsize=13, fontweight="bold", ha="right")
ax.text(days[-1]-2, trend[-1]+0.9, f"{rate_wk:+.2f} kg/wk · {rate_pct:+.2f}%/wk", color=SUB, fontsize=9, ha="right")

# status pill (upper-left, clear of data)
pill = FancyBboxPatch((4, 81.0), 30, 1.5, boxstyle="round,pad=0.1,rounding_size=0.7",
        linewidth=0, facecolor=scol, alpha=0.12, zorder=4, transform=ax.transData)
ax.add_patch(pill)
ax.text(19, 82.05, f"● {status}", color=scol, fontsize=10.5, fontweight="bold", ha="center", va="center", zorder=5)
if goal_eta:
    ax.text(19, 81.35, f"projected goal in ~{(goal_eta-days[-1])/7:.0f} wk", color=SUB, fontsize=8.5, ha="center")

ax.set_xlim(-2, PREP_DAYS+16); ax.set_ylim(GOAL_KG-1.6, START_KG+2.4)
ax.set_xlabel("Day", color=SUB, fontsize=10); ax.set_ylabel("Weight (kg)", color=SUB, fontsize=10)
ax.tick_params(colors=SUB, labelsize=9)
for s in ("top","right"): ax.spines[s].set_visible(False)
for s in ("left","bottom"): ax.spines[s].set_color("#D7D3CA")
ax.grid(axis="y", color="#ECE8DF", lw=0.9); ax.set_axisbelow(True)
fig.text(0.07, 0.93, "Bodyweight trend", color=INK, fontsize=17, fontweight="bold", ha="left")
fig.text(0.07, 0.885, "trend extracted from noisy daily weigh-ins · honest uncertainty · ideal vs actual",
         color=SUB, fontsize=10, ha="left")
ax.legend(loc="upper right", frameon=False, fontsize=9, labelcolor=INK, ncol=2,
          columnspacing=1.4, bbox_to_anchor=(1.0, 1.02))
plt.savefig("/tmp/bw_trend.png", facecolor=fig.get_facecolor(), bbox_inches="tight")
print("saved /tmp/bw_trend.png")
