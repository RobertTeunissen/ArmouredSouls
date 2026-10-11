# Review: Expansion Automaton Catalogue

**Status**: Approved — 11 October 2026
**Approval**: Content_Approval given by the product owner in conversation on 11 October 2026, after reviewing this pack ("You have my approval for the … other automaton stables").
**Scope**: every Expansion_Stable in `source/` (spec 57). Every value below is generated from `catalogue/{catalogueKey}.json` (the converted §15.1 Catalogue_Entries) by `tools/render_catalogue.py`; art briefs come from the source review data with the decisions overlay applied (`tools/decisions.json`; delegated briefs are listed under "Changes from your draft"). The approved files are delivered byte-identical to `app/backend/prisma/automaton-catalogue/` by spec 57 Task Group 2.
**Depends on**: spec-55 `review/STRATEGIES.md` and `review/CATALOGUE.md` (approved 9 Oct 2026); `review/FINDINGS.md` in this folder lists every open finding.

---

## 1. Overview

Open findings are what is left after your decisions; accepted findings are answered by a decision in `review/README.md` §4; source findings are those of your draft before the decisions were applied (B / PO / C = Blocking / Needs product-owner decision / Cosmetic).

| # | Catalogue key | Stable name | Franchise label | Strategy | Blueprints → robots target | Open findings (B / PO / C) | Accepted by decision | Source findings before decisions (B / PO / C) |
|---|---|---|---|---|---|---|---|---|
| 12 | `aperture-test-division` | Aperture Test Division | Portal | Duo | 2 → 2 | 0 / 0 / 0 | 2 | 2 / 3 / 1 |
| 13 | `axiom-salvage-crew` | Axiom Salvage Crew | WALL-E | Duo | 3 → 3 | 0 / 0 / 0 | 1 | 4 / 3 / 0 |
| 14 | `rannoch-geth-consensus` | Rannoch Geth Consensus | Mass Effect | Swarm | 11 → 11 | 0 / 0 / 0 | 1 | 11 / 8 / 0 |
| 15 | `necron-tomb-dynasty` | Necron Tomb Dynasty | Warhammer 40,000 | Swarm | 11 → 11 | 0 / 0 / 0 | 1 | 11 / 9 / 0 |
| 16 | `frontier-titan-corps` | Frontier Titan Corps | Titanfall | Trio | 4 → 4 | 0 / 0 / 0 | 2 | 4 / 4 / 0 |
| 17 | `omnic-arena-collective` | Omnic Arena Collective | Overwatch | Generalist | 4 → 4 | 0 / 0 / 0 | 1 | 4 / 4 / 1 |
| 18 | `yorha-combat-division` | YoRHa Combat Division | NieR:Automata | Trio | 3 → 3 | 0 / 0 / 0 | 2 | 3 / 3 / 1 |
| 19 | `cauldron-machineworks` | Cauldron Machineworks | Horizon | Generalist | 4 → 4 | 0 / 0 / 0 | 1 | 4 / 3 / 1 |
| 20 | `cyberlife-deviants` | CyberLife Deviants | Detroit: Become Human | Trio | 3 → 3 | 0 / 0 / 0 | 2 | 3 / 4 / 1 |
| 21 | `robot-city-industries` | Robot City Industries | Robots | Tycoon | 3 → 3 | 0 / 0 / 0 | 1 | 3 / 3 / 1 |
| 22 | `san-fransokyo-robotics` | San Fransokyo Robotics | Big Hero 6 | Paragon | 1 → 1 | 0 / 0 / 0 | 2 | 1 / 2 / 1 |
| 23 | `rockwell-ironworks` | Rockwell Ironworks | The Iron Giant | Paragon | 1 → 1 | 0 / 0 / 0 | 2 | 1 / 2 / 1 |
| 24 | `nova-robotics` | Nova Robotics | Short Circuit | Paragon | 1 → 1 | 0 / 0 / 0 | 2 | 1 / 2 / 1 |
| 25 | `tetravaal-tactical-unit` | Tetravaal Tactical Unit | Chappie | Paragon | 2 → 2 | 0 / 0 / 0 | 1 | 3 / 5 / 0 |
| 26 | `usr-synthetic-division` | USR Synthetic Division | I, Robot | Swarm | 11 → 11 | 0 / 0 / 0 | 2 | 11 / 14 / 0 |
| 27 | `cylon-centurion-fleet` | Cylon Centurion Fleet | Battlestar Galactica | Swarm | 11 → 11 | 0 / 0 / 0 | 1 | 11 / 14 / 0 |
| 28 | `eggman-badnik-works` | Eggman Badnik Works | Sonic the Hedgehog | Swarm | 11 → 11 | 0 / 0 / 0 | 1 | 11 / 11 / 0 |
| 29 | `steamworld-privateers` | SteamWorld Privateers | SteamWorld | Tycoon | 3 → 3 | 0 / 0 / 0 | 1 | 3 / 2 / 1 |
| 30 | `hyperion-loader-division` | Hyperion Loader Division | Borderlands | Tycoon | 3 → 3 | 0 / 0 / 0 | 1 | 3 / 5 / 1 |
| 31 | `wasteland-robotics` | Wasteland Robotics | Fallout | Generalist | 4 → 4 | 0 / 0 / 0 | 1 | 4 / 7 / 1 |
| 32 | `battletech-mercenary-lance` | BattleTech Mercenary Lance | BattleTech | Trio | 3 → 3 | 0 / 0 / 0 | 2 | 3 / 4 / 1 |
| 33 | `rubicon-raven-workshop` | Rubicon Raven Workshop | Armored Core | Paragon | 2 → 2 | 0 / 0 / 0 | 1 | 4 / 3 / 0 |
| 34 | `wanzer-assembly-corps` | Wanzer Assembly Corps | Front Mission | Trio | 3 → 3 | 0 / 0 / 0 | 2 | 3 / 7 / 1 |
| 35 | `shadow-moses-arsenal` | Shadow Moses Arsenal | Metal Gear | Paragon | 2 → 2 | 0 / 0 / 0 | 1 | 2 / 3 / 0 |
| 36 | `fnix-machine-network` | FNIX Machine Network | Generation Zero | Swarm | 11 → 11 | 0 / 0 / 0 | 1 | 11 / 14 / 0 |
| 37 | `facility-3826-robotics` | Facility 3826 Robotics | Atomic Heart | Generalist | 3 → 3 | 0 / 0 / 0 | 2 | 3 / 8 / 2 |
| 38 | `irta-synthetic-response` | IRTA Synthetic Response | Binary Domain | Paragon | 1 → 1 | 0 / 0 / 0 | 2 | 1 / 2 / 1 |
| 39 | `droid-rebellion-workshop` | Droid Rebellion Workshop | Metal Arms | Paragon | 1 → 1 | 0 / 0 / 0 | 2 | 1 / 2 / 1 |
| 40 | `galactic-robot-workshop` | Galactic Robot Workshop | Ratchet & Clank | Generalist | 3 → 3 | 0 / 0 / 0 | 2 | 3 / 3 / 2 |
| 41 | `astro-rescue-hangar` | Astro Rescue Hangar | Astro Bot | Paragon | 1 → 1 | 0 / 0 / 0 | 2 | 1 / 2 / 1 |
| 42 | `machinarium-repair-yard` | Machinarium Repair Yard | Machinarium | Paragon | 1 → 1 | 0 / 0 / 0 | 2 | 1 / 2 / 1 |
| 43 | `b12-companion-workshop` | B12 Companion Workshop | Stray | Paragon | 1 → 1 | 0 / 0 / 0 | 2 | 1 / 2 / 1 |
| 44 | `new-jerusalem-foundry` | New Jerusalem Foundry | The Talos Principle | Paragon | 1 → 1 | 0 / 0 / 0 | 2 | 1 / 2 / 1 |
| 45 | `v-model-combat-lab` | V Model Combat Lab | ULTRAKILL | Duo | 2 → 2 | 0 / 0 / 0 | 2 | 3 / 3 / 1 |
| 46 | `guardian-reboot-camp` | Guardian Reboot Camp | Roboquest | Duo | 2 → 2 | 0 / 0 / 0 | 2 | 3 / 3 / 1 |
| 47 | `rift-walker-hangar` | Rift Walker Hangar | Into the Breach | Trio | 3 → 3 | 0 / 0 / 0 | 2 | 3 / 3 / 1 |
| 48 | `forerunner-sentinel-array` | Forerunner Sentinel Array | Halo | Swarm | 11 → 11 | 0 / 0 / 0 | 1 | 19 / 14 / 0 |
| 49 | `last-city-exo-foundry` | Last City Exo Foundry | Destiny | Trio | 3 → 3 | 0 / 0 / 0 | 2 | 3 / 3 / 1 |
| 50 | `gray-mann-robot-works` | Gray Mann Robot Works | Team Fortress 2 | Swarm | 11 → 11 | 0 / 0 / 0 | 1 | 11 / 2 / 0 |
| 51 | `fazbear-arena-entertainment` | Fazbear Arena Entertainment | Five Nights at Freddy's | Tycoon | 3 → 3 | 0 / 0 / 0 | 1 | 3 / 3 / 1 |
| 52 | `ray-custom-robo-lab` | Ray Custom Robo Lab | Custom Robo | Duo | 2 → 2 | 0 / 0 / 0 | 2 | 3 / 5 / 1 |
| 53 | `medabot-tournament-club` | Medabot Tournament Club | Medabots | Duo | 2 → 2 | 0 / 0 / 0 | 2 | 3 / 3 / 1 |
| 54 | `virtual-on-combat-lab` | Virtual On Combat Lab | Virtual-On | Duo | 2 → 2 | 0 / 0 / 0 | 2 | 2 / 3 / 1 |
| 55 | `war-arena-foundry` | WAR Arena Foundry | One Must Fall: 2097 | Trio | 3 → 3 | 0 / 0 / 0 | 2 | 3 / 6 / 1 |
| 56 | `metropolis-combat-systems` | Metropolis Combat Systems | Rise of the Robots | Paragon | 1 → 1 | 0 / 0 / 0 | 3 | 2 / 3 / 1 |
| 57 | `clone-drone-combat-factory` | Clone Drone Combat Factory | Clone Drone in the Danger Zone | Swarm | 11 → 11 | 0 / 0 / 0 | 1 | 11 / 14 / 0 |
| 58 | `robocraft-assembly-yard` | Robocraft Assembly Yard | Robocraft | Tycoon | 3 → 3 | 0 / 0 / 0 | 1 | 3 / 6 / 1 |
| 59 | `ptmc-mining-rebellion` | PTMC Mining Rebellion | Descent | Swarm | 11 → 11 | 0 / 0 / 0 | 1 | 11 / 14 / 0 |
| 60 | `citadel-robot-security` | Citadel Robot Security | System Shock | Swarm | 11 → 11 | 0 / 0 / 0 | 1 | 11 / 14 / 0 |
| 61 | `toa-foundry` | Toa Foundry | Bionicle | Generalist | 4 → 4 | 0 / 0 / 0 | 1 | 4 / 3 / 1 |
| 62 | `soong-android-institute` | Soong Android Institute | Star Trek | Trio | 3 → 3 | 0 / 0 / 0 | 3 | 3 / 4 / 1 |
| 63 | `jupiter-robot-hangar` | Jupiter Robot Hangar | Lost in Space | Paragon | 2 → 2 | 0 / 0 / 0 | 1 | 2 / 3 / 0 |
| 64 | `altair-service-robotics` | Altair Service Robotics | Forbidden Planet | Paragon | 1 → 1 | 0 / 0 / 0 | 2 | 1 / 2 / 1 |
| 65 | `sirius-cybernetics-arena` | Sirius Cybernetics Arena | The Hitchhiker's Guide to the Galaxy | Paragon | 1 → 1 | 0 / 0 / 0 | 2 | 1 / 2 / 1 |
| 66 | `satellite-six-robot-club` | Satellite Six Robot Club | Mystery Science Theater 3000 | Tycoon | 3 → 3 | 0 / 0 / 0 | 1 | 3 / 2 / 1 |
| 67 | `cygnus-robotics-division` | Cygnus Robotics Division | The Black Hole | Duo | 3 → 3 | 0 / 0 / 0 | 1 | 4 / 3 / 0 |
| 68 | `valley-forge-maintenance` | Valley Forge Maintenance | Silent Running | Trio | 3 → 3 | 0 / 0 / 0 | 2 | 3 / 3 / 1 |
| 69 | `fix-it-foundry` | Fix It Foundry | *batteries not included | Duo | 3 → 3 | 0 / 0 / 0 | 1 | 3 / 8 / 1 |
| 70 | `ndr-precision-workshop` | NDR Precision Workshop | Bicentennial Man | Paragon | 1 → 1 | 0 / 0 / 0 | 2 | 1 / 2 / 1 |
| 71 | `cybertronics-mecha-lab` | Cybertronics Mecha Lab | A.I. Artificial Intelligence | Paragon | 2 → 2 | 0 / 0 / 0 | 2 | 2 / 4 / 0 |
| 72 | `delos-host-division` | Delos Host Division | Westworld | Tycoon | 3 → 3 | 0 / 0 / 0 | 2 | 3 / 3 / 1 |
| 73 | `weyland-synthetic-unit` | Weyland Synthetic Unit | Alien | Duo | 3 → 3 | 0 / 0 / 0 | 2 | 4 / 4 / 0 |
| 74 | `druidia-droid-service` | Druidia Droid Service | Spaceballs | Paragon | 1 → 1 | 0 / 0 / 0 | 2 | 1 / 2 / 1 |
| 75 | `metropolis-automaton-lab` | Metropolis Automaton Lab | Metropolis | Paragon | 1 → 1 | 0 / 0 / 0 | 2 | 1 / 2 / 1 |
| 76 | `rozzum-wilderness-works` | Rozzum Wilderness Works | The Wild Robot | Paragon | 1 → 1 | 0 / 0 / 0 | 2 | 1 / 2 / 1 |
| 77 | `project-7723` | Project 7723 | Next Gen | Paragon | 1 → 1 | 0 / 0 / 0 | 2 | 2 / 2 / 1 |
| 78 | `bubble-companion-lab` | Bubble Companion Lab | Ron's Gone Wrong | Paragon | 1 → 1 | 0 / 0 / 0 | 2 | 1 / 2 / 1 |
| 79 | `copper-nine-drone-works` | Copper Nine Drone Works | Murder Drones | Trio | 4 → 4 | 0 / 0 / 0 | 3 | 4 / 4 / 0 |
| 80 | `wakeman-robot-workshop` | Wakeman Robot Workshop | My Life as a Teenage Robot | Paragon | 1 → 1 | 0 / 0 / 0 | 2 | 2 / 2 / 1 |
| 81 | `irken-droid-outpost` | Irken Droid Outpost | Invader Zim | Paragon | 2 → 2 | 0 / 0 / 0 | 1 | 2 / 5 / 0 |
| 82 | `tenma-robotics-institute` | Tenma Robotics Institute | Astro Boy | Paragon | 2 → 2 | 0 / 0 / 0 | 2 | 3 / 4 / 0 |
| 83 | `special-vehicle-robot-unit` | Special Vehicle Robot Unit | Patlabor | Duo | 2 → 2 | 0 / 0 / 0 | 2 | 2 / 6 / 1 |
| 84 | `section-nine-tachikomas` | Section Nine Tachikomas | Ghost in the Shell | Swarm | 11 → 11 | 0 / 0 / 0 | 1 | 11 / 14 / 0 |
| 85 | `olympus-landmate-hangar` | Olympus Landmate Hangar | Appleseed | Duo | 2 → 2 | 0 / 0 / 0 | 2 | 3 / 3 / 1 |
| 86 | `photon-power-institute` | Photon Power Institute | Mazinger | Duo | 2 → 2 | 0 / 0 / 0 | 2 | 2 / 3 / 1 |
| 87 | `saotome-getter-laboratory` | Saotome Getter Laboratory | Getter Robo | Paragon | 1 → 1 | 0 / 0 / 0 | 2 | 1 / 2 / 1 |
| 88 | `voltron-lion-hangar` | Voltron Lion Hangar | Voltron | Trio | 4 → 4 | 0 / 0 / 0 | 2 | 4 / 4 / 0 |
| 89 | `macross-valkyrie-squadron` | Macross Valkyrie Squadron | Macross | Trio | 3 → 3 | 0 / 0 / 0 | 2 | 3 / 3 / 1 |
| 90 | `knightmare-frame-foundry` | Knightmare Frame Foundry | Code Geass | Trio | 3 → 3 | 0 / 0 / 0 | 2 | 3 / 3 / 1 |
| 91 | `dai-gurren-workshop` | Dai Gurren Workshop | Gurren Lagann | Duo | 2 → 2 | 0 / 0 / 0 | 2 | 2 / 3 / 1 |
| 92 | `paradigm-megadeus-hangar` | Paradigm Megadeus Hangar | The Big O | Paragon | 1 → 1 | 0 / 0 / 0 | 2 | 1 / 2 / 1 |
| 93 | `giant-robo-command` | Giant Robo Command | Giant Robo | Paragon | 1 → 1 | 0 / 0 / 0 | 2 | 1 / 2 / 1 |
| 94 | `zoids-arena-forge` | Zoids Arena Forge | Zoids | Generalist | 3 → 3 | 0 / 0 / 0 | 2 | 4 / 3 / 2 |
| 95 | `hero-factory-assembly` | Hero Factory Assembly | Hero Factory | Trio | 3 → 3 | 0 / 0 / 0 | 2 | 3 / 3 / 1 |
| 96 | `nindroid-assembly-line` | Nindroid Assembly Line | Ninjago | Swarm | 11 → 11 | 0 / 0 / 0 | 1 | 11 / 12 / 0 |
| 97 | `gobotron-guardian-fleet` | Gobotron Guardian Fleet | GoBots | Trio | 3 → 3 | 0 / 0 / 0 | 2 | 3 / 3 / 1 |
| 98 | `ultron-sentry-network` | Ultron Sentry Network | Marvel — Ultron | Swarm | 11 → 11 | 0 / 0 / 0 | 1 | 11 / 14 / 0 |
| 99 | `metal-men-laboratory` | Metal Men Laboratory | DC — Metal Men | Trio | 4 → 4 | 0 / 0 / 0 | 2 | 4 / 6 / 0 |
| 100 | `moshimo-robotics` | Moshimo Robotics | Robotboy | Duo | 3 → 3 | 0 / 0 / 0 | 1 | 4 / 3 / 0 |
| 101 | `geonosis-droid-foundry` | Geonosis Droid Foundry | Star Wars — Separatist Droid Army | Swarm | 11 → 11 | 0 / 0 / 0 | 0 | 11 / 12 / 0 |
| 102 | `rebel-droid-partnership` | Rebel Droid Partnership | Star Wars — Skywalker Saga | Duo | 2 → 2 | 0 / 0 / 0 | 1 | 3 / 2 / 0 |
| 103 | `droid-bounty-syndicate` | Droid Bounty Syndicate | Star Wars — Bounty Hunters | Trio | 3 → 3 | 0 / 0 / 0 | 2 | 3 / 3 / 0 |
| 104 | `grievous-war-forge` | Grievous War Forge | Star Wars — The Clone Wars | Paragon | 1 → 1 | 0 / 0 / 0 | 1 | 2 / 1 / 0 |
| 105 | `rebel-droid-network` | Rebel Droid Network | Star Wars — Rebel Alliance | Generalist | 3 → 3 | 0 / 0 / 0 | 2 | 3 / 3 / 1 |
| 106 | `jawa-salvage-exchange` | Jawa Salvage Exchange | Star Wars — Jawas | Tycoon | 3 → 3 | 0 / 0 / 0 | 0 | 3 / 4 / 1 |
| 107 | `cyberstan-iron-legion` | Cyberstan Iron Legion | Helldivers | Swarm | 11 → 11 | 0 / 0 / 0 | 0 | 11 / 13 / 0 |
| 108 | `angel-grove-zord-command` | Angel Grove Zord Command | Power Rangers | Duo | 2 → 2 | 0 / 0 / 0 | 1 | 3 / 2 / 0 |
| 109 | `sewer-circuit-workshop` | Sewer Circuit Workshop | Teenage Mutant Ninja Turtles | Generalist | 3 → 3 | 0 / 0 / 0 | 1 | 3 / 2 / 1 |
| 110 | `zdr-pursuit-unit` | ZDR Pursuit Unit | Metroid | Trio | 3 → 3 | 0 / 0 / 0 | 1 | 3 / 2 / 0 |
| 111 | `gero-android-laboratory` | Gero Android Laboratory | Dragon Ball | Trio | 3 → 3 | 0 / 0 / 0 | 2 | 3 / 3 / 0 |
| 112 | `aumaan-orbital-foundry` | Aumaan Orbital Foundry | Zone of the Enders | Duo | 2 → 2 | 0 / 0 / 0 | 1 | 2 / 2 / 0 |
| 113 | `corpus-proxy-exchange` | Corpus Proxy Exchange | Warframe | Trio | 6 → 6 | 0 / 0 / 0 | 0 | 1 / 0 / 0 |
| 114 | `walking-war-foundry` | Walking War Foundry | War Robots | Trio | 6 → 6 | 0 / 0 / 0 | 0 | 1 / 0 / 0 |
| 115 | `polanian-dieselworks` | Polanian Dieselworks | Iron Harvest | Tycoon | 3 → 3 | 0 / 0 / 0 | 0 | 5 / 4 / 1 |
| 116 | `vaucanson-clockwork-atelier` | Vaucanson Clockwork Atelier | Steelrising | Paragon | 1 → 1 | 0 / 0 / 0 | 1 | 1 / 1 / 0 |
| 117 | `robot-systems-workshop` | Robot Systems Workshop | Invincible | Paragon | 1 → 1 | 0 / 0 / 0 | 1 | 2 / 1 / 0 |
| 118 | `core-war-foundry` | CORE War Foundry | Total Annihilation | Swarm | 11 → 11 | 0 / 0 / 0 | 0 | 11 / 13 / 0 |
| 119 | `arena-systems-consortium` | Arena Systems Consortium | Mech Arena | Trio | 6 → 6 | 0 / 0 / 0 | 1 | 1 / 1 / 0 |
| 120 | `striker-assembly-wing` | Striker Assembly Wing | Mecha BREAK | Trio | 3 → 3 | 0 / 0 / 0 | 1 | 3 / 2 / 0 |
| 121 | `arsenal-mercenary-works` | Arsenal Mercenary Works | Daemon X Machina | Tycoon | 3 → 3 | 0 / 0 / 0 | 0 | 3 / 5 / 1 |
| 122 | `infinite-war-assembly` | Infinite War Assembly | Supreme Commander | Tycoon | 3 → 3 | 0 / 0 / 0 | 0 | 3 / 4 / 1 |
| 123 | `terra-nova-gearworks` | Terra Nova Gearworks | Heavy Gear | Trio | 6 → 6 | 0 / 0 / 0 | 0 | 1 / 0 / 0 |
| 124 | `variant-armor-foundry` | Variant Armor Foundry | Cyberbots | Generalist | 3 → 3 | 0 / 0 / 0 | 1 | 3 / 3 / 1 |
| 125 | `scopedog-motor-pool` | Scopedog Motor Pool | Armored Trooper VOTOMS | Trio | 3 → 3 | 0 / 0 / 0 | 1 | 3 / 2 / 0 |
| 126 | `mithril-arm-slave-hangar` | Mithril Arm Slave Hangar | Full Metal Panic! | Duo | 2 → 2 | 0 / 0 / 0 | 2 | 2 / 3 / 0 |
| 127 | `gutsy-robot-command` | Gutsy Robot Command | The King of Braves GaoGaiGar | Trio | 6 → 6 | 0 / 0 / 0 | 0 | 1 / 0 / 0 |
| 128 | `buster-machine-hangar` | Buster Machine Hangar | Gunbuster | Paragon | 1 → 1 | 0 / 0 / 0 | 1 | 1 / 1 / 0 |
| 129 | `krat-puppet-workshop` | Krat Puppet Workshop | Lies of P | Paragon | 1 → 1 | 0 / 0 / 0 | 2 | 2 / 2 / 0 |
| 130 | `vector-android-division` | Vector Android Division | Xenosaga | Paragon | 1 → 1 | 0 / 0 / 0 | 2 | 1 / 2 / 0 |
| 131 | `ruin-era-synthetic-unit` | Ruin-Era Synthetic Unit | Casshern | Trio | 3 → 3 | 0 / 0 / 0 | 2 | 3 / 3 / 0 |
| 132 | `medical-mechanica-repair-yard` | Medical Mechanica Repair Yard | FLCL | Paragon | 1 → 1 | 0 / 0 / 0 | 1 | 1 / 1 / 0 |
| 133 | `three-robots-expedition` | Three Robots Expedition | Love, Death & Robots | Trio | 3 → 3 | 0 / 0 / 0 | 1 | 3 / 2 / 0 |
| 134 | `orbit-city-serviceworks` | Orbit City Serviceworks | The Jetsons | Paragon | 1 → 1 | 0 / 0 / 0 | 1 | 1 / 1 / 0 |
| 135 | `wasteland-caretaker-workshop` | Wasteland Caretaker Workshop | Finch | Paragon | 1 → 1 | 0 / 0 / 0 | 2 | 1 / 2 / 0 |
| 136 | `companion-robotics-bureau` | Companion Robotics Bureau | Robot & Frank | Paragon | 1 → 1 | 0 / 0 / 0 | 1 | 2 / 2 / 0 |
| 137 | `factory-night-shift` | Factory Night Shift | Robo Rally | Trio | 6 → 6 | 0 / 0 / 0 | 0 | 1 / 0 / 0 |
| 138 | `evangelion-unit-hangar` | Evangelion Unit Hangar | Neon Genesis Evangelion | Trio | 3 → 3 | 0 / 0 / 0 | 1 | 3 / 2 / 0 |
| 139 | `mark-13-salvage-works` | MARK-13 Salvage Works | Hardware | Paragon | 1 → 1 | 0 / 0 / 0 | 2 | 1 / 2 / 0 |
| 140 | `saturn-three-robotics` | Saturn Three Robotics | Saturn 3 | Paragon | 1 → 1 | 0 / 0 / 0 | 2 | 1 / 2 / 0 |
| 141 | `robot-jox-arena-hangar` | Robot Jox Arena Hangar | Robot Jox | Duo | 2 → 2 | 0 / 0 / 0 | 2 | 3 / 6 / 0 |
| 142 | `oblivion-drone-array` | Oblivion Drone Array | Oblivion | Paragon | 1 → 1 | 0 / 0 / 0 | 1 | 2 / 1 / 0 |
| 143 | `sakura-spiricle-workshop` | Sakura Spiricle Workshop | Sakura Wars | Duo | 2 → 2 | 0 / 0 / 0 | 1 | 5 / 4 / 0 |
| 144 | `breakwater-salvage-union` | Breakwater Salvage Union | Armoured Souls original | Tycoon | 3 → 3 | 0 / 0 / 0 | 0 | 3 / 5 / 1 |
| 145 | `pelagic-pressure-works` | Pelagic Pressure Works | Armoured Souls original | Generalist | 3 → 3 | 0 / 0 / 0 | 1 | 3 / 6 / 1 |
| 146 | `lunar-yard-consortium` | Lunar Yard Consortium | Armoured Souls original | Trio | 3 → 3 | 0 / 0 / 0 | 1 | 3 / 7 / 0 |
| 147 | `kilnheart-foundry` | Kilnheart Foundry | Armoured Souls original | Duo | 2 → 2 | 0 / 0 / 0 | 1 | 3 / 2 / 0 |
| 148 | `clockwork-audit-house` | Clockwork Audit House | Armoured Souls original | Paragon | 1 → 1 | 0 / 0 / 0 | 1 | 1 / 1 / 0 |
| 149 | `municipal-reclamation-grid` | Municipal Reclamation Grid | Armoured Souls original | Swarm | 11 → 11 | 0 / 0 / 0 | 1 | 11 / 14 / 0 |
| 150 | `aphras-rogue-droid-pair` | Aphras Rogue Droid Pair | Star Wars — Doctor Aphra | Duo | 2 → 2 | 0 / 0 / 0 | 1 | 5 / 2 / 0 |
| 151 | `hk-assassin-protocol` | HK Assassin Protocol | Star Wars — Legends | Paragon | 1 → 1 | 0 / 0 / 0 | 1 | 1 / 1 / 0 |
| 152 | `bd-expedition-workshop` | BD Expedition Workshop | Star Wars — Jedi: Fallen Order | Paragon | 1 → 1 | 0 / 0 / 0 | 2 | 1 / 2 / 0 |
| 153 | `outlaw-droid-workshop` | Outlaw Droid Workshop | Star Wars — Outlaws | Paragon | 1 → 1 | 0 / 0 / 0 | 2 | 1 / 3 / 0 |
| 154 | `cyberman-conversion-works` | Cyberman Conversion Works | Doctor Who — Cybermen | Swarm | 11 → 11 | 0 / 0 / 0 | 1 | 11 / 12 / 0 |
| 155 | `k9-companion-workshop` | K9 Companion Workshop | Doctor Who — K9 | Paragon | 1 → 1 | 0 / 0 / 0 | 2 | 1 / 3 / 0 |
| 156 | `sentinel-enforcement-array` | Sentinel Enforcement Array | Marvel — Sentinels | Swarm | 11 → 11 | 0 / 0 / 0 | 1 | 20 / 13 / 0 |
| 157 | `vision-synthetic-workshop` | Vision Synthetic Workshop | Marvel — Vision | Paragon | 1 → 1 | 0 / 0 / 0 | 2 | 1 / 3 / 0 |
| 158 | `justice-android-laboratory` | Justice Android Laboratory | DC — Justice League | Duo | 2 → 2 | 0 / 0 / 0 | 3 | 2 / 5 / 0 |
| 159 | `wily-robot-master-foundry` | Wily Robot Master Foundry | Mega Man — Robot Masters | Trio | 6 → 6 | 0 / 0 / 0 | 0 | 1 / 0 / 0 |
| 160 | `maverick-hunter-workshop` | Maverick Hunter Workshop | Mega Man — Maverick Hunters | Duo | 2 → 2 | 0 / 0 / 0 | 3 | 2 / 4 / 0 |
| 161 | `zeon-mobile-suit-hangar` | Zeon Mobile Suit Hangar | Gundam | Trio | 3 → 3 | 0 / 0 / 0 | 1 | 3 / 2 / 0 |
| 162 | `dinobot-forge` | Dinobot Forge | Transformers — Dinobots | Generalist | 3 → 3 | 0 / 0 / 0 | 3 | 3 / 4 / 1 |
| 163 | `e-series-combat-works` | E-Series Combat Works | Sonic the Hedgehog — E-Robots | Duo | 2 → 2 | 0 / 0 / 0 | 2 | 2 / 3 / 0 |
| 164 | `citadel-mechworks` | Citadel Mechworks | Mass Effect — Security Mechs | Generalist | 3 → 3 | 0 / 0 / 0 | 3 | 3 / 4 / 1 |
| 165 | `machine-village-foundry` | Machine Village Foundry | NieR | Generalist | 3 → 3 | 0 / 0 / 0 | 1 | 3 / 5 / 1 |
| 166 | `machine-city-sentinel-array` | Machine City Sentinel Array | The Matrix | Swarm | 11 → 11 | 0 / 0 / 0 | 1 | 20 / 16 / 0 |
| 167 | `neo-tokyo-security-works` | Neo-Tokyo Security Works | Akira | Paragon | 1 → 1 | 0 / 0 / 0 | 1 | 1 / 2 / 0 |
| 168 | `encom-program-arena` | ENCOM Program Arena | TRON | Trio | 3 → 3 | 0 / 0 / 0 | 2 | 3 / 4 / 0 |
| 169 | `endurance-robotics-pair` | Endurance Robotics Pair | Interstellar | Duo | 2 → 2 | 0 / 0 / 0 | 1 | 3 / 3 / 0 |
| 170 | `blue-book-synthetic-laboratory` | Blue Book Synthetic Laboratory | Ex Machina | Paragon | 1 → 1 | 0 / 0 / 0 | 1 | 1 / 2 / 0 |
| 171 | `companion-defence-laboratory` | Companion Defence Laboratory | M3GAN | Duo | 2 → 2 | 0 / 0 / 0 | 3 | 2 / 5 / 0 |
| 172 | `repopulation-facility-robotics` | Repopulation Facility Robotics | I Am Mother | Paragon | 1 → 1 | 0 / 0 / 0 | 1 | 1 / 2 / 0 |
| 173 | `simulant-refuge-workshop` | Simulant Refuge Workshop | The Creator | Generalist | 3 → 3 | 0 / 0 / 0 | 2 | 3 / 7 / 1 |
| 174 | `iron-city-berserker-workshop` | Iron City Berserker Workshop | Alita: Battle Angel | Paragon | 1 → 1 | 0 / 0 / 0 | 1 | 2 / 2 / 0 |
| 175 | `kaylon-assembly-array` | Kaylon Assembly Array | The Orville | Swarm | 11 → 11 | 0 / 0 / 0 | 0 | 11 / 12 / 0 |
| 176 | `kepler-android-caretakers` | Kepler Android Caretakers | Raised by Wolves | Duo | 2 → 2 | 0 / 0 / 0 | 2 | 2 / 4 / 0 |
| 177 | `trantor-imperial-robotics` | Trantor Imperial Robotics | Foundation | Paragon | 1 → 1 | 0 / 0 / 0 | 2 | 1 / 3 / 0 |
| 178 | `stitchpunk-salvage-circle` | Stitchpunk Salvage Circle | 9 | Trio | 3 → 3 | 0 / 0 / 0 | 2 | 3 / 4 / 0 |
| 179 | `city-companion-repair-shop` | City Companion Repair Shop | Robot Dreams | Paragon | 1 → 1 | 0 / 0 / 0 | 1 | 1 / 2 / 0 |
| 180 | `eden-agricultural-workshop` | Eden Agricultural Workshop | Eden | Duo | 2 → 2 | 0 / 0 / 0 | 2 | 3 / 4 / 0 |
| 181 | `seven-great-robots-workshop` | Seven Great Robots Workshop | PLUTO | Trio | 6 → 6 | 0 / 0 / 0 | 1 | 1 / 2 / 0 |
| 182 | `nialand-ai-partnership` | NiaLand AI Partnership | Vivy: Fluorite Eye's Song | Duo | 2 → 2 | 0 / 0 / 0 | 2 | 2 / 4 / 0 |
| 183 | `legion-autonomous-arsenal` | Legion Autonomous Arsenal | 86 Eighty-Six | Swarm | 11 → 11 | 0 / 0 / 0 | 0 | 14 / 14 / 0 |
| 184 | `sierpinski-replika-workshop` | Sierpinski Replika Workshop | SIGNALIS | Paragon | 1 → 1 | 0 / 0 / 0 | 2 | 1 / 3 / 0 |
| 185 | `erlins-eye-sleeper-workshop` | Erlins Eye Sleeper Workshop | Citizen Sleeper | Paragon | 1 → 1 | 0 / 0 / 0 | 1 | 3 / 3 / 0 |
| 186 | `skeleton-drifter-workshop` | Skeleton Drifter Workshop | Kenshi | Generalist | 3 → 3 | 0 / 0 / 0 | 1 | 3 / 3 / 1 |
| 187 | `glitch-feudal-forge` | Glitch Feudal Forge | Starbound | Tycoon | 3 → 3 | 0 / 0 / 0 | 0 | 3 / 2 / 1 |
| 188 | `dunes-salvage-partnership` | Dunes Salvage Partnership | Primordia | Duo | 2 → 2 | 0 / 0 / 0 | 1 | 2 / 3 / 0 |
| 189 | `union-city-circuit-workshop` | Union City Circuit Workshop | Beneath a Steel Sky | Paragon | 1 → 1 | 0 / 0 / 0 | 1 | 1 / 2 / 0 |
| 190 | `chimera-city-scrapworks` | Chimera City Scrapworks | Scrapland | Paragon | 1 → 1 | 0 / 0 / 0 | 1 | 1 / 2 / 0 |
| 191 | `last-quiet-day-repair-works` | Last Quiet Day Repair Works | The Uncertain: Last Quiet Day | Paragon | 1 → 1 | 0 / 0 / 0 | 2 | 1 / 3 / 0 |
| 192 | `scrap-garden-restoration-shop` | Scrap Garden Restoration Shop | Scrap Garden | Paragon | 1 → 1 | 0 / 0 / 0 | 1 | 1 / 2 / 0 |
| 193 | `bravern-heroic-arsenal` | Bravern Heroic Arsenal | Brave Bang Bravern! | Paragon | 1 → 1 | 0 / 0 / 0 | 1 | 2 / 2 / 0 |
| 194 | `safeguard-enforcement-workshop` | Safeguard Enforcement Workshop | BLAME! | Paragon | 1 → 1 | 0 / 0 / 0 | 2 | 1 / 3 / 0 |
| 195 | `gunhed-autonomous-works` | GUNHED Autonomous Works | GUNHED | Paragon | 1 → 1 | 0 / 0 / 0 | 1 | 1 / 2 / 0 |
| 196 | `series-4000-service-workshop` | Series 4000 Service Workshop | Red Dwarf | Paragon | 1 → 1 | 0 / 0 / 0 | 1 | 1 / 2 / 0 |
| 197 | `interplanetary-peacekeeper-works` | Interplanetary Peacekeepers | The Day the Earth Stood Still | Paragon | 1 → 1 | 0 / 0 / 0 | 1 | 2 / 2 / 0 |
| 198 | `virgil-test-facility-workshop` | Virgil Test Facility Workshop | Portal Stories: Mel | Paragon | 1 → 1 | 0 / 0 / 0 | 1 | 1 / 2 / 0 |
| 199 | `wilson-resistance-salvage-works` | Wilson Resistance Salvageworks | Entropy: Zero 2 | Paragon | 1 → 1 | 0 / 0 / 0 | 1 | 3 / 2 / 0 |
| 200 | `steamworks-robot-partnership` | Steamworks Robot Partnership | Undertale Yellow | Duo | 2 → 2 | 0 / 0 / 0 | 1 | 2 / 3 / 0 |
| 201 | `candys-animatronic-workshop` | Candys Animatronic Workshop | Five Nights at Candy's | Tycoon | 3 → 3 | 0 / 0 / 0 | 0 | 4 / 2 / 1 |
| 202 | `sweetie-circuit-atelier` | Sweetie Circuit Atelier | My Little Pony — Steel Soul | Paragon | 1 → 1 | 0 / 0 / 0 | 1 | 1 / 2 / 0 |
| 203 | `nemesis-ai-arsenal` | Nemesis AI Arsenal | The Last Angel | Paragon | 1 → 1 | 0 / 0 / 0 | 1 | 1 / 2 / 0 |
| 204 | `chrysalis-reconstruction-array` | Chrysalis Reconstruction Array | Chrysalis | Swarm | 11 → 11 | 0 / 0 / 0 | 0 | 11 / 14 / 0 |
| 205 | `sanctuary-secunit-workshop` | Sanctuary SecUnit Workshop | The Murderbot Diaries | Paragon | 1 → 1 | 0 / 0 / 0 | 2 | 1 / 2 / 0 |

194 stables, 645 blueprints. With the 11 starter stables (50 blueprints) the repository catalogue would hold 205 stables and 695 blueprints.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 2. Field rules

The field rules are spec 55's, unchanged: spec-55 `review/CATALOGUE.md` §2 (field table, teams, events, refinement plans, name collisions, images) and design §15.1 (file format and schema rules). `tools/validate.py` applies them to every entry below; `review/FINDINGS.md` lists what fails.

Conventions in this document:

- **Refinement plans** are generated by `tools/refine_plan.py`, the decision-35/36 rule that reproduces all 50 approved starter plans exactly: Sharpen, Sharpen, Forge, Forge on every non-shield weapon (two weapons interleaved), a fifth Hone/Augment only when cheaper than the same + on the robot at the strategy's last milestone and season-end Training Facility discount, and five Hone +1 Evasion Thrusters on an Aegis Bulwark where ₡10,000 is below +1 on the robot. The source plans were empty or misordered (FINDINGS V13); these generated plans replace them and need your confirmation.
- **Re-confirmed against the built spec-55 code**: plans, strategies and blueprints use the rule facts exported from the built code (strategies, Build_Focus, catalogue limits, Team_Rule, `canEquipToSlot`, built pricing `attributeIncrementCost` / `refinementStepCost`), and every entry passes the built `catalogueEntrySchema`, `loadCatalogueDirectory` and a two-season strategy-runner projection (`tools/check-built.ts`).
- **Names**: stable names are checked with the whole-word profanity rule of `bugfix/profanity-whole-word-matching` (merged to `main` in PR #528); team names are unique across all repository entries (exact), as are robot names (`FINDINGS.md` lists any repeat still open).
- **Changes from your draft** under each stable lists every field a recorded decision changed (old → new, decision number; "delegated authoring" where you delegated the wording).
- **Images**: `app/frontend/public/assets/automatons/{catalogueKey}/{slot}.webp`, 512×512 WebP, found by convention (spec-55 decisions 27–28). 645 of 645 expansion slots have a portrait; a robot without a file starts with no image.
- **Art briefs** longer than one line (full image prompts) are shown as a short excerpt: the `Subject:` paragraph's first sentence, else the first sentence, capped at 200 characters; the full text stays in `source/`.
- **Range** is informational: the range the stage-0 weapons give.
- Storage notes are estimates of the final weapons equipped; the engine decides at run time.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 3. Aperture Test Division (`aperture-test-division`) — Duo

| Field | Value |
|---|---|
| Stable name | Aperture Test Division |
| Franchise label | Portal |
| Backstory | Aperture Test Division enters the arena with a clear doctrine. Invest in a complementary pair: compact defensive anchor and tall mobile shooter. Every surviving machine returns to the workshop before the next booking. |
| Strategy | Duo |
| Target overrides | none (goal 13 Robots → 2, the strategy default) |
| Team names | 2v2: **Cooperative Testing Initiative** (robots 1+2) · 3v3: none |
| Event order | `tag_team`, `league_2v2`, `tournament_2v2`, `league_1v1`, `koth`, `grand_melee`, `tournament_1v1`, `league_3v3`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- 2v2 team 1+2: 'Aperture Pair 01' → 'Cooperative Testing Initiative' (decision 3; delegated authoring)

Every blueprint is used at the robots target of 2; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | ATLAS | `weapon_shield` | short | defensive | 20 | Warden | Round Aperture test robot, blue central optic, white shell and exposed dark joints. | `aperture-test-division/1.webp` |
| 2 | P-body | `single` | short | offensive | 15 | Sprinter | Tall narrow Aperture test robot, orange optic, white shell, long mechanical limbs. | `aperture-test-division/2.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 ATLAS | Laser Pistol + Light Shield (₡108,000) | Volt Sabre + Aegis Bulwark (₡834,000) |
| 2 P-body | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |

**Refinement plans** (generated; applied by Duo goal 17, Refine → 10 steps per robot). All 2 robots: 15 steps, ₡5,670,000; the 2 robots at the target: ₡5,670,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| ATLAS (10 steps, ₡2,860,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (8 → 9) ₡10,000 | ₡2,810,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |
| P-body (5 steps, ₡2,810,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Power Core +1 (−3 → −2) ₡10,000 | ₡2,810,000 |

Storage (estimate; the engine counts at run time): 3 final weapons equipped at the robots target of 2. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5), A04 ×1 (decision 4).

Source findings before decisions: A01 ×1, A03 ×1, A04 ×1, A11 ×1, V13 ×2.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 4. Axiom Salvage Crew (`axiom-salvage-crew`) — Duo

| Field | Value |
|---|---|
| Stable name | Axiom Salvage Crew |
| Franchise label | WALL-E |
| Backstory | Axiom Salvage Crew enters the arena with a clear doctrine. A durable salvager beside a precise ranged partner. Every surviving machine returns to the workshop before the next booking. |
| Strategy | Duo |
| Target overrides | goal 11 Booking Office → L6 (strategy default L4, allowed L0–L6); goal 13 Robots → 3 (strategy default 2, allowed 2–3) |
| Team names | 2v2: **Plant Directive** (robots 1+2) · 3v3: **Operation Recolonize** (1–3) |
| Event order | `tag_team`, `league_2v2`, `tournament_2v2`, `league_1v1`, `koth`, `grand_melee`, `tournament_1v1`, `league_3v3`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- 2v2 team 1+2: 'Axiom Pair 01' → 'Plant Directive' (decision 3; delegated authoring)
- 3v3 team 1+2+3: 'Axiom Squad 01' → 'Operation Recolonize' (decision 3; delegated authoring)
- Goal 11 Booking Office target: L4 → L6 (decision 5)
- Goal 13 Robots target: 2 → 3 (decision 5)

Every blueprint is used at the robots target of 3; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | WALL-E | `weapon_shield` | melee | defensive | 25 | Warden | Weathered yellow tracked waste robot, binocular eyes, compact lifting arms. | `axiom-salvage-crew/1.webp` |
| 2 | EVE | `single` | long | offensive | 10 | Deadeye | Smooth white probe robot with blue eyes and an integrated emitter. | `axiom-salvage-crew/2.webp` |
| 3 | M-O | `single` | short | defensive | 30 | Tactician | Small white cleaner robot on a roller ball, black face screen and cleaning tool. | `axiom-salvage-crew/3.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 WALL-E | Practice Sword + Light Shield (₡101,000) | Vibro Mace + Aegis Bulwark (₡834,000) |
| 2 EVE | Beam Pistol (₡93,000) | Particle Lance (₡425,000) |
| 3 M-O | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |

**Refinement plans** (generated; applied by Duo goal 17, Refine → 10 steps per robot). All 3 robots: 20 steps, ₡8,550,000; the 3 robots at the target: ₡8,550,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| WALL-E (10 steps, ₡2,890,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Counter Protocols +2 (5 → 7) ₡40,000 | ₡2,840,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |
| EVE (5 steps, ₡2,840,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +2 (5 → 7) ₡40,000 | ₡2,840,000 |
| M-O (5 steps, ₡2,820,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Combat Algorithms +1 (new) ₡20,000 | ₡2,820,000 |

Storage (estimate; the engine counts at run time): 4 final weapons equipped at the robots target of 3. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A04 ×1 (decision 4).

Source findings before decisions: A03 ×1, A04 ×1, A07 ×1, A12 ×1, V13 ×3.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 5. Rannoch Geth Consensus (`rannoch-geth-consensus`) — Swarm

| Field | Value |
|---|---|
| Stable name | Rannoch Geth Consensus |
| Franchise label | Mass Effect |
| Backstory | Rannoch Geth Consensus enters the arena with a clear doctrine. Grow a role-diverse machine roster. Every surviving machine returns to the workshop before the next booking. |
| Strategy | Swarm |
| Target overrides | none (goal 10 Robots → 11, the strategy default) |
| Team names | 2v2: **Shepard-Commander's Escort** (robots 1+2), **Perseus Veil Guard** (3+4), **Heretic Hunters** (5+6), **Geth Dreadnought Crew** (7+8), **Dyson Sphere Watch** (9+10) · 3v3: **Morning War Veterans** (1–3), **Rannoch Liberators** (4–6), **Old Machines** (7–9) |
| Event order | `league_3v3`, `league_2v2`, `grand_melee`, `koth`, `league_1v1`, `tag_team`, `tournament_3v3`, `tournament_2v2`, `tournament_1v1` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- 2v2 team 1+2: 'Rannoch Pair 01' → "Shepard-Commander's Escort" (decisions 3, 18; delegated authoring)
- 2v2 team 3+4: 'Rannoch Pair 02' → 'Perseus Veil Guard' (decisions 3, 18; delegated authoring)
- 2v2 team 5+6: 'Rannoch Pair 03' → 'Heretic Hunters' (decisions 3, 18; delegated authoring)
- 2v2 team 7+8: 'Rannoch Pair 04' → 'Geth Dreadnought Crew' (decisions 3, 18; delegated authoring)
- 2v2 team 9+10: 'Rannoch Pair 05' → 'Dyson Sphere Watch' (decisions 3, 18; delegated authoring)
- 3v3 team 1+2+3: 'Rannoch Squad 01' → 'Morning War Veterans' (decisions 3, 18; delegated authoring)
- 3v3 team 4+5+6: 'Rannoch Squad 02' → 'Rannoch Liberators' (decisions 3, 18; delegated authoring)
- 3v3 team 7+8+9: 'Rannoch Squad 03' → 'Old Machines' (decisions 3, 18; delegated authoring)
- Slot 7 robot name: 'Geth Trooper 07' → 'Geth Shock Trooper' (decisions 3, 18; delegated authoring)
- Slot 7 art brief: 'Standard geth infantry platform with a bright optic and utilitarian rifle. Arena unit 07 uses a distinct role-specific equipment silhouette.' → 'Upright grey-white geth, bright white flashlight optic, red knee stripes, rifle held level' (decisions 3, 18; delegated authoring)
- Slot 7 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 8 robot name: 'Geth Trooper 08' → 'Geth Infiltrator' (decisions 3, 18; delegated authoring)
- Slot 8 art brief: 'Standard geth infantry platform with a bright optic and utilitarian rifle. Arena unit 08 uses a distinct role-specific equipment silhouette.' → 'Geth in a low lunging stance, tall dorsal fins, blue optic, rifle angled forward' (decisions 3, 18; delegated authoring)
- Slot 8 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 9 robot name: 'Geth Trooper 09' → 'Geth Engineer' (decisions 3, 18; delegated authoring)
- Slot 9 art brief: 'Standard geth infantry platform with a bright optic and utilitarian rifle. Arena unit 09 uses a distinct role-specific equipment silhouette.' → 'Geth standing square, red shoulder patch, blue optic flare, rifle held diagonally low' (decisions 3, 18; delegated authoring)
- Slot 9 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 10 robot name: 'Geth Trooper 10' → 'Geth Rifleman' (decisions 3, 18; delegated authoring)
- Slot 10 art brief: 'Standard geth infantry platform with a bright optic and utilitarian rifle. Arena unit 10 uses a distinct role-specific equipment silhouette.' → 'Wide-stanced geth with red chest and thigh stripes, back fin, long-barrelled rifle held level' (decisions 3, 18; delegated authoring)
- Slot 10 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 11 robot name: 'Geth Trooper 11' → 'Geth Vanguard' (decisions 3, 18; delegated authoring)
- Slot 11 art brief: 'Standard geth infantry platform with a bright optic and utilitarian rifle. Arena unit 11 uses a distinct role-specific equipment silhouette.' → 'Pale grey-white geth lunging forward, red shoulder and leg stripes, blue optic flare, rifle levelled ahead' (decisions 3, 18; delegated authoring)
- Slot 11 portrait: aligned (decisions 3, 18; delegated authoring)

Every blueprint is used at the robots target of 11; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Legion | `single` | long | balanced | 10 | Tactician | Geth scout platform, single optic, exposed cables and repaired chest armour. | `rannoch-geth-consensus/1.webp` |
| 2 | Geth Hunter | `dual_wield` | short | offensive | 5 | Sprinter | Compact dark geth hunter with narrow optic and short-range weapon mounts. | `rannoch-geth-consensus/2.webp` |
| 3 | Geth Prime | `two_handed` | mid | defensive | 5 | Warden | Tall broad geth command platform, red armour and heavy weapon assembly. | `rannoch-geth-consensus/3.webp` |
| 4 | Geth Trooper | `single` | short | offensive | 10 | Versatile | Standard geth infantry platform with a bright optic and utilitarian rifle. | `rannoch-geth-consensus/4.webp` |
| 5 | Geth Sniper | `single` | long | balanced | 10 | Deadeye | Lean geth marksman, long sensor head and a precision barrel. | `rannoch-geth-consensus/5.webp` |
| 6 | Geth Pyro | `two_handed` | short | offensive | 0 | Bruiser | Heavy geth close-range platform, armoured emitter and heat-resistant casing. | `rannoch-geth-consensus/6.webp` |
| 7 | Geth Shock Trooper | `single` | mid | balanced | 10 | Deadeye | Upright grey-white geth, bright white flashlight optic, red knee stripes, rifle held level | `rannoch-geth-consensus/7.webp` |
| 8 | Geth Infiltrator | `two_handed` | short | offensive | 10 | Bruiser | Geth in a low lunging stance, tall dorsal fins, blue optic, rifle angled forward | `rannoch-geth-consensus/8.webp` |
| 9 | Geth Engineer | `dual_wield` | melee | offensive | 10 | Sprinter | Geth standing square, red shoulder patch, blue optic flare, rifle held diagonally low | `rannoch-geth-consensus/9.webp` |
| 10 | Geth Rifleman | `two_handed` | mid | offensive | 10 | Bruiser | Wide-stanced geth with red chest and thigh stripes, back fin, long-barrelled rifle held level | `rannoch-geth-consensus/10.webp` |
| 11 | Geth Vanguard | `two_handed` | long | defensive | 10 | Deadeye | Pale grey-white geth lunging forward, red shoulder and leg stripes, blue optic flare, rifle levelled ahead | `rannoch-geth-consensus/11.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Legion | Beam Pistol (₡93,000) | Particle Lance (₡425,000) |
| 2 Geth Hunter | Laser Pistol ×2 (₡114,000) | Volt Sabre ×2 (₡850,000) |
| 3 Geth Prime | Training Rifle (₡50,000) | Plasma Cannon (₡408,000) |
| 4 Geth Trooper | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |
| 5 Geth Sniper | Beam Pistol (₡93,000) | Particle Lance (₡425,000) |
| 6 Geth Pyro | Scatter Cannon (₡84,000) | Arc Projector (₡488,000) |
| 7 Geth Shock Trooper | Bolt Carbine (₡93,000) | Nova Caster (₡425,000) |
| 8 Geth Infiltrator | Scatter Cannon (₡84,000) | Arc Projector (₡488,000) |
| 9 Geth Engineer | Combat Knife ×2 (₡186,000) | Vibro Mace ×2 (₡850,000) |
| 10 Geth Rifleman | Training Rifle (₡50,000) | Plasma Cannon (₡408,000) |
| 11 Geth Vanguard | Training Beam (₡50,000) | Ion Beam (₡544,000) |

**Refinement plans** (generated; applied by Swarm goal 23, Refine → 8 steps per robot). All 11 robots: 65 steps, ₡38,200,000; the 11 robots at the target: ₡38,200,000; Refine → 8 applies ₡37,560,000 of the target robots' plans.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Legion (5 steps, ₡2,820,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Combat Algorithms +1 (new) ₡20,000 | ₡2,820,000 |
| Geth Hunter (10 steps, ₡5,920,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 · 9 Hone Power Core +4 (−3 → 1) ₡160,000 | ₡2,960,000 |
|  | Volt Sabre (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 · 10 Hone Power Core +4 (−3 → 1) ₡160,000 | ₡2,960,000 |
| Geth Prime (5 steps, ₡2,820,000) | Plasma Cannon (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Armor Plating +1 (new) ₡20,000 | ₡2,820,000 |
| Geth Trooper (5 steps, ₡2,960,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| Geth Sniper (5 steps, ₡2,960,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +4 (5 → 9) ₡160,000 | ₡2,960,000 |
| Geth Pyro (5 steps, ₡2,960,000) | Arc Projector (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| Geth Shock Trooper (5 steps, ₡2,960,000) | Nova Caster (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| Geth Infiltrator (5 steps, ₡2,960,000) | Arc Projector (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| Geth Engineer (10 steps, ₡5,920,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 · 9 Hone Gyro Stabilizers +4 (4 → 8) ₡160,000 | ₡2,960,000 |
|  | Vibro Mace (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 · 10 Hone Gyro Stabilizers +4 (4 → 8) ₡160,000 | ₡2,960,000 |
| Geth Rifleman (5 steps, ₡2,960,000) | Plasma Cannon (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Critical Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| Geth Vanguard (5 steps, ₡2,960,000) | Ion Beam (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (4 → 8) ₡160,000 | ₡2,960,000 |

Storage (estimate; the engine counts at run time): 13 final weapons equipped at the robots target of 11. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need Storage Facility L2; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A04 ×1 (decision 4).

Source findings before decisions: A03 ×2, A04 ×1, A13 ×5, V13 ×11.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 6. Necron Tomb Dynasty (`necron-tomb-dynasty`) — Swarm

| Field | Value |
|---|---|
| Stable name | Necron Tomb Dynasty |
| Franchise label | Warhammer 40,000 |
| Backstory | Necron Tomb Dynasty enters the arena with a clear doctrine. Favor resilience and deliberate ranged pressure. Every surviving machine returns to the workshop before the next booking. |
| Strategy | Swarm |
| Target overrides | none (goal 10 Robots → 11, the strategy default) |
| Team names | 2v2: **Sautekh Phalanx** (robots 1+2), **Nihilakh Watch** (3+4), **Szarekhan Court** (5+6), **Mephrit Cohort** (7+8), **Destroyer Cult** (9+10) · 3v3: **Novokh Awakening** (1–3), **Silent King's Guard** (4–6), **Nephrekh Ascension** (7–9) |
| Event order | `league_1v1`, `league_3v3`, `league_2v2`, `grand_melee`, `koth`, `tag_team`, `tournament_3v3`, `tournament_2v2`, `tournament_1v1` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- 2v2 team 1+2: 'Tomb Guard Pair 01' → 'Sautekh Phalanx' (decisions 3, 18; delegated authoring)
- 2v2 team 3+4: 'Tomb Guard Pair 02' → 'Nihilakh Watch' (decisions 3, 18; delegated authoring)
- 2v2 team 5+6: 'Tomb Guard Pair 03' → 'Szarekhan Court' (decisions 3, 18; delegated authoring)
- 2v2 team 7+8: 'Tomb Guard Pair 04' → 'Mephrit Cohort' (decisions 3, 18; delegated authoring)
- 2v2 team 9+10: 'Tomb Guard Pair 05' → 'Destroyer Cult' (decisions 3, 18; delegated authoring)
- 3v3 team 1+2+3: 'Tomb Guard Squad 01' → 'Novokh Awakening' (decisions 3, 18; delegated authoring)
- 3v3 team 4+5+6: 'Tomb Guard Squad 02' → "Silent King's Guard" (decisions 3, 18; delegated authoring)
- 3v3 team 7+8+9: 'Tomb Guard Squad 03' → 'Nephrekh Ascension' (decisions 3, 18; delegated authoring)
- Slot 6 robot name: 'Necron Warrior 06' → 'Royal Warden' (decisions 3, 18; delegated authoring)
- Slot 6 art brief: 'Silver skeletal infantry machine with green optics and a long firearm. Arena unit 06 uses a distinct role-specific equipment silhouette.' → 'Skeletal necron with rust-bronze pauldrons in a wide crouch, green-celled gauss rifle held low' (decisions 3, 18; delegated authoring)
- Slot 6 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 7 robot name: 'Necron Warrior 07' → 'Sautekh Warrior' (decisions 3, 18; delegated authoring)
- Slot 7 art brief: 'Silver skeletal infantry machine with green optics and a long firearm. Arena unit 07 uses a distinct role-specific equipment silhouette.' → 'Upright skeletal necron, green chest glyph, glowing gauss rifle angled up past its shoulder' (decisions 3, 18; delegated authoring)
- Slot 7 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 8 robot name: 'Necron Warrior 08' → 'Mephrit Immortal' (decisions 3, 18; delegated authoring)
- Slot 8 art brief: 'Silver skeletal infantry machine with green optics and a long firearm. Arena unit 08 uses a distinct role-specific equipment silhouette.' → 'Wide-stanced skeletal necron, bronze chest plate, gauss rifle levelled with a green-lit claw muzzle' (decisions 3, 18; delegated authoring)
- Slot 8 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 9 robot name: 'Necron Warrior 09' → 'Nihilakh Warrior' (decisions 3, 18; delegated authoring)
- Slot 9 art brief: 'Silver skeletal infantry machine with green optics and a long firearm. Arena unit 09 uses a distinct role-specific equipment silhouette.' → 'Skeletal necron striding forward, glowing green spine, one bronze pauldron, gauss rifle held level' (decisions 3, 18; delegated authoring)
- Slot 9 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 10 robot name: 'Necron Warrior 10' → 'Novokh Immortal' (decisions 3, 18; delegated authoring)
- Slot 10 art brief: 'Silver skeletal infantry machine with green optics and a long firearm. Arena unit 10 uses a distinct role-specific equipment silhouette.' → 'Crouched skeletal necron, green-lit ribcage, gauss rifle held across its body angled down' (decisions 3, 18; delegated authoring)
- Slot 10 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 11 robot name: 'Necron Warrior 11' → 'Nephrekh Warrior' (decisions 3, 18; delegated authoring)
- Slot 11 art brief: 'Silver skeletal infantry machine with green optics and a long firearm. Arena unit 11 uses a distinct role-specific equipment silhouette.' → 'Tall gaunt skeletal necron, bronze ribbed chest, green gauss weapon hanging down at its side' (decisions 3, 18; delegated authoring)
- Slot 11 portrait: aligned (decisions 3, 18; delegated authoring)

Every blueprint is used at the robots target of 11; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Necron Overlord | `weapon_shield` | melee | defensive | 5 | Tactician | Ancient metal skeletal commander with ornamental armour and a staff-like weapon. | `necron-tomb-dynasty/1.webp` |
| 2 | Necron Warrior | `single` | short | offensive | 0 | Versatile | Silver skeletal infantry machine with green optics and a long firearm. | `necron-tomb-dynasty/2.webp` |
| 3 | Necron Immortal | `two_handed` | mid | defensive | 0 | Warden | Broad armoured skeletal machine with oversized energy weapon. | `necron-tomb-dynasty/3.webp` |
| 4 | Necron Deathmark | `single` | long | balanced | 0 | Deadeye | Lean skeletal marksman, single focused optic and a long precision weapon. | `necron-tomb-dynasty/4.webp` |
| 5 | Necron Lychguard | `weapon_shield` | melee | defensive | 0 | Warden | Armoured skeletal guardian with a tall shield and close-combat weapon. | `necron-tomb-dynasty/5.webp` |
| 6 | Royal Warden | `weapon_shield` | short | defensive | 0 | Warden | Skeletal necron with rust-bronze pauldrons in a wide crouch, green-celled gauss rifle held low | `necron-tomb-dynasty/6.webp` |
| 7 | Sautekh Warrior | `single` | mid | balanced | 0 | Deadeye | Upright skeletal necron, green chest glyph, glowing gauss rifle angled up past its shoulder | `necron-tomb-dynasty/7.webp` |
| 8 | Mephrit Immortal | `two_handed` | short | offensive | 0 | Bruiser | Wide-stanced skeletal necron, bronze chest plate, gauss rifle levelled with a green-lit claw muzzle | `necron-tomb-dynasty/8.webp` |
| 9 | Nihilakh Warrior | `dual_wield` | melee | offensive | 0 | Sprinter | Skeletal necron striding forward, glowing green spine, one bronze pauldron, gauss rifle held level | `necron-tomb-dynasty/9.webp` |
| 10 | Novokh Immortal | `two_handed` | mid | offensive | 0 | Bruiser | Crouched skeletal necron, green-lit ribcage, gauss rifle held across its body angled down | `necron-tomb-dynasty/10.webp` |
| 11 | Nephrekh Warrior | `two_handed` | long | defensive | 0 | Deadeye | Tall gaunt skeletal necron, bronze ribbed chest, green gauss weapon hanging down at its side | `necron-tomb-dynasty/11.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Necron Overlord | Practice Sword + Light Shield (₡101,000) | Vibro Mace + Aegis Bulwark (₡834,000) |
| 2 Necron Warrior | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |
| 3 Necron Immortal | Training Rifle (₡50,000) | Plasma Cannon (₡408,000) |
| 4 Necron Deathmark | Beam Pistol (₡93,000) | Particle Lance (₡425,000) |
| 5 Necron Lychguard | Practice Sword + Light Shield (₡101,000) | Vibro Mace + Aegis Bulwark (₡834,000) |
| 6 Royal Warden | Laser Pistol + Light Shield (₡108,000) | Volt Sabre + Aegis Bulwark (₡834,000) |
| 7 Sautekh Warrior | Bolt Carbine (₡93,000) | Nova Caster (₡425,000) |
| 8 Mephrit Immortal | Scatter Cannon (₡84,000) | Arc Projector (₡488,000) |
| 9 Nihilakh Warrior | Combat Knife ×2 (₡186,000) | Vibro Mace ×2 (₡850,000) |
| 10 Novokh Immortal | Training Rifle (₡50,000) | Plasma Cannon (₡408,000) |
| 11 Nephrekh Warrior | Training Beam (₡50,000) | Ion Beam (₡544,000) |

**Refinement plans** (generated; applied by Swarm goal 23, Refine → 8 steps per robot). All 11 robots: 75 steps, ₡35,250,000; the 11 robots at the target: ₡35,250,000; Refine → 8 applies ₡34,870,000 of the target robots' plans.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Necron Overlord (10 steps, ₡2,870,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Combat Algorithms +1 (new) ₡20,000 | ₡2,820,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |
| Necron Warrior (5 steps, ₡2,960,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| Necron Immortal (5 steps, ₡2,820,000) | Plasma Cannon (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Armor Plating +1 (new) ₡20,000 | ₡2,820,000 |
| Necron Deathmark (5 steps, ₡2,960,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +4 (5 → 9) ₡160,000 | ₡2,960,000 |
| Necron Lychguard (10 steps, ₡3,010,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Counter Protocols +4 (5 → 9) ₡160,000 | ₡2,960,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |
| Royal Warden (10 steps, ₡2,870,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Armor Plating +1 (new) ₡20,000 | ₡2,820,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |
| Sautekh Warrior (5 steps, ₡2,960,000) | Nova Caster (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| Mephrit Immortal (5 steps, ₡2,960,000) | Arc Projector (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| Nihilakh Warrior (10 steps, ₡5,920,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 · 9 Hone Gyro Stabilizers +4 (4 → 8) ₡160,000 | ₡2,960,000 |
|  | Vibro Mace (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 · 10 Hone Gyro Stabilizers +4 (4 → 8) ₡160,000 | ₡2,960,000 |
| Novokh Immortal (5 steps, ₡2,960,000) | Plasma Cannon (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Critical Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| Nephrekh Warrior (5 steps, ₡2,960,000) | Ion Beam (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (4 → 8) ₡160,000 | ₡2,960,000 |

Storage (estimate; the engine counts at run time): 15 final weapons equipped at the robots target of 11. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need Storage Facility L2; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A04 ×1 (decision 4).

Source findings before decisions: A03 ×2, A04 ×1, A13 ×6, V13 ×11.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 7. Frontier Titan Corps (`frontier-titan-corps`) — Trio

| Field | Value |
|---|---|
| Stable name | Frontier Titan Corps |
| Franchise label | Titanfall |
| Backstory | Frontier Titan Corps enters the arena with a clear doctrine. Three clearly different roles: ranged platform, heavy anchor, mobile melee fighter. Every surviving machine returns to the workshop before the next booking. |
| Strategy | Trio |
| Target overrides | goal 12 Robots → 4 (strategy default 3, allowed 3–6) |
| Team names | 2v2: **Marauder Corps** (robots 1+2), **Militia SRS** (3+4) · 3v3: **Apex Predators** (1–3) |
| Event order | `league_3v3`, `tournament_3v3`, `league_1v1`, `league_2v2`, `tag_team`, `koth`, `grand_melee`, `tournament_2v2`, `tournament_1v1` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- 2v2 team 1+2: 'Frontier Pair 01' → 'Marauder Corps' (decision 3; delegated authoring)
- 2v2 team 3+4: 'Frontier Pair 02' → 'Militia SRS' (decision 3; delegated authoring)
- 3v3 team 1+2+3: 'Frontier Squad 01' → 'Apex Predators' (decision 3; delegated authoring)
- Goal 12 Robots target: 3 → 4 (decision 5)

Every blueprint is used at the robots target of 4; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Ion | `single` | mid | balanced | 10 | Deadeye | Military Titan with a central sensor, squared armour and energy weapon. | `frontier-titan-corps/1.webp` |
| 2 | Scorch | `two_handed` | short | defensive | 5 | Warden | Heavy yellow-brown Titan with thick plates, heat shielding and a broad launcher. | `frontier-titan-corps/2.webp` |
| 3 | Ronin | `dual_wield` | melee | offensive | 5 | Sprinter | Lean dark Titan with mechanical joints and a long close-combat blade. | `frontier-titan-corps/3.webp` |
| 4 | BT-7274 | `weapon_shield` | short | balanced | 10 | Versatile | Green Vanguard Titan with orange sensor, white markings and rugged military plates. | `frontier-titan-corps/4.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Ion | Bolt Carbine (₡93,000) | Nova Caster (₡425,000) |
| 2 Scorch | Scatter Cannon (₡84,000) | Arc Projector (₡488,000) |
| 3 Ronin | Combat Knife ×2 (₡186,000) | Vibro Mace ×2 (₡850,000) |
| 4 BT-7274 | Laser Pistol + Light Shield (₡108,000) | Volt Sabre + Aegis Bulwark (₡834,000) |

**Refinement plans** (generated; applied by Trio goal 22, Refine → 10 steps per robot). All 4 robots: 30 steps, ₡14,230,000; the 4 robots at the target: ₡14,230,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Ion (5 steps, ₡2,840,000) | Nova Caster (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +2 (8 → 10) ₡40,000 | ₡2,840,000 |
| Scorch (5 steps, ₡2,820,000) | Arc Projector (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Armor Plating +1 (new) ₡20,000 | ₡2,820,000 |
| Ronin (10 steps, ₡5,680,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 · 9 Hone Gyro Stabilizers +2 (4 → 6) ₡40,000 | ₡2,840,000 |
|  | Vibro Mace (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 · 10 Hone Gyro Stabilizers +2 (4 → 6) ₡40,000 | ₡2,840,000 |
| BT-7274 (10 steps, ₡2,890,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +2 (8 → 10) ₡40,000 | ₡2,840,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |

Storage (estimate; the engine counts at run time): 6 final weapons equipped at the robots target of 4. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need Storage Facility L1; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5), A04 ×1 (decision 4).

Source findings before decisions: A03 ×1, A04 ×1, A08 ×1, A12 ×1, V13 ×4.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 8. Omnic Arena Collective (`omnic-arena-collective`) — Generalist

| Field | Value |
|---|---|
| Stable name | Omnic Arena Collective |
| Franchise label | Overwatch |
| Backstory | Omnic Arena Collective enters the arena with a clear doctrine. Grow a balanced roster with distinct build focuses. Every surviving machine returns to the workshop before the next booking. |
| Strategy | Generalist |
| Target overrides | goal 14 Robots → 4 (strategy default 2, allowed 2–4) |
| Team names | 2v2: **Numbani Guardians** (robots 1+2), **Shambali Monastery** (3+4) · 3v3: **Omnic Crisis** (1–3) |
| Event order | `league_1v1`, `league_2v2`, `league_3v3`, `tag_team`, `koth`, `grand_melee`, `tournament_1v1`, `tournament_2v2`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- 2v2 team 1+2: 'Omnic Pair 01' → 'Numbani Guardians' (decision 3; delegated authoring)
- 2v2 team 3+4: 'Omnic Pair 02' → 'Shambali Monastery' (decision 3; delegated authoring)
- 3v3 team 1+2+3: 'Omnic Squad 01' → 'Omnic Crisis' (decision 3; delegated authoring)
- Goal 14 Robots target: 3 → 4 (decision 5)

Every blueprint is used at the robots target of 4; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Bastion | `two_handed` | mid | balanced | 10 | Bruiser | Bulky omnic gun platform, green and cream panels, large mechanical shoulders. | `omnic-arena-collective/1.webp` |
| 2 | Orisa | `weapon_shield` | short | defensive | 15 | Warden | Four-legged armoured omnic defender, green and gold plates and a central sensor. | `omnic-arena-collective/2.webp` |
| 3 | Zenyatta | `single` | long | defensive | 25 | Tactician | Slim omnic monk with a metal face and floating-orb-inspired equipment. | `omnic-arena-collective/3.webp` |
| 4 | Echo | `single` | long | offensive | 15 | Sprinter | Sleek white and blue synthetic robot with a luminous face and aerodynamic panels. | `omnic-arena-collective/4.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Bastion | Training Rifle (₡50,000) | Plasma Cannon (₡408,000) |
| 2 Orisa | Laser Pistol + Light Shield (₡108,000) | Volt Sabre + Aegis Bulwark (₡834,000) |
| 3 Zenyatta | Beam Pistol (₡93,000) | Particle Lance (₡425,000) |
| 4 Echo | Beam Pistol (₡93,000) | Particle Lance (₡425,000) |

**Refinement plans** (generated; applied by Generalist goal 18, Refine → 10 steps per robot). All 4 robots: 25 steps, ₡11,350,000; the 4 robots at the target: ₡11,350,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Bastion (5 steps, ₡2,840,000) | Plasma Cannon (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +2 (7 → 9) ₡40,000 | ₡2,840,000 |
| Orisa (10 steps, ₡2,870,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Armor Plating +1 (new) ₡20,000 | ₡2,820,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |
| Zenyatta (5 steps, ₡2,820,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Combat Algorithms +1 (new) ₡20,000 | ₡2,820,000 |
| Echo (5 steps, ₡2,820,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Hull Integrity +1 (new) ₡20,000 | ₡2,820,000 |

Storage (estimate; the engine counts at run time): 5 final weapons equipped at the robots target of 4. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A04 ×1 (decision 4).

Source findings before decisions: A03 ×1, A04 ×1, A08 ×1, A12 ×1, V08 ×1, V13 ×4.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 9. YoRHa Combat Division (`yorha-combat-division`) — Trio

| Field | Value |
|---|---|
| Stable name | YoRHa Combat Division |
| Franchise label | NieR:Automata |
| Backstory | YoRHa Combat Division enters the arena with a clear doctrine. Two melee-oriented combatants and a tactical counterpart. Every surviving machine returns to the workshop before the next booking. |
| Strategy | Trio |
| Target overrides | none (goal 12 Robots → 3, the strategy default) |
| Team names | 2v2: **The Bunker** (robots 1+2) · 3v3: **Glory to Mankind** (1–3) |
| Event order | `league_3v3`, `tournament_3v3`, `league_1v1`, `league_2v2`, `tag_team`, `koth`, `grand_melee`, `tournament_2v2`, `tournament_1v1` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- 2v2 team 1+2: 'YoRHa Pair 01' → 'The Bunker' (decision 3; delegated authoring)
- 3v3 team 1+2+3: 'YoRHa Squad 01' → 'Glory to Mankind' (decision 3; delegated authoring)

Every blueprint is used at the robots target of 3; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | 2B | `dual_wield` | melee | balanced | 10 | Versatile | YoRHa combat android in black uniform with silver hair and a blindfold. | `yorha-combat-division/1.webp` |
| 2 | 9S | `single` | long | balanced | 20 | Tactician | YoRHa scanner android in black uniform, silver hair, blindfold and tactical pod. | `yorha-combat-division/2.webp` |
| 3 | A2 | `single` | melee | offensive | 0 | Sprinter | Weathered prototype android with long pale hair, dark clothing and a large blade. | `yorha-combat-division/3.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 2B | Combat Knife ×2 (₡186,000) | Vibro Mace ×2 (₡850,000) |
| 2 9S | Beam Pistol (₡93,000) | Particle Lance (₡425,000) |
| 3 A2 | Practice Sword (₡50,000) | Vibro Mace (₡425,000) |

**Refinement plans** (generated; applied by Trio goal 22, Refine → 10 steps per robot). All 3 robots: 20 steps, ₡11,240,000; the 3 robots at the target: ₡11,240,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| 2B (10 steps, ₡5,620,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 · 9 Hone Combat Power +1 (6 → 7) ₡10,000 | ₡2,810,000 |
|  | Vibro Mace (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 · 10 Hone Combat Power +1 (6 → 7) ₡10,000 | ₡2,810,000 |
| 9S (5 steps, ₡2,810,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (5 → 6) ₡10,000 | ₡2,810,000 |
| A2 (5 steps, ₡2,810,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Gyro Stabilizers +1 (4 → 5) ₡10,000 | ₡2,810,000 |

Storage (estimate; the engine counts at run time): 4 final weapons equipped at the robots target of 3. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5), A04 ×1 (decision 4).

Source findings before decisions: A01 ×1, A03 ×1, A04 ×1, A11 ×1, V13 ×3.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 10. Cauldron Machineworks (`cauldron-machineworks`) — Generalist

| Field | Value |
|---|---|
| Stable name | Cauldron Machineworks |
| Franchise label | Horizon |
| Backstory | Cauldron Machineworks enters the arena with a clear doctrine. Develop a scout, ranged hunter, and heavy platform. Every surviving machine returns to the workshop before the next booking. |
| Strategy | Generalist |
| Target overrides | goal 14 Robots → 4 (strategy default 2, allowed 2–4) |
| Team names | 2v2: **Cauldron SIGMA** (robots 1+2), **Cauldron RHO** (3+4) · 3v3: **The Derangement** (1–3) |
| Event order | `league_1v1`, `league_2v2`, `league_3v3`, `tag_team`, `koth`, `grand_melee`, `tournament_1v1`, `tournament_2v2`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- 2v2 team 1+2: 'Cauldron Pair 01' → 'Cauldron SIGMA' (decision 3; delegated authoring)
- 2v2 team 3+4: 'Cauldron Pair 02' → 'Cauldron RHO' (decision 3; delegated authoring)
- 3v3 team 1+2+3: 'Cauldron Squad 01' → 'The Derangement' (decision 3; delegated authoring)
- Goal 14 Robots target: 3 → 4 (decision 5)

Every blueprint is used at the robots target of 4; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Watcher | `single` | short | balanced | 25 | Sprinter | Small bird-like Horizon scout machine with a single large blue optic. | `cauldron-machineworks/1.webp` |
| 2 | Ravager | `single` | mid | offensive | 10 | Deadeye | Armoured feline machine with a mounted ranged cannon and exposed mechanical ribs. | `cauldron-machineworks/2.webp` |
| 3 | Thunderjaw | `two_handed` | mid | offensive | 0 | Bruiser | Massive mechanical dinosaur with heavy plates, weapon pods and broad jaws. | `cauldron-machineworks/3.webp` |
| 4 | Shell-Walker | `weapon_shield` | mid | defensive | 20 | Warden | Crab-like cargo machine with articulated legs, a cargo pod and shield emitter. | `cauldron-machineworks/4.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Watcher | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |
| 2 Ravager | Bolt Carbine (₡93,000) | Nova Caster (₡425,000) |
| 3 Thunderjaw | Training Rifle (₡50,000) | Plasma Cannon (₡408,000) |
| 4 Shell-Walker | Bolt Carbine + Combat Shield (₡171,000) | Nova Caster + Aegis Bulwark (₡834,000) |

**Refinement plans** (generated; applied by Generalist goal 18, Refine → 10 steps per robot). All 4 robots: 25 steps, ₡11,390,000; the 4 robots at the target: ₡11,390,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Watcher (5 steps, ₡2,840,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Power Core +2 (−3 → −1) ₡40,000 | ₡2,840,000 |
| Ravager (5 steps, ₡2,840,000) | Nova Caster (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +2 (8 → 10) ₡40,000 | ₡2,840,000 |
| Thunderjaw (5 steps, ₡2,840,000) | Plasma Cannon (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +2 (7 → 9) ₡40,000 | ₡2,840,000 |
| Shell-Walker (10 steps, ₡2,870,000) | Nova Caster (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Armor Plating +1 (new) ₡20,000 | ₡2,820,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |

Storage (estimate; the engine counts at run time): 5 final weapons equipped at the robots target of 4. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A04 ×1 (decision 4).

Source findings before decisions: A03 ×1, A04 ×1, A12 ×1, V08 ×1, V13 ×4.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 11. CyberLife Deviants (`cyberlife-deviants`) — Trio

| Field | Value |
|---|---|
| Stable name | CyberLife Deviants |
| Franchise label | Detroit: Become Human |
| Backstory | CyberLife Deviants enters the arena with a clear doctrine. Precise shooter, defensive survival build, balanced leader. Every surviving machine returns to the workshop before the next booking. |
| Strategy | Trio |
| Target overrides | none (goal 12 Robots → 3, the strategy default) |
| Team names | 2v2: **CyberLife Tower** (robots 1+2) · 3v3: **Jericho Uprising** (1–3) |
| Event order | `league_3v3`, `tournament_3v3`, `league_1v1`, `league_2v2`, `tag_team`, `koth`, `grand_melee`, `tournament_2v2`, `tournament_1v1` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- Franchise label: '[Detroit' → 'Detroit: Become Human' (decisions 3, 7; delegated authoring)
- 2v2 team 1+2: 'CyberLife Pair 01' → 'CyberLife Tower' (decisions 3, 7; delegated authoring)
- 3v3 team 1+2+3: 'CyberLife Squad 01' → 'Jericho Uprising' (decisions 3, 7; delegated authoring)

Every blueprint is used at the robots target of 3; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Connor RK800 | `single` | long | balanced | 15 | Deadeye | CyberLife detective android, dark suit, blue triangle and temple indicator. | `cyberlife-deviants/1.webp` |
| 2 | Kara AX400 | `weapon_shield` | short | defensive | 30 | Warden | CyberLife service android, blue-grey clothing and a small temple indicator. | `cyberlife-deviants/2.webp` |
| 3 | Markus RK200 | `single` | mid | balanced | 10 | Versatile | CyberLife android leader with a composed stance and mismatched eyes. | `cyberlife-deviants/3.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Connor RK800 | Beam Pistol (₡93,000) | Particle Lance (₡425,000) |
| 2 Kara AX400 | Laser Pistol + Light Shield (₡108,000) | Volt Sabre + Aegis Bulwark (₡834,000) |
| 3 Markus RK200 | Bolt Carbine (₡93,000) | Nova Caster (₡425,000) |

**Refinement plans** (generated; applied by Trio goal 22, Refine → 10 steps per robot). All 3 robots: 20 steps, ₡8,480,000; the 3 robots at the target: ₡8,480,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Connor RK800 (5 steps, ₡2,810,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (5 → 6) ₡10,000 | ₡2,810,000 |
| Kara AX400 (10 steps, ₡2,860,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (8 → 9) ₡10,000 | ₡2,810,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |
| Markus RK200 (5 steps, ₡2,810,000) | Nova Caster (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (8 → 9) ₡10,000 | ₡2,810,000 |

Storage (estimate; the engine counts at run time): 4 final weapons equipped at the robots target of 3. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5), A04 ×1 (decision 4).

Source findings before decisions: A01 ×1, A03 ×1, A04 ×1, A11 ×1, V13 ×3, V18 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 12. Robot City Industries (`robot-city-industries`) — Tycoon

| Field | Value |
|---|---|
| Stable name | Robot City Industries |
| Franchise label | Robots |
| Backstory | Robot City Industries enters the arena with a clear doctrine. Facility-led growth and a modest fighting roster. Every surviving machine returns to the workshop before the next booking. |
| Strategy | Tycoon |
| Target overrides | goal 20 Robots → 3 (strategy default 2, allowed 2–3) |
| Team names | 2v2: **Rivet Town Rusties** (robots 1+2) · 3v3: **Outmode Rebellion** (1–3) |
| Event order | `koth`, `grand_melee`, `league_1v1`, `league_2v2`, `tag_team`, `tournament_1v1`, `tournament_2v2`, `league_3v3`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- 2v2 team 1+2: 'Robot City Pair 01' → 'Rivet Town Rusties' (decision 3; delegated authoring)
- 3v3 team 1+2+3: 'Robot City Squad 01' → 'Outmode Rebellion' (decision 3; delegated authoring)

Every blueprint is used at the robots target of 3; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Rodney Copperbottom | `single` | short | balanced | 25 | Tactician | Blue riveted inventor robot with repaired panels and practical mechanical hands. | `robot-city-industries/1.webp` |
| 2 | Fender | `dual_wield` | melee | offensive | 30 | Sprinter | Red gangly robot with exposed joints, mismatched parts and a narrow face. | `robot-city-industries/2.webp` |
| 3 | Bigweld | `two_handed` | melee | defensive | 20 | Warden | Large spherical silver robot with a rounded head and broad mechanical body. | `robot-city-industries/3.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Rodney Copperbottom | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |
| 2 Fender | Combat Knife ×2 (₡186,000) | Vibro Mace ×2 (₡850,000) |
| 3 Bigweld | War Club (₡84,000) | Heavy Hammer (₡478,000) |

**Refinement plans** (generated; applied by Tycoon goal 25, Refine → 10 steps per robot). All 3 robots: 20 steps, ₡11,320,000; the 3 robots at the target: ₡11,320,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Rodney Copperbottom (5 steps, ₡2,820,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Combat Algorithms +1 (new) ₡20,000 | ₡2,820,000 |
| Fender (10 steps, ₡5,680,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 · 9 Hone Gyro Stabilizers +2 (4 → 6) ₡40,000 | ₡2,840,000 |
|  | Vibro Mace (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 · 10 Hone Gyro Stabilizers +2 (4 → 6) ₡40,000 | ₡2,840,000 |
| Bigweld (5 steps, ₡2,820,000) | Heavy Hammer (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Armor Plating +1 (new) ₡20,000 | ₡2,820,000 |

Storage (estimate; the engine counts at run time): 4 final weapons equipped at the robots target of 3. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A04 ×1 (decision 4).

Source findings before decisions: A03 ×1, A04 ×1, A08 ×1, V08 ×1, V13 ×3.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 13. San Fransokyo Robotics (`san-fransokyo-robotics`) — Paragon

| Field | Value |
|---|---|
| Stable name | San Fransokyo Robotics |
| Franchise label | Big Hero 6 |
| Backstory | San Fransokyo Robotics enters the arena with a clear doctrine. One defensive flagship with concentrated upgrades. Every surviving machine returns to the workshop before the next booking. |
| Strategy | Paragon |
| Target overrides | none (goal 8 Robots → 1, the strategy default) |
| Team names | 2v2: none · 3v3: none |
| Event order | `league_1v1`, `tournament_1v1`, `koth`, `grand_melee`, `league_2v2`, `tag_team`, `tournament_2v2`, `league_3v3`, `tournament_3v3` |

**Changes from your draft**: none.

Every blueprint is used at the robots target of 1; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Baymax | `weapon_shield` | short | defensive | 30 | Warden | Rounded white healthcare robot wearing recognizable red combat armour. | `san-fransokyo-robotics/1.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Baymax | Plasma Rifle + Light Shield (₡309,000) | Volt Sabre + Aegis Bulwark (₡834,000) |

**Refinement plans** (generated; applied by Paragon goal 16, Refine → 10 steps per robot). The only blueprint: 4 steps, ₡2,800,000; the robot at the target: ₡2,800,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Baymax (4 steps, ₡2,800,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 | ₡2,800,000 |
|  | Aegis Bulwark (offhand) | no step (allowed: shields need no step) | ₡0 |

Storage (estimate; the engine counts at run time): 2 final weapons equipped at the robots target of 1. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5), A04 ×1 (decision 4).

Source findings before decisions: A01 ×1, A04 ×1, A11 ×1, V13 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 14. Rockwell Ironworks (`rockwell-ironworks`) — Paragon

| Field | Value |
|---|---|
| Stable name | Rockwell Ironworks |
| Franchise label | The Iron Giant |
| Backstory | Rockwell Ironworks enters the arena with a clear doctrine. A slow, resilient heavyweight with a major refinement budget. Every surviving machine returns to the workshop before the next booking. |
| Strategy | Paragon |
| Target overrides | none (goal 8 Robots → 1, the strategy default) |
| Team names | 2v2: none · 3v3: none |
| Event order | `league_1v1`, `grand_melee`, `tournament_1v1`, `koth`, `league_2v2`, `tag_team`, `tournament_2v2`, `league_3v3`, `tournament_3v3` |

**Changes from your draft**: none.

Every blueprint is used at the robots target of 1; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Iron Giant | `two_handed` | melee | defensive | 0 | Warden | Towering riveted gunmetal robot, broad chest, circular eyes and enormous hands. | `rockwell-ironworks/1.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Iron Giant | Shock Maul (₡183,000) | Heavy Hammer (₡478,000) |

**Refinement plans** (generated; applied by Paragon goal 16, Refine → 10 steps per robot). The only blueprint: 4 steps, ₡2,800,000; the robot at the target: ₡2,800,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Iron Giant (4 steps, ₡2,800,000) | Heavy Hammer (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 | ₡2,800,000 |

Storage (estimate; the engine counts at run time): 1 final weapons equipped at the robots target of 1. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5), A04 ×1 (decision 4).

Source findings before decisions: A01 ×1, A04 ×1, A11 ×1, V13 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 15. Nova Robotics (`nova-robotics`) — Paragon

| Field | Value |
|---|---|
| Stable name | Nova Robotics |
| Franchise label | Short Circuit |
| Backstory | Nova Robotics enters the arena with a clear doctrine. A tactical survivor whose equipment improves over time. Every surviving machine returns to the workshop before the next booking. |
| Strategy | Paragon |
| Target overrides | none (goal 8 Robots → 1, the strategy default) |
| Team names | 2v2: none · 3v3: none |
| Event order | `league_1v1`, `tournament_1v1`, `koth`, `grand_melee`, `league_2v2`, `tag_team`, `tournament_2v2`, `league_3v3`, `tournament_3v3` |

**Changes from your draft**: none.

Every blueprint is used at the robots target of 1; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Johnny 5 | `single` | long | balanced | 25 | Tactician | Tracked military utility robot, binocular eyes, articulated arms and repaired panels. | `nova-robotics/1.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Johnny 5 | Gauss Pistol (₡291,000) | Particle Lance (₡425,000) |

**Refinement plans** (generated; applied by Paragon goal 16, Refine → 10 steps per robot). The only blueprint: 4 steps, ₡2,800,000; the robot at the target: ₡2,800,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Johnny 5 (4 steps, ₡2,800,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 | ₡2,800,000 |

Storage (estimate; the engine counts at run time): 1 final weapons equipped at the robots target of 1. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5), A04 ×1 (decision 4).

Source findings before decisions: A01 ×1, A04 ×1, A11 ×1, V13 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 16. Tetravaal Tactical Unit (`tetravaal-tactical-unit`) — Paragon

| Field | Value |
|---|---|
| Stable name | Tetravaal Tactical Unit |
| Franchise label | Chappie |
| Backstory | Tetravaal Tactical Unit enters the arena with a clear doctrine. An agile urban fighter with focused weapon refinement. Every surviving machine returns to the workshop before the next booking. |
| Strategy | Paragon |
| Target overrides | goal 3 Booking Office → L4 (strategy default L1, allowed L0–L6); goal 8 Robots → 2 (strategy default 1, allowed 1–2) |
| Team names | 2v2: **Joburg Showdown** (robots 1+2) · 3v3: none |
| Event order | `league_1v1`, `tournament_1v1`, `koth`, `grand_melee`, `league_2v2`, `tag_team`, `tournament_2v2`, `league_3v3`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- 2v2 team 1+2: 'Tetravaal Pair 01' → 'Joburg Showdown' (decisions 3, 18; delegated authoring)
- Slot 2 robot name: 'Tetravaal Scout 02' → 'Joburg Scout' (decisions 3, 18; delegated authoring)
- Slot 2 art brief: 'Police-grey Scout robot with a clean tactical chassis and compact antennae.' → 'Grey police Scout droid, POLICE chest plate, blue visor, orange-tipped antenna, assault rifle' (decisions 3, 18; delegated authoring)
- Slot 2 portrait: aligned (decisions 3, 18; delegated authoring)
- Goal 3 Booking Office target: L1 → L4 (decision 5)
- Goal 8 Robots target: 1 → 2 (decision 5)

Every blueprint is used at the robots target of 2; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Chappie | `dual_wield` | short | offensive | 10 | Versatile | Scuffed police-grey tactical robot with antenna ears and orange details. | `tetravaal-tactical-unit/1.webp` |
| 2 | Joburg Scout | `single` | mid | balanced | 15 | Deadeye | Grey police Scout droid, POLICE chest plate, blue visor, orange-tipped antenna, assault rifle | `tetravaal-tactical-unit/2.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Chappie | Plasma Rifle ×2 (₡516,000) | Volt Sabre ×2 (₡850,000) |
| 2 Joburg Scout | Disruptor Cannon (₡293,000) | Nova Caster (₡425,000) |

**Refinement plans** (generated; applied by Paragon goal 16, Refine → 10 steps per robot). All 2 robots: 15 steps, ₡8,430,000; the 2 robots at the target: ₡8,430,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Chappie (10 steps, ₡5,620,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 · 9 Hone Combat Power +1 (8 → 9) ₡10,000 | ₡2,810,000 |
|  | Volt Sabre (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 · 10 Hone Combat Power +1 (8 → 9) ₡10,000 | ₡2,810,000 |
| Joburg Scout (5 steps, ₡2,810,000) | Nova Caster (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (8 → 9) ₡10,000 | ₡2,810,000 |

Storage (estimate; the engine counts at run time): 3 final weapons equipped at the robots target of 2. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A04 ×1 (decision 4).

Source findings before decisions: A03 ×2, A04 ×1, A12 ×1, A13 ×1, V13 ×3.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 17. USR Synthetic Division (`usr-synthetic-division`) — Swarm

| Field | Value |
|---|---|
| Stable name | USR Synthetic Division |
| Franchise label | I, Robot |
| Backstory | USR Synthetic Division enters the arena with a clear doctrine. Consistent manufactured frames with one recognizable lead robot. Every surviving machine returns to the workshop before the next booking. |
| Strategy | Swarm |
| Target overrides | none (goal 10 Robots → 11, the strategy default) |
| Team names | 2v2: **Three Laws Safe** (robots 1+2), **Solar Station Five** (3+4), **Little Lost Robot** (5+6), **Calvin's Casebook** (7+8), **Runaround** (9+10) · 3v3: **Ghosts in the Machine** (1–3), **Catch That Rabbit** (4–6), **Positronic Pioneers** (7–9) |
| Event order | `league_3v3`, `league_2v2`, `grand_melee`, `koth`, `league_1v1`, `tag_team`, `tournament_3v3`, `tournament_2v2`, `tournament_1v1` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- 2v2 team 1+2: 'USR Pair 01' → 'Three Laws Safe' (decisions 3, 18; delegated authoring)
- 2v2 team 3+4: 'USR Pair 02' → 'Solar Station Five' (decisions 3, 18; delegated authoring)
- 2v2 team 5+6: 'USR Pair 03' → 'Little Lost Robot' (decisions 3, 18; delegated authoring)
- 2v2 team 7+8: 'USR Pair 04' → "Calvin's Casebook" (decisions 3, 18; delegated authoring)
- 2v2 team 9+10: 'USR Pair 05' → 'Runaround' (decisions 3, 18; delegated authoring)
- 3v3 team 1+2+3: 'USR Squad 01' → 'Ghosts in the Machine' (decisions 3, 18; delegated authoring)
- 3v3 team 4+5+6: 'USR Squad 02' → 'Catch That Rabbit' (decisions 3, 18; delegated authoring)
- 3v3 team 7+8+9: 'USR Squad 03' → 'Positronic Pioneers' (decisions 3, 18; delegated authoring)
- Slot 2 art brief: 'White translucent NS-5 robot with a humanlike mechanical face and blue eyes. Arena unit 02 uses a distinct role-specific equipment silhouette.' → 'Translucent white NS-5 marked 02 in a braced stance, tall curved riot shield on one arm' (decisions 3, 18; delegated authoring)
- Slot 2 'NS-5 Unit 02': numbered name accepted as a mass-produced designation (decisions 3, 18; delegated authoring)
- Slot 2 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 3 art brief: 'White translucent NS-5 robot with a humanlike mechanical face and blue eyes. Arena unit 03 uses a distinct role-specific equipment silhouette.' → 'Translucent white NS-5 marked 03 on the thigh, standing upright, blue-lit rifle held low' (decisions 3, 18; delegated authoring)
- Slot 3 'NS-5 Unit 03': numbered name accepted as a mass-produced designation (decisions 3, 18; delegated authoring)
- Slot 3 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 4 art brief: 'White translucent NS-5 robot with a humanlike mechanical face and blue eyes. Arena unit 04 uses a distinct role-specific equipment silhouette.' → 'White NS-5 marked 04 on the chest, slab shield on one arm, glowing baton in the other hand' (decisions 3, 18; delegated authoring)
- Slot 4 'NS-5 Unit 04': numbered name accepted as a mass-produced designation (decisions 3, 18; delegated authoring)
- Slot 4 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 5 art brief: 'White translucent NS-5 robot with a humanlike mechanical face and blue eyes. Arena unit 05 uses a distinct role-specific equipment silhouette.' → 'White NS-5 leaning forward, chunky blue-cored cannon mounted on its forearm' (decisions 3, 18; delegated authoring)
- Slot 5 'NS-5 Unit 05': numbered name accepted as a mass-produced designation (decisions 3, 18; delegated authoring)
- Slot 5 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 6 art brief: 'White translucent NS-5 robot with a humanlike mechanical face and blue eyes. Arena unit 06 uses a distinct role-specific equipment silhouette.' → 'White NS-5 marked 06 on the chest, standing straight and unarmed, arms hanging loose' (decisions 3, 18; delegated authoring)
- Slot 6 'NS-5 Unit 06': numbered name accepted as a mass-produced designation (decisions 3, 18; delegated authoring)
- Slot 6 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 7 art brief: 'White translucent NS-5 robot with a humanlike mechanical face and blue eyes. Arena unit 07 uses a distinct role-specific equipment silhouette.' → 'Glossy NS-5 marked 07 in a relaxed stance, faint blue chest glow, unarmed' (decisions 3, 18; delegated authoring)
- Slot 7 'NS-5 Unit 07': numbered name accepted as a mass-produced designation (decisions 3, 18; delegated authoring)
- Slot 7 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 8 art brief: 'White translucent NS-5 robot with a humanlike mechanical face and blue eyes. Arena unit 08 uses a distinct role-specific equipment silhouette.' → 'NS-5 marked 08 on the upper arm, low wide crouch, hands curled ready' (decisions 3, 18; delegated authoring)
- Slot 8 'NS-5 Unit 08': numbered name accepted as a mass-produced designation (decisions 3, 18; delegated authoring)
- Slot 8 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 9 art brief: 'White translucent NS-5 robot with a humanlike mechanical face and blue eyes. Arena unit 09 uses a distinct role-specific equipment silhouette.' → 'Translucent NS-5 standing tall, long blue-lit rifle held down at its side' (decisions 3, 18; delegated authoring)
- Slot 9 'NS-5 Unit 09': numbered name accepted as a mass-produced designation (decisions 3, 18; delegated authoring)
- Slot 9 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 10 art brief: 'White translucent NS-5 robot with a humanlike mechanical face and blue eyes. Arena unit 10 uses a distinct role-specific equipment silhouette.' → 'NS-5 marked 10 on the chest, heavy multi-barrel cannon on one arm, blue eyes' (decisions 3, 18; delegated authoring)
- Slot 10 'NS-5 Unit 10': numbered name accepted as a mass-produced designation (decisions 3, 18; delegated authoring)
- Slot 10 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 11 art brief: 'White translucent NS-5 robot with a humanlike mechanical face and blue eyes. Arena unit 11 uses a distinct role-specific equipment silhouette.' → 'NS-5 marked 11 on the chest, wide crouch, unarmed with hands open, blue eyes' (decisions 3, 18; delegated authoring)
- Slot 11 'NS-5 Unit 11': numbered name accepted as a mass-produced designation (decisions 3, 18; delegated authoring)
- Slot 11 portrait: aligned (decisions 3, 18; delegated authoring)

Every blueprint is used at the robots target of 11; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Sonny | `single` | short | balanced | 15 | Versatile | White translucent NS-5 robot with a humanlike mechanical face and blue eyes. | `usr-synthetic-division/1.webp` |
| 2 | NS-5 Unit 02 | `single` | short | balanced | 10 | Versatile | Translucent white NS-5 marked 02 in a braced stance, tall curved riot shield on one arm | `usr-synthetic-division/2.webp` |
| 3 | NS-5 Unit 03 | `single` | mid | balanced | 10 | Deadeye | Translucent white NS-5 marked 03 on the thigh, standing upright, blue-lit rifle held low | `usr-synthetic-division/3.webp` |
| 4 | NS-5 Unit 04 | `weapon_shield` | short | defensive | 10 | Warden | White NS-5 marked 04 on the chest, slab shield on one arm, glowing baton in the other hand | `usr-synthetic-division/4.webp` |
| 5 | NS-5 Unit 05 | `single` | long | balanced | 10 | Deadeye | White NS-5 leaning forward, chunky blue-cored cannon mounted on its forearm | `usr-synthetic-division/5.webp` |
| 6 | NS-5 Unit 06 | `single` | short | balanced | 10 | Versatile | White NS-5 marked 06 on the chest, standing straight and unarmed, arms hanging loose | `usr-synthetic-division/6.webp` |
| 7 | NS-5 Unit 07 | `single` | mid | balanced | 10 | Deadeye | Glossy NS-5 marked 07 in a relaxed stance, faint blue chest glow, unarmed | `usr-synthetic-division/7.webp` |
| 8 | NS-5 Unit 08 | `weapon_shield` | short | defensive | 10 | Warden | NS-5 marked 08 on the upper arm, low wide crouch, hands curled ready | `usr-synthetic-division/8.webp` |
| 9 | NS-5 Unit 09 | `single` | long | balanced | 10 | Deadeye | Translucent NS-5 standing tall, long blue-lit rifle held down at its side | `usr-synthetic-division/9.webp` |
| 10 | NS-5 Unit 10 | `single` | short | balanced | 10 | Versatile | NS-5 marked 10 on the chest, heavy multi-barrel cannon on one arm, blue eyes | `usr-synthetic-division/10.webp` |
| 11 | NS-5 Unit 11 | `single` | mid | balanced | 10 | Deadeye | NS-5 marked 11 on the chest, wide crouch, unarmed with hands open, blue eyes | `usr-synthetic-division/11.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Sonny | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |
| 2 NS-5 Unit 02 | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |
| 3 NS-5 Unit 03 | Bolt Carbine (₡93,000) | Nova Caster (₡425,000) |
| 4 NS-5 Unit 04 | Laser Pistol + Light Shield (₡108,000) | Volt Sabre + Aegis Bulwark (₡834,000) |
| 5 NS-5 Unit 05 | Beam Pistol (₡93,000) | Particle Lance (₡425,000) |
| 6 NS-5 Unit 06 | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |
| 7 NS-5 Unit 07 | Bolt Carbine (₡93,000) | Nova Caster (₡425,000) |
| 8 NS-5 Unit 08 | Laser Pistol + Light Shield (₡108,000) | Volt Sabre + Aegis Bulwark (₡834,000) |
| 9 NS-5 Unit 09 | Beam Pistol (₡93,000) | Particle Lance (₡425,000) |
| 10 NS-5 Unit 10 | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |
| 11 NS-5 Unit 11 | Bolt Carbine (₡93,000) | Nova Caster (₡425,000) |

**Refinement plans** (generated; applied by Swarm goal 23, Refine → 8 steps per robot). All 11 robots: 65 steps, ₡32,380,000; the 11 robots at the target: ₡32,380,000; Refine → 8 applies ₡32,340,000 of the target robots' plans.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Sonny (5 steps, ₡2,960,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| NS-5 Unit 02 (5 steps, ₡2,960,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| NS-5 Unit 03 (5 steps, ₡2,960,000) | Nova Caster (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| NS-5 Unit 04 (10 steps, ₡2,870,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Armor Plating +1 (new) ₡20,000 | ₡2,820,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |
| NS-5 Unit 05 (5 steps, ₡2,960,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +4 (5 → 9) ₡160,000 | ₡2,960,000 |
| NS-5 Unit 06 (5 steps, ₡2,960,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| NS-5 Unit 07 (5 steps, ₡2,960,000) | Nova Caster (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| NS-5 Unit 08 (10 steps, ₡2,870,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Armor Plating +1 (new) ₡20,000 | ₡2,820,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |
| NS-5 Unit 09 (5 steps, ₡2,960,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +4 (5 → 9) ₡160,000 | ₡2,960,000 |
| NS-5 Unit 10 (5 steps, ₡2,960,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| NS-5 Unit 11 (5 steps, ₡2,960,000) | Nova Caster (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |

Storage (estimate; the engine counts at run time): 13 final weapons equipped at the robots target of 11. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need Storage Facility L2; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A04 ×1 (decision 4), A09 ×1 (decision 8, 17).

Source findings before decisions: A03 ×2, A04 ×1, A09 ×1, A13 ×10, V13 ×11.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 18. Cylon Centurion Fleet (`cylon-centurion-fleet`) — Swarm

| Field | Value |
|---|---|
| Stable name | Cylon Centurion Fleet |
| Franchise label | Battlestar Galactica |
| Backstory | Cylon Centurion Fleet enters the arena with a clear doctrine. Mass-produced ranged fighters with heavy variants. Every surviving machine returns to the workshop before the next booking. |
| Strategy | Swarm |
| Target overrides | none (goal 10 Robots → 11, the strategy default) |
| Team names | 2v2: **By Your Command** (robots 1+2), **Basestar Guard** (3+4), **Armistice Line** (5+6), **New Caprica Garrison** (7+8), **Resurrection Ship** (9+10) · 3v3: **Imperious Leader's Guard** (1–3), **First Cylon War** (4–6), **Cylon Occupation** (7–9) |
| Event order | `league_1v1`, `league_3v3`, `league_2v2`, `grand_melee`, `koth`, `tag_team`, `tournament_3v3`, `tournament_2v2`, `tournament_1v1` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- 2v2 team 1+2: 'Cylon Pair 01' → 'By Your Command' (decisions 3, 18; delegated authoring)
- 2v2 team 3+4: 'Cylon Pair 02' → 'Basestar Guard' (decisions 3, 18; delegated authoring)
- 2v2 team 5+6: 'Cylon Pair 03' → 'Armistice Line' (decisions 3, 18; delegated authoring)
- 2v2 team 7+8: 'Cylon Pair 04' → 'New Caprica Garrison' (decisions 3, 18; delegated authoring)
- 2v2 team 9+10: 'Cylon Pair 05' → 'Resurrection Ship' (decisions 3, 18; delegated authoring)
- 3v3 team 1+2+3: 'Cylon Squad 01' → "Imperious Leader's Guard" (decisions 3, 18; delegated authoring)
- 3v3 team 4+5+6: 'Cylon Squad 02' → 'First Cylon War' (decisions 3, 18; delegated authoring)
- 3v3 team 7+8+9: 'Cylon Squad 03' → 'Cylon Occupation' (decisions 3, 18; delegated authoring)
- Slot 1 robot name: 'Centurion Classic 01' → 'Centurion Classic' (decisions 3, 18; delegated authoring)
- Slot 1 art brief: 'Classic chrome Cylon Centurion with broad angular helmet and red scanner.' → 'Classic bright-chrome Centurion, crested helmet, red scanner visor, ribbed chest, heavy rifle held low' (decisions 3, 18; delegated authoring)
- Slot 1 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 2 robot name: 'Centurion Modern 02' → 'Centurion Modern' (decisions 3, 18; delegated authoring)
- Slot 2 art brief: 'Modern elongated Cylon Centurion, dark chrome plates and red eye slit.' → 'Lean modern Centurion, polished steel plates, red eye slit, gun barrel folded out of its forearm' (decisions 3, 18; delegated authoring)
- Slot 2 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 3 robot name: 'Centurion Heavy 03' → 'Model 0005' (decisions 3, 18; delegated authoring)
- Slot 3 art brief: 'Arena-designated modern Centurion with reinforced plating and heavy armament.' → 'Boxy crested Centurion, scuffed chrome plates, red visor, long rifle braced in both hands' (decisions 3, 18; delegated authoring)
- Slot 3 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 4 robot name: 'Centurion 04' → 'U-87' (decisions 3, 18; delegated authoring)
- Slot 4 art brief: 'Modern elongated Cylon Centurion, dark chrome plates and red eye slit. Arena unit 04 uses a distinct role-specific equipment silhouette.' → 'Gaunt dark-chrome Centurion, exposed ribbed torso, red eye slit, heavy gun barrel on its forearm' (decisions 3, 18; delegated authoring)
- Slot 4 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 5 art brief: 'Modern elongated Cylon Centurion, dark chrome plates and red eye slit. Arena unit 05 uses a distinct role-specific equipment silhouette.' → 'Riveted dark-chrome Centurion, red eye slit, stubby gun with a red light on its forearm' (decisions 3, 18; delegated authoring)
- Slot 5 'Centurion 05': numbered name accepted as a mass-produced designation (decisions 3, 18; delegated authoring)
- Slot 5 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 6 art brief: 'Modern elongated Cylon Centurion, dark chrome plates and red eye slit. Arena unit 06 uses a distinct role-specific equipment silhouette.' → 'Polished bright-chrome Centurion standing tall, red eye slit, forearm-mounted gun barrel' (decisions 3, 18; delegated authoring)
- Slot 6 'Centurion 06': numbered name accepted as a mass-produced designation (decisions 3, 18; delegated authoring)
- Slot 6 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 7 art brief: 'Modern elongated Cylon Centurion, dark chrome plates and red eye slit. Arena unit 07 uses a distinct role-specific equipment silhouette.' → 'Upright silver Centurion with 07 stencilled on its shoulder, red eye slit, forearm gun held low' (decisions 3, 18; delegated authoring)
- Slot 7 'Centurion 07': numbered name accepted as a mass-produced designation (decisions 3, 18; delegated authoring)
- Slot 7 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 8 art brief: 'Modern elongated Cylon Centurion, dark chrome plates and red eye slit. Arena unit 08 uses a distinct role-specific equipment silhouette.' → 'Striding scuffed-chrome Centurion, orange-red eye slit, bulky forearm gun with a glowing red strip' (decisions 3, 18; delegated authoring)
- Slot 8 'Centurion 08': numbered name accepted as a mass-produced designation (decisions 3, 18; delegated authoring)
- Slot 8 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 9 art brief: 'Modern elongated Cylon Centurion, dark chrome plates and red eye slit. Arena unit 09 uses a distinct role-specific equipment silhouette.' → 'Hunched dark-chrome Centurion, long red-striped gun barrel running down its forearm' (decisions 3, 18; delegated authoring)
- Slot 9 'Centurion 09': numbered name accepted as a mass-produced designation (decisions 3, 18; delegated authoring)
- Slot 9 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 10 art brief: 'Modern elongated Cylon Centurion, dark chrome plates and red eye slit. Arena unit 10 uses a distinct role-specific equipment silhouette.' → 'Dark-chrome Centurion, red eye slit, chunky multi-barrel cannon wrapped around its forearm' (decisions 3, 18; delegated authoring)
- Slot 10 'Centurion 10': numbered name accepted as a mass-produced designation (decisions 3, 18; delegated authoring)
- Slot 10 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 11 art brief: 'Modern elongated Cylon Centurion, dark chrome plates and red eye slit. Arena unit 11 uses a distinct role-specific equipment silhouette.' → 'Gaunt dark-chrome Centurion, glowing red eyes, long forearm gun, clawed free hand spread wide' (decisions 3, 18; delegated authoring)
- Slot 11 'Centurion 11': numbered name accepted as a mass-produced designation (decisions 3, 18; delegated authoring)
- Slot 11 portrait: aligned (decisions 3, 18; delegated authoring)

Every blueprint is used at the robots target of 11; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Centurion Classic | `single` | mid | balanced | 0 | Deadeye | Classic bright-chrome Centurion, crested helmet, red scanner visor, ribbed chest, heavy rifle held low | `cylon-centurion-fleet/1.webp` |
| 2 | Centurion Modern | `dual_wield` | short | offensive | 0 | Sprinter | Lean modern Centurion, polished steel plates, red eye slit, gun barrel folded out of its forearm | `cylon-centurion-fleet/2.webp` |
| 3 | Model 0005 | `two_handed` | mid | defensive | 0 | Warden | Boxy crested Centurion, scuffed chrome plates, red visor, long rifle braced in both hands | `cylon-centurion-fleet/3.webp` |
| 4 | U-87 | `two_handed` | mid | offensive | 0 | Bruiser | Gaunt dark-chrome Centurion, exposed ribbed torso, red eye slit, heavy gun barrel on its forearm | `cylon-centurion-fleet/4.webp` |
| 5 | Centurion 05 | `single` | long | balanced | 0 | Deadeye | Riveted dark-chrome Centurion, red eye slit, stubby gun with a red light on its forearm | `cylon-centurion-fleet/5.webp` |
| 6 | Centurion 06 | `single` | mid | balanced | 0 | Deadeye | Polished bright-chrome Centurion standing tall, red eye slit, forearm-mounted gun barrel | `cylon-centurion-fleet/6.webp` |
| 7 | Centurion 07 | `dual_wield` | short | offensive | 0 | Sprinter | Upright silver Centurion with 07 stencilled on its shoulder, red eye slit, forearm gun held low | `cylon-centurion-fleet/7.webp` |
| 8 | Centurion 08 | `two_handed` | mid | offensive | 0 | Bruiser | Striding scuffed-chrome Centurion, orange-red eye slit, bulky forearm gun with a glowing red strip | `cylon-centurion-fleet/8.webp` |
| 9 | Centurion 09 | `single` | long | balanced | 0 | Deadeye | Hunched dark-chrome Centurion, long red-striped gun barrel running down its forearm | `cylon-centurion-fleet/9.webp` |
| 10 | Centurion 10 | `single` | mid | balanced | 0 | Deadeye | Dark-chrome Centurion, red eye slit, chunky multi-barrel cannon wrapped around its forearm | `cylon-centurion-fleet/10.webp` |
| 11 | Centurion 11 | `dual_wield` | short | offensive | 0 | Sprinter | Gaunt dark-chrome Centurion, glowing red eyes, long forearm gun, clawed free hand spread wide | `cylon-centurion-fleet/11.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Centurion Classic | Bolt Carbine (₡93,000) | Nova Caster (₡425,000) |
| 2 Centurion Modern | Laser Pistol ×2 (₡114,000) | Volt Sabre ×2 (₡850,000) |
| 3 Model 0005 | Training Rifle (₡50,000) | Plasma Cannon (₡408,000) |
| 4 U-87 | Training Rifle (₡50,000) | Plasma Cannon (₡408,000) |
| 5 Centurion 05 | Beam Pistol (₡93,000) | Particle Lance (₡425,000) |
| 6 Centurion 06 | Bolt Carbine (₡93,000) | Nova Caster (₡425,000) |
| 7 Centurion 07 | Laser Pistol ×2 (₡114,000) | Volt Sabre ×2 (₡850,000) |
| 8 Centurion 08 | Training Rifle (₡50,000) | Plasma Cannon (₡408,000) |
| 9 Centurion 09 | Beam Pistol (₡93,000) | Particle Lance (₡425,000) |
| 10 Centurion 10 | Bolt Carbine (₡93,000) | Nova Caster (₡425,000) |
| 11 Centurion 11 | Laser Pistol ×2 (₡114,000) | Volt Sabre ×2 (₡850,000) |

**Refinement plans** (generated; applied by Swarm goal 23, Refine → 8 steps per robot). All 11 robots: 70 steps, ₡41,300,000; the 11 robots at the target: ₡41,300,000; Refine → 8 applies ₡40,340,000 of the target robots' plans.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Centurion Classic (5 steps, ₡2,960,000) | Nova Caster (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| Centurion Modern (10 steps, ₡5,920,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 · 9 Hone Power Core +4 (−3 → 1) ₡160,000 | ₡2,960,000 |
|  | Volt Sabre (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 · 10 Hone Power Core +4 (−3 → 1) ₡160,000 | ₡2,960,000 |
| Model 0005 (5 steps, ₡2,820,000) | Plasma Cannon (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Armor Plating +1 (new) ₡20,000 | ₡2,820,000 |
| U-87 (5 steps, ₡2,960,000) | Plasma Cannon (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Critical Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| Centurion 05 (5 steps, ₡2,960,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +4 (5 → 9) ₡160,000 | ₡2,960,000 |
| Centurion 06 (5 steps, ₡2,960,000) | Nova Caster (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| Centurion 07 (10 steps, ₡5,920,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 · 9 Hone Power Core +4 (−3 → 1) ₡160,000 | ₡2,960,000 |
|  | Volt Sabre (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 · 10 Hone Power Core +4 (−3 → 1) ₡160,000 | ₡2,960,000 |
| Centurion 08 (5 steps, ₡2,960,000) | Plasma Cannon (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Critical Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| Centurion 09 (5 steps, ₡2,960,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +4 (5 → 9) ₡160,000 | ₡2,960,000 |
| Centurion 10 (5 steps, ₡2,960,000) | Nova Caster (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| Centurion 11 (10 steps, ₡5,920,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 · 9 Hone Power Core +4 (−3 → 1) ₡160,000 | ₡2,960,000 |
|  | Volt Sabre (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 · 10 Hone Power Core +4 (−3 → 1) ₡160,000 | ₡2,960,000 |

Storage (estimate; the engine counts at run time): 14 final weapons equipped at the robots target of 11. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need Storage Facility L2; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A04 ×1 (decision 4).

Source findings before decisions: A03 ×2, A04 ×1, A13 ×11, V13 ×11.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 19. Eggman Badnik Works (`eggman-badnik-works`) — Swarm

| Field | Value |
|---|---|
| Stable name | Eggman Badnik Works |
| Franchise label | Sonic the Hedgehog |
| Backstory | Eggman Badnik Works enters the arena with a clear doctrine. Numerous small aggressive machines led by an elite design. Every surviving machine returns to the workshop before the next booking. |
| Strategy | Swarm |
| Target overrides | none (goal 10 Robots → 11, the strategy default) |
| Team names | 2v2: **Green Hill Ambush** (robots 1+2), **Egg Fleet Infantry** (3+4), **Chemical Plant Crew** (5+6), **Scrap Brain Works** (7+8), **Final Fortress** (9+10) · 3v3: **Stardust Speedway** (1–3), **Egg Carrier Guard** (4–6), **Death Egg Garrison** (7–9) |
| Event order | `league_3v3`, `league_2v2`, `grand_melee`, `koth`, `league_1v1`, `tag_team`, `tournament_3v3`, `tournament_2v2`, `tournament_1v1` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- 2v2 team 1+2: 'Badnik Pair 01' → 'Green Hill Ambush' (decisions 3, 18; delegated authoring)
- 2v2 team 3+4: 'Badnik Pair 02' → 'Egg Fleet Infantry' (decisions 3, 18; delegated authoring)
- 2v2 team 5+6: 'Badnik Pair 03' → 'Chemical Plant Crew' (decisions 3, 18; delegated authoring)
- 2v2 team 7+8: 'Badnik Pair 04' → 'Scrap Brain Works' (decisions 3, 18; delegated authoring)
- 2v2 team 9+10: 'Badnik Pair 05' → 'Final Fortress' (decisions 3, 18; delegated authoring)
- 3v3 team 1+2+3: 'Badnik Squad 01' → 'Stardust Speedway' (decisions 3, 18; delegated authoring)
- 3v3 team 4+5+6: 'Badnik Squad 02' → 'Egg Carrier Guard' (decisions 3, 18; delegated authoring)
- 3v3 team 7+8+9: 'Badnik Squad 03' → 'Death Egg Garrison' (decisions 3, 18; delegated authoring)
- Slot 4 art brief: 'Round red Egg Pawn robot with yellow markings and compact limbs. Arena unit 04 uses a distinct role-specific equipment silhouette.' → 'Round orange egg robot with a yellow zigzag band, grinning visor, cyan eyes, cone drill fists' (decisions 3, 18; delegated authoring)
- Slot 4 'Egg Pawn 04': numbered name accepted as a mass-produced designation (decisions 3, 18; delegated authoring)
- Slot 4 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 5 art brief: 'Round red Egg Pawn robot with yellow markings and compact limbs. Arena unit 05 uses a distinct role-specific equipment silhouette.' → 'Orange egg robot, grinning visor with cyan eyes, head vent slits, blocky clenched fists' (decisions 3, 18; delegated authoring)
- Slot 5 'Egg Pawn 05': numbered name accepted as a mass-produced designation (decisions 3, 18; delegated authoring)
- Slot 5 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 6 art brief: 'Round red Egg Pawn robot with yellow markings and compact limbs. Arena unit 06 uses a distinct role-specific equipment silhouette.' → 'Orange egg robot on wedge boots, grinning visor, cyan eyes, open pincer hands' (decisions 3, 18; delegated authoring)
- Slot 6 'Egg Pawn 06': numbered name accepted as a mass-produced designation (decisions 3, 18; delegated authoring)
- Slot 6 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 7 art brief: 'Round red Egg Pawn robot with yellow markings and compact limbs. Arena unit 07 uses a distinct role-specific equipment silhouette.' → 'Orange egg robot with yellow triangle side decals, grinning visor, cyan eyes, claw hands' (decisions 3, 18; delegated authoring)
- Slot 7 'Egg Pawn 07': numbered name accepted as a mass-produced designation (decisions 3, 18; delegated authoring)
- Slot 7 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 8 art brief: 'Round red Egg Pawn robot with yellow markings and compact limbs. Arena unit 08 uses a distinct role-specific equipment silhouette.' → 'Orange egg robot in a brawler stance, grinning visor, cyan eyes, blocky fists raised' (decisions 3, 18; delegated authoring)
- Slot 8 'Egg Pawn 08': numbered name accepted as a mass-produced designation (decisions 3, 18; delegated authoring)
- Slot 8 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 9 art brief: 'Round red Egg Pawn robot with yellow markings and compact limbs. Arena unit 09 uses a distinct role-specific equipment silhouette.' → 'Orange egg robot with yellow shoulder panels, grinning visor, round belly port, blocky fists' (decisions 3, 18; delegated authoring)
- Slot 9 'Egg Pawn 09': numbered name accepted as a mass-produced designation (decisions 3, 18; delegated authoring)
- Slot 9 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 10 art brief: 'Round red Egg Pawn robot with yellow markings and compact limbs. Arena unit 10 uses a distinct role-specific equipment silhouette.' → 'Orange egg robot with a head seam panel, grinning visor, cyan eyes, claws spread wide' (decisions 3, 18; delegated authoring)
- Slot 10 'Egg Pawn 10': numbered name accepted as a mass-produced designation (decisions 3, 18; delegated authoring)
- Slot 10 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 11 art brief: 'Round red Egg Pawn robot with yellow markings and compact limbs. Arena unit 11 uses a distinct role-specific equipment silhouette.' → 'Orange egg robot with twin yellow side stripes, grinning visor, wedge boots, claw hands' (decisions 3, 18; delegated authoring)
- Slot 11 'Egg Pawn 11': numbered name accepted as a mass-produced designation (decisions 3, 18; delegated authoring)
- Slot 11 portrait: aligned (decisions 3, 18; delegated authoring)

Every blueprint is used at the robots target of 11; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Metal Sonic | `dual_wield` | short | offensive | 0 | Sprinter | Sleek cobalt robot with red optics, pointed head and turbine-like torso. | `eggman-badnik-works/1.webp` |
| 2 | Moto Bug | `single` | melee | offensive | 10 | Sprinter | Red wheeled insect-like Badnik with dark metal limbs and antennae. | `eggman-badnik-works/2.webp` |
| 3 | Egg Pawn | `single` | short | offensive | 10 | Versatile | Round red Egg Pawn robot with yellow markings and compact limbs. | `eggman-badnik-works/3.webp` |
| 4 | Egg Pawn 04 | `single` | short | balanced | 10 | Versatile | Round orange egg robot with a yellow zigzag band, grinning visor, cyan eyes, cone drill fists | `eggman-badnik-works/4.webp` |
| 5 | Egg Pawn 05 | `single` | long | balanced | 10 | Deadeye | Orange egg robot, grinning visor with cyan eyes, head vent slits, blocky clenched fists | `eggman-badnik-works/5.webp` |
| 6 | Egg Pawn 06 | `weapon_shield` | short | defensive | 10 | Warden | Orange egg robot on wedge boots, grinning visor, cyan eyes, open pincer hands | `eggman-badnik-works/6.webp` |
| 7 | Egg Pawn 07 | `single` | mid | balanced | 10 | Deadeye | Orange egg robot with yellow triangle side decals, grinning visor, cyan eyes, claw hands | `eggman-badnik-works/7.webp` |
| 8 | Egg Pawn 08 | `two_handed` | short | offensive | 10 | Bruiser | Orange egg robot in a brawler stance, grinning visor, cyan eyes, blocky fists raised | `eggman-badnik-works/8.webp` |
| 9 | Egg Pawn 09 | `dual_wield` | melee | offensive | 10 | Sprinter | Orange egg robot with yellow shoulder panels, grinning visor, round belly port, blocky fists | `eggman-badnik-works/9.webp` |
| 10 | Egg Pawn 10 | `two_handed` | mid | offensive | 10 | Bruiser | Orange egg robot with a head seam panel, grinning visor, cyan eyes, claws spread wide | `eggman-badnik-works/10.webp` |
| 11 | Egg Pawn 11 | `two_handed` | long | defensive | 10 | Deadeye | Orange egg robot with twin yellow side stripes, grinning visor, wedge boots, claw hands | `eggman-badnik-works/11.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Metal Sonic | Laser Pistol ×2 (₡114,000) | Volt Sabre ×2 (₡850,000) |
| 2 Moto Bug | Practice Sword (₡50,000) | Vibro Mace (₡425,000) |
| 3 Egg Pawn | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |
| 4 Egg Pawn 04 | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |
| 5 Egg Pawn 05 | Beam Pistol (₡93,000) | Particle Lance (₡425,000) |
| 6 Egg Pawn 06 | Laser Pistol + Light Shield (₡108,000) | Volt Sabre + Aegis Bulwark (₡834,000) |
| 7 Egg Pawn 07 | Bolt Carbine (₡93,000) | Nova Caster (₡425,000) |
| 8 Egg Pawn 08 | Scatter Cannon (₡84,000) | Arc Projector (₡488,000) |
| 9 Egg Pawn 09 | Combat Knife ×2 (₡186,000) | Vibro Mace ×2 (₡850,000) |
| 10 Egg Pawn 10 | Training Rifle (₡50,000) | Plasma Cannon (₡408,000) |
| 11 Egg Pawn 11 | Training Beam (₡50,000) | Ion Beam (₡544,000) |

**Refinement plans** (generated; applied by Swarm goal 23, Refine → 8 steps per robot). All 11 robots: 70 steps, ₡38,390,000; the 11 robots at the target: ₡38,390,000; Refine → 8 applies ₡37,730,000 of the target robots' plans.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Metal Sonic (10 steps, ₡5,920,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 · 9 Hone Power Core +4 (−3 → 1) ₡160,000 | ₡2,960,000 |
|  | Volt Sabre (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 · 10 Hone Power Core +4 (−3 → 1) ₡160,000 | ₡2,960,000 |
| Moto Bug (5 steps, ₡2,960,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Gyro Stabilizers +4 (4 → 8) ₡160,000 | ₡2,960,000 |
| Egg Pawn (5 steps, ₡2,960,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| Egg Pawn 04 (5 steps, ₡2,960,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| Egg Pawn 05 (5 steps, ₡2,960,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +4 (5 → 9) ₡160,000 | ₡2,960,000 |
| Egg Pawn 06 (10 steps, ₡2,870,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Armor Plating +1 (new) ₡20,000 | ₡2,820,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |
| Egg Pawn 07 (5 steps, ₡2,960,000) | Nova Caster (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| Egg Pawn 08 (5 steps, ₡2,960,000) | Arc Projector (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| Egg Pawn 09 (10 steps, ₡5,920,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 · 9 Hone Gyro Stabilizers +4 (4 → 8) ₡160,000 | ₡2,960,000 |
|  | Vibro Mace (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 · 10 Hone Gyro Stabilizers +4 (4 → 8) ₡160,000 | ₡2,960,000 |
| Egg Pawn 10 (5 steps, ₡2,960,000) | Plasma Cannon (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Critical Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| Egg Pawn 11 (5 steps, ₡2,960,000) | Ion Beam (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (4 → 8) ₡160,000 | ₡2,960,000 |

Storage (estimate; the engine counts at run time): 14 final weapons equipped at the robots target of 11. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need Storage Facility L2; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A04 ×1 (decision 4).

Source findings before decisions: A03 ×2, A04 ×1, A13 ×8, V13 ×11.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 20. SteamWorld Privateers (`steamworld-privateers`) — Tycoon

| Field | Value |
|---|---|
| Stable name | SteamWorld Privateers |
| Franchise label | SteamWorld |
| Backstory | SteamWorld Privateers enters the arena with a clear doctrine. Build income before overextending the crew. Every surviving machine returns to the workshop before the next booking. |
| Strategy | Tycoon |
| Target overrides | goal 20 Robots → 3 (strategy default 2, allowed 2–3) |
| Team names | 2v2: **Royalist Wreckers** (robots 1+2) · 3v3: **Captain Piper's Crew** (1–3) |
| Event order | `koth`, `grand_melee`, `league_1v1`, `league_2v2`, `tag_team`, `tournament_1v1`, `tournament_2v2`, `league_3v3`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- 2v2 team 1+2: 'SteamWorld Pair 01' → 'Royalist Wreckers' (decision 3; delegated authoring)
- 3v3 team 1+2+3: 'SteamWorld Squad 01' → "Captain Piper's Crew" (decision 3; delegated authoring)

Every blueprint is used at the robots target of 3; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Piper Faraday | `single` | long | balanced | 20 | Tactician | Brass and steel robot captain with a practical gunfighter silhouette. | `steamworld-privateers/1.webp` |
| 2 | Sea Brass | `single` | mid | balanced | 15 | Deadeye | Weathered mechanical gunfighter with a broad head and worn nautical styling. | `steamworld-privateers/2.webp` |
| 3 | Ivanski | `two_handed` | melee | balanced | 15 | Bruiser | Large boiler-bodied robot strongman with heavy arms and exposed mechanical joints. | `steamworld-privateers/3.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Piper Faraday | Beam Pistol (₡93,000) | Particle Lance (₡425,000) |
| 2 Sea Brass | Bolt Carbine (₡93,000) | Nova Caster (₡425,000) |
| 3 Ivanski | War Club (₡84,000) | Heavy Hammer (₡478,000) |

**Refinement plans** (generated; applied by Tycoon goal 25, Refine → 10 steps per robot). All 3 robots: 15 steps, ₡8,500,000; the 3 robots at the target: ₡8,500,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Piper Faraday (5 steps, ₡2,820,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Combat Algorithms +1 (new) ₡20,000 | ₡2,820,000 |
| Sea Brass (5 steps, ₡2,840,000) | Nova Caster (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +2 (8 → 10) ₡40,000 | ₡2,840,000 |
| Ivanski (5 steps, ₡2,840,000) | Heavy Hammer (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +2 (7 → 9) ₡40,000 | ₡2,840,000 |

Storage (estimate; the engine counts at run time): 3 final weapons equipped at the robots target of 3. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A04 ×1 (decision 4).

Source findings before decisions: A03 ×1, A04 ×1, V08 ×1, V13 ×3.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 21. Hyperion Loader Division (`hyperion-loader-division`) — Tycoon

| Field | Value |
|---|---|
| Stable name | Hyperion Loader Division |
| Franchise label | Borderlands |
| Backstory | Hyperion Loader Division enters the arena with a clear doctrine. Corporate income and facilities fund industrial fighting machines. Every surviving machine returns to the workshop before the next booking. |
| Strategy | Tycoon |
| Target overrides | goal 20 Robots → 3 (strategy default 2, allowed 2–3) |
| Team names | 2v2: **Helios Station** (robots 1+2) · 3v3: **Handsome Jack's Army** (1–3) |
| Event order | `koth`, `grand_melee`, `league_1v1`, `league_2v2`, `tag_team`, `tournament_1v1`, `tournament_2v2`, `league_3v3`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- 2v2 team 1+2: 'Hyperion Pair 01' → 'Helios Station' (decisions 3, 18; delegated authoring)
- 3v3 team 1+2+3: 'Hyperion Squad 01' → "Handsome Jack's Army" (decisions 3, 18; delegated authoring)
- Slot 2 robot name: 'Hyperion Combat Loader 02' → 'WAR Loader' (decisions 3, 18; delegated authoring)
- Slot 2 art brief: 'Yellow Hyperion combat loader with angular body and weapon-bearing arms.' → 'Hulking yellow Hyperion loader, red eye, HYPERION chest stencil, rotary cannon arm and pincer claw' (decisions 3, 18; delegated authoring)
- Slot 2 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 3 robot name: 'Hyperion Constructor 03' → 'Hyperion Constructor' (decisions 3, 18; delegated authoring)
- Slot 3 art brief: 'Broad yellow industrial Constructor with a large lens and heavy lower assembly.' → 'Boxy yellow Hyperion walker on four splayed legs, big red lens, red-tipped rocket pods on its roof' (decisions 3, 18; delegated authoring)
- Slot 3 portrait: aligned (decisions 3, 18; delegated authoring)

Every blueprint is used at the robots target of 3; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Claptrap | `single` | short | balanced | 35 | Tactician | Yellow one-wheeled service robot, square body, single blue optic and thin arms. | `hyperion-loader-division/1.webp` |
| 2 | WAR Loader | `dual_wield` | short | offensive | 5 | Bruiser | Hulking yellow Hyperion loader, red eye, HYPERION chest stencil, rotary cannon arm and pincer claw | `hyperion-loader-division/2.webp` |
| 3 | Hyperion Constructor | `two_handed` | mid | defensive | 10 | Warden | Boxy yellow Hyperion walker on four splayed legs, big red lens, red-tipped rocket pods on its roof | `hyperion-loader-division/3.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Claptrap | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |
| 2 WAR Loader | Laser Pistol ×2 (₡114,000) | Volt Sabre ×2 (₡850,000) |
| 3 Hyperion Constructor | Training Rifle (₡50,000) | Plasma Cannon (₡408,000) |

**Refinement plans** (generated; applied by Tycoon goal 25, Refine → 10 steps per robot). All 3 robots: 20 steps, ₡11,320,000; the 3 robots at the target: ₡11,320,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Claptrap (5 steps, ₡2,820,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Combat Algorithms +1 (new) ₡20,000 | ₡2,820,000 |
| WAR Loader (10 steps, ₡5,680,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 · 9 Hone Combat Power +2 (8 → 10) ₡40,000 | ₡2,840,000 |
|  | Volt Sabre (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 · 10 Hone Combat Power +2 (8 → 10) ₡40,000 | ₡2,840,000 |
| Hyperion Constructor (5 steps, ₡2,820,000) | Plasma Cannon (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Armor Plating +1 (new) ₡20,000 | ₡2,820,000 |

Storage (estimate; the engine counts at run time): 4 final weapons equipped at the robots target of 3. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A04 ×1 (decision 4).

Source findings before decisions: A03 ×2, A04 ×1, A13 ×2, V08 ×1, V13 ×3.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 22. Wasteland Robotics (`wasteland-robotics`) — Generalist

| Field | Value |
|---|---|
| Stable name | Wasteland Robotics |
| Franchise label | Fallout |
| Backstory | Wasteland Robotics enters the arena with a clear doctrine. Grow from utility machinery to specialist combat models. Every surviving machine returns to the workshop before the next booking. |
| Strategy | Generalist |
| Target overrides | goal 14 Robots → 4 (strategy default 2, allowed 2–4) |
| Team names | 2v2: **Sanctuary Hills** (robots 1+2), **RobCo Security** (3+4) · 3v3: **Mechanist's Army** (1–3) |
| Event order | `league_1v1`, `league_2v2`, `league_3v3`, `tag_team`, `koth`, `grand_melee`, `tournament_1v1`, `tournament_2v2`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- 2v2 team 1+2: 'Wasteland Pair 01' → 'Sanctuary Hills' (decisions 3, 18; delegated authoring)
- 2v2 team 3+4: 'Wasteland Pair 02' → 'RobCo Security' (decisions 3, 18; delegated authoring)
- 3v3 team 1+2+3: 'Wasteland Squad 01' → "Mechanist's Army" (decisions 3, 18; delegated authoring)
- Slot 2 robot name: 'Wasteland Assaultron 02' → 'Assaultron' (decisions 3, 18; delegated authoring)
- Slot 2 art brief: 'Lean rusted Assaultron with a central head emitter and articulated blade-like limbs.' → 'Lean rusted green Assaultron, glowing red head laser eye, curved blade forearms' (decisions 3, 18; delegated authoring)
- Slot 2 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 3 robot name: 'Wasteland Sentry Bot 03' → 'Sentry Bot' (decisions 3, 18; delegated authoring)
- Slot 3 art brief: 'Heavy armoured Sentry Bot on three wheels with military plates and cannon arms.' → 'Olive Sentry Bot with a white army star, gatling arm and heavy cannon arm, chunky wheels' (decisions 3, 18; delegated authoring)
- Slot 3 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 4 robot name: 'Wasteland Protectron 04' → 'Protectron' (decisions 3, 18; delegated authoring)
- Slot 4 art brief: 'Rounded retro-industrial Protectron with glass-like head dome and thick service limbs.' → 'Pale-blue rusted Protectron, glass head dome with a single lamp, gun arm and pincer claw' (decisions 3, 18; delegated authoring)
- Slot 4 portrait: aligned (decisions 3, 18; delegated authoring)
- Goal 14 Robots target: 3 → 4 (decision 5)

Every blueprint is used at the robots target of 4; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Codsworth | `single` | long | defensive | 25 | Tactician | Retro metallic Mr Handy robot, three articulated tool arms and separate eye stalks. | `wasteland-robotics/1.webp` |
| 2 | Assaultron | `dual_wield` | melee | offensive | 5 | Sprinter | Lean rusted green Assaultron, glowing red head laser eye, curved blade forearms | `wasteland-robotics/2.webp` |
| 3 | Sentry Bot | `two_handed` | mid | defensive | 5 | Warden | Olive Sentry Bot with a white army star, gatling arm and heavy cannon arm, chunky wheels | `wasteland-robotics/3.webp` |
| 4 | Protectron | `weapon_shield` | short | defensive | 25 | Warden | Pale-blue rusted Protectron, glass head dome with a single lamp, gun arm and pincer claw | `wasteland-robotics/4.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Codsworth | Beam Pistol (₡93,000) | Particle Lance (₡425,000) |
| 2 Assaultron | Combat Knife ×2 (₡186,000) | Vibro Mace ×2 (₡850,000) |
| 3 Sentry Bot | Training Rifle (₡50,000) | Plasma Cannon (₡408,000) |
| 4 Protectron | Laser Pistol + Light Shield (₡108,000) | Volt Sabre + Aegis Bulwark (₡834,000) |

**Refinement plans** (generated; applied by Generalist goal 18, Refine → 10 steps per robot). All 4 robots: 30 steps, ₡14,190,000; the 4 robots at the target: ₡14,190,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Codsworth (5 steps, ₡2,820,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Combat Algorithms +1 (new) ₡20,000 | ₡2,820,000 |
| Assaultron (10 steps, ₡5,680,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 · 9 Hone Gyro Stabilizers +2 (4 → 6) ₡40,000 | ₡2,840,000 |
|  | Vibro Mace (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 · 10 Hone Gyro Stabilizers +2 (4 → 6) ₡40,000 | ₡2,840,000 |
| Sentry Bot (5 steps, ₡2,820,000) | Plasma Cannon (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Armor Plating +1 (new) ₡20,000 | ₡2,820,000 |
| Protectron (10 steps, ₡2,870,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Armor Plating +1 (new) ₡20,000 | ₡2,820,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |

Storage (estimate; the engine counts at run time): 6 final weapons equipped at the robots target of 4. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need Storage Facility L1; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A04 ×1 (decision 4).

Source findings before decisions: A03 ×2, A04 ×1, A12 ×1, A13 ×3, V08 ×1, V13 ×4.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 23. BattleTech Mercenary Lance (`battletech-mercenary-lance`) — Trio

| Field | Value |
|---|---|
| Stable name | BattleTech Mercenary Lance |
| Franchise label | BattleTech |
| Backstory | BattleTech Mercenary Lance enters the arena with a clear doctrine. Heavy anchor, ranged all-rounder, fast scout. Every surviving machine returns to the workshop before the next booking. |
| Strategy | Trio |
| Target overrides | none (goal 12 Robots → 3, the strategy default) |
| Team names | 2v2: **Kell Hounds** (robots 1+2) · 3v3: **Gray Death Legion** (1–3) |
| Event order | `league_3v3`, `tournament_3v3`, `league_1v1`, `league_2v2`, `tag_team`, `koth`, `grand_melee`, `tournament_2v2`, `tournament_1v1` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- Franchise label: 'BattleTech / MechWarrior' → 'BattleTech' (decisions 3, 7; delegated authoring)
- 2v2 team 1+2: 'Mercenary Pair 01' → 'Kell Hounds' (decisions 3, 7; delegated authoring)
- 3v3 team 1+2+3: 'Mercenary Squad 01' → 'Gray Death Legion' (decisions 3, 7; delegated authoring)

Every blueprint is used at the robots target of 3; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Atlas AS7-D | `two_handed` | melee | defensive | 5 | Warden | Skull-faced Atlas BattleMech with immense shoulders and weathered military armour. | `battletech-mercenary-lance/1.webp` |
| 2 | Timber Wolf | `two_handed` | mid | balanced | 10 | Versatile | Timber Wolf BattleMech with narrow cockpit, articulated arms and shoulder missile pods. | `battletech-mercenary-lance/2.webp` |
| 3 | Locust | `single` | short | offensive | 20 | Sprinter | Small light BattleMech with compact cockpit and long thin mechanical legs. | `battletech-mercenary-lance/3.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Atlas AS7-D | War Club (₡84,000) | Heavy Hammer (₡478,000) |
| 2 Timber Wolf | Training Rifle (₡50,000) | Plasma Cannon (₡408,000) |
| 3 Locust | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |

**Refinement plans** (generated; applied by Trio goal 22, Refine → 10 steps per robot). All 3 robots: 15 steps, ₡8,430,000; the 3 robots at the target: ₡8,430,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Atlas AS7-D (5 steps, ₡2,810,000) | Heavy Hammer (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (7 → 8) ₡10,000 | ₡2,810,000 |
| Timber Wolf (5 steps, ₡2,810,000) | Plasma Cannon (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (7 → 8) ₡10,000 | ₡2,810,000 |
| Locust (5 steps, ₡2,810,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Power Core +1 (−3 → −2) ₡10,000 | ₡2,810,000 |

Storage (estimate; the engine counts at run time): 3 final weapons equipped at the robots target of 3. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5), A04 ×1 (decision 4).

Source findings before decisions: A01 ×1, A03 ×1, A04 ×1, A11 ×1, V13 ×3, V18 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 24. Rubicon Raven Workshop (`rubicon-raven-workshop`) — Paragon

| Field | Value |
|---|---|
| Stable name | Rubicon Raven Workshop |
| Franchise label | Armored Core |
| Backstory | Rubicon Raven Workshop enters the arena with a clear doctrine. Concentrate refinement in one premium machine. Every surviving machine returns to the workshop before the next booking. |
| Strategy | Paragon |
| Target overrides | goal 3 Booking Office → L4 (strategy default L1, allowed L0–L6); goal 8 Robots → 2 (strategy default 1, allowed 1–2) |
| Team names | 2v2: **Fires of Raven** (robots 1+2) · 3v3: none |
| Event order | `league_1v1`, `tournament_1v1`, `koth`, `grand_melee`, `league_2v2`, `tag_team`, `tournament_2v2`, `league_3v3`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- 2v2 team 1+2: 'Raven Pair 01' → 'Fires of Raven' (decision 3; delegated authoring)
- Goal 3 Booking Office target: L1 → L4 (decision 5)
- Goal 8 Robots target: 1 → 2 (decision 5)

Every blueprint is used at the robots target of 2; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | NIGHTFALL | `dual_wield` | mid | balanced | 5 | Versatile | Dense angular Armored Core with utilitarian armour and asymmetric military attachments. | `rubicon-raven-workshop/1.webp` |
| 2 | STEEL HAZE | `dual_wield` | melee | offensive | 10 | Sprinter | Lean high-mobility Armored Core with articulated reverse-joint-inspired leg detail. | `rubicon-raven-workshop/2.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 NIGHTFALL | Disruptor Cannon ×2 (₡586,000) | Nova Caster ×2 (₡850,000) |
| 2 STEEL HAZE | Energy Blade ×2 (₡350,000) | Vibro Mace ×2 (₡850,000) |

**Refinement plans** (generated; applied by Paragon goal 16, Refine → 10 steps per robot). All 2 robots: 20 steps, ₡11,240,000; the 2 robots at the target: ₡11,240,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| NIGHTFALL (10 steps, ₡5,620,000) | Nova Caster (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 · 9 Hone Combat Power +1 (8 → 9) ₡10,000 | ₡2,810,000 |
|  | Nova Caster (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 · 10 Hone Combat Power +1 (8 → 9) ₡10,000 | ₡2,810,000 |
| STEEL HAZE (10 steps, ₡5,620,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 · 9 Hone Gyro Stabilizers +1 (4 → 5) ₡10,000 | ₡2,810,000 |
|  | Vibro Mace (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 · 10 Hone Gyro Stabilizers +1 (4 → 5) ₡10,000 | ₡2,810,000 |

Storage (estimate; the engine counts at run time): 4 final weapons equipped at the robots target of 2. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A04 ×1 (decision 4).

Source findings before decisions: A03 ×1, A04 ×1, A12 ×1, V13 ×4.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 25. Wanzer Assembly Corps (`wanzer-assembly-corps`) — Trio

| Field | Value |
|---|---|
| Stable name | Wanzer Assembly Corps |
| Franchise label | Front Mission |
| Backstory | Wanzer Assembly Corps enters the arena with a clear doctrine. Give the squad melee, ranged, and defensive builds. Every surviving machine returns to the workshop before the next booking. |
| Strategy | Trio |
| Target overrides | none (goal 12 Robots → 3, the strategy default) |
| Team names | 2v2: **Huffman Crisis** (robots 1+2) · 3v3: **Canyon Crows** (1–3) |
| Event order | `league_3v3`, `tournament_3v3`, `league_1v1`, `league_2v2`, `tag_team`, `koth`, `grand_melee`, `tournament_2v2`, `tournament_1v1` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- 2v2 team 1+2: 'Wanzer Pair 01' → 'Huffman Crisis' (decisions 3, 18; delegated authoring)
- 3v3 team 1+2+3: 'Wanzer Squad 01' → 'Canyon Crows' (decisions 3, 18; delegated authoring)
- Slot 1 robot name: 'Wanzer Vanguard 01' → 'Gust' (decisions 3, 18; delegated authoring)
- Slot 1 art brief: 'Original arena Wanzer frame, squared olive armour, heavy arms and visible actuators.' → 'Blocky olive wanzer with boxy shoulders, two-handed long rifle held across its chest' (decisions 3, 18; delegated authoring)
- Slot 1 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 2 robot name: 'Wanzer Longshot 02' → 'Frost' (decisions 3, 18; delegated authoring)
- Slot 2 art brief: 'Original arena Wanzer frame with long firearm, stable legs and military sensor head.' → 'Pale khaki wanzer with twin antennae, aiming a long scoped sniper rifle' (decisions 3, 18; delegated authoring)
- Slot 2 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 3 robot name: 'Wanzer Bastion 03' → 'Zenith' (decisions 3, 18; delegated authoring)
- Slot 3 art brief: 'Original arena Wanzer defender with thick blue-grey plates and a large shield.' → 'Slate-blue armoured wanzer, tall slab shield on one arm, forearm gun on the other' (decisions 3, 18; delegated authoring)
- Slot 3 portrait: aligned (decisions 3, 18; delegated authoring)

Every blueprint is used at the robots target of 3; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Gust | `two_handed` | melee | balanced | 10 | Bruiser | Blocky olive wanzer with boxy shoulders, two-handed long rifle held across its chest | `wanzer-assembly-corps/1.webp` |
| 2 | Frost | `two_handed` | long | defensive | 15 | Deadeye | Pale khaki wanzer with twin antennae, aiming a long scoped sniper rifle | `wanzer-assembly-corps/2.webp` |
| 3 | Zenith | `weapon_shield` | mid | defensive | 20 | Warden | Slate-blue armoured wanzer, tall slab shield on one arm, forearm gun on the other | `wanzer-assembly-corps/3.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Gust | War Club (₡84,000) | Heavy Hammer (₡478,000) |
| 2 Frost | Training Beam (₡50,000) | Ion Beam (₡544,000) |
| 3 Zenith | Bolt Carbine + Combat Shield (₡171,000) | Nova Caster + Aegis Bulwark (₡834,000) |

**Refinement plans** (generated; applied by Trio goal 22, Refine → 10 steps per robot). All 3 robots: 20 steps, ₡8,480,000; the 3 robots at the target: ₡8,480,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Gust (5 steps, ₡2,810,000) | Heavy Hammer (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (7 → 8) ₡10,000 | ₡2,810,000 |
| Frost (5 steps, ₡2,810,000) | Ion Beam (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (8 → 9) ₡10,000 | ₡2,810,000 |
| Zenith (10 steps, ₡2,860,000) | Nova Caster (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (8 → 9) ₡10,000 | ₡2,810,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |

Storage (estimate; the engine counts at run time): 4 final weapons equipped at the robots target of 3. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5), A04 ×1 (decision 4).

Source findings before decisions: A01 ×1, A03 ×2, A04 ×1, A11 ×1, A13 ×3, V13 ×3.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 26. Shadow Moses Arsenal (`shadow-moses-arsenal`) — Paragon

| Field | Value |
|---|---|
| Stable name | Shadow Moses Arsenal |
| Franchise label | Metal Gear |
| Backstory | Shadow Moses Arsenal enters the arena with a clear doctrine. A concentrated investment in one siege-like war machine. Every surviving machine returns to the workshop before the next booking. |
| Strategy | Paragon |
| Target overrides | goal 3 Booking Office → L4 (strategy default L1, allowed L0–L6); goal 8 Robots → 2 (strategy default 1, allowed 1–2) |
| Team names | 2v2: **Big Shell Incident** (robots 1+2) · 3v3: none |
| Event order | `league_1v1`, `grand_melee`, `tournament_1v1`, `koth`, `league_2v2`, `tag_team`, `tournament_2v2`, `league_3v3`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- 2v2 team 1+2: 'Shadow Moses Pair 01' → 'Big Shell Incident' (decision 3; delegated authoring)
- Goal 3 Booking Office target: L1 → L4 (decision 5)
- Goal 8 Robots target: 1 → 2 (decision 5)

Every blueprint is used at the robots target of 2; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Metal Gear REX | `two_handed` | long | defensive | 0 | Deadeye | Angular REX war machine with heavy legs, sensor head and prominent railgun assembly. | `shadow-moses-arsenal/1.webp` |
| 2 | Metal Gear RAY | `two_handed` | mid | offensive | 5 | Sprinter | Streamlined RAY war machine with long arm assemblies and powerful mechanical legs. | `shadow-moses-arsenal/2.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Metal Gear REX | Siege Cannon (₡163,000) | Ion Beam (₡544,000) |
| 2 Metal Gear RAY | Shotgun (₡283,000) | Plasma Cannon (₡408,000) |

**Refinement plans** (generated; applied by Paragon goal 16, Refine → 10 steps per robot). All 2 robots: 10 steps, ₡5,620,000; the 2 robots at the target: ₡5,620,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Metal Gear REX (5 steps, ₡2,810,000) | Ion Beam (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (8 → 9) ₡10,000 | ₡2,810,000 |
| Metal Gear RAY (5 steps, ₡2,810,000) | Plasma Cannon (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Power Core +1 (−3 → −2) ₡10,000 | ₡2,810,000 |

Storage (estimate; the engine counts at run time): 2 final weapons equipped at the robots target of 2. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A04 ×1 (decision 4).

Source findings before decisions: A03 ×1, A04 ×1, A12 ×1, V13 ×2.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 27. FNIX Machine Network (`fnix-machine-network`) — Swarm

| Field | Value |
|---|---|
| Stable name | FNIX Machine Network |
| Franchise label | Generation Zero |
| Backstory | FNIX Machine Network enters the arena with a clear doctrine. Advance from smaller machines toward heavy platforms. Every surviving machine returns to the workshop before the next booking. |
| Strategy | Swarm |
| Target overrides | none (goal 10 Robots → 11, the strategy default) |
| Team names | 2v2: **Landfall Patrol** (robots 1+2), **Alpine Unrest** (3+4), **Saltbacken Watch** (5+6), **Archipelago Sweep** (7+8), **Apocalypse Class** (9+10) · 3v3: **FNIX Rising** (1–3), **Harvest Season** (4–6), **Reaper Pack** (7–9) |
| Event order | `league_3v3`, `league_2v2`, `grand_melee`, `koth`, `league_1v1`, `tag_team`, `tournament_3v3`, `tournament_2v2`, `tournament_1v1` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- 2v2 team 1+2: 'FNIX Pair 01' → 'Landfall Patrol' (decisions 3, 18; delegated authoring)
- 2v2 team 3+4: 'FNIX Pair 02' → 'Alpine Unrest' (decisions 3, 18; delegated authoring)
- 2v2 team 5+6: 'FNIX Pair 03' → 'Saltbacken Watch' (decisions 3, 18; delegated authoring)
- 2v2 team 7+8: 'FNIX Pair 04' → 'Archipelago Sweep' (decisions 3, 18; delegated authoring)
- 2v2 team 9+10: 'FNIX Pair 05' → 'Apocalypse Class' (decisions 3, 18; delegated authoring)
- 3v3 team 1+2+3: 'FNIX Squad 01' → 'FNIX Rising' (decisions 3, 18; delegated authoring)
- 3v3 team 4+5+6: 'FNIX Squad 02' → 'Harvest Season' (decisions 3, 18; delegated authoring)
- 3v3 team 7+8+9: 'FNIX Squad 03' → 'Reaper Pack' (decisions 3, 18; delegated authoring)
- Slot 1 robot name: 'FNIX Runner 01' → 'Military Runner' (decisions 3, 18; delegated authoring)
- Slot 1 art brief: 'Low quadruped Runner machine with exposed cables, red sensor and mounted firearm.' → 'Olive four-legged Runner, exposed orange cables, red sensor eye, machine-gun turret on its back' (decisions 3, 18; delegated authoring)
- Slot 1 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 2 robot name: 'FNIX Hunter 02' → 'Prototype Hunter' (decisions 3, 18; delegated authoring)
- Slot 2 art brief: 'Tall Hunter machine with narrow military head, dark frame and practical weapon mounts.' → 'Tall grey-green two-legged Hunter, hunched frame, red indicator lights, arm-mounted rifle' (decisions 3, 18; delegated authoring)
- Slot 2 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 3 robot name: 'FNIX Tank 03' → 'Military Tank' (decisions 3, 18; delegated authoring)
- Slot 3 art brief: 'Large two-legged Tank machine with broad armoured torso and heavy weapon platforms.' → 'Hulking olive two-legged Tank, rocket pod arm and heavy cannon arm, red sensor slits' (decisions 3, 18; delegated authoring)
- Slot 3 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 4 robot name: 'FNIX Harvester 04' → 'Military Harvester' (decisions 3, 18; delegated authoring)
- Slot 4 art brief: 'Broad industrial Harvester machine with heavy support legs and weapon pods.' → 'Olive six-legged Harvester, hazard stripes, underbelly spiral drill, twin rocket pods on its back' (decisions 3, 18; delegated authoring)
- Slot 4 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 5 art brief: 'Low quadruped Runner machine with exposed cables, red sensor and mounted firearm. Arena unit 05 uses a distinct role-specific equipment silhouette.' → 'Black-and-red FNIX Runner on four legs, red arrow decal, back-mounted rifle turret, red eye' (decisions 3, 18; delegated authoring)
- Slot 5 'FNIX Runner 05': numbered name accepted as a mass-produced designation (decisions 3, 18; delegated authoring)
- Slot 5 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 6 art brief: 'Low quadruped Runner machine with exposed cables, red sensor and mounted firearm. Arena unit 06 uses a distinct role-specific equipment silhouette.' → 'Red-plated FNIX Runner, diamond decals, ammo box and long rifle turret on its back' (decisions 3, 18; delegated authoring)
- Slot 6 'FNIX Runner 06': numbered name accepted as a mass-produced designation (decisions 3, 18; delegated authoring)
- Slot 6 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 7 art brief: 'Low quadruped Runner machine with exposed cables, red sensor and mounted firearm. Arena unit 07 uses a distinct role-specific equipment silhouette.' → 'Red FNIX Runner stencilled 07 on its flank, red eye, rear rifle turret with an ammo box' (decisions 3, 18; delegated authoring)
- Slot 7 'FNIX Runner 07': numbered name accepted as a mass-produced designation (decisions 3, 18; delegated authoring)
- Slot 7 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 8 art brief: 'Low quadruped Runner machine with exposed cables, red sensor and mounted firearm. Arena unit 08 uses a distinct role-specific equipment silhouette.' → 'Weathered red FNIX Runner, tall antenna, back-mounted long rifle turret, red eye' (decisions 3, 18; delegated authoring)
- Slot 8 'FNIX Runner 08': numbered name accepted as a mass-produced designation (decisions 3, 18; delegated authoring)
- Slot 8 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 9 art brief: 'Low quadruped Runner machine with exposed cables, red sensor and mounted firearm. Arena unit 09 uses a distinct role-specific equipment silhouette.' → 'Red FNIX Runner stencilled 09, twin rear antennae, chin-mounted rifle under its red eye' (decisions 3, 18; delegated authoring)
- Slot 9 'FNIX Runner 09': numbered name accepted as a mass-produced designation (decisions 3, 18; delegated authoring)
- Slot 9 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 10 art brief: 'Low quadruped Runner machine with exposed cables, red sensor and mounted firearm. Arena unit 10 uses a distinct role-specific equipment silhouette.' → 'Red FNIX Runner with chevron shoulder plates, roll-cage face guard, back-mounted cannon turret' (decisions 3, 18; delegated authoring)
- Slot 10 'FNIX Runner 10': numbered name accepted as a mass-produced designation (decisions 3, 18; delegated authoring)
- Slot 10 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 11 art brief: 'Low quadruped Runner machine with exposed cables, red sensor and mounted firearm. Arena unit 11 uses a distinct role-specific equipment silhouette.' → 'Black-and-red FNIX Runner, twin red eyes, chin-mounted heavy gun, warning-sign box on its flank' (decisions 3, 18; delegated authoring)
- Slot 11 'FNIX Runner 11': numbered name accepted as a mass-produced designation (decisions 3, 18; delegated authoring)
- Slot 11 portrait: aligned (decisions 3, 18; delegated authoring)

Every blueprint is used at the robots target of 11; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Military Runner | `single` | short | offensive | 5 | Sprinter | Olive four-legged Runner, exposed orange cables, red sensor eye, machine-gun turret on its back | `fnix-machine-network/1.webp` |
| 2 | Prototype Hunter | `dual_wield` | short | offensive | 0 | Sprinter | Tall grey-green two-legged Hunter, hunched frame, red indicator lights, arm-mounted rifle | `fnix-machine-network/2.webp` |
| 3 | Military Tank | `two_handed` | mid | defensive | 0 | Warden | Hulking olive two-legged Tank, rocket pod arm and heavy cannon arm, red sensor slits | `fnix-machine-network/3.webp` |
| 4 | Military Harvester | `two_handed` | long | defensive | 5 | Tactician | Olive six-legged Harvester, hazard stripes, underbelly spiral drill, twin rocket pods on its back | `fnix-machine-network/4.webp` |
| 5 | FNIX Runner 05 | `single` | long | balanced | 10 | Deadeye | Black-and-red FNIX Runner on four legs, red arrow decal, back-mounted rifle turret, red eye | `fnix-machine-network/5.webp` |
| 6 | FNIX Runner 06 | `weapon_shield` | short | defensive | 10 | Warden | Red-plated FNIX Runner, diamond decals, ammo box and long rifle turret on its back | `fnix-machine-network/6.webp` |
| 7 | FNIX Runner 07 | `single` | mid | balanced | 10 | Deadeye | Red FNIX Runner stencilled 07 on its flank, red eye, rear rifle turret with an ammo box | `fnix-machine-network/7.webp` |
| 8 | FNIX Runner 08 | `two_handed` | short | offensive | 10 | Bruiser | Weathered red FNIX Runner, tall antenna, back-mounted long rifle turret, red eye | `fnix-machine-network/8.webp` |
| 9 | FNIX Runner 09 | `dual_wield` | melee | offensive | 10 | Sprinter | Red FNIX Runner stencilled 09, twin rear antennae, chin-mounted rifle under its red eye | `fnix-machine-network/9.webp` |
| 10 | FNIX Runner 10 | `two_handed` | mid | offensive | 10 | Bruiser | Red FNIX Runner with chevron shoulder plates, roll-cage face guard, back-mounted cannon turret | `fnix-machine-network/10.webp` |
| 11 | FNIX Runner 11 | `two_handed` | long | defensive | 10 | Deadeye | Black-and-red FNIX Runner, twin red eyes, chin-mounted heavy gun, warning-sign box on its flank | `fnix-machine-network/11.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Military Runner | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |
| 2 Prototype Hunter | Laser Pistol ×2 (₡114,000) | Volt Sabre ×2 (₡850,000) |
| 3 Military Tank | Training Rifle (₡50,000) | Plasma Cannon (₡408,000) |
| 4 Military Harvester | Training Beam (₡50,000) | Ion Beam (₡544,000) |
| 5 FNIX Runner 05 | Beam Pistol (₡93,000) | Particle Lance (₡425,000) |
| 6 FNIX Runner 06 | Laser Pistol + Light Shield (₡108,000) | Volt Sabre + Aegis Bulwark (₡834,000) |
| 7 FNIX Runner 07 | Bolt Carbine (₡93,000) | Nova Caster (₡425,000) |
| 8 FNIX Runner 08 | Scatter Cannon (₡84,000) | Arc Projector (₡488,000) |
| 9 FNIX Runner 09 | Combat Knife ×2 (₡186,000) | Vibro Mace ×2 (₡850,000) |
| 10 FNIX Runner 10 | Training Rifle (₡50,000) | Plasma Cannon (₡408,000) |
| 11 FNIX Runner 11 | Training Beam (₡50,000) | Ion Beam (₡544,000) |

**Refinement plans** (generated; applied by Swarm goal 23, Refine → 8 steps per robot). All 11 robots: 70 steps, ₡38,110,000; the 11 robots at the target: ₡38,110,000; Refine → 8 applies ₡37,450,000 of the target robots' plans.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Military Runner (5 steps, ₡2,960,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Power Core +4 (−3 → 1) ₡160,000 | ₡2,960,000 |
| Prototype Hunter (10 steps, ₡5,920,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 · 9 Hone Power Core +4 (−3 → 1) ₡160,000 | ₡2,960,000 |
|  | Volt Sabre (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 · 10 Hone Power Core +4 (−3 → 1) ₡160,000 | ₡2,960,000 |
| Military Tank (5 steps, ₡2,820,000) | Plasma Cannon (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Armor Plating +1 (new) ₡20,000 | ₡2,820,000 |
| Military Harvester (5 steps, ₡2,820,000) | Ion Beam (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Combat Algorithms +1 (new) ₡20,000 | ₡2,820,000 |
| FNIX Runner 05 (5 steps, ₡2,960,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +4 (5 → 9) ₡160,000 | ₡2,960,000 |
| FNIX Runner 06 (10 steps, ₡2,870,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Armor Plating +1 (new) ₡20,000 | ₡2,820,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |
| FNIX Runner 07 (5 steps, ₡2,960,000) | Nova Caster (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| FNIX Runner 08 (5 steps, ₡2,960,000) | Arc Projector (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| FNIX Runner 09 (10 steps, ₡5,920,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 · 9 Hone Gyro Stabilizers +4 (4 → 8) ₡160,000 | ₡2,960,000 |
|  | Vibro Mace (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 · 10 Hone Gyro Stabilizers +4 (4 → 8) ₡160,000 | ₡2,960,000 |
| FNIX Runner 10 (5 steps, ₡2,960,000) | Plasma Cannon (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Critical Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| FNIX Runner 11 (5 steps, ₡2,960,000) | Ion Beam (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (4 → 8) ₡160,000 | ₡2,960,000 |

Storage (estimate; the engine counts at run time): 14 final weapons equipped at the robots target of 11. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need Storage Facility L2; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A04 ×1 (decision 4).

Source findings before decisions: A03 ×2, A04 ×1, A13 ×11, V13 ×11.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 28. Facility 3826 Robotics (`facility-3826-robotics`) — Generalist

| Field | Value |
|---|---|
| Stable name | Facility 3826 Robotics |
| Franchise label | Atomic Heart |
| Backstory | Facility 3826 Robotics enters the arena with a clear doctrine. Different machine classes receive different build focuses. Every surviving machine returns to the workshop before the next booking. |
| Strategy | Generalist |
| Target overrides | goal 14 Robots → 3 (strategy default 2, allowed 2–4) |
| Team names | 2v2: **Polymer Workshop** (robots 1+2) · 3v3: **Kollektiv 2.0** (1–3) |
| Event order | `league_1v1`, `league_2v2`, `league_3v3`, `tag_team`, `koth`, `grand_melee`, `tournament_1v1`, `tournament_2v2`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- 2v2 team 1+2: '3826 Pair 01' → 'Polymer Workshop' (decisions 3, 18; delegated authoring)
- 3v3 team 1+2+3: '3826 Squad 01' → 'Kollektiv 2.0' (decisions 3, 18; delegated authoring)
- Slot 1 robot name: 'VOV-A Worker 01' → 'VOV-A6 Lab Tech' (decisions 3, 18; delegated authoring)
- Slot 1 art brief: 'White enamel VOV-A worker robot, chrome joints and a recognizable humanlike face.' → 'Visibly synthetic white-enamel humanoid, painted moustache faceplate, red star chest badge, open hands' (decisions 3, 18; delegated authoring)
- Slot 1 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 2 robot name: 'Facility 3826 Heavy 02' → 'MA-9 Belyash' (decisions 3, 18; delegated authoring)
- Slot 2 art brief: 'Arena-designated heavy Soviet retro-futurist combat robot, white enamel and red accents.' → 'Hulking white-and-red enamel robot, red star belly, single red porthole optic, rotary cannon braced in both hands' (decisions 3, 18; delegated authoring)
- Slot 2 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 3 robot name: 'Facility 3826 Scout 03' → 'Vovchik' (decisions 3, 18; delegated authoring)
- Slot 3 art brief: 'Arena-designated small mobile robot with rounded white casing and exposed chrome limbs.' → 'Round white egg-headed robot, red star on its dome, orange eyes, red cylinder gun arm and a pincer claw' (decisions 3, 18; delegated authoring)
- Slot 3 portrait: aligned (decisions 3, 18; delegated authoring)

Every blueprint is used at the robots target of 3; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | VOV-A6 Lab Tech | `single` | melee | balanced | 15 | Versatile | Visibly synthetic white-enamel humanoid, painted moustache faceplate, red star chest badge, open hands | `facility-3826-robotics/1.webp` |
| 2 | MA-9 Belyash | `two_handed` | mid | defensive | 5 | Warden | Hulking white-and-red enamel robot, red star belly, single red porthole optic, rotary cannon braced in both hands | `facility-3826-robotics/2.webp` |
| 3 | Vovchik | `single` | short | balanced | 20 | Sprinter | Round white egg-headed robot, red star on its dome, orange eyes, red cylinder gun arm and a pincer claw | `facility-3826-robotics/3.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 VOV-A6 Lab Tech | Practice Sword (₡50,000) | Vibro Mace (₡425,000) |
| 2 MA-9 Belyash | Training Rifle (₡50,000) | Plasma Cannon (₡408,000) |
| 3 Vovchik | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |

**Refinement plans** (generated; applied by Generalist goal 18, Refine → 10 steps per robot). All 3 robots: 15 steps, ₡8,490,000; the 3 robots at the target: ₡8,490,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| VOV-A6 Lab Tech (5 steps, ₡2,840,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +2 (6 → 8) ₡40,000 | ₡2,840,000 |
| MA-9 Belyash (5 steps, ₡2,810,000) | Plasma Cannon (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (7 → 8) ₡10,000 | ₡2,810,000 |
| Vovchik (5 steps, ₡2,840,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Power Core +2 (−3 → −1) ₡40,000 | ₡2,840,000 |

Storage (estimate; the engine counts at run time): 3 final weapons equipped at the robots target of 3. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5), A04 ×1 (decision 4).

Source findings before decisions: A01 ×1, A03 ×2, A04 ×1, A09 ×1, A11 ×1, A13 ×3, V08 ×1, V13 ×3.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 29. IRTA Synthetic Response (`irta-synthetic-response`) — Paragon

| Field | Value |
|---|---|
| Stable name | IRTA Synthetic Response |
| Franchise label | Binary Domain |
| Backstory | IRTA Synthetic Response enters the arena with a clear doctrine. A precise mobile fighter with focused refinement. Every surviving machine returns to the workshop before the next booking. |
| Strategy | Paragon |
| Target overrides | none (goal 8 Robots → 1, the strategy default) |
| Team names | 2v2: none · 3v3: none |
| Event order | `league_1v1`, `tournament_1v1`, `koth`, `grand_melee`, `league_2v2`, `tag_team`, `tournament_2v2`, `league_3v3`, `tournament_3v3` |

**Changes from your draft**: none.

Every blueprint is used at the robots target of 1; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Cain CN-7 | `single` | long | balanced | 10 | Deadeye | Slim tactical combat robot with a mechanical face, dark limbs and precision firearm. | `irta-synthetic-response/1.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Cain CN-7 | Gauss Pistol (₡291,000) | Particle Lance (₡425,000) |

**Refinement plans** (generated; applied by Paragon goal 16, Refine → 10 steps per robot). The only blueprint: 4 steps, ₡2,800,000; the robot at the target: ₡2,800,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Cain CN-7 (4 steps, ₡2,800,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 | ₡2,800,000 |

Storage (estimate; the engine counts at run time): 1 final weapons equipped at the robots target of 1. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5), A04 ×1 (decision 4).

Source findings before decisions: A01 ×1, A04 ×1, A11 ×1, V13 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 30. Droid Rebellion Workshop (`droid-rebellion-workshop`) — Paragon

| Field | Value |
|---|---|
| Stable name | Droid Rebellion Workshop |
| Franchise label | Metal Arms |
| Backstory | Droid Rebellion Workshop enters the arena with a clear doctrine. A compact ranged combatant that becomes better equipped. Every surviving machine returns to the workshop before the next booking. |
| Strategy | Paragon |
| Target overrides | none (goal 8 Robots → 1, the strategy default) |
| Team names | 2v2: none · 3v3: none |
| Event order | `league_1v1`, `tournament_1v1`, `koth`, `grand_melee`, `league_2v2`, `tag_team`, `tournament_2v2`, `league_3v3`, `tournament_3v3` |

**Changes from your draft**: none.

Every blueprint is used at the robots target of 1; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Glitch | `single` | mid | offensive | 10 | Versatile | Compact combat droid with yellow-green panels, visible bolts and an oversized weapon. | `droid-rebellion-workshop/1.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Glitch | Disruptor Cannon (₡293,000) | Nova Caster (₡425,000) |

**Refinement plans** (generated; applied by Paragon goal 16, Refine → 10 steps per robot). The only blueprint: 4 steps, ₡2,800,000; the robot at the target: ₡2,800,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Glitch (4 steps, ₡2,800,000) | Nova Caster (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 | ₡2,800,000 |

Storage (estimate; the engine counts at run time): 1 final weapons equipped at the robots target of 1. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5), A04 ×1 (decision 4).

Source findings before decisions: A01 ×1, A04 ×1, A11 ×1, V13 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 31. Galactic Robot Workshop (`galactic-robot-workshop`) — Generalist

| Field | Value |
|---|---|
| Stable name | Galactic Robot Workshop |
| Franchise label | Ratchet & Clank |
| Backstory | Galactic Robot Workshop enters the arena with a clear doctrine. Small tactician, heavier specialist, aggressive ranged fighter. Every surviving machine returns to the workshop before the next booking. |
| Strategy | Generalist |
| Target overrides | goal 14 Robots → 3 (strategy default 2, allowed 2–4) |
| Team names | 2v2: **Great Clock Custodians** (robots 1+2) · 3v3: **Q-Force** (1–3) |
| Event order | `league_1v1`, `league_2v2`, `league_3v3`, `tag_team`, `koth`, `grand_melee`, `tournament_1v1`, `tournament_2v2`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- 2v2 team 1+2: 'Galactic Pair 01' → 'Great Clock Custodians' (decision 3; delegated authoring)
- 3v3 team 1+2+3: 'Galactic Squad 01' → 'Q-Force' (decision 3; delegated authoring)

Every blueprint is used at the robots target of 3; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Clank | `weapon_shield` | short | defensive | 30 | Tactician | Small silver robot with green optics, square limbs and a modest service chassis. | `galactic-robot-workshop/1.webp` |
| 2 | Dr. Nefarious | `single` | long | offensive | 20 | Deadeye | Tall angular villain robot with exposed head machinery, thin limbs and dark metal. | `galactic-robot-workshop/2.webp` |
| 3 | Mr. Zurkon | `dual_wield` | short | offensive | 0 | Bruiser | Compact aggressive hovering combat robot with a mechanical face and paired emitters. | `galactic-robot-workshop/3.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Clank | Laser Pistol + Light Shield (₡108,000) | Volt Sabre + Aegis Bulwark (₡834,000) |
| 2 Dr. Nefarious | Beam Pistol (₡93,000) | Particle Lance (₡425,000) |
| 3 Mr. Zurkon | Laser Pistol ×2 (₡114,000) | Volt Sabre ×2 (₡850,000) |

**Refinement plans** (generated; applied by Generalist goal 18, Refine → 10 steps per robot). All 3 robots: 25 steps, ₡11,380,000; the 3 robots at the target: ₡11,380,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Clank (10 steps, ₡2,860,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (8 → 9) ₡10,000 | ₡2,810,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |
| Dr. Nefarious (5 steps, ₡2,840,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +2 (5 → 7) ₡40,000 | ₡2,840,000 |
| Mr. Zurkon (10 steps, ₡5,680,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 · 9 Hone Combat Power +2 (8 → 10) ₡40,000 | ₡2,840,000 |
|  | Volt Sabre (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 · 10 Hone Combat Power +2 (8 → 10) ₡40,000 | ₡2,840,000 |

Storage (estimate; the engine counts at run time): 5 final weapons equipped at the robots target of 3. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5), A04 ×1 (decision 4).

Source findings before decisions: A01 ×1, A03 ×1, A04 ×1, A11 ×1, V08 ×1, V13 ×3.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 32. Astro Rescue Hangar (`astro-rescue-hangar`) — Paragon

| Field | Value |
|---|---|
| Stable name | Astro Rescue Hangar |
| Franchise label | Astro Bot |
| Backstory | Astro Rescue Hangar enters the arena with a clear doctrine. An evasive, compact flagship with focused upgrades. Every surviving machine returns to the workshop before the next booking. |
| Strategy | Paragon |
| Target overrides | none (goal 8 Robots → 1, the strategy default) |
| Team names | 2v2: none · 3v3: none |
| Event order | `league_1v1`, `tournament_1v1`, `koth`, `grand_melee`, `league_2v2`, `tag_team`, `tournament_2v2`, `league_3v3`, `tournament_3v3` |

**Changes from your draft**: none.

Every blueprint is used at the robots target of 1; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Astro | `single` | short | offensive | 20 | Sprinter | Compact white rescue robot with blue face screen, dark flexible joints and rounded feet. | `astro-rescue-hangar/1.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Astro | Plasma Rifle (₡258,000) | Volt Sabre (₡425,000) |

**Refinement plans** (generated; applied by Paragon goal 16, Refine → 10 steps per robot). The only blueprint: 4 steps, ₡2,800,000; the robot at the target: ₡2,800,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Astro (4 steps, ₡2,800,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 | ₡2,800,000 |

Storage (estimate; the engine counts at run time): 1 final weapons equipped at the robots target of 1. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5), A04 ×1 (decision 4).

Source findings before decisions: A01 ×1, A04 ×1, A11 ×1, V13 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 33. Machinarium Repair Yard (`machinarium-repair-yard`) — Paragon

| Field | Value |
|---|---|
| Stable name | Machinarium Repair Yard |
| Franchise label | Machinarium |
| Backstory | Machinarium Repair Yard enters the arena with a clear doctrine. Tactical survival and gradual investment in one salvaged robot. Every surviving machine returns to the workshop before the next booking. |
| Strategy | Paragon |
| Target overrides | none (goal 8 Robots → 1, the strategy default) |
| Team names | 2v2: none · 3v3: none |
| Event order | `league_1v1`, `tournament_1v1`, `koth`, `grand_melee`, `league_2v2`, `tag_team`, `tournament_2v2`, `league_3v3`, `tournament_3v3` |

**Changes from your draft**: none.

Every blueprint is used at the robots target of 1; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Josef | `weapon_shield` | short | defensive | 30 | Tactician | Small tarnished cylindrical robot with a telescoping torso and mismatched repairs. | `machinarium-repair-yard/1.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Josef | Plasma Rifle + Light Shield (₡309,000) | Volt Sabre + Aegis Bulwark (₡834,000) |

**Refinement plans** (generated; applied by Paragon goal 16, Refine → 10 steps per robot). The only blueprint: 4 steps, ₡2,800,000; the robot at the target: ₡2,800,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Josef (4 steps, ₡2,800,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 | ₡2,800,000 |
|  | Aegis Bulwark (offhand) | no step (allowed: shields need no step) | ₡0 |

Storage (estimate; the engine counts at run time): 2 final weapons equipped at the robots target of 1. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5), A04 ×1 (decision 4).

Source findings before decisions: A01 ×1, A04 ×1, A11 ×1, V13 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 34. B12 Companion Workshop (`b12-companion-workshop`) — Paragon

| Field | Value |
|---|---|
| Stable name | B12 Companion Workshop |
| Franchise label | Stray |
| Backstory | B12 Companion Workshop enters the arena with a clear doctrine. A very small precision-oriented machine. Every surviving machine returns to the workshop before the next booking. |
| Strategy | Paragon |
| Target overrides | none (goal 8 Robots → 1, the strategy default) |
| Team names | 2v2: none · 3v3: none |
| Event order | `league_1v1`, `tournament_1v1`, `koth`, `grand_melee`, `league_2v2`, `tag_team`, `tournament_2v2`, `league_3v3`, `tournament_3v3` |

**Changes from your draft**: none.

Every blueprint is used at the robots target of 1; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | B-12 | `single` | long | defensive | 35 | Tactician | Small rectangular companion drone with a bright central lens and compact side panels. | `b12-companion-workshop/1.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 B-12 | Gauss Pistol (₡291,000) | Particle Lance (₡425,000) |

**Refinement plans** (generated; applied by Paragon goal 16, Refine → 10 steps per robot). The only blueprint: 4 steps, ₡2,800,000; the robot at the target: ₡2,800,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| B-12 (4 steps, ₡2,800,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 | ₡2,800,000 |

Storage (estimate; the engine counts at run time): 1 final weapons equipped at the robots target of 1. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5), A04 ×1 (decision 4).

Source findings before decisions: A01 ×1, A04 ×1, A11 ×1, V13 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 35. New Jerusalem Foundry (`new-jerusalem-foundry`) — Paragon

| Field | Value |
|---|---|
| Stable name | New Jerusalem Foundry |
| Franchise label | The Talos Principle |
| Backstory | New Jerusalem Foundry enters the arena with a clear doctrine. A calm tactical build with steady refinement. Every surviving machine returns to the workshop before the next booking. |
| Strategy | Paragon |
| Target overrides | none (goal 8 Robots → 1, the strategy default) |
| Team names | 2v2: none · 3v3: none |
| Event order | `league_1v1`, `tournament_1v1`, `koth`, `grand_melee`, `league_2v2`, `tag_team`, `tournament_2v2`, `league_3v3`, `tournament_3v3` |

**Changes from your draft**: none.

Every blueprint is used at the robots target of 1; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | 1k | `weapon_shield` | mid | defensive | 20 | Tactician | New Jerusalem humanoid android with clean manufactured limbs and exposed metal anatomy. | `new-jerusalem-foundry/1.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 1k | Disruptor Cannon + Combat Shield (₡371,000) | Nova Caster + Aegis Bulwark (₡834,000) |

**Refinement plans** (generated; applied by Paragon goal 16, Refine → 10 steps per robot). The only blueprint: 4 steps, ₡2,800,000; the robot at the target: ₡2,800,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| 1k (4 steps, ₡2,800,000) | Nova Caster (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 | ₡2,800,000 |
|  | Aegis Bulwark (offhand) | no step (allowed: shields need no step) | ₡0 |

Storage (estimate; the engine counts at run time): 2 final weapons equipped at the robots target of 1. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5), A04 ×1 (decision 4).

Source findings before decisions: A01 ×1, A04 ×1, A11 ×1, V13 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 36. V Model Combat Lab (`v-model-combat-lab`) — Duo

| Field | Value |
|---|---|
| Stable name | V Model Combat Lab |
| Franchise label | ULTRAKILL |
| Backstory | V Model Combat Lab enters the arena with a clear doctrine. Two highly mobile combat builds with contrasting equipment. Every surviving machine returns to the workshop before the next booking. |
| Strategy | Duo |
| Target overrides | none (goal 13 Robots → 2, the strategy default) |
| Team names | 2v2: **The Cyber Grind** (robots 1+2) · 3v3: none |
| Event order | `tag_team`, `league_2v2`, `tournament_2v2`, `league_1v1`, `koth`, `grand_melee`, `tournament_1v1`, `league_3v3`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- 2v2 team 1+2: 'V Model Pair 01' → 'The Cyber Grind' (decision 3; delegated authoring)

Every blueprint is used at the robots target of 2; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | V1 | `dual_wield` | short | offensive | 0 | Sprinter | Angular blue camera-headed combat machine with narrow limbs and back-mounted plates. | `v-model-combat-lab/1.webp` |
| 2 | V2 | `dual_wield` | melee | offensive | 0 | Sprinter | Angular red camera-headed combat machine with a reinforced mechanical arm. | `v-model-combat-lab/2.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 V1 | Laser Pistol ×2 (₡114,000) | Volt Sabre ×2 (₡850,000) |
| 2 V2 | Combat Knife ×2 (₡186,000) | Vibro Mace ×2 (₡850,000) |

**Refinement plans** (generated; applied by Duo goal 17, Refine → 10 steps per robot). All 2 robots: 20 steps, ₡11,240,000; the 2 robots at the target: ₡11,240,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| V1 (10 steps, ₡5,620,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 · 9 Hone Power Core +1 (−3 → −2) ₡10,000 | ₡2,810,000 |
|  | Volt Sabre (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 · 10 Hone Power Core +1 (−3 → −2) ₡10,000 | ₡2,810,000 |
| V2 (10 steps, ₡5,620,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 · 9 Hone Gyro Stabilizers +1 (4 → 5) ₡10,000 | ₡2,810,000 |
|  | Vibro Mace (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 · 10 Hone Gyro Stabilizers +1 (4 → 5) ₡10,000 | ₡2,810,000 |

Storage (estimate; the engine counts at run time): 4 final weapons equipped at the robots target of 2. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5), A04 ×1 (decision 4).

Source findings before decisions: A01 ×1, A03 ×1, A04 ×1, A11 ×1, V13 ×3.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 37. Guardian Reboot Camp (`guardian-reboot-camp`) — Duo

| Field | Value |
|---|---|
| Stable name | Guardian Reboot Camp |
| Franchise label | Roboquest |
| Backstory | Guardian Reboot Camp enters the arena with a clear doctrine. A pair of mobile shooters that upgrade together. Every surviving machine returns to the workshop before the next booking. |
| Strategy | Duo |
| Target overrides | none (goal 13 Robots → 2, the strategy default) |
| Team names | 2v2: **Kenzie's Guardians** (robots 1+2) · 3v3: none |
| Event order | `league_2v2`, `tag_team`, `tournament_2v2`, `league_1v1`, `koth`, `grand_melee`, `tournament_1v1`, `league_3v3`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- 2v2 team 1+2: 'Guardian Pair 01' → "Kenzie's Guardians" (decision 3; delegated authoring)

Every blueprint is used at the robots target of 2; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Guardian | `dual_wield` | short | offensive | 10 | Versatile | Orange-yellow rebooted Guardian robot with compact armour and a large faceplate. | `guardian-reboot-camp/1.webp` |
| 2 | Guardian Cobalt | `weapon_shield` | short | defensive | 20 | Warden | Second arena Guardian chassis with cobalt panels and a defensive equipment layout. | `guardian-reboot-camp/2.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Guardian | Laser Pistol ×2 (₡114,000) | Volt Sabre ×2 (₡850,000) |
| 2 Guardian Cobalt | Laser Pistol + Light Shield (₡108,000) | Volt Sabre + Aegis Bulwark (₡834,000) |

**Refinement plans** (generated; applied by Duo goal 17, Refine → 10 steps per robot). All 2 robots: 20 steps, ₡8,480,000; the 2 robots at the target: ₡8,480,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Guardian (10 steps, ₡5,620,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 · 9 Hone Combat Power +1 (8 → 9) ₡10,000 | ₡2,810,000 |
|  | Volt Sabre (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 · 10 Hone Combat Power +1 (8 → 9) ₡10,000 | ₡2,810,000 |
| Guardian Cobalt (10 steps, ₡2,860,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (8 → 9) ₡10,000 | ₡2,810,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |

Storage (estimate; the engine counts at run time): 4 final weapons equipped at the robots target of 2. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5), A04 ×1 (decision 4).

Source findings before decisions: A01 ×1, A03 ×1, A04 ×1, A11 ×1, V13 ×3.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 38. Rift Walker Hangar (`rift-walker-hangar`) — Trio

| Field | Value |
|---|---|
| Stable name | Rift Walker Hangar |
| Franchise label | Into the Breach |
| Backstory | Rift Walker Hangar enters the arena with a clear doctrine. Complementary melee, ranged, and heavy builds. Every surviving machine returns to the workshop before the next booking. |
| Strategy | Trio |
| Target overrides | none (goal 12 Robots → 3, the strategy default) |
| Team names | 2v2: **Archive Inc. Guard** (robots 1+2) · 3v3: **Rift Walkers** (1–3) |
| Event order | `league_3v3`, `tournament_3v3`, `league_1v1`, `league_2v2`, `tag_team`, `koth`, `grand_melee`, `tournament_2v2`, `tournament_1v1` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- 2v2 team 1+2: 'Rift Walker Pair 01' → 'Archive Inc. Guard' (decision 3; delegated authoring)
- 3v3 team 1+2+3: 'Rift Walker Squad 01' → 'Rift Walkers' (decision 3; delegated authoring)

Every blueprint is used at the robots target of 3; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Combat Mech | `two_handed` | melee | balanced | 10 | Bruiser | Compact olive combat mech with a central cockpit and articulated striking arms. | `rift-walker-hangar/1.webp` |
| 2 | Cannon Mech | `single` | mid | balanced | 10 | Deadeye | Compact military mech with a broad ranged cannon and sturdy support legs. | `rift-walker-hangar/2.webp` |
| 3 | Artillery Mech | `two_handed` | long | defensive | 15 | Tactician | Compact artillery mech with a long launcher assembly and stable mechanical stance. | `rift-walker-hangar/3.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Combat Mech | War Club (₡84,000) | Heavy Hammer (₡478,000) |
| 2 Cannon Mech | Bolt Carbine (₡93,000) | Nova Caster (₡425,000) |
| 3 Artillery Mech | Training Beam (₡50,000) | Ion Beam (₡544,000) |

**Refinement plans** (generated; applied by Trio goal 22, Refine → 10 steps per robot). All 3 robots: 15 steps, ₡8,430,000; the 3 robots at the target: ₡8,430,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Combat Mech (5 steps, ₡2,810,000) | Heavy Hammer (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (7 → 8) ₡10,000 | ₡2,810,000 |
| Cannon Mech (5 steps, ₡2,810,000) | Nova Caster (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (8 → 9) ₡10,000 | ₡2,810,000 |
| Artillery Mech (5 steps, ₡2,810,000) | Ion Beam (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (8 → 9) ₡10,000 | ₡2,810,000 |

Storage (estimate; the engine counts at run time): 3 final weapons equipped at the robots target of 3. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5), A04 ×1 (decision 4).

Source findings before decisions: A01 ×1, A03 ×1, A04 ×1, A11 ×1, V13 ×3.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 39. Forerunner Sentinel Array (`forerunner-sentinel-array`) — Swarm

| Field | Value |
|---|---|
| Stable name | Forerunner Sentinel Array |
| Franchise label | Halo |
| Backstory | Forerunner Sentinel Array enters the arena with a clear doctrine. Numerous precision-oriented machine platforms. Every surviving machine returns to the workshop before the next booking. |
| Strategy | Swarm |
| Target overrides | none (goal 10 Robots → 11, the strategy default) |
| Team names | 2v2: **Guilty Spark's Escort** (robots 1+2), **Library Wardens** (3+4), **Didact's Vanguard** (5+6), **Genesis Caretakers** (7+8), **Installation 04** (9+10) · 3v3: **Flood Containment** (1–3), **Warden Eternal's Host** (4–6), **Requiem Guard** (7–9) |
| Event order | `league_1v1`, `league_3v3`, `league_2v2`, `grand_melee`, `koth`, `tag_team`, `tournament_3v3`, `tournament_2v2`, `tournament_1v1` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- 2v2 team 1+2: 'Forerunner Pair 01' → "Guilty Spark's Escort" (decisions 3, 18; delegated authoring)
- 2v2 team 3+4: 'Forerunner Pair 02' → 'Library Wardens' (decisions 3, 18; delegated authoring)
- 2v2 team 5+6: 'Forerunner Pair 03' → "Didact's Vanguard" (decisions 3, 18; delegated authoring)
- 2v2 team 7+8: 'Forerunner Pair 04' → 'Genesis Caretakers' (decisions 3, 18; delegated authoring)
- 2v2 team 9+10: 'Forerunner Pair 05' → 'Installation 04' (decisions 3, 18; delegated authoring)
- 3v3 team 1+2+3: 'Forerunner Squad 01' → 'Flood Containment' (decisions 3, 18; delegated authoring)
- 3v3 team 4+5+6: 'Forerunner Squad 02' → "Warden Eternal's Host" (decisions 3, 18; delegated authoring)
- 3v3 team 7+8+9: 'Forerunner Squad 03' → 'Requiem Guard' (decisions 3, 18; delegated authoring)
- Slot 1 robot name: 'Sentinel Aggressor 01' → 'Aggressor Sentinel' (decisions 3, 18; delegated authoring)
- Slot 1 art brief: 'Silver geometric Forerunner Sentinel with suspended mechanical parts and bright optic.' → 'Silver geometric Aggressor, bright blue optic core, two blue-lit blade wings, beam emitter below' (decisions 3, 18; delegated authoring)
- Slot 1 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 2 robot name: 'Sentinel Defender 02' → 'Protector Sentinel' (decisions 3, 18; delegated authoring)
- Slot 2 art brief: 'Arena-designated Forerunner Sentinel with blue optic and shield-like equipment.' → 'Silver geometric Sentinel, blue optic core, angled wing blades, blue hard-light shield on one wing' (decisions 3, 18; delegated authoring)
- Slot 2 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 3 robot name: 'Sentinel Enforcer 03' → 'Sentinel Enforcer' (decisions 3, 18; delegated authoring)
- Slot 3 art brief: 'Broad Forerunner Enforcer with armoured frontal structure and heavy emitter pods.' → 'Hulking hovering Enforcer, armoured stone-grey hull, blue light seams, two pincer claws hanging below' (decisions 3, 18; delegated authoring)
- Slot 3 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 4 robot name: 'Sentinel 04' → 'Aggressor 04' (decisions 3, 18; delegated authoring)
- Slot 4 art brief: 'Silver geometric Forerunner Sentinel with suspended mechanical parts and bright optic. Arena unit 04 uses a distinct role-specific equipment silhouette.' → 'Cracked silver Aggressor in level flight, blue optic flaring, wings swept out wide' (decisions 3, 18; delegated authoring)
- Slot 4 'Aggressor 04': numbered name accepted as a mass-produced designation (decisions 3, 18; delegated authoring)
- Slot 4 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 5 robot name: 'Sentinel 05' → 'Aggressor 05' (decisions 3, 18; delegated authoring)
- Slot 5 art brief: 'Silver geometric Forerunner Sentinel with suspended mechanical parts and bright optic. Arena unit 05 uses a distinct role-specific equipment silhouette.' → 'Silver Aggressor with a cleaner hull, steady blue optic, wing blades tilted up' (decisions 3, 18; delegated authoring)
- Slot 5 'Aggressor 05': numbered name accepted as a mass-produced designation (decisions 3, 18; delegated authoring)
- Slot 5 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 6 robot name: 'Sentinel 06' → 'Aggressor 06' (decisions 3, 18; delegated authoring)
- Slot 6 art brief: 'Silver geometric Forerunner Sentinel with suspended mechanical parts and bright optic. Arena unit 06 uses a distinct role-specific equipment silhouette.' → 'Weathered silver Aggressor, cracked plating, pale blue optic, wings angled forward' (decisions 3, 18; delegated authoring)
- Slot 6 'Aggressor 06': numbered name accepted as a mass-produced designation (decisions 3, 18; delegated authoring)
- Slot 6 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 7 robot name: 'Sentinel 07' → 'Aggressor 07' (decisions 3, 18; delegated authoring)
- Slot 7 art brief: 'Silver geometric Forerunner Sentinel with suspended mechanical parts and bright optic. Arena unit 07 uses a distinct role-specific equipment silhouette.' → 'Silver Aggressor with heavy hull cracks, bright blue optic, wide-set blade wings' (decisions 3, 18; delegated authoring)
- Slot 7 'Aggressor 07': numbered name accepted as a mass-produced designation (decisions 3, 18; delegated authoring)
- Slot 7 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 8 robot name: 'Sentinel 08' → 'Aggressor 08' (decisions 3, 18; delegated authoring)
- Slot 8 art brief: 'Silver geometric Forerunner Sentinel with suspended mechanical parts and bright optic. Arena unit 08 uses a distinct role-specific equipment silhouette.' → 'Dark-trimmed silver Aggressor, blue optic, tall upright wing blades with blue seams' (decisions 3, 18; delegated authoring)
- Slot 8 'Aggressor 08': numbered name accepted as a mass-produced designation (decisions 3, 18; delegated authoring)
- Slot 8 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 9 robot name: 'Sentinel 09' → 'Aggressor 09' (decisions 3, 18; delegated authoring)
- Slot 9 art brief: 'Silver geometric Forerunner Sentinel with suspended mechanical parts and bright optic. Arena unit 09 uses a distinct role-specific equipment silhouette.' → 'Silver Aggressor banking sideways, blue optic core, wings at uneven heights' (decisions 3, 18; delegated authoring)
- Slot 9 'Aggressor 09': numbered name accepted as a mass-produced designation (decisions 3, 18; delegated authoring)
- Slot 9 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 10 robot name: 'Sentinel 10' → 'Aggressor 10' (decisions 3, 18; delegated authoring)
- Slot 10 art brief: 'Silver geometric Forerunner Sentinel with suspended mechanical parts and bright optic. Arena unit 10 uses a distinct role-specific equipment silhouette.' → 'Silver Aggressor in a steep bank, blue optic, one wing raised high' (decisions 3, 18; delegated authoring)
- Slot 10 'Aggressor 10': numbered name accepted as a mass-produced designation (decisions 3, 18; delegated authoring)
- Slot 10 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 11 robot name: 'Sentinel 11' → 'Aggressor 11' (decisions 3, 18; delegated authoring)
- Slot 11 art brief: 'Silver geometric Forerunner Sentinel with suspended mechanical parts and bright optic. Arena unit 11 uses a distinct role-specific equipment silhouette.' → 'Silver Aggressor with ring ports on both wing blades, blue optic core' (decisions 3, 18; delegated authoring)
- Slot 11 'Aggressor 11': numbered name accepted as a mass-produced designation (decisions 3, 18; delegated authoring)
- Slot 11 portrait: aligned (decisions 3, 18; delegated authoring)

Every blueprint is used at the robots target of 11; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Aggressor Sentinel | `single` | short | offensive | 0 | Versatile | Silver geometric Aggressor, bright blue optic core, two blue-lit blade wings, beam emitter below | `forerunner-sentinel-array/1.webp` |
| 2 | Protector Sentinel | `weapon_shield` | short | defensive | 0 | Warden | Silver geometric Sentinel, blue optic core, angled wing blades, blue hard-light shield on one wing | `forerunner-sentinel-array/2.webp` |
| 3 | Sentinel Enforcer | `two_handed` | mid | defensive | 0 | Warden | Hulking hovering Enforcer, armoured stone-grey hull, blue light seams, two pincer claws hanging below | `forerunner-sentinel-array/3.webp` |
| 4 | Aggressor 04 | `single` | short | balanced | 0 | Versatile | Cracked silver Aggressor in level flight, blue optic flaring, wings swept out wide | `forerunner-sentinel-array/4.webp` |
| 5 | Aggressor 05 | `single` | long | balanced | 0 | Deadeye | Silver Aggressor with a cleaner hull, steady blue optic, wing blades tilted up | `forerunner-sentinel-array/5.webp` |
| 6 | Aggressor 06 | `weapon_shield` | short | defensive | 0 | Warden | Weathered silver Aggressor, cracked plating, pale blue optic, wings angled forward | `forerunner-sentinel-array/6.webp` |
| 7 | Aggressor 07 | `single` | mid | balanced | 0 | Deadeye | Silver Aggressor with heavy hull cracks, bright blue optic, wide-set blade wings | `forerunner-sentinel-array/7.webp` |
| 8 | Aggressor 08 | `two_handed` | short | offensive | 0 | Bruiser | Dark-trimmed silver Aggressor, blue optic, tall upright wing blades with blue seams | `forerunner-sentinel-array/8.webp` |
| 9 | Aggressor 09 | `dual_wield` | melee | offensive | 0 | Sprinter | Silver Aggressor banking sideways, blue optic core, wings at uneven heights | `forerunner-sentinel-array/9.webp` |
| 10 | Aggressor 10 | `two_handed` | mid | offensive | 0 | Bruiser | Silver Aggressor in a steep bank, blue optic, one wing raised high | `forerunner-sentinel-array/10.webp` |
| 11 | Aggressor 11 | `two_handed` | long | defensive | 0 | Deadeye | Silver Aggressor with ring ports on both wing blades, blue optic core | `forerunner-sentinel-array/11.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Aggressor Sentinel | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |
| 2 Protector Sentinel | Laser Pistol + Light Shield (₡108,000) | Volt Sabre + Aegis Bulwark (₡834,000) |
| 3 Sentinel Enforcer | Training Rifle (₡50,000) | Plasma Cannon (₡408,000) |
| 4 Aggressor 04 | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |
| 5 Aggressor 05 | Beam Pistol (₡93,000) | Particle Lance (₡425,000) |
| 6 Aggressor 06 | Laser Pistol + Light Shield (₡108,000) | Volt Sabre + Aegis Bulwark (₡834,000) |
| 7 Aggressor 07 | Bolt Carbine (₡93,000) | Nova Caster (₡425,000) |
| 8 Aggressor 08 | Scatter Cannon (₡84,000) | Arc Projector (₡488,000) |
| 9 Aggressor 09 | Combat Knife ×2 (₡186,000) | Vibro Mace ×2 (₡850,000) |
| 10 Aggressor 10 | Training Rifle (₡50,000) | Plasma Cannon (₡408,000) |
| 11 Aggressor 11 | Training Beam (₡50,000) | Ion Beam (₡544,000) |

**Refinement plans** (generated; applied by Swarm goal 23, Refine → 8 steps per robot). All 11 robots: 70 steps, ₡35,200,000; the 11 robots at the target: ₡35,200,000; Refine → 8 applies ₡34,840,000 of the target robots' plans.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Aggressor Sentinel (5 steps, ₡2,960,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| Protector Sentinel (10 steps, ₡2,870,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Armor Plating +1 (new) ₡20,000 | ₡2,820,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |
| Sentinel Enforcer (5 steps, ₡2,820,000) | Plasma Cannon (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Armor Plating +1 (new) ₡20,000 | ₡2,820,000 |
| Aggressor 04 (5 steps, ₡2,960,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| Aggressor 05 (5 steps, ₡2,960,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +4 (5 → 9) ₡160,000 | ₡2,960,000 |
| Aggressor 06 (10 steps, ₡2,870,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Armor Plating +1 (new) ₡20,000 | ₡2,820,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |
| Aggressor 07 (5 steps, ₡2,960,000) | Nova Caster (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| Aggressor 08 (5 steps, ₡2,960,000) | Arc Projector (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| Aggressor 09 (10 steps, ₡5,920,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 · 9 Hone Gyro Stabilizers +4 (4 → 8) ₡160,000 | ₡2,960,000 |
|  | Vibro Mace (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 · 10 Hone Gyro Stabilizers +4 (4 → 8) ₡160,000 | ₡2,960,000 |
| Aggressor 10 (5 steps, ₡2,960,000) | Plasma Cannon (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Critical Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| Aggressor 11 (5 steps, ₡2,960,000) | Ion Beam (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (4 → 8) ₡160,000 | ₡2,960,000 |

Storage (estimate; the engine counts at run time): 14 final weapons equipped at the robots target of 11. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need Storage Facility L2; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A04 ×1 (decision 4).

Source findings before decisions: A03 ×2, A04 ×1, A13 ×11, V03 ×8, V13 ×11.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 40. Last City Exo Foundry (`last-city-exo-foundry`) — Trio

| Field | Value |
|---|---|
| Stable name | Last City Exo Foundry |
| Franchise label | Destiny |
| Backstory | Last City Exo Foundry enters the arena with a clear doctrine. A mobile shooter, tactical specialist, durable veteran. Every surviving machine returns to the workshop before the next booking. |
| Strategy | Trio |
| Target overrides | none (goal 12 Robots → 3, the strategy default) |
| Team names | 2v2: **Black Armory** (robots 1+2) · 3v3: **Vanguard Tower** (1–3) |
| Event order | `league_3v3`, `tournament_3v3`, `league_1v1`, `league_2v2`, `tag_team`, `koth`, `grand_melee`, `tournament_2v2`, `tournament_1v1` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- 2v2 team 1+2: 'Exo Pair 01' → 'Black Armory' (decision 3; delegated authoring)
- 3v3 team 1+2+3: 'Exo Squad 01' → 'Vanguard Tower' (decision 3; delegated authoring)

Every blueprint is used at the robots target of 3; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Cayde-6 | `dual_wield` | short | offensive | 10 | Sprinter | Exo gunslinger with a blue mechanical face, orange horn-like details and worn cloak. | `last-city-exo-foundry/1.webp` |
| 2 | Ada-1 | `single` | long | balanced | 25 | Tactician | Pale mechanical Exo craftswoman with dark articulated body and refined metal detail. | `last-city-exo-foundry/2.webp` |
| 3 | Banshee-44 | `weapon_shield` | short | defensive | 20 | Warden | Broad veteran Exo with a blue mechanical face and weathered utility clothing. | `last-city-exo-foundry/3.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Cayde-6 | Laser Pistol ×2 (₡114,000) | Volt Sabre ×2 (₡850,000) |
| 2 Ada-1 | Beam Pistol (₡93,000) | Particle Lance (₡425,000) |
| 3 Banshee-44 | Laser Pistol + Light Shield (₡108,000) | Volt Sabre + Aegis Bulwark (₡834,000) |

**Refinement plans** (generated; applied by Trio goal 22, Refine → 10 steps per robot). All 3 robots: 25 steps, ₡11,290,000; the 3 robots at the target: ₡11,290,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Cayde-6 (10 steps, ₡5,620,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 · 9 Hone Power Core +1 (−3 → −2) ₡10,000 | ₡2,810,000 |
|  | Volt Sabre (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 · 10 Hone Power Core +1 (−3 → −2) ₡10,000 | ₡2,810,000 |
| Ada-1 (5 steps, ₡2,810,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (5 → 6) ₡10,000 | ₡2,810,000 |
| Banshee-44 (10 steps, ₡2,860,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (8 → 9) ₡10,000 | ₡2,810,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |

Storage (estimate; the engine counts at run time): 5 final weapons equipped at the robots target of 3. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5), A04 ×1 (decision 4).

Source findings before decisions: A01 ×1, A03 ×1, A04 ×1, A11 ×1, V13 ×3.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 41. Gray Mann Robot Works (`gray-mann-robot-works`) — Swarm

| Field | Value |
|---|---|
| Stable name | Gray Mann Robot Works |
| Franchise label | Team Fortress 2 |
| Backstory | Gray Mann Robot Works enters the arena with a clear doctrine. A wide roster with easily understood specializations. Every surviving machine returns to the workshop before the next booking. |
| Strategy | Swarm |
| Target overrides | none (goal 10 Robots → 11, the strategy default) |
| Team names | 2v2: **Coal Town Rush** (robots 1+2), **Gear Grinder** (3+4), **Mecha Engine** (5+6), **Steel Trap** (7+8), **Two Cities** (9+10) · 3v3: **Mannhattan Assault** (1–3), **Rottenburg Raid** (4–6), **Mannworks Siege** (7–9) |
| Event order | `league_3v3`, `league_2v2`, `grand_melee`, `koth`, `league_1v1`, `tag_team`, `tournament_3v3`, `tournament_2v2`, `tournament_1v1` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- 2v2 team 1+2: 'Gray Mann Pair 01' → 'Coal Town Rush' (decision 3; delegated authoring)
- 2v2 team 3+4: 'Gray Mann Pair 02' → 'Gear Grinder' (decision 3; delegated authoring)
- 2v2 team 5+6: 'Gray Mann Pair 03' → 'Mecha Engine' (decision 3; delegated authoring)
- 2v2 team 7+8: 'Gray Mann Pair 04' → 'Steel Trap' (decision 3; delegated authoring)
- 2v2 team 9+10: 'Gray Mann Pair 05' → 'Two Cities' (decision 3; delegated authoring)
- 3v3 team 1+2+3: 'Gray Mann Squad 01' → 'Mannhattan Assault' (decision 3; delegated authoring)
- 3v3 team 4+5+6: 'Gray Mann Squad 02' → 'Rottenburg Raid' (decision 3; delegated authoring)
- 3v3 team 7+8+9: 'Gray Mann Squad 03' → 'Mannworks Siege' (decision 3; delegated authoring)

Every blueprint is used at the robots target of 11; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Robot Scout | `single` | melee | offensive | 5 | Sprinter | Blue-grey fast class robot with a headset-inspired metal head and thin limbs. | `gray-mann-robot-works/1.webp` |
| 2 | Robot Soldier | `two_handed` | mid | offensive | 5 | Bruiser | Blue-grey military class robot with helmet-like head and rocket-launcher silhouette. | `gray-mann-robot-works/2.webp` |
| 3 | Robot Heavy | `two_handed` | short | offensive | 0 | Bruiser | Large blue-grey class robot with broad chest and heavy rotary-weapon silhouette. | `gray-mann-robot-works/3.webp` |
| 4 | Robot Pyro | `two_handed` | short | offensive | 0 | Bruiser | Masked blue-grey class robot with sealed optics and heat-emitter equipment. | `gray-mann-robot-works/4.webp` |
| 5 | Robot Demoman | `two_handed` | melee | balanced | 5 | Bruiser | Blue-grey class robot with an asymmetric mechanical face and heavy striking equipment. | `gray-mann-robot-works/5.webp` |
| 6 | Robot Engineer | `weapon_shield` | short | defensive | 15 | Tactician | Blue-grey industrial class robot with hard-hat-shaped head and practical tool limbs. | `gray-mann-robot-works/6.webp` |
| 7 | Robot Medic | `weapon_shield` | long | defensive | 20 | Tactician | Blue-grey service class robot with distinctive head detail and utility attachments. | `gray-mann-robot-works/7.webp` |
| 8 | Robot Sniper | `single` | long | balanced | 10 | Deadeye | Lean blue-grey class robot with hat-shaped head and a long precision rifle. | `gray-mann-robot-works/8.webp` |
| 9 | Robot Spy | `dual_wield` | melee | offensive | 20 | Sprinter | Slim blue-grey class robot with masked face styling and narrow blade-like tools. | `gray-mann-robot-works/9.webp` |
| 10 | Giant Robot Soldier | `two_handed` | long | defensive | 0 | Deadeye | Oversized blue-grey Soldier robot with reinforced torso and large launcher. | `gray-mann-robot-works/10.webp` |
| 11 | Giant Robot Heavy | `two_handed` | short | defensive | 0 | Warden | Oversized blue-grey Heavy robot with massive forearms and a rotary weapon. | `gray-mann-robot-works/11.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Robot Scout | Practice Sword (₡50,000) | Vibro Mace (₡425,000) |
| 2 Robot Soldier | Training Rifle (₡50,000) | Plasma Cannon (₡408,000) |
| 3 Robot Heavy | Scatter Cannon (₡84,000) | Arc Projector (₡488,000) |
| 4 Robot Pyro | Scatter Cannon (₡84,000) | Arc Projector (₡488,000) |
| 5 Robot Demoman | War Club (₡84,000) | Heavy Hammer (₡478,000) |
| 6 Robot Engineer | Laser Pistol + Light Shield (₡108,000) | Volt Sabre + Aegis Bulwark (₡834,000) |
| 7 Robot Medic | Beam Pistol + Combat Shield (₡171,000) | Particle Lance + Aegis Bulwark (₡834,000) |
| 8 Robot Sniper | Beam Pistol (₡93,000) | Particle Lance (₡425,000) |
| 9 Robot Spy | Combat Knife ×2 (₡186,000) | Vibro Mace ×2 (₡850,000) |
| 10 Giant Robot Soldier | Training Beam (₡50,000) | Ion Beam (₡544,000) |
| 11 Giant Robot Heavy | Scatter Cannon (₡84,000) | Arc Projector (₡488,000) |

**Refinement plans** (generated; applied by Swarm goal 23, Refine → 8 steps per robot). All 11 robots: 70 steps, ₡35,200,000; the 11 robots at the target: ₡35,200,000; Refine → 8 applies ₡34,840,000 of the target robots' plans.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Robot Scout (5 steps, ₡2,960,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Gyro Stabilizers +4 (4 → 8) ₡160,000 | ₡2,960,000 |
| Robot Soldier (5 steps, ₡2,960,000) | Plasma Cannon (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Critical Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| Robot Heavy (5 steps, ₡2,960,000) | Arc Projector (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| Robot Pyro (5 steps, ₡2,960,000) | Arc Projector (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| Robot Demoman (5 steps, ₡2,960,000) | Heavy Hammer (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Critical Systems +4 (4 → 8) ₡160,000 | ₡2,960,000 |
| Robot Engineer (10 steps, ₡2,870,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Combat Algorithms +1 (new) ₡20,000 | ₡2,820,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |
| Robot Medic (10 steps, ₡2,870,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Combat Algorithms +1 (new) ₡20,000 | ₡2,820,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |
| Robot Sniper (5 steps, ₡2,960,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +4 (5 → 9) ₡160,000 | ₡2,960,000 |
| Robot Spy (10 steps, ₡5,920,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 · 9 Hone Gyro Stabilizers +4 (4 → 8) ₡160,000 | ₡2,960,000 |
|  | Vibro Mace (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 · 10 Hone Gyro Stabilizers +4 (4 → 8) ₡160,000 | ₡2,960,000 |
| Giant Robot Soldier (5 steps, ₡2,960,000) | Ion Beam (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (4 → 8) ₡160,000 | ₡2,960,000 |
| Giant Robot Heavy (5 steps, ₡2,820,000) | Arc Projector (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Armor Plating +1 (new) ₡20,000 | ₡2,820,000 |

Storage (estimate; the engine counts at run time): 14 final weapons equipped at the robots target of 11. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need Storage Facility L2; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A04 ×1 (decision 4).

Source findings before decisions: A03 ×1, A04 ×1, V13 ×11.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 42. Fazbear Arena Entertainment (`fazbear-arena-entertainment`) — Tycoon

| Field | Value |
|---|---|
| Stable name | Fazbear Arena Entertainment |
| Franchise label | Five Nights at Freddy's |
| Backstory | Fazbear Arena Entertainment enters the arena with a clear doctrine. Merchandise and facility income fund a small animatronic roster. Every surviving machine returns to the workshop before the next booking. |
| Strategy | Tycoon |
| Target overrides | goal 20 Robots → 3 (strategy default 2, allowed 2–3) |
| Team names | 2v2: **Night Shift** (robots 1+2) · 3v3: **Freddy Fazbear's Pizza** (1–3) |
| Event order | `koth`, `grand_melee`, `league_1v1`, `league_2v2`, `tag_team`, `tournament_1v1`, `tournament_2v2`, `league_3v3`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- 2v2 team 1+2: 'Fazbear Pair 01' → 'Night Shift' (decision 3; delegated authoring)
- 3v3 team 1+2+3: 'Fazbear Squad 01' → "Freddy Fazbear's Pizza" (decision 3; delegated authoring)

Every blueprint is used at the robots target of 3; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Freddy Fazbear | `two_handed` | melee | balanced | 10 | Bruiser | Worn brown bear animatronic, top hat, visible joint seams and metal endoskeleton. | `fazbear-arena-entertainment/1.webp` |
| 2 | Bonnie | `dual_wield` | melee | offensive | 10 | Sprinter | Worn purple rabbit animatronic with long ears, segmented limbs and visible metal joints. | `fazbear-arena-entertainment/2.webp` |
| 3 | Chica | `weapon_shield` | short | defensive | 15 | Warden | Worn yellow bird animatronic with a broad head and protective arena equipment. | `fazbear-arena-entertainment/3.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Freddy Fazbear | War Club (₡84,000) | Heavy Hammer (₡478,000) |
| 2 Bonnie | Combat Knife ×2 (₡186,000) | Vibro Mace ×2 (₡850,000) |
| 3 Chica | Laser Pistol + Light Shield (₡108,000) | Volt Sabre + Aegis Bulwark (₡834,000) |

**Refinement plans** (generated; applied by Tycoon goal 25, Refine → 10 steps per robot). All 3 robots: 25 steps, ₡11,390,000; the 3 robots at the target: ₡11,390,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Freddy Fazbear (5 steps, ₡2,840,000) | Heavy Hammer (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +2 (7 → 9) ₡40,000 | ₡2,840,000 |
| Bonnie (10 steps, ₡5,680,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 · 9 Hone Gyro Stabilizers +2 (4 → 6) ₡40,000 | ₡2,840,000 |
|  | Vibro Mace (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 · 10 Hone Gyro Stabilizers +2 (4 → 6) ₡40,000 | ₡2,840,000 |
| Chica (10 steps, ₡2,870,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Armor Plating +1 (new) ₡20,000 | ₡2,820,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |

Storage (estimate; the engine counts at run time): 5 final weapons equipped at the robots target of 3. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A04 ×1 (decision 4).

Source findings before decisions: A03 ×1, A04 ×1, A08 ×1, V08 ×1, V13 ×3.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 43. Ray Custom Robo Lab (`ray-custom-robo-lab`) — Duo

| Field | Value |
|---|---|
| Stable name | Ray Custom Robo Lab |
| Franchise label | Custom Robo |
| Backstory | Ray Custom Robo Lab enters the arena with a clear doctrine. Complementary customizable arena machines. Every surviving machine returns to the workshop before the next booking. |
| Strategy | Duo |
| Target overrides | none (goal 13 Robots → 2, the strategy default) |
| Team names | 2v2: **Steel Hearts** (robots 1+2) · 3v3: none |
| Event order | `league_2v2`, `tag_team`, `tournament_2v2`, `league_1v1`, `koth`, `grand_melee`, `tournament_1v1`, `league_3v3`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- 2v2 team 1+2: 'Ray Pair 01' → 'Steel Hearts' (decisions 3, 18; delegated authoring)
- Slot 1 art brief: 'Compact Ray-series arena robot with modular white armour and darker mechanical joints.' → 'White Ray-series robo, red V-crest, green eye, red-and-blue armour, chunky blue arm cannon levelled' (decisions 3, 18; delegated authoring)
- Slot 1 'Ray 01': numbered name accepted as a canon designation (decisions 3, 18; delegated authoring)
- Slot 1 portrait: aligned (decisions 3, 18; delegated authoring)

Every blueprint is used at the robots target of 2; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Ray 01 | `weapon_shield` | short | balanced | 15 | Versatile | White Ray-series robo, red V-crest, green eye, red-and-blue armour, chunky blue arm cannon levelled | `ray-custom-robo-lab/1.webp` |
| 2 | Ray Mk III | `dual_wield` | short | offensive | 10 | Sprinter | Compact red-accented Ray-series robot with interchangeable ranged equipment. | `ray-custom-robo-lab/2.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Ray 01 | Laser Pistol + Light Shield (₡108,000) | Volt Sabre + Aegis Bulwark (₡834,000) |
| 2 Ray Mk III | Laser Pistol ×2 (₡114,000) | Volt Sabre ×2 (₡850,000) |

**Refinement plans** (generated; applied by Duo goal 17, Refine → 10 steps per robot). All 2 robots: 20 steps, ₡8,480,000; the 2 robots at the target: ₡8,480,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Ray 01 (10 steps, ₡2,860,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (8 → 9) ₡10,000 | ₡2,810,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |
| Ray Mk III (10 steps, ₡5,620,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 · 9 Hone Power Core +1 (−3 → −2) ₡10,000 | ₡2,810,000 |
|  | Volt Sabre (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 · 10 Hone Power Core +1 (−3 → −2) ₡10,000 | ₡2,810,000 |

Storage (estimate; the engine counts at run time): 4 final weapons equipped at the robots target of 2. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5), A04 ×1 (decision 4).

Source findings before decisions: A01 ×1, A03 ×2, A04 ×1, A11 ×1, A13 ×1, V13 ×3.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 44. Medabot Tournament Club (`medabot-tournament-club`) — Duo

| Field | Value |
|---|---|
| Stable name | Medabot Tournament Club |
| Franchise label | Medabots |
| Backstory | Medabot Tournament Club enters the arena with a clear doctrine. A ranged/melee pair with an obvious team identity. Every surviving machine returns to the workshop before the next booking. |
| Strategy | Duo |
| Target overrides | none (goal 13 Robots → 2, the strategy default) |
| Team names | 2v2: **Robattle Rivals** (robots 1+2) · 3v3: none |
| Event order | `tag_team`, `league_2v2`, `tournament_2v2`, `league_1v1`, `koth`, `grand_melee`, `tournament_1v1`, `league_3v3`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- 2v2 team 1+2: 'Medabot Pair 01' → 'Robattle Rivals' (decision 3; delegated authoring)

Every blueprint is used at the robots target of 2; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Metabee | `dual_wield` | short | offensive | 10 | Bruiser | Yellow beetle-themed Medabot with large head, strong plates and ranged arm equipment. | `medabot-tournament-club/1.webp` |
| 2 | Rokusho | `dual_wield` | melee | offensive | 10 | Sprinter | Pale stag-beetle-themed Medabot with pointed head and close-combat arm equipment. | `medabot-tournament-club/2.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Metabee | Laser Pistol ×2 (₡114,000) | Volt Sabre ×2 (₡850,000) |
| 2 Rokusho | Combat Knife ×2 (₡186,000) | Vibro Mace ×2 (₡850,000) |

**Refinement plans** (generated; applied by Duo goal 17, Refine → 10 steps per robot). All 2 robots: 20 steps, ₡11,240,000; the 2 robots at the target: ₡11,240,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Metabee (10 steps, ₡5,620,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 · 9 Hone Combat Power +1 (8 → 9) ₡10,000 | ₡2,810,000 |
|  | Volt Sabre (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 · 10 Hone Combat Power +1 (8 → 9) ₡10,000 | ₡2,810,000 |
| Rokusho (10 steps, ₡5,620,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 · 9 Hone Gyro Stabilizers +1 (4 → 5) ₡10,000 | ₡2,810,000 |
|  | Vibro Mace (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 · 10 Hone Gyro Stabilizers +1 (4 → 5) ₡10,000 | ₡2,810,000 |

Storage (estimate; the engine counts at run time): 4 final weapons equipped at the robots target of 2. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5), A04 ×1 (decision 4).

Source findings before decisions: A01 ×1, A03 ×1, A04 ×1, A11 ×1, V13 ×3.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 45. Virtual On Combat Lab (`virtual-on-combat-lab`) — Duo

| Field | Value |
|---|---|
| Stable name | Virtual On Combat Lab |
| Franchise label | Virtual-On |
| Backstory | Virtual On Combat Lab enters the arena with a clear doctrine. A mobile all-rounder and a heavy ranged partner. Every surviving machine returns to the workshop before the next booking. |
| Strategy | Duo |
| Target overrides | none (goal 13 Robots → 2, the strategy default) |
| Team names | 2v2: **Moon Gate Strike** (robots 1+2) · 3v3: none |
| Event order | `league_2v2`, `tag_team`, `tournament_2v2`, `league_1v1`, `koth`, `grand_melee`, `tournament_1v1`, `league_3v3`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- 2v2 team 1+2: 'Virtuaroid Pair 01' → 'Moon Gate Strike' (decision 3; delegated authoring)

Every blueprint is used at the robots target of 2; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Temjin | `single` | short | balanced | 10 | Versatile | Blue-white geometric Virtuaroid with broad armour and a weapon-bearing arm. | `virtual-on-combat-lab/1.webp` |
| 2 | Raiden | `two_handed` | long | defensive | 10 | Warden | Heavy red-grey Virtuaroid with broad torso, shoulder hardware and powerful emitter silhouette. | `virtual-on-combat-lab/2.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Temjin | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |
| 2 Raiden | Training Beam (₡50,000) | Ion Beam (₡544,000) |

**Refinement plans** (generated; applied by Duo goal 17, Refine → 10 steps per robot). All 2 robots: 10 steps, ₡5,620,000; the 2 robots at the target: ₡5,620,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Temjin (5 steps, ₡2,810,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (8 → 9) ₡10,000 | ₡2,810,000 |
| Raiden (5 steps, ₡2,810,000) | Ion Beam (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (8 → 9) ₡10,000 | ₡2,810,000 |

Storage (estimate; the engine counts at run time): 2 final weapons equipped at the robots target of 2. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5), A04 ×1 (decision 4).

Source findings before decisions: A01 ×1, A03 ×1, A04 ×1, A11 ×1, V13 ×2.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 46. WAR Arena Foundry (`war-arena-foundry`) — Trio

| Field | Value |
|---|---|
| Stable name | WAR Arena Foundry |
| Franchise label | One Must Fall: 2097 |
| Backstory | WAR Arena Foundry enters the arena with a clear doctrine. Retro arena fighters with deliberately different builds. Every surviving machine returns to the workshop before the next booking. |
| Strategy | Trio |
| Target overrides | none (goal 12 Robots → 3, the strategy default) |
| Team names | 2v2: **Fire Pit Brawlers** (robots 1+2) · 3v3: **Kreissack's Champions** (1–3) |
| Event order | `league_3v3`, `tournament_3v3`, `league_1v1`, `league_2v2`, `tag_team`, `koth`, `grand_melee`, `tournament_2v2`, `tournament_1v1` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- Franchise label: '[One Must Fall' → 'One Must Fall: 2097' (decisions 3, 7, 18; delegated authoring)
- 2v2 team 1+2: 'WAR Pair 01' → 'Fire Pit Brawlers' (decisions 3, 7, 18; delegated authoring)
- 3v3 team 1+2+3: 'WAR Squad 01' → "Kreissack's Champions" (decisions 3, 7, 18; delegated authoring)
- Slot 3 robot name: 'WAR Heavy HAR 03' → 'Nova HAR' (decisions 3, 7, 18; delegated authoring)
- Slot 3 art brief: 'Original arena HAR frame with massive shoulders, hydraulic arms and thick steel armour.' → 'Heavy red-and-grey HAR, boxy armoured shoulders, red visor slit, long two-handed cannon held low' (decisions 3, 7, 18; delegated authoring)
- Slot 3 portrait: aligned (decisions 3, 7, 18; delegated authoring)

Every blueprint is used at the robots target of 3; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Jaguar HAR | `dual_wield` | melee | offensive | 10 | Sprinter | Large arena HAR with athletic mechanical limbs and compact industrial armour. | `war-arena-foundry/1.webp` |
| 2 | Shadow HAR | `single` | melee | offensive | 10 | Sprinter | Dark agile arena HAR with a narrow head and long close-combat limbs. | `war-arena-foundry/2.webp` |
| 3 | Nova HAR | `two_handed` | melee | defensive | 5 | Warden | Heavy red-and-grey HAR, boxy armoured shoulders, red visor slit, long two-handed cannon held low | `war-arena-foundry/3.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Jaguar HAR | Combat Knife ×2 (₡186,000) | Vibro Mace ×2 (₡850,000) |
| 2 Shadow HAR | Practice Sword (₡50,000) | Vibro Mace (₡425,000) |
| 3 Nova HAR | War Club (₡84,000) | Heavy Hammer (₡478,000) |

**Refinement plans** (generated; applied by Trio goal 22, Refine → 10 steps per robot). All 3 robots: 20 steps, ₡11,240,000; the 3 robots at the target: ₡11,240,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Jaguar HAR (10 steps, ₡5,620,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 · 9 Hone Gyro Stabilizers +1 (4 → 5) ₡10,000 | ₡2,810,000 |
|  | Vibro Mace (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 · 10 Hone Gyro Stabilizers +1 (4 → 5) ₡10,000 | ₡2,810,000 |
| Shadow HAR (5 steps, ₡2,810,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Gyro Stabilizers +1 (4 → 5) ₡10,000 | ₡2,810,000 |
| Nova HAR (5 steps, ₡2,810,000) | Heavy Hammer (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (7 → 8) ₡10,000 | ₡2,810,000 |

Storage (estimate; the engine counts at run time): 4 final weapons equipped at the robots target of 3. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5), A04 ×1 (decision 4).

Source findings before decisions: A01 ×1, A03 ×2, A04 ×1, A11 ×1, A13 ×1, V13 ×3, V18 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 47. Metropolis Combat Systems (`metropolis-combat-systems`) — Paragon

| Field | Value |
|---|---|
| Stable name | Metropolis Combat Systems |
| Franchise label | Rise of the Robots |
| Backstory | Metropolis Combat Systems enters the arena with a clear doctrine. One powerful close-range machine. Every surviving machine returns to the workshop before the next booking. |
| Strategy | Paragon |
| Target overrides | none (goal 8 Robots → 1, the strategy default) |
| Team names | 2v2: none · 3v3: none |
| Event order | `league_1v1`, `tournament_1v1`, `koth`, `grand_melee`, `league_2v2`, `tag_team`, `tournament_2v2`, `league_3v3`, `tournament_3v3` |

**Changes from your draft**: none.

Every blueprint is used at the robots target of 1; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | ECO35-2 Coton | `dual_wield` | melee | offensive | 5 | Bruiser | Blue-armoured cyborg combat machine with exposed mechanical assemblies and a sleek torso. | `metropolis-combat-systems/1.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 ECO35-2 Coton | Energy Blade ×2 (₡350,000) | Vibro Mace ×2 (₡850,000) |

**Refinement plans** (generated; applied by Paragon goal 16, Refine → 10 steps per robot). The only blueprint: 8 steps, ₡5,600,000; the robot at the target: ₡5,600,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| ECO35-2 Coton (8 steps, ₡5,600,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 | ₡2,800,000 |
|  | Vibro Mace (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 | ₡2,800,000 |

Storage (estimate; the engine counts at run time): 2 final weapons equipped at the robots target of 1. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5), A02 ×1 (decision 9, 15), A04 ×1 (decision 4).

Source findings before decisions: A01 ×1, A02 ×1, A04 ×1, A11 ×1, V13 ×2.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 48. Clone Drone Combat Factory (`clone-drone-combat-factory`) — Swarm

| Field | Value |
|---|---|
| Stable name | Clone Drone Combat Factory |
| Franchise label | Clone Drone in the Danger Zone |
| Backstory | Clone Drone Combat Factory enters the arena with a clear doctrine. Numerous weapon specialists with serial-number identities. Every surviving machine returns to the workshop before the next booking. |
| Strategy | Swarm |
| Target overrides | none (goal 10 Robots → 11, the strategy default) |
| Team names | 2v2: **Arena Rookies** (robots 1+2), **Twitch Mode** (3+4), **Mind Transfer** (5+6), **Jetpack Ambush** (7+8), **Endless Mode** (9+10) · 3v3: **Last Bot Standing** (1–3), **Commentatron's Picks** (4–6), **Emperor's Arena** (7–9) |
| Event order | `league_3v3`, `league_2v2`, `grand_melee`, `koth`, `league_1v1`, `tag_team`, `tournament_3v3`, `tournament_2v2`, `tournament_1v1` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- 2v2 team 1+2: 'Clone Drone Pair 01' → 'Arena Rookies' (decisions 3, 18; delegated authoring)
- 2v2 team 3+4: 'Clone Drone Pair 02' → 'Twitch Mode' (decisions 3, 18; delegated authoring)
- 2v2 team 5+6: 'Clone Drone Pair 03' → 'Mind Transfer' (decisions 3, 18; delegated authoring)
- 2v2 team 7+8: 'Clone Drone Pair 04' → 'Jetpack Ambush' (decisions 3, 18; delegated authoring)
- 2v2 team 9+10: 'Clone Drone Pair 05' → 'Endless Mode' (decisions 3, 18; delegated authoring)
- 3v3 team 1+2+3: 'Clone Drone Squad 01' → 'Last Bot Standing' (decisions 3, 18; delegated authoring)
- 3v3 team 4+5+6: 'Clone Drone Squad 02' → "Commentatron's Picks" (decisions 3, 18; delegated authoring)
- 3v3 team 7+8+9: 'Clone Drone Squad 03' → "Emperor's Arena" (decisions 3, 18; delegated authoring)
- Slot 1 robot name: 'Sword Drone 01' → 'Sword Bot' (decisions 3, 18; delegated authoring)
- Slot 1 art brief: 'Geometric steel arena drone with a rectangular sensor head and sword-like weapon.' → 'Blue-and-grey voxel robot, red square eye, glowing white sword with a gold hilt swung low' (decisions 3, 18; delegated authoring)
- Slot 1 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 2 robot name: 'Bow Drone 02' → 'Archer Bot' (decisions 3, 18; delegated authoring)
- Slot 2 art brief: 'Geometric steel arena drone with a bow-shaped precision weapon assembly.' → 'Blue-and-grey voxel archer, cyan eye, glowing bow drawn with a blue arrow nocked' (decisions 3, 18; delegated authoring)
- Slot 2 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 3 robot name: 'Hammer Drone 03' → 'Horned Hammer Bot' (decisions 3, 18; delegated authoring)
- Slot 3 art brief: 'Geometric steel arena drone with a reinforced body and oversized hammer.' → 'Blue voxel robot with a horned head, red eyes, giant blocky hammer held two-handed' (decisions 3, 18; delegated authoring)
- Slot 3 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 4 robot name: 'Clone Drone 04' → 'Sword Bot Mk II' (decisions 3, 18; delegated authoring)
- Slot 4 art brief: 'Geometric steel arena drone with a rectangular sensor head and sword-like weapon. Arena unit 04 uses a distinct role-specific equipment silhouette.' → 'Red-and-grey voxel robot, red visor bar, glowing sword raised overhead' (decisions 3, 18; delegated authoring)
- Slot 4 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 5 robot name: 'Clone Drone 05' → 'Sword Bot 05' (decisions 3, 18; delegated authoring)
- Slot 5 art brief: 'Geometric steel arena drone with a rectangular sensor head and sword-like weapon. Arena unit 05 uses a distinct role-specific equipment silhouette.' → 'Blue voxel swordsman with a crested head, blue eyes, glowing sword held high' (decisions 3, 18; delegated authoring)
- Slot 5 'Sword Bot 05': numbered name accepted as a mass-produced designation (decisions 3, 18; delegated authoring)
- Slot 5 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 6 robot name: 'Clone Drone 06' → 'Sword Bot 06' (decisions 3, 18; delegated authoring)
- Slot 6 art brief: 'Geometric steel arena drone with a rectangular sensor head and sword-like weapon. Arena unit 06 uses a distinct role-specific equipment silhouette.' → 'Blue voxel swordsman, red visor bar, glowing sword swept across its legs' (decisions 3, 18; delegated authoring)
- Slot 6 'Sword Bot 06': numbered name accepted as a mass-produced designation (decisions 3, 18; delegated authoring)
- Slot 6 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 7 robot name: 'Clone Drone 07' → 'Sword Bot 07' (decisions 3, 18; delegated authoring)
- Slot 7 art brief: 'Geometric steel arena drone with a rectangular sensor head and sword-like weapon. Arena unit 07 uses a distinct role-specific equipment silhouette.' → 'Red-and-grey voxel swordsman, twin red eyes, red-glowing sword raised' (decisions 3, 18; delegated authoring)
- Slot 7 'Sword Bot 07': numbered name accepted as a mass-produced designation (decisions 3, 18; delegated authoring)
- Slot 7 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 8 robot name: 'Clone Drone 08' → 'Sword Bot 08' (decisions 3, 18; delegated authoring)
- Slot 8 art brief: 'Geometric steel arena drone with a rectangular sensor head and sword-like weapon. Arena unit 08 uses a distinct role-specific equipment silhouette.' → 'Blue voxel swordsman in a lunge, red eyes, glowing sword held up and back' (decisions 3, 18; delegated authoring)
- Slot 8 'Sword Bot 08': numbered name accepted as a mass-produced designation (decisions 3, 18; delegated authoring)
- Slot 8 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 9 robot name: 'Clone Drone 09' → 'Sword Bot 09' (decisions 3, 18; delegated authoring)
- Slot 9 art brief: 'Geometric steel arena drone with a rectangular sensor head and sword-like weapon. Arena unit 09 uses a distinct role-specific equipment silhouette.' → 'Tall blue voxel swordsman, single red eye, flat hat-like head, glowing sword held low' (decisions 3, 18; delegated authoring)
- Slot 9 'Sword Bot 09': numbered name accepted as a mass-produced designation (decisions 3, 18; delegated authoring)
- Slot 9 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 10 robot name: 'Clone Drone 10' → 'Sword Bot 10' (decisions 3, 18; delegated authoring)
- Slot 10 art brief: 'Geometric steel arena drone with a rectangular sensor head and sword-like weapon. Arena unit 10 uses a distinct role-specific equipment silhouette.' → 'Scuffed blue voxel swordsman, wide red visor, glowing sword raised beside its head' (decisions 3, 18; delegated authoring)
- Slot 10 'Sword Bot 10': numbered name accepted as a mass-produced designation (decisions 3, 18; delegated authoring)
- Slot 10 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 11 robot name: 'Clone Drone 11' → 'Sword Bot 11' (decisions 3, 18; delegated authoring)
- Slot 11 art brief: 'Geometric steel arena drone with a rectangular sensor head and sword-like weapon. Arena unit 11 uses a distinct role-specific equipment silhouette.' → 'Blue voxel swordsman with 11 on its shoulder, red eyes, glowing sword held upright' (decisions 3, 18; delegated authoring)
- Slot 11 'Sword Bot 11': numbered name accepted as a mass-produced designation (decisions 3, 18; delegated authoring)
- Slot 11 portrait: aligned (decisions 3, 18; delegated authoring)

Every blueprint is used at the robots target of 11; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Sword Bot | `single` | melee | offensive | 0 | Sprinter | Blue-and-grey voxel robot, red square eye, glowing white sword with a gold hilt swung low | `clone-drone-combat-factory/1.webp` |
| 2 | Archer Bot | `single` | long | balanced | 5 | Deadeye | Blue-and-grey voxel archer, cyan eye, glowing bow drawn with a blue arrow nocked | `clone-drone-combat-factory/2.webp` |
| 3 | Horned Hammer Bot | `two_handed` | melee | balanced | 0 | Bruiser | Blue voxel robot with a horned head, red eyes, giant blocky hammer held two-handed | `clone-drone-combat-factory/3.webp` |
| 4 | Sword Bot Mk II | `single` | short | balanced | 10 | Versatile | Red-and-grey voxel robot, red visor bar, glowing sword raised overhead | `clone-drone-combat-factory/4.webp` |
| 5 | Sword Bot 05 | `single` | long | balanced | 10 | Deadeye | Blue voxel swordsman with a crested head, blue eyes, glowing sword held high | `clone-drone-combat-factory/5.webp` |
| 6 | Sword Bot 06 | `weapon_shield` | short | defensive | 10 | Warden | Blue voxel swordsman, red visor bar, glowing sword swept across its legs | `clone-drone-combat-factory/6.webp` |
| 7 | Sword Bot 07 | `single` | mid | balanced | 10 | Deadeye | Red-and-grey voxel swordsman, twin red eyes, red-glowing sword raised | `clone-drone-combat-factory/7.webp` |
| 8 | Sword Bot 08 | `two_handed` | short | offensive | 10 | Bruiser | Blue voxel swordsman in a lunge, red eyes, glowing sword held up and back | `clone-drone-combat-factory/8.webp` |
| 9 | Sword Bot 09 | `dual_wield` | melee | offensive | 10 | Sprinter | Tall blue voxel swordsman, single red eye, flat hat-like head, glowing sword held low | `clone-drone-combat-factory/9.webp` |
| 10 | Sword Bot 10 | `two_handed` | mid | offensive | 10 | Bruiser | Scuffed blue voxel swordsman, wide red visor, glowing sword raised beside its head | `clone-drone-combat-factory/10.webp` |
| 11 | Sword Bot 11 | `two_handed` | long | defensive | 10 | Deadeye | Blue voxel swordsman with 11 on its shoulder, red eyes, glowing sword held upright | `clone-drone-combat-factory/11.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Sword Bot | Practice Sword (₡50,000) | Vibro Mace (₡425,000) |
| 2 Archer Bot | Beam Pistol (₡93,000) | Particle Lance (₡425,000) |
| 3 Horned Hammer Bot | War Club (₡84,000) | Heavy Hammer (₡478,000) |
| 4 Sword Bot Mk II | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |
| 5 Sword Bot 05 | Beam Pistol (₡93,000) | Particle Lance (₡425,000) |
| 6 Sword Bot 06 | Laser Pistol + Light Shield (₡108,000) | Volt Sabre + Aegis Bulwark (₡834,000) |
| 7 Sword Bot 07 | Bolt Carbine (₡93,000) | Nova Caster (₡425,000) |
| 8 Sword Bot 08 | Scatter Cannon (₡84,000) | Arc Projector (₡488,000) |
| 9 Sword Bot 09 | Combat Knife ×2 (₡186,000) | Vibro Mace ×2 (₡850,000) |
| 10 Sword Bot 10 | Training Rifle (₡50,000) | Plasma Cannon (₡408,000) |
| 11 Sword Bot 11 | Training Beam (₡50,000) | Ion Beam (₡544,000) |

**Refinement plans** (generated; applied by Swarm goal 23, Refine → 8 steps per robot). All 11 robots: 65 steps, ₡35,430,000; the 11 robots at the target: ₡35,430,000; Refine → 8 applies ₡35,090,000 of the target robots' plans.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Sword Bot (5 steps, ₡2,960,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Gyro Stabilizers +4 (4 → 8) ₡160,000 | ₡2,960,000 |
| Archer Bot (5 steps, ₡2,960,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +4 (5 → 9) ₡160,000 | ₡2,960,000 |
| Horned Hammer Bot (5 steps, ₡2,960,000) | Heavy Hammer (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Critical Systems +4 (4 → 8) ₡160,000 | ₡2,960,000 |
| Sword Bot Mk II (5 steps, ₡2,960,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| Sword Bot 05 (5 steps, ₡2,960,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +4 (5 → 9) ₡160,000 | ₡2,960,000 |
| Sword Bot 06 (10 steps, ₡2,870,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Armor Plating +1 (new) ₡20,000 | ₡2,820,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |
| Sword Bot 07 (5 steps, ₡2,960,000) | Nova Caster (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| Sword Bot 08 (5 steps, ₡2,960,000) | Arc Projector (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| Sword Bot 09 (10 steps, ₡5,920,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 · 9 Hone Gyro Stabilizers +4 (4 → 8) ₡160,000 | ₡2,960,000 |
|  | Vibro Mace (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 · 10 Hone Gyro Stabilizers +4 (4 → 8) ₡160,000 | ₡2,960,000 |
| Sword Bot 10 (5 steps, ₡2,960,000) | Plasma Cannon (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Critical Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| Sword Bot 11 (5 steps, ₡2,960,000) | Ion Beam (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (4 → 8) ₡160,000 | ₡2,960,000 |

Storage (estimate; the engine counts at run time): 13 final weapons equipped at the robots target of 11. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need Storage Facility L2; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A04 ×1 (decision 4).

Source findings before decisions: A03 ×2, A04 ×1, A13 ×11, V13 ×11.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 49. Robocraft Assembly Yard (`robocraft-assembly-yard`) — Tycoon

| Field | Value |
|---|---|
| Stable name | Robocraft Assembly Yard |
| Franchise label | Robocraft |
| Backstory | Robocraft Assembly Yard enters the arena with a clear doctrine. Facility-led investment in a small modular roster. Every surviving machine returns to the workshop before the next booking. |
| Strategy | Tycoon |
| Target overrides | goal 20 Robots → 3 (strategy default 2, allowed 2–3) |
| Team names | 2v2: **Tech Tree Climbers** (robots 1+2) · 3v3: **Battle Arena Crew** (1–3) |
| Event order | `koth`, `grand_melee`, `league_1v1`, `league_2v2`, `tag_team`, `tournament_1v1`, `tournament_2v2`, `league_3v3`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- 2v2 team 1+2: 'Robocraft Pair 01' → 'Tech Tree Climbers' (decisions 3, 18; delegated authoring)
- 3v3 team 1+2+3: 'Robocraft Squad 01' → 'Battle Arena Crew' (decisions 3, 18; delegated authoring)
- Slot 1 robot name: 'Robocraft Walker 01' → 'Ion Strider' (decisions 3, 18; delegated authoring)
- Slot 1 art brief: 'Original modular walker with block-built armour, jointed legs and twin ranged mounts.' → 'Four-legged white-and-orange block walker, blue visor slit, twin double-barrel turrets on top' (decisions 3, 18; delegated authoring)
- Slot 1 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 2 robot name: 'Robocraft Tank 02' → 'Plasma Crawler' (decisions 3, 18; delegated authoring)
- Slot 2 art brief: 'Original modular tank robot with block-built armour, tracks and a heavy cannon.' → 'Tracked white-and-orange block tank, blue-lit wheels, long cannon turret with a sensor pod' (decisions 3, 18; delegated authoring)
- Slot 2 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 3 robot name: 'Robocraft Scout 03' → 'SMG Sprinter' (decisions 3, 18; delegated authoring)
- Slot 3 art brief: 'Original light modular chassis with compact panels and a prominent sensor.' → 'Two-legged white-and-orange block walker, big blue eye, a blocky gun on each arm' (decisions 3, 18; delegated authoring)
- Slot 3 portrait: aligned (decisions 3, 18; delegated authoring)

Every blueprint is used at the robots target of 3; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Ion Strider | `dual_wield` | mid | balanced | 15 | Versatile | Four-legged white-and-orange block walker, blue visor slit, twin double-barrel turrets on top | `robocraft-assembly-yard/1.webp` |
| 2 | Plasma Crawler | `two_handed` | mid | defensive | 10 | Warden | Tracked white-and-orange block tank, blue-lit wheels, long cannon turret with a sensor pod | `robocraft-assembly-yard/2.webp` |
| 3 | SMG Sprinter | `single` | short | balanced | 25 | Sprinter | Two-legged white-and-orange block walker, big blue eye, a blocky gun on each arm | `robocraft-assembly-yard/3.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Ion Strider | Bolt Carbine ×2 (₡186,000) | Nova Caster ×2 (₡850,000) |
| 2 Plasma Crawler | Training Rifle (₡50,000) | Plasma Cannon (₡408,000) |
| 3 SMG Sprinter | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |

**Refinement plans** (generated; applied by Tycoon goal 25, Refine → 10 steps per robot). All 3 robots: 20 steps, ₡11,340,000; the 3 robots at the target: ₡11,340,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Ion Strider (10 steps, ₡5,680,000) | Nova Caster (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 · 9 Hone Combat Power +2 (8 → 10) ₡40,000 | ₡2,840,000 |
|  | Nova Caster (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 · 10 Hone Combat Power +2 (8 → 10) ₡40,000 | ₡2,840,000 |
| Plasma Crawler (5 steps, ₡2,820,000) | Plasma Cannon (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Armor Plating +1 (new) ₡20,000 | ₡2,820,000 |
| SMG Sprinter (5 steps, ₡2,840,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Power Core +2 (−3 → −1) ₡40,000 | ₡2,840,000 |

Storage (estimate; the engine counts at run time): 4 final weapons equipped at the robots target of 3. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A04 ×1 (decision 4).

Source findings before decisions: A03 ×2, A04 ×1, A13 ×3, V08 ×1, V13 ×3.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 50. PTMC Mining Rebellion (`ptmc-mining-rebellion`) — Swarm

| Field | Value |
|---|---|
| Stable name | PTMC Mining Rebellion |
| Franchise label | Descent |
| Backstory | PTMC Mining Rebellion enters the arena with a clear doctrine. Varied industrial drones built around ranged pressure. Every surviving machine returns to the workshop before the next booking. |
| Strategy | Swarm |
| Target overrides | none (goal 10 Robots → 11, the strategy default) |
| Team names | 2v2: **Lunar Outpost Crew** (robots 1+2), **Venus Lab Shift** (3+4), **Mercury Solar Lab** (5+6), **Io Sulphur Mine** (7+8), **Pluto Outpost** (9+10) · 3v3: **Zeta Aquilae Uprising** (1–3), **Baloris Prime Watch** (4–6), **Charon Reactor Guard** (7–9) |
| Event order | `league_3v3`, `league_2v2`, `grand_melee`, `koth`, `league_1v1`, `tag_team`, `tournament_3v3`, `tournament_2v2`, `tournament_1v1` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- 2v2 team 1+2: 'PTMC Pair 01' → 'Lunar Outpost Crew' (decisions 3, 18; delegated authoring)
- 2v2 team 3+4: 'PTMC Pair 02' → 'Venus Lab Shift' (decisions 3, 18; delegated authoring)
- 2v2 team 5+6: 'PTMC Pair 03' → 'Mercury Solar Lab' (decisions 3, 18; delegated authoring)
- 2v2 team 7+8: 'PTMC Pair 04' → 'Io Sulphur Mine' (decisions 3, 18; delegated authoring)
- 2v2 team 9+10: 'PTMC Pair 05' → 'Pluto Outpost' (decisions 3, 18; delegated authoring)
- 3v3 team 1+2+3: 'PTMC Squad 01' → 'Zeta Aquilae Uprising' (decisions 3, 18; delegated authoring)
- 3v3 team 4+5+6: 'PTMC Squad 02' → 'Baloris Prime Watch' (decisions 3, 18; delegated authoring)
- 3v3 team 7+8+9: 'PTMC Squad 03' → 'Charon Reactor Guard' (decisions 3, 18; delegated authoring)
- Slot 1 robot name: 'PTMC Miner 01' → 'Medium Lifter' (decisions 3, 18; delegated authoring)
- Slot 1 art brief: 'Arena-designated mining robot with retro orange safety paint and a utility lens.' → 'Rusty orange walker with a wedge-shaped head, single red eye, drill-bit forearm and a pincer claw' (decisions 3, 18; delegated authoring)
- Slot 1 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 2 robot name: 'PTMC Security 02' → 'Medium Hulk' (decisions 3, 18; delegated authoring)
- Slot 2 art brief: 'Arena-designated mining security robot with angular sensor housing and ranged mounts.' → 'Grey walker with red-striped plating, stacked red optics, red-muzzled cannon arm levelled' (decisions 3, 18; delegated authoring)
- Slot 2 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 3 robot name: 'PTMC Heavy 03' → 'Super Hulk' (decisions 3, 18; delegated authoring)
- Slot 3 art brief: 'Arena-designated heavy mining combat robot with thick plates and broad weapon pods.' → 'Massive yellow-and-grey hulk, blocky shoulder pods, amber visor, rotary cannon held two-handed' (decisions 3, 18; delegated authoring)
- Slot 3 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 4 robot name: 'PTMC Drone 04' → 'PTMC Miner 04' (decisions 3, 18; delegated authoring)
- Slot 4 art brief: 'Arena-designated mining robot with retro orange safety paint and a utility lens. Arena unit 04 uses a distinct role-specific equipment silhouette.' → 'Round orange miner hull stencilled 04, amber eye lens, drill-bit forearm and a three-finger claw' (decisions 3, 18; delegated authoring)
- Slot 4 'PTMC Miner 04': numbered name accepted as a mass-produced designation (decisions 3, 18; delegated authoring)
- Slot 4 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 5 robot name: 'PTMC Drone 05' → 'PTMC Miner 05' (decisions 3, 18; delegated authoring)
- Slot 5 art brief: 'Arena-designated mining robot with retro orange safety paint and a utility lens. Arena unit 05 uses a distinct role-specific equipment silhouette.' → 'Boxy orange miner stencilled 05, big amber eye, conical drill arm and an open grabber claw' (decisions 3, 18; delegated authoring)
- Slot 5 'PTMC Miner 05': numbered name accepted as a mass-produced designation (decisions 3, 18; delegated authoring)
- Slot 5 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 6 robot name: 'PTMC Drone 06' → 'PTMC Miner 06' (decisions 3, 18; delegated authoring)
- Slot 6 art brief: 'Arena-designated mining robot with retro orange safety paint and a utility lens. Arena unit 06 uses a distinct role-specific equipment silhouette.' → 'Orange miner stencilled 06, amber lamp eye, rotary cannon arm and a tall orange riot shield' (decisions 3, 18; delegated authoring)
- Slot 6 'PTMC Miner 06': numbered name accepted as a mass-produced designation (decisions 3, 18; delegated authoring)
- Slot 6 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 7 robot name: 'PTMC Drone 07' → 'PTMC Miner 07' (decisions 3, 18; delegated authoring)
- Slot 7 art brief: 'Arena-designated mining robot with retro orange safety paint and a utility lens. Arena unit 07 uses a distinct role-specific equipment silhouette.' → 'Tall upright orange miner stencilled 07, amber headlamp, drill forearm and a hooked claw hand' (decisions 3, 18; delegated authoring)
- Slot 7 'PTMC Miner 07': numbered name accepted as a mass-produced designation (decisions 3, 18; delegated authoring)
- Slot 7 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 8 robot name: 'PTMC Drone 08' → 'PTMC Miner 08' (decisions 3, 18; delegated authoring)
- Slot 8 art brief: 'Arena-designated mining robot with retro orange safety paint and a utility lens. Arena unit 08 uses a distinct role-specific equipment silhouette.' → 'Stocky orange miner stencilled 08, amber eye, huge drill held two-handed across its body' (decisions 3, 18; delegated authoring)
- Slot 8 'PTMC Miner 08': numbered name accepted as a mass-produced designation (decisions 3, 18; delegated authoring)
- Slot 8 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 9 robot name: 'PTMC Drone 09' → 'PTMC Miner 09' (decisions 3, 18; delegated authoring)
- Slot 9 art brief: 'Arena-designated mining robot with retro orange safety paint and a utility lens. Arena unit 09 uses a distinct role-specific equipment silhouette.' → 'Lean orange miner stencilled 09, twin amber eyes, roll-cage head, a short blaster in each hand' (decisions 3, 18; delegated authoring)
- Slot 9 'PTMC Miner 09': numbered name accepted as a mass-produced designation (decisions 3, 18; delegated authoring)
- Slot 9 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 10 robot name: 'PTMC Drone 10' → 'PTMC Miner 10' (decisions 3, 18; delegated authoring)
- Slot 10 art brief: 'Arena-designated mining robot with retro orange safety paint and a utility lens. Arena unit 10 uses a distinct role-specific equipment silhouette.' → 'Heavy orange miner stencilled 10, amber eye, big two-handed grinder bit with studded teeth' (decisions 3, 18; delegated authoring)
- Slot 10 'PTMC Miner 10': numbered name accepted as a mass-produced designation (decisions 3, 18; delegated authoring)
- Slot 10 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 11 robot name: 'PTMC Drone 11' → 'PTMC Miner 11' (decisions 3, 18; delegated authoring)
- Slot 11 art brief: 'Arena-designated mining robot with retro orange safety paint and a utility lens. Arena unit 11 uses a distinct role-specific equipment silhouette.' → 'Orange miner stencilled 11, amber eye in a pipe-framed head, long two-handed drill levelled' (decisions 3, 18; delegated authoring)
- Slot 11 'PTMC Miner 11': numbered name accepted as a mass-produced designation (decisions 3, 18; delegated authoring)
- Slot 11 portrait: aligned (decisions 3, 18; delegated authoring)

Every blueprint is used at the robots target of 11; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Medium Lifter | `single` | short | balanced | 15 | Tactician | Rusty orange walker with a wedge-shaped head, single red eye, drill-bit forearm and a pincer claw | `ptmc-mining-rebellion/1.webp` |
| 2 | Medium Hulk | `single` | mid | balanced | 5 | Deadeye | Grey walker with red-striped plating, stacked red optics, red-muzzled cannon arm levelled | `ptmc-mining-rebellion/2.webp` |
| 3 | Super Hulk | `two_handed` | mid | defensive | 0 | Warden | Massive yellow-and-grey hulk, blocky shoulder pods, amber visor, rotary cannon held two-handed | `ptmc-mining-rebellion/3.webp` |
| 4 | PTMC Miner 04 | `single` | short | balanced | 10 | Versatile | Round orange miner hull stencilled 04, amber eye lens, drill-bit forearm and a three-finger claw | `ptmc-mining-rebellion/4.webp` |
| 5 | PTMC Miner 05 | `single` | long | balanced | 10 | Deadeye | Boxy orange miner stencilled 05, big amber eye, conical drill arm and an open grabber claw | `ptmc-mining-rebellion/5.webp` |
| 6 | PTMC Miner 06 | `weapon_shield` | short | defensive | 10 | Warden | Orange miner stencilled 06, amber lamp eye, rotary cannon arm and a tall orange riot shield | `ptmc-mining-rebellion/6.webp` |
| 7 | PTMC Miner 07 | `single` | mid | balanced | 10 | Deadeye | Tall upright orange miner stencilled 07, amber headlamp, drill forearm and a hooked claw hand | `ptmc-mining-rebellion/7.webp` |
| 8 | PTMC Miner 08 | `two_handed` | short | offensive | 10 | Bruiser | Stocky orange miner stencilled 08, amber eye, huge drill held two-handed across its body | `ptmc-mining-rebellion/8.webp` |
| 9 | PTMC Miner 09 | `dual_wield` | melee | offensive | 10 | Sprinter | Lean orange miner stencilled 09, twin amber eyes, roll-cage head, a short blaster in each hand | `ptmc-mining-rebellion/9.webp` |
| 10 | PTMC Miner 10 | `two_handed` | mid | offensive | 10 | Bruiser | Heavy orange miner stencilled 10, amber eye, big two-handed grinder bit with studded teeth | `ptmc-mining-rebellion/10.webp` |
| 11 | PTMC Miner 11 | `two_handed` | long | defensive | 10 | Deadeye | Orange miner stencilled 11, amber eye in a pipe-framed head, long two-handed drill levelled | `ptmc-mining-rebellion/11.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Medium Lifter | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |
| 2 Medium Hulk | Bolt Carbine (₡93,000) | Nova Caster (₡425,000) |
| 3 Super Hulk | Training Rifle (₡50,000) | Plasma Cannon (₡408,000) |
| 4 PTMC Miner 04 | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |
| 5 PTMC Miner 05 | Beam Pistol (₡93,000) | Particle Lance (₡425,000) |
| 6 PTMC Miner 06 | Laser Pistol + Light Shield (₡108,000) | Volt Sabre + Aegis Bulwark (₡834,000) |
| 7 PTMC Miner 07 | Bolt Carbine (₡93,000) | Nova Caster (₡425,000) |
| 8 PTMC Miner 08 | Scatter Cannon (₡84,000) | Arc Projector (₡488,000) |
| 9 PTMC Miner 09 | Combat Knife ×2 (₡186,000) | Vibro Mace ×2 (₡850,000) |
| 10 PTMC Miner 10 | Training Rifle (₡50,000) | Plasma Cannon (₡408,000) |
| 11 PTMC Miner 11 | Training Beam (₡50,000) | Ion Beam (₡544,000) |

**Refinement plans** (generated; applied by Swarm goal 23, Refine → 8 steps per robot). All 11 robots: 65 steps, ₡35,150,000; the 11 robots at the target: ₡35,150,000; Refine → 8 applies ₡34,810,000 of the target robots' plans.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Medium Lifter (5 steps, ₡2,820,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Combat Algorithms +1 (new) ₡20,000 | ₡2,820,000 |
| Medium Hulk (5 steps, ₡2,960,000) | Nova Caster (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| Super Hulk (5 steps, ₡2,820,000) | Plasma Cannon (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Armor Plating +1 (new) ₡20,000 | ₡2,820,000 |
| PTMC Miner 04 (5 steps, ₡2,960,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| PTMC Miner 05 (5 steps, ₡2,960,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +4 (5 → 9) ₡160,000 | ₡2,960,000 |
| PTMC Miner 06 (10 steps, ₡2,870,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Armor Plating +1 (new) ₡20,000 | ₡2,820,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |
| PTMC Miner 07 (5 steps, ₡2,960,000) | Nova Caster (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| PTMC Miner 08 (5 steps, ₡2,960,000) | Arc Projector (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| PTMC Miner 09 (10 steps, ₡5,920,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 · 9 Hone Gyro Stabilizers +4 (4 → 8) ₡160,000 | ₡2,960,000 |
|  | Vibro Mace (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 · 10 Hone Gyro Stabilizers +4 (4 → 8) ₡160,000 | ₡2,960,000 |
| PTMC Miner 10 (5 steps, ₡2,960,000) | Plasma Cannon (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Critical Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| PTMC Miner 11 (5 steps, ₡2,960,000) | Ion Beam (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (4 → 8) ₡160,000 | ₡2,960,000 |

Storage (estimate; the engine counts at run time): 13 final weapons equipped at the robots target of 11. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need Storage Facility L2; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A04 ×1 (decision 4).

Source findings before decisions: A03 ×2, A04 ×1, A13 ×11, V13 ×11.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 51. Citadel Robot Security (`citadel-robot-security`) — Swarm

| Field | Value |
|---|---|
| Stable name | Citadel Robot Security |
| Franchise label | System Shock |
| Backstory | Citadel Robot Security enters the arena with a clear doctrine. A practical progression from utility frames to stronger weapons platforms. Every surviving machine returns to the workshop before the next booking. |
| Strategy | Swarm |
| Target overrides | none (goal 10 Robots → 11, the strategy default) |
| Team names | 2v2: **Maintenance Level** (robots 1+2), **TriOptimum Security** (3+4), **Executive Suite** (5+6), **Flight Deck Patrol** (7+8), **Reactor Watch** (9+10) · 3v3: **SHODAN's Chosen** (1–3), **Beta Grove Keepers** (4–6), **Systems Engineering** (7–9) |
| Event order | `league_1v1`, `league_3v3`, `league_2v2`, `grand_melee`, `koth`, `tag_team`, `tournament_3v3`, `tournament_2v2`, `tournament_1v1` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- 2v2 team 1+2: 'Citadel Pair 01' → 'Maintenance Level' (decisions 3, 18; delegated authoring)
- 2v2 team 3+4: 'Citadel Pair 02' → 'TriOptimum Security' (decisions 3, 18; delegated authoring)
- 2v2 team 5+6: 'Citadel Pair 03' → 'Executive Suite' (decisions 3, 18; delegated authoring)
- 2v2 team 7+8: 'Citadel Pair 04' → 'Flight Deck Patrol' (decisions 3, 18; delegated authoring)
- 2v2 team 9+10: 'Citadel Pair 05' → 'Reactor Watch' (decisions 3, 18; delegated authoring)
- 3v3 team 1+2+3: 'Citadel Squad 01' → "SHODAN's Chosen" (decisions 3, 18; delegated authoring)
- 3v3 team 4+5+6: 'Citadel Squad 02' → 'Beta Grove Keepers' (decisions 3, 18; delegated authoring)
- 3v3 team 7+8+9: 'Citadel Squad 03' → 'Systems Engineering' (decisions 3, 18; delegated authoring)
- Slot 1 robot name: 'Citadel Maintenance 01' → 'Maintenance-Bot' (decisions 3, 18; delegated authoring)
- Slot 1 art brief: 'Arena-designated Citadel service robot with dark industrial plates and articulated tool arms.' → 'Yellow-and-black wheeled maintenance robot, boxy head with a red eye, cutter arm and a claw' (decisions 3, 18; delegated authoring)
- Slot 1 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 2 robot name: 'Citadel Security 02' → 'Security-1' (decisions 3, 18; delegated authoring)
- Slot 2 art brief: 'Arena-designated Citadel security robot with cold metal casing and red sensors.' → 'Grey security walker with a saucer head, single red eye, red trim, blaster arm and a gripper hand' (decisions 3, 18; delegated authoring)
- Slot 2 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 3 robot name: 'Citadel Combat 03' → 'Security-2' (decisions 3, 18; delegated authoring)
- Slot 3 art brief: 'Arena-designated Citadel combat machine with heavy black armour and an emitter assembly.' → 'Dark gunmetal security robot, saucer head with a red visor band, heavy rifle held two-handed' (decisions 3, 18; delegated authoring)
- Slot 3 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 4 robot name: 'Citadel Sentry 04' → 'Security Unit 04' (decisions 3, 18; delegated authoring)
- Slot 4 art brief: 'Arena-designated Citadel security robot with cold metal casing and red sensors. Arena unit 04 uses a distinct role-specific equipment silhouette.' → 'White saucer-headed security robot stencilled 04, TriOptimum chest badge, red eyes, blaster arm' (decisions 3, 18; delegated authoring)
- Slot 4 'Security Unit 04': numbered name accepted as a mass-produced designation (decisions 3, 18; delegated authoring)
- Slot 4 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 5 robot name: 'Citadel Sentry 05' → 'Security Unit 05' (decisions 3, 18; delegated authoring)
- Slot 5 art brief: 'Arena-designated Citadel security robot with cold metal casing and red sensors. Arena unit 05 uses a distinct role-specific equipment silhouette.' → 'Grey-and-red boxy-headed security robot, red eye panel, long blaster arm and an open claw' (decisions 3, 18; delegated authoring)
- Slot 5 'Security Unit 05': numbered name accepted as a mass-produced designation (decisions 3, 18; delegated authoring)
- Slot 5 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 6 robot name: 'Citadel Sentry 06' → 'Security Unit 06' (decisions 3, 18; delegated authoring)
- Slot 6 art brief: 'Arena-designated Citadel security robot with cold metal casing and red sensors. Arena unit 06 uses a distinct role-specific equipment silhouette.' → 'Grey-and-red security robot stencilled 06, red eye, blaster arm and a TriOptimum riot shield' (decisions 3, 18; delegated authoring)
- Slot 6 'Security Unit 06': numbered name accepted as a mass-produced designation (decisions 3, 18; delegated authoring)
- Slot 6 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 7 robot name: 'Citadel Sentry 07' → 'Security Unit 07' (decisions 3, 18; delegated authoring)
- Slot 7 art brief: 'Arena-designated Citadel security robot with cold metal casing and red sensors. Arena unit 07 uses a distinct role-specific equipment silhouette.' → 'Slim white-and-red security robot stencilled 07, cyclops red eye, rifle held low' (decisions 3, 18; delegated authoring)
- Slot 7 'Security Unit 07': numbered name accepted as a mass-produced designation (decisions 3, 18; delegated authoring)
- Slot 7 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 8 robot name: 'Citadel Sentry 08' → 'Security Unit 08' (decisions 3, 18; delegated authoring)
- Slot 8 art brief: 'Arena-designated Citadel security robot with cold metal casing and red sensors. Arena unit 08 uses a distinct role-specific equipment silhouette.' → 'Grey security robot stencilled 08, narrow slit head with red eyes, rotary minigun held two-handed' (decisions 3, 18; delegated authoring)
- Slot 8 'Security Unit 08': numbered name accepted as a mass-produced designation (decisions 3, 18; delegated authoring)
- Slot 8 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 9 robot name: 'Citadel Sentry 09' → 'Security Unit 09' (decisions 3, 18; delegated authoring)
- Slot 9 art brief: 'Arena-designated Citadel security robot with cold metal casing and red sensors. Arena unit 09 uses a distinct role-specific equipment silhouette.' → 'Lanky white-and-red security robot, saucer head with a red eye, a blaster pod on each forearm' (decisions 3, 18; delegated authoring)
- Slot 9 'Security Unit 09': numbered name accepted as a mass-produced designation (decisions 3, 18; delegated authoring)
- Slot 9 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 10 robot name: 'Citadel Sentry 10' → 'Security Unit 10' (decisions 3, 18; delegated authoring)
- Slot 10 art brief: 'Arena-designated Citadel security robot with cold metal casing and red sensors. Arena unit 10 uses a distinct role-specific equipment silhouette.' → 'Grey-and-red security robot, saucer head with red eyes, two-handed twin-barrel rifle' (decisions 3, 18; delegated authoring)
- Slot 10 'Security Unit 10': numbered name accepted as a mass-produced designation (decisions 3, 18; delegated authoring)
- Slot 10 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 11 robot name: 'Citadel Sentry 11' → 'Security Unit 11' (decisions 3, 18; delegated authoring)
- Slot 11 art brief: 'Arena-designated Citadel security robot with cold metal casing and red sensors. Arena unit 11 uses a distinct role-specific equipment silhouette.' → 'White-and-red security robot stencilled 11, angular hat-like head, red eye, red-coil rifle' (decisions 3, 18; delegated authoring)
- Slot 11 'Security Unit 11': numbered name accepted as a mass-produced designation (decisions 3, 18; delegated authoring)
- Slot 11 portrait: aligned (decisions 3, 18; delegated authoring)

Every blueprint is used at the robots target of 11; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Maintenance-Bot | `single` | melee | offensive | 15 | Tactician | Yellow-and-black wheeled maintenance robot, boxy head with a red eye, cutter arm and a claw | `citadel-robot-security/1.webp` |
| 2 | Security-1 | `single` | short | offensive | 0 | Versatile | Grey security walker with a saucer head, single red eye, red trim, blaster arm and a gripper hand | `citadel-robot-security/2.webp` |
| 3 | Security-2 | `two_handed` | mid | defensive | 0 | Warden | Dark gunmetal security robot, saucer head with a red visor band, heavy rifle held two-handed | `citadel-robot-security/3.webp` |
| 4 | Security Unit 04 | `single` | short | balanced | 10 | Versatile | White saucer-headed security robot stencilled 04, TriOptimum chest badge, red eyes, blaster arm | `citadel-robot-security/4.webp` |
| 5 | Security Unit 05 | `single` | long | balanced | 10 | Deadeye | Grey-and-red boxy-headed security robot, red eye panel, long blaster arm and an open claw | `citadel-robot-security/5.webp` |
| 6 | Security Unit 06 | `weapon_shield` | short | defensive | 10 | Warden | Grey-and-red security robot stencilled 06, red eye, blaster arm and a TriOptimum riot shield | `citadel-robot-security/6.webp` |
| 7 | Security Unit 07 | `single` | mid | balanced | 10 | Deadeye | Slim white-and-red security robot stencilled 07, cyclops red eye, rifle held low | `citadel-robot-security/7.webp` |
| 8 | Security Unit 08 | `two_handed` | short | offensive | 10 | Bruiser | Grey security robot stencilled 08, narrow slit head with red eyes, rotary minigun held two-handed | `citadel-robot-security/8.webp` |
| 9 | Security Unit 09 | `dual_wield` | melee | offensive | 10 | Sprinter | Lanky white-and-red security robot, saucer head with a red eye, a blaster pod on each forearm | `citadel-robot-security/9.webp` |
| 10 | Security Unit 10 | `two_handed` | mid | offensive | 10 | Bruiser | Grey-and-red security robot, saucer head with red eyes, two-handed twin-barrel rifle | `citadel-robot-security/10.webp` |
| 11 | Security Unit 11 | `two_handed` | long | defensive | 10 | Deadeye | White-and-red security robot stencilled 11, angular hat-like head, red eye, red-coil rifle | `citadel-robot-security/11.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Maintenance-Bot | Practice Sword (₡50,000) | Vibro Mace (₡425,000) |
| 2 Security-1 | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |
| 3 Security-2 | Training Rifle (₡50,000) | Plasma Cannon (₡408,000) |
| 4 Security Unit 04 | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |
| 5 Security Unit 05 | Beam Pistol (₡93,000) | Particle Lance (₡425,000) |
| 6 Security Unit 06 | Laser Pistol + Light Shield (₡108,000) | Volt Sabre + Aegis Bulwark (₡834,000) |
| 7 Security Unit 07 | Bolt Carbine (₡93,000) | Nova Caster (₡425,000) |
| 8 Security Unit 08 | Scatter Cannon (₡84,000) | Arc Projector (₡488,000) |
| 9 Security Unit 09 | Combat Knife ×2 (₡186,000) | Vibro Mace ×2 (₡850,000) |
| 10 Security Unit 10 | Training Rifle (₡50,000) | Plasma Cannon (₡408,000) |
| 11 Security Unit 11 | Training Beam (₡50,000) | Ion Beam (₡544,000) |

**Refinement plans** (generated; applied by Swarm goal 23, Refine → 8 steps per robot). All 11 robots: 65 steps, ₡35,150,000; the 11 robots at the target: ₡35,150,000; Refine → 8 applies ₡34,810,000 of the target robots' plans.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Maintenance-Bot (5 steps, ₡2,820,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Combat Algorithms +1 (new) ₡20,000 | ₡2,820,000 |
| Security-1 (5 steps, ₡2,960,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| Security-2 (5 steps, ₡2,820,000) | Plasma Cannon (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Armor Plating +1 (new) ₡20,000 | ₡2,820,000 |
| Security Unit 04 (5 steps, ₡2,960,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| Security Unit 05 (5 steps, ₡2,960,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +4 (5 → 9) ₡160,000 | ₡2,960,000 |
| Security Unit 06 (10 steps, ₡2,870,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Armor Plating +1 (new) ₡20,000 | ₡2,820,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |
| Security Unit 07 (5 steps, ₡2,960,000) | Nova Caster (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| Security Unit 08 (5 steps, ₡2,960,000) | Arc Projector (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| Security Unit 09 (10 steps, ₡5,920,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 · 9 Hone Gyro Stabilizers +4 (4 → 8) ₡160,000 | ₡2,960,000 |
|  | Vibro Mace (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 · 10 Hone Gyro Stabilizers +4 (4 → 8) ₡160,000 | ₡2,960,000 |
| Security Unit 10 (5 steps, ₡2,960,000) | Plasma Cannon (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Critical Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| Security Unit 11 (5 steps, ₡2,960,000) | Ion Beam (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (4 → 8) ₡160,000 | ₡2,960,000 |

Storage (estimate; the engine counts at run time): 13 final weapons equipped at the robots target of 11. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need Storage Facility L2; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A04 ×1 (decision 4).

Source findings before decisions: A03 ×2, A04 ×1, A13 ×11, V13 ×11.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 52. Toa Foundry (`toa-foundry`) — Generalist

| Field | Value |
|---|---|
| Stable name | Toa Foundry |
| Franchise label | Bionicle |
| Backstory | Toa Foundry enters the arena with a clear doctrine. Three different build focuses tied to distinct silhouettes. Every surviving machine returns to the workshop before the next booking. |
| Strategy | Generalist |
| Target overrides | goal 14 Robots → 4 (strategy default 2, allowed 2–4) |
| Team names | 2v2: **Fire and Ice** (robots 1+2), **Earth and Air** (3+4) · 3v3: **Toa Mata** (1–3) |
| Event order | `league_1v1`, `league_2v2`, `league_3v3`, `tag_team`, `koth`, `grand_melee`, `tournament_1v1`, `tournament_2v2`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- 2v2 team 1+2: 'Toa Pair 01' → 'Fire and Ice' (decision 3; delegated authoring)
- 2v2 team 3+4: 'Toa Pair 02' → 'Earth and Air' (decision 3; delegated authoring)
- 3v3 team 1+2+3: 'Toa Squad 01' → 'Toa Mata' (decision 3; delegated authoring)
- Goal 14 Robots target: 3 → 4 (decision 5)

Every blueprint is used at the robots target of 4; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Tahu | `dual_wield` | melee | offensive | 5 | Bruiser | Red Toa with recognizable mask, articulated biomechanical limbs and blade equipment. | `toa-foundry/1.webp` |
| 2 | Kopaka | `weapon_shield` | melee | defensive | 15 | Warden | White Toa with recognizable mask, defensive shield and close-combat weapon. | `toa-foundry/2.webp` |
| 3 | Onua | `two_handed` | melee | balanced | 10 | Bruiser | Black broad-shouldered Toa with powerful arms and recognizable mask. | `toa-foundry/3.webp` |
| 4 | Lewa | `single` | melee | offensive | 15 | Sprinter | Green lean Toa with recognizable mask and long agile biomechanical limbs. | `toa-foundry/4.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Tahu | Combat Knife ×2 (₡186,000) | Vibro Mace ×2 (₡850,000) |
| 2 Kopaka | Practice Sword + Light Shield (₡101,000) | Vibro Mace + Aegis Bulwark (₡834,000) |
| 3 Onua | War Club (₡84,000) | Heavy Hammer (₡478,000) |
| 4 Lewa | Practice Sword (₡50,000) | Vibro Mace (₡425,000) |

**Refinement plans** (generated; applied by Generalist goal 18, Refine → 10 steps per robot). All 4 robots: 30 steps, ₡14,250,000; the 4 robots at the target: ₡14,250,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Tahu (10 steps, ₡5,680,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 · 9 Hone Combat Power +2 (6 → 8) ₡40,000 | ₡2,840,000 |
|  | Vibro Mace (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 · 10 Hone Combat Power +2 (6 → 8) ₡40,000 | ₡2,840,000 |
| Kopaka (10 steps, ₡2,890,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Counter Protocols +2 (5 → 7) ₡40,000 | ₡2,840,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |
| Onua (5 steps, ₡2,840,000) | Heavy Hammer (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +2 (7 → 9) ₡40,000 | ₡2,840,000 |
| Lewa (5 steps, ₡2,840,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Gyro Stabilizers +2 (4 → 6) ₡40,000 | ₡2,840,000 |

Storage (estimate; the engine counts at run time): 6 final weapons equipped at the robots target of 4. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need Storage Facility L1; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A04 ×1 (decision 4).

Source findings before decisions: A03 ×1, A04 ×1, A12 ×1, V08 ×1, V13 ×4.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 53. Soong Android Institute (`soong-android-institute`) — Trio

| Field | Value |
|---|---|
| Stable name | Soong Android Institute |
| Franchise label | Star Trek |
| Backstory | Soong Android Institute enters the arena with a clear doctrine. Three android builds with different investment priorities. Every surviving machine returns to the workshop before the next booking. |
| Strategy | Trio |
| Target overrides | none (goal 12 Robots → 3, the strategy default) |
| Team names | 2v2: **Soong-Type Brothers** (robots 1+2) · 3v3: **Omicron Theta Colony** (1–3) |
| Event order | `league_3v3`, `tournament_3v3`, `league_1v1`, `league_2v2`, `tag_team`, `koth`, `grand_melee`, `tournament_2v2`, `tournament_1v1` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- 2v2 team 1+2: 'Soong Pair 01' → 'Soong-Type Brothers' (decision 3; delegated authoring)
- 3v3 team 1+2+3: 'Soong Squad 01' → 'Omicron Theta Colony' (decision 3; delegated authoring)

Every blueprint is used at the robots target of 3; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Data | `single` | long | balanced | 20 | Tactician | Soong android with pale skin, gold eyes and a dark gold-accented Starfleet uniform. | `soong-android-institute/1.webp` |
| 2 | Lore | `dual_wield` | mid | offensive | 10 | Deadeye | Soong android with pale skin, gold eyes and a controlled aggressive pose. | `soong-android-institute/2.webp` |
| 3 | B-4 | `weapon_shield` | short | defensive | 30 | Versatile | Soong prototype android with pale skin, gold eyes and a protective stance. | `soong-android-institute/3.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Data | Beam Pistol (₡93,000) | Particle Lance (₡425,000) |
| 2 Lore | Bolt Carbine ×2 (₡186,000) | Nova Caster ×2 (₡850,000) |
| 3 B-4 | Laser Pistol + Light Shield (₡108,000) | Volt Sabre + Aegis Bulwark (₡834,000) |

**Refinement plans** (generated; applied by Trio goal 22, Refine → 10 steps per robot). All 3 robots: 25 steps, ₡11,290,000; the 3 robots at the target: ₡11,290,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Data (5 steps, ₡2,810,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (5 → 6) ₡10,000 | ₡2,810,000 |
| Lore (10 steps, ₡5,620,000) | Nova Caster (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 · 9 Hone Combat Power +1 (8 → 9) ₡10,000 | ₡2,810,000 |
|  | Nova Caster (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 · 10 Hone Combat Power +1 (8 → 9) ₡10,000 | ₡2,810,000 |
| B-4 (10 steps, ₡2,860,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (8 → 9) ₡10,000 | ₡2,810,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |

Storage (estimate; the engine counts at run time): 5 final weapons equipped at the robots target of 3. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5), A04 ×1 (decision 4), A09 ×1 (decision 8, 17).

Source findings before decisions: A01 ×1, A03 ×1, A04 ×1, A09 ×1, A11 ×1, V13 ×3.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 54. Jupiter Robot Hangar (`jupiter-robot-hangar`) — Paragon

| Field | Value |
|---|---|
| Stable name | Jupiter Robot Hangar |
| Franchise label | Lost in Space |
| Backstory | Jupiter Robot Hangar enters the arena with a clear doctrine. One durable heavy machine. Every surviving machine returns to the workshop before the next booking. |
| Strategy | Paragon |
| Target overrides | goal 3 Booking Office → L4 (strategy default L1, allowed L0–L6); goal 8 Robots → 2 (strategy default 1, allowed 1–2) |
| Team names | 2v2: **Danger Will Robinson** (robots 1+2) · 3v3: none |
| Event order | `league_1v1`, `tournament_1v1`, `koth`, `grand_melee`, `league_2v2`, `tag_team`, `tournament_2v2`, `league_3v3`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- 2v2 team 1+2: 'Jupiter Pair 01' → 'Danger Will Robinson' (decision 3; delegated authoring)
- Goal 3 Booking Office target: L1 → L4 (decision 5)
- Goal 8 Robots target: 1 → 2 (decision 5)

Every blueprint is used at the robots target of 2; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Jupiter Robot | `two_handed` | mid | defensive | 5 | Warden | Netflix-era alien Robot with bronze-dark metal plates and a luminous red face display. | `jupiter-robot-hangar/1.webp` |
| 2 | SAR | `two_handed` | long | defensive | 0 | Deadeye | Second alien robot in the same Netflix design family with dark plates and bright face display. | `jupiter-robot-hangar/2.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Jupiter Robot | Shotgun (₡283,000) | Plasma Cannon (₡408,000) |
| 2 SAR | Siege Cannon (₡163,000) | Ion Beam (₡544,000) |

**Refinement plans** (generated; applied by Paragon goal 16, Refine → 10 steps per robot). All 2 robots: 9 steps, ₡5,610,000; the 2 robots at the target: ₡5,610,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Jupiter Robot (4 steps, ₡2,800,000) | Plasma Cannon (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 | ₡2,800,000 |
| SAR (5 steps, ₡2,810,000) | Ion Beam (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (8 → 9) ₡10,000 | ₡2,810,000 |

Storage (estimate; the engine counts at run time): 2 final weapons equipped at the robots target of 2. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A04 ×1 (decision 4).

Source findings before decisions: A03 ×1, A04 ×1, A12 ×1, V13 ×2.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 55. Altair Service Robotics (`altair-service-robotics`) — Paragon

| Field | Value |
|---|---|
| Stable name | Altair Service Robotics |
| Franchise label | Forbidden Planet |
| Backstory | Altair Service Robotics enters the arena with a clear doctrine. A sturdy retro machine with concentrated upgrades. Every surviving machine returns to the workshop before the next booking. |
| Strategy | Paragon |
| Target overrides | none (goal 8 Robots → 1, the strategy default) |
| Team names | 2v2: none · 3v3: none |
| Event order | `league_1v1`, `tournament_1v1`, `koth`, `grand_melee`, `league_2v2`, `tag_team`, `tournament_2v2`, `league_3v3`, `tournament_3v3` |

**Changes from your draft**: none.

Every blueprint is used at the robots target of 1; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Robby the Robot | `weapon_shield` | mid | defensive | 25 | Warden | Retro service robot with a glass head dome, chest mechanisms and rounded dark limbs. | `altair-service-robotics/1.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Robby the Robot | Disruptor Cannon + Combat Shield (₡371,000) | Nova Caster + Aegis Bulwark (₡834,000) |

**Refinement plans** (generated; applied by Paragon goal 16, Refine → 10 steps per robot). The only blueprint: 4 steps, ₡2,800,000; the robot at the target: ₡2,800,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Robby the Robot (4 steps, ₡2,800,000) | Nova Caster (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 | ₡2,800,000 |
|  | Aegis Bulwark (offhand) | no step (allowed: shields need no step) | ₡0 |

Storage (estimate; the engine counts at run time): 2 final weapons equipped at the robots target of 1. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5), A04 ×1 (decision 4).

Source findings before decisions: A01 ×1, A04 ×1, A11 ×1, V13 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 56. Sirius Cybernetics Arena (`sirius-cybernetics-arena`) — Paragon

| Field | Value |
|---|---|
| Stable name | Sirius Cybernetics Arena |
| Franchise label | The Hitchhiker's Guide to the Galaxy |
| Backstory | Sirius Cybernetics Arena enters the arena with a clear doctrine. A defensive, tactical robot with a dry stable bio. Every surviving machine returns to the workshop before the next booking. |
| Strategy | Paragon |
| Target overrides | none (goal 8 Robots → 1, the strategy default) |
| Team names | 2v2: none · 3v3: none |
| Event order | `league_1v1`, `tournament_1v1`, `koth`, `grand_melee`, `league_2v2`, `tag_team`, `tournament_2v2`, `league_3v3`, `tournament_3v3` |

**Changes from your draft**: none.

Every blueprint is used at the robots target of 1; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Marvin | `weapon_shield` | long | defensive | 35 | Tactician | 2005 film android design with a large white head, dark eye panels and compact metal body. | `sirius-cybernetics-arena/1.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Marvin | Gauss Pistol + Combat Shield (₡369,000) | Particle Lance + Aegis Bulwark (₡834,000) |

**Refinement plans** (generated; applied by Paragon goal 16, Refine → 10 steps per robot). The only blueprint: 4 steps, ₡2,800,000; the robot at the target: ₡2,800,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Marvin (4 steps, ₡2,800,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 | ₡2,800,000 |
|  | Aegis Bulwark (offhand) | no step (allowed: shields need no step) | ₡0 |

Storage (estimate; the engine counts at run time): 2 final weapons equipped at the robots target of 1. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5), A04 ×1 (decision 4).

Source findings before decisions: A01 ×1, A04 ×1, A11 ×1, V13 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 57. Satellite Six Robot Club (`satellite-six-robot-club`) — Tycoon

| Field | Value |
|---|---|
| Stable name | Satellite Six Robot Club |
| Franchise label | Mystery Science Theater 3000 |
| Backstory | Satellite Six Robot Club enters the arena with a clear doctrine. Audience income supports a small roster. Every surviving machine returns to the workshop before the next booking. |
| Strategy | Tycoon |
| Target overrides | goal 20 Robots → 3 (strategy default 2, allowed 2–3) |
| Team names | 2v2: **Movie Sign!** (robots 1+2) · 3v3: **Satellite of Love** (1–3) |
| Event order | `koth`, `grand_melee`, `league_1v1`, `league_2v2`, `tag_team`, `tournament_1v1`, `tournament_2v2`, `league_3v3`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- 2v2 team 1+2: 'Satellite Six Pair 01' → 'Movie Sign!' (decision 3; delegated authoring)
- 3v3 team 1+2+3: 'Satellite Six Squad 01' → 'Satellite of Love' (decision 3; delegated authoring)

Every blueprint is used at the robots target of 3; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Crow T. Robot | `single` | melee | offensive | 30 | Sprinter | Gold skeletal robot with a long beak-like face, distinctive head crest and thin limbs. | `satellite-six-robot-club/1.webp` |
| 2 | Tom Servo | `single` | long | balanced | 30 | Tactician | Red dome-headed robot with a transparent upper housing and compact body. | `satellite-six-robot-club/2.webp` |
| 3 | Gypsy | `weapon_shield` | short | defensive | 30 | Warden | Large service robot with a rounded purple head, single eye and flexible mechanical body. | `satellite-six-robot-club/3.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Crow T. Robot | Practice Sword (₡50,000) | Vibro Mace (₡425,000) |
| 2 Tom Servo | Beam Pistol (₡93,000) | Particle Lance (₡425,000) |
| 3 Gypsy | Laser Pistol + Light Shield (₡108,000) | Volt Sabre + Aegis Bulwark (₡834,000) |

**Refinement plans** (generated; applied by Tycoon goal 25, Refine → 10 steps per robot). All 3 robots: 20 steps, ₡8,530,000; the 3 robots at the target: ₡8,530,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Crow T. Robot (5 steps, ₡2,840,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Gyro Stabilizers +2 (4 → 6) ₡40,000 | ₡2,840,000 |
| Tom Servo (5 steps, ₡2,820,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Combat Algorithms +1 (new) ₡20,000 | ₡2,820,000 |
| Gypsy (10 steps, ₡2,870,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Armor Plating +1 (new) ₡20,000 | ₡2,820,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |

Storage (estimate; the engine counts at run time): 4 final weapons equipped at the robots target of 3. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A04 ×1 (decision 4).

Source findings before decisions: A03 ×1, A04 ×1, V08 ×1, V13 ×3.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 58. Cygnus Robotics Division (`cygnus-robotics-division`) — Duo

| Field | Value |
|---|---|
| Stable name | Cygnus Robotics Division |
| Franchise label | The Black Hole |
| Backstory | Cygnus Robotics Division enters the arena with a clear doctrine. Compact precision-oriented partners with distinct defensive priorities. Every surviving machine returns to the workshop before the next booking. |
| Strategy | Duo |
| Target overrides | goal 11 Booking Office → L6 (strategy default L4, allowed L0–L6); goal 13 Robots → 3 (strategy default 2, allowed 2–3) |
| Team names | 2v2: **Palomino Crew** (robots 1+2) · 3v3: **Reinhardt's Sentries** (1–3) |
| Event order | `league_2v2`, `tag_team`, `tournament_2v2`, `league_1v1`, `koth`, `grand_melee`, `tournament_1v1`, `league_3v3`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- 2v2 team 1+2: 'Cygnus Pair 01' → 'Palomino Crew' (decision 3; delegated authoring)
- 3v3 team 1+2+3: 'Cygnus Squad 01' → "Reinhardt's Sentries" (decision 3; delegated authoring)
- Goal 11 Booking Office target: L4 → L6 (decision 5)
- Goal 13 Robots target: 2 → 3 (decision 5)

Every blueprint is used at the robots target of 3; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | V.I.N.CENT. | `dual_wield` | short | balanced | 15 | Versatile | Polished floating-canister robot with large cartoon-like optics and retractable weapon ports. | `cygnus-robotics-division/1.webp` |
| 2 | B.O.B. | `weapon_shield` | short | defensive | 25 | Warden | Battered floating-canister robot with worn red panels, large optics and visible damage repairs. | `cygnus-robotics-division/2.webp` |
| 3 | Maximilian | `dual_wield` | melee | offensive | 0 | Bruiser | Tall red armoured robot with a narrow visor and blade-bearing arm assemblies. | `cygnus-robotics-division/3.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 V.I.N.CENT. | Laser Pistol ×2 (₡114,000) | Volt Sabre ×2 (₡850,000) |
| 2 B.O.B. | Laser Pistol + Light Shield (₡108,000) | Volt Sabre + Aegis Bulwark (₡834,000) |
| 3 Maximilian | Combat Knife ×2 (₡186,000) | Vibro Mace ×2 (₡850,000) |

**Refinement plans** (generated; applied by Duo goal 17, Refine → 10 steps per robot). All 3 robots: 30 steps, ₡14,230,000; the 3 robots at the target: ₡14,230,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| V.I.N.CENT. (10 steps, ₡5,680,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 · 9 Hone Combat Power +2 (8 → 10) ₡40,000 | ₡2,840,000 |
|  | Volt Sabre (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 · 10 Hone Combat Power +2 (8 → 10) ₡40,000 | ₡2,840,000 |
| B.O.B. (10 steps, ₡2,870,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Armor Plating +1 (new) ₡20,000 | ₡2,820,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |
| Maximilian (10 steps, ₡5,680,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 · 9 Hone Combat Power +2 (6 → 8) ₡40,000 | ₡2,840,000 |
|  | Vibro Mace (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 · 10 Hone Combat Power +2 (6 → 8) ₡40,000 | ₡2,840,000 |

Storage (estimate; the engine counts at run time): 6 final weapons equipped at the robots target of 3. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need Storage Facility L1; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A04 ×1 (decision 4).

Source findings before decisions: A03 ×1, A04 ×1, A12 ×1, V13 ×4.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 59. Valley Forge Maintenance (`valley-forge-maintenance`) — Trio

| Field | Value |
|---|---|
| Stable name | Valley Forge Maintenance |
| Franchise label | Silent Running |
| Backstory | Valley Forge Maintenance enters the arena with a clear doctrine. A utility crew adapted into durable arena robots. Every surviving machine returns to the workshop before the next booking. |
| Strategy | Trio |
| Target overrides | none (goal 12 Robots → 3, the strategy default) |
| Team names | 2v2: **Dome Gardeners** (robots 1+2) · 3v3: **Lowell's Drones** (1–3) |
| Event order | `league_3v3`, `tournament_3v3`, `league_1v1`, `league_2v2`, `tag_team`, `koth`, `grand_melee`, `tournament_2v2`, `tournament_1v1` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- 2v2 team 1+2: 'Valley Forge Pair 01' → 'Dome Gardeners' (decision 3; delegated authoring)
- 3v3 team 1+2+3: 'Valley Forge Squad 01' → "Lowell's Drones" (decision 3; delegated authoring)

Every blueprint is used at the robots target of 3; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Huey | `weapon_shield` | short | defensive | 25 | Warden | Boxy low utility drone with squat legs, numbered casing and an articulated tool arm. | `valley-forge-maintenance/1.webp` |
| 2 | Dewey | `single` | short | defensive | 25 | Tactician | Boxy low utility drone with squat legs, distinct service markings and a sensor assembly. | `valley-forge-maintenance/2.webp` |
| 3 | Louie | `single` | mid | balanced | 25 | Versatile | Boxy low utility drone with repaired panels, squat legs and a compact tool mount. | `valley-forge-maintenance/3.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Huey | Laser Pistol + Light Shield (₡108,000) | Volt Sabre + Aegis Bulwark (₡834,000) |
| 2 Dewey | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |
| 3 Louie | Bolt Carbine (₡93,000) | Nova Caster (₡425,000) |

**Refinement plans** (generated; applied by Trio goal 22, Refine → 10 steps per robot). All 3 robots: 20 steps, ₡8,480,000; the 3 robots at the target: ₡8,480,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Huey (10 steps, ₡2,860,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (8 → 9) ₡10,000 | ₡2,810,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |
| Dewey (5 steps, ₡2,810,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (8 → 9) ₡10,000 | ₡2,810,000 |
| Louie (5 steps, ₡2,810,000) | Nova Caster (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (8 → 9) ₡10,000 | ₡2,810,000 |

Storage (estimate; the engine counts at run time): 4 final weapons equipped at the robots target of 3. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5), A04 ×1 (decision 4).

Source findings before decisions: A01 ×1, A03 ×1, A04 ×1, A11 ×1, V13 ×3.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 60. Fix It Foundry (`fix-it-foundry`) — Duo

| Field | Value |
|---|---|
| Stable name | Fix It Foundry |
| Franchise label | *batteries not included |
| Backstory | Fix It Foundry enters the arena with a clear doctrine. Small durable partners with protective build choices. Every surviving machine returns to the workshop before the next booking. |
| Strategy | Duo |
| Target overrides | goal 11 Booking Office → L6 (strategy default L4, allowed L0–L6); goal 13 Robots → 3 (strategy default 2, allowed 2–3) |
| Team names | 2v2: **East Eighth Street** (robots 1+2) · 3v3: **Fix-It Family** (1–3) |
| Event order | `league_2v2`, `tag_team`, `tournament_2v2`, `league_1v1`, `koth`, `grand_melee`, `tournament_1v1`, `league_3v3`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- Franchise label: 'batteries not included' → '*batteries not included' (decisions 3, 7, 18; delegated authoring)
- 2v2 team 1+2: 'Fix It Pair 01' → 'East Eighth Street' (decisions 3, 7, 18; delegated authoring)
- 3v3 team 1+2+3: 'Fix It Squad 01' → 'Fix-It Family' (decisions 3, 7, 18; delegated authoring)
- Slot 1 robot name: 'Fix-It Parent 01' → 'Kilowatt' (decisions 3, 7, 18; delegated authoring)
- Slot 1 art brief: 'Small saucer-like parent machine with metallic ribs, compact tool limbs and warm optics.' → 'Weathered saucer Fix-It with a ribbed vent dome, twin amber eyes, a claw arm and a tool-gun arm' (decisions 3, 7, 18; delegated authoring)
- Slot 1 portrait: aligned (decisions 3, 7, 18; delegated authoring)
- Slot 2 robot name: 'Fix-It Parent 02' → 'Carmen' (decisions 3, 7, 18; delegated authoring)
- Slot 2 art brief: 'Second small saucer-like parent machine with a broader dome and warm focused optics.' → 'Smooth domed saucer Fix-It on four legs, small antennae, twin amber eyes, no arms' (decisions 3, 7, 18; delegated authoring)
- Slot 2 portrait: aligned (decisions 3, 7, 18; delegated authoring)
- Slot 3 robot name: 'Fix-It Scout 03' → 'Wheems' (decisions 3, 7, 18; delegated authoring)
- Slot 3 art brief: 'Small child-sized saucer machine with compact rim panels and bright mechanical eyes.' → 'Red-striped saucer Fix-It with a tail fin and antenna, round goggle eyes, two claw arms' (decisions 3, 7, 18; delegated authoring)
- Slot 3 portrait: aligned (decisions 3, 7, 18; delegated authoring)
- Goal 11 Booking Office target: L4 → L6 (decision 5)
- Goal 13 Robots target: 2 → 3 (decision 5)

Every blueprint is used at the robots target of 3; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Kilowatt | `weapon_shield` | short | defensive | 30 | Warden | Weathered saucer Fix-It with a ribbed vent dome, twin amber eyes, a claw arm and a tool-gun arm | `fix-it-foundry/1.webp` |
| 2 | Carmen | `single` | long | defensive | 30 | Tactician | Smooth domed saucer Fix-It on four legs, small antennae, twin amber eyes, no arms | `fix-it-foundry/2.webp` |
| 3 | Wheems | `single` | short | balanced | 35 | Sprinter | Red-striped saucer Fix-It with a tail fin and antenna, round goggle eyes, two claw arms | `fix-it-foundry/3.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Kilowatt | Laser Pistol + Light Shield (₡108,000) | Volt Sabre + Aegis Bulwark (₡834,000) |
| 2 Carmen | Beam Pistol (₡93,000) | Particle Lance (₡425,000) |
| 3 Wheems | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |

**Refinement plans** (generated; applied by Duo goal 17, Refine → 10 steps per robot). All 3 robots: 20 steps, ₡8,530,000; the 3 robots at the target: ₡8,530,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Kilowatt (10 steps, ₡2,870,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Armor Plating +1 (new) ₡20,000 | ₡2,820,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |
| Carmen (5 steps, ₡2,820,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Combat Algorithms +1 (new) ₡20,000 | ₡2,820,000 |
| Wheems (5 steps, ₡2,840,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Power Core +2 (−3 → −1) ₡40,000 | ₡2,840,000 |

Storage (estimate; the engine counts at run time): 4 final weapons equipped at the robots target of 3. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A04 ×1 (decision 4).

Source findings before decisions: A03 ×2, A04 ×1, A09 ×1, A12 ×1, A13 ×3, V13 ×3, V18 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 61. NDR Precision Workshop (`ndr-precision-workshop`) — Paragon

| Field | Value |
|---|---|
| Stable name | NDR Precision Workshop |
| Franchise label | Bicentennial Man |
| Backstory | NDR Precision Workshop enters the arena with a clear doctrine. A balanced flagship that improves steadily. Every surviving machine returns to the workshop before the next booking. |
| Strategy | Paragon |
| Target overrides | none (goal 8 Robots → 1, the strategy default) |
| Team names | 2v2: none · 3v3: none |
| Event order | `league_1v1`, `tournament_1v1`, `koth`, `grand_melee`, `league_2v2`, `tag_team`, `tournament_2v2`, `league_3v3`, `tournament_3v3` |

**Changes from your draft**: none.

Every blueprint is used at the robots target of 1; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Andrew NDR-114 | `single` | short | balanced | 25 | Versatile | Early mechanical NDR-114 android with bronze plates, articulated hands and expressive face. | `ndr-precision-workshop/1.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Andrew NDR-114 | Plasma Rifle (₡258,000) | Volt Sabre (₡425,000) |

**Refinement plans** (generated; applied by Paragon goal 16, Refine → 10 steps per robot). The only blueprint: 4 steps, ₡2,800,000; the robot at the target: ₡2,800,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Andrew NDR-114 (4 steps, ₡2,800,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 | ₡2,800,000 |

Storage (estimate; the engine counts at run time): 1 final weapons equipped at the robots target of 1. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5), A04 ×1 (decision 4).

Source findings before decisions: A01 ×1, A04 ×1, A11 ×1, V13 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 62. Cybertronics Mecha Lab (`cybertronics-mecha-lab`) — Paragon

| Field | Value |
|---|---|
| Stable name | Cybertronics Mecha Lab |
| Franchise label | A.I. Artificial Intelligence |
| Backstory | Cybertronics Mecha Lab enters the arena with a clear doctrine. A subtle tactical android interpretation. Every surviving machine returns to the workshop before the next booking. |
| Strategy | Paragon |
| Target overrides | goal 3 Booking Office → L4 (strategy default L1, allowed L0–L6); goal 8 Robots → 2 (strategy default 1, allowed 1–2) |
| Team names | 2v2: **Blue Fairy Seekers** (robots 1+2) · 3v3: none |
| Event order | `league_1v1`, `tournament_1v1`, `koth`, `grand_melee`, `league_2v2`, `tag_team`, `tournament_2v2`, `league_3v3`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- 2v2 team 1+2: 'Cybertronics Pair 01' → 'Blue Fairy Seekers' (decision 3; delegated authoring)
- Goal 3 Booking Office target: L1 → L4 (decision 5)
- Goal 8 Robots target: 1 → 2 (decision 5)

Every blueprint is used at the robots target of 2; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | David Mecha | `weapon_shield` | long | defensive | 40 | Tactician | Child-shaped Cybertronics synthetic with pale face, neat hair and visible manufactured detail. | `cybertronics-mecha-lab/1.webp` |
| 2 | Gigolo Joe | `single` | long | balanced | 30 | Versatile | Adult human-looking Cybertronics synthetic with slick hair and a precise composed stance. | `cybertronics-mecha-lab/2.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 David Mecha | Gauss Pistol + Combat Shield (₡369,000) | Particle Lance + Aegis Bulwark (₡834,000) |
| 2 Gigolo Joe | Gauss Pistol (₡291,000) | Particle Lance (₡425,000) |

**Refinement plans** (generated; applied by Paragon goal 16, Refine → 10 steps per robot). All 2 robots: 9 steps, ₡5,610,000; the 2 robots at the target: ₡5,610,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| David Mecha (4 steps, ₡2,800,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 | ₡2,800,000 |
|  | Aegis Bulwark (offhand) | no step (allowed: shields need no step) | ₡0 |
| Gigolo Joe (5 steps, ₡2,810,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (5 → 6) ₡10,000 | ₡2,810,000 |

Storage (estimate; the engine counts at run time): 3 final weapons equipped at the robots target of 2. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A04 ×1 (decision 4), A09 ×1 (decision 8, 17).

Source findings before decisions: A03 ×1, A04 ×1, A09 ×1, A12 ×1, V13 ×2.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 63. Delos Host Division (`delos-host-division`) — Tycoon

| Field | Value |
|---|---|
| Stable name | Delos Host Division |
| Franchise label | Westworld |
| Backstory | Delos Host Division enters the arena with a clear doctrine. Corporate infrastructure funds a compact synthetic roster. Every surviving machine returns to the workshop before the next booking. |
| Strategy | Tycoon |
| Target overrides | goal 20 Robots → 3 (strategy default 2, allowed 2–3) |
| Team names | 2v2: **Mariposa Saloon** (robots 1+2) · 3v3: **Center of the Maze** (1–3) |
| Event order | `koth`, `grand_melee`, `league_1v1`, `league_2v2`, `tag_team`, `tournament_1v1`, `tournament_2v2`, `league_3v3`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- 2v2 team 1+2: 'Delos Pair 01' → 'Mariposa Saloon' (decision 3; delegated authoring)
- 3v3 team 1+2+3: 'Delos Squad 01' → 'Center of the Maze' (decision 3; delegated authoring)

Every blueprint is used at the robots target of 3; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Dolores | `single` | short | balanced | 15 | Versatile | Human-looking Delos host with pale blue clothing and subtly visible manufactured detail. | `delos-host-division/1.webp` |
| 2 | Maeve | `dual_wield` | long | balanced | 20 | Tactician | Human-looking Delos host in dark clothing with precise composure and subtle synthetic detail. | `delos-host-division/2.webp` |
| 3 | Bernard | `weapon_shield` | long | defensive | 25 | Tactician | Human-looking Delos host with glasses, subdued clothing and visible synthetic joint detail. | `delos-host-division/3.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Dolores | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |
| 2 Maeve | Beam Pistol ×2 (₡186,000) | Particle Lance ×2 (₡850,000) |
| 3 Bernard | Beam Pistol + Combat Shield (₡171,000) | Particle Lance + Aegis Bulwark (₡834,000) |

**Refinement plans** (generated; applied by Tycoon goal 25, Refine → 10 steps per robot). All 3 robots: 25 steps, ₡11,350,000; the 3 robots at the target: ₡11,350,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Dolores (5 steps, ₡2,840,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +2 (8 → 10) ₡40,000 | ₡2,840,000 |
| Maeve (10 steps, ₡5,640,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 · 9 Augment Combat Algorithms +1 (new) ₡20,000 | ₡2,820,000 |
|  | Particle Lance (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 · 10 Augment Combat Algorithms +1 (new) ₡20,000 | ₡2,820,000 |
| Bernard (10 steps, ₡2,870,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Combat Algorithms +1 (new) ₡20,000 | ₡2,820,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |

Storage (estimate; the engine counts at run time): 5 final weapons equipped at the robots target of 3. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A04 ×1 (decision 4), A09 ×1 (decision 8, 17).

Source findings before decisions: A03 ×1, A04 ×1, A09 ×1, V08 ×1, V13 ×3.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 64. Weyland Synthetic Unit (`weyland-synthetic-unit`) — Duo

| Field | Value |
|---|---|
| Stable name | Weyland Synthetic Unit |
| Franchise label | Alien |
| Backstory | Weyland Synthetic Unit enters the arena with a clear doctrine. A pair of precise android builds. Every surviving machine returns to the workshop before the next booking. |
| Strategy | Duo |
| Target overrides | goal 11 Booking Office → L6 (strategy default L4, allowed L0–L6); goal 13 Robots → 3 (strategy default 2, allowed 2–3) |
| Team names | 2v2: **Covenant Crew** (robots 1+2) · 3v3: **Building Better Worlds** (1–3) |
| Event order | `league_2v2`, `tag_team`, `tournament_2v2`, `league_1v1`, `koth`, `grand_melee`, `tournament_1v1`, `league_3v3`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- 2v2 team 1+2: 'Weyland Pair 01' → 'Covenant Crew' (decision 3; delegated authoring)
- 3v3 team 1+2+3: 'Weyland Squad 01' → 'Building Better Worlds' (decision 3; delegated authoring)
- Goal 11 Booking Office target: L4 → L6 (decision 5)
- Goal 13 Robots target: 2 → 3 (decision 5)

Every blueprint is used at the robots target of 3; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | David 8 | `single` | long | balanced | 15 | Deadeye | Human-looking Weyland synthetic in restrained industrial clothing and a precise ready stance. | `weyland-synthetic-unit/1.webp` |
| 2 | Walter One | `weapon_shield` | mid | defensive | 20 | Warden | Human-looking Weyland synthetic in dark utility clothing and a protective stance. | `weyland-synthetic-unit/2.webp` |
| 3 | Bishop | `weapon_shield` | long | defensive | 25 | Tactician | Human-looking Weyland synthetic in pale industrial utility clothing, calm and defensive. | `weyland-synthetic-unit/3.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 David 8 | Beam Pistol (₡93,000) | Particle Lance (₡425,000) |
| 2 Walter One | Bolt Carbine + Combat Shield (₡171,000) | Nova Caster + Aegis Bulwark (₡834,000) |
| 3 Bishop | Beam Pistol + Combat Shield (₡171,000) | Particle Lance + Aegis Bulwark (₡834,000) |

**Refinement plans** (generated; applied by Duo goal 17, Refine → 10 steps per robot). All 3 robots: 25 steps, ₡8,580,000; the 3 robots at the target: ₡8,580,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| David 8 (5 steps, ₡2,840,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +2 (5 → 7) ₡40,000 | ₡2,840,000 |
| Walter One (10 steps, ₡2,870,000) | Nova Caster (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Armor Plating +1 (new) ₡20,000 | ₡2,820,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |
| Bishop (10 steps, ₡2,870,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Combat Algorithms +1 (new) ₡20,000 | ₡2,820,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |

Storage (estimate; the engine counts at run time): 5 final weapons equipped at the robots target of 3. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A04 ×1 (decision 4), A09 ×1 (decision 8, 17).

Source findings before decisions: A03 ×1, A04 ×1, A07 ×1, A09 ×1, A12 ×1, V13 ×3.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 65. Druidia Droid Service (`druidia-droid-service`) — Paragon

| Field | Value |
|---|---|
| Stable name | Druidia Droid Service |
| Franchise label | Spaceballs |
| Backstory | Druidia Droid Service enters the arena with a clear doctrine. A defensive comic character with serious arena equipment. Every surviving machine returns to the workshop before the next booking. |
| Strategy | Paragon |
| Target overrides | none (goal 8 Robots → 1, the strategy default) |
| Team names | 2v2: none · 3v3: none |
| Event order | `league_1v1`, `tournament_1v1`, `koth`, `grand_melee`, `league_2v2`, `tag_team`, `tournament_2v2`, `league_3v3`, `tournament_3v3` |

**Changes from your draft**: none.

Every blueprint is used at the robots target of 1; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Dot Matrix | `weapon_shield` | short | defensive | 30 | Tactician | Gold humanoid service droid with recognizable facial plates and articulated metal limbs. | `druidia-droid-service/1.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Dot Matrix | Plasma Rifle + Light Shield (₡309,000) | Volt Sabre + Aegis Bulwark (₡834,000) |

**Refinement plans** (generated; applied by Paragon goal 16, Refine → 10 steps per robot). The only blueprint: 4 steps, ₡2,800,000; the robot at the target: ₡2,800,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Dot Matrix (4 steps, ₡2,800,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 | ₡2,800,000 |
|  | Aegis Bulwark (offhand) | no step (allowed: shields need no step) | ₡0 |

Storage (estimate; the engine counts at run time): 2 final weapons equipped at the robots target of 1. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5), A04 ×1 (decision 4).

Source findings before decisions: A01 ×1, A04 ×1, A11 ×1, V13 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 66. Metropolis Automaton Lab (`metropolis-automaton-lab`) — Paragon

| Field | Value |
|---|---|
| Stable name | Metropolis Automaton Lab |
| Franchise label | Metropolis |
| Backstory | Metropolis Automaton Lab enters the arena with a clear doctrine. An iconic balanced metal automaton with concentrated refinement. Every surviving machine returns to the workshop before the next booking. |
| Strategy | Paragon |
| Target overrides | none (goal 8 Robots → 1, the strategy default) |
| Team names | 2v2: none · 3v3: none |
| Event order | `league_1v1`, `tournament_1v1`, `koth`, `grand_melee`, `league_2v2`, `tag_team`, `tournament_2v2`, `league_3v3`, `tournament_3v3` |

**Changes from your draft**: none.

Every blueprint is used at the robots target of 1; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Maschinenmensch | `single` | short | balanced | 15 | Versatile | Sculpted metallic art-deco automaton with luminous eyes and layered curved plates. | `metropolis-automaton-lab/1.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Maschinenmensch | Plasma Rifle (₡258,000) | Volt Sabre (₡425,000) |

**Refinement plans** (generated; applied by Paragon goal 16, Refine → 10 steps per robot). The only blueprint: 4 steps, ₡2,800,000; the robot at the target: ₡2,800,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Maschinenmensch (4 steps, ₡2,800,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 | ₡2,800,000 |

Storage (estimate; the engine counts at run time): 1 final weapons equipped at the robots target of 1. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5), A04 ×1 (decision 4).

Source findings before decisions: A01 ×1, A04 ×1, A11 ×1, V13 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 67. Rozzum Wilderness Works (`rozzum-wilderness-works`) — Paragon

| Field | Value |
|---|---|
| Stable name | Rozzum Wilderness Works |
| Franchise label | The Wild Robot |
| Backstory | Rozzum Wilderness Works enters the arena with a clear doctrine. A resilient utility machine with tactical priorities. Every surviving machine returns to the workshop before the next booking. |
| Strategy | Paragon |
| Target overrides | none (goal 8 Robots → 1, the strategy default) |
| Team names | 2v2: none · 3v3: none |
| Event order | `league_1v1`, `tournament_1v1`, `koth`, `grand_melee`, `league_2v2`, `tag_team`, `tournament_2v2`, `league_3v3`, `tournament_3v3` |

**Changes from your draft**: none.

Every blueprint is used at the robots target of 1; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Roz ROZZUM 7134 | `weapon_shield` | short | defensive | 30 | Tactician | Rounded service robot with long mechanical limbs, worn casing and large expressive eyes. | `rozzum-wilderness-works/1.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Roz ROZZUM 7134 | Plasma Rifle + Light Shield (₡309,000) | Volt Sabre + Aegis Bulwark (₡834,000) |

**Refinement plans** (generated; applied by Paragon goal 16, Refine → 10 steps per robot). The only blueprint: 4 steps, ₡2,800,000; the robot at the target: ₡2,800,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Roz ROZZUM 7134 (4 steps, ₡2,800,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 | ₡2,800,000 |
|  | Aegis Bulwark (offhand) | no step (allowed: shields need no step) | ₡0 |

Storage (estimate; the engine counts at run time): 2 final weapons equipped at the robots target of 1. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5), A04 ×1 (decision 4).

Source findings before decisions: A01 ×1, A04 ×1, A11 ×1, V13 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 68. Project 7723 (`project-7723`) — Paragon

| Field | Value |
|---|---|
| Stable name | Project 7723 |
| Franchise label | Next Gen |
| Backstory | Project 7723 enters the arena with a clear doctrine. One highly capable mobile combat machine. Every surviving machine returns to the workshop before the next booking. |
| Strategy | Paragon |
| Target overrides | none (goal 8 Robots → 1, the strategy default) |
| Team names | 2v2: none · 3v3: none |
| Event order | `league_1v1`, `tournament_1v1`, `koth`, `grand_melee`, `league_2v2`, `tag_team`, `tournament_2v2`, `league_3v3`, `tournament_3v3` |

**Changes from your draft**: none.

Every blueprint is used at the robots target of 1; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | 7723 | `dual_wield` | short | offensive | 0 | Versatile | Rounded white combat robot with dark joints, luminous face details and weapon assemblies. | `project-7723/1.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 7723 | Plasma Rifle ×2 (₡516,000) | Volt Sabre ×2 (₡850,000) |

**Refinement plans** (generated; applied by Paragon goal 16, Refine → 10 steps per robot). The only blueprint: 8 steps, ₡5,600,000; the robot at the target: ₡5,600,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| 7723 (8 steps, ₡5,600,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 | ₡2,800,000 |
|  | Volt Sabre (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 | ₡2,800,000 |

Storage (estimate; the engine counts at run time): 2 final weapons equipped at the robots target of 1. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5), A04 ×1 (decision 4).

Source findings before decisions: A01 ×1, A04 ×1, A11 ×1, V13 ×2.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 69. Bubble Companion Lab (`bubble-companion-lab`) — Paragon

| Field | Value |
|---|---|
| Stable name | Bubble Companion Lab |
| Franchise label | Ron's Gone Wrong |
| Backstory | Bubble Companion Lab enters the arena with a clear doctrine. A compact evasive machine upgraded beyond its civilian origins. Every surviving machine returns to the workshop before the next booking. |
| Strategy | Paragon |
| Target overrides | none (goal 8 Robots → 1, the strategy default) |
| Team names | 2v2: none · 3v3: none |
| Event order | `league_1v1`, `tournament_1v1`, `koth`, `grand_melee`, `league_2v2`, `tag_team`, `tournament_2v2`, `league_3v3`, `tournament_3v3` |

**Changes from your draft**: none.

Every blueprint is used at the robots target of 1; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Ron | `single` | short | balanced | 35 | Sprinter | White capsule-shaped companion robot with screen face, small arms and rounded feet. | `bubble-companion-lab/1.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Ron | Plasma Rifle (₡258,000) | Volt Sabre (₡425,000) |

**Refinement plans** (generated; applied by Paragon goal 16, Refine → 10 steps per robot). The only blueprint: 4 steps, ₡2,800,000; the robot at the target: ₡2,800,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Ron (4 steps, ₡2,800,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 | ₡2,800,000 |

Storage (estimate; the engine counts at run time): 1 final weapons equipped at the robots target of 1. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5), A04 ×1 (decision 4).

Source findings before decisions: A01 ×1, A04 ×1, A11 ×1, V13 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 70. Copper Nine Drone Works (`copper-nine-drone-works`) — Trio

| Field | Value |
|---|---|
| Stable name | Copper Nine Drone Works |
| Franchise label | Murder Drones |
| Backstory | Copper Nine Drone Works enters the arena with a clear doctrine. Three aggressive machines with different build focuses. Every surviving machine returns to the workshop before the next booking. |
| Strategy | Trio |
| Target overrides | goal 12 Robots → 4 (strategy default 3, allowed 3–6) |
| Team names | 2v2: **Serial Designations** (robots 1+2), **Absolute Solver** (3+4) · 3v3: **Disassembly Squad** (1–3) |
| Event order | `league_3v3`, `tournament_3v3`, `league_1v1`, `league_2v2`, `tag_team`, `koth`, `grand_melee`, `tournament_2v2`, `tournament_1v1` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- 2v2 team 1+2: 'Copper Nine Pair 01' → 'Serial Designations' (decision 3; delegated authoring)
- 2v2 team 3+4: 'Copper Nine Pair 02' → 'Absolute Solver' (decision 3; delegated authoring)
- 3v3 team 1+2+3: 'Copper Nine Squad 01' → 'Disassembly Squad' (decision 3; delegated authoring)
- Goal 12 Robots target: 3 → 4 (decision 5)

Every blueprint is used at the robots target of 4; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | N | `weapon_shield` | short | balanced | 15 | Versatile | Dark disassembly drone with yellow face display, pale hair and an industrial cap. | `copper-nine-drone-works/1.webp` |
| 2 | V | `dual_wield` | melee | offensive | 0 | Sprinter | Dark disassembly drone with yellow face display, pale hair and sharp mechanical tools. | `copper-nine-drone-works/2.webp` |
| 3 | J | `dual_wield` | mid | offensive | 10 | Tactician | Dark disassembly drone with yellow face display, pale twin-tail hair and industrial equipment. | `copper-nine-drone-works/3.webp` |
| 4 | Uzi | `two_handed` | long | defensive | 5 | Deadeye | Compact worker drone with purple face display, dark clothing and a large long-range weapon. | `copper-nine-drone-works/4.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 N | Laser Pistol + Light Shield (₡108,000) | Volt Sabre + Aegis Bulwark (₡834,000) |
| 2 V | Combat Knife ×2 (₡186,000) | Vibro Mace ×2 (₡850,000) |
| 3 J | Bolt Carbine ×2 (₡186,000) | Nova Caster ×2 (₡850,000) |
| 4 Uzi | Training Beam (₡50,000) | Ion Beam (₡544,000) |

**Refinement plans** (generated; applied by Trio goal 22, Refine → 10 steps per robot). All 4 robots: 35 steps, ₡17,050,000; the 4 robots at the target: ₡17,050,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| N (10 steps, ₡2,890,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +2 (8 → 10) ₡40,000 | ₡2,840,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |
| V (10 steps, ₡5,680,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 · 9 Hone Gyro Stabilizers +2 (4 → 6) ₡40,000 | ₡2,840,000 |
|  | Vibro Mace (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 · 10 Hone Gyro Stabilizers +2 (4 → 6) ₡40,000 | ₡2,840,000 |
| J (10 steps, ₡5,640,000) | Nova Caster (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 · 9 Augment Combat Algorithms +1 (new) ₡20,000 | ₡2,820,000 |
|  | Nova Caster (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 · 10 Augment Combat Algorithms +1 (new) ₡20,000 | ₡2,820,000 |
| Uzi (5 steps, ₡2,840,000) | Ion Beam (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +2 (8 → 10) ₡40,000 | ₡2,840,000 |

Storage (estimate; the engine counts at run time): 7 final weapons equipped at the robots target of 4. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need Storage Facility L1; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5), A04 ×1 (decision 4), A09 ×1 (decision 8, 17).

Source findings before decisions: A03 ×1, A04 ×1, A09 ×1, A12 ×1, V13 ×4.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 71. Wakeman Robot Workshop (`wakeman-robot-workshop`) — Paragon

| Field | Value |
|---|---|
| Stable name | Wakeman Robot Workshop |
| Franchise label | My Life as a Teenage Robot |
| Backstory | Wakeman Robot Workshop enters the arena with a clear doctrine. A mobile combat flagship with concentrated refinement. Every surviving machine returns to the workshop before the next booking. |
| Strategy | Paragon |
| Target overrides | none (goal 8 Robots → 1, the strategy default) |
| Team names | 2v2: none · 3v3: none |
| Event order | `league_1v1`, `tournament_1v1`, `koth`, `grand_melee`, `league_2v2`, `tag_team`, `tournament_2v2`, `league_3v3`, `tournament_3v3` |

**Changes from your draft**: none.

Every blueprint is used at the robots target of 1; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | XJ-9 Jenny | `dual_wield` | short | offensive | 10 | Versatile | Cyan-white combat robot with distinctive head shapes, segmented limbs and broad feet. | `wakeman-robot-workshop/1.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 XJ-9 Jenny | Plasma Rifle ×2 (₡516,000) | Volt Sabre ×2 (₡850,000) |

**Refinement plans** (generated; applied by Paragon goal 16, Refine → 10 steps per robot). The only blueprint: 8 steps, ₡5,600,000; the robot at the target: ₡5,600,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| XJ-9 Jenny (8 steps, ₡5,600,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 | ₡2,800,000 |
|  | Volt Sabre (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 | ₡2,800,000 |

Storage (estimate; the engine counts at run time): 2 final weapons equipped at the robots target of 1. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5), A04 ×1 (decision 4).

Source findings before decisions: A01 ×1, A04 ×1, A11 ×1, V13 ×2.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 72. Irken Droid Outpost (`irken-droid-outpost`) — Paragon

| Field | Value |
|---|---|
| Stable name | Irken Droid Outpost |
| Franchise label | Invader Zim |
| Backstory | Irken Droid Outpost enters the arena with a clear doctrine. A tiny tactical machine with a distinctive portrait. Every surviving machine returns to the workshop before the next booking. |
| Strategy | Paragon |
| Target overrides | goal 3 Booking Office → L4 (strategy default L1, allowed L0–L6); goal 8 Robots → 2 (strategy default 1, allowed 1–2) |
| Team names | 2v2: **Operation Impending Doom** (robots 1+2) · 3v3: none |
| Event order | `league_1v1`, `tournament_1v1`, `koth`, `grand_melee`, `league_2v2`, `tag_team`, `tournament_2v2`, `league_3v3`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- 2v2 team 1+2: 'Irken Pair 01' → 'Operation Impending Doom' (decisions 3, 18; delegated authoring)
- Slot 2 robot name: 'Irken SIR 02' → 'MiMi' (decisions 3, 18; delegated authoring)
- Slot 2 art brief: 'Dark silver Irken SIR robot with red optics, narrow head and practical mechanical limbs.' → 'Slim silver SIR unit, blade-shaped head with a big red eye, one blade arm and a pincer claw' (decisions 3, 18; delegated authoring)
- Slot 2 portrait: aligned (decisions 3, 18; delegated authoring)
- Goal 3 Booking Office target: L1 → L4 (decision 5)
- Goal 8 Robots target: 1 → 2 (decision 5)

Every blueprint is used at the robots target of 2; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | GIR | `single` | short | balanced | 30 | Tactician | Small silver robot with cyan optics, cylindrical torso and thin metal limbs. | `irken-droid-outpost/1.webp` |
| 2 | MiMi | `single` | long | balanced | 5 | Deadeye | Slim silver SIR unit, blade-shaped head with a big red eye, one blade arm and a pincer claw | `irken-droid-outpost/2.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 GIR | Plasma Rifle (₡258,000) | Volt Sabre (₡425,000) |
| 2 MiMi | Gauss Pistol (₡291,000) | Particle Lance (₡425,000) |

**Refinement plans** (generated; applied by Paragon goal 16, Refine → 10 steps per robot). All 2 robots: 9 steps, ₡5,610,000; the 2 robots at the target: ₡5,610,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| GIR (4 steps, ₡2,800,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 | ₡2,800,000 |
| MiMi (5 steps, ₡2,810,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (5 → 6) ₡10,000 | ₡2,810,000 |

Storage (estimate; the engine counts at run time): 2 final weapons equipped at the robots target of 2. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A04 ×1 (decision 4).

Source findings before decisions: A03 ×2, A04 ×1, A12 ×1, A13 ×1, V13 ×2.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 73. Tenma Robotics Institute (`tenma-robotics-institute`) — Paragon

| Field | Value |
|---|---|
| Stable name | Tenma Robotics Institute |
| Franchise label | Astro Boy |
| Backstory | Tenma Robotics Institute enters the arena with a clear doctrine. An agile all-rounder with concentrated upgrades. Every surviving machine returns to the workshop before the next booking. |
| Strategy | Paragon |
| Target overrides | goal 3 Booking Office → L4 (strategy default L1, allowed L0–L6); goal 8 Robots → 2 (strategy default 1, allowed 1–2) |
| Team names | 2v2: **Metro City Rivals** (robots 1+2) · 3v3: none |
| Event order | `league_1v1`, `tournament_1v1`, `koth`, `grand_melee`, `league_2v2`, `tag_team`, `tournament_2v2`, `league_3v3`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- 2v2 team 1+2: 'Tenma Pair 01' → 'Metro City Rivals' (decision 3; delegated authoring)
- Goal 3 Booking Office target: L1 → L4 (decision 5)
- Goal 8 Robots target: 1 → 2 (decision 5)

Every blueprint is used at the robots target of 2; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Astro Boy | `dual_wield` | short | offensive | 10 | Versatile | Compact child-shaped robot with recognizable pointed hair, dark trunks and red boots. | `tenma-robotics-institute/1.webp` |
| 2 | Atlas Tenma | `two_handed` | mid | offensive | 5 | Bruiser | Astro Boy setting combat robot with broad metallic armour and a strong humanoid silhouette. | `tenma-robotics-institute/2.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Astro Boy | Plasma Rifle ×2 (₡516,000) | Volt Sabre ×2 (₡850,000) |
| 2 Atlas Tenma | Shotgun (₡283,000) | Plasma Cannon (₡408,000) |

**Refinement plans** (generated; applied by Paragon goal 16, Refine → 10 steps per robot). All 2 robots: 15 steps, ₡8,430,000; the 2 robots at the target: ₡8,430,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Astro Boy (10 steps, ₡5,620,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 · 9 Hone Combat Power +1 (8 → 9) ₡10,000 | ₡2,810,000 |
|  | Volt Sabre (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 · 10 Hone Combat Power +1 (8 → 9) ₡10,000 | ₡2,810,000 |
| Atlas Tenma (5 steps, ₡2,810,000) | Plasma Cannon (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (7 → 8) ₡10,000 | ₡2,810,000 |

Storage (estimate; the engine counts at run time): 3 final weapons equipped at the robots target of 2. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A04 ×1 (decision 4), A09 ×1 (decision 8, 17).

Source findings before decisions: A03 ×1, A04 ×1, A09 ×1, A12 ×1, V13 ×3.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 74. Special Vehicle Robot Unit (`special-vehicle-robot-unit`) — Duo

| Field | Value |
|---|---|
| Stable name | Special Vehicle Robot Unit |
| Franchise label | Patlabor |
| Backstory | Special Vehicle Robot Unit enters the arena with a clear doctrine. A disciplined pair with defensive and precision priorities. Every surviving machine returns to the workshop before the next booking. |
| Strategy | Duo |
| Target overrides | none (goal 13 Robots → 2, the strategy default) |
| Team names | 2v2: **SV2 First Platoon** (robots 1+2) · 3v3: none |
| Event order | `league_2v2`, `tag_team`, `tournament_2v2`, `league_1v1`, `koth`, `grand_melee`, `tournament_1v1`, `league_3v3`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- 2v2 team 1+2: 'Special Vehicle Pair 01' → 'SV2 First Platoon' (decisions 3, 18; delegated authoring)
- Slot 1 art brief: 'White police Ingram mecha with black joints, shoulder markings and shield equipment.' → 'White-and-black police Ingram stencilled 1, red shoulder light bars, revolver and police shield' (decisions 3, 18; delegated authoring)
- Slot 1 'AV-98 Ingram Unit 1': numbered name accepted as a canon designation (decisions 3, 18; delegated authoring)
- Slot 1 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 2 art brief: 'White police Ingram mecha with differentiated head detail, unit markings and precision weapon.' → 'White-and-black police Ingram stencilled 2, red shoulder light bars, revolver drawn, police shield' (decisions 3, 18; delegated authoring)
- Slot 2 'AV-98 Ingram Unit 2': numbered name accepted as a canon designation (decisions 3, 18; delegated authoring)
- Slot 2 portrait: aligned (decisions 3, 18; delegated authoring)

Every blueprint is used at the robots target of 2; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | AV-98 Ingram Unit 1 | `weapon_shield` | short | defensive | 15 | Warden | White-and-black police Ingram stencilled 1, red shoulder light bars, revolver and police shield | `special-vehicle-robot-unit/1.webp` |
| 2 | AV-98 Ingram Unit 2 | `single` | long | balanced | 15 | Deadeye | White-and-black police Ingram stencilled 2, red shoulder light bars, revolver drawn, police shield | `special-vehicle-robot-unit/2.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 AV-98 Ingram Unit 1 | Laser Pistol + Light Shield (₡108,000) | Volt Sabre + Aegis Bulwark (₡834,000) |
| 2 AV-98 Ingram Unit 2 | Beam Pistol (₡93,000) | Particle Lance (₡425,000) |

**Refinement plans** (generated; applied by Duo goal 17, Refine → 10 steps per robot). All 2 robots: 15 steps, ₡5,670,000; the 2 robots at the target: ₡5,670,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| AV-98 Ingram Unit 1 (10 steps, ₡2,860,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (8 → 9) ₡10,000 | ₡2,810,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |
| AV-98 Ingram Unit 2 (5 steps, ₡2,810,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (5 → 6) ₡10,000 | ₡2,810,000 |

Storage (estimate; the engine counts at run time): 3 final weapons equipped at the robots target of 2. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5), A04 ×1 (decision 4).

Source findings before decisions: A01 ×1, A03 ×2, A04 ×1, A11 ×1, A13 ×2, V13 ×2.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 75. Section Nine Tachikomas (`section-nine-tachikomas`) — Swarm

| Field | Value |
|---|---|
| Stable name | Section Nine Tachikomas |
| Franchise label | Ghost in the Shell |
| Backstory | Section Nine Tachikomas enters the arena with a clear doctrine. Repeatable agile tank robots with ranged builds. Every surviving machine returns to the workshop before the next booking. |
| Strategy | Swarm |
| Target overrides | none (goal 10 Robots → 11, the strategy default) |
| Team names | 2v2: **Batou's Ride** (robots 1+2), **Think Tanks** (3+4), **Tachikoma Days** (5+6), **Laughing Man Case** (7+8), **Niihama Patrol** (9+10) · 3v3: **Major's Recon** (1–3), **Individual Eleven Case** (4–6), **Stand Alone Complex** (7–9) |
| Event order | `league_3v3`, `league_2v2`, `grand_melee`, `koth`, `league_1v1`, `tag_team`, `tournament_3v3`, `tournament_2v2`, `tournament_1v1` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- 2v2 team 1+2: 'Section Nine Pair 01' → "Batou's Ride" (decisions 3, 18; delegated authoring)
- 2v2 team 3+4: 'Section Nine Pair 02' → 'Think Tanks' (decisions 3, 18; delegated authoring)
- 2v2 team 5+6: 'Section Nine Pair 03' → 'Tachikoma Days' (decisions 3, 18; delegated authoring)
- 2v2 team 7+8: 'Section Nine Pair 04' → 'Laughing Man Case' (decisions 3, 18; delegated authoring)
- 2v2 team 9+10: 'Section Nine Pair 05' → 'Niihama Patrol' (decisions 3, 18; delegated authoring)
- 3v3 team 1+2+3: 'Section Nine Squad 01' → "Major's Recon" (decisions 3, 18; delegated authoring)
- 3v3 team 4+5+6: 'Section Nine Squad 02' → 'Individual Eleven Case' (decisions 3, 18; delegated authoring)
- 3v3 team 7+8+9: 'Section Nine Squad 03' → 'Stand Alone Complex' (decisions 3, 18; delegated authoring)
- Slot 1 robot name: 'Tachikoma 01' → "Batou's Tachikoma" (decisions 3, 18; delegated authoring)
- Slot 1 art brief: 'Blue rounded spider-tank robot with articulated legs, white sensor spheres and central weapon.' → 'Blue Tachikoma stencilled 02, white sensor spheres, red rear optics, claw manipulator and chin gun' (decisions 3, 18; delegated authoring)
- Slot 1 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 2 art brief: 'Blue rounded spider-tank robot with reinforced cargo body and defensive equipment.' → 'Blue Tachikoma with three white sensor spheres, grabbing claw raised, long rifle on its right manipulator' (decisions 3, 18; delegated authoring)
- Slot 2 'Tachikoma 02': numbered name accepted as a mass-produced designation (decisions 3, 18; delegated authoring)
- Slot 2 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 3 art brief: 'Blue rounded spider-tank robot with articulated legs and a longer ranged emitter.' → 'Blue Tachikoma on wheeled feet, white sensor spheres, twin claw manipulators beside a chin cannon' (decisions 3, 18; delegated authoring)
- Slot 3 'Tachikoma 03': numbered name accepted as a mass-produced designation (decisions 3, 18; delegated authoring)
- Slot 3 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 4 art brief: 'Blue rounded spider-tank robot with articulated legs, white sensor spheres and central weapon. Arena unit 04 uses a distinct role-specific equipment silhouette.' → 'Blue Tachikoma stencilled 04 on its leg, white sensor spheres, chin cannon and a pair of claws' (decisions 3, 18; delegated authoring)
- Slot 4 'Tachikoma 04': numbered name accepted as a mass-produced designation (decisions 3, 18; delegated authoring)
- Slot 4 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 5 art brief: 'Blue rounded spider-tank robot with articulated legs, white sensor spheres and central weapon. Arena unit 05 uses a distinct role-specific equipment silhouette.' → 'Blue Tachikoma stencilled 05 on its pod, wide white sensor spheres, minigun between two claws' (decisions 3, 18; delegated authoring)
- Slot 5 'Tachikoma 05': numbered name accepted as a mass-produced designation (decisions 3, 18; delegated authoring)
- Slot 5 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 6 art brief: 'Blue rounded spider-tank robot with articulated legs, white sensor spheres and central weapon. Arena unit 06 uses a distinct role-specific equipment silhouette.' → 'Deep-blue Tachikoma, white sensor spheres, a claw on one side and a short rotary gun on the other' (decisions 3, 18; delegated authoring)
- Slot 6 'Tachikoma 06': numbered name accepted as a mass-produced designation (decisions 3, 18; delegated authoring)
- Slot 6 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 7 art brief: 'Blue rounded spider-tank robot with articulated legs, white sensor spheres and central weapon. Arena unit 07 uses a distinct role-specific equipment silhouette.' → 'Blue Tachikoma stencilled 07 on its pod, wheeled feet, chin cannon and twin-barrel arm gun' (decisions 3, 18; delegated authoring)
- Slot 7 'Tachikoma 07': numbered name accepted as a mass-produced designation (decisions 3, 18; delegated authoring)
- Slot 7 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 8 art brief: 'Blue rounded spider-tank robot with articulated legs, white sensor spheres and central weapon. Arena unit 08 uses a distinct role-specific equipment silhouette.' → 'Blue Tachikoma stencilled 08 with a chevron, minigun manipulator and a claw held low' (decisions 3, 18; delegated authoring)
- Slot 8 'Tachikoma 08': numbered name accepted as a mass-produced designation (decisions 3, 18; delegated authoring)
- Slot 8 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 9 art brief: 'Blue rounded spider-tank robot with articulated legs, white sensor spheres and central weapon. Arena unit 09 uses a distinct role-specific equipment silhouette.' → 'Blue Tachikoma with one large white sensor sphere forward, chin cannon and a red-tipped arm gun' (decisions 3, 18; delegated authoring)
- Slot 9 'Tachikoma 09': numbered name accepted as a mass-produced designation (decisions 3, 18; delegated authoring)
- Slot 9 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 10 art brief: 'Blue rounded spider-tank robot with articulated legs, white sensor spheres and central weapon. Arena unit 10 uses a distinct role-specific equipment silhouette.' → 'Blue Tachikoma stencilled 10 on its pod, white sensor spheres, chin cannon, a claw and a red-tipped arm gun' (decisions 3, 18; delegated authoring)
- Slot 10 'Tachikoma 10': numbered name accepted as a mass-produced designation (decisions 3, 18; delegated authoring)
- Slot 10 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 11 art brief: 'Blue rounded spider-tank robot with articulated legs, white sensor spheres and central weapon. Arena unit 11 uses a distinct role-specific equipment silhouette.' → 'Weathered blue Tachikoma stencilled 11, white sensor spheres, a claw and an arm gun raised' (decisions 3, 18; delegated authoring)
- Slot 11 'Tachikoma 11': numbered name accepted as a mass-produced designation (decisions 3, 18; delegated authoring)
- Slot 11 portrait: aligned (decisions 3, 18; delegated authoring)

Every blueprint is used at the robots target of 11; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Batou's Tachikoma | `single` | short | balanced | 15 | Sprinter | Blue Tachikoma stencilled 02, white sensor spheres, red rear optics, claw manipulator and chin gun | `section-nine-tachikomas/1.webp` |
| 2 | Tachikoma 02 | `weapon_shield` | mid | defensive | 20 | Warden | Blue Tachikoma with three white sensor spheres, grabbing claw raised, long rifle on its right manipulator | `section-nine-tachikomas/2.webp` |
| 3 | Tachikoma 03 | `single` | mid | balanced | 15 | Tactician | Blue Tachikoma on wheeled feet, white sensor spheres, twin claw manipulators beside a chin cannon | `section-nine-tachikomas/3.webp` |
| 4 | Tachikoma 04 | `weapon_shield` | short | defensive | 10 | Warden | Blue Tachikoma stencilled 04 on its leg, white sensor spheres, chin cannon and a pair of claws | `section-nine-tachikomas/4.webp` |
| 5 | Tachikoma 05 | `single` | long | balanced | 10 | Deadeye | Blue Tachikoma stencilled 05 on its pod, wide white sensor spheres, minigun between two claws | `section-nine-tachikomas/5.webp` |
| 6 | Tachikoma 06 | `single` | short | balanced | 10 | Versatile | Deep-blue Tachikoma, white sensor spheres, a claw on one side and a short rotary gun on the other | `section-nine-tachikomas/6.webp` |
| 7 | Tachikoma 07 | `single` | mid | balanced | 10 | Deadeye | Blue Tachikoma stencilled 07 on its pod, wheeled feet, chin cannon and twin-barrel arm gun | `section-nine-tachikomas/7.webp` |
| 8 | Tachikoma 08 | `weapon_shield` | short | defensive | 10 | Warden | Blue Tachikoma stencilled 08 with a chevron, minigun manipulator and a claw held low | `section-nine-tachikomas/8.webp` |
| 9 | Tachikoma 09 | `single` | long | balanced | 10 | Deadeye | Blue Tachikoma with one large white sensor sphere forward, chin cannon and a red-tipped arm gun | `section-nine-tachikomas/9.webp` |
| 10 | Tachikoma 10 | `single` | short | balanced | 10 | Versatile | Blue Tachikoma stencilled 10 on its pod, white sensor spheres, chin cannon, a claw and a red-tipped arm gun | `section-nine-tachikomas/10.webp` |
| 11 | Tachikoma 11 | `single` | mid | balanced | 10 | Deadeye | Weathered blue Tachikoma stencilled 11, white sensor spheres, a claw and an arm gun raised | `section-nine-tachikomas/11.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Batou's Tachikoma | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |
| 2 Tachikoma 02 | Bolt Carbine + Combat Shield (₡171,000) | Nova Caster + Aegis Bulwark (₡834,000) |
| 3 Tachikoma 03 | Bolt Carbine (₡93,000) | Nova Caster (₡425,000) |
| 4 Tachikoma 04 | Laser Pistol + Light Shield (₡108,000) | Volt Sabre + Aegis Bulwark (₡834,000) |
| 5 Tachikoma 05 | Beam Pistol (₡93,000) | Particle Lance (₡425,000) |
| 6 Tachikoma 06 | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |
| 7 Tachikoma 07 | Bolt Carbine (₡93,000) | Nova Caster (₡425,000) |
| 8 Tachikoma 08 | Laser Pistol + Light Shield (₡108,000) | Volt Sabre + Aegis Bulwark (₡834,000) |
| 9 Tachikoma 09 | Beam Pistol (₡93,000) | Particle Lance (₡425,000) |
| 10 Tachikoma 10 | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |
| 11 Tachikoma 11 | Bolt Carbine (₡93,000) | Nova Caster (₡425,000) |

**Refinement plans** (generated; applied by Swarm goal 23, Refine → 8 steps per robot). All 11 robots: 70 steps, ₡32,150,000; the 11 robots at the target: ₡32,150,000; Refine → 8 applies ₡32,090,000 of the target robots' plans.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Batou's Tachikoma (5 steps, ₡2,960,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Power Core +4 (−3 → 1) ₡160,000 | ₡2,960,000 |
| Tachikoma 02 (10 steps, ₡2,870,000) | Nova Caster (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Armor Plating +1 (new) ₡20,000 | ₡2,820,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |
| Tachikoma 03 (5 steps, ₡2,820,000) | Nova Caster (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Combat Algorithms +1 (new) ₡20,000 | ₡2,820,000 |
| Tachikoma 04 (10 steps, ₡2,870,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Armor Plating +1 (new) ₡20,000 | ₡2,820,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |
| Tachikoma 05 (5 steps, ₡2,960,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +4 (5 → 9) ₡160,000 | ₡2,960,000 |
| Tachikoma 06 (5 steps, ₡2,960,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| Tachikoma 07 (5 steps, ₡2,960,000) | Nova Caster (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| Tachikoma 08 (10 steps, ₡2,870,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Armor Plating +1 (new) ₡20,000 | ₡2,820,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |
| Tachikoma 09 (5 steps, ₡2,960,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +4 (5 → 9) ₡160,000 | ₡2,960,000 |
| Tachikoma 10 (5 steps, ₡2,960,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| Tachikoma 11 (5 steps, ₡2,960,000) | Nova Caster (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |

Storage (estimate; the engine counts at run time): 14 final weapons equipped at the robots target of 11. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need Storage Facility L2; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A04 ×1 (decision 4).

Source findings before decisions: A03 ×2, A04 ×1, A13 ×11, V13 ×11.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 76. Olympus Landmate Hangar (`olympus-landmate-hangar`) — Duo

| Field | Value |
|---|---|
| Stable name | Olympus Landmate Hangar |
| Franchise label | Appleseed |
| Backstory | Olympus Landmate Hangar enters the arena with a clear doctrine. Two heavy mechanical combat builds. Every surviving machine returns to the workshop before the next booking. |
| Strategy | Duo |
| Target overrides | none (goal 13 Robots → 2, the strategy default) |
| Team names | 2v2: **Olympus ESWAT** (robots 1+2) · 3v3: none |
| Event order | `league_2v2`, `tag_team`, `tournament_2v2`, `league_1v1`, `koth`, `grand_melee`, `tournament_1v1`, `league_3v3`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- 2v2 team 1+2: 'Olympus Pair 01' → 'Olympus ESWAT' (decision 3; delegated authoring)

Every blueprint is used at the robots target of 2; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Guges Landmate | `two_handed` | melee | balanced | 10 | Bruiser | Broad powered Landmate suit with secondary articulated arms, dense actuators and olive armour. | `olympus-landmate-hangar/1.webp` |
| 2 | Cadmos Landmate | `weapon_shield` | mid | defensive | 20 | Warden | Broad police Landmate suit with heavy service armour and protective equipment. | `olympus-landmate-hangar/2.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Guges Landmate | War Club (₡84,000) | Heavy Hammer (₡478,000) |
| 2 Cadmos Landmate | Bolt Carbine + Combat Shield (₡171,000) | Nova Caster + Aegis Bulwark (₡834,000) |

**Refinement plans** (generated; applied by Duo goal 17, Refine → 10 steps per robot). All 2 robots: 15 steps, ₡5,670,000; the 2 robots at the target: ₡5,670,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Guges Landmate (5 steps, ₡2,810,000) | Heavy Hammer (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (7 → 8) ₡10,000 | ₡2,810,000 |
| Cadmos Landmate (10 steps, ₡2,860,000) | Nova Caster (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (8 → 9) ₡10,000 | ₡2,810,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |

Storage (estimate; the engine counts at run time): 3 final weapons equipped at the robots target of 2. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5), A04 ×1 (decision 4).

Source findings before decisions: A01 ×1, A03 ×1, A04 ×1, A07 ×1, A11 ×1, V13 ×2.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 77. Photon Power Institute (`photon-power-institute`) — Duo

| Field | Value |
|---|---|
| Stable name | Photon Power Institute |
| Franchise label | Mazinger |
| Backstory | Photon Power Institute enters the arena with a clear doctrine. Two heavily invested combat machines. Every surviving machine returns to the workshop before the next booking. |
| Strategy | Duo |
| Target overrides | none (goal 13 Robots → 2, the strategy default) |
| Team names | 2v2: **Fortress of Science** (robots 1+2) · 3v3: none |
| Event order | `league_2v2`, `tag_team`, `tournament_2v2`, `league_1v1`, `koth`, `grand_melee`, `tournament_1v1`, `league_3v3`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- 2v2 team 1+2: 'Photon Power Pair 01' → 'Fortress of Science' (decision 3; delegated authoring)

Every blueprint is used at the robots target of 2; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Mazinger Z | `two_handed` | short | offensive | 5 | Bruiser | Heavy black-silver-red super robot with recognizable head details and broad chest plates. | `photon-power-institute/1.webp` |
| 2 | Great Mazinger | `two_handed` | melee | defensive | 5 | Warden | Heavy super robot with pointed head details, black-silver armour and red chest panels. | `photon-power-institute/2.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Mazinger Z | Scatter Cannon (₡84,000) | Arc Projector (₡488,000) |
| 2 Great Mazinger | War Club (₡84,000) | Heavy Hammer (₡478,000) |

**Refinement plans** (generated; applied by Duo goal 17, Refine → 10 steps per robot). All 2 robots: 10 steps, ₡5,620,000; the 2 robots at the target: ₡5,620,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Mazinger Z (5 steps, ₡2,810,000) | Arc Projector (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (7 → 8) ₡10,000 | ₡2,810,000 |
| Great Mazinger (5 steps, ₡2,810,000) | Heavy Hammer (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (7 → 8) ₡10,000 | ₡2,810,000 |

Storage (estimate; the engine counts at run time): 2 final weapons equipped at the robots target of 2. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5), A04 ×1 (decision 4).

Source findings before decisions: A01 ×1, A03 ×1, A04 ×1, A11 ×1, V13 ×2.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 78. Saotome Getter Laboratory (`saotome-getter-laboratory`) — Paragon

| Field | Value |
|---|---|
| Stable name | Saotome Getter Laboratory |
| Franchise label | Getter Robo |
| Backstory | Saotome Getter Laboratory enters the arena with a clear doctrine. A concentrated heavy combat build. Every surviving machine returns to the workshop before the next booking. |
| Strategy | Paragon |
| Target overrides | none (goal 8 Robots → 1, the strategy default) |
| Team names | 2v2: none · 3v3: none |
| Event order | `league_1v1`, `tournament_1v1`, `koth`, `grand_melee`, `league_2v2`, `tag_team`, `tournament_2v2`, `league_3v3`, `tournament_3v3` |

**Changes from your draft**: none.

Every blueprint is used at the robots target of 1; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Getter Robo | `two_handed` | melee | balanced | 0 | Bruiser | Getter-1-form flagship with red-white-green armour and a powerful mechanical body. | `saotome-getter-laboratory/1.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Getter Robo | Shock Maul (₡183,000) | Heavy Hammer (₡478,000) |

**Refinement plans** (generated; applied by Paragon goal 16, Refine → 10 steps per robot). The only blueprint: 4 steps, ₡2,800,000; the robot at the target: ₡2,800,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Getter Robo (4 steps, ₡2,800,000) | Heavy Hammer (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 | ₡2,800,000 |

Storage (estimate; the engine counts at run time): 1 final weapons equipped at the robots target of 1. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5), A04 ×1 (decision 4).

Source findings before decisions: A01 ×1, A04 ×1, A11 ×1, V13 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 79. Voltron Lion Hangar (`voltron-lion-hangar`) — Trio

| Field | Value |
|---|---|
| Stable name | Voltron Lion Hangar |
| Franchise label | Voltron |
| Backstory | Voltron Lion Hangar enters the arena with a clear doctrine. A mixed-role robot-lion squad. Every surviving machine returns to the workshop before the next booking. |
| Strategy | Trio |
| Target overrides | goal 12 Robots → 4 (strategy default 3, allowed 3–6) |
| Team names | 2v2: **Castle of Lions** (robots 1+2), **Paladins of Arus** (3+4) · 3v3: **Defenders of the Universe** (1–3) |
| Event order | `league_3v3`, `tournament_3v3`, `league_1v1`, `league_2v2`, `tag_team`, `koth`, `grand_melee`, `tournament_2v2`, `tournament_1v1` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- 2v2 team 1+2: 'Voltron Pair 01' → 'Castle of Lions' (decision 3; delegated authoring)
- 2v2 team 3+4: 'Voltron Pair 02' → 'Paladins of Arus' (decision 3; delegated authoring)
- 3v3 team 1+2+3: 'Voltron Squad 01' → 'Defenders of the Universe' (decision 3; delegated authoring)
- Goal 12 Robots target: 3 → 4 (decision 5)

Every blueprint is used at the robots target of 4; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Red Lion | `dual_wield` | melee | offensive | 5 | Sprinter | Red mechanical lion with articulated body, metallic jaws and compact armour plates. | `voltron-lion-hangar/1.webp` |
| 2 | Blue Lion | `single` | long | balanced | 15 | Deadeye | Blue mechanical lion with distinctive head, articulated legs and emitter-inspired equipment. | `voltron-lion-hangar/2.webp` |
| 3 | Yellow Lion | `weapon_shield` | melee | defensive | 10 | Warden | Broad yellow mechanical lion with heavy legs and defensive armour. | `voltron-lion-hangar/3.webp` |
| 4 | Green Lion | `single` | short | balanced | 15 | Tactician | Green mechanical lion with a lean body, compact armour and alert mechanical eyes. | `voltron-lion-hangar/4.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Red Lion | Combat Knife ×2 (₡186,000) | Vibro Mace ×2 (₡850,000) |
| 2 Blue Lion | Beam Pistol (₡93,000) | Particle Lance (₡425,000) |
| 3 Yellow Lion | Practice Sword + Light Shield (₡101,000) | Vibro Mace + Aegis Bulwark (₡834,000) |
| 4 Green Lion | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |

**Refinement plans** (generated; applied by Trio goal 22, Refine → 10 steps per robot). All 4 robots: 30 steps, ₡14,230,000; the 4 robots at the target: ₡14,230,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Red Lion (10 steps, ₡5,680,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 · 9 Hone Gyro Stabilizers +2 (4 → 6) ₡40,000 | ₡2,840,000 |
|  | Vibro Mace (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 · 10 Hone Gyro Stabilizers +2 (4 → 6) ₡40,000 | ₡2,840,000 |
| Blue Lion (5 steps, ₡2,840,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +2 (5 → 7) ₡40,000 | ₡2,840,000 |
| Yellow Lion (10 steps, ₡2,890,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Counter Protocols +2 (5 → 7) ₡40,000 | ₡2,840,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |
| Green Lion (5 steps, ₡2,820,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Combat Algorithms +1 (new) ₡20,000 | ₡2,820,000 |

Storage (estimate; the engine counts at run time): 6 final weapons equipped at the robots target of 4. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need Storage Facility L1; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5), A04 ×1 (decision 4).

Source findings before decisions: A03 ×1, A04 ×1, A08 ×1, A12 ×1, V13 ×4.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 80. Macross Valkyrie Squadron (`macross-valkyrie-squadron`) — Trio

| Field | Value |
|---|---|
| Stable name | Macross Valkyrie Squadron |
| Franchise label | Macross |
| Backstory | Macross Valkyrie Squadron enters the arena with a clear doctrine. Three mobile ranged mecha builds. Every surviving machine returns to the workshop before the next booking. |
| Strategy | Trio |
| Target overrides | none (goal 12 Robots → 3, the strategy default) |
| Team names | 2v2: **Skull Squadron** (robots 1+2) · 3v3: **Vermilion Squadron** (1–3) |
| Event order | `league_3v3`, `tournament_3v3`, `league_1v1`, `league_2v2`, `tag_team`, `koth`, `grand_melee`, `tournament_2v2`, `tournament_1v1` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- 2v2 team 1+2: 'Valkyrie Pair 01' → 'Skull Squadron' (decision 3; delegated authoring)
- 3v3 team 1+2+3: 'Valkyrie Squad 01' → 'Vermilion Squadron' (decision 3; delegated authoring)

Every blueprint is used at the robots target of 3; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | VF-1S | `dual_wield` | short | offensive | 10 | Versatile | White Valkyrie mecha in robot form with aircraft panels and distinctive multi-antenna head. | `macross-valkyrie-squadron/1.webp` |
| 2 | VF-1A | `single` | short | balanced | 15 | Sprinter | Valkyrie mecha in robot form with a simple head, aircraft-derived armour and squadron markings. | `macross-valkyrie-squadron/2.webp` |
| 3 | VF-1J | `single` | long | balanced | 10 | Deadeye | Valkyrie mecha in robot form with differentiated head detail and precision weapon. | `macross-valkyrie-squadron/3.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 VF-1S | Laser Pistol ×2 (₡114,000) | Volt Sabre ×2 (₡850,000) |
| 2 VF-1A | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |
| 3 VF-1J | Beam Pistol (₡93,000) | Particle Lance (₡425,000) |

**Refinement plans** (generated; applied by Trio goal 22, Refine → 10 steps per robot). All 3 robots: 20 steps, ₡11,240,000; the 3 robots at the target: ₡11,240,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| VF-1S (10 steps, ₡5,620,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 · 9 Hone Combat Power +1 (8 → 9) ₡10,000 | ₡2,810,000 |
|  | Volt Sabre (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 · 10 Hone Combat Power +1 (8 → 9) ₡10,000 | ₡2,810,000 |
| VF-1A (5 steps, ₡2,810,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Power Core +1 (−3 → −2) ₡10,000 | ₡2,810,000 |
| VF-1J (5 steps, ₡2,810,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (5 → 6) ₡10,000 | ₡2,810,000 |

Storage (estimate; the engine counts at run time): 4 final weapons equipped at the robots target of 3. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5), A04 ×1 (decision 4).

Source findings before decisions: A01 ×1, A03 ×1, A04 ×1, A11 ×1, V13 ×3.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 81. Knightmare Frame Foundry (`knightmare-frame-foundry`) — Trio

| Field | Value |
|---|---|
| Stable name | Knightmare Frame Foundry |
| Franchise label | Code Geass |
| Backstory | Knightmare Frame Foundry enters the arena with a clear doctrine. Fast, heavy, and defensive specialist frames. Every surviving machine returns to the workshop before the next booking. |
| Strategy | Trio |
| Target overrides | none (goal 12 Robots → 3, the strategy default) |
| Team names | 2v2: **Area 11 Rivals** (robots 1+2) · 3v3: **Zero Requiem** (1–3) |
| Event order | `league_3v3`, `tournament_3v3`, `league_1v1`, `league_2v2`, `tag_team`, `koth`, `grand_melee`, `tournament_2v2`, `tournament_1v1` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- 2v2 team 1+2: 'Knightmare Pair 01' → 'Area 11 Rivals' (decision 3; delegated authoring)
- 3v3 team 1+2+3: 'Knightmare Squad 01' → 'Zero Requiem' (decision 3; delegated authoring)

Every blueprint is used at the robots target of 3; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Lancelot | `dual_wield` | melee | offensive | 10 | Sprinter | White-gold Knightmare frame with articulated limbs, sharp armour and blade equipment. | `knightmare-frame-foundry/1.webp` |
| 2 | Guren Mk-II | `two_handed` | short | offensive | 5 | Bruiser | Red Knightmare frame with broad armour and an oversized mechanical right arm. | `knightmare-frame-foundry/2.webp` |
| 3 | Shinkiro | `weapon_shield` | mid | defensive | 15 | Tactician | Dark-gold Knightmare frame with geometric armour and a defensive equipment layout. | `knightmare-frame-foundry/3.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Lancelot | Combat Knife ×2 (₡186,000) | Vibro Mace ×2 (₡850,000) |
| 2 Guren Mk-II | Scatter Cannon (₡84,000) | Arc Projector (₡488,000) |
| 3 Shinkiro | Bolt Carbine + Combat Shield (₡171,000) | Nova Caster + Aegis Bulwark (₡834,000) |

**Refinement plans** (generated; applied by Trio goal 22, Refine → 10 steps per robot). All 3 robots: 25 steps, ₡11,290,000; the 3 robots at the target: ₡11,290,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Lancelot (10 steps, ₡5,620,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 · 9 Hone Gyro Stabilizers +1 (4 → 5) ₡10,000 | ₡2,810,000 |
|  | Vibro Mace (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 · 10 Hone Gyro Stabilizers +1 (4 → 5) ₡10,000 | ₡2,810,000 |
| Guren Mk-II (5 steps, ₡2,810,000) | Arc Projector (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (7 → 8) ₡10,000 | ₡2,810,000 |
| Shinkiro (10 steps, ₡2,860,000) | Nova Caster (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (8 → 9) ₡10,000 | ₡2,810,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |

Storage (estimate; the engine counts at run time): 5 final weapons equipped at the robots target of 3. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5), A04 ×1 (decision 4).

Source findings before decisions: A01 ×1, A03 ×1, A04 ×1, A11 ×1, V13 ×3.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 82. Dai Gurren Workshop (`dai-gurren-workshop`) — Duo

| Field | Value |
|---|---|
| Stable name | Dai Gurren Workshop |
| Franchise label | Gurren Lagann |
| Backstory | Dai Gurren Workshop enters the arena with a clear doctrine. A large durable partner and a small mobile partner. Every surviving machine returns to the workshop before the next booking. |
| Strategy | Duo |
| Target overrides | none (goal 13 Robots → 2, the strategy default) |
| Team names | 2v2: **Pierce the Heavens** (robots 1+2) · 3v3: none |
| Event order | `tag_team`, `league_2v2`, `tournament_2v2`, `league_1v1`, `koth`, `grand_melee`, `tournament_1v1`, `league_3v3`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- 2v2 team 1+2: 'Dai Gurren Pair 01' → 'Pierce the Heavens' (decision 3; delegated authoring)

Every blueprint is used at the robots target of 2; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Gurren | `two_handed` | melee | defensive | 10 | Warden | Large red Gunmen machine with a broad mechanical face-like torso and sturdy legs. | `dai-gurren-workshop/1.webp` |
| 2 | Lagann | `single` | melee | offensive | 5 | Sprinter | Small red-white Gunmen machine with a compact face-like body and drill-inspired equipment. | `dai-gurren-workshop/2.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Gurren | War Club (₡84,000) | Heavy Hammer (₡478,000) |
| 2 Lagann | Practice Sword (₡50,000) | Vibro Mace (₡425,000) |

**Refinement plans** (generated; applied by Duo goal 17, Refine → 10 steps per robot). All 2 robots: 10 steps, ₡5,620,000; the 2 robots at the target: ₡5,620,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Gurren (5 steps, ₡2,810,000) | Heavy Hammer (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (7 → 8) ₡10,000 | ₡2,810,000 |
| Lagann (5 steps, ₡2,810,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Gyro Stabilizers +1 (4 → 5) ₡10,000 | ₡2,810,000 |

Storage (estimate; the engine counts at run time): 2 final weapons equipped at the robots target of 2. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5), A04 ×1 (decision 4).

Source findings before decisions: A01 ×1, A03 ×1, A04 ×1, A11 ×1, V13 ×2.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 83. Paradigm Megadeus Hangar (`paradigm-megadeus-hangar`) — Paragon

| Field | Value |
|---|---|
| Stable name | Paradigm Megadeus Hangar |
| Franchise label | The Big O |
| Backstory | Paradigm Megadeus Hangar enters the arena with a clear doctrine. A slow, armoured melee flagship. Every surviving machine returns to the workshop before the next booking. |
| Strategy | Paragon |
| Target overrides | none (goal 8 Robots → 1, the strategy default) |
| Team names | 2v2: none · 3v3: none |
| Event order | `league_1v1`, `grand_melee`, `tournament_1v1`, `koth`, `league_2v2`, `tag_team`, `tournament_2v2`, `league_3v3`, `tournament_3v3` |

**Changes from your draft**: none.

Every blueprint is used at the robots target of 1; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Big O | `two_handed` | melee | defensive | 5 | Warden | Dark Megadeus with massive piston forearms, broad shoulders and restrained red accents. | `paradigm-megadeus-hangar/1.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Big O | Shock Maul (₡183,000) | Heavy Hammer (₡478,000) |

**Refinement plans** (generated; applied by Paragon goal 16, Refine → 10 steps per robot). The only blueprint: 4 steps, ₡2,800,000; the robot at the target: ₡2,800,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Big O (4 steps, ₡2,800,000) | Heavy Hammer (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 | ₡2,800,000 |

Storage (estimate; the engine counts at run time): 1 final weapons equipped at the robots target of 1. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5), A04 ×1 (decision 4).

Source findings before decisions: A01 ×1, A04 ×1, A11 ×1, V13 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 84. Giant Robo Command (`giant-robo-command`) — Paragon

| Field | Value |
|---|---|
| Stable name | Giant Robo Command |
| Franchise label | Giant Robo |
| Backstory | Giant Robo Command enters the arena with a clear doctrine. One durable heavy machine with major weapon investment. Every surviving machine returns to the workshop before the next booking. |
| Strategy | Paragon |
| Target overrides | none (goal 8 Robots → 1, the strategy default) |
| Team names | 2v2: none · 3v3: none |
| Event order | `league_1v1`, `tournament_1v1`, `koth`, `grand_melee`, `league_2v2`, `tag_team`, `tournament_2v2`, `league_3v3`, `tournament_3v3` |

**Changes from your draft**: none.

Every blueprint is used at the robots target of 1; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Giant Robo | `two_handed` | mid | defensive | 5 | Warden | Huge dark steel robot with recognizable head profile, broad chest and riveted military panels. | `giant-robo-command/1.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Giant Robo | Shotgun (₡283,000) | Plasma Cannon (₡408,000) |

**Refinement plans** (generated; applied by Paragon goal 16, Refine → 10 steps per robot). The only blueprint: 4 steps, ₡2,800,000; the robot at the target: ₡2,800,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Giant Robo (4 steps, ₡2,800,000) | Plasma Cannon (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 | ₡2,800,000 |

Storage (estimate; the engine counts at run time): 1 final weapons equipped at the robots target of 1. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5), A04 ×1 (decision 4).

Source findings before decisions: A01 ×1, A04 ×1, A11 ×1, V13 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 85. Zoids Arena Forge (`zoids-arena-forge`) — Generalist

| Field | Value |
|---|---|
| Stable name | Zoids Arena Forge |
| Franchise label | Zoids |
| Backstory | Zoids Arena Forge enters the arena with a clear doctrine. A balanced mechanical-animal roster. Every surviving machine returns to the workshop before the next booking. |
| Strategy | Generalist |
| Target overrides | goal 14 Robots → 3 (strategy default 2, allowed 2–4) |
| Team names | 2v2: **Backdraft Group** (robots 1+2) · 3v3: **Guardian Force** (1–3) |
| Event order | `league_1v1`, `league_2v2`, `league_3v3`, `tag_team`, `koth`, `grand_melee`, `tournament_1v1`, `tournament_2v2`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- 2v2 team 1+2: 'Zoids Pair 01' → 'Backdraft Group' (decision 3; delegated authoring)
- 3v3 team 1+2+3: 'Zoids Squad 01' → 'Guardian Force' (decision 3; delegated authoring)

Every blueprint is used at the robots target of 3; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Shield Liger | `weapon_shield` | melee | defensive | 15 | Warden | Blue biomechanical lion machine with armoured mane, articulated legs and shield-inspired gear. | `zoids-arena-forge/1.webp` |
| 2 | Geno Saurer | `two_handed` | mid | offensive | 5 | Bruiser | Dark biomechanical dinosaur with heavy articulated legs and prominent weapon pods. | `zoids-arena-forge/2.webp` |
| 3 | Command Wolf | `single` | short | balanced | 20 | Sprinter | Lean biomechanical wolf machine with mounted ranged equipment and visible mechanical joints. | `zoids-arena-forge/3.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Shield Liger | Practice Sword + Light Shield (₡101,000) | Vibro Mace + Aegis Bulwark (₡834,000) |
| 2 Geno Saurer | Training Rifle (₡50,000) | Plasma Cannon (₡408,000) |
| 3 Command Wolf | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |

**Refinement plans** (generated; applied by Generalist goal 18, Refine → 10 steps per robot). All 3 robots: 20 steps, ₡8,570,000; the 3 robots at the target: ₡8,570,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Shield Liger (10 steps, ₡2,890,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Counter Protocols +2 (5 → 7) ₡40,000 | ₡2,840,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |
| Geno Saurer (5 steps, ₡2,840,000) | Plasma Cannon (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +2 (7 → 9) ₡40,000 | ₡2,840,000 |
| Command Wolf (5 steps, ₡2,840,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Power Core +2 (−3 → −1) ₡40,000 | ₡2,840,000 |

Storage (estimate; the engine counts at run time): 4 final weapons equipped at the robots target of 3. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5), A04 ×1 (decision 4).

Source findings before decisions: A01 ×1, A03 ×1, A04 ×1, A07 ×1, A11 ×1, V08 ×1, V13 ×3.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 86. Hero Factory Assembly (`hero-factory-assembly`) — Trio

| Field | Value |
|---|---|
| Stable name | Hero Factory Assembly |
| Franchise label | Hero Factory |
| Backstory | Hero Factory Assembly enters the arena with a clear doctrine. Mobile attacker, defensive anchor, heavy fighter. Every surviving machine returns to the workshop before the next booking. |
| Strategy | Trio |
| Target overrides | none (goal 12 Robots → 3, the strategy default) |
| Team names | 2v2: **Rise of the Rookies** (robots 1+2) · 3v3: **Alpha 1 Team** (1–3) |
| Event order | `league_3v3`, `tournament_3v3`, `league_1v1`, `league_2v2`, `tag_team`, `koth`, `grand_melee`, `tournament_2v2`, `tournament_1v1` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- 2v2 team 1+2: 'Hero Factory Pair 01' → 'Rise of the Rookies' (decision 3; delegated authoring)
- 3v3 team 1+2+3: 'Hero Factory Squad 01' → 'Alpha 1 Team' (decision 3; delegated authoring)

Every blueprint is used at the robots target of 3; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Furno | `dual_wield` | short | offensive | 10 | Sprinter | Red Hero Factory robot with articulated limbs, recognizable helmet and orange power core. | `hero-factory-assembly/1.webp` |
| 2 | Stormer | `weapon_shield` | short | defensive | 15 | Warden | White Hero Factory robot with broad armour, blue details and a defensive stance. | `hero-factory-assembly/2.webp` |
| 3 | Bulk | `two_handed` | melee | balanced | 5 | Bruiser | Silver Hero Factory robot with reinforced limbs, broad armour and a heavy equipment layout. | `hero-factory-assembly/3.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Furno | Laser Pistol ×2 (₡114,000) | Volt Sabre ×2 (₡850,000) |
| 2 Stormer | Laser Pistol + Light Shield (₡108,000) | Volt Sabre + Aegis Bulwark (₡834,000) |
| 3 Bulk | War Club (₡84,000) | Heavy Hammer (₡478,000) |

**Refinement plans** (generated; applied by Trio goal 22, Refine → 10 steps per robot). All 3 robots: 25 steps, ₡11,290,000; the 3 robots at the target: ₡11,290,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Furno (10 steps, ₡5,620,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 · 9 Hone Power Core +1 (−3 → −2) ₡10,000 | ₡2,810,000 |
|  | Volt Sabre (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 · 10 Hone Power Core +1 (−3 → −2) ₡10,000 | ₡2,810,000 |
| Stormer (10 steps, ₡2,860,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (8 → 9) ₡10,000 | ₡2,810,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |
| Bulk (5 steps, ₡2,810,000) | Heavy Hammer (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (7 → 8) ₡10,000 | ₡2,810,000 |

Storage (estimate; the engine counts at run time): 5 final weapons equipped at the robots target of 3. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5), A04 ×1 (decision 4).

Source findings before decisions: A01 ×1, A03 ×1, A04 ×1, A11 ×1, V13 ×3.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 87. Nindroid Assembly Line (`nindroid-assembly-line`) — Swarm

| Field | Value |
|---|---|
| Stable name | Nindroid Assembly Line |
| Franchise label | Ninjago |
| Backstory | Nindroid Assembly Line enters the arena with a clear doctrine. Numerous agile melee-oriented machines. Every surviving machine returns to the workshop before the next booking. |
| Strategy | Swarm |
| Target overrides | none (goal 10 Robots → 11, the strategy default) |
| Team names | 2v2: **Overlord's Vanguard** (robots 1+2), **Techno Blade Hunters** (3+4), **Borg Industries** (5+6), **New Ninjago Patrol** (7+8), **Digiverse Breach** (9+10) · 3v3: **Nindroid Army** (1–3), **Titanium Legacy** (4–6), **Rebooted Legion** (7–9) |
| Event order | `league_3v3`, `league_2v2`, `grand_melee`, `koth`, `league_1v1`, `tag_team`, `tournament_3v3`, `tournament_2v2`, `tournament_1v1` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- 2v2 team 1+2: 'Nindroid Pair 01' → "Overlord's Vanguard" (decisions 3, 18; delegated authoring)
- 2v2 team 3+4: 'Nindroid Pair 02' → 'Techno Blade Hunters' (decisions 3, 18; delegated authoring)
- 2v2 team 5+6: 'Nindroid Pair 03' → 'Borg Industries' (decisions 3, 18; delegated authoring)
- 2v2 team 7+8: 'Nindroid Pair 04' → 'New Ninjago Patrol' (decisions 3, 18; delegated authoring)
- 2v2 team 9+10: 'Nindroid Pair 05' → 'Digiverse Breach' (decisions 3, 18; delegated authoring)
- 3v3 team 1+2+3: 'Nindroid Squad 01' → 'Nindroid Army' (decisions 3, 18; delegated authoring)
- 3v3 team 4+5+6: 'Nindroid Squad 02' → 'Titanium Legacy' (decisions 3, 18; delegated authoring)
- 3v3 team 7+8+9: 'Nindroid Squad 03' → 'Rebooted Legion' (decisions 3, 18; delegated authoring)
- Slot 3 art brief: 'Black-grey robotic ninja with red optics, articulated limbs and paired blade equipment.' → 'Black-grey Nindroid with a tattered neck scarf and sash, twin red optics, a katana in each hand' (decisions 3, 18; delegated authoring)
- Slot 3 'Nindroid 03': numbered name accepted as a mass-produced designation (decisions 3, 18; delegated authoring)
- Slot 3 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 4 art brief: 'Black-grey robotic ninja with red optics, articulated limbs and paired blade equipment. Arena unit 04 uses a distinct role-specific equipment silhouette.' → 'Black Nindroid stencilled 04, red slit visor, red side lens, grey sash, two long katanas drawn' (decisions 3, 18; delegated authoring)
- Slot 4 'Nindroid 04': numbered name accepted as a mass-produced designation (decisions 3, 18; delegated authoring)
- Slot 4 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 5 art brief: 'Black-grey robotic ninja with red optics, articulated limbs and paired blade equipment. Arena unit 05 uses a distinct role-specific equipment silhouette.' → 'Black-and-silver Nindroid stencilled 05, crested helm, red eyes, curved blade in each fist' (decisions 3, 18; delegated authoring)
- Slot 5 'Nindroid 05': numbered name accepted as a mass-produced designation (decisions 3, 18; delegated authoring)
- Slot 5 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 6 art brief: 'Black-grey robotic ninja with red optics, articulated limbs and paired blade equipment. Arena unit 06 uses a distinct role-specific equipment silhouette.' → 'Black Nindroid stencilled 06, trailing headband, red optics, red chest core, twin katanas' (decisions 3, 18; delegated authoring)
- Slot 6 'Nindroid 06': numbered name accepted as a mass-produced designation (decisions 3, 18; delegated authoring)
- Slot 6 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 7 art brief: 'Black-grey robotic ninja with red optics, articulated limbs and paired blade equipment. Arena unit 07 uses a distinct role-specific equipment silhouette.' → 'Slim glossy-black Nindroid, rounded helm, red visor, red shoulder core, two curved sabres' (decisions 3, 18; delegated authoring)
- Slot 7 'Nindroid 07': numbered name accepted as a mass-produced designation (decisions 3, 18; delegated authoring)
- Slot 7 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 8 art brief: 'Black-grey robotic ninja with red optics, articulated limbs and paired blade equipment. Arena unit 08 uses a distinct role-specific equipment silhouette.' → 'Bulky black Nindroid stencilled 08, red visor, red chest core, katanas held high and low' (decisions 3, 18; delegated authoring)
- Slot 8 'Nindroid 08': numbered name accepted as a mass-produced designation (decisions 3, 18; delegated authoring)
- Slot 8 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 9 art brief: 'Black-grey robotic ninja with red optics, articulated limbs and paired blade equipment. Arena unit 09 uses a distinct role-specific equipment silhouette.' → 'Lean grey-black Nindroid, red slit visor, red chest core, red-lined blades in both hands' (decisions 3, 18; delegated authoring)
- Slot 9 'Nindroid 09': numbered name accepted as a mass-produced designation (decisions 3, 18; delegated authoring)
- Slot 9 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 10 art brief: 'Black-grey robotic ninja with red optics, articulated limbs and paired blade equipment. Arena unit 10 uses a distinct role-specific equipment silhouette.' → 'Black Nindroid with a hood scarf, red multi-lens headset, red chest core, two katanas' (decisions 3, 18; delegated authoring)
- Slot 10 'Nindroid 10': numbered name accepted as a mass-produced designation (decisions 3, 18; delegated authoring)
- Slot 10 portrait: aligned (decisions 3, 18; delegated authoring)
- Slot 11 art brief: 'Black-grey robotic ninja with red optics, articulated limbs and paired blade equipment. Arena unit 11 uses a distinct role-specific equipment silhouette.' → 'Black Nindroid stencilled 11, torn red-lined cape, red lens cluster, twin curved blades' (decisions 3, 18; delegated authoring)
- Slot 11 'Nindroid 11': numbered name accepted as a mass-produced designation (decisions 3, 18; delegated authoring)
- Slot 11 portrait: aligned (decisions 3, 18; delegated authoring)

Every blueprint is used at the robots target of 11; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | General Cryptor | `dual_wield` | melee | offensive | 5 | Tactician | Black-grey robotic ninja commander with mechanical mask, red optics and layered armour. | `nindroid-assembly-line/1.webp` |
| 2 | Min-Droid | `single` | melee | offensive | 15 | Sprinter | Small black-grey robotic ninja with compact mechanical mask and red optics. | `nindroid-assembly-line/2.webp` |
| 3 | Nindroid 03 | `dual_wield` | melee | offensive | 5 | Sprinter | Black-grey Nindroid with a tattered neck scarf and sash, twin red optics, a katana in each hand | `nindroid-assembly-line/3.webp` |
| 4 | Nindroid 04 | `single` | short | balanced | 10 | Versatile | Black Nindroid stencilled 04, red slit visor, red side lens, grey sash, two long katanas drawn | `nindroid-assembly-line/4.webp` |
| 5 | Nindroid 05 | `single` | long | balanced | 10 | Deadeye | Black-and-silver Nindroid stencilled 05, crested helm, red eyes, curved blade in each fist | `nindroid-assembly-line/5.webp` |
| 6 | Nindroid 06 | `weapon_shield` | short | defensive | 10 | Warden | Black Nindroid stencilled 06, trailing headband, red optics, red chest core, twin katanas | `nindroid-assembly-line/6.webp` |
| 7 | Nindroid 07 | `single` | mid | balanced | 10 | Deadeye | Slim glossy-black Nindroid, rounded helm, red visor, red shoulder core, two curved sabres | `nindroid-assembly-line/7.webp` |
| 8 | Nindroid 08 | `two_handed` | short | offensive | 10 | Bruiser | Bulky black Nindroid stencilled 08, red visor, red chest core, katanas held high and low | `nindroid-assembly-line/8.webp` |
| 9 | Nindroid 09 | `dual_wield` | melee | offensive | 10 | Sprinter | Lean grey-black Nindroid, red slit visor, red chest core, red-lined blades in both hands | `nindroid-assembly-line/9.webp` |
| 10 | Nindroid 10 | `two_handed` | mid | offensive | 10 | Bruiser | Black Nindroid with a hood scarf, red multi-lens headset, red chest core, two katanas | `nindroid-assembly-line/10.webp` |
| 11 | Nindroid 11 | `two_handed` | long | defensive | 10 | Deadeye | Black Nindroid stencilled 11, torn red-lined cape, red lens cluster, twin curved blades | `nindroid-assembly-line/11.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 General Cryptor | Combat Knife ×2 (₡186,000) | Vibro Mace ×2 (₡850,000) |
| 2 Min-Droid | Practice Sword (₡50,000) | Vibro Mace (₡425,000) |
| 3 Nindroid 03 | Combat Knife ×2 (₡186,000) | Vibro Mace ×2 (₡850,000) |
| 4 Nindroid 04 | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |
| 5 Nindroid 05 | Beam Pistol (₡93,000) | Particle Lance (₡425,000) |
| 6 Nindroid 06 | Laser Pistol + Light Shield (₡108,000) | Volt Sabre + Aegis Bulwark (₡834,000) |
| 7 Nindroid 07 | Bolt Carbine (₡93,000) | Nova Caster (₡425,000) |
| 8 Nindroid 08 | Scatter Cannon (₡84,000) | Arc Projector (₡488,000) |
| 9 Nindroid 09 | Combat Knife ×2 (₡186,000) | Vibro Mace ×2 (₡850,000) |
| 10 Nindroid 10 | Training Rifle (₡50,000) | Plasma Cannon (₡408,000) |
| 11 Nindroid 11 | Training Beam (₡50,000) | Ion Beam (₡544,000) |

**Refinement plans** (generated; applied by Swarm goal 23, Refine → 8 steps per robot). All 11 robots: 75 steps, ₡41,070,000; the 11 robots at the target: ₡41,070,000; Refine → 8 applies ₡40,370,000 of the target robots' plans.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| General Cryptor (10 steps, ₡5,640,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 · 9 Augment Combat Algorithms +1 (new) ₡20,000 | ₡2,820,000 |
|  | Vibro Mace (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 · 10 Augment Combat Algorithms +1 (new) ₡20,000 | ₡2,820,000 |
| Min-Droid (5 steps, ₡2,960,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Gyro Stabilizers +4 (4 → 8) ₡160,000 | ₡2,960,000 |
| Nindroid 03 (10 steps, ₡5,920,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 · 9 Hone Gyro Stabilizers +4 (4 → 8) ₡160,000 | ₡2,960,000 |
|  | Vibro Mace (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 · 10 Hone Gyro Stabilizers +4 (4 → 8) ₡160,000 | ₡2,960,000 |
| Nindroid 04 (5 steps, ₡2,960,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| Nindroid 05 (5 steps, ₡2,960,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +4 (5 → 9) ₡160,000 | ₡2,960,000 |
| Nindroid 06 (10 steps, ₡2,870,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Armor Plating +1 (new) ₡20,000 | ₡2,820,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |
| Nindroid 07 (5 steps, ₡2,960,000) | Nova Caster (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| Nindroid 08 (5 steps, ₡2,960,000) | Arc Projector (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| Nindroid 09 (10 steps, ₡5,920,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 · 9 Hone Gyro Stabilizers +4 (4 → 8) ₡160,000 | ₡2,960,000 |
|  | Vibro Mace (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 · 10 Hone Gyro Stabilizers +4 (4 → 8) ₡160,000 | ₡2,960,000 |
| Nindroid 10 (5 steps, ₡2,960,000) | Plasma Cannon (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Critical Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| Nindroid 11 (5 steps, ₡2,960,000) | Ion Beam (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (4 → 8) ₡160,000 | ₡2,960,000 |

Storage (estimate; the engine counts at run time): 15 final weapons equipped at the robots target of 11. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need Storage Facility L2; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A04 ×1 (decision 4).

Source findings before decisions: A03 ×2, A04 ×1, A13 ×9, V13 ×11.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 88. Gobotron Guardian Fleet (`gobotron-guardian-fleet`) — Trio

| Field | Value |
|---|---|
| Stable name | Gobotron Guardian Fleet |
| Franchise label | GoBots |
| Backstory | Gobotron Guardian Fleet enters the arena with a clear doctrine. Mixed-role transforming-machine designs presented in robot form. Every surviving machine returns to the workshop before the next booking. |
| Strategy | Trio |
| Target overrides | none (goal 12 Robots → 3, the strategy default) |
| Team names | 2v2: **Guardian Command** (robots 1+2) · 3v3: **Command Center Crew** (1–3) |
| Event order | `league_3v3`, `tournament_3v3`, `league_1v1`, `league_2v2`, `tag_team`, `koth`, `grand_melee`, `tournament_2v2`, `tournament_1v1` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- 2v2 team 1+2: 'Gobotron Pair 01' → 'Guardian Command' (decision 3; delegated authoring)
- 3v3 team 1+2+3: 'Gobotron Squad 01' → 'Command Center Crew' (decision 3; delegated authoring)

Every blueprint is used at the robots target of 3; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Leader-1 | `single` | long | balanced | 10 | Versatile | Grey aircraft-derived Guardian robot with wing details and a recognizable mechanical head. | `gobotron-guardian-fleet/1.webp` |
| 2 | Turbo | `two_handed` | melee | balanced | 10 | Bruiser | Red vehicle-derived Guardian robot with broad shoulders and heavy mechanical limbs. | `gobotron-guardian-fleet/2.webp` |
| 3 | Scooter | `single` | short | balanced | 25 | Sprinter | Small orange vehicle-derived Guardian robot with compact body and distinctive head. | `gobotron-guardian-fleet/3.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Leader-1 | Beam Pistol (₡93,000) | Particle Lance (₡425,000) |
| 2 Turbo | War Club (₡84,000) | Heavy Hammer (₡478,000) |
| 3 Scooter | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |

**Refinement plans** (generated; applied by Trio goal 22, Refine → 10 steps per robot). All 3 robots: 15 steps, ₡8,430,000; the 3 robots at the target: ₡8,430,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Leader-1 (5 steps, ₡2,810,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (5 → 6) ₡10,000 | ₡2,810,000 |
| Turbo (5 steps, ₡2,810,000) | Heavy Hammer (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (7 → 8) ₡10,000 | ₡2,810,000 |
| Scooter (5 steps, ₡2,810,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Power Core +1 (−3 → −2) ₡10,000 | ₡2,810,000 |

Storage (estimate; the engine counts at run time): 3 final weapons equipped at the robots target of 3. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5), A04 ×1 (decision 4).

Source findings before decisions: A01 ×1, A03 ×1, A04 ×1, A11 ×1, V13 ×3.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 89. Ultron Sentry Network (`ultron-sentry-network`) — Swarm

| Field | Value |
|---|---|
| Stable name | Ultron Sentry Network |
| Franchise label | Marvel — Ultron |
| Backstory | Ultron Sentry Network enters the arena with a clear doctrine. A menacing machine army with a lead unit and lighter frames. Every surviving machine returns to the workshop before the next booking. |
| Strategy | Swarm |
| Target overrides | none (goal 10 Robots → 11, the strategy default) |
| Team names | 2v2: **Age of Ultron** (robots 1+2), **Iron Legion** (3+4), **Bride of Ultron** (5+6), **Rage of Ultron** (7+8), **Sokovia Swarm** (9+10) · 3v3: **Ultron Unlimited** (1–3), **Masters of Evil** (4–6), **Ultron Forever** (7–9) |
| Event order | `league_1v1`, `league_3v3`, `league_2v2`, `grand_melee`, `koth`, `tag_team`, `tournament_3v3`, `tournament_2v2`, `tournament_1v1` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- Franchise label: 'Marvel' → 'Marvel — Ultron' (decisions 3, 7, 18; delegated authoring)
- 2v2 team 1+2: 'Ultron Pair 01' → 'Age of Ultron' (decisions 3, 7, 18; delegated authoring)
- 2v2 team 3+4: 'Ultron Pair 02' → 'Iron Legion' (decisions 3, 7, 18; delegated authoring)
- 2v2 team 5+6: 'Ultron Pair 03' → 'Bride of Ultron' (decisions 3, 7, 18; delegated authoring)
- 2v2 team 7+8: 'Ultron Pair 04' → 'Rage of Ultron' (decisions 3, 7, 18; delegated authoring)
- 2v2 team 9+10: 'Ultron Pair 05' → 'Sokovia Swarm' (decisions 3, 7, 18; delegated authoring)
- 3v3 team 1+2+3: 'Ultron Squad 01' → 'Ultron Unlimited' (decisions 3, 7, 18; delegated authoring)
- 3v3 team 4+5+6: 'Ultron Squad 02' → 'Masters of Evil' (decisions 3, 7, 18; delegated authoring)
- 3v3 team 7+8+9: 'Ultron Squad 03' → 'Ultron Forever' (decisions 3, 7, 18; delegated authoring)
- Slot 2 art brief: 'Gunmetal humanoid sentry with red optics, narrow limbs and compact emitter equipment.' → 'Lean gunmetal Ultron sentry, red eyes and glowing seams, unarmed with clawed hands' (decisions 3, 7, 18; delegated authoring)
- Slot 2 'Ultron Sentry 02': numbered name accepted as a mass-produced designation (decisions 3, 7, 18; delegated authoring)
- Slot 2 portrait: aligned (decisions 3, 7, 18; delegated authoring)
- Slot 3 art brief: 'Gunmetal humanoid sentry with red optics and reinforced defensive forearm equipment.' → 'Chrome Ultron sentry with curved red-lit armour guards on both forearms, clawed hands' (decisions 3, 7, 18; delegated authoring)
- Slot 3 'Ultron Sentry 03': numbered name accepted as a mass-produced designation (decisions 3, 7, 18; delegated authoring)
- Slot 3 portrait: aligned (decisions 3, 7, 18; delegated authoring)
- Slot 4 art brief: 'Gunmetal humanoid sentry with red optics, narrow limbs and compact emitter equipment. Arena unit 04 uses a distinct role-specific equipment silhouette.' → 'Gunmetal Ultron sentry, red eyes, red-glowing cannon barrel fitted to its right forearm' (decisions 3, 7, 18; delegated authoring)
- Slot 4 'Ultron Sentry 04': numbered name accepted as a mass-produced designation (decisions 3, 7, 18; delegated authoring)
- Slot 4 portrait: aligned (decisions 3, 7, 18; delegated authoring)
- Slot 5 art brief: 'Gunmetal humanoid sentry with red optics, narrow limbs and compact emitter equipment. Arena unit 05 uses a distinct role-specific equipment silhouette.' → 'Hunched gunmetal Ultron sentry, red crest fins, red-cored arm cannon, clawed left hand' (decisions 3, 7, 18; delegated authoring)
- Slot 5 'Ultron Sentry 05': numbered name accepted as a mass-produced designation (decisions 3, 7, 18; delegated authoring)
- Slot 5 portrait: aligned (decisions 3, 7, 18; delegated authoring)
- Slot 6 art brief: 'Gunmetal humanoid sentry with red optics, narrow limbs and compact emitter equipment. Arena unit 06 uses a distinct role-specific equipment silhouette.' → 'Slim chrome Ultron sentry, red-lit chest seam, compact red-cored gun on its left forearm' (decisions 3, 7, 18; delegated authoring)
- Slot 6 'Ultron Sentry 06': numbered name accepted as a mass-produced designation (decisions 3, 7, 18; delegated authoring)
- Slot 6 portrait: aligned (decisions 3, 7, 18; delegated authoring)
- Slot 7 art brief: 'Gunmetal humanoid sentry with red optics, narrow limbs and compact emitter equipment. Arena unit 07 uses a distinct role-specific equipment silhouette.' → 'Broad dark-gunmetal Ultron sentry, red-lit gauntlets on both forearms, clawed hands' (decisions 3, 7, 18; delegated authoring)
- Slot 7 'Ultron Sentry 07': numbered name accepted as a mass-produced designation (decisions 3, 7, 18; delegated authoring)
- Slot 7 portrait: aligned (decisions 3, 7, 18; delegated authoring)
- Slot 8 art brief: 'Gunmetal humanoid sentry with red optics, narrow limbs and compact emitter equipment. Arena unit 08 uses a distinct role-specific equipment silhouette.' → 'Chrome Ultron sentry with a ribbed chest, chunky red-lit cannon on its right forearm' (decisions 3, 7, 18; delegated authoring)
- Slot 8 'Ultron Sentry 08': numbered name accepted as a mass-produced designation (decisions 3, 7, 18; delegated authoring)
- Slot 8 portrait: aligned (decisions 3, 7, 18; delegated authoring)
- Slot 9 art brief: 'Gunmetal humanoid sentry with red optics, narrow limbs and compact emitter equipment. Arena unit 09 uses a distinct role-specific equipment silhouette.' → 'Lean dark-chrome Ultron sentry, red eyes, red-lit thigh seams, small wrist gun on the right' (decisions 3, 7, 18; delegated authoring)
- Slot 9 'Ultron Sentry 09': numbered name accepted as a mass-produced designation (decisions 3, 7, 18; delegated authoring)
- Slot 9 portrait: aligned (decisions 3, 7, 18; delegated authoring)
- Slot 10 art brief: 'Gunmetal humanoid sentry with red optics, narrow limbs and compact emitter equipment. Arena unit 10 uses a distinct role-specific equipment silhouette.' → 'Tall chrome Ultron sentry, finned crest, red eyes, red-lit bracers on both forearms' (decisions 3, 7, 18; delegated authoring)
- Slot 10 'Ultron Sentry 10': numbered name accepted as a mass-produced designation (decisions 3, 7, 18; delegated authoring)
- Slot 10 portrait: aligned (decisions 3, 7, 18; delegated authoring)
- Slot 11 art brief: 'Gunmetal humanoid sentry with red optics, narrow limbs and compact emitter equipment. Arena unit 11 uses a distinct role-specific equipment silhouette.' → 'Hunched chrome Ultron sentry, spined crest, red eyes, multi-barrel red-cored arm cannon' (decisions 3, 7, 18; delegated authoring)
- Slot 11 'Ultron Sentry 11': numbered name accepted as a mass-produced designation (decisions 3, 7, 18; delegated authoring)
- Slot 11 portrait: aligned (decisions 3, 7, 18; delegated authoring)

Every blueprint is used at the robots target of 11; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Ultron | `two_handed` | mid | offensive | 0 | Tactician | Layered gunmetal villain robot with a skeletal face, red internal light and heavy arm assemblies. | `ultron-sentry-network/1.webp` |
| 2 | Ultron Sentry 02 | `single` | short | offensive | 0 | Versatile | Lean gunmetal Ultron sentry, red eyes and glowing seams, unarmed with clawed hands | `ultron-sentry-network/2.webp` |
| 3 | Ultron Sentry 03 | `weapon_shield` | short | defensive | 0 | Warden | Chrome Ultron sentry with curved red-lit armour guards on both forearms, clawed hands | `ultron-sentry-network/3.webp` |
| 4 | Ultron Sentry 04 | `weapon_shield` | short | defensive | 0 | Warden | Gunmetal Ultron sentry, red eyes, red-glowing cannon barrel fitted to its right forearm | `ultron-sentry-network/4.webp` |
| 5 | Ultron Sentry 05 | `single` | long | balanced | 0 | Deadeye | Hunched gunmetal Ultron sentry, red crest fins, red-cored arm cannon, clawed left hand | `ultron-sentry-network/5.webp` |
| 6 | Ultron Sentry 06 | `single` | short | balanced | 0 | Versatile | Slim chrome Ultron sentry, red-lit chest seam, compact red-cored gun on its left forearm | `ultron-sentry-network/6.webp` |
| 7 | Ultron Sentry 07 | `two_handed` | mid | offensive | 0 | Bruiser | Broad dark-gunmetal Ultron sentry, red-lit gauntlets on both forearms, clawed hands | `ultron-sentry-network/7.webp` |
| 8 | Ultron Sentry 08 | `weapon_shield` | short | defensive | 0 | Warden | Chrome Ultron sentry with a ribbed chest, chunky red-lit cannon on its right forearm | `ultron-sentry-network/8.webp` |
| 9 | Ultron Sentry 09 | `single` | long | balanced | 0 | Deadeye | Lean dark-chrome Ultron sentry, red eyes, red-lit thigh seams, small wrist gun on the right | `ultron-sentry-network/9.webp` |
| 10 | Ultron Sentry 10 | `single` | short | balanced | 0 | Versatile | Tall chrome Ultron sentry, finned crest, red eyes, red-lit bracers on both forearms | `ultron-sentry-network/10.webp` |
| 11 | Ultron Sentry 11 | `two_handed` | mid | offensive | 0 | Bruiser | Hunched chrome Ultron sentry, spined crest, red eyes, multi-barrel red-cored arm cannon | `ultron-sentry-network/11.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Ultron | Training Rifle (₡50,000) | Plasma Cannon (₡408,000) |
| 2 Ultron Sentry 02 | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |
| 3 Ultron Sentry 03 | Laser Pistol + Light Shield (₡108,000) | Volt Sabre + Aegis Bulwark (₡834,000) |
| 4 Ultron Sentry 04 | Laser Pistol + Light Shield (₡108,000) | Volt Sabre + Aegis Bulwark (₡834,000) |
| 5 Ultron Sentry 05 | Beam Pistol (₡93,000) | Particle Lance (₡425,000) |
| 6 Ultron Sentry 06 | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |
| 7 Ultron Sentry 07 | Training Rifle (₡50,000) | Plasma Cannon (₡408,000) |
| 8 Ultron Sentry 08 | Laser Pistol + Light Shield (₡108,000) | Volt Sabre + Aegis Bulwark (₡834,000) |
| 9 Ultron Sentry 09 | Beam Pistol (₡93,000) | Particle Lance (₡425,000) |
| 10 Ultron Sentry 10 | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |
| 11 Ultron Sentry 11 | Training Rifle (₡50,000) | Plasma Cannon (₡408,000) |

**Refinement plans** (generated; applied by Swarm goal 23, Refine → 8 steps per robot). All 11 robots: 70 steps, ₡32,150,000; the 11 robots at the target: ₡32,150,000; Refine → 8 applies ₡32,090,000 of the target robots' plans.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Ultron (5 steps, ₡2,820,000) | Plasma Cannon (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Combat Algorithms +1 (new) ₡20,000 | ₡2,820,000 |
| Ultron Sentry 02 (5 steps, ₡2,960,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| Ultron Sentry 03 (10 steps, ₡2,870,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Armor Plating +1 (new) ₡20,000 | ₡2,820,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |
| Ultron Sentry 04 (10 steps, ₡2,870,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Armor Plating +1 (new) ₡20,000 | ₡2,820,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |
| Ultron Sentry 05 (5 steps, ₡2,960,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +4 (5 → 9) ₡160,000 | ₡2,960,000 |
| Ultron Sentry 06 (5 steps, ₡2,960,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| Ultron Sentry 07 (5 steps, ₡2,960,000) | Plasma Cannon (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Critical Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| Ultron Sentry 08 (10 steps, ₡2,870,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Armor Plating +1 (new) ₡20,000 | ₡2,820,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |
| Ultron Sentry 09 (5 steps, ₡2,960,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +4 (5 → 9) ₡160,000 | ₡2,960,000 |
| Ultron Sentry 10 (5 steps, ₡2,960,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| Ultron Sentry 11 (5 steps, ₡2,960,000) | Plasma Cannon (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Critical Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |

Storage (estimate; the engine counts at run time): 14 final weapons equipped at the robots target of 11. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need Storage Facility L2; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A04 ×1 (decision 4).

Source findings before decisions: A03 ×2, A04 ×1, A13 ×10, V13 ×11, V18 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 90. Metal Men Laboratory (`metal-men-laboratory`) — Trio

| Field | Value |
|---|---|
| Stable name | Metal Men Laboratory |
| Franchise label | DC — Metal Men |
| Backstory | Metal Men Laboratory enters the arena with a clear doctrine. A balanced synthetic leader, durable heavy, and agile specialist. Every surviving machine returns to the workshop before the next booking. |
| Strategy | Trio |
| Target overrides | goal 12 Robots → 4 (strategy default 3, allowed 3–6) |
| Team names | 2v2: **Gold Standard** (robots 1+2), **Responsometer Crew** (3+4) · 3v3: **Doc Magnus's Finest** (1–3) |
| Event order | `league_3v3`, `tournament_3v3`, `league_1v1`, `league_2v2`, `tag_team`, `koth`, `grand_melee`, `tournament_2v2`, `tournament_1v1` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- Franchise label: 'DC' → 'DC — Metal Men' (decisions 3, 7; delegated authoring)
- 2v2 team 1+2: 'Metal Men Pair 01' → 'Gold Standard' (decisions 3, 7; delegated authoring)
- 2v2 team 3+4: 'Metal Men Pair 02' → 'Responsometer Crew' (decisions 3, 7; delegated authoring)
- 3v3 team 1+2+3: 'Metal Men Squad 01' → "Doc Magnus's Finest" (decisions 3, 7; delegated authoring)
- Goal 12 Robots target: 3 → 4 (decision 5)

Every blueprint is used at the robots target of 4; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Gold | `single` | short | balanced | 15 | Versatile | Gold-coloured humanoid Metal Man with a reflective metal face and composed stance. | `metal-men-laboratory/1.webp` |
| 2 | Iron | `two_handed` | melee | defensive | 10 | Warden | Broad iron-grey humanoid Metal Man with powerful metallic limbs and heavy proportions. | `metal-men-laboratory/2.webp` |
| 3 | Mercury | `dual_wield` | melee | offensive | 15 | Sprinter | Slim reflective silver Metal Man with narrow mechanical silhouette and quick striking pose. | `metal-men-laboratory/3.webp` |
| 4 | Tin | `weapon_shield` | long | defensive | 30 | Warden | Small tin-grey Metal Man with a modest body and protective defensive equipment. | `metal-men-laboratory/4.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Gold | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |
| 2 Iron | War Club (₡84,000) | Heavy Hammer (₡478,000) |
| 3 Mercury | Combat Knife ×2 (₡186,000) | Vibro Mace ×2 (₡850,000) |
| 4 Tin | Beam Pistol + Combat Shield (₡171,000) | Particle Lance + Aegis Bulwark (₡834,000) |

**Refinement plans** (generated; applied by Trio goal 22, Refine → 10 steps per robot). All 4 robots: 30 steps, ₡14,210,000; the 4 robots at the target: ₡14,210,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Gold (5 steps, ₡2,840,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +2 (8 → 10) ₡40,000 | ₡2,840,000 |
| Iron (5 steps, ₡2,820,000) | Heavy Hammer (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Armor Plating +1 (new) ₡20,000 | ₡2,820,000 |
| Mercury (10 steps, ₡5,680,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 · 9 Hone Gyro Stabilizers +2 (4 → 6) ₡40,000 | ₡2,840,000 |
|  | Vibro Mace (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 · 10 Hone Gyro Stabilizers +2 (4 → 6) ₡40,000 | ₡2,840,000 |
| Tin (10 steps, ₡2,870,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Armor Plating +1 (new) ₡20,000 | ₡2,820,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |

Storage (estimate; the engine counts at run time): 6 final weapons equipped at the robots target of 4. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need Storage Facility L1; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5), A04 ×1 (decision 4).

Source findings before decisions: A03 ×1, A04 ×1, A08 ×2, A12 ×1, V13 ×4, V18 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 91. Moshimo Robotics (`moshimo-robotics`) — Duo

| Field | Value |
|---|---|
| Stable name | Moshimo Robotics |
| Franchise label | Robotboy |
| Backstory | Moshimo Robotics enters the arena with a clear doctrine. A coordinated pair of compact combat robots. Every surviving machine returns to the workshop before the next booking. |
| Strategy | Duo |
| Target overrides | goal 11 Booking Office → L6 (strategy default L4, allowed L0–L6); goal 13 Robots → 3 (strategy default 2, allowed 2–3) |
| Team names | 2v2: **Superactivated** (robots 1+2) · 3v3: **Tommy's Defenders** (1–3) |
| Event order | `tag_team`, `league_2v2`, `tournament_2v2`, `league_1v1`, `koth`, `grand_melee`, `tournament_1v1`, `league_3v3`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- 2v2 team 1+2: 'Moshimo Pair 01' → 'Superactivated' (decision 3; delegated authoring)
- 3v3 team 1+2+3: 'Moshimo Squad 01' → "Tommy's Defenders" (decision 3; delegated authoring)
- Goal 11 Booking Office target: L4 → L6 (decision 5)
- Goal 13 Robots target: 2 → 3 (decision 5)

Every blueprint is used at the robots target of 3; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Robotboy | `dual_wield` | short | offensive | 10 | Versatile | Compact blue-white combat robot with screen-like face and articulated fighting limbs. | `moshimo-robotics/1.webp` |
| 2 | Robotgirl | `weapon_shield` | short | defensive | 20 | Warden | Compact partner combat robot with contrasting armour, recognizable face and articulated limbs. | `moshimo-robotics/2.webp` |
| 3 | Protoboy | `dual_wield` | melee | offensive | 5 | Sprinter | Earlier combat robot with darker mechanical plates, angular head and aggressive equipment. | `moshimo-robotics/3.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Robotboy | Laser Pistol ×2 (₡114,000) | Volt Sabre ×2 (₡850,000) |
| 2 Robotgirl | Laser Pistol + Light Shield (₡108,000) | Volt Sabre + Aegis Bulwark (₡834,000) |
| 3 Protoboy | Combat Knife ×2 (₡186,000) | Vibro Mace ×2 (₡850,000) |

**Refinement plans** (generated; applied by Duo goal 17, Refine → 10 steps per robot). All 3 robots: 30 steps, ₡14,230,000; the 3 robots at the target: ₡14,230,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Robotboy (10 steps, ₡5,680,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 · 9 Hone Combat Power +2 (8 → 10) ₡40,000 | ₡2,840,000 |
|  | Volt Sabre (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 · 10 Hone Combat Power +2 (8 → 10) ₡40,000 | ₡2,840,000 |
| Robotgirl (10 steps, ₡2,870,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Armor Plating +1 (new) ₡20,000 | ₡2,820,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |
| Protoboy (10 steps, ₡5,680,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 · 9 Hone Gyro Stabilizers +2 (4 → 6) ₡40,000 | ₡2,840,000 |
|  | Vibro Mace (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 · 10 Hone Gyro Stabilizers +2 (4 → 6) ₡40,000 | ₡2,840,000 |

Storage (estimate; the engine counts at run time): 6 final weapons equipped at the robots target of 3. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need Storage Facility L1; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A04 ×1 (decision 4).

Source findings before decisions: A03 ×1, A04 ×1, A12 ×1, V13 ×4.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 92. Geonosis Droid Foundry (`geonosis-droid-foundry`) — Swarm

| Field | Value |
|---|---|
| Stable name | Geonosis Droid Foundry |
| Franchise label | Star Wars — Separatist Droid Army |
| Backstory | The foundry ships practical infantry first, then fills the line with guards, walkers and heavy platforms. Kalani keeps the production queue moving and the repair bill under control. |
| Strategy | Swarm |
| Target overrides | none (goal 10 Robots → 11, the strategy default) |
| Team names | 2v2: **Kalani's Vanguard** (robots 1+2), **Destroyer Line** (3+4), **Commando Guard** (5+6), **Tactical Command** (7+8), **Geonosis Walkers** (9+10) · 3v3: **Roger Roger** (1–3), **Confederacy Guard** (4–6), **Battle of Geonosis** (7–9) |
| Event order | `league_3v3`, `league_2v2`, `tag_team`, `league_1v1`, `koth`, `grand_melee`, `tournament_3v3`, `tournament_2v2`, `tournament_1v1` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- Franchise label: 'Star Wars' → 'Star Wars — Separatist Droid Army' (decisions 14, 16, 18; delegated authoring)
- 2v2 team 1+2: 'Geonosis Pair 01' → "Kalani's Vanguard" (decisions 14, 16, 18; delegated authoring)
- 2v2 team 3+4: 'Geonosis Pair 02' → 'Destroyer Line' (decisions 14, 16, 18; delegated authoring)
- 2v2 team 5+6: 'Geonosis Pair 03' → 'Commando Guard' (decisions 14, 16, 18; delegated authoring)
- 2v2 team 7+8: 'Geonosis Pair 04' → 'Tactical Command' (decisions 14, 16, 18; delegated authoring)
- 2v2 team 9+10: 'Geonosis Pair 05' → 'Geonosis Walkers' (decisions 14, 16, 18; delegated authoring)
- 3v3 team 1+2+3: 'Geonosis Squad 01' → 'Roger Roger' (decisions 14, 16, 18; delegated authoring)
- 3v3 team 4+5+6: 'Geonosis Squad 02' → 'Confederacy Guard' (decisions 14, 16, 18; delegated authoring)
- 3v3 team 7+8+9: 'Geonosis Squad 03' → 'Battle of Geonosis' (decisions 14, 16, 18; delegated authoring)
- Slot 2 robot name: 'B1 Battle Droid 02' → 'B1 Battle Droid' (decisions 14, 16, 18; delegated authoring)
- Slot 2 art brief: 'Recognizable standard tan B1 battle droid: long narrow beak-like head with two dark sensor openings, very thin long neck, slender skeletal torso, backpack, articulated skinny arms and long legs…' → 'Tan B1 battle droid, thin skeletal limbs, long snout head and backpack antenna, E-5 blaster rifle held low' (decisions 14, 16, 18; delegated authoring)
- Slot 2 portrait: aligned (decisions 14, 16, 18; delegated authoring)
- Slot 3 robot name: 'B2 Super Battle Droid 03' → 'B2 Super Battle Droid' (decisions 14, 16, 18; delegated authoring)
- Slot 3 art brief: 'Edit this B2 super battle droid portrait.' → 'Hulking gunmetal B2 super battle droid, broad hunched torso, tiny recessed head, twin wrist blasters on both arms' (decisions 14, 16, 18; delegated authoring)
- Slot 3 portrait: aligned (decisions 14, 16, 18; delegated authoring)
- Slot 4 robot name: 'Droideka 04' → 'Droideka' (decisions 14, 16, 18; delegated authoring)
- Slot 4 art brief: 'Recognizable Droideka destroyer droid in deployed standing form: EXACTLY THREE articulated legs, compact bronze-brown rounded upper shell, curved skeletal neck/head and paired gun arms, exposed…' → 'Rust-brown droideka on three clawed legs, curved shell back, red sensor eyes, twin blaster arms forward' (decisions 14, 16, 18; delegated authoring)
- Slot 4 portrait: aligned (decisions 14, 16, 18; delegated authoring)
- Slot 5 robot name: 'BX Commando Droid 05' → 'BX Commando Droid' (decisions 14, 16, 18; delegated authoring)
- Slot 5 art brief: 'Source-faithful BX commando droid, dark charcoal gunmetal plates, distinctive narrow elongated commando-droid head with pale glowing eye sensors, lean agile humanoid mechanical body, narrow waist…' → 'Lean dark-grey BX commando droid, angular armoured frame, glowing visor slits, compact blaster carbine in both hands' (decisions 14, 16, 18; delegated authoring)
- Slot 5 portrait: aligned (decisions 14, 16, 18; delegated authoring)
- Slot 6 robot name: 'IG-100 MagnaGuard 06' → 'IG-100 MagnaGuard' (decisions 14, 16, 18; delegated authoring)
- Slot 6 art brief: 'One IG-100 MagnaGuard bodyguard droid in authentic pale silver-grey body armour, tall thin mechanical frame, recognizable rounded head with warm yellow-orange photoreceptors, a weathered light grey…' → 'Bone-white IG-100 MagnaGuard, tattered grey cloak, glowing amber eyes, electrostaff crackling violet at both ends' (decisions 14, 16, 18; delegated authoring)
- Slot 6 portrait: aligned (decisions 14, 16, 18; delegated authoring)
- Slot 7 robot name: 'T-series Tactical Droid 07' → 'T-series Tactical Droid' (decisions 14, 16, 18; delegated authoring)
- Slot 7 art brief: 'A standard T-series tactical droid in grey-blue and ivory machine panels with the authentic narrow rectangular angular tactical-droid head, coloured optical sensors, mechanical chest, tall thin…' → 'Slender blue-and-cream T-series tactical droid, flat wedge head with orange eyes, blaster pistol at its side' (decisions 14, 16, 18; delegated authoring)
- Slot 7 portrait: aligned (decisions 14, 16, 18; delegated authoring)
- Slot 8 robot name: 'B1 Commander 08' → 'B1 Commander' (decisions 14, 16, 18; delegated authoring)
- Slot 8 art brief: 'One source-faithful B1 commander battle droid, tan skeletal B1 body and long beak-like head, yellow command markings on head and upper chest, backpack and thin articulated limbs.' → 'Tan B1 commander droid with yellow head and chest markings, one hand raised, E-5 blaster rifle in the other' (decisions 14, 16, 18; delegated authoring)
- Slot 8 portrait: aligned (decisions 14, 16, 18; delegated authoring)
- Slot 9 robot name: 'Dwarf Spider Droid 09' → 'Dwarf Spider Droid' (decisions 14, 16, 18; delegated authoring)
- Slot 9 art brief: 'Authentic DSD1 dwarf spider droid: compact rounded tan metal dome on EXACTLY FOUR jointed spider legs, tall thin central antenna, forward protruding single central blaster cannon, small red sensor…' → 'Sandy tan dwarf spider droid, rounded dome on four jointed legs, tall antenna, red lenses, long central blaster cannon' (decisions 14, 16, 18; delegated authoring)
- Slot 9 portrait: aligned (decisions 14, 16, 18; delegated authoring)
- Slot 10 robot name: 'LM-432 Crab Droid 10' → 'LM-432 Crab Droid' (decisions 14, 16, 18; delegated authoring)
- Slot 10 art brief: 'One authentic film LM-432 Muckraker crab droid as seen on Utapau: low rust-brown armoured crab-like chassis, paired red forward photoreceptors, rugged mechanical legs and claw-like feet in the…' → 'Low rust-brown LM-432 crab droid, wide armoured shell on clawed legs, paired red photoreceptors, twin front blasters' (decisions 14, 16, 18; delegated authoring)
- Slot 10 portrait: aligned (decisions 14, 16, 18; delegated authoring)
- Slot 11 robot name: 'Octuptarra Droid 11' → 'Octuptarra Droid' (decisions 14, 16, 18; delegated authoring)
- Slot 11 art brief: 'One source-faithful smaller Octuptarra combat tri-droid, NOT the towering magna variant: spherical elevated grey-blue head/body with red sensor lenses and source cannon assemblies, EXACTLY THREE…' → 'Grey Octuptarra tri-droid, spherical head with a big red eye on three thin clawed legs, twin blaster turrets each side' (decisions 14, 16, 18; delegated authoring)
- Slot 11 portrait: aligned (decisions 14, 16, 18; delegated authoring)

Every blueprint is used at the robots target of 11; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Kalani | `single` | mid | balanced | 15 | Tactician | source-faithful Kalani, the green-and-gold Super Tactical Droid as seen in Star Wars Rebels, not an original substitute. | `geonosis-droid-foundry/1.webp` |
| 2 | B1 Battle Droid | `single` | short | balanced | 15 | Versatile | Tan B1 battle droid, thin skeletal limbs, long snout head and backpack antenna, E-5 blaster rifle held low | `geonosis-droid-foundry/2.webp` |
| 3 | B2 Super Battle Droid | `single` | short | offensive | 10 | Bruiser | Hulking gunmetal B2 super battle droid, broad hunched torso, tiny recessed head, twin wrist blasters on both arms | `geonosis-droid-foundry/3.webp` |
| 4 | Droideka | `weapon_shield` | short | defensive | 25 | Warden | Rust-brown droideka on three clawed legs, curved shell back, red sensor eyes, twin blaster arms forward | `geonosis-droid-foundry/4.webp` |
| 5 | BX Commando Droid | `single` | short | balanced | 20 | Sprinter | Lean dark-grey BX commando droid, angular armoured frame, glowing visor slits, compact blaster carbine in both hands | `geonosis-droid-foundry/5.webp` |
| 6 | IG-100 MagnaGuard | `dual_wield` | melee | offensive | 10 | Sprinter | Bone-white IG-100 MagnaGuard, tattered grey cloak, glowing amber eyes, electrostaff crackling violet at both ends | `geonosis-droid-foundry/6.webp` |
| 7 | T-series Tactical Droid | `single` | long | balanced | 20 | Deadeye | Slender blue-and-cream T-series tactical droid, flat wedge head with orange eyes, blaster pistol at its side | `geonosis-droid-foundry/7.webp` |
| 8 | B1 Commander | `single` | mid | balanced | 15 | Tactician | Tan B1 commander droid with yellow head and chest markings, one hand raised, E-5 blaster rifle in the other | `geonosis-droid-foundry/8.webp` |
| 9 | Dwarf Spider Droid | `two_handed` | long | balanced | 15 | Deadeye | Sandy tan dwarf spider droid, rounded dome on four jointed legs, tall antenna, red lenses, long central blaster cannon | `geonosis-droid-foundry/9.webp` |
| 10 | LM-432 Crab Droid | `two_handed` | melee | offensive | 10 | Bruiser | Low rust-brown LM-432 crab droid, wide armoured shell on clawed legs, paired red photoreceptors, twin front blasters | `geonosis-droid-foundry/10.webp` |
| 11 | Octuptarra Droid | `two_handed` | mid | offensive | 10 | Bruiser | Grey Octuptarra tri-droid, spherical head with a big red eye on three thin clawed legs, twin blaster turrets each side | `geonosis-droid-foundry/11.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Kalani | Bolt Carbine (₡93,000) | Nova Caster (₡425,000) |
| 2 B1 Battle Droid | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |
| 3 B2 Super Battle Droid | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |
| 4 Droideka | Laser Pistol + Light Shield (₡108,000) | Volt Sabre + Aegis Bulwark (₡834,000) |
| 5 BX Commando Droid | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |
| 6 IG-100 MagnaGuard | Practice Sword ×2 (₡100,000) | Vibro Mace ×2 (₡850,000) |
| 7 T-series Tactical Droid | Beam Pistol (₡93,000) | Particle Lance (₡425,000) |
| 8 B1 Commander | Bolt Carbine (₡93,000) | Nova Caster (₡425,000) |
| 9 Dwarf Spider Droid | Training Beam (₡50,000) | Ion Beam (₡544,000) |
| 10 LM-432 Crab Droid | Shock Maul (₡183,000) | Heavy Hammer (₡478,000) |
| 11 Octuptarra Droid | Training Rifle (₡50,000) | Plasma Cannon (₡408,000) |

**Refinement plans** (generated; applied by Swarm goal 23, Refine → 8 steps per robot). All 11 robots: 65 steps, ₡35,150,000; the 11 robots at the target: ₡35,150,000; Refine → 8 applies ₡34,810,000 of the target robots' plans.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Kalani (5 steps, ₡2,820,000) | Nova Caster (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Combat Algorithms +1 (new) ₡20,000 | ₡2,820,000 |
| B1 Battle Droid (5 steps, ₡2,960,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| B2 Super Battle Droid (5 steps, ₡2,960,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| Droideka (10 steps, ₡2,870,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Armor Plating +1 (new) ₡20,000 | ₡2,820,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |
| BX Commando Droid (5 steps, ₡2,960,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Power Core +4 (−3 → 1) ₡160,000 | ₡2,960,000 |
| IG-100 MagnaGuard (10 steps, ₡5,920,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 · 9 Hone Gyro Stabilizers +4 (4 → 8) ₡160,000 | ₡2,960,000 |
|  | Vibro Mace (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 · 10 Hone Gyro Stabilizers +4 (4 → 8) ₡160,000 | ₡2,960,000 |
| T-series Tactical Droid (5 steps, ₡2,960,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +4 (5 → 9) ₡160,000 | ₡2,960,000 |
| B1 Commander (5 steps, ₡2,820,000) | Nova Caster (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Combat Algorithms +1 (new) ₡20,000 | ₡2,820,000 |
| Dwarf Spider Droid (5 steps, ₡2,960,000) | Ion Beam (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (4 → 8) ₡160,000 | ₡2,960,000 |
| LM-432 Crab Droid (5 steps, ₡2,960,000) | Heavy Hammer (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Critical Systems +4 (4 → 8) ₡160,000 | ₡2,960,000 |
| Octuptarra Droid (5 steps, ₡2,960,000) | Plasma Cannon (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Critical Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |

Storage (estimate; the engine counts at run time): 13 final weapons equipped at the robots target of 11. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need Storage Facility L2; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Source findings before decisions: A03 ×2, A13 ×10, V13 ×11.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 93. Rebel Droid Partnership (`rebel-droid-partnership`) — Duo

| Field | Value |
|---|---|
| Stable name | Rebel Droid Partnership |
| Franchise label | Star Wars — Skywalker Saga |
| Backstory | One partner improvises under pressure; the other insists on a sensible risk assessment. Their workshop spends on a dependable pair before buying anything that needs a larger hangar. |
| Strategy | Duo |
| Target overrides | none (goal 13 Robots → 2, the strategy default) |
| Team names | 2v2: **Tantive IV Escape** (robots 1+2) · 3v3: none |
| Event order | `league_2v2`, `tag_team`, `tournament_2v2`, `league_1v1`, `koth`, `grand_melee`, `tournament_1v1`, `league_3v3`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- Franchise label: 'Star Wars' → 'Star Wars — Skywalker Saga' (decisions 14, 16; delegated authoring)
- 2v2 team 1+2: 'Rebel Circuit Pair 01' → 'Tantive IV Escape' (decisions 14, 16; delegated authoring)

Every blueprint is used at the robots target of 2; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | R2-D2 | `single` | short | balanced | 20 | Sprinter | compact starship maintenance robot with a wide trapezoidal petrol-teal body on two low continuous rubber tracks. | `rebel-droid-partnership/1.webp` |
| 2 | C-3PO | `weapon_shield` | mid | defensive | 25 | Tactician | Original diplomatic service android for a retro-space setting. | `rebel-droid-partnership/2.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 R2-D2 | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |
| 2 C-3PO | Bolt Carbine + Light Shield (₡144,000) | Nova Caster + Aegis Bulwark (₡834,000) |

**Refinement plans** (generated; applied by Duo goal 17, Refine → 10 steps per robot). All 2 robots: 15 steps, ₡5,670,000; the 2 robots at the target: ₡5,670,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| R2-D2 (5 steps, ₡2,810,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Power Core +1 (−3 → −2) ₡10,000 | ₡2,810,000 |
| C-3PO (10 steps, ₡2,860,000) | Nova Caster (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (8 → 9) ₡10,000 | ₡2,810,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |

Storage (estimate; the engine counts at run time): 3 final weapons equipped at the robots target of 2. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5).

Source findings before decisions: A01 ×1, A03 ×1, A07 ×1, V13 ×2.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 94. Droid Bounty Syndicate (`droid-bounty-syndicate`) — Trio

| Field | Value |
|---|---|
| Stable name | Droid Bounty Syndicate |
| Franchise label | Star Wars — Bounty Hunters |
| Backstory | Three hunters share the entry fees and very little else. Precision, mobile pressure and protected support divide the work while the quartermaster upgrades the trio together. |
| Strategy | Trio |
| Target overrides | none (goal 12 Robots → 3, the strategy default) |
| Team names | 2v2: **IG Assassin Line** (robots 1+2) · 3v3: **Bounty Hunters Guild** (1–3) |
| Event order | `league_3v3`, `tournament_3v3`, `league_2v2`, `tag_team`, `league_1v1`, `koth`, `grand_melee`, `tournament_2v2`, `tournament_1v1` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- Franchise label: 'Star Wars' → 'Star Wars — Bounty Hunters' (decisions 14, 16; delegated authoring)
- 2v2 team 1+2: 'Bounty Ledger Pair 01' → 'IG Assassin Line' (decisions 14, 16; delegated authoring)
- 3v3 team 1+2+3: 'Bounty Ledger Squad 01' → 'Bounty Hunters Guild' (decisions 14, 16; delegated authoring)

Every blueprint is used at the robots target of 3; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | IG-88 | `single` | long | balanced | 20 | Deadeye | Authentic IG-88 bounty-hunter droid, very tall thin battered grey metal body, elongated cylindrical industrial head studded with small sensors, characteristic exposed rods and pistons, narrow torso… | `droid-bounty-syndicate/1.webp` |
| 2 | IG-11 | `dual_wield` | short | offensive | 10 | Sprinter | Authentic IG-11 bounty-hunter droid, tall spindly weathered bronze-grey body, cylindrical sensor head and characteristic chest bandoliers, exposed mechanical rods and joints. | `droid-bounty-syndicate/2.webp` |
| 3 | 4-LOM | `weapon_shield` | mid | defensive | 25 | Tactician | Authentic 4-LOM bounty-hunter droid: recognizable large insect-like head with two bulbous segmented compound-eye lenses and round mouth mechanism on a battered rusty dark protocol-droid body. | `droid-bounty-syndicate/3.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 IG-88 | Beam Pistol (₡93,000) | Particle Lance (₡425,000) |
| 2 IG-11 | Laser Pistol ×2 (₡114,000) | Volt Sabre ×2 (₡850,000) |
| 3 4-LOM | Bolt Carbine + Light Shield (₡144,000) | Nova Caster + Aegis Bulwark (₡834,000) |

**Refinement plans** (generated; applied by Trio goal 22, Refine → 10 steps per robot). All 3 robots: 25 steps, ₡11,290,000; the 3 robots at the target: ₡11,290,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| IG-88 (5 steps, ₡2,810,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (5 → 6) ₡10,000 | ₡2,810,000 |
| IG-11 (10 steps, ₡5,620,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 · 9 Hone Power Core +1 (−3 → −2) ₡10,000 | ₡2,810,000 |
|  | Volt Sabre (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 · 10 Hone Power Core +1 (−3 → −2) ₡10,000 | ₡2,810,000 |
| 4-LOM (10 steps, ₡2,860,000) | Nova Caster (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (8 → 9) ₡10,000 | ₡2,810,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |

Storage (estimate; the engine counts at run time): 5 final weapons equipped at the robots target of 3. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5), A02 ×1 (decision 9, 15).

Source findings before decisions: A01 ×1, A02 ×1, A03 ×1, V13 ×3.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 95. Grievous War Forge (`grievous-war-forge`) — Paragon

| Field | Value |
|---|---|
| Stable name | Grievous War Forge |
| Franchise label | Star Wars — The Clone Wars |
| Backstory | The forge pours its earnings into one relentless close-combat machine. Extra blades make a statement; the account still pays for two supported weapon allocations. |
| Strategy | Paragon |
| Target overrides | none (goal 8 Robots → 1, the strategy default) |
| Team names | 2v2: none · 3v3: none |
| Event order | `league_1v1`, `tournament_1v1`, `koth`, `grand_melee`, `league_2v2`, `tag_team`, `tournament_2v2`, `league_3v3`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- Franchise label: 'Star Wars' → 'Star Wars — The Clone Wars' (decision 16; delegated authoring)

Every blueprint is used at the robots target of 1; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | General Grievous | `dual_wield` | melee | offensive | 10 | Sprinter | Original elite arena war machine for a retro-space setting. | `grievous-war-forge/1.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 General Grievous | Practice Sword ×2 (₡100,000) | Vibro Mace ×2 (₡850,000) |

**Refinement plans** (generated; applied by Paragon goal 16, Refine → 10 steps per robot). The only blueprint: 8 steps, ₡5,600,000; the robot at the target: ₡5,600,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| General Grievous (8 steps, ₡5,600,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 | ₡2,800,000 |
|  | Vibro Mace (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 | ₡2,800,000 |

Storage (estimate; the engine counts at run time): 2 final weapons equipped at the robots target of 1. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5).

Source findings before decisions: A01 ×1, V13 ×2.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 96. Rebel Droid Network (`rebel-droid-network`) — Generalist

| Field | Value |
|---|---|
| Stable name | Rebel Droid Network |
| Franchise label | Star Wars — Rebel Alliance |
| Backstory | A patched scout, an exacting inventory specialist and a heavy security frame keep this workshop adaptable. They buy the third chassis before settling into specialist upgrades. |
| Strategy | Generalist |
| Target overrides | goal 14 Robots → 3 (strategy default 2, allowed 2–4) |
| Team names | 2v2: **Chopper Base** (robots 1+2) · 3v3: **Rogue One Support** (1–3) |
| Event order | `league_1v1`, `league_2v2`, `tag_team`, `league_3v3`, `koth`, `grand_melee`, `tournament_1v1`, `tournament_2v2`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- Franchise label: 'Star Wars' → 'Star Wars — Rebel Alliance' (decisions 14, 16; delegated authoring)
- 2v2 team 1+2: 'Rebel Network Pair 01' → 'Chopper Base' (decisions 14, 16; delegated authoring)
- 3v3 team 1+2+3: 'Rebel Network Squad 01' → 'Rogue One Support' (decisions 14, 16; delegated authoring)

Every blueprint is used at the robots target of 3; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Chopper C1-10P | `single` | short | balanced | 20 | Sprinter | Authentic Chopper C1-10P from Rebels: short weathered orange-and-grey flat-topped dome, compact cream-and-orange patched cylindrical astromech body, mismatched mechanical side legs and source feet… | `rebel-droid-network/1.webp` |
| 2 | AP-5 | `single` | long | balanced | 20 | Deadeye | Authentic AP-5 inventory droid from Rebels: tall slender blue-grey mechanical body, elongated narrow protocol-style head and characteristic pale optical sensors, slim limbs and exposed joints… | `rebel-droid-network/2.webp` |
| 3 | K-2SO | `weapon_shield` | melee | defensive | 25 | Warden | Original starship security robot with a broad heavy chassis, muscular hydraulic arms and short stout bipedal legs. | `rebel-droid-network/3.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Chopper C1-10P | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |
| 2 AP-5 | Beam Pistol (₡93,000) | Particle Lance (₡425,000) |
| 3 K-2SO | Practice Sword + Light Shield (₡101,000) | Vibro Mace + Aegis Bulwark (₡834,000) |

**Refinement plans** (generated; applied by Generalist goal 18, Refine → 10 steps per robot). All 3 robots: 20 steps, ₡8,570,000; the 3 robots at the target: ₡8,570,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Chopper C1-10P (5 steps, ₡2,840,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Power Core +2 (−3 → −1) ₡40,000 | ₡2,840,000 |
| AP-5 (5 steps, ₡2,840,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +2 (5 → 7) ₡40,000 | ₡2,840,000 |
| K-2SO (10 steps, ₡2,890,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Counter Protocols +2 (5 → 7) ₡40,000 | ₡2,840,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |

Storage (estimate; the engine counts at run time): 4 final weapons equipped at the robots target of 3. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5), A02 ×1 (decision 9, 15).

Source findings before decisions: A01 ×1, A02 ×1, A03 ×1, V08 ×1, V13 ×3.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 97. Jawa Salvage Exchange (`jawa-salvage-exchange`) — Tycoon

| Field | Value |
|---|---|
| Stable name | Jawa Salvage Exchange |
| Franchise label | Star Wars — Jawas |
| Backstory | The exchange turns discarded service machines into paying arena assets. Income facilities come first, and the repaired trio earns its equipment one careful purchase at a time. |
| Strategy | Tycoon |
| Target overrides | goal 20 Robots → 3 (strategy default 2, allowed 2–3) |
| Team names | 2v2: **Bad Motivator** (robots 1+2) · 3v3: **Sandcrawler Crew** (1–3) |
| Event order | `league_2v2`, `tag_team`, `league_1v1`, `league_3v3`, `koth`, `grand_melee`, `tournament_2v2`, `tournament_3v3`, `tournament_1v1` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- Franchise label: 'Star Wars' → 'Star Wars — Jawas' (decisions 14, 16, 18; delegated authoring)
- 2v2 team 1+2: 'Jawa Salvage Pair 01' → 'Bad Motivator' (decisions 14, 16, 18; delegated authoring)
- 3v3 team 1+2+3: 'Jawa Salvage Squad 01' → 'Sandcrawler Crew' (decisions 14, 16, 18; delegated authoring)
- Slot 2 robot name: 'WED Treadwell 02' → 'WED Treadwell' (decisions 14, 16, 18; delegated authoring)
- Slot 2 art brief: 'One authentic WED Treadwell repair droid: compact rectangular blue tracked base, tall very thin central neck, source binocular/telescope-like paired optical head, spindly articulated repair-tool…' → 'Weathered blue WED Treadwell on tank treads, tall mast with twin camera eyes, claw arm and a drill arm raised' (decisions 14, 16, 18; delegated authoring)
- Slot 2 portrait: aligned (decisions 14, 16, 18; delegated authoring)
- Slot 3 robot name: 'GNK Power Droid 03' → 'GNK Power Droid' (decisions 14, 16, 18; delegated authoring)
- Slot 3 art brief: 'One authentic GNK gonk power droid: chunky rectangular weathered grey-brown generator box, two short articulated legs with broad flat feet, recognizable inset front power panels and lower mechanical…' → 'Boxy sand-stained GNK power droid, rectangular body with a control panel, stubby walking legs, no visible weapon' (decisions 14, 16, 18; delegated authoring)
- Slot 3 portrait: aligned (decisions 14, 16, 18; delegated authoring)

Every blueprint is used at the robots target of 3; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | R5-D4 | `single` | short | balanced | 15 | Versatile | Original desert salvage utility robot on four large rugged wheels, each on an independent articulated suspension strut. | `jawa-salvage-exchange/1.webp` |
| 2 | WED Treadwell | `single` | long | balanced | 20 | Deadeye | Weathered blue WED Treadwell on tank treads, tall mast with twin camera eyes, claw arm and a drill arm raised | `jawa-salvage-exchange/2.webp` |
| 3 | GNK Power Droid | `weapon_shield` | short | defensive | 25 | Warden | Boxy sand-stained GNK power droid, rectangular body with a control panel, stubby walking legs, no visible weapon | `jawa-salvage-exchange/3.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 R5-D4 | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |
| 2 WED Treadwell | Beam Pistol (₡93,000) | Particle Lance (₡425,000) |
| 3 GNK Power Droid | Laser Pistol + Light Shield (₡108,000) | Volt Sabre + Aegis Bulwark (₡834,000) |

**Refinement plans** (generated; applied by Tycoon goal 25, Refine → 10 steps per robot). All 3 robots: 20 steps, ₡8,550,000; the 3 robots at the target: ₡8,550,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| R5-D4 (5 steps, ₡2,840,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +2 (8 → 10) ₡40,000 | ₡2,840,000 |
| WED Treadwell (5 steps, ₡2,840,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +2 (5 → 7) ₡40,000 | ₡2,840,000 |
| GNK Power Droid (10 steps, ₡2,870,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Armor Plating +1 (new) ₡20,000 | ₡2,820,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |

Storage (estimate; the engine counts at run time): 4 final weapons equipped at the robots target of 3. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Source findings before decisions: A03 ×2, A13 ×2, V08 ×1, V13 ×3.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 98. Cyberstan Iron Legion (`cyberstan-iron-legion`) — Swarm

| Field | Value |
|---|---|
| Stable name | Cyberstan Iron Legion |
| Franchise label | Helldivers |
| Backstory | Infantry establish the line before the assembly yard releases its heavy machines. Every purchase adds a distinct battlefield job to the growing mechanical column. |
| Strategy | Swarm |
| Target overrides | none (goal 10 Robots → 11, the strategy default) |
| Team names | 2v2: **Chainsaw Charge** (robots 1+2), **Heavy Line** (3+4), **Strider Patrol** (5+6), **Shield and Flame** (7+8), **Iron Column** (9+10) · 3v3: **Cyberstan Vanguard** (1–3), **Malevelon Creek** (4–6), **Automaton Incursion** (7–9) |
| Event order | `league_3v3`, `league_2v2`, `tag_team`, `league_1v1`, `koth`, `grand_melee`, `tournament_3v3`, `tournament_2v2`, `tournament_1v1` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- 2v2 team 1+2: 'Cyberstan Pair 01' → 'Chainsaw Charge' (decisions 14, 18; delegated authoring)
- 2v2 team 3+4: 'Cyberstan Pair 02' → 'Heavy Line' (decisions 14, 18; delegated authoring)
- 2v2 team 5+6: 'Cyberstan Pair 03' → 'Strider Patrol' (decisions 14, 18; delegated authoring)
- 2v2 team 7+8: 'Cyberstan Pair 04' → 'Shield and Flame' (decisions 14, 18; delegated authoring)
- 2v2 team 9+10: 'Cyberstan Pair 05' → 'Iron Column' (decisions 14, 18; delegated authoring)
- 3v3 team 1+2+3: 'Cyberstan Squad 01' → 'Cyberstan Vanguard' (decisions 14, 18; delegated authoring)
- 3v3 team 4+5+6: 'Cyberstan Squad 02' → 'Malevelon Creek' (decisions 14, 18; delegated authoring)
- 3v3 team 7+8+9: 'Cyberstan Squad 03' → 'Automaton Incursion' (decisions 14, 18; delegated authoring)
- Slot 1 robot name: 'Trooper 01' → 'Automaton Trooper' (decisions 14, 18; delegated authoring)
- Slot 1 art brief: 'Thin black steel skeletal infantry robot, angular skull-like mechanical face with red optics, thin exposed neck and limbs, chest armour plates, relaxed grip on source Automaton laser rifle.' → 'Skeletal black Automaton trooper, red-lit skull face and seams, assault rifle held across the chest' (decisions 14, 18; delegated authoring)
- Slot 1 portrait: aligned (decisions 14, 18; delegated authoring)
- Slot 2 robot name: 'Berserker 02' → 'Berserker' (decisions 14, 18; delegated authoring)
- Slot 2 art brief: 'Helldivers 2 Automaton Berserker: tall hunched skeletal steel frame, red-lit skull head, exposed mechanical torso, broad shoulders, a large chainsaw integrated into EACH of its two forearms, heavy…' → 'Rust-red skull-faced Berserker, spiked shoulders, exposed chest wiring, a chainsaw blade on each arm' (decisions 14, 18; delegated authoring)
- Slot 2 portrait: aligned (decisions 14, 18; delegated authoring)
- Slot 3 robot name: 'Devastator 03' → 'Devastator' (decisions 14, 18; delegated authoring)
- Slot 3 art brief: 'Helldivers 2 standard Automaton Devastator: broad heavily plated angular humanoid, black/grey steel, red skull optics, thick rectangular shoulder armour, solid legs, source built-in arm gun.' → 'Bulky gunmetal Devastator, red-eyed skull head, red chevron emblem on the chest, heavy arm cannon held low' (decisions 14, 18; delegated authoring)
- Slot 3 portrait: aligned (decisions 14, 18; delegated authoring)
- Slot 4 robot name: 'Hulk Bruiser 04' → 'Hulk Bruiser' (decisions 14, 18; delegated authoring)
- Slot 4 art brief: 'Authentic Automaton Hulk Bruiser: massive squat boxy walking armoured body, tiny red glowing recessed visor, two heavy mechanical legs, cannon weapon arm and rocket-launcher weapon arm.' → 'Squat armoured Hulk Bruiser, glowing red eye slit, wide-bore cannon arm and a six-tube rocket pod' (decisions 14, 18; delegated authoring)
- Slot 4 portrait: aligned (decisions 14, 18; delegated authoring)
- Slot 5 robot name: 'Scout Strider 05' → 'Scout Strider' (decisions 14, 18; delegated authoring)
- Slot 5 art brief: 'Helldivers 2 Scout Strider, front three-quarter view: a compact tall two-legged open-backed armoured walking gun platform with broad dark rectangular front shield, source gun ports, long mechanical…' → 'Bipedal grey Scout Strider walker, boxy armoured cab with a skull marking, twin side guns, rear rail' (decisions 14, 18; delegated authoring)
- Slot 5 portrait: aligned (decisions 14, 18; delegated authoring)
- Slot 6 robot name: 'Rocket Devastator 06' → 'Rocket Devastator' (decisions 14, 18; delegated authoring)
- Slot 6 art brief: 'Authentic Helldivers 2 Rocket Devastator: heavily armoured broad humanoid machine, red optics in small skull face, standard Devastator torso and thick legs, TWO distinctive rectangular rocket racks…' → 'Red-trimmed Rocket Devastator, skull face, star emblem, twin shoulder rocket pods, long arm cannon held low' (decisions 14, 18; delegated authoring)
- Slot 6 portrait: aligned (decisions 14, 18; delegated authoring)
- Slot 7 robot name: 'Heavy Devastator 07' → 'Heavy Devastator' (decisions 14, 18; delegated authoring)
- Slot 7 art brief: 'Authentic Helldivers 2 Heavy Devastator: broad armoured gunmetal humanoid with red skull optics, very large rectangular ballistic shield on one arm and multibarrel rapid-fire gun on opposite arm…' → 'Heavy Devastator with skull face and cog emblem, rotary minigun arm and a tall red-striped riot shield' (decisions 14, 18; delegated authoring)
- Slot 7 portrait: aligned (decisions 14, 18; delegated authoring)
- Slot 8 robot name: 'Hulk Scorcher 08' → 'Hulk Scorcher' (decisions 14, 18; delegated authoring)
- Slot 8 art brief: 'Authentic Helldivers 2 Hulk Scorcher: massive stocky box-shaped armoured walker, tiny red visor recessed near upper centre, two mechanical legs, one flamethrower arm and one huge circular chainsaw…' → 'Boxy rusted Hulk Scorcher, red eye slit, star emblem, flamethrower arm and a spinning saw blade' (decisions 14, 18; delegated authoring)
- Slot 8 portrait: aligned (decisions 14, 18; delegated authoring)
- Slot 9 robot name: 'Annihilator Tank 09' → 'Annihilator Tank' (decisions 14, 18; delegated authoring)
- Slot 9 art brief: 'Helldivers 2 Automaton Annihilator Tank, authentic low black armoured tracked tank body and angular rotating turret with its long heavy cannon, restrained red sensor light.' → 'Black Annihilator tank with a white star on the hull, long-barrelled turret cannon, red sensor light' (decisions 14, 18; delegated authoring)
- Slot 9 portrait: aligned (decisions 14, 18; delegated authoring)
- Slot 10 robot name: 'Factory Strider 10' → 'Factory Strider' (decisions 14, 18; delegated authoring)
- Slot 10 art brief: 'Authentic Helldivers 2 Factory Strider, enormous angular armoured quadruped in miniature portrait scale: EXACTLY FOUR robust mechanical legs, long rectangular factory torso, forward head with paired…' → 'Massive four-legged Factory Strider, red-lit armoured hull, top turret cannon, twin chin gatlings' (decisions 14, 18; delegated authoring)
- Slot 10 portrait: aligned (decisions 14, 18; delegated authoring)
- Slot 11 robot name: 'Reinforced Scout Strider 11' → 'Reinforced Scout Strider' (decisions 14, 18; delegated authoring)
- Slot 11 art brief: 'Authentic Helldivers 2 Reinforced Scout Strider from Escalation of Freedom: two tall jointed mechanical legs and wide feet supporting fully enclosed angular armoured cabin, source side-mounted…' → 'Armoured two-legged Reinforced Scout Strider, enclosed cab with red sensors, side rocket pod' (decisions 14, 18; delegated authoring)
- Slot 11 portrait: aligned (decisions 14, 18; delegated authoring)

Every blueprint is used at the robots target of 11; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Automaton Trooper | `single` | short | balanced | 15 | Versatile | Skeletal black Automaton trooper, red-lit skull face and seams, assault rifle held across the chest | `cyberstan-iron-legion/1.webp` |
| 2 | Berserker | `dual_wield` | melee | offensive | 10 | Sprinter | Rust-red skull-faced Berserker, spiked shoulders, exposed chest wiring, a chainsaw blade on each arm | `cyberstan-iron-legion/2.webp` |
| 3 | Devastator | `two_handed` | mid | offensive | 10 | Bruiser | Bulky gunmetal Devastator, red-eyed skull head, red chevron emblem on the chest, heavy arm cannon held low | `cyberstan-iron-legion/3.webp` |
| 4 | Hulk Bruiser | `two_handed` | short | offensive | 10 | Bruiser | Squat armoured Hulk Bruiser, glowing red eye slit, wide-bore cannon arm and a six-tube rocket pod | `cyberstan-iron-legion/4.webp` |
| 5 | Scout Strider | `single` | mid | balanced | 15 | Tactician | Bipedal grey Scout Strider walker, boxy armoured cab with a skull marking, twin side guns, rear rail | `cyberstan-iron-legion/5.webp` |
| 6 | Rocket Devastator | `two_handed` | long | balanced | 15 | Deadeye | Red-trimmed Rocket Devastator, skull face, star emblem, twin shoulder rocket pods, long arm cannon held low | `cyberstan-iron-legion/6.webp` |
| 7 | Heavy Devastator | `weapon_shield` | short | defensive | 25 | Warden | Heavy Devastator with skull face and cog emblem, rotary minigun arm and a tall red-striped riot shield | `cyberstan-iron-legion/7.webp` |
| 8 | Hulk Scorcher | `two_handed` | short | offensive | 10 | Bruiser | Boxy rusted Hulk Scorcher, red eye slit, star emblem, flamethrower arm and a spinning saw blade | `cyberstan-iron-legion/8.webp` |
| 9 | Annihilator Tank | `two_handed` | long | balanced | 15 | Deadeye | Black Annihilator tank with a white star on the hull, long-barrelled turret cannon, red sensor light | `cyberstan-iron-legion/9.webp` |
| 10 | Factory Strider | `two_handed` | mid | offensive | 10 | Bruiser | Massive four-legged Factory Strider, red-lit armoured hull, top turret cannon, twin chin gatlings | `cyberstan-iron-legion/10.webp` |
| 11 | Reinforced Scout Strider | `weapon_shield` | long | defensive | 20 | Warden | Armoured two-legged Reinforced Scout Strider, enclosed cab with red sensors, side rocket pod | `cyberstan-iron-legion/11.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Automaton Trooper | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |
| 2 Berserker | Practice Sword ×2 (₡100,000) | Vibro Mace ×2 (₡850,000) |
| 3 Devastator | Training Rifle (₡50,000) | Plasma Cannon (₡408,000) |
| 4 Hulk Bruiser | Scatter Cannon (₡84,000) | Arc Projector (₡488,000) |
| 5 Scout Strider | Bolt Carbine (₡93,000) | Nova Caster (₡425,000) |
| 6 Rocket Devastator | Training Beam (₡50,000) | Ion Beam (₡544,000) |
| 7 Heavy Devastator | Laser Pistol + Light Shield (₡108,000) | Volt Sabre + Aegis Bulwark (₡834,000) |
| 8 Hulk Scorcher | Scatter Cannon (₡84,000) | Arc Projector (₡488,000) |
| 9 Annihilator Tank | Training Beam (₡50,000) | Ion Beam (₡544,000) |
| 10 Factory Strider | Training Rifle (₡50,000) | Plasma Cannon (₡408,000) |
| 11 Reinforced Scout Strider | Beam Pistol + Light Shield (₡144,000) | Particle Lance + Aegis Bulwark (₡834,000) |

**Refinement plans** (generated; applied by Swarm goal 23, Refine → 8 steps per robot). All 11 robots: 70 steps, ₡35,200,000; the 11 robots at the target: ₡35,200,000; Refine → 8 applies ₡34,840,000 of the target robots' plans.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Automaton Trooper (5 steps, ₡2,960,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| Berserker (10 steps, ₡5,920,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 · 9 Hone Gyro Stabilizers +4 (4 → 8) ₡160,000 | ₡2,960,000 |
|  | Vibro Mace (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 · 10 Hone Gyro Stabilizers +4 (4 → 8) ₡160,000 | ₡2,960,000 |
| Devastator (5 steps, ₡2,960,000) | Plasma Cannon (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Critical Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| Hulk Bruiser (5 steps, ₡2,960,000) | Arc Projector (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| Scout Strider (5 steps, ₡2,820,000) | Nova Caster (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Combat Algorithms +1 (new) ₡20,000 | ₡2,820,000 |
| Rocket Devastator (5 steps, ₡2,960,000) | Ion Beam (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (4 → 8) ₡160,000 | ₡2,960,000 |
| Heavy Devastator (10 steps, ₡2,870,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Armor Plating +1 (new) ₡20,000 | ₡2,820,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |
| Hulk Scorcher (5 steps, ₡2,960,000) | Arc Projector (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| Annihilator Tank (5 steps, ₡2,960,000) | Ion Beam (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (4 → 8) ₡160,000 | ₡2,960,000 |
| Factory Strider (5 steps, ₡2,960,000) | Plasma Cannon (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Critical Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| Reinforced Scout Strider (10 steps, ₡2,870,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Armor Plating +1 (new) ₡20,000 | ₡2,820,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |

Storage (estimate; the engine counts at run time): 14 final weapons equipped at the robots target of 11. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need Storage Facility L2; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Source findings before decisions: A03 ×2, A13 ×11, V13 ×11.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 99. Angel Grove Zord Command (`angel-grove-zord-command`) — Duo

| Field | Value |
|---|---|
| Stable name | Angel Grove Zord Command |
| Franchise label | Power Rangers |
| Backstory | A shielded champion holds the front while its partner supplies heavy ranged pressure. The hangar upgrades both complete machines without counting their component forms as extra fighters. |
| Strategy | Duo |
| Target overrides | none (goal 13 Robots → 2, the strategy default) |
| Team names | 2v2: **Mighty Morphin Zords** (robots 1+2) · 3v3: none |
| Event order | `league_2v2`, `tag_team`, `tournament_2v2`, `league_1v1`, `koth`, `grand_melee`, `tournament_1v1`, `league_3v3`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- 2v2 team 1+2: 'Zord Command Pair 01' → 'Mighty Morphin Zords' (decision 14; delegated authoring)

Every blueprint is used at the robots target of 2; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Dino Megazord | `weapon_shield` | melee | defensive | 25 | Warden | Authentic 1993 Mighty Morphin Dino Megazord in its complete humanoid battle mode: classic black helmet with horns and red/white face framing, broad coloured dinosaur armour, red Tyrannosaurus torso… | `angel-grove-zord-command/1.webp` |
| 2 | Dragonzord | `two_handed` | mid | offensive | 10 | Bruiser | Authentic 1993 Mighty Morphin Dragonzord in standalone dragon/kaiju robot form, not Dragonzord Battle Mode: green, silver and black mechanical reptilian body, iconic gold chest emblem, dragon head… | `angel-grove-zord-command/2.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Dino Megazord | Practice Sword + Light Shield (₡101,000) | Vibro Mace + Aegis Bulwark (₡834,000) |
| 2 Dragonzord | Training Rifle (₡50,000) | Plasma Cannon (₡408,000) |

**Refinement plans** (generated; applied by Duo goal 17, Refine → 10 steps per robot). All 2 robots: 15 steps, ₡5,670,000; the 2 robots at the target: ₡5,670,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Dino Megazord (10 steps, ₡2,860,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Counter Protocols +1 (5 → 6) ₡10,000 | ₡2,810,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |
| Dragonzord (5 steps, ₡2,810,000) | Plasma Cannon (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (7 → 8) ₡10,000 | ₡2,810,000 |

Storage (estimate; the engine counts at run time): 3 final weapons equipped at the robots target of 2. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5).

Source findings before decisions: A01 ×1, A03 ×1, A07 ×1, V13 ×2.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 100. Sewer Circuit Workshop (`sewer-circuit-workshop`) — Generalist

| Field | Value |
|---|---|
| Stable name | Sewer Circuit Workshop |
| Franchise label | Teenage Mutant Ninja Turtles |
| Backstory | A stubborn armoured fighter, a precise synthetic and a low scavenging machine turn an unlikely workshop into a versatile arena roster. |
| Strategy | Generalist |
| Target overrides | goal 14 Robots → 3 (strategy default 2, allowed 2–4) |
| Team names | 2v2: **Cowabunga Circuit** (robots 1+2) · 3v3: **Sewer Lair Crew** (1–3) |
| Event order | `league_1v1`, `league_2v2`, `tag_team`, `league_3v3`, `koth`, `grand_melee`, `tournament_1v1`, `tournament_2v2`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- 2v2 team 1+2: 'Sewer Circuit Pair 01' → 'Cowabunga Circuit' (decision 14; delegated authoring)
- 3v3 team 1+2+3: 'Sewer Circuit Squad 01' → 'Sewer Lair Crew' (decision 14; delegated authoring)

Every blueprint is used at the robots target of 3; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Metalhead | `weapon_shield` | short | defensive | 25 | Warden | Authentic Metalhead robot turtle from the 2012 TMNT animated series: squat stocky robotic turtle silhouette, grey-green armoured shell and body, broad yellow front plastron, mechanical turtle head… | `sewer-circuit-workshop/1.webp` |
| 2 | Fugitoid | `single` | long | balanced | 20 | Deadeye | Refine this full-body Fugitoid portrait to correct the TMNT 2012 character details. | `sewer-circuit-workshop/2.webp` |
| 3 | Mouser | `single` | melee | offensive | 10 | Sprinter | Authentic compact TMNT 2012 Mouser robot: small white/silver body dominated by large rounded mechanical head with broad hinged toothed biting jaw, dark eye/sensor stripe, EXACTLY TWO short… | `sewer-circuit-workshop/3.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Metalhead | Laser Pistol + Light Shield (₡108,000) | Volt Sabre + Aegis Bulwark (₡834,000) |
| 2 Fugitoid | Beam Pistol (₡93,000) | Particle Lance (₡425,000) |
| 3 Mouser | Practice Sword (₡50,000) | Vibro Mace (₡425,000) |

**Refinement plans** (generated; applied by Generalist goal 18, Refine → 10 steps per robot). All 3 robots: 20 steps, ₡8,540,000; the 3 robots at the target: ₡8,540,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Metalhead (10 steps, ₡2,860,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (8 → 9) ₡10,000 | ₡2,810,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |
| Fugitoid (5 steps, ₡2,840,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +2 (5 → 7) ₡40,000 | ₡2,840,000 |
| Mouser (5 steps, ₡2,840,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Gyro Stabilizers +2 (4 → 6) ₡40,000 | ₡2,840,000 |

Storage (estimate; the engine counts at run time): 4 final weapons equipped at the robots target of 3. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5).

Source findings before decisions: A01 ×1, A03 ×1, V08 ×1, V13 ×3.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 101. ZDR Pursuit Unit (`zdr-pursuit-unit`) — Trio

| Field | Value |
|---|---|
| Stable name | ZDR Pursuit Unit |
| Franchise label | Metroid |
| Backstory | Three pursuit frames divide close pressure, mobility and measured ranged work. The laboratory tunes the trio together instead of relying on their source-world special abilities. |
| Strategy | Trio |
| Target overrides | none (goal 12 Robots → 3, the strategy default) |
| Team names | 2v2: **EMMI Hunt** (robots 1+2) · 3v3: **ZDR Lockdown** (1–3) |
| Event order | `league_3v3`, `tournament_3v3`, `league_2v2`, `tag_team`, `league_1v1`, `koth`, `grand_melee`, `tournament_2v2`, `tournament_1v1` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- 2v2 team 1+2: 'Pursuit Unit Pair 01' → 'EMMI Hunt' (decision 14; delegated authoring)
- 3v3 team 1+2+3: 'Pursuit Unit Squad 01' → 'ZDR Lockdown' (decision 14; delegated authoring)

Every blueprint is used at the robots target of 3; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | E.M.M.I.-02SM | `single` | melee | offensive | 10 | Sprinter | Authentic WHITE E.M.M.I.-02SM from Metroid Dread: sleek white armour over exposed black articulated mechanical skeleton, very long jointed arms and legs, narrow high torso, small forward oval head… | `zdr-pursuit-unit/1.webp` |
| 2 | E.M.M.I.-04SB | `single` | short | balanced | 20 | Sprinter | Authentic YELLOW E.M.M.I.-04SB from Metroid Dread: mustard-yellow curved source armour over lean black mechanical skeleton, long articulated limbs and white/grey source joint details, small red… | `zdr-pursuit-unit/2.webp` |
| 3 | E.M.M.I.-05IM | `single` | mid | balanced | 15 | Tactician | Authentic BLUE E.M.M.I.-05IM from Metroid Dread: blue curved source armour over exposed dark articulated mechanical frame, very long arms and legs, narrow torso, small source head with central red… | `zdr-pursuit-unit/3.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 E.M.M.I.-02SM | Practice Sword (₡50,000) | Vibro Mace (₡425,000) |
| 2 E.M.M.I.-04SB | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |
| 3 E.M.M.I.-05IM | Bolt Carbine (₡93,000) | Nova Caster (₡425,000) |

**Refinement plans** (generated; applied by Trio goal 22, Refine → 10 steps per robot). All 3 robots: 15 steps, ₡8,430,000; the 3 robots at the target: ₡8,430,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| E.M.M.I.-02SM (5 steps, ₡2,810,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Gyro Stabilizers +1 (4 → 5) ₡10,000 | ₡2,810,000 |
| E.M.M.I.-04SB (5 steps, ₡2,810,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Power Core +1 (−3 → −2) ₡10,000 | ₡2,810,000 |
| E.M.M.I.-05IM (5 steps, ₡2,810,000) | Nova Caster (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (8 → 9) ₡10,000 | ₡2,810,000 |

Storage (estimate; the engine counts at run time): 3 final weapons equipped at the robots target of 3. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5).

Source findings before decisions: A01 ×1, A03 ×1, V13 ×3.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 102. Gero Android Laboratory (`gero-android-laboratory`) — Trio

| Field | Value |
|---|---|
| Stable name | Gero Android Laboratory |
| Franchise label | Dragon Ball |
| Backstory | Heavy firepower, protected endurance and mobile pressure give the laboratory three different answers to an arena contract. All three receive equipment before any luxury spending. |
| Strategy | Trio |
| Target overrides | none (goal 12 Robots → 3, the strategy default) |
| Team names | 2v2: **Red Ribbon Androids** (robots 1+2) · 3v3: **Gero Creations** (1–3) |
| Event order | `league_3v3`, `tournament_3v3`, `league_2v2`, `tag_team`, `league_1v1`, `koth`, `grand_melee`, `tournament_2v2`, `tournament_1v1` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- 2v2 team 1+2: 'Android Lab Pair 01' → 'Red Ribbon Androids' (decision 14; delegated authoring)
- 3v3 team 1+2+3: 'Android Lab Squad 01' → 'Gero Creations' (decision 14; delegated authoring)

Every blueprint is used at the robots target of 3; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Android 16 | `two_handed` | mid | offensive | 10 | Bruiser | Authentic adult Android 16 from Dragon Ball Z Cell saga, tall exceptionally muscular humanoid with human face, short upright red mohawk and stern expression, broad green segmented armour over a… | `gero-android-laboratory/1.webp` |
| 2 | Android 17 | `weapon_shield` | short | defensive | 25 | Warden | Authentic adult Android 17 from Dragon Ball Z Cell saga, slim athletic human-looking male with pale skin, chin-length straight black hair parted at middle, red/orange neck scarf, short-sleeved black… | `gero-android-laboratory/2.webp` |
| 3 | Android 18 | `dual_wield` | short | offensive | 10 | Sprinter | Authentic adult Android 18 from Dragon Ball Z Cell saga, human-looking athletic woman, fair skin, chin-length side-parted straight blonde bob and blue eyes, denim vest and short denim skirt over… | `gero-android-laboratory/3.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Android 16 | Training Rifle (₡50,000) | Plasma Cannon (₡408,000) |
| 2 Android 17 | Laser Pistol + Light Shield (₡108,000) | Volt Sabre + Aegis Bulwark (₡834,000) |
| 3 Android 18 | Laser Pistol ×2 (₡114,000) | Volt Sabre ×2 (₡850,000) |

**Refinement plans** (generated; applied by Trio goal 22, Refine → 10 steps per robot). All 3 robots: 25 steps, ₡11,290,000; the 3 robots at the target: ₡11,290,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Android 16 (5 steps, ₡2,810,000) | Plasma Cannon (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (7 → 8) ₡10,000 | ₡2,810,000 |
| Android 17 (10 steps, ₡2,860,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (8 → 9) ₡10,000 | ₡2,810,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |
| Android 18 (10 steps, ₡5,620,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 · 9 Hone Power Core +1 (−3 → −2) ₡10,000 | ₡2,810,000 |
|  | Volt Sabre (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 · 10 Hone Power Core +1 (−3 → −2) ₡10,000 | ₡2,810,000 |

Storage (estimate; the engine counts at run time): 5 final weapons equipped at the robots target of 3. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5), A09 ×1 (decision 8, 17).

Source findings before decisions: A01 ×1, A03 ×1, A09 ×1, V13 ×3.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 103. Aumaan Orbital Foundry (`aumaan-orbital-foundry`) — Duo

| Field | Value |
|---|---|
| Stable name | Aumaan Orbital Foundry |
| Franchise label | Zone of the Enders |
| Backstory | Two sculpted combat frames trade mobility against distant firepower. Their arena partnership depends on balanced investment rather than either machine dominating the workshop budget. |
| Strategy | Duo |
| Target overrides | none (goal 13 Robots → 2, the strategy default) |
| Team names | 2v2: **Orbital Frames** (robots 1+2) · 3v3: none |
| Event order | `league_2v2`, `tag_team`, `tournament_2v2`, `league_1v1`, `koth`, `grand_melee`, `tournament_1v1`, `league_3v3`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- 2v2 team 1+2: 'Orbital Pair Pair 01' → 'Orbital Frames' (decision 14; delegated authoring)

Every blueprint is used at the robots target of 2; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Jehuty | `single` | short | balanced | 20 | Sprinter | Authentic standard Jehuty orbital frame from Zone of the Enders: The 2nd Runner: elegant slender sculpted blue-grey and off-white humanoid mecha, orange/gold accents, turquoise Metatron lines… | `aumaan-orbital-foundry/1.webp` |
| 2 | Anubis | `two_handed` | long | balanced | 15 | Deadeye | Refine ONLY the framing of this Anubis robot portrait. | `aumaan-orbital-foundry/2.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Jehuty | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |
| 2 Anubis | Training Beam (₡50,000) | Ion Beam (₡544,000) |

**Refinement plans** (generated; applied by Duo goal 17, Refine → 10 steps per robot). All 2 robots: 10 steps, ₡5,620,000; the 2 robots at the target: ₡5,620,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Jehuty (5 steps, ₡2,810,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Power Core +1 (−3 → −2) ₡10,000 | ₡2,810,000 |
| Anubis (5 steps, ₡2,810,000) | Ion Beam (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (8 → 9) ₡10,000 | ₡2,810,000 |

Storage (estimate; the engine counts at run time): 2 final weapons equipped at the robots target of 2. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5).

Source findings before decisions: A01 ×1, A03 ×1, V13 ×2.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 104. Corpus Proxy Exchange (`corpus-proxy-exchange`) — Trio

| Field | Value |
|---|---|
| Stable name | Corpus Proxy Exchange |
| Franchise label | Warframe |
| Backstory | The Exchange buys machines the way other firms buy securities: in complementary lots. Three light proxies establish the account; three Bursas turn it into a six-unit enforcement portfolio. |
| Strategy | Trio |
| Target overrides | goal 12 Robots → 6 (strategy default 3, allowed 3–6) |
| Team names | 2v2: **Margin Call** (robots 1+2), **Liquid Assets** (3+4), **Hostile Takeover** (5+6) · 3v3: **Proxy Prospectus** (1–3), **Bursa Board** (4–6) |
| Event order | `league_3v3`, `league_2v2`, `tag_team`, `tournament_3v3`, `tournament_2v2`, `league_1v1`, `koth`, `grand_melee`, `tournament_1v1` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- Strategy: Squadron → Trio (decision 12)

Every blueprint is used at the robots target of 6; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Scrip MOA | `single` | short | balanced | 15 | Versatile | Standard MOA walker: preserve its inverted-knee legs, source sensor assembly, and weapon mount. One short-range arena emitter; no invented humanoid arms. | `corpus-proxy-exchange/1.webp` |
| 2 | Ledger MOA | `single` | long | balanced | 20 | Deadeye | Use the standard Railgun MOA model and its distinctive source cannon assembly. One long-range emitter in the existing mount; preserve the walker silhouette. | `corpus-proxy-exchange/2.webp` |
| 3 | Margin MOA | `two_handed` | mid | offensive | 10 | Bruiser | Use the Fusion MOA source body and its larger gun assembly. A single heavy mid-range arena weapon consumes the two-handed equipment allocation; depict no extra deployed drone. | `corpus-proxy-exchange/3.webp` |
| 4 | Escrow Bursa | `weapon_shield` | short | defensive | 25 | Warden | Standard Denial Bursa body, frontal protection, and source locomotion. One short-range weapon and one represented shield item; frontal plates do not provide extra free shield statistics. | `corpus-proxy-exchange/4.webp` |
| 5 | Dividend Bursa | `two_handed` | short | offensive | 10 | Bruiser | Use the standard Drover Bursa chassis and source armament silhouette. One heavy short-range arena emitter; retain the machine body rather than adding hands. | `corpus-proxy-exchange/5.webp` |
| 6 | Audit Bursa | `weapon_shield` | mid | defensive | 20 | Tactician | Standard Isolator Bursa body with recognizable frontal protection. One mid-range emitter and one shield allocation; source nullification effects remain narrative flavour. | `corpus-proxy-exchange/6.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Scrip MOA | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |
| 2 Ledger MOA | Beam Pistol (₡93,000) | Particle Lance (₡425,000) |
| 3 Margin MOA | Training Rifle (₡50,000) | Plasma Cannon (₡408,000) |
| 4 Escrow Bursa | Laser Pistol + Light Shield (₡108,000) | Volt Sabre + Aegis Bulwark (₡834,000) |
| 5 Dividend Bursa | Scatter Cannon (₡84,000) | Arc Projector (₡488,000) |
| 6 Audit Bursa | Bolt Carbine + Combat Shield (₡171,000) | Nova Caster + Aegis Bulwark (₡834,000) |

**Refinement plans** (generated; applied by Trio goal 22, Refine → 10 steps per robot). All 6 robots: 40 steps, ₡17,300,000; the 6 robots at the target: ₡17,300,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Scrip MOA (5 steps, ₡2,890,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +3 (6 → 9) ₡90,000 | ₡2,890,000 |
| Ledger MOA (5 steps, ₡2,890,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +3 (5 → 8) ₡90,000 | ₡2,890,000 |
| Margin MOA (5 steps, ₡2,890,000) | Plasma Cannon (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +3 (7 → 10) ₡90,000 | ₡2,890,000 |
| Escrow Bursa (10 steps, ₡2,870,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Armor Plating +1 (new) ₡20,000 | ₡2,820,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |
| Dividend Bursa (5 steps, ₡2,890,000) | Arc Projector (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +3 (7 → 10) ₡90,000 | ₡2,890,000 |
| Audit Bursa (10 steps, ₡2,870,000) | Nova Caster (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Combat Algorithms +1 (new) ₡20,000 | ₡2,820,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |

Storage (estimate; the engine counts at run time): 8 final weapons equipped at the robots target of 6. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need Storage Facility L1; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Source findings before decisions: V06 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 105. Walking War Foundry (`walking-war-foundry`) — Trio

| Field | Value |
|---|---|
| Stable name | Walking War Foundry |
| Franchise label | War Robots |
| Backstory | The Foundry opens with a shielded spearhead, a ranged platform, and a stubborn brawler. Its second delivery completes a six-machine formation built to keep three pairs and two trios in work. |
| Strategy | Trio |
| Target overrides | goal 12 Robots → 6 (strategy default 3, allowed 3–6) |
| Team names | 2v2: **Steel Vow** (robots 1+2), **Thunder March** (3+4), **Iron Horizon** (5+6) · 3v3: **Foundry Vanguard** (1–3), **Walking Thunder** (4–6) |
| Event order | `league_3v3`, `league_2v2`, `tag_team`, `tournament_3v3`, `tournament_2v2`, `league_1v1`, `koth`, `grand_melee`, `tournament_1v1` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- Strategy: Squadron → Trio (decision 12)

Every blueprint is used at the robots target of 6; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Lancelot WR | `weapon_shield` | short | defensive | 20 | Warden | Standard Lancelot armour, broad torso, and recognizable shielded front. Source silhouette with one short-range weapon and one equipped shield; the visual plates add no separate armour buff. | `walking-war-foundry/1.webp` |
| 2 | Natasha | `two_handed` | long | offensive | 10 | Deadeye | Standard Natasha walking chassis and source weapon-mount arrangement. Represent one heavy long-range arena weapon, keeping every limb and the entire barrel inside the portrait. | `walking-war-foundry/2.webp` |
| 3 | Fenrir | `two_handed` | mid | balanced | 15 | Bruiser | Use the standard Fenrir body and source armour shapes, not a special skin. One heavy mid-range weapon; choose one stationary pose without duplicating transformed configurations. | `walking-war-foundry/3.webp` |
| 4 | Griffin | `dual_wield` | short | offensive | 10 | Sprinter | Preserve Griffin legs, torso, and recognizable jump assembly. Two short-range weapons occupy main and offhand allocations; jumping remains visual flavour. | `walking-war-foundry/4.webp` |
| 5 | Leo | `two_handed` | mid | balanced | 15 | Bruiser | Standard Leo frame, sturdy legs, and heavy weapon silhouette. One mid-range two-handed allocation; source hardpoint counts do not create additional arena weapon slots. | `walking-war-foundry/5.webp` |
| 6 | Fujin | `weapon_shield` | long | defensive | 25 | Tactician | Keep Fujin quadrupedal construction and its elevated weapon body. One long-range weapon and one shield allocation; retain the source shield impression without extra free abilities. | `walking-war-foundry/6.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Lancelot WR | Laser Pistol + Light Shield (₡108,000) | Volt Sabre + Aegis Bulwark (₡834,000) |
| 2 Natasha | Training Beam (₡50,000) | Ion Beam (₡544,000) |
| 3 Fenrir | Training Rifle (₡50,000) | Plasma Cannon (₡408,000) |
| 4 Griffin | Laser Pistol ×2 (₡114,000) | Volt Sabre ×2 (₡850,000) |
| 5 Leo | Training Rifle (₡50,000) | Plasma Cannon (₡408,000) |
| 6 Fujin | Beam Pistol + Combat Shield (₡171,000) | Particle Lance + Aegis Bulwark (₡834,000) |

**Refinement plans** (generated; applied by Trio goal 22, Refine → 10 steps per robot). All 6 robots: 45 steps, ₡20,190,000; the 6 robots at the target: ₡20,190,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Lancelot WR (10 steps, ₡2,870,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Armor Plating +1 (new) ₡20,000 | ₡2,820,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |
| Natasha (5 steps, ₡2,890,000) | Ion Beam (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +3 (4 → 7) ₡90,000 | ₡2,890,000 |
| Fenrir (5 steps, ₡2,890,000) | Plasma Cannon (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +3 (7 → 10) ₡90,000 | ₡2,890,000 |
| Griffin (10 steps, ₡5,780,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 · 9 Hone Power Core +3 (−3 → 0) ₡90,000 | ₡2,890,000 |
|  | Volt Sabre (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 · 10 Hone Power Core +3 (−3 → 0) ₡90,000 | ₡2,890,000 |
| Leo (5 steps, ₡2,890,000) | Plasma Cannon (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +3 (7 → 10) ₡90,000 | ₡2,890,000 |
| Fujin (10 steps, ₡2,870,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Combat Algorithms +1 (new) ₡20,000 | ₡2,820,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |

Storage (estimate; the engine counts at run time): 9 final weapons equipped at the robots target of 6. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need Storage Facility L1; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Source findings before decisions: V06 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 106. Polanian Dieselworks (`polanian-dieselworks`) — Tycoon

| Field | Value |
|---|---|
| Stable name | Polanian Dieselworks |
| Franchise label | Iron Harvest |
| Backstory | Riveted walkers keep the dieselworks earning while the owners expand its facilities. The eventual trio covers practical fire, heavy contact and long-range support. |
| Strategy | Tycoon |
| Target overrides | goal 20 Robots → 3 (strategy default 2, allowed 2–3) |
| Team names | 2v2: **Riveted Vanguard** (robots 1+2) · 3v3: **Polanian Mech Column** (1–3) |
| Event order | `league_2v2`, `tag_team`, `league_1v1`, `league_3v3`, `koth`, `grand_melee`, `tournament_2v2`, `tournament_3v3`, `tournament_1v1` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- Franchise label: 'Iron Harvest / World of 1920+' → 'Iron Harvest' (decisions 13, 14, 16, 18; delegated authoring)
- 2v2 team 1+2: 'Polanian Pair 01' → 'Riveted Vanguard' (decisions 13, 14, 16, 18; delegated authoring)
- 3v3 team 1+2+3: 'Polanian Squad 01' → 'Polanian Mech Column' (decisions 13, 14, 16, 18; delegated authoring)
- Slot 1 robot name: 'PZM-7 Śmiały' → 'PZM-7 Smialy' (decisions 13, 14, 16, 18; delegated authoring)
- Slot 1 portrait: aligned (decisions 13, 14, 16, 18; delegated authoring)
- Slot 2 robot name: 'PZM-11 Łowca' → 'PZM-11 Lowca' (decisions 13, 14, 16, 18; delegated authoring)
- Slot 2 portrait: aligned (decisions 13, 14, 16, 18; delegated authoring)

Every blueprint is used at the robots target of 3; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | PZM-7 Smialy | `single` | mid | balanced | 15 | Tactician | Authentic PZM-7 Śmiały light Polanian mech from Iron Harvest: tall slender dieselpunk humanoid walker with cylindrical riveted olive-green armoured hull, thin mechanical arms and long spindly… | `polanian-dieselworks/1.webp` |
| 2 | PZM-11 Lowca | `two_handed` | melee | offensive | 10 | Bruiser | Authentic PZM-11 Łowca Polanian mech hunter from Iron Harvest, source medium-armoured dieselpunk biped with cylindrical riveted green/grey main hull, slender articulated lower legs and recognisable… | `polanian-dieselworks/2.webp` |
| 3 | PZM-24 Tur | `two_handed` | long | balanced | 15 | Deadeye | Authentic PZM-24 Tur superheavy Polanian mech from Iron Harvest, massive broad riveted cylindrical/bulbous dieselpunk hull on TWO huge mechanical legs, characteristic paired heavy source arm… | `polanian-dieselworks/3.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 PZM-7 Smialy | Bolt Carbine (₡93,000) | Nova Caster (₡425,000) |
| 2 PZM-11 Lowca | Shock Maul (₡183,000) | Heavy Hammer (₡478,000) |
| 3 PZM-24 Tur | Training Beam (₡50,000) | Ion Beam (₡544,000) |

**Refinement plans** (generated; applied by Tycoon goal 25, Refine → 10 steps per robot). All 3 robots: 15 steps, ₡8,500,000; the 3 robots at the target: ₡8,500,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| PZM-7 Smialy (5 steps, ₡2,820,000) | Nova Caster (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Combat Algorithms +1 (new) ₡20,000 | ₡2,820,000 |
| PZM-11 Lowca (5 steps, ₡2,840,000) | Heavy Hammer (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +2 (7 → 9) ₡40,000 | ₡2,840,000 |
| PZM-24 Tur (5 steps, ₡2,840,000) | Ion Beam (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +2 (8 → 10) ₡40,000 | ₡2,840,000 |

Storage (estimate; the engine counts at run time): 3 final weapons equipped at the robots target of 3. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Source findings before decisions: A03 ×1, A13 ×2, V03 ×2, V08 ×1, V13 ×3, V18 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 107. Vaucanson Clockwork Atelier (`vaucanson-clockwork-atelier`) — Paragon

| Field | Value |
|---|---|
| Stable name | Vaucanson Clockwork Atelier |
| Franchise label | Steelrising |
| Backstory | Fine mechanisms and a disciplined guard make this atelier a patient champion's workshop. Its one automaton earns carefully staged shield and weapon improvements. |
| Strategy | Paragon |
| Target overrides | none (goal 8 Robots → 1, the strategy default) |
| Team names | 2v2: none · 3v3: none |
| Event order | `league_1v1`, `tournament_1v1`, `koth`, `grand_melee`, `league_2v2`, `tag_team`, `tournament_2v2`, `league_3v3`, `tournament_3v3` |

**Changes from your draft**: none.

Every blueprint is used at the robots target of 1; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Aegis | `weapon_shield` | melee | defensive | 25 | Warden | Authentic Aegis from Steelrising, an elegant female clockwork automaton with porcelain-like sculpted face, finely engraved brass/steel mechanisms, intricate exposed joints, source eighteenth-century… | `vaucanson-clockwork-atelier/1.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Aegis | Practice Sword + Light Shield (₡101,000) | Vibro Mace + Aegis Bulwark (₡834,000) |

**Refinement plans** (generated; applied by Paragon goal 16, Refine → 10 steps per robot). The only blueprint: 4 steps, ₡2,800,000; the robot at the target: ₡2,800,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Aegis (4 steps, ₡2,800,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 | ₡2,800,000 |
|  | Aegis Bulwark (offhand) | no step (allowed: shields need no step) | ₡0 |

Storage (estimate; the engine counts at run time): 2 final weapons equipped at the robots target of 1. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5).

Source findings before decisions: A01 ×1, V13 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 108. Robot Systems Workshop (`robot-systems-workshop`) — Paragon

| Field | Value |
|---|---|
| Stable name | Robot Systems Workshop |
| Franchise label | Invincible |
| Backstory | A compact command machine turns a small systems workshop into a one-frame contender. Precise equipment purchases matter more than a parade of spare bodies. |
| Strategy | Paragon |
| Target overrides | none (goal 8 Robots → 1, the strategy default) |
| Team names | 2v2: none · 3v3: none |
| Event order | `league_1v1`, `tournament_1v1`, `koth`, `grand_melee`, `league_2v2`, `tag_team`, `tournament_2v2`, `league_3v3`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- Slot 1 'Robot': numbered name accepted as a canon designation (decision 15; delegated authoring)

Every blueprint is used at the robots target of 1; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Robot | `single` | mid | balanced | 15 | Tactician | Authentic Robot from Invincible television season one, complete green mechanical combat body: compact angular green armoured humanoid, boxy green helmet with dark narrow source eye slit… | `robot-systems-workshop/1.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Robot | Bolt Carbine (₡93,000) | Nova Caster (₡425,000) |

**Refinement plans** (generated; applied by Paragon goal 16, Refine → 10 steps per robot). The only blueprint: 4 steps, ₡2,800,000; the robot at the target: ₡2,800,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Robot (4 steps, ₡2,800,000) | Nova Caster (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 | ₡2,800,000 |

Storage (estimate; the engine counts at run time): 1 final weapons equipped at the robots target of 1. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5).

Source findings before decisions: A01 ×1, V03 ×1, V13 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 109. CORE War Foundry (`core-war-foundry`) — Swarm

| Field | Value |
|---|---|
| Stable name | CORE War Foundry |
| Franchise label | Total Annihilation |
| Backstory | The war foundry builds an infantry base, then adds specialised assault and support frames. Recruitment takes priority over polishing an expensive flagship. |
| Strategy | Swarm |
| Target overrides | none (goal 10 Robots → 11, the strategy default) |
| Team names | 2v2: **Commander Escort** (robots 1+2), **Artillery Line** (3+4), **Flame and Fist** (5+6), **Crawling Defence** (7+8), **Missile Battery** (9+10) · 3v3: **Kbot Lab Wave** (1–3), **Heavy Kbot Push** (4–6), **CORE Contingency** (7–9) |
| Event order | `league_3v3`, `league_2v2`, `tag_team`, `league_1v1`, `koth`, `grand_melee`, `tournament_3v3`, `tournament_2v2`, `tournament_1v1` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- 2v2 team 1+2: 'CORE Foundry Pair 01' → 'Commander Escort' (decisions 14, 18; delegated authoring)
- 2v2 team 3+4: 'CORE Foundry Pair 02' → 'Artillery Line' (decisions 14, 18; delegated authoring)
- 2v2 team 5+6: 'CORE Foundry Pair 03' → 'Flame and Fist' (decisions 14, 18; delegated authoring)
- 2v2 team 7+8: 'CORE Foundry Pair 04' → 'Crawling Defence' (decisions 14, 18; delegated authoring)
- 2v2 team 9+10: 'CORE Foundry Pair 05' → 'Missile Battery' (decisions 14, 18; delegated authoring)
- 3v3 team 1+2+3: 'CORE Foundry Squad 01' → 'Kbot Lab Wave' (decisions 14, 18; delegated authoring)
- 3v3 team 4+5+6: 'CORE Foundry Squad 02' → 'Heavy Kbot Push' (decisions 14, 18; delegated authoring)
- 3v3 team 7+8+9: 'CORE Foundry Squad 03' → 'CORE Contingency' (decisions 14, 18; delegated authoring)
- Slot 1 robot name: 'CORE Commander 01' → 'CORE Commander' (decisions 14, 18; delegated authoring)
- Slot 1 art brief: 'Recognizable original Total Annihilation CORE Commander, tall bulky grey/red armoured humanoid Kbot with distinctive broad command torso, small source sensor head, sturdy blocky legs, source weapon…' → 'Hulking grey-and-red CORE Commander, domed sensor head, heavy arm cannon and a three-finger build claw' (decisions 14, 18; delegated authoring)
- Slot 1 portrait: aligned (decisions 14, 18; delegated authoring)
- Slot 2 robot name: 'AK 02' → 'AK' (decisions 14, 18; delegated authoring)
- Slot 2 art brief: 'Original Total Annihilation CORE AK light laser Kbot: small agile thin grey mechanical biped, compact source torso and sensor head, narrow jointed legs and source light laser armament, red…' → 'Lean two-legged AK kbot, red-striped wedge head with a red sensor, single forward laser gun' (decisions 14, 18; delegated authoring)
- Slot 2 portrait: aligned (decisions 14, 18; delegated authoring)
- Slot 3 robot name: 'Storm 03' → 'Storm' (decisions 14, 18; delegated authoring)
- Slot 3 art brief: 'Original Total Annihilation CORE Storm rocket Kbot, source compact bipedal missile robot with chunky upper launch assembly and slim mechanical legs, grey armour with red team markings.' → 'Stocky Storm rocket kbot, twin six-tube rocket boxes on its shoulders, red-striped grey armour' (decisions 14, 18; delegated authoring)
- Slot 3 portrait: aligned (decisions 14, 18; delegated authoring)
- Slot 4 robot name: 'Thud 04' → 'Thud' (decisions 14, 18; delegated authoring)
- Slot 4 art brief: 'Original Total Annihilation CORE Thud artillery Kbot: squat two-legged mechanical artillery body with recognisable source paired cannon housings, broad compact torso and sturdy short legs, grey…' → 'Squat Thud artillery kbot, two raised plasma cannon barrels on the shoulders, red-panelled armour' (decisions 14, 18; delegated authoring)
- Slot 4 portrait: aligned (decisions 14, 18; delegated authoring)
- Slot 5 robot name: 'Pyro 05' → 'Pyro' (decisions 14, 18; delegated authoring)
- Slot 5 art brief: 'Original Total Annihilation CORE Pyro flamethrower Kbot: recognizable compact stocky rounded armoured biped and source flamethrower nozzle assembly, grey and red team-colour plating, thick…' → 'Hunched Pyro kbot, red domed head, twin fuel tanks on the back, perforated flamethrower nozzle' (decisions 14, 18; delegated authoring)
- Slot 5 portrait: aligned (decisions 14, 18; delegated authoring)
- Slot 6 robot name: 'Sumo 06' → 'Sumo' (decisions 14, 18; delegated authoring)
- Slot 6 art brief: 'Original Total Annihilation CORE Sumo heavy laser Kbot: extremely broad squat heavy mechanical biped, distinctive massive round/barrel-like armoured upper body and source heavy laser aperture, thick…' → 'Round heavy Sumo kbot, spherical grey-and-red armoured body on thick legs, forward laser port' (decisions 14, 18; delegated authoring)
- Slot 6 portrait: aligned (decisions 14, 18; delegated authoring)
- Slot 7 robot name: 'The Can 07' → 'The Can' (decisions 14, 18; delegated authoring)
- Slot 7 art brief: 'Original Total Annihilation CORE The Can advanced armoured Kbot: source tall cylindrical heavily plated canister-like main body, compact cannon aperture, TWO robust articulated mechanical legs and…' → 'Cylindrical The Can kbot, red-banded armoured drum on two legs, small cannon in a front slot' (decisions 14, 18; delegated authoring)
- Slot 7 portrait: aligned (decisions 14, 18; delegated authoring)
- Slot 8 robot name: 'Roach 08' → 'Roach' (decisions 14, 18; delegated authoring)
- Slot 8 art brief: 'Original Total Annihilation CORE Roach crawling-bomb robot, intact safe dormant state: small low compact insect-like mechanical walking mine with its authentic source red/grey armoured shell, short…' → 'Low red-and-grey Roach crawling bomb, flat armoured dome on four short legs, no visible weapon' (decisions 14, 18; delegated authoring)
- Slot 8 portrait: aligned (decisions 14, 18; delegated authoring)
- Slot 9 robot name: 'Morty 09' → 'Morty' (decisions 14, 18; delegated authoring)
- Slot 9 art brief: 'Original Total Annihilation CORE Morty mortar Kbot: recognizable source compact mobile artillery robot with high-trajectory mortar barrel assembly on its original walking Kbot chassis, grey metallic…' → 'Two-legged Morty mortar kbot, large red-tipped mortar tube angled up from its grey armoured body' (decisions 14, 18; delegated authoring)
- Slot 9 portrait: aligned (decisions 14, 18; delegated authoring)
- Slot 10 robot name: 'Dominator 10' → 'Dominator' (decisions 14, 18; delegated authoring)
- Slot 10 art brief: 'Original Total Annihilation CORE Dominator advanced rocket Kbot: source broad angular missile-carrying upper chassis on articulated mechanical walking legs, recognizable original launch-tube…' → 'Broad Dominator kbot, four nine-tube missile boxes across its shoulders, red-striped grey legs' (decisions 14, 18; delegated authoring)
- Slot 10 portrait: aligned (decisions 14, 18; delegated authoring)
- Slot 11 robot name: 'Krogoth 11' → 'Krogoth' (decisions 14, 18; delegated authoring)
- Slot 11 art brief: 'Refine this existing Armoured Souls Krogoth portrait.' → 'Towering Krogoth, blocky grey-and-red armour, small head between shoulder vents, twin arm cannons' (decisions 14, 18; delegated authoring)
- Slot 11 portrait: aligned (decisions 14, 18; delegated authoring)

Every blueprint is used at the robots target of 11; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | CORE Commander | `single` | mid | balanced | 15 | Tactician | Hulking grey-and-red CORE Commander, domed sensor head, heavy arm cannon and a three-finger build claw | `core-war-foundry/1.webp` |
| 2 | AK | `single` | short | balanced | 15 | Versatile | Lean two-legged AK kbot, red-striped wedge head with a red sensor, single forward laser gun | `core-war-foundry/2.webp` |
| 3 | Storm | `two_handed` | mid | offensive | 10 | Bruiser | Stocky Storm rocket kbot, twin six-tube rocket boxes on its shoulders, red-striped grey armour | `core-war-foundry/3.webp` |
| 4 | Thud | `two_handed` | mid | offensive | 10 | Bruiser | Squat Thud artillery kbot, two raised plasma cannon barrels on the shoulders, red-panelled armour | `core-war-foundry/4.webp` |
| 5 | Pyro | `two_handed` | short | offensive | 10 | Bruiser | Hunched Pyro kbot, red domed head, twin fuel tanks on the back, perforated flamethrower nozzle | `core-war-foundry/5.webp` |
| 6 | Sumo | `two_handed` | melee | offensive | 10 | Bruiser | Round heavy Sumo kbot, spherical grey-and-red armoured body on thick legs, forward laser port | `core-war-foundry/6.webp` |
| 7 | The Can | `weapon_shield` | short | defensive | 25 | Warden | Cylindrical The Can kbot, red-banded armoured drum on two legs, small cannon in a front slot | `core-war-foundry/7.webp` |
| 8 | Roach | `single` | melee | offensive | 10 | Sprinter | Low red-and-grey Roach crawling bomb, flat armoured dome on four short legs, no visible weapon | `core-war-foundry/8.webp` |
| 9 | Morty | `two_handed` | long | balanced | 15 | Deadeye | Two-legged Morty mortar kbot, large red-tipped mortar tube angled up from its grey armoured body | `core-war-foundry/9.webp` |
| 10 | Dominator | `two_handed` | long | balanced | 15 | Deadeye | Broad Dominator kbot, four nine-tube missile boxes across its shoulders, red-striped grey legs | `core-war-foundry/10.webp` |
| 11 | Krogoth | `two_handed` | mid | offensive | 10 | Bruiser | Towering Krogoth, blocky grey-and-red armour, small head between shoulder vents, twin arm cannons | `core-war-foundry/11.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 CORE Commander | Bolt Carbine (₡93,000) | Nova Caster (₡425,000) |
| 2 AK | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |
| 3 Storm | Training Rifle (₡50,000) | Plasma Cannon (₡408,000) |
| 4 Thud | Training Rifle (₡50,000) | Plasma Cannon (₡408,000) |
| 5 Pyro | Scatter Cannon (₡84,000) | Arc Projector (₡488,000) |
| 6 Sumo | Shock Maul (₡183,000) | Heavy Hammer (₡478,000) |
| 7 The Can | Laser Pistol + Light Shield (₡108,000) | Volt Sabre + Aegis Bulwark (₡834,000) |
| 8 Roach | Practice Sword (₡50,000) | Vibro Mace (₡425,000) |
| 9 Morty | Training Beam (₡50,000) | Ion Beam (₡544,000) |
| 10 Dominator | Training Beam (₡50,000) | Ion Beam (₡544,000) |
| 11 Krogoth | Training Rifle (₡50,000) | Plasma Cannon (₡408,000) |

**Refinement plans** (generated; applied by Swarm goal 23, Refine → 8 steps per robot). All 11 robots: 60 steps, ₡32,330,000; the 11 robots at the target: ₡32,330,000; Refine → 8 applies ₡32,310,000 of the target robots' plans.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| CORE Commander (5 steps, ₡2,820,000) | Nova Caster (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Combat Algorithms +1 (new) ₡20,000 | ₡2,820,000 |
| AK (5 steps, ₡2,960,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| Storm (5 steps, ₡2,960,000) | Plasma Cannon (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Critical Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| Thud (5 steps, ₡2,960,000) | Plasma Cannon (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Critical Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| Pyro (5 steps, ₡2,960,000) | Arc Projector (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| Sumo (5 steps, ₡2,960,000) | Heavy Hammer (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Critical Systems +4 (4 → 8) ₡160,000 | ₡2,960,000 |
| The Can (10 steps, ₡2,870,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Armor Plating +1 (new) ₡20,000 | ₡2,820,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |
| Roach (5 steps, ₡2,960,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Gyro Stabilizers +4 (4 → 8) ₡160,000 | ₡2,960,000 |
| Morty (5 steps, ₡2,960,000) | Ion Beam (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (4 → 8) ₡160,000 | ₡2,960,000 |
| Dominator (5 steps, ₡2,960,000) | Ion Beam (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (4 → 8) ₡160,000 | ₡2,960,000 |
| Krogoth (5 steps, ₡2,960,000) | Plasma Cannon (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Critical Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |

Storage (estimate; the engine counts at run time): 12 final weapons equipped at the robots target of 11. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need Storage Facility L2; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Source findings before decisions: A03 ×2, A13 ×11, V13 ×11.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 110. Arena Systems Consortium (`arena-systems-consortium`) — Trio

| Field | Value |
|---|---|
| Stable name | Arena Systems Consortium |
| Franchise label | Mech Arena |
| Backstory | The Consortium fields a protected opening trio and spends its next contracts on mobility and precision. Six specialist chassis make a complete arena squadron, with every machine assigned to a pair and a trio. |
| Strategy | Trio |
| Target overrides | goal 12 Robots → 6 (strategy default 3, allowed 3–6) |
| Team names | 2v2: **Bastion Protocol** (robots 1+2), **Breach Circuit** (3+4), **Crossfire Signal** (5+6) · 3v3: **Iron Formation** (1–3), **Rapid Response** (4–6) |
| Event order | `league_3v3`, `league_2v2`, `tag_team`, `tournament_3v3`, `tournament_2v2`, `league_1v1`, `koth`, `grand_melee`, `tournament_1v1` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- Strategy: Squadron → Trio (decision 12)

Every blueprint is used at the robots target of 6; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Juggernaut | `weapon_shield` | short | defensive | 20 | Warden | Use the standard Juggernaut model, retaining its stocky protective frame and original leg arrangement. One short weapon and one shield item; readable defensive pose. | `arena-systems-consortium/1.webp` |
| 2 | Ares | `weapon_shield` | mid | balanced | 20 | Tactician | Standard Ares source body with its recognizable frontal shield presentation. One mid-range weapon plus shield; source barrier ability is represented only by equipped arena gear. | `arena-systems-consortium/2.webp` |
| 3 | Guardian MA | `two_handed` | mid | offensive | 15 | Bruiser | Use the standard Guardian chassis and characteristic source head and torso. One heavy mid-range weapon; no system-crash, EMP, or opponent-control mechanic is granted. | `arena-systems-consortium/3.webp` |
| 4 | Killshot | `two_handed` | short | offensive | 10 | Sprinter | Preserve the low, agile Killshot source chassis and its original locomotion geometry. One heavy short-range weapon; the dash is a pose cue rather than an added movement ability. | `arena-systems-consortium/4.webp` |
| 5 | Panther | `single` | long | balanced | 15 | Deadeye | Standard Panther body with the source proportions, head, and weapon mounts. One long-range arena weapon; keep any source barrier effect out of the mechanical blueprint. | `arena-systems-consortium/5.webp` |
| 6 | Zephyr | `single` | mid | defensive | 20 | Tactician | Use the standard Zephyr model and recognizable sensor details. One mid-range weapon in a guarded pose; source electrical effects do not add a stun. | `arena-systems-consortium/6.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Juggernaut | Laser Pistol + Light Shield (₡108,000) | Volt Sabre + Aegis Bulwark (₡834,000) |
| 2 Ares | Bolt Carbine + Combat Shield (₡171,000) | Nova Caster + Aegis Bulwark (₡834,000) |
| 3 Guardian MA | Training Rifle (₡50,000) | Plasma Cannon (₡408,000) |
| 4 Killshot | Scatter Cannon (₡84,000) | Arc Projector (₡488,000) |
| 5 Panther | Beam Pistol (₡93,000) | Particle Lance (₡425,000) |
| 6 Zephyr | Bolt Carbine (₡93,000) | Nova Caster (₡425,000) |

**Refinement plans** (generated; applied by Trio goal 22, Refine → 10 steps per robot). All 6 robots: 40 steps, ₡17,160,000; the 6 robots at the target: ₡17,160,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Juggernaut (10 steps, ₡2,870,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Armor Plating +1 (new) ₡20,000 | ₡2,820,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |
| Ares (10 steps, ₡2,870,000) | Nova Caster (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Combat Algorithms +1 (new) ₡20,000 | ₡2,820,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |
| Guardian MA (5 steps, ₡2,890,000) | Plasma Cannon (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +3 (7 → 10) ₡90,000 | ₡2,890,000 |
| Killshot (5 steps, ₡2,820,000) | Arc Projector (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Hull Integrity +1 (new) ₡20,000 | ₡2,820,000 |
| Panther (5 steps, ₡2,890,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +3 (5 → 8) ₡90,000 | ₡2,890,000 |
| Zephyr (5 steps, ₡2,820,000) | Nova Caster (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Combat Algorithms +1 (new) ₡20,000 | ₡2,820,000 |

Storage (estimate; the engine counts at run time): 8 final weapons equipped at the robots target of 6. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need Storage Facility L1; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A09 ×1 (decision 8, 17).

Source findings before decisions: A09 ×1, V06 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 111. Striker Assembly Wing (`striker-assembly-wing`) — Trio

| Field | Value |
|---|---|
| Stable name | Striker Assembly Wing |
| Franchise label | Mecha BREAK |
| Backstory | The assembly wing fields a flexible shooter, a heavy contact fighter and a defensive anchor. The three frames advance together through measured equipment upgrades. |
| Strategy | Trio |
| Target overrides | none (goal 12 Robots → 3, the strategy default) |
| Team names | 2v2: **Alysnes and Welkin** (robots 1+2) · 3v3: **Mecha Break Vanguard** (1–3) |
| Event order | `league_3v3`, `tournament_3v3`, `league_2v2`, `tag_team`, `league_1v1`, `koth`, `grand_melee`, `tournament_2v2`, `tournament_1v1` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- 2v2 team 1+2: 'Striker Wing Pair 01' → 'Alysnes and Welkin' (decision 14; delegated authoring)
- 3v3 team 1+2+3: 'Striker Wing Squad 01' → 'Mecha Break Vanguard' (decision 14; delegated authoring)

Every blueprint is used at the robots target of 3; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Alysnes | `single` | short | balanced | 15 | Versatile | Authentic Mecha BREAK Alysnes in its complete armoured base form, white and blue angular plates, dark inner frame and restrained green sensor accents; correct source helmet, shoulder construction… | `striker-assembly-wing/1.webp` |
| 2 | Welkin | `two_handed` | melee | offensive | 10 | Bruiser | Authentic Mecha BREAK Welkin heavy brawler in standard red and dark armour, bulky circular shoulder modules, characteristic compact source head, green central core, heavy original legs and feet. | `striker-assembly-wing/2.webp` |
| 3 | Tricera | `weapon_shield` | short | defensive | 25 | Warden | Authentic Mecha BREAK Tricera in standard walking biped configuration, broad squat grey military body, heavy shoulder cannon housings, source dark face/cockpit and thick short legs. | `striker-assembly-wing/3.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Alysnes | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |
| 2 Welkin | Shock Maul (₡183,000) | Heavy Hammer (₡478,000) |
| 3 Tricera | Laser Pistol + Light Shield (₡108,000) | Volt Sabre + Aegis Bulwark (₡834,000) |

**Refinement plans** (generated; applied by Trio goal 22, Refine → 10 steps per robot). All 3 robots: 20 steps, ₡8,480,000; the 3 robots at the target: ₡8,480,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Alysnes (5 steps, ₡2,810,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (8 → 9) ₡10,000 | ₡2,810,000 |
| Welkin (5 steps, ₡2,810,000) | Heavy Hammer (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (7 → 8) ₡10,000 | ₡2,810,000 |
| Tricera (10 steps, ₡2,860,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (8 → 9) ₡10,000 | ₡2,810,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |

Storage (estimate; the engine counts at run time): 4 final weapons equipped at the robots target of 3. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5).

Source findings before decisions: A01 ×1, A03 ×1, V13 ×3.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 112. Arsenal Mercenary Works (`arsenal-mercenary-works`) — Tycoon

| Field | Value |
|---|---|
| Stable name | Arsenal Mercenary Works |
| Franchise label | Daemon X Machina |
| Backstory | The workshop sells dependable coverage: a flexible vanguard, a protected anchor and a precision specialist. Facility income finances the completed three-frame contract team. |
| Strategy | Tycoon |
| Target overrides | goal 20 Robots → 3 (strategy default 2, allowed 2–3) |
| Team names | 2v2: **Vanguard and Aegis** (robots 1+2) · 3v3: **Outer Mercenaries** (1–3) |
| Event order | `league_2v2`, `tag_team`, `league_1v1`, `league_3v3`, `koth`, `grand_melee`, `tournament_2v2`, `tournament_3v3`, `tournament_1v1` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- 2v2 team 1+2: 'Mercenary Works Pair 01' → 'Vanguard and Aegis' (decisions 14, 18; delegated authoring)
- 3v3 team 1+2+3: 'Mercenary Works Squad 01' → 'Outer Mercenaries' (decisions 14, 18; delegated authoring)
- Slot 1 robot name: 'Mercenary Vanguard 01' → 'Crimson Vanguard' (decisions 14, 18; delegated authoring)
- Slot 1 art brief: 'Use case: precise-object-edit.' → 'Sleek white Arsenal frame with red trim, horned head, swept shoulder fins, long assault rifle held low' (decisions 14, 18; delegated authoring)
- Slot 1 portrait: aligned (decisions 14, 18; delegated authoring)
- Slot 2 robot name: 'Mercenary Aegis 02' → 'Hornet Aegis' (decisions 14, 18; delegated authoring)
- Slot 2 art brief: 'A custom player Arsenal from the original 2019 Daemon X Machina using the heavy Liberator armour family, its broad unusual head and torso, huge protective lower-leg armour and structural prong-like…' → 'Heavy yellow-and-black Arsenal frame, broad armoured legs, glowing amber visor, assault rifle braced' (decisions 14, 18; delegated authoring)
- Slot 2 portrait: aligned (decisions 14, 18; delegated authoring)
- Slot 3 robot name: 'Mercenary Longshot 03' → 'Dune Longshot' (decisions 14, 18; delegated authoring)
- Slot 3 art brief: 'A custom player Arsenal from the original 2019 Daemon X Machina built from the recognizable Hecatonchier armour family, heavy angular mechanical torso, low source helmet, distinct original shoulder…' → 'Tan Arsenal frame with blue stripes, hooded sensor head, long scoped sniper rifle aimed forward' (decisions 14, 18; delegated authoring)
- Slot 3 portrait: aligned (decisions 14, 18; delegated authoring)

Every blueprint is used at the robots target of 3; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Crimson Vanguard | `single` | short | balanced | 15 | Versatile | Sleek white Arsenal frame with red trim, horned head, swept shoulder fins, long assault rifle held low | `arsenal-mercenary-works/1.webp` |
| 2 | Hornet Aegis | `weapon_shield` | short | defensive | 25 | Warden | Heavy yellow-and-black Arsenal frame, broad armoured legs, glowing amber visor, assault rifle braced | `arsenal-mercenary-works/2.webp` |
| 3 | Dune Longshot | `single` | long | balanced | 20 | Deadeye | Tan Arsenal frame with blue stripes, hooded sensor head, long scoped sniper rifle aimed forward | `arsenal-mercenary-works/3.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Crimson Vanguard | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |
| 2 Hornet Aegis | Laser Pistol + Light Shield (₡108,000) | Volt Sabre + Aegis Bulwark (₡834,000) |
| 3 Dune Longshot | Beam Pistol (₡93,000) | Particle Lance (₡425,000) |

**Refinement plans** (generated; applied by Tycoon goal 25, Refine → 10 steps per robot). All 3 robots: 20 steps, ₡8,550,000; the 3 robots at the target: ₡8,550,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Crimson Vanguard (5 steps, ₡2,840,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +2 (8 → 10) ₡40,000 | ₡2,840,000 |
| Hornet Aegis (10 steps, ₡2,870,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Armor Plating +1 (new) ₡20,000 | ₡2,820,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |
| Dune Longshot (5 steps, ₡2,840,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +2 (5 → 7) ₡40,000 | ₡2,840,000 |

Storage (estimate; the engine counts at run time): 4 final weapons equipped at the robots target of 3. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Source findings before decisions: A03 ×2, A13 ×3, V08 ×1, V13 ×3.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 113. Infinite War Assembly (`infinite-war-assembly`) — Tycoon

| Field | Value |
|---|---|
| Stable name | Infinite War Assembly |
| Franchise label | Supreme Commander |
| Backstory | A protected commander keeps the production account open while two lighter combat machines earn arena revenue. The factory invests in income before premium equipment. |
| Strategy | Tycoon |
| Target overrides | goal 20 Robots → 3 (strategy default 2, allowed 2–3) |
| Team names | 2v2: **UEF Command Escort** (robots 1+2) · 3v3: **UEF Frontline** (1–3) |
| Event order | `league_2v2`, `tag_team`, `league_1v1`, `league_3v3`, `koth`, `grand_melee`, `tournament_2v2`, `tournament_3v3`, `tournament_1v1` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- 2v2 team 1+2: 'Infinite Assembly Pair 01' → 'UEF Command Escort' (decisions 14, 18; delegated authoring)
- 3v3 team 1+2+3: 'Infinite Assembly Squad 01' → 'UEF Frontline' (decisions 14, 18; delegated authoring)
- Slot 2 robot name: 'Mech Marine 02' → 'Mech Marine' (decisions 14, 18; delegated authoring)
- Slot 2 art brief: 'Authentic original Supreme Commander UEF Mech Marine Tech 1 light assault bot, compact angular mechanical torso, small recessed sensor, two nimble articulated legs, source integrated gun arms, grey…' → 'Light blue-and-grey Mech Marine assault bot, hunched cockpit body, blue visor, twin arm guns' (decisions 14, 18; delegated authoring)
- Slot 2 portrait: aligned (decisions 14, 18; delegated authoring)
- Slot 3 robot name: 'Titan 03' → 'Titan' (decisions 14, 18; delegated authoring)
- Slot 3 art brief: 'Authentic original Supreme Commander UEF Titan Tech 3 heavy assault bot, wide reinforced grey-and-blue upper chassis, small source head, paired integrated cannon forearms, sturdy jointed bipedal…' → 'Heavy blue-and-grey UEF Titan assault bot, blocky shoulders, blue sensor slits, twin arm cannons' (decisions 14, 18; delegated authoring)
- Slot 3 portrait: aligned (decisions 14, 18; delegated authoring)

Every blueprint is used at the robots target of 3; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | UEF Commander | `weapon_shield` | mid | defensive | 25 | Tactician | Authentic original Supreme Commander UEF Armored Command Unit, massive blocky broad-shouldered humanoid command mech, tiny central head, thick grey armour with blue team panels, stocky two legs and… | `infinite-war-assembly/1.webp` |
| 2 | Mech Marine | `single` | short | balanced | 15 | Versatile | Light blue-and-grey Mech Marine assault bot, hunched cockpit body, blue visor, twin arm guns | `infinite-war-assembly/2.webp` |
| 3 | Titan | `two_handed` | short | offensive | 10 | Bruiser | Heavy blue-and-grey UEF Titan assault bot, blocky shoulders, blue sensor slits, twin arm cannons | `infinite-war-assembly/3.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 UEF Commander | Bolt Carbine + Light Shield (₡144,000) | Nova Caster + Aegis Bulwark (₡834,000) |
| 2 Mech Marine | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |
| 3 Titan | Scatter Cannon (₡84,000) | Arc Projector (₡488,000) |

**Refinement plans** (generated; applied by Tycoon goal 25, Refine → 10 steps per robot). All 3 robots: 20 steps, ₡8,550,000; the 3 robots at the target: ₡8,550,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| UEF Commander (10 steps, ₡2,870,000) | Nova Caster (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Combat Algorithms +1 (new) ₡20,000 | ₡2,820,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |
| Mech Marine (5 steps, ₡2,840,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +2 (8 → 10) ₡40,000 | ₡2,840,000 |
| Titan (5 steps, ₡2,840,000) | Arc Projector (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +2 (7 → 9) ₡40,000 | ₡2,840,000 |

Storage (estimate; the engine counts at run time): 4 final weapons equipped at the robots target of 3. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Source findings before decisions: A03 ×2, A13 ×2, V08 ×1, V13 ×3.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 114. Terra Nova Gearworks (`terra-nova-gearworks`) — Trio

| Field | Value |
|---|---|
| Stable name | Terra Nova Gearworks |
| Franchise label | Heavy Gear |
| Backstory | Three Northern Gears secure the first contract. Scouts and a heavy reserve follow, giving the yard a six-machine force with reconnaissance, protection, and sustained fire in each formation. |
| Strategy | Trio |
| Target overrides | goal 12 Robots → 6 (strategy default 3, allowed 3–6) |
| Team names | 2v2: **Northern Watch** (robots 1+2), **Thunder Sprint** (3+4), **Shielded Recon** (5+6) · 3v3: **Terra Nova Vanguard** (1–3), **Polar Response** (4–6) |
| Event order | `league_3v3`, `league_2v2`, `tag_team`, `tournament_3v3`, `tournament_2v2`, `league_1v1`, `koth`, `grand_melee`, `tournament_1v1` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- Strategy: Squadron → Trio (decision 12)

Every blueprint is used at the robots target of 6; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Hunter Northwind | `weapon_shield` | mid | balanced | 20 | Warden | Standard Northern Hunter chassis with its source head, armour, and mechanical joints. A mid-range arena weapon plus a clearly visible shield; retain the original Gear proportions. | `terra-nova-gearworks/1.webp` |
| 2 | Jaguar Talon | `single` | short | offensive | 10 | Versatile | Preserve the standard Jaguar scout-combat silhouette and source armour geometry. One short-range weapon in a poised stance, without changing the chassis into a Hunter variant. | `terra-nova-gearworks/2.webp` |
| 3 | Grizzly Longwatch | `two_handed` | long | balanced | 15 | Deadeye | Standard Grizzly heavy-fire-support frame and source upper-body equipment silhouette. One heavy long-range arena weapon; additional visible source housings remain passive. | `terra-nova-gearworks/3.webp` |
| 4 | Cheetah Slipstream | `dual_wield` | short | offensive | 10 | Sprinter | Use the ordinary Northern Cheetah body, not Mark Two. Two short-range arena weapons; preserve the lighter source frame and readable complete feet. | `terra-nova-gearworks/4.webp` |
| 5 | Ferret Needle | `single` | long | balanced | 20 | Deadeye | Standard Ferret source chassis with its distinctive head and light equipment arrangement. One long-range weapon; keep the compact scout silhouette distinct from Cheetah. | `terra-nova-gearworks/5.webp` |
| 6 | Kodiak Rampart | `two_handed` | mid | defensive | 20 | Bruiser | Standard Northern Kodiak body and heavy armour proportions. One mid-range heavy weapon; do not silently substitute the Kodiak Destroyer model. | `terra-nova-gearworks/6.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Hunter Northwind | Bolt Carbine + Combat Shield (₡171,000) | Nova Caster + Aegis Bulwark (₡834,000) |
| 2 Jaguar Talon | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |
| 3 Grizzly Longwatch | Training Beam (₡50,000) | Ion Beam (₡544,000) |
| 4 Cheetah Slipstream | Laser Pistol ×2 (₡114,000) | Volt Sabre ×2 (₡850,000) |
| 5 Ferret Needle | Beam Pistol (₡93,000) | Particle Lance (₡425,000) |
| 6 Kodiak Rampart | Training Rifle (₡50,000) | Plasma Cannon (₡408,000) |

**Refinement plans** (generated; applied by Trio goal 22, Refine → 10 steps per robot). All 6 robots: 40 steps, ₡20,210,000; the 6 robots at the target: ₡20,210,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Hunter Northwind (10 steps, ₡2,870,000) | Nova Caster (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Armor Plating +1 (new) ₡20,000 | ₡2,820,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |
| Jaguar Talon (5 steps, ₡2,890,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +3 (6 → 9) ₡90,000 | ₡2,890,000 |
| Grizzly Longwatch (5 steps, ₡2,890,000) | Ion Beam (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +3 (4 → 7) ₡90,000 | ₡2,890,000 |
| Cheetah Slipstream (10 steps, ₡5,780,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 · 9 Hone Power Core +3 (−3 → 0) ₡90,000 | ₡2,890,000 |
|  | Volt Sabre (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 · 10 Hone Power Core +3 (−3 → 0) ₡90,000 | ₡2,890,000 |
| Ferret Needle (5 steps, ₡2,890,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +3 (5 → 8) ₡90,000 | ₡2,890,000 |
| Kodiak Rampart (5 steps, ₡2,890,000) | Plasma Cannon (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +3 (7 → 10) ₡90,000 | ₡2,890,000 |

Storage (estimate; the engine counts at run time): 8 final weapons equipped at the robots target of 6. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need Storage Facility L1; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Source findings before decisions: V06 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 115. Variant Armor Foundry (`variant-armor-foundry`) — Generalist

| Field | Value |
|---|---|
| Stable name | Variant Armor Foundry |
| Franchise label | Cyberbots |
| Backstory | Three contrasting combat frames keep the foundry ready for changing brackets. A flexible lead, a mobile skirmisher and a heavy contact machine divide the upgrades. |
| Strategy | Generalist |
| Target overrides | goal 14 Robots → 3 (strategy default 2, allowed 2–4) |
| Team names | 2v2: **Fullmetal Madness** (robots 1+2) · 3v3: **Variant Armor Brigade** (1–3) |
| Event order | `league_1v1`, `league_2v2`, `tag_team`, `league_3v3`, `koth`, `grand_melee`, `tournament_1v1`, `tournament_2v2`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- Franchise label: 'Cyberbots / Armored Warriors' → 'Cyberbots' (decisions 14, 16; delegated authoring)
- 2v2 team 1+2: 'Variant Armor Pair 01' → 'Fullmetal Madness' (decisions 14, 16; delegated authoring)
- 3v3 team 1+2+3: 'Variant Armor Squad 01' → 'Variant Armor Brigade' (decisions 14, 16; delegated authoring)

Every blueprint is used at the robots target of 3; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Blodia | `single` | short | balanced | 15 | Versatile | Authentic Cyberbots BX-02 Blodia default red Variant Armor, iconic squat massive fighting-mech body, broad red shoulder plates, small recessed head with light sensor, immense articulated punching… | `variant-armor-foundry/1.webp` |
| 2 | Reptos | `single` | short | balanced | 20 | Sprinter | Authentic Cyberbots RF-004 Reptos default light blue Variant Armor, agile reptilian mechanical frame with source sensor cockpit/head, distinctive long-barrel arm weapon, opposite claw arm and… | `variant-armor-foundry/2.webp` |
| 3 | Guldin | `two_handed` | melee | offensive | 10 | Bruiser | Authentic Cyberbots GP-N1 Guldin default green Variant Armor, squat immense green upper body on TWO BROAD TANK TRACKS, giant clamp-like mechanical arms, compact original head/sensor and source… | `variant-armor-foundry/3.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Blodia | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |
| 2 Reptos | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |
| 3 Guldin | Shock Maul (₡183,000) | Heavy Hammer (₡478,000) |

**Refinement plans** (generated; applied by Generalist goal 18, Refine → 10 steps per robot). All 3 robots: 15 steps, ₡8,520,000; the 3 robots at the target: ₡8,520,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Blodia (5 steps, ₡2,840,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +2 (8 → 10) ₡40,000 | ₡2,840,000 |
| Reptos (5 steps, ₡2,840,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Power Core +2 (−3 → −1) ₡40,000 | ₡2,840,000 |
| Guldin (5 steps, ₡2,840,000) | Heavy Hammer (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +2 (7 → 9) ₡40,000 | ₡2,840,000 |

Storage (estimate; the engine counts at run time): 3 final weapons equipped at the robots target of 3. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5).

Source findings before decisions: A01 ×1, A03 ×1, V08 ×1, V13 ×3, V18 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 116. Scopedog Motor Pool (`scopedog-motor-pool`) — Trio

| Field | Value |
|---|---|
| Stable name | Scopedog Motor Pool |
| Franchise label | Armored Trooper VOTOMS |
| Backstory | Compact military walkers bring practical fire, protected endurance and heavy pressure to the same maintenance bay. The motor pool equips the whole trio before chasing prestige purchases. |
| Strategy | Trio |
| Target overrides | none (goal 12 Robots → 3, the strategy default) |
| Team names | 2v2: **Uoodo Patrol** (robots 1+2) · 3v3: **Red Shoulder Battalion** (1–3) |
| Event order | `league_3v3`, `tournament_3v3`, `league_2v2`, `tag_team`, `league_1v1`, `koth`, `grand_melee`, `tournament_2v2`, `tournament_1v1` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- 2v2 team 1+2: 'Motor Pool Pair 01' → 'Uoodo Patrol' (decision 14; delegated authoring)
- 3v3 team 1+2+3: 'Motor Pool Squad 01' → 'Red Shoulder Battalion' (decision 14; delegated authoring)

Every blueprint is used at the robots target of 3; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Scopedog | `single` | mid | balanced | 15 | Tactician | Authentic 1983 VOTOMS standard green Scopedog, squat military biped with its iconic round three-lens turret head, boxy olive torso cockpit, rounded shoulder plates, short heavy legs and rectangular… | `scopedog-motor-pool/1.webp` |
| 2 | Standing Tortoise | `weapon_shield` | short | defensive | 25 | Warden | Use case: stylized-concept. | `scopedog-motor-pool/2.webp` |
| 3 | Diving Beetle | `two_handed` | mid | offensive | 10 | Bruiser | Authentic VOTOMS Diving Beetle standard blue heavy Armored Trooper, characteristic helmet with three sensor lenses, rounded sealed torso cockpit and shoulders, thick blue legs with source Swampy… | `scopedog-motor-pool/3.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Scopedog | Bolt Carbine (₡93,000) | Nova Caster (₡425,000) |
| 2 Standing Tortoise | Laser Pistol + Light Shield (₡108,000) | Volt Sabre + Aegis Bulwark (₡834,000) |
| 3 Diving Beetle | Training Rifle (₡50,000) | Plasma Cannon (₡408,000) |

**Refinement plans** (generated; applied by Trio goal 22, Refine → 10 steps per robot). All 3 robots: 20 steps, ₡8,480,000; the 3 robots at the target: ₡8,480,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Scopedog (5 steps, ₡2,810,000) | Nova Caster (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (8 → 9) ₡10,000 | ₡2,810,000 |
| Standing Tortoise (10 steps, ₡2,860,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (8 → 9) ₡10,000 | ₡2,810,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |
| Diving Beetle (5 steps, ₡2,810,000) | Plasma Cannon (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (7 → 8) ₡10,000 | ₡2,810,000 |

Storage (estimate; the engine counts at run time): 4 final weapons equipped at the robots target of 3. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5).

Source findings before decisions: A01 ×1, A03 ×1, V13 ×3.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 117. Mithril Arm Slave Hangar (`mithril-arm-slave-hangar`) — Duo

| Field | Value |
|---|---|
| Stable name | Mithril Arm Slave Hangar |
| Franchise label | Full Metal Panic! |
| Backstory | A mobile specialist and a disciplined marksman share a small hangar. Their partner upgrades favour reliable equipment and manageable repair costs. |
| Strategy | Duo |
| Target overrides | none (goal 13 Robots → 2, the strategy default) |
| Team names | 2v2: **Urzu Six and Seven** (robots 1+2) · 3v3: none |
| Event order | `league_2v2`, `tag_team`, `tournament_2v2`, `league_1v1`, `koth`, `grand_melee`, `tournament_1v1`, `league_3v3`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- 2v2 team 1+2: 'Mithril Pair Pair 01' → 'Urzu Six and Seven' (decision 14; delegated authoring)

Every blueprint is used at the robots target of 2; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | ARX-7 Arbalest | `single` | short | balanced | 20 | Sprinter | Authentic Full Metal Panic! | `mithril-arm-slave-hangar/1.webp` |
| 2 | M9 Gernsback | `single` | long | balanced | 20 | Deadeye | Authentic Full Metal Panic! | `mithril-arm-slave-hangar/2.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 ARX-7 Arbalest | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |
| 2 M9 Gernsback | Beam Pistol (₡93,000) | Particle Lance (₡425,000) |

**Refinement plans** (generated; applied by Duo goal 17, Refine → 10 steps per robot). All 2 robots: 10 steps, ₡5,620,000; the 2 robots at the target: ₡5,620,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| ARX-7 Arbalest (5 steps, ₡2,810,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Power Core +1 (−3 → −2) ₡10,000 | ₡2,810,000 |
| M9 Gernsback (5 steps, ₡2,810,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (5 → 6) ₡10,000 | ₡2,810,000 |

Storage (estimate; the engine counts at run time): 2 final weapons equipped at the robots target of 2. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5), A09 ×1 (decision 8, 17).

Source findings before decisions: A01 ×1, A03 ×1, A09 ×1, V13 ×2.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 118. Gutsy Robot Command (`gutsy-robot-command`) — Trio

| Field | Value |
|---|---|
| Stable name | Gutsy Robot Command |
| Franchise label | The King of Braves GaoGaiGar |
| Backstory | GGG deploys a champion and two vehicle robots, then reinforces the formation with wind, thunder, and reconnaissance. Six machines answer the call; every pair and trio has a permanent assignment. |
| Strategy | Trio |
| Target overrides | goal 12 Robots → 6 (strategy default 3, allowed 3–6) |
| Team names | 2v2: **Brave Resolve** (robots 1+2), **Wind and Fire** (3+4), **Shadow Thunder** (5+6) · 3v3: **GGG Vanguard** (1–3), **Brave Reinforcements** (4–6) |
| Event order | `league_3v3`, `league_2v2`, `tag_team`, `tournament_3v3`, `tournament_2v2`, `league_1v1`, `koth`, `grand_melee`, `tournament_1v1` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- Strategy: Squadron → Trio (decision 12)

Every blueprint is used at the robots target of 6; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | GaoGaiGar | `two_handed` | melee | offensive | 10 | Bruiser | Preserve the complete television GaoGaiGar design, lion chest, crest, and source palette. Use an original two-handed arena hammer; it is not the Goldion Hammer or another robot. | `gutsy-robot-command/1.webp` |
| 2 | HyoRyu | `single` | long | balanced | 20 | Deadeye | Blue HyoRyu vehicle-robot form with source head and body construction. One long-range arena weapon; do not depict ChoRyuJin or add freezing mechanics. | `gutsy-robot-command/2.webp` |
| 3 | EnRyu | `single` | mid | offensive | 15 | Versatile | Red EnRyu individual robot form and correct source equipment silhouette. One mid-range weapon; preserve the source body rather than a combined or alternate vehicle form. | `gutsy-robot-command/3.webp` |
| 4 | FuuRyu | `weapon_shield` | short | defensive | 20 | Warden | Green FuuRyu individual robot form, preserving source torso and limbs. One short-range weapon and an original arena shield; wind powers provide no additional engine effect. | `gutsy-robot-command/4.webp` |
| 5 | RaiRyu | `two_handed` | mid | offensive | 10 | Bruiser | Yellow RaiRyu individual robot form and source proportions. One heavy mid-range arena weapon; do not depict GekiRyuJin or grant a separate electrical attack. | `gutsy-robot-command/5.webp` |
| 6 | Volfogg | `single` | melee | offensive | 15 | Sprinter | Base purple Volfogg robot form with recognizable stealth-police styling. One melee arena weapon; no Big Volfogg components, extra figures, or transformation mechanic. | `gutsy-robot-command/6.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 GaoGaiGar | War Club (₡84,000) | Heavy Hammer (₡478,000) |
| 2 HyoRyu | Beam Pistol (₡93,000) | Particle Lance (₡425,000) |
| 3 EnRyu | Bolt Carbine (₡93,000) | Nova Caster (₡425,000) |
| 4 FuuRyu | Laser Pistol + Light Shield (₡108,000) | Volt Sabre + Aegis Bulwark (₡834,000) |
| 5 RaiRyu | Training Rifle (₡50,000) | Plasma Cannon (₡408,000) |
| 6 Volfogg | Practice Sword (₡50,000) | Vibro Mace (₡425,000) |

**Refinement plans** (generated; applied by Trio goal 22, Refine → 10 steps per robot). All 6 robots: 35 steps, ₡17,320,000; the 6 robots at the target: ₡17,320,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| GaoGaiGar (5 steps, ₡2,890,000) | Heavy Hammer (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +3 (7 → 10) ₡90,000 | ₡2,890,000 |
| HyoRyu (5 steps, ₡2,890,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +3 (5 → 8) ₡90,000 | ₡2,890,000 |
| EnRyu (5 steps, ₡2,890,000) | Nova Caster (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +3 (6 → 9) ₡90,000 | ₡2,890,000 |
| FuuRyu (10 steps, ₡2,870,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Armor Plating +1 (new) ₡20,000 | ₡2,820,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |
| RaiRyu (5 steps, ₡2,890,000) | Plasma Cannon (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +3 (7 → 10) ₡90,000 | ₡2,890,000 |
| Volfogg (5 steps, ₡2,890,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Gyro Stabilizers +3 (4 → 7) ₡90,000 | ₡2,890,000 |

Storage (estimate; the engine counts at run time): 7 final weapons equipped at the robots target of 6. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need Storage Facility L1; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Source findings before decisions: V06 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 119. Buster Machine Hangar (`buster-machine-hangar`) — Paragon

| Field | Value |
|---|---|
| Stable name | Buster Machine Hangar |
| Franchise label | Gunbuster |
| Backstory | One immense champion takes every available upgrade slot in the hangar's budget. Its heavy arena weapon is purchased and refined through ordinary workshop milestones. |
| Strategy | Paragon |
| Target overrides | none (goal 8 Robots → 1, the strategy default) |
| Team names | 2v2: none · 3v3: none |
| Event order | `league_1v1`, `tournament_1v1`, `koth`, `grand_melee`, `league_2v2`, `tag_team`, `tournament_2v2`, `league_3v3`, `tournament_3v3` |

**Changes from your draft**: none.

Every blueprint is used at the robots target of 1; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Gunbuster | `two_handed` | mid | offensive | 10 | Bruiser | Use case: precise-object-edit. | `buster-machine-hangar/1.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Gunbuster | Training Rifle (₡50,000) | Plasma Cannon (₡408,000) |

**Refinement plans** (generated; applied by Paragon goal 16, Refine → 10 steps per robot). The only blueprint: 4 steps, ₡2,800,000; the robot at the target: ₡2,800,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Gunbuster (4 steps, ₡2,800,000) | Plasma Cannon (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 | ₡2,800,000 |

Storage (estimate; the engine counts at run time): 1 final weapons equipped at the robots target of 1. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5).

Source findings before decisions: A01 ×1, V13 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 120. Krat Puppet Workshop (`krat-puppet-workshop`) — Paragon

| Field | Value |
|---|---|
| Stable name | Krat Puppet Workshop |
| Franchise label | Lies of P |
| Backstory | The puppet workshop stakes its account on one agile close-combat fighter. Repairs come first, followed by a complete paired weapon upgrade and patient refinement. |
| Strategy | Paragon |
| Target overrides | none (goal 8 Robots → 1, the strategy default) |
| Team names | 2v2: none · 3v3: none |
| Event order | `league_1v1`, `tournament_1v1`, `koth`, `grand_melee`, `league_2v2`, `tag_team`, `tournament_2v2`, `league_3v3`, `tournament_3v3` |

**Changes from your draft**: none.

Every blueprint is used at the robots target of 1; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | P | `dual_wield` | melee | offensive | 10 | Sprinter | P, Geppetto's protagonist puppet from Lies of P (2023). | `krat-puppet-workshop/1.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 P | Practice Sword ×2 (₡100,000) | Vibro Mace ×2 (₡850,000) |

**Refinement plans** (generated; applied by Paragon goal 16, Refine → 10 steps per robot). The only blueprint: 8 steps, ₡5,600,000; the robot at the target: ₡5,600,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| P (8 steps, ₡5,600,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 | ₡2,800,000 |
|  | Vibro Mace (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 | ₡2,800,000 |

Storage (estimate; the engine counts at run time): 2 final weapons equipped at the robots target of 1. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5), A09 ×1 (decision 8, 17).

Source findings before decisions: A01 ×1, A09 ×1, V13 ×2.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 121. Vector Android Division (`vector-android-division`) — Paragon

| Field | Value |
|---|---|
| Stable name | Vector Android Division |
| Franchise label | Xenosaga |
| Backstory | A single combat android anchors the division's investment. Heavy ranged equipment receives the workshop's concentrated progression and refinement budget. |
| Strategy | Paragon |
| Target overrides | none (goal 8 Robots → 1, the strategy default) |
| Team names | 2v2: none · 3v3: none |
| Event order | `league_1v1`, `tournament_1v1`, `koth`, `grand_melee`, `league_2v2`, `tag_team`, `tournament_2v2`, `league_3v3`, `tournament_3v3` |

**Changes from your draft**: none.

Every blueprint is used at the robots target of 1; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | KOS-MOS | `two_handed` | mid | offensive | 10 | Bruiser | KOS-MOS ver.4 from Xenosaga Episode III, authentic adult female combat android. | `vector-android-division/1.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 KOS-MOS | Training Rifle (₡50,000) | Plasma Cannon (₡408,000) |

**Refinement plans** (generated; applied by Paragon goal 16, Refine → 10 steps per robot). The only blueprint: 4 steps, ₡2,800,000; the robot at the target: ₡2,800,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| KOS-MOS (4 steps, ₡2,800,000) | Plasma Cannon (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 | ₡2,800,000 |

Storage (estimate; the engine counts at run time): 1 final weapons equipped at the robots target of 1. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5), A09 ×1 (decision 8, 17).

Source findings before decisions: A01 ×1, A09 ×1, V13 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 122. Ruin-Era Synthetic Unit (`ruin-era-synthetic-unit`) — Trio

| Field | Value |
|---|---|
| Stable name | Ruin-Era Synthetic Unit |
| Franchise label | Casshern |
| Backstory | Three synthetic fighters bring speed, direct pressure and mobility to a battered workshop. The roster advances as a trio rather than splitting its funds between rival flagships. |
| Strategy | Trio |
| Target overrides | none (goal 12 Robots → 3, the strategy default) |
| Team names | 2v2: **Casshern Sins** (robots 1+2) · 3v3: **Ruin Survivors** (1–3) |
| Event order | `league_3v3`, `tournament_3v3`, `league_2v2`, `tag_team`, `league_1v1`, `koth`, `grand_melee`, `tournament_2v2`, `tournament_1v1` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- 2v2 team 1+2: 'Ruin Era Pair 01' → 'Casshern Sins' (decision 14; delegated authoring)
- 3v3 team 1+2+3: 'Ruin Era Squad 01' → 'Ruin Survivors' (decision 14; delegated authoring)

Every blueprint is used at the robots target of 3; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Casshern | `single` | melee | offensive | 10 | Sprinter | Authentic Casshern from the 2008 Casshern Sins anime. | `ruin-era-synthetic-unit/1.webp` |
| 2 | Dio | `single` | short | offensive | 10 | Bruiser | Authentic Dio from the 2008 Casshern Sins anime, slender athletic adult male android with pale humanlike face and long pale blond hair. | `ruin-era-synthetic-unit/2.webp` |
| 3 | Leda | `single` | short | balanced | 20 | Sprinter | Authentic Leda from the 2008 Casshern Sins anime, adult female android with pale humanlike face, very long purple hair, source red and black high-collar battle suit, red thigh-high boots and forearm… | `ruin-era-synthetic-unit/3.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Casshern | Practice Sword (₡50,000) | Vibro Mace (₡425,000) |
| 2 Dio | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |
| 3 Leda | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |

**Refinement plans** (generated; applied by Trio goal 22, Refine → 10 steps per robot). All 3 robots: 15 steps, ₡8,430,000; the 3 robots at the target: ₡8,430,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Casshern (5 steps, ₡2,810,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Gyro Stabilizers +1 (4 → 5) ₡10,000 | ₡2,810,000 |
| Dio (5 steps, ₡2,810,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (8 → 9) ₡10,000 | ₡2,810,000 |
| Leda (5 steps, ₡2,810,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Power Core +1 (−3 → −2) ₡10,000 | ₡2,810,000 |

Storage (estimate; the engine counts at run time): 3 final weapons equipped at the robots target of 3. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5), A09 ×1 (decision 8, 17).

Source findings before decisions: A01 ×1, A03 ×1, A09 ×1, V13 ×3.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 123. Medical Mechanica Repair Yard (`medical-mechanica-repair-yard`) — Paragon

| Field | Value |
|---|---|
| Stable name | Medical Mechanica Repair Yard |
| Franchise label | FLCL |
| Backstory | A lanky repair machine becomes the yard's unlikely arena champion. Practical mid-range equipment and gradual refinement keep the budget tied to one complete body. |
| Strategy | Paragon |
| Target overrides | none (goal 8 Robots → 1, the strategy default) |
| Team names | 2v2: none · 3v3: none |
| Event order | `league_1v1`, `tournament_1v1`, `koth`, `grand_melee`, `league_2v2`, `tag_team`, `tournament_2v2`, `league_3v3`, `tournament_3v3` |

**Changes from your draft**: none.

Every blueprint is used at the robots target of 1; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Canti | `single` | mid | balanced | 15 | Tactician | Authentic Canti from the original 2000 FLCL, blue/green normal form. | `medical-mechanica-repair-yard/1.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Canti | Bolt Carbine (₡93,000) | Nova Caster (₡425,000) |

**Refinement plans** (generated; applied by Paragon goal 16, Refine → 10 steps per robot). The only blueprint: 4 steps, ₡2,800,000; the robot at the target: ₡2,800,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Canti (4 steps, ₡2,800,000) | Nova Caster (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 | ₡2,800,000 |

Storage (estimate; the engine counts at run time): 1 final weapons equipped at the robots target of 1. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5).

Source findings before decisions: A01 ×1, V13 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 124. Three Robots Expedition (`three-robots-expedition`) — Trio

| Field | Value |
|---|---|
| Stable name | Three Robots Expedition |
| Franchise label | Love, Death & Robots |
| Backstory | An impulsive scout, a sturdy partner and a precise observer turn expedition hardware into a three-role arena team. Their equipment grows together without changing their distinctive bodies. |
| Strategy | Trio |
| Target overrides | none (goal 12 Robots → 3, the strategy default) |
| Team names | 2v2: **K-VRC and XBOT** (robots 1+2) · 3v3: **Three Robots** (1–3) |
| Event order | `league_3v3`, `tournament_3v3`, `league_2v2`, `tag_team`, `league_1v1`, `koth`, `grand_melee`, `tournament_2v2`, `tournament_1v1` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- 2v2 team 1+2: 'Robot Expedition Pair 01' → 'K-VRC and XBOT' (decision 14; delegated authoring)
- 3v3 team 1+2+3: 'Robot Expedition Squad 01' → 'Three Robots' (decision 14; delegated authoring)

Every blueprint is used at the robots target of 3; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | K-VRC | `single` | short | balanced | 20 | Sprinter | Authentic K-VRC, the tiny orange sightseeing robot from Love, Death & Robots Three Robots. | `three-robots-expedition/1.webp` |
| 2 | XBOT 4000 | `weapon_shield` | short | defensive | 25 | Warden | Authentic XBOT 4000 from Love, Death & Robots Three Robots. | `three-robots-expedition/2.webp` |
| 3 | 11-45-G | `single` | long | balanced | 20 | Deadeye | Authentic 11-45-G from Love, Death & Robots Three Robots. | `three-robots-expedition/3.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 K-VRC | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |
| 2 XBOT 4000 | Laser Pistol + Light Shield (₡108,000) | Volt Sabre + Aegis Bulwark (₡834,000) |
| 3 11-45-G | Beam Pistol (₡93,000) | Particle Lance (₡425,000) |

**Refinement plans** (generated; applied by Trio goal 22, Refine → 10 steps per robot). All 3 robots: 20 steps, ₡8,480,000; the 3 robots at the target: ₡8,480,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| K-VRC (5 steps, ₡2,810,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Power Core +1 (−3 → −2) ₡10,000 | ₡2,810,000 |
| XBOT 4000 (10 steps, ₡2,860,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (8 → 9) ₡10,000 | ₡2,810,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |
| 11-45-G (5 steps, ₡2,810,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (5 → 6) ₡10,000 | ₡2,810,000 |

Storage (estimate; the engine counts at run time): 4 final weapons equipped at the robots target of 3. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5).

Source findings before decisions: A01 ×1, A03 ×1, V13 ×3.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 125. Orbit City Serviceworks (`orbit-city-serviceworks`) — Paragon

| Field | Value |
|---|---|
| Stable name | Orbit City Serviceworks |
| Franchise label | The Jetsons |
| Backstory | The service shop backs one wheeled caretaker with protective arena equipment. Careful repairs and shield investment keep its familiar domestic chassis in the contest. |
| Strategy | Paragon |
| Target overrides | none (goal 8 Robots → 1, the strategy default) |
| Team names | 2v2: none · 3v3: none |
| Event order | `league_1v1`, `tournament_1v1`, `koth`, `grand_melee`, `league_2v2`, `tag_team`, `tournament_2v2`, `league_3v3`, `tournament_3v3` |

**Changes from your draft**: none.

Every blueprint is used at the robots target of 1; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Rosie | `weapon_shield` | short | defensive | 25 | Warden | Authentic Rosie the robot maid from classic The Jetsons. | `orbit-city-serviceworks/1.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Rosie | Laser Pistol + Light Shield (₡108,000) | Volt Sabre + Aegis Bulwark (₡834,000) |

**Refinement plans** (generated; applied by Paragon goal 16, Refine → 10 steps per robot). The only blueprint: 4 steps, ₡2,800,000; the robot at the target: ₡2,800,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Rosie (4 steps, ₡2,800,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 | ₡2,800,000 |
|  | Aegis Bulwark (offhand) | no step (allowed: shields need no step) | ₡0 |

Storage (estimate; the engine counts at run time): 2 final weapons equipped at the robots target of 1. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5).

Source findings before decisions: A01 ×1, V13 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 126. Wasteland Caretaker Workshop (`wasteland-caretaker-workshop`) — Paragon

| Field | Value |
|---|---|
| Stable name | Wasteland Caretaker Workshop |
| Franchise label | Finch |
| Backstory | A repaired caretaker protects the workshop's future with cautious close-range equipment. Every new purchase must leave enough credits to keep the single frame running. |
| Strategy | Paragon |
| Target overrides | none (goal 8 Robots → 1, the strategy default) |
| Team names | 2v2: none · 3v3: none |
| Event order | `league_1v1`, `tournament_1v1`, `koth`, `grand_melee`, `league_2v2`, `tag_team`, `tournament_2v2`, `league_3v3`, `tournament_3v3` |

**Changes from your draft**: none.

Every blueprint is used at the robots target of 1; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Jeff | `weapon_shield` | melee | defensive | 25 | Warden | Authentic Jeff the caregiver robot from Finch (2021). | `wasteland-caretaker-workshop/1.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Jeff | Practice Sword + Light Shield (₡101,000) | Vibro Mace + Aegis Bulwark (₡834,000) |

**Refinement plans** (generated; applied by Paragon goal 16, Refine → 10 steps per robot). The only blueprint: 4 steps, ₡2,800,000; the robot at the target: ₡2,800,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Jeff (4 steps, ₡2,800,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 | ₡2,800,000 |
|  | Aegis Bulwark (offhand) | no step (allowed: shields need no step) | ₡0 |

Storage (estimate; the engine counts at run time): 2 final weapons equipped at the robots target of 1. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5), A02 ×1 (decision 9, 15).

Source findings before decisions: A01 ×1, A02 ×1, V13 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 127. Companion Robotics Bureau (`companion-robotics-bureau`) — Paragon

| Field | Value |
|---|---|
| Stable name | Companion Robotics Bureau |
| Franchise label | Robot & Frank |
| Backstory | The bureau sends one service machine into the arena with restrained equipment and a conservative retreat policy. Incremental refinement follows dependable maintenance. |
| Strategy | Paragon |
| Target overrides | none (goal 8 Robots → 1, the strategy default) |
| Team names | 2v2: none · 3v3: none |
| Event order | `league_1v1`, `tournament_1v1`, `koth`, `grand_melee`, `league_2v2`, `tag_team`, `tournament_2v2`, `league_3v3`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- Slot 1 robot name: 'Robot' → 'VGC-60L' (decisions 15, 18; delegated authoring)
- Slot 1 art brief: 'Authentic Robot from the 2012 film Robot & Frank, compact white domestic service humanoid.' → 'Glossy white VGC-60L care robot, rounded helmet head with a black visor, slim jointed limbs, no visible weapon' (decisions 15, 18; delegated authoring)
- Slot 1 portrait: aligned (decisions 15, 18; delegated authoring)

Every blueprint is used at the robots target of 1; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | VGC-60L | `single` | short | defensive | 30 | Tactician | Glossy white VGC-60L care robot, rounded helmet head with a black visor, slim jointed limbs, no visible weapon | `companion-robotics-bureau/1.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 VGC-60L | Practice Blaster (₡50,000) | Volt Sabre (₡425,000) |

**Refinement plans** (generated; applied by Paragon goal 16, Refine → 10 steps per robot). The only blueprint: 4 steps, ₡2,800,000; the robot at the target: ₡2,800,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| VGC-60L (4 steps, ₡2,800,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 | ₡2,800,000 |

Storage (estimate; the engine counts at run time): 1 final weapons equipped at the robots target of 1. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5).

Source findings before decisions: A01 ×1, A13 ×1, V03 ×1, V13 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 128. Factory Night Shift (`factory-night-shift`) — Trio

| Field | Value |
|---|---|
| Stable name | Factory Night Shift |
| Franchise label | Robo Rally |
| Backstory | When the supervisors leave, the first three machines take the arena booking. The overtime crew follows: six factory robots turn a night shift into three pairs, two trios, and a very expensive maintenance report. |
| Strategy | Trio |
| Target overrides | goal 12 Robots → 6 (strategy default 3, allowed 3–6) |
| Team names | 2v2: **Docking Bay Duo** (robots 1+2), **Hammer and Anvil** (3+4), **Conveyor Chaos** (5+6) · 3v3: **First Shift** (1–3), **Overtime Crew** (4–6) |
| Event order | `league_3v3`, `league_2v2`, `tag_team`, `tournament_3v3`, `tournament_2v2`, `league_1v1`, `koth`, `grand_melee`, `tournament_1v1` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- Strategy: Squadron → Trio (decision 12)

Every blueprint is used at the robots target of 6; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Twonky | `single` | mid | balanced | 15 | Versatile | Match the 2023 Twonky miniature and labelled player mat. Preserve the source face, proportions, and chassis; add one compact mid-range arena weapon. | `factory-night-shift/1.webp` |
| 2 | Hulk X90 | `weapon_shield` | short | defensive | 25 | Warden | Match the 2023 Hulk X90 body and labelled player mat. Preserve its source construction; one short-range weapon and one original arena shield. | `factory-night-shift/2.webp` |
| 3 | Hammer Bot | `two_handed` | melee | offensive | 10 | Bruiser | Match the 2023 Hammer Bot model, retaining its recognizable industrial tool silhouette. Use one two-handed melee allocation; source tools add no extra free attacks. | `factory-night-shift/3.webp` |
| 4 | Smash Bot | `two_handed` | mid | balanced | 15 | Bruiser | Match the 2023 Smash Bot model and player-mat illustration. Retain its complete source chassis; one heavy mid-range arena weapon. | `factory-night-shift/4.webp` |
| 5 | Zoom Bot | `single` | long | balanced | 15 | Deadeye | Match the 2023 Zoom Bot model and labelled player mat. Preserve source locomotion and proportions; one long-range arena weapon. | `factory-night-shift/5.webp` |
| 6 | Spin Bot | `dual_wield` | short | offensive | 10 | Sprinter | Match the 2023 Spin Bot model and labelled player mat. Preserve its distinctive body construction; two short-range arena weapon allocations. | `factory-night-shift/6.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Twonky | Bolt Carbine (₡93,000) | Nova Caster (₡425,000) |
| 2 Hulk X90 | Laser Pistol + Light Shield (₡108,000) | Volt Sabre + Aegis Bulwark (₡834,000) |
| 3 Hammer Bot | War Club (₡84,000) | Heavy Hammer (₡478,000) |
| 4 Smash Bot | Training Rifle (₡50,000) | Plasma Cannon (₡408,000) |
| 5 Zoom Bot | Beam Pistol (₡93,000) | Particle Lance (₡425,000) |
| 6 Spin Bot | Laser Pistol ×2 (₡114,000) | Volt Sabre ×2 (₡850,000) |

**Refinement plans** (generated; applied by Trio goal 22, Refine → 10 steps per robot). All 6 robots: 40 steps, ₡20,210,000; the 6 robots at the target: ₡20,210,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Twonky (5 steps, ₡2,890,000) | Nova Caster (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +3 (6 → 9) ₡90,000 | ₡2,890,000 |
| Hulk X90 (10 steps, ₡2,870,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Armor Plating +1 (new) ₡20,000 | ₡2,820,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |
| Hammer Bot (5 steps, ₡2,890,000) | Heavy Hammer (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +3 (7 → 10) ₡90,000 | ₡2,890,000 |
| Smash Bot (5 steps, ₡2,890,000) | Plasma Cannon (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +3 (7 → 10) ₡90,000 | ₡2,890,000 |
| Zoom Bot (5 steps, ₡2,890,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +3 (5 → 8) ₡90,000 | ₡2,890,000 |
| Spin Bot (10 steps, ₡5,780,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 · 9 Hone Power Core +3 (−3 → 0) ₡90,000 | ₡2,890,000 |
|  | Volt Sabre (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 · 10 Hone Power Core +3 (−3 → 0) ₡90,000 | ₡2,890,000 |

Storage (estimate; the engine counts at run time): 8 final weapons equipped at the robots target of 6. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need Storage Facility L1; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Source findings before decisions: V06 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 129. Evangelion Unit Hangar (`evangelion-unit-hangar`) — Trio

| Field | Value |
|---|---|
| Stable name | Evangelion Unit Hangar |
| Franchise label | Neon Genesis Evangelion |
| Backstory | Three biomechanical units cover defence, contact pressure and heavy fire. The hangar treats each complete unit as one roster slot and equips the trio through ordinary budgets. |
| Strategy | Trio |
| Target overrides | none (goal 12 Robots → 3, the strategy default) |
| Team names | 2v2: **Operation Yashima** (robots 1+2) · 3v3: **NERV Tokyo-3** (1–3) |
| Event order | `league_3v3`, `tournament_3v3`, `league_2v2`, `tag_team`, `league_1v1`, `koth`, `grand_melee`, `tournament_2v2`, `tournament_1v1` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- 2v2 team 1+2: 'Unit Hangar Pair 01' → 'Operation Yashima' (decision 14; delegated authoring)
- 3v3 team 1+2+3: 'Unit Hangar Squad 01' → 'NERV Tokyo-3' (decision 14; delegated authoring)

Every blueprint is used at the robots target of 3; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | EVA-00 | `weapon_shield` | short | defensive | 25 | Warden | Authentic Evangelion Unit-00 from 1995 TV series, blue-and-white post-refit armour. | `evangelion-unit-hangar/1.webp` |
| 2 | EVA-01 | `dual_wield` | melee | offensive | 10 | Sprinter | Authentic Evangelion Unit-01, 1995 TV design. | `evangelion-unit-hangar/2.webp` |
| 3 | EVA-02 | `two_handed` | mid | offensive | 10 | Bruiser | Authentic Evangelion Unit-02, 1995 TV design. | `evangelion-unit-hangar/3.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 EVA-00 | Laser Pistol + Light Shield (₡108,000) | Volt Sabre + Aegis Bulwark (₡834,000) |
| 2 EVA-01 | Practice Sword ×2 (₡100,000) | Vibro Mace ×2 (₡850,000) |
| 3 EVA-02 | Training Rifle (₡50,000) | Plasma Cannon (₡408,000) |

**Refinement plans** (generated; applied by Trio goal 22, Refine → 10 steps per robot). All 3 robots: 25 steps, ₡11,290,000; the 3 robots at the target: ₡11,290,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| EVA-00 (10 steps, ₡2,860,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (8 → 9) ₡10,000 | ₡2,810,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |
| EVA-01 (10 steps, ₡5,620,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 · 9 Hone Gyro Stabilizers +1 (4 → 5) ₡10,000 | ₡2,810,000 |
|  | Vibro Mace (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 · 10 Hone Gyro Stabilizers +1 (4 → 5) ₡10,000 | ₡2,810,000 |
| EVA-02 (5 steps, ₡2,810,000) | Plasma Cannon (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (7 → 8) ₡10,000 | ₡2,810,000 |

Storage (estimate; the engine counts at run time): 5 final weapons equipped at the robots target of 3. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5).

Source findings before decisions: A01 ×1, A03 ×1, V13 ×3.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 130. MARK-13 Salvage Works (`mark-13-salvage-works`) — Paragon

| Field | Value |
|---|---|
| Stable name | MARK-13 Salvage Works |
| Franchise label | Hardware |
| Backstory | Scavenged armour and a dangerous close-range weapon give the salvage yard its single champion. Concentrated upgrades improve one repaired machine rather than creating disposable replacements. |
| Strategy | Paragon |
| Target overrides | none (goal 8 Robots → 1, the strategy default) |
| Team names | 2v2: none · 3v3: none |
| Event order | `league_1v1`, `tournament_1v1`, `koth`, `grand_melee`, `league_2v2`, `tag_team`, `tournament_2v2`, `league_3v3`, `tournament_3v3` |

**Changes from your draft**: none.

Every blueprint is used at the robots target of 1; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | MARK 13 | `two_handed` | short | offensive | 10 | Bruiser | The recognizable MARK 13 robot from Hardware (1990), skull-like battered metal head with weathered American flag paint and dark red mechanical eye, blackened steel jaw, exposed wiring and scavenged… | `mark-13-salvage-works/1.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 MARK 13 | Scatter Cannon (₡84,000) | Arc Projector (₡488,000) |

**Refinement plans** (generated; applied by Paragon goal 16, Refine → 10 steps per robot). The only blueprint: 4 steps, ₡2,800,000; the robot at the target: ₡2,800,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| MARK 13 (4 steps, ₡2,800,000) | Arc Projector (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 | ₡2,800,000 |

Storage (estimate; the engine counts at run time): 1 final weapons equipped at the robots target of 1. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5), A09 ×1 (decision 8, 17).

Source findings before decisions: A01 ×1, A09 ×1, V13 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 131. Saturn Three Robotics (`saturn-three-robotics`) — Paragon

| Field | Value |
|---|---|
| Stable name | Saturn Three Robotics |
| Franchise label | Saturn 3 |
| Backstory | An imposing industrial frame brings heavy contact pressure to a small robotics workshop. The owners refine one final weapon after the machinery and repair reserve are secure. |
| Strategy | Paragon |
| Target overrides | none (goal 8 Robots → 1, the strategy default) |
| Team names | 2v2: none · 3v3: none |
| Event order | `league_1v1`, `tournament_1v1`, `koth`, `grand_melee`, `league_2v2`, `tag_team`, `tournament_2v2`, `league_3v3`, `tournament_3v3` |

**Changes from your draft**: none.

Every blueprint is used at the robots target of 1; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Hector | `two_handed` | melee | offensive | 10 | Bruiser | Authentic Hector Demigod Series robot from Saturn 3 (1980), complete intact film body before damage. | `saturn-three-robotics/1.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Hector | Shock Maul (₡183,000) | Heavy Hammer (₡478,000) |

**Refinement plans** (generated; applied by Paragon goal 16, Refine → 10 steps per robot). The only blueprint: 4 steps, ₡2,800,000; the robot at the target: ₡2,800,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Hector (4 steps, ₡2,800,000) | Heavy Hammer (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 | ₡2,800,000 |

Storage (estimate; the engine counts at run time): 1 final weapons equipped at the robots target of 1. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5), A09 ×1 (decision 8, 17).

Source findings before decisions: A01 ×1, A09 ×1, V13 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 132. Robot Jox Arena Hangar (`robot-jox-arena-hangar`) — Duo

| Field | Value |
|---|---|
| Stable name | Robot Jox Arena Hangar |
| Franchise label | Robot Jox |
| Backstory | Two giant contenders divide a gladiator workshop between protected contact and heavy ranged pressure. Both receive final equipment before the owners expand their workshop ambitions. |
| Strategy | Duo |
| Target overrides | none (goal 13 Robots → 2, the strategy default) |
| Team names | 2v2: **Robot Jox Champions** (robots 1+2) · 3v3: none |
| Event order | `league_2v2`, `tag_team`, `tournament_2v2`, `league_1v1`, `koth`, `grand_melee`, `tournament_1v1`, `league_3v3`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- 2v2 team 1+2: 'Arena Champions Pair 01' → 'Robot Jox Champions' (decisions 14, 18; delegated authoring)
- Slot 1 robot name: 'Atlantic Champion 01' → 'Achilles' (decisions 14, 18; delegated authoring)
- Slot 1 art brief: 'The authentic Robot Jox 1990 arena mech piloted by Achilles, labelled Atlantic Champion 01 only in catalogue.' → 'Towering white Achilles with red and blue armour panels, blocky shoulders, heavy armoured fists, no visible weapon' (decisions 14, 18; delegated authoring)
- Slot 1 portrait: aligned (decisions 14, 18; delegated authoring)
- Slot 2 robot name: 'Eurasian Champion 02' → 'Alexander' (decisions 14, 18; delegated authoring)
- Slot 2 art brief: 'The authentic Robot Jox 1990 opposing arena mech piloted by Alexander, labelled Eurasian Champion 02 only in catalogue.' → 'Hulking red-and-grey Alexander, rounded armoured shoulders, red visor slit, heavy clenched fists, no visible weapon' (decisions 14, 18; delegated authoring)
- Slot 2 portrait: aligned (decisions 14, 18; delegated authoring)

Every blueprint is used at the robots target of 2; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Achilles | `weapon_shield` | melee | defensive | 25 | Warden | Towering white Achilles with red and blue armour panels, blocky shoulders, heavy armoured fists, no visible weapon | `robot-jox-arena-hangar/1.webp` |
| 2 | Alexander | `two_handed` | mid | offensive | 10 | Bruiser | Hulking red-and-grey Alexander, rounded armoured shoulders, red visor slit, heavy clenched fists, no visible weapon | `robot-jox-arena-hangar/2.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Achilles | Practice Sword + Light Shield (₡101,000) | Vibro Mace + Aegis Bulwark (₡834,000) |
| 2 Alexander | Training Rifle (₡50,000) | Plasma Cannon (₡408,000) |

**Refinement plans** (generated; applied by Duo goal 17, Refine → 10 steps per robot). All 2 robots: 15 steps, ₡5,670,000; the 2 robots at the target: ₡5,670,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Achilles (10 steps, ₡2,860,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Counter Protocols +1 (5 → 6) ₡10,000 | ₡2,810,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |
| Alexander (5 steps, ₡2,810,000) | Plasma Cannon (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (7 → 8) ₡10,000 | ₡2,810,000 |

Storage (estimate; the engine counts at run time): 3 final weapons equipped at the robots target of 2. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5), A02 ×1 (decision 9, 15).

Source findings before decisions: A01 ×1, A02 ×1, A03 ×2, A07 ×1, A13 ×2, V13 ×2.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 133. Oblivion Drone Array (`oblivion-drone-array`) — Paragon

| Field | Value |
|---|---|
| Stable name | Oblivion Drone Array |
| Franchise label | Oblivion |
| Backstory | A compact hovering machine is the array's sole arena investment. Its two weapon allocations provide close pressure while ordinary movement and damage rules govern the fight. |
| Strategy | Paragon |
| Target overrides | none (goal 8 Robots → 1, the strategy default) |
| Team names | 2v2: none · 3v3: none |
| Event order | `league_1v1`, `tournament_1v1`, `koth`, `grand_melee`, `league_2v2`, `tag_team`, `tournament_2v2`, `league_3v3`, `tournament_3v3` |

**Changes from your draft**: none.

Every blueprint is used at the robots target of 1; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Drone 166 | `dual_wield` | short | offensive | 10 | Sprinter | Authentic Drone 166 from Oblivion (2013). | `oblivion-drone-array/1.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Drone 166 | Laser Pistol ×2 (₡114,000) | Volt Sabre ×2 (₡850,000) |

**Refinement plans** (generated; applied by Paragon goal 16, Refine → 10 steps per robot). The only blueprint: 8 steps, ₡5,600,000; the robot at the target: ₡5,600,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Drone 166 (8 steps, ₡5,600,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 | ₡2,800,000 |
|  | Volt Sabre (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 | ₡2,800,000 |

Storage (estimate; the engine counts at run time): 2 final weapons equipped at the robots target of 1. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5).

Source findings before decisions: A01 ×1, V13 ×2.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 134. Sakura Spiricle Workshop (`sakura-spiricle-workshop`) — Duo

| Field | Value |
|---|---|
| Stable name | Sakura Spiricle Workshop |
| Franchise label | Sakura Wars |
| Backstory | Two steam-powered suits share a maintenance crew and a partner upgrade account. A guarded front and an agile contact fighter give the workshop complementary investments. |
| Strategy | Duo |
| Target overrides | none (goal 13 Robots → 2, the strategy default) |
| Team names | 2v2: **Imperial Flower Division** (robots 1+2) · 3v3: none |
| Event order | `league_2v2`, `tag_team`, `tournament_2v2`, `league_1v1`, `koth`, `grand_melee`, `tournament_1v1`, `league_3v3`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- 2v2 team 1+2: 'Spiricle Pair Pair 01' → 'Imperial Flower Division' (decisions 13, 14, 18; delegated authoring)
- Slot 1 robot name: 'Koubu Kai — Sakura Unit' → 'Koubu Kai Sakura Unit' (decisions 13, 14, 18; delegated authoring)
- Slot 1 art brief: 'Use case: precise-object-edit.' → 'Pink riveted Koubu Kai steam armour, cherry-blossom crest, brass exhaust stacks, a katana in each hand' (decisions 13, 14, 18; delegated authoring)
- Slot 1 portrait: aligned (decisions 13, 14, 18; delegated authoring)
- Slot 2 robot name: 'Koubu Kai — Sumire Unit' → 'Koubu Kai Sumire Unit' (decisions 13, 14, 18; delegated authoring)
- Slot 2 art brief: "Authentic Sumire Kanzaki's purple Koubu Kai from Sakura Wars 2." → 'Purple riveted Koubu Kai steam armour, gold iris crest on the shoulder, long naginata held two-handed' (decisions 13, 14, 18; delegated authoring)
- Slot 2 portrait: aligned (decisions 13, 14, 18; delegated authoring)

Every blueprint is used at the robots target of 2; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Koubu Kai Sakura Unit | `weapon_shield` | melee | defensive | 25 | Warden | Pink riveted Koubu Kai steam armour, cherry-blossom crest, brass exhaust stacks, a katana in each hand | `sakura-spiricle-workshop/1.webp` |
| 2 | Koubu Kai Sumire Unit | `dual_wield` | melee | offensive | 10 | Sprinter | Purple riveted Koubu Kai steam armour, gold iris crest on the shoulder, long naginata held two-handed | `sakura-spiricle-workshop/2.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Koubu Kai Sakura Unit | Practice Sword + Light Shield (₡101,000) | Vibro Mace + Aegis Bulwark (₡834,000) |
| 2 Koubu Kai Sumire Unit | Practice Sword ×2 (₡100,000) | Vibro Mace ×2 (₡850,000) |

**Refinement plans** (generated; applied by Duo goal 17, Refine → 10 steps per robot). All 2 robots: 20 steps, ₡8,480,000; the 2 robots at the target: ₡8,480,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Koubu Kai Sakura Unit (10 steps, ₡2,860,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Counter Protocols +1 (5 → 6) ₡10,000 | ₡2,810,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |
| Koubu Kai Sumire Unit (10 steps, ₡5,620,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 · 9 Hone Gyro Stabilizers +1 (4 → 5) ₡10,000 | ₡2,810,000 |
|  | Vibro Mace (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 · 10 Hone Gyro Stabilizers +1 (4 → 5) ₡10,000 | ₡2,810,000 |

Storage (estimate; the engine counts at run time): 4 final weapons equipped at the robots target of 2. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5).

Source findings before decisions: A01 ×1, A03 ×1, A07 ×1, A13 ×2, V03 ×2, V13 ×2.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 135. Breakwater Salvage Union (`breakwater-salvage-union`) — Tycoon

| Field | Value |
|---|---|
| Stable name | Breakwater Salvage Union |
| Franchise label | Armoured Souls original |
| Backstory | Salt-worn salvage machines earn the union's facility budget. A protected tug, a heavy clamp and a distant recovery platform turn repaired work equipment into three arena roles. |
| Strategy | Tycoon |
| Target overrides | goal 20 Robots → 3 (strategy default 2, allowed 2–3) |
| Team names | 2v2: **Low Tide Salvors** (robots 1+2) · 3v3: **Harbour Recovery Gang** (1–3) |
| Event order | `league_2v2`, `tag_team`, `league_1v1`, `league_3v3`, `koth`, `grand_melee`, `tournament_2v2`, `tournament_3v3`, `tournament_1v1` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- 2v2 team 1+2: 'Breakwater Pair 01' → 'Low Tide Salvors' (decisions 14, 18; delegated authoring)
- 3v3 team 1+2+3: 'Breakwater Squad 01' → 'Harbour Recovery Gang' (decisions 14, 18; delegated authoring)
- Slot 1 robot name: 'Breakwater Tug 01' → 'Hawser' (decisions 14, 18; delegated authoring)
- Slot 1 art brief: 'Original autonomous coastal salvage TUG robot.' → 'Rusted tracked salvage tug, big cable winch drum and tow shackle up front, twin lamp eyes, shoulder cannon' (decisions 14, 18; delegated authoring)
- Slot 1 portrait: aligned (decisions 14, 18; delegated authoring)
- Slot 2 robot name: 'Breakwater Clamp 02' → 'Hermit Clamp' (decisions 14, 18; delegated authoring)
- Slot 2 art brief: 'Original autonomous coastal CLAMP SALVAGER robot, distinct from tug: four crab-like hydraulic walking legs under narrow vertically stacked sensor torso; two long asymmetric articulated clamp arms…' → 'Rusted four-legged crab salvager, tall cylinder torso with one blue eye, huge clamp claw and a saw arm' (decisions 14, 18; delegated authoring)
- Slot 2 portrait: aligned (decisions 14, 18; delegated authoring)
- Slot 3 robot name: 'Breakwater Recovery 03' → 'Harbourmaster' (decisions 14, 18; delegated authoring)
- Slot 3 art brief: 'Original coastal HEAVY RECOVERY robot.' → 'Six-wheel rusted recovery rig, overhead crane gantry with hook, two clamp arms, front winch and chains' (decisions 14, 18; delegated authoring)
- Slot 3 portrait: aligned (decisions 14, 18; delegated authoring)

Every blueprint is used at the robots target of 3; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Hawser | `weapon_shield` | short | defensive | 25 | Warden | Rusted tracked salvage tug, big cable winch drum and tow shackle up front, twin lamp eyes, shoulder cannon | `breakwater-salvage-union/1.webp` |
| 2 | Hermit Clamp | `two_handed` | melee | offensive | 10 | Bruiser | Rusted four-legged crab salvager, tall cylinder torso with one blue eye, huge clamp claw and a saw arm | `breakwater-salvage-union/2.webp` |
| 3 | Harbourmaster | `two_handed` | long | balanced | 15 | Deadeye | Six-wheel rusted recovery rig, overhead crane gantry with hook, two clamp arms, front winch and chains | `breakwater-salvage-union/3.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Hawser | Laser Pistol + Light Shield (₡108,000) | Volt Sabre + Aegis Bulwark (₡834,000) |
| 2 Hermit Clamp | Shock Maul (₡183,000) | Heavy Hammer (₡478,000) |
| 3 Harbourmaster | Training Beam (₡50,000) | Ion Beam (₡544,000) |

**Refinement plans** (generated; applied by Tycoon goal 25, Refine → 10 steps per robot). All 3 robots: 20 steps, ₡8,550,000; the 3 robots at the target: ₡8,550,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Hawser (10 steps, ₡2,870,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Armor Plating +1 (new) ₡20,000 | ₡2,820,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |
| Hermit Clamp (5 steps, ₡2,840,000) | Heavy Hammer (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +2 (7 → 9) ₡40,000 | ₡2,840,000 |
| Harbourmaster (5 steps, ₡2,840,000) | Ion Beam (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +2 (8 → 10) ₡40,000 | ₡2,840,000 |

Storage (estimate; the engine counts at run time): 4 final weapons equipped at the robots target of 3. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Source findings before decisions: A03 ×2, A13 ×3, V08 ×1, V13 ×3.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 136. Pelagic Pressure Works (`pelagic-pressure-works`) — Generalist

| Field | Value |
|---|---|
| Stable name | Pelagic Pressure Works |
| Franchise label | Armoured Souls original |
| Backstory | Pressure hulls and sealed joints give the workshop a durable three-machine roster. A crawler, an inspector and a bastion divide flexible fire, precision and protection. |
| Strategy | Generalist |
| Target overrides | goal 14 Robots → 3 (strategy default 2, allowed 2–4) |
| Team names | 2v2: **Deep Pressure** (robots 1+2) · 3v3: **Abyssal Watch** (1–3) |
| Event order | `league_1v1`, `league_2v2`, `tag_team`, `league_3v3`, `koth`, `grand_melee`, `tournament_1v1`, `tournament_2v2`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- 2v2 team 1+2: 'Pelagic Pair 01' → 'Deep Pressure' (decisions 14, 18; delegated authoring)
- 3v3 team 1+2+3: 'Pelagic Squad 01' → 'Abyssal Watch' (decisions 14, 18; delegated authoring)
- Slot 1 robot name: 'Pelagic Crawler 01' → 'Bathysphere' (decisions 14, 18; delegated authoring)
- Slot 1 art brief: 'Original deep-sea robotic pressure CRAWLER.' → 'Round diving-bell crawler on four legs, big glass porthole with a blue eye, harpoon gun on its back' (decisions 14, 18; delegated authoring)
- Slot 1 portrait: aligned (decisions 14, 18; delegated authoring)
- Slot 2 robot name: 'Pelagic Inspector 02' → 'Fathom' (decisions 14, 18; delegated authoring)
- Slot 2 art brief: 'Original deep-sea INSPECTION robot.' → 'Tall white boiler-tank diver on two legs, green porthole eye, trailing hoses, two long pincer arms' (decisions 14, 18; delegated authoring)
- Slot 2 portrait: aligned (decisions 14, 18; delegated authoring)
- Slot 3 robot name: 'Pelagic Bastion 03' → 'Abyss Warden' (decisions 14, 18; delegated authoring)
- Slot 3 art brief: 'Original heavy pressure-suited BASTION robot.' → 'Hulking round diving-suit robot, blue porthole visor, arm cannon and a large hatch-wheel shield' (decisions 14, 18; delegated authoring)
- Slot 3 portrait: aligned (decisions 14, 18; delegated authoring)

Every blueprint is used at the robots target of 3; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Bathysphere | `single` | short | balanced | 15 | Versatile | Round diving-bell crawler on four legs, big glass porthole with a blue eye, harpoon gun on its back | `pelagic-pressure-works/1.webp` |
| 2 | Fathom | `single` | long | balanced | 20 | Deadeye | Tall white boiler-tank diver on two legs, green porthole eye, trailing hoses, two long pincer arms | `pelagic-pressure-works/2.webp` |
| 3 | Abyss Warden | `weapon_shield` | short | defensive | 25 | Warden | Hulking round diving-suit robot, blue porthole visor, arm cannon and a large hatch-wheel shield | `pelagic-pressure-works/3.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Bathysphere | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |
| 2 Fathom | Beam Pistol (₡93,000) | Particle Lance (₡425,000) |
| 3 Abyss Warden | Laser Pistol + Light Shield (₡108,000) | Volt Sabre + Aegis Bulwark (₡834,000) |

**Refinement plans** (generated; applied by Generalist goal 18, Refine → 10 steps per robot). All 3 robots: 20 steps, ₡8,540,000; the 3 robots at the target: ₡8,540,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Bathysphere (5 steps, ₡2,840,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +2 (8 → 10) ₡40,000 | ₡2,840,000 |
| Fathom (5 steps, ₡2,840,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +2 (5 → 7) ₡40,000 | ₡2,840,000 |
| Abyss Warden (10 steps, ₡2,860,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (8 → 9) ₡10,000 | ₡2,810,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |

Storage (estimate; the engine counts at run time): 4 final weapons equipped at the robots target of 3. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5).

Source findings before decisions: A01 ×1, A03 ×2, A13 ×3, V08 ×1, V13 ×3.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 137. Lunar Yard Consortium (`lunar-yard-consortium`) — Trio

| Field | Value |
|---|---|
| Stable name | Lunar Yard Consortium |
| Franchise label | Armoured Souls original |
| Backstory | A construction walker, compact handler and heavy loader leave the lunar yard with complementary jobs. Long-range support, practical fire and close pressure advance as one trio. |
| Strategy | Trio |
| Target overrides | none (goal 12 Robots → 3, the strategy default) |
| Team names | 2v2: **Regolith Haulers** (robots 1+2) · 3v3: **Crater Construction Crew** (1–3) |
| Event order | `league_3v3`, `tournament_3v3`, `league_2v2`, `tag_team`, `league_1v1`, `koth`, `grand_melee`, `tournament_2v2`, `tournament_1v1` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- 2v2 team 1+2: 'Lunar Yard Pair 01' → 'Regolith Haulers' (decisions 14, 18; delegated authoring)
- 3v3 team 1+2+3: 'Lunar Yard Squad 01' → 'Crater Construction Crew' (decisions 14, 18; delegated authoring)
- Slot 1 robot name: 'Lunar Spire 01' → 'Crane Fly' (decisions 14, 18; delegated authoring)
- Slot 1 art brief: 'Original narrow lunar construction WALKER robot.' → 'Very tall skeletal white walker, thin limbs, small visor head with a blue slit, slim rifle in one hand' (decisions 14, 18; delegated authoring)
- Slot 1 portrait: aligned (decisions 14, 18; delegated authoring)
- Slot 2 robot name: 'Lunar Handler 02' → 'Tine Hauler' (decisions 14, 18; delegated authoring)
- Slot 2 art brief: 'Original compact lunar HANDLER robot.' → 'Four-legged white-and-yellow yard walker, forklift tines on its front feet, launcher pod on its back' (decisions 14, 18; delegated authoring)
- Slot 2 portrait: aligned (decisions 14, 18; delegated authoring)
- Slot 3 robot name: 'Lunar Loader 03' → 'Moonwheel' (decisions 14, 18; delegated authoring)
- Slot 3 art brief: 'Original heavy lunar LOADER robot.' → 'White unicycle robot on one big tyre with two support legs, binocular blue eyes, claw arm and arm blaster' (decisions 14, 18; delegated authoring)
- Slot 3 portrait: aligned (decisions 14, 18; delegated authoring)

Every blueprint is used at the robots target of 3; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Crane Fly | `two_handed` | long | balanced | 15 | Deadeye | Very tall skeletal white walker, thin limbs, small visor head with a blue slit, slim rifle in one hand | `lunar-yard-consortium/1.webp` |
| 2 | Tine Hauler | `single` | mid | balanced | 15 | Tactician | Four-legged white-and-yellow yard walker, forklift tines on its front feet, launcher pod on its back | `lunar-yard-consortium/2.webp` |
| 3 | Moonwheel | `two_handed` | melee | offensive | 10 | Bruiser | White unicycle robot on one big tyre with two support legs, binocular blue eyes, claw arm and arm blaster | `lunar-yard-consortium/3.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Crane Fly | Training Beam (₡50,000) | Ion Beam (₡544,000) |
| 2 Tine Hauler | Bolt Carbine (₡93,000) | Nova Caster (₡425,000) |
| 3 Moonwheel | Shock Maul (₡183,000) | Heavy Hammer (₡478,000) |

**Refinement plans** (generated; applied by Trio goal 22, Refine → 10 steps per robot). All 3 robots: 15 steps, ₡8,430,000; the 3 robots at the target: ₡8,430,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Crane Fly (5 steps, ₡2,810,000) | Ion Beam (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (8 → 9) ₡10,000 | ₡2,810,000 |
| Tine Hauler (5 steps, ₡2,810,000) | Nova Caster (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (8 → 9) ₡10,000 | ₡2,810,000 |
| Moonwheel (5 steps, ₡2,810,000) | Heavy Hammer (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (7 → 8) ₡10,000 | ₡2,810,000 |

Storage (estimate; the engine counts at run time): 3 final weapons equipped at the robots target of 3. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5).

Source findings before decisions: A01 ×1, A03 ×2, A09 ×1, A13 ×3, V13 ×3.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 138. Kilnheart Foundry (`kilnheart-foundry`) — Duo

| Field | Value |
|---|---|
| Stable name | Kilnheart Foundry |
| Franchise label | Armoured Souls original |
| Backstory | A ceramic-shielded furnace frame anchors the forge while its long-limbed partner works from range. Concentrated partner upgrades preserve both machines' distinct jobs. |
| Strategy | Duo |
| Target overrides | none (goal 13 Robots → 2, the strategy default) |
| Team names | 2v2: **Kiln and Ember** (robots 1+2) · 3v3: none |
| Event order | `league_2v2`, `tag_team`, `tournament_2v2`, `league_1v1`, `koth`, `grand_melee`, `tournament_1v1`, `league_3v3`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- 2v2 team 1+2: 'Kilnheart Pair 01' → 'Kiln and Ember' (decision 14; delegated authoring)

Every blueprint is used at the robots target of 2; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Cinder Keep | `weapon_shield` | melee | defensive | 25 | Warden | Original squat furnace-anchor robot Cinder Keep: massive low barrel-shaped black iron torso with shuttered orange furnace core, ceramic-lined broad shoulders, two short heavy legs ending in broad… | `kilnheart-foundry/1.webp` |
| 2 | Longfire | `two_handed` | long | balanced | 15 | Deadeye | Original long-limbed forge robot Longfire: thin tall dark iron biped, narrow bellows torso with low orange heat glow, long mechanical neck and wedge sensor head, two elongated riveted arms holding… | `kilnheart-foundry/2.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Cinder Keep | Practice Sword + Light Shield (₡101,000) | Vibro Mace + Aegis Bulwark (₡834,000) |
| 2 Longfire | Training Beam (₡50,000) | Ion Beam (₡544,000) |

**Refinement plans** (generated; applied by Duo goal 17, Refine → 10 steps per robot). All 2 robots: 15 steps, ₡5,670,000; the 2 robots at the target: ₡5,670,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Cinder Keep (10 steps, ₡2,860,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Counter Protocols +1 (5 → 6) ₡10,000 | ₡2,810,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |
| Longfire (5 steps, ₡2,810,000) | Ion Beam (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (8 → 9) ₡10,000 | ₡2,810,000 |

Storage (estimate; the engine counts at run time): 3 final weapons equipped at the robots target of 2. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5).

Source findings before decisions: A01 ×1, A03 ×1, A07 ×1, V13 ×2.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 139. Clockwork Audit House (`clockwork-audit-house`) — Paragon

| Field | Value |
|---|---|
| Stable name | Clockwork Audit House |
| Franchise label | Armoured Souls original |
| Backstory | The Chancellor records every credit before committing it to a precise final weapon. One formal automaton receives the audit house's entire champion and refinement budget. |
| Strategy | Paragon |
| Target overrides | none (goal 8 Robots → 1, the strategy default) |
| Team names | 2v2: none · 3v3: none |
| Event order | `league_1v1`, `tournament_1v1`, `koth`, `grand_melee`, `league_2v2`, `tag_team`, `tournament_2v2`, `league_3v3`, `tournament_3v3` |

**Changes from your draft**: none.

Every blueprint is used at the robots target of 1; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Chancellor | `single` | long | balanced | 20 | Deadeye | Original precise formal brass automaton Chancellor. | `clockwork-audit-house/1.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Chancellor | Beam Pistol (₡93,000) | Particle Lance (₡425,000) |

**Refinement plans** (generated; applied by Paragon goal 16, Refine → 10 steps per robot). The only blueprint: 4 steps, ₡2,800,000; the robot at the target: ₡2,800,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Chancellor (4 steps, ₡2,800,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 | ₡2,800,000 |

Storage (estimate; the engine counts at run time): 1 final weapons equipped at the robots target of 1. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5).

Source findings before decisions: A01 ×1, V13 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 140. Municipal Reclamation Grid (`municipal-reclamation-grid`) — Swarm

| Field | Value |
|---|---|
| Stable name | Municipal Reclamation Grid |
| Franchise label | Armoured Souls original |
| Backstory | Sweepers establish the municipal account, cutters add pressure and compactors complete the heavy line. Recruitment and practical equipment keep the eleven-machine grid productive. |
| Strategy | Swarm |
| Target overrides | none (goal 10 Robots → 11, the strategy default) |
| Team names | 2v2: **Curbside Sweep** (robots 1+2), **Plaza Patrol** (3+4), **Sparks and Shears** (5+6), **Collection Day** (7+8), **Heavy Compaction** (9+10) · 3v3: **Street Cleaning Brigade** (1–3), **Cutting Crew** (4–6), **Reclamation Detail** (7–9) |
| Event order | `league_3v3`, `league_2v2`, `tag_team`, `league_1v1`, `koth`, `grand_melee`, `tournament_3v3`, `tournament_2v2`, `tournament_1v1` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- 2v2 team 1+2: 'Reclamation Pair 01' → 'Curbside Sweep' (decisions 14, 18; delegated authoring)
- 2v2 team 3+4: 'Reclamation Pair 02' → 'Plaza Patrol' (decisions 14, 18; delegated authoring)
- 2v2 team 5+6: 'Reclamation Pair 03' → 'Sparks and Shears' (decisions 14, 18; delegated authoring)
- 2v2 team 7+8: 'Reclamation Pair 04' → 'Collection Day' (decisions 14, 18; delegated authoring)
- 2v2 team 9+10: 'Reclamation Pair 05' → 'Heavy Compaction' (decisions 14, 18; delegated authoring)
- 3v3 team 1+2+3: 'Reclamation Squad 01' → 'Street Cleaning Brigade' (decisions 14, 18; delegated authoring)
- 3v3 team 4+5+6: 'Reclamation Squad 02' → 'Cutting Crew' (decisions 14, 18; delegated authoring)
- 3v3 team 7+8+9: 'Reclamation Squad 03' → 'Reclamation Detail' (decisions 14, 18; delegated authoring)
- Slot 1 robot name: 'Curb Sweeper 01' → 'Kerb Bristle' (decisions 14, 18; delegated authoring)
- Slot 1 art brief: 'Original small municipal curb sweeper robot: narrow four-wheel grey body with orange top shell, forward twin rotating brush drums, retractable single tool arm and raised periscope sensor.' → 'Four-wheel grey sweeper with an orange roof, two front brush drums, periscope camera mast, side tool arm' (decisions 14, 18; delegated authoring)
- Slot 1 portrait: aligned (decisions 14, 18; delegated authoring)
- Slot 2 robot name: 'Gutter Sweeper 02' → 'Drain Hound' (decisions 14, 18; delegated authoring)
- Slot 2 art brief: 'Original municipal gutter sweeper robot: elongated low orange/grey chassis on continuous narrow tracks, long articulated vacuum nozzle curving along one side, round single blue camera at front, one…' → 'Tracked orange gutter cleaner, one blue camera eye, long ribbed vacuum hose ending in a brush nozzle' (decisions 14, 18; delegated authoring)
- Slot 2 portrait: aligned (decisions 14, 18; delegated authoring)
- Slot 3 robot name: 'Plaza Sweeper 03' → 'Plaza Broom' (decisions 14, 18; delegated authoring)
- Slot 3 art brief: 'Original plaza sweeper robot: wide three-wheel triangular orange shell, two outward circular brush pods, central short sensor mast with black horizontal visor, one compact middle-range arena emitter…' → 'Wide three-wheel orange sweeper, two outrigger brush pods, visor mast on top and a side camera emitter' (decisions 14, 18; delegated authoring)
- Slot 3 portrait: aligned (decisions 14, 18; delegated authoring)
- Slot 4 robot name: 'Shear Cutter 04' → 'Shearjaw' (decisions 14, 18; delegated authoring)
- Slot 4 art brief: 'Original scrap shear cutter robot: four crab-like steel hydraulic legs, compact orange armoured central pod with one yellow lens, one enormous opposing shear jaw arm and one small stabilizing pincer…' → 'Orange four-legged crab cutter, one huge toothed shear claw, small pincer arm, single yellow lens' (decisions 14, 18; delegated authoring)
- Slot 4 portrait: aligned (decisions 14, 18; delegated authoring)
- Slot 5 robot name: 'Saw Cutter 05' → 'Kerf' (decisions 14, 18; delegated authoring)
- Slot 5 art brief: 'Original municipal saw cutter robot: narrow tracked base, high grey steel torso and offset orange camera dome, one long articulated industrial arm ending in a large guarded circular saw held low…' → 'Tracked grey robot with an orange dome head, long arm with a guarded circular saw, claw hand' (decisions 14, 18; delegated authoring)
- Slot 5 portrait: aligned (decisions 14, 18; delegated authoring)
- Slot 6 robot name: 'Torch Cutter 06' → 'Oxy Lance' (decisions 14, 18; delegated authoring)
- Slot 6 art brief: 'Original municipal torch cutter robot: slim grey/orange biped with compact box head and two blue sensors, long gas-cylinder torso with protected hoses, articulated hands holding one…' → 'Slim orange-and-grey biped, box head with two blue eyes, gas cylinders on its back, long cutting torch' (decisions 14, 18; delegated authoring)
- Slot 6 portrait: aligned (decisions 14, 18; delegated authoring)
- Slot 7 robot name: 'Scrap Collector 07' → 'Skip Grabber' (decisions 14, 18; delegated authoring)
- Slot 7 art brief: 'Original municipal scrap collector robot: six small wheels beneath large rear orange hopper, high telescopic magnetic claw boom folded behind central black camera mast, compact side beam emitter…' → 'Six-wheel scrap truck robot, big orange skip hopper, grapple claw boom, camera mast and side emitter' (decisions 14, 18; delegated authoring)
- Slot 7 portrait: aligned (decisions 14, 18; delegated authoring)
- Slot 8 robot name: 'Baler Compactor 08' → 'Bale Box' (decisions 14, 18; delegated authoring)
- Slot 8 art brief: 'Original municipal baler compactor robot: squat rectangular orange compression chamber on broad twin grey tracks, two short heavy manipulator arms folded forward, inset black visor on front top…' → 'Squat orange tracked baler, boxy compression chamber with side pistons, two short arms, amber visor' (decisions 14, 18; delegated authoring)
- Slot 8 portrait: aligned (decisions 14, 18; delegated authoring)
- Slot 9 robot name: 'Ram Compactor 09' → 'Pile Driver' (decisions 14, 18; delegated authoring)
- Slot 9 art brief: 'Original municipal ram compactor robot: huge central vertical piston torso on four thick short walking legs, orange round shoulders and small inset blue sensor plate, two compact balancing arms…' → 'Four-legged orange compactor, giant vertical piston column, hazard-striped ram beam, blue sensor slit' (decisions 14, 18; delegated authoring)
- Slot 9 portrait: aligned (decisions 14, 18; delegated authoring)
- Slot 10 robot name: 'Crusher Compactor 10' → 'Jawcrusher' (decisions 14, 18; delegated authoring)
- Slot 10 art brief: 'Original municipal crusher compactor robot: heavy six-wheel base, broad upright grey/orange torso with two enormous toothed crusher-jaw arms, domed camera head recessed between shoulders.' → 'Six-wheel orange-and-grey brute, two huge toothed crusher-jaw arms, domed camera head between shoulders' (decisions 14, 18; delegated authoring)
- Slot 10 portrait: aligned (decisions 14, 18; delegated authoring)
- Slot 11 robot name: 'Reclaimer Lead 11' → 'Shift Foreman' (decisions 14, 18; delegated authoring)
- Slot 11 art brief: 'Original municipal reclamation lead robot: tall robust biped with rectangular orange chest, grey plated shoulders, black recessed camera visor and two amber eyes, two functional hands holding one…' → 'Tall orange-and-grey biped, black visor with two amber eyes, plated shoulders, rifle held in both hands' (decisions 14, 18; delegated authoring)
- Slot 11 portrait: aligned (decisions 14, 18; delegated authoring)

Every blueprint is used at the robots target of 11; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Kerb Bristle | `single` | short | balanced | 15 | Versatile | Four-wheel grey sweeper with an orange roof, two front brush drums, periscope camera mast, side tool arm | `municipal-reclamation-grid/1.webp` |
| 2 | Drain Hound | `single` | short | defensive | 30 | Tactician | Tracked orange gutter cleaner, one blue camera eye, long ribbed vacuum hose ending in a brush nozzle | `municipal-reclamation-grid/2.webp` |
| 3 | Plaza Broom | `single` | mid | balanced | 15 | Tactician | Wide three-wheel orange sweeper, two outrigger brush pods, visor mast on top and a side camera emitter | `municipal-reclamation-grid/3.webp` |
| 4 | Shearjaw | `single` | melee | offensive | 10 | Sprinter | Orange four-legged crab cutter, one huge toothed shear claw, small pincer arm, single yellow lens | `municipal-reclamation-grid/4.webp` |
| 5 | Kerf | `dual_wield` | melee | offensive | 10 | Sprinter | Tracked grey robot with an orange dome head, long arm with a guarded circular saw, claw hand | `municipal-reclamation-grid/5.webp` |
| 6 | Oxy Lance | `two_handed` | short | offensive | 10 | Bruiser | Slim orange-and-grey biped, box head with two blue eyes, gas cylinders on its back, long cutting torch | `municipal-reclamation-grid/6.webp` |
| 7 | Skip Grabber | `single` | long | balanced | 20 | Deadeye | Six-wheel scrap truck robot, big orange skip hopper, grapple claw boom, camera mast and side emitter | `municipal-reclamation-grid/7.webp` |
| 8 | Bale Box | `two_handed` | melee | offensive | 10 | Bruiser | Squat orange tracked baler, boxy compression chamber with side pistons, two short arms, amber visor | `municipal-reclamation-grid/8.webp` |
| 9 | Pile Driver | `two_handed` | melee | offensive | 10 | Bruiser | Four-legged orange compactor, giant vertical piston column, hazard-striped ram beam, blue sensor slit | `municipal-reclamation-grid/9.webp` |
| 10 | Jawcrusher | `two_handed` | mid | offensive | 10 | Bruiser | Six-wheel orange-and-grey brute, two huge toothed crusher-jaw arms, domed camera head between shoulders | `municipal-reclamation-grid/10.webp` |
| 11 | Shift Foreman | `weapon_shield` | mid | defensive | 25 | Tactician | Tall orange-and-grey biped, black visor with two amber eyes, plated shoulders, rifle held in both hands | `municipal-reclamation-grid/11.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Kerb Bristle | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |
| 2 Drain Hound | Practice Blaster (₡50,000) | Volt Sabre (₡425,000) |
| 3 Plaza Broom | Bolt Carbine (₡93,000) | Nova Caster (₡425,000) |
| 4 Shearjaw | Practice Sword (₡50,000) | Vibro Mace (₡425,000) |
| 5 Kerf | Practice Sword ×2 (₡100,000) | Vibro Mace ×2 (₡850,000) |
| 6 Oxy Lance | Scatter Cannon (₡84,000) | Arc Projector (₡488,000) |
| 7 Skip Grabber | Beam Pistol (₡93,000) | Particle Lance (₡425,000) |
| 8 Bale Box | Shock Maul (₡183,000) | Heavy Hammer (₡478,000) |
| 9 Pile Driver | Shock Maul (₡183,000) | Heavy Hammer (₡478,000) |
| 10 Jawcrusher | Training Rifle (₡50,000) | Plasma Cannon (₡408,000) |
| 11 Shift Foreman | Bolt Carbine + Light Shield (₡144,000) | Nova Caster + Aegis Bulwark (₡834,000) |

**Refinement plans** (generated; applied by Swarm goal 23, Refine → 8 steps per robot). All 11 robots: 65 steps, ₡35,150,000; the 11 robots at the target: ₡35,150,000; Refine → 8 applies ₡34,810,000 of the target robots' plans.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Kerb Bristle (5 steps, ₡2,960,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| Drain Hound (5 steps, ₡2,820,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Combat Algorithms +1 (new) ₡20,000 | ₡2,820,000 |
| Plaza Broom (5 steps, ₡2,820,000) | Nova Caster (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Combat Algorithms +1 (new) ₡20,000 | ₡2,820,000 |
| Shearjaw (5 steps, ₡2,960,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Gyro Stabilizers +4 (4 → 8) ₡160,000 | ₡2,960,000 |
| Kerf (10 steps, ₡5,920,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 · 9 Hone Gyro Stabilizers +4 (4 → 8) ₡160,000 | ₡2,960,000 |
|  | Vibro Mace (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 · 10 Hone Gyro Stabilizers +4 (4 → 8) ₡160,000 | ₡2,960,000 |
| Oxy Lance (5 steps, ₡2,960,000) | Arc Projector (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| Skip Grabber (5 steps, ₡2,960,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +4 (5 → 9) ₡160,000 | ₡2,960,000 |
| Bale Box (5 steps, ₡2,960,000) | Heavy Hammer (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Critical Systems +4 (4 → 8) ₡160,000 | ₡2,960,000 |
| Pile Driver (5 steps, ₡2,960,000) | Heavy Hammer (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Critical Systems +4 (4 → 8) ₡160,000 | ₡2,960,000 |
| Jawcrusher (5 steps, ₡2,960,000) | Plasma Cannon (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Critical Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| Shift Foreman (10 steps, ₡2,870,000) | Nova Caster (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Combat Algorithms +1 (new) ₡20,000 | ₡2,820,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |

Storage (estimate; the engine counts at run time): 13 final weapons equipped at the robots target of 11. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need Storage Facility L2; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: V16 ×1 (decision 7, 16).

Source findings before decisions: A03 ×2, A13 ×11, V13 ×11, V16 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 141. Aphras Rogue Droid Pair (`aphras-rogue-droid-pair`) — Duo

| Field | Value |
|---|---|
| Stable name | Aphras Rogue Droid Pair |
| Franchise label | Star Wars — Doctor Aphra |
| Backstory | A calculated protocol machine and an aggressive weapon platform share an uncompromising two-frame account. Protected support and close pressure receive balanced partner upgrades. |
| Strategy | Duo |
| Target overrides | none (goal 13 Robots → 2, the strategy default) |
| Team names | 2v2: **Triple-Zero and Beetee** (robots 1+2) · 3v3: none |
| Event order | `league_2v2`, `tag_team`, `tournament_2v2`, `league_1v1`, `koth`, `grand_melee`, `tournament_1v1`, `league_3v3`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- Stable name: "Aphra's Rogue Droid Pair" → 'Aphras Rogue Droid Pair' (decisions 13, 14, 16; delegated authoring)
- Franchise label: 'Star Wars' → 'Star Wars — Doctor Aphra' (decisions 13, 14, 16; delegated authoring)
- 2v2 team 1+2: 'Rogue Pair Pair 01' → 'Triple-Zero and Beetee' (decisions 13, 14, 16; delegated authoring)

Every blueprint is used at the robots target of 2; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | 0-0-0 | `weapon_shield` | mid | defensive | 25 | Tactician | Authentic 0-0-0 (Triple-Zero) from Star Wars Doctor Aphra comics. | `aphras-rogue-droid-pair/1.webp` |
| 2 | BT-1 | `dual_wield` | short | offensive | 10 | Sprinter | Authentic BT-1 (Beetee), Star Wars Doctor Aphra. | `aphras-rogue-droid-pair/2.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 0-0-0 | Bolt Carbine + Light Shield (₡144,000) | Nova Caster + Aegis Bulwark (₡834,000) |
| 2 BT-1 | Laser Pistol ×2 (₡114,000) | Volt Sabre ×2 (₡850,000) |

**Refinement plans** (generated; applied by Duo goal 17, Refine → 10 steps per robot). All 2 robots: 20 steps, ₡8,480,000; the 2 robots at the target: ₡8,480,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| 0-0-0 (10 steps, ₡2,860,000) | Nova Caster (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (8 → 9) ₡10,000 | ₡2,810,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |
| BT-1 (10 steps, ₡5,620,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 · 9 Hone Power Core +1 (−3 → −2) ₡10,000 | ₡2,810,000 |
|  | Volt Sabre (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 · 10 Hone Power Core +1 (−3 → −2) ₡10,000 | ₡2,810,000 |

Storage (estimate; the engine counts at run time): 4 final weapons equipped at the robots target of 2. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5).

Source findings before decisions: A01 ×1, A03 ×1, A07 ×1, V02 ×1, V13 ×3.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 142. HK Assassin Protocol (`hk-assassin-protocol`) — Paragon

| Field | Value |
|---|---|
| Stable name | HK Assassin Protocol |
| Franchise label | Star Wars — Legends |
| Backstory | A single methodical assassin turns contract revenue into precision equipment. The workshop upgrades and refines one weapon path without buying an army of spare identities. |
| Strategy | Paragon |
| Target overrides | none (goal 8 Robots → 1, the strategy default) |
| Team names | 2v2: none · 3v3: none |
| Event order | `league_1v1`, `tournament_1v1`, `koth`, `grand_melee`, `league_2v2`, `tag_team`, `tournament_2v2`, `league_3v3`, `tournament_3v3` |

**Changes from your draft**: none.

Every blueprint is used at the robots target of 1; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | HK-47 | `single` | long | balanced | 20 | Deadeye | Authentic HK-47 from Knights of the Old Republic (2003), Legends continuity. | `hk-assassin-protocol/1.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 HK-47 | Beam Pistol (₡93,000) | Particle Lance (₡425,000) |

**Refinement plans** (generated; applied by Paragon goal 16, Refine → 10 steps per robot). The only blueprint: 4 steps, ₡2,800,000; the robot at the target: ₡2,800,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| HK-47 (4 steps, ₡2,800,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 | ₡2,800,000 |

Storage (estimate; the engine counts at run time): 1 final weapons equipped at the robots target of 1. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5).

Source findings before decisions: A01 ×1, V13 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 143. BD Expedition Workshop (`bd-expedition-workshop`) — Paragon

| Field | Value |
|---|---|
| Stable name | BD Expedition Workshop |
| Franchise label | Star Wars — Jedi: Fallen Order |
| Backstory | A small expedition machine survives through mobility, careful retreat and a compact arena weapon. The workshop keeps its one familiar body intact while buying measured upgrades. |
| Strategy | Paragon |
| Target overrides | none (goal 8 Robots → 1, the strategy default) |
| Team names | 2v2: none · 3v3: none |
| Event order | `league_1v1`, `tournament_1v1`, `koth`, `grand_melee`, `league_2v2`, `tag_team`, `tournament_2v2`, `league_3v3`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- Franchise label: 'Star Wars' → 'Star Wars — Jedi: Fallen Order' (decision 16; delegated authoring)

Every blueprint is used at the robots target of 1; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | BD-1 | `single` | short | balanced | 20 | Sprinter | Authentic BD-1 from Jedi Fallen Order. | `bd-expedition-workshop/1.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 BD-1 | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |

**Refinement plans** (generated; applied by Paragon goal 16, Refine → 10 steps per robot). The only blueprint: 4 steps, ₡2,800,000; the robot at the target: ₡2,800,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| BD-1 (4 steps, ₡2,800,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 | ₡2,800,000 |

Storage (estimate; the engine counts at run time): 1 final weapons equipped at the robots target of 1. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5), A09 ×1 (decision 8, 17).

Source findings before decisions: A01 ×1, A09 ×1, V13 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 144. Outlaw Droid Workshop (`outlaw-droid-workshop`) — Paragon

| Field | Value |
|---|---|
| Stable name | Outlaw Droid Workshop |
| Franchise label | Star Wars — Outlaws |
| Backstory | One repaired commando chassis carries the workshop's contracts. Practical mid-range equipment receives concentrated upgrades while a repair reserve stays in the account. |
| Strategy | Paragon |
| Target overrides | none (goal 8 Robots → 1, the strategy default) |
| Team names | 2v2: none · 3v3: none |
| Event order | `league_1v1`, `tournament_1v1`, `koth`, `grand_melee`, `league_2v2`, `tag_team`, `tournament_2v2`, `league_3v3`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- Franchise label: 'Star Wars' → 'Star Wars — Outlaws' (decision 16; delegated authoring)

Every blueprint is used at the robots target of 1; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | ND-5 | `single` | mid | balanced | 15 | Tactician | Authentic ND-5 from Star Wars Outlaws. | `outlaw-droid-workshop/1.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 ND-5 | Bolt Carbine (₡93,000) | Nova Caster (₡425,000) |

**Refinement plans** (generated; applied by Paragon goal 16, Refine → 10 steps per robot). The only blueprint: 4 steps, ₡2,800,000; the robot at the target: ₡2,800,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| ND-5 (4 steps, ₡2,800,000) | Nova Caster (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 | ₡2,800,000 |

Storage (estimate; the engine counts at run time): 1 final weapons equipped at the robots target of 1. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5), V16 ×1 (decision 7, 16).

Source findings before decisions: A01 ×1, V13 ×1, V16 ×2.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 145. Cyberman Conversion Works (`cyberman-conversion-works`) — Swarm

| Field | Value |
|---|---|
| Stable name | Cyberman Conversion Works |
| Franchise label | Doctor Who — Cybermen |
| Backstory | A controller and a leader establish the conversion works' arena line. The remaining converted machines fill infantry, protection and heavy support roles before refinement spending is considered. |
| Strategy | Swarm |
| Target overrides | none (goal 10 Robots → 11, the strategy default) |
| Team names | 2v2: **Cyber Command** (robots 1+2), **Cybus Industries** (3+4), **Battersea Plant** (5+6), **You Will Be Upgraded** (7+8), **Earpod Network** (9+10) · 3v3: **Rise of the Cybermen** (1–3), **The Age of Steel** (4–6), **Army of Ghosts** (7–9) |
| Event order | `league_3v3`, `league_2v2`, `tag_team`, `league_1v1`, `koth`, `grand_melee`, `tournament_3v3`, `tournament_2v2`, `tournament_1v1` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- Franchise label: 'Doctor Who' → 'Doctor Who — Cybermen' (decisions 14, 16, 18; delegated authoring)
- 2v2 team 1+2: 'Conversion Pair 01' → 'Cyber Command' (decisions 14, 16, 18; delegated authoring)
- 2v2 team 3+4: 'Conversion Pair 02' → 'Cybus Industries' (decisions 14, 16, 18; delegated authoring)
- 2v2 team 5+6: 'Conversion Pair 03' → 'Battersea Plant' (decisions 14, 16, 18; delegated authoring)
- 2v2 team 7+8: 'Conversion Pair 04' → 'You Will Be Upgraded' (decisions 14, 16, 18; delegated authoring)
- 2v2 team 9+10: 'Conversion Pair 05' → 'Earpod Network' (decisions 14, 16, 18; delegated authoring)
- 3v3 team 1+2+3: 'Conversion Squad 01' → 'Rise of the Cybermen' (decisions 14, 16, 18; delegated authoring)
- 3v3 team 4+5+6: 'Conversion Squad 02' → 'The Age of Steel' (decisions 14, 16, 18; delegated authoring)
- 3v3 team 7+8+9: 'Conversion Squad 03' → 'Army of Ghosts' (decisions 14, 16, 18; delegated authoring)
- Slot 3 art brief: 'One authentic standard 2006 Doctor Who Cybus Cyberman, original arena unit label 03.' → 'Silver Cybus Cyberman at ease, both hands open by its sides, handlebar ear-pods, chest disc' (decisions 14, 16, 18; delegated authoring)
- Slot 3 'Cybus Cyberman 03': numbered name accepted as a mass-produced designation (decisions 14, 16, 18; delegated authoring)
- Slot 3 portrait: aligned (decisions 14, 16, 18; delegated authoring)
- Slot 4 art brief: 'One authentic standard 2006 Doctor Who Cybus Cyberman, original arena unit label 04.' → 'Silver Cybus Cyberman with one fist raised to its chest, forearm blaster pointed at the floor' (decisions 14, 16, 18; delegated authoring)
- Slot 4 'Cybus Cyberman 04': numbered name accepted as a mass-produced designation (decisions 14, 16, 18; delegated authoring)
- Slot 4 portrait: aligned (decisions 14, 16, 18; delegated authoring)
- Slot 5 art brief: 'One authentic standard 2006 Doctor Who Cybus Cyberman, original arena unit label 05.' → 'Silver Cybus Cyberman stepping forward, forearm gun held out at hip height, other hand open' (decisions 14, 16, 18; delegated authoring)
- Slot 5 'Cybus Cyberman 05': numbered name accepted as a mass-produced designation (decisions 14, 16, 18; delegated authoring)
- Slot 5 portrait: aligned (decisions 14, 16, 18; delegated authoring)
- Slot 6 art brief: 'One authentic standard 2006 Doctor Who Cybus Cyberman, original arena unit label 06.' → 'Scratched silver Cybus Cyberman in a wide stance, forearm gun angled outward, black joint ribbing' (decisions 14, 16, 18; delegated authoring)
- Slot 6 'Cybus Cyberman 06': numbered name accepted as a mass-produced designation (decisions 14, 16, 18; delegated authoring)
- Slot 6 portrait: aligned (decisions 14, 16, 18; delegated authoring)
- Slot 7 art brief: 'One authentic standard 2006 Doctor Who Cybus Cyberman, original arena unit label 07.' → 'Silver Cybus Cyberman turned slightly, forearm gun barrel aimed toward the viewer, fist half closed' (decisions 14, 16, 18; delegated authoring)
- Slot 7 'Cybus Cyberman 07': numbered name accepted as a mass-produced designation (decisions 14, 16, 18; delegated authoring)
- Slot 7 portrait: aligned (decisions 14, 16, 18; delegated authoring)
- Slot 8 art brief: 'One authentic standard 2006 Doctor Who Cybus Cyberman, original arena unit label 08.' → 'Silver Cybus Cyberman standing to attention, arms straight down, feet together, gun along the forearm' (decisions 14, 16, 18; delegated authoring)
- Slot 8 'Cybus Cyberman 08': numbered name accepted as a mass-produced designation (decisions 14, 16, 18; delegated authoring)
- Slot 8 portrait: aligned (decisions 14, 16, 18; delegated authoring)
- Slot 9 art brief: 'One authentic standard 2006 Doctor Who Cybus Cyberman, original arena unit label 09.' → 'Worn silver Cybus Cyberman, forearm gun raised toward the camera, open hand, scuffed chest plates' (decisions 14, 16, 18; delegated authoring)
- Slot 9 'Cybus Cyberman 09': numbered name accepted as a mass-produced designation (decisions 14, 16, 18; delegated authoring)
- Slot 9 portrait: aligned (decisions 14, 16, 18; delegated authoring)
- Slot 10 art brief: 'One authentic standard 2006 Doctor Who Cybus Cyberman, original arena unit label 10.' → 'Silver Cybus Cyberman braced with legs apart, both fists clenched, forearm gun pointing down' (decisions 14, 16, 18; delegated authoring)
- Slot 10 'Cybus Cyberman 10': numbered name accepted as a mass-produced designation (decisions 14, 16, 18; delegated authoring)
- Slot 10 portrait: aligned (decisions 14, 16, 18; delegated authoring)
- Slot 11 art brief: 'One authentic standard 2006 Doctor Who Cybus Cyberman, original arena unit label 11.' → 'Silver Cybus Cyberman mid-stride, forearm blaster extended low, other hand curled, ear-pod handles' (decisions 14, 16, 18; delegated authoring)
- Slot 11 'Cybus Cyberman 11': numbered name accepted as a mass-produced designation (decisions 14, 16, 18; delegated authoring)
- Slot 11 portrait: aligned (decisions 14, 16, 18; delegated authoring)

Every blueprint is used at the robots target of 11; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Cyber-Controller | `weapon_shield` | mid | defensive | 25 | Tactician | Authentic 2006 Doctor Who Cybus Cyber-Controller. | `cyberman-conversion-works/1.webp` |
| 2 | Cyber-Leader | `single` | mid | balanced | 15 | Tactician | Authentic 2006 Doctor Who Cybus Cyber-Leader. | `cyberman-conversion-works/2.webp` |
| 3 | Cybus Cyberman 03 | `single` | short | balanced | 15 | Versatile | Silver Cybus Cyberman at ease, both hands open by its sides, handlebar ear-pods, chest disc | `cyberman-conversion-works/3.webp` |
| 4 | Cybus Cyberman 04 | `single` | short | offensive | 10 | Bruiser | Silver Cybus Cyberman with one fist raised to its chest, forearm blaster pointed at the floor | `cyberman-conversion-works/4.webp` |
| 5 | Cybus Cyberman 05 | `weapon_shield` | short | defensive | 25 | Warden | Silver Cybus Cyberman stepping forward, forearm gun held out at hip height, other hand open | `cyberman-conversion-works/5.webp` |
| 6 | Cybus Cyberman 06 | `single` | long | balanced | 20 | Deadeye | Scratched silver Cybus Cyberman in a wide stance, forearm gun angled outward, black joint ribbing | `cyberman-conversion-works/6.webp` |
| 7 | Cybus Cyberman 07 | `single` | short | balanced | 20 | Sprinter | Silver Cybus Cyberman turned slightly, forearm gun barrel aimed toward the viewer, fist half closed | `cyberman-conversion-works/7.webp` |
| 8 | Cybus Cyberman 08 | `two_handed` | short | offensive | 10 | Bruiser | Silver Cybus Cyberman standing to attention, arms straight down, feet together, gun along the forearm | `cyberman-conversion-works/8.webp` |
| 9 | Cybus Cyberman 09 | `two_handed` | mid | offensive | 10 | Bruiser | Worn silver Cybus Cyberman, forearm gun raised toward the camera, open hand, scuffed chest plates | `cyberman-conversion-works/9.webp` |
| 10 | Cybus Cyberman 10 | `weapon_shield` | long | defensive | 20 | Warden | Silver Cybus Cyberman braced with legs apart, both fists clenched, forearm gun pointing down | `cyberman-conversion-works/10.webp` |
| 11 | Cybus Cyberman 11 | `two_handed` | long | balanced | 15 | Deadeye | Silver Cybus Cyberman mid-stride, forearm blaster extended low, other hand curled, ear-pod handles | `cyberman-conversion-works/11.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Cyber-Controller | Bolt Carbine + Light Shield (₡144,000) | Nova Caster + Aegis Bulwark (₡834,000) |
| 2 Cyber-Leader | Bolt Carbine (₡93,000) | Nova Caster (₡425,000) |
| 3 Cybus Cyberman 03 | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |
| 4 Cybus Cyberman 04 | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |
| 5 Cybus Cyberman 05 | Laser Pistol + Light Shield (₡108,000) | Volt Sabre + Aegis Bulwark (₡834,000) |
| 6 Cybus Cyberman 06 | Beam Pistol (₡93,000) | Particle Lance (₡425,000) |
| 7 Cybus Cyberman 07 | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |
| 8 Cybus Cyberman 08 | Scatter Cannon (₡84,000) | Arc Projector (₡488,000) |
| 9 Cybus Cyberman 09 | Training Rifle (₡50,000) | Plasma Cannon (₡408,000) |
| 10 Cybus Cyberman 10 | Beam Pistol + Light Shield (₡144,000) | Particle Lance + Aegis Bulwark (₡834,000) |
| 11 Cybus Cyberman 11 | Training Beam (₡50,000) | Ion Beam (₡544,000) |

**Refinement plans** (generated; applied by Swarm goal 23, Refine → 8 steps per robot). All 11 robots: 70 steps, ₡32,150,000; the 11 robots at the target: ₡32,150,000; Refine → 8 applies ₡32,090,000 of the target robots' plans.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Cyber-Controller (10 steps, ₡2,870,000) | Nova Caster (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Combat Algorithms +1 (new) ₡20,000 | ₡2,820,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |
| Cyber-Leader (5 steps, ₡2,820,000) | Nova Caster (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Combat Algorithms +1 (new) ₡20,000 | ₡2,820,000 |
| Cybus Cyberman 03 (5 steps, ₡2,960,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| Cybus Cyberman 04 (5 steps, ₡2,960,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| Cybus Cyberman 05 (10 steps, ₡2,870,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Armor Plating +1 (new) ₡20,000 | ₡2,820,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |
| Cybus Cyberman 06 (5 steps, ₡2,960,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +4 (5 → 9) ₡160,000 | ₡2,960,000 |
| Cybus Cyberman 07 (5 steps, ₡2,960,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Power Core +4 (−3 → 1) ₡160,000 | ₡2,960,000 |
| Cybus Cyberman 08 (5 steps, ₡2,960,000) | Arc Projector (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| Cybus Cyberman 09 (5 steps, ₡2,960,000) | Plasma Cannon (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Critical Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| Cybus Cyberman 10 (10 steps, ₡2,870,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Armor Plating +1 (new) ₡20,000 | ₡2,820,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |
| Cybus Cyberman 11 (5 steps, ₡2,960,000) | Ion Beam (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (4 → 8) ₡160,000 | ₡2,960,000 |

Storage (estimate; the engine counts at run time): 14 final weapons equipped at the robots target of 11. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need Storage Facility L2; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A09 ×1 (decision 8, 17).

Source findings before decisions: A03 ×2, A09 ×1, A13 ×9, V13 ×11.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 146. K9 Companion Workshop (`k9-companion-workshop`) — Paragon

| Field | Value |
|---|---|
| Stable name | K9 Companion Workshop |
| Franchise label | Doctor Who — K9 |
| Backstory | A compact mechanical companion earns its workshop a place in the arena. One precise mounted weapon receives the champion's upgrade budget without changing the familiar canine body. |
| Strategy | Paragon |
| Target overrides | none (goal 8 Robots → 1, the strategy default) |
| Team names | 2v2: none · 3v3: none |
| Event order | `league_1v1`, `tournament_1v1`, `koth`, `grand_melee`, `league_2v2`, `tag_team`, `tournament_2v2`, `league_3v3`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- Franchise label: 'Doctor Who' → 'Doctor Who — K9' (decision 16; delegated authoring)

Every blueprint is used at the robots target of 1; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | K9 Mark III | `single` | long | balanced | 20 | Deadeye | Authentic K9 Mark III from Doctor Who School Reunion (2006). | `k9-companion-workshop/1.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 K9 Mark III | Beam Pistol (₡93,000) | Particle Lance (₡425,000) |

**Refinement plans** (generated; applied by Paragon goal 16, Refine → 10 steps per robot). The only blueprint: 4 steps, ₡2,800,000; the robot at the target: ₡2,800,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| K9 Mark III (4 steps, ₡2,800,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 | ₡2,800,000 |

Storage (estimate; the engine counts at run time): 1 final weapons equipped at the robots target of 1. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5), V16 ×1 (decision 7, 16).

Source findings before decisions: A01 ×1, V13 ×1, V16 ×2.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 147. Sentinel Enforcement Array (`sentinel-enforcement-array`) — Swarm

| Field | Value |
|---|---|
| Stable name | Sentinel Enforcement Array |
| Franchise label | Marvel — Sentinels |
| Backstory | An enforcement foundry builds a broad line of manufactured machines. Heavy command, a mobile specialist and varied patrol frames grow into eleven ordinary arena allocations. |
| Strategy | Swarm |
| Target overrides | none (goal 10 Robots → 11, the strategy default) |
| Team names | 2v2: **Days of Future Past** (robots 1+2), **Project Wideawake** (3+4), **Trask Industries** (5+6), **Genosha Patrol** (7+8), **Mutant Detection Grid** (9+10) · 3v3: **Operation Zero Tolerance** (1–3), **Sentinel Program** (4–6), **Mutant Round-Up** (7–9) |
| Event order | `league_3v3`, `league_2v2`, `tag_team`, `league_1v1`, `koth`, `grand_melee`, `tournament_3v3`, `tournament_2v2`, `tournament_1v1` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- Franchise label: 'Marvel' → 'Marvel — Sentinels' (decisions 14, 16, 18; delegated authoring)
- 2v2 team 1+2: 'Enforcement Pair 01' → 'Days of Future Past' (decisions 14, 16, 18; delegated authoring)
- 2v2 team 3+4: 'Enforcement Pair 02' → 'Project Wideawake' (decisions 14, 16, 18; delegated authoring)
- 2v2 team 5+6: 'Enforcement Pair 03' → 'Trask Industries' (decisions 14, 16, 18; delegated authoring)
- 2v2 team 7+8: 'Enforcement Pair 04' → 'Genosha Patrol' (decisions 14, 16, 18; delegated authoring)
- 2v2 team 9+10: 'Enforcement Pair 05' → 'Mutant Detection Grid' (decisions 14, 16, 18; delegated authoring)
- 3v3 team 1+2+3: 'Enforcement Squad 01' → 'Operation Zero Tolerance' (decisions 14, 16, 18; delegated authoring)
- 3v3 team 4+5+6: 'Enforcement Squad 02' → 'Sentinel Program' (decisions 14, 16, 18; delegated authoring)
- 3v3 team 7+8+9: 'Enforcement Squad 03' → 'Mutant Round-Up' (decisions 14, 16, 18; delegated authoring)
- Slot 3 art brief: 'One original giant industrial enforcement robot from a coherent nine-unit production family, with a new retro-comic science-fiction design rendered in realistic metal.' → 'Blue-grey heavy enforcer, ochre shoulder boxes, teal visor, grille chest, arms hanging with open claws' (decisions 14, 16, 18; delegated authoring)
- Slot 3 'Sentinel 03': numbered name accepted as a mass-produced designation (decisions 14, 16, 18; delegated authoring)
- Slot 3 portrait: aligned (decisions 14, 16, 18; delegated authoring)
- Slot 4 art brief: 'One original giant industrial enforcement robot from a coherent nine-unit production family, with a new retro-comic science-fiction design rendered in realistic metal.' → 'Blue-grey heavy enforcer reaching forward with one open clawed hand, ochre shoulder boxes, teal visor' (decisions 14, 16, 18; delegated authoring)
- Slot 4 'Sentinel 04': numbered name accepted as a mass-produced designation (decisions 14, 16, 18; delegated authoring)
- Slot 4 portrait: aligned (decisions 14, 16, 18; delegated authoring)
- Slot 5 art brief: 'One original giant industrial enforcement robot from a coherent nine-unit production family, with a new retro-comic science-fiction design rendered in realistic metal.' → 'Blue-grey heavy enforcer with one arm swung out to the side, clawed fingers splayed, other claw hanging low' (decisions 14, 16, 18; delegated authoring)
- Slot 5 'Sentinel 05': numbered name accepted as a mass-produced designation (decisions 14, 16, 18; delegated authoring)
- Slot 5 portrait: aligned (decisions 14, 16, 18; delegated authoring)
- Slot 6 art brief: 'One original giant industrial enforcement robot from a coherent nine-unit production family, with a new retro-comic science-fiction design rendered in realistic metal.' → 'Blue-grey enforcer standing square, cream armour inserts on its limbs, clawed hands slightly apart' (decisions 14, 16, 18; delegated authoring)
- Slot 6 'Sentinel 06': numbered name accepted as a mass-produced designation (decisions 14, 16, 18; delegated authoring)
- Slot 6 portrait: aligned (decisions 14, 16, 18; delegated authoring)
- Slot 7 art brief: 'One original giant industrial enforcement robot from a coherent nine-unit production family, with a new retro-comic science-fiction design rendered in realistic metal.' → 'Ochre-shouldered blue-grey enforcer, teal visor and antennae, weight on its back foot, hands loose' (decisions 14, 16, 18; delegated authoring)
- Slot 7 'Sentinel 07': numbered name accepted as a mass-produced designation (decisions 14, 16, 18; delegated authoring)
- Slot 7 portrait: aligned (decisions 14, 16, 18; delegated authoring)
- Slot 8 art brief: 'One original giant industrial enforcement robot from a coherent nine-unit production family, with a new retro-comic science-fiction design rendered in realistic metal.' → 'Blue-grey enforcer seen in three-quarter view, chunky stepped feet, mesh chest vent, open claws low' (decisions 14, 16, 18; delegated authoring)
- Slot 8 'Sentinel 08': numbered name accepted as a mass-produced designation (decisions 14, 16, 18; delegated authoring)
- Slot 8 portrait: aligned (decisions 14, 16, 18; delegated authoring)
- Slot 9 art brief: 'One original giant industrial enforcement robot from a coherent nine-unit production family, with a new retro-comic science-fiction design rendered in realistic metal.' → 'Blue-grey heavy enforcer raising one clenched fist beside its shoulder, other claw hanging open' (decisions 14, 16, 18; delegated authoring)
- Slot 9 'Sentinel 09': numbered name accepted as a mass-produced designation (decisions 14, 16, 18; delegated authoring)
- Slot 9 portrait: aligned (decisions 14, 16, 18; delegated authoring)
- Slot 10 art brief: 'One original giant industrial enforcement robot from a coherent nine-unit production family, with a new retro-comic science-fiction design rendered in realistic metal.' → 'Weathered blue-grey enforcer, chipped ochre shoulder boxes, teal visor, both claws hanging at its knees' (decisions 14, 16, 18; delegated authoring)
- Slot 10 'Sentinel 10': numbered name accepted as a mass-produced designation (decisions 14, 16, 18; delegated authoring)
- Slot 10 portrait: aligned (decisions 14, 16, 18; delegated authoring)
- Slot 11 art brief: 'One original giant industrial enforcement robot from a coherent nine-unit production family, with a new retro-comic science-fiction design rendered in realistic metal.' → 'Blue-grey heavy enforcer lifting one curled claw toward its chest, teal visor turned to the viewer' (decisions 14, 16, 18; delegated authoring)
- Slot 11 'Sentinel 11': numbered name accepted as a mass-produced designation (decisions 14, 16, 18; delegated authoring)
- Slot 11 portrait: aligned (decisions 14, 16, 18; delegated authoring)

Every blueprint is used at the robots target of 11; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Master Mold | `two_handed` | mid | offensive | 10 | Bruiser | Classic Marvel comics Master Mold, enormous purple and magenta Sentinel factory humanoid. | `sentinel-enforcement-array/1.webp` |
| 2 | Nimrod | `single` | short | balanced | 20 | Sprinter | Classic Marvel Earth-616 Nimrod robot, stocky broad white and pale-pink futuristic humanoid, short neck with small squared white head and narrow pink face opening, huge rounded white shoulder… | `sentinel-enforcement-array/2.webp` |
| 3 | Sentinel 03 | `single` | short | balanced | 15 | Versatile | Blue-grey heavy enforcer, ochre shoulder boxes, teal visor, grille chest, arms hanging with open claws | `sentinel-enforcement-array/3.webp` |
| 4 | Sentinel 04 | `single` | long | balanced | 20 | Deadeye | Blue-grey heavy enforcer reaching forward with one open clawed hand, ochre shoulder boxes, teal visor | `sentinel-enforcement-array/4.webp` |
| 5 | Sentinel 05 | `weapon_shield` | short | defensive | 25 | Warden | Blue-grey heavy enforcer with one arm swung out to the side, clawed fingers splayed, other claw hanging low | `sentinel-enforcement-array/5.webp` |
| 6 | Sentinel 06 | `two_handed` | mid | offensive | 10 | Bruiser | Blue-grey enforcer standing square, cream armour inserts on its limbs, clawed hands slightly apart | `sentinel-enforcement-array/6.webp` |
| 7 | Sentinel 07 | `two_handed` | short | offensive | 10 | Bruiser | Ochre-shouldered blue-grey enforcer, teal visor and antennae, weight on its back foot, hands loose | `sentinel-enforcement-array/7.webp` |
| 8 | Sentinel 08 | `weapon_shield` | long | defensive | 20 | Warden | Blue-grey enforcer seen in three-quarter view, chunky stepped feet, mesh chest vent, open claws low | `sentinel-enforcement-array/8.webp` |
| 9 | Sentinel 09 | `dual_wield` | short | offensive | 10 | Sprinter | Blue-grey heavy enforcer raising one clenched fist beside its shoulder, other claw hanging open | `sentinel-enforcement-array/9.webp` |
| 10 | Sentinel 10 | `two_handed` | long | balanced | 15 | Deadeye | Weathered blue-grey enforcer, chipped ochre shoulder boxes, teal visor, both claws hanging at its knees | `sentinel-enforcement-array/10.webp` |
| 11 | Sentinel 11 | `single` | mid | balanced | 15 | Tactician | Blue-grey heavy enforcer lifting one curled claw toward its chest, teal visor turned to the viewer | `sentinel-enforcement-array/11.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Master Mold | Training Rifle (₡50,000) | Plasma Cannon (₡408,000) |
| 2 Nimrod | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |
| 3 Sentinel 03 | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |
| 4 Sentinel 04 | Beam Pistol (₡93,000) | Particle Lance (₡425,000) |
| 5 Sentinel 05 | Laser Pistol + Light Shield (₡108,000) | Volt Sabre + Aegis Bulwark (₡834,000) |
| 6 Sentinel 06 | Training Rifle (₡50,000) | Plasma Cannon (₡408,000) |
| 7 Sentinel 07 | Scatter Cannon (₡84,000) | Arc Projector (₡488,000) |
| 8 Sentinel 08 | Beam Pistol + Light Shield (₡144,000) | Particle Lance + Aegis Bulwark (₡834,000) |
| 9 Sentinel 09 | Laser Pistol ×2 (₡114,000) | Volt Sabre ×2 (₡850,000) |
| 10 Sentinel 10 | Training Beam (₡50,000) | Ion Beam (₡544,000) |
| 11 Sentinel 11 | Bolt Carbine (₡93,000) | Nova Caster (₡425,000) |

**Refinement plans** (generated; applied by Swarm goal 23, Refine → 8 steps per robot). All 11 robots: 70 steps, ₡35,200,000; the 11 robots at the target: ₡35,200,000; Refine → 8 applies ₡34,840,000 of the target robots' plans.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Master Mold (5 steps, ₡2,960,000) | Plasma Cannon (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Critical Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| Nimrod (5 steps, ₡2,960,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Power Core +4 (−3 → 1) ₡160,000 | ₡2,960,000 |
| Sentinel 03 (5 steps, ₡2,960,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| Sentinel 04 (5 steps, ₡2,960,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +4 (5 → 9) ₡160,000 | ₡2,960,000 |
| Sentinel 05 (10 steps, ₡2,870,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Armor Plating +1 (new) ₡20,000 | ₡2,820,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |
| Sentinel 06 (5 steps, ₡2,960,000) | Plasma Cannon (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Critical Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| Sentinel 07 (5 steps, ₡2,960,000) | Arc Projector (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| Sentinel 08 (10 steps, ₡2,870,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Armor Plating +1 (new) ₡20,000 | ₡2,820,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |
| Sentinel 09 (10 steps, ₡5,920,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 · 9 Hone Power Core +4 (−3 → 1) ₡160,000 | ₡2,960,000 |
|  | Volt Sabre (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 · 10 Hone Power Core +4 (−3 → 1) ₡160,000 | ₡2,960,000 |
| Sentinel 10 (5 steps, ₡2,960,000) | Ion Beam (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (4 → 8) ₡160,000 | ₡2,960,000 |
| Sentinel 11 (5 steps, ₡2,820,000) | Nova Caster (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Combat Algorithms +1 (new) ₡20,000 | ₡2,820,000 |

Storage (estimate; the engine counts at run time): 14 final weapons equipped at the robots target of 11. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need Storage Facility L2; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A09 ×1 (decision 8, 17).

Source findings before decisions: A03 ×2, A09 ×1, A13 ×9, V03 ×9, V13 ×11, V18 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 148. Vision Synthetic Workshop (`vision-synthetic-workshop`) — Paragon

| Field | Value |
|---|---|
| Stable name | Vision Synthetic Workshop |
| Franchise label | Marvel — Vision |
| Backstory | A single composed synthetic receives precise mid-range equipment and patient refinement. Its workshop invests in supported hardware rather than assigning combat effects to exceptional source abilities. |
| Strategy | Paragon |
| Target overrides | none (goal 8 Robots → 1, the strategy default) |
| Team names | 2v2: none · 3v3: none |
| Event order | `league_1v1`, `tournament_1v1`, `koth`, `grand_melee`, `league_2v2`, `tag_team`, `tournament_2v2`, `league_3v3`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- Franchise label: 'Marvel' → 'Marvel — Vision' (decision 16; delegated authoring)

Every blueprint is used at the robots target of 1; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Vision | `single` | mid | balanced | 15 | Tactician | Original advanced synthetic guardian android. | `vision-synthetic-workshop/1.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Vision | Bolt Carbine (₡93,000) | Nova Caster (₡425,000) |

**Refinement plans** (generated; applied by Paragon goal 16, Refine → 10 steps per robot). The only blueprint: 4 steps, ₡2,800,000; the robot at the target: ₡2,800,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Vision (4 steps, ₡2,800,000) | Nova Caster (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 | ₡2,800,000 |

Storage (estimate; the engine counts at run time): 1 final weapons equipped at the robots target of 1. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5), V16 ×1 (decision 7, 16).

Source findings before decisions: A01 ×1, V13 ×1, V16 ×1, V18 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 149. Justice Android Laboratory (`justice-android-laboratory`) — Duo

| Field | Value |
|---|---|
| Stable name | Justice Android Laboratory |
| Franchise label | DC — Justice League |
| Backstory | A heavy android and a mobile synthetic form an arena partnership across very different origins. Balanced investment gives both machines useful work in the same two-frame account. |
| Strategy | Duo |
| Target overrides | none (goal 13 Robots → 2, the strategy default) |
| Team names | 2v2: **Ivo and Morrow** (robots 1+2) · 3v3: none |
| Event order | `league_2v2`, `tag_team`, `tournament_2v2`, `league_1v1`, `koth`, `grand_melee`, `tournament_1v1`, `league_3v3`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- Franchise label: 'DC' → 'DC — Justice League' (decisions 14, 16; delegated authoring)
- 2v2 team 1+2: 'Justice Pair Pair 01' → 'Ivo and Morrow' (decisions 14, 16; delegated authoring)

Every blueprint is used at the robots target of 2; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Amazo | `two_handed` | mid | offensive | 10 | Bruiser | Authentic golden Amazo from Justice League Unlimited 2004, adult humanoid android with tall athletic entirely gold body, bald gold head, pointed ears, angular humanlike face and small pale eyes. | `justice-android-laboratory/1.webp` |
| 2 | Red Tornado | `single` | short | balanced | 20 | Sprinter | Authentic classic DC comics Red Tornado android. | `justice-android-laboratory/2.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Amazo | Training Rifle (₡50,000) | Plasma Cannon (₡408,000) |
| 2 Red Tornado | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |

**Refinement plans** (generated; applied by Duo goal 17, Refine → 10 steps per robot). All 2 robots: 10 steps, ₡5,620,000; the 2 robots at the target: ₡5,620,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Amazo (5 steps, ₡2,810,000) | Plasma Cannon (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (7 → 8) ₡10,000 | ₡2,810,000 |
| Red Tornado (5 steps, ₡2,810,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Power Core +1 (−3 → −2) ₡10,000 | ₡2,810,000 |

Storage (estimate; the engine counts at run time): 2 final weapons equipped at the robots target of 2. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5), A09 ×1 (decision 8, 17), V16 ×1 (decision 7, 16).

Source findings before decisions: A01 ×1, A03 ×1, A09 ×1, V13 ×2, V16 ×1, V18 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 150. Wily Robot Master Foundry (`wily-robot-master-foundry`) — Trio

| Field | Value |
|---|---|
| Stable name | Wily Robot Master Foundry |
| Franchise label | Mega Man — Robot Masters |
| Backstory | Wily requisitions six specialists with very different day jobs and equally difficult personalities. The first industrial trio secures the arena; ice, fire, and electricity complete the roster. |
| Strategy | Trio |
| Target overrides | goal 12 Robots → 6 (strategy default 3, allowed 3–6) |
| Team names | 2v2: **Cut and Carry** (robots 1+2), **Cold Detonation** (3+4), **Live Wires** (5+6) · 3v3: **Wily Work Crew** (1–3), **Elemental Overload** (4–6) |
| Event order | `league_3v3`, `league_2v2`, `tag_team`, `tournament_3v3`, `tournament_2v2`, `league_1v1`, `koth`, `grand_melee`, `tournament_1v1` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- Strategy: Squadron → Trio (decisions 12, 16; delegated authoring)
- Franchise label: 'Mega Man' → 'Mega Man — Robot Masters' (decisions 12, 16; delegated authoring)

Every blueprint is used at the robots target of 6; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Cut Man | `single` | melee | offensive | 10 | Sprinter | Classic Cut Man head cutter, small body, and source proportions. One melee arena weapon; the signature cutter is its visual identity, not a second attack. | `wily-robot-master-foundry/1.webp` |
| 2 | Guts Man | `weapon_shield` | short | defensive | 20 | Warden | Classic Guts Man broad jaw, large arms, and sturdy body. One short-range weapon plus an original arena shield; no automatic lifting or terrain-destruction mechanic. | `wily-robot-master-foundry/2.webp` |
| 3 | Bomb Man | `two_handed` | mid | offensive | 10 | Bruiser | Classic Bomb Man round body and distinctive head crest. One heavy mid-range arena weapon with explosive styling; no invented grenade inventory or area-damage rule. | `wily-robot-master-foundry/3.webp` |
| 4 | Ice Man | `single` | long | balanced | 20 | Tactician | Classic Ice Man parka-like robot design and recognizable face. One long-range arena weapon; cold imagery does not grant a freeze status effect. | `wily-robot-master-foundry/4.webp` |
| 5 | Fire Man | `two_handed` | short | offensive | 10 | Bruiser | Classic Fire Man head flame housing and source arm shapes. One heavy short-range arena emitter; retain the source silhouette without an extra independent flame attack. | `wily-robot-master-foundry/5.webp` |
| 6 | Elec Man | `single` | mid | balanced | 15 | Versatile | Classic Elec Man mask, lightning motif, and source body proportions. One mid-range arena weapon; electrical styling adds no stun or chain-damage mechanic. | `wily-robot-master-foundry/6.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Cut Man | Practice Sword (₡50,000) | Vibro Mace (₡425,000) |
| 2 Guts Man | Laser Pistol + Light Shield (₡108,000) | Volt Sabre + Aegis Bulwark (₡834,000) |
| 3 Bomb Man | Training Rifle (₡50,000) | Plasma Cannon (₡408,000) |
| 4 Ice Man | Beam Pistol (₡93,000) | Particle Lance (₡425,000) |
| 5 Fire Man | Scatter Cannon (₡84,000) | Arc Projector (₡488,000) |
| 6 Elec Man | Bolt Carbine (₡93,000) | Nova Caster (₡425,000) |

**Refinement plans** (generated; applied by Trio goal 22, Refine → 10 steps per robot). All 6 robots: 35 steps, ₡17,250,000; the 6 robots at the target: ₡17,250,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Cut Man (5 steps, ₡2,890,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Gyro Stabilizers +3 (4 → 7) ₡90,000 | ₡2,890,000 |
| Guts Man (10 steps, ₡2,870,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Armor Plating +1 (new) ₡20,000 | ₡2,820,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |
| Bomb Man (5 steps, ₡2,890,000) | Plasma Cannon (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +3 (7 → 10) ₡90,000 | ₡2,890,000 |
| Ice Man (5 steps, ₡2,820,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Combat Algorithms +1 (new) ₡20,000 | ₡2,820,000 |
| Fire Man (5 steps, ₡2,890,000) | Arc Projector (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +3 (7 → 10) ₡90,000 | ₡2,890,000 |
| Elec Man (5 steps, ₡2,890,000) | Nova Caster (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +3 (6 → 9) ₡90,000 | ₡2,890,000 |

Storage (estimate; the engine counts at run time): 7 final weapons equipped at the robots target of 6. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need Storage Facility L1; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Source findings before decisions: V06 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 151. Maverick Hunter Workshop (`maverick-hunter-workshop`) — Duo

| Field | Value |
|---|---|
| Stable name | Maverick Hunter Workshop |
| Franchise label | Mega Man — Maverick Hunters |
| Backstory | A flexible ranged hunter and an agile close-combat partner share the workshop budget. Their contrasting equipment paths improve together without multiplying alternate forms into extra slots. |
| Strategy | Duo |
| Target overrides | none (goal 13 Robots → 2, the strategy default) |
| Team names | 2v2: **17th Elite Unit** (robots 1+2) · 3v3: none |
| Event order | `league_2v2`, `tag_team`, `tournament_2v2`, `league_1v1`, `koth`, `grand_melee`, `tournament_1v1`, `league_3v3`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- Franchise label: 'Mega Man' → 'Mega Man — Maverick Hunters' (decisions 14, 16; delegated authoring)
- 2v2 team 1+2: 'Hunter Pair Pair 01' → '17th Elite Unit' (decisions 14, 16; delegated authoring)

Every blueprint is used at the robots target of 2; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | X | `single` | short | balanced | 15 | Versatile | Authentic base X from Mega Man X2, blue robot hero with humanlike pale face, blue helmet with red forehead jewel, light blue chest and upper limbs, dark blue large gauntlets/boots and one integrated… | `maverick-hunter-workshop/1.webp` |
| 2 | Zero | `dual_wield` | melee | offensive | 10 | Sprinter | Authentic Zero from Mega Man X2 era, red robot armour, pale humanlike face, red helmet with white crest details and green forehead jewel, long blond ponytail, two green chest orbs, white upper… | `maverick-hunter-workshop/2.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 X | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |
| 2 Zero | Practice Sword ×2 (₡100,000) | Vibro Mace ×2 (₡850,000) |

**Refinement plans** (generated; applied by Duo goal 17, Refine → 10 steps per robot). All 2 robots: 15 steps, ₡8,430,000; the 2 robots at the target: ₡8,430,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| X (5 steps, ₡2,810,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (8 → 9) ₡10,000 | ₡2,810,000 |
| Zero (10 steps, ₡5,620,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 · 9 Hone Gyro Stabilizers +1 (4 → 5) ₡10,000 | ₡2,810,000 |
|  | Vibro Mace (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 · 10 Hone Gyro Stabilizers +1 (4 → 5) ₡10,000 | ₡2,810,000 |

Storage (estimate; the engine counts at run time): 3 final weapons equipped at the robots target of 2. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5), A09 ×1 (decision 8, 17), V16 ×1 (decision 7, 16).

Source findings before decisions: A01 ×1, A03 ×1, A09 ×1, V13 ×2, V16 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 152. Zeon Mobile Suit Hangar (`zeon-mobile-suit-hangar`) — Trio

| Field | Value |
|---|---|
| Stable name | Zeon Mobile Suit Hangar |
| Franchise label | Gundam |
| Backstory | Three military chassis divide practical fire, close pressure and heavy assault. The hangar stocks distinct equipment while upgrading the full trio through the same spending rules. |
| Strategy | Trio |
| Target overrides | none (goal 12 Robots → 3, the strategy default) |
| Team names | 2v2: **Ramba Ral Raiders** (robots 1+2) · 3v3: **Sieg Zeon** (1–3) |
| Event order | `league_3v3`, `tournament_3v3`, `league_2v2`, `tag_team`, `league_1v1`, `koth`, `grand_melee`, `tournament_2v2`, `tournament_1v1` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- 2v2 team 1+2: 'Zeon Hangar Pair 01' → 'Ramba Ral Raiders' (decision 14; delegated authoring)
- 3v3 team 1+2+3: 'Zeon Hangar Squad 01' → 'Sieg Zeon' (decision 14; delegated authoring)

Every blueprint is used at the robots target of 3; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | MS-06F Zaku II | `single` | mid | balanced | 15 | Tactician | Authentic standard green MS-06F Zaku II from 1979 Mobile Suit Gundam. | `zeon-mobile-suit-hangar/1.webp` |
| 2 | MS-07B Gouf | `single` | melee | offensive | 10 | Sprinter | Authentic blue MS-07B Gouf from original 1979 Gundam. | `zeon-mobile-suit-hangar/2.webp` |
| 3 | MS-09 Dom | `two_handed` | short | offensive | 10 | Bruiser | Authentic purple and black MS-09 Dom from 1979 Gundam. | `zeon-mobile-suit-hangar/3.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 MS-06F Zaku II | Bolt Carbine (₡93,000) | Nova Caster (₡425,000) |
| 2 MS-07B Gouf | Practice Sword (₡50,000) | Vibro Mace (₡425,000) |
| 3 MS-09 Dom | Scatter Cannon (₡84,000) | Arc Projector (₡488,000) |

**Refinement plans** (generated; applied by Trio goal 22, Refine → 10 steps per robot). All 3 robots: 15 steps, ₡8,430,000; the 3 robots at the target: ₡8,430,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| MS-06F Zaku II (5 steps, ₡2,810,000) | Nova Caster (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (8 → 9) ₡10,000 | ₡2,810,000 |
| MS-07B Gouf (5 steps, ₡2,810,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Gyro Stabilizers +1 (4 → 5) ₡10,000 | ₡2,810,000 |
| MS-09 Dom (5 steps, ₡2,810,000) | Arc Projector (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (7 → 8) ₡10,000 | ₡2,810,000 |

Storage (estimate; the engine counts at run time): 3 final weapons equipped at the robots target of 3. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5).

Source findings before decisions: A01 ×1, A03 ×1, V13 ×3.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 153. Dinobot Forge (`dinobot-forge`) — Generalist

| Field | Value |
|---|---|
| Stable name | Dinobot Forge |
| Franchise label | Transformers — Dinobots |
| Backstory | Three mechanical creatures bring heavy contact, short-range pressure and a guarded front to the forge. Their source forms remain single complete bodies with ordinary arena loadouts. |
| Strategy | Generalist |
| Target overrides | goal 14 Robots → 3 (strategy default 2, allowed 2–4) |
| Team names | 2v2: **Dinobot Charge** (robots 1+2) · 3v3: **Dinobots Transform** (1–3) |
| Event order | `league_1v1`, `league_2v2`, `tag_team`, `league_3v3`, `koth`, `grand_melee`, `tournament_1v1`, `tournament_2v2`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- Franchise label: 'Transformers' → 'Transformers — Dinobots' (decisions 14, 16; delegated authoring)
- 2v2 team 1+2: 'Dinobot Forge Pair 01' → 'Dinobot Charge' (decisions 14, 16; delegated authoring)
- 3v3 team 1+2+3: 'Dinobot Forge Squad 01' → 'Dinobots Transform' (decisions 14, 16; delegated authoring)

Every blueprint is used at the robots target of 3; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Grimlock | `two_handed` | melee | offensive | 10 | Bruiser | Authentic G1 Grimlock in mechanical Tyrannosaurus rex dinosaur form. | `dinobot-forge/1.webp` |
| 2 | Slag | `two_handed` | short | offensive | 10 | Bruiser | Authentic G1 Slag, also called Slug, in mechanical triceratops dinosaur form. | `dinobot-forge/2.webp` |
| 3 | Sludge | `weapon_shield` | melee | defensive | 25 | Warden | Authentic G1 Sludge in mechanical brontosaurus dinosaur form. | `dinobot-forge/3.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Grimlock | Shock Maul (₡183,000) | Heavy Hammer (₡478,000) |
| 2 Slag | Scatter Cannon (₡84,000) | Arc Projector (₡488,000) |
| 3 Sludge | Practice Sword + Light Shield (₡101,000) | Vibro Mace + Aegis Bulwark (₡834,000) |

**Refinement plans** (generated; applied by Generalist goal 18, Refine → 10 steps per robot). All 3 robots: 20 steps, ₡8,570,000; the 3 robots at the target: ₡8,570,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Grimlock (5 steps, ₡2,840,000) | Heavy Hammer (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +2 (7 → 9) ₡40,000 | ₡2,840,000 |
| Slag (5 steps, ₡2,840,000) | Arc Projector (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +2 (7 → 9) ₡40,000 | ₡2,840,000 |
| Sludge (10 steps, ₡2,890,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Counter Protocols +2 (5 → 7) ₡40,000 | ₡2,840,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |

Storage (estimate; the engine counts at run time): 4 final weapons equipped at the robots target of 3. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5), A09 ×1 (decision 8, 17), V16 ×1 (decision 7, 16).

Source findings before decisions: A01 ×1, A03 ×1, A09 ×1, V08 ×1, V13 ×3, V16 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 154. E-Series Combat Works (`e-series-combat-works`) — Duo

| Field | Value |
|---|---|
| Stable name | E-Series Combat Works |
| Franchise label | Sonic the Hedgehog — E-Robots |
| Backstory | A measured precision platform and a heavy close-pressure machine share a compact combat account. The workshop equips both before refining the eligible final gear. |
| Strategy | Duo |
| Target overrides | none (goal 13 Robots → 2, the strategy default) |
| Team names | 2v2: **Rogue E-Series** (robots 1+2) · 3v3: none |
| Event order | `league_2v2`, `tag_team`, `tournament_2v2`, `league_1v1`, `koth`, `grand_melee`, `tournament_1v1`, `league_3v3`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- Franchise label: 'Sonic the Hedgehog' → 'Sonic the Hedgehog — E-Robots' (decisions 14, 16; delegated authoring)
- 2v2 team 1+2: 'E-Series Pair Pair 01' → 'Rogue E-Series' (decisions 14, 16; delegated authoring)

Every blueprint is used at the robots target of 2; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | E-102 Gamma | `single` | long | balanced | 20 | Deadeye | Authentic E-102 Gamma from Sonic Adventure. | `e-series-combat-works/1.webp` |
| 2 | E-123 Omega | `two_handed` | short | offensive | 10 | Bruiser | Authentic E-123 Omega from Sonic Heroes. | `e-series-combat-works/2.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 E-102 Gamma | Beam Pistol (₡93,000) | Particle Lance (₡425,000) |
| 2 E-123 Omega | Scatter Cannon (₡84,000) | Arc Projector (₡488,000) |

**Refinement plans** (generated; applied by Duo goal 17, Refine → 10 steps per robot). All 2 robots: 10 steps, ₡5,620,000; the 2 robots at the target: ₡5,620,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| E-102 Gamma (5 steps, ₡2,810,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (5 → 6) ₡10,000 | ₡2,810,000 |
| E-123 Omega (5 steps, ₡2,810,000) | Arc Projector (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (7 → 8) ₡10,000 | ₡2,810,000 |

Storage (estimate; the engine counts at run time): 2 final weapons equipped at the robots target of 2. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5), V16 ×1 (decision 7, 16).

Source findings before decisions: A01 ×1, A03 ×1, V13 ×2, V16 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 155. Citadel Mechworks (`citadel-mechworks`) — Generalist

| Field | Value |
|---|---|
| Stable name | Citadel Mechworks |
| Franchise label | Mass Effect — Security Mechs |
| Backstory | A line machine, a low contact specialist and a heavy platform give the mechworks a practical three-role roster. The workshop upgrades the lead while bringing its heavy third chassis online. |
| Strategy | Generalist |
| Target overrides | goal 14 Robots → 3 (strategy default 2, allowed 2–4) |
| Team names | 2v2: **C-Sec Patrol** (robots 1+2) · 3v3: **Presidium Security** (1–3) |
| Event order | `league_1v1`, `league_2v2`, `tag_team`, `league_3v3`, `koth`, `grand_melee`, `tournament_1v1`, `tournament_2v2`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- Franchise label: 'Mass Effect' → 'Mass Effect — Security Mechs' (decisions 14, 16; delegated authoring)
- 2v2 team 1+2: 'Citadel Mechs Pair 01' → 'C-Sec Patrol' (decisions 14, 16; delegated authoring)
- 3v3 team 1+2+3: 'Citadel Mechs Squad 01' → 'Presidium Security' (decisions 14, 16; delegated authoring)

Every blueprint is used at the robots target of 3; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | LOKI | `single` | short | balanced | 15 | Versatile | Authentic LOKI security mech from Mass Effect 2. | `citadel-mechworks/1.webp` |
| 2 | FENRIS | `single` | melee | offensive | 10 | Sprinter | Authentic FENRIS mech from Mass Effect 2. | `citadel-mechworks/2.webp` |
| 3 | YMIR | `two_handed` | mid | offensive | 10 | Bruiser | Authentic YMIR heavy mech from Mass Effect 2. | `citadel-mechworks/3.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 LOKI | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |
| 2 FENRIS | Practice Sword (₡50,000) | Vibro Mace (₡425,000) |
| 3 YMIR | Training Rifle (₡50,000) | Plasma Cannon (₡408,000) |

**Refinement plans** (generated; applied by Generalist goal 18, Refine → 10 steps per robot). All 3 robots: 15 steps, ₡8,520,000; the 3 robots at the target: ₡8,520,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| LOKI (5 steps, ₡2,840,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +2 (8 → 10) ₡40,000 | ₡2,840,000 |
| FENRIS (5 steps, ₡2,840,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Gyro Stabilizers +2 (4 → 6) ₡40,000 | ₡2,840,000 |
| YMIR (5 steps, ₡2,840,000) | Plasma Cannon (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +2 (7 → 9) ₡40,000 | ₡2,840,000 |

Storage (estimate; the engine counts at run time): 3 final weapons equipped at the robots target of 3. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5), A02 ×1 (decision 9, 15), V16 ×1 (decision 7, 16).

Source findings before decisions: A01 ×1, A02 ×1, A03 ×1, V08 ×1, V13 ×3, V16 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 156. Machine Village Foundry (`machine-village-foundry`) — Generalist

| Field | Value |
|---|---|
| Stable name | Machine Village Foundry |
| Franchise label | NieR |
| Backstory | A careful village machine, a small contact frame and a heavier biped make an adaptable repaired roster. Modest purchases and maintenance keep all three useful. |
| Strategy | Generalist |
| Target overrides | goal 14 Robots → 3 (strategy default 2, allowed 2–4) |
| Team names | 2v2: **Peaceful Machines** (robots 1+2) · 3v3: **Pascal's Village** (1–3) |
| Event order | `league_1v1`, `league_2v2`, `tag_team`, `league_3v3`, `koth`, `grand_melee`, `tournament_1v1`, `tournament_2v2`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- 2v2 team 1+2: 'Village Foundry Pair 01' → 'Peaceful Machines' (decisions 14, 18; delegated authoring)
- 3v3 team 1+2+3: 'Village Foundry Squad 01' → "Pascal's Village" (decisions 14, 18; delegated authoring)
- Slot 2 robot name: 'Small Stubby 02' → 'Leibniz' (decisions 14, 18; delegated authoring)
- Slot 2 art brief: 'Authentic NieR Automata Small Stubby machine lifeform, original arena unit label 02.' → 'Rust-mottled small stubby machine, round head with two dark eyes, rusty sword held low across its legs' (decisions 14, 18; delegated authoring)
- Slot 2 portrait: aligned (decisions 14, 18; delegated authoring)
- Slot 3 robot name: 'Medium Biped 03' → 'Spinoza' (decisions 14, 18; delegated authoring)
- Slot 3 art brief: 'Authentic NieR Automata Medium Biped machine lifeform, original arena unit label 03.' → 'Tall rusted medium biped, small dome head with two glowing eyes, long thin legs, curved rusty blade' (decisions 14, 18; delegated authoring)
- Slot 3 portrait: aligned (decisions 14, 18; delegated authoring)

Every blueprint is used at the robots target of 3; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Pascal | `single` | short | defensive | 30 | Tactician | Authentic Pascal from NieR Automata (2017). | `machine-village-foundry/1.webp` |
| 2 | Leibniz | `single` | melee | offensive | 10 | Sprinter | Rust-mottled small stubby machine, round head with two dark eyes, rusty sword held low across its legs | `machine-village-foundry/2.webp` |
| 3 | Spinoza | `two_handed` | mid | offensive | 10 | Bruiser | Tall rusted medium biped, small dome head with two glowing eyes, long thin legs, curved rusty blade | `machine-village-foundry/3.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Pascal | Practice Blaster (₡50,000) | Volt Sabre (₡425,000) |
| 2 Leibniz | Practice Sword (₡50,000) | Vibro Mace (₡425,000) |
| 3 Spinoza | Training Rifle (₡50,000) | Plasma Cannon (₡408,000) |

**Refinement plans** (generated; applied by Generalist goal 18, Refine → 10 steps per robot). All 3 robots: 15 steps, ₡8,490,000; the 3 robots at the target: ₡8,490,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Pascal (5 steps, ₡2,810,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (8 → 9) ₡10,000 | ₡2,810,000 |
| Leibniz (5 steps, ₡2,840,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Gyro Stabilizers +2 (4 → 6) ₡40,000 | ₡2,840,000 |
| Spinoza (5 steps, ₡2,840,000) | Plasma Cannon (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +2 (7 → 9) ₡40,000 | ₡2,840,000 |

Storage (estimate; the engine counts at run time): 3 final weapons equipped at the robots target of 3. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5).

Source findings before decisions: A01 ×1, A03 ×2, A13 ×2, V08 ×1, V13 ×3.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 157. Machine City Sentinel Array (`machine-city-sentinel-array`) — Swarm

| Field | Value |
|---|---|
| Stable name | Machine City Sentinel Array |
| Franchise label | The Matrix |
| Backstory | Eleven articulated machines fill distinct arena jobs from mobile scouts to heavy support. Their shared origin supplies the atmosphere; each body buys its own supported equipment. |
| Strategy | Swarm |
| Target overrides | none (goal 10 Robots → 11, the strategy default) |
| Team names | 2v2: **Search and Destroy** (robots 1+2), **Sewer Line Hunt** (3+4), **Hovercraft Chasers** (5+6), **Dock Breach** (7+8), **Broadcast Depth** (9+10) · 3v3: **Battle of Zion** (1–3), **Deus Ex Machina** (4–6), **Machine War Swarm** (7–9) |
| Event order | `league_3v3`, `league_2v2`, `tag_team`, `league_1v1`, `koth`, `grand_melee`, `tournament_3v3`, `tournament_2v2`, `tournament_1v1` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- Franchise label: 'The Matrix — film continuity' → 'The Matrix' (decisions 14, 15, 16, 18; delegated authoring)
- 2v2 team 1+2: 'Machine City Pair 01' → 'Search and Destroy' (decisions 14, 15, 16, 18; delegated authoring)
- 2v2 team 3+4: 'Machine City Pair 02' → 'Sewer Line Hunt' (decisions 14, 15, 16, 18; delegated authoring)
- 2v2 team 5+6: 'Machine City Pair 03' → 'Hovercraft Chasers' (decisions 14, 15, 16, 18; delegated authoring)
- 2v2 team 7+8: 'Machine City Pair 04' → 'Dock Breach' (decisions 14, 15, 16, 18; delegated authoring)
- 2v2 team 9+10: 'Machine City Pair 05' → 'Broadcast Depth' (decisions 14, 15, 16, 18; delegated authoring)
- 3v3 team 1+2+3: 'Machine City Squad 01' → 'Battle of Zion' (decisions 14, 15, 16, 18; delegated authoring)
- 3v3 team 4+5+6: 'Machine City Squad 02' → 'Deus Ex Machina' (decisions 14, 15, 16, 18; delegated authoring)
- 3v3 team 7+8+9: 'Machine City Squad 03' → 'Machine War Swarm' (decisions 14, 15, 16, 18; delegated authoring)
- Slot 1 robot name: 'Sentinel 01' → 'Squiddy 01' (decisions 14, 15, 16, 18; delegated authoring)
- Slot 1 art brief: 'ONE Matrix Sentinel from the original 1999–2003 film trilogy.' → 'Black domed Sentinel, ring of red eyes round one large lens, tentacles spread wide to claw tips' (decisions 14, 15, 16, 18; delegated authoring)
- Slot 1 'Squiddy 01': numbered name accepted as a mass-produced designation (decisions 14, 15, 16, 18; delegated authoring)
- Slot 1 portrait: aligned (decisions 14, 15, 16, 18; delegated authoring)
- Slot 2 robot name: 'Sentinel 02' → 'Squiddy 02' (decisions 14, 15, 16, 18; delegated authoring)
- Slot 2 art brief: 'ONE Matrix Sentinel from the original 1999–2003 film trilogy.' → 'Black Sentinel facing the viewer, dense red eye cluster, one tentacle raised high, the rest splayed wide' (decisions 14, 15, 16, 18; delegated authoring)
- Slot 2 'Squiddy 02': numbered name accepted as a mass-produced designation (decisions 14, 15, 16, 18; delegated authoring)
- Slot 2 portrait: aligned (decisions 14, 15, 16, 18; delegated authoring)
- Slot 3 robot name: 'Sentinel 03' → 'Squiddy 03' (decisions 14, 15, 16, 18; delegated authoring)
- Slot 3 art brief: 'ONE Matrix Sentinel from the original 1999–2003 film trilogy.' → 'Banded flat-dome Sentinel turned to the right, side eye cluster, tentacles curling up on both sides' (decisions 14, 15, 16, 18; delegated authoring)
- Slot 3 'Squiddy 03': numbered name accepted as a mass-produced designation (decisions 14, 15, 16, 18; delegated authoring)
- Slot 3 portrait: aligned (decisions 14, 15, 16, 18; delegated authoring)
- Slot 4 robot name: 'Sentinel 04' → 'Squiddy 04' (decisions 14, 15, 16, 18; delegated authoring)
- Slot 4 art brief: 'ONE Matrix Sentinel from the original 1999–2003 film trilogy.' → 'Ribbed round Sentinel head-on, red eye ring, tentacles splayed low with red-lit claws on the floor' (decisions 14, 15, 16, 18; delegated authoring)
- Slot 4 'Squiddy 04': numbered name accepted as a mass-produced designation (decisions 14, 15, 16, 18; delegated authoring)
- Slot 4 portrait: aligned (decisions 14, 15, 16, 18; delegated authoring)
- Slot 5 robot name: 'Sentinel 05' → 'Squiddy 05' (decisions 14, 15, 16, 18; delegated authoring)
- Slot 5 art brief: 'ONE Matrix Sentinel from the original 1999–2003 film trilogy.' → 'Dark Sentinel turned right, two rear tentacles arched overhead like scorpion tails, red eyes' (decisions 14, 15, 16, 18; delegated authoring)
- Slot 5 'Squiddy 05': numbered name accepted as a mass-produced designation (decisions 14, 15, 16, 18; delegated authoring)
- Slot 5 portrait: aligned (decisions 14, 15, 16, 18; delegated authoring)
- Slot 6 robot name: 'Sentinel 06' → 'Squiddy 06' (decisions 14, 15, 16, 18; delegated authoring)
- Slot 6 art brief: 'ONE Matrix Sentinel from the original 1999–2003 film trilogy.' → 'Elongated Sentinel in a low stalking crouch, tentacles creeping forward, one curled up behind' (decisions 14, 15, 16, 18; delegated authoring)
- Slot 6 'Squiddy 06': numbered name accepted as a mass-produced designation (decisions 14, 15, 16, 18; delegated authoring)
- Slot 6 portrait: aligned (decisions 14, 15, 16, 18; delegated authoring)
- Slot 7 robot name: 'Sentinel 07' → 'Squiddy 07' (decisions 14, 15, 16, 18; delegated authoring)
- Slot 7 art brief: 'ONE Matrix Sentinel from the original 1999–2003 film trilogy.' → 'Open-frame ribbed Sentinel with visible internals, two upper tentacles hooked like question marks' (decisions 14, 15, 16, 18; delegated authoring)
- Slot 7 'Squiddy 07': numbered name accepted as a mass-produced designation (decisions 14, 15, 16, 18; delegated authoring)
- Slot 7 portrait: aligned (decisions 14, 15, 16, 18; delegated authoring)
- Slot 8 robot name: 'Sentinel 08' → 'Squiddy 08' (decisions 14, 15, 16, 18; delegated authoring)
- Slot 8 art brief: 'ONE Matrix Sentinel from the original 1999–2003 film trilogy.' → 'Banded domed Sentinel hovering with twin antennae, tentacles hanging below, claws opened out' (decisions 14, 15, 16, 18; delegated authoring)
- Slot 8 'Squiddy 08': numbered name accepted as a mass-produced designation (decisions 14, 15, 16, 18; delegated authoring)
- Slot 8 portrait: aligned (decisions 14, 15, 16, 18; delegated authoring)
- Slot 9 robot name: 'Sentinel 09' → 'Squiddy 09' (decisions 14, 15, 16, 18; delegated authoring)
- Slot 9 art brief: 'ONE Matrix Sentinel from the original 1999–2003 film trilogy.' → 'Broad flat-topped Sentinel, row of red eyes along its rim, tentacles dangling straight like a jellyfish' (decisions 14, 15, 16, 18; delegated authoring)
- Slot 9 'Squiddy 09': numbered name accepted as a mass-produced designation (decisions 14, 15, 16, 18; delegated authoring)
- Slot 9 portrait: aligned (decisions 14, 15, 16, 18; delegated authoring)
- Slot 10 robot name: 'Sentinel 10' → 'Squiddy 10' (decisions 14, 15, 16, 18; delegated authoring)
- Slot 10 art brief: 'ONE Matrix Sentinel from the original 1999–2003 film trilogy.' → 'Sentinel tilted forward, packed red eye cluster, one long tentacle stretched along the floor' (decisions 14, 15, 16, 18; delegated authoring)
- Slot 10 'Squiddy 10': numbered name accepted as a mass-produced designation (decisions 14, 15, 16, 18; delegated authoring)
- Slot 10 portrait: aligned (decisions 14, 15, 16, 18; delegated authoring)
- Slot 11 robot name: 'Sentinel 11' → 'Squiddy 11' (decisions 14, 15, 16, 18; delegated authoring)
- Slot 11 art brief: 'ONE Matrix Sentinel from the original 1999–2003 film trilogy.' → 'Drum-bodied banded Sentinel, one big red eye off-centre, two front tentacles reaching at the viewer' (decisions 14, 15, 16, 18; delegated authoring)
- Slot 11 'Squiddy 11': numbered name accepted as a mass-produced designation (decisions 14, 15, 16, 18; delegated authoring)
- Slot 11 portrait: aligned (decisions 14, 15, 16, 18; delegated authoring)

Every blueprint is used at the robots target of 11; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Squiddy 01 | `single` | short | balanced | 20 | Sprinter | Black domed Sentinel, ring of red eyes round one large lens, tentacles spread wide to claw tips | `machine-city-sentinel-array/1.webp` |
| 2 | Squiddy 02 | `dual_wield` | short | offensive | 10 | Sprinter | Black Sentinel facing the viewer, dense red eye cluster, one tentacle raised high, the rest splayed wide | `machine-city-sentinel-array/2.webp` |
| 3 | Squiddy 03 | `single` | melee | offensive | 10 | Sprinter | Banded flat-dome Sentinel turned to the right, side eye cluster, tentacles curling up on both sides | `machine-city-sentinel-array/3.webp` |
| 4 | Squiddy 04 | `single` | mid | balanced | 15 | Tactician | Ribbed round Sentinel head-on, red eye ring, tentacles splayed low with red-lit claws on the floor | `machine-city-sentinel-array/4.webp` |
| 5 | Squiddy 05 | `weapon_shield` | short | defensive | 25 | Warden | Dark Sentinel turned right, two rear tentacles arched overhead like scorpion tails, red eyes | `machine-city-sentinel-array/5.webp` |
| 6 | Squiddy 06 | `single` | long | balanced | 20 | Deadeye | Elongated Sentinel in a low stalking crouch, tentacles creeping forward, one curled up behind | `machine-city-sentinel-array/6.webp` |
| 7 | Squiddy 07 | `dual_wield` | melee | offensive | 10 | Sprinter | Open-frame ribbed Sentinel with visible internals, two upper tentacles hooked like question marks | `machine-city-sentinel-array/7.webp` |
| 8 | Squiddy 08 | `two_handed` | short | offensive | 10 | Bruiser | Banded domed Sentinel hovering with twin antennae, tentacles hanging below, claws opened out | `machine-city-sentinel-array/8.webp` |
| 9 | Squiddy 09 | `two_handed` | mid | offensive | 10 | Bruiser | Broad flat-topped Sentinel, row of red eyes along its rim, tentacles dangling straight like a jellyfish | `machine-city-sentinel-array/9.webp` |
| 10 | Squiddy 10 | `weapon_shield` | long | defensive | 20 | Warden | Sentinel tilted forward, packed red eye cluster, one long tentacle stretched along the floor | `machine-city-sentinel-array/10.webp` |
| 11 | Squiddy 11 | `two_handed` | long | balanced | 15 | Deadeye | Drum-bodied banded Sentinel, one big red eye off-centre, two front tentacles reaching at the viewer | `machine-city-sentinel-array/11.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Squiddy 01 | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |
| 2 Squiddy 02 | Laser Pistol ×2 (₡114,000) | Volt Sabre ×2 (₡850,000) |
| 3 Squiddy 03 | Practice Sword (₡50,000) | Vibro Mace (₡425,000) |
| 4 Squiddy 04 | Bolt Carbine (₡93,000) | Nova Caster (₡425,000) |
| 5 Squiddy 05 | Laser Pistol + Light Shield (₡108,000) | Volt Sabre + Aegis Bulwark (₡834,000) |
| 6 Squiddy 06 | Beam Pistol (₡93,000) | Particle Lance (₡425,000) |
| 7 Squiddy 07 | Practice Sword ×2 (₡100,000) | Vibro Mace ×2 (₡850,000) |
| 8 Squiddy 08 | Scatter Cannon (₡84,000) | Arc Projector (₡488,000) |
| 9 Squiddy 09 | Training Rifle (₡50,000) | Plasma Cannon (₡408,000) |
| 10 Squiddy 10 | Beam Pistol + Light Shield (₡144,000) | Particle Lance + Aegis Bulwark (₡834,000) |
| 11 Squiddy 11 | Training Beam (₡50,000) | Ion Beam (₡544,000) |

**Refinement plans** (generated; applied by Swarm goal 23, Refine → 8 steps per robot). All 11 robots: 75 steps, ₡38,160,000; the 11 robots at the target: ₡38,160,000; Refine → 8 applies ₡37,480,000 of the target robots' plans.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Squiddy 01 (5 steps, ₡2,960,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Power Core +4 (−3 → 1) ₡160,000 | ₡2,960,000 |
| Squiddy 02 (10 steps, ₡5,920,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 · 9 Hone Power Core +4 (−3 → 1) ₡160,000 | ₡2,960,000 |
|  | Volt Sabre (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 · 10 Hone Power Core +4 (−3 → 1) ₡160,000 | ₡2,960,000 |
| Squiddy 03 (5 steps, ₡2,960,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Gyro Stabilizers +4 (4 → 8) ₡160,000 | ₡2,960,000 |
| Squiddy 04 (5 steps, ₡2,820,000) | Nova Caster (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Combat Algorithms +1 (new) ₡20,000 | ₡2,820,000 |
| Squiddy 05 (10 steps, ₡2,870,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Armor Plating +1 (new) ₡20,000 | ₡2,820,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |
| Squiddy 06 (5 steps, ₡2,960,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +4 (5 → 9) ₡160,000 | ₡2,960,000 |
| Squiddy 07 (10 steps, ₡5,920,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 · 9 Hone Gyro Stabilizers +4 (4 → 8) ₡160,000 | ₡2,960,000 |
|  | Vibro Mace (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 · 10 Hone Gyro Stabilizers +4 (4 → 8) ₡160,000 | ₡2,960,000 |
| Squiddy 08 (5 steps, ₡2,960,000) | Arc Projector (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| Squiddy 09 (5 steps, ₡2,960,000) | Plasma Cannon (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Critical Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| Squiddy 10 (10 steps, ₡2,870,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Armor Plating +1 (new) ₡20,000 | ₡2,820,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |
| Squiddy 11 (5 steps, ₡2,960,000) | Ion Beam (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (4 → 8) ₡160,000 | ₡2,960,000 |

Storage (estimate; the engine counts at run time): 15 final weapons equipped at the robots target of 11. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need Storage Facility L2; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A02 ×1 (decision 9, 15).

Source findings before decisions: A02 ×2, A03 ×2, A13 ×11, V03 ×9, V13 ×11, V18 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 158. Neo-Tokyo Security Works (`neo-tokyo-security-works`) — Paragon

| Field | Value |
|---|---|
| Stable name | Neo-Tokyo Security Works |
| Franchise label | Akira |
| Backstory | A rounded security machine becomes the works' sole contender. One compact mid-range allocation preserves its industrial body while concentrated equipment purchases build a capable champion. |
| Strategy | Paragon |
| Target overrides | none (goal 8 Robots → 1, the strategy default) |
| Team names | 2v2: none · 3v3: none |
| Event order | `league_1v1`, `tournament_1v1`, `koth`, `grand_melee`, `league_2v2`, `tag_team`, `tournament_2v2`, `league_3v3`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- Franchise label: "Akira — Katsuhiro Otomo's manga" → 'Akira' (decision 16; delegated authoring)

Every blueprint is used at the robots target of 1; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Security Ball | `single` | mid | balanced | 15 | Tactician | Use the attached published manga sample as the mechanical reference: the intact autonomous spherical caretaker shown in the street, especially the lower-right panel and left overhead view, not the… | `neo-tokyo-security-works/1.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Security Ball | Bolt Carbine (₡93,000) | Nova Caster (₡425,000) |

**Refinement plans** (generated; applied by Paragon goal 16, Refine → 10 steps per robot). The only blueprint: 4 steps, ₡2,800,000; the robot at the target: ₡2,800,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Security Ball (4 steps, ₡2,800,000) | Nova Caster (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 | ₡2,800,000 |

Storage (estimate; the engine counts at run time): 1 final weapons equipped at the robots target of 1. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5).

Source findings before decisions: A01 ×1, V13 ×1, V18 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 159. ENCOM Program Arena (`encom-program-arena`) — Trio

| Field | Value |
|---|---|
| Stable name | ENCOM Program Arena |
| Franchise label | TRON |
| Backstory | Three embodied programs divide agile contact, measured fire and cautious support. The arena gives each avatar one ordinary equipment plan without turning software identity into extra mechanics. |
| Strategy | Trio |
| Target overrides | none (goal 12 Robots → 3, the strategy default) |
| Team names | 2v2: **Light Cycle Duel** (robots 1+2) · 3v3: **End of Line** (1–3) |
| Event order | `league_3v3`, `tournament_3v3`, `league_2v2`, `tag_team`, `league_1v1`, `koth`, `grand_melee`, `tournament_2v2`, `tournament_1v1` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- Franchise label: 'TRON — 1982 film' → 'TRON' (decisions 14, 16; delegated authoring)
- 2v2 team 1+2: 'ENCOM Arena Pair 01' → 'Light Cycle Duel' (decisions 14, 16; delegated authoring)
- 3v3 team 1+2+3: 'ENCOM Arena Squad 01' → 'End of Line' (decisions 14, 16; delegated authoring)

Every blueprint is used at the robots target of 3; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Tron | `single` | melee | offensive | 10 | Sprinter | Tron from TRON 1982, human-looking male program avatar with original white/grey circuit suit, blue glowing circuit lines, original rounded helmet, black undersuit details and identity disc carried… | `encom-program-arena/1.webp` |
| 2 | Sark | `single` | mid | balanced | 15 | Tactician | Sark from TRON 1982, human-looking male program avatar with original angular helmet and broad layered shoulder construction, white/grey costume with RED luminous circuitry and dark accents. | `encom-program-arena/2.webp` |
| 3 | Yori | `single` | short | defensive | 30 | Tactician | Yori from TRON 1982, recognizable human-looking female program avatar in original fitted pale circuit suit and source smooth pale head covering/helmet with blue luminous circuit pattern. | `encom-program-arena/3.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Tron | Practice Sword (₡50,000) | Vibro Mace (₡425,000) |
| 2 Sark | Bolt Carbine (₡93,000) | Nova Caster (₡425,000) |
| 3 Yori | Practice Blaster (₡50,000) | Volt Sabre (₡425,000) |

**Refinement plans** (generated; applied by Trio goal 22, Refine → 10 steps per robot). All 3 robots: 15 steps, ₡8,430,000; the 3 robots at the target: ₡8,430,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Tron (5 steps, ₡2,810,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Gyro Stabilizers +1 (4 → 5) ₡10,000 | ₡2,810,000 |
| Sark (5 steps, ₡2,810,000) | Nova Caster (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (8 → 9) ₡10,000 | ₡2,810,000 |
| Yori (5 steps, ₡2,810,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (8 → 9) ₡10,000 | ₡2,810,000 |

Storage (estimate; the engine counts at run time): 3 final weapons equipped at the robots target of 3. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5), A09 ×1 (decision 8, 17).

Source findings before decisions: A01 ×1, A03 ×1, A09 ×1, V13 ×3, V18 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 160. Endurance Robotics Pair (`endurance-robotics-pair`) — Duo

| Field | Value |
|---|---|
| Stable name | Endurance Robotics Pair |
| Franchise label | Interstellar |
| Backstory | Two segmented mission machines bring protected contact and precision support to a patient workshop. Partner investment and repair reserves matter more than extravagant loadouts. |
| Strategy | Duo |
| Target overrides | none (goal 13 Robots → 2, the strategy default) |
| Team names | 2v2: **Miller's Planet Rescue** (robots 1+2) · 3v3: none |
| Event order | `league_2v2`, `tag_team`, `tournament_2v2`, `league_1v1`, `koth`, `grand_melee`, `tournament_1v1`, `league_3v3`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- Franchise label: 'Interstellar — 2014 film' → 'Interstellar' (decisions 14, 16; delegated authoring)
- 2v2 team 1+2: 'Endurance Pair Pair 01' → "Miller's Planet Rescue" (decisions 14, 16; delegated authoring)

Every blueprint is used at the robots target of 2; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | TARS | `weapon_shield` | melee | defensive | 25 | Warden | TARS from Interstellar 2014, ONE complete utilitarian rectangular robot made of four long connected brushed-metal vertical slabs with dark small display panels inset at the upper central area. | `endurance-robotics-pair/1.webp` |
| 2 | CASE | `single` | long | balanced | 20 | Deadeye | CASE from Interstellar 2014, ONE connected four-slab brushed-metal rectangular mission robot with source inset dark display panels. | `endurance-robotics-pair/2.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 TARS | Practice Sword + Light Shield (₡101,000) | Vibro Mace + Aegis Bulwark (₡834,000) |
| 2 CASE | Beam Pistol (₡93,000) | Particle Lance (₡425,000) |

**Refinement plans** (generated; applied by Duo goal 17, Refine → 10 steps per robot). All 2 robots: 15 steps, ₡5,670,000; the 2 robots at the target: ₡5,670,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| TARS (10 steps, ₡2,860,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Counter Protocols +1 (5 → 6) ₡10,000 | ₡2,810,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |
| CASE (5 steps, ₡2,810,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (5 → 6) ₡10,000 | ₡2,810,000 |

Storage (estimate; the engine counts at run time): 3 final weapons equipped at the robots target of 2. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5).

Source findings before decisions: A01 ×1, A03 ×1, A07 ×1, V13 ×2, V18 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 161. Blue Book Synthetic Laboratory (`blue-book-synthetic-laboratory`) — Paragon

| Field | Value |
|---|---|
| Stable name | Blue Book Synthetic Laboratory |
| Franchise label | Ex Machina |
| Backstory | A precise synthetic carries the laboratory's single arena account. Mobile equipment and staged refinement reward careful investment while its source body remains intact. |
| Strategy | Paragon |
| Target overrides | none (goal 8 Robots → 1, the strategy default) |
| Team names | 2v2: none · 3v3: none |
| Event order | `league_1v1`, `tournament_1v1`, `koth`, `grand_melee`, `league_2v2`, `tag_team`, `tournament_2v2`, `league_3v3`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- Franchise label: 'Ex Machina — 2014 film' → 'Ex Machina' (decision 16; delegated authoring)

Every blueprint is used at the robots target of 1; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Ava | `single` | short | balanced | 20 | Sprinter | Ava from Ex Machina 2014, adult female android with recognizable human face, bare smooth synthetic scalp and visible dark metallic internal structures, silver fine-mesh-covered torso, hips and… | `blue-book-synthetic-laboratory/1.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Ava | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |

**Refinement plans** (generated; applied by Paragon goal 16, Refine → 10 steps per robot). The only blueprint: 4 steps, ₡2,800,000; the robot at the target: ₡2,800,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Ava (4 steps, ₡2,800,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 | ₡2,800,000 |

Storage (estimate; the engine counts at run time): 1 final weapons equipped at the robots target of 1. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5).

Source findings before decisions: A01 ×1, V13 ×1, V18 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 162. Companion Defence Laboratory (`companion-defence-laboratory`) — Duo

| Field | Value |
|---|---|
| Stable name | Companion Defence Laboratory |
| Franchise label | M3GAN |
| Backstory | A nimble companion machine and a military specialist share an uneasy arena collection. The workshop funds distinct close and distant jobs through balanced partner upgrades. |
| Strategy | Duo |
| Target overrides | none (goal 13 Robots → 2, the strategy default) |
| Team names | 2v2: **Funki Prototypes** (robots 1+2) · 3v3: none |
| Event order | `league_2v2`, `tag_team`, `tournament_2v2`, `league_1v1`, `koth`, `grand_melee`, `tournament_1v1`, `league_3v3`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- Franchise label: 'M3GAN — film continuity through M3GAN 2.0' → 'M3GAN' (decisions 14, 16; delegated authoring)
- 2v2 team 1+2: 'Companion Defence Pair 01' → 'Funki Prototypes' (decisions 14, 16; delegated authoring)

Every blueprint is used at the robots target of 2; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | M3GAN | `dual_wield` | melee | offensive | 10 | Sprinter | M3GAN using her original 2023 lifelike doll body and signature outfit: long honey-blond hair, recognizable pale doll face with blue eyes, beige pleated dress over a striped long-sleeve undershirt… | `companion-defence-laboratory/1.webp` |
| 2 | AMELIA | `single` | long | balanced | 20 | Deadeye | AMELIA from M3GAN 2.0 2025, the adult female infiltration android portrayed by Ivanna Sakhno, authentic human-looking face and blonde hair in a sleek pulled-back infiltration hairstyle, fitted black… | `companion-defence-laboratory/2.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 M3GAN | Practice Sword ×2 (₡100,000) | Vibro Mace ×2 (₡850,000) |
| 2 AMELIA | Beam Pistol (₡93,000) | Particle Lance (₡425,000) |

**Refinement plans** (generated; applied by Duo goal 17, Refine → 10 steps per robot). All 2 robots: 15 steps, ₡8,430,000; the 2 robots at the target: ₡8,430,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| M3GAN (10 steps, ₡5,620,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 · 9 Hone Gyro Stabilizers +1 (4 → 5) ₡10,000 | ₡2,810,000 |
|  | Vibro Mace (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 · 10 Hone Gyro Stabilizers +1 (4 → 5) ₡10,000 | ₡2,810,000 |
| AMELIA (5 steps, ₡2,810,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (5 → 6) ₡10,000 | ₡2,810,000 |

Storage (estimate; the engine counts at run time): 3 final weapons equipped at the robots target of 2. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5), A02 ×1 (decision 9, 15), A09 ×1 (decision 8, 17).

Source findings before decisions: A01 ×1, A02 ×1, A03 ×1, A09 ×1, V13 ×2, V18 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 163. Repopulation Facility Robotics (`repopulation-facility-robotics`) — Paragon

| Field | Value |
|---|---|
| Stable name | Repopulation Facility Robotics |
| Franchise label | I Am Mother |
| Backstory | A substantial caretaker protects a one-machine workshop with defensive equipment and cautious retreats. Shield and weapon improvements follow funded maintenance milestones. |
| Strategy | Paragon |
| Target overrides | none (goal 8 Robots → 1, the strategy default) |
| Team names | 2v2: none · 3v3: none |
| Event order | `league_1v1`, `tournament_1v1`, `koth`, `grand_melee`, `league_2v2`, `tag_team`, `tournament_2v2`, `league_3v3`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- Franchise label: 'I Am Mother — 2019 film' → 'I Am Mother' (decision 16; delegated authoring)

Every blueprint is used at the robots target of 1; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Mother IM | `weapon_shield` | short | defensive | 25 | Warden | Mother robot from I Am Mother 2019, full utilitarian humanoid caretaker frame, pale worn industrial casing over sturdy exposed dark mechanical joints, recognizable film sensor head with dark central… | `repopulation-facility-robotics/1.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Mother IM | Laser Pistol + Light Shield (₡108,000) | Volt Sabre + Aegis Bulwark (₡834,000) |

**Refinement plans** (generated; applied by Paragon goal 16, Refine → 10 steps per robot). The only blueprint: 4 steps, ₡2,800,000; the robot at the target: ₡2,800,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Mother IM (4 steps, ₡2,800,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 | ₡2,800,000 |
|  | Aegis Bulwark (offhand) | no step (allowed: shields need no step) | ₡0 |

Storage (estimate; the engine counts at run time): 2 final weapons equipped at the robots target of 1. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5).

Source findings before decisions: A01 ×1, V13 ×1, V18 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 164. Simulant Refuge Workshop (`simulant-refuge-workshop`) — Generalist

| Field | Value |
|---|---|
| Stable name | Simulant Refuge Workshop |
| Franchise label | The Creator |
| Backstory | A military lead, a protected guard and a cautious civilian frame give the refuge a small adaptable roster. Their equipment roles are arena contracts rather than new source-world identities. |
| Strategy | Generalist |
| Target overrides | goal 14 Robots → 3 (strategy default 2, allowed 2–4) |
| Team names | 2v2: **Simulant Resistance** (robots 1+2) · 3v3: **New Asia Defenders** (1–3) |
| Event order | `league_1v1`, `league_2v2`, `tag_team`, `league_3v3`, `koth`, `grand_melee`, `tournament_1v1`, `tournament_2v2`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- Franchise label: 'The Creator — 2023 film' → 'The Creator' (decisions 14, 16, 18; delegated authoring)
- 2v2 team 1+2: 'Refuge Circuit Pair 01' → 'Simulant Resistance' (decisions 14, 16, 18; delegated authoring)
- 3v3 team 1+2+3: 'Refuge Circuit Squad 01' → 'New Asia Defenders' (decisions 14, 16, 18; delegated authoring)
- Slot 2 robot name: 'Refuge Guard 02' → 'Takumi' (decisions 14, 16, 18; delegated authoring)
- Slot 2 art brief: 'One adult military simulant from The Creator 2023 in a recognizable film military configuration: human-looking Asian male face, cylindrical open mechanical head/ear architecture and exposed neck…' → 'Young simulant soldier in green camo and plate carrier, rifle at low ready, open cylinder head port' (decisions 14, 16, 18; delegated authoring)
- Slot 2 portrait: aligned (decisions 14, 16, 18; delegated authoring)
- Slot 3 robot name: 'Refuge Monk 03' → 'Brother Sonam' (decisions 14, 16, 18; delegated authoring)
- Slot 3 art brief: "One adult civilian Buddhist monk simulant from The Creator 2023: mature human-like Asian face with shaved scalp and the film's exposed cylindrical head openings/neck components, simple…" → 'Elderly simulant monk in layered saffron robes and sandals, shaved head with mechanical ear ports' (decisions 14, 16, 18; delegated authoring)
- Slot 3 portrait: aligned (decisions 14, 16, 18; delegated authoring)

Every blueprint is used at the robots target of 3; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Harun | `single` | mid | balanced | 15 | Tactician | Harun from The Creator 2023, recognizable adult human-like face of the film character portrayed by Ken Watanabe, exposed cylindrical mechanical openings through the side/back of head and neck… | `simulant-refuge-workshop/1.webp` |
| 2 | Takumi | `weapon_shield` | short | defensive | 25 | Warden | Young simulant soldier in green camo and plate carrier, rifle at low ready, open cylinder head port | `simulant-refuge-workshop/2.webp` |
| 3 | Brother Sonam | `single` | short | defensive | 30 | Tactician | Elderly simulant monk in layered saffron robes and sandals, shaved head with mechanical ear ports | `simulant-refuge-workshop/3.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Harun | Bolt Carbine (₡93,000) | Nova Caster (₡425,000) |
| 2 Takumi | Laser Pistol + Light Shield (₡108,000) | Volt Sabre + Aegis Bulwark (₡834,000) |
| 3 Brother Sonam | Practice Blaster (₡50,000) | Volt Sabre (₡425,000) |

**Refinement plans** (generated; applied by Generalist goal 18, Refine → 10 steps per robot). All 3 robots: 20 steps, ₡8,480,000; the 3 robots at the target: ₡8,480,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Harun (5 steps, ₡2,810,000) | Nova Caster (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (8 → 9) ₡10,000 | ₡2,810,000 |
| Takumi (10 steps, ₡2,860,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (8 → 9) ₡10,000 | ₡2,810,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |
| Brother Sonam (5 steps, ₡2,810,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (8 → 9) ₡10,000 | ₡2,810,000 |

Storage (estimate; the engine counts at run time): 4 final weapons equipped at the robots target of 3. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5), A09 ×1 (decision 8, 17).

Source findings before decisions: A01 ×1, A03 ×2, A09 ×1, A13 ×2, V08 ×1, V13 ×3, V18 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 165. Iron City Berserker Workshop (`iron-city-berserker-workshop`) — Paragon

| Field | Value |
|---|---|
| Stable name | Iron City Berserker Workshop |
| Franchise label | Alita: Battle Angel |
| Backstory | One articulated cyborg takes the workshop's concentrated contact-combat investment. A complete paired weapon upgrade precedes refinement, with repairs funded before every purchase. |
| Strategy | Paragon |
| Target overrides | none (goal 8 Robots → 1, the strategy default) |
| Team names | 2v2: none · 3v3: none |
| Event order | `league_1v1`, `tournament_1v1`, `koth`, `grand_melee`, `league_2v2`, `tag_team`, `tournament_2v2`, `league_3v3`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- Franchise label: 'Alita: Battle Angel — 2019 film' → 'Alita: Battle Angel' (decision 16; delegated authoring)

Every blueprint is used at the robots target of 1; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Alita | `dual_wield` | melee | offensive | 10 | Sprinter | Alita from the 2019 Alita: Battle Angel film in her coherent silver-grey Berserker cyborg body. | `iron-city-berserker-workshop/1.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Alita | Practice Sword ×2 (₡100,000) | Vibro Mace ×2 (₡850,000) |

**Refinement plans** (generated; applied by Paragon goal 16, Refine → 10 steps per robot). The only blueprint: 8 steps, ₡5,600,000; the robot at the target: ₡5,600,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Alita (8 steps, ₡5,600,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 | ₡2,800,000 |
|  | Vibro Mace (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 | ₡2,800,000 |

Storage (estimate; the engine counts at run time): 2 final weapons equipped at the robots target of 1. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5).

Source findings before decisions: A01 ×1, V13 ×2, V18 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 166. Kaylon Assembly Array (`kaylon-assembly-array`) — Swarm

| Field | Value |
|---|---|
| Stable name | Kaylon Assembly Array |
| Franchise label | The Orville |
| Backstory | A methodical assembly line expands from three machines to a full eleven-slot roster. Precision, protection and direct pressure distribute the equipment bill across the array. |
| Strategy | Swarm |
| Target overrides | none (goal 10 Robots → 11, the strategy default) |
| Team names | 2v2: **First Contact Envoy** (robots 1+2), **Kaylon Sphere Patrol** (3+4), **Planetary Union Breach** (5+6), **Glowing Eyes** (7+8), **Orville Boarding Party** (9+10) · 3v3: **Kaylon Uprising** (1–3), **Sphere Armada** (4–6), **Identity Crisis** (7–9) |
| Event order | `league_3v3`, `league_2v2`, `tag_team`, `league_1v1`, `koth`, `grand_melee`, `tournament_3v3`, `tournament_2v2`, `tournament_1v1` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- Franchise label: 'The Orville — television continuity' → 'The Orville' (decisions 14, 16, 18; delegated authoring)
- 2v2 team 1+2: 'Kaylon Array Pair 01' → 'First Contact Envoy' (decisions 14, 16, 18; delegated authoring)
- 2v2 team 3+4: 'Kaylon Array Pair 02' → 'Kaylon Sphere Patrol' (decisions 14, 16, 18; delegated authoring)
- 2v2 team 5+6: 'Kaylon Array Pair 03' → 'Planetary Union Breach' (decisions 14, 16, 18; delegated authoring)
- 2v2 team 7+8: 'Kaylon Array Pair 04' → 'Glowing Eyes' (decisions 14, 16, 18; delegated authoring)
- 2v2 team 9+10: 'Kaylon Array Pair 05' → 'Orville Boarding Party' (decisions 14, 16, 18; delegated authoring)
- 3v3 team 1+2+3: 'Kaylon Array Squad 01' → 'Kaylon Uprising' (decisions 14, 16, 18; delegated authoring)
- 3v3 team 4+5+6: 'Kaylon Array Squad 02' → 'Sphere Armada' (decisions 14, 16, 18; delegated authoring)
- 3v3 team 7+8+9: 'Kaylon Array Squad 03' → 'Identity Crisis' (decisions 14, 16, 18; delegated authoring)
- Slot 3 art brief: 'One standard Kaylon humanoid from The Orville TV series, smooth silver metallic head and body, authentic simple Kaylon facial geometry with two RED illuminated eye optics, dark joint gaps, no repaint.' → 'Scuffed silver Kaylon, weight on one leg, arms loose with fingers curled, two red eye optics' (decisions 14, 16, 18; delegated authoring)
- Slot 3 'Kaylon Unit 03': numbered name accepted as a mass-produced designation (decisions 14, 16, 18; delegated authoring)
- Slot 3 portrait: aligned (decisions 14, 16, 18; delegated authoring)
- Slot 4 art brief: 'One standard Kaylon humanoid from The Orville TV series, smooth silver metallic head and body, authentic simple Kaylon facial geometry with two RED illuminated eye optics, dark joint gaps, no repaint.' → 'Silver Kaylon in a wide stance, glowing red eyes, ribbed black waist, hands hanging open' (decisions 14, 16, 18; delegated authoring)
- Slot 4 'Kaylon Unit 04': numbered name accepted as a mass-produced designation (decisions 14, 16, 18; delegated authoring)
- Slot 4 portrait: aligned (decisions 14, 16, 18; delegated authoring)
- Slot 5 art brief: 'One standard Kaylon humanoid from The Orville TV series, smooth silver metallic head and body, authentic simple Kaylon facial geometry with two RED illuminated eye optics, dark joint gaps, no repaint.' → 'Broad-shouldered silver Kaylon standing square to the viewer, seamed chest, open hands, red eyes' (decisions 14, 16, 18; delegated authoring)
- Slot 5 'Kaylon Unit 05': numbered name accepted as a mass-produced designation (decisions 14, 16, 18; delegated authoring)
- Slot 5 portrait: aligned (decisions 14, 16, 18; delegated authoring)
- Slot 6 art brief: 'One standard Kaylon humanoid from The Orville TV series, smooth silver metallic head and body, authentic simple Kaylon facial geometry with two RED illuminated eye optics, dark joint gaps, no repaint.' → 'Silver Kaylon in three-quarter turn, head angled toward the viewer, one foot set forward' (decisions 14, 16, 18; delegated authoring)
- Slot 6 'Kaylon Unit 06': numbered name accepted as a mass-produced designation (decisions 14, 16, 18; delegated authoring)
- Slot 6 portrait: aligned (decisions 14, 16, 18; delegated authoring)
- Slot 7 art brief: 'One standard Kaylon humanoid from The Orville TV series, smooth silver metallic head and body, authentic simple Kaylon facial geometry with two RED illuminated eye optics, dark joint gaps, no repaint.' → 'Scratched silver Kaylon with hunched shoulders, legs apart, hands hanging open, red eyes' (decisions 14, 16, 18; delegated authoring)
- Slot 7 'Kaylon Unit 07': numbered name accepted as a mass-produced designation (decisions 14, 16, 18; delegated authoring)
- Slot 7 portrait: aligned (decisions 14, 16, 18; delegated authoring)
- Slot 8 art brief: 'One standard Kaylon humanoid from The Orville TV series, smooth silver metallic head and body, authentic simple Kaylon facial geometry with two RED illuminated eye optics, dark joint gaps, no repaint.' → 'Silver Kaylon raising its right fist to chest height, left hand open by its hip, red eyes' (decisions 14, 16, 18; delegated authoring)
- Slot 8 'Kaylon Unit 08': numbered name accepted as a mass-produced designation (decisions 14, 16, 18; delegated authoring)
- Slot 8 portrait: aligned (decisions 14, 16, 18; delegated authoring)
- Slot 9 art brief: 'One standard Kaylon humanoid from The Orville TV series, smooth silver metallic head and body, authentic simple Kaylon facial geometry with two RED illuminated eye optics, dark joint gaps, no repaint.' → 'Polished chrome Kaylon standing tall and upright, lit from above, arms straight at its sides' (decisions 14, 16, 18; delegated authoring)
- Slot 9 'Kaylon Unit 09': numbered name accepted as a mass-produced designation (decisions 14, 16, 18; delegated authoring)
- Slot 9 portrait: aligned (decisions 14, 16, 18; delegated authoring)
- Slot 10 art brief: 'One standard Kaylon humanoid from The Orville TV series, smooth silver metallic head and body, authentic simple Kaylon facial geometry with two RED illuminated eye optics, dark joint gaps, no repaint.' → 'Silver Kaylon mid-stride walking toward the viewer, left foot forward, arms swinging' (decisions 14, 16, 18; delegated authoring)
- Slot 10 'Kaylon Unit 10': numbered name accepted as a mass-produced designation (decisions 14, 16, 18; delegated authoring)
- Slot 10 portrait: aligned (decisions 14, 16, 18; delegated authoring)
- Slot 11 art brief: 'One standard Kaylon humanoid from The Orville TV series, smooth silver metallic head and body, authentic simple Kaylon facial geometry with two RED illuminated eye optics, dark joint gaps, no repaint.' → 'Battered silver Kaylon in a crouched ready stance, fists half clenched, shoulders squared' (decisions 14, 16, 18; delegated authoring)
- Slot 11 'Kaylon Unit 11': numbered name accepted as a mass-produced designation (decisions 14, 16, 18; delegated authoring)
- Slot 11 portrait: aligned (decisions 14, 16, 18; delegated authoring)

Every blueprint is used at the robots target of 11; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Isaac | `single` | mid | balanced | 15 | Tactician | Isaac from The Orville television series, smooth silver Kaylon humanoid with two blue illuminated eye optics, authentic simple metallic facial geometry, segmented silver body and dark joint gaps. | `kaylon-assembly-array/1.webp` |
| 2 | Kaylon Primary | `weapon_shield` | mid | defensive | 25 | Tactician | Kaylon Primary from The Orville, smooth silver humanoid Kaylon body with authentic red illuminated optics, canonical simple head/torso panels and dark articulated joints. | `kaylon-assembly-array/2.webp` |
| 3 | Kaylon Unit 03 | `single` | short | balanced | 15 | Versatile | Scuffed silver Kaylon, weight on one leg, arms loose with fingers curled, two red eye optics | `kaylon-assembly-array/3.webp` |
| 4 | Kaylon Unit 04 | `single` | long | balanced | 20 | Deadeye | Silver Kaylon in a wide stance, glowing red eyes, ribbed black waist, hands hanging open | `kaylon-assembly-array/4.webp` |
| 5 | Kaylon Unit 05 | `weapon_shield` | short | defensive | 25 | Warden | Broad-shouldered silver Kaylon standing square to the viewer, seamed chest, open hands, red eyes | `kaylon-assembly-array/5.webp` |
| 6 | Kaylon Unit 06 | `two_handed` | mid | offensive | 10 | Bruiser | Silver Kaylon in three-quarter turn, head angled toward the viewer, one foot set forward | `kaylon-assembly-array/6.webp` |
| 7 | Kaylon Unit 07 | `two_handed` | short | offensive | 10 | Bruiser | Scratched silver Kaylon with hunched shoulders, legs apart, hands hanging open, red eyes | `kaylon-assembly-array/7.webp` |
| 8 | Kaylon Unit 08 | `dual_wield` | short | offensive | 10 | Sprinter | Silver Kaylon raising its right fist to chest height, left hand open by its hip, red eyes | `kaylon-assembly-array/8.webp` |
| 9 | Kaylon Unit 09 | `weapon_shield` | long | defensive | 20 | Warden | Polished chrome Kaylon standing tall and upright, lit from above, arms straight at its sides | `kaylon-assembly-array/9.webp` |
| 10 | Kaylon Unit 10 | `two_handed` | long | balanced | 15 | Deadeye | Silver Kaylon mid-stride walking toward the viewer, left foot forward, arms swinging | `kaylon-assembly-array/10.webp` |
| 11 | Kaylon Unit 11 | `single` | short | offensive | 10 | Bruiser | Battered silver Kaylon in a crouched ready stance, fists half clenched, shoulders squared | `kaylon-assembly-array/11.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Isaac | Bolt Carbine (₡93,000) | Nova Caster (₡425,000) |
| 2 Kaylon Primary | Bolt Carbine + Light Shield (₡144,000) | Nova Caster + Aegis Bulwark (₡834,000) |
| 3 Kaylon Unit 03 | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |
| 4 Kaylon Unit 04 | Beam Pistol (₡93,000) | Particle Lance (₡425,000) |
| 5 Kaylon Unit 05 | Laser Pistol + Light Shield (₡108,000) | Volt Sabre + Aegis Bulwark (₡834,000) |
| 6 Kaylon Unit 06 | Training Rifle (₡50,000) | Plasma Cannon (₡408,000) |
| 7 Kaylon Unit 07 | Scatter Cannon (₡84,000) | Arc Projector (₡488,000) |
| 8 Kaylon Unit 08 | Laser Pistol ×2 (₡114,000) | Volt Sabre ×2 (₡850,000) |
| 9 Kaylon Unit 09 | Beam Pistol + Light Shield (₡144,000) | Particle Lance + Aegis Bulwark (₡834,000) |
| 10 Kaylon Unit 10 | Training Beam (₡50,000) | Ion Beam (₡544,000) |
| 11 Kaylon Unit 11 | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |

**Refinement plans** (generated; applied by Swarm goal 23, Refine → 8 steps per robot). All 11 robots: 75 steps, ₡35,110,000; the 11 robots at the target: ₡35,110,000; Refine → 8 applies ₡34,730,000 of the target robots' plans.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Isaac (5 steps, ₡2,820,000) | Nova Caster (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Combat Algorithms +1 (new) ₡20,000 | ₡2,820,000 |
| Kaylon Primary (10 steps, ₡2,870,000) | Nova Caster (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Combat Algorithms +1 (new) ₡20,000 | ₡2,820,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |
| Kaylon Unit 03 (5 steps, ₡2,960,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| Kaylon Unit 04 (5 steps, ₡2,960,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +4 (5 → 9) ₡160,000 | ₡2,960,000 |
| Kaylon Unit 05 (10 steps, ₡2,870,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Armor Plating +1 (new) ₡20,000 | ₡2,820,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |
| Kaylon Unit 06 (5 steps, ₡2,960,000) | Plasma Cannon (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Critical Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| Kaylon Unit 07 (5 steps, ₡2,960,000) | Arc Projector (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| Kaylon Unit 08 (10 steps, ₡5,920,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 · 9 Hone Power Core +4 (−3 → 1) ₡160,000 | ₡2,960,000 |
|  | Volt Sabre (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 · 10 Hone Power Core +4 (−3 → 1) ₡160,000 | ₡2,960,000 |
| Kaylon Unit 09 (10 steps, ₡2,870,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Armor Plating +1 (new) ₡20,000 | ₡2,820,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |
| Kaylon Unit 10 (5 steps, ₡2,960,000) | Ion Beam (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (4 → 8) ₡160,000 | ₡2,960,000 |
| Kaylon Unit 11 (5 steps, ₡2,960,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |

Storage (estimate; the engine counts at run time): 15 final weapons equipped at the robots target of 11. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need Storage Facility L2; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Source findings before decisions: A03 ×2, A13 ×9, V13 ×11, V18 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 167. Kepler Android Caretakers (`kepler-android-caretakers`) — Duo

| Field | Value |
|---|---|
| Stable name | Kepler Android Caretakers |
| Franchise label | Raised by Wolves |
| Backstory | Two caretaker androids divide protection and measured ranged work. Their workshop keeps a balanced partner budget and treats exceptional source abilities as narrative context. |
| Strategy | Duo |
| Target overrides | none (goal 13 Robots → 2, the strategy default) |
| Team names | 2v2: **Kepler-22b Colonists** (robots 1+2) · 3v3: none |
| Event order | `league_2v2`, `tag_team`, `tournament_2v2`, `league_1v1`, `koth`, `grand_melee`, `tournament_1v1`, `league_3v3`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- Franchise label: 'Raised by Wolves — television series' → 'Raised by Wolves' (decisions 14, 16; delegated authoring)
- 2v2 team 1+2: 'Kepler Pair Pair 01' → 'Kepler-22b Colonists' (decisions 14, 16; delegated authoring)

Every blueprint is used at the robots target of 2; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Mother RW | `weapon_shield` | short | defensive | 25 | Warden | Mother from Raised by Wolves season 1 in her ORDINARY caretaker appearance: authentic adult human-looking face portrayed by Amanda Collin, very short reddish-blond pixie hair, source pale grey… | `kepler-android-caretakers/1.webp` |
| 2 | Father | `single` | mid | balanced | 15 | Tactician | Father from Raised by Wolves season 1, authentic adult human-looking Black male android portrayed by Abubakar Salim, shaved head, source pale grey fitted colony jumpsuit and practical boots, warm… | `kepler-android-caretakers/2.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Mother RW | Laser Pistol + Light Shield (₡108,000) | Volt Sabre + Aegis Bulwark (₡834,000) |
| 2 Father | Bolt Carbine (₡93,000) | Nova Caster (₡425,000) |

**Refinement plans** (generated; applied by Duo goal 17, Refine → 10 steps per robot). All 2 robots: 15 steps, ₡5,670,000; the 2 robots at the target: ₡5,670,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Mother RW (10 steps, ₡2,860,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (8 → 9) ₡10,000 | ₡2,810,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |
| Father (5 steps, ₡2,810,000) | Nova Caster (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (8 → 9) ₡10,000 | ₡2,810,000 |

Storage (estimate; the engine counts at run time): 3 final weapons equipped at the robots target of 2. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5), A09 ×1 (decision 8, 17).

Source findings before decisions: A01 ×1, A03 ×1, A09 ×1, V13 ×2, V18 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 168. Trantor Imperial Robotics (`trantor-imperial-robotics`) — Paragon

| Field | Value |
|---|---|
| Stable name | Trantor Imperial Robotics |
| Franchise label | Foundation |
| Backstory | The imperial workshop backs one patient synthetic with precision equipment. A composed champion receives staged improvements and waits for the proper refinement gates. |
| Strategy | Paragon |
| Target overrides | none (goal 8 Robots → 1, the strategy default) |
| Team names | 2v2: none · 3v3: none |
| Event order | `league_1v1`, `tournament_1v1`, `koth`, `grand_melee`, `league_2v2`, `tag_team`, `tournament_2v2`, `league_3v3`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- Franchise label: 'Foundation — Apple television adaptation' → 'Foundation' (decision 16; delegated authoring)

Every blueprint is used at the robots target of 1; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Demerzel | `single` | long | balanced | 20 | Deadeye | Demerzel from Apple Foundation season 1, recognizable adult human-looking female android portrayed by Laura Birn, composed face, source imperial braided hairstyle and ornate pale cream/grey court… | `trantor-imperial-robotics/1.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Demerzel | Beam Pistol (₡93,000) | Particle Lance (₡425,000) |

**Refinement plans** (generated; applied by Paragon goal 16, Refine → 10 steps per robot). The only blueprint: 4 steps, ₡2,800,000; the robot at the target: ₡2,800,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Demerzel (4 steps, ₡2,800,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 | ₡2,800,000 |

Storage (estimate; the engine counts at run time): 1 final weapons equipped at the robots target of 1. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5), A09 ×1 (decision 8, 17).

Source findings before decisions: A01 ×1, A09 ×1, V13 ×1, V18 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 169. Stitchpunk Salvage Circle (`stitchpunk-salvage-circle`) — Trio

| Field | Value |
|---|---|
| Stable name | Stitchpunk Salvage Circle |
| Franchise label | 9 |
| Backstory | Three stitched constructs make salvage hardware serve flexible fire, precision and agile contact. The workshop equips the complete trio without replacing their unusual bodies. |
| Strategy | Trio |
| Target overrides | none (goal 12 Robots → 3, the strategy default) |
| Team names | 2v2: **Talisman Seekers** (robots 1+2) · 3v3: **The Stitchpunks** (1–3) |
| Event order | `league_3v3`, `tournament_3v3`, `league_2v2`, `tag_team`, `league_1v1`, `koth`, `grand_melee`, `tournament_2v2`, `tournament_1v1` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- Franchise label: '9 — 2009 feature film' → '9' (decisions 14, 16; delegated authoring)
- 2v2 team 1+2: 'Stitchpunk Pair 01' → 'Talisman Seekers' (decisions 14, 16; delegated authoring)
- 3v3 team 1+2+3: 'Stitchpunk Squad 01' → 'The Stitchpunks' (decisions 14, 16; delegated authoring)

Every blueprint is used at the robots target of 3; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Nine | `single` | short | balanced | 15 | Versatile | 9 from the 2009 film, small authentic burlap stitchpunk with worn tan stitched fabric body, big metal-rimmed circular optical eyes, distinctive zipper down front, thin articulated limbs and tiny… | `stitchpunk-salvage-circle/1.webp` |
| 2 | Five | `single` | long | balanced | 20 | Deadeye | 5 from the 2009 film, authentic small burlap stitchpunk with worn beige stitched fabric body, one intact round optical eye and one missing/damaged eye socket as the canonical design, asymmetrical… | `stitchpunk-salvage-circle/2.webp` |
| 3 | Seven | `dual_wield` | melee | offensive | 10 | Sprinter | 7 from the 2009 film, slender burlap stitchpunk warrior with source bird-skull headgear framing large metal-ringed optical eyes, authentic fabric body and thin limbs, recognizable feathered mantle… | `stitchpunk-salvage-circle/3.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Nine | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |
| 2 Five | Beam Pistol (₡93,000) | Particle Lance (₡425,000) |
| 3 Seven | Practice Sword ×2 (₡100,000) | Vibro Mace ×2 (₡850,000) |

**Refinement plans** (generated; applied by Trio goal 22, Refine → 10 steps per robot). All 3 robots: 20 steps, ₡11,240,000; the 3 robots at the target: ₡11,240,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Nine (5 steps, ₡2,810,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (8 → 9) ₡10,000 | ₡2,810,000 |
| Five (5 steps, ₡2,810,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (5 → 6) ₡10,000 | ₡2,810,000 |
| Seven (10 steps, ₡5,620,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 · 9 Hone Gyro Stabilizers +1 (4 → 5) ₡10,000 | ₡2,810,000 |
|  | Vibro Mace (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 · 10 Hone Gyro Stabilizers +1 (4 → 5) ₡10,000 | ₡2,810,000 |

Storage (estimate; the engine counts at run time): 4 final weapons equipped at the robots target of 3. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5), A09 ×1 (decision 8, 17).

Source findings before decisions: A01 ×1, A03 ×1, A09 ×1, V13 ×3, V18 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 170. City Companion Repair Shop (`city-companion-repair-shop`) — Paragon

| Field | Value |
|---|---|
| Stable name | City Companion Repair Shop |
| Franchise label | Robot Dreams |
| Backstory | A simple companion machine rebuilds its arena prospects through modest equipment and careful repairs. The shop improves one body and keeps its retreat policy conservative. |
| Strategy | Paragon |
| Target overrides | none (goal 8 Robots → 1, the strategy default) |
| Team names | 2v2: none · 3v3: none |
| Event order | `league_1v1`, `tournament_1v1`, `koth`, `grand_melee`, `league_2v2`, `tag_team`, `tournament_2v2`, `league_3v3`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- Franchise label: 'Robot Dreams — animated film' → 'Robot Dreams' (decision 16; delegated authoring)

Every blueprint is used at the robots target of 1; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | ROBOT RD | `single` | short | defensive | 30 | Tactician | ROBOT from Robot Dreams 2023, intact friendly companion with simple cream/light grey rectangular head, two large round dark-rimmed bright eyes, small straight mouth, simple narrow box torso, rounded… | `city-companion-repair-shop/1.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 ROBOT RD | Practice Blaster (₡50,000) | Volt Sabre (₡425,000) |

**Refinement plans** (generated; applied by Paragon goal 16, Refine → 10 steps per robot). The only blueprint: 4 steps, ₡2,800,000; the robot at the target: ₡2,800,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| ROBOT RD (4 steps, ₡2,800,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 | ₡2,800,000 |

Storage (estimate; the engine counts at run time): 1 final weapons equipped at the robots target of 1. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5).

Source findings before decisions: A01 ×1, V13 ×1, V18 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 171. Eden Agricultural Workshop (`eden-agricultural-workshop`) — Duo

| Field | Value |
|---|---|
| Stable name | Eden Agricultural Workshop |
| Franchise label | Eden |
| Backstory | Two agricultural machines turn practical construction into complementary arena work. A heavy contact frame and protected utility partner share equipment spending and a repair account. |
| Strategy | Duo |
| Target overrides | none (goal 13 Robots → 2, the strategy default) |
| Team names | 2v2: **Orchard Caretakers** (robots 1+2) · 3v3: none |
| Event order | `league_2v2`, `tag_team`, `tournament_2v2`, `league_1v1`, `koth`, `grand_melee`, `tournament_1v1`, `league_3v3`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- Franchise label: 'Eden — 2021 anime miniseries' → 'Eden' (decisions 14, 16; delegated authoring)
- 2v2 team 1+2: 'Eden Pair Pair 01' → 'Orchard Caretakers' (decisions 14, 16; delegated authoring)

Every blueprint is used at the robots target of 2; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | E92 | `two_handed` | melee | offensive | 10 | Bruiser | Use attached Eden official publicity still as robot identity reference, ONLY the taller teal-blue and orange E92 on the LEFT, remove all other figures and setting. | `eden-agricultural-workshop/1.webp` |
| 2 | A37 | `weapon_shield` | mid | defensive | 25 | Tactician | Use attached Eden still as robot identity reference, ONLY the yellow A37 on the RIGHT. | `eden-agricultural-workshop/2.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 E92 | Shock Maul (₡183,000) | Heavy Hammer (₡478,000) |
| 2 A37 | Bolt Carbine + Light Shield (₡144,000) | Nova Caster + Aegis Bulwark (₡834,000) |

**Refinement plans** (generated; applied by Duo goal 17, Refine → 10 steps per robot). All 2 robots: 15 steps, ₡5,670,000; the 2 robots at the target: ₡5,670,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| E92 (5 steps, ₡2,810,000) | Heavy Hammer (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (7 → 8) ₡10,000 | ₡2,810,000 |
| A37 (10 steps, ₡2,860,000) | Nova Caster (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (8 → 9) ₡10,000 | ₡2,810,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |

Storage (estimate; the engine counts at run time): 3 final weapons equipped at the robots target of 2. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5), A09 ×1 (decision 8, 17).

Source findings before decisions: A01 ×1, A03 ×1, A07 ×1, A09 ×1, V13 ×2, V18 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 172. Seven Great Robots Workshop (`seven-great-robots-workshop`) — Trio

| Field | Value |
|---|---|
| Stable name | Seven Great Robots Workshop |
| Franchise label | PLUTO |
| Backstory | A detective, two arena veterans, and three very different guardians enter a new competition. Six individuals share a workshop, but every body, temperament, and assignment remains distinct. |
| Strategy | Trio |
| Target overrides | goal 12 Robots → 6 (strategy default 3, allowed 3–6) |
| Team names | 2v2: **Detective and Champion** (robots 1+2), **Mountain Guard** (3+4), **Sun and Steel** (5+6) · 3v3: **Europol Vanguard** (1–3), **Quiet Guardians** (4–6) |
| Event order | `league_3v3`, `league_2v2`, `tag_team`, `tournament_3v3`, `tournament_2v2`, `league_1v1`, `koth`, `grand_melee`, `tournament_1v1` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- Strategy: Squadron → Trio (decisions 12, 16; delegated authoring)
- Franchise label: 'PLUTO - 2023 anime adaptation' → 'PLUTO' (decisions 12, 16; delegated authoring)

Every blueprint is used at the robots target of 6; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Gesicht | `single` | mid | balanced | 20 | Tactician | Anime Gesicht with his human-looking face, short hair, and detective clothing. One mid-range arena weapon; preserve the android's authentic appearance. | `seven-great-robots-workshop/1.webp` |
| 2 | Brando | `two_handed` | melee | offensive | 10 | Bruiser | Use Brando's dark Pankration combat body rather than his everyday body. Preserve its source mass and mechanical head construction; one two-handed arena melee weapon. | `seven-great-robots-workshop/2.webp` |
| 3 | Hercules | `weapon_shield` | short | defensive | 15 | Warden | Use Hercules's gold Pankration combat body and helmet head. One short-range arena weapon and one shield allocation; retain his distinction from Brando. | `seven-great-robots-workshop/3.webp` |
| 4 | Montblanc | `two_handed` | mid | balanced | 20 | Bruiser | Preserve Montblanc's large pale cream-metal industrial body, blue overalls, and recognizable head. One heavy mid-range arena weapon; keep the full machine readable. | `seven-great-robots-workshop/4.webp` |
| 5 | North No.2 | `two_handed` | long | balanced | 20 | Deadeye | Use North #2's anime six-armed, legless hovering mechanical body and hooded cloak. One long-range two-handed weapon allocation; remaining arms are passive and create no extra equipment slots. | `seven-great-robots-workshop/5.webp` |
| 6 | Epsilon | `weapon_shield` | short | defensive | 40 | Tactician | Preserve Epsilon's human-looking face, long platinum-blond/silver hair, and black anime clothing. | `seven-great-robots-workshop/6.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Gesicht | Bolt Carbine (₡93,000) | Nova Caster (₡425,000) |
| 2 Brando | War Club (₡84,000) | Heavy Hammer (₡478,000) |
| 3 Hercules | Laser Pistol + Light Shield (₡108,000) | Volt Sabre + Aegis Bulwark (₡834,000) |
| 4 Montblanc | Training Rifle (₡50,000) | Plasma Cannon (₡408,000) |
| 5 North No.2 | Training Beam (₡50,000) | Ion Beam (₡544,000) |
| 6 Epsilon | Laser Pistol + Light Shield (₡108,000) | Volt Sabre + Aegis Bulwark (₡834,000) |

**Refinement plans** (generated; applied by Trio goal 22, Refine → 10 steps per robot). All 6 robots: 40 steps, ₡17,230,000; the 6 robots at the target: ₡17,230,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Gesicht (5 steps, ₡2,820,000) | Nova Caster (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Combat Algorithms +1 (new) ₡20,000 | ₡2,820,000 |
| Brando (5 steps, ₡2,890,000) | Heavy Hammer (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +3 (7 → 10) ₡90,000 | ₡2,890,000 |
| Hercules (10 steps, ₡2,870,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Armor Plating +1 (new) ₡20,000 | ₡2,820,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |
| Montblanc (5 steps, ₡2,890,000) | Plasma Cannon (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +3 (7 → 10) ₡90,000 | ₡2,890,000 |
| North No.2 (5 steps, ₡2,890,000) | Ion Beam (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +3 (4 → 7) ₡90,000 | ₡2,890,000 |
| Epsilon (10 steps, ₡2,870,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Combat Algorithms +1 (new) ₡20,000 | ₡2,820,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |

Storage (estimate; the engine counts at run time): 8 final weapons equipped at the robots target of 6. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need Storage Facility L1; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A09 ×1 (decision 8, 17).

Source findings before decisions: A09 ×1, V06 ×1, V18 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 173. NiaLand AI Partnership (`nialand-ai-partnership`) — Duo

| Field | Value |
|---|---|
| Stable name | NiaLand AI Partnership |
| Franchise label | Vivy: Fluorite Eye's Song |
| Backstory | A mobile performance android and a compact precise AI body share the partnership's equipment budget. Different vessels remain alternate depictions rather than extra simultaneous fighters. |
| Strategy | Duo |
| Target overrides | none (goal 13 Robots → 2, the strategy default) |
| Team names | 2v2: **Singularity Project** (robots 1+2) · 3v3: none |
| Event order | `league_2v2`, `tag_team`, `tournament_2v2`, `league_1v1`, `koth`, `grand_melee`, `tournament_1v1`, `league_3v3`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- Franchise label: "Vivy: Fluorite Eye's Song — 2021 anime" → "Vivy: Fluorite Eye's Song" (decisions 14, 16; delegated authoring)
- 2v2 team 1+2: 'NiaLand Pair Pair 01' → 'Singularity Project' (decisions 14, 16; delegated authoring)

Every blueprint is used at the robots target of 2; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Vivy | `single` | short | balanced | 20 | Sprinter | Vivy from Vivy: Fluorite Eye's Song 2021 anime, authentic human-looking female android with long straight blue hair, blue eyes and source initial NiaLand stage outfit: white sleeveless performance… | `nialand-ai-partnership/1.webp` |
| 2 | Matsumoto | `single` | long | balanced | 20 | Deadeye | Matsumoto from Vivy: Fluorite Eye's Song 2021, ONE small blue cube AI body with canonical bevels and simple luminous face/display details, source panel divisions and compact geometry. | `nialand-ai-partnership/2.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Vivy | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |
| 2 Matsumoto | Beam Pistol (₡93,000) | Particle Lance (₡425,000) |

**Refinement plans** (generated; applied by Duo goal 17, Refine → 10 steps per robot). All 2 robots: 10 steps, ₡5,620,000; the 2 robots at the target: ₡5,620,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Vivy (5 steps, ₡2,810,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Power Core +1 (−3 → −2) ₡10,000 | ₡2,810,000 |
| Matsumoto (5 steps, ₡2,810,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (5 → 6) ₡10,000 | ₡2,810,000 |

Storage (estimate; the engine counts at run time): 2 final weapons equipped at the robots target of 2. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5), A09 ×1 (decision 8, 17).

Source findings before decisions: A01 ×1, A03 ×1, A09 ×1, V13 ×2, V18 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 174. Legion Autonomous Arsenal (`legion-autonomous-arsenal`) — Swarm

| Field | Value |
|---|---|
| Stable name | Legion Autonomous Arsenal |
| Franchise label | 86 Eighty-Six |
| Backstory | Scouts open the account, contact machines close the gap and heavy platforms complete the autonomous column. The arsenal recruits its full roster before considering luxury improvements. |
| Strategy | Swarm |
| Target overrides | none (goal 10 Robots → 11, the strategy default) |
| Team names | 2v2: **Eastern Front Raid** (robots 1+2), **Spearhead Squadron** (3+4), **No Face Directive** (5+6), **Morpho Battery** (7+8), **Republic Border Raid** (9+10) · 3v3: **Legion Advance Guard** (1–3), **Black Sheep Herd** (4–6), **Eighty-Sixth Sector Siege** (7–9) |
| Event order | `league_3v3`, `league_2v2`, `tag_team`, `league_1v1`, `koth`, `grand_melee`, `tournament_3v3`, `tournament_2v2`, `tournament_1v1` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- Franchise label: '86—Eighty-Six — anime adaptation' → '86 Eighty-Six' (decisions 13, 14, 16, 18; delegated authoring)
- 2v2 team 1+2: 'Legion Arsenal Pair 01' → 'Eastern Front Raid' (decisions 13, 14, 16, 18; delegated authoring)
- 2v2 team 3+4: 'Legion Arsenal Pair 02' → 'Spearhead Squadron' (decisions 13, 14, 16, 18; delegated authoring)
- 2v2 team 5+6: 'Legion Arsenal Pair 03' → 'No Face Directive' (decisions 13, 14, 16, 18; delegated authoring)
- 2v2 team 7+8: 'Legion Arsenal Pair 04' → 'Morpho Battery' (decisions 13, 14, 16, 18; delegated authoring)
- 2v2 team 9+10: 'Legion Arsenal Pair 05' → 'Republic Border Raid' (decisions 13, 14, 16, 18; delegated authoring)
- 3v3 team 1+2+3: 'Legion Arsenal Squad 01' → 'Legion Advance Guard' (decisions 13, 14, 16, 18; delegated authoring)
- 3v3 team 4+5+6: 'Legion Arsenal Squad 02' → 'Black Sheep Herd' (decisions 13, 14, 16, 18; delegated authoring)
- 3v3 team 7+8+9: 'Legion Arsenal Squad 03' → 'Eighty-Sixth Sector Siege' (decisions 13, 14, 16, 18; delegated authoring)
- Slot 1 art brief: 'ONE Ameise Legion autonomous machine from the 86—Eighty-Six anime.' → 'Blue-chrome six-legged Ameise scout, tall sawtooth fin crest, twin forward gun pods, lit from the left' (decisions 13, 14, 16, 18; delegated authoring)
- Slot 1 'Ameise 01': numbered name accepted as a mass-produced designation (decisions 13, 14, 16, 18; delegated authoring)
- Slot 1 portrait: aligned (decisions 13, 14, 16, 18; delegated authoring)
- Slot 2 art brief: 'ONE Ameise Legion autonomous machine from the 86—Eighty-Six anime.' → 'Bright chrome Ameise scout seen a little more side-on, spined crest fin, legs splayed on wet floor' (decisions 13, 14, 16, 18; delegated authoring)
- Slot 2 'Ameise 02': numbered name accepted as a mass-produced designation (decisions 13, 14, 16, 18; delegated authoring)
- Slot 2 portrait: aligned (decisions 13, 14, 16, 18; delegated authoring)
- Slot 3 art brief: 'ONE Ameise Legion autonomous machine from the 86—Eighty-Six anime.' → 'Deep blue-tinted Ameise scout against a darker backdrop, crest fin high, gun pods aimed left' (decisions 13, 14, 16, 18; delegated authoring)
- Slot 3 'Ameise 03': numbered name accepted as a mass-produced designation (decisions 13, 14, 16, 18; delegated authoring)
- Slot 3 portrait: aligned (decisions 13, 14, 16, 18; delegated authoring)
- Slot 4 art brief: 'ONE Grauwolf Legion autonomous machine from the 86—Eighty-Six anime.' → 'Silver Grauwolf with a box rocket launcher on its back, blade foreleg raised, AA flank markings' (decisions 13, 14, 16, 18; delegated authoring)
- Slot 4 'Grauwolf 01': numbered name accepted as a mass-produced designation (decisions 13, 14, 16, 18; delegated authoring)
- Slot 4 portrait: aligned (decisions 13, 14, 16, 18; delegated authoring)
- Slot 5 art brief: 'ONE Grauwolf Legion autonomous machine from the 86—Eighty-Six anime.' → 'Silver Grauwolf lit from the upper right, back launcher level, blade foreleg pushed forward' (decisions 13, 14, 16, 18; delegated authoring)
- Slot 5 'Grauwolf 02': numbered name accepted as a mass-produced designation (decisions 13, 14, 16, 18; delegated authoring)
- Slot 5 portrait: aligned (decisions 13, 14, 16, 18; delegated authoring)
- Slot 6 art brief: 'ONE Grauwolf Legion autonomous machine from the 86—Eighty-Six anime.' → 'Matte silver Grauwolf with legs planted wide, launcher box held level, blade foreleg raised high' (decisions 13, 14, 16, 18; delegated authoring)
- Slot 6 'Grauwolf 03': numbered name accepted as a mass-produced designation (decisions 13, 14, 16, 18; delegated authoring)
- Slot 6 portrait: aligned (decisions 13, 14, 16, 18; delegated authoring)
- Slot 7 robot name: 'Löwe 01' → 'Loewe 01' (decisions 13, 14, 16, 18; delegated authoring)
- Slot 7 art brief: 'ONE Löwe Legion autonomous machine from the 86—Eighty-Six anime.' → 'Silver six-legged Loewe tank, long main cannon aimed left, radiator spine fan on its back' (decisions 13, 14, 16, 18; delegated authoring)
- Slot 7 'Loewe 01': numbered name accepted as a mass-produced designation (decisions 13, 14, 16, 18; delegated authoring)
- Slot 7 portrait: aligned (decisions 13, 14, 16, 18; delegated authoring)
- Slot 8 robot name: 'Löwe 02' → 'Loewe 02' (decisions 13, 14, 16, 18; delegated authoring)
- Slot 8 art brief: 'ONE Löwe Legion autonomous machine from the 86—Eighty-Six anime.' → 'Loewe tank in brighter chrome, long cannon angled low, angular sensor turret and spine fan' (decisions 13, 14, 16, 18; delegated authoring)
- Slot 8 'Loewe 02': numbered name accepted as a mass-produced designation (decisions 13, 14, 16, 18; delegated authoring)
- Slot 8 portrait: aligned (decisions 13, 14, 16, 18; delegated authoring)
- Slot 9 robot name: 'Löwe 03' → 'Loewe 03' (decisions 13, 14, 16, 18; delegated authoring)
- Slot 9 art brief: 'ONE Löwe Legion autonomous machine from the 86—Eighty-Six anime.' → 'Darker-lit Loewe tank on wet floor, cannon held level to the left, legs bent in a firm stance' (decisions 13, 14, 16, 18; delegated authoring)
- Slot 9 'Loewe 03': numbered name accepted as a mass-produced designation (decisions 13, 14, 16, 18; delegated authoring)
- Slot 9 portrait: aligned (decisions 13, 14, 16, 18; delegated authoring)
- Slot 10 art brief: 'ONE Dinosauria Legion autonomous machine from the 86—Eighty-Six anime.' → 'Huge silver Dinosauria tank, very long main gun, horn spikes on its hull and a spined crest' (decisions 13, 14, 16, 18; delegated authoring)
- Slot 10 'Dinosauria 01': numbered name accepted as a mass-produced designation (decisions 13, 14, 16, 18; delegated authoring)
- Slot 10 portrait: aligned (decisions 13, 14, 16, 18; delegated authoring)
- Slot 11 art brief: 'ONE Dinosauria Legion autonomous machine from the 86—Eighty-Six anime.' → 'Dinosauria tank seen lower and closer, long gun aimed left, tall horn spikes and clawed feet' (decisions 13, 14, 16, 18; delegated authoring)
- Slot 11 'Dinosauria 02': numbered name accepted as a mass-produced designation (decisions 13, 14, 16, 18; delegated authoring)
- Slot 11 portrait: aligned (decisions 13, 14, 16, 18; delegated authoring)

Every blueprint is used at the robots target of 11; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Ameise 01 | `single` | short | balanced | 15 | Versatile | Blue-chrome six-legged Ameise scout, tall sawtooth fin crest, twin forward gun pods, lit from the left | `legion-autonomous-arsenal/1.webp` |
| 2 | Ameise 02 | `single` | short | balanced | 20 | Sprinter | Bright chrome Ameise scout seen a little more side-on, spined crest fin, legs splayed on wet floor | `legion-autonomous-arsenal/2.webp` |
| 3 | Ameise 03 | `single` | long | balanced | 20 | Deadeye | Deep blue-tinted Ameise scout against a darker backdrop, crest fin high, gun pods aimed left | `legion-autonomous-arsenal/3.webp` |
| 4 | Grauwolf 01 | `dual_wield` | melee | offensive | 10 | Sprinter | Silver Grauwolf with a box rocket launcher on its back, blade foreleg raised, AA flank markings | `legion-autonomous-arsenal/4.webp` |
| 5 | Grauwolf 02 | `single` | melee | offensive | 10 | Sprinter | Silver Grauwolf lit from the upper right, back launcher level, blade foreleg pushed forward | `legion-autonomous-arsenal/5.webp` |
| 6 | Grauwolf 03 | `two_handed` | melee | offensive | 10 | Bruiser | Matte silver Grauwolf with legs planted wide, launcher box held level, blade foreleg raised high | `legion-autonomous-arsenal/6.webp` |
| 7 | Loewe 01 | `two_handed` | mid | offensive | 10 | Bruiser | Silver six-legged Loewe tank, long main cannon aimed left, radiator spine fan on its back | `legion-autonomous-arsenal/7.webp` |
| 8 | Loewe 02 | `weapon_shield` | short | defensive | 25 | Warden | Loewe tank in brighter chrome, long cannon angled low, angular sensor turret and spine fan | `legion-autonomous-arsenal/8.webp` |
| 9 | Loewe 03 | `two_handed` | long | balanced | 15 | Deadeye | Darker-lit Loewe tank on wet floor, cannon held level to the left, legs bent in a firm stance | `legion-autonomous-arsenal/9.webp` |
| 10 | Dinosauria 01 | `two_handed` | mid | offensive | 10 | Bruiser | Huge silver Dinosauria tank, very long main gun, horn spikes on its hull and a spined crest | `legion-autonomous-arsenal/10.webp` |
| 11 | Dinosauria 02 | `two_handed` | long | balanced | 15 | Deadeye | Dinosauria tank seen lower and closer, long gun aimed left, tall horn spikes and clawed feet | `legion-autonomous-arsenal/11.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Ameise 01 | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |
| 2 Ameise 02 | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |
| 3 Ameise 03 | Beam Pistol (₡93,000) | Particle Lance (₡425,000) |
| 4 Grauwolf 01 | Practice Sword ×2 (₡100,000) | Vibro Mace ×2 (₡850,000) |
| 5 Grauwolf 02 | Practice Sword (₡50,000) | Vibro Mace (₡425,000) |
| 6 Grauwolf 03 | Shock Maul (₡183,000) | Heavy Hammer (₡478,000) |
| 7 Loewe 01 | Training Rifle (₡50,000) | Plasma Cannon (₡408,000) |
| 8 Loewe 02 | Laser Pistol + Light Shield (₡108,000) | Volt Sabre + Aegis Bulwark (₡834,000) |
| 9 Loewe 03 | Training Beam (₡50,000) | Ion Beam (₡544,000) |
| 10 Dinosauria 01 | Training Rifle (₡50,000) | Plasma Cannon (₡408,000) |
| 11 Dinosauria 02 | Training Beam (₡50,000) | Ion Beam (₡544,000) |

**Refinement plans** (generated; applied by Swarm goal 23, Refine → 8 steps per robot). All 11 robots: 65 steps, ₡35,430,000; the 11 robots at the target: ₡35,430,000; Refine → 8 applies ₡35,090,000 of the target robots' plans.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Ameise 01 (5 steps, ₡2,960,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| Ameise 02 (5 steps, ₡2,960,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Power Core +4 (−3 → 1) ₡160,000 | ₡2,960,000 |
| Ameise 03 (5 steps, ₡2,960,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +4 (5 → 9) ₡160,000 | ₡2,960,000 |
| Grauwolf 01 (10 steps, ₡5,920,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 · 9 Hone Gyro Stabilizers +4 (4 → 8) ₡160,000 | ₡2,960,000 |
|  | Vibro Mace (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 · 10 Hone Gyro Stabilizers +4 (4 → 8) ₡160,000 | ₡2,960,000 |
| Grauwolf 02 (5 steps, ₡2,960,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Gyro Stabilizers +4 (4 → 8) ₡160,000 | ₡2,960,000 |
| Grauwolf 03 (5 steps, ₡2,960,000) | Heavy Hammer (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Critical Systems +4 (4 → 8) ₡160,000 | ₡2,960,000 |
| Loewe 01 (5 steps, ₡2,960,000) | Plasma Cannon (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Critical Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| Loewe 02 (10 steps, ₡2,870,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Armor Plating +1 (new) ₡20,000 | ₡2,820,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |
| Loewe 03 (5 steps, ₡2,960,000) | Ion Beam (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (4 → 8) ₡160,000 | ₡2,960,000 |
| Dinosauria 01 (5 steps, ₡2,960,000) | Plasma Cannon (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Critical Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| Dinosauria 02 (5 steps, ₡2,960,000) | Ion Beam (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (4 → 8) ₡160,000 | ₡2,960,000 |

Storage (estimate; the engine counts at run time): 13 final weapons equipped at the robots target of 11. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need Storage Facility L2; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Source findings before decisions: A03 ×2, A13 ×11, V03 ×3, V13 ×11, V18 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 175. Sierpinski Replika Workshop (`sierpinski-replika-workshop`) — Paragon

| Field | Value |
|---|---|
| Stable name | Sierpinski Replika Workshop |
| Franchise label | SIGNALIS |
| Backstory | A repaired synthetic technician relies on practical close-range equipment and a guarded credit reserve. The workshop concentrates upgrades and refinement on one functioning frame. |
| Strategy | Paragon |
| Target overrides | none (goal 8 Robots → 1, the strategy default) |
| Team names | 2v2: none · 3v3: none |
| Event order | `league_1v1`, `tournament_1v1`, `koth`, `grand_melee`, `league_2v2`, `tag_team`, `tournament_2v2`, `league_3v3`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- Franchise label: 'SIGNALIS — 2022 game' → 'SIGNALIS' (decision 16; delegated authoring)

Every blueprint is used at the robots target of 1; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Elster | `single` | short | balanced | 15 | Versatile | ONE Elster, LSTR-512 Replika from SIGNALIS (2022), recognizably synthetic adult female humanoid with pale humanlike face, short straight black bob hair, source red-and-black technical… | `sierpinski-replika-workshop/1.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Elster | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |

**Refinement plans** (generated; applied by Paragon goal 16, Refine → 10 steps per robot). The only blueprint: 4 steps, ₡2,800,000; the robot at the target: ₡2,800,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Elster (4 steps, ₡2,800,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 | ₡2,800,000 |

Storage (estimate; the engine counts at run time): 1 final weapons equipped at the robots target of 1. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5), A09 ×1 (decision 8, 17).

Source findings before decisions: A01 ×1, A09 ×1, V13 ×1, V18 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 176. Erlins Eye Sleeper Workshop (`erlins-eye-sleeper-workshop`) — Paragon

| Field | Value |
|---|---|
| Stable name | Erlins Eye Sleeper Workshop |
| Franchise label | Citizen Sleeper |
| Backstory | A vulnerable synthetic worker makes cautious arena purchases to keep the workshop alive. One modest weapon path improves gradually after repairs and essential maintenance are secure. |
| Strategy | Paragon |
| Target overrides | none (goal 8 Robots → 1, the strategy default) |
| Team names | 2v2: none · 3v3: none |
| Event order | `league_1v1`, `tournament_1v1`, `koth`, `grand_melee`, `league_2v2`, `tag_team`, `tournament_2v2`, `league_3v3`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- Stable name: "Erlin's Eye Sleeper Workshop" → 'Erlins Eye Sleeper Workshop' (decisions 13, 16, 18; delegated authoring)
- Franchise label: 'Citizen Sleeper — 2022 game' → 'Citizen Sleeper' (decisions 13, 16, 18; delegated authoring)
- Slot 1 robot name: 'Sleeper — Operator' → 'Sleeper Operator' (decisions 13, 16, 18; delegated authoring)
- Slot 1 art brief: 'EDIT the FIRST attached Armoured Souls portrait of the Citizen Sleeper Operator to fix an accidental EXTRA ARM AND HAND.' → 'Grey-green android with a cranial cap, oversized black-and-teal quilted coat, pistol, prosthetic leg' (decisions 13, 16, 18; delegated authoring)
- Slot 1 portrait: aligned (decisions 13, 16, 18; delegated authoring)

Every blueprint is used at the robots target of 1; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Sleeper Operator | `single` | short | defensive | 30 | Tactician | Grey-green android with a cranial cap, oversized black-and-teal quilted coat, pistol, prosthetic leg | `erlins-eye-sleeper-workshop/1.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Sleeper Operator | Practice Blaster (₡50,000) | Volt Sabre (₡425,000) |

**Refinement plans** (generated; applied by Paragon goal 16, Refine → 10 steps per robot). The only blueprint: 4 steps, ₡2,800,000; the robot at the target: ₡2,800,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Sleeper Operator (4 steps, ₡2,800,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 | ₡2,800,000 |

Storage (estimate; the engine counts at run time): 1 final weapons equipped at the robots target of 1. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5).

Source findings before decisions: A01 ×1, A13 ×1, V02 ×1, V03 ×1, V13 ×1, V18 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 177. Skeleton Drifter Workshop (`skeleton-drifter-workshop`) — Generalist

| Field | Value |
|---|---|
| Stable name | Skeleton Drifter Workshop |
| Franchise label | Kenshi |
| Backstory | Three weathered mechanical drifters bring agile contact, protection and heavy fire to a salvage-minded workshop. Their distinct jobs guide purchases without erasing their source chassis. |
| Strategy | Generalist |
| Target overrides | goal 14 Robots → 3 (strategy default 2, allowed 2–4) |
| Team names | 2v2: **Ashlands Wanderers** (robots 1+2) · 3v3: **Black Desert City** (1–3) |
| Event order | `league_1v1`, `league_2v2`, `tag_team`, `league_3v3`, `koth`, `grand_melee`, `tournament_1v1`, `tournament_2v2`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- Franchise label: 'Kenshi — game continuity' → 'Kenshi' (decisions 14, 16; delegated authoring)
- 2v2 team 1+2: 'Skeleton Yard Pair 01' → 'Ashlands Wanderers' (decisions 14, 16; delegated authoring)
- 3v3 team 1+2+3: 'Skeleton Yard Squad 01' → 'Black Desert City' (decisions 14, 16; delegated authoring)

Every blueprint is used at the robots target of 3; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Burn | `single` | melee | offensive | 10 | Sprinter | ONE Burn, the named Skeleton recruit from Kenshi. | `skeleton-drifter-workshop/1.webp` |
| 2 | Sadneil | `weapon_shield` | short | defensive | 25 | Warden | ONE Sadneil from Kenshi, faithful to the attached in-game screenshot's standard Skeleton head and exposed mechanical body: angular broad-topped metal head with inset round sensors and a long thin… | `skeleton-drifter-workshop/2.webp` |
| 3 | Agnu | `two_handed` | mid | offensive | 10 | Bruiser | ONE Agnu, the named Soldierbot recruit from Kenshi. | `skeleton-drifter-workshop/3.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Burn | Practice Sword (₡50,000) | Vibro Mace (₡425,000) |
| 2 Sadneil | Laser Pistol + Light Shield (₡108,000) | Volt Sabre + Aegis Bulwark (₡834,000) |
| 3 Agnu | Training Rifle (₡50,000) | Plasma Cannon (₡408,000) |

**Refinement plans** (generated; applied by Generalist goal 18, Refine → 10 steps per robot). All 3 robots: 20 steps, ₡8,540,000; the 3 robots at the target: ₡8,540,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Burn (5 steps, ₡2,840,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Gyro Stabilizers +2 (4 → 6) ₡40,000 | ₡2,840,000 |
| Sadneil (10 steps, ₡2,860,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (8 → 9) ₡10,000 | ₡2,810,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |
| Agnu (5 steps, ₡2,840,000) | Plasma Cannon (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +2 (7 → 9) ₡40,000 | ₡2,840,000 |

Storage (estimate; the engine counts at run time): 4 final weapons equipped at the robots target of 3. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5).

Source findings before decisions: A01 ×1, A03 ×1, V08 ×1, V13 ×3, V18 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 178. Glitch Feudal Forge (`glitch-feudal-forge`) — Tycoon

| Field | Value |
|---|---|
| Stable name | Glitch Feudal Forge |
| Franchise label | Starbound |
| Backstory | A blade fighter, a forge worker and a protected ledger keeper earn the feudal workshop's facility budget. Commerce precedes premium equipment for the repaired three-machine roster. |
| Strategy | Tycoon |
| Target overrides | goal 20 Robots → 3 (strategy default 2, allowed 2–3) |
| Team names | 2v2: **Sarcasm Detected** (robots 1+2) · 3v3: **Glitch Castle Guard** (1–3) |
| Event order | `league_2v2`, `tag_team`, `league_1v1`, `league_3v3`, `koth`, `grand_melee`, `tournament_2v2`, `tournament_3v3`, `tournament_1v1` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- Franchise label: 'Starbound — game continuity' → 'Starbound' (decisions 14, 16; delegated authoring)
- 2v2 team 1+2: 'Glitch Forge Pair 01' → 'Sarcasm Detected' (decisions 14, 16; delegated authoring)
- 3v3 team 1+2+3: 'Glitch Forge Squad 01' → 'Glitch Castle Guard' (decisions 14, 16; delegated authoring)

Every blueprint is used at the robots target of 3; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Brassblade | `dual_wield` | melee | offensive | 10 | Sprinter | ONE Glitch robot knight from Starbound, directly matching the attached original Chucklefish Glitch character artwork: lavender/silver fully mechanical medieval helmet face with a narrow cyan optical… | `glitch-feudal-forge/1.webp` |
| 2 | Forgehand | `two_handed` | melee | offensive | 10 | Bruiser | ONE Glitch robot from Starbound, using the main player-character sprite in the attached creator screenshot as the source body and clothing: compact humanoid robot with a pale rounded metal… | `glitch-feudal-forge/2.webp` |
| 3 | Goldledger | `weapon_shield` | mid | defensive | 25 | Tactician | ONE Glitch robot from Starbound using the purple-hatted NPC on the lower-left roof in the attached developer screenshot: compact medieval humanoid robot with a boxlike mechanical face and small… | `glitch-feudal-forge/3.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Brassblade | Practice Sword ×2 (₡100,000) | Vibro Mace ×2 (₡850,000) |
| 2 Forgehand | Shock Maul (₡183,000) | Heavy Hammer (₡478,000) |
| 3 Goldledger | Bolt Carbine + Light Shield (₡144,000) | Nova Caster + Aegis Bulwark (₡834,000) |

**Refinement plans** (generated; applied by Tycoon goal 25, Refine → 10 steps per robot). All 3 robots: 25 steps, ₡11,390,000; the 3 robots at the target: ₡11,390,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Brassblade (10 steps, ₡5,680,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 · 9 Hone Gyro Stabilizers +2 (4 → 6) ₡40,000 | ₡2,840,000 |
|  | Vibro Mace (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 · 10 Hone Gyro Stabilizers +2 (4 → 6) ₡40,000 | ₡2,840,000 |
| Forgehand (5 steps, ₡2,840,000) | Heavy Hammer (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +2 (7 → 9) ₡40,000 | ₡2,840,000 |
| Goldledger (10 steps, ₡2,870,000) | Nova Caster (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Combat Algorithms +1 (new) ₡20,000 | ₡2,820,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |

Storage (estimate; the engine counts at run time): 5 final weapons equipped at the robots target of 3. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Source findings before decisions: A03 ×1, V08 ×1, V13 ×3, V18 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 179. Dunes Salvage Partnership (`dunes-salvage-partnership`) — Duo

| Field | Value |
|---|---|
| Stable name | Dunes Salvage Partnership |
| Franchise label | Primordia |
| Backstory | A repaired humanoid and a small precise companion share a desert workshop. Protected endurance and careful distant fire divide a practical partner upgrade account. |
| Strategy | Duo |
| Target overrides | none (goal 13 Robots → 2, the strategy default) |
| Team names | 2v2: **Metropol Outcasts** (robots 1+2) · 3v3: none |
| Event order | `league_2v2`, `tag_team`, `tournament_2v2`, `league_1v1`, `koth`, `grand_melee`, `tournament_1v1`, `league_3v3`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- Franchise label: 'Primordia — 2012 game' → 'Primordia' (decisions 14, 16; delegated authoring)
- 2v2 team 1+2: 'Dunes Pair Pair 01' → 'Metropol Outcasts' (decisions 14, 16; delegated authoring)

Every blueprint is used at the robots target of 2; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Horatio Nullbuilt | `weapon_shield` | short | defensive | 25 | Warden | ONE Horatio Nullbuilt from Primordia, the tall lanky humanoid robot visible in the attached original game screenshot. | `dunes-salvage-partnership/1.webp` |
| 2 | Crispin | `single` | long | balanced | 20 | Deadeye | ONE Crispin from Primordia, ONLY the small round floating companion to the left of Horatio in the attached game screenshot. | `dunes-salvage-partnership/2.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Horatio Nullbuilt | Laser Pistol + Light Shield (₡108,000) | Volt Sabre + Aegis Bulwark (₡834,000) |
| 2 Crispin | Beam Pistol (₡93,000) | Particle Lance (₡425,000) |

**Refinement plans** (generated; applied by Duo goal 17, Refine → 10 steps per robot). All 2 robots: 15 steps, ₡5,670,000; the 2 robots at the target: ₡5,670,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Horatio Nullbuilt (10 steps, ₡2,860,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (8 → 9) ₡10,000 | ₡2,810,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |
| Crispin (5 steps, ₡2,810,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (5 → 6) ₡10,000 | ₡2,810,000 |

Storage (estimate; the engine counts at run time): 3 final weapons equipped at the robots target of 2. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5).

Source findings before decisions: A01 ×1, A03 ×1, V13 ×2, V18 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 180. Union City Circuit Workshop (`union-city-circuit-workshop`) — Paragon

| Field | Value |
|---|---|
| Stable name | Union City Circuit Workshop |
| Franchise label | Beneath a Steel Sky |
| Backstory | One compact industrial companion carries the workshop's arena prospects. Mobility and gradual equipment refinement preserve its selected body instead of assembling several vessels into a roster. |
| Strategy | Paragon |
| Target overrides | none (goal 8 Robots → 1, the strategy default) |
| Team names | 2v2: none · 3v3: none |
| Event order | `league_1v1`, `tournament_1v1`, `koth`, `grand_melee`, `league_2v2`, `tag_team`, `tournament_2v2`, `league_3v3`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- Franchise label: 'Beneath a Steel Sky — 1994 game' → 'Beneath a Steel Sky' (decision 16; delegated authoring)

Every blueprint is used at the robots target of 1; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Joey | `single` | short | balanced | 20 | Sprinter | ONE Joey in the early Union City VACUUM CLEANER body from the ORIGINAL 1994 Beneath a Steel Sky game, as shown in the attached source screenshot: small squat dark violet-grey boxlike tracked… | `union-city-circuit-workshop/1.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Joey | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |

**Refinement plans** (generated; applied by Paragon goal 16, Refine → 10 steps per robot). The only blueprint: 4 steps, ₡2,800,000; the robot at the target: ₡2,800,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Joey (4 steps, ₡2,800,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 | ₡2,800,000 |

Storage (estimate; the engine counts at run time): 1 final weapons equipped at the robots target of 1. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5).

Source findings before decisions: A01 ×1, V13 ×1, V18 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 181. Chimera City Scrapworks (`chimera-city-scrapworks`) — Paragon

| Field | Value |
|---|---|
| Stable name | Chimera City Scrapworks |
| Franchise label | Scrapland |
| Backstory | A self-assembled contender turns scrap into a heavy contact build. The workshop improves one complete body through concentrated equipment and refinement spending. |
| Strategy | Paragon |
| Target overrides | none (goal 8 Robots → 1, the strategy default) |
| Team names | 2v2: none · 3v3: none |
| Event order | `league_1v1`, `tournament_1v1`, `koth`, `grand_melee`, `league_2v2`, `tag_team`, `tournament_2v2`, `league_3v3`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- Franchise label: "Scrapland — use the Remastered edition's references" → 'Scrapland' (decision 16; delegated authoring)

Every blueprint is used at the robots target of 1; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | D-Tritus | `two_handed` | melee | offensive | 10 | Bruiser | ONE D-Tritus from Scrapland Remastered. | `chimera-city-scrapworks/1.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 D-Tritus | Shock Maul (₡183,000) | Heavy Hammer (₡478,000) |

**Refinement plans** (generated; applied by Paragon goal 16, Refine → 10 steps per robot). The only blueprint: 4 steps, ₡2,800,000; the robot at the target: ₡2,800,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| D-Tritus (4 steps, ₡2,800,000) | Heavy Hammer (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 | ₡2,800,000 |

Storage (estimate; the engine counts at run time): 1 final weapons equipped at the robots target of 1. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5).

Source findings before decisions: A01 ×1, V13 ×1, V18 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 182. Last Quiet Day Repair Works (`last-quiet-day-repair-works`) — Paragon

| Field | Value |
|---|---|
| Stable name | Last Quiet Day Repair Works |
| Franchise label | The Uncertain: Last Quiet Day |
| Backstory | A curious engineering machine restores its workshop by taking practical arena contracts. Measured mid-range equipment and gradual refinement come after funded repairs. |
| Strategy | Paragon |
| Target overrides | none (goal 8 Robots → 1, the strategy default) |
| Team names | 2v2: none · 3v3: none |
| Event order | `league_1v1`, `tournament_1v1`, `koth`, `grand_melee`, `league_2v2`, `tag_team`, `tournament_2v2`, `league_3v3`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- Franchise label: 'The Uncertain: Last Quiet Day — 2016 game' → 'The Uncertain: Last Quiet Day' (decision 16; delegated authoring)

Every blueprint is used at the robots target of 1; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | RT-217NP | `single` | mid | balanced | 15 | Tactician | ONE RT-217NP from the FIRST The Uncertain game, Last Quiet Day, using the attached final developer model reference: slim humanoid utility robot with worn white curved body panels over a black… | `last-quiet-day-repair-works/1.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 RT-217NP | Bolt Carbine (₡93,000) | Nova Caster (₡425,000) |

**Refinement plans** (generated; applied by Paragon goal 16, Refine → 10 steps per robot). The only blueprint: 4 steps, ₡2,800,000; the robot at the target: ₡2,800,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| RT-217NP (4 steps, ₡2,800,000) | Nova Caster (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 | ₡2,800,000 |

Storage (estimate; the engine counts at run time): 1 final weapons equipped at the robots target of 1. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5), A02 ×1 (decision 9, 15).

Source findings before decisions: A01 ×1, A02 ×1, V13 ×1, V18 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 183. Scrap Garden Restoration Shop (`scrap-garden-restoration-shop`) — Paragon

| Field | Value |
|---|---|
| Stable name | Scrap Garden Restoration Shop |
| Franchise label | Scrap Garden |
| Backstory | A small determined machine rebuilds the shop through mobile close-range work. The final weapon and its refinements are bought in stages without enlarging the familiar chassis. |
| Strategy | Paragon |
| Target overrides | none (goal 8 Robots → 1, the strategy default) |
| Team names | 2v2: none · 3v3: none |
| Event order | `league_1v1`, `tournament_1v1`, `koth`, `grand_melee`, `league_2v2`, `tag_team`, `tournament_2v2`, `league_3v3`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- Franchise label: 'Scrap Garden — 2016 game' → 'Scrap Garden' (decision 16; delegated authoring)

Every blueprint is used at the robots target of 1; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Canny | `single` | short | balanced | 20 | Sprinter | ONE Canny from Scrap Garden, the small beige tin-can robot in the attached primary game screenshots. | `scrap-garden-restoration-shop/1.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Canny | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |

**Refinement plans** (generated; applied by Paragon goal 16, Refine → 10 steps per robot). The only blueprint: 4 steps, ₡2,800,000; the robot at the target: ₡2,800,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Canny (4 steps, ₡2,800,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 | ₡2,800,000 |

Storage (estimate; the engine counts at run time): 1 final weapons equipped at the robots target of 1. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5).

Source findings before decisions: A01 ×1, V13 ×1, V18 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 184. Bravern Heroic Arsenal (`bravern-heroic-arsenal`) — Paragon

| Field | Value |
|---|---|
| Stable name | Bravern Heroic Arsenal |
| Franchise label | Brave Bang Bravern! |
| Backstory | One theatrical champion commands the arsenal's contact-combat budget. A paired arena allocation captures its bold fighting identity while ordinary equipment and refinement rules set its power. |
| Strategy | Paragon |
| Target overrides | none (goal 8 Robots → 1, the strategy default) |
| Team names | 2v2: none · 3v3: none |
| Event order | `league_1v1`, `tournament_1v1`, `koth`, `grand_melee`, `league_2v2`, `tag_team`, `tournament_2v2`, `league_3v3`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- Franchise label: 'Brave Bang Bravern! — 2024 anime' → 'Brave Bang Bravern!' (decision 16; delegated authoring)

Every blueprint is used at the robots target of 1; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Bravern | `dual_wield` | melee | offensive | 10 | Sprinter | ONE Bravern from Brave Bang Bravern!, his original BASE robot form, full body. | `bravern-heroic-arsenal/1.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Bravern | Practice Sword ×2 (₡100,000) | Vibro Mace ×2 (₡850,000) |

**Refinement plans** (generated; applied by Paragon goal 16, Refine → 10 steps per robot). The only blueprint: 8 steps, ₡5,600,000; the robot at the target: ₡5,600,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Bravern (8 steps, ₡5,600,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 | ₡2,800,000 |
|  | Vibro Mace (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 | ₡2,800,000 |

Storage (estimate; the engine counts at run time): 2 final weapons equipped at the robots target of 1. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5).

Source findings before decisions: A01 ×1, V13 ×2, V18 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 185. Safeguard Enforcement Workshop (`safeguard-enforcement-workshop`) — Paragon

| Field | Value |
|---|---|
| Stable name | Safeguard Enforcement Workshop |
| Franchise label | BLAME! |
| Backstory | A single enforcement entity receives a heavy distant weapon and patient workshop investment. Its selected body remains one roster slot through every equipment stage. |
| Strategy | Paragon |
| Target overrides | none (goal 8 Robots → 1, the strategy default) |
| Team names | 2v2: none · 3v3: none |
| Event order | `league_1v1`, `tournament_1v1`, `koth`, `grand_melee`, `league_2v2`, `tag_team`, `tournament_2v2`, `league_3v3`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- Franchise label: 'BLAME! — manga continuity' → 'BLAME!' (decision 16; delegated authoring)

Every blueprint is used at the robots target of 1; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Sanakan | `two_handed` | long | balanced | 15 | Deadeye | ONE Sanakan from Tsutomu Nihei's original BLAME! | `safeguard-enforcement-workshop/1.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Sanakan | Training Beam (₡50,000) | Ion Beam (₡544,000) |

**Refinement plans** (generated; applied by Paragon goal 16, Refine → 10 steps per robot). The only blueprint: 4 steps, ₡2,800,000; the robot at the target: ₡2,800,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Sanakan (4 steps, ₡2,800,000) | Ion Beam (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 | ₡2,800,000 |

Storage (estimate; the engine counts at run time): 1 final weapons equipped at the robots target of 1. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5), A09 ×1 (decision 8, 17).

Source findings before decisions: A01 ×1, A09 ×1, V13 ×1, V18 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 186. GUNHED Autonomous Works (`gunhed-autonomous-works`) — Paragon

| Field | Value |
|---|---|
| Stable name | GUNHED Autonomous Works |
| Franchise label | GUNHED |
| Backstory | An industrial combat machine carries the works' heavy-fire contracts. Concentrated upgrades and refinement improve its standing arena configuration without buying its alternate mode as another robot. |
| Strategy | Paragon |
| Target overrides | none (goal 8 Robots → 1, the strategy default) |
| Team names | 2v2: none · 3v3: none |
| Event order | `league_1v1`, `tournament_1v1`, `koth`, `grand_melee`, `league_2v2`, `tag_team`, `tournament_2v2`, `league_3v3`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- Franchise label: 'GUNHED — 1989 film' → 'GUNHED' (decision 16; delegated authoring)

Every blueprint is used at the robots target of 1; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | GUNHED 507 | `two_handed` | mid | offensive | 10 | Bruiser | ONE GUNHED 507 in the 1989 film's STANDING GII robot mode, matching the attached licensed source model photograph's complex nonstandard geometry exactly. | `gunhed-autonomous-works/1.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 GUNHED 507 | Training Rifle (₡50,000) | Plasma Cannon (₡408,000) |

**Refinement plans** (generated; applied by Paragon goal 16, Refine → 10 steps per robot). The only blueprint: 4 steps, ₡2,800,000; the robot at the target: ₡2,800,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| GUNHED 507 (4 steps, ₡2,800,000) | Plasma Cannon (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 | ₡2,800,000 |

Storage (estimate; the engine counts at run time): 1 final weapons equipped at the robots target of 1. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5).

Source findings before decisions: A01 ×1, V13 ×1, V18 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 187. Series 4000 Service Workshop (`series-4000-service-workshop`) — Paragon

| Field | Value |
|---|---|
| Stable name | Series 4000 Service Workshop |
| Franchise label | Red Dwarf |
| Backstory | A conscientious service mechanoid protects its equipment and keeps meticulous repair accounts. The workshop backs one defensive contender with gradual shield and weapon improvements. |
| Strategy | Paragon |
| Target overrides | none (goal 8 Robots → 1, the strategy default) |
| Team names | 2v2: none · 3v3: none |
| Event order | `league_1v1`, `tournament_1v1`, `koth`, `grand_melee`, `league_2v2`, `tag_team`, `tournament_2v2`, `league_3v3`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- Franchise label: 'Red Dwarf — television continuity' → 'Red Dwarf' (decision 16; delegated authoring)

Every blueprint is used at the robots target of 1; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Kryten 2X4B-523P | `weapon_shield` | mid | defensive | 25 | Tactician | ONE Kryten 2X4B-523P from Red Dwarf, using the familiar Robert Llewellyn-era television mechanoid design. | `series-4000-service-workshop/1.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Kryten 2X4B-523P | Bolt Carbine + Light Shield (₡144,000) | Nova Caster + Aegis Bulwark (₡834,000) |

**Refinement plans** (generated; applied by Paragon goal 16, Refine → 10 steps per robot). The only blueprint: 4 steps, ₡2,800,000; the robot at the target: ₡2,800,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Kryten 2X4B-523P (4 steps, ₡2,800,000) | Nova Caster (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 | ₡2,800,000 |
|  | Aegis Bulwark (offhand) | no step (allowed: shields need no step) | ₡0 |

Storage (estimate; the engine counts at run time): 2 final weapons equipped at the robots target of 1. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5).

Source findings before decisions: A01 ×1, V13 ×1, V18 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 188. Interplanetary Peacekeepers (`interplanetary-peacekeeper-works`) — Paragon

| Field | Value |
|---|---|
| Stable name | Interplanetary Peacekeepers |
| Franchise label | The Day the Earth Stood Still |
| Backstory | A monumental robot holds the workshop's single champion allocation. Its imposing distant-fire role uses an ordinary heavy weapon path and funded refinement milestones. |
| Strategy | Paragon |
| Target overrides | none (goal 8 Robots → 1, the strategy default) |
| Team names | 2v2: none · 3v3: none |
| Event order | `league_1v1`, `tournament_1v1`, `koth`, `grand_melee`, `league_2v2`, `tag_team`, `tournament_2v2`, `league_3v3`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- Stable name: 'Interplanetary Peacekeeper Works' → 'Interplanetary Peacekeepers' (decisions 13, 16; delegated authoring)
- Franchise label: 'The Day the Earth Stood Still — 1951 film' → 'The Day the Earth Stood Still' (decisions 13, 16; delegated authoring)

Every blueprint is used at the robots target of 1; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Gort | `two_handed` | long | balanced | 15 | Deadeye | ONE Gort from the ORIGINAL 1951 The Day the Earth Stood Still. | `interplanetary-peacekeeper-works/1.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Gort | Training Beam (₡50,000) | Ion Beam (₡544,000) |

**Refinement plans** (generated; applied by Paragon goal 16, Refine → 10 steps per robot). The only blueprint: 4 steps, ₡2,800,000; the robot at the target: ₡2,800,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Gort (4 steps, ₡2,800,000) | Ion Beam (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 | ₡2,800,000 |

Storage (estimate; the engine counts at run time): 1 final weapons equipped at the robots target of 1. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5).

Source findings before decisions: A01 ×1, V02 ×1, V13 ×1, V18 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 189. Virgil Test Facility Workshop (`virgil-test-facility-workshop`) — Paragon

| Field | Value |
|---|---|
| Stable name | Virgil Test Facility Workshop |
| Franchise label | Portal Stories: Mel |
| Backstory | A compact core takes the facility's arena allocation through an explicitly adapted mobile mount. Its modest weapon path and staged refinement leave the original identity recognisable. |
| Strategy | Paragon |
| Target overrides | none (goal 8 Robots → 1, the strategy default) |
| Team names | 2v2: none · 3v3: none |
| Event order | `league_1v1`, `tournament_1v1`, `koth`, `grand_melee`, `league_2v2`, `tag_team`, `tournament_2v2`, `league_3v3`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- Franchise label: 'Portal Stories: Mel (fan-made Portal mod)' → 'Portal Stories: Mel' (decision 16; delegated authoring)

Every blueprint is used at the robots target of 1; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Virgil | `single` | short | balanced | 20 | Sprinter | ONE Virgil maintenance personality core from the released fan-made Portal Stories: Mel, preserve his actual compact spherical core body: worn dark orange/red casing with faded mustard-yellow floral… | `virgil-test-facility-workshop/1.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Virgil | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |

**Refinement plans** (generated; applied by Paragon goal 16, Refine → 10 steps per robot). The only blueprint: 4 steps, ₡2,800,000; the robot at the target: ₡2,800,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Virgil (4 steps, ₡2,800,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 | ₡2,800,000 |

Storage (estimate; the engine counts at run time): 1 final weapons equipped at the robots target of 1. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5).

Source findings before decisions: A01 ×1, V13 ×1, V18 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 190. Wilson Resistance Salvageworks (`wilson-resistance-salvage-works`) — Paragon

| Field | Value |
|---|---|
| Stable name | Wilson Resistance Salvageworks |
| Franchise label | Entropy: Zero 2 |
| Backstory | A personable turret becomes a mobile arena contender through an adapted transport mount. Two supported close-range allocations carry the workshop's concentrated equipment investment. |
| Strategy | Paragon |
| Target overrides | none (goal 8 Robots → 1, the strategy default) |
| Team names | 2v2: none · 3v3: none |
| Event order | `league_1v1`, `tournament_1v1`, `koth`, `grand_melee`, `league_2v2`, `tag_team`, `tournament_2v2`, `league_3v3`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- Stable name: 'Wilson Resistance Salvage Works' → 'Wilson Resistance Salvageworks' (decisions 13, 16; delegated authoring)
- Franchise label: 'Entropy: Zero 2 — fan-made Half-Life 2 mod by Breadmen' → 'Entropy: Zero 2' (decisions 13, 16; delegated authoring)

Every blueprint is used at the robots target of 1; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Wilson | `dual_wield` | short | offensive | 10 | Sprinter | ONE Wilson, the friendly defective prototype turret from the released Entropy: Zero 2 fan mod, using the central outlined turret in the attached developer screenshot as source: tall narrow dark… | `wilson-resistance-salvage-works/1.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Wilson | Laser Pistol ×2 (₡114,000) | Volt Sabre ×2 (₡850,000) |

**Refinement plans** (generated; applied by Paragon goal 16, Refine → 10 steps per robot). The only blueprint: 8 steps, ₡5,600,000; the robot at the target: ₡5,600,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Wilson (8 steps, ₡5,600,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 | ₡2,800,000 |
|  | Volt Sabre (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 | ₡2,800,000 |

Storage (estimate; the engine counts at run time): 2 final weapons equipped at the robots target of 1. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5).

Source findings before decisions: A01 ×1, V02 ×1, V13 ×2, V18 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 191. Steamworks Robot Partnership (`steamworks-robot-partnership`) — Duo

| Field | Value |
|---|---|
| Stable name | Steamworks Robot Partnership |
| Franchise label | Undertale Yellow |
| Backstory | A compact security machine and a large gardening frame turn the steamworks into a complementary partner stable. Flexible fire and heavy contact receive balanced upgrades. |
| Strategy | Duo |
| Target overrides | none (goal 13 Robots → 2, the strategy default) |
| Team names | 2v2: **Steamworks Caretakers** (robots 1+2) · 3v3: none |
| Event order | `league_2v2`, `tag_team`, `tournament_2v2`, `league_1v1`, `koth`, `grand_melee`, `tournament_1v1`, `league_3v3`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- Franchise label: 'Undertale Yellow (fan-made Undertale prequel)' → 'Undertale Yellow' (decisions 14, 16; delegated authoring)
- 2v2 team 1+2: 'Steamworks Pair Pair 01' → 'Steamworks Caretakers' (decisions 14, 16; delegated authoring)

Every blueprint is used at the robots target of 2; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Axis Model 014 | `single` | short | balanced | 15 | Versatile | ONE Axis Model 014 from Undertale Yellow, accurate to the released fan game's normal robot body. | `steamworks-robot-partnership/1.webp` |
| 2 | Guardener | `two_handed` | melee | offensive | 10 | Bruiser | ONE Guardener Model 02 from Undertale Yellow, precisely the large robot labelled Guardener in the TOP RIGHT of the attached original designer's reference. | `steamworks-robot-partnership/2.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Axis Model 014 | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |
| 2 Guardener | Shock Maul (₡183,000) | Heavy Hammer (₡478,000) |

**Refinement plans** (generated; applied by Duo goal 17, Refine → 10 steps per robot). All 2 robots: 10 steps, ₡5,620,000; the 2 robots at the target: ₡5,620,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Axis Model 014 (5 steps, ₡2,810,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (8 → 9) ₡10,000 | ₡2,810,000 |
| Guardener (5 steps, ₡2,810,000) | Heavy Hammer (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (7 → 8) ₡10,000 | ₡2,810,000 |

Storage (estimate; the engine counts at run time): 2 final weapons equipped at the robots target of 2. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5).

Source findings before decisions: A01 ×1, A03 ×1, V13 ×2, V18 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 192. Candys Animatronic Workshop (`candys-animatronic-workshop`) — Tycoon

| Field | Value |
|---|---|
| Stable name | Candys Animatronic Workshop |
| Franchise label | Five Nights at Candy's |
| Backstory | Three intact stage machines earn the venue's next facility improvement. Flexible fire, precise support and heavy contact give the business practical arena coverage. |
| Strategy | Tycoon |
| Target overrides | goal 20 Robots → 3 (strategy default 2, allowed 2–3) |
| Team names | 2v2: **Candy's Burgers and Fries** (robots 1+2) · 3v3: **Animatronic Showtime** (1–3) |
| Event order | `league_2v2`, `tag_team`, `league_1v1`, `league_3v3`, `koth`, `grand_melee`, `tournament_2v2`, `tournament_3v3`, `tournament_1v1` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- Stable name: "Candy's Animatronic Workshop" → 'Candys Animatronic Workshop' (decisions 13, 14, 16; delegated authoring)
- Franchise label: "Five Nights at Candy's — fan-origin series by Emil Macko" → "Five Nights at Candy's" (decisions 13, 14, 16; delegated authoring)
- 2v2 team 1+2: 'Candy Workshop Pair 01' → "Candy's Burgers and Fries" (decisions 13, 14, 16; delegated authoring)
- 3v3 team 1+2+3: 'Candy Workshop Squad 01' → 'Animatronic Showtime' (decisions 13, 14, 16; delegated authoring)

Every blueprint is used at the robots target of 3; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Candy | `single` | short | balanced | 15 | Versatile | ONE Candy from Emil Macko's Five Nights at Candy's Remastered, using the INTACT same-game model, not a withered, stylized fan redesign or later sequel body. | `candys-animatronic-workshop/1.webp` |
| 2 | Cindy | `single` | long | balanced | 20 | Deadeye | ONE Cindy from Emil Macko's Five Nights at Candy's Remastered, using the INTACT same-game model, not a withered, stylized fan redesign or later sequel body. | `candys-animatronic-workshop/2.webp` |
| 3 | Chester | `two_handed` | melee | offensive | 10 | Bruiser | ONE Chester from Emil Macko's Five Nights at Candy's Remastered, using the INTACT same-game model, not a withered, stylized fan redesign or later sequel body. | `candys-animatronic-workshop/3.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Candy | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |
| 2 Cindy | Beam Pistol (₡93,000) | Particle Lance (₡425,000) |
| 3 Chester | Shock Maul (₡183,000) | Heavy Hammer (₡478,000) |

**Refinement plans** (generated; applied by Tycoon goal 25, Refine → 10 steps per robot). All 3 robots: 15 steps, ₡8,520,000; the 3 robots at the target: ₡8,520,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Candy (5 steps, ₡2,840,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +2 (8 → 10) ₡40,000 | ₡2,840,000 |
| Cindy (5 steps, ₡2,840,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +2 (5 → 7) ₡40,000 | ₡2,840,000 |
| Chester (5 steps, ₡2,840,000) | Heavy Hammer (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +2 (7 → 9) ₡40,000 | ₡2,840,000 |

Storage (estimate; the engine counts at run time): 3 final weapons equipped at the robots target of 3. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Source findings before decisions: A03 ×1, V02 ×1, V08 ×1, V13 ×3, V18 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 193. Sweetie Circuit Atelier (`sweetie-circuit-atelier`) — Paragon

| Field | Value |
|---|---|
| Stable name | Sweetie Circuit Atelier |
| Franchise label | My Little Pony — Steel Soul |
| Backstory | A small mechanical quadruped supports the atelier through mobile close-range work. One restrained arena allocation improves without changing the selected story's familiar body. |
| Strategy | Paragon |
| Target overrides | none (goal 8 Robots → 1, the strategy default) |
| Team names | 2v2: none · 3v3: none |
| Event order | `league_1v1`, `tournament_1v1`, `koth`, `grand_melee`, `league_2v2`, `tag_team`, `tournament_2v2`, `league_3v3`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- Franchise label: 'My Little Pony fan fiction — Steel Soul by Masterweaver' → 'My Little Pony — Steel Soul' (decision 16; delegated authoring)

Every blueprint is used at the robots target of 1; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Sweetie Bot | `single` | short | balanced | 20 | Sprinter | ONE robotic Sweetie Belle, often called Sweetie Bot, specifically an original portrait interpretation of Masterweaver's fan-fiction Steel Soul. | `sweetie-circuit-atelier/1.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Sweetie Bot | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |

**Refinement plans** (generated; applied by Paragon goal 16, Refine → 10 steps per robot). The only blueprint: 4 steps, ₡2,800,000; the robot at the target: ₡2,800,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Sweetie Bot (4 steps, ₡2,800,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 | ₡2,800,000 |

Storage (estimate; the engine counts at run time): 1 final weapons equipped at the robots target of 1. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5).

Source findings before decisions: A01 ×1, V13 ×1, V18 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 194. Nemesis AI Arsenal (`nemesis-ai-arsenal`) — Paragon

| Field | Value |
|---|---|
| Stable name | Nemesis AI Arsenal |
| Franchise label | The Last Angel |
| Backstory | A single compact proxy carries an intelligence's arena contract. The arsenal purchases one heavy distant weapon path; the larger ship remains background rather than a free second combatant. |
| Strategy | Paragon |
| Target overrides | none (goal 8 Robots → 1, the strategy default) |
| Team names | 2v2: none · 3v3: none |
| Event order | `league_1v1`, `tournament_1v1`, `koth`, `grand_melee`, `league_2v2`, `tag_team`, `tournament_2v2`, `league_3v3`, `tournament_3v3` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- Franchise label: 'The Last Angel — original web fiction by Proximal Flame' → 'The Last Angel' (decision 16; delegated authoring)

Every blueprint is used at the robots target of 1; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Red One | `two_handed` | long | balanced | 15 | Deadeye | ONE ORIGINAL compact ground robot designed as an ARENA PROXY representing Red One, the AI associated with Nemesis in Proximal Flame's original web fiction The Last Angel. | `nemesis-ai-arsenal/1.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Red One | Training Beam (₡50,000) | Ion Beam (₡544,000) |

**Refinement plans** (generated; applied by Paragon goal 16, Refine → 10 steps per robot). The only blueprint: 4 steps, ₡2,800,000; the robot at the target: ₡2,800,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Red One (4 steps, ₡2,800,000) | Ion Beam (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 | ₡2,800,000 |

Storage (estimate; the engine counts at run time): 1 final weapons equipped at the robots target of 1. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5).

Source findings before decisions: A01 ×1, V13 ×1, V18 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 195. Chrysalis Reconstruction Array (`chrysalis-reconstruction-array`) — Swarm

| Field | Value |
|---|---|
| Stable name | Chrysalis Reconstruction Array |
| Franchise label | Chrysalis |
| Backstory | An industrial intelligence sends a coherent line of reconstruction machines into the arena. Eleven separately equipped bodies rebuild the account through recruitment, maintenance and practical upgrades. |
| Strategy | Swarm |
| Target overrides | none (goal 10 Robots → 11, the strategy default) |
| Team names | 2v2: **Rebuild Protocol** (robots 1+2), **Salvage Swarm** (3+4), **Foundry Drones** (5+6), **Reclaimed Earth** (7+8), **Patient Machine** (9+10) · 3v3: **Reconstruction Wave** (1–3), **Seed of Rebirth** (4–6), **Chrysalis Awakening** (7–9) |
| Event order | `league_3v3`, `league_2v2`, `tag_team`, `league_1v1`, `koth`, `grand_melee`, `tournament_3v3`, `tournament_2v2`, `tournament_1v1` |

**Changes from your draft** (recorded in `tools/decisions.json`):

- Franchise label: 'Chrysalis — original r/HFY web fiction by BeaverFur' → 'Chrysalis' (decisions 14, 16, 18; delegated authoring)
- 2v2 team 1+2: 'Chrysalis Pair 01' → 'Rebuild Protocol' (decisions 14, 16, 18; delegated authoring)
- 2v2 team 3+4: 'Chrysalis Pair 02' → 'Salvage Swarm' (decisions 14, 16, 18; delegated authoring)
- 2v2 team 5+6: 'Chrysalis Pair 03' → 'Foundry Drones' (decisions 14, 16, 18; delegated authoring)
- 2v2 team 7+8: 'Chrysalis Pair 04' → 'Reclaimed Earth' (decisions 14, 16, 18; delegated authoring)
- 2v2 team 9+10: 'Chrysalis Pair 05' → 'Patient Machine' (decisions 14, 16, 18; delegated authoring)
- 3v3 team 1+2+3: 'Chrysalis Squad 01' → 'Reconstruction Wave' (decisions 14, 16, 18; delegated authoring)
- 3v3 team 4+5+6: 'Chrysalis Squad 02' → 'Seed of Rebirth' (decisions 14, 16, 18; delegated authoring)
- 3v3 team 7+8+9: 'Chrysalis Squad 03' → 'Chrysalis Awakening' (decisions 14, 16, 18; delegated authoring)
- Slot 1 robot name: 'Reconstruction Drone 01' → 'Survey Mast' (decisions 14, 16, 18; delegated authoring)
- Slot 1 art brief: "ONE ORIGINAL arena-scale reconstruction drone representing the intelligence's industrial drones in BeaverFur's original r/HFY web fiction Chrysalis." → 'White quadruped drone with yellow hazard stripes, camera head on a short mast, whip antenna, amber visor slit' (decisions 14, 16, 18; delegated authoring)
- Slot 1 portrait: aligned (decisions 14, 16, 18; delegated authoring)
- Slot 2 robot name: 'Reconstruction Drone 02' → 'Periscope' (decisions 14, 16, 18; delegated authoring)
- Slot 2 art brief: "ONE ORIGINAL arena-scale reconstruction drone representing the intelligence's industrial drones in BeaverFur's original r/HFY web fiction Chrysalis." → 'White-and-yellow quadruped drone, tall periscope sensor stalk rising from its back, amber eye slit' (decisions 14, 16, 18; delegated authoring)
- Slot 2 portrait: aligned (decisions 14, 16, 18; delegated authoring)
- Slot 3 robot name: 'Reconstruction Drone 03' → 'Rack Hauler' (decisions 14, 16, 18; delegated authoring)
- Slot 3 art brief: "ONE ORIGINAL arena-scale reconstruction drone representing the intelligence's industrial drones in BeaverFur's original r/HFY web fiction Chrysalis." → 'Boxy white quadruped drone carrying an open cargo rack on its back, amber visor slit' (decisions 14, 16, 18; delegated authoring)
- Slot 3 portrait: aligned (decisions 14, 16, 18; delegated authoring)
- Slot 4 robot name: 'Reconstruction Drone 04' → 'Hose Welder' (decisions 14, 16, 18; delegated authoring)
- Slot 4 art brief: "ONE ORIGINAL arena-scale reconstruction drone representing the intelligence's industrial drones in BeaverFur's original r/HFY web fiction Chrysalis." → 'White quadruped drone with a hose-fed welding nozzle arm curled over its shoulder' (decisions 14, 16, 18; delegated authoring)
- Slot 4 portrait: aligned (decisions 14, 16, 18; delegated authoring)
- Slot 5 robot name: 'Reconstruction Drone 05' → 'Sawback' (decisions 14, 16, 18; delegated authoring)
- Slot 5 art brief: "ONE ORIGINAL arena-scale reconstruction drone representing the intelligence's industrial drones in BeaverFur's original r/HFY web fiction Chrysalis." → 'White quadruped drone with a large circular saw blade mounted on its side arm' (decisions 14, 16, 18; delegated authoring)
- Slot 5 portrait: aligned (decisions 14, 16, 18; delegated authoring)
- Slot 6 robot name: 'Reconstruction Drone 06' → 'Borehead' (decisions 14, 16, 18; delegated authoring)
- Slot 6 art brief: "ONE ORIGINAL arena-scale reconstruction drone representing the intelligence's industrial drones in BeaverFur's original r/HFY web fiction Chrysalis." → 'White quadruped drone with a heavy spiral drill bit mounted on its side' (decisions 14, 16, 18; delegated authoring)
- Slot 6 portrait: aligned (decisions 14, 16, 18; delegated authoring)
- Slot 7 robot name: 'Reconstruction Drone 07' → 'Cargo Mule' (decisions 14, 16, 18; delegated authoring)
- Slot 7 art brief: "ONE ORIGINAL arena-scale reconstruction drone representing the intelligence's industrial drones in BeaverFur's original r/HFY web fiction Chrysalis." → 'Long white quadruped drone hauling a big sealed container module on its back' (decisions 14, 16, 18; delegated authoring)
- Slot 7 portrait: aligned (decisions 14, 16, 18; delegated authoring)
- Slot 8 robot name: 'Reconstruction Drone 08' → 'Plate Layer' (decisions 14, 16, 18; delegated authoring)
- Slot 8 art brief: "ONE ORIGINAL arena-scale reconstruction drone representing the intelligence's industrial drones in BeaverFur's original r/HFY web fiction Chrysalis." → 'Squat white quadruped drone with a large slab of hull plate carried on its flank' (decisions 14, 16, 18; delegated authoring)
- Slot 8 portrait: aligned (decisions 14, 16, 18; delegated authoring)
- Slot 9 robot name: 'Reconstruction Drone 09' → 'Forktine' (decisions 14, 16, 18; delegated authoring)
- Slot 9 art brief: "ONE ORIGINAL arena-scale reconstruction drone representing the intelligence's industrial drones in BeaverFur's original r/HFY web fiction Chrysalis." → 'White quadruped drone with twin forklift tines jutting forward under its body' (decisions 14, 16, 18; delegated authoring)
- Slot 9 portrait: aligned (decisions 14, 16, 18; delegated authoring)
- Slot 10 robot name: 'Reconstruction Drone 10' → 'Tinker Arm' (decisions 14, 16, 18; delegated authoring)
- Slot 10 art brief: "ONE ORIGINAL arena-scale reconstruction drone representing the intelligence's industrial drones in BeaverFur's original r/HFY web fiction Chrysalis." → 'White quadruped drone with a side toolbox pod and a small manipulator arm at the front' (decisions 14, 16, 18; delegated authoring)
- Slot 10 portrait: aligned (decisions 14, 16, 18; delegated authoring)
- Slot 11 robot name: 'Reconstruction Drone 11' → 'Beam Cutter' (decisions 14, 16, 18; delegated authoring)
- Slot 11 art brief: "ONE ORIGINAL arena-scale reconstruction drone representing the intelligence's industrial drones in BeaverFur's original r/HFY web fiction Chrysalis." → 'White quadruped drone with a long beam-cutter barrel mounted along its side' (decisions 14, 16, 18; delegated authoring)
- Slot 11 portrait: aligned (decisions 14, 16, 18; delegated authoring)

Every blueprint is used at the robots target of 11; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Survey Mast | `single` | short | balanced | 15 | Versatile | White quadruped drone with yellow hazard stripes, camera head on a short mast, whip antenna, amber visor slit | `chrysalis-reconstruction-array/1.webp` |
| 2 | Periscope | `single` | short | defensive | 30 | Tactician | White-and-yellow quadruped drone, tall periscope sensor stalk rising from its back, amber eye slit | `chrysalis-reconstruction-array/2.webp` |
| 3 | Rack Hauler | `single` | mid | balanced | 15 | Tactician | Boxy white quadruped drone carrying an open cargo rack on its back, amber visor slit | `chrysalis-reconstruction-array/3.webp` |
| 4 | Hose Welder | `single` | short | balanced | 20 | Sprinter | White quadruped drone with a hose-fed welding nozzle arm curled over its shoulder | `chrysalis-reconstruction-array/4.webp` |
| 5 | Sawback | `single` | long | balanced | 20 | Deadeye | White quadruped drone with a large circular saw blade mounted on its side arm | `chrysalis-reconstruction-array/5.webp` |
| 6 | Borehead | `weapon_shield` | short | defensive | 25 | Warden | White quadruped drone with a heavy spiral drill bit mounted on its side | `chrysalis-reconstruction-array/6.webp` |
| 7 | Cargo Mule | `single` | melee | offensive | 10 | Sprinter | Long white quadruped drone hauling a big sealed container module on its back | `chrysalis-reconstruction-array/7.webp` |
| 8 | Plate Layer | `two_handed` | melee | offensive | 10 | Bruiser | Squat white quadruped drone with a large slab of hull plate carried on its flank | `chrysalis-reconstruction-array/8.webp` |
| 9 | Forktine | `two_handed` | mid | offensive | 10 | Bruiser | White quadruped drone with twin forklift tines jutting forward under its body | `chrysalis-reconstruction-array/9.webp` |
| 10 | Tinker Arm | `weapon_shield` | long | defensive | 20 | Warden | White quadruped drone with a side toolbox pod and a small manipulator arm at the front | `chrysalis-reconstruction-array/10.webp` |
| 11 | Beam Cutter | `two_handed` | long | balanced | 15 | Deadeye | White quadruped drone with a long beam-cutter barrel mounted along its side | `chrysalis-reconstruction-array/11.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Survey Mast | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |
| 2 Periscope | Practice Blaster (₡50,000) | Volt Sabre (₡425,000) |
| 3 Rack Hauler | Bolt Carbine (₡93,000) | Nova Caster (₡425,000) |
| 4 Hose Welder | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |
| 5 Sawback | Beam Pistol (₡93,000) | Particle Lance (₡425,000) |
| 6 Borehead | Laser Pistol + Light Shield (₡108,000) | Volt Sabre + Aegis Bulwark (₡834,000) |
| 7 Cargo Mule | Practice Sword (₡50,000) | Vibro Mace (₡425,000) |
| 8 Plate Layer | Shock Maul (₡183,000) | Heavy Hammer (₡478,000) |
| 9 Forktine | Training Rifle (₡50,000) | Plasma Cannon (₡408,000) |
| 10 Tinker Arm | Beam Pistol + Light Shield (₡144,000) | Particle Lance + Aegis Bulwark (₡834,000) |
| 11 Beam Cutter | Training Beam (₡50,000) | Ion Beam (₡544,000) |

**Refinement plans** (generated; applied by Swarm goal 23, Refine → 8 steps per robot). All 11 robots: 65 steps, ₡32,100,000; the 11 robots at the target: ₡32,100,000; Refine → 8 applies ₡32,060,000 of the target robots' plans.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Survey Mast (5 steps, ₡2,960,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| Periscope (5 steps, ₡2,820,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Combat Algorithms +1 (new) ₡20,000 | ₡2,820,000 |
| Rack Hauler (5 steps, ₡2,820,000) | Nova Caster (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Combat Algorithms +1 (new) ₡20,000 | ₡2,820,000 |
| Hose Welder (5 steps, ₡2,960,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Power Core +4 (−3 → 1) ₡160,000 | ₡2,960,000 |
| Sawback (5 steps, ₡2,960,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +4 (5 → 9) ₡160,000 | ₡2,960,000 |
| Borehead (10 steps, ₡2,870,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Armor Plating +1 (new) ₡20,000 | ₡2,820,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |
| Cargo Mule (5 steps, ₡2,960,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Gyro Stabilizers +4 (4 → 8) ₡160,000 | ₡2,960,000 |
| Plate Layer (5 steps, ₡2,960,000) | Heavy Hammer (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Critical Systems +4 (4 → 8) ₡160,000 | ₡2,960,000 |
| Forktine (5 steps, ₡2,960,000) | Plasma Cannon (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Critical Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| Tinker Arm (10 steps, ₡2,870,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Armor Plating +1 (new) ₡20,000 | ₡2,820,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |
| Beam Cutter (5 steps, ₡2,960,000) | Ion Beam (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (4 → 8) ₡160,000 | ₡2,960,000 |

Storage (estimate; the engine counts at run time): 13 final weapons equipped at the robots target of 11. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need Storage Facility L2; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Source findings before decisions: A03 ×2, A13 ×11, V13 ×11, V18 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 196. Sanctuary SecUnit Workshop (`sanctuary-secunit-workshop`) — Paragon

| Field | Value |
|---|---|
| Stable name | Sanctuary SecUnit Workshop |
| Franchise label | The Murderbot Diaries |
| Backstory | A reluctant security construct keeps one arena account functioning through practical equipment and disciplined repairs. Concentrated refinement follows a complete final weapon upgrade. |
| Strategy | Paragon |
| Target overrides | none (goal 8 Robots → 1, the strategy default) |
| Team names | 2v2: none · 3v3: none |
| Event order | `league_1v1`, `tournament_1v1`, `koth`, `grand_melee`, `league_2v2`, `tag_team`, `tournament_2v2`, `league_3v3`, `tournament_3v3` |

**Changes from your draft**: none.

Every blueprint is used at the robots target of 1; there is no slot beyond the target.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |
|---|---|---|---|---|---|---|---|---|
| 1 | Murderbot | `single` | short | balanced | 15 | Versatile | ONE Murderbot, the SecUnit from Apple TV's television adaptation, using the Season 1 tan security armour outfit consistently. | `sanctuary-secunit-workshop/1.webp` |

**Weapon paths** (stage 0 starter → stage 1 final; list prices)

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Murderbot | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |

**Refinement plans** (generated; applied by Paragon goal 16, Refine → 10 steps per robot). The only blueprint: 4 steps, ₡2,800,000; the robot at the target: ₡2,800,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Murderbot (4 steps, ₡2,800,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 | ₡2,800,000 |

Storage (estimate; the engine counts at run time): 1 final weapons equipped at the robots target of 1. Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need no Storage Facility level; replaced starters stay in storage until it is full and are then sold first.

Open findings: none.

Accepted by your decisions: A01 ×1 (decision 5), A09 ×1 (decision 8, 17).

Source findings before decisions: A01 ×1, A09 ×1, V13 ×1.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026

---

## 197. Coverage and name checks

The expansion adds no new capability: the spec-55 Coverage_Matrix (§14) is already satisfied by the starter set, and the union with these entries only adds more rows. The expansion alone covers: strategies ['duo', 'generalist', 'paragon', 'swarm', 'trio', 'tycoon']; Build_Focus ['bruiser', 'deadeye', 'sprinter', 'tactician', 'versatile', 'warden']; loadouts ['dual_wield', 'single', 'two_handed', 'weapon_shield']; stances ['balanced', 'defensive', 'offensive']; ranges ['long', 'melee', 'mid', 'short']; refinement tiers ['augment', 'forge', 'hone', 'sharpen']; offhand refinement on ['dual_wield', 'weapon_shield'].

Names: 194 stable names (11–30 characters), 645 robot names (1–24 characters), 403 team names (7–30 characters). Uniqueness against existing ACC stables and robots cannot be checked from the repository; Catalogue_Sync reports stable-name conflicts and robot-name conflicts get the "Mk II" suffix at purchase time.

- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on 11 October 2026
