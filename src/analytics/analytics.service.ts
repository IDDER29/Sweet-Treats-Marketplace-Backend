import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Order } from '../order/entities/order.entity';
import { OrderItem } from '../order/entities/order-item.entity';
import { Product } from '../product/entities/product.entity';

@Injectable()
export class AnalyticsService {
  constructor(private readonly dataSource: DataSource) {}

  async getSalesOverview(businessId: string, from?: string, to?: string) {
    const defaultFrom = new Date();
    defaultFrom.setDate(defaultFrom.getDate() - 30);

    const fromDate = from ? new Date(from) : defaultFrom;
    const toDate = to ? new Date(to) : new Date();

    // Revenue / order stats: exclude CANCELLED and PENDING
    const revenueQb = this.dataSource
      .getRepository(Order)
      .createQueryBuilder('order')
      .select('SUM(order.totalAmount)', 'totalRevenue')
      .addSelect('COUNT(*)', 'totalOrders')
      .where('order.business = :businessId', { businessId })
      .andWhere('order.status NOT IN (:...statuses)', {
        statuses: ['CANCELLED', 'PENDING'],
      })
      .andWhere('order.createdAt >= :from', { from: fromDate })
      .andWhere('order.createdAt <= :to', { to: toDate });

    const revenueResult = await revenueQb.getRawOne();

    const totalRevenue = parseFloat(revenueResult?.totalRevenue ?? '0') || 0;
    const totalOrders = parseInt(revenueResult?.totalOrders ?? '0', 10) || 0;
    const averageOrderValue =
      totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Cancelled orders count
    const cancelledResult = await this.dataSource
      .getRepository(Order)
      .createQueryBuilder('order')
      .select('COUNT(*)', 'count')
      .where('order.business = :businessId', { businessId })
      .andWhere('order.status = :status', { status: 'CANCELLED' })
      .andWhere('order.createdAt >= :from', { from: fromDate })
      .andWhere('order.createdAt <= :to', { to: toDate })
      .getRawOne();

    // Pending orders count
    const pendingResult = await this.dataSource
      .getRepository(Order)
      .createQueryBuilder('order')
      .select('COUNT(*)', 'count')
      .where('order.business = :businessId', { businessId })
      .andWhere('order.status = :status', { status: 'PENDING' })
      .andWhere('order.createdAt >= :from', { from: fromDate })
      .andWhere('order.createdAt <= :to', { to: toDate })
      .getRawOne();

    return {
      totalRevenue,
      totalOrders,
      averageOrderValue,
      cancelledOrders: parseInt(cancelledResult?.count ?? '0', 10) || 0,
      pendingOrders: parseInt(pendingResult?.count ?? '0', 10) || 0,
      from: fromDate,
      to: toDate,
    };
  }

  async getTopProducts(
    businessId: string,
    limit = 10,
    from?: string,
    to?: string,
  ) {
    const defaultFrom = new Date();
    defaultFrom.setDate(defaultFrom.getDate() - 30);

    const fromDate = from ? new Date(from) : defaultFrom;
    const toDate = to ? new Date(to) : new Date();

    const qb = this.dataSource
      .getRepository(OrderItem)
      .createQueryBuilder('item')
      .leftJoin('item.order', 'order')
      .leftJoin('item.product', 'product')
      .select('product.id', 'productId')
      .addSelect('product.name', 'productName')
      .addSelect('SUM(item.quantity)', 'totalSold')
      .addSelect('SUM(item.quantity * item.unitPrice)', 'revenue')
      .where('order.business = :businessId', { businessId })
      .andWhere('order.status NOT IN (:...statuses)', {
        statuses: ['CANCELLED'],
      })
      .andWhere('order.createdAt >= :from', { from: fromDate })
      .andWhere('order.createdAt <= :to', { to: toDate })
      .groupBy('product.id')
      .addGroupBy('product.name')
      .orderBy('SUM(item.quantity)', 'DESC')
      .limit(limit);

    const rows = await qb.getRawMany();

    return rows.map((r) => ({
      productId: r.productId,
      productName: r.productName,
      totalSold: parseInt(r.totalSold ?? '0', 10) || 0,
      revenue: parseFloat(r.revenue ?? '0') || 0,
    }));
  }

  async getRevenueByDay(businessId: string, from?: string, to?: string) {
    const defaultFrom = new Date();
    defaultFrom.setDate(defaultFrom.getDate() - 30);

    const fromDate = from ? new Date(from) : defaultFrom;
    const toDate = to ? new Date(to) : new Date();

    const rows = await this.dataSource
      .getRepository(Order)
      .createQueryBuilder('order')
      .select('DATE(order.createdAt)', 'date')
      .addSelect('SUM(order.totalAmount)', 'revenue')
      .addSelect('COUNT(*)', 'orders')
      .where('order.business = :businessId', { businessId })
      .andWhere('order.status NOT IN (:...statuses)', {
        statuses: ['CANCELLED', 'PENDING'],
      })
      .andWhere('order.createdAt >= :from', { from: fromDate })
      .andWhere('order.createdAt <= :to', { to: toDate })
      .groupBy('DATE(order.createdAt)')
      .orderBy('date', 'ASC')
      .getRawMany();

    return rows.map((r) => ({
      date: r.date,
      revenue: parseFloat(r.revenue ?? '0') || 0,
      orders: parseInt(r.orders ?? '0', 10) || 0,
    }));
  }

  async getOrderStatusBreakdown(businessId: string) {
    const rows = await this.dataSource
      .getRepository(Order)
      .createQueryBuilder('order')
      .select('order.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('order.business = :businessId', { businessId })
      .groupBy('order.status')
      .getRawMany();

    return rows.map((r) => ({
      status: r.status,
      count: parseInt(r.count ?? '0', 10) || 0,
    }));
  }

  async getInventoryReport(businessId: string) {
    const products = await this.dataSource
      .getRepository(Product)
      .createQueryBuilder('product')
      .where('product.business = :businessId', { businessId })
      .andWhere('product.trackStock = true')
      .orderBy('product.stockQuantity', 'ASC')
      .getMany();

    const outOfStock = products.filter((p) => p.stockQuantity === 0);
    const lowStock = products.filter(
      (p) => p.stockQuantity > 0 && p.stockQuantity <= 5,
    );

    return {
      outOfStock,
      lowStock,
      totalTracked: products.length,
    };
  }
}
