import { Controller, Post, Body, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PayoutsService } from './payouts.service';
import { OnboardingLinkDto } from './dto/onboarding-link.dto';

@Controller('payouts')
export class PayoutsController {
  constructor(private readonly payouts: PayoutsService) {}

  // Start (or resume) Stripe Connect onboarding for the authenticated business.
  // Returns a one-time URL to redirect the seller to.
  @UseGuards(AuthGuard('business-jwt'))
  @Post('onboarding-link')
  async onboardingLink(@Body() dto: OnboardingLinkDto, @Request() req) {
    return this.payouts.createOnboardingLink(
      req.user.businessId,
      dto.returnUrl,
      dto.refreshUrl,
    );
  }
}
