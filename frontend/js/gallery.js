/* =========================================================
   1. MAP INITIALIZATION
========================================================= */

// สร้างแผนที่ประเทศไทย
const map = L.map('map').setView([13.7, 100.5], 6);

let markers = [];
let allPhotos = [];

let currentRegion = 'all';
let currentProvinceSearch = '';

function enablePopupTouchDrag(popupElement) {
    let activeTouchId = null;
    let startPoint = null;
    let lastPoint = null;
    let isDragging = false;

    const resetTouch = () => {
        activeTouchId = null;
        startPoint = null;
        lastPoint = null;
        isDragging = false;
    };

    const handleTouchStart = event => {
        if (event.touches.length !== 1 || !map.dragging.enabled()) {
            resetTouch();
            return;
        }

        const touch = event.touches[0];
        activeTouchId = touch.identifier;
        startPoint = { x: touch.clientX, y: touch.clientY };
        lastPoint = startPoint;
        isDragging = false;
    };

    const handleTouchMove = event => {
        if (activeTouchId === null) {
            return;
        }

        const touch = Array.from(event.touches)
            .find(item => item.identifier === activeTouchId);

        if (!touch) {
            return;
        }

        const point = { x: touch.clientX, y: touch.clientY };

        if (!isDragging) {
            const distance = Math.hypot(
                point.x - startPoint.x,
                point.y - startPoint.y
            );

            if (distance < 4) {
                return;
            }

            isDragging = true;
        }

        if (event.cancelable) {
            event.preventDefault();
        }

        map.panBy([
            lastPoint.x - point.x,
            lastPoint.y - point.y
        ], { animate: false });

        lastPoint = point;
    };

    const handleTouchEnd = event => {
        const touchEnded = Array.from(event.changedTouches)
            .some(touch => touch.identifier === activeTouchId);

        if (touchEnded || event.touches.length === 0) {
            resetTouch();
        }
    };

    popupElement.addEventListener('touchstart', handleTouchStart, {
        passive: true
    });
    document.addEventListener('touchmove', handleTouchMove, {
        passive: false
    });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });
    document.addEventListener('touchcancel', handleTouchEnd, {
        passive: true
    });

    return () => {
        popupElement.removeEventListener('touchstart', handleTouchStart);
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleTouchEnd);
        document.removeEventListener('touchcancel', handleTouchEnd);
    };
}

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
}).addTo(map);


/* =========================================================
   2. LOAD PHOTOS
========================================================= */

const gallery = document.getElementById('gallery');
const API_BASE_URL = window.API_BASE_URL;

let isLoadingPhotos = false;
let photosLoadFailed = false;

// โหลดภาพถ่ายจาก API สาธารณะ
async function loadPhotos() {
    if (isLoadingPhotos) {
        return;
    }

    isLoadingPhotos = true;

    const retryButton = document.getElementById('retry-load-photos');

    if (retryButton) {
        retryButton.disabled = true;
        retryButton.textContent = 'กำลังโหลด...';
    }

    gallery.innerHTML = `
        <div class="gallery-empty" role="status" aria-live="polite">
            <div class="gallery-empty-icon" aria-hidden="true">⏳</div>
            <h3>กำลังโหลดรูปภาพ...</h3>
            <p>กรุณารอสักครู่</p>
        </div>
    `;

    try {
        const response = await fetch(`${API_BASE_URL}/api/photos`);

        if (!response.ok) {
            throw new Error('ไม่สามารถโหลดรูปภาพได้');
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
            throw new Error('รูปแบบข้อมูลรูปภาพไม่ถูกต้อง');
        }

        allPhotos = data;
        photosLoadFailed = false;

        applyFilters();

    } catch (error) {
        console.error('Failed to load photos:', error);

        photosLoadFailed = true;

        gallery.innerHTML = `
            <div class="gallery-empty" role="alert">
                <div class="gallery-empty-icon" aria-hidden="true">
                    ⚠️
                </div>

                <h3>ไม่สามารถโหลดข้อมูลได้</h3>
                <p>กรุณาตรวจสอบการเชื่อมต่อแล้วลองใหม่อีกครั้ง</p>

                <button type="button" id="retry-load-photos">
                    ลองอีกครั้ง
                </button>
            </div>
        `;

        document
            .getElementById('retry-load-photos')
            .addEventListener('click', loadPhotos);

    } finally {
        isLoadingPhotos = false;
    }
}

