/* =========================================================
   6. AUTHENTICATION ELEMENTS
========================================================= */

(() => {
    const API_BASE_URL = window.API_BASE_URL;

    const TOKEN_KEY = 'thaiGalleryToken';

    const openButton = document.getElementById('auth-open-button');
    const logoutButton = document.getElementById('auth-logout-button');
    const userMenu = document.getElementById('auth-user-menu');
    const userDashboardLink = document.getElementById('user-dashboard-link');
    const adminDashboardLink = document.getElementById('admin-dashboard-link');

    const modal = document.getElementById('auth-modal');
    const closeButton = document.getElementById('auth-modal-close');

    const loginTab = document.getElementById('auth-choice-login');
    const registerTab = document.getElementById('auth-choice-register');

    const slideTrack = document.getElementById('auth-slide-track');
    const loginForm = document.getElementById('auth-login-form');
    const registerForm = document.getElementById('auth-register-form');

    const loginMessage = document.getElementById('login-message');
    const registerMessage = document.getElementById('register-message');

    const loginSubmit = document.getElementById('auth-login-submit');
    const registerSubmit = document.getElementById('auth-register-submit');

    // ตรวจสอบองค์ประกอบที่จำเป็น ป้องกัน JavaScript ทำงานต่อเมื่อ HTML ไม่ครบ
    if (
        !openButton ||
        !logoutButton ||
        !modal ||
        !closeButton ||
        !loginTab ||
        !registerTab ||
        !slideTrack ||
        !loginForm ||
        !registerForm ||
        !loginMessage ||
        !registerMessage ||
        !loginSubmit ||
        !registerSubmit
    ) {
        console.error(
            'Authentication: ไม่พบองค์ประกอบที่จำเป็น กรุณาตรวจสอบ gallery.html'
        );

        return;
    }

    let previousFocus = null;
    let activeView = 'login';

    // สถานะผู้ใช้ที่ยืนยันตัวตนกับ Backend แล้ว
    let currentUser = null;

    // ป้องกันการตรวจสอบ Token ซ้อนกันหลายครั้ง
    let authCheckInProgress = false;


/* =========================================================
   7. LOGIN / REGISTER MODAL
========================================================= */

    // สลับฟอร์ม พร้อมอัปเดต ARIA และป้องกันฟอร์มที่ซ่อนอยู่
    function showView(view, focusInput = true) {
        activeView = view;

        const isLogin = view === 'login';

        loginTab.classList.toggle('is-active', isLogin);
        registerTab.classList.toggle('is-active', !isLogin);

        loginTab.setAttribute('aria-selected', String(isLogin));
        registerTab.setAttribute('aria-selected', String(!isLogin));

        slideTrack.classList.toggle('show-register', !isLogin);

        loginForm.inert = !isLogin;
        registerForm.inert = isLogin;

        if (focusInput) {
            const targetForm = isLogin ? loginForm : registerForm;
            targetForm.querySelector('input')?.focus();
        }
    }

    // เปิดหน้าต่างได้เฉพาะผู้ที่ยังไม่ได้เข้าสู่ระบบ
    function openAuthModal() {
        if (currentUser || sessionStorage.getItem(TOKEN_KEY)) {
            return;
        }

        previousFocus = document.activeElement;

        modal.hidden = false;
        document.body.style.overflow = 'hidden';

        showView('login', false);
        closeButton.focus();
    }

    // ปิดหน้าต่างและคืนการโฟกัส
    function closeAuthModal() {
        modal.hidden = true;
        document.body.style.overflow = '';

        if (previousFocus && typeof previousFocus.focus === 'function') {
            previousFocus.focus();
        }
    }

    openButton.addEventListener('click', openAuthModal);
    closeButton.addEventListener('click', closeAuthModal);

    loginTab.addEventListener('click', () => {
        // หากมี Token อยู่ จะไม่อนุญาตให้เปิดหน้าสมาชิกซ้ำ
        if (currentUser || sessionStorage.getItem(TOKEN_KEY)) {
            return;
        }

        showView('login');
    });

    registerTab.addEventListener('click', () => {
        if (currentUser || sessionStorage.getItem(TOKEN_KEY)) {
            return;
        }

        showView('register');
    });

    // คลิกพื้นหลังเพื่อปิดหน้าต่าง
    modal.addEventListener('click', event => {
        if (event.target === modal) {
            closeAuthModal();
        }
    });

    // รองรับ Escape และการสลับแท็บด้วยลูกศร
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && !modal.hidden) {
            closeAuthModal();
        }

        if (
            event.key === 'ArrowRight' &&
            document.activeElement === loginTab &&
            !currentUser
        ) {
            event.preventDefault();
            showView('register');
            registerTab.focus();
        }

        if (
            event.key === 'ArrowLeft' &&
            document.activeElement === registerTab &&
            !currentUser
        ) {
            event.preventDefault();
            showView('login');
            loginTab.focus();
        }
    });


