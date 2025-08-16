## Per Ardua ad Astra — MVP Build Plan

Assumption: We will build the MVP in Godot 4 (GDScript) targeting PC at 120 FPS, using the existing sprite assets and the design in `Per_Ardua_ad_Astra_MVP.txt`, `AI.txt`, `gameplay.txt`, `Mission.txt`, and `Progression.txt`.

### Scope (MVP)
- **Player**: Spitfire (single aircraft type)
- **Enemies**: Bf 109 (fighter + Ace variant), Ju 88 (bomber with tail gun)
- **Modes**: 7-mission scripted campaign, Endless survival unlocked after campaign
- **Progression**: Tokens for upgrades; one modification slot per mission; one passive (Enemy Identification)
- **Physics**: 2D side-view with inertia, gravity, drag, lift; stall and recovery; TWR ≈ 1.5
- **Data**: Missions and upgrades in JSON

### Technical Stack & Project Structure
- **Engine**: Godot 4.x (GDScript)
- **Assets**: Reuse sprites in `assets/sprites/...`
- **Data**: JSON in `data/`
- **Proposed structure**:
```
game/
  project.godot
  scenes/
    Main.tscn
    World.tscn
    Player.tscn
    Wingman.tscn
    EnemyBf109.tscn
    EnemyJu88.tscn
    BomberFormation.tscn
    HUD.tscn
    Briefing.tscn
    Debrief.tscn
    Loadout.tscn
  scripts/
    player/
      Player.gd
      Weapons.gd
      DamageZones.gd
      StallModel.gd
    ai/
      FSM.gd
      WingmanAI.gd
      Bf109AI.gd
      Ju88AI.gd
      TailGun.gd
      Formation.gd
    systems/
      Physics2DFlight.gd
      MissionManager.gd
      WaveSpawner.gd
      DialogueSystem.gd
      SaveSystem.gd
      UIHudController.gd
      LoadoutController.gd
      EndlessModeController.gd
  assets/  (imports or copies from repo `assets/`)
data/
  missions/  (7 campaign JSON files)
  endless/   (scalars for survival scaling)
  upgrades.json
  mods.json
  dialogues.json
  config.json
```

### Development Milestones (target 5–6 weeks)
- **Week 1 — Foundation & Flight**
  - Initialize Godot project; set up input map (A/D, W/S, F, Space, R)
  - Implement `Physics2DFlight.gd` using velocity integration and lift approximation; add stall model
  - Create `Player.tscn` with placeholder collider, attach weapons stub
  - Basic `HUD.tscn`: airspeed, throttle %, ammo, fuel
  - Load and display `assets/sprites/aircraft/player/Spitfire facing left|right.png`
  - Acceptance: player can fly, stall, recover; HUD reads live values at 120 FPS

- **Week 2 — Combat & Damage**
  - Implement weapons (raycast or fast projectile) with rpm/spread/damage per `Progression.txt`
  - Implement `DamageZones.gd` for Engine, WingL/R, Pilot; on-hit effects (smoke, sparks)
  - Implement recoil/spread tuning; muzzle flash and tracer effects
  - Acceptance: can shoot targets; zones apply correct debuffs; visual feedback present

- **Week 3 — AI & Encounters**
  - Implement generic `FSM.gd` with states: FormUp → Engage → Break → Reposition → CoverLeader → RTB
  - Create `WingmanAI.gd` (cannot die; RTB when low HP)
  - Implement `Bf109AI.gd` dogfight behavior; Ace buffs (+10–15%)
  - Implement `Ju88AI.gd` with `TailGun.gd` and `Formation.gd` (V, Line Abreast)
  - Acceptance: player + wingman vs 1–3 fighters; bomber formation flies, tail gun returns fire

- **Week 4 — Missions, Loadout, Progression**
  - Implement `MissionManager.gd` to load JSON schema from `Mission.txt`
  - Implement `WaveSpawner.gd` and event triggers (timed waves, conditions)
  - Build `Loadout.tscn` to pick one modification and display purchased upgrades
  - Implement `SaveSystem.gd` JSON save sketch from `Progression.txt`
  - Implement `DialogueSystem.gd` to show pre/mid/post lines
  - Acceptance: 3 campaign missions playable end-to-end with rewards and save/load

- **Week 5 — Content, Endless, UI/Audio**
  - Author all 7 campaign mission JSONs; author Endless scalers (spawn rate, group size, accuracy)
  - Implement `EndlessModeController.gd` with score = time + kills; unlock after campaign
  - Polish HUD (damage icons by zone, objective markers), Briefing and Debrief screens
  - Integrate looping engine SFX, gunfire, explosions; wingman radio as text (voice optional)
  - Acceptance: full campaign + endless; menus and audio functional

