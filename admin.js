// URLパラメータからbot情報を取得
const urlParams = new URLSearchParams(window.location.search);
const currentBot = urlParams.get('bot') || 'yuzu';

// LocalStorageキー
const STORAGE_KEY = `portfolio_${currentBot}`;
const AUTH_KEY = `auth_${currentBot}`;

// 簡易パスワード（本番環境では環境変数などを使用）
const PASSWORDS = {
    'yuzu': 'scc62625353',
    'kedo': 'scc62625353'
};

// タイトル設定
const botNames = {
    'yuzu': '🍊 Yuzu bot - 管理画面',
    'kedo': '🎯 Kedo bot - 管理画面'
};
document.getElementById('admin-title').textContent = botNames[currentBot];
document.title = botNames[currentBot];
document.getElementById('back-link').href = `portfolio.html?bot=${currentBot}`;

// 認証トークン
let authToken = sessionStorage.getItem(AUTH_KEY);

// 初期化
if (authToken) {
    showAdminContent();
    loadAdminProjects();
}

// 認証
function authenticate() {
    const password = document.getElementById('password-input').value;
    const errorEl = document.getElementById('auth-error');

    if (!password) {
        errorEl.textContent = 'パスワードを入力してください';
        return;
    }

    if (password === PASSWORDS[currentBot]) {
        authToken = password;
        sessionStorage.setItem(AUTH_KEY, authToken);
        showAdminContent();
        loadAdminProjects();
        errorEl.textContent = '';
    } else {
        errorEl.textContent = 'パスワードが正しくありません';
    }
}

function showAdminContent() {
    document.getElementById('auth-section').style.display = 'none';
    document.getElementById('admin-content').style.display = 'block';
}

function logout() {
    sessionStorage.removeItem(AUTH_KEY);
    location.reload();
}

// プロジェクト一覧を読み込み
function loadAdminProjects() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        const projects = stored ? JSON.parse(stored) : [];

        const listEl = document.getElementById('admin-projects-list');
        
        if (projects.length === 0) {
            listEl.innerHTML = '<div class="no-projects-admin"><p>プロジェクトがまだありません</p></div>';
            return;
        }

        listEl.innerHTML = projects.map((project, index) => {
            const thumbnailUrl = convertGoogleDriveUrl(project.thumbnail);
            return `
            <div class="admin-item" data-id="${index}">
                <div class="admin-item-thumbnail">
                    ${thumbnailUrl 
                        ? `<img src="${thumbnailUrl}" alt="${project.title}" onerror="this.parentElement.innerHTML='<div class=\\'thumbnail-placeholder-small\\'>📄</div>'">`
                        : `<div class="thumbnail-placeholder-small">📄</div>`
                    }
                </div>
                <div class="admin-item-info">
                    <h3>${project.title}</h3>
                    <p>${project.description || '説明なし'}</p>
                    <div class="meta">
                        <span class="platform-badge">${project.platform || 'Other'}</span>
                        <a href="${project.url}" target="_blank">${project.url}</a>
                    </div>
                </div>
                <div class="admin-item-actions">
                    <button onclick="openEditModal(${index})" class="btn-edit">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/>
                        </svg>
                        編集
                    </button>
                    <button onclick="deleteProject(${index})" class="btn-delete">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                            <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                        </svg>
                        削除
                    </button>
                </div>
            </div>
        `}).join('');
    } catch (error) {
        console.error('プロジェクトの読み込みに失敗:', error);
    }
}

// Google Drive画像URLを変換
function convertGoogleDriveUrl(url) {
    if (!url) return '';
    
    const driveMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (driveMatch) {
        return `https://drive.google.com/thumbnail?id=${driveMatch[1]}&sz=w800`;
    }
    
    if (url.includes('drive.google.com/thumbnail')) {
        return url;
    }
    
    const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (idMatch) {
        return `https://drive.google.com/thumbnail?id=${idMatch[1]}&sz=w800`;
    }
    
    return url;
}

// プロジェクト追加
document.getElementById('add-form').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());

    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        const projects = stored ? JSON.parse(stored) : [];
        
        // IDを追加
        data.id = Date.now();
        projects.push(data);
        
        localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
        
        alert('✨ プロジェクトを追加しました！');
        e.target.reset();
        loadAdminProjects();
    } catch (error) {
        alert('❌ エラーが発生しました: ' + error.message);
    }
});

// 編集モーダルを開く
function openEditModal(index) {
    const stored = localStorage.getItem(STORAGE_KEY);
    const projects = stored ? JSON.parse(stored) : [];
    const project = projects[index];

    if (!project) return;

    document.getElementById('edit-id').value = index;
    document.getElementById('edit-title').value = project.title;
    document.getElementById('edit-description').value = project.description || '';
    document.getElementById('edit-url').value = project.url;
    document.getElementById('edit-platform').value = project.platform || 'Other';
    document.getElementById('edit-thumbnail').value = project.thumbnail || '';
    document.getElementById('edit-tags').value = project.tags || '';

    document.getElementById('edit-modal').style.display = 'flex';
}

// 編集モーダルを閉じる
function closeEditModal() {
    document.getElementById('edit-modal').style.display = 'none';
}

// プロジェクト更新
document.getElementById('edit-form').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const index = parseInt(document.getElementById('edit-id').value);
    const stored = localStorage.getItem(STORAGE_KEY);
    const projects = stored ? JSON.parse(stored) : [];

    if (index >= 0 && index < projects.length) {
        projects[index] = {
            id: projects[index].id,
            title: document.getElementById('edit-title').value,
            description: document.getElementById('edit-description').value,
            url: document.getElementById('edit-url').value,
            platform: document.getElementById('edit-platform').value,
            thumbnail: document.getElementById('edit-thumbnail').value,
            tags: document.getElementById('edit-tags').value
        };

        localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
        alert('✅ 更新しました！');
        closeEditModal();
        loadAdminProjects();
    }
});

// プロジェクト削除
function deleteProject(index) {
    if (!confirm('本当に削除しますか？')) return;

    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        const projects = stored ? JSON.parse(stored) : [];
        
        projects.splice(index, 1);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
        
        alert('🗑️ 削除しました！');
        loadAdminProjects();
    } catch (error) {
        alert('❌ エラーが発生しました: ' + error.message);
    }
}

// Enterキーで認証
document.getElementById('password-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') authenticate();
});

// モーダル外クリックで閉じる
document.getElementById('edit-modal').addEventListener('click', (e) => {
    if (e.target.id === 'edit-modal') {
        closeEditModal();
    }
});
