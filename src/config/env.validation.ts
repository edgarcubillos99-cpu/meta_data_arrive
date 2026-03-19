import { plainToInstance } from 'class-transformer';
import { IsString, IsNumber, validateSync, IsUrl } from 'class-validator';

export class EnvironmentVariables {
  @IsNumber() PORT: number;
  @IsString() META_VERIFY_TOKEN: string;
  @IsString() RABBITMQ_URI: string;
  @IsUrl() UBERSMITH_API_URL: string;
  // ... más variables
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, { enableImplicitConversion: true });
  const errors = validateSync(validatedConfig, { skipMissingProperties: false });
  if (errors.length > 0) throw new Error(`Error en variables de entorno: ${errors.toString()}`);
  return validatedConfig;
}