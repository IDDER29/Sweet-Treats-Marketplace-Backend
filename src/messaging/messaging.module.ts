import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Conversation } from './entities/conversation.entity';
import { Message } from './entities/message.entity';
import { Business } from '../business/entities/business.entity';
import { MessagingService } from './messaging.service';
import { MessagingController } from './messaging.controller';
import { BusinessMessagingController } from './business-messaging.controller';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Conversation, Message, Business]),
    NotificationModule,
  ],
  providers: [MessagingService],
  controllers: [MessagingController, BusinessMessagingController],
})
export class MessagingModule {}
