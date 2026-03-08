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
import { FirmwareService } from './firmware.service';
import { CreateFirmwareDto } from './dto/create-firmware.dto';
import { UpdateFirmwareDto } from './dto/update-firmware.dto';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('firmware')
@Controller('firmware')
export class FirmwareController {
  constructor(private readonly firmwareService: FirmwareService) {}

  @Post()
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a new firmware version' })
  @ApiResponse({ status: 201, description: 'Firmware successfully created' })
  @ApiResponse({ status: 409, description: 'Firmware version already exists' })
  create(@Body() createFirmwareDto: CreateFirmwareDto) {
    return this.firmwareService.create(createFirmwareDto);
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'Get all firmware versions' })
  @ApiResponse({ status: 200, description: 'List of firmware versions' })
  @ApiQuery({
    name: 'stableOnly',
    required: false,
    type: Boolean,
    description: 'Filter to stable versions only',
  })
  findAll(@Query('stableOnly') stableOnly?: string) {
    return this.firmwareService.findAll(stableOnly === 'true');
  }

  @Public()
  @Get('latest/stable')
  @ApiOperation({ summary: 'Get latest stable firmware version' })
  @ApiResponse({ status: 200, description: 'Latest stable firmware version' })
  @ApiResponse({ status: 404, description: 'No stable firmware available' })
  findLatestStable() {
    return this.firmwareService.findLatestStable();
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get firmware by ID' })
  @ApiResponse({ status: 200, description: 'Firmware details' })
  @ApiResponse({ status: 404, description: 'Firmware not found' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.firmwareService.findOne(id);
  }

  @Public()
  @Get('version/:version')
  @ApiOperation({ summary: 'Get firmware by version string' })
  @ApiResponse({ status: 200, description: 'Firmware details' })
  @ApiResponse({ status: 404, description: 'Firmware version not found' })
  findByVersion(@Param('version') version: string) {
    return this.firmwareService.findByVersion(version);
  }

  @Patch(':id')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update firmware' })
  @ApiResponse({ status: 200, description: 'Firmware successfully updated' })
  @ApiResponse({ status: 404, description: 'Firmware not found' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateFirmwareDto: UpdateFirmwareDto,
  ) {
    return this.firmwareService.update(id, updateFirmwareDto);
  }

  @Delete(':id')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Delete firmware' })
  @ApiResponse({ status: 200, description: 'Firmware successfully deleted' })
  @ApiResponse({ status: 404, description: 'Firmware not found' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.firmwareService.remove(id);
  }

  @Post(':id/mark-stable')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Mark firmware as stable' })
  @ApiResponse({ status: 200, description: 'Firmware marked as stable' })
  @ApiResponse({ status: 404, description: 'Firmware not found' })
  markAsStable(@Param('id', ParseIntPipe) id: number) {
    return this.firmwareService.markAsStable(id);
  }
}
