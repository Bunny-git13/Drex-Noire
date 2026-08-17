import { initializeApp }
from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";

import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
}
from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    getDatabase,
    ref,
    onValue,
    push,
    set,
    update
}
from "https://www.gstatic.com/firebasejs/12.1.0/firebase-database.js";


/* =====================================================
   FIREBASE
   ===================================================== */

const firebaseConfig = {
  apiKey: "AIzaSyB5xI2RaZvBV3OQH6zgJSRPJqNbr6l1wII",
  authDomain: "drex-noire-f5906.firebaseapp.com",
  databaseURL: "https://drex-noire-f5906-default-rtdb.firebaseio.com",
  projectId: "drex-noire-f5906",
  storageBucket: "drex-noire-f5906.firebasestorage.app",
  messagingSenderId: "220525587244",
  appId: "1:220525587244:web:446836a28b59395bcb5a89"
}; 


const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

const db = getDatabase(app);


/* =====================================================
   STATE
   ===================================================== */

let products = [];

let cart =
    JSON.parse(
        localStorage.getItem("drexCart") || "[]"
    );

let currentUser = null;

let selectedPayment = null;

let upiId = "";

let upiName = "Drex Noiré";

let orders = [];

let authMode = "login";


/* =====================================================
   PAGE
   ===================================================== */

window.showPage = function(name){

    document
        .querySelectorAll(".page")
        .forEach(page =>
            page.classList.remove("active")
        );

    const page =
        document.getElementById(
            name + "Page"
        );

    if(page){

        page.classList.add("active");

        window.scrollTo({
            top:0,
            behavior:"smooth"
        });

    }

    if(name === "orders")
        renderOrders();

};


/* =====================================================
   LOADER
   ===================================================== */

window.addEventListener("load",()=>{

    setTimeout(()=>{

        const loader =
            document.getElementById("loader");

        loader.style.opacity="0";

        setTimeout(()=>{
            loader.remove();
        },500);

    },600);

});


/* =====================================================
   PRODUCTS FROM REALTIME DATABASE
   ===================================================== */

onValue(
    ref(db,"products"),
    snapshot => {

        const data =
            snapshot.val() || {};

        products =
            Object.entries(data)
            .map(([id,value])=>({

                id,
                ...value

            }))
            .filter(
                product =>
                product.active !== false
            );

        renderProducts();

    },

    error => {

        console.error(error);

        toast(
            "Unable to load collection."
        );

    }
);


/* =====================================================
   UPI FROM FIREBASE
   ===================================================== */

onValue(
    ref(db,"settings/store"),
    snapshot => {

        const data =
            snapshot.val() || {};

        upiId =
            data.upiId || "";

        upiName =
            data.upiName ||
            "Drex Noiré";

        document.getElementById(
            "upiDisplayName"
        ).textContent = upiName;

        document.getElementById(
            "upiDisplayId"
        ).textContent =
            upiId || "UPI not configured";

    }
);


/* =====================================================
   PRODUCTS
   ===================================================== */

function renderProducts(){

    renderGrid(
        document.getElementById(
            "shopProducts"
        ),
        products
    );

    renderGrid(
        document.getElementById(
            "featuredProducts"
        ),
        products.slice(0,4)
    );

}


function renderGrid(container,list){

    if(!list.length){

        container.innerHTML =
            `<p style="padding:10px;color:#777;font-size:11px">
                No products available.
            </p>`;

        return;

    }

    container.innerHTML =
        list.map(product => `

        <article class="product">

            <div
                class="product-image"
                onclick="openProduct('${product.id}')"
            >

                <img
                    src="${safe(product.image)}"
                    alt=""
                    onerror="this.style.display='none'"
                >

            </div>

            <div class="product-info">

                <small class="category">
                    ${safe(product.category)}
                </small>

                <h3>
                    ${safe(product.name)}
                </h3>

                <div class="price">
                    ₹${money(product.price)}
                </div>

                <div class="stock">
                    ${
                        Number(product.stock || 0) > 0
                        ? "In stock"
                        : "Sold out"
                    }
                </div>

                <button
                    class="product-action"
                    onclick="addToCart('${product.id}')"
                    ${
                        Number(product.stock || 0) <= 0
                        ? "disabled"
                        : ""
                    }
                >
                    ADD TO BAG
                </button>

            </div>

        </article>

        `).join("");

}


