import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { DispositivosService } from './dispositivos.service';
import { SearchDispositivosDto } from './dto/search-dispositivos.dto';

@ApiTags('Dispositivos Médicos')
@ApiBearerAuth()
@Controller('dispositivos')
@UseGuards(PermissionsGuard)
export class DispositivosController {
  constructor(private readonly service: DispositivosService) {}

  @Get('search')
  @RequirePermissions('dispositivos:read')
  @ApiOperation({ summary: 'Búsqueda de dispositivos médicos' })
  search(@Query() query: SearchDispositivosDto) {
    return this.service.search(query);
  }

  @Get('registro/:numero')
  @RequirePermissions('dispositivos:read')
  @ApiOperation({ summary: 'Buscar por registro INVIMA' })
  byRegistro(@Param('numero') numero: string) {
    return this.service.findByRegistro(numero);
  }

  @Get(':id')
  @RequirePermissions('dispositivos:read')
  @ApiOperation({ summary: 'Detalle de dispositivo' })
  findOne(@Param('id') id: string) {
    return this.service.findById(id);
  }
}
