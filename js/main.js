// ============================================
// ⏳ نظام الحماية (الفترة التجريبية)
// ============================================
(function checkTrialPeriod() {
    // 1. تحديد تاريخ الانتهاء (سنة-شهر-يوم)
    // تم ضبطه على 16 ديسمبر 2025
    const expiryDate = new Date("2025-12-16T00:00:00"); 
    const currentDate = new Date();

    // 2. التحقق
    if (currentDate > expiryDate) {
        document.body.innerHTML = `
            <div style="
                display: flex; 
                flex-direction: column;
                align-items: center; 
                justify-content: center; 
                height: 100vh; 
                background: #1e1e2f; 
                color: #fff; 
                font-family: sans-serif;
                text-align: center;
                direction: rtl;">
                
                <h1 style="color: #ff4757; font-size: 3rem; margin-bottom: 20px;">⛔ انتهت الفترة التجريبية</h1>
                <p style="font-size: 1.5rem; margin-bottom: 30px;">شكراً لتجربة النظام. لاستمرار الخدمة وتفعيل الموقع بشكل دائم، يرجى التواصل مع المطور.</p>
                
                <a href="https://wa.me/201120194940" style="
                    background: #25d366; 
                    color: white; 
                    padding: 15px 30px; 
                    text-decoration: none; 
                    border-radius: 50px; 
                    font-size: 1.2rem;
                    font-weight: bold;">
                    تواصل واتساب لتجديد الاشتراك 💬
                </a>
            </div>
        `;
        // 3. إيقاف الموقع بالكامل
        throw new Error("تم إيقاف الموقع لانتهاء الفترة التجريبية.");
    }
})();

// ... (هنا تأتي باقي أكوادك القديمة كما هي import وغيرها) ...
import { db, collection, getDocs, addDoc, doc, getDoc, updateDoc, setDoc, auth, googleProvider, signInWithPopup, onSnapshot, query, orderBy, serverTimestamp, onAuthStateChanged, where } from './firebase-config.js';

let allProducts = [];
let cart = JSON.parse(localStorage.getItem('cart')) || [];
let wishlist = JSON.parse(localStorage.getItem('wishlist')) || [];
let appliedDiscount = 0;
let appliedCouponCode = "";
let currentProductId = null;
let currentUser = null;

const governorates = ["القاهرة", "الجيزة", "الإسكندرية", "الدقهلية", "الشرقية", "المنوفية", "القليوبية", "البحيرة", "الغربية", "بور سعيد", "دمياط", "الإسماعيلية", "السويس", "كفر الشيخ", "الفيوم", "بني سويف", "المنيا", "أسيوط", "سوهاج", "قنا", "الأقصر", "أسوان", "البحر الأحمر", "الوادي الجديد", "مطروح", "شمال سيناء", "جنوب سيناء"];

document.addEventListener('DOMContentLoaded', async () => {
    const govSelect = document.getElementById('c_gov');
    if(govSelect) governorates.forEach(g => { const op = document.createElement('option'); op.value = g; op.innerText = g; govSelect.appendChild(op); });
    updateCartUI();
    await fetchProducts();
});

window.showSection = (id) => {
    document.querySelectorAll('.page-section').forEach(s => s.classList.add('d-none'));
    const section = document.getElementById(id);
    if(section) section.classList.remove('d-none');
    window.scrollTo(0,0);
}

// 🔐 Google Auth
window.googleLogin = async () => {
    try {
        const result = await signInWithPopup(auth, googleProvider);
        const user = result.user;
        await setDoc(doc(db, "users", user.uid), { name: user.displayName, email: user.email, photo: user.photoURL, role: "customer" }, { merge: true });
        toast(`مرحباً ${user.displayName}`, 'success');
    } catch (error) { toast('فشل الدخول', 'error'); }
};

onAuthStateChanged(auth, (user) => {
    currentUser = user;
    const loginBtn = document.getElementById('loginBtn');
    const profileDiv = document.getElementById('userProfile');
    if (user) {
        loginBtn.classList.add('d-none'); profileDiv.classList.remove('d-none'); profileDiv.classList.add('d-flex');
        document.getElementById('userAvatar').src = user.photoURL;
        const nameInput = document.getElementById('c_name'); if(nameInput && !nameInput.value) nameInput.value = user.displayName;
        listenToChat(user.uid);
    } else {
        loginBtn.classList.remove('d-none'); profileDiv.classList.add('d-none');
    }
});

