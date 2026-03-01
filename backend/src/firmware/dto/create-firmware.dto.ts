import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsUrl, MaxLength } from 'class-validator';

export class CreateFirmwareDto {
  @ApiProperty({
    example: '1.2.3',
    description: 'Firmware version number',
  })
  @IsString()
  @MaxLength(50)
  version: string;

  @ApiProperty({
    example: 'https://example.com/firmware/v1.2.3.bin',
    description: 'Firmware download URL',
  })
  @IsString()
  @IsUrl()
  @MaxLength(2048)
  downloadUrl: string;

  @ApiPropertyOptional({
    example: 'Bug fixes and performance improvements',
    description: 'Release notes',
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  releaseNotes?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Whether this is a stable release',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isStable?: boolean;
}
