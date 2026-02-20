import type { ServerPlugin } from "../types.js";
import { overviewPlugin } from "./overview/index.js";
import { calendarPlugin } from "./calendar/index.js";
import { memoryPlugin } from "./memory/index.js";
import { tasksPlugin } from "./tasks/index.js";
import { skillsPlugin } from "./skills/index.js";
import { activityPlugin } from "./activity/index.js";
import { statsPlugin } from "./stats/index.js";

export const plugins: ServerPlugin[] = [
  overviewPlugin,
  calendarPlugin,
  memoryPlugin,
  tasksPlugin,
  skillsPlugin,
  activityPlugin,
  statsPlugin
];
