import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { ExtensionsController } from './extensions.controller';
import { ExtensionsService } from './extensions.service';
import { PinAuthGuard } from '../auth/guards/pin-auth.guard';
import { TransformInterceptor } from '../common/interceptors/transform.interceptor';

describe('ExtensionsController (e2e)', () => {
  let app: INestApplication;

  const mockExtension = {
    id: 1,
    name: 'Test Extension',
    description: 'A test extension',
    type: 'webhook',
    config: {},
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockExtensionsService = {
    create: async () => mockExtension,
    findAll: async () => ({ items: [mockExtension], total: 1 }),
    findOne: async () => mockExtension,
    update: async () => ({ ...mockExtension, name: 'Updated Extension' }),
    remove: async () => ({ message: 'Extension deleted successfully' }),
    toggleActive: async () => ({ ...mockExtension, isActive: false }),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ExtensionsController],
      providers: [
        { provide: ExtensionsService, useValue: mockExtensionsService },
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

  describe('GET /extensions', () => {
    it('should return list of extensions', async () => {
      const response = await request(app.getHttpServer())
        .get('/extensions')
        .expect(200);

      expect(response.body.data).toHaveProperty('items');
    });
  });

  describe('POST /extensions', () => {
    it('should create a new extension', async () => {
      const response = await request(app.getHttpServer())
        .post('/extensions')
        .send({ name: 'New Extension', type: 'webhook' })
        .expect(201);

      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('name');
    });
  });

  describe('DELETE /extensions/:id', () => {
    it('should delete an extension', async () => {
      const response = await request(app.getHttpServer())
        .delete('/extensions/1')
        .expect(200);

      expect(response.body.data).toHaveProperty('message', 'Extension deleted successfully');
    });
  });
});
