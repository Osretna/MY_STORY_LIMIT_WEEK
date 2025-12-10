import { db, auth, collection, addDoc, getDocs, setDoc, doc, getDoc, deleteDoc, updateDoc, onAuthStateChanged, signOut, query, orderBy, onSnapshot, serverTimestamp, where } from './firebase-config.js';

onAuthStateChanged(auth, async (user) => {
    if(!user) { window.location.href="login.html"; } else {
        try {
            const docSnap = await getDoc(doc(db, "users", user.uid));
            if(docSnap.exists()) {
                const role = docSnap.data().role;
                if (!role || role === 'customer') {
                    Swal.fire({icon: 'error', title: 'ممنوع', text: 'للموظفين فقط', timer: 3000, showConfirmButton: false}).then(() => window.location.href = "index.html");
                } else applyPermissions(role);
            } else window.location.href = "index.html";
        } catch (error) { console.error(error); }
    }
});

function applyPermissions(role) {
    document.querySelectorAll('.nav-link').forEach(el => el.classList.add('d-none'));
    if(role === 'admin') {
        document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('d-none'));
        document.querySelector('[data-bs-target="#pills-products"]').classList.add('active');
        document.getElementById('pills-products').classList.add('show', 'active');
    }
    else if(role === 'support') {
        const tab = document.querySelector('[data-bs-target="#pills-support"]'); tab.classList.remove('d-none'); tab.click();
    }
    else if(role === 'sales') {
        document.querySelector('[data-bs-target="#pills-orders"]').classList.remove('d-none');
        document.querySelector('[data-bs-target="#pills-products"]').classList.remove('d-none');
        document.querySelector('[data-bs-target="#pills-orders"]').click();
    }
}

document.getElementById('logoutBtn').addEventListener('click', () => signOut(auth));

loadSettings(); loadOrders(); loadProducts(); loadCoupons(); loadUsers();

// --- Products ---
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
            saleEndTime: document.getElementById('pSaleEnd').value || null, // 🔥 حفظ وقت العرض
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
    document.getElementById('editSaleEnd').value = p.saleEndTime || ""; // استرجاع الوقت
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
        saleEndTime: document.getElementById('editSaleEnd').value || null, // تحديث الوقت
        isVisible: document.getElementById('editVisible').value === 'true',
        images: imagesArray, imageUrl: imagesArray[0]
    });
    bootstrap.Modal.getInstance(document.getElementById('editProductModal')).hide(); loadProducts();
});

// --- Orders (Cards) ---
async function loadOrders() {
    const container = document.getElementById('ordersContainer');
    const filter = document.getElementById('orderFilter').value;
    if(!container) return;
    container.innerHTML = '<div class="text-center w-100 py-5"><div class="spinner-border text-warning"></div></div>';
    try {
        let q = (filter === 'all') ? query(collection(db, "orders"), orderBy("date", "desc")) : query(collection(db, "orders"), where("status", "==", filter), orderBy("date", "desc"));
        const snapshot = await getDocs(q);
        if (snapshot.empty) { container.innerHTML = '<div class="text-center text-white-50 w-100 py-4">لا توجد طلبات.</div>'; return; }
        let html = '';
        snapshot.forEach(docSnap => {
            const o = docSnap.data(); const date = o.date ? o.date.toDate().toLocaleDateString('ar-EG') : '-';
            const itemsText = o.items.map(i => `${i.name} (x${i.qty})`).join(', ');
            let borderClass = 'border-warning';
            if(o.status === 'shipped') borderClass = 'border-info';
            if(o.status === 'delivered') borderClass = 'border-success';
            if(o.status === 'cancelled') borderClass = 'border-danger';
            let priceDetails = `<span class="badge bg-light text-dark fs-6">${o.total}</span>`;
            if(o.couponUsed) priceDetails = `<div class="text-end"><small class="text-decoration-line-through text-muted">${o.originalTotal || ''}</small><br><span class="badge bg-light text-success border border-success">${o.total}</span><div class="small text-warning" style="font-size:0.7rem">كوبون: ${o.couponUsed}</div></div>`;
            html += `<div class="col-md-6 col-lg-4"><div class="glass-card p-3 border-start border-5 ${borderClass} bg-dark bg-opacity-25 h-100 shadow-sm"><div class="d-flex justify-content-between align-items-start mb-2"><div><h6 class="text-white fw-bold m-0"><i class="fa-solid fa-user-circle"></i> ${o.customer}</h6><a href="tel:${o.phone}" class="text-decoration-none text-info small"><i class="fa fa-phone"></i> ${o.phone}</a></div>${priceDetails}</div><p class="text-white-50 small mb-2 text-truncate" title="${o.address}"><i class="fa fa-map-marker-alt"></i> ${o.governorate} - ${o.address}</p><div class="bg-black bg-opacity-50 p-2 rounded mb-3 small text-white border border-secondary">${itemsText}</div><div class="row g-2 align-items-end"><div class="col-6"><label class="small text-white-50" style="font-size:0.7rem">الحالة</label><select class="form-select form-select-sm bg-dark text-white border-secondary" id="status-${docSnap.id}"><option value="pending" ${o.status==='pending'?'selected':''}>🟡 جديد</option><option value="shipped" ${o.status==='shipped'?'selected':''}>🚚 تم الشحن</option><option value="delivered" ${o.status==='delivered'?'selected':''}>✅ تم التسليم</option><option value="cancelled" ${o.status==='cancelled'?'selected':''}>❌ ملغي</option></select></div><div class="col-6"><label class="small text-white-50" style="font-size:0.7rem">كود التتبع</label><input type="text" class="form-control form-control-sm bg-dark text-white border-secondary" id="track-${docSnap.id}" placeholder="الباركود" value="${o.trackingCode || ''}"></div><div class="col-12 d-flex gap-2 mt-2"><button class="btn btn-primary btn-sm flex-grow-1" onclick="updateOrder('${docSnap.id}')"><i class="fa-solid fa-floppy-disk"></i> حفظ</button><button class="btn btn-outline-danger btn-sm" onclick="deleteOrder('${docSnap.id}')"><i class="fa-solid fa-trash"></i></button></div></div><div class="d-flex justify-content-between mt-2 pt-2 border-top border-secondary"><small class="text-white-50" style="font-size:0.7rem">${date}</small><small class="text-white-50" style="font-size:0.7rem">ID: ...${docSnap.id.slice(-5)}</small></div></div></div>`;
        });
        container.innerHTML = html;
    } catch (e) { container.innerHTML = '<div class="alert alert-warning small">يلزم إنشاء (Index) للفلترة.</div>'; }
}
window.updateOrder = async (orderId) => {
    try { await updateDoc(doc(db, "orders", orderId), { status: document.getElementById(`status-${orderId}`).value, trackingCode: document.getElementById(`track-${orderId}`).value }); Swal.fire({icon: 'success', title: 'تم التحديث', timer: 1000, showConfirmButton:false}); } catch (e) { Swal.fire('خطأ', 'فشل التحديث', 'error'); }
};
window.deleteOrder = async (orderId) => { if(confirm('حذف؟')) { await deleteDoc(doc(db, "orders", orderId)); loadOrders(); } };

