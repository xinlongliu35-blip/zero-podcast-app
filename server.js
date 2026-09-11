import express from 'express';
import cors from 'cors';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { execFile } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

const DEEPSEEK_API_KEY = 'sk-e3028fcd0f8c4aeb99ce151a65b31df4';
const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';

// 需要走「下载音频 → Whisper 转写」的平台
const VIDEO_PLATFORMS = ['douyin', 'bilibili'];

// 提示词模式模板：每种模式对应一段追加到系统规则后的指令
const PROMPT_MODES = {
  default: {
    label: '真实还原',
    desc: '严格还原原始内容，不添加主观评价',
    extra: ''
  },
  critical: {
    label: '批判性思维',
    desc: '在还原内容后，加入对观点的客观质疑与不同角度的思考',
    extra: `
【附加要求 - 批判性思维】
在完整复述内容之后，增加一个[批判性思考]环节：
- 对内容中的核心观点提出 2-3 个合理的质疑或不同视角
- 指出内容中可能存在的逻辑漏洞、信息盲点或立场偏差
- 给出你认为值得进一步思考的问题
注意：批判必须基于内容本身，不得脱离原始素材胡编。`
  },
  deep: {
    label: '深度分析',
    desc: '深入挖掘内容背后的底层逻辑、本质原因和延伸思考',
    extra: `
【附加要求 - 深度分析】
在完整复述内容之后，增加一个[深度洞察]环节：
- 提炼内容背后的底层逻辑或本质规律
- 分析内容产生的背景原因和深层动机
- 给出对现实生活的延伸思考和可落地的启发
注意：深度分析必须基于原始内容，不得脱离素材凭空发挥。`
  },
  custom: {
    label: '自定义',
    desc: '使用你自己定义的附加要求',
    extra: '' // 由用户的 customPrompt 填充
  }
};

/**
 * 构建 AI 分析用的完整 prompt
 * @param {object} pageData - { platform, title, bodyText }
 * @param {string} remark - 用户备注
 * @param {string} promptMode - 提示词模式
 * @param {string} customPrompt - 用户自定义追加内容
 */
function buildPrompt(pageData, remark, promptMode = 'default', customPrompt = '') {
  const mode = PROMPT_MODES[promptMode] || PROMPT_MODES.default;
  const extraRules = mode.extra || '';
  const userExtra = (promptMode === 'custom' && customPrompt) ? `\n【用户自定义附加要求】\n${customPrompt}` : '';

  return `
你是一个极简风格的播客制作专家，你的任务是对用户提供的视频内容进行【100% 真实且完整的还原性复述】。

【抓取到的原始素材】
平台: ${pageData.platform}
标题: ${pageData.title}
内容描述: ${pageData.bodyText || '未抓取到有效文本'}
用户补充备注: ${remark || '无'}

【制作规则 - 严禁虚假内容/杜撰】
1. **绝对真实**：你必须严格遵循视频中的原始内容，**严禁任何形式的自我发挥、虚构背景、添加未提及的观点或胡编乱造**。你的复述必须能够通过原视频的事实校验。
2. **拒绝幻觉**：如果抓取到的内容描述不全，请仅基于现有标题和描述进行概括。宁可内容简短，也绝不杜撰细节。
3. **第一人称还原**：以播客主持人"我"的身份，用自然、流畅的口语化中文进行讲述。
4. **结构化还原**：
   - [开场]：点题，说明视频来源及核心议题。
   - [内容复述]：将视频中的核心事实、逻辑观点、真实数据完整还原。
   - [真实摘要]：提炼视频中最核心的 3 个真实要点。
5. **音文配套**：划分为 10-15 个语义完整的段落，为每个段落分配开始时间（MM:SS），确保文案与时间戳完全对应。
6. **识别清晰**：确保生成的标题和摘要能够清晰识别视频的原始意图。
${extraRules}${userExtra}

请严格返回以下 JSON 格式（不要包含任何 markdown 代码块标记）：
{
  "title": "${pageData.title} (内容真实还原)",
  "summary": "基于${pageData.platform}原始内容的播客复述",
  "fullContent": "完整文稿...",
  "points": [
    {
      "id": 1,
      "time": "00:00",
      "title": "要点标题",
      "content": "对应段落的详细复述内容..."
    }
  ]
}`;
}

/**
 * 调用 DeepSeek 进行 AI 分析，返回解析后的 JSON
 */
async function callDeepSeek(pageData, remark, apiKey, promptMode, customPrompt) {
  const finalKey = apiKey || DEEPSEEK_API_KEY;
  const prompt = buildPrompt(pageData, remark, promptMode, customPrompt);

  const aiResponse = await axios.post(DEEPSEEK_URL, {
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: '你是一个擅长将碎片化内容转化为高质量播客文稿的专家。必须严格返回 JSON 格式，不要包含任何 markdown 代码块标记。' },
      { role: 'user', content: prompt }
    ],
    response_format: { type: 'json_object' }
  }, {
    headers: {
      'Authorization': `Bearer ${finalKey}`,
      'Content-Type': 'application/json'
    }
  });

  let content = aiResponse.data.choices[0].message.content;
  content = content.replace(/```json\n?/, '').replace(/\n?```/, '').trim();
  return JSON.parse(content);
}

