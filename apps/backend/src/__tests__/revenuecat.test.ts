import { afterEach, describe, expect, it, spyOn } from 'bun:test';
import { app, supabaseAdmin } from '../index';

describe('Stage 8D: RevenueCat Webhooks & Account Deletion (Apple Guideline 5.1.1v)', () => {
  const originalWebhookHeader = process.env.REVENUECAT_WEBHOOK_AUTH_HEADER;

  afterEach(() => {
    if (originalWebhookHeader === undefined) {
      delete process.env.REVENUECAT_WEBHOOK_AUTH_HEADER;
    } else {
      process.env.REVENUECAT_WEBHOOK_AUTH_HEADER = originalWebhookHeader;
    }
  });

  it('1. Rejects webhook with HTTP 401 when Authorization header does not match REVENUECAT_WEBHOOK_AUTH_HEADER', async () => {
    process.env.REVENUECAT_WEBHOOK_AUTH_HEADER = 'Bearer rc-secret-webhook-key';

    const res = await app.request('/api/v1/revenuecat/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer invalid-key',
      },
      body: JSON.stringify({
        api_version: '1.0',
        event: {
          id: 'evt_1',
          type: 'INITIAL_PURCHASE',
          app_user_id: '11111111-1111-1111-1111-111111111111',
          product_id: 'learneng_pro_monthly',
          period_type: 'TRIAL',
        },
      }),
    });

    expect(res.status).toBe(401);
  });

  it('2. Updates user_subscriptions to status = "trialing" on INITIAL_PURCHASE with period_type = "TRIAL" and "active" on RENEWAL', async () => {
    process.env.REVENUECAT_WEBHOOK_AUTH_HEADER = 'Bearer rc-secret-webhook-key';
    const userId = '11111111-1111-1111-1111-111111111111';

    const upsertedPayloads: any[] = [];
    const fromSpy = spyOn(supabaseAdmin, 'from').mockImplementation((() => ({
      upsert: async (payload: any) => {
        upsertedPayloads.push(payload);
        return { data: payload, error: null };
      },
    })) as any);

    // A: INITIAL_PURCHASE with TRIAL
    const resTrial = await app.request('/api/v1/revenuecat/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer rc-secret-webhook-key',
      },
      body: JSON.stringify({
        api_version: '1.0',
        event: {
          id: 'evt_trial',
          type: 'INITIAL_PURCHASE',
          app_user_id: userId,
          original_app_user_id: userId,
          product_id: 'learneng_pro_monthly',
          period_type: 'TRIAL',
          purchased_at_ms: 1700000000000,
          expiration_at_ms: 1700259200000,
          entitlement_ids: ['pro_access'],
          store: 'APP_STORE',
        },
      }),
    });

    expect(resTrial.status).toBe(200);
    expect(upsertedPayloads).toHaveLength(1);
    expect(upsertedPayloads[0]).toMatchObject({
      user_id: userId,
      plan_tier: 'pro',
      status: 'trialing',
      product_identifier: 'learneng_pro_monthly',
    });

    // B: RENEWAL with NORMAL period_type
    const resRenewal = await app.request('/api/v1/revenuecat/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer rc-secret-webhook-key',
      },
      body: JSON.stringify({
        api_version: '1.0',
        event: {
          id: 'evt_renewal',
          type: 'RENEWAL',
          app_user_id: userId,
          original_app_user_id: userId,
          product_id: 'learneng_master_monthly',
          period_type: 'NORMAL',
          purchased_at_ms: 1700259200000,
          expiration_at_ms: 1702851200000,
          entitlement_ids: ['pro_access', 'master_access'],
          store: 'APP_STORE',
        },
      }),
    });

    expect(resRenewal.status).toBe(200);
    expect(upsertedPayloads).toHaveLength(2);
    expect(upsertedPayloads[1]).toMatchObject({
      user_id: userId,
      plan_tier: 'master',
      status: 'active',
      product_identifier: 'learneng_master_monthly',
    });

    fromSpy.mockRestore();
  });

  it('3. Downgrades user_subscriptions to plan_tier = "free" and status = "inactive" on EXPIRATION', async () => {
    process.env.REVENUECAT_WEBHOOK_AUTH_HEADER = 'Bearer rc-secret-webhook-key';
    const userId = '11111111-1111-1111-1111-111111111111';

    let capturedPayload: any = null;
    const fromSpy = spyOn(supabaseAdmin, 'from').mockImplementation((() => ({
      upsert: async (payload: any) => {
        capturedPayload = payload;
        return { data: payload, error: null };
      },
    })) as any);

    const res = await app.request('/api/v1/revenuecat/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer rc-secret-webhook-key',
      },
      body: JSON.stringify({
        api_version: '1.0',
        event: {
          id: 'evt_exp',
          type: 'EXPIRATION',
          app_user_id: userId,
          original_app_user_id: userId,
          product_id: 'learneng_pro_monthly',
          period_type: 'NORMAL',
          purchased_at_ms: 1700000000000,
          expiration_at_ms: 1702851200000,
          entitlement_ids: ['pro_access'],
          store: 'APP_STORE',
        },
      }),
    });

    expect(res.status).toBe(200);
    expect(capturedPayload).toMatchObject({
      user_id: userId,
      plan_tier: 'free',
      status: 'inactive',
    });

    fromSpy.mockRestore();
  });

  it('4. Deletes user account via DELETE /api/v1/user/account (Apple App Store Guideline 5.1.1v)', async () => {
    const userId = '22222222-2222-2222-2222-222222222222';

    const getUserSpy = spyOn(supabaseAdmin.auth, 'getUser').mockResolvedValue({
      data: { user: { id: userId } },
      error: null,
    } as any);

    let deletedUserId: string | null = null;
    const deleteUserSpy = spyOn(supabaseAdmin.auth.admin, 'deleteUser').mockImplementation((async (
      id: string
    ) => {
      deletedUserId = id;
      return { data: { user: null }, error: null };
    }) as any);

    // Unauthorized without Bearer header
    const unauthRes = await app.request('/api/v1/user/account', {
      method: 'DELETE',
    });
    expect(unauthRes.status).toBe(401);

    // Authorized deletion
    const res = await app.request('/api/v1/user/account', {
      method: 'DELETE',
      headers: {
        Authorization: 'Bearer valid-user-jwt',
      },
    });

    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.success).toBe(true);
    expect(deletedUserId).toBe(userId);

    getUserSpy.mockRestore();
    deleteUserSpy.mockRestore();
  });
});
