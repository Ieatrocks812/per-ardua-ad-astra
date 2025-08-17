// Save System Module - Handles game progression persistence
(function() {
  'use strict';
  
  const SAVE_KEY = 'perArduaAdAstra_saveData';
  const SAVE_VERSION = '1.0.0';
  
  // Default save state for new players
  const DEFAULT_SAVE = {
    version: SAVE_VERSION,
    campaign: {
      currentMission: 'M01_Tutorial',
      lastCompletedMission: null,
      missionsCompleted: [],
      endlessUnlocked: false
    },
    player: {
      tokens: 0,
      totalKills: 0,
      totalDeaths: 0,
      totalMissionTime: 0,
      highScores: {
        endless: {
          survivalTime: 0,
          kills: 0,
          score: 0
        }
      }
    },
    upgrades: {
      bubble_canopy: false,
      pressurized_cockpit: false,
      engine_upgrade: false
    },
    modifications: {
      unlocked: ['8x303', 'armor_more', 'armor_less', 'drop_tank'],
      equipped: '8x303'
    },
    passives: {
      enemy_identification: {
        unlocked: false,
        enabled: true
      }
    },
    settings: {
      soundEnabled: true,
      musicVolume: 0.5,
      sfxVolume: 0.7,
      difficulty: 'normal'
    },
    statistics: {
      missionsPlayed: 0,
      missionsWon: 0,
      missionsFailed: 0,
      enemiesDestroyed: {
        bf109: 0,
        ju88: 0,
        ace: 0,
        total: 0
      },
      damageDealt: 0,
      damageTaken: 0,
      shotsFired: 0,
      shotsHit: 0,
      accuracy: 0,
      flightTime: 0
    }
  };
  
  class SaveSystem {
    constructor() {
      this.saveData = null;
      this.autoSaveInterval = null;
      this.isDirty = false;
      this.init();
    }
    
    init() {
      this.load();
      this.startAutoSave();
      console.log('💾 Save system initialized');
    }
    
    // Load save data from localStorage
    load() {
      try {
        const savedString = localStorage.getItem(SAVE_KEY);
        if (savedString) {
          const parsed = JSON.parse(savedString);
          
          // Check version compatibility
          if (parsed.version !== SAVE_VERSION) {
            console.log('⚠️ Save version mismatch, migrating...');
            this.saveData = this.migrateSave(parsed);
          } else {
            this.saveData = parsed;
          }
          
          console.log('✅ Save data loaded:', this.saveData);
        } else {
          // No save found, create new
          this.saveData = JSON.parse(JSON.stringify(DEFAULT_SAVE));
          this.save();
          console.log('📝 New save created');
        }
      } catch (error) {
        console.error('❌ Failed to load save:', error);
        this.saveData = JSON.parse(JSON.stringify(DEFAULT_SAVE));
      }
      
      return this.saveData;
    }
    
    // Save data to localStorage
    save() {
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(this.saveData));
        this.isDirty = false;
        console.log('💾 Game saved');
        return true;
      } catch (error) {
        console.error('❌ Failed to save:', error);
        return false;
      }
    }
    
    // Auto-save every 30 seconds if data has changed
    startAutoSave() {
      this.autoSaveInterval = setInterval(() => {
        if (this.isDirty) {
          this.save();
        }
      }, 30000);
    }
    
    stopAutoSave() {
      if (this.autoSaveInterval) {
        clearInterval(this.autoSaveInterval);
        this.autoSaveInterval = null;
      }
    }
    
    // Mark data as changed
    markDirty() {
      this.isDirty = true;
    }
    
    // Migrate old save versions to current
    migrateSave(oldSave) {
      // Deep merge with defaults to add any new fields
      const migrated = JSON.parse(JSON.stringify(DEFAULT_SAVE));
      
      // Preserve existing data
      if (oldSave.campaign) Object.assign(migrated.campaign, oldSave.campaign);
      if (oldSave.player) Object.assign(migrated.player, oldSave.player);
      if (oldSave.upgrades) Object.assign(migrated.upgrades, oldSave.upgrades);
      if (oldSave.modifications) Object.assign(migrated.modifications, oldSave.modifications);
      if (oldSave.passives) Object.assign(migrated.passives, oldSave.passives);
      if (oldSave.settings) Object.assign(migrated.settings, oldSave.settings);
      if (oldSave.statistics) Object.assign(migrated.statistics, oldSave.statistics);
      
      migrated.version = SAVE_VERSION;
      return migrated;
    }
    
    // Reset save to defaults
    reset() {
      if (confirm('Are you sure you want to reset all progress? This cannot be undone!')) {
        this.saveData = JSON.parse(JSON.stringify(DEFAULT_SAVE));
        this.save();
        console.log('🔄 Save reset to defaults');
        return true;
      }
      return false;
    }
    
    // Export save as JSON string
    exportSave() {
      return JSON.stringify(this.saveData, null, 2);
    }
    
    // Import save from JSON string
    importSave(jsonString) {
      try {
        const imported = JSON.parse(jsonString);
        if (imported.version) {
          this.saveData = this.migrateSave(imported);
          this.save();
          console.log('📥 Save imported successfully');
          return true;
        }
      } catch (error) {
        console.error('❌ Failed to import save:', error);
      }
      return false;
    }
    
    // === Mission Progress Methods ===
    
    completeMission(missionId, rewards) {
      if (!this.saveData.campaign.missionsCompleted.includes(missionId)) {
        this.saveData.campaign.missionsCompleted.push(missionId);
      }
      
      this.saveData.campaign.lastCompletedMission = missionId;
      
      // Apply rewards
      if (rewards) {
        if (rewards.tokens) {
          this.addTokens(rewards.tokens);
        }
        if (rewards.passive) {
          this.unlockPassive(rewards.passive);
        }
        if (rewards.mods) {
          rewards.mods.forEach(mod => this.unlockModification(mod));
        }
        if (rewards.unlockNext) {
          this.saveData.campaign.currentMission = rewards.unlockNext;
        }
        if (rewards.unlockNext === 'endless_mode') {
          this.saveData.campaign.endlessUnlocked = true;
        }
      }
      
      this.saveData.statistics.missionsPlayed++;
      this.saveData.statistics.missionsWon++;
      
      this.markDirty();
      this.save();
    }
    
    failMission(missionId) {
      this.saveData.statistics.missionsPlayed++;
      this.saveData.statistics.missionsFailed++;
      this.saveData.player.totalDeaths++;
      this.markDirty();
    }
    
    // === Currency Methods ===
    
    addTokens(amount) {
      this.saveData.player.tokens += amount;
      this.markDirty();
    }
    
    spendTokens(amount) {
      if (this.saveData.player.tokens >= amount) {
        this.saveData.player.tokens -= amount;
        this.markDirty();
        return true;
      }
      return false;
    }
    
    getTokens() {
      return this.saveData.player.tokens;
    }
    
    // === Upgrade Methods ===
    
    purchaseUpgrade(upgradeId, cost) {
      if (this.spendTokens(cost)) {
        this.saveData.upgrades[upgradeId] = true;
        this.markDirty();
        this.save();
        console.log(`✅ Purchased upgrade: ${upgradeId}`);
        return true;
      }
      console.log(`❌ Not enough tokens for upgrade: ${upgradeId}`);
      return false;
    }
    
    hasUpgrade(upgradeId) {
      return this.saveData.upgrades[upgradeId] === true;
    }
    
    getUpgrades() {
      return this.saveData.upgrades;
    }
    
    // === Modification Methods ===
    
    unlockModification(modId) {
      if (!this.saveData.modifications.unlocked.includes(modId)) {
        this.saveData.modifications.unlocked.push(modId);
        this.markDirty();
        console.log(`🔓 Unlocked modification: ${modId}`);
      }
    }
    
    equipModification(modId) {
      if (this.saveData.modifications.unlocked.includes(modId)) {
        this.saveData.modifications.equipped = modId;
        this.markDirty();
        console.log(`🔧 Equipped modification: ${modId}`);
        return true;
      }
      return false;
    }
    
    getEquippedModification() {
      return this.saveData.modifications.equipped;
    }
    
    getUnlockedModifications() {
      return this.saveData.modifications.unlocked;
    }
    
    // === Passive Methods ===
    
    unlockPassive(passiveId) {
      if (this.saveData.passives[passiveId]) {
        this.saveData.passives[passiveId].unlocked = true;
        this.markDirty();
        console.log(`🔓 Unlocked passive: ${passiveId}`);
      }
    }
    
    togglePassive(passiveId) {
      if (this.saveData.passives[passiveId] && this.saveData.passives[passiveId].unlocked) {
        this.saveData.passives[passiveId].enabled = !this.saveData.passives[passiveId].enabled;
        this.markDirty();
        return this.saveData.passives[passiveId].enabled;
      }
      return false;
    }
    
    isPassiveEnabled(passiveId) {
      const passive = this.saveData.passives[passiveId];
      return passive && passive.unlocked && passive.enabled;
    }
    
    // === Statistics Methods ===
    
    updateStatistics(stats) {
      Object.keys(stats).forEach(key => {
        if (key === 'enemiesDestroyed') {
          Object.keys(stats.enemiesDestroyed).forEach(enemyType => {
            this.saveData.statistics.enemiesDestroyed[enemyType] += stats.enemiesDestroyed[enemyType];
          });
        } else if (typeof this.saveData.statistics[key] === 'number') {
          this.saveData.statistics[key] += stats[key];
        }
      });
      
      // Calculate accuracy
      if (this.saveData.statistics.shotsFired > 0) {
        this.saveData.statistics.accuracy = 
          (this.saveData.statistics.shotsHit / this.saveData.statistics.shotsFired) * 100;
      }
      
      this.markDirty();
    }
    
    updateEndlessHighScore(survivalTime, kills) {
      const score = Math.floor(survivalTime + kills * 100);
      const highScores = this.saveData.player.highScores.endless;
      
      let newRecord = false;
      if (score > highScores.score) {
        highScores.score = score;
        highScores.survivalTime = survivalTime;
        highScores.kills = kills;
        newRecord = true;
        this.markDirty();
        this.save();
      }
      
      return { score, newRecord };
    }
    
    // === Settings Methods ===
    
    updateSettings(settings) {
      Object.assign(this.saveData.settings, settings);
      this.markDirty();
    }
    
    getSettings() {
      return this.saveData.settings;
    }
    
    // === Mission Access ===
    
    isMissionUnlocked(missionId) {
      // Tutorial is always unlocked
      if (missionId === 'M01_Tutorial') return true;
      
      // Check if this is the current mission
      if (this.saveData.campaign.currentMission === missionId) return true;
      
      // Check if already completed
      if (this.saveData.campaign.missionsCompleted.includes(missionId)) return true;
      
      // Endless mode check
      if (missionId === 'endless_survival') {
        return this.saveData.campaign.endlessUnlocked;
      }
      
      return false;
    }
    
    getCurrentMission() {
      return this.saveData.campaign.currentMission;
    }
    
    // === Debug Methods ===
    
    unlockAll() {
      // Unlock all missions
      this.saveData.campaign.missionsCompleted = [
        'M01_Tutorial', 'M02_Scouting', 'M03_Defense_1', 
        'M04_Defense_2_Ace', 'M05_Patrol', 'M06_Defense_3'
      ];
      this.saveData.campaign.endlessUnlocked = true;
      
      // Give tokens
      this.saveData.player.tokens = 99;
      
      // Unlock all modifications
      this.saveData.modifications.unlocked = [
        '8x303', '2x20mm_4x303', '4x20mm',
        'armor_more', 'armor_less', 'drop_tank'
      ];
      
      // Unlock passive
      this.saveData.passives.enemy_identification.unlocked = true;
      
      this.markDirty();
      this.save();
      console.log('🎮 All content unlocked (debug)');
    }
    
    giveTokens(amount) {
      this.addTokens(amount);
      this.save();
      console.log(`💰 Added ${amount} tokens (debug)`);
    }
  }
  
  // Create singleton instance
  window.saveSystem = new SaveSystem();
  
  // Expose class for testing
  window.SaveSystem = SaveSystem;
  
  console.log('💾 Save system module loaded');
})();
