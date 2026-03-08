import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, MaxLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'your-pin-here', description: 'Admin PIN for authentication' })
  @IsString()
  @MinLength(1)
  @MaxLength(128) // Prevent DOS with extremely long PINs
  pin: string;
}
