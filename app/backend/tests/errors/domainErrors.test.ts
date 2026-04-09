/**
 * Unit tests for all domain error classes
 *
 * Tests cover for each domain error class:
 * 1. Inheritance from AppError (instanceof AppError returns true)
 * 2. Inheritance from Error (instanceof Error returns true)
 * 3. Correct `name` property (e.g., 'AuthError', 'RobotError', etc.)
 * 4. Error code validation (using the domain's error code enum)
 * 5. Constructor sets all properties correctly
 *
 * @module tests/errors/domainErrors
 */

import { AppError } from '../../src/errors/AppError';
import { AuthError, AuthErrorCode } from '../../src/errors/authErrors';
import { RobotError, RobotErrorCode } from '../../src/errors/robotErrors';
import { BattleError, BattleErrorCode } from '../../src/errors/battleErrors';
import { EconomyError, EconomyErrorCode } from '../../src/errors/economyErrors';
import { LeagueError, LeagueErrorCode } from '../../src/errors/leagueErrors';
import { TournamentError, TournamentErrorCode } from '../../src/errors/tournamentErrors';
import { TagTeamError, TagTeamErrorCode } from '../../src/errors/tagTeamErrors';
import { KothError, KothErrorCode } from '../../src/errors/kothErrors';
import { OnboardingError, OnboardingErrorCode } from '../../src/errors/onboardingErrors';

describe('AuthError', () => {
  describe('inheritance', () => {
    test('should be instanceof AppError', () => {
      const error = new AuthError(AuthErrorCode.INVALID_CREDENTIALS, 'Invalid credentials');
      expect(error instanceof AppError).toBe(true);
    });

    test('should be instanceof Error', () => {
      const error = new AuthError(AuthErrorCode.INVALID_CREDENTIALS, 'Invalid credentials');
      expect(error instanceof Error).toBe(true);
    });
  });

  describe('name property', () => {
    test('should have name set to AuthError', () => {
      const error = new AuthError(AuthErrorCode.INVALID_CREDENTIALS, 'Invalid credentials');
      expect(error.name).toBe('AuthError');
    });
  });

  describe('error code validation', () => {
    test.each(Object.values(AuthErrorCode))('should accept valid error code: %s', (code) => {
      const error = new AuthError(code, `Error with code ${code}`);
      expect(error.code).toBe(code);
    });
  });

  describe('constructor', () => {
    test('should set all properties correctly', () => {
      const code = AuthErrorCode.USER_NOT_FOUND;
      const message = 'User not found';
      const statusCode = 404;
      const details = { userId: 123 };

      const error = new AuthError(code, message, statusCode, details);

      expect(error.code).toBe(code);
      expect(error.message).toBe(message);
      expect(error.statusCode).toBe(statusCode);
      expect(error.details).toEqual(details);
    });

    test('should default statusCode to 400', () => {
      const error = new AuthError(AuthErrorCode.INVALID_TOKEN, 'Invalid token');
      expect(error.statusCode).toBe(400);
    });
  });
});

describe('RobotError', () => {
  describe('inheritance', () => {
    test('should be instanceof AppError', () => {
      const error = new RobotError(RobotErrorCode.ROBOT_NOT_FOUND, 'Robot not found');
      expect(error instanceof AppError).toBe(true);
    });

    test('should be instanceof Error', () => {
      const error = new RobotError(RobotErrorCode.ROBOT_NOT_FOUND, 'Robot not found');
      expect(error instanceof Error).toBe(true);
    });
  });

  describe('name property', () => {
    test('should have name set to RobotError', () => {
      const error = new RobotError(RobotErrorCode.ROBOT_NOT_FOUND, 'Robot not found');
      expect(error.name).toBe('RobotError');
    });
  });

  describe('error code validation', () => {
    test.each(Object.values(RobotErrorCode))('should accept valid error code: %s', (code) => {
      const error = new RobotError(code, `Error with code ${code}`);
      expect(error.code).toBe(code);
    });
  });

  describe('constructor', () => {
    test('should set all properties correctly', () => {
      const code = RobotErrorCode.ROBOT_NOT_OWNED;
      const message = 'Robot not owned by user';
      const statusCode = 403;
      const details = { robotId: 456, ownerId: 789 };

      const error = new RobotError(code, message, statusCode, details);

      expect(error.code).toBe(code);
      expect(error.message).toBe(message);
      expect(error.statusCode).toBe(statusCode);
      expect(error.details).toEqual(details);
    });

    test('should default statusCode to 400', () => {
      const error = new RobotError(RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, 'Invalid attributes');
      expect(error.statusCode).toBe(400);
    });
  });
});