/* =====================================================
   SEARCH
   ===================================================== */

document
.getElementById("searchInput")
.addEventListener("input",filterProducts);

document
.getElementById("categoryFilter")
.addEventListener("change",filterProducts);


function filterProducts(){

    const search =
        document.getElementById(
            "searchInput"
        ).value.toLowerCase();

    const category =
        document.getElementById(
            "categoryFilter"
        ).value;

    const result =
        products.filter(product => {

            const name =
                String(product.name || "")
                .toLowerCase();

            const matchesSearch =
                name.includes(search);

            const matchesCategory =
                category === "all" ||
                product.category === category;

            return (
                matchesSearch &&
                matchesCategory
            );

        });

    renderGrid(
        document.getElementById(
            "shopProducts"
        ),
        result
    );

}


/* =====================================================
   PRODUCT DETAIL
   ===================================================== */

window.openProduct = function(id){

    const p =
        products.find(
            product => product.id === id
        );

    if(!p)return;

    document.getElementById(
        "productDetail"
    ).innerHTML = `

        <div class="detail-image">
            <img src="${safe(p.image)}" alt="">
        </div>

        <div class="detail-info">

            <small class="detail-category">
                ${safe(p.category)}
            </small>

            <h1>
                ${safe(p.name)}
            </h1>

            <div class="detail-price">
                ₹${money(p.price)}
            </div>

            <p class="description">
                ${safe(p.description)}
            </p>

            <button
                class="black-btn full"
                onclick="addToCart('${p.id}')"
            >
                ADD TO BAG
            </button>

        </div>
    `;

    showPage("product");

};


/* =====================================================
   CART
   ===================================================== */

function saveCart(){

    localStorage.setItem(
        "drexCart",
        JSON.stringify(cart)
    );

}


function updateCartCount(){

    const count =
        cart.reduce(
            (sum,item) =>
            sum + item.quantity,
            0
        );

    document.getElementById(
        "cartCount"
    ).textContent = count;

}


updateCartCount();


window.addToCart = function(id){

    const product =
        products.find(
            p => p.id === id
        );

    if(!product)return;

    if(Number(product.stock || 0) <= 0){

        toast("This product is sold out.");

        return;

    }

    const item =
        cart.find(
            item => item.id === id
        );

    if(item){

        item.quantity++;

    }else{

        cart.push({
            id,
            quantity:1
        });

    }

    saveCart();

    updateCartCount();

    toast("Added to bag.");

};


window.openCart = function(){

    renderCart();

    document
        .getElementById("cartOverlay")
        .classList.add("show");

};


window.closeCart = function(){

    document
        .getElementById("cartOverlay")
        .classList.remove("show");

};


function renderCart(){

    const container =
        document.getElementById(
            "cartItems"
        );

    if(!cart.length){

        container.innerHTML =
            "<p>Your bag is empty.</p>";

        document.getElementById(
            "cartTotal"
        ).textContent = "₹0";

        return;

    }

    let total=0;

    container.innerHTML =
        cart.map(item => {

            const p =
                products.find(
                    product =>
                    product.id === item.id
                );

            if(!p)return "";

            const value =
                Number(p.price || 0)
                * item.quantity;

            total += value;

            return `

                <div class="cart-item">

                    <img
                        src="${safe(p.image)}"
                        alt=""
                    >

                    <div>

                        <h4>
                            ${safe(p.name)}
                        </h4>

                        <p>
                            ₹${money(p.price)}
                            × ${item.quantity}
                        </p>

                    </div>

                    <button
                        class="remove"
                        onclick="removeCart('${p.id}')"
                    >
                        REMOVE
                    </button>

                </div>

            `;

        }).join("");

    document.getElementById(
        "cartTotal"
    ).textContent =
        "₹" + money(total);

}


