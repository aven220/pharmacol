import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { AntifalsificacionDto, IaIdentifyDto } from '../ocr/dto/ocr.dto';
import { AntifalsificacionService, IaService } from './ia.service';

@ApiTags('Inteligencia Artificial')
@ApiBearerAuth()
@Controller()
@UseGuards(PermissionsGuard)
export class IaController {
  constructor(
    private readonly ia: IaService,
    private readonly antifake: AntifalsificacionService,
  ) {}

  @Post('ia/identify')
  @RequirePermissions('ia:use')
  @ApiOperation({ summary: 'Identificación inteligente post-OCR' })
  identify(@Body() dto: IaIdentifyDto, @CurrentUser() user: JwtPayload) {
    return this.ia.identify(dto, user);
  }

  @Post('antifalsificacion/evaluar')
  @RequirePermissions('antifalsificacion:view')
  @ApiOperation({ summary: 'Evaluar riesgo de falsificación' })
  evaluar(@Body() dto: AntifalsificacionDto) {
    return this.antifake.evaluar(dto.ocrData, dto.medicamentoId);
  }
}