/* =========================================================
   8. AUTH BUTTON STATE
========================================================= */

    // เปลี่ยนปุ่มใน Header ให้ตรงกับสถานะสมาชิก
    function updateAuthButtons() {
        const isLoggedIn = Boolean(currentUser);

        openButton.hidden = isLoggedIn;
        userMenu.hidden = !isLoggedIn;

        // แสดงลิงก์ User Dashboard เฉพาะเมื่อเข้าสู่ระบบแล้ว
        if (userDashboardLink) {
            userDashboardLink.hidden = !isLoggedIn;
        }

        logoutButton.hidden = !isLoggedIn;

        if (adminDashboardLink) {
            adminDashboardLink.hidden =
                !isLoggedIn || currentUser.role !== 'admin';
        }

        // ซ่อนแท็บสมัครสมาชิกและเข้าสู่ระบบเมื่อ Login แล้ว
        loginTab.disabled = isLoggedIn;
        registerTab.disabled = isLoggedIn;

        if (isLoggedIn && !modal.hidden) {
            closeAuthModal();
        }
    }

    // ล้าง Token และสถานะผู้ใช้
    function clearAuthState() {
        sessionStorage.removeItem(TOKEN_KEY);

        currentUser = null;

        updateAuthButtons();
    }

    // ผูก Listener เพียงครั้งเดียวเพื่อไม่ให้เกิดการ Logout ซ้ำ
    logoutButton.addEventListener('click', () => {
        clearAuthState();

        // รีเซ็ตข้อความในฟอร์มหลังออกจากระบบ
        loginMessage.textContent = '';
        registerMessage.textContent = '';

        loginForm.reset();
        registerForm.reset();

        showView('login', false);

        // แจ้งสถานะให้ผู้ใช้ทราบ
        openButton.focus();
    });


/* =========================================================
   9. VERIFY TOKEN AND USER
========================================================= */

    // ตรวจสอบ Token กับ Backend ทุกครั้งที่ต้องยืนยันตัวตน
    async function verifyCurrentUser() {
        const token = sessionStorage.getItem(TOKEN_KEY);

        if (!token) {
            currentUser = null;
            updateAuthButtons();

            return null;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            // Token หมดอายุหรือไม่ถูกต้อง ให้ล้างสถานะที่เก็บไว้
            if (!response.ok) {
                clearAuthState();
                return null;
            }

            const user = await response.json();

            if (!user || !user.id || !user.role) {
                clearAuthState();
                return null;
            }

            currentUser = user;
            updateAuthButtons();

            return user;

        } catch (error) {
            // กรณี Backend ติดต่อไม่ได้ ไม่ควรแสดง Dashboard
            console.error('ตรวจสอบสถานะสมาชิกไม่สำเร็จ:', error);

            currentUser = null;
            updateAuthButtons();

            // ไม่ลบ Token เมื่อเป็นปัญหาเครือข่ายชั่วคราว
            return null;
        }
    }


