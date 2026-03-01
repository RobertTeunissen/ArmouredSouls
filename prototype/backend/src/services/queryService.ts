import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

export interface EventFilters {
  cycleRange?: [number, number];
  cycleNumber?: number;
  userId?: number;
  robotId?: number;
  eventType?: string[];
  dateRange?: [Date, Date];
  limit?: number;
  offset?: number;
  sortBy?: 'timestamp' | 'sequence' | 'cycle';
  sortOrder?: 'asc' | 'desc';
}

export interface AuditLogEntry {
  id: bigint;
  cycleNumber: number;
  eventType: string;
  eventTimestamp: Date;
  sequenceNumber: number;
  userId: number | null;
  robotId: number | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: Record<string, any> | null;
}

export interface QueryResult {
  events: AuditLogEntry[];
  total: number;
  hasMore: boolean;
  filters: EventFilters;
}

export class QueryService {
  /**
   * Query audit log events with flexible filtering
   * Validates: Requirements 9.2, 9.5
   */
  async queryEvents(filters: EventFilters): Promise<QueryResult> {
    // Build where clause
    const where: Prisma.AuditLogWhereInput = {};

    // Cycle filtering
    if (filters.cycleNumber !== undefined) {
      where.cycleNumber = filters.cycleNumber;
    } else if (filters.cycleRange) {
      where.cycleNumber = {
        gte: filters.cycleRange[0],
        lte: filters.cycleRange[1],
      };
    }

    // User filtering
    if (filters.userId !== undefined) {
      where.userId = filters.userId;
    }

    // Robot filtering
    if (filters.robotId !== undefined) {
      where.robotId = filters.robotId;
    }

    // Event type filtering
    if (filters.eventType && filters.eventType.length > 0) {
      where.eventType = {
        in: filters.eventType,
      };
    }

    // Date range filtering
    if (filters.dateRange) {
      where.eventTimestamp = {
        gte: filters.dateRange[0],
        lte: filters.dateRange[1],
      };
    }

    // Build order by clause
    let orderBy: Prisma.AuditLogOrderByWithRelationInput | Prisma.AuditLogOrderByWithRelationInput[];
    
    switch (filters.sortBy) {
      case 'timestamp':
        orderBy = { eventTimestamp: filters.sortOrder || 'asc' };
        break;
      case 'sequence':
        orderBy = { sequenceNumber: filters.sortOrder || 'asc' };
        break;
      case 'cycle':
        orderBy = { cycleNumber: filters.sortOrder || 'asc' };
        break;
      default:
        // Default: sort by cycle and sequence (array for multiple fields)
        orderBy = [
          { cycleNumber: 'asc' },
          { sequenceNumber: 'asc' },
        ];
    }

    // Get total count
    const total = await prisma.auditLog.count({ where });

    // Get paginated results
    const limit = filters.limit || 100;
    const offset = filters.offset || 0;

    const events = await prisma.auditLog.findMany({
      where,
      orderBy,
      take: limit,
      skip: offset,
    });

    return {
      events: events.map(e => ({
        id: e.id,
        cycleNumber: e.cycleNumber,
        eventType: e.eventType,
        eventTimestamp: e.eventTimestamp,
        sequenceNumber: e.sequenceNumber,
        userId: e.userId,
        robotId: e.robotId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        payload: e.payload as Record<string, any>,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        metadata: e.metadata as Record<string, any> | null,
      })),
      total,
      hasMore: offset + events.length < total,
      filters,
    };
  }

  /**
   * Query events for a specific cycle
   * Validates: Requirements 9.2, 9.5
   */
  async getEventsByCycle(cycleNumber: number): Promise<AuditLogEntry[]> {
    const result = await this.queryEvents({ cycleNumber });
    return result.events;
  }

  /**
   * Query events for a specific user
   * Validates: Requirements 9.2, 9.5
   */
  async getEventsByUser(
    userId: number,
    cycleRange?: [number, number]
  ): Promise<AuditLogEntry[]> {
    const result = await this.queryEvents({ userId, cycleRange });
    return result.events;
  }

  /**
   * Query events for a specific robot
   * Validates: Requirements 9.2, 9.5
   */
  async getEventsByRobot(
    robotId: number,
    cycleRange?: [number, number]
  ): Promise<AuditLogEntry[]> {
    const result = await this.queryEvents({ robotId, cycleRange });
    return result.events;
  }

  /**
   * Query events by type
   * Validates: Requirements 9.2, 9.5
   */
  async getEventsByType(
    eventType: string[],
    cycleRange?: [number, number]
  ): Promise<AuditLogEntry[]> {
    const result = await this.queryEvents({ eventType, cycleRange });
    return result.events;
  }

  /**
   * Query events by date range
   * Validates: Requirements 9.2, 9.5
   */
  async getEventsByDateRange(
    startDate: Date,
    endDate: Date
  ): Promise<AuditLogEntry[]> {
    const result = await this.queryEvents({ dateRange: [startDate, endDate] });
    return result.events;
  }

  /**
   * Get paginated events with cursor-based pagination
   * Validates: Requirements 9.5
   */
  async getPaginatedEvents(
    filters: EventFilters,
    page: number = 1,
    pageSize: number = 50
  ): Promise<QueryResult> {
    const offset = (page - 1) * pageSize;
    return this.queryEvents({
      ...filters,
      limit: pageSize,
      offset,
    });
  }

