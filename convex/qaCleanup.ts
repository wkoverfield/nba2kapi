/**
 * QA teardown helpers. Internal only: never reachable from the REST API.
 *
 *   npx convex run qaCleanup:purgeQaApiKeys
 *
 * Deletes every apiKeys row whose name starts with "[QA-TEST]" together with
 * its requestLogs rows, so throwaway keys registered during endpoint QA leave
 * nothing behind on the deployment.
 */

import { internalMutation } from "./_generated/server";

export const QA_KEY_PREFIX = "[QA-TEST]";

export const purgeQaApiKeys = internalMutation({
  args: {},
  handler: async (ctx) => {
    const keys = await ctx.db.query("apiKeys").collect();
    const qaKeys = keys.filter((k) => k.name.startsWith(QA_KEY_PREFIX));

    let logsDeleted = 0;
    for (const key of qaKeys) {
      const logs = await ctx.db
        .query("requestLogs")
        .withIndex("by_apiKeyId", (q) => q.eq("apiKeyId", key._id))
        .collect();
      for (const log of logs) {
        await ctx.db.delete(log._id);
        logsDeleted++;
      }
      await ctx.db.delete(key._id);
    }

    console.log(
      `purgeQaApiKeys: deleted ${qaKeys.length} ${QA_KEY_PREFIX} key(s) and ${logsDeleted} request log(s)`
    );
    return { keysDeleted: qaKeys.length, logsDeleted };
  },
});