describe('BattleError', () => {
  describe('inheritance', () => {
    test('should be instanceof AppError', () => {
      const error = new BattleError(BattleErrorCode.BATTLE_NOT_FOUND, 'Battle not found');
      expect(error instanceof AppError).toBe(true);
    });

    test('should be instanceof Error', () => {
      const error = new BattleError(BattleErrorCode.BATTLE_NOT_FOUND, 'Battle not found');
      expect(error instanceof Error).toBe(true);
    });
  });

  describe('name property', () => {
    test('should have name set to BattleError', () => {
      const error = new BattleError(BattleErrorCode.BATTLE_NOT_FOUND, 'Battle not found');
      expect(error.name).toBe('BattleError');
    });
  });

  describe('error code validation', () => {
    test.each(Object.values(BattleErrorCode))('should accept valid error code: %s', (code) => {
      const error = new BattleError(code, `Error with code ${code}`);
      expect(error.code).toBe(code);
    });
  });

  describe('constructor', () => {
    test('should set all properties correctly', () => {
      const code = BattleErrorCode.BATTLE_SIMULATION_FAILED;
      const message = 'Battle simulation failed';
      const statusCode = 500;
      const details = { battleId: 'battle-123', reason: 'timeout' };

      const error = new BattleError(code, message, statusCode, details);

      expect(error.code).toBe(code);
      expect(error.message).toBe(message);
      expect(error.statusCode).toBe(statusCode);
      expect(error.details).toEqual(details);
    });

    test('should default statusCode to 400', () => {
      const error = new BattleError(BattleErrorCode.INVALID_BATTLE_STATE, 'Invalid state');
      expect(error.statusCode).toBe(400);
    });
  });
});

describe('EconomyError', () => {
  describe('inheritance', () => {
    test('should be instanceof AppError', () => {
      const error = new EconomyError(EconomyErrorCode.INSUFFICIENT_CREDITS, 'Insufficient credits');
      expect(error instanceof AppError).toBe(true);
    });

    test('should be instanceof Error', () => {
      const error = new EconomyError(EconomyErrorCode.INSUFFICIENT_CREDITS, 'Insufficient credits');
      expect(error instanceof Error).toBe(true);
    });
  });

  describe('name property', () => {
    test('should have name set to EconomyError', () => {
      const error = new EconomyError(EconomyErrorCode.INSUFFICIENT_CREDITS, 'Insufficient credits');
      expect(error.name).toBe('EconomyError');
    });
  });

  describe('error code validation', () => {
    test.each(Object.values(EconomyErrorCode))('should accept valid error code: %s', (code) => {
      const error = new EconomyError(code, `Error with code ${code}`);
      expect(error.code).toBe(code);
    });
  });

  describe('constructor', () => {
    test('should set all properties correctly', () => {
      const code = EconomyErrorCode.WEAPON_NOT_AFFORDABLE;
      const message = 'Cannot afford weapon';
      const statusCode = 402;
      const details = { weaponId: 'wpn-1', cost: 5000, balance: 1000 };

      const error = new EconomyError(code, message, statusCode, details);

      expect(error.code).toBe(code);
      expect(error.message).toBe(message);
      expect(error.statusCode).toBe(statusCode);
      expect(error.details).toEqual(details);
    });

    test('should default statusCode to 400', () => {
      const error = new EconomyError(EconomyErrorCode.INVALID_TRANSACTION, 'Invalid transaction');
      expect(error.statusCode).toBe(400);
    });
  });
});

