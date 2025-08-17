// UI Screens Module - Handles mission briefing, loadout, debrief, and upgrade screens
(function() {
  'use strict';
  
  class UIScreens {
    constructor() {
      this.currentScreen = null;
      this.screenStack = [];
      this.init();
    }
    
    init() {
      // Create UI container
      this.createUIContainer();
      console.log('🎨 UI Screens system initialized');
    }
    
    createUIContainer() {
      // Create main UI container if it doesn't exist
      if (!document.getElementById('uiContainer')) {
        const container = document.createElement('div');
        container.id = 'uiContainer';
        container.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          pointer-events: none;
          z-index: 500;
        `;
        document.body.appendChild(container);
      }
    }
    
    // Show mission selection screen
    showMissionSelect() {
      const missions = window.missionManager?.missionData?.missions || [];
      const saveData = window.saveSystem?.saveData;
      
      const screen = document.createElement('div');
      screen.className = 'mission-select-screen';
      screen.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 40px;
        overflow-y: auto;
        pointer-events: auto;
        color: white;
        font-family: 'Arial', sans-serif;
      `;
      
      screen.innerHTML = `
        <h1 style="font-size: 3rem; margin-bottom: 20px; text-shadow: 2px 2px 4px rgba(0,0,0,0.5);">
          Mission Selection
        </h1>
        <div style="display: flex; gap: 10px; margin-bottom: 30px;">
          <span style="color: #f39c12;">⭐ Tokens: ${saveData?.player?.tokens || 0}</span>
          <span style="color: #3498db;">📊 Missions Completed: ${saveData?.campaign?.missionsCompleted?.length || 0}/7</span>
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; width: 100%; max-width: 1200px;">
          ${missions.map(mission => {
            const unlocked = window.saveSystem?.isMissionUnlocked(mission.id);
            const completed = saveData?.campaign?.missionsCompleted?.includes(mission.id);
            
            return `
              <div class="mission-card" style="
                background: ${unlocked ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.3)'};
                border: 2px solid ${completed ? '#27ae60' : unlocked ? '#3498db' : '#7f8c8d'};
                border-radius: 10px;
                padding: 20px;
                cursor: ${unlocked ? 'pointer' : 'not-allowed'};
                transition: all 0.3s;
                opacity: ${unlocked ? '1' : '0.5'};
              " ${unlocked ? `onclick="window.uiScreens.selectMission('${mission.id}')"` : ''}>
                <h3 style="margin-bottom: 10px; color: ${completed ? '#27ae60' : '#fff'};">
                  ${completed ? '✅ ' : ''}${mission.name}
                </h3>
                <p style="font-size: 0.9rem; opacity: 0.8; margin-bottom: 10px;">
                  ${unlocked ? mission.briefing.substring(0, 100) + '...' : '🔒 Locked'}
                </p>
                ${mission.rewards ? `
                  <div style="display: flex; gap: 10px; font-size: 0.8rem;">
                    ${mission.rewards.tokens ? `<span>🪙 ${mission.rewards.tokens}</span>` : ''}
                    ${mission.rewards.passive ? `<span>🎯 Passive</span>` : ''}
                    ${mission.rewards.mods?.length ? `<span>🔧 New Mod</span>` : ''}
                  </div>
                ` : ''}
              </div>
            `;
          }).join('')}
        </div>
        ${saveData?.campaign?.endlessUnlocked ? `
          <div style="margin-top: 40px; width: 100%; max-width: 600px;">
            <div class="mission-card endless" style="
              background: linear-gradient(135deg, rgba(231,76,60,0.2), rgba(192,57,43,0.2));
              border: 2px solid #e74c3c;
              border-radius: 10px;
              padding: 30px;
              cursor: pointer;
              text-align: center;
              transition: all 0.3s;
            " onclick="window.uiScreens.selectMission('endless_survival')">
              <h2 style="color: #e74c3c; margin-bottom: 10px;">⚔️ ENDLESS SURVIVAL</h2>
              <p>Test your skills against infinite waves!</p>
              <p style="font-size: 0.9rem; opacity: 0.8;">
                High Score: ${saveData?.player?.highScores?.endless?.score || 0}
              </p>
            </div>
          </div>
        ` : ''}
        <button style="
          margin-top: 30px;
          padding: 15px 40px;
          background: rgba(255,255,255,0.2);
          border: 2px solid white;
          color: white;
          border-radius: 10px;
          cursor: pointer;
          font-size: 1.2rem;
          transition: all 0.3s;
        " onclick="window.uiScreens.closeScreen()">
          Back to Menu
        </button>
      `;
      
      this.showScreen(screen);
    }
    
    selectMission(missionId) {
      this.closeScreen();
      this.showBriefing(missionId);
    }
    
    // Show mission briefing screen
    showBriefing(missionId) {
      const mission = window.missionManager?.missionData?.missions.find(m => m.id === missionId);
      if (!mission) return;
      
      const screen = document.createElement('div');
      screen.className = 'briefing-screen';
      screen.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        padding: 40px;
        pointer-events: auto;
        color: white;
        font-family: 'Arial', sans-serif;
      `;
      
      screen.innerHTML = `
        <div style="max-width: 800px; text-align: center;">
          <h1 style="font-size: 2.5rem; margin-bottom: 20px; text-shadow: 2px 2px 4px rgba(0,0,0,0.5);">
            Mission Briefing
          </h1>
          <h2 style="font-size: 2rem; color: #3498db; margin-bottom: 30px;">
            ${mission.name}
          </h2>
          <div style="background: rgba(0,0,0,0.3); padding: 30px; border-radius: 10px; margin-bottom: 30px;">
            <p style="font-size: 1.2rem; line-height: 1.6;">
              ${mission.briefing}
            </p>
          </div>
          <div style="margin-bottom: 30px;">
            <h3 style="color: #f39c12; margin-bottom: 15px;">Objectives:</h3>
            <p style="font-size: 1.1rem;">
              ${this.getObjectiveDescription(mission.win)}
            </p>
          </div>
          ${mission.rewards ? `
            <div style="margin-bottom: 30px;">
              <h3 style="color: #27ae60; margin-bottom: 15px;">Rewards:</h3>
              <div style="display: flex; justify-content: center; gap: 20px; font-size: 1.1rem;">
                ${mission.rewards.tokens ? `<span>🪙 ${mission.rewards.tokens} Token${mission.rewards.tokens > 1 ? 's' : ''}</span>` : ''}
                ${mission.rewards.passive ? `<span>🎯 ${mission.rewards.passive.replace('_', ' ').toUpperCase()}</span>` : ''}
                ${mission.rewards.mods?.length ? `<span>🔧 New Modifications</span>` : ''}
              </div>
            </div>
          ` : ''}
          <div style="display: flex; gap: 20px; justify-content: center;">
            <button style="
              padding: 15px 40px;
              background: rgba(46, 204, 113, 0.2);
              border: 2px solid #2ecc71;
              color: #2ecc71;
              border-radius: 10px;
              cursor: pointer;
              font-size: 1.2rem;
              font-weight: bold;
              transition: all 0.3s;
            " onclick="window.uiScreens.proceedToLoadout('${missionId}')">
              Proceed to Loadout
            </button>
            <button style="
              padding: 15px 40px;
              background: rgba(255,255,255,0.1);
              border: 2px solid white;
              color: white;
              border-radius: 10px;
              cursor: pointer;
              font-size: 1.2rem;
              transition: all 0.3s;
            " onclick="window.uiScreens.showMissionSelect()">
              Back
            </button>
          </div>
        </div>
      `;
      
      this.showScreen(screen);
    }
    
    getObjectiveDescription(winCondition) {
      switch (winCondition.type) {
        case 'destroy_targets':
          return `Destroy ${winCondition.count} ${winCondition.targets.join(', ')}`;
        case 'survive':
          return `Survive for ${winCondition.time} seconds`;
        case 'protect':
          return `Protect the ${winCondition.target} for ${winCondition.time} seconds`;
        case 'destroy_count':
          return `Destroy ${winCondition.count} enemy aircraft`;
        case 'destroy_bombers':
          return `Destroy ${winCondition.count} enemy bombers`;
        case 'survive_waves':
          return `Survive ${winCondition.waves} enemy waves`;
        default:
          return 'Complete mission objectives';
      }
    }
    
    proceedToLoadout(missionId) {
      this.closeScreen();
      this.showLoadout(missionId);
    }
    
    // Show loadout selection screen
    showLoadout(missionId) {
      const mods = window.upgradeSystem?.getUnlockedModifications() || {};
      const currentMod = window.saveSystem?.saveData?.modifications?.equipped || '8x303';
      const upgrades = window.upgradeSystem?.getUpgrades() || {};
      const passives = window.upgradeSystem?.getPassives() || {};
      
      const screen = document.createElement('div');
      screen.className = 'loadout-screen';
      screen.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
        display: flex;
        flex-direction: column;
        padding: 40px;
        overflow-y: auto;
        pointer-events: auto;
        color: white;
        font-family: 'Arial', sans-serif;
      `;
      
      screen.innerHTML = `
        <h1 style="font-size: 2.5rem; margin-bottom: 30px; text-align: center; text-shadow: 2px 2px 4px rgba(0,0,0,0.5);">
          Aircraft Loadout
        </h1>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px; max-width: 1200px; margin: 0 auto; width: 100%;">
          <!-- Modifications -->
          <div>
            <h2 style="color: #3498db; margin-bottom: 20px;">⚙️ Modifications</h2>
            <div style="display: flex; flex-direction: column; gap: 15px;">
              ${Object.entries(mods).map(([modId, mod]) => `
                <div class="mod-option" style="
                  background: ${currentMod === modId ? 'rgba(52, 152, 219, 0.2)' : 'rgba(255,255,255,0.1)'};
                  border: 2px solid ${currentMod === modId ? '#3498db' : '#7f8c8d'};
                  border-radius: 10px;
                  padding: 15px;
                  cursor: pointer;
                  transition: all 0.3s;
                " onclick="window.uiScreens.selectModification('${modId}')">
                  <h3 style="margin-bottom: 5px;">${mod.name}</h3>
                  <p style="font-size: 0.9rem; opacity: 0.8;">${mod.description}</p>
                </div>
              `).join('')}
            </div>
          </div>
          
          <!-- Upgrades & Passives -->
          <div>
            <h2 style="color: #27ae60; margin-bottom: 20px;">📈 Upgrades</h2>
            <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 30px;">
              ${Object.entries(upgrades).map(([upgradeId, upgrade]) => `
                <div style="
                  background: rgba(255,255,255,0.05);
                  border-radius: 5px;
                  padding: 10px;
                  opacity: ${upgrade.purchased ? '1' : '0.5'};
                ">
                  ${upgrade.purchased ? '✅' : '🔒'} ${upgrade.name}
                </div>
              `).join('')}
            </div>
            
            <h2 style="color: #f39c12; margin-bottom: 20px;">🎯 Passive Abilities</h2>
            <div style="display: flex; flex-direction: column; gap: 10px;">
              ${Object.entries(passives).map(([passiveId, passive]) => {
                if (!passive.unlocked) return '';
                return `
                  <div style="
                    background: rgba(255,255,255,0.1);
                    border-radius: 5px;
                    padding: 10px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                  ">
                    <span>${passive.name}</span>
                    <label class="toggle-switch" style="cursor: pointer;">
                      <input type="checkbox" 
                        ${passive.enabled ? 'checked' : ''} 
                        onchange="window.uiScreens.togglePassive('${passiveId}')"
                        style="margin-right: 5px;">
                      <span>${passive.enabled ? 'ON' : 'OFF'}</span>
                    </label>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>
        
        <!-- Aircraft Stats -->
        <div style="margin-top: 40px; text-align: center;">
          <h3 style="color: #95a5a6; margin-bottom: 15px;">Aircraft Statistics</h3>
          <div id="aircraftStats" style="display: flex; justify-content: center; gap: 30px; font-size: 0.9rem;">
            <!-- Stats will be populated by JavaScript -->
          </div>
        </div>
        
        <!-- Action Buttons -->
        <div style="display: flex; gap: 20px; justify-content: center; margin-top: 40px;">
          <button style="
            padding: 15px 50px;
            background: rgba(46, 204, 113, 0.2);
            border: 2px solid #2ecc71;
            color: #2ecc71;
            border-radius: 10px;
            cursor: pointer;
            font-size: 1.3rem;
            font-weight: bold;
            transition: all 0.3s;
          " onclick="window.uiScreens.startMission('${missionId}')">
            🚀 START MISSION
          </button>
          <button style="
            padding: 15px 30px;
            background: rgba(231, 76, 60, 0.2);
            border: 2px solid #e74c3c;
            color: #e74c3c;
            border-radius: 10px;
            cursor: pointer;
            font-size: 1.1rem;
            transition: all 0.3s;
          " onclick="window.uiScreens.showUpgradeShop()">
            🛒 Upgrade Shop
          </button>
          <button style="
            padding: 15px 30px;
            background: rgba(255,255,255,0.1);
            border: 2px solid white;
            color: white;
            border-radius: 10px;
            cursor: pointer;
            font-size: 1.1rem;
            transition: all 0.3s;
          " onclick="window.uiScreens.showBriefing('${missionId}')">
            Back
          </button>
        </div>
      `;
      
      this.showScreen(screen);
      this.updateAircraftStats();
    }
    
    selectModification(modId) {
      if (window.upgradeSystem?.equipModification(modId)) {
        // Refresh the loadout screen to show the selection
        const missionId = window.missionManager?.currentMission?.id || 'M01_Tutorial';
        this.showLoadout(missionId);
      }
    }
    
    togglePassive(passiveId) {
      window.upgradeSystem?.togglePassive(passiveId);
    }
    
    updateAircraftStats() {
      const stats = window.upgradeSystem?.calculateAircraftStats();
      const statsDiv = document.getElementById('aircraftStats');
      if (stats && statsDiv) {
        statsDiv.innerHTML = `
          <span>⚡ Speed: ${Math.round(stats.topSpeed)} km/h</span>
          <span>🚀 Acceleration: ${stats.acceleration.toFixed(1)} m/s²</span>
          <span>🔄 Turn Rate: ${stats.turnRate.toFixed(1)} deg/s</span>
          <span>📈 Climb: ${stats.climbRate.toFixed(1)} m/s</span>
          <span>🛡️ Armor: ${Math.round(stats.armor)} HP</span>
          <span>⛽ Fuel: ${Math.round(stats.fuel)} L</span>
        `;
      }
    }
    
    // Show upgrade shop
    showUpgradeShop() {
      const upgrades = window.upgradeSystem?.getUpgrades() || {};
      const tokens = window.saveSystem?.getTokens() || 0;
      
      const screen = document.createElement('div');
      screen.className = 'upgrade-shop-screen';
      screen.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 40px;
        overflow-y: auto;
        pointer-events: auto;
        color: white;
        font-family: 'Arial', sans-serif;
      `;
      
      screen.innerHTML = `
        <h1 style="font-size: 2.5rem; margin-bottom: 20px; text-shadow: 2px 2px 4px rgba(0,0,0,0.5);">
          Upgrade Shop
        </h1>
        <div style="font-size: 1.5rem; color: #f39c12; margin-bottom: 30px;">
          🪙 Tokens: ${tokens}
        </div>
        
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 20px; width: 100%; max-width: 1200px;">
          ${Object.entries(upgrades).map(([upgradeId, upgrade]) => {
            const canAfford = tokens >= upgrade.cost;
            const purchased = upgrade.purchased;
            
            return `
              <div style="
                background: ${purchased ? 'rgba(46, 204, 113, 0.1)' : 'rgba(255,255,255,0.1)'};
                border: 2px solid ${purchased ? '#27ae60' : canAfford ? '#f39c12' : '#7f8c8d'};
                border-radius: 10px;
                padding: 20px;
                opacity: ${purchased ? '0.7' : '1'};
              ">
                <h3 style="margin-bottom: 10px; color: ${purchased ? '#27ae60' : '#fff'};">
                  ${purchased ? '✅ ' : ''}${upgrade.name}
                </h3>
                <p style="font-size: 0.9rem; opacity: 0.8; margin-bottom: 15px;">
                  ${upgrade.description}
                </p>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span style="font-size: 1.1rem; color: #f39c12;">
                    🪙 ${upgrade.cost} Token${upgrade.cost > 1 ? 's' : ''}
                  </span>
                  ${!purchased ? `
                    <button style="
                      padding: 8px 20px;
                      background: ${canAfford ? 'rgba(46, 204, 113, 0.2)' : 'rgba(255,255,255,0.1)'};
                      border: 2px solid ${canAfford ? '#2ecc71' : '#7f8c8d'};
                      color: ${canAfford ? '#2ecc71' : '#7f8c8d'};
                      border-radius: 5px;
                      cursor: ${canAfford ? 'pointer' : 'not-allowed'};
                      transition: all 0.3s;
                    " ${canAfford ? `onclick="window.uiScreens.purchaseUpgrade('${upgradeId}')"` : 'disabled'}>
                      ${canAfford ? 'Purchase' : 'Not Enough Tokens'}
                    </button>
                  ` : '<span style="color: #27ae60;">Purchased</span>'}
                </div>
              </div>
            `;
          }).join('')}
        </div>
        
        <button style="
          margin-top: 30px;
          padding: 15px 40px;
          background: rgba(255,255,255,0.2);
          border: 2px solid white;
          color: white;
          border-radius: 10px;
          cursor: pointer;
          font-size: 1.2rem;
          transition: all 0.3s;
        " onclick="window.uiScreens.closeScreen()">
          Close
        </button>
      `;
      
      this.showScreen(screen);
    }
    
    purchaseUpgrade(upgradeId) {
      if (window.upgradeSystem?.purchaseUpgrade(upgradeId)) {
        // Refresh the shop to show the purchase
        this.showUpgradeShop();
      }
    }
    
    startMission(missionId) {
      // Apply loadout
      window.upgradeSystem?.applyCurrentLoadout();
      
      // Close UI and start mission
      this.closeScreen();
      
      // Reset game state for mission restart
      if (window.game) {
        // Reset player health
        window.game.playerHealth = window.game.playerMaxHealth || 5;
        window.game.crashed = false;
        
        // Clear all enemies
        if (window.game.enemies) {
          window.game.enemies.forEach(enemy => {
            if (enemy.body && window.world) {
              window.world.destroyBody(enemy.body);
            }
          });
          window.game.enemies = [];
        }
        
        // Clear projectiles
        if (window.game.projectiles) window.game.projectiles = [];
        if (window.game.casings) window.game.casings = [];
        if (window.game.explosions) window.game.explosions = [];
        if (window.game.enemyProjectiles) window.game.enemyProjectiles = [];
        if (window.game.enemyCollisionProjectiles) window.game.enemyCollisionProjectiles = [];
        
        // Reset player position to spawn point
        if (window.game.player && window.aircraft) {
          window.aircraft.setPosition(window.pl.Vec2(0, -100));
          window.aircraft.setLinearVelocity(window.pl.Vec2(50, 0));
          window.aircraft.setAngle(0);
          window.aircraft.setAngularVelocity(0);
        }
      }
      
      // Start the mission
      if (window.missionManager) {
        window.missionManager.startMission(missionId);
      }
      
      // Hide start screen if visible
      const startScreen = document.getElementById('startScreen');
      if (startScreen) {
        startScreen.style.display = 'none';
      }
      
      // Start game if not already started
      if (!window.gameStarted) {
        window.gameStarted = true;
        if (window.initializeGame) {
          window.initializeGame();
        }
      }
    }
    
    // Show mission debrief screen
    showDebrief(data) {
      const screen = document.createElement('div');
      screen.className = 'debrief-screen';
      screen.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: linear-gradient(135deg, ${data.success ? '#27ae60' : '#c0392b'} 0%, ${data.success ? '#229954' : '#922b21'} 100%);
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        padding: 40px;
        pointer-events: auto;
        color: white;
        font-family: 'Arial', sans-serif;
      `;
      
      screen.innerHTML = `
        <h1 style="font-size: 3rem; margin-bottom: 20px; text-shadow: 2px 2px 4px rgba(0,0,0,0.5);">
          Mission ${data.success ? 'Complete!' : 'Failed'}
        </h1>
        <h2 style="font-size: 2rem; margin-bottom: 30px; opacity: 0.9;">
          ${data.missionName}
        </h2>
        
        ${data.success && data.rewards ? `
          <div style="background: rgba(0,0,0,0.3); padding: 20px; border-radius: 10px; margin-bottom: 30px;">
            <h3 style="color: #f39c12; margin-bottom: 15px;">Rewards Earned:</h3>
            <div style="display: flex; gap: 20px; justify-content: center; font-size: 1.2rem;">
              ${data.rewards.tokens ? `<span>🪙 ${data.rewards.tokens} Token${data.rewards.tokens > 1 ? 's' : ''}</span>` : ''}
              ${data.rewards.passive ? `<span>🎯 ${data.rewards.passive.replace('_', ' ').toUpperCase()}</span>` : ''}
              ${data.rewards.mods?.length ? `<span>🔧 New Modifications Unlocked</span>` : ''}
            </div>
          </div>
        ` : ''}
        
        ${!data.success ? `
          <div style="background: rgba(0,0,0,0.3); padding: 20px; border-radius: 10px; margin-bottom: 30px;">
            <p style="font-size: 1.2rem;">Reason: ${data.failReason?.replace('_', ' ').toUpperCase()}</p>
          </div>
        ` : ''}
        
        <div style="background: rgba(0,0,0,0.2); padding: 20px; border-radius: 10px; margin-bottom: 30px;">
          <h3 style="margin-bottom: 15px;">Mission Statistics:</h3>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; font-size: 1.1rem;">
            <span>⏱️ Time: ${data.stats.time}s</span>
            <span>💀 Total Kills: ${data.stats.kills?.total || 0}</span>
            ${data.stats.kills?.bf109 ? `<span>✈️ Fighters: ${data.stats.kills.bf109}</span>` : ''}
            ${data.stats.kills?.ju88 ? `<span>💣 Bombers: ${data.stats.kills.ju88}</span>` : ''}
            ${data.stats.kills?.ace ? `<span>⭐ Aces: ${data.stats.kills.ace}</span>` : ''}
            ${data.stats.accuracy ? `<span>🎯 Accuracy: ${data.stats.accuracy.toFixed(1)}%</span>` : ''}
          </div>
        </div>
        
        <div style="display: flex; gap: 20px;">
          ${data.success ? `
            <button style="
              padding: 15px 40px;
              background: rgba(255,255,255,0.2);
              border: 2px solid white;
              color: white;
              border-radius: 10px;
              cursor: pointer;
              font-size: 1.2rem;
              font-weight: bold;
              transition: all 0.3s;
            " onclick="window.uiScreens.continueCampaign()">
              Continue Campaign
            </button>
          ` : `
            <button style="
              padding: 15px 40px;
              background: rgba(255,255,255,0.2);
              border: 2px solid white;
              color: white;
              border-radius: 10px;
              cursor: pointer;
              font-size: 1.2rem;
              font-weight: bold;
              transition: all 0.3s;
            " onclick="window.uiScreens.retryMission('${data.missionId}')">
              Retry Mission
            </button>
          `}
          <button style="
            padding: 15px 40px;
            background: rgba(255,255,255,0.1);
            border: 2px solid white;
            color: white;
            border-radius: 10px;
            cursor: pointer;
            font-size: 1.2rem;
            transition: all 0.3s;
          " onclick="window.uiScreens.returnToMenu()">
            Main Menu
          </button>
        </div>
      `;
      
      this.showScreen(screen);
    }
    
    continueCampaign() {
      this.closeScreen();
      this.showMissionSelect();
    }
    
    retryMission(missionId) {
      this.closeScreen();
      this.showBriefing(missionId);
    }
    
    returnToMenu() {
      this.closeScreen();
      // Reload to main menu
      location.reload();
    }
    
    // Show a screen
    showScreen(screen) {
      this.closeScreen();
      const container = document.getElementById('uiContainer');
      if (container) {
        container.appendChild(screen);
        container.style.pointerEvents = 'auto';
        this.currentScreen = screen;
      }
    }
    
    // Close current screen
    closeScreen() {
      if (this.currentScreen) {
        this.currentScreen.remove();
        this.currentScreen = null;
      }
      const container = document.getElementById('uiContainer');
      if (container) {
        container.style.pointerEvents = 'none';
      }
    }
    
    // Show in-game dialogue
    showDialogue(text, duration = 3000) {
      const dialogue = document.createElement('div');
      dialogue.style.cssText = `
        position: fixed;
        bottom: 100px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0,0,0,0.8);
        color: white;
        padding: 15px 25px;
        border-radius: 10px;
        font-size: 1.1rem;
        font-family: 'Arial', sans-serif;
        max-width: 600px;
        text-align: center;
        pointer-events: none;
        z-index: 600;
        animation: fadeIn 0.5s;
      `;
      dialogue.textContent = text;
      
      document.body.appendChild(dialogue);
      
      setTimeout(() => {
        dialogue.style.animation = 'fadeOut 0.5s';
        setTimeout(() => dialogue.remove(), 500);
      }, duration);
    }
  }
  
  // Add CSS animations
  const style = document.createElement('style');
  style.textContent = `
    @keyframes fadeIn {
      from { opacity: 0; transform: translateX(-50%) translateY(20px); }
      to { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
    @keyframes fadeOut {
      from { opacity: 1; transform: translateX(-50%) translateY(0); }
      to { opacity: 0; transform: translateX(-50%) translateY(20px); }
    }
    
    .mission-card:hover {
      transform: translateY(-5px);
      box-shadow: 0 5px 20px rgba(0,0,0,0.3);
    }
    
    .mod-option:hover {
      transform: translateX(5px);
    }
  `;
  document.head.appendChild(style);
  
  // Create singleton instance
  window.uiScreens = new UIScreens();
  
  console.log('🎨 UI Screens module loaded');
})();
