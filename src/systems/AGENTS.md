# src/systems — Game-System Adapter Stack

Three-layer adapter architecture that translates Foundry actors into MobiVTT's `Dnd5eCharacter` payload. Only `dnd5e` is implemented; the layering exists so a new system = new `SystemAdapter` + `SystemRegistry.register(...)` in `src/index.ts`'s init hook.

## STRUCTURE
```
base/        # SystemAdapter interface + Exporter<T>/VersionHandler interfaces
registry.ts  # SystemRegistry singleton (register/getAdapter/isSupported)
dnd5e/
├── DnD5eAdapter.ts   # systemId 'dnd5e', min 4.4.0; picks sheet inject by major
├── exporter.ts       # DnD5eExporter.selectHandler → per-version mapper set
├── translate.ts      # module-agnostic i18n (Babele/compendium → identifier → null)
├── srd-registry.ts   # buildSrdRegistry / isSrdIdentifier (13 SRD packs)
├── versions/         # sheet-button inject: 4.4.x (jQuery) vs 5.0.x (action-based)
└── mappers/          # per-version data transform (+ __tests__/)
```

## VERSION SPLIT (dnd5e major ≥ 5 vs < 5)
Both `DnD5eExporter.selectHandler(version)` and `DnD5eAdapter.initialize()` branch on `parseInt(major) >= 5`:
- ≥5 → `mapSystem`/`mapContent`/`mapSpellDetails` (`system.ts`, `items.ts`, `spells.ts`) + `sheetInject50`
- <5 → the `*.4.x.ts` siblings + `sheetInject44`

Every mapper has a `.ts` (5.x) and a `.4.x.ts` (4.x) variant. Change a mapped field in BOTH or the older system silently regresses. `__tests__/version-routing.test.ts` guards handler selection.

## CONVENTIONS
- Payload is MobiVTT's display spec (grouped by section, no flat items array), NOT Foundry's model.
- SRD content (identifiers across 13 packs) is detected and EXCLUDED from export — the website embeds its own SRD JSON instead.
- Export flow (`exporter.ts`): translate items/skills/conditions in parallel → `setItemNameMap` → map system/content/spellDetails → merge with i18n labels.
- `serializeActor` returns `null` for non-`character` actor types.

## ANTI-PATTERNS
- Don't add a mapped field in only one version variant.
- Portrait extraction (`mappers/portrait.ts`, WEBP/JPEG q0.85 max 580×660) is NOT part of `serializeActor`; it's attached separately by `exportCharacter`/sync.

## TESTS
`mappers/__tests__/` (Vitest): items.4x, system.4x, portrait, version-routing. Run `npm test`.
