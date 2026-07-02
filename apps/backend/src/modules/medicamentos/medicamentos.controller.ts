import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { MedicamentosService } from './medicamentos.service';
import { AlertasSanitariasService } from '../alertas-sanitarias/alertas-sanitarias.service';
import { SearchMedicamentosDto } from './dto/search-medicamentos.dto';

@ApiTags('Medicamentos')
@ApiBearerAuth()
@Controller('medicamentos')
@UseGuards(PermissionsGuard)
export class MedicamentosController {
  constructor(
    private readonly service: MedicamentosService,
    private readonly alertasService: AlertasSanitariasService,
  ) {}

  @Get('offline-pack')
  @RequirePermissions('medicamentos:read')
  @ApiOperation({ summary: 'Paquete offline de medicamentos vigentes' })
  offlinePack(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.service.offlinePack(page ? Number(page) : 1, limit ? Number(limit) : 500);
  }

  @Get('suggest')
  @RequirePermissions('medicamentos:read')
  @ApiOperation({ summary: 'Sugerencias de autocompletado en tiempo real' })
  suggest(@Query('q') q: string, @Query('limit') limit?: number) {
    return this.service.suggest(q ?? '', limit ? Number(limit) : 10);
  }

  @Get('search')
  @RequirePermissions('medicamentos:read')
  @ApiOperation({ summary: 'Búsqueda de medicamentos' })
  search(@Query() query: SearchMedicamentosDto, @CurrentUser() user: JwtPayload) {
    return this.service.search(query, user.sub);
  }

  @Get('registro/:numero')
  @RequirePermissions('medicamentos:read')
  @ApiOperation({ summary: 'Buscar por registro INVIMA' })
  byRegistro(@Param('numero') numero: string) {
    return this.service.findByRegistro(numero);
  }

  @Get('cum/:codigo')
  @RequirePermissions('medicamentos:read')
  @ApiOperation({ summary: 'Buscar por código CUM' })
  byCum(@Param('codigo') codigo: string) {
    return this.service.findByCum(codigo);
  }

  @Get('barcode/:codigo')
  @RequirePermissions('medicamentos:read')
  @ApiOperation({ summary: 'Buscar por código de barras (puede devolver varias presentaciones)' })
  byBarcode(@Param('codigo') codigo: string) {
    return this.service.findByBarcode(codigo);
  }

  @Get(':id/alertas')
  @RequirePermissions('medicamentos:read', 'alertas:view')
  @ApiOperation({
    summary: 'Alertas INVIMA relacionadas (agotados, cartas, alertas sanitarias)',
  })
  alertas(@Param('id') id: string, @Query('limit') limit?: number) {
    return this.alertasService.findForMedicamento(id, limit ? Number(limit) : 30);
  }

  @Get(':id/presentaciones')
  @RequirePermissions('medicamentos:read')
  @ApiOperation({ summary: 'Presentaciones disponibles de un medicamento (CUM, consecutivos, embalaje)' })
  listPresentaciones(@Param('id') id: string) {
    return this.service.listPresentaciones(id);
  }

  @Get(':id')
  @RequirePermissions('medicamentos:read')
  @ApiOperation({ summary: 'Detalle de medicamento' })
  findOne(@Param('id') id: string) {
    return this.service.findById(id);
  }
}
