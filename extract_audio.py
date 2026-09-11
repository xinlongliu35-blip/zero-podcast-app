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


def _get_douyin_cookies_via_selenium(output_dir: str, prefix: str) -> str:
    """
    用 Selenium 无头 Edge 访问抖音首页，获取新鲜 cookie（含 ttwid）。
    抖音需要 ttwid 等 cookie 才能下载，且 browser_cookie3 在 Windows 上
    经常因浏览器加密/锁定而读不到，此方法不依赖用户登录态。
    """
    try:
        from selenium import webdriver
        from selenium.webdriver.edge.options import Options
    except ImportError:
        log("未安装 selenium，跳过抖音 cookie 获取")
        return None

    log("用无头浏览器获取抖音新鲜 cookie（含 ttwid）...")
    opts = Options()
    opts.add_argument("--headless")
    opts.add_argument("--disable-gpu")
    opts.add_argument("--no-sandbox")
    opts.add_argument(
        "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    )

    driver = None
    try:
        driver = webdriver.Edge(options=opts)
        driver.get("https://www.douyin.com/")
        # 等待页面加载和 JS 设置 cookie
        import time
        time.sleep(5)
        cookies = driver.get_cookies()
        if not cookies:
            log("Selenium 未获取到抖音 cookie")
            return None

        cookie_file = os.path.join(output_dir, f"{prefix}_cookies.txt")
        with open(cookie_file, "w", encoding="utf-8") as f:
            f.write("# Netscape HTTP Cookie File\n")
            for c in cookies:
                secure = "TRUE" if c.get("secure") else "FALSE"
                exp = str(int(c["expiry"])) if c.get("expiry") else "0"
                domain = c.get("domain", ".douyin.com")
                path = c.get("path", "/")
                name = c.get("name", "")
                value = c.get("value", "")
                # Netscape 格式：domain 以 . 开头时 flag 为 TRUE，否则为 FALSE
                flag = "TRUE" if domain.startswith(".") else "FALSE"
                f.write(f"{domain}\t{flag}\t{path}\t{secure}\t{exp}\t{name}\t{value}\n")
        log(f"Selenium 获取到 {len(cookies)} 条抖音 cookie")
        return cookie_file
    except Exception as e:
        log(f"Selenium 获取抖音 cookie 失败: {str(e)[:120]}")
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
    - 抖音：优先用 Selenium 获取新鲜 ttwid（不依赖登录态）
    - B站：尝试 browser_cookie3 读取浏览器登录态
    返回 cookie 文件路径；失败返回 None。
    """
    # 抖音：用 Selenium 获取新鲜 cookie（最可靠）
    if "douyin" in url:
        cookie_file = _get_douyin_cookies_via_selenium(output_dir, prefix)
        if cookie_file:
            return cookie_file
        log("Selenium 获取抖音 cookie 失败，尝试 browser_cookie3...")

    # 其余情况用 browser_cookie3
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

    browsers = [
        ("edge", lambda: browser_cookie3.edge(domain_name=domain)),
        ("chrome", lambda: browser_cookie3.chrome(domain_name=domain)),
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


def download_audio(url: str, output_dir: str, prefix: str) -> tuple:
    """
    用 yt-dlp 下载视频音频，返回 (音频文件路径, 视频标题)
    遇到抖音 403/Fresh cookies 时自动重试（重新获取 ttwid）
    """
    import yt_dlp
    import imageio_ffmpeg
    import time

    audio_path = os.path.join(output_dir, f"{prefix}.mp3")
    ffmpeg_path = imageio_ffmpeg.get_ffmpeg_exe()
    log(f"使用 FFmpeg: {ffmpeg_path}")

    base_opts = {
        "format": "bestaudio/best",
        "outtmpl": os.path.join(output_dir, f"{prefix}.%(ext)s"),
        "ffmpeg_location": ffmpeg_path,
        "postprocessors": [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": "mp3",
                "preferredquality": "128",
            }
        ],
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

    # 重试机制：抖音 403 时重新获取 ttwid 并重试
    max_retries = 3
    for attempt in range(1, max_retries + 1):
        cookie_file = _get_browser_cookies(url, output_dir, prefix)
        opts = dict(base_opts)
        if cookie_file:
            opts["cookiefile"] = cookie_file

        log(f"开始下载音频（第 {attempt}/{max_retries} 次尝试）: {url}")
        try:
            with yt_dlp.YoutubeDL(opts) as ydl:
                info = ydl.extract_info(url, download=True)
                title = info.get("title", "未知标题")
                duration = info.get("duration", 0)
                log(f"下载完成: 标题={title[:30]}, 时长={duration}s")
                return audio_path, title, duration
        except Exception as e:
            err_msg = str(e)
            # 抖音 403/Fresh cookies：等待后重新获取 ttwid 重试
            if ("403" in err_msg or "Fresh cookies" in err_msg) and attempt < max_retries:
                wait = 15 * attempt  # 递增等待：15s, 30s
                log(f"抖音返回 403，等待 {wait} 秒后重新获取 cookie 重试...")
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
