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

import { db, collection, getDocs, addDoc, doc, getDoc, updateDoc, setDoc, auth, googleProvider, facebookProvider, signInWithPopup, signOut, onSnapshot, query, orderBy, serverTimestamp, onAuthStateChanged, where, increment } from './firebase-config.js';
// ============================================
// 1. المتغيرات العامة
// ============================================
let allProducts = [];
let cart = JSON.parse(localStorage.getItem('cart')) || [];
let wishlist = JSON.parse(localStorage.getItem('wishlist')) || [];
let appliedDiscount = 0;
let appliedCouponCode = "";
let currentProductId = null;
let currentUser = null;

const governorates = ["القاهرة", "الجيزة", "الإسكندرية", "الدقهلية", "الشرقية", "المنوفية", "القليوبية", "البحيرة", "الغربية", "بور سعيد", "دمياط", "الإسماعيلية", "السويس", "كفر الشيخ", "الفيوم", "بني سويف", "المنيا", "أسيوط", "سوهاج", "قنا", "الأقصر", "أسوان", "البحر الأحمر", "الوادي الجديد", "مطروح", "شمال سيناء", "جنوب سيناء"];

// ============================================
// 2. التحميل والبدء
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    const govSelect = document.getElementById('c_gov');
    if(govSelect) {
        governorates.forEach(g => {
            const op = document.createElement('option');
            op.value = g; op.innerText = g; govSelect.appendChild(op);
        });
    }
    
    updateCartUI();
    await fetchProducts();
    updateContactWhatsapp();
});

// التنقل بين الأقسام
window.showSection = (id) => {
    document.querySelectorAll('.page-section').forEach(s => s.classList.add('d-none'));
    const section = document.getElementById(id);
    if(section) section.classList.remove('d-none');
    window.scrollTo(0,0);
}

// تحديث زر الواتساب العائم
async function updateContactWhatsapp() {
    const floatingBtn = document.querySelector('.floating-whatsapp');
    if(!floatingBtn) return;
    try {
        const s = await getDoc(doc(db, "settings", "general")); 
        if(s.exists() && s.data().whatsapp) {
            let phone = s.data().whatsapp.toString().replace(/[^0-9]/g, '');
            if (phone.startsWith('01')) phone = '2' + phone;
            floatingBtn.href = `https://wa.me/${phone}`;
        }
    } catch(e) { console.log("Using default whatsapp"); }
}

// ============================================
// 3. جلب المنتجات
// ============================================
async function fetchProducts() {
    const grid = document.getElementById('productsGrid');
    const offersGrid = document.getElementById('offersGrid');
    const offersSection = document.getElementById('offersSection');

    // Skeleton Loading
    if(grid) {
        grid.innerHTML = Array(10).fill(0).map(() => `
            <div class="col">
                <div class="product-card h-100 p-2" style="background: rgba(255,255,255,0.05);">
                    <div class="skeleton w-100" style="height: 180px; margin-bottom: 10px;"></div>
                    <div class="skeleton w-75" style="height: 20px;"></div>
                </div>
            </div>`).join('');
    }

    try {
        const snap = await getDocs(collection(db, "products"));
        allProducts = [];
        snap.forEach(d => {
            const data = d.data();
            if(data.isVisible !== false) {
                allProducts.push({ 
                    id: d.id, ...data,
                    category: data.category ? data.category.trim() : "عام",
                    subCategory: data.subCategory ? data.subCategory.trim() : "",
                    ratingAvg: data.ratingAvg || 5, 
                    ratingCount: data.ratingCount || 0
                });
            }
        });

        // العروض
        const offers = allProducts.filter(p => p.category.includes('عروض') || p.category.includes('Offers'));
        if (offers.length > 0 && offersGrid) {
            offersSection.classList.remove('d-none');
            offersGrid.innerHTML = generateProductHTML(offers);
        } else if (offersSection) {
            offersSection.classList.add('d-none');
        }

        renderProducts(allProducts);
        buildCategoriesMenu();

    } catch (error) {
        console.error("Error fetching products:", error);
        if(grid) grid.innerHTML = '<div class="alert alert-danger w-100 text-center">حدث خطأ في تحميل المنتجات.</div>';
    }
}

