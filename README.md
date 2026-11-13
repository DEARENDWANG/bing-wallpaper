# Bing 每日一图数据（CN）

![AI Generated](https://img.shields.io/badge/AI-Generated-blue)

每天自动抓取 **必应官方** 每日一图（仅 CN）。

- 数据源：仅必应官方接口 `cn.bing.com/HPImageArchive.aspx`。

## 接口地址

年份数据（`{year}` 替换为年份，如 `2026`）：

```
https://dearendwang.github.io/bing-wallpaper/CN/year_{year}.json
```

当天单条数据：

```
https://dearendwang.github.io/bing-wallpaper/CN/daily.json
```

备选镜像（任选其一）：

```
https://cdn.jsdelivr.net/gh/DEARENDWANG/bing-wallpaper@main/CN/year_{year}.json
https://raw.githubusercontent.com/DEARENDWANG/bing-wallpaper/main/CN/year_{year}.json
```

## 数据格式

每条记录固定 7 个字段，顺序如下：

| 字段 | 含义 |
| --- | --- |
| `title` | 标题 |
| `caption` | 标题（与 `title` 相同） |
| `subtitle` | 副标题（地点） |
| `copyright` | 版权（含 © 前缀） |
| `description` | 描述（多段以 `\n\n` 连接） |
| `date` | 日期，`YYYY-MM-DD` |
| `bing_url` | 必应官方 UHD 图片地址 |

示例（`daily.json` 即单条此结构）：

```json
{
  "title": "冰下秘境",
  "caption": "冰下秘境",
  "subtitle": "亚伯拉罕湖，艾伯塔省，加拿大",
  "copyright": "© Guang Cao/Getty Images",
  "description": "黎明的第一缕曙光映照在亚伯拉罕湖冰封的湖面上……",
  "date": "2026-11-13",
  "bing_url": "https://cn.bing.com/th?id=OHR.AbrahamCanada_ZH-CN0344365912_UHD.jpg"
}
```

`CN/year_XXXX.json` 为上述记录的数组，按 `date` 升序排列。

## 每日自动更新

每天按北京时间 **00:02 / 06:00 / 12:00 / 15:00** 四个窗口自动抓取：

- 每个窗口最多尝试 3 次（间隔 10 分钟），成功即写入当天数据并结束当天任务。
- 某窗口失败则顺延到下一窗口；四个窗口均失败则放弃当天，次日重新开始。
- 当天已成功抓取后，其余定时触发不再重复抓取；数据按日期去重，不会产生重复记录。

## 维护说明

- GitHub 定时可能延迟几分钟触发。
- 仓库 60 天无活动会暂停定时，到 Actions 手动运行一次即可恢复。

## 版权说明

本项目仅用于个人学习、研究与壁纸设置等非商业目的。

- 所有图片版权归原作者或微软（Microsoft）所有；使用本项目或其图片时，请遵守微软相关服务条款与版权声明。
- 本项目不对图片版权承担法律责任；因违规使用图片引发的纠纷，由使用者自行承担。
