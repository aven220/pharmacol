import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { AlertasSanitariasService } from './alertas-sanitarias.service';

@ApiTags('Alertas Sanitarias')
@ApiBearerAuth()
@Controller('alertas-sanitarias')
@UseGuards(PermissionsGuard)
export class AlertasSanitariasController {
  constructor(private readonly service: AlertasSanitariasService) {}

  @Get('search')
  @RequirePermissions('alertas:view')
  @ApiOperation({ summary: 'Buscar alertas sanitarias INVIMA' })
  search(
    @Query('q') q?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.service.search(q, page ? Number(page) : 1, limit ? Number(limit) : 20);
  }

  @Get('recent')
  @RequirePermissions('alertas:view')
  @ApiOperation({ summary: 'Alertas sanitarias más recientes' })
  recent(@Query('limit') limit?: number) {
    return this.service.recent(limit ? Number(limit) : 10);
  }

  @Get('stats')
  @RequirePermissions('alertas:view')
  @ApiOperation({ summary: 'Estadísticas de alertas sanitarias' })
  stats() {
    return this.service.stats();
  }

  @Get(':id')
  @RequirePermissions('alertas:view')
  @ApiOperation({ summary: 'Detalle de alerta sanitaria' })
  findOne(@Param('id') id: string) {
    return this.service.findById(id);
  }
}
