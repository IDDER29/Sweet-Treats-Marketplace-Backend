import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { Business } from '../business/entities/business.entity';
import { Product } from '../product/entities/product.entity';
import { Category } from '../category/entities/category.entity';
import { Users } from '../entities/users.entity';
import { Order } from '../order/entities/order.entity';
import { OrderItem } from '../order/entities/order-item.entity';
import { Review } from '../review/entities/review.entity';
import { Payment } from '../payment/entities/payment.entity';
import { DeliverySlot } from '../delivery/entities/delivery-slot.entity';
import { DiscountCode } from '../discount/entities/discount-code.entity';
import { DiscountCodeUsage } from '../discount/entities/discount-code-usage.entity';
import { CustomOrderRequest } from '../custom-order/entities/custom-order-request.entity';
import { AuditLog } from '../audit/entities/audit-log.entity';
import { Cart } from '../cart/entities/cart.entity';
import { CartItem } from '../cart/entities/cart-item.entity';
import { Address } from '../address/entities/address.entity';
import { Notification } from '../notification/entities/notification.entity';
import { Favorite } from '../favorites/entities/favorite.entity';
import { ShopFollow } from '../favorites/entities/shop-follow.entity';
import { Driver } from '../driver/entities/driver.entity';
import { Conversation } from '../messaging/entities/conversation.entity';
import { Message } from '../messaging/entities/message.entity';

const entities = [
  Business,
  Product,
  Category,
  Users,
  Order,
  OrderItem,
  Review,
  Payment,
  DeliverySlot,
  DiscountCode,
  DiscountCodeUsage,
  CustomOrderRequest,
  AuditLog,
  Cart,
  CartItem,
  Address,
  Notification,
  Favorite,
  ShopFollow,
  Driver,
  Conversation,
  Message,
];

interface Endpoint {
  host: string;
  port: number;
}

// DB_REPLICA_HOSTS is a comma-separated list of "host" or "host:port"; a missing
// port falls back to DB_PORT. Empty/whitespace entries are ignored.
export function parseReplicaHosts(
  raw = process.env.DB_REPLICA_HOSTS,
  defaultPort = parseInt(process.env.DB_PORT, 10) || 5432,
): Endpoint[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((entry) => {
      const [host, port] = entry.split(':');
      return { host, port: port ? parseInt(port, 10) : defaultPort };
    })
    .filter((e) => e.host);
}

/**
 * TypeORM options. With DB_REPLICA_HOSTS set, enables read/write splitting:
 * writes + migrations go to the master (DB_HOST), and SELECTs fan out to the
 * replicas (TypeORM picks a slave per read). Without it, a single connection —
 * identical to the original behaviour, so dev/test/CI are unaffected.
 */
export function buildTypeOrmOptions(): TypeOrmModuleOptions {
  const credentials = {
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  };
  const common = {
    type: 'postgres' as const,
    entities,
    synchronize: process.env.NODE_ENV !== 'production',
    migrations: ['dist/migrations/*.js'],
    migrationsRun: process.env.NODE_ENV === 'production',
    // Bound the connection pool so N API replicas can't exhaust Postgres, and
    // cap query time so one slow/runaway statement can't pin a connection.
    extra: {
      max: parseInt(process.env.DB_POOL_SIZE, 10) || 10,
      statement_timeout:
        parseInt(process.env.DB_STATEMENT_TIMEOUT_MS, 10) || 10000,
    },
  };

  const master: Endpoint = {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10) || 5432,
  };
  const replicas = parseReplicaHosts();

  if (replicas.length > 0) {
    return {
      ...common,
      replication: {
        master: { ...master, ...credentials },
        slaves: replicas.map((r) => ({ ...r, ...credentials })),
      },
    };
  }

  return { ...common, ...master, ...credentials };
}
