// URLパラメータからbot情報を取得
const urlParams = new URLSearchParams(window.location.search);
const currentBot = urlParams.get('bot') || 'yuzu';

// LocalStorageキー
const CATEGORIES_KEY = `categories_${currentBot}`;

// タイトル設定
const botNames = {
    'yuzu': '🍊 Yuzu bot - カテゴリー管理',
    'kedo': '🎯 Kedo bot - カテゴリー管理'
};
document.getElementById('categories-title').textContent = botNames[currentBot];
document.title = botNames[currentBot];
document.getElementById('back-link').href = `portfolio.html?bot=${currentBot}`;
document.getElementById('admin-link').href = `admin.html?bot=${currentBot}`;

let categories = [];

// カテゴリーを読み込み
function loadCategories() {
    const stored = localStorage.getItem(CATEGORIES_KEY);
    
    if (stored) {
        categories = JSON.parse(stored);
    } else {
        // デフォルトカテゴリー
        categories = [
            { id: 'GAS', name: 'GAS', color: '#34A853' },
            { id: 'GitHub', name: 'GitHub', color: '#24292e' },
            { id: 'Cloudflare', name: 'Cloudflare', color: '#F38020' },
            { id: 'Genspark', name: 'Genspark', color: '#6366f1' },
            { id: 'Vercel', name: 'Vercel', color: '#000000' },
            { id: 'Other', name: 'その他', color: '#64748b' }
        ];
        saveCategories();
    }
    
    renderCategories();
}

// カテゴリーを保存
function saveCategories() {
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
}

// カテゴリーを表示
function renderCategories() {
    const listEl = document.getElementById('categories-list');
    
    if (categories.length === 0) {
        listEl.innerHTML = '<div class="no-projects-admin"><p>カテゴリーがまだありません</p></div>';
        return;
    }

    listEl.innerHTML = categories.map((category, index) => `
        <div class="category-item" data-index="${index}">
            <div class="category-preview">
                <span class="platform-badge" style="background-color: ${category.color}">${category.name}</span>
                <code class="category-id">ID: ${category.id}</code>
            </div>
            <div class="category-item-info">
                <h3>${category.name}</h3>
                <p>ID: <code>${category.id}</code> | カラー: <span class="color-sample" style="background-color: ${category.color}"></span> ${category.color}</p>
            </div>
            <div class="admin-item-actions">
                <button onclick="openEditModal(${index})" class="btn-edit">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/>
                    </svg>
                    編集
                </button>
                <button onclick="deleteCategory(${index})" class="btn-delete">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                        <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                    </svg>
                    削除
                </button>
            </div>
        </div>
    `).join('');
}

// カテゴリー追加
document.getElementById('add-category-form').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const newCategory = {
        id: formData.get('id').trim(),
        name: formData.get('name').trim(),
        color: formData.get('color')
    };

    // IDの重複チェック
    if (categories.some(c => c.id === newCategory.id)) {
        alert('❌ このIDは既に使用されています。別のIDを指定してください。');
        return;
    }

    categories.push(newCategory);
    saveCategories();
    
    alert('✨ カテゴリーを追加しました！');
    e.target.reset();
    renderCategories();
});

// カラーピッカーとテキスト入力の同期
function setupColorSync(colorInput, textInput) {
    colorInput.addEventListener('input', (e) => {
        textInput.value = e.target.value;
    });
    
    textInput.addEventListener('input', (e) => {
        const value = e.target.value;
        if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
            colorInput.value = value;
        }
    });
}

// 追加フォームのカラー同期
const addColorInput = document.querySelector('input[name="color"]');
const addColorText = document.querySelector('input[name="colorText"]');
setupColorSync(addColorInput, addColorText);

// 編集モーダルを開く
function openEditModal(index) {
    const category = categories[index];
    if (!category) return;

    document.getElementById('edit-index').value = index;
    document.getElementById('edit-name').value = category.name;
    document.getElementById('edit-id').value = category.id;
    document.getElementById('edit-color').value = category.color;
    document.getElementById('edit-colorText').value = category.color;

    document.getElementById('edit-modal').style.display = 'flex';
    
    // 編集フォームのカラー同期
    const editColorInput = document.getElementById('edit-color');
    const editColorText = document.getElementById('edit-colorText');
    setupColorSync(editColorInput, editColorText);
}

// 編集モーダルを閉じる
function closeEditModal() {
    document.getElementById('edit-modal').style.display = 'none';
}

// カテゴリー更新
document.getElementById('edit-form').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const index = parseInt(document.getElementById('edit-index').value);
    const updatedCategory = {
        id: document.getElementById('edit-id').value.trim(),
        name: document.getElementById('edit-name').value.trim(),
        color: document.getElementById('edit-color').value
    };

    // IDの重複チェック（自分以外）
    if (categories.some((c, i) => c.id === updatedCategory.id && i !== index)) {
        alert('❌ このIDは既に使用されています。別のIDを指定してください。');
        return;
    }

    const oldId = categories[index].id;
    categories[index] = updatedCategory;
    saveCategories();
    
    // プロジェクトのカテゴリーIDも更新
    if (oldId !== updatedCategory.id) {
        updateProjectCategories(oldId, updatedCategory.id);
    }
    
    alert('✅ 更新しました！');
    closeEditModal();
    renderCategories();
});

// プロジェクトのカテゴリーIDを更新
function updateProjectCategories(oldId, newId) {
    const projectsKey = `portfolio_${currentBot}`;
    const stored = localStorage.getItem(projectsKey);
    
    if (stored) {
        const projects = JSON.parse(stored);
        const updated = projects.map(p => {
            if (p.platform === oldId) {
                return { ...p, platform: newId };
            }
            return p;
        });
        localStorage.setItem(projectsKey, JSON.stringify(updated));
    }
}

// カテゴリー削除
function deleteCategory(index) {
    const category = categories[index];
    
    if (!confirm(`本当に「${category.name}」カテゴリーを削除しますか？\n\nこのカテゴリーを使用しているプロジェクトは「その他」カテゴリーに変更されます。`)) {
        return;
    }

    categories.splice(index, 1);
    saveCategories();
    
    alert('🗑️ 削除しました！');
    renderCategories();
}

// モーダル外クリックで閉じる
document.getElementById('edit-modal').addEventListener('click', (e) => {
    if (e.target.id === 'edit-modal') {
        closeEditModal();
    }
});

// 初期化
loadCategories();