function generateProductHTML(products) {
    if(products.length === 0) return '<p class="text-white text-center w-100">لا توجد منتجات.</p>';
    
    return products.map(p => {
        const isFav = wishlist.includes(p.id) ? 'active' : '';
        return `
        <div class="col">
            <div class="product-card h-100 d-flex flex-column shadow-sm position-relative">
                <button class="wishlist-btn ${isFav}" onclick="toggleWishlist('${p.id}', this)">
                    <i class="fa-solid fa-heart"></i>
                </button>
                <div style="position:relative; cursor: pointer;" onclick="openProductDetails('${p.id}')">
                    <img src="${p.imageUrl}" class="card-img-top" style="height:180px; object-fit:cover;" onerror="this.src='https://via.placeholder.com/150'">
                    ${p.category.includes('عروض') ? '<span class="badge bg-danger position-absolute top-0 end-0 m-2">Hot</span>' : ''}
                </div>
                <div class="card-body p-2 d-flex flex-column text-dark">
                    <h6 class="card-title fw-bold text-truncate" onclick="openProductDetails('${p.id}')" style="cursor:pointer">${p.name}</h6>
                    <div class="star-rating small mb-1">
                        ${getStarHTML(p.ratingAvg)} <span class="text-muted" style="font-size:0.7rem">(${p.ratingCount})</span>
                    </div>
                    <small class="text-muted mb-2 fw-bold text-primary">${p.price} EGP</small>
                    <div class="mt-auto">
                        <button class="btn btn-primary btn-sm w-100 fw-bold d-flex align-items-center justify-content-center gap-1" onclick="addToCart('${p.id}')">
                            <i class="fa fa-cart-plus"></i> <span>إضافة</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>`;
    }).join('');
}

window.renderProducts = (p) => { 
    const grid = document.getElementById('productsGrid'); 
    if(grid) grid.innerHTML = generateProductHTML(p); 
};

// ============================================
// 🔐 4. تسجيل الدخول (Fixed)
// ============================================

// ✅ تعريف الدالة بشكل صريح للويندوز لتفادي الخطأ
window.openAuthModal = () => {
    const modal = new bootstrap.Modal(document.getElementById('authModal'));
    modal.show();
};

window.socialLogin = async (providerName) => {
    const provider = providerName === 'google' ? googleProvider : facebookProvider;
    try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        
        await setDoc(doc(db, "users", user.uid), {
            name: user.displayName,
            email: user.email,
            photo: user.photoURL,
            role: "customer"
        }, { merge: true });

        // إغلاق المودال
        const modalEl = document.getElementById('authModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        if(modal) modal.hide();

        toast(`مرحباً ${user.displayName}`, 'success');
    } catch (error) {
        console.error(error);
        toast('فشل الدخول', 'error');
    }
};

onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    const signupBtn = document.getElementById('signupBtn');
    const userIcon = document.getElementById('userProfileIcon');
    const mainLoginBtn = document.getElementById('mainLoginBtn');
    const adminPanelBtn = document.getElementById('adminPanelBtn');

    if (user) {
        signupBtn.classList.add('d-none');
        mainLoginBtn.classList.add('d-none');
        
        userIcon.classList.remove('d-none');
        userIcon.classList.add('d-flex');
        document.getElementById('userAvatar').src = user.photoURL || 'https://via.placeholder.com/35';
        
        // التحقق من الدور
        try {
            const docSnap = await getDoc(doc(db, "users", user.uid));
            const role = docSnap.exists() ? docSnap.data().role : 'customer';
            
            if(role === 'admin' || role === 'support' || role === 'sales') {
                if(adminPanelBtn) adminPanelBtn.classList.remove('d-none');
            }
        } catch(e) { console.log(e); }

        // تعبئة الاسم في السلة
        const nameInput = document.getElementById('c_name'); 
        if(nameInput && !nameInput.value) nameInput.value = user.displayName;
        
        listenToChat(user.uid);
    } else {
        signupBtn.classList.remove('d-none');
        mainLoginBtn.classList.remove('d-none');
        userIcon.classList.add('d-none');
        userIcon.classList.remove('d-flex');
    }
});