window.removeCart = function(id){

    cart =
        cart.filter(
            item => item.id !== id
        );

    saveCart();

    updateCartCount();

    renderCart();

};


/* =====================================================
   CHECKOUT
   ===================================================== */

window.openCheckout = function(){

    if(!cart.length){

        toast("Your bag is empty.");

        return;

    }

    if(!currentUser){

        closeCart();

        openAuth("login");

        toast(
            "Login required for checkout."
        );

        return;

    }

    closeCart();

    renderCheckout();

    showPage("checkout");

};


function cartTotal(){

    return cart.reduce(
        (total,item)=>{

            const p =
                products.find(
                    product =>
                    product.id === item.id
                );

            return total +
                (
                    Number(p?.price || 0)
                    * item.quantity
                );

        },
        0
    );

}


function renderCheckout(){

    let total=0;

    const box =
        document.getElementById(
            "checkoutItems"
        );

    box.innerHTML =
        cart.map(item => {

            const p =
                products.find(
                    product =>
                    product.id === item.id
                );

            if(!p)return "";

            const amount =
                Number(p.price || 0)
                * item.quantity;

            total += amount;

            return `

                <div class="summary-item">

                    <span>
                        ${safe(p.name)}
                        ×${item.quantity}
                    </span>

                    <b>
                        ₹${money(amount)}
                    </b>

                </div>
            `;

        }).join("");

    document.getElementById(
        "checkoutTotal"
    ).textContent =
        "₹" + money(total);

    updateCOD(total);

}


function updateCOD(total){

    const button =
        document.getElementById(
            "codButton"
        );

    if(total > 9999){

        button.disabled=true;

        document.getElementById(
            "codMessage"
        ).textContent =
            "Unavailable above ₹9,999";

    }else{

        button.disabled=false;

        document.getElementById(
            "codMessage"
        ).textContent =
            "Available for eligible orders";

    }

}


/* =====================================================
   PAYMENT
   ===================================================== */

window.selectPayment = function(method){

    const total =
        cartTotal();

    if(
        method === "COD" &&
        total > 9999
    ){

        toast(
            "COD unavailable above ₹9,999."
        );

        return;

    }

    selectedPayment=method;

    document
        .getElementById("upiButton")
        .classList.remove("selected");

    document
        .getElementById("codButton")
        .classList.remove("selected");

    document
        .getElementById("upiBox")
        .classList.add("hidden");

    if(method === "UPI"){

        document
            .getElementById("upiButton")
            .classList.add("selected");

        document
            .getElementById("upiBox")
            .classList.remove("hidden");

    }else{

        document
            .getElementById("codButton")
            .classList.add("selected");

    }

};


/* =====================================================
   UPI
   ===================================================== */

window.openUPI = function(){

    if(!upiId){

        toast(
            "UPI ID is not configured."
        );

        return;

    }

    const amount =
        cartTotal();

    const url =
        "upi://pay" +
        "?pa=" +
        encodeURIComponent(upiId) +
        "&pn=" +
        encodeURIComponent(upiName) +
        "&am=" +
        encodeURIComponent(amount) +
        "&cu=INR" +
        "&tn=" +
        encodeURIComponent(
            "Drex Noire Order"
        );

    window.location.href=url;

};


/* =====================================================
   PLACE ORDER
   ===================================================== */

