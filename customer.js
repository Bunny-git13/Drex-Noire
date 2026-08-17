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

let cart = JSON.parse(
    localStorage.getItem("drexCart") || "[]"
);

let currentUser = null;

let selectedPayment = null;

let upiId = "";

let upiName = "Drex Noiré";

let orders = [];

let authMode = "login";

let currentProductId = null;

let selectedSize = null;


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
        document.getElementById(name + "Page");

    if(page){

        page.classList.add("active");

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });

    }

    if(name === "orders"){
        renderOrders();
    }
};


/* =====================================================
   LOADER
   ===================================================== */

window.addEventListener("load", () => {

    setTimeout(() => {

        const loader =
            document.getElementById("loader");

        if(!loader) return;

        loader.style.opacity = "0";

        setTimeout(() => {
            loader.remove();
        }, 500);

    }, 600);

});


/* =====================================================
   PRODUCTS
   ===================================================== */

onValue(
    ref(db, "products"),
    snapshot => {

        const data =
            snapshot.val() || {};

        products =
            Object.entries(data)
            .map(([id, value]) => ({
                id,
                ...value
            }))
            .filter(
                product =>
                product.active !== false
            );

        renderProducts();

        /*
         * If the customer is currently viewing a product,
         * refresh its detail page when admin changes it.
         */
        if(currentProductId){

            const current =
                products.find(
                    p => p.id === currentProductId
                );

            if(current){
                renderProductDetail(current);
            }

        }

    },

    error => {

        console.error(error);

        toast(
            "Unable to load collection."
        );

    }
);


/* =====================================================
   UPI
   ===================================================== */

onValue(
    ref(db, "settings/store"),
    snapshot => {

        const data =
            snapshot.val() || {};

        upiId =
            data.upiId || "";

        upiName =
            data.upiName ||
            "Drex Noiré";

        const nameElement =
            document.getElementById(
                "upiDisplayName"
            );

        const idElement =
            document.getElementById(
                "upiDisplayId"
            );

        if(nameElement){
            nameElement.textContent = upiName;
        }

        if(idElement){
            idElement.textContent =
                upiId || "UPI not configured";
        }

    }
);


/* =====================================================
   PRODUCT SIZE HELPERS
   ===================================================== */

/*
 * Supports the normal admin format:
 *
 * sizes: ["S","M","L","XL"]
 *
 * Also supports:
 *
 * availableSizes: ["S","M","L","XL"]
 *
 * and a single size value.
 */

function getProductSizes(product){

    if(!product){
        return [];
    }

    let sizes = [];

    if(Array.isArray(product.sizes)){
        sizes = product.sizes;
    }
    else if(
        product.sizes &&
        typeof product.sizes === "object"
    ){
        sizes = Object.keys(product.sizes)
            .filter(size => {

                const value =
                    product.sizes[size];

                if(
                    value &&
                    typeof value === "object" &&
                    value.available === false
                ){
                    return false;
                }

                return true;

            });
    }
    else if(Array.isArray(product.availableSizes)){
        sizes = product.availableSizes;
    }
    else if(typeof product.availableSizes === "string"){
        sizes =
            product.availableSizes
            .split(",")
            .map(size => size.trim())
            .filter(Boolean);
    }
    else if(typeof product.size === "string"){
        sizes =
            product.size
            .split(",")
            .map(size => size.trim())
            .filter(Boolean);
    }

    return sizes
        .map(size => String(size).trim())
        .filter(Boolean);
}


function productHasSizes(product){

    return getProductSizes(product).length > 0;

}


/* =====================================================
   SIZE STOCK
   ===================================================== */

function getSizeStock(product, size){

    if(!product || !size){
        return null;
    }

    const sizeStock =
        product.sizeStock ||
        product.stockBySize ||
        product.sizesStock;

    if(
        sizeStock &&
        typeof sizeStock === "object" &&
        sizeStock[size] !== undefined
    ){

        const value =
            sizeStock[size];

        if(
            value &&
            typeof value === "object" &&
            value.stock !== undefined
        ){
            return Number(value.stock);
        }

        return Number(value);
    }

    return null;
}


