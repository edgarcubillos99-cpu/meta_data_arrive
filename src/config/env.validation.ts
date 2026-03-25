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

  /** WhatsApp Cloud API: ID del número (envío de mensajes + mismo token puede usarse en normalizador para medios). */
  @IsOptional()
  @IsString()
  WHATSAPP_PHONE_NUMBER_ID?: string;

  @IsOptional()
  @IsString()
  WHATSAPP_GRAPH_API_TOKEN?: string;

  @IsOptional()
  @IsString()
  WHATSAPP_GRAPH_API_VERSION?: string;

  /** Messenger e Instagram Direct: Send API de la página. */
  @IsOptional()
  @IsString()
  META_PAGE_ID?: string;

  @IsOptional()
  @IsString()
  META_PAGE_ACCESS_TOKEN?: string;

  @IsOptional()
  @IsString()
  INSTAGRAM_PAGE_ID?: string;

  @IsOptional()
  @IsString()
  META_GRAPH_API_VERSION?: string;
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