// 每日更新：窗口制重试调度。
// 窗口（北京时间）：00:02 / 06:00 / 12:00 / 15:00，每窗口最多 3 次、间隔 10 分钟。
// 通过 .state/update-state.json 跨 cron 运行推进 stage，避免单 job 长睡跨窗口。
import {
  beijingNow,
  windowOfHour,
  fetchBingRecord,
  readJson,
  writeJson,
  yearPath,
  dailyPath,
  statePath,
  mergeByDate,
  commitAndPush,
  sleep,
} from './lib.mjs';

const ATTEMPTS = 3;
const INTERVAL_MS = Number(process.env.UPDATE_INTERVAL_MS || 10 * 60 * 1000);

function loadState(today) {
  const s = readJson(statePath(), { date: '', stage: 0, done: false });
  if (s.date !== today) return { date: today, stage: 0, done: false };
  return { date: s.date, stage: s.stage ?? 0, done: Boolean(s.done) };
}

// 写入当年文件（同 date 已存在则跳过追加）与 daily.json（始终整体覆盖）。
function persistRecord(rec) {
  const year = rec.date.slice(0, 4);
  const existing = readJson(yearPath(year), []);
  const already = existing.some((r) => r.date === rec.date);
  const merged = already ? existing : mergeByDate(existing, [rec]);
  writeJson(yearPath(year), merged);
  writeJson(dailyPath(), rec);
  return already;
}

async function main() {
  const { date: today, hour } = beijingNow();
  const w = windowOfHour(hour);
  const state = loadState(today);

  console.log(`北京时间 ${today} ${String(hour).padStart(2, '0')} 时，本次窗口 w=${w}，状态 stage=${state.stage} done=${state.done}`);

  if (state.done || state.stage > w) {
    console.log('当天已完成或已推进到更晚窗口，直接退出。');
    process.exit(0);
  }

  const runStage = state.stage;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      const rec = await fetchBingRecord();
      const already = persistRecord(rec);
      state.done = true;
      writeJson(statePath(), state);
      console.log(`第 ${attempt} 次尝试成功，date=${rec.date}${already ? '（当年已存在，跳过追加，仍刷新 daily）' : ''}`);
      commitAndPush(['CN', '.state'], `chore: 更新 ${rec.date} 必应每日一图`);
      process.exit(0);
    } catch (err) {
      console.error(`窗口 ${runStage} 第 ${attempt}/${ATTEMPTS} 次尝试失败：${err.message}`);
      if (attempt < ATTEMPTS) {
        console.log(`等待 ${INTERVAL_MS / 60000} 分钟后重试……`);
        await sleep(INTERVAL_MS);
      }
    }
  }

  // 本窗口 3 次全失败：推进 stage，commit 状态，退出非 0 标红。
  state.stage += 1;
  writeJson(statePath(), state);
  const abandoned = state.stage >= 4;
  console.error(`窗口 ${runStage} 三次均失败，stage 推进到 ${state.stage}${abandoned ? '（当天放弃，等次日 00:02 重置）' : ''}`);
  commitAndPush(['.state'], `chore: ${today} 窗口 ${runStage} 失败，stage=${state.stage}`);
  process.exit(1);
}

main().catch((err) => {
  console.error('未预期错误：', err);
  process.exit(1);
});