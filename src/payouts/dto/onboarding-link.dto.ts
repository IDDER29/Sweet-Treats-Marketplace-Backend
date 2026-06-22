import { IsUrl } from 'class-validator';

export class OnboardingLinkDto {
  // require_tld:false so localhost callbacks work in dev.
  @IsUrl({ require_tld: false })
  returnUrl: string;

  @IsUrl({ require_tld: false })
  refreshUrl: string;
}
