import { PartialType } from '@nestjs/swagger';
import { CreateScreenDesignDto } from './create-screen-design.dto';

export class UpdateScreenDesignDto extends PartialType(CreateScreenDesignDto) {}