window.placeOrder = async function(){

    if(!currentUser){

        toast("Login required.");

        return;

    }

    if(!cart.length){

        toast("Your bag is empty.");

        return;

    }

    if(!selectedPayment){

        toast(
            "Select a payment method."
        );

        return;

    }

    const name =
        document.getElementById(
            "checkoutName"
        ).value.trim();

    const email =
        document.getElementById(
            "checkoutEmail"
        ).value.trim();

    const phone =
        document.getElementById(
            "checkoutPhone"
        ).value.trim();

    const address =
        document.getElementById(
            "checkoutAddress"
        ).value.trim();

    const city =
        document.getElementById(
            "checkoutCity"
        ).value.trim();

    const state =
        document.getElementById(
            "checkoutState"
        ).value.trim();

    const pin =
        document.getElementById(
            "checkoutPin"
        ).value.trim();

    if(
        !name ||
        !email ||
        !phone ||
        !address ||
        !city ||
        !state ||
        !pin
    ){

        toast(
            "Complete all delivery fields."
        );

        return;

    }

    const total =
        cartTotal();

    if(
        selectedPayment === "COD" &&
        total > 9999
    ){

        toast(
            "COD unavailable above ₹9,999."
        );

        return;

    }

    try{

        const orderRef =
            push(
                ref(db,"orders")
            );

        const items =
            cart.map(item => {

                const p =
                    products.find(
                        product =>
                        product.id === item.id
                    );

                return {

                    productId:item.id,

                    productName:
                        p?.name || "",

                    price:
                        Number(p?.price || 0),

                    quantity:
                        item.quantity,

                    image:
                        p?.image || ""

                };

            });

        await set(
            orderRef,
            {

                orderId:
                    orderRef.key,

                userId:
                    currentUser.uid,

                customerName:
                    name,

                customerEmail:
                    email,

                phone:
                    phone,

                address:
                    `${address}, ${city}, ${state} - ${pin}`,

                items,

                total,

                paymentMethod:
                    selectedPayment,

                paymentStatus:
                    selectedPayment === "COD"
                    ? "Pending"
                    : "Manual Verification",

                status:"Pending",

                createdAt:
                    Date.now()

            }
        );


        await update(
            ref(
                db,
                "customers/" +
                currentUser.uid
            ),
            {

                name,

                email,

                phone,

                lastOrderAt:
                    Date.now()

            }
        );


        cart=[];

        saveCart();

        updateCartCount();

        toast(
            "Order placed successfully."
        );

        setTimeout(
            () => showPage("orders"),
            700
        );

    }catch(error){

        console.error(error);

        toast(
            "Order could not be placed."
        );

    }

};


/* =====================================================
   AUTH
   ===================================================== */

window.openAuth=function(mode){

    authMode=mode;

    document
        .getElementById("authModal")
        .classList.add("show");

    document.getElementById(
        "authTitle"
    ).textContent =
        mode === "login"
        ? "Login"
        : "Create Account";

    document.getElementById(
        "authSubmit"
    ).textContent =
        mode === "login"
        ? "LOGIN"
        : "CREATE ACCOUNT";

    document
        .getElementById("signupNameField")
        .classList.toggle(
            "hidden",
            mode === "login"
        );

};


window.closeAuth=function(){

    document
        .getElementById("authModal")
        .classList.remove("show");

};


window.submitAuth=async function(){

    const email =
        document.getElementById(
            "authEmail"
        ).value.trim();

    const password =
        document.getElementById(
            "authPassword"
        ).value;

    const name =
        document.getElementById(
            "authName"
        ).value.trim();

    const error =
        document.getElementById(
            "authError"
        );

    error.textContent="";

    try{

        if(authMode==="login"){

            await signInWithEmailAndPassword(
                auth,
                email,
                password
            );

            closeAuth();

            toast("Welcome back.");

        }else{

            if(!name){

                error.textContent =
                    "Enter your name.";

                return;

            }

            const result =
                await createUserWithEmailAndPassword(
                    auth,
                    email,
                    password
                );

            await set(
                ref(
                    db,
                    "customers/" +
                    result.user.uid
                ),
                {

                    uid:
                        result.user.uid,

                    name,

                    email,

                    createdAt:
                        Date.now()

                }
            );

            closeAuth();

            toast(
                "Account created."
            );

        }

    }catch(e){

        console.error(e);

        error.textContent =
            "Unable to complete authentication.";

    }

};


/* =====================================================
   AUTH STATE
   ===================================================== */

onAuthStateChanged(
    auth,
    user => {

        currentUser=user;

        if(user){

            document
                .getElementById(
                    "loggedOut"
                )
                .classList.add("hidden");

            document
                .getElementById(
                    "loggedIn"
                )
                .classList.remove("hidden");

            document.getElementById(
                "accountEmail"
            ).textContent =
                user.email;

            loadCustomer();

            loadOrders();

        }else{

            document
                .getElementById(
                    "loggedOut"
                )
                .classList.remove("hidden");

            document
                .getElementById(
                    "loggedIn"
                )
                .classList.add("hidden");

            document.getElementById(
                "accountEmail"
            ).textContent="";

        }

    }
);


