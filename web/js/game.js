class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
    }

    preload() {
        // Load the Spitfire sprite (use one image and flip for direction)
        this.load.image('spitfire', '../assets/sprites/aircraft/player/Spitfire facing left.png');

        // Create generated assets (background + effects)
        this.createBackgroundAssets();
        this.createPlaceholderAssets();
    }

    createBackgroundAssets() {
        // Sky gradient texture
        const skyWidth = 2048;
        const skyHeight = 1024;
        const sky = this.add.graphics();
        const topColor = 0x5dade2;    // light blue
        const bottomColor = 0x2874a6; // deeper blue
        for (let i = 0; i < skyHeight; i++) {
            const t = i / skyHeight;
            const rTop = (topColor >> 16) & 0xff;
            const gTop = (topColor >> 8) & 0xff;
            const bTop = topColor & 0xff;
            const rBot = (bottomColor >> 16) & 0xff;
            const gBot = (bottomColor >> 8) & 0xff;
            const bBot = bottomColor & 0xff;
            const r = Math.round(rTop * (1 - t) + rBot * t);
            const g = Math.round(gTop * (1 - t) + gBot * t);
            const b = Math.round(bTop * (1 - t) + bBot * t);
            sky.fillStyle((r << 16) | (g << 8) | b, 1);
            sky.fillRect(0, i, skyWidth, 1);
        }
        sky.generateTexture('sky', skyWidth, skyHeight);
        sky.destroy();

        // Cloud tile texture
        const cloud = this.add.graphics();
        cloud.fillStyle(0xffffff, 0.6);
        cloud.fillCircle(40, 30, 20);
        cloud.fillCircle(60, 30, 24);
        cloud.fillCircle(80, 32, 18);
        cloud.fillCircle(55, 20, 16);
        cloud.generateTexture('cloud', 120, 64);
        cloud.destroy();
    }

    createPlaceholderAssets() {
        // Create bullet sprite
        this.add.graphics()
            .fillStyle(0xffff00)
            .fillRect(0, 0, 4, 2)
            .generateTexture('bullet', 4, 2);

        // Create muzzle flash sprite
        this.add.graphics()
            .fillStyle(0xff8800)
            .fillCircle(8, 8, 8)
            .fillStyle(0xffff00)
            .fillCircle(8, 8, 4)
            .generateTexture('muzzle-flash', 16, 16);

        // Create smoke trail sprite
        this.add.graphics()
            .fillStyle(0x666666)
            .fillCircle(4, 4, 4)
            .generateTexture('smoke', 8, 8);
    }

    create() {
        // Background layers
        this.add.image(0, 0, 'sky').setOrigin(0, 0).setScrollFactor(0);
        this.cloudsFar = this.add.tileSprite(0, 0, 2048, 1024, 'cloud').setOrigin(0, 0).setAlpha(0.25);
        this.cloudsFar.setScrollFactor(0.1);
        this.cloudsNear = this.add.tileSprite(0, 0, 2048, 1024, 'cloud').setOrigin(0, 0).setAlpha(0.4);
        this.cloudsNear.setScrollFactor(0.25);

        // Initialize physics groups
        this.bullets = this.physics.add.group();
        this.smokeTrails = this.physics.add.group();
        
        // Create player aircraft
        this.player = this.physics.add.sprite(400, 300, 'spitfire');
        // Base image faces left, flip to face right initially
        this.player.setFlipX(true);
        this.player.setCollideWorldBounds(true);
        this.player.setDrag(50); // Air resistance
        
        // Player physics properties
        this.playerData = {
            velocity: { x: 0, y: 0 },
            throttle: 0.5, // 0-1
            pitch: 0, // -1 to 1
            maxSpeed: 300,
            acceleration: 150,
            stallSpeed: 80,
            isStalled: false,
            stallTimer: 0,
            facingLeft: false,
            ammo: 300,
            lastFired: 0,
            fireRate: 100 // ms between shots
        };

        // Set up controls
        this.cursors = this.input.keyboard.createCursorKeys();
        this.keys = this.input.keyboard.addKeys('A,D,W,S,SPACE,F');

        // Set up world bounds
        this.physics.world.setBounds(0, 0, 2400, 1200);
        
        // Camera follows player
        this.cameras.main.startFollow(this.player);
        this.cameras.main.setBounds(0, 0, 2400, 1200);

        // HUD update timer
        this.time.addEvent({
            delay: 100,
            callback: this.updateHUD,
            callbackScope: this,
            loop: true
        });

        // Smoke trail timer
        this.time.addEvent({
            delay: 200,
            callback: this.createSmokeTrail,
            callbackScope: this,
            loop: true
        });
    }

    update(time, delta) {
        this.handleInput();
        this.updatePhysics(delta);
        this.updateStallMechanics(delta);
        this.updateBullets();
        this.updateSmokeTrails();

        // Parallax cloud movement
        const scrollX = this.cameras.main.scrollX;
        const scrollY = this.cameras.main.scrollY;
        this.cloudsFar.tilePositionX = scrollX * 0.1;
        this.cloudsFar.tilePositionY = scrollY * 0.05;
        this.cloudsNear.tilePositionX = scrollX * 0.25;
        this.cloudsNear.tilePositionY = scrollY * 0.12;
    }

    handleInput() {
        // Pitch control (A/D)
        if (this.keys.A.isDown) {
            this.playerData.pitch = Math.max(this.playerData.pitch - 0.05, -1);
        } else if (this.keys.D.isDown) {
            this.playerData.pitch = Math.min(this.playerData.pitch + 0.05, 1);
        } else {
            // Return to neutral
            this.playerData.pitch *= 0.9;
        }

        // Throttle control (W/S)
        if (this.keys.W.isDown) {
            this.playerData.throttle = Math.min(this.playerData.throttle + 0.02, 1);
        } else if (this.keys.S.isDown) {
            this.playerData.throttle = Math.max(this.playerData.throttle - 0.02, 0);
        }

        // Fire guns (SPACE)
        if (this.keys.SPACE.isDown) {
            this.fireWeapon();
        }

        // Roll recovery (F)
        if (this.keys.F.isDown && this.playerData.isStalled) {
            this.playerData.isStalled = false;
            this.playerData.stallTimer = 0;
        }
    }

    updatePhysics(delta) {
        const deltaSeconds = delta / 1000;
        
        // Calculate thrust vector based on aircraft facing and throttle
        const thrustPower = this.playerData.throttle * this.playerData.acceleration;
        
        // Apply pitch to change velocity direction
        if (!this.playerData.isStalled) {
            this.playerData.velocity.x += Math.cos(this.playerData.pitch * 0.5) * thrustPower * deltaSeconds;
            this.playerData.velocity.y += Math.sin(this.playerData.pitch * 0.5) * thrustPower * deltaSeconds;
        }

        // Apply gravity
        this.playerData.velocity.y += 30 * deltaSeconds;

        // Apply drag
        const speed = Math.sqrt(this.playerData.velocity.x ** 2 + this.playerData.velocity.y ** 2);
        if (speed > 0) {
            const dragCoeff = 0.98;
            this.playerData.velocity.x *= dragCoeff;
            this.playerData.velocity.y *= dragCoeff;
        }

        // Limit max speed
        if (speed > this.playerData.maxSpeed) {
            const ratio = this.playerData.maxSpeed / speed;
            this.playerData.velocity.x *= ratio;
            this.playerData.velocity.y *= ratio;
        }

        // Update sprite facing direction (flip image)
        if (this.playerData.velocity.x < -10 && !this.playerData.facingLeft) {
            this.player.setFlipX(false);
            this.playerData.facingLeft = true;
        } else if (this.playerData.velocity.x > 10 && this.playerData.facingLeft) {
            this.player.setFlipX(true);
            this.playerData.facingLeft = false;
        }

        // Apply velocity to sprite
        this.player.setVelocity(this.playerData.velocity.x, this.playerData.velocity.y);
        
        // Rotate sprite based on velocity direction for visual feedback
        const angle = Math.atan2(this.playerData.velocity.y, Math.abs(this.playerData.velocity.x)) * 0.3;
        this.player.setRotation(this.playerData.facingLeft ? -angle : angle);
    }

    updateStallMechanics(delta) {
        const speed = Math.sqrt(this.playerData.velocity.x ** 2 + this.playerData.velocity.y ** 2);
        const angleOfAttack = Math.abs(this.playerData.pitch);
        
        // Check for stall conditions
        if (speed < this.playerData.stallSpeed && angleOfAttack > 0.7) {
            this.playerData.stallTimer += delta;
            
            if (this.playerData.stallTimer > 400 && !this.playerData.isStalled) { // 0.4 seconds
                this.playerData.isStalled = true;
                this.player.setTint(0xff6666); // Visual indicator
            }
        } else {
            this.playerData.stallTimer = Math.max(0, this.playerData.stallTimer - delta * 2);
            
            if (this.playerData.isStalled && this.playerData.stallTimer <= 0) {
                this.playerData.isStalled = false;
                this.player.clearTint();
            }
        }

        // Stall effects
        if (this.playerData.isStalled) {
            // Nose drops, reduced control
            this.playerData.velocity.y += 50 * (delta / 1000);
            this.playerData.pitch *= 0.5; // Reduced control authority
        }
    }

    fireWeapon() {
        const currentTime = this.time.now;
        
        if (currentTime - this.playerData.lastFired > this.playerData.fireRate && this.playerData.ammo > 0) {
            this.playerData.lastFired = currentTime;
            this.playerData.ammo--;
            
            // Create bullet
            const bullet = this.bullets.create(this.player.x, this.player.y, 'bullet');
            
            // Set bullet velocity based on aircraft facing and velocity
            const fireDirection = this.playerData.facingLeft ? -1 : 1;
            const bulletSpeed = 500;
            
            bullet.setVelocity(
                this.playerData.velocity.x + (bulletSpeed * fireDirection),
                this.playerData.velocity.y
            );
            
            // Bullet lifetime
            this.time.delayedCall(2000, () => {
                if (bullet.active) bullet.destroy();
            });
            
            // Muzzle flash effect
            const flash = this.add.sprite(this.player.x, this.player.y, 'muzzle-flash');
            flash.setScale(0.5);
            this.time.delayedCall(50, () => flash.destroy());
            
            // Recoil effect
            this.playerData.velocity.x -= fireDirection * 2;
        }
    }

    createSmokeTrail() {
        if (this.playerData.throttle > 0.3) {
            const smoke = this.smokeTrails.create(
                this.player.x - (this.playerData.facingLeft ? 30 : -30), 
                this.player.y + 10, 
                'smoke'
            );
            smoke.setVelocity(
                this.playerData.velocity.x * 0.3 + (Math.random() - 0.5) * 20,
                this.playerData.velocity.y * 0.3 + (Math.random() - 0.5) * 20
            );
            smoke.setAlpha(0.6);
            
            // Fade out smoke
            this.tweens.add({
                targets: smoke,
                alpha: 0,
                scale: 2,
                duration: 2000,
                onComplete: () => smoke.destroy()
            });
        }
    }

    updateBullets() {
        this.bullets.children.entries.forEach(bullet => {
            // Remove bullets that go off screen
            if (bullet.x < -50 || bullet.x > 1250 || bullet.y < -50 || bullet.y > 850) {
                bullet.destroy();
            }
        });
    }

    updateSmokeTrails() {
        // Smoke trails are automatically cleaned up by their tweens
    }

    updateHUD() {
        const speed = Math.sqrt(this.playerData.velocity.x ** 2 + this.playerData.velocity.y ** 2);
        const altitude = Math.max(0, Math.round((600 - this.player.y) * 10)); // Rough altitude calculation
        
        document.getElementById('airspeed').textContent = Math.round(speed);
        document.getElementById('throttle').textContent = Math.round(this.playerData.throttle * 100);
        document.getElementById('altitude').textContent = altitude;
        document.getElementById('ammo').textContent = this.playerData.ammo;
    }
}

// Game configuration
const config = {
    type: Phaser.AUTO,
    width: 1024,
    height: 768,
    parent: 'game-container',
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 }, // We handle gravity manually
            debug: false
        }
    },
    scene: GameScene,
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    }
};

// Start the game
const game = new Phaser.Game(config);
