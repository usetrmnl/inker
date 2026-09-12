import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsArray, ValidateNested, MaxLength, Matches } from 'class-validator';
import { Type } from 'class-transformer';

class PlaylistScreenDto {
  @IsString()
  screenId: string;

  @IsOptional()
  duration?: number;

  @IsOptional()
  order?: number;
}

export class UpdatePlaylistDto {
  @ApiPropertyOptional({
    example: 'Morning Rotation',
    description: 'Playlist name',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({
    example: 'Screens to display in the morning',
    description: 'Playlist description',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Whether the playlist is active',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    example: '00:00',
    description: 'Daily refresh time in HH:MM format, evaluated in the server timezone',
    nullable: true,
  })
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'dailyRefreshAt must be in HH:MM format' })
  dailyRefreshAt?: string | null;

  @ApiPropertyOptional({
    example: false,
    description: 'TRMNL X only: advance to the next screen on each device poll (middle tap / on schedule)',
  })
  @IsOptional()
  @IsBoolean()
  advanceOnTap?: boolean;

  @ApiPropertyOptional({
    description: 'Screens in the playlist',
    type: [PlaylistScreenDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlaylistScreenDto)
  screens?: PlaylistScreenDto[];
}
