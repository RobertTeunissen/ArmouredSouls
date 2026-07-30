# Armoured Souls — Architecture Diagrams

## 1. High-Level System Architecture

```mermaid
graph TB
    subgraph Client["Client Layer"]
        SPA["React 19 SPA<br/>(Vite 6 + Tailwind 4)"]
    end

    subgraph Proxy["Reverse Proxy"]
        Caddy["Caddy<br/>Auto HTTPS · Compression<br/>Static files + API proxy"]
    end

    subgraph App["Application Layer (Node.js 24 LTS)"]
        Express["Express 5 API<br/>(:3001)"]
        Scheduler["Cycle Scheduler<br/>(node-cron)"]
        PM2["PM2 Process Manager"]
    end

    subgraph Data["Data Layer"]
        PG["PostgreSQL 17<br/>(Prisma 7 ORM)"]
        FS["File Storage<br/>(uploads/)"]
    end

    subgraph External["External Services"]
        Discord["Discord Webhooks<br/>(Alerts)"]
        LE["Let's Encrypt<br/>(TLS Certs)"]
    end

    SPA -->|HTTPS| Caddy
    Caddy -->|/api/*| Express
    Caddy -->|Static| SPA
    Caddy -.->|Auto-cert| LE
    PM2 --> Express
    PM2 --> Scheduler
    Express --> PG
    Express --> FS
    Scheduler --> PG
    Scheduler -.-> Discord
```

## 2. Backend Service Domain Map

```mermaid
graph LR
    subgraph Core["Core Game Logic"]
        Battle["battle/<br/>Combat Engine"]
        Arena["arena/<br/>2D Spatial Systems"]
        League["league/<br/>1v1 League"]
        Tournament["tournament/<br/>Brackets"]
        TagTeam["tag-team/<br/>2v2 Tag Team"]
        TeamBattle["team-battle/<br/>2v2 & 3v3 League"]
        KotH["koth/<br/>King of the Hill"]
        GrandMelee["grand-melee/<br/>Free-for-All"]
    end

    subgraph Economy["Economy & Progression"]
        EconSvc["economy/<br/>Repair · Streaming · ROI"]
        Robot["robot/<br/>CRUD · Upgrades"]
        Subscription["subscription/<br/>Booking Office"]
        Achievement["achievement/<br/>77 Achievements"]
        TuningPool["tuning-pool/<br/>Tuning Allocations"]
    end

    subgraph Platform["Platform Services"]
        Auth["auth/<br/>JWT · Passwords"]
        Admin["admin/<br/>Admin Portal"]
        Cycle["cycle/<br/>Cron Scheduler"]
        Matchmaking["matchmaking/<br/>LP-Primary Pairing"]
        Security["security/<br/>Monitoring · Logging"]
        Moderation["moderation/<br/>Image Uploads"]
    end

    subgraph Support["Support Services"]
        Analytics["analytics/<br/>Metrics · Leaderboards"]
        Common["common/<br/>Audit Log · Queries"]
        Notifications["notifications/<br/>Discord Alerts"]
        Onboarding["onboarding/<br/>New Player Flow"]
    end

    Cycle --> League
    Cycle --> Tournament
    Cycle --> TagTeam
    Cycle --> TeamBattle
    Cycle --> KotH
    Cycle --> GrandMelee
    League --> Battle
    Tournament --> Battle
    TagTeam --> Battle
    TeamBattle --> Battle
    KotH --> Battle
    GrandMelee --> Battle
    Battle --> Arena
    Matchmaking --> League
    Matchmaking --> TeamBattle
    Matchmaking --> TagTeam
    Matchmaking --> KotH
```

## 3. Battle Cycle Flow (Daily Cron Schedule)

```mermaid
gantt
    title Daily Cron Schedule (UTC)
    dateFormat HH:mm
    axisFormat %H:%M

    section Battles
    1v1 League         :08:00, 30min
    2v2 League         :09:00, 30min
    1v1 Tournament     :10:00, 30min
    Tag Team           :11:00, 30min
    KotH               :13:00, 30min
    3v3 League         :14:00, 30min
    2v2 Tournament     :15:00, 30min
    Grand Melee        :17:00, 30min
    3v3 Tournament     :18:00, 30min

    section Settlement
    Settlement         :00:00, 30min
    Health Report      :00:30, 15min

    section Maintenance
    Battle Log Retention :01:30, 15min
    Database Backup      :02:00, 30min
```