// เริ่มโหลดรูปภาพเมื่อเปิดหน้าเว็บ
loadPhotos();


/* =========================================================
   3. REGION AND PROVINCE FILTERS
========================================================= */

// กรองภาพถ่ายตามภูมิภาค
function filterRegion(region) {
    currentRegion = region;

    document.querySelectorAll('.region-filters button').forEach(button => {
        button.classList.remove('active');
    });

    const activeButton = document.querySelector(
        `.region-filters button[onclick="filterRegion('${region}')"]`
    );

    if (activeButton) {
        activeButton.classList.add('active');
    }

    applyFilters();
}

// ล้างตัวกรองทั้งหมด
function resetFilters() {
    currentRegion = 'all';
    currentProvinceSearch = '';

    const searchInput = document.getElementById('province-search-input');

    if (searchInput) {
        searchInput.value = '';
    }

    document.querySelectorAll('.region-filters button').forEach(button => {
        button.classList.remove('active');
    });

    const allButton = document.querySelector(
        `.region-filters button[onclick="filterRegion('${currentRegion}')"]`
    );

    if (allButton) {
        allButton.classList.add('active');
    }

    applyFilters();
}

window.filterRegion = filterRegion;
window.resetFilters = resetFilters;

// ใช้กรองภาพถ่ายจากค่าภูมิภาคและคำค้นหาจังหวัด
function applyFilters() {
    if (photosLoadFailed) {
        return;
    }

    const searchTerm = currentProvinceSearch.trim().toLowerCase();

    const filtered = allPhotos.filter(photo => {
        const matchesRegion =
            currentRegion === 'all' ||
            photo.region === currentRegion;

        const province = (photo.province || '').toLowerCase();

        const matchesProvinceSearch =
            searchTerm === '' ||
            province.includes(searchTerm);

        return matchesRegion && matchesProvinceSearch;
    });

    const resultCount = document.getElementById('filter-result-count');

    if (resultCount) {
        resultCount.textContent = `พบ ${filtered.length} ภาพ`;
    }

    // ล้างสถานะโฟกัสของการ์ดเดิม
    document.querySelectorAll('.gallery-card.is-map-focused')
        .forEach(card => {
            card.classList.remove('is-map-focused');
        });

    renderMarkers(filtered);
    renderGallery(filtered);
}

// ผูกช่องค้นหาจังหวัดกับตัวกรอง
const provinceSearchInput = document.getElementById('province-search-input');

if (provinceSearchInput) {
    provinceSearchInput.addEventListener('input', event => {
        currentProvinceSearch = event.target.value;
        applyFilters();
    });
}


/* =========================================================
   4. MAP MARKERS
========================================================= */

// แสดง Marker ของภาพถ่ายบนแผนที่
function renderMarkers(data) {
    markers.forEach(marker => {
        map.removeLayer(marker);
    });

    markers = [];

    data.forEach(photo => {
        const lat = Number(photo.latitude);
        const lng = Number(photo.longitude);

        // ข้ามข้อมูลที่ไม่มีพิกัดที่ใช้งานได้
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            return;
        }

        const marker = L.marker([lat, lng]).addTo(map);

        marker.photoId = photo.id;

        const popup = document.createElement('div');
        popup.className = 'map-popup';

        const popupTitle = document.createElement('h3');
        popupTitle.textContent = photo.title || 'ภาพถ่าย';

        const popupLocation = document.createElement('p');
        popupLocation.textContent = [
            photo.province,
            photo.region
        ].filter(Boolean).join(' • ');

        const popupDescription = document.createElement('p');
        popupDescription.className = 'map-popup-description';
        popupDescription.textContent = photo.description || '';

        const popupImage = document.createElement('img');

        popupImage.className = 'map-popup-image';
        popupImage.src = new URL(photo.image_url, API_BASE_URL).href;
        popupImage.alt = photo.title || 'Thailand Gallery photo';
        popupImage.loading = 'lazy';
        popupImage.tabIndex = -1;

        popupImage.addEventListener('error', () => {
            const placeholder = document.createElement('div');

            placeholder.className = 'map-popup-image-placeholder';
            placeholder.setAttribute('role', 'img');
            placeholder.setAttribute(
                'aria-label',
                'ไม่สามารถโหลดรูปภาพนี้ได้'
            );

            placeholder.textContent = '🖼️ ไม่สามารถโหลดรูปภาพได้';

            popupImage.replaceWith(placeholder);
        }, { once: true });

        popup.appendChild(popupImage);
        popup.appendChild(popupTitle);
        popup.appendChild(popupLocation);
        if (popupDescription.textContent) {
            popup.appendChild(popupDescription);
        }

        marker.bindPopup(popup);

        let removePopupTouchDrag = () => {};

        marker.on('popupopen', () => {
            popupImage.focus();
            removePopupTouchDrag();
            removePopupTouchDrag = enablePopupTouchDrag(
                marker.getPopup().getElement()
            );
        });

        marker.on('popupclose', () => {
            removePopupTouchDrag();
            removePopupTouchDrag = () => {};
        });

        marker.on('click', () => {
            marker.openPopup();
        });

        markers.push(marker);
    });
}


