(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const context = canvas.getContext('2d');

  const images = {
    background: new Image(),
    plane: new Image(),
    enemyBf109: new Image(),
    enemyJu88: new Image(),
  };

  // Asset paths (relative to this html file)
  images.background.src = '../assets/sprites/environment/map.png';
  images.plane.src = '../assets/sprites/aircraft/player/Spitfire facing right.png';
  images.enemyBf109.src = '../assets/sprites/aircraft/enemies/bf-109 facing left.png';
  images.enemyJu88.src = '../assets/sprites/aircraft/enemies/ju-88.png';

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

  // Box2D world
  const pl = window.planck;
  const world = new pl.World(pl.Vec2(0, gravity)); // gravity downward

  // Aircraft control state
  const state = {
    throttle: 0.6, // 0..1
  };

  // Enemy management
  const enemies = [];
  let lastEnemySpawn = 0;

  // Camera
  const camera = { 
    x: 0, 
    y: 0, 
    zoom: 1.0, // zoom factor (1.0 = normal, 2.0 = 2x zoomed in, 0.5 = 2x zoomed out)
    minZoom: minZoomBasedOnMap,
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

  // =============================================================================
  // PHYSICS & SIMULATION CONSTANTS - TWEAK THESE FOR GAMEPLAY
  // =============================================================================
  
  // World settings
  const metersToPixels = 6; // 1 m = 6 px
  const gravity = 9.81; // m/s^2 (Box2D handles this)
  const fixedDt = 1 / 60; // physics timestep
  
  // Player aircraft physics
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
  
  // Enemy settings
  const enemySpawnDistance = 2000; // meters ahead of player
  const enemyDespawnDistance = 3000; // meters behind player
  const maxEnemies = 8;
  const enemySpawnInterval = 3000; // milliseconds
  const enemySpeed = 40; // m/s
  const enemyTurnRate = 0.8; // rad/s
  
  // Ground settings
  const groundY = 600; // meters
  const groundSpacing = 50; // meters between T shapes
  const groundTWidth = 40; // meters
  const groundTHeight = 25; // meters
  const groundThickness = 3; // meters
  
  // Camera settings
  const backgroundParallax = 0.6; // background scroll factor
  const backgroundTileHeight = 300; // meters
  const minZoomBasedOnMap = 0.3; // prevent zooming out too far from map

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
  const groundTs = [];
  function createGroundRow() {
    const startX = -5000;
    const endX = 5000;

    for (let x = startX; x <= endX; x += groundSpacing) {
      const body = world.createBody({ type: 'static', position: pl.Vec2(x, groundY) });
      // Top bar centered at (0,0) of the body
      body.createFixture(pl.Box(groundTWidth / 2, groundThickness / 2, pl.Vec2(0, 0), 0), {
        friction: 0.9,
        restitution: 0.0,
      });
      // Stem extends downward from the top bar
      body.createFixture(
        pl.Box(groundThickness / 2, groundTHeight / 2, pl.Vec2(0, groundThickness / 2 + groundTHeight / 2), 0),
        { friction: 0.9, restitution: 0.0 }
      );
      groundTs.push({ 
        body, 
        topWidth: groundTWidth, 
        topThickness: groundThickness, 
        stemHeight: groundTHeight, 
        stemThickness: groundThickness 
      });
    }
  }
  createGroundRow();

  // Enemy creation and management
  function createEnemy(x, y, type = 'bf109') {
    const dims = type === 'ju88' ? { width: 12, height: 4 } : { width: 8, height: 3 };
    const mass = type === 'ju88' ? 4000 : 2500;
    
    const body = world.createBody({
      type: 'dynamic',
      position: pl.Vec2(x, y),
      angle: Math.PI, // facing left initially
      angularDamping: 0.8,
      linearDamping: 0.1,
    });
    
    const area = dims.width * dims.height;
    const density = mass / area;
    
    body.createFixture(pl.Box(dims.width / 2, dims.height / 2), {
      density: density,
      friction: 0.3,
      restitution: 0.2,
      filterCategoryBits: 0x0004, // enemy category
      filterMaskBits: 0x0002 | 0x0001, // collide with player and ground
    });
    
    const enemy = {
      body,
      type,
      dims,
      mass,
      aiState: 'patrol',
      targetAngle: Math.PI,
      lastDirectionChange: Date.now(),
      health: type === 'ju88' ? 3 : 2,
    };
    
    // Set initial velocity
    body.setLinearVelocity(pl.Vec2(-enemySpeed * 0.8, 0));
    
    enemies.push(enemy);
    return enemy;
  }

  function updateEnemies(dt) {
    const playerPos = planeBody.getPosition();
    const now = Date.now();
    
    // Spawn enemies ahead of player
    if (now - lastEnemySpawn > enemySpawnInterval && enemies.length < maxEnemies) {
      const spawnX = playerPos.x + enemySpawnDistance + (Math.random() - 0.5) * 500;
      const spawnY = 200 + Math.random() * 300; // altitude variation
      const type = Math.random() > 0.7 ? 'ju88' : 'bf109';
      createEnemy(spawnX, spawnY, type);
      lastEnemySpawn = now;
    }
    
    // Update enemy AI and remove distant enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
      const enemy = enemies[i];
      const enemyPos = enemy.body.getPosition();
      
      // Remove if too far behind player
      if (enemyPos.x < playerPos.x - enemyDespawnDistance) {
        world.destroyBody(enemy.body);
        enemies.splice(i, 1);
        continue;
      }
      
      // Simple AI behavior
      updateEnemyAI(enemy, dt, playerPos);
    }
  }

  function updateEnemyAI(enemy, dt, playerPos) {
    const pos = enemy.body.getPosition();
    const vel = enemy.body.getLinearVelocity();
    const angle = enemy.body.getAngle();
    const now = Date.now();
    
    // Simple patrol/intercept behavior
    let targetAngle = enemy.targetAngle;
    
    if (enemy.aiState === 'patrol') {
      // Random direction changes
      if (now - enemy.lastDirectionChange > 2000 + Math.random() * 3000) {
        enemy.targetAngle += (Math.random() - 0.5) * Math.PI * 0.5;
        enemy.lastDirectionChange = now;
      }
      
      // If player is close, switch to intercept
      const distToPlayer = Math.hypot(pos.x - playerPos.x, pos.y - playerPos.y);
      if (distToPlayer < 800) {
        enemy.aiState = 'intercept';
      }
    } else if (enemy.aiState === 'intercept') {
      // Head towards player
      targetAngle = Math.atan2(playerPos.y - pos.y, playerPos.x - pos.x);
      
      // Return to patrol if player is far
      const distToPlayer = Math.hypot(pos.x - playerPos.x, pos.y - playerPos.y);
      if (distToPlayer > 1200) {
        enemy.aiState = 'patrol';
        enemy.lastDirectionChange = now;
      }
    }
    
    // Apply turning towards target angle
    const angleDiff = wrapPi(targetAngle - angle);
    const turnForce = Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), enemyTurnRate) * 8000;
    enemy.body.applyTorque(turnForce, true);
    
    // Apply thrust in facing direction
    const thrust = enemy.type === 'ju88' ? enemySpeed * 0.6 : enemySpeed * 0.8;
    const heading = { x: Math.cos(angle), y: Math.sin(angle) };
    enemy.body.applyForceToCenter(pl.Vec2(heading.x * thrust * 800, heading.y * thrust * 800), true);
    
    // Avoid ground
    if (pos.y > groundY - 100) {
      enemy.body.applyForceToCenter(pl.Vec2(0, -5000), true);
    }
  }

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
      
      // Clear enemies
      for (const enemy of enemies) {
        world.destroyBody(enemy.body);
      }
      enemies.length = 0;
      lastEnemySpawn = 0;
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
    if (img.complete && img.naturalWidth > 0) {
      // For a single large map image, scale it to fit the world and position it
      // Calculate scale to fit the map appropriately
      const mapWorldWidth = 8000; // assume map covers 8km of world space
      const mapWorldHeight = 6000; // assume map covers 6km of world space
      
      const mapPixelWidth = mapWorldWidth * metersToPixels * camera.zoom;
      const mapPixelHeight = mapWorldHeight * metersToPixels * camera.zoom;
      
      // Center the map in world coordinates (map spans from -4000 to +4000 in X, 0 to 6000 in Y)
      const mapCenterX = 0;
      const mapCenterY = mapWorldHeight / 2;
      
      // Convert map position to screen coordinates
      const mapScreenX = (mapCenterX - camera.x) * metersToPixels * camera.zoom + canvasWidth / 2 - mapPixelWidth / 2;
      const mapScreenY = (mapCenterY - camera.y) * metersToPixels * camera.zoom + canvasHeight / 2 - mapPixelHeight / 2;
      
      context.drawImage(img, mapScreenX, mapScreenY, mapPixelWidth, mapPixelHeight);
    } else {
      // Fallback: simple gradient background
      const gradient = context.createLinearGradient(0, 0, 0, canvasHeight);
      gradient.addColorStop(0, '#87CEEB'); // sky blue
      gradient.addColorStop(1, '#98FB98'); // pale green
      context.fillStyle = gradient;
      context.fillRect(0, 0, canvasWidth, canvasHeight);
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
    
    context.save();
    context.translate(pos.x, pos.y);
    context.rotate(planeBody.getAngle());
    
    if (img.complete && img.naturalWidth > 0) {
      const baseScale = 0.6 * camera.zoom; // scale with zoom
      const width = img.naturalWidth * baseScale;
      const height = img.naturalHeight * baseScale;
      context.drawImage(img, -width * 0.4, -height * 0.5, width, height);
    } else {
      // Fallback: draw simple rectangle
      context.fillStyle = '#4169E1'; // royal blue
      context.strokeStyle = '#000080'; // navy
      context.lineWidth = 2;
      const size = 20 * camera.zoom;
      context.fillRect(-size * 0.6, -size * 0.3, size * 1.2, size * 0.6);
      context.strokeRect(-size * 0.6, -size * 0.3, size * 1.2, size * 0.6);
    }
    
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

  function drawEnemies() {
    // Don't draw enemies for now - focus on just background and player
    return;
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
      `Altitude: ${(groundY - planeBody.getPosition().y).toFixed(1)} m`,
      `Angle: ${(planeBody.getAngle() * 180 / Math.PI).toFixed(1)}°`,
      `Zoom: ${camera.zoom.toFixed(1)}x`,
      `Enemies: ${enemies.length}`,
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
  function frame(now) {
    let dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
    lastTime = now;
    accumulator += dt;

    // Update input/forces once per render
    updateControlsAndForces(fixedDt);
    // updateEnemies(fixedDt); // Disabled for now

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
    drawEnemies();
    drawPlane();
    drawHud();

    requestAnimationFrame(frame);
  }

  // Start game immediately, images will load progressively
  console.log('Starting game...', Object.values(images).map(img => img.src));
  
  Object.values(images).forEach((img, index) => {
    img.addEventListener('load', () => {
      console.log(`Image ${index + 1} loaded:`, img.src);
    });
    img.addEventListener('error', (e) => {
      console.error('Failed to load image:', img.src, e);
    });
  });

  // Start immediately
  lastTime = performance.now();
  requestAnimationFrame(frame);
})();


