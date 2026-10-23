const API_BASE_URL = window.API_BASE_URL;
const TOKEN_KEY = 'thaiGalleryToken';

const welcome = document.getElementById('admin-welcome');
const photoCount = document.getElementById('admin-photo-count');
const photoList = document.getElementById('admin-photo-list');
const logoutButton = document.getElementById('admin-logout-button');

logoutButton.addEventListener('click', () => {
    sessionStorage.removeItem(TOKEN_KEY);
    window.location.replace('../gallery.html');
});

function leaveAdminDashboard(message) {
    if (message) {
        welcome.textContent = message;
    }

    sessionStorage.removeItem(TOKEN_KEY);
    window.location.replace('../gallery.html');
}

async function loadAdminDashboard() {
    const token = sessionStorage.getItem(TOKEN_KEY);

    if (!token) {
        leaveAdminDashboard('กรุณาเข้าสู่ระบบด้วยบัญชี Admin');
        return;
    }

    try {
        const userResponse = await fetch(`${API_BASE_URL}/api/auth/me`, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        if (userResponse.status === 401 || userResponse.status === 403) {
            leaveAdminDashboard('เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง');
            return;
        }

        if (!userResponse.ok) {
            throw new Error('ไม่สามารถตรวจสอบสิทธิ์ผู้ใช้ได้');
        }

        const user = await userResponse.json();

        if (!user || !user.id || user.role !== 'admin') {
            welcome.textContent = 'บัญชีนี้ไม่มีสิทธิ์เข้าถึงหน้า Admin';
            window.location.replace('../gallery.html');
            return;
        }

        welcome.textContent = `ยินดีต้อนรับ Admin: ${user.username || ''}`;
        await renderPhotos(token);

    } catch (error) {
        console.error('Admin Dashboard:', error);
        welcome.textContent =
            error instanceof TypeError
                ? 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่ภายหลัง'
                : error.message || 'เกิดข้อผิดพลาดขณะโหลดหน้า Admin';
        photoList.textContent = 'ไม่สามารถโหลดข้อมูล Admin ได้ กรุณาลองใหม่';
    }
}

async function renderPhotos(token) {
    photoCount.textContent = 'กำลังโหลด...';
    photoList.textContent = 'กำลังโหลดรายการรูปภาพ...';

    const response = await fetch(`${API_BASE_URL}/api/photos/admin/all`, {
        headers: {
            Authorization: `Bearer ${token}`
        }
    });

    if (response.status === 401 || response.status === 403) {
        leaveAdminDashboard('เซสชันหมดอายุหรือไม่มีสิทธิ์เข้าถึง');
        return;
    }

    if (!response.ok) {
        throw new Error('ไม่สามารถโหลดรูปภาพได้');
    }

    const photos = await response.json();

    if (!Array.isArray(photos)) {
        throw new Error('รูปแบบข้อมูลรูปภาพจาก Admin API ไม่ถูกต้อง');
    }

    if (sessionStorage.getItem(TOKEN_KEY) !== token) {
        window.location.replace('../gallery.html');
        return;
    }

    photoCount.textContent = `พบ ${photos.length} ภาพ`;
    photoList.replaceChildren();

    if (photos.length === 0) {
        photoList.textContent = 'ยังไม่มีรูปภาพในระบบ';
        return;
    }

    const table = document.createElement('table');
    const header = table.createTHead().insertRow();

    ['ID', 'ชื่อภาพ', 'จังหวัด', 'ผู้เพิ่ม', 'จัดการ']
        .forEach(label => {
            const th = document.createElement('th');
            th.textContent = label;
            header.appendChild(th);
        });

    const body = table.createTBody();

    photos.forEach(photo => {
        const row = body.insertRow();

        [
            photo.id,
            photo.title,
            photo.province,
            photo.created_by_username || 'ไม่ทราบ'
        ].forEach(value => {
            const cell = row.insertCell();
            cell.textContent = value ?? '';
        });

        const actionCell = row.insertCell();
        const deleteButton = document.createElement('button');

        deleteButton.type = 'button';
        deleteButton.textContent = 'ลบรูป';
        deleteButton.addEventListener('click', async () => {
            if (!window.confirm(
                `ต้องการลบรูป "${photo.title || 'ไม่มีชื่อภาพ'}" ใช่หรือไม่?\n` +
                'การลบนี้ไม่สามารถย้อนกลับได้'
            )) {
                return;
            }

            const currentToken = sessionStorage.getItem(TOKEN_KEY);

            if (!currentToken) {
                leaveAdminDashboard('กรุณาเข้าสู่ระบบใหม่');
                return;
            }

            deleteButton.disabled = true;
            deleteButton.textContent = 'กำลังลบ...';

            try {
                const deleteResponse = await fetch(
                    `${API_BASE_URL}/api/photos/${photo.id}`,
                    {
                        method: 'DELETE',
                        headers: {
                            Authorization: `Bearer ${currentToken}`
                        }
                    }
                );

                if (
                    deleteResponse.status === 401 ||
                    deleteResponse.status === 403
                ) {
                    leaveAdminDashboard(
                        'เซสชันหมดอายุหรือไม่มีสิทธิ์ลบรูป'
                    );
                    return;
                }

                if (!deleteResponse.ok) {
                    throw new Error('ลบรูปไม่สำเร็จ');
                }

                await loadAdminDashboard();

            } catch (error) {
                console.error('Delete photo:', error);
                welcome.textContent =
                    error.message || 'เกิดข้อผิดพลาดขณะลบรูป';

            } finally {
                deleteButton.disabled = false;
                deleteButton.textContent = 'ลบรูป';
            }
        });

        actionCell.appendChild(deleteButton);
    });

    photoList.appendChild(table);
}

loadAdminDashboard();
