import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsObject,
  Min,
  Max,
} from 'class-validator';

export class CreateWidgetDto {
  @ApiProperty({
    example: 1,
    description: 'ID of the widget template to use',
  })
  @IsInt()
  templateId: number;

  @ApiPropertyOptional({
    example: 0,
    description: 'X position of the widget on the canvas (can be negative for overflow effects)',
    default: 0,
  })
  @IsOptional()
  @IsInt()
  x?: number;

  @ApiPropertyOptional({
    example: 0,
    description: 'Y position of the widget on the canvas (can be negative for overflow effects)',
    default: 0,
  })
  @IsOptional()
  @IsInt()
  y?: number;

  @ApiPropertyOptional({
    example: 200,
    description: 'Width of the widget in pixels',
    default: 200,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2000)
  width?: number;

  @ApiPropertyOptional({
    example: 100,
    description: 'Height of the widget in pixels',
    default: 100,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2000)
  height?: number;

  @ApiPropertyOptional({
    example: { timezone: 'America/New_York', format: '12h' },
    description: 'Widget-specific configuration',
  })
  @IsOptional()
  @IsObject()
  config?: Record<string, any>;

  @ApiPropertyOptional({
    example: 0,
    description: 'Z-index for layering widgets',
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  zIndex?: number;

  @ApiPropertyOptional({
    example: 0,
    description: 'Rotation angle in degrees (0-360)',
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(360)
  rotation?: number;
}
