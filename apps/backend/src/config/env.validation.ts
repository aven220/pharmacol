import { plainToInstance } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min, validateSync } from 'class-validator';

export class EnvironmentVariables {
  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsString()
  @IsNotEmpty()
  JWT_ACCESS_SECRET!: string;

  @IsString()
  @IsNotEmpty()
  JWT_REFRESH_SECRET!: string;

  @IsString()
  @IsOptional()
  JWT_ACCESS_EXPIRES_IN?: string = '15m';

  @IsString()
  @IsOptional()
  JWT_REFRESH_EXPIRES_IN?: string = '7d';

  @IsString()
  @IsOptional()
  REDIS_URL?: string = 'redis://localhost:6391';

  @IsString()
  @IsOptional()
  INVIMA_APP_TOKEN?: string;

  @IsString()
  @IsOptional()
  PHARMACOL_EMAIL?: string;

  @IsString()
  @IsOptional()
  SEED_ADMIN_EMAIL?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  API_PORT?: number = 3905;

  @IsString()
  @IsOptional()
  NODE_ENV?: string = 'development';

  @IsString()
  @IsOptional()
  CORS_ORIGINS?: string = '*';

  @IsString()
  @IsOptional()
  SMTP_HOST?: string;

  @IsString()
  @IsOptional()
  SMTP_PORT?: string;

  @IsString()
  @IsOptional()
  SMTP_USER?: string;

  @IsString()
  @IsOptional()
  SMTP_PASS?: string;

  @IsString()
  @IsOptional()
  SMTP_FROM?: string;

  @IsString()
  @IsOptional()
  SMTP_SECURE?: string;

  @IsString()
  @IsOptional()
  ALERTAS_DIGEST_EMAIL?: string;
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw new Error(`Config validation failed:\n${errors.toString()}`);
  }

  return validated;
}
