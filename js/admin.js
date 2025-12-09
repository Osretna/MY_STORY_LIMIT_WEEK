import { db, auth, collection, addDoc, getDocs, setDoc, doc, getDoc, deleteDoc, updateDoc, onAuthStateChanged, signOut, query, orderBy, onSnapshot, serverTimestamp } from './firebase-config.js';

// في بداية ملف js/admin.js

// التحقق من الصلاحيات عند الدخول
onAuthStateChanged(auth, async (user) => {
    if(!user) {
        // لو مش مسجل دخول، يروح يسجل
        window.location.href = "login.html"; 
    } else {
        // لو مسجل، نفحص دوره (Role)
        try {
            const docSnap = await getDoc(doc(db, "users", user.uid));
            
            if(docSnap.exists()) {
                const role = docSnap.data().role; // هنا نعرف هو (admin, support, sales, customer)
                
                // لو كان عميل عادي وحاول يدخل هنا -> طرد
                if (!role || role === 'customer') {
                    Swal.fire({
                        icon: 'error',
                        title: 'ممنوع الدخول',
                        text: 'هذه الصفحة للموظفين فقط. سيتم تحويلك للمتجر.',
                        timer: 3000,
                        showConfirmButton: false
                    }).then(() => {
                        window.location.href = "index.html";
                    });
                } else {
                    // لو موظف -> نطبق الصلاحيات
                    applyPermissions(role);
                }
            } else {
                // لو ملوش بيانات خالص -> طرد
                window.location.href = "index.html";
            }
        } catch (error) {
            console.error("Auth Check Error:", error);
        }
    }
});

// دالة إخفاء/إظهار التبويبات حسب الدور
function applyPermissions(role) {
    // 1. إخفاء كل التبويبات في البداية
    document.querySelectorAll('.nav-link').forEach(el => el.classList.add('d-none'));
    
    // 2. إظهار زر الخروج دائماً
    
    // 3. إظهار التبويبات المسموحة
    if(role === 'admin') {
        // المدير يشوف كل حاجة
        document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('d-none'));
        // نفتح تبويب المنتجات افتراضياً
        document.querySelector('[data-bs-target="#pills-products"]').classList.add('active');
        document.getElementById('pills-products').classList.add('show', 'active');
    }
    else if(role === 'support') {
        // الدعم يشوف الشات فقط
        const tab = document.querySelector('[data-bs-target="#pills-support"]');
        tab.classList.remove('d-none');
        tab.click(); // ضغط أوتوماتيك لفتح التبويب
    }
    else if(role === 'sales') {
        // المبيعات يشوف الطلبات والمنتجات
        document.querySelector('[data-bs-target="#pills-orders"]').classList.remove('d-none');
        document.querySelector('[data-bs-target="#pills-products"]').classList.remove('d-none');
        document.querySelector('[data-bs-target="#pills-orders"]').click();
    }

    else {
        // لو عميل حاول يدخل الأدمن
        Swal.fire('تنبيه', 'ليس لديك صلاحية للدخول هنا', 'error').then(() => {
            window.location.href = "index.html";
        });
    }
}
document.getElementById('logoutBtn').addEventListener('click', () => signOut(auth));

loadSettings(); loadOrders(); loadProducts(); loadCoupons();

// --- 1. Products (With Stock & Visibility) ---
document.getElementById('addProductForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]'); btn.disabled = true; btn.innerText = "جاري...";
    try {
        const imagesText = document.getElementById('pImages').value;
        const imagesArray = imagesText.split('\n').map(u => u.trim()).filter(u => u !== '');
        await addDoc(collection(db, "products"), {
            name: document.getElementById('pName').value,
            price: Number(document.getElementById('pPrice').value),
            category: document.getElementById('pCategory').value.trim(),
            subCategory: document.getElementById('pSubCategory').value.trim() || "",
            description: document.getElementById('pDesc').value || "",
            stockQty: Number(document.getElementById('pStock').value),
            inStock: document.getElementById('pInStock').value === 'true',
            isVisible: document.getElementById('pVisible').value === 'true',
            images: imagesArray, imageUrl: imagesArray[0], createdAt: new Date()
        });
        Swal.fire({icon: 'success', title: 'تم', timer: 1000, showConfirmButton: false});
        e.target.reset(); loadProducts();
    } catch (err) { Swal.fire('خطأ', err.message, 'error'); } 
    finally { btn.disabled = false; btn.innerText = "نشر"; }
});

