import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ScreensService } from './screens.service';
import { CreateScreenDto } from './dto/create-screen.dto';
import { UpdateScreenDto } from './dto/update-screen.dto';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('screens')
@Controller('screens')
export class ScreensController {
  constructor(private readonly screensService: ScreensService) {}

  @Post()
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a new screen' })
  @ApiResponse({ status: 201, description: 'Screen successfully created' })
  create(@Body() createScreenDto: CreateScreenDto) {
    return this.screensService.create(createScreenDto);
  }

  @Get()
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get all screens' })
  @ApiResponse({ status: 200, description: 'List of screens' })
  findAll() {
    return this.screensService.findAll();
  }

  @Public()
  @Get('public')
  @ApiOperation({ summary: 'Get public screens' })
  @ApiResponse({ status: 200, description: 'List of public screens' })
  findPublic() {
    return this.screensService.findPublicScreens();
  }

  @Get(':id')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get screen by ID' })
  @ApiResponse({ status: 200, description: 'Screen details' })
  @ApiResponse({ status: 404, description: 'Screen not found' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.screensService.findOne(id);
  }

  @Patch(':id')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update screen' })
  @ApiResponse({ status: 200, description: 'Screen successfully updated' })
  @ApiResponse({ status: 404, description: 'Screen not found' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateScreenDto: UpdateScreenDto,
  ) {
    return this.screensService.update(id, updateScreenDto);
  }

  @Delete(':id')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Delete screen' })
  @ApiResponse({ status: 200, description: 'Screen successfully deleted' })
  @ApiResponse({ status: 404, description: 'Screen not found' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.screensService.remove(id);
  }
}
