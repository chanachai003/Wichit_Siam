// เก็บตัวแปรและการทำงานของหน้า Dashboard ไว้ภายใน scope เดียว
(() => {
    const API_BASE_URL = 'http://localhost:4000';
    const TOKEN_KEY = 'thaiGalleryToken';
    const welcome = document.getElementById('user-dashboard-welcome');
    const message = document.getElementById('user-dashboard-message');
    const photoCount = document.getElementById('user-photo-count');
    const photoList = document.getElementById('user-photo-list');
    const adminDashboardLink = document.getElementById('admin-dashboard-link');
    const logoutButton = document.getElementById('user-dashboard-logout');
    const openFormButton = document.getElementById('open-photo-form');
    const dialog = document.getElementById('photo-upload-dialog');
    const form = document.getElementById('photo-upload-form');
    const cancelButton = document.getElementById('cancel-photo-form');
    const submitButton = document.getElementById('submit-photo-form');
    const uploadMessage = document.getElementById('photo-upload-message');
    const latInput = document.getElementById('photo-latitude');
    const lngInput = document.getElementById('photo-longitude');

    let currentUser = null;
    let isDeleting = false;
    let isUploading = false;
    let uploadMap = null;
    let uploadMarker = null;

    // แสดงข้อผิดพลาดและล้างข้อมูลรายการภาพถ่ายที่แสดงอยู่
    function showError(text) {
        welcome.textContent = '';
        message.textContent = text;
        photoCount.textContent = '';
        photoList.replaceChildren();
    }

    // ยืนยันก่อนออกจากระบบเมื่อมีข้อมูลในฟอร์มที่ยังไม่ได้บันทึก
    logoutButton.addEventListener('click', () => {
        if (dialog.open) {
            if (!window.confirm('กำลังอยู่ในฟอร์มโพสต์รูป ต้องการออกจากระบบและทิ้งข้อมูลที่ยังไม่ได้บันทึกหรือไม่?')) {
                return;
            }
            resetForm();
            dialog.close();
        }
        sessionStorage.removeItem(TOKEN_KEY);
        window.location.href = '../gallery.html';
    });

    // เปิดฟอร์มโพสต์รูปและเตรียมแผนที่เมื่อผู้ใช้ยืนยันตัวตนแล้ว
    openFormButton.addEventListener('click', () => {
        if (!sessionStorage.getItem(TOKEN_KEY) || !currentUser) {
            window.alert('กรุณาเข้าสู่ระบบก่อนโพสต์รูป');
            return;
        }
        resetForm();
        dialog.showModal();
        initializeMap();

        // ปรับขนาดแผนที่หลัง dialog แสดงผลแล้ว
        window.setTimeout(() => uploadMap && uploadMap.invalidateSize(), 100);
    });

    // ยกเลิกการโพสต์หลังยืนยันการทิ้งข้อมูลในฟอร์ม
    cancelButton.addEventListener('click', () => {
        if (isUploading) return;
        if (!window.confirm('ต้องการยกเลิกโพสต์นี้และทิ้งข้อมูลที่กรอกไว้ใช่หรือไม่?\nข้อมูลที่ยังไม่ได้อัปโหลดจะหายไป')) {
            return;
        }
        resetForm();
        dialog.close();
    });

    // ป้องกันการปิด dialog ระหว่างอัปโหลดหรือเมื่อผู้ใช้ยกเลิกการยืนยัน
    dialog.addEventListener('cancel', event => {
        if (isUploading) {
            event.preventDefault();
            return;
        }
        if (!window.confirm('ต้องการกลับออกจากฟอร์มและทิ้งข้อมูลที่กรอกไว้หรือไม่?')) {
            event.preventDefault();
        } else {
            resetForm();
        }
    });

    // สร้างแผนที่สำหรับเลือกตำแหน่ง และลงทะเบียนการคลิกเพื่อปักหมุด
    function initializeMap() {
        if (uploadMap) {
            // ปรับขนาดแผนที่ที่มีอยู่ก่อนแสดงผล
            window.setTimeout(() => uploadMap.invalidateSize(), 100);
            return;
        }
        if (typeof L === 'undefined') {
            uploadMessage.textContent = 'โหลดแผนที่ไม่สำเร็จ กรุณารีเฟรชหน้าเว็บ';
            return;
        }

        uploadMap = L.map('photo-location-map').setView([13.7, 100.5], 6);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap'
        }).addTo(uploadMap);

        // นำพิกัดจากจุดที่คลิกไปแสดงในช่องพิกัดและบนแผนที่
        uploadMap.on('click', event => setCoordinates(event.latlng.lat, event.latlng.lng, true));
    }

    // ตรวจสอบพิกัด อัปเดตช่องกรอก และขยับหมุดบนแผนที่
    function setCoordinates(latitude, longitude, panMap) {
        const lat = Number(latitude);
        const lng = Number(longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            return;
        }

        latInput.value = lat.toFixed(6);
        lngInput.value = lng.toFixed(6);
        if (uploadMap) {
            const point = [lat, lng];
            if (!uploadMarker) {
                uploadMarker = L.marker(point).addTo(uploadMap);
            } else {
                uploadMarker.setLatLng(point);
            }
            if (panMap) uploadMap.panTo(point);
        }
    }

    // ซิงก์ค่าพิกัดที่ผู้ใช้กรอกเข้ากับตำแหน่งหมุดบนแผนที่
    function syncMarker() {
        if (latInput.value === '' || lngInput.value === '') return;
        setCoordinates(latInput.value, lngInput.value, false);
    }

    latInput.addEventListener('change', syncMarker);
    lngInput.addEventListener('change', syncMarker);

    // ล้างฟอร์ม ข้อความแจ้งเตือน และหมุดตำแหน่งหลังจบการทำงาน
    function resetForm() {
        form.reset();
        uploadMessage.textContent = '';
        if (uploadMarker && uploadMap) uploadMap.removeLayer(uploadMarker);
        uploadMarker = null;
        latInput.value = '';
        lngInput.value = '';
    }

    // ตรวจสอบข้อมูล ยืนยัน และส่งรูปภาพใหม่ไปยัง API
    form.addEventListener('submit', async event => {
        event.preventDefault();
        if (isUploading || !form.reportValidity()) return;
        const token = sessionStorage.getItem(TOKEN_KEY);
        if (!token || !currentUser) { window.alert('เซสชันไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่'); return; }

        const lat = Number(latInput.value);
        const lng = Number(lngInput.value);
        if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
            uploadMessage.textContent = 'กรุณาตรวจสอบพิกัด Latitude และ Longitude';
            return;
        }

        const confirmed = window.confirm(
            `ยืนยันการโพสต์รูปภาพ\nชื่อภาพ: ${form.elements.title.value.trim()}\nจังหวัด: ${form.elements.province.value.trim()}\n\nกด “ตกลง” เพื่ออัปโหลด หรือ “ยกเลิก” เพื่อกลับไปแก้ไขข้อมูล`
        );
        if (!confirmed) {
            uploadMessage.textContent = 'ยังไม่ได้โพสต์ คุณสามารถแก้ไขข้อมูลแล้วกดโพสต์อีกครั้ง';
            return;
        }
        if (sessionStorage.getItem(TOKEN_KEY) !== token) {
            uploadMessage.textContent = 'สถานะสมาชิกเปลี่ยนแปลง กรุณาเข้าสู่ระบบใหม่';
            return;
        }

        isUploading = true;
        submitButton.disabled = true;
        cancelButton.disabled = true;
        submitButton.textContent = 'กำลังอัปโหลด...';
        uploadMessage.textContent = 'กำลังอัปโหลดรูปภาพ กรุณาอย่าปิดหน้าต่างนี้';
        try {
            const response = await fetch(`${API_BASE_URL}/api/photos`, {
                method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: new FormData(form)
            });
            if (response.status === 401) {
                sessionStorage.removeItem(TOKEN_KEY);
                throw new Error('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');
            }
            let result = {};
            try {
                result = await response.json();
            } catch {}
            if (!response.ok) {
                throw new Error(result.message || 'โพสต์รูปไม่สำเร็จ กรุณาตรวจสอบข้อมูลและลองใหม่');
            }
            if (sessionStorage.getItem(TOKEN_KEY) !== token) {
                throw new Error('สถานะสมาชิกเปลี่ยนแปลง กรุณาตรวจสอบการเข้าสู่ระบบอีกครั้ง');
            }

            resetForm();
            dialog.close();
            await loadMyPhotos(token);
            message.textContent = 'โพสต์รูปสำเร็จ รูปภาพถูกเพิ่มในรายการของคุณแล้ว';
            window.alert('โพสต์รูปสำเร็จ!');
        } catch (error) {
            console.error('Upload photo:', error);
            uploadMessage.textContent = error.message || 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่';
        } finally {
            isUploading = false;
            submitButton.disabled = false;
            cancelButton.disabled = false;
            submitButton.textContent = 'โพสต์รูป';
        }
    });

    // สร้างปุ่มลบสำหรับภาพและจัดการการเรียก API เมื่อต้องการลบ
    function createDeleteButton(photo, token) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = 'ลบภาพ';
        button.className = 'user-photo-delete';

        // ตรวจสอบการยืนยันตัวตนก่อนลบภาพและรีเฟรชรายการหลังลบสำเร็จ
        button.addEventListener('click', async () => {
            if (isDeleting) return;
            if (!window.confirm(`ต้องการลบภาพ "${photo.title || 'ไม่มีชื่อภาพ'}" ใช่หรือไม่?\nการลบนี้ไม่สามารถย้อนกลับได้`)) {
                return;
            }
            if (sessionStorage.getItem(TOKEN_KEY) !== token) {
                showError('สถานะสมาชิกเปลี่ยนแปลง กรุณาเข้าสู่ระบบใหม่');
                return;
            }

            isDeleting = true;
            button.disabled = true;
            button.textContent = 'กำลังลบ...';
            message.textContent = '';
            try {
                const response = await fetch(`${API_BASE_URL}/api/photos/${encodeURIComponent(photo.id)}`, {
                    method: 'DELETE', headers: { Authorization: `Bearer ${token}` }
                });
                if (response.status === 401) {
                    sessionStorage.removeItem(TOKEN_KEY);
                    showError('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');
                    return;
                }
                if (response.status === 403) {
                    message.textContent = 'ไม่มีสิทธิ์ลบภาพนี้ กรุณารีเฟรชหน้าเพื่อตรวจสอบข้อมูล';
                    return;
                }
                if (response.status === 404) {
                    message.textContent = 'ไม่พบภาพนี้แล้ว กรุณารีเฟรชรายการภาพ';
                    return;
                }
                if (!response.ok) {
                    let errorMessage = 'ลบภาพไม่สำเร็จ กรุณาลองใหม่';
                    try {
                        const result = await response.json();
                        if (result.message) errorMessage = result.message;
                    } catch {}
                    throw new Error(errorMessage);
                }
                if (sessionStorage.getItem(TOKEN_KEY) !== token) {
                    showError('สถานะสมาชิกเปลี่ยนแปลง กรุณาเข้าสู่ระบบใหม่');
                    return;
                }
                message.textContent = 'ลบภาพสำเร็จ';
                await loadMyPhotos(token);
            } catch (error) {
                console.error('Delete photo:', error);
                message.textContent = error.message || 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่';
            } finally {
                isDeleting = false;
            }
        });
        return button;
    }

    // โหลดภาพของผู้ใช้ที่ยืนยันตัวตนแล้วและแสดงเป็นการ์ดในรายการ
    async function loadMyPhotos(token) {
        photoCount.textContent = 'กำลังโหลดภาพถ่าย...';
        photoList.replaceChildren();
        const response = await fetch(`${API_BASE_URL}/api/photos/my`, { headers: { Authorization: `Bearer ${token}` } });
        if (response.status === 401) {
            sessionStorage.removeItem(TOKEN_KEY);
            showError('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');
            return;
        }
        if (response.status === 403) {
            showError('ไม่มีสิทธิ์เข้าถึงข้อมูลนี้');
            return;
        }
        if (!response.ok) throw new Error('ไม่สามารถโหลดภาพถ่ายได้ กรุณาลองใหม่');
        const photos = await response.json();
        if (!Array.isArray(photos)) throw new Error('รูปแบบข้อมูลภาพถ่ายไม่ถูกต้อง');
        if (sessionStorage.getItem(TOKEN_KEY) !== token) {
            showError('สถานะสมาชิกเปลี่ยนแปลง กรุณาเข้าสู่ระบบใหม่');
            return;
        }
        photoCount.textContent = `ภาพถ่ายของฉันทั้งหมด ${photos.length} ภาพ`;
        photoList.replaceChildren();
        if (photos.length === 0) {
            const empty = document.createElement('p');
            empty.textContent = 'คุณยังไม่มีภาพถ่ายในระบบ';
            photoList.appendChild(empty);
            return;
        }
        // สร้างการ์ดภาพแต่ละรายการพร้อมข้อมูลและปุ่มลบ
        photos.forEach(photo => {
            const card = document.createElement('article');
            card.className = 'gallery-card';
            const image = document.createElement('img');
            image.src = `${API_BASE_URL}${photo.image_url}`;
            image.alt = photo.title || 'ภาพถ่ายของฉัน';
            image.loading = 'lazy';
            // แสดงข้อความสำรองเมื่อโหลดรูปภาพไม่สำเร็จ
            image.addEventListener('error', () => {
                image.alt = 'ไม่สามารถโหลดรูปภาพได้';
                image.removeAttribute('src');
            }, { once: true });
            const content = document.createElement('div');
            content.className = 'gallery-card-content';
            const title = document.createElement('h3');
            title.textContent = photo.title || 'ไม่มีชื่อภาพ';
            const location = document.createElement('p');
            location.textContent = `📍 ${photo.province || 'ไม่ระบุจังหวัด'}`;
            const region = document.createElement('p');
            region.textContent = `ภูมิภาค: ${photo.region || 'ไม่ระบุ'}`;
            const date = document.createElement('p');
            date.textContent = `📅 ${photo.date || 'ไม่ระบุวันที่'}`;
            content.append(title, location, region, date, createDeleteButton(photo, token));
            card.append(image, content);
            photoList.appendChild(card);
        });
    }

    // ตรวจสอบเซสชัน โหลดข้อมูลผู้ใช้ และเริ่มแสดงรายการภาพถ่าย
    async function initializeDashboard() {
        const token = sessionStorage.getItem(TOKEN_KEY);
        if (!token) {
            openFormButton.disabled = true;
            showError('กรุณาเข้าสู่ระบบก่อนใช้งาน User Dashboard');
            return;
        }

        try {
            const authResponse = await fetch(`${API_BASE_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
            if (authResponse.status === 401) {
                sessionStorage.removeItem(TOKEN_KEY);
                openFormButton.disabled = true;
                showError('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');
                return;
            }
            if (!authResponse.ok) {
                openFormButton.disabled = true;
                showError('ตรวจสอบสถานะสมาชิกไม่สำเร็จ');
                return;
            }
            const user = await authResponse.json();
            if (!user || !user.id || !user.role || sessionStorage.getItem(TOKEN_KEY) !== token) {
                openFormButton.disabled = true;
                showError('ไม่สามารถยืนยันตัวตนได้ กรุณาเข้าสู่ระบบใหม่');
                return;
            }
            currentUser = user;
            adminDashboardLink.hidden = user.role !== 'admin';
            welcome.textContent = `ยินดีต้อนรับ ${user.username || 'สมาชิก'}`;
            message.textContent = '';
            await loadMyPhotos(token);
        } catch (error) {
            console.error('User Dashboard:', error);
            openFormButton.disabled = true;
            showError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ หรือโหลดข้อมูลไม่สำเร็จ');
        }
    }
    initializeDashboard();
})();
