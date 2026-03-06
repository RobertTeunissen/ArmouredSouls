import {
  initializeTutorialState,
  getTutorialState,
  updateTutorialState,
  completeTutorial,
  skipTutorial,
  advanceStep,
  updatePlayerChoices,
  OnboardingChoices,
} from '../src/services/onboardingService';
import prisma from '../src/lib/prisma';
import bcrypt from 'bcrypt';

describe('Onboarding Service - initializeTutorialState', () => {
  const createdUserIds: number[] = [];

  afterEach(async () => {
    for (const id of createdUserIds) {
      try {
        await prisma.robot.deleteMany({ where: { userId: id } });
        await prisma.user.delete({ where: { id } });
      } catch {
        // Ignore if already deleted
      }
    }
    createdUserIds.length = 0;
  });

  let counter = 0;
  function uid() {
    return `${++counter}${Math.random().toString(36).substring(2, 6)}`;
  }

  it('should initialize tutorial state with step 1', async () => {
    const id = uid();
    const user = await prisma.user.create({
      data: {
        username: `u${id}`,
        email: `e${id}`,
        passwordHash: await bcrypt.hash('testpass123', 10),
      },
    });
    createdUserIds.push(user.id);

    const state = await initializeTutorialState(user.id);

    expect(state.userId).toBe(user.id);
    expect(state.onboardingStep).toBe(1);
    expect(state.hasCompletedOnboarding).toBe(false);
    expect(state.onboardingSkipped).toBe(false);
    expect(state.onboardingStrategy).toBeNull();
    expect(state.onboardingChoices).toEqual({});
    expect(state.onboardingStartedAt).toBeInstanceOf(Date);
    expect(state.onboardingCompletedAt).toBeNull();
  });

  it('should persist initialized state in database', async () => {
    const id = uid();
    const user = await prisma.user.create({
      data: {
        username: `u${id}`,
        email: `e${id}`,
        passwordHash: await bcrypt.hash('testpass123', 10),
      },
    });
    createdUserIds.push(user.id);

    await initializeTutorialState(user.id);

    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    expect(dbUser).not.toBeNull();
    expect(dbUser!.onboardingStep).toBe(1);
    expect(dbUser!.hasCompletedOnboarding).toBe(false);
    expect(dbUser!.onboardingStartedAt).toBeInstanceOf(Date);
  });

  it('should reset state if called on user with existing onboarding data', async () => {
    const id = uid();
    const user = await prisma.user.create({
      data: {
        username: `u${id}`,
        email: `e${id}`,
        passwordHash: await bcrypt.hash('testpass123', 10),
        onboardingStep: 5,
        onboardingStrategy: '2_average',
        hasCompletedOnboarding: true,
      },
    });
    createdUserIds.push(user.id);

    const state = await initializeTutorialState(user.id);

    expect(state.onboardingStep).toBe(1);
    expect(state.onboardingStrategy).toBeNull();
    expect(state.hasCompletedOnboarding).toBe(false);
  });
});

describe('Onboarding Service - getTutorialState', () => {
  const createdUserIds: number[] = [];

  afterEach(async () => {
    for (const id of createdUserIds) {
      try {
        await prisma.robot.deleteMany({ where: { userId: id } });
        await prisma.user.delete({ where: { id } });
      } catch {
        // Ignore if already deleted
      }
    }
    createdUserIds.length = 0;
  });

  let counter = 100;
  function uid() {
    return `${++counter}${Math.random().toString(36).substring(2, 6)}`;
  }

  it('should return tutorial state for existing user', async () => {
    const id = uid();
    const user = await prisma.user.create({
      data: {
        username: `u${id}`,
        email: `e${id}`,
        passwordHash: await bcrypt.hash('testpass123', 10),
        onboardingStep: 3,
        onboardingStrategy: '1_mighty',
        onboardingChoices: { rosterStrategy: '1_mighty' },
      },
    });
    createdUserIds.push(user.id);

    const state = await getTutorialState(user.id);

    expect(state).not.toBeNull();
    expect(state!.userId).toBe(user.id);
    expect(state!.onboardingStep).toBe(3);
    expect(state!.onboardingStrategy).toBe('1_mighty');
    expect(state!.onboardingChoices).toEqual({ rosterStrategy: '1_mighty' });
  });

  it('should return null for non-existent user', async () => {
    const state = await getTutorialState(999999);
    expect(state).toBeNull();
  });

  it('should return default values for user without onboarding data', async () => {
    const id = uid();
    const user = await prisma.user.create({
      data: {
        username: `u${id}`,
        email: `e${id}`,
        passwordHash: await bcrypt.hash('testpass123', 10),
      },
    });
    createdUserIds.push(user.id);

    const state = await getTutorialState(user.id);

    expect(state).not.toBeNull();
    expect(state!.onboardingStep).toBe(1);
    expect(state!.hasCompletedOnboarding).toBe(false);
    expect(state!.onboardingSkipped).toBe(false);
  });
});

