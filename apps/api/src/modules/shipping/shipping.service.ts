import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type ShippingZone } from '@prisma/client';
import type { CurrencyCode, ShippingZoneInput } from '@tuvitrina/contracts';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { StoresService } from '../stores/stores.service';

export interface ShippingZoneDto {
  id: string;
  storeId: string;
  province: string;
  municipality: string | null;
  cost: number;
  currency: CurrencyCode;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

function mapShippingZoneDto(zone: ShippingZone): ShippingZoneDto {
  return {
    id: zone.id,
    storeId: zone.storeId,
    province: zone.province,
    municipality: zone.municipality,
    cost: Number(zone.cost),
    currency: zone.currency as CurrencyCode,
    active: zone.active,
    createdAt: (zone.createdAt ?? new Date()).toISOString(),
    updatedAt: (zone.updatedAt ?? new Date()).toISOString(),
  };
}

@Injectable()
export class ShippingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storesService: StoresService,
  ) {}

  async listZones(ownerId: string): Promise<ShippingZoneDto[]> {
    const store = await this.storesService.requireOwnedStore(ownerId);
    const zones = await this.prisma.shippingZone.findMany({
      where: { storeId: store.id },
      orderBy: [{ province: 'asc' }, { municipality: 'asc' }],
    });
    return zones.map(mapShippingZoneDto);
  }

  async createZone(ownerId: string, input: ShippingZoneInput): Promise<ShippingZoneDto> {
    const store = await this.storesService.requireOwnedStore(ownerId);
    const created = await this.prisma.shippingZone.create({
      data: {
        storeId: store.id,
        province: input.province,
        municipality: input.municipality ?? null,
        cost: new Prisma.Decimal(input.cost),
        currency: input.currency ?? store.baseCurrency,
        active: input.active ?? true,
      },
    });
    await this.storesService.bumpStoreCache(store.id, store.slug);
    return mapShippingZoneDto(created);
  }

  async updateZone(ownerId: string, zoneId: string, input: ShippingZoneInput): Promise<ShippingZoneDto> {
    const store = await this.storesService.requireOwnedStore(ownerId);
    const existing = await this.prisma.shippingZone.findFirst({
      where: { id: zoneId, storeId: store.id },
    });
    if (!existing) {
      throw new NotFoundException('Zona de envío no encontrada.');
    }

    const updated = await this.prisma.shippingZone.update({
      where: { id: zoneId },
      data: {
        province: input.province,
        municipality: input.municipality ?? null,
        cost: new Prisma.Decimal(input.cost),
        currency: input.currency ?? store.baseCurrency,
        active: input.active ?? true,
      },
    });
    await this.storesService.bumpStoreCache(store.id, store.slug);
    return mapShippingZoneDto(updated);
  }

  async deleteZone(ownerId: string, zoneId: string): Promise<{ deleted: boolean }> {
    const store = await this.storesService.requireOwnedStore(ownerId);
    const existing = await this.prisma.shippingZone.findFirst({
      where: { id: zoneId, storeId: store.id },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Zona de envío no encontrada.');
    }
    await this.prisma.shippingZone.delete({ where: { id: zoneId } });
    await this.storesService.bumpStoreCache(store.id, store.slug);
    return { deleted: true };
  }

  async calculateShipping(storeId: string, province: string, municipality: string): Promise<{ cost: number; currency: CurrencyCode; zoneName: string }> {
    const zones = await this.prisma.shippingZone.findMany({
      where: { storeId, active: true, province },
    });

    // Buscar coincidencia exacta por municipio
    const municipalMatch = zones.find(
      (z) => z.municipality && z.municipality.toLowerCase() === municipality.toLowerCase(),
    );
    if (municipalMatch) {
      return {
        cost: Number(municipalMatch.cost),
        currency: municipalMatch.currency as CurrencyCode,
        zoneName: `${municipalMatch.municipality}, ${municipalMatch.province}`,
      };
    }

    // Buscar coincidencia general por provincia (municipio null)
    const provinceMatch = zones.find((z) => !z.municipality);
    if (provinceMatch) {
      return {
        cost: Number(provinceMatch.cost),
        currency: provinceMatch.currency as CurrencyCode,
        zoneName: provinceMatch.province,
      };
    }

    return { cost: 0, currency: 'CUP', zoneName: 'Envío estándar' };
  }
}
