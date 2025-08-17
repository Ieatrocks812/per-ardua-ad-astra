// Projectiles module
(function(){
  function initProjectiles(){
    // Expose state on window so other modules can inspect if needed
    window.lastFireTime = 0;
    window.shotCounter = 0; // Dedicated counter for tracer pattern

    // Expect window.fireRate to be optionally overridden before init
    const defaultFireRate = 9000; // rounds per minute (8×.303 Brownings = ~150 rounds per second combined)
    window.fireRate = window.fireRate || defaultFireRate;
    window.fireInterval = 60000 / window.fireRate; // ms between shots

    // Projectile size settings (world units - stays same relative to plane/map regardless of zoom)
    window.BULLET_SIZE = window.BULLET_SIZE || 5;
    window.TRACER_LENGTH = window.TRACER_LENGTH || 2.0;
    window.TRACER_WIDTH = window.TRACER_WIDTH || 0.2;
    window.CASING_SIZE = window.CASING_SIZE || 3;

    // Define API
    window.trySpawnGuns = function trySpawnGuns(){
      const now = performance.now();
      if (now - window.lastFireTime < window.fireInterval) return;
      window.lastFireTime = now;

      const aircraft = window.aircraft;
      const pl = window.planck || window.pl;
      if (!aircraft || !pl) return;

      const pos = aircraft.getPosition();
      const angle = aircraft.getAngle();
      const vel = aircraft.getLinearVelocity();

      // Center gun position (front of plane)
      const gunForward = 2.0; // physics units
      const gunPos = {
        x: pos.x + Math.cos(angle) * gunForward,
        y: pos.y + Math.sin(angle) * gunForward
      };

      const muzzleVelocity = 400; // m/s in physics units
      const bulletVel = {
        x: vel.x + Math.cos(angle) * muzzleVelocity,
        y: vel.y + Math.sin(angle) * muzzleVelocity
      };

      // Tracer pattern: 3 bullets then 1 tracer
      window.shotCounter++;
      const isTracer = window.shotCounter % 4 === 0;

      if (!window.game) window.game = {};
      if (!window.game.projectiles) window.game.projectiles = [];
      if (!window.game.casings) window.game.casings = [];

      window.game.projectiles.push({
        x: gunPos.x, y: gunPos.y, vx: bulletVel.x, vy: bulletVel.y,
        type: isTracer ? 'tracer' : 'bullet', life: 5.0,
        initialSpeed: Math.sqrt(bulletVel.x * bulletVel.x + bulletVel.y * bulletVel.y)
      });

      // Spawn casing
      const casingEject = { x: pos.x, y: pos.y + 0.5 };
      window.game.casings.push({
        x: casingEject.x, y: casingEject.y, vx: vel.x + (Math.random()-0.5)*2, vy: vel.y + 1,
        rotation: Math.random() * Math.PI, rotVel: (Math.random()-0.5)*2, life: 3.0
      });
    };

    function updateProjectiles(dt){
      if (!window.game) return;
      const SCALE = window.SCALE || 40;
      // Update bullets and tracers
      for (let i = window.game.projectiles.length - 1; i >= 0; i--) {
        const proj = window.game.projectiles[i];
        // Gravity (bullet drop) for bullets and tracers
        if (proj.type === 'bullet' || proj.type === 'tracer') {
          // World uses y+ downward; apply positive gravity
          proj.vy += 9.81 * dt;
        }

        // Drag (speed-reducing, creates arc with gravity)
        const speed = Math.sqrt(proj.vx * proj.vx + proj.vy * proj.vy);
        const dragCoeff = 0.02;
        const drag = dragCoeff * speed;
        if (speed > 0) {
          proj.vx -= (proj.vx / speed) * drag * dt;
          proj.vy -= (proj.vy / speed) * drag * dt;
        }
        proj.x += proj.vx * dt;
        proj.y += proj.vy * dt;
        proj.life -= dt;
        if (proj.life <= 0) window.game.projectiles.splice(i, 1);
      }

      // Update casings
      for (let i = window.game.casings.length - 1; i >= 0; i--) {
        const casing = window.game.casings[i];
        casing.vy += 9.81 * dt;
        const speed = Math.sqrt((casing.vx||0) * (casing.vx||0) + (casing.vy||0) * (casing.vy||0));
        const dragCoeff = 0.8;
        const drag = dragCoeff * speed;
        if (speed > 0) {
          casing.vx -= (casing.vx / speed) * drag * dt;
          casing.vy -= (casing.vy / speed) * drag * dt;
        }
        casing.x += (casing.vx||0) * dt;
        casing.y += (casing.vy||0) * dt;
        casing.rotation += (casing.rotVel||0) * dt;
        casing.life -= dt;
        if (casing.life <= 0) window.game.casings.splice(i, 1);
      }
    }

    // Expose symbol globally so index.html can call it directly
    window.updateProjectiles = updateProjectiles;
  }

  // Export initializer
  window.initProjectiles = initProjectiles;
})();


