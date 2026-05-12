/* global React, ReactDOM, useTweaks, TweaksPanel, TweakSection, TweakRadio, TweakColor, TweakToggle */
const { useState, useEffect, useRef, useMemo, useCallback, useLayoutEffect } = React;
const D = window.SITE_DATA;

const cls = (...a) => a.filter(Boolean).join(" ");

/* ─────────────────────────────────────────────────────────── data: stack */

const STACK = [
  { cat: "languages",  items: ["Python", "C/C++", "MATLAB", "Java", "JavaScript", "Bash"] },
  { cat: "ml / rl",    items: ["PyTorch", "TensorFlow", "JAX", "Stable-Baselines3", "Ray RLlib", "Gymnasium"] },
  { cat: "systems",    items: ["Linux", "Docker", "Kubernetes", "Slurm", "Git", "CUDA"] },
  { cat: "networks",   items: ["NS-3", "OMNeT++", "SUMO", "Veins", "Mininet"] },
  { cat: "energy",     items: ["OpenDSS", "GridLAB-D", "PowerWorld", "MATPOWER", "Pandapower"] },
  { cat: "writing",    items: ["LaTeX", "Tikz", "Pandoc", "Pyplot", "Plotly"] },
];

const NOW = [
  { k: "current",   v: "Decentralised grid architectures @ QUT" },
  { k: "reading",   v: "Sutton & Barto, 2nd ed. ch. 13" },
  { k: "compiling", v: "distributed coordination architectures" },
  { k: "listening", v: "the hum of a Tesla A100 at 78°C" },
];

/* ─────────────────────────────────────────────────────────────── helpers */

function useIntersect(ref, opts = { threshold: 0.12, rootMargin: "-40px 0px" }) {
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (!ref.current || seen) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setSeen(true); io.disconnect(); }
    }, opts);
    io.observe(ref.current);
    return () => io.disconnect();
  }, [ref, seen]);
  return seen;
}

function useClock(tz) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  return now.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: tz });
}

function useCount(target, dur, run) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!run) return;
    let raf, start;
    const step = (t) => {
      if (!start) start = t;
      const p = Math.min(1, (t - start) / dur);
      setV(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step); return () => cancelAnimationFrame(raf);
  }, [target, dur, run]);
  return v;
}

function useTypewriter(lines, speed = 22, startDelay = 200) {
  const [out, setOut] = useState(() => lines.map(() => ""));
  const [done, setDone] = useState(false);
  useEffect(() => {
    let i = 0, j = 0, timer;
    const tick = () => {
      if (i >= lines.length) { setDone(true); return; }
      const line = lines[i];
      if (j <= line.length) {
        setOut(prev => { const c = [...prev]; c[i] = line.slice(0, j); return c; });
        j++;
        timer = setTimeout(tick, speed);
      } else {
        i++; j = 0;
        timer = setTimeout(tick, 140);
      }
    };
    timer = setTimeout(tick, startDelay);
    return () => clearTimeout(timer);
  }, []);
  return { out, done };
}

/* ───────────────────────────────────────────────────── network canvas */

function NetworkCanvas({ accent }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let w, h, dpr = Math.min(2, window.devicePixelRatio || 1);
    let nodes = [], raf, mouse = { x: -1e3, y: -1e3 };

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      w = r.width; h = r.height;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.max(28, Math.floor((w * h) / 22000));
      nodes = Array.from({ length: count }).map(() => ({
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - .5) * .25, vy: (Math.random() - .5) * .25,
        r: 1 + Math.random() * 1.6,
        phase: Math.random() * Math.PI * 2,
      }));
    };

    const onMove = (e) => {
      const r = canvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
    };
    const onLeave = () => { mouse.x = -1e3; mouse.y = -1e3; };

    const tick = (t) => {
      ctx.clearRect(0, 0, w, h);

      // edges
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < 140 * 140) {
            const op = (1 - d2 / (140 * 140)) * .35;
            ctx.strokeStyle = `rgba(160,170,180,${op * .6})`;
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
      }

      // nodes
      for (const n of nodes) {
        n.x += n.vx; n.y += n.vy;
        if (n.x < 0 || n.x > w) n.vx *= -1;
        if (n.y < 0 || n.y > h) n.vy *= -1;
        const mdx = n.x - mouse.x, mdy = n.y - mouse.y;
        const md = Math.sqrt(mdx * mdx + mdy * mdy);
        const close = md < 120;
        const pulse = .5 + .5 * Math.sin(t * .002 + n.phase);
        ctx.fillStyle = close ? accent : `rgba(220,225,235,${.35 + pulse * .25})`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r + (close ? 1.5 : 0), 0, Math.PI * 2);
        ctx.fill();
        if (close) {
          ctx.strokeStyle = accent;
          ctx.globalAlpha = (1 - md / 120) * .7;
          ctx.beginPath(); ctx.moveTo(mouse.x, mouse.y); ctx.lineTo(n.x, n.y); ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }
      raf = requestAnimationFrame(tick);
    };

    resize();
    raf = requestAnimationFrame(tick);
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseout", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseout", onLeave);
    };
  }, [accent]);
  return <canvas ref={ref} className="net" />;
}

