import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { DataSourcesController } from './data-sources.controller';
import { DataSourcesService } from './data-sources.service';
import { PinAuthGuard } from '../auth/guards/pin-auth.guard';
import { TransformInterceptor } from '../common/interceptors/transform.interceptor';

describe('DataSourcesController (e2e)', () => {
  let app: INestApplication;

  const mockDataSource = {
    id: 1,
    name: 'Test API',
    description: 'A test data source',
    type: 'json',
    url: 'https://api.example.com/data',
    method: 'GET',
    isActive: true,
    refreshInterval: 300,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockDataSourcesService = {
    create: async () => mockDataSource,
    findAll: async () => ({
      items: [mockDataSource],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    }),
    findOne: async () => mockDataSource,
    update: async () => ({ ...mockDataSource, name: 'Updated API' }),
    remove: async () => ({ message: 'Data source deleted successfully' }),
    testUrl: async () => ({ success: true, data: {}, fields: [] }),
    testFetch: async () => ({ success: true, data: {}, fields: [] }),
    refresh: async () => ({ success: true, data: {}, dataSource: mockDataSource }),
    getCachedData: async () => ({ key: 'value' }),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [DataSourcesController],
      providers: [
        { provide: DataSourcesService, useValue: mockDataSourcesService },
      ],
    })
      .overrideGuard(PinAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('GET /data-sources', () => {
    it('should return paginated list of data sources', async () => {
      const response = await request(app.getHttpServer())
        .get('/data-sources')
        .expect(200);

      expect(response.body.data).toHaveProperty('items');
      expect(response.body.data).toHaveProperty('total');
    });
  });

  describe('GET /data-sources/:id', () => {
    it('should return a data source by ID', async () => {
      const response = await request(app.getHttpServer())
        .get('/data-sources/1')
        .expect(200);

      expect(response.body.data).toHaveProperty('id', 1);
      expect(response.body.data).toHaveProperty('name', 'Test API');
    });
  });

  describe('POST /data-sources', () => {
    it('should create a new data source', async () => {
      const response = await request(app.getHttpServer())
        .post('/data-sources')
        .send({ name: 'New API', type: 'json', url: 'https://api.example.com/new' })
        .expect(201);

      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('url');
    });
  });

  describe('DELETE /data-sources/:id', () => {
    it('should delete a data source', async () => {
      const response = await request(app.getHttpServer())
        .delete('/data-sources/1')
        .expect(200);

      expect(response.body.data).toHaveProperty('message', 'Data source deleted successfully');
    });
  });
});
