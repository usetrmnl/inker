import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsInt,
  IsOptional,
  IsNumber,
  Min,
  IsIn,
  MaxLength,
} from 'class-validator';

export class CreateModelDto {
  @ApiProperty({ example: 'og_png', description: 'Unique model identifier name' })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiProperty({ example: 'TRMNL Original', description: 'Display label for model' })
  @IsString()
  @MaxLength(255)
  label: string;

  @ApiProperty({ example: 800, description: 'Screen width in pixels' })
  @IsInt()
  @Min(1)
  width: number;

  @ApiProperty({ example: 480, description: 'Screen height in pixels' })
  @IsInt()
  @Min(1)
  height: number;

  @ApiProperty({
    example: 'Original TRMNL device with e-ink display',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiProperty({ example: 'image/png', default: 'image/png' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  mimeType?: string;

  @ApiProperty({ example: 2, default: 2, description: 'Number of colors' })
  @IsOptional()
  @IsInt()
  colors?: number;

  @ApiProperty({ example: 1, default: 1, description: 'Bit depth' })
  @IsOptional()
  @IsInt()
  bitDepth?: number;

  @ApiProperty({ example: 0, default: 0, description: 'Screen rotation degrees' })
  @IsOptional()
  @IsInt()
  rotation?: number;

  @ApiProperty({ example: 0, default: 0, description: 'X offset in pixels' })
  @IsOptional()
  @IsInt()
  offsetX?: number;

  @ApiProperty({ example: 0, default: 0, description: 'Y offset in pixels' })
  @IsOptional()
  @IsInt()
  offsetY?: number;

  @ApiProperty({
    example: 'terminus',
    default: 'terminus',
    description: 'Model kind (terminus, custom, etc)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  kind?: string;

  @ApiProperty({
    example: 1.0,
    default: 1.0,
    description: 'Scaling factor for rendering',
  })
  @IsOptional()
  @IsNumber()
  @Min(0.1)
  scaleFactor?: number;
}
