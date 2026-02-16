import { TrendAnalysisService } from '../src/services/trendAnalysisService';
import { cycleSnapshotService } from '../src/services/cycleSnapshotService';

// Mock the cycleSnapshotService
jest.mock('../src/services/cycleSnapshotService', () => ({
  cycleSnapshotService: {
    getSnapshotRange: jest.fn(),
  },
}));

describe('TrendAnalysisService', () => {
  let service: TrendAnalysisService;

  beforeEach(() => {
    service = new TrendAnalysisService();
    jest.clearAllMocks();
  });

  describe('analyzeTrend', () => {
    it('should return empty data when no snapshots exist', async () => {
      (cycleSnapshotService.getSnapshotRange as jest.Mock).mockResolvedValue([]);

      const result = await service.analyzeTrend(1, null, 'income', [1, 10]);

      expect(result).toEqual({
        metric: 'income',
        cycleRange: [1, 10],
        data: [],
      });
    });

    it('should extract stable-level income data correctly', async () => {
      const mockSnapshots = [
        {
          cycleNumber: 1,
          endTime: new Date('2024-01-01'),
          stableMetrics: [
            {
              userId: 1,
              totalCreditsEarned: 1000,
              merchandisingIncome: 200,
              streamingIncome: 100,
              totalRepairCosts: 300,
              operatingCosts: 50,
              netProfit: 950,
            },
          ],
          robotMetrics: [],
        },
        {
          cycleNumber: 2,
          endTime: new Date('2024-01-02'),
          stableMetrics: [
            {
              userId: 1,
              totalCreditsEarned: 1200,
              merchandisingIncome: 250,
              streamingIncome: 150,
              totalRepairCosts: 400,
              operatingCosts: 60,
              netProfit: 1140,
            },
          ],
          robotMetrics: [],
        },
      ];

      (cycleSnapshotService.getSnapshotRange as jest.Mock).mockResolvedValue(mockSnapshots as any);

      const result = await service.analyzeTrend(1, null, 'income', [1, 2], false, false);

      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toEqual({
        cycleNumber: 1,
        value: 1300, // 1000 + 200 + 100
        timestamp: new Date('2024-01-01'),
      });
      expect(result.data[1]).toEqual({
        cycleNumber: 2,
        value: 1600, // 1200 + 250 + 150
        timestamp: new Date('2024-01-02'),
      });
    });

    it('should extract robot-level ELO data correctly', async () => {
      const mockSnapshots = [
        {
          cycleNumber: 1,
          endTime: new Date('2024-01-01'),
          stableMetrics: [],
          robotMetrics: [
            {
              robotId: 10,
              eloChange: 25,
              fameChange: 10,
              battlesParticipated: 3,
              wins: 2,
              losses: 1,
              damageDealt: 500,
              damageReceived: 300,
            },
          ],
        },
        {
          cycleNumber: 2,
          endTime: new Date('2024-01-02'),
          stableMetrics: [],
          robotMetrics: [
            {
              robotId: 10,
              eloChange: -15,
              fameChange: 5,
              battlesParticipated: 2,
              wins: 0,
              losses: 2,
              damageDealt: 200,
              damageReceived: 600,
            },
          ],
        },
      ];

      (cycleSnapshotService.getSnapshotRange as jest.Mock).mockResolvedValue(mockSnapshots as any);

      const result = await service.analyzeTrend(null, 10, 'elo', [1, 2], false, false);

      expect(result.data).toHaveLength(2);
      expect(result.data[0].value).toBe(25);
      expect(result.data[1].value).toBe(-15);
    });

    it('should calculate 3-cycle moving average correctly', async () => {
      const mockSnapshots = [
        {
          cycleNumber: 1,
          endTime: new Date('2024-01-01'),
          stableMetrics: [{ userId: 1, netProfit: 100 }],
          robotMetrics: [],
        },
        {
          cycleNumber: 2,
          endTime: new Date('2024-01-02'),
          stableMetrics: [{ userId: 1, netProfit: 200 }],
          robotMetrics: [],
        },
        {
          cycleNumber: 3,
          endTime: new Date('2024-01-03'),
          stableMetrics: [{ userId: 1, netProfit: 300 }],
          robotMetrics: [],
        },
        {
          cycleNumber: 4,
          endTime: new Date('2024-01-04'),
          stableMetrics: [{ userId: 1, netProfit: 400 }],
          robotMetrics: [],
        },
      ];

      (cycleSnapshotService.getSnapshotRange as jest.Mock).mockResolvedValue(mockSnapshots as any);

      const result = await service.analyzeTrend(1, null, 'netProfit', [1, 4], true, false);

      expect(result.movingAverage3).toBeDefined();
      expect(result.movingAverage3).toHaveLength(2);
      
      // First MA3: (100 + 200 + 300) / 3 = 200
      expect(result.movingAverage3![0]).toEqual({
        cycleNumber: 3,
        value: 300,
        average: 200,
      });
      
      // Second MA3: (200 + 300 + 400) / 3 = 300
      expect(result.movingAverage3![1]).toEqual({
        cycleNumber: 4,
        value: 400,
        average: 300,
      });
    });

    it('should calculate 7-cycle moving average correctly', async () => {
      const mockSnapshots = Array.from({ length: 10 }, (_, i) => ({
        cycleNumber: i + 1,
        endTime: new Date(`2024-01-${String(i + 1).padStart(2, '0')}`),
        stableMetrics: [{ userId: 1, netProfit: (i + 1) * 100 }],
        robotMetrics: [],
      }));

      (cycleSnapshotService.getSnapshotRange as jest.Mock).mockResolvedValue(mockSnapshots as any);

      const result = await service.analyzeTrend(1, null, 'netProfit', [1, 10], true, false);

      expect(result.movingAverage7).toBeDefined();
      expect(result.movingAverage7).toHaveLength(4); // 10 - 7 + 1 = 4

      // First MA7: (100 + 200 + 300 + 400 + 500 + 600 + 700) / 7 = 400
      expect(result.movingAverage7![0].average).toBe(400);
    });

    it('should calculate trend line correctly', async () => {
      const mockSnapshots = [
        {
          cycleNumber: 1,
          endTime: new Date('2024-01-01'),
          stableMetrics: [{ userId: 1, netProfit: 100 }],
          robotMetrics: [],
        },
        {
          cycleNumber: 2,
          endTime: new Date('2024-01-02'),
          stableMetrics: [{ userId: 1, netProfit: 200 }],
          robotMetrics: [],
        },
        {
          cycleNumber: 3,
          endTime: new Date('2024-01-03'),
          stableMetrics: [{ userId: 1, netProfit: 300 }],
          robotMetrics: [],
        },
      ];

      (cycleSnapshotService.getSnapshotRange as jest.Mock).mockResolvedValue(mockSnapshots as any);

      const result = await service.analyzeTrend(1, null, 'netProfit', [1, 3], false, true);

      expect(result.trendLine).toBeDefined();
      expect(result.trendLine!.slope).toBe(100); // Perfect linear increase of 100 per cycle
      expect(result.trendLine!.intercept).toBe(0); // Line passes through origin when adjusted
      expect(result.trendLine!.points).toHaveLength(3);
    });

    it('should handle missing user data gracefully', async () => {
      const mockSnapshots = [
        {
          cycleNumber: 1,
          endTime: new Date('2024-01-01'),
          stableMetrics: [{ userId: 2, netProfit: 100 }], // Different user
          robotMetrics: [],
        },
      ];

      (cycleSnapshotService.getSnapshotRange as jest.Mock).mockResolvedValue(mockSnapshots as any);

      const result = await service.analyzeTrend(1, null, 'netProfit', [1, 1], false, false);

      expect(result.data).toHaveLength(0);
    });

    it('should handle missing robot data gracefully', async () => {
      const mockSnapshots = [
        {
          cycleNumber: 1,
          endTime: new Date('2024-01-01'),
          stableMetrics: [],
          robotMetrics: [{ robotId: 20, eloChange: 10 }], // Different robot
        },
      ];

      (cycleSnapshotService.getSnapshotRange as jest.Mock).mockResolvedValue(mockSnapshots as any);

      const result = await service.analyzeTrend(null, 10, 'elo', [1, 1], false, false);

      expect(result.data).toHaveLength(0);
    });
  });

  describe('getCumulativeELOProgression', () => {
    it('should calculate cumulative ELO correctly', async () => {
      const mockSnapshots = [
        {
          cycleNumber: 1,
          endTime: new Date('2024-01-01'),
          robotMetrics: [{ robotId: 10, eloChange: 25 }],
        },
        {
          cycleNumber: 2,
          endTime: new Date('2024-01-02'),
          robotMetrics: [{ robotId: 10, eloChange: -15 }],
        },
        {
          cycleNumber: 3,
          endTime: new Date('2024-01-03'),
          robotMetrics: [{ robotId: 10, eloChange: 30 }],
        },
      ];

      (cycleSnapshotService.getSnapshotRange as jest.Mock).mockResolvedValue(mockSnapshots as any);

      const result = await service.getCumulativeELOProgression(10, [1, 3]);

      expect(result).toHaveLength(3);
      expect(result[0].value).toBe(25);
      expect(result[1].value).toBe(10); // 25 + (-15)
      expect(result[2].value).toBe(40); // 10 + 30
    });

    it('should return empty array when robot has no data', async () => {
      const mockSnapshots = [
        {
          cycleNumber: 1,
          endTime: new Date('2024-01-01'),
          robotMetrics: [{ robotId: 20, eloChange: 25 }],
        },
      ];

      (cycleSnapshotService.getSnapshotRange as jest.Mock).mockResolvedValue(mockSnapshots as any);

      const result = await service.getCumulativeELOProgression(10, [1, 1]);

      expect(result).toHaveLength(0);
    });
  });

  describe('getCumulativeNetProfit', () => {
    it('should calculate cumulative net profit correctly', async () => {
      const mockSnapshots = [
        {
          cycleNumber: 1,
          endTime: new Date('2024-01-01'),
          stableMetrics: [{ userId: 1, netProfit: 1000 }],
        },
        {
          cycleNumber: 2,
          endTime: new Date('2024-01-02'),
          stableMetrics: [{ userId: 1, netProfit: -500 }],
        },
        {
          cycleNumber: 3,
          endTime: new Date('2024-01-03'),
          stableMetrics: [{ userId: 1, netProfit: 2000 }],
        },
      ];

      (cycleSnapshotService.getSnapshotRange as jest.Mock).mockResolvedValue(mockSnapshots as any);

      const result = await service.getCumulativeNetProfit(1, [1, 3]);

      expect(result).toHaveLength(3);
      expect(result[0].value).toBe(1000);
      expect(result[1].value).toBe(500); // 1000 + (-500)
      expect(result[2].value).toBe(2500); // 500 + 2000
    });

    it('should return empty array when user has no data', async () => {
      const mockSnapshots = [
        {
          cycleNumber: 1,
          endTime: new Date('2024-01-01'),
          stableMetrics: [{ userId: 2, netProfit: 1000 }],
        },
      ];

      (cycleSnapshotService.getSnapshotRange as jest.Mock).mockResolvedValue(mockSnapshots as any);

      const result = await service.getCumulativeNetProfit(1, [1, 1]);

      expect(result).toHaveLength(0);
    });
  });

  describe('edge cases', () => {
    it('should handle single data point for moving average', async () => {
      const mockSnapshots = [
        {
          cycleNumber: 1,
          endTime: new Date('2024-01-01'),
          stableMetrics: [{ userId: 1, netProfit: 100 }],
          robotMetrics: [],
        },
      ];

      (cycleSnapshotService.getSnapshotRange as jest.Mock).mockResolvedValue(mockSnapshots as any);

      const result = await service.analyzeTrend(1, null, 'netProfit', [1, 1], true, false);

      expect(result.movingAverage3).toEqual([]);
      expect(result.movingAverage7).toEqual([]);
    });

    it('should handle single data point for trend line', async () => {
      const mockSnapshots = [
        {
          cycleNumber: 1,
          endTime: new Date('2024-01-01'),
          stableMetrics: [{ userId: 1, netProfit: 100 }],
          robotMetrics: [],
        },
      ];

      (cycleSnapshotService.getSnapshotRange as jest.Mock).mockResolvedValue(mockSnapshots as any);

      const result = await service.analyzeTrend(1, null, 'netProfit', [1, 1], false, true);

      expect(result.trendLine).toBeUndefined();
    });

    it('should handle zero values correctly', async () => {
      const mockSnapshots = [
        {
          cycleNumber: 1,
          endTime: new Date('2024-01-01'),
          stableMetrics: [{ userId: 1, netProfit: 0 }],
          robotMetrics: [],
        },
        {
          cycleNumber: 2,
          endTime: new Date('2024-01-02'),
          stableMetrics: [{ userId: 1, netProfit: 0 }],
          robotMetrics: [],
        },
      ];

      (cycleSnapshotService.getSnapshotRange as jest.Mock).mockResolvedValue(mockSnapshots as any);

      const result = await service.analyzeTrend(1, null, 'netProfit', [1, 2], false, true);

      expect(result.data).toHaveLength(2);
      expect(result.data[0].value).toBe(0);
      expect(result.data[1].value).toBe(0);
      expect(result.trendLine!.slope).toBe(0);
    });

    it('should handle negative values correctly', async () => {
      const mockSnapshots = [
        {
          cycleNumber: 1,
          endTime: new Date('2024-01-01'),
          stableMetrics: [{ userId: 1, netProfit: -100 }],
          robotMetrics: [],
        },
        {
          cycleNumber: 2,
          endTime: new Date('2024-01-02'),
          stableMetrics: [{ userId: 1, netProfit: -200 }],
          robotMetrics: [],
        },
      ];

      (cycleSnapshotService.getSnapshotRange as jest.Mock).mockResolvedValue(mockSnapshots as any);

      const result = await service.analyzeTrend(1, null, 'netProfit', [1, 2], false, true);

      expect(result.data[0].value).toBe(-100);
      expect(result.data[1].value).toBe(-200);
      expect(result.trendLine!.slope).toBe(-100); // Negative slope
    });
  });
});