window.openProfileModal = () => {
    if(!currentUser) return;
    document.getElementById('profileImage').src = currentUser.photoURL || 'https://via.placeholder.com/80';
    document.getElementById('profileName').innerText = currentUser.displayName;
    document.getElementById('profileEmail').innerText = currentUser.email;
    
    // تحميل الطلبات السابقة
    loadUserOrders();
    
    new bootstrap.Modal(document.getElementById('profileModal')).show();
};

// دالة تسجيل الخروج
window.logoutUser = () => {
    signOut(auth).then(() => {
        // إغلاق المودال
        const modalEl = document.getElementById('profileModal');
        if(modalEl) {
            const modal = bootstrap.Modal.getInstance(modalEl);
            if(modal) modal.hide();
        }
        // إعادة تحميل الصفحة
        window.location.reload();
    }).catch((error) => {
        console.error("Logout Error:", error);
    });
};

// ============================================
// 📸 5. تفاصيل المنتج (الوصف والكمية)
// ============================================
window.openProductDetails = (id) => {
    const p = allProducts.find(x => x.id === id); if(!p) return;
    currentProductId = id; 

    let imgs = p.images || [p.imageUrl];
    document.getElementById('modalTitle').innerText = p.name;
    document.getElementById('modalName').innerText = p.name;
    document.getElementById('modalPrice').innerText = p.price + ' EGP';
    document.getElementById('modalCategory').innerText = p.category;
    
    // الوصف
    const descEl = document.getElementById('modalDesc');
    if (descEl) {
        descEl.innerText = (p.description && String(p.description).trim() !== "") ? p.description : "لا يوجد وصف متاح.";
    }

    document.getElementById('modalQty').value = 1;
    document.getElementById('mainModalImg').src = imgs[0];
    document.getElementById('thumbnailsContainer').innerHTML = imgs.map(i => `<img src="${i}" class="rounded border border-secondary" style="width:70px;height:70px;object-fit:cover;cursor:pointer;" onclick="changeMainImage(this.src)">`).join('');
    
    // المخزون
    const badge = document.getElementById('stockStatusBadge');
    const countText = document.getElementById('stockCountText');
    const addBtn = document.getElementById('modalAddToCart');
    const qtyInput = document.getElementById('modalQty');
    const stock = p.stockQty !== undefined ? Number(p.stockQty) : 0;

    if (p.inStock === false || stock <= 0) {
        badge.className = "badge bg-danger"; badge.innerText = "نفذت الكمية";
        countText.innerText = "";
        addBtn.disabled = true; addBtn.innerText = "غير متوفر";
    } else {
        badge.className = "badge bg-success"; badge.innerText = "متوفر";
        countText.innerText = `(المتاح: ${stock} قطعة)`;
        addBtn.disabled = false; addBtn.innerHTML = '<i class="fa fa-cart-plus me-2"></i> إضافة للسلة';
        qtyInput.max = stock;
    }

    // النجوم
    let sHTML = '<span class="text-white-50 ms-2 small">قيّم: </span>';
    for(let i=1;i<=5;i++) sHTML+=`<i class="fa-star ${i<=(p.ratingAvg||5)?'fa-solid':'fa-regular'} text-warning mx-1" onclick="submitRating('${p.id}', ${i})"></i>`;
    document.getElementById('modalStars').innerHTML = sHTML + `<small class="text-white ms-2">(${p.ratingCount||0})</small>`;
    
    // زر الإضافة
    document.getElementById('modalAddToCart').onclick = () => { 
        const q = parseInt(qtyInput.value);
        if(stock > 0 && q > stock) return toast('الكمية غير متاحة', 'warning');
        addToCart(p.id, q); 
        bootstrap.Modal.getInstance(document.getElementById('productModal')).hide(); 
    };
    
    // المنتجات المشابهة
    showRelatedProducts(id, p.category);

    // التعليقات
    loadReviews(id); 
    if(document.getElementById('reviewForm')) document.getElementById('reviewForm').reset();
    
    new bootstrap.Modal(document.getElementById('productModal')).show();
};

