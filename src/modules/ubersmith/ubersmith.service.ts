import { Injectable, Logger, HttpException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { catchError, firstValueFrom } from 'rxjs';

@Injectable()
export class UbersmithService {
  private readonly logger = new Logger(UbersmithService.name);

  constructor(private readonly httpService: HttpService) {}

  async findClientByPhone(phone: string): Promise<any> {
    try {
      const { data } = await firstValueFrom(
        this.httpService.get(`/api/2.0/?method=client.list&metadata_phone=${phone}`).pipe(
          catchError((error) => {
            this.logger.error(`Error consultando Ubersmith: ${error.message}`);
            // Manejar reintentos o lanzar excepción para que el RabbitMQ DLQ actúe
            throw new HttpException('CRM no disponible', 503);
          }),
        ),
      );
      
      if (data.status === 'true' && data.data) {
        // Mapear respuesta de Ubersmith a un objeto limpio
        const clientId = Object.keys(data.data)[0];
        return data.data[clientId] || null;
      }
      return null;
    } catch (e) {
      throw e;
    }
  }
}