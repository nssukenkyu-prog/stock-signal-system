// =====================================================
// Stock Signal Bot - Main Entry Point
// =====================================================

import type { Env } from './types';
import { handleCronTrigger, runInitializationJob, resetEmergencyStop } from './workers/scheduler';
import { sendTestNotification } from './workers/notifier';

export default {
    // =====================================================
    // Scheduled Handler (Cron Triggers)
    // =====================================================
    async scheduled(
        controller: ScheduledController,
        env: Env,
        ctx: ExecutionContext
    ): Promise<void> {
        await handleCronTrigger(controller.cron, env, ctx);
    },

    // =====================================================
    // HTTP Handler (Manual Operations & Testing)
    // =====================================================
    async fetch(
        request: Request,
        env: Env,
        ctx: ExecutionContext
    ): Promise<Response> {
        const url = new URL(request.url);
        const path = url.pathname;

        // CORS headers for testing
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        };

        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }

        try {
            switch (path) {
                // Health check
                case '/':
                case '/health':
                    return Response.json({
                        status: 'ok',
                        timestamp: new Date().toISOString(),
                        environment: env.ENVIRONMENT,
                    }, { headers: corsHeaders });

                // Test LINE notification
                case '/test/notify':
                    if (request.method !== 'POST') {
                        return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders });
                    }
                    const success = await sendTestNotification(env);
                    return Response.json({
                        success,
                        message: success ? 'Test notification sent' : 'Failed to send notification'
                    }, { headers: corsHeaders });

                // Initialize historical data
                case '/admin/initialize':
                    if (request.method !== 'POST') {
                        return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders });
                    }
                    ctx.waitUntil(runInitializationJob(env));
                    return Response.json({
                        message: 'Initialization job started'
                    }, { headers: corsHeaders });

                // Reset emergency stop
                case '/admin/reset-stop':
                    if (request.method !== 'POST') {
                        return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders });
                    }
                    await resetEmergencyStop(env);
                    return Response.json({
                        message: 'Emergency stop reset'
                    }, { headers: corsHeaders });

                // Manual trigger for testing
                case '/admin/trigger':
                    if (request.method !== 'POST') {
                        return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders });
                    }
                    ctx.waitUntil(handleCronTrigger('manual', env, ctx));
                    return Response.json({
                        message: 'Manual trigger started'
                    }, { headers: corsHeaders });

                default:
                    return Response.json({ error: 'Not found' }, { status: 404, headers: corsHeaders });
            }
        } catch (error) {
            console.error('Request error:', error);
            return Response.json({
                error: 'Internal server error',
                message: (error as Error).message,
            }, { status: 500, headers: corsHeaders });
        }
    },
};