describe('LeagueError', () => {
  describe('inheritance', () => {
    test('should be instanceof AppError', () => {
      const error = new LeagueError(LeagueErrorCode.LEAGUE_NOT_FOUND, 'League not found');
      expect(error instanceof AppError).toBe(true);
    });

    test('should be instanceof Error', () => {
      const error = new LeagueError(LeagueErrorCode.LEAGUE_NOT_FOUND, 'League not found');
      expect(error instanceof Error).toBe(true);
    });
  });

  describe('name property', () => {
    test('should have name set to LeagueError', () => {
      const error = new LeagueError(LeagueErrorCode.LEAGUE_NOT_FOUND, 'League not found');
      expect(error.name).toBe('LeagueError');
    });
  });

  describe('error code validation', () => {
    test.each(Object.values(LeagueErrorCode))('should accept valid error code: %s', (code) => {
      const error = new LeagueError(code, `Error with code ${code}`);
      expect(error.code).toBe(code);
    });
  });

  describe('constructor', () => {
    test('should set all properties correctly', () => {
      const code = LeagueErrorCode.PROMOTION_BLOCKED;
      const message = 'Promotion blocked';
      const statusCode = 409;
      const details = { robotId: 'robot-1', currentTier: 3 };

      const error = new LeagueError(code, message, statusCode, details);

      expect(error.code).toBe(code);
      expect(error.message).toBe(message);
      expect(error.statusCode).toBe(statusCode);
      expect(error.details).toEqual(details);
    });

    test('should default statusCode to 400', () => {
      const error = new LeagueError(LeagueErrorCode.INVALID_LEAGUE_TIER, 'Invalid tier');
      expect(error.statusCode).toBe(400);
    });
  });
});


describe('TournamentError', () => {
  describe('inheritance', () => {
    test('should be instanceof AppError', () => {
      const error = new TournamentError(TournamentErrorCode.TOURNAMENT_NOT_FOUND, 'Tournament not found');
      expect(error instanceof AppError).toBe(true);
    });

    test('should be instanceof Error', () => {
      const error = new TournamentError(TournamentErrorCode.TOURNAMENT_NOT_FOUND, 'Tournament not found');
      expect(error instanceof Error).toBe(true);
    });
  });

  describe('name property', () => {
    test('should have name set to TournamentError', () => {
      const error = new TournamentError(TournamentErrorCode.TOURNAMENT_NOT_FOUND, 'Tournament not found');
      expect(error.name).toBe('TournamentError');
    });
  });

  describe('error code validation', () => {
    test.each(Object.values(TournamentErrorCode))('should accept valid error code: %s', (code) => {
      const error = new TournamentError(code, `Error with code ${code}`);
      expect(error.code).toBe(code);
    });
  });

  describe('constructor', () => {
    test('should set all properties correctly', () => {
      const code = TournamentErrorCode.INSUFFICIENT_PARTICIPANTS;
      const message = 'Not enough participants';
      const statusCode = 400;
      const details = { tournamentId: 'tourn-1', required: 8, actual: 3 };

      const error = new TournamentError(code, message, statusCode, details);

      expect(error.code).toBe(code);
      expect(error.message).toBe(message);
      expect(error.statusCode).toBe(statusCode);
      expect(error.details).toEqual(details);
    });

    test('should default statusCode to 400', () => {
      const error = new TournamentError(TournamentErrorCode.ROUND_NOT_READY, 'Round not ready');
      expect(error.statusCode).toBe(400);
    });
  });
});

describe('TagTeamError', () => {
  describe('inheritance', () => {
    test('should be instanceof AppError', () => {
      const error = new TagTeamError(TagTeamErrorCode.TAG_TEAM_NOT_FOUND, 'Tag team not found');
      expect(error instanceof AppError).toBe(true);
    });

    test('should be instanceof Error', () => {
      const error = new TagTeamError(TagTeamErrorCode.TAG_TEAM_NOT_FOUND, 'Tag team not found');
      expect(error instanceof Error).toBe(true);
    });
  });

  describe('name property', () => {
    test('should have name set to TagTeamError', () => {
      const error = new TagTeamError(TagTeamErrorCode.TAG_TEAM_NOT_FOUND, 'Tag team not found');
      expect(error.name).toBe('TagTeamError');
    });
  });

  describe('error code validation', () => {
    test.each(Object.values(TagTeamErrorCode))('should accept valid error code: %s', (code) => {
      const error = new TagTeamError(code, `Error with code ${code}`);
      expect(error.code).toBe(code);
    });
  });

  describe('constructor', () => {
    test('should set all properties correctly', () => {
      const code = TagTeamErrorCode.INVALID_TEAM_COMPOSITION;
      const message = 'Invalid team composition';
      const statusCode = 400;
      const details = { teamId: 'team-1', robotCount: 1, required: 2 };

      const error = new TagTeamError(code, message, statusCode, details);

      expect(error.code).toBe(code);
      expect(error.message).toBe(message);
      expect(error.statusCode).toBe(statusCode);
      expect(error.details).toEqual(details);
    });

    test('should default statusCode to 400', () => {
      const error = new TagTeamError(TagTeamErrorCode.TEAM_NOT_ELIGIBLE, 'Team not eligible');
      expect(error.statusCode).toBe(400);
    });
  });
});

