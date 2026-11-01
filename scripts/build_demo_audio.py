"""Build the ASPIRE audio demo from two synthesized voice tracks.

Faithful to the production mixer (pipeline.py, July 2026 configuration):
  * presenter audio passes through untouched until a slide changes;
  * the description becomes ready ~5 s after the slide change
    (3.0 s stability window + vision call + local TTS);
  * it is inserted at the next natural pause (>= 0.30 s of silence),
    or after a 2.5 s maximum hold;
  * while the description plays the presenter's speech is held back, then the
    held speech is returned faster than real time by pitch-preserving
    overlap-add compression: 2 buffered 20 ms frames -> 1 cross-faded frame,
    rate 1.0x at <= 0.5 s backlog ramping to 1.5x at 5.5 s backlog;
  * once the backlog is drained the listener is level with live again.
Outputs WAVs plus a timing JSON used by the website's lag meter.
"""
import json, sys
import numpy as np, soundfile as sf

SR = 48000
FRAME = int(0.020 * SR)              # 20 ms mixer frame
SLIDE_CHANGE_S = 0.0                 # slide changes as the talk starts
DESC_READY_S = 5.0                   # slide->speech ready (stability 3 s + Haiku + TTS)
PAUSE_TRIGGER_S = 0.30
HOLD_MAX_S = 2.5
CATCHUP_TARGET_MS, CATCHUP_RAMP_MS, CATCHUP_MAX_RATE = 500, 5500, 1.50

def load(path):
    d, sr = sf.read(path, dtype='float32')
    if d.ndim > 1: d = d.mean(axis=1)
    if sr != SR:
        x = np.linspace(0, len(d) - 1, int(len(d) * SR / sr))
        d = np.interp(x, np.arange(len(d)), d).astype(np.float32)
    return d

pres = load('presenter.aiff'); desc = load('description.aiff')
pres *= 0.9 / max(1e-6, np.abs(pres).max()); desc *= 0.9 / max(1e-6, np.abs(desc).max())
# small lead-in/out silence for the description so it never clips the speaker
desc = np.concatenate([np.zeros(int(0.15*SR), np.float32), desc, np.zeros(int(0.25*SR), np.float32)])

def frames(x):
    n = len(x) // FRAME
    return x[:n*FRAME].reshape(n, FRAME)

pf = frames(pres)
rms = np.sqrt((pf**2).mean(axis=1)); silent = rms < 0.01

# find insertion frame: first run of >= PAUSE_TRIGGER_S silence after DESC_READY_S, else hold max
need = int(PAUSE_TRIGGER_S / 0.020); start = int(DESC_READY_S / 0.020); limit = start + int(HOLD_MAX_S / 0.020)
ins = None; run = 0
for i in range(start, min(limit, len(pf))):
    run = run + 1 if silent[i] else 0
    if run >= need: ins = i - need + 1 + need//2; break   # insert in the middle of the pause
if ins is None: ins = min(limit, len(pf)-1)

def rate_for(backlog_ms):
    if backlog_ms <= CATCHUP_TARGET_MS: return 1.0
    if backlog_ms >= CATCHUP_RAMP_MS: return CATCHUP_MAX_RATE
    f = (backlog_ms - CATCHUP_TARGET_MS) / (CATCHUP_RAMP_MS - CATCHUP_TARGET_MS)
    return 1.0 + f * (CATCHUP_MAX_RATE - 1.0)

ramp = np.linspace(0, 1, FRAME, dtype=np.float32)
def crossfade(a, b): return a * (1 - ramp) + b * ramp

out = []; lag = []   # lag: (listener_time_s, seconds_behind_live, phase)
# phase 1: pass-through until insertion
for i in range(ins):
    out.append(pf[i]); lag.append((len(out)*0.020, 0.0, 'live'))
# phase 2: description plays; presenter frames queue up
df = frames(desc)
held = ins
for k, fr in enumerate(df):
    out.append(fr); held_count = k + 1
    lag.append((len(out)*0.020, held_count*0.020, 'describing'))
backlog = len(df)                      # frames of presenter speech now behind live
# phase 3: catch-up with overlap-add compression. Each wall-clock tick the live
# source advances one frame; we emit one frame; at rate r we consume r frames.
i = ins; acc = 0.0
while i < len(pf):
    r = rate_for(backlog * 20)
    if r > 1.0:
        acc += (r - 1.0)
        if acc >= 1.0 and i + 1 < len(pf):
            out.append(crossfade(pf[i], pf[i+1])); i += 2; acc -= 1.0; backlog = max(0, backlog - 1)
        else:
            out.append(pf[i]); i += 1
    else:
        out.append(pf[i]); i += 1
    lag.append((len(out)*0.020, backlog*0.020, 'catching-up' if backlog*20 > CATCHUP_TARGET_MS else 'live'))

mixed = np.concatenate(out)
sf.write('with-aspire.wav', mixed, SR, subtype='PCM_16')
sf.write('without-aspire.wav', pres, SR, subtype='PCM_16')
sf.write('description-only.wav', desc, SR, subtype='PCM_16')
# downsample lag curve to 10 Hz for the web
curve = [[round(t,2), round(b,2), p] for (t,b,p) in lag[::5]]
timing = dict(sample_rate=SR, slide_change_s=SLIDE_CHANGE_S, description_ready_s=DESC_READY_S,
              inserted_at_s=round(ins*0.020,2), description_len_s=round(len(df)*0.020,2),
              original_len_s=round(len(pres)/SR,2), output_len_s=round(len(mixed)/SR,2),
              max_behind_live_s=round(max(b for _,b,_ in lag),2),
              level_again_at_s=next((round(t,2) for (t,b,p) in lag[ins+len(df):] if b*1000 <= CATCHUP_TARGET_MS), None),
              reclaimed_s=round(len(pres)/SR + len(df)*0.020 - len(mixed)/SR, 2), curve=curve)
json.dump(timing, open('timing.json','w'))
print({k:v for k,v in timing.items() if k!='curve'})