## 4. Battle Execution Pipeline

```mermaid
flowchart TD
    A[Player Configures Robot] --> B[Subscribe via Booking Office]
    B --> C{Cron Trigger<br/>node-cron schedule}

    C --> D[Matchmaking]
    D --> D1[LP-Primary Scoring]
    D --> D2[Tier/Instance Scoping]
    D --> D3[Recent Opponent Avoidance]

    D1 & D2 & D3 --> E[Create Scheduled Match]

    E --> F[Load Robot Data<br/>Attributes · Weapons · Tuning]
    F --> G[Combat Simulator<br/>Tick-based · Deterministic]

    G --> H[Arena Subsystems]
    H --> H1[Movement AI]
    H --> H2[Threat Scoring]
    H --> H3[Range Bands]
    H --> H4[Position Tracking]
    H --> H5[Pressure System]

    G --> I[Battle Result]

    I --> J[Post-Combat Processing]
    J --> J1[updateRobotCombatStats]
    J --> J2[LP / ELO Updates]
    J --> J3[Fame & Prestige Awards]
    J --> J4[Streaming Revenue]
    J --> J5[Compute BattleSummary]
    J --> J6[Audit Log Entry]

    J1 & J2 & J3 & J4 & J5 & J6 --> K[Results Available to Player]
```

## 5. Authentication & Request Flow

```mermaid
sequenceDiagram
    participant Client as React SPA
    participant Caddy as Caddy Proxy
    participant RL as Rate Limiter
    participant Auth as Auth Middleware
    participant Val as Zod Validator
    participant Own as Ownership Check
    participant Svc as Service Layer
    participant DB as PostgreSQL

    Client->>Caddy: HTTPS Request
    Caddy->>RL: /api/* forward
    RL-->>Client: 429 (if exceeded)
    RL->>Auth: Pass through
    Auth-->>Client: 401 (invalid JWT)
    Auth->>Val: Token valid
    Val-->>Client: 400 (invalid input)
    Val->>Own: Schema valid
    Own-->>Client: 403 (not owner)
    Own->>Svc: Authorized
    Svc->>DB: Prisma Query
    DB-->>Svc: Result
    Svc-->>Client: JSON Response
```

## 6. Economy Flow

```mermaid
flowchart LR
    subgraph Income["Income Sources"]
        StreamRev["Streaming Revenue<br/>(per battle)"]
        PrizePool["Tournament Prizes"]
        LeagueReward["League Rewards"]
    end

    subgraph Wallet["Player Credits (₡)"]
        Balance["Current Balance"]
    end

    subgraph Spending["Spending (lockUserForSpending)"]
        WeaponBuy["Weapon Purchase"]
        FacUpgrade["Facility Upgrade"]
        RobotCreate["Robot Creation"]
        AttrUpgrade["Attribute Upgrade"]
        Repair["Robot Repair"]
    end

    Income --> Balance
    Balance --> Spending

    subgraph Guards["Transaction Guards"]
        CreditLock["Advisory Lock<br/>(serialized)"]
        ReRead["Re-read state<br/>(post-lock)"]
        Validate["Validate funds<br/>& prerequisites"]
    end

    Spending --> Guards --> DB["PostgreSQL<br/>(Interactive Tx)"]
```

## 7. Frontend Architecture

```mermaid
graph TB
    subgraph App["React 19 App"]
        Router["React Router 6"]
        ErrorBoundary["AppErrorBoundary"]
    end

    subgraph Guards["Route Guards"]
        Protected["ProtectedRoute<br/>(auth required)"]
        AdminGuard["AdminRoute<br/>(admin role)"]
    end

    subgraph State["State Management"]
        AuthCtx["AuthContext<br/>(login state)"]
        RobotStore["Zustand: robotStore"]
        StableStore["Zustand: stableStore"]
        AdminStore["Zustand: adminStore"]
        LocalState["Local Component State"]
    end

    subgraph Pages["Pages (~48)"]
        PlayerPages["28 Player Pages<br/>(Dashboard, Robots, Battles,<br/>Leagues, Economy, Social)"]
        AdminPages["20 Admin Pages<br/>(Lazy-loaded via AdminLayout)"]
    end

    subgraph Shared["app/shared/utils/"]
        Formulas["Game Formulas<br/>upgradeCosts · discounts<br/>repairCost · academyCaps<br/>battleStatistics"]
    end

    Router --> Guards
    Guards --> Pages
    Pages --> State
    Pages --> Shared
    PlayerPages --> RobotStore
    PlayerPages --> StableStore
    AdminPages --> AdminStore
    App --> AuthCtx
```

