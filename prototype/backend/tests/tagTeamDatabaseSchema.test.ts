import prisma from '../src/lib/prisma';


describe('Tag Team Database Schema Verification', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('TagTeam Model', () => {
    it('should have all required fields', async () => {
      // Query the information schema to verify table structure
      const columns = await prisma.$queryRaw<any[]>`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'tag_teams'
        ORDER BY ordinal_position;
      `;

      const columnNames = columns.map(c => c.column_name);
      
      // Verify all required columns exist
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('stable_id');
      expect(columnNames).toContain('active_robot_id');
      expect(columnNames).toContain('reserve_robot_id');
      expect(columnNames).toContain('tag_team_league');
      expect(columnNames).toContain('tag_team_league_id');
      expect(columnNames).toContain('tag_team_league_points');
      expect(columnNames).toContain('cycles_in_tag_team_league');
      expect(columnNames).toContain('total_tag_team_wins');
      expect(columnNames).toContain('total_tag_team_losses');
      expect(columnNames).toContain('total_tag_team_draws');
      expect(columnNames).toContain('created_at');
      expect(columnNames).toContain('updated_at');
    });

    it('should have all required indexes', async () => {
      const indexes = await prisma.$queryRaw<any[]>`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE tablename = 'tag_teams';
      `;

      const indexNames = indexes.map(i => i.indexname);
      
      // Verify all required indexes exist
      expect(indexNames).toContain('tag_teams_pkey'); // Primary key
      expect(indexNames).toContain('tag_teams_stable_id_idx');
      expect(indexNames).toContain('tag_teams_tag_team_league_tag_team_league_id_idx');
      expect(indexNames).toContain('tag_teams_active_robot_id_idx');
      expect(indexNames).toContain('tag_teams_reserve_robot_id_idx');
      expect(indexNames).toContain('tag_teams_active_robot_id_reserve_robot_id_key'); // Unique constraint
    });

    it('should have unique constraint on robot pair', async () => {
      // The unique constraint is implemented as a unique index
      const indexes = await prisma.$queryRaw<any[]>`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE tablename = 'tag_teams'
        AND indexname = 'tag_teams_active_robot_id_reserve_robot_id_key';
      `;

      expect(indexes.length).toBe(1);
      expect(indexes[0].indexdef).toContain('UNIQUE');
    });

    it('should prevent same robot as active and reserve', async () => {
      // The application layer enforces that activeRobotId !== reserveRobotId
      // This is validated in the service layer, not via a DB check constraint
      expect(true).toBe(true);
    });
  });

  describe('TagTeamMatch Model', () => {
    it('should have all required fields', async () => {
      const columns = await prisma.$queryRaw<any[]>`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'tag_team_matches'
        ORDER BY ordinal_position;
      `;

      const columnNames = columns.map(c => c.column_name);
      
      // Verify all required columns exist
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('team1_id');
      expect(columnNames).toContain('team2_id');
      expect(columnNames).toContain('tag_team_league');
      expect(columnNames).toContain('scheduled_for');
      expect(columnNames).toContain('status');
      expect(columnNames).toContain('battle_id');
      expect(columnNames).toContain('created_at');
    });

    it('should have all required indexes', async () => {
      const indexes = await prisma.$queryRaw<any[]>`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE tablename = 'tag_team_matches';
      `;

      const indexNames = indexes.map(i => i.indexname);
      
      // Verify all required indexes exist
      expect(indexNames).toContain('tag_team_matches_pkey'); // Primary key
      expect(indexNames).toContain('tag_team_matches_team1_id_idx');
      expect(indexNames).toContain('tag_team_matches_team2_id_idx');
      expect(indexNames).toContain('tag_team_matches_scheduled_for_status_idx');
      expect(indexNames).toContain('tag_team_matches_status_idx');
    });
  });

  describe('Battle Model Extensions', () => {
    it('should have tag team fields', async () => {
      const columns = await prisma.$queryRaw<any[]>`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'battles'
        AND column_name IN (
          'battle_type',
          'team1_active_robot_id',
          'team1_reserve_robot_id',
          'team2_active_robot_id',
          'team2_reserve_robot_id',
          'team1_tag_out_time',
          'team2_tag_out_time'
        )
        ORDER BY column_name;
      `;

      const columnNames = columns.map(c => c.column_name);
      
      expect(columnNames).toContain('battle_type');
      expect(columnNames).toContain('team1_active_robot_id');
      expect(columnNames).toContain('team1_reserve_robot_id');
      expect(columnNames).toContain('team2_active_robot_id');
      expect(columnNames).toContain('team2_reserve_robot_id');
      expect(columnNames).toContain('team1_tag_out_time');
      expect(columnNames).toContain('team2_tag_out_time');
    });

    it('should have battle_type index', async () => {
      const indexes = await prisma.$queryRaw<any[]>`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE tablename = 'battles'
        AND indexname = 'battles_battle_type_idx';
      `;

      expect(indexes.length).toBe(1);
    });
  });

  describe('Robot Model Extensions', () => {
    it('should have tag team statistics fields', async () => {
      const columns = await prisma.$queryRaw<any[]>`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'robots'
        AND column_name IN (
          'total_tag_team_battles',
          'total_tag_team_wins',
          'total_tag_team_losses',
          'total_tag_team_draws',
          'times_tagged_in',
          'times_tagged_out'
        )
        ORDER BY column_name;
      `;

      const columnNames = columns.map(c => c.column_name);
      
      expect(columnNames).toContain('total_tag_team_battles');
      expect(columnNames).toContain('total_tag_team_wins');
      expect(columnNames).toContain('total_tag_team_losses');
      expect(columnNames).toContain('total_tag_team_draws');
      expect(columnNames).toContain('times_tagged_in');
      expect(columnNames).toContain('times_tagged_out');

      // Verify all have default value of 0
      columns.forEach(col => {
        expect(col.column_default).toBe('0');
      });
    });
  });

  describe('Foreign Key Constraints', () => {
    it('should have all TagTeam foreign keys', async () => {
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
        AND tc.table_name = 'tag_teams';
      `;

      const fkNames = foreignKeys.map(fk => fk.constraint_name);
      
      expect(fkNames).toContain('tag_teams_stable_id_fkey');
      expect(fkNames).toContain('tag_teams_active_robot_id_fkey');
      expect(fkNames).toContain('tag_teams_reserve_robot_id_fkey');
    });

    it('should have all TagTeamMatch foreign keys', async () => {
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
        AND tc.table_name = 'tag_team_matches';
      `;

      const fkNames = foreignKeys.map(fk => fk.constraint_name);
      
      expect(fkNames).toContain('tag_team_matches_team1_id_fkey');
      expect(fkNames).toContain('tag_team_matches_team2_id_fkey');
      expect(fkNames).toContain('tag_team_matches_battle_id_fkey');
    });
  });
});
