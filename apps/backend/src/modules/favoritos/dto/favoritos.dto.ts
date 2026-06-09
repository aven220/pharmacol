import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EntityType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateFavoriteDto {
  @ApiProperty({ enum: EntityType })
  @IsEnum(EntityType)
  entidadTipo!: EntityType;

  @ApiProperty()
  @IsUUID()
  entidadId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notas?: string;
}