// ============================================
// 🏷️ 6. الكوبونات
// ============================================
window.applyCoupon = async () => {
    const codeInput = document.getElementById('userCoupon');
    const msg = document.getElementById('couponMsg');
    
    if(!codeInput) return; 
    
    const code = codeInput.value.toUpperCase().trim();
    if(!code) {
        msg.innerText = "يرجى إدخال الكود"; msg.className = "d-block mt-1 text-warning"; return;
    }

    const btn = document.querySelector('button[onclick="applyCoupon()"]');
    if(btn) { btn.disabled = true; btn.innerText = "..."; }

    try {
        const docSnap = await getDoc(doc(db, "coupons", code));
        if(docSnap.exists() && docSnap.data().active) {
            appliedDiscount = docSnap.data().percent;
            appliedCouponCode = code;
            msg.innerText = `✅ تم خصم ${appliedDiscount}%`; msg.className = "d-block mt-1 text-success fw-bold";
            updateCartUI();
        } else {
            appliedDiscount = 0; appliedCouponCode = "";
            msg.innerText = "❌ الكود غير صحيح"; msg.className = "d-block mt-1 text-danger";
            updateCartUI();
        }
    } catch(err) { 
        console.error("Coupon Error:", err); 
        msg.innerText = "خطأ في الاتصال"; msg.className = "d-block mt-1 text-warning";
    } finally { 
        if(btn) { btn.disabled = false; btn.innerText = "تطبيق"; }
    }
};

// ============================================
// 🛒 7. السلة والواتساب
// ============================================
window.addToCart = (id, qtyOverride = null) => {
    let qty = qtyOverride ? qtyOverride : 1;
    const p = allProducts.find(p => p.id === id); if (!p) return;
    if(p.stockQty && qty > p.stockQty) return toast('الكمية غير متوفرة', 'warning');
    
    const exist = cart.find(i => i.id === id);
    if (exist) {
        if(p.stockQty && (exist.qty + qty) > p.stockQty) return toast('وصلت للحد الأقصى', 'warning');
        exist.qty += qty; 
    } else cart.push({ ...p, qty });
    saveCart(); toast('تمت الإضافة', 'success');
};

function saveCart() { localStorage.setItem('cart', JSON.stringify(cart)); updateCartUI(); }
function calculateOriginalTotal() { return cart.reduce((sum, item) => sum + (item.price * item.qty), 0); }

function updateCartUI() {
    const container = document.getElementById('cartItems');
    if(!container) return;
    document.getElementById('cartCount').innerText = cart.length;
    let total = calculateOriginalTotal();
    
    if(cart.length === 0) {
        container.innerHTML = '<p class="text-center text-muted">فارغة</p>';
        document.getElementById('totalPrice').innerText = '0';
        return;
    }
    container.innerHTML = cart.map((item, i) => `
        <div class="d-flex justify-content-between align-items-center border-bottom py-2">
            <div><strong>${item.name}</strong><br><small>${item.price} x ${item.qty}</small></div>
            <button class="btn btn-sm btn-outline-danger" onclick="removeFromCart(${i})">&times;</button>
        </div>`).join('');
    
    if(appliedDiscount > 0) {
        const finalPrice = total - (total * appliedDiscount / 100);
        document.getElementById('totalPrice').innerHTML = `<span class="text-decoration-line-through text-muted small">${total}</span> <span class="text-warning fw-bold">${finalPrice} EGP</span><div class="badge bg-success small ms-1">كوبون ${appliedCouponCode}</div>`;
    } else { document.getElementById('totalPrice').innerText = total + ' EGP'; }
}
window.removeFromCart = (i) => { cart.splice(i, 1); saveCart(); };

