import {
  buildGuideSearchResult,
  buildRobotSearchResult,
  buildStableSearchResult,
} from '../searchReferenceBuilder';
import {
  GuideSearchSource,
  RobotSearchSource,
  StableSearchSource,
} from '../searchTypes';

describe('search reference builders', () => {
  describe('buildRobotSearchResult', () => {
    it('should return only approved robot fields and trim a named stable subtitle', () => {
      const source: RobotSearchSource & Record<string, unknown> = {
        id: 12,
        name: 'Atlas',
        stableName: '  Iron House  ',
        username: 'private-account-name',
        profileVisibility: 'private',
        password: 'hashed-password',
        token: 'secret-token',
        privateMetadata: { email: 'private@example.test' },
        route: '/arbitrary-route',
        targetRoute: '/robots/999',
      };

      const result = buildRobotSearchResult(source);

      expect(result).toEqual({
        category: 'robots',
        id: 12,
        label: 'Atlas',
        subtitle: 'Iron House',
      });
      expect(Object.keys(result).sort()).toEqual(['category', 'id', 'label', 'subtitle']);
      for (const forbiddenField of [
        'username',
        'profileVisibility',
        'password',
        'token',
        'privateMetadata',
        'route',
        'targetRoute',
      ]) {
        expect(result).not.toHaveProperty(forbiddenField);
      }
    });

    it('should omit a null, empty, or whitespace-only stable subtitle', () => {
      const sources: RobotSearchSource[] = [
        { id: 13, name: 'Bolt', stableName: null },
        { id: 14, name: 'Nova', stableName: '' },
        { id: 15, name: 'Vector', stableName: ' \t ' },
      ];

      for (const source of sources) {
        expect(buildRobotSearchResult(source)).toEqual({
          category: 'robots',
          id: source.id,
          label: source.name,
        });
      }
    });

    it('should retain the robot route identity and ignore invalid identity aliases', () => {
      const source: RobotSearchSource & Record<string, unknown> = {
        id: 27,
        name: 'Route Pilot',
        stableName: null,
        userId: 9001,
        robotId: 9002,
        route: '/stables/9001',
        targetRoute: '/admin',
      };

      expect(buildRobotSearchResult(source)).toEqual({
        category: 'robots',
        id: 27,
        label: 'Route Pilot',
      });
    });
  });

  describe('buildStableSearchResult', () => {
    it('should include a trimmed named stable without using private account fields', () => {
      const source: StableSearchSource & Record<string, unknown> = {
        userId: 42,
        stableName: '  Test Stable  ',
        username: 'seeded-test-user',
        profileVisibility: 'private',
        isGenerated: true,
        password: 'hashed-password',
        token: 'secret-token',
        robots: [{ id: 1, name: 'private robot' }],
        route: '/arbitrary-route',
      };

      const result = buildStableSearchResult(source);

      expect(result).toEqual({
        category: 'stables',
        userId: 42,
        label: 'Test Stable',
      });
      expect(Object.keys(result ?? {}).sort()).toEqual(['category', 'label', 'userId']);
      for (const forbiddenField of [
        'username',
        'profileVisibility',
        'isGenerated',
        'password',
        'token',
        'robots',
        'route',
      ]) {
        expect(result).not.toHaveProperty(forbiddenField);
      }
    });

    it('should include named generated and test stables regardless of account metadata', () => {
      const sources: Array<StableSearchSource & Record<string, unknown>> = [
        {
          userId: 101,
          stableName: '  Generated Stable  ',
          isGenerated: true,
          username: 'generated-bot',
        },
        {
          userId: 102,
          stableName: '  Test Stable  ',
          isGenerated: false,
          username: 'test_user_seeded',
        },
      ];

      expect(sources.map((source) => buildStableSearchResult(source))).toEqual([
        { category: 'stables', userId: 101, label: 'Generated Stable' },
        { category: 'stables', userId: 102, label: 'Test Stable' },
      ]);
    });

    it('should omit null, empty, and whitespace-only stable names', () => {
      const sources: StableSearchSource[] = [
        { userId: 1, stableName: null },
        { userId: 2, stableName: '' },
        { userId: 3, stableName: ' \t ' },
      ];

      for (const source of sources) {
        expect(buildStableSearchResult(source)).toBeNull();
      }
    });

    it('should retain the stable route identity and ignore invalid identity aliases', () => {
      const source: StableSearchSource & Record<string, unknown> = {
        userId: 84,
        stableName: 'Identity Stable',
        id: 999,
        username: 'private-player',
        accountId: 1000,
        route: '/robots/999',
        targetRoute: '/admin',
      };

      expect(buildStableSearchResult(source)).toEqual({
        category: 'stables',
        userId: 84,
        label: 'Identity Stable',
      });
    });
  });

  describe('buildGuideSearchResult', () => {
    it('should return route identities and display context without article content or arbitrary routes', () => {
      const source: GuideSearchSource & Record<string, unknown> = {
        slug: 'repairing-robots',
        title: 'Repairing Robots',
        sectionSlug: 'maintenance',
        sectionTitle: 'Maintenance',
        description: 'Keep your robots ready for battle.',
        bodyText: 'Full article body that must not reach the response.',
        username: 'private-account-name',
        profileVisibility: 'private',
        password: 'hashed-password',
        token: 'secret-token',
        privateMetadata: { draft: true },
        route: '/arbitrary-route',
        targetRoute: '/admin',
        articleSlug: 'untrusted-article-slug',
      };

      const result = buildGuideSearchResult(source);

      expect(result).toEqual({
        category: 'guide',
        title: 'Repairing Robots',
        sectionTitle: 'Maintenance',
        sectionSlug: 'maintenance',
        articleSlug: 'repairing-robots',
      });
      expect(Object.keys(result).sort()).toEqual([
        'articleSlug',
        'category',
        'sectionSlug',
        'sectionTitle',
        'title',
      ]);
      for (const forbiddenField of [
        'description',
        'bodyText',
        'username',
        'profileVisibility',
        'password',
        'token',
        'privateMetadata',
        'route',
        'targetRoute',
      ]) {
        expect(result).not.toHaveProperty(forbiddenField);
      }
    });

    it('should use the approved guide identity fields instead of invalid aliases', () => {
      const source: GuideSearchSource & Record<string, unknown> = {
        slug: 'battle-flow',
        title: 'Battle Flow',
        sectionSlug: 'combat',
        sectionTitle: 'Combat',
        description: 'Guide description',
        bodyText: 'Guide body',
        section: 'untrusted-section',
        articleId: 123,
        route: '/robots/123',
      };

      expect(buildGuideSearchResult(source)).toEqual({
        category: 'guide',
        title: 'Battle Flow',
        sectionTitle: 'Combat',
        sectionSlug: 'combat',
        articleSlug: 'battle-flow',
      });
    });
  });
});