## 8. Data Model — Summary (Key Entities)

```mermaid
erDiagram
    User ||--o{ Robot : owns
    User ||--o{ Facility : owns
    User ||--o{ WeaponInventory : owns
    User ||--o{ TeamBattle : owns
    User ||--o{ UserAchievement : earned

    Robot ||--o{ BattleParticipant : fights_in
    Robot ||--o{ Subscription : subscribes
    Robot ||--o{ TuningAllocation : has
    Robot ||--o{ TeamBattleMember : member_of

    Battle ||--o{ BattleParticipant : contains
    Battle ||--|| BattleSummary : summarized_by

    TeamBattle ||--o{ TeamBattleMember : has_members
    TeamBattle }o--o{ Standing : ranked_in

    Standing {
        string entityType
        int entityId
        enum mode
        string tier
        int leaguePoints
    }

    ScheduledMatch ||--o{ ScheduledMatchParticipant : pairs
    ScheduledMatch {
        enum matchType
        string status
        datetime scheduledFor
    }

    FinancialLedger {
        int userId
        string transactionType
        int amount
        int balanceAfter
    }

    Tournament ||--o{ ScheduledMatch : has_rounds
```

## 9. Complete Database Model (All Entities)

### 9a. Player & Robot Domain

```mermaid
erDiagram
    User {
        int id PK
        string username UK
        string email UK
        string passwordHash
        string role
        int currency
        int prestige
        int championshipTitles
        int championshipTitles1v1
        int championshipTitles2v2
        int championshipTitles3v3
        string stableName UK
        string profileVisibility
        boolean notificationsBattle
        boolean notificationsLeague
        string themePreference
        int tokenVersion
        boolean hasCompletedOnboarding
        boolean onboardingSkipped
        int onboardingStep
        string onboardingStrategy
        json onboardingChoices
        datetime onboardingStartedAt
        datetime onboardingCompletedAt
        datetime lastSeenChangelog
        json pinnedAchievements
        int totalPracticeBattles
        datetime lastLoginAt
        datetime createdAt
        datetime updatedAt
    }

    Robot {
        int id PK
        int userId FK
        string name UK
        int frameId
        string paintJob
        decimal combatPower
        decimal targetingSystems
        decimal criticalSystems
        decimal penetration
        decimal weaponControl
        decimal attackSpeed
        decimal armorPlating
        decimal shieldCapacity
        decimal evasionThrusters
        decimal damageDampeners
        decimal counterProtocols
        decimal hullIntegrity
        decimal servoMotors
        decimal gyroStabilizers
        decimal hydraulicSystems
        decimal powerCore
        decimal combatAlgorithms
        decimal threatAnalysis
        decimal adaptiveAI
        decimal logicCores
        decimal syncProtocols
        decimal supportSystems
        decimal formationTactics
        int currentHP
        int maxHP
        int currentShield
        int maxShield
        int damageTaken
        int elo
        int totalBattles
        int wins
        int draws
        int losses
        int damageDealtLifetime
        int damageTakenLifetime
        int kills
        int fame
        string titles
        int offensiveWins
        int defensiveWins
        int balancedWins
        int dualWieldWins
        int grandMeleeWins
        int grandMeleeTop3
        int repairCost
        int battleReadiness
        int totalRepairsPaid
        int yieldThreshold
        string loadoutType
        string stance
        int mainWeaponId FK
        int offhandWeaponId FK
        string imageUrl
        datetime createdAt
        datetime updatedAt
    }

    Facility {
        int id PK
        int userId FK
        string facilityType
        int level
        int maxLevel
        string activeCoach
        datetime createdAt
        datetime updatedAt
    }

    TuningAllocation {
        int id PK
        int robotId FK_UK
        decimal combatPower
        decimal targetingSystems
        decimal criticalSystems
        decimal penetration
        decimal weaponControl
        decimal attackSpeed
        decimal armorPlating
        decimal shieldCapacity
        decimal evasionThrusters
        decimal damageDampeners
        decimal counterProtocols
        decimal hullIntegrity
        decimal servoMotors
        decimal gyroStabilizers
        decimal hydraulicSystems
        decimal powerCore
        decimal combatAlgorithms
        decimal threatAnalysis
        decimal adaptiveAI
        decimal logicCores
        decimal syncProtocols
        decimal supportSystems
        decimal formationTactics
        datetime createdAt
        datetime updatedAt
    }

    User ||--o{ Robot : "owns"
    User ||--o{ Facility : "owns"
    Robot ||--o| TuningAllocation : "has"
```

