import { AnalyticsService } from './analytics.service';

// Minimal chainable QueryBuilder stub: every builder method returns itself; the
// terminal getRaw*/getMany are stubbed per test.
const chainable = () => {
  const qb: any = {};
  for (const m of [
    'select',
    'addSelect',
    'where',
    'andWhere',
    'groupBy',
    'addGroupBy',
    'orderBy',
    'addOrderBy',
    'leftJoin',
    'limit',
  ]) {
    qb[m] = () => qb;
  }
  return qb;
};

// Build a DataSource whose createQueryBuilder yields qbs configured by `setup`,
// in call order.
const dataSourceWith = (setups: ((qb: any) => void)[]) => {
  let i = 0;
  return {
    getRepository: () => ({
      createQueryBuilder: () => {
        const qb = chainable();
        (setups[i++] || (() => undefined))(qb);
        return qb;
      },
    }),
  } as any;
};

describe('AnalyticsService', () => {
  describe('getSalesOverview', () => {
    it('computes average order value and coalesces null revenue', async () => {
      const svc = new AnalyticsService(
        dataSourceWith([
          (qb) =>
            (qb.getRawOne = jest
              .fn()
              .mockResolvedValue({ totalRevenue: '300.00', totalOrders: '3' })),
          (qb) => (qb.getRawOne = jest.fn().mockResolvedValue({ count: '1' })),
          (qb) => (qb.getRawOne = jest.fn().mockResolvedValue({ count: '2' })),
        ]),
      );
      const r = await svc.getSalesOverview('b1');
      expect(r.totalRevenue).toBe(300);
      expect(r.totalOrders).toBe(3);
      expect(r.averageOrderValue).toBe(100);
      expect(r.cancelledOrders).toBe(1);
      expect(r.pendingOrders).toBe(2);
    });

    it('returns AOV 0 (no divide-by-zero) when there are no orders', async () => {
      const svc = new AnalyticsService(
        dataSourceWith([
          (qb) =>
            (qb.getRawOne = jest
              .fn()
              .mockResolvedValue({ totalRevenue: null, totalOrders: '0' })),
          (qb) => (qb.getRawOne = jest.fn().mockResolvedValue({ count: '0' })),
          (qb) => (qb.getRawOne = jest.fn().mockResolvedValue({ count: '0' })),
        ]),
      );
      const r = await svc.getSalesOverview('b1');
      expect(r.totalRevenue).toBe(0);
      expect(r.totalOrders).toBe(0);
      expect(r.averageOrderValue).toBe(0);
    });
  });

  describe('getInventoryReport', () => {
    it('classifies out-of-stock (0) and low-stock (1..5), excluding healthy', async () => {
      const products = [
        { id: 'p0', stockQuantity: 0 },
        { id: 'p3', stockQuantity: 3 },
        { id: 'p5', stockQuantity: 5 },
        { id: 'p20', stockQuantity: 20 },
      ];
      const svc = new AnalyticsService(
        dataSourceWith([
          (qb) => (qb.getMany = jest.fn().mockResolvedValue(products)),
        ]),
      );
      const r = await svc.getInventoryReport('b1');
      expect(r.totalTracked).toBe(4);
      expect(r.outOfStock.map((p: any) => p.id)).toEqual(['p0']);
      expect(r.lowStock.map((p: any) => p.id)).toEqual(['p3', 'p5']);
    });
  });

  describe('getTopProducts', () => {
    it('maps aggregate rows with numeric coercion', async () => {
      const rows = [
        {
          productId: 'p1',
          productName: 'Cake',
          totalSold: '7',
          revenue: '140.50',
        },
      ];
      const svc = new AnalyticsService(
        dataSourceWith([
          (qb) => (qb.getRawMany = jest.fn().mockResolvedValue(rows)),
        ]),
      );
      const r = await svc.getTopProducts('b1', 5);
      expect(r[0]).toEqual({
        productId: 'p1',
        productName: 'Cake',
        totalSold: 7,
        revenue: 140.5,
      });
    });
  });
});
