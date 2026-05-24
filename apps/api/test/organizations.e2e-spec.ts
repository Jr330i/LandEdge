import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

const runDb = process.env.E2E_DB === '1';

(runDb ? describe : describe.skip)(
  'Organizations (e2e, requires Postgres + seed)',
  () => {
    let app: INestApplication<App>;

    beforeEach(async () => {
      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

      app = moduleFixture.createNestApplication();
      app.setGlobalPrefix('api/v1');
      app.useGlobalPipes(
        new ValidationPipe({
          whitelist: true,
          forbidNonWhitelisted: true,
          transform: true,
        }),
      );
      await app.init();
    });

    it('GET /api/v1/organizations requires auth', () => {
      return request(app.getHttpServer())
        .get('/api/v1/organizations')
        .expect(401);
    });

    it('GET /api/v1/organizations returns data as SUPER_ADMIN', async () => {
      const login = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          organizationSlug: 'demo',
          email: 'super@demo.sofinda.local',
          password: 'demo123',
        })
        .expect(200);

      const loginBody = login.body as { access_token?: string };
      const token = loginBody.access_token;
      expect(token).toBeDefined();

      await request(app.getHttpServer())
        .get('/api/v1/organizations')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect((res) => {
          const body = res.body as unknown[];
          expect(Array.isArray(body)).toBe(true);
          expect(body.length).toBeGreaterThanOrEqual(1);
        });
    });

    afterEach(async () => {
      await app.close();
    });
  },
);