### 9b. Weapon Domain

```mermaid
erDiagram
    Weapon {
        int id PK
        string name
        string weaponType
        float baseDamage
        float cooldown
        int cost
        string handsRequired
        string damageType
        string loadoutType
        string specialProperty
        string description
        string rangeBand
        int combatPowerBonus
        int targetingSystemsBonus
        int criticalSystemsBonus
        int penetrationBonus
        int weaponControlBonus
        int attackSpeedBonus
        int armorPlatingBonus
        int shieldCapacityBonus
        int evasionThrustersBonus
        int damageDampenersBonus
        int counterProtocolsBonus
        int hullIntegrityBonus
        int servoMotorsBonus
        int gyroStabilizersBonus
        int hydraulicSystemsBonus
        int powerCoreBonus
        int combatAlgorithmsBonus
        int threatAnalysisBonus
        int adaptiveAIBonus
        int logicCoresBonus
        int syncProtocolsBonus
        int supportSystemsBonus
        int formationTacticsBonus
        datetime createdAt
    }

    WeaponInventory {
        int id PK
        int userId FK
        int weaponId FK
        string customName
        int pricePaid
        datetime purchasedAt
    }

    WeaponRefinement {
        int id PK
        int weaponInventoryId FK
        string tier
        int magnitude
        string targetAttribute
        int costPaid
        int slotIndex
        datetime createdAt
    }

    User ||--o{ WeaponInventory : "owns"
    Weapon ||--o{ WeaponInventory : "catalog_entry"
    WeaponInventory ||--o{ WeaponRefinement : "has_refinements"
    WeaponInventory ||--o{ Robot : "equipped_main"
    WeaponInventory ||--o{ Robot : "equipped_offhand"
```

### 9c. Battle Domain

```mermaid
erDiagram
    Battle {
        int id PK
        int winnerId
        string battleType
        string leagueType
        string leagueInstanceId
        int tournamentId FK
        int tournamentRound
        json battleLog "nullable - NULLed after 7d"
        int winningSide
        int durationSeconds
        int winnerReward
        int loserReward
        datetime createdAt
    }

    BattleParticipant {
        int id PK
        int battleId FK
        int robotId FK
        int team
        string role
        int placement
        int credits
        int streamingRevenue
        int eloBefore
        int eloAfter
        int prestigeAwarded
        int fameAwarded
        int damageDealt
        int finalHP
        boolean yielded
        boolean destroyed
        bigint tagOutTimeMs
        datetime createdAt
    }

    BattleSummary {
        int id PK
        int battleId FK_UK
        json perRobot
        json perTeam
        json damageFlows
        json participants
        json kothPlacements
        json kothData
        json startingPositions
        json endingPositions
        float arenaRadius
        int battleDuration
        int totalEvents
        boolean hasData
        datetime createdAt
    }

    Battle ||--o{ BattleParticipant : "has_participants"
    Battle ||--o| BattleSummary : "summarized_by"
    Robot ||--o{ BattleParticipant : "fights_in"
    Tournament ||--o{ Battle : "contains_battles"
```

### 9d. Scheduling Domain (Unified — Spec #40)

```mermaid
erDiagram
    ScheduledMatch {
        int id PK
        enum matchType "league_1v1|league_2v2|league_3v3|tag_team|koth|tournament_1v1|tournament_2v2|tournament_3v3|grand_melee"
        string status "scheduled|completed|cancelled|failed"
        datetime scheduledFor
        int battleId
        int tournamentId
        int round
        int matchNumber
        boolean isByeMatch
        string leagueType
        string leagueInstanceId
        int scoreThreshold
        int timeLimit
        int zoneRadius
        string cancelReason
        datetime createdAt
    }

    ScheduledMatchParticipant {
        int id PK
        int scheduledMatchId FK
        string participantType "robot|team"
        int participantId
        int slot
        datetime createdAt
    }

    ScheduledMatch ||--o{ ScheduledMatchParticipant : "has_participants"
```

### 9e. Tournament Domain

