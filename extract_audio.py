#!/usr/bin/env python3
"""
视频音频提取与语音转写脚本
功能：用 yt-dlp 下载视频音频，用 faster-whisper 转写为中文文本
用法：python extract_audio.py --url <视频链接> [--model small|medium|large-v3]
输出：stdout 输出 JSON {"title": "...", "transcript": "...", "duration": 秒数}
      stderr 输出阶段日志（downloading / transcribing）
"""

import argparse
import json
import os
import sys
import tempfile
import uuid

# 全局模型缓存（惰性加载，避免每次请求都加载）
_whisper_model = None
_whisper_model_name = None


def log(msg: str):
    """日志输出到 stderr，避免污染 stdout 的 JSON"""
    print(f"[extract_audio] {msg}", file=sys.stderr, flush=True)


def get_whisper_model(model_name: str):
    """惰性加载 Whisper 模型，单例缓存"""
    global _whisper_model, _whisper_model_name
    if _whisper_model is not None and _whisper_model_name == model_name:
        return _whisper_model
    log(f"加载 Whisper 模型: {model_name}（首次加载较慢，请耐心等待）")
    # 使用国内 HuggingFace 镜像，避免下载超时
    os.environ.setdefault("HF_ENDPOINT", "https://hf-mirror.com")
    # 禁用 xet 协议（镜像不支持）和 symlink 警告
    os.environ.setdefault("HF_HUB_DISABLE_XET", "1")
    os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")
    from faster_whisper import WhisperModel
    # CPU 模式，int8 量化，内存占用小；有 GPU 可改为 device="cuda", compute_type="float16"
    _whisper_model = WhisperModel(model_name, device="cpu", compute_type="int8")
    _whisper_model_name = model_name
    log("Whisper 模型加载完成")
    return _whisper_model


def _get_douyin_cookies_via_requests(output_dir: str, prefix: str) -> str:
    """
    备用方案：用 requests 访问抖音首页，从 Set-Cookie 中提取 ttwid。
    不需要浏览器，速度快，但可能被抖音反爬拦截。
    """
    try:
        import requests
    except ImportError:
        return None

    log("用 requests 尝试获取抖音 ttwid cookie...")
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        ),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    }
    try:
        session = requests.Session()
        resp = session.get("https://www.douyin.com/", headers=headers, timeout=15, allow_redirects=True)
        cookies = session.cookies.get_dict()
        if not cookies or "ttwid" not in cookies:
            log(f"requests 未获取到 ttwid（拿到 {len(cookies)} 条 cookie）")
            return None
        # 写入 Netscape 格式
        cookie_file = os.path.join(output_dir, f"{prefix}_cookies.txt")
        with open(cookie_file, "w", encoding="utf-8") as f:
            f.write("# Netscape HTTP Cookie File\n")
            for name, value in cookies.items():
                f.write(f".douyin.com\tTRUE\t/\tFALSE\t0\t{name}\t{value}\n")
        log(f"requests 获取到 {len(cookies)} 条抖音 cookie（含 ttwid）")
        return cookie_file
    except Exception as e:
        log(f"requests 获取抖音 cookie 失败: {str(e)[:120]}")
        return None