/* =====================================================
   CUSTOMER
   ===================================================== */

function loadCustomer(){

    if(!currentUser)return;

    onValue(
        ref(
            db,
            "customers/" +
            currentUser.uid
        ),
        snapshot => {

            const data =
                snapshot.val() || {};

            document.getElementById(
                "accountTitle"
            ).textContent =
                data.name ||
                "Welcome";

            document.getElementById(
                "checkoutName"
            ).value =
                data.name || "";

            document.getElementById(
                "checkoutEmail"
            ).value =
                data.email ||
                currentUser.email;

            document.getElementById(
                "checkoutPhone"
            ).value =
                data.phone || "";

        }
    );

}


/* =====================================================
   ORDERS
   ===================================================== */

function loadOrders(){

    onValue(
        ref(db,"orders"),
        snapshot => {

            const data =
                snapshot.val() || {};

            orders =
                Object.entries(data)
                .map(([id,value])=>({
                    id,
                    ...value
                }))
                .filter(
                    order =>
                    order.userId ===
                    currentUser?.uid
                )
                .sort(
                    (a,b)=>
                    (b.createdAt || 0) -
                    (a.createdAt || 0)
                );

            renderOrders();

        }
    );

}


function renderOrders(){

    const box =
        document.getElementById(
            "ordersContainer"
        );

    if(!currentUser){

        box.innerHTML=`

            <div class="account">

                <h3>Login to view orders.</h3>

                <button
                    class="black-btn full"
                    onclick="openAuth('login')"
                >
                    LOGIN
                </button>

            </div>
        `;

        return;

    }

    if(!orders.length){

        box.innerHTML=`

            <div class="account">

                <h3>No orders yet.</h3>

                <button
                    class="black-btn full"
                    onclick="showPage('shop')"
                >
                    SHOP NOW
                </button>

            </div>
        `;

        return;

    }

    box.innerHTML =
        orders.map(order => {

            const first =
                order.items?.[0];

            const status =
                String(
                    order.status ||
                    "Pending"
                ).toLowerCase();

            return `

                <article class="order">

                    <div class="order-top">

                        <div>

                            <div class="order-id">
                                #${safe(
                                    order.orderId ||
                                    order.id
                                )}
                            </div>

                            <div class="order-date">
                                ${date(
                                    order.createdAt
                                )}
                            </div>

                        </div>

                        <div class="
                            status
                            ${status}
                        ">
                            ${safe(
                                order.status ||
                                "Pending"
                            )}
                        </div>

                    </div>

                    <div class="order-body">

                        <p>
                            ${
                                first
                                ? safe(first.productName)
                                : "Order"
                            }

                            ${
                                order.items?.length > 1
                                ? ` + ${
                                    order.items.length-1
                                  } more`
                                : ""
                            }
                        </p>

                        <p>
                            Payment:
                            ${safe(
                                order.paymentMethod
                            )}
                        </p>

                        <p>
                            <b>
                            Total:
                            ₹${money(order.total)}
                            </b>
                        </p>

                    </div>

                </article>
            `;

        }).join("");

}


/* =====================================================
   LOGOUT
   ===================================================== */

window.logout=async function(){

    await signOut(auth);

    toast("Logged out.");

};


/* =====================================================
   HELPERS
   ===================================================== */

function money(value){

    return Number(
        value || 0
    ).toLocaleString(
        "en-IN"
    );

}


function date(value){

    if(!value)
        return "";

    return new Date(
        Number(value)
    ).toLocaleDateString(
        "en-IN"
    );

}


function safe(value){

    return String(
        value ?? ""
    )
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");

}


function toast(message){

    const t =
        document.getElementById(
            "toast"
        );

    t.textContent=message;

    t.classList.add("show");

    setTimeout(
        ()=>t.classList.remove("show"),
        2500
    );

}