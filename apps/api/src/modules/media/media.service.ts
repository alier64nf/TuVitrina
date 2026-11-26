import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { SignedUploadRequestInput, SignedUploadResponse } from '@tuvitrina/contracts';
import { randomUUID } from 'node:crypto';
import { StoresService } from '../stores/stores.service';

const MIME_TO_EXT: Record<SignedUploadRequestInput['mimeType'], string> = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

@Injectable()
export class MediaService {
  private supabaseAdmin: SupabaseClient | null = null;

  constructor(private readonly storesService: StoresService) {}

  private getAdminClient(): { client: SupabaseClient; baseUrl: string } {
    const baseUrl = process.env.SUPABASE_URL?.trim().replace(/\/$/, '') || '';
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || '';
    if (!baseUrl || !serviceKey) {
      throw new ServiceUnavailableException(
        'Almacenamiento de imágenes no configurado (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).',
      );
    }
    if (!this.supabaseAdmin) {
      this.supabaseAdmin = createClient(baseUrl, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    }
    return { client: this.supabaseAdmin, baseUrl };
  }

  private resolveBucketName(logicalBucket: SignedUploadRequestInput['bucket']): string {
    if (logicalBucket === 'product-images') {
      return process.env.SUPABASE_STORAGE_BUCKET_PRODUCTS?.trim() || 'product-images';
    }
    return process.env.SUPABASE_STORAGE_BUCKET_ASSETS?.trim() || 'store-assets';
  }

  async createSignedUploadUrl(
    ownerId: string,
    input: SignedUploadRequestInput,
  ): Promise<SignedUploadResponse> {
    const store = await this.storesService.requireOwnedStore(ownerId);
    const { client, baseUrl } = this.getAdminClient();
    const bucket = this.resolveBucketName(input.bucket);
    const ext = MIME_TO_EXT[input.mimeType];
    const objectPath = `${store.id}/${randomUUID()}.${ext}`;

    const { data, error } = await client.storage.from(bucket).createSignedUploadUrl(objectPath);
    if (error || !data) {
      throw new ServiceUnavailableException(
        `No se pudo generar la URL firmada de subida: ${error?.message ?? 'error desconocido'}`,
      );
    }

    const { data: pub } = client.storage.from(bucket).getPublicUrl(objectPath);

    return {
      signedUrl: data.signedUrl,
      token: data.token,
      objectPath,
      publicUrl: pub.publicUrl || `${baseUrl}/storage/v1/object/public/${bucket}/${objectPath}`,
    };
  }
}
