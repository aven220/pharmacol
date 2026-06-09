import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { OcrAnalyzeDto, OcrExtractImageDto } from './dto/ocr.dto';
import { OcrService } from './ocr.service';

@ApiTags('OCR')
@ApiBearerAuth()
@Controller('ocr')
@UseGuards(PermissionsGuard)
export class OcrController {
  constructor(private readonly service: OcrService) {}

  @Post('analyze')
  @RequirePermissions('ocr:use')
  @ApiOperation({ summary: 'Analizar datos OCR estructurados' })
  analyze(@Body() dto: OcrAnalyzeDto, @CurrentUser() user: JwtPayload) {
    return this.service.analyze(dto, user);
  }

  @Post('extract-image')
  @RequirePermissions('ocr:use')
  @ApiOperation({ summary: 'Extraer texto de imagen y buscar coincidencias' })
  extractImage(@Body() dto: OcrExtractImageDto, @CurrentUser() user: JwtPayload) {
    return this.service.extractFromImage(dto, user);
  }
}
