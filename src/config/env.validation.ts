import { plainToInstance } from 'class-transformer';
import { IsString, IsNumber, IsUrl, IsOptional, validateSync } from 'class-validator';

export class EnvironmentVariables {
  @IsNumber()
  PORT: number;

  @IsOptional()
  @IsUrl({ require_tld: false })
  APP_BASE_URL: string;

  @IsString()
  META_VERIFY_TOKEN: string;

  @IsString()
  META_APP_SECRET: string;

  @IsString()
  RABBITMQ_URI: string;

  @IsUrl({ require_tld: false })
  UBERSMITH_API_URL: string;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw new Error(`Variables de entorno inválidas:\n${errors.toString()}`);
  }
  return validatedConfig;
}