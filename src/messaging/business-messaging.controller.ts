import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { MessagingService } from './messaging.service';
import { SendMessageDto } from './dto/send-message.dto';

// Seller side of messaging. Mounted under /seller (not /business) so the list
// route doesn't collide with BusinessController's GET /business/:id.
@UseGuards(AuthGuard('business-jwt'))
@Controller('seller/conversations')
export class BusinessMessagingController {
  constructor(private readonly messaging: MessagingService) {}

  @Get()
  list(
    @Request() req,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.messaging.listForBusiness(req.user.businessId, {
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get(':id/messages')
  messages(@Request() req, @Param('id') id: string) {
    return this.messaging.getMessages(id, {
      businessId: req.user.businessId,
    });
  }

  @Throttle({ short: { limit: 20, ttl: 60000 } })
  @Post(':id/messages')
  reply(@Request() req, @Param('id') id: string, @Body() dto: SendMessageDto) {
    return this.messaging.sendFromBusiness(req.user.businessId, id, dto.body);
  }
}
