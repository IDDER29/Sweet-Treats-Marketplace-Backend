import { Entity, PrimaryColumn, Column, ManyToOne } from 'typeorm';
import { Orders } from './orders.entity';
import { Products } from './products.entity';

@Entity()
export class OrderItems {
  @PrimaryColumn({ type: 'varchar', length: 255 })
  order_item_id: string;

  @ManyToOne(() => Orders, (order) => order.order_id)
  order_id: Orders;

  @ManyToOne(() => Products, (product) => product.product_id)
  product_id: Products;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  item_price: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  total_price: number;
}
