# BikBok - Infinite Swipe Short Video

## 项目简介

**BikBok** 是一个模仿抖音（TikTok）无限滑动浏览视频功能的**Demo**。

没有第三方组件，没有点赞，没有评论，没有视频描述，纯粹的浏览。

## Preview
![Preview](https://github.com/hadwinfu/BikBok/blob/main/preview.gif)

## Change log

- 2025.1.18
    1. 从前后端分离改为后端渲染返回网页，现在只需要启动后端服务即可。
    2. 优化了跨平台文件路径的解析。
    3. 添加了启动参数支持，修改参数更加快捷，部署更方便。

- 2025.1.17
    1. 修复了后端无法正确解析视频路径的bug，该bug曾导致后端无法返回处于子文件夹内的视频（例如/videos/anime/example.mp4）。
    2. 弃用`@app.on_event("startup")`装饰器，改为fastapi推荐的lifespan来管理程序启动时的初始化功能。

- 2025.1.16
    1. 修改了网页首次加载时静音按钮的默认样式（静音）。
    2. 修改了后端代码，现在后端支持流式传输，html5的video标签原生支持一边缓冲一边播放，再也不怕卡啦。
    3. 不再支持加载非MP4格式的视频，因为它们不支持流式传输。

- 2025.1.15
    1. 现在网页在真实移动设备（iPhone测试通过）上也能正常渲染了，并且上下滑动手势也能正常识别了。
    2. 由于浏览器策略限制，现在不论什么设备上访问网页将默认静音，添加了静音切换按钮。

### 已知问题

1. ~~本项目在Windows上的Chrome、Chrome模拟iPhone、Edge均能正常显示。但是在真实移动设备（iPhone）上，无论我用Safari还是Chrome（ios版）都无法正常显示。不要问我为什么，我也不知道怎么修复。~~

2. ~~过大的视频可能会很慢才显示。~~

### 技术栈

- **前端**：HTML5, CSS, JavaScript
- **后端**：Python(FastAPI)

## 功能描述

### 1. 视频展示
用户可以通过滑动或者按键控制来浏览视频。每个视频均能自动播放并且支持静音与取消静音。

### 2. 视频切换
通过上/下箭头或者鼠标滚轮，用户可以切换到下一个或上一个视频。

### 3. 静音与播放控制
用户可以通过按下 'M' 键控制视频的静音与取消静音，或者通过空格键来控制视频的播放与暂停。

### 4. 触摸控制（移动设备）
在移动设备上，用户可以通过上下滑动手势来切换视频。默认情况下，移动设备上的视频会自动取消静音。

### 5. 视频加载与刷新
当视频播放结束或用户滑动到列表末尾时，应用会自动拉取新的视频，并显示在视频列表中。

### 6. 用户会话
每个用户都会生成一个唯一的会话ID，服务端通过此ID追踪用户已观看的视频并根据未观看的视频列表提供推荐。

## 无限滑动实现原理

本人之前阅读过[这篇文章](https://juejin.cn/post/7361614921519054883)，其原理是添加和删除dom，无奈其中的判断算法非常抽象，让我百思不得其解。

在本项目的前端页面中，始终只有3个frame。其原理是始终让正在观看的frame处于显示区域，并通过移动上下两个frame的位置来实现无限滑动的效果，无需复杂的判断条件。在代码中体现为不断修改`slideList.style.transform`和`slideList.style.top`。

- `slideList.style.transform` 负责滑动动画
- `slideList.style.top` 负责高度补偿

骚操作。简单，粗暴。

## API 说明

### 1. 创建会话

- **请求方式**：POST
- **请求路径**：`/create-session`
- **响应示例**：
    ```json
    {
        "uuid": "new-uuid-value"
    }
    ```

### 2. 获取视频

- **请求方式**：POST
- **请求路径**：`/get-videos`
- **请求参数**：
    ```json
    {
        "uuid": "user-session-uuid"
    }
    ```
- **响应示例**：
    ```json
    {
        "videos": ["/videos/video1.mp4", "/videos/video2.mp4"],
        "message": "success"
    }
    ```
    或
    ```json
    {
        "message": "noMore"
    }
    ```

## 运行环境配置

- 建议Python版本>=3.10.11

- 安装必要的依赖：
```bash
   pip install -r requirements.txt
```

## 部署

1. 将MP4视频文件uploads文件夹内 ，确保它们能通过`http://127.0.0.1:8000/videos/{filename}` 访问。

- Tips：如果元数据存储在视频文件开头，播放前的加载时间会更快。
- 优化：使用 FFmpeg 将元数据移动到文件开头：
    ```bash
    ffmpeg -i input.mp4 -movflags +faststart output.mp4
    ```

2. 运行`bikbok-server.py`

    ```bash
    python bibok-server.py -d uploads -m local -p 23333
    ```

3. 在浏览器中打开网址即可体验。

**当视频文件夹加入新视频或VIDEO_DIR参数被改动时，需重新执行第一步，这样服务端才会重新构建服务器视频信息列表。**

## 参数说明

### 1. 视频目录参数
- **短选项**: `-d`
- **长选项**: `--video-dir`
- **是否必需**: 是
- **描述**: 
  - 该参数用于设置程序运行所需的视频目录路径。

### 2. 部署模式参数
- **短选项**: `-m`
- **长选项**: `--mode`
- **是否必需**: 是
- **限制**: 
  - 可选值为 `'local'` 或 `'server'`。
- **描述**: 
  - 设置程序的部署模式。
  - - `'local'`: 本地部署模式（监听127.0.0.1）。
  - - `'server'`: 服务器部署模式（监听0.0.0.0）。

### 3. 端口号参数
- **短选项**: `-p`
- **长选项**: `--port`
- **类型**: 自定义验证函数 `valid_port`
- **默认值**: `8000`
- **描述**: 
  - 指定服务器的端口号。
  - 端口号必须在 `1-65535` 范围内，默认值为 `8000`。