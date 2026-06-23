import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { MessagingService } from './messaging.service';
import { SendMessageDto } from './dto/send-message.dto';

// Customer side of messaging.
@UseGuards(AuthGuard('jwt'))
@Controller('conversations')
export class MessagingController {
  constructor(private readonly messaging: MessagingService) {}

  @Get()
  list(@Request() req) {
    return this.messaging.listForCustomer(req.user.userId);
  }

  @Throttle({ short: { limit: 20, ttl: 60000 } })
  @Post('business/:businessId')
  send(
    @Request() req,
    @Param('businessId') businessId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.messaging.sendFromCustomer(
      req.user.userId,
      businessId,
      dto.body,
    );
  }

  @Get(':id/messages')
  messages(@Request() req, @Param('id') id: string) {
    return this.messaging.getMessages(id, { customerId: req.user.userId });
  }
}
