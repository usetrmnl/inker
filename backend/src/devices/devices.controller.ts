import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Patch,
  Param,
  Delete,
  Headers,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiHeader,
} from '@nestjs/swagger';
import { DevicesService } from './devices.service';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('devices')
@Controller('devices')
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Post()
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a new device' })
  @ApiResponse({ status: 201, description: 'Device successfully created' })
  @ApiResponse({ status: 400, description: 'Device with MAC address already exists' })
  create(@Body() createDeviceDto: CreateDeviceDto) {
    return this.devicesService.create(createDeviceDto);
  }

  @Get()
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get all devices with pagination' })
  @ApiResponse({ status: 200, description: 'List of devices' })
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = Math.max(parseInt(page || '1', 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit || '20', 10) || 20, 1), 100);
    return this.devicesService.findAll(pageNum, limitNum);
  }

  @Get(':id')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get device by ID' })
  @ApiResponse({ status: 200, description: 'Device details' })
  @ApiResponse({ status: 404, description: 'Device not found' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.devicesService.findOne(id);
  }

  @Patch(':id')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update device (PATCH)' })
  @ApiResponse({ status: 200, description: 'Device successfully updated' })
  @ApiResponse({ status: 404, description: 'Device not found' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDeviceDto: UpdateDeviceDto,
  ) {
    return this.devicesService.update(id, updateDeviceDto);
  }

  @Put(':id')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update device (PUT)' })
  @ApiResponse({ status: 200, description: 'Device successfully updated' })
  @ApiResponse({ status: 404, description: 'Device not found' })
  updatePut(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDeviceDto: UpdateDeviceDto,
  ) {
    return this.devicesService.update(id, updateDeviceDto);
  }

  @Delete(':id')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Delete device' })
  @ApiResponse({ status: 200, description: 'Device successfully deleted' })
  @ApiResponse({ status: 404, description: 'Device not found' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.devicesService.remove(id);
  }

  @Post(':id/regenerate-key')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Regenerate device API key' })
  @ApiResponse({ status: 200, description: 'API key regenerated' })
  @ApiResponse({ status: 404, description: 'Device not found' })
  regenerateKey(@Param('id', ParseIntPipe) id: number) {
    return this.devicesService.regenerateApiKey(id);
  }

  @Get(':id/logs')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get device logs' })
  @ApiResponse({ status: 200, description: 'Device logs' })
  @ApiResponse({ status: 404, description: 'Device not found' })
  getLogs(@Param('id', ParseIntPipe) id: number) {
    return this.devicesService.getDeviceLogs(id);
  }

  @Post(':id/refresh')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Trigger device refresh' })
  @ApiResponse({ status: 200, description: 'Device refresh triggered' })
  @ApiResponse({ status: 404, description: 'Device not found' })
  triggerRefresh(@Param('id', ParseIntPipe) id: number) {
    return this.devicesService.triggerRefresh(id);
  }

  @Delete(':id/playlist')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Unassign playlist from device',
    description:
      'Removes the playlist assignment from a device. The device will display ' +
      'the default "Hello World" screen until a new playlist is assigned.',
  })
  @ApiResponse({
    status: 200,
    description: 'Playlist unassigned successfully. Device will show default screen.',
  })
  @ApiResponse({ status: 404, description: 'Device not found' })
  @ApiResponse({ status: 400, description: 'Device has no playlist assigned' })
  unassignPlaylist(@Param('id', ParseIntPipe) id: number) {
    return this.devicesService.unassignPlaylist(id);
  }

  /**
   * PUBLIC ENDPOINTS FOR DEVICE COMMUNICATION
   */

  @Public()
  @Get('display/content')
  @ApiHeader({
    name: 'X-Device-Key',
    description: 'Device API Key',
    required: true,
  })
  @ApiOperation({
    summary: 'Get display content for device (device polling endpoint)',
  })
  @ApiResponse({ status: 200, description: 'Current screen to display' })
  @ApiResponse({ status: 404, description: 'Device not found' })
  @ApiResponse({ status: 403, description: 'Device is inactive' })
  getDisplayContent(@Headers('x-device-key') apiKey: string) {
    return this.devicesService.getDisplayContent(apiKey);
  }

}