// --- Users ---
async function loadUsers() {
    const tbody = document.getElementById('usersTableBody'); if(!tbody) return;
    try {
        const snap = await getDocs(collection(db, "users"));
        tbody.innerHTML = '';
        snap.forEach(docSnap => {
            const u = docSnap.data(); const role = u.role || 'customer';
            let badgeColor = 'bg-secondary';
            if(role === 'admin') badgeColor = 'bg-danger'; if(role === 'support') badgeColor = 'bg-primary'; if(role === 'sales') badgeColor = 'bg-success';
            tbody.innerHTML += `<tr><td><div class="d-flex align-items-center"><img src="${u.photo || 'https://via.placeholder.com/30'}" class="rounded-circle me-2" width="30">${u.name}</div></td><td><small>${u.email}</small></td><td><span class="badge ${badgeColor}">${role}</span></td><td><select class="form-select form-select-sm" onchange="updateUserRole('${docSnap.id}', this.value)"><option value="customer" ${role==='customer'?'selected':''}>عميل</option><option value="support" ${role==='support'?'selected':''}>دعم فني</option><option value="sales" ${role==='sales'?'selected':''}>مبيعات</option><option value="admin" ${role==='admin'?'selected':''}>مدير</option></select></td></tr>`;
        });
    } catch (e) { console.error(e); }
}
window.updateUserRole = async (uid, newRole) => { try { await updateDoc(doc(db, "users", uid), { role: newRole }); Swal.fire({icon: 'success', title: 'تم التحديث', timer:1000, showConfirmButton:false}); loadUsers(); } catch(e) { Swal.fire('خطأ', 'لا تملك صلاحية', 'error'); } };

