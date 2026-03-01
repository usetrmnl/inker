import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsIn, IsObject } from 'class-validator';

export class UpdateExtensionDto {
  @ApiPropertyOptional({
    example: 'Weather Plugin',
    description: 'Extension name',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    example: 'Displays weather information',
    description: 'Extension description',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: 'webhook',
    description: 'Extension type',
    enum: ['webhook', 'polling', 'custom'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['webhook', 'polling', 'custom'])
  type?: string;

  @ApiPropertyOptional({
    example: { apiKey: 'xxx', endpoint: 'https://api.example.com' },
    description: 'Extension configuration (JSON)',
  })
  @IsOptional()
  @IsObject()
  config?: any;

  @ApiPropertyOptional({
    example: true,
    description: 'Extension active status',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
