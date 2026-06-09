import { InjectQueue } from '@nestjs/bullmq';
import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Queue } from 'bullmq';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationDto } from '../../common/dto/pagination-query.dto';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { SYNC_QUEUE, SyncJobData } from './sync.processor';
import { SyncService } from './sync.service';

import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

class ExecuteSyncDto {
  @ApiProperty({ example: 'INVIMA_CUM_VIGENTES' })
  @IsString()
  @IsNotEmpty()
  fuenteCodigo!: string;

  @ApiProperty({ required: false, description: 'Borrar caché staging y reimportar todo' })
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}

@ApiTags('Sincronización INVIMA')
@ApiBearerAuth()
@Controller('admin/sync')
@UseGuards(PermissionsGuard)
export class SyncController {
  constructor(
    private readonly syncService: SyncService,
    @InjectQueue(SYNC_QUEUE) private readonly queue: Queue<SyncJobData>,
  ) {}

  @Get('historial')
  @RequirePermissions('sync:view')
  @ApiOperation({ summary: 'Historial de sincronizaciones' })
  historial(@Query() query: PaginationDto) {
    return this.syncService.listJobs(query.page, query.limit);
  }

  @Post('ejecutar')
  @RequirePermissions('sync:execute')
  @ApiOperation({ summary: 'Ejecutar sincronización manual (async via cola)' })
  async ejecutar(@Body() dto: ExecuteSyncDto, @CurrentUser() user: JwtPayload) {
    const job = await this.queue.add(
      'manual-sync',
      { fuenteCodigo: dto.fuenteCodigo, userId: user.sub },
      { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
    );
    return { jobId: job.id, status: 'queued', fuenteCodigo: dto.fuenteCodigo };
  }

  @Post('ejecutar-sync')
  @RequirePermissions('sync:execute')
  @ApiOperation({ summary: 'Ejecutar sincronización manual (síncrono)' })
  ejecutarSync(@Body() dto: ExecuteSyncDto, @CurrentUser() user: JwtPayload) {
    return this.syncService.executeManual(dto.fuenteCodigo, user.sub, dto.force === true);
  }

  @Post(':id/cancelar')
  @RequirePermissions('sync:execute')
  @ApiOperation({ summary: 'Cancelar sincronización pendiente o en proceso' })
  cancelar(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.syncService.cancelJob(id, user.sub);
  }

  @Delete(':id')
  @RequirePermissions('sync:execute')
  @ApiOperation({ summary: 'Eliminar registro del historial de sincronización' })
  eliminar(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.syncService.deleteJob(id, user.sub);
  }
}
