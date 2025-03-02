import os
from pathlib import Path
import random
import uuid
from datetime import datetime, timedelta
from fastapi import FastAPI, HTTPException, Request, Depends, Cookie, Response
from fastapi.responses import FileResponse, StreamingResponse, RedirectResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
from pydantic import BaseModel
import threading
import argparse
import json
import sys
import httpx
import asyncio

# 第三方视频源
remote_video_api = "https://www.onexiaolaji.cn/RandomPicture/api/api-video.php"

# 是否使用第三方视频源，false为使用本地视频源。
use_remote_videos = True

users_db = set()

# 全局变量
videos = []
sessions = {}  # {session_id: {"last_active": datetime, "seen_videos": set}}

# 创建一个异步函数来获取单个视频 URL
async def fetch_video_url(client):
    response = await client.get(remote_video_api)
    result = response.json()
    return result['raw_url']

async def get_remote_videos(num: int):
    # # 创建异步客户端请求
    # async with httpx.AsyncClient() as client:
    #     resp = await client.get(remote_video_api)
    # # 返回目标服务器的响应
    # result = resp.json()
    # print(result)
    # return JSONResponse(content=resp.json(), status_code=resp.status_code)

    async with httpx.AsyncClient() as client:
        # 使用列表生成式并发请求获取多个视频 URL
        video_urls = await asyncio.gather(
            *[fetch_video_url(client) for _ in range(num)]
        )

    # 返回获取到的视频 URL
    return video_urls

def load_videos():
    print("正在扫描本地视频目录...")
    global videos
    if not os.path.exists(VIDEO_DIR):
        raise FileNotFoundError(f"目录 {VIDEO_DIR} 不存在")

    for file in VIDEO_DIR.rglob("*.mp4"):
        if file.suffix.lower() == ".mp4":  # 转为小写后比较
            relative_path = file.relative_to(VIDEO_DIR).as_posix()
            videos.append(relative_path)

    if not videos:
        raise FileNotFoundError("视频目录中没有找到任何 mp4 文件")

    print(f"已构建服务器视频信息列表，共计{len(videos)}个。")

# 从 users.json 文件中读取用户数据
def load_users():
    global users_db
    try:
        print("正在读取用户配置文件")
        with open('users.json', 'r', encoding='utf-8') as file:
            users_db = json.load(file)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        print(f"读取 users.json 时发生错误: {e}")
        sys.exit(1)  # 出错时终止程序

@asynccontextmanager
async def lifespan(app: FastAPI):

    # 启动时读取用户配置文件
    load_users()

    if use_remote_videos == False:
        # 启动时读取指定目录下的所有视频文件
        load_videos()

    # 应用启动完成
    yield

    # 在应用关闭时运行的逻辑（如果需要）
    print("应用已关闭，执行清理操作。")

app = FastAPI(lifespan=lifespan)

class User(BaseModel):
    username: str
    password: str

def authenticate_user(username: str, password: str):
    # 遍历 users_db 元组，找到匹配的用户
    for user in users_db:
        if user["username"] == username and user["password"] == password:
            return user
    return None

# 登录接口
@app.post("/login")
async def login(user: User, response: Response):
    # 验证用户名和密码
    if authenticate_user(user.username, user.password):
            new_session_id = create_session()
            response.set_cookie(
            key="session_id", 
            value=new_session_id, 
            max_age=60 * 60 * 24 * 365,  # 设置 cookie 有效期为一年
            httponly=True,                # 确保客户端 JavaScript 无法访问 cookie
            secure=False,                  # 在 HTTPS 上才使用此 cookie
            samesite="Strict"             # 防止 CSRF 攻击
        )
            print(f"用户 {user.username} 登录成功！")
            return {"message": "success", "session_id": new_session_id, "username": user.username}

    else:
        raise HTTPException(status_code=401, detail="Invalid credentials")

# 挂载静态文件目录
app.mount("/static", StaticFiles(directory="static"), name="static")

def get_current_session(session_id: str = Cookie(None)):
    # 验证 session_id 是否有效
    if sessions.get(session_id) is None:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired session_id"
        )
    return session_id

# 登出接口
@app.post("/logout")
async def logout(response: Response, session_id: str = Depends(get_current_session)):
    if sessions.pop(session_id):
        print(f"会话 {session_id} 已注销！")
        response.delete_cookie("session_id")
        return {"message": "success"}

# 定期清理超过 10 分钟不活跃的用户
def cleanup_sessions():
    global sessions
    while True:
        now = datetime.now()
        inactive_users = [session_id for session_id, session in sessions.items() if now - session["last_active"] > timedelta(minutes=10)]
        for session_id in inactive_users:
            print(f"会话 {session_id} 超过10分钟未活跃，已销毁。")
            del sessions[session_id]
        threading.Event().wait(60)  # 每 60 秒检查一次

threading.Thread(target=cleanup_sessions, daemon=True).start()

@app.get("/")
async def main_page(session_id: str = Cookie(None)):
    current_session = sessions.get(session_id)
    
    if current_session is None:
        return RedirectResponse(url="/login")
    
    # 更新用户最后活跃时间
    current_session["last_active"] = datetime.now()
    # 当同一个用户刷新主页面时清空已看视频
    current_session["seen_videos"].clear()

    headers = {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
    }

    return FileResponse(os.path.join("static", "index.html"), headers=headers)

@app.get("/login")
async def login_page():
    return FileResponse(os.path.join("static", "login.html"))

def updateLastActive(session_id):
    sessions[session_id]["last_active"] = datetime.now()

@app.post("/get-videos")
async def get_videos(request: Request, session_id: str = Depends(get_current_session)):
    # 更新用户最后活跃时间
    updateLastActive(session_id)

    if use_remote_videos:
        video_paths = await get_remote_videos(3)
        if len(video_paths) != 0:
            return {"videos": video_paths, "message": "success"}
        else:
            return {"message": "noMore"}

    origin = request.headers.get('Origin')

    # 计算未观看的视频
    seen_videos = sessions[session_id]["seen_videos"]
    remaining_videos = list(set(videos) - seen_videos)

    if not remaining_videos:
        return {"message": "noMore"}

    # 随机选择最多三个视频
    returned_videos = random.sample(remaining_videos, min(3, len(remaining_videos)))
    sessions[session_id]["seen_videos"].update(returned_videos)

    # 构造包含静态文件路径的视频信息
    video_paths = [f"{origin}/videos/{video}" for video in returned_videos]
    
    return {"videos": video_paths, "message": "success"}

def create_session():
    # 分配新 session_id
    new_session_id = str(uuid.uuid4())
    sessions[new_session_id] = {"last_active": datetime.now(), "seen_videos": set()}
    return new_session_id

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
        default=None, 
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

    if args.video_dir:
        # 配置：视频目录路径
        VIDEO_DIR = Path(args.video_dir)
        if not VIDEO_DIR.is_dir():
            raise FileNotFoundError(f"The specified video directory does not exist: {VIDEO_DIR}")
        use_remote_videos = False
    else:
        print("未设置本地视频目录，将使用远程视频源")

    PORT = args.port

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