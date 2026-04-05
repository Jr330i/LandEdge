import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';

@ApiTags('health')
@Public()
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Liveness / readiness probe' })
  getHealth() {
    return {
      status: 'ok',
      service: 'sofinda-api',
      timestamp: new Date().toISOString(),
    };
  }
}
