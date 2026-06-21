import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CustomOrderService } from './custom-order.service';
import { CreateCustomOrderDto } from './dto/create-custom-order.dto';
import { SubmitQuoteDto } from './dto/submit-quote.dto';
import { RespondToQuoteDto } from './dto/respond-to-quote.dto';
import { UpdateCustomOrderStatusDto } from './dto/update-custom-order-status.dto';

@Controller('custom-orders')
export class CustomOrderController {
  constructor(private readonly customOrderService: CustomOrderService) {}

  // --- Customer routes (JWT) ---

  /**
   * POST /custom-orders/:businessId
   * Customer submits a bespoke order request to a specific business.
   */
  @UseGuards(AuthGuard('jwt'))
  @Post(':businessId')
  create(
    @Request() req,
    @Param('businessId') businessId: string,
    @Body() dto: CreateCustomOrderDto,
  ) {
    return this.customOrderService.create(req.user.userId, businessId, dto);
  }

  /**
   * GET /custom-orders/my
   * Customer views all their custom order requests.
   * Must be declared before :id routes to prevent Express matching 'my' as an id.
   */
  @UseGuards(AuthGuard('jwt'))
  @Get('my')
  findMy(@Request() req) {
    return this.customOrderService.findForCustomer(req.user.userId);
  }

  /**
   * GET /custom-orders/my/:id
   * Customer views a single custom order request detail.
   */
  @UseGuards(AuthGuard('jwt'))
  @Get('my/:id')
  findMyOne(@Request() req, @Param('id') id: string) {
    return this.customOrderService.findOneForCustomer(req.user.userId, id);
  }

  /**
   * PATCH /custom-orders/my/:id/respond
   * Customer accepts or declines a quoted request.
   */
  @UseGuards(AuthGuard('jwt'))
  @Patch('my/:id/respond')
  respondToQuote(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: RespondToQuoteDto,
  ) {
    return this.customOrderService.respondToQuote(id, req.user.userId, dto);
  }

  /**
   * PATCH /custom-orders/my/:id/cancel
   * Customer cancels a pending or quoted request.
   */
  @UseGuards(AuthGuard('jwt'))
  @Patch('my/:id/cancel')
  cancel(@Request() req, @Param('id') id: string) {
    return this.customOrderService.cancel(id, req.user.userId);
  }

  // --- Business routes (business-jwt) ---

  /**
   * GET /custom-orders/business/:businessId
   * Business views all custom order requests directed at them.
   * Must be declared before :id routes.
   */
  @UseGuards(AuthGuard('business-jwt'))
  @Get('business/:businessId')
  findForBusiness(@Request() req, @Param('businessId') businessId: string) {
    return this.customOrderService.findForBusiness(
      businessId,
      req.user.businessId,
    );
  }

  /**
   * PATCH /custom-orders/:id/quote
   * Business submits a price quote for a pending request.
   */
  @UseGuards(AuthGuard('business-jwt'))
  @Patch(':id/quote')
  submitQuote(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: SubmitQuoteDto,
  ) {
    return this.customOrderService.submitQuote(id, req.user.businessId, dto);
  }

  /**
   * PATCH /custom-orders/:id/status
   * Business updates the status of a custom order (e.g. IN_PROGRESS, COMPLETED).
   */
  @UseGuards(AuthGuard('business-jwt'))
  @Patch(':id/status')
  updateStatus(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: UpdateCustomOrderStatusDto,
  ) {
    return this.customOrderService.updateStatus(id, req.user.businessId, dto);
  }
}
