import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ModelsService } from './models.service';
import { CreateModelDto } from './dto/create-model.dto';
import { UpdateModelDto } from './dto/update-model.dto';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('models')
@Controller('models')
export class ModelsController {
  constructor(private readonly modelsService: ModelsService) {}

  @Post()
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a new device model' })
  @ApiResponse({ status: 201, description: 'Model successfully created' })
  @ApiResponse({ status: 400, description: 'Model with name already exists' })
  create(@Body() createModelDto: CreateModelDto) {
    return this.modelsService.create(createModelDto);
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'Get all device models' })
  @ApiResponse({ status: 200, description: 'List of models' })
  findAll() {
    return this.modelsService.findAll();
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get model by ID' })
  @ApiResponse({ status: 200, description: 'Model details' })
  @ApiResponse({ status: 404, description: 'Model not found' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.modelsService.findOne(id);
  }

  @Patch(':id')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update model' })
  @ApiResponse({ status: 200, description: 'Model successfully updated' })
  @ApiResponse({ status: 404, description: 'Model not found' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateModelDto: UpdateModelDto,
  ) {
    return this.modelsService.update(id, updateModelDto);
  }

  @Delete(':id')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Delete model' })
  @ApiResponse({ status: 200, description: 'Model successfully deleted' })
  @ApiResponse({ status: 404, description: 'Model not found' })
  @ApiResponse({
    status: 400,
    description: 'Cannot delete: devices are using this model',
  })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.modelsService.remove(id);
  }
}
