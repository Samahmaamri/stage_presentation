const canvas = document.querySelector('#brain');
const context = canvas.getContext('2d');

if (context) {
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  const particles = [];
  const palette = ['#351726', '#683044', '#97445f', '#c26381', '#ee8ba6', '#ffb3c4', '#ffdece'];
  let seed = 1089;
  let width, height, scale;
  let angle = -.52;
  let tilt = -.14;
  let targetTilt = tilt;
  let targetAngle = angle;
  let dragging = false;
  let pointer = null;
  let running = !preference.matches;
  let frame = 0;
  let previousTime = 0;

  function random() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  }

  function surface(latitude, longitude, side) {
    const sin = Math.sin(latitude);
    const cos = Math.cos(latitude);
    const length = sin * Math.cos(longitude);
    const belly = sin * Math.sin(longitude);
    const ripple = Math.sin(21 * longitude + 2.2 * Math.sin(8 * latitude) + 4 * latitude);
    const fold = Math.sin(25 * latitude + 4 * Math.sin(5 * longitude) + 2 * ripple);
    const groove = Math.pow(.5 + .5 * fold, 3) * .105 + ripple * .023;
    const radius = 1 - groove;
    return {
      x: length * 1.31 * radius + .07 * cos,
      y: (.83 * cos + .14 * length + .08 * Math.max(0, -length)) * radius,
      z: side * (.035 + .69 * belly * radius),
      groove
    };
  }

  for (const side of [-1, 1]) {
    for (let i = 0; i < 4600; i++) {
      const latitude = Math.acos(2 * random() - 1);
      const longitude = Math.PI * random();
      particles.push({ ...surface(latitude, longitude, side), size: .6 + 1.55 * random(), light: random() });
    }

    // Trace connected branches across the folds of each hemisphere.
    for (let branch = 0; branch < 14; branch++) {
      const origin = .4 + random() * 2.3;
      for (let i = 0; i < 105; i++) {
        const progress = i / 104;
        const latitude = origin + .18 * Math.sin(progress * 5 + branch) + .19 * progress;
        const longitude = .27 + 2.52 * progress + .12 * Math.sin(progress * 15 + branch);
        const point = surface(latitude, longitude, side);
        particles.push({ ...point, z: point.z + side * .012, size: 1.08, light: .9, vessel: true });
      }
    }
  }

  // Add a small cerebellum and brainstem below the hemispheres.
  for (let i = 0; i < 1150; i++) {
    const y = 2 * random() - 1;
    const turn = 2 * Math.PI * random();
    const radius = Math.sqrt(1 - y * y);
    const stem = i < 340;
    const fold = .02 * Math.cos(y * 42);
    particles.push({
      x: (stem ? -.35 : -.73) + radius * Math.cos(turn) * (stem ? .13 : .36) + (stem ? y * .14 : 0),
      y: (stem ? -.87 : -.57) + y * (stem ? .31 : .30),
      z: radius * Math.sin(turn) * ((stem ? .13 : .40) + fold),
      groove: fold + .09,
      size: .7 + random(),
      light: random()
    });
  }

  function draw() {
    const sin = Math.sin(angle), cos = Math.cos(angle);
    const pitchSin = Math.sin(tilt), pitchCos = Math.cos(tilt);
    const bins = Array.from({ length: 20 }, () => []);
    for (const point of particles) {
      const horizontal = point.x * cos - point.z * sin;
      const depth = point.z * cos + point.x * sin;
      const vertical = point.y * pitchCos - depth * pitchSin;
      const z = depth * pitchCos + point.y * pitchSin;
      const perspective = 4.6 / (4.6 - z);
      const x = width * .50 + horizontal * scale * perspective;
      const y = height * .47 - vertical * scale * perspective;
      const bucket = Math.max(0, Math.min(19, Math.floor((z + 1.5) * 6.5)));
      const light = Math.max(0, Math.min(6, Math.round(
        2 + z * 1.65 + point.y * .8 + point.light * 2.3 - point.groove * 16 + (point.vessel ? 1.2 : 0)
      )));
      bins[bucket].push({ x, y, light, size: point.size * perspective * Math.min(1.2, scale / 140) });
    }
    context.clearRect(0, 0, width, height);
    for (const bin of bins) {
      for (const point of bin) {
        context.fillStyle = palette[point.light];
        context.fillRect(point.x, point.y, point.size, point.size);
      }
    }
  }

  function resize() {
    ({ width, height } = canvas.getBoundingClientRect());
    const ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    scale = Math.min(width / 3.05, height / 2.45);
    draw();
  }

  function animate(time) {
    const elapsed = previousTime ? Math.min(time - previousTime, 34) : 0;
    previousTime = time;
    if (pointer === null) targetAngle += elapsed * .00027;
    const easing = 1 - Math.exp(-elapsed / 110);
    angle += (targetAngle - angle) * easing;
    tilt += (targetTilt - tilt) * easing;
    draw();
    frame = requestAnimationFrame(animate);
  }

  function syncMotion() {
    cancelAnimationFrame(frame);
    previousTime = 0;
    if (running && !document.hidden) frame = requestAnimationFrame(animate);
  }

  canvas.addEventListener('pointerdown', (event) => {
    if (!running || event.pointerType === 'mouse') return;
    canvas.setPointerCapture(event.pointerId);
    dragging = true;
    pointer = event.clientX;
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!running || (event.pointerType !== 'mouse' && !dragging)) return;
    if (pointer !== null) targetAngle += (event.clientX - pointer) * .009;
    pointer = event.clientX;
    targetTilt = (event.clientY - canvas.getBoundingClientRect().top - height / 2) / height * .7;
  });
  for (const name of ['pointerleave', 'pointerup', 'pointercancel']) {
    canvas.addEventListener(name, () => {
      dragging = false;
      pointer = null;
      targetTilt = -.14;
    });
  }
  preference.addEventListener('change', (event) => {
    running = !event.matches;
    syncMotion();
  });
  document.addEventListener('visibilitychange', syncMotion);
  new ResizeObserver(resize).observe(canvas);
  syncMotion();
}
