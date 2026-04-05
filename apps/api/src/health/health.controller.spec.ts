import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('returns ok payload', () => {
    const body = controller.getHealth();
    expect(body.status).toBe('ok');
    expect(body.service).toBe('sofinda-api');
    expect(body.timestamp).toBeDefined();
  });
});
