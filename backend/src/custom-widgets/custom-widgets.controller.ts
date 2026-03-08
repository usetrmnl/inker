import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CustomWidgetsService } from './custom-widgets.service';
import { CreateCustomWidgetDto } from './dto/create-custom-widget.dto';
import { UpdateCustomWidgetDto } from './dto/update-custom-widget.dto';

@ApiTags('Custom Widgets')
@ApiBearerAuth()
@Controller('custom-widgets')
export class CustomWidgetsController {
  constructor(private readonly customWidgetsService: CustomWidgetsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new custom widget' })
  create(@Body() createCustomWidgetDto: CreateCustomWidgetDto) {
    return this.customWidgetsService.create(createCustomWidgetDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all custom widgets with pagination' })
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = Math.max(parseInt(page || '1', 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit || '20', 10) || 20, 1), 100);
    return this.customWidgetsService.findAll(pageNum, limitNum);
  }

  @Get('templates')
  @ApiOperation({ summary: 'Get custom widgets as widget templates for screen designer' })
  getAsWidgetTemplates() {
    return this.customWidgetsService.getAsWidgetTemplates();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a custom widget by ID' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.customWidgetsService.findOne(id);
  }

  @Get(':id/preview')
  @ApiOperation({ summary: 'Get custom widget with rendered data' })
  getWithData(@Param('id', ParseIntPipe) id: number) {
    return this.customWidgetsService.getWithData(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a custom widget' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCustomWidgetDto: UpdateCustomWidgetDto,
  ) {
    return this.customWidgetsService.update(id, updateCustomWidgetDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a custom widget' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.customWidgetsService.remove(id);
  }
}