/* =========================================================
   10. LOGIN FORM
========================================================= */

    loginForm.addEventListener('submit', async event => {
        event.preventDefault();

        if (currentUser || authCheckInProgress) {
            return;
        }

        loginMessage.textContent = '';

        loginSubmit.disabled = true;
        loginSubmit.textContent = 'กำลังเข้าสู่ระบบ...';

        try {
            const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username: loginForm
                        .querySelector('[name="username"]')
                        .value.trim(),

                    password: loginForm
                        .querySelector('[name="password"]')
                        .value
                })
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                if (response.status === 429) {
                    throw new Error(
                        'ลองเข้าสู่ระบบหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่'
                    );
                }

                if (response.status === 401) {
                    throw new Error('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
                }

                throw new Error(data.message || 'เข้าสู่ระบบไม่สำเร็จ');
            }

            if (typeof data.token !== 'string' || !data.token) {
                throw new Error('เซิร์ฟเวอร์ไม่ได้ส่ง Token กลับมา');
            }

            // เก็บ Token ก่อน แล้วตรวจสอบข้อมูลผู้ใช้กับ Backend
            sessionStorage.setItem(TOKEN_KEY, data.token);

            authCheckInProgress = true;

            const user = await verifyCurrentUser();

            if (!user) {
                throw new Error(
                    'เข้าสู่ระบบแล้วแต่ตรวจสอบข้อมูลสมาชิกไม่ได้ กรุณาลองใหม่'
                );
            }

            loginMessage.textContent = 'เข้าสู่ระบบสำเร็จ';

            // เมื่อยืนยันตัวตนสำเร็จ ปิดหน้าต่างและอัปเดตหน้า
            closeAuthModal();

        } catch (error) {
            // หาก Login รอบนี้ล้มเหลวหลังเก็บ Token ให้ล้างสถานะ
            if (!currentUser) {
                sessionStorage.removeItem(TOKEN_KEY);
            }

            loginMessage.textContent =
                error instanceof TypeError
                    ? 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบว่า Backend กำลังทำงาน'
                    : error.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่';

            updateAuthButtons();

        } finally {
            authCheckInProgress = false;

            loginSubmit.disabled = false;
            loginSubmit.textContent = 'เข้าสู่ระบบ';
        }
    });


/* =========================================================
   11. REGISTER FORM
========================================================= */

    registerForm.addEventListener('submit', async event => {
        event.preventDefault();

        // ป้องกันการสมัครจากฟอร์มเมื่อมีสถานะ Login
        if (currentUser || sessionStorage.getItem(TOKEN_KEY)) {
            registerMessage.textContent =
                'คุณเข้าสู่ระบบอยู่แล้ว กรุณาออกจากระบบก่อน';

            return;
        }

        registerMessage.textContent = '';

        registerSubmit.disabled = true;
        registerSubmit.textContent = 'กำลังสมัครสมาชิก...';

        try {
            const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username: registerForm
                        .querySelector('[name="username"]')
                        .value.trim(),

                    password: registerForm
                        .querySelector('[name="password"]')
                        .value
                })
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                if (response.status === 400) {
                    throw new Error(
                        data.message === 'Username already exists'
                            ? 'ชื่อผู้ใช้นี้มีผู้ใช้แล้ว กรุณาเลือกชื่อใหม่'
                            : 'กรุณาตรวจสอบชื่อผู้ใช้และรหัสผ่าน'
                    );
                }

                throw new Error(data.message || 'สมัครสมาชิกไม่สำเร็จ');
            }

            registerForm.reset();

            showView('login', false);

            loginMessage.textContent =
                'สมัครสมาชิกสำเร็จ กรุณาเข้าสู่ระบบ';

            loginForm
                .querySelector('[name="username"]')
                .focus();

        } catch (error) {
            registerMessage.textContent =
                error instanceof TypeError
                    ? 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบว่า Backend กำลังทำงาน'
                    : error.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่';

        } finally {
            registerSubmit.disabled = false;
            registerSubmit.textContent = 'สมัครสมาชิก';
        }
    });


/* =========================================================
   13. INITIAL AUTHENTICATION CHECK
========================================================= */

    currentUser = null;
    updateAuthButtons();
    showView('login', false);

    // เมื่อเปิดหน้าเว็บ ให้ตรวจสอบ Token ที่มีอยู่ก่อน
    (async () => {
        await verifyCurrentUser();
    })();

})();
