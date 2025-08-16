(() => {
  'use strict';

  // =============================================================================
  // GAME SETUP
  // =============================================================================
  
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const pl = window.planck;
  
  // Game constants
  const PHYSICS_SCALE = 30; // pixels per meter
  const WORLD_WIDTH = 3000; // meters
  const WORLD_HEIGHT = 2000; // meters
  
  // Physics world
  const world = new pl.World(pl.Vec2(0, 9.81)); // gravity
  
  // Images
  const images = {
    background: new Image(),
    spitfire: new Image()
  };
  
  // Set up image loading with error handling
  images.background.onload = () => console.log('Background loaded successfully');
  images.background.onerror = (e) => console.error('Failed to load background:', e);
  images.spitfire.onload = () => console.log('Spitfire loaded successfully'); 
  images.spitfire.onerror = (e) => console.error('Failed to load spitfire:', e);
  
  images.background.src = './assets/sprites/environment/map.png';
  images.spitfire.src = './assets/sprites/aircraft/player/Spitfire facing right.png';
  
  console.log('Loading images:', {
    background: images.background.src,
    spitfire: images.spitfire.src
  });
  
  // Canvas setup
  let canvasWidth = 0;
  let canvasHeight = 0;
  
  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    ctx.scale(dpr, dpr);
    canvasWidth = window.innerWidth;
    canvasHeight = window.innerHeight;
  }
  
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();
  
  // =============================================================================
  // GAME STATE
  // =============================================================================
  
  const gameState = {
    throttle: 0.3,
    camera: { x: 0, y: 0, zoom: 1.0, minZoom: 0.2, maxZoom: 3.0 },
    keys: new Set()
  };
  
  // =============================================================================
  // INPUT HANDLING
  // =============================================================================
  
  window.addEventListener('keydown', (e) => {
    gameState.keys.add(e.key.toLowerCase());
    if (['w', 's', 'a', 'd', 'q', 'e', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(e.key.toLowerCase())) {
      e.preventDefault();
    }
  });
  
  window.addEventListener('keyup', (e) => {
    gameState.keys.delete(e.key.toLowerCase());
  });

  // Zoom controls with mouse wheel
  window.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomSpeed = 0.1;
    const zoomDelta = e.deltaY > 0 ? -zoomSpeed : zoomSpeed;
    gameState.camera.zoom = Math.max(gameState.camera.minZoom, 
      Math.min(gameState.camera.maxZoom, gameState.camera.zoom + zoomDelta));
  });
  
  // =============================================================================
  // PHYSICS SETUP
  // =============================================================================
  
  // Create aircraft body
  const aircraftMass = 3000; // kg
  const aircraftDims = { width: 12, height: 4 }; // meters
  
  const aircraftBody = world.createBody({
    type: 'dynamic',
    position: pl.Vec2(100, 300), // start on grey area
    angle: 0,
    linearDamping: 0.1,
    angularDamping: 0.8
  });
  
  const aircraftShape = pl.Box(aircraftDims.width / 2, aircraftDims.height / 2);
  aircraftBody.createFixture({
    shape: aircraftShape,
    density: aircraftMass / (aircraftDims.width * aircraftDims.height),
    friction: 0.3,
    restitution: 0.2
  });
  
  // Create ground collision bodies by analyzing the map image
  const groundBodies = [];
  
  function createGroundFromImage() {
    // For now, create simple ground rectangles
    // This represents the grey/terrain areas of the map
    const groundSegments = [
      { x: -1000, y: 500, width: 2000, height: 100 },
      { x: 500, y: 300, width: 800, height: 50 },
      { x: -800, y: 400, width: 600, height: 80 },
      { x: 0, y: 600, width: 3000, height: 200 } // main ground
    ];
    
    groundSegments.forEach(segment => {
      const groundBody = world.createBody({
        type: 'static',
        position: pl.Vec2(segment.x, segment.y)
      });
      
      groundBody.createFixture({
        shape: pl.Box(segment.width / 2, segment.height / 2),
        friction: 0.9,
        restitution: 0.1
      });
      
      groundBodies.push({
        body: groundBody,
        ...segment
      });
    });
  }
  
  createGroundFromImage();
  
  // =============================================================================
  // AIRCRAFT PHYSICS
  // =============================================================================
  
  function updateAircraftPhysics(dt) {
    const vel = aircraftBody.getLinearVelocity();
    const pos = aircraftBody.getPosition();
    const angle = aircraftBody.getAngle();
    
    // Input handling
    const pitchUp = gameState.keys.has('a');
    const pitchDown = gameState.keys.has('d');
    const rollLeft = gameState.keys.has('arrowleft');
    const rollRight = gameState.keys.has('arrowright');
    const throttleUp = gameState.keys.has('w');
    const throttleDown = gameState.keys.has('s');
    const zoomIn = gameState.keys.has('e');
    const zoomOut = gameState.keys.has('q');
    const reset = gameState.keys.has('r');
    
    // Reset
    if (reset) {
      aircraftBody.setTransform(pl.Vec2(100, 300), 0);
      aircraftBody.setLinearVelocity(pl.Vec2(0, 0));
      aircraftBody.setAngularVelocity(0);
      gameState.throttle = 0.3;
      return;
    }
    
    // Throttle control
    if (throttleUp) gameState.throttle = Math.min(1.0, gameState.throttle + dt * 0.5);
    if (throttleDown) gameState.throttle = Math.max(0.0, gameState.throttle - dt * 0.8);
    
    // Zoom control
    if (zoomIn) gameState.camera.zoom = Math.min(gameState.camera.maxZoom, gameState.camera.zoom + dt * 1.0);
    if (zoomOut) gameState.camera.zoom = Math.max(gameState.camera.minZoom, gameState.camera.zoom - dt * 1.0);
    
    // Flight controls
    const controlForce = 8000;
    if (pitchUp) aircraftBody.applyTorque(-controlForce, true);
    if (pitchDown) aircraftBody.applyTorque(controlForce, true);
    if (rollLeft) aircraftBody.applyTorque(-controlForce * 0.7, true);
    if (rollRight) aircraftBody.applyTorque(controlForce * 0.7, true);
    
    // Thrust
    const maxThrust = 25000; // Newtons
    const thrust = gameState.throttle * maxThrust;
    const thrustVector = pl.Vec2(Math.cos(angle) * thrust, Math.sin(angle) * thrust);
    aircraftBody.applyForceToCenter(thrustVector, true);
    
    // Aerodynamics
    const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
    if (speed > 0.1) {
      const airDensity = 1.225;
      const wingArea = 16;
      const dynamicPressure = 0.5 * airDensity * speed * speed;
      
      // Angle of attack
      const velocityAngle = Math.atan2(vel.y, vel.x);
      const aoa = angle - velocityAngle;
      
      // Lift (simplified)
      const liftCoeff = Math.sin(aoa * 2) * 1.2;
      const liftMagnitude = dynamicPressure * wingArea * liftCoeff;
      const liftAngle = velocityAngle + Math.PI / 2;
      const liftForce = pl.Vec2(
        Math.cos(liftAngle) * liftMagnitude,
        Math.sin(liftAngle) * liftMagnitude
      );
      aircraftBody.applyForceToCenter(liftForce, true);
      
      // Drag
      const dragCoeff = 0.05 + Math.abs(Math.sin(aoa)) * 0.3;
      const dragMagnitude = dynamicPressure * wingArea * dragCoeff;
      const dragForce = pl.Vec2(-vel.x * dragMagnitude / speed, -vel.y * dragMagnitude / speed);
      aircraftBody.applyForceToCenter(dragForce, true);
    }
  }
  
  // =============================================================================
  // RENDERING
  // =============================================================================
  
  function worldToScreen(worldX, worldY) {
    const screenX = (worldX - gameState.camera.x) * PHYSICS_SCALE * gameState.camera.zoom + canvasWidth / 2;
    const screenY = (worldY - gameState.camera.y) * PHYSICS_SCALE * gameState.camera.zoom + canvasHeight / 2;
    return { x: screenX, y: screenY };
  }
  
  function drawBackground() {
    const bgImg = images.background;
    console.log('Drawing background:', {
      complete: bgImg.complete,
      naturalWidth: bgImg.naturalWidth,
      naturalHeight: bgImg.naturalHeight,
      src: bgImg.src
    });
    
    if (bgImg.complete && bgImg.naturalWidth > 0) {
      const mapWidth = WORLD_WIDTH;
      const mapHeight = WORLD_HEIGHT;
      const screenPos = worldToScreen(-mapWidth / 2, -mapHeight / 2);
      const screenWidth = mapWidth * PHYSICS_SCALE * gameState.camera.zoom;
      const screenHeight = mapHeight * PHYSICS_SCALE * gameState.camera.zoom;
      
      console.log('Drawing map at:', screenPos, 'size:', screenWidth, 'x', screenHeight);
      ctx.drawImage(bgImg, screenPos.x, screenPos.y, screenWidth, screenHeight);
    } else {
      // Fallback gradient with visible indication
      console.log('Using fallback background - map not loaded');
      const gradient = ctx.createLinearGradient(0, 0, 0, canvasHeight);
      gradient.addColorStop(0, '#87CEEB');
      gradient.addColorStop(1, '#90EE90');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
      
      // Add text to show it's fallback
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.font = '20px system-ui';
      ctx.fillText('Loading map.png...', 50, 50);
    }
  }
  
  function drawGround() {
    ctx.fillStyle = 'rgba(139, 90, 43, 0.7)';
    ctx.strokeStyle = 'rgba(101, 67, 33, 0.9)';
    ctx.lineWidth = 2;
    
    groundBodies.forEach(ground => {
      const pos = worldToScreen(ground.x - ground.width / 2, ground.y - ground.height / 2);
      const width = ground.width * PHYSICS_SCALE * gameState.camera.zoom;
      const height = ground.height * PHYSICS_SCALE * gameState.camera.zoom;
      
      ctx.fillRect(pos.x, pos.y, width, height);
      ctx.strokeRect(pos.x, pos.y, width, height);
    });
  }
  
  function drawAircraft() {
    const pos = aircraftBody.getPosition();
    const angle = aircraftBody.getAngle();
    const screenPos = worldToScreen(pos.x, pos.y);
    
    ctx.save();
    ctx.translate(screenPos.x, screenPos.y);
    ctx.rotate(angle);
    
    if (images.spitfire.complete && images.spitfire.naturalWidth > 0) {
      const scale = 0.3 * gameState.camera.zoom;
      const width = images.spitfire.naturalWidth * scale;
      const height = images.spitfire.naturalHeight * scale;
      ctx.drawImage(images.spitfire, -width / 2, -height / 2, width, height);
    } else {
      // Fallback rectangle
      ctx.fillStyle = '#4169E1';
      ctx.strokeStyle = '#000080';
      ctx.lineWidth = 2;
      const size = 15 * gameState.camera.zoom;
      ctx.fillRect(-size, -size / 3, size * 2, size * 2 / 3);
      ctx.strokeRect(-size, -size / 3, size * 2, size * 2 / 3);
    }
    
    ctx.restore();
  }
  
  function updateHUD() {
    const vel = aircraftBody.getLinearVelocity();
    const pos = aircraftBody.getPosition();
    const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
    
    document.getElementById('speed').textContent = Math.round(speed);
    document.getElementById('throttle').textContent = Math.round(gameState.throttle * 100);
    document.getElementById('altitude').textContent = Math.round(Math.max(0, 700 - pos.y));
    document.getElementById('zoom').textContent = gameState.camera.zoom.toFixed(1);
  }
  
  function updateCamera() {
    const pos = aircraftBody.getPosition();
    gameState.camera.x = pos.x;
    gameState.camera.y = pos.y;
  }
  
  // =============================================================================
  // GAME LOOP
  // =============================================================================
  
  let lastTime = performance.now();
  const fixedTimeStep = 1 / 60;
  let accumulator = 0;
  
  function gameLoop(currentTime) {
    const deltaTime = Math.min((currentTime - lastTime) / 1000, 0.05);
    lastTime = currentTime;
    accumulator += deltaTime;
    
    // Fixed timestep physics
    while (accumulator >= fixedTimeStep) {
      updateAircraftPhysics(fixedTimeStep);
      world.step(fixedTimeStep);
      accumulator -= fixedTimeStep;
    }
    
    updateCamera();
    
    // Clear and render
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    drawBackground();
    drawGround();
    drawAircraft();
    updateHUD();
    
    requestAnimationFrame(gameLoop);
  }
  
  // Start the game
  console.log('Starting flight simulator...');
  gameLoop(performance.now());
  
})();