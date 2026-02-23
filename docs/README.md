# Armoured Souls Documentation

Welcome to the Armoured Souls documentation. This folder contains all project documentation organized by category.

## Quick Start

**New to the project?** Start here:
1. Read `ROADMAP.md` for project overview and current status
2. Check `guides/SETUP.md` for development environment setup
3. Review `prd_core/ARCHITECTURE.md` for system architecture
4. Explore `design_ux/DESIGN_SYSTEM_README.md` for design guidelines

**Looking for something specific?** Use the directory below.

## Documentation Directory

### 📋 Project Planning
- **[ROADMAP.md](ROADMAP.md)** - Complete development roadmap, current progress, and future phases
- **[PLAYER_ARCHETYPES_GUIDE.md](PLAYER_ARCHETYPES_GUIDE.md)** - Comprehensive player strategy guide with 10 playstyle archetypes

### 🎯 Core Specifications
- **[prd_core/](prd_core/)** - Product Requirements Documents for core systems
  - Architecture, database schema, battle engine
  - Economy, weapons, attributes, facilities
  - Matchmaking, leagues, cycles, progression
  - Combat formulas and calculations

### 🖥️ Page Specifications
- **[prd_pages/](prd_pages/)** - PRDs for individual pages and UI features
  - Login, dashboard, robots, facilities
  - Battle history, league standings, weapon shop
  - Admin panel and management tools

### 🎨 Design & UX
- **[design_ux/](design_ux/)** - Complete design system documentation
  - Brand foundations and logo system
  - Typography, colors, motion design
  - Component patterns and page designs
  - Navigation architecture

### 📚 Guides
- **[guides/](guides/)** - Operational guides and best practices
  - Setup and configuration
  - Testing strategy and state
  - Security guidelines
  - Admin panel usage
  - Module structure and portability

### 🔧 Implementation
- **[implementation_notes/](implementation_notes/)** - Feature implementation summaries
  - Cycle system changes
  - League system updates
  - Robot features (unique names, repair costs)
  - User features (at-risk detection)

### 📊 Analysis
- **[analysis/](analysis/)** - Economic and navigation analysis
  - Facilities economics and consolidation
  - Merchandising hub migration
  - Streaming studio analysis
  - Navigation reorganization
  - Investment improvements

### 🗄️ Migrations
- **[migrations/](migrations/)** - Database migration documentation
  - Battle table migration status
  - BattleParticipant migration
  - Cleanup completion notes

### 🐛 Troubleshooting
- **[troubleshooting/](troubleshooting/)** - Debugging and problem-solving
  - Cycle debugging summaries
  - Verification guides
  - Compilation error tracking
  - Database design questions
  - Schema audit results

### ⚖️ Balance Changes
- **[balance_changes/](balance_changes/)** - Game balance adjustments
  - Weapon economy overhaul
  - Weapon control implementation
  - Balance implementation options

## Documentation Types

### PRDs (Product Requirements Documents)
Formal specifications for features and systems. Include executive summary, architecture, technical details, formulas, and implementation requirements.

**Location**: `prd_core/` and `prd_pages/`

### Guides
Practical, actionable instructions for developers. Cover setup, testing, security, and operations.

**Location**: `guides/`

### Analysis
Economic analysis, navigation studies, and feature evaluations. Support decision-making and planning.

**Location**: `analysis/`

### Implementation Notes
Historical records of what was built and how. Document feature completion and system changes.

**Location**: `implementation_notes/`

### Design Documentation
Visual specifications, brand guidelines, and UX patterns. Define the look and feel of the application.

**Location**: `design_ux/`

## Finding What You Need

### I want to understand...
- **The overall project**: Read `ROADMAP.md`
- **How to set up development**: See `guides/SETUP.md`
- **System architecture**: Check `prd_core/ARCHITECTURE.md`
- **Database structure**: Review `prd_core/DATABASE_SCHEMA.md`
- **How battles work**: Read `prd_core/COMBAT_FORMULAS.md`
- **The economy**: See `prd_core/PRD_ECONOMY_SYSTEM.md`
- **Design system**: Explore `design_ux/DESIGN_SYSTEM_README.md`

### I need to implement...
- **A new page**: Check `prd_pages/` for similar pages
- **A core feature**: Review relevant PRD in `prd_core/`
- **UI components**: Follow `design_ux/DESIGN_SYSTEM_QUICK_REFERENCE.md`
- **Tests**: Read `guides/TESTING_STRATEGY.md`

### I'm debugging...
- **Cycle issues**: See `troubleshooting/DEBUGGING_CYCLE_SUMMARY.md`
- **Database problems**: Check `troubleshooting/DATABASE_DESIGN_QUESTIONS.md`
- **Compilation errors**: Review `troubleshooting/COMPILATION_ERRORS_TO_FIX.md`

### I'm planning...
- **Economic changes**: Review `analysis/` folder
- **Balance adjustments**: Check `balance_changes/` folder
- **New features**: Read relevant PRDs and `ROADMAP.md`

## Contributing to Documentation

When adding or updating documentation:

1. **Choose the right folder** based on document type
2. **Follow existing structure** within that folder
3. **Update the folder's README** if adding new categories
4. **Cross-reference** related documents
5. **Keep PRDs formal**, guides practical, and analysis data-driven

## Documentation Standards

### PRDs Should Include
- Executive summary
- Background and context
- Technical specifications
- Implementation details
- Testing requirements
- Related systems
- Future enhancements

### Guides Should Include
- Clear step-by-step instructions
- Prerequisites and requirements
- Examples and code snippets
- Common pitfalls and solutions
- Related resources

### Analysis Should Include
- Problem statement
- Data and calculations
- Options considered
- Recommendations
- Implementation impact

## Questions?

If you can't find what you're looking for:
1. Check the folder READMEs for detailed contents
2. Search for keywords across documentation
3. Review `ROADMAP.md` for project context
4. Ask the team for guidance
