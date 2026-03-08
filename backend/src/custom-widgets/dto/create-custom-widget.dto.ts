import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsIn,
  IsObject,
  IsInt,
  Min,
  MaxLength,
} from 'class-validator';

export class CreateCustomWidgetDto {
  @ApiProperty({ example: 'Bitcoin Price Widget' })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ example: 'Displays current BTC price' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiProperty({
    example: 1,
    description: 'ID of the data source to use',
  })
  @IsInt()
  dataSourceId: number;

  @ApiProperty({
    example: 'value',
    enum: ['value', 'list', 'script', 'grid'],
    description: 'How to display the data',
  })
  @IsString()
  @IsIn(['value', 'list', 'script', 'grid'])
  displayType: string;

  @ApiPropertyOptional({
    example: '{{name}}: ${{price}}',
    description: 'Template string for template display type',
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  template?: string;

  @ApiPropertyOptional({
    example: { fontSize: 24, textAlign: 'center' },
    description: 'Layout and style configuration',
  })
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @ApiPropertyOptional({
    example: 150,
    default: 100,
    description: 'Minimum widget width in pixels',
  })
  @IsOptional()
  @IsInt()
  @Min(50)
  minWidth?: number;

  @ApiPropertyOptional({
    example: 80,
    default: 50,
    description: 'Minimum widget height in pixels',
  })
  @IsOptional()
  @IsInt()
  @Min(30)
  minHeight?: number;
}