async function loadProducts() {
    const tbody = document.getElementById('productsTableBody');
    tbody.innerHTML = '<tr><td colspan="5" class="text-center">تحميل...</td></tr>';
    const q = query(collection(db, "products"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    tbody.innerHTML = '';
    snapshot.forEach(docSnap => {
        const p = docSnap.data();
        tbody.innerHTML += `
            <tr class="${p.isVisible === false ? 'table-secondary' : ''}">
                <td><img src="${p.imageUrl}" style="width:40px; height:40px; object-fit:cover; border-radius:5px;"></td>
                <td class="fw-bold">${p.name}</td>
                <td>${p.price}</td>
                <td>${p.stockQty}</td>
                <td class="text-center">
                    <button class="btn btn-sm btn-primary" onclick="openEditModal('${docSnap.id}')"><i class="fa fa-edit"></i></button>
                    <button class="btn btn-sm btn-danger" onclick="deleteProduct('${docSnap.id}')"><i class="fa fa-trash"></i></button>
                </td>
            </tr>`;
    });
}

window.deleteProduct = async (id) => { if ((await Swal.fire({title: 'حذف؟', icon: 'warning', showCancelButton: true})).isConfirmed) { await deleteDoc(doc(db, "products", id)); loadProducts(); } };

window.openEditModal = async (id) => {
    const p = (await getDoc(doc(db, "products", id))).data();
    document.getElementById('editId').value = id;
    document.getElementById('editName').value = p.name;
    document.getElementById('editPrice').value = p.price;
    document.getElementById('editCategory').value = p.category;
    document.getElementById('editSubCategory').value = p.subCategory || "";
    document.getElementById('editDesc').value = p.description || "";
    document.getElementById('editStock').value = p.stockQty || 0;
    document.getElementById('editVisible').value = p.isVisible !== false ? 'true' : 'false';
    document.getElementById('editImages').value = (p.images || [p.imageUrl]).join('\n');
    new bootstrap.Modal(document.getElementById('editProductModal')).show();
};

document.getElementById('editProductForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('editId').value;
    const imagesArray = document.getElementById('editImages').value.split('\n').map(u => u.trim()).filter(u => u !== '');
    await updateDoc(doc(db, "products", id), {
        name: document.getElementById('editName').value,
        price: Number(document.getElementById('editPrice').value),
        category: document.getElementById('editCategory').value.trim(),
        subCategory: document.getElementById('editSubCategory').value.trim(),
        description: document.getElementById('editDesc').value,
        stockQty: Number(document.getElementById('editStock').value),
        isVisible: document.getElementById('editVisible').value === 'true',
        images: imagesArray, imageUrl: imagesArray[0]
    });
    bootstrap.Modal.getInstance(document.getElementById('editProductModal')).hide(); loadProducts();
});

// --- 2. Support Chat ---
let currentChatUser = null;
onSnapshot(query(collection(db, "chats"), orderBy("lastTime", "desc")), (snapshot) => {
    const list = document.getElementById('chatUsersList'); list.innerHTML = '';
    snapshot.forEach(doc => {
        const c = doc.data();
        list.innerHTML += `<button class="list-group-item list-group-item-action bg-transparent text-white border-secondary" onclick="openAdminChat('${doc.id}', '${c.userName}')"><div class="d-flex justify-content-between"><strong>${c.userName}</strong>${c.hasUnread?'<span class="badge bg-danger rounded-pill">!</span>':''}</div><small class="text-white-50 text-truncate d-block">${c.lastMessage}</small></button>`;
    });
});
window.openAdminChat = (userId, userName) => {
    currentChatUser = userId;
    document.getElementById('adminChatArea').style.display = 'block';
    document.getElementById('chattingWith').innerText = `محادثة مع: ${userName}`;
    updateDoc(doc(db, "chats", userId), { hasUnread: false });
    onSnapshot(query(collection(db, `chats/${userId}/messages`), orderBy('createdAt', 'asc')), (snap) => {
        const b = document.getElementById('adminChatMessages'); b.innerHTML = '';
        snap.forEach(d => { const m = d.data(); const align = m.sender === 'support' ? 'text-end' : 'text-start'; const color = m.sender === 'support' ? 'bg-primary' : 'bg-secondary'; b.innerHTML += `<div class="${align} mb-2"><span class="badge ${color} p-2" style="white-space:normal;">${m.text}</span></div>`; });
        b.scrollTop = b.scrollHeight;
    });
};
document.getElementById('adminChatForm')?.addEventListener('submit', async (e) => {
    e.preventDefault(); const txt = document.getElementById('adminChatInput').value; if(!txt || !currentChatUser) return;
    await addDoc(collection(db, `chats/${currentChatUser}/messages`), { text: txt, sender: 'support', createdAt: serverTimestamp() });
    await updateDoc(doc(db, "chats", currentChatUser), { lastMessage: `الدعم: ${txt}`, lastTime: serverTimestamp() });
    document.getElementById('adminChatInput').value = '';
});
// ... (بعد دالة openAdminChat) ...

// دالة إغلاق الشات
window.closeAdminChat = () => {
    document.getElementById('adminChatArea').style.display = 'none';
    currentChatUser = null; // إلغاء تحديد المستخدم الحالي
};

// ... (باقي الكود) ...

// --- 3. Import & Excel ---
window.downloadTemplate = () => {
    if (typeof XLSX === 'undefined') return Swal.fire('خطأ', 'مكتبة الإكسيل غير محملة', 'error');
    const data = [{ name: "اسم المنتج", price: 150, category: "ملابس", subCategory: "قمصان", description: "وصف", imageUrl: "https://example.com/img.jpg" }];
    const ws = XLSX.utils.json_to_sheet(data); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Template"); XLSX.writeFile(wb, "Products_Template.xlsx");
};
window.importProducts = async () => {
    const fileInput = document.getElementById('excelFile'); if(!fileInput.files.length) return Swal.fire('تنبيه', 'اختر ملف', 'warning');
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = new Uint8Array(e.target.result); const wb = XLSX.read(data, { type: 'array' });
            const jsonData = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
            if(jsonData.length === 0) return Swal.fire('خطأ', 'الملف فارغ', 'error');
            Swal.fire({title: 'جاري...', didOpen: () => Swal.showLoading()});
            for (const i of jsonData) {
                if(!i.name || !i.price) continue;
                await addDoc(collection(db, "products"), {
                    name: i.name, price: Number(i.price), category: i.category?i.category.toString().trim():"عام",
                    subCategory: i.subCategory?i.subCategory.toString().trim():"", description: i.description||"",
                    imageUrl: i.imageUrl||"https://via.placeholder.com/150", images: [i.imageUrl||"https://via.placeholder.com/150"],
                    stockQty: 100, inStock: true, isVisible: true, createdAt: new Date()
                });
            }
            Swal.fire('نجاح', `تم ${jsonData.length}`, 'success'); loadProducts(); fileInput.value = "";
        } catch (error) { Swal.fire('خطأ', 'صيغة الملف', 'error'); }
    };
    reader.readAsArrayBuffer(fileInput.files[0]);
};

