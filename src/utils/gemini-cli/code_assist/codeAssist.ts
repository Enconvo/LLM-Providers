/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { createContentGenerator, DEFAULT_GEMINI_MODEL, type ContentGenerator } from '../core/contentGenerator.js';
import { AuthType, Config, getOauthClient } from './oauth2.js';
import { setupUser } from './setup.js';
import type { HttpOptions } from './server.js';
import { CodeAssistServer } from './server.js';

export async function createCodeAssistContentGenerator(
  httpOptions: HttpOptions,
  authType: AuthType,
  config: Config,
  sessionId?: string,
): Promise<ContentGenerator> {
  if (
    authType === AuthType.LOGIN_WITH_GOOGLE
  ) {
    const authClient = await getOauthClient(AuthType.LOGIN_WITH_GOOGLE);
    const userData = await setupUser(authClient);
    return new CodeAssistServer(
      authClient,
      userData.projectId,
      httpOptions,
      sessionId,
      userData.userTier,
    );
  }

  throw new Error(`Unsupported authType: ${authType}`);
}

export async function getCodeAssistServer(
  config: Config,
): Promise<CodeAssistServer | undefined> {

  const server = await createContentGenerator(config.getContentGeneratorConfig(), config, config.getSessionId());

  if (!(server instanceof CodeAssistServer)) {
    return undefined;
  }
  return server;
}