/* ───────────────────────────────────────────────────────── boot sequence */

function Boot({ onDone }) {
  const lines = useMemo(() => ([
    "$ ssh komeil@qut.edu.au",
    "→ negotiating handshake … ok",
    "→ loading research/grid-architecture.tex",
    "→ booting komeilmoghaddasi.io v2.0",
    "✓ ready.",
  ]), []);
  const { out, done } = useTypewriter(lines, 14, 120);
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(onDone, 380);
    return () => clearTimeout(t);
  }, [done]);
  return (
    <div className="boot">
      <div className="boot__panel">
        <div className="boot__head mono">
          <span><span className="dot dot--r" /><span className="dot dot--a" /><span className="dot dot--g" /></span>
          <span>komeil@brisbane · zsh</span>
          <span>{new Date().toISOString().slice(0,19).replace("T"," ")}</span>
        </div>
        <div className="boot__body mono">
          {out.map((l, i) => (
            <div key={i} className="boot__line">
              {l}
              {i === out.length - 1 && !done && <span className="caret">▍</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────── topbar */

function TopBar({ onNav, accent }) {
  const time = useClock(D.tz);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const f = () => setScrolled(window.scrollY > 12);
    f(); window.addEventListener("scroll", f, { passive: true });
    return () => window.removeEventListener("scroll", f);
  }, []);
  return (
    <header className={cls("topbar", scrolled && "topbar--scrolled")}>
      <div className="topbar__inner">
        <a href="#top" className="brand mono" onClick={(e) => { e.preventDefault(); onNav("top"); }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2.4">
            <path d="M3 12 L9 12 L12 4 L15 20 L18 12 L21 12" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span><b>komeil.</b><span className="brand__suf">moghaddasi</span></span>
        </a>
        <nav className="topbar__nav mono">
          {[
            ["work", "~/research"], ["stack", "~/stack"],
            ["papers", "~/papers"], ["bg", "~/background"], ["contact", "~/contact"],
          ].map(([id, label]) => (
            <a key={id} href={`#${id}`} onClick={(e) => { e.preventDefault(); onNav(id); }}>
              <span className="op">/</span>{label.slice(2)}
            </a>
          ))}
        </nav>
        <div className="topbar__right mono">
          <span className="pill"><span className="pulse" /> available</span>
          <span className="clk">BNE&nbsp;<b>{time}</b></span>
          <a className="cv" href={D.cv} target="_blank" rel="noreferrer">cv.pdf ↗</a>
        </div>
      </div>
      <ScrollProgress />
    </header>
  );
}

function ScrollProgress() {
  const ref = useRef(null);
  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement;
      const p = h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight);
      if (ref.current) ref.current.style.transform = `scaleX(${p})`;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return <div className="prog"><span ref={ref} /></div>;
}

/* ──────────────────────────────────────────────────────────────── hero */

function Hero({ accent }) {
  return (
    <section id="top" className="hero">
      <div className="hero__net"><NetworkCanvas accent={accent} /></div>
      <div className="hero__grid">
        <div className="hero__tag mono">
          <span className="tag__dot" />
          phd student · queensland university of technology · brisbane, au
        </div>

        <h1 className="hero__title">
          <span className="t__row">
            <span className="t__w">Komeil</span>
          </span>
          <span className="t__row">
            <span className="t__w t__w--em">Moghaddasi.</span>
          </span>
        </h1>

        <div className="hero__sub mono">
          <span>phd student · computer science · qut</span>
          <span className="hero__sub-sep">/</span>
          <span>distributed energy + ai</span>
        </div>

        <p className="hero__lead">
          I'm working on <em>decentralised grid architecture</em> in the
          <em> School of Computer Science at QUT</em>, in cooperation with
          <em> Energy Queensland</em>.
        </p>

        <div className="hero__cta">
          <a href="#papers" className="btn btn--p">
            <span>read the work</span>
            <span className="btn__arrow">↘</span>
          </a>
          <a href="#contact" className="btn btn--g">
            <span>get in touch</span>
          </a>
          <span className="cta__line mono">
            <span className="op">$</span> tail -f komeil/now.log
          </span>
        </div>

        <div className="hero__now mono">
          {NOW.map((n, i) => (
            <div key={i} className="now__row" style={{ animationDelay: `${.6 + i * .08}s` }}>
              <span className="now__k">{n.k.padEnd(10, " ")}</span>
              <span className="now__v">{n.v}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────── focus / research */

const FOCUS = [
  {
    id: "grid",
    label: "decentralised grid",
    title: "Resilient power networks that organise themselves.",
    body: "Co-design of communication topology and control policy for distribution networks with high renewable penetration. The grid is becoming a multi-agent system — I treat it like one.",
    code: [
      "class GridAgent(Policy):",
      "  def act(self, state, neighbours):",
      "    msg = self.consensus(neighbours)",
      "    return self.actor(state, msg)",
    ],
  },
  {
    id: "edge",
    label: "edge / vehicular",
    title: "Task offloading that actually saves energy.",
    body: "Federated SAC, A3C, and double-DQN schedulers for IoV / IoT-MEC. Real bandwidth, real channel models — published across Q1 venues at Elsevier and IEEE.",
    code: [
      "obs = (cpu, batt, rssi, queue)",
      "act = SAC(obs)                # ∈ {local, edge, cloud}",
      "r   = -λ_t·t - λ_e·e_joules",
    ],
  },
  {
    id: "rl",
    label: "reinforcement learning",
    title: "Multi-objective, multi-agent, energy-aware.",
    body: "I care about reward functions that don't lie. Pareto fronts, constrained MDPs, and reward shaping that respects physical limits — battery, voltage, latency.",
    code: [
      "J(π) = E[ Σ γᵗ ( r_lat + r_eng + r_qos ) ]",
      "  s.t.   V_min ≤ V_t ≤ V_max",
      "         SoC_t ∈ [0.2, 0.9]",
    ],
  },
];

function Research() {
  const ref = useRef(null);
  const seen = useIntersect(ref);
  return (
    <section id="work" ref={ref} className={cls("section focus", seen && "is-in")}>
      <SecHead idx="01" title="Research focus" caption="three threads, one thesis" />
      <div className="focus__grid">
        {FOCUS.map((f, i) => (
          <article key={f.id} className="fcard" style={{ "--i": i }}>
            <div className="fcard__head">
              <span className="fcard__no mono">0{i + 1}</span>
              <span className="fcard__lab mono">{f.label}</span>
            </div>
            <h3 className="fcard__title">{f.title}</h3>
            <p className="fcard__body">{f.body}</p>
            <pre className="fcard__code mono"><code>{f.code.join("\n")}</code></pre>
          </article>
        ))}
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────── stack */

function Stack() {
  const ref = useRef(null);
  const seen = useIntersect(ref);
  return (
    <section id="stack" ref={ref} className={cls("section stack", seen && "is-in")}>
      <SecHead idx="02" title="Stack" caption="what I reach for" />
      <div className="stack__grid">
        {STACK.map((g, gi) => (
          <div key={g.cat} className="srow" style={{ "--gi": gi }}>
            <div className="srow__k mono">{g.cat}</div>
            <div className="srow__chips">
              {g.items.map((it, i) => (
                <span key={it} className="schip" style={{ "--i": i + gi * 4 }}>{it}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ───────────────────────────────────────────────────── publications */

function Publications() {
  const ref = useRef(null);
  const seen = useIntersect(ref);

  const years = useMemo(() => ["all", ...Array.from(new Set(D.publications.map(p => p.year))).sort((a, b) => b - a)], []);

  const [topic, setTopic] = useState("all");
  const [year, setYear] = useState("all");
  const [first, setFirst] = useState(false);
  const [open, setOpen] = useState(null);

  const filtered = useMemo(() => D.publications.filter(p => {
    if (topic !== "all") { if (topic === "survey" ? p.type !== "survey" : p.topic !== topic) return false; }
    if (year !== "all" && p.year !== year) return false;
    if (first && !p.first) return false;
    return true;
  }), [topic, year, first]);

  return (
    <section id="papers" ref={ref} className={cls("section pubs", seen && "is-in")}>
      <SecHead idx="03" title="Papers" caption={`${D.publications.length} peer-reviewed · 2022 — 2026`} />

      <div className="pubs__controls mono">
        <div className="filt">
          <span className="filt__k">filter --topic</span>
          {D.topics.map(t => (
            <button key={t.id} className={cls("chip", topic === t.id && "chip--on")} onClick={() => setTopic(t.id)}>{t.label}</button>
          ))}
        </div>
        <div className="filt">
          <span className="filt__k">--year</span>
          {years.map(y => (
            <button key={y} className={cls("chip", year === y && "chip--on")} onClick={() => setYear(y)}>{y}</button>
          ))}
        </div>
        <div className="filt">
          <button className={cls("chip", first && "chip--on")} onClick={() => setFirst(!first)}>
            {first ? "✓ " : ""}--first-author
          </button>
        </div>
        <div className="filt filt__count">
          <span>{filtered.length}/{D.publications.length} matches</span>
        </div>
      </div>

      <ol className="pubs__list">
        {filtered.map((p, i) => (
          <PubRow key={p.title} p={p} i={i} open={open === p.title} onToggle={() => setOpen(open === p.title ? null : p.title)} />
        ))}
        {filtered.length === 0 && <li className="pubs__empty mono">// no matches</li>}
      </ol>
    </section>
  );
}

function PubRow({ p, i, open, onToggle }) {
  const me = "Moghaddasi, K.";
  return (
    <li className={cls("pub", open && "pub--open", p.first && "pub--first")} style={{ "--i": i }}>
      <button className="pub__head" onClick={onToggle}>
        <span className="pub__year mono">{p.year}</span>
        <span className="pub__title">{p.title}</span>
        <span className="pub__venue mono">{p.venue}</span>
        <span className={cls("pub__tier mono", `pub__tier--${p.tier.toLowerCase()}`)}>{p.tier}</span>
        <span className="pub__plus" aria-hidden>{open ? "−" : "+"}</span>
      </button>
      <div className="pub__body">
        <div className="pub__inner">
          <div className="pub__authors mono">
            {p.authors.map((a, j) => (
              <span key={j} className={cls(a === me && "pub__authors-me")}>{a}{j < p.authors.length - 1 && ", "}</span>
            ))}
          </div>
          <div className="pub__meta mono">
            <span><span className="meta__k">publisher</span><span>{p.publisher}</span></span>
            {p.impact != null && <span><span className="meta__k">impact factor</span><span>{p.impact.toFixed(1)}</span></span>}
            <span><span className="meta__k">tier</span><span>{p.tier}</span></span>
            <span><span className="meta__k">role</span><span>{p.first ? "first author" : "co-author"}</span></span>
            <span><span className="meta__k">kind</span><span>{p.type}</span></span>
          </div>
          <a className="pub__link mono" href={p.href} target="_blank" rel="noreferrer">
            open at {new URL(p.href).hostname.replace("www.", "")} ↗
          </a>
        </div>
      </div>
    </li>
  );
}

/* ──────────────────────────────────────────────────────── education */

function Education() {
  const ref = useRef(null);
  const seen = useIntersect(ref);
  return (
    <section id="bg" ref={ref} className={cls("section edu", seen && "is-in")}>
      <SecHead idx="04" title="Background" caption="git log --reverse" />
      <ol className="edu__list">
        {D.education.map((e, i) => (
          <li key={i} className="edu__row" style={{ "--i": i }}>
            <div className="edu__when mono">{e.start}<span className="edu__dash">·</span>{e.end}</div>
            <div className="edu__bullet" />
            <div className="edu__what">
              <div className="edu__deg">{e.degree}</div>
              <div className="edu__org mono">{e.org} · {e.where}</div>
              {e.note && <div className="edu__note">{e.note}</div>}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────── contact */

function Contact() {
  const ref = useRef(null);
  const seen = useIntersect(ref);
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(D.email);
    setCopied(true); setTimeout(() => setCopied(false), 1400);
  };
  return (
    <section id="contact" ref={ref} className={cls("section contact", seen && "is-in")}>
      <SecHead idx="05" title="Contact" caption="async, but i answer" />
      <div className="contact__inner">
        <div className="contact__termhead mono">
          <span><span className="dot dot--r" /><span className="dot dot--a" /><span className="dot dot--g" /></span>
          <span>~/contact</span>
        </div>
        <div className="contact__body mono">
          <p><span className="op">$</span> echo "let's build resilient systems together."</p>
          <p className="contact__line">
            <span className="op">$</span> mail
            <button onClick={copy} className="contact__email">{D.email}</button>
            <span className={cls("contact__copied", copied && "is-on")}>↳ copied</span>
          </p>
          <p>
            <span className="op">$</span> ls profiles/
          </p>
          <p className="contact__socials">
            {D.socials.map(s => (
              <a key={s.label} href={s.href} target="_blank" rel="noreferrer">{s.label.toLowerCase()}/</a>
            ))}
          </p>
          <p><span className="op">$</span> <span className="caret">▍</span></p>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────────────────────────────────── section head */

function SecHead({ idx, title, caption }) {
  return (
    <header className="sec__h">
      <span className="sec__idx mono">§ {idx}</span>
      <span className="sec__line" />
      <h2 className="sec__t">{title}</h2>
      <span className="sec__cap mono">{caption}</span>
    </header>
  );
}

/* ───────────────────────────────────────────────────────── footer */

function FooterBar() {
  return (
    <footer className="foot mono">
      <div className="foot__row">
        <span><span className="op">©</span> {new Date().getFullYear()} komeil moghaddasi</span>
        <span>built with react · canvas · 17 lines of love</span>
        <span>commit · <b>{Math.random().toString(16).slice(2, 9)}</b></span>
      </div>
    </footer>
  );
}

/* ───────────────────────────────────────────────────────────── app */

const ACCENTS = {
  lime:   "#c6f432",
  cyan:   "#22d3ee",
  amber:  "#fbbf24",
  magenta:"#f472b6",
};

const DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "dark",
  "accent": "lime",
  "boot": true
}/*EDITMODE-END*/;

function App() {
  const [t, setTweak] = useTweaks(DEFAULTS);
  const [booting, setBooting] = useState(() => t.boot !== false);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = t.theme;
    const accent = ACCENTS[t.accent] || ACCENTS.lime;
    root.style.setProperty("--accent", accent);
    root.style.setProperty("--accent-soft", accent + "22");
  }, [t.theme, t.accent]);

  const onNav = useCallback((id) => {
    const el = id === "top" ? document.body : document.getElementById(id);
    if (!el) return;
    if (id === "top") window.scrollTo({ top: 0, behavior: "smooth" });
    else window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 70, behavior: "smooth" });
  }, []);

  const accentHex = ACCENTS[t.accent] || ACCENTS.lime;

  return (
    <>
      {booting && <Boot onDone={() => setBooting(false)} />}
      <TopBar onNav={onNav} accent={accentHex} />
      <main>
        <Hero accent={accentHex} />
        <Research />
        <Stack />
        <Publications />
        <Education />
        <Contact />
      </main>
      <FooterBar />

      <TweaksPanel>
        <TweakSection label="Theme">
          <TweakRadio label="Mode" value={t.theme} options={["dark", "light"]} onChange={(v) => setTweak("theme", v)} />
        </TweakSection>
        <TweakSection label="Accent">
          <TweakColor
            label="Color"
            value={ACCENTS[t.accent] || ACCENTS.lime}
            options={[ACCENTS.lime, ACCENTS.cyan, ACCENTS.amber, ACCENTS.magenta]}
            onChange={(v) => {
              const key = Object.keys(ACCENTS).find(k => ACCENTS[k] === v) || "lime";
              setTweak("accent", key);
            }}
          />
        </TweakSection>
        <TweakSection label="Intro">
          <TweakToggle label="Boot sequence" value={t.boot !== false} onChange={(v) => setTweak("boot", v)} />
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
