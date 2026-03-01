import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { ScreensController } from './screens.controller';
import { ScreensService } from './screens.service';
import { PinAuthGuard } from '../auth/guards/pin-auth.guard';
import { TransformInterceptor } from '../common/interceptors/transform.interceptor';

describe('ScreensController (e2e)', () => {
  let app: INestApplication;

  const mockScreen = {
    id: 1,
    name: 'Test Screen',
    description: 'A test screen',
    imageUrl: '/uploads/screens/test.png',
    thumbnailUrl: '/uploads/screens/thumb_test.jpg',
    isPublic: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockScreensService = {
    create: async () => mockScreen,
    findAll: async () => ({ items: [mockScreen], total: 1 }),
    findOne: async () => mockScreen,
    update: async () => ({ ...mockScreen, name: 'Updated Screen' }),
    remove: async () => ({ message: 'Screen deleted successfully', affectedPlaylists: 0 }),
    findPublicScreens: async () => ({ items: [], total: 0 }),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ScreensController],
      providers: [
        { provide: ScreensService, useValue: mockScreensService },
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

  describe('GET /screens', () => {
    it('should return list of screens', async () => {
      const response = await request(app.getHttpServer())
        .get('/screens')
        .expect(200);

      expect(response.body.data).toHaveProperty('items');
    });
  });

  describe('GET /screens/:id', () => {
    it('should return a screen by ID', async () => {
      const response = await request(app.getHttpServer())
        .get('/screens/1')
        .expect(200);

      expect(response.body.data).toHaveProperty('id', 1);
      expect(response.body.data).toHaveProperty('name', 'Test Screen');
    });
  });

  describe('POST /screens', () => {
    it('should create a new screen', async () => {
      const response = await request(app.getHttpServer())
        .post('/screens')
        .send({ name: 'New Screen', imageUrl: 'https://example.com/screen.png', modelId: 1 })
        .expect(201);

      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('name');
    });
  });

  describe('DELETE /screens/:id', () => {
    it('should delete a screen', async () => {
      const response = await request(app.getHttpServer())
        .delete('/screens/1')
        .expect(200);

      expect(response.body.data).toHaveProperty('message', 'Screen deleted successfully');
    });
  });
});