// ============================================
// 📱 إتمام الطلب + خصم المخزون + الواتساب
// ============================================
document.getElementById('checkoutForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if(cart.length === 0) return toast('السلة فارغة', 'warning');
    
    const submitBtn = checkoutForm.querySelector('button[type="submit"]');
    const oldText = submitBtn.innerText; 
    submitBtn.innerText = "جاري التنفيذ..."; 
    submitBtn.disabled = true;

    try {
        // 1. خصم الكميات من المخزون (الخطوة الجديدة)
        // بنعمل Loop على كل منتج في السلة ونخصم عدده من الداتابيز
        const updatePromises = cart.map(item => {
            const productRef = doc(db, "products", item.id);
            // increment(-item.qty) معناها نقص العدد بالقيمة دي
            return updateDoc(productRef, {
                stockQty: increment(-item.qty)
            });
        });
        
        // ننتظر لحد ما يخلص خصم كل المنتجات
        await Promise.all(updatePromises);

        // 2. باقي خطوات الطلب العادية (كما كانت)
        const originalTotal = calculateOriginalTotal();
        const discountAmount = (originalTotal * appliedDiscount) / 100;
        const finalTotal = originalTotal - discountAmount;

        let whatsappPhone = "201000000000";
        try { const s = await getDoc(doc(db, "settings", "general")); if(s.exists() && s.data().whatsapp) whatsappPhone = s.data().whatsapp; } catch(e){}
        let cleanPhone = whatsappPhone.toString().replace(/[^0-9]/g, '');
        if(cleanPhone.startsWith('01') && cleanPhone.length === 11) cleanPhone = '2' + cleanPhone;

        const name = document.getElementById('c_name').value;
        const phone = document.getElementById('c_phone').value;
        const gov = document.getElementById('c_gov').value;
        const address = document.getElementById('c_address').value;
        
        await addDoc(collection(db, "orders"), {
            customer: name, phone: phone, governorate: gov, address: address,
            items: cart, originalTotal: originalTotal, total: finalTotal,            
            couponUsed: appliedCouponCode || "", discountVal: discountAmount,  
            date: new Date(), status: 'pending'
        });
        
        let msg = `*طلب جديد* 🛒\n👤 ${name}\n📱 ${phone}\n📍 ${gov} - ${address}\n\n*🧾 المنتجات:* \n`;
        cart.forEach(i => msg += `▫️ ${i.name} (${i.qty})\n`);
        msg += `\n💰 الأصل: ${originalTotal} EGP\n`;
        if(appliedDiscount>0) msg += `🎟️ خصم: -${discountAmount} (${appliedCouponCode})\n`;
        msg += `💵 الصافي: ${finalTotal} EGP\n`;

        window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
        
        cart = []; appliedDiscount = 0; appliedCouponCode = ""; localStorage.removeItem('cart'); updateCartUI(); showSection('home');
        
        // تحديث المنتجات في الصفحة عشان الرقم الجديد يظهر
        await fetchProducts();

    } catch(err) { 
        console.error(err); 
        Swal.fire('خطأ', 'حدثت مشكلة أثناء الطلب', 'error'); 
    } finally { 
        submitBtn.innerText = oldText; submitBtn.disabled = false; 
    }
});