function isSizeAvailable(product, size){

    const stock =
        getSizeStock(product, size);

    if(stock === null || Number.isNaN(stock)){
        return true;
    }

    return stock > 0;
}


/* =====================================================
   PRODUCTS
   ===================================================== */

function renderProducts(){

    renderGrid(
        document.getElementById("shopProducts"),
        products
    );

    renderGrid(
        document.getElementById("featuredProducts"),
        products.slice(0, 4)
    );

}


function renderGrid(container, list){

    if(!container){
        return;
    }

    if(!list.length){

        container.innerHTML = `
            <p class="empty-products">
                No products available.
            </p>
        `;

        return;
    }

    container.innerHTML =
        list.map(product => {

            const sizes =
                getProductSizes(product);

            const hasSizes =
                sizes.length > 0;

            const stock =
                Number(product.stock || 0);

            const available =
                hasSizes
                ? sizes.some(
                    size =>
                    isSizeAvailable(
                        product,
                        size
                    )
                )
                : stock > 0;

            return `

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
                            available
                            ? (
                                hasSizes
                                ? "Select size"
                                : "In stock"
                              )
                            : "Sold out"
                        }

                    </div>

                    <button
                        class="product-action"
                        onclick="handleProductAction('${product.id}')"
                        ${!available ? "disabled" : ""}
                    >

                        ${
                            hasSizes
                            ? "SELECT SIZE"
                            : "ADD TO BAG"
                        }

                    </button>

                </div>

            </article>

            `;

        }).join("");

}


/* =====================================================
   PRODUCT ACTION
   ===================================================== */

window.handleProductAction = function(id){

    const product =
        products.find(
            p => p.id === id
        );

    if(!product){
        return;
    }

    if(productHasSizes(product)){

        openProduct(id);

        return;
    }

    addToCart(id);

};


/* =====================================================
   SEARCH
   ===================================================== */

const searchInput =
    document.getElementById(
        "searchInput"
    );

const categoryFilter =
    document.getElementById(
        "categoryFilter"
    );

if(searchInput){
    searchInput.addEventListener(
        "input",
        filterProducts
    );
}

if(categoryFilter){
    categoryFilter.addEventListener(
        "change",
        filterProducts
    );
}


