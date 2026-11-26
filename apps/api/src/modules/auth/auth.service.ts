import { BadRequestException, Injectable } from '@nestjs/common';
import type { Profile } from '@prisma/client';
import type { ProfileDto, StoreSummaryDto, SyncProfileInput, UpdateUserProfileInput } from '@tuvitrina/contracts';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

export function mapProfileDto(profile: Profile): ProfileDto {
  return {
    id: profile.id,
    email: profile.email,
    displayName: profile.displayName,
    phone: profile.phone,
    role: profile.role,
    termsVersion: profile.termsVersion,
    acceptedTermsAt: profile.acceptedTermsAt.toISOString(),
  };
}

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async syncProfile(
    uid: string,
    email: string,
    input: SyncProfileInput,
    getStoreSummary: (ownerId: string) => Promise<StoreSummaryDto | null>,
  ): Promise<{ profile: ProfileDto; store: StoreSummaryDto | null }> {
    this.prisma.ensureConfigured();

    if (!email) {
      throw new BadRequestException(
        'La cuenta autenticada no incluye correo electrónico verificable.',
      );
    }

    const existing = await this.prisma.profile.findUnique({ where: { id: uid } });
    const now = new Date();

    const profile = existing
      ? await this.prisma.profile.update({
          where: { id: uid },
          data: {
            email,
            displayName: input.displayName,
            phone: input.phone ?? existing.phone,
            termsVersion: input.termsVersion,
            acceptedTermsAt: now,
          },
        })
      : await this.prisma.$transaction(async (tx) => {
          const created = await tx.profile.create({
            data: {
              id: uid,
              email,
              displayName: input.displayName,
              phone: input.phone ?? null,
              role: 'seller',
              termsVersion: input.termsVersion,
              acceptedTermsAt: now,
            },
          });
          await tx.auditLog.create({
            data: {
              actorId: created.id,
              actorRole: created.role,
              action: 'profile.created',
              entityType: 'profile',
              entityId: created.id,
              metadata: { termsVersion: input.termsVersion },
            },
          });
          return created;
        });

    const store = await getStoreSummary(profile.id);
    return {
      profile: mapProfileDto(profile),
      store,
    };
  }

  async updateMe(profileId: string, input: UpdateUserProfileInput): Promise<{ profile: ProfileDto }> {
    this.prisma.ensureConfigured();
    const updated = await this.prisma.profile.update({
      where: { id: profileId },
      data: {
        displayName: input.displayName,
        phone: input.phone ?? null,
      },
    });
    return { profile: mapProfileDto(updated) };
  }
}
