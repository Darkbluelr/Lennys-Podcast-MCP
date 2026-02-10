# Lenny's Podcast MCP Server

将 [Lenny's Podcast](https://www.lennyspodcast.com/) 的 303 期转录稿变成 AI 可按需检索的知识库。通过 [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) 协议，让 Claude Code、Codex 等 AI 编程工具在对话中自动引用播客内容。

## 功能

### 基础工具

| 工具 | 说明 |
|------|------|
| `search_transcripts` | **BM25 全文搜索**转录稿，支持 OR/AND 模式，按相关度排序 |
| `get_episode` | 按嘉宾 slug 获取单期节目元数据和转录稿（支持时间范围截取） |
| `list_topics` | 列出全部 87 个话题分类及节目数 |
| `get_topic_episodes` | 获取某话题下所有节目列表 |
| `find_episodes` | 按嘉宾 / 日期 / 关键词多条件筛选 |
| `get_podcast_stats` | 知识库统计概览 |

### 增强工具（v2.0 新增）

| 工具 | 说明 |
|------|------|
| `get_advice` | 描述情境/挑战，获取多位嘉宾的相关建议和观点 |
| `compare_perspectives` | 对比多位嘉宾在同一话题上的不同观点 |
| `get_guest_expertise` | 获取嘉宾专长档案：节目、领域、主题、关键词 |
| `get_episode_insights` | 获取节目洞察：有知识层时返回摘要/观点/框架/金句，否则返回概览 |

### 技术特性

- **BM25 搜索引擎**：替代精确匹配，支持多词查询、字段加权（标题 8x > 嘉宾 6x > 关键词 5x > 描述 3x > 转录稿 1x）
- **知识层（可选）**：通过 AI 提示词生成每期节目的摘要、观点、框架、金句，增强工具输出
- 纯内存索引，启动时构建，无需外部数据库

## 前置条件

- Node.js >= 18

## 安装

```bash
# 1. 克隆本仓库
git clone https://github.com/Darkbluelr/Lennys-Podcast-MCP.git
cd Lennys-Podcast-MCP

# 2. 安装依赖并构建
npm install
npm run build
```

## 生成知识层（可选）

知识层为每期节目预生成摘要、观点、框架、金句等结构化知识，可增强 `get_advice`、`get_episode_insights` 等工具的输出。

**生成方式**：将 `prompts/build-knowledge.md` 的内容发送给已配置本 MCP 的 AI 工具（Claude Code、Codex、Gemini CLI 等），并在末尾附上一组 slug 列表。AI 会自动调用工具读取完整转录稿并生成结构化知识。

- 幂等：已处理的节目自动跳过
- 输出文件：`data/knowledge.json`（本地生成，不提交到仓库）

### 分组列表

303 期节目分为 31 组，每次选择一组发送给 AI 处理：

<details>
<summary>点击展开全部分组</summary>

**第 1 组**: `ada-chen-rekhi`, `adam-fishman`, `adam-grenier`, `adriel-frederick`, `aishwarya-naresh-reganti-kiriti-badam`, `albert-cheng`, `alex-hardimen`, `alex-komoroske`, `alexander-embiricos`, `alisa-cohn`

**第 2 组**: `ami-vora`, `amjad-masad`, `andrew-wilkinson`, `andy-johns`, `andy-raskin`, `andy-raskin_`, `anneka-gupta`, `annie-duke`, `annie-pearl`, `anton-osika`

**第 3 组**: `anuj-rathi`, `aparna-chennapragada`, `april-dunford`, `april-dunford-20`, `archie-abrams`, `arielle-jackson`, `asha-sharma`, `austin-hay`, `ayo-omojola`, `bangaly-kaba`

**第 4 组**: `barbra-gago`, `ben-horowitz`, `ben-williams`, `benjamin-lauzier`, `benjamin-mann`, `bill-carr`, `bob-baxley`, `bob-moesta`, `bob-moesta-20`, `boz`

**第 5 组**: `brandon-chu`, `brendan-foody`, `bret-taylor`, `brian-balfour`, `brian-chesky`, `brian-tolkin`, `cam-adams`, `camille-fournier`, `camille-hearst`, `camille-ricketts`

**第 6 组**: `carilu-dietrich`, `carole-robin`, `casey-winters`, `casey-winters_`, `chandra-janakiraman`, `chip-conley`, `chip-huyen`, `chris-hutchins`, `christian-idiodi`, `christina-wodtke`

**第 7 组**: `christine-itwaru`, `christopher-lochhead`, `christopher-miller`, `claire-butler`, `claire-hughes-johnson`, `claire-vo`, `crystal-w`, `dalton-caldwell`, `dan-hockenmaier`, `dan-shipper`

**第 8 组**: `daniel-lereya`, `david-placek`, `david-singleton`, `deb-liu`, `dhanji-r-prasanna`, `dharmesh-shah`, `dmitry-zlokazov`, `donna-lichaw`, `dr-fei-fei-li`, `drew-houston`

**第 9 组**: `dylan-field`, `dylan-field-20`, `ebi-atawodi`, `edwin-chen`, `eeke-de-milliano`, `elena-verna`, `elena-verna-20`, `elena-verna-30`, `elena-verna-40`, `eli-schwartz`

**第 10 组**: `elizabeth-stone`, `emilie-gerber`, `emily-kramer`, `eoghan-mccabe`, `eoy-review`, `eric-ries`, `eric-simons`, `ethan-evans`, `ethan-evans-20`, `ethan-smith`

**第 11 组**: `evan-lapointe`, `failure`, `fareed-mosavat`, `farhan-thawar`, `fei-fei`, `garrett-lord`, `gaurav-misra`, `geoff-charles`, `geoffrey-moore`, `gergely`

**第 12 组**: `gia-laudi`, `gibson-biddle`, `gina-gotthilf`, `gokul-rajaram`, `graham-weaver`, `grant-lee`, `guillermo-rauch`, `gustaf-alstromer`, `gustav-söderström`, `hamel-husain-shreya-shankar`

**第 13 组**: `hamelshreya`, `hamilton-helmer`, `hari-srinivasan`, `heidi-helfand`, `hila-qu`, `hilary-gridley`, `howie-liu`, `ian-mcallister`, `inbal-s`, `interview-q-compilation`

**第 14 组**: `itamar-gilad`, `ivan-zhao`, `jackie-bavaro`, `jackson-shuttleworth`, `jag-duggal`, `jake-knapp-john-zeratsky`, `jake-knapp-john-zeratsky-20`, `janna-bastow`, `jason-droege`, `jason-feifer`

**第 15 组**: `jason-fried`, `jason-m-lemkin`, `jason-shah`, `jeanne-grosser`, `jeff-weinstein`, `jeffrey-pfeffer`, `jen-abel`, `jen-abel-20`, `jeremy-henrickson`, `jerry-colonna`

**第 16 组**: `jess-lachs`, `jessica-hische`, `jessica-livingston`, `jiaona-zhang`, `joe-hudson`, `john-cutler`, `john-mark-nickels`, `jonathan-becker`, `jonathan-lowenhar`, `jonny-miller`

**第 17 组**: `josh-miller`, `judd-antin`, `jules-walter`, `julia-schottenstein`, `julian-shapiro`, `julie-zhuo`, `julie-zhuo-20`, `karina-nguyen`, `karri-saarinen`, `katie-dill`

**第 18 组**: `kayvon-beykpour`, `keith-coleman-jay-baxter`, `keith-yandell`, `ken-norton`, `kenneth-berger`, `kevin-aluwi`, `kevin-weil`, `kevin-yien`, `kim-scott`, `kristen-berman`

**第 19 组**: `krithika-shankarraman`, `kunal-shah`, `lane-shackleton`, `laura-modi`, `laura-schaffer`, `lauren-ipsen`, `lauryn-isford`, `logan-kilpatrick`, `luc-levesque`, `lulu-cheng-meservey`

**第 20 组**: `madhavan-ramanujam`, `madhavan-ramanujam-20`, `maggie-crowley`, `manik-gupta`, `marc-benioff`, `marily-nika`, `marty-cagan`, `marty-cagan-20`, `matt-abrahams`, `matt-dixon`

**第 21 组**: `matt-lemay`, `matt-macinnis`, `matt-mochary`, `matt-mullenweg`, `matthew-dicks`, `maya-prohovnik`, `mayur-kamat`, `megan-cook`, `melanie-perkins`, `melissa`

**第 22 组**: `melissa-perri`, `melissa-perri-denise-tilles`, `melissa-tan`, `meltem-kuran`, `merci-grace`, `michael-truell`, `mihika-kapoor`, `mike-krieger`, `mike-maples-jr`, `molly-graham`

**第 23 组**: `nabeel-s-qureshi`, `nan-yu`, `nancy-duarte`, `naomi-gleit`, `naomi-ionita`, `nick-turley`, `nickey-skarstad`, `nicole-forsgren`, `nicole-forsgren-20`, `nikhyl-singhal`

**第 24 组**: `nikita-bier`, `nikita-miller`, `nilan-peiris`, `nir-eyal`, `noah-weiss`, `noam-lovinsky`, `oji-udezue`, `paige-costello`, `patrick-campbell`, `paul-adams`

**第 25 组**: `paul-millerd`, `pete-kazanjy`, `peter-deng`, `petra-wille`, `phyl-terry`, `raaz-herzberg`, `rachel-lockett`, `rahul-vohra`, `ramesh-johari`, `ravi-mehta`

**第 26 组**: `ray-cao`, `richard-rumelt`, `robby-stein`, `roger-martin`, `ronny-kohavi`, `ryan-hoover`, `ryan-j-salva`, `ryan-singer`, `sachin-monga`, `sahil-mansuri`

**第 27 组**: `sam-schillace`, `sanchan-saxena`, `sander-schulhoff`, `sander-schulhoff-20`, `sarah-tavel`, `scott-belsky`, `scott-wu`, `sean-ellis`, `seth-godin`, `shaun-clowes`

**第 28 组**: `shishir-mehrotra`, `shreyas-doshi`, `shreyas-doshi-live`, `shweta-shriva`, `sri-batchu`, `sriram-and-aarthi`, `stewart-butterfield`, `tamar-yehoshua`, `tanguy-crusson`, `teaser_2021`

**第 29 组**: `teresa-torres`, `tim-holley`, `timothy-davis`, `tobi-lutke`, `todd-jackson`, `tom-conrad`, `tomer-cohen`, `tomer-cohen-20`, `tristan-de-montebello`, `upasna-gautam`

**第 30 组**: `uri-levine`, `uri-levine-20`, `varun-mohan`, `varun-parmar`, `vijay`, `vikrama-dhiman`, `wes-kao`, `wes-kao-20`, `will-larson`, `yamashata`

**第 31 组**: `yuhki-yamashata`, `yuriy-timen`, `zoelle-egner`

</details>

## 配置

### Claude Code

```bash
# 全局配置（所有项目可用）
claude mcp add lennys-podcast \
  --scope user \
  --transport stdio \
  -- node /你的路径/Lennys-Podcast-MCP/build/index.js
```

或手动编辑 `~/.claude.json`，在 `mcpServers` 中添加：

```json
{
  "lennys-podcast": {
    "command": "node",
    "args": ["/你的路径/Lennys-Podcast-MCP/build/index.js"]
  }
}
```

如果只想在单个项目中使用，在项目根目录创建 `.mcp.json`：

```json
{
  "mcpServers": {
    "lennys-podcast": {
      "command": "node",
      "args": ["/你的路径/Lennys-Podcast-MCP/build/index.js"]
    }
  }
}
```

### Codex

编辑 `~/.codex/config.toml`，在 `[mcp_servers]` 部分添加：

```toml
[mcp_servers.lennys-podcast]
type = "stdio"
command = "node"
args = ["/你的路径/Lennys-Podcast-MCP/build/index.js"]
```

### Claude Desktop

编辑 `~/Library/Application Support/Claude/claude_desktop_config.json`：

```json
{
  "mcpServers": {
    "lennys-podcast": {
      "command": "node",
      "args": ["/你的路径/Lennys-Podcast-MCP/build/index.js"]
    }
  }
}
```

### Gemini CLI

编辑 `~/.gemini/settings.json`，添加 `mcpServers` 字段：

```json
{
  "mcpServers": {
    "lennys-podcast": {
      "command": "node",
      "args": ["/你的路径/Lennys-Podcast-MCP/build/index.js"]
    }
  }
}
```

> 所有配置中的 `/你的路径/` 替换为实际的绝对路径。不再需要设置 `LENNYS_REPO_ROOT` 环境变量。

## 项目结构

```
├── episodes/           # 303 期转录稿（YAML frontmatter + 对话内容）
│   └── {guest-name}/
│       └── transcript.md
├── index/              # 87 个话题索引
│   └── {topic}.md
├── src/                # MCP Server 源码
│   ├── index.ts        # 入口 + 10 个工具注册
│   ├── bm25.ts         # BM25 搜索引擎
│   ├── data.ts         # 数据加载 + 知识层
│   ├── search.ts       # 片段提取
│   ├── advice.ts       # get_advice 逻辑
│   ├── perspectives.ts # compare_perspectives 逻辑
│   ├── insights.ts     # guest_expertise + episode_insights 逻辑
│   ├── knowledge-types.ts # 知识层类型
│   └── types.ts        # 核心类型
├── prompts/
│   └── build-knowledge.md  # 知识层生成提示词
└── data/
    └── knowledge.json  # AI 生成的知识（可选，本地生成）
```

## 使用示例

配置完成后重启 AI 工具，即可在对话中自然使用：

- "Lenny's Podcast 里有谁讨论过 product market fit？"
- "我正在寻找产品市场契合度，有什么建议？"（触发 `get_advice`）
- "对比不同嘉宾对 hiring 的看法"（触发 `compare_perspectives`）
- "Brian Chesky 的专长领域是什么？"（触发 `get_guest_expertise`）
- "总结一下 shreyas-doshi 那期节目的核心观点"（触发 `get_episode_insights`）

AI 会自动调用对应工具检索转录稿并引用原文回答。

## 开发

```bash
# 监听文件变化自动重新编译
npm run dev

# 手动构建
npm run build

# 启动（通常由 AI 工具自动启动，无需手动运行）
npm start
```

## 数据来源

转录稿数据来自 [chatprd/lennys-podcast-transcripts](https://github.com/chatprd/lennys-podcast-transcripts)。

## 技术栈

- TypeScript + Node.js
- [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk) — MCP 协议实现
- [gray-matter](https://github.com/jonschlinkert/gray-matter) — YAML frontmatter 解析
- BM25 搜索引擎（自行实现，零外部依赖）
- 纯内存索引，无需外部数据库

## 许可证

MIT
