import { Module } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/adapters/handlebars.adapter';
import { MailService } from './mail.service';

@Module({
  imports: [
    MailerModule.forRootAsync({
      useFactory: () => ({
        transport: {
          host: process.env.MAIL_HOST || 'localhost',
          port: parseInt(process.env.MAIL_PORT || '1025', 10),
          auth:
            process.env.MAIL_USER && process.env.MAIL_PASS
              ? {
                  user: process.env.MAIL_USER,
                  pass: process.env.MAIL_PASS,
                }
              : undefined,
        },
        defaults: {
          from: process.env.MAIL_FROM || '"Sweet Treats" <noreply@sweettreats.local>',
        },
        template: {
          dir: `${process.cwd()}/src/mail/templates`,
          adapter: new HandlebarsAdapter(),
          options: {
            strict: true,
          },
        },
      }),
    }),
  ],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
