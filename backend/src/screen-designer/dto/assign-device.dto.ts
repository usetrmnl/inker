import { ApiProperty } from '@nestjs/swagger';
import { IsInt } from 'class-validator';

export class AssignDeviceDto {
  @ApiProperty({
    example: 1,
    description: 'ID of the device to assign',
  })
  @IsInt()
  deviceId: number;
}