  /**
   * Search events by payload content (JSONB search)
   * Validates: Requirements 9.2, 9.5
   */
  async searchEventsByPayload(
    searchKey: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    searchValue: any,
    cycleRange?: [number, number]
  ): Promise<AuditLogEntry[]> {
    const where: Prisma.AuditLogWhereInput = {
      payload: {
        path: [searchKey],
        equals: searchValue,
      },
    };

    if (cycleRange) {
      where.cycleNumber = {
        gte: cycleRange[0],
        lte: cycleRange[1],
      };
    }

    const events = await prisma.auditLog.findMany({
      where,
      orderBy: [
        { cycleNumber: 'asc' },
        { sequenceNumber: 'asc' },
      ],
    });

    return events.map(e => ({
      id: e.id,
      cycleNumber: e.cycleNumber,
      eventType: e.eventType,
      eventTimestamp: e.eventTimestamp,
      sequenceNumber: e.sequenceNumber,
      userId: e.userId,
      robotId: e.robotId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      payload: e.payload as Record<string, any>,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      metadata: e.metadata as Record<string, any> | null,
    }));
  }

  /**
   * Get event statistics for a cycle range
   * Validates: Requirements 9.2
   */
  async getEventStatistics(cycleRange: [number, number]): Promise<{
    totalEvents: number;
    eventsByType: Record<string, number>;
    eventsByCycle: Record<number, number>;
    uniqueUsers: number;
    uniqueRobots: number;
  }> {
    const events = await prisma.auditLog.findMany({
      where: {
        cycleNumber: {
          gte: cycleRange[0],
          lte: cycleRange[1],
        },
      },
      select: {
        eventType: true,
        cycleNumber: true,
        userId: true,
        robotId: true,
      },
    });

    const eventsByType: Record<string, number> = {};
    const eventsByCycle: Record<number, number> = {};
    const uniqueUsers = new Set<number>();
    const uniqueRobots = new Set<number>();

    for (const event of events) {
      // Count by type
      eventsByType[event.eventType] = (eventsByType[event.eventType] || 0) + 1;

      // Count by cycle
      eventsByCycle[event.cycleNumber] = (eventsByCycle[event.cycleNumber] || 0) + 1;

      // Track unique users
      if (event.userId !== null) {
        uniqueUsers.add(event.userId);
      }

      // Track unique robots
      if (event.robotId !== null) {
        uniqueRobots.add(event.robotId);
      }
    }

    return {
      totalEvents: events.length,
      eventsByType,
      eventsByCycle,
      uniqueUsers: uniqueUsers.size,
      uniqueRobots: uniqueRobots.size,
    };
  }

  /**
   * Get recent events (last N events)
   * Validates: Requirements 9.5
   */
  async getRecentEvents(limit: number = 100): Promise<AuditLogEntry[]> {
    const events = await prisma.auditLog.findMany({
      orderBy: [
        { cycleNumber: 'desc' },
        { sequenceNumber: 'desc' },
      ],
      take: limit,
    });

    return events.map(e => ({
      id: e.id,
      cycleNumber: e.cycleNumber,
      eventType: e.eventType,
      eventTimestamp: e.eventTimestamp,
      sequenceNumber: e.sequenceNumber,
      userId: e.userId,
      robotId: e.robotId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      payload: e.payload as Record<string, any>,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      metadata: e.metadata as Record<string, any> | null,
    }));
  }

  /**
   * Get events with metadata (for debugging calculations)
   * Validates: Requirements 9.1
   */
  async getEventsWithMetadata(
    cycleRange?: [number, number]
  ): Promise<AuditLogEntry[]> {
    const where: Prisma.AuditLogWhereInput = {
      metadata: {
        not: Prisma.DbNull,
      },
    };

    if (cycleRange) {
      where.cycleNumber = {
        gte: cycleRange[0],
        lte: cycleRange[1],
      };
    }

    const events = await prisma.auditLog.findMany({
      where,
      orderBy: [
        { cycleNumber: 'asc' },
        { sequenceNumber: 'asc' },
      ],
    });

    return events.map(e => ({
      id: e.id,
      cycleNumber: e.cycleNumber,
      eventType: e.eventType,
      eventTimestamp: e.eventTimestamp,
      sequenceNumber: e.sequenceNumber,
      userId: e.userId,
      robotId: e.robotId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      payload: e.payload as Record<string, any>,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      metadata: e.metadata as Record<string, any> | null,
    }));
  }

  /**
   * Count events matching filters
   * Validates: Requirements 9.5
   */
  async countEvents(filters: EventFilters): Promise<number> {
    const where: Prisma.AuditLogWhereInput = {};

    if (filters.cycleNumber !== undefined) {
      where.cycleNumber = filters.cycleNumber;
    } else if (filters.cycleRange) {
      where.cycleNumber = {
        gte: filters.cycleRange[0],
        lte: filters.cycleRange[1],
      };
    }

    if (filters.userId !== undefined) {
      where.userId = filters.userId;
    }

    if (filters.robotId !== undefined) {
      where.robotId = filters.robotId;
    }

    if (filters.eventType && filters.eventType.length > 0) {
      where.eventType = {
        in: filters.eventType,
      };
    }

    if (filters.dateRange) {
      where.eventTimestamp = {
        gte: filters.dateRange[0],
        lte: filters.dateRange[1],
      };
    }

    return prisma.auditLog.count({ where });
  }
}

export const queryService = new QueryService();