// 📦 Products
async function fetchProducts() {
    const grid = document.getElementById('productsGrid');
    const offersGrid = document.getElementById('offersGrid');
    const offersSection = document.getElementById('offersSection');

    if(grid) grid.innerHTML = Array(10).fill(0).map(() => `<div class="col"><div class="product-card h-100 p-2" style="background: rgba(255,255,255,0.05);"><div class="skeleton w-100" style="height: 180px; margin-bottom: 10px;"></div><div class="skeleton w-75" style="height: 20px;"></div></div></div>`).join('');

    try {
        const snap = await getDocs(collection(db, "products"));
        allProducts = [];
        snap.forEach(d => {
            const data = d.data();
            // Filter out hidden products
            if(data.isVisible !== false) {
                allProducts.push({ 
                    id: d.id, ...data,
                    category: data.category ? data.category.trim() : "عام",
                    subCategory: data.subCategory ? data.subCategory.trim() : "",
                    ratingAvg: data.ratingAvg || 5, ratingCount: data.ratingCount || 0
                });
            }
        });

        const offers = allProducts.filter(p => p.category.includes('عروض') || p.category.includes('Offers'));
        if (offers.length > 0 && offersGrid) { offersSection.classList.remove('d-none'); offersGrid.innerHTML = generateProductHTML(offers); } 
        else if (offersSection) offersSection.classList.add('d-none');

        renderProducts(allProducts);
        buildCategoriesMenu();
    } catch (error) { console.error(error); if(grid) grid.innerHTML = '<p class="text-white text-center">خطأ تحميل</p>'; }
}

function generateProductHTML(products) {
    if(products.length === 0) return '<p class="text-white text-center w-100">لا توجد منتجات.</p>';
    return products.map(p => {
        const isFav = wishlist.includes(p.id) ? 'active' : '';
        return `
        <div class="col">
            <div class="product-card h-100 d-flex flex-column shadow-sm position-relative">
                <button class="wishlist-btn ${isFav}" onclick="toggleWishlist('${p.id}', this)"><i class="fa-solid fa-heart"></i></button>
                <div style="position:relative; cursor: pointer;" onclick="openProductDetails('${p.id}')">
                    <img src="${p.imageUrl}" class="card-img-top" style="height:180px; object-fit:cover;" onerror="this.src='https://via.placeholder.com/150'">
                    ${p.category.includes('عروض') ? '<span class="badge bg-danger position-absolute top-0 end-0 m-2">Hot</span>' : ''}
                </div>
                <div class="card-body p-2 d-flex flex-column text-dark">
                    <h6 class="card-title fw-bold text-truncate" onclick="openProductDetails('${p.id}')" style="cursor:pointer">${p.name}</h6>
                    <div class="star-rating small mb-1">${getStarHTML(p.ratingAvg)} <span class="text-muted" style="font-size:0.7rem">(${p.ratingCount})</span></div>
                    <small class="text-muted mb-2 fw-bold text-primary">${p.price} EGP</small>
                    <div class="mt-auto"><button class="btn btn-primary btn-sm w-100 fw-bold d-flex align-items-center justify-content-center gap-1" onclick="addToCart('${p.id}')"><i class="fa fa-cart-plus"></i> <span>إضافة</span></button></div>
                </div>
            </div>
        </div>`;
    }).join('');
}
window.renderProducts = (products) => { const grid = document.getElementById('productsGrid'); if(grid) grid.innerHTML = generateProductHTML(products); };

// 📸 Modal & Stock Logic
window.openProductDetails = (id) => {
    const p = allProducts.find(x => x.id === id); if(!p) return;
    currentProductId = id; 
    let imgs = p.images || [p.imageUrl];
    document.getElementById('modalTitle').innerText = p.name;
    document.getElementById('modalName').innerText = p.name;
    document.getElementById('modalPrice').innerText = p.price + ' EGP';
    document.getElementById('modalCategory').innerText = p.category;
    document.getElementById('modalDesc').innerText = p.description || "";
    document.getElementById('modalQty').value = 1;
    document.getElementById('mainModalImg').src = imgs[0];
    document.getElementById('thumbnailsContainer').innerHTML = imgs.map(i => `<img src="${i}" class="rounded border border-secondary" style="width:70px;height:70px;object-fit:cover;cursor:pointer;" onclick="changeMainImage(this.src)">`).join('');
    
    // Stock Logic
    const badge = document.getElementById('stockStatusBadge');
    const countText = document.getElementById('stockCountText');
    const addBtn = document.getElementById('modalAddToCart');
    if (p.inStock === false || (p.stockQty !== undefined && p.stockQty <= 0)) {
        badge.className = "badge bg-danger"; badge.innerText = "نفذت الكمية";
        addBtn.disabled = true; addBtn.innerText = "غير متوفر"; countText.innerText="";
    } else {
        badge.className = "badge bg-success"; badge.innerText = "متوفر";
        if(p.stockQty && p.stockQty < 10) countText.innerText = `(باقي ${p.stockQty})`; else countText.innerText="";
        addBtn.disabled = false; addBtn.innerHTML = '<i class="fa fa-cart-plus me-2"></i> إضافة';
        if(p.stockQty) document.getElementById('modalQty').max = p.stockQty;
    }

    let sHTML = '<span class="text-white-50 ms-2 small">قيّم: </span>';
    for(let i=1;i<=5;i++) sHTML+=`<i class="fa-star ${i<=(p.ratingAvg||5)?'fa-solid':'fa-regular'} text-warning mx-1" onclick="submitRating('${p.id}', ${i})"></i>`;
    document.getElementById('modalStars').innerHTML = sHTML + `<small class="text-white ms-2">(${p.ratingCount||0})</small>`;
    
    document.getElementById('modalAddToCart').onclick = () => { addToCart(p.id, parseInt(document.getElementById('modalQty').value)); bootstrap.Modal.getInstance(document.getElementById('productModal')).hide(); };
    loadReviews(id); document.getElementById('reviewForm').reset();
    new bootstrap.Modal(document.getElementById('productModal')).show();
};

