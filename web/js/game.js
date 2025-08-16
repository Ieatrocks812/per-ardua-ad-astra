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

  // Box2D world
  const pl = window.planck;
  const world = new pl.World(pl.Vec2(0, 9.81)); // gravity downward

  // Aircraft control state
  const state = {
    throttle: 0.6, // 0..1
  };

  // Camera
  const camera = { 
    x: 0, 
    y: 0, 
    zoom: 1.0, // zoom factor (1.0 = normal, 2.0 = 2x zoomed in, 0.5 = 2x zoomed out)
    minZoom: 0.1,
    maxZoom: 5.0
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

  // Zoom controls
  window.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    camera.zoom = Math.max(camera.minZoom, Math.min(camera.maxZoom, camera.zoom * zoomFactor));
  });

  // Keyboard zoom
  window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'q') {
      camera.zoom = Math.max(camera.minZoom, camera.zoom * 0.9);
      e.preventDefault();
    } else if (e.key.toLowerCase() === 'e') {
      camera.zoom = Math.min(camera.maxZoom, camera.zoom * 1.1);
      e.preventDefault();
    }
  });

  // Physics/aero constants
  const targetMassKg = 3000; // desired aircraft mass
  const airDensity = 1.225; // kg/m^3
  const wingArea = 16; // m^2
  const maxThrustN = 25000; // Newtons
  const baseDragCoeff = 0.03;
  const liftSlopePerRad = 5.0;
  const stallAngleRad = 15 * Math.PI / 180;
  const clMax = 1.2;
  const aspectRatio = 7;
  const oswaldEff = 0.8;
  const controlTorque = 22000; // N*m

  function wrapPi(angle) {
    while (angle > Math.PI) angle -= 2 * Math.PI;
    while (angle < -Math.PI) angle += 2 * Math.PI;
    return angle;
  }

  // Create plane body (approx rectangle)
  const planeDims = { width: 10, height: 3 }; // meters
  const planeBody = world.createBody({
    type: 'dynamic',
    position: pl.Vec2(0, 300),
    linearVelocity: pl.Vec2(30, 0),
    angle: 0,
    angularDamping: 0.5,
    linearDamping: 0.0,
  });
  const planeArea = planeDims.width * planeDims.height;
  const planeDensity = targetMassKg / planeArea; // kg/m^2
  planeBody.createFixture(pl.Box(planeDims.width / 2, planeDims.height / 2), {
    density: planeDensity,
    friction: 0.6,
    restitution: 0.1,
    filterCategoryBits: 0x0002,
    filterMaskBits: 0xFFFF,
  });

  // Create ground: repeating T shapes
  const groundY = 600; // meters
  const groundTs = [];
  function createGroundRow() {
    const topWidth = 40; // m
    const topThickness = 3; // m
    const stemHeight = 25; // m (downward)
    const stemThickness = 3; // m
    const spacing = 50; // m between Ts
    const startX = -5000;
    const endX = 5000;

    for (let x = startX; x <= endX; x += spacing) {
      const body = world.createBody({ type: 'static', position: pl.Vec2(x, groundY) });
      // Top bar centered at (0,0) of the body
      body.createFixture(pl.Box(topWidth / 2, topThickness / 2, pl.Vec2(0, 0), 0), {
        friction: 0.9,
        restitution: 0.0,
      });
      // Stem extends downward from the top bar
      body.createFixture(
        pl.Box(stemThickness / 2, stemHeight / 2, pl.Vec2(0, topThickness / 2 + stemHeight / 2), 0),
        { friction: 0.9, restitution: 0.0 }
      );
      groundTs.push({ body, topWidth, topThickness, stemHeight, stemThickness });
    }
  }
  createGroundRow();

  function updateControlsAndForces(dt) {
    const pitchUp = keysDown.has('arrowup') || keysDown.has('w');
    const pitchDown = keysDown.has('arrowdown') || keysDown.has('s');
    const throttleUp = keysDown.has('+') || keysDown.has('=') || keysDown.has(']');
    const throttleDown = keysDown.has('-') || keysDown.has('_') || keysDown.has('[');
    const stabilize = keysDown.has(' ');

    // Reset
    if (keysDown.has('r')) {
      planeBody.setTransform(pl.Vec2(0, 300), 0);
      planeBody.setLinearVelocity(pl.Vec2(30, 0));
      planeBody.setAngularVelocity(0);
      state.throttle = 0.6;
    }

    // Throttle adjust
    const throttleChange = (throttleUp ? 0.4 : 0) + (throttleDown ? -0.4 : 0);
    if (throttleChange !== 0) {
      state.throttle = Math.max(0, Math.min(1, state.throttle + throttleChange * dt));
    }

    // Apply control torque
    let controlInput = 0;
    if (pitchUp) controlInput += 1;
    if (pitchDown) controlInput -= 1;
    if (controlInput !== 0) {
      planeBody.applyTorque(controlInput * controlTorque, true);
    }

    // Stabilize (PD control towards level)
    if (stabilize) {
      const angle = wrapPi(planeBody.getAngle());
      const angVel = planeBody.getAngularVelocity();
      const kp = 15000;
      const kd = 4000;
      const torque = -kp * angle - kd * angVel;
      planeBody.applyTorque(torque, true);
    }

    // Aerodynamic forces
    const vel = planeBody.getLinearVelocity();
    const speed = Math.hypot(vel.x, vel.y);
    const angle = planeBody.getAngle();
    const heading = { x: Math.cos(angle), y: Math.sin(angle) };

    // Thrust along heading
    const thrustForce = pl.Vec2(heading.x * state.throttle * maxThrustN, heading.y * state.throttle * maxThrustN);
    planeBody.applyForceToCenter(thrustForce, true);

    if (speed > 0.1) {
      const velDir = { x: vel.x / speed, y: vel.y / speed };
      const aoa = wrapPi(angle - Math.atan2(vel.y, vel.x));

      let cl = liftSlopePerRad * aoa;
      if (Math.abs(aoa) > stallAngleRad) {
        const excess = Math.abs(aoa) - stallAngleRad;
        cl *= Math.max(0.2, 1 - excess * 2);
      }
      cl = Math.max(-clMax, Math.min(clMax, cl));

      const inducedDrag = (cl * cl) / (Math.PI * aspectRatio * oswaldEff);
      const cd = baseDragCoeff + inducedDrag;
      const q = 0.5 * airDensity * speed * speed;

      // Drag opposite velocity
      const dragMag = q * wingArea * cd;
      const dragForce = pl.Vec2(-velDir.x * dragMag, -velDir.y * dragMag);
      planeBody.applyForceToCenter(dragForce, true);

      // Lift perpendicular to velocity
      const normalLeft = { x: -velDir.y, y: velDir.x };
      const liftMag = q * wingArea * cl;
      const liftForce = pl.Vec2(normalLeft.x * liftMag, normalLeft.y * liftMag);
      planeBody.applyForceToCenter(liftForce, true);
    }
  }

  function drawBackground() {
    const img = images.background;
    if (!img.complete || img.naturalWidth === 0) return;

    // Scale background to a fixed world height for tiling
    const worldTileHeightMeters = 300; // how tall a tile is in world meters
    const scale = (worldTileHeightMeters * metersToPixels * camera.zoom) / img.naturalHeight;
    const tileWidthPx = img.naturalWidth * scale;
    const tileHeightPx = img.naturalHeight * scale;

    // Parallax factor (background scrolls slower)
    const parallax = 0.6;
    const camXpx = camera.x * metersToPixels * camera.zoom * parallax;
    const camYpx = camera.y * metersToPixels * camera.zoom * parallax;

    const startX = canvasWidth / 2 - ((camXpx % tileWidthPx) + tileWidthPx) % tileWidthPx;
    const startY = canvasHeight / 2 - ((camYpx % tileHeightPx) + tileHeightPx) % tileHeightPx;

    const cols = Math.ceil((canvasWidth + tileWidthPx) / tileWidthPx) + 2;
    const rows = Math.ceil((canvasHeight + tileHeightPx) / tileHeightPx) + 2;

    for (let row = -1; row < rows; row++) {
      for (let col = -1; col < cols; col++) {
        const x = startX + col * tileWidthPx;
        const y = startY + row * tileHeightPx;
        context.drawImage(img, x, y, tileWidthPx, tileHeightPx);
      }
    }
  }

  function worldToScreen(wx, wy) {
    const sx = (wx - camera.x) * metersToPixels * camera.zoom + canvasWidth / 2;
    const sy = (wy - camera.y) * metersToPixels * camera.zoom + canvasHeight / 2;
    return { x: sx, y: sy };
  }

  function drawPlane() {
    const pos = worldToScreen(planeBody.getPosition().x, planeBody.getPosition().y);
    const img = images.plane;
    const baseScale = 0.6 * camera.zoom; // scale with zoom
    const width = img.naturalWidth * baseScale;
    const height = img.naturalHeight * baseScale;
    context.save();
    context.translate(pos.x, pos.y);
    context.rotate(planeBody.getAngle());
    context.drawImage(img, -width * 0.4, -height * 0.5, width, height);
    context.restore();
  }

  function drawGround() {
    context.save();
    context.fillStyle = 'rgba(120, 200, 120, 0.9)';
    context.strokeStyle = 'rgba(40, 80, 40, 0.8)';
    context.lineWidth = 1;

    for (const t of groundTs) {
      const bodyPos = t.body.getPosition();
      const topLeft = worldToScreen(bodyPos.x - t.topWidth / 2, bodyPos.y - t.topThickness / 2);
      const topRight = worldToScreen(bodyPos.x + t.topWidth / 2, bodyPos.y - t.topThickness / 2);
      const bottomLeft = worldToScreen(bodyPos.x - t.topWidth / 2, bodyPos.y + t.topThickness / 2);
      const bottomRight = worldToScreen(bodyPos.x + t.topWidth / 2, bodyPos.y + t.topThickness / 2);

      // Top bar
      context.beginPath();
      context.rect(topLeft.x, topLeft.y, (topRight.x - topLeft.x), (bottomLeft.y - topLeft.y));
      context.fill();
      context.stroke();

      // Stem
      const stemTop = worldToScreen(bodyPos.x - t.stemThickness / 2, bodyPos.y + t.topThickness / 2);
      const stemBottom = worldToScreen(bodyPos.x + t.stemThickness / 2, bodyPos.y + t.topThickness / 2 + t.stemHeight);
      context.beginPath();
      context.rect(stemTop.x, stemTop.y, (stemBottom.x - stemTop.x), (stemBottom.y - stemTop.y));
      context.fill();
      context.stroke();
    }

    context.restore();
  }

  function drawHud() {
    const vel = planeBody.getLinearVelocity();
    const speed = Math.hypot(vel.x, vel.y);
    context.save();
    context.fillStyle = 'rgba(255,255,255,0.9)';
    context.font = '12px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
    const lines = [
      `Speed: ${speed.toFixed(1)} m/s`,
      `Throttle: ${(state.throttle * 100).toFixed(0)}%`,
      `Altitude: ${(600 - planeBody.getPosition().y).toFixed(1)} m`,
      `Angle: ${(planeBody.getAngle() * 180 / Math.PI).toFixed(1)}°`,
      `Zoom: ${camera.zoom.toFixed(1)}x`,
      'Controls: Up/Down pitch, +/- throttle, Q/E or mouse wheel zoom, Space stabilize, R reset'
    ];
    let y = 16;
    for (const line of lines) {
      context.fillText(line, 16, y);
      y += 16;
    }
    context.restore();
  }

  // Fixed time-step for Box2D
  let lastTime = performance.now();
  let accumulator = 0;
  const fixedDt = 1 / 60;
  function frame(now) {
    let dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
    lastTime = now;
    accumulator += dt;

    // Update input/forces once per render (minor difference, forces re-applied each step below)
    updateControlsAndForces(fixedDt);

    while (accumulator >= fixedDt) {
      world.step(fixedDt);
      accumulator -= fixedDt;
    }

    // Camera always follows plane (no smoothing, no lead)
    const pos = planeBody.getPosition();
    camera.x = pos.x;
    camera.y = pos.y;

    // Clear and draw
    context.clearRect(0, 0, canvasWidth, canvasHeight);
    drawBackground();
    drawGround();
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