// ============================================
// 8. سجل الطلبات والمنتجات المشابهة
// ============================================
async function loadUserOrders() {
    const container = document.getElementById('userOrdersHistory');
    if(!currentUser) { container.innerHTML = '<p class="text-white-50 small text-center">سجل دخول لعرض طلباتك</p>'; return; }
    container.innerHTML = '<div class="text-center"><span class="spinner-border spinner-border-sm text-light"></span></div>';
    try {
        const q = query(collection(db, "orders"), where("customer", "==", currentUser.displayName), orderBy("date", "desc"));
        const snap = await getDocs(q);
        if(snap.empty) { container.innerHTML = '<p class="text-white-50 small text-center">لا توجد طلبات</p>'; return; }
        let html = '';
        snap.forEach(doc => {
            const o = doc.data(); const date = o.date ? new Date(o.date.toDate()).toLocaleDateString('ar-EG') : '';
            let badge = 'bg-warning', txt = 'انتظار';
            if(o.status === 'shipped') { badge = 'bg-info'; txt = 'تم الشحن'; }
            if(o.status === 'delivered') { badge = 'bg-success'; txt = 'مكتمل'; }
            if(o.status === 'cancelled') { badge = 'bg-danger'; txt = 'ملغي'; }
            html += `<div class="d-flex justify-content-between align-items-center border-bottom border-secondary py-2"><div><span class="text-white small fw-bold">${date}</span><br><span class="text-white-50 small" style="font-size: 0.7rem;">${o.total}</span></div><span class="badge ${badge}" style="font-size: 0.7rem;">${txt}</span></div>`;
        });
        container.innerHTML = html;
    } catch (e) { container.innerHTML = '<p class="text-danger small text-center">خطأ تحميل</p>'; }
}

function showRelatedProducts(currentId, category) {
    const container = document.getElementById('relatedProductsContainer');
    container.innerHTML = '';
    const related = allProducts.filter(p => p.category === category && p.id !== currentId);
    const toShow = related.slice(0, 4);
    if(toShow.length === 0) { container.innerHTML = '<small class="text-white-50">لا يوجد مشابه</small>'; return; }
    toShow.forEach(p => {
        container.innerHTML += `<div class="glass-card p-2 text-center" style="min-width: 120px; cursor: pointer;" onclick="bootstrap.Modal.getInstance(document.getElementById('productModal')).hide(); setTimeout(()=>openProductDetails('${p.id}'), 300);"><img src="${p.imageUrl}" class="rounded mb-2" style="width: 100%; height: 80px; object-fit: cover;"><h6 class="text-white small text-truncate m-0">${p.name}</h6><small class="text-warning fw-bold">${p.price} EGP</small></div>`;
    });
}

