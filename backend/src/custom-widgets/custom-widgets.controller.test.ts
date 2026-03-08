import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { CustomWidgetsController } from './custom-widgets.controller';
import { CustomWidgetsService } from './custom-widgets.service';
import { PinAuthGuard } from '../auth/guards/pin-auth.guard';
import { TransformInterceptor } from '../common/interceptors/transform.interceptor';

describe('CustomWidgetsController (e2e)', () => {
  let app: INestApplication;

  const mockCustomWidget = {
    id: 1,
    name: 'Test Widget',
    description: 'A test custom widget',
    displayType: 'value',
    template: null,
    config: { field: 'price' },
    dataSourceId: 1,
    minWidth: 100,
    minHeight: 50,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    dataSource: { id: 1, name: 'Test API', type: 'json', isActive: true },
  };

  const mockCustomWidgetsService = {
    create: async () => mockCustomWidget,
    findAll: async () => ({
      items: [mockCustomWidget],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    }),
    findOne: async () => mockCustomWidget,
    update: async () => ({ ...mockCustomWidget, name: 'Updated Widget' }),
    remove: async () => ({ message: 'Custom widget deleted successfully' }),
    getWithData: async () => ({ widget: mockCustomWidget, data: {}, renderedContent: 'test' }),
    getAsWidgetTemplates: async () => [],
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [CustomWidgetsController],
      providers: [
        { provide: CustomWidgetsService, useValue: mockCustomWidgetsService },
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

  describe('GET /custom-widgets', () => {
    it('should return paginated list of custom widgets', async () => {
      const response = await request(app.getHttpServer())
        .get('/custom-widgets')
        .expect(200);

      expect(response.body.data).toHaveProperty('items');
      expect(response.body.data).toHaveProperty('total');
    });
  });

  describe('GET /custom-widgets/:id', () => {
    it('should return a custom widget by ID', async () => {
      const response = await request(app.getHttpServer())
        .get('/custom-widgets/1')
        .expect(200);

      expect(response.body.data).toHaveProperty('id', 1);
      expect(response.body.data).toHaveProperty('name', 'Test Widget');
      expect(response.body.data).toHaveProperty('dataSource');
    });
  });

  describe('POST /custom-widgets', () => {
    it('should create a new custom widget', async () => {
      const response = await request(app.getHttpServer())
        .post('/custom-widgets')
        .send({ name: 'New Widget', dataSourceId: 1, displayType: 'value' })
        .expect(201);

      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('displayType');
    });
  });

  describe('DELETE /custom-widgets/:id', () => {
    it('should delete a custom widget', async () => {
      const response = await request(app.getHttpServer())
        .delete('/custom-widgets/1')
        .expect(200);

      expect(response.body.data).toHaveProperty('message', 'Custom widget deleted successfully');
    });
  });
});
