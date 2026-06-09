import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination-query.dto';
import { Transform } from 'class-transformer';

export class SearchMedicamentosDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Término de búsqueda' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({
    enum: ['nombre', 'principio_activo', 'registro', 'cum', 'atc', 'barcode'],
    default: 'nombre',
  })
  @IsOptional()
  @IsIn(['nombre', 'principio_activo', 'registro', 'cum', 'atc', 'barcode'])
  tipo?: string = 'nombre';

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @Transform(({ value }) => value === 'false' ? false : value !== false)
  @IsBoolean()
  soloVigentes?: boolean = true;
}
