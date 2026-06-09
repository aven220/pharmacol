import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { PaginationDto } from '../../../common/dto/pagination-query.dto';

export class SearchDispositivosDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ enum: ['nombre', 'registro'], default: 'nombre' })
  @IsOptional()
  @IsIn(['nombre', 'registro'])
  tipo?: string = 'nombre';

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @Transform(({ value }) => value === 'false' ? false : value !== false)
  @IsBoolean()
  soloVigentes?: boolean = true;
}
