# Armoured Souls - Architecture Overview

## System Architecture

### High-Level Design

Armoured Souls follows a modular, microservices-inspired architecture designed for scalability, security, and portability.

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Layer                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Web Client  │  │  iOS Client  │  │Android Client│     │
│  │  (React)     │  │  (Swift)     │  │  (Kotlin)    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            │
                   ┌────────▼─────────┐
                   │   API Gateway    │
                   │  (Load Balancer) │
                   └────────┬─────────┘
                            │
┌─────────────────────────────────────────────────────────────┐
│                   Application Layer                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │   Auth   │  │   Game   │  │  Player  │  │  Battle  │   │
│  │  Service │  │  Service │  │  Service │  │  Service │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────────┐
│                     Data Layer                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  PostgreSQL  │  │    Redis     │  │   S3/Blob    │     │
│  │  (Primary)   │  │   (Cache)    │  │   Storage    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

## Core Architectural Principles

### 1. Separation of Concerns
- **Authentication Layer**: Handles all user authentication and authorization
- **Game Logic Layer**: Contains core game mechanics and rules
- **Data Layer**: Manages persistence and caching
- **Presentation Layer**: Client-specific UI implementations

### 2. Stateless Services
- Services should be stateless to enable horizontal scaling
- Session state managed in Redis for quick access
- Persistent state in PostgreSQL for reliability

### 3. API-First Design
- RESTful API as the primary interface
- WebSocket support for real-time features (battles, chat)
- GraphQL consideration for complex data queries

### 4. Security by Design
- All communication over HTTPS/WSS
- JWT-based authentication
- Rate limiting on all endpoints
- Input validation at all layers
- Principle of least privilege
- Regular security audits

### 5. Test-Driven Development
- Unit tests for all business logic
- Integration tests for API endpoints
- End-to-end tests for critical user flows
- Load testing for scalability validation

## Technology Stack (Selected)

### Backend
- **Language**: Node.js with TypeScript (best for web-to-mobile code sharing)
- **Framework**: Express or Fastify (TBD based on performance needs)
- **Database**: PostgreSQL (primary), Redis (cache and sessions)
- **Authentication**: JWT, OAuth 2.0 (Google, Facebook, Apple)
- **API Documentation**: OpenAPI/Swagger
- **Hosting**: AWS with serverless architecture where possible

### Frontend
- **Web**: React + TypeScript
- **Mobile**: React Native (70-80% code reuse from web)
- **State Management**: Redux Toolkit or Zustand
- **UI Library**: Material-UI or Tailwind CSS (TBD)

### DevOps
- **CI/CD**: GitHub Actions
- **Container**: Docker
- **Hosting**: AWS (managed services preferred)
- **Serverless**: Lambda, API Gateway, DynamoDB where applicable
- **Monitoring**: AWS CloudWatch, Prometheus + Grafana
- **Logging**: CloudWatch Logs or ELK Stack

### Testing
- **Unit**: Jest/Vitest
- **E2E**: Playwright/Cypress
- **Load**: k6 or Apache JMeter
- **Security**: OWASP ZAP, Snyk

## Key Design Decisions (Finalized)

1. **Backend Language**: ✅ Node.js with TypeScript (enables React Native code sharing)
2. **Database**: ✅ PostgreSQL (relational data) + Redis (caching, sessions)
3. **Real-time**: ❌ Not needed (scheduled batch battle processing)
4. **Mobile Strategy**: ✅ React Native after web MVP (iOS first, then Android)
5. **Hosting**: ✅ AWS with serverless architecture, scale-to-zero capability
6. **Game Engine**: ✅ Custom server-side simulation engine (deterministic, batch processing)

## Development Approach

### Local Development First
- Initial development on local machine (laptop)
- Test with small group of friends
- No immediate hosting contract required
- Docker for local database and services

### Migration Path to Cloud
1. **Phase 1**: Local development with Docker Compose
2. **Phase 2**: Deploy to AWS (single region, minimal services)
3. **Phase 3**: Scale horizontally as user base grows
4. **Phase 4**: Add redundancy and multi-region support

