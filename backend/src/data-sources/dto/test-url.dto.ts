import { IsString, IsOptional, IsIn, IsObject, IsUrl, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for testing a URL without saving a data source.
 * This allows users to preview what fields are available from an API
 * before committing to creating a data source.
 */
export class TestUrlDto {
  @ApiProperty({ description: 'The URL to fetch data from' })
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  url: string;

  @ApiProperty({ description: 'Type of data source', enum: ['json', 'rss'] })
  @IsIn(['json', 'rss'])
  type: 'json' | 'rss';

  @ApiPropertyOptional({ description: 'HTTP method (for JSON)', default: 'GET' })
  @IsOptional()
  @IsString()
  @IsIn(['GET', 'POST'])
  method?: string;

  @ApiPropertyOptional({ description: 'Custom headers to include in the request' })
  @IsOptional()
  @IsObject()
  headers?: Record<string, string>;
}
