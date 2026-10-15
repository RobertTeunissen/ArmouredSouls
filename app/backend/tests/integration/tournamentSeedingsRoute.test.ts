/**
 * T14b — `GET /api/tournaments/:id` seedings honour every terminal match status
 * (design §7, rule 5, product-owner R1).
 *
 * The route used to pre-filter `status === 'completed'` before calling
 * `computeSeedings`, which hid every `forfeit` and `cancelled` row: a forfeiter
 * or the lower seed of an errored match still showed as alive. Real database,
 * one listening server for the whole file.
 */
import http from 'node:http';
import express from 'express';
import request from 'supertest';
import prisma from '../../src/lib/prisma';
import tournamentRoutes from '../../src/routes/tournaments';
import { errorHandler } from '../../src/middleware/errorHandler';
import { generateToken } from '../../src/services/auth/jwtService';
import { generateStandardSeedOrder } from '../../src/services/tournament/tournamentService';

const RUN = `tsr${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const app = express();
app.use(express.json());
app.use('/api/tournaments', tournamentRoutes);
app.use(errorHandler);

interface SeedingBody {
  seed: number;
  robotId: number;
  eliminated: boolean;
}

describe('GET /api/tournaments/:id seedings (T14b)', () => {
  let server: http.Server;
  let userId: number;
  let username: string;
  let tournamentId: number;
  /** seedRobot[k] is the robot holding seed k (1-based). */
  const seedRobot: number[] = [];

  beforeAll(async () => {
    server = await new Promise<http.Server>((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });
    username = `${RUN}_u`;
    const user = await prisma.user.create({ data: { username, passwordHash: 'x' } });
    userId = user.id;
    for (let seed = 1; seed <= 4; seed++) {
      const robot = await prisma.robot.create({
        data: { userId, name: `${RUN}_r${seed}`, elo: 2000 - seed * 100, currentHP: 10, maxHP: 10, currentShield: 2, maxShield: 2 },
      });
      seedRobot[seed] = robot.id;
    }
    const tournament = await prisma.tournament.create({
      data: {
        name: `${RUN} Cup`,
        tournamentType: 'single_elimination',
        participantType: 'robot',
        status: 'active',
        currentRound: 2,
        maxRounds: 2,
        totalParticipants: 4,
      },
    });
    tournamentId = tournament.id;
    // Place seeds with the real helper: slots are [s1, s4, s3, s2] for 4 slots.
    const order = generateStandardSeedOrder(4);
    const slots: number[] = [];
    order.forEach((slot, seedIdx) => {
      slots[slot - 1] = seedRobot[seedIdx + 1];
    });
    // Match 1: seed 1 vs seed 4, seed 4 forfeits. Match 2: an errored match
    // (R1) cancelled with the higher seed advancing.
    const m1p1 = slots[0];
    const m1p2 = slots[1];
    const m2p1 = slots[2];
    const m2p2 = slots[3];
    const seedOf = (id: number): number => seedRobot.indexOf(id);
    const higher = (a: number, b: number): number => (seedOf(a) < seedOf(b) ? a : b);
    await prisma.scheduledTournamentMatch.createMany({
      data: [
        { tournamentId, round: 1, matchNumber: 1, participant1Id: m1p1, participant2Id: m1p2, winnerId: higher(m1p1, m1p2), status: 'forfeit', completedAt: new Date() },
        { tournamentId, round: 1, matchNumber: 2, participant1Id: m2p1, participant2Id: m2p2, winnerId: higher(m2p1, m2p2), status: 'cancelled', completedAt: new Date() },
        { tournamentId, round: 2, matchNumber: 1, participant1Id: higher(m1p1, m1p2), participant2Id: higher(m2p1, m2p2), status: 'pending' },
      ],
    });
  });

  afterAll(async () => {
    await prisma.tournament.deleteMany({ where: { id: tournamentId } });
    await prisma.robot.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  });

  it('marks the forfeiter and the cancelled lower seed eliminated, and keeps the higher seeds alive', async () => {
    const token = generateToken({ id: String(userId), username, role: 'user', tokenVersion: 0 });
    const res = await request(server).get(`/api/tournaments/${tournamentId}`).set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const seedings = res.body.seedings as SeedingBody[];
    expect(seedings.map((s) => s.seed)).toEqual([1, 2, 3, 4]);
    const bySeed = new Map(seedings.map((s) => [s.seed, s]));
    for (const seed of [1, 2, 3, 4]) expect(bySeed.get(seed)!.robotId).toBe(seedRobot[seed]);
    // Seed 1 beat seed 4 by forfeit; the errored 2-v-3 match advanced seed 2.
    expect(bySeed.get(1)!.eliminated).toBe(false);
    expect(bySeed.get(4)!.eliminated).toBe(true);
    expect(bySeed.get(2)!.eliminated).toBe(false);
    expect(bySeed.get(3)!.eliminated).toBe(true);
  });
});
