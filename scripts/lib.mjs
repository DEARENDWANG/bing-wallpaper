// 共享工具：必应官方接口抓取、记录规范化、JSON 读写、北京时间、git 提交。
// 仅使用必应官方接口，禁止任何第三方镜像。
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

export const REPO_ROOT = process.env.GITHUB_WORKSPACE || process.cwd();

export const BING_API =
  'https://cn.bing.com/HPImageArchive.aspx?format=js&idx=0&n=1&pid=opal&mbl=1&desc=1&mkt=zh-cn';

// 移动端 UA：不带则接口不返回 desc 字段。
export const MOBILE_UA =
  'Mozilla/5.0 (Linux; Android 16; PJZ110 Build/BP2A.250605.015; ) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/138.0.7204.179 Mobile Safari/537.36 BingSapphire/32.6.2110003561';

// 每条记录仅允许的 7 个字段，顺序固定。
export const FIELDS = [
  'title',
  'caption',
  'subtitle',
  'copyright',
  'description',
  'date',
  'bing_url',
];

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 北京时间（UTC+8，无夏令时）。
export function beijingNow() {
  const bj = new Date(Date.now() + 8 * 3600 * 1000);
  return {
    date: bj.toISOString().slice(0, 10),
    hour: bj.getUTCHours(),
    year: bj.toISOString().slice(0, 4),
  };
}

// 本次 cron 所属窗口：0=00:02, 1=06:00, 2=12:00, 3=15:00。
export function windowOfHour(hour) {
  if (hour < 6) return 0;
  if (hour < 12) return 1;
  if (hour < 15) return 2;
  return 3;
}

export function isValidDate(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

// 将任意来源记录裁剪为固定 7 字段（丢弃 url 及其它多余字段），保持字段顺序。
export function normalizeRecord(raw) {
  const rec = {};
  for (const k of FIELDS) rec[k] = raw[k] ?? '';
  return rec;
}

// 由必应接口 images[0] 构造记录。
export function recordFromImage(img) {
  const enddate = String(img.enddate || '');
  if (!/^\d{8}$/.test(enddate)) {
    throw new Error(`enddate 非法: ${enddate}`);
  }
  const date = `${enddate.slice(0, 4)}-${enddate.slice(4, 6)}-${enddate.slice(6, 8)}`;

  const title = img.title || '';
  const rawCopyright = img.copyright || '';
  const m = /^(.*?)\s*\(([^)]+)\)$/.exec(rawCopyright);
  let subtitle = '';
  let copyright = rawCopyright;
  if (m) {
    subtitle = m[1].trim();
    let credit = m[2].trim();
    if (!credit.startsWith('©')) credit = `© ${credit}`;
    copyright = credit;
  }

  const description = [img.desc, img.desc2, img.desc3]
    .filter((s) => typeof s === 'string' && s.trim() !== '')
    .join('\n\n');

  const urlbase = img.urlbase;
  if (!urlbase) throw new Error('缺少 urlbase');
  const bing_url = `https://cn.bing.com${urlbase}_UHD.jpg`;

  return normalizeRecord({
    title,
    caption: title,
    subtitle,
    copyright,
    description,
    date,
    bing_url,
  });
}

// 抓取必应官方接口并返回当天记录；任何异常均抛出由上层重试。
export async function fetchBingRecord() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  let res;
  try {
    res = await fetch(BING_API, {
      headers: {
        'User-Agent': MOBILE_UA,
        Accept: 'application/json',
        'Accept-Language': 'zh-CN,zh;q=0.9',
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  if (res.status !== 200) throw new Error(`HTTP 非 200: ${res.status}`);
  const data = await res.json();
  const images = data && data.images;
  if (!Array.isArray(images) || images.length === 0) {
    throw new Error('images 为空');
  }
  return recordFromImage(images[0]);
}

// JSON 序列化：2 空格缩进、中文不转义、斜杠不转义（JS 默认即不转义二者）。
export function toJson(value) {
  return JSON.stringify(value, null, 2) + '\n';
}

export function readJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, toJson(value), 'utf8');
}

export const yearPath = (year) => join(REPO_ROOT, 'CN', `year_${year}.json`);
export const dailyPath = () => join(REPO_ROOT, 'CN', 'daily.json');
export const statePath = () => join(REPO_ROOT, '.state', 'update-state.json');

// 按 date 升序合并去重（incoming 覆盖同 date 的 existing）。
export function mergeByDate(existing, incoming) {
  const map = new Map();
  for (const r of existing) if (isValidDate(r.date)) map.set(r.date, r);
  for (const r of incoming) if (isValidDate(r.date)) map.set(r.date, r);
  return [...map.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

function git(args) {
  return execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8' });
}

// 配置提交身份并仅在存在暂存变更时 commit + push，避免空 commit。
export function commitAndPush(paths, message) {
  git(['config', 'user.name', 'github-actions[bot]']);
  git(['config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com']);
  git(['add', '--', ...paths]);
  // 无暂存变更则跳过。
  try {
    execFileSync('git', ['diff', '--cached', '--quiet'], { cwd: REPO_ROOT });
    console.log('无文件变更，跳过 commit。');
    return false;
  } catch {
    // 有变更，继续提交。
  }
  git(['commit', '-m', message]);
  git(['push']);
  console.log(`已提交并推送：${message}`);
  return true;
}