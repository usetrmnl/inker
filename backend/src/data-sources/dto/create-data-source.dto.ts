import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsIn,
  IsObject,
  IsBoolean,
  IsInt,
  IsUrl,
  Min,
  MaxLength,
} from 'class-validator';

export class CreateDataSourceDto {
  @ApiProperty({ example: 'Bitcoin Price API' })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ example: 'Fetches current BTC price from CoinGecko' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiProperty({
    example: 'json',
    enum: ['json', 'rss'],
    description: 'Type of data source',
  })
  @IsString()
  @IsIn(['json', 'rss'])
  type: string;

  @ApiProperty({
    example: 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd',
    description: 'API endpoint or RSS feed URL',
  })
  @IsString()
  @IsUrl({}, { message: 'URL must be a valid URL' })
  url: string;

  @ApiPropertyOptional({
    example: 'GET',
    default: 'GET',
    enum: ['GET', 'POST'],
    description: 'HTTP method for JSON APIs',
  })
  @IsOptional()
  @IsString()
  @IsIn(['GET', 'POST'])
  method?: string;

  @ApiPropertyOptional({
    example: { 'X-API-Key': 'your-api-key' },
    description: 'Custom HTTP headers (e.g., for API keys)',
  })
  @IsOptional()
  @IsObject()
  headers?: Record<string, string>;

  @ApiPropertyOptional({
    example: 300,
    default: 300,
    description: 'Refresh interval in seconds',
  })
  @IsOptional()
  @IsInt()
  @Min(60)
  refreshInterval?: number;

  @ApiPropertyOptional({
    example: '$.bitcoin.usd',
    description: 'JSONPath expression to extract specific data',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  jsonPath?: string;

  @ApiPropertyOptional({
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
