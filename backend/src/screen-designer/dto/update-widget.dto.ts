import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateWidgetDto } from './create-widget.dto';

export class UpdateWidgetDto extends PartialType(
  OmitType(CreateWidgetDto, ['templateId'] as const),
) {}