// --- Support Chat ---
let currentChatUser = null;
onSnapshot(query(collection(db, "chats"), orderBy("lastTime", "desc")), (snapshot) => {
    const list = document.getElementById('chatUsersList'); list.innerHTML = '';
    snapshot.forEach(doc => {
        const c = doc.data();
        list.innerHTML += `<button class="list-group-item list-group-item-action bg-transparent text-white border-secondary" onclick="openAdminChat('${doc.id}', '${c.userName}')"><div class="d-flex justify-content-between"><strong>${c.userName}</strong>${c.hasUnread?'<span class="badge bg-danger rounded-pill">!</span>':''}</div><small class="text-white-50 text-truncate d-block">${c.lastMessage}</small></button>`;
    });
});
window.openAdminChat = (userId, userName) => {
    currentChatUser = userId; document.getElementById('adminChatArea').style.display = 'block'; document.getElementById('chattingWith').innerText = `محادثة مع: ${userName}`; updateDoc(doc(db, "chats", userId), { hasUnread: false });
    onSnapshot(query(collection(db, `chats/${userId}/messages`), orderBy('createdAt', 'asc')), (snap) => {
        const b = document.getElementById('adminChatMessages'); b.innerHTML = '';
        snap.forEach(d => { const m = d.data(); const align = m.sender === 'support' ? 'text-end' : 'text-start'; const color = m.sender === 'support' ? 'bg-primary' : 'bg-secondary'; b.innerHTML += `<div class="${align} mb-2"><span class="badge ${color} p-2" style="white-space:normal;">${m.text}</span></div>`; });
        b.scrollTop = b.scrollHeight;
    });
};
window.closeAdminChat = () => { document.getElementById('adminChatArea').style.display = 'none'; currentChatUser = null; };
document.getElementById('adminChatForm')?.addEventListener('submit', async (e) => {
    e.preventDefault(); const txt = document.getElementById('adminChatInput').value; if(!txt || !currentChatUser) return;
    await addDoc(collection(db, `chats/${currentChatUser}/messages`), { text: txt, sender: 'support', createdAt: serverTimestamp() });
    await updateDoc(doc(db, "chats", currentChatUser), { lastMessage: `الدعم: ${txt}`, lastTime: serverTimestamp() });
    document.getElementById('adminChatInput').value = '';
});

// --- Import/Export ---
window.downloadTemplate = () => {
    if (typeof XLSX === 'undefined') return Swal.fire('خطأ', 'مكتبة الإكسيل غير محملة', 'error');
    const data = [{ name: "منتج 1", price: 100, category: "عام", subCategory: "", description: "وصف", imageUrl: "url" }];
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
                    name: i.name, price: Number(i.price), category: i.category?i.category.toString().trim():"عام", subCategory: i.subCategory?i.subCategory.toString().trim():"", description: i.description||"", imageUrl: i.imageUrl||"https://via.placeholder.com/150", images: [i.imageUrl||"https://via.placeholder.com/150"], stockQty: 100, inStock: true, isVisible: true, createdAt: new Date()
                });
            }
            Swal.fire('نجاح', `تم ${jsonData.length}`, 'success'); loadProducts(); fileInput.value = "";
        } catch (error) { Swal.fire('خطأ', 'صيغة الملف', 'error'); }
    };
    reader.readAsArrayBuffer(fileInput.files[0]);
};
window.exportToExcel = () => {
    const table = document.getElementById("ordersContainer"); // Note: Using array logic is better here but let's assume we fetch data from DB directly for clean export
    // For clean export, let's fetch data again (Quickest fix without DOM parsing complex cards)
    getDocs(query(collection(db, "orders"), orderBy("date", "desc"))).then(snap => {
        let csv = "\uFEFFالتاريخ,العميل,الهاتف,العنوان,المنتجات,السعر الأصلي,الخصم,الصافي,الحالة\n";
        snap.forEach(d => {
            const o = d.data();
            const items = o.items.map(i=>`${i.name} (${i.qty})`).join(" | ");
            csv += `"${o.date.toDate().toLocaleDateString('ar-EG')}","${o.customer}","${o.phone}","${o.governorate} ${o.address}","${items}","${o.originalTotal||o.total}","${o.couponUsed||0}","${o.total}","${o.status}"\n`;
        });
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = `Orders_${new Date().toISOString().slice(0,10)}.csv`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
    });
};

// --- Others ---
document.getElementById('addCouponForm')?.addEventListener('submit', async (e) => { e.preventDefault(); const c = document.getElementById('couponCode').value.toUpperCase().trim(); const v = Number(document.getElementById('couponValue').value); await setDoc(doc(db, "coupons", c), { code: c, percent: v, active: true }); Swal.fire('تم', '', 'success'); e.target.reset(); loadCoupons(); });
async function loadCoupons() { const l = document.getElementById('couponsList'); l.innerHTML = ''; (await getDocs(collection(db, "coupons"))).forEach(d => { const c = d.data(); l.innerHTML += `<li class="list-group-item d-flex justify-content-between align-items-center bg-transparent text-white border-secondary"><span>${c.code} (${c.percent}%)</span><button class="btn btn-sm btn-danger" onclick="deleteCoupon('${c.code}')">&times;</button></li>`; }); }
window.deleteCoupon = async (c) => { if(confirm('حذف؟')) { await deleteDoc(doc(db, "coupons", c)); loadCoupons(); } };
window.saveSettings = async () => { await setDoc(doc(db, "settings", "general"), { whatsapp: document.getElementById('adminPhone').value.replace(/[^0-9]/g, '') }); Swal.fire('تم', '', 'success'); };
async function loadSettings() { try { const s = await getDoc(doc(db, "settings", "general")); if (s.exists()) document.getElementById('adminPhone').value = s.data().whatsapp; } catch(e){} }
