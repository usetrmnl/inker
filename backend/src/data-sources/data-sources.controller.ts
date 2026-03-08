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
import { DataSourcesService } from './data-sources.service';
import { CreateDataSourceDto } from './dto/create-data-source.dto';
import { UpdateDataSourceDto } from './dto/update-data-source.dto';
import { TestUrlDto } from './dto/test-url.dto';

@ApiTags('Data Sources')
@ApiBearerAuth()
@Controller('data-sources')
export class DataSourcesController {
  constructor(private readonly dataSourcesService: DataSourcesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new data source' })
  create(@Body() createDataSourceDto: CreateDataSourceDto) {
    return this.dataSourcesService.create(createDataSourceDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all data sources with pagination' })
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('activeOnly') activeOnly?: string,
  ) {
    const pageNum = Math.max(parseInt(page || '1', 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit || '20', 10) || 20, 1), 100);
    return this.dataSourcesService.findAll(pageNum, limitNum, activeOnly === 'true');
  }

  @Post('test-url')
  @ApiOperation({
    summary: 'Test a URL without saving',
    description:
      'Fetches data from the provided URL and returns available fields with their types. Use this to preview what data is available before creating a data source.',
  })
  testUrl(@Body() testUrlDto: TestUrlDto) {
    return this.dataSourcesService.testUrl(testUrlDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a data source by ID' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.dataSourcesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a data source' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDataSourceDto: UpdateDataSourceDto,
  ) {
    return this.dataSourcesService.update(id, updateDataSourceDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a data source' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.dataSourcesService.remove(id);
  }

  @Post(':id/test')
  @ApiOperation({ summary: 'Test fetch data from source without saving' })
  testFetch(@Param('id', ParseIntPipe) id: number) {
    return this.dataSourcesService.testFetch(id);
  }

  @Post(':id/refresh')
  @ApiOperation({ summary: 'Force refresh and cache data from source' })
  refresh(@Param('id', ParseIntPipe) id: number) {
    return this.dataSourcesService.refresh(id);
  }

  @Get(':id/data')
  @ApiOperation({ summary: 'Get cached data, refreshing if stale' })
  getCachedData(@Param('id', ParseIntPipe) id: number) {
    return this.dataSourcesService.getCachedData(id);
  }
}