def _get_cookies_via_selenium(url: str, output_dir: str, prefix: str) -> str:
    """
    用 Selenium 无头浏览器访问目标网站首页，获取新鲜 cookie。
    不依赖 browser_cookie3（Chrome 127+ DPAPI 加密会导致它失败）。
    """
    try:
        from selenium import webdriver
        from selenium.webdriver.edge.options import Options
    except ImportError:
        log("未安装 selenium，跳过 cookie 获取")
        return None

    # 根据平台确定要访问的 URL（直接访问视频页面，拿到更多相关 cookie）
    if "douyin" in url:
        visit_url = url  # 直接访问视频页面
        required_cookie = "ttwid"
    elif "bilibili" in url:
        visit_url = "https://www.bilibili.com/"
        required_cookie = None
    else:
        return None

    log(f"用无头浏览器访问 {visit_url} 获取 cookie...")
    opts = Options()
    opts.add_argument("--headless")
    opts.add_argument("--disable-gpu")
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-dev-shm-usage")
    opts.add_argument(
        "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )

    driver = None
    try:
        driver = webdriver.Edge(options=opts)
        driver.get(visit_url)
        import time
        time.sleep(10)
        # 滚动页面触发更多 JS 执行和 cookie 生成
        try:
            driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
            time.sleep(3)
            driver.execute_script("window.scrollTo(0, 0);")
            time.sleep(2)
        except Exception:
            pass
        cookies = driver.get_cookies()
        if not cookies:
            log("Selenium 未获取到 cookie")
            return None
        # 抖音必须有 ttwid
        if required_cookie:
            has_required = any(c.get("name") == required_cookie for c in cookies)
            if not has_required:
                log(f"Selenium 获取的 {len(cookies)} 条 cookie 中没有 {required_cookie}，放弃")
                return None

        cookie_file = os.path.join(output_dir, f"{prefix}_cookies.txt")
        with open(cookie_file, "w", encoding="utf-8") as f:
            f.write("# Netscape HTTP Cookie File\n")
            for c in cookies:
                secure = "TRUE" if c.get("secure") else "FALSE"
                exp = str(int(c["expiry"])) if c.get("expiry") else "0"
                domain = c.get("domain", "")
                path = c.get("path", "/")
                name = c.get("name", "")
                value = c.get("value", "")
                flag = "TRUE" if domain.startswith(".") else "FALSE"
                f.write(f"{domain}\t{flag}\t{path}\t{secure}\t{exp}\t{name}\t{value}\n")
        log(f"Selenium 获取到 {len(cookies)} 条 cookie")
        return cookie_file
    except Exception as e:
        log(f"Selenium 获取 cookie 失败: {str(e)[:120]}")
        return None
    finally:
        if driver:
            try:
                driver.quit()
            except Exception:
                pass


def _download_douyin_audio_via_selenium(url: str, output_dir: str, prefix: str):
    """
    抖音专用下载方案：用 Selenium 拦截视频页面的音频流 URL，直接下载。
    绕过 yt-dlp 的 API 调用（抖音 API 经常 403）。
    返回 (audio_path, title, duration)。
    """
    try:
        from selenium import webdriver
        from selenium.webdriver.edge.options import Options
        import requests
    except ImportError:
        return None

    log("用 Selenium 拦截抖音音频流（绕过 yt-dlp API 限制）...")
    opts = Options()
    opts.add_argument("--headless")
    opts.add_argument("--disable-gpu")
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-dev-shm-usage")
    opts.add_argument(
        "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )

    driver = None
    try:
        driver = webdriver.Edge(options=opts)
        # 注入 JS 拦截 fetch/XHR 请求
        driver.execute_cdp_cmd("Page.addScriptToEvaluateOnNewDocument", {
            "source": """
            window._capturedUrls = [];
            const origFetch = window.fetch;
            window.fetch = function(...args) {
                const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url) || '';
                window._capturedUrls.push(url);
                return origFetch.apply(this, args);
            };
            const origXHR = XMLHttpRequest.prototype.open;
            XMLHttpRequest.prototype.open = function(method, url) {
                window._capturedUrls.push(url);
                return origXHR.apply(this, arguments);
            };
            """
        })
        driver.get(url)
        import time
        time.sleep(15)
        # 滚动触发视频加载
        try:
            driver.execute_script("window.scrollTo(0, 500);")
            time.sleep(5)
        except Exception:
            pass

        # 获取所有拦截的 URL
        urls = driver.execute_script("return window._capturedUrls || []")
        # 获取标题
        title = "抖音视频"
        try:
            t = driver.execute_script("return document.title")
            if t and t.strip():
                title = t.strip().replace("-抖音", "").strip()
        except Exception:
            pass

        # 找音频流 URL（优先 media-audio，其次 video 流）
        audio_url = None
        for u in urls:
            if "media-audio" in u:
                audio_url = u
                break
        if not audio_url:
            for u in urls:
                if "douyinvod.com" in u and "video/tos" in u:
                    audio_url = u
                    break

        if not audio_url:
            log("Selenium 未拦截到音频流 URL")
            return None

        log(f"拦截到音频流 URL: {audio_url[:80]}...")

        # 获取 cookie 并下载
        cookies = driver.get_cookies()
        cookie_dict = {c["name"]: c["value"] for c in cookies}
        driver.quit()
        driver = None

        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
            "Referer": "https://www.douyin.com/",
        }

        resp = requests.get(audio_url, headers=headers, cookies=cookie_dict, stream=True, timeout=60)
        if resp.status_code not in (200, 206):
            log(f"音频下载失败: HTTP {resp.status_code}")
            return None

        audio_path = os.path.join(output_dir, f"{prefix}.m4a")
        total = 0
        with open(audio_path, "wb") as f:
            for chunk in resp.iter_content(chunk_size=8192):
                f.write(chunk)
                total += len(chunk)

        # 估算时长（m4a 约 16kbps，但用文件大小粗略估算不准，返回 0 让 whisper 自己处理）
        log(f"抖音音频下载完成: {title[:30]}, 大小={total} bytes")
        return audio_path, title, 0

    except Exception as e:
        log(f"Selenium 下载抖音音频失败: {str(e)[:120]}")
        return None
    finally:
        if driver:
            try:
                driver.quit()
            except Exception:
                pass


def _get_browser_cookies(url: str, output_dir: str, prefix: str) -> str:
    """
    获取平台 cookie，保存为 Netscape 格式临时文件。
    优先级：requests（抖音）→ Selenium（通用）→ browser_cookie3（仅 Firefox）
    注意：不使用 Chrome/Edge 的 browser_cookie3，因为 Chrome 127+ DPAPI 加密会失败。
    """
    # 抖音：先尝试 requests（快），失败再用 Selenium
    if "douyin" in url:
        cookie_file = _get_douyin_cookies_via_requests(output_dir, prefix)
        if cookie_file:
            return cookie_file
        log("requests 获取抖音 cookie 失败，尝试 Selenium...")

    # 抖音和 B站都尝试 Selenium（不依赖 browser_cookie3 的 DPAPI 解密）
    if "douyin" in url or "bilibili" in url:
        cookie_file = _get_cookies_via_selenium(url, output_dir, prefix)
        if cookie_file:
            return cookie_file
        log("Selenium 获取 cookie 失败，尝试 browser_cookie3（仅 Firefox）...")

    # 最后兜底：browser_cookie3，只试 Firefox（Chrome/Edge 127+ 会 DPAPI 失败）
    try:
        import browser_cookie3
    except ImportError:
        return None

    if "bilibili" in url:
        domain = ".bilibili.com"
    elif "douyin" in url:
        domain = ".douyin.com"
    else:
        return None

    # 只试 Firefox，跳过 Chrome/Edge（DPAPI 加密问题）
    browsers = [
        ("firefox", lambda: browser_cookie3.firefox(domain_name=domain)),
    ]

    for name, getter in browsers:
        try:
            log(f"尝试从浏览器 {name} 读取 {domain} 的 cookie...")
            cj = getter()
            cookies = list(cj)
            if not cookies:
                continue
            cookie_file = os.path.join(output_dir, f"{prefix}_cookies.txt")
            with open(cookie_file, "w", encoding="utf-8") as f:
                f.write("# Netscape HTTP Cookie File\n")
                for c in cookies:
                    secure = "TRUE" if c.secure else "FALSE"
                    exp = str(int(c.expires)) if c.expires else "0"
                    flag = "TRUE" if c.domain.startswith(".") else "FALSE"
                    f.write(f"{c.domain}\t{flag}\t{c.path}\t{secure}\t{exp}\t{c.name}\t{c.value}\n")
            log(f"已从 {name} 读取 {len(cookies)} 条 cookie")
            return cookie_file
        except Exception as e:
            log(f"从 {name} 读取 cookie 失败: {str(e)[:100]}")
            continue

    return None


def get_ffmpeg_path() -> str:
    """
    多路径兜底查找 ffmpeg 可执行文件。
    优先级：环境变量 > imageio-ffmpeg 内置（失败则自动重下）> 全盘搜索 > 系统 PATH > 常见路径
    """
    import shutil
    # 1. 环境变量（最高优先级）
    env_exe = os.environ.get("IMAGEIO_FFMPEG_EXE")
    if env_exe and os.path.isfile(env_exe):
        log(f"从环境变量找到 FFmpeg: {env_exe}")
        return env_exe

    # 2. imageio-ffmpeg 内置（失败则尝试重新安装/下载）
    try:
        import imageio_ffmpeg
        try:
            exe = imageio_ffmpeg.get_ffmpeg_exe()
            if exe and os.path.isfile(exe):
                log(f"从 imageio-ffmpeg 找到 FFmpeg: {exe}")
                return exe
        except Exception:
            pass
        # 二进制丢失，尝试用 pip 强制重装 imageio-ffmpeg（会重新下载 ffmpeg 二进制）
        log("imageio-ffmpeg 二进制丢失，尝试重新安装修复...")
        import subprocess
        try:
            subprocess.run(
                [sys.executable, "-m", "pip", "install", "--force-reinstall", "--no-deps", "imageio-ffmpeg"],
                capture_output=True, timeout=120
            )
            exe = imageio_ffmpeg.get_ffmpeg_exe()
            if exe and os.path.isfile(exe):
                log(f"重新安装 imageio-ffmpeg 成功: {exe}")
                return exe
        except Exception as e:
            log(f"重新安装 imageio-ffmpeg 失败: {e}")
    except Exception as e:
        log(f"imageio-ffmpeg 不可用: {e}")

    # 3. 全盘搜索已有的 ffmpeg.exe（可能在用户电脑其他位置）
    if sys.platform == "win32":
        log("全盘搜索 ffmpeg.exe（可能需要几秒）...")
        search_dirs = [
            os.environ.get("LOCALAPPDATA", ""),
            os.environ.get("APPDATA", ""),
            os.path.expanduser("~"),
            "C:\\",
        ]
        for search_dir in search_dirs:
            if not search_dir or not os.path.isdir(search_dir):
                continue
            try:
                for root, dirs, files in os.walk(search_dir):
                    # 跳过系统目录和 node_modules 加快搜索
                    dirs[:] = [d for d in dirs if d not in ("Windows", "Program Files", "Program Files (x86)", "$Recycle.Bin", "node_modules", ".git")]
                    if "ffmpeg.exe" in files:
                        found = os.path.join(root, "ffmpeg.exe")
                        log(f"全盘搜索找到 FFmpeg: {found}")
                        return found
            except PermissionError:
                continue
            except Exception:
                continue

    # 4. 系统 PATH 中的 ffmpeg
    sys_exe = shutil.which("ffmpeg") or shutil.which("ffmpeg.exe")
    if sys_exe:
        log(f"从系统 PATH 找到 FFmpeg: {sys_exe}")
        return sys_exe

    # 5. Windows 常见安装路径兜底
    if sys.platform == "win32":
        candidates = [
            r"C:\ffmpeg\bin\ffmpeg.exe",
            r"C:\Program Files\ffmpeg\bin\ffmpeg.exe",
            os.path.expanduser(r"~\scoop\shims\ffmpeg.exe"),
        ]
        for c in candidates:
            if os.path.isfile(c):
                log(f"从常见路径找到 FFmpeg: {c}")
                return c

    raise RuntimeError(
        "找不到 ffmpeg，且自动下载失败。请手动执行：\n"
        "  pip install --force-reinstall imageio-ffmpeg\n"
        "  或下载 ffmpeg 并加入系统 PATH"
    )


def download_audio(url: str, output_dir: str, prefix: str) -> tuple:
    """
    下载视频音频，返回 (音频文件路径, 视频标题, 时长秒数)。
    - 抖音：优先用 Selenium 拦截音频流（绕过 yt-dlp API 403），失败再用 yt-dlp
    - 其他平台：用 yt-dlp
    """
    import yt_dlp
    import time

    # 抖音优先用 Selenium 拦截方案（yt-dlp 对抖音 API 经常 403）
    if "douyin" in url:
        result = _download_douyin_audio_via_selenium(url, output_dir, prefix)
        if result:
            return result
        log("Selenium 拦截抖音音频失败，回退到 yt-dlp...")

    ffmpeg_path = get_ffmpeg_path()
    ffmpeg_dir = os.path.dirname(ffmpeg_path)  # yt-dlp 需要目录而非文件
    log(f"使用 FFmpeg: {ffmpeg_path}")

    base_opts = {
        "format": "bestaudio/best",
        "outtmpl": os.path.join(output_dir, f"{prefix}.%(ext)s"),
        "ffmpeg_location": ffmpeg_dir,
        # 不做 postprocessors 格式转换——避免依赖 ffprobe，
        # faster-whisper 可直接处理 m4a/aac/webm 等原始格式
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
        "noprogress": True,
        "logger": type("YtdlLogger", (), {
            "debug": lambda self, msg: log(f"[yt-dlp] {msg}"),
            "info": lambda self, msg: log(f"[yt-dlp] {msg}"),
            "warning": lambda self, msg: log(f"[yt-dlp WARN] {msg}"),
            "error": lambda self, msg: log(f"[yt-dlp ERROR] {msg}"),
        })(),
        "http_headers": {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
            "Referer": "https://www.bilibili.com/" if "bilibili" in url else "https://www.douyin.com/",
        },
        "nocheckcertificate": True,
    }

    # 重试机制：抖音 403 时重新获取 cookie 并重试
    max_retries = 3
    for attempt in range(1, max_retries + 1):
        opts = dict(base_opts)
        cookie_file = _get_browser_cookies(url, output_dir, prefix)
        if cookie_file:
            opts["cookiefile"] = cookie_file
        # 注意：不使用 cookiesfrombrowser，因为 Chrome/Edge 127+ 会 DPAPI 解密失败

        log(f"开始下载音频（第 {attempt}/{max_retries} 次尝试）: {url}")
        try:
            with yt_dlp.YoutubeDL(opts) as ydl:
                info = ydl.extract_info(url, download=True)
                title = info.get("title", "未知标题")
                duration = info.get("duration", 0)
                ext = info.get("ext", "m4a")
                audio_path = os.path.join(output_dir, f"{prefix}.{ext}")
                log(f"下载完成: 标题={title[:30]}, 时长={duration}s, 格式={ext}")
                return audio_path, title, duration
        except Exception as e:
            err_msg = str(e)
            # 抖音 403/Fresh cookies：等待后重新获取 cookie 重试
            if ("403" in err_msg or "Fresh cookies" in err_msg or "DPAPI" in err_msg) and attempt < max_retries:
                wait = 10 * attempt  # 递增等待：10s, 20s
                log(f"下载失败，等待 {wait} 秒后重新获取 cookie 重试...")
                # 清理旧 cookie 文件
                if cookie_file and os.path.exists(cookie_file):
                    os.remove(cookie_file)
                time.sleep(wait)
                continue
            # 其他错误直接抛出
            raise

    # 不应到达这里
    raise RuntimeError("下载失败，已达最大重试次数")


def transcribe(audio_path: str, model_name: str) -> str:
    """用 faster-whisper 转写音频为中文文本"""
    model = get_whisper_model(model_name)
    log(f"开始语音识别（模型: {model_name}）...")
    segments, info = model.transcribe(
        audio_path,
        language="zh",
        beam_size=5,
        vad_filter=True,  # 过滤静音段，提升速度
        vad_parameters=dict(min_silence_duration_ms=500),
    )

    # 拼接所有段落，用句号分隔
    texts = []
    for seg in segments:
        text = seg.text.strip()
        if text:
            texts.append(text)
    transcript = "。".join(texts)
    if not transcript.endswith(("。", "！", "？")):
        transcript += "。"
    log(f"转写完成，共 {len(transcript)} 字")
    return transcript


def cleanup(prefix: str, output_dir: str):
    """清理同前缀的所有临时文件（yt-dlp 可能产生中间文件）"""
    try:
        for f in os.listdir(output_dir):
            if f.startswith(prefix):
                os.remove(os.path.join(output_dir, f))
        log(f"已清理临时文件: {prefix}*")
    except Exception as e:
        log(f"清理临时文件失败: {e}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", required=True, help="视频链接")
    parser.add_argument(
        "--model",
        default="small",
        choices=["tiny", "base", "small", "medium", "large-v3"],
        help="Whisper 模型大小（默认 small，准确率与速度平衡）",
    )
    args = parser.parse_args()

    prefix = uuid.uuid4().hex[:12]
    output_dir = tempfile.gettempdir()

    try:
        # 1. 下载音频
        audio_path, title, duration = download_audio(args.url, output_dir, prefix)

        if not os.path.exists(audio_path):
            raise RuntimeError("音频下载失败，未找到输出文件")

        # 2. 语音转写
        transcript = transcribe(audio_path, args.model)

        # 3. 输出 JSON 到 stdout
        result = {
            "title": title,
            "transcript": transcript,
            "duration": duration,
        }
        print(json.dumps(result, ensure_ascii=False), flush=True)

    except Exception as e:
        # 错误也输出为 JSON，方便 Node 解析
        err = {"error": str(e)}
        print(json.dumps(err, ensure_ascii=False), flush=True)
        sys.exit(1)
    finally:
        cleanup(prefix, output_dir)


if __name__ == "__main__":
    main()
