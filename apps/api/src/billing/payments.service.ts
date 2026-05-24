import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  InvoiceStatus,
  LedgerSource,
  PaymentProvider,
  PaymentTransactionStatus,
  Prisma,
  UserRole,
} from '@prisma/client';
import * as crypto from 'crypto';
import type { Request } from 'express';
import type { JwtAccessPayload } from '../auth/jwt.types';
import { PrismaService } from '../prisma/prisma.service';
import { InvoicesService } from './invoices.service';
import { CreatePaymentCheckoutDto } from './dto/create-payment-checkout.dto';

type RequestWithRawBody = Request & { rawBody?: Buffer };

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invoicesService: InvoicesService,
  ) {}

  private lipilaConfig() {
    const apiKey = process.env.LIPILA_API_KEY?.trim();
    const webhookSecret = process.env.LIPILA_WEBHOOK_SECRET?.trim();
    const callbackUrl = process.env.LIPILA_WEBHOOK_CALLBACK_URL?.trim();
    const baseUrl = (
      process.env.LIPILA_API_BASE_URL?.trim() || 'https://api.lipila.dev'
    ).replace(/\/$/, '');
    if (!apiKey || !webhookSecret || !callbackUrl) {
      throw new BadRequestException(
        'Lipila is not configured. Set LIPILA_API_KEY, LIPILA_WEBHOOK_SECRET, and LIPILA_WEBHOOK_CALLBACK_URL.',
      );
    }
    return { apiKey, webhookSecret, callbackUrl, baseUrl };
  }

  private mapWebhookStatus(s?: string): PaymentTransactionStatus {
    const n = (s ?? '').trim().toLowerCase();
    if (
      n === 'success' ||
      n === 'succeeded' ||
      n === 'paid' ||
      n === 'successful'
    ) {
      return PaymentTransactionStatus.SUCCEEDED;
    }
    if (n === 'failed' || n === 'error') {
      return PaymentTransactionStatus.FAILED;
    }
    if (n === 'cancelled' || n === 'canceled') {
      return PaymentTransactionStatus.CANCELLED;
    }
    return PaymentTransactionStatus.PENDING;
  }

  private normalizeMsisdn(raw: string): string {
    return raw.replace(/[\s-]/g, '');
  }

  /**
   * Verifies Lipila Standard Webhooks signatures (HMAC-SHA256 over
   * `{webhook-id}.{webhook-timestamp}.{raw_body}` with base64-decoded secret).
   * @see https://docs.lipila.dev/docs/security/webhook-security.html
   */
  private verifyLipilaWebhookSignature(
    webhookSecretB64: string,
    webhookId: string,
    webhookTimestamp: string,
    rawBody: Buffer,
    webhookSignatureHeader: string,
  ): boolean {
    let key: Buffer;
    try {
      key = Buffer.from(webhookSecretB64, 'base64');
    } catch {
      return false;
    }
    if (!key.length) return false;

    const rawBodyStr = rawBody.toString('utf8');
    const signedPayload = `${webhookId}.${webhookTimestamp}.${rawBodyStr}`;
    const mac = crypto.createHmac('sha256', key);
    mac.update(signedPayload, 'utf8');
    const expectedStr = `v1,${mac.digest('base64')}`;

    const candidates = webhookSignatureHeader.split(/\s+/).map((s) => s.trim());
    for (const sig of candidates) {
      if (!sig.startsWith('v1,')) continue;
      if (sig.length !== expectedStr.length) continue;
      try {
        if (
          crypto.timingSafeEqual(
            Buffer.from(sig, 'utf8'),
            Buffer.from(expectedStr, 'utf8'),
          )
        ) {
          return true;
        }
      } catch {
        // length mismatch for timingSafeEqual
      }
    }
    return false;
  }

  private assertWebhookTimestampFresh(webhookTimestamp: string): void {
    const ts = Number(webhookTimestamp);
    if (!Number.isFinite(ts)) {
      throw new BadRequestException('Invalid webhook timestamp');
    }
    const nowSec = Math.floor(Date.now() / 1000);
    if (Math.abs(nowSec - ts) > 300) {
      throw new BadRequestException('Stale webhook timestamp');
    }
  }

  private extractReferenceId(
    payload: Record<string, unknown>,
  ): string | undefined {
    const data = payload.data;
    if (data && typeof data === 'object' && data !== null) {
      const d = data as Record<string, unknown>;
      if (typeof d.referenceId === 'string' && d.referenceId.trim()) {
        return d.referenceId.trim();
      }
    }
    if (typeof payload.referenceId === 'string' && payload.referenceId.trim()) {
      return payload.referenceId.trim();
    }
    return undefined;
  }

  private extractStatusFromPayload(
    payload: Record<string, unknown>,
  ): string | undefined {
    const data = payload.data;
    if (data && typeof data === 'object' && data !== null) {
      const d = data as Record<string, unknown>;
      if (typeof d.status === 'string') return d.status;
    }
    if (typeof payload.status === 'string') return payload.status;
    const t =
      typeof payload.type === 'string' ? payload.type.toLowerCase() : '';
    if (t.includes('completed')) return 'success';
    if (t.includes('failed')) return 'failed';
    return undefined;
  }

  async createCheckout(actor: JwtAccessPayload, dto: CreatePaymentCheckoutDto) {
    const { apiKey, callbackUrl, baseUrl } = this.lipilaConfig();
    const amountProvided =
      dto.amount !== undefined ? Math.abs(dto.amount) : undefined;
    return this.prisma.withUserRls(actor, async (tx) => {
      const inv = await tx.invoice.findUnique({
        where: { id: dto.invoiceId },
        include: { lines: true, tenant: true },
      });
      if (!inv) throw new NotFoundException('Invoice not found');
      if (
        actor.role !== UserRole.SUPER_ADMIN &&
        inv.organizationId !== actor.organizationId
      ) {
        throw new NotFoundException('Invoice not found');
      }
      if (inv.status !== InvoiceStatus.ISSUED) {
        throw new BadRequestException('Only issued invoices can be paid');
      }
      const invoiceTotal = inv.lines.reduce((s, l) => s + Number(l.amount), 0);
      const outstanding = await tx.ledgerEntry
        .findMany({
          where: {
            leaseId: inv.leaseId,
            source: { in: [LedgerSource.PAYMENT, LedgerSource.ADJUSTMENT] },
            narrative: { contains: `INV:${inv.id}`, mode: 'insensitive' },
          },
          select: { signedAmount: true },
        })
        .then((rows) => rows.reduce((s, r) => s + -Number(r.signedAmount), 0));
      const dueNow = Math.max(0, invoiceTotal - outstanding);
      const amount = amountProvided ?? dueNow;
      if (amount <= 0) {
        throw new BadRequestException('Invoice has no outstanding balance');
      }

      const accountNumber = this.normalizeMsisdn(
        (dto.accountNumber ?? inv.tenant.contactPhone ?? '').trim(),
      );
      if (!accountNumber) {
        throw new BadRequestException(
          'Mobile money account number is required (provide accountNumber or set tenant contactPhone).',
        );
      }

      const providerReference = `lpl_${crypto.randomBytes(12).toString('hex')}`;
      const narration =
        dto.narrative?.trim() ||
        `Invoice ${inv.id.slice(0, 8)}… (${inv.currency})`;
      const email =
        dto.email?.trim() || inv.tenant.contactEmail?.trim() || undefined;

      const requestBody = {
        referenceId: providerReference,
        amount,
        narration,
        accountNumber,
        currency: inv.currency,
        ...(email ? { email } : {}),
      };

      const txRow = await tx.paymentTransaction.create({
        data: {
          organizationId: inv.organizationId,
          invoiceId: inv.id,
          provider: PaymentProvider.LIPILA,
          providerReference,
          amount: new Prisma.Decimal(String(amount)),
          currency: inv.currency,
          status: PaymentTransactionStatus.INITIATED,
          rawRequest: requestBody as Prisma.InputJsonValue,
        },
      });

      const collectionUrl = `${baseUrl}/api/v1/collections/mobile-money`;
      const response = await fetch(collectionUrl, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          callbackUrl,
        },
        body: JSON.stringify(requestBody),
      });
      const body = (await response.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
      if (!response.ok) {
        await tx.paymentTransaction.update({
          where: { id: txRow.id },
          data: {
            status: PaymentTransactionStatus.FAILED,
            rawResponse: body as Prisma.InputJsonValue,
          },
        });
        throw new BadRequestException(
          'Lipila collection initialization failed',
        );
      }

      const checkoutUrl =
        (typeof body.cardRedirectionUrl === 'string' &&
          body.cardRedirectionUrl) ||
        null;
      const identifier =
        typeof body.identifier === 'string' ? body.identifier : null;

      await tx.paymentTransaction.update({
        where: { id: txRow.id },
        data: {
          status: PaymentTransactionStatus.PENDING,
          checkoutUrl,
          rawResponse: body as Prisma.InputJsonValue,
        },
      });

      return {
        id: txRow.id,
        reference: providerReference,
        checkoutUrl,
        lipilaIdentifier: identifier,
        amount,
        currency: inv.currency,
      };
    });
  }

  async handleLipilaWebhook(req: RequestWithRawBody) {
    const { webhookSecret } = this.lipilaConfig();
    const rawBody = req.rawBody;
    if (!rawBody?.length) {
      throw new BadRequestException('Missing raw webhook body');
    }

    const webhookId = req.header('webhook-id');
    const webhookTimestamp = req.header('webhook-timestamp');
    const webhookSignature = req.header('webhook-signature');
    if (!webhookId || !webhookTimestamp || !webhookSignature) {
      throw new BadRequestException('Missing Lipila webhook headers');
    }

    this.assertWebhookTimestampFresh(webhookTimestamp);
    const ok = this.verifyLipilaWebhookSignature(
      webhookSecret,
      webhookId,
      webhookTimestamp,
      rawBody,
      webhookSignature,
    );
    if (!ok) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(rawBody.toString('utf8')) as Record<string, unknown>;
    } catch {
      throw new BadRequestException('Invalid webhook JSON');
    }

    const referenceId = this.extractReferenceId(parsed);
    if (!referenceId) {
      throw new BadRequestException('Webhook payload missing referenceId');
    }
    const status = this.mapWebhookStatus(this.extractStatusFromPayload(parsed));

    return this.prisma.withLoginRls(async (tx) => {
      const row = await tx.paymentTransaction.findUnique({
        where: {
          provider_providerReference: {
            provider: PaymentProvider.LIPILA,
            providerReference: referenceId,
          },
        },
      });
      if (!row) throw new NotFoundException('Payment transaction not found');

      const alreadySucceeded =
        row.status === PaymentTransactionStatus.SUCCEEDED;
      const updated = await tx.paymentTransaction.update({
        where: { id: row.id },
        data: {
          status,
          settledAt:
            status === PaymentTransactionStatus.SUCCEEDED ? new Date() : null,
          rawResponse: parsed as Prisma.InputJsonValue,
        },
      });

      if (!alreadySucceeded && status === PaymentTransactionStatus.SUCCEEDED) {
        await this.invoicesService.allocatePaymentSystem(
          updated.invoiceId,
          Number(updated.amount),
          `Lipila ${updated.providerReference}`,
        );
      }
      return { ok: true };
    });
  }
}
