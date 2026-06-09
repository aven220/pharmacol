import { Module } from '@nestjs/common';
import { OcrModule } from '../ocr/ocr.module';
import { IaController } from './ia.controller';
import { AntifalsificacionService, IaService } from './ia.service';

@Module({
  imports: [OcrModule],
  controllers: [IaController],
  providers: [IaService, AntifalsificacionService],
  exports: [IaService, AntifalsificacionService],
})
export class IaModule {}
