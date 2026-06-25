import { Module } from '@nestjs/common';
import { AlertasSanitariasController } from './alertas-sanitarias.controller';
import { AlertasSanitariasService } from './alertas-sanitarias.service';

@Module({
  controllers: [AlertasSanitariasController],
  providers: [AlertasSanitariasService],
  exports: [AlertasSanitariasService],
})
export class AlertasSanitariasModule {}