// 🛒 Cart, Coupon, WhatsApp
window.addToCart = (id, qtyOverride = null) => {
    let qty = qtyOverride ? qtyOverride : 1;
    const product = allProducts.find(p => p.id === id);
    if (!product) return;
    if(product.stockQty && qty > product.stockQty) return toast('الكمية غير متوفرة', 'warning');
    const exist = cart.find(i => i.id === id);
    if (exist) {
        if(product.stockQty && (exist.qty + qty) > product.stockQty) return toast('وصلت للحد الأقصى', 'warning');
        exist.qty += qty; 
    } else cart.push({ ...product, qty });
    saveCart(); toast('تمت الإضافة', 'success');
};

function saveCart() { localStorage.setItem('cart', JSON.stringify(cart)); updateCartUI(); }
function calculateOriginalTotal() { return cart.reduce((sum, item) => sum + (item.price * item.qty), 0); }
function updateCartUI() {
    const container = document.getElementById('cartItems');
    if(!container) return;
    document.getElementById('cartCount').innerText = cart.length;
    let total = calculateOriginalTotal();
    if(cart.length === 0) { container.innerHTML = '<p class="text-center text-muted">فارغة</p>'; document.getElementById('totalPrice').innerText = '0'; return; }
    container.innerHTML = cart.map((item, i) => `<div class="d-flex justify-content-between align-items-center border-bottom py-2"><div><strong>${item.name}</strong><br><small>${item.price} x ${item.qty}</small></div><button class="btn btn-sm btn-outline-danger" onclick="removeFromCart(${i})">&times;</button></div>`).join('');
    if(appliedDiscount > 0) { const finalPrice = total - (total * appliedDiscount / 100); document.getElementById('totalPrice').innerHTML = `<span class="text-decoration-line-through text-muted small">${total}</span> <span class="text-warning fw-bold">${finalPrice} EGP</span><div class="badge bg-success small ms-1">كوبون ${appliedCouponCode}</div>`; } else { document.getElementById('totalPrice').innerText = total + ' EGP'; }
}
window.removeFromCart = (i) => { cart.splice(i, 1); saveCart(); };

window.applyCoupon = async () => {
    const code = document.getElementById('userCoupon').value.toUpperCase().trim();
    const msg = document.getElementById('couponMsg');
    if(!code) return;
    try {
        const docSnap = await getDoc(doc(db, "coupons", code));
        if(docSnap.exists() && docSnap.data().active) {
            appliedDiscount = docSnap.data().percent; appliedCouponCode = code;
            msg.innerText = `✅ خصم ${appliedDiscount}%`; msg.className = "d-block mt-1 text-success fw-bold"; updateCartUI();
        } else { appliedDiscount = 0; appliedCouponCode = ""; msg.innerText = "❌ خطأ"; msg.className = "d-block mt-1 text-danger"; updateCartUI(); }
    } catch(err) { console.error(err); }
};

