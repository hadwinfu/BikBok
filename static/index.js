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

function showToast(message, position = 'top') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${position}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    // 强制触发重绘以激活动画
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    // 3秒后移除提示
    setTimeout(() => {
        toast.classList.remove('show');
        toast.style[position] = '-50px'; // 向上或向下移动提示框
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 500); // 等待动画完成
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
        playIcon.src = "static/play.png";
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
            throw new Error(`获取视频失败: ${response.statusText}`);
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
