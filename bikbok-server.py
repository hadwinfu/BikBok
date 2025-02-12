import os
from pathlib import Path
import random
import uuid
from datetime import datetime, timedelta
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import StreamingResponse
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
from pydantic import BaseModel
import threading
import argparse


# 全局变量
videos = []
sessions = {}  # {uuid: {"last_active": datetime, "seen_videos": set}}

def load_videos():
    global videos
    if not os.path.exists(VIDEO_DIR):
        raise FileNotFoundError(f"目录 {VIDEO_DIR} 不存在")

    # for root, dirs, files in os.walk(VIDEO_DIR):
    #     for file in files:
    #         if file.lower().endswith('.mp4'):
    #             # 拼接文件的相对路径
    #             relative_path = os.path.relpath(os.path.join(root, file), VIDEO_DIR)
    #             relative_path = Path(relative_path).as_posix()
    #             videos.append(relative_path)


    for file in VIDEO_DIR.rglob("*.mp4"):
        if file.suffix.lower() == ".mp4":  # 转为小写后比较
            relative_path = file.relative_to(VIDEO_DIR).as_posix()
            videos.append(relative_path)

    if not videos:
        raise FileNotFoundError("视频目录中没有找到任何 mp4 文件")

    print(f"已构建服务器视频信息列表，共计{len(videos)}个。")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 启动时读取指定目录下的所有视频文件
    load_videos()

    # 应用启动完成
    yield

    # 在应用关闭时运行的逻辑（如果需要）
    print("应用已关闭，执行清理操作。")

app = FastAPI(lifespan=lifespan)

# 挂载静态文件目录
app.mount("/static", StaticFiles(directory="static"), name="static")

# 定期清理超过 10 分钟不活跃的用户
def cleanup_sessions():
    global sessions
    while True:
        now = datetime.now()
        inactive_users = [uuid for uuid, session in sessions.items() if now - session["last_active"] > timedelta(minutes=10)]
        for uuid in inactive_users:
            print(f"会话 {uuid} 超过10分钟未活跃，已销毁。")
            del sessions[uuid]
        threading.Event().wait(60)  # 每 60 秒检查一次

threading.Thread(target=cleanup_sessions, daemon=True).start()

class VideoRequest(BaseModel):
    uuid: str

@app.get("/")
def read_root():
    # 返回 HTML 文件
    return FileResponse("index.html")


@app.post("/get-videos")
async def get_videos(video_request: VideoRequest):
    global sessions

    # 验证 UUID
    if video_request.uuid not in sessions:
        raise HTTPException(status_code=400, detail="Invalid UUID")

    # 更新用户最后活跃时间
    session = sessions[video_request.uuid]
    session["last_active"] = datetime.now()

    # 计算未观看的视频
    seen_videos = session["seen_videos"]
    remaining_videos = list(set(videos) - seen_videos)

    if not remaining_videos:
        return {"message": "noMore"}

    # 随机选择最多三个视频
    returned_videos = random.sample(remaining_videos, min(3, len(remaining_videos)))
    session["seen_videos"].update(returned_videos)

    # 构造包含静态文件路径的视频信息
    video_paths = [f"/videos/{video}" for video in returned_videos]
    
    return {"videos": video_paths, "message": "success"}

@app.post("/create-session")
async def create_session():
    # 分配新 UUID
    new_uuid = str(uuid.uuid4())
    sessions[new_uuid] = {"last_active": datetime.now(), "seen_videos": set()}
    return {"uuid": new_uuid}

@app.get("/videos/{video_name:path}")
async def stream_video(video_name: str, request: Request):

    video_path = (VIDEO_DIR / video_name).resolve() # 拼接文件的绝对路径
    
    video_path = video_path.as_posix()

    # print(video_path)

    # 检查视频文件是否存在
    if not os.path.exists(video_path):
        raise HTTPException(status_code=404, detail="Video not found")
    
    file_size = os.path.getsize(video_path)
    
    # 获取 Range 请求头
    range_header = request.headers.get("Range", None)
    
    # 如果没有 Range 请求头，返回完整视频
    if not range_header:
        return StreamingResponse(open(video_path, "rb"), media_type="video/mp4", headers={"Accept-Ranges": "bytes"})
    
    # 解析 Range 请求头（格式：bytes=start-end）
    if range_header.startswith("bytes="):
        byte_range = range_header[6:]
        start, end = byte_range.split("-")
        start = int(start)
        
        # 如果没有指定 end，设置为文件末尾
        if not end:
            end = file_size - 1
        else:
            end = int(end)

        # 确保 end 在文件大小范围内
        if end >= file_size:
            end = file_size - 1
        
        # 打开视频文件，返回文件的指定范围
        def iter_file():
            with open(video_path, "rb") as f:
                f.seek(start)
                yield f.read(end - start + 1)
        
        # 返回部分内容，状态码 206 (Partial Content)
        return StreamingResponse(iter_file(), media_type="video/mp4", 
                                 headers={
                                     "Content-Range": f"bytes {start}-{end}/{file_size}",
                                     "Accept-Ranges": "bytes"
                                 },
                                 status_code=206)

    # 如果 Range 请求头格式错误，抛出异常
    raise HTTPException(status_code=400, detail="Invalid Range header")

def valid_port(value):
    """验证端口号是否在合法范围内"""
    try:
        port = int(value)
        if 1 <= port <= 65535:
            return port
        else:
            raise argparse.ArgumentTypeError(f"Port must be in the range 1-65535, got {value}.")
    except ValueError:
        raise argparse.ArgumentTypeError(f"Invalid port number: {value}.")

def parse_arguments():
    parser = argparse.ArgumentParser(description="Video Directory and Deployment Mode")
    parser.add_argument(
        "-d", "--video-dir", 
        type=str, 
        required=True, 
        help="Path to the video directory."
    )
    parser.add_argument(
        "-m", "--mode", 
        type=str, 
        choices=["local", "server"], 
        required=True, 
        help="Deployment mode: 'local' or 'server'."
    )
    parser.add_argument(
        "-p", "--port",
        type=valid_port,  # 自定义端口验证函数
        default=8000,  # 默认值
        help="Port number for the server (1-65535). Default is 8000."
    )

    return parser.parse_args()

if __name__ == "__main__":

    args = parse_arguments()

    # 配置：视频目录路径
    VIDEO_DIR = Path(args.video_dir)
    
    PORT = args.port

    if not VIDEO_DIR.is_dir():
        raise FileNotFoundError(f"The specified video directory does not exist: {VIDEO_DIR}")

    import uvicorn

    if args.mode == 'server':
        uvicorn.run("__main__:app", host="0.0.0.0", port=PORT)
    elif args.mode == 'local':

        app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],  # 可以指定具体的前端域名，比如 ["http://localhost:8000"]
            allow_credentials=True,
            allow_methods=["*"],  # 允许的 HTTP 方法
            allow_headers=["*"],  # 允许的请求头
        )

        uvicorn.run("__main__:app", host="127.0.0.1", port=PORT)