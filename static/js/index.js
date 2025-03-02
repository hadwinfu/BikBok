let animationFrameId;

function updateProgressBarSmoothly() {
    const watchingFrame = document.querySelector('.frame.watching');
    if (!watchingFrame) return;

    const video = watchingFrame.querySelector('video');
    const progressBar = watchingFrame.querySelector('.progress-bar');

    if (video && progressBar) {
        const progress = (video.currentTime / video.duration) * 100 || 0;
        progressBar.style.width = `${progress}%`;

        // 使用 requestAnimationFrame 再次调用
        animationFrameId = requestAnimationFrame(updateProgressBarSmoothly);
    }
}

function startUpdatingProgressBar() {
    cancelAnimationFrame(animationFrameId); // 确保没有重复的动画帧
    animationFrameId = requestAnimationFrame(updateProgressBarSmoothly);
}

function stopUpdatingProgressBar() {
    cancelAnimationFrame(animationFrameId); // 停止动画帧更新
}

function addVideoEventListeners(videoElement) {
    videoElement.addEventListener('play', startUpdatingProgressBar);
    videoElement.addEventListener('pause', stopUpdatingProgressBar);
    videoElement.addEventListener('ended', stopUpdatingProgressBar);
}

function removeVideoEventListeners(videoElement) {
    videoElement.removeEventListener('play', startUpdatingProgressBar);
    videoElement.removeEventListener('pause', stopUpdatingProgressBar);
    videoElement.removeEventListener('ended', stopUpdatingProgressBar);
}


const shownMessages = new Set();

function showToast(message, position = 'top') {

    // 如果消息已经显示过，则不再弹出
    if (shownMessages.has(message)) {
        return;
    }

    // 将消息加入到已显示的集合中
    shownMessages.add(message);

    const toast = document.createElement('div');
    toast.className = `toast toast-${position}`;
    // toast.textContent = message;
    toast.innerHTML = message;
    document.body.appendChild(toast);

    // 强制触发重绘以激活动画
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    // 1秒后移除提示
    setTimeout(() => {
        toast.classList.remove('show');
        toast.style[position] = '-20px'; // 向上或向下移动提示框
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 500); // 等待动画完成
        // 从已显示的集合中移除该消息，允许再次显示
        shownMessages.delete(message);
    }, 1000);
}

function updateSlidePosition(index) {
    slideList.style.transform = `translateY(-${index * 100}%)`;
}


function removePlayIcon() {
    const watchingFrame = document.querySelector('.frame.watching');
    const playIcon = document.getElementById('play-icon')
    if (playIcon) {
        watchingFrame.removeChild(playIcon);
    }

}

async function playVideo(videoElement) {
    await videoElement.play();
    isPaused = false;
}


async function nextVideo() {
    if (vpointer == videoList.length - 1) {
        // 请求拉取新视频
        if (await getVideos() === 'noMore') {
            showToast('没有更多视频了！', 'bottom');
            console.log('没有更多视频了');
            return;
        }
    }

    //刷新当前视频和即将播放的视频状态
    const slideList = document.querySelector('.slide-list');
    const watchingFrame = document.querySelector('.frame.watching');
    const video = watchingFrame.querySelector('video');
    removeVideoEventListeners(video);

    video.pause();
    removePlayIcon();
    watchingFrame.classList.remove('watching');

    // 获取最后一个 frame
    const lastFrame = slideList.lastElementChild;
    lastFrame.classList.add('watching');
    const lastVideo = lastFrame.querySelector('video');
    lastVideo.muted = isMuted;
    lastVideo.currentTime = 0;
    addVideoEventListeners(lastVideo);
    startUpdatingProgressBar();
    
    playVideo(lastVideo);


    // 如果索引更新后在视频列表范围内，则直接滚动。
    if (vpointer < videoList.length - 1) {
        vpointer++;

        updateSlidePosition(vpointer);
        console.log("当前索引:", vpointer);
        console.log("当前播放的视频:", videoList[vpointer])

        // 如果滚动后的下个视频在视频列表范围内则直接修改dom
        if (videoList[vpointer + 1]) {
            // 获取第一个 frame
            const firstFrame = slideList.firstElementChild;
            const firstVideo = firstFrame.querySelector('video');
            firstVideo.src = videoList[vpointer + 1] || "";
            // 将第一个 frame 移动到 slide-list 的末尾
            slideList.appendChild(firstFrame);
            let currentTop = parseFloat(slideList.style.top);
            const newTop = vpointer * 100 - 100;
            // 设置新的 top 值
            slideList.style.top = `${newTop}%`;
        } else {
            // 不在视频列表内则预加载拉取新视频
            await getVideos();
            // 若没有更多视频，也需要移动frame，始终让观看的视频保持在三个frame中间。
            // 获取第一个 frame
            const firstFrame = slideList.firstElementChild;
            const firstVideo = firstFrame.querySelector('video');
            firstVideo.src = videoList[vpointer + 1] || "";
            // 将第一个 frame 移动到 slide-list 的末尾
            slideList.appendChild(firstFrame);
            let currentTop = parseFloat(slideList.style.top);
            const newTop = vpointer * 100 - 100;
            // 设置新的 top 值
            slideList.style.top = `${newTop}%`;
        }
        console.log(`slideList.style.top = ${slideList.style.top}`);
        setupVideoBufferListener();
    }

}