/* =========================================================
   5. PHOTO GALLERY
========================================================= */

// สร้างการ์ดภาพถ่าย
function renderGallery(data) {
    gallery.innerHTML = '';

    if (data.length === 0) {
        gallery.innerHTML = `
            <div class="gallery-empty">
                <div class="gallery-empty-icon">📷</div>
                <h3>ยังไม่มีรูปภาพ</h3>
                <p>ยังไม่มีภาพถ่ายในภูมิภาคนี้</p>
            </div>
        `;

        return;
    }

    data.forEach(photo => {
        const card = document.createElement('article');

        card.className = 'gallery-card';
        card.dataset.photoId = String(photo.id);

        const img = document.createElement('img');

        img.src = new URL(photo.image_url, API_BASE_URL).href;
        img.alt = photo.title || 'Thailand Gallery photo';
        img.loading = 'lazy';

        // แสดง Placeholder หากโหลดรูปไม่สำเร็จ
        img.addEventListener('error', () => {
            const placeholder = document.createElement('div');

            placeholder.className = 'image-placeholder';
            placeholder.setAttribute('role', 'img');
            placeholder.setAttribute(
                'aria-label',
                `ไม่สามารถโหลดรูปภาพ ${photo.title || ''} ได้`
            );

            const icon = document.createElement('span');
            icon.className = 'image-placeholder-icon';
            icon.setAttribute('aria-hidden', 'true');
            icon.textContent = '🖼️';

            const title = document.createElement('span');
            title.className = 'image-placeholder-title';
            title.textContent = 'ไม่สามารถโหลดรูปภาพได้';

            const description = document.createElement('span');
            description.className = 'image-placeholder-description';
            description.textContent = 'กรุณาลองใหม่ภายหลัง';

            placeholder.append(icon, title, description);

            img.replaceWith(placeholder);
        }, { once: true });

        const content = document.createElement('div');
        content.className = 'gallery-card-content';

        const title = document.createElement('h3');
        title.textContent = photo.title || 'ไม่มีชื่อภาพ';

        const location = document.createElement('p');
        location.className = 'gallery-card-location';
        location.textContent =
            `📍 ${photo.province || 'ไม่ระบุจังหวัด'}${photo.region ? ` • ${photo.region}` : ''}`;

        const activity = document.createElement('p');
        activity.className = 'gallery-card-activity';
        activity.textContent = `🎯 ${photo.activity || 'ไม่ระบุกิจกรรม'}`;

        const date = document.createElement('p');
        date.className = 'gallery-card-date';
        date.textContent = `📅 ${photo.date || 'ไม่ระบุวันที่'}`;

        content.append(title, location, activity, date);
        card.append(img, content);

        // คลิกการ์ดเพื่อเลื่อนไปยังตำแหน่งบนแผนที่
        card.addEventListener('click', () => {
            const lat = Number(photo.latitude);
            const lng = Number(photo.longitude);

            if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
                return;
            }

            const marker = markers.find(
                item => String(item.photoId) === String(photo.id)
            );

            map.setView([lat, lng], 10, {
                animate: true
            });

            if (marker) {
                marker.openPopup();
            }

            const mapElement = document.getElementById('map');

            if (mapElement) {
                mapElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                });
            }

        });

        gallery.appendChild(card);
    });
}
