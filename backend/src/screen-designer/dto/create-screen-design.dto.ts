import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  IsArray,
  ValidateNested,
  Min,
  Max,
  IsHexColor,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateWidgetDto } from './create-widget.dto';

export class CreateScreenDesignDto {
  @ApiProperty({
    example: 'My Dashboard',
    description: 'Name of the screen design',
  })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({
    example: 'A custom dashboard with clock and weather',
    description: 'Description of the screen design',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({
    example: 800,
    description: 'Width of the screen design in pixels',
    default: 800,
  })
  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(2000)
  width?: number;

  @ApiPropertyOptional({
    example: 480,
    description: 'Height of the screen design in pixels',
    default: 480,
  })
  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(2000)
  height?: number;

  @ApiPropertyOptional({
    example: '#FFFFFF',
    description: 'Background color (hex)',
    default: '#FFFFFF',
  })
  @IsOptional()
  @IsHexColor()
  background?: string;

  @ApiPropertyOptional({
    example: false,
    description: 'Whether this design is a template for others to use',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isTemplate?: boolean;

  @ApiPropertyOptional({
    type: [CreateWidgetDto],
    description: 'Initial widgets to add to the screen design',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateWidgetDto)
  widgets?: CreateWidgetDto[];
}