describe('KothError', () => {
  describe('inheritance', () => {
    test('should be instanceof AppError', () => {
      const error = new KothError(KothErrorCode.KOTH_NOT_FOUND, 'KotH not found');
      expect(error instanceof AppError).toBe(true);
    });

    test('should be instanceof Error', () => {
      const error = new KothError(KothErrorCode.KOTH_NOT_FOUND, 'KotH not found');
      expect(error instanceof Error).toBe(true);
    });
  });

  describe('name property', () => {
    test('should have name set to KothError', () => {
      const error = new KothError(KothErrorCode.KOTH_NOT_FOUND, 'KotH not found');
      expect(error.name).toBe('KothError');
    });
  });

  describe('error code validation', () => {
    test.each(Object.values(KothErrorCode))('should accept valid error code: %s', (code) => {
      const error = new KothError(code, `Error with code ${code}`);
      expect(error.code).toBe(code);
    });
  });

  describe('constructor', () => {
    test('should set all properties correctly', () => {
      const code = KothErrorCode.INSUFFICIENT_KOTH_PARTICIPANTS;
      const message = 'Not enough KotH participants';
      const statusCode = 400;
      const details = { kothId: 'koth-1', required: 4, actual: 2 };

      const error = new KothError(code, message, statusCode, details);

      expect(error.code).toBe(code);
      expect(error.message).toBe(message);
      expect(error.statusCode).toBe(statusCode);
      expect(error.details).toEqual(details);
    });

    test('should default statusCode to 400', () => {
      const error = new KothError(KothErrorCode.INVALID_KOTH_STATE, 'Invalid KotH state');
      expect(error.statusCode).toBe(400);
    });
  });
});

describe('OnboardingError', () => {
  describe('inheritance', () => {
    test('should be instanceof AppError', () => {
      const error = new OnboardingError(OnboardingErrorCode.TUTORIAL_STATE_NOT_FOUND, 'Tutorial state not found');
      expect(error instanceof AppError).toBe(true);
    });

    test('should be instanceof Error', () => {
      const error = new OnboardingError(OnboardingErrorCode.TUTORIAL_STATE_NOT_FOUND, 'Tutorial state not found');
      expect(error instanceof Error).toBe(true);
    });
  });

  describe('name property', () => {
    test('should have name set to OnboardingError', () => {
      const error = new OnboardingError(OnboardingErrorCode.TUTORIAL_STATE_NOT_FOUND, 'Tutorial state not found');
      expect(error.name).toBe('OnboardingError');
    });
  });

  describe('error code validation', () => {
    test.each(Object.values(OnboardingErrorCode))('should accept valid error code: %s', (code) => {
      const error = new OnboardingError(code, `Error with code ${code}`);
      expect(error.code).toBe(code);
    });
  });

  describe('constructor', () => {
    test('should set all properties correctly', () => {
      const code = OnboardingErrorCode.INVALID_STEP_TRANSITION;
      const message = 'Invalid step transition';
      const statusCode = 400;
      const details = { currentStep: 2, targetStep: 5 };

      const error = new OnboardingError(code, message, statusCode, details);

      expect(error.code).toBe(code);
      expect(error.message).toBe(message);
      expect(error.statusCode).toBe(statusCode);
      expect(error.details).toEqual(details);
    });

    test('should default statusCode to 400', () => {
      const error = new OnboardingError(OnboardingErrorCode.INVALID_STRATEGY, 'Invalid strategy');
      expect(error.statusCode).toBe(400);
    });
  });
});
