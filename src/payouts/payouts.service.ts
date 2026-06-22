import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Stripe from 'stripe';
import { Business } from '../business/entities/business.entity';

/**
 * Stripe Connect — seller onboarding and marketplace payment splitting.
 *
 * Model (see ADR-0007): **destination charges**. The customer is charged on the
 * platform account; at charge time the funds (minus the platform fee) are routed
 * to the seller's connected account via `transfer_data.destination`, and the
 * platform keeps `application_fee_amount`. Connect handles the payout schedule
 * to the seller's bank, so there is no separate payout job to run or reconcile.
 *
 * Pure fee math is unit-tested; the Stripe calls below require a real
 * STRIPE_SECRET_KEY with Connect enabled to exercise.
 */
@Injectable()
export class PayoutsService {
  private readonly logger = new Logger(PayoutsService.name);
  private readonly stripe: Stripe;

  // Platform commission: percentage of gross plus an optional fixed fee, both in
  // minor units. Defaults to 10% + 0; override via env.
  private readonly feePercent = Number(process.env.PLATFORM_FEE_PERCENT ?? 10);
  private readonly feeFixedMinor = Number(
    process.env.PLATFORM_FEE_FIXED_MINOR ?? 0,
  );

  constructor(
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,
  ) {
    this.stripe = new Stripe(
      process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder',
      { apiVersion: '2026-05-27.dahlia' },
    );
  }

  /**
   * Platform fee (application_fee_amount) for a gross charge, in minor units.
   * Clamped to [0, gross] so a misconfiguration can never make the seller's net
   * negative or exceed the charge.
   */
  computeApplicationFee(grossMinor: number): number {
    if (grossMinor <= 0) return 0;
    const fee =
      Math.round((grossMinor * this.feePercent) / 100) + this.feeFixedMinor;
    return Math.min(Math.max(fee, 0), grossMinor);
  }

  /** Seller's net for a gross charge, in minor units. */
  computeSellerNet(grossMinor: number): number {
    return grossMinor - this.computeApplicationFee(grossMinor);
  }

  /**
   * Extra params to merge into a PaymentIntent so the charge is split to the
   * seller. Returns null when the seller can't yet receive payouts, so the caller
   * can fall back to a platform-only charge (or block checkout).
   */
  destinationChargeParams(
    grossMinor: number,
    business: Pick<Business, 'stripeAccountId' | 'payoutsEnabled'>,
  ): {
    application_fee_amount: number;
    transfer_data: { destination: string };
  } | null {
    if (!business.stripeAccountId || !business.payoutsEnabled) return null;
    return {
      application_fee_amount: this.computeApplicationFee(grossMinor),
      transfer_data: { destination: business.stripeAccountId },
    };
  }

  /**
   * Create (or reuse) the seller's Express connected account and return a
   * one-time onboarding URL to redirect them to. `account.updated` webhooks
   * later flip `payoutsEnabled` once Stripe clears the account.
   */
  async createOnboardingLink(
    businessId: string,
    returnUrl: string,
    refreshUrl: string,
  ): Promise<{ url: string }> {
    const business = await this.businessRepository.findOne({
      where: { id: businessId },
    });
    if (!business) throw new NotFoundException('Business not found');

    let accountId = business.stripeAccountId;
    if (!accountId) {
      const account = await this.stripe.accounts.create({
        type: 'express',
        email: business.email,
        business_type: 'company',
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        metadata: { businessId: business.id },
      });
      accountId = account.id;
      business.stripeAccountId = accountId;
      await this.businessRepository.save(business);
    }

    const link = await this.stripe.accountLinks.create({
      account: accountId,
      return_url: returnUrl,
      refresh_url: refreshUrl,
      type: 'account_onboarding',
    });
    return { url: link.url };
  }

  /**
   * Reconcile our copy of a connected account's status from an
   * `account.updated` webhook. `charges_enabled && payouts_enabled` means the
   * seller can receive split charges.
   */
  async syncAccountFromWebhook(account: Stripe.Account): Promise<void> {
    const business = await this.businessRepository.findOne({
      where: { stripeAccountId: account.id },
    });
    if (!business) {
      this.logger.warn(`account.updated for unknown account ${account.id}`);
      return;
    }
    const enabled = Boolean(account.charges_enabled && account.payouts_enabled);
    if (business.payoutsEnabled !== enabled) {
      business.payoutsEnabled = enabled;
      await this.businessRepository.save(business);
      this.logger.log(
        `Business ${business.id} payoutsEnabled -> ${enabled} (acct ${account.id})`,
      );
    }
  }
}
