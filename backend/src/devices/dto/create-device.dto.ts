import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min, Matches, MaxLength, MinLength } from 'class-validator';

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
    description: 'Playlist ID to assign',
  })
  @IsOptional()
  @IsInt()
  playlistId?: number;

  @ApiPropertyOptional({
    example: 800,
    description: 'Custom screen width in pixels (used instead of model dimensions)',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  width?: number;

  @ApiPropertyOptional({
    example: 480,
    description: 'Custom screen height in pixels (used instead of model dimensions)',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  height?: number;
}
