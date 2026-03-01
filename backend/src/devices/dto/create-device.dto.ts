import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateDeviceDto {
  @ApiProperty({
    example: 'Living Room Display',
    description: 'Device name',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name: string;

  @ApiProperty({
    example: 'AA:BB:CC:DD:EE:FF',
    description: 'Device MAC address',
  })
  @IsString()
  @Matches(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/, {
    message: 'Invalid MAC address format',
  })
  macAddress: string;

  @ApiPropertyOptional({
    example: 1,
    description: 'Model ID',
  })
  @IsOptional()
  @IsInt()
  modelId?: number;

  @ApiPropertyOptional({
    example: 1,
    description: 'Playlist ID to assign',
  })
  @IsOptional()
  @IsInt()
  playlistId?: number;
}
