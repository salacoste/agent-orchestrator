#!/usr/bin/env node

import { Command } from "commander";
import { registerInit } from "./commands/init.js";
import { registerStatus } from "./commands/status.js";
import { registerSpawn, registerBatchSpawn } from "./commands/spawn.js";
import { registerSession } from "./commands/session.js";
import { registerSend } from "./commands/send.js";
import { registerReviewCheck } from "./commands/review-check.js";
import { registerDashboard } from "./commands/dashboard.js";
import { registerOpen } from "./commands/open.js";
import { registerStories } from "./commands/stories.js";
import { registerSprint } from "./commands/sprint.js";
import { registerEpic } from "./commands/epic.js";
import { registerMetrics } from "./commands/metrics.js";
import { registerHealth } from "./commands/health.js";
import { registerRetro } from "./commands/retro.js";
import { registerStory } from "./commands/story.js";
import { registerStart, registerStop } from "./commands/start.js";
import { registerCreate } from "./commands/create.js";
import { registerSprintConfig } from "./commands/sprint-config.js";

const program = new Command();

program
  .name("ao")
  .description("Agent Orchestrator — manage parallel AI coding agents")
  .version("0.1.0");

registerInit(program);
registerStart(program);
registerStop(program);
registerStatus(program);
registerSpawn(program);
registerBatchSpawn(program);
registerSession(program);
registerSend(program);
registerReviewCheck(program);
registerDashboard(program);
registerOpen(program);
registerStories(program);
registerSprint(program);
registerEpic(program);
registerMetrics(program);
registerHealth(program);
registerRetro(program);
registerStory(program);
registerCreate(program);
registerSprintConfig(program);

program.parse();
