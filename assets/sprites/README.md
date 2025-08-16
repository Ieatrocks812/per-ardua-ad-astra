# Sprite Assets Organization

## Directory Structure

```
assets/sprites/
├── aircraft/
│   ├── player/          # Player aircraft sprites
│   ├── enemies/         # Enemy aircraft sprites
│   └── wingman/         # Ally aircraft sprites
├── effects/             # Visual effects sprites
├── ui/                  # User interface sprites
│   ├── hud/            # Heads-up display elements
│   ├── menu/           # Menu and navigation elements
│   └── icons/          # Upgrade and modification icons
└── environment/         # Background and environmental sprites
```

## Required Sprites

### Aircraft (64-128px wide, PNG with transparency)
- **Player**: Spitfire (side-view, left-facing, and right-facing)
- **Enemies**: Bf 109 fighter, Bf 109 Ace, Ju 88 bomber (side-view, right-facing)
- **Wingman**: Spitfire variant (can reuse player sprite)

### Effects
- Muzzle flash, tracers, smoke, fire, explosions
- Damage effects (sparks, smoke trails)

### UI Elements
- HUD: Airspeed, throttle, ammo, fuel, damage indicators
- Menu: Upgrade icons, modification icons, passive ability toggle
- Icons: Aircraft silhouettes for selection screens

### Environment
- Clouds, ground silhouettes, sky elements

## Style Guidelines
- Minimal silhouettes or low-res pixel art
- Readability over realism
- Consistent scale across aircraft types
- Limited color palette for classic arcade feel
- PNG format with transparency support
