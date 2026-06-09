import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const config = app.get(ConfigService);

  // Detrás de nginx/443 con X-Forwarded-Proto
  const httpAdapter = app.getHttpAdapter().getInstance();
  httpAdapter.set('trust proxy', 1);

  app.use(json({ limit: '15mb' }));
  app.use(urlencoded({ extended: true, limit: '15mb' }));
  app.use(helmet());
  app.enableCors({
    origin: config.get<string>('CORS_ORIGINS') === '*'
      ? true
      : config.get<string>('CORS_ORIGINS')?.split(','),
    credentials: true,
  });

  app.setGlobalPrefix('v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('PharmaCol API')
    .setDescription('Plataforma farmacéutica Colombia — INVIMA, OCR, IA')
    .setVersion('0.1.0')
    .addBearerAuth()
    .addTag('Autenticación')
    .addTag('Medicamentos')
    .addTag('Dispositivos Médicos')
    .addTag('Favoritos')
    .addTag('Historial')
    .addTag('Sincronización INVIMA')
    .addTag('OCR')
    .addTag('Inteligencia Artificial')
    .addTag('Administración')
    .addTag('Health')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  const port = config.get<number>('API_PORT') ?? 3000;
  await app.listen(port, '0.0.0.0');

  console.log(`PharmaCol API → http://localhost:${port}/v1`);
  console.log(`Swagger       → http://localhost:${port}/docs`);
  console.log(`LAN           → http://0.0.0.0:${port}/v1 (Expo Go)`);
}

bootstrap().catch((error: unknown) => {
  console.error('PharmaCol API — error fatal al iniciar:', error);
  process.exit(1);
});
