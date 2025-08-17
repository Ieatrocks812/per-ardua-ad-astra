// Upgrade System Module - Handles aircraft upgrades and modifications
(function() {
  'use strict';
  
  class UpgradeSystem {
    constructor() {
      this.upgradesData = null;
      this.modificationsData = null;
      this.currentLoadout = {
        modification: '8x303',
        upgrades: [],
        passive: null
      };
      
      this.loadData();
    }
    
    async loadData() {
      try {
        // Load upgrades data
        const upgradesResponse = await fetch('./web/data/upgrades.json');
        this.upgradesData = await upgradesResponse.json();
        
        // Load modifications data
        const modsResponse = await fetch('./web/data/modifications.json');
        this.modificationsData = await modsResponse.json();
        
        console.log('🔧 Upgrade system data loaded');
        
        // Sync with save system
        this.syncWithSave();
      } catch (error) {
        console.error('❌ Failed to load upgrade data:', error);
      }
    }
    
    // Sync upgrade states with save system
    syncWithSave() {
      if (!window.saveSystem) return;
      
      const saveData = window.saveSystem.saveData;
      
      // Sync upgrade purchase states
      Object.keys(this.upgradesData.upgrades).forEach(upgradeId => {
        this.upgradesData.upgrades[upgradeId].purchased = saveData.upgrades[upgradeId] || false;
      });
      
      // Sync passive unlock states
      Object.keys(this.upgradesData.passives).forEach(passiveId => {
        const savedPassive = saveData.passives[passiveId];
        if (savedPassive) {
          this.upgradesData.passives[passiveId].unlocked = savedPassive.unlocked;
          this.upgradesData.passives[passiveId].enabled = savedPassive.enabled;
        }
      });
      
      // Sync modification unlock states
      Object.keys(this.modificationsData.modifications).forEach(modId => {
        this.modificationsData.modifications[modId].unlocked = 
          saveData.modifications.unlocked.includes(modId);
      });
      
      // Set current loadout
      this.currentLoadout.modification = saveData.modifications.equipped;
    }
    
    // Get all upgrades
    getUpgrades() {
      return this.upgradesData?.upgrades || {};
    }
    
    // Get specific upgrade
    getUpgrade(upgradeId) {
      return this.upgradesData?.upgrades[upgradeId];
    }
    
    // Purchase an upgrade
    purchaseUpgrade(upgradeId) {
      const upgrade = this.getUpgrade(upgradeId);
      if (!upgrade) {
        console.error(`❌ Upgrade not found: ${upgradeId}`);
        return false;
      }
      
      if (upgrade.purchased) {
        console.log(`ℹ️ Upgrade already purchased: ${upgradeId}`);
        return false;
      }
      
      // Try to spend tokens
      if (window.saveSystem && window.saveSystem.purchaseUpgrade(upgradeId, upgrade.cost)) {
        upgrade.purchased = true;
        console.log(`✅ Purchased upgrade: ${upgrade.name}`);
        
        // Apply upgrade effects immediately
        this.applyUpgradeEffects(upgradeId);
        
        return true;
      }
      
      console.log(`❌ Not enough tokens for: ${upgrade.name}`);
      return false;
    }
    
    // Apply upgrade effects to player aircraft
    applyUpgradeEffects(upgradeId) {
      const upgrade = this.getUpgrade(upgradeId);
      if (!upgrade || !upgrade.purchased) return;
      
      // Apply effects to game state
      if (window.game && window.game.player) {
        const effects = upgrade.effects;
        const player = window.game.player;
        
        switch (upgradeId) {
          case 'bubble_canopy':
            // Reduce enemy highlight delay
            if (window.game.enemyHighlightDelay) {
              window.game.enemyHighlightDelay *= effects.enemyHighlightDelay;
            }
            break;
            
          case 'pressurized_cockpit':
            // Apply high altitude bonus
            player.highAltitudeBonus = effects.highAltitudeBonus;
            player.altitudeThreshold = effects.altitudeThreshold;
            break;
            
          case 'engine_upgrade':
            // Upgrade engine performance
            player.maxSpeed *= effects.topSpeed;
            player.acceleration *= effects.acceleration;
            player.climbRate *= effects.climbRate;
            break;
        }
      }
    }
    
    // Get all modifications
    getModifications() {
      return this.modificationsData?.modifications || {};
    }
    
    // Get specific modification
    getModification(modId) {
      return this.modificationsData?.modifications[modId];
    }
    
    // Get unlocked modifications
    getUnlockedModifications() {
      const mods = {};
      Object.keys(this.modificationsData?.modifications || {}).forEach(modId => {
        if (this.modificationsData.modifications[modId].unlocked) {
          mods[modId] = this.modificationsData.modifications[modId];
        }
      });
      return mods;
    }
    
    // Equip a modification
    equipModification(modId) {
      const mod = this.getModification(modId);
      if (!mod) {
        console.error(`❌ Modification not found: ${modId}`);
        return false;
      }
      
      if (!mod.unlocked) {
        console.error(`❌ Modification not unlocked: ${modId}`);
        return false;
      }
      
      // Save equipped modification
      if (window.saveSystem && window.saveSystem.equipModification(modId)) {
        this.currentLoadout.modification = modId;
        console.log(`🔧 Equipped modification: ${mod.name}`);
        
        // Apply modification effects
        this.applyModificationEffects(modId);
        
        return true;
      }
      
      return false;
    }
    
    // Apply modification effects to player aircraft
    applyModificationEffects(modId) {
      const mod = this.getModification(modId);
      if (!mod) return;
      
      if (window.game && window.game.player) {
        const player = window.game.player;
        const effects = mod.effects;
        
        // Reset to base values first
        this.resetModificationEffects();
        
        // Apply modification effects
        if (effects.speed) player.speedModifier = effects.speed;
        if (effects.turnRate) player.turnRateModifier = effects.turnRate;
        if (effects.weight) player.weightModifier = effects.weight;
        if (effects.handling) player.handlingModifier = effects.handling;
        if (effects.damageReduction) player.damageReduction = effects.damageReduction;
        if (effects.fuelCapacity) player.fuelCapacityModifier = effects.fuelCapacity;
        if (effects.dragPenalty) player.dragModifier = effects.dragPenalty;
        
        // Apply weapon configuration
        if (mod.weapons && mod.weapons !== 'default') {
          this.configureWeapons(mod.weapons);
        }
      }
    }
    
    // Reset modification effects to defaults
    resetModificationEffects() {
      if (window.game && window.game.player) {
        const player = window.game.player;
        player.speedModifier = 1.0;
        player.turnRateModifier = 1.0;
        player.weightModifier = 1.0;
        player.handlingModifier = 1.0;
        player.damageReduction = 1.0;
        player.fuelCapacityModifier = 1.0;
        player.dragModifier = 1.0;
      }
    }
    
    // Configure weapon system based on modification
    configureWeapons(weaponConfig) {
      if (!window.game) return;
      
      // Handle single weapon type
      if (weaponConfig.guns) {
        window.game.weaponConfig = {
          primary: {
            type: weaponConfig.caliber,
            count: weaponConfig.guns,
            rpm: weaponConfig.rpm,
            damage: weaponConfig.damage,
            spread: weaponConfig.spread,
            muzzleVelocity: weaponConfig.muzzleVelocity,
            tracerPattern: weaponConfig.tracerPattern,
            ammo: weaponConfig.ammo,
            currentAmmo: weaponConfig.ammo
          }
        };
      }
      
      // Handle mixed weapon types (cannons + machine guns)
      if (weaponConfig.cannons && weaponConfig.machineguns) {
        window.game.weaponConfig = {
          primary: {
            type: weaponConfig.cannons.caliber,
            count: weaponConfig.cannons.guns,
            rpm: weaponConfig.cannons.rpm,
            damage: weaponConfig.cannons.damage,
            spread: weaponConfig.cannons.spread,
            muzzleVelocity: weaponConfig.cannons.muzzleVelocity,
            tracerPattern: weaponConfig.cannons.tracerPattern,
            ammo: weaponConfig.cannons.ammo,
            currentAmmo: weaponConfig.cannons.ammo
          },
          secondary: {
            type: weaponConfig.machineguns.caliber,
            count: weaponConfig.machineguns.guns,
            rpm: weaponConfig.machineguns.rpm,
            damage: weaponConfig.machineguns.damage,
            spread: weaponConfig.machineguns.spread,
            muzzleVelocity: weaponConfig.machineguns.muzzleVelocity,
            tracerPattern: weaponConfig.machineguns.tracerPattern,
            ammo: weaponConfig.machineguns.ammo,
            currentAmmo: weaponConfig.machineguns.ammo
          }
        };
      }
      
      // Update fire rate for projectile system
      if (window.fireRate) {
        window.fireRate = weaponConfig.rpm || weaponConfig.guns?.rpm || 900;
        window.fireInterval = 60000 / window.fireRate;
      }
    }
    
    // Get passive abilities
    getPassives() {
      return this.upgradesData?.passives || {};
    }
    
    // Toggle passive ability
    togglePassive(passiveId) {
      const passive = this.upgradesData?.passives[passiveId];
      if (!passive || !passive.unlocked) {
        console.error(`❌ Passive not available: ${passiveId}`);
        return false;
      }
      
      // Toggle in save system
      if (window.saveSystem) {
        const newState = window.saveSystem.togglePassive(passiveId);
        passive.enabled = newState;
        
        // Apply/remove passive effects
        if (passiveId === 'enemy_identification') {
          this.toggleEnemyIdentification(newState);
        }
        
        console.log(`🔄 Passive ${passiveId} is now ${newState ? 'enabled' : 'disabled'}`);
        return newState;
      }
      
      return false;
    }
    
    // Toggle enemy identification visual effect
    toggleEnemyIdentification(enabled) {
      if (window.game) {
        window.game.enemyIdentificationEnabled = enabled;
      }
    }
    
    // Calculate total aircraft stats with all modifiers
    calculateAircraftStats() {
      const baseStats = {
        topSpeed: 560, // km/h
        acceleration: 15, // m/s²
        turnRate: 3.5, // deg/s
        climbRate: 15, // m/s
        armor: 100, // hp
        fuel: 100 // liters
      };
      
      const stats = { ...baseStats };
      
      // Apply upgrade modifiers
      Object.keys(this.upgradesData?.upgrades || {}).forEach(upgradeId => {
        const upgrade = this.upgradesData.upgrades[upgradeId];
        if (upgrade.purchased && upgrade.effects) {
          if (upgrade.effects.topSpeed) stats.topSpeed *= upgrade.effects.topSpeed;
          if (upgrade.effects.acceleration) stats.acceleration *= upgrade.effects.acceleration;
          if (upgrade.effects.climbRate) stats.climbRate *= upgrade.effects.climbRate;
        }
      });
      
      // Apply modification modifiers
      const currentMod = this.getModification(this.currentLoadout.modification);
      if (currentMod && currentMod.effects) {
        if (currentMod.effects.speed) stats.topSpeed *= currentMod.effects.speed;
        if (currentMod.effects.turnRate) stats.turnRate *= currentMod.effects.turnRate;
        if (currentMod.effects.fuelCapacity) stats.fuel *= currentMod.effects.fuelCapacity;
        if (currentMod.effects.damageReduction) {
          stats.armor /= currentMod.effects.damageReduction;
        }
      }
      
      return stats;
    }
    
    // Apply all current upgrades and modifications to the game
    applyCurrentLoadout() {
      // Apply all purchased upgrades
      Object.keys(this.upgradesData?.upgrades || {}).forEach(upgradeId => {
        if (this.upgradesData.upgrades[upgradeId].purchased) {
          this.applyUpgradeEffects(upgradeId);
        }
      });
      
      // Apply current modification
      if (this.currentLoadout.modification) {
        this.applyModificationEffects(this.currentLoadout.modification);
      }
      
      // Apply enabled passives
      Object.keys(this.upgradesData?.passives || {}).forEach(passiveId => {
        const passive = this.upgradesData.passives[passiveId];
        if (passive.unlocked && passive.enabled) {
          if (passiveId === 'enemy_identification') {
            this.toggleEnemyIdentification(true);
          }
        }
      });
      
      console.log('✈️ Current loadout applied');
    }
    
    // Get current token balance
    getTokenBalance() {
      return window.saveSystem ? window.saveSystem.getTokens() : 0;
    }
    
    // Check if player can afford an upgrade
    canAffordUpgrade(upgradeId) {
      const upgrade = this.getUpgrade(upgradeId);
      if (!upgrade) return false;
      return this.getTokenBalance() >= upgrade.cost;
    }
  }
  
  // Create singleton instance
  window.upgradeSystem = new UpgradeSystem();
  
  console.log('🔧 Upgrade System module loaded');
})();
