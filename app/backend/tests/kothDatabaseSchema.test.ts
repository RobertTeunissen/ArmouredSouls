import prisma from '../src/lib/prisma';

describe('KotH Database Schema Verification', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('ScheduledKothMatch Model', () => {
    it('should have all required fields', async () => {
      const columns = await prisma.$queryRaw<any[]>`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'scheduled_koth_matches'
        ORDER BY ordinal_position;
      `;

      const columnNames = columns.map(c => c.column_name);

      expect(columnNames).toContain('id');
      expect(columnNames).toContain('scheduled_for');
      expect(columnNames).toContain('status');
      expect(columnNames).toContain('battle_id');
      expect(columnNames).toContain('rotating_zone');
      expect(columnNames).toContain('score_threshold');
      expect(columnNames).toContain('time_limit');
      expect(columnNames).toContain('zone_radius');
      expect(columnNames).toContain('created_at');
    });

    it('should have correct default values', async () => {
      const columns = await prisma.$queryRaw<any[]>`
        SELECT column_name, column_default
        FROM information_schema.columns
        WHERE table_name = 'scheduled_koth_matches'
        AND column_name IN ('status', 'rotating_zone')
        ORDER BY column_name;
      `;

      const colMap = Object.fromEntries(columns.map(c => [c.column_name, c.column_default]));

      // status defaults to 'scheduled'
      expect(colMap['status']).toContain('scheduled');
      // rotating_zone defaults to false
      expect(colMap['rotating_zone']).toBe('false');
    });

    it('should have nullable config override fields', async () => {
      const columns = await prisma.$queryRaw<any[]>`
        SELECT column_name, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'scheduled_koth_matches'
        AND column_name IN ('score_threshold', 'time_limit', 'zone_radius', 'battle_id')
        ORDER BY column_name;
      `;

      columns.forEach(col => {
        expect(col.is_nullable).toBe('YES');
      });
    });

    it('should have all required indexes', async () => {
      const indexes = await prisma.$queryRaw<any[]>`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE tablename = 'scheduled_koth_matches';
      `;

      const indexNames = indexes.map(i => i.indexname);

      expect(indexNames).toContain('scheduled_koth_matches_pkey');
      expect(indexNames).toContain('scheduled_koth_matches_scheduled_for_status_idx');
      expect(indexNames).toContain('scheduled_koth_matches_status_idx');
    });
  });

  describe('ScheduledKothMatchParticipant Model', () => {
    it('should have all required fields', async () => {
      const columns = await prisma.$queryRaw<any[]>`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'scheduled_koth_match_participants'
        ORDER BY ordinal_position;
      `;

      const columnNames = columns.map(c => c.column_name);

      expect(columnNames).toContain('id');
      expect(columnNames).toContain('match_id');
      expect(columnNames).toContain('robot_id');
    });

    it('should have unique constraint on (matchId, robotId)', async () => {
      const indexes = await prisma.$queryRaw<any[]>`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE tablename = 'scheduled_koth_match_participants'
        AND indexdef LIKE '%UNIQUE%';
      `;

      expect(indexes.length).toBeGreaterThanOrEqual(1);

      const uniqueIndex = indexes.find(i =>
        i.indexdef.includes('match_id') && i.indexdef.includes('robot_id')
      );
      expect(uniqueIndex).toBeDefined();
    });

    it('should have all required indexes', async () => {
      const indexes = await prisma.$queryRaw<any[]>`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE tablename = 'scheduled_koth_match_participants';
      `;

      const indexNames = indexes.map(i => i.indexname);

      expect(indexNames).toContain('scheduled_koth_match_participants_pkey');
      expect(indexNames).toContain('scheduled_koth_match_participants_match_id_idx');
      expect(indexNames).toContain('scheduled_koth_match_participants_robot_id_idx');
    });

    it('should have foreign keys to ScheduledKothMatch and Robot', async () => {
      const foreignKeys = await prisma.$queryRaw<any[]>`
        SELECT
          tc.constraint_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name = 'scheduled_koth_match_participants';
      `;

      const fkNames = foreignKeys.map(fk => fk.constraint_name);

      expect(fkNames).toContain('scheduled_koth_match_participants_match_id_fkey');
      expect(fkNames).toContain('scheduled_koth_match_participants_robot_id_fkey');
    });
  });

  describe('Robot Model KotH Extensions', () => {
    it('should have all 8 KotH stat fields', async () => {
      const columns = await prisma.$queryRaw<any[]>`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'robots'
        AND column_name IN (
          'koth_wins',
          'koth_matches',
          'koth_total_zone_score',
          'koth_total_zone_time',
          'koth_kills',
          'koth_best_placement',
          'koth_current_win_streak',
          'koth_best_win_streak'
        )
        ORDER BY column_name;
      `;

      const columnNames = columns.map(c => c.column_name);

      // All 8 fields must exist
      expect(columnNames).toContain('koth_wins');
      expect(columnNames).toContain('koth_matches');
      expect(columnNames).toContain('koth_total_zone_score');
      expect(columnNames).toContain('koth_total_zone_time');
      expect(columnNames).toContain('koth_kills');
      expect(columnNames).toContain('koth_best_placement');
      expect(columnNames).toContain('koth_current_win_streak');
      expect(columnNames).toContain('koth_best_win_streak');
      expect(columnNames).toHaveLength(8);
    });

    it('should have correct defaults for KotH stat fields', async () => {
      const columns = await prisma.$queryRaw<any[]>`
        SELECT column_name, column_default, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'robots'
        AND column_name IN (
          'koth_wins',
          'koth_matches',
          'koth_total_zone_score',
          'koth_total_zone_time',
          'koth_kills',
          'koth_best_placement',
          'koth_current_win_streak',
          'koth_best_win_streak'
        )
        ORDER BY column_name;
      `;

      const colMap = Object.fromEntries(columns.map(c => [c.column_name, c]));

      // Integer fields default to 0
      expect(colMap['koth_wins'].column_default).toBe('0');
      expect(colMap['koth_matches'].column_default).toBe('0');
      expect(colMap['koth_kills'].column_default).toBe('0');
      expect(colMap['koth_current_win_streak'].column_default).toBe('0');
      expect(colMap['koth_best_win_streak'].column_default).toBe('0');

      // Float fields default to 0
      expect(colMap['koth_total_zone_score'].column_default).toBe('0');
      expect(colMap['koth_total_zone_time'].column_default).toBe('0');

      // koth_best_placement is nullable (null = no matches yet)
      expect(colMap['koth_best_placement'].is_nullable).toBe('YES');
    });
  });
});
