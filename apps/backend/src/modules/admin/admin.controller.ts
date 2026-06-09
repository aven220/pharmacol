import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationDto } from '../../common/dto/pagination-query.dto';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { AdminService } from './admin.service';
import { CreateAdminUserDto, UpdateAdminUserDto } from './dto/admin-users.dto';

@ApiTags('Administración')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(PermissionsGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('dashboard/stats')
  @RequirePermissions('dashboard:view')
  @ApiOperation({ summary: 'Estadísticas del dashboard' })
  stats() {
    return this.admin.getDashboardStats();
  }

  @Get('users')
  @RequirePermissions('users:manage')
  @ApiOperation({ summary: 'Listar usuarios' })
  users(@Query() query: PaginationDto) {
    return this.admin.listUsers(query);
  }

  @Get('users/:id')
  @RequirePermissions('users:manage')
  @ApiOperation({ summary: 'Detalle de usuario' })
  user(@Param('id') id: string) {
    return this.admin.getUserById(id);
  }

  @Post('users')
  @RequirePermissions('users:manage')
  @ApiOperation({ summary: 'Crear usuario' })
  createUser(@Body() dto: CreateAdminUserDto, @CurrentUser() user: JwtPayload) {
    return this.admin.createUser(dto, user.sub);
  }

  @Patch('users/:id')
  @RequirePermissions('users:manage')
  @ApiOperation({ summary: 'Actualizar usuario' })
  updateUser(
    @Param('id') id: string,
    @Body() dto: UpdateAdminUserDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.admin.updateUser(id, dto, user.sub);
  }

  @Delete('users/:id')
  @RequirePermissions('users:manage')
  @ApiOperation({ summary: 'Eliminar usuario (soft delete)' })
  deleteUser(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.admin.deleteUser(id, user.sub);
  }

  @Get('roles')
  @RequirePermissions('roles:manage')
  @ApiOperation({ summary: 'Listar roles y permisos' })
  roles() {
    return this.admin.listRoles();
  }

  @Get('audit')
  @RequirePermissions('audit:view')
  @ApiOperation({ summary: 'Logs de auditoría' })
  audit(@Query() query: PaginationDto) {
    return this.admin.listAuditLogs(query);
  }

  @Get('fuentes')
  @RequirePermissions('sync:view')
  @ApiOperation({ summary: 'Fuentes de datos configuradas' })
  fuentes() {
    return this.admin.listDataSources();
  }
}
