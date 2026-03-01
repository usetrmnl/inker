import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { ModelsController } from './models.controller';
import { ModelsService } from './models.service';
import { PinAuthGuard } from '../auth/guards/pin-auth.guard';
import { TransformInterceptor } from '../common/interceptors/transform.interceptor';

describe('ModelsController (e2e)', () => {
  let app: INestApplication;

  const mockModel = {
    id: 1,
    name: 'trmnl-7.5',
    label: 'TRMNL 7.5"',
    width: 800,
    height: 480,
    description: 'Standard e-ink display',
    mimeType: 'image/png',
    colors: 2,
    bitDepth: 1,
    rotation: 0,
    kind: 'terminus',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockModelsService = {
    create: async () => mockModel,
    findAll: async () => ({ items: [mockModel], total: 1 }),
    findOne: async () => mockModel,
    update: async () => ({ ...mockModel, label: 'Updated Label' }),
    remove: async () => ({ message: 'Model deleted successfully' }),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ModelsController],
      providers: [
        { provide: ModelsService, useValue: mockModelsService },
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

  describe('GET /models', () => {
    it('should return list of models', async () => {
      const response = await request(app.getHttpServer())
        .get('/models')
        .expect(200);

      expect(response.body.data).toHaveProperty('items');
    });
  });

  describe('POST /models', () => {
    it('should create a new model', async () => {
      const response = await request(app.getHttpServer())
        .post('/models')
        .send({ name: 'trmnl-7.5', label: 'TRMNL 7.5"', width: 800, height: 480 })
        .expect(201);

      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('name', 'trmnl-7.5');
    });
  });

  describe('DELETE /models/:id', () => {
    it('should delete a model', async () => {
      const response = await request(app.getHttpServer())
        .delete('/models/1')
        .expect(200);

      expect(response.body.data).toHaveProperty('message', 'Model deleted successfully');
    });
  });
});
