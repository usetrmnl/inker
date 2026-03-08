import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsArray, ValidateNested, MaxLength } from 'class-validator';
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
    description: 'Screens in the playlist',
    type: [PlaylistScreenDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlaylistScreenDto)
  screens?: PlaylistScreenDto[];
}
