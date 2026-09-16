SKILL.md
│
├── Identity
│
├── Purpose
│
├── Scope
│
├── Triggers
│
├── Capabilities
│
├── Tools
│
├── Dependencies
│
├── Permissions
│
├── Constraints
│
├── Inputs
│
├── Outputs
│
├── Resources
│
├── Instructions
│
├── Configuration
│
└── Metadata


IDENTITY
    Qui suis-je ?

PURPOSE
    Pourquoi est-ce que j'existe ?

SCOPE
    Jusqu'où va ma responsabilité ?

TRIGGERS
    Quand suis-je pertinent ?

CAPABILITIES
    Qu'est-ce que je fournis ?

TOOLS
    Avec quels outils puis-je fonctionner ?

DEPENDENCIES
    De quoi ai-je besoin ?

PERMISSIONS
    Quelles autorisations sont nécessaires ?

CONSTRAINTS
    Quelles limites doivent être respectées ?

INPUTS
    Qu'est-ce que j'accepte ?

OUTPUTS
    Qu'est-ce que je produis ?

RESOURCES
    Quels documents/scripts/assets/références m'accompagnent ?

INSTRUCTIONS
    Comment dois-je guider le modèle ?

CONFIGURATION
    Quelles configurations sont nécessaires ?

METADATA
    Informations descriptives et de compatibilité



skills/
├── filesystem/
│   └── SKILL.md
├── terminal/
│   └── SKILL.md
├── system/
│   └── SKILL.md
...
│
runtime/
├── capabilityRegistry.ts
├── skillRegistry.ts
├── toolRegistry.ts
├── toolExecutor.ts
└── ...
│
capabilities/
├── filesystem/
├── terminal/
├── system/
└── ...
│
tools/
├── filesystem/
├── terminal/
├── system/
└── ...
│
implementations/
├── filesystem/
├── terminal/
├── system/
└── ...


MANIFEST ARCHITECTURE                 ✓
        ↓
filesystem/SKILL.md                   ✓
        ↓
────────────────────────────────────────
RUNTIME ADAPTATION
────────────────────────────────────────
        ↓
1. Manifest schema / domain
        ↓
2. Manifest parser
        ↓
3. Skill discovery
        ↓
4. Skill Registry
        ↓
5. Dependency resolution
        ↓
6. Permission declaration handling
        ↓
7. Resource handling
        ↓
8. Tool/capability resolution
        ↓
9. Context injection
        ↓
10. Runtime validation
        ↓
────────────────────────────────────────
TEST
────────────────────────────────────────
        ↓
filesystem manifest
        ↓
discovery réelle
        ↓
validation réelle
        ↓
activation réelle
        ↓
outil filesystem réel
        ↓
test physique