import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { IsInt } from 'class-validator';

class ItemOrder {
  @ApiProperty({ example: 1, description: 'Item ID' })
  @IsInt()
  id: number;

  @ApiProperty({ example: 0, description: 'New order position' })
  @IsInt()
  order: number;
}

export class ReorderPlaylistItemsDto {
  @ApiProperty({
    type: [ItemOrder],
    description: 'Array of item IDs with new orders',
    example: [
      { id: 1, order: 0 },
      { id: 2, order: 1 },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemOrder)
  items: ItemOrder[];
}
