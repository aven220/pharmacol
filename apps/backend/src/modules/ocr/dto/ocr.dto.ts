import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString } from 'class-validator';

export class OcrAnalyzeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  textoCrudo?: string;

  @ApiProperty()
  @IsObject()
  datosEstructurados!: Record<string, unknown>;
}

export class IaIdentifyDto {
  @ApiProperty()
  @IsObject()
  ocrData!: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  textoCrudo?: string;
}

export class AntifalsificacionDto {
  @ApiProperty()
  @IsObject()
  ocrData!: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  medicamentoId?: string;
}

export class OcrExtractImageDto {
  @ApiProperty({ description: 'Imagen en base64 (JPEG/PNG)' })
  @IsString()
  imageBase64!: string;
}