document.getElementById('checkoutForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if(cart.length === 0) return toast('السلة فارغة', 'warning');
    const submitBtn = checkoutForm.querySelector('button[type="submit"]');
    const oldText = submitBtn.innerText; submitBtn.innerText = "جاري التحويل..."; submitBtn.disabled = true;
    try {
        const originalTotal = calculateOriginalTotal();
        const discountAmount = (originalTotal * appliedDiscount) / 100;
        const finalTotal = originalTotal - discountAmount;
        let whatsappPhone = "201000000000";
        try { const s = await getDoc(doc(db, "settings", "general")); if(s.exists() && s.data().whatsapp) whatsappPhone = s.data().whatsapp; } catch(e){}
        let cleanPhone = whatsappPhone.replace(/[^0-9]/g, ''); if(cleanPhone.startsWith('01') && cleanPhone.length === 11) cleanPhone = '2' + cleanPhone;
        const name = document.getElementById('c_name').value;
        await addDoc(collection(db, "orders"), {
            customer: name, phone: document.getElementById('c_phone').value, governorate: document.getElementById('c_gov').value,
            address: document.getElementById('c_address').value, items: cart, originalTotal, total: finalTotal,            
            couponUsed: appliedCouponCode || "", discountVal: discountAmount, date: new Date(), status: 'pending'
        });
        let msg = `*طلب* 🛒\n👤 ${name}\n💰 الصافي: ${finalTotal} EGP\n`;
        window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
        cart = []; appliedDiscount = 0; localStorage.removeItem('cart'); updateCartUI(); showSection('home');
    } catch(err) { Swal.fire('خطأ', 'مشكلة', 'error'); } finally { submitBtn.innerText = oldText; submitBtn.disabled = false; }
});

// 🎧 Live Chat (Client)
window.toggleChat = () => { if(!currentUser) return Swal.fire('تنبيه', 'سجل دخول بجوجل أولاً', 'info'); document.getElementById('chatBox').classList.toggle('d-none'); };
window.sendChatMessage = async (e) => {
    e.preventDefault(); const input = document.getElementById('chatInput'); const text = input.value.trim(); if(!text) return;
    await addDoc(collection(db, `chats/${currentUser.uid}/messages`), { text, sender: 'user', createdAt: serverTimestamp() });
    await setDoc(doc(db, "chats", currentUser.uid), { userName: currentUser.displayName, lastMessage: text, lastTime: serverTimestamp(), hasUnread: true }, { merge: true });
    input.value = '';
};
function listenToChat(userId) {
    onSnapshot(query(collection(db, `chats/${userId}/messages`), orderBy('createdAt', 'asc')), (snap) => {
        const b = document.getElementById('chatMessages'); b.innerHTML = '';
        snap.forEach(d => { const m = d.data(); b.innerHTML += `<div class="msg ${m.sender==='user'?'msg-user':'msg-support'}">${m.text}</div>`; });
        b.scrollTop = b.scrollHeight;
    });
}

// Reviews, Helpers
async function loadReviews(pid) {
    const c = document.getElementById('reviewsContainer'); c.innerHTML = '...';
    try {
        const snap = await getDocs(query(collection(db, "reviews"), where("productId", "==", pid), orderBy("date", "desc")));
        if (snap.empty) { c.innerHTML = '<small class="text-white-50">لا يوجد تعليقات</small>'; return; }
        let h = ''; snap.forEach(d => { const r = d.data(); h += `<div class="review-item mb-2 p-2 rounded bg-dark border-secondary"><div class="d-flex justify-content-between"><span class="fw-bold small">${r.author}</span><span class="small text-white-50">${r.date?new Date(r.date.toDate()).toLocaleDateString('ar-EG'):''}</span></div><p class="small m-0">${r.text}</p></div>`; });
        c.innerHTML = h;
    } catch(e) { c.innerHTML = '<small class="text-danger">Need Index</small>'; }
}
window.submitReview = async (e) => {
    e.preventDefault(); const a = document.getElementById('reviewAuthor').value; const t = document.getElementById('reviewText').value;
    if(!a || !t) return;
    await addDoc(collection(db, "reviews"), { productId: currentProductId, author: a, text: t, date: new Date() });
    document.getElementById('reviewForm').reset(); loadReviews(currentProductId); toast('تم النشر', 'success');
};
window.changeMainImage = (s) => document.getElementById('mainModalImg').src = s;
window.changeModalQty = (c) => { let i=document.getElementById('modalQty'); let v=parseInt(i.value)+c; if(v>=1) i.value=v; };
function toast(t, i) { Swal.mixin({toast: true, position: 'top-end', showConfirmButton: false, timer: 1500}).fire({icon: i, title: t}); }
window.filterCat = (cat, btn) => { document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); renderProducts(cat === 'all' ? allProducts : allProducts.filter(p => p.category === cat)); };
function buildCategoriesMenu() { const w = document.getElementById('categoriesWrapper'); if(!w) return; const cats = new Set(allProducts.map(p => p.category)); let h = `<div class="cat-btn active" onclick="filterCat('all', this)">الكل</div>`; cats.forEach(cat => { if(!cat.includes('عروض')) h += `<div class="cat-btn" onclick="filterCat('${cat}', this)">${cat}</div>`; }); w.innerHTML = h; }
function getStarHTML(r) { let s=''; for(let i=1;i<=5;i++) s+=`<i class="fa-star ${i<=r?'fa-solid':'fa-regular'} text-warning"></i>`; return s; }