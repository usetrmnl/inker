import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class UpdateSettingDto {
  @ApiProperty({ example: 'setting-value', description: 'Setting value' })
  @IsString()
  @MaxLength(500)
  value: string;
}