```mermaid
erDiagram
    Tournament {
        int id PK
        string name
        string tournamentType "single_elimination|double_elimination|swiss"
        string participantType "robot|team_2v2|team_3v3"
        string status "pending|active|completed"
        int currentRound
        int maxRounds
        int totalParticipants
        int winnerId
        datetime createdAt
        datetime startedAt
        datetime completedAt
    }

    ScheduledTournamentMatch {
        int id PK
        int tournamentId FK
        int round
        int matchNumber
        string participantType "robot|team_2v2|team_3v3"
        int participant1Id
        int participant2Id
        int winnerId
        int battleId FK_UK
        string status "pending|scheduled|completed"
        boolean isByeMatch
        datetime createdAt
        datetime completedAt
    }

    Tournament ||--o{ ScheduledTournamentMatch : "has_matches"
    Battle ||--o| ScheduledTournamentMatch : "resolved_by"
```

### 9f. Team Battle Domain

```mermaid
erDiagram
    TeamBattle {
        int id PK
        int stableId FK
        int teamSize "2 or 3"
        string teamName
        string eligibility "ELIGIBLE|INELIGIBLE"
        datetime createdAt
        datetime updatedAt
    }

    TeamBattleMember {
        int id PK
        int teamId FK
        int robotId FK
        int slotIndex
    }

    User ||--o{ TeamBattle : "owns"
    TeamBattle ||--o{ TeamBattleMember : "has_members"
    Robot ||--o{ TeamBattleMember : "part_of_team"
```

### 9g. Competitive Standings (Unified — Spec #40)

```mermaid
erDiagram
    Standing {
        int id PK
        string entityType "robot|team"
        int entityId
        enum mode "league_1v1|league_2v2|league_3v3|tag_team|koth|tournament_1v1|tournament_2v2|tournament_3v3|grand_melee"
        string tier "bronze|silver|gold|platinum|diamond|champion"
        string leagueInstanceId
        int leaguePoints
        int cyclesInTier
        int wins
        int losses
        int draws
        int currentWinStreak
        int bestWinStreak
        int currentLoseStreak
        int totalMatches "KotH only"
        int totalKills "KotH only"
        float totalZoneScore "KotH only"
        float totalZoneTime "KotH only"
        int bestPlacement "KotH only"
        datetime createdAt
        datetime updatedAt
    }

    LeagueHistory {
        int id PK
        string entityType "robot|tag_team"
        int entityId
        int userId FK
        string changeType "promotion|demotion"
        string mode
        string sourceTier
        string destinationTier
        string sourceLeagueId
        string destinationLeagueId
        int leaguePoints
        int cycleNumber
        datetime createdAt
    }

    Subscription {
        int id PK
        int robotId FK
        string eventType
        string status "active|pending"
        datetime createdAt
    }

    Robot ||--o{ Subscription : "subscribes_to"
    User ||--o{ LeagueHistory : "history"
```

### 9h. Economy & Analytics Domain

```mermaid
erDiagram
    FinancialLedger {
        int id PK
        int cycleNumber
        int userId
        int robotId
        string transactionType
        int amount "signed: +credit -debit"
        int balanceAfter
        string description
        json metadata
        datetime createdAt
    }

    LeaderboardCache {
        int id PK
        string category "fame|prestige|losses|koth_wins|koth_zone_score|career_wins|team_wins"
        int rank
        string entityType "robot|user"
        int entityId
        float score
        int generation "swap semantics"
        datetime updatedAt
    }
```

### 9i. Cycle & Audit Domain

```mermaid
erDiagram
    CycleMetadata {
        int id PK "singleton id=1"
        int totalCycles
        datetime lastCycleAt
        json featureFlags
        datetime createdAt
        datetime updatedAt
    }

    AuditLog {
        bigint id PK
        int cycleNumber
        string eventType
        datetime eventTimestamp
        int sequenceNumber
        int userId
        int robotId
        int battleId
        json payload
        json metadata
    }

    CycleSnapshot {
        int id PK
        int cycleNumber UK
        string triggerType "manual|scheduled"
        datetime startTime
        datetime endTime
        int durationMs
        json stableMetrics
        json robotMetrics
        json stepDurations
        int totalBattles
        bigint totalCreditsTransacted
        int totalPrestigeAwarded
        datetime createdAt
    }
```

### 9j. Supporting Models