/**
 * 规范化视频链接，把各种分享/精选页面 URL 转成 yt-dlp 支持的标准格式
 * 抖音支持：/video/{id}, /note/{id}, ?modal_id={id}, /discover?modal_id=, /user/xx?modal_id=
 */
function normalizeVideoUrl(url, platform) {
  if (platform === 'douyin') {
    // 优先从查询参数 modal_id 提取（精选页面、用户主页分享）
    const modalMatch = url.match(/[?&]modal_id=(\d{15,25})/);
    if (modalMatch) {
      return `https://www.douyin.com/video/${modalMatch[1]}`;
    }
    // 从 /video/{id} 或 /note/{id} 提取
    const pathMatch = url.match(/\/(?:video|note)\/(\d{15,25})/);
    if (pathMatch) {
      return `https://www.douyin.com/video/${pathMatch[1]}`;
    }
    // 短链 v.douyin.com/xxx 保持原样，yt-dlp 会跟随重定向
    if (url.includes('v.douyin.com')) {
      return url;
    }
    // iesdouyin 域名转成主域名
    if (url.includes('iesdouyin.com')) {
      return url.replace('iesdouyin.com', 'douyin.com');
    }
  }
  if (platform === 'bilibili') {
    // b23.tv 短链保持原样，yt-dlp 会跟随重定向
    return url;
  }
  return url;
}

/**
 * 调用 Python 脚本下载视频音频并转写为文字
 * 返回 { title, transcript, duration } 或抛出错误
 */
function extractVideoTranscript(url, platform) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, 'extract_audio.py');
    console.log(`[Server] 调用 Python 转写脚本，平台=${platform}`);

    const child = execFile(
      'python',
      [scriptPath, '--url', url, '--model', 'small'],
      { maxBuffer: 10 * 1024 * 1024 }, // 允许较大输出
      (error, stdout, stderr) => {
        if (stderr) {
          // 转发 Python 的阶段日志到 Node 控制台
          console.log(`[Python] ${stderr.trim()}`);
        }
        if (error) {
          try {
            const err = JSON.parse(stdout);
            return reject(new Error(err.error || error.message));
          } catch {
            return reject(new Error(`转写脚本执行失败: ${error.message}`));
          }
        }
        try {
          const result = JSON.parse(stdout);
          if (result.error) return reject(new Error(result.error));
          resolve(result);
        } catch (e) {
          reject(new Error(`转写结果解析失败: ${e.message}`));
        }
      }
    );
  });
}