describe('Onboarding Service - updateTutorialState', () => {
  const createdUserIds: number[] = [];

  afterEach(async () => {
    for (const id of createdUserIds) {
      try {
        await prisma.robot.deleteMany({ where: { userId: id } });
        await prisma.user.delete({ where: { id } });
      } catch {
        // Ignore if already deleted
      }
    }
    createdUserIds.length = 0;
  });

  let counter = 200;
  function uid() {
    return `${++counter}${Math.random().toString(36).substring(2, 6)}`;
  }

  it('should update onboarding step', async () => {
    const id = uid();
    const user = await prisma.user.create({
      data: {
        username: `u${id}`,
        email: `e${id}`,
        passwordHash: await bcrypt.hash('testpass123', 10),
        onboardingStep: 1,
      },
    });
    createdUserIds.push(user.id);

    const state = await updateTutorialState(user.id, { onboardingStep: 2 });

    expect(state.onboardingStep).toBe(2);
  });

  it('should update onboarding strategy', async () => {
    const id = uid();
    const user = await prisma.user.create({
      data: {
        username: `u${id}`,
        email: `e${id}`,
        passwordHash: await bcrypt.hash('testpass123', 10),
      },
    });
    createdUserIds.push(user.id);

    const state = await updateTutorialState(user.id, { onboardingStrategy: '2_average' });

    expect(state.onboardingStrategy).toBe('2_average');
  });

  it('should update onboarding choices', async () => {
    const id = uid();
    const user = await prisma.user.create({
      data: {
        username: `u${id}`,
        email: `e${id}`,
        passwordHash: await bcrypt.hash('testpass123', 10),
      },
    });
    createdUserIds.push(user.id);

    const choices: OnboardingChoices = {
      rosterStrategy: '3_flimsy',
      robotsCreated: [1, 2, 3],
    };

    const state = await updateTutorialState(user.id, { onboardingChoices: choices });

    expect(state.onboardingChoices).toEqual(choices);
  });

  it('should update multiple fields at once', async () => {
    const id = uid();
    const user = await prisma.user.create({
      data: {
        username: `u${id}`,
        email: `e${id}`,
        passwordHash: await bcrypt.hash('testpass123', 10),
        onboardingStep: 3,
      },
    });
    createdUserIds.push(user.id);

    const state = await updateTutorialState(user.id, {
      onboardingStep: 4,
      onboardingStrategy: '1_mighty',
      onboardingChoices: { rosterStrategy: '1_mighty' },
    });

    expect(state.onboardingStep).toBe(4);
    expect(state.onboardingStrategy).toBe('1_mighty');
    expect(state.onboardingChoices).toEqual({ rosterStrategy: '1_mighty' });
  });

  it('should persist updates in database', async () => {
    const id = uid();
    const user = await prisma.user.create({
      data: {
        username: `u${id}`,
        email: `e${id}`,
        passwordHash: await bcrypt.hash('testpass123', 10),
        onboardingStep: 4,
      },
    });
    createdUserIds.push(user.id);

    await updateTutorialState(user.id, { onboardingStep: 5 });

    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    expect(dbUser!.onboardingStep).toBe(5);
  });
});

