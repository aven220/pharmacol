import { Module } from '@nestjs/common';
import { AlertasSanitariasModule } from '../alertas-sanitarias/alertas-sanitarias.module';
import { FavoritosModule } from '../favoritos/favoritos.module';
import { MedicamentosController } from './medicamentos.controller';
import { MedicamentosService } from './medicamentos.service';

@Module({
  imports: [FavoritosModule, AlertasSanitariasModule],
  controllers: [MedicamentosController],
  providers: [MedicamentosService],
  exports: [MedicamentosService],
})
export class MedicamentosModule {}
