import {
  calculateStorageCapacity,
  getStorageStatus,
} from '../src/utils/storageCalculations';

describe('Storage Calculations', () => {
  afterAll(() => {
    // Pure unit test - no cleanup needed
  });

  describe('calculateStorageCapacity', () => {
    it('should return base capacity of 5 at level 0', () => {
      expect(calculateStorageCapacity(0)).toBe(5);
    });

    it('should calculate capacity correctly for level 1', () => {
      expect(calculateStorageCapacity(1)).toBe(10); // 5 + (1 × 5)
    });

    it('should calculate capacity correctly for level 5', () => {
      expect(calculateStorageCapacity(5)).toBe(30); // 5 + (5 × 5)
    });

    it('should calculate max capacity correctly for level 10', () => {
      expect(calculateStorageCapacity(10)).toBe(55); // 5 + (10 × 5)
    });
  });

  describe('getStorageStatus', () => {
    it('should return correct status when empty', () => {
      const status = getStorageStatus(0, 0);

      expect(status.currentWeapons).toBe(0);
      expect(status.maxCapacity).toBe(5);
      expect(status.remainingSlots).toBe(5);
      expect(status.isFull).toBe(false);
      expect(status.percentageFull).toBe(0);
    });

    it('should return correct status when partially full', () => {
      const status = getStorageStatus(3, 1); // 3/10

      expect(status.currentWeapons).toBe(3);
      expect(status.maxCapacity).toBe(10);
      expect(status.remainingSlots).toBe(7);
      expect(status.isFull).toBe(false);
      expect(status.percentageFull).toBe(30);
    });

    it('should return correct status when full', () => {
      const status = getStorageStatus(5, 0); // 5/5

      expect(status.currentWeapons).toBe(5);
      expect(status.maxCapacity).toBe(5);
      expect(status.remainingSlots).toBe(0);
      expect(status.isFull).toBe(true);
      expect(status.percentageFull).toBe(100);
    });

    it('should handle over-capacity correctly', () => {
      const status = getStorageStatus(7, 0); // 7/5 (shouldn't happen, but handle it)

      expect(status.currentWeapons).toBe(7);
      expect(status.maxCapacity).toBe(5);
      expect(status.remainingSlots).toBe(0);
      expect(status.isFull).toBe(true);
      expect(status.percentageFull).toBe(100); // Capped at 100%
    });

    it('should calculate percentage correctly', () => {
      expect(getStorageStatus(15, 5).percentageFull).toBe(50); // 15/30 = 50%
      expect(getStorageStatus(20, 3).percentageFull).toBe(100); // 20/20 = 100%
      expect(getStorageStatus(1, 10).percentageFull).toBe(2); // 1/55 ≈ 2%
    });
  });
});
