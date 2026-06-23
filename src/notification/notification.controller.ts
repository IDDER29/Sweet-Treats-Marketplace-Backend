import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { NotificationService } from './notification.service';

@UseGuards(AuthGuard('jwt'))
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notifications: NotificationService) {}

  @Get()
  list(
    @Request() req,
    @Query('unread') unread?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.notifications.findForUser(req.user.userId, {
      unreadOnly: unread === 'true',
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('unread-count')
  async unreadCount(@Request() req) {
    return { count: await this.notifications.unreadCount(req.user.userId) };
  }

  @Patch(':id/read')
  markRead(@Request() req, @Param('id') id: string) {
    return this.notifications.markRead(req.user.userId, id);
  }

  @Post('read-all')
  markAllRead(@Request() req) {
    return this.notifications.markAllRead(req.user.userId);
  }
}
