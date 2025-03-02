const API_BASE_URL = window.location.origin;

async function login() {
    const presetUsername = "admin";
    const presetPassword = "123456";
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;
    const message = document.getElementById("message");

    // 检查用户名和密码是否为空
    if (!username || !password) {
        message.style.color = "red";
        message.textContent = "用户名和密码不能为空";
        return;  // 如果为空，停止继续执行
    }

    document.getElementById('btn_login').disabled = true;
    document.getElementById('btn_login').textContent = "验证中";
    
    try {
        const response = await fetch(`${API_BASE_URL}/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ username: username, password: password })
        });

        const data = await response.json();

        console.log(data);

        if (response.status === 200) {
            message.style.color = "green";
            message.textContent = "登录成功";
            window.location.href = "/";  // 登录成功后跳转到主页面
        } else {
            message.style.color = "red";
            message.textContent = "用户名或密码错误";
            document.getElementById('btn_login').disabled = false;
            document.getElementById('btn_login').textContent = "登录";
        }
    } catch (error) {
        message.style.color = "red";
        message.textContent = "登录请求失败，请稍后再试";
        document.getElementById('btn_login').disabled = false;
        document.getElementById('btn_login').textContent = "登录";
    }
}

// 检测按下的键，如果是 Enter 键则触发登录
function checkEnter(event) {
    if (event.key === "Enter") {
        login();
    }
}