# BikBok - Infinite Swipe Short Video

## 项目简介

**BikBok** 是一个模仿抖音（TikTok）无限滑动浏览视频功能的**Demo**。

没有点赞，没有评论，没有视频描述，纯粹的浏览。

## Change log

- 2015.1.15
    1. 现在网页在真实移动设备（iPhone测试通过）上也能正常渲染了，并且上下滑动手势也能正常识别了。
    2. 由于浏览器策略限制，现在不论什么设备上访问网页将默认静音，添加了静音切换按钮。

### 已知问题

1. ~~本项目在Windows上的Chrome、Chrome模拟iPhone、Edge均能正常显示。但是在真实移动设备（iPhone）上，无论我用Safari还是Chrome（ios版）都无法正常显示。不要问我为什么，我也不知道怎么修复。~~

2. 由于本项目没有视频缓冲和视频分片加载特性，因此过大的视频可能会很慢才显示。

### 技术栈

- **前端**：HTML5, CSS, JavaScript
- **后端**：Python(FastAPI)
- **视频存储**：MP4 格式的视频文件

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

1. 安装必要的依赖：
```bash
   pip install fastapi uvicorn
```

2. 配置参数
    - `index.html` - `const API_BASE_URL = "http://127.0.0.1:8000";`
    - `bikbok-server.py` - `uvicorn.run("__main__:app", host="127.0.0.1", port=8000)`

## 启动说明

1. 运行后端 API 服务，确保 FastAPI 服务正常启动。
   ```bash
   python bikbok-server.py
   ```

2. 将MP4视频文件uploads文件夹内 ，确保它们能通过`http://127.0.0.1:8000/videos/{filename}` 访问。

3. 在浏览器中打开index.html即可体验。

**当uploads文件夹加入新视频时，需重新执行第一步，这样服务端才会重新构建服务器视频信息列表。**