describe('Onboarding Service - completeTutorial', () => {
  const createdUserIds: number[] = [];

  afterEach(async () => {
    for (const id of createdUserIds) {
      try {
        await prisma.robot.deleteMany({ where: { userId: id } });
        await prisma.user.delete({ where: { id } });
      } catch {
        // Ignore if already deleted
      }
    }
    createdUserIds.length = 0;
  });

  let counter = 300;
  function uid() {
    return `${++counter}${Math.random().toString(36).substring(2, 6)}`;
  }

  it('should mark onboarding as completed', async () => {
    const id = uid();
    const user = await prisma.user.create({
      data: {
        username: `u${id}`,
        email: `e${id}`,
        passwordHash: await bcrypt.hash('testpass123', 10),
        onboardingStep: 9,
      },
    });
    createdUserIds.push(user.id);

    await completeTutorial(user.id);

    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    expect(dbUser!.hasCompletedOnboarding).toBe(true);
    expect(dbUser!.onboardingCompletedAt).toBeInstanceOf(Date);
  });

  it('should not mark as skipped when completing', async () => {
    const id = uid();
    const user = await prisma.user.create({
      data: {
        username: `u${id}`,
        email: `e${id}`,
        passwordHash: await bcrypt.hash('testpass123', 10),
      },
    });
    createdUserIds.push(user.id);

    await completeTutorial(user.id);

    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    expect(dbUser!.onboardingSkipped).toBe(false);
  });
});

describe('Onboarding Service - skipTutorial', () => {
  const createdUserIds: number[] = [];

  afterEach(async () => {
    for (const id of createdUserIds) {
      try {
        await prisma.robot.deleteMany({ where: { userId: id } });
        await prisma.user.delete({ where: { id } });
      } catch {
        // Ignore if already deleted
      }
    }
    createdUserIds.length = 0;
  });

  let counter = 400;
  function uid() {
    return `${++counter}${Math.random().toString(36).substring(2, 6)}`;
  }

  it('should mark onboarding as completed and skipped', async () => {
    const id = uid();
    const user = await prisma.user.create({
      data: {
        username: `u${id}`,
        email: `e${id}`,
        passwordHash: await bcrypt.hash('testpass123', 10),
        onboardingStep: 2,
      },
    });
    createdUserIds.push(user.id);

    await skipTutorial(user.id);

    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    expect(dbUser!.hasCompletedOnboarding).toBe(true);
    expect(dbUser!.onboardingSkipped).toBe(true);
    expect(dbUser!.onboardingCompletedAt).toBeInstanceOf(Date);
  });

  it('should allow skipping from any step', async () => {
    const id = uid();
    const user = await prisma.user.create({
      data: {
        username: `u${id}`,
        email: `e${id}`,
        passwordHash: await bcrypt.hash('testpass123', 10),
        onboardingStep: 1,
      },
    });
    createdUserIds.push(user.id);

    await skipTutorial(user.id);

    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    expect(dbUser!.hasCompletedOnboarding).toBe(true);
    expect(dbUser!.onboardingSkipped).toBe(true);
  });
});

describe('Onboarding Service - advanceStep', () => {
  const createdUserIds: number[] = [];

  afterEach(async () => {
    for (const id of createdUserIds) {
      try {
        await prisma.robot.deleteMany({ where: { userId: id } });
        await prisma.user.delete({ where: { id } });
      } catch {
        // Ignore if already deleted
      }
    }
    createdUserIds.length = 0;
  });

  let counter = 500;
  function uid() {
    return `${++counter}${Math.random().toString(36).substring(2, 6)}`;
  }

  it('should increment step by 1', async () => {
    const id = uid();
    const user = await prisma.user.create({
      data: {
        username: `u${id}`,
        email: `e${id}`,
        passwordHash: await bcrypt.hash('testpass123', 10),
        onboardingStep: 3,
      },
    });
    createdUserIds.push(user.id);

    const state = await advanceStep(user.id);

    expect(state.onboardingStep).toBe(4);
  });

  it('should cap at step 9', async () => {
    const id = uid();
    const user = await prisma.user.create({
      data: {
        username: `u${id}`,
        email: `e${id}`,
        passwordHash: await bcrypt.hash('testpass123', 10),
        onboardingStep: 9,
      },
    });
    createdUserIds.push(user.id);

    const state = await advanceStep(user.id);

    expect(state.onboardingStep).toBe(9);
  });

  it('should throw error if tutorial state not found', async () => {
    await expect(advanceStep(999999)).rejects.toThrow('Tutorial state not found');
  });

  it('should advance from step 1 to step 2', async () => {
    const id = uid();
    const user = await prisma.user.create({
      data: {
        username: `u${id}`,
        email: `e${id}`,
        passwordHash: await bcrypt.hash('testpass123', 10),
        onboardingStep: 1,
      },
    });
    createdUserIds.push(user.id);

    const state = await advanceStep(user.id);

    expect(state.onboardingStep).toBe(2);
  });
});