// --- Others ---
document.getElementById('addCouponForm')?.addEventListener('submit', async (e) => { e.preventDefault(); const c = document.getElementById('couponCode').value.toUpperCase().trim(); const v = Number(document.getElementById('couponValue').value); await setDoc(doc(db, "coupons", c), { code: c, percent: v, active: true }); Swal.fire('تم', '', 'success'); e.target.reset(); loadCoupons(); });
async function loadCoupons() { const l = document.getElementById('couponsList'); l.innerHTML = ''; (await getDocs(collection(db, "coupons"))).forEach(d => { const c = d.data(); l.innerHTML += `<li class="list-group-item d-flex justify-content-between align-items-center bg-transparent text-white border-secondary"><span>${c.code} (${c.percent}%)</span><button class="btn btn-sm btn-danger" onclick="deleteCoupon('${c.code}')">&times;</button></li>`; }); }
window.deleteCoupon = async (c) => { if(confirm('حذف؟')) { await deleteDoc(doc(db, "coupons", c)); loadCoupons(); } };
window.saveSettings = async () => { await setDoc(doc(db, "settings", "general"), { whatsapp: document.getElementById('adminPhone').value.replace(/[^0-9]/g, '') }); Swal.fire('تم', '', 'success'); };
async function loadSettings() { try { const s = await getDoc(doc(db, "settings", "general")); if (s.exists()) document.getElementById('adminPhone').value = s.data().whatsapp; } catch(e){} }
async function loadOrders() {
    const t = document.getElementById('ordersTableBody'); t.innerHTML = '';
    (await getDocs(query(collection(db, "orders"), orderBy("date", "desc")))).forEach(d => {
        const o = d.data(); const dStr = o.date ? o.date.toDate().toLocaleDateString('ar-EG') : '-';
        const iStr = o.items.map(i => `${i.name} (x${i.qty})`).join('<br>');
        let coup = '-'; if (o.couponUsed) coup = `${o.couponUsed} <br> <span class="text-danger">-${o.discountVal}</span>`;
        t.innerHTML += `<tr><td>${dStr}</td><td>${o.customer}</td><td>${o.phone}</td><td>${o.governorate} <br> <small>${o.address}</small></td><td class="text-start"><small>${iStr}</small></td><td>${o.originalTotal||o.total}</td><td>${coup}</td><td class="fw-bold text-success">${o.total}</td></tr>`;
    });
}
window.exportToExcel = () => {
    const t = document.getElementById("ordersTable"); let c = "\uFEFF"; 
    let h = []; t.querySelectorAll("thead th").forEach(th => h.push(`"${th.innerText.trim()}"`)); c += h.join(";") + "\r\n";
    t.querySelectorAll("tbody tr").forEach(r => { let rd = []; r.querySelectorAll("td").forEach(td => rd.push(`"${td.innerText.replace(/(\r\n|\n|\r)/gm, " | ").replace(/"/g, '""')}"`)); c += rd.join(";") + "\r\n"; });
    const b = new Blob([c], { type: "text/csv;charset=utf-8;" }); const u = window.URL.createObjectURL(b); const a = document.createElement("a"); a.href = u; a.download = `Orders_${new Date().toISOString().slice(0,10)}.csv`; document.body.appendChild(a); a.click(); document.body.removeChild(a);
};
// ==========================================
// 👥 5. إدارة المستخدمين والصلاحيات (Users)
// ==========================================
// تشغيل الدالة عند البدء
loadUsers();

