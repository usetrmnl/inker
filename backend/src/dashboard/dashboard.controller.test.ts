import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { PinAuthGuard } from '../auth/guards/pin-auth.guard';
import { TransformInterceptor } from '../common/interceptors/transform.interceptor';

describe('DashboardController (e2e)', () => {
  let app: INestApplication;

  const mockDashboardService = {
    getStats: async () => ({
      totalDevices: 5,
      onlineDevices: 2,
      totalScreens: 10,
      totalPlaylists: 3,
      recentDevices: [],
      recentScreens: [],
    }),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [
        { provide: DashboardService, useValue: mockDashboardService },
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

  describe('GET /dashboard/stats', () => {
    it('should return dashboard statistics', async () => {
      const response = await request(app.getHttpServer())
        .get('/dashboard/stats')
        .expect(200);

      expect(response.body.data).toHaveProperty('totalDevices', 5);
      expect(response.body.data).toHaveProperty('onlineDevices', 2);
      expect(response.body.data).toHaveProperty('totalScreens', 10);
      expect(response.body.data).toHaveProperty('totalPlaylists', 3);
    });

    it('should include recent devices and screens arrays', async () => {
      const response = await request(app.getHttpServer())
        .get('/dashboard/stats')
        .expect(200);

      expect(response.body.data).toHaveProperty('recentDevices');
      expect(response.body.data).toHaveProperty('recentScreens');
      expect(Array.isArray(response.body.data.recentDevices)).toBe(true);
      expect(Array.isArray(response.body.data.recentScreens)).toBe(true);
    });
  });
});