function prevVideo() {
    if (vpointer == 0) {
        console.log('到头了');
        showToast('已经到顶部了！', 'top');
        return;
    } else if (vpointer > 0) {
        vpointer--;
        const slideList = document.querySelector('.slide-list');
        const watchingFrame = document.querySelector('.frame.watching');
        const video = watchingFrame.querySelector('video');
        removeVideoEventListeners(video);
        video.pause();
        removePlayIcon();
        watchingFrame.classList.remove('watching');

        // 获取第一个 frame
        const firstFrame = slideList.firstElementChild;
        firstFrame.classList.add('watching');
        const firstVideo = firstFrame.querySelector('video');
        firstVideo.muted = isMuted;
        firstVideo.currentTime = 0;

        addVideoEventListeners(firstVideo);
        startUpdatingProgressBar();

        playVideo(firstVideo);

        updateSlidePosition(vpointer);
        console.log("当前索引:", vpointer);
        console.log("当前播放的视频:", videoList[vpointer])

        // 获取最后一个 frame
        const lastFrame = slideList.lastElementChild;
        const lastVideo = lastFrame.querySelector('video');

        // 避免用户再次上滑时索引为-1浏览器报错，可替换为空字符串。
        lastVideo.src = videoList[vpointer - 1] || "";
        // 将最后一个 frame 移动到第一个 frame 前
        slideList.insertBefore(lastFrame, firstFrame);
        let currentTop = parseFloat(slideList.style.top);
        const newTop = vpointer * 100 - 100;
        // 设置新的 top 值
        slideList.style.top = `${newTop}%`;
        console.log(`slideList.style.top = ${slideList.style.top}`);

        setupVideoBufferListener();
    }
}

function checkPlayIcon() {
    const watchingFrame = document.querySelector('.frame.watching');
    if (isPaused) {
        // 创建 img 元素
        const playIcon = document.createElement('img');

        // 设置 img 元素的属性
        // playIcon.src = "static/res/play.png";
        playIcon.src = "data:image/png;base64,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";
        playIcon.className = "play-icon";
        playIcon.id = "play-icon";
        playIcon.alt = "Play Icon";

        // 将 img 元素插入到 <div> 的首部
        watchingFrame.insertBefore(playIcon, watchingFrame.firstChild);
    }
    else {
        const playIcon = document.getElementById('play-icon')
        if (playIcon) {
            watchingFrame.removeChild(playIcon);
        }
    }
}

function togglePlayPause() {
    const watchingFrame = document.querySelector('.frame.watching');
    const video = watchingFrame.querySelector('video');

    if (video.paused) {
        video.play(); // 播放视频
        isPaused = false;
        console.log('视频播放');
    } else {
        video.pause(); // 暂停视频
        isPaused = true;
        console.log('视频暂停');
    }
    checkPlayIcon();
}

/**
 * 获取推荐视频
 * @returns {Promise<Object>} 返回包含视频列表和消息的对象
 */