function filterProducts(){

    const search =
        String(
            document.getElementById(
                "searchInput"
            )?.value || ""
        ).toLowerCase();

    const category =
        document.getElementById(
            "categoryFilter"
        )?.value || "all";

    const result =
        products.filter(product => {

            const name =
                String(
                    product.name || ""
                ).toLowerCase();

            const description =
                String(
                    product.description || ""
                ).toLowerCase();

            const matchesSearch =
                name.includes(search) ||
                description.includes(search);

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

    const product =
        products.find(
            p => p.id === id
        );

    if(!product){
        return;
    }

    currentProductId = id;

    selectedSize = null;

    renderProductDetail(product);

    showPage("product");

};


function renderProductDetail(product){

    if(!product){
        return;
    }

    const sizes =
        getProductSizes(product);

    const hasSizes =
        sizes.length > 0;

    const detail =
        document.getElementById(
            "productDetail"
        );

    if(!detail){
        return;
    }

    detail.innerHTML = `

        <div class="detail-image">

            <img
                src="${safe(product.image)}"
                alt="${safe(product.name)}"
            >

        </div>

        <div class="detail-info">

            <small class="detail-category">
                ${safe(product.category)}
            </small>

            <h1>
                ${safe(product.name)}
            </h1>

            <div class="detail-price">
                ₹${money(product.price)}
            </div>

            <p class="description">
                ${safe(product.description)}
            </p>

            ${
                hasSizes
                ? `
                    <div class="size-selector">

                        <span class="size-selector-title">
                            SELECT SIZE
                        </span>

                        <div class="size-options">

                            ${
                                sizes.map(size => {

                                    const available =
                                        isSizeAvailable(
                                            product,
                                            size
                                        );

                                    return `

                                        <button
                                            type="button"
                                            class="size-btn ${
                                                !available
                                                ? "unavailable"
                                                : ""
                                            }"
                                            data-size="${safe(size)}"
                                            onclick="selectSize('${safeAttribute(size)}')"
                                            ${
                                                !available
                                                ? "disabled"
                                                : ""
                                            }
                                        >

                                            ${safe(size)}

                                        </button>

                                    `;

                                }).join("")
                            }

                        </div>

                        <div
                            id="sizeHint"
                            class="size-hint"
                        >
                            Please select a size
                        </div>

                    </div>
                `
                : ""
            }

            <button
                id="detailAddButton"
                class="black-btn full detail-add-button"
                onclick="addCurrentProductToCart()"
            >

                ${
                    hasSizes
                    ? "SELECT A SIZE"
                    : "ADD TO BAG"
                }

            </button>

        </div>

    `;

}


/* =====================================================
   SIZE SELECTION
   ===================================================== */

window.selectSize = function(size){

    const product =
        products.find(
            p => p.id === currentProductId
        );

    if(!product){
        return;
    }

    if(!isSizeAvailable(product, size)){

        toast(
            `Size ${size} is unavailable.`
        );

        return;
    }

    selectedSize = size;

    document
        .querySelectorAll(".size-btn")
        .forEach(button => {

            button.classList.toggle(
                "selected",
                button.dataset.size === size
            );

        });

    const hint =
        document.getElementById(
            "sizeHint"
        );

    if(hint){

        hint.textContent =
            `Size ${size} selected`;

        hint.classList.add("selected");

    }

    const addButton =
        document.getElementById(
            "detailAddButton"
        );

    if(addButton){

        addButton.textContent =
            "ADD TO BAG";

        addButton.classList.add(
            "ready"
        );

    }

};


window.addCurrentProductToCart = function(){

    const product =
        products.find(
            p => p.id === currentProductId
        );

    if(!product){
        return;
    }

    const sizes =
        getProductSizes(product);

    if(sizes.length > 0){

        if(!selectedSize){

            const hint =
                document.getElementById(
                    "sizeHint"
                );

            if(hint){

                hint.textContent =
                    "Please select a size first.";

                hint.classList.add(
                    "error"
                );

            }

            toast(
                "Please select a size."
            );

            return;
        }

    }

    addToCart(
        product.id,
        selectedSize
    );

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
            (sum, item) =>
            sum + Number(item.quantity || 0),
            0
        );

    const element =
        document.getElementById(
            "cartCount"
        );

    if(element){
        element.textContent = count;
    }

}


updateCartCount();


window.addToCart = function(id, size = null){

    const product =
        products.find(
            p => p.id === id
        );

    if(!product){
        return;
    }

    const sizes =
        getProductSizes(product);

    if(sizes.length > 0 && !size){

        openProduct(id);

        toast(
            "Please select a size."
        );

        return;
    }

    if(size && !isSizeAvailable(product, size)){

        toast(
            `Size ${size} is unavailable.`
        );

        return;
    }

    if(
        sizes.length === 0 &&
        Number(product.stock || 0) <= 0
    ){

        toast(
            "This product is sold out."
        );

        return;
    }


    /*
     * Products with sizes are identified by:
     *
     * product ID + selected size
     */

    const item =
        cart.find(item =>
            item.id === id &&
            (item.size || null) ===
            (size || null)
        );


    if(item){

        item.quantity++;

    }else{

        cart.push({

            id,

            size: size || null,

            quantity: 1

        });

    }


    saveCart();

    updateCartCount();

    renderCart();

    toast(
        size
        ? `${product.name} — ${size} added to bag.`
        : "Added to bag."
    );

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

    if(!container){
        return;
    }

    if(!cart.length){

        container.innerHTML =
            `
            <div class="empty-cart">
                <span>YOUR BAG IS EMPTY</span>
            </div>
            `;

        document.getElementById(
            "cartTotal"
        ).textContent = "₹0";

        return;
    }


    let total = 0;


    container.innerHTML =
        cart.map((item, index) => {

            const product =
                products.find(
                    p =>
                    p.id === item.id
                );

            if(!product){
                return "";
            }


            const quantity =
                Number(item.quantity || 1);


            const value =
                Number(product.price || 0)
                * quantity;


            total += value;


            return `

                <div class="cart-item">

                    <img
                        src="${safe(product.image)}"
                        alt=""
                    >

                    <div class="cart-item-info">

                        <h4>
                            ${safe(product.name)}
                        </h4>

                        ${
                            item.size
                            ? `
                                <span class="cart-size">
                                    SIZE ${safe(item.size)}
                                </span>
                              `
                            : ""
                        }

                        <p>
                            ₹${money(product.price)}
                            × ${quantity}
                        </p>

                    </div>

                    <button
                        class="remove"
                        onclick="removeCartItem(${index})"
                    >
                        REMOVE
                    </button>

                </div>

            `;

        }).join("");


    const totalElement =
        document.getElementById(
            "cartTotal"
        );

    if(totalElement){

        totalElement.textContent =
            "₹" + money(total);

    }

}


window.removeCartItem = function(index){

    if(
        index < 0 ||
        index >= cart.length
    ){
        return;
    }

    cart.splice(index, 1);

    saveCart();

    updateCartCount();

    renderCart();

};


window.removeCart = function(id){

    cart =
        cart.filter(
            item =>
            item.id !== id
        );

    saveCart();

    updateCartCount();

    renderCart();

};


/* =====================================================
   CART TOTAL
   ===================================================== */

function cartTotal(){

    return cart.reduce(
        (total, item) => {

            const product =
                products.find(
                    p =>
                    p.id === item.id
                );

            return total +
                (
                    Number(
                        product?.price || 0
                    )
                    *
                    Number(
                        item.quantity || 1
                    )
                );

        },
        0
    );

}


/* =====================================================
   CHECKOUT
   ===================================================== */

window.openCheckout = function(){

    if(!cart.length){

        toast(
            "Your bag is empty."
        );

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


function renderCheckout(){

    let total = 0;

    const box =
        document.getElementById(
            "checkoutItems"
        );

    if(!box){
        return;
    }


    box.innerHTML =
        cart.map(item => {

            const product =
                products.find(
                    p =>
                    p.id === item.id
                );

            if(!product){
                return "";
            }


            const quantity =
                Number(
                    item.quantity || 1
                );


            const amount =
                Number(
                    product.price || 0
                )
                *
                quantity;


            total += amount;


            return `

                <div class="summary-item">

                    <span>

                        ${safe(product.name)}

                        ${
                            item.size
                            ? `
                                <small class="summary-size">
                                    SIZE ${safe(item.size)}
                                </small>
                              `
                            : ""
                        }

                        ×${quantity}

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


/* =====================================================
   COD
   ===================================================== */

function updateCOD(total){

    const button =
        document.getElementById(
            "codButton"
        );

    const message =
        document.getElementById(
            "codMessage"
        );

    if(!button || !message){
        return;
    }


    if(total > 9999){

        button.disabled = true;

        message.textContent =
            "Unavailable above ₹9,999";

        if(selectedPayment === "COD"){
            selectedPayment = null;
        }

    }else{

        button.disabled = false;

        message.textContent =
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


    selectedPayment = method;


    document
        .getElementById("upiButton")
        ?.classList.remove(
            "selected"
        );

    document
        .getElementById("codButton")
        ?.classList.remove(
            "selected"
        );

    document
        .getElementById("upiBox")
        ?.classList.add(
            "hidden"
        );


    if(method === "UPI"){

        document
            .getElementById("upiButton")
            ?.classList.add(
                "selected"
            );

        document
            .getElementById("upiBox")
            ?.classList.remove(
                "hidden"
            );

    }else{

        document
            .getElementById("codButton")
            ?.classList.add(
                "selected"
            );

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


    window.location.href = url;

};


/* =====================================================
   PLACE ORDER
   ===================================================== */

window.placeOrder = async function(){

    if(!currentUser){

        toast(
            "Login required."
        );

        return;
    }


    if(!cart.length){

        toast(
            "Your bag is empty."
        );

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
                ref(db, "orders")
            );


        const items =
            cart.map(item => {

                const product =
                    products.find(
                        p =>
                        p.id === item.id
                    );


                return {

                    productId:
                        item.id,

                    productName:
                        product?.name || "",

                    price:
                        Number(
                            product?.price || 0
                        ),

                    quantity:
                        Number(
                            item.quantity || 1
                        ),

                    size:
                        item.size || null,

                    image:
                        product?.image || ""

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

                status:
                    "Pending",

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


        cart = [];

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

window.openAuth = function(mode){

    authMode = mode;


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


window.closeAuth = function(){

    document
        .getElementById("authModal")
        .classList.remove("show");

};


window.submitAuth = async function(){

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


    error.textContent = "";


    try{

        if(authMode === "login"){

            await signInWithEmailAndPassword(
                auth,
                email,
                password
            );

            closeAuth();

            toast(
                "Welcome back."
            );

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

        currentUser = user;


        if(user){

            document
                .getElementById("loggedOut")
                .classList.add("hidden");


            document
                .getElementById("loggedIn")
                .classList.remove("hidden");


            document.getElementById(
                "accountEmail"
            ).textContent =
                user.email;


            loadCustomer();

            loadOrders();


        }else{

            document
                .getElementById("loggedOut")
                .classList.remove("hidden");


            document
                .getElementById("loggedIn")
                .classList.add("hidden");


            document.getElementById(
                "accountEmail"
            ).textContent = "";

            orders = [];

        }

    }
);


/* =====================================================
   CUSTOMER
   ===================================================== */

function loadCustomer(){

    if(!currentUser){
        return;
    }


    onValue(
        ref(
            db,
            "customers/" +
            currentUser.uid
        ),
        snapshot => {

            const data =
                snapshot.val() || {};


            const title =
                document.getElementById(
                    "accountTitle"
                );

            if(title){

                title.textContent =
                    data.name ||
                    "Welcome";

            }


            const name =
                document.getElementById(
                    "checkoutName"
                );

            const email =
                document.getElementById(
                    "checkoutEmail"
                );

            const phone =
                document.getElementById(
                    "checkoutPhone"
                );


            if(name){
                name.value =
                    data.name || "";
            }


            if(email){

                email.value =
                    data.email ||
                    currentUser.email ||
                    "";

            }


            if(phone){
                phone.value =
                    data.phone || "";
            }

        }
    );

}


/* =====================================================
   ORDERS
   ===================================================== */

function loadOrders(){

    if(!currentUser){
        return;
    }


    onValue(
        ref(db, "orders"),
        snapshot => {

            const data =
                snapshot.val() || {};


            orders =
                Object.entries(data)
                .map(([id, value]) => ({
                    id,
                    ...value
                }))
                .filter(
                    order =>
                    order.userId ===
                    currentUser?.uid
                )
                .sort(
                    (a, b) =>
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


    if(!box){
        return;
    }


    if(!currentUser){

        box.innerHTML = `

            <div class="account">

                <h3>
                    Login to view orders.
                </h3>

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

        box.innerHTML = `

            <div class="account">

                <h3>
                    No orders yet.
                </h3>

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
                            ${safeClass(status)}
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
                                ? safe(
                                    first.productName
                                  )
                                : "Order"
                            }

                            ${
                                first?.size
                                ? `
                                    <span class="order-size">
                                        SIZE ${safe(
                                            first.size
                                        )}
                                    </span>
                                  `
                                : ""
                            }

                            ${
                                order.items?.length > 1
                                ? ` + ${
                                    order.items.length - 1
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

window.logout = async function(){

    await signOut(auth);

    toast(
        "Logged out."
    );

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

    if(!value){
        return "";
    }


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
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

}


function safeAttribute(value){

    return String(
        value ?? ""
    )
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'");
}


function safeClass(value){

    return String(
        value || ""
    )
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "");

}


function toast(message){

    const t =
        document.getElementById(
            "toast"
        );


    if(!t){
        return;
    }


    t.textContent = message;

    t.classList.add("show");


    setTimeout(
        () => t.classList.remove("show"),
        2500
    );

}