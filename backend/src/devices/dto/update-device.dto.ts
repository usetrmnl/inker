import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, IsBoolean, Matches, ValidateIf, MaxLength } from 'class-validator';

export class UpdateDeviceDto {
  @ApiPropertyOptional({
    example: 'Living Room Display',
    description: 'Device name',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({
    example: 'AA:BB:CC:DD:EE:FF',
    description: 'Device MAC address',
  })
  @IsOptional()
  @IsString()
  @Matches(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/, {
    message: 'Invalid MAC address format',
  })
  macAddress?: string;

  @ApiPropertyOptional({
    example: '1.0.5',
    description: 'Firmware version',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  firmwareVersion?: string;

  @ApiPropertyOptional({
    example: 1,
    description: 'Model ID',
  })
  @IsOptional()
  @IsInt()
  modelId?: number;

  @ApiPropertyOptional({
    example: 1,
    description: 'Playlist ID (set to null to unassign)',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((object, value) => value !== null)
  @IsInt()
  playlistId?: number | null;

  @ApiPropertyOptional({
    example: true,
    description: 'Device active status',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