- **Week 6 — Tuning, QA, Packaging**
  - Balance physics (stall thresholds), weapons, AI burst timings, mission difficulty
  - Performance pass: pooling, offscreen culling, light effects budget; keep 120 FPS target
  - Bug triage; prepare PC build; optional Steam packaging checklist
  - Acceptance: stable 120 FPS on target machine; clean run-through with no blockers

### Detailed Task Breakdown
- **Flight Model**
  - Velocity: `vel += thrustVector * thrust - dragCoeff * vel - gravity`
  - Lift modulation: `lift = liftCoeff * airspeed * cos(AoA)`
  - Stall: if `airspeed < V_stall && |AoA| > AoA_stall` for `t_stall >= 0.4s` → nose drop, control authority reduced; recover with throttle + nose-down for ≈0.6s

- **Weapons & Damage**
  - Per-weapon config: `rpm`, `spreadDeg`, `damage`, `muzzleVel`, `recoilKick`
  - Zones: Engine (speed/climb debuff), Wings (roll/turn debuff), Pilot (fail)
  - Ju 88 engines reduce formation speed; stragglers may fall behind

- **AI FSM (per `AI.txt`)**
  - FormUp: maintain offset to leader/anchor
  - Engage: cone check + range, burst fire; break timer to avoid endless tail chase
  - Break: defensive maneuver; randomized vector
  - Reposition: climb/extend to re-enter with advantage
  - CoverLeader: wingman prioritizes player’s attacker
  - RTB: wingman disengages at low HP; sits out next mission at most once

- **Missions & Data**
  - JSON fields: `id`, `map`, `win`, `lose`, `rewards`, `waves[]`, `ace?`, `dialogue{pre,mid,post}` (see `Mission.txt`)
  - Example: Ju 88 raid with timed escorts; conditional reinforcements when convoy HP < 50%

- **Progression**
  - Upgrades: Bubble Canopy (UI delay −40%), Pressurized Cockpit (+efficiency at altitude, optional), Engine Upgrade (+top speed/accel/climb)
  - Mods (pick 1): 8×.303, 2×20mm+4×.303, 4×20mm, Armor ±, Drop Tank
  - Save data: last mission, upgrades purchased, mods list, equipped mod, passive unlocked

- **UI/UX**
  - HUD: airspeed, throttle, ammo, fuel, damage icons, compass, objective markers
  - Screens: Briefing, Loadout, Debrief, Upgrades
  - Enemy Identification passive: tint/outline enemies in red, toggleable when unlocked

### Acceptance Criteria (Definition of Done)
- Flight: stall and recovery behave per spec; feels responsive; TWR ≈ 1.5
- Combat: weapons follow configured rpm/spread/damage; visual effects for fire, smoke, tracers
- AI: wingman covers player; Bf 109 cycles engage/break; Ace is noticeably tougher; Ju 88 tail gun arcs and bursts
- Missions: 7 JSON missions load and complete; rewards grant tokens; dialogue shows at pre/mid/post
- Progression: tokens persist via save; upgrades modify stats; one mod selectable each mission
- Endless: infinite waves with increasing spawn/accuracy/size; score persists to leaderboard screen
- Performance: 120 FPS on target; no memory spikes; object pooling used for projectiles/effects

### Content To Build (Assets Reuse)
- Use `assets/sprites/aircraft/player/Spitfire facing left|right.png`
- Use `assets/sprites/aircraft/enemies/bf109_fighter.png`, `bf109_ace.png`, `ju88_bomber.png`
- Use `assets/sprites/effects/muzzle_flash.png`, `smoke_trail.png`
- Use `assets/sprites/ui/hud/airspeed_indicator.png`, `assets/sprites/ui/icons/upgrade_engine.png`

### Playtest & Tuning Plan
- Daily 10–15 minute flight feel tests during Week 1–2
- Encounter tests with scripted seeds for reproducibility in Week 3–4
- Full campaign playthroughs (30–45 min) in Week 5–6; collect time-to-kill, player damage taken, stall frequency

### Risks & Mitigations
- Physics feel not fun: prioritize responsiveness over realism; expose constants in `config.json`
- AI degenerate behaviors: enforce break timers and re-engagement constraints; add light randomness
- Performance: limit particles; pool projectiles; reduce update rates for tail gunners
- Scope creep: stick to 7 missions, single player aircraft, no death for wingman in MVP

### Out of Scope (MVP)
- Multiplayer, dynamic campaigns, detailed damage systems, g-force simulation, additional aircraft, voice acting

### Collaboration & Journaling
- Use `LLM_JOURNAL.md` for daily notes by human/LLM agents
- Append-only entries to avoid merge conflicts; 1–3 sentences per task; include PR/commit links

### Go/No-Go Checklist for Release
- [ ] All 7 missions complete and winnable
- [ ] Endless mode unlocks and runs 10+ minutes without degradation
- [ ] Save/load persists upgrades and campaign progress
- [ ] Stable 120 FPS on target machine
- [ ] No crashers in 60-minute soak test


