# ASPIRE website

Investor-facing website for **ASPIRE** (Accessible Slide Presentation via Intelligent
Real-time Editing), live at **https://azizulhaque.me/aspire/**.

Plain HTML, CSS and JavaScript. No build step, no framework, no dependencies to
install. Open `site/index.html` in a browser to preview, or run
`python3 -m http.server -d site 8000` and visit http://localhost:8000/.

## Layout

```
site/                 everything that is published
  index.html          the page (one long landing page with anchored sections)
  css/style.css       design tokens + layout; light, dark and high-contrast themes
  js/main.js          theme switcher, mobile nav, mechanism animation, lag meter, charts
  js/demo-timing.js   generated timing data for the audio demo (do not edit by hand)
  audio/              the "with / without ASPIRE" sample clips (AAC .m4a)
  assets/             logo and favicon (SVG)
scripts/
  deploy-local.sh     publish site/ to azizulhaque.me/aspire from your machine
  build_demo_audio.py rebuilds audio/ and js/demo-timing.js from two voice tracks
  demo_presenter.txt  presenter script used for the sample (macOS `say` markup)
  demo_description.txt the slide description spoken in the sample
.github/workflows/deploy.yml  automatic publish on push (needs a one-time secret, see below)
```

## Design

The visual system follows bemyeyes.com: Inter, near-black warm background in dark
mode (`#100C08`) and ghost-white (`#F8F8FF`) in light mode, thin blue outlined cards,
amber pill buttons (`#ED9F10`), small eyebrow labels above large medium-weight
headings, and big measured numbers. All colours live as CSS custom properties at the
top of `css/style.css`; change them there and every component follows.

Chart colours were validated for colour-vision deficiency and contrast on both
surfaces. Every chart also has a table view (the Chart / Table toggle).

## Editing content

Everything is in `site/index.html`, in page order: hero, benefits, impact numbers,
how it works, audio demo, results, research, journey, why now, roadmap, team,
investors, footer. Search for the section comment (for example `<!-- ============ TEAM`).

Things you will probably want to change first:

- **Investor section** (`#investors`): round size, use of funds, and whether to link a
  deck PDF instead of the mailto button.
- **Team photos**: replace the `<div class="avatar">AH</div>` placeholders with
  `<div class="avatar"><img src="assets/azizul.jpg" alt=""></div>` and add the files.
- **Roadmap**: the three phases are a draft; keep what you commit to.
- **Hero visual**: the phone mock-up can be swapped for a real photo of a live session
  (a `<img>` inside `.hero-visual`, ideally 4:5, at least 1000 px wide).

### What is deliberately *not* on the site

The CHI 2027 field-study results (comprehension 27.8% to 94.4%, 12/12 preference,
0.58 s median delay) are **not** published here because the paper is under anonymous
review. The page says only that a live field study was run and is under review. Add
the numbers to `#impact`, `#results` and `#research` once the paper is accepted.

Every published number on the page traces to one of:
- DIS 2026 paper, DOI 10.1145/3800645.3812965 (comprehension 50.0% to 88.9%, n = 12)
- ASSETS 2026 demo, DOI 10.1145/3797867.3841220 (recall 16.7% to 91.7%, n = 4)
- `PERFORMANCE_REPORT.md` in the ASPIRE code repo, July 2026 (latency, dropouts, call counts)

## Deployment

The site is served by GitHub Pages from the `aspire/` folder of the
`meazizul/meazizul.github.io` repository (the repo behind azizulhaque.me). Pages
project paths are case-sensitive and the name `aspire` is already taken by the code
repo `meazizul/ASPIRE`, so the site is copied into the user-site repo instead of
being its own Pages project. Two ways to publish:

**A. From your machine (no setup):**

```bash
./scripts/deploy-local.sh
```

**B. Automatically on every push to `main` (one-time setup):**

```bash
# 1. make a key pair for the Action
ssh-keygen -t ed25519 -N "" -C "aspire-website deploy" -f /tmp/aspire_deploy
# 2. give the PUBLIC half write access to the personal-site repo
gh repo deploy-key add /tmp/aspire_deploy.pub --repo meazizul/meazizul.github.io \
   --title "aspire-website deploy" --allow-write
# 3. store the PRIVATE half as a secret in this repo
gh secret set PAGES_DEPLOY_KEY --repo meazizul/aspire-website < /tmp/aspire_deploy
rm /tmp/aspire_deploy /tmp/aspire_deploy.pub
```

After that, `.github/workflows/deploy.yml` syncs `site/` into
`meazizul.github.io/aspire/` on each push. GitHub Pages caches for about ten
minutes, so changes can take a few minutes to show.

## Rebuilding the audio sample

```bash
python3 -m venv .venv && .venv/bin/pip install numpy soundfile
say -v Daniel  -r 172 -o presenter.aiff   -f scripts/demo_presenter.txt
say -v Samantha -r 215 -o description.aiff -f scripts/demo_description.txt
.venv/bin/python scripts/build_demo_audio.py      # writes *.wav and timing.json
afconvert -f m4af -d aac -b 96000 with-aspire.wav    site/audio/with-aspire.m4a
afconvert -f m4af -d aac -b 96000 without-aspire.wav site/audio/without-aspire.m4a
```

Then wrap `timing.json` as `window.ASPIRE_DEMO_TIMING = {...};` in
`site/js/demo-timing.js`. The mixing script uses the production mixer's rules
(0.3 s pause trigger, 2.5 s max hold, 1.0 to 1.5x pitch-preserving catch-up, 20 ms
frames) so the "behind live" meter and the animation match the audio exactly.
To use the real Kokoro voice instead of macOS `say`, render the two tracks with
`tts_kokoro.py` from the ASPIRE repo and feed the WAVs to the same script.
