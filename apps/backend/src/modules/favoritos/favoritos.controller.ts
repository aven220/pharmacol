import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationDto } from '../../common/dto/pagination-query.dto';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { CreateFavoriteDto } from './dto/favoritos.dto';
import { FavoritosService, HistorialService } from './favoritos.service';

@ApiTags('Favoritos')
@ApiBearerAuth()
@Controller('favoritos')
@UseGuards(PermissionsGuard)
export class FavoritosController {
  constructor(private readonly service: FavoritosService) {}

  @Get()
  @RequirePermissions('favoritos:manage')
  @ApiOperation({ summary: 'Listar favoritos' })
  list(@CurrentUser() user: JwtPayload, @Query() query: PaginationDto) {
    return this.service.list(user.sub, query);
  }

  @Post()
  @RequirePermissions('favoritos:manage')
  @ApiOperation({ summary: 'Agregar favorito' })
  add(@CurrentUser() user: JwtPayload, @Body() dto: CreateFavoriteDto) {
    return this.service.add(user.sub, dto);
  }

  @Delete(':id')
  @RequirePermissions('favoritos:manage')
  @ApiOperation({ summary: 'Eliminar favorito' })
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.service.remove(user.sub, id);
  }
}

@ApiTags('Historial')
@ApiBearerAuth()
@Controller('historial')
@UseGuards(PermissionsGuard)
export class HistorialController {
  constructor(private readonly service: HistorialService) {}

  @Get()
  @RequirePermissions('historial:own')
  @ApiOperation({ summary: 'Historial de consultas' })
  list(@CurrentUser() user: JwtPayload, @Query() query: PaginationDto) {
    return this.service.list(user.sub, query);
  }
}
