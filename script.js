// =========================================================
// Matrix Math — shared behavior across all pages
// =========================================================

document.addEventListener('DOMContentLoaded', () => {
  initNavToggle();
  initScrollReveal();
  initScrollProgress();
  initStatCounters();
  initEyebrowLines();
  initMathAnimation();
});

/* ---------- mobile nav ---------- */
function initNavToggle(){
  const toggle = document.querySelector('.nav-toggle');
  const links = document.querySelector('.nav-links');
  if(!toggle || !links) return;
  toggle.addEventListener('click', () => {
    links.classList.toggle('open');
  });
  // if the window is resized/rotated past the mobile breakpoint
  // while the menu is open, don't leave it stuck open
  window.addEventListener('resize', () => {
    if(window.innerWidth > 760) links.classList.remove('open');
  });
}

/* ---------- scroll reveal (IntersectionObserver) ---------- */
function initScrollReveal(){
  const targets = document.querySelectorAll('.reveal, .reveal-stagger');
  if(!targets.length) return;

  if(!('IntersectionObserver' in window)){
    targets.forEach(t => t.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if(entry.isIntersecting){
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

  targets.forEach(t => observer.observe(t));
}

/* ---------- eyebrow line-draw (all pages) ----------
   The small "// label" line above headings grows a short
   underline the moment it scrolls into view — a small
   scroll-tied animation that sits right next to the text
   instead of only fading the whole block in. */
function initEyebrowLines(){
  const eyebrows = document.querySelectorAll('.eyebrow');
  if(!eyebrows.length) return;

  if(!('IntersectionObserver' in window)){
    eyebrows.forEach(el => el.classList.add('eyebrow-in'));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if(entry.isIntersecting){
        entry.target.classList.add('eyebrow-in');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.6 });

  eyebrows.forEach(el => observer.observe(el));
}

/* ---------- scroll progress bar (all pages) ---------- */
function initScrollProgress(){
  const bar = document.createElement('div');
  bar.className = 'scroll-progress';
  document.body.prepend(bar);

  function update(){
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const pct = docHeight > 0 ? window.scrollY / docHeight : 0;
    bar.style.transform = `scaleX(${Math.min(1, Math.max(0, pct))})`;
  }

  update();
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
}

/* ---------- stat count-up (Home page) ----------
   Numbers count up from 0 to their data-target value the
   moment they scroll into view, instead of just appearing. */
function initStatCounters(){
  const stats = document.querySelectorAll('.stat[data-target]');
  if(!stats.length) return;

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function animateStat(el){
    const target = parseFloat(el.dataset.target);
    const decimals = parseInt(el.dataset.decimals || '0', 10);
    const suffix = el.dataset.suffix || '';
    const duration = 1100;

    if(prefersReduced){
      el.textContent = target.toFixed(decimals) + suffix;
      return;
    }

    const start = performance.now();
    function tick(now){
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out-cubic
      const value = target * eased;
      el.textContent = value.toFixed(decimals) + suffix;
      if(t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  if(!('IntersectionObserver' in window)){
    stats.forEach(animateStat);
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if(entry.isIntersecting){
        animateStat(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.6 });

  stats.forEach(el => observer.observe(el));
}

/* ---------- math animation canvas (Home hero) ----------
   Three kinds of drifting objects instead of generic "code rain":
   1. small matrices — an actual bracketed grid of numbers,
      since that's literally the brand.
   2. short equations/symbols (Pythagorean theorem, integrals,
      trig identities, etc.) drifting slowly upward.
   3. "morph" shapes — a geometric shape draws itself, spins,
      then dissolves into the equation that describes it
      (triangle → a²+b²=c², circle → x²+y²=r², etc.).
   All three fade in, drift, and fade out on a loop.

   This same scene runs on the big hero canvas AND on smaller
   ".ambient-rain" canvases scattered in other sections around
   the site, just with fewer particles and a lower opacity —
   see initMathAnimation() at the bottom, which sets both up. */
function createMathScene(canvas, options){
  if(!canvas) return;

  const ctx = canvas.getContext('2d');
  let width, height, rafId;

  const equations = [
    'a\u00B2+b\u00B2=c\u00B2', '\u222Bf(x)dx', 'sin\u00B2\u03B8+cos\u00B2\u03B8=1',
    'E=mc\u00B2', '\u2211 n\u00B2', '\u03C0r\u00B2', 'det(A)', 'lim x\u2192\u221E',
    'y=mx+b', '\u221A(x\u00B2+y\u00B2)', '\u0394x/\u0394t', 'f\u2032(x)',
    'A\u207B\u00B9', '2x+3y=7', '\u03B8=\u03C0/4'
  ];

  // each shape dissolves into the equation that defines it
  const SHAPE_EQUATIONS = {
    triangle: 'a\u00B2+b\u00B2=c\u00B2',
    circle:   'x\u00B2+y\u00B2=r\u00B2',
    square:   'A=s\u00B2',
    pentagon: '\u03C6=(1+\u221A5)/2',
    hexagon:  '\u03B8=120\u00B0'
  };
  const SHAPE_TYPES = Object.keys(SHAPE_EQUATIONS);

  const MATRIX_COUNT = options.matrixCount;
  const EQUATION_COUNT = options.equationCount;
  const MORPH_COUNT = options.morphCount;
  const SPEED = options.speed; // overall speed multiplier — tune here for faster/slower drift
  const TRAIL_ALPHA = options.trailAlpha;
  let particles = [];
  let scanY = 0;

  function rand(min, max){ return Math.random() * (max - min) + min; }

  function makeMatrixParticle(){
    const rows = Math.random() > 0.5 ? 2 : 3;
    const cols = rows;
    const values = Array.from({ length: rows * cols }, () => Math.floor(rand(-9, 9)));
    return {
      type: 'matrix',
      rows, cols, values,
      cell: rand(20, 26),
      x: rand(0, width),
      y: rand(height * 0.2, height * 1.1),
      vy: -rand(6, 14) * SPEED,
      life: 0,
      maxLife: rand(380, 560),
    };
  }

  function makeEquationParticle(){
    return {
      type: 'equation',
      text: equations[Math.floor(Math.random() * equations.length)],
      size: rand(15, 22),
      x: rand(0, width),
      y: rand(height * 0.2, height * 1.1),
      vy: -rand(8, 18) * SPEED,
      vx: rand(-4, 4) * SPEED,
      life: 0,
      maxLife: rand(320, 500),
    };
  }

  function makeMorphParticle(){
    const shape = SHAPE_TYPES[Math.floor(Math.random() * SHAPE_TYPES.length)];
    return {
      type: 'morph',
      shape,
      equation: SHAPE_EQUATIONS[shape],
      size: rand(46, 66),
      rotation: rand(0, Math.PI * 2),
      spin: rand(-0.6, 0.6),
      x: rand(0, width),
      y: rand(height * 0.2, height * 1.1),
      vy: -rand(4, 9) * SPEED,
      life: 0,
      maxLife: rand(430, 640),
    };
  }

  function seedParticles(){
    particles = [];
    for(let i = 0; i < MATRIX_COUNT; i++){
      const p = makeMatrixParticle();
      p.life = rand(0, p.maxLife);
      particles.push(p);
    }
    for(let i = 0; i < EQUATION_COUNT; i++){
      const p = makeEquationParticle();
      p.life = rand(0, p.maxLife);
      particles.push(p);
    }
    for(let i = 0; i < MORPH_COUNT; i++){
      const p = makeMorphParticle();
      p.life = rand(0, p.maxLife);
      particles.push(p);
    }
  }

  function resize(){
    const rect = canvas.parentElement.getBoundingClientRect();
    width = canvas.width = rect.width;
    height = canvas.height = rect.height;
    seedParticles();
  }

  // fade in over the first 15% of life, fade out over the last 25%
  function opacityFor(p){
    const t = p.life / p.maxLife;
    if(t < 0.15) return t / 0.15;
    if(t > 0.75) return Math.max(0, (1 - t) / 0.25);
    return 1;
  }

  function drawMatrix(p, alpha){
    const w = p.cols * p.cell;
    const h = p.rows * p.cell;
    const left = p.x - w / 2;
    const top = p.y - h / 2;
    const pad = 8;

    ctx.strokeStyle = `rgba(0,255,106,${alpha * 0.8})`;
    ctx.lineWidth = 1.5;

    // left bracket
    ctx.beginPath();
    ctx.moveTo(left - pad + 6, top - pad);
    ctx.lineTo(left - pad, top - pad);
    ctx.lineTo(left - pad, top + h + pad);
    ctx.lineTo(left - pad + 6, top + h + pad);
    ctx.stroke();

    // right bracket
    ctx.beginPath();
    ctx.moveTo(left + w + pad - 6, top - pad);
    ctx.lineTo(left + w + pad, top - pad);
    ctx.lineTo(left + w + pad, top + h + pad);
    ctx.lineTo(left + w + pad - 6, top + h + pad);
    ctx.stroke();

    ctx.font = `${Math.floor(p.cell * 0.55)}px 'IBM Plex Mono', monospace`;
    ctx.fillStyle = `rgba(217,245,226,${alpha * 0.85})`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for(let r = 0; r < p.rows; r++){
      for(let c = 0; c < p.cols; c++){
        const val = p.values[r * p.cols + c];
        const cx = left + c * p.cell + p.cell / 2;
        const cy = top + r * p.cell + p.cell / 2;
        ctx.fillText(String(val), cx, cy);
      }
    }
  }

  function drawEquation(p, alpha){
    ctx.font = `500 ${p.size}px 'IBM Plex Mono', monospace`;
    ctx.fillStyle = `rgba(0,255,106,${alpha * 0.65})`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.text, p.x, p.y);
  }

  // traces the outline of a regular polygon (or circle) centered on
  // the current canvas origin — call after translate/rotate.
  function traceShapePath(shape, size){
    const r = size / 2;
    ctx.beginPath();
    if(shape === 'circle'){
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      return;
    }
    const sides = { triangle: 3, square: 4, pentagon: 5, hexagon: 6 }[shape] || 5;
    const startAngle = -Math.PI / 2;
    for(let i = 0; i <= sides; i++){
      const a = startAngle + (i * 2 * Math.PI) / sides;
      const px = r * Math.cos(a);
      const py = r * Math.sin(a);
      if(i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  // draws a shape spinning in, holding, dissolving into the
  // equation that defines it, holding, then fading out.
  function drawMorph(p){
    const t = Math.min(1, p.life / p.maxLife);

    let shapeAlpha = 0, textAlpha = 0, scale = 1;
    if(t < 0.14){
      shapeAlpha = t / 0.14;
      scale = 0.7 + 0.3 * (t / 0.14);
    } else if(t < 0.38){
      shapeAlpha = 1;
    } else if(t < 0.58){
      const ct = (t - 0.38) / 0.2;
      shapeAlpha = 1 - ct;
      textAlpha = ct;
      scale = 1 + ct * 0.18;
    } else if(t < 0.84){
      textAlpha = 1;
    } else {
      textAlpha = Math.max(0, (1 - t) / 0.16);
    }

    if(shapeAlpha > 0.02){
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation + t * Math.PI * 1.4 * p.spin);
      ctx.strokeStyle = `rgba(0,255,106,${shapeAlpha * 0.85})`;
      ctx.lineWidth = 2;
      traceShapePath(p.shape, p.size * scale);
      ctx.stroke();
      ctx.restore();
    }

    if(textAlpha > 0.02){
      ctx.font = `500 ${Math.round(p.size * 0.42)}px 'IBM Plex Mono', monospace`;
      ctx.fillStyle = `rgba(0,255,106,${textAlpha * 0.8})`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.equation, p.x, p.y);
    }
  }

  function drawScanline(){
    scanY = (scanY + 2.6 * SPEED) % (height + 120);
    const grad = ctx.createLinearGradient(0, scanY - 60, 0, scanY + 60);
    grad.addColorStop(0, 'rgba(0,255,106,0)');
    grad.addColorStop(0.5, 'rgba(0,255,106,0.05)');
    grad.addColorStop(1, 'rgba(0,255,106,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, scanY - 60, width, 120);
  }

  function draw(){
    ctx.fillStyle = `rgba(6,10,7,${TRAIL_ALPHA})`;
    ctx.fillRect(0, 0, width, height);

    drawScanline();

    particles.forEach((p, i) => {
      p.life++;
      p.y += p.vy / 60;
      if(p.type === 'equation') p.x += p.vx / 60;

      const alpha = opacityFor(p);

      if(p.type === 'matrix') drawMatrix(p, alpha);
      else if(p.type === 'equation') drawEquation(p, alpha);
      else drawMorph(p);

      if(p.life >= p.maxLife || p.y < -80){
        if(p.type === 'matrix') particles[i] = makeMatrixParticle();
        else if(p.type === 'equation') particles[i] = makeEquationParticle();
        else particles[i] = makeMorphParticle();
      }
    });

    rafId = requestAnimationFrame(draw);
  }

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  resize();
  window.addEventListener('resize', resize);

  if(!prefersReduced){
    draw();
  } else {
    // draw a single static frame instead of a continuous animation
    ctx.fillStyle = '#060a07';
    ctx.fillRect(0, 0, width, height);
    particles.forEach(p => {
      if(p.type === 'matrix') drawMatrix(p, 0.6);
      else if(p.type === 'equation') drawEquation(p, 0.6);
      else drawMorph(p);
    });
  }

  window.addEventListener('beforeunload', () => cancelAnimationFrame(rafId));
}

/* ---------- sets up every math scene on the page ----------
   The big hero canvas (#math-rain) gets the full, dense scene.
   Smaller ".ambient-rain" canvases — dropped into section
   backgrounds elsewhere on the site — get a lighter, slower,
   more subtle version so they read as texture behind the text
   rather than competing with it. Counts are trimmed further on
   small screens so it stays smooth on phones. */
function initMathAnimation(){
  const isSmallScreen = window.matchMedia('(max-width: 700px)').matches;
  const scale = isSmallScreen ? 0.6 : 1;

  createMathScene(document.getElementById('math-rain'), {
    matrixCount: Math.max(2, Math.round(5 * scale)),
    equationCount: Math.max(2, Math.round(6 * scale)),
    morphCount: Math.max(1, Math.round(4 * scale)),
    speed: 1.9,
    trailAlpha: 0.24,
  });

  document.querySelectorAll('.ambient-rain').forEach(canvas => {
    createMathScene(canvas, {
      matrixCount: isSmallScreen ? 1 : 2,
      equationCount: isSmallScreen ? 1 : 2,
      morphCount: 1,
      speed: 1.1,
      trailAlpha: 0.3,
    });
  });
}
