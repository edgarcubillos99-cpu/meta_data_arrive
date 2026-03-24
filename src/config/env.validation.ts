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

  /** WhatsApp Cloud API: ID del número (Meta Business Suite) */
  @IsOptional()
  @IsString()
  WHATSAPP_PHONE_NUMBER_ID?: string;

  /** Token de acceso de la app de Meta para Graph API (enviar mensajes) */
  @IsOptional()
  @IsString()
  WHATSAPP_GRAPH_API_TOKEN?: string;

  @IsOptional()
  @IsString()
  WHATSAPP_GRAPH_API_VERSION?: string;

  /** Texto de la pregunta previa a enriquecer (cliente actual vs potencial) */
  @IsOptional()
  @IsString()
  SERVICE_INQUIRY_MESSAGE?: string;

  /** true = enviar la pregunta solo una vez por usuario (recomendado) */
  @IsOptional()
  @IsString()
  SERVICE_INQUIRY_SEND_ONCE?: string;

  /** Facebook Page ID (Messenger y, con IG vinculada, envío Instagram) */
  @IsOptional()
  @IsString()
  META_PAGE_ID?: string;

  /** Token de página (messages para Messenger / Instagram Direct) */
  @IsOptional()
  @IsString()
  META_PAGE_ACCESS_TOKEN?: string;

  /** Si la página de Instagram difiere de META_PAGE_ID (poco habitual) */
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