async function loadUsers() {
    const tbody = document.getElementById('usersTableBody');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4" class="text-center">تحميل...</td></tr>';

    try {
        const snap = await getDocs(collection(db, "users"));
        tbody.innerHTML = '';
        
        snap.forEach(docSnap => {
            const u = docSnap.data();
            const role = u.role || 'customer';
            
            // تحديد اللون حسب الدور
            let badgeColor = 'bg-secondary';
            if(role === 'admin') badgeColor = 'bg-danger';
            if(role === 'support') badgeColor = 'bg-primary';
            if(role === 'sales') badgeColor = 'bg-success';

            tbody.innerHTML += `
                <tr>
                    <td>
                        <div class="d-flex align-items-center">
                            <img src="${u.photo || 'https://via.placeholder.com/30'}" class="rounded-circle me-2" width="30">
                            ${u.name}
                        </div>
                    </td>
                    <td><small>${u.email}</small></td>
                    <td><span class="badge ${badgeColor}">${role}</span></td>
                    <td>
                        <select class="form-select form-select-sm" onchange="updateUserRole('${docSnap.id}', this.value)">
                            <option value="customer" ${role==='customer'?'selected':''}>عميل (بدون صلاحيات)</option>
                            <option value="support" ${role==='support'?'selected':''}>دعم فني (شات فقط)</option>
                            <option value="sales" ${role==='sales'?'selected':''}>مبيعات (طلبات فقط)</option>
                            <option value="admin" ${role==='admin'?'selected':''}>مدير كامل</option>
                        </select>
                    </td>
                </tr>
            `;
        });
    } catch (e) { console.error(e); }
}

// دالة تغيير الصلاحية
window.updateUserRole = async (uid, newRole) => {
    try {
        await updateDoc(doc(db, "users", uid), { role: newRole });
        const Toast = Swal.mixin({toast: true, position: 'top-end', showConfirmButton: false, timer: 1500});
        Toast.fire({icon: 'success', title: 'تم تحديث الصلاحية'});
        loadUsers(); // تحديث الجدول
    } catch(e) {
        Swal.fire('خطأ', 'لا تملك صلاحية تغيير الأدوار', 'error');
    }
};