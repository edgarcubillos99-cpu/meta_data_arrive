import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UbersmithService } from './ubersmith.service';

@Module({
  imports: [
    HttpModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        baseURL: configService.get<string>('UBERSMITH_API_URL'),
        timeout: 5000,
        maxRedirects: 5,
      }),
    }),
  ],
  providers: [UbersmithService],
  exports: [UbersmithService],
})
export class UbersmithModule {}