// Helpers
window.toggleWishlist = (id, btn) => { event.stopPropagation(); if (wishlist.includes(id)) { wishlist = wishlist.filter(item => item !== id); btn.classList.remove('active'); toast('تم الحذف', 'info'); } else { wishlist.push(id); btn.classList.add('active'); toast('تمت الإضافة', 'success'); } localStorage.setItem('wishlist', JSON.stringify(wishlist)); };
window.changeMainImage = (s) => document.getElementById('mainModalImg').src = s;
window.changeModalQty = (c) => { let i=document.getElementById('modalQty'); let v=parseInt(i.value)+c; if(v>=1) i.value=v; };
function toast(t, i) { Swal.mixin({toast: true, position: 'top-end', showConfirmButton: false, timer: 1500}).fire({icon: i, title: t}); }
window.filterCat = (cat, btn) => { document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); renderProducts(cat === 'all' ? allProducts : allProducts.filter(p => p.category === cat)); };
function buildCategoriesMenu() { const w = document.getElementById('categoriesWrapper'); if(!w) return; const cats = new Set(allProducts.map(p => p.category)); let h = `<div class="cat-btn active" onclick="filterCat('all', this)">الكل</div>`; cats.forEach(cat => { if(!cat.includes('عروض')) h += `<div class="cat-btn" onclick="filterCat('${cat}', this)">${cat}</div>`; }); w.innerHTML = h; }
function getStarHTML(r) { let s=''; for(let i=1;i<=5;i++) s+=`<i class="fa-star ${i<=r?'fa-solid':'fa-regular'} text-warning"></i>`; return s; }
window.submitRating = async (id, rating) => { const p = allProducts.find(x => x.id === id); if(!p) return; const newCount = (p.ratingCount||0) + 1; const newAvg = (((p.ratingAvg||5)*(p.ratingCount||0)) + rating) / newCount; await updateDoc(doc(db, "products", id), { ratingAvg: newAvg, ratingCount: newCount }); p.ratingAvg = newAvg; p.ratingCount = newCount; openProductDetails(id); renderProducts(allProducts); toast('تم التقييم', 'success'); };
window.toggleChat = () => { if(!currentUser) return Swal.fire('تنبيه', 'سجل دخول أولاً', 'info'); document.getElementById('chatBox').classList.toggle('d-none'); };
window.sendChatMessage = async (e) => { e.preventDefault(); const t = document.getElementById('chatInput').value; await addDoc(collection(db, `chats/${currentUser.uid}/messages`), { text:t, sender:'user', createdAt:serverTimestamp() }); await setDoc(doc(db, "chats", currentUser.uid), { userName: currentUser.displayName, lastMessage: t, lastTime: serverTimestamp(), hasUnread: true }, { merge: true }); document.getElementById('chatInput').value=''; };
function listenToChat(uid) { onSnapshot(query(collection(db, `chats/${uid}/messages`), orderBy('createdAt','asc')), (s)=>{ document.getElementById('chatMessages').innerHTML = ''; s.forEach(d=>{ const m=d.data(); document.getElementById('chatMessages').innerHTML += `<div class="msg ${m.sender==='user'?'msg-user':'msg-support'}">${m.text}</div>`; }); }); }
async function loadReviews(pid) { const c = document.getElementById('reviewsContainer'); const s = await getDocs(query(collection(db, "reviews"), where("productId","==",pid), orderBy("date","desc"))); c.innerHTML = ''; s.forEach(d=>{ const r=d.data(); c.innerHTML+=`<div class="review-item mb-2"><small><b>${r.author}</b>: ${r.text}</small></div>`; }); }
window.submitReview = async (e) => { e.preventDefault(); const a = document.getElementById('reviewAuthor').value; const t = document.getElementById('reviewText').value; await addDoc(collection(db, "reviews"), { productId:currentProductId, author:a, text:t, date:new Date() }); toast('تم النشر', 'success'); loadReviews(currentProductId); document.getElementById('reviewForm').reset(); };
const searchInput = document.getElementById('smartSearchInput'); const searchDropdown = document.getElementById('searchResults'); if(searchInput) { searchInput.addEventListener('input', (e) => { const val = e.target.value.toLowerCase(); searchDropdown.innerHTML = ''; if(val.length < 2) { searchDropdown.style.display = 'none'; renderProducts(allProducts); return; } const filtered = allProducts.filter(p => p.name.toLowerCase().includes(val) || p.category.toLowerCase().includes(val)); renderProducts(filtered); if(filtered.length > 0) { searchDropdown.style.display = 'block'; filtered.slice(0, 5).forEach(p => { searchDropdown.innerHTML += `<div class="search-item text-white" onclick="openProductDetails('${p.id}'); document.getElementById('searchResults').style.display='none'"><img src="${p.imageUrl}"><div><div class="fw-bold">${p.name}</div><small class="text-warning">${p.price} EGP</small></div></div>`; }); } else { searchDropdown.style.display = 'none'; } }); }
window.shareProduct = async () => { const p = allProducts.find(x => x.id === currentProductId); if(!p) return; const shareData = { title: 'متجري', text: `شاهد: ${p.name} بـ ${p.price} EGP`, url: window.location.href }; try { if (navigator.share) await navigator.share(shareData); else { await navigator.clipboard.writeText(`${shareData.text}\n${shareData.url}`); toast('تم نسخ الرابط', 'success'); } } catch (err) { console.error(err); } };