async function getVideos() {
    console.log("正在获取新视频");
    try {
        const response = await fetch(`${API_BASE_URL}/get-videos`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            }
        });

        if (!response.ok) {
            if (response.status == 401) {
                showToast('用户长时间未活动<br>请重新登录！', 'bottom');

                // 等待提示消失后跳转到登录页面
                setTimeout(() => {
                    window.location.href = '/login';
                }, 2000); // 2秒后跳转，确保提示消失

                throw new Error('会话失效，跳转到登录页面');
            } else {
                throw new Error(response.statusText);
            }
        }

        const data = await response.json();

        if (data.message === "noMore") {
            return data.message;
        } else {
            // 将获取到的视频追加到 videoList 中
            videoList.push(...data.videos); // 使用展开运算符追加
            console.log("当前视频列表:", videoList);
            return data.message;
        }
    } catch (error) {
        console.error("获取视频时出错:", error);
        throw error;
    }
}

const API_BASE_URL = window.location.origin;

let videoList = []
let vpointer = 0; // 当前显示视频的索引
let isMuted = true; // 默认静音
let isPaused = false;

// 缓存 DOM 元素
const slideList = document.querySelector('.slide-list');
const muteButton = document.getElementById('muteButton');
const muteIcon = document.getElementById('muteIcon');
const logoutButton = document.getElementById('logoutButton');

async function logout() {
    try {
        const response = await fetch(`${API_BASE_URL}/logout`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            }
        });

        const data = await response.json();

        if (response.status === 200) {
            window.location.href = "/login";  // 登出成功后跳转到登录页面
        }
    } catch (error) {
        console.log(error);
    }
}

function toggleMute() {
    const watchingFrame = document.querySelector('.frame.watching');
    const video = watchingFrame.querySelector('video');

    if (isMuted) {
        video.muted = false;
        isMuted = false;
        muteButton.classList.remove('muted');
        muteIcon.textContent = '🔊';  // 显示音量图标
        console.log('取消静音');
    } else {
        video.muted = true;
        isMuted = true;
        muteButton.classList.add('muted');
        muteIcon.textContent = '🔇';  // 显示静音图标
        console.log('静音');
    }
}

// 弃用
// function isMobileDevice() {
//     return /Mobi|Android|iPhone|iPad|iPod|BlackBerry|Windows Phone/i.test(navigator.userAgent);
// }

function setViewportHeight() {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
}


// 函数：更新并监听当前的 video 元素
function setupVideoBufferListener() {
    // 查找当前具有 class="frame watching" 的 div
    const watchingFrame = document.querySelector('.frame.watching');
    const loading = watchingFrame.querySelector('#loading');
    
    if (!watchingFrame) return; // 如果没有找到，退出

    // 获取其中的 video 元素
    const videoElement = watchingFrame.querySelector('video');
    
    // 如果没有找到 video 元素，退出
    if (!videoElement) return;

    // 监听 waiting 事件
    videoElement.addEventListener('waiting', () => {
        loading.style.display = 'flex';
    });

    // 监听 canplay 事件
    videoElement.addEventListener('canplay', () => {
        loading.style.display = 'none';
    });
}

