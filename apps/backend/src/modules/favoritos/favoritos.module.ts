import { Module } from '@nestjs/common';
import { FavoritosController, HistorialController } from './favoritos.controller';
import { FavoritosService, HistorialService } from './favoritos.service';

@Module({
  controllers: [FavoritosController, HistorialController],
  providers: [FavoritosService, HistorialService],
  exports: [FavoritosService, HistorialService],
})
export class FavoritosModule {}
