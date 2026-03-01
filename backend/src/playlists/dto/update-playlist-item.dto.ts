import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Min } from 'class-validator';

export class UpdatePlaylistItemDto {
  @ApiPropertyOptional({
    example: 0,
    description: 'Display order (0-based index)',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @ApiPropertyOptional({
    example: 60,
    description: 'Display duration in seconds',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  duration?: number;
}