describe('Onboarding Service - updatePlayerChoices', () => {
  const createdUserIds: number[] = [];

  afterEach(async () => {
    for (const id of createdUserIds) {
      try {
        await prisma.robot.deleteMany({ where: { userId: id } });
        await prisma.user.delete({ where: { id } });
      } catch {
        // Ignore if already deleted
      }
    }
    createdUserIds.length = 0;
  });

  let counter = 600;
  function uid() {
    return `${++counter}${Math.random().toString(36).substring(2, 6)}`;
  }

  it('should merge new choices with existing choices', async () => {
    const id = uid();
    const user = await prisma.user.create({
      data: {
        username: `u${id}`,
        email: `e${id}`,
        passwordHash: await bcrypt.hash('testpass123', 10),
        onboardingChoices: { rosterStrategy: '1_mighty' },
      },
    });
    createdUserIds.push(user.id);

    const state = await updatePlayerChoices(user.id, {
      robotsCreated: [123],
      loadoutType: 'single',
    });

    expect(state.onboardingChoices).toEqual({
      rosterStrategy: '1_mighty',
      robotsCreated: [123],
      loadoutType: 'single',
    });
  });

  it('should overwrite existing choice fields', async () => {
    const id = uid();
    const user = await prisma.user.create({
      data: {
        username: `u${id}`,
        email: `e${id}`,
        passwordHash: await bcrypt.hash('testpass123', 10),
        onboardingChoices: { rosterStrategy: '1_mighty', robotsCreated: [1] },
      },
    });
    createdUserIds.push(user.id);

    const state = await updatePlayerChoices(user.id, {
      rosterStrategy: '2_average',
    });

    expect(state.onboardingChoices.rosterStrategy).toBe('2_average');
    expect(state.onboardingChoices.robotsCreated).toEqual([1]);
  });

  it('should handle empty initial choices', async () => {
    const id = uid();
    const user = await prisma.user.create({
      data: {
        username: `u${id}`,
        email: `e${id}`,
        passwordHash: await bcrypt.hash('testpass123', 10),
      },
    });
    createdUserIds.push(user.id);

    const state = await updatePlayerChoices(user.id, {
      rosterStrategy: '3_flimsy',
    });

    expect(state.onboardingChoices).toEqual({
      rosterStrategy: '3_flimsy',
    });
  });

  it('should throw error if tutorial state not found', async () => {
    await expect(
      updatePlayerChoices(999999, { rosterStrategy: '1_mighty' })
    ).rejects.toThrow('Tutorial state not found');
  });

  it('should handle complex nested choices', async () => {
    const id = uid();
    const user = await prisma.user.create({
      data: {
        username: `u${id}`,
        email: `e${id}`,
        passwordHash: await bcrypt.hash('testpass123', 10),
      },
    });
    createdUserIds.push(user.id);

    const state = await updatePlayerChoices(user.id, {
      budgetSpent: {
        facilities: 500000,
        robots: 500000,
        weapons: 300000,
        attributes: 1000000,
      },
    });

    expect(state.onboardingChoices.budgetSpent).toEqual({
      facilities: 500000,
      robots: 500000,
      weapons: 300000,
      attributes: 1000000,
    });
  });
});