app.post('/api/analyze', async (req, res) => {
  let { url, remark, apiKey, mode, promptMode, customPrompt } = req.body;
  promptMode = promptMode || 'default';

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  // Use provided key or default
  const finalKey = apiKey || DEEPSEEK_API_KEY;

  // 改进的 URL 提取与解析逻辑
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const matches = url.match(urlRegex);
  if (matches && matches.length > 0) {
    url = matches[0];
  }

  try {
    console.log(`[Server] Analyzing URL: ${url} (Mode: ${mode || 'concise'})`);
    
    // 1. Resolve Redirects with better headers
    let finalUrl = url;
    const mobileHeaders = {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1'
    };

    try {
      console.log(`[Server] Resolving redirect for: ${url}`);
      const headRes = await axios.get(url, { 
        maxRedirects: 10,
        headers: mobileHeaders,
        timeout: 10000,
        validateStatus: (status) => status >= 200 && status < 400
      });
      finalUrl = headRes.request.res.responseUrl || url;
      console.log(`[Server] Resolved to: ${finalUrl}`);
    } catch (e) {
      console.warn(`[Server] Redirect resolution failed: ${e.message}`);
    }

    // 2. Platform detection
    let platform = 'generic';
    if (finalUrl.includes('douyin.com') || finalUrl.includes('v.douyin.com')) platform = 'douyin';
    else if (finalUrl.includes('bilibili.com') || finalUrl.includes('b23.tv')) platform = 'bilibili';
    else if (finalUrl.includes('xiaohongshu.com') || finalUrl.includes('xhslink')) platform = 'xiaohongshu';
    else if (finalUrl.includes('mp.weixin.qq.com')) platform = 'wechat';

    let pageData = { title: '', bodyText: '', image: '', platform };

    // 3. 抖音/B站：下载音频 + Whisper 转写
    if (VIDEO_PLATFORMS.includes(platform)) {
      // 规范化链接（抖音精选页 modal_id 等格式 → 标准视频链接）
      const normalizedUrl = normalizeVideoUrl(finalUrl, platform);
      if (normalizedUrl !== finalUrl) {
        console.log(`[Server] 链接规范化: ${finalUrl} → ${normalizedUrl}`);
      }
      console.log(`[Server] 视频平台（${platform}），走音频转写链路`);
      try {
        const result = await extractVideoTranscript(normalizedUrl, platform);
        pageData.title = result.title || (platform === 'douyin' ? '抖音视频' : 'B站视频');
        pageData.bodyText = result.transcript || '';
        // 视频时长（秒）转成 MM:SS 给前端展示
        if (result.duration) {
          const m = Math.floor(result.duration / 60);
          const s = Math.floor(result.duration % 60);
          pageData.duration = `${m}:${s.toString().padStart(2, '0')}`;
        }
        console.log(`[Server] 转写成功. Title: ${pageData.title.substring(0, 20)}... Transcript length: ${pageData.bodyText.length}`);
      } catch (transErr) {
        console.error(`[Server] 音频转写失败: ${transErr.message}`);
        // 转写失败则回退到 HTML 抓取（可能拿到标题）
        pageData.title = '视频解析失败';
        pageData.bodyText = `视频内容转写失败：${transErr.message}`;
      }
    } else {
      // 其他平台：走原有 HTML 抓取逻辑
      try {
        const response = await axios.get(finalUrl, {
          headers: {
            ...mobileHeaders,
            'Referer': finalUrl.includes('xiaohongshu.com') ? 'https://www.xiaohongshu.com/' : 'https://www.google.com/'
          },
          timeout: 15000
        });
        
        const html = response.data;
        const $ = cheerio.load(html);
        
        // Advanced Meta Extraction
        pageData.title = $('meta[property="og:title"]').attr('content') || 
                         $('meta[name="twitter:title"]').attr('content') || 
                         $('title').text().trim();
        
        pageData.bodyText = $('meta[property="og:description"]').attr('content') || 
                            $('meta[name="description"]').attr('content') || 
                            $('meta[name="twitter:description"]').attr('content') || '';
        
        pageData.image = $('meta[property="og:image"]').attr('content') || 
                         $('meta[name="twitter:image"]').attr('content') || '';

        // If we got almost nothing, try body text with better selector
        if (pageData.bodyText.length < 30) {
          $('script, style, nav, footer, header').remove();
          const mainText = $('article').text().trim() || 
                          $('.content').text().trim() || 
                          $('#content').text().trim() || 
                          $('main').text().trim() || 
                          $('body').text().substring(0, 5000).replace(/\s+/g, ' ').trim();
          pageData.bodyText = (pageData.bodyText + ' ' + mainText).trim();
        }

        console.log(`[Server] Scrape success. Title: ${pageData.title.substring(0, 20)}... Content length: ${pageData.bodyText.length}`);

      } catch (scrapeErr) {
        console.error(`[Server] Scrape error: ${scrapeErr.message}`);
        pageData.title = '解析失败的链接';
        pageData.bodyText = '抓取失败';
      }
    }

    // 3. AI Analysis
    const result = await callDeepSeek(pageData, remark, apiKey, promptMode, customPrompt);

    // 平台来源名称
    const sourceMap = {
      douyin: '抖音',
      bilibili: '哔哩哔哩',
      xiaohongshu: '小红书',
      wechat: '微信公众号',
      generic: '网页'
    };

    res.json({
      ...result,
      platform: pageData.platform,
      source: sourceMap[pageData.platform] || '网页',
      duration: pageData.duration || result.duration || '15:00',
      cover: pageData.image || `https://core-normal.traeapi.us/api/ide/v1/text_to_image?prompt=${encodeURIComponent('minimalist podcast ' + result.title)}&image_size=square`,
      url: url,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error('[Server] API Error:', err.message);
    res.status(500).json({ error: 'AI 分析失败，请检查 API Key 或重试' });
  }
});

/**
 * 直接从文本生成播客（用户粘贴文本）
 */
app.post('/api/analyze-text', async (req, res) => {
  let { text, title, remark, apiKey, promptMode, customPrompt } = req.body;
  promptMode = promptMode || 'default';

  if (!text || text.trim().length < 10) {
    return res.status(400).json({ error: '请输入至少 10 个字符的文本内容' });
  }

  try {
    const pageData = {
      platform: 'text',
      title: title || text.slice(0, 30),
      bodyText: text
    };

    const result = await callDeepSeek(pageData, remark, apiKey, promptMode, customPrompt);

    res.json({
      ...result,
      platform: 'text',
      source: '文本导入',
      duration: result.duration || '15:00',
      cover: `https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=${encodeURIComponent('minimalist podcast ' + result.title)}&image_size=square`,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('[Server] Text analyze error:', err.message);
    res.status(500).json({ error: 'AI 分析失败，请检查 API Key 或重试' });
  }
});

/**
 * 返回内置的提示词模板列表，供前端展示和选择
 */
app.get('/api/prompt-templates', (req, res) => {
  const templates = Object.entries(PROMPT_MODES).map(([key, val]) => ({
    id: key,
    label: val.label,
    desc: val.desc
  }));
  res.json({ templates });
});

app.listen(port, () => {
  console.log(`[Server] Backend running at http://localhost:${port}`);
});
