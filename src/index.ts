
// =====================================================
// Stock Signal Bot - Main Entry Point
// =====================================================

import type { Env } from './types';
import { handleCronTrigger, runInitializationJob, resetEmergencyStop } from './workers/scheduler';
import { sendTestNotification } from './workers/notifier';

export default {
    async scheduled(
        controller: ScheduledController,
        env: Env,
        ctx: ExecutionContext
    ): Promise<void> {
        await handleCronTrigger(controller.cron, env, ctx);
    },

    async fetch(
        request: Request,
        env: Env,
        ctx: ExecutionContext
    ): Promise<Response> {
        const url = new URL(request.url);
        if (url.pathname === '/health') return Response.json({ status: 'ok' });

        return Response.json({ message: 'Stock Signal Bot v1.0' });
    },
};
