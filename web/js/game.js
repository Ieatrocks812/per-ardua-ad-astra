(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const context = canvas.getContext('2d');

  const images = {
    background: new Image(),
    plane: new Image(),
  };

  // Asset paths (relative to this html file)
  images.background.src = '../assets/sprites/environment/background.png';
  images.plane.src = '../assets/sprites/aircraft/player/Spitfire facing right.png';

  let canvasWidth = 0;
  let canvasHeight = 0;

  function resizeCanvas() {
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.scale(dpr, dpr);
    canvasWidth = window.innerWidth;
    canvasHeight = window.innerHeight;
  }

  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  // World scale: meters to pixels
  const metersToPixels = 6; // 1 m = 6 px

  // Aircraft state
  const state = {
    position: { x: 0, y: 300 }, // meters
    velocity: { x: 30, y: 0 }, // m/s (start with some forward speed)
    angle: 0, // radians (0 = facing +X)
    angularVelocity: 0, // rad/s
    throttle: 0.6, // 0..1
  };

  // Camera
  const camera = {
    x: 0,
    y: 0,
  };

  // Controls
  const keysDown = new Set();
  window.addEventListener('keydown', (e) => {
    keysDown.add(e.key.toLowerCase());
    if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(e.key.toLowerCase())) {
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => {
    keysDown.delete(e.key.toLowerCase());
  });

  // Physics constants
  const massKg = 3000; // approximate mass
  const gravity = 9.81; // m/s^2
  const airDensity = 1.225; // kg/m^3
  const wingArea = 16; // m^2
  const maxThrustN = 25000; // Newtons
  const baseDragCoeff = 0.03; // baseline parasitic drag
  const liftSlopePerRad = 5.0; // approx 2*pi is 6.28; lower for simplicity
  const stallAngleRad = 15 * Math.PI / 180;
  const clMax = 1.2; // cap lift coefficient
  const aspectRatio = 7; // for induced drag estimate
  const oswaldEff = 0.8;
  const angularTorque = 22000; // control authority
  const angularDamping = 0.9; // reduces spin over time
  const linearDamping = 0.002; // small speed damping

  function sign(value) { return value < 0 ? -1 : 1; }

  function wrapPi(angle) {
    while (angle > Math.PI) angle -= 2 * Math.PI;
    while (angle < -Math.PI) angle += 2 * Math.PI;
    return angle;
  }

  function update(dt) {
    // Inputs
    const pitchUp = keysDown.has('arrowup') || keysDown.has('w');
    const pitchDown = keysDown.has('arrowdown') || keysDown.has('s');
    const throttleUp = keysDown.has("+") || keysDown.has('=') || keysDown.has(']');
    const throttleDown = keysDown.has('-') || keysDown.has('_') || keysDown.has('[');
    const stabilize = keysDown.has(' ');

    // Stabilize: damp angular velocity and gently level
    if (stabilize) {
      state.angularVelocity *= 0.92;
      state.angle *= 0.98;
    }

    // Reset
    if (keysDown.has('r')) {
      state.position.x = 0;
      state.position.y = 300;
      state.velocity.x = 30;
      state.velocity.y = 0;
      state.angle = 0;
      state.angularVelocity = 0;
      state.throttle = 0.6;
    }

    // Throttle adjust
    const throttleChange = (throttleUp ? 0.4 : 0) + (throttleDown ? -0.4 : 0);
    if (throttleChange !== 0) {
      state.throttle = Math.max(0, Math.min(1, state.throttle + throttleChange * dt));
    }

    // Control torque from pitch
    let controlInput = 0;
    if (pitchUp) controlInput += 1;
    if (pitchDown) controlInput -= 1;
    state.angularVelocity += (controlInput * angularTorque / (massKg * 50)) * dt;
    state.angularVelocity *= Math.pow(1 - Math.min(0.99, angularDamping * dt), 1);
    state.angle += state.angularVelocity * dt;
    state.angle = wrapPi(state.angle);

    // Unit vectors
    const heading = { x: Math.cos(state.angle), y: Math.sin(state.angle) };

    // Thrust (body forward)
    const thrust = {
      x: heading.x * state.throttle * maxThrustN,
      y: heading.y * state.throttle * maxThrustN,
    };

    // Gravity
    const gravityForce = { x: 0, y: massKg * gravity };

    // Aerodynamics based on airspeed (opposes velocity)
    const speed = Math.hypot(state.velocity.x, state.velocity.y);
    let drag = { x: 0, y: 0 };
    let lift = { x: 0, y: 0 };
    if (speed > 0.1) {
      const velDir = { x: state.velocity.x / speed, y: state.velocity.y / speed };
      const aoa = wrapPi(state.angle - Math.atan2(state.velocity.y, state.velocity.x));

      // Lift coefficient with simple stall behavior
      let cl = liftSlopePerRad * aoa;
      if (Math.abs(aoa) > stallAngleRad) {
        const excess = Math.abs(aoa) - stallAngleRad;
        cl *= Math.max(0.2, 1 - excess * 2); // lose lift past stall
      }
      cl = Math.max(-clMax, Math.min(clMax, cl));

      // Induced drag approx
      const inducedDrag = (cl * cl) / (Math.PI * aspectRatio * oswaldEff);
      const cd = baseDragCoeff + inducedDrag;

      const q = 0.5 * airDensity * speed * speed; // dynamic pressure

      // Drag opposite velocity
      const dragMag = q * wingArea * cd;
      drag = { x: -velDir.x * dragMag, y: -velDir.y * dragMag };

      // Lift perpendicular to velocity (to the left normal). Sign via cl
      const normalLeft = { x: -velDir.y, y: velDir.x };
      const liftMag = q * wingArea * cl;
      lift = { x: normalLeft.x * liftMag, y: normalLeft.y * liftMag };
    }

    // Sum forces
    const force = {
      x: thrust.x + drag.x + lift.x + gravityForce.x,
      y: thrust.y + drag.y + lift.y + gravityForce.y,
    };

    // Integrate (semi-implicit Euler)
    state.velocity.x += (force.x / massKg) * dt;
    state.velocity.y += (force.y / massKg) * dt;

    // Linear damping
    state.velocity.x *= 1 - Math.min(0.99, linearDamping * dt);
    state.velocity.y *= 1 - Math.min(0.99, linearDamping * dt);

    state.position.x += state.velocity.x * dt;
    state.position.y += state.velocity.y * dt;

    // Prevent going far below ground level (y increases downward). Simulated ground at y=600m
    const groundY = 600;
    if (state.position.y > groundY) {
      state.position.y = groundY;
      if (state.velocity.y > 0) state.velocity.y *= -0.2; // bounce
    }

    // Camera follows with slight lead and smoothing
    const lead = 2.0;
    const targetCamX = state.position.x + state.velocity.x * lead;
    const targetCamY = state.position.y + state.velocity.y * 0.5;
    const smooth = 1 - Math.pow(0.001, dt);
    camera.x += (targetCamX - camera.x) * smooth;
    camera.y += (targetCamY - camera.y) * smooth;
  }

  function drawBackground() {
    const img = images.background;
    if (!img.complete || img.naturalWidth === 0) return;

    // Scale background to a fixed world height for tiling
    const worldTileHeightMeters = 300; // how tall a tile is in world meters
    const scale = (worldTileHeightMeters * metersToPixels) / img.naturalHeight;
    const tileWidthPx = img.naturalWidth * scale;
    const tileHeightPx = img.naturalHeight * scale;

    // Parallax factor (background scrolls slower)
    const parallax = 0.6;
    const camXpx = camera.x * metersToPixels * parallax;
    const camYpx = camera.y * metersToPixels * parallax;

    const startX = -((camXpx % tileWidthPx) + tileWidthPx) % tileWidthPx;
    const startY = -((camYpx % tileHeightPx) + tileHeightPx) % tileHeightPx;

    const cols = Math.ceil((canvasWidth + tileWidthPx) / tileWidthPx) + 1;
    const rows = Math.ceil((canvasHeight + tileHeightPx) / tileHeightPx) + 1;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = startX + col * tileWidthPx;
        const y = startY + row * tileHeightPx;
        context.drawImage(img, x, y, tileWidthPx, tileHeightPx);
      }
    }
  }

  function worldToScreen(wx, wy) {
    const sx = (wx - camera.x) * metersToPixels + canvasWidth / 2;
    const sy = (wy - camera.y) * metersToPixels + canvasHeight / 2;
    return { x: sx, y: sy };
  }

  function drawPlane() {
    const pos = worldToScreen(state.position.x, state.position.y);
    const img = images.plane;
    const baseScale = 0.6; // image scale on screen
    const width = img.naturalWidth * baseScale;
    const height = img.naturalHeight * baseScale;
    context.save();
    context.translate(pos.x, pos.y);
    context.rotate(state.angle);
    context.drawImage(img, -width * 0.4, -height * 0.5, width, height);
    context.restore();
  }

  function drawHud() {
    const speed = Math.hypot(state.velocity.x, state.velocity.y);
    context.save();
    context.fillStyle = 'rgba(255,255,255,0.9)';
    context.font = '12px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
    const lines = [
      `Speed: ${speed.toFixed(1)} m/s`,
      `Throttle: ${(state.throttle * 100).toFixed(0)}%`,
      `Altitude: ${(600 - state.position.y).toFixed(1)} m`,
      `Angle: ${(state.angle * 180 / Math.PI).toFixed(1)}°`,
      'Controls: Up/Down pitch, +/- throttle, Space stabilize, R reset'
    ];
    let y = 16;
    for (const line of lines) {
      context.fillText(line, 16, y);
      y += 16;
    }
    context.restore();
  }

  let lastTime = performance.now();
  function frame(now) {
    const dt = Math.min(0.033, Math.max(0.001, (now - lastTime) / 1000));
    lastTime = now;

    update(dt);

    // Clear
    context.clearRect(0, 0, canvasWidth, canvasHeight);

    // Draw
    drawBackground();
    drawPlane();
    drawHud();

    requestAnimationFrame(frame);
  }

  // Start when images are loaded
  let assetsLoaded = 0;
  const required = Object.keys(images).length;
  Object.values(images).forEach((img) => {
    img.addEventListener('load', () => {
      assetsLoaded += 1;
      if (assetsLoaded >= required) {
        lastTime = performance.now();
        requestAnimationFrame(frame);
      }
    });
  });
})();


