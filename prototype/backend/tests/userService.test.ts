import { createUser, CreateUserData, findUserByUsername, findUserByEmail, findUserByIdentifier } from '../src/services/userService';
import prisma from '../src/lib/prisma';
import bcrypt from 'bcrypt';

describe('User Service - createUser', () => {
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

  // Short IDs to fit VarChar(20) for email column
  let counter = 0;
  function uid() {
    return `${++counter}${Math.random().toString(36).substring(2, 6)}`;
  }

  it('should create a user with the provided username, email, and passwordHash', async () => {
    const id = uid();
    const passwordHash = await bcrypt.hash('testpass123', 10);
    const userData: CreateUserData = {
      username: `u${id}`,
      email: `e${id}`,
      passwordHash,
    };

    const user = await createUser(userData);
    createdUserIds.push(user.id);

    expect(user.username).toBe(userData.username);
    expect(user.email).toBe(userData.email);
    expect(user.passwordHash).toBe(passwordHash);
  });

  it('should set default currency to 3000000', async () => {
    const id = uid();
    const user = await createUser({
      username: `u${id}`,
      email: `e${id}`,
      passwordHash: await bcrypt.hash('testpass123', 10),
    });
    createdUserIds.push(user.id);

    expect(user.currency).toBe(3000000);
  });

  it('should set default prestige to 0', async () => {
    const id = uid();
    const user = await createUser({
      username: `u${id}`,
      email: `e${id}`,
      passwordHash: await bcrypt.hash('testpass123', 10),
    });
    createdUserIds.push(user.id);

    expect(user.prestige).toBe(0);
  });

  it('should set default role to "user"', async () => {
    const id = uid();
    const user = await createUser({
      username: `u${id}`,
      email: `e${id}`,
      passwordHash: await bcrypt.hash('testpass123', 10),
    });
    createdUserIds.push(user.id);

    expect(user.role).toBe('user');
  });

  it('should return a user with id, createdAt, and updatedAt', async () => {
    const id = uid();
    const user = await createUser({
      username: `u${id}`,
      email: `e${id}`,
      passwordHash: await bcrypt.hash('testpass123', 10),
    });
    createdUserIds.push(user.id);

    expect(user.id).toBeDefined();
    expect(typeof user.id).toBe('number');
    expect(user.createdAt).toBeInstanceOf(Date);
    expect(user.updatedAt).toBeInstanceOf(Date);
  });

  it('should persist the user in the database', async () => {
    const id = uid();
    const userData: CreateUserData = {
      username: `u${id}`,
      email: `e${id}`,
      passwordHash: await bcrypt.hash('testpass123', 10),
    };

    const user = await createUser(userData);
    createdUserIds.push(user.id);

    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    expect(dbUser).not.toBeNull();
    expect(dbUser!.username).toBe(userData.username);
    expect(dbUser!.email).toBe(userData.email);
  });

  it('should throw on duplicate username', async () => {
    const id = uid();
    const user = await createUser({
      username: `u${id}`,
      email: `e${id}`,
      passwordHash: await bcrypt.hash('testpass123', 10),
    });
    createdUserIds.push(user.id);

    await expect(
      createUser({
        username: `u${id}`,
        email: `e${uid()}`,
        passwordHash: await bcrypt.hash('testpass456', 10),
      })
    ).rejects.toThrow();
  });

  it('should throw on duplicate email', async () => {
    const id = uid();
    const email = `e${id}`;
    const user = await createUser({
      username: `u${id}`,
      email,
      passwordHash: await bcrypt.hash('testpass123', 10),
    });
    createdUserIds.push(user.id);

    await expect(
      createUser({
        username: `u${uid()}`,
        email,
        passwordHash: await bcrypt.hash('testpass456', 10),
      })
    ).rejects.toThrow();
  });
});


describe('User Service - findUserByUsername', () => {
  const createdUserIds: number[] = [];

  let counter = 100;
  function uid() {
    return `${++counter}${Math.random().toString(36).substring(2, 6)}`;
  }

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

  it('should return the user when found by username', async () => {
    const id = uid();
    const user = await createUser({
      username: `u${id}`,
      email: `e${id}`,
      passwordHash: await bcrypt.hash('testpass123', 10),
    });
    createdUserIds.push(user.id);

    const found = await findUserByUsername(`u${id}`);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(user.id);
    expect(found!.username).toBe(`u${id}`);
    expect(found!.email).toBe(`e${id}`);
  });

  it('should return null when username does not exist', async () => {
    const found = await findUserByUsername(`nonexistent_${uid()}`);
    expect(found).toBeNull();
  });
});

describe('User Service - findUserByEmail', () => {
  const createdUserIds: number[] = [];

  let counter = 200;
  function uid() {
    return `${++counter}${Math.random().toString(36).substring(2, 6)}`;
  }

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

  it('should return the user when found by email', async () => {
    const id = uid();
    const user = await createUser({
      username: `u${id}`,
      email: `e${id}`,
      passwordHash: await bcrypt.hash('testpass123', 10),
    });
    createdUserIds.push(user.id);

    const found = await findUserByEmail(`e${id}`);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(user.id);
    expect(found!.email).toBe(`e${id}`);
    expect(found!.username).toBe(`u${id}`);
  });

  it('should return null when email does not exist', async () => {
    const found = await findUserByEmail(`nonexistent_${uid()}`);
    expect(found).toBeNull();
  });
});

describe('User Service - findUserByIdentifier', () => {
  const createdUserIds: number[] = [];

  let counter = 300;
  function uid() {
    return `${++counter}${Math.random().toString(36).substring(2, 6)}`;
  }

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

  it('should find a user by username', async () => {
    const id = uid();
    const user = await createUser({
      username: `u${id}`,
      email: `e${id}`,
      passwordHash: await bcrypt.hash('testpass123', 10),
    });
    createdUserIds.push(user.id);

    const found = await findUserByIdentifier(`u${id}`);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(user.id);
    expect(found!.username).toBe(`u${id}`);
  });

  it('should find a user by email', async () => {
    const id = uid();
    const user = await createUser({
      username: `u${id}`,
      email: `e${id}`,
      passwordHash: await bcrypt.hash('testpass123', 10),
    });
    createdUserIds.push(user.id);

    const found = await findUserByIdentifier(`e${id}`);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(user.id);
    expect(found!.email).toBe(`e${id}`);
  });

  it('should return null when identifier matches neither username nor email', async () => {
    const found = await findUserByIdentifier(`unknown_${uid()}`);
    expect(found).toBeNull();
  });

  it('should prefer username match over email match', async () => {
    // Create two users where user1's username equals user2's email
    const shared = uid();
    const user1 = await createUser({
      username: `s${shared}`,
      email: `x${uid()}`,
      passwordHash: await bcrypt.hash('testpass123', 10),
    });
    createdUserIds.push(user1.id);

    const user2 = await createUser({
      username: `y${uid()}`,
      email: `s${shared}`,
      passwordHash: await bcrypt.hash('testpass456', 10),
    });
    createdUserIds.push(user2.id);

    // findUserByIdentifier should find user1 (by username) not user2 (by email)
    const found = await findUserByIdentifier(`s${shared}`);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(user1.id);
  });
});
