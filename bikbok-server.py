import os
import random
import uuid
from datetime import datetime, timedelta
from fastapi import FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
from pydantic import BaseModel
import threading

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 可以指定具体的前端域名，比如 ["http://localhost:8000"]
    allow_credentials=True,
    allow_methods=["*"],  # 允许的 HTTP 方法
    allow_headers=["*"],  # 允许的请求头
)

# 全局变量
videos = []
sessions = {}  # {uuid: {"last_active": datetime, "seen_videos": set}}

# 配置：视频目录路径
VIDEO_DIR = "./uploads"  # 替换为实际路径

# 启动时读取指定目录下的所有mp4文件
@app.on_event("startup")
def load_videos():
    global videos
    if not os.path.exists(VIDEO_DIR):
        raise FileNotFoundError(f"目录 {VIDEO_DIR} 不存在")
    videos = [file for file in os.listdir(VIDEO_DIR) if file.endswith(".mp4")]
    if not videos:
        raise FileNotFoundError("视频目录中没有找到任何 mp4 文件")
    print(f"已构建服务器视频信息列表，共计{len(videos)}个。")

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

# 挂载静态资源目录
app.mount("/videos", StaticFiles(directory=VIDEO_DIR), name="videos")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("__main__:app", host="127.0.0.1", port=8000)
