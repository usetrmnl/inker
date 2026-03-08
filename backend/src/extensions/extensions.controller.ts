import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { ExtensionsService } from './extensions.service';
import { CreateExtensionDto } from './dto/create-extension.dto';
import { UpdateExtensionDto } from './dto/update-extension.dto';

@ApiTags('extensions')
@ApiBearerAuth('access-token')
@Controller('extensions')
export class ExtensionsController {
  constructor(private readonly extensionsService: ExtensionsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new extension' })
  @ApiResponse({ status: 201, description: 'Extension successfully created' })
  create(@Body() createExtensionDto: CreateExtensionDto) {
    return this.extensionsService.create(createExtensionDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all extensions' })
  @ApiResponse({ status: 200, description: 'List of extensions' })
  @ApiQuery({
    name: 'activeOnly',
    required: false,
    type: Boolean,
    description: 'Filter to active extensions only',
  })
  findAll(@Query('activeOnly') activeOnly?: string) {
    return this.extensionsService.findAll(activeOnly === 'true');
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get extension by ID' })
  @ApiResponse({ status: 200, description: 'Extension details' })
  @ApiResponse({ status: 404, description: 'Extension not found' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.extensionsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update extension' })
  @ApiResponse({ status: 200, description: 'Extension successfully updated' })
  @ApiResponse({ status: 404, description: 'Extension not found' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateExtensionDto: UpdateExtensionDto,
  ) {
    return this.extensionsService.update(id, updateExtensionDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete extension' })
  @ApiResponse({ status: 200, description: 'Extension successfully deleted' })
  @ApiResponse({ status: 404, description: 'Extension not found' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.extensionsService.remove(id);
  }

  @Post(':id/toggle')
  @ApiOperation({ summary: 'Toggle extension active status' })
  @ApiResponse({ status: 200, description: 'Extension status toggled' })
  @ApiResponse({ status: 404, description: 'Extension not found' })
  toggleActive(@Param('id', ParseIntPipe) id: number) {
    return this.extensionsService.toggleActive(id);
  }
}