```mermaid
erDiagram
    UserAchievement {
        int id PK
        int userId FK
        string achievementId
        int robotId FK
        datetime unlockedAt
    }

    ChangelogEntry {
        int id PK
        string title
        string body
        string category "balance|feature|bugfix|economy"
        string status "draft|published"
        string imageUrl
        datetime publishDate
        int createdBy
        datetime createdAt
        datetime updatedAt
    }

    AdminAuditLog {
        int id PK
        int adminUserId
        string operationType
        string operationResult
        json resultSummary
        datetime createdAt
    }

    ResetLog {
        int id PK
        int userId
        int robotsDeleted
        int weaponsDeleted
        int facilitiesDeleted
        decimal creditsBeforeReset
        string reason
        datetime resetAt
    }

    PracticeArenaDailyStats {
        int id PK
        date date UK
        int totalBattles
        int uniquePlayers
        int rateLimitHits
        json playerIds
        datetime createdAt
    }

    User ||--o{ UserAchievement : "earned"
    Robot ||--o{ UserAchievement : "triggered_by"
```

### 9k. Full Relationship Map (All FK Connections)

```mermaid
erDiagram
    User ||--o{ Robot : "owns"
    User ||--o{ Facility : "owns (unique per type)"
    User ||--o{ WeaponInventory : "owns"
    User ||--o{ TeamBattle : "owns (stable)"
    User ||--o{ UserAchievement : "earned"
    User ||--o{ LeagueHistory : "history"

    Robot ||--o| TuningAllocation : "has (1:1)"
    Robot ||--o{ BattleParticipant : "fights_in"
    Robot ||--o{ TeamBattleMember : "member_of"
    Robot ||--o{ Subscription : "subscribes"
    Robot ||--o{ UserAchievement : "triggered_by"
    Robot }o--o| WeaponInventory : "main_weapon"
    Robot }o--o| WeaponInventory : "offhand_weapon"

    Weapon ||--o{ WeaponInventory : "catalog"
    WeaponInventory ||--o{ WeaponRefinement : "refinements (max 5)"

    TeamBattle ||--o{ TeamBattleMember : "members (2-3)"

    Battle ||--o{ BattleParticipant : "participants"
    Battle ||--o| BattleSummary : "summary (permanent)"
    Battle }o--o| Tournament : "tournament_battle"

    Tournament ||--o{ ScheduledTournamentMatch : "bracket"
    ScheduledTournamentMatch }o--o| Battle : "result"

    ScheduledMatch ||--o{ ScheduledMatchParticipant : "pairings"
```

## 10. Deployment Pipeline

```mermaid
flowchart LR
    Dev["Developer<br/>Local Dev"] -->|push| GH["GitHub<br/>main branch"]
    GH -->|auto| CI["GitHub Actions<br/>CI (lint + test)"]
    CI -->|auto| ACC["ACC Server<br/>(auto-deploy)"]
    ACC -->|manual trigger| PRD["Production VPS<br/>(manual promote)"]

    subgraph VPS["Scaleway DEV1-S"]
        direction TB
        UFW["UFW Firewall"] --> CaddyD["Caddy"]
        CaddyD --> PM2D["PM2"]
        PM2D --> NodeApp["Node.js App"]
        NodeApp --> PGD["PostgreSQL 17"]
        Cron["System Cron"] -->|02:00 UTC| Backup["pg_dump Backup"]
    end

    PRD --> VPS
```

## 11. Monitoring & Alerting

```mermaid
flowchart TB
    subgraph Probes["External Probes"]
        UR["UptimeRobot<br/>(HTTP checks)"]
    end

    subgraph App["Application"]
        Health["/api/health endpoint"]
        SecMon["Security Monitor<br/>(rate limits, auth failures)"]
        CycleMon["Cycle Performance<br/>Monitor"]
        DiskCheck["Disk Usage Check<br/>(15-min cooldown alerts)"]
    end

    subgraph Alerts["Discord Webhooks"]
        DiskAlert["🚨 Disk Critical"]
        StartupFail["❌ Startup Self-Test Failed"]
        BackupFail["⚠️ Backup Failed"]
        DailyReport["📊 Daily Health Report"]
    end

    UR --> Health
    Health --> DiskCheck
    DiskCheck -->|>85%| DiskAlert
    App -->|startup failure| StartupFail
    App -->|backup cron fail| BackupFail
    CycleMon -->|daily 00:30| DailyReport
```
