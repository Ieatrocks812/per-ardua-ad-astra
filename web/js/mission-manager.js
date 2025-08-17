// Mission Manager Module - Handles mission loading, objectives, and state
(function() {
  'use strict';
  
  class MissionManager {
    constructor() {
      this.currentMission = null;
      this.missionData = null;
      this.missionState = {
        active: false,
        startTime: 0,
        elapsedTime: 0,
        waves: [],
        currentWaveIndex: 0,
        objectives: {},
        enemiesSpawned: [],
        enemiesDestroyed: 0,
        dialogueQueue: [],
        status: 'inactive' // inactive, briefing, active, completed, failed
      };
      
      this.loadMissionData();
    }
    
    async loadMissionData() {
      try {
        const response = await fetch('./data/missions.json');
        this.missionData = await response.json();
        console.log('📋 Mission data loaded');
      } catch (error) {
        console.error('❌ Failed to load mission data:', error);
      }
    }
    
    // Start a mission by ID
    async startMission(missionId) {
      if (!this.missionData) {
        await this.loadMissionData();
      }
      
      const mission = this.missionData.missions.find(m => m.id === missionId);
      if (!mission) {
        console.error(`❌ Mission not found: ${missionId}`);
        return false;
      }
      
      this.currentMission = mission;
      this.resetMissionState();
      this.initializeObjectives();
      this.prepareMissionWaves();
      
      console.log(`🎮 Starting mission: ${mission.name}`);
      this.missionState.status = 'active';
      this.missionState.active = true;
      this.missionState.startTime = performance.now();
      
      // Queue initial dialogue
      if (mission.dialogue && mission.dialogue.pre) {
        this.queueDialogue(mission.dialogue.pre);
      }
      
      return true;
    }
    
    // Reset mission state
    resetMissionState() {
      this.missionState = {
        active: false,
        startTime: 0,
        elapsedTime: 0,
        waves: [],
        currentWaveIndex: 0,
        objectives: {},
        enemiesSpawned: [],
        enemiesDestroyed: 0,
        dialogueQueue: [],
        status: 'inactive',
        convoyHealth: 1.0,
        airfieldHealth: 1.0,
        bombersEscaped: 0,
        killCount: {
          total: 0,
          bf109: 0,
          ju88: 0,
          ace: 0,
          training_dummy: 0
        }
      };
    }
    
    // Initialize mission objectives based on win conditions
    initializeObjectives() {
      const win = this.currentMission.win;
      const objectives = {};
      
      switch (win.type) {
        case 'destroy_targets':
          objectives.primary = {
            type: 'destroy_targets',
            description: `Destroy ${win.count} ${win.targets.join(', ')}`,
            current: 0,
            target: win.count,
            targetTypes: win.targets,
            completed: false
          };
          break;
          
        case 'survive':
          objectives.primary = {
            type: 'survive',
            description: `Survive for ${win.time} seconds`,
            current: 0,
            target: win.time,
            completed: false
          };
          break;
          
        case 'protect':
          objectives.primary = {
            type: 'protect',
            description: `Protect ${win.target} for ${win.time} seconds`,
            targetName: win.target,
            minHealth: win.minHealth || 0.5,
            timeTarget: win.time,
            completed: false
          };
          break;
          
        case 'destroy_count':
          objectives.primary = {
            type: 'destroy_count',
            description: `Destroy ${win.count} enemies`,
            current: 0,
            target: win.count,
            completed: false
          };
          break;
          
        case 'destroy_bombers':
          objectives.primary = {
            type: 'destroy_bombers',
            description: `Destroy ${win.count} bombers`,
            current: 0,
            target: win.count,
            completed: false
          };
          break;
          
        case 'survive_waves':
          objectives.primary = {
            type: 'survive_waves',
            description: `Survive ${win.waves} waves`,
            current: 0,
            target: win.waves,
            completed: false
          };
          break;
      }
      
      this.missionState.objectives = objectives;
    }
    
    // Prepare mission waves for spawning
    prepareMissionWaves() {
      this.missionState.waves = this.currentMission.waves.map(wave => ({
        ...wave,
        spawned: false,
        triggerTime: wave.t * 1000 // Convert to milliseconds
      }));
      
      // Add ace spawn if present
      if (this.currentMission.ace) {
        const aceWave = {
          ...this.currentMission.ace,
          spawned: false,
          triggerTime: this.currentMission.ace.t * 1000,
          isAce: true
        };
        this.missionState.waves.push(aceWave);
      }
      
      // Sort waves by trigger time
      this.missionState.waves.sort((a, b) => a.triggerTime - b.triggerTime);
    }
    
    // Update mission state each frame
    update(dt) {
      if (!this.missionState.active) return;
      
      this.missionState.elapsedTime += dt * 1000; // Convert to milliseconds
      
      // Check for wave spawns
      this.checkWaveSpawns();
      
      // Update objectives
      this.updateObjectives();
      
      // Check win/lose conditions
      this.checkMissionStatus();
      
      // Process dialogue queue
      this.processDialogue();
    }
    
    // Check if it's time to spawn enemy waves
    checkWaveSpawns() {
      const currentTime = this.missionState.elapsedTime;
      
      for (let wave of this.missionState.waves) {
        if (!wave.spawned && currentTime >= wave.triggerTime) {
          // Check for conditional triggers
          if (wave.trigger) {
            if (!this.checkTriggerCondition(wave.trigger)) {
              continue;
            }
          }
          
          this.spawnWave(wave);
          wave.spawned = true;
        }
      }
    }
    
    // Check conditional trigger
    checkTriggerCondition(trigger) {
      switch (trigger) {
        case 'convoy_health_below_50':
          return this.missionState.convoyHealth < 0.5;
        case 'airfield_health_below_30':
          return this.missionState.airfieldHealth < 0.3;
        default:
          return true;
      }
    }
    
    // Spawn enemy wave
    spawnWave(wave) {
      console.log(`🚁 Spawning wave:`, wave);
      
      // Queue mid-mission dialogue if this is a significant wave
      if (this.missionState.currentWaveIndex === 0 && this.currentMission.dialogue?.mid) {
        this.queueDialogue(this.currentMission.dialogue.mid);
      }
      
      if (wave.isAce) {
        this.spawnAce(wave);
      } else if (wave.group) {
        this.spawnGroup(wave.group);
      }
      
      this.missionState.currentWaveIndex++;
    }
    
    // Spawn enemy group
    spawnGroup(group) {
      const spawnData = {
        type: group.type,
        count: group.n,
        from: group.from,
        altitude: group.alt,
        formation: group.formation,
        behavior: group.behavior || 'default',
        target: group.target,
        timestamp: this.missionState.elapsedTime
      };
      
      // Emit spawn event for the game to handle
      if (window.game && window.game.spawnEnemies) {
        window.game.spawnEnemies(spawnData);
      }
      
      // Track spawned enemies
      for (let i = 0; i < group.n; i++) {
        this.missionState.enemiesSpawned.push({
          type: group.type,
          spawnTime: this.missionState.elapsedTime
        });
      }
    }
    
    // Spawn ace enemy
    spawnAce(ace) {
      const spawnData = {
        type: 'ace',
        aceType: ace.type,
        name: ace.name,
        from: ace.from,
        altitude: ace.alt,
        buffs: ace.buffs,
        timestamp: this.missionState.elapsedTime
      };
      
      // Emit ace spawn event
      if (window.game && window.game.spawnAce) {
        window.game.spawnAce(spawnData);
      }
      
      this.missionState.enemiesSpawned.push({
        type: 'ace',
        name: ace.name,
        spawnTime: this.missionState.elapsedTime
      });
      
      // Queue ace encounter dialogue
      this.queueDialogue([`Wingman: That's ${ace.name}! Watch yourself!`]);
    }
    
    // Update mission objectives
    updateObjectives() {
      const primary = this.missionState.objectives.primary;
      if (!primary || primary.completed) return;
      
      switch (primary.type) {
        case 'survive':
        case 'protect':
          primary.current = Math.floor(this.missionState.elapsedTime / 1000);
          if (primary.current >= primary.target || primary.current >= primary.timeTarget) {
            primary.completed = true;
          }
          break;
          
        case 'destroy_targets':
          // Handle specific target types like training dummies
          if (primary.targetTypes && primary.targetTypes.includes('training_dummy')) {
            primary.current = this.missionState.killCount.training_dummy || 0;
          } else {
            primary.current = this.missionState.killCount.total;
          }
          if (primary.current >= primary.target) {
            primary.completed = true;
          }
          break;
          
        case 'destroy_count':
          primary.current = this.missionState.killCount.total;
          if (primary.current >= primary.target) {
            primary.completed = true;
          }
          break;
          
        case 'destroy_bombers':
          primary.current = this.missionState.killCount.ju88;
          if (primary.current >= primary.target) {
            primary.completed = true;
          }
          break;
          
        case 'survive_waves':
          primary.current = Math.floor(this.missionState.currentWaveIndex / 3);
          if (primary.current >= primary.target) {
            primary.completed = true;
          }
          break;
      }
    }
    
    // Check mission win/lose conditions
    checkMissionStatus() {
      // Check win conditions
      const primary = this.missionState.objectives.primary;
      if (primary && primary.completed) {
        this.completeMission();
        return;
      }
      
      // Check lose conditions
      for (let condition of this.currentMission.lose) {
        if (this.checkLoseCondition(condition)) {
          this.failMission(condition.type);
          return;
        }
      }
    }
    
    // Check individual lose condition
    checkLoseCondition(condition) {
      switch (condition.type) {
        case 'player_dead':
          return window.game && window.game.player && window.game.player.health <= 0;
          
        case 'target_destroyed':
          if (condition.target === 'convoy') {
            return this.missionState.convoyHealth <= 0;
          } else if (condition.target === 'airfield') {
            return this.missionState.airfieldHealth <= 0;
          }
          break;
          
        case 'time_up':
          return this.missionState.elapsedTime > this.currentMission.win.time * 1000;
          
        case 'bombers_escaped':
          return this.missionState.bombersEscaped > condition.maxEscaped;
          
        case 'london_destroyed':
          return this.missionState.londonHealth <= 0;
      }
      
      return false;
    }
    
    // Complete mission successfully
    completeMission() {
      if (this.missionState.status === 'completed') return;
      
      console.log(`✅ Mission completed: ${this.currentMission.name}`);
      this.missionState.status = 'completed';
      this.missionState.active = false;
      
      // Queue completion dialogue
      if (this.currentMission.dialogue?.post) {
        this.queueDialogue(this.currentMission.dialogue.post);
      }
      
      // Save progress and apply rewards
      if (window.saveSystem) {
        window.saveSystem.completeMission(this.currentMission.id, this.currentMission.rewards);
      }
      
      // Trigger debrief screen
      if (window.game && window.game.showDebrief) {
        setTimeout(() => {
          window.game.showDebrief({
            missionId: this.currentMission.id,
            missionName: this.currentMission.name,
            success: true,
            rewards: this.currentMission.rewards,
            stats: {
              time: Math.floor(this.missionState.elapsedTime / 1000),
              kills: this.missionState.killCount,
              accuracy: window.game.player ? window.game.player.accuracy : 0
            }
          });
        }, 3000);
      }
    }
    
    // Fail mission
    failMission(reason) {
      if (this.missionState.status === 'failed') return;
      
      console.log(`❌ Mission failed: ${reason}`);
      this.missionState.status = 'failed';
      this.missionState.active = false;
      
      // Save failure
      if (window.saveSystem) {
        window.saveSystem.failMission(this.currentMission.id);
      }
      
      // Show failure screen
      if (window.game && window.game.showDebrief) {
        setTimeout(() => {
          window.game.showDebrief({
            missionId: this.currentMission.id,
            missionName: this.currentMission.name,
            success: false,
            failReason: reason,
            stats: {
              time: Math.floor(this.missionState.elapsedTime / 1000),
              kills: this.missionState.killCount
            }
          });
        }, 2000);
      }
    }
    
    // Handle enemy destroyed
    onEnemyDestroyed(enemyType) {
      this.missionState.enemiesDestroyed++;
      this.missionState.killCount.total++;
      
      if (enemyType === 'bf109') {
        this.missionState.killCount.bf109++;
      } else if (enemyType === 'ju88') {
        this.missionState.killCount.ju88++;
      } else if (enemyType === 'ace') {
        this.missionState.killCount.ace++;
      } else if (enemyType === 'training_dummy') {
        this.missionState.killCount.training_dummy = (this.missionState.killCount.training_dummy || 0) + 1;
        console.log(`🎯 Training dummy destroyed! Total: ${this.missionState.killCount.training_dummy}/3`);
      }
      
      // Update statistics
      if (window.saveSystem) {
        window.saveSystem.updateStatistics({
          enemiesDestroyed: { [enemyType]: 1, total: 1 }
        });
      }
    }
    
    // Handle convoy damage
    onConvoyDamaged(damage) {
      this.missionState.convoyHealth = Math.max(0, this.missionState.convoyHealth - damage);
    }
    
    // Handle airfield damage
    onAirfieldDamaged(damage) {
      this.missionState.airfieldHealth = Math.max(0, this.missionState.airfieldHealth - damage);
    }
    
    // Queue dialogue for display
    queueDialogue(lines) {
      if (Array.isArray(lines)) {
        this.missionState.dialogueQueue.push(...lines);
      } else {
        this.missionState.dialogueQueue.push(lines);
      }
    }
    
    // Process dialogue queue
    processDialogue() {
      if (this.missionState.dialogueQueue.length > 0 && window.game && window.game.showDialogue) {
        const line = this.missionState.dialogueQueue.shift();
        window.game.showDialogue(line);
      }
    }
    
    // Get current objective for HUD display
    getCurrentObjective() {
      return this.missionState.objectives.primary;
    }
    
    // Get mission time
    getMissionTime() {
      return Math.floor(this.missionState.elapsedTime / 1000);
    }
    
    // Check if mission is active
    isActive() {
      return this.missionState.active;
    }
    
    // Abort current mission
    abortMission() {
      console.log('🛑 Mission aborted');
      this.missionState.active = false;
      this.missionState.status = 'inactive';
      this.resetMissionState();
    }
  }
  
  // Create singleton instance
  window.missionManager = new MissionManager();
  
  console.log('🎯 Mission Manager module loaded');
})();