//页面首次加载初始化
async function initialize() {

    window.addEventListener('resize', setViewportHeight);
    setViewportHeight();

    await getVideos();

    const watchingFrame = document.querySelector('.frame.watching');
    const video = watchingFrame.querySelector('video');

    video.src = videoList[vpointer];
    window.console.log("当前索引:", vpointer);
    console.log("当前播放的视频:", videoList[vpointer])
    const slideList = document.querySelector('.slide-list');
    const lastFrame = slideList.lastElementChild;
    const lastVideo = lastFrame.querySelector('video');
    lastVideo.src = videoList[vpointer + 1];
    addVideoEventListeners(video); // 添加事件监听
    // 在页面加载时，初始化监听视频缓冲状态
    setupVideoBufferListener();
    playVideo(video);


    // 监听触摸滑动事件
    let touchStartY = 0;
    let touchEndY = 0;

    document.addEventListener('touchstart', (e) => {
        console.log('touchstart', e.touches[0].clientY); // 添加日志
        touchStartY = e.touches[0].clientY;
    });

    document.addEventListener('touchend', (e) => {
        console.log('touchend', e.changedTouches[0].clientY);
        touchEndY = e.changedTouches[0].clientY;
        if (touchStartY - touchEndY > 50) {
            nextVideo(); // 向上滑动 - 切换到下一个视频
        } else if (touchEndY - touchStartY > 50) {
            prevVideo(); // 向下滑动 - 切换到上一个视频
        }
    });

    muteButton.addEventListener('click', toggleMute);
    logoutButton.addEventListener('click', logout);


    // 监听方向键按下事件
    document.addEventListener('keydown', (event) => {
        if (event.code === "ArrowDown") {
            // 下箭头 - 切换到下一个视频
            nextVideo();
        } else if (event.code === "ArrowUp") {
            // 上箭头 - 切换到上一个视频
            prevVideo();
        } else if (event.code === "KeyM") {
            toggleMute();
        } else if (event.code === 'Space') {
            togglePlayPause();
        }
    });

    // 监听滚轮事件
    document.addEventListener('wheel', (event) => {
        if (event.deltaY > 0) {
            // 向下滚动 - 切换到下一个视频
            nextVideo();
        } else if (event.deltaY < 0) {
            // 向上滚动 - 切换到上一个视频
            prevVideo();
        }
    });

    // 添加点击暂停和播放功能
    document.querySelectorAll('.frame').forEach(frame => {
        frame.addEventListener('click', (event) => {
            // 判断点击位置是否在进度条区域内或全屏按钮
            const progressContainer = frame.querySelector('.progress-container');
            const btnFullscreen = frame.querySelector('.btn-fullscreen');
            const isClickOnProgress = event.target === progressContainer;
            const isClickOnbtnFullScreen = event.target === btnFullscreen;
            if (!(isClickOnProgress || isClickOnbtnFullScreen)) {
                togglePlayPause(); // 调用 togglePlayPause 函数
            }
        });
    });

    addProgressBarListeners();

}

// 用于存储鼠标或触摸按下的初始位置
let isDragging = false;

let timeLabel;

// 移动设备专用
let startX = 0;
let initialProgress = 0;

function addProgressBarListeners() {
    const progressContainers = document.querySelectorAll('.progress-container');
    progressContainers.forEach((progressContainer) => {
        // 监听鼠标按下或触摸开始事件
        progressContainer.addEventListener('mousedown', handleProgressBarPress);
        progressContainer.addEventListener('touchstart', handleProgressBarPress2);


        // 监听鼠标移动或触摸移动事件
        document.addEventListener('mousemove', handleProgressBarDrag);
        document.addEventListener('touchmove', handleProgressBarDrag2);

        // 监听鼠标松开或触摸结束事件
        document.addEventListener('mouseup', handleProgressBarRelease);
        document.addEventListener('touchend', handleProgressBarRelease);
    });
}

// 移动设备专用
function handleProgressBarPress2(e) {
    e.preventDefault();
    isDragging = true;
    const watchingFrame = document.querySelector('.frame.watching');
    const video = watchingFrame.querySelector('video');
    const progressBar = watchingFrame.querySelector('.progress-bar');
    const progressContainer = watchingFrame.querySelector('.progress-container');

    // 创建时间标签
    timeLabel = document.createElement('div');
    timeLabel.className = 'time-label';
    watchingFrame.appendChild(timeLabel);

    // 记录初始位置
    if (e.type === 'touchstart') {
        startX = e.touches[0].clientX;
    } else {
        startX = e.clientX;
    }

    const rect = progressContainer.getBoundingClientRect();
    initialProgress = parseFloat(progressBar.style.width) || 0;
    stopUpdatingProgressBar();
    // 更新进度条
    progressBar.style.width = `${initialProgress}%`;

    // 更新时间标签
    updateTimeLabel(video, initialProgress);

}

