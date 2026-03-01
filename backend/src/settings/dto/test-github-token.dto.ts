import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class TestGitHubTokenDto {
  @ApiProperty({ example: 'ghp_xxxxxxxxxxxx', description: 'GitHub personal access token' })
  @IsString()
  @MaxLength(500)
  token: string;
}
