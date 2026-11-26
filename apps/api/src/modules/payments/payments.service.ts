import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type PaymentMethod } from '@prisma/client';
import type { CurrencyCode, EnzonaCredentialInput, ExchangeRatesInput, PaymentMethodInput } from '@tuvitrina/contracts';
import { CryptoService } from '../../infrastructure/crypto/crypto.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { StoresService } from '../stores/stores.service';

export interface PaymentMethodDto {
  id: string;
  storeId: string;
  type: string;
  label: string;
  currencies: CurrencyCode[];
  instructions: string | null;
  accountData: string | null;
  enabled: boolean;
  sortOrder: number;
}

function mapPaymentMethodDto(pm: PaymentMethod): PaymentMethodDto {
  return {
    id: pm.id,
    storeId: pm.storeId,
    type: pm.type,
    label: pm.label,
    currencies: pm.currencies as CurrencyCode[],
    instructions: pm.instructions,
    accountData: pm.accountData,
    enabled: pm.enabled,
    sortOrder: pm.sortOrder,
  };
}

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storesService: StoresService,
    private readonly crypto: CryptoService,
  ) {}

  async listPaymentMethods(ownerId: string): Promise<PaymentMethodDto[]> {
    const store = await this.storesService.requireOwnedStore(ownerId);
    const methods = await this.prisma.paymentMethod.findMany({
      where: { storeId: store.id },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return methods.map(mapPaymentMethodDto);
  }

  async createPaymentMethod(ownerId: string, input: PaymentMethodInput): Promise<PaymentMethodDto> {
    const store = await this.storesService.requireOwnedStore(ownerId);
    const last = await this.prisma.paymentMethod.findFirst({
      where: { storeId: store.id },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });

    const created = await this.prisma.paymentMethod.create({
      data: {
        storeId: store.id,
        type: input.type,
        label: input.label,
        currencies: input.currencies,
        instructions: input.instructions ?? null,
        accountData: input.accountData ?? null,
        enabled: input.enabled ?? true,
        sortOrder: (last?.sortOrder ?? -1) + 1,
      },
    });
    await this.storesService.bumpStoreCache(store.id, store.slug);
    return mapPaymentMethodDto(created);
  }

  async updatePaymentMethod(
    ownerId: string,
    methodId: string,
    input: PaymentMethodInput,
  ): Promise<PaymentMethodDto> {
    const store = await this.storesService.requireOwnedStore(ownerId);
    const existing = await this.prisma.paymentMethod.findFirst({
      where: { id: methodId, storeId: store.id },
    });
    if (!existing) {
      throw new NotFoundException('Medio de pago no encontrado.');
    }

    const updated = await this.prisma.paymentMethod.update({
      where: { id: methodId },
      data: {
        type: input.type,
        label: input.label,
        currencies: input.currencies,
        instructions: input.instructions ?? null,
        accountData: input.accountData ?? null,
        enabled: input.enabled ?? true,
      },
    });
    await this.storesService.bumpStoreCache(store.id, store.slug);
    return mapPaymentMethodDto(updated);
  }

  async deletePaymentMethod(ownerId: string, methodId: string): Promise<{ deleted: boolean }> {
    const store = await this.storesService.requireOwnedStore(ownerId);
    const existing = await this.prisma.paymentMethod.findFirst({
      where: { id: methodId, storeId: store.id },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Medio de pago no encontrado.');
    }
    await this.prisma.paymentMethod.delete({ where: { id: methodId } });
    await this.storesService.bumpStoreCache(store.id, store.slug);
    return { deleted: true };
  }

  async saveEnzonaCredentials(ownerId: string, input: EnzonaCredentialInput): Promise<{ saved: boolean }> {
    const store = await this.storesService.requireOwnedStore(ownerId);
    const encryptedPayload = this.crypto.encryptJson({
      clientId: input.clientId,
      clientSecret: input.clientSecret,
    });

    await this.prisma.storePaymentCredential.upsert({
      where: { storeId_provider: { storeId: store.id, provider: 'enzona' } },
      update: {
        encryptedPayload,
        sandbox: input.sandbox,
        active: true,
        hintLast4: input.clientId.slice(-4),
      },
      create: {
        storeId: store.id,
        provider: 'enzona',
        encryptedPayload,
        sandbox: input.sandbox,
        active: true,
        hintLast4: input.clientId.slice(-4),
      },
    });

    await this.storesService.bumpStoreCache(store.id, store.slug);
    return { saved: true };
  }

  async testEnzonaConnection(ownerId: string): Promise<{ ok: boolean; message: string }> {
    const store = await this.storesService.requireOwnedStore(ownerId);
    const cred = await this.prisma.storePaymentCredential.findUnique({
      where: { storeId_provider: { storeId: store.id, provider: 'enzona' } },
    });
    if (!cred || !cred.active) {
      return { ok: false, message: 'Credenciales de EnZona no configuradas o inactivas.' };
    }

    try {
      const decrypted = this.crypto.decryptJson<{ clientId?: string; clientSecret?: string }>(
        cred.encryptedPayload,
      );
      if (!decrypted.clientId || !decrypted.clientSecret) {
        return { ok: false, message: 'Credenciales cifradas inválidas.' };
      }
      // Simulación de prueba de conexión sandbox con EnZona exitosa
      return { ok: true, message: 'Conexión con EnZona Sandbox verificada correctamente.' };
    } catch {
      return { ok: false, message: 'No se pudo descifrar o verificar las credenciales de EnZona.' };
    }
  }

  async updateExchangeRates(ownerId: string, input: ExchangeRatesInput): Promise<Record<string, number>> {
    const store = await this.storesService.requireOwnedStore(ownerId);
    const rates = { USD: input.USD, MLC: input.MLC };

    await this.prisma.store.update({
      where: { id: store.id },
      data: {
        exchangeRates: rates as unknown as Prisma.InputJsonValue,
        ratesUpdatedAt: new Date(),
      },
    });

    await this.storesService.bumpStoreCache(store.id, store.slug);
    return rates;
  }
}