## Scalability Considerations

### Horizontal Scaling
- Stateless services behind load balancer
- Database read replicas
- Caching layer for frequently accessed data

### Performance Optimization
- CDN for static assets
- Database indexing strategy
- Lazy loading for large datasets
- Pagination for list endpoints

### Data Partitioning
- Shard by user ID or region
- Separate read/write databases
- Archive old data

## Security Architecture

### Authentication Flow
1. User credentials → Auth Service
2. Validate credentials against database
3. Generate JWT with limited lifetime
4. Return token + refresh token
5. Client includes JWT in subsequent requests
6. Services validate JWT signature and claims

### Authorization
- Role-Based Access Control (RBAC)
- Resource-level permissions
- API key management for third-party integrations

### Data Protection
- Encryption at rest (database)
- Encryption in transit (TLS)
- PII data handling compliance (GDPR, CCPA)
- Regular backups with encryption

## Battle Simulation Architecture

### Scheduled Battle Processing

Armoured Souls uses a **scheduled batch processing** model for battles, inspired by Football Manager mechanics.

```
┌─────────────────────────────────────────────────────────────┐
│                    Battle Flow                               │
│                                                              │
│  1. Player Configuration Phase (Continuous)                  │
│     ├─ Players set up robots                                │
│     ├─ Select weapons and strategies                        │
│     ├─ Configure conditional triggers                       │
│     └─ Join matchmaking queues                              │
│                                                              │
│  2. Battle Scheduling (Automated)                           │
│     ├─ Matchmaking pairs players                            │
│     ├─ Schedule battles for next processing window          │
│     └─ Lock configurations before processing                │
│                                                              │
│  3. Batch Processing (Scheduled Times)                      │
│     ├─ Server processes all scheduled battles               │
│     ├─ Simulation engine runs deterministically             │
│     ├─ Generate battle logs and replays                     │
│     └─ Calculate rewards and stats                          │
│                                                              │
│  4. Results Distribution (Immediate after processing)       │
│     ├─ Update player rankings and stats                     │
│     ├─ Notify players of results                            │
│     ├─ Make replays available                               │
│     └─ Distribute rewards                                   │
│                                                              │
│  5. Next Cycle Begins                                       │
└─────────────────────────────────────────────────────────────┘
```

### Battle Simulation Engine

**Server-Authoritative**:
- All battle logic runs on server
- Client never computes battle outcomes
- Prevents cheating and ensures consistency

**Deterministic**:
- Same inputs always produce same outputs
- Enables accurate replay generation
- Supports debugging and balance testing

**Batch Processing**:
- Process thousands of battles simultaneously
- Scheduled at fixed times (e.g., daily at 8 PM, multiple times per day)
- Optimized for throughput over latency

**Input Variables**:
- Robot statistics (attack, defense, speed, armor, health)
- Weapon configurations
- Strategic settings
- Conditional triggers (future feature)

**Output**:
- Complete battle log
- Replay data
- Winner determination
- Statistics (damage dealt/received, actions taken)
- Rewards (currency, fame, experience)

### Processing Schedule Examples

**Casual Schedule** (1-2 times per day):
- Morning processing: 8:00 AM server time
- Evening processing: 8:00 PM server time

**Active Schedule** (4-6 times per day):
- Every 4-6 hours around the clock
- Allows players in different timezones to participate

**Tournament Schedule**:
- Custom schedules for multi-day tournaments
- Round progression with defined intervals

## Monitoring & Observability

### Metrics
- Request rate, latency, error rate
- Database query performance
- Cache hit/miss ratio
- Active users, concurrent connections

### Logging
- Structured logging (JSON)
- Log aggregation and search
- Error tracking and alerting

### Tracing
- Distributed tracing for request flows
- Performance bottleneck identification

## Future Considerations

- **Global Distribution**: CDN, regional databases
- **AI/ML Integration**: Matchmaking, bot opponents
- **Social Features**: Guilds, chat, leaderboards
- **Monetization**: In-app purchases, subscriptions
- **Analytics**: Player behavior, game balance metrics