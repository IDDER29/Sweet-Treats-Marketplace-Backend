import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/**
 * Publishes the OpenAPI contract:
 *  - /api/docs        interactive Swagger UI
 *  - /api/docs-json   the raw OpenAPI 3 spec (the machine-readable contract that
 *                     typed clients / partner tooling are generated from)
 *
 * The spec is auto-derived from controller/DTO decorators; enrich it over time
 * with @ApiTags/@ApiResponse/@ApiProperty (see ADR-0005).
 */
export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Sweet Treats Marketplace API')
    .setDescription(
      'Multi-vendor bakery marketplace backend. Bearer JWT for customers/admins; ' +
        'business-jwt for sellers. See docs/architecture for the blueprint.',
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .addServer('/', 'current host')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('api/docs', app, document, {
    jsonDocumentUrl: 'api/docs-json',
    swaggerOptions: { persistAuthorization: true },
  });
}
