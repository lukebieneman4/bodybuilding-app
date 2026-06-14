"""
Generate golden reference values for the TypeScript estimator port.

This freezes a fixed input series and the validated Python estimator's outputs
into web/src/lib/core/__fixtures__/golden.json. The vitest parity test recomputes
those outputs in TypeScript and must match — so the TS port is verified against
the same math proven by the Monte-Carlo check in bw_trend_prototype.py.

Run: python3 prototypes/gen_golden.py
"""
import json, os
import numpy as np

# ---- estimator params (MUST match estimator.ts) -------------------------
R = 0.80 ** 2
Q = 2.5e-4
Q_PROJ = Q * 0.15

# ---- fixed deterministic input (seeded once, then frozen into JSON) ------
def latent(t):
    asym = 80.0 - 0.3
    k = -np.log((80.0 - asym) / (90.0 - asym)) / (119 * 1.1)
    return asym + (90.0 - asym) * np.exp(-k * t) + 0.9 * np.exp(-((t - 42) ** 2) / (2 * 9.0 ** 2))

rng = np.random.default_rng(20260614)
N = 60
full = np.arange(N)
truth = latent(full)
w = np.zeros(N)
for i in range(1, N):
    w[i] = 0.6 * w[i - 1] + rng.normal(0, 0.55)
obs_all = truth + w + rng.normal(0, 0.40, N)
keep = (rng.random(N) < 0.78); keep[0] = True
days = full[keep].astype(float)
obs = obs_all[keep]

# ---- local-linear-trend Kalman filter + RTS smoother --------------------
H = np.array([[1.0, 0.0]])
def Fmat(dt): return np.array([[1.0, dt], [0.0, 1.0]])
def Qmat(dt, q): return q * np.array([[dt**3/3, dt**2/2], [dt**2/2, dt]])

n = len(obs)
x = np.array([obs[0], 0.0]); P = np.array([[R, 0.0], [0.0, 0.01]])
xf = np.zeros((n, 2)); Pf = np.zeros((n, 2, 2))
xp = np.zeros((n, 2)); Pp = np.zeros((n, 2, 2)); Fs = np.zeros((n, 2, 2))
xf[0], Pf[0], xp[0], Pp[0], Fs[0] = x, P, x, P, np.eye(2)
for i in range(1, n):
    dt = float(days[i] - days[i - 1]); F = Fmat(dt); Fs[i] = F
    x = F @ x; P = F @ P @ F.T + Qmat(dt, Q); xp[i], Pp[i] = x, P
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
trend = xs[:, 0]
trend_sd = np.sqrt(Ps[:, 0, 0])
slope_robust = float(np.mean(xs[days >= days[-1] - 21, 1]))

# ---- projection to goal (gentler process noise) -------------------------
GOAL = 80.0; START = float(obs[0]); PREP = 119
xh = np.array([xf[-1, 0], slope_robust]); Ph = Pf[-1].copy()
goal_eta = None
for dd in range(1, PREP):
    xh = Fmat(1.0) @ xh; Ph = Fmat(1.0) @ Ph @ Fmat(1.0).T + Qmat(1.0, Q_PROJ)
    if goal_eta is None and xh[0] <= GOAL:
        goal_eta = int(days[-1] + dd); break

# ---- ideal non-linear curve ---------------------------------------------
asym = GOAL - 0.5
k_id = -np.log((GOAL - asym) / (START - asym)) / PREP
ideal = (asym + (START - asym) * np.exp(-k_id * np.arange(PREP + 1))).tolist()

out = {
    "params": {"R": R, "q": Q, "qProj": Q_PROJ},
    "input": {"days": days.tolist(), "obs": obs.tolist()},
    "ideal": {"start": START, "goal": GOAL, "prepDays": PREP, "values": ideal},
    "expected": {
        "trend": trend.tolist(),
        "trendSd": trend_sd.tolist(),
        "slopeFilteredEnd": float(xf[-1, 1]),
        "slopeRobust": slope_robust,
        "Pend": Pf[-1].tolist(),
        "goalEta": goal_eta,
    },
}
dest = os.path.join(os.path.dirname(__file__), "..", "web", "src", "lib", "core", "__fixtures__")
os.makedirs(dest, exist_ok=True)
path = os.path.join(dest, "golden.json")
with open(path, "w") as f:
    json.dump(out, f, indent=1)
print(f"wrote {path}")
print(f"  n={n}  trend[-1]={trend[-1]:.4f}  slopeRobust={slope_robust:.5f}  goalEta={goal_eta}")
