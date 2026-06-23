import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  Column,
  Index,
  CreateDateColumn,
} from 'typeorm';
import { Conversation } from './conversation.entity';

export enum SenderType {
  CUSTOMER = 'CUSTOMER',
  BUSINESS = 'BUSINESS',
}

@Entity()
@Index('idx_message_conversation_created', ['conversation', 'createdAt'])
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Conversation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversation_id' })
  conversation: Conversation;

  @Column({ type: 'varchar', length: 10 })
  senderType: SenderType;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'timestamp', nullable: true })
  readAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
