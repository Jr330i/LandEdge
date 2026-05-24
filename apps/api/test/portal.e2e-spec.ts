import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

const runDb = process.env.E2E_DB === '1';

(runDb ? describe : describe.skip)(
  'Portal (e2e, requires Postgres + seed)',
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

    async function login(email: string) {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          organizationSlug: 'demo',
          email,
          password: 'demo123',
        })
        .expect(200);
      const body = res.body as { access_token?: string };
      expect(body.access_token).toBeDefined();
      return body.access_token!;
    }

    it('TENANT_USER can load portal snapshot and invoices', async () => {
      const token = await login('tenant@demo.sofinda.local');

      await request(app.getHttpServer())
        .get('/api/v1/portal/tenant')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect((res) => {
          const body = res.body as { linkedTenant?: boolean };
          expect(body.linkedTenant).toBe(true);
        });

      await request(app.getHttpServer())
        .get('/api/v1/portal/tenant/invoices')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect((res) => {
          const body = res.body as { items?: unknown[] };
          expect(Array.isArray(body.items)).toBe(true);
        });
    });

    it('OWNER_USER can load owner portal and properties', async () => {
      const token = await login('owner@demo.sofinda.local');

      await request(app.getHttpServer())
        .get('/api/v1/portal/owner')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect((res) => {
          const body = res.body as { organization?: { name?: string } };
          expect(body.organization?.name).toBeDefined();
        });

      await request(app.getHttpServer())
        .get('/api/v1/portal/owner/properties')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });

    it('POST /auth/forgot-password returns ok without leaking account existence', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/forgot-password')
        .send({
          organizationSlug: 'demo',
          email: 'nobody@example.com',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body).toEqual({ ok: true });
        });
    });

    afterEach(async () => {
      await app.close();
    });
  },
);