// 移动设备专用
function handleProgressBarDrag2(e) {
    if (!isDragging) return;
    const watchingFrame = document.querySelector('.frame.watching');
    const video = watchingFrame.querySelector('video');
    const progressBar = watchingFrame.querySelector('.progress-bar');
    const progressContainer = watchingFrame.querySelector('.progress-container');

    let currentX;
    if (e.type === 'touchmove') {
        currentX = e.touches[0].clientX;
    } else {
        currentX = e.clientX;
    }

    const rect = progressContainer.getBoundingClientRect();
    const offsetX = currentX - startX;
    const progressDelta = (offsetX / rect.width) * 100;

    // 计算新的进度
    let newProgress = initialProgress + progressDelta;
    newProgress = Math.max(0, Math.min(100, newProgress));

    // 更新进度条的宽度
    progressBar.style.width = `${newProgress}%`;

    // 更新时间标签
    updateTimeLabel(video, newProgress);
}

function handleProgressBarPress(e) {
    console.log('handleProgressBarPress called');
    e.preventDefault();
    isDragging = true;
    const watchingFrame = document.querySelector('.frame.watching');
    const video = watchingFrame.querySelector('video');
    const progressBar = watchingFrame.querySelector('.progress-bar');
    const progressContainer = watchingFrame.querySelector('.progress-container');

    // 创建时间标签
    timeLabel = document.createElement('div');
    timeLabel.className = 'time-label';
    watchingFrame.appendChild(timeLabel);

    // 计算点击位置对应的进度
    let clickX;
    if (e.type === 'touchstart') {
        clickX = e.touches[0].clientX;
    } else {
        clickX = e.clientX;
    }
    const rect = progressContainer.getBoundingClientRect();
    const progress = ((clickX - rect.left) / rect.width) * 100;


    stopUpdatingProgressBar();

    // 更新进度条
    progressBar.style.width = `${progress}%`;

    // 更新时间标签
    updateTimeLabel(video, progress);
}

function handleProgressBarDrag(e) {
    console.log('handleProgressBarDrag called');
    if (!isDragging) return;
    const watchingFrame = document.querySelector('.frame.watching');
    const video = watchingFrame.querySelector('video');
    const progressBar = watchingFrame.querySelector('.progress-bar');
    const progressContainer = watchingFrame.querySelector('.progress-container');

    let currentX;
    if (e.type === 'touchmove') {
        currentX = e.touches[0].clientX;
    } else {
        currentX = e.clientX;
    }

    const rect = progressContainer.getBoundingClientRect();
    const progress = ((currentX - rect.left) / rect.width) * 100;

    // 确保进度在 0% 到 100% 之间
    const newProgress = Math.max(0, Math.min(100, progress));

    // 更新进度条的宽度
    progressBar.style.width = `${newProgress}%`;

    // 更新时间标签
    updateTimeLabel(video, newProgress);
}

function handleProgressBarRelease(e) {
    console.log('handleProgressBarRelease called');
    if (!isDragging) return;
    isDragging = false;
    const watchingFrame = document.querySelector('.frame.watching');
    const video = watchingFrame.querySelector('video');
    const progressBar = watchingFrame.querySelector('.progress-bar');

    // 获取当前进度条的宽度
    const progress = parseFloat(progressBar.style.width) / 100;

    // 计算视频的新时间
    const newTime = progress * video.duration;

    // 跳转到新的时间
    video.currentTime = newTime;

    startUpdatingProgressBar();

    // 删除时间标签
    if (timeLabel) {
        timeLabel.parentNode.removeChild(timeLabel);
        timeLabel = null;
    }
}

function updateTimeLabel(video, progress) {
    const currentTime = (progress / 100) * video.duration;
    const totalTime = video.duration;

    const formattedCurrentTime = formatTime(currentTime);
    const formattedTotalTime = formatTime(totalTime);

    timeLabel.textContent = `${formattedCurrentTime} / ${formattedTotalTime}`;
}

function formatTime(time) {
    const hours = Math.floor(time / 3600);
    const minutes = Math.floor((time % 3600) / 60);
    const seconds = Math.floor(time % 60);

    let formattedTime = '';
    if (hours > 0) {
        formattedTime += `${padZero(hours)}:`;
    }
    formattedTime += `${padZero(minutes)}:${padZero(seconds)}`;

    return formattedTime;
}

function padZero(num) {
    return num.toString().padStart(2, '0');
}

// 在页面加载完成后添加事件监听器
document.addEventListener('DOMContentLoaded', () => {
    initialize();
});
